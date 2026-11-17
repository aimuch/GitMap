import * as cp from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { WebSocket, WebSocketServer } from 'ws';
import { clearApiKey, setAiSecretStorage, setApiKey } from '../aiProviders';
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
import { RemoteDirectoryEntry, sshManager } from '../remote/sshManager';
import { RemoveFromHistory } from '../removeFromHistory';
import { RepoManager } from '../repoManager';
import { findGit, getPathFromStr, getRepoName, GitExecutable } from '../utils';
import { EventEmitter as GitMapEventEmitter } from '../utils/event';
import { VisualFileHistory } from '../visualFileHistory';
import { DiffService } from './diffService';
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
    this.server = http.createServer((req, res) => this.handleHttpRequest(req, res));
    this.wss = new WebSocketServer({ server: this.server, path: '/ws' });
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

        // Standalone file outside registered repo (e.g. bisect log)
        if (isRemoteRepo(filePath)) {
          const parsed = parseRemoteRepo(filePath)!;
          const buf = await sshManager.readRemoteFile(parsed.hostId, parsed.remotePath);
          return { repo: '', filePath: parsed.remotePath, commit: null, content: buf.toString('utf8'), isBinary: false, error: null, blame: null };
        }
        const content = await fs.promises.readFile(filePath, 'utf8');
        return { repo: '', filePath, commit: null, content, isBinary: false, error: null, blame: null };
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
        const repo = String(params.repo || this.extensionState.getLastActiveRepo() || os.homedir());
        const err = this.terminalManager.openExternalSystemTerminal(repo);
        if (err) throw new Error(err);
        return { ok: true };
      }

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
        size: 0,
        mtime: 0
      });
    }

    entries.sort((a, b) => (a.isDirectory !== b.isDirectory ? (a.isDirectory ? -1 : 1) : a.name.localeCompare(b.name)));

    // Check if current folder itself is inside a git repo
    let currentRepoRoot: string | null = null;
    let currentRepoBranch: string | null = null;
    if (fs.existsSync(path.join(resolved, '.git'))) {
      currentRepoRoot = getPathFromStr(resolved);
      try {
        const out = cp.execFileSync('git', ['-C', resolved, 'symbolic-ref', '-q', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
        currentRepoBranch = out || null;
      } catch (_) {}
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
