import * as cp from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import { WebSocket, WebSocketServer } from 'ws';
import {
  AiProvider,
  DEFAULT_AI_TIMEOUT_SECONDS,
  clearApiKey,
  getApiKey,
  loadAiSettingsSnapshot,
  parseAiRequestSettings,
  previewAiRequest,
  setAiSecretStorage,
  setApiKey,
  testAiConnection
} from '../aiProviders';
import { AvatarManager } from '../avatarManager';
import { setSettingFallbackStorage } from '../config';
import { DataSource } from '../dataSource';
import { DiffDocProvider } from '../diffDocProvider';
import { ExtensionState } from '../extensionState';
import { FileTimeMachine } from '../fileTimeMachine';
import { GitGraphView } from '../gitGraphView';
import { Logger } from '../logger';
import {
  hostBridge,
  OpenDialogRequest,
  SaveDialogRequest,
  VisualFileHistoryOpenPayload
} from '../platform/hostBridge';
import * as vscode from '../platform/vscode';
import {
  dispatchMessageToGitMapPanel,
  dispatchMessageToPanel,
  disposeStandalonePanel,
  getAllStandaloneSettings,
  initStandaloneConfig,
  JsonFileMemento,
  JsonSecretStorage,
  SecretCipher,
  updateStandaloneSetting,
  updateStandaloneSettingsBatch
} from '../platform/vscode';
import { formatRemoteRepoUri, isRemoteRepo, parseRemoteRepo, readRepoFileBuffer } from '../remote/repoTransport';
import { quotePosixArg, RemoteDirectoryEntry, sshManager } from '../remote/sshManager';
import { TransferDirection, transferManager } from '../remote/transferManager';
import { RemoveFromHistory } from '../removeFromHistory';
import { RepoFileWatcher } from '../repoFileWatcher';
import { RepoManager } from '../repoManager';
import { findGit, getPathFromStr, getRepoName, GitExecutable } from '../utils';
import { EventEmitter as GitMapEventEmitter } from '../utils/event';
import { fsmRegistry } from '../utils/fsm';
import { VisualFileHistory } from '../visualFileHistory';
import { AiAssistantService } from './aiAssistantService';
import { DiffService, isLossyUtf8 } from './diffService';
import { EnhancementsService } from './enhancementsService';
import { buildPartialHunkPatch, GitWorkflowService } from './gitWorkflowService';
import { HostingProviderKind, HostingService } from './hostingService';
import { LauncherSettings, listLaunchers, openInEditor, openInTerminal } from './launchers';
import {
  BackupPayload,
  checkGitHubUpdate,
  createBackupEnvelope,
  parseBackupEnvelope,
  sanitizeSshHostsForExport
} from './settingsBackupService';
import { TerminalManager } from './terminalManager';

export interface DesktopNativeHooks {
  showOpenDialog?: (req: OpenDialogRequest) => Promise<string[] | undefined>;
  showSaveDialog?: (req: SaveDialogRequest) => Promise<string | undefined>;
  writeClipboard?: (text: string) => Promise<boolean>;
  openExternal?: (url: string) => Promise<boolean>;
  /** Move a local file / folder to the system Trash (desktop app only): local deletes become recoverable. */
  trashItem?: (fullPath: string) => Promise<void>;
}

export interface GitMapServerOptions {
  port?: number;
  host?: string;
  dataDir?: string;
  initialRepos?: string[];
  requireAuth?: boolean;
  authToken?: string;
  secretCipher?: SecretCipher;
  desktopHooks?: DesktopNativeHooks;
}

const MIME_TYPES: { [ext: string]: string } = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon'
};

const SESSION_COOKIE_NAME = 'gitmap_session';

const SHELL_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https: http:",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss:",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'"
].join('; ');

function safeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function parseCookies(cookieHeader: string | undefined): { [name: string]: string } {
  const out: { [name: string]: string } = {};
  if (!cookieHeader) return out;
  for (const pair of cookieHeader.split(';')) {
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const k = pair.substring(0, eq).trim();
    const v = pair.substring(eq + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

export class GitMapServer {
  private readonly rootDir: string;
  private readonly dataDir: string;
  private readonly host: string;
  private requestedPort: number;
  private desktopHooks: DesktopNativeHooks;
  private readonly authEnabled: boolean;
  private readonly authToken: string;
  private readonly sessionSecret: string;
  private pkgVersion: string = '1.0.0';

  private server!: http.Server;
  private wss!: WebSocketServer;
  private readonly clients = new Set<WebSocket>();
  private readonly uiClients = new Set<WebSocket>();
  private readonly pendingPrompts = new Map<string, (value: any) => void>();
  private readonly vfhPages = new Map<string, VisualFileHistoryOpenPayload>();

  public logger!: Logger;
  public extensionState!: ExtensionState;
  public dataSource!: DataSource;
  public avatarManager!: AvatarManager;
  public repoManager!: RepoManager;
  public diffService!: DiffService;
  public workflowService!: GitWorkflowService;
  public enhancementsService!: EnhancementsService;
  public aiAssistantService!: AiAssistantService;
  public hostingService!: HostingService;
  public terminalManager!: TerminalManager;
  private actualPort: number = 0;

  constructor(private readonly options: GitMapServerOptions = {}) {
    this.rootDir = path.resolve(__dirname, '..', '..');
    this.dataDir = options.dataDir || process.env.GITMAP_DATA_DIR || path.join(os.homedir(), '.gitmap');
    this.host = options.host || '127.0.0.1';
    this.requestedPort = typeof options.port === 'number' ? options.port : 3847;
    this.desktopHooks = options.desktopHooks || {};
    // Non-loopback bindings ALWAYS enforce token authentication so LAN/public interfaces are never exposed
    this.authEnabled = !this.isLoopbackBinding() || !!options.requireAuth || typeof options.authToken === 'string';
    this.authToken = options.authToken || crypto.randomBytes(32).toString('hex');
    this.sessionSecret = crypto.createHmac('sha256', this.authToken).update('gitmap-session-v1').digest('hex');
  }

  public setDesktopHooks(hooks: DesktopNativeHooks) {
    this.workflowService?.setTrash(hooks.trashItem || null);
    this.desktopHooks = hooks;
  }

  public getPort(): number {
    return this.actualPort;
  }

  public getAuthToken(): string | null {
    return this.authEnabled ? this.authToken : null;
  }

  public getUrl(): string {
    const displayHost = this.host === '0.0.0.0' ? '127.0.0.1' : this.host;
    return `http://${displayHost}:${this.actualPort}`;
  }

  public getAuthUrl(): string {
    if (!this.authEnabled) return this.getUrl();
    return `${this.getUrl()}/?token=${encodeURIComponent(this.authToken)}`;
  }

  public async start(): Promise<string> {
    await fs.promises.mkdir(this.dataDir, { recursive: true, mode: 0o700 });
    initStandaloneConfig(this.dataDir);

    const globalState = new JsonFileMemento(path.join(this.dataDir, 'global-state.json'));
    const workspaceState = new JsonFileMemento(path.join(this.dataDir, 'workspace-state.json'));
    const secrets = new JsonSecretStorage(path.join(this.dataDir, 'secrets.json'), this.options.secretCipher);
    const storageDir = path.join(this.dataDir, 'storage');
    await fs.promises.mkdir(storageDir, { recursive: true, mode: 0o700 });

    setSettingFallbackStorage(globalState);
    setAiSecretStorage(secrets);
    sshManager.init(this.dataDir, secrets, () => this.uiClients.size > 0);
    sshManager.setOnHostsChanged(() => {
      this.broadcast({ type: 'ssh:hostsChanged', sshHosts: sshManager.listHosts() });
    });
    transferManager.init(this.dataDir, (transfers) => {
      this.broadcast({ type: 'transfers:update', transfers });
      if (transfers.some((t) => t.state === 'completed' || t.state === 'undone')) {
        RepoFileWatcher.notifyPossibleRemoteChange(450);
      }
    });

    const pkgJson = JSON.parse(fs.readFileSync(path.join(this.rootDir, 'package.json'), 'utf8'));
    if (typeof pkgJson.version === 'string') {
      this.pkgVersion = pkgJson.version;
    }

    const context: vscode.ExtensionContext = {
      subscriptions: [],
      globalState,
      workspaceState,
      secrets,
      extensionPath: this.rootDir,
      extensionUri: vscode.Uri.file(this.rootDir),
      globalStoragePath: storageDir,
      globalStorageUri: vscode.Uri.file(storageDir),
      logPath: path.join(this.dataDir, 'logs'),
      extension: { packageJSON: pkgJson },
      asAbsolutePath: (rel: string) => path.join(this.rootDir, rel)
    };

    this.setupHostBridge();

    this.logger = new Logger();
    const gitExecEmitter = new GitMapEventEmitter<GitExecutable>();
    this.extensionState = new ExtensionState(context, gitExecEmitter.subscribe);

    const foundGit = await findGit(this.extensionState).then((exe) => exe, () => null);
    if (foundGit) {
      gitExecEmitter.emit(foundGit);
      this.logger.log(`Using Git: ${foundGit.path} (${foundGit.version})`);
    }

    const configChangeEmitter = new GitMapEventEmitter<vscode.ConfigurationChangeEvent>();
    vscode.workspace.onDidChangeConfiguration((e) => configChangeEmitter.emit(e));

    this.dataSource = new DataSource(foundGit, configChangeEmitter.subscribe, gitExecEmitter.subscribe, this.logger);
    this.avatarManager = new AvatarManager(this.dataSource, this.extensionState, this.logger);
    this.repoManager = new RepoManager(this.dataSource, this.extensionState, configChangeEmitter.subscribe, this.logger);
    this.diffService = new DiffService(this.dataSource);
    this.workflowService = new GitWorkflowService(this.dataSource);
    this.workflowService.setTrash(this.desktopHooks.trashItem || null);
    this.enhancementsService = new EnhancementsService(this.dataSource);
    this.aiAssistantService = new AiAssistantService(this.dataSource);
    this.hostingService = new HostingService(this.dataSource);
    this.hostingService.setSecretStorage(secrets);
    this.terminalManager = new TerminalManager();

    const diffDocProvider = new DiffDocProvider(this.dataSource);
    vscode.workspace.registerTextDocumentContentProvider(DiffDocProvider.scheme, diffDocProvider);
    new RemoveFromHistory(context, this.dataSource, this.repoManager, this.logger);
    new VisualFileHistory(this.dataSource, this.repoManager, this.logger);
    new FileTimeMachine(this.dataSource, this.repoManager, this.logger);

    // Register cross-component commands
    vscode.commands.registerCommand('git-map.ai.setApiKey', (key?: unknown) => setApiKey(key));
    vscode.commands.registerCommand('git-map.ai.clearApiKey', () => clearApiKey());
    vscode.commands.registerCommand('git-map.viewCommitInGitMap', (repo: string, hash: string) => {
      if (typeof repo === 'string' && typeof hash === 'string') {
        this.openViewTo({
          repo,
          commitDetails: { commitHash: hash, compareWithHash: null }
        });
        this.broadcast({ type: 'shell:focusGraphTab' });
      }
    });
    vscode.commands.registerCommand('git-map.viewFileHistory', async (uri: vscode.Uri) => {
      const fsP = uri.fsPath.replace(/\\/g, '/');
      const found = await this.repoManager.getRepoAndPathOfFile(fsP);
      if (found) {
        this.openViewTo({ repo: found.repo, fileHistory: found.path });
        this.broadcast({ type: 'shell:focusGraphTab' });
      }
    });
    vscode.commands.registerCommand('vscode.openFolder', async (uri: vscode.Uri) => {
      const folderPath = uri.fsPath;
      const res = await this.repoManager.registerRepo(folderPath, true);
      if (res.root) {
        this.openViewTo({ repo: res.root });
      } else if (this.repoManager.isKnownRepo(folderPath)) {
        this.openViewTo({ repo: folderPath });
      }
    });

    if (this.options.initialRepos && this.options.initialRepos.length > 0) {
      for (const r of this.options.initialRepos) {
        await this.repoManager.registerRepo(isRemoteRepo(r) ? r : path.resolve(r), true);
      }
    }

    this.repoManager.onDidChangeRepos(() => {
      this.broadcast({
        type: 'repos:changed',
        repos: this.repoManager.getRepos(),
        lastActiveRepo: this.extensionState.getLastActiveRepo()
      });
    });

    this.ensureGraphViewCreated();

    // Start HTTP + WebSocket Server
    this.server = http.createServer((req, res) => {
      if (!this.isAllowedHost(req.headers.host)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden host');
        return;
      }
      this.handleHttpRequest(req, res);
    });

    this.wss = new WebSocketServer({
      server: this.server,
      path: '/ws',
      maxPayload: 64 * 1024 * 1024,
      verifyClient: (info: { origin: string; req: http.IncomingMessage }) => this.isAllowedWsClient(info.origin, info.req)
    });
    this.wss.on('connection', (ws) => this.handleWsConnection(ws));

    await new Promise<void>((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(this.requestedPort, this.host, () => {
        const addr = this.server.address();
        this.actualPort = typeof addr === 'object' && addr ? addr.port : this.requestedPort;
        resolve();
      });
    });

    return this.getUrl();
  }

  public async stop(): Promise<void> {
    sshManager.setOnHostsChanged(null);
    transferManager.dispose();
    this.terminalManager?.closeAll();
    sshManager.disconnectAll();
    for (const resolver of this.pendingPrompts.values()) {
      try {
        resolver(undefined);
      } catch (_) {}
    }
    this.pendingPrompts.clear();
    for (const client of this.clients) {
      try {
        client.close();
      } catch (_) {}
    }
    this.clients.clear();
    this.uiClients.clear();
    if (this.wss && this.server?.listening) {
      await new Promise<void>((resolve) => this.wss.close(() => resolve()));
    }
    if (this.server?.listening) {
      (this.server as any).closeAllConnections?.();
      await new Promise<void>((resolve) => this.server.close(() => resolve()));
    }
    GitGraphView.currentPanel?.dispose();
    this.repoManager?.dispose();
    this.avatarManager?.dispose();
    this.dataSource?.dispose();
    this.extensionState?.dispose();
    this.logger?.dispose();
  }

  private isLoopbackBinding() {
    return this.host === '127.0.0.1' || this.host === 'localhost' || this.host === '::1';
  }

  private isAllowedHost(hostHeader: string | undefined) {
    if (!this.isLoopbackBinding()) return true;
    if (!hostHeader) return false;
    const hostname = hostHeader.replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase();
    return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
  }

  private isRequestAuthenticated(req: http.IncomingMessage, parsedUrl?: URL): boolean {
    if (!this.authEnabled) return true;
    const cookies = parseCookies(req.headers.cookie);
    if (cookies[SESSION_COOKIE_NAME] && safeEqualStrings(cookies[SESSION_COOKIE_NAME], this.sessionSecret)) {
      return true;
    }
    const authHeader = req.headers.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const bearer = authHeader.substring(7).trim();
      if (safeEqualStrings(bearer, this.authToken)) return true;
    }
    const urlObj = parsedUrl || new URL(req.url || '/', 'http://127.0.0.1');
    const queryToken = urlObj.searchParams.get('token');
    if (queryToken && safeEqualStrings(queryToken, this.authToken)) {
      return true;
    }
    return false;
  }

  private isAllowedWsClient(origin: string | undefined, req: http.IncomingMessage) {
    if (!this.isAllowedHost(req.headers.host)) return false;
    if (!this.isRequestAuthenticated(req)) return false;
    if (!origin) return true;
    try {
      const o = new URL(origin);
      return (o.protocol === 'http:' || o.protocol === 'https:') && o.host.toLowerCase() === String(req.headers.host || '').toLowerCase();
    } catch (_) {
      return false;
    }
  }

  private ensureGraphViewCreated() {
    if (!GitGraphView.currentPanel) {
      GitGraphView.createOrShow(
        this.rootDir,
        this.dataSource,
        this.extensionState,
        this.avatarManager,
        this.repoManager,
        this.logger,
        null
      );
    }
  }

  private openViewTo(loadViewTo: any) {
    GitGraphView.createOrShow(
      this.rootDir,
      this.dataSource,
      this.extensionState,
      this.avatarManager,
      this.repoManager,
      this.logger,
      loadViewTo
    );
  }

  private setupHostBridge() {
    hostBridge.setHandlers({
      onGraphHtmlUpdated: () => {
        this.broadcast({ type: 'graph:reloadIframe' });
      },
      onGraphPostMessage: (msg) => {
        this.broadcast({ type: 'graph:message', payload: msg });
      },
      onPanelPostMessage: (panelId, msg) => {
        this.broadcast({ type: 'panel:message', panelId, payload: msg });
      },
      onVisualFileHistoryUpdated: (payload) => {
        this.vfhPages.set(payload.panelId, payload);
        this.broadcast({
          type: 'tab:openVfh',
          payload: { title: payload.title, panelId: payload.panelId, viewType: payload.viewType }
        });
      },
      onOpenDiff: (payload) => {
        this.broadcast({ type: 'tab:openDiff', payload });
      },
      onOpenMultiDiff: (payload) => {
        this.broadcast({ type: 'tab:openMultiDiff', payload });
      },
      onOpenFile: (payload) => {
        this.broadcast({ type: 'tab:openFile', payload });
      },
      onOpenTerminal: (payload) => {
        this.broadcast({ type: 'terminal:requestOpen', payload });
      },
      onOpenSettingsUi: (query) => {
        const section = typeof query === 'string' && /\bai\b/.test(query.replace(/^@ext:\S+/, '')) ? 'ai' : undefined;
        this.broadcast({ type: 'shell:openAppSettings', section });
      },
      onOpenScm: (draftMessage) => {
        this.broadcast({ type: 'shell:openScm', draftMessage: draftMessage || '' });
      },
      onSettingsChanged: (settings) => {
        this.broadcast({ type: 'settings:changed', settings });
      },
      onClipboardWrite: async (text) => {
        if (this.desktopHooks.writeClipboard) {
          const ok = await this.desktopHooks.writeClipboard(text);
          if (ok) return true;
        }
        this.broadcast({ type: 'clipboard:write', text });
        return this.clients.size > 0;
      },
      onOpenExternal: async (url) => {
        if (this.desktopHooks.openExternal) {
          return this.desktopHooks.openExternal(url);
        }
        this.broadcast({ type: 'external:open', url });
        return true;
      },
      onToast: async (payload) => {
        if (!payload.modal && (!payload.actions || payload.actions.length === 0)) {
          this.broadcast({ type: 'ui:toast', payload });
          return undefined;
        }
        return this.promptClient('toastModal', payload);
      },
      onInputBox: async (req) => {
        return this.promptClient('inputBox', req);
      },
      onQuickPick: async (req) => {
        return this.promptClient('quickPick', req);
      },
      onOpenDialog: async (req) => {
        if (this.desktopHooks.showOpenDialog && (!req.defaultPath || !isRemoteRepo(req.defaultPath))) {
          return this.desktopHooks.showOpenDialog(req);
        }
        return this.promptClient('openDialog', req);
      },
      onSaveDialog: async (req) => {
        if (this.desktopHooks.showSaveDialog && (!req.defaultPath || !isRemoteRepo(req.defaultPath))) {
          return this.desktopHooks.showSaveDialog(req);
        }
        return this.promptClient('saveDialog', req);
      }
    });
  }

  private promptClient(kind: string, request: any): Promise<any> {
    if (this.clients.size === 0) return Promise.resolve(undefined);
    const promptId = 'prompt-' + crypto.randomBytes(8).toString('hex');
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (this.pendingPrompts.has(promptId)) {
          this.pendingPrompts.delete(promptId);
          resolve(undefined);
        }
      }, 300000);
      timer.unref?.();
      this.pendingPrompts.set(promptId, (val) => {
        clearTimeout(timer);
        resolve(val);
      });
      this.broadcast({ type: 'ui:prompt', promptId, kind, request });
    });
  }

  private broadcast(msg: object) {
    const raw = JSON.stringify(msg);
    for (const ws of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(raw);
      }
    }
  }

  /* HTTP Request Handling */

  private handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    let parsedUrl: URL;
    let pathname: string;
    try {
      parsedUrl = new URL(req.url || '/', 'http://127.0.0.1');
      pathname = decodeURIComponent(parsedUrl.pathname);
    } catch (_) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Bad Request');
      return;
    }

    if (pathname.includes('\0')) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Bad Request');
      return;
    }

    if (pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, version: this.pkgVersion }));
      return;
    }

    // Exchange initial URL ?token=... into an HttpOnly session cookie and strip the token from the URL
    if (this.authEnabled) {
      const queryToken = parsedUrl.searchParams.get('token');
      if (queryToken && safeEqualStrings(queryToken, this.authToken)) {
        parsedUrl.searchParams.delete('token');
        const cleanTarget = parsedUrl.pathname + (parsedUrl.search || '');
        res.writeHead(302, {
          'Set-Cookie': `${SESSION_COOKIE_NAME}=${this.sessionSecret}; HttpOnly; SameSite=Strict; Path=/`,
          Location: cleanTarget || '/'
        });
        res.end();
        return;
      }
      if (!this.isRequestAuthenticated(req, parsedUrl)) {
        res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Unauthorized: valid launch token or session cookie required.');
        return;
      }
    }

    // Browser-mode streaming SFTP & Local upload / download endpoints (for --web clients without host filesystem access)
    if (pathname === '/api/diagnostics' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(this.buildDiagnosticsSnapshot()));
      return;
    }
    if (pathname === '/api/file-raw' && req.method === 'GET') {
      void this.handleRawFilePreview(parsedUrl, res);
      return;
    }
    if (pathname === '/api/transfer/web-download' && req.method === 'GET') {
      void this.handleWebDownload(parsedUrl, res);
      return;
    }
    if (pathname === '/api/transfer/web-upload' && req.method === 'POST') {
      void this.handleWebUpload(parsedUrl, req, res);
      return;
    }
    if (pathname === '/api/local/web-download' && req.method === 'GET') {
      void this.handleLocalWebDownload(parsedUrl, res);
      return;
    }
    if (pathname === '/api/local/web-upload' && req.method === 'POST') {
      void this.handleLocalWebUpload(parsedUrl, req, res);
      return;
    }

    if (pathname === '/webview/git-map') {
      this.ensureGraphViewCreated();
      const html = hostBridge.getGraphHtml();
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      res.end(html);
      return;
    }

    if (pathname.startsWith('/webview/vfh/')) {
      const panelId = pathname.substring('/webview/vfh/'.length);
      const page = this.vfhPages.get(panelId);
      if (!page) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Auxiliary panel not found.');
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      res.end(page.html);
      return;
    }

    if (pathname.startsWith('/media/')) {
      return this.serveSafeStatic(path.join(this.rootDir, 'media'), pathname.substring('/media/'.length), res);
    }
    if (pathname.startsWith('/resources/')) {
      return this.serveSafeStatic(path.join(this.rootDir, 'resources'), pathname.substring('/resources/'.length), res);
    }

    const publicFile = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    return this.serveSafeStatic(
      path.join(this.rootDir, 'public'),
      publicFile,
      res,
      publicFile === 'index.html' ? { 'Content-Security-Policy': SHELL_CSP } : undefined
    );
  }

  private async handleWebDownload(parsedUrl: URL, res: http.ServerResponse) {
    try {
      const hostId = parsedUrl.searchParams.get('hostId') || '';
      const remotePath = parsedUrl.searchParams.get('path') || '';
      if (!hostId || !remotePath.startsWith('/')) {
        res.writeHead(400);
        res.end('Missing hostId or path.');
        return;
      }
      const sftp = await sshManager.getSftp(hostId);
      const stat = await new Promise<{ size: number; isDirectory: boolean }>((resolve, reject) => {
        sftp.stat(remotePath, (err, st) => (err || !st ? reject(err || new Error('Not found')) : resolve({ size: st.size, isDirectory: st.isDirectory() })));
      });
      if (stat.isDirectory) {
        const session = await sshManager.ensureConnected(hostId);
        const parentDir = path.posix.dirname(remotePath);
        const folderBase = path.posix.basename(remotePath) || 'folder';
        const cmd = `tar -czf - -C ${quotePosixArg(parentDir)} -- ${quotePosixArg(folderBase)}`;
        res.writeHead(200, {
          'Content-Type': 'application/gzip',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(folderBase + '.tar.gz')}`
        });
        await new Promise<void>((resolve, reject) => {
          session.client.exec(cmd, (err, stream) => {
            if (err || !stream) return reject(err || new Error('Failed to start remote archive stream.'));
            stream.on('error', reject);
            res.on('close', () => {
              try { stream.close(); } catch (_) {}
            });
            stream.pipe(res);
            stream.on('close', () => resolve());
          });
        });
        return;
      }
      const fileName = path.posix.basename(remotePath) || 'download';
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(stat.size),
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
      });
      await pipeline(sftp.createReadStream(remotePath), res);
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(err instanceof Error ? err.message : String(err));
      } else {
        res.destroy();
      }
    }
  }

  private async handleWebUpload(parsedUrl: URL, req: http.IncomingMessage, res: http.ServerResponse) {
    try {
      const hostId = parsedUrl.searchParams.get('hostId') || '';
      const destDirRaw = parsedUrl.searchParams.get('destDir') || '~';
      const rawName = (parsedUrl.searchParams.get('name') || '').trim();
      if (!hostId || !rawName || rawName.includes('/') || rawName === '.' || rawName === '..') {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: 'Invalid upload target.' }));
        return;
      }
      const destDir = await sshManager.resolveRemotePath(hostId, destDirRaw);
      const sftp = await sshManager.getSftp(hostId);
      const exists = (p: string) =>
        new Promise<boolean>((resolve) => sftp.stat(p, (err) => resolve(!err)));
      let finalName = rawName;
      if (await exists(path.posix.join(destDir, finalName))) {
        const dot = rawName.lastIndexOf('.');
        const base = dot > 0 ? rawName.substring(0, dot) : rawName;
        const ext = dot > 0 ? rawName.substring(dot) : '';
        for (let i = 1; i < 500; i++) {
          const cand = `${base} (${i})${ext}`;
          if (!(await exists(path.posix.join(destDir, cand)))) {
            finalName = cand;
            break;
          }
        }
      }
      const destPath = path.posix.join(destDir, finalName);
      await pipeline(req, sftp.createWriteStream(destPath));
      RepoFileWatcher.notifyPossibleRemoteChange(400);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, path: destPath, name: finalName }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
    }
  }

  private resolveExistingRealPath(p: string): string {
    let cur = path.resolve(p);
    const tail: string[] = [];
    while (!fs.existsSync(cur)) {
      const parent = path.dirname(cur);
      if (parent === cur) break;
      tail.unshift(path.basename(cur));
      cur = parent;
    }
    try {
      const realBase = fs.realpathSync(cur);
      return tail.length > 0 ? path.join(realBase, ...tail) : realBase;
    } catch (_) {
      return path.resolve(p);
    }
  }

  private assertAllowedLocalPath(rawPath: string): string {
    const expanded = rawPath.startsWith('~/') ? path.join(os.homedir(), rawPath.slice(2)) : rawPath === '~' ? os.homedir() : rawPath;
    const resolved = path.resolve(expanded);
    const resolvedData = path.resolve(this.dataDir);
    if (resolved === resolvedData || resolved.startsWith(resolvedData + path.sep)) {
      throw new Error('Access to internal application state files is denied.');
    }
    const realTarget = this.resolveExistingRealPath(resolved);
    const realData = this.resolveExistingRealPath(resolvedData);
    if (realTarget === realData || realTarget.startsWith(realData + path.sep)) {
      throw new Error('Access to internal application state files is denied.');
    }
    return resolved;
  }

  private classifyRpcError(err: unknown): { errorCode: string; retriable: boolean } {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Unknown RPC method/i.test(msg)) return { errorCode: 'UNKNOWN_METHOD', retriable: false };
    if (/Access to internal application state files is denied|symlink escape blocked|Refusing to delete protected/i.test(msg)) {
      return { errorCode: 'ACCESS_DENIED', retriable: false };
    }
    if (/REMOTE HOST IDENTIFICATION HAS CHANGED|Host key verification|authentication methods failed|Incorrect passphrase/i.test(msg)) {
      return { errorCode: 'SSH_AUTH_FAILED', retriable: false };
    }
    if (/SSH connection|ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH/i.test(msg)) {
      return { errorCode: 'SSH_DISCONNECTED', retriable: true };
    }
    if (/ENOENT|doesn't exist|not found/i.test(msg)) {
      return { errorCode: 'NOT_FOUND', retriable: false };
    }
    if (/CONFLICT|merge conflict|unresolved/i.test(msg)) {
      return { errorCode: 'GIT_CONFLICT', retriable: false };
    }
    if (/is required|Invalid |can't be empty|must be between/i.test(msg)) {
      return { errorCode: 'VALIDATION_ERROR', retriable: false };
    }
    return { errorCode: 'INTERNAL_ERROR', retriable: false };
  }

  private buildDiagnosticsSnapshot() {
    const repos = this.repoManager?.getRepos() || {};
    return {
      ok: true,
      version: this.pkgVersion,
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      uptimeSeconds: Math.round(process.uptime()),
      memoryMB: Math.round((process.memoryUsage().rss / (1024 * 1024)) * 10) / 10,
      activeRepo: this.extensionState?.getLastActiveRepo() || null,
      repoCount: Object.keys(repos).length,
      wsClientCount: this.clients.size,
      uiClientCount: this.uiClients.size,
      pendingPromptCount: this.pendingPrompts.size,
      sshHosts: sshManager.listHosts().map((h) => ({
        id: h.id,
        connected: !!h.connected,
        connectionState: h.connectionState || 'disconnected',
        gitVersion: h.gitVersion || null
      })),
      tunnels: sshManager.listTunnels(),
      transfers: transferManager.list(),
      terminals: this.terminalManager?.listSessions() || [],
      fsm: {
        instances: fsmRegistry.listInstances(),
        recentTransitions: fsmRegistry.getTrace(80)
      }
    };
  }

  private async copyLocalEntryDedup(srcRaw: string, destDirResolved: string): Promise<string> {
    const srcResolved = this.assertAllowedLocalPath(srcRaw);
    const baseName = path.basename(srcResolved);
    let finalName = baseName;
    const dot = baseName.lastIndexOf('.');
    const stem = dot > 0 ? baseName.slice(0, dot) : baseName;
    const ext = dot > 0 ? baseName.slice(dot) : '';
    for (let i = 1; i < 500 && fs.existsSync(path.join(destDirResolved, finalName)); i++) {
      finalName = `${stem} (${i})${ext}`;
    }
    const destTarget = path.join(destDirResolved, finalName);
    await fs.promises.cp(srcResolved, destTarget, { recursive: true });
    return getPathFromStr(destTarget);
  }

  private async handleLocalWebDownload(parsedUrl: URL, res: http.ServerResponse) {
    try {
      const targetRaw = parsedUrl.searchParams.get('path') || '';
      if (!targetRaw) {
        res.writeHead(400);
        res.end('Missing path.');
        return;
      }
      const resolved = this.assertAllowedLocalPath(targetRaw);
      const stat = await fs.promises.stat(resolved);
      if (stat.isDirectory()) {
        const parentDir = path.dirname(resolved);
        const folderBase = path.basename(resolved) || 'folder';
        res.writeHead(200, {
          'Content-Type': 'application/gzip',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(folderBase + '.tar.gz')}`
        });
        const tarProc = cp.spawn('tar', ['-czf', '-', '-C', parentDir, folderBase]);
        tarProc.on('error', () => res.destroy());
        res.on('close', () => {
          try { tarProc.kill(); } catch (_) {}
        });
        await pipeline(tarProc.stdout, res);
        return;
      }
      const fileName = path.basename(resolved) || 'download';
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(stat.size),
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
      });
      await pipeline(fs.createReadStream(resolved), res);
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(err instanceof Error ? err.message : String(err));
      } else {
        res.destroy();
      }
    }
  }

  private async handleLocalWebUpload(parsedUrl: URL, req: http.IncomingMessage, res: http.ServerResponse) {
    try {
      const destDirRaw = parsedUrl.searchParams.get('destDir') || '~';
      const rawName = (parsedUrl.searchParams.get('name') || '').trim();
      if (!rawName || rawName.includes('/') || rawName.includes('\\') || rawName === '.' || rawName === '..') {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: 'Invalid upload file name.' }));
        return;
      }
      const destDir = this.assertAllowedLocalPath(destDirRaw);
      await fs.promises.mkdir(destDir, { recursive: true });
      let finalName = rawName;
      const dot = rawName.lastIndexOf('.');
      const stem = dot > 0 ? rawName.slice(0, dot) : rawName;
      const ext = dot > 0 ? rawName.slice(dot) : '';
      for (let i = 1; i < 500 && fs.existsSync(path.join(destDir, finalName)); i++) {
        finalName = `${stem} (${i})${ext}`;
      }
      const destPath = path.join(destDir, finalName);
      await pipeline(req, fs.createWriteStream(destPath));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, path: getPathFromStr(destPath), name: finalName }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
    }
  }

  private serveSafeStatic(
    baseDir: string,
    relFile: string,
    res: http.ServerResponse,
    extraHeaders?: { [name: string]: string }
  ) {
    const resolvedBase = path.resolve(baseDir);
    const resolvedTarget = path.resolve(resolvedBase, relFile);
    if (resolvedTarget !== resolvedBase && !resolvedTarget.startsWith(resolvedBase + path.sep)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    fs.stat(resolvedTarget, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }
      const ext = path.extname(resolvedTarget).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
        ...(extraHeaders || {})
      });
      fs.createReadStream(resolvedTarget).pipe(res);
    });
  }

  /* WebSocket RPC Handling */

  private handleWsConnection(ws: WebSocket) {
    this.clients.add(ws);

    ws.send(
      JSON.stringify({
        type: 'init',
        repos: this.repoManager.getRepos(),
        lastActiveRepo: this.extensionState.getLastActiveRepo(),
        sshHosts: sshManager.listHosts(),
        settings: getAllStandaloneSettings(),
        platform: process.platform,
        homeDir: os.homedir(),
        canTrash: typeof this.desktopHooks.trashItem === 'function'
      })
    );

    ws.on('message', async (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch (_) {
        return;
      }
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'ui:ready') {
        this.uiClients.add(ws);
        return;
      }

      if (msg.type === 'panel:close' && typeof msg.panelId === 'string') {
        this.vfhPages.delete(msg.panelId);
        disposeStandalonePanel(msg.panelId);
        return;
      }

      if (msg.type === 'ui:promptResponse' && typeof msg.promptId === 'string') {
        const resolver = this.pendingPrompts.get(msg.promptId);
        if (resolver) {
          this.pendingPrompts.delete(msg.promptId);
          resolver(msg.value);
        }
        return;
      }

      if (msg.type === 'graph:request' && msg.payload) {
        dispatchMessageToGitMapPanel(msg.payload);
        return;
      }

      if (msg.type === 'vfh:request' && typeof msg.panelId === 'string' && msg.payload) {
        dispatchMessageToPanel(msg.panelId, msg.payload);
        return;
      }

      if (msg.type === 'term:input' && typeof msg.id === 'string') {
        const data = String(msg.data || '');
        this.terminalManager.write(msg.id, data);
        if (data.includes('\r') || data.includes('\n')) {
          RepoFileWatcher.notifyPossibleRemoteChange(800);
        }
        return;
      }
      if (msg.type === 'term:resize' && typeof msg.id === 'string') {
        this.terminalManager.resize(msg.id, Number(msg.cols) || 80, Number(msg.rows) || 24);
        return;
      }
      if (msg.type === 'term:close' && typeof msg.id === 'string') {
        this.terminalManager.close(msg.id);
        return;
      }

      if (msg.type === 'rpc' && typeof msg.reqId === 'string' && typeof msg.method === 'string') {
        const startedAt = Date.now();
        try {
          const result = await this.handleRpcMethod(ws, msg.method, msg.params || {});
          const durationMs = Date.now() - startedAt;
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'rpc:res', reqId: msg.reqId, ok: true, result, durationMs }));
          }
        } catch (err) {
          const durationMs = Date.now() - startedAt;
          const errorMsg = err instanceof Error ? err.message : String(err);
          const { errorCode, retriable } = this.classifyRpcError(err);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'rpc:res', reqId: msg.reqId, ok: false, error: errorMsg, errorCode, retriable, durationMs }));
          }
        }
      }
    });

    ws.on('close', () => {
      this.clients.delete(ws);
      this.uiClients.delete(ws);
      this.terminalManager.detachOwner(ws, 6000);
    });
  }

  private async handleRpcMethod(ws: WebSocket, method: string, params: any): Promise<any> {
    switch (method) {
      /* Repository Management */
      case 'repos:list':
        return {
          repos: this.repoManager.getRepos(),
          lastActiveRepo: this.extensionState.getLastActiveRepo(),
          sshHosts: sshManager.listHosts()
        };

      case 'repos:add': {
        const rawPath = String(params.path || '').trim();
        if (!rawPath) throw new Error('Repository path is required.');
        const normalized = isRemoteRepo(rawPath)
          ? rawPath
          : getPathFromStr(path.resolve(rawPath.startsWith('~/') ? path.join(os.homedir(), rawPath.slice(2)) : rawPath));
        const res = await this.repoManager.registerRepo(normalized, true);
        if (res.error && !this.repoManager.isKnownRepo(normalized)) {
          throw new Error(res.error);
        }
        const root = res.root || normalized;
        this.extensionState.setLastActiveRepo(root);
        this.openViewTo({ repo: root });
        return { root, repos: this.repoManager.getRepos() };
      }

      case 'repos:addBatch': {
        const paths: string[] = Array.isArray(params.paths) ? params.paths : [];
        const addedRoots: string[] = [];
        for (const p of paths) {
          const clean = isRemoteRepo(p) ? p : getPathFromStr(path.resolve(p));
          const res = await this.repoManager.registerRepo(clean, false);
          if (res.root) addedRoots.push(res.root);
        }
        if (addedRoots.length > 0) {
          this.extensionState.setLastActiveRepo(addedRoots[0]);
          this.openViewTo({ repo: addedRoots[0] });
        }
        return { added: addedRoots, repos: this.repoManager.getRepos() };
      }

      case 'repos:scanLocal': {
        const folder = String(params.path || '').trim();
        if (!folder) throw new Error('Folder path is required.');
        const resolved = this.assertAllowedLocalPath(folder);
        const rawDepth = typeof params.maxDepth === 'number' ? params.maxDepth : 3;
        const depth = Math.max(1, Math.min(6, Math.floor(rawDepth) || 3));
        if (params.previewOnly) {
          return { repos: await this.discoverLocalRepos(resolved, depth) };
        }
        const added = await this.repoManager.scanFolderForRepos(resolved, depth);
        return { added, repos: this.repoManager.getRepos() };
      }

      case 'repos:remove': {
        const repo = String(params.repo || '');
        const ok = this.repoManager.removeKnownRepo(repo);
        return { removed: ok, repos: this.repoManager.getRepos() };
      }

      case 'repos:select': {
        const repo = String(params.repo || '');
        if (this.repoManager.isKnownRepo(repo)) {
          this.extensionState.setLastActiveRepo(repo);
          this.openViewTo({ repo });
        }
        return { ok: true };
      }

      case 'repos:pokeRemoteWatch': {
        RepoFileWatcher.notifyPossibleRemoteChange(200);
        return { ok: true };
      }

      case 'git:clone': {
        const url = String(params.url || '').trim();
        const targetDirRaw = String(params.targetDir || '').trim();
        const hostId = params.hostId ? String(params.hostId).trim() : '';
        if (!url || url.startsWith('-')) throw new Error('A valid repository clone URL is required.');
        if (!targetDirRaw || targetDirRaw.startsWith('-')) throw new Error('Destination folder is required.');

        const repoFolderName =
          String(params.folderName || '').trim() ||
          url.replace(/\/+$/, '').split(/[/:]/).pop()?.replace(/\.git$/i, '') ||
          'cloned-repo';
        if (repoFolderName.includes('/') || repoFolderName.includes('\\') || repoFolderName === '..') {
          throw new Error('Invalid repository folder name.');
        }

        if (hostId) {
          const parentRemote = await sshManager.resolveRemotePath(hostId, targetDirRaw);
          const fullRemote = path.posix.join(parentRemote, repoFolderName);
          const res = await sshManager.execRemoteGit(hostId, parentRemote, ['clone', '--', url, fullRemote]);
          if (res.code !== 0) throw new Error(res.stderr.trim() || 'Remote git clone failed.');
          const sshUri = formatRemoteRepoUri(hostId, fullRemote);
          await this.repoManager.registerRepo(sshUri, true);
          this.extensionState.setLastActiveRepo(sshUri);
          this.openViewTo({ repo: sshUri });
          return { root: sshUri, repos: this.repoManager.getRepos() };
        }

        const localParent = targetDirRaw.startsWith('~/')
          ? path.join(os.homedir(), targetDirRaw.slice(2))
          : path.resolve(targetDirRaw);
        await fs.promises.mkdir(localParent, { recursive: true });
        const fullLocal = path.join(localParent, repoFolderName);
        await new Promise<void>((resolve, reject) => {
          // No terminal to type a password into: fail fast with git's message instead of hanging on a hidden prompt
          cp.execFile('git', ['clone', '--', url, fullLocal], { cwd: localParent, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }, (err, _stdout, stderr) => {
            if (err) reject(new Error(String(stderr || err.message).trim()));
            else resolve();
          });
        });
        const normRoot = getPathFromStr(fullLocal);
        await this.repoManager.registerRepo(normRoot, true);
        this.extensionState.setLastActiveRepo(normRoot);
        this.openViewTo({ repo: normRoot });
        return { root: normRoot, repos: this.repoManager.getRepos() };
      }

      /* Working Tree Stage & Commit */
      case 'scm:status': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        if (!repo) throw new Error('No active repository selected.');
        return { repo, ...(await this.dataSource.getWorkingTreeStatus(repo)) };
      }

      case 'scm:stage': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        const paths: string[] = Array.isArray(params.paths) ? params.paths.map(String) : [];
        const err = params.all ? await this.dataSource.stageAll(repo) : await this.dataSource.stageFiles(repo, paths);
        if (err) throw new Error(err);
        RepoFileWatcher.notifyPossibleRemoteChange(200);
        return { repo, ...(await this.dataSource.getWorkingTreeStatus(repo)) };
      }

      case 'scm:unstage': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        const paths: string[] = Array.isArray(params.paths) ? params.paths.map(String) : [];
        const err = params.all ? await this.dataSource.unstageAll(repo) : await this.dataSource.unstageFiles(repo, paths);
        if (err) throw new Error(err);
        RepoFileWatcher.notifyPossibleRemoteChange(200);
        return { repo, ...(await this.dataSource.getWorkingTreeStatus(repo)) };
      }

      case 'scm:commit': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        const message = String(params.message || '');
        const amend = !!params.amend;
        const err = await this.dataSource.commitWorkingTree(repo, message, amend);
        if (err) throw new Error(err);
        RepoFileWatcher.notifyPossibleRemoteChange(200);
        this.openViewTo({ repo });
        return { ok: true, repo, ...(await this.dataSource.getWorkingTreeStatus(repo)) };
      }

      case 'scm:discard': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        if (!repo) throw new Error('No active repository selected.');
        const files: Array<{ path: string; status?: string }> = Array.isArray(params.files)
          ? params.files.map((f: any) => (typeof f === 'string' ? { path: f } : { path: String(f.path || ''), status: f.status ? String(f.status) : undefined }))
          : [];
        await this.workflowService.discardFiles(repo, files);
        return { repo, ...(await this.dataSource.getWorkingTreeStatus(repo)) };
      }

      case 'scm:hunks': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        const filePath = String(params.filePath || '');
        const staged = !!params.staged;
        return this.workflowService.getFileDiffHunks(repo, filePath, staged);
      }

      case 'scm:applyHunk': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        const mode: 'stage' | 'unstage' | 'discard' =
          params.mode === 'unstage' ? 'unstage' : params.mode === 'discard' ? 'discard' : 'stage';
        let patch = typeof params.patch === 'string' ? params.patch : '';
        if (!patch && params.hunk && Array.isArray(params.fileHeader) && Array.isArray(params.selectedIndices)) {
          patch = buildPartialHunkPatch(params.fileHeader, params.hunk, params.selectedIndices.map(Number), mode);
        }
        await this.workflowService.applyPatch(repo, patch, mode);
        return { repo, ...(await this.dataSource.getWorkingTreeStatus(repo)) };
      }

      /* 3-Way Merge Conflict Resolver & Ongoing Operations */
      case 'git:operationState': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        if (!repo) return { mergeInProgress: false, rebaseInProgress: false, cherryPickInProgress: false, bisectInProgress: false, conflictCount: 0 };
        return this.workflowService.getOperationState(repo);
      }

      case 'conflict:read': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        const filePath = String(params.filePath || '');
        return this.workflowService.readConflictFile(repo, filePath);
      }

      case 'conflict:resolve': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        const filePath = String(params.filePath || '');
        const content = String(params.content ?? '');
        await this.workflowService.resolveConflictFile(repo, filePath, content);
        return { repo, ...(await this.dataSource.getWorkingTreeStatus(repo)) };
      }

      case 'conflict:aiMerge': {
        const merged = await this.workflowService.aiMergeConflictBlock({
          filePath: String(params.filePath || ''),
          ours: String(params.ours ?? ''),
          base: params.base != null ? String(params.base) : null,
          theirs: String(params.theirs ?? ''),
          contextBefore: params.contextBefore ? String(params.contextBefore) : undefined,
          contextAfter: params.contextAfter ? String(params.contextAfter) : undefined
        });
        return { merged };
      }

      case 'conflict:continueOrAbort': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        const operation: 'merge' | 'rebase' | 'cherry-pick' | 'revert' =
          params.operation === 'rebase'
            ? 'rebase'
            : params.operation === 'cherry-pick'
              ? 'cherry-pick'
              : params.operation === 'revert'
                ? 'revert'
                : 'merge';
        const action: 'continue' | 'abort' = params.action === 'abort' ? 'abort' : 'continue';
        await this.workflowService.continueOrAbortOperation(repo, operation, action);
        this.openViewTo({ repo });
        return { ok: true, state: await this.workflowService.getOperationState(repo) };
      }

      /* Visual Interactive Rebase */
      case 'rebase:prepare': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        return this.workflowService.prepareInteractiveRebase(repo, params.base);
      }

      case 'rebase:execute': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        const baseHash = String(params.baseHash || '');
        const steps = Array.isArray(params.steps) ? params.steps : [];
        const res = await this.workflowService.executeInteractiveRebase(repo, baseHash, steps);
        this.openViewTo({ repo });
        return { ok: true, ...res };
      }

      /* Git Worktree Management */
      case 'worktree:list': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        return { worktrees: await this.workflowService.listWorktrees(repo) };
      }

      case 'worktree:add': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        const wtUri = await this.workflowService.addWorktree({
          repo,
          targetPath: String(params.targetPath || ''),
          branch: String(params.branch || ''),
          createBranch: !!params.createBranch,
          baseRef: params.baseRef ? String(params.baseRef) : undefined
        });
        await this.repoManager.registerRepo(wtUri, true);
        return { root: wtUri, repos: this.repoManager.getRepos(), worktrees: await this.workflowService.listWorktrees(repo) };
      }

      case 'worktree:remove': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        const removedUri = await this.workflowService.removeWorktree(repo, String(params.path || ''), !!params.force);
        this.repoManager.removeKnownRepo(removedUri);
        return { removed: removedUri, repos: this.repoManager.getRepos(), worktrees: await this.workflowService.listWorktrees(repo) };
      }

      /* Multi-Repo Status Badges & Batch Fetch */
      case 'repos:quickStatuses': {
        const keys = Array.isArray(params.repos) ? params.repos.map(String) : Object.keys(this.repoManager.getRepos());
        return { statuses: await this.workflowService.getQuickStatuses(keys) };
      }

      case 'repos:fetchAll': {
        const keys = Object.keys(this.repoManager.getRepos());
        return this.workflowService.fetchAllRepos(keys);
      }

      /* Git Branches, Tags & Checkout (for Command Palette & Release Notes) */
      case 'git:refs': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        if (!repo) return { branches: [], tags: [], head: null };
        const info = await this.dataSource.getRepoInfo(repo, true, false, []);
        const tagsOut = await this.dataSource
          .execGitRaw(repo, ['tag', '--sort=-creatordate'], { ignoreExitCode: true })
          .then((r) => r.stdout.toString('utf8').trim().split(/\r?\n/).filter(Boolean), () => []);
        return { branches: info.branches || [], head: info.head || null, tags: tagsOut };
      }

      case 'git:checkout': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        const ref = String(params.ref || '').trim();
        if (!ref || ref.startsWith('-')) throw new Error('Invalid branch or commit reference.');
        await this.dataSource.execGitRaw(repo, ['checkout', ref]);
        RepoFileWatcher.notifyPossibleRemoteChange(200);
        this.openViewTo({ repo });
        return { ok: true };
      }

      /* Git Reflog & Visual Bisect */
      case 'reflog:list': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        return { entries: await this.workflowService.listReflog(repo, Number(params.limit) || 120) };
      }

      case 'bisect:status': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        return this.workflowService.getBisectStatus(repo);
      }

      case 'bisect:start': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        const res = await this.workflowService.startBisect(repo, String(params.badRef || 'HEAD'), String(params.goodRef || ''));
        this.openViewTo({ repo });
        return res;
      }

      case 'bisect:step': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        const verdict: 'good' | 'bad' | 'skip' =
          params.verdict === 'bad' ? 'bad' : params.verdict === 'skip' ? 'skip' : 'good';
        const res = await this.workflowService.stepBisect(repo, verdict);
        this.openViewTo({ repo });
        return res;
      }

      case 'bisect:reset': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        await this.workflowService.resetBisect(repo);
        this.openViewTo({ repo });
        return { ok: true, status: await this.workflowService.getBisectStatus(repo) };
      }

      /* GitHub / GitLab / Gitea PR & MR Integration */
      case 'hosting:listPrs': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        const override = params.provider ? (String(params.provider) as HostingProviderKind) : undefined;
        return this.hostingService.listPullRequests(repo, override);
      }

      case 'hosting:setToken': {
        await this.hostingService.setHostToken(String(params.host || ''), String(params.token || ''));
        return { ok: true, hasToken: await this.hostingService.hasHostToken(String(params.host || '')) };
      }

      case 'hosting:checkoutPr': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        const override = params.provider ? (String(params.provider) as HostingProviderKind) : undefined;
        const res = await this.hostingService.checkoutPullRequest(repo, Number(params.number), override);
        this.openViewTo({ repo });
        return res;
      }

      case 'hosting:generatePrDraft': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        return this.hostingService.generatePrDraft({
          repo,
          baseBranch: String(params.baseBranch || 'main'),
          headBranch: String(params.headBranch || 'HEAD'),
          lang: params.lang ? String(params.lang) : undefined
        });
      }

      case 'hosting:createPr': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        const override = params.provider ? (String(params.provider) as HostingProviderKind) : undefined;
        return this.hostingService.createPullRequest({
          repo,
          baseBranch: String(params.baseBranch || 'main'),
          headBranch: String(params.headBranch || 'HEAD'),
          title: String(params.title || ''),
          body: String(params.body || ''),
          draft: !!params.draft,
          providerOverride: override
        });
      }

      /* History Rewrite Maintenance Commands */
      case 'history:restoreBackup': {
        await vscode.commands.executeCommand('git-map.restoreHistoryBackup');
        return { ok: true };
      }

      case 'history:cleanUp': {
        await vscode.commands.executeCommand('git-map.cleanUpRemovedFiles');
        return { ok: true };
      }

      /* Local Directory Browser */
      case 'local:browsePath': {
        return this.browseLocalDirectory(params.path, !!params.showHidden);
      }

      /* Remote - SSH Host & Path Browser */
      case 'ssh:listHosts':
        return { hosts: sshManager.listHosts() };

      case 'ssh:saveHost': {
        const profile = await sshManager.saveHost(params);
        return { profile, hosts: sshManager.listHosts() };
      }

      case 'ssh:updateHostMeta': {
        const id = String(params.id || '');
        if (!sshManager.listHosts().some((h) => h.id === id)) throw new Error(`Unknown SSH host "${id}".`);
        await sshManager.updateHostMeta(id, params.alias, params.tags);
        const hosts = sshManager.listHosts();
        this.broadcast({ type: 'ssh:hostsChanged', hosts });
        return { hosts, tags: sshManager.listTags() };
      }

      case 'ssh:listTags':
        return { tags: sshManager.listTags() };

      case 'ssh:removeHost': {
        const removed = await sshManager.removeHost(String(params.id || ''));
        return { removed, hosts: sshManager.listHosts() };
      }

      case 'ssh:connect': {
        const hostId = String(params.hostId || '');
        const session = await sshManager.ensureConnected(hostId);
        return {
          connected: true,
          hostId,
          homeDir: session.homeDir,
          gitVersion: session.gitVersion,
          hosts: sshManager.listHosts()
        };
      }

      case 'ssh:disconnect': {
        const hostId = String(params.hostId || '');
        sshManager.disconnect(hostId);
        return { disconnected: true, hosts: sshManager.listHosts() };
      }

      case 'ssh:listTunnels': {
        return { tunnels: sshManager.listTunnels(params.hostId ? String(params.hostId) : undefined) };
      }

      case 'ssh:startTunnel': {
        const tunnel = await sshManager.startTunnel({
          hostId: String(params.hostId || ''),
          localPort: Number(params.localPort),
          remoteHost: params.remoteHost ? String(params.remoteHost) : '127.0.0.1',
          remotePort: Number(params.remotePort),
          localHost: params.localHost ? String(params.localHost) : '127.0.0.1',
          label: params.label ? String(params.label) : undefined
        });
        return { tunnel, tunnels: sshManager.listTunnels() };
      }

      case 'ssh:stopTunnel': {
        const stopped = await sshManager.stopTunnel(String(params.id || ''));
        return { stopped, tunnels: sshManager.listTunnels() };
      }

      case 'ssh:browsePath': {
        const hostId = String(params.hostId || '');
        const listing = await sshManager.listRemoteDirectory(hostId, params.path, !!params.showHidden);
        return {
          ...listing,
          hosts: sshManager.listHosts()
        };
      }

      case 'ssh:scanRepos': {
        const hostId = String(params.hostId || '');
        const rootPath = String(params.path || '~');
        const maxDepth = typeof params.maxDepth === 'number' ? params.maxDepth : 3;
        const discovered = await sshManager.scanRemoteGitRepos(hostId, rootPath, maxDepth);
        return { repos: discovered };
      }

      case 'ssh:complete': {
        const hostId = String(params.hostId || '');
        return sshManager.completeRemotePath(hostId, String(params.path || ''), !!params.showHidden);
      }

      case 'local:complete':
        return this.completeLocalPath(String(params.path || ''), !!params.showHidden);

      case 'ssh:mkdir': {
        const hostId = String(params.hostId || '');
        const dir = await sshManager.resolveRemotePath(hostId, String(params.path || ''));
        const name = String(params.name || '').trim().replace(/^\/+|\/+$/g, '');
        if (!name || name.split('/').some((seg) => !seg || seg === '.' || seg === '..')) {
          throw new Error('Invalid folder name.');
        }
        const target = path.posix.join(dir, name);
        const res = await sshManager.execRemote(hostId, `mkdir -p ${quotePosixArg(target)}`);
        if (res.code !== 0) throw new Error(res.stderr.trim() || 'Unable to create the folder.');
        RepoFileWatcher.notifyPossibleRemoteChange(250);
        return { path: target };
      }

      case 'ssh:createFile': {
        const hostId = String(params.hostId || '');
        const dir = await sshManager.resolveRemotePath(hostId, String(params.path || ''));
        const name = String(params.name || '').trim().replace(/^\/+/, '');
        if (!name || name.endsWith('/') || name.split('/').some((seg) => !seg || seg === '.' || seg === '..')) {
          throw new Error('Invalid file name.');
        }
        const target = path.posix.join(dir, name);
        const parentDir = path.posix.dirname(target);
        const checkCmd = `if [ -e ${quotePosixArg(target)} ]; then echo 'File or folder already exists.' >&2; exit 1; fi; mkdir -p ${quotePosixArg(parentDir)}`;
        const checkRes = await sshManager.execRemote(hostId, checkCmd);
        if (checkRes.code !== 0) throw new Error(checkRes.stderr.trim() || 'Unable to create file.');
        await sshManager.writeRemoteFile(hostId, target, typeof params.content === 'string' ? params.content : '');
        RepoFileWatcher.notifyPossibleRemoteChange(250);
        return { path: target };
      }

      case 'local:mkdir': {
        const baseDir = this.assertAllowedLocalPath(String(params.path || os.homedir()));
        const name = String(params.name || '').trim().replace(/^[\\/]+|[\\/]+$/g, '');
        if (!name || name.split(/[\\/]+/).some((seg) => !seg || seg === '.' || seg === '..')) {
          throw new Error('Invalid folder name.');
        }
        const target = this.assertAllowedLocalPath(path.join(baseDir, name));
        await fs.promises.mkdir(target, { recursive: true });
        return { path: getPathFromStr(target) };
      }

      case 'local:createFile': {
        const baseDir = this.assertAllowedLocalPath(String(params.path || os.homedir()));
        const name = String(params.name || '').trim().replace(/^[\\/]+/, '');
        if (!name || /[\\/]$/.test(name) || name.split(/[\\/]+/).some((seg) => !seg || seg === '.' || seg === '..')) {
          throw new Error('Invalid file name.');
        }
        const target = this.assertAllowedLocalPath(path.join(baseDir, name));
        if (fs.existsSync(target)) throw new Error('A file or folder with that name already exists.');
        await fs.promises.mkdir(path.dirname(target), { recursive: true });
        await fs.promises.writeFile(target, typeof params.content === 'string' ? params.content : '', { encoding: 'utf8', flag: 'wx' });
        return { path: getPathFromStr(target) };
      }

      case 'local:rename': {
        const from = this.assertAllowedLocalPath(String(params.path || ''));
        const name = String(params.name || '').trim();
        if (!name || name.includes('/') || name.includes('\\') || name === '.' || name === '..') {
          throw new Error('Invalid name.');
        }
        const to = this.assertAllowedLocalPath(path.join(path.dirname(from), name));
        if (fs.existsSync(to)) throw new Error('A file or folder with that name already exists.');
        await fs.promises.rename(from, to);
        return { path: getPathFromStr(to) };
      }

      case 'local:delete': {
        const rawPaths: string[] = Array.isArray(params.paths) ? params.paths.map(String) : [];
        const homeResolved = path.resolve(os.homedir());
        const trash = this.desktopHooks.trashItem;
        let deleted = 0;
        for (const p of rawPaths) {
          const norm = this.assertAllowedLocalPath(p);
          const parsedRoot = path.parse(norm).root;
          if (norm === parsedRoot || norm === homeResolved || norm.split(path.sep).filter(Boolean).length < 2) {
            throw new Error(`Refusing to delete protected directory "${p}".`);
          }
          // Desktop app: to the system Trash (recoverable); browser mode has no Trash API, so it's permanent
          if (trash) await trash(norm);
          else await fs.promises.rm(norm, { recursive: true, force: false });
          deleted++;
        }
        RepoFileWatcher.notifyPossibleRemoteChange(250);
        return { deleted, trashed: !!trash };
      }

      case 'local:importPaths': {
        const destDir = this.assertAllowedLocalPath(String(params.destDir || os.homedir()));
        const sources: string[] = Array.isArray(params.sources) ? params.sources.map(String) : [];
        await fs.promises.mkdir(destDir, { recursive: true });
        const copied: string[] = [];
        for (const src of sources) {
          copied.push(await this.copyLocalEntryDedup(src, destDir));
        }
        return { copied };
      }

      case 'local:pickImport': {
        const destDir = this.assertAllowedLocalPath(String(params.destDir || os.homedir()));
        const picked = await hostBridge.getHandlers().onOpenDialog?.({
          canSelectFiles: params.folders !== true,
          canSelectFolders: params.folders === true || params.both === true,
          canSelectMany: true,
          defaultPath: os.homedir(),
          openLabel: 'Import / Copy Here'
        });
        if (!picked || picked.length === 0) return { copied: [] };
        await fs.promises.mkdir(destDir, { recursive: true });
        const copied: string[] = [];
        for (const src of picked) {
          copied.push(await this.copyLocalEntryDedup(src, destDir));
        }
        return { copied };
      }

      case 'local:pickExport': {
        const sources: string[] = Array.isArray(params.sources) ? params.sources.map(String) : [];
        if (sources.length === 0) throw new Error('Nothing selected to export.');
        const downloads = path.join(os.homedir(), 'Downloads');
        const picked = await hostBridge.getHandlers().onOpenDialog?.({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          defaultPath: fs.existsSync(downloads) ? downloads : os.homedir(),
          openLabel: 'Download / Save Here'
        });
        if (!picked || picked.length === 0) return { exported: [] };
        const destDir = this.assertAllowedLocalPath(picked[0]);
        await fs.promises.mkdir(destDir, { recursive: true });
        const exported: string[] = [];
        for (const src of sources) {
          exported.push(await this.copyLocalEntryDedup(src, destDir));
        }
        return { exported };
      }

      case 'ssh:rename': {
        const hostId = String(params.hostId || '');
        const from = String(params.path || '');
        const name = String(params.name || '').trim();
        if (!from.startsWith('/') || !name || name.includes('/') || name === '.' || name === '..') throw new Error('Invalid name.');
        const to = path.posix.join(path.posix.dirname(from), name);
        const res = await sshManager.execRemote(hostId, `if [ -e ${quotePosixArg(to)} ]; then echo 'A file or folder with that name already exists.' >&2; exit 1; fi; mv ${quotePosixArg(from)} ${quotePosixArg(to)}`);
        if (res.code !== 0) throw new Error(res.stderr.trim() || 'Unable to rename.');
        RepoFileWatcher.notifyPossibleRemoteChange(250);
        return { path: to };
      }

      case 'ssh:delete': {
        const hostId = String(params.hostId || '');
        const paths: string[] = Array.isArray(params.paths) ? params.paths.map(String) : [];
        const session = await sshManager.ensureConnected(hostId);
        for (const p of paths) {
          const norm = path.posix.normalize(p);
          if (!norm.startsWith('/') || norm === '/' || norm.split('/').filter(Boolean).length < 2 || norm === session.homeDir) {
            throw new Error(`Refusing to delete "${p}".`);
          }
        }
        if (paths.length === 0) return { deleted: 0 };
        const res = await sshManager.execRemote(hostId, 'rm -rf -- ' + paths.map((p) => quotePosixArg(path.posix.normalize(p))).join(' '));
        if (res.code !== 0) throw new Error(res.stderr.trim() || 'Unable to delete.');
        RepoFileWatcher.notifyPossibleRemoteChange(300);
        return { deleted: paths.length };
      }

      /* File Transfers (SFTP) */
      case 'transfer:list':
        return { transfers: transferManager.list() };

      case 'transfer:start': {
        const direction: TransferDirection = params.direction === 'download' ? 'download' : 'upload';
        const hostId = String(params.hostId || '');
        const sources: string[] = Array.isArray(params.sources) ? params.sources.map(String) : [];
        let destDir = String(params.destDir || '');
        if (direction === 'download') {
          destDir = destDir.startsWith('~') ? path.join(os.homedir(), destDir.slice(1)) : path.resolve(destDir);
        } else {
          destDir = await sshManager.resolveRemotePath(hostId, destDir);
        }
        return { transfer: transferManager.start(direction, hostId, sources, destDir) };
      }

      case 'transfer:pickUpload': {
        const hostId = String(params.hostId || '');
        const destDir = await sshManager.resolveRemotePath(hostId, String(params.destDir || '~'));
        const picked = await hostBridge.getHandlers().onOpenDialog?.({
          canSelectFiles: params.folders !== true,
          canSelectFolders: params.folders === true || params.both === true,
          canSelectMany: true,
          defaultPath: os.homedir(),
          openLabel: 'Upload'
        });
        if (!picked || picked.length === 0) return { transfer: null };
        const sources = picked.map((p) => (p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : path.resolve(p)));
        return { transfer: transferManager.start('upload', hostId, sources, destDir) };
      }

      case 'transfer:pickDownload': {
        const hostId = String(params.hostId || '');
        const sources: string[] = Array.isArray(params.sources) ? params.sources.map(String) : [];
        if (sources.length === 0) throw new Error('Nothing to download.');
        const downloads = path.join(os.homedir(), 'Downloads');
        const picked = await hostBridge.getHandlers().onOpenDialog?.({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          defaultPath: fs.existsSync(downloads) ? downloads : os.homedir(),
          openLabel: 'Download Here'
        });
        if (!picked || picked.length === 0) return { transfer: null };
        const dest = picked[0].startsWith('~') ? path.join(os.homedir(), picked[0].slice(1)) : path.resolve(picked[0]);
        return { transfer: transferManager.start('download', hostId, sources, dest) };
      }

      case 'transfer:control': {
        const id = String(params.id || '');
        switch (String(params.action || '')) {
          case 'pause': transferManager.pause(id); break;
          case 'resume': transferManager.resume(id); break;
          case 'cancel': await transferManager.cancel(id); break;
          case 'undo': await transferManager.undo(id); break;
          case 'restore': await transferManager.restore(id); break;
          case 'remove': await transferManager.remove(id); break;
          case 'pauseAll': transferManager.pauseAll(); break;
          case 'resumeAll': transferManager.resumeAll(); break;
          case 'clearFinished': await transferManager.clearFinished(); break;
          default: throw new Error('Unknown transfer action.');
        }
        return { transfers: transferManager.list() };
      }

      case 'ssh:openRemoteRepo': {
        const hostId = String(params.hostId || '');
        const resolvedPath = await sshManager.resolveRemotePath(hostId, String(params.remotePath || '~'));
        const sshUri = formatRemoteRepoUri(hostId, resolvedPath);
        const res = await this.repoManager.registerRepo(sshUri, true);
        if (res.error && !this.repoManager.isKnownRepo(sshUri)) {
          throw new Error(res.error);
        }
        const finalRoot = res.root || sshUri;
        this.extensionState.setLastActiveRepo(finalRoot);
        this.openViewTo({ repo: finalRoot });
        return { root: finalRoot, repos: this.repoManager.getRepos() };
      }

      /* Built-in Diff & File Viewer */
      case 'diff:compute': {
        return this.diffService.computeDiff({
          repo: String(params.repo || ''),
          fromHash: String(params.fromHash || ''),
          toHash: String(params.toHash || ''),
          oldFilePath: String(params.oldFilePath || ''),
          newFilePath: String(params.newFilePath || ''),
          type: params.type || 'M'
        });
      }

      case 'file:read': {
        let repo = String(params.repo || '');
        let filePath = String(params.filePath || '');
        const commit: string | null = params.commit ? String(params.commit) : null;

        if (!repo && filePath && !isRemoteRepo(filePath)) {
          const found = await this.repoManager.getRepoAndPathOfFile(filePath.replace(/\\/g, '/'));
          if (found) {
            repo = found.repo;
            filePath = found.path;
          }
        }

        if (repo) {
          const textRes = await this.diffService.readRevisionText(repo, commit, filePath);
          const blame = params.includeBlame
            ? await this.diffService.loadFileBlame(repo, filePath, commit)
            : null;
          return {
            repo,
            filePath,
            commit,
            content: textRes.content,
            isBinary: textRes.isBinary,
            truncated: textRes.truncated,
            notUtf8: !!textRes.notUtf8,
            error: textRes.error,
            blame
          };
        }

        const MAX_STANDALONE_BYTES = 5 * 1024 * 1024;
        let buf: Buffer;
        let shownPath = filePath;
        if (isRemoteRepo(filePath)) {
          const parsed = parseRemoteRepo(filePath)!;
          shownPath = parsed.remotePath;
          buf = await sshManager.readRemoteFile(parsed.hostId, parsed.remotePath, MAX_STANDALONE_BYTES + 1);
        } else {
          const resolvedFile = this.assertAllowedLocalPath(filePath);
          const fh = await fs.promises.open(resolvedFile, 'r');
          try {
            const st = await fh.stat();
            const allocLen = Math.min(MAX_STANDALONE_BYTES + 1, Math.max(0, st.size));
            const chunk = Buffer.allocUnsafe(allocLen);
            const { bytesRead } = allocLen > 0 ? await fh.read(chunk, 0, allocLen, 0) : { bytesRead: 0 };
            buf = chunk.subarray(0, bytesRead);
          } finally {
            await fh.close();
          }
        }
        const isBinary = buf.subarray(0, 8000).includes(0);
        const truncated = buf.length > MAX_STANDALONE_BYTES;
        return {
          repo: '',
          filePath: shownPath,
          sourceUri: filePath,
          commit: null,
          content: isBinary ? '' : buf.subarray(0, MAX_STANDALONE_BYTES).toString('utf8'),
          isBinary,
          error: null,
          truncated,
          notUtf8: !isBinary && !truncated && isLossyUtf8(buf),
          blame: null
        };
      }

      case 'file:write': {
        const repo = String(params.repo || '');
        const filePath = String(params.filePath || '');
        const content = String(params.content ?? '');
        // Never overwrite a file that isn't UTF-8: the editor only had a lossy UTF-8 view of it
        const existing = repo
          ? await readRepoFileBuffer(repo, filePath, 32 * 1024 * 1024).catch(() => null)
          : isRemoteRepo(filePath)
            ? await sshManager.readRemoteFile(parseRemoteRepo(filePath)!.hostId, parseRemoteRepo(filePath)!.remotePath).catch(() => null)
            : await fs.promises.readFile(this.assertAllowedLocalPath(filePath)).catch(() => null);
        if (existing && !existing.subarray(0, 8192).includes(0) && isLossyUtf8(existing)) {
          throw new Error('This file isn\'t UTF-8 encoded (e.g. GBK); saving from GitMap would corrupt it. Edit it in an editor that keeps its encoding.');
        }
        if (repo) {
          await this.workflowService.writeRepoWorkingFile(repo, filePath, content);
          return { ok: true };
        }
        if (!filePath) throw new Error('File path is required.');
        if (isRemoteRepo(filePath)) {
          const parsed = parseRemoteRepo(filePath)!;
          await sshManager.writeRemoteFile(parsed.hostId, parsed.remotePath, content);
          RepoFileWatcher.notifyPossibleRemoteChange(250);
          return { ok: true };
        }
        const resolvedFile = this.assertAllowedLocalPath(filePath);
        await fs.promises.writeFile(resolvedFile, content, 'utf8');
        return { ok: true };
      }

      case 'file:blame': {
        const repo = String(params.repo || '');
        const filePath = String(params.filePath || '');
        const commit = params.commit ? String(params.commit) : null;
        const blame = await this.diffService.loadFileBlame(repo, filePath, commit);
        return { blame };
      }

      case 'file:viewHistoryInGraph': {
        const repo = String(params.repo || '');
        const filePath = String(params.filePath || '');
        const lineRange = params.lineRange && typeof params.lineRange.start === 'number'
          ? { start: Number(params.lineRange.start), end: Number(params.lineRange.end || params.lineRange.start) }
          : undefined;
        this.openViewTo({
          repo,
          fileHistory: filePath,
          ...(lineRange ? { lineRange } : {})
        });
        return { ok: true };
      }

      case 'file:visualHistory': {
        await vscode.commands.executeCommand('git-map.visualFileHistory', {
          repo: String(params.repo || ''),
          filePath: String(params.filePath || ''),
          commitHash: params.commitHash ? String(params.commitHash) : undefined
        });
        return { ok: true };
      }

      case 'file:timeMachine': {
        await vscode.commands.executeCommand('git-map.fileTimeMachine', {
          repo: String(params.repo || ''),
          filePath: String(params.filePath || ''),
          commitHash: params.commitHash ? String(params.commitHash) : undefined
        });
        return { ok: true };
      }

      /* Terminal Sessions */
      case 'term:create': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || os.homedir());
        const info = await this.terminalManager.createSession(
          repo,
          params.name,
          Number(params.cols) || 100,
          Number(params.rows) || 28,
          params.initialCommand || null,
          (id, chunk) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'term:data', id, data: chunk }));
            }
          },
          (id, code) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'term:exit', id, code }));
            }
          },
          ws,
          params.shellPath ? String(params.shellPath) : null
        );
        if (ws.readyState !== WebSocket.OPEN) {
          this.terminalManager.detachOwner(ws, 6000);
        }
        return { session: info };
      }

      case 'term:attach': {
        const id = String(params.id || '');
        const attached = this.terminalManager.attachSession(
          id,
          ws,
          (tid, chunk) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'term:data', id: tid, data: chunk }));
            }
          },
          (tid, code) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'term:exit', id: tid, code }));
            }
          }
        );
        return { attached: attached !== null, session: attached?.session || null, scrollback: attached?.scrollback || '' };
      }

      case 'term:list':
        return { sessions: this.terminalManager.listSessions() };

      case 'term:openSystem': {
        const location = String(params.repo || this.extensionState.getLastActiveRepo() || os.homedir());
        const app = await openInTerminal(location, this.getLauncherSettings());
        return { ok: true, app };
      }

      case 'editor:open': {
        const location = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        if (!location) throw new Error('No repository or folder to open.');
        const app = await openInEditor(location, this.getLauncherSettings());
        return { ok: true, app };
      }

      case 'system:openLocalNetworkSettings': {
        if (process.platform !== 'darwin') throw new Error('Local Network privacy settings only exist on macOS.');
        const url = 'x-apple.systempreferences:com.apple.preference.security?Privacy_LocalNetwork';
        if (this.desktopHooks.openExternal) await this.desktopHooks.openExternal(url);
        else cp.spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
        return { ok: true };
      }

      case 'launchers:list':
        return listLaunchers(!!params.refresh);

      /* AI Provider & API Key */
      case 'ai:info': {
        const snapshot = await loadAiSettingsSnapshot();
        const keys: { [provider: string]: boolean } = {};
        for (const preset of snapshot.presets) {
          if (preset.requiresApiKey) keys[preset.id] = (await getApiKey(preset.id as AiProvider)) !== null;
        }
        return {
          ...snapshot,
          presets: snapshot.presets.filter((p) => p.id !== AiProvider.VsCode),
          keys,
          defaultTimeoutSeconds: DEFAULT_AI_TIMEOUT_SECONDS
        };
      }

      case 'ai:preview': {
        const provider = String(params.provider || '');
        const options = parseAiRequestSettings(provider, params.request || {});
        const preview = previewAiRequest(provider, String(params.baseUrl || ''), String(params.model || ''), options);
        return { ...preview, error: options.configError };
      }

      case 'ai:test':
        return testAiConnection();

      case 'ai:setApiKey': {
        const key = typeof params.key === 'string' ? params.key.trim() : '';
        if (!key) throw new Error("The API key can't be empty.");
        const stored = await setApiKey(key);
        if (!stored) throw new Error('Choose an AI provider that needs an API key first.');
        return { ok: true };
      }

      case 'ai:clearApiKey':
        await clearApiKey();
        return { ok: true };

      case 'ai:reviewChanges': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        const scope = ['staged', 'unstaged', 'all', 'commit'].includes(params.scope) ? params.scope : 'all';
        return this.workflowService.reviewChangesWithAi({
          repo,
          scope,
          commitHash: params.commitHash ? String(params.commitHash) : undefined,
          lang: params.lang ? String(params.lang) : undefined
        });
      }

      case 'ai:releaseNotes': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        return this.workflowService.generateReleaseNotes({
          repo,
          fromRef: params.fromRef ? String(params.fromRef) : undefined,
          toRef: params.toRef ? String(params.toRef) : 'HEAD',
          lang: params.lang ? String(params.lang) : undefined
        });
      }

      case 'git:nlSearch': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        return this.workflowService.naturalLanguageCommitSearch(repo, String(params.query || ''));
      }

      /* Settings & Logs */
      case 'settings:get':
        return { settings: getAllStandaloneSettings() };

      case 'settings:update': {
        const key = String(params.key || '');
        await updateStandaloneSetting(key, params.value);
        return { settings: getAllStandaloneSettings() };
      }

      case 'settings:updateBatch': {
        const updates = params.updates && typeof params.updates === 'object' ? params.updates : {};
        await updateStandaloneSettingsBatch(updates);
        return { settings: getAllStandaloneSettings() };
      }

      case 'logs:get':
        return { logs: hostBridge.getLogs() };

      case 'system:diagnostics':
        return this.buildDiagnosticsSnapshot();

      /* Submodules & Git LFS */
      case 'git:submodules': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        return { submodules: await this.enhancementsService.getSubmodules(repo) };
      }

      case 'git:submoduleAction': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        const action = params.action === 'update' || params.action === 'sync' ? params.action : 'init';
        const subPath = params.path ? String(params.path) : undefined;
        return this.enhancementsService.runSubmoduleAction(repo, action, subPath);
      }

      case 'git:lfsStatus': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        return this.enhancementsService.getLfsStatus(repo);
      }

      case 'git:lfsAction': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        const action = params.action === 'fetch' || params.action === 'install' ? params.action : 'pull';
        return this.enhancementsService.runLfsAction(repo, action);
      }

      /* Multi-Repo Cross-Search */
      case 'repos:searchCommits': {
        const allRepos = Object.keys(this.repoManager.getRepos());
        const targetRepos = Array.isArray(params.repos) && params.repos.length > 0
          ? params.repos.map(String)
          : allRepos;
        const hits = await this.enhancementsService.searchAcrossRepos(
          targetRepos,
          String(params.query || ''),
          params.author ? String(params.author) : undefined,
          Number(params.limitPerRepo) || 25
        );
        return { hits };
      }

      /* Full-Text Content Search (Local & Remote-SSH) */
      case 'search:content': {
        const target = String(params.target || params.repo || this.extensionState.getLastActiveRepo() || '');
        if (!target) throw new Error('Search target directory is required.');
        if (!isRemoteRepo(target)) {
          this.assertAllowedLocalPath(target);
        }
        return this.enhancementsService.searchContent(target, {
          query: String(params.query || ''),
          regex: !!params.regex,
          caseSensitive: !!params.caseSensitive,
          excludes: Array.isArray(params.excludes) ? params.excludes.map(String) : undefined,
          maxMatches: Number(params.maxMatches) || 400
        });
      }

      /* Remote SSH Host Resource Telemetry */
      case 'ssh:hostStats': {
        const hostId = String(params.hostId || '');
        if (!hostId) throw new Error('hostId is required.');
        const mountPath = params.mountPath ? String(params.mountPath) : undefined;
        return this.enhancementsService.getRemoteHostStats(hostId, mountPath);
      }

      /* Folder / Repo Diff & Selective Sync */
      case 'diff:folders': {
        const left = String(params.left || '');
        const right = String(params.right || '');
        if (!left || !right) throw new Error('Both left and right paths are required.');
        if (!isRemoteRepo(left)) this.assertAllowedLocalPath(left);
        if (!isRemoteRepo(right)) this.assertAllowedLocalPath(right);
        return this.enhancementsService.compareFolders(left, right, {
          excludes: Array.isArray(params.excludes) ? params.excludes.map(String) : undefined,
          maxFiles: Number(params.maxFiles) || 4000
        });
      }

      case 'diff:syncFile': {
        const source = String(params.source || '');
        const target = String(params.target || '');
        const relPath = String(params.relPath || '');
        if (!source || !target || !relPath) throw new Error('source, target and relPath are required.');
        if (!isRemoteRepo(source)) this.assertAllowedLocalPath(source);
        if (!isRemoteRepo(target)) this.assertAllowedLocalPath(target);
        return this.enhancementsService.syncFolderFile(source, target, relPath);
      }

      /* AI Commit Message */
      case 'ai:commitMessage': {
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || '');
        const language = params.language === 'en' ? 'en' : 'zh';
        const style = params.style === 'concise' || params.style === 'detailed' ? params.style : 'conventional';
        return this.aiAssistantService.generateCommitMessage(repo, { language, style });
      }

      /* Settings Export / Import (Sanitized or AES-256-GCM Encrypted) */
      case 'settings:export': {
        const passphrase = typeof params.passphrase === 'string' ? params.passphrase : undefined;
        const clientPrefs = params.clientPrefs && typeof params.clientPrefs === 'object' ? params.clientPrefs : undefined;
        const pkgVersion = this.getAppVersion();
        const payload: BackupPayload = {
          schemaVersion: 1,
          exportedAt: new Date().toISOString(),
          appVersion: pkgVersion,
          settings: getAllStandaloneSettings(),
          sshHosts: sanitizeSshHostsForExport(sshManager.listHosts()),
          clientPrefs
        };
        const envelope = createBackupEnvelope(payload, passphrase);
        return { envelope };
      }

      case 'settings:import': {
        const raw = params.envelope ?? params.raw;
        const passphrase = typeof params.passphrase === 'string' ? params.passphrase : undefined;
        const payload = parseBackupEnvelope(raw, passphrase);
        let restoredSettings = 0;
        if (payload.settings && typeof payload.settings === 'object') {
          await updateStandaloneSettingsBatch(payload.settings);
          restoredSettings = Object.keys(payload.settings).length;
        }
        let restoredHosts = 0;
        if (Array.isArray(payload.sshHosts)) {
          // Profiles store the login as `user` and the jump host as `proxyJump`; backups written before 2026-11-20 used
          // `username` / `jumpHost` (and lost the values), so read both
          const keyOf = (user: string, host: string, port: number) => `${user}@${host.toLowerCase()}:${port}`;
          const existing = new Set(sshManager.listHosts().map((h) => keyOf(h.user || '', h.host, h.port || 22)));
          for (const h of payload.sshHosts) {
            if (!h || !h.host) continue;
            const user = String(h.user || h.username || '').trim() || os.userInfo().username;
            const port = Number(h.port) || 22;
            const key = keyOf(user, h.host, port);
            if (existing.has(key)) continue;
            const profile = await sshManager.saveHost({
              name: h.name || h.host,
              host: h.host,
              port,
              user,
              authType: h.authType === 'password' || h.authType === 'agent' || h.authType === 'key' || h.authType === 'auto' ? h.authType : 'auto',
              privateKeyPath: h.privateKeyPath,
              proxyJump: h.proxyJump || h.jumpHost,
              defaultPath: h.defaultPath
            });
            if ((h.alias && h.alias.trim()) || (Array.isArray(h.tags) && h.tags.length > 0)) {
              await sshManager.updateHostMeta(profile.id, h.alias, h.tags);
            }
            existing.add(key);
            restoredHosts++;
          }
        }
        return {
          ok: true,
          restoredSettings,
          restoredHosts,
          clientPrefs: payload.clientPrefs || null,
          settings: getAllStandaloneSettings(),
          hosts: sshManager.listHosts()
        };
      }

      /* In-App Update Check */
      case 'system:checkUpdate': {
        const currentVersion = this.getAppVersion();
        return checkGitHubUpdate(currentVersion);
      }

      default:
        throw new Error(`Unknown RPC method: ${method}`);
    }
  }

  private getLauncherSettings(): LauncherSettings {
    const s = getAllStandaloneSettings();
    return {
      terminalApp: typeof s['gitmap.terminal.app'] === 'string' ? s['gitmap.terminal.app'] : undefined,
      terminalCustomCommand: typeof s['gitmap.terminal.customCommand'] === 'string' ? s['gitmap.terminal.customCommand'] : undefined,
      editorApp: typeof s['gitmap.editor.app'] === 'string' ? s['gitmap.editor.app'] : undefined,
      editorCustomCommand: typeof s['gitmap.editor.customCommand'] === 'string' ? s['gitmap.editor.customCommand'] : undefined
    };
  }

  private async discoverLocalRepos(rootFolder: string, maxDepth: number): Promise<Array<{ name: string; path: string; branch: string | null }>> {
    const discovered: Array<{ name: string; path: string; branch: string | null }> = [];
    const seen = new Set<string>();
    const walk = async (dir: string, depth: number) => {
      if (depth > maxDepth || discovered.length >= 150) return;
      let dirents: fs.Dirent[];
      try {
        dirents = await fs.promises.readdir(dir, { withFileTypes: true });
      } catch (_) {
        return;
      }
      if (dirents.some((d) => d.name === '.git')) {
        const norm = getPathFromStr(dir);
        if (!seen.has(norm)) {
          seen.add(norm);
          let branch: string | null = null;
          try {
            const headText = (await fs.promises.readFile(path.join(dir, '.git', 'HEAD'), 'utf8')).trim();
            branch = headText.startsWith('ref: refs/heads/') ? headText.substring(16) : headText.substring(0, 8);
          } catch (_) {}
          discovered.push({ name: getRepoName(norm), path: norm, branch });
        }
        return;
      }
      for (const d of dirents) {
        if (!d.isDirectory() || d.name.startsWith('.') || d.name === 'node_modules' || d.name === 'Library') continue;
        await walk(path.join(dir, d.name), depth + 1);
      }
    };
    await walk(rootFolder, 0);
    return discovered.sort((a, b) => a.path.localeCompare(b.path));
  }

  private async completeLocalPath(partial: string, showHidden: boolean) {
    const raw = partial.trim() === '' ? '~/' : partial;
    const expanded = raw === '~' ? os.homedir() + path.sep : raw.startsWith('~/') || raw.startsWith('~\\') ? path.join(os.homedir(), raw.slice(2)) + (/[\\/]$/.test(raw) ? path.sep : '') : raw;
    const sepIdx = Math.max(expanded.lastIndexOf('/'), expanded.lastIndexOf('\\'));
    const dir = sepIdx === -1 ? os.homedir() : expanded.substring(0, sepIdx + 1);
    const prefix = sepIdx === -1 ? expanded : expanded.substring(sepIdx + 1);
    const dirents = await fs.promises.readdir(path.resolve(dir), { withFileTypes: true });
    const lower = prefix.toLowerCase();
    let matched = dirents.filter((d) => d.name.startsWith(prefix));
    if (matched.length === 0) matched = dirents.filter((d) => d.name.toLowerCase().startsWith(lower));
    const entries = await Promise.all(
      matched
        .filter((d) => showHidden || prefix.startsWith('.') || !d.name.startsWith('.'))
        .slice(0, 200)
        .map(async (d) => {
          const full = path.join(path.resolve(dir), d.name);
          let isDirectory = d.isDirectory();
          if (d.isSymbolicLink()) {
            try {
              isDirectory = (await fs.promises.stat(full)).isDirectory();
            } catch (_) {}
          }
          return { name: d.name, path: getPathFromStr(full), isDirectory };
        })
    );
    entries.sort((a, b) => (a.isDirectory !== b.isDirectory ? (a.isDirectory ? -1 : 1) : a.name.localeCompare(b.name)));
    return { dir: getPathFromStr(path.resolve(dir)), prefix, entries };
  }

  private async browseLocalDirectory(targetPath?: string, showHidden: boolean = false) {
    const raw = (targetPath || '').trim();
    const resolved = !raw || raw === '~'
      ? os.homedir()
      : raw.startsWith('~/') || raw.startsWith('~\\')
        ? path.join(os.homedir(), raw.slice(2))
        : path.resolve(raw);

    const dirents = await fs.promises.readdir(resolved, { withFileTypes: true });
    const filtered = dirents.filter((d) => showHidden || !d.name.startsWith('.'));

    const entries: RemoteDirectoryEntry[] = await Promise.all(
      filtered.map(async (d) => {
        const fullPath = path.join(resolved, d.name);
        const isSym = d.isSymbolicLink();
        let isDir = d.isDirectory();
        let size = 0;
        let mtime = 0;
        try {
          const st = await fs.promises.stat(fullPath);
          isDir = st.isDirectory();
          size = st.isFile() ? st.size : 0;
          mtime = Math.floor(st.mtimeMs / 1000);
        } catch (_) {}

        let isGitRepo = false;
        let gitBranch: string | null = null;
        if (isDir) {
          const dotGit = path.join(fullPath, '.git');
          try {
            const gitStat = await fs.promises.stat(dotGit);
            isGitRepo = true;
            if (gitStat.isDirectory()) {
              const headText = (await fs.promises.readFile(path.join(dotGit, 'HEAD'), 'utf8')).trim();
              gitBranch = headText.startsWith('ref: refs/heads/') ? headText.substring(16) : headText.substring(0, 8);
            }
          } catch (_) {}
        }

        return {
          name: d.name,
          path: getPathFromStr(fullPath),
          isDirectory: isDir,
          isSymlink: isSym,
          isGitRepo,
          gitBranch,
          size,
          mtime
        };
      })
    );

    entries.sort((a, b) => (a.isDirectory !== b.isDirectory ? (a.isDirectory ? -1 : 1) : a.name.localeCompare(b.name)));

    let currentRepoRoot: string | null = null;
    let currentRepoBranch: string | null = null;
    try {
      await fs.promises.stat(path.join(resolved, '.git'));
      currentRepoRoot = getPathFromStr(resolved);
      currentRepoBranch = await new Promise<string | null>((resolve) => {
        cp.execFile('git', ['-C', resolved, 'symbolic-ref', '-q', '--short', 'HEAD'], { encoding: 'utf8', timeout: 5000 }, (err, stdout) => {
          resolve(err ? null : String(stdout).trim() || null);
        });
      });
    } catch (_) {}

    const normCurrent = getPathFromStr(resolved);
    const parentRaw = path.dirname(resolved);
    const parentPath = parentRaw === resolved ? null : getPathFromStr(parentRaw);

    return {
      currentPath: normCurrent,
      parentPath,
      homeDir: getPathFromStr(os.homedir()),
      currentRepoRoot,
      currentRepoBranch,
      repoNameSuggestion: getRepoName(normCurrent),
      entries
    };
  }

  private getAppVersion(): string {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(this.rootDir, 'package.json'), 'utf8'));
      return typeof pkg.version === 'string' ? pkg.version : '1.0.0';
    } catch {
      return '1.0.0';
    }
  }

  private async handleRawFilePreview(parsedUrl: URL, res: http.ServerResponse): Promise<void> {
    const MIME_BY_EXT: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.m4a': 'audio/mp4',
      '.flac': 'audio/flac',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };
    const MAX_PREVIEW_BYTES = 50 * 1024 * 1024;
    try {
      const repo = parsedUrl.searchParams.get('repo') || '';
      const hostIdParam = parsedUrl.searchParams.get('hostId') || '';
      const filePathParam = parsedUrl.searchParams.get('path') || '';
      if (!filePathParam) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Missing path parameter');
        return;
      }
      const ext = path.extname(filePathParam).toLowerCase();
      const mime = MIME_BY_EXT[ext];
      if (!mime) {
        res.writeHead(415, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Unsupported media preview type');
        return;
      }

      const remoteInfo = hostIdParam
        ? { hostId: hostIdParam, remotePath: filePathParam }
        : (repo ? parseRemoteRepo(repo) : null);

      if (remoteInfo) {
        const targetRemote = hostIdParam
          ? filePathParam
          : (filePathParam.startsWith('/') ? filePathParam : path.posix.join(remoteInfo.remotePath, filePathParam));
        const buf = await sshManager.readRemoteFile(remoteInfo.hostId, targetRemote, MAX_PREVIEW_BYTES);
        res.writeHead(200, {
          'Content-Type': mime,
          'Content-Length': String(buf.length),
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff'
        });
        res.end(buf);
        return;
      }

      const fullLocal = repo && !path.isAbsolute(filePathParam)
        ? path.resolve(repo, filePathParam)
        : path.resolve(filePathParam);
      this.assertAllowedLocalPath(fullLocal);
      const st = await fs.promises.stat(fullLocal);
      if (!st.isFile() || st.size > MAX_PREVIEW_BYTES) {
        res.writeHead(413, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('File too large or not a regular file');
        return;
      }
      res.writeHead(200, {
        'Content-Type': mime,
        'Content-Length': String(st.size),
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      });
      await pipeline(fs.createReadStream(fullLocal), res);
    } catch (err: any) {
      if (!res.headersSent) {
        res.writeHead(err?.message?.includes('Access denied') ? 403 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      res.end(err?.message || 'Preview error');
    }
  }
}
