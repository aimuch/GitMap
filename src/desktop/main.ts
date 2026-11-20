import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeImage, nativeTheme, safeStorage, shell } from 'electron';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { updateStandaloneSettingsBatch } from '../platform/vscode';
import { GitMapServer } from '../server/appServer';

const execFileAsync = promisify(execFile);

let mainWindow: BrowserWindow | null = null;
let gitMapServer: GitMapServer | null = null;
let isQuitting = false;
let stopCompleted = false;
let quitCleanupPromise: Promise<void> | null = null;
let pendingHideAfterFullscreen = false;
let pendingBundleIconTask: Promise<void> = Promise.resolve();
let queuedBundleIcon: { pngBuffer: Buffer; iconKey: string } | null = null;
let bundleIconWorkerRunning = false;

const VALID_ICON_STYLES = new Set(['classic', 'metro', 'neon', 'compass', 'isometric', 'minimal']);
const currentIconPrefs: {
  style: string;
  iconTheme: 'auto' | 'dark' | 'light';
  uiTheme: 'system' | 'dark' | 'light';
} = {
  style: 'classic',
  iconTheme: 'auto',
  uiTheme: 'system'
};
let lastAppliedIconPath = '';

function resolveEffectiveIconVariant(): 'dark' | 'light' {
  if (currentIconPrefs.iconTheme === 'dark') return 'dark';
  if (currentIconPrefs.iconTheme === 'light') return 'light';
  if (currentIconPrefs.uiTheme === 'dark') return 'dark';
  if (currentIconPrefs.uiTheme === 'light') return 'light';
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
}

function resolveNativeIconKey(): string {
  const style = VALID_ICON_STYLES.has(currentIconPrefs.style) ? currentIconPrefs.style : 'classic';
  const variant = resolveEffectiveIconVariant();
  return `${style}-${variant}`;
}

function resolveNativeIconPath(): string {
  const key = resolveNativeIconKey();
  const candidate = path.resolve(__dirname, '..', '..', 'resources', 'icons', `${key}.png`);
  if (fs.existsSync(candidate)) return candidate;
  return path.resolve(__dirname, '..', '..', 'resources', 'icon.png');
}

function resolveMacAppBundlePath(): string | null {
  if (process.platform !== 'darwin' || !app.isPackaged) return null;
  const exePath = app.getPath('exe');
  const match = exePath.match(/^(.+?\.app)(?:\/|$)/i);
  if (!match) return null;
  const bundlePath = match[1];
  if (bundlePath.startsWith('/Volumes/')) return null;
  return bundlePath;
}

function schedulePersistMacBundleIcon(pngBuffer: Buffer, iconKey: string) {
  const bundlePath = resolveMacAppBundlePath();
  if (!bundlePath) return;

  queuedBundleIcon = { pngBuffer, iconKey };
  if (bundleIconWorkerRunning) return;
  bundleIconWorkerRunning = true;

  pendingBundleIconTask = pendingBundleIconTask
    .catch(() => {})
    .then(async () => {
      try {
        while (queuedBundleIcon) {
          const next = queuedBundleIcon;
          queuedBundleIcon = null;
          try {
            const stateDir = path.join(app.getPath('userData'), 'state');
            fs.mkdirSync(stateDir, { recursive: true });
            const stampFile = path.join(stateDir, 'bundle-icon-stamp.json');
            const customIconFork = path.join(bundlePath, 'Icon\r');

            try {
              if (fs.existsSync(stampFile)) {
                const stamp = JSON.parse(fs.readFileSync(stampFile, 'utf8'));
                if (stamp && stamp.bundlePath === bundlePath && stamp.iconKey === next.iconKey && fs.existsSync(customIconFork)) {
                  continue;
                }
              } else if (next.iconKey === 'classic-dark' && !fs.existsSync(customIconFork)) {
                continue;
              }
            } catch (_) {}

            const extractedPng = path.join(stateDir, 'active-app-icon.png');
            fs.writeFileSync(extractedPng, next.pngBuffer);

            // Remove existing Icon\r first so GitMap.app gets a fresh directory entry & mtime to bust IconServices cache
            try {
              fs.rmSync(customIconFork, { force: true });
            } catch (_) {}

            const jxaScript = [
              'ObjC.import("AppKit");',
              'function run(argv) {',
              '  const iconPath = argv[0];',
              '  const appPath = argv[1];',
              '  const ws = $.NSWorkspace.sharedWorkspace;',
              '  const img = $.NSImage.alloc.initWithContentsOfFile(iconPath);',
              '  if (!img || img.isNil()) throw new Error("Invalid icon image");',
              '  if (!ws.setIconForFileOptions(img, appPath, 0)) throw new Error("NSWorkspace.setIcon failed");',
              '  ws.noteFileSystemChanged(appPath);',
              '  return "ok";',
              '}'
            ].join('\n');

            await execFileAsync('/usr/bin/osascript', ['-l', 'JavaScript', '-e', jxaScript, extractedPng, bundlePath], {
              timeout: 8000
            });

            const now = new Date();
            try {
              fs.utimesSync(bundlePath, now, now);
            } catch (_) {}

            const lsregister = '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister';
            if (fs.existsSync(lsregister)) {
              await execFileAsync(lsregister, ['-f', bundlePath], { timeout: 4000 }).catch(() => {});
            }

            fs.writeFileSync(stampFile, JSON.stringify({ bundlePath, iconKey: next.iconKey, updatedAt: Date.now() }, null, 2), 'utf8');
          } catch (_) {}
        }
      } finally {
        bundleIconWorkerRunning = false;
      }
    });
}

