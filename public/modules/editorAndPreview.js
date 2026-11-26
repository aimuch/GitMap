/* GitMap Upgraded Code Editor & Rich Inline Previewers */
(function () {
  'use strict';

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function detectExt(filePath) {
    const base = String(filePath || '').split(/[\\/]/).pop() || '';
    const dot = base.lastIndexOf('.');
    return dot >= 0 ? base.slice(dot + 1).toLowerCase() : '';
  }

  function getPreviewKind(filePath) {
    const base = (String(filePath || '').split(/[\\/]/).pop() || '').toLowerCase();
    if (base === 'git-rebase-todo' || base.endsWith('.git-rebase-todo')) return 'rebase-todo';
    const ext = detectExt(filePath);
    if (['md', 'markdown', 'mdx'].includes(ext)) return 'markdown';
    if (['xlsx', 'xlsm', 'xls', 'ods'].includes(ext)) return 'excel';
    if (['csv', 'tsv'].includes(ext)) return 'csv';
    if (['jsonl', 'ndjson', 'jsonlines'].includes(ext)) return 'jsonl';
    if (ext === 'docx') return 'docx';
    if (ext === 'pptx') return 'pptx';
    if (['zip', 'vsix', 'whl', 'jar', 'apk', 'nupkg', 'epub'].includes(ext)) return 'archive';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'avif'].includes(ext)) return 'image';
    if (ext === 'svg') return 'svg';
    if (ext === 'json') return 'json';
    if (['html', 'htm'].includes(ext)) return 'html';
    if (ext === 'pdf') return 'pdf';
    if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) return 'audio';
    if (['mp4', 'webm', 'mov'].includes(ext)) return 'video';
    return null;
  }

  function isBinaryPreviewKind(kind) {
    return ['excel', 'docx', 'pptx', 'archive', 'image', 'pdf', 'audio', 'video'].includes(kind || '');
  }

  function shouldDefaultRichPreview(kind) {
    return ['rebase-todo', 'markdown', 'excel', 'csv', 'jsonl', 'docx', 'pptx', 'archive', 'image', 'svg', 'pdf', 'audio', 'video'].includes(kind || '');
  }

  function buildRawFileUrl(meta) {
    const params = new URLSearchParams();
    if (meta.repo) params.set('repo', meta.repo);
    if (meta.hostId) params.set('hostId', meta.hostId);
    if (meta.commit && meta.commit !== '*') params.set('commit', meta.commit);
    if (meta.filePath) params.set('path', meta.filePath);
    return '/api/file-raw?' + params.toString();
  }

  function beginAsyncPreview(container) {
    const next = (container.__gmPreviewSeq || 0) + 1;
    container.__gmPreviewSeq = next;
    return next;
  }

  function isCurrentAsyncPreview(container, seq) {
    return container && container.isConnected && container.__gmPreviewSeq === seq;
  }

  /** Debounced input helper with IME composition awareness & Escape-to-clear. */
  function bindDebouncedFilter(input, onChange, delayMs) {
    let timer = 0;
    let composing = false;
    const ms = delayMs || 140;
    const fire = (immediate) => {
      if (timer) { clearTimeout(timer); timer = 0; }
      if (immediate) onChange(input.value);
      else timer = setTimeout(() => { timer = 0; onChange(input.value); }, ms);
    };
    input.addEventListener('compositionstart', () => { composing = true; });
    input.addEventListener('compositionend', () => { composing = false; fire(false); });
    input.addEventListener('input', () => { if (!composing) fire(false); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && input.value) {
        e.preventDefault();
        e.stopPropagation();
        input.value = '';
        fire(true);
      }
    });
  }

  function resolveRelativeRepoPath(baseFilePath, relSrc) {
    const cleanSrc = String(relSrc || '').split('#')[0].split('?')[0].trim();
    if (!cleanSrc) return '';
    if (cleanSrc.startsWith('/')) return cleanSrc.replace(/^\/+/, '');
    const baseParts = String(baseFilePath || '').replace(/\\/g, '/').split('/');
    baseParts.pop(); // remove filename
    for (const seg of cleanSrc.replace(/\\/g, '/').split('/')) {
      if (!seg || seg === '.') continue;
      if (seg === '..') {
        if (baseParts.length > 0) baseParts.pop();
      } else {
        baseParts.push(seg);
      }
    }
    return baseParts.join('/');
  }

  function colIndexToLetters(idx) {
    let n = idx + 1;
    let out = '';
    while (n > 0) {
      const rem = (n - 1) % 26;
      out = String.fromCharCode(65 + rem) + out;
      n = Math.floor((n - 1) / 26);
    }
    return out;
  }

  /* ── 1. Upgraded Code Editor ── */
  function upgradeCodeEditor(textarea, filePath, options) {
    if (!textarea || textarea.dataset.gmUpgraded === '1') return null;
    textarea.dataset.gmUpgraded = '1';
    const opts = options || {};
    const parent = textarea.parentElement;
    if (!parent) return null;

    const lang = window.GitMapSyntax ? window.GitMapSyntax.languageForPath(filePath) : null;

    const shell = document.createElement('div');
    shell.className = 'gm-editor-shell';

    const findBar = document.createElement('div');
    findBar.className = 'gm-editor-findbar hidden';
    findBar.innerHTML =
      '<input type="text" class="gm-find-input" placeholder="查找 (Enter 下一个)..." />' +
      '<span class="gm-find-count">0/0</span>' +
      '<button type="button" class="mini-btn gm-find-prev" title="上一个">↑</button>' +
      '<button type="button" class="mini-btn gm-find-next" title="下一个">↓</button>' +
      '<input type="text" class="gm-replace-input" placeholder="替换为..." />' +
      '<button type="button" class="mini-btn gm-replace-one">替换</button>' +
      '<button type="button" class="mini-btn gm-replace-all">全部替换</button>' +
      '<button type="button" class="mini-btn gm-find-close">✕</button>';

    const stage = document.createElement('div');
    stage.className = 'gm-editor-stage';

    const gutter = document.createElement('div');
    gutter.className = 'gm-editor-gutter';

    const codeWrap = document.createElement('div');
    codeWrap.className = 'gm-editor-codewrap';

    const pre = document.createElement('pre');
    pre.className = 'gm-editor-highlight';
    pre.setAttribute('aria-hidden', 'true');

    const statusBar = document.createElement('div');
    statusBar.className = 'gm-editor-statusbar';
    statusBar.innerHTML =
      '<span class="gm-ed-pos">Ln 1, Col 1</span>' +
      '<span class="gm-ed-meta">' + escapeHtml(lang || 'plain text') + ' · Cmd+F 查找 · Cmd+G 跳转行</span>';

    parent.insertBefore(shell, textarea);
    textarea.classList.add('gm-editor-textarea');
    textarea.setAttribute('spellcheck', 'false');
    codeWrap.appendChild(pre);
    codeWrap.appendChild(textarea);
    stage.appendChild(gutter);
    stage.appendChild(codeWrap);
    shell.appendChild(findBar);
    shell.appendChild(stage);
    shell.appendChild(statusBar);

    const posEl = statusBar.querySelector('.gm-ed-pos');
    const findInput = findBar.querySelector('.gm-find-input');
    const replaceInput = findBar.querySelector('.gm-replace-input');
    const findCount = findBar.querySelector('.gm-find-count');

    let rafId = 0;
    let lastMatches = [];
    let matchIdx = -1;

    function renderHighlight() {
      const val = textarea.value;
      const lineCount = val.split('\n').length;
      const nums = new Array(lineCount);
      for (let i = 0; i < lineCount; i++) nums[i] = String(i + 1);
      gutter.textContent = nums.join('\n');

      // Ensure trailing newline renders identically to textarea
      const renderVal = val.endsWith('\n') ? val + ' ' : val;
      if (lang && window.hljs && val.length <= 220000) {
        try {
          pre.innerHTML = window.hljs.highlight(renderVal, { language: lang, ignoreIllegals: true }).value;
        } catch (_) {
          pre.textContent = renderVal;
        }
      } else {
        pre.textContent = renderVal;
      }
      updateCursorPos();
    }

    function scheduleRender() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(renderHighlight);
    }

    function syncScroll() {
      pre.scrollTop = textarea.scrollTop;
      pre.scrollLeft = textarea.scrollLeft;
      gutter.scrollTop = textarea.scrollTop;
    }

    function updateCursorPos() {
      const pos = textarea.selectionStart || 0;
      const before = textarea.value.slice(0, pos);
      const lines = before.split('\n');
      const ln = lines.length;
      const col = lines[lines.length - 1].length + 1;
      const total = textarea.value.split('\n').length;
      if (posEl) posEl.textContent = `Ln ${ln}, Col ${col} (${total} lines)`;
    }

    function computeMatches() {
      const q = findInput.value;
      lastMatches = [];
      matchIdx = -1;
      if (!q) {
        findCount.textContent = '0/0';
        return;
      }
      const hay = textarea.value.toLowerCase();
      const needle = q.toLowerCase();
      let idx = 0;
      while ((idx = hay.indexOf(needle, idx)) !== -1) {
        lastMatches.push({ start: idx, end: idx + q.length });
        idx += Math.max(1, needle.length);
        if (lastMatches.length >= 2000) break;
      }
      findCount.textContent = lastMatches.length ? `0/${lastMatches.length}` : '0/0';
    }

    function jumpToMatch(delta) {
      if (!lastMatches.length) computeMatches();
      if (!lastMatches.length) return;
      matchIdx = (matchIdx + delta + lastMatches.length) % lastMatches.length;
      const m = lastMatches[matchIdx];
      findCount.textContent = `${matchIdx + 1}/${lastMatches.length}`;
      textarea.focus();
      textarea.setSelectionRange(m.start, m.end);
      const lineBefore = textarea.value.slice(0, m.start).split('\n').length - 1;
      textarea.scrollTop = Math.max(0, lineBefore * 20 - stage.clientHeight / 3);
      syncScroll();
      updateCursorPos();
    }

    function scrollToLine(lineNumber) {
      const target = Math.max(1, Number(lineNumber) || 1);
      const lines = textarea.value.split('\n');
      let offset = 0;
      for (let i = 0; i < Math.min(target - 1, lines.length); i++) {
        offset += lines[i].length + 1;
      }
      const lineLen = (lines[target - 1] || '').length;
      textarea.focus();
      textarea.setSelectionRange(offset, offset + lineLen);
      textarea.scrollTop = Math.max(0, (target - 1) * 20 - stage.clientHeight / 3);
      syncScroll();
      updateCursorPos();
    }

    textarea.addEventListener('input', scheduleRender);
    textarea.addEventListener('scroll', syncScroll);
    textarea.addEventListener('click', updateCursorPos);
    textarea.addEventListener('keyup', updateCursorPos);

    // Tab / Shift+Tab / Auto-close brackets / Cmd+F / Cmd+G
    const PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };
    textarea.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'f' || e.key === 'F' || e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        e.stopPropagation();
        findBar.classList.remove('hidden');
        const sel = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
        if (sel && !sel.includes('\n')) findInput.value = sel;
        findInput.focus();
        findInput.select();
        computeMatches();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        e.stopPropagation();
        const ans = window.prompt('跳转到行号 / Go to line:', '1');
        if (ans && /^\d+$/.test(ans.trim())) scrollToLine(Number(ans.trim()));
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const val = textarea.value;
        if (e.shiftKey) {
          const lineStart = val.lastIndexOf('\n', start - 1) + 1;
          if (val.slice(lineStart, lineStart + 2) === '  ') {
            textarea.value = val.slice(0, lineStart) + val.slice(lineStart + 2);
            textarea.setSelectionRange(Math.max(lineStart, start - 2), Math.max(lineStart, end - 2));
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
          }
        } else {
          textarea.value = val.slice(0, start) + '  ' + val.slice(end);
          textarea.setSelectionRange(start + 2, start + 2);
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && PAIRS[e.key]) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        if (start !== end) {
          e.preventDefault();
          const val = textarea.value;
          textarea.value = val.slice(0, start) + e.key + val.slice(start, end) + PAIRS[e.key] + val.slice(end);
          textarea.setSelectionRange(start + 1, end + 1);
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    });

    findInput.addEventListener('input', computeMatches);
    findInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        jumpToMatch(e.shiftKey ? -1 : 1);
      } else if (e.key === 'Escape') {
        findBar.classList.add('hidden');
        textarea.focus();
      }
    });
    findBar.querySelector('.gm-find-prev').addEventListener('click', () => jumpToMatch(-1));
    findBar.querySelector('.gm-find-next').addEventListener('click', () => jumpToMatch(1));
    findBar.querySelector('.gm-find-close').addEventListener('click', () => {
      findBar.classList.add('hidden');
      textarea.focus();
    });
    findBar.querySelector('.gm-replace-one').addEventListener('click', () => {
      if (matchIdx < 0 || !lastMatches[matchIdx]) {
        jumpToMatch(1);
        return;
      }
      const m = lastMatches[matchIdx];
      const rep = replaceInput.value;
      textarea.value = textarea.value.slice(0, m.start) + rep + textarea.value.slice(m.end);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      computeMatches();
      jumpToMatch(0);
    });
    findBar.querySelector('.gm-replace-all').addEventListener('click', () => {
      const q = findInput.value;
      if (!q) return;
      const rep = replaceInput.value;
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      textarea.value = textarea.value.replace(re, rep);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      computeMatches();
    });

    renderHighlight();
    if (opts.initialLine) {
      setTimeout(() => scrollToLine(opts.initialLine), 30);
    }

    return { scrollToLine, renderHighlight };
  }

  /* ── 2. Markdown Renderer (DocsView-inspired: Frontmatter, GitHub Alerts, Heading Outline, GFM Tables, Relative Images) ── */
  const MD_ALERT_META = {
    note: { label: 'NOTE', icon: 'ℹ' },
    tip: { label: 'TIP', icon: '💡' },
    important: { label: 'IMPORTANT', icon: '❗' },
    warning: { label: 'WARNING', icon: '⚠' },
    caution: { label: 'CAUTION', icon: '🛑' }
  };

  function parseMarkdownFrontmatter(lines) {
    if (!lines.length || lines[0].trim() !== '---') return null;
    let endIdx = -1;
    for (let k = 1; k < Math.min(lines.length, 80); k++) {
      if (/^(---|\.\.\.)\s*$/.test(lines[k])) {
        endIdx = k;
        break;
      }
    }
    if (endIdx < 1) return null;
    const entries = [];
    let curKey = null;
    for (let k = 1; k < endIdx; k++) {
      const ln = lines[k];
      if (!ln.trim() || ln.trim().startsWith('#')) continue;
      const kv = /^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/.exec(ln);
      if (kv) {
        curKey = kv[1];
        entries.push({ key: curKey, value: kv[2].trim().replace(/^["']|["']$/g, '') });
      } else if (curKey && /^\s+-\s+(.*)$/.test(ln)) {
        const item = ln.replace(/^\s+-\s+/, '').trim().replace(/^["']|["']$/g, '');
        const last = entries[entries.length - 1];
        if (last) last.value = last.value ? last.value + ', ' + item : item;
      }
    }
    if (!entries.length) return null;
    return { entries, nextIndex: endIdx + 1 };
  }

  function renderMarkdownHtml(mdText, meta, headingsOut) {
    const lines = String(mdText || '').replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let i = 0;
    let headingSeq = 0;

    // Optional YAML frontmatter card
    const fm = parseMarkdownFrontmatter(lines);
    if (fm) {
      out.push(
        '<div class="gm-md-frontmatter"><div class="gm-md-fm-grid">' +
        fm.entries.map((e) => `<span class="gm-md-fm-k">${escapeHtml(e.key)}</span><span class="gm-md-fm-v">${escapeHtml(e.value || '—')}</span>`).join('') +
        '</div></div>'
      );
      i = fm.nextIndex;
    }

    function resolveImgSrc(rawUrl) {
      const u = String(rawUrl || '').trim();
      if (/^https?:\/\//i.test(u) || /^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(u)) {
        return u;
      }
      if (meta && (meta.repo || meta.filePath) && !/^[a-z]+:/i.test(u)) {
        const resolved = resolveRelativeRepoPath(meta.filePath || '', u);
        if (resolved) {
          return buildRawFileUrl({
            repo: meta.repo || '',
            commit: meta.commit || '',
            filePath: resolved
          });
        }
      }
      return '';
    }

    function inlineFmt(str) {
      // Extract inline code spans first so markdown syntax inside backticks stays literal
      const codeSlots = [];
      let s = String(str || '').replace(/`([^`]+)`/g, (_m, code) => {
        const idx = codeSlots.length;
        codeSlots.push('<code>' + escapeHtml(code) + '</code>');
        return `\x00CODE${idx}\x00`;
      });
      s = escapeHtml(s);
      // Images ![alt](url)
      s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (_m, alt, url) => {
        const src = resolveImgSrc(url.replace(/&amp;/g, '&'));
        if (!src) return `<span class="gm-md-img-miss">[image: ${alt || url}]</span>`;
        return `<img class="gm-md-img" src="${escapeHtml(src)}" alt="${alt}" loading="lazy" />`;
      });
      // Links [text](https://... or mailto:...)
      s = s.replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^)\s]+)\)/gi, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
      // Same-document anchor links [text](#section)
      s = s.replace(/\[([^\]]+)\]\((#[^)\s]+)\)/g, '<a href="$2" class="gm-md-anchor-link" data-anchor="$2">$1</a>');
      // Relative repo file links [text](path)
      s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text, target) => {
        const clean = target.replace(/&amp;/g, '&');
        if (/^[a-z]+:/i.test(clean)) return `<span class="gm-md-rel-link" title="${escapeHtml(clean)}">${text}</span>`;
        return `<a href="#" class="gm-md-rel-link is-clickable" data-rel="${escapeHtml(clean)}" title="${escapeHtml(clean)}">${text}</a>`;
      });
      s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
      s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
      s = s.replace(/\x00CODE(\d+)\x00/g, (_m, idx) => codeSlots[Number(idx)] || '');
      return s;
    }

    function slugifyHeading(text) {
      return String(text || '')
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fa5 -]+/g, '')
        .trim()
        .replace(/\s+/g, '-');
    }

    function splitMdTableRow(rowStr) {
      const trimmed = String(rowStr || '').trim().replace(/^\|/, '').replace(/(^|[^\\])\|$/, '$1');
      const cells = [];
      let cur = '';
      for (let k = 0; k < trimmed.length; k++) {
        if (trimmed[k] === '\\' && trimmed[k + 1] === '|') {
          cur += '|';
          k++;
        } else if (trimmed[k] === '|') {
          cells.push(cur.trim());
          cur = '';
        } else {
          cur += trimmed[k];
        }
      }
      cells.push(cur.trim());
      return cells;
    }

    while (i < lines.length) {
      const line = lines[i];
      // Fenced code block (``` or ~~~)
      const fence = /^(```|~~~)([a-zA-Z0-9_+-]*)\s*$/.exec(line);
      if (fence) {
        const marker = fence[1];
        const lang = (fence[2] || '').toLowerCase();
        const codeLines = [];
        i++;
        while (i < lines.length && !new RegExp('^' + marker + '\\s*$').test(lines[i])) {
          codeLines.push(lines[i]);
          i++;
        }
        i++; // skip closing fence
        const code = codeLines.join('\n');
        if (lang === 'mermaid') {
          out.push(
            '<div class="gm-enh-card" style="margin:10px 0">' +
            '<div class="gm-enh-card-head"><span>Mermaid Diagram</span><span class="gm-badge info">mermaid</span></div>' +
            '<pre style="margin-top:8px"><code>' + escapeHtml(code) + '</code></pre></div>'
          );
        } else {
          let hi = escapeHtml(code);
          if (lang && window.hljs && window.hljs.getLanguage(lang) && code.length <= 60000) {
            try { hi = window.hljs.highlight(code, { language: lang, ignoreIllegals: true }).value; } catch (_) {}
          }
          out.push(
            '<div class="gm-md-codewrap">' +
            '<div class="gm-md-codehead">' +
            `<span class="gm-md-codelang">${escapeHtml(lang || 'text')}</span>` +
            '<button type="button" class="gm-md-codecopy" title="Copy code">Copy</button>' +
            '</div>' +
            '<pre><code>' + hi + '</code></pre></div>'
          );
        }
        continue;
      }
      // Heading
      const hm = /^(#{1,6})\s+(.+?)\s*#*$/.exec(line);
      if (hm) {
        const lvl = hm[1].length;
        const hid = 'gm-md-h-' + (++headingSeq);
        const plainTitle = hm[2].replace(/`([^`]+)`/g, '$1').replace(/[*_~]/g, '').trim();
        const slug = slugifyHeading(plainTitle);
        if (Array.isArray(headingsOut) && lvl <= 4) {
          headingsOut.push({ id: hid, slug, level: lvl, text: plainTitle });
        }
        out.push(`<h${lvl} id="${hid}" data-slug="${escapeHtml(slug)}">${inlineFmt(hm[2])}</h${lvl}>`);
        i++;
        continue;
      }
      // Horizontal rule
      if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(line)) {
        out.push('<hr />');
        i++;
        continue;
      }
      // Blockquote or GitHub Alert (> [!NOTE|TIP|IMPORTANT|WARNING|CAUTION])
      if (/^>\s?/.test(line)) {
        const rawQLines = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          rawQLines.push(lines[i].replace(/^>\s?/, ''));
          i++;
        }
        const alertM = rawQLines.length > 0 ? /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i.exec(rawQLines[0].trim()) : null;
        if (alertM) {
          const kindKey = alertM[1].toLowerCase();
          const am = MD_ALERT_META[kindKey] || MD_ALERT_META.note;
          const bodyHtml = rawQLines.slice(1).map((ql) => inlineFmt(ql)).join('<br/>');
          out.push(
            `<div class="gm-md-alert alert-${kindKey}">` +
            `<div class="gm-md-alert-title"><span>${am.icon}</span><span>${am.label}</span></div>` +
            `<div class="gm-md-alert-body">${bodyHtml}</div></div>`
          );
        } else {
          out.push('<blockquote>' + rawQLines.map((ql) => inlineFmt(ql)).join('<br/>') + '</blockquote>');
        }
        continue;
      }
      // GFM Table (with alignment & escaped \| support)
      if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(lines[i + 1])) {
        const headers = splitMdTableRow(line);
        const aligns = splitMdTableRow(lines[i + 1]).map((sep) => {
          if (sep.startsWith(':') && sep.endsWith(':')) return 'center';
          if (sep.endsWith(':')) return 'right';
          return 'left';
        });
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
          rows.push(splitMdTableRow(lines[i]));
          i++;
        }
        out.push(
          '<div class="gm-md-table-scroll"><table><thead><tr>' +
          headers.map((h, ci) => `<th style="text-align:${aligns[ci] || 'left'}">${inlineFmt(h)}</th>`).join('') +
          '</tr></thead><tbody>' +
          rows.map((r) => '<tr>' + headers.map((_, ci) => `<td style="text-align:${aligns[ci] || 'left'}">${inlineFmt(r[ci] || '')}</td>`).join('') + '</tr>').join('') +
          '</tbody></table></div>'
        );
        continue;
      }
      // Unordered / task list
      if (/^\s*[-*+]\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
          const indent = Math.min(3, Math.floor((lines[i].match(/^(\s*)/)[1].length) / 2));
          let item = lines[i].replace(/^\s*[-*+]\s+/, '');
          if (/^\[x\]\s+/i.test(item)) item = '<input type="checkbox" checked disabled /> ' + inlineFmt(item.slice(4));
          else if (/^\[\s\]\s+/.test(item)) item = '<input type="checkbox" disabled /> ' + inlineFmt(item.slice(4));
          else item = inlineFmt(item);
          items.push(`<li${indent ? ` style="margin-left:${indent * 16}px"` : ''}>` + item + '</li>');
          i++;
        }
        out.push('<ul>' + items.join('') + '</ul>');
        continue;
      }
      // Ordered list
      if (/^\s*\d+\.\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          items.push('<li>' + inlineFmt(lines[i].replace(/^\s*\d+\.\s+/, '')) + '</li>');
          i++;
        }
        out.push('<ol>' + items.join('') + '</ol>');
        continue;
      }
      if (!line.trim()) {
        i++;
        continue;
      }
      // Paragraph
      const pLines = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|~~~|>\s?|\s*[-*+]\s|\s*\d+\.\s|(\*{3,}|-{3,}|_{3,})\s*$)/.test(lines[i])) {
        if (lines[i].includes('|') && i + 1 < lines.length && /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(lines[i + 1])) break;
        pLines.push(inlineFmt(lines[i]));
        i++;
      }
      if (pLines.length) out.push('<p>' + pLines.join('<br/>') + '</p>');
    }
    return out.join('\n');
  }

  function renderMarkdownPreview(container, content, rawMeta, onOpenRelativeFile) {
    const zh = !(window.GitMapApp && window.GitMapApp.state && window.GitMapApp.state.lang === 'en');
    const headings = [];
    const html = renderMarkdownHtml(content, rawMeta, headings);
    let outlineOpen = headings.length >= 2 && container.clientWidth >= 820;
    let fluidWidth = localStorage.getItem('gitmap.md.fluid') === '1';

    const shell = document.createElement('div');
    shell.className = 'gm-md-shell';
    const lineCount = String(content || '').split('\n').length;
    const charCount = String(content || '').length;

    shell.innerHTML =
      '<div class="gm-md-toolbar">' +
      '<div class="gm-md-toolbar-left">' +
      (headings.length > 0
        ? `<button type="button" class="mini-btn act-md-outline ${outlineOpen ? 'primary' : ''}">☰ ${escapeHtml(zh ? '目录大纲' : 'Outline')} (${headings.length})</button>`
        : '') +
      `<button type="button" class="mini-btn act-md-width ${fluidWidth ? 'primary' : ''}">${escapeHtml(fluidWidth ? (zh ? '宽度：铺满' : 'Width: Full') : (zh ? '宽度：阅读' : 'Width: Reading'))}</button>` +
      '</div>' +
      `<span class="gm-tbl-stats">${lineCount} ${escapeHtml(zh ? '行' : 'lines')} · ${charCount.toLocaleString()} ${escapeHtml(zh ? '字符' : 'chars')}</span>` +
      '</div>' +
      '<div class="gm-md-main">' +
      (headings.length > 0
        ? `<aside class="gm-md-outline${outlineOpen ? '' : ' hidden'}"><div class="gm-md-outline-title">${escapeHtml(zh ? '文档目录' : 'Table of Contents')}</div>` +
          headings.map((h, hi) => `<button type="button" class="gm-md-toc-item lvl-${h.level}${hi === 0 ? ' active' : ''}" data-target="${h.id}" title="${escapeHtml(h.text)}">${escapeHtml(h.text)}</button>`).join('') +
          '</aside>'
        : '') +
      `<div class="gm-md-scroll"><div class="gm-rich-preview gm-md-body${fluidWidth ? ' is-fluid' : ''}">${html}</div></div>` +
      '</div>';

    const outlineEl = shell.querySelector('.gm-md-outline');
    const outlineBtn = shell.querySelector('.act-md-outline');
    const widthBtn = shell.querySelector('.act-md-width');
    const mdScroll = shell.querySelector('.gm-md-scroll');
    const mdBody = shell.querySelector('.gm-md-body');

    outlineBtn?.addEventListener('click', () => {
      outlineOpen = !outlineOpen;
      outlineEl?.classList.toggle('hidden', !outlineOpen);
      outlineBtn.classList.toggle('primary', outlineOpen);
    });
    widthBtn?.addEventListener('click', () => {
      fluidWidth = !fluidWidth;
      localStorage.setItem('gitmap.md.fluid', fluidWidth ? '1' : '0');
      mdBody?.classList.toggle('is-fluid', fluidWidth);
      widthBtn.classList.toggle('primary', fluidWidth);
      widthBtn.textContent = fluidWidth ? (zh ? '宽度：铺满' : 'Width: Full') : (zh ? '宽度：阅读' : 'Width: Reading');
    });

    const tocButtons = Array.from(shell.querySelectorAll('.gm-md-toc-item'));
    const headingEls = headings.map((h) => shell.querySelector('#' + h.id)).filter(Boolean);
    const setActiveToc = (id) => {
      tocButtons.forEach((b) => b.classList.toggle('active', b.getAttribute('data-target') === id));
    };

    outlineEl?.addEventListener('click', (e) => {
      const btn = e.target.closest('.gm-md-toc-item');
      if (!btn) return;
      const id = btn.getAttribute('data-target');
      const target = id ? shell.querySelector('#' + id) : null;
      if (target) {
        setActiveToc(id);
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    if (headingEls.length > 0 && mdScroll) {
      let scrollRaf = 0;
      mdScroll.addEventListener('scroll', () => {
        if (scrollRaf) return;
        scrollRaf = requestAnimationFrame(() => {
          scrollRaf = 0;
          const topBase = mdScroll.getBoundingClientRect().top + 48;
          let activeId = headingEls[0].id;
          for (const el of headingEls) {
            if (el.getBoundingClientRect().top <= topBase) activeId = el.id;
            else break;
          }
          setActiveToc(activeId);
        });
      }, { passive: true });
    }

    // Delegated click handler for code copy, in-doc anchors, and clickable relative repo file links
    mdBody?.addEventListener('click', (e) => {
      const copyBtn = e.target.closest('.gm-md-codecopy');
      if (copyBtn) {
        const code = copyBtn.closest('.gm-md-codewrap')?.querySelector('pre code')?.textContent || '';
        navigator.clipboard?.writeText(code).catch(() => {});
        copyBtn.textContent = zh ? '已复制' : 'Copied';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1200);
        return;
      }
      const anchor = e.target.closest('.gm-md-anchor-link');
      if (anchor) {
        e.preventDefault();
        const rawAnchor = decodeURIComponent(String(anchor.getAttribute('data-anchor') || '').slice(1)).toLowerCase();
        const match = headingEls.find((el) => el.getAttribute('data-slug') === rawAnchor || el.id === rawAnchor);
        if (match) match.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      const relLink = e.target.closest('.gm-md-rel-link.is-clickable');
      if (relLink && typeof onOpenRelativeFile === 'function') {
        e.preventDefault();
        const rel = relLink.getAttribute('data-rel') || '';
        const resolved = resolveRelativeRepoPath(rawMeta.filePath || '', rel);
        if (resolved) onOpenRelativeFile(resolved);
      }
    });

    container.innerHTML = '';
    container.appendChild(shell);
  }

  /* ── 3. CSV / TSV / JSON Table Renderer (DocsView-inspired: Auto-Delimiter, Crosshair, JSON Cell Expander) ── */
  function detectCsvDelimiter(text) {
    const sample = String(text || '')
      .replace(/\r\n/g, '\n')
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .slice(0, 10);
    if (!sample.length) return ',';
    const candidates = [',', ';', '\t', '|'];
    let bestDelim = ',';
    let bestScore = -1;
    for (const d of candidates) {
      const counts = sample.map((line) => {
        let c = 0;
        let inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') inQ = !inQ;
          else if (!inQ && ch === d) c++;
        }
        return c;
      });
      const nonZero = counts.filter((n) => n > 0);
      if (!nonZero.length) continue;
      const first = counts[0];
      const consistent = counts.filter((n) => n === first && n > 0).length;
      const avg = nonZero.reduce((a, b) => a + b, 0) / sample.length;
      const score = consistent * 10 + avg;
      if (score > bestScore) {
        bestScore = score;
        bestDelim = d;
      }
    }
    return bestDelim;
  }

  function parseDelimited(text, delim) {
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;
    const s = String(text || '');
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (inQuotes) {
        if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') inQuotes = false;
        else cell += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === delim) { row.push(cell); cell = ''; }
        else if (ch === '\n' || ch === '\r') {
          if (ch === '\r' && s[i + 1] === '\n') i++;
          row.push(cell);
          if (row.some((c) => c !== '')) rows.push(row);
          row = [];
          cell = '';
        } else {
          cell += ch;
        }
      }
    }
    if (cell !== '' || row.length > 0) {
      row.push(cell);
      rows.push(row);
    }
    return rows;
  }

  function tryParseJsonString(str) {
    const t = String(str || '').trim();
    if (t.length < 2) return null;
    if (!((t[0] === '{' && t[t.length - 1] === '}') || (t[0] === '[' && t[t.length - 1] === ']'))) return null;
    try {
      const parsed = JSON.parse(t);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (_) {}
    return null;
  }

  function highlightJsonHtml(value) {
    const pretty = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    if (window.hljs && window.hljs.getLanguage('json') && pretty.length <= 40000) {
      try {
        return window.hljs.highlight(pretty, { language: 'json', ignoreIllegals: true }).value;
      } catch (_) {}
    }
    return escapeHtml(pretty);
  }

  function isNumericCellText(v) {
    const s = String(v ?? '').trim();
    if (!s || s.length > 28) return false;
    return /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?%?$/i.test(s);
  }

  function exportTextDownload(fileName, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportRowsAsCsv(fileName, headers, rows) {
    const csvCell = (v) => {
      const s = String(v ?? '');
      return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [headers.map(csvCell).join(','), ...rows.map((r) => headers.map((_, ci) => csvCell(r[ci] ?? '')).join(','))];
    exportTextDownload(fileName, '\ufeff' + lines.join('\r\n'), 'text/csv;charset=utf-8');
  }

  function formatByteSize(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1024 * 1024 * 1024) return (n / (1024 * 1024)).toFixed(2) + ' MB';
    return (n / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }

  function renderSpreadsheetInto(container, allRows, opts) {
    const cfg = opts || {};
    const zh = !(window.GitMapApp && window.GitMapApp.state && window.GitMapApp.state.lang === 'en');
    let useFirstRowHeader = cfg.useFirstRowHeader !== false && allRows.length > 0;
    let sortCol = -1;
    let sortAsc = true;
    let filterText = '';
    let selectedCell = null; // { ref, val, parsedJson, rowPos, colIdx, td }
    let jsonPreviewOpen = false;
    let cellExpandOpen = false;

    // O(1) active crosshair highlight tracking (avoids scanning full DOM)
    let activeTd = null;
    let activeRow = null;
    let activeColHeader = null;
    let activeColCells = [];

    const maxCols = Math.max(1, allRows.reduce((m, r) => Math.max(m, r.length), 0));
    const delimCtrl = cfg.delimiterControl || null;
    const delimHtml = delimCtrl
      ? `<label class="inline-check gm-delim-picker"><span>${escapeHtml(zh ? '分隔符' : 'Delim')}</span><select class="gm-csv-delim-select">` +
        [
          [',', ', (Comma)'],
          [';', '; (Semicolon)'],
          ['\t', 'TAB'],
          ['|', '| (Pipe)']
        ].map(([v, lbl]) => `<option value="${escapeHtml(v)}"${delimCtrl.current === v ? ' selected' : ''}>${escapeHtml(lbl)}</option>`).join('') +
        '</select></label>'
      : '';

    const wrap = document.createElement('div');
    wrap.className = 'gm-rich-preview gm-sheet-wrap';
    wrap.innerHTML =
      '<div class="gm-table-toolbar">' +
      '<div class="gm-table-toolbar-left">' +
      '<input type="text" class="gm-tbl-filter" placeholder="' + escapeHtml(zh ? '筛选表格行… (Esc 清空)' : 'Filter rows… (Esc to clear)') + '" />' +
      (cfg.allowHeaderToggle !== false
        ? `<label class="inline-check"><input type="checkbox" class="gm-tbl-hdr-toggle" ${useFirstRowHeader ? 'checked' : ''} /> <span>${escapeHtml(zh ? '首行作为表头' : 'First row as header')}</span></label>`
        : '') +
      delimHtml +
      (cfg.badgeText ? `<span class="gm-badge info">${escapeHtml(cfg.badgeText)}</span>` : '') +
      '</div>' +
      '<div class="gm-table-toolbar-right">' +
      '<span class="gm-tbl-stats"></span>' +
      '<button type="button" class="mini-btn gm-tbl-export-csv">' + escapeHtml(zh ? '导出 CSV' : 'Export CSV') + '</button>' +
      '</div>' +
      '</div>' +
      '<div class="gm-cell-bar hidden"><span class="gm-cell-ref"></span><span class="gm-cell-val"></span><button type="button" class="mini-btn gm-cell-expand hidden">' + escapeHtml(zh ? '展开全文' : 'Expand') + '</button><button type="button" class="mini-btn gm-cell-json hidden">{ } JSON</button><button type="button" class="mini-btn gm-cell-copy">' + escapeHtml(zh ? '复制' : 'Copy') + '</button></div>' +
      '<pre class="gm-cell-json-box hidden"><code></code></pre>' +
      '<div class="gm-tbl-mount" tabindex="0"></div>';

    const filterInput = wrap.querySelector('.gm-tbl-filter');
    const hdrToggle = wrap.querySelector('.gm-tbl-hdr-toggle');
    const delimSelect = wrap.querySelector('.gm-csv-delim-select');
    const statsEl = wrap.querySelector('.gm-tbl-stats');
    const exportBtn = wrap.querySelector('.gm-tbl-export-csv');
    const cellBar = wrap.querySelector('.gm-cell-bar');
    const cellRefEl = wrap.querySelector('.gm-cell-ref');
    const cellValEl = wrap.querySelector('.gm-cell-val');
    const cellExpandBtn = wrap.querySelector('.gm-cell-expand');
    const cellJsonBtn = wrap.querySelector('.gm-cell-json');
    const cellJsonBox = wrap.querySelector('.gm-cell-json-box');
    const cellCopyBtn = wrap.querySelector('.gm-cell-copy');
    const mount = wrap.querySelector('.gm-tbl-mount');

    function clearCrosshair() {
      if (activeTd) activeTd.classList.remove('gm-cell-active');
      if (activeRow) activeRow.classList.remove('gm-row-active');
      if (activeColHeader) activeColHeader.classList.remove('gm-col-active');
      for (let i = 0; i < activeColCells.length; i++) activeColCells[i].classList.remove('gm-col-active');
      activeTd = null;
      activeRow = null;
      activeColHeader = null;
      activeColCells = [];
    }

    function selectTd(td) {
      if (!td) return;
      clearCrosshair();
      const rowTr = td.parentElement;
      const rNum = td.getAttribute('data-r');
      const rPos = Number(td.getAttribute('data-ri'));
      const cIdx = Number(td.getAttribute('data-c'));
      td.classList.add('gm-cell-active');
      rowTr?.classList.add('gm-row-active');
      const table = mount.querySelector('table.gm-data-table');
      const th = table ? table.querySelector(`th[data-col="${cIdx}"]`) : null;
      if (th) th.classList.add('gm-col-active');
      const tbody = table ? table.tBodies[0] : null;
      const colCells = [];
      if (tbody) {
        const trs = tbody.rows;
        const domCellIdx = cIdx + 1; // col 0 is row index gutter
        for (let i = 0; i < trs.length; i++) {
          const cell = trs[i].cells[domCellIdx];
          if (cell) {
            cell.classList.add('gm-col-active');
            colCells.push(cell);
          }
        }
      }
      activeTd = td;
      activeRow = rowTr;
      activeColHeader = th;
      activeColCells = colCells;

      const val = td.textContent || '';
      const parsedJson = tryParseJsonString(val);
      const isLongText = val.length > 70 || val.includes('\n');
      selectedCell = { ref: colIndexToLetters(cIdx) + rNum, val, parsedJson, rowPos: rPos, colIdx: cIdx };
      cellRefEl.textContent = selectedCell.ref;
      cellValEl.textContent = selectedCell.val;
      cellBar.classList.remove('hidden');
      cellJsonBtn.classList.toggle('hidden', !parsedJson);
      cellExpandBtn.classList.toggle('hidden', !isLongText || !!parsedJson);

      if (jsonPreviewOpen && parsedJson) {
        cellJsonBox.querySelector('code').innerHTML = highlightJsonHtml(parsedJson);
        cellJsonBox.classList.remove('hidden');
      } else if (cellExpandOpen && isLongText && !parsedJson) {
        cellJsonBox.querySelector('code').textContent = val;
        cellJsonBox.classList.remove('hidden');
      } else {
        jsonPreviewOpen = false;
        cellExpandOpen = false;
        cellJsonBox.classList.add('hidden');
        cellJsonBtn.classList.remove('primary');
        cellExpandBtn.classList.remove('primary');
      }
    }

    function getHeadersAndBody() {
      if (useFirstRowHeader && allRows.length > 0) {
        const hdr = [];
        for (let c = 0; c < maxCols; c++) {
          const v = allRows[0][c];
          hdr.push(v !== undefined && v !== '' ? String(v) : colIndexToLetters(c));
        }
        return { headers: hdr, body: allRows.slice(1), rowOffset: 2 };
      }
      const hdr = [];
      for (let c = 0; c < maxCols; c++) hdr.push(colIndexToLetters(c));
      return { headers: hdr, body: allRows, rowOffset: 1 };
    }

    let renderedRowsCount = 0;
    let renderedColsCount = 0;

    function draw() {
      clearCrosshair();
      selectedCell = null;
      const { headers, body, rowOffset } = getHeadersAndBody();
      const q = filterText.trim().toLowerCase();
      let indexed = body.map((r, i) => ({ r, origRow: i + rowOffset }));
      if (q) indexed = indexed.filter((item) => item.r.some((c) => String(c ?? '').toLowerCase().includes(q)));
      if (sortCol >= 0) {
        indexed.sort((a, b) => {
          const av = String(a.r[sortCol] ?? '');
          const bv = String(b.r[sortCol] ?? '');
          const na = Number(av), nb = Number(bv);
          const cmp = isFinite(na) && isFinite(nb) && av !== '' && bv !== '' ? na - nb : av.localeCompare(bv);
          return sortAsc ? cmp : -cmp;
        });
      }
      const display = indexed.slice(0, 1000);
      renderedRowsCount = display.length;
      renderedColsCount = headers.length;
      const totalRowsNum = cfg.totalRows ? Math.max(cfg.totalRows - (useFirstRowHeader ? 1 : 0), body.length) : body.length;
      const truncNote = (cfg.truncated || indexed.length > 1000) ? (zh ? '（展示前 1000 行）' : ' (first 1000)') : '';
      statsEl.textContent = zh
        ? `${display.length} / ${totalRowsNum} 行 · ${headers.length} 列${truncNote}`
        : `${display.length} / ${totalRowsNum} rows · ${headers.length} cols${truncNote}`;

      if (allRows.length === 0) {
        mount.innerHTML = `<div class="browser-empty-state">${escapeHtml(zh ? '当前工作表为空。' : 'This sheet is empty.')}</div>`;
        return;
      }

      mount.innerHTML =
        '<table class="gm-data-table"><thead><tr><th class="gm-row-idx-th">#</th>' +
        headers.map((h, ci) => `<th data-col="${ci}" title="${escapeHtml(colIndexToLetters(ci) + ': ' + h)}"><span class="gm-col-letter">${colIndexToLetters(ci)}</span> ${escapeHtml(h)}${sortCol === ci ? (sortAsc ? ' ▲' : ' ▼') : ''}</th>`).join('') +
        '</tr></thead><tbody>' +
        display.map((item, ri) =>
          `<tr><td class="gm-row-idx-td">${item.origRow}</td>` +
          headers.map((_, ci) => {
            const val = item.r[ci] ?? '';
            const numCls = isNumericCellText(val) ? ' class="is-num"' : '';
            return `<td${numCls} data-ri="${ri}" data-r="${item.origRow}" data-c="${ci}" title="${escapeHtml(val)}">${escapeHtml(val)}</td>`;
          }).join('') +
          '</tr>'
        ).join('') +
        '</tbody></table>';
    }

    // Single delegated click listener for headers (sort) and data cells (select + crosshair)
    mount.addEventListener('click', (e) => {
      const th = e.target.closest('th[data-col]');
      if (th && mount.contains(th)) {
        const ci = Number(th.getAttribute('data-col'));
        if (sortCol === ci) sortAsc = !sortAsc;
        else { sortCol = ci; sortAsc = true; }
        draw();
        return;
      }
      const td = e.target.closest('td[data-c]');
      if (td && mount.contains(td)) {
        selectTd(td);
        mount.focus({ preventScroll: true });
      }
    });

    // Double-click any cell to expand full value / formatted JSON immediately
    mount.addEventListener('dblclick', (e) => {
      const td = e.target.closest('td[data-c]');
      if (!td || !mount.contains(td)) return;
      selectTd(td);
      if (!selectedCell) return;
      if (selectedCell.parsedJson) {
        jsonPreviewOpen = true;
        cellExpandOpen = false;
        cellJsonBtn.classList.add('primary');
        cellJsonBox.querySelector('code').innerHTML = highlightJsonHtml(selectedCell.parsedJson);
        cellJsonBox.classList.remove('hidden');
      } else {
        cellExpandOpen = true;
        jsonPreviewOpen = false;
        cellExpandBtn.classList.remove('hidden');
        cellExpandBtn.classList.add('primary');
        cellJsonBox.querySelector('code').textContent = selectedCell.val;
        cellJsonBox.classList.remove('hidden');
      }
    });

    // Keyboard navigation (Arrow keys + Cmd/Ctrl+C) when table is focused
    mount.addEventListener('keydown', (e) => {
      if (!selectedCell) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c' && !window.getSelection()?.toString()) {
        e.preventDefault();
        cellCopyBtn.click();
        return;
      }
      let nextR = selectedCell.rowPos;
      let nextC = selectedCell.colIdx;
      if (e.key === 'ArrowDown') nextR = Math.min(renderedRowsCount - 1, nextR + 1);
      else if (e.key === 'ArrowUp') nextR = Math.max(0, nextR - 1);
      else if (e.key === 'ArrowRight') nextC = Math.min(renderedColsCount - 1, nextC + 1);
      else if (e.key === 'ArrowLeft') nextC = Math.max(0, nextC - 1);
      else return;
      e.preventDefault();
      const table = mount.querySelector('table.gm-data-table');
      const tr = table && table.tBodies[0] ? table.tBodies[0].rows[nextR] : null;
      const targetTd = tr ? tr.cells[nextC + 1] : null;
      if (targetTd) {
        selectTd(targetTd);
        targetTd.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    });

    cellJsonBtn.addEventListener('click', () => {
      if (!selectedCell || !selectedCell.parsedJson) return;
      jsonPreviewOpen = !jsonPreviewOpen;
      cellExpandOpen = false;
      cellJsonBtn.classList.toggle('primary', jsonPreviewOpen);
      cellExpandBtn.classList.remove('primary');
      cellJsonBox.classList.toggle('hidden', !jsonPreviewOpen);
      if (jsonPreviewOpen) {
        cellJsonBox.querySelector('code').innerHTML = highlightJsonHtml(selectedCell.parsedJson);
      }
    });

    cellExpandBtn.addEventListener('click', () => {
      if (!selectedCell) return;
      cellExpandOpen = !cellExpandOpen;
      jsonPreviewOpen = false;
      cellExpandBtn.classList.toggle('primary', cellExpandOpen);
      cellJsonBtn.classList.remove('primary');
      cellJsonBox.classList.toggle('hidden', !cellExpandOpen);
      if (cellExpandOpen) {
        cellJsonBox.querySelector('code').textContent = selectedCell.val;
      }
    });

    bindDebouncedFilter(filterInput, (val) => { filterText = val; draw(); }, 140);
    hdrToggle?.addEventListener('change', () => { useFirstRowHeader = hdrToggle.checked; sortCol = -1; draw(); });
    delimSelect?.addEventListener('change', () => {
      if (delimCtrl && typeof delimCtrl.onChange === 'function') delimCtrl.onChange(delimSelect.value);
    });
    exportBtn.addEventListener('click', () => {
      const { headers, body } = getHeadersAndBody();
      const base = (cfg.exportName || 'sheet').replace(/\.[^.]+$/, '') + '.csv';
      exportRowsAsCsv(base, headers, body);
    });
    cellCopyBtn.addEventListener('click', () => {
      if (!selectedCell) return;
      const toCopy = selectedCell.parsedJson && jsonPreviewOpen
        ? JSON.stringify(selectedCell.parsedJson, null, 2)
        : selectedCell.val;
      navigator.clipboard?.writeText(toCopy).catch(() => {});
      window.GitMapApp?.showToast?.((zh ? '已复制单元格 ' : 'Copied cell ') + selectedCell.ref, 'status');
    });

    draw();
    container.innerHTML = '';
    container.appendChild(wrap);
  }

  function renderInteractiveTable(container, headers, rows) {
    renderSpreadsheetInto(container, [headers, ...rows], { useFirstRowHeader: true, allowHeaderToggle: false });
  }

  /* ── 4. Better-JSONL Viewer (Formatted Cards, Grid View, Chat Feed, Query Syntax, Nested JSON Unpack) ── */
  function getByDotPath(obj, dotPath) {
    if (obj == null || typeof obj !== 'object') return undefined;
    const parts = String(dotPath || '').split('.').filter(Boolean);
    let cur = obj;
    for (const part of parts) {
      if (cur == null || typeof cur !== 'object') return undefined;
      cur = cur[part];
    }
    return cur;
  }

  function tokenizeJsonlQuery(query) {
    const tokens = [];
    let cur = '';
    const raw = String(query || '').trim();
    // Keep field="quoted value" as a single token
    let inQ = '';
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (inQ) {
        if (ch === inQ) inQ = '';
        else cur += ch;
      } else if (ch === '"' || ch === "'") {
        inQ = ch;
      } else if (/\s/.test(ch)) {
        if (cur) { tokens.push(cur); cur = ''; }
      } else {
        cur += ch;
      }
    }
    if (cur) tokens.push(cur);
    return tokens;
  }

  function matchesJsonlQuery(rec, tokens) {
    if (!tokens.length) return true;
    for (const tok of tokens) {
      const m = /^([A-Za-z0-9_.-]+)(!=|>=|<=|>|<|=|:)(.+)$/.exec(tok);
      if (m) {
        if (rec.error || rec.value == null || typeof rec.value !== 'object') return false;
        const fieldVal = getByDotPath(rec.value, m[1]);
        const op = m[2];
        const rhs = m[3];
        if (op === '>' || op === '>=' || op === '<' || op === '<=') {
          const nVal = Number(fieldVal);
          const nRhs = Number(rhs);
          if (!isFinite(nVal) || !isFinite(nRhs) || fieldVal === '' || fieldVal == null) return false;
          if (op === '>' && !(nVal > nRhs)) return false;
          if (op === '>=' && !(nVal >= nRhs)) return false;
          if (op === '<' && !(nVal < nRhs)) return false;
          if (op === '<=' && !(nVal <= nRhs)) return false;
        } else {
          const sVal = fieldVal == null ? '' : (typeof fieldVal === 'object' ? JSON.stringify(fieldVal) : String(fieldVal));
          const lVal = sVal.toLowerCase();
          const lRhs = rhs.toLowerCase();
          if (op === '=' && lVal !== lRhs) return false;
          if (op === '!=' && lVal === lRhs) return false;
          if (op === ':' && !lVal.includes(lRhs)) return false;
        }
      } else {
        if (!rec.rawLower.includes(tok.toLowerCase())) return false;
      }
    }
    return true;
  }

  function extractChatTurnsFromArray(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const turns = [];
    for (const item of arr) {
      if (!item || typeof item !== 'object') return null;
      const rawRole = item.role ?? item.from ?? item.speaker ?? item.author;
      if (typeof rawRole !== 'string' || !rawRole.trim()) return null;
      let role = rawRole.toLowerCase();
      if (role === 'human') role = 'user';
      else if (role === 'gpt' || role === 'model' || role === 'bot') role = 'assistant';
      else if (role === 'function' || role === 'observation') role = 'tool';

      let thinking = '';
      if (typeof item.reasoning_content === 'string') thinking += item.reasoning_content;
      else if (typeof item.thinking === 'string') thinking += item.thinking;
      else if (typeof item.reasoning === 'string') thinking += item.reasoning;

      let text = '';
      if (typeof item.content === 'string') {
        text = item.content;
      } else if (typeof item.value === 'string') {
        text = item.value;
      } else if (Array.isArray(item.content)) {
        const parts = [];
        for (const p of item.content) {
          if (typeof p === 'string') parts.push(p);
          else if (p && typeof p === 'object') {
            if ((p.type === 'thinking' || p.type === 'reasoning') && (p.thinking || p.text)) {
              thinking += (thinking ? '\n' : '') + String(p.thinking || p.text);
            } else if (typeof p.text === 'string') parts.push(p.text);
            else if (p.type === 'image_url') parts.push('[image]');
            else parts.push(JSON.stringify(p));
          }
        }
        text = parts.join('\n');
      } else if (Array.isArray(item.parts)) {
        const parts = [];
        for (const p of item.parts) {
          if (typeof p === 'string') parts.push(p);
          else if (p && typeof p === 'object') {
            if (p.thought && typeof p.text === 'string') thinking += (thinking ? '\n' : '') + p.text;
            else if (typeof p.text === 'string') parts.push(p.text);
            else parts.push(JSON.stringify(p));
          }
        }
        text = parts.join('\n');
      }

      // Extract inline <think>...</think> blocks (DeepSeek / QwQ / Claude style)
      if (text && text.includes('<think>')) {
        text = text.replace(/<think>([\s\S]*?)<\/think>/gi, (_m, inner) => {
          thinking += (thinking ? '\n' : '') + String(inner || '').trim();
          return '';
        }).trim();
      }

      const toolCalls = Array.isArray(item.tool_calls) ? item.tool_calls : null;
      turns.push({ role, rawRole, text, thinking: thinking.trim(), toolCalls });
    }
    return turns.length > 0 ? turns : null;
  }

  function detectLlmChat(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
    for (const key of ['messages', 'conversations', 'contents', 'history', 'dialogue']) {
      if (Array.isArray(obj[key])) {
        const turns = extractChatTurnsFromArray(obj[key]);
        if (turns) return { mode: 'single', field: key, turns };
      }
    }
    // DPO / RLHF chosen vs rejected
    const chosen = Array.isArray(obj.chosen) ? extractChatTurnsFromArray(obj.chosen) : null;
    const rejected = Array.isArray(obj.rejected) ? extractChatTurnsFromArray(obj.rejected) : null;
    if (chosen && rejected) {
      return { mode: 'dpo', field: 'chosen/rejected', chosen, rejected };
    }
    return null;
  }

  function renderChatTurnsHtml(turns, zh) {
    return '<div class="gm-chat-thread">' + turns.map((t) => {
      const roleCls = ['system', 'user', 'assistant', 'tool'].includes(t.role) ? t.role : 'other';
      const thinkHtml = t.thinking
        ? `<details class="gm-chat-think"><summary>💭 ${escapeHtml(zh ? '思考过程' : 'Thinking')} (${t.thinking.length} ${escapeHtml(zh ? '字' : 'chars')})</summary><pre>${escapeHtml(t.thinking)}</pre></details>`
        : '';
      const toolHtml = t.toolCalls
        ? `<details class="gm-chat-think"><summary>🔧 tool_calls (${t.toolCalls.length})</summary><pre><code>${highlightJsonHtml(t.toolCalls)}</code></pre></details>`
        : '';
      return (
        `<div class="gm-chat-msg role-${roleCls}">` +
        `<div class="gm-chat-role"><span class="gm-chat-role-pill role-${roleCls}">${escapeHtml(t.rawRole)}</span></div>` +
        thinkHtml +
        (t.text ? `<div class="gm-chat-content">${escapeHtml(t.text)}</div>` : '') +
        toolHtml +
        '</div>'
      );
    }).join('') + '</div>';
  }

  function renderChatRecordBodyHtml(chat, zh) {
    if (chat.mode === 'dpo') {
      return (
        '<div class="gm-chat-dpo">' +
        `<div class="gm-chat-dpo-col"><div class="gm-chat-dpo-head is-chosen">✓ Chosen (${chat.chosen.length})</div>${renderChatTurnsHtml(chat.chosen, zh)}</div>` +
        `<div class="gm-chat-dpo-col"><div class="gm-chat-dpo-head is-rejected">✕ Rejected (${chat.rejected.length})</div>${renderChatTurnsHtml(chat.rejected, zh)}</div>` +
        '</div>'
      );
    }
    return renderChatTurnsHtml(chat.turns, zh);
  }

  function renderJsonlCardBodyHtml(value, zh) {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
      return `<pre class="gm-jsonl-pre"><code>${highlightJsonHtml(value)}</code></pre>`;
    }
    const entries = Object.entries(value);
    if (!entries.length) return '<pre class="gm-jsonl-pre"><code>{}</code></pre>';
    return '<div class="gm-jsonl-kv-list">' + entries.map(([k, v], idx) => {
      const isStr = typeof v === 'string';
      const nestedObj = isStr ? tryParseJsonString(v) : null;
      let valHtml;
      if (v === null) valHtml = '<span class="gm-jv-null">null</span>';
      else if (typeof v === 'boolean') valHtml = `<span class="gm-jv-bool">${v}</span>`;
      else if (typeof v === 'number') valHtml = `<span class="gm-jv-num">${v}</span>`;
      else if (isStr) {
        valHtml = `<span class="gm-jv-str">${escapeHtml(v)}</span>`;
        if (nestedObj) {
          valHtml += ` <button type="button" class="mini-btn gm-jsonl-unpack" data-kidx="${idx}">{ } ${escapeHtml(zh ? '解包 JSON' : 'Unpack JSON')}</button>` +
            `<pre class="gm-jsonl-nested hidden" data-kidx="${idx}"><code>${highlightJsonHtml(nestedObj)}</code></pre>`;
        }
      } else {
        valHtml = `<pre class="gm-jsonl-pre"><code>${highlightJsonHtml(v)}</code></pre>`;
      }
      return `<div class="gm-jsonl-kv"><span class="gm-jsonl-k">${escapeHtml(k)}</span><div class="gm-jsonl-v">${valHtml}</div></div>`;
    }).join('') + '</div>';
  }

  function renderJsonlPreview(container, filePath, content) {
    const zh = !(window.GitMapApp && window.GitMapApp.state && window.GitMapApp.state.lang === 'en');
    const rawLines = String(content || '').replace(/\r\n/g, '\n').split('\n');
    const records = [];
    let errorCount = 0;
    let totalChatCount = 0;
    for (let idx = 0; idx < rawLines.length; idx++) {
      const raw = rawLines[idx];
      if (!raw.trim()) continue;
      const rawLower = raw.toLowerCase();
      try {
        const value = JSON.parse(raw);
        const chat = detectLlmChat(value);
        if (chat) totalChatCount++;
        records.push({ lineNo: idx + 1, raw, rawLower, value, error: null, chat });
      } catch (err) {
        errorCount++;
        records.push({ lineNo: idx + 1, raw, rawLower, value: null, error: err && err.message ? err.message : 'Invalid JSON', chat: null });
      }
    }

    let viewMode = 'cards'; // 'cards' | 'chat' | 'grid'
    let queryText = '';
    let onlyErrors = false;
    let allExpanded = records.length <= 25;
    let pageLimit = 120;
    const expandedSet = new Set();
    const chatOpenSet = new Set();
    const recByLineAll = new Map(records.map((r) => [r.lineNo, r]));
    let lastFiltered = records;

    const shell = document.createElement('div');
    shell.className = 'gm-jsonl-shell';
    shell.innerHTML =
      '<div class="gm-jsonl-toolbar">' +
      '<div class="gm-jsonl-toolbar-left">' +
      '<div class="gm-jsonl-mode-group">' +
      `<button type="button" class="mini-btn primary act-jl-cards">${escapeHtml(zh ? '卡片视图' : 'Cards')}</button>` +
      (totalChatCount > 0 ? `<button type="button" class="mini-btn act-jl-chatfeed">💬 ${escapeHtml(zh ? '对话流' : 'Chat')} (${totalChatCount})</button>` : '') +
      `<button type="button" class="mini-btn act-jl-grid">${escapeHtml(zh ? '网格视图' : 'Grid')}</button>` +
      '</div>' +
      `<input type="text" class="gm-jsonl-query" placeholder="${escapeHtml(zh ? '过滤: 关键词 / key=val / key:子串 / score>0.8 (Esc 清空)' : 'Filter: text / key=val / key:sub / score>0.8 (Esc)')}" />` +
      (errorCount > 0 ? `<button type="button" class="mini-btn act-jl-only-err">⚠ ${escapeHtml(zh ? '仅看异常行' : 'Invalid Only')} (${errorCount})</button>` : '') +
      '</div>' +
      '<div class="gm-jsonl-toolbar-right">' +
      '<span class="gm-tbl-stats gm-jsonl-stats"></span>' +
      `<button type="button" class="mini-btn act-jl-expand">${escapeHtml(allExpanded ? (zh ? '全部折叠' : 'Collapse All') : (zh ? '全部展开' : 'Expand All'))}</button>` +
      `<button type="button" class="mini-btn act-jl-export">${escapeHtml(zh ? '导出过滤结果' : 'Export Filtered')}</button>` +
      '</div>' +
      '</div>' +
      '<div class="gm-jsonl-host"></div>';

    const cardsBtn = shell.querySelector('.act-jl-cards');
    const chatFeedBtn = shell.querySelector('.act-jl-chatfeed');
    const gridBtn = shell.querySelector('.act-jl-grid');
    const queryInput = shell.querySelector('.gm-jsonl-query');
    const onlyErrBtn = shell.querySelector('.act-jl-only-err');
    const statsEl = shell.querySelector('.gm-jsonl-stats');
    const expandBtn = shell.querySelector('.act-jl-expand');
    const exportBtn = shell.querySelector('.act-jl-export');
    const host = shell.querySelector('.gm-jsonl-host');

    function getSummaryPills(obj) {
      if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) {
        const s = JSON.stringify(obj);
        return `<span class="gm-jsonl-pill">${escapeHtml(s.length > 72 ? s.slice(0, 72) + '…' : s)}</span>`;
      }
      const preferred = ['id', 'idx', 'name', 'model', 'role', 'type', 'status', 'label', 'score', 'task', 'category', 'prompt', 'question', 'input'];
      const keys = Object.keys(obj);
      const picked = [];
      for (const pk of preferred) {
        if (keys.includes(pk) && picked.length < 3) picked.push(pk);
      }
      for (const k of keys) {
        if (!picked.includes(k) && picked.length < 3 && (typeof obj[k] !== 'object' || obj[k] === null)) {
          picked.push(k);
        }
      }
      if (!picked.length) {
        return `<span class="gm-jsonl-pill">${keys.length} ${escapeHtml(zh ? '个字段' : 'keys')}</span>`;
      }
      return picked.map((k) => {
        const rawV = obj[k];
        const vStr = typeof rawV === 'object' && rawV !== null ? JSON.stringify(rawV) : String(rawV ?? '');
        const clipped = vStr.length > 48 ? vStr.slice(0, 48) + '…' : vStr;
        return `<span class="gm-jsonl-pill"><b>${escapeHtml(k)}:</b> ${escapeHtml(clipped)}</span>`;
      }).join('');
    }

    function draw() {
      const tokens = tokenizeJsonlQuery(queryText);
      const filtered = records.filter((r) => {
        if (onlyErrors && !r.error) return false;
        if (viewMode === 'chat' && !r.chat) return false;
        return matchesJsonlQuery(r, tokens);
      });
      lastFiltered = filtered;
      const chatCount = filtered.filter((r) => r.chat).length;
      statsEl.innerHTML = escapeHtml(
        zh
          ? `${filtered.length} / ${records.length} 条记录`
          : `${filtered.length} / ${records.length} records`
      ) + (errorCount > 0 ? ` · <span class="gm-jsonl-err-cnt">${errorCount} ${escapeHtml(zh ? '行格式错误' : 'invalid')}</span>` : '')
        + (chatCount > 0 ? ` · 💬 ${chatCount}` : '');

      cardsBtn.classList.toggle('primary', viewMode === 'cards');
      chatFeedBtn?.classList.toggle('primary', viewMode === 'chat');
      gridBtn.classList.toggle('primary', viewMode === 'grid');
      onlyErrBtn?.classList.toggle('primary', onlyErrors);
      expandBtn.classList.toggle('hidden', viewMode !== 'cards');

      if (!filtered.length) {
        host.innerHTML = `<div class="browser-empty-state">${escapeHtml(zh ? '没有匹配当前筛选条件的 JSONL 记录。' : 'No JSONL records match the current filter.')}</div>`;
        return;
      }

      if (viewMode === 'grid') {
        const keySet = new Set();
        const validObjs = filtered.filter((r) => !r.error && r.value && typeof r.value === 'object' && !Array.isArray(r.value));
        validObjs.slice(0, 500).forEach((r) => Object.keys(r.value).forEach((k) => keySet.add(k)));
        const cols = Array.from(keySet);
        const headers = ['#Line', ...(cols.length ? cols : ['Value'])];
        const rows = filtered.map((r) => {
          if (r.error) return [String(r.lineNo), `[Invalid JSON] ${r.raw}`, ...new Array(Math.max(0, cols.length - 1)).fill('')];
          if (!cols.length || !r.value || typeof r.value !== 'object' || Array.isArray(r.value)) {
            return [String(r.lineNo), typeof r.value === 'object' ? JSON.stringify(r.value) : String(r.value ?? '')];
          }
          return [
            String(r.lineNo),
            ...cols.map((k) => {
              const v = r.value[k];
              return v === undefined ? '' : (typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v));
            })
          ];
        });
        renderSpreadsheetInto(host, [headers, ...rows], {
          useFirstRowHeader: true,
          allowHeaderToggle: false,
          exportName: (filePath || 'data').split(/[\\/]/).pop()
        });
        return;
      }

      // Cards or Continuous Chat Feed view
      const visible = filtered.slice(0, pageLimit);
      const isChatFeed = viewMode === 'chat';
      const listHtml = visible.map((r) => {
        const isExp = isChatFeed || (allExpanded ? !expandedSet.has(-r.lineNo) : expandedSet.has(r.lineNo));
        const isChatOpen = isChatFeed || chatOpenSet.has(r.lineNo);
        const chatBadge = !isChatFeed && r.chat
          ? (r.chat.mode === 'dpo'
              ? `<button type="button" class="mini-btn act-jl-chat${isChatOpen ? ' primary' : ''}" data-ln="${r.lineNo}">💬 DPO (${r.chat.chosen.length}/${r.chat.rejected.length})</button>`
              : `<button type="button" class="mini-btn act-jl-chat${isChatOpen ? ' primary' : ''}" data-ln="${r.lineNo}">💬 ${escapeHtml(zh ? '对话阅读' : 'Chat')} (${r.chat.turns.length})</button>`)
          : '';
        let bodyHtml = '';
        if (r.error) {
          bodyHtml = `<div class="gm-jsonl-err-body"><div class="error-text">${escapeHtml(r.error)}</div><pre class="gm-jsonl-pre"><code>${escapeHtml(r.raw)}</code></pre></div>`;
        } else if (isChatOpen && r.chat) {
          bodyHtml = renderChatRecordBodyHtml(r.chat, zh);
        } else if (isExp) {
          bodyHtml = renderJsonlCardBodyHtml(r.value, zh);
        }

        return (
          `<div class="gm-jsonl-card${r.error ? ' is-error' : ''}" data-ln="${r.lineNo}">` +
          `<div class="gm-jsonl-card-head">` +
          (!isChatFeed ? `<button type="button" class="gm-jsonl-toggle" data-ln="${r.lineNo}">${isExp || isChatOpen || r.error ? '▾' : '▸'}</button>` : '') +
          `<span class="gm-jsonl-ln">#${r.lineNo}</span>` +
          `<div class="gm-jsonl-summary">${r.error ? `<span class="gm-badge danger">Invalid JSON</span>` : getSummaryPills(r.value)}</div>` +
          `<div class="gm-jsonl-card-acts">${chatBadge}<button type="button" class="mini-btn act-jl-copy" data-ln="${r.lineNo}">${escapeHtml(zh ? '复制' : 'Copy')}</button></div>` +
          `</div>` +
          (bodyHtml ? `<div class="gm-jsonl-card-body">${bodyHtml}</div>` : '') +
          `</div>`
        );
      }).join('');

      const moreHtml = filtered.length > pageLimit
        ? `<div class="gm-jsonl-more"><button type="button" class="mini-btn primary act-jl-more">${escapeHtml(zh ? `加载更多（当前 ${visible.length} / ${filtered.length} 条）` : `Load more (${visible.length} / ${filtered.length})`)}</button></div>`
        : '';

      host.innerHTML = `<div class="gm-jsonl-cards">${listHtml}${moreHtml}</div>`;
    }

    // Single delegated click listener for all JSONL card controls
    host.addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('.gm-jsonl-toggle');
      if (toggleBtn) {
        const ln = Number(toggleBtn.getAttribute('data-ln'));
        if (chatOpenSet.has(ln)) chatOpenSet.delete(ln);
        if (allExpanded) {
          if (expandedSet.has(-ln)) expandedSet.delete(-ln);
          else expandedSet.add(-ln);
        } else {
          if (expandedSet.has(ln)) expandedSet.delete(ln);
          else expandedSet.add(ln);
        }
        draw();
        return;
      }
      const chatBtn = e.target.closest('.act-jl-chat');
      if (chatBtn) {
        const ln = Number(chatBtn.getAttribute('data-ln'));
        if (chatOpenSet.has(ln)) chatOpenSet.delete(ln);
        else chatOpenSet.add(ln);
        draw();
        return;
      }
      const copyBtn = e.target.closest('.act-jl-copy');
      if (copyBtn) {
        const rec = recByLineAll.get(Number(copyBtn.getAttribute('data-ln')));
        if (!rec) return;
        const text = rec.error ? rec.raw : JSON.stringify(rec.value, null, 2);
        navigator.clipboard?.writeText(text).catch(() => {});
        window.GitMapApp?.showToast?.((zh ? '已复制第 ' : 'Copied line #') + rec.lineNo + (zh ? ' 行 JSON' : ''), 'status');
        return;
      }
      const unpackBtn = e.target.closest('.gm-jsonl-unpack');
      if (unpackBtn) {
        const kidx = unpackBtn.getAttribute('data-kidx');
        const pre = unpackBtn.parentElement?.querySelector(`.gm-jsonl-nested[data-kidx="${kidx}"]`);
        if (!pre) return;
        const hidden = pre.classList.toggle('hidden');
        unpackBtn.classList.toggle('primary', !hidden);
        return;
      }
      if (e.target.closest('.act-jl-more')) {
        pageLimit += 150;
        draw();
      }
    });

    cardsBtn.addEventListener('click', () => { viewMode = 'cards'; draw(); });
    chatFeedBtn?.addEventListener('click', () => { viewMode = 'chat'; pageLimit = 60; draw(); });
    gridBtn.addEventListener('click', () => { viewMode = 'grid'; draw(); });
    onlyErrBtn?.addEventListener('click', () => { onlyErrors = !onlyErrors; pageLimit = 120; draw(); });
    bindDebouncedFilter(queryInput, (val) => { queryText = val; pageLimit = 120; draw(); }, 140);
    expandBtn.addEventListener('click', () => {
      allExpanded = !allExpanded;
      expandedSet.clear();
      expandBtn.textContent = allExpanded ? (zh ? '全部折叠' : 'Collapse All') : (zh ? '全部展开' : 'Expand All');
      draw();
    });
    exportBtn.addEventListener('click', () => {
      const base = (filePath || 'filtered').split(/[\\/]/).pop().replace(/\.[^.]+$/, '') + '-filtered.jsonl';
      exportTextDownload(base, lastFiltered.map((r) => r.raw).join('\n') + '\n', 'application/x-ndjson;charset=utf-8');
    });

    draw();
    container.innerHTML = '';
    container.appendChild(shell);
  }

  /* ── 5. Office & Archive Previews (Excel / Word / PowerPoint / ZIP Archives, race-safe) ── */
  function renderExcelWorkbook(container, filePath, meta) {
    const app = window.GitMapApp;
    const zh = !(app && app.state && app.state.lang === 'en');
    const reqSeq = beginAsyncPreview(container);
    container.innerHTML = `<div class="browser-empty-state"><span class="fb-spinner"></span>${escapeHtml(zh ? '正在解析工作簿…' : 'Parsing workbook…')}</div>`;
    if (!app || !app.rpc) return;
    const reqPath = (meta && (meta.sourceUri || meta.filePath)) || filePath;
    app.rpc('file:parsePreview', {
      repo: (meta && meta.repo) || '',
      filePath: reqPath,
      commit: (meta && meta.commit) || undefined
    }).then((res) => {
      if (!isCurrentAsyncPreview(container, reqSeq)) return;
      const preview = res && res.preview;
      if (!preview || preview.kind !== 'spreadsheet' || !Array.isArray(preview.sheets) || preview.sheets.length === 0) {
        container.innerHTML = `<div class="browser-empty-state">${escapeHtml(zh ? '工作簿中没有可预览的工作表。' : 'No sheets found in workbook.')}</div>`;
        return;
      }
      let activeSheetIdx = 0;
      const shell = document.createElement('div');
      shell.className = 'gm-workbook-shell';
      const tabBar = document.createElement('div');
      tabBar.className = 'gm-sheet-tabs';
      const sheetHost = document.createElement('div');
      sheetHost.className = 'gm-sheet-host';
      shell.appendChild(tabBar);
      shell.appendChild(sheetHost);
      container.innerHTML = '';
      container.appendChild(shell);

      const renderTabsAndSheet = () => {
        tabBar.innerHTML = preview.sheets.map((s, idx) =>
          `<button type="button" class="gm-sheet-tab${idx === activeSheetIdx ? ' active' : ''}" data-sidx="${idx}">${escapeHtml(s.name)} <span class="gm-sheet-tab-cnt">${s.totalRows}</span></button>`
        ).join('') + `<span class="gm-sheet-format-tag">${escapeHtml(preview.format.toUpperCase())} · ${preview.sheets.length} ${escapeHtml(zh ? '个工作表' : 'sheet(s)')}${res && res.fromCache ? ' · ⚡' : ''}</span>`;
        const cur = preview.sheets[activeSheetIdx];
        renderSpreadsheetInto(sheetHost, cur.rows || [], {
          useFirstRowHeader: true,
          totalRows: cur.totalRows,
          truncated: cur.truncated,
          exportName: `${(filePath || 'workbook').split(/[\\/]/).pop()}-${cur.name}`
        });
      };
      tabBar.addEventListener('click', (e) => {
        const btn = e.target.closest('.gm-sheet-tab');
        if (!btn) return;
        activeSheetIdx = Number(btn.getAttribute('data-sidx')) || 0;
        renderTabsAndSheet();
      });
      renderTabsAndSheet();
    }).catch((err) => {
      if (!isCurrentAsyncPreview(container, reqSeq)) return;
      container.innerHTML = `<div class="browser-empty-state error-text">${escapeHtml(err && err.message ? err.message : String(err))}</div>`;
    });
  }

  function renderDocxPreview(container, filePath, meta) {
    const app = window.GitMapApp;
    const zh = !(app && app.state && app.state.lang === 'en');
    const reqSeq = beginAsyncPreview(container);
    container.innerHTML = `<div class="browser-empty-state"><span class="fb-spinner"></span>${escapeHtml(zh ? '正在解析 Word 文档…' : 'Parsing Word document…')}</div>`;
    if (!app || !app.rpc) return;
    const reqPath = (meta && (meta.sourceUri || meta.filePath)) || filePath;
    app.rpc('file:parsePreview', {
      repo: (meta && meta.repo) || '',
      filePath: reqPath,
      commit: (meta && meta.commit) || undefined
    }).then((res) => {
      if (!isCurrentAsyncPreview(container, reqSeq)) return;
      const preview = res && res.preview;
      if (!preview || preview.kind !== 'docx' || !Array.isArray(preview.blocks) || preview.blocks.length === 0) {
        container.innerHTML = `<div class="browser-empty-state">${escapeHtml(zh ? '文档内容为空或无文本段落。' : 'Document contains no readable text blocks.')}</div>`;
        return;
      }
      const docHeadings = [];
      let hSeq = 0;
      const html = preview.blocks.map((b) => {
        if (b.type === 'heading') {
          const lvl = Math.min(6, Math.max(1, b.level || 2));
          const hid = 'gm-docx-h-' + (++hSeq);
          docHeadings.push({ id: hid, level: lvl, text: b.text });
          return `<h${lvl} id="${hid}">${escapeHtml(b.text)}</h${lvl}>`;
        }
        if (b.type === 'table') {
          return '<div class="gm-md-table-scroll"><table><tbody>' +
            b.rows.map((r, ri) => '<tr>' + r.map((c) => ri === 0 ? `<th>${escapeHtml(c)}</th>` : `<td>${escapeHtml(c)}</td>`).join('') + '</tr>').join('') +
            '</tbody></table></div>';
        }
        return b.isList
          ? `<p class="gm-docx-list-item">• ${escapeHtml(b.text)}</p>`
          : `<p>${escapeHtml(b.text).replace(/\n/g, '<br/>')}</p>`;
      }).join('\n');
      const note = preview.truncated ? `<div class="gm-docx-note">${escapeHtml(zh ? '（文档较长，仅展示前 1200 个内容块）' : '(Document truncated to first 1200 blocks)')}</div>` : '';
      let fluidWidth = localStorage.getItem('gitmap.md.fluid') === '1';

      const shell = document.createElement('div');
      shell.className = 'gm-md-shell';
      shell.innerHTML =
        '<div class="gm-md-toolbar">' +
        '<div class="gm-md-toolbar-left">' +
        `<span class="gm-badge info">DOCX · ${preview.blocks.length} ${escapeHtml(zh ? '个内容块' : 'blocks')}</span>` +
        (docHeadings.length > 0
          ? `<select class="gm-pptx-jump">${docHeadings.map((h) => `<option value="${h.id}">${'　'.repeat(Math.max(0, h.level - 1))}${escapeHtml(h.text.slice(0, 44))}</option>`).join('')}</select>`
          : '') +
        `<button type="button" class="mini-btn act-docx-width ${fluidWidth ? 'primary' : ''}">${escapeHtml(fluidWidth ? (zh ? '宽度：铺满' : 'Width: Full') : (zh ? '宽度：阅读' : 'Width: Reading'))}</button>` +
        '</div>' +
        '<div class="gm-md-toolbar-left">' +
        `<button type="button" class="mini-btn act-docx-export-md">${escapeHtml(zh ? '导出 Markdown' : 'Export Markdown')}</button>` +
        '</div>' +
        '</div>' +
        `<div class="gm-md-scroll"><div class="gm-rich-preview gm-md-body gm-docx-body${fluidWidth ? ' is-fluid' : ''}">${html}${note}</div></div>`;

      const bodyEl = shell.querySelector('.gm-docx-body');
      const widthBtn = shell.querySelector('.act-docx-width');
      shell.querySelector('.gm-pptx-jump')?.addEventListener('change', (e) => {
        const target = shell.querySelector('#' + e.target.value);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      widthBtn?.addEventListener('click', () => {
        fluidWidth = !fluidWidth;
        localStorage.setItem('gitmap.md.fluid', fluidWidth ? '1' : '0');
        bodyEl?.classList.toggle('is-fluid', fluidWidth);
        widthBtn.classList.toggle('primary', fluidWidth);
        widthBtn.textContent = fluidWidth ? (zh ? '宽度：铺满' : 'Width: Full') : (zh ? '宽度：阅读' : 'Width: Reading');
      });
      shell.querySelector('.act-docx-export-md')?.addEventListener('click', () => {
        const md = preview.blocks.map((b) => {
          if (b.type === 'heading') return '#'.repeat(Math.min(6, Math.max(1, b.level || 2))) + ' ' + b.text;
          if (b.type === 'table' && b.rows.length) {
            const head = b.rows[0];
            return '| ' + head.join(' | ') + ' |\n| ' + head.map(() => '---').join(' | ') + ' |\n' +
              b.rows.slice(1).map((r) => '| ' + head.map((_, ci) => r[ci] || '').join(' | ') + ' |').join('\n');
          }
          return b.isList ? '- ' + b.text : b.text;
        }).join('\n\n');
        const base = (filePath || 'document').split(/[\\/]/).pop().replace(/\.[^.]+$/, '') + '.md';
        exportTextDownload(base, md, 'text/markdown;charset=utf-8');
      });

      container.innerHTML = '';
      container.appendChild(shell);
    }).catch((err) => {
      if (!isCurrentAsyncPreview(container, reqSeq)) return;
      container.innerHTML = `<div class="browser-empty-state error-text">${escapeHtml(err && err.message ? err.message : String(err))}</div>`;
    });
  }

  function renderPptxPreview(container, filePath, meta) {
    const app = window.GitMapApp;
    const zh = !(app && app.state && app.state.lang === 'en');
    const reqSeq = beginAsyncPreview(container);
    container.innerHTML = `<div class="browser-empty-state"><span class="fb-spinner"></span>${escapeHtml(zh ? '正在解析 PowerPoint 演示文稿…' : 'Parsing PowerPoint deck…')}</div>`;
    if (!app || !app.rpc) return;
    const reqPath = (meta && (meta.sourceUri || meta.filePath)) || filePath;
    app.rpc('file:parsePreview', {
      repo: (meta && meta.repo) || '',
      filePath: reqPath,
      commit: (meta && meta.commit) || undefined
    }).then((res) => {
      if (!isCurrentAsyncPreview(container, reqSeq)) return;
      const preview = res && res.preview;
      if (!preview || preview.kind !== 'pptx' || !Array.isArray(preview.slides) || preview.slides.length === 0) {
        container.innerHTML = `<div class="browser-empty-state">${escapeHtml(zh ? '演示文稿中没有可提取的幻灯片内容。' : 'No readable slides found in presentation.')}</div>`;
        return;
      }
      const slides = preview.slides;
      const shell = document.createElement('div');
      shell.className = 'gm-pptx-shell';
      shell.innerHTML =
        '<div class="gm-md-toolbar">' +
        '<div class="gm-md-toolbar-left">' +
        `<span class="gm-badge info">PPTX · ${slides.length} ${escapeHtml(zh ? '页幻灯片' : 'slides')}</span>` +
        `<select class="gm-pptx-jump">${slides.map((s) => `<option value="gm-slide-${s.index}">#${s.index} ${escapeHtml((s.title || '').slice(0, 40))}</option>`).join('')}</select>` +
        '</div>' +
        '<div class="gm-md-toolbar-left">' +
        `<button type="button" class="mini-btn act-pptx-export-md">${escapeHtml(zh ? '导出 Markdown' : 'Export Markdown')}</button>` +
        '</div>' +
        '</div>' +
        '<div class="gm-pptx-deck">' +
        slides.map((s) => {
          const paraHtml = (s.paragraphs || []).length
            ? '<ul class="gm-slide-bullets">' + s.paragraphs.map((p) => `<li>${escapeHtml(p)}</li>`).join('') + '</ul>'
            : '';
          const tblHtml = (s.tables || []).map((rows) =>
            '<div class="gm-md-table-scroll"><table><tbody>' +
            rows.map((r, ri) => '<tr>' + r.map((c) => ri === 0 ? `<th>${escapeHtml(c)}</th>` : `<td>${escapeHtml(c)}</td>`).join('') + '</tr>').join('') +
            '</tbody></table></div>'
          ).join('');
          const notesHtml = s.notes
            ? `<details class="gm-slide-notes"><summary>📝 ${escapeHtml(zh ? '演讲者备注' : 'Speaker Notes')}</summary><p>${escapeHtml(s.notes).replace(/\n/g, '<br/>')}</p></details>`
            : '';
          return (
            `<section class="gm-slide-card" id="gm-slide-${s.index}">` +
            `<div class="gm-slide-head"><span class="gm-slide-num">#${s.index}</span><h3 class="gm-slide-title">${escapeHtml(s.title)}</h3></div>` +
            `<div class="gm-slide-body">${paraHtml}${tblHtml}${!paraHtml && !tblHtml ? `<p class="gm-docx-note">${escapeHtml(zh ? '（无正文文本）' : '(No body text)')}</p>` : ''}</div>` +
            notesHtml +
            '</section>'
          );
        }).join('') +
        (preview.truncated ? `<div class="gm-docx-note">${escapeHtml(zh ? '（演示文稿较长，仅展示前 120 页）' : '(Truncated to first 120 slides)')}</div>` : '') +
        '</div>';

      shell.querySelector('.gm-pptx-jump')?.addEventListener('change', (e) => {
        const target = shell.querySelector('#' + e.target.value);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      shell.querySelector('.act-pptx-export-md')?.addEventListener('click', () => {
        const md = slides.map((s) => {
          const parts = [`## Slide ${s.index}: ${s.title}`];
          if (s.paragraphs && s.paragraphs.length) parts.push(s.paragraphs.map((p) => `- ${p}`).join('\n'));
          for (const tbl of s.tables || []) {
            if (!tbl.length) continue;
            const head = tbl[0];
            parts.push(
              '| ' + head.join(' | ') + ' |\n' +
              '| ' + head.map(() => '---').join(' | ') + ' |\n' +
              tbl.slice(1).map((r) => '| ' + head.map((_, ci) => r[ci] || '').join(' | ') + ' |').join('\n')
            );
          }
          if (s.notes) parts.push('> **Notes:** ' + s.notes.replace(/\n/g, '\n> '));
          return parts.join('\n\n');
        }).join('\n\n---\n\n');
        const base = (filePath || 'slides').split(/[\\/]/).pop().replace(/\.[^.]+$/, '') + '.md';
        exportTextDownload(base, md, 'text/markdown;charset=utf-8');
      });

      container.innerHTML = '';
      container.appendChild(shell);
    }).catch((err) => {
      if (!isCurrentAsyncPreview(container, reqSeq)) return;
      container.innerHTML = `<div class="browser-empty-state error-text">${escapeHtml(err && err.message ? err.message : String(err))}</div>`;
    });
  }

  function renderArchivePreview(container, filePath, meta) {
    const app = window.GitMapApp;
    const zh = !(app && app.state && app.state.lang === 'en');
    const reqSeq = beginAsyncPreview(container);
    container.innerHTML = `<div class="browser-empty-state"><span class="fb-spinner"></span>${escapeHtml(zh ? '正在读取压缩包目录…' : 'Reading archive directory…')}</div>`;
    if (!app || !app.rpc) return;
    const reqPath = (meta && (meta.sourceUri || meta.filePath)) || filePath;
    app.rpc('file:parsePreview', {
      repo: (meta && meta.repo) || '',
      filePath: reqPath,
      commit: (meta && meta.commit) || undefined
    }).then((res) => {
      if (!isCurrentAsyncPreview(container, reqSeq)) return;
      const preview = res && res.preview;
      if (!preview || preview.kind !== 'archive' || !Array.isArray(preview.entries)) {
        container.innerHTML = `<div class="browser-empty-state">${escapeHtml(zh ? '无法解析该压缩包目录。' : 'Unable to inspect archive entries.')}</div>`;
        return;
      }
      const ratio = preview.totalSize > 0
        ? Math.max(0, (1 - preview.totalCompressedSize / preview.totalSize) * 100).toFixed(1) + '%'
        : '0%';
      const headers = zh
        ? ['路径', '类型', '原始大小', '压缩后', '方式']
        : ['Path', 'Kind', 'Size', 'Compressed', 'Method'];
      const rows = preview.entries.map((e) => [
        e.path,
        e.isDirectory ? (zh ? '文件夹' : 'Folder') : (detectExt(e.path).toUpperCase() || (zh ? '文件' : 'File')),
        e.isDirectory ? '—' : formatByteSize(e.size),
        e.isDirectory ? '—' : formatByteSize(e.compressedSize),
        e.isDirectory ? '—' : e.method
      ]);
      renderSpreadsheetInto(container, [headers, ...rows], {
        useFirstRowHeader: true,
        allowHeaderToggle: false,
        truncated: preview.truncated,
        badgeText: zh
          ? `${preview.totalFiles} 个文件 · ${formatByteSize(preview.totalSize)} → ${formatByteSize(preview.totalCompressedSize)} (省 ${ratio})`
          : `${preview.totalFiles} files · ${formatByteSize(preview.totalSize)} → ${formatByteSize(preview.totalCompressedSize)} (${ratio} saved)`,
        exportName: `${(filePath || 'archive').split(/[\\/]/).pop()}-contents`
      });
    }).catch((err) => {
      if (!isCurrentAsyncPreview(container, reqSeq)) return;
      container.innerHTML = `<div class="browser-empty-state error-text">${escapeHtml(err && err.message ? err.message : String(err))}</div>`;
    });
  }

  function renderImagePreview(container, filePath, url) {
    const zh = !(window.GitMapApp && window.GitMapApp.state && window.GitMapApp.state.lang === 'en');
    let zoomMode = 'fit'; // 'fit' | number (scale %)
    let bgMode = 'checker'; // 'checker' | 'dark' | 'light'
    const wrap = document.createElement('div');
    wrap.className = 'gm-image-preview';
    wrap.innerHTML = `
      <div class="gm-image-toolbar">
        <span class="gm-image-dims">${escapeHtml(zh ? '正在加载图片…' : 'Loading image…')}</span>
        <div class="gm-image-controls">
          <button type="button" class="mini-btn act-img-bg" title="${escapeHtml(zh ? '切换透明画布背景（棋盘格 / 暗色 / 亮色）' : 'Cycle canvas background (Checker / Dark / Light)')}">${escapeHtml(zh ? '背景：棋盘格' : 'BG: Checker')}</button>
          <button type="button" class="mini-btn act-img-out" title="${escapeHtml(zh ? '缩小' : 'Zoom Out')}">−</button>
          <span class="gm-image-zoom-lbl">${escapeHtml(zh ? '适应' : 'Fit')}</span>
          <button type="button" class="mini-btn act-img-in" title="${escapeHtml(zh ? '放大' : 'Zoom In')}">+</button>
          <button type="button" class="mini-btn act-img-100">100%</button>
          <button type="button" class="mini-btn primary act-img-fit">${escapeHtml(zh ? '适应窗口' : 'Fit')}</button>
        </div>
      </div>
      <div class="gm-image-stage bg-checker" title="${escapeHtml(zh ? '双击切换 适应/100%，⌘/Ctrl+滚轮缩放，放大后可拖拽平移' : 'Double-click Fit/100%, Ctrl/Cmd+Wheel zoom, drag to pan')}"><img class="gm-preview-img is-fit" src="${escapeHtml(url)}" alt="${escapeHtml(filePath)}" draggable="false" /></div>
    `;
    const stage = wrap.querySelector('.gm-image-stage');
    const img = wrap.querySelector('.gm-preview-img');
    const dimsEl = wrap.querySelector('.gm-image-dims');
    const zoomLbl = wrap.querySelector('.gm-image-zoom-lbl');
    const bgBtn = wrap.querySelector('.act-img-bg');
    const fitBtn = wrap.querySelector('.act-img-fit');
    const btn100 = wrap.querySelector('.act-img-100');

    const applyZoom = (next) => {
      zoomMode = next;
      if (zoomMode === 'fit') {
        img.classList.add('is-fit');
        img.style.width = '';
        stage.classList.remove('is-pannable');
        zoomLbl.textContent = zh ? '适应' : 'Fit';
        fitBtn.classList.add('primary');
        btn100.classList.remove('primary');
      } else {
        const pct = Math.max(10, Math.min(800, Math.round(zoomMode)));
        zoomMode = pct;
        img.classList.remove('is-fit');
        if (img.naturalWidth) img.style.width = Math.round(img.naturalWidth * pct / 100) + 'px';
        stage.classList.add('is-pannable');
        zoomLbl.textContent = pct + '%';
        fitBtn.classList.remove('primary');
        btn100.classList.toggle('primary', pct === 100);
      }
    };
    img.addEventListener('load', () => {
      dimsEl.textContent = `${img.naturalWidth || '?'} × ${img.naturalHeight || '?'} px`;
      if (zoomMode !== 'fit') applyZoom(zoomMode);
    });
    img.addEventListener('error', () => {
      dimsEl.textContent = zh ? '图片加载失败' : 'Failed to load image';
    });

    // Background switcher (Checker -> Dark -> Light)
    const bgOrder = ['checker', 'dark', 'light'];
    const bgLabels = zh ? { checker: '背景：棋盘格', dark: '背景：暗色', light: '背景：亮色' } : { checker: 'BG: Checker', dark: 'BG: Dark', light: 'BG: Light' };
    bgBtn.addEventListener('click', () => {
      bgMode = bgOrder[(bgOrder.indexOf(bgMode) + 1) % bgOrder.length];
      stage.classList.remove('bg-checker', 'bg-dark', 'bg-light');
      stage.classList.add('bg-' + bgMode);
      bgBtn.textContent = bgLabels[bgMode];
    });

    // Double-click Fit <-> 100%
    stage.addEventListener('dblclick', () => applyZoom(zoomMode === 'fit' ? 100 : 'fit'));

    // Ctrl/Cmd + Wheel zoom
    stage.addEventListener('wheel', (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const basePct = zoomMode === 'fit' ? 100 : zoomMode;
      const step = e.deltaY < 0 ? 1.15 : 0.87;
      applyZoom(basePct * step);
    }, { passive: false });

    // Drag-to-pan when zoomed (attaches window listeners only during active drag; zero listener leaks)
    stage.addEventListener('mousedown', (e) => {
      if (zoomMode === 'fit' || e.button !== 0) return;
      const dragState = { x: e.clientX, y: e.clientY, sl: stage.scrollLeft, st: stage.scrollTop };
      stage.classList.add('is-panning');
      const onMove = (ev) => {
        if (!stage.isConnected) { onUp(); return; }
        stage.scrollLeft = dragState.sl - (ev.clientX - dragState.x);
        stage.scrollTop = dragState.st - (ev.clientY - dragState.y);
      };
      const onUp = () => {
        stage.classList.remove('is-panning');
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });

    wrap.querySelector('.act-img-in').addEventListener('click', () => applyZoom(zoomMode === 'fit' ? 125 : zoomMode + 25));
    wrap.querySelector('.act-img-out').addEventListener('click', () => applyZoom(zoomMode === 'fit' ? 75 : zoomMode - 25));
    btn100.addEventListener('click', () => applyZoom(100));
    fitBtn.addEventListener('click', () => applyZoom('fit'));

    container.innerHTML = '';
    container.appendChild(wrap);
  }

  function renderRichPreview(container, filePath, content, meta) {
    const kind = getPreviewKind(filePath);
    if (!kind) return false;
    const rawMeta = {
      repo: (meta && meta.repo) || '',
      hostId: (meta && meta.hostId) || '',
      commit: (meta && meta.commit) || '',
      filePath: (meta && (meta.repo ? meta.filePath : (meta.sourceUri || meta.filePath))) || filePath
    };

    if (kind === 'markdown') {
      renderMarkdownPreview(container, content, rawMeta, meta && meta.onOpenRelativeFile);
      return true;
    }
    if (kind === 'excel') {
      renderExcelWorkbook(container, filePath, meta);
      return true;
    }
    if (kind === 'docx') {
      renderDocxPreview(container, filePath, meta);
      return true;
    }
    if (kind === 'pptx') {
      renderPptxPreview(container, filePath, meta);
      return true;
    }
    if (kind === 'archive') {
      renderArchivePreview(container, filePath, meta);
      return true;
    }
    if (kind === 'jsonl') {
      renderJsonlPreview(container, filePath, content);
      return true;
    }
    if (kind === 'csv') {
      const isTsv = detectExt(filePath) === 'tsv';
      const mountDelimited = (delim) => {
        const rows = parseDelimited(content, delim);
        if (!rows.length) return false;
        renderSpreadsheetInto(container, rows, {
          useFirstRowHeader: true,
          delimiterControl: isTsv ? null : { current: delim, onChange: (nextDelim) => mountDelimited(nextDelim) },
          badgeText: isTsv ? 'TSV' : '',
          exportName: (filePath || 'table').split(/[\\/]/).pop()
        });
        return true;
      };
      return mountDelimited(isTsv ? '\t' : detectCsvDelimiter(content));
    }
    if (kind === 'json') {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0] !== null) {
          const keySet = new Set();
          parsed.slice(0, 200).forEach((obj) => {
            if (obj && typeof obj === 'object') Object.keys(obj).forEach((k) => keySet.add(k));
          });
          const headers = Array.from(keySet);
          const rows = parsed.map((obj) => headers.map((k) => {
            const v = obj && typeof obj === 'object' ? obj[k] : '';
            return typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '');
          }));
          renderInteractiveTable(container, headers, rows);
          return true;
        }
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const rows = Object.entries(parsed).map(([k, v]) => [k, typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '')]);
          renderInteractiveTable(container, ['Key', 'Value'], rows);
          return true;
        }
      } catch (_) {
        return false;
      }
      return false;
    }
    if (kind === 'image' || kind === 'svg') {
      const url = buildRawFileUrl(rawMeta);
      renderImagePreview(container, filePath, url);
      return true;
    }
    if (kind === 'html') {
      const iframe = document.createElement('iframe');
      iframe.className = 'gm-pdf-frame';
      iframe.setAttribute('sandbox', '');
      iframe.setAttribute('title', filePath);
      iframe.srcdoc = String(content || '');
      container.innerHTML = '';
      const box = document.createElement('div');
      box.className = 'gm-media-preview';
      box.appendChild(iframe);
      container.appendChild(box);
      return true;
    }
    if (kind === 'rebase-todo') {
      const zh = window.GitMapApp?.state?.lang === 'zh';
      const SHORT_MAP = { p: 'pick', pick: 'pick', r: 'reword', reword: 'reword', e: 'edit', edit: 'edit', s: 'squash', squash: 'squash', f: 'fixup', fixup: 'fixup', d: 'drop', drop: 'drop' };
      const CMD_MAP = { x: 'exec', exec: 'exec', b: 'break', break: 'break', l: 'label', label: 'label', t: 'reset', reset: 'reset', m: 'merge', merge: 'merge', u: 'update-ref', 'update-ref': 'update-ref' };
      const entries = String(content || '').split(/\r?\n/).map((rawLine) => {
        const t = rawLine.trim();
        if (!t || t.startsWith('#')) return { kind: 'comment', action: '', hash: '', subject: '', rawLine };
        const cm = t.match(/^([a-zA-Z-]+)\s+([0-9a-fA-F]{4,64})(?:\s+(.*))?$/);
        if (cm && SHORT_MAP[cm[1].toLowerCase()]) {
          return { kind: 'commit', action: SHORT_MAP[cm[1].toLowerCase()], hash: cm[2], subject: cm[3] || '', rawLine };
        }
        const xm = t.match(/^([a-zA-Z-]+)(?:\s+(.*))?$/);
        if (xm && CMD_MAP[xm[1].toLowerCase()]) {
          return { kind: 'command', action: CMD_MAP[xm[1].toLowerCase()], hash: '', subject: xm[2] || '', rawLine };
        }
        return { kind: 'comment', action: '', hash: '', subject: '', rawLine };
      });

      const serialize = () => entries.map((e) => {
        if (e.kind === 'commit') return e.subject ? `${e.action} ${e.hash} ${e.subject}` : `${e.action} ${e.hash}`;
        if (e.kind === 'command') return e.subject ? `${e.action} ${e.subject}` : e.action;
        return e.rawLine;
      }).join('\n');

      const renderTodo = () => {
        const activeRows = entries.map((e, idx) => ({ e, idx })).filter((x) => x.e.kind !== 'comment');
        container.innerHTML = `
          <div class="gm-rebase-todo-shell">
            <div class="gm-rebase-todo-head">
              <div>
                <strong>${escapeHtml(zh ? '交互式变基编排器 (git-rebase-todo)' : 'Visual Interactive Rebase Todo Editor')}</strong>
                <span class="gm-rebase-todo-sub">${escapeHtml(zh ? `共 ${activeRows.length} 条变基指令 · 支持调整顺序、切换动作与插入命令` : `${activeRows.length} rebase steps · Reorder, change actions, or insert commands`)}</span>
              </div>
              <div class="gm-rebase-todo-actions">
                <button type="button" class="mini-btn act-rt-exec">+ exec</button>
                <button type="button" class="mini-btn act-rt-break">+ break</button>
                <button type="button" class="mini-btn primary act-rt-save">${escapeHtml(zh ? '保存变基计划' : 'Save Rebase Todo')}</button>
              </div>
            </div>
            <div class="gm-rebase-todo-list">
              ${activeRows.length === 0 ? `<div class="scm-empty">${escapeHtml(zh ? '当前变基计划没有可编辑的提交行' : 'No editable commit steps in this rebase-todo file')}</div>` : activeRows.map(({ e, idx }, pos) => `
                <div class="gm-rebase-row act-${escapeHtml(e.action)}" data-idx="${idx}">
                  <div class="gm-rebase-order">
                    <button type="button" class="mini-icon-btn act-rt-up" data-pos="${pos}" ${pos === 0 ? 'disabled' : ''} title="Move Up">↑</button>
                    <button type="button" class="mini-icon-btn act-rt-down" data-pos="${pos}" ${pos === activeRows.length - 1 ? 'disabled' : ''} title="Move Down">↓</button>
                  </div>
                  ${e.kind === 'commit' ? `
                    <select class="gm-rebase-act-select" data-idx="${idx}">
                      ${['pick', 'reword', 'edit', 'squash', 'fixup', 'drop'].map((a) => `<option value="${a}"${e.action === a ? ' selected' : ''}>${a}</option>`).join('')}
                    </select>
                    <code class="gm-rebase-sha">${escapeHtml(e.hash.slice(0, 8))}</code>
                    <input type="text" class="gm-rebase-subj-input" data-idx="${idx}" value="${escapeHtml(e.subject)}" />
                  ` : `
                    <span class="gm-badge info">${escapeHtml(e.action)}</span>
                    <input type="text" class="gm-rebase-subj-input" data-idx="${idx}" value="${escapeHtml(e.subject)}" placeholder="${escapeHtml(e.action === 'exec' ? 'npm test' : '')}" />
                    <button type="button" class="mini-icon-btn act-rt-del" data-idx="${idx}" title="Remove">✕</button>
                  `}
                </div>
              `).join('')}
            </div>
            <details class="gm-rebase-raw-details">
              <summary>${escapeHtml(zh ? '预览生成的 git-rebase-todo 文本' : 'Preview generated git-rebase-todo text')}</summary>
              <pre class="gm-rebase-raw-pre">${escapeHtml(serialize())}</pre>
            </details>
          </div>
        `;

        container.querySelectorAll('.gm-rebase-act-select').forEach((sel) => {
          sel.addEventListener('change', () => {
            const i = Number(sel.getAttribute('data-idx'));
            if (entries[i]) entries[i].action = sel.value;
            renderTodo();
          });
        });
        container.querySelectorAll('.gm-rebase-subj-input').forEach((inp) => {
          inp.addEventListener('input', () => {
            const i = Number(inp.getAttribute('data-idx'));
            if (entries[i]) entries[i].subject = inp.value;
            const pre = container.querySelector('.gm-rebase-raw-pre');
            if (pre) pre.textContent = serialize();
          });
        });
        const swapPos = (posA, posB) => {
          const idxA = activeRows[posA]?.idx;
          const idxB = activeRows[posB]?.idx;
          if (typeof idxA !== 'number' || typeof idxB !== 'number') return;
          const tmp = entries[idxA];
          entries[idxA] = entries[idxB];
          entries[idxB] = tmp;
          renderTodo();
        };
        container.querySelectorAll('.act-rt-up').forEach((btn) => btn.addEventListener('click', () => swapPos(Number(btn.getAttribute('data-pos')), Number(btn.getAttribute('data-pos')) - 1)));
        container.querySelectorAll('.act-rt-down').forEach((btn) => btn.addEventListener('click', () => swapPos(Number(btn.getAttribute('data-pos')), Number(btn.getAttribute('data-pos')) + 1)));
        container.querySelectorAll('.act-rt-del').forEach((btn) => btn.addEventListener('click', () => {
          entries.splice(Number(btn.getAttribute('data-idx')), 1);
          renderTodo();
        }));
        container.querySelector('.act-rt-exec')?.addEventListener('click', () => {
          const insertAt = activeRows.length > 0 ? activeRows[activeRows.length - 1].idx + 1 : 0;
          entries.splice(insertAt, 0, { kind: 'command', action: 'exec', hash: '', subject: 'echo "check"', rawLine: 'exec echo "check"' });
          renderTodo();
        });
        container.querySelector('.act-rt-break')?.addEventListener('click', () => {
          const insertAt = activeRows.length > 0 ? activeRows[activeRows.length - 1].idx + 1 : 0;
          entries.splice(insertAt, 0, { kind: 'command', action: 'break', hash: '', subject: '', rawLine: 'break' });
          renderTodo();
        });
        container.querySelector('.act-rt-save')?.addEventListener('click', async () => {
          const app = window.GitMapApp;
          if (!app) return;
          try {
            const nextText = serialize();
            await app.rpc('file:write', {
              repo: rawMeta.repo || '',
              filePath: rawMeta.repo ? rawMeta.filePath : (rawMeta.sourceUri || filePath),
              content: nextText
            });
            app.showToast(zh ? '变基计划已保存' : 'Rebase todo saved', 'info');
          } catch (err) {
            app.showToast(err.message, 'error');
          }
        });
      };
      renderTodo();
      return true;
    }
    if (kind === 'pdf' || kind === 'audio' || kind === 'video') {
      const url = buildRawFileUrl(rawMeta);
      if (kind === 'pdf') {
        container.innerHTML = `<div class="gm-media-preview"><iframe class="gm-pdf-frame" src="${escapeHtml(url)}" title="${escapeHtml(filePath)}"></iframe></div>`;
      } else if (kind === 'audio') {
        container.innerHTML = `<div class="gm-media-preview"><div style="font-weight:600">${escapeHtml(filePath)}</div><audio controls src="${escapeHtml(url)}"></audio></div>`;
      } else {
        container.innerHTML = `<div class="gm-media-preview"><video controls src="${escapeHtml(url)}"></video></div>`;
      }
      return true;
    }
    return false;
  }

  window.GitMapEditorPreview = {
    getPreviewKind,
    isBinaryPreviewKind,
    shouldDefaultRichPreview,
    upgradeCodeEditor,
    renderRichPreview,
    renderMarkdownHtml,
    buildRawFileUrl
  };
})();
