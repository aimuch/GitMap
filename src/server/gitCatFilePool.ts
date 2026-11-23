import { ChildProcess, spawn } from 'child_process';

/**
 * Bounded Least-Recently-Used (LRU) cache backed by Map insertion order.
 * Ideal for Git content-addressed immutable objects (resolved commit trees, blobs, diff-tree maps).
 */
export class LruCache<K, V> {
  private readonly store = new Map<K, V>();

  constructor(private readonly maxEntries: number) {}

  public get(key: K): V | undefined {
    const val = this.store.get(key);
    if (val === undefined) return undefined;
    this.store.delete(key);
    this.store.set(key, val);
    return val;
  }

  public set(key: K, value: V): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next();
      if (!oldest.done) this.store.delete(oldest.value);
    }
    this.store.set(key, value);
  }

  public has(key: K): boolean {
    return this.store.has(key);
  }

  public clear(): void {
    this.store.clear();
  }

  public get size(): number {
    return this.store.size;
  }
}

export interface CatFileObjectResult {
  objectHash: string;
  type: 'blob' | 'tree' | 'commit' | 'tag';
  size: number;
  buffer: Buffer;
  truncated: boolean;
  fromCache?: boolean;
}

interface PendingCatFileReq {
  spec: string;
  maxBytes: number;
  resolve: (res: CatFileObjectResult | null) => void;
  reject: (err: Error) => void;
}

const FULL_SHA_RE = /^[0-9a-f]{40,64}$/i;

export function isImmutableCommitHash(ref: string): boolean {
  return FULL_SHA_RE.test(ref);
}

/**
 * Single-repository persistent `git cat-file --batch` worker.
 * Streams object lookups over one reusable child process, avoiding per-file fork/exec latency.
 * Safely drains oversized blobs beyond `maxBytes` without buffering them in memory or desyncing the stream.
 */
export class CatFileBatchWorker {
  private proc: ChildProcess | null = null;
  private queue: PendingCatFileReq[] = [];
  private active: PendingCatFileReq | null = null;
  private phase: 'header' | 'body' | 'trail' = 'header';
  private headerBuf: Buffer = Buffer.alloc(0);
  private curHash = '';
  private curType: CatFileObjectResult['type'] = 'blob';
  private curSize = 0;
  private bodyRemaining = 0;
  private keptBytes = 0;
  private bodyChunks: Buffer[] = [];
  private idleTimer: NodeJS.Timeout | null = null;
  private disposed = false;

  constructor(
    private readonly gitPath: string,
    public readonly repoPath: string,
    private readonly idleTimeoutMs: number,
    private readonly onClosed: () => void
  ) {}

  public readObject(spec: string, maxBytes: number): Promise<CatFileObjectResult | null> {
    if (this.disposed) {
      return Promise.reject(new Error('CatFileBatchWorker has been disposed.'));
    }
    if (!spec || spec.includes('\n') || spec.includes('\r') || spec.includes('\0')) {
      return Promise.reject(new Error('Invalid cat-file object spec.'));
    }

    this.ensureProcess();
    this.clearIdleTimer();

    return new Promise<CatFileObjectResult | null>((resolve, reject) => {
      const req: PendingCatFileReq = {
        spec,
        maxBytes: Math.max(1, Math.floor(maxBytes)),
        resolve,
        reject
      };
      this.queue.push(req);
      this.pumpWrite(req);
    });
  }

