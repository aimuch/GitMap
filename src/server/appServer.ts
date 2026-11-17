import * as cp from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { WebSocket, WebSocketServer } from 'ws';
import { AiProvider, clearApiKey, getApiKey, loadAiSettingsSnapshot, setAiSecretStorage, setApiKey } from '../aiProviders';
import { AvatarManager } from '../avatarManager';
import { setSettingFallbackStorage } from '../config';
import { DataSource } from '../dataSource';
import { DiffDocProvider } from '../diffDocProvider';
import { ExtensionState } from '../extensionState';
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
  getAllStandaloneSettings,
  initStandaloneConfig,
  JsonFileMemento,
  JsonSecretStorage,
  updateStandaloneSetting
} from '../platform/vscode';
import { formatRemoteRepoUri, isRemoteRepo, parseRemoteRepo } from '../remote/repoTransport';
import { quotePosixArg, RemoteDirectoryEntry, sshManager } from '../remote/sshManager';
import { TransferDirection, transferManager } from '../remote/transferManager';
import { RemoveFromHistory } from '../removeFromHistory';
import { RepoManager } from '../repoManager';
import { findGit, getPathFromStr, getRepoName, GitExecutable } from '../utils';
import { EventEmitter as GitMapEventEmitter } from '../utils/event';
import { FileTimeMachine } from '../fileTimeMachine';
import { VisualFileHistory } from '../visualFileHistory';
import { DiffService } from './diffService';
import { LauncherSettings, listLaunchers, openInEditor, openInTerminal } from './launchers';
import { TerminalManager } from './terminalManager';

export interface DesktopNativeHooks {
  showOpenDialog?: (req: OpenDialogRequest) => Promise<string[] | undefined>;
  showSaveDialog?: (req: SaveDialogRequest) => Promise<string | undefined>;
  writeClipboard?: (text: string) => Promise<boolean>;
  openExternal?: (url: string) => Promise<boolean>;
}

export interface GitMapServerOptions {
  port?: number;
  host?: string;
  dataDir?: string;
  initialRepos?: string[];
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

export class GitMapServer {
  private readonly rootDir: string;
  private readonly dataDir: string;
  private readonly host: string;
  private requestedPort: number;
  private desktopHooks: DesktopNativeHooks;

  private server!: http.Server;
  private wss!: WebSocketServer;
  private readonly clients = new Set<WebSocket>();
  private readonly pendingPrompts = new Map<string, (value: any) => void>();
  private readonly vfhPages = new Map<string, VisualFileHistoryOpenPayload>();

  public logger!: Logger;
  public extensionState!: ExtensionState;
  public dataSource!: DataSource;
  public avatarManager!: AvatarManager;
  public repoManager!: RepoManager;
  public diffService!: DiffService;
  public terminalManager!: TerminalManager;
  private actualPort: number = 0;

  constructor(private readonly options: GitMapServerOptions = {}) {
    this.rootDir = path.resolve(__dirname, '..', '..');
    this.dataDir = options.dataDir || process.env.GITMAP_DATA_DIR || path.join(os.homedir(), '.gitmap');
    this.host = options.host || '127.0.0.1';
    this.requestedPort = typeof options.port === 'number' ? options.port : 3847;
    this.desktopHooks = options.desktopHooks || {};
  }

  public setDesktopHooks(hooks: DesktopNativeHooks) {
    this.desktopHooks = hooks;
  }

  public getPort(): number {
    return this.actualPort;
  }

  public getUrl(): string {
    const displayHost = this.host === '0.0.0.0' ? '127.0.0.1' : this.host;
    return `http://${displayHost}:${this.actualPort}`;
  }

