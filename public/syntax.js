/*
 * GitMap syntax highlighting for the built-in Diff & File viewers.
 *
 * A whole side of a file is highlighted at once with highlight.js (so multi-line comments, strings & template literals are
 * coloured correctly), then split into per-line runs of { text, cls }. When rendering a line, the syntax runs are merged with
 * the word-level change segments of the diff, so both the token colours and the changed-word backgrounds are shown.
 */
(function () {
  'use strict';

  const MAX_HIGHLIGHT_CHARS = 600000;
  const MAX_HIGHLIGHT_LINES = 12000;

  const EXTENSION_LANGUAGES = {
    js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
    ts: 'typescript', mts: 'typescript', cts: 'typescript', tsx: 'typescript',
    json: 'json', jsonc: 'json', json5: 'json', webmanifest: 'json',
    html: 'xml', htm: 'xml', xhtml: 'xml', xml: 'xml', svg: 'xml', plist: 'xml', vue: 'xml', xaml: 'xml', csproj: 'xml',
    css: 'css', scss: 'scss', sass: 'scss', less: 'less',
    md: 'markdown', markdown: 'markdown', mdx: 'markdown',
    py: 'python', pyi: 'python', pyw: 'python',
    rb: 'ruby', gemspec: 'ruby', rake: 'ruby',
    go: 'go', rs: 'rust', java: 'java', kt: 'kotlin', kts: 'kotlin', scala: 'scala', groovy: 'groovy', gradle: 'groovy',
    c: 'c', h: 'c', cc: 'cpp', cpp: 'cpp', cxx: 'cpp', hpp: 'cpp', hh: 'cpp', hxx: 'cpp', ino: 'cpp', cu: 'cpp', cuh: 'cpp',
    m: 'objectivec', mm: 'objectivec', swift: 'swift', cs: 'csharp', fs: 'fsharp', vb: 'vbnet',
    php: 'php', pl: 'perl', pm: 'perl', lua: 'lua', r: 'r', dart: 'dart',
    sh: 'bash', bash: 'bash', zsh: 'bash', ksh: 'bash', fish: 'bash', command: 'bash',
    ps1: 'powershell', psm1: 'powershell', bat: 'dos', cmd: 'dos',
    yml: 'yaml', yaml: 'yaml', toml: 'ini', ini: 'ini', cfg: 'ini', conf: 'ini', properties: 'properties', env: 'bash',
    sql: 'sql', graphql: 'graphql', gql: 'graphql', proto: 'protobuf',
    diff: 'diff', patch: 'diff', cmake: 'cmake', makefile: 'makefile', mk: 'makefile',
    dockerfile: 'dockerfile', nginx: 'nginx', tex: 'latex', elm: 'elm', ex: 'elixir', exs: 'elixir', erl: 'erlang',
    hs: 'haskell', clj: 'clojure', zig: 'zig', nim: 'nim', jl: 'julia', vim: 'vim', tf: 'ini', hcl: 'ini'
  };

  const FILENAME_LANGUAGES = {
    dockerfile: 'dockerfile', makefile: 'makefile', gnumakefile: 'makefile', 'cmakelists.txt': 'cmake',
    '.bashrc': 'bash', '.zshrc': 'bash', '.profile': 'bash', '.bash_profile': 'bash', '.gitconfig': 'ini', '.editorconfig': 'ini',
    '.npmrc': 'ini', gemfile: 'ruby', rakefile: 'ruby', podfile: 'ruby', 'jenkinsfile': 'groovy', '.gitignore': 'bash'
  };

  function hljsApi() {
    return window.hljs || null;
  }

  /** Detect the highlight.js language of a file path, or NULL when it's unknown / unavailable. */
  function languageForPath(filePath) {
    const hljs = hljsApi();
    if (!hljs || !filePath) return null;
    const base = String(filePath).split(/[\\/]/).pop().toLowerCase();
    let lang = FILENAME_LANGUAGES[base] || null;
    if (lang === null && base.startsWith('dockerfile')) lang = 'dockerfile';
    if (lang === null) {
      const dot = base.lastIndexOf('.');
      if (dot > -1) lang = EXTENSION_LANGUAGES[base.substring(dot + 1)] || null;
    }
    return lang !== null && hljs.getLanguage(lang) ? lang : null;
  }

  /**
   * Highlight text and split it into lines of runs.
   * @returns An array (one entry per line) of arrays of { text, cls }, or NULL if the text can't / shouldn't be highlighted.
   */
  function highlightToLines(text, language) {
    const hljs = hljsApi();
    if (!hljs || !language || typeof text !== 'string') return null;
    if (text.length > MAX_HIGHLIGHT_CHARS) return null;
    let html;
    try {
      html = hljs.highlight(text, { language: language, ignoreIllegals: true }).value;
    } catch (_) {
      return null;
    }
    const template = document.createElement('template');
    template.innerHTML = html;

    const lines = [[]];
    const walk = (node, cls) => {
      for (let child = node.firstChild; child !== null; child = child.nextSibling) {
        if (child.nodeType === 3) {
          const parts = child.nodeValue.split('\n');
          for (let i = 0; i < parts.length; i++) {
            if (i > 0) {
              if (lines.length > MAX_HIGHLIGHT_LINES) return false;
              lines.push([]);
            }
            if (parts[i] !== '') lines[lines.length - 1].push({ text: parts[i], cls: cls });
          }
        } else if (child.nodeType === 1) {
          const own = child.getAttribute('class') || '';
          if (walk(child, own === '' ? cls : (cls === '' ? own : cls + ' ' + own)) === false) return false;
        }
      }
      return true;
    };
    if (walk(template.content, '') === false) return null;
    return lines;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Render a line from its syntax runs, overlaying the word-level change segments.
   * @param runs Syntax runs of the line ({ text, cls }), or NULL for no syntax colours.
   * @param text The plain text of the line (used when runs is NULL, and to validate the runs).
   * @param segments Word-level diff segments ({ text, changed }), or NULL.
   * @param changedCls The class added to changed characters.
   */
  function renderLine(runs, text, segments, changedCls) {
    const plain = text == null ? '' : String(text);
    let syntaxRuns = runs;
    if (syntaxRuns) {
      let joined = '';
      for (let i = 0; i < syntaxRuns.length; i++) joined += syntaxRuns[i].text;
      if (joined !== plain) syntaxRuns = null; // Out of sync (e.g. CRLF differences): fall back to plain text
    }
    if (!syntaxRuns) syntaxRuns = plain === '' ? [] : [{ text: plain, cls: '' }];

    const changeRanges = [];
    if (segments && segments.length > 0) {
      let offset = 0;
      for (let i = 0; i < segments.length; i++) {
        const len = segments[i].text.length;
        if (segments[i].changed && len > 0) changeRanges.push([offset, offset + len]);
        offset += len;
      }
    }

    if (changeRanges.length === 0) {
      let out = '';
      for (let i = 0; i < syntaxRuns.length; i++) {
        const r = syntaxRuns[i];
        out += r.cls ? '<span class="' + r.cls + '">' + escapeHtml(r.text) + '</span>' : escapeHtml(r.text);
      }
      return out;
    }

    // Split syntax runs at change-range boundaries
    let out = '';
    let pos = 0;
    let rangeIdx = 0;
    for (let i = 0; i < syntaxRuns.length; i++) {
      const run = syntaxRuns[i];
      let start = 0;
      while (start < run.text.length) {
        const absStart = pos + start;
        while (rangeIdx < changeRanges.length && changeRanges[rangeIdx][1] <= absStart) rangeIdx++;
        const range = changeRanges[rangeIdx];
        let inChange = false;
        let boundary = pos + run.text.length;
        if (range) {
          if (absStart >= range[0]) {
            inChange = true;
            boundary = Math.min(boundary, range[1]);
          } else {
            boundary = Math.min(boundary, range[0]);
          }
        }
        const piece = run.text.substring(start, boundary - pos);
        const cls = (run.cls ? run.cls : '') + (inChange ? (run.cls ? ' ' : '') + changedCls : '');
        out += cls ? '<span class="' + cls + '">' + escapeHtml(piece) + '</span>' : escapeHtml(piece);
        start = boundary - pos;
      }
      pos += run.text.length;
    }
    return out;
  }

  window.GitMapSyntax = {
    languageForPath: languageForPath,
    highlightToLines: highlightToLines,
    renderLine: renderLine,
    isAvailable: function () {
      return hljsApi() !== null;
    }
  };
})();
