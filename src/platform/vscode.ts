import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GitFileStatus } from '../types';
import { hostBridge } from './hostBridge';

function decodeDiffUri(uri: Uri): { filePath: string; commit: string; repo: string; exists: boolean } {
  return JSON.parse(Buffer.from(uri.query, 'base64').toString('utf8'));
}

declare global {
  type Thenable<T> = PromiseLike<T>;
}

export interface TerminalOptions {
  name?: string;
  shellPath?: string;
  shellArgs?: string[] | string;
  cwd?: string | Uri;
  env?: { [key: string]: string | null | undefined };
}

/* Core Types & Enums matching VS Code Extension API */

export interface Disposable {
  dispose(): any;
}

export type Event<T> = (listener: (e: T) => any, thisArgs?: any, disposables?: Disposable[]) => Disposable;

export class EventEmitter<T> {
  private listeners: Set<(e: T) => any> = new Set();

  public readonly event: Event<T> = (listener: (e: T) => any, thisArgs?: any, disposables?: Disposable[]) => {
    const wrapped = thisArgs ? listener.bind(thisArgs) : listener;
    this.listeners.add(wrapped);
    const disp: Disposable = {
      dispose: () => {
        this.listeners.delete(wrapped);
      }
    };
    if (Array.isArray(disposables)) {
      disposables.push(disp);
    }
    return disp;
  };

  public fire(data: T): void {
    for (const listener of Array.from(this.listeners)) {
      try {
        listener(data);
      } catch (_) {}
    }
  }

  public dispose(): void {
    this.listeners.clear();
  }
}

export interface CancellationToken {
  readonly isCancellationRequested: boolean;
  readonly onCancellationRequested: Event<any>;
}

export class CancellationTokenSource {
  private cancelled = false;
  private readonly emitter = new EventEmitter<void>();
  public readonly token: CancellationToken;

  constructor() {
    const self = this;
    this.token = {
      get isCancellationRequested() {
        return self.cancelled;
      },
      onCancellationRequested: this.emitter.event
    };
  }

  public cancel(): void {
    if (!this.cancelled) {
      this.cancelled = true;
      this.emitter.fire();
    }
  }

  public dispose(): void {
    this.emitter.dispose();
  }
}

export class Uri {
  public readonly scheme: string;
  public readonly authority: string;
  public readonly path: string;
  public readonly query: string;
  public readonly fragment: string;

  public constructor(scheme: string, authority: string = '', uriPath: string = '', query: string = '', fragment: string = '') {
    this.scheme = scheme;
    this.authority = authority;
    this.path = uriPath;
    this.query = query;
    this.fragment = fragment;
  }

  public get fsPath(): string {
    if (this.scheme === 'ssh') {
      return `ssh://${this.authority}${this.path}`;
    }
    if (process.platform === 'win32' && /^\/[a-zA-Z]:/.test(this.path)) {
      return this.path.substring(1).replace(/\//g, '\\');
    }
    return this.path;
  }

  public with(change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }): Uri {
    return new Uri(
      change.scheme !== undefined ? change.scheme : this.scheme,
      change.authority !== undefined ? change.authority : this.authority,
      change.path !== undefined ? change.path : this.path,
      change.query !== undefined ? change.query : this.query,
      change.fragment !== undefined ? change.fragment : this.fragment
    );
  }

  public toString(): string {
    const auth = this.authority ? `//${this.authority}` : this.scheme === 'file' ? '//' : '';
    const q = this.query ? `?${this.query}` : '';
    const f = this.fragment ? `#${this.fragment}` : '';
    return `${this.scheme}:${auth}${this.path}${q}${f}`;
  }

  public toJSON(): object {
    return {
      scheme: this.scheme,
      authority: this.authority,
      path: this.path,
      query: this.query,
      fragment: this.fragment,
      fsPath: this.fsPath
    };
  }

  public static file(filePath: string): Uri {
    if (filePath.startsWith('ssh://')) {
      return Uri.parse(filePath);
    }
    let normalised = filePath.replace(/\\/g, '/');
    if (process.platform === 'win32' && /^[a-zA-Z]:/.test(normalised)) {
      normalised = '/' + normalised;
    }
    return new Uri('file', '', normalised);
  }