  public async start(): Promise<string> {
    await fs.promises.mkdir(this.dataDir, { recursive: true });
    initStandaloneConfig(this.dataDir);

    const globalState = new JsonFileMemento(path.join(this.dataDir, 'global-state.json'));
    const workspaceState = new JsonFileMemento(path.join(this.dataDir, 'workspace-state.json'));
    const secrets = new JsonSecretStorage(path.join(this.dataDir, 'secrets.json'));
    const storageDir = path.join(this.dataDir, 'storage');
    await fs.promises.mkdir(storageDir, { recursive: true });

    setSettingFallbackStorage(globalState);
    setAiSecretStorage(secrets);
    sshManager.init(this.dataDir, secrets);
    transferManager.init(this.dataDir, (transfers) => this.broadcast({ type: 'transfers:update', transfers }));

    const pkgJson = JSON.parse(fs.readFileSync(path.join(this.rootDir, 'package.json'), 'utf8'));

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

    // Register initial repos if passed on CLI
    if (this.options.initialRepos && this.options.initialRepos.length > 0) {
      for (const r of this.options.initialRepos) {
        await this.repoManager.registerRepo(isRemoteRepo(r) ? r : path.resolve(r), true);
      }
    }

    // Subscribe to repo list changes to push live sidebar updates to UI
    this.repoManager.onDidChangeRepos(() => {
      this.broadcast({
        type: 'repos:changed',
        repos: this.repoManager.getRepos(),
        lastActiveRepo: this.extensionState.getLastActiveRepo()
      });
    });

    // Initialize the primary GitGraphView instance so HTML & message handlers are ready
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
      // Only the GitMap page itself may connect: a web page on another origin (or a DNS-rebound host name) must not be
      // able to drive terminals, SSH sessions & Git through this socket.
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
    transferManager.dispose();
    this.terminalManager?.closeAll();
    sshManager.disconnectAll();
    for (const client of this.clients) {
      try {
        client.close();
      } catch (_) {}
    }
    this.clients.clear();
    if (this.wss) {
      await new Promise<void>((resolve) => this.wss.close(() => resolve()));
    }
    if (this.server) {
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

  /**
   * When bound to the loopback interface, only accept loopback host names (defends against DNS rebinding).
   */
  private isAllowedHost(hostHeader: string | undefined) {
    if (!this.isLoopbackBinding()) return true;
    if (!hostHeader) return false;
    const hostname = hostHeader.replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase();
    return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
  }

  private isAllowedWsClient(origin: string | undefined, req: http.IncomingMessage) {
    if (!this.isAllowedHost(req.headers.host)) return false;
    // Non-browser clients (no Origin header) can't be driven by a web page
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
          payload: { title: payload.title, panelId: payload.panelId }
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
      onOpenSettingsUi: () => {
        this.broadcast({ type: 'shell:openAppSettings' });
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
    const parsedUrl = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = decodeURIComponent(parsedUrl.pathname);

    if (pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, version: '1.0.0' }));
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
        res.end('Visual File History panel not found.');
        return;
      }
      // Inject panelId query so vfh-bridge knows its panelId
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      res.end(page.html);
      return;
    }

    // Serve static directories safely
    if (pathname.startsWith('/media/')) {
      return this.serveSafeStatic(path.join(this.rootDir, 'media'), pathname.substring('/media/'.length), res);
    }
    if (pathname.startsWith('/resources/')) {
      return this.serveSafeStatic(path.join(this.rootDir, 'resources'), pathname.substring('/resources/'.length), res);
    }

    const publicFile = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    return this.serveSafeStatic(path.join(this.rootDir, 'public'), publicFile, res);
  }

