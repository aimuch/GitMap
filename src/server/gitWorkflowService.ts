import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { completeAiPrompt } from '../aiProviders';
import { DataSource } from '../dataSource';
import { formatRemoteRepoUri, parseRemoteRepo } from '../remote/repoTransport';
import { quotePosixArg, sshManager } from '../remote/sshManager';
import { RepoFileWatcher } from '../repoFileWatcher';
import { getPathFromStr } from '../utils';

export interface ParsedDiffHunkLine {
  index: number;
  sign: ' ' | '+' | '-' | '\\';
  text: string;
  oldLine: number | null;
  newLine: number | null;
}

export interface ParsedDiffHunk {
  index: number;
  header: string;
  section: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: ParsedDiffHunkLine[];
  patch: string;
}

export interface FileDiffHunksResult {
  repo: string;
  filePath: string;
  staged: boolean;
  fileHeader: string[];
  hunks: ParsedDiffHunk[];
  isBinary: boolean;
}

export interface ConflictBlock {
  index: number;
  startLine: number;
  endLine: number;
  oursLabel: string;
  theirsLabel: string;
  oursContent: string;
  baseContent: string | null;
  theirsContent: string;
}

export interface ConflictFileData {
  repo: string;
  filePath: string;
  oursContent: string;
  baseContent: string;
  theirsContent: string;
  workingContent: string;
  blocks: ConflictBlock[];
}

export interface RepoOperationState {
  mergeInProgress: boolean;
  rebaseInProgress: boolean;
  cherryPickInProgress: boolean;
  revertInProgress?: boolean;
  bisectInProgress: boolean;
  bisectBadCommit?: string | null;
  conflictCount: number;
}

export interface InteractiveRebaseCommit {
  hash: string;
  shortHash: string;
  author: string;
  date: number;
  subject: string;
  message: string;
}

export interface InteractiveRebaseStep {
  action: 'pick' | 'reword' | 'squash' | 'fixup' | 'drop';
  hash: string;
  message?: string;
}

export interface WorktreeItem {
  path: string;
  repoUri: string;
  head: string;
  branch: string | null;
  isBare: boolean;
  isDetached: boolean;
  isLocked: boolean;
  isPrunable: boolean;
  isMain: boolean;
}

export interface RepoQuickStatus {
  repo: string;
  branch: string | null;
  ahead: number;
  behind: number;
  stagedCount: number;
  unstagedCount: number;
  conflictCount: number;
  offline?: boolean;
}

export interface AiReviewFinding {
  severity: 'high' | 'medium' | 'low' | 'nit';
  file: string;
  line: number | null;
  title: string;
  detail: string;
  suggestion?: string;
}

export interface ReflogEntry {
  hash: string;
  shortHash: string;
  selector: string;
  action: string;
  subject: string;
  timestamp: number;
  author: string;
}

export function parseUnifiedDiffHunks(rawDiff: string): { fileHeader: string[]; hunks: ParsedDiffHunk[]; isBinary: boolean } {
  const normalized = rawDiff.replace(/\r\n/g, '\n');
  if (/^Binary files .* differ$/m.test(normalized) || /^GIT binary patch$/m.test(normalized)) {
    return { fileHeader: [], hunks: [], isBinary: true };
  }
  const lines = normalized.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

  const fileHeader: string[] = [];
  const hunks: ParsedDiffHunk[] = [];
  let current: {
    header: string;
    section: string;
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    rawLines: string[];
    parsedLines: ParsedDiffHunkLine[];
    oldCursor: number;
    newCursor: number;
  } | null = null;

  const flush = () => {
    if (!current) return;
    const idx = hunks.length;
    const patch = [...fileHeader, current.header, ...current.rawLines].join('\n') + '\n';
    hunks.push({
      index: idx,
      header: current.header,
      section: current.section,
      oldStart: current.oldStart,
      oldLines: current.oldLines,
      newStart: current.newStart,
      newLines: current.newLines,
      lines: current.parsedLines,
      patch
    });
    current = null;
  };

  for (const line of lines) {
    const m = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/);
    if (m) {
      flush();
      const oldStart = parseInt(m[1], 10);
      const oldLines = m[2] !== undefined ? parseInt(m[2], 10) : 1;
      const newStart = parseInt(m[3], 10);
      const newLines = m[4] !== undefined ? parseInt(m[4], 10) : 1;
      current = {
        header: line,
        section: (m[5] || '').trim(),
        oldStart,
        oldLines,
        newStart,
        newLines,
        rawLines: [],
        parsedLines: [],
        oldCursor: oldStart,
        newCursor: newStart
      };
      continue;
    }
    if (!current) {
      fileHeader.push(line);
      continue;
    }
    const prefix = line[0];
    if (prefix === ' ' || prefix === '+' || prefix === '-' || prefix === '\\') {
      current.rawLines.push(line);
      const text = line.slice(1);
      let oldLine: number | null = null;
      let newLine: number | null = null;
      if (prefix === ' ') {
        oldLine = current.oldCursor++;
        newLine = current.newCursor++;
      } else if (prefix === '-') {
        oldLine = current.oldCursor++;
      } else if (prefix === '+') {
        newLine = current.newCursor++;
      }
      current.parsedLines.push({
        index: current.parsedLines.length,
        sign: prefix,
        text,
        oldLine,
        newLine
      });
    }
  }
  flush();
  return { fileHeader, hunks, isBinary: false };
}

/**
 * Build a valid unified diff patch for a subset of changed line indices within a single hunk.
 * - `mode === 'stage'`: forward patch applied to index (`git apply --cached --recount`).
 * - `mode === 'unstage'` or `'discard'`: patch applied with `-R` (`git apply [-cached] -R --recount`).
 */
