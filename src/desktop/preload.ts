import { contextBridge, ipcRenderer, webUtils } from 'electron';

contextBridge.exposeInMainWorld('gitMapDesktop', {
  isElectron: true,
  platform: process.platform,
  pickLocalFolder: (): Promise<string | null> => ipcRenderer.invoke('gitmap:pickLocalFolder'),
  pickLocalFile: (filters?: { name: string; extensions: string[] }[]): Promise<string | null> =>
    ipcRenderer.invoke('gitmap:pickLocalFile', filters),
  setNativeTheme: (theme: 'system' | 'dark' | 'light'): Promise<void> =>
    ipcRenderer.invoke('gitmap:setNativeTheme', theme),
  setAppIcon: (opts: { style: string; iconTheme: 'auto' | 'dark' | 'light'; uiTheme?: 'system' | 'dark' | 'light'; persist?: boolean }): Promise<void> =>
    ipcRenderer.invoke('gitmap:setAppIcon', opts),
  closeOrHideWindow: (): Promise<void> => ipcRenderer.invoke('gitmap:closeOrHideWindow'),
  onMenuAction: (callback: (action: string) => void) => {
    ipcRenderer.on('gitmap:menuAction', (_event, action: string) => callback(action));
  },
  onFullscreenChanged: (callback: (isFullScreen: boolean) => void) => {
    ipcRenderer.on('gitmap:fullscreenChanged', (_event, isFullScreen: boolean) => callback(isFullScreen));
  },
  onMainError: (callback: (message: string) => void) => {
    ipcRenderer.on('gitmap:mainError', (_event, message: string) => callback(message));
  },
  /** The local path of a file dropped onto the window (for drag & drop uploads). */
  getPathForFile: (file: File): string => {
    try {
      return webUtils.getPathForFile(file);
    } catch (_) {
      return '';
    }
  }
});
