import { completeAiPrompt } from '../aiProviders';
import { DataSource } from '../dataSource';

export interface CommitMessageOptions {
  language?: 'zh' | 'en';
  style?: 'conventional' | 'concise' | 'detailed';
  includeUnstagedFallback?: boolean;
}

export interface CommitMessageResult {
  message: string;
  usedAi: boolean;
  source: 'staged' | 'unstaged' | 'summary';
  recentCommitsCount?: number;
  error?: string | null;
}

export interface ComposedCommitDraft {
  id: string;
  title: string;
  message: string;
  files: string[];
  rationale?: string;
}

export interface ComposeCommitsResult {
  drafts: ComposedCommitDraft[];
  usedAi: boolean;
  branchContext: string[];
  totalFiles: number;
  error?: string | null;
}

const MAX_DIFF_CHARS = 18000;
/** Never read more than this from `git diff` (a huge staged file would otherwise be read whole, then cut to MAX_DIFF_CHARS). */
const MAX_DIFF_BYTES = 200 * 1024;

function decodeCappedDiff(buf: Buffer, capBytes: number): string {
  const text = buf.toString('utf8');
  if (buf.length < capBytes) return text;
  // Drop any partial trailing line / split multi-byte UTF-8 sequence created by the byte cap
  const lastNl = text.lastIndexOf('\n');
  return lastNl > 0 ? text.slice(0, lastNl) : text;
}

export function buildHeuristicCommitMessage(statText: string, language: 'zh' | 'en', style: 'conventional' | 'concise' | 'detailed'): string {
  const files: string[] = [];
  for (const line of statText.split(/\r?\n/)) {
    const m = /^\s*(.+?)\s+\|\s+\d+/.exec(line);
    if (m) files.push(m[1].trim());
  }
  const hasTest = files.some((f) => /test|spec/i.test(f));
  const hasDocs = files.every((f) => /\.(md|txt|rst)$/i.test(f)) && files.length > 0;
  const hasStyle = files.every((f) => /\.(css|scss|less|svg|png)$/i.test(f)) && files.length > 0;
  const type = hasDocs ? 'docs' : hasStyle ? 'style' : hasTest && files.length === 1 ? 'test' : 'chore';
  const topNames = files.slice(0, 3).map((f) => f.split('/').pop()).filter(Boolean).join(', ');
  const suffix = files.length > 3 ? (language === 'zh' ? ` 等 ${files.length} 个文件` : ` and ${files.length - 3} more`) : '';
  const desc = language === 'zh'
    ? `更新 ${topNames || '工作区改动'}${suffix}`
    : `update ${topNames || 'working tree changes'}${suffix}`;
  return style === 'conventional' ? `${type}: ${desc}` : desc;
}