export function buildPartialHunkPatch(
  fileHeader: string[],
  hunk: ParsedDiffHunk,
  selectedIndices: number[],
  mode: 'stage' | 'unstage' | 'discard'
): string {
  const selected = new Set(selectedIndices);
  const body: string[] = [];
  let oldCount = 0;
  let newCount = 0;
  let lastIncluded = false;

  for (const ln of hunk.lines) {
    if (ln.sign === '\\') {
      if (lastIncluded) body.push('\\' + ln.text);
      continue;
    }
    if (ln.sign === ' ') {
      body.push(' ' + ln.text);
      oldCount++;
      newCount++;
      lastIncluded = true;
    } else if (mode === 'stage') {
      if (ln.sign === '-') {
        if (selected.has(ln.index)) {
          body.push('-' + ln.text);
          oldCount++;
        } else {
          body.push(' ' + ln.text);
          oldCount++;
          newCount++;
        }
        lastIncluded = true;
      } else if (ln.sign === '+') {
        if (selected.has(ln.index)) {
          body.push('+' + ln.text);
          newCount++;
          lastIncluded = true;
        } else {
          lastIncluded = false;
        }
      }
    } else {
      // Reverse mode (unstage / discard): target already has '+' lines and lacks '-' lines
      if (ln.sign === '+') {
        if (selected.has(ln.index)) {
          body.push('+' + ln.text);
          newCount++;
        } else {
          body.push(' ' + ln.text);
          oldCount++;
          newCount++;
        }
        lastIncluded = true;
      } else if (ln.sign === '-') {
        if (selected.has(ln.index)) {
          body.push('-' + ln.text);
          oldCount++;
          lastIncluded = true;
        } else {
          lastIncluded = false;
        }
      }
    }
  }

  const header = `@@ -${hunk.oldStart},${oldCount} +${hunk.newStart},${newCount} @@${hunk.section ? ' ' + hunk.section : ''}`;
  return [...fileHeader, header, ...body].join('\n') + '\n';
}

export function parseConflictMarkers(content: string): ConflictBlock[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: ConflictBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].startsWith('<<<<<<<')) {
      const startLine = i + 1;
      const oursLabel = lines[i].slice(7).trim();
      i++;
      const oursLines: string[] = [];
      const baseLines: string[] = [];
      const theirsLines: string[] = [];
      let section: 'ours' | 'base' | 'theirs' = 'ours';
      let hasBase = false;
      let theirsLabel = '';
      let closed = false;

      while (i < lines.length) {
        if (section === 'ours' && lines[i].startsWith('|||||||')) {
          hasBase = true;
          section = 'base';
          i++;
          continue;
        }
        if ((section === 'ours' || section === 'base') && lines[i].startsWith('=======')) {
          section = 'theirs';
          i++;
          continue;
        }
        if (section === 'theirs' && lines[i].startsWith('>>>>>>>')) {
          theirsLabel = lines[i].slice(7).trim();
          closed = true;
          break;
        }
        if (section === 'ours') oursLines.push(lines[i]);
        else if (section === 'base') baseLines.push(lines[i]);
        else theirsLines.push(lines[i]);
        i++;
      }

      if (closed) {
        blocks.push({
          index: blocks.length,
          startLine,
          endLine: i + 1,
          oursLabel,
          theirsLabel,
          oursContent: oursLines.join('\n'),
          baseContent: hasBase ? baseLines.join('\n') : null,
          theirsContent: theirsLines.join('\n')
        });
      }
    }
    i++;
  }
  return blocks;
}

async function runConcurrent<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const cur = idx++;
      results[cur] = await fn(items[cur]);
    }
  });
  await Promise.all(workers);
  return results;
}

function assertSafeRepoRelPath(relPath: string) {
  if (!relPath || path.posix.isAbsolute(relPath) || /^[a-zA-Z]:/.test(relPath)) {
    throw new Error(`Invalid repository-relative path: "${relPath}"`);
  }
  const normalized = relPath.replace(/\\/g, '/');
  const segments = normalized.split('/');
  if (segments.includes('..') || segments[0] === '.git') {
    throw new Error(`Refusing to modify unsafe path: "${relPath}"`);
  }
}

export class GitWorkflowService {
  constructor(private readonly dataSource: DataSource) {}

  /* 1. Hunk & Line Partial Stage / Unstage / Discard + File Discard */

  public async getFileDiffHunks(repo: string, filePath: string, staged: boolean): Promise<FileDiffHunksResult> {
    assertSafeRepoRelPath(filePath);
    const args = ['-c', 'core.quotepath=false', 'diff', '--no-color', '--no-ext-diff', '-U3'];
    if (staged) args.push('--cached');
    args.push('--', filePath);
    const { stdout } = await this.dataSource.execGitRaw(repo, args);
    const raw = stdout.toString('utf8');
    const parsed = parseUnifiedDiffHunks(raw);
    return {
      repo,
      filePath,
      staged,
      fileHeader: parsed.fileHeader,
      hunks: parsed.hunks,
      isBinary: parsed.isBinary
    };
  }

  public async applyPatch(repo: string, patch: string, mode: 'stage' | 'unstage' | 'discard'): Promise<void> {
    if (!patch.trim()) throw new Error('Patch content is empty.');
    const args = ['apply', '--recount', '--unidiff-zero', '--whitespace=nowarn'];
    if (mode === 'stage') {
      args.push('--cached');
    } else if (mode === 'unstage') {
      args.push('--cached', '-R');
    } else {
      args.push('-R');
    }
    args.push('-');
    await this.dataSource.execGitRaw(repo, args, { input: patch.endsWith('\n') ? patch : patch + '\n' });
    RepoFileWatcher.notifyPossibleRemoteChange(200);
  }

  public async discardFiles(repo: string, files: Array<{ path: string; status?: string }>): Promise<void> {
    const tracked: string[] = [];
    const untracked: string[] = [];
    for (const f of files) {
      assertSafeRepoRelPath(f.path);
      if (f.status === 'U' || f.status === '?') untracked.push(f.path);
      else tracked.push(f.path);
    }

    if (tracked.length > 0) {
      await this.dataSource.execGitRaw(repo, ['checkout', '--', ...tracked]);
    }

    if (untracked.length > 0) {
      const remote = parseRemoteRepo(repo);
      if (remote) {
        const absTargets = untracked.map((rel) => {
          const joined = path.posix.resolve(remote.remotePath, rel);
          if (joined === remote.remotePath || !joined.startsWith(remote.remotePath.replace(/\/+$/, '') + '/')) {
            throw new Error(`Unsafe remote discard target: ${rel}`);
          }
          return quotePosixArg(joined);
        });
        const res = await sshManager.execRemote(remote.hostId, `rm -rf -- ${absTargets.join(' ')}`);
        if (res.code !== 0) throw new Error(res.stderr.trim() || 'Failed to delete untracked remote files.');
      } else {
        const rootResolved = path.resolve(repo);
        for (const rel of untracked) {
          const target = path.resolve(rootResolved, rel);
          if (target === rootResolved || !target.startsWith(rootResolved + path.sep)) {
            throw new Error(`Unsafe discard target: ${rel}`);
          }
          await fs.promises.rm(target, { recursive: true, force: true });
        }
      }
    }
    RepoFileWatcher.notifyPossibleRemoteChange(200);
  }

  /* 2. 3-Way Merge Conflict Resolver + AI Smart Merge + Ongoing Operation State */

