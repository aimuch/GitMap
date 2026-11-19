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
    const ext = detectExt(filePath);
    if (['md', 'markdown', 'mdx'].includes(ext)) return 'markdown';
    if (['csv', 'tsv'].includes(ext)) return 'csv';
    if (ext === 'json') return 'json';
    if (ext === 'pdf') return 'pdf';
    if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) return 'audio';
    if (['mp4', 'webm', 'mov'].includes(ext)) return 'video';
    return null;
  }

  function buildRawFileUrl(meta) {
    const params = new URLSearchParams();
    if (meta.repo) params.set('repo', meta.repo);
    if (meta.hostId) params.set('hostId', meta.hostId);
    if (meta.filePath) params.set('path', meta.filePath);
    return '/api/file-raw?' + params.toString();
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

  /* ── 2. Markdown Renderer (Safe, GFM Tables, Fenced Code + Mermaid Card) ── */
  function renderMarkdownHtml(mdText) {
    const lines = String(mdText || '').replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let i = 0;

    function inlineFmt(str) {
      let s = escapeHtml(str);
      s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
      s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
      s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
      return s;
    }

    while (i < lines.length) {
      const line = lines[i];
      // Fenced code block
      const fence = /^```([a-zA-Z0-9_-]*)\s*$/.exec(line);
      if (fence) {
        const lang = (fence[1] || '').toLowerCase();
        const codeLines = [];
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) {
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
          if (lang && window.hljs && window.hljs.getLanguage(lang)) {
            try { hi = window.hljs.highlight(code, { language: lang, ignoreIllegals: true }).value; } catch (_) {}
          }
          out.push('<pre><code>' + hi + '</code></pre>');
        }
        continue;
      }
      // Heading
      const hm = /^(#{1,6})\s+(.+)$/.exec(line);
      if (hm) {
        const lvl = hm[1].length;
        out.push(`<h${lvl}>${inlineFmt(hm[2])}</h${lvl}>`);
        i++;
        continue;
      }
      // Horizontal rule
      if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(line)) {
        out.push('<hr />');
        i++;
        continue;
      }
      // Blockquote
      if (/^>\s?/.test(line)) {
        const qLines = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          qLines.push(inlineFmt(lines[i].replace(/^>\s?/, '')));
          i++;
        }
        out.push('<blockquote>' + qLines.join('<br/>') + '</blockquote>');
        continue;
      }
      // GFM Table
      if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(lines[i + 1])) {
        const splitRow = (r) => r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
        const headers = splitRow(line);
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
          rows.push(splitRow(lines[i]));
          i++;
        }
        out.push(
          '<table><thead><tr>' + headers.map((h) => `<th>${inlineFmt(h)}</th>`).join('') + '</tr></thead><tbody>' +
          rows.map((r) => '<tr>' + headers.map((_, ci) => `<td>${inlineFmt(r[ci] || '')}</td>`).join('') + '</tr>').join('') +
          '</tbody></table>'
        );
        continue;
      }
      // Unordered / task list
      if (/^\s*[-*+]\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
          let item = lines[i].replace(/^\s*[-*+]\s+/, '');
          if (/^\[x\]\s+/i.test(item)) item = '<input type="checkbox" checked disabled /> ' + inlineFmt(item.slice(4));
          else if (/^\[\s\]\s+/.test(item)) item = '<input type="checkbox" disabled /> ' + inlineFmt(item.slice(4));
          else item = inlineFmt(item);
          items.push('<li>' + item + '</li>');
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
      while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|>\s?|\s*[-*+]\s|\s*\d+\.\s)/.test(lines[i])) {
        pLines.push(inlineFmt(lines[i]));
        i++;
      }
      out.push('<p>' + pLines.join('<br/>') + '</p>');
    }
    return out.join('\n');
  }

  /* ── 3. CSV / TSV / JSON Table Renderer ── */
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

  function renderInteractiveTable(container, headers, rows) {
    let sortCol = -1;
    let sortAsc = true;
    let filterText = '';

    const wrap = document.createElement('div');
    wrap.className = 'gm-rich-preview';
    wrap.innerHTML =
      '<div class="gm-table-toolbar">' +
      '<input type="text" class="gm-tbl-filter" placeholder="筛选表格行 / Filter rows..." />' +
      '<span class="gm-tbl-stats" style="font-size:12px;color:var(--text-2)"></span>' +
      '</div>' +
      '<div class="gm-tbl-mount" style="overflow:auto;max-height:calc(100% - 44px)"></div>';

    const filterInput = wrap.querySelector('.gm-tbl-filter');
    const statsEl = wrap.querySelector('.gm-tbl-stats');
    const mount = wrap.querySelector('.gm-tbl-mount');

    function draw() {
      const q = filterText.trim().toLowerCase();
      let filtered = q ? rows.filter((r) => r.some((c) => String(c).toLowerCase().includes(q))) : rows.slice();
      if (sortCol >= 0) {
        filtered.sort((a, b) => {
          const av = String(a[sortCol] ?? '');
          const bv = String(b[sortCol] ?? '');
          const na = Number(av), nb = Number(bv);
          const cmp = isFinite(na) && isFinite(nb) && av !== '' && bv !== '' ? na - nb : av.localeCompare(bv);
          return sortAsc ? cmp : -cmp;
        });
      }
      const display = filtered.slice(0, 1000);
      statsEl.textContent = `${display.length} / ${rows.length} 行 · ${headers.length} 列`;
      mount.innerHTML =
        '<table class="gm-data-table"><thead><tr>' +
        headers.map((h, ci) => `<th data-col="${ci}">${escapeHtml(h)}${sortCol === ci ? (sortAsc ? ' ▲' : ' ▼') : ''}</th>`).join('') +
        '</tr></thead><tbody>' +
        display.map((r) => '<tr>' + headers.map((_, ci) => `<td>${escapeHtml(r[ci] ?? '')}</td>`).join('') + '</tr>').join('') +
        '</tbody></table>';
      mount.querySelectorAll('th[data-col]').forEach((th) => {
        th.addEventListener('click', () => {
          const ci = Number(th.getAttribute('data-col'));
          if (sortCol === ci) sortAsc = !sortAsc;
          else { sortCol = ci; sortAsc = true; }
          draw();
        });
      });
    }

    filterInput.addEventListener('input', () => {
      filterText = filterInput.value;
      draw();
    });
    draw();
    container.innerHTML = '';
    container.appendChild(wrap);
  }

  function renderRichPreview(container, filePath, content, meta) {
    const kind = getPreviewKind(filePath);
    if (!kind) return false;

    if (kind === 'markdown') {
      container.innerHTML = '<div class="gm-rich-preview gm-md-body">' + renderMarkdownHtml(content) + '</div>';
      return true;
    }
    if (kind === 'csv') {
      const delim = detectExt(filePath) === 'tsv' ? '\t' : ',';
      const rows = parseDelimited(content, delim);
      if (!rows.length) return false;
      const headers = rows[0];
      renderInteractiveTable(container, headers, rows.slice(1));
      return true;
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
    if (kind === 'pdf' || kind === 'audio' || kind === 'video') {
      const url = buildRawFileUrl(meta || { filePath });
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
    upgradeCodeEditor,
    renderRichPreview,
    renderMarkdownHtml,
    buildRawFileUrl
  };
})();
