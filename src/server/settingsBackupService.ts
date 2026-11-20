import * as crypto from 'crypto';
import * as https from 'https';

export interface BackupPayload {
  schemaVersion: 1;
  exportedAt: string;
  appVersion: string;
  settings: Record<string, any>;
  sshHosts: Array<{
    id?: string;
    name?: string;
    host: string;
    port?: number;
    /** SSH login name (SshHostProfile.user). */
    user?: string;
    /** Legacy name of `user` (backups written before 2026-11-20); still read on import and written for older GitMap versions. */
    username?: string;
    authType?: string;
    privateKeyPath?: string;
    /** ProxyJump (SshHostProfile.proxyJump). */
    proxyJump?: string;
    /** Legacy name of `proxyJump`. */
    jumpHost?: string;
    alias?: string;
    tags?: string[];
    defaultPath?: string;
  }>;
  clientPrefs?: Record<string, any>;
}

export interface EncryptedBackupEnvelope {
  format: 'gitmap-backup-v1';
  encrypted: true;
  kdf: 'scrypt';
  cipher: 'aes-256-gcm';
  salt: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

export interface PlainBackupEnvelope {
  format: 'gitmap-backup-v1';
  encrypted: false;
  payload: BackupPayload;
}

export type BackupEnvelope = EncryptedBackupEnvelope | PlainBackupEnvelope;

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string | null;
  hasUpdate: boolean;
  releaseUrl: string | null;
  releaseName: string | null;
  releaseNotes: string | null;
  publishedAt: string | null;
  error?: string | null;
}

/**
 * Strip secrets/passwords/passphrases from SSH hosts before exporting.
 */
export function sanitizeSshHostsForExport(hosts: any[]): BackupPayload['sshHosts'] {
  if (!Array.isArray(hosts)) return [];
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined);
  return hosts.map((h) => {
    // SSH host profiles store the login as `user` and the jump host as `proxyJump` (SshHostProfile)
    const user = str(h.user) || str(h.username);
    const proxyJump = str(h.proxyJump) || str(h.jumpHost);
    return {
      id: str(h.id),
      name: str(h.name),
      host: String(h.host || ''),
      port: typeof h.port === 'number' ? h.port : 22,
      user,
      username: user,
      authType: str(h.authType),
      privateKeyPath: str(h.privateKeyPath),
      proxyJump,
      jumpHost: proxyJump,
      alias: str(h.alias),
      tags: Array.isArray(h.tags) ? h.tags.map(String) : undefined,
      defaultPath: str(h.defaultPath)
    };
  }).filter((h) => !!h.host);
}

export function createBackupEnvelope(payload: BackupPayload, passphrase?: string): BackupEnvelope {
  const pass = typeof passphrase === 'string' ? passphrase.trim() : '';
  if (!pass) {
    return {
      format: 'gitmap-backup-v1',
      encrypted: false,
      payload
    };
  }
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(pass, salt, 32, { N: 16384, r: 8, p: 1 });
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    format: 'gitmap-backup-v1',
    encrypted: true,
    kdf: 'scrypt',
    cipher: 'aes-256-gcm',
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: encrypted.toString('base64')
  };
}

