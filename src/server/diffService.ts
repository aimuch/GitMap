import { diffLines, diffWordsWithSpace } from 'diff';
import { decode } from 'iconv-lite';
import { DataSource } from '../dataSource';
import { readRepoFileBuffer } from '../remote/repoTransport';
import { GitFileBlame, GitFileStatus } from '../types';
import { UNCOMMITTED } from '../utils';

export interface WordSegment {
  text: string;
  changed: boolean;
}

export interface DiffRow {
  kind: 'context' | 'change' | 'added' | 'deleted';
  oldLineNumber: number | null;
  newLineNumber: number | null;
  oldText: string | null;
  newText: string | null;
  oldSegments?: WordSegment[];
  newSegments?: WordSegment[];
}

export interface DiffResult {
  repo: string;
  oldFilePath: string;
  newFilePath: string;
  fromHash: string;
  toHash: string;
  type: GitFileStatus;
  isBinary: boolean;
  truncated: boolean;
  additions: number;
  deletions: number;
  rows: DiffRow[];
  error: string | null;
}

const MAX_WORD_DIFF_LINE_LEN = 600;
const MAX_WORD_DIFF_PAIRS = 600;
const MAX_FULL_MYERS_LINES = 15000;
const MAX_DIFF_BYTES = 5 * 1024 * 1024;

function splitContentLines(text: string): string[] {
  if (text === '') return [];
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '' && normalized.endsWith('\n')) {
    lines.pop();
  }
  return lines;
}

function computeWordPair(oldLine: string, newLine: string): { oldSegs: WordSegment[]; newSegs: WordSegment[] } {
  if (oldLine.length > MAX_WORD_DIFF_LINE_LEN || newLine.length > MAX_WORD_DIFF_LINE_LEN) {
    return {
      oldSegs: [{ text: oldLine, changed: true }],
      newSegs: [{ text: newLine, changed: true }]
    };
  }
  const parts = diffWordsWithSpace(oldLine, newLine);
  const oldSegs: WordSegment[] = [];
  const newSegs: WordSegment[] = [];
  for (const part of parts) {
    if (part.added) {
      newSegs.push({ text: part.value, changed: true });
    } else if (part.removed) {
      oldSegs.push({ text: part.value, changed: true });
    } else {
      oldSegs.push({ text: part.value, changed: false });
      newSegs.push({ text: part.value, changed: false });
    }
  }
  return { oldSegs, newSegs };
}

/**
 * Fast O(N) prefix/suffix + linear chunk diff fallback when files exceed MAX_FULL_MYERS_LINES,
 * preventing multi-second event-loop stalls on huge lockfiles or generated bundles.
 */
function fastLargeFileDiff(oldLines: string[], newLines: string[]): { rows: DiffRow[]; additions: number; deletions: number } {
  let prefix = 0;
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) {
    prefix++;
  }
  let oldEnd = oldLines.length - 1;
  let newEnd = newLines.length - 1;
  while (oldEnd >= prefix && newEnd >= prefix && oldLines[oldEnd] === newLines[newEnd]) {
    oldEnd--;
    newEnd--;
  }

  const rows: DiffRow[] = [];
  let oldNo = 1;
  let newNo = 1;
  for (let i = 0; i < prefix; i++) {
    rows.push({ kind: 'context', oldLineNumber: oldNo++, newLineNumber: newNo++, oldText: oldLines[i], newText: newLines[i] });
  }
  const delCount = Math.max(0, oldEnd - prefix + 1);
  const addCount = Math.max(0, newEnd - prefix + 1);
  const pairLen = Math.min(delCount, addCount);
  for (let k = 0; k < pairLen; k++) {
    rows.push({
      kind: 'change',
      oldLineNumber: oldNo++,
      newLineNumber: newNo++,
      oldText: oldLines[prefix + k],
      newText: newLines[prefix + k]
    });
  }
  for (let k = pairLen; k < delCount; k++) {
    rows.push({ kind: 'deleted', oldLineNumber: oldNo++, newLineNumber: null, oldText: oldLines[prefix + k], newText: null });
  }
  for (let k = pairLen; k < addCount; k++) {
    rows.push({ kind: 'added', oldLineNumber: null, newLineNumber: newNo++, oldText: null, newText: newLines[prefix + k] });
  }
  for (let i = oldEnd + 1; i < oldLines.length; i++) {
    rows.push({ kind: 'context', oldLineNumber: oldNo++, newLineNumber: newNo++, oldText: oldLines[i], newText: oldLines[i] });
  }
  return { rows, additions: addCount, deletions: delCount };
}

