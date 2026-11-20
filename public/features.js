(function () {
  'use strict';

  const App = window.GitMapApp;
  if (!App) return;

  const {
    state,
    ICONS,
    escapeHtml,
    rpc,
    sendWs,
    showToast,
    confirmDialog,
    parseRepoDisplay,
    hostLabel,
    hostAddress,
    renderSidebar,
    renderActiveRepoBadge,
    hashTabKey,
    createOrReplacePanelTab,
    activateTab,
    openDiffTab,
    openFileTab,
    openLocalModal,
    openSshModal,
    openCloneModal,
    openScmModal,
    openAppSettingsModal,
    openLogsModal,
    openTerminalSession,
    openExternalTerminal,
    openInEditor,
    toggleTerminalDrawer,
    refreshGraphView,
    applyTheme
  } = App;

  const T = (zh, en) => (state.lang === 'zh' ? zh : en);

  /* ==================== Feature Modal Helper ==================== */
  let featureModalSeq = 0;
  function openFeatureModal(opts) {
    const seq = ++featureModalSeq;
    const modal = document.getElementById('featureModal');
    modal.setAttribute('data-feature-seq', String(seq));
    const win = modal.querySelector('.feature-modal-window');
    win.style.width = opts.width || 'min(880px, 94vw)';
    document.getElementById('featureModalIcon').innerHTML = opts.icon || ICONS.layers || '';
    document.getElementById('featureModalTitle').textContent = opts.title || 'GitMap';
    const badge = document.getElementById('featureModalBadge');
    if (opts.badge) {
      badge.textContent = opts.badge;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
    const subtitle = document.getElementById('featureModalSubtitle');
    if (subtitle) {
      subtitle.textContent = opts.subtitle || '';
      subtitle.classList.toggle('hidden', !opts.subtitle);
    }
    const bodyEl = document.getElementById('featureModalBody');
    const footerEl = document.getElementById('featureModalFooter');
    bodyEl.innerHTML = opts.bodyHtml || '';
    footerEl.innerHTML = opts.footerHtml || `<button type="button" class="mini-btn act-fm-close">${escapeHtml(T('关闭', 'Close'))}</button>`;
    const closeBtn = footerEl.querySelector('.act-fm-close');
    if (closeBtn) closeBtn.onclick = () => modal.classList.add('hidden');
    modal.classList.remove('hidden');
    return {
      seq,
      modal,
      bodyEl,
      footerEl,
      isCurrent: () => seq === featureModalSeq && !modal.classList.contains('hidden'),
      close: () => {
        if (seq === featureModalSeq) modal.classList.add('hidden');
      }
    };
  }

  function requireActiveRepo() {
    if (!state.activeRepo) {
      showToast(T('请先选择一个仓库', 'Select a repository first'), 'warning');
      return null;
    }
    return state.activeRepo;
  }

  /* ==================== 5. Multi-Repo Quick Statuses, Batch Fetch & Operation Banner ==================== */
  let statusRefreshInFlight = false;
  let statusRefreshQueued = false;
  let repoContextSeq = 0;

  async function refreshRepoContext() {
    const seq = ++repoContextSeq;
    const banner = document.getElementById('repoOperationBanner');
    const scmBadge = document.getElementById('scmDirtyBadge');
    const repo = state.activeRepo;
    if (!repo) {
      banner.classList.add('hidden');
      scmBadge.classList.add('hidden');
      return;
    }

    const qs = state.repoQuickStatuses[repo];
    const dirtyTotal = qs ? (qs.stagedCount || 0) + (qs.unstagedCount || 0) + (qs.conflictCount || 0) : 0;
    scmBadge.textContent = String(dirtyTotal);
    scmBadge.classList.toggle('hidden', dirtyTotal === 0);

    try {
      const op = await rpc('git:operationState', { repo });
      if (seq !== repoContextSeq || state.activeRepo !== repo) return;
      if (!op.mergeInProgress && !op.rebaseInProgress && !op.cherryPickInProgress && !op.revertInProgress && !op.bisectInProgress && op.conflictCount === 0) {
        banner.classList.add('hidden');
        banner.innerHTML = '';
        return;
      }

      if (op.bisectInProgress) {
        const bs = await rpc('bisect:status', { repo });
        if (seq !== repoContextSeq || state.activeRepo !== repo) return;
        banner.className = 'repo-op-banner';
        banner.innerHTML = `
          <div class="repo-op-banner-left">
            <span class="icon-slot">${ICONS.compass}</span>
            <strong>${escapeHtml(T('Git Bisect 二分排错进行中', 'Git Bisect in progress'))}</strong>
            ${bs.culpritHash
              ? `<span class="scm-status-badge st-D">${escapeHtml(T('已定位引入提交：', 'First bad commit: ') + bs.culpritHash.slice(0, 8))}</span>`
              : `<span>HEAD: <code>${escapeHtml(bs.currentHash || '')}</code> ${escapeHtml(bs.currentSubject || '')}</span>`}
          </div>
          <div class="repo-op-banner-actions">
            ${!bs.culpritHash ? `
              <button type="button" class="mini-btn act-bn-good">${escapeHtml(T('✓ 正常 (Good)', '✓ Good'))}</button>
              <button type="button" class="mini-btn danger act-bn-bad">${escapeHtml(T('✗ 有问题 (Bad)', '✗ Bad'))}</button>
              <button type="button" class="mini-btn act-bn-skip">${escapeHtml(T('跳过 (Skip)', 'Skip'))}</button>
            ` : ''}
            <button type="button" class="mini-btn act-bn-detail">${escapeHtml(T('详情', 'Details'))}</button>
            <button type="button" class="mini-btn act-bn-reset">${escapeHtml(T('结束二分', 'Reset Bisect'))}</button>
          </div>
        `;
        banner.querySelector('.act-bn-detail')?.addEventListener('click', () => openBisectModal());
        banner.querySelector('.act-bn-reset')?.addEventListener('click', async () => {
          await rpc('bisect:reset', { repo });
          showToast(T('已退出 Git Bisect', 'Bisect reset complete'), 'info');
          refreshGraphView();
          refreshAllStatusesAndContext();
        });
        ['good', 'bad', 'skip'].forEach((verdict) => {
          banner.querySelector(`.act-bn-${verdict}`)?.addEventListener('click', async () => {
            try {
              const r = await rpc('bisect:step', { repo, verdict });
              if (r.culpritHash) showToast(T('找到引入 Bug 的首个提交：', 'Found first bad commit: ') + r.culpritHash.slice(0, 10), 'warning');
              refreshGraphView();
              refreshAllStatusesAndContext();
            } catch (err) {
              showToast(err.message, 'error');
            }
          });
        });
        return;
      }

      const opKind = op.rebaseInProgress
        ? 'rebase'
        : op.cherryPickInProgress
          ? 'cherry-pick'
          : op.revertInProgress
            ? 'revert'
            : 'merge';
      const opLabel = opKind === 'rebase'
        ? 'Rebase'
        : opKind === 'cherry-pick'
          ? 'Cherry-Pick'
          : opKind === 'revert'
            ? 'Revert'
            : 'Merge';
      banner.className = 'repo-op-banner is-conflict';
      banner.innerHTML = `
        <div class="repo-op-banner-left">
          <span class="icon-slot">${ICONS.merge}</span>
          <strong>${escapeHtml(T(`${opLabel} 进行中`, `${opLabel} in progress`))}</strong>
          <span>${escapeHtml(op.conflictCount > 0 ? T(`剩余 ${op.conflictCount} 个冲突文件待解决`, `${op.conflictCount} conflicted file(s) remaining`) : T('所有冲突已解决，可继续完成操作', 'All conflicts resolved — ready to continue'))}</span>
        </div>
        <div class="repo-op-banner-actions">
          <button type="button" class="mini-btn act-op-scm">${ICONS.commit}<span>${escapeHtml(T('查看冲突列表', 'View Conflicts'))}</span></button>
          ${op.conflictCount === 0 ? `<button type="button" class="mini-btn primary act-op-continue">${escapeHtml(T(`继续 ${opLabel}`, `Continue ${opLabel}`))}</button>` : ''}
          <button type="button" class="mini-btn danger act-op-abort">${escapeHtml(T(`中止 ${opLabel}`, `Abort ${opLabel}`))}</button>
        </div>
      `;
      banner.querySelector('.act-op-scm').addEventListener('click', () => openScmModal());
      banner.querySelector('.act-op-continue')?.addEventListener('click', async () => {
        try {
          await rpc('conflict:continueOrAbort', { repo, operation: opKind, action: 'continue' });
          showToast(T(`${opLabel} 已完成`, `${opLabel} completed`), 'info');
          refreshGraphView();
          refreshAllStatusesAndContext();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
      banner.querySelector('.act-op-abort').addEventListener('click', async () => {
        const ok = await confirmDialog(
          T(`中止 ${opLabel}`, `Abort ${opLabel}`),
          T(`确定中止当前 ${opLabel} 并恢复到操作前状态？`, `Abort the in-progress ${opLabel} and restore previous state?`),
          T('中止', 'Abort'),
          true
        );
        if (!ok) return;
        try {
          await rpc('conflict:continueOrAbort', { repo, operation: opKind, action: 'abort' });
          showToast(T(`已中止 ${opLabel}`, `${opLabel} aborted`), 'info');
          refreshGraphView();
          refreshAllStatusesAndContext();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    } catch (_) {
      if (seq === repoContextSeq) banner.classList.add('hidden');
    }
  }

  async function refreshAllStatusesAndContext() {
    if (statusRefreshInFlight) {
      statusRefreshQueued = true;
      return;
    }
    statusRefreshInFlight = true;
    try {
      do {
        statusRefreshQueued = false;
        const keys = Object.keys(state.repos || {});
        if (keys.length > 0) {
          const res = await rpc('repos:quickStatuses', { repos: keys });
          state.repoQuickStatuses = res.statuses || {};
          renderSidebar();
        }
        await refreshRepoContext();
      } while (statusRefreshQueued);
    } catch (_) {
    } finally {
      statusRefreshInFlight = false;
    }
  }

  async function fetchAllRepos() {
    const btn = document.getElementById('sidebarFetchAllBtn');
    if (btn) btn.disabled = true;
    showToast(T('正在后台批量 Fetch 所有仓库…', 'Fetching all repositories…'), 'status');
    try {
      const res = await rpc('repos:fetchAll');
      state.repoQuickStatuses = res.statuses || state.repoQuickStatuses;
      renderSidebar();
      await refreshRepoContext();
      const failNote = res.failed && res.failed.length > 0 ? T(`（${res.failed.length} 个失败）`, ` (${res.failed.length} failed)`) : '';
      showToast(T(`已同步 ${res.fetched} 个仓库${failNote}`, `Fetched ${res.fetched} repositories${failNote}`), res.failed?.length ? 'warning' : 'info');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  /* ==================== 1. Hunk & Line Partial Stage / Unstage / Discard Inspector ==================== */
  async function openHunkStagingModal(repo, filePath, staged, onChanged) {
    const ui = openFeatureModal({
      title: T('代码块与代码行精细暂存：', 'Hunk & Line Staging: ') + filePath,
      badge: staged ? T('已暂存 (Staged)', 'Staged') : T('未暂存 (Working Tree)', 'Unstaged'),
      icon: ICONS.diff,
      width: 'min(920px, 95vw)',
      bodyHtml: `<div class="browser-empty-state"><span class="fb-spinner"></span>Loading hunks…</div>`
    });

    const loadHunks = async () => {
      try {
        const data = await rpc('scm:hunks', { repo, filePath, staged });
        if (data.isBinary) {
          ui.bodyEl.innerHTML = `<div class="browser-empty-state">${escapeHtml(T('二进制文件不支持按代码块暂存。', 'Binary files do not support partial hunk staging.'))}</div>`;
          return;
        }
        if (!data.hunks || data.hunks.length === 0) {
          ui.close();
          if (onChanged) await onChanged();
          return;
        }

        ui.bodyEl.innerHTML = `<p class="settings-hint" style="margin:0;">${escapeHtml(
          T('提示：可直接对整个代码块执行操作，或勾选左侧 + / - 代码行仅暂存/取消暂存/丢弃选中的行。', 'Tip: Act on an entire hunk, or check specific +/- lines to stage, unstage, or discard only selected lines.')
        )}</p>` + data.hunks.map((h, hIdx) => {
          const rowsHtml = h.lines.map((ln) => {
            if (ln.sign === '\\') return '';
            const cls = ln.sign === '+' ? 'diff-cell-add' : ln.sign === '-' ? 'diff-cell-del' : '';
            const changeable = ln.sign === '+' || ln.sign === '-';
            return `<tr class="${cls}">
              <td class="hunk-line-chk">${changeable ? `<input type="checkbox" class="hunk-line-box" data-line-idx="${ln.index}" />` : ''}</td>
              <td class="diff-gutter">${ln.oldLine ?? ''}</td>
              <td class="diff-gutter">${ln.newLine ?? ''}</td>
              <td class="hunk-line-text"><span class="diff-sign">${escapeHtml(ln.sign)}</span>${escapeHtml(ln.text)}</td>
            </tr>`;
          }).join('');

          return `<div class="hunk-card" data-hunk-idx="${hIdx}">
            <div class="hunk-card-head">
              <span>${escapeHtml(h.header)}</span>
              <span style="display:inline-flex;gap:6px;flex-wrap:wrap;">
                ${staged ? `
                  <button type="button" class="mini-btn act-hunk-sel-unstage">${escapeHtml(T('取消暂存选中行', 'Unstage Selected Lines'))}</button>
                  <button type="button" class="mini-btn primary act-hunk-all-unstage">${escapeHtml(T('取消暂存整块', 'Unstage Hunk'))}</button>
                ` : `
                  <button type="button" class="mini-btn danger act-hunk-sel-discard">${escapeHtml(T('丢弃选中行', 'Discard Selected'))}</button>
                  <button type="button" class="mini-btn danger act-hunk-all-discard">${escapeHtml(T('丢弃整块', 'Discard Hunk'))}</button>
                  <button type="button" class="mini-btn act-hunk-sel-stage">${escapeHtml(T('暂存选中行', 'Stage Selected Lines'))}</button>
                  <button type="button" class="mini-btn primary act-hunk-all-stage">${escapeHtml(T('暂存整块', 'Stage Hunk'))}</button>
                `}
              </span>
            </div>
            <table class="hunk-lines-table"><tbody>${rowsHtml}</tbody></table>
          </div>`;
        }).join('');

        ui.bodyEl.querySelectorAll('.hunk-card').forEach((card) => {
          const hunk = data.hunks[Number(card.getAttribute('data-hunk-idx'))];
          const getChecked = () => Array.from(card.querySelectorAll('.hunk-line-box:checked')).map((el) => Number(el.getAttribute('data-line-idx')));

          const applyWhole = async (mode) => {
            if (mode === 'discard') {
              const ok = await confirmDialog(T('丢弃代码块', 'Discard Hunk'), T('确定从工作区丢弃此代码块的改动？不可撤销。', 'Discard this hunk from the working tree? This cannot be undone.'), T('丢弃', 'Discard'), true);
              if (!ok) return;
            }
            try {
              await rpc('scm:applyHunk', { repo, mode, patch: hunk.patch });
              if (onChanged) await onChanged();
              await loadHunks();
            } catch (err) {
              showToast(err.message, 'error');
            }
          };

          const applySelected = async (mode) => {
            const selectedIndices = getChecked();
            if (selectedIndices.length === 0) {
              showToast(T('请先勾选至少一行 + 或 - 改动行', 'Check at least one +/- line first.'), 'warning');
              return;
            }
            if (mode === 'discard') {
              const ok = await confirmDialog(T('丢弃选中行', 'Discard Selected Lines'), T(`确定丢弃选中的 ${selectedIndices.length} 行改动？`, `Discard ${selectedIndices.length} selected line(s)?`), T('丢弃', 'Discard'), true);
              if (!ok) return;
            }
            try {
              await rpc('scm:applyHunk', { repo, mode, fileHeader: data.fileHeader, hunk, selectedIndices });
              if (onChanged) await onChanged();
              await loadHunks();
            } catch (err) {
              showToast(err.message, 'error');
            }
          };

          card.querySelector('.act-hunk-all-stage')?.addEventListener('click', () => applyWhole('stage'));
          card.querySelector('.act-hunk-sel-stage')?.addEventListener('click', () => applySelected('stage'));
          card.querySelector('.act-hunk-all-unstage')?.addEventListener('click', () => applyWhole('unstage'));
          card.querySelector('.act-hunk-sel-unstage')?.addEventListener('click', () => applySelected('unstage'));
          card.querySelector('.act-hunk-all-discard')?.addEventListener('click', () => applyWhole('discard'));
          card.querySelector('.act-hunk-sel-discard')?.addEventListener('click', () => applySelected('discard'));
        });
      } catch (err) {
        ui.bodyEl.innerHTML = `<div class="browser-empty-state error-text">${escapeHtml(err.message)}</div>`;
      }
    };

    await loadHunks();
  }

  /* ==================== 2. 3-Way Merge Conflict Resolver + AI Smart Merge ==================== */
  async function openConflictResolverTab(repo, filePath) {
    const tabId = hashTabKey('conflict-', `${repo}:${filePath}`);
    const panel = createOrReplacePanelTab(tabId, T('解冲突: ', 'Conflict: ') + filePath.split('/').pop(), ICONS.merge);
    panel.innerHTML = `<div class="browser-empty-state"><span class="fb-spinner"></span>Loading 3-way conflict view…</div>`;

    try {
      const data = await rpc('conflict:read', { repo, filePath });
      const mount = () => {
        const prevEditorScroll = panel.querySelector('.cf-result-editor')?.scrollTop || 0;
        const prevPreScrolls = Array.from(panel.querySelectorAll('.conflict-pane-pre')).map((el) => el.scrollTop);
        const blocks = parseConflictBlocksClient(data.workingContent);
        panel.innerHTML = `
          <div class="viewer-toolbar">
            <div class="viewer-toolbar-left">
              <span class="viewer-path">${escapeHtml(filePath)}</span>
              <span class="scm-status-badge ${blocks.length > 0 ? 'st-D' : 'st-A'}">${escapeHtml(blocks.length > 0 ? T(`${blocks.length} 处冲突标记`, `${blocks.length} conflict block(s)`) : T('无冲突标记', '0 conflict markers'))}</span>
            </div>
            <div class="viewer-toolbar-right">
              <button type="button" class="mini-btn act-cf-take-all-ours">${escapeHtml(T('整文件采用当前 (Ours)', 'Use All Ours'))}</button>
              <button type="button" class="mini-btn act-cf-take-all-theirs">${escapeHtml(T('整文件采用传入 (Theirs)', 'Use All Theirs'))}</button>
              <button type="button" class="mini-btn primary act-cf-save">${ICONS.check}<span>${escapeHtml(T('保存并标记已解决', 'Save & Mark Resolved'))}</span></button>
            </div>
          </div>
          ${blocks.length > 0 ? `
            <div class="conflict-blocks-bar">
              <strong style="font-size:11.5px;white-space:nowrap;">${escapeHtml(T('逐块快速处理：', 'Resolve block:'))}</strong>
              ${blocks.map((b, idx) => `
                <span class="feature-card" style="flex-direction:row;align-items:center;padding:3px 8px;gap:5px;white-space:nowrap;">
                  <span style="font-size:11px;font-weight:600;">#${idx + 1} (L${b.startLine})</span>
                  <button type="button" class="mini-btn act-blk-ours" data-b="${idx}" style="height:22px;padding:0 6px;font-size:11px;">Ours</button>
                  <button type="button" class="mini-btn act-blk-theirs" data-b="${idx}" style="height:22px;padding:0 6px;font-size:11px;">Theirs</button>
                  <button type="button" class="mini-btn act-blk-both" data-b="${idx}" style="height:22px;padding:0 6px;font-size:11px;">Both</button>
                  <button type="button" class="mini-btn primary act-blk-ai" data-b="${idx}" style="height:22px;padding:0 7px;font-size:11px;">${ICONS.sparkle}<span>AI</span></button>
                </span>
              `).join('')}
            </div>
          ` : ''}
          <div class="conflict-3way-grid">
            <div class="conflict-pane">
              <div class="conflict-pane-head"><span>${escapeHtml(T('当前分支 (Ours / Stage 2)', 'Current / Ours (Stage 2)'))}</span></div>
              <pre class="conflict-pane-pre">${escapeHtml(data.oursContent)}</pre>
            </div>
            <div class="conflict-pane">
              <div class="conflict-pane-head"><span>${escapeHtml(T('合并结果（可直接编辑）', 'Merged Result (Editable)'))}</span></div>
              <textarea class="inline-file-editor cf-result-editor" spellcheck="false"></textarea>
            </div>
            <div class="conflict-pane">
              <div class="conflict-pane-head"><span>${escapeHtml(T('传入更改 (Theirs / Stage 3)', 'Incoming / Theirs (Stage 3)'))}</span></div>
              <pre class="conflict-pane-pre">${escapeHtml(data.theirsContent)}</pre>
            </div>
          </div>
        `;

        const editor = panel.querySelector('.cf-result-editor');
        editor.value = data.workingContent;
        editor.scrollTop = prevEditorScroll;
        panel.querySelectorAll('.conflict-pane-pre').forEach((el, i) => {
          if (typeof prevPreScrolls[i] === 'number') el.scrollTop = prevPreScrolls[i];
        });
        editor.addEventListener('input', () => {
          data.workingContent = editor.value;
        });
        editor.addEventListener('keydown', (e) => {
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            panel.querySelector('.act-cf-save')?.click();
          }
        });

        const replaceBlock = (idx, replacement) => {
          const lines = data.workingContent.replace(/\r\n/g, '\n').split('\n');
          const blk = blocks[idx];
          if (!blk) return;
          lines.splice(blk.startLine - 1, blk.endLine - blk.startLine + 1, ...replacement.split('\n'));
          data.workingContent = lines.join('\n');
          mount();
        };

        panel.querySelectorAll('.act-blk-ours').forEach((btn) => {
          btn.addEventListener('click', () => replaceBlock(Number(btn.getAttribute('data-b')), blocks[Number(btn.getAttribute('data-b'))].ours));
        });
        panel.querySelectorAll('.act-blk-theirs').forEach((btn) => {
          btn.addEventListener('click', () => replaceBlock(Number(btn.getAttribute('data-b')), blocks[Number(btn.getAttribute('data-b'))].theirs));
        });
        panel.querySelectorAll('.act-blk-both').forEach((btn) => {
          btn.addEventListener('click', () => {
            const b = blocks[Number(btn.getAttribute('data-b'))];
            replaceBlock(Number(btn.getAttribute('data-b')), b.ours + '\n' + b.theirs);
          });
        });
        panel.querySelectorAll('.act-blk-ai').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const idx = Number(btn.getAttribute('data-b'));
            const b = blocks[idx];
            btn.disabled = true;
            try {
              const allLines = data.workingContent.replace(/\r\n/g, '\n').split('\n');
              const contextBefore = allLines.slice(Math.max(0, b.startLine - 8), b.startLine - 1).join('\n');
              const contextAfter = allLines.slice(b.endLine, Math.min(allLines.length, b.endLine + 8)).join('\n');
              const res = await rpc('conflict:aiMerge', {
                filePath,
                ours: b.ours,
                base: b.base,
                theirs: b.theirs,
                contextBefore,
                contextAfter
              });
              replaceBlock(idx, res.merged);
              showToast(T(`冲突块 #${idx + 1} 已由 AI 合并`, `Conflict #${idx + 1} merged with AI`), 'info');
            } catch (err) {
              showToast(err.message, 'error');
              btn.disabled = false;
            }
          });
        });

        panel.querySelector('.act-cf-take-all-ours').addEventListener('click', () => {
          data.workingContent = data.oursContent;
          mount();
        });
        panel.querySelector('.act-cf-take-all-theirs').addEventListener('click', () => {
          data.workingContent = data.theirsContent;
          mount();
        });
        panel.querySelector('.act-cf-save').addEventListener('click', async () => {
          const remaining = parseConflictBlocksClient(editor.value);
          if (remaining.length > 0) {
            const proceed = await confirmDialog(
              T('仍存在冲突标记', 'Conflict Markers Remain'),
              T(`文件中仍包含 ${remaining.length} 处 <<<<<<< 冲突标记，确定仍要保存并标记为已解决吗？`, `There are still ${remaining.length} conflict marker(s) in the file. Save and stage anyway?`),
              T('仍然保存', 'Save Anyway'),
              true
            );
            if (!proceed) return;
          }
          try {
            await rpc('conflict:resolve', { repo, filePath, content: editor.value });
            showToast(T(`已解决并暂存：${filePath}`, `Resolved and staged: ${filePath}`), 'info');
            App.closeTab(tabId);
            await refreshAllStatusesAndContext();
            openScmModal();
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      };
      mount();
    } catch (err) {
      panel.innerHTML = `<div class="browser-empty-state error-text">${escapeHtml(err.message)}</div>`;
    }
  }

  function parseConflictBlocksClient(text) {
    const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
      if (lines[i].startsWith('<<<<<<<')) {
        const startLine = i + 1;
        i++;
        const ours = [];
        const base = [];
        const theirs = [];
        let sec = 'ours';
        let hasBase = false;
        while (i < lines.length) {
          if (sec === 'ours' && lines[i].startsWith('|||||||')) { hasBase = true; sec = 'base'; i++; continue; }
          if ((sec === 'ours' || sec === 'base') && lines[i].startsWith('=======')) { sec = 'theirs'; i++; continue; }
          if (sec === 'theirs' && lines[i].startsWith('>>>>>>>')) {
            out.push({ startLine, endLine: i + 1, ours: ours.join('\n'), base: hasBase ? base.join('\n') : null, theirs: theirs.join('\n') });
            break;
          }
          if (sec === 'ours') ours.push(lines[i]);
          else if (sec === 'base') base.push(lines[i]);
          else theirs.push(lines[i]);
          i++;
        }
      }
      i++;
    }
    return out;
  }

  /* ==================== 3. Visual Interactive Rebase ==================== */
  async function openInteractiveRebaseModal(initialBase) {
    const repo = requireActiveRepo();
    if (!repo) return;
    const ui = openFeatureModal({
      title: T('可视化交互式变基 (Interactive Rebase)', 'Visual Interactive Rebase'),
      icon: ICONS.merge,
      width: 'min(860px, 94vw)',
      bodyHtml: `<div class="browser-empty-state"><span class="fb-spinner"></span>Loading commits…</div>`
    });

    let steps = [];
    let baseHash = '';
    let dragFromIdx = -1;

    const loadRange = async (baseArg) => {
      try {
        const res = await rpc('rebase:prepare', { repo, base: baseArg });
        baseHash = res.baseHash;
        if (res.branch) {
          document.getElementById('featureModalBadge').textContent = res.branch;
          document.getElementById('featureModalBadge').classList.remove('hidden');
        }
        steps = (res.commits || []).map((c) => ({
          action: 'pick',
          hash: c.hash,
          shortHash: c.shortHash,
          subject: c.subject,
          author: c.author,
          message: c.message
        }));
        renderSteps(baseArg || 10);
      } catch (err) {
        ui.bodyEl.innerHTML = `<div class="browser-empty-state error-text">${escapeHtml(err.message)}</div>`;
      }
    };

    const renderSteps = (baseVal) => {
      ui.bodyEl.innerHTML = `
        <div class="form-row-2" style="align-items:flex-end;">
          <label><span>${escapeHtml(T('基准范围（提交数或 Base Commit / 分支名）', 'Base Commit / Ref or Commit Count'))}</span>
            <input type="text" id="rbBaseInput" spellcheck="false" value="${escapeHtml(String(baseVal))}" placeholder="10 / main / a1b2c3d" />
          </label>
          <button type="button" id="btnRbReload" class="mini-btn">${ICONS.refresh}<span>${escapeHtml(T('加载范围', 'Load Range'))}</span></button>
        </div>
        <p class="settings-hint">${escapeHtml(T(`当前基准 Base: ${baseHash.slice(0, 10)}（按从旧到新顺序应用，支持上下拖拽调整顺序；执行前会自动创建备份引用）`, `Base commit: ${baseHash.slice(0, 10)} (applied oldest-to-newest; drag rows to reorder; a safety backup ref is created automatically).`))}</p>
        <div class="rebase-list" id="rbList">
          ${steps.length === 0 ? `<div class="scm-empty">${escapeHtml(T('该范围内没有可重排的线性提交。', 'No linear commits in this range.'))}</div>` : steps.map((s, idx) => `
            <div class="rebase-row action-${s.action}" draggable="true" data-idx="${idx}">
              <div class="rebase-row-main">
                <select class="rb-action-sel" data-idx="${idx}">
                  <option value="pick" ${s.action === 'pick' ? 'selected' : ''}>pick</option>
                  <option value="reword" ${s.action === 'reword' ? 'selected' : ''}>reword</option>
                  <option value="squash" ${s.action === 'squash' ? 'selected' : ''}>squash</option>
                  <option value="fixup" ${s.action === 'fixup' ? 'selected' : ''}>fixup</option>
                  <option value="drop" ${s.action === 'drop' ? 'selected' : ''}>drop</option>
                </select>
                <code>${escapeHtml(s.shortHash)}</code>
                <span class="rebase-subject" title="${escapeHtml(s.subject)}">${escapeHtml(s.subject)}</span>
                <span style="font-size:11px;color:var(--vscode-descriptionForeground);">${escapeHtml(s.author)}</span>
                <button type="button" class="mini-icon-btn act-rb-up" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''}>${ICONS.arrowUp}</button>
                <button type="button" class="mini-icon-btn act-rb-down" data-idx="${idx}" ${idx === steps.length - 1 ? 'disabled' : ''}>${ICONS.arrowDown}</button>
              </div>
              ${(s.action === 'reword' || s.action === 'squash') ? `
                <textarea class="scm-commit-textarea rb-msg-box" data-idx="${idx}" style="min-height:56px;">${escapeHtml(s.message || s.subject)}</textarea>
              ` : ''}
            </div>
          `).join('')}
        </div>
      `;

      ui.footerEl.innerHTML = `
        <button type="button" class="mini-btn act-fm-close">${escapeHtml(T('取消', 'Cancel'))}</button>
        <button type="button" class="mini-btn primary act-rb-exec" ${steps.length === 0 ? 'disabled' : ''}>${ICONS.check}<span>${escapeHtml(T('开始执行变基', 'Start Rebase'))}</span></button>
      `;
      ui.footerEl.querySelector('.act-fm-close').onclick = ui.close;

      document.getElementById('btnRbReload').addEventListener('click', () => {
        const raw = document.getElementById('rbBaseInput').value.trim();
        const asNum = /^\d+$/.test(raw) ? Number(raw) : raw;
        loadRange(asNum);
      });

      ui.bodyEl.querySelectorAll('.rb-action-sel').forEach((sel) => {
        sel.addEventListener('change', () => {
          const i = Number(sel.getAttribute('data-idx'));
          steps[i].action = sel.value;
          renderSteps(document.getElementById('rbBaseInput').value.trim());
        });
      });

      ui.bodyEl.querySelectorAll('.rb-msg-box').forEach((box) => {
        box.addEventListener('input', () => {
          steps[Number(box.getAttribute('data-idx'))].message = box.value;
        });
      });

      const move = (from, to) => {
        if (to < 0 || to >= steps.length || from === to) return;
        const [item] = steps.splice(from, 1);
        steps.splice(to, 0, item);
        renderSteps(document.getElementById('rbBaseInput').value.trim());
      };

      ui.bodyEl.querySelectorAll('.act-rb-up').forEach((b) => b.addEventListener('click', () => move(Number(b.getAttribute('data-idx')), Number(b.getAttribute('data-idx')) - 1)));
      ui.bodyEl.querySelectorAll('.act-rb-down').forEach((b) => b.addEventListener('click', () => move(Number(b.getAttribute('data-idx')), Number(b.getAttribute('data-idx')) + 1)));

      ui.bodyEl.querySelectorAll('.rebase-row').forEach((row) => {
        const idx = Number(row.getAttribute('data-idx'));
        row.addEventListener('dragstart', () => {
          dragFromIdx = idx;
          row.classList.add('dragging');
        });
        row.addEventListener('dragend', () => row.classList.remove('dragging'));
        row.addEventListener('dragover', (e) => e.preventDefault());
        row.addEventListener('drop', (e) => {
          e.preventDefault();
          if (dragFromIdx >= 0 && dragFromIdx !== idx) move(dragFromIdx, idx);
          dragFromIdx = -1;
        });
      });

      ui.footerEl.querySelector('.act-rb-exec').addEventListener('click', async (e) => {
        const execBtn = e.currentTarget;
        execBtn.disabled = true;
        try {
          await rpc('rebase:execute', {
            repo,
            baseHash,
            steps: steps.map((s) => ({ action: s.action, hash: s.hash, message: s.message }))
          });
          showToast(T('交互式变基已完成（可在设置中随时恢复历史备份）', 'Interactive rebase completed (backup ref saved)'), 'info');
          ui.close();
          activateTab('graph');
          refreshAllStatusesAndContext();
        } catch (err) {
          showToast(err.message, 'error');
          execBtn.disabled = false;
          refreshAllStatusesAndContext();
        }
      });
    };

    await loadRange(initialBase || 10);
  }

  /* ==================== 4. Git Worktrees Manager ==================== */
  async function openWorktreesModal() {
    const repo = requireActiveRepo();
    if (!repo) return;
    const ui = openFeatureModal({
      title: T('Git Worktree 多工作树管理', 'Git Worktrees Manager'),
      badge: parseRepoDisplay(repo).name,
      icon: ICONS.layers,
      width: 'min(840px, 94vw)',
      bodyHtml: `<div class="browser-empty-state"><span class="fb-spinner"></span>Loading worktrees…</div>`
    });

    const render = async () => {
      try {
        const [wtRes, refsRes] = await Promise.all([rpc('worktree:list', { repo }), rpc('git:refs', { repo })]);
        const list = wtRes.worktrees || [];
        const baseParent = repo.startsWith('ssh://')
          ? parseRepoDisplay(repo).remotePath.replace(/\/[^/]+$/, '')
          : repo.replace(/[\\/][^\\/]+$/, '');

        ui.bodyEl.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${list.map((w) => `
              <div class="feature-card">
                <div class="feature-card-top">
                  <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                    <span class="icon-slot">${ICONS.gitRepo}</span>
                    <strong style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(w.path)}</strong>
                    ${w.branch ? `<span class="branch-pill">${ICONS.branch}${escapeHtml(w.branch)}</span>` : `<span class="scm-status-badge">detached @ ${escapeHtml((w.head || '').slice(0, 7))}</span>`}
                    ${w.isMain ? `<span class="ssh-chip">main</span>` : ''}
                  </div>
                  <div style="display:inline-flex;gap:5px;flex-shrink:0;">
                    <button type="button" class="mini-btn act-wt-switch" data-uri="${escapeHtml(w.repoUri)}">${escapeHtml(T('切换图谱', 'Open Graph'))}</button>
                    <button type="button" class="mini-icon-btn act-wt-term" data-uri="${escapeHtml(w.repoUri)}" title="Integrated Terminal">${ICONS.terminal}</button>
                    <button type="button" class="mini-icon-btn act-wt-editor" data-uri="${escapeHtml(w.repoUri)}" title="Open in Editor">${ICONS.editor}</button>
                    ${!w.isMain ? `<button type="button" class="mini-icon-btn danger act-wt-del" data-path="${escapeHtml(w.path)}" title="Remove Worktree">${ICONS.trash}</button>` : ''}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
          <form id="wtAddForm" class="feature-card" style="margin-top:4px;">
            <strong style="font-size:12.5px;">${escapeHtml(T('+ 新建并行工作树 (Create Worktree)', '+ Create New Parallel Worktree'))}</strong>
            <div class="form-row-2">
              <label><span>${escapeHtml(T('目标文件夹路径', 'Target Folder Path'))}</span>
                <input type="text" id="wtTargetDir" class="path-input" required placeholder="${escapeHtml(baseParent + '/wt-feature')}" value="${escapeHtml(baseParent + '/wt-')}" />
              </label>
              <label><span>${escapeHtml(T('分支名称', 'Branch Name'))}</span>
                <input type="text" id="wtBranchName" required list="wtBranchSuggestions" placeholder="feat/parallel-task" />
              </label>
            </div>
            <datalist id="wtBranchSuggestions">${(refsRes.branches || []).map((b) => `<option value="${escapeHtml(b)}"></option>`).join('')}</datalist>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
              <label class="inline-check"><input type="checkbox" id="wtCreateBranch" checked /> <span>${escapeHtml(T('基于当前 HEAD 新建分支 (-b)', 'Create new branch (-b) from HEAD'))}</span></label>
              <button type="submit" class="mini-btn primary">${ICONS.plus}<span>${escapeHtml(T('创建并添加到侧栏', 'Create & Register'))}</span></button>
            </div>
          </form>
        `;

        ui.bodyEl.querySelectorAll('.act-wt-switch').forEach((b) => {
          b.addEventListener('click', async () => {
            const uri = b.getAttribute('data-uri');
            const addRes = await rpc('repos:add', { path: uri });
            state.repos = addRes.repos || state.repos;
            state.activeRepo = addRes.root;
            renderSidebar();
            renderActiveRepoBadge();
            ui.close();
            activateTab('graph');
            refreshAllStatusesAndContext();
          });
        });
        ui.bodyEl.querySelectorAll('.act-wt-term').forEach((b) => {
          b.addEventListener('click', () => {
            ui.close();
            openTerminalSession(b.getAttribute('data-uri'), undefined, null);
          });
        });
        ui.bodyEl.querySelectorAll('.act-wt-editor').forEach((b) => {
          b.addEventListener('click', () => openInEditor(b.getAttribute('data-uri')).catch((e) => showToast(e.message, 'error')));
        });
        ui.bodyEl.querySelectorAll('.act-wt-del').forEach((b) => {
          b.addEventListener('click', async () => {
            const wtPath = b.getAttribute('data-path');
            const ok = await confirmDialog(
              T('移除工作树', 'Remove Worktree'),
              T(`确定移除工作树 "${wtPath}"？`, `Remove worktree "${wtPath}"?`),
              T('移除', 'Remove'),
              true
            );
            if (!ok) return;
            try {
              const res = await rpc('worktree:remove', { repo, path: wtPath, force: true });
              state.repos = res.repos || state.repos;
              renderSidebar();
              await render();
            } catch (err) {
              showToast(err.message, 'error');
            }
          });
        });

        document.getElementById('wtAddForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          try {
            const res = await rpc('worktree:add', {
              repo,
              targetPath: document.getElementById('wtTargetDir').value.trim(),
              branch: document.getElementById('wtBranchName').value.trim(),
              createBranch: document.getElementById('wtCreateBranch').checked
            });
            state.repos = res.repos || state.repos;
            renderSidebar();
            showToast(T('工作树已创建并加入侧边栏', 'Worktree created and added to sidebar'), 'info');
            await render();
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      } catch (err) {
        ui.bodyEl.innerHTML = `<div class="browser-empty-state error-text">${escapeHtml(err.message)}</div>`;
      }
    };

    await render();
  }

  /* ==================== 6. GitHub / GitLab / Gitea PR & MR Integration ==================== */
  async function openPullRequestsModal() {
    const repo = requireActiveRepo();
    if (!repo) return;
    let activeView = 'list'; // 'list' | 'create'
    let providerOverride = '';

    const ui = openFeatureModal({
      title: T('Pull Requests / Merge Requests 协作', 'Pull Requests & Merge Requests'),
      icon: ICONS.pullRequest,
      width: 'min(880px, 94vw)',
      bodyHtml: `<div class="browser-empty-state"><span class="fb-spinner"></span>Loading remote hosting info…</div>`
    });

    const load = async () => {
      try {
        const res = await rpc('hosting:listPrs', { repo, provider: providerOverride || undefined });
        const rem = res.remote;
        if (rem) {
          document.getElementById('featureModalBadge').textContent = `${rem.host}/${rem.projectPath}`;
          document.getElementById('featureModalBadge').classList.remove('hidden');
        }

        const ciBadge = (st) => {
          const label = st === 'success' ? '✓ CI Passed' : st === 'failure' ? '✗ CI Failed' : st === 'pending' ? '⋯ CI Running' : 'CI —';
          return `<span class="ci-pill ci-${st || 'unknown'}">${label}</span>`;
        };

        ui.bodyEl.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
            <div class="segmented-control">
              <button type="button" class="pr-tab-list ${activeView === 'list' ? 'active' : ''}">${escapeHtml(T(`打开的 PR / MR (${(res.items || []).length})`, `Open PRs / MRs (${(res.items || []).length})`))}</button>
              <button type="button" class="pr-tab-create ${activeView === 'create' ? 'active' : ''}">${escapeHtml(T('+ 发起 PR / MR (AI 生成)', '+ Create PR / MR (AI)'))}</button>
            </div>
            ${rem ? `
              <div style="display:inline-flex;align-items:center;gap:6px;">
                <select id="prProviderSel" style="height:27px;font-size:12px;">
                  <option value="github" ${rem.provider === 'github' ? 'selected' : ''}>GitHub</option>
                  <option value="gitlab" ${rem.provider === 'gitlab' ? 'selected' : ''}>GitLab</option>
                  <option value="gitea" ${rem.provider === 'gitea' ? 'selected' : ''}>Gitea / Forgejo</option>
                </select>
                <button type="button" id="btnPrSetToken" class="mini-btn">${escapeHtml(res.hasToken ? T('已配置 Token ✓', 'Token Saved ✓') : T('配置 API Token…', 'Set API Token…'))}</button>
              </div>
            ` : ''}
          </div>
          <div id="prContentArea" style="display:flex;flex-direction:column;gap:8px;"></div>
        `;

        ui.bodyEl.querySelector('.pr-tab-list').onclick = () => { activeView = 'list'; load(); };
        ui.bodyEl.querySelector('.pr-tab-create').onclick = () => { activeView = 'create'; load(); };
        const provSel = document.getElementById('prProviderSel');
        if (provSel) {
          provSel.onchange = () => { providerOverride = provSel.value; load(); };
        }
        document.getElementById('btnPrSetToken')?.addEventListener('click', async () => {
          const tok = await App.inputDialog(
            T(`配置 ${rem.host} 访问令牌`, `Access Token for ${rem.host}`),
            T('Personal Access Token（留空并确定可清除已保存的 Token；加密保存在本机安全存储中）', 'Personal Access Token (encrypted locally; leave blank to clear)'),
            ''
          );
          if (tok === null) return;
          await rpc('hosting:setToken', { host: rem.host, token: tok });
          load();
        });

        const area = document.getElementById('prContentArea');
        if (!rem) {
          area.innerHTML = `<div class="scm-empty">${escapeHtml(res.error || 'No remote origin found.')}</div>`;
          return;
        }

        if (activeView === 'list') {
          if (res.error) {
            area.innerHTML = `<div class="feature-card error-text">${escapeHtml(res.error)}</div>`;
            return;
          }
          if (!res.items || res.items.length === 0) {
            area.innerHTML = `<div class="scm-empty">${escapeHtml(T('当前仓库暂无打开的 PR / MR。', 'No open Pull Requests / Merge Requests.'))}</div>`;
            return;
          }
          area.innerHTML = res.items.map((pr) => `
            <div class="feature-card">
              <div class="feature-card-top">
                <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                  <strong>#${pr.number}</strong>
                  <span style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(pr.title)}</span>
                  ${pr.draft ? `<span class="scm-status-badge">Draft</span>` : ''}
                </div>
                <div style="display:inline-flex;align-items:center;gap:6px;flex-shrink:0;">
                  ${ciBadge(pr.ciStatus)}
                  <button type="button" class="mini-btn act-pr-checkout" data-num="${pr.number}">${ICONS.branch}<span>${escapeHtml(T('检出分支', 'Checkout'))}</span></button>
                  <button type="button" class="mini-btn act-pr-web" data-url="${escapeHtml(pr.webUrl)}">↗</button>
                </div>
              </div>
              <div style="font-size:11.5px;color:var(--vscode-descriptionForeground);">
                <code>${escapeHtml(pr.sourceBranch)}</code> → <code>${escapeHtml(pr.targetBranch)}</code> · @${escapeHtml(pr.author)}
              </div>
            </div>
          `).join('');

          area.querySelectorAll('.act-pr-checkout').forEach((b) => {
            b.addEventListener('click', async () => {
              b.disabled = true;
              try {
                const r = await rpc('hosting:checkoutPr', { repo, number: Number(b.getAttribute('data-num')), provider: providerOverride || undefined });
                showToast(T(`已检出到本地分支 ${r.localBranch}`, `Checked out ${r.localBranch}`), 'info');
                ui.close();
                activateTab('graph');
                refreshAllStatusesAndContext();
              } catch (err) {
                showToast(err.message, 'error');
                b.disabled = false;
              }
            });
          });
          area.querySelectorAll('.act-pr-web').forEach((b) => {
            b.addEventListener('click', () => window.open(b.getAttribute('data-url'), '_blank', 'noopener,noreferrer'));
          });
        } else {
          const refs = await rpc('git:refs', { repo });
          const headDefault = res.currentBranch || refs.head || 'HEAD';
          const baseDefault = res.defaultBaseBranch || 'main';
          area.innerHTML = `
            <div class="form-row-2">
              <label><span>${escapeHtml(T('源分支 (Head)', 'Source Branch (Head)'))}</span>
                <input type="text" id="prHeadBranch" value="${escapeHtml(headDefault)}" list="prRefList" />
              </label>
              <label><span>${escapeHtml(T('目标分支 (Base)', 'Target Branch (Base)'))}</span>
                <input type="text" id="prBaseBranch" value="${escapeHtml(baseDefault)}" list="prRefList" />
              </label>
            </div>
            <datalist id="prRefList">${(refs.branches || []).map((b) => `<option value="${escapeHtml(b)}"></option>`).join('')}</datalist>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span class="settings-hint" style="margin:0;">${escapeHtml(T('可基于两分支间的提交与改动统计自动生成 PR 标题和描述：', 'Generate title & description from commits and diff stats between branches:'))}</span>
              <button type="button" id="btnPrAiDraft" class="mini-btn">${ICONS.sparkle}<span>${escapeHtml(T('AI 生成标题与摘要', 'AI Generate Title & Body'))}</span></button>
            </div>
            <label><span>${escapeHtml(T('标题', 'Title'))}</span><input type="text" id="prTitleInput" placeholder="feat: ..." /></label>
            <label><span>${escapeHtml(T('描述 (Markdown)', 'Description (Markdown)'))}</span><textarea id="prBodyInput" class="scm-commit-textarea" style="min-height:140px;"></textarea></label>
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <label class="inline-check"><input type="checkbox" id="prDraftChk" /> <span>Draft PR</span></label>
              <button type="button" id="btnPrSubmit" class="mini-btn primary">${ICONS.pullRequest}<span>${escapeHtml(res.hasToken ? T('直接创建 PR / MR', 'Create PR / MR') : T('在浏览器中预填并创建 PR / MR', 'Open Pre-filled PR in Browser'))}</span></button>
            </div>
          `;

          document.getElementById('btnPrAiDraft').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            btn.disabled = true;
            try {
              const draft = await rpc('hosting:generatePrDraft', {
                repo,
                baseBranch: document.getElementById('prBaseBranch').value.trim(),
                headBranch: document.getElementById('prHeadBranch').value.trim(),
                lang: state.lang
              });
              document.getElementById('prTitleInput').value = draft.title;
              document.getElementById('prBodyInput').value = draft.body;
            } catch (err) {
              showToast(err.message, 'error');
            } finally {
              btn.disabled = false;
            }
          });

          document.getElementById('btnPrSubmit').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const title = document.getElementById('prTitleInput').value.trim();
            if (!title) {
              showToast(T('请填写 PR 标题', 'Enter a PR title first.'), 'warning');
              return;
            }
            btn.disabled = true;
            try {
              const created = await rpc('hosting:createPr', {
                repo,
                baseBranch: document.getElementById('prBaseBranch').value.trim(),
                headBranch: document.getElementById('prHeadBranch').value.trim(),
                title,
                body: document.getElementById('prBodyInput').value,
                draft: document.getElementById('prDraftChk').checked,
                provider: providerOverride || undefined
              });
              window.open(created.webUrl, '_blank', 'noopener,noreferrer');
              showToast(created.createdViaApi ? T('PR / MR 创建成功！', 'PR / MR created!') : T('已在浏览器打开预填创建页', 'Opened pre-filled PR creation page'), 'info');
              if (created.createdViaApi) {
                activeView = 'list';
                load();
              }
            } catch (err) {
              showToast(err.message, 'error');
            } finally {
              btn.disabled = false;
            }
          });
        }
      } catch (err) {
        ui.bodyEl.innerHTML = `<div class="browser-empty-state error-text">${escapeHtml(err.message)}</div>`;
      }
    };

    await load();
  }

  /* ==================== 8. AI Pre-Commit / Commit Code Review ==================== */
  async function openAiCodeReviewModal(repoArg, initialScope) {
    const repo = repoArg || requireActiveRepo();
    if (!repo) return;
    let scope = initialScope || 'all';

    const ui = openFeatureModal({
      title: T('AI 提交前代码审查 (AI Code Review)', 'AI Pre-Commit Code Review'),
      badge: parseRepoDisplay(repo).name,
      icon: ICONS.shield,
      width: 'min(840px, 94vw)',
      bodyHtml: `
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <select id="aiRevScope" style="max-width:220px;">
            <option value="all" ${scope === 'all' ? 'selected' : ''}>${escapeHtml(T('全部工作区更改 (HEAD)', 'All Working Tree Changes'))}</option>
            <option value="staged" ${scope === 'staged' ? 'selected' : ''}>${escapeHtml(T('仅已暂存更改 (Staged)', 'Staged Changes Only'))}</option>
            <option value="unstaged" ${scope === 'unstaged' ? 'selected' : ''}>${escapeHtml(T('仅未暂存更改 (Unstaged)', 'Unstaged Changes Only'))}</option>
            <option value="commit" ${scope === 'commit' ? 'selected' : ''}>${escapeHtml(T('指定提交哈希 (Commit)', 'Specific Commit Hash'))}</option>
          </select>
          <input type="text" id="aiRevCommitHash" class="${scope === 'commit' ? '' : 'hidden'}" placeholder="Commit SHA / HEAD" style="max-width:200px;" value="HEAD" />
          <button type="button" id="btnRunAiReview" class="mini-btn primary">${ICONS.sparkle}<span>${escapeHtml(T('开始 AI 审查', 'Run AI Review'))}</span></button>
        </div>
        <div id="aiRevResults"><div class="scm-empty">${escapeHtml(T('点击「开始 AI 审查」扫描潜在 Bug、安全漏洞与性能问题。', 'Click "Run AI Review" to scan for bugs, security risks, and regressions.'))}</div></div>
      `
    });

    const scopeSel = document.getElementById('aiRevScope');
    const hashInput = document.getElementById('aiRevCommitHash');
    scopeSel.addEventListener('change', () => {
      scope = scopeSel.value;
      hashInput.classList.toggle('hidden', scope !== 'commit');
    });

    const run = async () => {
      const btn = document.getElementById('btnRunAiReview');
      const resBox = document.getElementById('aiRevResults');
      btn.disabled = true;
      resBox.innerHTML = `<div class="browser-empty-state"><span class="fb-spinner"></span>${escapeHtml(T('AI 正在深入审查代码差异…', 'AI is reviewing the code diff…'))}</div>`;
      try {
        const res = await rpc('ai:reviewChanges', {
          repo,
          scope: scopeSel.value,
          commitHash: hashInput.value.trim(),
          lang: state.lang
        });
        resBox.innerHTML = `
          <div class="feature-card"><strong>${escapeHtml(T('总体评估：', 'Summary: '))}</strong><span>${escapeHtml(res.summary || T('未发现明显问题。', 'No major issues detected.'))}</span></div>
          ${(res.findings || []).length === 0
            ? `<div class="scm-empty">${escapeHtml(T('✓ 未发现高风险问题。', '✓ No actionable issues found.'))}</div>`
            : `<div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">
                ${res.findings.map((f) => `
                  <div class="feature-card">
                    <div class="feature-card-top">
                      <div style="display:flex;align-items:center;gap:8px;">
                        <span class="sev-badge sev-${escapeHtml(f.severity)}">${escapeHtml(f.severity)}</span>
                        <strong>${escapeHtml(f.title)}</strong>
                      </div>
                      ${f.file ? `<button type="button" class="mini-btn act-rev-open" data-file="${escapeHtml(f.file)}" data-line="${f.line || 1}">${escapeHtml(f.file)}${f.line ? ':' + f.line : ''}</button>` : ''}
                    </div>
                    <div style="font-size:12px;line-height:1.5;">${escapeHtml(f.detail)}</div>
                    ${f.suggestion ? `<pre class="logs-pre" style="max-height:140px;">${escapeHtml(f.suggestion)}</pre>` : ''}
                  </div>
                `).join('')}
              </div>`
          }
        `;
        resBox.querySelectorAll('.act-rev-open').forEach((b) => {
          b.addEventListener('click', () => {
            const fp = b.getAttribute('data-file');
            const ln = Number(b.getAttribute('data-line')) || 1;
            ui.close();
            openFileTab({
              repo,
              filePath: fp,
              commit: scopeSel.value === 'commit' ? hashInput.value.trim() : null,
              title: fp.split('/').pop(),
              lines: { start: ln, end: ln }
            });
          });
        });
      } catch (err) {
        resBox.innerHTML = `<div class="feature-card error-text">${escapeHtml(err.message)}</div>`;
      } finally {
        btn.disabled = false;
      }
    };

    document.getElementById('btnRunAiReview').addEventListener('click', run);
    if (initialScope) run();
  }

  /* ==================== 9. AI Release Notes & Natural-Language Commit Search ==================== */
  async function openReleaseNotesModal() {
    const repo = requireActiveRepo();
    if (!repo) return;
    const refs = await rpc('git:refs', { repo }).catch(() => ({ branches: [], tags: [] }));
    const allRefs = [...(refs.tags || []), ...(refs.branches || [])];
    const defaultFrom = (refs.tags && refs.tags[0]) ? refs.tags[0] : 'HEAD~20';

    const ui = openFeatureModal({
      title: T('AI 生成版本发布说明 (Release Notes / Changelog)', 'AI Release Notes & Changelog Generator'),
      badge: parseRepoDisplay(repo).name,
      icon: ICONS.sparkle,
      width: 'min(820px, 94vw)',
      bodyHtml: `
        <div class="form-row-2" style="align-items:flex-end;">
          <label><span>${escapeHtml(T('起始 Tag / 分支 (From)', 'From Tag / Ref'))}</span>
            <input type="text" id="rnFromRef" value="${escapeHtml(defaultFrom)}" list="rnRefOptions" placeholder="v1.0.0" />
          </label>
          <label><span>${escapeHtml(T('目标 Tag / 分支 (To)', 'To Tag / Ref'))}</span>
            <input type="text" id="rnToRef" value="HEAD" list="rnRefOptions" placeholder="HEAD" />
          </label>
          <button type="button" id="btnRnGenerate" class="mini-btn primary">${ICONS.sparkle}<span>${escapeHtml(T('生成发布说明', 'Generate'))}</span></button>
        </div>
        <datalist id="rnRefOptions">${allRefs.map((r) => `<option value="${escapeHtml(r)}"></option>`).join('')}</datalist>
        <textarea id="rnOutput" class="scm-commit-textarea" style="min-height:280px;" placeholder="${escapeHtml(T('生成的 Markdown Changelog 将显示在这里…', 'Generated Markdown release notes will appear here…'))}"></textarea>
      `,
      footerHtml: `
        <button type="button" id="btnRnCopy" class="mini-btn">${ICONS.copy}<span>${escapeHtml(T('复制 Markdown', 'Copy Markdown'))}</span></button>
        <button type="button" class="mini-btn primary act-fm-close">${escapeHtml(T('完成', 'Done'))}</button>
      `
    });

    document.getElementById('btnRnGenerate').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        const res = await rpc('ai:releaseNotes', {
          repo,
          fromRef: document.getElementById('rnFromRef').value.trim(),
          toRef: document.getElementById('rnToRef').value.trim() || 'HEAD',
          lang: state.lang
        });
        document.getElementById('rnOutput').value = res.markdown;
        showToast(T(`已汇总 ${res.commitCount} 个提交${res.usedAi ? ' (AI 生成)' : ''}`, `Summarized ${res.commitCount} commits`), 'info');
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('btnRnCopy').addEventListener('click', () => {
      const val = document.getElementById('rnOutput').value;
      if (!val) return;
      navigator.clipboard?.writeText(val).catch(() => {});
      showToast(T('已复制 Release Notes', 'Release notes copied'), 'status');
    });
  }

  function openNlSearchModal() {
    const repo = requireActiveRepo();
    if (!repo) return;
    const ui = openFeatureModal({
      title: T('AI 自然语言搜索提交历史', 'Natural-Language Git History Search'),
      badge: parseRepoDisplay(repo).name,
      icon: ICONS.search,
      width: 'min(820px, 94vw)',
      bodyHtml: `
        <form id="nlSearchForm" style="display:flex;gap:8px;">
          <input type="text" id="nlSearchQuery" style="flex:1;" placeholder="${escapeHtml(T('例如：谁改过 SSH 超时逻辑 / 最近两周修复内存泄漏的提交 / auth token', 'e.g. commits touching ssh timeout / memory leak fixes by Andy last month'))}" />
          <button type="submit" class="mini-btn primary">${ICONS.search}<span>${escapeHtml(T('智能检索', 'Search'))}</span></button>
        </form>
        <div id="nlSearchResults"><div class="scm-empty">${escapeHtml(T('支持自然语言描述、函数/变量名（git log -S）及路径组合检索。', 'Searches commit messages, code pickaxe (-S), authors, dates, and paths.'))}</div></div>
      `
    });

    const input = document.getElementById('nlSearchQuery');
    setTimeout(() => input.focus(), 30);

    document.getElementById('nlSearchForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (!q) return;
      const box = document.getElementById('nlSearchResults');
      box.innerHTML = `<div class="browser-empty-state"><span class="fb-spinner"></span>Searching…</div>`;
      try {
        const res = await rpc('git:nlSearch', { repo, query: q });
        if (!res.commits || res.commits.length === 0) {
          box.innerHTML = `<div class="scm-empty">${escapeHtml(T('未找到匹配的提交（过滤条件：', 'No matching commits (') + res.filterSummary + ')')}</div>`;
          return;
        }
        box.innerHTML = `
          <p class="settings-hint" style="margin:0 0 6px;">${escapeHtml((res.usedAi ? '✨ AI Filter: ' : 'Filter: ') + res.filterSummary)}</p>
          <div style="display:flex;flex-direction:column;gap:5px;">
            ${res.commits.map((c) => `
              <div class="feature-card act-nl-jump" data-hash="${escapeHtml(c.hash)}" style="cursor:pointer;padding:7px 10px;">
                <div class="feature-card-top">
                  <span style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><code>${escapeHtml(c.shortHash)}</code> · ${escapeHtml(c.subject)}</span>
                  <span style="font-size:11px;color:var(--vscode-descriptionForeground);white-space:nowrap;">${escapeHtml(c.author)} · ${c.date ? new Date(c.date * 1000).toISOString().slice(0, 10) : ''}</span>
                </div>
              </div>
            `).join('')}
          </div>
        `;
        box.querySelectorAll('.act-nl-jump').forEach((card) => {
          card.addEventListener('click', () => {
            const h = card.getAttribute('data-hash');
            ui.close();
            activateTab('graph');
            sendWs({
              type: 'graph:request',
              payload: { command: 'commitDetails', repo, commitHash: h, hasParents: true, stash: null, avatarEmail: null, refresh: false }
            });
          });
        });
      } catch (err) {
        box.innerHTML = `<div class="feature-card error-text">${escapeHtml(err.message)}</div>`;
      }
    });
  }

  /* ==================== 10. SSH Local Port Forwarding (-L) Manager ==================== */
  async function openPortForwardModal(defaultHostId) {
    const hosts = (state.sshHosts || []).filter((h) => !/(github\.com|gitlab\.com|bitbucket\.org|gitee\.com)/i.test(h.host || ''));
    const preHost = defaultHostId || (state.activeRepo && state.activeRepo.startsWith('ssh://') ? parseRepoDisplay(state.activeRepo).hostId : (hosts[0]?.id || ''));

    const ui = openFeatureModal({
      title: T('SSH 本地端口转发 (-L Port Forwarding)', 'SSH Local Port Forwarding (-L)'),
      icon: ICONS.plug,
      width: 'min(780px, 94vw)',
      bodyHtml: `<div class="browser-empty-state"><span class="fb-spinner"></span>Loading tunnels…</div>`
    });

    const render = async () => {
      try {
        const res = await rpc('ssh:listTunnels');
        const tunnels = res.tunnels || [];
        ui.bodyEl.innerHTML = `
          ${hosts.length === 0 ? `<div class="scm-empty">${escapeHtml(T('尚未配置任何 SSH 主机，请先在 Remote - SSH 中添加服务器。', 'No SSH servers configured yet. Add one in Remote - SSH first.'))}</div>` : `
            <form id="pfAddForm" class="feature-card">
              <strong style="font-size:12.5px;">${escapeHtml(T('+ 新建端口转发（本机端口 → 远程服务器端口）', '+ New Local Port Forward (Local → Remote)'))}</strong>
              <div class="form-row-2">
                <label><span>SSH Server</span>
                  <select id="pfHost">${hosts.map((h) => `<option value="${escapeHtml(h.id)}" ${h.id === preHost ? 'selected' : ''}>${escapeHtml(hostLabel(h.id))} (${escapeHtml(hostAddress(h))})</option>`).join('')}</select>
                </label>
                <label><span>${escapeHtml(T('备注名称 (可选)', 'Label (Optional)'))}</span>
                  <input type="text" id="pfLabel" placeholder="Jupyter / Web / Postgres" />
                </label>
              </div>
              <div class="form-row-2" style="align-items:flex-end;">
                <label><span>${escapeHtml(T('本机监听端口 (Local Port)', 'Local Port'))}</span>
                  <input type="number" id="pfLocalPort" min="1" max="65535" value="8080" required />
                </label>
                <label><span>${escapeHtml(T('远程目标地址', 'Remote Target Host'))}</span>
                  <input type="text" id="pfRemoteHost" value="127.0.0.1" required />
                </label>
                <label><span>${escapeHtml(T('远程目标端口', 'Remote Port'))}</span>
                  <input type="number" id="pfRemotePort" min="1" max="65535" value="8080" required />
                </label>
                <button type="submit" class="mini-btn primary">${ICONS.plug}<span>${escapeHtml(T('开启转发', 'Start'))}</span></button>
              </div>
            </form>
          `}
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${tunnels.length === 0
              ? `<div class="scm-empty">${escapeHtml(T('当前暂无运行中的 SSH 端口转发。', 'No active SSH port forwards.'))}</div>`
              : tunnels.map((t) => `
                  <div class="feature-card">
                    <div class="feature-card-top">
                      <div style="display:flex;align-items:center;gap:8px;">
                        <i class="status-dot connected"></i>
                        <strong>127.0.0.1:${t.localPort}</strong>
                        <span>→</span>
                        <code>${escapeHtml(hostLabel(t.hostId))} (${escapeHtml(t.remoteHost)}:${t.remotePort})</code>
                        ${t.label ? `<span class="branch-pill">${escapeHtml(t.label)}</span>` : ''}
                      </div>
                      <div style="display:inline-flex;gap:6px;align-items:center;">
                        <span style="font-size:11px;color:var(--vscode-descriptionForeground);">${t.activeConnections} conn</span>
                        <button type="button" class="mini-btn act-pf-open" data-port="${t.localPort}">↗ HTTP</button>
                        <button type="button" class="mini-icon-btn danger act-pf-stop" data-id="${escapeHtml(t.id)}" title="Stop">${ICONS.close}</button>
                      </div>
                    </div>
                  </div>
                `).join('')
            }
          </div>
        `;

        document.getElementById('pfAddForm')?.addEventListener('submit', async (e) => {
          e.preventDefault();
          try {
            await rpc('ssh:startTunnel', {
              hostId: document.getElementById('pfHost').value,
              localPort: Number(document.getElementById('pfLocalPort').value),
              remoteHost: document.getElementById('pfRemoteHost').value.trim() || '127.0.0.1',
              remotePort: Number(document.getElementById('pfRemotePort').value),
              label: document.getElementById('pfLabel').value.trim()
            });
            showToast(T('端口转发已开启', 'SSH port forward started'), 'info');
            await render();
          } catch (err) {
            showToast(err.message, 'error');
          }
        });

        ui.bodyEl.querySelectorAll('.act-pf-open').forEach((b) => {
          b.addEventListener('click', () => window.open(`http://127.0.0.1:${b.getAttribute('data-port')}`, '_blank', 'noopener,noreferrer'));
        });
        ui.bodyEl.querySelectorAll('.act-pf-stop').forEach((b) => {
          b.addEventListener('click', async () => {
            await rpc('ssh:stopTunnel', { id: b.getAttribute('data-id') });
            await render();
          });
        });
      } catch (err) {
        ui.bodyEl.innerHTML = `<div class="browser-empty-state error-text">${escapeHtml(err.message)}</div>`;
      }
    };

    await render();
  }

  /* ==================== 11. Git Reflog Timeline & Visual Git Bisect Wizard ==================== */
  async function openReflogModal() {
    const repo = requireActiveRepo();
    if (!repo) return;
    const ui = openFeatureModal({
      title: T('Git Reflog 操作时间线（误操作恢复）', 'Git Reflog Timeline (Recovery)'),
      badge: parseRepoDisplay(repo).name,
      icon: ICONS.history,
      width: 'min(860px, 94vw)',
      bodyHtml: `<div class="browser-empty-state"><span class="fb-spinner"></span>Loading reflog…</div>`
    });

    try {
      const res = await rpc('reflog:list', { repo, limit: 150 });
      const entries = res.entries || [];
      ui.bodyEl.innerHTML = `
        <input type="text" id="reflogFilterInput" placeholder="${escapeHtml(T('筛选 reflog（如 reset、rebase、checkout、分支名或哈希）…', 'Filter reflog by action, message, or hash…'))}" />
        <div id="reflogListContainer" style="display:flex;flex-direction:column;gap:6px;"></div>
      `;
      const listBox = document.getElementById('reflogListContainer');
      const filterInput = document.getElementById('reflogFilterInput');

      const draw = () => {
        const q = filterInput.value.trim().toLowerCase();
        const shown = q ? entries.filter((e) => `${e.shortHash} ${e.selector} ${e.action} ${e.subject}`.toLowerCase().includes(q)) : entries;
        if (shown.length === 0) {
          listBox.innerHTML = `<div class="scm-empty">${escapeHtml(T('没有匹配的 Reflog 记录', 'No matching reflog entries'))}</div>`;
          return;
        }
        listBox.innerHTML = shown.map((e) => `
          <div class="feature-card" style="padding:7px 10px;">
            <div class="feature-card-top">
              <div style="display:flex;align-items:center;gap:7px;min-width:0;">
                <code>${escapeHtml(e.shortHash)}</code>
                <span class="scm-status-badge">${escapeHtml(e.selector)}</span>
                <span class="branch-pill">${escapeHtml(e.action)}</span>
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500;">${escapeHtml(e.subject)}</span>
              </div>
              <div style="display:inline-flex;align-items:center;gap:6px;flex-shrink:0;">
                <span style="font-size:11px;color:var(--vscode-descriptionForeground);">${e.timestamp ? new Date(e.timestamp * 1000).toLocaleString() : ''}</span>
                <button type="button" class="mini-btn act-rf-checkout" data-hash="${escapeHtml(e.hash)}">${escapeHtml(T('检出此状态', 'Checkout'))}</button>
              </div>
            </div>
          </div>
        `).join('');

        listBox.querySelectorAll('.act-rf-checkout').forEach((b) => {
          b.addEventListener('click', async () => {
            const h = b.getAttribute('data-hash');
            const ok = await confirmDialog(
              T('检出历史状态', 'Checkout Reflog Commit'),
              T(`将工作区检出到 ${h.slice(0, 10)}（分离头指针状态，之后可在图谱中新建分支恢复）？`, `Checkout ${h.slice(0, 10)} (detached HEAD — you can create a branch on it to recover)?`),
              T('检出', 'Checkout'),
              false
            );
            if (!ok) return;
            try {
              await rpc('git:checkout', { repo, ref: h });
              showToast(T('已检出至历史提交 ' + h.slice(0, 8), 'Checked out ' + h.slice(0, 8)), 'info');
              ui.close();
              activateTab('graph');
              refreshAllStatusesAndContext();
            } catch (err) {
              showToast(err.message, 'error');
            }
          });
        });
      };

      filterInput.addEventListener('input', draw);
      draw();
    } catch (err) {
      ui.bodyEl.innerHTML = `<div class="browser-empty-state error-text">${escapeHtml(err.message)}</div>`;
    }
  }

  async function openBisectModal() {
    const repo = requireActiveRepo();
    if (!repo) return;
    const ui = openFeatureModal({
      title: T('可视化 Git Bisect 二分排错向导', 'Visual Git Bisect Wizard'),
      badge: parseRepoDisplay(repo).name,
      icon: ICONS.compass,
      width: 'min(740px, 94vw)',
      bodyHtml: `<div class="browser-empty-state"><span class="fb-spinner"></span>Loading bisect state…</div>`
    });

    const render = async () => {
      try {
        const [st, refs] = await Promise.all([rpc('bisect:status', { repo }), rpc('git:refs', { repo })]);
        if (!st.active) {
          const allRefs = [...(refs.tags || []), ...(refs.branches || [])];
          ui.bodyEl.innerHTML = `
            <p class="settings-hint" style="margin:0;">${escapeHtml(T('指定一个已知「有问题 (Bad)」的提交（通常为 HEAD）和一个早期「正常 (Good)」的 Tag 或提交哈希，Git 会自动折半检出中间版本供你验证。', 'Pick a known "Bad" commit (usually HEAD) and an older known "Good" tag/commit. Git checks out the midpoint at each step until the exact offending commit is found.'))}</p>
            <form id="bisectStartForm" class="feature-card">
              <div class="form-row-2">
                <label><span>${escapeHtml(T('有问题的版本 (Bad Commit / Ref)', 'Bad Commit / Ref'))}</span>
                  <input type="text" id="bsBadRef" value="HEAD" required list="bsRefList" />
                </label>
                <label><span>${escapeHtml(T('正常的旧版本 (Good Tag / Commit)', 'Good Tag / Commit'))}</span>
                  <input type="text" id="bsGoodRef" placeholder="${escapeHtml(refs.tags?.[0] || 'HEAD~20')}" required list="bsRefList" />
                </label>
              </div>
              <datalist id="bsRefList">${allRefs.map((r) => `<option value="${escapeHtml(r)}"></option>`).join('')}</datalist>
              <div style="display:flex;justify-content:flex-end;">
                <button type="submit" class="mini-btn primary">${ICONS.compass}<span>${escapeHtml(T('开始二分排错', 'Start Bisect'))}</span></button>
              </div>
            </form>
          `;
          document.getElementById('bisectStartForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
              await rpc('bisect:start', {
                repo,
                badRef: document.getElementById('bsBadRef').value.trim(),
                goodRef: document.getElementById('bsGoodRef').value.trim()
              });
              await refreshAllStatusesAndContext();
              await render();
            } catch (err) {
              showToast(err.message, 'error');
            }
          });
          return;
        }

        ui.bodyEl.innerHTML = `
          <div class="feature-card">
            ${st.culpritHash
              ? `<div class="error-text" style="font-weight:700;">🎯 ${escapeHtml(T('已成功定位引入问题的首个提交：', 'First bad commit identified: '))}<code>${escapeHtml(st.culpritHash)}</code></div>`
              : `<div><strong>${escapeHtml(T('当前待测试版本：', 'Current commit to test: '))}</strong><code>${escapeHtml(st.currentHash || '')}</code> — ${escapeHtml(st.currentSubject || '')}</div>`}
            <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;">
              ${!st.culpritHash ? `
                <button type="button" class="mini-btn primary act-bs-step" data-v="good">${escapeHtml(T('✓ 当前版本正常 (Good)', '✓ Mark Good'))}</button>
                <button type="button" class="mini-btn danger-solid act-bs-step" data-v="bad">${escapeHtml(T('✗ 当前版本有问题 (Bad)', '✗ Mark Bad'))}</button>
                <button type="button" class="mini-btn act-bs-step" data-v="skip">${escapeHtml(T('无法测试 / 跳过 (Skip)', 'Skip'))}</button>
              ` : ''}
              <button type="button" class="mini-btn act-bs-reset">${escapeHtml(T('结束二分并恢复原分支', 'Finish & Reset Bisect'))}</button>
            </div>
          </div>
          <pre class="logs-pre">${escapeHtml((st.logLines || []).join('\n') || 'git bisect start')}</pre>
        `;

        ui.bodyEl.querySelectorAll('.act-bs-step').forEach((b) => {
          b.addEventListener('click', async () => {
            try {
              await rpc('bisect:step', { repo, verdict: b.getAttribute('data-v') });
              await refreshAllStatusesAndContext();
              await render();
            } catch (err) {
              showToast(err.message, 'error');
            }
          });
        });
        ui.bodyEl.querySelector('.act-bs-reset').addEventListener('click', async () => {
          await rpc('bisect:reset', { repo });
          await refreshAllStatusesAndContext();
          ui.close();
        });
      } catch (err) {
        ui.bodyEl.innerHTML = `<div class="browser-empty-state error-text">${escapeHtml(err.message)}</div>`;
      }
    };

    await render();
  }

  /* ==================== 7. TopBar Tools Menu & Global Command Palette (Cmd/Ctrl+P) ==================== */
  function buildCoreCommands() {
    return [
      { id: 'repo-files', icon: ICONS.folderOpen, title: T('浏览与管理仓库文件 (Repo Files)', 'Browse & Manage Repository Files'), sub: T('支持多级文件夹树展开，新建/删除/重命名/上传/下载仓库文件', 'Expandable folder tree; create, rename, delete, upload, and download files'), kbd: '⌘E', run: () => App.openRepoFilesTab?.(false) },
      { id: 'layout-split-lr', icon: ICONS.splitHorizontal, title: T('分栏视图：左右分栏（左提交历史 · 右仓库文件）', 'Split View: Left History · Right Repo Files'), sub: T('同时显示 Git 提交历史图谱与仓库文件树', 'Show Commit History and Repo File Explorer side by side'), kbd: '⌘\\', run: () => App.setWorkspaceLayout?.('split-lr') },
      { id: 'layout-split-rl', icon: ICONS.splitHorizontal, title: T('分栏视图：左右分栏（左仓库文件 · 右提交历史）', 'Split View: Left Repo Files · Right History'), sub: T('经典 IDE 布局：左侧文件树 + 右侧提交图谱', 'IDE layout: Repo File Explorer on the left, Commit History on the right'), run: () => App.setWorkspaceLayout?.('split-rl') },
      { id: 'layout-split-tb', icon: ICONS.splitVertical, title: T('分栏视图：上下分栏（上提交历史 · 下仓库文件）', 'Split View: Top History · Bottom Repo Files'), sub: T('上方显示提交历史图谱，下方显示仓库文件与内联预览', 'Show Commit History on top and Repo File Explorer below'), kbd: '⇧⌘\\', run: () => App.setWorkspaceLayout?.('split-tb') },
      { id: 'layout-split-bt', icon: ICONS.splitVertical, title: T('分栏视图：上下分栏（上仓库文件 · 下提交历史）', 'Split View: Top Repo Files · Bottom History'), sub: T('上方显示仓库文件与内联预览，下方显示提交历史图谱', 'Show Repo File Explorer on top and Commit History below'), run: () => App.setWorkspaceLayout?.('split-bt') },
      { id: 'layout-swap', icon: ICONS.swapPanes, title: T('对调当前分栏位置（左⇄右 / 上⇄下）', 'Swap Split Panes (Left⇄Right / Top⇄Bottom)'), sub: '', run: () => App.swapWorkspaceSplitPanes?.() },
      { id: 'layout-tabs', icon: ICONS.layoutTabs, title: T('切换回单栏标签页模式', 'Switch to Single-Pane Tabs Mode'), sub: '', run: () => App.setWorkspaceLayout?.('tabs') },
      { id: 'scm', icon: ICONS.commit, title: T('暂存与提交更改 (Stage & Commit)', 'Stage & Commit Working Tree'), sub: T('按文件、代码块或代码行暂存 / 丢弃 / 提交', 'Stage files, hunks, or lines and commit'), kbd: '⇧⌘G', run: () => openScmModal() },
      { id: 'rebase', icon: ICONS.merge, title: T('可视化交互式变基 (Interactive Rebase)', 'Visual Interactive Rebase'), sub: T('拖拽排序提交、Pick / Reword / Squash / Fixup / Drop', 'Reorder, reword, squash, fixup, or drop commits'), run: () => openInteractiveRebaseModal() },
      { id: 'worktrees', icon: ICONS.layers, title: T('Git Worktree 多工作树管理', 'Manage Git Worktrees'), sub: T('并行检出多个分支供多任务 / 多 Agent 同时开发', 'Checkout multiple branches simultaneously in parallel folders'), run: () => openWorktreesModal() },
      { id: 'prs', icon: ICONS.pullRequest, title: T('Pull Requests / Merge Requests 协作', 'Pull Requests & Merge Requests'), sub: T('查看 PR 与 CI 状态、检出分支、AI 生成并发起 PR', 'View PRs & CI checks, checkout PR branch, or create PR with AI'), run: () => openPullRequestsModal() },
      { id: 'ai-review', icon: ICONS.shield, title: T('AI 提交前代码审查 (AI Code Review)', 'AI Pre-Commit Code Review'), sub: T('使用当前 AI 模型扫描 Bug、安全漏洞与性能问题', 'Scan staged or working-tree diff for bugs and security risks'), run: () => openAiCodeReviewModal() },
      { id: 'release-notes', icon: ICONS.sparkle, title: T('AI 生成版本发布说明 (Release Notes)', 'AI Generate Release Notes / Changelog'), sub: T('汇总两个 Tag 或分支之间的变更为结构化 Changelog', 'Summarize commits between two tags/refs into Markdown'), run: () => openReleaseNotesModal() },
      { id: 'nl-search', icon: ICONS.search, title: T('AI 自然语言搜索提交历史', 'Natural-Language Git Commit Search'), sub: T('用自然语言或代码标识符查找历史提交', 'Search commits by natural language, code pickaxe (-S), or author'), run: () => openNlSearchModal() },
      { id: 'reflog', icon: ICONS.history, title: T('Git Reflog 操作时间线（后悔药）', 'Git Reflog Recovery Timeline'), sub: T('找回误 reset / 误删分支的历史状态', 'Recover lost commits after reset or rebase'), run: () => openReflogModal() },
      { id: 'bisect', icon: ICONS.compass, title: T('可视化 Git Bisect 二分排错', 'Visual Git Bisect Wizard'), sub: T('折半定位引入 Bug 的首个提交', 'Binary-search commit history to find the first bad commit'), run: () => openBisectModal() },
      { id: 'port-forward', icon: ICONS.plug, title: T('SSH 本地端口转发 (-L Port Forwarding)', 'SSH Local Port Forwarding (-L)'), sub: T('将远程服务器端口映射到本机 127.0.0.1', 'Forward local ports to remote SSH services'), run: () => openPortForwardModal() },
      { id: 'fetch-all', icon: ICONS.refresh, title: T('批量同步所有仓库 (Fetch All)', 'Fetch All Repositories'), sub: T('并发拉取全部本地与已连接 SSH 仓库的远程更新', 'Run git fetch --all --prune across all repositories'), run: () => fetchAllRepos() },
      { id: 'clone', icon: ICONS.download, title: T('克隆仓库到本地或远程 SSH (Clone)', 'Clone Repository (Local or SSH)'), sub: T('从 Git URL 克隆并自动打开图谱', 'Clone a repository to local disk or an SSH host'), run: () => openCloneModal() },
      { id: 'add-local', icon: ICONS.folder, title: T('添加本地仓库', 'Add Local Repository'), sub: '', kbd: '⌘O', run: () => openLocalModal() },
      { id: 'remote-ssh', icon: ICONS.remote, title: T('Remote - SSH 远程目录与 SFTP 传输', 'Remote - SSH Browser & SFTP'), sub: '', kbd: '⇧⌘O', run: () => openSshModal() },
      { id: 'term', icon: ICONS.terminal, title: T('切换内置终端面板', 'Toggle Integrated Terminal'), sub: '', kbd: '⌃`', run: () => toggleTerminalDrawer() },
      { id: 'ext-term', icon: ICONS.externalTerminal, title: T('在外部终端中打开当前仓库', 'Open Current Repo in External Terminal'), sub: '', run: () => openExternalTerminal(state.activeRepo || state.homeDir) },
      { id: 'ext-editor', icon: ICONS.editor, title: T('在外部代码编辑器中打开当前仓库', 'Open Current Repo in Code Editor'), sub: '', run: () => openInEditor(state.activeRepo) },
      { id: 'theme', icon: ICONS.sun, title: T('切换深色 / 浅色主题', 'Toggle Dark / Light Theme'), sub: '', run: () => applyTheme(state.theme === 'dark' ? 'light' : 'dark') },
      {
        id: 'icon-brightness',
        icon: ICONS.sun,
        title: T('切换应用图标亮暗（跟随主题 / 深色 / 浅色）', 'Cycle App Icon Brightness (Auto / Dark / Light)'),
        sub: T(`当前：${state.iconTheme}`, `Current: ${state.iconTheme}`),
        run: () => {
          const order = ['auto', 'dark', 'light'];
          const next = order[(order.indexOf(state.iconTheme) + 1) % order.length];
          App.setAppIconPrefs?.(state.iconStyle, next, true);
          showToast(T(`图标亮暗已切换为：${next === 'auto' ? '跟随主题' : next === 'dark' ? '深色' : '浅色'}`, `Icon brightness: ${next}`), 'info');
        }
      },
      ...(App.APP_ICON_STYLES || []).map((st) => ({
        id: 'icon-style:' + st.id,
        icon: ICONS.sparkle,
        title: T(`切换应用图标款式：${st.zh}`, `Switch App Icon Style: ${st.en}`),
        sub: T(st.subZh, st.subEn),
        kbd: state.iconStyle === st.id ? 'Active' : '',
        run: () => {
          App.setAppIconPrefs?.(st.id, state.iconTheme, true);
          showToast(T(`已切换应用图标：${st.zh}`, `App icon switched to ${st.en}`), 'info');
        }
      })),
      { id: 'logs', icon: ICONS.terminal, title: T('查看诊断日志 (Diagnostic Logs)', 'View Diagnostic Logs'), sub: '', run: () => openLogsModal() },
      { id: 'settings', icon: ICONS.settings, title: T('打开全局与 AI 设置', 'Open Settings'), sub: '', kbd: '⌘,', run: () => openAppSettingsModal() }
    ];
  }

  function renderToolsPopover() {
    const pop = document.getElementById('toolsPopover');
    const item = (id, icon, label, kbd) =>
      `<button type="button" class="tools-item" data-cmd="${id}"><span class="icon-slot">${icon}</span><span>${escapeHtml(label)}</span>${kbd ? `<kbd>${kbd}</kbd>` : ''}</button>`;

    pop.innerHTML = `
      <div class="tools-group-title">${escapeHtml(T('Git 进阶工作流', 'Git Workflows'))}</div>
      ${item('rebase', ICONS.merge, T('可视化交互式变基', 'Interactive Rebase'))}
      ${item('worktrees', ICONS.layers, T('Git Worktree 多工作树', 'Git Worktrees'))}
      ${item('prs', ICONS.pullRequest, T('PR / MR 状态与创建', 'Pull / Merge Requests'))}
      ${item('reflog', ICONS.history, T('Reflog 误操作恢复', 'Reflog Timeline'))}
      ${item('bisect', ICONS.compass, T('Bisect 二分排错向导', 'Bisect Wizard'))}
      <div class="tools-sep"></div>
      <div class="tools-group-title">${escapeHtml(T('AI 研发助手', 'AI Assistant'))}</div>
      ${item('ai-review', ICONS.shield, T('AI 提交前代码审查', 'AI Code Review'))}
      ${item('release-notes', ICONS.sparkle, T('AI 生成版本发布说明', 'AI Release Notes'))}
      ${item('nl-search', ICONS.search, T('AI 自然语言搜提交', 'NL Commit Search'))}
      <div class="tools-sep"></div>
      <div class="tools-group-title">${escapeHtml(T('远程与多仓库', 'Remote & Multi-Repo'))}</div>
      ${item('port-forward', ICONS.plug, T('SSH 本地端口转发 (-L)', 'SSH Port Forwarding'))}
      ${item('fetch-all', ICONS.refresh, T('批量 Fetch 全部仓库', 'Fetch All Repos'))}
      ${item('clone', ICONS.download, T('克隆 Git 仓库…', 'Clone Repository…'))}
    `;

    const cmds = new Map(buildCoreCommands().map((c) => [c.id, c]));
    pop.querySelectorAll('.tools-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        pop.classList.add('hidden');
        const c = cmds.get(btn.getAttribute('data-cmd'));
        if (c) c.run();
      });
    });
  }

  async function openCommandPalette() {
    const modal = document.getElementById('commandPaletteModal');
    const input = document.getElementById('cmdPaletteInput');
    const listEl = document.getElementById('cmdPaletteList');
    input.placeholder = T('输入命令、切换仓库或检出分支…', 'Type a command, repository name, or branch…');
    input.value = '';
    modal.classList.remove('hidden');

    const items = [...buildCoreCommands()];

    // Add all registered repositories
    Object.keys(state.repos || {}).forEach((repoKey) => {
      const info = parseRepoDisplay(repoKey);
      items.push({
        id: 'repo:' + repoKey,
        icon: info.isRemote ? ICONS.remote : ICONS.gitRepo,
        title: T('切换仓库：', 'Switch Repo: ') + info.name,
        sub: info.fullDisplay,
        kbd: state.activeRepo === repoKey ? 'Active' : '',
        run: async () => {
          state.activeRepo = repoKey;
          renderSidebar();
          renderActiveRepoBadge();
          activateTab('graph');
          await rpc('repos:select', { repo: repoKey });
          refreshRepoContext();
        }
      });
    });

    let selectedIdx = 0;
    let filtered = items;

    const renderList = () => {
      const q = input.value.trim().toLowerCase();
      filtered = q
        ? items.filter((it) => `${it.title} ${it.sub || ''}`.toLowerCase().includes(q))
        : items;
      selectedIdx = Math.max(0, Math.min(selectedIdx, filtered.length - 1));
      if (filtered.length === 0) {
        listEl.innerHTML = `<div class="scm-empty">${escapeHtml(T('没有匹配的命令或仓库', 'No matching commands or repositories'))}</div>`;
        return;
      }
      listEl.innerHTML = filtered.slice(0, 60).map((it, idx) => `
        <div class="cmd-palette-item ${idx === selectedIdx ? 'selected' : ''}" data-idx="${idx}" role="option">
          <span class="icon-slot">${it.icon || ICONS.command}</span>
          <div class="cmd-palette-item-main">
            <span class="cmd-palette-item-title">${escapeHtml(it.title)}</span>
            ${it.sub ? `<span class="cmd-palette-item-sub">${escapeHtml(it.sub)}</span>` : ''}
          </div>
          ${it.kbd ? `<kbd>${escapeHtml(it.kbd)}</kbd>` : ''}
        </div>
      `).join('');

      listEl.querySelectorAll('.cmd-palette-item').forEach((el) => {
        el.addEventListener('click', () => {
          const chosen = filtered[Number(el.getAttribute('data-idx'))];
          modal.classList.add('hidden');
          if (chosen) chosen.run();
        });
      });
      listEl.querySelector('.cmd-palette-item.selected')?.scrollIntoView({ block: 'nearest' });
    };

    input.oninput = () => {
      selectedIdx = 0;
      renderList();
    };
    input.onkeydown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIdx = filtered.length ? (selectedIdx + 1) % Math.min(filtered.length, 60) : 0;
        renderList();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const max = Math.min(filtered.length, 60);
        selectedIdx = max ? (selectedIdx - 1 + max) % max : 0;
        renderList();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const chosen = filtered[selectedIdx];
        modal.classList.add('hidden');
        if (chosen) chosen.run();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        modal.classList.add('hidden');
      }
    };

    renderList();
    setTimeout(() => input.focus(), 20);

    // Asynchronously append branches of the active repository so user can checkout branches from Cmd+P too
    const paletteSeq = (modal.__cmdPaletteSeq = (modal.__cmdPaletteSeq || 0) + 1);
    if (state.activeRepo) {
      const targetRepo = state.activeRepo;
      rpc('git:refs', { repo: targetRepo }).then((refs) => {
        if (modal.classList.contains('hidden') || modal.__cmdPaletteSeq !== paletteSeq) return;
        (refs.branches || []).forEach((b) => {
          if (b.startsWith('remotes/')) return;
          items.push({
            id: 'branch:' + b,
            icon: ICONS.branch,
            title: T('检出分支：', 'Checkout Branch: ') + b,
            sub: parseRepoDisplay(targetRepo).name,
            kbd: refs.head === b ? 'HEAD' : '',
            run: async () => {
              try {
                await rpc('git:checkout', { repo: targetRepo, ref: b });
                showToast(T(`已切换到分支 ${b}`, `Switched to branch ${b}`), 'info');
                refreshAllStatusesAndContext();
              } catch (err) {
                showToast(err.message, 'error');
              }
            }
          });
        });
        renderList();
      }).catch(() => {});
    }
  }

  /* ==================== Wire Shell Buttons & Periodic Refresh ==================== */
  const btnTools = document.getElementById('btnToolsMenu');
  const toolsPopover = document.getElementById('toolsPopover');
  if (btnTools && toolsPopover) {
    btnTools.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = toolsPopover.classList.contains('hidden');
      if (willOpen) renderToolsPopover();
      toolsPopover.classList.toggle('hidden', !willOpen);
    });
    document.addEventListener('mousedown', (e) => {
      if (!toolsPopover.classList.contains('hidden') && !e.target.closest('.tools-menu-anchor')) {
        toolsPopover.classList.add('hidden');
      }
    });
  }

  document.getElementById('btnCommandPalette')?.addEventListener('click', () => openCommandPalette());
  document.getElementById('sidebarFetchAllBtn')?.addEventListener('click', () => fetchAllRepos());

  // Also inject a convenient Port Forwarding button right into the Remote - SSH modal header
  const sshHeaderGroup = document.querySelector('#sshModal .modal-title-group');
  if (sshHeaderGroup) {
    const pfBtn = document.createElement('button');
    pfBtn.type = 'button';
    pfBtn.className = 'mini-btn';
    pfBtn.style.marginLeft = '8px';
    pfBtn.innerHTML = `${ICONS.plug}<span>${escapeHtml(T('端口转发 (-L)', 'Port Forward (-L)'))}</span>`;
    pfBtn.addEventListener('click', () => openPortForwardModal(state.selectedSshHostId));
    sshHeaderGroup.appendChild(pfBtn);
  }

  // Rehydrate any new data-icon slots added in index.html
  document.querySelectorAll('[data-icon]').forEach((el) => {
    const name = el.getAttribute('data-icon');
    if (ICONS[name] && !el.innerHTML) el.innerHTML = ICONS[name];
  });

  // Periodic background status badge refresh when window is visible
  setInterval(() => {
    if (!document.hidden && Object.keys(state.repos || {}).length > 0) {
      refreshAllStatusesAndContext();
    }
  }, 25000);
  // Each refresh runs `git status` on every repo: switching windows back and forth shouldn't do that more than every 5 s
  let lastFocusRefresh = 0;
  window.addEventListener('focus', () => {
    if (Date.now() - lastFocusRefresh < 5000) return;
    lastFocusRefresh = Date.now();
    refreshAllStatusesAndContext();
  });

  window.GitMapFeatures = {
    // The one opener of the shared #featureModal: resets icon, badge, subtitle, width and footer,
    // and invalidates earlier modals' async callbacks (public/modules/*.js use it too)
    openFeatureModal,
    openCommandPalette,
    openHunkStagingModal,
    openConflictResolverTab,
    openInteractiveRebaseModal,
    openWorktreesModal,
    openPullRequestsModal,
    openAiCodeReviewModal,
    openReleaseNotesModal,
    openNlSearchModal,
    openPortForwardModal,
    openReflogModal,
    openBisectModal,
    fetchAllRepos,
    refreshRepoContext,
    refreshAllStatusesAndContext
  };
})();
