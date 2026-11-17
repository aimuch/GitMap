const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const VSCODE_SHIM_TARGET = path.join(DIST, 'platform', 'vscode.js');

// 1. Rewrite require("vscode") in all compiled dist/**/*.js files to relative path to dist/platform/vscode.js
//    so packaged Electron app.asar and Node CLI work with zero node_modules/vscode dependency.
function rewriteVscodeRequires(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      rewriteVscodeRequires(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('require("vscode")') || content.includes("require('vscode')")) {
        let rel = path.relative(path.dirname(fullPath), VSCODE_SHIM_TARGET).replace(/\\/g, '/');
        if (!rel.startsWith('.')) rel = './' + rel;
        const updated = content
          .replace(/require\("vscode"\)/g, `require(${JSON.stringify(rel)})`)
          .replace(/require\('vscode'\)/g, `require(${JSON.stringify(rel)})`);
        if (updated !== content) {
          fs.writeFileSync(fullPath, updated, 'utf8');
        }
      }
    }
  }
}

if (fs.existsSync(DIST)) {
  rewriteVscodeRequires(DIST);
}

// Also keep node_modules/vscode during local dev for convenience
const vscodeShimDir = path.join(ROOT, 'node_modules', 'vscode');
fs.mkdirSync(vscodeShimDir, { recursive: true });
fs.writeFileSync(
  path.join(vscodeShimDir, 'package.json'),
  JSON.stringify({ name: 'vscode', version: '1.85.0', main: 'index.js' }, null, 2)
);
fs.writeFileSync(
  path.join(vscodeShimDir, 'index.js'),
  '"use strict";\nmodule.exports = require("../../dist/platform/vscode.js");\n'
);

// 2. Copy askpass shell scripts if present
const askpassSrc = path.join(ROOT, 'src', 'askpass');
const askpassOut = path.join(DIST, 'askpass');
if (fs.existsSync(askpassSrc)) {
  fs.mkdirSync(askpassOut, { recursive: true });
  for (const fileName of fs.readdirSync(askpassSrc)) {
    if (fileName.endsWith('.sh')) {
      const target = path.join(askpassOut, fileName);
      fs.copyFileSync(path.join(askpassSrc, fileName), target);
      try {
        fs.chmodSync(target, 0o755);
      } catch (_) {}
    }
  }
}

// 3. Copy xterm browser assets to public/vendor/xterm for 100% offline terminal rendering
const xtermVendorDir = path.join(ROOT, 'public', 'vendor', 'xterm');
fs.mkdirSync(xtermVendorDir, { recursive: true });

const xtermFiles = [
  [path.join(ROOT, 'node_modules', '@xterm', 'xterm', 'lib', 'xterm.js'), 'xterm.js'],
  [path.join(ROOT, 'node_modules', '@xterm', 'xterm', 'css', 'xterm.css'), 'xterm.css'],
  [path.join(ROOT, 'node_modules', '@xterm', 'addon-fit', 'lib', 'addon-fit.js'), 'addon-fit.js']
];

for (const [srcFile, destName] of xtermFiles) {
  if (fs.existsSync(srcFile)) {
    fs.copyFileSync(srcFile, path.join(xtermVendorDir, destName));
  }
}

console.log('Postbuild completed: dist vscode imports rewritten & xterm assets prepared.');