export function buildHeuristicCommitPlan(
  files: Array<{ path: string; status?: string }>,
  language: 'zh' | 'en',
  style: 'conventional' | 'concise' | 'detailed' = 'conventional'
): ComposedCommitDraft[] {
  const uniquePaths: string[] = [];
  const seen = new Set<string>();
  for (const f of files) {
    const p = String(f.path || '').trim();
    if (!p || seen.has(p)) continue;
    seen.add(p);
    uniquePaths.push(p);
  }
  if (uniquePaths.length === 0) return [];

  const buckets = new Map<string, { type: string; scope: string; labelZh: string; labelEn: string; files: string[] }>();
  const addToBucket = (key: string, meta: { type: string; scope: string; labelZh: string; labelEn: string }, filePath: string) => {
    let b = buckets.get(key);
    if (!b) {
      b = { ...meta, files: [] };
      buckets.set(key, b);
    }
    b.files.push(filePath);
  };

  for (const fp of uniquePaths) {
    const lower = fp.toLowerCase();
    const parts = fp.split('/').filter(Boolean);
    if (/(^|\/)(readme|changelog|license|docs\/)|\.(md|mdx|txt|rst)$/i.test(lower)) {
      addToBucket('docs', { type: 'docs', scope: 'docs', labelZh: '更新文档说明', labelEn: 'update documentation' }, fp);
    } else if (/(^|\/)(__tests__|tests?|spec)\/|\.(test|spec)\.[a-z0-9]+$/i.test(lower)) {
      addToBucket('test', { type: 'test', scope: 'tests', labelZh: '补充与更新测试用例', labelEn: 'add and update tests' }, fp);
    } else if (/\.(css|scss|sass|less|styl)$/i.test(lower)) {
      addToBucket('style', { type: 'style', scope: 'ui', labelZh: '调整界面样式与视觉令牌', labelEn: 'update UI styles and design tokens' }, fp);
    } else if (
      /(^|\/)(package(-lock)?\.json|tsconfig.*\.json|\.eslintrc.*|\.prettierrc.*|dockerfile|makefile|scripts\/)|\.(ya?ml|toml|ini)$/i.test(lower)
    ) {
      addToBucket('chore', { type: 'chore', scope: 'config', labelZh: '更新构建与项目配置', labelEn: 'update build and project configuration' }, fp);
    } else {
      const topDir = parts.length >= 3 ? `${parts[0]}/${parts[1]}` : parts.length === 2 ? parts[0] : 'root';
      const scope = parts.length >= 2 ? parts[0].replace(/[^a-z0-9_-]/gi, '') : 'core';
      addToBucket(`src:${topDir}`, {
        type: 'feat',
        scope,
        labelZh: topDir === 'root' ? '更新核心文件改动' : `更新 ${topDir} 模块实现`,
        labelEn: topDir === 'root' ? 'update core files' : `update ${topDir} module`
      }, fp);
    }
  }

  // Keep plan focused: merge smallest source buckets if more than 6 groups
  const entries = Array.from(buckets.entries());
  if (entries.length > 6) {
    const kept = entries.slice(0, 5);
    const overflow = entries.slice(5);
    const mergedFiles = overflow.flatMap(([, b]) => b.files);
    kept.push([
      'misc',
      {
        type: 'chore',
        scope: 'misc',
        labelZh: '整理其余模块改动',
        labelEn: 'update remaining files',
        files: mergedFiles
      }
    ]);
    entries.length = 0;
    entries.push(...kept);
  }

  // Deterministic logical order: chore/config -> core/feat -> style -> test -> docs
  const orderRank = (key: string) => {
    if (key === 'chore') return 1;
    if (key.startsWith('src:')) return 2;
    if (key === 'style') return 3;
    if (key === 'test') return 4;
    if (key === 'docs') return 5;
    return 6;
  };
  entries.sort((a, b) => orderRank(a[0]) - orderRank(b[0]) || a[0].localeCompare(b[0]));

  return entries.map(([key, b], idx) => {
    const sample = b.files.slice(0, 2).map((f) => f.split('/').pop()).filter(Boolean).join(', ');
    const more = b.files.length > 2 ? (language === 'zh' ? ` 等 ${b.files.length} 个文件` : ` (+${b.files.length - 2} more)`) : '';
    const desc = language === 'zh' ? `${b.labelZh}（${sample}${more}）` : `${b.labelEn} (${sample}${more})`;
    const message = style === 'conventional'
      ? `${b.type}${b.scope ? `(${b.scope})` : ''}: ${desc}`
      : desc;
    const rationale = language === 'zh'
      ? `按目录与职责自动归组（${b.files.length} 个文件）`
      : `Grouped automatically by module & concern (${b.files.length} files)`;
    return {
      id: `draft-${idx + 1}-${key.replace(/[^a-z0-9]/gi, '_')}`,
      title: language === 'zh' ? `提交 #${idx + 1} · ${b.scope || b.type}` : `Commit #${idx + 1} · ${b.scope || b.type}`,
      message,
      files: b.files,
      rationale
    };
  });
}

function extractComposerJson(raw: string): any {
  const cleaned = raw.trim().replace(/^```(?:json)?\r?\n/i, '').replace(/\r?\n```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch { /* ignore */ }
    }
    return null;
  }
}

export class AiAssistantService {
  constructor(private readonly dataSource: DataSource) {}

