import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, shell } from 'electron';
import * as path from 'path';
import { GitMapServer } from '../server/appServer';

let mainWindow: BrowserWindow | null = null;
let gitMapServer: GitMapServer | null = null;

async function createWindow(serverUrl: string) {
  const iconPath = path.resolve(__dirname, '..', '..', 'resources', 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 620,
    title: 'GitMap',
    icon: iconPath,
    backgroundColor: '#181818',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: process.platform === 'darwin' ? { x: 14, y: 12 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://127.0.0.1:')) {
      return { action: 'allow' };
    }
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  await mainWindow.loadURL(serverUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function buildAppMenu() {
  const sendMenuAction = (action: string) => {
    mainWindow?.webContents.send('gitmap:menuAction', action);
  };

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin'
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              {
                label: 'Settings...',
                accelerator: 'CmdOrCtrl+,',
                click: () => sendMenuAction('open-settings')
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    {
      label: 'Repository',
      submenu: [
        {
          label: 'Add Local Repository...',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendMenuAction('open-local-modal')
        },
        {
          label: 'Connect Remote (SSH) Repository...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => sendMenuAction('open-ssh-modal')
        },
        { type: 'separator' },
        {
          label: 'Open Integrated Terminal',
          accelerator: 'Ctrl+`',
          click: () => sendMenuAction('toggle-terminal')
        },
        ...(process.platform !== 'darwin'
          ? [
              { type: 'separator' as const },
              {
                label: 'Settings...',
                accelerator: 'CmdOrCtrl+,',
                click: () => sendMenuAction('open-settings')
              },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          : [])
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+B',
          click: () => sendMenuAction('toggle-sidebar')
        },
        {
          label: 'Toggle Theme (Dark / Light)',
          click: () => sendMenuAction('toggle-theme')
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.handle('gitmap:pickLocalFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('gitmap:pickLocalFile', async (_event, filters?: { name: string; extensions: string[] }[]) => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: filters || undefined
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

app.whenReady().then(async () => {
  const cliRepos = process.argv.slice(app.isPackaged ? 1 : 2).filter((a) => !a.startsWith('-'));

  gitMapServer = new GitMapServer({
    port: 0, // Ephemeral free port bound strictly to 127.0.0.1
    host: '127.0.0.1',
    dataDir: path.join(app.getPath('userData'), 'state'),
    initialRepos: cliRepos,
    desktopHooks: {
      showOpenDialog: async (req) => {
        const props: Array<'openFile' | 'openDirectory' | 'multiSelections'> = [];
        if (req.canSelectFolders) props.push('openDirectory');
        else props.push('openFile');
        if (req.canSelectMany) props.push('multiSelections');
        const filters = req.filters
          ? Object.entries(req.filters).map(([name, extensions]) => ({ name, extensions }))
          : undefined;
        const res = await dialog.showOpenDialog(mainWindow!, {
          defaultPath: req.defaultPath,
          buttonLabel: req.openLabel,
          properties: props,
          filters
        });
        return res.canceled ? undefined : res.filePaths;
      },
      showSaveDialog: async (req) => {
        const filters = req.filters
          ? Object.entries(req.filters).map(([name, extensions]) => ({ name, extensions }))
          : undefined;
        const res = await dialog.showSaveDialog(mainWindow!, {
          defaultPath: req.defaultPath,
          buttonLabel: req.saveLabel,
          filters
        });
        return res.canceled ? undefined : res.filePath;
      },
      writeClipboard: async (text) => {
        clipboard.writeText(text);
        return true;
      },
      openExternal: async (url) => {
        await shell.openExternal(url);
        return true;
      }
    }
  });

  const serverUrl = await gitMapServer.start();
  buildAppMenu();
  await createWindow(serverUrl);

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0 && gitMapServer) {
      await createWindow(gitMapServer.getUrl());
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  void gitMapServer?.stop();
});
