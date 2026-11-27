/* GitMap: features ported from vscode-git-map 2.9.0 — Explain Changes with AI, the Inspect panel & the Files Treemap */
(function () {
  'use strict';

  const getApp = () => window.GitMapApp;
  const getFeat = () => window.GitMapFeatures;
  const T = (zh, en) => (getApp()?.state?.lang === 'en' ? en : zh);
  const esc = (s) => getApp().escapeHtml(s);

  function activeRepoOrWarn(repo) {
    const app = getApp();
    const r = repo || app?.state?.activeRepo;
    if (!r) {
      app?.showToast(T('请先选择或打开一个 Git 仓库', 'Please select or open a Git repository first'), 'warning');
      return null;
    }
    return r;
  }

  function renderMarkdown(md) {
    const prev = window.GitMapEditorPreview;
    return prev && prev.renderMarkdownHtml
      ? `<div class="gm-md-body">${prev.renderMarkdownHtml(md)}</div>`
      : `<pre class="gm-v29-pre">${esc(md)}</pre>`;
  }

  function formatDate(seconds) {
    if (!seconds) return '';
    const d = new Date(seconds * 1000);
    try {
      return d.toLocaleString(getApp().state.lang === 'en' ? 'en' : 'zh-CN', { dateStyle: 'medium', timeStyle: 'short' });
    } catch (_) {
      return d.toISOString().replace('T', ' ').slice(0, 16);
    }
  }

  function relativeTime(seconds) {
    if (!seconds) return '';
    const diff = Math.max(0, Date.now() / 1000 - seconds);
    const zh = getApp().state.lang !== 'en';
    const units = [[31536000, zh ? '年' : 'y'], [2592000, zh ? '个月' : 'mo'], [86400, zh ? '天' : 'd'], [3600, zh ? '小时' : 'h'], [60, zh ? '分钟' : 'm']];
    for (const [sec, label] of units) {
      if (diff >= sec) return zh ? `${Math.floor(diff / sec)} ${label}前` : `${Math.floor(diff / sec)}${label} ago`;
    }
    return zh ? '刚刚' : 'just now';
  }

  /* ==================== 1. Explain Changes with AI ==================== */

  const EXPLAIN_MODES = [
    { mode: 'uncommitted', zh: '工作区更改', en: 'Working Changes', descZh: '已暂存、未暂存和未跟踪的更改', descEn: 'Staged, unstaged & untracked changes' },
    { mode: 'unpushed', zh: '未推送的更改', en: 'Unpushed Changes', descZh: '当前分支中尚未推送的提交', descEn: 'The commits of the current branch that haven\'t been pushed' },
    { mode: 'branch', zh: '分支更改', en: 'Branch Changes', descZh: '分支自与其合并目标分叉以来的更改', descEn: 'The changes of a branch since it diverged from its merge target' },
    { mode: 'stash', zh: '贮藏', en: 'Stash', descZh: '某个贮藏中的更改', descEn: 'The changes of a stash' }
  ];

  /**
   * Explain a set of changes with AI. With a mode (and its ref / range), it runs straight away; otherwise it asks which changes.
   * @param payload { repo, mode, ref, commitHash, fromRef, toRef, label }
   */
  async function openExplainChangesModal(payload) {
    const p = payload || {};
    const repo = activeRepoOrWarn(p.repo);
    if (!repo) return;
    const app = getApp();
    const { bodyEl, footerEl, isCurrent } = getFeat().openFeatureModal({
      title: T('用 AI 解释更改', 'Explain Changes with AI'),
      subtitle: app.parseRepoDisplay(repo).fullDisplay,
      icon: app.ICONS.sparkle || app.ICONS.editor,
      badge: 'AI',
      width: 'min(860px, 94vw)'
    });
    let choices = null;
    let current = { mode: p.mode || 'uncommitted', ref: p.ref || '', commitHash: p.commitHash || '', fromRef: p.fromRef || '', toRef: p.toRef || '', label: p.label || '' };

    bodyEl.innerHTML = `
      <div class="gm-v29-explain">
        <div class="gm-v29-segment" role="tablist">
          ${EXPLAIN_MODES.map((m) => `<button type="button" class="gm-v29-seg" data-mode="${m.mode}" title="${esc(T(m.descZh, m.descEn))}">${esc(T(m.zh, m.en))}</button>`).join('')}
          ${p.mode === 'range' ? `<button type="button" class="gm-v29-seg" data-mode="range">${esc(T('选定范围', 'Selected Range'))}</button>` : ''}
        </div>
        <div class="gm-v29-picker"></div>
        <div class="gm-v29-result"></div>
      </div>`;
    footerEl.innerHTML = `
      <button type="button" class="mini-btn act-copy" disabled>${esc(T('复制 Markdown', 'Copy Markdown'))}</button>
      <span style="flex:1"></span>
      <button type="button" class="mini-btn act-fm-close">${esc(T('关闭', 'Close'))}</button>
      <button type="button" class="mini-btn primary act-explain">${app.ICONS.sparkle || ''}<span>${esc(T('解释', 'Explain'))}</span></button>`;
    footerEl.querySelector('.act-fm-close').onclick = () => document.getElementById('featureModal').classList.add('hidden');

    const picker = bodyEl.querySelector('.gm-v29-picker');
    const result = bodyEl.querySelector('.gm-v29-result');
    const copyBtn = footerEl.querySelector('.act-copy');
    let lastMarkdown = '';

    const renderPicker = async () => {
      bodyEl.querySelectorAll('.gm-v29-seg').forEach((b) => b.classList.toggle('active', b.getAttribute('data-mode') === current.mode));
      picker.innerHTML = '';
      if (current.mode === 'branch' || current.mode === 'stash' || current.mode === 'unpushed') {
        if (choices === null) {
          picker.innerHTML = `<div class="scm-empty"><span class="fb-spinner"></span></div>`;
          try {
            choices = await app.rpc('explain:choices', { repo });
          } catch (err) {
            picker.innerHTML = `<div class="scm-empty error-text">${esc(err.message)}</div>`;
            return;
          }
          if (!isCurrent()) return;
        }
        if (current.mode === 'stash') {
          if (choices.stashes.length === 0) {
            picker.innerHTML = `<div class="gm-v29-note">${esc(T('此仓库中没有贮藏。', 'There are no stashes in this repository.'))}</div>`;
            return;
          }
          if (!current.commitHash) current.commitHash = choices.stashes[0].hash;
          picker.innerHTML = `<label class="gm-v29-field"><span>${esc(T('贮藏', 'Stash'))}</span><select class="gm-v29-select">${choices.stashes.map((s) => `<option value="${esc(s.hash)}" ${s.hash === current.commitHash ? 'selected' : ''}>${esc(s.selector + '  ' + s.subject)}</option>`).join('')}</select></label>`;
          picker.querySelector('select').onchange = (e) => {
            current.commitHash = e.target.value;
            current.label = '';
          };
        } else {
          const local = choices.branches.filter((b) => !b.includes('/') || !choices.branches.includes(b.split('/').slice(1).join('/')));
          if (!current.ref) current.ref = choices.current || local[0] || '';
          picker.innerHTML = `<label class="gm-v29-field"><span>${esc(T('分支', 'Branch'))}</span><select class="gm-v29-select">${(current.mode === 'unpushed' ? choices.branches.filter((b) => !b.includes('/')) : choices.branches).map((b) => `<option value="${esc(b)}" ${b === current.ref ? 'selected' : ''}>${esc(b)}${b === choices.current ? T('（当前）', ' (current)') : ''}</option>`).join('')}</select></label>
            ${current.mode === 'branch' ? `<div class="gm-v29-note">${esc(T('与分支的合并目标比较（可在分支右键菜单 → 合并目标 中设置，默认是仓库的默认分支）。', 'Compared with the branch\'s merge target (set it from the branch\'s context menu → Merge Target; the default branch otherwise).'))}</div>` : ''}`;
          picker.querySelector('select').onchange = (e) => {
            current.ref = e.target.value;
            current.label = '';
          };
        }
      } else if (current.mode === 'range') {
        picker.innerHTML = `<div class="gm-v29-note">${esc(current.label || (current.fromRef + ' → ' + current.toRef))}</div>`;
      }
    };

    const run = async () => {
      const btn = footerEl.querySelector('.act-explain');
      btn.disabled = true;
      copyBtn.disabled = true;
      result.innerHTML = `<div class="scm-empty"><span class="fb-spinner"></span> ${esc(T('正在收集更改并请求 AI 解释…', 'Collecting the changes and asking the AI…'))}</div>`;
      try {
        const res = await app.rpc('ai:explainChanges', { repo, ...current, lang: app.state.lang === 'en' ? 'en' : 'zh' });
        if (!isCurrent()) return;
        lastMarkdown = res.markdown;
        result.innerHTML = `<div class="gm-v29-result-head"><strong>${esc(res.label)}</strong>${res.usedAi ? `<span class="gm-v29-chip">AI</span>` : res.empty ? '' : `<span class="gm-v29-chip warn">${esc(T('离线概览', 'Offline overview'))}</span>`}</div>` + renderMarkdown(res.markdown);
        copyBtn.disabled = res.empty;
      } catch (err) {
        if (isCurrent()) result.innerHTML = `<div class="scm-empty error-text">${esc(err.message)}</div>`;
      } finally {
        btn.disabled = false;
      }
    };

    bodyEl.querySelectorAll('.gm-v29-seg').forEach((b) => b.addEventListener('click', () => {
      current = { mode: b.getAttribute('data-mode'), ref: '', commitHash: '', fromRef: current.fromRef, toRef: current.toRef, label: '' };
      result.innerHTML = '';
      void renderPicker();
    }));
    footerEl.querySelector('.act-explain').addEventListener('click', run);
    copyBtn.addEventListener('click', () => {
      navigator.clipboard?.writeText(lastMarkdown).then(() => app.showToast(T('已复制', 'Copied'), 'status'), () => {});
    });
    await renderPicker();
    // Coming from a context menu (a mode was given): explain right away
    if (p.mode) void run();
  }

  /* ==================== 2. Inspect panel (the commit of a line, or any commit) ==================== */

  const inspect = { open: false, follow: true, repo: null, commitHash: null, last: null, seq: 0 };

  function ensureInspectPanel() {
    let panel = document.getElementById('inspectPanel');
    if (panel) return panel;
    panel = document.createElement('aside');
    panel.id = 'inspectPanel';
    panel.className = 'inspect-panel hidden';
    panel.innerHTML = `
      <header class="inspect-head">
        <strong>${esc(T('检查', 'Inspect'))}</strong>
        <span class="inspect-head-actions">
          <button type="button" class="mini-icon-btn act-inspect-follow" title=""></button>
          <button type="button" class="mini-icon-btn act-inspect-close" title="${esc(T('关闭', 'Close'))}">${getApp().ICONS.close}</button>
        </span>
      </header>
      <div class="inspect-body"></div>`;
    const workspace = document.getElementById('workspaceArea');
    (workspace && workspace.parentElement ? workspace.parentElement : document.body).appendChild(panel);
    panel.querySelector('.act-inspect-close').addEventListener('click', () => closeInspectPanel());
    panel.querySelector('.act-inspect-follow').addEventListener('click', () => {
      inspect.follow = !inspect.follow;
      updateFollowButton();
    });
    updateFollowButton();
    return panel;
  }

  function updateFollowButton() {
    const panel = document.getElementById('inspectPanel');
    if (!panel) return;
    const btn = panel.querySelector('.act-inspect-follow');
    const app = getApp();
    btn.innerHTML = inspect.follow ? (app.ICONS.eye || '◉') : (app.ICONS.pin || app.ICONS.lock || '📌');
    btn.classList.toggle('active', inspect.follow);
    btn.title = inspect.follow ? T('跟随所选行（点击固定当前提交）', 'Following the selected line (click to pin this commit)') : T('已固定（点击跟随所选行）', 'Pinned (click to follow the selected line)');
  }

  function closeInspectPanel() {
    inspect.open = false;
    const panel = document.getElementById('inspectPanel');
    if (panel) panel.classList.add('hidden');
    document.body.classList.remove('inspect-open');
  }

  function showInspectPanel() {
    const panel = ensureInspectPanel();
    panel.classList.remove('hidden');
    document.body.classList.add('inspect-open');
    inspect.open = true;
    return panel;
  }

  async function openInspectCommit(payload) {
    const repo = activeRepoOrWarn(payload && payload.repo);
    if (!repo) return;
    const panel = showInspectPanel();
    inspect.repo = repo;
    inspect.commitHash = (payload && payload.commitHash) || 'HEAD';
    // Opened on a particular commit: pin it
    inspect.follow = !(payload && payload.commitHash);
    updateFollowButton();
    const seq = ++inspect.seq;
    const body = panel.querySelector('.inspect-body');
    body.innerHTML = `<div class="scm-empty"><span class="fb-spinner"></span></div>`;
    try {
      const res = await getApp().rpc('inspect:commit', { repo, commitHash: inspect.commitHash });
      if (seq === inspect.seq) renderInspectedCommit(body, repo, res.commit, null);
    } catch (err) {
      if (seq === inspect.seq) body.innerHTML = `<div class="scm-empty error-text">${esc(err.message)}</div>`;
    }
  }

  async function inspectLine(detail) {
    const panel = showInspectPanel();
    const body = panel.querySelector('.inspect-body');
    const seq = ++inspect.seq;
    body.innerHTML = `<div class="scm-empty"><span class="fb-spinner"></span></div>`;
    try {
      const res = await getApp().rpc('inspect:line', detail);
      if (seq !== inspect.seq) return;
      if (res.uncommitted) {
        body.innerHTML = `<div class="inspect-line-ref">${esc(detail.filePath)}:${detail.line}</div><div class="scm-empty">${esc(T('此行有尚未提交的更改。', 'This line has changes that haven\'t been committed yet.'))}</div>`;
        return;
      }
      if (res.error || !res.commit) {
        body.innerHTML = `<div class="scm-empty error-text">${esc(res.error || T('无法追溯此行。', 'This line can\'t be blamed.'))}</div>`;
        return;
      }
      inspect.repo = detail.repo;
      inspect.commitHash = res.commit.hash;
      renderInspectedCommit(body, detail.repo, res.commit, detail);
    } catch (err) {
      if (seq === inspect.seq) body.innerHTML = `<div class="scm-empty error-text">${esc(err.message)}</div>`;
    }
  }

  function renderInspectedCommit(body, repo, c, lineDetail) {
    const app = getApp();
    const statusCls = { A: 'add', D: 'del', M: 'mod', R: 'ren', C: 'ren', T: 'mod' };
    const refs = c.refs ? c.refs.split(',').map((r) => r.trim()).filter(Boolean) : [];
    body.innerHTML = `
      ${lineDetail ? `<div class="inspect-line-ref" title="${esc(lineDetail.filePath)}">${esc(lineDetail.filePath.split('/').pop())}:${lineDetail.line}</div>` : ''}
      <div class="inspect-commit-head">
        <div class="inspect-subject">${esc(c.subject)}</div>
        <div class="inspect-meta">
          <span class="inspect-avatar">${esc((c.author || '?').slice(0, 1).toUpperCase())}</span>
          <span><strong>${esc(c.author)}</strong> · <span title="${esc(formatDate(c.authorDate))}">${esc(relativeTime(c.authorDate))}</span></span>
        </div>
        ${c.committer && c.committer !== c.author ? `<div class="inspect-meta-sub">${esc(T(`由 ${c.committer} 提交`, `Committed by ${c.committer}`))}</div>` : ''}
        <div class="inspect-hash-row">
          <code title="${esc(c.hash)}">${esc(c.shortHash)}</code>
          ${refs.map((r) => `<span class="inspect-ref">${esc(r.replace(/^HEAD -> /, ''))}</span>`).join('')}
        </div>
      </div>
      ${c.body ? `<pre class="inspect-body-text">${esc(c.body)}</pre>` : ''}
      <div class="inspect-actions">
        <button type="button" class="mini-btn act-in-graph">${esc(T('在图谱中查看', 'View in Graph'))}</button>
        <button type="button" class="mini-btn act-in-copy">${esc(T('复制哈希', 'Copy Hash'))}</button>
        <button type="button" class="mini-btn act-in-msg">${esc(T('复制提交信息', 'Copy Message'))}</button>
        <button type="button" class="mini-btn act-in-explain">${app.ICONS.sparkle || ''}<span>${esc(T('用 AI 解释', 'Explain with AI'))}</span></button>
      </div>
      <div class="inspect-files-head">${esc(c.files.length === 1 ? T('1 个文件已更改', '1 File Changed') : T(`${c.files.length} 个文件已更改`, `${c.files.length} Files Changed`))}${c.filesTruncated ? '+' : ''}</div>
      <div class="inspect-files">
        ${c.files.map((f, i) => `<button type="button" class="inspect-file" data-i="${i}" title="${esc(f.oldPath ? f.oldPath + ' → ' + f.path : f.path)}">
          <span class="inspect-status ${statusCls[f.status] || 'mod'}">${esc(f.status)}</span>
          <span class="inspect-file-name">${esc(f.path.split('/').pop())}</span>
          <span class="inspect-file-dir">${esc(f.path.split('/').slice(0, -1).join('/'))}</span>
          <span class="inspect-file-stat">${f.additions != null ? `<i class="add">+${f.additions}</i><i class="del">-${f.deletions}</i>` : ''}</span>
        </button>`).join('')}
      </div>`;
    body.querySelector('.act-in-graph').addEventListener('click', () => {
      app.sendWs({ type: 'graph:request', payload: { command: 'commitDetails', repo, commitHash: c.hash, hasParents: c.parents.length > 0, stash: null, avatarEmail: null, refresh: false } });
      app.rpc('repos:select', { repo }).catch(() => {});
      app.activateTab('graph');
    });
    body.querySelector('.act-in-copy').addEventListener('click', () => navigator.clipboard?.writeText(c.hash).then(() => app.showToast(T(`已复制 ${c.shortHash}`, `Copied ${c.shortHash}`), 'status'), () => {}));
    body.querySelector('.act-in-msg').addEventListener('click', () => navigator.clipboard?.writeText(c.subject + (c.body ? '\n\n' + c.body : '')).then(() => app.showToast(T('已复制提交信息', 'Copied the commit message'), 'status'), () => {}));
    body.querySelector('.act-in-explain').addEventListener('click', () => {
      const parent = c.parents[0];
      if (parent) openExplainChangesModal({ repo, mode: 'range', fromRef: parent, toRef: c.hash, label: c.shortHash + ' ' + c.subject });
      else app.showToast(T('根提交没有可比较的父提交。', 'The root commit has no parent to compare with.'), 'warning');
    });
    body.querySelectorAll('.inspect-file').forEach((el) => el.addEventListener('click', () => {
      const f = c.files[Number(el.getAttribute('data-i'))];
      const parent = c.parents[0] || '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
      app.openDiffTab({
        repo,
        title: f.path.split('/').pop() + ' (' + c.shortHash + ')',
        fromHash: parent,
        toHash: c.hash,
        oldFilePath: f.oldPath || f.path,
        newFilePath: f.path,
        type: f.status,
        lines: null,
        hideUnchangedRegions: false
      });
    }));
  }

  // Follow the line selected in the file viewer
  let followTimer = null;
  window.addEventListener('gitmap:file-line-selected', (ev) => {
    if (!inspect.open || !inspect.follow || !ev.detail) return;
    clearTimeout(followTimer);
    followTimer = setTimeout(() => void inspectLine(ev.detail), 120);
  });

  /* ==================== 3. Files Treemap ==================== */

  const TYPE_HUES = {
    ts: 210, tsx: 205, js: 50, jsx: 45, mjs: 50, cjs: 50, json: 30, md: 160, css: 280, scss: 290, less: 285, html: 15, vue: 140, svelte: 12,
    py: 200, go: 190, rs: 25, java: 20, kt: 270, swift: 10, c: 220, h: 225, cpp: 230, hpp: 235, cs: 260, rb: 0, php: 245, sh: 100, yml: 340, yaml: 340,
    png: 300, jpg: 305, jpeg: 305, gif: 310, svg: 320, ico: 315, lock: 0, txt: 60, xml: 35, sql: 180
  };

  /** Squarified treemap layout of items ({ value }) in a rectangle. */
  function squarify(items, x, y, w, h) {
    const out = [];
    const total = items.reduce((s, i) => s + i.value, 0);
    if (total <= 0 || w <= 0 || h <= 0) return out;
    const scale = (w * h) / total;
    const nodes = items.map((i) => ({ item: i, area: i.value * scale }));
    let rect = { x, y, w, h };
    let row = [];
    const worst = (r, side) => {
      const s = r.reduce((a, n) => a + n.area, 0);
      let max = 0, min = Infinity;
      r.forEach((n) => {
        max = Math.max(max, n.area);
        min = Math.min(min, n.area);
      });
      return Math.max((side * side * max) / (s * s), (s * s) / (side * side * min));
    };
    const layoutRow = (r) => {
      const s = r.reduce((a, n) => a + n.area, 0);
      if (rect.w >= rect.h) {
        const colW = s / rect.h;
        let cy = rect.y;
        r.forEach((n) => {
          const nh = n.area / colW;
          out.push({ item: n.item, x: rect.x, y: cy, w: colW, h: nh });
          cy += nh;
        });
        rect = { x: rect.x + colW, y: rect.y, w: rect.w - colW, h: rect.h };
      } else {
        const rowH = s / rect.w;
        let cx = rect.x;
        r.forEach((n) => {
          const nw = n.area / rowH;
          out.push({ item: n.item, x: cx, y: rect.y, w: nw, h: rowH });
          cx += nw;
        });
        rect = { x: rect.x, y: rect.y + rowH, w: rect.w, h: rect.h - rowH };
      }
    };
    for (const n of nodes) {
      const side = Math.min(rect.w, rect.h);
      if (row.length === 0 || worst(row.concat(n), side) <= worst(row, side)) {
        row.push(n);
      } else {
        layoutRow(row);
        row = [n];
      }
    }
    if (row.length) layoutRow(row);
    return out;
  }

  function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB'];
    let v = bytes, i = 0;
    while (v >= 1024 && i < u.length - 1) {
      v /= 1024;
      i++;
    }
    return (i === 0 ? v : v.toFixed(v >= 10 ? 0 : 1)) + ' ' + u[i];
  }

  async function openFilesTreemap(payload) {
    const repo = activeRepoOrWarn(payload && payload.repo);
    if (!repo) return;
    const app = getApp();
    const { bodyEl, isCurrent } = getFeat().openFeatureModal({
      title: T('文件树状图 (Files Treemap)', 'Files Treemap'),
      subtitle: app.parseRepoDisplay(repo).fullDisplay,
      icon: app.ICONS.layers || app.ICONS.folder,
      width: 'min(1180px, 96vw)'
    });
    bodyEl.innerHTML = `
      <div class="gm-v29-treemap">
        <div class="gm-v29-treemap-bar">
          <div class="gm-v29-segment">
            <button type="button" class="gm-v29-seg active" data-metric="size">${esc(T('按文件大小（按类型着色）', 'By File Size (coloured by type)'))}</button>
            <button type="button" class="gm-v29-seg" data-metric="changes">${esc(T('按修改频率（越红越热）', 'By Change Frequency (hottest in red)'))}</button>
          </div>
          <label class="gm-v29-field inline"><span>${esc(T('目录', 'Folder'))}</span><select class="gm-v29-depth"></select></label>
          <span class="gm-v29-treemap-info"></span>
        </div>
        <div class="gm-v29-treemap-canvas"><div class="scm-empty"><span class="fb-spinner"></span> ${esc(T('正在读取仓库文件…', 'Reading the files of the repository…'))}</div></div>
        <div class="gm-v29-treemap-hover"></div>
      </div>`;
    let data;
    try {
      data = await app.rpc('repo:filesTreemap', { repo });
    } catch (err) {
      if (isCurrent()) bodyEl.querySelector('.gm-v29-treemap-canvas').innerHTML = `<div class="scm-empty error-text">${esc(err.message)}</div>`;
      return;
    }
    if (!isCurrent()) return;
    if (data.error) {
      bodyEl.querySelector('.gm-v29-treemap-canvas').innerHTML = `<div class="scm-empty error-text">${esc(data.error)}</div>`;
      return;
    }
    let metric = 'size';
    let folder = '';
    const canvas = bodyEl.querySelector('.gm-v29-treemap-canvas');
    const hover = bodyEl.querySelector('.gm-v29-treemap-hover');
    const info = bodyEl.querySelector('.gm-v29-treemap-info');
    const depthSel = bodyEl.querySelector('.gm-v29-depth');
    const maxChanges = Math.max(1, ...data.files.map((f) => f.changes));
    const topFolders = Array.from(new Set(data.files.map((f) => f.path.includes('/') ? f.path.split('/')[0] : ''))).filter(Boolean).sort();
    depthSel.innerHTML = `<option value="">${esc(T('整个仓库', 'Whole repository'))}</option>` + topFolders.map((d) => `<option value="${esc(d)}">${esc(d)}/</option>`).join('');
    depthSel.onchange = () => {
      folder = depthSel.value;
      draw();
    };

    const draw = () => {
      const files = data.files.filter((f) => !folder || f.path.startsWith(folder + '/'));
      const items = files.map((f) => ({ f, value: metric === 'size' ? Math.max(1, f.size) : f.changes })).filter((i) => i.value > 0).sort((a, b) => b.value - a.value).slice(0, 1500);
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(200, rect.width), h = Math.max(200, rect.height);
      const cells = squarify(items, 0, 0, w, h);
      const zh = app.state.lang !== 'en';
      info.textContent = (zh ? `${files.length} 个文件` : `${files.length} files`) + (data.truncated ? (zh ? `（共 ${data.totalFiles} 个，仅显示最大与最常修改的）` : ` (of ${data.totalFiles}; the largest & most changed)`) : '') + (metric === 'changes' ? (zh ? ` · 统计了最近 ${data.commitsScanned} 个提交` : ` · latest ${data.commitsScanned} commits`) : '');
      if (cells.length === 0) {
        canvas.innerHTML = `<div class="scm-empty">${esc(metric === 'changes' ? T('最近的提交没有修改这些文件。', 'The latest commits didn\'t change these files.') : T('没有文件。', 'No files.'))}</div>`;
        return;
      }
      canvas.innerHTML = cells.map((c, i) => {
        const f = c.item.f;
        const ext = (f.path.split('.').pop() || '').toLowerCase();
        let bg;
        if (metric === 'size') {
          const hue = TYPE_HUES[ext] != null ? TYPE_HUES[ext] : 200;
          bg = `hsl(${hue} 45% 42% / 0.85)`;
        } else {
          const heat = Math.pow(f.changes / maxChanges, 0.6);
          bg = `hsl(${Math.round(220 - 220 * heat)} ${50 + 25 * heat}% ${36 + 10 * heat}% / 0.9)`;
        }
        const name = f.path.split('/').pop();
        const showLabel = c.w > 46 && c.h > 18;
        return `<button type="button" class="gm-v29-cell" data-i="${i}" style="left:${c.x.toFixed(1)}px;top:${c.y.toFixed(1)}px;width:${Math.max(0, c.w - 1).toFixed(1)}px;height:${Math.max(0, c.h - 1).toFixed(1)}px;background:${bg}">${showLabel ? `<span>${esc(name)}</span>` : ''}</button>`;
      }).join('');
      canvas.querySelectorAll('.gm-v29-cell').forEach((el) => {
        const f = cells[Number(el.getAttribute('data-i'))].item.f;
        el.title = f.path;
        el.addEventListener('mouseenter', () => {
          hover.textContent = `${f.path} · ${formatBytes(f.size)} · ${zh ? `最近 ${data.commitsScanned} 个提交中修改了 ${f.changes} 次` : `changed ${f.changes}× in the latest ${data.commitsScanned} commits`}`;
        });
        el.addEventListener('click', () => {
          document.getElementById('featureModal').classList.add('hidden');
          app.openFileTab({ repo, filePath: f.path, commit: null, title: f.path.split('/').pop(), lines: null });
        });
      });
    };
    bodyEl.querySelectorAll('[data-metric]').forEach((b) => b.addEventListener('click', () => {
      metric = b.getAttribute('data-metric');
      bodyEl.querySelectorAll('[data-metric]').forEach((x) => x.classList.toggle('active', x === b));
      draw();
    }));
    draw();
    const ro = new ResizeObserver(() => {
      if (isCurrent()) draw();
      else ro.disconnect();
    });
    ro.observe(canvas);
  }

  /* ==================== Wiring ==================== */

  /** Handle a companion feature added in 2.9 (returns true when handled). */
  function openV29CompanionFeature(payload) {
    if (!payload) return false;
    const app = getApp();
    switch (payload.feature) {
      case 'aiExplainChanges': void openExplainChangesModal(payload); return true;
      case 'inspectCommit': void openInspectCommit(payload); return true;
      case 'filesTreemap': void openFilesTreemap(payload); return true;
      case 'browseRevision': app.openCommitTreeTab?.({ repo: payload.repo || app.state.activeRepo, commitHash: payload.commitHash || 'HEAD' }); return true;
      case 'aiSwitchModel': app.openAppSettingsModal('ai'); return true;
      default: return false;
    }
  }

  window.GitMapV29 = {
    openExplainChangesModal,
    openInspectCommit,
    openFilesTreemap,
    closeInspectPanel,
    openV29CompanionFeature
  };
})();
