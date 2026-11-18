import assert from 'node:assert/strict';
import * as cp from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { Server as SshServer, utils as sshUtils } from 'ssh2';
import { WebSocket } from 'ws';
import { formatRemoteRepoUri, isRemoteRepo, joinRepoPath, parseRemoteRepo } from '../remote/repoTransport';
import { parseUserSshConfig } from '../remote/sshConfigParser';
import { readSftpHandleBounded } from '../remote/sshManager';
import { GitMapServer } from '../server/appServer';
import { __test as launcherTest, buildSshCommandLine } from '../server/launchers';
import { CommitOrdering, GitFileStatus } from '../types';
import { FsmTraceRegistry, StateMachine } from '../utils/fsm';

const STATUS_CODE = sshUtils.sftp.STATUS_CODE;
const OPEN_MODE = sshUtils.sftp.OPEN_MODE;

function startTestSshServer(homeRoot: string, fixedPort: number = 0): Promise<{ server: SshServer; port: number; clientKeyPath: string }> {
  const hostKey = sshUtils.generateKeyPairSync('ed25519');
  const clientKey = sshUtils.generateKeyPairSync('ed25519');
  const clientKeyPath = path.join(homeRoot, 'test_id_ed25519');
  fs.writeFileSync(clientKeyPath, clientKey.private, { mode: 0o600 });

  const server = new SshServer({ hostKeys: [hostKey.private] }, (client) => {
    client.on('error', () => {});
    client.on('authentication', (ctx) => {
      if (ctx.method === 'password' && ctx.username === 'gituser' && ctx.password === 'secret123') {
        return ctx.accept();
      }
      if (ctx.method === 'publickey' && ctx.username === 'gituser') {
        return ctx.accept();
      }
      ctx.reject(['password', 'publickey']);
    });

    client.on('ready', () => {
      client.on('session', (accept) => {
        const session = accept();

        session.on('exec', (acceptExec, _rejectExec, info) => {
          const stream = acceptExec();
          const child = cp.spawn('/bin/sh', ['-c', info.command], {
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
          const openDirs = new Map<string, { items: fs.Dirent[]; sent: boolean; dirPath: string }>();
          const openFiles = new Map<string, { fd: number; flags: number }>();
          let handleSeq = 0;

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
            try {
              const real = fs.realpathSync(resolved);
              sftp.name(reqid, [{ filename: real, longname: real, attrs: {} as any }]);
            } catch (_) {
              sftp.name(reqid, [{ filename: resolved, longname: resolved, attrs: {} as any }]);
            }
          });

          sftp.on('STAT', (reqid, p) => {
            try {
              sftp.attrs(reqid, makeAttrs(fs.statSync(p)));
            } catch (_) {
              sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE);
            }
          });

          sftp.on('LSTAT', (reqid, p) => {
            try {
              sftp.attrs(reqid, makeAttrs(fs.lstatSync(p)));
            } catch (_) {
              sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE);
            }
          });

          sftp.on('OPENDIR', (reqid, dirPath) => {
            try {
              const items = fs.readdirSync(dirPath, { withFileTypes: true });
              const h = 'd' + (++handleSeq);
              openDirs.set(h, { items, sent: false, dirPath });
              sftp.handle(reqid, Buffer.from(h));
            } catch (_) {
              sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE);
            }
          });

          sftp.on('READDIR', (reqid, handle) => {
            const key = handle.toString();
            const d = openDirs.get(key);
            if (!d) return sftp.status(reqid, STATUS_CODE.FAILURE);
            if (d.sent) return sftp.status(reqid, STATUS_CODE.EOF);
            d.sent = true;
            const list = d.items.map((item) => {
              const full = path.join(d.dirPath, item.name);
              let st: fs.Stats;
              try {
                st = fs.lstatSync(full);
              } catch (_) {
                st = fs.statSync(d.dirPath);
              }
              return {
                filename: item.name,
                longname: item.name,
                attrs: makeAttrs(st)
              };
            });
            sftp.name(reqid, list);
          });

          sftp.on('OPEN', (reqid, filePath, flags) => {
            try {
              let fsFlags = 'r';
              if (flags & OPEN_MODE.WRITE) {
                fsFlags = flags & OPEN_MODE.TRUNC ? 'w' : flags & OPEN_MODE.CREAT ? 'w+' : 'r+';
              }
              const fd = fs.openSync(filePath, fsFlags);
              const h = 'f' + (++handleSeq);
              openFiles.set(h, { fd, flags });
              sftp.handle(reqid, Buffer.from(h));
            } catch (_) {
              sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE);
            }
          });

          sftp.on('READ', (reqid, handle, offset, length) => {
            const f = openFiles.get(handle.toString());
            if (!f) return sftp.status(reqid, STATUS_CODE.FAILURE);
            const buf = Buffer.alloc(length);
            const bytesRead = fs.readSync(f.fd, buf, 0, length, offset);
            if (bytesRead === 0) return sftp.status(reqid, STATUS_CODE.EOF);
            sftp.data(reqid, buf.subarray(0, bytesRead));
          });

          sftp.on('WRITE', (reqid, handle, offset, data) => {
            const f = openFiles.get(handle.toString());
            if (!f) return sftp.status(reqid, STATUS_CODE.FAILURE);
            fs.writeSync(f.fd, data, 0, data.length, offset);
            sftp.status(reqid, STATUS_CODE.OK);
          });

          sftp.on('MKDIR', (reqid, p) => {
            try {
              fs.mkdirSync(p);
              sftp.status(reqid, STATUS_CODE.OK);
            } catch (_) {
              sftp.status(reqid, STATUS_CODE.FAILURE);
            }
          });
          sftp.on('SETSTAT', (reqid) => sftp.status(reqid, STATUS_CODE.OK));
          sftp.on('FSETSTAT', (reqid) => sftp.status(reqid, STATUS_CODE.OK));
          sftp.on('FSTAT', (reqid, handle) => {
            const f = openFiles.get(handle.toString());
            if (!f) return sftp.status(reqid, STATUS_CODE.FAILURE);
            sftp.attrs(reqid, makeAttrs(fs.fstatSync(f.fd)));
          });
          sftp.on('REMOVE', (reqid, p) => {
            try {
              fs.unlinkSync(p);
              sftp.status(reqid, STATUS_CODE.OK);
            } catch (_) {
              sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE);
            }
          });

          sftp.on('CLOSE', (reqid, handle) => {
            const key = handle.toString();
            if (openDirs.has(key)) {
              openDirs.delete(key);
            } else if (openFiles.has(key)) {
              try {
                fs.closeSync(openFiles.get(key)!.fd);
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
    server.listen(fixedPort, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ server, port, clientKeyPath });
    });
  });
}

describe('GitMap Standalone & Remote-SSH Suite', () => {
  let tmpRoot: string;
  let remoteHome: string;
  let sampleRepoPath: string;
  let sshServer: SshServer | null = null;
  let sshPort = 0;
  let clientKeyPath = '';
  let appServer: GitMapServer | null = null;
  let serverUrl = '';

  before(async () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gitmap-test-'));
    remoteHome = path.join(tmpRoot, 'remote-home');
    const projectsDir = path.join(remoteHome, 'projects');
    sampleRepoPath = path.join(projectsDir, 'demo-repo');
    fs.mkdirSync(sampleRepoPath, { recursive: true });

    // Create a multi-commit Git repository inside remoteHome/projects/demo-repo
    const runGit = (args: string[]) =>
      cp.execFileSync('git', args, {
        cwd: sampleRepoPath,
        env: {
          ...process.env,
          GIT_AUTHOR_NAME: 'Andy',
          GIT_AUTHOR_EMAIL: 'andy@example.com',
          GIT_COMMITTER_NAME: 'Andy',
          GIT_COMMITTER_EMAIL: 'andy@example.com'
        }
      });

    runGit(['init', '-b', 'main']);
    runGit(['config', 'user.name', 'Andy']);
    runGit(['config', 'user.email', 'andy@example.com']);
    fs.writeFileSync(path.join(sampleRepoPath, 'hello.ts'), 'export function greet(name: string) {\n  return "Hello " + name;\n}\n');
    runGit(['add', '.']);
    runGit(['commit', '-m', 'feat: initial greeting module']);

    fs.writeFileSync(
      path.join(sampleRepoPath, 'hello.ts'),
      'export function greet(name: string) {\n  return `Hello, ${name}!`;\n}\n\nexport const VERSION = "1.0.0";\n'
    );
    runGit(['add', '.']);
    runGit(['commit', '-m', 'feat: template literal greeting and version']);
    runGit(['tag', 'v1.0.0']);

    const startedSsh = await startTestSshServer(remoteHome);
    sshServer = startedSsh.server;
    sshPort = startedSsh.port;
    clientKeyPath = startedSsh.clientKeyPath;

    appServer = new GitMapServer({
      port: 0,
      host: '127.0.0.1',
      dataDir: path.join(tmpRoot, 'app-data')
    });
    serverUrl = await appServer.start();
  });

  after(async () => {
    await appServer?.stop();
    if (sshServer && sshServer.address()) {
      await new Promise<void>((resolve) => sshServer!.close(() => resolve()));
    }
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('parses ~/.ssh/config with Include files, wildcards, and tokens accurately', () => {
    const sshDir = path.join(tmpRoot, 'ssh-cfg');
    const confD = path.join(sshDir, 'config.d');
    fs.mkdirSync(confD, { recursive: true });

    fs.writeFileSync(
      path.join(confD, 'work.conf'),
      `Host work-api\n  HostName 10.20.30.40\n  User deploy\n  Port 2222\n`
    );
    fs.writeFileSync(
      path.join(sshDir, 'config'),
      [
        'Include config.d/*.conf',
        'Host prod-box',
        '  HostName prod.example.com',
        '  User ubuntu',
        `  IdentityFile ${clientKeyPath}`,
        'Host *',
        '  User fallbackuser',
        '  Port 2200'
      ].join('\n')
    );

    const parsed = parseUserSshConfig(path.join(sshDir, 'config'));
    const work = parsed.find((h) => h.alias === 'work-api');
    const prod = parsed.find((h) => h.alias === 'prod-box');

    assert.ok(work, 'Included Host work-api should be parsed');
    assert.equal(work.hostName, '10.20.30.40');
    assert.equal(work.user, 'deploy');
    assert.equal(work.port, 2222);

    assert.ok(prod, 'Host prod-box should be parsed');
    assert.equal(prod.hostName, 'prod.example.com');
    assert.equal(prod.user, 'ubuntu');
    assert.equal(prod.port, 2200); // Inherited from Host *
    assert.ok(prod.identityFiles.includes(clientKeyPath));
  });

  it('formats and parses ssh:// repository URIs cleanly', () => {
    const uri = formatRemoteRepoUri('prod-server', '/home/ubuntu/my-repo/');
    assert.equal(uri, 'ssh://prod-server/home/ubuntu/my-repo');
    assert.equal(isRemoteRepo(uri), true);
    assert.deepEqual(parseRemoteRepo(uri), {
      hostId: 'prod-server',
      remotePath: '/home/ubuntu/my-repo'
    });
    assert.equal(joinRepoPath(uri, 'src/index.ts'), 'ssh://prod-server/home/ubuntu/my-repo/src/index.ts');
  });

  it('serves standalone App Shell HTML, Webview HTML, and bundled media assets', async () => {
    const indexRes = await fetch(serverUrl + '/');
    assert.equal(indexRes.status, 200);
    const indexHtml = await indexRes.text();
    assert.ok(indexHtml.includes('GitMap'));

    const wvRes = await fetch(serverUrl + '/webview/git-map');
    assert.equal(wvRes.status, 200);
    const wvHtml = await wvRes.text();
    assert.ok(wvHtml.includes('/webview-bridge.js'));

    const jsRes = await fetch(serverUrl + '/media/out.min.js');
    assert.equal(jsRes.status, 200);
    const cssRes = await fetch(serverUrl + '/media/out.min.css');
    assert.equal(cssRes.status, 200);

    for (const style of ['classic', 'metro', 'neon', 'compass', 'isometric', 'minimal']) {
      for (const variant of ['dark', 'light']) {
        const svgRes = await fetch(`${serverUrl}/resources/icons/${style}-${variant}.svg`);
        assert.equal(svgRes.status, 200);
        const pngRes = await fetch(`${serverUrl}/resources/icons/${style}-${variant}.png`);
        assert.equal(pngRes.status, 200);
      }
    }
  });

  it('connects via Remote-SSH, browses remote paths, scans remote repos, loads Git graph, diffs, blames historical commits, and stages/commits over SSH', { skip: process.platform === 'win32' }, async () => {
    const wsUrl = serverUrl.replace(/^http/, 'ws') + '/ws';
    const ws = new WebSocket(wsUrl);

    let reqSeq = 0;
    const pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>();

    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', reject);
    });

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'rpc:res' && pending.has(msg.reqId)) {
        const p = pending.get(msg.reqId)!;
        pending.delete(msg.reqId);
        if (msg.ok) p.resolve(msg.result);
        else p.reject(new Error(msg.error));
      }
    });

    const rpc = (method: string, params: any = {}) =>
      new Promise<any>((resolve, reject) => {
        const reqId = 'test-' + (++reqSeq);
        pending.set(reqId, { resolve, reject });
        ws.send(JSON.stringify({ type: 'rpc', reqId, method, params }));
      });

    try {
      // 1. Save SSH host profile pointing to our loopback SSHv2 server
      const saveRes = await rpc('ssh:saveHost', {
        id: 'loopback-ssh',
        name: 'Loopback SSH Server',
        host: '127.0.0.1',
        port: sshPort,
        user: 'gituser',
        authType: 'key',
        privateKeyPath: clientKeyPath,
        defaultPath: '~/projects'
      });
      assert.equal(saveRes.profile.id, 'loopback-ssh');

      // 2. Browse remote path ~/projects and verify demo-repo is detected as a Git repository on branch main!
      const browseRes = await rpc('ssh:browsePath', {
        hostId: 'loopback-ssh',
        path: '~/projects'
      });
      assert.equal(browseRes.currentPath, fs.realpathSync(path.join(remoteHome, 'projects')));
      const demoEntry = browseRes.entries.find((e: any) => e.name === 'demo-repo');
      assert.ok(demoEntry, 'demo-repo directory should appear in remote path browser');
      assert.equal(demoEntry.isDirectory, true);
      assert.equal(demoEntry.isGitRepo, true, 'demo-repo should be flagged as a Git repo');
      assert.equal(demoEntry.gitBranch, 'main', 'demo-repo checked-out branch should be main');

      // 3. Scan remote subfolders from ~ to discover nested Git repositories
      const scanRes = await rpc('ssh:scanRepos', {
        hostId: 'loopback-ssh',
        path: '~',
        maxDepth: 3
      });
      assert.equal(scanRes.repos.length, 1);
      assert.equal(scanRes.repos[0].name, 'demo-repo');
      assert.equal(scanRes.repos[0].branch, 'main');

      // 4. Register & open the remote repository over SSH
      const openRes = await rpc('ssh:openRemoteRepo', {
        hostId: 'loopback-ssh',
        remotePath: demoEntry.path
      });
      const remoteRepoUri: string = openRes.root;
      assert.ok(remoteRepoUri.startsWith('ssh://loopback-ssh/'));

      // 5. Query Git Graph data directly over SSH via DataSource
      const repoInfo = await appServer!.dataSource.getRepoInfo(remoteRepoUri, true, true, []);
      assert.equal(repoInfo.error, null);
      assert.equal(repoInfo.head, 'main');
      assert.ok(repoInfo.branches.includes('main'));

      const commitData = await appServer!.dataSource.getCommits(
        remoteRepoUri,
        null,
        50,
        true,
        true,
        false,
        false,
        CommitOrdering.Date,
        [],
        [],
        [],
        null,
        null,
        null
      );
      assert.equal(commitData.error, null);
      assert.equal(commitData.commits.length, 2);
      assert.equal(commitData.commits[0].message, 'feat: template literal greeting and version');
      assert.equal(commitData.commits[0].tags[0]?.name, 'v1.0.0');

      const latestHash = commitData.commits[0].hash;
      const parentHash = commitData.commits[1].hash;

      // 6. Compute Side-by-Side / Word-level Diff over SSH
      const diffRes = await rpc('diff:compute', {
        repo: remoteRepoUri,
        fromHash: parentHash,
        toHash: latestHash,
        oldFilePath: 'hello.ts',
        newFilePath: 'hello.ts',
        type: GitFileStatus.Modified
      });
      assert.equal(diffRes.error, null);
      assert.equal(diffRes.isBinary, false);
      assert.ok(diffRes.additions >= 2);
      assert.ok(diffRes.deletions >= 1);

      // 7. Read file + Git Blame over SSH (working tree + historical commit blame)
      const fileReadRes = await rpc('file:read', {
        repo: remoteRepoUri,
        filePath: 'hello.ts',
        commit: null,
        includeBlame: true
      });
      assert.equal(fileReadRes.error, null);
      assert.ok(fileReadRes.content.includes('VERSION = "1.0.0"'));
      assert.ok(fileReadRes.blame && fileReadRes.blame.lines.length >= 4);

      const histBlameRes = await rpc('file:blame', {
        repo: remoteRepoUri,
        filePath: 'hello.ts',
        commit: parentHash
      });
      assert.ok(histBlameRes.blame);
      assert.equal(histBlameRes.blame.lines.length, 3, 'historical blame at parentHash must match the 3-line initial revision');

      // 8. Perform Git write actions (Create Branch + Working Tree Stage & Commit) over SSH and verify
      const branchErrors = await appServer!.dataSource.createBranch(remoteRepoUri, 'feature/remote-test', latestHash, true, false);
      assert.equal(branchErrors[0], null);
      const updatedInfo = await appServer!.dataSource.getRepoInfo(remoteRepoUri, true, true, []);
      assert.equal(updatedInfo.head, 'feature/remote-test');

      fs.writeFileSync(path.join(sampleRepoPath, 'notes.md'), '# Remote SCM Test\n');
      const st1 = await rpc('scm:status', { repo: remoteRepoUri });
      assert.equal(st1.branch, 'feature/remote-test');
      assert.equal(st1.unstaged.some((f: any) => f.path === 'notes.md'), true);

      const st2 = await rpc('scm:stage', { repo: remoteRepoUri, paths: ['notes.md'] });
      assert.equal(st2.staged.some((f: any) => f.path === 'notes.md'), true);

      const st3 = await rpc('scm:unstage', { repo: remoteRepoUri, paths: ['notes.md'] });
      assert.equal(st3.staged.length, 0);
      assert.equal(st3.unstaged.some((f: any) => f.path === 'notes.md'), true);

      await rpc('scm:stage', { repo: remoteRepoUri, all: true });
      const commitRes = await rpc('scm:commit', { repo: remoteRepoUri, message: 'docs: add notes via standalone SCM' });
      assert.equal(commitRes.ok, true);
      assert.equal(commitRes.staged.length, 0);
      assert.equal(commitRes.unstaged.length, 0);
    } finally {
      ws.close();
    }
  });

  it('rejects WebSocket connections from other origins and foreign Host names', async () => {
    const wsUrl = serverUrl.replace('http://', 'ws://') + '/ws';
    const tryConnect = (headers: { [k: string]: string }) =>
      new Promise<boolean>((resolve) => {
        const ws = new WebSocket(wsUrl, { headers });
        ws.on('open', () => {
          ws.close();
          resolve(true);
        });
        ws.on('error', () => resolve(false));
        ws.on('unexpected-response', () => resolve(false));
      });
    const host = new URL(serverUrl).host;
    assert.equal(await tryConnect({ Origin: 'http://' + host }), true, 'same-origin page may connect');
    assert.equal(await tryConnect({ Origin: 'https://evil.example' }), false, 'cross-origin page must be rejected');
    assert.equal(await tryConnect({ Host: 'evil.example:' + new URL(serverUrl).port, Origin: 'http://evil.example:' + new URL(serverUrl).port }), false, 'DNS-rebound host must be rejected');
  });

  it('builds external terminal / editor launch commands with safely quoted values', () => {
    const profile: any = { id: 'prod', name: 'prod', host: '10.0.0.5', port: 2222, user: 'deploy', authType: 'auto', source: 'saved', proxyJump: 'bastion' };
    const line = buildSshCommandLine(profile, "/srv/it's here");
    assert.ok(line.startsWith("ssh '-t' '-p' '2222' '-J' 'bastion' 'deploy@10.0.0.5' "), line);
    assert.ok(line.includes(`'\\''`), 'single quotes in the path are escaped');
    const cfgProfile: any = { id: 'work-api', name: 'work-api', host: 'h', port: 22, user: 'u', authType: 'auto', source: 'ssh-config' };
    assert.deepEqual(launcherTest.sshArgs(cfgProfile), ['-t', 'work-api'], 'ssh-config hosts use their alias');
    const filled = launcherTest.fillTemplate('open -a Hyper {path} && echo {host}', { isRemote: false, path: '/tmp/a b;rm -rf /', profile: null });
    assert.equal(filled, "open -a Hyper '/tmp/a b;rm -rf /' && echo ''");
  });

  it('uploads & downloads files and folders over SFTP with undo / restore and batch duplicate-name protection', { skip: process.platform === 'win32' }, async () => {
    const { transferManager } = await import('../remote/transferManager');
    const { sshManager } = await import('../remote/sshManager');
    await sshManager.saveHost({ id: 'xfer-ssh', name: 'xfer', host: '127.0.0.1', port: sshPort, user: 'gituser', authType: 'key', privateKeyPath: clientKeyPath });
    const waitFor = async (id: string, states: string[]) => {
      for (let i = 0; i < 200; i++) {
        const t = transferManager.list().find((x) => x.id === id)!;
        if (states.includes(t.state)) return t;
        await new Promise((r) => setTimeout(r, 25));
      }
      throw new Error('Timed out waiting for transfer ' + id);
    };

    // Upload a local folder (twice: the second one must get a " (1)" suffix)
    const localSrc = path.join(tmpRoot, 'upload-src', 'site');
    fs.mkdirSync(path.join(localSrc, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(localSrc, 'index.html'), '<h1>hi</h1>');
    fs.writeFileSync(path.join(localSrc, 'assets', 'data.bin'), Buffer.alloc(300000, 7));
    const remoteDest = path.join(remoteHome, 'uploads');
    fs.mkdirSync(remoteDest, { recursive: true });

    const up1 = transferManager.start('upload', 'xfer-ssh', [localSrc], remoteDest);
    const done1 = await waitFor(up1.id, ['completed', 'failed']);
    assert.equal(done1.state, 'completed', String(done1.error));
    assert.equal(done1.totalFiles, 2);
    assert.deepEqual(fs.readFileSync(path.join(remoteDest, 'site', 'assets', 'data.bin')), Buffer.alloc(300000, 7));

    const up2 = transferManager.start('upload', 'xfer-ssh', [localSrc], remoteDest);
    assert.equal((await waitFor(up2.id, ['completed', 'failed'])).state, 'completed');
    assert.ok(fs.existsSync(path.join(remoteDest, 'site (1)', 'index.html')), 'existing folder is not overwritten');

    // Batch upload of two files sharing the exact same basename must preserve both without overwriting
    const dupA = path.join(tmpRoot, 'upload-src', 'a', 'dup.txt');
    const dupB = path.join(tmpRoot, 'upload-src', 'b', 'dup.txt');
    fs.mkdirSync(path.dirname(dupA), { recursive: true });
    fs.mkdirSync(path.dirname(dupB), { recursive: true });
    fs.writeFileSync(dupA, 'alpha');
    fs.writeFileSync(dupB, 'bravo');
    const upDup = transferManager.start('upload', 'xfer-ssh', [dupA, dupB], remoteDest);
    assert.equal((await waitFor(upDup.id, ['completed', 'failed'])).state, 'completed');
    assert.equal(fs.readFileSync(path.join(remoteDest, 'dup.txt'), 'utf8'), 'alpha');
    assert.equal(fs.readFileSync(path.join(remoteDest, 'dup (1).txt'), 'utf8'), 'bravo');

    // Undo moves the upload into the remote trash; restore moves it back
    await transferManager.undo(up1.id);
    assert.equal(fs.existsSync(path.join(remoteDest, 'site')), false);
    assert.ok(fs.existsSync(path.join(remoteHome, '.gitmap-trash', up1.id, 'site', 'index.html')));
    await transferManager.restore(up1.id);
    assert.ok(fs.existsSync(path.join(remoteDest, 'site', 'index.html')));

    // Download the folder back and compare
    const localDest = path.join(tmpRoot, 'downloads');
    const down = transferManager.start('download', 'xfer-ssh', [path.join(remoteDest, 'site')], localDest);
    assert.equal((await waitFor(down.id, ['completed', 'failed'])).state, 'completed');
    assert.deepEqual(fs.readFileSync(path.join(localDest, 'site', 'assets', 'data.bin')), Buffer.alloc(300000, 7));

    // Undo a download (moved to GitMap's local trash), then remove the record (empties its trash)
    await transferManager.undo(down.id);
    assert.equal(fs.existsSync(path.join(localDest, 'site')), false);
    await transferManager.remove(down.id);
    assert.equal(transferManager.list().some((t) => t.id === down.id), false);
  });

  it('enforces launch token / HttpOnly session cookie auth and rejects malformed URLs gracefully', async () => {
    const authServer = new GitMapServer({
      port: 0,
      host: '127.0.0.1',
      dataDir: path.join(tmpRoot, 'auth-app-data'),
      requireAuth: true
    });
    const baseUrl = await authServer.start();
    try {
      // Malformed percent-encoding must return 400 rather than throwing an uncaught URIError
      const badRes = await fetch(baseUrl + '/%E0%A4%A');
      assert.equal(badRes.status, 400);

      // Health endpoint stays reachable, but shell & WS require auth
      assert.equal((await fetch(baseUrl + '/api/health')).status, 200);
      assert.equal((await fetch(baseUrl + '/')).status, 401);

      const unauthWsOk = await new Promise<boolean>((resolve) => {
        const ws = new WebSocket(baseUrl.replace('http://', 'ws://') + '/ws');
        ws.on('open', () => { ws.close(); resolve(true); });
        ws.on('error', () => resolve(false));
        ws.on('unexpected-response', () => resolve(false));
      });
      assert.equal(unauthWsOk, false, 'unauthenticated WebSocket must be rejected');

      // Exchange launch URL ?token=... into HttpOnly session cookie
      const redirectRes = await fetch(authServer.getAuthUrl(), { redirect: 'manual' });
      assert.equal(redirectRes.status, 302);
      const setCookie = redirectRes.headers.get('set-cookie') || '';
      assert.match(setCookie, /gitmap_session=/);
      assert.match(setCookie, /HttpOnly/i);
      const cookiePair = setCookie.split(';')[0];

      const authedIndex = await fetch(baseUrl + '/', { headers: { Cookie: cookiePair } });
      assert.equal(authedIndex.status, 200);
      assert.ok((authedIndex.headers.get('content-security-policy') || '').includes("script-src 'self'"));

      const authedWsOk = await new Promise<boolean>((resolve) => {
        const ws = new WebSocket(baseUrl.replace('http://', 'ws://') + '/ws', { headers: { Cookie: cookiePair } });
        ws.on('open', () => { ws.close(); resolve(true); });
        ws.on('error', () => resolve(false));
        ws.on('unexpected-response', () => resolve(false));
      });
      assert.equal(authedWsOk, true, 'authenticated session cookie must allow WebSocket connection');
    } finally {
      await authServer.stop();
    }
  });

  it('records TOFU host key in known_hosts and blocks Man-in-the-Middle host key changes', { skip: process.platform === 'win32' }, async () => {
    const { sshManager } = await import('../remote/sshManager');
    // Restore sshManager dataDir after authServer test above touched singleton
    const tofuDir = path.join(tmpRoot, 'tofu-data');
    fs.mkdirSync(tofuDir, { recursive: true });
    sshManager.init(tofuDir, { get: async () => undefined, store: async () => {}, delete: async () => {}, onDidChange: (() => ({ dispose() {} })) as any });

    const first = await startTestSshServer(remoteHome, 0);
    try {
      await sshManager.saveHost({
        id: 'tofu-host',
        name: 'tofu-host',
        host: '127.0.0.1',
        port: first.port,
        user: 'gituser',
        authType: 'key',
        privateKeyPath: first.clientKeyPath
      });
      await sshManager.ensureConnected('tofu-host');
    } finally {
      sshManager.disconnect('tofu-host');
      await new Promise<void>((resolve) => first.server.close(() => resolve()));
    }

    // Start a second server on the exact same port with a freshly generated (different) ed25519 host key
    const impostor = await startTestSshServer(remoteHome, first.port);
    try {
      await assert.rejects(
        () => sshManager.ensureConnected('tofu-host'),
        /REMOTE HOST IDENTIFICATION HAS CHANGED/
      );
    } finally {
      sshManager.disconnect('tofu-host');
      await new Promise<void>((resolve) => impostor.server.close(() => resolve()));
    }
  });

  it('stores GitMap-only aliases & tags for SSH hosts without changing their ids', async () => {
    const { sshManager, normaliseTags } = await import('../remote/sshManager');
    assert.deepEqual(normaliseTags(' prod, #GPU，prod  上海 '), ['prod', 'GPU', '上海']);
    await sshManager.saveHost({ id: 'meta-ssh', name: 'meta-ssh', host: '127.0.0.1', port: sshPort, user: 'gituser' });
    await sshManager.updateHostMeta('meta-ssh', '  生产 API  ', ['prod', 'Prod', 'api']);
    const host = sshManager.listHosts().find((h) => h.id === 'meta-ssh')!;
    assert.equal(host.alias, '生产 API');
    assert.deepEqual(host.tags, ['prod', 'api']);
    assert.equal(host.name, 'meta-ssh', 'the saved name / id is unchanged');
    assert.ok(sshManager.listTags().includes('api'));
    await sshManager.updateHostMeta('meta-ssh', '', []);
    assert.equal(sshManager.listHosts().find((h) => h.id === 'meta-ssh')!.alias, undefined);
    await sshManager.removeHost('meta-ssh');
  });

  it('exposes split-workspace DOM stage, expandable folder tree controls, and multi-level subtree browsing', async () => {
    const { getConfig } = await import('../config');
    assert.equal(getConfig().rowActions.position, 'Pointer', 'commit row floating bar must follow mouse pointer by default');

    const html = fs.readFileSync(path.join(process.cwd(), 'public', 'index.html'), 'utf8');
    assert.ok(html.includes('id="coreSplitStage"'));
    assert.ok(html.includes('id="wsLayoutControls"'));
    assert.ok(html.includes('data-ws-layout="split-lr"'));
    assert.ok(html.includes('data-ws-layout="split-tb"'));
    assert.ok(html.includes('id="workspaceSplitResizer"'));
    assert.ok(html.includes('id="repoFilesSplitBody"'));
    assert.ok(html.includes('id="repoFilesPreviewPane"'));
    assert.ok(html.includes('id="tabContextMenu"'));
    assert.ok(html.includes('id="wsDropOverlay"'));

    const iconsJs = fs.readFileSync(path.join(process.cwd(), 'public', 'icons.js'), 'utf8');
    for (const iconKey of ['chevronRight', 'expandAll', 'collapseAll', 'layoutTabs', 'splitHorizontal', 'splitVertical', 'swapPanes', 'dockLeft', 'dockRight', 'dockTop', 'dockBottom']) {
      assert.ok(iconsJs.includes(iconKey + ':'), `icons.js must define ${iconKey}`);
    }

    const appJs = fs.readFileSync(path.join(process.cwd(), 'public', 'app.js'), 'utf8');
    assert.ok(appJs.includes('setWorkspaceLayout'));
    assert.ok(appJs.includes('swapWorkspaceSplitPanes'));
    assert.ok(appJs.includes('placeTabInSplitPane'));
    assert.ok(appJs.includes('moveTabOrder'));
    assert.ok(appJs.includes('openTabContextMenu'));
    assert.ok(appJs.includes('FLOAT_APPROACH_PAD'));
    assert.ok(appJs.includes('toggleExpandDir'));
    assert.ok(appJs.includes('state.initLoaded = true'));

    const mainTs = fs.readFileSync(path.join(process.cwd(), 'src', 'desktop', 'main.ts'), 'utf8');
    assert.ok(mainTs.includes('setIconForFileOptions'), 'macOS .app bundle icon must be persisted via NSWorkspace.setIcon');
    assert.ok(mainTs.includes('pendingBundleIconTask'), 'before-quit must await pending bundle icon persistence');

    // Verify nested subtree directory & file creation + independent subtree listing without mutating parent listing
    const treeRoot = path.join(tmpRoot, 'tree-test');
    fs.mkdirSync(path.join(treeRoot, 'src', 'components'), { recursive: true });
    fs.writeFileSync(path.join(treeRoot, 'src', 'components', 'Button.tsx'), 'export const Button = () => null;\n');
    const wsUrl = serverUrl.replace(/^http/, 'ws') + '/ws';
    const ws = new WebSocket(wsUrl);
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', reject);
    });
    const callRpc = (method: string, params: any) =>
      new Promise<any>((resolve, reject) => {
        const reqId = 'tree-' + Math.random().toString(36).slice(2);
        const onMsg = (raw: Buffer | ArrayBuffer | Buffer[]) => {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'rpc:res' && msg.reqId === reqId) {
            ws.off('message', onMsg);
            if (msg.ok) resolve(msg.result);
            else reject(new Error(msg.error));
          }
        };
        ws.on('message', onMsg);
        ws.send(JSON.stringify({ type: 'rpc', reqId, method, params }));
      });
    try {
      const rootListing = await callRpc('local:browsePath', { path: treeRoot, showHidden: false });
      assert.equal(rootListing.entries.length, 1);
      assert.equal(rootListing.entries[0].name, 'src');
      assert.equal(rootListing.entries[0].isDirectory, true);

      const srcListing = await callRpc('local:browsePath', { path: rootListing.entries[0].path, showHidden: false });
      assert.equal(srcListing.entries[0].name, 'components');
      assert.equal(srcListing.entries[0].isDirectory, true);

      const compListing = await callRpc('local:browsePath', { path: srcListing.entries[0].path, showHidden: false });
      assert.equal(compListing.entries[0].name, 'Button.tsx');
      assert.equal(compListing.entries[0].isDirectory, false);
    } finally {
      ws.close();
    }
  });

  it('validates deterministic StateMachine transitions, rejected guards, and ring-buffer tracing', () => {
    const reg = new FsmTraceRegistry(16);
    type S = 'idle' | 'editingClean' | 'editingDirty' | 'saving';
    type E = 'EDIT' | 'DIRTY' | 'CLEAN' | 'SAVE' | 'SAVED' | 'CANCEL';
    const observed: string[] = [];
    const m = new StateMachine<S, E>({
      name: 'testEditor',
      id: 'doc-1',
      initial: 'idle',
      registry: reg,
      transitions: {
        idle: { EDIT: 'editingClean' },
        editingClean: { DIRTY: 'editingDirty', SAVE: 'saving', CANCEL: 'idle' },
        editingDirty: { DIRTY: 'editingDirty', CLEAN: 'editingClean', SAVE: 'saving' },
        saving: { SAVED: 'idle' }
      },
      onTransition: ({ from, to, event }) => observed.push(`${from}->${event}->${to}`)
    });

    assert.equal(m.state, 'idle');
    assert.equal(m.can('SAVE'), false);
    assert.equal(m.send('SAVE'), false, 'Invalid transition from idle should be rejected');
    assert.equal(m.state, 'idle');

    assert.equal(m.send('EDIT'), true);
    assert.equal(m.send('DIRTY'), true);
    assert.equal(m.can('CANCEL'), false, 'Dirty editor must not allow silent unconfirmed CANCEL');
    assert.equal(m.send('CANCEL'), false);
    assert.equal(m.state, 'editingDirty');
    assert.equal(m.send('SAVE'), true);
    assert.equal(m.send('SAVED'), true);
    assert.equal(m.state, 'idle');
    assert.deepEqual(observed, [
      'idle->EDIT->editingClean',
      'editingClean->DIRTY->editingDirty',
      'editingDirty->SAVE->saving',
      'saving->SAVED->idle'
    ]);

    const instances = reg.listInstances();
    assert.equal(instances.length, 1);
    assert.equal(instances[0].transitionCount, 4);

    const trace = reg.getTrace(20);
    assert.equal(trace.length, 6);
    assert.equal(trace.filter((t) => t.rejected).length, 2);

    m.dispose();
    assert.equal(reg.listInstances().length, 0);
  });

  it('reads >32KB remote SFTP files in bounded multi-packet loops without silent truncation', async () => {
    const sourcePayload = Buffer.alloc(150 * 1024);
    for (let i = 0; i < sourcePayload.length; i++) {
      sourcePayload[i] = i % 251;
    }
    let closedCount = 0;
    let readCalls = 0;
    const mockSftp = {
      fstat(_handle: Buffer, cb: (err: Error | undefined, stats: any) => void) {
        cb(undefined, { size: sourcePayload.length });
      },
      read(_handle: Buffer, buf: Buffer, offset: number, length: number, position: number, cb: (err: any, bytesRead: number, buffer: Buffer, position: number) => void) {
        readCalls++;
        if (position >= sourcePayload.length) {
          cb(undefined, 0, buf, position);
          return;
        }
        // Emulate OpenSSH sftp-server 32KB single-packet cap
        const chunkLen = Math.min(32 * 1024, length, sourcePayload.length - position);
        sourcePayload.copy(buf, offset, position, position + chunkLen);
        cb(undefined, chunkLen, buf, position);
      },
      close(_handle: Buffer, cb: (err?: any) => void) {
        closedCount++;
        cb();
      }
    };

    const fullRead = await readSftpHandleBounded(mockSftp as any, Buffer.from([1]), 5 * 1024 * 1024);
    assert.equal(fullRead.length, sourcePayload.length, 'Full 150KB payload should be reassembled across 32KB SFTP packets');
    assert.equal(Buffer.compare(fullRead, sourcePayload), 0);
    assert.ok(readCalls >= 5, 'Should loop across multiple 32KB packets');
    assert.equal(closedCount, 1);

    const cappedRead = await readSftpHandleBounded(mockSftp as any, Buffer.from([2]), 70 * 1024);
    assert.equal(cappedRead.length, 70 * 1024, 'maxBytes cap should still be strictly respected');
    assert.equal(Buffer.compare(cappedRead, sourcePayload.subarray(0, 70 * 1024)), 0);
    assert.equal(closedCount, 2);
  });

  it('exposes DX/AX diagnostics (/api/diagnostics & system:diagnostics) and structured RPC error codes', async () => {
    const httpDiagRes = await fetch(serverUrl + '/api/diagnostics');
    assert.equal(httpDiagRes.status, 200);
    const httpDiag = await httpDiagRes.json() as any;
    assert.equal(httpDiag.ok, true);
    assert.equal(typeof httpDiag.version, 'string');
    assert.ok(httpDiag.fsm && Array.isArray(httpDiag.fsm.instances));

    const wsUrl = serverUrl.replace(/^http/, 'ws') + '/ws';
    const ws = new WebSocket(wsUrl);
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', reject);
    });
    const sendRawRpc = (method: string, params: any = {}) =>
      new Promise<any>((resolve) => {
        const reqId = 'diag-' + Math.random().toString(36).slice(2);
        const onMsg = (raw: Buffer | ArrayBuffer | Buffer[]) => {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'rpc:res' && msg.reqId === reqId) {
            ws.off('message', onMsg);
            resolve(msg);
          }
        };
        ws.on('message', onMsg);
        ws.send(JSON.stringify({ type: 'rpc', reqId, method, params }));
      });

    try {
      const rpcDiag = await sendRawRpc('system:diagnostics');
      assert.equal(rpcDiag.ok, true);
      assert.equal(typeof rpcDiag.durationMs, 'number');
      assert.equal(rpcDiag.result.ok, true);
      assert.ok(Array.isArray(rpcDiag.result.sshHosts));

      const unknownErr = await sendRawRpc('nonexistent:method');
      assert.equal(unknownErr.ok, false);
      assert.equal(unknownErr.errorCode, 'UNKNOWN_METHOD');
      assert.equal(unknownErr.retriable, false);

      // Verify frontend FSM & AX inspector scripts are served
      const fsmJsRes = await fetch(serverUrl + '/fsm.js');
      assert.equal(fsmJsRes.status, 200);
      const fsmJs = await fsmJsRes.text();
      assert.ok(fsmJs.includes('window.GitMapFsm'));
    } finally {
      ws.close();
    }
  });

  it('blocks symlink escape attempts into internal application dataDir across standalone and repo file APIs', { skip: process.platform === 'win32' }, async () => {
    const dataDir = path.join(tmpRoot, 'app-data');
    const fakeSecretFile = path.join(dataDir, 'secrets.json');
    if (!fs.existsSync(fakeSecretFile)) {
      fs.writeFileSync(fakeSecretFile, JSON.stringify({ testSecret: 'do-not-leak' }), { mode: 0o600 });
    }
    const symlinkDir = path.join(tmpRoot, 'symlink-sandbox');
    fs.mkdirSync(symlinkDir, { recursive: true });
    const escapeLink = path.join(symlinkDir, 'leak-secrets.json');
    fs.symlinkSync(fakeSecretFile, escapeLink);

    const repoEscapeLink = path.join(sampleRepoPath, 'evil-secret-link.json');
    fs.symlinkSync(fakeSecretFile, repoEscapeLink);

    const wsUrl = serverUrl.replace(/^http/, 'ws') + '/ws';
    const ws = new WebSocket(wsUrl);
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', reject);
    });
    const sendRawRpc = (method: string, params: any = {}) =>
      new Promise<any>((resolve) => {
        const reqId = 'sec-' + Math.random().toString(36).slice(2);
        const onMsg = (raw: Buffer | ArrayBuffer | Buffer[]) => {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'rpc:res' && msg.reqId === reqId) {
            ws.off('message', onMsg);
            resolve(msg);
          }
        };
        ws.on('message', onMsg);
        ws.send(JSON.stringify({ type: 'rpc', reqId, method, params }));
      });

    try {
      const standaloneRead = await sendRawRpc('file:read', { repo: '', filePath: escapeLink });
      assert.equal(standaloneRead.ok, false, 'Symlink read into dataDir must fail');
      assert.equal(standaloneRead.errorCode, 'ACCESS_DENIED');

      const standaloneWrite = await sendRawRpc('file:write', { repo: '', filePath: escapeLink, content: 'overwritten' });
      assert.equal(standaloneWrite.ok, false, 'Symlink write into dataDir must fail');
      assert.equal(standaloneWrite.errorCode, 'ACCESS_DENIED');

      const repoWrite = await sendRawRpc('file:write', { repo: sampleRepoPath, filePath: 'evil-secret-link.json', content: 'overwritten' });
      assert.equal(repoWrite.ok, false, 'Repo symlink write escaping repo root must fail');
      assert.equal(repoWrite.errorCode, 'ACCESS_DENIED');
    } finally {
      ws.close();
      fs.rmSync(repoEscapeLink, { force: true });
    }
  });
});
