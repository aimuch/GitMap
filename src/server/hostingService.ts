import { completeAiPrompt } from '../aiProviders';
import { DataSource } from '../dataSource';
import * as vscode from '../platform/vscode';
import { RepoFileWatcher } from '../repoFileWatcher';

export type HostingProviderKind = 'github' | 'gitlab' | 'gitea' | 'unknown';

export interface ParsedHostingRemote {
  remoteName: string;
  rawUrl: string;
  provider: HostingProviderKind;
  host: string;
  scheme: 'http' | 'https';
  webBase: string;
  apiBase: string;
  owner: string;
  repoName: string;
  projectPath: string;
}

export interface PullRequestItem {
  number: number;
  title: string;
  author: string;
  state: string;
  draft: boolean;
  sourceBranch: string;
  targetBranch: string;
  headSha: string;
  webUrl: string;
  updatedAt: string;
  ciStatus: 'success' | 'failure' | 'pending' | 'unknown';
}

export function parseRemoteHostingUrl(rawUrl: string, remoteName: string = 'origin', customApiOverride?: { host: string; provider: HostingProviderKind; apiBase?: string }): ParsedHostingRemote | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  let host = '';
  let scheme: 'http' | 'https' = 'https';
  let pathPart = '';

  const scpMatch = trimmed.match(/^(?:[^@/\s]+@)?([A-Za-z0-9.-]+):(?![/\\])(.+)$/);
  if (scpMatch && !/^[a-zA-Z]:/.test(trimmed)) {
    host = scpMatch[1].toLowerCase();
    pathPart = scpMatch[2];
  } else {
    try {
      const u = new URL(trimmed);
      host = u.hostname.toLowerCase();
      if (u.protocol === 'http:') {
        scheme = 'http';
        if (u.port) host = `${u.hostname.toLowerCase()}:${u.port}`;
      } else if (u.protocol === 'https:' && u.port) {
        host = `${u.hostname.toLowerCase()}:${u.port}`;
      }
      pathPart = u.pathname.replace(/^\/+/, '');
    } catch (_) {
      return null;
    }
  }

  const projectPath = pathPart.replace(/\.git$/i, '').replace(/\/+$/, '');
  const segs = projectPath.split('/').filter(Boolean);
  if (segs.length < 2) return null;

  const repoName = segs[segs.length - 1];
  const owner = segs.slice(0, -1).join('/');

  let provider: HostingProviderKind = 'unknown';
  if (customApiOverride && customApiOverride.host.toLowerCase() === host) {
    provider = customApiOverride.provider;
  } else if (host === 'github.com' || host.includes('github')) {
    provider = 'github';
  } else if (host === 'gitlab.com' || host.includes('gitlab')) {
    provider = 'gitlab';
  } else if (host === 'codeberg.org' || host.includes('gitea') || host.includes('forgejo')) {
    provider = 'gitea';
  }

  const webBase = `${scheme}://${host}`;
  let apiBase = webBase;
  if (customApiOverride?.apiBase) {
    apiBase = customApiOverride.apiBase.replace(/\/+$/, '');
  } else if (provider === 'github') {
    apiBase = host === 'github.com' ? 'https://api.github.com' : `${webBase}/api/v3`;
  } else if (provider === 'gitlab') {
    apiBase = `${webBase}/api/v4`;
  } else if (provider === 'gitea') {
    apiBase = `${webBase}/api/v1`;
  }

  return {
    remoteName,
    rawUrl: trimmed,
    provider,
    host,
    scheme,
    webBase,
    apiBase,
    owner,
    repoName,
    projectPath
  };
}

export class HostingService {
  private secrets: vscode.SecretStorage | null = null;

  constructor(private readonly dataSource: DataSource) {}

  public setSecretStorage(secrets: vscode.SecretStorage) {
    this.secrets = secrets;
  }

  private tokenKey(host: string): string {
    return `gitmap.hosting.token.${host.toLowerCase()}`;
  }

