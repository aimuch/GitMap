import assert from 'node:assert/strict';
import * as cp from 'node:child_process';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { Server as SshServer, utils as sshUtils } from 'ssh2';
import { WebSocket } from 'ws';
import { formatRemoteRepoUri } from '../remote/repoTransport';
import { GitMapServer } from '../server/appServer';
import { buildPartialHunkPatch, parseUnifiedDiffHunks } from '../server/gitWorkflowService';
import { parseRemoteHostingUrl } from '../server/hostingService';

const STATUS_CODE = sshUtils.sftp.STATUS_CODE;
const OPEN_MODE = sshUtils.sftp.OPEN_MODE;

function execGitSync(cwd: string, args: string[], allowNonZero = false): string {
  const res = cp.spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Andy',
      GIT_AUTHOR_EMAIL: 'andy@example.com',
      GIT_COMMITTER_NAME: 'Andy',
      GIT_COMMITTER_EMAIL: 'andy@example.com'
    }
  });
  if (!allowNonZero && res.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed (${res.status}): ${res.stderr || res.stdout}`);
  }
  return res.stdout || '';
}

function startMockSshWithTcpip(homeRoot: string): Promise<{ server: SshServer; port: number; destroyClients: () => void }> {
  const hostKey = sshUtils.generateKeyPairSync('ed25519');
  const shellBin = process.platform === 'win32' ? 'sh' : '/bin/sh';
  const activeClients = new Set<any>();

  const server = new SshServer({ hostKeys: [hostKey.private] }, (client) => {
    activeClients.add(client);
    client.on('close', () => activeClients.delete(client));
    client.on('error', () => {});
    client.on('authentication', (ctx) => {
      if (ctx.method === 'password' && ctx.username === 'gituser' && ctx.password === 'secret123') {
        return ctx.accept();
      }
      ctx.reject(['password']);
    });

    client.on('ready', () => {
      client.on('tcpip', (accept, reject, info) => {
        const upstream = net.connect(info.destPort, info.destIP);
        upstream.once('connect', () => {
          const channel = accept();
          channel.on('error', () => upstream.destroy());
          upstream.on('error', () => {
            try {
              channel.close();
            } catch (_) {}
          });
          channel.pipe(upstream);
          upstream.pipe(channel);
        });
        upstream.once('error', () => reject());
      });

      client.on('session', (accept) => {
        const session = accept();

        session.on('exec', (acceptExec, _rejectExec, info) => {
          const stream = acceptExec();
          const child = cp.spawn(shellBin, ['-c', info.command], {
            cwd: homeRoot,
            env: { ...process.env, HOME: homeRoot }
          });
          stream.pipe(child.stdin);
          child.stdout.pipe(stream);
          child.stderr.pipe(stream.stderr);
          child.on('close', (code) => {
            stream.exit(code ?? 0);
            stream.end();
          });
        });

        session.on('sftp', (acceptSftp) => {
          const sftp = acceptSftp();
          const openFiles = new Map<string, { fd: number }>();
          let seq = 0;

          const makeAttrs = (st: fs.Stats) => ({
            mode: st.mode,
            uid: st.uid,
            gid: st.gid,
            size: st.size,
            atime: Math.floor(st.atimeMs / 1000),
            mtime: Math.floor(st.mtimeMs / 1000)
          });

          sftp.on('REALPATH', (reqid, givenPath) => {
            const resolved = givenPath === '.' ? homeRoot : path.resolve(homeRoot, givenPath);
            sftp.name(reqid, [{ filename: resolved, longname: resolved, attrs: {} as any }]);
          });

          sftp.on('STAT', (reqid, p) => {
            try {
              sftp.attrs(reqid, makeAttrs(fs.statSync(p)));
            } catch (_) {
              sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE);
            }
          });

          sftp.on('OPEN', (reqid, filePath, flags) => {
            try {
              let fsFlags = 'r';
              if ((flags & OPEN_MODE.WRITE) && (flags & OPEN_MODE.CREAT)) {
                fsFlags = flags & OPEN_MODE.TRUNC ? 'w' : 'a';
              } else if (flags & OPEN_MODE.WRITE) {
                fsFlags = 'r+';
              }
              const fd = fs.openSync(filePath, fsFlags);
              const h = 'f' + (++seq);
              openFiles.set(h, { fd });
              sftp.handle(reqid, Buffer.from(h));
            } catch (_) {
              sftp.status(reqid, STATUS_CODE.FAILURE);
            }
          });

          sftp.on('READ', (reqid, handle, offset, length) => {
            const item = openFiles.get(handle.toString());
            if (!item) return sftp.status(reqid, STATUS_CODE.FAILURE);
            const buf = Buffer.alloc(length);
            const bytes = fs.readSync(item.fd, buf, 0, length, offset);
            if (bytes === 0) return sftp.status(reqid, STATUS_CODE.EOF);
            sftp.data(reqid, buf.subarray(0, bytes));
          });

          sftp.on('WRITE', (reqid, handle, offset, data) => {
            const item = openFiles.get(handle.toString());
            if (!item) return sftp.status(reqid, STATUS_CODE.FAILURE);
            fs.writeSync(item.fd, data, 0, data.length, offset);
            sftp.status(reqid, STATUS_CODE.OK);
          });

          sftp.on('CLOSE', (reqid, handle) => {
            const key = handle.toString();
            const item = openFiles.get(key);
            if (item) {
              try {
                fs.closeSync(item.fd);
              } catch (_) {}
              openFiles.delete(key);
            }
            sftp.status(reqid, STATUS_CODE.OK);
          });
        });
      });
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({
        server,
        port: typeof addr === 'object' && addr ? addr.port : 0,
        destroyClients: () => {
          for (const c of activeClients) {
            try {
              c.end();
            } catch (_) {}
          }
          activeClients.clear();
        }
      });
    });
  });
}

class RpcClient {
  private ws!: WebSocket;
  private seq = 0;
  private pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>();

  public async connect(serverUrl: string): Promise<void> {
    const wsUrl = serverUrl.replace(/^http/, 'ws') + '/ws';
    await new Promise<void>((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);
      this.ws.once('error', reject);
      this.ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'init') {
          resolve();
        } else if (msg.type === 'rpc:res' && this.pending.has(msg.reqId)) {
          const entry = this.pending.get(msg.reqId)!;
          this.pending.delete(msg.reqId);
          if (msg.ok) entry.resolve(msg.result);
          else entry.reject(new Error(msg.error || 'RPC failed'));
        }
      });
    });
  }

  public call<T = any>(method: string, params: Record<string, any> = {}): Promise<T> {
    const reqId = 'feat-req-' + (++this.seq);
    return new Promise<T>((resolve, reject) => {
      this.pending.set(reqId, { resolve, reject });
      this.ws.send(JSON.stringify({ type: 'rpc', reqId, method, params }));
    });
  }

  public async close(): Promise<void> {
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) return;
    await new Promise<void>((resolve) => {
      this.ws.once('close', () => resolve());
      this.ws.close();
    });
  }
}

describe('GitMap 11 Advanced Features End-to-End Suite', () => {
  let tmpRoot = '';
  let appServer: GitMapServer | null = null;
  let serverUrl = '';
  let rpc: RpcClient;

  let mockAiServer: http.Server | null = null;
  let mockAiPort = 0;

  let mockHostServer: http.Server | null = null;
  let mockHostPort = 0;
  let createdPrPayloads: any[] = [];

  let sshServer: SshServer | null = null;
  let destroySshClients: (() => void) | null = null;
  let sshPort = 0;
  let remoteTargetServer: http.Server | null = null;
  let remoteTargetPort = 0;
  let remoteHome = '';

  before(async () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gitmap-features-'));
    remoteHome = path.join(tmpRoot, 'remote-home');
    fs.mkdirSync(remoteHome, { recursive: true });

    // 1. Mock OpenAI-compatible SSE streaming server for AI Merge / Review / Release Notes / PR Draft / NL Search
    mockAiServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        let prompt = '';
        try {
          const parsed = JSON.parse(body);
          prompt = parsed?.messages?.[0]?.content || '';
        } catch (_) {}

        let reply = 'Default AI response';
        if (prompt.includes('resolving a Git merge conflict')) {
          reply = 'export const TITLE = "GitMap Pro Unified";';
        } else if (prompt.includes('pre-commit code review')) {
          reply = JSON.stringify({
            summary: '1 potential zero-divisor bug detected.',
            findings: [
              {
                severity: 'high',
                file: 'calc.ts',
                line: 4,
                title: 'Guard divisor against zero',
                detail: 'Passing 0 as divisor will return Infinity unless validated.',
                suggestion: 'if (b === 0) throw new RangeError("Division by zero");'
              }
            ]
          });
        } else if (prompt.includes('Release Notes / Changelog')) {
          reply = '## Highlights\n- Added partial hunk staging and 3-way conflict resolver\n\n## Bug Fixes\n- Hardened rebase backup refs';
        } else if (prompt.includes('natural-language Git history question')) {
          reply = JSON.stringify({
            grep: 'greeting',
            author: 'Andy'
          });
        } else if (prompt.includes('Pull Request title and Markdown description')) {
          reply = JSON.stringify({
            title: 'feat: add interactive workflow suite',
            body: '## Summary\n- Implements 3-way conflict resolution and worktree management.'
          });
        }

        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: reply } }] })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      });
    });
    await new Promise<void>((resolve, reject) => {
      mockAiServer!.once('error', reject);
      mockAiServer!.listen(0, '127.0.0.1', () => {
        const addr = mockAiServer!.address();
        mockAiPort = typeof addr === 'object' && addr ? addr.port : 0;
        resolve();
      });
    });

    // 2. Mock GitHub Enterprise REST API Server (/api/v3/...)
    mockHostServer = http.createServer((req, res) => {
      const url = req.url || '';
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        res.setHeader('Content-Type', 'application/json');
        if (req.method === 'GET' && url.startsWith('/api/v3/repos/acme/widget/pulls')) {
          res.end(
            JSON.stringify([
              {
                number: 42,
                title: 'feat: ship SSH port forwarding',
                user: { login: 'alice' },
                state: 'open',
                draft: false,
                head: { ref: 'feat/tunnel', sha: 'deadbeef1234567890' },
                base: { ref: 'main' },
                html_url: `http://127.0.0.1:${mockHostPort}/acme/widget/pull/42`,
                updated_at: '2026-11-18T10:00:00Z'
              }
            ])
          );
          return;
        }
        if (req.method === 'GET' && url.includes('/commits/deadbeef1234567890/check-runs')) {
          res.end(
            JSON.stringify({
              check_runs: [{ status: 'completed', conclusion: 'success' }]
            })
          );
          return;
        }
        if (req.method === 'POST' && url === '/api/v3/repos/acme/widget/pulls') {
          const parsed = JSON.parse(body || '{}');
          createdPrPayloads.push({ auth: req.headers.authorization, ...parsed });
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              number: 99,
              html_url: `http://127.0.0.1:${mockHostPort}/acme/widget/pull/99`
            })
          );
          return;
        }
        res.writeHead(404);
        res.end(JSON.stringify({ message: 'Not Found: ' + url }));
      });
    });
    await new Promise<void>((resolve, reject) => {
      mockHostServer!.once('error', reject);
      mockHostServer!.listen(0, '127.0.0.1', () => {
        const addr = mockHostServer!.address();
        mockHostPort = typeof addr === 'object' && addr ? addr.port : 0;
        resolve();
      });
    });

    // 3. Mock target HTTP service on remote side for SSH local port forwarding (-L) test
    remoteTargetServer = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, service: 'remote-internal-api' }));
    });
    await new Promise<void>((resolve, reject) => {
      remoteTargetServer!.once('error', reject);
      remoteTargetServer!.listen(0, '127.0.0.1', () => {
        const addr = remoteTargetServer!.address();
        remoteTargetPort = typeof addr === 'object' && addr ? addr.port : 0;
        resolve();
      });
    });

    const startedSsh = await startMockSshWithTcpip(remoteHome);
    sshServer = startedSsh.server;
    destroySshClients = startedSsh.destroyClients;
    sshPort = startedSsh.port;

    // 4. Start GitMapServer & connect RPC client
    appServer = new GitMapServer({
      port: 0,
      host: '127.0.0.1',
      dataDir: path.join(tmpRoot, 'app-data')
    });
    serverUrl = await appServer.start();
    rpc = new RpcClient();
    await rpc.connect(serverUrl);

    // Configure AI provider to point at our local mock OpenAI-compatible server
    await rpc.call('settings:update', { key: 'git-map.ai.provider', value: 'OpenAI Compatible' });
    await rpc.call('settings:update', { key: 'git-map.ai.baseUrl', value: `http://127.0.0.1:${mockAiPort}/v1` });
    await rpc.call('settings:update', { key: 'git-map.ai.model', value: 'mock-gpt-4o' });
    await rpc.call('ai:setApiKey', { key: 'sk-test-mock-key' });
  });

  after(async () => {
    await rpc?.close();
    await appServer?.stop();
    if (sshServer && sshServer.address()) {
      destroySshClients?.();
      await new Promise<void>((r) => sshServer!.close(() => r()));
    }
    for (const srv of [mockAiServer, mockHostServer, remoteTargetServer]) {
      if (srv && srv.listening) {
        srv.closeAllConnections();
        await new Promise<void>((r) => srv.close(() => r()));
      }
    }
    if (tmpRoot) fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('Feature 1: parses hunks, partially stages/unstages individual lines, and discards tracked + untracked changes', async () => {
    const repoDir = path.join(tmpRoot, 'repo-hunks');
    fs.mkdirSync(repoDir, { recursive: true });
    execGitSync(repoDir, ['init', '-b', 'main']);
    execGitSync(repoDir, ['config', 'user.name', 'Andy']);
    execGitSync(repoDir, ['config', 'user.email', 'andy@example.com']);

    const initialLines = ['line 1', 'line 2', 'line 3', 'line 4', 'line 5', 'line 6', 'line 7', 'line 8', ''];
    fs.writeFileSync(path.join(repoDir, 'notes.txt'), initialLines.join('\n'));
    execGitSync(repoDir, ['add', '.']);
    execGitSync(repoDir, ['commit', '-m', 'chore: initial notes']);

    const reg = await rpc.call('repos:add', { path: repoDir });
    const repo = reg.root;

    // Modify two lines in one hunk + create an untracked file
    const editedLines = ['line 1', 'line 2 MOD_A', 'line 3', 'line 4', 'line 5 MOD_B', 'line 6', 'line 7', 'line 8', ''];
    fs.writeFileSync(path.join(repoDir, 'notes.txt'), editedLines.join('\n'));
    fs.writeFileSync(path.join(repoDir, 'scratch.tmp'), 'temporary data\n');

    const unstaged = await rpc.call('scm:hunks', { repo, filePath: 'notes.txt', staged: false });
    assert.equal(unstaged.hunks.length, 1);
    const hunk = unstaged.hunks[0];

    // Select ONLY the first modification (line 2 -> line 2 MOD_A) and leave line 5 MOD_B unstaged
    const modAIndices = hunk.lines
      .filter((l: any) => l.text.includes('line 2'))
      .map((l: any) => l.index);
    assert.equal(modAIndices.length, 2);

    // Unit-check patch builder too
    const builtPatch = buildPartialHunkPatch(unstaged.fileHeader, hunk, modAIndices, 'stage');
    assert.equal(parseUnifiedDiffHunks(builtPatch).hunks.length, 1);

    await rpc.call('scm:applyHunk', {
      repo,
      mode: 'stage',
      fileHeader: unstaged.fileHeader,
      hunk,
      selectedIndices: modAIndices
    });

    const stagedAfter = await rpc.call('scm:hunks', { repo, filePath: 'notes.txt', staged: true });
    assert.equal(stagedAfter.hunks.length, 1);
    assert.ok(stagedAfter.hunks[0].patch.includes('+line 2 MOD_A'));
    assert.ok(!stagedAfter.hunks[0].patch.includes('+line 5 MOD_B'));

    const unstagedAfter = await rpc.call('scm:hunks', { repo, filePath: 'notes.txt', staged: false });
    assert.equal(unstagedAfter.hunks.length, 1);
    assert.ok(unstagedAfter.hunks[0].patch.includes('+line 5 MOD_B'));

    // Unstage the staged hunk back
    await rpc.call('scm:applyHunk', {
      repo,
      mode: 'unstage',
      patch: stagedAfter.hunks[0].patch
    });
    const stagedEmpty = await rpc.call('scm:hunks', { repo, filePath: 'notes.txt', staged: true });
    assert.equal(stagedEmpty.hunks.length, 0);

    // Discard tracked + untracked files via scm:discard
    const afterDiscard = await rpc.call('scm:discard', {
      repo,
      files: [
        { path: 'notes.txt', status: 'M' },
        { path: 'scratch.tmp', status: 'U' }
      ]
    });
    assert.equal(afterDiscard.staged.length, 0);
    assert.equal(afterDiscard.unstaged.length, 0);
    assert.equal(fs.existsSync(path.join(repoDir, 'scratch.tmp')), false);
    assert.equal(fs.readFileSync(path.join(repoDir, 'notes.txt'), 'utf8'), initialLines.join('\n'));
  });

  it('Feature 2: detects merge conflicts, reads 3-way stages, runs AI conflict merge, resolves, and completes merge', async () => {
    const repoDir = path.join(tmpRoot, 'repo-conflict');
    fs.mkdirSync(repoDir, { recursive: true });
    execGitSync(repoDir, ['init', '-b', 'main']);
    execGitSync(repoDir, ['config', 'user.name', 'Andy']);
    execGitSync(repoDir, ['config', 'user.email', 'andy@example.com']);

    fs.writeFileSync(path.join(repoDir, 'title.ts'), 'export const TITLE = "GitMap";\n');
    execGitSync(repoDir, ['add', '.']);
    execGitSync(repoDir, ['commit', '-m', 'feat: base title']);

    execGitSync(repoDir, ['checkout', '-b', 'feat/pro']);
    fs.writeFileSync(path.join(repoDir, 'title.ts'), 'export const TITLE = "GitMap Pro";\n');
    execGitSync(repoDir, ['commit', '-am', 'feat: pro title']);

    execGitSync(repoDir, ['checkout', 'main']);
    fs.writeFileSync(path.join(repoDir, 'title.ts'), 'export const TITLE = "GitMap Unified";\n');
    execGitSync(repoDir, ['commit', '-am', 'feat: unified title']);

    // Trigger real Git merge conflict
    execGitSync(repoDir, ['merge', 'feat/pro'], true);

    const { root: repo } = await rpc.call('repos:add', { path: repoDir });
    const opState = await rpc.call('git:operationState', { repo });
    assert.equal(opState.mergeInProgress, true);
    assert.equal(opState.conflictCount, 1);

    const conflictData = await rpc.call('conflict:read', { repo, filePath: 'title.ts' });
    assert.ok(conflictData.baseContent.includes('"GitMap"'));
    assert.ok(conflictData.oursContent.includes('"GitMap Unified"'));
    assert.ok(conflictData.theirsContent.includes('"GitMap Pro"'));
    assert.equal(conflictData.blocks.length, 1);

    const blk = conflictData.blocks[0];
    const aiRes = await rpc.call('conflict:aiMerge', {
      filePath: 'title.ts',
      ours: blk.oursContent,
      base: conflictData.baseContent.trim(),
      theirs: blk.theirsContent
    });
    assert.equal(aiRes.merged, 'export const TITLE = "GitMap Pro Unified";');

    await rpc.call('conflict:resolve', {
      repo,
      filePath: 'title.ts',
      content: aiRes.merged + '\n'
    });

    const finished = await rpc.call('conflict:continueOrAbort', {
      repo,
      operation: 'merge',
      action: 'continue'
    });
    assert.equal(finished.state.mergeInProgress, false);
    assert.equal(finished.state.conflictCount, 0);
    assert.equal(fs.readFileSync(path.join(repoDir, 'title.ts'), 'utf8'), 'export const TITLE = "GitMap Pro Unified";\n');
  });

  it('Feature 3: executes visual interactive rebase (reword + squash + reorder) with automatic backup ref', async () => {
    const repoDir = path.join(tmpRoot, 'repo-rebase');
    fs.mkdirSync(repoDir, { recursive: true });
    execGitSync(repoDir, ['init', '-b', 'main']);
    execGitSync(repoDir, ['config', 'user.name', 'Andy']);
    execGitSync(repoDir, ['config', 'user.email', 'andy@example.com']);

    fs.writeFileSync(path.join(repoDir, 'base.txt'), 'root\n');
    execGitSync(repoDir, ['add', '.']);
    execGitSync(repoDir, ['commit', '-m', 'chore: root commit']);
    const rootHash = execGitSync(repoDir, ['rev-parse', 'HEAD']).trim();

    fs.writeFileSync(path.join(repoDir, 'a.txt'), 'v1\n');
    execGitSync(repoDir, ['add', '.']);
    execGitSync(repoDir, ['commit', '-m', 'feat: add A']);

    fs.writeFileSync(path.join(repoDir, 'a.txt'), 'v1-fixed\n');
    execGitSync(repoDir, ['add', '.']);
    execGitSync(repoDir, ['commit', '-m', 'fix: polish A']);

    fs.writeFileSync(path.join(repoDir, 'b.txt'), 'feature B\n');
    execGitSync(repoDir, ['add', '.']);
    execGitSync(repoDir, ['commit', '-m', 'feat: add B']);

    const { root: repo } = await rpc.call('repos:add', { path: repoDir });
    const prep = await rpc.call('rebase:prepare', { repo, base: rootHash });
    assert.equal(prep.commits.length, 3);

    // Reorder B before A, reword A, and fixup polish-A into A
    const [commitA, commitFixA, commitB] = prep.commits;
    const execRes = await rpc.call('rebase:execute', {
      repo,
      baseHash: prep.baseHash,
      steps: [
        { hash: commitB.hash, action: 'pick' },
        { hash: commitA.hash, action: 'reword', message: 'feat: add A (complete)' },
        { hash: commitFixA.hash, action: 'fixup' }
      ]
    });
    assert.ok(execRes.backupRef.startsWith('refs/gitmap-backup/rebase-'));

    const subjects = execGitSync(repoDir, ['log', '--format=%s', `${rootHash}..HEAD`])
      .trim()
      .split(/\r?\n/);
    assert.deepEqual(subjects, ['feat: add A (complete)', 'feat: add B']);
    assert.equal(fs.readFileSync(path.join(repoDir, 'a.txt'), 'utf8'), 'v1-fixed\n');
  });

  it('Feature 3b: a squash chain that ends with a fixup still gets its message, and later rewords keep theirs', async () => {
    const repoDir = path.join(tmpRoot, 'repo-rebase-chain');
    fs.mkdirSync(repoDir, { recursive: true });
    execGitSync(repoDir, ['init', '-b', 'main']);
    execGitSync(repoDir, ['config', 'user.name', 'Andy']);
    execGitSync(repoDir, ['config', 'user.email', 'andy@example.com']);
    fs.writeFileSync(path.join(repoDir, 'base.txt'), 'root\n');
    execGitSync(repoDir, ['add', '.']);
    execGitSync(repoDir, ['commit', '-m', 'chore: root']);
    const rootHash = execGitSync(repoDir, ['rev-parse', 'HEAD']).trim();
    for (const [file, subject] of [['a.txt', 'feat: A'], ['b.txt', 'feat: B'], ['c.txt', 'fix: C'], ['d.txt', 'feat: D']]) {
      fs.writeFileSync(path.join(repoDir, file), subject + '\n');
      execGitSync(repoDir, ['add', '.']);
      execGitSync(repoDir, ['commit', '-m', subject]);
    }
    const { root: repo } = await rpc.call('repos:add', { path: repoDir });
    const prep = await rpc.call('rebase:prepare', { repo, base: rootHash });
    const [a, b, c, d] = prep.commits;
    // Git opens the editor once at the end of [squash B, fixup C] (the chain contains a squash), then once for the reword
    await rpc.call('rebase:execute', {
      repo,
      baseHash: prep.baseHash,
      steps: [
        { hash: a.hash, action: 'pick' },
        { hash: b.hash, action: 'squash', message: 'feat: A and B together' },
        { hash: c.hash, action: 'fixup' },
        { hash: d.hash, action: 'reword', message: 'feat: D (renamed)' }
      ]
    });
    const subjects = execGitSync(repoDir, ['log', '--format=%s', `${rootHash}..HEAD`]).trim().split(/\r?\n/);
    assert.deepEqual(subjects, ['feat: D (renamed)', 'feat: A and B together']);
    for (const f of ['a.txt', 'b.txt', 'c.txt', 'd.txt']) assert.ok(fs.existsSync(path.join(repoDir, f)), `${f} is kept`);
  });

  it('Feature 4 & 7: manages Git worktrees (add / list / remove) and Command Palette refs & checkout', async () => {
    const repoDir = path.join(tmpRoot, 'repo-worktree');
    const wtDir = path.join(tmpRoot, 'repo-worktree-wt');
    fs.mkdirSync(repoDir, { recursive: true });
    execGitSync(repoDir, ['init', '-b', 'main']);
    execGitSync(repoDir, ['config', 'user.name', 'Andy']);
    execGitSync(repoDir, ['config', 'user.email', 'andy@example.com']);

    fs.writeFileSync(path.join(repoDir, 'index.ts'), 'export default 1;\n');
    execGitSync(repoDir, ['add', '.']);
    execGitSync(repoDir, ['commit', '-m', 'feat: init']);
    execGitSync(repoDir, ['tag', 'v1.0.0']);
    execGitSync(repoDir, ['branch', 'develop']);

    const { root: repo } = await rpc.call('repos:add', { path: repoDir });

    const added = await rpc.call('worktree:add', {
      repo,
      targetPath: wtDir,
      branch: 'wt-hotfix',
      createBranch: true
    });
    assert.ok(added.worktrees.length >= 2);
    assert.ok(added.worktrees.some((w: any) => w.branch === 'wt-hotfix'));

    const removed = await rpc.call('worktree:remove', { repo, path: added.root, force: true });
    assert.equal(removed.worktrees.some((w: any) => w.branch === 'wt-hotfix'), false);

    // Command palette refs + checkout
    const refs = await rpc.call('git:refs', { repo });
    assert.ok(refs.branches.includes('main'));
    assert.ok(refs.branches.includes('develop'));
    assert.ok(refs.tags.includes('v1.0.0'));

    await rpc.call('git:checkout', { repo, ref: 'develop' });
    const currentBranch = execGitSync(repoDir, ['branch', '--show-current']).trim();
    assert.equal(currentBranch, 'develop');
  });

  it('Feature 5: computes multi-repo quick status badges (ahead/behind/dirty) and batch fetches all repos', async () => {
    const bareRemote = path.join(tmpRoot, 'bare-origin.git');
    const cloneA = path.join(tmpRoot, 'clone-a');
    const cloneB = path.join(tmpRoot, 'clone-b');
    fs.mkdirSync(bareRemote, { recursive: true });
    execGitSync(bareRemote, ['init', '--bare', '-b', 'main']);

    execGitSync(tmpRoot, ['clone', bareRemote, cloneA]);
    execGitSync(cloneA, ['config', 'user.name', 'Andy']);
    execGitSync(cloneA, ['config', 'user.email', 'andy@example.com']);
    fs.writeFileSync(path.join(cloneA, 'readme.md'), '# Hello\n');
    execGitSync(cloneA, ['add', '.']);
    execGitSync(cloneA, ['commit', '-m', 'chore: init']);
    execGitSync(cloneA, ['push', '-u', 'origin', 'main']);

    execGitSync(tmpRoot, ['clone', bareRemote, cloneB]);
    execGitSync(cloneB, ['config', 'user.name', 'Andy']);
    execGitSync(cloneB, ['config', 'user.email', 'andy@example.com']);

    // Advance origin from cloneA so cloneB will be behind by 1 after fetchAll
    fs.writeFileSync(path.join(cloneA, 'readme.md'), '# Hello v2\n');
    execGitSync(cloneA, ['commit', '-am', 'feat: update readme']);
    execGitSync(cloneA, ['push']);

    // Dirty cloneB working tree
    fs.writeFileSync(path.join(cloneB, 'dirty.txt'), 'uncommitted\n');

    const { root: repoB } = await rpc.call('repos:add', { path: cloneB });
    const fetchSummary = await rpc.call('repos:fetchAll');
    assert.ok(fetchSummary.fetched >= 1);

    const quick = await rpc.call('repos:quickStatuses', { repos: [repoB] });
    const statusB = quick.statuses[repoB];
    assert.ok(statusB);
    assert.equal(statusB.branch, 'main');
    assert.equal(statusB.behind, 1);
    assert.equal(statusB.unstagedCount, 1);
  });

  it('Feature 6: parses hosting URLs, lists PRs with CI status, drafts PR with AI, and creates PR via API', async () => {
    const ghScp = parseRemoteHostingUrl('git@github.com:aimuch/GitMap.git');
    assert.equal(ghScp?.provider, 'github');
    assert.equal(ghScp?.owner, 'aimuch');
    assert.equal(ghScp?.repoName, 'GitMap');

    const glSubgroup = parseRemoteHostingUrl('https://gitlab.com/org/platform/core-service.git');
    assert.equal(glSubgroup?.provider, 'gitlab');
    assert.equal(glSubgroup?.owner, 'org/platform');
    assert.equal(glSubgroup?.repoName, 'core-service');

    const giteaUrl = parseRemoteHostingUrl('https://codeberg.org/dev/tool.git');
    assert.equal(giteaUrl?.provider, 'gitea');

    // End-to-end PR API test against local mock GitHub Enterprise server
    const repoDir = path.join(tmpRoot, 'repo-pr');
    fs.mkdirSync(repoDir, { recursive: true });
    execGitSync(repoDir, ['init', '-b', 'main']);
    execGitSync(repoDir, ['config', 'user.name', 'Andy']);
    execGitSync(repoDir, ['config', 'user.email', 'andy@example.com']);
    fs.writeFileSync(path.join(repoDir, 'app.ts'), 'export const v = 1;\n');
    execGitSync(repoDir, ['add', '.']);
    execGitSync(repoDir, ['commit', '-m', 'feat: base']);

    execGitSync(repoDir, ['checkout', '-b', 'feat/tunnel']);
    fs.writeFileSync(path.join(repoDir, 'app.ts'), 'export const v = 2;\n');
    execGitSync(repoDir, ['commit', '-am', 'feat: bump version to 2']);
    execGitSync(repoDir, ['remote', 'add', 'origin', `http://127.0.0.1:${mockHostPort}/acme/widget.git`]);

    const { root: repo } = await rpc.call('repos:add', { path: repoDir });
    const hostKey = `127.0.0.1:${mockHostPort}`;
    const tokRes = await rpc.call('hosting:setToken', { host: hostKey, token: 'ghp_mockSecretToken' });
    assert.equal(tokRes.hasToken, true);

    const listed = await rpc.call('hosting:listPrs', { repo, provider: 'github' });
    assert.equal(listed.error, null);
    assert.equal(listed.items.length, 1);
    assert.equal(listed.items[0].number, 42);
    assert.equal(listed.items[0].ciStatus, 'success');

    const draft = await rpc.call('hosting:generatePrDraft', {
      repo,
      baseBranch: 'main',
      headBranch: 'feat/tunnel'
    });
    assert.equal(draft.title, 'feat: add interactive workflow suite');
    assert.ok(draft.body.includes('3-way conflict resolution'));

    const created = await rpc.call('hosting:createPr', {
      repo,
      provider: 'github',
      baseBranch: 'main',
      headBranch: 'feat/tunnel',
      title: draft.title,
      body: draft.body,
      draft: false
    });
    assert.equal(created.createdViaApi, true);
    assert.ok(created.webUrl.endsWith('/acme/widget/pull/99'));
    assert.equal(createdPrPayloads.length, 1);
    assert.equal(createdPrPayloads[0].auth, 'Bearer ghp_mockSecretToken');
  });

  it('Feature 8 & 9: performs AI code review, generates AI release notes, and runs natural-language commit search', async () => {
    const repoDir = path.join(tmpRoot, 'repo-ai');
    fs.mkdirSync(repoDir, { recursive: true });
    execGitSync(repoDir, ['init', '-b', 'main']);
    execGitSync(repoDir, ['config', 'user.name', 'Andy']);
    execGitSync(repoDir, ['config', 'user.email', 'andy@example.com']);

    fs.writeFileSync(path.join(repoDir, 'calc.ts'), 'export const div = (a: number, b: number) => a / b;\n');
    execGitSync(repoDir, ['add', '.']);
    execGitSync(repoDir, ['commit', '-m', 'feat: add greeting and division helper']);
    execGitSync(repoDir, ['tag', 'v0.1.0']);

    fs.writeFileSync(path.join(repoDir, 'calc.ts'), 'export const div = (a: number, b: number) => {\n  return a / b;\n};\n');
    execGitSync(repoDir, ['commit', '-am', 'fix: format division helper']);

    // Uncommitted edit for pre-commit review
    fs.appendFileSync(path.join(repoDir, 'calc.ts'), 'export const ratio = (x: number) => div(x, 0);\n');

    const { root: repo } = await rpc.call('repos:add', { path: repoDir });

    const review = await rpc.call('ai:reviewChanges', { repo, scope: 'all', lang: 'en' });
    assert.equal(review.findings.length, 1);
    assert.equal(review.findings[0].severity, 'high');
    assert.equal(review.findings[0].file, 'calc.ts');

    const notes = await rpc.call('ai:releaseNotes', { repo, fromRef: 'v0.1.0', toRef: 'HEAD', lang: 'en' });
    assert.equal(notes.commitCount, 1);
    assert.equal(notes.usedAi, true);
    assert.ok(notes.markdown.includes('## Highlights'));

    const nlRes = await rpc.call('git:nlSearch', { repo, query: 'commits by Andy about greeting' });
    assert.equal(nlRes.usedAi, true);
    assert.ok(nlRes.filterSummary.includes('author="Andy"'));
    assert.ok(nlRes.commits.length >= 1);
    assert.ok(nlRes.commits[0].subject.includes('greeting'));
  });

  it('Feature 10: edits remote files over SFTP (file:write) and forwards TCP traffic over SSH local port tunnel (-L)', async () => {
    await rpc.call('ssh:saveHost', {
      id: 'tunnel-box',
      name: 'Tunnel Box',
      host: '127.0.0.1',
      port: sshPort,
      user: 'gituser',
      authType: 'password',
      password: 'secret123'
    });
    await rpc.call('ssh:connect', { hostId: 'tunnel-box' });

    // Remote standalone file read + inline edit write
    const remoteConfigFile = path.join(remoteHome, 'service.env');
    fs.writeFileSync(remoteConfigFile, 'PORT=3000\n');
    const remoteUri = formatRemoteRepoUri('tunnel-box', remoteConfigFile);

    const readBefore = await rpc.call('file:read', { filePath: remoteUri });
    assert.equal(readBefore.content, 'PORT=3000\n');
    assert.equal(readBefore.sourceUri, remoteUri);

    await rpc.call('file:write', { filePath: remoteUri, content: 'PORT=8080\nMODE=production\n' });
    assert.equal(fs.readFileSync(remoteConfigFile, 'utf8'), 'PORT=8080\nMODE=production\n');

    // Start SSH local port forward (-L 127.0.0.1:0 -> 127.0.0.1:remoteTargetPort)
    const started = await rpc.call('ssh:startTunnel', {
      hostId: 'tunnel-box',
      localPort: 0,
      remoteHost: '127.0.0.1',
      remotePort: remoteTargetPort,
      label: 'Internal API'
    });
    assert.ok(started.tunnel.localPort > 0);

    const listed = await rpc.call('ssh:listTunnels', { hostId: 'tunnel-box' });
    assert.equal(listed.tunnels.length, 1);

    // Send real HTTP request through the local SSH tunnel port!
    const tunneledJson = await new Promise<any>((resolve, reject) => {
      http
        .get(`http://127.0.0.1:${started.tunnel.localPort}/health`, (res) => {
          let raw = '';
          res.on('data', (c) => (raw += c));
          res.on('end', () => {
            try {
              resolve(JSON.parse(raw));
            } catch (e) {
              reject(e);
            }
          });
        })
        .on('error', reject);
    });
    assert.deepEqual(tunneledJson, { ok: true, service: 'remote-internal-api' });

    const stopped = await rpc.call('ssh:stopTunnel', { id: started.tunnel.id });
    assert.equal(stopped.stopped, true);
    assert.equal(stopped.tunnels.length, 0);
  });

  it('Feature 11: lists Git reflog timeline and finds culprit commit via visual Git bisect wizard', async () => {
    const repoDir = path.join(tmpRoot, 'repo-bisect');
    fs.mkdirSync(repoDir, { recursive: true });
    execGitSync(repoDir, ['init', '-b', 'main']);
    execGitSync(repoDir, ['config', 'user.name', 'Andy']);
    execGitSync(repoDir, ['config', 'user.email', 'andy@example.com']);

    const commits: string[] = [];
    for (let i = 1; i <= 4; i++) {
      // Commit #3 introduces the bug (val=-999)
      const val = i >= 3 ? -999 : i;
      fs.writeFileSync(path.join(repoDir, 'metric.txt'), `val=${val};step=${i}\n`);
      execGitSync(repoDir, ['add', '.']);
      execGitSync(repoDir, ['commit', '-m', `commit step ${i}`]);
      commits.push(execGitSync(repoDir, ['rev-parse', 'HEAD']).trim());
    }

    const { root: repo } = await rpc.call('repos:add', { path: repoDir });

    const reflog = await rpc.call('reflog:list', { repo, limit: 20 });
    assert.ok(reflog.entries.length >= 4);
    assert.equal(reflog.entries[0].selector, 'HEAD@{0}');

    // Start bisect: HEAD (commit #4) is bad, commit #1 is good -> culprit must be commit #3 (commits[2])
    let step = await rpc.call('bisect:start', {
      repo,
      badRef: commits[3],
      goodRef: commits[0]
    });
    assert.equal(step.status.active, true);

    for (let guard = 0; guard < 5 && !step.culpritHash; guard++) {
      const content = fs.readFileSync(path.join(repoDir, 'metric.txt'), 'utf8');
      const verdict = content.includes('val=-999') ? 'bad' : 'good';
      step = await rpc.call('bisect:step', { repo, verdict });
    }

    assert.equal(step.culpritHash, commits[2]);

    const reset = await rpc.call('bisect:reset', { repo });
    assert.equal(reset.status.active, false);
  });

  it('Repository File Explorer: creates, renames, imports, uploads, downloads, and deletes files & folders locally and over SSH', async () => {
    const repoDir = path.join(tmpRoot, 'repo-explorer');
    const externalSrc = path.join(tmpRoot, 'external-assets');
    fs.mkdirSync(repoDir, { recursive: true });
    fs.mkdirSync(path.join(externalSrc, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(externalSrc, 'docs', 'guide.md'), '# Guide\n');

    // Local CRUD + import + web upload/download
    const mk = await rpc.call('local:mkdir', { path: repoDir, name: 'src/utils' });
    assert.equal(fs.existsSync(mk.path), true);

    const cf = await rpc.call('local:createFile', { path: repoDir, name: 'src/utils/math.ts', content: 'export const PI = 3.14;\n' });
    assert.equal(fs.readFileSync(cf.path, 'utf8'), 'export const PI = 3.14;\n');

    const rn = await rpc.call('local:rename', { path: cf.path, name: 'constants.ts' });
    assert.equal(fs.existsSync(rn.path), true);

    const imp = await rpc.call('local:importPaths', { destDir: repoDir, sources: [path.join(externalSrc, 'docs')] });
    assert.equal(imp.copied.length, 1);
    assert.equal(fs.existsSync(path.join(repoDir, 'docs', 'guide.md')), true);

    const upResp = await fetch(`${serverUrl}/api/local/web-upload?destDir=${encodeURIComponent(repoDir)}&name=uploaded.txt`, {
      method: 'POST',
      body: 'hello web upload'
    });
    assert.equal(upResp.status, 200);
    assert.equal(fs.readFileSync(path.join(repoDir, 'uploaded.txt'), 'utf8'), 'hello web upload');

    const dlResp = await fetch(`${serverUrl}/api/local/web-download?path=${encodeURIComponent(path.join(repoDir, 'uploaded.txt'))}`);
    assert.equal(dlResp.status, 200);
    assert.equal(await dlResp.text(), 'hello web upload');

    const del = await rpc.call('local:delete', { paths: [path.join(repoDir, 'docs'), path.join(repoDir, 'uploaded.txt')] });
    assert.equal(del.deleted, 2);
    assert.equal(del.trashed, false, 'browser mode has no Trash: permanent');
    assert.equal(fs.existsSync(path.join(repoDir, 'docs')), false);

    // Desktop app: deletes go through the Trash hook (recoverable) instead of rm
    const trashed: string[] = [];
    const trashTarget = path.join(repoDir, 'to-trash.txt');
    fs.writeFileSync(trashTarget, 'keep me recoverable');
    appServer!.setDesktopHooks({ trashItem: async (p: string) => { trashed.push(p); } });
    try {
      const delT = await rpc.call('local:delete', { paths: [trashTarget] });
      assert.equal(delT.trashed, true);
      assert.deepEqual(trashed, [trashTarget], 'the item was handed to the system Trash');
    } finally {
      appServer!.setDesktopHooks({});
      fs.rmSync(trashTarget, { force: true });
    }

    // Remote SSH createFile + nested mkdir
    const sshMk = await rpc.call('ssh:mkdir', { hostId: 'tunnel-box', path: remoteHome, name: 'remote-repo/pkg' });
    assert.equal(fs.existsSync(sshMk.path), true);

    const sshCf = await rpc.call('ssh:createFile', {
      hostId: 'tunnel-box',
      path: remoteHome,
      name: 'remote-repo/pkg/main.py',
      content: 'print("ok")\n'
    });
    assert.equal(fs.readFileSync(sshCf.path, 'utf8'), 'print("ok")\n');
  });
});
