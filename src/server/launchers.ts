import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseRemoteRepo } from '../remote/repoTransport';
import { quotePosixArg, SshHostProfile, sshManager } from '../remote/sshManager';

/**
 * Launch external terminal emulators & code editors at a local path, or at a path on an SSH host.
 *
 * Settings (stored in GitMap's settings.json):
 *  - `gitmap.terminal.app`            id of a TERMINAL_APPS entry, or 'custom' (default: 'system')
 *  - `gitmap.terminal.customCommand`  shell command template for 'custom'
 *  - `gitmap.editor.app`              id of an EDITOR_APPS entry, or 'custom' (default: first one installed)
 *  - `gitmap.editor.customCommand`    shell command template for 'custom'
 *
 * Custom command templates are run by the shell, with these placeholders replaced by shell-quoted values:
 *   {path}        the local path, or the path on the SSH host
 *   {host}        the SSH host (alias from ~/.ssh/config, or user@host)
 *   {sshCommand}  a full `ssh -t ...` command that opens a login shell in {path} on the host (remote only)
 *   {sshUri}      ssh://user@host:port/path (remote only)
 */

export interface LauncherApp {
  id: string;
  name: string;
  available: boolean;
  supportsRemote: boolean;
}

export interface LaunchTarget {
  isRemote: boolean;
  /** Local path, or the path on the SSH host. */
  path: string;
  profile: SshHostProfile | null;
}

type Platform = 'darwin' | 'win32' | 'linux';
const PLATFORM: Platform = process.platform === 'darwin' || process.platform === 'win32' ? process.platform : 'linux';

interface AppDefinition {
  id: string;
  name: string;
  platforms: Platform[];
  /** macOS application bundle names (looked up in /Applications & ~/Applications). */
  macApps?: string[];
  /** Executables looked up on PATH (Windows / Linux, and macOS fallback). */
  bins?: string[];
  supportsRemote: boolean | ((target: LaunchTarget) => boolean);
  launch: (ctx: LaunchContext) => Promise<void>;
}

interface LaunchContext {
  target: LaunchTarget;
  /** Path to the application bundle (macOS) or the resolved executable. */
  location: string | null;
}

/* ------------------------------------------------------------------ helpers */

function macAppPath(names: string[] | undefined): string | null {
  if (!names) return null;
  const roots = ['/Applications', '/Applications/Utilities', '/System/Applications', '/System/Applications/Utilities', path.join(os.homedir(), 'Applications')];
  for (const name of names) {
    for (const root of roots) {
      const candidate = path.join(root, name.endsWith('.app') ? name : name + '.app');
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function whichSync(bin: string): string | null {
  if (path.isAbsolute(bin)) return fs.existsSync(bin) ? bin : null;
  const exts = PLATFORM === 'win32' ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';').concat(['']) : [''];
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  if (PLATFORM !== 'win32') dirs.push('/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', '/snap/bin');
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = path.join(dir, bin + ext);
      try {
        if (fs.statSync(candidate).isFile()) return candidate;
      } catch (_) {}
    }
  }
  return null;
}

function locate(def: AppDefinition): string | null {
  if (PLATFORM === 'darwin') {
    const app = macAppPath(def.macApps);
    if (app !== null) return app;
  }
  for (const bin of def.bins || []) {
    const found = whichSync(bin);
    if (found !== null) return found;
  }
  return null;
}

function spawnDetached(command: string, args: string[], options: cp.SpawnOptions = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const child = cp.spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: false, ...options });
    child.once('error', (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });
    child.once('spawn', () => {
      if (!settled) {
        settled = true;
        child.unref();
        resolve();
      }
    });
  });
}

/** Run a command and wait for it (used for osascript / open, which return quickly). */
function runAndWait(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    cp.execFile(command, args, { timeout: 15000 }, (err, _stdout, stderr) => {
      if (err) reject(new Error((stderr || err.message).toString().trim()));
      else resolve();
    });
  });
}

function sshTarget(profile: SshHostProfile): string {
  return profile.source === 'ssh-config' ? profile.id : `${profile.user}@${profile.host}`;
}

