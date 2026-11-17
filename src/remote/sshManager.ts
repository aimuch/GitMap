import * as cp from 'child_process';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PassThrough } from 'stream';
import { AnyAuthMethod, Client, ClientChannel, ConnectConfig, SFTPWrapper, utils as sshUtils } from 'ssh2';
import { hostBridge } from '../platform/hostBridge';
import * as vscode from '../platform/vscode';
import { parseUserSshConfig, SshConfigHostEntry } from './sshConfigParser';

export interface SshHostProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  authType: 'auto' | 'key' | 'password' | 'agent';
  privateKeyPath?: string;
  proxyJump?: string;
  defaultPath?: string;
  source: 'ssh-config' | 'saved';
  /** GitMap-only display name (doesn't change the host's id, so repositories on it keep working). */
  alias?: string;
  /** GitMap-only tags (e.g. prod, staging, gpu). */
  tags?: string[];
  connected?: boolean;
  homeDir?: string;
  gitVersion?: string | null;
}

export interface RemoteDirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isSymlink: boolean;
  isGitRepo: boolean;
  gitBranch: string | null;
  size: number;
  mtime: number;
}

export interface RemoteDirectoryListing {
  hostId: string;
  currentPath: string;
  parentPath: string | null;
  homeDir: string;
  currentRepoRoot: string | null;
  currentRepoBranch: string | null;
  entries: RemoteDirectoryEntry[];
}

export interface RemoteDiscoveredRepo {
  name: string;
  path: string;
  sshUri: string;
  branch: string | null;
}

interface ActiveSshSession {
  hostId: string;
  profile: SshHostProfile;
  client: Client;
  sftp: SFTPWrapper | null;
  homeDir: string;
  gitVersion: string | null;
  jumpClient?: Client;
}

export function quotePosixArg(arg: string): string {
  return "'" + arg.replace(/'/g, "'\\''") + "'";
}

function defaultAgentSocket(): string | undefined {
  if (process.platform === 'win32') {
    return process.env.SSH_AUTH_SOCK || '\\\\.\\pipe\\openssh-ssh-agent';
  }
  return process.env.SSH_AUTH_SOCK;
}

function expandTildeLocal(p: string): string {
  if (p === '~') return os.homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) {
    return path.join(os.homedir(), p.substring(2));
  }
  return p;
}

interface HostMeta {
  alias?: string;
  tags?: string[];
}