export function parseBackupEnvelope(raw: string | BackupEnvelope, passphrase?: string): BackupPayload {
  let obj: any = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      throw new Error('Backup file is not valid JSON.');
    }
  }
  if (!obj || typeof obj !== 'object' || obj.format !== 'gitmap-backup-v1') {
    throw new Error('Unsupported backup format (expected gitmap-backup-v1).');
  }

  if (obj.encrypted === true) {
    const pass = typeof passphrase === 'string' ? passphrase.trim() : '';
    if (!pass) {
      throw new Error('PASSPHRASE_REQUIRED: This backup is encrypted; please provide the passphrase.');
    }
    try {
      const salt = Buffer.from(String(obj.salt || ''), 'base64');
      const iv = Buffer.from(String(obj.iv || ''), 'base64');
      const tag = Buffer.from(String(obj.tag || ''), 'base64');
      const ciphertext = Buffer.from(String(obj.ciphertext || ''), 'base64');
      const key = crypto.scryptSync(pass, salt, 32, { N: 16384, r: 8, p: 1 });
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
      const payload = JSON.parse(decrypted);
      if (!payload || typeof payload !== 'object') throw new Error('Invalid decrypted payload.');
      return payload as BackupPayload;
    } catch (err: any) {
      if (String(err?.message || '').startsWith('PASSPHRASE_REQUIRED')) throw err;
      throw new Error('Failed to decrypt backup: wrong passphrase or corrupted file.');
    }
  }

  if (!obj.payload || typeof obj.payload !== 'object') {
    throw new Error('Backup envelope is missing payload.');
  }
  return obj.payload as BackupPayload;
}

export function compareSemver(a: string, b: string): number {
  const norm = (v: string) =>
    String(v || '0.0.0')
      .trim()
      .replace(/^v/i, '')
      .split('-')[0]
      .split('.')
      .map((n) => parseInt(n, 10) || 0);
  const pa = norm(a);
  const pb = norm(b);
  const len = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < len; i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

export function checkGitHubUpdate(
  currentVersion: string,
  repoSlug = 'aimuch/GitMap',
  timeoutMs = 8000
): Promise<UpdateCheckResult> {
  return new Promise((resolve) => {
    const req = https.get(
      {
        hostname: 'api.github.com',
        path: `/repos/${repoSlug}/releases/latest`,
        headers: {
          'User-Agent': `GitMap/${currentVersion}`,
          Accept: 'application/vnd.github+json'
        },
        timeout: timeoutMs
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          if (body.length < 256 * 1024) body += chunk.toString('utf8');
        });
        res.on('end', () => {
          if (res.statusCode === 404) {
            resolve({
              currentVersion,
              latestVersion: currentVersion,
              hasUpdate: false,
              releaseUrl: `https://github.com/${repoSlug}/releases`,
              releaseName: null,
              releaseNotes: null,
              publishedAt: null,
              error: null
            });
            return;
          }
          if (!res.statusCode || res.statusCode >= 400) {
            resolve({
              currentVersion,
              latestVersion: null,
              hasUpdate: false,
              releaseUrl: `https://github.com/${repoSlug}/releases`,
              releaseName: null,
              releaseNotes: null,
              publishedAt: null,
              error: `GitHub API returned HTTP ${res.statusCode}`
            });
            return;
          }
          try {
            const json = JSON.parse(body);
            const tag = String(json.tag_name || json.name || '').trim();
            const latestVersion = tag ? tag.replace(/^v/i, '') : null;
            const hasUpdate = latestVersion ? compareSemver(latestVersion, currentVersion) > 0 : false;
            resolve({
              currentVersion,
              latestVersion,
              hasUpdate,
              releaseUrl: typeof json.html_url === 'string' ? json.html_url : `https://github.com/${repoSlug}/releases`,
              releaseName: typeof json.name === 'string' ? json.name : tag || null,
              releaseNotes: typeof json.body === 'string' ? json.body.slice(0, 6000) : null,
              publishedAt: typeof json.published_at === 'string' ? json.published_at : null,
              error: null
            });
          } catch (e: any) {
            resolve({
              currentVersion,
              latestVersion: null,
              hasUpdate: false,
              releaseUrl: `https://github.com/${repoSlug}/releases`,
              releaseName: null,
              releaseNotes: null,
              publishedAt: null,
              error: e?.message || 'Invalid JSON response'
            });
          }
        });
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error('Request timed out'));
    });
    req.on('error', (err) => {
      resolve({
        currentVersion,
        latestVersion: null,
        hasUpdate: false,
        releaseUrl: `https://github.com/${repoSlug}/releases`,
        releaseName: null,
        releaseNotes: null,
        publishedAt: null,
        error: err.message
      });
    });
  });
}
