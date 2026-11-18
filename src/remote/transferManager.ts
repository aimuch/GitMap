import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import { SFTPWrapper } from 'ssh2';
import { StateMachine } from '../utils/fsm';
import { quotePosixArg, sshManager } from './sshManager';

/**
 * Resumable file & folder transfers between this machine and SSH hosts (over SFTP).
 *
 * - Pause / resume: a paused transfer keeps its partial file; resuming continues from the destination's current size.
 * - Cancel: stops the transfer and deletes the partially transferred file (completed files are kept, and can be undone).
 * - Undo: moves everything the transfer created into a trash folder (a local one under GitMap's data folder, or
 *   ~/.gitmap-trash on the SSH host), so it can be restored. Transfers never overwrite: a name that's taken gets a " (1)" suffix.
 */

export type TransferDirection = 'upload' | 'download';
export type TransferState = 'queued' | 'scanning' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'undone';

interface TransferItem {
  src: string;
  dest: string;
  size: number;
  done: number;
  isDir: boolean;
  finished: boolean;
}

type TransferEvent = 'SCAN' | 'RUN' | 'PAUSE' | 'RESUME' | 'COMPLETE' | 'FAIL' | 'CANCEL' | 'UNDO' | 'RESTORE';

interface TransferJob {
  id: string;
  direction: TransferDirection;
  hostId: string;
  sources: string[];
  destDir: string;
  state: TransferState;
  fsm: StateMachine<TransferState, TransferEvent>;
  busyOp: 'cancelling' | 'undoing' | 'restoring' | null;
  /** State before an undo, to return to on restore. */
  stateBeforeUndo: TransferState | null;
  error: string | null;
  items: TransferItem[];
  scanned: boolean;
  /** Top-level paths created at the destination (what undo moves to the trash). */
  createdRoots: string[];
  trashDir: string | null;
  currentIndex: number;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  speed: number;
  speedSample: { at: number; bytes: number } | null;
  abort: (() => void) | null;
  runPromise: Promise<void> | null;
  activePartialItem: TransferItem | null;
}

export interface TransferSummary {
  id: string;
  direction: TransferDirection;
  hostId: string;
  name: string;
  destDir: string;
  state: TransferState;
  error: string | null;
  totalBytes: number;
  doneBytes: number;
  totalFiles: number;
  doneFiles: number;
  currentFile: string | null;
  speed: number;
  etaSeconds: number | null;
  createdAt: number;
  finishedAt: number | null;
  canUndo: boolean;
  canRestore: boolean;
}

const MAX_CONCURRENT_JOBS = 2;
const STREAM_CHUNK = 256 * 1024;

/** Read a job's state without TypeScript narrowing it (it's changed asynchronously by pause() / cancel()). */
function stateOf(job: { state: TransferState }): TransferState {
  return job.state;
}

class TransferInterrupted extends Error {
  constructor(public readonly reason: 'paused' | 'cancelled') {
    super(reason);
  }
}

function sftpStat(sftp: SFTPWrapper, p: string): Promise<{ size: number; isDirectory: boolean } | null> {
  return new Promise((resolve) => {
    sftp.stat(p, (err, st) => resolve(err || !st ? null : { size: st.size, isDirectory: st.isDirectory() }));
  });
}

function sftpReaddir(sftp: SFTPWrapper, p: string): Promise<{ filename: string; mode: number; size: number }[]> {
  return new Promise((resolve, reject) => {
    sftp.readdir(p, (err, list) => {
      if (err) reject(err);
      else resolve((list || []).map((it) => ({ filename: it.filename, mode: it.attrs.mode || 0, size: it.attrs.size || 0 })));
    });
  });
}

function sftpMkdir(sftp: SFTPWrapper, p: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.mkdir(p, (err) => {
      if (!err) return resolve();
      sftp.stat(p, (statErr, st) => (!statErr && st && st.isDirectory() ? resolve() : reject(err)));
    });
  });
}

function sftpUnlink(sftp: SFTPWrapper, p: string): Promise<void> {
  return new Promise((resolve) => sftp.unlink(p, () => resolve()));
}

function splitName(name: string): [string, string] {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? [name.substring(0, dot), name.substring(dot)] : [name, ''];
}

