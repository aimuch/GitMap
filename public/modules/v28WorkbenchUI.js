/* GitMap v2.8 Ported Workbench Modals, Launchpad Pill, SCM Explorer & Companion Router */
(function () {
  'use strict';

  const getApp = () => window.GitMapApp;
  const getFeat = () => window.GitMapFeatures;
  const T = (zh, en) => (getApp()?.state?.lang === 'en' ? en : zh);
  const esc = (s) => getApp() ? getApp().escapeHtml(s) : String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function activeRepoOrWarn() {
    const app = getApp();
    const repo = app?.state?.activeRepo;
    if (!repo) {
      app?.showToast(T('请先选择或打开一个 Git 仓库', 'Please select or open a Git repository first'), 'warning');
      return null;
    }
    return repo;
  }

  /* ── 1. PR Launchpad Status Pill & Triage Modal ── */
  let lastLaunchpadRefresh = 0;

  async function refreshLaunchpadPill(force) {
    const app = getApp();
    const pill = document.getElementById('btnLaunchpadPill');
    const countEl = document.getElementById('launchpadPillCounts');
    if (!app || !pill || !countEl) return;
    const repos = Object.keys(app.state.repos || {});
    if (repos.length === 0 || app.state.settings['git-map.pullRequests.enabled'] === false) {
      pill.classList.add('hidden');
      return;
    }
    if (!force && Date.now() - lastLaunchpadRefresh < 45000) return;
    lastLaunchpadRefresh = Date.now();
    try {
      const res = await app.rpc('launchpad:prs', { repos: app.state.activeRepo ? [app.state.activeRepo] : repos.slice(0, 4), force: !!force });
      const counts = res?.counts || { total: 0, mergeable: 0, blocked: 0, needsReview: 0, followUp: 0 };
      if (counts.total > 0) {
        pill.classList.remove('hidden');
        countEl.textContent = String(counts.total);
        pill.title = T(
          `PR 工作台：${counts.mergeable} 可合并 · ${counts.needsReview} 待评审 · ${counts.blocked} 阻塞 · ${counts.followUp} 待跟进`,
          `PR Launchpad: ${counts.mergeable} Mergeable · ${counts.needsReview} Review · ${counts.blocked} Blocked · ${counts.followUp} Follow-up`
        );
      } else {
        pill.classList.add('hidden');
      }
    } catch (_) {
      // Non-blocking background PR status check
    }
  }

  async function openHostingTokenDialog(opts) {
    const app = getApp();
    if (!app) return;
    const defaultHost = (opts && opts.host) || 'github.com';
    const host = await app.inputDialog(
      T('配置代码托管平台个人访问令牌 (PAT)', 'Configure Hosting Personal Access Token'),
      T('托管域名 (如 github.com / gitlab.com / 自建域名)', 'Hosting domain (e.g. github.com, gitlab.com, or self-hosted)'),
      defaultHost
    );
    if (!host || !host.trim()) return;
    if (opts && opts.clear) {
      await app.rpc('hosting:clearToken', { host: host.trim() });
      app.showToast(T(`已清除 ${host.trim()} 的令牌`, `Cleared token for ${host.trim()}`), 'info');
      void refreshLaunchpadPill(true);
      return;
    }
    const token = await app.inputDialog(
      T(`设置 ${host.trim()} 访问令牌`, `Set Access Token for ${host.trim()}`),
      T('输入 PAT 令牌（留空则清除已有令牌）', 'Paste Personal Access Token (leave empty to clear)'),
      ''
    );
    if (token === null || typeof token === 'undefined') return;
    if (token.trim() === '') {
      await app.rpc('hosting:clearToken', { host: host.trim() });
      app.showToast(T(`已清除 ${host.trim()} 的令牌`, `Cleared token for ${host.trim()}`), 'info');
    } else {
      await app.rpc('hosting:setToken', { host: host.trim(), token: token.trim() });
      app.showToast(T(`已安全保存 ${host.trim()} 令牌`, `Saved token for ${host.trim()}`), 'info');
    }
    app.refreshGraphView();
    void refreshLaunchpadPill(true);
  }

  async function openLaunchpadModal() {
    const app = getApp();
    const feat = getFeat();
    if (!app || !feat) return;
    const { bodyEl, isCurrent } = feat.openFeatureModal({
      title: T('🚀 PR Launchpad 聚合分诊台', '🚀 PR Launchpad & Triage'),
      sub: T('按可合并、待评审、CI/评审阻塞与待跟进自动归类所有打开的 PR / MR', 'Triage open Pull / Merge Requests across Mergeable, Needs Review, Blocked, and Follow-Up buckets'),
      badge: 'v2.8',
      wide: true
    });
    let activeBucket = 'all';

    const loadAndRender = async (force) => {
      bodyEl.innerHTML = `<div class="scm-empty"><span class="fb-spinner"></span> ${esc(T('正在同步托管平台 PR 状态…', 'Fetching Pull Request statuses…'))}</div>`;
      try {
        const res = await app.rpc('launchpad:prs', { force: !!force });
        if (!isCurrent()) return;
        const items = res.items || [];
        const counts = res.counts || { total: 0, mergeable: 0, needsReview: 0, blocked: 0, followUp: 0, other: 0 };
        const renderBucketView = () => {
          const shown = activeBucket === 'all' ? items : items.filter((i) => i.bucket === activeBucket);
          bodyEl.innerHTML = `
            <div class="gm-v28-toolbar">
              <div class="gm-v28-pills">
                ${[
                  ['all', T(`全部 (${counts.total})`, `All (${counts.total})`)],
                  ['mergeable', T(`✅ 可合并 (${counts.mergeable})`, `✅ Mergeable (${counts.mergeable})`)],
                  ['needsReview', T(`👀 待评审 (${counts.needsReview})`, `👀 Needs Review (${counts.needsReview})`)],
                  ['blocked', T(`⛔ 阻塞 (${counts.blocked})`, `⛔ Blocked (${counts.blocked})`)],
                  ['followUp', T(`💬 待跟进 (${counts.followUp})`, `💬 Follow-Up (${counts.followUp})`)]
                ].map(([id, lbl]) => `<button type="button" class="mini-btn ${activeBucket === id ? 'primary' : ''}" data-bucket="${id}">${esc(lbl)}</button>`).join('')}
              </div>
              <div class="gm-v28-pills">
                <button type="button" class="mini-btn act-lp-token">${esc(T('🔑 配置令牌', '🔑 Token'))}</button>
                <button type="button" class="mini-btn act-lp-create">${esc(T('➕ 新建 / 管理 PR', '➕ Manage PRs'))}</button>
                <button type="button" class="mini-btn act-lp-refresh">${esc(T('↻ 刷新', '↻ Refresh'))}</button>
              </div>
            </div>
            <div class="gm-v28-list">
              ${shown.length === 0 ? `<div class="scm-empty">${esc(T('当前分类下暂无打开的 Pull Request（如为私有仓库请先配置 PAT 令牌）', 'No open Pull Requests in this bucket (configure a PAT token for private repositories)'))}</div>` : shown.map((it, idx) => `
                <div class="gm-v28-card">
                  <div class="gm-v28-card-main">
                    <div class="gm-v28-card-title">
                      <span class="gm-badge ${it.bucket === 'mergeable' ? 'ok' : it.bucket === 'blocked' ? 'warn' : 'info'}">#${it.badge.number}</span>
                      <strong>${esc(it.badge.title)}</strong>
                      ${it.badge.stackSize > 1 ? `<span class="gm-badge info" title="Stacked PR">Stack ${it.badge.stackDepth}/${it.badge.stackSize}</span>` : ''}
                    </div>
                    <div class="gm-v28-card-meta">
                      <span>${esc(app.parseRepoDisplay(it.repo).name)}</span>
                      <span>· <code>${esc(it.branch)}</code> → <code>${esc(it.badge.baseBranch || 'main')}</code></span>
                      <span>· CI: ${esc(it.badge.ciStatus || 'unknown')}</span>
                      ${it.badge.author ? `<span>· @${esc(it.badge.author)}</span>` : ''}
                    </div>
                  </div>
                  <div class="gm-v28-card-actions">
                    <button type="button" class="mini-btn act-lp-checkout" data-idx="${idx}">${esc(T('检出到本地', 'Checkout'))}</button>
                    ${it.badge.url ? `<a class="mini-btn" href="${esc(it.badge.url)}" target="_blank" rel="noopener noreferrer">${esc(T('网页打开 ↗', 'Open ↗'))}</a>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          `;
          bodyEl.querySelectorAll('[data-bucket]').forEach((b) => b.addEventListener('click', () => {
            activeBucket = b.getAttribute('data-bucket');
            renderBucketView();
          }));
          bodyEl.querySelector('.act-lp-token')?.addEventListener('click', () => openHostingTokenDialog());
          bodyEl.querySelector('.act-lp-create')?.addEventListener('click', () => feat.openPullRequestsModal());
          bodyEl.querySelector('.act-lp-refresh')?.addEventListener('click', () => loadAndRender(true));
          bodyEl.querySelectorAll('.act-lp-checkout').forEach((btn) => {
            btn.addEventListener('click', async () => {
              const target = shown[Number(btn.getAttribute('data-idx'))];
              if (!target) return;
              btn.disabled = true;
              try {
                await app.rpc('hosting:checkoutPr', { repo: target.repo, number: target.badge.number });
                app.showToast(T(`已检出 PR #${target.badge.number}`, `Checked out PR #${target.badge.number}`), 'info');
                feat.refreshAllStatusesAndContext();
              } catch (err) {
                app.showToast(err.message, 'error');
                btn.disabled = false;
              }
            });
          });
        };
        renderBucketView();
      } catch (err) {
        if (isCurrent()) bodyEl.innerHTML = `<div class="scm-empty error-text">${esc(err.message)}</div>`;
      }
    };
    void loadAndRender(false);
  }

  /* ── 2. 11-Section Grouped SCM Explorer Modal ── */
  async function openScmGroupedExplorerModal() {
    const repo = activeRepoOrWarn();
    if (!repo) return;
    const app = getApp();
    const feat = getFeat();
    const { bodyEl, isCurrent } = feat.openFeatureModal({
      title: T('🧭 Git Map 全景源代码管理视图 (11 分组)', '🧭 Git Map Grouped SCM Explorer (11 Sections)'),
      sub: app.parseRepoDisplay(repo).fullDisplay,
      badge: 'SCM',
      wide: true
    });
    bodyEl.innerHTML = `<div class="scm-empty"><span class="fb-spinner"></span> ${esc(T('正在汇总 11 组仓库状态…', 'Loading 11 repository sections…'))}</div>`;
    try {
      const activeTab = (app.state.tabs || []).find((t) => t.id === app.state.activeTabId);
      const activeFilePath = activeTab?.meta?.filePath || undefined;
      const data = await app.rpc('scm:groupedView', { repo, activeFilePath });
      if (!isCurrent()) return;
      let q = '';
      const render = () => {
        const lower = q.trim().toLowerCase();
        bodyEl.innerHTML = `
          <div class="gm-v28-toolbar">
            <input type="text" class="gm-v28-search" placeholder="${esc(T('筛选更改、分支、贮藏、标签、工作树、贡献者或 PR…', 'Filter changes, branches, stashes, tags, worktrees, contributors, or PRs…'))}" value="${esc(q)}" />
          </div>
          <div class="gm-scm11-grid">
            ${(data.sections || []).map((sec) => {
              const items = lower
                ? (sec.items || []).filter((it) => `${it.label} ${it.description || ''}`.toLowerCase().includes(lower))
                : (sec.items || []);
              return `
                <details class="gm-scm11-sec" ${items.length > 0 && items.length <= 12 ? 'open' : (sec.id === 'changes' || sec.id === 'branches' ? 'open' : '')}>
                  <summary><strong>${esc(sec.title)}</strong> <span class="gm-badge">${items.length}</span></summary>
                  <div class="gm-scm11-items">
                    ${items.length === 0 ? `<div class="gm-scm11-empty">${esc(T('暂无条目', 'Empty'))}</div>` : items.slice(0, 60).map((it, i) => `
                      <button type="button" class="gm-scm11-row" data-sec="${esc(sec.id)}" data-idx="${i}">
                        <span class="gm-scm11-lbl">${esc(it.label)}</span>
                        <span class="gm-scm11-desc">${esc(it.description || '')}</span>
                      </button>
                    `).join('')}
                  </div>
                </details>
              `;
            }).join('')}
          </div>
        `;
        const searchEl = bodyEl.querySelector('.gm-v28-search');
        searchEl?.addEventListener('input', () => {
          q = searchEl.value;
          const pos = searchEl.selectionStart;
          render();
          const nextInput = bodyEl.querySelector('.gm-v28-search');
          if (nextInput) { nextInput.focus(); nextInput.setSelectionRange(pos, pos); }
        });
        bodyEl.querySelectorAll('.gm-scm11-row').forEach((row) => {
          row.addEventListener('click', async () => {
            const secId = row.getAttribute('data-sec');
            const sec = (data.sections || []).find((s) => s.id === secId);
            const items = q.trim()
              ? (sec?.items || []).filter((it) => `${it.label} ${it.description || ''}`.toLowerCase().includes(q.trim().toLowerCase()))
              : (sec?.items || []);
            const chosen = items[Number(row.getAttribute('data-idx'))];
            const act = chosen?.action;
            if (!act) return;
            document.getElementById('featureModal')?.classList.add('hidden');
            if (act.type === 'openDiff') {
              app.openDiffTab({ repo, fromHash: 'HEAD', toHash: '*', oldFilePath: act.path, newFilePath: act.path, type: 'M' });
            } else if (act.type === 'checkoutBranch') {
              await app.rpc('git:checkout', { repo, ref: act.branch });
              feat.refreshAllStatusesAndContext();
            } else if (act.type === 'viewCommit') {
              app.sendWs({ type: 'graph:request', payload: { command: 'commitDetails', repo, commitHash: act.hash, hasParents: true, stash: null, avatarEmail: null, refresh: false } });
              app.activateTab('graph');
            } else if (act.type === 'openWorktree') {
              feat.openWorktreesModal();
            } else if (act.type === 'switchRepo') {
              app.state.activeRepo = act.repo;
              app.renderSidebar();
              app.renderActiveRepoBadge();
              await app.rpc('repos:select', { repo: act.repo });
              feat.refreshRepoContext();
            } else if (act.type === 'openBranchDashboard') {
              openBranchDashboardModal();
            } else if (act.type === 'openInsights') {
              openRepoInsightsModal();
            } else if (act.type === 'openUrl' && act.url) {
              window.open(act.url, '_blank', 'noopener,noreferrer');
            } else {
              app.activateTab('graph');
            }
          });
        });
      };
      render();
    } catch (err) {
      if (isCurrent()) bodyEl.innerHTML = `<div class="scm-empty error-text">${esc(err.message)}</div>`;
    }
  }

  /* ── 3. Repository Insights, Churn Hotspots, Bus-Factor & Co-Change Clusters ── */
  async function openRepoInsightsModal() {
    const repo = activeRepoOrWarn();
    if (!repo) return;
    const app = getApp();
    const feat = getFeat();
    const { bodyEl, isCurrent } = feat.openFeatureModal({
      title: T('📈 仓库健康度、热点文件与协同变更聚类', '📈 Repository Insights, Hotspots & Co-Change Clusters'),
      sub: app.parseRepoDisplay(repo).fullDisplay,
      badge: 'Insights',
      wide: true
    });
    let days = 90;
    let tab = 'hotspots';

    const load = async () => {
      bodyEl.innerHTML = `<div class="scm-empty"><span class="fb-spinner"></span> ${esc(T('正在计算提交历史与协同修改图谱…', 'Analyzing commit churn, bus-factor silos, and co-change clusters…'))}</div>`;
      try {
        const res = await app.rpc('insights:compute', { repo, days });
        if (!isCurrent()) return;
        const ins = res.insights;
        const render = () => {
          const maxMonth = Math.max(1, ...(ins.monthlyCommits || []).map((m) => m.count));
          let maxHeat = 1;
          (ins.heatmap || []).forEach((r) => r.forEach((v) => { if (v > maxHeat) maxHeat = v; }));
          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

          bodyEl.innerHTML = `
            <div class="gm-v28-toolbar">
              <div class="gm-v28-pills">
                ${[
                  ['hotspots', T(`🔥 高频热点 (${ins.hotspots.length})`, `🔥 Hotspots (${ins.hotspots.length})`)],
                  ['silos', T(`⚠️ 知识孤岛 (${ins.knowledgeSilos.length})`, `⚠️ Bus-Factor Silos (${ins.knowledgeSilos.length})`)],
                  ['cochange', T(`🔗 协同变更对 (${ins.coChangeClusters.length})`, `🔗 Co-Change (${ins.coChangeClusters.length})`)],
                  ['activity', T('🕒 时段热力与贡献者', '🕒 Activity & Contributors')]
                ].map(([id, lbl]) => `<button type="button" class="mini-btn ${tab === id ? 'primary' : ''}" data-tab="${id}">${esc(lbl)}</button>`).join('')}
              </div>
              <div class="gm-v28-pills">
                ${[[30, '30d'], [90, '90d'], [180, '180d'], [365, '1y'], [0, T('全部', 'All')]].map(([d, lbl]) => `<button type="button" class="mini-btn ${days === d ? 'primary' : ''}" data-days="${d}">${esc(lbl)}</button>`).join('')}
              </div>
            </div>
            <div class="gm-v28-kpi-row">
              <div class="gm-v28-kpi"><span>${esc(T('统计提交数', 'Commits'))}</span><strong>${ins.totalCommits}</strong></div>
              <div class="gm-v28-kpi"><span>${esc(T('活跃作者', 'Contributors'))}</span><strong>${ins.totalAuthors}</strong></div>
              <div class="gm-v28-kpi"><span>${esc(T('知识孤岛风险文件', 'Knowledge Silos'))}</span><strong>${ins.knowledgeSilos.length}</strong></div>
              <div class="gm-v28-kpi"><span>${esc(T('高频耦合文件对', 'Co-Change Pairs'))}</span><strong>${ins.coChangeClusters.length}</strong></div>
            </div>
            ${tab === 'hotspots' || tab === 'silos' ? `
              <div class="gm-v28-list">
                ${(tab === 'hotspots' ? ins.hotspots : ins.knowledgeSilos).length === 0 ? `<div class="scm-empty">${esc(T('当前时间窗口内暂无数据', 'No files matched in this time window'))}</div>` : (tab === 'hotspots' ? ins.hotspots : ins.knowledgeSilos).map((f) => `
                  <div class="gm-v28-card">
                    <div class="gm-v28-card-main">
                      <div class="gm-v28-card-title"><code>${esc(f.path)}</code></div>
                      <div class="gm-v28-card-meta">
                        <span>${f.commits} commits</span>
                        <span class="diff-stat-add">+${f.additions}</span>
                        <span class="diff-stat-del">-${f.deletions}</span>
                        <span>· ${f.authors} ${esc(T('位作者', 'authors'))}</span>
                        <span>· ${esc(T('主作者', 'Top'))}: ${esc(f.topAuthor)} (${f.topAuthorShare}%)</span>
                      </div>
                    </div>
                    <div class="gm-v28-card-actions">
                      <button type="button" class="mini-btn act-ins-hist" data-path="${esc(f.path)}">${esc(T('文件历史', 'History'))}</button>
                      <button type="button" class="mini-btn act-ins-open" data-path="${esc(f.path)}">${esc(T('打开文件', 'Open'))}</button>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : tab === 'cochange' ? `
              <div class="gm-v28-list">
                ${ins.coChangeClusters.length === 0 ? `<div class="scm-empty">${esc(T('未检测到高频共同修改的文件对', 'No strongly coupled co-change file pairs detected'))}</div>` : ins.coChangeClusters.map((c) => `
                  <div class="gm-v28-card">
                    <div class="gm-v28-card-main">
                      <div class="gm-v28-card-title"><code>${esc(c.fileA)}</code> <span>↔</span> <code>${esc(c.fileB)}</code></div>
                      <div class="gm-v28-card-meta">
                        <span>${esc(T(`共同提交 ${c.coCommits} 次`, `${c.coCommits} shared commits`))}</span>
                        <span>· ${esc(T(`耦合度 ${c.couplingPct}%`, `${c.couplingPct}% coupling`))}</span>
                      </div>
                    </div>
                    <div class="gm-v28-card-actions">
                      <button type="button" class="mini-btn act-ins-open" data-path="${esc(c.fileA)}">${esc(T('查看 A', 'Open A'))}</button>
                      <button type="button" class="mini-btn act-ins-open" data-path="${esc(c.fileB)}">${esc(T('查看 B', 'Open B'))}</button>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : `
              <div class="gm-v28-section-title">${esc(T('月度提交趋势', 'Monthly Commit Trend'))}</div>
              <div class="gm-bar-chart">
                ${(ins.monthlyCommits || []).map((m) => `
                  <div class="gm-bar-col" title="${esc(m.month)}: ${m.count} commits">
                    <div class="gm-bar-fill" style="height:${Math.max(6, Math.round((m.count / maxMonth) * 76))}px"></div>
                    <span>${esc(m.month.slice(5))}</span>
                  </div>
                `).join('')}
              </div>
              <div class="gm-v28-section-title">${esc(T('7 × 24 小时提交活跃热力图', '7 × 24 Hour Activity Heatmap'))}</div>
              <div class="gm-hm-7x24">
                ${(ins.heatmap || []).map((row, dIdx) => `
                  <div class="gm-hm-row">
                    <span class="gm-hm-day">${dayNames[dIdx]}</span>
                    ${row.map((cnt, hIdx) => {
                      const alpha = cnt === 0 ? 0.05 : Math.min(0.95, 0.18 + (cnt / maxHeat) * 0.77);
                      return `<span class="gm-hm-cell" style="background:rgba(56,189,248,${alpha.toFixed(2)})" title="${dayNames[dIdx]} ${hIdx}:00 — ${cnt} commits"></span>`;
                    }).join('')}
                  </div>
                `).join('')}
              </div>
              <div class="gm-v28-section-title">${esc(T('核心贡献者', 'Top Contributors'))}</div>
              <div class="gm-v28-list">
                ${(ins.contributors || []).map((c) => `
                  <div class="gm-v28-card">
                    <div class="gm-v28-card-main">
                      <div class="gm-v28-card-title"><strong>${esc(c.author)}</strong> <span class="gm-v28-muted">&lt;${esc(c.email)}&gt;</span></div>
                      <div class="gm-v28-card-meta">
                        <span>${c.commits} commits</span>
                        <span class="diff-stat-add">+${c.additions}</span>
                        <span class="diff-stat-del">-${c.deletions}</span>
                        <span>· ${c.activeDays} ${esc(T('活跃天', 'active days'))}</span>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          `;
          bodyEl.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.getAttribute('data-tab'); render(); }));
          bodyEl.querySelectorAll('[data-days]').forEach((b) => b.addEventListener('click', () => { days = Number(b.getAttribute('data-days')); void load(); }));
          bodyEl.querySelectorAll('.act-ins-hist').forEach((b) => b.addEventListener('click', async () => {
            const p = b.getAttribute('data-path');
            document.getElementById('featureModal')?.classList.add('hidden');
            await app.rpc('file:viewHistoryInGraph', { repo, filePath: p });
            app.activateTab('graph');
          }));
          bodyEl.querySelectorAll('.act-ins-open').forEach((b) => b.addEventListener('click', () => {
            const p = b.getAttribute('data-path');
            document.getElementById('featureModal')?.classList.add('hidden');
            app.openFileTab({ repo, filePath: p });
          }));
        };
        render();
      } catch (err) {
        if (isCurrent()) bodyEl.innerHTML = `<div class="scm-empty error-text">${esc(err.message)}</div>`;
      }
    };
    void load();
  }

  /* ── 4. Branch Lifecycle Dashboard Modal ── */
  async function openBranchDashboardModal() {
    const repo = activeRepoOrWarn();
    if (!repo) return;
    const app = getApp();
    const feat = getFeat();
    const { bodyEl, isCurrent } = feat.openFeatureModal({
      title: T('🌿 分支生命周期治理仪表盘', '🌿 Branch Lifecycle Dashboard'),
      sub: app.parseRepoDisplay(repo).fullDisplay,
      badge: 'Branches',
      wide: true
    });
    let filter = 'all';
    let q = '';
    const selected = new Set();

    const load = async () => {
      bodyEl.innerHTML = `<div class="scm-empty"><span class="fb-spinner"></span> ${esc(T('正在扫描全部分支与合并/PR 状态…', 'Scanning local & remote branches…'))}</div>`;
      try {
        const res = await app.rpc('branches:lifecycle', { repo });
        if (!isCurrent()) return;
        const rows = res.rows || [];
        const defaultBranch = res.defaultBranch || 'main';
        const isProtected = (r) => r.isCurrent || r.name === defaultBranch || ['main', 'master', 'develop', 'origin/main', 'origin/master'].includes(r.name);

        const render = () => {
          const shown = rows.filter((r) => {
            if (filter === 'merged' && !r.merged) return false;
            if (filter === 'stale' && !r.stale) return false;
            if (filter === 'local' && r.isRemote) return false;
            if (filter === 'remote' && !r.isRemote) return false;
            if (q.trim() && !`${r.name} ${r.author} ${r.subject}`.toLowerCase().includes(q.trim().toLowerCase())) return false;
            return true;
          });
          bodyEl.innerHTML = `
            <div class="gm-v28-toolbar">
              <div class="gm-v28-pills">
                ${[
                  ['all', T(`全部 (${rows.length})`, `All (${rows.length})`)],
                  ['merged', T(`已合并 (${rows.filter((r) => r.merged).length})`, `Merged (${rows.filter((r) => r.merged).length})`)],
                  ['stale', T(`陈旧 ≥30天 (${rows.filter((r) => r.stale).length})`, `Stale ≥30d (${rows.filter((r) => r.stale).length})`)],
                  ['local', T('本地分支', 'Local')],
                  ['remote', T('远程分支', 'Remote')]
                ].map(([id, lbl]) => `<button type="button" class="mini-btn ${filter === id ? 'primary' : ''}" data-filter="${id}">${esc(lbl)}</button>`).join('')}
              </div>
              <div class="gm-v28-pills">
                <button type="button" class="mini-btn act-br-sel-merged">${esc(T('勾选已合并本地分支', 'Select Merged Local'))}</button>
                <button type="button" class="mini-btn danger act-br-del-batch" ${selected.size === 0 ? 'disabled' : ''}>${esc(T(`批量清理 (${selected.size})`, `Delete Selected (${selected.size})`))}</button>
              </div>
            </div>
            <input type="text" class="gm-v28-search" style="margin-bottom:8px" placeholder="${esc(T('按分支名、作者或提交说明搜索…', 'Search branch name, author, or commit subject…'))}" value="${esc(q)}" />
            <div class="gm-v28-list">
              ${shown.map((r) => {
                const prot = isProtected(r);
                const key = (r.isRemote ? 'R:' : 'L:') + r.name;
                return `
                  <div class="gm-v28-card">
                    <div class="gm-v28-card-main" style="display:flex;align-items:center;gap:10px">
                      <input type="checkbox" class="act-br-chk" data-key="${esc(key)}" ${selected.has(key) ? 'checked' : ''} ${prot ? 'disabled' : ''} />
                      <div>
                        <div class="gm-v28-card-title">
                          <code>${esc(r.name)}</code>
                          ${r.isCurrent ? `<span class="gm-badge ok">HEAD</span>` : ''}
                          ${r.merged && !prot ? `<span class="gm-badge info">${esc(T('已合并', 'Merged'))}</span>` : ''}
                          ${r.stale ? `<span class="gm-badge warn">${r.ageDays}d</span>` : `<span class="gm-v28-muted">${r.ageDays}d</span>`}
                          ${r.prNumber ? `<span class="gm-badge info">PR #${r.prNumber}</span>` : ''}
                        </div>
                        <div class="gm-v28-card-meta">${esc(r.author)} · ${esc(r.subject)}</div>
                      </div>
                    </div>
                    <div class="gm-v28-card-actions">
                      ${!r.isCurrent ? `<button type="button" class="mini-btn act-br-co" data-name="${esc(r.name)}">${esc(T('检出', 'Checkout'))}</button>` : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `;
          bodyEl.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => { filter = b.getAttribute('data-filter'); render(); }));
          const sInput = bodyEl.querySelector('.gm-v28-search');
          sInput?.addEventListener('input', () => { q = sInput.value; const p = sInput.selectionStart; render(); const ni = bodyEl.querySelector('.gm-v28-search'); if (ni) { ni.focus(); ni.setSelectionRange(p, p); } });
          bodyEl.querySelectorAll('.act-br-chk').forEach((chk) => chk.addEventListener('change', () => {
            const k = chk.getAttribute('data-key');
            if (chk.checked) selected.add(k); else selected.delete(k);
            render();
          }));
          bodyEl.querySelector('.act-br-sel-merged')?.addEventListener('click', () => {
            rows.forEach((r) => {
              if (!r.isRemote && r.merged && !isProtected(r)) selected.add('L:' + r.name);
            });
            render();
          });
          bodyEl.querySelector('.act-br-del-batch')?.addEventListener('click', async () => {
            if (selected.size === 0) return;
            const list = Array.from(selected).map((k) => ({ isRemote: k.startsWith('R:'), name: k.slice(2) }));
            const ok = await app.confirmDialog(
              T('批量清理分支', 'Delete Selected Branches'),
              T(`确定要删除选中的 ${list.length} 个分支吗？`, `Delete ${list.length} selected branches?`),
              T('确认删除', 'Delete'),
              true
            );
            if (!ok) return;
            const delRes = await app.rpc('branches:deleteBatch', { repo, branches: list, force: false });
            selected.clear();
            app.showToast(T(`已清理 ${delRes.deleted.length} 个分支`, `Deleted ${delRes.deleted.length} branches`), delRes.errors.length ? 'warning' : 'info');
            feat.refreshAllStatusesAndContext();
            void load();
          });
          bodyEl.querySelectorAll('.act-br-co').forEach((btn) => btn.addEventListener('click', async () => {
            const name = btn.getAttribute('data-name');
            try {
              await app.rpc('git:checkout', { repo, ref: name });
              app.showToast(T(`已切换到 ${name}`, `Checked out ${name}`), 'info');
              feat.refreshAllStatusesAndContext();
              void load();
            } catch (err) {
              app.showToast(err.message, 'error');
            }
          }));
        };
        render();
      } catch (err) {
        if (isCurrent()) bodyEl.innerHTML = `<div class="scm-empty error-text">${esc(err.message)}</div>`;
      }
    };
    void load();
  }

  /* ── 5. Pre-Commit Guard (0-100 Safety Score) & Smart Commit Split ── */
  async function openPreCommitGuardModal(opts) {
    const repo = activeRepoOrWarn();
    if (!repo) return;
    const app = getApp();
    const feat = getFeat();
    const { bodyEl, isCurrent } = feat.openFeatureModal({
      title: T('🛡️ 提交前安全守卫与智能拆分 (Pre-Commit Guard)', '🛡️ Pre-Commit Safety Guard & Smart Split'),
      sub: app.parseRepoDisplay(repo).fullDisplay,
      badge: 'Guard',
      wide: true
    });
    let mode = opts?.tab === 'split' ? 'split' : 'guard';

    const renderGuard = async () => {
      bodyEl.innerHTML = `<div class="scm-empty"><span class="fb-spinner"></span> ${esc(T('正在扫描工作区与暂存区改动安全性…', 'Scanning uncommitted changes for secrets, debug statements, and blast radius…'))}</div>`;
      try {
        if (mode === 'split') {
          const splitRes = await app.rpc('ai:composeCommits', { repo, language: app.state.lang === 'en' ? 'en' : 'zh', style: 'conventional' });
          if (!isCurrent()) return;
          const drafts = splitRes.drafts || [];
          bodyEl.innerHTML = `
            <div class="gm-v28-toolbar">
              <div class="gm-v28-pills">
                <button type="button" class="mini-btn" data-m="guard">${esc(T('🛡️ 安全健康评分', '🛡️ Safety Score'))}</button>
                <button type="button" class="mini-btn primary" data-m="split">${esc(T('✂️ AI 智能拆分为原子提交', '✂️ AI Smart Commit Split'))}</button>
              </div>
              <button type="button" class="mini-btn primary act-open-scm">${esc(T('打开暂存与提交面板', 'Open Stage & Commit'))}</button>
            </div>
            <div class="gm-v28-list">
              ${drafts.length === 0 ? `<div class="scm-empty">${esc(T('当前工作区没有可拆分的改动文件', 'No uncommitted changes to split'))}</div>` : drafts.map((d, idx) => `
                <div class="gm-v28-card">
                  <div class="gm-v28-card-main">
                    <div class="gm-v28-card-title"><strong>${esc(d.message)}</strong></div>
                    <div class="gm-v28-card-meta">${esc(d.rationale || '')} · ${d.files.map((f) => `<code>${esc(f)}</code>`).join(' ')}</div>
                  </div>
                  <div class="gm-v28-card-actions">
                    <button type="button" class="mini-btn primary act-exec-draft" data-idx="${idx}">${esc(T('暂存并提交此组', 'Stage & Commit Group'))}</button>
                  </div>
                </div>
              `).join('')}
            </div>
          `;
          bodyEl.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => { mode = b.getAttribute('data-m'); void renderGuard(); }));
          bodyEl.querySelector('.act-open-scm')?.addEventListener('click', () => { document.getElementById('featureModal')?.classList.add('hidden'); app.openScmModal(); });
          bodyEl.querySelectorAll('.act-exec-draft').forEach((btn) => btn.addEventListener('click', async () => {
            const d = drafts[Number(btn.getAttribute('data-idx'))];
            if (!d) return;
            btn.disabled = true;
            try {
              await app.rpc('scm:unstage', { repo, all: true }).catch(() => {});
              await app.rpc('scm:stage', { repo, paths: d.files });
              await app.rpc('scm:commit', { repo, message: d.message });
              app.showToast(T(`已提交：${d.message}`, `Committed: ${d.message}`), 'info');
              feat.refreshAllStatusesAndContext();
              void renderGuard();
            } catch (err) {
              app.showToast(err.message, 'error');
              btn.disabled = false;
            }
          }));
          return;
        }

        const res = await app.rpc('guard:scan', { repo });
        if (!isCurrent()) return;
        const rep = res.riskReport || { score: 100, level: 'safe', evidence: [] };
        const issues = res.issues || [];
        const tone = rep.score >= 80 ? 'ok' : rep.score >= 50 ? 'warn' : 'danger';

        bodyEl.innerHTML = `
          <div class="gm-v28-toolbar">
            <div class="gm-v28-pills">
              <button type="button" class="mini-btn primary" data-m="guard">${esc(T('🛡️ 安全健康评分', '🛡️ Safety Score'))}</button>
              <button type="button" class="mini-btn" data-m="split">${esc(T('✂️ AI 智能拆分为原子提交', '✂️ AI Smart Commit Split'))}</button>
            </div>
            <button type="button" class="mini-btn act-rescan">${esc(T('↻ 重新扫描', '↻ Re-scan'))}</button>
          </div>
          <div class="gm-score-banner ${tone}">
            <div class="gm-score-num">${rep.score}<span>/100</span></div>
            <div>
              <strong>${esc(rep.score >= 80 ? T('当前改动可安全提交', 'Changes look safe to commit') : rep.score >= 50 ? T('发现中等风险项，建议核查后再提交', 'Caution advised before committing') : T('高风险告警：检测到疑似密钥或重大隐患！', 'High risk detected: review findings before committing!'))}</strong>
              <div class="gm-v28-card-meta">${res.fileCount} ${esc(T('个变更文件', 'changed files'))} · ${res.changedLines} ${esc(T('行改动', 'changed lines'))} · ${issues.length} ${esc(T('项发现', 'findings'))}</div>
            </div>
          </div>
          <div class="gm-v28-list">
            ${issues.length === 0 && (!rep.evidence || rep.evidence.length === 0) ? `<div class="scm-empty">${esc(T('🎉 未检测到硬编码密钥、调试残留或 DO NOT COMMIT 标记', '🎉 No leaked secrets, debug statements, or DO NOT COMMIT markers found'))}</div>` : issues.map((iss) => `
              <div class="gm-v28-card">
                <div class="gm-v28-card-main">
                  <div class="gm-v28-card-title">
                    <span class="gm-badge ${iss.severity === 'high' ? 'danger' : iss.severity === 'medium' ? 'warn' : 'info'}">${esc(iss.severity.toUpperCase())}</span>
                    <strong>${esc(iss.message)}</strong>
                    <code>${esc(iss.file)}:${iss.line}</code>
                  </div>
                  <div class="gm-v28-card-meta"><code>${esc(iss.snippet)}</code></div>
                </div>
                <div class="gm-v28-card-actions">
                  <button type="button" class="mini-btn act-guard-open" data-file="${esc(iss.file)}" data-line="${iss.line}">${esc(T('定位行', 'Locate'))}</button>
                </div>
              </div>
            `).join('')}
          </div>
        `;
        bodyEl.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => { mode = b.getAttribute('data-m'); void renderGuard(); }));
        bodyEl.querySelector('.act-rescan')?.addEventListener('click', () => void renderGuard());
        bodyEl.querySelectorAll('.act-guard-open').forEach((btn) => btn.addEventListener('click', () => {
          const f = btn.getAttribute('data-file');
          const ln = Number(btn.getAttribute('data-line')) || 1;
          document.getElementById('featureModal')?.classList.add('hidden');
          app.openFileTab({ repo, filePath: f, lines: { start: ln, end: ln } });
        }));
      } catch (err) {
        if (isCurrent()) bodyEl.innerHTML = `<div class="scm-empty error-text">${esc(err.message)}</div>`;
      }
    };
    void renderGuard();
  }

  /* ── 6. Start Work from Issue / Ticket Modal ── */
  async function openStartWorkModal(args) {
    const repo = activeRepoOrWarn();
    if (!repo) return;
    const app = getApp();
    const feat = getFeat();
    const { bodyEl } = feat.openFeatureModal({
      title: T('🚀 从任务单创建工作分支 (Start Work)', '🚀 Start Work from Issue / Ticket'),
      sub: app.parseRepoDisplay(repo).fullDisplay,
      badge: 'Workflow'
    });
    const initPreview = await app.rpc('work:previewBranch', { repo, id: args?.id || 'PROJ-123', title: args?.title || 'feat description' }).catch(() => ({ branchName: 'feature/proj-123-feat-description', template: 'feature/${id}-${title}' }));
    bodyEl.innerHTML = `
      <div class="gm-v28-form">
        <label>${esc(T('任务单号 / Issue ID', 'Issue / Ticket ID'))}<input type="text" id="swIssueId" value="${esc(args?.id || '')}" placeholder="PROJ-123 / #42" /></label>
        <label>${esc(T('简短描述 (自动转为分支 Slug)', 'Short Title (slugified automatically)'))}<input type="text" id="swIssueTitle" value="${esc(args?.title || '')}" placeholder="support oauth2 pkce login" /></label>
        <label>${esc(T('分支命名模板 (git-map.startWork.branchNameFormat)', 'Branch Template'))}<input type="text" id="swTemplate" value="${esc(initPreview.template)}" /></label>
        <label>${esc(T('基线提交或分支', 'Base Branch / Commit'))}<input type="text" id="swBase" value="${esc(args?.baseCommit || 'HEAD')}" /></label>
        <label>${esc(T('最终分支名预览（可手动微调）', 'Final Branch Name'))}<input type="text" id="swFinalBranch" value="${esc(args?.id ? initPreview.branchName : '')}" /></label>
        <div class="gm-v28-form-footer">
          <button type="button" class="mini-btn primary" id="swSubmitBtn">${esc(T('创建并检出分支', 'Create & Checkout Branch'))}</button>
        </div>
      </div>
    `;
    const idEl = bodyEl.querySelector('#swIssueId');
    const titleEl = bodyEl.querySelector('#swIssueTitle');
    const tplEl = bodyEl.querySelector('#swTemplate');
    const baseEl = bodyEl.querySelector('#swBase');
    const finalEl = bodyEl.querySelector('#swFinalBranch');
    let userEditedFinal = false;
    finalEl.addEventListener('input', () => { userEditedFinal = true; });
    const syncPreview = async () => {
      if (userEditedFinal) return;
      try {
        const p = await app.rpc('work:previewBranch', { repo, id: idEl.value, title: titleEl.value, template: tplEl.value });
        finalEl.value = p.branchName;
      } catch (_) {}
    };
    idEl.addEventListener('input', syncPreview);
    titleEl.addEventListener('input', syncPreview);
    tplEl.addEventListener('input', syncPreview);
    bodyEl.querySelector('#swSubmitBtn').addEventListener('click', async () => {
      const branchName = finalEl.value.trim();
      if (!branchName) {
        app.showToast(T('请输入任务单号或分支名称', 'Branch name is required'), 'warning');
        return;
      }
      try {
        const res = await app.rpc('work:start', { repo, branchName, baseCommit: baseEl.value.trim() || 'HEAD', template: tplEl.value.trim() });
        document.getElementById('featureModal')?.classList.add('hidden');
        app.showToast(T(`已创建并检出分支 ${res.branchName}`, `Created & checked out ${res.branchName}`), 'info');
        feat.refreshAllStatusesAndContext();
      } catch (err) {
        app.showToast(err.message, 'error');
      }
    });
    setTimeout(() => idEl.focus(), 20);
  }

  /* ── 7. AI Auto-Rebase Modal (with Confidence Gate & 1-Click Undo) ── */
  async function openAiAutoRebaseModal(args) {
    const repo = activeRepoOrWarn();
    if (!repo) return;
    const app = getApp();
    const feat = getFeat();
    const { bodyEl, isCurrent } = feat.openFeatureModal({
      title: T('🤖 AI 自动变基与冲突解算 (AI Auto-Rebase)', '🤖 AI Auto-Rebase with Confidence Gate'),
      sub: app.parseRepoDisplay(repo).fullDisplay,
      badge: 'AI Rebase'
    });
    const [refsRes, undoRes] = await Promise.all([
      app.rpc('git:refs', { repo }).catch(() => ({ branches: ['main'] })),
      app.rpc('rebase:canUndoAi', { repo }).catch(() => ({ canUndo: false }))
    ]);
    if (!isCurrent()) return;
    const defaultTarget = args?.targetRef || (refsRes.branches || []).find((b) => ['origin/main', 'main', 'origin/master', 'master'].includes(b)) || 'main';
    const initThresh = Number(app.state.settings['git-map.ai.autoRebaseConfidenceThreshold'] ?? 0.75);

    bodyEl.innerHTML = `
      <div class="gm-v28-form">
        <label>${esc(T('变基目标分支 / 引用 (Onto Ref)', 'Target Branch / Ref'))}
          <input type="text" id="arTargetRef" list="arBranchList" value="${esc(defaultTarget)}" />
          <datalist id="arBranchList">${(refsRes.branches || []).map((b) => `<option value="${esc(b)}"></option>`).join('')}</datalist>
        </label>
        <label>${esc(T('自动放行最低置信度阈值 (低于此阈值自动暂停交由人工复核)', 'Auto-Apply Confidence Threshold (pauses below threshold)'))}: <strong id="arThreshVal">${initThresh.toFixed(2)}</strong>
          <input type="range" id="arThreshold" min="0.25" max="0.95" step="0.05" value="${initThresh}" />
        </label>
        <div class="gm-v28-pills" style="margin-top:8px">
          <button type="button" class="mini-btn primary" id="arStartBtn">${esc(T('▶ 启动 AI 自动变基', '▶ Start AI Auto-Rebase'))}</button>
          <button type="button" class="mini-btn" id="arContinueBtn">${esc(T('⏯ 继续暂停的 AI 变基', '⏯ Continue Paused Rebase'))}</button>
          <button type="button" class="mini-btn danger" id="arUndoBtn" ${undoRes.canUndo ? '' : 'disabled'}>${esc(T('↩ 一键回滚变基前快照', '↩ Undo Auto-Rebase Snapshot'))}</button>
        </div>
        <div id="arStatusBox" class="gm-v28-status-box"></div>
      </div>
    `;
    const threshEl = bodyEl.querySelector('#arThreshold');
    const threshVal = bodyEl.querySelector('#arThreshVal');
    const statusBox = bodyEl.querySelector('#arStatusBox');
    const undoBtn = bodyEl.querySelector('#arUndoBtn');
    threshEl.addEventListener('input', () => { threshVal.textContent = Number(threshEl.value).toFixed(2); });

    const runAction = async (rpcName, payload) => {
      statusBox.innerHTML = `<span class="fb-spinner"></span> ${esc(T('AI 正在执行变基与冲突分析…', 'Running AI Auto-Rebase…'))}`;
      try {
        const r = await app.rpc(rpcName, payload);
        undoBtn.disabled = !r.canUndo;
        statusBox.innerHTML = `<div class="gm-badge ${r.status === 'completed' || r.ok ? 'ok' : r.status === 'paused' ? 'warn' : 'danger'}">${esc(r.status || (r.ok ? 'undone' : 'error'))}</div> <p>${esc(r.message || '')}</p>${r.status === 'paused' ? `<button type="button" class="mini-btn primary act-ar-open-conflict">${esc(T('打开三栏冲突解决器', 'Open Conflict Resolver'))}</button>` : ''}`;
        statusBox.querySelector('.act-ar-open-conflict')?.addEventListener('click', () => {
          document.getElementById('featureModal')?.classList.add('hidden');
          feat.openConflictResolverTab();
        });
        feat.refreshAllStatusesAndContext();
      } catch (err) {
        statusBox.innerHTML = `<div class="error-text">${esc(err.message)}</div>`;
      }
    };
    bodyEl.querySelector('#arStartBtn').addEventListener('click', () => runAction('rebase:autoAi', { repo, targetRef: bodyEl.querySelector('#arTargetRef').value.trim(), threshold: Number(threshEl.value) }));
    bodyEl.querySelector('#arContinueBtn').addEventListener('click', () => runAction('rebase:continueAi', { repo, threshold: Number(threshEl.value) }));
    undoBtn.addEventListener('click', () => runAction('rebase:undoAi', { repo }));
  }

  /* ── 8. AI Regression Root-Cause Analysis Modal ── */
  async function openAiExplainRegressionModal(initialHash) {
    const repo = activeRepoOrWarn();
    if (!repo) return;
    const app = getApp();
    const feat = getFeat();
    const { bodyEl, isCurrent } = feat.openFeatureModal({
      title: T('🔬 AI 回归缺陷根因定位 (Explain Regression)', '🔬 AI Regression Root-Cause Analysis'),
      sub: app.parseRepoDisplay(repo).fullDisplay,
      badge: 'AI Debug',
      wide: true
    });
    bodyEl.innerHTML = `
      <div class="gm-v28-toolbar">
        <input type="text" id="regCommitInput" class="gm-v28-search" style="max-width:340px" value="${esc(initialHash || 'HEAD')}" placeholder="${esc(T('输入可疑提交哈希或引用 (如 Bisect 定位到的 SHA)', 'Suspect commit SHA or ref'))}" />
        <button type="button" class="mini-btn primary" id="regAnalyzeBtn">${esc(T('分析回归根因', 'Analyze Root Cause'))}</button>
      </div>
      <div id="regResultHost" class="gm-v28-md-host"></div>
    `;
    const input = bodyEl.querySelector('#regCommitInput');
    const host = bodyEl.querySelector('#regResultHost');
    const analyze = async () => {
      const commitHash = input.value.trim() || 'HEAD';
      host.innerHTML = `<div class="scm-empty"><span class="fb-spinner"></span> ${esc(T(`正在深度分析提交 ${commitHash}…`, `Analyzing commit ${commitHash}…`))}</div>`;
      try {
        const res = await app.rpc('ai:explainRegression', { repo, commitHash, lang: app.state.lang === 'en' ? 'en' : 'zh' });
        if (!isCurrent()) return;
        host.innerHTML = window.GitMapEditorPreview?.renderMarkdownHtml
          ? `<div class="gm-md-body">${window.GitMapEditorPreview.renderMarkdownHtml(res.markdown)}</div>`
          : `<pre class="gm-rebase-raw-pre">${esc(res.markdown)}</pre>`;
      } catch (err) {
        if (isCurrent()) host.innerHTML = `<div class="scm-empty error-text">${esc(err.message)}</div>`;
      }
    };
    bodyEl.querySelector('#regAnalyzeBtn').addEventListener('click', analyze);
    if (initialHash) void analyze();
  }

  /* ── 9. Repository Health, Maintenance & SSH allowed_signers Modal ── */
  async function openRepoMaintenanceModal(opts) {
    const repo = activeRepoOrWarn();
    if (!repo) return;
    const app = getApp();
    const feat = getFeat();
    const { bodyEl, isCurrent } = feat.openFeatureModal({
      title: T('🩺 仓库健康体检、Commit-Graph 加速与 SSH 签名验签', '🩺 Repository Health, Maintenance & SSH Signers'),
      sub: app.parseRepoDisplay(repo).fullDisplay,
      badge: 'Health'
    });

    const openSignersFile = async () => {
      const res = await app.rpc('maintenance:ensureSigners', { repo });
      if (res.error || !res.filePath) {
        app.showToast(res.error || 'Unable to prepare allowed_signers', 'error');
        return;
      }
      document.getElementById('featureModal')?.classList.add('hidden');
      const isSsh = repo.startsWith('ssh://');
      const hostId = isSsh ? repo.slice(6).split('/')[0] : '';
      app.openFileTab({
        repo: '',
        filePath: isSsh ? `ssh://${hostId}${res.filePath}` : res.filePath,
        title: 'allowed_signers',
        startEditing: true
      });
    };

    if (opts?.autoOpenSigners) {
      await openSignersFile();
      return;
    }

    const renderHealth = async () => {
      bodyEl.innerHTML = `<div class="scm-empty"><span class="fb-spinner"></span> ${esc(T('正在检查仓库对象库与索引状态…', 'Inspecting repository objects and commit-graph…'))}</div>`;
      try {
        const { report } = await app.rpc('maintenance:inspect', { repo });
        if (!isCurrent()) return;
        bodyEl.innerHTML = `
          <div class="gm-v28-kpi-row">
            <div class="gm-v28-kpi"><span>commit-graph</span><strong>${report.hasCommitGraph && report.coreCommitGraphEnabled ? '✅ Enabled' : '⚠️ Off'}</strong></div>
            <div class="gm-v28-kpi"><span>${esc(T('松散对象数', 'Loose Objects'))}</span><strong>${report.looseObjects}</strong></div>
            <div class="gm-v28-kpi"><span>${esc(T('松散体积', 'Loose Size'))}</span><strong>${report.sizeKb} KB</strong></div>
            <div class="gm-v28-kpi"><span>SSH Signers</span><strong>${report.sshSignersExists ? '✅ Ready' : '—'}</strong></div>
          </div>
          ${report.recommendations.length > 0 ? `<ul class="gm-v28-recs">${report.recommendations.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : `<div class="gm-patch-check-banner ok">${esc(T('仓库索引与对象存储处于最佳状态', 'Repository commit-graph and object store are healthy'))}</div>`}
          <div class="gm-v28-pills" style="margin-top:12px">
            <button type="button" class="mini-btn primary act-m-opt" data-mode="commitGraph">${esc(T('⚡ 构建 Commit-Graph 索引', '⚡ Write Commit-Graph'))}</button>
            <button type="button" class="mini-btn act-m-opt" data-mode="gc">${esc(T('🧹 运行 git gc --auto', '🧹 Run git gc --auto'))}</button>
            <button type="button" class="mini-btn act-m-opt" data-mode="maintenance">${esc(T('🔧 运行 git maintenance', '🔧 Run Maintenance'))}</button>
            <button type="button" class="mini-btn act-m-signers">${esc(T('🔏 配置 SSH allowed_signers', '🔏 Edit SSH allowed_signers'))}</button>
          </div>
        `;
        bodyEl.querySelectorAll('.act-m-opt').forEach((btn) => btn.addEventListener('click', async () => {
          btn.disabled = true;
          const mode = btn.getAttribute('data-mode');
          const r = await app.rpc('maintenance:optimize', { repo, mode });
          if (r.error) app.showToast(r.error, 'warning');
          else app.showToast(T('仓库优化完成', 'Repository optimization completed'), 'info');
          void renderHealth();
        }));
        bodyEl.querySelector('.act-m-signers')?.addEventListener('click', openSignersFile);
      } catch (err) {
        if (isCurrent()) bodyEl.innerHTML = `<div class="scm-empty error-text">${esc(err.message)}</div>`;
      }
    };
    void renderHealth();
  }

  /* ── 10. Coding Agents, MCP Server & Git Hooks Modal ── */
  async function openCodingAgentsModal() {
    const repo = activeRepoOrWarn();
    if (!repo) return;
    const app = getApp();
    const feat = getFeat();
    const { bodyEl, isCurrent } = feat.openFeatureModal({
      title: T('🤝 AI 编程智能体、MCP 服务与 Git Hooks 集成', '🤝 Coding Agents, MCP Server & Git Hooks'),
      sub: app.parseRepoDisplay(repo).fullDisplay,
      badge: 'MCP'
    });
    const load = async () => {
      bodyEl.innerHTML = `<div class="scm-empty"><span class="fb-spinner"></span> ${esc(T('正在检测已安装的 AI 编程工具与配置…', 'Detecting coding agents and MCP configurations…'))}</div>`;
      try {
        const res = await app.rpc('agents:list', { repo });
        if (!isCurrent()) return;
        bodyEl.innerHTML = `
          <div class="gm-v28-card" style="margin-bottom:10px">
            <div class="gm-v28-card-main">
              <div class="gm-v28-card-title"><strong>GitMap Headless MCP Server</strong></div>
              <div class="gm-v28-card-meta"><code>${esc(res.mcpCliCommand)}</code></div>
            </div>
            <div class="gm-v28-card-actions">
              <button type="button" class="mini-btn act-copy-mcp">${esc(T('复制命令', 'Copy CLI'))}</button>
            </div>
          </div>
          <div class="gm-v28-list">
            ${(res.agents || []).map((ag) => `
              <div class="gm-v28-card">
                <div class="gm-v28-card-main">
                  <div class="gm-v28-card-title">
                    <strong>${esc(ag.name)}</strong>
                    <span class="gm-badge ${ag.detected ? 'ok' : ''}">${esc(ag.detected ? T('已检测到 CLI', 'Installed') : ag.kind.toUpperCase())}</span>
                  </div>
                  <div class="gm-v28-card-meta">
                    MCP: <strong>${ag.mcpConfigured ? 'Enabled' : 'Off'}</strong> · Hook: <strong>${ag.hooksConfigured ? 'Enabled' : 'Off'}</strong>
                  </div>
                </div>
                <div class="gm-v28-card-actions">
                  <button type="button" class="mini-btn ${ag.mcpConfigured ? 'primary' : ''} act-ag-mcp" data-id="${esc(ag.id)}" data-next="${!ag.mcpConfigured}">${esc(ag.mcpConfigured ? T('关闭 MCP', 'Disable MCP') : T('写入 MCP 配置', 'Enable MCP'))}</button>
                  <button type="button" class="mini-btn ${ag.hooksConfigured ? 'primary' : ''} act-ag-hook" data-id="${esc(ag.id)}" data-next="${!ag.hooksConfigured}">${esc(ag.hooksConfigured ? T('移除 Hook', 'Remove Hook') : T('安装 Git Hook', 'Install Hook'))}</button>
                </div>
              </div>
            `).join('')}
          </div>
        `;
        bodyEl.querySelector('.act-copy-mcp')?.addEventListener('click', () => {
          navigator.clipboard?.writeText(res.mcpCliCommand).catch(() => {});
          app.showToast(T('已复制 MCP 启动命令', 'Copied MCP command'), 'info');
        });
        bodyEl.querySelectorAll('.act-ag-mcp').forEach((btn) => btn.addEventListener('click', async () => {
          const r = await app.rpc('agents:toggleMcp', { repo, agentId: btn.getAttribute('data-id'), enable: btn.getAttribute('data-next') === 'true' });
          if (!r.ok) app.showToast(r.error || 'Failed', 'error');
          else app.showToast(r.configPath, 'info');
          void load();
        }));
        bodyEl.querySelectorAll('.act-ag-hook').forEach((btn) => btn.addEventListener('click', async () => {
          const r = await app.rpc('agents:toggleHook', { repo, agentId: btn.getAttribute('data-id'), enable: btn.getAttribute('data-next') === 'true' });
          if (!r.ok) app.showToast(r.error || 'Failed', 'error');
          else app.showToast(r.hookPath, 'info');
          void load();
        }));
      } catch (err) {
        if (isCurrent()) bodyEl.innerHTML = `<div class="scm-empty error-text">${esc(err.message)}</div>`;
      }
    };
    void load();
  }

  /* ── 11. Markdown Changelog / Weekly Report Exporter Modal ── */
  async function openChangelogExportModal() {
    const repo = activeRepoOrWarn();
    if (!repo) return;
    const app = getApp();
    const feat = getFeat();
    const { bodyEl, isCurrent } = feat.openFeatureModal({
      title: T('📝 导出 Markdown 变更日志 / 周报', '📝 Export Markdown Changelog / Weekly Report'),
      sub: app.parseRepoDisplay(repo).fullDisplay,
      badge: 'Export',
      wide: true
    });
    let preset = '7d';
    let customRange = '';

    const generate = async () => {
      bodyEl.innerHTML = `<div class="scm-empty"><span class="fb-spinner"></span> ${esc(T('正在整理提交记录…', 'Generating Markdown changelog…'))}</div>`;
      const opts = preset === '7d'
        ? { since: '7 days ago', label: T('最近 7 天研发周报', 'Weekly Report (Last 7 Days)') }
        : preset === '30d'
          ? { since: '30 days ago', label: T('最近 30 天变更日志', 'Monthly Changelog') }
          : preset === 'range'
            ? { rangeSpec: customRange || 'HEAD~20..HEAD', label: customRange || 'Range Changelog' }
            : { limit: 150, label: T('近期变更日志', 'Changelog') };
      try {
        const res = await app.rpc('changelog:export', { repo, ...opts });
        if (!isCurrent()) return;
        bodyEl.innerHTML = `
          <div class="gm-v28-toolbar">
            <div class="gm-v28-pills">
              ${[['7d', T('最近 7 天 (周报)', 'Last 7 Days')], ['30d', T('最近 30 天', 'Last 30 Days')], ['all', T('最近 150 条', 'Recent 150')], ['range', T('自定义范围', 'Custom Range')]].map(([id, lbl]) => `<button type="button" class="mini-btn ${preset === id ? 'primary' : ''}" data-p="${id}">${esc(lbl)}</button>`).join('')}
              ${preset === 'range' ? `<input type="text" id="clRangeInput" class="gm-v28-search" style="width:200px" value="${esc(customRange || 'HEAD~20..HEAD')}" placeholder="v1.0.0..HEAD" /><button type="button" class="mini-btn primary" id="clRunRange">Go</button>` : ''}
            </div>
            <div class="gm-v28-pills">
              <button type="button" class="mini-btn act-cl-copy">${esc(T('复制 Markdown', 'Copy Markdown'))}</button>
              <button type="button" class="mini-btn primary act-cl-dl">${esc(T('下载 .md', 'Download .md'))}</button>
            </div>
          </div>
          <textarea class="inline-file-editor" id="clMarkdownArea" style="height:360px;border:1px solid var(--vscode-panel-border);border-radius:6px">${esc(res.markdown || '')}</textarea>
        `;
        bodyEl.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => { preset = b.getAttribute('data-p'); void generate(); }));
        bodyEl.querySelector('#clRunRange')?.addEventListener('click', () => { customRange = bodyEl.querySelector('#clRangeInput').value.trim(); void generate(); });
        bodyEl.querySelector('.act-cl-copy')?.addEventListener('click', () => {
          const val = bodyEl.querySelector('#clMarkdownArea').value;
          navigator.clipboard?.writeText(val).catch(() => {});
          app.showToast(T('已复制 Markdown 到剪贴板', 'Copied Markdown to clipboard'), 'info');
        });
        bodyEl.querySelector('.act-cl-dl')?.addEventListener('click', () => {
          const val = bodyEl.querySelector('#clMarkdownArea').value;
          const blob = new Blob([val], { type: 'text/markdown;charset=utf-8' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `${app.parseRepoDisplay(repo).name}-changelog.md`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1500);
        });
      } catch (err) {
        if (isCurrent()) bodyEl.innerHTML = `<div class="scm-empty error-text">${esc(err.message)}</div>`;
      }
    };
    void generate();
  }

  /* ── 12. Companion Router Dispatcher (from Commit Graph Webview) ── */
  function openCompanionFeature(payload) {
    if (!payload || !payload.feature) return;
    const app = getApp();
    const feat = getFeat();
    if (payload.repo && app?.state?.repos?.[payload.repo]) {
      app.state.activeRepo = payload.repo;
      app.renderSidebar();
      app.renderActiveRepoBadge();
    }
    const args = payload.args || {};
    switch (payload.feature) {
      case 'aiReview': feat?.openAiCodeReviewModal(); break;
      case 'aiExplainRegression': openAiExplainRegressionModal(args.commitHash); break;
      case 'aiSmartCommitSplit': openPreCommitGuardModal({ tab: 'split' }); break;
      case 'aiReleaseNotes': feat?.openReleaseNotesModal(); break;
      case 'preCommitCheck': openPreCommitGuardModal(); break;
      case 'reflogExplorer': feat?.openReflogModal(); break;
      case 'conflictAssistant': feat?.openConflictResolverTab(); break;
      case 'branchDashboard': openBranchDashboardModal(); break;
      case 'submoduleManager': window.GitMapRemoteAndGitUI?.openSubmodulesLfsModal(); break;
      case 'repoInsights': openRepoInsightsModal(); break;
      case 'multiRepoOverview': window.GitMapRemoteAndGitUI?.openMultiRepoDashboardModal(); break;
      case 'checkoutPullRequest':
      case 'openLaunchpad': openLaunchpadModal(); break;
      case 'checkRepoHealth': openRepoMaintenanceModal(); break;
      case 'editSshAllowedSigners': openRepoMaintenanceModal({ autoOpenSigners: true }); break;
      case 'exportChangelog': openChangelogExportModal(); break;
      case 'setHostingToken': openHostingTokenDialog(args); break;
      case 'clearHostingToken': openHostingTokenDialog({ ...args, clear: true }); break;
      case 'startWork': openStartWorkModal(args); break;
      case 'aiAutoRebase': openAiAutoRebaseModal(args); break;
      case 'codingAgents': openCodingAgentsModal(); break;
      case 'scmGroupedView': openScmGroupedExplorerModal(); break;
      default: break;
    }
  }

  /* ── 13. Wire into TopBar, #toolsPopover, #scmModal & Command Palette ── */
  document.getElementById('btnLaunchpadPill')?.addEventListener('click', () => openLaunchpadModal());

  // Inject Pre-Commit Guard button into #scmModal header
  const scmTitleGrp = document.querySelector('#scmModal .modal-title-group');
  if (scmTitleGrp && !scmTitleGrp.querySelector('.act-scm-guard')) {
    const guardBtn = document.createElement('button');
    guardBtn.type = 'button';
    guardBtn.className = 'mini-btn act-scm-guard';
    guardBtn.style.marginLeft = '8px';
    guardBtn.textContent = T('🛡️ 安全扫描 & 拆分', '🛡️ Safety Guard & Split');
    guardBtn.addEventListener('click', () => openPreCommitGuardModal());
    scmTitleGrp.appendChild(guardBtn);
  }

  function appendV28ToolsToPopover() {
    const pop = document.getElementById('toolsPopover');
    if (!pop || pop.classList.contains('hidden') || pop.querySelector('.gm-v28-tools-sep')) return;
    const sep = document.createElement('div');
    sep.className = 'gm-v28-tools-sep';
    sep.style.cssText = 'height:1px;background:var(--border);margin:6px 0;';
    pop.appendChild(sep);

    const items = [
      { label: T('🚀 PR Launchpad 聚合分诊台', '🚀 PR Launchpad & Triage'), fn: () => openLaunchpadModal() },
      { label: T('🧭 全景源代码管理视图 (11 分组)', '🧭 Grouped SCM Explorer (11 Sections)'), fn: () => openScmGroupedExplorerModal() },
      { label: T('🛡️ 提交前安全守卫 & 智能拆分', '🛡️ Pre-Commit Guard & Smart Split'), fn: () => openPreCommitGuardModal() },
      { label: T('🌿 分支生命周期治理仪表盘', '🌿 Branch Lifecycle Dashboard'), fn: () => openBranchDashboardModal() },
      { label: T('📈 仓库热点、知识孤岛与协同变更', '📈 Repo Insights, Silos & Co-Change'), fn: () => openRepoInsightsModal() },
      { label: T('🚀 从任务单创建工作分支 (Start Work)', '🚀 Start Work from Issue'), fn: () => openStartWorkModal() },
      { label: T('🤖 AI 自动变基与一键回滚', '🤖 AI Auto-Rebase & Undo'), fn: () => openAiAutoRebaseModal() },
      { label: T('🔬 AI 回归缺陷根因定位', '🔬 AI Explain Regression'), fn: () => openAiExplainRegressionModal() },
      { label: T('🩺 仓库健康体检与 SSH 签名验签', '🩺 Repo Health & SSH Signers'), fn: () => openRepoMaintenanceModal() },
      { label: T('🤝 编程智能体与 MCP Server 集成', '🤝 Coding Agents & MCP Server'), fn: () => openCodingAgentsModal() },
      { label: T('📝 导出 Markdown 周报 / 变更日志', '📝 Export Markdown Changelog'), fn: () => openChangelogExportModal() }
    ];

    items.forEach((it) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tools-popover-item';
      btn.style.cssText = 'display:flex;align-items:center;width:100%;text-align:left;padding:7px 10px;border:0;background:transparent;color:var(--text-0);font-size:12.5px;border-radius:6px;cursor:pointer;';
      btn.textContent = it.label;
      btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(128,128,128,0.14)'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; });
      btn.addEventListener('click', () => {
        pop.classList.add('hidden');
        it.fn();
      });
      pop.appendChild(btn);
    });
  }

  const toolsPopEl = document.getElementById('toolsPopover');
  if (toolsPopEl) {
    new MutationObserver(appendV28ToolsToPopover).observe(toolsPopEl, { attributes: true, attributeFilter: ['class'], childList: true });
  }

  setTimeout(() => void refreshLaunchpadPill(false), 3200);
  setInterval(() => {
    if (!document.hidden) void refreshLaunchpadPill(false);
  }, 60000);

  window.GitMapV28Workbench = {
    openCompanionFeature,
    openLaunchpadModal,
    openHostingTokenDialog,
    openScmGroupedExplorerModal,
    openRepoInsightsModal,
    openBranchDashboardModal,
    openPreCommitGuardModal,
    openStartWorkModal,
    openAiAutoRebaseModal,
    openAiExplainRegressionModal,
    openRepoMaintenanceModal,
    openCodingAgentsModal,
    openChangelogExportModal,
    refreshLaunchpadPill
  };
})();