  public static parse(value: string): Uri {
    const match = value.match(/^([a-zA-Z0-9+.-]+):(?:\/\/([^/?#]*))?([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/);
    if (!match) {
      return Uri.file(value);
    }
    return new Uri(
      match[1],
      match[2] || '',
      match[3] || '',
      match[4] ? decodeURIComponent(match[4]) : '',
      match[5] ? decodeURIComponent(match[5]) : ''
    );
  }
}

export class Position {
  constructor(public readonly line: number, public readonly character: number) {}
}

export class Range {
  public readonly start: Position;
  public readonly end: Position;
  constructor(startLine: number | Position, startChar: number | Position, endLine?: number, endChar?: number) {
    if (startLine instanceof Position && startChar instanceof Position) {
      this.start = startLine;
      this.end = startChar;
    } else {
      this.start = new Position(startLine as number, startChar as number);
      this.end = new Position(endLine || 0, endChar || 0);
    }
  }
}

export class Selection extends Range {
  public readonly anchor: Position;
  public readonly active: Position;
  constructor(anchorLine: number | Position, anchorChar: number | Position, activeLine?: number, activeChar?: number) {
    super(anchorLine as any, anchorChar as any, activeLine, activeChar);
    this.anchor = this.start;
    this.active = this.end;
  }
  get isEmpty(): boolean {
    return this.start.line === this.end.line && this.start.character === this.end.character;
  }
}

export class RelativePattern {
  public readonly baseUri: Uri;
  public readonly base: string;
  public readonly pattern: string;
  constructor(base: Uri | string, pattern: string) {
    this.baseUri = typeof base === 'string' ? Uri.file(base) : base;
    this.base = this.baseUri.fsPath;
    this.pattern = pattern;
  }
}

export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3
}

export enum ViewColumn {
  Active = -1,
  Beside = -2,
  One = 1,
  Two = 2,
  Three = 3,
  Four = 4,
  Five = 5,
  Six = 6,
  Seven = 7,
  Eight = 8,
  Nine = 9
}

export enum StatusBarAlignment {
  Left = 1,
  Right = 2
}

export enum ProgressLocation {
  SourceControl = 1,
  Window = 10,
  Notification = 15
}

export const version = '1.96.0';

/* Persistent Storage Implementations */

export interface Memento {
  keys(): readonly string[];
  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  update(key: string, value: any): Thenable<void>;
}

export class JsonFileMemento implements Memento {
  private data: { [key: string]: any } = {};

  constructor(private readonly filePath: string) {
    try {
      if (fs.existsSync(filePath)) {
        this.data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    } catch (_) {
      this.data = {};
    }
  }

  public keys(): readonly string[] {
    return Object.keys(this.data);
  }

  public get<T>(key: string, defaultValue?: T): T | undefined {
    return Object.prototype.hasOwnProperty.call(this.data, key) ? (this.data[key] as T) : defaultValue;
  }

  public async update(key: string, value: any): Promise<void> {
    if (value === undefined) {
      delete this.data[key];
    } else {
      this.data[key] = value;
    }
    try {
      await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
      await fs.promises.writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (_) {}
  }
}

export interface SecretStorageChangeEvent {
  readonly key: string;
}

export interface SecretStorage {
  get(key: string): Thenable<string | undefined>;
  store(key: string, value: string): Thenable<void>;
  delete(key: string): Thenable<void>;
  onDidChange: Event<SecretStorageChangeEvent>;
}

export class JsonSecretStorage implements SecretStorage {
  private secrets: { [key: string]: string } = {};
  private readonly emitter = new EventEmitter<SecretStorageChangeEvent>();
  public readonly onDidChange = this.emitter.event;

  constructor(private readonly filePath: string) {
    try {
      if (fs.existsSync(filePath)) {
        this.secrets = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    } catch (_) {
      this.secrets = {};
    }
  }

  public async get(key: string): Promise<string | undefined> {
    return this.secrets[key];
  }

  public async store(key: string, value: string): Promise<void> {
    this.secrets[key] = value;
    await this.persist();
    this.emitter.fire({ key });
  }

  public async delete(key: string): Promise<void> {
    delete this.secrets[key];
    await this.persist();
    this.emitter.fire({ key });
  }

  private async persist(): Promise<void> {
    try {
      await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
      await fs.promises.writeFile(this.filePath, JSON.stringify(this.secrets, null, 2), { encoding: 'utf8', mode: 0o600 });
    } catch (_) {}
  }
}

export interface ExtensionContext {
  readonly subscriptions: Disposable[];
  readonly workspaceState: Memento;
  readonly globalState: Memento;
  readonly secrets: SecretStorage;
  readonly extensionPath: string;
  readonly extensionUri: Uri;
  readonly globalStorageUri: Uri;
  readonly globalStoragePath: string;
  readonly logPath: string;
  readonly extension: { packageJSON: any };
  asAbsolutePath(relativePath: string): string;
}

/* Configuration System */

export interface ConfigurationChangeEvent {
  affectsConfiguration(section: string, scope?: Uri): boolean;
}

export interface WorkspaceConfiguration {
  get<T>(section: string): T | undefined;
  get<T>(section: string, defaultValue: T): T;
  has(section: string): boolean;
  inspect<T>(section: string): {
    key: string;
    defaultValue?: T;
    globalValue?: T;
    workspaceValue?: T;
    workspaceFolderValue?: T;
  } | undefined;
  update(section: string, value: any, configurationTarget?: ConfigurationTarget | boolean | null): Thenable<void>;
}

let settingsFilePath = path.join(os.homedir(), '.gitmap', 'settings.json');
let settingsData: { [fullKey: string]: any } = {
  'git-map.ai.provider': 'DeepSeek'
};
const configChangeEmitter = new EventEmitter<ConfigurationChangeEvent>();

export function initStandaloneConfig(dataDir: string, defaultLanguage?: string) {
  settingsFilePath = path.join(dataDir, 'settings.json');
  try {
    if (fs.existsSync(settingsFilePath)) {
      const loaded = JSON.parse(fs.readFileSync(settingsFilePath, 'utf8'));
      if (loaded && typeof loaded === 'object') {
        settingsData = Object.assign({ 'git-map.ai.provider': 'DeepSeek' }, loaded);
      }
    }
  } catch (_) {}
  if (defaultLanguage) {
    env.language = defaultLanguage;
  }
}

export function getAllStandaloneSettings(): { [key: string]: any } {
  return Object.assign({}, settingsData);
}

export async function updateStandaloneSetting(fullKey: string, value: any): Promise<void> {
  if (value === undefined) {
    delete settingsData[fullKey];
  } else {
    settingsData[fullKey] = value;
  }
  try {
    await fs.promises.mkdir(path.dirname(settingsFilePath), { recursive: true });
    await fs.promises.writeFile(settingsFilePath, JSON.stringify(settingsData, null, 2), 'utf8');
  } catch (_) {}
  configChangeEmitter.fire({
    affectsConfiguration(section: string) {
      return fullKey === section || fullKey.startsWith(section + '.') || section.startsWith(fullKey + '.');
    }
  });
}

function getNestedOrFlatValue(prefix: string, section: string): any {
  const fullKey = prefix ? `${prefix}.${section}` : section;
  if (Object.prototype.hasOwnProperty.call(settingsData, fullKey)) {
    return settingsData[fullKey];
  }
  // Check if sub-keys exist (e.g. contextMenuActionsVisibility)
  const subPrefix = fullKey + '.';
  let result: any = undefined;
  for (const key of Object.keys(settingsData)) {
    if (key.startsWith(subPrefix)) {
      if (result === undefined) result = {};
      const parts = key.substring(subPrefix.length).split('.');
      let cur = result;
      for (let i = 0; i < parts.length - 1; i++) {
        if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = settingsData[key];
    }
  }
  return result;
}

/* FileSystemWatcher */

export interface FileSystemWatcher extends Disposable {
  readonly onDidCreate: Event<Uri>;
  readonly onDidChange: Event<Uri>;
  readonly onDidDelete: Event<Uri>;
}

function createRealFileSystemWatcher(globPattern: string | RelativePattern): FileSystemWatcher {
  const createEmitter = new EventEmitter<Uri>();
  const changeEmitter = new EventEmitter<Uri>();
  const deleteEmitter = new EventEmitter<Uri>();
  let fsWatcher: fs.FSWatcher | null = null;

  let watchRoot: string | null = null;
  if (typeof globPattern === 'string') {
    if (!globPattern.startsWith('**') && !globPattern.startsWith('ssh://')) {
      const wildcardIdx = globPattern.search(/[*?{]/);
      const rawRoot = wildcardIdx > -1 ? globPattern.substring(0, wildcardIdx) : globPattern;
      watchRoot = rawRoot.replace(/\/+$/, '') || '/';
    }
  } else if (globPattern instanceof RelativePattern) {
    if (!globPattern.base.startsWith('ssh://')) {
      watchRoot = globPattern.base;
    }
  }

  if (watchRoot && fs.existsSync(watchRoot)) {
    try {
      const recursive = process.platform === 'darwin' || process.platform === 'win32';
      fsWatcher = fs.watch(watchRoot, { recursive }, (eventType, filename) => {
        if (!filename) return;
        const fullPath = path.join(watchRoot!, filename.toString());
        const uri = Uri.file(fullPath);
        if (eventType === 'rename') {
          if (fs.existsSync(fullPath)) {
            createEmitter.fire(uri);
          } else {
            deleteEmitter.fire(uri);
          }
        } else {
          changeEmitter.fire(uri);
        }
      });
      fsWatcher.on('error', () => {});
    } catch (_) {}
  }

  return {
    onDidCreate: createEmitter.event,
    onDidChange: changeEmitter.event,
    onDidDelete: deleteEmitter.event,
    dispose() {
      if (fsWatcher) {
        try {
          fsWatcher.close();
        } catch (_) {}
        fsWatcher = null;
      }
      createEmitter.dispose();
      changeEmitter.dispose();
      deleteEmitter.dispose();
    }
  };
}

/* WebviewPanel Implementation */

export interface WebviewOptions {
  readonly enableScripts?: boolean;
  readonly localResourceRoots?: ReadonlyArray<Uri>;
}

export interface WebviewPanelOptions {
  readonly retainContextWhenHidden?: boolean;
}

export interface Webview {
  html: string;
  options: WebviewOptions;
  readonly cspSource: string;
  onDidReceiveMessage: Event<any>;
  postMessage(message: any): Thenable<boolean>;
  asWebviewUri(localResource: Uri): Uri;
}

export interface WebviewPanelOnDidChangeViewStateEvent {
  readonly webviewPanel: WebviewPanel;
}

export interface WebviewPanel extends Disposable {
  readonly viewType: string;
  title: string;
  iconPath?: Uri | { light: Uri; dark: Uri };
  readonly webview: Webview;
  readonly options: WebviewPanelOptions;
  readonly viewColumn?: ViewColumn;
  readonly active: boolean;
  readonly visible: boolean;
  readonly onDidDispose: Event<void>;
  readonly onDidChangeViewState: Event<WebviewPanelOnDidChangeViewStateEvent>;
  reveal(viewColumn?: ViewColumn, preserveFocus?: boolean): void;
}

class StandaloneWebviewPanel implements WebviewPanel {
  public readonly viewType: string;
  public title: string;
  public iconPath?: Uri | { light: Uri; dark: Uri };
  public readonly options: WebviewPanelOptions;
  public viewColumn?: ViewColumn;
  public active: boolean = true;
  public visible: boolean = true;
  public readonly panelId: string;

  private _html: string = '';
  private disposed = false;
  private readonly disposeEmitter = new EventEmitter<void>();
  private readonly viewStateEmitter = new EventEmitter<WebviewPanelOnDidChangeViewStateEvent>();
  private readonly messageEmitter = new EventEmitter<any>();

  public readonly onDidDispose = this.disposeEmitter.event;
  public readonly onDidChangeViewState = this.viewStateEmitter.event;
  public readonly webview: Webview;

  constructor(viewType: string, title: string, viewColumn: ViewColumn | undefined, options: WebviewPanelOptions & WebviewOptions) {
    this.viewType = viewType;
    this.title = title;
    this.viewColumn = viewColumn;
    this.options = options;
    this.panelId = `${viewType}-${Date.now()}`;

    const self = this;
    this.webview = {
      options: options,
      cspSource: "'self' http: https: ws: wss:",
      get html() {
        return self._html;
      },
      set html(val: string) {
        self._html = val;
        if (self.viewType === 'git-map') {
          hostBridge.setGraphHtml(val);
        } else {
          // Auxiliary panels (Visual File History, File Time Machine, ...) are shown in their own workspace tab
          hostBridge.getHandlers().onVisualFileHistoryUpdated?.({
            title: self.title,
            html: val,
            panelId: self.panelId
          });
        }
      },
      onDidReceiveMessage: self.messageEmitter.event,
      postMessage(message: any): Thenable<boolean> {
        if (self.disposed) return Promise.resolve(false);
        if (self.viewType === 'git-map') {
          hostBridge.getHandlers().onGraphPostMessage?.(message);
        } else {
          hostBridge.getHandlers().onPanelPostMessage?.(self.panelId, message);
        }
        return Promise.resolve(true);
      },
      asWebviewUri(localResource: Uri): Uri {
        const fsP = localResource.fsPath.replace(/\\/g, '/');
        const mediaMatch = fsP.match(/\/media\/([^/]+)$/);
        if (mediaMatch) {
          return Uri.parse(`http://gitmap.local/media/${mediaMatch[1]}`);
        }
        const resMatch = fsP.match(/\/resources\/([^/]+)$/);
        if (resMatch) {
          return Uri.parse(`http://gitmap.local/resources/${resMatch[1]}`);
        }
        return localResource;
      }
    };
  }

  public receiveFromClient(msg: any) {
    if (!this.disposed) {
      this.messageEmitter.fire(msg);
    }
  }

  public reveal(viewColumn?: ViewColumn): void {
    this.viewColumn = viewColumn || this.viewColumn;
    this.active = true;
    if (!this.visible) {
      this.visible = true;
      this.viewStateEmitter.fire({ webviewPanel: this });
    } else if (this.viewType !== 'git-map' && this._html) {
      hostBridge.getHandlers().onVisualFileHistoryUpdated?.({
        title: this.title,
        html: this._html,
        panelId: this.panelId
      });
    }
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    activePanels.delete(this.panelId);
    if (activeGitMapPanel === this) {
      activeGitMapPanel = null;
    }
    this.disposeEmitter.fire();
    this.disposeEmitter.dispose();
    this.viewStateEmitter.dispose();
    this.messageEmitter.dispose();
  }
}

let activeGitMapPanel: StandaloneWebviewPanel | null = null;
const activePanels = new Map<string, StandaloneWebviewPanel>();

export function dispatchMessageToGitMapPanel(msg: any): void {
  activeGitMapPanel?.receiveFromClient(msg);
}

export function dispatchMessageToPanel(panelId: string, msg: any): void {
  activePanels.get(panelId)?.receiveFromClient(msg);
}

/* Commands Registry */

const registeredCommands = new Map<string, (...args: any[]) => any>();

function extractLineRange(options?: any): { start: number; end: number } | null {
  if (options && options.selection) {
    const sel = options.selection;
    const startLine = (sel.start?.line ?? sel.anchor?.line ?? 0) + 1;
    const endLine = (sel.end?.line ?? sel.active?.line ?? startLine - 1) + 1;
    return { start: startLine, end: Math.max(startLine, endLine) };
  }
  return null;
}

export const commands = {
  registerCommand(command: string, callback: (...args: any[]) => any): Disposable {
    registeredCommands.set(command, callback);
    return {
      dispose: () => {
        if (registeredCommands.get(command) === callback) {
          registeredCommands.delete(command);
        }
      }
    };
  },
  async executeCommand<T = any>(command: string, ...rest: any[]): Promise<T | undefined> {
    if (registeredCommands.has(command)) {
      return await registeredCommands.get(command)!(...rest);
    }
    if (command === 'setContext') {
      return undefined;
    }
    if (command === 'workbench.action.openSettings') {
      hostBridge.getHandlers().onOpenSettingsUi?.(typeof rest[0] === 'string' ? rest[0] : undefined);
      return undefined;
    }
    if (command === 'vscode.diff') {
      const [leftUri, rightUri, title, options] = rest as [Uri, Uri, string, any];
      const leftData = leftUri.scheme === 'git-map'
        ? decodeDiffUri(leftUri)
        : { repo: '', filePath: leftUri.fsPath, commit: '*', exists: true };
      let rightData: { repo: string; filePath: string; commit: string; exists: boolean };
      if (rightUri.scheme === 'git-map') {
        rightData = decodeDiffUri(rightUri);
      } else {
        const rightFs = rightUri.fsPath.replace(/\\/g, '/');
        const repoPrefix = leftData.repo ? leftData.repo.replace(/\/+$/, '') + '/' : '';
        const relRight = repoPrefix && rightFs.startsWith(repoPrefix) ? rightFs.substring(repoPrefix.length) : leftData.filePath;
        rightData = { repo: leftData.repo, filePath: relRight, commit: '*', exists: true };
      }
      const repo = leftData.repo || rightData.repo;
      const statusType = !leftData.exists
        ? GitFileStatus.Added
        : !rightData.exists
          ? GitFileStatus.Deleted
          : leftData.filePath !== rightData.filePath
            ? GitFileStatus.Renamed
            : GitFileStatus.Modified;
      const hideUnchanged = !!workspace.getConfiguration('git-map').get<boolean>('diff.hideUnchangedRegions', false);
      hostBridge.getHandlers().onOpenDiff?.({
        repo,
        title: title || rightData.filePath,
        fromHash: leftData.commit,
        toHash: rightData.commit,
        oldFilePath: leftData.filePath,
        newFilePath: rightData.filePath,
        type: statusType,
        lines: extractLineRange(options),
        hideUnchangedRegions: hideUnchanged
      });
      return undefined;
    }
    if (command === 'vscode.changes') {
      const [title, resources] = rest as [string, [Uri, Uri, Uri][]];
      const files = resources.map(([, leftUri, rightUri]) => {
        const leftData = leftUri.scheme === 'git-map'
          ? decodeDiffUri(leftUri)
          : { repo: '', filePath: leftUri.fsPath, commit: '*', exists: true };
        let rightData: { repo: string; filePath: string; commit: string; exists: boolean };
        if (rightUri.scheme === 'git-map') {
          rightData = decodeDiffUri(rightUri);
        } else {
          const rightFs = rightUri.fsPath.replace(/\\/g, '/');
          const repoPrefix = leftData.repo ? leftData.repo.replace(/\/+$/, '') + '/' : '';
          const relRight = repoPrefix && rightFs.startsWith(repoPrefix) ? rightFs.substring(repoPrefix.length) : leftData.filePath;
          rightData = { repo: leftData.repo, filePath: relRight, commit: '*', exists: true };
        }
        const statusType = !leftData.exists
          ? GitFileStatus.Added
          : !rightData.exists
            ? GitFileStatus.Deleted
            : leftData.filePath !== rightData.filePath
              ? GitFileStatus.Renamed
              : GitFileStatus.Modified;
        return {
          repo: leftData.repo || rightData.repo,
          fromHash: leftData.commit,
          toHash: rightData.commit,
          oldFilePath: leftData.filePath,
          newFilePath: rightData.filePath,
          type: statusType
        };
      });
      const hideUnchanged = !!workspace.getConfiguration('git-map').get<boolean>('diff.hideUnchangedRegions', false);
      hostBridge.getHandlers().onOpenMultiDiff?.({
        title: title || 'Changes',
        files,
        hideUnchangedRegions: hideUnchanged
      });
      return undefined;
    }
    if (command === 'vscode.open') {
      const [uri, options] = rest as [Uri, any];
      if (uri.scheme === 'git-map') {
        const data = decodeDiffUri(uri);
        hostBridge.getHandlers().onOpenFile?.({
          repo: data.repo,
          filePath: data.filePath,
          commit: data.commit,
          title: `${path.posix.basename(data.filePath)} (${data.commit.substring(0, 8)})`,
          lines: extractLineRange(options)
        });
      } else {
        const fsP = uri.fsPath;
        hostBridge.getHandlers().onOpenFile?.({
          repo: '',
          filePath: fsP,
          commit: null,
          title: path.basename(fsP),
          lines: extractLineRange(options)
        });
      }
      return undefined;
    }
    return undefined;
  }
};

/* Workspace Namespace */

export interface WorkspaceFolder {
  readonly uri: Uri;
  readonly name: string;
  readonly index: number;
}

export interface WorkspaceFoldersChangeEvent {
  readonly added: ReadonlyArray<WorkspaceFolder>;
  readonly removed: ReadonlyArray<WorkspaceFolder>;
}

const workspaceFoldersEmitter = new EventEmitter<WorkspaceFoldersChangeEvent>();
const closeTextDocEmitter = new EventEmitter<any>();

export interface TextDocumentContentProvider {
  onDidChange?: Event<Uri>;
  provideTextDocumentContent(uri: Uri, token?: CancellationToken): string | Thenable<string>;
}

const contentProviders = new Map<string, TextDocumentContentProvider>();

export const workspace = {
  workspaceFolders: [] as WorkspaceFolder[],
  onDidChangeConfiguration: configChangeEmitter.event,
  onDidChangeWorkspaceFolders: workspaceFoldersEmitter.event,
  onDidCloseTextDocument: closeTextDocEmitter.event,

  setWorkspaceFolders(pathsList: string[]) {
    const prev = workspace.workspaceFolders.slice();
    const next: WorkspaceFolder[] = pathsList.map((p, idx) => ({
      uri: Uri.file(p),
      name: path.basename(p),
      index: idx
    }));
    workspace.workspaceFolders = next;
    const prevSet = new Set(prev.map((f) => f.uri.toString()));
    const nextSet = new Set(next.map((f) => f.uri.toString()));
    const added = next.filter((f) => !prevSet.has(f.uri.toString()));
    const removed = prev.filter((f) => !nextSet.has(f.uri.toString()));
    if (added.length > 0 || removed.length > 0) {
      workspaceFoldersEmitter.fire({ added, removed });
    }
  },

  getConfiguration(section?: string, _scope?: Uri | null): WorkspaceConfiguration {
    const prefix = section || '';
    return {
      get<T>(key: string, defaultValue?: T): T {
        const val = getNestedOrFlatValue(prefix, key);
        return val !== undefined ? (val as T) : (defaultValue as T);
      },
      has(key: string): boolean {
        return getNestedOrFlatValue(prefix, key) !== undefined;
      },
      inspect<T>(key: string) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const val = getNestedOrFlatValue(prefix, key) as T | undefined;
        return {
          key: fullKey,
          globalValue: val,
          workspaceValue: undefined,
          workspaceFolderValue: undefined
        };
      },
      async update(key: string, value: any): Promise<void> {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        await updateStandaloneSetting(fullKey, value);
      }
    };
  },

  createFileSystemWatcher(globPattern: string | RelativePattern): FileSystemWatcher {
    return createRealFileSystemWatcher(globPattern);
  },

  registerTextDocumentContentProvider(scheme: string, provider: TextDocumentContentProvider): Disposable {
    contentProviders.set(scheme, provider);
    return {
      dispose: () => {
        contentProviders.delete(scheme);
      }
    };
  },

  async openTextDocument(optionsOrUri: Uri | { language?: string; content?: string }): Promise<any> {
    if (optionsOrUri instanceof Uri) {
      return { uri: optionsOrUri, getText: () => '' };
    }
    return {
      uri: Uri.parse(`untitled:Summary.md`),
      languageId: optionsOrUri.language || 'plaintext',
      content: optionsOrUri.content || '',
      getText: () => optionsOrUri.content || ''
    };
  }
};

/* Window Namespace */

export interface OutputChannel extends Disposable {
  readonly name: string;
  appendLine(value: string): void;
  show(): void;
}

export interface QuickPickItem {
  label: string;
  description?: string;
  detail?: string;
  picked?: boolean;
  alwaysShow?: boolean;
}

function parseModalAndActions(items: any[]): { modal: boolean; detail?: string; actions: string[] } {
  let modal = false;
  let detail: string | undefined;
  const actions: string[] = [];
  for (const item of items) {
    if (typeof item === 'string') {
      actions.push(item);
    } else if (item && typeof item === 'object') {
      if (item.modal) modal = true;
      if (typeof item.detail === 'string') detail = item.detail;
      if (typeof item.title === 'string') actions.push(item.title);
    }
  }
  return { modal, detail, actions };
}

function showQuickPick<T extends QuickPickItem>(
  items: ReadonlyArray<T> | Thenable<ReadonlyArray<T>>,
  options: { placeHolder?: string; canPickMany: true; ignoreFocusOut?: boolean; matchOnDescription?: boolean; matchOnDetail?: boolean }
): Promise<T[] | undefined>;
function showQuickPick<T extends QuickPickItem>(
  items: ReadonlyArray<T> | Thenable<ReadonlyArray<T>>,
  options?: { placeHolder?: string; canPickMany?: false; ignoreFocusOut?: boolean; matchOnDescription?: boolean; matchOnDetail?: boolean }
): Promise<T | undefined>;
async function showQuickPick<T extends QuickPickItem>(
  itemsOrPromise: ReadonlyArray<T> | Thenable<ReadonlyArray<T>>,
  options?: { placeHolder?: string; canPickMany?: boolean; ignoreFocusOut?: boolean; matchOnDescription?: boolean; matchOnDetail?: boolean }
): Promise<any> {
  const items = await itemsOrPromise;
  const indices = await hostBridge.getHandlers().onQuickPick?.({
    placeHolder: options?.placeHolder,
    canPickMany: options?.canPickMany,
    items: items.map((it) => ({
      label: it.label,
      description: it.description,
      detail: it.detail,
      picked: it.picked
    }))
  });
  if (!indices || indices.length === 0) return undefined;
  if (options?.canPickMany) {
    return indices.map((i) => items[i]).filter(Boolean);
  }
  return items[indices[0]];
}

/* Editor Tabs (GitMap has no VS Code editor tabs: these exist so code shared with vscode-git-map compiles unchanged) */

export class TabInputText {
  constructor(public readonly uri: Uri) {}
}

export class TabInputTextDiff {
  constructor(public readonly original: Uri, public readonly modified: Uri) {}
}

export interface Tab {
  readonly label: string;
  readonly input: unknown;
}

export interface TabGroup {
  readonly activeTab: Tab | undefined;
  readonly tabs: ReadonlyArray<Tab>;
}

export const window = {
  activeTextEditor: undefined as any,
  tabGroups: {
    activeTabGroup: { activeTab: undefined, tabs: [] } as TabGroup,
    all: [] as ReadonlyArray<TabGroup>
  },

  createOutputChannel(name: string): OutputChannel {
    return {
      name,
      appendLine(value: string) {
        hostBridge.appendLog(value);
      },
      show() {},
      dispose() {}
    };
  },

  createWebviewPanel(
    viewType: string,
    title: string,
    showOptions: ViewColumn | { viewColumn: ViewColumn; preserveFocus?: boolean },
    options?: WebviewPanelOptions & WebviewOptions
  ): WebviewPanel {
    const col = typeof showOptions === 'number' ? showOptions : showOptions?.viewColumn;
    const panel = new StandaloneWebviewPanel(viewType, title, col, options || {});
    activePanels.set(panel.panelId, panel);
    if (viewType === 'git-map') {
      activeGitMapPanel = panel;
    }
    return panel;
  },

  createTerminal(options?: string | TerminalOptions): any {
    const name = typeof options === 'string' ? options : options?.name || 'Git Terminal';
    const rawCwd = typeof options === 'object' && options?.cwd ? options.cwd : '';
    const cwd = rawCwd instanceof Uri ? rawCwd.fsPath : (rawCwd || '');
    let pendingCmd: string | null = null;
    return {
      sendText(text: string) {
        pendingCmd = text;
      },
      show() {
        hostBridge.getHandlers().onOpenTerminal?.({
          repo: cwd,
          name,
          initialCommand: pendingCmd
        });
      },
      dispose() {}
    };
  },

  setStatusBarMessage(text: string, _hideAfterTimeout?: number): Disposable {
    hostBridge.getHandlers().onToast?.({
      level: 'status',
      message: text.replace(/\$\([a-z-]+\)\s*/gi, '')
    });
    return { dispose: () => {} };
  },

  async showInformationMessage(message: string, ...items: any[]): Promise<any> {
    const { modal, detail, actions } = parseModalAndActions(items);
    const chosen = await hostBridge.getHandlers().onToast?.({ level: 'info', message, detail, modal, actions });
    for (const item of items) {
      if (item && typeof item === 'object' && item.title === chosen) return item;
    }
    return chosen;
  },

  async showWarningMessage(message: string, ...items: any[]): Promise<any> {
    const { modal, detail, actions } = parseModalAndActions(items);
    const chosen = await hostBridge.getHandlers().onToast?.({ level: 'warning', message, detail, modal, actions });
    for (const item of items) {
      if (item && typeof item === 'object' && item.title === chosen) return item;
    }
    return chosen;
  },

  async showErrorMessage(message: string, ...items: any[]): Promise<any> {
    const { modal, detail, actions } = parseModalAndActions(items);
    const chosen = await hostBridge.getHandlers().onToast?.({ level: 'error', message, detail, modal, actions });
    for (const item of items) {
      if (item && typeof item === 'object' && item.title === chosen) return item;
    }
    return chosen;
  },

  async showInputBox(options?: {
    title?: string;
    prompt?: string;
    placeHolder?: string;
    value?: string;
    password?: boolean;
    ignoreFocusOut?: boolean;
    validateInput?: (value: string) => string | undefined | null | Thenable<string | undefined | null>;
  }): Promise<string | undefined> {
    const result = await hostBridge.getHandlers().onInputBox?.({
      title: options?.title,
      prompt: options?.prompt,
      placeHolder: options?.placeHolder,
      value: options?.value,
      password: options?.password
    });
    if (result !== undefined && options?.validateInput) {
      const validationErr = await options.validateInput(result);
      if (validationErr) {
        await window.showErrorMessage(validationErr);
        return undefined;
      }
    }
    return result;
  },

  showQuickPick,

  async showOpenDialog(options?: {
    defaultUri?: Uri;
    canSelectFiles?: boolean;
    canSelectFolders?: boolean;
    canSelectMany?: boolean;
    openLabel?: string;
    filters?: { [name: string]: string[] };
  }): Promise<Uri[] | undefined> {
    const selected = await hostBridge.getHandlers().onOpenDialog?.({
      defaultPath: options?.defaultUri?.fsPath,
      canSelectFiles: options?.canSelectFiles,
      canSelectFolders: options?.canSelectFolders,
      canSelectMany: options?.canSelectMany,
      openLabel: options?.openLabel,
      filters: options?.filters
    });
    if (!selected || selected.length === 0) return undefined;
    return selected.map((p) => Uri.file(p));
  },

  async showSaveDialog(options?: {
    defaultUri?: Uri;
    saveLabel?: string;
    filters?: { [name: string]: string[] };
  }): Promise<Uri | undefined> {
    const selected = await hostBridge.getHandlers().onSaveDialog?.({
      defaultPath: options?.defaultUri?.fsPath,
      saveLabel: options?.saveLabel,
      filters: options?.filters
    });
    if (!selected) return undefined;
    return Uri.file(selected);
  },

  async showTextDocument(docOrUri: any, _options?: any): Promise<any> {
    if (docOrUri instanceof Uri) {
      const fsP = docOrUri.fsPath;
      hostBridge.getHandlers().onOpenFile?.({
        repo: '',
        filePath: fsP,
        commit: null,
        title: path.basename(fsP),
        lines: null
      });
    } else if (docOrUri && typeof docOrUri.content === 'string') {
      hostBridge.getHandlers().onOpenFile?.({
        repo: '',
        filePath: 'Summary.md',
        commit: null,
        title: 'History Summary',
        lines: null,
        language: docOrUri.languageId || 'markdown',
        inlineContent: docOrUri.content
      });
    }
    return {};
  },

  async withProgress<R>(
    options: { location: ProgressLocation; title?: string; cancellable?: boolean },
    task: (progress: { report(value: { message?: string; increment?: number }): void }, token: CancellationToken) => Thenable<R>
  ): Promise<R> {
    const cts = new CancellationTokenSource();
    if (options.title) {
      window.setStatusBarMessage(options.title);
    }
    try {
      return await task(
        {
          report(val) {
            if (val.message) {
              window.setStatusBarMessage((options.title ? options.title + ': ' : '') + val.message);
            }
          }
        },
        cts.token
      );
    } finally {
      cts.dispose();
    }
  }
};

/* Env & Extensions Namespaces */

export const env = {
  language: Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase(),
  clipboard: {
    async writeText(text: string): Promise<void> {
      const handler = hostBridge.getHandlers().onClipboardWrite;
      if (handler) {
        const ok = await handler(text);
        if (ok) return;
      }
      throw new Error('Clipboard unavailable');
    }
  },
  async openExternal(target: Uri): Promise<boolean> {
    const handler = hostBridge.getHandlers().onOpenExternal;
    if (handler) {
      return await handler(target.toString());
    }
    return false;
  }
};

export const extensions = {
  all: [] as any[],
  getExtension(_id: string): any {
    return undefined;
  }
};