function loadNativeIconBufferAndImage(iconFile: string): { buf: Buffer; img: Electron.NativeImage } | null {
  try {
    const buf = fs.readFileSync(iconFile);
    const img = nativeImage.createFromBuffer(buf);
    return img.isEmpty() ? null : { buf, img };
  } catch (_) {
    return null;
  }
}

function loadNativeIconImage(iconFile: string): Electron.NativeImage | null {
  const loaded = loadNativeIconBufferAndImage(iconFile);
  return loaded ? loaded.img : null;
}

function applyNativeAppIcon(force = false) {
  try {
    const iconKey = resolveNativeIconKey();
    const iconFile = resolveNativeIconPath();
    if (!force && iconFile === lastAppliedIconPath) return;
    const loaded = loadNativeIconBufferAndImage(iconFile);
    if (!loaded) return;
    lastAppliedIconPath = iconFile;
    if (process.platform === 'darwin') {
      if (app.dock) {
        app.dock.setIcon(loaded.img);
      }
      schedulePersistMacBundleIcon(loaded.buf, iconKey);
    } else if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setIcon(loaded.img);
    }
  } catch (_) {}
}

function loadSavedIconPrefsFromDisk() {
  try {
    const settingsPath = path.join(app.getPath('userData'), 'state', 'settings.json');
    if (!fs.existsSync(settingsPath)) return;
    const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (data && typeof data === 'object') {
      if (typeof data['gitmap.app.iconStyle'] === 'string' && VALID_ICON_STYLES.has(data['gitmap.app.iconStyle'])) {
        currentIconPrefs.style = data['gitmap.app.iconStyle'];
      }
      if (data['gitmap.app.iconTheme'] === 'dark' || data['gitmap.app.iconTheme'] === 'light' || data['gitmap.app.iconTheme'] === 'auto') {
        currentIconPrefs.iconTheme = data['gitmap.app.iconTheme'];
      }
      if (data['gitmap.app.theme'] === 'dark' || data['gitmap.app.theme'] === 'light' || data['gitmap.app.theme'] === 'system') {
        currentIconPrefs.uiTheme = data['gitmap.app.theme'];
      }
    }
  } catch (_) {}
}

interface SavedWindowBounds {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized?: boolean;
}

function getBoundsFilePath(): string {
  return path.join(app.getPath('userData'), 'window-bounds.json');
}

function loadSavedBounds(): SavedWindowBounds {
  try {
    const raw = JSON.parse(fs.readFileSync(getBoundsFilePath(), 'utf8'));
    if (raw && typeof raw.width === 'number' && typeof raw.height === 'number') {
      return {
        x: typeof raw.x === 'number' ? raw.x : undefined,
        y: typeof raw.y === 'number' ? raw.y : undefined,
        width: Math.max(960, raw.width),
        height: Math.max(620, raw.height),
        isMaximized: !!raw.isMaximized
      };
    }
  } catch (_) {}
  return { width: 1440, height: 920 };
}

function persistWindowBounds(win: BrowserWindow) {
  try {
    const isMaximized = win.isMaximized();
    const normal = isMaximized ? win.getNormalBounds() : win.getBounds();
    const data: SavedWindowBounds = {
      x: normal.x,
      y: normal.y,
      width: normal.width,
      height: normal.height,
      isMaximized
    };
    fs.writeFileSync(getBoundsFilePath(), JSON.stringify(data, null, 2), 'utf8');
  } catch (_) {}
}

async function safeOpenExternal(rawUrl: string): Promise<boolean> {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:' && parsed.protocol !== 'mailto:') {
      return false;
    }
    await shell.openExternal(parsed.toString());
    return true;
  } catch (_) {
    return false;
  }
}

process.on('uncaughtException', (err) => {
  console.error('[GitMap] Uncaught exception:', err);
  mainWindow?.webContents.send('gitmap:mainError', err instanceof Error ? err.message : String(err));
});
process.on('unhandledRejection', (reason) => {
  console.error('[GitMap] Unhandled rejection:', reason);
});

