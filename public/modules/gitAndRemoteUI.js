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
    // Use the shared opener so the footer, icon, badge and width left by the previous feature modal are reset
    const shared = window.GitMapFeatures && window.GitMapFeatures.openFeatureModal;
    if (shared) {
      return shared({ title, subtitle, width: wide ? 'min(1180px, 96vw)' : 'min(880px, 94vw)' }).bodyEl;
    }
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
      app.parseRepoDisplay(targetRepo).name,
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

  /* ── 2. Multi-Repo Launchpad, Interactive Activity Heatmap & Cross-Repo Search Modal ── */
  async function openMultiRepoDashboardModal() {
    const app = getApp();
    const repoKeys = Object.keys(app?.state?.repos || {});
    const body = openModalShell(
      T('多仓库指挥台 & 活动热力图 (Launchpad)', 'Multi-Repo Launchpad & Activity Heatmap'),
      T(`已管理 ${repoKeys.length} 个仓库 · 跨库行动队列、16 周提交热力图与全局历史检索`, `${repoKeys.length} repositories · actionable buckets, 16-week heatmap & global search`),
      true
    );
    if (!body) return;

    body.innerHTML = `
      <div id="gmDashHeatmapSlot"></div>
      <div id="gmDashBucketsSlot"></div>
      <div id="gmDashPrSlot"></div>
      <div class="gm-enh-toolbar">
        <input type="text" id="gmDashQuery" class="gm-enh-input" placeholder="${esc(T('跨仓库搜索提交说明… (按回车搜索)', 'Search commit messages across all repos…'))}" />
        <input type="text" id="gmDashAuthor" class="gm-enh-input" style="max-width:180px" placeholder="${esc(T('作者筛选 (可选)', 'Author (optional)'))}" />
        <button type="button" id="gmDashSearchBtn" class="primary-btn">${esc(T('跨库搜索', 'Search All'))}</button>
        <button type="button" id="gmDashFetchAllBtn" class="mini-btn">${esc(T('全部 Fetch', 'Fetch All'))}</button>
      </div>
      <div id="gmDashContent" class="gm-enh-list"></div>
    `;

    const heatmapSlot = body.querySelector('#gmDashHeatmapSlot');
    const bucketsSlot = body.querySelector('#gmDashBucketsSlot');
    const prSlot = body.querySelector('#gmDashPrSlot');
    const contentEl = body.querySelector('#gmDashContent');
    const qInput = body.querySelector('#gmDashQuery');
    const authInput = body.querySelector('#gmDashAuthor');
    let statusesList = [];
    let launchpadData = null;
    let heatmapData = null;
    let prData = null;
    let prLoading = false;
    let prBucketFilter = 'all';
    let prExpanded = false;
    let activeBucket = 'all'; // 'all' | 'conflicts' | 'dirty' | 'readyToPush' | 'behindRemote'
    let heatmapCollapsed = false;
    let selectedHeatmapDate = null;

    function renderPrPanel() {
      if (!prSlot) return;
      if (prLoading) {
        prSlot.innerHTML = `<div class="gm-heatmap-card"><div class="gm-heatmap-head"><span class="gm-ai-status"><span class="gm-ai-dot"></span>${esc(T('正在聚合跨仓库 PR 与 CI 状态…', 'Aggregating remote PRs & CI checks across repositories…'))}</span></div></div>`;
        return;
      }
      const counts = prData ? prData.counts : { total: 0, failingCi: 0, pendingCi: 0, readyToMerge: 0, drafts: 0 };
      const allItems = (prData && prData.items) || [];
      const shownItems = prBucketFilter === 'all' ? allItems : allItems.filter((x) => x.bucket === prBucketFilter);
      const skippedHint = prData && prData.skippedNoToken > 0
        ? T(`已跳过 ${prData.skippedNoToken} 个未配置 Token 仓库（避免限流）`, `${prData.skippedNoToken} repo(s) without token skipped`)
        : '';

      prSlot.innerHTML = `
        <div class="gm-heatmap-card">
          <div class="gm-heatmap-head">
            <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;">
              <strong>${esc(T('跨仓库 PR / MR & CI 状态', 'Cross-Repo PR / MR & CI Checks'))}</strong>
              ${prData ? `
                <span class="gm-badge ${counts.failingCi > 0 ? 'err' : 'ok'}">${esc(T(`失败 CI ${counts.failingCi}`, `Failing CI ${counts.failingCi}`))}</span>
                <span class="gm-badge ok">${esc(T(`待合并 ${counts.readyToMerge}`, `Ready ${counts.readyToMerge}`))}</span>
                <span class="gm-badge warn">${esc(T(`进行中 ${counts.pendingCi}`, `Pending ${counts.pendingCi}`))}</span>
                <span class="gm-badge">${esc(T(`草稿 ${counts.drafts}`, `Draft ${counts.drafts}`))}</span>
              ` : ''}
              ${skippedHint ? `<span style="font-size:11px;color:var(--vscode-descriptionForeground);">${esc(skippedHint)}</span>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <button type="button" id="gmLpLoadTokenPrs" class="mini-btn" title="${esc(T('仅扫描已配置 API Token 的仓库（安全不限流）', 'Scan repos with saved API token only'))}">${esc(T('刷新已授权仓库 PR', 'Refresh Authed PRs'))}</button>
              <button type="button" id="gmLpLoadAllPrs" class="mini-btn" title="${esc(T('包含公开免 Token 仓库一起扫描', 'Also scan public repos without saved token'))}">${esc(T('扫描全部仓库 PR', 'Scan All Repos'))}</button>
              ${allItems.length > 0 ? `<button type="button" id="gmLpTogglePrList" class="mini-btn">${esc(prExpanded ? T('收起 PR 列表', 'Hide PRs') : T(`展开 ${allItems.length} 条 PR`, `Show ${allItems.length} PR(s)`))}</button>` : ''}
            </div>
          </div>
          ${prExpanded && allItems.length > 0 ? `
            <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:8px;">
              ${[
                { id: 'all', label: T(`全部 (${counts.total})`, `All (${counts.total})`) },
                { id: 'failingCi', label: T(`CI 失败 (${counts.failingCi})`, `Failing CI (${counts.failingCi})`) },
                { id: 'readyToMerge', label: T(`可合并 (${counts.readyToMerge})`, `Ready (${counts.readyToMerge})`) },
                { id: 'pendingCi', label: T(`CI 进行中 (${counts.pendingCi})`, `Pending (${counts.pendingCi})`) },
                { id: 'drafts', label: T(`草稿 (${counts.drafts})`, `Draft (${counts.drafts})`) }
              ].map((f) => `<button type="button" class="mini-btn ${prBucketFilter === f.id ? 'primary' : ''} act-lp-pr-filter" data-pbf="${f.id}" style="height:22px;font-size:11px;">${esc(f.label)}</button>`).join('')}
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;max-height:210px;overflow:auto;">
              ${shownItems.length === 0 ? `<div style="font-size:12px;color:var(--vscode-descriptionForeground);padding:6px;">${esc(T('该分类下暂无 PR。', 'No PRs in this bucket.'))}</div>` : shownItems.map((pr) => {
                const ciCls = pr.ciStatus === 'failure' ? 'err' : pr.ciStatus === 'success' ? 'ok' : pr.ciStatus === 'pending' ? 'warn' : '';
                return `<div class="gm-enh-card" style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                  <div style="min-width:0;flex:1;">
                    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                      <span class="gm-badge info">${esc(pr.repoName)}</span>
                      <code>#${pr.number}</code>
                      <strong style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(pr.title)}</strong>
                      <span class="gm-badge ${ciCls}">CI: ${esc(pr.ciStatus)}</span>
                      ${pr.draft ? `<span class="gm-badge">Draft</span>` : ''}
                    </div>
                    <div style="font-size:11px;color:var(--vscode-descriptionForeground);margin-top:2px;">${esc(pr.sourceBranch)} → ${esc(pr.targetBranch)} · ${esc(pr.author)}</div>
                  </div>
                  <div style="display:inline-flex;gap:5px;flex-shrink:0;">
                    <button type="button" class="mini-btn act-lp-pr-co" data-repo="${esc(pr.repo)}" data-num="${pr.number}" data-prov="${esc(pr.provider)}">${esc(T('检出', 'Checkout'))}</button>
                    ${pr.webUrl ? `<a class="mini-btn" style="text-decoration:none;" href="${esc(pr.webUrl)}" target="_blank" rel="noopener noreferrer">${esc(T('打开', 'Open'))}</a>` : ''}
                  </div>
                </div>`;
              }).join('')}
            </div>
          ` : ''}
        </div>
      `;

      prSlot.querySelector('#gmLpLoadTokenPrs')?.addEventListener('click', () => loadPrs(true, true));
      prSlot.querySelector('#gmLpLoadAllPrs')?.addEventListener('click', () => loadPrs(false, true));
      prSlot.querySelector('#gmLpTogglePrList')?.addEventListener('click', () => {
        prExpanded = !prExpanded;
        renderPrPanel();
      });
      prSlot.querySelectorAll('.act-lp-pr-filter').forEach((b) => {
        b.addEventListener('click', () => {
          prBucketFilter = b.getAttribute('data-pbf') || 'all';
          renderPrPanel();
        });
      });
      prSlot.querySelectorAll('.act-lp-pr-co').forEach((b) => {
        b.addEventListener('click', async () => {
          const r = b.getAttribute('data-repo');
          const num = Number(b.getAttribute('data-num'));
          const prov = b.getAttribute('data-prov') || undefined;
          b.disabled = true;
          try {
            await app.rpc('hosting:checkoutPr', { repo: r, number: num, provider: prov });
            app.showToast(T(`已检出 PR #${num}`, `Checked out PR #${num}`), 'info');
            await jumpToRepo(r);
          } catch (err) {
            app.showToast(err.message, 'error');
            b.disabled = false;
          }
        });
      });
    }

    async function loadPrs(onlyWithToken, autoExpand) {
      prLoading = true;
      renderPrPanel();
      try {
        prData = await app.rpc('repos:launchpadPrs', { repos: repoKeys, onlyWithToken });
        if (autoExpand || (prData && prData.counts && prData.counts.total > 0)) {
          prExpanded = true;
        }
      } catch (err) {
        app?.showToast(err.message, 'error');
      } finally {
        prLoading = false;
        renderPrPanel();
      }
    }

    const jumpToRepo = async (r, afterAction) => {
      document.getElementById('featureModal')?.classList.add('hidden');
      await app.rpc('repos:select', { repo: r });
      app.state.activeRepo = r;
      app.renderSidebar();
      app.renderActiveRepoBadge();
      app.activateTab('graph');
      app.refreshGraphView();
      if (typeof afterAction === 'function') afterAction();
    };

    function renderHeatmap() {
      if (!heatmapSlot) return;
      if (!heatmapData) {
        heatmapSlot.innerHTML = `<div class="gm-heatmap-card"><div class="gm-heatmap-head"><span>${esc(T('正在聚合近 16 周提交热力图…', 'Aggregating 16-week commit heatmap…'))}</span></div></div>`;
        return;
      }
      const hm = heatmapData;
      const selectedDay = selectedHeatmapDate
        ? (hm.days || []).find((d) => d.date === selectedHeatmapDate) || null
        : null;
      const dayRepos = selectedDay ? Object.entries(selectedDay.repos || {}).sort((a, b) => b[1] - a[1]) : [];

      heatmapSlot.innerHTML = `
        <div class="gm-heatmap-card">
          <div class="gm-heatmap-head">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <strong>${esc(T(`近 ${hm.weeks} 周提交热力图`, `${hm.weeks}-Week Commit Activity`))}</strong>
              <span class="gm-badge info">${esc(T(`${hm.totalCommits} 次提交`, `${hm.totalCommits} commits`))}</span>
              <span class="gm-badge ok">${esc(T(`活跃 ${hm.activeDays} 天`, `${hm.activeDays} active days`))}</span>
              ${hm.busiestDay ? `<span class="gm-heatmap-meta">${esc(T(`峰值：${hm.busiestDay.date} (${hm.busiestDay.count})`, `Peak: ${hm.busiestDay.date} (${hm.busiestDay.count})`))}</span>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
              <div class="gm-heatmap-legend" aria-hidden="true">
                <span>${esc(T('少', 'Less'))}</span>
                <span class="gm-hm-cell lv-0" style="cursor:default"></span>
                <span class="gm-hm-cell lv-1" style="cursor:default"></span>
                <span class="gm-hm-cell lv-2" style="cursor:default"></span>
                <span class="gm-hm-cell lv-3" style="cursor:default"></span>
                <span class="gm-hm-cell lv-4" style="cursor:default"></span>
                <span>${esc(T('多', 'More'))}</span>
              </div>
              <button type="button" id="gmHmToggleBtn" class="mini-btn">${esc(heatmapCollapsed ? T('展开热力图', 'Expand') : T('收起', 'Collapse'))}</button>
            </div>
          </div>
          ${heatmapCollapsed ? '' : `
            <div class="gm-heatmap-body">
              <div class="gm-heatmap-grid-wrap">
                <div class="gm-heatmap-grid">
                  ${(hm.days || []).map((d) => {
                    const tip = `${d.date} · ${d.count} ${T('次提交', 'commit(s)')}`;
                    return `<button type="button" class="gm-hm-cell lv-${d.level}${selectedHeatmapDate === d.date ? ' selected' : ''}" data-hm-date="${esc(d.date)}" title="${esc(tip)}" aria-label="${esc(tip)}"></button>`;
                  }).join('')}
                </div>
              </div>
              ${selectedDay ? `
                <div class="gm-hm-day-detail">
                  <div>
                    <strong>${esc(selectedDay.date)}</strong> ·
                    <span>${esc(T(`共 ${selectedDay.count} 次提交`, `${selectedDay.count} commit(s)`))}</span>
                    ${dayRepos.length > 0 ? `<span style="margin-left:8px;display:inline-flex;gap:5px;flex-wrap:wrap;">${dayRepos.map(([r, cnt]) => {
                      const nm = app.parseRepoDisplay(r).name;
                      return `<button type="button" class="mini-btn act-hm-jump" data-repo="${esc(r)}" style="height:20px;font-size:11px;padding:0 6px;">${esc(nm)} (${cnt})</button>`;
                    }).join('')}</span>` : `<span style="margin-left:8px;color:var(--vscode-descriptionForeground)">${esc(T('当日无提交记录', 'No commits on this day'))}</span>`}
                  </div>
                  <button type="button" id="gmHmClearDay" class="mini-btn" style="height:20px;font-size:11px;">${esc(T('关闭明细', 'Close'))}</button>
                </div>
              ` : `<div style="font-size:11px;color:var(--vscode-descriptionForeground)">${esc(T('提示：点击任意日期格子可展开查看当日各仓库提交分布。', 'Tip: click any day cell to expand per-repository commit breakdown.'))}</div>`}
            </div>
          `}
        </div>
      `;

      heatmapSlot.querySelector('#gmHmToggleBtn')?.addEventListener('click', () => {
        heatmapCollapsed = !heatmapCollapsed;
        renderHeatmap();
      });
      heatmapSlot.querySelector('#gmHmClearDay')?.addEventListener('click', () => {
        selectedHeatmapDate = null;
        renderHeatmap();
      });
      heatmapSlot.querySelectorAll('.gm-hm-cell[data-hm-date]').forEach((cell) => {
        cell.addEventListener('click', () => {
          const dt = cell.getAttribute('data-hm-date');
          selectedHeatmapDate = selectedHeatmapDate === dt ? null : dt;
          renderHeatmap();
        });
      });
      heatmapSlot.querySelectorAll('.act-hm-jump').forEach((btn) => {
        btn.addEventListener('click', () => jumpToRepo(btn.getAttribute('data-repo')));
      });
    }

    function renderBuckets() {
      if (!bucketsSlot || !launchpadData) return;
      const t = launchpadData.totals;
      const cards = [
        { id: 'all', num: t.repos, label: T(`全部仓库 (${t.worktrees} 工作树)`, `All Repos (${t.worktrees} wt)`), tone: '' },
        { id: 'conflicts', num: t.conflicts, label: T('合并冲突', 'Conflicts'), tone: t.conflicts > 0 ? 'tone-err' : 'tone-ok' },
        { id: 'dirty', num: t.dirty, label: T('待提交工作区', 'Dirty Trees'), tone: t.dirty > 0 ? 'tone-warn' : '' },
        { id: 'readyToPush', num: t.readyToPush, label: T('待推送 (Ahead)', 'Ready to Push'), tone: t.readyToPush > 0 ? 'tone-info' : '' },
        { id: 'behindRemote', num: t.behindRemote, label: T('落后远程 (Behind)', 'Behind Remote'), tone: t.behindRemote > 0 ? 'tone-warn' : '' }
      ];
      bucketsSlot.innerHTML = `
        <div class="gm-launchpad-buckets">
          ${cards.map((c) => `
            <button type="button" class="gm-bucket-card ${c.tone}${activeBucket === c.id ? ' active' : ''}" data-bucket="${c.id}">
              <span class="gm-bucket-num">${c.num}</span>
              <span class="gm-bucket-label">${esc(c.label)}</span>
            </button>
          `).join('')}
        </div>
      `;
      bucketsSlot.querySelectorAll('.gm-bucket-card').forEach((b) => {
        b.addEventListener('click', () => {
          activeBucket = b.getAttribute('data-bucket') || 'all';
          renderBuckets();
          renderOverview();
        });
      });
    }

    function renderOverview() {
      let list = statusesList;
      if (launchpadData && activeBucket !== 'all' && Array.isArray(launchpadData.buckets[activeBucket])) {
        list = launchpadData.buckets[activeBucket];
      }
      if (!list.length) {
        contentEl.innerHTML = `<div class="gm-empty-card"><div class="gm-empty-card-title">${esc(T('当前分类下没有待处理仓库', 'No repositories in this bucket'))}</div><div class="gm-empty-card-desc">${esc(T('所有仓库状态良好，可点击上方「全部仓库」查看完整列表。', 'Everything looks clean here. Click "All Repos" above to view all repositories.'))}</div></div>`;
        return;
      }
      const wtCounts = (launchpadData && launchpadData.worktreeCounts) || {};
      contentEl.innerHTML = list.map((s) => {
        const disp = app.parseRepoDisplay(s.repo);
        const badges = [];
        if (s.branch) badges.push(`<span class="gm-badge info">${esc(s.branch)}</span>`);
        if (s.conflictCount > 0) badges.push(`<span class="gm-badge err">${esc(T(`冲突 ${s.conflictCount}`, `${s.conflictCount} conflicts`))}</span>`);
        if (s.stagedCount > 0) badges.push(`<span class="gm-badge ok">${esc(T(`暂存 ${s.stagedCount}`, `Staged ${s.stagedCount}`))}</span>`);
        if (s.unstagedCount > 0) badges.push(`<span class="gm-badge warn">${esc(T(`改动 ${s.unstagedCount}`, `Modified ${s.unstagedCount}`))}</span>`);
        if (s.ahead > 0) badges.push(`<span class="gm-badge info">↑${s.ahead}</span>`);
        if (s.behind > 0) badges.push(`<span class="gm-badge warn">↓${s.behind}</span>`);
        if ((wtCounts[s.repo] || 0) > 1) badges.push(`<span class="gm-badge">${esc(T(`${wtCounts[s.repo]} 工作树`, `${wtCounts[s.repo]} worktrees`))}</span>`);
        if (s.offline) badges.push(`<span class="gm-badge err">${esc(T('离线', 'Offline'))}</span>`);
        if (!badges.length) badges.push(`<span class="gm-badge ok">${esc(T('干净', 'Clean'))}</span>`);
        const isDirty = s.stagedCount > 0 || s.unstagedCount > 0 || s.conflictCount > 0;
        return `<div class="gm-enh-card" style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <div style="min-width:0;cursor:pointer;flex:1;" data-jump-repo="${esc(s.repo)}">
            <div style="font-weight:600">${esc(disp.name)}</div>
            <div style="font-size:11.5px;color:var(--vscode-descriptionForeground,var(--text-2));overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(disp.fullDisplay || s.repo)}</div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:5px;justify-content:flex-end;align-items:center;">
            ${badges.join('')}
            ${!s.offline && isDirty ? `<button type="button" class="mini-btn act-lp-scm" data-repo="${esc(s.repo)}" style="height:22px;font-size:11px;">${esc(T('去提交', 'Commit'))}</button>` : ''}
            ${!s.offline && (wtCounts[s.repo] || 0) > 1 ? `<button type="button" class="mini-btn act-lp-wt" data-repo="${esc(s.repo)}" style="height:22px;font-size:11px;">Worktrees</button>` : ''}
            <button type="button" class="mini-btn act-lp-open" data-repo="${esc(s.repo)}" style="height:22px;font-size:11px;">${esc(T('打开', 'Open'))}</button>
          </div>
        </div>`;
      }).join('');

      contentEl.querySelectorAll('[data-jump-repo], .act-lp-open').forEach((el) => {
        el.addEventListener('click', () => jumpToRepo(el.getAttribute('data-jump-repo') || el.getAttribute('data-repo')));
      });
      contentEl.querySelectorAll('.act-lp-scm').forEach((el) => {
        el.addEventListener('click', () => jumpToRepo(el.getAttribute('data-repo'), () => setTimeout(() => app.openScmModal(), 180)));
      });
      contentEl.querySelectorAll('.act-lp-wt').forEach((el) => {
        el.addEventListener('click', () => jumpToRepo(el.getAttribute('data-repo'), () => setTimeout(() => window.GitMapFeatures?.openWorktreesModal?.(), 180)));
      });
    }

    async function loadStatuses() {
      contentEl.innerHTML = `<div style="padding:14px;color:var(--vscode-descriptionForeground)">${esc(T('正在汇总所有仓库行动队列…', 'Loading Launchpad status across repositories…'))}</div>`;
      renderHeatmap();
      renderPrPanel();
      try {
        const [lpRes, hmRes] = await Promise.all([
          app.rpc('repos:launchpad', { repos: repoKeys }),
          app.rpc('repos:activityHeatmap', { repos: repoKeys, weeks: 16 }).catch(() => null)
        ]);
        const stMap = lpRes.statuses || {};
        statusesList = Array.isArray(stMap) ? stMap : repoKeys.map((k) => stMap[k]).filter(Boolean);
        launchpadData = lpRes.launchpad || null;
        heatmapData = hmRes;
        renderHeatmap();
        renderBuckets();
        renderOverview();
        // Auto-aggregate remote PR/CI only for repositories with saved API tokens (zero rate-limit risk)
        void loadPrs(true, false);
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
      contentEl.innerHTML = `<div style="padding:14px;color:var(--vscode-descriptionForeground)">${esc(T('正在跨仓库搜索提交历史…', 'Searching commits across repositories…'))}</div>`;
      try {
        const res = await app.rpc('repos:searchCommits', { query: q, author, limitPerRepo: 25 });
        const hits = res.hits || [];
        if (!hits.length) {
          contentEl.innerHTML = `<div style="padding:14px;color:var(--vscode-descriptionForeground)">${esc(T('未找到匹配的提交。', 'No matching commits found.'))}</div>`;
          return;
        }
        contentEl.innerHTML = hits.map((h) => {
          const disp = app.parseRepoDisplay(h.repo);
          const dt = h.date ? new Date(h.date * 1000).toLocaleString() : '';
          return `<div class="gm-enh-card" style="cursor:pointer" data-hit-repo="${esc(h.repo)}" data-hit-hash="${esc(h.hash)}">
            <div class="gm-enh-card-head">
              <span><span class="gm-badge info">${esc(disp.name)}</span> <code>${esc(h.shortHash)}</code> ${esc(h.subject)}</span>
              <span style="font-size:11px;color:var(--vscode-descriptionForeground);font-weight:400">${esc(h.author)} · ${esc(dt)}</span>
            </div>
          </div>`;
        }).join('');
        contentEl.querySelectorAll('[data-hit-repo]').forEach((el) => {
          el.addEventListener('click', async () => {
            const r = el.getAttribute('data-hit-repo');
            const hash = el.getAttribute('data-hit-hash');
            await jumpToRepo(r, () => {
              setTimeout(() => {
                app.sendWs({ type: 'graph:message', payload: { command: 'scrollToCommit', hash } });
              }, 350);
            });
          });
        });
      } catch (err) {
        contentEl.innerHTML = `<div style="padding:14px;color:#ef4444">${esc(err.message)}</div>`;
      }
    }

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
      `${disp.name} (${disp.fullDisplay || target})`,
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
        const skippedNote = lastResult.hashCheckSkipped > 0
          ? T(` · ${lastResult.hashCheckSkipped} 个同大小大文件未做哈希校验`, ` · ${lastResult.hashCheckSkipped} same-size file(s) skipped content hash`)
          : '';
        sumEl.textContent = T(
          `总计 ${s.total} 个文件 · 差异 ${s.modified} · 仅左 ${s.leftOnly} · 仅右 ${s.rightOnly} · 一致 ${s.identical}${skippedNote}`,
          `Total ${s.total} · Modified ${s.modified} · Left-only ${s.leftOnly} · Right-only ${s.rightOnly} · Identical ${s.identical}${skippedNote}`
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

  /* ── 5. Cross-Branch Specific Commit Comparison Modal ── */
  async function openCommitCompareModal(preset) {
    const app = getApp();
    const repo = activeRepo();
    if (!app || !repo) {
      app?.showToast(T('请先选择一个仓库', 'Select a repository first'), 'warning');
      return;
    }

    const body = openModalShell(
      T('对比两个分支的指定提交', 'Compare Specific Commits Across Branches'),
      T('分别在两个分支/标签上选择任意提交，查看精确代码差异与独有提交记录', 'Pick any commit from two branches or tags to inspect exact file diffs and commit delta'),
      true
    );
    if (!body) return;

    body.innerHTML = `<div class="gm-empty">${esc(T('正在加载分支与标签列表…', 'Loading branches and tags…'))}</div>`;

    let refsData;
    try {
      refsData = await app.rpc('compare:refs', { repo });
    } catch (err) {
      body.innerHTML = `<div class="gm-empty" style="color:var(--vscode-errorForeground)">${esc(err.message)}</div>`;
      return;
    }

    const localBranches = refsData.localBranches || [];
    const remoteBranches = refsData.remoteBranches || [];
    const tags = refsData.tags || [];
    const allRefs = [
      ...localBranches.map((b) => b.name),
      ...remoteBranches.map((b) => b.name),
      ...tags.map((t) => t.name)
    ];

    const pickDefaultLeft = () => {
      if (preset && preset.leftRef && allRefs.includes(preset.leftRef)) return preset.leftRef;
      if (refsData.headBranch && allRefs.includes(refsData.headBranch)) return refsData.headBranch;
      return allRefs[0] || 'HEAD';
    };
    const pickDefaultRight = (leftName) => {
      if (preset && preset.rightRef && allRefs.includes(preset.rightRef)) return preset.rightRef;
      const preferred = ['main', 'master', 'origin/main', 'origin/master'].find((n) => n !== leftName && allRefs.includes(n));
      if (preferred) return preferred;
      return allRefs.find((n) => n !== leftName) || leftName;
    };

    const st = {
      leftRef: pickDefaultLeft(),
      rightRef: '',
      leftHash: (preset && preset.leftHash) || '',
      rightHash: (preset && preset.rightHash) || '',
      leftCommits: [],
      rightCommits: [],
      fromMergeBase: false,
      activeResultTab: 'files',
      fileFilter: '',
      lastDiff: null,
      leftSeq: 0,
      rightSeq: 0,
      compareSeq: 0
    };
    st.rightRef = pickDefaultRight(st.leftRef);

    const buildRefOptionsHtml = (selectedRef) => {
      const group = (label, list) => list.length === 0 ? '' : `<optgroup label="${esc(label)}">${list.map((it) => `<option value="${esc(it.name)}"${it.name === selectedRef ? ' selected' : ''}>${esc(it.name)}${it.isHead ? ' (HEAD)' : ''}</option>`).join('')}</optgroup>`;
      const html = group(T('本地分支', 'Local Branches'), localBranches)
        + group(T('远程分支', 'Remote Branches'), remoteBranches)
        + group(T('标签', 'Tags'), tags);
      return html || `<option value="HEAD" selected>HEAD</option>`;
    };

    const fmtDate = (unixSec) => {
      if (!unixSec) return '';
      const d = new Date(unixSec * 1000);
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    body.innerHTML = `
      <div class="gm-cc-pickers">
        <div class="gm-cc-side" data-side="left">
          <div class="gm-cc-side-head">
            <span class="gm-cc-badge left">A</span>
            <select class="gm-cc-ref-sel" id="gmCcLeftRef">${buildRefOptionsHtml(st.leftRef)}</select>
            <input type="text" class="gm-cc-search" id="gmCcLeftSearch" placeholder="${esc(T('筛选提交说明或粘贴 Commit SHA…', 'Filter commits or paste SHA…'))}" />
          </div>
          <div class="gm-cc-commit-list" id="gmCcLeftList"></div>
        </div>
        <div class="gm-cc-mid">
          <button type="button" class="mini-btn" id="gmCcSwap" title="${esc(T('交换左右提交', 'Swap A and B'))}">⇄</button>
        </div>
        <div class="gm-cc-side" data-side="right">
          <div class="gm-cc-side-head">
            <span class="gm-cc-badge right">B</span>
            <select class="gm-cc-ref-sel" id="gmCcRightRef">${buildRefOptionsHtml(st.rightRef)}</select>
            <input type="text" class="gm-cc-search" id="gmCcRightSearch" placeholder="${esc(T('筛选提交说明或粘贴 Commit SHA…', 'Filter commits or paste SHA…'))}" />
          </div>
          <div class="gm-cc-commit-list" id="gmCcRightList"></div>
        </div>
      </div>
      <div class="gm-cc-bar">
        <div class="gm-cc-summary" id="gmCcSummary">${esc(T('正在选择提交…', 'Selecting commits…'))}</div>
        <div class="gm-cc-bar-actions">
          <label class="inline-check" title="${esc(T('关闭：精确对比提交 A 与 B 的文件树差异 (B..A)；开启：仅显示 A 相对共同祖先的改动 (B...A)', 'Off: direct diff between Commit B and Commit A; On: changes on A since merge base (three-dot)'))}">
            <input type="checkbox" id="gmCcMergeBase" />
            <span>${esc(T('自共同祖先对比 (A...B)', 'Since merge base (A...B)'))}</span>
          </label>
          <button type="button" class="mini-btn primary" id="gmCcOpenAll" disabled>${esc(T('全部差异打开', 'Open All Changes'))}</button>
        </div>
      </div>
      <div class="gm-cc-tabs-bar">
        <div class="gm-cc-tabs">
          <button type="button" class="gm-cc-tab active" data-tab="files">${esc(T('变更文件', 'Changed Files'))} <span id="gmCcFilesCnt"></span></button>
          <button type="button" class="gm-cc-tab" data-tab="commits">${esc(T('独有提交', 'Commit Delta'))} <span id="gmCcCommitsCnt"></span></button>
        </div>
        <input type="text" class="gm-cc-file-filter" id="gmCcFileFilter" placeholder="${esc(T('筛选文件路径…', 'Filter changed files…'))}" />
      </div>
      <div class="gm-cc-results" id="gmCcResults"></div>
    `;

    const leftRefSel = body.querySelector('#gmCcLeftRef');
    const rightRefSel = body.querySelector('#gmCcRightRef');
    const leftSearch = body.querySelector('#gmCcLeftSearch');
    const rightSearch = body.querySelector('#gmCcRightSearch');
    const leftList = body.querySelector('#gmCcLeftList');
    const rightList = body.querySelector('#gmCcRightList');
    const summaryEl = body.querySelector('#gmCcSummary');
    const mergeBaseChk = body.querySelector('#gmCcMergeBase');
    const openAllBtn = body.querySelector('#gmCcOpenAll');
    const fileFilterInput = body.querySelector('#gmCcFileFilter');
    const resultsEl = body.querySelector('#gmCcResults');
    const filesCntEl = body.querySelector('#gmCcFilesCnt');
    const commitsCntEl = body.querySelector('#gmCcCommitsCnt');

    function renderCommitList(side) {
      const listEl = side === 'left' ? leftList : rightList;
      const commits = side === 'left' ? st.leftCommits : st.rightCommits;
      const selectedHash = side === 'left' ? st.leftHash : st.rightHash;
      const q = (side === 'left' ? leftSearch.value : rightSearch.value).trim().toLowerCase();
      const filtered = q
        ? commits.filter((c) => c.hash.toLowerCase().includes(q) || c.subject.toLowerCase().includes(q) || c.author.toLowerCase().includes(q))
        : commits;
      const isRawSha = /^[0-9a-f]{6,40}$/.test(q) && !filtered.some((c) => c.hash.toLowerCase().startsWith(q));
      const rows = [];
      if (isRawSha) {
        rows.push(`<button type="button" class="gm-cc-commit-item${selectedHash.toLowerCase() === q ? ' selected' : ''}" data-hash="${esc(q)}"><code class="gm-cc-sha">${esc(q.slice(0, 8))}</code><span class="gm-cc-subj">${esc(T('直接使用输入的 Commit SHA', 'Use entered commit SHA'))}</span><span class="gm-cc-meta"></span></button>`);
      }
      if (selectedHash && !filtered.some((c) => c.hash === selectedHash) && !isRawSha) {
        rows.push(`<button type="button" class="gm-cc-commit-item selected" data-hash="${esc(selectedHash)}"><code class="gm-cc-sha">${esc(selectedHash.slice(0, 8))}</code><span class="gm-cc-subj">${esc(T('已预选的提交', 'Pre-selected commit'))}</span><span class="gm-cc-meta"></span></button>`);
      }
      filtered.forEach((c) => {
        const active = c.hash === selectedHash;
        rows.push(`<button type="button" class="gm-cc-commit-item${active ? ' selected' : ''}" data-hash="${esc(c.hash)}" title="${esc(c.hash + '\n' + c.subject + '\n' + c.author + ' · ' + fmtDate(c.date))}">
          <code class="gm-cc-sha">${esc(c.shortHash)}</code>
          <span class="gm-cc-subj">${esc(c.subject)}</span>
          <span class="gm-cc-meta">${esc(c.author)} · ${esc(fmtDate(c.date).slice(5, 16))}</span>
        </button>`);
      });
      listEl.innerHTML = rows.length > 0
        ? rows.join('')
        : `<div class="gm-cc-empty">${esc(T('未找到匹配提交', 'No matching commits'))}</div>`;
      listEl.querySelectorAll('.gm-cc-commit-item').forEach((btn) => {
        btn.addEventListener('click', () => {
          const h = btn.getAttribute('data-hash');
          if (side === 'left') st.leftHash = h;
          else st.rightHash = h;
          renderCommitList(side);
          runCompare();
        });
      });
    }

    async function loadSideCommits(side, preserveHash) {
      const ref = side === 'left' ? st.leftRef : st.rightRef;
      const listEl = side === 'left' ? leftList : rightList;
      const seq = side === 'left' ? ++st.leftSeq : ++st.rightSeq;
      listEl.innerHTML = `<div class="gm-cc-empty">${esc(T('正在加载提交列表…', 'Loading commits…'))}</div>`;
      try {
        const res = await app.rpc('compare:branchCommits', { repo, ref, limit: 120 });
        if ((side === 'left' && seq !== st.leftSeq) || (side === 'right' && seq !== st.rightSeq)) return;
        const list = res.commits || [];
        if (side === 'left') {
          st.leftCommits = list;
          if (!preserveHash || !st.leftHash) st.leftHash = list[0] ? list[0].hash : ref;
        } else {
          st.rightCommits = list;
          if (!preserveHash || !st.rightHash) st.rightHash = list[0] ? list[0].hash : ref;
        }
        renderCommitList(side);
      } catch (err) {
        if ((side === 'left' && seq !== st.leftSeq) || (side === 'right' && seq !== st.rightSeq)) return;
        listEl.innerHTML = `<div class="gm-cc-empty" style="color:var(--vscode-errorForeground)">${esc(err.message)}</div>`;
      }
    }

    function renderResults() {
      const res = st.lastDiff;
      if (!res) return;
      const files = res.fileChanges || [];
      filesCntEl.textContent = `(${files.length})`;
      commitsCntEl.textContent = `(${res.leftOnlyCount + res.rightOnlyCount})`;
      openAllBtn.disabled = files.length === 0;
      fileFilterInput.classList.toggle('hidden', st.activeResultTab !== 'files');

      if (st.activeResultTab === 'commits') {
        const renderDeltaCol = (title, badgeCls, badgeText, list, totalCount) => `
          <div class="gm-cc-delta-col">
            <div class="gm-cc-delta-head"><span class="gm-cc-badge ${badgeCls}">${badgeText}</span><span>${esc(title)}</span><b>${totalCount}</b></div>
            <div class="gm-cc-delta-list">${list.length > 0 ? list.map((c) => `
              <div class="gm-cc-delta-item" title="${esc(c.hash + ' · ' + c.subject)}">
                <code class="gm-cc-sha">${esc(c.shortHash)}</code>
                <span class="gm-cc-subj">${esc(c.subject)}</span>
                <span class="gm-cc-meta">${esc(c.author)}</span>
              </div>`).join('') : `<div class="gm-cc-empty">${esc(T('无独有提交', 'No unique commits'))}</div>`}
              ${totalCount > list.length ? `<div class="gm-cc-empty">${esc(T(`仅显示前 ${list.length} 条，共 ${totalCount} 条`, `Showing first ${list.length} of ${totalCount}`))}</div>` : ''}
            </div>
          </div>`;
        resultsEl.innerHTML = `<div class="gm-cc-delta-grid">
          ${renderDeltaCol(T(`仅在 A (${res.leftMeta.shortHash})`, `Only in A (${res.leftMeta.shortHash})`), 'left', 'A', res.leftOnlyCommits || [], res.leftOnlyCount)}
          ${renderDeltaCol(T(`仅在 B (${res.rightMeta.shortHash})`, `Only in B (${res.rightMeta.shortHash})`), 'right', 'B', res.rightOnlyCommits || [], res.rightOnlyCount)}
        </div>`;
        return;
      }

      const q = st.fileFilter.trim().toLowerCase();
      const visible = q ? files.filter((f) => (f.newFilePath || '').toLowerCase().includes(q) || (f.oldFilePath || '').toLowerCase().includes(q)) : files;
      if (visible.length === 0) {
        resultsEl.innerHTML = `<div class="gm-cc-empty">${esc(files.length === 0 ? T('两个提交之间没有文件差异', 'No file differences between these two commits') : T('没有匹配筛选条件的文件', 'No files match the filter'))}</div>`;
        return;
      }
      resultsEl.innerHTML = visible.map((f, idx) => {
        const displayPath = f.type === 'R' && f.oldFilePath ? `${f.oldFilePath} → ${f.newFilePath}` : f.newFilePath;
        const stats = (f.additions != null && f.deletions != null)
          ? `<span class="gm-cc-add">+${f.additions}</span><span class="gm-cc-del">−${f.deletions}</span>`
          : `<span class="gm-cc-meta">${esc(T('二进制', 'Binary'))}</span>`;
        return `<button type="button" class="gm-cc-file-row" data-fidx="${idx}" title="${esc(displayPath)}">
          <span class="scm-status-badge st-${esc((f.type || 'M')[0])}">${esc(f.type || 'M')}</span>
          <span class="gm-cc-file-path">${esc(displayPath)}</span>
          <span class="gm-cc-file-stats">${stats}</span>
        </button>`;
      }).join('');

      resultsEl.querySelectorAll('.gm-cc-file-row').forEach((row) => {
        row.addEventListener('click', () => {
          const f = visible[Number(row.getAttribute('data-fidx'))];
          if (!f) return;
          document.getElementById('featureModal')?.classList.add('hidden');
          app.openDiffTab({
            repo,
            fromHash: res.effectiveFrom,
            toHash: res.effectiveTo,
            oldFilePath: f.oldFilePath || f.newFilePath,
            newFilePath: f.newFilePath,
            type: f.type || 'M',
            title: `${(f.newFilePath || '').split('/').pop()} (${res.effectiveFrom.slice(0, 7)} → ${res.effectiveTo.slice(0, 7)})`
          });
        });
      });
    }

    async function runCompare() {
      if (!st.leftHash || !st.rightHash) return;
      const seq = ++st.compareSeq;
      summaryEl.textContent = T('正在对比两个提交…', 'Comparing commits…');
      resultsEl.innerHTML = `<div class="gm-cc-empty">${esc(T('正在计算文件差异…', 'Computing file diff…'))}</div>`;
      openAllBtn.disabled = true;
      try {
        const res = await app.rpc('compare:commits', {
          repo,
          leftHash: st.leftHash,
          rightHash: st.rightHash,
          fromMergeBase: st.fromMergeBase
        });
        if (seq !== st.compareSeq) return;
        st.lastDiff = res;
        const addSum = (res.fileChanges || []).reduce((s, f) => s + (f.additions || 0), 0);
        const delSum = (res.fileChanges || []).reduce((s, f) => s + (f.deletions || 0), 0);
        const baseText = res.mergeBase
          ? T(` · 共同祖先 ${res.mergeBase.slice(0, 8)}`, ` · Merge base ${res.mergeBase.slice(0, 8)}`)
          : T(' · 无共同祖先', ' · No common ancestor');
        summaryEl.innerHTML = `<code>${esc(res.rightMeta.shortHash)}</code> → <code>${esc(res.leftMeta.shortHash)}</code>`
          + ` · <strong>${res.fileChanges.length}</strong> ${esc(T('个文件', 'files'))}`
          + ` <span class="gm-cc-add">+${addSum}</span> <span class="gm-cc-del">−${delSum}</span>`
          + ` · ↑${res.leftOnlyCount} ↓${res.rightOnlyCount}${esc(baseText)}`;
        renderResults();
      } catch (err) {
        if (seq !== st.compareSeq) return;
        summaryEl.textContent = '';
        resultsEl.innerHTML = `<div class="gm-cc-empty" style="color:var(--vscode-errorForeground)">${esc(err.message)}</div>`;
      }
    }

    leftRefSel.addEventListener('change', async () => {
      st.leftRef = leftRefSel.value;
      leftSearch.value = '';
      await loadSideCommits('left', false);
      runCompare();
    });
    rightRefSel.addEventListener('change', async () => {
      st.rightRef = rightRefSel.value;
      rightSearch.value = '';
      await loadSideCommits('right', false);
      runCompare();
    });
    leftSearch.addEventListener('input', () => renderCommitList('left'));
    rightSearch.addEventListener('input', () => renderCommitList('right'));
    leftSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const first = leftList.querySelector('.gm-cc-commit-item');
        if (first) first.click();
      }
    });
    rightSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const first = rightList.querySelector('.gm-cc-commit-item');
        if (first) first.click();
      }
    });
    body.querySelector('#gmCcSwap').addEventListener('click', () => {
      [st.leftRef, st.rightRef] = [st.rightRef, st.leftRef];
      [st.leftHash, st.rightHash] = [st.rightHash, st.leftHash];
      [st.leftCommits, st.rightCommits] = [st.rightCommits, st.leftCommits];
      leftRefSel.value = st.leftRef;
      rightRefSel.value = st.rightRef;
      renderCommitList('left');
      renderCommitList('right');
      runCompare();
    });
    mergeBaseChk.addEventListener('change', () => {
      st.fromMergeBase = mergeBaseChk.checked;
      runCompare();
    });
    fileFilterInput.addEventListener('input', () => {
      st.fileFilter = fileFilterInput.value;
      renderResults();
    });
    body.querySelectorAll('.gm-cc-tab').forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => {
        st.activeResultTab = tabBtn.getAttribute('data-tab') || 'files';
        body.querySelectorAll('.gm-cc-tab').forEach((b) => b.classList.toggle('active', b === tabBtn));
        renderResults();
      });
    });
    openAllBtn.addEventListener('click', () => {
      const res = st.lastDiff;
      if (!res || !res.fileChanges || res.fileChanges.length === 0) return;
      document.getElementById('featureModal')?.classList.add('hidden');
      app.openMultiDiffTab({
        title: `${res.rightMeta.shortHash} ↔ ${res.leftMeta.shortHash}`,
        files: res.fileChanges.map((f) => ({
          repo,
          fromHash: res.effectiveFrom,
          toHash: res.effectiveTo,
          oldFilePath: f.oldFilePath || f.newFilePath,
          newFilePath: f.newFilePath,
          type: f.type || 'M'
        }))
      });
    });

    await Promise.all([
      loadSideCommits('left', !!(preset && preset.leftHash)),
      loadSideCommits('right', !!(preset && preset.rightHash))
    ]);
    await runCompare();
  }

  /* ── 7. AI Commit Composer (Split Dirty Working Tree into Ordered Atomic Commits) ── */
  async function openCommitComposerModal() {
    const app = getApp();
    const repo = app?.state?.activeRepo;
    if (!repo) {
      app?.showToast(T('请先选择一个活跃仓库', 'Select an active repository first'), 'warning');
      return;
    }

    const shared = window.GitMapFeatures && window.GitMapFeatures.openFeatureModal;
    const ui = shared
      ? shared({
          title: T('AI 提交编排器 (Commit Composer)', 'AI Commit Composer'),
          subtitle: T('把杂乱工作区拆分为多个逻辑清晰的原子提交并按顺序执行（执行前自动创建安全备份）', 'Organize working tree changes into logical, ordered atomic commits (safety backup ref created automatically)'),
          badge: app.parseRepoDisplay(repo).name,
          icon: app.ICONS.sparkle,
          width: 'min(980px, 95vw)',
          bodyHtml: ''
        })
      : { bodyEl: openModalShell(T('AI 提交编排器 (Commit Composer)', 'AI Commit Composer'), '', true), footerEl: null, close: () => document.getElementById('featureModal')?.classList.add('hidden') };
    if (!ui || !ui.bodyEl) return;

    let drafts = [];
    let unassignedFiles = [];
    let usedAi = false;
    let branchContext = [];
    let viewMode = 'visual'; // 'visual' | 'raw'
    let styleVal = 'conventional';
    let langVal = app.state.lang === 'en' ? 'en' : 'zh';

    ui.bodyEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <button type="button" id="gmCompAnalyzeBtn" class="mini-btn primary">${app.ICONS.sparkle}<span>${esc(T('重新分析拆分', 'Re-Analyze & Split'))}</span></button>
          <select id="gmCompStyle" style="height:26px;font-size:12px;">
            <option value="conventional">Conventional Commits</option>
            <option value="concise">${esc(T('简洁单行', 'Concise'))}</option>
            <option value="detailed">${esc(T('详细要点', 'Detailed'))}</option>
          </select>
          <select id="gmCompLang" style="height:26px;font-size:12px;">
            <option value="zh" ${langVal === 'zh' ? 'selected' : ''}>中文</option>
            <option value="en" ${langVal === 'en' ? 'selected' : ''}>English</option>
          </select>
          <button type="button" id="gmCompAddGroupBtn" class="mini-btn">${app.ICONS.plus}<span>${esc(T('新建提交组', 'Add Draft'))}</span></button>
          <span id="gmCompStatusSlot"></span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <div id="gmCompModelSlot"></div>
          <div class="segmented-control">
            <button type="button" class="gm-comp-view active" data-mode="visual">${esc(T('可视化编排', 'Visual'))}</button>
            <button type="button" class="gm-comp-view" data-mode="raw">Raw JSON / CLI</button>
          </div>
        </div>
      </div>
      <div id="gmCompBody"></div>
    `;

    const modelSlot = ui.bodyEl.querySelector('#gmCompModelSlot');
    if (modelSlot && app.mountQuickAiModelPill) {
      app.mountQuickAiModelPill(modelSlot, { alignRight: true });
    }

    const compBody = ui.bodyEl.querySelector('#gmCompBody');
    const statusSlot = ui.bodyEl.querySelector('#gmCompStatusSlot');
    const styleSel = ui.bodyEl.querySelector('#gmCompStyle');
    const langSel = ui.bodyEl.querySelector('#gmCompLang');

    function buildRawPlan() {
      const valid = drafts.filter((d) => d.files.length > 0);
      const cli = valid
        .map((d) => `git add -A -- ${d.files.map((f) => JSON.stringify(f)).join(' ')} && git commit -m ${JSON.stringify(d.message)}`)
        .join('\n');
      return JSON.stringify({
        mode: usedAi ? 'ai' : 'heuristic',
        branchContext,
        drafts: valid.map((d) => ({ title: d.title, message: d.message, files: d.files, rationale: d.rationale })),
        unassignedFiles,
        cliPreview: cli
      }, null, 2);
    }

    function renderFooter() {
      if (!ui.footerEl) return;
      const nonEmpty = drafts.filter((d) => d.files.length > 0);
      const fileTotal = nonEmpty.reduce((s, d) => s + d.files.length, 0);
      ui.footerEl.innerHTML = `
        <span style="margin-right:auto;font-size:12px;color:var(--vscode-descriptionForeground);">
          ${esc(T(`计划生成 ${nonEmpty.length} 个提交 · 覆盖 ${fileTotal} 个文件`, `Planned: ${nonEmpty.length} commit(s) · ${fileTotal} file(s)`))}
          ${unassignedFiles.length > 0 ? esc(T(`（${unassignedFiles.length} 个文件将保留在工作区）`, ` (${unassignedFiles.length} kept uncommitted)`)) : ''}
        </span>
        <button type="button" class="mini-btn act-fm-close">${esc(T('取消', 'Cancel'))}</button>
        <button type="button" class="mini-btn primary act-comp-exec" ${nonEmpty.length === 0 ? 'disabled' : ''}>${app.ICONS.check}<span>${esc(T(`按计划依次创建 ${nonEmpty.length} 个提交`, `Execute ${nonEmpty.length} Commit(s)`))}</span></button>
      `;
      ui.footerEl.querySelector('.act-fm-close')?.addEventListener('click', ui.close);
      const execBtn = ui.footerEl.querySelector('.act-comp-exec');
      if (execBtn) {
        execBtn.addEventListener('click', async () => {
          const toRun = drafts
            .filter((d) => d.files.length > 0)
            .map((d) => ({ message: String(d.message || '').trim(), files: d.files }));
          if (toRun.some((d) => !d.message)) {
            app.showToast(T('每个非空提交组都需要填写提交说明', 'Every non-empty draft requires a commit message'), 'warning');
            return;
          }
          execBtn.disabled = true;
          try {
            const res = await app.rpc('scm:executeCommitPlan', { repo, drafts: toRun });
            const cnt = (res.commits || []).length;
            app.showToast(
              T(`已按计划依次创建 ${cnt} 个原子提交`, `Created ${cnt} atomic commit(s) in order`),
              'info',
              {
                detail: (res.commits || []).map((c) => `${c.shortHash} ${c.subject}`).join(' · ').slice(0, 90),
                actionLabel: T('查看 Reflog', 'View Reflog'),
                onAction: () => window.GitMapFeatures?.openReflogModal?.()
              }
            );
            ui.close();
            app.activateTab('graph');
            window.GitMapFeatures?.refreshAllStatusesAndContext?.();
          } catch (err) {
            app.showToast(err.message, 'error');
            execBtn.disabled = false;
          }
        });
      }
    }

    function renderDrafts() {
      ui.bodyEl.querySelectorAll('.gm-comp-view').forEach((b) => {
        b.classList.toggle('active', b.getAttribute('data-mode') === viewMode);
      });
      if (viewMode === 'raw') {
        compBody.innerHTML = `
          <div class="feature-card">
            <div class="feature-card-top">
              <strong>${esc(T('提交编排计划 JSON 与等效 Git CLI', 'Commit Plan JSON & Equivalent Git CLI'))}</strong>
              <button type="button" id="gmCompCopyRaw" class="mini-btn">${app.ICONS.copy}<span>${esc(T('复制 JSON', 'Copy JSON'))}</span></button>
            </div>
            <pre class="logs-pre" style="max-height:380px;margin:6px 0 0;">${esc(buildRawPlan())}</pre>
          </div>
        `;
        compBody.querySelector('#gmCompCopyRaw')?.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(buildRawPlan());
            app.showToast(T('已复制编排计划 JSON', 'Copied commit plan JSON'), 'info');
          } catch (err) {
            app.showToast(err.message, 'error');
          }
        });
        renderFooter();
        return;
      }

      const modeBadge = usedAi
        ? `<span class="gm-badge ok">${esc(T('AI 智能归组', 'AI Composed'))}</span>`
        : `<span class="gm-badge warn">${esc(T('启发式按模块归组（未配置 AI）', 'Heuristic Module Split (No AI)'))}</span>`;
      const ctxBadge = branchContext.length > 0
        ? `<span class="gm-badge info">${esc(T(`已参考近 ${branchContext.length} 条分支提交风格`, `Aligned with ${branchContext.length} branch commits`))}</span>`
        : '';

      compBody.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
          ${modeBadge}${ctxBadge}
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;max-height:54vh;overflow:auto;">
          ${drafts.map((d, idx) => `
            <div class="gm-composer-draft" data-draft-idx="${idx}">
              <div class="gm-composer-draft-head">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                  <span class="gm-badge info">#${idx + 1}</span>
                  <strong>${esc(d.title || T(`提交 #${idx + 1}`, `Commit #${idx + 1}`))}</strong>
                  ${d.rationale ? `<span style="font-size:11.5px;color:var(--vscode-descriptionForeground);">${esc(d.rationale)}</span>` : ''}
                </div>
                <div style="display:inline-flex;gap:4px;">
                  <button type="button" class="mini-icon-btn act-comp-up" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''}>${app.ICONS.arrowUp}</button>
                  <button type="button" class="mini-icon-btn act-comp-down" data-idx="${idx}" ${idx === drafts.length - 1 ? 'disabled' : ''}>${app.ICONS.arrowDown}</button>
                  <button type="button" class="mini-icon-btn danger act-comp-del" data-idx="${idx}" title="${esc(T('删除此提交组（文件移回未分配）', 'Remove draft (files move to unassigned)'))}">${app.ICONS.trash}</button>
                </div>
              </div>
              <textarea class="scm-commit-textarea gm-comp-msg" data-idx="${idx}" style="min-height:54px;">${esc(d.message)}</textarea>
              <div class="gm-composer-files">
                ${d.files.length === 0
                  ? `<span style="font-size:11.5px;color:var(--vscode-descriptionForeground);">${esc(T('（暂无文件，执行时将跳过此空组）', '(No files — skipped on execute)'))}</span>`
                  : d.files.map((fp) => `
                    <span class="gm-composer-file-chip">
                      <span title="${esc(fp)}">${esc(fp)}</span>
                      <select class="gm-comp-move-file" data-from="${idx}" data-file="${esc(fp)}" title="${esc(T('移动此文件到其他提交组', 'Move file to another draft'))}">
                        ${drafts.map((_, ti) => `<option value="${ti}" ${ti === idx ? 'selected' : ''}>#${ti + 1}</option>`).join('')}
                        <option value="-1">${esc(T('暂不提交', 'Unassign'))}</option>
                      </select>
                    </span>
                  `).join('')}
              </div>
            </div>
          `).join('')}
          ${unassignedFiles.length > 0 ? `
            <div class="gm-composer-draft" style="border-style:dashed;">
              <div class="gm-composer-draft-head">
                <strong>${esc(T(`暂不提交的文件 (${unassignedFiles.length})`, `Unassigned Files (${unassignedFiles.length})`))}</strong>
                <span style="font-size:11.5px;color:var(--vscode-descriptionForeground);">${esc(T('这些文件会保留在工作区，不会在本次计划中提交', 'These files remain uncommitted in your working tree'))}</span>
              </div>
              <div class="gm-composer-files">
                ${unassignedFiles.map((fp) => `
                  <span class="gm-composer-file-chip">
                    <span>${esc(fp)}</span>
                    <select class="gm-comp-assign-file" data-file="${esc(fp)}">
                      <option value="-1" selected>${esc(T('分配到…', 'Assign…'))}</option>
                      ${drafts.map((_, ti) => `<option value="${ti}">#${ti + 1}</option>`).join('')}
                    </select>
                  </span>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `;

      compBody.querySelectorAll('.gm-comp-msg').forEach((ta) => {
        ta.addEventListener('input', () => {
          drafts[Number(ta.getAttribute('data-idx'))].message = ta.value;
        });
      });
      compBody.querySelectorAll('.act-comp-up').forEach((b) => {
        b.addEventListener('click', () => {
          const i = Number(b.getAttribute('data-idx'));
          if (i > 0) {
            [drafts[i - 1], drafts[i]] = [drafts[i], drafts[i - 1]];
            renderDrafts();
          }
        });
      });
      compBody.querySelectorAll('.act-comp-down').forEach((b) => {
        b.addEventListener('click', () => {
          const i = Number(b.getAttribute('data-idx'));
          if (i < drafts.length - 1) {
            [drafts[i + 1], drafts[i]] = [drafts[i], drafts[i + 1]];
            renderDrafts();
          }
        });
      });
      compBody.querySelectorAll('.act-comp-del').forEach((b) => {
        b.addEventListener('click', () => {
          const i = Number(b.getAttribute('data-idx'));
          const removed = drafts.splice(i, 1)[0];
          if (removed && removed.files.length > 0) {
            unassignedFiles = Array.from(new Set([...unassignedFiles, ...removed.files]));
          }
          renderDrafts();
        });
      });
      compBody.querySelectorAll('.gm-comp-move-file').forEach((sel) => {
        sel.addEventListener('change', () => {
          const fromIdx = Number(sel.getAttribute('data-from'));
          const fp = sel.getAttribute('data-file');
          const toIdx = Number(sel.value);
          drafts[fromIdx].files = drafts[fromIdx].files.filter((x) => x !== fp);
          if (toIdx === -1) {
            if (!unassignedFiles.includes(fp)) unassignedFiles.push(fp);
          } else if (drafts[toIdx] && !drafts[toIdx].files.includes(fp)) {
            drafts[toIdx].files.push(fp);
          }
          renderDrafts();
        });
      });
      compBody.querySelectorAll('.gm-comp-assign-file').forEach((sel) => {
        sel.addEventListener('change', () => {
          const fp = sel.getAttribute('data-file');
          const toIdx = Number(sel.value);
          if (toIdx >= 0 && drafts[toIdx]) {
            unassignedFiles = unassignedFiles.filter((x) => x !== fp);
            if (!drafts[toIdx].files.includes(fp)) drafts[toIdx].files.push(fp);
            renderDrafts();
          }
        });
      });

      renderFooter();
    }

    async function analyze() {
      const btn = ui.bodyEl.querySelector('#gmCompAnalyzeBtn');
      btn.disabled = true;
      if (statusSlot) {
        statusSlot.innerHTML = `<span class="gm-ai-status"><span class="gm-ai-dot"></span>${esc(T('正在智能分析工作区并规划原子提交…', 'Analyzing working tree & composing commits…'))}</span>`;
      }
      compBody.innerHTML = `<div class="browser-empty-state"><span class="fb-spinner"></span>${esc(T('正在分析工作区变更…', 'Analyzing uncommitted changes…'))}</div>`;
      try {
        const res = await app.rpc('ai:composeCommits', { repo, style: styleVal, language: langVal });
        drafts = (res.drafts || []).map((d) => ({ ...d, files: [...(d.files || [])] }));
        unassignedFiles = [];
        usedAi = !!res.usedAi;
        branchContext = res.branchContext || [];
        renderDrafts();
      } catch (err) {
        compBody.innerHTML = `<div class="gm-empty-card"><div class="gm-empty-card-title error-text">${esc(err.message)}</div></div>`;
        drafts = [];
        renderFooter();
      } finally {
        btn.disabled = false;
        if (statusSlot) statusSlot.innerHTML = '';
      }
    }

    styleSel.addEventListener('change', () => { styleVal = styleSel.value; });
    langSel.addEventListener('change', () => { langVal = langSel.value; });
    ui.bodyEl.querySelector('#gmCompAnalyzeBtn').addEventListener('click', analyze);
    ui.bodyEl.querySelector('#gmCompAddGroupBtn').addEventListener('click', () => {
      drafts.push({
        id: 'draft-custom-' + Date.now(),
        title: T(`自定义提交 #${drafts.length + 1}`, `Custom Commit #${drafts.length + 1}`),
        message: styleVal === 'conventional' ? 'chore: ' : '',
        files: [],
        rationale: T('手动新建的提交分组', 'Manually added commit group')
      });
      renderDrafts();
    });
    ui.bodyEl.querySelectorAll('.gm-comp-view').forEach((b) => {
      b.addEventListener('click', () => {
        viewMode = b.getAttribute('data-mode') || 'visual';
        renderDrafts();
      });
    });

    await analyze();
  }

  /* ── 8. Portable Review Patch Bundles (Export / Inspect & Apply) ── */
  async function openPatchBundleModal(initialTab) {
    const app = getApp();
    const repo = app?.state?.activeRepo;
    if (!repo) {
      app?.showToast(T('请先选择一个活跃仓库', 'Select an active repository first'), 'warning');
      return;
    }

    const shared = window.GitMapFeatures && window.GitMapFeatures.openFeatureModal;
    const ui = shared
      ? shared({
          title: T('便携式 Review Patch 补丁包', 'Portable Review Patch Bundles'),
          subtitle: T('无需推送远程分支，即可将本地未提交改动或提交区间打包为带上下文的 .gitmap-patch.json 分享审阅并一键预检应用', 'Share uncommitted or range diffs as portable JSON bundles with metadata, dry-run check, and 3-way apply'),
          badge: app.parseRepoDisplay(repo).name,
          icon: app.ICONS.patch || app.ICONS.copy,
          width: 'min(920px, 95vw)',
          bodyHtml: ''
        })
      : { bodyEl: openModalShell(T('便携式 Review Patch 补丁包', 'Portable Review Patch Bundles'), '', true), footerEl: null, close: () => document.getElementById('featureModal')?.classList.add('hidden') };
    if (!ui || !ui.bodyEl) return;

    let activeTab = initialTab === 'import' ? 'import' : 'export';
    let lastBundle = null;
    let lastInspect = null;

    function render() {
      ui.bodyEl.innerHTML = `
        <div class="gm-cc-tabs-bar" style="margin-bottom:10px;">
          <div class="gm-cc-tabs">
            <button type="button" class="gm-cc-tab ${activeTab === 'export' ? 'active' : ''}" data-ptab="export">${esc(T('导出补丁包 (Export)', 'Export Patch Bundle'))}</button>
            <button type="button" class="gm-cc-tab ${activeTab === 'import' ? 'active' : ''}" data-ptab="import">${esc(T('导入与预检应用 (Inspect & Apply)', 'Inspect & Apply Patch'))}</button>
          </div>
        </div>
        <div id="gmPatchBody"></div>
      `;

      ui.bodyEl.querySelectorAll('[data-ptab]').forEach((b) => {
        b.addEventListener('click', () => {
          activeTab = b.getAttribute('data-ptab') || 'export';
          render();
        });
      });

      const pBody = ui.bodyEl.querySelector('#gmPatchBody');
      if (activeTab === 'export') {
        pBody.innerHTML = `
          <div class="gm-enh-toolbar">
            <select id="gmPatchScope" style="height:28px;font-size:12px;">
              <option value="working">${esc(T('全部工作区改动 (vs HEAD)', 'Working Tree Changes (vs HEAD)'))}</option>
              <option value="staged">${esc(T('仅已暂存改动 (Staged)', 'Staged Changes Only'))}</option>
              <option value="range">${esc(T('指定提交区间 (from..to)', 'Commit Range (from..to)'))}</option>
            </select>
            <input type="text" id="gmPatchFrom" class="gm-enh-input hidden" style="max-width:160px;" placeholder="from (e.g. main)" />
            <input type="text" id="gmPatchTo" class="gm-enh-input hidden" style="max-width:160px;" value="HEAD" placeholder="to (HEAD)" />
            <input type="text" id="gmPatchNote" class="gm-enh-input" placeholder="${esc(T('可选：填写审阅说明 / 上下文备注…', 'Optional review note / context…'))}" />
            <button type="button" id="gmPatchGenBtn" class="primary-btn">${esc(T('生成补丁包', 'Generate Bundle'))}</button>
          </div>
          <div id="gmPatchExportOut"></div>
        `;
        const scopeSel = pBody.querySelector('#gmPatchScope');
        const fromInp = pBody.querySelector('#gmPatchFrom');
        const toInp = pBody.querySelector('#gmPatchTo');
        const outEl = pBody.querySelector('#gmPatchExportOut');

        scopeSel.addEventListener('change', () => {
          const isRange = scopeSel.value === 'range';
          fromInp.classList.toggle('hidden', !isRange);
          toInp.classList.toggle('hidden', !isRange);
        });

        const renderExportResult = () => {
          if (!lastBundle) {
            outEl.innerHTML = `<div class="gm-empty-card"><div class="gm-empty-card-title">${esc(T('生成带完整上下文的 Review Patch', 'Generate Context-Rich Review Patch'))}</div><div class="gm-empty-card-desc">${esc(T('包含分支、基准提交 SHA、改动统计、审阅备注与完整 Unified Diff，接收方在 GitMap 中粘贴即可预检并一键应用。', 'Includes branch, base SHA, stats, review note, and full unified diff so teammates can dry-run and apply in one click.'))}</div></div>`;
            return;
          }
          const b = lastBundle;
          outEl.innerHTML = `
            <div class="gm-patch-meta-grid">
              <div class="gm-patch-meta-item"><span>${esc(T('分支 / 仓库', 'Branch / Repo'))}</span><strong>${esc(b.branch || 'HEAD')} · ${esc(b.repoName)}</strong></div>
              <div class="gm-patch-meta-item"><span>${esc(T('基准提交 Base', 'Base Commit'))}</span><code>${esc((b.baseHash || '').slice(0, 10) || '—')}</code></div>
              <div class="gm-patch-meta-item"><span>${esc(T('变更统计', 'Diff Stats'))}</span><strong>${b.stats.files} ${esc(T('文件', 'files'))} · <span class="gm-cc-add">+${b.stats.insertions}</span> <span class="gm-cc-del">−${b.stats.deletions}</span></strong></div>
            </div>
            <div class="gm-enh-toolbar" style="margin-bottom:8px;">
              <button type="button" id="gmPatchCopyJson" class="mini-btn primary">${app.ICONS.copy}<span>${esc(T('复制 JSON 补丁包', 'Copy Bundle JSON'))}</span></button>
              <button type="button" id="gmPatchCopyRaw" class="mini-btn">${app.ICONS.copy}<span>${esc(T('复制纯 .patch', 'Copy Raw .patch'))}</span></button>
              <button type="button" id="gmPatchDownload" class="mini-btn">${app.ICONS.download}<span>${esc(T('下载 .gitmap-patch.json', 'Download Bundle'))}</span></button>
            </div>
            <pre class="logs-pre" style="max-height:280px;">${esc(b.patch.slice(0, 16000))}${b.patch.length > 16000 ? '\n… (truncated preview)' : ''}</pre>
          `;
          outEl.querySelector('#gmPatchCopyJson')?.addEventListener('click', async () => {
            await navigator.clipboard.writeText(JSON.stringify(b, null, 2));
            app.showToast(T('已复制 .gitmap-patch.json 补丁包', 'Copied patch bundle JSON'), 'info');
          });
          outEl.querySelector('#gmPatchCopyRaw')?.addEventListener('click', async () => {
            await navigator.clipboard.writeText(b.patch);
            app.showToast(T('已复制纯 Unified Diff (.patch)', 'Copied raw .patch diff'), 'info');
          });
          outEl.querySelector('#gmPatchDownload')?.addEventListener('click', () => {
            const blob = new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${b.repoName || 'repo'}-${(b.branch || 'patch').replace(/[^a-z0-9_-]/gi, '_')}.gitmap-patch.json`;
            a.click();
            URL.revokeObjectURL(url);
            app.showToast(T('已下载便携式补丁包', 'Downloaded patch bundle'), 'info');
          });
        };

        pBody.querySelector('#gmPatchGenBtn').addEventListener('click', async () => {
          try {
            const res = await app.rpc('patch:exportBundle', {
              repo,
              scope: scopeSel.value,
              fromRef: fromInp.value.trim(),
              toRef: toInp.value.trim() || 'HEAD',
              note: pBody.querySelector('#gmPatchNote').value.trim()
            });
            lastBundle = res.bundle;
            renderExportResult();
          } catch (err) {
            app.showToast(err.message, 'error');
          }
        });
        renderExportResult();
      } else {
        pBody.innerHTML = `
          <div class="gm-enh-toolbar" style="margin-bottom:8px;">
            <input type="file" id="gmPatchFileInput" accept=".json,.patch,.diff,text/plain,application/json" style="font-size:12px;" />
            <button type="button" id="gmPatchInspectBtn" class="primary-btn">${esc(T('预检补丁 (git apply --check)', 'Inspect & Dry-Run'))}</button>
          </div>
          <textarea id="gmPatchRawInput" class="scm-commit-textarea" style="min-height:130px;font-family:var(--vscode-editor-font-family);" placeholder="${esc(T('在此粘贴 .gitmap-patch.json 补丁包或标准 Unified Diff (.patch) 内容…', 'Paste .gitmap-patch.json bundle or standard unified .patch diff here…'))}"></textarea>
          <div id="gmPatchInspectOut" style="margin-top:10px;"></div>
        `;

        const rawTa = pBody.querySelector('#gmPatchRawInput');
        const outEl = pBody.querySelector('#gmPatchInspectOut');
        pBody.querySelector('#gmPatchFileInput').addEventListener('change', async (ev) => {
          const f = ev.target.files && ev.target.files[0];
          if (!f) return;
          rawTa.value = await f.text();
          pBody.querySelector('#gmPatchInspectBtn').click();
        });

        pBody.querySelector('#gmPatchInspectBtn').addEventListener('click', async () => {
          const raw = rawTa.value.trim();
          if (!raw) {
            app.showToast(T('请先粘贴或选择补丁内容', 'Paste or select a patch first'), 'warning');
            return;
          }
          try {
            lastInspect = await app.rpc('patch:inspect', { repo, raw });
            const info = lastInspect;
            const meta = info.bundleMeta;
            outEl.innerHTML = `
              ${meta ? `
                <div class="gm-patch-meta-grid">
                  <div class="gm-patch-meta-item"><span>${esc(T('来源仓库 / 分支', 'Source Repo / Branch'))}</span><strong>${esc(meta.repoName || '—')} · ${esc(meta.branch || 'HEAD')}</strong></div>
                  <div class="gm-patch-meta-item"><span>${esc(T('基准提交', 'Base Commit'))}</span><code>${esc((meta.baseHash || '').slice(0, 10) || '—')}</code></div>
                  <div class="gm-patch-meta-item"><span>${esc(T('审阅备注', 'Review Note'))}</span><span>${esc(meta.note || '—')}</span></div>
                </div>
              ` : ''}
              <div class="gm-patch-check-banner ${info.cleanApply ? 'ok' : 'warn'}">
                ${info.cleanApply ? app.ICONS.check : app.ICONS.alert}
                <span>${esc(info.cleanApply
                  ? T(`预检通过：可直接干净应用到当前工作区（${info.stats.files} 个文件，+${info.stats.insertions} / −${info.stats.deletions}）`, `Dry-run passed: applies cleanly (${info.stats.files} files, +${info.stats.insertions} / -${info.stats.deletions})`)
                  : T(`直接应用存在上下文冲突：${info.checkError || ''}。可勾选 --3way 尝试三路合并应用。`, `Direct apply conflict: ${info.checkError || ''}. Enable --3way to attempt 3-way merge apply.`))}</span>
              </div>
              <div class="gm-composer-files" style="margin-bottom:10px;">
                ${(info.files || []).map((f) => `<span class="gm-composer-file-chip">${esc(f)}</span>`).join('')}
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
                <label class="inline-check"><input type="checkbox" id="gmPatchThreeWay" ${info.cleanApply ? '' : 'checked'} /> <span>${esc(T('启用 --3way 三路合并应用（冲突时保留合并标记）', 'Use --3way fallback merge'))}</span></label>
                <button type="button" id="gmPatchApplyBtn" class="mini-btn primary">${app.ICONS.check}<span>${esc(T('应用补丁到当前工作区', 'Apply Patch to Working Tree'))}</span></button>
              </div>
            `;
            outEl.querySelector('#gmPatchApplyBtn')?.addEventListener('click', async () => {
              const threeWay = !!outEl.querySelector('#gmPatchThreeWay')?.checked;
              try {
                const applied = await app.rpc('patch:apply', { repo, raw, threeWay });
                app.showToast(
                  T(`已应用补丁（影响 ${applied.appliedFiles.length} 个文件）`, `Applied patch (${applied.appliedFiles.length} file(s))`),
                  'info',
                  {
                    actionLabel: T('打开暂存与提交', 'Open SCM'),
                    onAction: () => app.openScmModal()
                  }
                );
                ui.close();
                window.GitMapFeatures?.refreshAllStatusesAndContext?.();
              } catch (err) {
                app.showToast(err.message, 'error');
              }
            });
          } catch (err) {
            outEl.innerHTML = `<div class="gm-patch-check-banner warn">${esc(err.message)}</div>`;
          }
        });
      }
    }

    render();
  }

  window.GitMapRemoteAndGitUI = {
    openSubmodulesLfsModal,
    openMultiRepoDashboardModal,
    openContentSearchModal,
    openFolderDiffModal,
    openCommitCompareModal,
    openCommitComposerModal,
    openPatchBundleModal,
    pollSshTelemetry
  };
})();