  public async getOperationState(repo: string): Promise<RepoOperationState> {
    try {
      const remote = parseRemoteRepo(repo);
      if (remote) {
        const probeScript = [
          `cd ${quotePosixArg(remote.remotePath)}`,
          'gd=$(git rev-parse --git-dir 2>/dev/null || echo .git)',
          'for f in MERGE_HEAD rebase-merge rebase-apply CHERRY_PICK_HEAD BISECT_START REVERT_HEAD; do',
          '  if [ -e "$gd/$f" ]; then printf "1"; else printf "0"; fi',
          'done'
        ].join(' && ');
        const [conflictCount, probeRes] = await Promise.all([
          this.countConflicts(repo),
          sshManager.execRemote(remote.hostId, probeScript)
        ]);
        const bits = String(probeRes.stdout || '').trim();
        return {
          mergeInProgress: bits[0] === '1',
          rebaseInProgress: bits[1] === '1' || bits[2] === '1',
          cherryPickInProgress: bits[3] === '1',
          bisectInProgress: bits[4] === '1',
          revertInProgress: bits[5] === '1',
          conflictCount
        };
      }

      const [conflictCount, gitDirRes] = await Promise.all([
        this.countConflicts(repo),
        this.dataSource.execGitRaw(repo, ['rev-parse', '--git-dir'])
      ]);
      const gitDirOut = gitDirRes.stdout.toString('utf8').trim();
      const base = path.isAbsolute(gitDirOut) ? gitDirOut : path.resolve(repo, gitDirOut);
      const existsLocal = (rel: string) => fs.existsSync(path.join(base, rel));
      return {
        mergeInProgress: existsLocal('MERGE_HEAD'),
        rebaseInProgress: existsLocal('rebase-merge') || existsLocal('rebase-apply'),
        cherryPickInProgress: existsLocal('CHERRY_PICK_HEAD'),
        bisectInProgress: existsLocal('BISECT_START'),
        revertInProgress: existsLocal('REVERT_HEAD'),
        conflictCount
      };
    } catch (_) {
      return {
        mergeInProgress: false,
        rebaseInProgress: false,
        cherryPickInProgress: false,
        revertInProgress: false,
        bisectInProgress: false,
        conflictCount: 0
      };
    }
  }

  /**
   * Number of unmerged (conflicted) paths. The status banner asks for this every 25 s and on every window focus,
   * so it reads the index only (`git diff --diff-filter=U`) instead of running a full `git status -uall` scan.
   */
  private async countConflicts(repo: string): Promise<number> {
    const { stdout } = await this.dataSource.execGitRaw(repo, ['diff', '--name-only', '-z', '--diff-filter=U']);
    return stdout.toString('utf8').split('\0').filter(Boolean).length;
  }

  public async readConflictFile(repo: string, filePath: string): Promise<ConflictFileData> {
    assertSafeRepoRelPath(filePath);
    const readStage = async (stage: 1 | 2 | 3): Promise<string> => {
      try {
        const { stdout } = await this.dataSource.execGitRaw(repo, ['show', `:${stage}:${filePath}`], { maxBytes: 5 * 1024 * 1024 });
        return stdout.toString('utf8');
      } catch (_) {
        return '';
      }
    };
    const readWorktree = async (): Promise<string> => {
      const remote = parseRemoteRepo(repo);
      if (remote) {
        const buf = await sshManager.readRemoteFile(remote.hostId, path.posix.join(remote.remotePath, filePath), 5 * 1024 * 1024);
        return buf.toString('utf8');
      }
      return fs.promises.readFile(path.join(repo, filePath), 'utf8');
    };

    const [baseContent, oursContent, theirsContent, workingContent] = await Promise.all([
      readStage(1),
      readStage(2),
      readStage(3),
      readWorktree()
    ]);

    return {
      repo,
      filePath,
      oursContent,
      baseContent,
      theirsContent,
      workingContent,
      blocks: parseConflictMarkers(workingContent)
    };
  }

  public async resolveConflictFile(repo: string, filePath: string, content: string): Promise<void> {
    assertSafeRepoRelPath(filePath);
    await this.writeRepoWorkingFile(repo, filePath, content);
    await this.dataSource.execGitRaw(repo, ['add', '--', filePath]);
    RepoFileWatcher.notifyPossibleRemoteChange(200);
  }

  public async writeRepoWorkingFile(repo: string, filePath: string, content: string): Promise<void> {
    assertSafeRepoRelPath(filePath);
    const remote = parseRemoteRepo(repo);
    if (remote) {
      const target = path.posix.resolve(remote.remotePath, filePath);
      if (target === remote.remotePath || !target.startsWith(remote.remotePath.replace(/\/+$/, '') + '/')) {
        throw new Error('Invalid remote repository file path.');
      }
      await sshManager.writeRemoteFile(remote.hostId, target, content);
    } else {
      const rootResolved = path.resolve(repo);
      const target = path.resolve(rootResolved, filePath);
      if (target === rootResolved || !target.startsWith(rootResolved + path.sep)) {
        throw new Error('Invalid local repository file path.');
      }
      const realRoot = fs.existsSync(rootResolved) ? fs.realpathSync(rootResolved) : rootResolved;
      await fs.promises.mkdir(path.dirname(target), { recursive: true });
      const realParent = fs.realpathSync(path.dirname(target));
      if (realParent !== realRoot && !realParent.startsWith(realRoot + path.sep)) {
        throw new Error('Invalid local repository file path (symlink escape blocked).');
      }
      if (fs.existsSync(target)) {
        const lstat = await fs.promises.lstat(target);
        if (lstat.isSymbolicLink()) {
          const realExisting = fs.realpathSync(target);
          if (realExisting !== realRoot && !realExisting.startsWith(realRoot + path.sep)) {
            throw new Error('Invalid local repository file path (symlink escape blocked).');
          }
        }
      }
      await fs.promises.writeFile(target, content, 'utf8');
    }
    RepoFileWatcher.notifyPossibleRemoteChange(200);
  }

  public async aiMergeConflictBlock(params: {
    filePath: string;
    ours: string;
    base?: string | null;
    theirs: string;
    contextBefore?: string;
    contextAfter?: string;
  }): Promise<string> {
    const prompt = [
      `You are an expert software engineer resolving a Git merge conflict in file "${params.filePath}".`,
      'Return ONLY the resolved code that should replace the conflict block — do NOT wrap in markdown code fences, do NOT include <<<<<<< / ======= / >>>>>>> markers, and do NOT include explanations.',
      params.contextBefore ? `\n--- Context Before ---\n${params.contextBefore}` : '',
      `\n--- Current / Ours ---\n${params.ours}`,
      params.base ? `\n--- Common Ancestor / Base ---\n${params.base}` : '',
      `\n--- Incoming / Theirs ---\n${params.theirs}`,
      params.contextAfter ? `\n--- Context After ---\n${params.contextAfter}` : ''
    ]
      .filter(Boolean)
      .join('\n');

    const res = await completeAiPrompt(prompt);
    if (res.error) throw new Error(res.error);
    return stripCodeFences(res.text);
  }

