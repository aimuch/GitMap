import { contextBridge, ipcRenderer, webUtils } from 'electron';

contextBridge.exposeInMainWorld('gitMapDesktop', {
  isElectron: true,
  platform: process.platform,
  pickLocalFolder: (): Promise<string | null> => ipcRenderer.invoke('gitmap:pickLocalFolder'),
  pickLocalFile: (filters?: { name: string; extensions: string[] }[]): Promise<string | null> =>
    ipcRenderer.invoke('gitmap:pickLocalFile', filters),
  onMenuAction: (callback: (action: string) => void) => {
    ipcRenderer.on('gitmap:menuAction', (_event, action: string) => callback(action));
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
