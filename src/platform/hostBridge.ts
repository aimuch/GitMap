import { GitFileStatus, GitLineRange } from '../types';

export interface DiffOpenPayload {
  repo: string;
  title: string;
  fromHash: string;
  toHash: string;
  oldFilePath: string;
  newFilePath: string;
  type: GitFileStatus;
  lines: GitLineRange | null;
  hideUnchangedRegions: boolean;
}

export interface MultiDiffFileItem {
  repo: string;
  fromHash: string;
  toHash: string;
  oldFilePath: string;
  newFilePath: string;
  type: GitFileStatus;
}

export interface MultiDiffOpenPayload {
  title: string;
  files: MultiDiffFileItem[];
  hideUnchangedRegions: boolean;
}

export interface FileOpenPayload {
  repo: string;
  filePath: string;
  commit: string | null;
  title: string;
  lines: GitLineRange | null;
  language?: string;
  inlineContent?: string;
}

export interface VisualFileHistoryOpenPayload {
  title: string;
  html: string;
  panelId: string;
  viewType?: string;
}

export interface TerminalOpenPayload {
  repo: string;
  name: string;
  initialCommand?: string | null;
  shellPath?: string | null;
}

export interface ToastPayload {
  level: 'info' | 'warning' | 'error' | 'status';
  message: string;
  detail?: string;
  modal?: boolean;
  actions?: string[];
}

export interface InputBoxRequest {
  title?: string;
  prompt?: string;
  placeHolder?: string;
  value?: string;
  password?: boolean;
}

export interface QuickPickItemData {
  label: string;
  description?: string;
  detail?: string;
  picked?: boolean;
}

export interface QuickPickRequest {
  placeHolder?: string;
  canPickMany?: boolean;
  items: QuickPickItemData[];
}

export interface OpenDialogRequest {
  canSelectFiles?: boolean;
  canSelectFolders?: boolean;
  canSelectMany?: boolean;
  defaultPath?: string;
  openLabel?: string;
  filters?: { [name: string]: string[] };
}

export interface SaveDialogRequest {
  defaultPath?: string;
  saveLabel?: string;
  filters?: { [name: string]: string[] };
}

export interface HostBridgeHandlers {
  onGraphHtmlUpdated?: (html: string) => void;
  onGraphPostMessage?: (msg: unknown) => void;
  onPanelPostMessage?: (panelId: string, msg: unknown) => void;
  onVisualFileHistoryUpdated?: (payload: VisualFileHistoryOpenPayload) => void;
  onOpenDiff?: (payload: DiffOpenPayload) => void;
  onOpenMultiDiff?: (payload: MultiDiffOpenPayload) => void;
  onOpenFile?: (payload: FileOpenPayload) => void;
  onOpenTerminal?: (payload: TerminalOpenPayload) => void;
  onOpenSettingsUi?: (query?: string) => void;
  onOpenScm?: (draftMessage?: string) => void;
  onSettingsChanged?: (settings: { [key: string]: any }) => void;
  onClipboardWrite?: (text: string) => Promise<boolean>;
  onOpenExternal?: (url: string) => Promise<boolean>;
  onToast?: (payload: ToastPayload) => Promise<string | undefined>;
  onInputBox?: (req: InputBoxRequest) => Promise<string | undefined>;
  onQuickPick?: (req: QuickPickRequest) => Promise<number[] | undefined>;
  onOpenDialog?: (req: OpenDialogRequest) => Promise<string[] | undefined>;
  onSaveDialog?: (req: SaveDialogRequest) => Promise<string | undefined>;
  onLog?: (line: string) => void;
}

class HostBridgeRegistry {
  private handlers: HostBridgeHandlers = {};
  private latestGraphHtml: string = '';
  private logBuffer: string[] = [];

  public setHandlers(handlers: HostBridgeHandlers) {
    this.handlers = handlers;
  }

  public getHandlers(): HostBridgeHandlers {
    return this.handlers;
  }

  public setGraphHtml(html: string) {
    this.latestGraphHtml = html;
    this.handlers.onGraphHtmlUpdated?.(html);
  }

  public getGraphHtml(): string {
    return this.latestGraphHtml;
  }

  public appendLog(line: string) {
    this.logBuffer.push(line);
    if (this.logBuffer.length > 1000) {
      this.logBuffer.splice(0, this.logBuffer.length - 1000);
    }
    this.handlers.onLog?.(line);
  }

  public getLogs(): ReadonlyArray<string> {
    return this.logBuffer;
  }
}

export const hostBridge = new HostBridgeRegistry();
