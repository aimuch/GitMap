const cp = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MEDIA_DIRECTORY = path.join(ROOT, 'media');
const STYLES_DIRECTORY = path.join(ROOT, 'web', 'styles');

const MAIN_CSS_FILE = 'main.css';
const MAIN_JS_FILE = 'main.js';
const UTILS_JS_FILE = 'utils.js';
const STATE_MACHINES_JS_FILE = 'stateMachines.js';

const OUTPUT_MIN_CSS_FILE = 'out.min.css';
const OUTPUT_MIN_JS_FILE = 'out.min.js';
const OUTPUT_TMP_JS_FILE = 'out.tmp.js';

const DEBUG = process.argv.length > 2 && process.argv[2] === 'debug';

fs.mkdirSync(MEDIA_DIRECTORY, { recursive: true });

// Order: utils.js, stateMachines.js, *.js, main.js
const packageJsFiles = [path.join(MEDIA_DIRECTORY, UTILS_JS_FILE), path.join(MEDIA_DIRECTORY, STATE_MACHINES_JS_FILE)];
fs.readdirSync(MEDIA_DIRECTORY).sort().forEach((fileName) => {
  if (fileName.endsWith('.js') && fileName !== OUTPUT_MIN_JS_FILE && fileName !== OUTPUT_TMP_JS_FILE && fileName !== UTILS_JS_FILE && fileName !== STATE_MACHINES_JS_FILE && fileName !== MAIN_JS_FILE) {
    packageJsFiles.push(path.join(MEDIA_DIRECTORY, fileName));
  }
});
packageJsFiles.push(path.join(MEDIA_DIRECTORY, MAIN_JS_FILE));

// Order: main.css, *.css
const packageCssFiles = [path.join(STYLES_DIRECTORY, MAIN_CSS_FILE)];
fs.readdirSync(STYLES_DIRECTORY).sort().forEach((fileName) => {
  if (fileName.endsWith('.css') && fileName !== MAIN_CSS_FILE) {
    packageCssFiles.push(path.join(STYLES_DIRECTORY, fileName));
  }
});

let jsFileContents = '';
packageJsFiles.forEach((fileName) => {
  jsFileContents += fs.readFileSync(fileName, 'utf8').replace(/^"use strict";\r?\n/, '') + '\n';
  fs.unlinkSync(fileName);
});

const tmpJsPath = path.join(MEDIA_DIRECTORY, OUTPUT_TMP_JS_FILE);
const outJsPath = path.join(MEDIA_DIRECTORY, OUTPUT_MIN_JS_FILE);
fs.writeFileSync(tmpJsPath, '"use strict";\n(function(document, window){\n' + jsFileContents + '})(document, window);\n');

let cssFileContents = '';
packageCssFiles.forEach((fileName) => {
  const contents = fs.readFileSync(fileName, 'utf8');
  if (DEBUG) {
    cssFileContents += contents + '\n';
  } else {
    const lines = contents.split(/\r\n|\r|\n/g);
    for (let j = 0; j < lines.length; j++) {
      if (lines[j].startsWith('\t')) lines[j] = lines[j].substring(1);
    }
    let j = 0;
    while (j < lines.length) {
      if (lines[j].startsWith('/*') && lines[j].endsWith('*/')) {
        lines.splice(j, 1);
      } else {
        j++;
      }
    }
    cssFileContents += lines.join('');
  }
});
fs.writeFileSync(path.join(MEDIA_DIRECTORY, OUTPUT_MIN_CSS_FILE), cssFileContents);

cp.execFileSync(
  process.execPath,
  [require.resolve('uglify-js/bin/uglifyjs'), tmpJsPath, DEBUG ? '-b' : '--mangle', '--output', outJsPath],
  { stdio: 'inherit' }
);
fs.unlinkSync(tmpJsPath);
console.log('Packaged webview bundle -> media/out.min.js & media/out.min.css');
