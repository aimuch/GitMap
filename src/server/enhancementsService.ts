import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { DataSource } from '../dataSource';
import { parseRemoteRepo } from '../remote/repoTransport';
import { quotePosixArg, sshManager } from '../remote/sshManager';
import { RepoFileWatcher } from '../repoFileWatcher';

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
  entries: FolderDiffEntry[];
}

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
    const code = typeof err?.code === 'number' ? err.code : 1;
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
      // Quick CPU sample from /proc/stat if available (non-blocking instant or 200ms delta)
      `CPU=$(awk '/^cpu /{u=$2+$4; t=$2+$3+$4+$5+$6+$7+$8; print u, t}' /proc/stat 2>/dev/null);`,
      `MEM=$(free -m 2>/dev/null | awk '/^Mem:/{print $3" "$2}');`,
      `DISK=$(df -hP ${target} 2>/dev/null | tail -n 1 | awk '{print $3" "$2" "$5" "$6}');`,
      `printf 'LOAD=%s\\nCORES=%s\\nCPU=%s\\nMEM=%s\\nDISK=%s\\n' "$LOAD" "$CORES" "$CPU" "$MEM" "$DISK"`
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

    // Remote SSH tree listing via find + stat (single SSH command)
    const qDir = quotePosixArg(endpoint.path);
    const pruneExpr = excludes.map((e) => `-name ${quotePosixArg(e)}`).join(' -o ');
    const cmd = `cd ${qDir} 2>/dev/null && find . \\( ${pruneExpr} \\) -prune -o -type f -printf '%P\\t%s\\t%T@\\n' 2>/dev/null | head -n ${maxFiles + 1}`;
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

    return {
      left,
      right,
      summary,
      truncated: lTree.truncated || rTree.truncated,
      entries
    };
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
}