  public async setHostToken(host: string, token: string): Promise<void> {
    if (!this.secrets || !host.trim()) return;
    if (!token.trim()) {
      await this.secrets.delete(this.tokenKey(host.trim()));
    } else {
      await this.secrets.store(this.tokenKey(host.trim()), token.trim());
    }
  }

  public async hasHostToken(host: string): Promise<boolean> {
    if (!this.secrets || !host.trim()) return false;
    const val = await this.secrets.get(this.tokenKey(host.trim()));
    return typeof val === 'string' && val.trim() !== '';
  }

  private async getHostToken(host: string): Promise<string | null> {
    if (!this.secrets || !host.trim()) return null;
    const val = await this.secrets.get(this.tokenKey(host.trim()));
    return typeof val === 'string' && val.trim() !== '' ? val.trim() : null;
  }

  public async detectRepoHosting(repo: string, providerOverride?: HostingProviderKind): Promise<{
    remote: ParsedHostingRemote | null;
    currentBranch: string | null;
    defaultBaseBranch: string;
    hasToken: boolean;
  }> {
    const remotesOut = (await this.dataSource.execGitRaw(repo, ['remote', '-v'], { ignoreExitCode: true })).stdout
      .toString('utf8')
      .trim();
    const lines = remotesOut.split(/\r?\n/).filter(Boolean);
    let chosenName = 'origin';
    let chosenUrl = '';
    for (const line of lines) {
      const m = line.match(/^(\S+)\s+(\S+)\s+\(fetch\)$/);
      if (m) {
        if (m[1] === 'origin' || !chosenUrl) {
          chosenName = m[1];
          chosenUrl = m[2];
          if (m[1] === 'origin') break;
        }
      }
    }

    const currentBranch = await this.dataSource
      .execGitRaw(repo, ['symbolic-ref', '-q', '--short', 'HEAD'])
      .then((r) => r.stdout.toString('utf8').trim() || null, () => null);

    let defaultBaseBranch = 'main';
    const originHead = await this.dataSource
      .execGitRaw(repo, ['symbolic-ref', '-q', '--short', `refs/remotes/${chosenName}/HEAD`])
      .then((r) => r.stdout.toString('utf8').trim(), () => '');
    if (originHead.includes('/')) {
      defaultBaseBranch = originHead.split('/').slice(1).join('/');
    } else {
      const branches = (await this.dataSource.execGitRaw(repo, ['branch', '-a'], { ignoreExitCode: true })).stdout.toString('utf8');
      if (!/\bmain\b/.test(branches) && /\bmaster\b/.test(branches)) {
        defaultBaseBranch = 'master';
      }
    }

    if (!chosenUrl) {
      return { remote: null, currentBranch, defaultBaseBranch, hasToken: false };
    }

    let parsed = parseRemoteHostingUrl(chosenUrl, chosenName);
    if (parsed && providerOverride && providerOverride !== 'unknown') {
      parsed = parseRemoteHostingUrl(chosenUrl, chosenName, { host: parsed.host, provider: providerOverride });
    }
    const hasToken = parsed ? await this.hasHostToken(parsed.host) : false;
    return { remote: parsed, currentBranch, defaultBaseBranch, hasToken };
  }

  public async listPullRequests(repo: string, providerOverride?: HostingProviderKind): Promise<{
    remote: ParsedHostingRemote | null;
    hasToken: boolean;
    currentBranch: string | null;
    defaultBaseBranch: string;
    items: PullRequestItem[];
    error: string | null;
  }> {
    const info = await this.detectRepoHosting(repo, providerOverride);
    if (!info.remote) {
      return { ...info, items: [], error: 'No Git remote URL (e.g. origin) found in this repository.' };
    }
    if (info.remote.provider === 'unknown') {
      return {
        ...info,
        items: [],
        error: `Remote host "${info.remote.host}" is not automatically recognized. Choose GitHub, GitLab, or Gitea above.`
      };
    }

    const token = await this.getHostToken(info.remote.host);
    try {
      const items = await this.fetchPullRequestsFromApi(info.remote, token);
      return { ...info, items, error: null };
    } catch (err) {
      return { ...info, items: [], error: err instanceof Error ? err.message : String(err) };
    }
  }

