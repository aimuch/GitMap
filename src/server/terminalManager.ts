import * as cp from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import { Writable } from 'stream';
import { ClientChannel } from 'ssh2';
import * as vscode from '../platform/vscode';
import { parseRemoteRepo } from '../remote/repoTransport';
import { sshManager } from '../remote/sshManager';

export interface TerminalSessionInfo {
  id: string;
  repo: string;
  title: string;
  isRemote: boolean;
  hostId?: string;
  cwd: string;
}

interface ActiveTerminal {
  info: TerminalSessionInfo;
  owner: unknown;
  onData: (id: string, chunk: string) => void;
  onExit: (id: string, code: number) => void;
  scrollback: string;
  orphanTimer: NodeJS.Timeout | null;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
}

const MAX_TERMINAL_SESSIONS = 16;
const MAX_SCROLLBACK_CHARS = 65536;

let cachedPython3: string | null | undefined = undefined;

function canSafelyProbeAppleStub(candidate: string): boolean {
  if (process.platform !== 'darwin' || candidate !== '/usr/bin/python3') return true;
  // Avoid triggering macOS GUI "command line developer tools" popup when CLT isn't installed
  return (
    fs.existsSync('/Library/Developer/CommandLineTools/usr/bin/python3') ||
    fs.existsSync('/Applications/Xcode.app/Contents/Developer/usr/bin/python3')
  );
}

function findWorkingPython3(): string | null {
  if (process.platform === 'win32') return null;
  if (cachedPython3 !== undefined) return cachedPython3;

  const candidates = [
    '/opt/homebrew/bin/python3',
    '/usr/local/bin/python3',
    '/usr/bin/python3'
  ];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate) || !canSafelyProbeAppleStub(candidate)) continue;
    try {
      const check = cp.spawnSync(candidate, ['-c', 'import pty, select, fcntl, termios'], {
        timeout: 2000,
        stdio: 'ignore'
      });
      if (check.status === 0) {
        cachedPython3 = candidate;
        return candidate;
      }
    } catch (_) {}
  }
  cachedPython3 = null;
  return null;
}

function resolveDefaultLocalShell(explicitShellPath?: string | null): string {
  if (explicitShellPath && explicitShellPath.trim() && fs.existsSync(explicitShellPath.trim())) {
    return explicitShellPath.trim();
  }
  const configured = vscode.workspace.getConfiguration('git-map').get<string>('integratedTerminalShell', '');
  if (configured && configured.trim() && fs.existsSync(configured.trim())) {
    return configured.trim();
  }
  if (process.platform === 'win32') {
    for (const ps of ['pwsh.exe', 'powershell.exe']) {
      try {
        const res = cp.spawnSync('where.exe', [ps], { timeout: 1500, encoding: 'utf8' });
        const first = (res.stdout || '').split(/\r?\n/)[0]?.trim();
        if (res.status === 0 && first) return first;
      } catch (_) {}
    }
    return process.env.COMSPEC || 'cmd.exe';
  }
  return process.env.SHELL || '/bin/zsh';
}

export class TerminalManager {
  private readonly sessions = new Map<string, ActiveTerminal>();
  private pendingCreates = 0;

  public async createSession(
    repo: string,
    name: string | undefined,
    cols: number,
    rows: number,
    initialCommand: string | null | undefined,
    onData: (id: string, chunk: string) => void,
    onExit: (id: string, code: number) => void,
    owner?: unknown,
    shellPath?: string | null
  ): Promise<TerminalSessionInfo> {
    if (this.sessions.size + this.pendingCreates >= MAX_TERMINAL_SESSIONS) {
      throw new Error(`Too many open terminals (limit ${MAX_TERMINAL_SESSIONS}). Close some terminal tabs first.`);
    }
    this.pendingCreates++;
    try {
      return await this.createSessionInner(repo, name, cols, rows, initialCommand, onData, onExit, owner, shellPath);
    } finally {
      this.pendingCreates--;
    }
  }

  public listSessions(): TerminalSessionInfo[] {
    return Array.from(this.sessions.values()).map((s) => s.info);
  }

  /**
   * Re-bind an existing live terminal session to a newly reconnected WebSocket client.
   */
  public attachSession(
    id: string,
    owner: unknown,
    onData: (id: string, chunk: string) => void,
    onExit: (id: string, code: number) => void
  ): { session: TerminalSessionInfo; scrollback: string } | null {
    const active = this.sessions.get(id);
    if (!active) return null;
    if (active.orphanTimer) {
      clearTimeout(active.orphanTimer);
      active.orphanTimer = null;
    }
    active.owner = owner;
    active.onData = onData;
    active.onExit = onExit;
    return { session: active.info, scrollback: active.scrollback };
  }

