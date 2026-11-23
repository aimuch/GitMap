import { execFile } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { DataSource } from '../dataSource';
import { parseRemoteRepo } from '../remote/repoTransport';
import { quotePosixArg, sshManager } from '../remote/sshManager';
import { RepoFileWatcher } from '../repoFileWatcher';
import { getRepoName } from '../utils';
import { RepoQuickStatus } from './gitWorkflowService';

const execFileAsync = promisify(execFile);

export interface SubmoduleItem {
  path: string;
  commit: string;
  shortCommit: string;
  describe: string;
  status: 'clean' | 'uninitialized' | 'modified' | 'conflict';
  url?: string;
  branch?: string;
}

export interface LfsStatusResult {
  installed: boolean;
  version: string | null;
  trackedPatterns: string[];
  files: Array<{ oid: string; pointer: boolean; path: string }>;
  totalFiles: number;
}

export interface CrossRepoCommitHit {
  repo: string;
  hash: string;
  shortHash: string;
  author: string;
  date: number;
  subject: string;
}

export interface ContentSearchMatch {
  line: number;
  column: number;
  text: string;
}

export interface ContentSearchFileGroup {
  file: string;
  matches: ContentSearchMatch[];
}

export interface ContentSearchResult {
  engine: 'rg' | 'git-grep' | 'grep';
  totalMatches: number;
  truncated: boolean;
  files: ContentSearchFileGroup[];
}

export interface RemoteHostStats {
  hostId: string;
  timestamp: number;
  cpuPercent: number | null;
  loadAvg: string | null;
  memUsedMb: number | null;
  memTotalMb: number | null;
  memPercent: number | null;
  diskUsed: string | null;
  diskTotal: string | null;
  diskPercent: number | null;
  diskMount: string | null;
  lowDiskWarning: boolean;
}

export interface FolderEndpoint {
  kind: 'local' | 'remote';
  path: string;
  hostId?: string;
}

export interface FolderDiffEntry {
  relPath: string;
  status: 'left-only' | 'right-only' | 'modified' | 'identical';
  leftSize: number | null;
  rightSize: number | null;
  leftMtime: number | null;
  rightMtime: number | null;
}

export interface FolderDiffResult {
  left: FolderEndpoint;
  right: FolderEndpoint;
  summary: {
    leftOnly: number;
    rightOnly: number;
    modified: number;
    identical: number;
    total: number;
  };
  truncated: boolean;
  /** Number of same-size-different-mtime files skipped from content hash verification (exceeded file-count or size cap). */
  hashCheckSkipped?: number;
  entries: FolderDiffEntry[];
}

export interface ActivityHeatmapDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  repos: { [repo: string]: number };
}

export interface ActivityHeatmapResult {
  weeks: number;
  days: ActivityHeatmapDay[];
  totalCommits: number;
  activeDays: number;
  maxDayCount: number;
  busiestDay: { date: string; count: number } | null;
  scannedRepos: number;
}

export interface LaunchpadSummaryResult {
  totals: {
    repos: number;
    online: number;
    offline: number;
    conflicts: number;
    dirty: number;
    readyToPush: number;
    behindRemote: number;
    clean: number;
    worktrees: number;
  };
  buckets: {
    conflicts: RepoQuickStatus[];
    dirty: RepoQuickStatus[];
    readyToPush: RepoQuickStatus[];
    behindRemote: RepoQuickStatus[];
    clean: RepoQuickStatus[];
    offline: RepoQuickStatus[];
  };
  worktreeCounts: { [repo: string]: number };
}

export interface PatchBundle {
  format: 'gitmap-patch-bundle';
  version: 1;
  createdAt: string;
  repoName: string;
  branch: string | null;
  baseHash: string | null;
  baseSubject: string;
  scope: 'working' | 'staged' | 'range';
  fromRef?: string;
  toRef?: string;
  note: string;
  stats: { files: number; insertions: number; deletions: number };
  files: string[];
  patch: string;
}

export interface PatchInspectResult {
  valid: boolean;
  isBundle: boolean;
  bundleMeta: Omit<PatchBundle, 'patch'> | null;
  files: string[];
  stats: { files: number; insertions: number; deletions: number };
  cleanApply: boolean;
  threeWayPossible: boolean;
  checkError: string | null;
  patchPreview: string;
  patchBytes: number;
}

/** Folder diff: at most this many same-size-different-time files get a content check, each up to HASH_CHECK_MAX_BYTES. */
const HASH_CHECK_MAX_FILES = 400;
const HASH_CHECK_MAX_BYTES = 20 * 1024 * 1024;
const LOCAL_HASH_CONCURRENCY = 6;
const REMOTE_HASH_BATCH_SIZE = 64;

const DEFAULT_EXCLUDES = ['.git', 'node_modules', 'dist', 'build', '.next', '__pycache__', '.venv', 'target', 'release'];

export function assertSafeRelSegmentPath(relPath: string): string {
  const normalized = String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('\0')) {
    throw new Error(`Invalid relative path: "${relPath}"`);
  }
  const segs = normalized.split('/');
  if (segs.some((s) => s === '..' || s === '.')) {
    throw new Error(`Unsafe relative path: "${relPath}"`);
  }
  return normalized;
}

export function parseEndpointSpec(spec: string | FolderEndpoint): FolderEndpoint {
  if (typeof spec === 'object' && spec !== null) {
    if (spec.kind === 'remote') {
      if (!spec.hostId || !spec.path) throw new Error('Remote folder requires hostId and path');
      return { kind: 'remote', hostId: spec.hostId, path: spec.path };
    }
    if (!spec.path) throw new Error('Local folder requires path');
    return { kind: 'local', path: path.resolve(spec.path) };
  }
  const raw = String(spec || '').trim();
  const remote = parseRemoteRepo(raw);
  if (remote) {
    return { kind: 'remote', hostId: remote.hostId, path: remote.remotePath };
  }
  return { kind: 'local', path: path.resolve(raw) };
}