async function uniqueName(
  dir: string,
  name: string,
  exists: (p: string) => Promise<boolean>,
  join: (a: string, b: string) => string,
  reserved: Set<string>
): Promise<string> {
  const firstFull = join(dir, name);
  if (!reserved.has(firstFull) && !(await exists(firstFull))) {
    reserved.add(firstFull);
    return name;
  }
  const [base, ext] = splitName(name);
  for (let i = 1; i < 1000; i++) {
    const candidate = `${base} (${i})${ext}`;
    const full = join(dir, candidate);
    if (!reserved.has(full) && !(await exists(full))) {
      reserved.add(full);
      return candidate;
    }
  }
  const fallback = `${base} (${Date.now()})${ext}`;
  reserved.add(join(dir, fallback));
  return fallback;
}

async function localExists(p: string) {
  try {
    await fs.promises.lstat(p);
    return true;
  } catch (_) {
    return false;
  }
}

export class TransferManager {
  private readonly jobs = new Map<string, TransferJob>();
  private trashRoot = '';
  private listener: ((transfers: TransferSummary[]) => void) | null = null;
  private notifyTimer: NodeJS.Timeout | null = null;

  public init(dataDir: string, listener: (transfers: TransferSummary[]) => void) {
    this.trashRoot = path.join(dataDir, 'trash');
    this.listener = listener;
  }