  private serveSafeStatic(baseDir: string, relFile: string, res: http.ServerResponse) {
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
        'Cache-Control': 'no-cache'
      });
      fs.createReadStream(resolvedTarget).pipe(res);
    });
  }

  /* WebSocket RPC Handling */

  private handleWsConnection(ws: WebSocket) {
    this.clients.add(ws);

    // Send initial bootstrap snapshot immediately
    ws.send(
      JSON.stringify({
        type: 'init',
        repos: this.repoManager.getRepos(),
        lastActiveRepo: this.extensionState.getLastActiveRepo(),
        sshHosts: sshManager.listHosts(),
        settings: getAllStandaloneSettings(),
        platform: process.platform,
        homeDir: os.homedir()
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

      // Prompt response
      if (msg.type === 'ui:promptResponse' && typeof msg.promptId === 'string') {
        const resolver = this.pendingPrompts.get(msg.promptId);
        if (resolver) {
          this.pendingPrompts.delete(msg.promptId);
          resolver(msg.value);
        }
        return;
      }

      // Forward message from GitGraphView iframe
      if (msg.type === 'graph:request' && msg.payload) {
        dispatchMessageToGitMapPanel(msg.payload);
        return;
      }

      // Forward message from VisualFileHistory iframe
      if (msg.type === 'vfh:request' && typeof msg.panelId === 'string' && msg.payload) {
        dispatchMessageToPanel(msg.panelId, msg.payload);
        return;
      }

      // Direct terminal write/resize without RPC roundtrip overhead
      if (msg.type === 'term:input' && typeof msg.id === 'string') {
        this.terminalManager.write(msg.id, String(msg.data || ''));
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

      // RPC Request / Response
      if (msg.type === 'rpc' && typeof msg.reqId === 'string' && typeof msg.method === 'string') {
        try {
          const result = await this.handleRpcMethod(ws, msg.method, msg.params || {});
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'rpc:res', reqId: msg.reqId, ok: true, result }));
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'rpc:res', reqId: msg.reqId, ok: false, error: errorMsg }));
          }
        }
      }
    });

    ws.on('close', () => {
      this.clients.delete(ws);
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
        const resolved = folder.startsWith('~/') ? path.join(os.homedir(), folder.slice(2)) : path.resolve(folder);
        const depth = typeof params.maxDepth === 'number' ? params.maxDepth : 3;
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

      /* Local Directory Browser (for Web Mode & Unified Picker) */
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
        const name = String(params.name || '').trim();
        if (!name || name.includes('/') || name === '.' || name === '..') throw new Error('Invalid folder name.');
        const target = path.posix.join(dir, name);
        const res = await sshManager.execRemote(hostId, `mkdir ${quotePosixArg(target)}`);
        if (res.code !== 0) throw new Error(res.stderr.trim() || 'Unable to create the folder.');
        return { path: target };
      }

      case 'ssh:rename': {
        const hostId = String(params.hostId || '');
        const from = String(params.path || '');
        const name = String(params.name || '').trim();
        if (!from.startsWith('/') || !name || name.includes('/') || name === '.' || name === '..') throw new Error('Invalid name.');
        const to = path.posix.join(path.posix.dirname(from), name);
        const res = await sshManager.execRemote(hostId, `if [ -e ${quotePosixArg(to)} ]; then echo 'A file or folder with that name already exists.' >&2; exit 1; fi; mv ${quotePosixArg(from)} ${quotePosixArg(to)}`);
        if (res.code !== 0) throw new Error(res.stderr.trim() || 'Unable to rename.');
        return { path: to };
      }

      case 'ssh:delete': {
        const hostId = String(params.hostId || '');
        const paths: string[] = Array.isArray(params.paths) ? params.paths.map(String) : [];
        // Only absolute paths below the root, never "/" or a home directory itself
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
        // Ask for local files / folders (native dialog in the desktop app), then upload them
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

        if (!repo && filePath) {
          const found = await this.repoManager.getRepoAndPathOfFile(filePath.replace(/\\/g, '/'));
          if (found) {
            repo = found.repo;
            filePath = found.path;
          }
        }

        if (repo) {
          const textRes = await this.diffService.readRevisionText(repo, commit, filePath);
          const blame = params.includeBlame && (!commit || commit === '*')
            ? await this.diffService.loadFileBlame(repo, filePath)
            : null;
          return {
            repo,
            filePath,
            commit,
            content: textRes.content,
            isBinary: textRes.isBinary,
            error: textRes.error,
            blame
          };
        }

        // Standalone file outside registered repo (e.g. bisect log, or a file opened from a path browser).
        // Read at most MAX_STANDALONE_BYTES, and don't decode binary files.
        const MAX_STANDALONE_BYTES = 5 * 1024 * 1024;
        let buf: Buffer;
        let shownPath = filePath;
        if (isRemoteRepo(filePath)) {
          const parsed = parseRemoteRepo(filePath)!;
          shownPath = parsed.remotePath;
          buf = await sshManager.readRemoteFile(parsed.hostId, parsed.remotePath, MAX_STANDALONE_BYTES + 1);
        } else {
          const fh = await fs.promises.open(filePath, 'r');
          try {
            const chunk = Buffer.alloc(MAX_STANDALONE_BYTES + 1);
            const { bytesRead } = await fh.read(chunk, 0, chunk.length, 0);
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
          commit: null,
          content: isBinary ? '' : buf.subarray(0, MAX_STANDALONE_BYTES).toString('utf8'),
          isBinary,
          error: null,
          truncated,
          blame: null
        };
      }

      case 'file:blame': {
        const repo = String(params.repo || '');
        const filePath = String(params.filePath || '');
        const blame = await this.diffService.loadFileBlame(repo, filePath);
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
          }
        );
        return { session: info };
      }

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
        return { ...snapshot, presets: snapshot.presets.filter((p) => p.id !== AiProvider.VsCode), keys };
      }

      case 'ai:setApiKey': {
        const key = typeof params.key === 'string' ? params.key.trim() : '';
        if (!key) throw new Error('The API key can\'t be empty.');
        const stored = await setApiKey(key);
        if (!stored) throw new Error('Choose an AI provider that needs an API key first.');
        return { ok: true };
      }

      case 'ai:clearApiKey':
        await clearApiKey();
        return { ok: true };

      /* Settings & Logs */
      case 'settings:get':
        return { settings: getAllStandaloneSettings() };

      case 'settings:update': {
        const key = String(params.key || '');
        await updateStandaloneSetting(key, params.value);
        return { settings: getAllStandaloneSettings() };
      }

      case 'logs:get':
        return { logs: hostBridge.getLogs() };

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
    const entries = matched
      .filter((d) => showHidden || prefix.startsWith('.') || !d.name.startsWith('.'))
      .slice(0, 200)
      .map((d) => {
        const full = path.join(path.resolve(dir), d.name);
        let isDirectory = d.isDirectory();
        if (d.isSymbolicLink()) {
          try {
            isDirectory = fs.statSync(full).isDirectory();
          } catch (_) {}
        }
        return { name: d.name, path: getPathFromStr(full), isDirectory };
      })
      .sort((a, b) => (a.isDirectory !== b.isDirectory ? (a.isDirectory ? -1 : 1) : a.name.localeCompare(b.name)));
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
    const entries: RemoteDirectoryEntry[] = [];

    for (const d of dirents) {
      if (!showHidden && d.name.startsWith('.')) continue;
      const fullPath = path.join(resolved, d.name);
      let isDir = d.isDirectory();
      const isSym = d.isSymbolicLink();
      if (isSym) {
        try {
          isDir = (await fs.promises.stat(fullPath)).isDirectory();
        } catch (_) {
          isDir = false;
        }
      }
      let size = 0;
      let mtime = 0;
      try {
        const st = await fs.promises.stat(fullPath);
        size = st.isFile() ? st.size : 0;
        mtime = Math.floor(st.mtimeMs / 1000);
      } catch (_) {}
      let isGitRepo = false;
      let gitBranch: string | null = null;
      if (isDir) {
        const dotGit = path.join(fullPath, '.git');
        if (fs.existsSync(dotGit)) {
          isGitRepo = true;
          try {
            const headFile = fs.statSync(dotGit).isDirectory() ? path.join(dotGit, 'HEAD') : null;
            if (headFile && fs.existsSync(headFile)) {
              const headText = fs.readFileSync(headFile, 'utf8').trim();
              gitBranch = headText.startsWith('ref: refs/heads/') ? headText.substring(16) : headText.substring(0, 8);
            }
          } catch (_) {}
        }
      }
      entries.push({
        name: d.name,
        path: getPathFromStr(fullPath),
        isDirectory: isDir,
        isSymlink: isSym,
        isGitRepo,
        gitBranch,
        size,
        mtime
      });
    }

    entries.sort((a, b) => (a.isDirectory !== b.isDirectory ? (a.isDirectory ? -1 : 1) : a.name.localeCompare(b.name)));

    // Check if current folder itself is inside a git repo
    let currentRepoRoot: string | null = null;
    let currentRepoBranch: string | null = null;
    if (fs.existsSync(path.join(resolved, '.git'))) {
      currentRepoRoot = getPathFromStr(resolved);
      // Don't block the event loop (and every other client request) on a git process
      currentRepoBranch = await new Promise<string | null>((resolve) => {
        cp.execFile('git', ['-C', resolved, 'symbolic-ref', '-q', '--short', 'HEAD'], { encoding: 'utf8', timeout: 5000 }, (err, stdout) => {
          resolve(err ? null : String(stdout).trim() || null);
        });
      });
    }

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
}