async function execLocal(cmd: string, args: string[], cwd: string, timeoutMs = 20000): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true
    });
    return { stdout: String(stdout || ''), stderr: String(stderr || ''), code: 0 };
  } catch (err: any) {
    // A missing binary (ENOENT) must not look like exit code 1, which rg / grep use for "no matches":
    // otherwise searching on a machine without ripgrep silently returns nothing instead of falling back.
    const code = typeof err?.code === 'number' ? err.code : err?.code === 'ENOENT' ? 127 : 1;
    return {
      stdout: String(err?.stdout || ''),
      stderr: String(err?.stderr || err?.message || ''),
      code
    };
  }
}

export class EnhancementsService {
  constructor(private readonly dataSource: DataSource) {}

  /* ── 1. Git Submodules ──────────────────────────────────────────────────────── */

  public async getSubmodules(repo: string): Promise<SubmoduleItem[]> {
    const { stdout } = await this.dataSource.execGitRaw(repo, ['submodule', 'status', '--recursive']);
    const raw = stdout.toString('utf8');
    const urlMap = new Map<string, { url?: string; branch?: string }>();
    try {
      const cfg = await this.dataSource.execGitRaw(repo, ['config', '--file', '.gitmodules', '--get-regexp', '^submodule\\.']);
      const lines = cfg.stdout.toString('utf8').split(/\r?\n/);
      const byName = new Map<string, { path?: string; url?: string; branch?: string }>();
      for (const line of lines) {
        const m = /^submodule\.(.+)\.(path|url|branch)\s+(.+)$/.exec(line.trim());
        if (!m) continue;
        const entry = byName.get(m[1]) || {};
        (entry as any)[m[2]] = m[3].trim();
        byName.set(m[1], entry);
      }
      for (const entry of byName.values()) {
        if (entry.path) urlMap.set(entry.path, { url: entry.url, branch: entry.branch });
      }
    } catch {
      /* no .gitmodules or empty */
    }

    const items: SubmoduleItem[] = [];
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const prefix = line[0];
      const rest = line.slice(1).trim();
      const m = /^([0-9a-f]{7,40})\s+(\S+)(?:\s+\((.+)\))?$/.exec(rest);
      if (!m) continue;
      const commit = m[1];
      const subPath = m[2];
      const describe = m[3] || '';
      const status: SubmoduleItem['status'] =
        prefix === '-' ? 'uninitialized'
        : prefix === '+' ? 'modified'
        : prefix === 'U' ? 'conflict'
        : 'clean';
      const meta = urlMap.get(subPath);
      items.push({
        path: subPath,
        commit,
        shortCommit: commit.slice(0, 8),
        describe,
        status,
        url: meta?.url,
        branch: meta?.branch
      });
    }
    return items;
  }

  public async runSubmoduleAction(
    repo: string,
    action: 'init' | 'update' | 'sync',
    subPath?: string
  ): Promise<{ output: string }> {
    const args = ['submodule'];
    if (action === 'init') {
      args.push('update', '--init', '--recursive');
    } else if (action === 'update') {
      args.push('update', '--remote', '--recursive');
    } else {
      args.push('sync', '--recursive');
    }
    if (subPath) {
      const safe = assertSafeRelSegmentPath(subPath);
      args.push('--', safe);
    }
    const { stdout, stderr } = await this.dataSource.execGitRaw(repo, args);
    RepoFileWatcher.notifyPossibleRemoteChange(300);
    return { output: (stdout.toString('utf8') + '\n' + String(stderr || '')).trim() };
  }

  /* ── 2. Git LFS ─────────────────────────────────────────────────────────────── */

  public async getLfsStatus(repo: string): Promise<LfsStatusResult> {
    let version: string | null = null;
    try {
      const v = await this.dataSource.execGitRaw(repo, ['lfs', 'version']);
      const txt = v.stdout.toString('utf8').trim();
      if (txt) version = txt.split(/\r?\n/)[0];
    } catch {
      return { installed: false, version: null, trackedPatterns: [], files: [], totalFiles: 0 };
    }

    const trackedPatterns: string[] = [];
    try {
      const tr = await this.dataSource.execGitRaw(repo, ['lfs', 'track']);
      for (const line of tr.stdout.toString('utf8').split(/\r?\n/)) {
        const m = /^\s*(.+?)\s+\([^)]*\)\s*$/.exec(line);
        if (m) trackedPatterns.push(m[1].trim());
      }
    } catch { /* ignore */ }

    const files: LfsStatusResult['files'] = [];
    try {
      const ls = await this.dataSource.execGitRaw(repo, ['lfs', 'ls-files', '-l']);
      for (const line of ls.stdout.toString('utf8').split(/\r?\n/)) {
        const m = /^([0-9a-f]+)\s+([-*])\s+(.+)$/.exec(line.trim());
        if (!m) continue;
        files.push({
          oid: m[1].slice(0, 12),
          pointer: m[2] === '-',
          path: m[3].trim()
        });
      }
    } catch { /* ignore */ }

    return {
      installed: true,
      version,
      trackedPatterns,
      files: files.slice(0, 500),
      totalFiles: files.length
    };
  }

  public async runLfsAction(repo: string, action: 'pull' | 'fetch' | 'install'): Promise<{ output: string }> {
    const args = ['lfs', action];
    const { stdout, stderr } = await this.dataSource.execGitRaw(repo, args);
    RepoFileWatcher.notifyPossibleRemoteChange(300);
    return { output: (stdout.toString('utf8') + '\n' + String(stderr || '')).trim() };
  }

  /* ── 3. Cross-Repo Commit Search ────────────────────────────────────────────── */

  public async searchAcrossRepos(
    repos: string[],
    query: string,
    author?: string,
    limitPerRepo = 25
  ): Promise<CrossRepoCommitHit[]> {
    const q = String(query || '').trim();
    const auth = String(author || '').trim();
    if (!q && !auth) return [];
    const perRepo = Math.max(5, Math.min(100, limitPerRepo));
    const hits: CrossRepoCommitHit[] = [];
    const queue = repos.slice(0, 40);
    const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
      while (queue.length > 0) {
        const repo = queue.shift()!;
        try {
          const args = ['log', '--all', `-n${perRepo}`, '--format=%H%x1f%an%x1f%ct%x1f%s'];
          if (q) args.push('--regexp-ignore-case', `--grep=${q}`);
          if (auth) args.push('--regexp-ignore-case', `--author=${auth}`);
          const { stdout } = await this.dataSource.execGitRaw(repo, args);
          for (const line of stdout.toString('utf8').split(/\r?\n/)) {
            if (!line) continue;
            const [hash, an, ct, subject] = line.split('\x1f');
            if (!hash) continue;
            hits.push({
              repo,
              hash,
              shortHash: hash.slice(0, 8),
              author: an || '',
              date: Number(ct) || 0,
              subject: subject || ''
            });
          }
        } catch {
          /* skip unreachable/offline repo */
        }
      }
    });
    await Promise.all(workers);
    hits.sort((a, b) => b.date - a.date);
    return hits.slice(0, 300);
  }

  /* ── 4. Full-Text Content Search (Local & Remote-SSH) ───────────────────────── */

  public async searchContent(
    target: string,
    options: {
      query: string;
      regex?: boolean;
      caseSensitive?: boolean;
      excludes?: string[];
      maxMatches?: number;
    }
  ): Promise<ContentSearchResult> {
    const query = String(options.query || '');
    if (!query.trim()) {
      return { engine: 'rg', totalMatches: 0, truncated: false, files: [] };
    }
    const maxMatches = Math.max(20, Math.min(2000, options.maxMatches || 400));
    const excludes = (options.excludes && options.excludes.length > 0 ? options.excludes : DEFAULT_EXCLUDES)
      .map((g) => String(g).trim())
      .filter(Boolean);

    const remote = parseRemoteRepo(target);
    if (remote) {
      return this.searchContentRemote(remote.hostId, remote.remotePath, query, !!options.regex, !!options.caseSensitive, excludes, maxMatches);
    }
    return this.searchContentLocal(path.resolve(target), query, !!options.regex, !!options.caseSensitive, excludes, maxMatches);
  }

  private parseLineMatchOutput(raw: string, maxMatches: number): { files: ContentSearchFileGroup[]; totalMatches: number; truncated: boolean } {
    const map = new Map<string, ContentSearchMatch[]>();
    let totalMatches = 0;
    let truncated = false;
    for (const line of raw.split(/\r?\n/)) {
      if (!line) continue;
      // format: file:line:col:text  or  file:line:text
      const mCol = /^([^:\n]+):(\d+):(\d+):(.*)$/.exec(line);
      const mNoCol = !mCol ? /^([^:\n]+):(\d+):(.*)$/.exec(line) : null;
      let file = '';
      let lineNum = 1;
      let colNum = 1;
      let text = '';
      if (mCol) {
        file = mCol[1].replace(/^\.\//, '');
        lineNum = Number(mCol[2]) || 1;
        colNum = Number(mCol[3]) || 1;
        text = mCol[4];
      } else if (mNoCol) {
        file = mNoCol[1].replace(/^\.\//, '');
        lineNum = Number(mNoCol[2]) || 1;
        colNum = 1;
        text = mNoCol[3];
      } else {
        continue;
      }
      if (totalMatches >= maxMatches) {
        truncated = true;
        break;
      }
      let arr = map.get(file);
      if (!arr) {
        arr = [];
        map.set(file, arr);
      }
      arr.push({ line: lineNum, column: colNum, text: text.slice(0, 320) });
      totalMatches++;
    }
    const files: ContentSearchFileGroup[] = [];
    for (const [file, matches] of map.entries()) {
      files.push({ file, matches });
    }
    return { files, totalMatches, truncated };
  }

  private async searchContentLocal(
    dirPath: string,
    query: string,
    regex: boolean,
    caseSensitive: boolean,
    excludes: string[],
    maxMatches: number
  ): Promise<ContentSearchResult> {
    // Try ripgrep first
    const rgArgs = ['--no-heading', '--with-filename', '--line-number', '--column', '--color=never', '--max-filesize=2M', `--max-count=50`];
    if (!regex) rgArgs.push('--fixed-strings');
    if (!caseSensitive) rgArgs.push('--ignore-case');
    for (const ex of excludes) {
      rgArgs.push('--glob', `!${ex}`, '--glob', `!${ex}/**`);
    }
    rgArgs.push('--', query, '.');
    const rgRes = await execLocal('rg', rgArgs, dirPath, 15000);
    if (rgRes.code === 0 || rgRes.code === 1) {
      const parsed = this.parseLineMatchOutput(rgRes.stdout, maxMatches);
      return { engine: 'rg', ...parsed };
    }

    // Fallback to git grep
    const ggArgs = ['grep', '-n', '--column', '--no-color', '-I'];
    if (!regex) ggArgs.push('-F');
    if (!caseSensitive) ggArgs.push('-i');
    ggArgs.push('-e', query);
    const ggRes = await execLocal('git', ggArgs, dirPath, 15000);
    if (ggRes.code === 0 || ggRes.code === 1) {
      const parsed = this.parseLineMatchOutput(ggRes.stdout, maxMatches);
      return { engine: 'git-grep', ...parsed };
    }

    // Final fallback to POSIX grep
    const grepArgs = ['-rnI'];
    if (!regex) grepArgs.push('-F');
    else grepArgs.push('-E');
    if (!caseSensitive) grepArgs.push('-i');
    for (const ex of excludes) {
      grepArgs.push(`--exclude-dir=${ex}`);
    }
    grepArgs.push('--', query, '.');
    const gRes = await execLocal('grep', grepArgs, dirPath, 15000);
    const parsed = this.parseLineMatchOutput(gRes.stdout, maxMatches);
    return { engine: 'grep', ...parsed };
  }

  private async searchContentRemote(
    hostId: string,
    remotePath: string,
    query: string,
    regex: boolean,
    caseSensitive: boolean,
    excludes: string[],
    maxMatches: number
  ): Promise<ContentSearchResult> {
    const qDir = quotePosixArg(remotePath);
    const qPat = quotePosixArg(query);
    const rgFlags = [
      '--no-heading', '--with-filename', '--line-number', '--column', '--color=never', '--max-filesize=2M', '--max-count=50',
      regex ? '' : '--fixed-strings',
      caseSensitive ? '' : '--ignore-case',
      ...excludes.flatMap((ex) => ['--glob', quotePosixArg(`!${ex}`), '--glob', quotePosixArg(`!${ex}/**`)])
    ].filter(Boolean).join(' ');
    const ggFlags = [
      '-n', '--column', '--no-color', '-I',
      regex ? '' : '-F',
      caseSensitive ? '' : '-i'
    ].filter(Boolean).join(' ');
    const grepFlags = [
      '-rnI',
      regex ? '-E' : '-F',
      caseSensitive ? '' : '-i',
      ...excludes.map((ex) => `--exclude-dir=${quotePosixArg(ex)}`)
    ].filter(Boolean).join(' ');

    const cmd = [
      `cd ${qDir} 2>/dev/null || exit 2`,
      `if command -v rg >/dev/null 2>&1; then echo "__ENGINE__:rg"; rg ${rgFlags} -- ${qPat} . | head -n ${maxMatches + 1};`,
      `elif git rev-parse --is-inside-work-tree >/dev/null 2>&1; then echo "__ENGINE__:git-grep"; git grep ${ggFlags} -e ${qPat} | head -n ${maxMatches + 1};`,
      `else echo "__ENGINE__:grep"; grep ${grepFlags} -- ${qPat} . | head -n ${maxMatches + 1}; fi`
    ].join(' ');

    const res = await sshManager.execRemote(hostId, cmd);
    const text = res.stdout;
    const firstNl = text.indexOf('\n');
    let engine: ContentSearchResult['engine'] = 'rg';
    let body = text;
    if (firstNl > 0 && text.startsWith('__ENGINE__:')) {
      const e = text.slice('__ENGINE__:'.length, firstNl).trim();
      if (e === 'rg' || e === 'git-grep' || e === 'grep') engine = e;
      body = text.slice(firstNl + 1);
    }
    const parsed = this.parseLineMatchOutput(body, maxMatches);
    return { engine, ...parsed };
  }

  /* ── 5. Remote SSH Host Resource Telemetry ──────────────────────────────────── */

  public async getRemoteHostStats(hostId: string, mountPath?: string): Promise<RemoteHostStats> {
    const target = quotePosixArg(mountPath || '/');
    const script = [
      // Load average + CPU count
      `LOAD=$(cat /proc/loadavg 2>/dev/null | awk '{print $1" "$2" "$3}');`,
      `CORES=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 1);`,
      // CPU % is estimated from the 1-minute load average ÷ cores (below), so no /proc/stat sample is taken
      `MEM=$(free -m 2>/dev/null | awk '/^Mem:/{print $3" "$2}');`,
      `DISK=$(df -hP ${target} 2>/dev/null | tail -n 1 | awk '{print $3" "$2" "$5" "$6}');`,
      `printf 'LOAD=%s\\nCORES=%s\\nMEM=%s\\nDISK=%s\\n' "$LOAD" "$CORES" "$MEM" "$DISK"`
    ].join(' ');

    const res = await sshManager.execRemote(hostId, script);
    const out = res.stdout;
    const kv: Record<string, string> = {};
    for (const line of out.split(/\r?\n/)) {
      const eq = line.indexOf('=');
      if (eq > 0) kv[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }

    const loadAvg = kv.LOAD || null;
    const cores = Math.max(1, Number(kv.CORES) || 1);
    let cpuPercent: number | null = null;
    if (loadAvg) {
      const load1 = parseFloat(loadAvg.split(/\s+/)[0]);
      if (isFinite(load1)) {
        cpuPercent = Math.min(100, Math.round((load1 / cores) * 100));
      }
    }

    let memUsedMb: number | null = null;
    let memTotalMb: number | null = null;
    let memPercent: number | null = null;
    if (kv.MEM) {
      const parts = kv.MEM.split(/\s+/);
      const u = Number(parts[0]);
      const t = Number(parts[1]);
      if (isFinite(u) && isFinite(t) && t > 0) {
        memUsedMb = u;
        memTotalMb = t;
        memPercent = Math.round((u / t) * 100);
      }
    }

    let diskUsed: string | null = null;
    let diskTotal: string | null = null;
    let diskPercent: number | null = null;
    let diskMount: string | null = null;
    if (kv.DISK) {
      const parts = kv.DISK.split(/\s+/);
      if (parts.length >= 4) {
        diskUsed = parts[0];
        diskTotal = parts[1];
        const pct = parseInt(parts[2].replace('%', ''), 10);
        diskPercent = isFinite(pct) ? pct : null;
        diskMount = parts[3];
      }
    }

    return {
      hostId,
      timestamp: Date.now(),
      cpuPercent,
      loadAvg,
      memUsedMb,
      memTotalMb,
      memPercent,
      diskUsed,
      diskTotal,
      diskPercent,
      diskMount,
      lowDiskWarning: diskPercent !== null && diskPercent >= 85
    };
  }

  /* ── 6. Folder / Repo Diff & Selective Sync ─────────────────────────────────── */

  private async listTreeEntries(
    endpoint: FolderEndpoint,
    maxFiles = 4000,
    excludes: string[] = DEFAULT_EXCLUDES
  ): Promise<{ map: Map<string, { size: number; mtime: number }>; truncated: boolean }> {
    const map = new Map<string, { size: number; mtime: number }>();
    let truncated = false;
    const exSet = new Set(excludes);

    if (endpoint.kind === 'local') {
      const root = endpoint.path;
      const walk = async (dir: string, prefix: string): Promise<void> => {
        if (truncated) return;
        let entries: fs.Dirent[];
        try {
          entries = await fs.promises.readdir(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const ent of entries) {
          if (truncated) return;
          if (exSet.has(ent.name)) continue;
          const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
          const full = path.join(dir, ent.name);
          if (ent.isDirectory()) {
            await walk(full, rel);
          } else if (ent.isFile()) {
            if (map.size >= maxFiles) {
              truncated = true;
              return;
            }
            try {
              const st = await fs.promises.stat(full);
              map.set(rel, { size: st.size, mtime: Math.floor(st.mtimeMs / 1000) });
            } catch { /* skip unreadable */ }
          }
        }
      };
      await walk(root, '');
      return { map, truncated };
    }

    // Remote SSH tree listing in a single SSH command: GNU find -printf (Linux), BSD/macOS stat -f, or BusyBox/Alpine stat -c
    const qDir = quotePosixArg(endpoint.path);
    const pruneExpr = excludes.map((e) => `-name ${quotePosixArg(e)}`).join(' -o ');
    const findBase = pruneExpr ? `find . \\( ${pruneExpr} \\) -prune -o -type f` : 'find . -type f';
    const cmd = `cd ${qDir} 2>/dev/null && { if find . -maxdepth 0 -printf '' >/dev/null 2>&1; then ${findBase} -printf '%P\\t%s\\t%T@\\n'; ` +
      `elif stat -f '%N%t%z%t%m' . >/dev/null 2>&1; then ${findBase} -exec stat -f '%N%t%z%t%m' {} +; ` +
      `else ${findBase} -exec stat -c '%n\t%s\t%Y' {} +; fi; } 2>/dev/null | head -n ${maxFiles + 1}`;
    const res = await sshManager.execRemote(endpoint.hostId!, cmd);
    const lines = res.stdout.split(/\r?\n/);
    for (const line of lines) {
      if (!line) continue;
      if (map.size >= maxFiles) {
        truncated = true;
        break;
      }
      const [rel, sz, mt] = line.split('\t');
      if (!rel) continue;
      map.set(rel.replace(/^\.\//, ''), {
        size: Number(sz) || 0,
        mtime: Math.floor(Number(mt) || 0)
      });
    }
    return { map, truncated };
  }

  public async compareFolders(
    leftSpec: string | FolderEndpoint,
    rightSpec: string | FolderEndpoint,
    options?: { excludes?: string[]; maxFiles?: number }
  ): Promise<FolderDiffResult> {
    const left = parseEndpointSpec(leftSpec);
    const right = parseEndpointSpec(rightSpec);
    const excludes = options?.excludes && options.excludes.length > 0 ? options.excludes : DEFAULT_EXCLUDES;
    const maxFiles = Math.max(200, Math.min(8000, options?.maxFiles || 4000));

    const [lTree, rTree] = await Promise.all([
      this.listTreeEntries(left, maxFiles, excludes),
      this.listTreeEntries(right, maxFiles, excludes)
    ]);

    const allPaths = new Set<string>([...lTree.map.keys(), ...rTree.map.keys()]);
    const entries: FolderDiffEntry[] = [];
    const summary = { leftOnly: 0, rightOnly: 0, modified: 0, identical: 0, total: 0 };

    for (const relPath of Array.from(allPaths).sort()) {
      const l = lTree.map.get(relPath);
      const r = rTree.map.get(relPath);
      let status: FolderDiffEntry['status'];
      if (l && !r) {
        status = 'left-only';
        summary.leftOnly++;
      } else if (!l && r) {
        status = 'right-only';
        summary.rightOnly++;
      } else if (l && r) {
        // Different size OR mtime diff > 2 seconds => modified
        if (l.size !== r.size || Math.abs(l.mtime - r.mtime) > 2) {
          status = 'modified';
          summary.modified++;
        } else {
          status = 'identical';
          summary.identical++;
        }
      } else {
        continue;
      }
      summary.total++;
      entries.push({
        relPath,
        status,
        leftSize: l ? l.size : null,
        rightSize: r ? r.size : null,
        leftMtime: l ? l.mtime : null,
        rightMtime: r ? r.mtime : null
      });
    }

    // Same size, different time (copied, checked out, touched): compare content before calling it "modified".
    // Filter by HASH_CHECK_MAX_BYTES BEFORE hashing on either side (so remote never hashes multi-GB files),
    // and sort smallest-first so normal source files are prioritized within HASH_CHECK_MAX_FILES.
    const allSameSizeSuspects = entries.filter((e) => e.status === 'modified' && e.leftSize !== null && e.leftSize === e.rightSize);
    const eligibleSuspects = allSameSizeSuspects
      .filter((e) => e.leftSize! <= HASH_CHECK_MAX_BYTES)
      .sort((a, b) => (a.leftSize || 0) - (b.leftSize || 0));
    const suspects = eligibleSuspects.slice(0, HASH_CHECK_MAX_FILES);
    const hashCheckSkipped = allSameSizeSuspects.length - suspects.length;
    if (suspects.length > 0) {
      const paths = suspects.map((e) => e.relPath);
      const [lHash, rHash] = await Promise.all([this.hashFiles(left, paths), this.hashFiles(right, paths)]);
      for (const e of suspects) {
        const a = lHash.get(e.relPath);
        const b = rHash.get(e.relPath);
        if (a && b && a === b) {
          e.status = 'identical';
          summary.modified--;
          summary.identical++;
        }
      }
    }

    return {
      left,
      right,
      summary,
      truncated: lTree.truncated || rTree.truncated,
      ...(hashCheckSkipped > 0 ? { hashCheckSkipped } : {}),
      entries
    };
  }

  private streamSha1File(fullPath: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const hash = crypto.createHash('sha1');
      const stream = fs.createReadStream(fullPath);
      stream.on('error', reject);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }

  /** Content hashes (relPath → hex) of files below an endpoint; a file that can't be hashed is just missing from the map. */
  private async hashFiles(endpoint: FolderEndpoint, relPaths: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (relPaths.length === 0) return out;
    if (endpoint.kind === 'local') {
      let idx = 0;
      const worker = async () => {
        while (idx < relPaths.length) {
          const rel = relPaths[idx++];
          try {
            const full = path.join(endpoint.path, rel);
            if ((await fs.promises.stat(full)).size > HASH_CHECK_MAX_BYTES) continue;
            out.set(rel, await this.streamSha1File(full));
          } catch { /* unreadable: stays "modified" */ }
        }
      };
      const runners = Array.from({ length: Math.min(LOCAL_HASH_CONCURRENCY, relPaths.length) }, () => worker());
      await Promise.all(runners);
      return out;
    }
    // Remote: chunked batches to stay safely under ARG_MAX / SSH channel limits; sha1sum (GNU) or shasum (macOS/BSD)
    const qDir = quotePosixArg(endpoint.path);
    for (let i = 0; i < relPaths.length; i += REMOTE_HASH_BATCH_SIZE) {
      const batch = relPaths.slice(i, i + REMOTE_HASH_BATCH_SIZE);
      const quoted = batch.map((p) => quotePosixArg('./' + p)).join(' ');
      const cmd = `cd ${qDir} 2>/dev/null && { if command -v sha1sum >/dev/null 2>&1; then sha1sum -- ${quoted}; ` +
        `elif command -v shasum >/dev/null 2>&1; then shasum -a 1 -- ${quoted}; fi; } 2>/dev/null`;
      const res = await sshManager.execRemote(endpoint.hostId!, cmd);
      for (const line of res.stdout.split(/\r?\n/)) {
        // GNU sha1sum prefixes '\' when the path contains backslashes or newlines
        const m = /^\\?([0-9a-f]{40})\s+\*?(.+)$/.exec(line);
        if (m) {
          const rawPath = line.startsWith('\\') ? m[2].replace(/\\\\/g, '\\') : m[2];
          out.set(rawPath.replace(/^\.\//, ''), m[1]);
        }
      }
    }
    return out;
  }

  public async syncFolderFile(
    sourceSpec: string | FolderEndpoint,
    targetSpec: string | FolderEndpoint,
    relPath: string
  ): Promise<{ bytes: number }> {
    const safeRel = assertSafeRelSegmentPath(relPath);
    const source = parseEndpointSpec(sourceSpec);
    const target = parseEndpointSpec(targetSpec);
    const MAX_SYNC_BYTES = 20 * 1024 * 1024; // 20MB safety cap for inline sync

    let data: Buffer;
    if (source.kind === 'local') {
      const srcPath = path.join(source.path, safeRel);
      const st = await fs.promises.stat(srcPath);
      if (st.size > MAX_SYNC_BYTES) throw new Error(`File exceeds 20MB inline sync limit (${st.size} bytes).`);
      data = await fs.promises.readFile(srcPath);
    } else {
      const remoteSrc = path.posix.join(source.path, safeRel);
      const buf = await sshManager.readRemoteFile(source.hostId!, remoteSrc, MAX_SYNC_BYTES + 1);
      if (buf.length > MAX_SYNC_BYTES) throw new Error('Remote file exceeds 20MB inline sync limit.');
      data = buf;
    }

    if (target.kind === 'local') {
      const dstPath = path.join(target.path, safeRel);
      await fs.promises.mkdir(path.dirname(dstPath), { recursive: true });
      await fs.promises.writeFile(dstPath, data);
    } else {
      const remoteDst = path.posix.join(target.path, safeRel);
      const remoteParent = path.posix.dirname(remoteDst);
      await sshManager.execRemote(target.hostId!, `mkdir -p ${quotePosixArg(remoteParent)}`);
      await sshManager.writeRemoteFile(target.hostId!, remoteDst, data);
    }

    return { bytes: data.length };
  }

  /* ── 7. Multi-Repo Commit Activity Heatmap (rare-ui GitHub Activity) ───────── */

  public async getActivityHeatmap(repos: string[], weeks = 16): Promise<ActivityHeatmapResult> {
    const safeWeeks = Math.max(4, Math.min(52, Math.floor(weeks || 16)));
    const totalDays = safeWeeks * 7;

    // Build exact local YYYY-MM-DD calendar slots ending today
    const pad2 = (n: number) => (n < 10 ? '0' + n : String(n));
    const toLocalDateStr = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const startDay = new Date(today.getTime() - (totalDays - 1) * 86400 * 1000);
    const sinceIso = `${startDay.getFullYear()}-${pad2(startDay.getMonth() + 1)}-${pad2(startDay.getDate())} 00:00:00`;

    const dayMap = new Map<string, { count: number; repos: { [repo: string]: number } }>();
    const orderedDates: string[] = [];
    for (let i = 0; i < totalDays; i++) {
      const dt = new Date(startDay.getTime() + i * 86400 * 1000);
      const key = toLocalDateStr(dt);
      orderedDates.push(key);
      dayMap.set(key, { count: 0, repos: {} });
    }

    const eligible = repos.slice(0, 40).filter((r) => {
      const rem = parseRemoteRepo(r);
      return !rem || sshManager.isConnected(rem.hostId);
    });

    let scannedRepos = 0;
    const queue = [...eligible];
    const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
      while (queue.length > 0) {
        const repo = queue.shift()!;
        try {
          const res = await this.dataSource.execGitRaw(
            repo,
            ['log', '--all', `--since=${sinceIso}`, '-n2000', '--format=%at']
          );
          scannedRepos++;
          for (const line of res.stdout.toString('utf8').split(/\r?\n/)) {
            const ts = parseInt(line.trim(), 10);
            if (!ts || !Number.isFinite(ts)) continue;
            const dateKey = toLocalDateStr(new Date(ts * 1000));
            const slot = dayMap.get(dateKey);
            if (!slot) continue;
            slot.count++;
            slot.repos[repo] = (slot.repos[repo] || 0) + 1;
          }
        } catch {
          /* skip unreachable repo */
        }
      }
    });
    await Promise.all(workers);

    let totalCommits = 0;
    let activeDays = 0;
    let maxDayCount = 0;
    let busiestDay: { date: string; count: number } | null = null;

    for (const date of orderedDates) {
      const slot = dayMap.get(date)!;
      totalCommits += slot.count;
      if (slot.count > 0) activeDays++;
      if (slot.count > maxDayCount) {
        maxDayCount = slot.count;
        busiestDay = { date, count: slot.count };
      }
    }

    const days: ActivityHeatmapDay[] = orderedDates.map((date) => {
      const slot = dayMap.get(date)!;
      let level: 0 | 1 | 2 | 3 | 4 = 0;
      if (slot.count > 0) {
        if (maxDayCount <= 4) {
          level = Math.min(4, slot.count) as 1 | 2 | 3 | 4;
        } else {
          const ratio = slot.count / maxDayCount;
          level = ratio >= 0.75 ? 4 : ratio >= 0.45 ? 3 : ratio >= 0.2 ? 2 : 1;
        }
      }
      return { date, count: slot.count, level, repos: slot.repos };
    });

    return {
      weeks: safeWeeks,
      days,
      totalCommits,
      activeDays,
      maxDayCount,
      busiestDay,
      scannedRepos
    };
  }

  /* ── 8. Launchpad Cross-Repo Actionable Aggregator ──────────────────────────── */

  public async getLaunchpadSummary(
    repos: string[],
    statuses: { [repo: string]: RepoQuickStatus }
  ): Promise<LaunchpadSummaryResult> {
    const conflicts: RepoQuickStatus[] = [];
    const dirty: RepoQuickStatus[] = [];
    const readyToPush: RepoQuickStatus[] = [];
    const behindRemote: RepoQuickStatus[] = [];
    const clean: RepoQuickStatus[] = [];
    const offline: RepoQuickStatus[] = [];

    for (const repo of repos) {
      const st = statuses[repo] || {
        repo,
        branch: null,
        ahead: 0,
        behind: 0,
        stagedCount: 0,
        unstagedCount: 0,
        conflictCount: 0,
        offline: true
      };
      if (st.offline) {
        offline.push(st);
        continue;
      }
      let flagged = false;
      if (st.conflictCount > 0) {
        conflicts.push(st);
        flagged = true;
      }
      if (st.stagedCount > 0 || st.unstagedCount > 0) {
        dirty.push(st);
        flagged = true;
      }
      if (st.ahead > 0) {
        readyToPush.push(st);
        flagged = true;
      }
      if (st.behind > 0) {
        behindRemote.push(st);
        flagged = true;
      }
      if (!flagged) {
        clean.push(st);
      }
    }

    // Lightweight concurrent worktree count per online repo (bounded to 30 repos)
    const worktreeCounts: { [repo: string]: number } = {};
    let totalWorktrees = 0;
    const onlineRepos = repos.filter((r) => !statuses[r]?.offline).slice(0, 30);
    const queue = [...onlineRepos];
    const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
      while (queue.length > 0) {
        const repo = queue.shift()!;
        try {
          const res = await this.dataSource.execGitRaw(repo, ['worktree', 'list', '--porcelain']);
          const count = res.stdout.toString('utf8').trim().split(/\n\n+/).filter(Boolean).length;
          worktreeCounts[repo] = count;
          totalWorktrees += count;
        } catch { /* ignore */ }
      }
    });
    await Promise.all(workers);

    return {
      totals: {
        repos: repos.length,
        online: repos.length - offline.length,
        offline: offline.length,
        conflicts: conflicts.length,
        dirty: dirty.length,
        readyToPush: readyToPush.length,
        behindRemote: behindRemote.length,
        clean: clean.length,
        worktrees: totalWorktrees
      },
      buckets: { conflicts, dirty, readyToPush, behindRemote, clean, offline },
      worktreeCounts
    };
  }

  /* ── 9. Portable Context Patch Bundles (GitLens Cloud Patches local-first) ─── */

  public async exportPatchBundle(
    repo: string,
    options: { scope?: 'working' | 'staged' | 'range'; fromRef?: string; toRef?: string; note?: string } = {}
  ): Promise<PatchBundle> {
    const scope: 'working' | 'staged' | 'range' =
      options.scope === 'staged' ? 'staged' : options.scope === 'range' ? 'range' : 'working';
    const fromRef = (options.fromRef || '').trim();
    const toRef = (options.toRef || 'HEAD').trim();
    if (fromRef.startsWith('-') || toRef.startsWith('-')) {
      throw new Error('Invalid Git ref for patch export.');
    }

    const MAX_PATCH_BYTES = 2 * 1024 * 1024;
    let diffArgs: string[];
    let numstatArgs: string[];

    if (scope === 'staged') {
      diffArgs = ['-c', 'core.quotepath=false', 'diff', '--cached', '--binary', '--no-color'];
      numstatArgs = ['-c', 'core.quotepath=false', 'diff', '--cached', '--numstat'];
    } else if (scope === 'range') {
      if (!fromRef) throw new Error('A base ref (fromRef) is required for range patch export.');
      const rangeSpec = `${fromRef}..${toRef || 'HEAD'}`;
      diffArgs = ['-c', 'core.quotepath=false', 'diff', '--binary', '--no-color', rangeSpec];
      numstatArgs = ['-c', 'core.quotepath=false', 'diff', '--numstat', rangeSpec];
    } else {
      // working tree: diff against HEAD when HEAD exists, otherwise diff unstaged
      const hasHead = await this.dataSource
        .execGitRaw(repo, ['rev-parse', '--verify', 'HEAD'])
        .then(() => true, () => false);
      diffArgs = hasHead
        ? ['-c', 'core.quotepath=false', 'diff', 'HEAD', '--binary', '--no-color']
        : ['-c', 'core.quotepath=false', 'diff', '--binary', '--no-color'];
      numstatArgs = hasHead
        ? ['-c', 'core.quotepath=false', 'diff', 'HEAD', '--numstat']
        : ['-c', 'core.quotepath=false', 'diff', '--numstat'];
    }

    const [diffRes, statRes, branch, headInfo] = await Promise.all([
      this.dataSource.execGitRaw(repo, diffArgs, { maxBytes: MAX_PATCH_BYTES + 1 }),
      this.dataSource.execGitRaw(repo, numstatArgs, { ignoreExitCode: true }),
      this.dataSource
        .execGitRaw(repo, ['symbolic-ref', '-q', '--short', 'HEAD'], { ignoreExitCode: true })
        .then((r) => r.stdout.toString('utf8').trim() || null, () => null),
      this.dataSource
        .execGitRaw(repo, ['log', '-1', '--format=%H%x1f%s', 'HEAD'], { ignoreExitCode: true })
        .then((r) => r.stdout.toString('utf8').trim(), () => '')
    ]);

    if (diffRes.stdout.length > MAX_PATCH_BYTES) {
      throw new Error('Diff exceeds the 2 MB portable patch bundle limit.');
    }
    const patch = diffRes.stdout.toString('utf8');
    if (!patch.trim()) {
      throw new Error('No diff changes found in the selected scope to export.');
    }

    let insertions = 0;
    let deletions = 0;
    const files: string[] = [];
    for (const line of statRes.stdout.toString('utf8').split(/\r?\n/)) {
      if (!line.trim()) continue;
      const parts = line.split('\t');
      if (parts.length < 3) continue;
      const ins = parseInt(parts[0], 10);
      const del = parseInt(parts[1], 10);
      if (Number.isFinite(ins)) insertions += ins;
      if (Number.isFinite(del)) deletions += del;
      const fp = parts.slice(2).join('\t').trim();
      if (fp) files.push(fp);
    }

    const [baseHash, baseSubject] = headInfo ? headInfo.split('\x1f') : ['', ''];
    return {
      format: 'gitmap-patch-bundle',
      version: 1,
      createdAt: new Date().toISOString(),
      repoName: getRepoName(repo),
      branch,
      baseHash: baseHash || null,
      baseSubject: baseSubject || '',
      scope,
      ...(scope === 'range' ? { fromRef, toRef: toRef || 'HEAD' } : {}),
      note: String(options.note || '').trim(),
      stats: { files: files.length, insertions, deletions },
      files,
      patch
    };
  }

  private parseIncomingPatchInput(rawInput: string): {
    isBundle: boolean;
    bundleMeta: Omit<PatchBundle, 'patch'> | null;
    patch: string;
    files: string[];
    stats: { files: number; insertions: number; deletions: number };
  } {
    const trimmed = String(rawInput || '').trim();
    if (!trimmed) throw new Error('Patch input is empty.');

    let isBundle = false;
    let bundleMeta: Omit<PatchBundle, 'patch'> | null = null;
    let patch = trimmed;

    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && parsed.format === 'gitmap-patch-bundle' && typeof parsed.patch === 'string') {
          isBundle = true;
          patch = parsed.patch;
          const { patch: _ignored, ...rest } = parsed;
          bundleMeta = rest as Omit<PatchBundle, 'patch'>;
        }
      } catch {
        /* treat as raw patch text */
      }
    }

    if (!patch.trim()) throw new Error('Patch payload contains no diff content.');

    // Extract files & +/- counts from unified diff headers if not provided in bundle
    const filesSet = new Set<string>(Array.isArray(bundleMeta?.files) ? bundleMeta!.files : []);
    let insertions = 0;
    let deletions = 0;
    for (const line of patch.split(/\r?\n/)) {
      const m = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
      if (m) {
        filesSet.add(m[2]);
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        insertions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
      }
    }
    const files = Array.from(filesSet);
    const stats = bundleMeta?.stats && typeof bundleMeta.stats.files === 'number'
      ? bundleMeta.stats
      : { files: files.length, insertions, deletions };

    return {
      isBundle,
      bundleMeta,
      patch: patch.endsWith('\n') ? patch : patch + '\n',
      files,
      stats
    };
  }

  public async inspectPatchBundle(repo: string, rawInput: string): Promise<PatchInspectResult> {
    const parsed = this.parseIncomingPatchInput(rawInput);
    let cleanApply = false;
    let checkError: string | null = null;
    try {
      await this.dataSource.execGitRaw(
        repo,
        ['apply', '--check', '--whitespace=nowarn', '-'],
        { input: parsed.patch }
      );
      cleanApply = true;
    } catch (err: any) {
      cleanApply = false;
      checkError = err instanceof Error ? err.message : String(err || 'Patch does not apply cleanly.');
    }
    const threeWayPossible = cleanApply || parsed.files.length > 0;

    return {
      valid: parsed.files.length > 0 || /^@@ /m.test(parsed.patch),
      isBundle: parsed.isBundle,
      bundleMeta: parsed.bundleMeta,
      files: parsed.files,
      stats: parsed.stats,
      cleanApply,
      threeWayPossible,
      checkError,
      patchPreview: parsed.patch.slice(0, 12000),
      patchBytes: Buffer.byteLength(parsed.patch, 'utf8')
    };
  }

  public async applyPatchBundle(
    repo: string,
    rawInput: string,
    options?: { threeWay?: boolean }
  ): Promise<{ ok: true; appliedFiles: string[]; usedThreeWay: boolean }> {
    const parsed = this.parseIncomingPatchInput(rawInput);
    const args = ['apply', '--whitespace=nowarn'];
    const useThreeWay = !!options?.threeWay;
    if (useThreeWay) args.push('--3way');
    args.push('-');
    await this.dataSource.execGitRaw(repo, args, { input: parsed.patch });
    RepoFileWatcher.notifyPossibleRemoteChange(200);
    return {
      ok: true,
      appliedFiles: parsed.files,
      usedThreeWay: useThreeWay
    };
  }
}
