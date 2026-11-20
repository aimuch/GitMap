import * as cp from 'child_process';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import { PassThrough } from 'stream';
import { AnyAuthMethod, Client, ClientChannel, ConnectConfig, SFTPWrapper, utils as sshUtils } from 'ssh2';
import { hostBridge } from '../platform/hostBridge';
import * as vscode from '../platform/vscode';
import { writeJsonAtomic } from '../platform/vscode';
import { StateMachine } from '../utils/fsm';
import { parseUserSshConfig, SshConfigHostEntry } from './sshConfigParser';

export type SshSessionState = 'disconnected' | 'connecting' | 'authenticating' | 'probing' | 'ready' | 'error';
type SshSessionEvent = 'CONNECT' | 'AUTH_START' | 'PROBE_START' | 'READY' | 'FAIL' | 'DISCONNECT';

export interface SshHostProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  authType: 'auto' | 'key' | 'password' | 'agent';
  privateKeyPath?: string;
  identityAgent?: string;
  identitiesOnly?: boolean;
  proxyJump?: string;
  defaultPath?: string;
  source: 'ssh-config' | 'saved';
  /** GitMap-only display name (doesn't change the host's id, so repositories on it keep working). */
  alias?: string;
  /** GitMap-only tags (e.g. prod, staging, gpu). */
  tags?: string[];
  connected?: boolean;
  connectionState?: SshSessionState;
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

class ChannelLimiter {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly maxConcurrent: number = 6) {}

  public acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      const grant = () => {
        this.active++;
        let released = false;
        resolve(() => {
          if (released) return;
          released = true;
          this.active--;
          const next = this.queue.shift();
          if (next) next();
        });
      };
      if (this.active < this.maxConcurrent) {
        grant();
      } else {
        this.queue.push(grant);
      }
    });
  }
}

interface ActiveSshSession {
  hostId: string;
  profile: SshHostProfile;
  client: Client;
  hopClients: Client[];
  sftp: SFTPWrapper | null;
  sftpPromise: Promise<SFTPWrapper> | null;
  limiter: ChannelLimiter;
  homeDir: string;
  gitVersion: string | null;
}

export function quotePosixArg(arg: string): string {
  return "'" + arg.replace(/'/g, "'\\''") + "'";
}

/**
 * Wrap a POSIX sh script so remote servers whose user login shell is fish, tcsh, or nushell execute it cleanly.
 */
function wrapPosixSh(posixScript: string): string {
  return `/bin/sh -c ${quotePosixArg(posixScript)}`;
}

function assertSafeSshToken(value: string, label: string): void {
  if (!value || value.startsWith('-')) {
    throw new Error(`Invalid SSH ${label}: "${value}"`);
  }
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

function parseSshWireKeyType(key: Buffer): string {
  if (key.length < 4) return 'ssh-unknown';
  const len = key.readUInt32BE(0);
  if (len <= 0 || len > 128 || key.length < 4 + len) return 'ssh-unknown';
  return key.subarray(4, 4 + len).toString('ascii');
}

function formatKnownHostToken(host: string, port: number): string {
  const cleanHost = host.trim().toLowerCase();
  if (port && port !== 22) {
    return `[${cleanHost}]:${port}`;
  }
  return cleanHost;
}

function knownHostEntryMatches(hostField: string, host: string, port: number): boolean {
  const candidates = [formatKnownHostToken(host, port)];
  if (!port || port === 22) {
    const bracket22 = `[${host.trim().toLowerCase()}]:22`;
    if (!candidates.includes(bracket22)) candidates.push(bracket22);
  }

  for (const token of hostField.split(',')) {
    const trimmed = token.trim();
    if (!trimmed || trimmed.startsWith('!')) continue;
    if (trimmed.startsWith('|1|')) {
      // OpenSSH hashed hostname format: |1|<base64_salt>|<base64_hmac_sha1>
      const parts = trimmed.split('|');
      if (parts.length >= 4) {
        try {
          const salt = Buffer.from(parts[2], 'base64');
          const expected = Buffer.from(parts[3], 'base64');
          for (const c of candidates) {
            const digest = crypto.createHmac('sha1', salt).update(c).digest();
            if (digest.length === expected.length && crypto.timingSafeEqual(digest, expected)) {
              return true;
            }
          }
        } catch (_) {}
      }
    } else if (candidates.includes(trimmed.toLowerCase())) {
      return true;
    }
  }
  return false;
}

interface KnownHostRecord {
  keyType: string;
  keyBytes: Buffer;
  sourceFile: string;
}

function loadKnownHostKeysForTarget(files: string[], host: string, port: number): KnownHostRecord[] {
  const matched: KnownHostRecord[] = [];
  for (const filePath of files) {
    let text: string;
    try {
      if (!fs.existsSync(filePath)) continue;
      text = fs.readFileSync(filePath, 'utf8');
    } catch (_) {
      continue;
    }
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || line.startsWith('@revoked') || line.startsWith('@cert-authority')) continue;
      const parts = line.split(/\s+/);
      if (parts.length < 3) continue;
      const [hostField, keyType, keyB64] = parts;
      if (!knownHostEntryMatches(hostField, host, port)) continue;
      try {
        matched.push({
          keyType,
          keyBytes: Buffer.from(keyB64, 'base64'),
          sourceFile: filePath
        });
      } catch (_) {}
    }
  }
  return matched;
}

/** Host key algorithms that yield a key of each known_hosts key type (an RSA key is offered under three signature names). */
const HOST_KEY_ALGOS_FOR_TYPE: { [keyType: string]: string[] } = {
  'ssh-ed25519': ['ssh-ed25519'],
  'ecdsa-sha2-nistp256': ['ecdsa-sha2-nistp256'],
  'ecdsa-sha2-nistp384': ['ecdsa-sha2-nistp384'],
  'ecdsa-sha2-nistp521': ['ecdsa-sha2-nistp521'],
  'ssh-rsa': ['rsa-sha2-512', 'rsa-sha2-256', 'ssh-rsa'],
  'ssh-dss': ['ssh-dss']
};
/** ssh2's own default / supported host key lists (ed25519 only where this runtime's crypto has it): an exact list
 *  given to ssh2 may only contain supported names, otherwise connect() throws. */
