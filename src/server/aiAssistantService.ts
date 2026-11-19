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
  error?: string | null;
}

const MAX_DIFF_CHARS = 18000;

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

export class AiAssistantService {
  constructor(private readonly dataSource: DataSource) {}

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
        const df = await this.dataSource.execGitRaw(repo, ['-c', 'core.quotepath=false', 'diff', '--cached', '--no-color', '-U2']);
        diffOut = df.stdout.toString('utf8');
      }
    } catch { /* ignore */ }

    // 2. Fallback to unstaged diff if nothing staged
    if (!statOut && options.includeUnstagedFallback !== false) {
      source = 'unstaged';
      try {
        const st = await this.dataSource.execGitRaw(repo, ['-c', 'core.quotepath=false', 'diff', '--stat']);
        statOut = st.stdout.toString('utf8').trim();
        if (statOut) {
          const df = await this.dataSource.execGitRaw(repo, ['-c', 'core.quotepath=false', 'diff', '--no-color', '-U2']);
          diffOut = df.stdout.toString('utf8');
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

    const prompt = [
      'You are an expert software engineer writing a Git commit message from a diff.',
      langRule,
      styleRule,
      'Output ONLY the raw commit message text. Do NOT wrap it in markdown code fences or add explanations.',
      '',
      '=== Diff Stat ===',
      statOut,
      '',
      '=== Diff ===',
      clippedDiff
    ].join('\n');

    const ai = await completeAiPrompt(prompt);
    if (!ai.error && ai.text) {
      const cleaned = ai.text
        .replace(/^```[a-z]*\r?\n/i, '')
        .replace(/\r?\n```$/i, '')
        .trim();
      if (cleaned) {
        return { message: cleaned, usedAi: true, source, error: null };
      }
    }

    // Fallback to deterministic heuristic summary when AI isn't configured
    const fallback = buildHeuristicCommitMessage(statOut, language, style);
    return {
      message: fallback,
      usedAi: false,
      source,
      error: ai.error || null
    };
  }
}
