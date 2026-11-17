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
import { GitMapServer } from '../server/appServer';
import { CommitOrdering, GitFileStatus } from '../types';

const STATUS_CODE = sshUtils.sftp.STATUS_CODE;
const OPEN_MODE = sshUtils.sftp.OPEN_MODE;

function startTestSshServer(homeRoot: string): Promise<{ server: SshServer; port: number; clientKeyPath: string }> {
  const hostKey = sshUtils.generateKeyPairSync('ed25519');
  const clientKey = sshUtils.generateKeyPairSync('ed25519');
  const clientKeyPath = path.join(homeRoot, 'test_id_ed25519');
  fs.writeFileSync(clientKeyPath, clientKey.private, { mode: 0o600 });

  const server = new SshServer({ hostKeys: [hostKey.private] }, (client) => {
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
    server.listen(0, '127.0.0.1', () => {
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
    if (sshServer) {
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
  });

  it('connects via Remote-SSH, browses remote paths, scans remote repos, loads Git graph, diffs, and amends commits over SSH', async () => {
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

      // 7. Read file + Git Blame over SSH
      const fileReadRes = await rpc('file:read', {
        repo: remoteRepoUri,
        filePath: 'hello.ts',
        commit: null,
        includeBlame: true
      });
      assert.equal(fileReadRes.error, null);
      assert.ok(fileReadRes.content.includes('VERSION = "1.0.0"'));
      assert.ok(fileReadRes.blame && fileReadRes.blame.lines.length >= 4);

      // 8. Perform Git write actions (Create Branch) over SSH and verify
      const branchErrors = await appServer!.dataSource.createBranch(remoteRepoUri, 'feature/remote-test', latestHash, true, false);
      assert.equal(branchErrors[0], null);
      const updatedInfo = await appServer!.dataSource.getRepoInfo(remoteRepoUri, true, true, []);
      assert.equal(updatedInfo.head, 'feature/remote-test');
    } finally {
      ws.close();
    }
  });
});