const SSH2_HOST_KEY_LISTS: { defaults: string[]; supported: string[] } = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const c = require('ssh2/lib/protocol/constants');
    if (Array.isArray(c.DEFAULT_SERVER_HOST_KEY) && Array.isArray(c.SUPPORTED_SERVER_HOST_KEY)) {
      return { defaults: c.DEFAULT_SERVER_HOST_KEY.slice(), supported: c.SUPPORTED_SERVER_HOST_KEY.slice() };
    }
  } catch (_) {}
  const fallback = ['ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521', 'rsa-sha2-512', 'rsa-sha2-256', 'ssh-rsa'];
  return { defaults: fallback, supported: fallback };
})();
const DEFAULT_HOST_KEY_ALGOS = SSH2_HOST_KEY_LISTS.defaults;

/**
 * Host key algorithm order for a host, like OpenSSH: the key types already in known_hosts come first, so a server
 * known by its RSA key presents that key instead of a newer ed25519 one (which used to be refused as a changed key).
 * The other algorithms stay allowed after them. → undefined when nothing is known (ssh2's default order).
 */
export function orderHostKeyAlgorithms(knownKeyTypes: string[]): string[] | undefined {
  const preferred: string[] = [];
  for (const t of knownKeyTypes) {
    for (const a of HOST_KEY_ALGOS_FOR_TYPE[t] || []) {
      if (!preferred.includes(a) && SSH2_HOST_KEY_LISTS.supported.includes(a)) preferred.push(a);
    }
  }
  if (preferred.length === 0) return undefined;
  return preferred.concat(DEFAULT_HOST_KEY_ALGOS.filter((a) => !preferred.includes(a)));
}

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  if (items.length === 0) return;
  let idx = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const current = items[idx++];
      await worker(current);
    }
  });
  await Promise.all(runners);
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

export interface SshTunnelInfo {
  id: string;
  hostId: string;
  localHost: string;
  localPort: number;
  remoteHost: string;
  remotePort: number;
  activeConnections: number;
  label?: string;
  createdAt: number;
}

interface ActiveSshTunnel {
  info: SshTunnelInfo;
  server: net.Server;
  sockets: Set<net.Socket>;
}

export class SshManager {
  private savedProfiles: SshHostProfile[] = [];
  private hostMeta: { [hostId: string]: HostMeta } = {};
  private metaFilePath: string = '';
  private knownHostsFilePath: string = '';
  private managedSshConfigPath: string = '';
  private readonly sessions = new Map<string, ActiveSshSession>();
  private readonly connecting = new Map<string, Promise<ActiveSshSession>>();
  private readonly connectEpochs = new Map<string, number>();
  private readonly hostMachines = new Map<string, StateMachine<SshSessionState, SshSessionEvent>>();
  private readonly tunnels = new Map<string, ActiveSshTunnel>();
  private readonly sessionPasswords = new Map<string, string>();
  private readonly sessionKeyPassphrases = new Map<string, string>();
  private profilesFilePath: string = '';
  private secrets: vscode.SecretStorage | null = null;
  private hasInteractiveUiClient: (() => boolean) | null = null;
  private hostsChangedListener: (() => void) | null = null;

  public setOnHostsChanged(listener: (() => void) | null) {
    this.hostsChangedListener = listener;
  }

  private getHostMachine(hostId: string): StateMachine<SshSessionState, SshSessionEvent> {
    let m = this.hostMachines.get(hostId);
    if (!m) {
      m = new StateMachine<SshSessionState, SshSessionEvent>({
        name: 'sshSession',
        id: hostId,
        initial: 'disconnected',
        transitions: {
          disconnected: { CONNECT: 'connecting' },
          connecting: { AUTH_START: 'authenticating', PROBE_START: 'probing', FAIL: 'error', DISCONNECT: 'disconnected' },
          authenticating: { AUTH_START: 'authenticating', PROBE_START: 'probing', FAIL: 'error', DISCONNECT: 'disconnected' },
          probing: { READY: 'ready', FAIL: 'error', DISCONNECT: 'disconnected' },
          ready: { DISCONNECT: 'disconnected', FAIL: 'error' },
          error: { CONNECT: 'connecting', DISCONNECT: 'disconnected' }
        }
      });
      this.hostMachines.set(hostId, m);
    }
    return m;
  }

  private bumpEpoch(hostId: string): number {
    const next = (this.connectEpochs.get(hostId) || 0) + 1;
    this.connectEpochs.set(hostId, next);
    return next;
  }

  public init(dataDir: string, secrets: vscode.SecretStorage, hasInteractiveUiClient?: () => boolean) {
    this.profilesFilePath = path.join(dataDir, 'ssh-hosts.json');
    this.metaFilePath = path.join(dataDir, 'ssh-host-meta.json');
    this.knownHostsFilePath = path.join(dataDir, 'known_hosts');
    this.managedSshConfigPath = path.join(dataDir, 'gitmap_ssh_config');
    this.secrets = secrets;
    this.hasInteractiveUiClient = hasInteractiveUiClient || null;
    this.disconnectAll();
    this.sessions.clear();
    this.connecting.clear();
    this.loadSavedProfiles();
    try {
      const raw = fs.existsSync(this.metaFilePath) ? JSON.parse(fs.readFileSync(this.metaFilePath, 'utf8')) : {};
      this.hostMeta = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    } catch (_) {
      this.hostMeta = {};
    }
    void this.writeManagedSshConfig();
  }

  public getManagedSshConfigPath(): string {
    return this.managedSshConfigPath;
  }

  private async writeManagedSshConfig(): Promise<void> {
    if (!this.managedSshConfigPath) return;
    try {
      const blocks: string[] = ['# Auto-generated by GitMap for saved SSH hosts'];
      for (const p of this.savedProfiles) {
        if (!p.id || p.id.startsWith('-') || /\s/.test(p.id)) continue;
        blocks.push(`Host ${p.id}`);
        blocks.push(`  HostName ${p.host}`);
        blocks.push(`  Port ${p.port || 22}`);
        blocks.push(`  User ${p.user}`);
        if (p.privateKeyPath) blocks.push(`  IdentityFile "${p.privateKeyPath}"`);
        if (p.proxyJump) blocks.push(`  ProxyJump ${p.proxyJump}`);
        blocks.push('');
      }
      await fs.promises.mkdir(path.dirname(this.managedSshConfigPath), { recursive: true });
      await fs.promises.writeFile(this.managedSshConfigPath, blocks.join('\n'), { encoding: 'utf8', mode: 0o600 });
    } catch (_) {}
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
    await writeJsonAtomic(this.metaFilePath, this.hostMeta);
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
    await writeJsonAtomic(this.profilesFilePath, this.savedProfiles);
    await this.writeManagedSshConfig();
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
      const state = active ? 'ready' : (this.hostMachines.get(entry.alias)?.state || 'disconnected');
      byId.set(entry.alias, {
        id: entry.alias,
        name: entry.alias,
        host: entry.hostName,
        port: entry.port,
        user: entry.user || defaultUser,
        authType: entry.identityFiles.length > 0 ? 'key' : 'auto',
        privateKeyPath: entry.identityFiles[0],
        identityAgent: entry.identityAgent,
        identitiesOnly: entry.identitiesOnly,
        proxyJump: entry.proxyJump,
        source: 'ssh-config',
        alias: this.hostMeta[entry.alias]?.alias,
        tags: this.hostMeta[entry.alias]?.tags || [],
        connected: !!active,
        connectionState: state,
        homeDir: active?.homeDir,
        gitVersion: active?.gitVersion
      });
    }

