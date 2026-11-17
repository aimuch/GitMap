import { diffLines, diffWordsWithSpace } from 'diff';
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
  oldContent: string;
  newContent: string;
  additions: number;
  deletions: number;
  rows: DiffRow[];
  error: string | null;
}

const MAX_WORD_DIFF_LINE_LEN = 600;
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

export class DiffService {
  constructor(private readonly dataSource: DataSource) {}

  public async readRevisionText(
    repo: string,
    commit: string | null,
    filePath: string
  ): Promise<{ content: string; isBinary: boolean; error: string | null }> {
    if (!commit || commit === UNCOMMITTED) {
      const buf = await readRepoFileBuffer(repo, filePath, MAX_DIFF_BYTES + 1);
      if (buf === null) {
        return { content: '', isBinary: false, error: null };
      }
      if (buf.subarray(0, 8192).includes(0)) {
        return { content: '', isBinary: true, error: null };
      }
      return { content: buf.subarray(0, MAX_DIFF_BYTES).toString('utf8'), isBinary: false, error: null };
    }

    try {
      const content = await this.dataSource.getCommitFile(repo, commit, filePath);
      if (content.slice(0, 4096).includes('\0')) {
        return { content: '', isBinary: true, error: null };
      }
      return {
        content: content.length > MAX_DIFF_BYTES ? content.slice(0, MAX_DIFF_BYTES) : content,
        isBinary: false,
        error: null
      };
    } catch (err) {
      // Empty tree or parent before initial commit => empty content
      const msg = String(err);
      if (/does not exist|invalid object name|unknown revision|bad revision|Path .* does not exist/i.test(msg)) {
        return { content: '', isBinary: false, error: null };
      }
      return { content: '', isBinary: false, error: msg };
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
      leftExists ? this.readRevisionText(repo, fromHash, oldFilePath) : Promise.resolve({ content: '', isBinary: false, error: null }),
      rightExists ? this.readRevisionText(repo, toHash, newFilePath) : Promise.resolve({ content: '', isBinary: false, error: null })
    ]);

    if (leftRes.error || rightRes.error) {
      return {
        repo,
        oldFilePath,
        newFilePath,
        fromHash,
        toHash,
        type,
        isBinary: false,
        oldContent: '',
        newContent: '',
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
        oldContent: '',
        newContent: '',
        additions: 0,
        deletions: 0,
        rows: [],
        error: null
      };
    }

    const oldNorm = leftRes.content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const newNorm = rightRes.content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const changes = diffLines(oldNorm, newNorm);

    const rows: DiffRow[] = [];
    let oldLine = 1;
    let newLine = 1;
    let additions = 0;
    let deletions = 0;

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
            const { oldSegs, newSegs } = computeWordPair(removedLines[k], addedLines[k]);
            rows.push({
              kind: 'change',
              oldLineNumber: oldLine++,
              newLineNumber: newLine++,
              oldText: removedLines[k],
              newText: addedLines[k],
              oldSegments: oldSegs,
              newSegments: newSegs
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
      oldContent: oldNorm,
      newContent: newNorm,
      additions,
      deletions,
      rows,
      error: null
    };
  }

  public async loadFileBlame(repo: string, filePath: string): Promise<GitFileBlame | null> {
    if (!repo) return null;
    return this.dataSource.getFileBlame(repo, filePath);
  }
}
