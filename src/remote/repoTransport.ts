import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { sshManager } from './sshManager';

export interface ParsedSshRepo {
  hostId: string;
  remotePath: string;
}

export function isRemoteRepo(repoOrPath: string): boolean {
  return typeof repoOrPath === 'string' && repoOrPath.startsWith('ssh://');
}

export function parseRemoteRepo(repoUri: string): ParsedSshRepo | null {
  if (!isRemoteRepo(repoUri)) return null;
  const rest = repoUri.substring(6); // after "ssh://"
  const slashIdx = rest.indexOf('/');
  if (slashIdx === -1) {
    return { hostId: decodeURIComponent(rest), remotePath: '/' };
  }
  const hostId = decodeURIComponent(rest.substring(0, slashIdx));
  const remotePath = path.posix.normalize(rest.substring(slashIdx)).replace(/\/+$/, '') || '/';
  return { hostId, remotePath };
}

export function formatRemoteRepoUri(hostId: string, remotePath: string): string {
  const norm = path.posix.normalize(remotePath.startsWith('/') ? remotePath : '/' + remotePath).replace(/\/+$/, '') || '/';
  return `ssh://${encodeURIComponent(hostId)}${norm}`;
}

export function joinRepoPath(repo: string, relFilePath: string): string {
  const cleanRel = relFilePath.replace(/\\/g, '/').replace(/^\/+/, '');
  const parsed = parseRemoteRepo(repo);
  if (parsed) {
    return formatRemoteRepoUri(parsed.hostId, path.posix.join(parsed.remotePath, cleanRel));
  }
  return path.join(repo, cleanRel);
}

export function formatRepoFullDisplayPath(repo: string): string {
  const parsed = parseRemoteRepo(repo);
  if (parsed) {
    return `${parsed.hostId}:${parsed.remotePath}`;
  }
  return repo;
}

export async function doesRepoFileExist(repo: string, relFilePath: string): Promise<boolean> {
  const cleanRel = relFilePath.replace(/\\/g, '/').replace(/^\/+/, '');
  const parsed = parseRemoteRepo(repo);
  if (parsed) {
    return sshManager.remoteExists(parsed.hostId, path.posix.join(parsed.remotePath, cleanRel));
  }
  return new Promise<boolean>((resolve) => {
    fs.access(path.join(repo, cleanRel), fs.constants.R_OK, (err) => resolve(err === null));
  });
}

export async function readRepoFileBuffer(repo: string, relOrAbsPath: string, maxBytes?: number): Promise<Buffer | null> {
  const parsed = parseRemoteRepo(repo);
  if (parsed) {
    const target = relOrAbsPath.startsWith('/') ? relOrAbsPath : path.posix.join(parsed.remotePath, relOrAbsPath);
    try {
      return await sshManager.readRemoteFile(parsed.hostId, target, maxBytes);
    } catch (_) {
      return null;
    }
  }
  const target = path.isAbsolute(relOrAbsPath) ? relOrAbsPath : path.join(repo, relOrAbsPath);
  try {
    const stat = await fs.promises.lstat(target);
    if (!stat.isFile()) return null;
    if (typeof maxBytes === 'number' && maxBytes > 0 && stat.size > maxBytes) {
      const fh = await fs.promises.open(target, 'r');
      try {
        const buf = Buffer.alloc(maxBytes);
        const { bytesRead } = await fh.read(buf, 0, maxBytes, 0);
        return buf.subarray(0, bytesRead);
      } finally {
        await fh.close();
      }
    }
    return await fs.promises.readFile(target);
  } catch (_) {
    return null;
  }
}

export async function writeRepoFileBuffer(repo: string, relFilePath: string, content: Buffer | string): Promise<void> {
  const cleanRel = relFilePath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (cleanRel.startsWith('..') || cleanRel.includes('/../')) {
    throw new Error('Invalid relative file path: ' + relFilePath);
  }
  const parsed = parseRemoteRepo(repo);
  if (parsed) {
    const target = path.posix.join(parsed.remotePath, cleanRel);
    await sshManager.writeRemoteFile(parsed.hostId, target, content);
    return;
  }
  const repoRoot = path.resolve(repo);
  const absPath = path.resolve(repoRoot, cleanRel);
  if (!absPath.startsWith(repoRoot + path.sep)) {
    throw new Error('Invalid file path: ' + relFilePath);
  }
  await fs.promises.mkdir(path.dirname(absPath), { recursive: true });
  await fs.promises.writeFile(absPath, content);
}

export async function createRepoTempFiles(
  repo: string,
  prefix: string,
  files: { [name: string]: string | Buffer }
): Promise<string> {
  const parsed = parseRemoteRepo(repo);
  if (parsed) {
    return sshManager.createRemoteTempDir(parsed.hostId, prefix, files);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content);
  }
  return dir;
}

export async function removeRepoTempDir(repo: string, tempDir: string): Promise<void> {
  const parsed = parseRemoteRepo(repo);
  if (parsed) {
    await sshManager.removeRemoteDir(parsed.hostId, tempDir);
    return;
  }
  await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
}