    for (const saved of this.savedProfiles) {
      const active = this.sessions.get(saved.id);
      const state = active ? 'ready' : (this.hostMachines.get(saved.id)?.state || 'disconnected');
      byId.set(saved.id, {
        ...saved,
        source: 'saved',
        alias: this.hostMeta[saved.id]?.alias,
        tags: this.hostMeta[saved.id]?.tags || [],
        connected: !!active,
        connectionState: state,
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
    const hostVal = String(input.host || '').trim();
    const userVal = String(input.user || '').trim() || os.userInfo().username;
    const proxyJumpVal = input.proxyJump?.trim() || undefined;
    assertSafeSshToken(hostVal, 'host');
    assertSafeSshToken(userVal, 'username');
    if (proxyJumpVal) assertSafeSshToken(proxyJumpVal, 'ProxyJump');

    const cleanName = (input.name || '').trim() || `${userVal}@${hostVal}`;
    const id = ((input.id?.trim() || cleanName.replace(/[^a-zA-Z0-9._@-]/g, '-')).replace(/\/+/g, '-')).replace(/^-+/, '');
    assertSafeSshToken(id, 'host alias');

    const profile: SshHostProfile = {
      id,
      name: cleanName,
      host: hostVal,
      port: Number(input.port) || 22,
      user: userVal,
      authType: input.authType || 'auto',
      privateKeyPath: input.privateKeyPath?.trim() || undefined,
      proxyJump: proxyJumpVal,
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
    assertSafeSshToken(hostId, 'host');
    const all = this.listHosts();
    const matched = all.find((h) => h.id === hostId);
    if (matched) return matched;

    // Support ad-hoc user@host:port
    const adHoc = hostId.match(/^(?:([^@]+)@)?([^:]+)(?::(\d+))?$/);
    if (adHoc) {
      const user = adHoc[1] || os.userInfo().username;
      const host = adHoc[2];
      assertSafeSshToken(user, 'username');
      assertSafeSshToken(host, 'host');
      return {
        id: hostId,
        name: hostId,
        user,
        host,
        port: adHoc[3] ? parseInt(adHoc[3], 10) : 22,
        authType: 'auto',
        source: 'saved'
      };
    }

    throw new Error(`Unknown SSH host "${hostId}"`);
  }

  public disconnect(hostId: string) {
    this.bumpEpoch(hostId);
    this.connecting.delete(hostId);
    for (const [tid, tun] of Array.from(this.tunnels.entries())) {
      if (tun.info.hostId === hostId) {
        void this.stopTunnel(tid);
      }
    }
    const session = this.sessions.get(hostId);
    if (session) {
      this.sessions.delete(hostId);
      try {
        session.client.end();
      } catch (_) {}
      for (const hc of session.hopClients) {
        try {
          hc.end();
        } catch (_) {}
      }
      // Note: never terminate shared first-hop ProxyJump sessions here, as other connected hosts may share the bastion.
    }
    const machine = this.getHostMachine(hostId);
    if (!machine.is('disconnected')) {
      machine.send('DISCONNECT');
    }
    this.hostsChangedListener?.();
  }

  public disconnectAll() {
    for (const tid of Array.from(this.tunnels.keys())) {
      void this.stopTunnel(tid);
    }
    const allIds = new Set<string>([...this.sessions.keys(), ...this.connecting.keys()]);
    for (const id of allIds) {
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

    const epoch = this.bumpEpoch(hostId);
    const machine = this.getHostMachine(hostId);
    machine.send('CONNECT', undefined, { epoch });

    const promise = this.establishConnection(hostId, epoch)
      .catch((err) => {
        if (this.connectEpochs.get(hostId) === epoch && !machine.is('disconnected')) {
          machine.send('FAIL', undefined, { error: err instanceof Error ? err.message : String(err) });
          this.hostsChangedListener?.();
        }
        throw err;
      })
      .finally(() => {
        if (this.connecting.get(hostId) === promise) {
          this.connecting.delete(hostId);
        }
      });
    this.connecting.set(hostId, promise);
    return promise;
  }

  private collectCandidateKeyFiles(profile: SshHostProfile, cfgMatch?: SshConfigHostEntry): string[] {
    const candidates: string[] = [];
    if (profile.privateKeyPath) {
      const p = expandTildeLocal(profile.privateKeyPath);
      if (fs.existsSync(p)) candidates.push(p);
    }
    if (cfgMatch) {
      for (const f of cfgMatch.identityFiles) {
        if (!candidates.includes(f) && fs.existsSync(f)) candidates.push(f);
      }
    }
    const identitiesOnly = profile.identitiesOnly || cfgMatch?.identitiesOnly;
    if (!identitiesOnly) {
      const defaultKeys = ['id_ed25519', 'id_rsa', 'id_ecdsa', 'id_dsa'].map((n) => path.join(os.homedir(), '.ssh', n));
      for (const dk of defaultKeys) {
        if (!candidates.includes(dk) && fs.existsSync(dk)) candidates.push(dk);
      }
    }
    return candidates;
  }

  /** ssh2 `algorithms` for a host: prefer the host key types already known for it (see orderHostKeyAlgorithms). */
  private hostKeyAlgorithmsFor(profile: SshHostProfile): { serverHostKey: string[] } | undefined {
    const files = [path.join(os.homedir(), '.ssh', 'known_hosts'), this.knownHostsFilePath].filter(Boolean);
    const order = orderHostKeyAlgorithms(loadKnownHostKeysForTarget(files, profile.host, profile.port).map((r) => r.keyType));
    return order ? { serverHostKey: order } : undefined;
  }

  private async verifyHostKey(profile: SshHostProfile, presentedKey: Buffer): Promise<{ ok: boolean; error?: string }> {
    const keyType = parseSshWireKeyType(presentedKey);
    const fingerprint = 'SHA256:' + crypto.createHash('sha256').update(presentedKey).digest('base64').replace(/=+$/, '');
    const userKnownHosts = path.join(os.homedir(), '.ssh', 'known_hosts');
    const lookupFiles = [userKnownHosts, this.knownHostsFilePath].filter(Boolean);
    const existing = loadKnownHostKeysForTarget(lookupFiles, profile.host, profile.port);

    if (existing.length > 0) {
      const exactMatch = existing.some((rec) => Buffer.compare(rec.keyBytes, presentedKey) === 0);
      if (exactMatch) {
        return { ok: true };
      }
      const sameAlgoMismatch = existing.some((rec) => rec.keyType === keyType);
      if (sameAlgoMismatch || existing.length > 0) {
        return {
          ok: false,
          error: `REMOTE HOST IDENTIFICATION HAS CHANGED for ${profile.host}:${profile.port} (${keyType} ${fingerprint})! Connection refused to protect against a Man-in-the-Middle attack.`
        };
      }
    }

    // Unknown host (Trust On First Use): prompt interactive UI user if available, otherwise accept-new & persist
    if (this.hasInteractiveUiClient?.() && hostBridge.getHandlers().onToast) {
      const trustLabel = 'Trust & Connect';
      const chosen = await hostBridge.getHandlers().onToast!({
        level: 'warning',
        modal: true,
        message: `Verify SSH Host Authenticity (${profile.host}:${profile.port})`,
        detail: `The authenticity of host "${profile.host}:${profile.port}" cannot be established.\n${keyType} key fingerprint is:\n${fingerprint}\n\nDo you want to trust this host and save its key?`,
        actions: [trustLabel]
      });
      if (chosen !== trustLabel) {
        return { ok: false, error: `Host key verification cancelled for ${profile.host}:${profile.port}.` };
      }
    }

    if (this.knownHostsFilePath) {
      try {
        await fs.promises.mkdir(path.dirname(this.knownHostsFilePath), { recursive: true, mode: 0o700 });
        const line = `${formatKnownHostToken(profile.host, profile.port)} ${keyType} ${presentedKey.toString('base64')}\n`;
        await fs.promises.appendFile(this.knownHostsFilePath, line, { encoding: 'utf8', mode: 0o600 });
      } catch (_) {}
    }
    return { ok: true };
  }

  private async establishConnection(hostId: string, epoch: number): Promise<ActiveSshSession> {
    const profile = this.resolveProfile(hostId);
    const machine = this.getHostMachine(hostId);
    const configEntries = parseUserSshConfig();
    const cfgMatch = configEntries.find((e) => e.alias === profile.id);

    const storedPassword = (await this.secrets?.get(`ssh.password.${profile.id}`)) || this.sessionPasswords.get(profile.id);
    const legacyPassphrase = await this.secrets?.get(`ssh.passphrase.${profile.id}`);

    let sock: (NodeJS.ReadableStream & NodeJS.WritableStream) | undefined;
    const hopClients: Client[] = [];
    const closeHopClients = () => {
      for (const hc of hopClients) {
        try {
          hc.end();
        } catch (_) {}
      }
      hopClients.length = 0;
    };

    try {
      if (profile.proxyJump) {
        const hops = profile.proxyJump
          .split(',')
          .map((h) => h.trim())
          .filter(Boolean);
        let currentSession: ActiveSshSession | null = null;
        for (let i = 0; i < hops.length; i++) {
          const hopId = hops[i];
          assertSafeSshToken(hopId, 'ProxyJump hop');
          if (i === 0) {
            currentSession = await this.ensureConnected(hopId);
          } else {
            // Intermediate hop tunnelled through previous hop
            const hopProfile = this.resolveProfile(hopId);
            const prevSession = currentSession!;
            const hopStream = await new Promise<ClientChannel>((resolve, reject) => {
              prevSession.client.forwardOut('127.0.0.1', 0, hopProfile.host, hopProfile.port, (err, stream) => {
                if (err) reject(err);
                else resolve(stream);
              });
            });
            const hopClient = new Client();
            hopClients.push(hopClient);
            let hopHostKeyErr: string | null = null;
            await new Promise<void>((resolve, reject) => {
              hopClient.once('ready', () => resolve());
              hopClient.once('error', (err) => reject(hopHostKeyErr ? new Error(hopHostKeyErr) : err));
              hopClient.connect({
                host: hopProfile.host,
                port: hopProfile.port,
                username: hopProfile.user,
                sock: hopStream as any,
                agent: defaultAgentSocket(),
                readyTimeout: 20000,
                algorithms: this.hostKeyAlgorithmsFor(hopProfile) as any,
                hostVerifier: (key: Buffer, verify: (valid: boolean) => void) => {
                  this.verifyHostKey(hopProfile, key)
                    .then((res) => {
                      if (!res.ok) hopHostKeyErr = res.error || 'SSH host key verification failed.';
                      verify(res.ok);
                    })
                    .catch(() => verify(false));
                }
              });
            });
            currentSession = {
              hostId: hopId,
              profile: hopProfile,
              client: hopClient,
              hopClients: [],
              sftp: null,
              sftpPromise: null,
              limiter: new ChannelLimiter(),
              homeDir: '/',
              gitVersion: null
            };
          }
        }
        if (currentSession) {
          sock = await new Promise<ClientChannel>((resolve, reject) => {
            currentSession!.client.forwardOut('127.0.0.1', 0, profile.host, profile.port, (err, stream) => {
              if (err) reject(err);
              else resolve(stream);
            });
          });
        }
      }

      if (this.connectEpochs.get(hostId) !== epoch) {
        closeHopClients();
        throw new Error('SSH connection cancelled.');
      }

      const authQueue: AnyAuthMethod[] = [];
      const encryptedKeys: Array<{ keyFile: string; rawKey: Buffer; keySecretId: string }> = [];

      const configuredAgent = profile.identityAgent || cfgMatch?.identityAgent;
      const agentSock = configuredAgent === 'none' ? undefined : configuredAgent || defaultAgentSocket();

      if (profile.authType === 'password' && storedPassword) {
        authQueue.push({ type: 'password', username: profile.user, password: storedPassword });
      }

      if (profile.authType !== 'password' && agentSock) {
        authQueue.push({ type: 'agent', username: profile.user, agent: agentSock });
      }

      if (profile.authType !== 'agent' && profile.authType !== 'password') {
        for (const keyFile of this.collectCandidateKeyFiles(profile, cfgMatch)) {
          try {
            const rawKey = fs.readFileSync(keyFile);
            const keySecretId = 'ssh.keyPassphrase.' + crypto.createHash('sha256').update(keyFile).digest('hex').slice(0, 16);
            const knownPass =
              this.sessionKeyPassphrases.get(keySecretId) ||
              (await this.secrets?.get(keySecretId)) ||
              legacyPassphrase;
            const parsed = sshUtils.parseKey(rawKey, knownPass);
            if (!(parsed instanceof Error)) {
              authQueue.push({
                type: 'publickey',
                username: profile.user,
                key: rawKey,
                ...(knownPass ? { passphrase: knownPass } : {})
              });
            } else if (/encrypted|passphrase/i.test(parsed.message)) {
              // Defer interactive passphrase prompt until agent & unencrypted keys fail!
              encryptedKeys.push({ keyFile, rawKey, keySecretId });
            }
          } catch (_) {}
        }
      }

      if (storedPassword && profile.authType !== 'password') {
        authQueue.push({ type: 'password', username: profile.user, password: storedPassword });
      }

      const client = new Client();
      let queueIndex = 0;
      let encryptedKeyIndex = 0;
      let promptedPassword = false;
      let triedKbdInteractive = false;
      let hostKeyError: string | null = null;

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const done = (err?: Error) => {
          if (settled) return;
          settled = true;
          if (err) {
            if (hostKeyError) reject(new Error(hostKeyError));
            else reject(err);
          } else {
            resolve();
          }
        };

        client.on('ready', () => done());
        client.on('error', (err) => done(err));
        client.on('close', () => {
          const active = this.sessions.get(hostId);
          if (active?.client === client) {
            this.sessions.delete(hostId);
            for (const hc of active.hopClients) {
              try {
                hc.end();
              } catch (_) {}
            }
            if (!machine.is('disconnected')) {
              machine.send('DISCONNECT', undefined, { reason: 'socket_closed' });
            }
            this.hostsChangedListener?.();
          }
          done(new Error(hostKeyError || `SSH connection to "${profile.name}" closed`));
        });

        const connectCfg: ConnectConfig = {
          host: profile.host,
          port: profile.port,
          username: profile.user,
          sock: sock as any,
          readyTimeout: 20000,
          algorithms: this.hostKeyAlgorithmsFor(profile) as any,
          keepaliveInterval: 15000,
          keepaliveCountMax: 3,
          hostVerifier: (key: Buffer, verify: (valid: boolean) => void) => {
            this.verifyHostKey(profile, key)
              .then((res) => {
                if (!res.ok) hostKeyError = res.error || 'SSH host key verification failed.';
                verify(res.ok);
              })
              .catch(() => verify(false));
          },
          authHandler: (methodsLeft, _partialSuccess, callback) => {
            if (this.connectEpochs.get(hostId) === epoch && machine.is('connecting')) {
              machine.send('AUTH_START');
            }
            // 1. Try pre-queued silent methods (agent, unencrypted/saved-passphrase keys, stored password)
            while (queueIndex < authQueue.length) {
              const candidate = authQueue[queueIndex++];
              if (methodsLeft === null || methodsLeft.includes(candidate.type)) {
                return callback(candidate);
              }
            }

            const inputHandler = hostBridge.getHandlers().onInputBox;
            const canPubkey = methodsLeft === null || methodsLeft.includes('publickey');
            const canKbd = methodsLeft !== null && methodsLeft.includes('keyboard-interactive');
            const canPassword = methodsLeft === null || methodsLeft.includes('password');

            // 2. Lazily prompt for encrypted private keys only if publickey is still accepted
            if (canPubkey && encryptedKeyIndex < encryptedKeys.length && inputHandler) {
              const item = encryptedKeys[encryptedKeyIndex++];
              inputHandler({
                title: `SSH Key Passphrase (${profile.name})`,
                prompt: `Enter passphrase for private key ${path.basename(item.keyFile)}:`,
                password: true
              })
                .then(async (promptedPass) => {
                  if (!promptedPass) {
                    // Skip this encrypted key and let ssh2 re-enter authHandler or fail gracefully
                    return callback('none');
                  }
                  const check = sshUtils.parseKey(item.rawKey, promptedPass);
                  if (check instanceof Error) {
                    void hostBridge.getHandlers().onToast?.({
                      level: 'error',
                      message: `Incorrect passphrase for ${path.basename(item.keyFile)}.`
                    });
                    return callback('none');
                  }
                  this.sessionKeyPassphrases.set(item.keySecretId, promptedPass);
                  await this.secrets?.store(item.keySecretId, promptedPass);
                  callback({
                    type: 'publickey',
                    username: profile.user,
                    key: item.rawKey,
                    passphrase: promptedPass
                  });
                })
                .catch(() => callback(false as any));
              return;
            }

            // 3. Support true multi-prompt 2FA / OTP keyboard-interactive authentication
            if (canKbd && !triedKbdInteractive && inputHandler) {
              triedKbdInteractive = true;
              callback({
                type: 'keyboard-interactive',
                username: profile.user,
                prompt: (_name, instructions, _lang, prompts, finish) => {
                  (async () => {
                    const answers: string[] = [];
                    for (const p of prompts) {
                      const promptLabel = [instructions, p.prompt].filter(Boolean).join(' — ') || `Authentication code for ${profile.user}@${profile.host}`;
                      const ans = await inputHandler({
                        title: `SSH Verification (${profile.user}@${profile.host})`,
                        prompt: promptLabel,
                        password: !p.echo
                      });
                      if (ans === undefined) {
                        finish([]);
                        return;
                      }
                      answers.push(ans);
                    }
                    finish(answers);
                  })().catch(() => finish([]));
                }
              });
              return;
            }

            // 4. Interactive password fallback
            if (canPassword && !promptedPassword && inputHandler) {
              promptedPassword = true;
              inputHandler({
                title: `SSH Password (${profile.user}@${profile.host})`,
                prompt: `Enter password for ${profile.user}@${profile.host}:${profile.port}`,
                password: true
              })
                .then((pwd) => {
                  if (!pwd) return callback(false as any);
                  this.sessionPasswords.set(profile.id, pwd);
                  callback({ type: 'password', username: profile.user, password: pwd });
                })
                .catch(() => callback(false as any));
              return;
            }

            callback(false as any);
          }
        };

        client.connect(connectCfg);
      });

      if (this.connectEpochs.get(hostId) !== epoch) {
        try {
          client.end();
        } catch (_) {}
        closeHopClients();
        throw new Error('SSH connection cancelled.');
      }

      machine.send('PROBE_START');
      const limiter = new ChannelLimiter(6);
      let homeDir = '/root';
      let gitVersion: string | null = null;
      try {
        const probe = await this.execRawOnClient(
          client,
          limiter,
          'printf "%s\\n" "$HOME"; git --version 2>/dev/null || true'
        );
        const probeLines = probe.stdout.toString('utf8').split(/\r?\n/);
        homeDir = (probeLines[0] || '/root').trim() || '/';
        const gitVerLine = probeLines.find((l) => l.startsWith('git version '));
        gitVersion = gitVerLine ? gitVerLine.replace(/^git version\s+/, '').trim() : null;
      } catch (probeErr) {
        try {
          client.end();
        } catch (_) {}
        throw probeErr;
      }

      if (this.connectEpochs.get(hostId) !== epoch) {
        try {
          client.end();
        } catch (_) {}
        closeHopClients();
        throw new Error('SSH connection cancelled.');
      }

      const session: ActiveSshSession = {
        hostId,
        profile,
        client,
        hopClients,
        sftp: null,
        sftpPromise: null,
        limiter,
        homeDir,
        gitVersion
      };
      this.sessions.set(hostId, session);
      machine.send('READY');
      this.hostsChangedListener?.();
      return session;
    } catch (err) {
      closeHopClients();
      throw err;
    }
  }

  public async getSftp(hostId: string): Promise<SFTPWrapper> {
    const session = await this.ensureConnected(hostId);
    if (session.sftp) return session.sftp;
    if (session.sftpPromise) return session.sftpPromise;

    session.sftpPromise = new Promise<SFTPWrapper>((resolve, reject) => {
      session.client.sftp((err, wrapper) => {
        if (err) reject(err);
        else resolve(wrapper);
      });
    })
      .then((sftp) => {
        sftp.on('close', () => {
          if (session.sftp === sftp) session.sftp = null;
        });
        session.sftp = sftp;
        session.sftpPromise = null;
        return sftp;
      })
      .catch((err) => {
        session.sftpPromise = null;
        throw err;
      });

    return session.sftpPromise;
  }

  private async execRawOnClient(
    client: Client,
    limiter: ChannelLimiter,
    posixScript: string,
    input: Buffer | string | null = null,
    cancellation?: { readonly isCancellationRequested: boolean; onCancellationRequested: (listener: () => any) => { dispose: () => any } } | null,
    maxBytes?: number
  ): Promise<{ code: number; stdout: Buffer; stderr: string }> {
    const wrappedCommand = wrapPosixSh(posixScript);

    const attemptExec = async (): Promise<{ code: number; stdout: Buffer; stderr: string }> => {
      const release = await limiter.acquire();
      try {
        return await new Promise((resolve, reject) => {
          let settled = false;
          const finishResolve = (res: { code: number; stdout: Buffer; stderr: string }) => {
            if (settled) return;
            settled = true;
            client.removeListener('close', onClientClose);
            resolve(res);
          };
          const finishReject = (err: Error) => {
            if (settled) return;
            settled = true;
            client.removeListener('close', onClientClose);
            reject(err);
          };
          const onClientClose = () => {
            finishReject(new Error('SSH connection closed while command was running.'));
          };
          client.once('close', onClientClose);

          client.exec(wrappedCommand, (err, stream) => {
            if (err) {
              finishReject(err);
              return;
            }
            const outChunks: Buffer[] = [];
            let outLen = 0;
            let truncatedByCap = false;
            const errChunks: Buffer[] = [];
            let errLen = 0;
            const MAX_STDERR_BYTES = 256 * 1024;
            let exitCode = 0;
            let cancelDisp: vscode.Disposable | null = null;

            stream.on('error', () => {});

            if (cancellation) {
              if (cancellation.isCancellationRequested) {
                try {
                  stream.close();
                } catch (_) {}
                finishResolve({ code: 130, stdout: Buffer.alloc(0), stderr: 'Cancelled' });
                return;
              }
              cancelDisp = cancellation.onCancellationRequested(() => {
                try {
                  stream.signal('TERM');
                  stream.close();
                } catch (_) {}
              });
            }

            stream.on('data', (chunk: Buffer) => {
              if (typeof maxBytes === 'number' && maxBytes > 0) {
                const remaining = maxBytes - outLen;
                if (remaining > 0) {
                  const slice = chunk.length <= remaining ? Buffer.from(chunk) : Buffer.from(chunk.subarray(0, remaining));
                  outChunks.push(slice);
                  outLen += slice.length;
                }
                if (outLen >= maxBytes && !truncatedByCap) {
                  truncatedByCap = true;
                  try {
                    stream.close();
                  } catch (_) {}
                }
              } else {
                outChunks.push(Buffer.from(chunk));
                outLen += chunk.length;
              }
            });
            stream.stderr.on('data', (chunk: Buffer) => {
              if (errLen >= MAX_STDERR_BYTES) return;
              const rem = MAX_STDERR_BYTES - errLen;
              const slice = chunk.length <= rem ? Buffer.from(chunk) : Buffer.from(chunk.subarray(0, rem));
              errChunks.push(slice);
              errLen += slice.length;
            });
            stream.on('exit', (code: number | null) => {
              exitCode = typeof code === 'number' ? code : 0;
            });
            stream.on('close', (code?: number | null) => {
              cancelDisp?.dispose();
              if (typeof code === 'number' && !truncatedByCap) exitCode = code;
              finishResolve({
                code: truncatedByCap ? 0 : exitCode,
                stdout: Buffer.concat(outChunks),
                stderr: Buffer.concat(errChunks).toString('utf8')
              });
            });

            if (input !== null) {
              stream.end(input);
            }
          });
        });
      } finally {
        release();
      }
    };

    try {
      return await attemptExec();
    } catch (err: any) {
      if (err && /channel open failure/i.test(String(err.message || err))) {
        await new Promise((r) => setTimeout(r, 120));
        return attemptExec();
      }
      throw err;
    }
  }

  /**
   * Run a POSIX shell command on the SSH host (outside any repository).
   */
  public async execRemote(hostId: string, shellCommand: string): Promise<{ code: number; stdout: string; stderr: string }> {
    const session = await this.ensureConnected(hostId);
    const res = await this.execRawOnClient(session.client, session.limiter, shellCommand);
    return { code: res.code, stdout: res.stdout.toString('utf8'), stderr: res.stderr };
  }

  /**
   * Complete a partially typed remote path (for Tab completion in the path browser).
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
      .filter((it) => it.filename !== '.' && it.filename !== '..' && (showHidden || prefix.startsWith('.') || !it.filename.startsWith('.')))
      .slice(0, 200);

    const entries: { name: string; path: string; isDirectory: boolean }[] = matched.map((it) => {
      const mode: number = it.attrs?.mode || 0;
      return {
        name: it.filename,
        path: path.posix.join(dir, it.filename),
        isDirectory: (mode & 0o170000) === 0o040000
      };
    });

    const symlinkIndices = matched
      .map((it, idx) => (((it.attrs?.mode || 0) & 0o170000) === 0o120000 ? idx : -1))
      .filter((idx) => idx >= 0);

    await runWithConcurrency(symlinkIndices, 16, async (idx) => {
      entries[idx].isDirectory = await new Promise<boolean>((resolve) =>
        sftp.stat(entries[idx].path, (err, st) => resolve(!err && !!st && st.isDirectory()))
      );
    });

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
      const isDir = (mode & 0o170000) === 0o040000;
      const fullEntryPath = path.posix.join(currentPath, name);

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

    const symlinks = entries.filter((e) => e.isSymlink);
    await runWithConcurrency(symlinks, 16, async (entry) => {
      entry.isDirectory = await new Promise<boolean>((resolve) => {
        sftp.stat(entry.path, (err, st) => resolve(!err && !!st && st.isDirectory()));
      });
    });

    entries.sort((a, b) => (a.isDirectory !== b.isDirectory ? (a.isDirectory ? -1 : 1) : a.name.localeCompare(b.name)));

    // Fast batch check: reads $d/.git/HEAD directly in shell (0 git subprocesses for child folders!)
    const dirEntries = entries.filter((e) => e.isDirectory).slice(0, 200);
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
        `  headfile=""`,
        `  if [ -f "$d/.git/HEAD" ]; then headfile="$d/.git/HEAD"`,
        `  elif [ -f "$d/.git" ]; then`,
        `    IFS= read -r gline < "$d/.git" || gline=""`,
        `    gdir=\${gline#gitdir: }`,
        `    case "$gdir" in /*) ;; *) gdir="$d/$gdir" ;; esac`,
        `    [ -f "$gdir/HEAD" ] && headfile="$gdir/HEAD"`,
        `  fi`,
        `  if [ -n "$headfile" ]; then`,
        `    IFS= read -r hval < "$headfile" || hval=""`,
        `    case "$hval" in`,
        `      "ref: refs/heads/"*) br=\${hval#ref: refs/heads/} ;;`,
        `      "ref: "*) br=\${hval#ref: } ;;`,
        `      *) br=$(printf "%.8s" "$hval") ;;`,
        `    esac`,
        `    printf "__REPO__\\t%s\\t%s\\n" "$d" "$br"`,
        `  fi`,
        `done`
      );
    }

    const probeRes = await this.execRawOnClient(session.client, session.limiter, probeScriptParts.join('\n')).catch(() => null);
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
      `  br=""`,
      `  if [ -f "$gitpath/HEAD" ]; then`,
      `    IFS= read -r hval < "$gitpath/HEAD" || hval=""`,
      `    case "$hval" in "ref: refs/heads/"*) br=\${hval#ref: refs/heads/} ;; *) br=$(printf "%.8s" "$hval") ;; esac`,
      `  else`,
      `    br=$(git -C "$repo" symbolic-ref -q --short HEAD 2>/dev/null || git -C "$repo" rev-parse --short HEAD 2>/dev/null || true)`,
      `  fi`,
      `  printf "%s\\t%s\\n" "$repo" "$br"`,
      `done`
    ].join('\n');

    const res = await this.execRawOnClient(session.client, session.limiter, script);
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
   * Lightweight fingerprint of a remote Git repository's HEAD, refs, and working tree index for auto-refresh polling.
   */
  public async getRemoteRepoStateSignature(hostId: string, remoteRepoPath: string): Promise<string | null> {
    const session = this.sessions.get(hostId);
    if (!session) return null;
    const script = `cd ${quotePosixArg(remoteRepoPath)} 2>/dev/null && git rev-parse HEAD --symbolic-full-name HEAD 2>/dev/null; git show-ref --heads --tags -s 2>/dev/null | head -n 60; ls -ln .git/index .git/MERGE_HEAD .git/REBASE_HEAD 2>/dev/null || true`;
    const res = await this.execRawOnClient(session.client, session.limiter, script).catch(() => null);
    if (!res) return null;
    return crypto.createHash('sha1').update(res.stdout).digest('hex');
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
      maxBytes?: number;
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
    return this.execRawOnClient(
      session.client,
      session.limiter,
      cmd,
      options?.input ?? null,
      options?.cancellation ?? null,
      options?.maxBytes
    );
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
      .then(async (session) => {
        if (fakeProc.killed) return;
        const release = await session.limiter.acquire();
        if (fakeProc.killed) {
          release();
          return;
        }
        const envVars: string[] = ['LC_MESSAGES=C', 'LANGUAGE=C', 'GIT_TERMINAL_PROMPT=0'];
        for (const [k, v] of Object.entries(env)) {
          if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(k) && typeof v === 'string') {
            envVars.push(`${k}=${quotePosixArg(v)}`);
          }
        }
        const cmd = wrapPosixSh(`cd ${quotePosixArg(remoteRepoPath)} && env ${envVars.join(' ')} git ${args.map(quotePosixArg).join(' ')}`);
        session.client.exec(cmd, (err, stream) => {
          if (err) {
            release();
            fakeProc.emit('error', err);
            fakeProc.emit('close', 1, null);
            return;
          }
          activeStream = stream;
          if (fakeProc.killed) {
            release();
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
            release();
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
          readSftpHandleBounded(sftp, handle, maxBytes).then(resolve, reject);
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
    await this.execRawOnClient(session.client, session.limiter, `mkdir -p ${quotePosixArg(parent)}`);
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
    const res = await this.execRawOnClient(session.client, session.limiter, checks);
    const out = res.stdout.toString('utf8').trim();
    return out !== '' ? parseInt(out, 10) : -1;
  }

  public async createRemoteTempDir(hostId: string, prefix: string, files: { [name: string]: string | Buffer }): Promise<string> {
    const session = await this.ensureConnected(hostId);
    const rand = crypto.randomBytes(8).toString('hex');
    const dir = `/tmp/${prefix}${rand}`;
    await this.execRawOnClient(session.client, session.limiter, `mkdir -m 700 -p ${quotePosixArg(dir)}`);
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
    await this.execRawOnClient(session.client, session.limiter, `rm -rf ${quotePosixArg(remoteDir)}`).catch(() => {});
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
      // Leading space respects HISTCONTROL=ignorespace / HIST_IGNORE_SPACE in bash & zsh
      channel.write(` cd ${quotePosixArg(remotePath)} && clear\n`);
    }
    return channel;
  }

  /* SSH Local Port Forwarding (-L) */

  public listTunnels(hostId?: string): SshTunnelInfo[] {
    const out: SshTunnelInfo[] = [];
    for (const tun of this.tunnels.values()) {
      if (!hostId || tun.info.hostId === hostId) {
        out.push({ ...tun.info, activeConnections: tun.sockets.size });
      }
    }
    return out.sort((a, b) => a.createdAt - b.createdAt);
  }

  public async startTunnel(params: {
    hostId: string;
    localPort: number;
    remoteHost?: string;
    remotePort: number;
    localHost?: string;
    label?: string;
  }): Promise<SshTunnelInfo> {
    const hostId = String(params.hostId || '').trim();
    const remoteHost = String(params.remoteHost || '127.0.0.1').trim() || '127.0.0.1';
    const localHost = params.localHost === '0.0.0.0' ? '0.0.0.0' : '127.0.0.1';
    const localPortReq = Number(params.localPort);
    const remotePort = Number(params.remotePort);
    if (!hostId) throw new Error('SSH host is required.');
    if (!Number.isInteger(localPortReq) || localPortReq < 0 || localPortReq > 65535) {
      throw new Error('Local port must be between 0 and 65535.');
    }
    if (!Number.isInteger(remotePort) || remotePort < 1 || remotePort > 65535) {
      throw new Error('Remote port must be between 1 and 65535.');
    }
    assertSafeSshToken(remoteHost, 'remote forward host');

    await this.ensureConnected(hostId);
    const sockets = new Set<net.Socket>();
    const server = net.createServer((socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
      socket.on('error', () => socket.destroy());

      this.ensureConnected(hostId)
        .then((session) => {
          session.client.forwardOut(
            socket.remoteAddress || '127.0.0.1',
            socket.remotePort || 0,
            remoteHost,
            remotePort,
            (err, stream) => {
              if (err || !stream) {
                socket.destroy();
                return;
              }
              if (socket.destroyed) {
                try {
                  stream.close();
                } catch (_) {}
                return;
              }
              stream.on('error', () => socket.destroy());
              socket.on('close', () => {
                try {
                  stream.close();
                } catch (_) {}
              });
              stream.on('close', () => socket.destroy());
              socket.pipe(stream);
              stream.pipe(socket);
            }
          );
        })
        .catch(() => socket.destroy());
    });

    const boundPort = await new Promise<number>((resolve, reject) => {
      const onListenError = (err: Error) => reject(err);
      server.once('error', onListenError);
      server.listen(localPortReq, localHost, () => {
        server.removeListener('error', onListenError);
        server.on('error', () => {});
        const addr = server.address();
        resolve(typeof addr === 'object' && addr ? addr.port : localPortReq);
      });
    });

    const id = 'tun-' + crypto.randomBytes(6).toString('hex');
    const info: SshTunnelInfo = {
      id,
      hostId,
      localHost,
      localPort: boundPort,
      remoteHost,
      remotePort,
      activeConnections: 0,
      label: params.label ? String(params.label).trim().slice(0, 64) : undefined,
      createdAt: Date.now()
    };
    this.tunnels.set(id, { info, server, sockets });
    return { ...info };
  }

  public async stopTunnel(id: string): Promise<boolean> {
    const tun = this.tunnels.get(id);
    if (!tun) return false;
    this.tunnels.delete(id);
    for (const sock of tun.sockets) {
      try {
        sock.destroy();
      } catch (_) {}
    }
    tun.sockets.clear();
    await new Promise<void>((resolve) => {
      if (!tun.server.listening) return resolve();
      tun.server.close(() => resolve());
    });
    return true;
  }
}

export function readSftpHandleBounded(
  sftp: Pick<SFTPWrapper, 'fstat' | 'read' | 'close'>,
  handle: Buffer,
  maxBytes: number
): Promise<Buffer> {
  const SFTP_READ_CHUNK = 64 * 1024;
  return new Promise<Buffer>((resolve, reject) => {
    let closed = false;
    const closeOnce = () => {
      if (closed) return;
      closed = true;
      try {
        sftp.close(handle, () => {});
      } catch (_) {}
    };

    const startLoop = (targetCap: number) => {
      if (targetCap <= 0) {
        closeOnce();
        resolve(Buffer.alloc(0));
        return;
      }
      const chunks: Buffer[] = [];
      let offset = 0;

      const step = () => {
        const remaining = targetCap - offset;
        if (remaining <= 0) {
          closeOnce();
          resolve(Buffer.concat(chunks, offset));
          return;
        }
        const ask = Math.min(SFTP_READ_CHUNK, remaining);
        const scratch = Buffer.allocUnsafe(ask);
        sftp.read(handle, scratch, 0, ask, offset, (readErr, bytesRead) => {
          if (readErr) {
            closeOnce();
            // Node ssh2 signals EOF via an Error('EOF') on some SFTP servers when bytesRead === 0
            if (bytesRead === 0 || /eof/i.test(String(readErr.message || ''))) {
              resolve(Buffer.concat(chunks, offset));
            } else {
              reject(readErr);
            }
            return;
          }
          if (!bytesRead || bytesRead <= 0) {
            closeOnce();
            resolve(Buffer.concat(chunks, offset));
            return;
          }
          chunks.push(scratch.subarray(0, bytesRead));
          offset += bytesRead;
          if (offset >= targetCap) {
            closeOnce();
            resolve(Buffer.concat(chunks, offset));
          } else {
            step();
          }
        });
      };

      step();
    };

    if (typeof sftp.fstat === 'function') {
      sftp.fstat(handle, (statErr, stats) => {
        if (!statErr && stats && typeof stats.size === 'number' && stats.size >= 0) {
          startLoop(Math.min(maxBytes, stats.size));
        } else {
          startLoop(maxBytes);
        }
      });
    } else {
      startLoop(maxBytes);
    }
  });
}

export const sshManager = new SshManager();