async function createWindow(authUrl: string, baseOrigin: string) {
  const iconImage = loadNativeIconImage(resolveNativeIconPath());
  const savedBounds = loadSavedBounds();

  mainWindow = new BrowserWindow({
    width: savedBounds.width,
    height: savedBounds.height,
    ...(typeof savedBounds.x === 'number' && typeof savedBounds.y === 'number'
      ? { x: savedBounds.x, y: savedBounds.y }
      : {}),
    minWidth: 960,
    minHeight: 620,
    title: 'GitMap',
    ...(iconImage ? { icon: iconImage } : {}),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#181818' : '#ffffff',
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: process.platform === 'darwin' ? { x: 14, y: 15 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (savedBounds.isMaximized) {
    mainWindow.maximize();
  }

  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      if (new URL(navigationUrl).origin !== baseOrigin) {
        event.preventDefault();
        void safeOpenExternal(navigationUrl);
      }
    } catch (_) {
      event.preventDefault();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void safeOpenExternal(url);
    return { action: 'deny' };
  });

  const win = mainWindow;
  win.once('ready-to-show', () => win.show());

  let boundsSaveTimer: NodeJS.Timeout | null = null;
  const scheduleSaveBounds = () => {
    if (boundsSaveTimer) clearTimeout(boundsSaveTimer);
    boundsSaveTimer = setTimeout(() => {
      if (!win.isDestroyed()) persistWindowBounds(win);
    }, 300);
  };
  win.on('resize', scheduleSaveBounds);
  win.on('move', scheduleSaveBounds);

  win.on('enter-full-screen', () => {
    win.webContents.send('gitmap:fullscreenChanged', true);
  });
  win.on('leave-full-screen', () => {
    win.webContents.send('gitmap:fullscreenChanged', false);
  });

  win.on('focus', () => {
    win.webContents.send('gitmap:menuAction', 'window-focused');
  });

  win.on('close', (event) => {
    persistWindowBounds(win);
    if (process.platform !== 'darwin' || isQuitting) return;
    event.preventDefault();
    if (win.isFullScreen()) {
      pendingHideAfterFullscreen = true;
      win.once('leave-full-screen', () => {
        if (pendingHideAfterFullscreen && !win.isDestroyed()) {
          pendingHideAfterFullscreen = false;
          win.hide();
        }
      });
      win.setFullScreen(false);
    } else {
      win.hide();
    }
  });

  win.on('closed', () => {
    pendingHideAfterFullscreen = false;
    if (mainWindow === win) mainWindow = null;
  });

  await win.loadURL(authUrl);
}

function showMainWindow() {
  pendingHideAfterFullscreen = false;
  if (mainWindow === null || mainWindow.isDestroyed()) return false;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  return true;
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
        {
          label: 'Clone Repository...',
          click: () => sendMenuAction('open-clone-modal')
        },
        {
          label: 'Browse Repository Files',
          accelerator: 'CmdOrCtrl+E',
          click: () => sendMenuAction('open-repo-files')
        },
        {
          label: 'Stage & Commit Working Tree...',
          accelerator: 'CmdOrCtrl+Shift+G',
          click: () => sendMenuAction('open-scm')
        },
        {
          label: 'Fetch All Repositories',
          click: () => sendMenuAction('fetch-all')
        },
        {
          label: 'Git Worktrees...',
          click: () => sendMenuAction('open-worktrees')
        },
        {
          label: 'Pull Requests / Merge Requests...',
          click: () => sendMenuAction('open-prs')
        },
        {
          label: 'Interactive Rebase...',
          click: () => sendMenuAction('open-rebase')
        },
        {
          label: 'Git Reflog Timeline...',
          click: () => sendMenuAction('open-reflog')
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
          label: 'Command Palette...',
          accelerator: 'CmdOrCtrl+P',
          click: () => sendMenuAction('open-command-palette')
        },
        {
          label: 'Refresh Git Graph',
          accelerator: 'CmdOrCtrl+R',
          click: () => sendMenuAction('refresh-graph')
        },
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+B',
          click: () => sendMenuAction('toggle-sidebar')
        },
        { type: 'separator' },
        {
          label: 'Single-Pane Tabs Layout',
          click: () => sendMenuAction('layout-tabs')
        },
        {
          label: 'Split Left / Right (History + Repo Files)',
          accelerator: 'CmdOrCtrl+\\',
          click: () => sendMenuAction('layout-split-lr')
        },
        {
          label: 'Split Top / Bottom (History + Repo Files)',
          accelerator: 'CmdOrCtrl+Shift+\\',
          click: () => sendMenuAction('layout-split-tb')
        },
        {
          label: 'Swap Split Panes',
          click: () => sendMenuAction('layout-swap-panes')
        },
        { type: 'separator' },
        {
          label: 'Diagnostic Logs',
          click: () => sendMenuAction('open-logs')
        },
        { type: 'separator' },
        {
          label: 'Reload Window',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => mainWindow?.webContents.reload()
        },
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
      submenu: [
        {
          label: 'Close Tab or Window',
          accelerator: 'CmdOrCtrl+W',
          click: () => sendMenuAction('close-tab-or-window')
        },
        { role: 'minimize' },
        { role: 'zoom' }
      ]
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
    properties: ['openFile', 'showHiddenFiles'],
    filters: filters || undefined
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('gitmap:setNativeTheme', (_event, theme: 'system' | 'dark' | 'light') => {
  if (theme === 'system' || theme === 'dark' || theme === 'light') {
    currentIconPrefs.uiTheme = theme;
    nativeTheme.themeSource = theme;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#181818' : '#ffffff');
    }
    applyNativeAppIcon();
  }
});