  public async continueOrAbortOperation(
    repo: string,
    operation: 'merge' | 'rebase' | 'cherry-pick' | 'revert',
    action: 'continue' | 'abort'
  ): Promise<void> {
    if (action === 'abort') {
      await this.dataSource.execGitRaw(repo, [operation, '--abort']);
    } else if (operation === 'merge') {
      await this.dataSource.execGitRaw(repo, ['-c', 'core.editor=true', 'commit', '--no-edit']);
    } else {
      await this.dataSource.execGitRaw(repo, ['-c', 'core.editor=true', operation, '--continue'], {
        env: { GIT_EDITOR: 'true' }
      });
    }
    RepoFileWatcher.notifyPossibleRemoteChange(200);
  }

  /* 3. Visual Interactive Rebase */

  public async prepareInteractiveRebase(repo: string, baseRefOrCount?: string | number): Promise<{
    baseHash: string;
    branch: string | null;
    commits: InteractiveRebaseCommit[];
  }> {
    const status = await this.dataSource.getWorkingTreeStatus(repo);
    if (status.staged.length > 0 || status.unstaged.length > 0 || status.conflicted.length > 0) {
      throw new Error('Working tree has uncommitted changes. Please commit or stash them before interactive rebase.');
    }

    let baseSpec = 'HEAD~10';
    if (typeof baseRefOrCount === 'number' && baseRefOrCount > 0) {
      baseSpec = `HEAD~${Math.min(50, Math.floor(baseRefOrCount))}`;
    } else if (typeof baseRefOrCount === 'string' && baseRefOrCount.trim() && !baseRefOrCount.trim().startsWith('-')) {
      baseSpec = baseRefOrCount.trim();
    }

    let baseHash: string;
    try {
      baseHash = (await this.dataSource.execGitRaw(repo, ['rev-parse', '--verify', `${baseSpec}^{commit}`])).stdout
        .toString('utf8')
        .trim();
    } catch (_) {
      // Repository may have fewer than 10 commits: fall back to root commit as base if >1 commit exists
      const roots = (await this.dataSource.execGitRaw(repo, ['rev-list', '--max-parents=0', 'HEAD'])).stdout
        .toString('utf8')
        .trim()
        .split(/\r?\n/)
        .filter(Boolean);
      if (roots.length === 0) throw new Error('Repository has no commits to rebase.');
      baseHash = roots[0];
    }

    const mergesOut = (await this.dataSource.execGitRaw(repo, ['rev-list', '--merges', `${baseHash}..HEAD`])).stdout
      .toString('utf8')
      .trim();
    if (mergesOut !== '') {
      throw new Error('Selected commit range contains merge commits. Choose a base commit after the last merge.');
    }

    const SEP = '\x1f';
    const REC = '\x1e';
    const logOut = (
      await this.dataSource.execGitRaw(repo, [
        'log',
        '--reverse',
        `--format=%H${SEP}%h${SEP}%an${SEP}%at${SEP}%s${SEP}%B${REC}`,
        `${baseHash}..HEAD`
      ])
    ).stdout.toString('utf8');

    const commits: InteractiveRebaseCommit[] = logOut
      .split(REC)
      .map((raw) => raw.replace(/^\n+/, ''))
      .filter((raw) => raw.trim() !== '')
      .map((raw) => {
        const [hash, shortHash, author, dateStr, subject, ...bodyParts] = raw.split(SEP);
        return {
          hash: hash.trim(),
          shortHash: shortHash.trim(),
          author: author.trim(),
          date: parseInt(dateStr, 10) || 0,
          subject: subject.trim(),
          message: bodyParts.join(SEP).trim()
        };
      });

    return { baseHash, branch: status.branch, commits };
  }

  public async executeInteractiveRebase(repo: string, baseHash: string, steps: InteractiveRebaseStep[]): Promise<{ backupRef: string }> {
    if (!/^[0-9a-f]{7,64}$/i.test(baseHash)) {
      throw new Error('Invalid base commit hash.');
    }
    if (!Array.isArray(steps) || steps.length === 0) {
      throw new Error('Rebase step list cannot be empty.');
    }
    const validActions = new Set(['pick', 'reword', 'squash', 'fixup', 'drop']);
    for (const s of steps) {
      if (!validActions.has(s.action) || !/^[0-9a-f]{7,64}$/i.test(s.hash)) {
        throw new Error('Invalid rebase step action or commit hash.');
      }
    }
    const firstNonDrop = steps.find((s) => s.action !== 'drop');
    if (firstNonDrop && (firstNonDrop.action === 'squash' || firstNonDrop.action === 'fixup')) {
      throw new Error('The first non-dropped commit cannot be "squash" or "fixup".');
    }

    // Create safety backup ref so Restore History Backup can undo at any time
    const headHash = (await this.dataSource.execGitRaw(repo, ['rev-parse', 'HEAD'])).stdout.toString('utf8').trim();
    const backupRef = `refs/gitmap-backup/rebase-${Date.now()}`;
    await this.dataSource.execGitRaw(repo, ['update-ref', backupRef, headHash]);

    // Build todo list & editor message queue: Git opens GIT_EDITOR once per `reword`, and once at the END of a
    // contiguous squash/fixup chain that contains at least one `squash` (a fixup-only chain opens no editor).
    // The chain may end with a fixup ("squash B, fixup C"): the slot belongs there, otherwise every later message shifts.
    const todoLines: string[] = [];
    const editorMessages: Array<string | null> = [];
    const isChain = (a: string) => a === 'squash' || a === 'fixup';
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      todoLines.push(`${s.action} ${s.hash}`);
      if (s.action === 'reword') {
        editorMessages.push(s.message?.trim() ? s.message.trim() + '\n' : null);
      } else if (isChain(s.action) && !(i + 1 < steps.length && isChain(steps[i + 1].action))) {
        let hasSquash = false;
        let message: string | null = null;
        for (let k = i; k >= 0 && isChain(steps[k].action); k--) {
          if (steps[k].action !== 'squash') continue;
          hasSquash = true;
          if (message === null && steps[k].message?.trim()) message = steps[k].message!.trim() + '\n'; // the last squash's message wins
        }
        if (hasSquash) editorMessages.push(message);
      }
    }
    const todoText = todoLines.join('\n') + '\n';