export class DiffService {
  constructor(private readonly dataSource: DataSource) {}

  public async readRevisionText(
    repo: string,
    commit: string | null,
    filePath: string
  ): Promise<{ content: string; isBinary: boolean; truncated: boolean; error: string | null }> {
    if (!commit || commit === UNCOMMITTED) {
      const buf = await readRepoFileBuffer(repo, filePath, MAX_DIFF_BYTES + 1);
      if (buf === null) {
        return { content: '', isBinary: false, truncated: false, error: null };
      }
      if (buf.subarray(0, 8192).includes(0)) {
        return { content: '', isBinary: true, truncated: false, error: null };
      }
      const truncated = buf.length > MAX_DIFF_BYTES;
      return {
        content: buf.subarray(0, MAX_DIFF_BYTES).toString('utf8'),
        isBinary: false,
        truncated,
        error: null
      };
    }

    try {
      const { buffer, encoding } = await this.dataSource.getCommitFileBuffer(repo, commit, filePath, MAX_DIFF_BYTES + 1);
      if (buffer.subarray(0, 8192).includes(0)) {
        return { content: '', isBinary: true, truncated: false, error: null };
      }
      const truncated = buffer.length > MAX_DIFF_BYTES;
      const sliced = truncated ? buffer.subarray(0, MAX_DIFF_BYTES) : buffer;
      const content = encoding === 'utf8' ? sliced.toString('utf8') : decode(sliced, encoding);
      return {
        content,
        isBinary: false,
        truncated,
        error: null
      };
    } catch (err) {
      const msg = String(err);
      if (/does not exist|invalid object name|unknown revision|bad revision|Path .* does not exist/i.test(msg)) {
        return { content: '', isBinary: false, truncated: false, error: null };
      }
      return { content: '', isBinary: false, truncated: false, error: msg };
    }
  }