/** The ssh arguments (without the remote command) that connect to the profile's host. */
function sshArgs(profile: SshHostProfile): string[] {
  const args = ['-t'];
  if (profile.source !== 'ssh-config') {
    if (profile.port && profile.port !== 22) args.push('-p', String(profile.port));
    if (profile.privateKeyPath) args.push('-i', profile.privateKeyPath.replace(/^~(?=\/|\\|$)/, os.homedir()));
    if (profile.proxyJump) args.push('-J', profile.proxyJump);
  }
  args.push(sshTarget(profile));
  return args;
}

/** The command run on the SSH host: a login shell in the target directory. */
function remoteShellCommand(remotePath: string): string {
  // "~" (or "/~" from an ssh://host/~ URI) means the home directory, which must not be quoted to expand
  if (remotePath === '' || remotePath === '~' || remotePath === '/~') return 'exec "$SHELL" -l';
  const home = remotePath.match(/^\/?~\/(.*)$/);
  if (home) return `cd ~/${quotePosixArg(home[1])} && exec "$SHELL" -l`;
  return `cd ${quotePosixArg(remotePath)} && exec "$SHELL" -l`;
}

/** A POSIX shell command line that opens a login shell in remotePath on the host. */
export function buildSshCommandLine(profile: SshHostProfile, remotePath: string): string {
  return ['ssh', ...sshArgs(profile).map(quotePosixArg), quotePosixArg(remoteShellCommand(remotePath))].join(' ');
}

function sshUri(profile: SshHostProfile, remotePath: string) {
  const port = profile.port && profile.port !== 22 ? ':' + profile.port : '';
  return `ssh://${profile.user}@${profile.host}${port}${remotePath.startsWith('/') ? remotePath : '/' + remotePath}`;
}

function appleScriptString(value: string) {
  return '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function requireLocation(ctx: LaunchContext, name: string): string {
  if (ctx.location === null) throw new Error(`${name} isn't installed.`);
  return ctx.location;
}

/** Path of the executable inside a macOS bundle, or the bin itself. */
function macBundleBinary(location: string, relative: string): string {
  return location.endsWith('.app') ? path.join(location, relative) : location;
}

/* ------------------------------------------------------------- terminals */

