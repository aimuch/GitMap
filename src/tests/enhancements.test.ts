import * as assert from 'assert';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it } from 'node:test';
import { buildHeuristicCommitMessage } from '../server/aiAssistantService';
import { assertSafeRelSegmentPath, EnhancementsService } from '../server/enhancementsService';
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
});