/** Normalise user-entered tags: trimmed, no '#', de-duplicated (case-insensitively), at most 12 of 32 chars each. */
export function normaliseTags(input: unknown): string[] {
  const raw = Array.isArray(input) ? input : typeof input === 'string' ? input.split(/[,，\s]+/) : [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const item of raw) {
    const tag = String(item).trim().replace(/^#+/, '').slice(0, 32);
    if (!tag || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    tags.push(tag);
    if (tags.length >= 12) break;
  }
  return tags;
}

export class SshManager {
  private savedProfiles: SshHostProfile[] = [];
  private hostMeta: { [hostId: string]: HostMeta } = {};
  private metaFilePath: string = '';
  private readonly sessions = new Map<string, ActiveSshSession>();
  private readonly connecting = new Map<string, Promise<ActiveSshSession>>();
  private readonly sessionPasswords = new Map<string, string>();
  private profilesFilePath: string = '';
  private secrets: vscode.SecretStorage | null = null;

  public init(dataDir: string, secrets: vscode.SecretStorage) {
    this.profilesFilePath = path.join(dataDir, 'ssh-hosts.json');
    this.metaFilePath = path.join(dataDir, 'ssh-host-meta.json');
    this.secrets = secrets;
    this.loadSavedProfiles();
    try {
      const raw = fs.existsSync(this.metaFilePath) ? JSON.parse(fs.readFileSync(this.metaFilePath, 'utf8')) : {};
      this.hostMeta = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    } catch (_) {
      this.hostMeta = {};
    }
  }

  /**
   * Set the GitMap-only alias & tags of a host (works for ~/.ssh/config hosts too, without editing the config file).
   */
  public async updateHostMeta(hostId: string, alias: unknown, tags: unknown): Promise<void> {
    const cleanAlias = typeof alias === 'string' ? alias.trim().slice(0, 64) : '';
    const cleanTags = normaliseTags(tags);
    if (!cleanAlias && cleanTags.length === 0) delete this.hostMeta[hostId];
    else this.hostMeta[hostId] = { ...(cleanAlias ? { alias: cleanAlias } : {}), ...(cleanTags.length ? { tags: cleanTags } : {}) };
    if (!this.metaFilePath) return;
    await fs.promises.mkdir(path.dirname(this.metaFilePath), { recursive: true });
    await fs.promises.writeFile(this.metaFilePath, JSON.stringify(this.hostMeta, null, 2), 'utf8');
  }

  /** All tags in use, for suggestions. */
  public listTags(): string[] {
    const all = new Map<string, string>();
    for (const meta of Object.values(this.hostMeta)) {
      for (const tag of meta.tags || []) if (!all.has(tag.toLowerCase())) all.set(tag.toLowerCase(), tag);
    }
    return Array.from(all.values()).sort((a, b) => a.localeCompare(b));
  }

  private loadSavedProfiles() {
    try {
      if (this.profilesFilePath && fs.existsSync(this.profilesFilePath)) {
        const raw = JSON.parse(fs.readFileSync(this.profilesFilePath, 'utf8'));
        if (Array.isArray(raw)) {
          this.savedProfiles = raw;
        }
      }
    } catch (_) {
      this.savedProfiles = [];
    }
  }

  private async persistSavedProfiles() {
    if (!this.profilesFilePath) return;
    try {
      await fs.promises.mkdir(path.dirname(this.profilesFilePath), { recursive: true });
      await fs.promises.writeFile(this.profilesFilePath, JSON.stringify(this.savedProfiles, null, 2), 'utf8');
    } catch (_) {}
  }

  /**
   * List all available SSH hosts: saved profiles merged with ~/.ssh/config entries.
   */
  public listHosts(): SshHostProfile[] {
    const configEntries: SshConfigHostEntry[] = parseUserSshConfig();
    const defaultUser = os.userInfo().username;
    const byId = new Map<string, SshHostProfile>();

    for (const entry of configEntries) {
      const active = this.sessions.get(entry.alias);
      byId.set(entry.alias, {
        id: entry.alias,
        name: entry.alias,
        host: entry.hostName,
        port: entry.port,
        user: entry.user || defaultUser,
        authType: entry.identityFiles.length > 0 ? 'key' : 'auto',
        privateKeyPath: entry.identityFiles[0],
        proxyJump: entry.proxyJump,
        source: 'ssh-config',
        alias: this.hostMeta[entry.alias]?.alias,
        tags: this.hostMeta[entry.alias]?.tags || [],
        connected: !!active,
        homeDir: active?.homeDir,
        gitVersion: active?.gitVersion
      });
    }

    for (const saved of this.savedProfiles) {
      const active = this.sessions.get(saved.id);
      byId.set(saved.id, {
        ...saved,
        source: 'saved',
        alias: this.hostMeta[saved.id]?.alias,
        tags: this.hostMeta[saved.id]?.tags || [],
        connected: !!active,
        homeDir: active?.homeDir,
        gitVersion: active?.gitVersion
      });
    }

    return Array.from(byId.values()).sort((a, b) => (a.alias || a.name).localeCompare(b.alias || b.name));
  }

  public async saveHost(
    input: {
      id?: string;
      name: string;
      host: string;
      port?: number;
      user: string;
      authType?: 'auto' | 'key' | 'password' | 'agent';
      privateKeyPath?: string;
      proxyJump?: string;
      defaultPath?: string;
      password?: string;
      passphrase?: string;
    }
  ): Promise<SshHostProfile> {
    const cleanName = input.name.trim() || `${input.user.trim()}@${input.host.trim()}`;
    const id = (input.id?.trim() || cleanName.replace(/[^a-zA-Z0-9._@-]/g, '-')).replace(/\/+/g, '-');
    const profile: SshHostProfile = {
      id,
      name: cleanName,
      host: input.host.trim(),
      port: Number(input.port) || 22,
      user: input.user.trim() || os.userInfo().username,
      authType: input.authType || 'auto',
      privateKeyPath: input.privateKeyPath?.trim() || undefined,
      proxyJump: input.proxyJump?.trim() || undefined,
      defaultPath: input.defaultPath?.trim() || undefined,
      source: 'saved'
    };

    const existingIdx = this.savedProfiles.findIndex((p) => p.id === id);
    if (existingIdx > -1) {
      this.savedProfiles[existingIdx] = profile;
    } else {
      this.savedProfiles.push(profile);
    }
    await this.persistSavedProfiles();

    if (this.secrets) {
      if (typeof input.password === 'string' && input.password !== '') {
        await this.secrets.store(`ssh.password.${id}`, input.password);
      }
      if (typeof input.passphrase === 'string' && input.passphrase !== '') {
        await this.secrets.store(`ssh.passphrase.${id}`, input.passphrase);
      }
    }

    // Disconnect old session if settings changed so next use reconnects cleanly
    this.disconnect(id);
    return profile;
  }

  public async removeHost(id: string): Promise<boolean> {
    this.disconnect(id);
    const before = this.savedProfiles.length;
    this.savedProfiles = this.savedProfiles.filter((p) => p.id !== id);
    await this.persistSavedProfiles();
    if (this.hostMeta[id]) await this.updateHostMeta(id, '', []);
    if (this.secrets) {
      await this.secrets.delete(`ssh.password.${id}`);
      await this.secrets.delete(`ssh.passphrase.${id}`);
    }
    return this.savedProfiles.length < before;
  }

  public resolveProfile(hostId: string): SshHostProfile {
    const all = this.listHosts();
    const matched = all.find((h) => h.id === hostId);
    if (matched) return matched;

    // Support ad-hoc user@host:port
    const adHoc = hostId.match(/^(?:([^@]+)@)?([^:]+)(?::(\d+))?$/);
    if (adHoc) {
      return {
        id: hostId,
        name: hostId,
        user: adHoc[1] || os.userInfo().username,
        host: adHoc[2],
        port: adHoc[3] ? parseInt(adHoc[3], 10) : 22,
        authType: 'auto',
        source: 'saved'
      };
    }

    throw new Error(`Unknown SSH host "${hostId}"`);
  }

  public disconnect(hostId: string) {
    const session = this.sessions.get(hostId);
    if (session) {
      this.sessions.delete(hostId);
      try {
        session.client.end();
      } catch (_) {}
      if (session.jumpClient) {
        try {
          session.jumpClient.end();
        } catch (_) {}
      }
    }
  }

  public disconnectAll() {
    for (const id of Array.from(this.sessions.keys())) {
      this.disconnect(id);
    }
  }

  public isConnected(hostId: string): boolean {
    return this.sessions.has(hostId);
  }

  public async ensureConnected(hostId: string): Promise<ActiveSshSession> {
    const existing = this.sessions.get(hostId);
    if (existing) return existing;

    const inFlight = this.connecting.get(hostId);
    if (inFlight) return inFlight;

    const promise = this.establishConnection(hostId).finally(() => {
      this.connecting.delete(hostId);
    });
    this.connecting.set(hostId, promise);
    return promise;
  }

  private collectCandidateKeyFiles(profile: SshHostProfile): string[] {
    const candidates: string[] = [];
    if (profile.privateKeyPath) {
      const p = expandTildeLocal(profile.privateKeyPath);
      if (fs.existsSync(p)) candidates.push(p);
    }
    const configEntries = parseUserSshConfig();
    const cfgMatch = configEntries.find((e) => e.alias === profile.id);
    if (cfgMatch) {
      for (const f of cfgMatch.identityFiles) {
        if (!candidates.includes(f) && fs.existsSync(f)) candidates.push(f);
      }
    }
    const defaultKeys = ['id_ed25519', 'id_rsa', 'id_ecdsa', 'id_dsa'].map((n) => path.join(os.homedir(), '.ssh', n));
    for (const dk of defaultKeys) {
      if (!candidates.includes(dk) && fs.existsSync(dk)) candidates.push(dk);
    }
    return candidates;
  }

  private async establishConnection(hostId: string): Promise<ActiveSshSession> {
    const profile = this.resolveProfile(hostId);
    const storedPassword = (await this.secrets?.get(`ssh.password.${profile.id}`)) || this.sessionPasswords.get(profile.id);
    const storedPassphrase = await this.secrets?.get(`ssh.passphrase.${profile.id}`);

    let sock: NodeJS.ReadableStream & NodeJS.WritableStream | undefined;
    let jumpClient: Client | undefined;

    if (profile.proxyJump) {
      const jumpSession = await this.ensureConnected(profile.proxyJump.split(',')[0].trim());
      jumpClient = jumpSession.client;
      sock = await new Promise<ClientChannel>((resolve, reject) => {
        jumpSession.client.forwardOut('127.0.0.1', 0, profile.host, profile.port, (err, stream) => {
          if (err) reject(err);
          else resolve(stream);
        });
      });
    }

    const authQueue: AnyAuthMethod[] = [];
    const agentSock = defaultAgentSocket();

    if (profile.authType === 'password' && storedPassword) {
      authQueue.push({ type: 'password', username: profile.user, password: storedPassword });
    }

    if (profile.authType !== 'password' && agentSock) {
      authQueue.push({ type: 'agent', username: profile.user, agent: agentSock });
    }

    if (profile.authType !== 'agent' && profile.authType !== 'password') {
      for (const keyFile of this.collectCandidateKeyFiles(profile)) {
        try {
          const rawKey = fs.readFileSync(keyFile);
          const parsed = sshUtils.parseKey(rawKey, storedPassphrase);
          if (!(parsed instanceof Error)) {
            authQueue.push({
              type: 'publickey',
              username: profile.user,
              key: rawKey,
              passphrase: storedPassphrase
            });
          } else if (/encrypted|passphrase/i.test(parsed.message)) {
            const promptedPass = await hostBridge.getHandlers().onInputBox?.({
              title: `SSH Key Passphrase (${profile.name})`,
              prompt: `Enter passphrase for private key ${path.basename(keyFile)}:`,
              password: true
            });
            if (promptedPass) {
              await this.secrets?.store(`ssh.passphrase.${profile.id}`, promptedPass);
              authQueue.push({
                type: 'publickey',
                username: profile.user,
                key: rawKey,
                passphrase: promptedPass
              });
            }
          }
        } catch (_) {}
      }
    }

    if (storedPassword && profile.authType !== 'password') {
      authQueue.push({ type: 'password', username: profile.user, password: storedPassword });
    }

    const client = new Client();
    let queueIndex = 0;
    let promptedInteractivePassword = false;

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const done = (err?: Error) => {
        if (settled) return;
        settled = true;
        if (err) reject(err);
        else resolve();
      };

      client.on('ready', () => done());
      client.on('error', (err) => done(err));
      client.on('close', () => {
        this.sessions.delete(hostId);
        done(new Error(`SSH connection to "${profile.name}" closed`));
      });

      const connectCfg: ConnectConfig = {
        host: profile.host,
        port: profile.port,
        username: profile.user,
        sock: sock as any,
        readyTimeout: 20000,
        keepaliveInterval: 15000,
        keepaliveCountMax: 3,
        authHandler: (methodsLeft, _partialSuccess, callback) => {
          while (queueIndex < authQueue.length) {
            const candidate = authQueue[queueIndex++];
            if (methodsLeft === null || methodsLeft.includes(candidate.type)) {
              return callback(candidate);
            }
          }
          // If silent methods failed and server accepts password or keyboard-interactive, prompt user!
          const canPassword = methodsLeft === null || methodsLeft.includes('password');
          const canKbd = methodsLeft !== null && methodsLeft.includes('keyboard-interactive');
          if (!promptedInteractivePassword && (canPassword || canKbd)) {
            promptedInteractivePassword = true;
            const inputHandler = hostBridge.getHandlers().onInputBox;
            if (!inputHandler) {
              return callback(false as any);
            }
            inputHandler({
              title: `SSH Authentication (${profile.user}@${profile.host})`,
              prompt: `Enter password for ${profile.user}@${profile.host}:${profile.port}`,
              password: true
            })
              .then((pwd) => {
                if (!pwd) {
                  callback(false as any);
                  return;
                }
                this.sessionPasswords.set(profile.id, pwd);
                if (canPassword) {
                  callback({ type: 'password', username: profile.user, password: pwd });
                } else {
                  callback({
                    type: 'keyboard-interactive',
                    username: profile.user,
                    prompt: (_name, _instr, _lang, prompts, finish) => {
                      finish(prompts.map(() => pwd));
                    }
                  });
                }
              })
              .catch(() => callback(false as any));
            return;
          }
          callback(false as any);
        }
      };

      client.connect(connectCfg);
    });

    const probe = await this.execRawOnClient(client, 'printf "%s\\n" "$HOME"; git --version 2>/dev/null || true');
    const probeLines = probe.stdout.toString('utf8').split(/\r?\n/);
    const homeDir = (probeLines[0] || '/root').trim() || '/';
    const gitVerLine = probeLines.find((l) => l.startsWith('git version '));
    const gitVersion = gitVerLine ? gitVerLine.replace(/^git version\s+/, '').trim() : null;

    const session: ActiveSshSession = {
      hostId,
      profile,
      client,
      sftp: null,
      homeDir,
      gitVersion,
      jumpClient
    };
    this.sessions.set(hostId, session);
    return session;
  }

  public async getSftp(hostId: string): Promise<SFTPWrapper> {
    const session = await this.ensureConnected(hostId);
    if (session.sftp) return session.sftp;
    const sftp = await new Promise<SFTPWrapper>((resolve, reject) => {
      session.client.sftp((err, wrapper) => {
        if (err) reject(err);
        else resolve(wrapper);
      });
    });
    sftp.on('close', () => {
      if (session.sftp === sftp) session.sftp = null;
    });
    session.sftp = sftp;
    return sftp;
  }

  private execRawOnClient(
    client: Client,
    shellCommand: string,
    input: Buffer | string | null = null,
    cancellation?: { readonly isCancellationRequested: boolean; onCancellationRequested: (listener: () => any) => { dispose: () => any } } | null
  ): Promise<{ code: number; stdout: Buffer; stderr: string }> {
    return new Promise((resolve, reject) => {
      client.exec(shellCommand, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }
        const outChunks: Buffer[] = [];
        const errChunks: Buffer[] = [];
        let exitCode = 0;
        let cancelDisp: vscode.Disposable | null = null;

        if (cancellation) {
          if (cancellation.isCancellationRequested) {
            try {
              stream.close();
            } catch (_) {}
            resolve({ code: 130, stdout: Buffer.alloc(0), stderr: 'Cancelled' });
            return;
          }
          cancelDisp = cancellation.onCancellationRequested(() => {
            try {
              stream.signal('TERM');
              stream.close();
            } catch (_) {}
          });
        }

        stream.on('data', (chunk: Buffer) => outChunks.push(Buffer.from(chunk)));
        stream.stderr.on('data', (chunk: Buffer) => errChunks.push(Buffer.from(chunk)));
        stream.on('exit', (code: number | null) => {
          exitCode = typeof code === 'number' ? code : 0;
        });
        stream.on('close', (code?: number | null) => {
          cancelDisp?.dispose();
          if (typeof code === 'number') exitCode = code;
          resolve({
            code: exitCode,
            stdout: Buffer.concat(outChunks),
            stderr: Buffer.concat(errChunks).toString('utf8')
          });
        });

        if (input !== null) {
          stream.on('error', () => {});
          stream.end(input);
        }
      });
    });
  }

  /**
   * Run a shell command on the SSH host (outside any repository).
   */
  public async execRemote(hostId: string, shellCommand: string): Promise<{ code: number; stdout: string; stderr: string }> {
    const session = await this.ensureConnected(hostId);
    const res = await this.execRawOnClient(session.client, shellCommand);
    return { code: res.code, stdout: res.stdout.toString('utf8'), stderr: res.stderr };
  }

  /**
   * Complete a partially typed remote path (for Tab completion in the path browser).
   * @returns The directory that was listed, and its entries whose names start with the typed prefix.
   */
  public async completeRemotePath(hostId: string, partial: string, showHidden: boolean): Promise<{ dir: string; prefix: string; entries: { name: string; path: string; isDirectory: boolean }[] }> {
    const raw = partial.trim() === '' ? '~/' : partial;
    const slash = raw.lastIndexOf('/');
    const dirPart = slash === -1 ? '~' : raw.substring(0, slash + 1) || '/';
    const prefix = slash === -1 ? (raw === '~' ? '' : raw) : raw.substring(slash + 1);
    const dir = await this.resolveRemotePath(hostId, dirPart === '~/' ? '~' : dirPart);
    const sftp = await this.getSftp(hostId);
    const list = await new Promise<any[]>((resolve, reject) => {
      sftp.readdir(dir, (err, items) => (err ? reject(err) : resolve(items || [])));
    });
    const matchCase = list.filter((it) => it.filename.startsWith(prefix));
    const lower = prefix.toLowerCase();
    const matched = (matchCase.length > 0 ? matchCase : list.filter((it) => it.filename.toLowerCase().startsWith(lower)))
      .filter((it) => it.filename !== '.' && it.filename !== '..' && (showHidden || prefix.startsWith('.') || !it.filename.startsWith('.')));
    const entries: { name: string; path: string; isDirectory: boolean }[] = [];
    for (const it of matched.slice(0, 200)) {
      const mode: number = it.attrs?.mode || 0;
      let isDirectory = (mode & 0o170000) === 0o040000;
      if ((mode & 0o170000) === 0o120000) {
        isDirectory = await new Promise<boolean>((resolve) => sftp.stat(path.posix.join(dir, it.filename), (err, st) => resolve(!err && !!st && st.isDirectory())));
      }
      entries.push({ name: it.filename, path: path.posix.join(dir, it.filename), isDirectory });
    }
    entries.sort((a, b) => (a.isDirectory !== b.isDirectory ? (a.isDirectory ? -1 : 1) : a.name.localeCompare(b.name)));
    return { dir, prefix, entries };
  }

  public async resolveRemotePath(hostId: string, rawPath?: string): Promise<string> {
    const session = await this.ensureConnected(hostId);
    const trimmed = (rawPath || '').trim();
    if (!trimmed || trimmed === '~') {
      return session.homeDir;
    }
    if (trimmed.startsWith('~/')) {
      return path.posix.normalize(path.posix.join(session.homeDir, trimmed.substring(2)));
    }
    if (!trimmed.startsWith('/')) {
      return path.posix.normalize(path.posix.join(session.homeDir, trimmed));
    }
    return path.posix.normalize(trimmed);
  }

  /**
   * Browse a directory on the remote SSH server (similar to VS Code Remote-SSH Open Folder),
   * enriching child directories with live Git repository & branch indicators.
   */
  public async listRemoteDirectory(hostId: string, targetPath?: string, showHidden: boolean = false): Promise<RemoteDirectoryListing> {
    const session = await this.ensureConnected(hostId);
    const sftp = await this.getSftp(hostId);
    let currentPath = await this.resolveRemotePath(hostId, targetPath || session.profile.defaultPath || '~');

    // Canonicalize symlinked directory if possible
    const real = await new Promise<string>((resolve) => {
      sftp.realpath(currentPath, (err, absPath) => resolve(err || !absPath ? currentPath : absPath));
    });
    currentPath = real;

    const rawEntries = await new Promise<any[]>((resolve, reject) => {
      sftp.readdir(currentPath, (err, list) => {
        if (err) reject(err);
        else resolve(list || []);
      });
    });

    const entries: RemoteDirectoryEntry[] = [];
    for (const item of rawEntries) {
      const name: string = item.filename;
      if (name === '.' || name === '..') continue;
      if (!showHidden && name.startsWith('.')) continue;

      const mode: number = item.attrs?.mode || 0;
      const isSymlink = (mode & 0o170000) === 0o120000;
      let isDir = (mode & 0o170000) === 0o040000;
      const fullEntryPath = path.posix.join(currentPath, name);

      if (isSymlink) {
        isDir = await new Promise<boolean>((resolve) => {
          sftp.stat(fullEntryPath, (err, st) => resolve(!err && !!st && st.isDirectory()));
        });
      }

      entries.push({
        name,
        path: fullEntryPath,
        isDirectory: isDir,
        isSymlink,
        isGitRepo: false,
        gitBranch: null,
        size: item.attrs?.size || 0,
        mtime: item.attrs?.mtime || 0
      });
    }

    // Sort directories first, then alphabetically
    entries.sort((a, b) => (a.isDirectory !== b.isDirectory ? (a.isDirectory ? -1 : 1) : a.name.localeCompare(b.name)));

    // Single fast batch check for current directory git root + child folder git repos!
    const dirEntries = entries.filter((e) => e.isDirectory).slice(0, 150);
    const probeScriptParts = [
      `cd ${quotePosixArg(currentPath)} 2>/dev/null || exit 0`,
      `cur_root=$(git rev-parse --show-toplevel 2>/dev/null || true)`,
      `cur_br=$(git symbolic-ref -q --short HEAD 2>/dev/null || git rev-parse --short HEAD 2>/dev/null || true)`,
      `printf "__CUR__\\t%s\\t%s\\n" "$cur_root" "$cur_br"`
    ];
    if (dirEntries.length > 0) {
      const quotedNames = dirEntries.map((d) => quotePosixArg(d.name)).join(' ');
      probeScriptParts.push(
        `for d in ${quotedNames}; do`,
        `  if [ -d "$d/.git" ] || [ -f "$d/.git" ]; then`,
        `    br=$(git -C "$d" symbolic-ref -q --short HEAD 2>/dev/null || git -C "$d" rev-parse --short HEAD 2>/dev/null || true)`,
        `    printf "__REPO__\\t%s\\t%s\\n" "$d" "$br"`,
        `  fi`,
        `done`
      );
    }

    const probeRes = await this.execRawOnClient(session.client, probeScriptParts.join('\n')).catch(() => null);
    let currentRepoRoot: string | null = null;
    let currentRepoBranch: string | null = null;

    if (probeRes) {
      const byName = new Map(dirEntries.map((d) => [d.name, d]));
      for (const line of probeRes.stdout.toString('utf8').split(/\r?\n/)) {
        if (line.startsWith('__CUR__\t')) {
          const [, root, br] = line.split('\t');
          if (root) {
            currentRepoRoot = root;
            currentRepoBranch = br || null;
          }
        } else if (line.startsWith('__REPO__\t')) {
          const [, dName, br] = line.split('\t');
          const item = byName.get(dName);
          if (item) {
            item.isGitRepo = true;
            item.gitBranch = br || null;
          }
        }
      }
    }

    const parentPath = currentPath === '/' ? null : path.posix.dirname(currentPath);

    return {
      hostId,
      currentPath,
      parentPath,
      homeDir: session.homeDir,
      currentRepoRoot,
      currentRepoBranch,
      entries
    };
  }

  /**
   * Scan a remote directory up to maxDepth to discover all Git repositories inside it.
   */
  public async scanRemoteGitRepos(hostId: string, rootPath: string, maxDepth: number = 3): Promise<RemoteDiscoveredRepo[]> {
    const session = await this.ensureConnected(hostId);
    const resolvedRoot = await this.resolveRemotePath(hostId, rootPath);
    const depth = Math.max(1, Math.min(6, maxDepth));

    const script = [
      `root=${quotePosixArg(resolvedRoot)}`,
      `find "$root" -maxdepth ${depth + 1} \\( -name node_modules -o -name .cache -o -name Library \\) -prune -o -name .git -print 2>/dev/null | head -n 120 | while IFS= read -r gitpath; do`,
      `  repo=$(dirname "$gitpath")`,
      `  br=$(git -C "$repo" symbolic-ref -q --short HEAD 2>/dev/null || git -C "$repo" rev-parse --short HEAD 2>/dev/null || true)`,
      `  printf "%s\\t%s\\n" "$repo" "$br"`,
      `done`
    ].join('\n');

    const res = await this.execRawOnClient(session.client, script);
    const repos: RemoteDiscoveredRepo[] = [];
    const seen = new Set<string>();

    for (const line of res.stdout.toString('utf8').split(/\r?\n/)) {
      if (!line.trim()) continue;
      const [repoPath, br] = line.split('\t');
      if (!repoPath || seen.has(repoPath)) continue;
      seen.add(repoPath);
      repos.push({
        name: path.posix.basename(repoPath) || repoPath,
        path: repoPath,
        sshUri: `ssh://${encodeURIComponent(hostId)}${repoPath.startsWith('/') ? repoPath : '/' + repoPath}`,
        branch: br || null
      });
    }

    return repos.sort((a, b) => a.path.localeCompare(b.path));
  }

  /**
   * Execute a Git command inside a remote repository path.
   */
  public async execRemoteGit(
    hostId: string,
    remoteRepoPath: string,
    args: string[],
    options?: {
      input?: Buffer | string | null;
      env?: { [name: string]: string } | null;
      cancellation?: { readonly isCancellationRequested: boolean; onCancellationRequested: (listener: () => any) => { dispose: () => any } } | null;
    }
  ): Promise<{ code: number; stdout: Buffer; stderr: string }> {
    const session = await this.ensureConnected(hostId);
    const envVars: string[] = ['LC_MESSAGES=C', 'LANGUAGE=C', 'GIT_TERMINAL_PROMPT=0'];
    if (options?.env) {
      for (const [k, v] of Object.entries(options.env)) {
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(k) && typeof v === 'string') {
          envVars.push(`${k}=${quotePosixArg(v)}`);
        }
      }
    }
    const quotedArgs = args.map(quotePosixArg).join(' ');
    const cmd = `cd ${quotePosixArg(remoteRepoPath)} && env ${envVars.join(' ')} git ${quotedArgs}`;
    return this.execRawOnClient(session.client, cmd, options?.input ?? null, options?.cancellation ?? null);
  }

  /**
   * Spawn a ChildProcess-compatible stream for streaming Git commands on a remote SSH host.
   */
  public spawnRemoteGitProcess(
    hostId: string,
    remoteRepoPath: string,
    args: string[],
    env: { [name: string]: string } = {}
  ): cp.ChildProcess {
    const fakeProc = new EventEmitter() as any;
    const stdoutPass = new PassThrough();
    const stderrPass = new PassThrough();
    const stdinPass = new PassThrough();
    fakeProc.stdout = stdoutPass;
    fakeProc.stderr = stderrPass;
    fakeProc.stdin = stdinPass;
    fakeProc.killed = false;

    let activeStream: ClientChannel | null = null;
    fakeProc.kill = () => {
      fakeProc.killed = true;
      if (activeStream) {
        try {
          activeStream.signal('TERM');
          activeStream.close();
        } catch (_) {}
      }
      return true;
    };

    this.ensureConnected(hostId)
      .then((session) => {
        if (fakeProc.killed) return;
        const envVars: string[] = ['LC_MESSAGES=C', 'LANGUAGE=C', 'GIT_TERMINAL_PROMPT=0'];
        for (const [k, v] of Object.entries(env)) {
          if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(k) && typeof v === 'string') {
            envVars.push(`${k}=${quotePosixArg(v)}`);
          }
        }
        const cmd = `cd ${quotePosixArg(remoteRepoPath)} && env ${envVars.join(' ')} git ${args.map(quotePosixArg).join(' ')}`;
        session.client.exec(cmd, (err, stream) => {
          if (err) {
            fakeProc.emit('error', err);
            fakeProc.emit('close', 1, null);
            return;
          }
          activeStream = stream;
          if (fakeProc.killed) {
            stream.close();
            return;
          }
          stdinPass.pipe(stream);
          stream.pipe(stdoutPass);
          stream.stderr.pipe(stderrPass);
          let exitCode: number | null = 0;
          stream.on('exit', (code: number | null) => {
            exitCode = code;
          });
          stream.on('close', (code?: number | null) => {
            if (typeof code === 'number') exitCode = code;
            fakeProc.emit('exit', exitCode, null);
            fakeProc.emit('close', exitCode, null);
          });
          stream.on('error', (streamErr: Error) => {
            fakeProc.emit('error', streamErr);
          });
        });
      })
      .catch((err) => {
        stderrPass.end(String(err));
        stdoutPass.end();
        fakeProc.emit('error', err instanceof Error ? err : new Error(String(err)));
        fakeProc.emit('close', 1, null);
      });

    return fakeProc as cp.ChildProcess;
  }

  /* Remote SFTP Helpers */

  public async readRemoteFile(hostId: string, remotePath: string, maxBytes?: number): Promise<Buffer> {
    const sftp = await this.getSftp(hostId);
    if (typeof maxBytes === 'number' && maxBytes > 0) {
      return new Promise<Buffer>((resolve, reject) => {
        sftp.open(remotePath, 'r', (openErr, handle) => {
          if (openErr) return reject(openErr);
          const buf = Buffer.alloc(maxBytes);
          sftp.read(handle, buf, 0, maxBytes, 0, (readErr, bytesRead) => {
            sftp.close(handle, () => {});
            if (readErr) reject(readErr);
            else resolve(buf.subarray(0, bytesRead));
          });
        });
      });
    }
    return new Promise<Buffer>((resolve, reject) => {
      sftp.readFile(remotePath, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
  }

  public async writeRemoteFile(hostId: string, remotePath: string, content: Buffer | string): Promise<void> {
    const session = await this.ensureConnected(hostId);
    const parent = path.posix.dirname(remotePath);
    await this.execRawOnClient(session.client, `mkdir -p ${quotePosixArg(parent)}`);
    const sftp = await this.getSftp(hostId);
    const buf = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
    await new Promise<void>((resolve, reject) => {
      sftp.writeFile(remotePath, buf, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  public async remoteExists(hostId: string, remotePath: string): Promise<boolean> {
    try {
      const sftp = await this.getSftp(hostId);
      return await new Promise<boolean>((resolve) => {
        sftp.stat(remotePath, (err) => resolve(!err));
      });
    } catch (_) {
      return false;
    }
  }

  public async checkFirstExistingPath(hostId: string, baseDir: string, relOrAbsPaths: string[]): Promise<number> {
    const session = await this.ensureConnected(hostId);
    const resolvedPaths = relOrAbsPaths.map((p) => (p.startsWith('/') ? p : path.posix.resolve(baseDir, p)));
    const checks = resolvedPaths
      .map((p, idx) => `if [ -e ${quotePosixArg(p)} ]; then printf "%d\\n" ${idx}; exit 0; fi`)
      .join('; ');
    const res = await this.execRawOnClient(session.client, checks);
    const out = res.stdout.toString('utf8').trim();
    return out !== '' ? parseInt(out, 10) : -1;
  }

  public async createRemoteTempDir(hostId: string, prefix: string, files: { [name: string]: string | Buffer }): Promise<string> {
    const session = await this.ensureConnected(hostId);
    const rand = crypto.randomBytes(8).toString('hex');
    const dir = `/tmp/${prefix}${rand}`;
    await this.execRawOnClient(session.client, `mkdir -m 700 -p ${quotePosixArg(dir)}`);
    const sftp = await this.getSftp(hostId);
    for (const [name, content] of Object.entries(files)) {
      const buf = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
      await new Promise<void>((resolve, reject) => {
        sftp.writeFile(path.posix.join(dir, name), buf, (err) => (err ? reject(err) : resolve()));
      });
    }
    return dir;
  }

  public async removeRemoteDir(hostId: string, remoteDir: string): Promise<void> {
    if (!remoteDir.startsWith('/tmp/git-map-')) return;
    const session = this.sessions.get(hostId);
    if (!session) return;
    await this.execRawOnClient(session.client, `rm -rf ${quotePosixArg(remoteDir)}`).catch(() => {});
  }

  /**
   * Open an interactive PTY shell on the remote SSH server inside remotePath.
   */
  public async openRemotePtyShell(
    hostId: string,
    remotePath: string,
    cols: number,
    rows: number
  ): Promise<ClientChannel> {
    const session = await this.ensureConnected(hostId);
    const channel = await new Promise<ClientChannel>((resolve, reject) => {
      session.client.shell({ term: 'xterm-256color', cols: cols || 100, rows: rows || 28 }, (err, stream) => {
        if (err) reject(err);
        else resolve(stream);
      });
    });
    if (remotePath) {
      channel.write(`cd ${quotePosixArg(remotePath)} && clear\n`);
    }
    return channel;
  }
}

export const sshManager = new SshManager();