  private async fetchPullRequestsFromApi(remote: ParsedHostingRemote, token: string | null): Promise<PullRequestItem[]> {
    const headers: { [k: string]: string } = {
      Accept: 'application/json',
      'User-Agent': 'GitMap-Standalone/1.0'
    };
    if (token) {
      if (remote.provider === 'gitlab') headers['PRIVATE-TOKEN'] = token;
      else headers.Authorization = `Bearer ${token}`;
    }

    if (remote.provider === 'github') {
      const url = `${remote.apiBase}/repos/${remote.projectPath}/pulls?state=open&per_page=25`;
      const resp = await fetch(url, { headers });
      if (!resp.ok) {
        throw new Error(`GitHub API HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
      }
      const data: any[] = (await resp.json()) as any[];
      const items: PullRequestItem[] = await Promise.all(
        data.map(async (pr) => {
          let ciStatus: PullRequestItem['ciStatus'] = 'unknown';
          if (pr.head?.sha) {
            try {
              const cr = await fetch(`${remote.apiBase}/repos/${remote.projectPath}/commits/${pr.head.sha}/check-runs?per_page=20`, { headers });
              if (cr.ok) {
                const cj: any = await cr.json();
                const runs: any[] = Array.isArray(cj.check_runs) ? cj.check_runs : [];
                if (runs.length > 0) {
                  if (runs.some((r) => r.conclusion === 'failure' || r.conclusion === 'timed_out' || r.conclusion === 'cancelled')) {
                    ciStatus = 'failure';
                  } else if (runs.some((r) => r.status !== 'completed')) {
                    ciStatus = 'pending';
                  } else {
                    ciStatus = 'success';
                  }
                }
              }
            } catch (_) {}
          }
          return {
            number: pr.number,
            title: String(pr.title || ''),
            author: String(pr.user?.login || ''),
            state: String(pr.state || 'open'),
            draft: !!pr.draft,
            sourceBranch: String(pr.head?.ref || ''),
            targetBranch: String(pr.base?.ref || ''),
            headSha: String(pr.head?.sha || ''),
            webUrl: String(pr.html_url || ''),
            updatedAt: String(pr.updated_at || ''),
            ciStatus
          };
        })
      );
      return items;
    }

    if (remote.provider === 'gitlab') {
      const proj = encodeURIComponent(remote.projectPath);
      const url = `${remote.apiBase}/projects/${proj}/merge_requests?state=opened&per_page=25`;
      const resp = await fetch(url, { headers });
      if (!resp.ok) {
        throw new Error(`GitLab API HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
      }
      const data: any[] = (await resp.json()) as any[];
      return data.map((mr) => {
        const pipe = mr.head_pipeline?.status || mr.pipeline?.status || '';
        const ciStatus: PullRequestItem['ciStatus'] =
          pipe === 'success' ? 'success' : pipe === 'failed' || pipe === 'canceled' ? 'failure' : pipe ? 'pending' : 'unknown';
        return {
          number: mr.iid,
          title: String(mr.title || ''),
          author: String(mr.author?.username || ''),
          state: String(mr.state || 'opened'),
          draft: !!(mr.draft || mr.work_in_progress),
          sourceBranch: String(mr.source_branch || ''),
          targetBranch: String(mr.target_branch || ''),
          headSha: String(mr.sha || ''),
          webUrl: String(mr.web_url || ''),
          updatedAt: String(mr.updated_at || ''),
          ciStatus
        };
      });
    }

    // Gitea / Forgejo / Codeberg
    const url = `${remote.apiBase}/repos/${remote.projectPath}/pulls?state=open&limit=25`;
    const resp = await fetch(url, { headers });
    if (!resp.ok) {
      throw new Error(`Gitea API HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
    }
    const data: any[] = (await resp.json()) as any[];
    return data.map((pr) => ({
      number: pr.number,
      title: String(pr.title || ''),
      author: String(pr.user?.login || ''),
      state: String(pr.state || 'open'),
      draft: !!pr.draft,
      sourceBranch: String(pr.head?.ref || ''),
      targetBranch: String(pr.base?.ref || ''),
      headSha: String(pr.head?.sha || ''),
      webUrl: String(pr.html_url || ''),
      updatedAt: String(pr.updated_at || ''),
      ciStatus: 'unknown'
    }));
  }

  public async checkoutPullRequest(repo: string, prNumber: number, providerOverride?: HostingProviderKind): Promise<{ localBranch: string }> {
    const info = await this.detectRepoHosting(repo, providerOverride);
    if (!info.remote) throw new Error('No Git remote configured.');
    const num = Math.floor(Number(prNumber));
    if (!Number.isInteger(num) || num <= 0) throw new Error('Invalid PR/MR number.');

    const isGitLab = info.remote.provider === 'gitlab';
    const remoteRef = isGitLab ? `merge-requests/${num}/head` : `pull/${num}/head`;
    const localBranch = isGitLab ? `mr-${num}` : `pr-${num}`;

    await this.dataSource.execGitRaw(repo, ['fetch', info.remote.remoteName, `${remoteRef}:${localBranch}`, '--force']);
    await this.dataSource.execGitRaw(repo, ['checkout', localBranch]);
    RepoFileWatcher.notifyPossibleRemoteChange(200);
    return { localBranch };
  }

  public async generatePrDraft(params: {
    repo: string;
    baseBranch: string;
    headBranch: string;
    lang?: string;
  }): Promise<{ title: string; body: string; usedAi: boolean }> {
    const base = params.baseBranch.trim();
    const head = (params.headBranch || 'HEAD').trim();
    if (!base || base.startsWith('-') || head.startsWith('-')) {
      throw new Error('Invalid base or head branch.');
    }

    let range = `${base}..${head}`;
    let logOut = await this.dataSource
      .execGitRaw(params.repo, ['log', '--no-merges', '--format=%h %s', range])
      .then((r) => r.stdout.toString('utf8').trim(), () => '');
    if (!logOut) {
      range = `origin/${base}..${head}`;
      logOut = await this.dataSource
        .execGitRaw(params.repo, ['log', '--no-merges', '--format=%h %s', range])
        .then((r) => r.stdout.toString('utf8').trim(), () => '');
    }
    const statOut = await this.dataSource
      .execGitRaw(params.repo, ['diff', '--stat', range], { ignoreExitCode: true })
      .then((r) => r.stdout.toString('utf8').trim(), () => '');

    const commits = logOut.split(/\r?\n/).filter(Boolean);
    const fallbackTitle = commits.length === 1 ? commits[0].replace(/^[0-9a-f]+\s+/, '') : `${head} -> ${base}`;
    const fallbackBody = ['## Summary', ...(commits.length ? commits.map((c) => `- ${c}`) : ['- Update changes']), '', '## Diff Stat', '```', statOut || '(no diff stat)', '```'].join('\n');

    const langNote = params.lang === 'zh' ? '请使用简体中文撰写 PR 标题与正文。' : 'Write the PR title and body in English.';
    const prompt = [
      'Generate a concise Pull Request title and Markdown description for the following branch changes.',
      langNote,
      'Return STRICT JSON ONLY: {"title":"concise PR title","body":"## Summary\\n- ...\\n\\n## Testing\\n- ..."}',
      `Branches: ${head} -> ${base}`,
      `\nCommits:\n${logOut || '(working branch)'}`,
      `\nDiff Stat:\n${statOut.slice(0, 8000)}`
    ].join('\n');

    const aiRes = await completeAiPrompt(prompt);
    if (!aiRes.error && aiRes.text) {
      try {
        const cleaned = aiRes.text.replace(/^```[^\n]*\n([\s\S]*?)\n```$/, '$1');
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start !== -1 && end > start) {
          const obj = JSON.parse(cleaned.slice(start, end + 1));
          if (obj && typeof obj.title === 'string' && typeof obj.body === 'string') {
            return { title: obj.title.trim(), body: obj.body.trim(), usedAi: true };
          }
        }
      } catch (_) {}
    }

    return { title: fallbackTitle, body: fallbackBody, usedAi: false };
  }

  public buildBrowserCreatePrUrl(remote: ParsedHostingRemote, base: string, head: string, title: string, body: string): string {
    if (remote.provider === 'gitlab') {
      const qs = new URLSearchParams({
        'merge_request[source_branch]': head,
        'merge_request[target_branch]': base,
        'merge_request[title]': title,
        'merge_request[description]': body
      });
      return `${remote.webBase}/${remote.projectPath}/-/merge_requests/new?${qs.toString()}`;
    }
    if (remote.provider === 'gitea') {
      return `${remote.webBase}/${remote.projectPath}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`;
    }
    const qs = new URLSearchParams({ expand: '1', title, body });
    return `${remote.webBase}/${remote.projectPath}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}?${qs.toString()}`;
  }

  public async createPullRequest(params: {
    repo: string;
    baseBranch: string;
    headBranch: string;
    title: string;
    body: string;
    draft?: boolean;
    providerOverride?: HostingProviderKind;
  }): Promise<{ createdViaApi: boolean; webUrl: string }> {
    const info = await this.detectRepoHosting(params.repo, params.providerOverride);
    if (!info.remote) throw new Error('No Git remote URL found.');
    const remote = info.remote;
    const browserUrl = this.buildBrowserCreatePrUrl(remote, params.baseBranch, params.headBranch, params.title, params.body);
    const token = await this.getHostToken(remote.host);
    if (!token || remote.provider === 'unknown') {
      return { createdViaApi: false, webUrl: browserUrl };
    }

    const headers: { [k: string]: string } = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'GitMap-Standalone/1.0'
    };
    if (remote.provider === 'gitlab') headers['PRIVATE-TOKEN'] = token;
    else headers.Authorization = `Bearer ${token}`;

    if (remote.provider === 'github') {
      const resp = await fetch(`${remote.apiBase}/repos/${remote.projectPath}/pulls`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: params.title,
          body: params.body,
          head: params.headBranch,
          base: params.baseBranch,
          draft: !!params.draft
        })
      });
      if (!resp.ok) throw new Error(`GitHub PR create failed (${resp.status}): ${(await resp.text()).slice(0, 240)}`);
      const data: any = await resp.json();
      return { createdViaApi: true, webUrl: String(data.html_url || browserUrl) };
    }

    if (remote.provider === 'gitlab') {
      const proj = encodeURIComponent(remote.projectPath);
      const resp = await fetch(`${remote.apiBase}/projects/${proj}/merge_requests`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          source_branch: params.headBranch,
          target_branch: params.baseBranch,
          title: params.draft && !params.title.startsWith('Draft:') ? `Draft: ${params.title}` : params.title,
          description: params.body
        })
      });
      if (!resp.ok) throw new Error(`GitLab MR create failed (${resp.status}): ${(await resp.text()).slice(0, 240)}`);
      const data: any = await resp.json();
      return { createdViaApi: true, webUrl: String(data.web_url || browserUrl) };
    }

    const resp = await fetch(`${remote.apiBase}/repos/${remote.projectPath}/pulls`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: params.title,
        body: params.body,
        head: params.headBranch,
        base: params.baseBranch
      })
    });
    if (!resp.ok) throw new Error(`Gitea PR create failed (${resp.status}): ${(await resp.text()).slice(0, 240)}`);
    const data: any = await resp.json();
    return { createdViaApi: true, webUrl: String(data.html_url || browserUrl) };
  }
}