  public list(): TransferSummary[] {
    return Array.from(this.jobs.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((job) => this.summarise(job));
  }

  public start(direction: TransferDirection, hostId: string, sources: string[], destDir: string): TransferSummary {
    const clean = sources.map((s) => String(s)).filter((s) => s.trim() !== '');
    if (clean.length === 0) throw new Error('Nothing to transfer.');
    if (!destDir) throw new Error('No destination folder.');
    const id = 'tx-' + crypto.randomBytes(6).toString('hex');
    const fsm = new StateMachine<TransferState, TransferEvent>({
      name: 'sftpTransfer',
      id,
      initial: 'queued',
      transitions: {
        queued: { SCAN: 'scanning', RUN: 'running', PAUSE: 'paused', CANCEL: 'cancelled' },
        scanning: { RUN: 'running', PAUSE: 'paused', CANCEL: 'cancelled', FAIL: 'failed' },
        running: { PAUSE: 'paused', CANCEL: 'cancelled', COMPLETE: 'completed', FAIL: 'failed' },
        paused: { RESUME: 'queued', CANCEL: 'cancelled' },
        completed: { UNDO: 'undone' },
        failed: { RESUME: 'queued', UNDO: 'undone' },
        cancelled: { UNDO: 'undone' },
        undone: {
          RESTORE: ({ payload }) => (payload as TransferState) || 'completed'
        }
      },
      onTransition: ({ to }) => {
        job.state = to;
      }
    });
    const job: TransferJob = {
      id,
      direction,
      hostId,
      sources: clean,
      destDir,
      state: 'queued',
      fsm,
      busyOp: null,
      stateBeforeUndo: null,
      error: null,
      items: [],
      scanned: false,
      createdRoots: [],
      trashDir: null,
      currentIndex: 0,
      createdAt: Date.now(),
      startedAt: null,
      finishedAt: null,
      speed: 0,
      speedSample: null,
      abort: null,
      runPromise: null,
      activePartialItem: null
    };
    this.jobs.set(job.id, job);
    this.pump();
    this.notify(true);
    return this.summarise(job);
  }

  public pause(id: string) {
    const job = this.get(id);
    if (job.busyOp) return;
    if (job.state === 'queued') {
      job.fsm.send('PAUSE');
    } else if (job.state === 'running' || job.state === 'scanning') {
      job.fsm.send('PAUSE');
      job.abort?.();
    }
    this.notify(true);
    this.pump();
  }

  public resume(id: string) {
    const job = this.get(id);
    if (job.busyOp) return;
    if (job.state === 'paused' || job.state === 'failed') {
      job.fsm.send('RESUME');
      job.error = null;
      this.pump();
      this.notify(true);
    }
  }

  public async cancel(id: string) {
    const job = this.get(id);
    if (job.busyOp || job.state === 'completed' || job.state === 'cancelled' || job.state === 'undone') return;
    job.busyOp = 'cancelling';
    try {
      const wasActive = job.state === 'running' || job.state === 'scanning';
      if (!job.fsm.send('CANCEL')) {
        job.fsm.force('cancelled', 'cancel');
      }
      job.finishedAt = Date.now();
      const partialBeforeAbort = job.activePartialItem || job.items.find((it) => !it.isDir && !it.finished && it.done > 0) || null;
      if (wasActive || job.runPromise) {
        job.abort?.();
        if (job.runPromise) {
          await job.runPromise.catch(() => {});
        }
      }
      // Remove the partially transferred file after streams have closed
      const partial = partialBeforeAbort && !partialBeforeAbort.finished ? partialBeforeAbort : job.items.find((it) => !it.isDir && !it.finished && it.done > 0);
      if (partial) {
        await this.deletePartialItem(job, partial);
      }
    } finally {
      job.busyOp = null;
      this.notify(true);
      this.pump();
    }
  }

  private async deletePartialItem(job: TransferJob, partial: TransferItem) {
    try {
      if (job.direction === 'download') await fs.promises.rm(partial.dest, { force: true });
      else await sftpUnlink(await sshManager.getSftp(job.hostId), partial.dest);
    } catch (_) {}
    partial.done = 0;
  }

  /** Move everything the transfer created into a trash folder (restorable). */
  public async undo(id: string) {
    const job = this.get(id);
    if (job.busyOp) throw new Error('Transfer operation already in progress.');
    if (!(job.state === 'completed' || job.state === 'cancelled' || job.state === 'failed') || job.createdRoots.length === 0) {
      throw new Error('There is nothing to undo for this transfer.');
    }
    job.busyOp = 'undoing';
    try {
      if (job.direction === 'download') {
        const trash = path.join(this.trashRoot, job.id);
        await fs.promises.mkdir(trash, { recursive: true });
        for (const root of job.createdRoots) {
          if (!(await localExists(root))) continue;
          await moveLocal(root, path.join(trash, path.basename(root)));
        }
        job.trashDir = trash;
      } else {
        const session = await sshManager.ensureConnected(job.hostId);
        const trash = path.posix.join(session.homeDir || '/tmp', '.gitmap-trash', job.id);
        const moves = job.createdRoots.map((root) => `if [ -e ${quotePosixArg(root)} ]; then mv ${quotePosixArg(root)} ${quotePosixArg(trash + '/')}; fi`).join('\n');
        const res = await sshManager.execRemote(job.hostId, `mkdir -p ${quotePosixArg(trash)} && ${moves.length > 0 ? '{\n' + moves + '\n}' : 'true'}`);
        if (res.code !== 0) throw new Error(res.stderr.trim() || 'Unable to move the uploaded files to the trash.');
        job.trashDir = trash;
      }
      job.stateBeforeUndo = job.state;
      job.fsm.send('UNDO');
      this.notify(true);
    } finally {
      job.busyOp = null;
    }
  }

  /** Move the files of an undone transfer back from the trash. */
  public async restore(id: string) {
    const job = this.get(id);
    if (job.busyOp) throw new Error('Transfer operation already in progress.');
    if (job.state !== 'undone' || job.trashDir === null) throw new Error('This transfer hasn\'t been undone.');
    job.busyOp = 'restoring';
    try {
      if (job.direction === 'download') {
        for (const root of job.createdRoots) {
          const inTrash = path.join(job.trashDir, path.basename(root));
          if (!(await localExists(inTrash))) continue;
          if (await localExists(root)) throw new Error(`"${root}" already exists, so it can't be restored.`);
          await moveLocal(inTrash, root);
        }
        await fs.promises.rm(job.trashDir, { recursive: true, force: true });
      } else {
        const lines = job.createdRoots.map((root) => {
          const inTrash = path.posix.join(job.trashDir!, path.posix.basename(root));
          return `if [ -e ${quotePosixArg(inTrash)} ]; then if [ -e ${quotePosixArg(root)} ]; then echo ${quotePosixArg(root + ' already exists')} >&2; exit 3; fi; mv ${quotePosixArg(inTrash)} ${quotePosixArg(root)}; fi`;
        });
        const res = await sshManager.execRemote(job.hostId, lines.join('\n') + `\nrmdir ${quotePosixArg(job.trashDir)} 2>/dev/null; true`);
        if (res.code !== 0) throw new Error(res.stderr.trim() || 'Unable to restore the uploaded files.');
      }
      job.trashDir = null;
      const restoreTarget = job.stateBeforeUndo || 'completed';
      job.fsm.send('RESTORE', restoreTarget as any);
      job.stateBeforeUndo = null;
      this.notify(true);
    } finally {
      job.busyOp = null;
    }
  }

  /** Remove a finished or paused transfer from the list (cleaning up partial files and trash). */
  public async remove(id: string) {
    const job = this.get(id);
    if (job.busyOp) throw new Error('Transfer operation already in progress.');
    if (job.state === 'running' || job.state === 'scanning' || job.state === 'queued') throw new Error('Pause or cancel the transfer first.');
    if (job.runPromise) await job.runPromise.catch(() => {});
    if (job.state === 'paused' || job.state === 'failed') {
      for (const it of job.items) {
        if (!it.isDir && !it.finished && it.done > 0) {
          await this.deletePartialItem(job, it);
        }
      }
    }
    await this.purgeTrash(job);
    job.fsm.dispose();
    this.jobs.delete(id);
    this.notify(true);
  }

  public async clearFinished() {
    for (const job of Array.from(this.jobs.values())) {
      if (job.busyOp || job.runPromise) continue;
      if (job.state === 'completed' || job.state === 'cancelled' || job.state === 'undone' || job.state === 'failed') {
        if (job.state === 'failed') {
          for (const it of job.items) {
            if (!it.isDir && !it.finished && it.done > 0) {
              await this.deletePartialItem(job, it);
            }
          }
        }
        await this.purgeTrash(job);
        job.fsm.dispose();
        this.jobs.delete(job.id);
      }
    }
    this.notify(true);
  }

  public pauseAll() {
    for (const job of this.jobs.values()) {
      if (job.state === 'running' || job.state === 'scanning' || job.state === 'queued') this.pause(job.id);
    }
  }

  public resumeAll() {
    for (const job of this.jobs.values()) {
      if (job.state === 'paused') this.resume(job.id);
    }
  }

  /** Abort everything (on shutdown). Partial files are kept. */
  public dispose() {
    for (const job of this.jobs.values()) {
      if (job.state === 'running' || job.state === 'scanning') {
        job.fsm.send('PAUSE');
        job.abort?.();
      }
      job.fsm.dispose();
    }
  }

  private async purgeTrash(job: TransferJob) {
    if (job.state !== 'undone' || job.trashDir === null) return;
    try {
      if (job.direction === 'download') await fs.promises.rm(job.trashDir, { recursive: true, force: true });
      else if (job.trashDir.includes('/.gitmap-trash/')) await sshManager.execRemote(job.hostId, `rm -rf ${quotePosixArg(job.trashDir)}`);
    } catch (_) {}
  }

  private get(id: string): TransferJob {
    const job = this.jobs.get(id);
    if (!job) throw new Error('Unknown transfer.');
    return job;
  }

  private pump() {
    let running = Array.from(this.jobs.values()).filter((j) => j.state === 'running' || j.state === 'scanning' || j.runPromise !== null).length;
    const queued = Array.from(this.jobs.values())
      .filter((j) => j.state === 'queued' && j.runPromise === null && !j.busyOp)
      .sort((a, b) => a.createdAt - b.createdAt);
    for (const job of queued) {
      if (running >= MAX_CONCURRENT_JOBS) break;
      running++;
      const p = this.run(job).finally(() => {
        if (job.runPromise === p) job.runPromise = null;
        this.pump();
      });
      job.runPromise = p;
    }
  }

  private async run(job: TransferJob) {
    job.fsm.send(job.scanned ? 'RUN' : 'SCAN');
    job.startedAt = job.startedAt || Date.now();
    job.speedSample = null;
    job.speed = 0;
    this.notify(true);
    try {
      const sftp = await sshManager.getSftp(job.hostId);
      if (!job.scanned) {
        await this.scan(job, sftp);
        // Paused / cancelled while scanning: the listing is incomplete, so scan again when resumed
        if (job.state !== 'scanning') {
          job.items = [];
          job.createdRoots = [];
          throw new TransferInterrupted(stateOf(job) === 'cancelled' ? 'cancelled' : 'paused');
        }
        job.scanned = true;
        job.fsm.send('RUN');
        this.notify(true);
      }
      for (let i = 0; i < job.items.length; i++) {
        const item = job.items[i];
        if (item.finished) continue;
        if (stateOf(job) !== 'running') throw new TransferInterrupted(stateOf(job) === 'cancelled' ? 'cancelled' : 'paused');
        job.currentIndex = i;
        if (item.isDir) {
          if (job.direction === 'download') await fs.promises.mkdir(item.dest, { recursive: true });
          else await sftpMkdir(sftp, item.dest);
        } else {
          await this.transferFile(job, item, sftp);
        }
        item.finished = true;
        this.notify(false);
      }
      job.fsm.send('COMPLETE');
      job.finishedAt = Date.now();
      job.speed = 0;
    } catch (err) {
      if (err instanceof TransferInterrupted || stateOf(job) === 'paused' || stateOf(job) === 'cancelled') {
        // Paused / cancelled: the state was already set by pause() / cancel()
      } else {
        job.fsm.send('FAIL', undefined, { error: err instanceof Error ? err.message : String(err) });
        job.error = err instanceof Error ? err.message : String(err);
        job.finishedAt = Date.now();
      }
      job.speed = 0;
    } finally {
      job.abort = null;
      this.notify(true);
    }
  }

  private async scan(job: TransferJob, sftp: SFTPWrapper) {
    const items: TransferItem[] = [];
    const roots: string[] = [];
    if (job.direction === 'upload') {
      let existingRemoteNames: Set<string> | null = null;
      try {
        const list = await sftpReaddir(sftp, job.destDir);
        existingRemoteNames = new Set(list.map((e) => path.posix.join(job.destDir, e.filename)));
      } catch (_) {}
      const destExists = async (p: string) =>
        existingRemoteNames !== null ? existingRemoteNames.has(p) : (await sftpStat(sftp, p)) !== null;
      const walk = async (src: string, dest: string) => {
        if (job.state !== 'scanning') return;
        const st = await fs.promises.stat(src);
        if (st.isDirectory()) {
          items.push({ src, dest, size: 0, done: 0, isDir: true, finished: false });
          const children = await fs.promises.readdir(src, { withFileTypes: true });
          for (const child of children) {
            if (child.isSymbolicLink()) {
              // Follow links to files; skip links to folders (avoids cycles)
              try {
                if ((await fs.promises.stat(path.join(src, child.name))).isDirectory()) continue;
              } catch (_) {
                continue;
              }
            }
            await walk(path.join(src, child.name), path.posix.join(dest, child.name));
          }
        } else if (st.isFile()) {
          items.push({ src, dest, size: st.size, done: 0, isDir: false, finished: false });
        }
      };
      const reserved = new Set<string>();
      for (const src of job.sources) {
        const name = await uniqueName(job.destDir, path.basename(src), destExists, path.posix.join, reserved);
        const dest = path.posix.join(job.destDir, name);
        roots.push(dest);
        await walk(src, dest);
      }
    } else {
      const walk = async (src: string, dest: string) => {
        if (job.state !== 'scanning') return;
        const st = await sftpStat(sftp, src);
        if (st === null) throw new Error(`"${src}" doesn't exist on ${job.hostId}.`);
        if (st.isDirectory) {
          items.push({ src, dest, size: 0, done: 0, isDir: true, finished: false });
          for (const child of await sftpReaddir(sftp, src)) {
            if (child.filename === '.' || child.filename === '..') continue;
            const childPath = path.posix.join(src, child.filename);
            if ((child.mode & 0o170000) === 0o120000) {
              const target = await sftpStat(sftp, childPath);
              if (target === null || target.isDirectory) continue;
            }
            await walk(childPath, path.join(dest, child.filename));
          }
        } else {
          items.push({ src, dest, size: st.size, done: 0, isDir: false, finished: false });
        }
      };
      await fs.promises.mkdir(job.destDir, { recursive: true });
      let existingLocalNames: Set<string> | null = null;
      try {
        const names = await fs.promises.readdir(job.destDir);
        existingLocalNames = new Set(names.map((n) => path.join(job.destDir, n)));
      } catch (_) {}
      const fastLocalExists = async (p: string) =>
        existingLocalNames !== null ? existingLocalNames.has(p) : localExists(p);
      const reserved = new Set<string>();
      for (const src of job.sources) {
        const name = await uniqueName(job.destDir, path.posix.basename(src) || 'download', fastLocalExists, path.join, reserved);
        const dest = path.join(job.destDir, name);
        roots.push(dest);
        await walk(src, dest);
      }
    }
    job.items = items;
    job.createdRoots = roots;
  }

  private async transferFile(job: TransferJob, item: TransferItem, sftp: SFTPWrapper) {
    // Resume from what's actually at the destination (bytes counted but not yet written are re-sent)
    let offset = 0;
    if (item.done > 0) {
      if (job.direction === 'download') {
        try {
          offset = (await fs.promises.stat(item.dest)).size;
        } catch (_) {
          offset = 0;
        }
      } else {
        const st = await sftpStat(sftp, item.dest);
        offset = st ? st.size : 0;
      }
      offset = Math.min(offset, item.size);
    }
    item.done = offset;
    if (offset >= item.size && item.size > 0) return;

    job.activePartialItem = item;
    const reader = job.direction === 'download'
      ? sftp.createReadStream(item.src, { start: offset, highWaterMark: STREAM_CHUNK } as any)
      : fs.createReadStream(item.src, { start: offset, highWaterMark: STREAM_CHUNK });
    const writer = job.direction === 'download'
      ? fs.createWriteStream(item.dest, { flags: offset > 0 ? 'r+' : 'w', start: offset })
      : sftp.createWriteStream(item.dest, { flags: offset > 0 ? 'r+' : 'w', start: offset } as any);

    reader.on('data', (chunk: Buffer | string) => {
      item.done += chunk.length;
      this.notify(false);
    });
    job.abort = () => {
      const reason = new TransferInterrupted(job.state === 'cancelled' ? 'cancelled' : 'paused');
      (reader as any).destroy(reason);
      (writer as any).destroy(reason);
    };
    try {
      await pipeline(reader as any, writer as any);
    } finally {
      job.abort = null;
      job.activePartialItem = null;
    }
  }

  private summarise(job: TransferJob): TransferSummary {
    let totalBytes = 0;
    let doneBytes = 0;
    let totalFiles = 0;
    let doneFiles = 0;
    for (const it of job.items) {
      if (it.isDir) continue;
      totalFiles++;
      totalBytes += it.size;
      doneBytes += Math.min(it.done, it.size);
      if (it.finished) doneFiles++;
    }
    const current = job.items[job.currentIndex];
    const name = job.sources.length === 1
      ? (job.direction === 'upload' ? path.basename(job.sources[0]) : path.posix.basename(job.sources[0])) || job.sources[0]
      : `${job.sources.length} items`;
    const remaining = totalBytes - doneBytes;
    return {
      id: job.id,
      direction: job.direction,
      hostId: job.hostId,
      name,
      destDir: job.destDir,
      state: job.state,
      error: job.error,
      totalBytes,
      doneBytes,
      totalFiles,
      doneFiles,
      currentFile: (job.state === 'running' || job.state === 'paused') && current && !current.isDir ? current.src : null,
      speed: job.speed,
      etaSeconds: job.state === 'running' && job.speed > 0 ? Math.round(remaining / job.speed) : null,
      createdAt: job.createdAt,
      finishedAt: job.finishedAt,
      canUndo: (job.state === 'completed' || job.state === 'cancelled' || job.state === 'failed') && job.createdRoots.length > 0 && job.items.some((it) => it.finished),
      canRestore: job.state === 'undone' && job.trashDir !== null
    };
  }

  private updateSpeeds() {
    const now = Date.now();
    for (const job of this.jobs.values()) {
      if (job.state !== 'running') continue;
      let bytes = 0;
      for (const it of job.items) if (!it.isDir) bytes += it.done;
      if (job.speedSample !== null && now - job.speedSample.at >= 400) {
        const instant = ((bytes - job.speedSample.bytes) * 1000) / (now - job.speedSample.at);
        job.speed = job.speed === 0 ? instant : job.speed * 0.7 + instant * 0.3;
        job.speedSample = { at: now, bytes };
      } else if (job.speedSample === null) {
        job.speedSample = { at: now, bytes };
      }
    }
  }

  /** Notify listeners: immediately for state changes, otherwise at most every 250ms. */
  private notify(immediate: boolean) {
    if (immediate) {
      if (this.notifyTimer !== null) {
        clearTimeout(this.notifyTimer);
        this.notifyTimer = null;
      }
      this.updateSpeeds();
      this.listener?.(this.list());
      return;
    }
    if (this.notifyTimer !== null) return;
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = null;
      this.updateSpeeds();
      this.listener?.(this.list());
    }, 250);
  }
}

async function moveLocal(from: string, to: string) {
  try {
    await fs.promises.rename(from, to);
  } catch (err: any) {
    if (err && err.code === 'EXDEV') {
      await fs.promises.cp(from, to, { recursive: true });
      await fs.promises.rm(from, { recursive: true, force: true });
    } else {
      throw err;
    }
  }
}

export const transferManager = new TransferManager();
