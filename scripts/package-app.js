const cp = require('child_process');
const path = require('path');

const extraArgs = process.argv.slice(2);
const hasPublishFlag = extraArgs.some((a) => a === '-p' || a === '--publish' || a.startsWith('--publish='));
const finalArgs = hasPublishFlag ? extraArgs : [...extraArgs, '--publish', 'never'];

const env = Object.assign({}, process.env);

// Outside GitHub Actions, default to fast mirrors so local packaging in China doesn't fail on github.com TLS resets
if (!env.GITHUB_ACTIONS) {
  if (!env.ELECTRON_MIRROR) {
    env.ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/';
  }
  if (!env.ELECTRON_BUILDER_BINARIES_MIRROR) {
    env.ELECTRON_BUILDER_BINARIES_MIRROR = 'https://npmmirror.com/mirrors/electron-builder-binaries/';
  }
}

// Avoid failing when no Apple Developer ID certificate is configured (still ad-hoc signs arm64 on macOS)
if (!env.CSC_LINK && typeof env.CSC_IDENTITY_AUTO_DISCOVERY === 'undefined') {
  env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
}

const builderCli = path.join(__dirname, '..', 'node_modules', 'electron-builder', 'cli.js');
const result = cp.spawnSync(process.execPath, [builderCli, ...finalArgs], {
  stdio: 'inherit',
  env
});

process.exit(result.status ?? 1);
