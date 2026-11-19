/* GitMap Advanced Git, Multi-Repo, Full-Text Search, Folder Diff & SSH Telemetry UI */
(function () {
  'use strict';

  function getApp() { return window.GitMapApp; }
  function T(zh, en) {
    const app = getApp();
    return app && app.state && app.state.lang === 'en' ? en : zh;
  }
  function esc(s) {
    const app = getApp();
    return app ? app.escapeHtml(s) : String(s || '');
  }

  function openModalShell(title, subtitle, wide) {
    const modal = document.getElementById('featureModal');
    const win = modal && modal.querySelector('.modal-window');
    const titleEl = document.getElementById('featureModalTitle');
    const subEl = document.getElementById('featureModalSubtitle');
    const body = document.getElementById('featureModalBody');
    if (!modal || !body) return null;
    if (win) {
      win.classList.remove('modal-sm', 'modal-md', 'modal-lg', 'modal-xl');
      win.classList.add(wide ? 'modal-xl' : 'modal-lg');
    }
    if (titleEl) titleEl.textContent = title;
    if (subEl) {
      subEl.textContent = subtitle || '';
      subEl.classList.toggle('hidden', !subtitle);
    }
    body.innerHTML = '';
    modal.classList.remove('hidden');
    return body;
  }

  function activeRepo() {
    const app = getApp();
    return (app && app.state && app.state.activeRepo) || '';
  }

  function formatBytes(n) {
    if (n == null || !isFinite(n)) return '—';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  }

  /* ── 1. Submodules & Git LFS Modal ── */
  async function openSubmodulesLfsModal(repo) {
    const app = getApp();
    const targetRepo = repo || activeRepo();
    if (!targetRepo) {
      app?.showToast(T('请先选择一个仓库', 'Select a repository first'), 'warning');
      return;
    }
    const body = openModalShell(
      T('子模块与 Git LFS 管理', 'Submodules & Git LFS'),
      app.parseRepoDisplay(targetRepo).label,
      false
    );
    if (!body) return;
    body.innerHTML = `<div style="padding:16px;color:var(--text-2)">${esc(T('正在读取子模块与 LFS 状态…', 'Loading submodule & LFS status…'))}</div>`;

    async function load() {
      try {
        const [subRes, lfsRes] = await Promise.all([
          app.rpc('git:submodules', { repo: targetRepo }),
          app.rpc('git:lfsStatus', { repo: targetRepo })
        ]);
        const subs = subRes.submodules || [];
        body.innerHTML = `
          <div class="gm-enh-card" style="margin-bottom:12px">
            <div class="gm-enh-card-head">
              <span>${esc(T('Git 子模块', 'Git Submodules'))} <span class="gm-badge info">${subs.length}</span></span>
              <span style="display:flex;gap:6px">
                <button type="button" class="mini-btn" data-sub-act="init">${esc(T('初始化全部 (--init)', 'Init All'))}</button>
                <button type="button" class="mini-btn" data-sub-act="update">${esc(T('更新远端 (--remote)', 'Update Remote'))}</button>
                <button type="button" class="mini-btn" data-sub-act="sync">${esc(T('同步配置 (sync)', 'Sync URLs'))}</button>
              </span>
            </div>
            <div class="gm-enh-list" style="margin-top:8px;max-height:24vh">
              ${subs.length === 0
                ? `<div style="color:var(--text-2);padding:8px 2px">${esc(T('当前仓库未配置子模块。', 'No submodules configured in this repository.'))}</div>`
                : subs.map((s) => {
                  const badgeCls = s.status === 'clean' ? 'ok' : s.status === 'uninitialized' ? 'warn' : 'err';
                  return `<div class="gm-enh-card" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
                    <div>
                      <div style="font-weight:600">${esc(s.path)} <span class="gm-badge ${badgeCls}">${esc(s.status)}</span></div>
                      <div style="font-size:11.5px;color:var(--text-2)">${esc(s.shortCommit)}${s.describe ? ' · ' + esc(s.describe) : ''}${s.url ? ' · ' + esc(s.url) : ''}</div>
                    </div>
                    <button type="button" class="mini-btn" data-sub-one="${esc(s.path)}">${esc(T('初始化/更新', 'Init / Update'))}</button>
                  </div>`;
                }).join('')}
            </div>
          </div>

          <div class="gm-enh-card">
            <div class="gm-enh-card-head">
              <span>Git LFS ${lfsRes.installed ? `<span class="gm-badge ok">${esc(lfsRes.version || 'Installed')}</span>` : `<span class="gm-badge warn">${esc(T('未安装', 'Not Installed'))}</span>`}</span>
              ${lfsRes.installed ? `<span style="display:flex;gap:6px">
                <button type="button" class="mini-btn" data-lfs-act="pull">git lfs pull</button>
                <button type="button" class="mini-btn" data-lfs-act="fetch">git lfs fetch</button>
              </span>` : ''}
            </div>
            <div style="margin-top:8px;font-size:12px;color:var(--text-2)">
              ${esc(T('跟踪规则', 'Tracked patterns'))}: ${lfsRes.trackedPatterns?.length ? lfsRes.trackedPatterns.map((p) => `<code style="margin-right:4px">${esc(p)}</code>`).join('') : esc(T('无', 'None'))}
              · ${esc(T('LFS 文件数', 'LFS files'))}: <strong>${lfsRes.totalFiles || 0}</strong>
            </div>
            ${lfsRes.files && lfsRes.files.length ? `<div class="gm-enh-list" style="margin-top:8px;max-height:22vh">
              ${lfsRes.files.map((f) => `<div style="display:flex;justify-content:space-between;gap:8px;padding:3px 4px;font-size:12px;border-bottom:1px solid var(--border)">
                <span>${esc(f.path)}</span>
                <span class="gm-badge ${f.pointer ? 'warn' : 'ok'}">${f.pointer ? T('仅指针', 'Pointer') : T('已下载', 'Hydrated')} · ${esc(f.oid)}</span>
              </div>`).join('')}
            </div>` : ''}
          </div>
        `;

        body.querySelectorAll('[data-sub-act]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const action = btn.getAttribute('data-sub-act');
            btn.disabled = true;
            try {
              await app.rpc('git:submoduleAction', { repo: targetRepo, action });
              app.showToast(T(`子模块 ${action} 完成`, `Submodule ${action} completed`), 'info');
              await load();
            } catch (err) {
              app.showToast(err.message, 'error');
            } finally { btn.disabled = false; }
          });
        });

        body.querySelectorAll('[data-sub-one]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const p = btn.getAttribute('data-sub-one');
            btn.disabled = true;
            try {
              await app.rpc('git:submoduleAction', { repo: targetRepo, action: 'init', path: p });
              app.showToast(T(`已更新子模块：${p}`, `Updated submodule: ${p}`), 'info');
              await load();
            } catch (err) {
              app.showToast(err.message, 'error');
            } finally { btn.disabled = false; }
          });
        });

        body.querySelectorAll('[data-lfs-act]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const action = btn.getAttribute('data-lfs-act');
            btn.disabled = true;
            try {
              await app.rpc('git:lfsAction', { repo: targetRepo, action });
              app.showToast(`git lfs ${action} ${T('完成', 'completed')}`, 'info');
              await load();
            } catch (err) {
              app.showToast(err.message, 'error');
            } finally { btn.disabled = false; }
          });
        });
      } catch (err) {
        body.innerHTML = `<div style="padding:14px;color:#ef4444">${esc(err.message)}</div>`;
      }
    }
    await load();
  }

  /* ── 2. Multi-Repo Dashboard & Cross-Repo Commit Search Modal ── */
  async function openMultiRepoDashboardModal() {
    const app = getApp();
    const repoKeys = Object.keys(app?.state?.repos || {});
    const body = openModalShell(
      T('多仓库仪表盘与跨库搜索', 'Multi-Repo Dashboard & Global Search'),
      T(`已管理 ${repoKeys.length} 个仓库`, `${repoKeys.length} managed repositories`),
      true
    );
    if (!body) return;

    body.innerHTML = `
      <div class="gm-enh-toolbar">
        <input type="text" id="gmDashQuery" class="gm-enh-input" placeholder="${esc(T('跨仓库搜索提交说明… (按回车搜索)', 'Search commit messages across all repos…'))}" />
        <input type="text" id="gmDashAuthor" class="gm-enh-input" style="max-width:180px" placeholder="${esc(T('作者筛选 (可选)', 'Author (optional)'))}" />
        <button type="button" id="gmDashSearchBtn" class="primary-btn">${esc(T('跨库搜索', 'Search All'))}</button>
        <button type="button" id="gmDashFetchAllBtn" class="mini-btn">${esc(T('全部 Fetch', 'Fetch All'))}</button>
        <label class="gm-enh-toggle"><input type="checkbox" id="gmDashDirtyOnly" /> ${esc(T('仅看有变动/未推送', 'Dirty / Unpushed only'))}</label>
      </div>
      <div id="gmDashContent" class="gm-enh-list"></div>
    `;

    const contentEl = body.querySelector('#gmDashContent');
    const qInput = body.querySelector('#gmDashQuery');
    const authInput = body.querySelector('#gmDashAuthor');
    const dirtyCheck = body.querySelector('#gmDashDirtyOnly');
    let statuses = [];

    function renderOverview() {
      const onlyDirty = dirtyCheck.checked;
      const list = onlyDirty
        ? statuses.filter((s) => s.stagedCount > 0 || s.unstagedCount > 0 || s.conflictCount > 0 || s.ahead > 0 || s.behind > 0)
        : statuses;
      if (!list.length) {
        contentEl.innerHTML = `<div style="padding:14px;color:var(--text-2)">${esc(T('没有符合条件的仓库。', 'No repositories match the filter.'))}</div>`;
        return;
      }
      contentEl.innerHTML = list.map((s) => {
        const disp = app.parseRepoDisplay(s.repo);
        const badges = [];
        if (s.branch) badges.push(`<span class="gm-badge info">${esc(s.branch)}</span>`);
        if (s.conflictCount > 0) badges.push(`<span class="gm-badge err">${esc(T(`冲突 ${s.conflictCount}`, `${s.conflictCount} conflicts`))}</span>`);
        if (s.stagedCount > 0) badges.push(`<span class="gm-badge ok">${esc(T(`暂存 ${s.stagedCount}`, `Staged ${s.stagedCount}`))}</span>`);
        if (s.unstagedCount > 0) badges.push(`<span class="gm-badge warn">${esc(T(`改动 ${s.unstagedCount}`, `Modified ${s.unstagedCount}`))}</span>`);
        if (s.ahead > 0) badges.push(`<span class="gm-badge info">↑${s.ahead}</span>`);
        if (s.behind > 0) badges.push(`<span class="gm-badge warn">↓${s.behind}</span>`);
        if (s.offline) badges.push(`<span class="gm-badge err">${esc(T('离线', 'Offline'))}</span>`);
        if (!badges.length) badges.push(`<span class="gm-badge ok">${esc(T('干净', 'Clean'))}</span>`);
        return `<div class="gm-enh-card" style="display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer" data-jump-repo="${esc(s.repo)}">
          <div>
            <div style="font-weight:600">${esc(disp.label)}</div>
            <div style="font-size:11.5px;color:var(--text-2)">${esc(disp.sub || s.repo)}</div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:5px;justify-content:flex-end">${badges.join('')}</div>
        </div>`;
      }).join('');
      contentEl.querySelectorAll('[data-jump-repo]').forEach((el) => {
        el.addEventListener('click', async () => {
          const r = el.getAttribute('data-jump-repo');
          document.getElementById('featureModal')?.classList.add('hidden');
          await app.rpc('repos:select', { repo: r });
          app.state.activeRepo = r;
          app.renderSidebar();
          app.renderActiveRepoBadge();
          app.activateTab('graph');
          app.refreshGraphView();
        });
      });
    }

    async function loadStatuses() {
      contentEl.innerHTML = `<div style="padding:14px;color:var(--text-2)">${esc(T('正在汇总所有仓库状态…', 'Loading status across all repositories…'))}</div>`;
      try {
        const res = await app.rpc('repos:quickStatuses', { repos: repoKeys });
        statuses = res.statuses || [];
        renderOverview();
      } catch (err) {
        contentEl.innerHTML = `<div style="padding:14px;color:#ef4444">${esc(err.message)}</div>`;
      }
    }

    async function runSearch() {
      const q = qInput.value.trim();
      const author = authInput.value.trim();
      if (!q && !author) {
        renderOverview();
        return;
      }
      contentEl.innerHTML = `<div style="padding:14px;color:var(--text-2)">${esc(T('正在跨仓库搜索提交历史…', 'Searching commits across repositories…'))}</div>`;
      try {
        const res = await app.rpc('repos:searchCommits', { query: q, author, limitPerRepo: 25 });
        const hits = res.hits || [];
        if (!hits.length) {
          contentEl.innerHTML = `<div style="padding:14px;color:var(--text-2)">${esc(T('未找到匹配的提交。', 'No matching commits found.'))}</div>`;
          return;
        }
        contentEl.innerHTML = hits.map((h) => {
          const disp = app.parseRepoDisplay(h.repo);
          const dt = h.date ? new Date(h.date * 1000).toLocaleString() : '';
          return `<div class="gm-enh-card" style="cursor:pointer" data-hit-repo="${esc(h.repo)}" data-hit-hash="${esc(h.hash)}">
            <div class="gm-enh-card-head">
              <span><span class="gm-badge info">${esc(disp.label)}</span> <code>${esc(h.shortHash)}</code> ${esc(h.subject)}</span>
              <span style="font-size:11px;color:var(--text-2);font-weight:400">${esc(h.author)} · ${esc(dt)}</span>
            </div>
          </div>`;
        }).join('');
        contentEl.querySelectorAll('[data-hit-repo]').forEach((el) => {
          el.addEventListener('click', async () => {
            const r = el.getAttribute('data-hit-repo');
            const hash = el.getAttribute('data-hit-hash');
            document.getElementById('featureModal')?.classList.add('hidden');
            await app.rpc('repos:select', { repo: r });
            app.state.activeRepo = r;
            app.renderSidebar();
            app.renderActiveRepoBadge();
            app.activateTab('graph');
            app.refreshGraphView();
            setTimeout(() => {
              app.sendWs({ type: 'graph:message', payload: { command: 'scrollToCommit', hash } });
            }, 350);
          });
        });
      } catch (err) {
        contentEl.innerHTML = `<div style="padding:14px;color:#ef4444">${esc(err.message)}</div>`;
      }
    }

    dirtyCheck.addEventListener('change', renderOverview);
    body.querySelector('#gmDashSearchBtn').addEventListener('click', runSearch);
    qInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') runSearch(); });
    authInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') runSearch(); });
    body.querySelector('#gmDashFetchAllBtn').addEventListener('click', async () => {
      if (window.GitMapFeatures && window.GitMapFeatures.fetchAllRepos) {
        await window.GitMapFeatures.fetchAllRepos();
        await loadStatuses();
      }
    });

    await loadStatuses();
  }

  /* ── 3. Global Full-Text Content Search (Local & Remote-SSH) ── */
  function openContentSearchModal(targetRepo) {
    const app = getApp();
    const target = targetRepo || activeRepo();
    if (!target) {
      app?.showToast(T('请先选择一个仓库', 'Select a repository first'), 'warning');
      return;
    }
    const disp = app.parseRepoDisplay(target);
    const body = openModalShell(
      T('全局文件内容搜索 (rg / git grep)', 'Global Full-Text Content Search'),
      `${disp.label} (${disp.sub || target})`,
      true
    );
    if (!body) return;

    body.innerHTML = `
      <div class="gm-enh-toolbar">
        <input type="text" id="gmSearchQuery" class="gm-enh-input" placeholder="${esc(T('输入关键词或正则表达式，按回车搜索…', 'Search text or regex, press Enter…'))}" />
        <label class="gm-enh-toggle"><input type="checkbox" id="gmSearchRegex" /> ${esc(T('正则', 'Regex'))}</label>
        <label class="gm-enh-toggle"><input type="checkbox" id="gmSearchCase" /> ${esc(T('区分大小写', 'Case'))}</label>
        <input type="text" id="gmSearchExcludes" class="gm-enh-input" style="max-width:200px" value=".git,node_modules,dist,build" title="${esc(T('排除目录（逗号分隔）', 'Exclude globs (comma separated)'))}" />
        <button type="button" id="gmSearchRunBtn" class="primary-btn">${esc(T('搜索', 'Search'))}</button>
      </div>
      <div id="gmSearchSummary" style="font-size:12px;color:var(--text-2);margin-bottom:8px"></div>
      <div id="gmSearchResults" class="gm-enh-list"></div>
    `;

    const qInput = body.querySelector('#gmSearchQuery');
    const regexCb = body.querySelector('#gmSearchRegex');
    const caseCb = body.querySelector('#gmSearchCase');
    const exclInput = body.querySelector('#gmSearchExcludes');
    const sumEl = body.querySelector('#gmSearchSummary');
    const resEl = body.querySelector('#gmSearchResults');

    async function run() {
      const query = qInput.value;
      if (!query.trim()) return;
      sumEl.textContent = T('正在搜索…', 'Searching…');
      resEl.innerHTML = '';
      try {
        const excludes = exclInput.value.split(',').map((s) => s.trim()).filter(Boolean);
        const out = await app.rpc('search:content', {
          target,
          query,
          regex: regexCb.checked,
          caseSensitive: caseCb.checked,
          excludes,
          maxMatches: 400
        });
        sumEl.textContent = T(
          `引擎：${out.engine} · 共 ${out.files.length} 个文件，${out.totalMatches} 处匹配${out.truncated ? '（已截断）' : ''}`,
          `Engine: ${out.engine} · ${out.totalMatches} matches in ${out.files.length} files${out.truncated ? ' (truncated)' : ''}`
        );
        if (!out.files.length) {
          resEl.innerHTML = `<div style="padding:14px;color:var(--text-2)">${esc(T('未找到匹配内容。', 'No matches found.'))}</div>`;
          return;
        }
        resEl.innerHTML = out.files.map((fg) => `
          <div class="gm-enh-card">
            <div class="gm-enh-card-head" style="margin-bottom:4px">
              <span>${esc(fg.file)}</span>
              <span class="gm-badge info">${fg.matches.length}</span>
            </div>
            ${fg.matches.map((m) => `
              <div class="gm-search-match-row" data-file="${esc(fg.file)}" data-line="${m.line}">
                <span class="gm-search-line-no">${m.line}</span>
                <span class="gm-search-snippet">${esc(m.text.trim())}</span>
              </div>
            `).join('')}
          </div>
        `).join('');

        resEl.querySelectorAll('.gm-search-match-row').forEach((row) => {
          row.addEventListener('click', () => {
            const relFile = row.getAttribute('data-file');
            const lineNum = Number(row.getAttribute('data-line')) || 1;
            document.getElementById('featureModal')?.classList.add('hidden');
            app.openFileTab({
              repo: target,
              filePath: relFile,
              title: relFile.split('/').pop(),
              initialLine: lineNum
            });
          });
        });
      } catch (err) {
        sumEl.textContent = '';
        resEl.innerHTML = `<div style="padding:14px;color:#ef4444">${esc(err.message)}</div>`;
      }
    }

    body.querySelector('#gmSearchRunBtn').addEventListener('click', run);
    qInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
    setTimeout(() => qInput.focus(), 30);
  }

  /* ── 4. Folder / Repo Diff & Selective Sync Modal ── */
  function openFolderDiffModal() {
    const app = getApp();
    const repos = Object.keys(app?.state?.repos || {});
    const defaultLeft = activeRepo() || repos[0] || '';
    const defaultRight = repos.find((r) => r !== defaultLeft) || '';

    const body = openModalShell(
      T('目录 / 仓库对比与选择性同步', 'Folder / Repository Diff & Sync'),
      T('支持本地路径与 ssh://host/path 远端路径任意组合对比', 'Compare any local or ssh://host/path directories'),
      true
    );
    if (!body) return;

    const datalistId = 'gmFolderDiffRepoOptions';
    body.innerHTML = `
      <datalist id="${datalistId}">${repos.map((r) => `<option value="${esc(r)}"></option>`).join('')}</datalist>
      <div class="gm-enh-toolbar">
        <input type="text" id="gmDiffLeft" list="${datalistId}" class="gm-enh-input" value="${esc(defaultLeft)}" placeholder="${esc(T('左侧目录 (本地或 ssh://host/path)', 'Left path (local or ssh://host/path)'))}" />
        <span style="color:var(--text-2);font-weight:700">⇄</span>
        <input type="text" id="gmDiffRight" list="${datalistId}" class="gm-enh-input" value="${esc(defaultRight)}" placeholder="${esc(T('右侧目录 (本地或 ssh://host/path)', 'Right path (local or ssh://host/path)'))}" />
        <button type="button" id="gmDiffRunBtn" class="primary-btn">${esc(T('开始对比', 'Compare'))}</button>
      </div>
      <div class="gm-enh-toolbar" style="margin-bottom:8px">
        <span id="gmDiffSummary" style="font-size:12px;color:var(--text-2)"></span>
        <select id="gmDiffStatusFilter" class="gm-enh-input" style="flex:0 0 auto;width:160px;min-width:140px">
          <option value="changed">${esc(T('仅看差异文件', 'Differences only'))}</option>
          <option value="modified">${esc(T('仅看已修改', 'Modified'))}</option>
          <option value="left-only">${esc(T('仅左侧存在', 'Left only'))}</option>
          <option value="right-only">${esc(T('仅右侧存在', 'Right only'))}</option>
          <option value="all">${esc(T('全部文件', 'All files'))}</option>
        </select>
      </div>
      <div id="gmDiffList" class="gm-enh-list"></div>
    `;

    const leftInput = body.querySelector('#gmDiffLeft');
    const rightInput = body.querySelector('#gmDiffRight');
    const filterSel = body.querySelector('#gmDiffStatusFilter');
    const sumEl = body.querySelector('#gmDiffSummary');
    const listEl = body.querySelector('#gmDiffList');
    let lastResult = null;

    function renderEntries() {
      if (!lastResult) return;
      const mode = filterSel.value;
      const entries = lastResult.entries.filter((e) => {
        if (mode === 'all') return true;
        if (mode === 'changed') return e.status !== 'identical';
        return e.status === mode;
      });
      if (!entries.length) {
        listEl.innerHTML = `<div style="padding:14px;color:var(--text-2)">${esc(T('当前筛选条件下无差异文件。', 'No files match this filter.'))}</div>`;
        return;
      }
      listEl.innerHTML = entries.slice(0, 600).map((e) => {
        const badgeCls = e.status === 'identical' ? 'ok' : e.status === 'modified' ? 'warn' : 'info';
        const label = e.status === 'left-only' ? T('仅左侧', 'Left only')
          : e.status === 'right-only' ? T('仅右侧', 'Right only')
          : e.status === 'modified' ? T('有差异', 'Modified') : T('一致', 'Identical');
        return `<div class="gm-enh-card" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <div style="min-width:0">
            <div style="font-weight:600;word-break:break-all">${esc(e.relPath)} <span class="gm-badge ${badgeCls}">${esc(label)}</span></div>
            <div style="font-size:11px;color:var(--text-2)">L: ${formatBytes(e.leftSize)} · R: ${formatBytes(e.rightSize)}</div>
          </div>
          <div style="display:flex;gap:5px;flex-shrink:0">
            ${e.leftSize !== null ? `<button type="button" class="mini-btn" data-sync="lr" data-rel="${esc(e.relPath)}">${esc(T('左 → 右', 'L → R'))}</button>` : ''}
            ${e.rightSize !== null ? `<button type="button" class="mini-btn" data-sync="rl" data-rel="${esc(e.relPath)}">${esc(T('右 → 左', 'R → L'))}</button>` : ''}
          </div>
        </div>`;
      }).join('');

      listEl.querySelectorAll('[data-sync]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const dir = btn.getAttribute('data-sync');
          const relPath = btn.getAttribute('data-rel');
          const source = dir === 'lr' ? leftInput.value.trim() : rightInput.value.trim();
          const target = dir === 'lr' ? rightInput.value.trim() : leftInput.value.trim();
          btn.disabled = true;
          try {
            const res = await app.rpc('diff:syncFile', { source, target, relPath });
            app.showToast(T(`已同步 ${relPath} (${formatBytes(res.bytes)})`, `Synced ${relPath} (${formatBytes(res.bytes)})`), 'info');
            await runCompare();
          } catch (err) {
            app.showToast(err.message, 'error');
            btn.disabled = false;
          }
        });
      });
    }

    async function runCompare() {
      const left = leftInput.value.trim();
      const right = rightInput.value.trim();
      if (!left || !right) {
        app.showToast(T('请填写左右两个目录路径', 'Enter both left and right directory paths'), 'warning');
        return;
      }
      sumEl.textContent = T('正在扫描对比目录…', 'Scanning and comparing directories…');
      listEl.innerHTML = '';
      try {
        lastResult = await app.rpc('diff:folders', { left, right });
        const s = lastResult.summary;
        sumEl.textContent = T(
          `总计 ${s.total} 个文件 · 差异 ${s.modified} · 仅左 ${s.leftOnly} · 仅右 ${s.rightOnly} · 一致 ${s.identical}`,
          `Total ${s.total} · Modified ${s.modified} · Left-only ${s.leftOnly} · Right-only ${s.rightOnly} · Identical ${s.identical}`
        );
        renderEntries();
      } catch (err) {
        sumEl.textContent = '';
        listEl.innerHTML = `<div style="padding:14px;color:#ef4444">${esc(err.message)}</div>`;
      }
    }

    body.querySelector('#gmDiffRunBtn').addEventListener('click', runCompare);
    filterSel.addEventListener('change', renderEntries);
  }

  /* ── 5. Remote SSH Host Resource Telemetry Bar ── */
  let telemetryEl = null;
  async function pollSshTelemetry() {
    const app = getApp();
    if (!app || document.hidden) return;
    const hosts = (app.state && app.state.sshHosts) || [];
    const connected = hosts.find((h) => h.connected);
    const remoteSection = document.querySelector('.sidebar-section[data-section="remote"]');
    if (!connected || !remoteSection) {
      if (telemetryEl) telemetryEl.remove();
      telemetryEl = null;
      return;
    }
    try {
      const active = activeRepo();
      const mountPath = active && active.startsWith(`ssh://${connected.id}/`)
        ? active.slice(`ssh://${connected.id}`.length)
        : '/';
      const stats = await app.rpc('ssh:hostStats', { hostId: connected.id, mountPath });
      if (!telemetryEl || !telemetryEl.isConnected) {
        telemetryEl = document.createElement('div');
        telemetryEl.className = 'gm-ssh-telemetry';
        const list = remoteSection.querySelector('#remoteRepoList');
        if (list) remoteSection.insertBefore(telemetryEl, list);
        else remoteSection.appendChild(telemetryEl);
      }
      telemetryEl.classList.toggle('warn', !!stats.lowDiskWarning);
      const fillCls = (pct) => pct == null ? '' : pct >= 90 ? 'crit' : pct >= 80 ? 'warn' : '';
      const cpuPct = stats.cpuPercent != null ? stats.cpuPercent : 0;
      const memPct = stats.memPercent != null ? stats.memPercent : 0;
      const diskPct = stats.diskPercent != null ? stats.diskPercent : 0;
      telemetryEl.innerHTML = `
        <div class="gm-ssh-telemetry-head">
          <span>${esc(connected.name || connected.host)}</span>
          <span>${stats.lowDiskWarning ? `<span class="gm-badge warn">${esc(T('磁盘预警', 'Low Disk'))}</span>` : esc(stats.loadAvg ? 'load ' + stats.loadAvg.split(' ')[0] : '')}</span>
        </div>
        <div class="gm-ssh-telemetry-metrics">
          <div class="gm-metric-pill" title="CPU">
            <div class="gm-metric-label"><span>CPU</span><span>${stats.cpuPercent != null ? stats.cpuPercent + '%' : '—'}</span></div>
            <div class="gm-metric-bar"><div class="gm-metric-fill ${fillCls(stats.cpuPercent)}" style="width:${cpuPct}%"></div></div>
          </div>
          <div class="gm-metric-pill" title="${stats.memUsedMb != null ? stats.memUsedMb + '/' + stats.memTotalMb + ' MB' : 'RAM'}">
            <div class="gm-metric-label"><span>RAM</span><span>${stats.memPercent != null ? stats.memPercent + '%' : '—'}</span></div>
            <div class="gm-metric-bar"><div class="gm-metric-fill ${fillCls(stats.memPercent)}" style="width:${memPct}%"></div></div>
          </div>
          <div class="gm-metric-pill" title="${stats.diskUsed ? stats.diskUsed + '/' + stats.diskTotal + ' (' + (stats.diskMount || '/') + ')' : 'Disk'}">
            <div class="gm-metric-label"><span>DISK</span><span>${stats.diskPercent != null ? stats.diskPercent + '%' : '—'}</span></div>
            <div class="gm-metric-bar"><div class="gm-metric-fill ${fillCls(stats.diskPercent)}" style="width:${diskPct}%"></div></div>
          </div>
        </div>
      `;
    } catch (_) {
      /* ignore transient SSH telemetry errors */
    }
  }

  setInterval(pollSshTelemetry, 30000);
  setTimeout(pollSshTelemetry, 4500);

  /* ── 6. Interactive Rebase HTML5 Drag-to-Reorder Enhancer ── */
  const rbObserver = new MutationObserver(() => {
    const body = document.getElementById('featureModalBody');
    if (!body) return;
    const rows = body.querySelectorAll('.rb-row:not([data-gm-dnd="1"])');
    if (!rows.length) return;
    let draggedRow = null;
    rows.forEach((row) => {
      row.dataset.gmDnd = '1';
      row.setAttribute('draggable', 'true');
      row.addEventListener('dragstart', (e) => {
        draggedRow = row;
        e.dataTransfer.effectAllowed = 'move';
        row.style.opacity = '0.5';
      });
      row.addEventListener('dragend', () => {
        row.style.opacity = '';
        body.querySelectorAll('.rb-row.gm-drag-over').forEach((r) => r.classList.remove('gm-drag-over'));
        draggedRow = null;
      });
      row.addEventListener('dragover', (e) => {
        if (!draggedRow || draggedRow === row) return;
        e.preventDefault();
        row.classList.add('gm-drag-over');
      });
      row.addEventListener('dragleave', () => row.classList.remove('gm-drag-over'));
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('gm-drag-over');
        if (!draggedRow || draggedRow === row) return;
        const parent = row.parentElement;
        if (!parent) return;
        const all = Array.from(parent.children);
        const fromIdx = all.indexOf(draggedRow);
        const toIdx = all.indexOf(row);
        if (fromIdx < toIdx) parent.insertBefore(draggedRow, row.nextSibling);
        else parent.insertBefore(draggedRow, row);
        // Trigger reorder sync via existing move button if present or custom event
        parent.dispatchEvent(new CustomEvent('gm-rebase-reordered', { bubbles: true, detail: { fromIdx, toIdx } }));
      });
    });
  });
  const featBody = document.getElementById('featureModalBody');
  if (featBody) rbObserver.observe(featBody, { childList: true, subtree: true });

  window.GitMapRemoteAndGitUI = {
    openSubmodulesLfsModal,
    openMultiRepoDashboardModal,
    openContentSearchModal,
    openFolderDiffModal,
    pollSshTelemetry
  };
})();
