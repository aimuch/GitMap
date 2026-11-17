import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('gitMapDesktop', {
  isElectron: true,
  platform: process.platform,
  pickLocalFolder: (): Promise<string | null> => ipcRenderer.invoke('gitmap:pickLocalFolder'),
  pickLocalFile: (filters?: { name: string; extensions: string[] }[]): Promise<string | null> =>
    ipcRenderer.invoke('gitmap:pickLocalFile', filters),
  onMenuAction: (callback: (action: string) => void) => {
    ipcRenderer.on('gitmap:menuAction', (_event, action: string) => callback(action));
  }
});