  /**
   * When a WebSocket disconnects, give it a brief grace window to reconnect and call `term:attach`;
   * if it does not return (e.g. page reload or closed tab), clean up its PTY/SSH sessions automatically.
   */
  public detachOwner(owner: unknown, graceMs: number = 6000) {
    for (const [id, active] of this.sessions.entries()) {
      if (active.owner !== owner) continue;
      if (active.orphanTimer) clearTimeout(active.orphanTimer);
      active.orphanTimer = setTimeout(() => {
        active.orphanTimer = null;
        if (active.owner === owner) {
          this.close(id);
        }
      }, graceMs);
    }
  }

  private appendScrollback(active: ActiveTerminal, chunk: string) {
    active.scrollback += chunk;
    if (active.scrollback.length > MAX_SCROLLBACK_CHARS) {
      active.scrollback = active.scrollback.slice(active.scrollback.length - MAX_SCROLLBACK_CHARS);
    }
  }

  private async createSessionInner(
    repo: string,
    name: string | undefined,
    cols: number,
    rows: number,
    initialCommand: string | null | undefined,
    onData: (id: string, chunk: string) => void,
    onExit: (id: string, code: number) => void,
    owner?: unknown,
    shellPath?: string | null
  ): Promise<TerminalSessionInfo> {
    const id = 'term-' + crypto.randomBytes(6).toString('hex');
    const remote = parseRemoteRepo(repo);

    if (remote !== null) {
      const channel: ClientChannel = await sshManager.openRemotePtyShell(
        remote.hostId,
        remote.remotePath,
        cols || 100,
        rows || 28
      );
      const info: TerminalSessionInfo = {
        id,
        repo,
        title: name || `SSH: ${remote.hostId}:${remote.remotePath}`,
        isRemote: true,
        hostId: remote.hostId,
        cwd: remote.remotePath
      };

      const record: ActiveTerminal = {
        info,
        owner,
        onData,
        onExit,
        scrollback: '',
        orphanTimer: null,
        write: (data: string) => {
          try {
            channel.write(data);
          } catch (_) {}
        },
        resize: (c: number, r: number) => {
          try {
            channel.setWindow(r, c, 0, 0);
          } catch (_) {}
        },
        kill: () => {
          if (record.orphanTimer) {
            clearTimeout(record.orphanTimer);
            record.orphanTimer = null;
          }
          try {
            channel.close();
          } catch (_) {}
          this.sessions.delete(id);
        }
      };

      this.sessions.set(id, record);

      const emitChunk = (chunk: string) => {
        this.appendScrollback(record, chunk);
        record.onData(id, chunk);
      };

      channel.setEncoding('utf8');
      channel.stderr.setEncoding('utf8');
      channel.on('data', emitChunk);
      channel.stderr.on('data', emitChunk);
      channel.on('error', (err: Error) => emitChunk(`\r\n\x1b[31m[${err.message}]\x1b[0m\r\n`));
      channel.on('close', (code?: number) => {
        if (record.orphanTimer) {
          clearTimeout(record.orphanTimer);
          record.orphanTimer = null;
        }
        this.sessions.delete(id);
        record.onExit(id, typeof code === 'number' ? code : 0);
      });

      if (initialCommand) {
        setTimeout(() => {
          try {
            channel.write(initialCommand + '\n');
          } catch (_) {}
        }, 250);
      }

      return info;
    }

    // Local shell session
    const cwd = repo && fs.existsSync(repo) ? repo : os.homedir();
    const defaultShell = resolveDefaultLocalShell(shellPath);
    const py3 = findWorkingPython3();

    let proc: cp.ChildProcess;
    let resizePipe: Writable | null = null;

    if (py3) {
      // Dedicated fd 3 carries out-of-band RESIZE:CxR\n frames so stdin (fd 0) remains 100% 8-bit clean
      const pyScript = [
        'import os, pty, sys, select, struct, fcntl, termios, signal',
        'shell = sys.argv[1]',
        'cols, rows = int(sys.argv[2]), int(sys.argv[3])',
        'pid, fd = pty.fork()',
        'if pid == 0:',
        '    try: os.close(3)',
        '    except OSError: pass',
        '    os.environ["TERM"] = "xterm-256color"',
        '    os.execvp(shell, [shell, "-l"])',
        'def set_winsz(c, r):',
        '    try:',
        '        fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", r, c, 0, 0))',
        '        os.killpg(pid, signal.SIGWINCH)',
        '    except OSError: pass',
        'set_winsz(cols, rows)',
        'def cleanup(*_):',
        '    try: os.close(fd)',
        '    except OSError: pass',
        '    try: os.killpg(pid, signal.SIGHUP)',
        '    except OSError: pass',
        'signal.signal(signal.SIGTERM, lambda *_: (cleanup(), os._exit(0)))',
        'signal.signal(signal.SIGINT, lambda *_: (cleanup(), os._exit(0)))',
        'stdin_fd = sys.stdin.fileno()',
        'stdout_fd = sys.stdout.fileno()',
        'ctrl_fd = 3',
        'ctrl_buf = b""',
        'watch = [fd, stdin_fd, ctrl_fd]',
        'try:',
        '    while True:',
        '        r, _, _ = select.select(watch, [], [])',
        '        if fd in r:',
        '            try:',
        '                data = os.read(fd, 8192)',
        '                if not data: break',
        '                os.write(stdout_fd, data)',
        '            except OSError: break',
        '        if stdin_fd in r:',
        '            chunk = os.read(stdin_fd, 4096)',
        '            if not chunk: break',
        '            os.write(fd, chunk)',
        '        if ctrl_fd in r:',
        '            cchunk = os.read(ctrl_fd, 256)',
        '            if not cchunk:',
        '                watch = [x for x in watch if x != ctrl_fd]',
        '                continue',
        '            ctrl_buf += cchunk',
        '            while b"\\n" in ctrl_buf:',
        '                line, ctrl_buf = ctrl_buf.split(b"\\n", 1)',
        '                if line.startswith(b"RESIZE:"):',
        '                    try:',
        '                        c_s, r_s = line[7:].split(b"x", 1)',
        '                        set_winsz(int(c_s), int(r_s))',
        '                    except Exception: pass',
        'finally:',
        '    cleanup()',
        'try:',
        '    _, status = os.waitpid(pid, 0)',
        '    sys.exit(os.waitstatus_to_exitcode(status))',
        'except Exception:',
        '    sys.exit(0)'
      ].join('\n');

      proc = cp.spawn(py3, ['-u', '-c', pyScript, defaultShell, String(cols || 100), String(rows || 28)], {
        cwd,
        env: { ...process.env, TERM: 'xterm-256color' },
        stdio: ['pipe', 'pipe', 'pipe', 'pipe']
      });
      resizePipe = (proc.stdio[3] as Writable) || null;
      resizePipe?.on('error', () => {});
    } else {
      const isPowerShell = process.platform === 'win32' && /pwsh|powershell/i.test(defaultShell);
      const args = process.platform === 'win32' ? (isPowerShell ? ['-NoLogo'] : []) : ['-i'];
      proc = cp.spawn(defaultShell, args, {
        cwd,
        env: { ...process.env, TERM: 'xterm-256color' }
      });
    }

    const info: TerminalSessionInfo = {
      id,
      repo: cwd,
      title: name || `Local: ${cwd.split(/[\\/]/).pop() || cwd}`,
      isRemote: false,
      cwd
    };

    const record: ActiveTerminal = {
      info,
      owner,
      onData,
      onExit,
      scrollback: '',
      orphanTimer: null,
      write: (data: string) => {
        if (proc.stdin && !proc.stdin.destroyed) proc.stdin.write(data);
      },
      resize: (c: number, r: number) => {
        if (resizePipe && !resizePipe.destroyed) {
          resizePipe.write(`RESIZE:${Math.max(2, Math.floor(c))}x${Math.max(2, Math.floor(r))}\n`);
        }
      },
      kill: () => {
        if (record.orphanTimer) {
          clearTimeout(record.orphanTimer);
          record.orphanTimer = null;
        }
        try {
          resizePipe?.destroy();
        } catch (_) {}
        try {
          proc.kill('SIGTERM');
        } catch (_) {}
        this.sessions.delete(id);
      }
    };

    this.sessions.set(id, record);

    const emitChunk = (chunk: string) => {
      this.appendScrollback(record, chunk);
      record.onData(id, chunk);
    };

    proc.stdout?.setEncoding('utf8');
    proc.stderr?.setEncoding('utf8');
    proc.stdout?.on('data', emitChunk);
    proc.stderr?.on('data', emitChunk);
    proc.stdin?.on('error', () => {});

    let exited = false;
    const finish = (code: number) => {
      if (exited) return;
      exited = true;
      if (record.orphanTimer) {
        clearTimeout(record.orphanTimer);
        record.orphanTimer = null;
      }
      this.sessions.delete(id);
      record.onExit(id, code);
    };

    proc.on('error', (err) => {
      emitChunk(`\r\n\x1b[31m[Unable to start the shell: ${err.message}]\x1b[0m\r\n`);
      finish(1);
    });
    proc.on('close', (code) => finish(typeof code === 'number' ? code : 0));

    if (initialCommand && proc.stdin) {
      setTimeout(() => {
        if (proc.stdin && !proc.stdin.destroyed) {
          proc.stdin.write(initialCommand + (process.platform === 'win32' ? '\r\n' : '\n'));
        }
      }, 200);
    }

    return info;
  }

  public write(id: string, data: string) {
    this.sessions.get(id)?.write(data);
  }

  public resize(id: string, cols: number, rows: number) {
    this.sessions.get(id)?.resize(cols, rows);
  }

  public close(id: string) {
    this.sessions.get(id)?.kill();
  }

  public closeAll() {
    for (const id of Array.from(this.sessions.keys())) {
      this.close(id);
    }
  }
}
