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
      appSettingsTitle: '设置',
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
      binaryFileNotice: '二进制文件，无法直接显示文本差异。',
      transfersTitle: '传输',
      remoteServers: '远程服务器 (SSH)',
      hostTags: '标签 (可选，逗号分隔)',
      navAppearance: '外观',
      navTools: '终端与编辑器',
      navAi: 'AI',
      themeLabel: '主题',
      themeDark: '深色',
      themeLight: '浅色',
      diffSyntax: 'Diff 语法高亮',
      optOn: '开启',
      optOff: '关闭',
      externalTerminal: '外部终端',
      externalTerminalHint: '“在终端中打开”会在本地仓库目录打开；远程仓库会通过 SSH 登录并进入远程仓库目录。',
      terminalApp: '终端应用',
      customCommand: '自定义命令',
      codeEditor: '代码编辑器',
      editorApp: '编辑器',
      placeholderHint: '自定义命令占位符：{path} 路径，{host} SSH 主机，{sshCommand} 完整 ssh 登录命令，{sshUri} ssh:// 地址。',
      testTerminal: '在当前仓库测试终端',
      testEditor: '在当前仓库测试编辑器',
      redetect: '重新检测',
      systemDefault: '系统默认',
      autoDetect: '自动（第一个已安装的）',
      customOption: '自定义命令…',
      notInstalled: '未安装',
      localOnly: '仅本地',
      aiProvider: 'AI 服务',
      aiModel: '模型',
      aiBaseUrl: 'API 地址（可选）',
      aiApiKey: 'API Key',
      clearKey: '清除已保存的 Key',
      keySaved: '已保存（留空保持不变）',
      keyNotNeeded: '该服务无需 API Key',
      aiExplainToggle: '启用 AI 解释提交 (Explain Commit)',
      aiCommitToggle: '启用 AI 生成提交信息',
      hintMagpie: '请求经由本机 Magpie 网关转发到其中已登录的模型服务。请保持 Magpie 运行，并填写它提供的模型名；无需 API Key。默认地址读取 ~/.config/magpie/gateway.json。',
      hintCcSwitch: '请求经由 CC Switch 本地路由转发到当前为 Codex 选中的服务商。请在 CC Switch 中开启本地路由，并填写该服务商的模型名；无需 API Key。',
      hintOllama: '使用本机 Ollama 服务，无需 API Key。',
      openedIn: '已在 {0} 中打开',
      openInTerminal: '在外部终端中打开',
      openInEditor: '在编辑器中打开',
      settingsSaved: '设置已保存',
      noActiveRepo: '请先选择一个仓库'
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
      appSettingsTitle: 'Settings',
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
      binaryFileNotice: 'Binary file — text diff cannot be shown.',
      transfersTitle: 'Transfers',
      remoteServers: 'Remote Servers (SSH)',
      hostTags: 'Tags (optional, comma separated)',
      navAppearance: 'Appearance',
      navTools: 'Terminal & Editor',
      navAi: 'AI',
      themeLabel: 'Theme',
      themeDark: 'Dark',
      themeLight: 'Light',
      diffSyntax: 'Diff Syntax Highlighting',
      optOn: 'On',
      optOff: 'Off',
      externalTerminal: 'External Terminal',
      externalTerminalHint: '"Open in Terminal" opens local repositories in their folder; remote repositories log in over SSH and change to the repository folder.',
      terminalApp: 'Terminal App',
      customCommand: 'Custom Command',
      codeEditor: 'Code Editor',
      editorApp: 'Editor',
      placeholderHint: 'Custom command placeholders: {path} path, {host} SSH host, {sshCommand} full ssh login command, {sshUri} ssh:// URI.',
      testTerminal: 'Try Terminal on Current Repo',
      testEditor: 'Try Editor on Current Repo',
      redetect: 'Detect Again',
      systemDefault: 'System Default',
      autoDetect: 'Auto (first installed)',
      customOption: 'Custom Command…',
      notInstalled: 'not installed',
      localOnly: 'local only',
      aiProvider: 'AI Provider',
      aiModel: 'Model',
      aiBaseUrl: 'API Base URL (Optional)',
      aiApiKey: 'API Key',
      clearKey: 'Clear Saved Key',
      keySaved: 'Saved (leave blank to keep)',
      keyNotNeeded: 'No API key needed',
      aiExplainToggle: 'Enable AI Explain Commit',
      aiCommitToggle: 'Enable AI Commit Message Generation',
      hintMagpie: 'Requests go through the local Magpie gateway to the providers signed in to it. Keep Magpie running and set a model it serves; no API key needed. The default address is read from ~/.config/magpie/gateway.json.',
      hintCcSwitch: 'Requests go through the CC Switch local routing to the provider currently selected for Codex. Turn on local routing in CC Switch and set a model that provider serves; no API key needed.',
      hintOllama: 'Uses the local Ollama server; no API key needed.',
      openedIn: 'Opened in {0}',
      openInTerminal: 'Open in External Terminal',
      openInEditor: 'Open in Editor',
      settingsSaved: 'Settings saved',
      noActiveRepo: 'Select a repository first'
    }
  };

  const ICONS = window.GITMAP_ICONS || {};

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
        fullDisplay: `${(state.sshHosts || []).find((h) => h.id === hostId)?.alias || hostId}:${remotePath}`,
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
    if (desktopApi.onMainError) {
      desktopApi.onMainError((message) => showToast(message, 'error'));
    }
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
    // Show the theme the button switches to
    document.getElementById('themeIcon').innerHTML = state.theme === 'light' ? ICONS.moon : ICONS.sun;
    document.getElementById('btnToggleTheme').title = state.theme === 'light'
      ? (state.lang === 'zh' ? '切换到深色主题' : 'Switch to Dark Theme')
      : (state.lang === 'zh' ? '切换到浅色主题' : 'Switch to Light Theme');
    state.terminals.forEach((t) => {
      try {
        t.term.options.theme = TERMINAL_THEMES[state.theme];
      } catch (_) {}
    });

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
    document.documentElement.lang = state.lang === 'zh' ? 'zh-CN' : 'en';
    const hostSearch = document.getElementById('sshHostSearch');
    if (hostSearch) hostSearch.placeholder = state.lang === 'zh' ? '筛选主机、别名或 #标签' : 'Filter hosts, aliases or #tags';
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
        if (state.settings['git-map.language'] === 'Simplified Chinese' || state.settings['git-map.language'] === 'English') {
          const lang = state.settings['git-map.language'] === 'English' ? 'en' : 'zh';
          if (lang !== state.lang) {
            state.lang = lang;
            applyLanguageUI();
          }
        }
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

      case 'panel:message': {
        const frame = document.querySelector('#panel-vfh-' + CSS.escape(String(msg.panelId)) + ' iframe');
        if (frame && frame.contentWindow) frame.contentWindow.postMessage(msg.payload, '*');
        break;
      }

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
          t.exited = true;
          t.tabEl.classList.add('exited');
          t.term.writeln(`\r\n\x1b[90m[Process exited with code ${msg.code}]\x1b[0m`);
        }
        break;
      }

      case 'ssh:hostsChanged':
        state.sshHosts = msg.hosts || state.sshHosts;
        renderSidebar();
        renderActiveRepoBadge();
        if (!document.getElementById('sshModal').classList.contains('hidden')) renderModalSshHosts();
        break;

      case 'transfers:update':
        onTransfersUpdate(msg.transfers);
        break;

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

  /* ==================== Host labels & tags ==================== */
  function findHost(hostId) {
    return (state.sshHosts || []).find((h) => h.id === hostId) || null;
  }

  /** The name a host is shown with: its GitMap alias, else its ~/.ssh/config alias / saved name, else its id. */
  function hostLabel(hostId) {
    const h = findHost(hostId);
    return h ? h.alias || h.name || h.id : hostId;
  }

  function hostAddress(h) {
    return h ? `${h.user}@${h.host}${h.port && h.port !== 22 ? ':' + h.port : ''}` : '';
  }

  /** A stable hue per tag, so a tag has the same colour everywhere. */
  function tagHue(tag) {
    let hash = 0;
    const s = String(tag).toLowerCase();
    for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
    return hash % 360;
  }

  function tagChipsHtml(tags, extraCls) {
    return (tags || []).map((t) => `<span class="tag-chip ${extraCls || ''}" style="--tag-hue:${tagHue(t)}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</span>`).join('');
  }

  function allHostTags() {
    const map = new Map();
    (state.sshHosts || []).forEach((h) => (h.tags || []).forEach((t) => {
      if (!map.has(t.toLowerCase())) map.set(t.toLowerCase(), t);
    }));
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }

  function refreshTagSuggestions() {
    const dl = document.getElementById('gmTagSuggestions');
    if (dl) dl.innerHTML = allHostTags().map((t) => `<option value="${escapeHtml(t)}"></option>`).join('');
  }

  function loadUiSet(key) {
    try {
      return new Set(JSON.parse(localStorage.getItem(key) || '[]'));
    } catch (_) {
      return new Set();
    }
  }

  function saveUiSet(key, set) {
    try {
      localStorage.setItem(key, JSON.stringify(Array.from(set)));
    } catch (_) {}
  }

  state.collapsedHosts = loadUiSet('gitmap.sidebar.collapsedHosts');
  state.remoteTagFilter = (() => {
    try {
      return localStorage.getItem('gitmap.sidebar.tagFilter') || '';
    } catch (_) {
      return '';
    }
  })();
  state.showIdleHosts = (() => {
    try {
      return localStorage.getItem('gitmap.sidebar.showIdleHosts') === '1';
    } catch (_) {
      return false;
    }
  })();

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
      ? `<span class="icon-slot">${ICONS.remote}</span><strong>${escapeHtml(hostLabel(info.hostId))}</strong><span>${escapeHtml(info.remotePath)}</span>`
      : `<span class="icon-slot">${ICONS.folder}</span><span>${escapeHtml(info.fullDisplay)}</span>`;
    badge.title = (state.lang === 'zh' ? '点击复制路径：' : 'Click to copy the path: ') + info.fullDisplay;
    badge.onclick = () => {
      const textToCopy = info.isRemote ? info.remotePath : info.fullDisplay;
      navigator.clipboard?.writeText(textToCopy).catch(() => {});
      showToast(tr('copiedPath') + textToCopy, 'info');
    };
  }

  function renderSidebar() {
    const localContainer = document.getElementById('localRepoList');
    const repoKeys = Object.keys(state.repos);
    const localKeys = repoKeys.filter((k) => !k.startsWith('ssh://')).sort();

    // Local Repos
    if (localKeys.length === 0) {
      localContainer.innerHTML = `<div class="sidebar-empty">${escapeHtml(tr('noLocalRepos'))}</div>`;
    } else {
      localContainer.innerHTML = '';
      const dupNames = duplicateNames(localKeys);
      localKeys.forEach((repoKey) => {
        localContainer.appendChild(buildRepoSidebarItem(repoKey, { disambiguate: dupNames }));
      });
    }

    renderRemoteTree(repoKeys.filter((k) => k.startsWith('ssh://')));
    refreshTagSuggestions();
  }

  /** Names shared by more than one repository (those get their parent folder added to tell them apart). */
  function duplicateNames(keys) {
    const counts = new Map();
    keys.forEach((k) => {
      const n = parseRepoDisplay(k).name.toLowerCase();
      counts.set(n, (counts.get(n) || 0) + 1);
    });
    return new Set(Array.from(counts.entries()).filter(([, c]) => c > 1).map(([n]) => n));
  }

  function renderRemoteTree(remoteKeys) {
    const container = document.getElementById('remoteRepoList');
    const filterEl = document.getElementById('remoteTagFilter');
    const zh = state.lang === 'zh';

    // Group repositories by host (hosts that no longer exist in the host list still get a group)
    const byHost = new Map();
    remoteKeys.forEach((k) => {
      const hostId = parseRepoDisplay(k).hostId;
      if (!byHost.has(hostId)) byHost.set(hostId, []);
      byHost.get(hostId).push(k);
    });
    const hosts = (state.sshHosts || []).slice();
    byHost.forEach((_keys, hostId) => {
      if (!hosts.some((h) => h.id === hostId)) hosts.push({ id: hostId, name: hostId, host: hostId, user: '', port: 22, tags: [], source: 'unknown', connected: false });
    });

    // Tag filter chips
    const tags = allHostTags();
    if (state.remoteTagFilter && !tags.some((t) => t.toLowerCase() === state.remoteTagFilter.toLowerCase())) state.remoteTagFilter = '';
    if (tags.length === 0) {
      filterEl.classList.add('hidden');
      filterEl.innerHTML = '';
    } else {
      filterEl.classList.remove('hidden');
      filterEl.innerHTML = `<button type="button" class="tag-chip tag-all ${state.remoteTagFilter ? '' : 'selected'}" data-tag="">${escapeHtml(zh ? '全部' : 'All')}</button>` +
        tags.map((t) => `<button type="button" class="tag-chip ${state.remoteTagFilter.toLowerCase() === t.toLowerCase() ? 'selected' : ''}" style="--tag-hue:${tagHue(t)}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('');
      filterEl.querySelectorAll('.tag-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          const tag = chip.getAttribute('data-tag') || '';
          state.remoteTagFilter = state.remoteTagFilter.toLowerCase() === tag.toLowerCase() ? '' : tag;
          try {
            localStorage.setItem('gitmap.sidebar.tagFilter', state.remoteTagFilter);
          } catch (_) {}
          renderSidebar();
        });
      });
    }
    const matchesTag = (h) => !state.remoteTagFilter || (h.tags || []).some((t) => t.toLowerCase() === state.remoteTagFilter.toLowerCase());

    const withRepos = hosts.filter((h) => byHost.has(h.id) && matchesTag(h)).sort((a, b) => hostLabel(a.id).localeCompare(hostLabel(b.id)));
    const idle = hosts.filter((h) => !byHost.has(h.id) && matchesTag(h)).sort((a, b) => hostLabel(a.id).localeCompare(hostLabel(b.id)));
    const dupNames = duplicateNames(remoteKeys);

    container.innerHTML = '';
    if (withRepos.length === 0 && idle.length === 0) {
      container.innerHTML = `<div class="sidebar-empty">${escapeHtml(state.remoteTagFilter ? (zh ? '没有带此标签的服务器' : 'No servers with this tag') : tr('noSshHosts'))}</div>`;
      return;
    }
    if (withRepos.length === 0 && !state.remoteTagFilter) {
      const hint = document.createElement('div');
      hint.className = 'sidebar-empty';
      hint.textContent = tr('noRemoteRepos');
      container.appendChild(hint);
    }

    withRepos.forEach((h) => {
      const keys = byHost.get(h.id).slice().sort((a, b) => parseRepoDisplay(a).remotePath.localeCompare(parseRepoDisplay(b).remotePath));
      const collapsed = state.collapsedHosts.has(h.id);
      const group = document.createElement('div');
      group.className = 'host-group' + (collapsed ? ' collapsed' : '') + (keys.includes(state.activeRepo) ? ' has-active' : '');
      group.appendChild(buildHostHeader(h, keys.length, collapsed));
      if (!collapsed) {
        const list = document.createElement('div');
        list.className = 'host-group-repos';
        keys.forEach((k) => list.appendChild(buildRepoSidebarItem(k, { disambiguate: dupNames, homeDir: h.homeDir })));
        group.appendChild(list);
      }
      container.appendChild(group);
    });

    if (idle.length > 0) {
      const others = document.createElement('div');
      others.className = 'host-idle' + (state.showIdleHosts ? ' expanded' : '');
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'host-idle-toggle';
      toggle.innerHTML = `<span class="chev">${state.showIdleHosts ? ICONS.chevronDown : ICONS.arrowRight}</span><span>${escapeHtml(withRepos.length > 0 ? (zh ? `其他主机 (${idle.length})` : `Other hosts (${idle.length})`) : (zh ? `SSH 主机 (${idle.length})` : `SSH hosts (${idle.length})`))}</span>`;
      toggle.addEventListener('click', () => {
        state.showIdleHosts = !state.showIdleHosts;
        try {
          localStorage.setItem('gitmap.sidebar.showIdleHosts', state.showIdleHosts ? '1' : '0');
        } catch (_) {}
        renderSidebar();
      });
      others.appendChild(toggle);
      if (state.showIdleHosts) {
        idle.forEach((h) => others.appendChild(buildHostHeader(h, 0, true, true)));
      }
      container.appendChild(others);
    }
  }

  function buildHostHeader(h, repoCount, collapsed, idle) {
    const zh = state.lang === 'zh';
    const header = document.createElement('div');
    header.className = 'host-group-header' + (idle ? ' idle' : '');
    header.title = [h.alias ? h.name : '', hostAddress(h), h.proxyJump ? 'via ' + h.proxyJump : ''].filter(Boolean).join(' · ');
    header.innerHTML = `
      ${idle ? '' : `<span class="chev">${collapsed ? ICONS.arrowRight : ICONS.chevronDown}</span>`}
      <i class="status-dot ${h.connected ? 'connected' : ''}"></i>
      <span class="host-group-name">${escapeHtml(hostLabel(h.id))}</span>
      <span class="host-group-tags">${tagChipsHtml(h.tags, 'small')}</span>
      ${repoCount > 0 ? `<span class="host-group-count">${repoCount}</span>` : ''}
      <span class="host-group-actions">
        <button type="button" class="mini-icon-btn act-browse" title="${escapeHtml(zh ? '浏览路径 / 添加仓库' : 'Browse Paths / Add Repository')}">${ICONS.folderPlus}</button>
        ${h.source !== 'unknown' ? `<button type="button" class="mini-icon-btn act-host-term" title="${escapeHtml(zh ? '在外部终端中登录此主机' : 'Log In to This Host in External Terminal')}">${ICONS.externalTerminal}</button>
        <button type="button" class="mini-icon-btn act-host-edit" title="${escapeHtml(zh ? '别名与标签' : 'Alias & Tags')}">${ICONS.pencil}</button>` : ''}
        ${h.connected ? `<button type="button" class="mini-icon-btn act-host-disconnect" title="${escapeHtml(zh ? '断开连接' : 'Disconnect')}">${ICONS.close}</button>` : ''}
      </span>
    `;
    header.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (btn) {
        e.stopPropagation();
        if (btn.classList.contains('act-browse')) openSshModal(h.id);
        else if (btn.classList.contains('act-host-term')) openExternalTerminal('ssh://' + encodeURIComponent(h.id) + (h.homeDir || '/~')).catch((err) => showToast(err.message, 'error'));
        else if (btn.classList.contains('act-host-edit')) openHostMetaDialog(h.id);
        else if (btn.classList.contains('act-host-disconnect')) {
          rpc('ssh:disconnect', { hostId: h.id }).then((res) => {
            state.sshHosts = res.hosts || state.sshHosts;
            renderSidebar();
          }).catch((err) => showToast(err.message, 'error'));
        }
        return;
      }
      if (e.target.closest('.tag-chip')) {
        state.remoteTagFilter = e.target.closest('.tag-chip').getAttribute('data-tag') || '';
        renderSidebar();
        return;
      }
      if (idle) {
        openSshModal(h.id);
        return;
      }
      if (state.collapsedHosts.has(h.id)) state.collapsedHosts.delete(h.id);
      else state.collapsedHosts.add(h.id);
      saveUiSet('gitmap.sidebar.collapsedHosts', state.collapsedHosts);
      renderSidebar();
    });
    return header;
  }

  /** Edit the GitMap alias & tags of a host (both ~/.ssh/config and saved hosts). */
  function openHostMetaDialog(hostId) {
    const h = findHost(hostId);
    if (!h) return;
    const zh = state.lang === 'zh';
    const modal = document.getElementById('promptModal');
    document.getElementById('promptTitle').textContent = (zh ? '服务器别名与标签：' : 'Server Alias & Tags: ') + h.name;
    const bodyEl = document.getElementById('promptBody');
    const footerEl = document.getElementById('promptFooter');
    const suggestions = allHostTags().filter((t) => !(h.tags || []).some((x) => x.toLowerCase() === t.toLowerCase()));
    bodyEl.innerHTML = `
      <label><span>${escapeHtml(zh ? '显示名称（别名）' : 'Display Name (Alias)')}</span>
        <input type="text" id="hostMetaAlias" spellcheck="false" maxlength="64" placeholder="${escapeHtml(h.name)}" value="${escapeHtml(h.alias || '')}" /></label>
      <label><span>${escapeHtml(zh ? '标签（逗号或空格分隔）' : 'Tags (comma or space separated)')}</span>
        <input type="text" id="hostMetaTags" spellcheck="false" list="gmTagSuggestions" placeholder="prod, staging, gpu" value="${escapeHtml((h.tags || []).join(', '))}" /></label>
      <div id="hostMetaPreview" class="tag-preview"></div>
      ${suggestions.length ? `<div class="tag-suggest"><span>${escapeHtml(zh ? '已有标签：' : 'Existing tags:')}</span>${tagChipsHtml(suggestions, 'small clickable')}</div>` : ''}
      <p class="settings-hint">${escapeHtml(h.source === 'ssh-config'
        ? (zh ? `连接信息 ${hostAddress(h)} 来自 ~/.ssh/config（别名 “${h.id}”）。别名和标签只保存在 GitMap 中，不会修改 ~/.ssh/config，已添加的仓库不受影响。` : `The connection (${hostAddress(h)}) comes from ~/.ssh/config (Host "${h.id}"). The alias & tags are only stored in GitMap: ~/.ssh/config isn't changed, and repositories on this host keep working.`)
        : (zh ? `连接：${hostAddress(h)}。别名只改变显示名称，已添加的仓库不受影响。` : `Connection: ${hostAddress(h)}. The alias only changes the name shown; repositories on this host keep working.`))}</p>
    `;
    footerEl.innerHTML = `${h.source === 'saved' ? `<button type="button" class="mini-btn act-edit-conn">${escapeHtml(zh ? '修改连接设置…' : 'Edit Connection…')}</button><span style="flex:1"></span>` : ''}
      <button type="button" class="mini-btn act-cancel">${escapeHtml(tr('cancel'))}</button>
      <button type="button" class="mini-btn primary act-ok">${escapeHtml(zh ? '保存' : 'Save')}</button>`;
    modal.classList.remove('hidden');

    const aliasInput = document.getElementById('hostMetaAlias');
    const tagsInput = document.getElementById('hostMetaTags');
    const preview = document.getElementById('hostMetaPreview');
    const parseTags = () => tagsInput.value.split(/[,，\s]+/).map((t) => t.trim().replace(/^#+/, '')).filter(Boolean);
    const updatePreview = () => {
      preview.innerHTML = tagChipsHtml(parseTags());
    };
    tagsInput.addEventListener('input', updatePreview);
    bodyEl.querySelectorAll('.tag-suggest .tag-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const current = parseTags();
        const tag = chip.getAttribute('data-tag');
        if (!current.some((t) => t.toLowerCase() === tag.toLowerCase())) current.push(tag);
        tagsInput.value = current.join(', ');
        chip.remove();
        updatePreview();
      });
    });
    updatePreview();

    const close = () => modal.classList.add('hidden');
    const save = async () => {
      try {
        const res = await rpc('ssh:updateHostMeta', { id: h.id, alias: aliasInput.value, tags: parseTags() });
        state.sshHosts = res.hosts || state.sshHosts;
        close();
        renderSidebar();
        renderModalSshHosts();
        renderActiveRepoBadge();
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
    [aliasInput, tagsInput].forEach((el) => el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') save();
    }));
    footerEl.querySelector('.act-ok').onclick = save;
    footerEl.querySelector('.act-cancel').onclick = close;
    document.getElementById('promptCloseBtn').onclick = close;
    const editConn = footerEl.querySelector('.act-edit-conn');
    if (editConn) {
      editConn.onclick = () => {
        close();
        openSshModal().then(() => openHostForm(h));
      };
    }
    setTimeout(() => aliasInput.focus(), 30);
  }

  /** Show the SSH host form, empty (new host) or filled in (editing a saved host). */
  function openHostForm(h) {
    const form = document.getElementById('sshHostForm');
    const zh = state.lang === 'zh';
    form.classList.remove('hidden');
    document.getElementById('sshFormTitle').textContent = h ? (zh ? '编辑 SSH 连接：' : 'Edit SSH Connection: ') + h.name : tr('configureSshHost');
    document.getElementById('sshFormId').value = h ? h.id : '';
    document.getElementById('sshFormName').value = h ? h.name : '';
    document.getElementById('sshFormHost').value = h ? h.host : '';
    document.getElementById('sshFormPort').value = h ? String(h.port || 22) : '22';
    document.getElementById('sshFormUser').value = h ? h.user : '';
    document.getElementById('sshFormAuth').value = h ? h.authType || 'auto' : 'auto';
    document.getElementById('sshFormKey').value = h && h.privateKeyPath ? h.privateKeyPath : '';
    document.getElementById('sshFormPassword').value = '';
    document.getElementById('sshFormPassword').placeholder = h ? (zh ? '留空保持不变' : 'Leave blank to keep') : '••••••••';
    document.getElementById('sshFormJump').value = h && h.proxyJump ? h.proxyJump : '';
    document.getElementById('sshFormDefaultPath').value = h && h.defaultPath ? h.defaultPath : '';
    document.getElementById('sshFormTags').value = h && h.tags ? h.tags.join(', ') : '';
    form.scrollIntoView({ block: 'nearest' });
    document.getElementById('sshFormName').focus();
  }

  function buildRepoSidebarItem(repoKey, opts) {
    const info = parseRepoDisplay(repoKey);
    const options = opts || {};
    let label = info.name;
    const pathForLabel = info.isRemote ? info.remotePath : info.fullDisplay;
    if (options.disambiguate && options.disambiguate.has(info.name.toLowerCase()) && !(state.repos[repoKey] && state.repos[repoKey].name)) {
      const parts = pathForLabel.replace(/[\\/]+$/, '').split(/[\\/]/).filter(Boolean);
      if (parts.length >= 2) label = parts[parts.length - 2] + '/' + parts[parts.length - 1];
    }
    let pathLine = info.fullDisplay;
    if (info.isRemote) {
      pathLine = options.homeDir && (info.remotePath === options.homeDir || info.remotePath.startsWith(options.homeDir + '/'))
        ? '~' + info.remotePath.substring(options.homeDir.length)
        : info.remotePath;
    }
    const el = document.createElement('div');
    el.className = 'repo-item' + (info.isRemote ? ' is-remote' : '') + (state.activeRepo === repoKey ? ' active' : '');
    el.title = info.isRemote ? `${hostLabel(info.hostId)}:${info.remotePath}` : info.fullDisplay;
    el.innerHTML = `
      <div class="repo-item-top">
        <span class="repo-item-name">${escapeHtml(label)}</span>
        <span class="repo-item-actions">
          <button class="mini-icon-btn act-term" title="${escapeHtml(state.lang === 'zh' ? '内置终端' : 'Integrated Terminal')}">${ICONS.terminal}</button>
          <button class="mini-icon-btn act-ext-term" title="${escapeHtml(tr('openInTerminal'))}">${ICONS.externalTerminal}</button>
          <button class="mini-icon-btn act-editor" title="${escapeHtml(tr('openInEditor'))}">${ICONS.editor}</button>
          <button class="mini-icon-btn act-remove" title="${escapeHtml(state.lang === 'zh' ? '从列表移除' : 'Remove from List')}">${ICONS.close}</button>
        </span>
      </div>
      <div class="repo-item-path">${escapeHtml(pathLine)}</div>
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
      openTerminalSession(repoKey, info.isRemote ? `${hostLabel(info.hostId)}: ${label}` : label, null);
    });
    el.querySelector('.act-ext-term').addEventListener('click', (e) => {
      e.stopPropagation();
      openExternalTerminal(repoKey).catch((err) => showToast(err.message, 'error'));
    });
    el.querySelector('.act-editor').addEventListener('click', (e) => {
      e.stopPropagation();
      openInEditor(repoKey).catch((err) => showToast(err.message, 'error'));
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

  /* ==================== Syntax Highlighting ==================== */
  /**
   * Get a highlighter for a file path (NULL when highlighting is turned off, the language is unknown, or highlight.js didn't load).
   */
  function getSyntaxHighlighter(filePath) {
    if (state.settings['gitmap.diff.syntaxHighlight'] === false || !window.GitMapSyntax) return null;
    const language = window.GitMapSyntax.languageForPath(filePath);
    if (language === null) return null;
    return { language, highlight: (text) => window.GitMapSyntax.highlightToLines(text, language) };
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

    // Syntax highlighting: highlight each side of the file as a whole, then look lines up by their line number
    const syntax = getSyntaxHighlighter(diffData.newFilePath || diffData.oldFilePath);
    let oldSyntaxLines = null;
    let newSyntaxLines = null;
    if (syntax !== null && !diffData.isBinary && !diffData.error && Array.isArray(diffData.rows)) {
      const oldArr = [];
      const newArr = [];
      diffData.rows.forEach((r) => {
        if (r.oldLineNumber != null) oldArr[r.oldLineNumber - 1] = r.oldText == null ? '' : r.oldText;
        if (r.newLineNumber != null) newArr[r.newLineNumber - 1] = r.newText == null ? '' : r.newText;
      });
      oldSyntaxLines = syntax.highlight(Array.from(oldArr, (l) => (l == null ? '' : l)).join('\n'));
      newSyntaxLines = syntax.highlight(Array.from(newArr, (l) => (l == null ? '' : l)).join('\n'));
    }

    function formatSide(isOld, lineNumber, text, segs, cls) {
      if (text == null) return '';
      const lines = isOld ? oldSyntaxLines : newSyntaxLines;
      const runs = lines && lineNumber != null ? lines[lineNumber - 1] || null : null;
      return window.GitMapSyntax ? window.GitMapSyntax.renderLine(runs, text, segs, cls) : escapeHtml(text);
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
              <td class="diff-code diff-side-left ${leftCls}">${formatSide(true, r.oldLineNumber, r.oldText, r.oldSegments, 'word-del')}</td>
              <td class="diff-gutter ${rightCls}">${r.newLineNumber ?? ''}</td>
              <td class="diff-code diff-side-right ${rightCls}">${formatSide(false, r.newLineNumber, r.newText, r.newSegments, 'word-add')}</td>
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
                <td class="diff-code diff-cell-del"><span class="diff-sign">-</span>${formatSide(true, r.oldLineNumber, r.oldText, r.oldSegments, 'word-del')}</td>
              `;
              const trAdd = document.createElement('tr');
              trAdd.innerHTML = `
                <td class="diff-gutter diff-cell-add"></td>
                <td class="diff-gutter diff-cell-add">${r.newLineNumber ?? ''}</td>
                <td class="diff-code diff-cell-add"><span class="diff-sign">+</span>${formatSide(false, r.newLineNumber, r.newText, r.newSegments, 'word-add')}</td>
              `;
              if (!prevWasChange) hunkRowElements.push(trDel);
              prevWasChange = true;
              tbody.appendChild(trDel);
              tbody.appendChild(trAdd);
            } else {
              const trEl = document.createElement('tr');
              const cls = r.kind === 'added' ? 'diff-cell-add' : r.kind === 'deleted' ? 'diff-cell-del' : '';
              const sign = r.kind === 'added' ? '+' : r.kind === 'deleted' ? '-' : ' ';
              const codeHtml = r.kind === 'deleted'
                ? formatSide(true, r.oldLineNumber, r.oldText ?? '', null, '')
                : formatSide(false, r.newLineNumber, r.newText ?? '', null, '');
              trEl.innerHTML = `
                <td class="diff-gutter ${cls}">${r.oldLineNumber ?? ''}</td>
                <td class="diff-gutter ${cls}">${r.newLineNumber ?? ''}</td>
                <td class="diff-code ${cls}"><span class="diff-sign">${sign}</span>${codeHtml}</td>
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
            ${fileRes.truncated ? `<span class="diff-stat-del">${escapeHtml(state.lang === 'zh' ? '文件较大，仅显示前 5 MB' : 'Large file: showing the first 5 MB')}</span>` : ''}
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
      const normalizedContent = fileRes.content.replace(/\r\n/g, '\n');
      const lines = normalizedContent.split('\n');
      const fileSyntax = getSyntaxHighlighter(fileRes.filePath);
      const syntaxLines = fileSyntax !== null ? fileSyntax.highlight(normalizedContent) : null;

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
            <td class="diff-code">${syntaxLines && window.GitMapSyntax ? window.GitMapSyntax.renderLine(syntaxLines[idx] || null, lineText, null, '') : escapeHtml(lineText)}</td>
          `;
          tbody.appendChild(trEl);
        });

        table.appendChild(tbody);
        scrollArea.innerHTML = '';
        scrollArea.appendChild(table);
      };

      // One delegated listener for line-number selection & blame clicks (instead of one per line on every render)
      scrollArea.addEventListener('click', (ev) => {
        const numEl = ev.target.closest('.file-line-num');
        if (numEl) {
          const clicked = Number(numEl.getAttribute('data-line'));
          if (ev.shiftKey && selStart !== null) {
            selStart = Math.min(selStart, clicked);
            selEnd = Math.max(selEnd || selStart, clicked);
          } else {
            selStart = clicked;
            selEnd = clicked;
          }
          scrollArea.querySelectorAll('tr.file-line-row').forEach((row, idx) => {
            row.classList.toggle('selected-line', idx + 1 >= selStart && idx + 1 <= selEnd);
          });
          return;
        }
        const bg = ev.target.closest('.blame-gutter[data-hash]');
        const h = bg && bg.getAttribute('data-hash');
        if (h) {
          sendWs({
            type: 'graph:request',
            payload: { command: 'commitDetails', repo: fileRes.repo, commitHash: h, hasParents: true, stash: null, avatarEmail: null, refresh: false }
          });
          rpc('repos:select', { repo: fileRes.repo });
          activateTab('graph');
        }
      });

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
  const TERMINAL_THEMES = {
    dark: { background: '#141414', foreground: '#d4d4d4', cursor: '#d4d4d4', selectionBackground: '#264f78' },
    light: { background: '#ffffff', foreground: '#1f2328', cursor: '#1f2328', selectionBackground: '#add6ff' }
  };
  let terminalCreateInFlight = null;

  function setTerminalDrawerVisible(visible) {
    const drawer = document.getElementById('terminalDrawer');
    drawer.classList.toggle('hidden', !visible);
    document.getElementById('btnToggleTerminal').classList.toggle('active', visible);
    if (visible && state.activeTermId) setTimeout(fitActiveTerminal, 30);
  }

  /**
   * Show / hide the terminal drawer. Showing it with no open session creates one for the active repository.
   * (Showing the drawer and creating a session are deliberately separate steps: creating a session must never
   * re-enter this function, otherwise a pending session request recursively spawns more of them.)
   */
  function toggleTerminalDrawer(forceShow) {
    const drawer = document.getElementById('terminalDrawer');
    const willShow = typeof forceShow === 'boolean' ? forceShow : drawer.classList.contains('hidden');
    setTerminalDrawerVisible(willShow);
    if (willShow && state.terminals.size === 0 && terminalCreateInFlight === null) {
      openTerminalSession(state.activeRepo || state.homeDir, undefined, null);
    }
  }

  function openTerminalSession(repo, name, initialCommand) {
    setTerminalDrawerVisible(true);
    // Serialise creation so rapid clicks / repeated requests queue up rather than racing
    const previous = terminalCreateInFlight || Promise.resolve();
    const task = previous.then(() => createTerminalSession(repo, name, initialCommand));
    terminalCreateInFlight = task;
    task.finally(() => {
      if (terminalCreateInFlight === task) terminalCreateInFlight = null;
    });
    return task;
  }

  async function createTerminalSession(repo, name, initialCommand) {
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
        fontFamily: '"MesloLGS NF", "MesloLGS Nerd Font", "JetBrainsMono Nerd Font", "Hack Nerd Font", "FiraCode Nerd Font", "SF Mono", Menlo, Monaco, Consolas, monospace',
        scrollback: 5000,
        theme: TERMINAL_THEMES[state.theme] || TERMINAL_THEMES.dark
      });
      const fitAddon = new window.FitAddon.FitAddon();
      term.loadAddon(fitAddon);
      term.open(containerEl);

      term.onData((data) => {
        sendWs({ type: 'term:input', id: info.id, data });
      });

      const tabEl = document.createElement('div');
      tabEl.className = 'term-tab';
      tabEl.title = info.isRemote ? `${info.hostId}:${info.cwd}` : info.cwd;
      tabEl.innerHTML = `<span class="term-tab-icon">${info.isRemote ? ICONS.remote : ICONS.terminal}</span><span class="term-tab-title">${escapeHtml(info.title)}</span><button class="ws-tab-close" title="${escapeHtml(tr('close'))}">${ICONS.close}</button>`;
      tabEl.addEventListener('click', (e) => {
        if (e.target.closest('.ws-tab-close')) return;
        activateTerminal(info.id);
      });
      tabEl.addEventListener('auxclick', (e) => {
        if (e.button === 1) closeTerminalSession(info.id);
      });
      tabEl.querySelector('.ws-tab-close').addEventListener('click', (e) => {
        e.stopPropagation();
        closeTerminalSession(info.id);
      });
      document.getElementById('terminalTabs').appendChild(tabEl);

      state.terminals.set(info.id, { info, term, fitAddon, containerEl, tabEl, exited: false });
      activateTerminal(info.id);
    } catch (err) {
      showToast(err.message, 'error');
      if (state.terminals.size === 0) setTerminalDrawerVisible(false);
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
      setTerminalDrawerVisible(false);
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
    const zh = state.lang === 'zh';
    if (state.sshHosts.length === 0) {
      listEl.innerHTML = `<div class="sidebar-empty">${escapeHtml(tr('noSshHosts'))}</div>`;
      return;
    }
    // Search by alias, name, address or tag ("#prod" matches the tag exactly)
    const q = (document.getElementById('sshHostSearch').value || '').trim().toLowerCase();
    const matches = (h) => {
      if (!q) return true;
      if (q.startsWith('#')) return (h.tags || []).some((t) => t.toLowerCase() === q.slice(1));
      return [h.alias, h.name, h.host, h.user, ...(h.tags || [])].some((v) => v && String(v).toLowerCase().includes(q));
    };
    const shown = state.sshHosts.filter(matches);
    if (shown.length === 0) {
      listEl.innerHTML = `<div class="sidebar-empty">${escapeHtml(zh ? '没有匹配的主机' : 'No matching hosts')}</div>`;
      return;
    }
    listEl.innerHTML = '';
    shown.forEach((h) => {
      const card = document.createElement('div');
      card.className = 'host-card' + (state.selectedSshHostId === h.id ? ' selected' : '');
      card.innerHTML = `
        <div class="host-card-top">
          <span class="host-card-title">
            <i class="status-dot ${h.connected ? 'connected' : ''}"></i>
            <span class="host-card-name">${escapeHtml(h.alias || h.name)}</span>
            ${h.alias ? `<span class="host-card-orig">${escapeHtml(h.name)}</span>` : ''}
          </span>
          <span class="host-card-actions">
            <span class="ssh-chip">${h.source === 'ssh-config' ? 'ssh-config' : 'saved'}</span>
            <button class="mini-icon-btn edit-host" title="${escapeHtml(zh ? '别名与标签' : 'Alias & Tags')}">${ICONS.pencil}</button>
            ${h.source === 'saved' ? `<button class="mini-icon-btn danger del-host" title="${escapeHtml(zh ? '删除主机' : 'Delete Host')}">${ICONS.trash}</button>` : ''}
          </span>
        </div>
        <div class="host-card-meta">${escapeHtml(hostAddress(h))}${h.proxyJump ? ' (via ' + escapeHtml(h.proxyJump) + ')' : ''}</div>
        ${(h.tags || []).length ? `<div class="host-card-tags">${tagChipsHtml(h.tags, 'small')}</div>` : ''}
      `;
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const chip = e.target.closest('.tag-chip');
        if (chip) {
          document.getElementById('sshHostSearch').value = '#' + chip.getAttribute('data-tag');
          renderModalSshHosts();
          return;
        }
        selectAndBrowseSshHost(h.id);
      });
      card.querySelector('.edit-host').addEventListener('click', (e) => {
        e.stopPropagation();
        openHostMetaDialog(h.id);
      });
      const delBtn = card.querySelector('.del-host');
      if (delBtn) {
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const ok = await confirmDialog(zh ? '删除 SSH 主机' : 'Delete SSH Host', zh ? `从 GitMap 删除主机“${h.alias || h.name}”（${hostAddress(h)}）及其保存的密码？其上的仓库会保留在列表中。` : `Delete the host "${h.alias || h.name}" (${hostAddress(h)}) and its saved password from GitMap? Repositories on it stay in the list.`, zh ? '删除' : 'Delete', true);
          if (!ok) return;
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
    const changedHost = state.selectedSshHostId !== hostId;
    state.selectedSshHostId = hostId;
    renderModalSshHosts();
    document.getElementById('sshBrowserEmpty').classList.add('hidden');
    document.getElementById('sshBrowserContent').classList.remove('hidden');
    if (changedHost) sshBrowser.reset();
    let startPath = targetPath || null;
    if (!startPath && changedHost) {
      try {
        startPath = localStorage.getItem('gitmap.ssh.lastPath.' + hostId) || null;
      } catch (_) {}
    }
    await sshBrowser.navigate(startPath, { push: true });
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

  /* ==================== File Browser Component (Remote SSH & Local) ==================== */
  function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let v = bytes;
    let u = 0;
    while (v >= 1024 && u < units.length - 1) {
      v /= 1024;
      u++;
    }
    return (u === 0 ? String(v) : v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)) + ' ' + units[u];
  }

  function formatMtime(seconds) {
    if (!seconds) return { short: '—', full: '' };
    const d = new Date(seconds * 1000);
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const time = pad(d.getHours()) + ':' + pad(d.getMinutes());
    const date = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const sameDay = d.toDateString() === now.toDateString();
    const yesterday = new Date(now.getTime() - 86400000).toDateString() === d.toDateString();
    const short = sameDay
      ? (state.lang === 'zh' ? '今天 ' : 'Today ') + time
      : yesterday
        ? (state.lang === 'zh' ? '昨天 ' : 'Yesterday ') + time
        : d.getFullYear() === now.getFullYear()
          ? pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + time
          : date;
    return { short, full: date + ' ' + time + ':' + pad(d.getSeconds()) };
  }

  function fileIconFor(entry) {
    if (entry.isGitRepo) return { svg: ICONS.gitRepo, cls: 'is-git' };
    if (entry.isDirectory) return { svg: ICONS.folder, cls: 'is-dir' };
    const ext = (entry.name.split('.').pop() || '').toLowerCase();
    if (/^(png|jpe?g|gif|webp|svg|bmp|ico|tiff?|heic)$/.test(ext)) return { svg: ICONS.fileImage, cls: 'is-image' };
    if (/^(zip|tar|gz|tgz|bz2|xz|7z|rar|zst|jar|whl|deb|rpm|dmg)$/.test(ext)) return { svg: ICONS.fileArchive, cls: 'is-archive' };
    if (window.GitMapSyntax && window.GitMapSyntax.languageForPath(entry.name)) return { svg: ICONS.fileCode, cls: 'is-code' };
    return { svg: ICONS.file, cls: 'is-file' };
  }

  function joinPath(dir, name) {
    if (/[\\/]$/.test(dir)) return dir + name;
    return dir + '/' + name;
  }

  /**
   * A file browser: path field with Tab completion & history, sortable Name / Size / Modified table, filtering,
   * multi-selection and per-row actions. Used by the Remote - SSH browser and the local repository picker.
   */
  function createFileBrowser(root, opts) {
    const fb = {
      currentPath: null,
      parentPath: null,
      entries: [],
      history: [],
      historyIdx: -1,
      sort: (() => {
        try {
          return JSON.parse(localStorage.getItem('gitmap.fb.sort.' + opts.kind)) || { key: 'name', dir: 1 };
        } catch (_) {
          return { key: 'name', dir: 1 };
        }
      })(),
      showHidden: localStorage.getItem('gitmap.fb.hidden.' + opts.kind) === '1',
      filter: '',
      selected: new Set(),
      lastClicked: -1,
      focusIdx: -1,
      visible: [],
      loadSeq: 0,
      suggest: { items: [], idx: -1, base: '' }
    };
    const T = (zh, en) => (state.lang === 'zh' ? zh : en);
    const features = opts.features || {};

    root.innerHTML = `
      <div class="fb-conn">
        <span class="fb-conn-summary"></span>
        <span class="fb-conn-actions">
          ${features.scan ? `<button type="button" class="mini-btn act-scan" title="${escapeHtml(T('扫描当前目录下（最多 3 层）的 Git 仓库', 'Find Git repositories up to 3 levels below this folder'))}">${ICONS.scan}<span>${escapeHtml(tr('scanSubfolders'))}</span></button>` : ''}
          ${features.launch ? `<button type="button" class="mini-icon-btn act-here-term" title="${escapeHtml(T('在外部终端中打开当前目录', 'Open This Folder in External Terminal'))}">${ICONS.externalTerminal}</button>
          <button type="button" class="mini-icon-btn act-here-editor" title="${escapeHtml(T('在编辑器中打开当前目录', 'Open This Folder in Editor'))}">${ICONS.editor}</button>` : ''}
          ${features.nativePicker ? `<button type="button" class="mini-btn act-native">${ICONS.folderOpen}<span>${escapeHtml(tr('osFolderPicker'))}</span></button>` : ''}
        </span>
      </div>
      <div class="fb-toolbar">
        <button type="button" class="icon-btn act-back" title="${escapeHtml(T('后退', 'Back'))} (Alt+←)">${ICONS.arrowLeft}</button>
        <button type="button" class="icon-btn act-forward" title="${escapeHtml(T('前进', 'Forward'))} (Alt+→)">${ICONS.arrowRight}</button>
        <button type="button" class="icon-btn act-up" title="${escapeHtml(T('上级目录', 'Parent Folder'))} (Alt+↑)">${ICONS.arrowUp}</button>
        <button type="button" class="icon-btn act-home" title="${escapeHtml(T('主目录', 'Home Folder'))} (~)">${ICONS.home}</button>
        <div class="fb-path">
          <div class="fb-crumbs" tabindex="0" title="${escapeHtml(T('点击空白处或按 ⌘L / Ctrl+L 编辑路径', 'Click the empty space or press Cmd/Ctrl+L to edit the path'))}"></div>
          <button type="button" class="fb-path-edit mini-icon-btn" title="${escapeHtml(T('编辑路径（Tab 补全）', 'Edit Path (Tab completes)'))} ⌘L">${ICONS.pencil}</button>
          <input type="text" class="fb-path-input hidden" spellcheck="false" autocomplete="off" placeholder="${escapeHtml(T('输入路径，Tab 补全，Enter 跳转', 'Type a path — Tab to complete, Enter to go'))}" />
          <div class="fb-suggest hidden" role="listbox"></div>
        </div>
        <button type="button" class="icon-btn act-refresh" title="${escapeHtml(T('刷新', 'Refresh'))}">${ICONS.refresh}</button>
      </div>
      <div class="fb-actions">
        <label class="fb-filter">${ICONS.search}<input type="text" class="fb-filter-input" spellcheck="false" placeholder="${escapeHtml(T('筛选当前目录…', 'Filter this folder…'))}" /></label>
        <button type="button" class="mini-icon-btn act-hidden" title="${escapeHtml(tr('showHidden'))}">${ICONS.eyeOff}</button>
        <span class="fb-actions-spacer"></span>
        ${features.mkdir ? `<button type="button" class="mini-btn act-mkdir">${ICONS.folderPlus}<span>${escapeHtml(T('新建文件夹', 'New Folder'))}</span></button>` : ''}
        ${features.transfer ? `<button type="button" class="mini-btn act-upload">${ICONS.upload}<span>${escapeHtml(T('上传文件', 'Upload Files'))}</span></button>
        <button type="button" class="mini-btn act-upload-dir">${ICONS.upload}<span>${escapeHtml(T('上传文件夹', 'Upload Folder'))}</span></button>` : ''}
      </div>
      <div class="fb-repo-banner hidden">
        <span class="fb-repo-banner-icon">${ICONS.gitRepo}</span>
        <span class="fb-repo-banner-text"></span>
        <span class="branch-pill fb-repo-banner-branch"></span>
        <button type="button" class="mini-btn primary act-open-current">${escapeHtml(opts.openRepoLabel)}</button>
      </div>
      <div class="fb-table" tabindex="0">
        <div class="fb-head">
          <span class="fb-col-chk"><input type="checkbox" class="fb-check-all" aria-label="${escapeHtml(T('全选', 'Select All'))}" /></span>
          <button type="button" class="fb-col-name fb-sort" data-key="name">${escapeHtml(T('名称', 'Name'))}<i></i></button>
          <button type="button" class="fb-col-size fb-sort" data-key="size">${escapeHtml(T('大小', 'Size'))}<i></i></button>
          <button type="button" class="fb-col-mtime fb-sort" data-key="mtime">${escapeHtml(T('修改时间', 'Modified'))}<i></i></button>
          <span class="fb-col-actions"></span>
        </div>
        <div class="fb-body" role="grid"></div>
        <div class="fb-drop-hint hidden">${ICONS.upload}<span>${escapeHtml(T('松开以上传到当前目录', 'Drop to upload to this folder'))}</span></div>
      </div>
      <div class="fb-status">
        <span class="fb-status-text"></span>
        <span class="fb-selection-actions hidden">
          ${features.transfer ? `<button type="button" class="mini-btn act-sel-download">${ICONS.download}<span>${escapeHtml(T('下载', 'Download'))}</span></button>` : ''}
          ${features.delete ? `<button type="button" class="mini-btn danger act-sel-delete">${ICONS.trash}<span>${escapeHtml(T('删除', 'Delete'))}</span></button>` : ''}
          <button type="button" class="mini-btn act-sel-clear">${escapeHtml(T('取消选择', 'Clear Selection'))}</button>
        </span>
      </div>
    `;

    const $ = (sel) => root.querySelector(sel);
    const body = $('.fb-body');
    const crumbs = $('.fb-crumbs');
    const pathInput = $('.fb-path-input');
    const suggestEl = $('.fb-suggest');
    const filterInput = $('.fb-filter-input');

    function updateHiddenButton() {
      const btn = $('.act-hidden');
      btn.innerHTML = fb.showHidden ? ICONS.eye : ICONS.eyeOff;
      btn.classList.toggle('active', fb.showHidden);
    }

    function updateSortHeader() {
      root.querySelectorAll('.fb-sort').forEach((el) => {
        const active = el.getAttribute('data-key') === fb.sort.key;
        el.classList.toggle('active', active);
        el.querySelector('i').innerHTML = active ? (fb.sort.dir === 1 ? ICONS.chevronUp : ICONS.chevronDown) : '';
      });
    }

    function renderCrumbs(p) {
      crumbs.innerHTML = '';
      const isWinDrive = /^[a-zA-Z]:/.test(p);
      const parts = p.split(/[\\/]/).filter(Boolean);
      const add = (label, target, last) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'crumb-btn' + (last ? ' current' : '');
        b.textContent = label;
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          fb.navigate(target, { push: true });
        });
        crumbs.appendChild(b);
      };
      add(isWinDrive ? parts[0] : '/', isWinDrive ? parts[0] + '/' : '/', parts.length === (isWinDrive ? 1 : 0));
      let acc = isWinDrive ? parts[0] : '';
      for (let i = isWinDrive ? 1 : 0; i < parts.length; i++) {
        if (i > (isWinDrive ? 1 : 0)) {
          const sep = document.createElement('span');
          sep.className = 'crumb-sep';
          sep.textContent = '/';
          crumbs.appendChild(sep);
        }
        acc += '/' + parts[i];
        add(parts[i], acc, i === parts.length - 1);
      }
      crumbs.scrollLeft = crumbs.scrollWidth;
    }

    function sortedFiltered() {
      const f = fb.filter.trim().toLowerCase();
      const list = f ? fb.entries.filter((e) => e.name.toLowerCase().includes(f)) : fb.entries.slice();
      const { key, dir } = fb.sort;
      list.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        let c = 0;
        if (key === 'size') c = (a.size || 0) - (b.size || 0);
        else if (key === 'mtime') c = (a.mtime || 0) - (b.mtime || 0);
        if (c === 0) c = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        return c * dir;
      });
      return list;
    }

    function renderRows() {
      fb.visible = sortedFiltered();
      if (fb.entries.length === 0) {
        body.innerHTML = `<div class="browser-empty-state">${escapeHtml(T('空目录', 'Empty folder'))}</div>`;
      } else if (fb.visible.length === 0) {
        body.innerHTML = `<div class="browser-empty-state">${escapeHtml(T('没有匹配“' + fb.filter + '”的项目', 'Nothing matches "' + fb.filter + '"'))}</div>`;
      } else {
        const html = fb.visible.map((e, idx) => {
          const icon = fileIconFor(e);
          const m = formatMtime(e.mtime);
          const sel = fb.selected.has(e.path);
          const rowActions = [];
          if (e.isGitRepo) rowActions.push(`<button type="button" class="mini-btn act-row-open-repo">${escapeHtml(tr('openRepoBtn'))}</button>`);
          if (features.transfer) rowActions.push(`<button type="button" class="mini-icon-btn act-row-download" title="${escapeHtml(T('下载', 'Download'))}">${ICONS.download}</button>`);
          if (features.launch && e.isDirectory) {
            rowActions.push(`<button type="button" class="mini-icon-btn act-row-term" title="${escapeHtml(tr('openInTerminal'))}">${ICONS.externalTerminal}</button>`);
            rowActions.push(`<button type="button" class="mini-icon-btn act-row-editor" title="${escapeHtml(tr('openInEditor'))}">${ICONS.editor}</button>`);
          }
          rowActions.push(`<button type="button" class="mini-icon-btn act-row-copy" title="${escapeHtml(T('复制路径', 'Copy Path'))}">${ICONS.copy}</button>`);
          if (features.rename) rowActions.push(`<button type="button" class="mini-icon-btn act-row-rename" title="${escapeHtml(T('重命名', 'Rename'))}">${ICONS.pencil}</button>`);
          if (features.delete) rowActions.push(`<button type="button" class="mini-icon-btn danger act-row-delete" title="${escapeHtml(T('删除', 'Delete'))}">${ICONS.trash}</button>`);
          return `<div class="fb-row${e.isDirectory ? ' is-dir' : ''}${e.isGitRepo ? ' is-git' : ''}${sel ? ' selected' : ''}${idx === fb.focusIdx ? ' focused' : ''}" data-idx="${idx}" role="row" title="${escapeHtml(e.path)}">
            <span class="fb-col-chk"><input type="checkbox" class="fb-check" ${sel ? 'checked' : ''} tabindex="-1" /></span>
            <span class="fb-col-name"><span class="fb-icon ${icon.cls}">${icon.svg}</span><span class="fb-name">${escapeHtml(e.name)}</span>${e.isSymlink ? `<span class="fb-link" title="${escapeHtml(T('符号链接', 'Symbolic link'))}">${ICONS.link}</span>` : ''}${e.isGitRepo ? `<span class="branch-pill">${ICONS.branch}${escapeHtml(e.gitBranch || 'HEAD')}</span>` : ''}</span>
            <span class="fb-col-size">${e.isDirectory ? '—' : escapeHtml(formatBytes(e.size))}</span>
            <span class="fb-col-mtime" title="${escapeHtml(m.full)}">${escapeHtml(m.short)}</span>
            <span class="fb-col-actions">${rowActions.join('')}</span>
          </div>`;
        });
        body.innerHTML = html.join('');
      }
      updateStatus();
    }

    function updateStatus() {
      const dirs = fb.entries.filter((e) => e.isDirectory).length;
      const files = fb.entries.length - dirs;
      const repos = fb.entries.filter((e) => e.isGitRepo).length;
      const parts = [T(`${dirs} 个文件夹`, `${dirs} folder${dirs === 1 ? '' : 's'}`), T(`${files} 个文件`, `${files} file${files === 1 ? '' : 's'}`)];
      if (repos > 0) parts.push(T(`${repos} 个 Git 仓库`, `${repos} Git repo${repos === 1 ? '' : 's'}`));
      if (fb.filter) parts.push(T(`显示 ${fb.visible.length} 项`, `showing ${fb.visible.length}`));
      if (fb.selected.size > 0) {
        let bytes = 0;
        fb.entries.forEach((e) => {
          if (fb.selected.has(e.path) && !e.isDirectory) bytes += e.size || 0;
        });
        parts.push(T(`已选 ${fb.selected.size} 项`, `${fb.selected.size} selected`) + (bytes > 0 ? ` (${formatBytes(bytes)})` : ''));
      }
      $('.fb-status-text').textContent = parts.join(' · ');
      $('.fb-selection-actions').classList.toggle('hidden', fb.selected.size === 0);
      const all = $('.fb-check-all');
      all.checked = fb.visible.length > 0 && fb.visible.every((e) => fb.selected.has(e.path));
      all.indeterminate = !all.checked && fb.visible.some((e) => fb.selected.has(e.path));
    }

    function setLoading(text) {
      body.innerHTML = `<div class="browser-empty-state"><span class="fb-spinner"></span>${escapeHtml(text)}</div>`;
    }

    function updateNavButtons() {
      $('.act-back').disabled = fb.historyIdx <= 0;
      $('.act-forward').disabled = fb.historyIdx >= fb.history.length - 1;
      $('.act-up').disabled = !fb.parentPath;
    }

    fb.reset = function () {
      fb.currentPath = null;
      fb.parentPath = null;
      fb.entries = [];
      fb.history = [];
      fb.historyIdx = -1;
      fb.selected.clear();
      fb.filter = '';
      filterInput.value = '';
      crumbs.innerHTML = '';
      body.innerHTML = '';
    };

    fb.navigate = async function (target, navOpts) {
      const seq = ++fb.loadSeq;
      setLoading(opts.loadingText());
      hideSuggestions();
      try {
        const listing = await opts.list(target, fb.showHidden);
        if (seq !== fb.loadSeq) return;
        const changedDir = listing.currentPath !== fb.currentPath;
        fb.currentPath = listing.currentPath;
        fb.parentPath = listing.parentPath;
        fb.entries = listing.entries || [];
        if (changedDir) {
          fb.selected.clear();
          fb.focusIdx = -1;
          fb.filter = '';
          filterInput.value = '';
        }
        if (navOpts && navOpts.push && changedDir) {
          fb.history = fb.history.slice(0, fb.historyIdx + 1);
          fb.history.push(fb.currentPath);
          fb.historyIdx = fb.history.length - 1;
        }
        renderCrumbs(fb.currentPath);
        pathInput.value = fb.currentPath;
        $('.fb-conn-summary').innerHTML = opts.summary ? opts.summary() : '';
        const banner = $('.fb-repo-banner');
        if (listing.currentRepoRoot) {
          banner.classList.remove('hidden');
          $('.fb-repo-banner-text').textContent = opts.displayRepo ? opts.displayRepo(listing.currentRepoRoot) : listing.currentRepoRoot;
          $('.fb-repo-banner-branch').innerHTML = ICONS.branch + escapeHtml(listing.currentRepoBranch || 'HEAD');
          fb.currentRepoRoot = listing.currentRepoRoot;
        } else {
          banner.classList.add('hidden');
          fb.currentRepoRoot = null;
        }
        updateNavButtons();
        renderRows();
        if (opts.onNavigated) opts.onNavigated(listing);
      } catch (err) {
        if (seq !== fb.loadSeq) return;
        body.innerHTML = `<div class="browser-empty-state error-text">${escapeHtml(err.message)}</div>`;
        updateNavButtons();
      }
    };

    fb.refresh = function () {
      return fb.navigate(fb.currentPath, { push: false });
    };

    fb.entryAt = function (idx) {
      return fb.visible[idx] || null;
    };

    function selectedEntries() {
      return fb.entries.filter((e) => fb.selected.has(e.path));
    }

    function openEntry(entry) {
      if (!entry) return;
      if (entry.isDirectory) fb.navigate(entry.path, { push: true });
      else if (opts.onOpenFile) opts.onOpenFile(entry);
    }

    function setFocus(idx) {
      fb.focusIdx = Math.max(-1, Math.min(fb.visible.length - 1, idx));
      body.querySelectorAll('.fb-row.focused').forEach((el) => el.classList.remove('focused'));
      const row = body.querySelector(`.fb-row[data-idx="${fb.focusIdx}"]`);
      if (row) {
        row.classList.add('focused');
        row.scrollIntoView({ block: 'nearest' });
      }
    }

    function toggleSelect(idx, extend) {
      const e = fb.visible[idx];
      if (!e) return;
      if (extend && fb.lastClicked > -1) {
        const [a, b] = [Math.min(fb.lastClicked, idx), Math.max(fb.lastClicked, idx)];
        for (let i = a; i <= b; i++) fb.selected.add(fb.visible[i].path);
      } else if (fb.selected.has(e.path)) {
        fb.selected.delete(e.path);
      } else {
        fb.selected.add(e.path);
      }
      fb.lastClicked = idx;
      renderRows();
    }

    /* ---- Path field: breadcrumbs ⇄ editable input with Tab completion ---- */
    function startEditingPath() {
      crumbs.classList.add('hidden');
      $('.fb-path-edit').classList.add('hidden');
      pathInput.classList.remove('hidden');
      pathInput.value = fb.currentPath || '';
      pathInput.focus();
      pathInput.setSelectionRange(pathInput.value.length, pathInput.value.length);
    }

    function stopEditingPath() {
      hideSuggestions();
      pathInput.classList.add('hidden');
      crumbs.classList.remove('hidden');
      $('.fb-path-edit').classList.remove('hidden');
    }

    function hideSuggestions() {
      suggestEl.classList.add('hidden');
      suggestEl.innerHTML = '';
      fb.suggest = { items: [], idx: -1, base: '' };
    }

    function renderSuggestions() {
      const { items, idx } = fb.suggest;
      if (items.length === 0) {
        hideSuggestions();
        return;
      }
      suggestEl.innerHTML = items.slice(0, 80).map((it, i) => `<div class="fb-suggest-item${i === idx ? ' active' : ''}" data-i="${i}" role="option">
        <span class="fb-icon ${it.isDirectory ? 'is-dir' : 'is-file'}">${it.isDirectory ? ICONS.folder : ICONS.file}</span>
        <span>${escapeHtml(it.name)}${it.isDirectory ? '/' : ''}</span></div>`).join('');
      suggestEl.classList.remove('hidden');
      const active = suggestEl.querySelector('.active');
      if (active) active.scrollIntoView({ block: 'nearest' });
    }

    function applySuggestion(it) {
      pathInput.value = it.path + (it.isDirectory ? '/' : '');
    }

    let completeSeq = 0;
    async function fetchCompletions() {
      const seq = ++completeSeq;
      const res = await opts.complete(pathInput.value, fb.showHidden);
      if (seq !== completeSeq) return null;
      return res;
    }

    async function onTabComplete(backwards) {
      // Repeated Tab cycles through the listed candidates
      if (fb.suggest.items.length > 1 && fb.suggest.base === '__cycling__') {
        const n = fb.suggest.items.length;
        fb.suggest.idx = (fb.suggest.idx + (backwards ? n - 1 : 1)) % n;
        applySuggestion(fb.suggest.items[fb.suggest.idx]);
        renderSuggestions();
        return;
      }
      let res;
      try {
        res = await fetchCompletions();
      } catch (err) {
        return;
      }
      if (!res) return;
      const items = res.entries;
      if (items.length === 0) {
        pathInput.classList.add('shake');
        setTimeout(() => pathInput.classList.remove('shake'), 300);
        hideSuggestions();
        return;
      }
      if (items.length === 1) {
        applySuggestion(items[0]);
        hideSuggestions();
        if (items[0].isDirectory) scheduleSuggest();
        return;
      }
      // Extend to the longest common prefix, like a shell
      let common = items[0].name;
      for (const it of items) {
        let k = 0;
        while (k < common.length && k < it.name.length && common[k] === it.name[k]) k++;
        common = common.substring(0, k);
      }
      if (common.length > res.prefix.length) {
        pathInput.value = joinPath(res.dir, common);
        fb.suggest = { items, idx: -1, base: '' };
      } else {
        fb.suggest = { items, idx: 0, base: '__cycling__' };
        applySuggestion(items[0]);
      }
      renderSuggestions();
    }

    let suggestTimer = null;
    function scheduleSuggest() {
      clearTimeout(suggestTimer);
      suggestTimer = setTimeout(async () => {
        if (pathInput.classList.contains('hidden')) return;
        try {
          const res = await fetchCompletions();
          if (!res) return;
          fb.suggest = { items: res.entries, idx: -1, base: '' };
          renderSuggestions();
        } catch (_) {
          hideSuggestions();
        }
      }, 220);
    }

    crumbs.addEventListener('click', (e) => {
      if (!e.target.closest('.crumb-btn')) startEditingPath();
    });
    $('.fb-path-edit').addEventListener('click', startEditingPath);
    crumbs.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        startEditingPath();
      }
    });
    pathInput.addEventListener('input', scheduleSuggest);
    pathInput.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        onTabComplete(e.shiftKey);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (fb.suggest.items.length === 0) return;
        e.preventDefault();
        const n = fb.suggest.items.length;
        fb.suggest.idx = e.key === 'ArrowDown' ? (fb.suggest.idx + 1) % n : (fb.suggest.idx - 1 + n) % n;
        fb.suggest.base = '__cycling__';
        applySuggestion(fb.suggest.items[fb.suggest.idx]);
        renderSuggestions();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const value = pathInput.value.trim() || '~';
        stopEditingPath();
        fb.navigate(value, { push: true });
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        stopEditingPath();
      }
    });
    pathInput.addEventListener('blur', () => {
      setTimeout(() => {
        if (document.activeElement !== pathInput) stopEditingPath();
      }, 150);
    });
    suggestEl.addEventListener('mousedown', (e) => {
      const item = e.target.closest('.fb-suggest-item');
      if (!item) return;
      e.preventDefault();
      const it = fb.suggest.items[Number(item.getAttribute('data-i'))];
      if (!it) return;
      applySuggestion(it);
      if (it.isDirectory) {
        stopEditingPath();
        fb.navigate(it.path, { push: true });
      } else {
        hideSuggestions();
      }
    });

    /* ---- Toolbar & action bar ---- */
    $('.act-back').addEventListener('click', () => {
      if (fb.historyIdx > 0) {
        fb.historyIdx--;
        fb.navigate(fb.history[fb.historyIdx], { push: false });
      }
    });
    $('.act-forward').addEventListener('click', () => {
      if (fb.historyIdx < fb.history.length - 1) {
        fb.historyIdx++;
        fb.navigate(fb.history[fb.historyIdx], { push: false });
      }
    });
    $('.act-up').addEventListener('click', () => {
      if (fb.parentPath) fb.navigate(fb.parentPath, { push: true });
    });
    $('.act-home').addEventListener('click', () => fb.navigate('~', { push: true }));
    $('.act-refresh').addEventListener('click', () => fb.refresh());
    $('.act-hidden').addEventListener('click', () => {
      fb.showHidden = !fb.showHidden;
      localStorage.setItem('gitmap.fb.hidden.' + opts.kind, fb.showHidden ? '1' : '0');
      updateHiddenButton();
      fb.refresh();
    });
    filterInput.addEventListener('input', () => {
      fb.filter = filterInput.value;
      fb.focusIdx = -1;
      renderRows();
    });
    filterInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && fb.visible.length > 0) openEntry(fb.visible[0]);
      else if (e.key === 'Escape' && filterInput.value) {
        e.stopPropagation();
        filterInput.value = '';
        fb.filter = '';
        renderRows();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        $('.fb-table').focus();
        setFocus(0);
      }
    });
    root.querySelectorAll('.fb-sort').forEach((el) => {
      el.addEventListener('click', () => {
        const key = el.getAttribute('data-key');
        fb.sort = fb.sort.key === key ? { key, dir: -fb.sort.dir } : { key, dir: key === 'name' ? 1 : -1 };
        localStorage.setItem('gitmap.fb.sort.' + opts.kind, JSON.stringify(fb.sort));
        updateSortHeader();
        renderRows();
      });
    });
    $('.fb-check-all').addEventListener('change', (e) => {
      if (e.target.checked) fb.visible.forEach((en) => fb.selected.add(en.path));
      else fb.visible.forEach((en) => fb.selected.delete(en.path));
      renderRows();
    });
    $('.act-sel-clear').addEventListener('click', () => {
      fb.selected.clear();
      renderRows();
    });
    $('.act-open-current').addEventListener('click', () => {
      if (fb.currentRepoRoot) opts.onOpenRepo(fb.currentRepoRoot);
    });

    /* ---- Rows (event delegation) ---- */
    body.addEventListener('click', (e) => {
      const row = e.target.closest('.fb-row');
      if (!row) return;
      const idx = Number(row.getAttribute('data-idx'));
      const entry = fb.visible[idx];
      if (!entry) return;
      const btn = e.target.closest('button');
      if (btn) {
        e.stopPropagation();
        if (btn.classList.contains('act-row-open-repo')) opts.onOpenRepo(entry.path);
        else if (btn.classList.contains('act-row-download') && opts.download) opts.download([entry.path]);
        else if (btn.classList.contains('act-row-term')) opts.openTerminal(entry.path);
        else if (btn.classList.contains('act-row-editor')) opts.openEditor(entry.path);
        else if (btn.classList.contains('act-row-copy')) {
          navigator.clipboard?.writeText(entry.path).catch(() => {});
          showToast(T('已复制：', 'Copied: ') + entry.path, 'status');
        } else if (btn.classList.contains('act-row-rename') && opts.rename) opts.rename(entry);
        else if (btn.classList.contains('act-row-delete') && opts.remove) opts.remove([entry]);
        return;
      }
      if (e.target.closest('.fb-col-chk') || e.metaKey || e.ctrlKey || e.shiftKey) {
        toggleSelect(idx, e.shiftKey);
        return;
      }
      setFocus(idx);
      openEntry(entry);
    });
    body.addEventListener('change', (e) => {
      if (e.target.classList.contains('fb-check')) {
        // Handled by the click above
        e.stopPropagation();
      }
    });
    $('.fb-table').addEventListener('keydown', (e) => {
      if (e.target !== $('.fb-table')) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocus(fb.focusIdx + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocus(fb.focusIdx - 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        openEntry(fb.visible[fb.focusIdx]);
      } else if (e.key === ' ') {
        e.preventDefault();
        if (fb.focusIdx > -1) toggleSelect(fb.focusIdx, false);
      } else if (e.key === 'Backspace' || (e.altKey && e.key === 'ArrowUp')) {
        e.preventDefault();
        if (fb.parentPath) fb.navigate(fb.parentPath, { push: true });
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        fb.visible.forEach((en) => fb.selected.add(en.path));
        renderRows();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        filterInput.focus();
      } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // Type-to-filter
        filterInput.focus();
      }
    });
    root.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        startEditingPath();
      } else if (e.altKey && e.key === 'ArrowLeft') $('.act-back').click();
      else if (e.altKey && e.key === 'ArrowRight') $('.act-forward').click();
    });

    /* ---- Feature buttons ---- */
    if (features.scan) $('.act-scan').addEventListener('click', () => opts.scan(fb.currentPath));
    if (features.launch) {
      $('.act-here-term').addEventListener('click', () => opts.openTerminal(fb.currentPath));
      $('.act-here-editor').addEventListener('click', () => opts.openEditor(fb.currentPath));
    }
    if (features.nativePicker) $('.act-native').addEventListener('click', () => opts.nativePick());
    if (features.mkdir) $('.act-mkdir').addEventListener('click', () => opts.mkdir(fb.currentPath));
    if (features.transfer) {
      $('.act-upload').addEventListener('click', () => opts.upload(fb.currentPath, false));
      $('.act-upload-dir').addEventListener('click', () => opts.upload(fb.currentPath, true));
      $('.act-sel-download').addEventListener('click', () => opts.download(selectedEntries().map((e) => e.path)));

      // Drag & drop local files / folders onto the table to upload them (desktop app)
      const table = $('.fb-table');
      const dropHint = $('.fb-drop-hint');
      let dragDepth = 0;
      table.addEventListener('dragenter', (e) => {
        if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
        e.preventDefault();
        dragDepth++;
        dropHint.classList.remove('hidden');
      });
      table.addEventListener('dragover', (e) => {
        if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) e.preventDefault();
      });
      table.addEventListener('dragleave', () => {
        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0) dropHint.classList.add('hidden');
      });
      table.addEventListener('drop', (e) => {
        e.preventDefault();
        dragDepth = 0;
        dropHint.classList.add('hidden');
        const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
        const paths = desktopApi && desktopApi.getPathForFile ? files.map((f) => desktopApi.getPathForFile(f)).filter(Boolean) : [];
        if (paths.length === 0) {
          showToast(T('浏览器模式无法读取拖入文件的路径，请使用“上传文件”按钮。', 'The browser can\'t read the paths of dropped files; use "Upload Files" instead.'), 'warning');
          return;
        }
        opts.uploadPaths(fb.currentPath, paths);
      });
    }
    if (features.delete) {
      $('.act-sel-delete').addEventListener('click', () => opts.remove(selectedEntries()));
    }

    updateHiddenButton();
    updateSortHeader();
    return fb;
  }

  /** Ask for confirmation in the in-app prompt dialog. */
  function confirmDialog(title, message, confirmLabel, danger) {
    return new Promise((resolve) => {
      const modal = document.getElementById('promptModal');
      document.getElementById('promptTitle').textContent = title;
      const bodyEl = document.getElementById('promptBody');
      const footerEl = document.getElementById('promptFooter');
      bodyEl.innerHTML = `<p style="margin:0;white-space:pre-wrap;">${escapeHtml(message)}</p>`;
      footerEl.innerHTML = `<button type="button" class="mini-btn act-cancel">${escapeHtml(tr('cancel'))}</button><button type="button" class="mini-btn ${danger ? 'danger-solid' : 'primary'} act-ok">${escapeHtml(confirmLabel)}</button>`;
      modal.classList.remove('hidden');
      const done = (v) => {
        modal.classList.add('hidden');
        resolve(v);
      };
      footerEl.querySelector('.act-cancel').onclick = () => done(false);
      footerEl.querySelector('.act-ok').onclick = () => done(true);
      document.getElementById('promptCloseBtn').onclick = () => done(false);
      setTimeout(() => footerEl.querySelector('.act-cancel').focus(), 30);
    });
  }

  /** Ask for a single line of text in the in-app prompt dialog. */
  function inputDialog(title, label, value) {
    return new Promise((resolve) => {
      const modal = document.getElementById('promptModal');
      document.getElementById('promptTitle').textContent = title;
      const bodyEl = document.getElementById('promptBody');
      const footerEl = document.getElementById('promptFooter');
      bodyEl.innerHTML = `<label><span>${escapeHtml(label)}</span><input type="text" id="gmInputDialogField" spellcheck="false" value="${escapeHtml(value || '')}" /></label>`;
      footerEl.innerHTML = `<button type="button" class="mini-btn act-cancel">${escapeHtml(tr('cancel'))}</button><button type="button" class="mini-btn primary act-ok">OK</button>`;
      modal.classList.remove('hidden');
      const input = document.getElementById('gmInputDialogField');
      const done = (v) => {
        modal.classList.add('hidden');
        resolve(v);
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') done(input.value.trim() || null);
        if (e.key === 'Escape') {
          e.stopPropagation();
          done(null);
        }
      });
      footerEl.querySelector('.act-cancel').onclick = () => done(null);
      footerEl.querySelector('.act-ok').onclick = () => done(input.value.trim() || null);
      document.getElementById('promptCloseBtn').onclick = () => done(null);
      setTimeout(() => {
        input.focus();
        const dot = input.value.lastIndexOf('.');
        input.setSelectionRange(0, dot > 0 ? dot : input.value.length);
      }, 30);
    });
  }

  function sshUriFor(hostId, remotePath) {
    return 'ssh://' + encodeURIComponent(hostId) + (remotePath.startsWith('/') ? remotePath : '/' + remotePath);
  }

  const sshBrowser = createFileBrowser(document.getElementById('sshBrowserContent'), {
    kind: 'ssh',
    features: { scan: true, launch: true, mkdir: true, transfer: true, rename: true, delete: true },
    openRepoLabel: tr('openCurrentRepo'),
    loadingText: () => tr('connecting'),
    list: (p, showHidden) => rpc('ssh:browsePath', { hostId: state.selectedSshHostId, path: p || undefined, showHidden }).then((listing) => {
      state.sshHosts = listing.hosts || state.sshHosts;
      state.sshCurrentPath = listing.currentPath;
      try {
        localStorage.setItem('gitmap.ssh.lastPath.' + state.selectedSshHostId, listing.currentPath);
      } catch (_) {}
      renderModalSshHosts();
      renderSidebar();
      return listing;
    }),
    complete: (p, showHidden) => rpc('ssh:complete', { hostId: state.selectedSshHostId, path: p, showHidden }),
    summary: () => {
      const h = state.sshHosts.find((x) => x.id === state.selectedSshHostId);
      const label = h ? h.user + '@' + h.host + (h.port && h.port !== 22 ? ':' + h.port : '') : state.selectedSshHostId;
      return `<i class="status-dot connected"></i>${h && h.alias ? `<strong>${escapeHtml(h.alias)}</strong><span class="fb-conn-addr">${escapeHtml(label)}</span>` : `<strong>${escapeHtml(label)}</strong>`}${h ? tagChipsHtml(h.tags, 'small') : ''}${h && h.gitVersion ? `<span class="fb-conn-meta">Git ${escapeHtml(h.gitVersion)}</span>` : `<span class="fb-conn-meta warn">${escapeHtml(state.lang === 'zh' ? '未检测到 git' : 'git not found')}</span>`}`;
    },
    displayRepo: (p) => `${hostLabel(state.selectedSshHostId)}:${p}`,
    onOpenRepo: (p) => openRemoteRepoAndCloseModal(state.selectedSshHostId, p),
    onOpenFile: (entry) => {
      openFileTab({ repo: '', filePath: sshUriFor(state.selectedSshHostId, entry.path), commit: null, title: entry.name, lines: null });
      document.getElementById('sshModal').classList.add('hidden');
    },
    openTerminal: (p) => openExternalTerminal(sshUriFor(state.selectedSshHostId, p)).catch((err) => showToast(err.message, 'error')),
    openEditor: (p) => openInEditor(sshUriFor(state.selectedSshHostId, p)).catch((err) => showToast(err.message, 'error')),
    scan: (p) => scanRemoteRepos(p),
    mkdir: async (dir) => {
      const name = await inputDialog(state.lang === 'zh' ? '新建文件夹' : 'New Folder', state.lang === 'zh' ? '文件夹名称' : 'Folder name', '');
      if (!name) return;
      try {
        await rpc('ssh:mkdir', { hostId: state.selectedSshHostId, path: dir, name });
        await sshBrowser.refresh();
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    rename: async (entry) => {
      const name = await inputDialog(state.lang === 'zh' ? '重命名' : 'Rename', state.lang === 'zh' ? '新名称' : 'New name', entry.name);
      if (!name || name === entry.name) return;
      try {
        await rpc('ssh:rename', { hostId: state.selectedSshHostId, path: entry.path, name });
        await sshBrowser.refresh();
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    remove: async (entries) => {
      if (entries.length === 0) return;
      const zh = state.lang === 'zh';
      const names = entries.slice(0, 8).map((e) => '• ' + e.name + (e.isDirectory ? '/' : '')).join('\n') + (entries.length > 8 ? `\n… +${entries.length - 8}` : '');
      const ok = await confirmDialog(
        zh ? '永久删除远程文件' : 'Permanently Delete Remote Files',
        (zh ? `将在 ${state.selectedSshHostId} 上永久删除以下 ${entries.length} 项（文件夹含其全部内容），此操作无法撤销：\n\n` : `This permanently deletes these ${entries.length} item(s) on ${state.selectedSshHostId} (folders with everything in them). It can't be undone:\n\n`) + names,
        zh ? '永久删除' : 'Delete Permanently',
        true
      );
      if (!ok) return;
      try {
        await rpc('ssh:delete', { hostId: state.selectedSshHostId, paths: entries.map((e) => e.path) });
        await sshBrowser.refresh();
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    upload: async (destDir, folders) => {
      try {
        const res = await rpc('transfer:pickUpload', { hostId: state.selectedSshHostId, destDir, folders, both: !folders && desktopApi && desktopApi.platform === 'darwin' });
        if (res.transfer) showTransferPanel(true);
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    uploadPaths: async (destDir, paths) => {
      try {
        await rpc('transfer:start', { direction: 'upload', hostId: state.selectedSshHostId, sources: paths, destDir });
        showTransferPanel(true);
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    download: async (paths) => {
      if (!paths || paths.length === 0) return;
      try {
        const res = await rpc('transfer:pickDownload', { hostId: state.selectedSshHostId, sources: paths });
        if (res.transfer) showTransferPanel(true);
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  });

  /* Scan Remote Subfolders for Git Repositories */
  async function scanRemoteRepos(dirPath) {
    if (!state.selectedSshHostId) return;
    const zh = state.lang === 'zh';
    const modal = document.getElementById('promptModal');
    document.getElementById('promptTitle').textContent = zh ? '扫描 Git 仓库' : 'Find Git Repositories';
    const bodyEl = document.getElementById('promptBody');
    const footerEl = document.getElementById('promptFooter');
    bodyEl.innerHTML = `<div class="browser-empty-state"><span class="fb-spinner"></span>${escapeHtml(tr('scanning'))}</div>`;
    footerEl.innerHTML = `<button type="button" class="mini-btn act-cancel">${escapeHtml(tr('cancel'))}</button>`;
    modal.classList.remove('hidden');
    let cancelled = false;
    const close = () => {
      cancelled = true;
      modal.classList.add('hidden');
    };
    footerEl.querySelector('.act-cancel').onclick = close;
    document.getElementById('promptCloseBtn').onclick = close;
    try {
      const res = await rpc('ssh:scanRepos', { hostId: state.selectedSshHostId, path: dirPath, maxDepth: 3 });
      if (cancelled) return;
      const repos = res.repos || [];
      if (repos.length === 0) {
        bodyEl.innerHTML = `<div class="browser-empty-state">${escapeHtml(tr('noReposScanned'))}</div>`;
        return;
      }
      bodyEl.innerHTML = `<p style="margin:0;">${escapeHtml(zh ? `找到 ${repos.length} 个 Git 仓库：` : `Found ${repos.length} Git repositories:`)}</p><div class="scan-results-body"></div>`;
      const list = bodyEl.querySelector('.scan-results-body');
      repos.forEach((r) => {
        const row = document.createElement('label');
        row.className = 'scan-result-row';
        row.innerHTML = `<input type="checkbox" class="scan-repo-chk" value="${escapeHtml(r.sshUri)}" checked />
          <span class="fb-icon is-git">${ICONS.gitRepo}</span>
          <span class="scan-result-text"><strong>${escapeHtml(r.name)}</strong><small>${escapeHtml(r.path)}</small></span>
          ${r.branch ? `<span class="branch-pill">${ICONS.branch}${escapeHtml(r.branch)}</span>` : ''}`;
        list.appendChild(row);
      });
      footerEl.innerHTML = `<button type="button" class="mini-btn act-cancel">${escapeHtml(tr('cancel'))}</button><button type="button" class="mini-btn primary act-ok">${escapeHtml(tr('addSelectedRepos'))}</button>`;
      footerEl.querySelector('.act-cancel').onclick = close;
      footerEl.querySelector('.act-ok').onclick = async () => {
        const uris = Array.from(list.querySelectorAll('.scan-repo-chk:checked')).map((el) => el.value);
        if (uris.length === 0) return;
        try {
          const addRes = await rpc('repos:addBatch', { paths: uris });
          state.repos = addRes.repos || state.repos;
          if (addRes.added && addRes.added[0]) state.activeRepo = addRes.added[0];
          renderSidebar();
          renderActiveRepoBadge();
          close();
          document.getElementById('sshModal').classList.add('hidden');
          activateTab('graph');
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
    } catch (err) {
      if (!cancelled) bodyEl.innerHTML = `<div class="browser-empty-state error-text">${escapeHtml(err.message)}</div>`;
    }
  }

  /* ==================== Local Repository Browser Modal ==================== */
  const localBrowser = createFileBrowser(document.getElementById('localBrowserRoot'), {
    kind: 'local',
    features: { scan: true, launch: true, nativePicker: !!(desktopApi && desktopApi.isElectron) },
    openRepoLabel: tr('openCurrentLocalRepo'),
    loadingText: () => (state.lang === 'zh' ? '正在读取…' : 'Loading…'),
    list: (p, showHidden) => rpc('local:browsePath', { path: p || state.homeDir, showHidden }).then((listing) => {
      state.localCurrentPath = listing.currentPath;
      return listing;
    }),
    complete: (p, showHidden) => rpc('local:complete', { path: p, showHidden }),
    summary: () => `<span class="fb-conn-meta">${escapeHtml(state.lang === 'zh' ? '本机文件系统' : 'This computer')}</span>`,
    onOpenRepo: (p) => addLocalRepoAndClose(p),
    onOpenFile: (entry) => {
      openFileTab({ repo: '', filePath: entry.path, commit: null, title: entry.name, lines: null });
      document.getElementById('localModal').classList.add('hidden');
    },
    openTerminal: (p) => openExternalTerminal(p).catch((err) => showToast(err.message, 'error')),
    openEditor: (p) => openInEditor(p).catch((err) => showToast(err.message, 'error')),
    nativePick: async () => {
      const chosen = await desktopApi.pickLocalFolder();
      if (chosen) await addLocalRepoAndClose(chosen);
    },
    scan: async (dirPath) => {
      try {
        const res = await rpc('repos:scanLocal', { path: dirPath, maxDepth: 3 });
        state.repos = res.repos || state.repos;
        renderSidebar();
        if (res.added) {
          document.getElementById('localModal').classList.add('hidden');
          showToast(state.lang === 'zh' ? `已添加 ${res.added} 个仓库` : `Added ${res.added} repositories`, 'info');
        } else {
          showToast(tr('noReposScanned'), 'info');
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  });

  async function openLocalModal(targetPath) {
    document.getElementById('localModal').classList.remove('hidden');
    await localBrowser.navigate(targetPath || state.localCurrentPath || state.homeDir, { push: true });
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

  /* ==================== File Transfers Panel ==================== */
  state.transfers = [];

  function showTransferPanel(show) {
    document.getElementById('transferPanel').classList.toggle('hidden', !show);
  }

  function transferStateLabel(t) {
    const zh = state.lang === 'zh';
    const map = {
      queued: zh ? '排队中' : 'Queued',
      scanning: zh ? '正在统计文件…' : 'Counting files…',
      running: zh ? '传输中' : 'Transferring',
      paused: zh ? '已暂停' : 'Paused',
      completed: zh ? '已完成' : 'Completed',
      failed: zh ? '失败' : 'Failed',
      cancelled: zh ? '已取消' : 'Cancelled',
      undone: zh ? '已撤销（文件在回收站，可恢复）' : 'Undone (in trash, restorable)'
    };
    return map[t.state] || t.state;
  }

  function formatEta(seconds) {
    if (seconds == null) return '';
    if (seconds < 60) return seconds + 's';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ' + (seconds % 60) + 's';
    return Math.floor(seconds / 3600) + 'h ' + Math.floor((seconds % 3600) / 60) + 'm';
  }

  function renderTransfers() {
    const list = document.getElementById('transferList');
    const zh = state.lang === 'zh';
    const transfers = state.transfers;
    const active = transfers.filter((t) => t.state === 'running' || t.state === 'scanning' || t.state === 'queued');
    const btn = document.getElementById('btnTransfers');
    btn.classList.toggle('hidden', transfers.length === 0);
    btn.classList.toggle('busy', active.length > 0);
    const badge = document.getElementById('transfersBadge');
    badge.textContent = String(active.length);
    badge.classList.toggle('hidden', active.length === 0);
    if (transfers.length === 0) showTransferPanel(false);

    let totalDone = 0;
    let total = 0;
    active.forEach((t) => {
      totalDone += t.doneBytes;
      total += t.totalBytes;
    });
    document.getElementById('transferSummary').textContent = active.length > 0
      ? (zh ? `${active.length} 个进行中` : `${active.length} active`) + (total > 0 ? ` · ${Math.floor((totalDone / total) * 100)}%` : '')
      : (zh ? `${transfers.length} 项` : `${transfers.length} item(s)`);

    list.innerHTML = transfers.map((t) => {
      const pct = t.totalBytes > 0 ? Math.min(100, (t.doneBytes / t.totalBytes) * 100) : (t.state === 'completed' ? 100 : 0);
      const icon = t.direction === 'upload' ? ICONS.upload : ICONS.download;
      const dest = t.direction === 'upload' ? `${t.hostId}:${t.destDir}` : t.destDir;
      const from = t.direction === 'upload' ? (zh ? '上传到 ' : 'to ') + dest : (zh ? `从 ${t.hostId} 下载到 ` : `from ${t.hostId} to `) + dest;
      const stats = [];
      if (t.totalBytes > 0 || t.totalFiles > 0) stats.push(`${formatBytes(t.doneBytes)} / ${formatBytes(t.totalBytes)}`);
      if (t.totalFiles > 1) stats.push(zh ? `${t.doneFiles}/${t.totalFiles} 个文件` : `${t.doneFiles}/${t.totalFiles} files`);
      if (t.state === 'running' && t.speed > 0) stats.push(formatBytes(t.speed) + '/s');
      if (t.etaSeconds != null) stats.push((zh ? '剩余 ' : 'ETA ') + formatEta(t.etaSeconds));
      const actions = [];
      const act = (action, iconSvg, title, cls) => actions.push(`<button type="button" class="mini-icon-btn ${cls || ''}" data-action="${action}" data-id="${t.id}" title="${escapeHtml(title)}">${iconSvg}</button>`);
      if (t.state === 'running' || t.state === 'scanning' || t.state === 'queued') {
        act('pause', ICONS.pause, zh ? '暂停（中断，可继续）' : 'Pause (resumable)');
        act('cancel', ICONS.stop, zh ? '取消（删除未完成的文件）' : 'Cancel (deletes the partial file)', 'danger');
      } else if (t.state === 'paused') {
        act('resume', ICONS.play, zh ? '继续' : 'Resume');
        act('cancel', ICONS.stop, zh ? '取消（删除未完成的文件）' : 'Cancel (deletes the partial file)', 'danger');
      } else if (t.state === 'failed') {
        act('resume', ICONS.retry, zh ? '重试（从断点继续）' : 'Retry (resumes)');
      }
      if (t.canUndo) act('undo', ICONS.undo, zh ? '撤销：把已传输的文件移到回收站' : 'Undo: move the transferred files to the trash');
      if (t.canRestore) act('restore', ICONS.redo, zh ? '恢复：把文件从回收站移回' : 'Restore the files from the trash');
      if (t.state === 'completed' || t.state === 'cancelled' || t.state === 'failed' || t.state === 'undone' || t.state === 'paused') {
        act('remove', ICONS.close, t.state === 'undone' ? (zh ? '移除记录并清空其回收站' : 'Remove, and empty its trash') : (zh ? '从列表移除' : 'Remove from list'));
      }
      return `<div class="transfer-item state-${t.state}">
        <div class="transfer-item-top">
          <span class="transfer-dir ${t.direction}">${icon}</span>
          <span class="transfer-name" title="${escapeHtml(t.name)}">${escapeHtml(t.name)}</span>
          <span class="transfer-actions">${actions.join('')}</span>
        </div>
        <div class="transfer-sub" title="${escapeHtml(dest)}">${escapeHtml(from)}</div>
        <div class="transfer-bar"><i style="width:${pct.toFixed(1)}%"></i></div>
        <div class="transfer-meta"><span class="transfer-state">${escapeHtml(transferStateLabel(t))}</span><span>${escapeHtml(stats.join(' · '))}</span></div>
        ${t.error ? `<div class="transfer-error">${escapeHtml(t.error)}</div>` : ''}
        ${t.currentFile && t.totalFiles > 1 ? `<div class="transfer-current" title="${escapeHtml(t.currentFile)}">${escapeHtml(t.currentFile)}</div>` : ''}
      </div>`;
    }).join('');
  }

  function onTransfersUpdate(transfers) {
    const before = new Map(state.transfers.map((t) => [t.id, t.state]));
    state.transfers = transfers || [];
    renderTransfers();
    // Refresh the remote listing when an upload into the folder being shown finishes
    for (const t of state.transfers) {
      const prev = before.get(t.id);
      if (prev && prev !== t.state && (t.state === 'completed' || t.state === 'undone' || (prev === 'undone' && t.state !== 'undone'))) {
        if (t.direction === 'upload' && t.hostId === state.selectedSshHostId && t.destDir === sshBrowser.currentPath && !document.getElementById('sshModal').classList.contains('hidden')) {
          sshBrowser.refresh();
        }
        if (t.state === 'completed' && prev !== 'undone') {
          showToast((state.lang === 'zh' ? '传输完成：' : 'Transfer complete: ') + t.name, 'info');
        }
      }
    }
  }

  document.getElementById('transferList').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    btn.disabled = true;
    try {
      const res = await rpc('transfer:control', { id: btn.getAttribute('data-id'), action: btn.getAttribute('data-action') });
      onTransfersUpdate(res.transfers);
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
    }
  });
  const transferBulk = (action) => rpc('transfer:control', { action }).then((res) => onTransfersUpdate(res.transfers)).catch((err) => showToast(err.message, 'error'));
  document.getElementById('btnTransfersPauseAll').addEventListener('click', () => transferBulk('pauseAll'));
  document.getElementById('btnTransfersResumeAll').addEventListener('click', () => transferBulk('resumeAll'));
  document.getElementById('btnTransfersClear').addEventListener('click', () => transferBulk('clearFinished'));
  document.getElementById('btnTransfersClose').addEventListener('click', () => showTransferPanel(false));
  document.getElementById('btnTransfers').addEventListener('click', () => {
    showTransferPanel(document.getElementById('transferPanel').classList.contains('hidden'));
  });

  /* ==================== Settings Modal ==================== */
  const settingsUi = { aiInfo: null, launchers: null };

  function selectSettingsSection(section) {
    document.querySelectorAll('#appSettingsModal .settings-nav-item').forEach((el) => el.classList.toggle('active', el.getAttribute('data-section') === section));
    document.querySelectorAll('#appSettingsModal .settings-section').forEach((el) => el.classList.toggle('active', el.getAttribute('data-section') === section));
  }

  function fillLauncherSelect(selectEl, apps, current, firstOption) {
    selectEl.innerHTML = '';
    const add = (value, label, disabled) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      opt.disabled = !!disabled;
      selectEl.appendChild(opt);
    };
    add(firstOption.value, firstOption.label);
    apps.forEach((app) => {
      const notes = [];
      if (!app.available) notes.push(tr('notInstalled'));
      if (!app.supportsRemote) notes.push(tr('localOnly'));
      add(app.id, app.name + (notes.length ? ` (${notes.join(', ')})` : ''), !app.available && app.id !== current);
    });
    add('custom', tr('customOption'));
    selectEl.value = current && Array.from(selectEl.options).some((o) => o.value === current) ? current : firstOption.value;
  }

  function syncLauncherCustomRows() {
    document.getElementById('cfgTerminalCustomRow').classList.toggle('hidden', document.getElementById('cfgTerminalApp').value !== 'custom');
    document.getElementById('cfgEditorCustomRow').classList.toggle('hidden', document.getElementById('cfgEditorApp').value !== 'custom');
  }

  async function loadLaunchers(refresh) {
    const s = state.settings;
    settingsUi.launchers = await rpc('launchers:list', { refresh: !!refresh });
    fillLauncherSelect(document.getElementById('cfgTerminalApp'), settingsUi.launchers.terminals, s['gitmap.terminal.app'] || 'system', { value: 'system', label: tr('systemDefault') });
    fillLauncherSelect(document.getElementById('cfgEditorApp'), settingsUi.launchers.editors, s['gitmap.editor.app'] || 'auto', { value: 'auto', label: tr('autoDetect') });
    syncLauncherCustomRows();
  }

  function syncAiProviderFields() {
    const info = settingsUi.aiInfo;
    if (!info) return;
    const providerId = document.getElementById('cfgAiProvider').value;
    const preset = info.presets.find((p) => p.id === providerId) || null;
    document.getElementById('cfgAiModel').placeholder = preset && preset.defaultModel ? preset.defaultModel : (state.lang === 'zh' ? '模型名称' : 'Model name');
    document.getElementById('cfgAiBaseUrl').placeholder = preset && preset.defaultBaseUrl ? preset.defaultBaseUrl : 'https://…';
    const needsKey = !!(preset && preset.requiresApiKey);
    const hasKey = !!(info.keys && info.keys[providerId]);
    const keyInput = document.getElementById('cfgAiKey');
    keyInput.disabled = !needsKey;
    keyInput.value = '';
    keyInput.placeholder = !needsKey ? tr('keyNotNeeded') : hasKey ? tr('keySaved') : 'sk-…';
    document.getElementById('btnClearAiKey').classList.toggle('hidden', !(needsKey && hasKey));
    const hintEl = document.getElementById('cfgAiProviderHint');
    const hint = providerId === 'Magpie' ? tr('hintMagpie') : providerId === 'CC Switch' ? tr('hintCcSwitch') : providerId === 'Ollama' ? tr('hintOllama') : '';
    hintEl.textContent = hint;
    hintEl.classList.toggle('hidden', hint === '');
  }

  async function openAppSettingsModal(section) {
    document.getElementById('appSettingsModal').classList.remove('hidden');
    selectSettingsSection(section || 'appearance');
    try {
      const [res, aiInfo] = await Promise.all([rpc('settings:get'), rpc('ai:info')]);
      const s = res.settings || {};
      state.settings = s;
      settingsUi.aiInfo = aiInfo;
      document.getElementById('cfgLanguage').value = s['git-map.language'] || 'Auto';
      document.getElementById('cfgTheme').value = state.theme;
      document.getElementById('cfgColourPreset').value = s['git-map.graph.colourPreset'] || 'Default';
      document.getElementById('cfgGraphStyle').value = s['git-map.graph.style'] || 'rounded';
      document.getElementById('cfgNodeStyle').value = s['git-map.graph.nodeStyle'] || 'Dot';
      document.getElementById('cfgSyntaxHighlight').value = s['gitmap.diff.syntaxHighlight'] === false ? 'off' : 'on';
      document.getElementById('cfgTerminalCustom').value = s['gitmap.terminal.customCommand'] || '';
      document.getElementById('cfgEditorCustom').value = s['gitmap.editor.customCommand'] || '';

      const providerSelect = document.getElementById('cfgAiProvider');
      providerSelect.innerHTML = '';
      aiInfo.presets.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.id === 'Magpie' ? 'Magpie (本地网关 / Local Gateway)'
          : p.id === 'CC Switch' ? 'CC Switch (本地路由 / Local Routing)'
            : p.id === 'Qwen' ? 'Qwen (通义千问)'
              : p.id === 'Doubao' ? 'Doubao (豆包)'
                : p.id === 'Ollama' ? 'Ollama (Local)'
                  : p.name;
        providerSelect.appendChild(opt);
      });
      providerSelect.value = aiInfo.presets.some((p) => p.id === s['git-map.ai.provider']) ? s['git-map.ai.provider'] : (aiInfo.presets[0] ? aiInfo.presets[0].id : '');
      document.getElementById('cfgAiModel').value = s['git-map.ai.model'] || '';
      document.getElementById('cfgAiBaseUrl').value = s['git-map.ai.baseUrl'] || '';
      document.getElementById('cfgAiExplain').checked = !!s['git-map.ai.explainCommit.enabled'];
      document.getElementById('cfgAiCommitMsg').checked = s['git-map.ai.commitMessage.enabled'] !== false;
      syncAiProviderFields();
      await loadLaunchers(false);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function saveAppSettings(closeAfter) {
    const providerSelect = document.getElementById('cfgAiProvider');
    const updates = [
      ['git-map.language', document.getElementById('cfgLanguage').value],
      ['git-map.graph.colourPreset', document.getElementById('cfgColourPreset').value],
      ['git-map.graph.style', document.getElementById('cfgGraphStyle').value],
      ['git-map.graph.nodeStyle', document.getElementById('cfgNodeStyle').value],
      ['gitmap.diff.syntaxHighlight', document.getElementById('cfgSyntaxHighlight').value !== 'off'],
      ['gitmap.terminal.app', document.getElementById('cfgTerminalApp').value],
      ['gitmap.terminal.customCommand', document.getElementById('cfgTerminalCustom').value.trim()],
      ['gitmap.editor.app', document.getElementById('cfgEditorApp').value],
      ['gitmap.editor.customCommand', document.getElementById('cfgEditorCustom').value.trim()],
      ['git-map.ai.provider', providerSelect.value],
      ['git-map.ai.model', document.getElementById('cfgAiModel').value.trim()],
      ['git-map.ai.baseUrl', document.getElementById('cfgAiBaseUrl').value.trim()],
      ['git-map.ai.explainCommit.enabled', document.getElementById('cfgAiExplain').checked],
      ['git-map.ai.commitMessage.enabled', document.getElementById('cfgAiCommitMsg').checked]
    ];
    // Only write settings whose value changed: each write notifies the graph view, which re-renders
    for (const [key, value] of updates) {
      if (state.settings[key] !== value && !(state.settings[key] === undefined && value === '')) {
        const res = await rpc('settings:update', { key, value });
        state.settings = res.settings || state.settings;
      }
    }
    const apiKey = document.getElementById('cfgAiKey').value.trim();
    if (apiKey && !document.getElementById('cfgAiKey').disabled) {
      await rpc('ai:setApiKey', { key: apiKey });
    }

    const langVal = document.getElementById('cfgLanguage').value;
    state.lang = langVal === 'Simplified Chinese' ? 'zh' : langVal === 'English' ? 'en' : (navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en');
    applyTheme(document.getElementById('cfgTheme').value);
    applyLanguageUI();
    if (closeAfter) document.getElementById('appSettingsModal').classList.add('hidden');
    showToast(tr('settingsSaved'), 'info');
  }

  document.querySelectorAll('#appSettingsModal .settings-nav-item').forEach((btn) => {
    btn.addEventListener('click', () => selectSettingsSection(btn.getAttribute('data-section')));
  });
  document.getElementById('cfgAiProvider').addEventListener('change', syncAiProviderFields);
  document.getElementById('cfgTerminalApp').addEventListener('change', syncLauncherCustomRows);
  document.getElementById('cfgEditorApp').addEventListener('change', syncLauncherCustomRows);
  document.getElementById('btnRedetectApps').addEventListener('click', () => loadLaunchers(true).catch((err) => showToast(err.message, 'error')));
  document.getElementById('btnClearAiKey').addEventListener('click', async () => {
    try {
      // The key belongs to the saved provider, so save the provider choice first
      await rpc('settings:update', { key: 'git-map.ai.provider', value: document.getElementById('cfgAiProvider').value });
      await rpc('ai:clearApiKey');
      settingsUi.aiInfo = await rpc('ai:info');
      syncAiProviderFields();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
  document.getElementById('btnTestTerminal').addEventListener('click', async () => {
    try {
      await saveAppSettings(false);
      await openExternalTerminal(state.activeRepo || state.homeDir);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
  document.getElementById('btnTestEditor').addEventListener('click', async () => {
    try {
      await saveAppSettings(false);
      await openInEditor(state.activeRepo);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
  document.getElementById('btnSaveAppSettings').addEventListener('click', () => {
    saveAppSettings(true).catch((err) => showToast(err.message, 'error'));
  });

  /** Open a local path / ssh:// location in the external terminal chosen in Settings. */
  async function openExternalTerminal(location) {
    const res = await rpc('term:openSystem', { repo: location || state.activeRepo || state.homeDir });
    showToast(tr('openedIn', res.app), 'status');
  }

  /** Open a local path / ssh:// location in the code editor chosen in Settings. */
  async function openInEditor(location) {
    if (!location) throw new Error(tr('noActiveRepo'));
    const res = await rpc('editor:open', { repo: location });
    showToast(tr('openedIn', res.app), 'status');
  }

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
  document.getElementById('btnOpenSysTerm').addEventListener('click', () => {
    openExternalTerminal(state.activeRepo || state.homeDir).catch((err) => showToast(err.message, 'error'));
  });
  document.getElementById('btnAppSettings').addEventListener('click', () => openAppSettingsModal());
  document.getElementById('btnToggleTheme').addEventListener('click', () => toggleTheme());

  // Modal Close Buttons
  document.querySelectorAll('.modal-close').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-close');
      if (targetId) document.getElementById(targetId).classList.add('hidden');
    });
  });

  // SSH Host Add Form
  document.getElementById('btnShowAddHostForm').addEventListener('click', () => {
    const form = document.getElementById('sshHostForm');
    if (!form.classList.contains('hidden') && !document.getElementById('sshFormId').value) form.classList.add('hidden');
    else openHostForm(null);
  });
  document.getElementById('sshHostSearch').addEventListener('input', () => renderModalSshHosts());
  document.getElementById('btnCancelHostForm').addEventListener('click', () => {
    document.getElementById('sshHostForm').classList.add('hidden');
  });
  document.getElementById('sshHostForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const editingId = document.getElementById('sshFormId').value || undefined;
      const res = await rpc('ssh:saveHost', {
        id: editingId,
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
      const tagsValue = document.getElementById('sshFormTags').value;
      const existing = findHost(res.profile.id);
      if (tagsValue.trim() || (existing && (existing.tags || []).length)) {
        const metaRes = await rpc('ssh:updateHostMeta', { id: res.profile.id, alias: existing ? existing.alias || '' : '', tags: tagsValue });
        state.sshHosts = metaRes.hosts || state.sshHosts;
      }
      document.getElementById('sshHostForm').classList.add('hidden');
      document.getElementById('sshFormPassword').value = '';
      document.getElementById('sshFormId').value = '';
      renderSidebar();
      renderModalSshHosts();
      selectAndBrowseSshHost(res.profile.id, res.profile.defaultPath || '~');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Escape closes the topmost dialog / panel
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    const prompt = document.getElementById('promptModal');
    if (!prompt.classList.contains('hidden')) {
      document.getElementById('promptCloseBtn').click();
      return;
    }
    for (const id of ['appSettingsModal', 'sshModal', 'localModal']) {
      const el = document.getElementById(id);
      if (!el.classList.contains('hidden')) {
        el.classList.add('hidden');
        return;
      }
    }
    if (!document.getElementById('transferPanel').classList.contains('hidden')) showTransferPanel(false);
  });

  // Click on a modal's backdrop (outside the window) closes it
  document.querySelectorAll('#sshModal, #localModal, #appSettingsModal').forEach((backdrop) => {
    backdrop.addEventListener('mousedown', (e) => {
      if (e.target === backdrop) backdrop.classList.add('hidden');
    });
  });

  // Initialize UI
  document.querySelectorAll('[data-icon]').forEach((el) => {
    const name = el.getAttribute('data-icon');
    if (ICONS[name]) el.innerHTML = ICONS[name];
  });
  applyTheme(state.theme);
  applyLanguageUI();
  renderTabBar();
  connectWs();
})();