  private async getRecentBranchCommits(repo: string, limit = 6): Promise<string[]> {
    try {
      const res = await this.dataSource.execGitRaw(repo, ['log', `-n${limit}`, '--format=%s']);
      return res.stdout
        .toString('utf8')
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  public async generateCommitMessage(repo: string, options: CommitMessageOptions = {}): Promise<CommitMessageResult> {
    const language: 'zh' | 'en' = options.language === 'en' ? 'en' : 'zh';
    const style = options.style || 'conventional';

    // 1. Read staged diff first
    let source: 'staged' | 'unstaged' | 'summary' = 'staged';
    let statOut = '';
    let diffOut = '';

    try {
      const st = await this.dataSource.execGitRaw(repo, ['-c', 'core.quotepath=false', 'diff', '--cached', '--stat']);
      statOut = st.stdout.toString('utf8').trim();
      if (statOut) {
        const df = await this.dataSource.execGitRaw(repo, ['-c', 'core.quotepath=false', 'diff', '--cached', '--no-color', '-U2'], { maxBytes: MAX_DIFF_BYTES });
        diffOut = decodeCappedDiff(df.stdout, MAX_DIFF_BYTES);
      }
    } catch { /* ignore */ }

    // 2. Fallback to unstaged diff if nothing staged
    if (!statOut && options.includeUnstagedFallback !== false) {
      source = 'unstaged';
      try {
        const st = await this.dataSource.execGitRaw(repo, ['-c', 'core.quotepath=false', 'diff', '--stat']);
        statOut = st.stdout.toString('utf8').trim();
        if (statOut) {
          const df = await this.dataSource.execGitRaw(repo, ['-c', 'core.quotepath=false', 'diff', '--no-color', '-U2'], { maxBytes: MAX_DIFF_BYTES });
          diffOut = decodeCappedDiff(df.stdout, MAX_DIFF_BYTES);
        }
      } catch { /* ignore */ }
    }

    if (!statOut) {
      // Check untracked files via status --porcelain
      try {
        const statusRes = await this.dataSource.execGitRaw(repo, ['-c', 'core.quotepath=false', 'status', '--short']);
        const shortOut = statusRes.stdout.toString('utf8').trim();
        if (!shortOut) {
          throw new Error(language === 'zh' ? '当前没有可生成提交说明的改动。' : 'No changes found to generate a commit message.');
        }
        source = 'summary';
        statOut = shortOut;
        diffOut = shortOut;
      } catch (err: any) {
        throw err;
      }
    }

    // Fetch recent commits on current branch so AI matches existing style, scopes, and narrative arc
    const recentCommits = await this.getRecentBranchCommits(repo, 6);

    const clippedDiff = diffOut.length > MAX_DIFF_CHARS
      ? diffOut.slice(0, MAX_DIFF_CHARS) + '\n... (diff truncated)'
      : diffOut;

    const langRule = language === 'zh'
      ? 'Write the commit message description in concise, natural Simplified Chinese (keep Conventional Commit type prefix in English like feat/fix/refactor/docs/style/perf/test/chore).'
      : 'Write the commit message in concise, natural English.';

    const styleRule = style === 'conventional'
      ? 'Follow Conventional Commits format: `<type>(<optional-scope>): <subject>` on line 1 (<= 72 chars).'
      : style === 'detailed'
        ? 'Provide a clear subject line (<= 72 chars) followed by a blank line and 2-4 concise bullet points explaining the key changes.'
        : 'Provide a single concise subject line (<= 72 chars) without a body.';

    const promptParts = [
      'You are an expert software engineer writing a Git commit message from a diff.',
      langRule,
      styleRule,
      'Align tone, scope naming, and narrative continuity with the recent commits on this branch when relevant.',
      'Output ONLY the raw commit message text. Do NOT wrap it in markdown code fences or add explanations.'
    ];
    if (recentCommits.length > 0) {
      promptParts.push('', '=== Recent Branch Commits ===', ...recentCommits.map((s) => `- ${s}`));
    }
    promptParts.push('', '=== Diff Stat ===', statOut, '', '=== Diff ===', clippedDiff);
    const prompt = promptParts.join('\n');

    const ai = await completeAiPrompt(prompt);
    if (!ai.error && ai.text) {
      const cleaned = ai.text
        .replace(/^```[a-z]*\r?\n/i, '')
        .replace(/\r?\n```$/i, '')
        .trim();
      if (cleaned) {
        return { message: cleaned, usedAi: true, source, recentCommitsCount: recentCommits.length, error: null };
      }
    }

    // Fallback to deterministic heuristic summary when AI isn't configured
    const fallback = buildHeuristicCommitMessage(statOut, language, style);
    return {
      message: fallback,
      usedAi: false,
      source,
      recentCommitsCount: recentCommits.length,
      error: ai.error || null
    };
  }

  public async composeCommits(repo: string, options: CommitMessageOptions = {}): Promise<ComposeCommitsResult> {
    const language: 'zh' | 'en' = options.language === 'en' ? 'en' : 'zh';
    const style = options.style || 'conventional';

    const status = await this.dataSource.getWorkingTreeStatus(repo);
    if (status.conflicted.length > 0) {
      throw new Error(
        language === 'zh'
          ? '当前工作区存在未解决的合并冲突，请先解决冲突后再编排提交。'
          : 'Unresolved merge conflicts exist. Resolve conflicts before composing commits.'
      );
    }

    const fileMap = new Map<string, { path: string; status: string }>();
    for (const f of [...status.staged, ...status.unstaged]) {
      if (!fileMap.has(f.path)) {
        fileMap.set(f.path, { path: f.path, status: f.status });
      }
    }
    const allFiles = Array.from(fileMap.values());
    if (allFiles.length === 0) {
      throw new Error(
        language === 'zh'
          ? '当前工作区没有未提交的改动可拆分编排。'
          : 'No uncommitted changes available to compose into commits.'
      );
    }

    const recentCommits = await this.getRecentBranchCommits(repo, 6);

    // Gather a compact diff overview for AI context
    let diffSummary = '';
    try {
      const df = await this.dataSource.execGitRaw(repo, ['-c', 'core.quotepath=false', 'diff', 'HEAD', '--no-color', '-U1'], { maxBytes: MAX_DIFF_BYTES });
      diffSummary = decodeCappedDiff(df.stdout, MAX_DIFF_BYTES);
    } catch {
      try {
        const df = await this.dataSource.execGitRaw(repo, ['-c', 'core.quotepath=false', 'diff', '--no-color', '-U1'], { maxBytes: MAX_DIFF_BYTES });
        diffSummary = decodeCappedDiff(df.stdout, MAX_DIFF_BYTES);
      } catch { /* unborn or untracked only */ }
    }

    const langRule = language === 'zh'
      ? 'Write commit messages, titles, and rationales in concise Simplified Chinese (keep Conventional Commit type prefixes in English like feat/fix/refactor/test/docs/style/chore).'
      : 'Write commit messages, titles, and rationales in concise English.';

    const prompt = [
      'You are an expert Staff Engineer organizing a noisy working tree into clean, logical, atomic Git commits (like GitLens Commit Composer).',
      langRule,
      `Commit style: ${style}. Group related changes into 1 to 6 ordered commits (config/core first, then features/fixes, then styles, tests, docs).`,
      'Every file from the Changed Files list MUST appear in EXACTLY ONE commit draft, using its exact path string.',
      'Return STRICT JSON ONLY (no markdown fences) matching:',
      '{"drafts":[{"title":"short label","message":"commit message","files":["exact/path"],"rationale":"why grouped together"}]}',
      recentCommits.length > 0 ? '\n=== Recent Branch Commits ===\n' + recentCommits.map((s) => `- ${s}`).join('\n') : '',
      '\n=== Changed Files ===\n' + allFiles.map((f) => `${f.status}\t${f.path}`).join('\n'),
      diffSummary ? '\n=== Diff Excerpt ===\n' + diffSummary.slice(0, MAX_DIFF_CHARS) : ''
    ].filter(Boolean).join('\n');

    const ai = await completeAiPrompt(prompt);
    if (!ai.error && ai.text) {
      const parsed = extractComposerJson(ai.text);
      if (parsed && Array.isArray(parsed.drafts) && parsed.drafts.length > 0) {
        const validSet = new Set(allFiles.map((f) => f.path));
        const assigned = new Set<string>();
        const drafts: ComposedCommitDraft[] = [];

        for (let i = 0; i < parsed.drafts.length; i++) {
          const item = parsed.drafts[i];
          if (!item || typeof item !== 'object') continue;
          const rawFiles = Array.isArray(item.files) ? item.files.map((x: any) => String(x || '').trim()) : [];
          const cleanFiles: string[] = [];
          for (const fp of rawFiles) {
            if (validSet.has(fp) && !assigned.has(fp)) {
              assigned.add(fp);
              cleanFiles.push(fp);
            }
          }
          if (cleanFiles.length === 0) continue;
          const msg = String(item.message || '').trim() || buildHeuristicCommitMessage(cleanFiles.map((f) => `${f} | 1`).join('\n'), language, style);
          drafts.push({
            id: `draft-${drafts.length + 1}`,
            title: String(item.title || '').trim() || (language === 'zh' ? `提交 #${drafts.length + 1}` : `Commit #${drafts.length + 1}`),
            message: msg,
            files: cleanFiles,
            rationale: item.rationale ? String(item.rationale).trim() : undefined
          });
        }

        // Ensure no changed file is silently dropped if AI omitted any
        const leftover = allFiles.filter((f) => !assigned.has(f.path)).map((f) => f.path);
        if (leftover.length > 0) {
          drafts.push({
            id: `draft-${drafts.length + 1}-rest`,
            title: language === 'zh' ? `其余改动 (${leftover.length})` : `Remaining changes (${leftover.length})`,
            message: style === 'conventional'
              ? `chore: ${language === 'zh' ? `提交其余 ${leftover.length} 个文件改动` : `commit remaining ${leftover.length} changed files`}`
              : (language === 'zh' ? `提交其余 ${leftover.length} 个文件改动` : `commit remaining ${leftover.length} changed files`),
            files: leftover,
            rationale: language === 'zh' ? '自动补齐未被 AI 分配的工作区文件' : 'Auto-included remaining uncommitted files'
          });
        }

        if (drafts.length > 0) {
          return {
            drafts,
            usedAi: true,
            branchContext: recentCommits,
            totalFiles: allFiles.length,
            error: null
          };
        }
      }
    }

    const heuristicDrafts = buildHeuristicCommitPlan(allFiles, language, style);
    return {
      drafts: heuristicDrafts,
      usedAi: false,
      branchContext: recentCommits,
      totalFiles: allFiles.length,
      error: ai.error || null
    };
  }
}
