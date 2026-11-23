import * as assert from 'assert';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it } from 'node:test';
import { buildHeuristicCommitMessage, buildHeuristicCommitPlan } from '../server/aiAssistantService';
import {
  assertSafeRelSegmentPath,
  buildExtractCopyPath,
  EnhancementsService,
  parseDeletedLogOutput,
  parseDiffNameStatusZ,
  parseLsTreeOutput
} from '../server/enhancementsService';
import { CatFileBatchPool } from '../server/gitCatFilePool';
import { computeReviewScorecard } from '../server/gitWorkflowService';
import {
  BackupPayload,
  compareSemver,
  createBackupEnvelope,
  parseBackupEnvelope,
  sanitizeSshHostsForExport
} from '../server/settingsBackupService';

describe('GitMap Enhancements Suite', () => {
  it('sanitizes SSH hosts and round-trips plain & AES-256-GCM encrypted config backups', () => {
    const rawHosts = [
      {
        id: 'dev-1',
        name: 'Dev Server',
        host: '10.0.0.5',
        port: 2222,
        // Real SshHostProfile field names: the login is `user`, the jump host `proxyJump`
        user: 'andy',
        proxyJump: 'bastion.example.com',
        alias: 'GPU box',
        authType: 'password',
        password: 'SUPER_SECRET_PASSWORD',
        passphrase: 'PRIVATE_KEY_PASSPHRASE',
        tags: ['dev', 'gpu']
      }
    ];
    const sanitized = sanitizeSshHostsForExport(rawHosts);
    assert.strictEqual(sanitized.length, 1);
    assert.strictEqual((sanitized[0] as any).password, undefined);
    assert.strictEqual((sanitized[0] as any).passphrase, undefined);
    assert.strictEqual(sanitized[0].host, '10.0.0.5');
    assert.strictEqual(sanitized[0].user, 'andy', 'the SSH login must survive export');
    assert.strictEqual(sanitized[0].proxyJump, 'bastion.example.com', 'ProxyJump must survive export');
    assert.strictEqual(sanitized[0].alias, 'GPU box');
    // Backups written by older versions used `username` / `jumpHost`: still understood
    const legacy = sanitizeSshHostsForExport([{ host: 'h', username: 'old', jumpHost: 'j' }]);
    assert.strictEqual(legacy[0].user, 'old');
    assert.strictEqual(legacy[0].proxyJump, 'j');

    const payload: BackupPayload = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      appVersion: '1.0.0',
      settings: { 'gitmap.theme': 'dark' },
      sshHosts: sanitized,
      clientPrefs: { customShortcuts: { contentSearch: 'Mod+Shift+F' } }
    };

    // Plaintext envelope round-trip
    const plainEnv = createBackupEnvelope(payload);
    assert.strictEqual(plainEnv.encrypted, false);
    const plainOut = parseBackupEnvelope(JSON.stringify(plainEnv));
    assert.deepStrictEqual(plainOut.settings, payload.settings);

    // AES-256-GCM encrypted envelope round-trip
    const encEnv = createBackupEnvelope(payload, 'my-strong-passphrase');
    assert.strictEqual(encEnv.encrypted, true);
    assert.throws(() => parseBackupEnvelope(encEnv), /PASSPHRASE_REQUIRED/);
    assert.throws(() => parseBackupEnvelope(encEnv, 'wrong-passphrase'), /Failed to decrypt/);
    const decOut = parseBackupEnvelope(JSON.stringify(encEnv), 'my-strong-passphrase');
    assert.deepStrictEqual(decOut.clientPrefs, payload.clientPrefs);
    assert.strictEqual(decOut.sshHosts[0].port, 2222);
  });

  it('compares semantic versions accurately for update checks', () => {
    assert.strictEqual(compareSemver('1.0.0', '1.0.0'), 0);
    assert.strictEqual(compareSemver('v1.2.0', '1.1.9'), 1);
    assert.strictEqual(compareSemver('1.0.0', '1.0.1'), -1);
    assert.strictEqual(compareSemver('2.0.0-beta.1', '1.9.9'), 1);
  });

  it('builds sensible heuristic commit messages when AI is unconfigured', () => {
    const docsMsg = buildHeuristicCommitMessage(' README.md | 12 +++++++-----', 'zh', 'conventional');
    assert.ok(docsMsg.startsWith('docs: '));
    const styleMsg = buildHeuristicCommitMessage(' public/app.css | 4 ++--', 'en', 'conventional');
    assert.ok(styleMsg.startsWith('style: '));
    const conciseMsg = buildHeuristicCommitMessage(' src/index.ts | 10 ++++', 'en', 'concise');
    assert.ok(!conciseMsg.startsWith('chore: '));
  });

  it('groups mixed working-tree files into ordered atomic drafts in buildHeuristicCommitPlan', () => {
    const files = [
      { path: 'README.md', status: 'M' },
      { path: 'src/server/api.ts', status: 'M' },
      { path: 'src/server/auth.ts', status: 'A' },
      { path: 'public/app.css', status: 'M' },
      { path: 'src/tests/api.test.ts', status: 'A' },
      { path: 'package.json', status: 'M' }
    ];
    const drafts = buildHeuristicCommitPlan(files, 'zh', 'conventional');
    assert.strictEqual(drafts.length, 5, 'splits config, src/server, style, test, docs into 5 ordered drafts');
    assert.ok(drafts[0].files.includes('package.json'), 'config/chore comes first');
    assert.ok(drafts[drafts.length - 1].files.includes('README.md'), 'docs comes last');
    const flattened = drafts.flatMap((d) => d.files).sort();
    assert.deepStrictEqual(flattened, files.map((f) => f.path).sort(), 'every file assigned exactly once');
  });

  it('computes QuantOrb-style AI review scorecards, verdicts, dimensions, and module groups', () => {
    const clean = computeReviewScorecard([]);
    assert.strictEqual(clean.score, 100);
    assert.strictEqual(clean.verdict, 'CLEAN');

    const mixed = computeReviewScorecard([
      { severity: 'high', file: 'src/server/auth.ts', line: 42, title: 'SQL injection vulnerability', detail: 'Unsanitized input in query' },
      { severity: 'high', file: 'src/server/auth.ts', line: 88, title: 'Null pointer crash', detail: 'Unhandled null dereference edge case' },
      { severity: 'medium', file: 'public/app.js', line: 120, title: 'O(n^2) memory leak in loop', detail: 'Slow performance on large repos' },
      { severity: 'nit', file: 'README.md', line: 3, title: 'Typo in heading', detail: 'Minor wording' }
    ]);
    assert.strictEqual(mixed.verdict, 'DANGER');
    assert.strictEqual(mixed.score, 36);
    assert.strictEqual(mixed.severityCounts.high, 2);
    assert.strictEqual(mixed.severityCounts.medium, 1);
    assert.ok(mixed.dimensions.security < 80, 'security dimension penalized');
    assert.ok(mixed.dimensions.performance < 90, 'performance dimension penalized');
    assert.strictEqual(mixed.moduleGroups[0].module, 'src/server', 'highest severity module sorted first');
    assert.strictEqual(mixed.moduleGroups[0].count, 2);
  });

  it('blocks path traversal in assertSafeRelSegmentPath', () => {
    assert.strictEqual(assertSafeRelSegmentPath('src/index.ts'), 'src/index.ts');
    assert.throws(() => assertSafeRelSegmentPath('../etc/passwd'));
    assert.throws(() => assertSafeRelSegmentPath('a/../../b'));
    assert.throws(() => assertSafeRelSegmentPath(''));
  });

  it('runs full-text content search and folder diff + selective sync on local directories', async () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'gitmap-enh-'));
    try {
      const dirA = path.join(tmpBase, 'left');
      const dirB = path.join(tmpBase, 'right');
      fs.mkdirSync(path.join(dirA, 'src'), { recursive: true });
      fs.mkdirSync(path.join(dirB, 'src'), { recursive: true });

      fs.writeFileSync(path.join(dirA, 'src', 'hello.ts'), 'export const GREETING = "Hello GitMap";\nconsole.log(GREETING);\n');
      fs.writeFileSync(path.join(dirA, 'only-left.txt'), 'left only content');
      fs.writeFileSync(path.join(dirB, 'src', 'hello.ts'), 'export const GREETING = "Changed";\n');
      fs.writeFileSync(path.join(dirB, 'only-right.txt'), 'right only content');

      const svc = new EnhancementsService({} as any);

      // 1. Full-text content search
      const searchRes = await svc.searchContent(dirA, { query: 'GREETING', caseSensitive: true });
      assert.strictEqual(searchRes.files.length, 1);
      assert.strictEqual(searchRes.totalMatches, 2);
      assert.strictEqual(searchRes.files[0].matches[0].line, 1);

      // 1b. Without ripgrep on PATH the search must fall back to grep, not report "no matches"
      if (process.platform !== 'win32') {
        const binDir = path.join(tmpBase, 'bin-no-rg');
        fs.mkdirSync(binDir);
        for (const tool of ['grep', 'git']) {
          const real = execFileSync('/bin/sh', ['-c', `command -v ${tool}`]).toString().trim();
          if (real) fs.symlinkSync(real, path.join(binDir, tool));
        }
        const savedPath = process.env.PATH;
        process.env.PATH = binDir;
        try {
          const noRg = await svc.searchContent(dirA, { query: 'GREETING', caseSensitive: true });
          assert.notStrictEqual(noRg.engine, 'rg', 'rg is not installed here, so another engine must have run');
          assert.strictEqual(noRg.totalMatches, 2, 'the fallback engine finds the same matches');
        } finally {
          process.env.PATH = savedPath;
        }
      }

      // 2. Folder diff
      const diff1 = await svc.compareFolders(dirA, dirB);
      assert.strictEqual(diff1.summary.leftOnly, 1);
      assert.strictEqual(diff1.summary.rightOnly, 1);
      assert.strictEqual(diff1.summary.modified, 1);

      // 2b. Same size, different modification time: identical when the content matches, modified when it doesn't
      fs.writeFileSync(path.join(dirA, 'copied.txt'), 'same bytes');
      fs.writeFileSync(path.join(dirB, 'copied.txt'), 'same bytes');
      fs.writeFileSync(path.join(dirA, 'tweaked.txt'), 'abcdefghij');
      fs.writeFileSync(path.join(dirB, 'tweaked.txt'), 'abcdefghiX');
      const old = new Date(Date.now() - 3600 * 1000);
      fs.utimesSync(path.join(dirB, 'copied.txt'), old, old);
      fs.utimesSync(path.join(dirB, 'tweaked.txt'), old, old);
      const diff2 = await svc.compareFolders(dirA, dirB);
      assert.strictEqual(diff2.entries.find((e) => e.relPath === 'copied.txt')!.status, 'identical', 'a copy with a new timestamp is not a change');
      assert.strictEqual(diff2.entries.find((e) => e.relPath === 'tweaked.txt')!.status, 'modified');
      fs.rmSync(path.join(dirA, 'copied.txt'));
      fs.rmSync(path.join(dirB, 'copied.txt'));
      fs.rmSync(path.join(dirA, 'tweaked.txt'));
      fs.rmSync(path.join(dirB, 'tweaked.txt'));

      // 3. Selective sync Left -> Right for only-left.txt & src/hello.ts
      await svc.syncFolderFile(dirA, dirB, 'only-left.txt');
      await svc.syncFolderFile(dirA, dirB, 'src/hello.ts');
      assert.strictEqual(fs.readFileSync(path.join(dirB, 'only-left.txt'), 'utf8'), 'left only content');
      assert.strictEqual(
        fs.readFileSync(path.join(dirB, 'src', 'hello.ts'), 'utf8'),
        fs.readFileSync(path.join(dirA, 'src', 'hello.ts'), 'utf8')
      );
    } finally {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  });

  it('prefers host key types already in known_hosts, like OpenSSH', async () => {
    const { orderHostKeyAlgorithms } = await import('../remote/sshManager');
    assert.strictEqual(orderHostKeyAlgorithms([]), undefined, 'nothing known: ssh2 default order');
    assert.strictEqual(orderHostKeyAlgorithms(['unknown-type']), undefined);
    const rsaFirst = orderHostKeyAlgorithms(['ssh-rsa'])!;
    assert.deepStrictEqual(rsaFirst.slice(0, 3), ['rsa-sha2-512', 'rsa-sha2-256', 'ssh-rsa'], 'a host known by its RSA key is asked for the RSA key first');
    assert.ok(rsaFirst.includes('ecdsa-sha2-nistp256'), 'other algorithms stay allowed after the known ones');
    assert.strictEqual(new Set(rsaFirst).size, rsaFirst.length, 'no duplicates');
    const two = orderHostKeyAlgorithms(['ecdsa-sha2-nistp256', 'ssh-rsa'])!;
    assert.strictEqual(two[0], 'ecdsa-sha2-nistp256');
    // Security-ranked ordering: a host with both legacy ssh-rsa and modern ssh-ed25519 still prefers ed25519 over RSA
    const bothOrder = orderHostKeyAlgorithms(['ssh-rsa', 'ssh-ed25519'])!;
    assert.strictEqual(bothOrder[0], 'ssh-ed25519', 'known stronger ed25519 is not downgraded to ssh-rsa by known_hosts line order');
  });

  it('opens a file itself in an editor, encodes remote URIs, and avoids connecting disconnected SSH hosts', async () => {
    const { resolveLaunchTarget, __test } = await import('../server/launchers');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitmap-launch-'));
    try {
      const file = path.join(dir, 'main.ts');
      fs.writeFileSync(file, 'export {};\n');
      const forEditor = await resolveLaunchTarget(file, true);
      assert.strictEqual(forEditor.path, file, 'editors get the file');
      assert.strictEqual(forEditor.isFile, true);
      const forTerminal = await resolveLaunchTarget(file);
      assert.strictEqual(forTerminal.path, dir, 'terminals get the folder');
      const folder = await resolveLaunchTarget(dir, true);
      assert.strictEqual(folder.path, dir);
      assert.strictEqual(folder.isFile, false);

      // RFC 3986 path segment encoding for VS Code remote URIs (spaces, #, ?, %, CJK)
      assert.strictEqual(
        __test.encodeRemoteUriPath('/srv/my project/笔记 #1?v=2%ok.md'),
        '/srv/my%20project/%E7%AC%94%E8%AE%B0%20%231%3Fv%3D2%25ok.md'
      );

      // Custom command {sshCommand} should cd into the parent directory when target is a remote file
      const fakeProfile: any = { id: 'box', name: 'box', host: '10.0.0.9', port: 22, user: 'dev', authType: 'auto', source: 'manual' };
      const filled = __test.fillTemplate('{sshCommand}', { isRemote: true, path: '/srv/app/src/index.ts', isFile: true, profile: fakeProfile });
      assert.ok(filled.includes('/srv/app/src') && !filled.includes('index.ts'), 'sshCommand uses file parent dir');

      // Disconnected remote host resolves immediately without blocking on SSH connect, honoring isFileHint
      const t0 = Date.now();
      const remFile = await resolveLaunchTarget('ssh://never-connected-host/srv/app/index.ts', true, true);
      assert.ok(Date.now() - t0 < 500, 'should not initiate SSH connection for disconnected host');
      assert.strictEqual(remFile.isFile, true);
      assert.strictEqual(remFile.path, '/srv/app/index.ts');
      const remTerm = await resolveLaunchTarget('ssh://never-connected-host/srv/app/index.ts', false, true);
      assert.strictEqual(remTerm.isFile, false);
      assert.strictEqual(remTerm.path, '/srv/app');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('validates UTF-8 losslessly with truncation boundaries and UTF-16 BOM protection', async () => {
    const { isLossyUtf8, detectUtf16Bom, isNonUtf8TextBuffer } = await import('../server/diffService');
    const validUtf8 = Buffer.from('你好世界\nhello\n', 'utf8');
    assert.strictEqual(isLossyUtf8(validUtf8), false);
    // Literal U+FFFD in valid UTF-8 is NOT lossy
    assert.strictEqual(isLossyUtf8(Buffer.from('replacement: \uFFFD ok', 'utf8')), false);
    // Split a 3-byte Chinese UTF-8 char at a truncation boundary: should NOT false-positive when truncated=true
    const splitSlice = validUtf8.subarray(0, 4); // "你" (3 bytes) + first byte of "好"
    assert.strictEqual(isLossyUtf8(splitSlice, { truncated: true }), false, 'truncated multi-byte tail is not treated as invalid UTF-8');
    assert.strictEqual(isLossyUtf8(splitSlice, { truncated: false }), true, 'untruncated trailing byte is invalid UTF-8');
    // UTF-16 LE BOM detection & write protection
    const utf16le = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('hi', 'utf16le')]);
    assert.strictEqual(detectUtf16Bom(utf16le), 'utf16le');
    assert.strictEqual(isNonUtf8TextBuffer(utf16le), true, 'UTF-16 BOM must be protected against UTF-8 overwrite');
    // Plain binary with NUL bytes (no BOM) is binary, not non-UTF-8 text
    assert.strictEqual(isNonUtf8TextBuffer(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01])), false);
  });

  it('verifies modular frontend assets are wired into public/index.html', () => {
    const rootDir = path.resolve(__dirname, '..', '..');
    const html = fs.readFileSync(path.join(rootDir, 'public', 'index.html'), 'utf8');
    const expected = [
      '/modules/enhancements.css',
      '/modules/editorAndPreview.js',
      '/modules/gitAndRemoteUI.js',
      '/modules/aiAndSystemUI.js'
    ];
    for (const asset of expected) {
      assert.ok(html.includes(asset), `public/index.html should reference ${asset}`);
      const diskPath = path.join(rootDir, 'public', asset.replace(/^\//, ''));
      assert.ok(fs.existsSync(diskPath), `Asset file should exist: ${diskPath}`);
      if (diskPath.endsWith('.js')) {
        execFileSync(process.execPath, ['--check', diskPath]);
      }
    }
  });

  it('parses git ls-tree -l -z output with dirs, blobs, symlinks, submodules, CJK names, and subPath prefix', () => {
    const raw = [
      '100644 blob 1111111111111111111111111111111111111111     128\tREADME.md',
      '040000 tree 2222222222222222222222222222222222222222       -\tsrc',
      '120000 blob 3333333333333333333333333333333333333333      14\tlink-to-cfg',
      '160000 commit 4444444444444444444444444444444444444444       -\tvendor/sub',
      '100644 blob 5555555555555555555555555555555555555555    2048\t文档 笔记.md',
      ''
    ].join('\0');

    const rootEntries = parseLsTreeOutput(raw, '');
    assert.strictEqual(rootEntries.length, 5);
    // Directories sort first
    assert.strictEqual(rootEntries[0].name, 'src');
    assert.strictEqual(rootEntries[0].isDirectory, true);
    assert.strictEqual(rootEntries[0].size, null);

    const symlink = rootEntries.find((e) => e.name === 'link-to-cfg')!;
    assert.strictEqual(symlink.isSymlink, true);
    assert.strictEqual(symlink.size, 14);

    const submod = rootEntries.find((e) => e.path === 'vendor/sub')!;
    assert.strictEqual(submod.isSubmodule, true);
    assert.strictEqual(submod.name, 'sub');
    assert.strictEqual(submod.size, null);

    const cjk = rootEntries.find((e) => e.name === '文档 笔记.md')!;
    assert.strictEqual(cjk.size, 2048);

    // Prefixing parentSubPath
    const subEntries = parseLsTreeOutput('100644 blob 1111111111111111111111111111111111111111      42\tindex.ts\0', 'src/core/');
    assert.strictEqual(subEntries.length, 1);
    assert.strictEqual(subEntries[0].path, 'src/core/index.ts');
    assert.strictEqual(subEntries[0].name, 'index.ts');
  });

  it('parses git log --diff-filter=D -z output into deleted files and folder groups with query & truncation', () => {
    const c2 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const c1 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const c0 = 'cccccccccccccccccccccccccccccccccccccccc';
    const raw =
      `\x1e${c2}\x1faaaaaaa\x1fAndy\x1f1700000200\x1fchore: remove legacy module\x1f${c1} 9999999999999999999999999999999999999999\0\n` +
      `D\0src/legacy/a.ts\0D\0src/legacy/b.ts\0D\0root-old.txt\0` +
      `\x1e${c1}\x1fbbbbbbb\x1fBob\x1f1700000100\x1fdocs: drop 中文 手册\x1f${c0}\0\n` +
      `D\0docs/中文 手册.md\0`;

    const all = parseDeletedLogOutput(raw, '', 100);
    assert.strictEqual(all.scannedCommits, 2);
    assert.strictEqual(all.truncated, false);
    assert.strictEqual(all.files.length, 4);
    assert.strictEqual(all.files[0].commitHash, c2);
    assert.strictEqual(all.files[0].parentHash, c1, 'first parent of merge commit is used');
    assert.strictEqual(all.files[0].folder, 'src/legacy');
    assert.strictEqual(all.files[2].folder, '(root)');

    const legacyGroup = all.folders.find((g) => g.folder === 'src/legacy')!;
    assert.ok(legacyGroup);
    assert.strictEqual(legacyGroup.fileCount, 2);
    assert.deepStrictEqual(legacyGroup.files, ['src/legacy/a.ts', 'src/legacy/b.ts']);

    // Query matches CJK filename
    const cjkOnly = parseDeletedLogOutput(raw, '中文', 100);
    assert.strictEqual(cjkOnly.files.length, 1);
    assert.strictEqual(cjkOnly.files[0].path, 'docs/中文 手册.md');
    assert.strictEqual(cjkOnly.files[0].parentHash, c0);

    // Truncation cap
    const capped = parseDeletedLogOutput(raw, '', 2);
    assert.strictEqual(capped.files.length, 2);
    assert.strictEqual(capped.truncated, true);
  });

  it('streams blobs via persistent git cat-file --batch pool with truncation safety, binary/empty files, and LRU cache', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitmap-catfile-'));
    const pool = new CatFileBatchPool({ maxWorkers: 2, idleTimeoutMs: 5000, maxCachedBlobs: 16 });
    try {
      execFileSync('git', ['init', '-b', 'main'], { cwd: tmpDir });
      execFileSync('git', ['config', 'user.name', 'Test'], { cwd: tmpDir });
      execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tmpDir });
      fs.mkdirSync(path.join(tmpDir, 'docs'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'hello.txt'), 'hello cat-file\n');
      fs.writeFileSync(path.join(tmpDir, 'empty.txt'), '');
      fs.writeFileSync(path.join(tmpDir, 'docs', '中文 说明.md'), '你好 GitMap!\n');
      fs.writeFileSync(path.join(tmpDir, 'big.bin'), Buffer.concat([Buffer.from([0x00, 0x01, 0x02]), Buffer.alloc(4096, 0x41)]));
      execFileSync('git', ['add', '.'], { cwd: tmpDir });
      execFileSync('git', ['commit', '-m', 'init'], { cwd: tmpDir });
      const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: tmpDir }).toString('utf8').trim();

      // Concurrent reads including oversized truncated blob + empty file + CJK path + missing object
      const [r1, rBigTrunc, rEmpty, rCjk, rMissing] = await Promise.all([
        pool.readLocalCommitBlob('git', tmpDir, sha, 'hello.txt', 1024),
        pool.readLocalCommitBlob('git', tmpDir, sha, 'big.bin', 64),
        pool.readLocalCommitBlob('git', tmpDir, sha, 'empty.txt', 1024),
        pool.readLocalCommitBlob('git', tmpDir, sha, 'docs/中文 说明.md', 1024),
        pool.readLocalCommitBlob('git', tmpDir, sha, 'does-not-exist.txt', 1024)
      ]);
      assert.strictEqual(r1?.buffer.toString('utf8'), 'hello cat-file\n');
      assert.strictEqual(rBigTrunc?.truncated, true);
      assert.strictEqual(rBigTrunc?.buffer.length, 64);
      assert.strictEqual(rBigTrunc?.size, 4099);
      assert.strictEqual(rEmpty?.buffer.length, 0);
      assert.strictEqual(rCjk?.buffer.toString('utf8'), '你好 GitMap!\n');
      assert.strictEqual(rMissing, null);
      assert.strictEqual(pool.activeWorkerCount, 1);

      // Re-reading hello.txt hits the immutable LRU cache; re-reading big.bin with larger cap re-fetches full bytes
      const r1Cached = await pool.readLocalCommitBlob('git', tmpDir, sha, 'hello.txt', 1024);
      assert.strictEqual(r1Cached?.fromCache, true);
      assert.strictEqual(r1Cached?.buffer.toString('utf8'), 'hello cat-file\n');

      const rBigFull = await pool.readLocalCommitBlob('git', tmpDir, sha, 'big.bin', 8192);
      assert.strictEqual(rBigFull?.truncated, false);
      assert.strictEqual(rBigFull?.buffer.length, 4099);
    } finally {
      pool.dispose();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('parses diff-tree --name-status -z overlays and builds non-clobbering extract copy filenames', () => {
    const raw = 'A\0src/new.ts\0M\0src/app/main.ts\0D\0old/dead.ts\0R100\0a/x.ts\0b/y.ts\0';
    const parsed = parseDiffNameStatusZ(raw);
    assert.strictEqual(parsed.changes['src/new.ts'], 'A');
    assert.strictEqual(parsed.changes['src/app/main.ts'], 'M');
    assert.strictEqual(parsed.changes['old/dead.ts'], 'D');
    assert.strictEqual(parsed.changes['b/y.ts'], 'R');
    assert.deepStrictEqual(parsed.deletedPaths, ['old/dead.ts']);
    assert.ok(parsed.changedDirs.includes('src'));
    assert.ok(parsed.changedDirs.includes('src/app'));
    assert.ok(parsed.changedDirs.includes('old'));

    assert.strictEqual(buildExtractCopyPath('src/app.ts', '1a2b3c4', 0), 'src/app.1a2b3c4.ts');
    assert.strictEqual(buildExtractCopyPath('src/app.ts', '1a2b3c4', 1), 'src/app.1a2b3c4-2.ts');
    assert.strictEqual(buildExtractCopyPath('Makefile', '1a2b3c4', 0), 'Makefile.1a2b3c4');
  });

  it('renders File Time Machine HTML with Pin Base A↔B, Extract Copy, and Restore controls', async () => {
    const { getFileTimeMachineHtml } = await import('../fileTimeMachine');
    const html = getFileTimeMachineHtml(
      'src/demo.ts',
      [
        {
          hash: '1111111111111111111111111111111111111111',
          author: 'Alice',
          email: 'alice@example.com',
          date: 1700000200,
          subject: 'feat: v2',
          filePath: 'src/demo.ts',
          oldFilePath: null,
          additions: 3,
          deletions: 1,
          added: false,
          isLive: true
        },
        {
          hash: '2222222222222222222222222222222222222222',
          author: 'Alice',
          email: 'alice@example.com',
          date: 1700000100,
          subject: 'feat: v1',
          filePath: 'src/demo.ts',
          oldFilePath: null,
          additions: 5,
          deletions: 0,
          added: true,
          isLive: false
        }
      ],
      0,
      'diff',
      'self'
    );
    assert.ok(html.includes('id="ftmPinBtn"'), 'Pin Base A button present');
    assert.ok(html.includes('id="ftmPinBanner"'), 'Compare A↔B banner present');
    assert.ok(html.includes('id="ftmExtractBtn"'), 'Extract Copy button present');
    assert.ok(html.includes('id="ftmRestoreBtn"'), 'Restore Version button present');
    assert.ok(html.includes('loadCompare'), 'Cross-revision compare command wired');
  });
});