const TERMINAL_APPS: AppDefinition[] = [
  {
    id: 'terminal',
    name: 'Terminal',
    platforms: ['darwin'],
    macApps: ['Terminal'],
    supportsRemote: true,
    launch: async ({ target }) => {
      if (!target.isRemote) {
        await runAndWait('open', ['-a', 'Terminal', target.path]);
        return;
      }
      const script = `tell application "Terminal"\nactivate\ndo script ${appleScriptString(buildSshCommandLine(target.profile!, target.path))}\nend tell`;
      await runAndWait('osascript', ['-e', script]);
    }
  },
  {
    id: 'iterm',
    name: 'iTerm2',
    platforms: ['darwin'],
    macApps: ['iTerm', 'iTerm2'],
    supportsRemote: true,
    launch: async ({ target }) => {
      const command = target.isRemote ? buildSshCommandLine(target.profile!, target.path) : `cd ${quotePosixArg(target.path)}`;
      const script = [
        'tell application "iTerm"',
        'activate',
        'set newWindow to (create window with default profile)',
        'tell current session of newWindow',
        `write text ${appleScriptString(command)}`,
        'end tell',
        'end tell'
      ].join('\n');
      await runAndWait('osascript', ['-e', script]);
    }
  },
  {
    id: 'ghostty',
    name: 'Ghostty',
    platforms: ['darwin', 'linux'],
    macApps: ['Ghostty'],
    bins: ['ghostty'],
    supportsRemote: true,
    launch: async (ctx) => {
      const location = requireLocation(ctx, 'Ghostty');
      const args = ctx.target.isRemote ? ['-e', 'ssh', ...sshArgs(ctx.target.profile!), remoteShellCommand(ctx.target.path)] : [`--working-directory=${ctx.target.path}`];
      if (location.endsWith('.app')) await runAndWait('open', ['-na', location, '--args', ...args]);
      else await spawnDetached(location, args);
    }
  },
  {
    id: 'warp',
    name: 'Warp',
    platforms: ['darwin', 'linux'],
    macApps: ['Warp'],
    bins: ['warp-terminal'],
    supportsRemote: false,
    launch: async (ctx) => {
      const location = requireLocation(ctx, 'Warp');
      if (location.endsWith('.app')) await runAndWait('open', ['-a', location, ctx.target.path]);
      else await spawnDetached(location, [], { cwd: ctx.target.path });
    }
  },
  {
    id: 'wezterm',
    name: 'WezTerm',
    platforms: ['darwin', 'win32', 'linux'],
    macApps: ['WezTerm'],
    bins: ['wezterm'],
    supportsRemote: true,
    launch: async (ctx) => {
      const bin = macBundleBinary(requireLocation(ctx, 'WezTerm'), 'Contents/MacOS/wezterm');
      const args = ctx.target.isRemote
        ? ['start', '--', 'ssh', ...sshArgs(ctx.target.profile!), remoteShellCommand(ctx.target.path)]
        : ['start', '--cwd', ctx.target.path];
      await spawnDetached(bin, args);
    }
  },
  {
    id: 'kitty',
    name: 'kitty',
    platforms: ['darwin', 'linux'],
    macApps: ['kitty'],
    bins: ['kitty'],
    supportsRemote: true,
    launch: async (ctx) => {
      const bin = macBundleBinary(requireLocation(ctx, 'kitty'), 'Contents/MacOS/kitty');
      const args = ctx.target.isRemote
        ? ['ssh', ...sshArgs(ctx.target.profile!), remoteShellCommand(ctx.target.path)]
        : ['--directory', ctx.target.path];
      await spawnDetached(bin, args);
    }
  },
  {
    id: 'alacritty',
    name: 'Alacritty',
    platforms: ['darwin', 'win32', 'linux'],
    macApps: ['Alacritty'],
    bins: ['alacritty'],
    supportsRemote: true,
    launch: async (ctx) => {
      const bin = macBundleBinary(requireLocation(ctx, 'Alacritty'), 'Contents/MacOS/alacritty');
      const args = ctx.target.isRemote
        ? ['-e', 'ssh', ...sshArgs(ctx.target.profile!), remoteShellCommand(ctx.target.path)]
        : ['--working-directory', ctx.target.path];
      await spawnDetached(bin, args);
    }
  },
  {
    id: 'windows-terminal',
    name: 'Windows Terminal',
    platforms: ['win32'],
    bins: ['wt'],
    supportsRemote: true,
    launch: async (ctx) => {
      const bin = requireLocation(ctx, 'Windows Terminal');
      const args = ctx.target.isRemote
        ? ['new-tab', 'ssh', ...sshArgs(ctx.target.profile!), remoteShellCommand(ctx.target.path)]
        : ['-d', ctx.target.path];
      await spawnDetached(bin, args);
    }
  },
  {
    id: 'powershell',
    name: 'PowerShell',
    platforms: ['win32'],
    bins: ['pwsh', 'powershell'],
    supportsRemote: true,
    launch: async (ctx) => {
      const bin = requireLocation(ctx, 'PowerShell');
      const psQuote = (v: string) => "'" + v.replace(/'/g, "''") + "'";
      const command = ctx.target.isRemote
        ? '& ssh ' + sshArgs(ctx.target.profile!).map(psQuote).join(' ') + ' ' + psQuote(remoteShellCommand(ctx.target.path))
        : 'Set-Location -LiteralPath ' + psQuote(ctx.target.path);
      await spawnDetached('cmd.exe', ['/c', 'start', '""', bin, '-NoExit', '-Command', command]);
    }
  },
  {
    id: 'cmd',
    name: 'Command Prompt',
    platforms: ['win32'],
    bins: ['cmd'],
    supportsRemote: true,
    launch: async ({ target }) => {
      if (target.isRemote) {
        const remoteCmd = remoteShellCommand(target.path).replace(/"/g, '\\"');
        await spawnDetached('cmd.exe', ['/c', 'start', 'cmd.exe', '/k', `ssh ${sshArgs(target.profile!).join(' ')} "${remoteCmd}"`]);
      } else {
        await spawnDetached('cmd.exe', ['/c', 'start', 'cmd.exe', '/k', `cd /d "${target.path}"`]);
      }
    }
  },
  {
    id: 'git-bash',
    name: 'Git Bash',
    platforms: ['win32'],
    bins: ['C:\\Program Files\\Git\\git-bash.exe', 'git-bash'],
    supportsRemote: false,
    launch: async (ctx) => {
      await spawnDetached(requireLocation(ctx, 'Git Bash'), [`--cd=${ctx.target.path}`]);
    }
  },
  {
    id: 'gnome-terminal',
    name: 'GNOME Terminal',
    platforms: ['linux'],
    bins: ['gnome-terminal'],
    supportsRemote: true,
    launch: async (ctx) => {
      const bin = requireLocation(ctx, 'GNOME Terminal');
      const args = ctx.target.isRemote
        ? ['--', 'ssh', ...sshArgs(ctx.target.profile!), remoteShellCommand(ctx.target.path)]
        : [`--working-directory=${ctx.target.path}`];
      await spawnDetached(bin, args);
    }
  },
  {
    id: 'konsole',
    name: 'Konsole',
    platforms: ['linux'],
    bins: ['konsole'],
    supportsRemote: true,
    launch: async (ctx) => {
      const bin = requireLocation(ctx, 'Konsole');
      const args = ctx.target.isRemote
        ? ['-e', 'ssh', ...sshArgs(ctx.target.profile!), remoteShellCommand(ctx.target.path)]
        : ['--workdir', ctx.target.path];
      await spawnDetached(bin, args);
    }
  },
  {
    id: 'xfce4-terminal',
    name: 'Xfce Terminal',
    platforms: ['linux'],
    bins: ['xfce4-terminal'],
    supportsRemote: true,
    launch: async (ctx) => {
      const bin = requireLocation(ctx, 'Xfce Terminal');
      const args = ctx.target.isRemote
        ? ['-x', 'ssh', ...sshArgs(ctx.target.profile!), remoteShellCommand(ctx.target.path)]
        : [`--working-directory=${ctx.target.path}`];
      await spawnDetached(bin, args);
    }
  },
  {
    id: 'xterm',
    name: 'xterm',
    platforms: ['linux'],
    bins: ['x-terminal-emulator', 'xterm'],
    supportsRemote: true,
    launch: async (ctx) => {
      const bin = requireLocation(ctx, 'xterm');
      const args = ctx.target.isRemote
        ? ['-e', 'ssh', ...sshArgs(ctx.target.profile!), remoteShellCommand(ctx.target.path)]
        : [];
      await spawnDetached(bin, args, ctx.target.isRemote ? {} : { cwd: ctx.target.path });
    }
  }
];

/* --------------------------------------------------------------- editors */

/** VS Code & its forks share the same CLI, including `--remote ssh-remote+<host> <path>`. */
function vscodeLike(id: string, name: string, macApp: string, cliName: string): AppDefinition {
  return {
    id,
    name,
    platforms: ['darwin', 'win32', 'linux'],
    macApps: [macApp],
    bins: [cliName],
    supportsRemote: true,
    launch: async (ctx) => {
      const location = requireLocation(ctx, name);
      const cli = location.endsWith('.app') ? path.join(location, 'Contents', 'Resources', 'app', 'bin', cliName) : location;
      const args = ctx.target.isRemote
        ? ['--remote', `ssh-remote+${sshTarget(ctx.target.profile!)}`, ctx.target.path]
        : [ctx.target.path];
      if (location.endsWith('.app') && !fs.existsSync(cli)) {
        if (ctx.target.isRemote) {
          const uri = `vscode-remote://ssh-remote+${encodeURIComponent(sshTarget(ctx.target.profile!))}${ctx.target.path}`;
          await runAndWait('open', ['-a', location, '--args', '--folder-uri', uri]);
        } else {
          await runAndWait('open', ['-a', location, ctx.target.path]);
        }
        return;
      }
      // On Windows the CLI is a .cmd script, which must be started through the shell
      await spawnDetached(cli, args, PLATFORM === 'win32' ? { shell: true } : {});
    }
  };
}

function jetbrains(id: string, name: string, macApps: string[], bin: string): AppDefinition {
  return {
    id,
    name,
    platforms: ['darwin', 'win32', 'linux'],
    macApps,
    bins: [bin],
    supportsRemote: false,
    launch: async (ctx) => {
      const location = requireLocation(ctx, name);
      if (location.endsWith('.app')) await runAndWait('open', ['-na', location, '--args', ctx.target.path]);
      else await spawnDetached(location, [ctx.target.path], PLATFORM === 'win32' ? { shell: true } : {});
    }
  };
}

const EDITOR_APPS: AppDefinition[] = [
  vscodeLike('vscode', 'Visual Studio Code', 'Visual Studio Code', 'code'),
  vscodeLike('vscode-insiders', 'VS Code Insiders', 'Visual Studio Code - Insiders', 'code-insiders'),
  vscodeLike('cursor', 'Cursor', 'Cursor', 'cursor'),
  vscodeLike('windsurf', 'Windsurf', 'Windsurf', 'windsurf'),
  vscodeLike('vscodium', 'VSCodium', 'VSCodium', 'codium'),
  vscodeLike('trae', 'Trae', 'Trae', 'trae'),
  {
    id: 'zed',
    name: 'Zed',
    platforms: ['darwin', 'linux'],
    macApps: ['Zed'],
    bins: ['zed'],
    supportsRemote: true,
    launch: async (ctx) => {
      const location = requireLocation(ctx, 'Zed');
      const cli = location.endsWith('.app') ? path.join(location, 'Contents', 'MacOS', 'cli') : location;
      const arg = ctx.target.isRemote ? sshUri(ctx.target.profile!, ctx.target.path) : ctx.target.path;
      await spawnDetached(cli, [arg]);
    }
  },
  {
    id: 'sublime',
    name: 'Sublime Text',
    platforms: ['darwin', 'win32', 'linux'],
    macApps: ['Sublime Text'],
    bins: ['subl'],
    supportsRemote: false,
    launch: async (ctx) => {
      const location = requireLocation(ctx, 'Sublime Text');
      const cli = location.endsWith('.app') ? path.join(location, 'Contents', 'SharedSupport', 'bin', 'subl') : location;
      await spawnDetached(cli, [ctx.target.path]);
    }
  },
  jetbrains('idea', 'IntelliJ IDEA', ['IntelliJ IDEA', 'IntelliJ IDEA CE', 'IntelliJ IDEA Ultimate'], 'idea'),
  jetbrains('pycharm', 'PyCharm', ['PyCharm', 'PyCharm CE', 'PyCharm Professional Edition'], 'pycharm'),
  jetbrains('webstorm', 'WebStorm', ['WebStorm'], 'webstorm'),
  jetbrains('goland', 'GoLand', ['GoLand'], 'goland'),
  jetbrains('clion', 'CLion', ['CLion'], 'clion'),
  {
    id: 'xcode',
    name: 'Xcode',
    platforms: ['darwin'],
    macApps: ['Xcode'],
    supportsRemote: false,
    launch: async (ctx) => {
      await runAndWait('open', ['-a', requireLocation(ctx, 'Xcode'), ctx.target.path]);
    }
  }
];

/* -------------------------------------------------------------- registry */

let detectionCache: { at: number; terminals: LauncherApp[]; editors: LauncherApp[] } | null = null;

function describe(defs: AppDefinition[]): LauncherApp[] {
  return defs
    .filter((d) => d.platforms.includes(PLATFORM))
    .map((d) => ({
      id: d.id,
      name: d.name,
      available: locate(d) !== null,
      supportsRemote: typeof d.supportsRemote === 'boolean' ? d.supportsRemote : true
    }));
}

/** List the terminals & editors for this platform, and whether each is installed (cached for 30 seconds). */
export function listLaunchers(force: boolean = false): { terminals: LauncherApp[]; editors: LauncherApp[]; platform: string } {
  if (force || detectionCache === null || Date.now() - detectionCache.at > 30000) {
    detectionCache = { at: Date.now(), terminals: describe(TERMINAL_APPS), editors: describe(EDITOR_APPS) };
  }
  return { terminals: detectionCache.terminals, editors: detectionCache.editors, platform: PLATFORM };
}

/** The terminal used when none has been chosen: the platform's own. */
function defaultTerminalId(): string {
  if (PLATFORM === 'darwin') return 'terminal';
  if (PLATFORM === 'win32') return locate(TERMINAL_APPS.find((d) => d.id === 'windows-terminal')!) !== null ? 'windows-terminal' : 'cmd';
  const linux = ['gnome-terminal', 'konsole', 'xfce4-terminal', 'kitty', 'alacritty', 'wezterm', 'xterm'];
  for (const id of linux) {
    const def = TERMINAL_APPS.find((d) => d.id === id);
    if (def && locate(def) !== null) return id;
  }
  return 'xterm';
}

function defaultEditorId(): string | null {
  const first = EDITOR_APPS.find((d) => d.platforms.includes(PLATFORM) && locate(d) !== null);
  return first ? first.id : null;
}

/**
 * Resolve a repository key / path into a launch target.
 * @param location A local path, or an ssh:// URI (`ssh://host/path`).
 */
export async function resolveLaunchTarget(location: string): Promise<LaunchTarget> {
  const remote = parseRemoteRepo(location);
  if (remote !== null) {
    const profile = sshManager.resolveProfile(remote.hostId);
    return { isRemote: true, path: remote.remotePath, profile };
  }
  const local = location.startsWith('~') ? path.join(os.homedir(), location.slice(1)) : location;
  if (!fs.existsSync(local)) throw new Error(`The folder "${local}" doesn't exist.`);
  const stat = fs.statSync(local);
  return { isRemote: false, path: stat.isDirectory() ? local : path.dirname(local), profile: null };
}

function fillTemplate(template: string, target: LaunchTarget): string {
  const values: { [key: string]: string } = {
    path: target.path,
    host: target.profile ? sshTarget(target.profile) : '',
    sshCommand: target.profile ? buildSshCommandLine(target.profile, target.path) : '',
    sshUri: target.profile ? sshUri(target.profile, target.path) : ''
  };
  const quote = PLATFORM === 'win32' ? (v: string) => '"' + v.replace(/"/g, '""') + '"' : quotePosixArg;
  return template.replace(/\{(path|host|sshCommand|sshUri)\}/g, (_m, key: string) => (key === 'sshCommand' ? values[key] : quote(values[key])));
}

async function runCustom(template: string, target: LaunchTarget, kind: string) {
  if (!template.trim()) throw new Error(`Set the custom ${kind} command in Settings first.`);
  if (target.isRemote && !/\{(sshCommand|host|sshUri)\}/.test(template)) {
    throw new Error(`The custom ${kind} command doesn't use {sshCommand}, {host} or {sshUri}, so it can't open a remote SSH path.`);
  }
  const command = fillTemplate(template, target);
  if (PLATFORM === 'win32') await spawnDetached('cmd.exe', ['/c', command], { cwd: target.isRemote ? os.homedir() : target.path });
  else await spawnDetached('/bin/sh', ['-c', command], { cwd: target.isRemote ? os.homedir() : target.path });
}

async function launchWith(defs: AppDefinition[], appId: string, target: LaunchTarget, kind: string) {
  const def = defs.find((d) => d.id === appId && d.platforms.includes(PLATFORM));
  if (!def) throw new Error(`Unknown ${kind} "${appId}".`);
  const location = locate(def);
  if (location === null && (def.macApps || def.bins)) {
    // Terminal.app & cmd always exist; anything else must be installed
    if (!(def.id === 'terminal' || def.id === 'cmd')) throw new Error(`${def.name} isn't installed. Choose another ${kind} in Settings.`);
  }
  const supportsRemote = typeof def.supportsRemote === 'function' ? def.supportsRemote(target) : def.supportsRemote;
  if (target.isRemote && !supportsRemote) {
    throw new Error(`${def.name} can't open a path on an SSH host. Choose another ${kind} in Settings, or use a custom command with {sshCommand}.`);
  }
  await def.launch({ target, location });
}

export interface LauncherSettings {
  terminalApp?: string;
  terminalCustomCommand?: string;
  editorApp?: string;
  editorCustomCommand?: string;
}

export async function openInTerminal(location: string, settings: LauncherSettings): Promise<string> {
  const target = await resolveLaunchTarget(location);
  const appId = settings.terminalApp && settings.terminalApp !== 'system' ? settings.terminalApp : defaultTerminalId();
  if (appId === 'custom') {
    await runCustom(settings.terminalCustomCommand || '', target, 'terminal');
    return 'Custom';
  }
  await launchWith(TERMINAL_APPS, appId, target, 'terminal');
  return TERMINAL_APPS.find((d) => d.id === appId)?.name || appId;
}

export async function openInEditor(location: string, settings: LauncherSettings): Promise<string> {
  const target = await resolveLaunchTarget(location);
  const appId = settings.editorApp && settings.editorApp !== 'auto' ? settings.editorApp : defaultEditorId();
  if (appId === null) throw new Error('No supported code editor was found. Choose one, or set a custom command, in Settings.');
  if (appId === 'custom') {
    await runCustom(settings.editorCustomCommand || '', target, 'editor');
    return 'Custom';
  }
  await launchWith(EDITOR_APPS, appId, target, 'editor');
  return EDITOR_APPS.find((d) => d.id === appId)?.name || appId;
}

/** Exposed for tests. */
export const __test = { fillTemplate, sshArgs, remoteShellCommand };
