import * as cp from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import { ClientChannel } from 'ssh2';
import { parseRemoteRepo } from '../remote/repoTransport';
import { quotePosixArg, sshManager } from '../remote/sshManager';

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
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
}

function findPython3(): string | null {
  if (process.platform === 'win32') return null;
  for (const candidate of ['/usr/bin/python3', '/opt/homebrew/bin/python3', '/usr/local/bin/python3']) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Manages built-in interactive terminal sessions (Local PTY/Shell & Remote SSH PTY)
 * as well as launching external system terminals.
 */
export class TerminalManager {
  private readonly sessions = new Map<string, ActiveTerminal>();

  public async createSession(
    repo: string,
    name: string | undefined,
    cols: number,
    rows: number,
    initialCommand: string | null | undefined,
    onData: (id: string, chunk: string) => void,
    onExit: (id: string, code: number) => void
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

      channel.on('data', (chunk: Buffer) => onData(id, chunk.toString('utf8')));
      channel.stderr.on('data', (chunk: Buffer) => onData(id, chunk.toString('utf8')));
      channel.on('close', (code?: number) => {
        this.sessions.delete(id);
        onExit(id, typeof code === 'number' ? code : 0);
      });

      if (initialCommand) {
        setTimeout(() => {
          channel.write(initialCommand + '\n');
        }, 250);
      }

      this.sessions.set(id, {
        info,
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
          try {
            channel.close();
          } catch (_) {}
          this.sessions.delete(id);
        }
      });

      return info;
    }

    // Local shell session
    const cwd = repo && fs.existsSync(repo) ? repo : os.homedir();
    const defaultShell =
      process.platform === 'win32'
        ? process.env.COMSPEC || 'powershell.exe'
        : process.env.SHELL || '/bin/zsh';

    const py3 = findPython3();
    let proc: cp.ChildProcess;
    let isPyPty = false;

    if (py3) {
      // Lightweight pure-Python POSIX PTY bridge (no native node-gyp addons needed, supports resize & colors!)
      const pyScript = [
        'import os, pty, sys, select, struct, fcntl, termios, signal',
        'shell = sys.argv[1]',
        'cols, rows = int(sys.argv[2]), int(sys.argv[3])',
        'pid, fd = pty.fork()',
        'if pid == 0:',
        '    os.environ["TERM"] = "xterm-256color"',
        '    os.execvp(shell, [shell, "-l"])',
        'fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))',
        'stdin_fd = sys.stdin.fileno()',
        'stdout_fd = sys.stdout.fileno()',
        'buf = b""',
        'while True:',
        '    r, _, _ = select.select([fd, stdin_fd], [], [])',
        '    if fd in r:',
        '        try:',
        '            data = os.read(fd, 8192)',
        '            if not data: break',
        '            os.write(stdout_fd, data)',
        '        except OSError:',
        '            break',
        '    if stdin_fd in r:',
        '        chunk = os.read(stdin_fd, 4096)',
        '        if not chunk: break',
        '        if b"\\x00RESIZE:" in chunk:',
        '            parts = chunk.split(b"\\x00")',
        '            out = []',
        '            for p in parts:',
        '                if p.startswith(b"RESIZE:"):',
        '                    try:',
        '                        _, dims = p.split(b":", 1)',
        '                        c, rw = map(int, dims.split(b"x"))',
        '                        fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", rw, c, 0, 0))',
        '                        os.kill(pid, signal.SIGWINCH)',
        '                    except Exception: pass',
        '                else:',
        '                    out.append(p)',
        '            chunk = b"".join(out)',
        '        if chunk: os.write(fd, chunk)',
        'try:',
        '    _, status = os.waitpid(pid, 0)',
        '    sys.exit(os.waitstatus_to_exitcode(status))',
        'except Exception:',
        '    sys.exit(0)'
      ].join('\n');

      proc = cp.spawn(py3, ['-u', '-c', pyScript, defaultShell, String(cols || 100), String(rows || 28)], {
        cwd,
        env: { ...process.env, TERM: 'xterm-256color' }
      });
      isPyPty = true;
    } else {
      const args = process.platform === 'win32' ? [] : ['-i'];
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

    proc.stdout?.on('data', (chunk: Buffer) => onData(id, chunk.toString('utf8')));
    proc.stderr?.on('data', (chunk: Buffer) => onData(id, chunk.toString('utf8')));
    proc.on('close', (code) => {
      this.sessions.delete(id);
      onExit(id, typeof code === 'number' ? code : 0);
    });

    if (initialCommand && proc.stdin) {
      setTimeout(() => {
        proc.stdin?.write(initialCommand + (process.platform === 'win32' ? '\r\n' : '\n'));
      }, 200);
    }

    this.sessions.set(id, {
      info,
      write: (data: string) => {
        proc.stdin?.write(data);
      },
      resize: (c: number, r: number) => {
        if (isPyPty && proc.stdin) {
          proc.stdin.write(`\x00RESIZE:${c}x${r}\x00`);
        }
      },
      kill: () => {
        try {
          proc.kill();
        } catch (_) {}
        this.sessions.delete(id);
      }
    });

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

  /**
   * Open the repository path in the user's native OS system terminal (Terminal.app, Windows Terminal/cmd, or Linux terminal).
   */
  public openExternalSystemTerminal(repo: string): string | null {
    const remote = parseRemoteRepo(repo);
    try {
      if (process.platform === 'darwin') {
        if (remote !== null) {
          const profile = sshManager.resolveProfile(remote.hostId);
          const sshTarget = profile.source === 'ssh-config'
            ? profile.id
            : `${profile.user}@${profile.host}`;
          const portFlag = profile.source !== 'ssh-config' && profile.port !== 22 ? `-p ${profile.port} ` : '';
          const remoteCmd = `ssh -t ${portFlag}${quotePosixArg(sshTarget)} "cd ${remote.remotePath.replace(/"/g, '\\"')} && exec \\$SHELL -l"`;
          const appleScript = `tell application "Terminal"\nactivate\ndo script ${JSON.stringify(remoteCmd)}\nend tell`;
          cp.spawn('osascript', ['-e', appleScript], { detached: true, stdio: 'ignore' }).unref();
        } else {
          cp.spawn('open', ['-a', 'Terminal', repo], { detached: true, stdio: 'ignore' }).unref();
        }
        return null;
      } else if (process.platform === 'win32') {
        if (remote !== null) {
          const profile = sshManager.resolveProfile(remote.hostId);
          const target = profile.source === 'ssh-config' ? profile.id : `${profile.user}@${profile.host}`;
          cp.spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/k', `ssh -t ${target} "cd '${remote.remotePath}' && exec $SHELL -l"`], {
            detached: true,
            stdio: 'ignore'
          }).unref();
        } else {
          cp.spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/k', `cd /d "${repo}"`], {
            detached: true,
            stdio: 'ignore'
          }).unref();
        }
        return null;
      } else {
        const terms = ['x-terminal-emulator', 'gnome-terminal', 'konsole', 'xfce4-terminal', 'xterm'];
        for (const term of terms) {
          try {
            cp.spawn(term, [], { cwd: remote ? os.homedir() : repo, detached: true, stdio: 'ignore' }).unref();
            return null;
          } catch (_) {}
        }
        return 'No supported external terminal emulator found.';
      }
    } catch (err) {
      return String(err);
    }
  }
}
