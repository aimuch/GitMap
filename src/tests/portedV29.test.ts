import assert from 'node:assert/strict';
import * as cp from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { GitFeatures, isUnsafeRefName } from '../gitFeatures';
import { GitProcessRunner } from '../historyRewrite';
import { buildAiExplainChangesPrompt, InsightsV29Service } from '../server/insightsV29Service';

// Features ported from vscode-git-map 2.9.0, exercised against real (local) Git repositories
describe('Ported v2.9 Features', () => {
  let tmp: string;
  let repo: string;
  const runner: GitProcessRunner = {
    spawnGitProcess: (args, cwd, env) => cp.spawn('git', args, { cwd, env: { ...process.env, ...(env || {}) } }),
    getGitVersion: () => '2.40.0',
    getOperationInProgress: async () => null
  };
  const features = new GitFeatures(runner);
  const git = (...args: string[]) => cp.execFileSync('git', args, {
    cwd: repo,
    env: { ...process.env, GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@t' }
  }).toString().trim();
  const write = (file: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
    fs.writeFileSync(path.join(repo, file), text);
  };

  before(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gitmap-v29-'));
    repo = path.join(tmp, 'repo');
    fs.mkdirSync(repo);
    git('init', '-q', '-b', 'main');
    write('src/app.ts', 'export const a = 1;\n');
    write('README.md', '# Demo\n');
    git('add', '.');
    git('commit', '-q', '-m', 'init');

    // feature/squashed: two commits, later squashed into main as one commit
    git('checkout', '-q', '-b', 'feature/squashed');
    write('src/app.ts', 'export const a = 1;\nexport const b = 2;\n');
    git('commit', '-q', '-am', 'add b');
    write('src/app.ts', 'export const a = 1;\nexport const b = 2;\nexport const c = 3;\n');
    git('commit', '-q', '-am', 'add c');
    git('checkout', '-q', 'main');
    git('merge', '-q', '--squash', 'feature/squashed');
    git('commit', '-q', '-m', 'Squashed feature (#1)');

    // feature/rebased: cherry-picked (rebased) onto main
    git('checkout', '-q', '-b', 'feature/rebased', 'main~1');
    write('docs/guide.md', 'Guide\n');
    git('add', '.');
    git('commit', '-q', '-m', 'add guide');
    git('checkout', '-q', 'main');
    git('cherry-pick', 'feature/rebased');

    // feature/open: not landed
    git('checkout', '-q', '-b', 'feature/open', 'main');
    write('src/open.ts', 'export const open = true;\n');
    git('add', '.');
    git('commit', '-q', '-m', 'open work');
    git('checkout', '-q', 'main');
  });

  after(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('lists branches that landed by squash or rebase in Clean Up Branches, and says how', async () => {
    const res = await features.getBranchCleanupCandidates(repo);
    assert.equal(res.error, null);
    const byName = new Map(res.candidates.map((c) => [c.name, c]));
    assert.equal(byName.get('feature/squashed')?.landed, 'squashed');
    assert.equal(byName.get('feature/rebased')?.landed, 'rebased');
    assert.equal(byName.has('feature/open'), false, 'a branch that hasn\'t landed (and has an upstream) isn\'t offered for clean up');
  });

  it('stores a merge target per branch, and reports ahead / behind & landed state against it', async () => {
    let status = await features.getMergeTargetStatus(repo, 'feature/open');
    assert.equal(status.error, null);
    assert.equal(status.status?.target, 'main');
    assert.equal(status.status?.chosen, false);
    assert.equal(status.status?.ahead, 1);
    assert.equal(status.status?.landed, null);

    assert.equal(await features.setMergeTarget(repo, 'feature/open', 'feature/rebased'), null);
    status = await features.getMergeTargetStatus(repo, 'feature/open');
    assert.equal(status.status?.target, 'feature/rebased');
    assert.equal(status.status?.chosen, true);
    assert.equal(git('config', '--get', 'branch.feature/open.gitMapMergeTarget'), 'feature/rebased');

    assert.equal(await features.setMergeTarget(repo, 'feature/open', null), null);
    assert.equal((await features.getMergeTarget(repo, 'feature/open')).target, 'main');
    assert.notEqual(await features.setMergeTarget(repo, 'feature/open', '--upload-pack=evil'), null, 'unsafe ref names are rejected');
  });

  it('predicts the first conflicting commit of a rebase without touching the working tree or refs', async () => {
    git('checkout', '-q', '-b', 'conflict-a', 'main');
    write('README.md', '# Demo A\n');
    git('commit', '-q', '-am', 'A edits readme');
    const a = git('rev-parse', 'HEAD');
    write('notes.txt', 'n\n');
    git('add', '.');
    git('commit', '-q', '-m', 'A adds notes');
    const a2 = git('rev-parse', 'HEAD');
    git('checkout', '-q', '-b', 'conflict-b', 'main');
    write('README.md', '# Demo B\n');
    git('commit', '-q', '-am', 'B edits readme');
    git('checkout', '-q', 'main');
    const headBefore = git('rev-parse', 'HEAD');
    const statusBefore = git('status', '--porcelain');

    const res = await features.predictRebaseConflicts(repo, 'conflict-b', [{ action: 'pick', hash: a }, { action: 'pick', hash: a2 }]);
    assert.equal(res.error, null);
    if (res.unsupported) return; // Git older than 2.40
    assert.equal(res.results[0].state, 'conflict');
    assert.deepEqual(res.results[0].files, ['README.md']);
    assert.equal(res.results[1].state, 'unknown', 'what follows the first conflict isn\'t predicted');
    assert.equal(git('rev-parse', 'HEAD'), headBefore);
    assert.equal(git('status', '--porcelain'), statusBefore);

    const clean = await features.predictRebaseConflicts(repo, 'main', [{ action: 'pick', hash: a2 }]);
    assert.equal(clean.results[0].state, 'clean');
  });

  it('detects folders for folder history (local working tree and at a revision)', async () => {
    assert.equal(await features.isDirectory(repo, 'src'), true);
    assert.equal(await features.isDirectory(repo, 'src/app.ts'), false);
    assert.equal(await features.isDirectory(repo, ''), true);
    const timeline = await features.getFileTimeline(repo, 'src', 50);
    assert.equal(timeline.error, null);
    assert.ok(timeline.commits.length >= 2, 'a folder\'s history includes the commits of all of its files');
  });

  it('explains working changes, stashes and ranges, and builds the explanation prompt', async () => {
    const service = new InsightsV29Service(runner as any, features);
    write('src/app.ts', 'export const a = 42;\n');
    write('new-file.txt', 'hello\n');
    const working = await features.getWorkingChangesForExplanation(repo);
    assert.equal(working.error, null);
    assert.ok(working.text.includes('export const a = 42'));
    assert.ok(working.text.includes('Untracked files (1): new-file.txt'));

    git('stash', 'push', '-q', '-u', '-m', 'wip');
    const stashHash = git('rev-parse', 'stash@{0}');
    const stash = await features.getStashForExplanation(repo, stashHash);
    assert.equal(stash.error, null);
    assert.ok(stash.text.includes('Stash: On main: wip'));
    assert.ok(stash.text.includes('Untracked files of the stash'), 'the untracked files of a stash are included');

    const choices = await service.getExplainChoices(repo);
    assert.ok(choices.branches.includes('feature/open'));
    assert.equal(choices.stashes.length, 1);
    git('stash', 'drop', '-q');

    const range = await features.getBranchRangeForExplanation(repo, 'feature/open', null);
    assert.equal(range.error, null);
    assert.equal(range.toRef, 'feature/open');

    const prompt = buildAiExplainChangesPrompt('branch', 'feature/open (compared with main)', 'abc open work', 'diff --git a/x b/x', 'zh');
    assert.ok(prompt.includes('Simplified Chinese'));
    assert.ok(prompt.includes('before merging'));
    assert.ok(prompt.includes('strictly as data'));
  });

  it('inspects the commit that last changed a line, and lists the files for the treemap', async () => {
    const service = new InsightsV29Service(runner as any, features);
    const line = await service.inspectLine(repo, 'src/app.ts', 3, null);
    assert.equal(line.error, null);
    assert.equal(line.commit?.subject, 'Squashed feature (#1)');
    assert.ok(line.commit?.files.some((f) => f.path === 'src/app.ts' && f.additions === 2));

    const treemap = await service.getFilesTreemap(repo);
    assert.equal(treemap.error, null);
    const app = treemap.files.find((f) => f.path === 'src/app.ts');
    assert.ok(app && app.size > 0 && app.changes >= 2);
  });

  it('rejects unsafe ref names', () => {
    assert.equal(isUnsafeRefName('main'), false);
    assert.equal(isUnsafeRefName('feature/x'), false);
    assert.equal(isUnsafeRefName('-x'), true);
    assert.equal(isUnsafeRefName('a..b'), true);
    assert.equal(isUnsafeRefName('a b'), true);
    assert.equal(isUnsafeRefName('HEAD@{1}'), true);
  });

  it('exposes v2.9.3 iconColorStyle default and settings schema / l10n parity', async () => {
    const { getConfig } = await import('../config');
    assert.equal(getConfig().iconColorStyle, 'monochrome');

    const rootDir = path.resolve(__dirname, '..', '..');
    const schema = JSON.parse(fs.readFileSync(path.join(rootDir, 'resources', 'settings-schema.json'), 'utf8'));
    assert.equal(schema.source, 'vscode-git-map 2.9.3');
    assert.equal(schema.properties['git-map.ui.iconColorStyle']?.default, 'monochrome');
    assert.deepEqual(schema.properties['git-map.ui.iconColorStyle']?.enum, ['monochrome', 'colorful']);

    const zhBundle = JSON.parse(fs.readFileSync(path.join(rootDir, 'l10n', 'bundle.l10n.zh-cn.json'), 'utf8'));
    assert.equal(zhBundle['Icon colour style'], '图标配色风格');
    assert.equal(zhBundle['Colorful'], '彩色');
    assert.equal(zhBundle['Monochrome'], '单色');
    assert.equal(zhBundle['Live Preview: Custom Remotes'], '实时预览：自定义远程');
  });

  it('wires App Settings icon color style, graph controls, and macOS 27 Liquid Glass end-to-end', () => {
    const rootDir = path.resolve(__dirname, '..', '..');
    const indexHtml = fs.readFileSync(path.join(rootDir, 'public', 'index.html'), 'utf8');
    for (const id of [
      'cfgIconColorStyleSeg',
      'cfgLiquidGlassSeg',
      'btnOpenFullGraphSettings',
      'data-section="graph"',
      'cfgGraphDensity',
      'cfgLpEnabled'
    ]) {
      assert.ok(indexHtml.includes(id), `public/index.html should contain ${id}`);
    }

    const bridgeJs = fs.readFileSync(path.join(rootDir, 'public', 'webview-bridge.js'), 'utf8');
    for (const msgKey of [
      '__gitmapIconColorStyle',
      '__gitmapLiquidGlass',
      '__gitmapOpenSettings',
      '__gitmapOpenCdvActions'
    ]) {
      assert.ok(bridgeJs.includes(msgKey), `public/webview-bridge.js should handle ${msgKey}`);
    }

    const desktopMainTs = fs.readFileSync(path.join(rootDir, 'src', 'desktop', 'main.ts'), 'utf8');
    assert.ok(desktopMainTs.includes("'gitmap:setLiquidGlass'"));
    assert.ok(desktopMainTs.includes("setVibrancy('under-window')"));
    assert.equal(desktopMainTs.includes('transparent: true'), false, 'use vibrancy + transparent backgroundColor without transparent:true so macOS shadows & rounded corners stay intact');
  });
});