  public async computeDiff(params: {
    repo: string;
    fromHash: string;
    toHash: string;
    oldFilePath: string;
    newFilePath: string;
    type: GitFileStatus;
  }): Promise<DiffResult> {
    const { repo, fromHash, toHash, oldFilePath, newFilePath, type } = params;

    const leftExists = type !== GitFileStatus.Added && type !== GitFileStatus.Untracked;
    const rightExists = type !== GitFileStatus.Deleted;

    const [leftRes, rightRes] = await Promise.all([
      leftExists
        ? this.readRevisionText(repo, fromHash, oldFilePath)
        : Promise.resolve({ content: '', isBinary: false, truncated: false, error: null }),
      rightExists
        ? this.readRevisionText(repo, toHash, newFilePath)
        : Promise.resolve({ content: '', isBinary: false, truncated: false, error: null })
    ]);

    const truncated = leftRes.truncated || rightRes.truncated;

    if (leftRes.error || rightRes.error) {
      return {
        repo,
        oldFilePath,
        newFilePath,
        fromHash,
        toHash,
        type,
        isBinary: false,
        truncated,
        additions: 0,
        deletions: 0,
        rows: [],
        error: leftRes.error || rightRes.error
      };
    }

    if (leftRes.isBinary || rightRes.isBinary) {
      return {
        repo,
        oldFilePath,
        newFilePath,
        fromHash,
        toHash,
        type,
        isBinary: true,
        truncated,
        additions: 0,
        deletions: 0,
        rows: [],
        error: null
      };
    }

    const oldNorm = leftRes.content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const newNorm = rightRes.content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    const oldAllLines = splitContentLines(oldNorm);
    const newAllLines = splitContentLines(newNorm);
    if (oldAllLines.length + newAllLines.length > MAX_FULL_MYERS_LINES * 2) {
      const fast = fastLargeFileDiff(oldAllLines, newAllLines);
      return {
        repo,
        oldFilePath,
        newFilePath,
        fromHash,
        toHash,
        type,
        isBinary: false,
        truncated: true,
        additions: fast.additions,
        deletions: fast.deletions,
        rows: fast.rows,
        error: null
      };
    }

    const changes = diffLines(oldNorm, newNorm);

    const rows: DiffRow[] = [];
    let oldLine = 1;
    let newLine = 1;
    let additions = 0;
    let deletions = 0;
    let wordPairsComputed = 0;

    let i = 0;
    while (i < changes.length) {
      const cur = changes[i];
      if (!cur.added && !cur.removed) {
        const lines = splitContentLines(cur.value);
        for (const l of lines) {
          rows.push({
            kind: 'context',
            oldLineNumber: oldLine++,
            newLineNumber: newLine++,
            oldText: l,
            newText: l
          });
        }
        i++;
      } else if (cur.removed && i + 1 < changes.length && changes[i + 1].added) {
        const removedLines = splitContentLines(cur.value);
        const addedLines = splitContentLines(changes[i + 1].value);
        deletions += removedLines.length;
        additions += addedLines.length;
        const maxLen = Math.max(removedLines.length, addedLines.length);
        for (let k = 0; k < maxLen; k++) {
          const hasOld = k < removedLines.length;
          const hasNew = k < addedLines.length;
          if (hasOld && hasNew) {
            let oldSegs: WordSegment[] | undefined;
            let newSegs: WordSegment[] | undefined;
            if (wordPairsComputed < MAX_WORD_DIFF_PAIRS) {
              wordPairsComputed++;
              const pair = computeWordPair(removedLines[k], addedLines[k]);
              oldSegs = pair.oldSegs;
              newSegs = pair.newSegs;
            }
            rows.push({
              kind: 'change',
              oldLineNumber: oldLine++,
              newLineNumber: newLine++,
              oldText: removedLines[k],
              newText: addedLines[k],
              ...(oldSegs ? { oldSegments: oldSegs, newSegments: newSegs } : {})
            });
          } else if (hasOld) {
            rows.push({
              kind: 'deleted',
              oldLineNumber: oldLine++,
              newLineNumber: null,
              oldText: removedLines[k],
              newText: null
            });
          } else if (hasNew) {
            rows.push({
              kind: 'added',
              oldLineNumber: null,
              newLineNumber: newLine++,
              oldText: null,
              newText: addedLines[k]
            });
          }
        }
        i += 2;
      } else if (cur.removed) {
        const removedLines = splitContentLines(cur.value);
        deletions += removedLines.length;
        for (const l of removedLines) {
          rows.push({
            kind: 'deleted',
            oldLineNumber: oldLine++,
            newLineNumber: null,
            oldText: l,
            newText: null
          });
        }
        i++;
      } else {
        const addedLines = splitContentLines(cur.value);
        additions += addedLines.length;
        for (const l of addedLines) {
          rows.push({
            kind: 'added',
            oldLineNumber: null,
            newLineNumber: newLine++,
            oldText: null,
            newText: l
          });
        }
        i++;
      }
    }

    return {
      repo,
      oldFilePath,
      newFilePath,
      fromHash,
      toHash,
      type,
      isBinary: false,
      truncated,
      additions,
      deletions,
      rows,
      error: null
    };
  }

  public async loadFileBlame(repo: string, filePath: string, commit?: string | null): Promise<GitFileBlame | null> {
    if (!repo) return null;
    return this.dataSource.getFileBlame(repo, filePath, null, undefined, commit || null);
  }
}
