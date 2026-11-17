(function () {
  'use strict';

  /* ==================== I18N ==================== */
  const STRINGS = {
    zh: {
      addLocal: '本地仓库',
      remoteSsh: 'Remote - SSH',
      terminal: '终端',
      localRepos: '本地仓库',
      remoteRepos: '远程仓库 (SSH)',
      sshHosts: 'SSH 主机 (~/.ssh/config)',
      noLocalRepos: '暂无本地仓库，点击右上角 + 添加',
      noRemoteRepos: '暂无远程仓库，点击 + 浏览远程路径',
      noSshHosts: '未检测到 ~/.ssh/config 主机，可在 Remote - SSH 中新增',
      newRepoShell: '+ 当前仓库终端',
      openSysTerm: '↗ 系统终端',
      sshModalTitle: 'Remote - SSH 远程仓库路径浏览',
      sshServers: 'SSH 服务器',
      newHost: '新增主机',
      configureSshHost: '配置 SSH 连接',
      aliasName: '名称 / 别名',
      hostIp: '主机 / IP',
      port: '端口',
      username: '用户名',
      authMethod: '认证方式',
      privateKeyPath: '私钥路径 (可选)',
      passwordOpt: '密码 (可选，留空则在连接时询问)',
      defaultRemoteDir: '默认远程目录',
      cancel: '取消',
      saveAndBrowse: '保存并浏览路径',
      selectHostHint: '← 请在左侧选择一台 ~/.ssh/config 主机或新增 SSH 服务器，即可可视化浏览远程目录路径并打开 Git 仓库。',
      showHidden: '显示隐藏目录',
      scanSubfolders: '扫描子目录仓库',
      goPath: '跳转',
      openCurrentRepo: '打开此远程仓库',
      openCurrentLocalRepo: '添加并打开此仓库',
      localModalTitle: '添加本地 Git 仓库',
      osFolderPicker: '系统文件夹选择…',
      appSettingsTitle: 'GitMap 全局与 AI 设置',
      appearanceAndGraph: '界面与图形',
      displayLang: '界面语言',
      colourPreset: '图形配色预设',
      graphStyle: '连线样式',
      nodeStyle: '节点样式',
      aiSettingsHeader: 'AI 提交说明与提交解释',
      close: '关闭',
      saveSettings: '保存设置',
      openRepoBtn: '打开仓库',
      browsePathsBtn: '浏览路径',
      connecting: '正在连接 SSH 服务器…',
      scanning: '正在扫描子目录中的 Git 仓库…',
      addSelectedRepos: '添加选中的仓库',
      noReposScanned: '在当前目录及子目录中未发现 Git 仓库。',
      copiedPath: '已复制仓库路径：',
      sideBySide: '并排对比',
      inlineDiff: '行内对比',
      foldUnchanged: '折叠未变更行',
      viewFileRev: '查看此版本文件',
      fileHistoryGraph: '文件历史图谱',
      lineHistoryGraph: '选中行历史',
      visualHistory: '可视化文件演进',
      toggleBlame: 'Git Blame',
      expandLines: '展开 {0} 行未变更代码',
      binaryFileNotice: '二进制文件，无法直接显示文本差异。'
    },
    en: {
      addLocal: 'Local Repo',
      remoteSsh: 'Remote - SSH',
      terminal: 'Terminal',
      localRepos: 'Local Repositories',
      remoteRepos: 'Remote Repositories (SSH)',
      sshHosts: 'SSH Hosts (~/.ssh/config)',
      noLocalRepos: 'No local repositories yet. Click + to add.',
      noRemoteRepos: 'No remote repositories yet. Click + to browse SSH paths.',
      noSshHosts: 'No ~/.ssh/config hosts found. Add one in Remote - SSH.',
      newRepoShell: '+ Repo Shell',
      openSysTerm: '↗ System Terminal',
      sshModalTitle: 'Remote - SSH Repository Path Browser',
      sshServers: 'SSH Servers',
      newHost: 'Add Host',
      configureSshHost: 'Configure SSH Connection',
      aliasName: 'Name / Alias',
      hostIp: 'Host / IP',
      port: 'Port',
      username: 'Username',
      authMethod: 'Auth Method',
      privateKeyPath: 'Private Key Path (Optional)',
      passwordOpt: 'Password (Optional, prompted on connect if blank)',
      defaultRemoteDir: 'Default Remote Path',
      cancel: 'Cancel',
      saveAndBrowse: 'Save & Browse Paths',
      selectHostHint: '← Select an ~/.ssh/config host on the left or add a new SSH server to browse remote directory paths and open Git repositories.',
      showHidden: 'Show Hidden',
      scanSubfolders: 'Scan Subfolders',
      goPath: 'Go',
      openCurrentRepo: 'Open Remote Repo',
      openCurrentLocalRepo: 'Add & Open Repo',
      localModalTitle: 'Add Local Git Repository',
      osFolderPicker: 'OS Folder Picker…',
      appSettingsTitle: 'GitMap Global & AI Settings',
      appearanceAndGraph: 'Appearance & Graph',
      displayLang: 'Display Language',
      colourPreset: 'Graph Colour Preset',
      graphStyle: 'Graph Style',
      nodeStyle: 'Node Style',
      aiSettingsHeader: 'AI Commit Message & Explain Commit',
      close: 'Close',
      saveSettings: 'Save Settings',
      openRepoBtn: 'Open Repo',
      browsePathsBtn: 'Browse Paths',
      connecting: 'Connecting to SSH server…',
      scanning: 'Scanning subfolders for Git repositories…',
      addSelectedRepos: 'Add Selected Repositories',
      noReposScanned: 'No Git repositories found under this directory.',
      copiedPath: 'Copied repository path: ',
      sideBySide: 'Side-by-Side',
      inlineDiff: 'Inline',
      foldUnchanged: 'Fold Unchanged',
      viewFileRev: 'View File',
      fileHistoryGraph: 'File History',
      lineHistoryGraph: 'Line History',
      visualHistory: 'Visual History',
      toggleBlame: 'Git Blame',
      expandLines: 'Expand {0} unchanged lines',
      binaryFileNotice: 'Binary file — text diff cannot be shown.'
    }
  };

  /* ==================== State ==================== */
  const state = {
    lang: (localStorage.getItem('gitmap.lang') || (navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en')),
    theme: localStorage.getItem('gitmap.theme') || 'dark',
    repos: {},
    activeRepo: null,
    sshHosts: [],
    settings: {},
    homeDir: '~',
    tabs: [{ id: 'graph', title: 'Git Map', closable: false }],
    activeTabId: 'graph',
    selectedSshHostId: null,
    sshCurrentPath: '~',
    sshParentPath: null,
    localCurrentPath: '~',
    localParentPath: null,
    terminals: new Map(), // id -> { info, term, fitAddon, containerEl, tabEl }
    activeTermId: null
  };

  function tr(key, ...args) {
    const dict = STRINGS[state.lang] || STRINGS.en;
    let str = dict[key] || STRINGS.en[key] || key;
    args.forEach((a, idx) => {
      str = str.replace('{' + idx + '}', String(a));
    });
    return str;
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parseRepoDisplay(repoKey) {
    if (!repoKey) return { isRemote: false, name: '', fullDisplay: '', hostId: '', remotePath: '' };
    if (repoKey.startsWith('ssh://')) {
      const rest = repoKey.substring(6);
      const slash = rest.indexOf('/');
      const hostId = slash > -1 ? decodeURIComponent(rest.substring(0, slash)) : decodeURIComponent(rest);
      const remotePath = slash > -1 ? rest.substring(slash) : '/';
      const base = remotePath.split('/').filter(Boolean).pop() || remotePath;
      const customName = state.repos[repoKey] && state.repos[repoKey].name;
      return {
        isRemote: true,
        name: customName || base,
        fullDisplay: `${hostId}:${remotePath}`,
        hostId,
        remotePath
      };
    }
    const clean = repoKey.replace(/\/+$/, '');
    const base = clean.split('/').pop() || clean;
    const customName = state.repos[repoKey] && state.repos[repoKey].name;
    return {
      isRemote: false,
      name: customName || base,
      fullDisplay: repoKey,
      hostId: '',
      remotePath: ''
    };
  }

  /* ==================== Desktop Platform Detection ==================== */
  const desktopApi = window.gitMapDesktop || null;
  if (desktopApi && desktopApi.isElectron) {
    if (desktopApi.platform === 'darwin') {
      document.body.classList.add('darwin-desktop');
    }
    const nativeBtn = document.getElementById('btnNativePicker');
    if (nativeBtn) nativeBtn.classList.remove('hidden');
    desktopApi.onMenuAction((action) => {
      if (action === 'open-local-modal') openLocalModal();
      else if (action === 'open-ssh-modal') openSshModal();
      else if (action === 'toggle-terminal') toggleTerminalDrawer();
      else if (action === 'toggle-sidebar') document.getElementById('sidebar').classList.toggle('collapsed');
      else if (action === 'toggle-theme') toggleTheme();
      else if (action === 'open-settings') openAppSettingsModal();
    });
  }

  /* ==================== Theme & Language ==================== */
  function applyTheme(theme) {
    state.theme = theme === 'light' ? 'light' : 'dark';
    localStorage.setItem('gitmap.theme', state.theme);
    document.body.classList.remove('vscode-dark', 'vscode-light', 'theme-dark', 'theme-light');
    document.body.classList.add(state.theme === 'light' ? 'vscode-light' : 'vscode-dark');
    document.body.classList.add(state.theme === 'light' ? 'theme-light' : 'theme-dark');
    document.getElementById('themeIcon').textContent = state.theme === 'light' ? '☀️' : '🌙';

    document.querySelectorAll('iframe').forEach((frame) => {
      try {
        frame.contentWindow.postMessage({ __gitmapTheme: state.theme }, '*');
      } catch (_) {}
    });
  }

  function toggleTheme() {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  }

  function applyLanguageUI() {
    localStorage.setItem('gitmap.lang', state.lang);
    document.getElementById('btnToggleLang').textContent = state.lang === 'zh' ? '中文' : 'EN';
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const k = el.getAttribute('data-i18n');
      if (k) el.textContent = tr(k);
    });
    renderSidebar();
  }

  /* ==================== WebSocket & RPC Client ==================== */
  let ws = null;
  let reqCounter = 0;
  const pendingRpc = new Map();
  const wsQueue = [];

  function connectWs() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${proto}//${location.host}/ws`);

    ws.addEventListener('open', () => {
      while (wsQueue.length > 0) {
        ws.send(wsQueue.shift());
      }
    });

    ws.addEventListener('message', (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch (_) {
        return;
      }
      handleServerMessage(msg);
    });

    ws.addEventListener('close', () => {
      setTimeout(connectWs, 1500);
    });
  }

  function sendWs(obj) {
    const raw = JSON.stringify(obj);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(raw);
    } else {
      wsQueue.push(raw);
    }
  }

  function rpc(method, params) {
    const reqId = 'r' + (++reqCounter);
    return new Promise((resolve, reject) => {
      pendingRpc.set(reqId, { resolve, reject });
      sendWs({ type: 'rpc', reqId, method, params: params || {} });
    });
  }

  function handleServerMessage(msg) {
    switch (msg.type) {
      case 'init':
        state.repos = msg.repos || {};
        state.activeRepo = msg.lastActiveRepo || Object.keys(state.repos)[0] || null;
        state.sshHosts = msg.sshHosts || [];
        state.settings = msg.settings || {};
        state.homeDir = msg.homeDir || '~';
        renderSidebar();
        renderActiveRepoBadge();
        break;

      case 'rpc:res': {
        const entry = pendingRpc.get(msg.reqId);
        if (entry) {
          pendingRpc.delete(msg.reqId);
          if (msg.ok) entry.resolve(msg.result);
          else entry.reject(new Error(msg.error || 'RPC error'));
        }
        break;
      }

      case 'repos:changed':
        state.repos = msg.repos || {};
        if (msg.lastActiveRepo) state.activeRepo = msg.lastActiveRepo;
        else if (state.activeRepo && !state.repos[state.activeRepo]) {
          state.activeRepo = Object.keys(state.repos)[0] || null;
        }
        renderSidebar();
        renderActiveRepoBadge();
        break;

      case 'graph:reloadIframe': {
        const frame = document.getElementById('gitMapFrame');
        if (frame) frame.src = '/webview/git-map?t=' + Date.now();
        break;
      }

      case 'graph:message': {
        if (msg.payload && msg.payload.command === 'loadRepoInfo' && state.activeRepo) {
          renderActiveRepoBadge();
        }
        const frame = document.getElementById('gitMapFrame');
        if (frame && frame.contentWindow) {
          frame.contentWindow.postMessage(msg.payload, '*');
        }
        break;
      }

      case 'shell:focusGraphTab':
        activateTab('graph');
        break;

      case 'shell:openAppSettings':
        openAppSettingsModal();
        break;

      case 'tab:openDiff':
        openDiffTab(msg.payload);
        break;

      case 'tab:openMultiDiff':
        openMultiDiffTab(msg.payload);
        break;

      case 'tab:openFile':
        openFileTab(msg.payload);
        break;

      case 'tab:openVfh':
        openVfhTab(msg.payload);
        break;

      case 'terminal:requestOpen':
        openTerminalSession(msg.payload.repo, msg.payload.name, msg.payload.initialCommand);
        break;

      case 'term:data': {
        const t = state.terminals.get(msg.id);
        if (t) t.term.write(msg.data);
        break;
      }

      case 'term:exit': {
        const t = state.terminals.get(msg.id);
        if (t) {
          t.term.writeln(`\r\n\x1b[90m[Process exited with code ${msg.code}]\x1b[0m`);
        }
        break;
      }

      case 'clipboard:write':
        navigator.clipboard?.writeText(msg.text).catch(() => {});
        break;

      case 'external:open':
        window.open(msg.url, '_blank', 'noopener,noreferrer');
        break;

      case 'ui:toast':
        showToast(msg.payload.message, msg.payload.level);
        break;

      case 'ui:prompt':
        handleHostPrompt(msg.promptId, msg.kind, msg.request);
        break;
    }
  }

  /* Listen to messages from embedded iframes (GitGraphView & VisualFileHistory) */
  window.addEventListener('message', (ev) => {
    const data = ev.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'gitmap-webview-req' && data.payload) {
      if (data.payload.command === 'loadRepoInfo' && typeof data.payload.repo === 'string') {
        state.activeRepo = data.payload.repo;
        renderSidebar();
        renderActiveRepoBadge();
      }
      sendWs({ type: 'graph:request', payload: data.payload });
    } else if (data.type === 'gitmap-vfh-req' && data.payload) {
      sendWs({ type: 'vfh:request', panelId: data.panelId, payload: data.payload });
    } else if (data.type === 'gitmap-shell-action') {
      if (data.action === 'open-local-modal') openLocalModal();
      else if (data.action === 'open-ssh-modal') openSshModal();
    }
  });

  /* ==================== Toast Notifications ==================== */
  function showToast(message, level) {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = 'toast ' + (level || 'info');
    el.innerHTML = `<span>${escapeHtml(message)}</span><button class="mini-icon-btn">✕</button>`;
    el.querySelector('button').addEventListener('click', () => el.remove());
    container.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) el.remove();
    }, level === 'error' ? 7000 : 4000);
  }

  /* ==================== Sidebar & Active Badge ==================== */
  function renderActiveRepoBadge() {
    const badge = document.getElementById('activeRepoBadge');
    if (!state.activeRepo || !state.repos[state.activeRepo]) {
      badge.classList.add('hidden');
      return;
    }
    const info = parseRepoDisplay(state.activeRepo);
    badge.classList.remove('hidden');
    badge.classList.toggle('is-remote', info.isRemote);
    badge.innerHTML = info.isRemote
      ? `<strong>⇄ SSH</strong> <span>${escapeHtml(info.fullDisplay)}</span>`
      : `<strong>📁</strong> <span>${escapeHtml(info.fullDisplay)}</span>`;
    badge.onclick = () => {
      const textToCopy = info.isRemote ? info.remotePath : info.fullDisplay;
      navigator.clipboard?.writeText(textToCopy).catch(() => {});
      showToast(tr('copiedPath') + textToCopy, 'info');
    };
  }

  function renderSidebar() {
    const localContainer = document.getElementById('localRepoList');
    const remoteContainer = document.getElementById('remoteRepoList');
    const hostContainer = document.getElementById('sshHostList');

    const repoKeys = Object.keys(state.repos);
    const localKeys = repoKeys.filter((k) => !k.startsWith('ssh://')).sort();
    const remoteKeys = repoKeys.filter((k) => k.startsWith('ssh://')).sort();

    // Local Repos
    if (localKeys.length === 0) {
      localContainer.innerHTML = `<div class="sidebar-empty">${escapeHtml(tr('noLocalRepos'))}</div>`;
    } else {
      localContainer.innerHTML = '';
      localKeys.forEach((repoKey) => {
        localContainer.appendChild(buildRepoSidebarItem(repoKey));
      });
    }

    // Remote SSH Repos
    if (remoteKeys.length === 0) {
      remoteContainer.innerHTML = `<div class="sidebar-empty">${escapeHtml(tr('noRemoteRepos'))}</div>`;
    } else {
      remoteContainer.innerHTML = '';
      remoteKeys.forEach((repoKey) => {
        remoteContainer.appendChild(buildRepoSidebarItem(repoKey));
      });
    }

    // SSH Hosts
    if (!state.sshHosts || state.sshHosts.length === 0) {
      hostContainer.innerHTML = `<div class="sidebar-empty">${escapeHtml(tr('noSshHosts'))}</div>`;
    } else {
      hostContainer.innerHTML = '';
      state.sshHosts.forEach((host) => {
        const item = document.createElement('div');
        item.className = 'repo-item';
        item.innerHTML = `
          <div class="repo-item-top">
            <span class="repo-item-name">
              <i class="status-dot ${host.connected ? 'connected' : ''}"></i>
              ${escapeHtml(host.name)}
            </span>
            <button class="mini-btn" style="height:21px;padding:0 7px;font-size:11px;">${escapeHtml(tr('browsePathsBtn'))}</button>
          </div>
          <div class="repo-item-path">${escapeHtml(host.user + '@' + host.host + (host.port !== 22 ? ':' + host.port : ''))}</div>
        `;
        item.addEventListener('click', () => {
          openSshModal(host.id);
        });
        hostContainer.appendChild(item);
      });
    }
  }

  function buildRepoSidebarItem(repoKey) {
    const info = parseRepoDisplay(repoKey);
    const el = document.createElement('div');
    el.className = 'repo-item' + (state.activeRepo === repoKey ? ' active' : '');
    el.title = info.fullDisplay;
    el.innerHTML = `
      <div class="repo-item-top">
        <span class="repo-item-name">
          ${info.isRemote ? '<span class="ssh-chip">SSH</span>' : ''}
          ${escapeHtml(info.name)}
        </span>
        <span class="repo-item-actions">
          <button class="mini-icon-btn act-term" title="Open Terminal">›_</button>
          <button class="mini-icon-btn act-remove" title="Remove Repository">✕</button>
        </span>
      </div>
      <div class="repo-item-path">${escapeHtml(info.fullDisplay)}</div>
    `;
    el.addEventListener('click', (e) => {
      if (e.target.closest('.repo-item-actions')) return;
      state.activeRepo = repoKey;
      renderSidebar();
      renderActiveRepoBadge();
      activateTab('graph');
      rpc('repos:select', { repo: repoKey }).catch((err) => showToast(err.message, 'error'));
    });
    el.querySelector('.act-term').addEventListener('click', (e) => {
      e.stopPropagation();
      openTerminalSession(repoKey, info.isRemote ? `SSH: ${info.name}` : info.name, null);
    });
    el.querySelector('.act-remove').addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await rpc('repos:remove', { repo: repoKey });
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
    return el;
  }

  /* ==================== Workspace Tabs ==================== */
  function renderTabBar() {
    const bar = document.getElementById('tabBar');
    bar.innerHTML = '';
    state.tabs.forEach((tab) => {
      const tabEl = document.createElement('div');
      tabEl.className = 'ws-tab' + (state.activeTabId === tab.id ? ' active' : '');
      tabEl.innerHTML = `
        <span class="ws-tab-title" title="${escapeHtml(tab.title)}">${escapeHtml(tab.title)}</span>
        ${tab.closable ? '<button class="ws-tab-close" title="Close">✕</button>' : ''}
      `;
      tabEl.addEventListener('click', (e) => {
        if (e.target.closest('.ws-tab-close')) return;
        activateTab(tab.id);
      });
      if (tab.closable) {
        tabEl.querySelector('.ws-tab-close').addEventListener('click', (e) => {
          e.stopPropagation();
          closeTab(tab.id);
        });
      }
      bar.appendChild(tabEl);
    });
  }

  function activateTab(tabId) {
    state.activeTabId = tabId;
    renderTabBar();
    document.querySelectorAll('#tabPanels > .tab-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.id === 'panel-' + tabId);
    });
  }

  function closeTab(tabId) {
    const idx = state.tabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return;
    state.tabs.splice(idx, 1);
    const panelEl = document.getElementById('panel-' + tabId);
    if (panelEl) panelEl.remove();
    if (state.activeTabId === tabId) {
      const next = state.tabs[Math.max(0, idx - 1)] || state.tabs[0];
      activateTab(next.id);
    } else {
      renderTabBar();
    }
  }

  function createOrReplacePanelTab(tabId, title) {
    let existing = state.tabs.find((t) => t.id === tabId);
    if (!existing) {
      state.tabs.push({ id: tabId, title, closable: true });
    } else {
      existing.title = title;
    }
    let panelEl = document.getElementById('panel-' + tabId);
    if (!panelEl) {
      panelEl = document.createElement('div');
      panelEl.id = 'panel-' + tabId;
      panelEl.className = 'tab-panel';
      document.getElementById('tabPanels').appendChild(panelEl);
    }
    activateTab(tabId);
    return panelEl;
  }

  /* ==================== Built-in Diff Viewer ==================== */
  async function openDiffTab(payload) {
    const tabId = 'diff-' + btoa(unescape(encodeURIComponent(`${payload.repo}:${payload.fromHash}:${payload.toHash}:${payload.newFilePath}`))).replace(/[^a-zA-Z0-9]/g, '').slice(0, 28);
    const panel = createOrReplacePanelTab(tabId, '± ' + payload.title);
    panel.innerHTML = `<div class="browser-empty-state">Loading diff…</div>`;

    try {
      const diffData = await rpc('diff:compute', payload);
      renderSingleDiffIntoContainer(panel, diffData, payload.hideUnchangedRegions, payload.lines);
    } catch (err) {
      panel.innerHTML = `<div class="browser-empty-state">${escapeHtml(err.message)}</div>`;
    }
  }

  async function openMultiDiffTab(payload) {
    const tabId = 'multidiff-' + Date.now();
    const panel = createOrReplacePanelTab(tabId, '⇄ ' + payload.title);
    panel.innerHTML = `
      <div class="multi-diff-layout">
        <div class="multi-diff-sidebar"></div>
        <div class="multi-diff-main" style="flex:1;display:flex;flex-direction:column;min-width:0;min-height:0;"></div>
      </div>
    `;
    const sidebar = panel.querySelector('.multi-diff-sidebar');
    const main = panel.querySelector('.multi-diff-main');

    const selectFile = async (idx) => {
      sidebar.querySelectorAll('.multi-diff-file').forEach((el, i) => el.classList.toggle('active', i === idx));
      const file = payload.files[idx];
      if (!file) return;
      main.innerHTML = `<div class="browser-empty-state">Loading ${escapeHtml(file.newFilePath)}…</div>`;
      try {
        const diffData = await rpc('diff:compute', file);
        renderSingleDiffIntoContainer(main, diffData, payload.hideUnchangedRegions, null);
      } catch (err) {
        main.innerHTML = `<div class="browser-empty-state">${escapeHtml(err.message)}</div>`;
      }
    };

    payload.files.forEach((f, idx) => {
      const item = document.createElement('div');
      item.className = 'multi-diff-file';
      item.title = f.newFilePath;
      item.innerHTML = `<span class="git-badge">${escapeHtml(f.type)}</span><span>${escapeHtml(f.newFilePath)}</span>`;
      item.addEventListener('click', () => selectFile(idx));
      sidebar.appendChild(item);
    });

    if (payload.files.length > 0) {
      selectFile(0);
    }
  }

  function renderSingleDiffIntoContainer(container, diffData, initialFold, highlightRange) {
    let viewMode = 'split';
    let foldUnchanged = initialFold !== false;
    const expandedBlocks = new Set();

    container.innerHTML = `
      <div class="viewer-toolbar">
        <div class="viewer-toolbar-left">
          <span class="viewer-path">${escapeHtml(diffData.oldFilePath !== diffData.newFilePath ? diffData.oldFilePath + ' → ' + diffData.newFilePath : diffData.newFilePath)}</span>
          <span class="diff-stat-add">+${diffData.additions}</span>
          <span class="diff-stat-del">-${diffData.deletions}</span>
        </div>
        <div class="viewer-toolbar-right">
          <div class="segmented-control">
            <button type="button" class="mode-split active">${escapeHtml(tr('sideBySide'))}</button>
            <button type="button" class="mode-inline">${escapeHtml(tr('inlineDiff'))}</button>
          </div>
          <label class="inline-check"><input type="checkbox" class="fold-toggle" ${foldUnchanged ? 'checked' : ''} /> <span>${escapeHtml(tr('foldUnchanged'))}</span></label>
          <button type="button" class="mini-btn act-prev-hunk" title="Previous Change">↑</button>
          <button type="button" class="mini-btn act-next-hunk" title="Next Change">↓</button>
          <button type="button" class="mini-btn act-open-rev">${escapeHtml(tr('viewFileRev'))}</button>
          <button type="button" class="mini-btn act-file-hist">${escapeHtml(tr('fileHistoryGraph'))}</button>
          <button type="button" class="mini-btn act-vfh">${escapeHtml(tr('visualHistory'))}</button>
        </div>
      </div>
      <div class="diff-scroll-area"></div>
    `;

    const scrollArea = container.querySelector('.diff-scroll-area');
    let hunkRowElements = [];
    let currentHunkIdx = -1;

    function formatSegments(text, segs, cls) {
      if (text == null) return '';
      if (!segs || segs.length === 0) return escapeHtml(text);
      return segs
        .map((s) => (s.changed ? `<span class="${cls}">${escapeHtml(s.text)}</span>` : escapeHtml(s.text)))
        .join('');
    }

    function computeDisplayChunks(rows) {
      if (!foldUnchanged) return [{ type: 'rows', rows }];
      const CONTEXT = 3;
      const changedIndices = [];
      rows.forEach((r, idx) => {
        if (r.kind !== 'context') changedIndices.push(idx);
      });
      if (changedIndices.length === 0) {
        if (rows.length <= 12 || expandedBlocks.has('all')) return [{ type: 'rows', rows }];
        return [
          { type: 'rows', rows: rows.slice(0, 5) },
          { type: 'fold', id: 'all', count: rows.length - 5, rows: rows.slice(5) }
        ];
      }

      const keep = new Array(rows.length).fill(false);
      changedIndices.forEach((ci) => {
        for (let k = Math.max(0, ci - CONTEXT); k <= Math.min(rows.length - 1, ci + CONTEXT); k++) {
          keep[k] = true;
        }
      });

      const chunks = [];
      let idx = 0;
      while (idx < rows.length) {
        if (keep[idx]) {
          const slice = [];
          while (idx < rows.length && keep[idx]) slice.push(rows[idx++]);
          chunks.push({ type: 'rows', rows: slice });
        } else {
          const start = idx;
          const hiddenSlice = [];
          while (idx < rows.length && !keep[idx]) hiddenSlice.push(rows[idx++]);
          const foldId = 'f_' + start;
          if (hiddenSlice.length <= 3 || expandedBlocks.has(foldId)) {
            chunks.push({ type: 'rows', rows: hiddenSlice });
          } else {
            chunks.push({ type: 'fold', id: foldId, count: hiddenSlice.length, rows: hiddenSlice });
          }
        }
      }
      return chunks;
    }

    function renderTable() {
      if (diffData.error) {
        scrollArea.innerHTML = `<div class="browser-empty-state">${escapeHtml(diffData.error)}</div>`;
        return;
      }
      if (diffData.isBinary) {
        scrollArea.innerHTML = `<div class="browser-empty-state">${escapeHtml(tr('binaryFileNotice'))}</div>`;
        return;
      }

      const chunks = computeDisplayChunks(diffData.rows);
      const table = document.createElement('table');
      table.className = 'diff-table';
      const tbody = document.createElement('tbody');
      hunkRowElements = [];
      let prevWasChange = false;

      chunks.forEach((chunk) => {
        if (chunk.type === 'fold') {
          const trEl = document.createElement('tr');
          trEl.className = 'diff-fold-row';
          const colSpan = viewMode === 'split' ? 4 : 3;
          trEl.innerHTML = `<td colspan="${colSpan}">⋯ ${escapeHtml(tr('expandLines', chunk.count))} ⋯</td>`;
          trEl.addEventListener('click', () => {
            expandedBlocks.add(chunk.id);
            renderTable();
          });
          tbody.appendChild(trEl);
          prevWasChange = false;
          return;
        }

        chunk.rows.forEach((r) => {
          const isChange = r.kind !== 'context';
          if (viewMode === 'split') {
            const trEl = document.createElement('tr');
            const leftCls = r.kind === 'deleted' || r.kind === 'change' ? 'diff-cell-del' : r.oldLineNumber == null ? 'diff-cell-empty' : '';
            const rightCls = r.kind === 'added' || r.kind === 'change' ? 'diff-cell-add' : r.newLineNumber == null ? 'diff-cell-empty' : '';
            trEl.innerHTML = `
              <td class="diff-gutter ${leftCls}">${r.oldLineNumber ?? ''}</td>
              <td class="diff-code diff-side-left ${leftCls}">${formatSegments(r.oldText, r.oldSegments, 'word-del')}</td>
              <td class="diff-gutter ${rightCls}">${r.newLineNumber ?? ''}</td>
              <td class="diff-code diff-side-right ${rightCls}">${formatSegments(r.newText, r.newSegments, 'word-add')}</td>
            `;
            if (isChange && !prevWasChange) hunkRowElements.push(trEl);
            prevWasChange = isChange;
            tbody.appendChild(trEl);
          } else {
            // Inline mode
            if (r.kind === 'change') {
              const trDel = document.createElement('tr');
              trDel.innerHTML = `
                <td class="diff-gutter diff-cell-del">${r.oldLineNumber ?? ''}</td>
                <td class="diff-gutter diff-cell-del"></td>
                <td class="diff-code diff-cell-del">- ${formatSegments(r.oldText, r.oldSegments, 'word-del')}</td>
              `;
              const trAdd = document.createElement('tr');
              trAdd.innerHTML = `
                <td class="diff-gutter diff-cell-add"></td>
                <td class="diff-gutter diff-cell-add">${r.newLineNumber ?? ''}</td>
                <td class="diff-code diff-cell-add">+ ${formatSegments(r.newText, r.newSegments, 'word-add')}</td>
              `;
              if (!prevWasChange) hunkRowElements.push(trDel);
              prevWasChange = true;
              tbody.appendChild(trDel);
              tbody.appendChild(trAdd);
            } else {
              const trEl = document.createElement('tr');
              const cls = r.kind === 'added' ? 'diff-cell-add' : r.kind === 'deleted' ? 'diff-cell-del' : '';
              const prefix = r.kind === 'added' ? '+ ' : r.kind === 'deleted' ? '- ' : '  ';
              const text = r.kind === 'deleted' ? r.oldText : r.newText;
              trEl.innerHTML = `
                <td class="diff-gutter ${cls}">${r.oldLineNumber ?? ''}</td>
                <td class="diff-gutter ${cls}">${r.newLineNumber ?? ''}</td>
                <td class="diff-code ${cls}">${prefix}${escapeHtml(text ?? '')}</td>
              `;
              if (isChange && !prevWasChange) hunkRowElements.push(trEl);
              prevWasChange = isChange;
              tbody.appendChild(trEl);
            }
          }
        });
      });

      table.appendChild(tbody);
      scrollArea.innerHTML = '';
      scrollArea.appendChild(table);
    }

    container.querySelector('.mode-split').addEventListener('click', (e) => {
      viewMode = 'split';
      e.target.classList.add('active');
      container.querySelector('.mode-inline').classList.remove('active');
      renderTable();
    });
    container.querySelector('.mode-inline').addEventListener('click', (e) => {
      viewMode = 'inline';
      e.target.classList.add('active');
      container.querySelector('.mode-split').classList.remove('active');
      renderTable();
    });
    container.querySelector('.fold-toggle').addEventListener('change', (e) => {
      foldUnchanged = e.target.checked;
      renderTable();
    });
    container.querySelector('.act-prev-hunk').addEventListener('click', () => {
      if (hunkRowElements.length === 0) return;
      currentHunkIdx = currentHunkIdx <= 0 ? hunkRowElements.length - 1 : currentHunkIdx - 1;
      hunkRowElements[currentHunkIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    container.querySelector('.act-next-hunk').addEventListener('click', () => {
      if (hunkRowElements.length === 0) return;
      currentHunkIdx = (currentHunkIdx + 1) % hunkRowElements.length;
      hunkRowElements[currentHunkIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    container.querySelector('.act-open-rev').addEventListener('click', () => {
      openFileTab({
        repo: diffData.repo,
        filePath: diffData.newFilePath,
        commit: diffData.toHash === '*' ? null : diffData.toHash,
        title: diffData.newFilePath.split('/').pop() + (diffData.toHash !== '*' ? ` (${diffData.toHash.slice(0, 8)})` : ''),
        lines: highlightRange || null
      });
    });
    container.querySelector('.act-file-hist').addEventListener('click', async () => {
      await rpc('file:viewHistoryInGraph', { repo: diffData.repo, filePath: diffData.newFilePath });
      activateTab('graph');
    });
    container.querySelector('.act-vfh').addEventListener('click', async () => {
      await rpc('file:visualHistory', {
        repo: diffData.repo,
        filePath: diffData.newFilePath,
        commitHash: diffData.toHash !== '*' ? diffData.toHash : undefined
      });
    });

    renderTable();
  }

  /* ==================== Built-in File Viewer (with Blame & Line History) ==================== */
  async function openFileTab(payload) {
    const keySource = payload.inlineContent
      ? 'inline-' + Date.now()
      : `${payload.repo}:${payload.commit || 'work'}:${payload.filePath}`;
    const tabId = 'file-' + btoa(unescape(encodeURIComponent(keySource))).replace(/[^a-zA-Z0-9]/g, '').slice(0, 28);
    const panel = createOrReplacePanelTab(tabId, '📄 ' + (payload.title || payload.filePath));
    panel.innerHTML = `<div class="browser-empty-state">Loading file…</div>`;

    try {
      let fileRes;
      if (typeof payload.inlineContent === 'string') {
        fileRes = {
          repo: '',
          filePath: payload.filePath,
          commit: null,
          content: payload.inlineContent,
          isBinary: false,
          error: null,
          blame: null
        };
      } else {
        fileRes = await rpc('file:read', {
          repo: payload.repo,
          filePath: payload.filePath,
          commit: payload.commit
        });
      }

      if (fileRes.error) {
        panel.innerHTML = `<div class="browser-empty-state">${escapeHtml(fileRes.error)}</div>`;
        return;
      }
      if (fileRes.isBinary) {
        panel.innerHTML = `<div class="browser-empty-state">${escapeHtml(tr('binaryFileNotice'))}</div>`;
        return;
      }

      let showBlame = false;
      let blameData = fileRes.blame || null;
      let selStart = payload.lines ? payload.lines.start : null;
      let selEnd = payload.lines ? payload.lines.end : null;

      const hasRepo = !!fileRes.repo;
      panel.innerHTML = `
        <div class="viewer-toolbar">
          <div class="viewer-toolbar-left">
            <span class="viewer-path">${escapeHtml(fileRes.filePath)}${fileRes.commit ? ' @ ' + escapeHtml(fileRes.commit.slice(0, 8)) : ''}</span>
          </div>
          <div class="viewer-toolbar-right">
            ${hasRepo ? `
              <button type="button" class="mini-btn act-blame">${escapeHtml(tr('toggleBlame'))}</button>
              <button type="button" class="mini-btn act-line-hist">${escapeHtml(tr('lineHistoryGraph'))}</button>
              <button type="button" class="mini-btn act-file-hist">${escapeHtml(tr('fileHistoryGraph'))}</button>
              <button type="button" class="mini-btn act-vfh">${escapeHtml(tr('visualHistory'))}</button>
            ` : ''}
          </div>
        </div>
        <div class="diff-scroll-area"></div>
      `;

      const scrollArea = panel.querySelector('.diff-scroll-area');
      const lines = fileRes.content.replace(/\r\n/g, '\n').split('\n');

      const renderFileLines = () => {
        const table = document.createElement('table');
        table.className = 'diff-table';
        const tbody = document.createElement('tbody');
        let lastBlameHash = null;

        lines.forEach((lineText, idx) => {
          const lineNo = idx + 1;
          const trEl = document.createElement('tr');
          const isSelected = selStart !== null && selEnd !== null && lineNo >= selStart && lineNo <= selEnd;
          trEl.className = 'file-line-row' + (isSelected ? ' selected-line' : '');

          let blameHtml = '';
          if (showBlame && blameData && blameData.lines && blameData.lines[idx]) {
            const bl = blameData.lines[idx];
            const bc = blameData.commits[bl.hash];
            if (bl.hash !== lastBlameHash && bc) {
              const shortHash = bc.committed ? bl.hash.slice(0, 7) : 'Uncomm.';
              const dateStr = bc.authorDate ? new Date(bc.authorDate * 1000).toISOString().slice(0, 10) : '';
              blameHtml = `<td class="blame-gutter" data-hash="${escapeHtml(bc.committed ? bl.hash : '')}" title="${escapeHtml(bc.summary)}">${escapeHtml(shortHash + ' · ' + bc.author + ' · ' + dateStr)}</td>`;
            } else {
              blameHtml = `<td class="blame-gutter" data-hash="${escapeHtml(bc && bc.committed ? bl.hash : '')}"></td>`;
            }
            lastBlameHash = bl.hash;
          } else if (showBlame) {
            blameHtml = `<td class="blame-gutter"></td>`;
          }

          trEl.innerHTML = `
            ${blameHtml}
            <td class="file-line-num" data-line="${lineNo}">${lineNo}</td>
            <td class="diff-code">${escapeHtml(lineText)}</td>
          `;
          tbody.appendChild(trEl);
        });

        table.appendChild(tbody);
        scrollArea.innerHTML = '';
        scrollArea.appendChild(table);

        scrollArea.querySelectorAll('.file-line-num').forEach((numEl) => {
          numEl.addEventListener('click', (ev) => {
            const clicked = Number(numEl.getAttribute('data-line'));
            if (ev.shiftKey && selStart !== null) {
              const a = Math.min(selStart, clicked);
              const b = Math.max(selStart, clicked);
              selStart = a;
              selEnd = b;
            } else {
              selStart = clicked;
              selEnd = clicked;
            }
            renderFileLines();
          });
        });

        scrollArea.querySelectorAll('.blame-gutter[data-hash]').forEach((bg) => {
          const h = bg.getAttribute('data-hash');
          if (h) {
            bg.addEventListener('click', () => {
              sendWs({
                type: 'graph:request',
                payload: { command: 'commitDetails', repo: fileRes.repo, commitHash: h, hasParents: true, stash: null, avatarEmail: null, refresh: false }
              });
              rpc('repos:select', { repo: fileRes.repo });
              activateTab('graph');
            });
          }
        });
      };

      if (hasRepo) {
        panel.querySelector('.act-blame').addEventListener('click', async (e) => {
          showBlame = !showBlame;
          e.target.classList.toggle('primary', showBlame);
          if (showBlame && !blameData) {
            const res = await rpc('file:blame', { repo: fileRes.repo, filePath: fileRes.filePath });
            blameData = res.blame;
          }
          renderFileLines();
        });
        panel.querySelector('.act-line-hist').addEventListener('click', async () => {
          const range = selStart !== null ? { start: selStart, end: selEnd || selStart } : { start: 1, end: Math.min(20, lines.length) };
          await rpc('file:viewHistoryInGraph', { repo: fileRes.repo, filePath: fileRes.filePath, lineRange: range });
          activateTab('graph');
        });
        panel.querySelector('.act-file-hist').addEventListener('click', async () => {
          await rpc('file:viewHistoryInGraph', { repo: fileRes.repo, filePath: fileRes.filePath });
          activateTab('graph');
        });
        panel.querySelector('.act-vfh').addEventListener('click', async () => {
          await rpc('file:visualHistory', {
            repo: fileRes.repo,
            filePath: fileRes.filePath,
            commitHash: fileRes.commit || undefined
          });
        });
      }

      renderFileLines();
    } catch (err) {
      panel.innerHTML = `<div class="browser-empty-state">${escapeHtml(err.message)}</div>`;
    }
  }

  /* ==================== Visual File History Tab ==================== */
  function openVfhTab(payload) {
    const tabId = 'vfh-' + payload.panelId;
    const panel = createOrReplacePanelTab(tabId, '📊 ' + payload.title);
    panel.innerHTML = `<iframe src="/webview/vfh/${encodeURIComponent(payload.panelId)}?t=${Date.now()}" title="${escapeHtml(payload.title)}"></iframe>`;
  }

  /* ==================== Integrated Terminal (xterm.js) ==================== */
  function toggleTerminalDrawer(forceShow) {
    const drawer = document.getElementById('terminalDrawer');
    const willShow = typeof forceShow === 'boolean' ? forceShow : drawer.classList.contains('hidden');
    drawer.classList.toggle('hidden', !willShow);
    if (willShow) {
      if (state.terminals.size === 0) {
        openTerminalSession(state.activeRepo || state.homeDir, undefined, null);
      } else if (state.activeTermId) {
        fitActiveTerminal();
      }
    }
  }

  async function openTerminalSession(repo, name, initialCommand) {
    toggleTerminalDrawer(true);
    try {
      const res = await rpc('term:create', {
        repo: repo || state.activeRepo || state.homeDir,
        name,
        cols: 110,
        rows: 26,
        initialCommand
      });
      const info = res.session;

      const containerEl = document.createElement('div');
      containerEl.className = 'term-instance';
      document.getElementById('terminalContainers').appendChild(containerEl);

      const term = new window.Terminal({
        cursorBlink: true,
        fontSize: 12.5,
        fontFamily: 'SF Mono, Menlo, Monaco, Consolas, monospace',
        theme: {
          background: '#141414',
          foreground: '#d4d4d4'
        }
      });
      const fitAddon = new window.FitAddon.FitAddon();
      term.loadAddon(fitAddon);
      term.open(containerEl);

      term.onData((data) => {
        sendWs({ type: 'term:input', id: info.id, data });
      });

      const tabEl = document.createElement('div');
      tabEl.className = 'term-tab';
      tabEl.innerHTML = `<span>${info.isRemote ? '⇄ ' : '›_ '}${escapeHtml(info.title)}</span><button class="ws-tab-close">✕</button>`;
      tabEl.addEventListener('click', (e) => {
        if (e.target.closest('.ws-tab-close')) return;
        activateTerminal(info.id);
      });
      tabEl.querySelector('.ws-tab-close').addEventListener('click', (e) => {
        e.stopPropagation();
        closeTerminalSession(info.id);
      });
      document.getElementById('terminalTabs').appendChild(tabEl);

      state.terminals.set(info.id, { info, term, fitAddon, containerEl, tabEl });
      activateTerminal(info.id);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function activateTerminal(id) {
    state.activeTermId = id;
    state.terminals.forEach((t, tid) => {
      const active = tid === id;
      t.containerEl.classList.toggle('active', active);
      t.tabEl.classList.toggle('active', active);
    });
    setTimeout(fitActiveTerminal, 30);
  }

  function fitActiveTerminal() {
    if (!state.activeTermId) return;
    const t = state.terminals.get(state.activeTermId);
    if (!t) return;
    try {
      t.fitAddon.fit();
      sendWs({ type: 'term:resize', id: t.info.id, cols: t.term.cols, rows: t.term.rows });
      t.term.focus();
    } catch (_) {}
  }

  function closeTerminalSession(id) {
    const t = state.terminals.get(id);
    if (!t) return;
    sendWs({ type: 'term:close', id });
    t.term.dispose();
    t.containerEl.remove();
    t.tabEl.remove();
    state.terminals.delete(id);
    if (state.terminals.size === 0) {
      state.activeTermId = null;
      document.getElementById('terminalDrawer').classList.add('hidden');
    } else if (state.activeTermId === id) {
      const firstId = state.terminals.keys().next().value;
      activateTerminal(firstId);
    }
  }

  window.addEventListener('resize', () => {
    if (!document.getElementById('terminalDrawer').classList.contains('hidden')) {
      fitActiveTerminal();
    }
  });

  /* Terminal Resizer Drag */
  (function setupTerminalResize() {
    const resizer = document.getElementById('terminalResizer');
    const drawer = document.getElementById('terminalDrawer');
    let dragging = false;
    resizer.addEventListener('mousedown', (e) => {
      dragging = true;
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const newHeight = Math.max(130, Math.min(window.innerHeight * 0.7, window.innerHeight - e.clientY));
      drawer.style.height = newHeight + 'px';
      fitActiveTerminal();
    });
    window.addEventListener('mouseup', () => {
      dragging = false;
    });
  })();

  /* ==================== Remote - SSH Modal & Path Browser ==================== */
  async function openSshModal(preselectHostId) {
    document.getElementById('sshModal').classList.remove('hidden');
    try {
      const res = await rpc('ssh:listHosts');
      state.sshHosts = res.hosts || [];
      renderSidebar();
      renderModalSshHosts();
      if (preselectHostId) {
        selectAndBrowseSshHost(preselectHostId);
      } else if (state.selectedSshHostId) {
        renderModalSshHosts();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function renderModalSshHosts() {
    const listEl = document.getElementById('modalSshHostList');
    if (state.sshHosts.length === 0) {
      listEl.innerHTML = `<div class="sidebar-empty">${escapeHtml(tr('noSshHosts'))}</div>`;
      return;
    }
    listEl.innerHTML = '';
    state.sshHosts.forEach((h) => {
      const card = document.createElement('div');
      card.className = 'host-card' + (state.selectedSshHostId === h.id ? ' selected' : '');
      card.innerHTML = `
        <div class="host-card-top">
          <span style="font-weight:600;display:flex;align-items:center;gap:6px;">
            <i class="status-dot ${h.connected ? 'connected' : ''}"></i>
            ${escapeHtml(h.name)}
          </span>
          <span style="display:flex;align-items:center;gap:4px;">
            <span class="ssh-chip">${h.source === 'ssh-config' ? 'ssh-config' : 'saved'}</span>
            ${h.source === 'saved' ? '<button class="mini-icon-btn del-host" title="Delete Host">✕</button>' : ''}
          </span>
        </div>
        <div class="host-card-meta">${escapeHtml(h.user + '@' + h.host + ':' + h.port)}${h.proxyJump ? ' (via ' + escapeHtml(h.proxyJump) + ')' : ''}</div>
      `;
      card.addEventListener('click', (e) => {
        if (e.target.closest('.del-host')) return;
        selectAndBrowseSshHost(h.id);
      });
      const delBtn = card.querySelector('.del-host');
      if (delBtn) {
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const res = await rpc('ssh:removeHost', { id: h.id });
          state.sshHosts = res.hosts || [];
          if (state.selectedSshHostId === h.id) {
            state.selectedSshHostId = null;
            document.getElementById('sshBrowserContent').classList.add('hidden');
            document.getElementById('sshBrowserEmpty').classList.remove('hidden');
          }
          renderModalSshHosts();
          renderSidebar();
        });
      }
      listEl.appendChild(card);
    });
  }

  async function selectAndBrowseSshHost(hostId, targetPath) {
    state.selectedSshHostId = hostId;
    renderModalSshHosts();
    document.getElementById('sshBrowserEmpty').classList.add('hidden');
    document.getElementById('sshBrowserContent').classList.remove('hidden');
    const dirList = document.getElementById('sshDirList');
    dirList.innerHTML = `<div class="browser-empty-state">${escapeHtml(tr('connecting'))}</div>`;

    try {
      const showHidden = document.getElementById('sshShowHidden').checked;
      const listing = await rpc('ssh:browsePath', {
        hostId,
        path: targetPath || undefined,
        showHidden
      });
      state.sshHosts = listing.hosts || state.sshHosts;
      state.sshCurrentPath = listing.currentPath;
      state.sshParentPath = listing.parentPath;
      renderModalSshHosts();
      renderSidebar();

      const hostObj = state.sshHosts.find((x) => x.id === hostId);
      document.getElementById('sshConnSummary').textContent =
        `● ${hostObj ? hostObj.user + '@' + hostObj.host : hostId}` +
        (hostObj && hostObj.gitVersion ? ` · Git ${hostObj.gitVersion}` : '');

      document.getElementById('sshPathInput').value = listing.currentPath;
      renderBreadcrumbs(document.getElementById('sshBreadcrumbs'), listing.currentPath, (p) => {
        selectAndBrowseSshHost(hostId, p);
      });

      // Current Repo Banner
      const banner = document.getElementById('sshCurrentRepoBanner');
      if (listing.currentRepoRoot) {
        banner.classList.remove('hidden');
        document.getElementById('sshCurrentRepoPath').textContent = `${hostId}:${listing.currentRepoRoot}`;
        const brEl = document.getElementById('sshCurrentRepoBranch');
        brEl.textContent = listing.currentRepoBranch || 'HEAD';
        document.getElementById('btnOpenCurrentRemoteRepo').onclick = () => {
          openRemoteRepoAndCloseModal(hostId, listing.currentRepoRoot);
        };
      } else {
        banner.classList.add('hidden');
      }

      renderDirectoryEntries(
        dirList,
        listing.entries,
        (dirPath) => selectAndBrowseSshHost(hostId, dirPath),
        (repoPath) => openRemoteRepoAndCloseModal(hostId, repoPath)
      );
    } catch (err) {
      dirList.innerHTML = `<div class="browser-empty-state" style="color:var(--vscode-errorForeground);">${escapeHtml(err.message)}</div>`;
    }
  }

  async function openRemoteRepoAndCloseModal(hostId, remotePath) {
    try {
      const res = await rpc('ssh:openRemoteRepo', { hostId, remotePath });
      state.repos = res.repos || state.repos;
      state.activeRepo = res.root;
      renderSidebar();
      renderActiveRepoBadge();
      document.getElementById('sshModal').classList.add('hidden');
      activateTab('graph');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function renderBreadcrumbs(container, fullPath, onNavigate) {
    container.innerHTML = '';
    const isWinDrive = /^[a-zA-Z]:/.test(fullPath);
    const parts = fullPath.split('/').filter(Boolean);

    const rootBtn = document.createElement('button');
    rootBtn.className = 'crumb-btn';
    rootBtn.textContent = isWinDrive ? parts[0] : '/';
    rootBtn.addEventListener('click', () => onNavigate(isWinDrive ? parts[0] + '/' : '/'));
    container.appendChild(rootBtn);

    const startIdx = isWinDrive ? 1 : 0;
    let accum = isWinDrive ? parts[0] : '';
    for (let i = startIdx; i < parts.length; i++) {
      const sep = document.createElement('span');
      sep.textContent = '/';
      container.appendChild(sep);
      accum += '/' + parts[i];
      const target = accum;
      const btn = document.createElement('button');
      btn.className = 'crumb-btn';
      btn.textContent = parts[i];
      btn.addEventListener('click', () => onNavigate(target));
      container.appendChild(btn);
    }
  }

  function renderDirectoryEntries(container, entries, onEnterDir, onOpenRepo) {
    if (!entries || entries.length === 0) {
      container.innerHTML = `<div class="browser-empty-state">Empty directory</div>`;
      return;
    }
    container.innerHTML = '';
    entries.forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'dir-entry' + (entry.isDirectory ? '' : ' file-entry');
      row.innerHTML = `
        <div class="dir-entry-left">
          <span>${entry.isDirectory ? (entry.isGitRepo ? '📦' : '📁') : '📄'}</span>
          <span class="dir-entry-name" title="${escapeHtml(entry.path)}">${escapeHtml(entry.name)}</span>
        </div>
        <div class="dir-entry-right">
          ${entry.isGitRepo ? `<span class="git-badge">Git${entry.gitBranch ? ' · ' + escapeHtml(entry.gitBranch) : ''}</span>` : ''}
          ${entry.isGitRepo ? `<button type="button" class="mini-btn primary act-open-repo">${escapeHtml(tr('openRepoBtn'))}</button>` : ''}
        </div>
      `;
      if (entry.isDirectory) {
        row.addEventListener('click', (e) => {
          if (e.target.closest('.act-open-repo')) return;
          onEnterDir(entry.path);
        });
      }
      const openBtn = row.querySelector('.act-open-repo');
      if (openBtn) {
        openBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          onOpenRepo(entry.path);
        });
      }
      container.appendChild(row);
    });
  }

  /* Scan Remote Subfolders for Git Repositories */
  document.getElementById('btnScanRemoteRepos').addEventListener('click', async () => {
    if (!state.selectedSshHostId) return;
    const dirList = document.getElementById('sshDirList');
    dirList.innerHTML = `<div class="browser-empty-state">${escapeHtml(tr('scanning'))}</div>`;
    try {
      const res = await rpc('ssh:scanRepos', {
        hostId: state.selectedSshHostId,
        path: state.sshCurrentPath,
        maxDepth: 3
      });
      const repos = res.repos || [];
      if (repos.length === 0) {
        dirList.innerHTML = `<div class="browser-empty-state">${escapeHtml(tr('noReposScanned'))}</div>`;
        return;
      }
      dirList.innerHTML = `
        <div style="padding:8px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--vscode-panel-border);">
          <strong>Found ${repos.length} Git repositories</strong>
          <button type="button" id="btnBatchAddRemote" class="mini-btn primary">${escapeHtml(tr('addSelectedRepos'))}</button>
        </div>
        <div class="scan-results-body"></div>
      `;
      const body = dirList.querySelector('.scan-results-body');
      repos.forEach((r) => {
        const row = document.createElement('label');
        row.className = 'dir-entry inline-check';
        row.style.justifyContent = 'space-between';
        row.innerHTML = `
          <span style="display:flex;align-items:center;gap:8px;min-width:0;">
            <input type="checkbox" class="scan-repo-chk" value="${escapeHtml(r.sshUri)}" checked />
            <strong style="font-family:var(--vscode-editor-font-family);">${escapeHtml(r.name)}</strong>
            <span style="font-family:var(--vscode-editor-font-family);color:var(--vscode-descriptionForeground);font-size:11.5px;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(r.path)}</span>
          </span>
          ${r.branch ? `<span class="branch-pill">${escapeHtml(r.branch)}</span>` : ''}
        `;
        body.appendChild(row);
      });
      dirList.querySelector('#btnBatchAddRemote').addEventListener('click', async () => {
        const uris = Array.from(dirList.querySelectorAll('.scan-repo-chk:checked')).map((el) => el.value);
        if (uris.length === 0) return;
        const addRes = await rpc('repos:addBatch', { paths: uris });
        state.repos = addRes.repos || state.repos;
        if (addRes.added && addRes.added[0]) state.activeRepo = addRes.added[0];
        renderSidebar();
        renderActiveRepoBadge();
        document.getElementById('sshModal').classList.add('hidden');
        activateTab('graph');
      });
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  /* ==================== Local Repository Browser Modal ==================== */
  async function openLocalModal(targetPath) {
    document.getElementById('localModal').classList.remove('hidden');
    await browseLocalPath(targetPath || state.localCurrentPath || state.homeDir);
  }

  async function browseLocalPath(targetPath) {
    const dirList = document.getElementById('localDirList');
    try {
      const showHidden = document.getElementById('localShowHidden').checked;
      const listing = await rpc('local:browsePath', { path: targetPath, showHidden });
      state.localCurrentPath = listing.currentPath;
      state.localParentPath = listing.parentPath;
      document.getElementById('localPathInput').value = listing.currentPath;

      renderBreadcrumbs(document.getElementById('localBreadcrumbs'), listing.currentPath, (p) => browseLocalPath(p));

      const banner = document.getElementById('localCurrentRepoBanner');
      if (listing.currentRepoRoot) {
        banner.classList.remove('hidden');
        document.getElementById('localCurrentRepoPath').textContent = listing.currentRepoRoot;
        document.getElementById('localCurrentRepoBranch').textContent = listing.currentRepoBranch || 'HEAD';
        document.getElementById('btnOpenCurrentLocalRepo').onclick = () => addLocalRepoAndClose(listing.currentRepoRoot);
      } else {
        banner.classList.add('hidden');
      }

      renderDirectoryEntries(
        dirList,
        listing.entries,
        (p) => browseLocalPath(p),
        (repoPath) => addLocalRepoAndClose(repoPath)
      );
    } catch (err) {
      dirList.innerHTML = `<div class="browser-empty-state" style="color:var(--vscode-errorForeground);">${escapeHtml(err.message)}</div>`;
    }
  }

  async function addLocalRepoAndClose(repoPath) {
    try {
      const res = await rpc('repos:add', { path: repoPath });
      state.repos = res.repos || state.repos;
      state.activeRepo = res.root;
      renderSidebar();
      renderActiveRepoBadge();
      document.getElementById('localModal').classList.add('hidden');
      activateTab('graph');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  /* ==================== Settings Modal ==================== */
  async function openAppSettingsModal() {
    document.getElementById('appSettingsModal').classList.remove('hidden');
    try {
      const res = await rpc('settings:get');
      const s = res.settings || {};
      state.settings = s;
      document.getElementById('cfgLanguage').value = s['git-map.language'] || 'Auto';
      document.getElementById('cfgColourPreset').value = s['git-map.graph.colourPreset'] || 'Default';
      document.getElementById('cfgGraphStyle').value = s['git-map.graph.style'] || 'rounded';
      document.getElementById('cfgNodeStyle').value = s['git-map.graph.nodeStyle'] || 'Dot';
      document.getElementById('cfgAiProvider').value = s['git-map.ai.provider'] || 'DeepSeek';
      document.getElementById('cfgAiModel').value = s['git-map.ai.model'] || '';
      document.getElementById('cfgAiBaseUrl').value = s['git-map.ai.baseUrl'] || '';
      document.getElementById('cfgAiExplain').checked = !!s['git-map.ai.explainCommit.enabled'];
      document.getElementById('cfgAiCommitMsg').checked = s['git-map.ai.commitMessage.enabled'] !== false;
    } catch (_) {}
  }

  document.getElementById('btnSaveAppSettings').addEventListener('click', async () => {
    const updates = [
      ['git-map.language', document.getElementById('cfgLanguage').value],
      ['git-map.graph.colourPreset', document.getElementById('cfgColourPreset').value],
      ['git-map.graph.style', document.getElementById('cfgGraphStyle').value],
      ['git-map.graph.nodeStyle', document.getElementById('cfgNodeStyle').value],
      ['git-map.ai.provider', document.getElementById('cfgAiProvider').value],
      ['git-map.ai.model', document.getElementById('cfgAiModel').value.trim()],
      ['git-map.ai.baseUrl', document.getElementById('cfgAiBaseUrl').value.trim()],
      ['git-map.ai.explainCommit.enabled', document.getElementById('cfgAiExplain').checked],
      ['git-map.ai.commitMessage.enabled', document.getElementById('cfgAiCommitMsg').checked]
    ];
    for (const [key, value] of updates) {
      await rpc('settings:update', { key, value });
    }
    const langVal = document.getElementById('cfgLanguage').value;
    if (langVal === 'Simplified Chinese') state.lang = 'zh';
    else if (langVal === 'English') state.lang = 'en';
    applyLanguageUI();
    document.getElementById('appSettingsModal').classList.add('hidden');
    showToast(state.lang === 'zh' ? '设置已保存' : 'Settings saved', 'info');
  });

  /* ==================== Host Prompt Handler (InputBox, QuickPick, Open/Save, Modal Toast) ==================== */
  function handleHostPrompt(promptId, kind, req) {
    const modal = document.getElementById('promptModal');
    const titleEl = document.getElementById('promptTitle');
    const bodyEl = document.getElementById('promptBody');
    const footerEl = document.getElementById('promptFooter');
    modal.classList.remove('hidden');

    const respond = (val) => {
      modal.classList.add('hidden');
      bodyEl.innerHTML = '';
      footerEl.innerHTML = '';
      sendWs({ type: 'ui:promptResponse', promptId, value: val });
    };

    document.getElementById('promptCloseBtn').onclick = () => respond(undefined);

    if (kind === 'inputBox') {
      titleEl.textContent = req.title || 'GitMap Input';
      bodyEl.innerHTML = `
        ${req.prompt ? `<p style="margin:0;color:var(--vscode-foreground);">${escapeHtml(req.prompt)}</p>` : ''}
        <input id="promptInputField" type="${req.password ? 'password' : 'text'}" placeholder="${escapeHtml(req.placeHolder || '')}" value="${escapeHtml(req.value || '')}" />
      `;
      footerEl.innerHTML = `
        <button type="button" class="mini-btn act-cancel">${escapeHtml(tr('cancel'))}</button>
        <button type="button" class="mini-btn primary act-ok">OK</button>
      `;
      const input = document.getElementById('promptInputField');
      setTimeout(() => input.focus(), 30);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') respond(input.value);
        if (e.key === 'Escape') respond(undefined);
      });
      footerEl.querySelector('.act-cancel').onclick = () => respond(undefined);
      footerEl.querySelector('.act-ok').onclick = () => respond(input.value);
    } else if (kind === 'quickPick') {
      titleEl.textContent = req.placeHolder || 'Select an option';
      bodyEl.innerHTML = `<div class="quickpick-list"></div>`;
      const list = bodyEl.querySelector('.quickpick-list');
      const selectedSet = new Set();
      (req.items || []).forEach((it, idx) => {
        if (it.picked) selectedSet.add(idx);
        const row = document.createElement('div');
        row.className = 'quickpick-item' + (it.picked ? ' selected' : '');
        row.innerHTML = `
          <div style="font-weight:600;">${escapeHtml(it.label)}</div>
          ${it.description ? `<div style="font-size:11px;opacity:0.8;">${escapeHtml(it.description)}</div>` : ''}
          ${it.detail ? `<div style="font-size:11px;opacity:0.7;">${escapeHtml(it.detail)}</div>` : ''}
        `;
        row.addEventListener('click', () => {
          if (req.canPickMany) {
            if (selectedSet.has(idx)) selectedSet.delete(idx);
            else selectedSet.add(idx);
            row.classList.toggle('selected', selectedSet.has(idx));
          } else {
            respond([idx]);
          }
        });
        list.appendChild(row);
      });
      footerEl.innerHTML = req.canPickMany
        ? `<button type="button" class="mini-btn act-cancel">${escapeHtml(tr('cancel'))}</button><button type="button" class="mini-btn primary act-ok">OK</button>`
        : `<button type="button" class="mini-btn act-cancel">${escapeHtml(tr('cancel'))}</button>`;
      footerEl.querySelector('.act-cancel').onclick = () => respond(undefined);
      const okBtn = footerEl.querySelector('.act-ok');
      if (okBtn) okBtn.onclick = () => respond(Array.from(selectedSet));
    } else if (kind === 'toastModal') {
      titleEl.textContent = req.level === 'error' ? 'Error' : req.level === 'warning' ? 'Confirm' : 'Information';
      bodyEl.innerHTML = `
        <p style="margin:0;white-space:pre-wrap;">${escapeHtml(req.message)}</p>
        ${req.detail ? `<pre style="margin:8px 0 0;padding:8px;border-radius:5px;background:var(--vscode-textCodeBlock-background);white-space:pre-wrap;font-size:11.5px;">${escapeHtml(req.detail)}</pre>` : ''}
      `;
      footerEl.innerHTML = `<button type="button" class="mini-btn act-cancel">${escapeHtml(tr('cancel'))}</button>`;
      footerEl.querySelector('.act-cancel').onclick = () => respond(undefined);
      (req.actions || []).forEach((act) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mini-btn primary';
        btn.textContent = act;
        btn.onclick = () => respond(act);
        footerEl.appendChild(btn);
      });
    } else if (kind === 'saveDialog' || kind === 'openDialog') {
      const isSave = kind === 'saveDialog';
      titleEl.textContent = isSave ? (req.saveLabel || 'Save File') : (req.openLabel || 'Open Path');
      const defVal = req.defaultPath || state.homeDir;
      bodyEl.innerHTML = `
        <p style="margin:0;">${isSave ? 'Save to file path:' : 'Enter file or folder path:'}</p>
        <input id="promptPathField" type="text" class="path-input" value="${escapeHtml(defVal)}" />
      `;
      footerEl.innerHTML = `
        <button type="button" class="mini-btn act-cancel">${escapeHtml(tr('cancel'))}</button>
        <button type="button" class="mini-btn primary act-ok">${escapeHtml(isSave ? 'Save' : 'Open')}</button>
      `;
      const input = document.getElementById('promptPathField');
      footerEl.querySelector('.act-cancel').onclick = () => respond(undefined);
      footerEl.querySelector('.act-ok').onclick = () => {
        const v = input.value.trim();
        if (!v) return respond(undefined);
        respond(isSave ? v : [v]);
      };
    }
  }

  /* ==================== Event Bindings ==================== */
  document.getElementById('toggleSidebarBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
  });
  document.getElementById('btnAddLocal').addEventListener('click', () => openLocalModal());
  document.getElementById('sidebarAddLocalBtn').addEventListener('click', () => openLocalModal());
  document.getElementById('btnConnectSsh').addEventListener('click', () => openSshModal());
  document.getElementById('sidebarAddRemoteBtn').addEventListener('click', () => openSshModal());
  document.getElementById('sidebarRefreshSshBtn').addEventListener('click', () => openSshModal());
  document.getElementById('btnToggleTerminal').addEventListener('click', () => toggleTerminalDrawer());
  document.getElementById('btnCloseTermDrawer').addEventListener('click', () => toggleTerminalDrawer(false));
  document.getElementById('btnNewRepoTerm').addEventListener('click', () => {
    openTerminalSession(state.activeRepo || state.homeDir, undefined, null);
  });
  document.getElementById('btnOpenSysTerm').addEventListener('click', async () => {
    try {
      await rpc('term:openSystem', { repo: state.activeRepo || state.homeDir });
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
  document.getElementById('btnAppSettings').addEventListener('click', () => openAppSettingsModal());
  document.getElementById('btnToggleTheme').addEventListener('click', () => toggleTheme());
  document.getElementById('btnToggleLang').addEventListener('click', async () => {
    state.lang = state.lang === 'zh' ? 'en' : 'zh';
    applyLanguageUI();
    await rpc('settings:update', {
      key: 'git-map.language',
      value: state.lang === 'zh' ? 'Simplified Chinese' : 'English'
    }).catch(() => {});
  });

  // Modal Close Buttons
  document.querySelectorAll('.modal-close').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-close');
      if (targetId) document.getElementById(targetId).classList.add('hidden');
    });
  });

  // SSH Host Add Form
  document.getElementById('btnShowAddHostForm').addEventListener('click', () => {
    document.getElementById('sshHostForm').classList.toggle('hidden');
  });
  document.getElementById('btnCancelHostForm').addEventListener('click', () => {
    document.getElementById('sshHostForm').classList.add('hidden');
  });
  document.getElementById('sshHostForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const res = await rpc('ssh:saveHost', {
        name: document.getElementById('sshFormName').value,
        host: document.getElementById('sshFormHost').value,
        port: Number(document.getElementById('sshFormPort').value) || 22,
        user: document.getElementById('sshFormUser').value,
        authType: document.getElementById('sshFormAuth').value,
        privateKeyPath: document.getElementById('sshFormKey').value,
        password: document.getElementById('sshFormPassword').value,
        proxyJump: document.getElementById('sshFormJump').value,
        defaultPath: document.getElementById('sshFormDefaultPath').value
      });
      state.sshHosts = res.hosts || [];
      document.getElementById('sshHostForm').classList.add('hidden');
      document.getElementById('sshFormPassword').value = '';
      renderSidebar();
      renderModalSshHosts();
      selectAndBrowseSshHost(res.profile.id, res.profile.defaultPath || '~');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // SSH Path Controls
  document.getElementById('btnSshUp').addEventListener('click', () => {
    if (state.selectedSshHostId && state.sshParentPath) {
      selectAndBrowseSshHost(state.selectedSshHostId, state.sshParentPath);
    }
  });
  document.getElementById('btnSshHome').addEventListener('click', () => {
    if (state.selectedSshHostId) selectAndBrowseSshHost(state.selectedSshHostId, '~');
  });
  document.getElementById('btnSshRefresh').addEventListener('click', () => {
    if (state.selectedSshHostId) selectAndBrowseSshHost(state.selectedSshHostId, state.sshCurrentPath);
  });
  document.getElementById('btnSshGo').addEventListener('click', () => {
    if (state.selectedSshHostId) {
      selectAndBrowseSshHost(state.selectedSshHostId, document.getElementById('sshPathInput').value.trim() || '~');
    }
  });
  document.getElementById('sshPathInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && state.selectedSshHostId) {
      selectAndBrowseSshHost(state.selectedSshHostId, e.target.value.trim() || '~');
    }
  });
  document.getElementById('sshShowHidden').addEventListener('change', () => {
    if (state.selectedSshHostId) selectAndBrowseSshHost(state.selectedSshHostId, state.sshCurrentPath);
  });

  // Local Path Controls
  document.getElementById('btnLocalUp').addEventListener('click', () => {
    if (state.localParentPath) browseLocalPath(state.localParentPath);
  });
  document.getElementById('btnLocalHome').addEventListener('click', () => browseLocalPath('~'));
  document.getElementById('btnLocalGo').addEventListener('click', () => {
    browseLocalPath(document.getElementById('localPathInput').value.trim() || '~');
  });
  document.getElementById('localPathInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') browseLocalPath(e.target.value.trim() || '~');
  });
  document.getElementById('localShowHidden').addEventListener('change', () => {
    browseLocalPath(state.localCurrentPath);
  });
  document.getElementById('btnLocalScan').addEventListener('click', async () => {
    try {
      const res = await rpc('repos:scanLocal', { path: state.localCurrentPath, maxDepth: 3 });
      state.repos = res.repos || state.repos;
      renderSidebar();
      document.getElementById('localModal').classList.add('hidden');
      showToast(res.added ? 'Scanned & added repositories!' : tr('noReposScanned'), 'info');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
  document.getElementById('btnNativePicker').addEventListener('click', async () => {
    if (!desktopApi) return;
    const chosen = await desktopApi.pickLocalFolder();
    if (chosen) {
      await addLocalRepoAndClose(chosen);
    }
  });

  // Initialize UI
  applyTheme(state.theme);
  applyLanguageUI();
  renderTabBar();
  connectWs();
})();
