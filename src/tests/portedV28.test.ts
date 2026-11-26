import assert from 'node:assert/strict';
import * as cp from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { WebSocket } from 'ws';
import {
  applyWholeFileResolutions,
  parseConflictBlocks,
  parseWholeFileAiResolutionsWithConfidence,
  replaceConflictBlockInText,
  shouldAutoApplyResolutions
} from '../aiAutoRebase';
import { applyAutolinksToMarkdown, findAutolinkMatches, formatStartWorkBranchName } from '../autolinks';
import { detectDefaultBranch, parseBranchLifecycleRows } from '../branchDashboard';
import { hasGitMapMcpEntry, upsertAgentHookScript, upsertGitMapMcpJson } from '../codingAgents';
import {
  computeHeatBucket,
  extractTerminalLinks,
  formatBlameTemplate,
  parseChangedLineRangesFromDiff
} from '../editorAnnotationsCore';
import { buildChangelogMarkdown } from '../exportShare';
import { parseCountObjectsOutput } from '../gitMaintenance';
import { GitProcessScheduler } from '../gitProcessScheduler';
import { JsonFileMemento } from '../platform/vscode';
import {
  computeGuardRiskScore,
  parseCommitSplitPlan,
  scanDiffForPreCommitIssues
} from '../preCommitGuard';
import { classifyPrForLaunchpad } from '../prLaunchpad';
import { parseHostingRemoteUrl } from '../prStatusIntegration';
import { parseRebaseTodoDocument, serializeRebaseTodoDocument } from '../rebaseTodoCustomEditor';
import { computeRepoInsights, getMonthDateRange } from '../repoInsights';
import { RepoMetadataStore } from '../repoMetadataStore';
import { GitMapServer } from '../server/appServer';
import { PullRequestBadgeInfo } from '../types';