  private ensureProcess(): void {
    if (this.proc && !this.proc.killed && this.proc.exitCode === null) return;
    const proc = spawn(this.gitPath, ['cat-file', '--batch'], {
      cwd: this.repoPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    this.proc = proc;
    this.phase = 'header';
    this.headerBuf = Buffer.alloc(0);
    this.active = null;
    this.bodyChunks = [];
    this.bodyRemaining = 0;
    this.keptBytes = 0;

    proc.stdout?.on('data', (chunk: Buffer) => this.onStdoutData(chunk));
    proc.on('error', (err) => this.failAll(err instanceof Error ? err : new Error(String(err))));
    proc.on('close', (code) => {
      if (this.proc === proc) this.proc = null;
      if (this.active || this.queue.length > 0) {
        this.failAll(new Error(`git cat-file --batch exited unexpectedly (code ${code ?? 'null'}).`));
      }
      this.clearIdleTimer();
      this.onClosed();
    });
  }

  private pumpWrite(req: PendingCatFileReq): void {
    if (!this.proc || !this.proc.stdin || this.proc.stdin.destroyed) {
      this.failAll(new Error('git cat-file stdin is not writable.'));
      return;
    }
    if (!this.active) {
      this.active = this.queue.shift() || null;
    }
    this.proc.stdin.write(req.spec + '\n');
  }

  private onStdoutData(chunk: Buffer): void {
    let offset = 0;
    while (offset < chunk.length) {
      if (!this.active) {
        this.active = this.queue.shift() || null;
        if (!this.active) break;
      }

      if (this.phase === 'header') {
        const nlIdx = chunk.indexOf(0x0a, offset);
        if (nlIdx === -1) {
          this.headerBuf = this.headerBuf.length > 0
            ? Buffer.concat([this.headerBuf, chunk.subarray(offset)])
            : Buffer.from(chunk.subarray(offset));
          offset = chunk.length;
          break;
        }
        const lineBuf = this.headerBuf.length > 0
          ? Buffer.concat([this.headerBuf, chunk.subarray(offset, nlIdx)])
          : chunk.subarray(offset, nlIdx);
        this.headerBuf = Buffer.alloc(0);
        offset = nlIdx + 1;

        const line = lineBuf.toString('utf8').replace(/\r$/, '');
        if (line.endsWith(' missing') || line.endsWith(' ambiguous') || line.endsWith(' excluded')) {
          const done = this.active;
          this.active = this.queue.shift() || null;
          done.resolve(null);
          if (!this.active) this.scheduleIdleTimer();
          continue;
        }

        const m = /^([0-9a-f]{40,64})\s+(blob|tree|commit|tag)\s+(\d+)$/.exec(line);
        if (!m) {
          this.failAll(new Error(`Unexpected git cat-file --batch header: ${line.slice(0, 120)}`));
          this.dispose();
          return;
        }

        this.curHash = m[1];
        this.curType = m[2] as CatFileObjectResult['type'];
        this.curSize = parseInt(m[3], 10);
        this.bodyRemaining = this.curSize;
        this.keptBytes = 0;
        this.bodyChunks = [];
        this.phase = this.curSize > 0 ? 'body' : 'trail';
      } else if (this.phase === 'body') {
        const take = Math.min(this.bodyRemaining, chunk.length - offset);
        if (take > 0) {
          const keepNeed = Math.max(0, this.active.maxBytes - this.keptBytes);
          const toKeep = Math.min(take, keepNeed);
          if (toKeep > 0) {
            this.bodyChunks.push(Buffer.from(chunk.subarray(offset, offset + toKeep)));
            this.keptBytes += toKeep;
          }
          this.bodyRemaining -= take;
          offset += take;
        }
        if (this.bodyRemaining === 0) {
          this.phase = 'trail';
        }
      } else if (this.phase === 'trail') {
        // Consume the single trailing LF separating cat-file --batch records
        offset += 1;
        const done = this.active;
        const buffer = this.bodyChunks.length === 1
          ? this.bodyChunks[0]
          : this.bodyChunks.length > 1
            ? Buffer.concat(this.bodyChunks, this.keptBytes)
            : Buffer.alloc(0);
        const result: CatFileObjectResult = {
          objectHash: this.curHash,
          type: this.curType,
          size: this.curSize,
          buffer,
          truncated: this.curSize > done.maxBytes
        };
        this.bodyChunks = [];
        this.keptBytes = 0;
        this.phase = 'header';
        this.active = this.queue.shift() || null;
        done.resolve(result);
        if (!this.active) this.scheduleIdleTimer();
      }
    }
  }

  private failAll(err: Error): void {
    const active = this.active;
    this.active = null;
    const rest = this.queue.splice(0, this.queue.length);
    if (active) active.reject(err);
    for (const r of rest) r.reject(err);
  }

  private scheduleIdleTimer(): void {
    this.clearIdleTimer();
    if (this.idleTimeoutMs <= 0) return;
    this.idleTimer = setTimeout(() => {
      if (!this.active && this.queue.length === 0) {
        this.closeProcess();
      }
    }, this.idleTimeoutMs);
    this.idleTimer.unref();
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private closeProcess(): void {
    this.clearIdleTimer();
    const proc = this.proc;
    this.proc = null;
    if (!proc) return;
    try {
      proc.stdin?.end();
    } catch { /* ignore */ }
    setTimeout(() => {
      if (proc.exitCode === null && !proc.killed) {
        try { proc.kill(); } catch { /* ignore */ }
      }
    }, 300).unref();
  }

  public dispose(): void {
    this.disposed = true;
    this.failAll(new Error('CatFileBatchWorker disposed.'));
    this.closeProcess();
  }
}

interface CachedBlobEntry {
  objectHash: string;
  size: number;
  buffer: Buffer;
  truncated: boolean;
  maxBytesCap: number;
}

/**
 * Pooled persistent `git cat-file --batch` manager + immutable blob LRU cache.
 * - Local repos reuse a pooled persistent process (<5ms per lookup).
 * - Both local and Remote-SSH repos share the immutable SHA-keyed blob cache.
 */
export class CatFileBatchPool {
  private readonly workers = new Map<string, CatFileBatchWorker>();
  private readonly blobCache: LruCache<string, CachedBlobEntry>;
  private readonly maxWorkers: number;
  private readonly idleTimeoutMs: number;
  private readonly maxCacheEntryBytes: number;

  constructor(options?: {
    maxWorkers?: number;
    idleTimeoutMs?: number;
    maxCachedBlobs?: number;
    maxCacheEntryBytes?: number;
  }) {
    this.maxWorkers = options?.maxWorkers ?? 6;
    this.idleTimeoutMs = options?.idleTimeoutMs ?? 25_000;
    this.maxCacheEntryBytes = options?.maxCacheEntryBytes ?? 512 * 1024;
    this.blobCache = new LruCache<string, CachedBlobEntry>(options?.maxCachedBlobs ?? 180);
  }

  public getCachedCommitFile(repo: string, commitRef: string, filePath: string, maxBytes: number): CatFileObjectResult | null {
    if (!isImmutableCommitHash(commitRef)) return null;
    const key = `${repo}\0${commitRef}\0${filePath}`;
    const hit = this.blobCache.get(key);
    if (!hit) return null;
    // If cached copy was truncated at a smaller cap than now requested, re-fetch
    if (hit.truncated && hit.maxBytesCap < maxBytes) return null;
    const truncated = hit.size > maxBytes || hit.truncated;
    const buffer = hit.buffer.length > maxBytes ? hit.buffer.subarray(0, maxBytes) : hit.buffer;
    return {
      objectHash: hit.objectHash,
      type: 'blob',
      size: hit.size,
      buffer,
      truncated,
      fromCache: true
    };
  }

  public putCachedCommitFile(
    repo: string,
    commitRef: string,
    filePath: string,
    entry: { objectHash: string; size: number; buffer: Buffer; truncated: boolean; maxBytesCap: number }
  ): void {
    if (!isImmutableCommitHash(commitRef)) return;
    if (entry.buffer.length > this.maxCacheEntryBytes) return;
    const key = `${repo}\0${commitRef}\0${filePath}`;
    this.blobCache.set(key, entry);
  }

  public async readLocalCommitBlob(
    gitPath: string,
    repoPath: string,
    commitRef: string,
    filePath: string,
    maxBytes: number
  ): Promise<CatFileObjectResult | null> {
    const cached = this.getCachedCommitFile(repoPath, commitRef, filePath, maxBytes);
    if (cached) return cached;

    let worker = this.workers.get(repoPath);
    if (worker) {
      // Touch for LRU worker eviction
      this.workers.delete(repoPath);
      this.workers.set(repoPath, worker);
    } else {
      if (this.workers.size >= this.maxWorkers) {
        const oldestKey = this.workers.keys().next();
        if (!oldestKey.done) {
          const oldWorker = this.workers.get(oldestKey.value);
          this.workers.delete(oldestKey.value);
          oldWorker?.dispose();
        }
      }
      worker = new CatFileBatchWorker(gitPath, repoPath, this.idleTimeoutMs, () => {
        if (this.workers.get(repoPath) === worker) {
          this.workers.delete(repoPath);
        }
      });
      this.workers.set(repoPath, worker);
    }

    const res = await worker.readObject(`${commitRef}:${filePath}`, maxBytes);
    if (!res || res.type !== 'blob') return null;

    this.putCachedCommitFile(repoPath, commitRef, filePath, {
      objectHash: res.objectHash,
      size: res.size,
      buffer: res.buffer,
      truncated: res.truncated,
      maxBytesCap: maxBytes
    });
    return res;
  }

  public get activeWorkerCount(): number {
    return this.workers.size;
  }

  public get cachedBlobCount(): number {
    return this.blobCache.size;
  }

  public dispose(): void {
    for (const w of this.workers.values()) {
      w.dispose();
    }
    this.workers.clear();
    this.blobCache.clear();
  }
}