ipcMain.handle(
  'gitmap:setAppIcon',
  async (_event, opts?: { style?: string; iconTheme?: 'auto' | 'dark' | 'light'; uiTheme?: 'system' | 'dark' | 'light'; persist?: boolean }) => {
    if (opts && typeof opts === 'object') {
      if (typeof opts.style === 'string' && VALID_ICON_STYLES.has(opts.style)) {
        currentIconPrefs.style = opts.style;
      }
      if (opts.iconTheme === 'auto' || opts.iconTheme === 'dark' || opts.iconTheme === 'light') {
        currentIconPrefs.iconTheme = opts.iconTheme;
      }
      if (opts.uiTheme === 'system' || opts.uiTheme === 'dark' || opts.uiTheme === 'light') {
        currentIconPrefs.uiTheme = opts.uiTheme;
      }
      applyNativeAppIcon();
      if (opts.persist && gitMapServer) {
        await updateStandaloneSettingsBatch({
          'gitmap.app.iconStyle': currentIconPrefs.style,
          'gitmap.app.iconTheme': currentIconPrefs.iconTheme
        }).catch(() => {});
      }
    }
  }
);

nativeTheme.on('updated', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#181818' : '#ffffff');
  }
  applyNativeAppIcon();
});

ipcMain.handle('gitmap:closeOrHideWindow', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
});

app.whenReady().then(async () => {
  if (!gotSingleInstanceLock) return;
  loadSavedIconPrefsFromDisk();
  if (currentIconPrefs.uiTheme !== 'system') {
    nativeTheme.themeSource = currentIconPrefs.uiTheme;
  }
  applyNativeAppIcon(true);

  const cliRepos = process.argv.slice(app.isPackaged ? 1 : 2).filter((a) => !a.startsWith('-'));

  gitMapServer = new GitMapServer({
    port: 0,
    host: '127.0.0.1',
    requireAuth: true,
    dataDir: path.join(app.getPath('userData'), 'state'),
    initialRepos: cliRepos,
    secretCipher: {
      isAvailable: () => safeStorage.isEncryptionAvailable(),
      encrypt: (plain) => safeStorage.encryptString(plain),
      decrypt: (buf) => safeStorage.decryptString(buf)
    },
    desktopHooks: {
      showOpenDialog: async (req) => {
        const props: Array<'openFile' | 'openDirectory' | 'multiSelections' | 'createDirectory'> = ['createDirectory'];
        if (req.canSelectFolders) props.push('openDirectory');
        if (req.canSelectFiles !== false && (!req.canSelectFolders || process.platform === 'darwin')) props.push('openFile');
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
        if (url === 'x-apple.systempreferences:com.apple.preference.security?Privacy_LocalNetwork' && process.platform === 'darwin') {
          await shell.openExternal(url);
          return true;
        }
        return safeOpenExternal(url);
      },
      trashItem: async (fullPath) => {
        await shell.trashItem(fullPath);
      }
    }
  });

  const baseUrl = await gitMapServer.start();
  const baseOrigin = new URL(baseUrl).origin;
  buildAppMenu();
  await createWindow(gitMapServer.getAuthUrl(), baseOrigin);

  app.on('activate', async () => {
    if (showMainWindow()) return;
    if (BrowserWindow.getAllWindows().length === 0 && gitMapServer) {
      await createWindow(gitMapServer.getAuthUrl(), new URL(gitMapServer.getUrl()).origin);
    }
  });
});

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', (event) => {
  isQuitting = true;
  if (!stopCompleted) {
    event.preventDefault();
    if (!quitCleanupPromise) {
      const srv = gitMapServer;
      gitMapServer = null;
      quitCleanupPromise = Promise.allSettled([srv ? srv.stop() : Promise.resolve(), pendingBundleIconTask]).then(() => {
        stopCompleted = true;
        app.quit();
      });
    }
  }
});