    const remote = parseRemoteRepo(repo);
    if (remote) {
      const files: { [name: string]: string } = {
        'todo.txt': todoText,
        'idx.txt': '0'
      };
      editorMessages.forEach((m, idx) => {
        if (m !== null) files[`msg-${idx}.txt`] = m;
      });
      let remoteTmp = '';
      try {
        remoteTmp = await sshManager.createRemoteTempDir(remote.hostId, 'git-map-rebase-', files);
        const seqSh = `#!/bin/sh\ncp ${quotePosixArg(remoteTmp + '/todo.txt')} "$1"\n`;
        const editSh = [
          '#!/bin/sh',
          `DIR=${quotePosixArg(remoteTmp)}`,
          'N=$(cat "$DIR/idx.txt" 2>/dev/null || echo 0)',
          'echo $((N + 1)) > "$DIR/idx.txt"',
          'if [ -f "$DIR/msg-$N.txt" ]; then cp "$DIR/msg-$N.txt" "$1"; fi',
          'exit 0'
        ].join('\n') + '\n';
        await sshManager.writeRemoteFile(remote.hostId, `${remoteTmp}/seq.sh`, seqSh);
        await sshManager.writeRemoteFile(remote.hostId, `${remoteTmp}/edit.sh`, editSh);
        await sshManager.execRemote(remote.hostId, `chmod 700 ${quotePosixArg(remoteTmp + '/seq.sh')} ${quotePosixArg(remoteTmp + '/edit.sh')}`);
        await this.dataSource.execGitRaw(repo, ['rebase', '-i', baseHash], {
          env: {
            GIT_SEQUENCE_EDITOR: `${remoteTmp}/seq.sh`,
            GIT_EDITOR: `${remoteTmp}/edit.sh`
          }
        });
      } finally {
        if (remoteTmp) await sshManager.removeRemoteDir(remote.hostId, remoteTmp);
      }
    } else {
      const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'gitmap-rebase-'));
      try {
        await fs.promises.writeFile(path.join(tmpDir, 'todo.txt'), todoText, 'utf8');
        await fs.promises.writeFile(path.join(tmpDir, 'idx.txt'), '0', 'utf8');
        for (let idx = 0; idx < editorMessages.length; idx++) {
          if (editorMessages[idx] !== null) {
            await fs.promises.writeFile(path.join(tmpDir, `msg-${idx}.txt`), editorMessages[idx]!, 'utf8');
          }
        }
        const helperPath = path.join(tmpDir, 'rebase-editor.js');
        const helperCode = [
          'const fs = require("fs");',
          'const path = require("path");',
          'const mode = process.argv[2];',
          'const dir = process.argv[3];',
          'const target = process.argv[4];',
          'if (mode === "seq") {',
          '  fs.copyFileSync(path.join(dir, "todo.txt"), target);',
          '} else {',
          '  const idxFile = path.join(dir, "idx.txt");',
          '  const n = parseInt(fs.readFileSync(idxFile, "utf8").trim() || "0", 10);',
          '  fs.writeFileSync(idxFile, String(n + 1), "utf8");',
          '  const msgFile = path.join(dir, `msg-${n}.txt`);',
          '  if (fs.existsSync(msgFile)) fs.copyFileSync(msgFile, target);',
          '}'
        ].join('\n');
        await fs.promises.writeFile(helperPath, helperCode, 'utf8');
        const nodeBin = process.execPath.replace(/\\/g, '/');
        const scriptPosix = helperPath.replace(/\\/g, '/');
        const dirPosix = tmpDir.replace(/\\/g, '/');
        await this.dataSource.execGitRaw(repo, ['rebase', '-i', baseHash], {
          env: {
            ELECTRON_RUN_AS_NODE: '1',
            GIT_SEQUENCE_EDITOR: `"${nodeBin}" "${scriptPosix}" seq "${dirPosix}"`,
            GIT_EDITOR: `"${nodeBin}" "${scriptPosix}" edit "${dirPosix}"`
          }
        });
      } finally {
        await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    }

    RepoFileWatcher.notifyPossibleRemoteChange(200);
    return { backupRef };
  }

  /* 4. Git Worktree Management */

  public async listWorktrees(repo: string): Promise<WorktreeItem[]> {
    const { stdout } = await this.dataSource.execGitRaw(repo, ['worktree', 'list', '--porcelain']);
    const blocks = stdout.toString('utf8').trim().split(/\n\n+/);
    const remote = parseRemoteRepo(repo);
    const items: WorktreeItem[] = [];

    blocks.forEach((blk, idx) => {
      const lines = blk.split(/\r?\n/);
      let wtPath = '';
      let head = '';
      let branch: string | null = null;
      let isBare = false;
      let isDetached = false;
      let isLocked = false;
      let isPrunable = false;

      for (const line of lines) {
        if (line.startsWith('worktree ')) wtPath = line.slice(9).trim();
        else if (line.startsWith('HEAD ')) head = line.slice(5).trim();
        else if (line.startsWith('branch ')) branch = line.slice(7).trim().replace(/^refs\/heads\//, '');
        else if (line === 'bare') isBare = true;
        else if (line === 'detached') isDetached = true;
        else if (line === 'locked' || line.startsWith('locked ')) isLocked = true;
        else if (line === 'prunable' || line.startsWith('prunable ')) isPrunable = true;
      }

      if (wtPath) {
        const repoUri = remote ? formatRemoteRepoUri(remote.hostId, wtPath) : getPathFromStr(wtPath);
        items.push({
          path: wtPath,
          repoUri,
          head,
          branch,
          isBare,
          isDetached,
          isLocked,
          isPrunable,
          isMain: idx === 0
        });
      }
    });

    return items;
  }

  public async addWorktree(params: {
    repo: string;
    targetPath: string;
    branch: string;
    createBranch?: boolean;
    baseRef?: string;
  }): Promise<string> {
    const targetRaw = params.targetPath.trim();
    const branch = params.branch.trim();
    if (!targetRaw || targetRaw.startsWith('-')) throw new Error('Worktree folder path is required.');
    if (!branch || branch.startsWith('-')) throw new Error('Branch name is required.');

    const remote = parseRemoteRepo(params.repo);
    let resolvedTarget = targetRaw;
    if (remote) {
      resolvedTarget = targetRaw.startsWith('/') || targetRaw.startsWith('~')
        ? await sshManager.resolveRemotePath(remote.hostId, targetRaw)
        : path.posix.resolve(remote.remotePath, targetRaw);
    } else {
      resolvedTarget = targetRaw.startsWith('~/')
        ? path.join(os.homedir(), targetRaw.slice(2))
        : path.isAbsolute(targetRaw)
          ? targetRaw
          : path.resolve(params.repo, targetRaw);
    }

    const args = ['worktree', 'add'];
    if (params.createBranch) {
      args.push('-b', branch, resolvedTarget);
      if (params.baseRef && !params.baseRef.startsWith('-')) args.push(params.baseRef);
    } else {
      args.push(resolvedTarget, branch);
    }
    await this.dataSource.execGitRaw(params.repo, args);
    return remote ? formatRemoteRepoUri(remote.hostId, resolvedTarget) : getPathFromStr(resolvedTarget);
  }

  public async removeWorktree(repo: string, worktreePath: string, force: boolean): Promise<string> {
    if (!worktreePath || worktreePath.startsWith('-')) throw new Error('Invalid worktree path.');
    const args = ['worktree', 'remove'];
    if (force) args.push('--force');
    args.push(worktreePath);
    await this.dataSource.execGitRaw(repo, args);
    await this.dataSource.execGitRaw(repo, ['worktree', 'prune']).catch(() => {});
    const remote = parseRemoteRepo(repo);
    return remote ? formatRemoteRepoUri(remote.hostId, worktreePath) : getPathFromStr(worktreePath);
  }

  /* 5. Multi-Repo Quick Status Badges & Batch Fetch */

  public async getRepoQuickStatus(repo: string): Promise<RepoQuickStatus> {
    const remote = parseRemoteRepo(repo);
    if (remote && !sshManager.isConnected(remote.hostId)) {
      return { repo, branch: null, ahead: 0, behind: 0, stagedCount: 0, unstagedCount: 0, conflictCount: 0, offline: true };
    }
    try {
      const { stdout } = await this.dataSource.execGitRaw(repo, ['status', '--porcelain=v1', '-b', '-uall']);
      const lines = stdout.toString('utf8').split(/\r?\n/).filter(Boolean);
      let branch: string | null = null;
      let ahead = 0;
      let behind = 0;
      let stagedCount = 0;
      let unstagedCount = 0;
      let conflictCount = 0;

      for (const line of lines) {
        if (line.startsWith('## ')) {
          const headPart = line.slice(3);
          const bracketMatch = headPart.match(/\[(.*)\]$/);
          if (bracketMatch) {
            const meta = bracketMatch[1];
            const am = meta.match(/ahead (\d+)/);
            const bm = meta.match(/behind (\d+)/);
            if (am) ahead = parseInt(am[1], 10);
            if (bm) behind = parseInt(bm[1], 10);
          }
          const branchPart = headPart.replace(/\s*\[.*\]$/, '').split('...')[0].trim();
          branch = branchPart.startsWith('No commits yet on ')
            ? branchPart.slice('No commits yet on '.length)
            : branchPart === 'HEAD (no branch)'
              ? 'HEAD'
              : branchPart;
          continue;
        }
        if (line.length < 3) continue;
        const x = line[0];
        const y = line[1];
        if (x === 'U' || y === 'U' || (x === 'A' && y === 'A') || (x === 'D' && y === 'D')) {
          conflictCount++;
        } else {
          if (x !== ' ' && x !== '?') stagedCount++;
          if (y !== ' ') unstagedCount++;
        }
      }
      return { repo, branch, ahead, behind, stagedCount, unstagedCount, conflictCount };
    } catch (_) {
      return { repo, branch: null, ahead: 0, behind: 0, stagedCount: 0, unstagedCount: 0, conflictCount: 0, offline: true };
    }
  }

  public async getQuickStatuses(repos: string[]): Promise<{ [repo: string]: RepoQuickStatus }> {
    const list = await runConcurrent(repos, 4, (r) => this.getRepoQuickStatus(r));
    const map: { [repo: string]: RepoQuickStatus } = {};
    for (const st of list) map[st.repo] = st;
    return map;
  }

  public async fetchAllRepos(repos: string[]): Promise<{ fetched: number; failed: Array<{ repo: string; error: string }>; statuses: { [repo: string]: RepoQuickStatus } }> {
    const eligible = repos.filter((r) => {
      const rem = parseRemoteRepo(r);
      return !rem || sshManager.isConnected(rem.hostId);
    });
    let fetched = 0;
    const failed: Array<{ repo: string; error: string }> = [];
    await runConcurrent(eligible, 4, async (r) => {
      try {
        await this.dataSource.execGitRaw(r, ['fetch', '--all', '--prune']);
        fetched++;
      } catch (err) {
        failed.push({ repo: r, error: err instanceof Error ? err.message : String(err) });
      }
    });
    RepoFileWatcher.notifyPossibleRemoteChange(200);
    return { fetched, failed, statuses: await this.getQuickStatuses(repos) };
  }

  /* 8. AI Pre-Commit / Commit Code Review */

  public async reviewChangesWithAi(params: {
    repo: string;
    scope: 'staged' | 'unstaged' | 'all' | 'commit';
    commitHash?: string;
    lang?: string;
  }): Promise<{ summary: string; findings: AiReviewFinding[] }> {
    let diffText = '';
    if (params.scope === 'commit' && params.commitHash && !params.commitHash.startsWith('-')) {
      diffText = (
        await this.dataSource.execGitRaw(params.repo, ['-c', 'core.quotepath=false', 'show', '--format=medium', '-U3', params.commitHash], {
          maxBytes: 64 * 1024
        })
      ).stdout.toString('utf8');
    } else if (params.scope === 'staged') {
      diffText = (
        await this.dataSource.execGitRaw(params.repo, ['-c', 'core.quotepath=false', 'diff', '--cached', '-U3'], { maxBytes: 64 * 1024 })
      ).stdout.toString('utf8');
    } else if (params.scope === 'unstaged') {
      diffText = (
        await this.dataSource.execGitRaw(params.repo, ['-c', 'core.quotepath=false', 'diff', '-U3'], { maxBytes: 64 * 1024 })
      ).stdout.toString('utf8');
    } else {
      diffText = (
        await this.dataSource.execGitRaw(params.repo, ['-c', 'core.quotepath=false', 'diff', 'HEAD', '-U3'], { maxBytes: 64 * 1024 })
      ).stdout.toString('utf8');
    }

    if (!diffText.trim()) {
      throw new Error('No code changes found in the selected scope to review.');
    }

    const langNote = params.lang === 'zh' ? 'Write `summary`, `title`, `detail`, and `suggestion` in Simplified Chinese.' : 'Write in concise English.';
    const prompt = [
      'You are a Principal Engineer conducting a rigorous pre-commit code review.',
      'Focus on real bugs, security vulnerabilities (injection, secrets, auth), concurrency races, edge-case crashes, and performance regressions.',
      langNote,
      'Return STRICT JSON ONLY (no markdown fences) matching this exact schema:',
      '{"summary":"string","findings":[{"severity":"high|medium|low|nit","file":"path/to/file","line":123,"title":"short title","detail":"why this matters","suggestion":"concrete fix"}]}',
      '\n--- Unified Diff ---\n' + diffText.slice(0, 48000)
    ].join('\n');

    const res = await completeAiPrompt(prompt);
    if (res.error) throw new Error(res.error);
    const parsed = extractJsonObject(res.text);
    if (!parsed || typeof parsed !== 'object') {
      return { summary: res.text, findings: [] };
    }
    const findings: AiReviewFinding[] = Array.isArray(parsed.findings)
      ? parsed.findings.map((f: any) => ({
          severity: ['high', 'medium', 'low', 'nit'].includes(f.severity) ? f.severity : 'medium',
          file: String(f.file || ''),
          line: typeof f.line === 'number' && Number.isFinite(f.line) ? f.line : null,
          title: String(f.title || ''),
          detail: String(f.detail || ''),
          suggestion: f.suggestion ? String(f.suggestion) : undefined
        }))
      : [];
    return { summary: String(parsed.summary || ''), findings };
  }

  /* 9. AI Release Notes & Natural-Language Commit Search */

  public async generateReleaseNotes(params: {
    repo: string;
    fromRef?: string;
    toRef?: string;
    lang?: string;
  }): Promise<{ markdown: string; usedAi: boolean; commitCount: number }> {
    const toRef = (params.toRef || 'HEAD').trim();
    const fromRef = (params.fromRef || '').trim();
    if (toRef.startsWith('-') || fromRef.startsWith('-')) throw new Error('Invalid Git ref.');

    const rangeSpec = fromRef ? `${fromRef}..${toRef}` : toRef;
    const args = ['log', '--no-merges', '--max-count=200', '--format=%h\t%s\t%an', rangeSpec];
    const logOut = (await this.dataSource.execGitRaw(params.repo, args)).stdout.toString('utf8').trim();
    const rows = logOut
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => {
        const [hash, subject, author] = l.split('\t');
        return { hash, subject: subject || '', author: author || '' };
      });
    if (rows.length === 0) {
      throw new Error('No commits found in the selected range.');
    }

    const langNote = params.lang === 'zh' ? '请使用简体中文撰写结构清晰的 Markdown 版本发布说明。' : 'Write well-structured Markdown Release Notes in English.';
    const prompt = [
      'Generate polished Release Notes / Changelog grouped into sections (e.g. ✨ Features, 🐛 Bug Fixes, ⚡ Performance & Refactoring, 💥 Breaking Changes — omit empty sections).',
      'Cite short commit hashes in parentheses where helpful.',
      langNote,
      `Range: ${rangeSpec}`,
      '\nCommits:\n' + rows.map((r) => `- ${r.hash} ${r.subject} (${r.author})`).join('\n')
    ].join('\n');

    const aiRes = await completeAiPrompt(prompt);
    if (!aiRes.error && aiRes.text) {
      return { markdown: stripOuterMarkdownFence(aiRes.text), usedAi: true, commitCount: rows.length };
    }

    // Deterministic Conventional-Commits fallback when no AI provider is configured
    const feats = rows.filter((r) => /^feat(\(|:)/i.test(r.subject));
    const fixes = rows.filter((r) => /^fix(\(|:)/i.test(r.subject));
    const others = rows.filter((r) => !/^feat(\(|:)/i.test(r.subject) && !/^fix(\(|:)/i.test(r.subject));
    const zh = params.lang === 'zh';
    const md: string[] = [`## Release Notes (${rangeSpec})`, ''];
    if (feats.length) {
      md.push(`### ${zh ? '新特性 (Features)' : 'Features'}`);
      feats.forEach((r) => md.push(`- ${r.subject} (\`${r.hash}\`)`));
      md.push('');
    }
    if (fixes.length) {
      md.push(`### ${zh ? '问题修复 (Bug Fixes)' : 'Bug Fixes'}`);
      fixes.forEach((r) => md.push(`- ${r.subject} (\`${r.hash}\`)`));
      md.push('');
    }
    if (others.length) {
      md.push(`### ${zh ? '其他变更 (Other Changes)' : 'Other Changes'}`);
      others.forEach((r) => md.push(`- ${r.subject} (\`${r.hash}\`)`));
      md.push('');
    }
    return { markdown: md.join('\n').trim(), usedAi: false, commitCount: rows.length };
  }

  public async naturalLanguageCommitSearch(repo: string, query: string): Promise<{
    filterSummary: string;
    usedAi: boolean;
    commits: Array<{ hash: string; shortHash: string; subject: string; author: string; date: number }>;
  }> {
    const q = query.trim();
    if (!q) throw new Error('Search query is required.');

    let spec: {
      grep?: string;
      pickaxe?: string;
      author?: string;
      since?: string;
      until?: string;
      path?: string;
    } = {};
    let usedAi = false;

    const aiPrompt = [
      'Translate the user\'s natural-language Git history question into JSON search filters for `git log`.',
      'Return STRICT JSON ONLY (no markdown): {"grep":"optional commit message keyword","pickaxe":"optional code identifier/string for git log -S","author":"optional author","since":"optional git --since string e.g. 2 weeks ago","until":"optional","path":"optional file/dir path"}',
      `User query: ${JSON.stringify(q)}`
    ].join('\n');

    const aiRes = await completeAiPrompt(aiPrompt);
    if (!aiRes.error && aiRes.text) {
      const parsed = extractJsonObject(aiRes.text);
      if (parsed && typeof parsed === 'object') {
        spec = parsed;
        usedAi = true;
      }
    }

    if (!usedAi) {
      // Heuristic parser when AI is not configured
      const authorMatch = q.match(/(?:by|author[:\s]+|作者[:\s]*)([^\s,，]+)/i);
      const pathMatch = q.match(/([a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+)/);
      if (authorMatch) spec.author = authorMatch[1];
      if (pathMatch) spec.path = pathMatch[1];
      const cleaned = q
        .replace(/(?:by|author[:\s]+|作者[:\s]*)[^\s,，]+/gi, '')
        .replace(/^(?:who|when|find|commits?|search|查找|搜索|谁改了|谁修改了)\s*/i, '')
        .trim();
      if (cleaned) spec.grep = cleaned;
    }

    const runLog = async (s: typeof spec) => {
      const args = ['log', '--all', '-i', '--max-count=60', '--format=%H\t%h\t%s\t%an\t%ct'];
      const cleanOpt = (v?: string) => (v && typeof v === 'string' && !v.trim().startsWith('-') ? v.trim() : '');
      if (cleanOpt(s.author)) args.push(`--author=${cleanOpt(s.author)}`);
      if (cleanOpt(s.since)) args.push(`--since=${cleanOpt(s.since)}`);
      if (cleanOpt(s.until)) args.push(`--until=${cleanOpt(s.until)}`);
      if (cleanOpt(s.grep)) args.push(`--grep=${cleanOpt(s.grep)}`);
      if (cleanOpt(s.pickaxe)) args.push('-S', cleanOpt(s.pickaxe));
      if (cleanOpt(s.path)) args.push('--', cleanOpt(s.path));

      const out = (await this.dataSource.execGitRaw(repo, args)).stdout.toString('utf8').trim();
      if (!out) return [];
      return out.split(/\r?\n/).map((line) => {
        const [hash, shortHash, subject, author, ts] = line.split('\t');
        return { hash, shortHash, subject, author, date: parseInt(ts, 10) || 0 };
      });
    };

    let commits = await runLog(spec);
    // If `--grep` + `-S` together yielded 0 results, fall back to code pickaxe `-S` alone
    if (commits.length === 0 && spec.grep && !spec.pickaxe) {
      spec = { ...spec, pickaxe: spec.grep, grep: undefined };
      commits = await runLog(spec);
    }

    const summaryParts = Object.entries(spec)
      .filter(([, v]) => typeof v === 'string' && v.trim() !== '')
      .map(([k, v]) => `${k}="${v}"`);
    return {
      filterSummary: summaryParts.join(' · ') || `query="${q}"`,
      usedAi,
      commits
    };
  }

  /* 11. Git Reflog Timeline & Visual Git Bisect */

  public async listReflog(repo: string, limit: number = 120): Promise<ReflogEntry[]> {
    const n = Math.max(10, Math.min(500, Math.floor(limit)));
    const SEP = '\x1f';
    const { stdout } = await this.dataSource.execGitRaw(repo, [
      'reflog',
      'show',
      `-n`,
      String(n),
      `--format=%H${SEP}%h${SEP}%gd${SEP}%gs${SEP}%ct${SEP}%an`
    ]);
    const lines = stdout.toString('utf8').trim().split(/\r?\n/).filter(Boolean);
    return lines.map((line) => {
      const [hash, shortHash, selector, gs, ct, author] = line.split(SEP);
      const colon = (gs || '').indexOf(':');
      const action = colon > 0 ? gs.slice(0, colon).trim() : 'commit';
      const subject = colon > 0 ? gs.slice(colon + 1).trim() : gs || '';
      return {
        hash: hash || '',
        shortHash: shortHash || '',
        selector: selector || '',
        action,
        subject,
        timestamp: parseInt(ct, 10) || 0,
        author: author || ''
      };
    });
  }

  public async getBisectStatus(repo: string): Promise<{
    active: boolean;
    currentHash: string | null;
    currentSubject: string | null;
    logLines: string[];
    culpritHash: string | null;
  }> {
    const op = await this.getOperationState(repo);
    if (!op.bisectInProgress) {
      return { active: false, currentHash: null, currentSubject: null, logLines: [], culpritHash: null };
    }
    const [headOut, subjOut, logRes] = await Promise.all([
      this.dataSource.execGitRaw(repo, ['rev-parse', '--short', 'HEAD']).then((r) => r.stdout.toString('utf8').trim(), () => null),
      this.dataSource.execGitRaw(repo, ['log', '-1', '--format=%s', 'HEAD']).then((r) => r.stdout.toString('utf8').trim(), () => null),
      this.dataSource.execGitRaw(repo, ['bisect', 'log'], { ignoreExitCode: true, env: { LC_ALL: 'C', LANG: 'C' } }).then((r) => r.stdout.toString('utf8'), () => '')
    ]);
    const logLines = logRes
      .split(/\r?\n/)
      .filter((l) => l.trim() !== '' && (!l.startsWith('#') || /first '?bad'? commit/.test(l)));
    const culpritMatch = logRes.match(/^#\s*first '?bad'? commit:\s*\[([0-9a-f]{7,40})\]/m);
    return {
      active: true,
      currentHash: headOut,
      currentSubject: subjOut,
      logLines: logLines.slice(-15),
      culpritHash: culpritMatch ? culpritMatch[1] : null
    };
  }

  public async startBisect(repo: string, badRef: string, goodRef: string): Promise<{ message: string; culpritHash: string | null; status: any }> {
    const bad = (badRef || 'HEAD').trim();
    const good = (goodRef || '').trim();
    if (!good || bad.startsWith('-') || good.startsWith('-')) {
      throw new Error('Both a known "bad" commit/ref and a known "good" commit/ref are required.');
    }
    const cEnv = { LC_ALL: 'C', LANG: 'C' };
    await this.dataSource.execGitRaw(repo, ['bisect', 'start'], { env: cEnv });
    await this.dataSource.execGitRaw(repo, ['bisect', 'bad', bad], { env: cEnv });
    const stepRes = await this.dataSource.execGitRaw(repo, ['bisect', 'good', good], { env: cEnv });
    const msg = (stepRes.stdout.toString('utf8') + '\n' + stepRes.stderr).trim();
    const culprit = msg.match(/^([0-9a-f]{7,40}) is the first '?bad'? commit/m);
    const status = await this.getBisectStatus(repo);
    RepoFileWatcher.notifyPossibleRemoteChange(200);
    return {
      message: msg,
      culpritHash: (culprit ? culprit[1] : null) || status.culpritHash,
      status
    };
  }

  public async stepBisect(repo: string, verdict: 'good' | 'bad' | 'skip'): Promise<{ message: string; culpritHash: string | null; status: any }> {
    if (!['good', 'bad', 'skip'].includes(verdict)) throw new Error('Invalid bisect verdict.');
    const res = await this.dataSource.execGitRaw(repo, ['bisect', verdict], { env: { LC_ALL: 'C', LANG: 'C' } });
    const msg = (res.stdout.toString('utf8') + '\n' + res.stderr).trim();
    const culprit = msg.match(/^([0-9a-f]{7,40}) is the first '?bad'? commit/m);
    const status = await this.getBisectStatus(repo);
    RepoFileWatcher.notifyPossibleRemoteChange(200);
    return {
      message: msg,
      culpritHash: (culprit ? culprit[1] : null) || status.culpritHash,
      status
    };
  }

  public async resetBisect(repo: string): Promise<void> {
    await this.dataSource.execGitRaw(repo, ['bisect', 'reset']);
    RepoFileWatcher.notifyPossibleRemoteChange(200);
  }
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```[^\n]*\n([\s\S]*?)\n```$/);
  return match ? match[1] : trimmed;
}

function stripOuterMarkdownFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:markdown|md)?\n([\s\S]*?)\n```$/i);
  return match ? match[1].trim() : trimmed;
}

function extractJsonObject(raw: string): any {
  const cleaned = stripCodeFences(raw);
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch (_) {}
    }
    return null;
  }
}