describe('Ported v2.8 Core Engines & Standalone RPC Suite', () => {
  it('bounds concurrency, preserves FIFO order, and cancels queued tasks in GitProcessScheduler', async () => {
    const scheduler = new GitProcessScheduler(2);
    let peakActive = 0;
    let currentActive = 0;
    const order: number[] = [];

    const mkTask = (id: number, delayMs: number) => () =>
      new Promise<number>((resolve) => {
        currentActive++;
        peakActive = Math.max(peakActive, currentActive);
        order.push(id);
        setTimeout(() => {
          currentActive--;
          resolve(id);
        }, delayMs);
      });

    let cancelTrigger: (() => void) | null = null;
    let isCancelled = false;
    const cancelToken = {
      get isCancellationRequested() {
        return isCancelled;
      },
      onCancellationRequested(fn: () => unknown) {
        cancelTrigger = () => {
          isCancelled = true;
          fn();
        };
        return { dispose: () => {} };
      }
    };

    const p1 = scheduler.run(mkTask(1, 35));
    const p2 = scheduler.run(mkTask(2, 35));
    const p3 = scheduler.run(mkTask(3, 15));
    const pCancelled = scheduler.run(mkTask(99, 10), cancelToken);
    assert.equal(scheduler.getStats().active, 2);
    assert.equal(scheduler.getStats().queued, 2);

    cancelTrigger!();
    await assert.rejects(pCancelled, /Cancelled/);

    const results = await Promise.all([p1, p2, p3]);
    assert.deepEqual(results, [1, 2, 3]);
    assert.equal(peakActive, 2);
    assert.deepEqual(order, [1, 2, 3]);
  });

  it('persists pinned branches, filter presets, and review sessions in RepoMetadataStore', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitmap-meta-'));
    try {
      const memento = new JsonFileMemento(path.join(tmpDir, 'state.json'));
      const store = new RepoMetadataStore(memento);
      const repo = '/tmp/demo';

      assert.deepEqual(store.togglePinnedBranch(repo, 'main'), ['main']);
      assert.deepEqual(store.togglePinnedBranch(repo, 'release/1.0'), ['main', 'release/1.0']);
      assert.deepEqual(store.togglePinnedBranch(repo, 'main'), ['release/1.0']);

      const presets = store.saveFilterPreset(repo, 'My Feature', 'author:andy file:src/');
      assert.equal(presets.length, 1);
      assert.equal(presets[0].name, 'My Feature');
      assert.equal(store.deleteFilterPreset(repo, presets[0].id).length, 0);

      const session = store.updateReviewSession(repo, 'HEAD~1..HEAD', {
        viewedFiles: ['src/a.ts', 'src/b.ts', 'src/a.ts'],
        comments: [{ id: 'c1', filePath: 'src/a.ts', severity: 'suggestion', text: 'Check null case', createdAt: 1000 }]
      });
      assert.deepEqual(session.viewedFiles, ['src/a.ts', 'src/b.ts']);
      assert.equal(session.comments.length, 1);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('matches autolinks safely and formats Start Work branch slugs', () => {
    const rules = [
      { prefix: 'PROJ-', url: 'https://jira.example.com/browse/<num>', alphanumeric: false },
      { prefix: 'GH-', url: 'javascript:alert(<num>)', alphanumeric: true },
      { prefix: '#', url: 'https://github.com/org/repo/issues/<num>', alphanumeric: false }
    ];
    const matches = findAutolinkMatches('Fix PROJ-123 and (#42), ignore GH-99', rules);
    assert.equal(matches.length, 2);
    assert.equal(matches[0].url, 'https://jira.example.com/browse/123');
    assert.equal(matches[1].url, 'https://github.com/org/repo/issues/42');

    const md = applyAutolinksToMarkdown('Resolved PROJ-7!', rules);
    assert.ok(md.includes('[PROJ\\-7](https://jira.example.com/browse/7'));

    const branch = formatStartWorkBranchName('feature/${id}-${title}', '#42', 'Support OAuth2 & PKCE Flow!');
    assert.equal(branch, 'feature/42-support-oauth2-pkce-flow');
  });

  it('detects secrets, debug statements, and markers with 0-100 risk scoring in preCommitGuard', () => {
    const diff = [
      '+++ b/src/auth.ts',
      '@@ -10,0 +11,4 @@',
      '+const token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456";',
      '+console.log("debug token", token);',
      '+// DO NOT COMMIT temporary bypass',
      '+export const ok = true;'
    ].join('\n');
    const issues = scanDiffForPreCommitIssues(diff);
    assert.equal(issues.length, 3);
    assert.equal(issues[0].kind, 'secret');
    assert.equal(issues[1].kind, 'debug');
    assert.equal(issues[2].kind, 'marker');

    const risk = computeGuardRiskScore(issues, 12, 600);
    assert.ok(risk.score < 50);
    assert.equal(risk.grade, 'high-risk');

    const splitGroups = parseCommitSplitPlan(
      '```json\n[{"message":"feat: add a","files":["a.ts","ghost.ts"],"rationale":"core"}]\n```',
      ['a.ts', 'b.ts']
    );
    assert.equal(splitGroups.length, 2, 'assigns remaining valid files automatically');
    assert.deepEqual(splitGroups[0].files, ['a.ts']);
    assert.deepEqual(splitGroups[1].files, ['b.ts']);
  });

  it('computes hotspots, knowledge silos, and co-change clusters in repoInsights', () => {
    const rawLog = [
      '\x1eAlice\x1falice@example.com\x1f1700000000\n10\t2\tsrc/core.ts\n5\t1\tsrc/helper.ts',
      '\x1eAlice\x1falice@example.com\x1f1700086400\n8\t3\tsrc/core.ts\n4\t0\tsrc/helper.ts',
      '\x1eAlice\x1falice@example.com\x1f1700172800\n6\t1\tsrc/core.ts\n2\t2\tsrc/readme.md'
    ].join('\n');
    const insights = computeRepoInsights(rawLog);
    assert.equal(insights.totalCommits, 3);
    assert.equal(insights.totalAuthors, 1);
    assert.equal(insights.hotspots[0].path, 'src/core.ts');
    assert.equal(insights.knowledgeSilos.length, 1);
    assert.equal(insights.knowledgeSilos[0].path, 'src/core.ts');
    assert.equal(insights.coChangeClusters.length, 1);
    assert.equal(insights.coChangeClusters[0].fileA, 'src/core.ts');
    assert.equal(insights.coChangeClusters[0].fileB, 'src/helper.ts');
    assert.equal(insights.coChangeClusters[0].coCommits, 2);
    assert.deepEqual(getMonthDateRange('2024-02'), { after: '2024-02-01', before: '2024-02-29' });
  });

  it('parses branch lifecycle rows, remote hosting URLs, and PR Launchpad buckets', () => {
    const nowSec = 1_700_000_000;
    const rawRefs = [
      `*\x1frefs/heads\x1fmain\x1fAndy\x1f${nowSec - 3600}\x1forigin/main\x1ffeat: head`,
      ` \x1frefs/heads\x1ffeature/old\x1fAndy\x1f${nowSec - 45 * 86400}\x1f\x1fwip: old work`
    ].join('\n');
    const rows = parseBranchLifecycleRows(rawRefs, new Set(['main', 'feature/old']), {}, nowSec);
    assert.equal(rows.length, 2);
    assert.equal(rows[1].stale, true);
    assert.equal(rows[1].merged, true);
    assert.equal(detectDefaultBranch(rows, 'origin/main'), 'main');

    assert.equal(parseHostingRemoteUrl('origin', 'git@github.com:aimuch/GitMap.git')?.provider, 'github');
    assert.equal(parseHostingRemoteUrl('origin', 'https://gitlab.com/group/sub/proj.git')?.provider, 'gitlab');
    assert.equal(parseHostingRemoteUrl('origin', 'https://dev.azure.com/org/proj/_git/repo')?.provider, 'azure');

    const basePr: PullRequestBadgeInfo = {
      number: 18,
      title: 'feat: v2.8',
      state: 'open',
      url: 'https://github.com/org/repo/pull/18',
      baseBranch: 'main',
      ciStatus: 'success',
      reviewDecision: 'approved'
    };
    assert.equal(classifyPrForLaunchpad(basePr, 'andy', 14), 'mergeable');
    assert.equal(classifyPrForLaunchpad({ ...basePr, ciStatus: 'failure' }, 'andy', 14), 'blocked');
    assert.equal(classifyPrForLaunchpad({ ...basePr, ciStatus: 'pending', reviewDecision: 'review_required' }, 'andy', 14), 'needsReview');
  });

  it('round-trips rebase-todo, MCP/hook configs, changelog markdown, and conflict resolutions', () => {
    const todoRaw = [
      'p a1b2c3d4 feat: first commit',
      'f e5f6a7b8 fixup typo',
      'x npm test',
      '# Rebase comment'
    ].join('\n');
    const parsedTodo = parseRebaseTodoDocument(todoRaw);
    assert.equal(parsedTodo[0].action, 'pick');
    assert.equal(parsedTodo[1].action, 'fixup');
    assert.equal(parsedTodo[2].kind, 'command');
    const serialized = serializeRebaseTodoDocument(parsedTodo);
    assert.ok(serialized.includes('pick a1b2c3d4 feat: first commit'));
    assert.ok(serialized.includes('exec npm test'));

    const mcpJson = upsertGitMapMcpJson('', 'claude-code', '/app/dist/cli.js', '/repo', true);
    assert.equal(hasGitMapMcpEntry(mcpJson, 'claude-code'), true);
    const mcpRemoved = upsertGitMapMcpJson(mcpJson, 'claude-code', '/app/dist/cli.js', '/repo', false);
    assert.equal(hasGitMapMcpEntry(mcpRemoved, 'claude-code'), false);

    const hookInstalled = upsertAgentHookScript('', 'codex', true);
    assert.ok(hookInstalled.includes('BEGIN git-map-agent-hook'));
    assert.equal(upsertAgentHookScript(hookInstalled, 'codex', false), '');

    assert.deepEqual(parseCountObjectsOutput('count: 42\nsize: 128\n'), { looseObjects: 42, sizeKb: 128 });
    const cl = buildChangelogMarkdown(
      [{ hash: '1234567890', subject: 'feat: add launchpad', author: 'Andy', dateIso: '2026-11-26' }],
      'Release'
    );
    assert.ok(cl.includes('## Features'));

    const conflicted = [
      'const x = 1;',
      '<<<<<<< HEAD',
      'const mode = "fast";',
      '||||||| base',
      'const mode = "legacy";',
      '=======',
      'const mode = "safe";',
      '>>>>>>> feature',
      'export default mode;'
    ].join('\n');
    const blocks = parseConflictBlocks(conflicted);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].base, 'const mode = "legacy";');
    assert.equal(replaceConflictBlockInText(conflicted, 0, 'const mode = "hybrid";')?.includes('hybrid'), true);
    assert.equal(applyWholeFileResolutions(conflicted, ['const mode = "hybrid";'])?.includes('<<<<<<<'), false);

    const aiRes = parseWholeFileAiResolutionsWithConfidence(
      '[{"code":"const mode = \\"hybrid\\";","confidence":"high","reason":"combines both"}]',
      1
    );
    assert.ok(aiRes !== null);
    assert.equal(shouldAutoApplyResolutions(aiRes!, 0.75), true);
    assert.equal(shouldAutoApplyResolutions([{ text: 'x', confidence: 'medium', reason: '' }], 0.75), false);
  });

  it('formats editor blame templates, heatmap buckets, diff ranges, and terminal Git links', () => {
    assert.equal(computeHeatBucket(1_700_000_000, 1_700_000_000, 90).level, 5);
    assert.equal(computeHeatBucket(1_600_000_000, 1_700_000_000, 30).isHot, false);

    const ranges = parseChangedLineRangesFromDiff('@@ -0,0 +5,3 @@\n@@ -12,2 +14,2 @@\n@@ -20,1 +22,0 @@');
    assert.deepEqual(ranges, [
      { start: 4, end: 6, kind: 'added' },
      { start: 13, end: 14, kind: 'modified' },
      { start: 21, end: 21, kind: 'deleted' }
    ]);

    const formatted = formatBlameTemplate(
      '${author|6}, ${sha} · ${pullRequest}',
      {
        hash: 'abcdef1234567890',
        author: 'Alexander',
        authorEmail: 'alex@example.com',
        authorDate: 1_700_000_000,
        summary: 'feat (#99)',
        committed: true,
        originalLine: 1,
        originalFilePath: 'src/a.ts'
      },
      { number: 99 }
    );
    assert.ok(formatted.includes('Alexa…'));
    assert.ok(formatted.includes('PR #99'));

    const links = extractTerminalLinks(
      'Compare main..feature/login or commit a1b2c3d4 (fixes #42 on feature/login)',
      new Set(['main', 'feature/login'])
    );
    assert.equal(links.some((l) => l.kind === 'range' && l.text === 'main..feature/login'), true);
    assert.equal(links.some((l) => l.kind === 'commit' && l.text === 'a1b2c3d4'), true);
    assert.equal(links.some((l) => l.kind === 'ref' && l.text === 'feature/login'), true);
    assert.equal(links.some((l) => l.text === '42'), false);
  });

  describe('GitMapServer v2.8 WebSocket RPC End-to-End', () => {
    let tmpRoot = '';
    let repoDir = '';
    let server: GitMapServer | null = null;
    let serverUrl = '';

    before(async () => {
      tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gitmap-v28-rpc-'));
      repoDir = path.join(tmpRoot, 'sample-repo');
      fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });

      const git = (args: string[]) =>
        cp.execFileSync('git', args, {
          cwd: repoDir,
          env: {
            ...process.env,
            GIT_AUTHOR_NAME: 'Andy',
            GIT_AUTHOR_EMAIL: 'andy@example.com',
            GIT_COMMITTER_NAME: 'Andy',
            GIT_COMMITTER_EMAIL: 'andy@example.com'
          }
        });

      git(['init', '-b', 'main']);
      git(['config', 'user.name', 'Andy']);
      git(['config', 'user.email', 'andy@example.com']);
      fs.writeFileSync(path.join(repoDir, 'src', 'index.ts'), 'export const v = 1;\n');
      fs.writeFileSync(path.join(repoDir, 'src', 'util.ts'), 'export const u = 1;\n');
      git(['add', '.']);
      git(['commit', '-m', 'feat: initial core and util (PROJ-10)']);

      fs.writeFileSync(path.join(repoDir, 'src', 'index.ts'), 'export const v = 2;\nexport const extra = true;\n');
      fs.writeFileSync(path.join(repoDir, 'src', 'util.ts'), 'export const u = 2;\n');
      git(['add', '.']);
      git(['commit', '-m', 'fix: update core and util together (PROJ-11)']);

      // Add uncommitted debug line for guard:scan & file:annotations
      fs.writeFileSync(path.join(repoDir, 'src', 'index.ts'), 'export const v = 2;\nconsole.log("debug"); // DO NOT COMMIT\n');

      server = new GitMapServer({
        port: 0,
        host: '127.0.0.1',
        dataDir: path.join(tmpRoot, 'app-data'),
        initialRepos: [repoDir]
      });
      serverUrl = await server.start();
    });

    after(async () => {
      await server?.stop();
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    it('serves all v2.8 workbench, maintenance, insights, SCM, and annotation RPCs cleanly', async () => {
      const ws = new WebSocket(serverUrl.replace(/^http/, 'ws') + '/ws');
      await new Promise<void>((resolve, reject) => {
        ws.once('open', () => resolve());
        ws.once('error', reject);
      });

      const rpc = (method: string, params: Record<string, unknown> = {}) =>
        new Promise<any>((resolve, reject) => {
          const reqId = 'v28-' + Math.random().toString(36).slice(2);
          const onMsg = (raw: Buffer | ArrayBuffer | Buffer[]) => {
            const msg = JSON.parse(raw.toString());
            if (msg.type === 'rpc:res' && msg.reqId === reqId) {
              ws.off('message', onMsg);
              if (msg.ok) resolve(msg.result);
              else reject(new Error(msg.error || 'RPC error'));
            }
          };
          ws.on('message', onMsg);
          ws.send(JSON.stringify({ type: 'rpc', reqId, method, params }));
        });

      try {
        await rpc('repos:add', { path: repoDir });

        const guard = await rpc('guard:scan', { repo: repoDir });
        assert.ok(guard.issues.length >= 1, 'guard:scan detects uncommitted console.log');
        assert.ok(guard.riskReport.score < 100);

        const ins = await rpc('insights:compute', { repo: repoDir, days: 90 });
        assert.equal(ins.insights.totalCommits, 2);
        assert.equal(ins.insights.coChangeClusters.length, 1);

        const previewWork = await rpc('work:previewBranch', { repo: repoDir, id: 'PROJ-88', title: 'Add Dashboard' });
        assert.equal(previewWork.branchName, 'PROJ-88-add-dashboard');

        const customPreview = await rpc('work:previewBranch', {
          repo: repoDir,
          id: 'PROJ-88',
          title: 'Add Dashboard',
          template: 'feature/${id}-${title}'
        });
        assert.equal(customPreview.branchName, 'feature/PROJ-88-add-dashboard');

        const startedWork = await rpc('work:start', { repo: repoDir, id: 'PROJ-88', title: 'Add Dashboard' });
        assert.equal(startedWork.branchName, 'PROJ-88-add-dashboard');

        // Switch back to main and batch-delete the merged branch via branches:lifecycle + branches:deleteBatch
        await rpc('git:checkout', { repo: repoDir, ref: 'main' });
        const lifecycle = await rpc('branches:lifecycle', { repo: repoDir });
        assert.ok(lifecycle.rows.some((r: any) => r.name === 'PROJ-88-add-dashboard' && r.merged));
        const delBatch = await rpc('branches:deleteBatch', {
          repo: repoDir,
          branches: [{ name: 'PROJ-88-add-dashboard', isRemote: false }]
        });
        assert.deepEqual(delBatch.deleted, ['PROJ-88-add-dashboard']);

        const maint = await rpc('maintenance:optimize', { repo: repoDir, mode: 'commitGraph' });
        assert.equal(maint.error, null);
        assert.equal(maint.report.coreCommitGraphEnabled, true);

        const signers = await rpc('maintenance:ensureSigners', { repo: repoDir });
        assert.equal(signers.error, null);
        assert.ok(signers.filePath && fs.existsSync(signers.filePath));

        const mcpToggle = await rpc('agents:toggleMcp', { repo: repoDir, agentId: 'claude-code', enable: true });
        assert.equal(mcpToggle.ok, true);
        const agentsList = await rpc('agents:list', { repo: repoDir });
        assert.equal(agentsList.agents.find((a: any) => a.id === 'claude-code')?.mcpConfigured, true);

        const scm11 = await rpc('scm:groupedView', { repo: repoDir, activeFilePath: 'src/index.ts' });
        assert.equal(scm11.sections.length, 11);

        const changelog = await rpc('changelog:export', { repo: repoDir, limit: 20 });
        assert.equal(changelog.commitsCount, 2);
        assert.ok(changelog.markdown.includes('## Features'));

        const annot = await rpc('file:annotations', { repo: repoDir, filePath: 'src/index.ts' });
        assert.ok(annot.heatBuckets.length >= 2);
        assert.ok(annot.changedRanges.length >= 1);
        assert.equal(annot.modes.length, 3);

        const termLinks = await rpc('terminal:extractLinks', { repo: repoDir, line: 'Checked out main at HEAD' });
        assert.ok(termLinks.links.some((l: any) => l.text === 'main'));
        const openedLink = await rpc('terminal:openLink', { repo: repoDir, kind: 'ref', text: 'main' });
        assert.equal(openedLink.ok, true);
      } finally {
        ws.close();
      }
    });
  });
});
