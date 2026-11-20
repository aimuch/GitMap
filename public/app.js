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
      remoteServers: '远程服务器',
      hostTags: '标签 (可选，逗号分隔)',
      navAppearance: '外观',
      navTools: '终端与编辑器',
      navAi: 'AI',
      themeLabel: '主题',
      themeSystem: '跟随系统',
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
      aiRequestHeader: '接口与参数',
      aiApiFormat: '接口格式',
      aiApiFormatDefault: '默认（{0}）',
      aiEndpointPath: '接口路径（可选）',
      aiThinking: '思考 / 推理强度',
      aiThinkingDefault: '默认（不发送）',
      aiThinkingOff: '关闭',
      aiThinkingLow: '低',
      aiThinkingMedium: '中',
      aiThinkingHigh: '高',
      aiTemperature: '温度 (0–2)',
      aiMaxTokens: '最大输出 Tokens',
      aiTimeout: '超时（秒）',
      aiStream: '流式输出（推荐；网关不支持流式时关闭）',
      aiRecommendHint: '参考值：生成提交说明 温度 0.2、思考「关闭」或「低」（更快更省）；解释提交 温度 0.3。留空 = 不发送，使用服务商默认值。思考模型（o 系列、GPT-5、Claude 思考）通常不接受自定义温度，留空即可。',
      aiAdvanced: '高级：额外请求参数 / 请求头',
      aiExtraBody: '额外请求参数（JSON，合并进请求体，覆盖上面的同名参数）',
      aiExtraHeaders: '额外请求头（JSON）',
      aiPreview: '请求预览',
      aiTest: '保存并测试连接',
      aiTesting: '正在测试…',
      aiTestOk: '连接成功（{0} ms，{1}）：{2}',
      aiTestFellBack: '默认接口不存在，已自动改用 {0}。建议把「接口格式」设为它，省去每次多试一次。',
      aiTestFailed: '测试失败：{0}',
      aiFallbackNote: '若返回 404/405，会自动改试 {0}',
      phTemperature: '留空 = 默认；参考 0.2',
      phMaxTokens: '留空 = 默认；参考 1024',
      phEndpointPath: '留空 = {0}',
      phModelName: '模型名称',
      openedIn: '已在 {0} 中打开',
      openInTerminal: '在外部终端中打开',
      openInEditor: '在编辑器中打开',
      settingsSaved: '设置已保存',
      noActiveRepo: '请先选择一个仓库',
      scmCommit: '暂存与提交',
      scmModalTitle: '暂存与提交更改',
      toolsMenu: '工具箱',
      viewLogs: '查看诊断日志',
      restoreHistoryBackup: '恢复历史备份',
      wrapLines: '自动换行',
      timeMachine: '时光机',
      emptyFileNotice: '文件内容为空或两个版本无文本差异。',
      truncatedDiffNotice: '文件较大（超过 5 MB），仅展示前 5 MB 内容。',
      appIconHeader: '应用图标',
      iconThemeAuto: '跟随主题',
      iconThemeDark: '深色图标',
      iconThemeLight: '浅色图标',
      appIconHint: '点击任意款式立即应用到顶栏、浏览器标签页与桌面 Dock / 任务栏图标（每款均含深浅双色）。',
      repoFilesBtn: '仓库文件',
      repoFilesTab: '仓库文件',
      noActiveRepoForFiles: '请先在左侧选择或添加一个本地 / Remote-SSH 仓库，即可在此浏览并管理仓库文件。',
      layoutTabsShort: '单栏',
      layoutSplitLrShort: '左右分栏',
      layoutSplitTbShort: '上下分栏',
      swapPanesShort: '调换位置',
      commitHistoryPane: '提交历史 (Git Map)',
      repoFilesPane: '仓库文件资源管理器',
      combinedSplitTab: 'Git Map · 仓库文件',
      inlinePreview: '内联预览'
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
      remoteServers: 'Remote Servers',
      hostTags: 'Tags (optional, comma separated)',
      navAppearance: 'Appearance',
      navTools: 'Terminal & Editor',
      navAi: 'AI',
      themeLabel: 'Theme',
      themeSystem: 'Match System',
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
      hintOllama: 'Uses the local Ollama service; no API key needed.',
      aiRequestHeader: 'API & Parameters',
      aiApiFormat: 'API Format',
      aiApiFormatDefault: 'Default ({0})',
      aiEndpointPath: 'Endpoint Path (Optional)',
      aiThinking: 'Thinking / Reasoning Effort',
      aiThinkingDefault: 'Default (not sent)',
      aiThinkingOff: 'Off',
      aiThinkingLow: 'Low',
      aiThinkingMedium: 'Medium',
      aiThinkingHigh: 'High',
      aiTemperature: 'Temperature (0–2)',
      aiMaxTokens: 'Max Output Tokens',
      aiTimeout: 'Timeout (Seconds)',
      aiStream: 'Stream responses (recommended; turn off if a gateway doesn\'t support streaming)',
      aiRecommendHint: 'Suggested: commit messages — temperature 0.2, thinking Off or Low (faster and cheaper); explaining commits — temperature 0.3. Empty = not sent (the provider\'s default). Reasoning models (o-series, GPT-5, Claude thinking) usually reject a custom temperature, so leave it empty.',
      aiAdvanced: 'Advanced: extra body parameters / headers',
      aiExtraBody: 'Extra body parameters (JSON, merged into the request, overriding the parameters above)',
      aiExtraHeaders: 'Extra headers (JSON)',
      aiPreview: 'Request Preview',
      aiTest: 'Save & Test Connection',
      aiTesting: 'Testing…',
      aiTestOk: 'Connected ({0} ms, {1}): {2}',
      aiTestFellBack: 'The default endpoint wasn\'t found, so {0} was used. Set the API Format to it to skip the extra attempt.',
      aiTestFailed: 'Test failed: {0}',
      aiFallbackNote: 'If it returns 404/405, {0} is tried automatically',
      phTemperature: 'Empty = default; suggested 0.2',
      phMaxTokens: 'Empty = default; suggested 1024',
      phEndpointPath: 'Empty = {0}',
      phModelName: 'Model name',
      openedIn: 'Opened in {0}',
      openInTerminal: 'Open in External Terminal',
      openInEditor: 'Open in Editor',
      settingsSaved: 'Settings saved',
      noActiveRepo: 'Select a repository first',
      scmCommit: 'Stage & Commit',
      scmModalTitle: 'Stage & Commit Working Tree',
      toolsMenu: 'Tools',
      viewLogs: 'Diagnostic Logs',
      restoreHistoryBackup: 'Restore History Backup',
      wrapLines: 'Wrap Lines',
      timeMachine: 'Time Machine',
      emptyFileNotice: 'Empty file or no textual differences between revisions.',
      truncatedDiffNotice: 'Large file (> 5 MB): showing the first 5 MB.',
      appIconHeader: 'App Icon',
      iconThemeAuto: 'Auto (Match Theme)',
      iconThemeDark: 'Dark Icon',
      iconThemeLight: 'Light Icon',
      appIconHint: 'Click any icon style to apply immediately to the title bar, tab favicon, and Desktop Dock / Taskbar (each includes Light & Dark variants).',
      repoFilesBtn: 'Repo Files',
      repoFilesTab: 'Files',
      noActiveRepoForFiles: 'Select or add a Local or Remote-SSH repository on the left to browse and manage its files here.',
      layoutTabsShort: 'Tabs',
      layoutSplitLrShort: 'Left / Right',
      layoutSplitTbShort: 'Top / Bottom',
      swapPanesShort: 'Swap Panes',
      commitHistoryPane: 'Commit History (Git Map)',
      repoFilesPane: 'Repository File Explorer',
      combinedSplitTab: 'Git Map · Files',
      inlinePreview: 'Inline Preview'
    }
  };

  const APP_ICON_STYLES = [
    { id: 'classic', zh: '经典分支', en: 'Classic Graph', subZh: '三路提交与合并曲线', subEn: '3-lane branch & merge' },
    { id: 'metro', zh: '地铁星图', en: 'Metro Map', subZh: '45° 枢纽换乘线路图', subEn: 'Transit interchange map' },
    { id: 'neon', zh: '极光脉冲', en: 'Aurora Pulse', subZh: '流光渐变分叉与合流', subEn: 'Gradient S-curve flow' },
    { id: 'compass', zh: '领航罗盘', en: 'Code Compass', subZh: '远端探索与分支指针', subEn: 'Navigation & fork needle' },
    { id: 'isometric', zh: '立体晶格', en: 'Isometric Cube', subZh: '三维几何节点拓扑', subEn: '3D node topology cube' },
    { id: 'minimal', zh: '极简墨白', en: 'Minimal Mono', subZh: '高对比纯粹几何线条', subEn: 'Monochrome Swiss glyph' }
  ];
  const VALID_ICON_STYLE_IDS = new Set(APP_ICON_STYLES.map((s) => s.id));

  const ICONS = window.GITMAP_ICONS || {};

  /* ==================== State ==================== */
  const state = {
    lang: (localStorage.getItem('gitmap.lang') || (navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en')),
    themePref: localStorage.getItem('gitmap.theme') || 'system',
    theme: 'dark',
    iconStyle: localStorage.getItem('gitmap.iconStyle') || 'classic',
    iconTheme: localStorage.getItem('gitmap.iconTheme') || 'auto',
    repos: {},
    activeRepo: null,
    sshHosts: [],
    settings: {},
    homeDir: '~',
    tabs: (() => {
      const coreDefs = {
        graph: { id: 'graph', title: 'Git Map', closable: false, iconSvg: ICONS.branch },
        files: { id: 'files', title: '仓库文件', i18nKey: 'repoFilesTab', closable: false, iconSvg: ICONS.folderOpen }
      };
      try {
        const order = JSON.parse(localStorage.getItem('gitmap.tabs.coreOrder') || '[]');
        if (Array.isArray(order) && order.length === 2 && order.includes('graph') && order.includes('files')) {
          return order.map((id) => coreDefs[id]);
        }
      } catch (_) {}
      return [coreDefs.graph, coreDefs.files];
    })(),
    activeTabId: 'graph',
    wsLayout: (() => {
      const saved = localStorage.getItem('gitmap.ws.layout');
      if (saved === 'split-lr' || saved === 'split-rl') return 'split-lr';
      if (saved === 'split-tb' || saved === 'split-bt') return 'split-tb';
      return 'tabs';
    })(),
    primaryPaneTabId: (() => {
      const rawLayout = localStorage.getItem('gitmap.ws.layout');
      if (rawLayout === 'split-rl' || rawLayout === 'split-bt') return 'files';
      const saved = localStorage.getItem('gitmap.ws.primaryTab');
      return saved === 'files' ? 'files' : 'graph';
    })(),
    secondaryPaneTabId: (() => {
      const rawLayout = localStorage.getItem('gitmap.ws.layout');
      if (rawLayout === 'split-rl' || rawLayout === 'split-bt') return 'graph';
      const saved = localStorage.getItem('gitmap.ws.secondaryTab');
      return saved === 'graph' ? 'graph' : 'files';
    })(),
    focusedPane: 'primary',
    wsSplitRatio: (() => {
      const n = Number(localStorage.getItem('gitmap.ws.splitRatio'));
      return n >= 20 && n <= 80 ? n : 52;
    })(),
    repoInlinePreview: localStorage.getItem('gitmap.repo.inlinePreview') !== '0',
    selectedSshHostId: null,
    sshCurrentPath: '~',
    sshParentPath: null,
    localCurrentPath: '~',
    localParentPath: null,
    terminals: new Map(), // id -> { info, term, fitAddon, containerEl, tabEl }
    activeTermId: null,
    repoQuickStatuses: {}
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
    if (desktopApi.onFullscreenChanged) {
      desktopApi.onFullscreenChanged((isFull) => {
        document.body.classList.toggle('is-fullscreen', !!isFull);
      });
    }
    if (desktopApi.pickLocalFile) {
      const browseKeyBtn = document.getElementById('btnBrowseSshKey');
      if (browseKeyBtn) browseKeyBtn.classList.remove('hidden');
    }
    if (desktopApi.onMainError) {
      desktopApi.onMainError((message) => showToast(message, 'error'));
    }
    desktopApi.onMenuAction((action) => {
      if (action === 'open-local-modal') openLocalModal();
      else if (action === 'open-ssh-modal') openSshModal();
      else if (action === 'open-clone-modal') openCloneModal();
      else if (action === 'open-scm') openScmModal();
      else if (action === 'open-repo-files') openRepoFilesTab(false);
      else if (action === 'open-logs') openLogsModal();
      else if (action === 'open-command-palette') window.GitMapFeatures?.openCommandPalette();
      else if (action === 'fetch-all') window.GitMapFeatures?.fetchAllRepos();
      else if (action === 'open-worktrees') window.GitMapFeatures?.openWorktreesModal();
      else if (action === 'open-prs') window.GitMapFeatures?.openPullRequestsModal();
      else if (action === 'open-rebase') window.GitMapFeatures?.openInteractiveRebaseModal();
      else if (action === 'open-reflog') window.GitMapFeatures?.openReflogModal();
      else if (action === 'toggle-terminal') toggleTerminalDrawer();
      else if (action === 'toggle-sidebar') document.getElementById('sidebar').classList.toggle('collapsed');
      else if (action === 'layout-tabs') setWorkspaceLayout('tabs');
      else if (action === 'layout-split-lr') setWorkspaceLayout(state.wsLayout === 'split-lr' ? 'tabs' : 'split-lr');
      else if (action === 'layout-split-tb') setWorkspaceLayout(state.wsLayout === 'split-tb' ? 'tabs' : 'split-tb');
      else if (action === 'layout-swap-panes') swapWorkspaceSplitPanes();
      else if (action === 'open-settings') openAppSettingsModal();
      else if (action === 'refresh-graph') refreshGraphView();
      else if (action === 'close-tab-or-window') {
        if (state.activeTabId && state.activeTabId !== 'graph' && state.activeTabId !== 'files') {
          closeTab(state.activeTabId);
        } else if (desktopApi.closeOrHideWindow) {
          desktopApi.closeOrHideWindow();
        }
      }
    });
  }

  window.addEventListener('focus', () => {
    if (state.activeRepo && state.activeRepo.startsWith('ssh://')) {
      rpc('repos:pokeRemoteWatch').catch(() => {});
    }
  });

  function refreshGraphView() {
    const frame = document.getElementById('gitMapFrame');
    if (frame) frame.src = '/webview/git-map?t=' + Date.now();
  }

  /* ==================== Theme & Language ==================== */
  const systemDarkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  /** The theme to show for a preference ('system' follows the operating system's appearance). */
  function resolveTheme(pref) {
    if (pref === 'light' || pref === 'dark') return pref;
    return systemDarkQuery && !systemDarkQuery.matches ? 'light' : 'dark';
  }

  function resolveAppIconVariant() {
    if (state.iconTheme === 'dark' || state.iconTheme === 'light') return state.iconTheme;
    return state.theme === 'light' ? 'light' : 'dark';
  }

  function applyAppIcon(persistNative = false) {
    const style = VALID_ICON_STYLE_IDS.has(state.iconStyle) ? state.iconStyle : 'classic';
    state.iconStyle = style;
    const iconMode = state.iconTheme === 'dark' || state.iconTheme === 'light' ? state.iconTheme : 'auto';
    state.iconTheme = iconMode;
    const variant = resolveAppIconVariant();

    try {
      localStorage.setItem('gitmap.iconStyle', style);
      localStorage.setItem('gitmap.iconTheme', iconMode);
    } catch (_) {}

    const brandImg = document.getElementById('brandIconImg');
    if (brandImg) brandImg.src = `/resources/icons/${style}-${variant}.svg`;
    const fav = document.getElementById('appFavicon');
    if (fav) fav.href = `/resources/icons/${style}-${variant}.png`;

    if ((state.initLoaded || persistNative) && desktopApi && desktopApi.setAppIcon) {
      desktopApi.setAppIcon({ style, iconTheme: iconMode, uiTheme: state.themePref, persist: !!persistNative }).catch(() => {});
    }
    renderIconStylePicker();
  }

  async function setAppIconPrefs(nextStyle, nextIconTheme, persist = true) {
    if (nextStyle && VALID_ICON_STYLE_IDS.has(nextStyle)) state.iconStyle = nextStyle;
    if (nextIconTheme === 'auto' || nextIconTheme === 'dark' || nextIconTheme === 'light') state.iconTheme = nextIconTheme;
    applyAppIcon(persist);
    if (persist) {
      try {
        const res = await rpc('settings:updateBatch', {
          updates: {
            'gitmap.app.iconStyle': state.iconStyle,
            'gitmap.app.iconTheme': state.iconTheme
          }
        });
        state.settings = res.settings || state.settings;
      } catch (_) {}
    }
  }

  function renderIconStylePicker() {
    const seg = document.getElementById('cfgIconThemeSeg');
    if (seg) {
      seg.querySelectorAll('.icon-mode-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-icon-theme') === state.iconTheme);
      });
    }
    const grid = document.getElementById('cfgIconStyleGrid');
    if (!grid) return;
    const activeVariant = resolveAppIconVariant();
    const oppositeVariant = activeVariant === 'dark' ? 'light' : 'dark';
    const zh = state.lang === 'zh';

    grid.innerHTML = APP_ICON_STYLES.map((item) => {
      const isSelected = item.id === state.iconStyle;
      const title = zh ? item.zh : item.en;
      const sub = zh ? item.subZh : item.subEn;
      return `<button type="button" class="icon-style-card${isSelected ? ' active' : ''}" data-icon-style="${item.id}">
        <span class="icon-style-preview-wrap">
          <img class="icon-style-main-img" src="/resources/icons/${item.id}-${activeVariant}.svg" alt="${escapeHtml(title)}" />
          <img class="icon-style-alt-img" src="/resources/icons/${item.id}-${oppositeVariant}.svg" alt="" title="${escapeHtml(oppositeVariant === 'light' ? (zh ? '浅色版预览' : 'Light variant') : (zh ? '深色版预览' : 'Dark variant'))}" />
        </span>
        <span class="icon-style-meta">
          <span class="icon-style-title">${escapeHtml(title)}</span>
          <span class="icon-style-sub">${escapeHtml(sub)}</span>
        </span>
      </button>`;
    }).join('');

    grid.querySelectorAll('.icon-style-card').forEach((card) => {
      card.addEventListener('click', () => {
        const chosen = card.getAttribute('data-icon-style');
        setAppIconPrefs(chosen, state.iconTheme, true);
      });
    });
  }

  /**
   * Apply a theme preference: 'system' (default), 'dark' or 'light'.
   */
  function applyTheme(pref) {
    state.themePref = pref === 'light' || pref === 'dark' ? pref : 'system';
    state.theme = resolveTheme(state.themePref);
    try {
      localStorage.setItem('gitmap.theme', state.themePref);
    } catch (_) {}
    document.body.classList.remove('vscode-dark', 'vscode-light', 'theme-dark', 'theme-light');
    document.body.classList.add(state.theme === 'light' ? 'vscode-light' : 'vscode-dark');
    document.body.classList.add(state.theme === 'light' ? 'theme-light' : 'theme-dark');
    document.documentElement.style.colorScheme = state.theme;
    const navAppIcon = document.getElementById('navAppearanceIcon');
    if (navAppIcon) {
      navAppIcon.innerHTML = state.theme === 'light' ? (ICONS.sun || '') : (ICONS.moon || ICONS.sun || '');
    }
    if (state.initLoaded && desktopApi && desktopApi.setNativeTheme) {
      desktopApi.setNativeTheme(state.themePref).catch(() => {});
    }
    state.terminals.forEach((t) => {
      try {
        t.term.options.theme = TERMINAL_THEMES[state.theme];
      } catch (_) {}
    });

    document.querySelectorAll('iframe').forEach((frame) => {
      try {
        frame.contentWindow.postMessage({ __gitmapTheme: state.theme }, window.location.origin);
      } catch (_) {}
    });
    applyAppIcon();
  }

  if (systemDarkQuery) {
    const onSystemThemeChange = () => {
      if (state.themePref === 'system') applyTheme('system');
    };
    if (systemDarkQuery.addEventListener) systemDarkQuery.addEventListener('change', onSystemThemeChange);
    else if (systemDarkQuery.addListener) systemDarkQuery.addListener(onSystemThemeChange);
  }

  function applyLanguageUI() {
    localStorage.setItem('gitmap.lang', state.lang);
    document.documentElement.lang = state.lang === 'zh' ? 'zh-CN' : 'en';
    const sbSearch = document.getElementById('sidebarSearch');
    if (sbSearch) sbSearch.placeholder = state.lang === 'zh' ? '搜索仓库、服务器、#标签' : 'Search repos, servers, #tags';
    const hostSearch = document.getElementById('sshHostSearch');
    if (hostSearch) hostSearch.placeholder = state.lang === 'zh' ? '筛选主机、别名或 #标签' : 'Filter hosts, aliases or #tags';
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const k = el.getAttribute('data-i18n');
      if (k) el.textContent = tr(k);
    });
    renderTabBar();
    renderSidebar();
  }

  /* ==================== WebSocket, Pointer FSMs & RPC Client ==================== */
  const appShellEl = document.getElementById('appShell');
  const fsmApi = window.GitMapFsm;

  const wsMachine = fsmApi
    ? fsmApi.createMachine({
        name: 'wsTransport',
        id: 'main',
        initial: 'connecting',
        bindDataset: appShellEl ? { element: appShellEl, attr: 'data-ws-state' } : null,
        transitions: {
          connecting: { OPEN: 'bootstrapping', INIT: 'ready', CLOSE: 'reconnecting' },
          bootstrapping: { INIT: 'ready', CLOSE: 'reconnecting' },
          ready: { INIT: 'ready', CLOSE: 'reconnecting' },
          reconnecting: { OPEN: 'bootstrapping', INIT: 'ready', CLOSE: 'reconnecting' }
        }
      })
    : null;

  const pointerCleanups = new Set();
  const pointerMachine = fsmApi
    ? fsmApi.createMachine({
        name: 'pointerCapture',
        id: 'shell',
        initial: 'idle',
        bindDataset: appShellEl ? { element: appShellEl, attr: 'data-pointer-mode' } : null,
        transitions: {
          idle: {
            START_SIDEBAR_RESIZE: 'resizingSidebar',
            START_SPLIT_RESIZE: 'resizingSplit',
            START_TERMINAL_RESIZE: 'resizingTerminal',
            START_TAB_DRAG: 'draggingTab',
            END: 'idle',
            CANCEL: 'idle'
          },
          resizingSidebar: { END: 'idle', CANCEL: 'idle' },
          resizingSplit: { END: 'idle', CANCEL: 'idle' },
          resizingTerminal: { END: 'idle', CANCEL: 'idle' },
          draggingTab: { END: 'idle', CANCEL: 'idle' }
        },
        onTransition({ to, event }) {
          if (to === 'idle' && event === 'CANCEL') {
            document.body.classList.remove('resizing-x', 'resizing-y', 'dragging-ws-tab');
            document.querySelectorAll('#tabBar .ws-tab').forEach((el) => el.classList.remove('dragging', 'drop-before', 'drop-after'));
            document.getElementById('wsDropOverlay')?.classList.add('hidden');
            pointerCleanups.forEach((fn) => {
              try {
                fn();
              } catch (_) {}
            });
          }
        }
      })
    : null;

  function cancelActivePointerCapture(reason) {
    if (pointerMachine && !pointerMachine.is('idle')) {
      pointerMachine.send('CANCEL', undefined, { reason: reason || 'reset' });
    } else {
      document.body.classList.remove('resizing-x', 'resizing-y', 'dragging-ws-tab');
      document.getElementById('wsDropOverlay')?.classList.add('hidden');
      pointerCleanups.forEach((fn) => {
        try {
          fn();
        } catch (_) {}
      });
    }
  }

  window.addEventListener('blur', () => cancelActivePointerCapture('window_blur'));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelActivePointerCapture('visibility_hidden');
  });

  function syncAppShellDataset() {
    if (!appShellEl) return;
    appShellEl.setAttribute('data-init-loaded', state.initLoaded ? 'true' : 'false');
    appShellEl.setAttribute('data-ws-layout', state.wsLayout || 'tabs');
    appShellEl.setAttribute('data-active-tab', state.activeTabId || 'graph');
    appShellEl.setAttribute('data-focused-pane', state.focusedPane || 'primary');
    appShellEl.setAttribute('data-active-repo', state.activeRepo || '');
    appShellEl.setAttribute('data-pending-rpc-count', String(pendingRpc.size));
  }

  let ws = null;
  let reqCounter = 0;
  const pendingRpc = new Map();
  const wsQueue = [];
  const RPC_TIMEOUT_MS = 60000;

  function rejectAllPendingRpcs(reasonMsg, code) {
    if (pendingRpc.size === 0) return;
    const entries = Array.from(pendingRpc.values());
    pendingRpc.clear();
    syncAppShellDataset();
    for (const entry of entries) {
      if (entry.timer) clearTimeout(entry.timer);
      const err = new Error(reasonMsg);
      err.code = code || 'WS_CLOSED';
      err.retriable = true;
      try {
        entry.reject(err);
      } catch (_) {}
    }
  }

  function connectWs() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${proto}//${location.host}/ws`);

    ws.addEventListener('open', () => {
      wsMachine?.send('OPEN');
      ws.send(JSON.stringify({ type: 'ui:ready' }));
      while (wsQueue.length > 0) {
        ws.send(wsQueue.shift());
      }
      // Re-attach any active PTY sessions after a transient WebSocket reconnect
      state.terminals.forEach((t, id) => {
        if (t.exited) return;
        rpc('term:attach', { id }).then((res) => {
          if (!res || !res.attached) {
            t.exited = true;
            t.tabEl.classList.add('exited');
          } else if (typeof res.scrollback === 'string' && res.scrollback.length > 0 && t.reattachNeedsReplay) {
            t.reattachNeedsReplay = false;
            t.term.reset();
            t.term.write(res.scrollback);
          }
        }).catch(() => {});
      });
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
      wsMachine?.send('CLOSE');
      state.terminals.forEach((t) => {
        if (!t.exited) t.reattachNeedsReplay = true;
      });
      rejectAllPendingRpcs(
        state.lang === 'zh' ? '与本地服务连接已断开，正在重连…' : 'Connection lost — reconnecting…',
        'WS_CLOSED'
      );
      setTimeout(connectWs, 1500);
    });
  }

  function sendWs(obj) {
    const raw = JSON.stringify(obj);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(raw);
    } else {
      if (wsQueue.length < 200) wsQueue.push(raw);
    }
  }

  function rpc(method, params, timeoutMs) {
    const reqId = 'r' + (++reqCounter);
    // Clone / fetch-all / LFS / submodules / rebase and every AI call can legitimately run longer than 60 s
    // (the AI timeout setting defaults to 90 s): don't report a timeout while the server is still working.
    const LONG_RPC = /^(ai:|git:clone$|repos:fetchAll$|git:lfsAction$|git:submoduleAction$|rebase:execute$|conflict:aiMerge$|hosting:(generatePrDraft|createPr|checkoutPr)$|git:nlSearch$|repos:scanLocal$|ssh:scanRepos$|search:content$|diff:folders$)/;
    const effectiveTimeout = typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : LONG_RPC.test(method) ? 15 * 60 * 1000 : RPC_TIMEOUT_MS;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (pendingRpc.has(reqId)) {
          pendingRpc.delete(reqId);
          syncAppShellDataset();
          const err = new Error(`RPC timeout (${method})`);
          err.code = 'RPC_TIMEOUT';
          err.retriable = true;
          reject(err);
        }
      }, effectiveTimeout);
      pendingRpc.set(reqId, { resolve, reject, timer, method, startedAt: Date.now() });
      syncAppShellDataset();
      sendWs({ type: 'rpc', reqId, method, params: params || {} });
    });
  }

  function handleServerMessage(msg) {
    switch (msg.type) {
      case 'init':
        state.initLoaded = true;
        wsMachine?.send('INIT');
        state.platform = msg.platform || state.platform;
        state.repos = msg.repos || {};
        state.activeRepo = msg.lastActiveRepo || Object.keys(state.repos)[0] || null;
        state.sshHosts = msg.sshHosts || [];
        state.settings = msg.settings || {};
        state.homeDir = msg.homeDir || '~';
        state.canTrash = !!msg.canTrash;
        if (state.settings['gitmap.app.iconStyle'] && VALID_ICON_STYLE_IDS.has(state.settings['gitmap.app.iconStyle'])) {
          state.iconStyle = state.settings['gitmap.app.iconStyle'];
        }
        if (['auto', 'dark', 'light'].includes(state.settings['gitmap.app.iconTheme'])) {
          state.iconTheme = state.settings['gitmap.app.iconTheme'];
        }
        if (['tabs', 'split-lr', 'split-tb'].includes(state.settings['gitmap.ws.layout'])) {
          state.wsLayout = state.settings['gitmap.ws.layout'];
        }
        if (state.settings['gitmap.ws.primaryTab'] === 'graph' || state.settings['gitmap.ws.primaryTab'] === 'files') {
          state.primaryPaneTabId = state.settings['gitmap.ws.primaryTab'];
        }
        if (state.settings['gitmap.ws.secondaryTab'] === 'graph' || state.settings['gitmap.ws.secondaryTab'] === 'files') {
          state.secondaryPaneTabId = state.settings['gitmap.ws.secondaryTab'];
        }
        if (typeof state.settings['gitmap.ws.splitRatio'] === 'number' && state.settings['gitmap.ws.splitRatio'] >= 20 && state.settings['gitmap.ws.splitRatio'] <= 80) {
          state.wsSplitRatio = state.settings['gitmap.ws.splitRatio'];
        }
        if (Array.isArray(state.settings['gitmap.tabs.coreOrder']) && state.settings['gitmap.tabs.coreOrder'].length === 2) {
          const order = state.settings['gitmap.tabs.coreOrder'];
          if (order.includes('graph') && order.includes('files')) {
            const closables = state.tabs.filter((t) => t.closable);
            const map = new Map(state.tabs.filter((t) => !t.closable).map((t) => [t.id, t]));
            state.tabs = [...order.map((id) => map.get(id)).filter(Boolean), ...closables];
          }
        }
        if (['system', 'dark', 'light'].includes(state.settings['gitmap.app.theme'])) {
          applyTheme(state.settings['gitmap.app.theme']);
        } else {
          applyAppIcon();
        }
        if (state.settings['git-map.language'] === 'Simplified Chinese' || state.settings['git-map.language'] === 'English') {
          const lang = state.settings['git-map.language'] === 'English' ? 'en' : 'zh';
          if (lang !== state.lang) {
            state.lang = lang;
            applyLanguageUI();
          }
        }
        renderSidebar();
        renderActiveRepoBadge();
        syncWorkspacePanels();
        window.GitMapFeatures?.refreshAllStatusesAndContext();
        break;

      case 'rpc:res': {
        const entry = pendingRpc.get(msg.reqId);
        if (entry) {
          pendingRpc.delete(msg.reqId);
          if (entry.timer) clearTimeout(entry.timer);
          syncAppShellDataset();
          if (msg.ok) {
            entry.resolve(msg.result);
          } else {
            const err = new Error(msg.error || 'RPC error');
            if (msg.errorCode) err.code = msg.errorCode;
            if (typeof msg.retriable === 'boolean') err.retriable = msg.retriable;
            entry.reject(err);
          }
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
        if (state.activeTabId === 'files' || state.wsLayout !== 'tabs') syncRepoFilesExplorer(false);
        window.GitMapFeatures?.refreshAllStatusesAndContext();
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
          frame.contentWindow.postMessage(msg.payload, window.location.origin);
        }
        break;
      }

      case 'shell:focusGraphTab':
        activateTab('graph');
        break;

      case 'shell:openAppSettings':
        openAppSettingsModal(msg.section);
        break;

      case 'shell:openScm':
        openScmModal(msg.draftMessage || '');
        break;

      case 'settings:changed': {
        state.settings = msg.settings || state.settings;
        if (state.settings['gitmap.app.iconStyle'] && VALID_ICON_STYLE_IDS.has(state.settings['gitmap.app.iconStyle'])) {
          state.iconStyle = state.settings['gitmap.app.iconStyle'];
        }
        if (['auto', 'dark', 'light'].includes(state.settings['gitmap.app.iconTheme'])) {
          state.iconTheme = state.settings['gitmap.app.iconTheme'];
        }
        applyAppIcon();
        if (state.settings['git-map.language'] === 'Simplified Chinese' || state.settings['git-map.language'] === 'English') {
          const lang = state.settings['git-map.language'] === 'English' ? 'en' : 'zh';
          if (lang !== state.lang) {
            state.lang = lang;
            applyLanguageUI();
          }
        }
        break;
      }

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
        if (frame && frame.contentWindow) frame.contentWindow.postMessage(msg.payload, window.location.origin);
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
        state.sshHosts = msg.hosts || msg.sshHosts || state.sshHosts;
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
    if (ev.origin !== window.location.origin) return;
    const data = ev.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'gitmap-webview-req' && data.payload) {
      if (data.payload.command === 'loadRepoInfo' && typeof data.payload.repo === 'string') {
        const repoChanged = state.activeRepo !== data.payload.repo;
        state.activeRepo = data.payload.repo;
        renderSidebar();
        renderActiveRepoBadge();
        if (repoChanged && (state.activeTabId === 'files' || state.wsLayout !== 'tabs')) {
          syncRepoFilesExplorer(true);
        }
      }
      sendWs({ type: 'graph:request', payload: data.payload });
    } else if (data.type === 'gitmap-vfh-req' && data.payload) {
      sendWs({ type: 'vfh:request', panelId: data.panelId, payload: data.payload });
    } else if (data.type === 'gitmap-shell-action') {
      if (data.action === 'open-local-modal') openLocalModal();
      else if (data.action === 'open-ssh-modal') openSshModal();
      else if (data.action === 'open-scm') openScmModal();
      else if (data.action === 'open-repo-files') openRepoFilesTab(false);
      else if (data.action === 'toggle-split-layout') {
        if (data.shiftKey) setWorkspaceLayout(state.wsLayout === 'split-tb' ? 'tabs' : 'split-tb');
        else setWorkspaceLayout(state.wsLayout === 'tabs' ? 'split-lr' : 'tabs');
      }
      else if (data.action === 'open-command-palette') window.GitMapFeatures?.openCommandPalette();
      else if (data.action === 'open-shortcuts') window.GitMapSystemUI?.openShortcutsModal();
      else if (data.action === 'open-content-search') window.GitMapRemoteAndGitUI?.openContentSearchModal();
      else if (data.action === 'locate-repo-file' && data.filePath) {
        locateFileInRepoBrowser(String(data.filePath));
      }
      else if (data.action === 'focus-search') {
        const sb = document.getElementById('sidebar');
        const input = document.getElementById('sidebarSearch');
        sb.classList.remove('collapsed');
        input.focus();
        input.select();
      }
    } else if (data.type === 'gitmap-shell-key' && data.key === 'Escape') {
      closeTopmostOverlay();
    }
  });

  /* ==================== Cross-Pane Linkage (Git Map <-> Repo Files) ==================== */
  function filterGitMapByRepoFile(entryFullPath) {
    if (!state.activeRepo || !entryFullPath) return;
    const disp = parseRepoDisplay(state.activeRepo);
    // parseRepoDisplay gives the remote path for ssh:// repos and the folder for local ones (there's no `rawPath`)
    const repoRoot = (disp && (disp.isRemote ? disp.remotePath : disp.fullDisplay)) || state.activeRepo;
    let rel = String(entryFullPath).replace(/\\/g, '/');
    const normRoot = String(repoRoot).replace(/\\/g, '/').replace(/\/+$/, '');
    if (rel.startsWith(normRoot + '/')) rel = rel.slice(normRoot.length + 1);
    if (state.wsLayout === 'tabs') activateTab('graph');
    const iframe = document.getElementById('gitMapFrame');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ __gitmapFilterByFile: rel }, window.location.origin || '*');
    }
    showToast(state.lang === 'zh' ? `已在 Git Map 中筛选文件历史：${rel}` : `Filtered Git Map by file: ${rel}`, 'status');
  }

  async function locateFileInRepoBrowser(relPath) {
    if (!state.activeRepo || !relPath) return;
    const cleanRel = String(relPath).replace(/\\/g, '/').replace(/^\/+/, '');
    if (state.wsLayout === 'tabs') {
      await openRepoFilesTab(false);
    } else {
      await openRepoFilesTab(true);
    }
    const parts = cleanRel.split('/');
    const dirParts = parts.slice(0, -1);
    const info = activeRepoTarget();
    if (!info) return;
    // Open the folder that holds the file first (the browser only lists one folder), then find its row by full path
    const root = (info.isRemote ? info.remotePath : info.fullDisplay).replace(/[\\/]+$/, '');
    const sep = !info.isRemote && root.includes('\\') ? '\\' : '/';
    const fullPath = root + sep + parts.join(sep);
    try {
      await repoFilesBrowser.navigate(dirParts.length ? root + sep + dirParts.join(sep) : root, { push: true });
    } catch (_) {}
    setTimeout(() => {
      const panel = document.getElementById('panel-files');
      if (!panel) return;
      const filterInput = panel.querySelector('.fb-filter-input');
      if (filterInput && filterInput.value) {
        filterInput.value = '';
        filterInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const norm = (p) => String(p || '').replace(/\\/g, '/');
      let matchedRow = null;
      panel.querySelectorAll('.fb-row').forEach((r) => {
        if (norm(r.getAttribute('title')) === norm(fullPath)) matchedRow = r;
      });
      if (matchedRow) {
        matchedRow.scrollIntoView({ block: 'center', behavior: 'smooth' });
        matchedRow.classList.remove('gm-locate-flash');
        void matchedRow.offsetWidth;
        matchedRow.classList.add('gm-locate-flash');
      } else {
        showToast(state.lang === 'zh' ? `已在仓库文件中定位路径：${cleanRel}` : `Located in repository files: ${cleanRel}`, 'status');
      }
    }, 280);
  }

  /* ==================== Toast Notifications ==================== */
  function showToast(message, level) {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = 'toast ' + (level || 'info');
    el.innerHTML = `<span>${escapeHtml(message)}</span><button class="mini-icon-btn" aria-label="Dismiss">${ICONS.close}</button>`;
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

  /** Well-known Git hosting services: reachable over SSH for Git only, never as a shell, so they aren't browsable servers. */
  const GIT_HOSTING_HOSTS = /(^|\.)(github\.com|gitlab\.com|bitbucket\.org|gitee\.com|codeberg\.org|ssh\.dev\.azure\.com|vs-ssh\.visualstudio\.com|codeup\.aliyun\.com|e\.coding\.net|git\.sr\.ht)$/i;

  function isGitHostingHost(h) {
    return !!h && (GIT_HOSTING_HOSTS.test(String(h.host || '')) || GIT_HOSTING_HOSTS.test(String(h.id || '')));
  }

  state.sidebarQuery = '';
  state.collapsedSections = loadUiSet('gitmap.sidebar.collapsedSections');

  function shortenHome(p) {
    const home = String(state.homeDir || '').replace(/[\\/]+$/, '');
    if (home && home !== '~' && (p === home || p.startsWith(home + '/') || p.startsWith(home + '\\'))) return '~' + p.substring(home.length);
    return p;
  }

  /** Does a repository / host match the sidebar search ("#tag" matches tags exactly)? */
  function sidebarMatches(texts, tags) {
    const q = state.sidebarQuery.trim().toLowerCase();
    if (!q) return true;
    if (q.startsWith('#')) return (tags || []).some((t) => t.toLowerCase() === q.slice(1));
    return texts.concat(tags || []).some((t) => t && String(t).toLowerCase().includes(q));
  }

  function emptyStateHtml(iconSvg, text, buttonLabel, buttonCls) {
    return `<div class="sidebar-empty-card"><span class="sidebar-empty-icon">${iconSvg}</span><span>${escapeHtml(text)}</span>${buttonLabel ? `<button type="button" class="mini-btn ${buttonCls}">${ICONS.plus}<span>${escapeHtml(buttonLabel)}</span></button>` : ''}</div>`;
  }

  function renderSidebar() {
    const zh = state.lang === 'zh';
    const localContainer = document.getElementById('localRepoList');
    const repoKeys = Object.keys(state.repos);
    const allLocal = repoKeys.filter((k) => !k.startsWith('ssh://')).sort((a, b) => parseRepoDisplay(a).name.localeCompare(parseRepoDisplay(b).name));
    const localKeys = allLocal.filter((k) => sidebarMatches([parseRepoDisplay(k).name, k], []));
    document.getElementById('localRepoCount').textContent = allLocal.length ? String(allLocal.length) : '';

    document.querySelectorAll('#sidebar .sidebar-section').forEach((sec) => {
      const collapsed = state.collapsedSections.has(sec.getAttribute('data-section')) && !state.sidebarQuery;
      sec.classList.toggle('collapsed', collapsed);
    });

    // Local Repos
    if (allLocal.length === 0) {
      localContainer.innerHTML = state.sidebarQuery ? '' : emptyStateHtml(ICONS.folder, zh ? '还没有本地仓库' : 'No local repositories yet', zh ? '添加本地仓库' : 'Add Local Repository', 'act-empty-add-local');
      const btn = localContainer.querySelector('.act-empty-add-local');
      if (btn) btn.addEventListener('click', () => openLocalModal());
    } else if (localKeys.length === 0) {
      localContainer.innerHTML = `<div class="sidebar-empty">${escapeHtml(zh ? '没有匹配的本地仓库' : 'No matching local repositories')}</div>`;
    } else {
      localContainer.innerHTML = '';
      const dupNames = duplicateNames(allLocal);
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
    // Git hosting services (github.com, …) can't be browsed: only show them if a repository somehow uses them
    const hosts = (state.sshHosts || []).filter((h) => !isGitHostingHost(h) || byHost.has(h.id));
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
    // A host matches the search if it does itself, or if any of its repositories does
    const repoMatches = (k) => sidebarMatches([parseRepoDisplay(k).name, parseRepoDisplay(k).remotePath], []);
    const hostSelfMatches = (h) => sidebarMatches([h.alias, h.name, h.host, h.user], h.tags);
    const matchesSearch = (h) => hostSelfMatches(h) || (byHost.get(h.id) || []).some(repoMatches);
    document.getElementById('remoteRepoCount').textContent = remoteKeys.length ? String(remoteKeys.length) : '';

    const withRepos = hosts.filter((h) => byHost.has(h.id) && matchesTag(h) && matchesSearch(h)).sort((a, b) => hostLabel(a.id).localeCompare(hostLabel(b.id)));
    const idle = hosts.filter((h) => !byHost.has(h.id) && matchesTag(h) && matchesSearch(h)).sort((a, b) => hostLabel(a.id).localeCompare(hostLabel(b.id)));
    const dupNames = duplicateNames(remoteKeys);

    container.innerHTML = '';
    if (withRepos.length === 0 && idle.length === 0) {
      if (state.remoteTagFilter || state.sidebarQuery) {
        container.innerHTML = `<div class="sidebar-empty">${escapeHtml(zh ? '没有匹配的服务器' : 'No matching servers')}</div>`;
      } else {
        container.innerHTML = emptyStateHtml(ICONS.remote, zh ? '还没有 SSH 服务器' : 'No SSH servers yet', zh ? '连接服务器' : 'Connect a Server', 'act-empty-add-host');
        container.querySelector('.act-empty-add-host').addEventListener('click', () => openSshModal().then(() => openHostForm(null)));
      }
      return;
    }
    if (withRepos.length === 0 && !state.remoteTagFilter && !state.sidebarQuery) {
      const hint = document.createElement('div');
      hint.className = 'sidebar-hint';
      hint.textContent = zh ? '选择一台服务器，浏览并打开其中的 Git 仓库' : 'Pick a server to browse it and open its Git repositories';
      container.appendChild(hint);
    }

    withRepos.forEach((h) => {
      let keys = byHost.get(h.id).slice().sort((a, b) => parseRepoDisplay(a).remotePath.localeCompare(parseRepoDisplay(b).remotePath));
      if (state.sidebarQuery && !hostSelfMatches(h)) keys = keys.filter(repoMatches);
      const collapsed = state.collapsedHosts.has(h.id) && !state.sidebarQuery;
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

    if (idle.length > 0 && (withRepos.length === 0 || state.sidebarQuery)) {
      idle.forEach((h) => container.appendChild(buildHostHeader(h, 0, true, true)));
    } else if (idle.length > 0) {
      const others = document.createElement('div');
      others.className = 'host-idle' + (state.showIdleHosts ? ' expanded' : '');
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'host-idle-toggle';
      toggle.innerHTML = `<span class="chev">${state.showIdleHosts ? ICONS.chevronDown : ICONS.arrowRight}</span><span>${escapeHtml(zh ? `其他服务器 (${idle.length})` : `Other servers (${idle.length})`)}</span>`;
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
      <span class="host-group-label"><span class="host-group-name">${escapeHtml(hostLabel(h.id))}</span>${idle ? `<span class="host-group-addr">${escapeHtml(hostAddress(h))}</span>` : ''}</span>
      <span class="host-group-tags">${tagChipsHtml(h.tags, 'small')}</span>
      ${repoCount > 0 ? `<span class="host-group-count">${repoCount}</span>` : ''}
      <span class="host-group-actions">
        <button type="button" class="host-add-repo-pill act-browse" title="${escapeHtml(zh ? '浏览此服务器目录并添加 Git 仓库' : 'Browse this server and add Git repositories')}">${ICONS.plus}<span>${escapeHtml(zh ? '仓库' : 'Repo')}</span></button>
        ${h.source !== 'unknown' ? `<button type="button" class="mini-icon-btn act-host-term" title="${escapeHtml(zh ? '在外部终端中 SSH 登录此服务器' : 'Open SSH Terminal to This Server')}">${ICONS.terminal}</button>
        <button type="button" class="mini-icon-btn act-host-edit" title="${escapeHtml(zh ? '编辑服务器别名、标签与连接' : 'Edit Server Alias, Tags & Connection')}">${ICONS.tag}</button>` : ''}
        ${h.connected ? `<button type="button" class="mini-icon-btn danger act-host-disconnect" title="${escapeHtml(zh ? '断开此 SSH 连接' : 'Disconnect SSH Session')}">${ICONS.disconnect}</button>` : ''}
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
        const clickedTag = e.target.closest('.tag-chip').getAttribute('data-tag') || '';
        state.remoteTagFilter = state.remoteTagFilter.toLowerCase() === clickedTag.toLowerCase() ? '' : clickedTag;
        try {
          localStorage.setItem('gitmap.sidebar.tagFilter', state.remoteTagFilter);
        } catch (_) {}
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

  let activeClientDialogDismiss = null;
  function beginClientDialogSession(onSupersede) {
    if (typeof activeClientDialogDismiss === 'function') {
      const prev = activeClientDialogDismiss;
      activeClientDialogDismiss = null;
      try {
        prev();
      } catch (_) {}
    }
    activeClientDialogDismiss = onSupersede || null;
  }

  /** Edit the GitMap alias & tags of a host (both ~/.ssh/config and saved hosts). */
  function openHostMetaDialog(hostId) {
    const h = findHost(hostId);
    if (!h) return;
    const zh = state.lang === 'zh';
    const modal = document.getElementById('clientDialogModal');
    beginClientDialogSession(() => modal.classList.add('hidden'));
    document.getElementById('clientDialogTitle').textContent = (zh ? '服务器别名与标签：' : 'Server Alias & Tags: ') + h.name;
    const bodyEl = document.getElementById('clientDialogBody');
    const footerEl = document.getElementById('clientDialogFooter');
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

    const close = () => {
      activeClientDialogDismiss = null;
      modal.classList.add('hidden');
    };
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
      else if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        close();
      }
    }));
    footerEl.querySelector('.act-ok').onclick = save;
    footerEl.querySelector('.act-cancel').onclick = close;
    document.getElementById('clientDialogCloseBtn').onclick = close;
    const editConn = footerEl.querySelector('.act-edit-conn');
    if (editConn) {
      editConn.onclick = () => {
        close();
        openSshModal().then(() => openHostForm(h));
      };
    }
    setTimeout(() => aliasInput.focus(), 30);
  }

  function syncSshAuthFields() {
    const auth = document.getElementById('sshFormAuth').value;
    document.getElementById('sshKeyField').classList.toggle('hidden', auth !== 'auto' && auth !== 'key');
    document.getElementById('sshPasswordField').classList.toggle('hidden', auth !== 'auto' && auth !== 'password');
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
    syncSshAuthFields();
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
    let pathLine = shortenHome(info.fullDisplay);
    if (info.isRemote) {
      pathLine = options.homeDir && (info.remotePath === options.homeDir || info.remotePath.startsWith(options.homeDir + '/'))
        ? '~' + info.remotePath.substring(options.homeDir.length)
        : info.remotePath;
    }
    const qs = state.repoQuickStatuses && state.repoQuickStatuses[repoKey];
    const badges = [];
    if (qs && !qs.offline) {
      if (qs.branch) badges.push(`<span class="repo-mini-badge branch">${escapeHtml(qs.branch)}</span>`);
      if (qs.ahead > 0) badges.push(`<span class="repo-mini-badge sync">↑${qs.ahead}</span>`);
      if (qs.behind > 0) badges.push(`<span class="repo-mini-badge sync">↓${qs.behind}</span>`);
      const dirty = (qs.stagedCount || 0) + (qs.unstagedCount || 0);
      if (dirty > 0) badges.push(`<span class="repo-mini-badge dirty">•${dirty}</span>`);
      if (qs.conflictCount > 0) badges.push(`<span class="repo-mini-badge conflict">!${qs.conflictCount}</span>`);
    }
    const el = document.createElement('div');
    el.className = 'repo-item' + (info.isRemote ? ' is-remote' : '') + (state.activeRepo === repoKey ? ' active' : '');
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.setAttribute('data-repo-uri', repoKey);
    el.title = info.isRemote ? `${hostLabel(info.hostId)}:${info.remotePath}` : info.fullDisplay;
    el.innerHTML = `
      <div class="repo-item-top">
        <span class="repo-item-name">${escapeHtml(label)}</span>
        <span class="repo-item-badges">${badges.join('')}</span>
        <span class="repo-item-actions">
          <button class="mini-icon-btn act-files" title="${escapeHtml(state.lang === 'zh' ? '浏览与管理仓库文件' : 'Browse & Manage Repository Files')}">${ICONS.folderOpen}</button>
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
      if (state.wsLayout !== 'tabs') {
        activateTab('graph');
        syncRepoFilesExplorer(true);
      } else if (state.activeTabId === 'files') {
        syncRepoFilesExplorer(true);
      } else {
        activateTab('graph');
      }
      rpc('repos:select', { repo: repoKey })
        .then(() => window.GitMapFeatures?.refreshRepoContext())
        .catch((err) => showToast(err.message, 'error'));
    });
    el.addEventListener('keydown', (e) => {
      if (e.target !== el) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        el.click();
      }
    });
    el.querySelector('.act-files').addEventListener('click', (e) => {
      e.stopPropagation();
      state.activeRepo = repoKey;
      renderSidebar();
      renderActiveRepoBadge();
      rpc('repos:select', { repo: repoKey }).then(() => window.GitMapFeatures?.refreshRepoContext()).catch(() => {});
      openRepoFilesTab(true);
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
  function hashTabKey(prefix, raw) {
    let h1 = 0xdeadbeef ^ raw.length;
    let h2 = 0x41c6ce57 ^ raw.length;
    for (let i = 0; i < raw.length; i++) {
      const ch = raw.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return prefix + (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
  }

  let activeDraggedTabId = null;

  function isSplitWorkspace() {
    return state.wsLayout === 'split-lr' || state.wsLayout === 'split-tb';
  }

  function tabById(id) {
    return state.tabs.find((t) => t.id === id) || null;
  }

  function tabDisplayTitle(tab) {
    if (!tab) return '';
    return tab.i18nKey ? tr(tab.i18nKey) : tab.title;
  }

  function pickCompanionTab(excludeTabId, preferredId) {
    if (preferredId && preferredId !== excludeTabId && tabById(preferredId)) return preferredId;
    if (excludeTabId === 'graph' && tabById('files')) return 'files';
    if (excludeTabId === 'files' && tabById('graph')) return 'graph';
    const other = state.tabs.find((t) => t.id !== excludeTabId);
    return other ? other.id : excludeTabId;
  }

  let wsPersistTimer = 0;
  function scheduleServerWorkspacePersist() {
    if (!state.initLoaded) return;
    if (wsPersistTimer) clearTimeout(wsPersistTimer);
    wsPersistTimer = setTimeout(() => {
      wsPersistTimer = 0;
      const coreOrder = state.tabs.filter((t) => t.id === 'graph' || t.id === 'files').map((t) => t.id);
      const isCorePrimary = state.primaryPaneTabId === 'graph' || state.primaryPaneTabId === 'files';
      const isCoreSecondary = state.secondaryPaneTabId === 'graph' || state.secondaryPaneTabId === 'files';
      const corePairPatch = {};
      if (isCorePrimary && isCoreSecondary && state.primaryPaneTabId !== state.secondaryPaneTabId) {
        corePairPatch['gitmap.ws.primaryTab'] = state.primaryPaneTabId;
        corePairPatch['gitmap.ws.secondaryTab'] = state.secondaryPaneTabId;
      } else if (isCorePrimary) {
        corePairPatch['gitmap.ws.primaryTab'] = state.primaryPaneTabId;
        corePairPatch['gitmap.ws.secondaryTab'] = state.primaryPaneTabId === 'files' ? 'graph' : 'files';
      } else if (isCoreSecondary) {
        corePairPatch['gitmap.ws.secondaryTab'] = state.secondaryPaneTabId;
        corePairPatch['gitmap.ws.primaryTab'] = state.secondaryPaneTabId === 'files' ? 'graph' : 'files';
      }
      rpc('settings:updateBatch', {
        updates: {
          'gitmap.ws.layout': state.wsLayout,
          ...corePairPatch,
          'gitmap.ws.splitRatio': state.wsSplitRatio,
          ...(coreOrder.length === 2 ? { 'gitmap.tabs.coreOrder': coreOrder } : {})
        }
      }).catch(() => {});
    }, 220);
  }

  function persistWorkspaceLayout() {
    try {
      localStorage.setItem('gitmap.ws.layout', state.wsLayout);
      localStorage.setItem('gitmap.ws.splitRatio', String(state.wsSplitRatio));
      if (state.primaryPaneTabId === 'graph' || state.primaryPaneTabId === 'files') {
        localStorage.setItem('gitmap.ws.primaryTab', state.primaryPaneTabId);
      }
      if (state.secondaryPaneTabId === 'graph' || state.secondaryPaneTabId === 'files') {
        localStorage.setItem('gitmap.ws.secondaryTab', state.secondaryPaneTabId);
      }
    } catch (_) {}
    scheduleServerWorkspacePersist();
  }

  function persistCoreTabOrder() {
    try {
      const coreOrder = state.tabs.filter((t) => t.id === 'graph' || t.id === 'files').map((t) => t.id);
      if (coreOrder.length === 2) {
        localStorage.setItem('gitmap.tabs.coreOrder', JSON.stringify(coreOrder));
      }
    } catch (_) {}
    scheduleServerWorkspacePersist();
  }

  function moveTabOrder(fromTabId, toTabId, placeAfter) {
    if (!fromTabId || !toTabId || fromTabId === toTabId) return;
    const fromIdx = state.tabs.findIndex((t) => t.id === fromTabId);
    if (fromIdx === -1) return;
    const [moved] = state.tabs.splice(fromIdx, 1);
    const targetIdx = state.tabs.findIndex((t) => t.id === toTabId);
    if (targetIdx === -1) {
      state.tabs.push(moved);
    } else {
      state.tabs.splice(placeAfter ? targetIdx + 1 : targetIdx, 0, moved);
    }
    persistCoreTabOrder();
    renderTabBar();
  }

  function ensureValidSplitTabs() {
    if (!tabById(state.primaryPaneTabId)) {
      state.primaryPaneTabId = state.tabs[0]?.id || 'graph';
    }
    if (!tabById(state.secondaryPaneTabId) || state.secondaryPaneTabId === state.primaryPaneTabId) {
      state.secondaryPaneTabId = pickCompanionTab(state.primaryPaneTabId, 'files');
    }
    if (state.secondaryPaneTabId === state.primaryPaneTabId) {
      state.wsLayout = 'tabs';
    }
  }

  function syncWorkspacePanels() {
    if (isSplitWorkspace()) ensureValidSplitTabs();
    const split = isSplitWorkspace();
    const zh = state.lang === 'zh';
    const stage = document.getElementById('coreSplitStage');
    if (stage) {
      stage.classList.add('active');
      stage.classList.remove('mode-tabs', 'mode-split-lr', 'mode-split-tb');
      stage.classList.add('mode-' + state.wsLayout);
      stage.style.setProperty('--ws-split-primary', state.wsSplitRatio + '%');
      stage.querySelectorAll(':scope > .tab-panel').forEach((panel) => {
        const pTabId = panel.getAttribute('data-tab-id') || panel.id.replace(/^panel-/, '');
        if (!split) {
          panel.classList.remove('pane-primary', 'pane-secondary');
          panel.classList.toggle('active', pTabId === state.activeTabId);
        } else {
          const isPrimary = pTabId === state.primaryPaneTabId;
          const isSecondary = !isPrimary && pTabId === state.secondaryPaneTabId;
          panel.classList.toggle('pane-primary', isPrimary);
          panel.classList.toggle('pane-secondary', isSecondary);
          panel.classList.toggle('active', isPrimary || isSecondary);
          const hdr = panel.querySelector(':scope > .split-pane-header');
          if (hdr && (isPrimary || isSecondary)) {
            hdr.classList.toggle('focused-pane', (isPrimary && state.focusedPane === 'primary') || (isSecondary && state.focusedPane === 'secondary'));
            const badge = hdr.querySelector('.split-pane-pos-badge');
            if (badge) {
              badge.textContent = state.wsLayout === 'split-lr'
                ? (isPrimary ? (zh ? '左栏' : 'Left') : (zh ? '右栏' : 'Right'))
                : (isPrimary ? (zh ? '上栏' : 'Top') : (zh ? '下栏' : 'Bottom'));
            }
          }
        }
      });
    }

    const ctrls = document.getElementById('wsLayoutControls');
    if (ctrls) {
      ctrls.querySelectorAll('.ws-layout-btn[data-ws-layout]').forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-ws-layout') === state.wsLayout);
      });
    }
    const swapBtn = document.getElementById('btnSwapSplitPanes');
    if (swapBtn) {
      swapBtn.classList.toggle('hidden', !split);
    }

    renderTabBar();
    syncAppShellDataset();
    const filesVisible = (!split && state.activeTabId === 'files') || (split && (state.primaryPaneTabId === 'files' || state.secondaryPaneTabId === 'files'));
    if (filesVisible) {
      syncRepoFilesExplorer(false);
    }
  }

  function hideTabContextMenu() {
    const menu = document.getElementById('tabContextMenu');
    if (menu) {
      menu.classList.add('hidden');
      menu.innerHTML = '';
      menu.onkeydown = null;
    }
  }

  function openGenericContextMenu(actions, clientX, clientY) {
    const menu = document.getElementById('tabContextMenu');
    if (!menu || !Array.isArray(actions) || actions.length === 0) return;
    menu.innerHTML = actions.map((item, idx) => {
      if (item.sep) return '<div class="ws-ctx-sep" role="separator"></div>';
      return `<button type="button" class="ws-ctx-item${item.danger ? ' danger-text' : ''}" data-idx="${idx}" role="menuitem">
        <span class="icon-slot">${item.icon || ''}</span>
        <span>${escapeHtml(item.label)}</span>
        ${item.checked ? '<span class="ws-ctx-item-check">✓</span>' : ''}
      </button>`;
    }).join('');
    menu.classList.remove('hidden');

    const mRect = menu.getBoundingClientRect();
    const left = Math.max(8, Math.min(clientX, window.innerWidth - mRect.width - 8));
    const top = Math.max(8, Math.min(clientY, window.innerHeight - mRect.height - 8));
    menu.style.left = Math.round(left) + 'px';
    menu.style.top = Math.round(top) + 'px';

    const items = Array.from(menu.querySelectorAll('.ws-ctx-item'));
    items.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const chosen = actions[Number(btn.getAttribute('data-idx'))];
        hideTabContextMenu();
        if (chosen && chosen.run) chosen.run();
      });
    });

    menu.onkeydown = (e) => {
      if (!items.length) return;
      const curIdx = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        items[(curIdx + 1 + items.length) % items.length].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        items[(curIdx - 1 + items.length) % items.length].focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        hideTabContextMenu();
      }
    };
    if (items[0]) setTimeout(() => items[0].focus(), 10);
  }

  function openTabContextMenu(tabId, clientX, clientY) {
    const tab = tabById(tabId);
    if (!tab) return;
    const zh = state.lang === 'zh';
    const tabIdx = state.tabs.findIndex((t) => t.id === tabId);
    const isLeft = state.wsLayout === 'split-lr' && state.primaryPaneTabId === tabId;
    const isRight = state.wsLayout === 'split-lr' && state.secondaryPaneTabId === tabId;
    const isTop = state.wsLayout === 'split-tb' && state.primaryPaneTabId === tabId;
    const isBottom = state.wsLayout === 'split-tb' && state.secondaryPaneTabId === tabId;

    const actions = [
      { id: 'left', icon: ICONS.dockLeft || ICONS.splitHorizontal, label: zh ? '在左侧分栏显示' : 'Show in Left Pane', checked: isLeft, run: () => placeTabInSplitPane(tabId, 'left') },
      { id: 'right', icon: ICONS.dockRight || ICONS.splitHorizontal, label: zh ? '在右侧分栏显示' : 'Show in Right Pane', checked: isRight, run: () => placeTabInSplitPane(tabId, 'right') },
      { id: 'top', icon: ICONS.dockTop || ICONS.splitVertical, label: zh ? '在上方分栏显示' : 'Show in Top Pane', checked: isTop, run: () => placeTabInSplitPane(tabId, 'top') },
      { id: 'bottom', icon: ICONS.dockBottom || ICONS.splitVertical, label: zh ? '在下方分栏显示' : 'Show in Bottom Pane', checked: isBottom, run: () => placeTabInSplitPane(tabId, 'bottom') },
      { sep: true },
      ...(isSplitWorkspace()
        ? [{ id: 'swap', icon: ICONS.swapPanes, label: zh ? '调换两栏位置（左⇄右 / 上⇄下）' : 'Swap Split Panes', run: () => swapWorkspaceSplitPanes() }]
        : []),
      { id: 'single', icon: ICONS.layoutTabs, label: zh ? '单栏全屏显示此标签' : 'Maximize in Single Pane', checked: !isSplitWorkspace() && state.activeTabId === tabId, run: () => setWorkspaceLayout('tabs', tabId) }
    ];

    if (tabIdx > 0 || tabIdx < state.tabs.length - 1) {
      actions.push({ sep: true });
      if (tabIdx > 0) {
        actions.push({ id: 'move-left', icon: ICONS.arrowLeft, label: zh ? '标签向左移动' : 'Move Tab Left', run: () => moveTabOrder(tabId, state.tabs[tabIdx - 1].id, false) });
      }
      if (tabIdx < state.tabs.length - 1) {
        actions.push({ id: 'move-right', icon: ICONS.arrowRight, label: zh ? '标签向右移动' : 'Move Tab Right', run: () => moveTabOrder(tabId, state.tabs[tabIdx + 1].id, true) });
      }
    }

    if (tab.closable) {
      actions.push({ sep: true });
      actions.push({ id: 'close', icon: ICONS.close, label: zh ? '关闭此标签页' : 'Close Tab', run: () => closeTab(tabId) });
      const otherClosable = state.tabs.filter((t) => t.closable && t.id !== tabId);
      if (otherClosable.length > 0) {
        actions.push({
          id: 'close-others',
          icon: ICONS.trash,
          label: zh ? '关闭其他动态标签页' : 'Close Other Dynamic Tabs',
          run: () => otherClosable.forEach((t) => closeTab(t.id))
        });
      }
    }

    openGenericContextMenu(actions, clientX, clientY);
  }

  function renderTabBar() {
    const bar = document.getElementById('tabBar');
    const split = isSplitWorkspace();
    const zh = state.lang === 'zh';
    bar.classList.toggle('single-tab', state.tabs.length <= 1);
    bar.innerHTML = '';
    state.tabs.forEach((tab) => {
      const inPrimary = split && state.primaryPaneTabId === tab.id;
      const inSecondary = split && !inPrimary && state.secondaryPaneTabId === tab.id;
      const isFocusedActive = !split
        ? state.activeTabId === tab.id
        : (inPrimary && state.focusedPane === 'primary') || (inSecondary && state.focusedPane === 'secondary');
      const isPeerActive = split && (inPrimary || inSecondary) && !isFocusedActive;

      let badgeHtml = '';
      if (inPrimary) {
        badgeHtml = `<span class="ws-tab-pane-badge">${escapeHtml(state.wsLayout === 'split-lr' ? (zh ? '左' : 'L') : (zh ? '上' : 'T'))}</span>`;
      } else if (inSecondary) {
        badgeHtml = `<span class="ws-tab-pane-badge">${escapeHtml(state.wsLayout === 'split-lr' ? (zh ? '右' : 'R') : (zh ? '下' : 'B'))}</span>`;
      }

      const tabEl = document.createElement('div');
      tabEl.className = 'ws-tab' + (isFocusedActive ? ' active' : '') + (isPeerActive ? ' split-peer' : '');
      tabEl.setAttribute('role', 'tab');
      tabEl.setAttribute('tabindex', '0');
      tabEl.setAttribute('aria-selected', String(isFocusedActive || isPeerActive));
      tabEl.setAttribute('draggable', 'true');
      tabEl.setAttribute('data-tab-id', tab.id);
      const iconHtml = tab.iconSvg || ICONS.gitRepo || '';
      const titleText = tabDisplayTitle(tab);
      tabEl.innerHTML = `
        <span class="ws-tab-icon">${iconHtml}</span>
        <span class="ws-tab-title" title="${escapeHtml(titleText + (zh ? '（可拖拽排序 / 右键分栏）' : ' (Drag to reorder / Right-click to split)'))}">${escapeHtml(titleText)}</span>
        ${badgeHtml}
        ${tab.closable ? `<button class="ws-tab-close" title="${escapeHtml(tr('close'))}" aria-label="${escapeHtml(tr('close'))}">${ICONS.close}</button>` : ''}
      `;
      tabEl.addEventListener('click', (e) => {
        if (e.target.closest('.ws-tab-close')) return;
        activateTab(tab.id);
      });
      tabEl.addEventListener('keydown', (e) => {
        if (e.target !== tabEl) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activateTab(tab.id);
        }
      });
      tabEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openTabContextMenu(tab.id, e.clientX, e.clientY);
      });
      tabEl.addEventListener('dragstart', (e) => {
        if (e.target.closest('.ws-tab-close')) {
          e.preventDefault();
          return;
        }
        hideTabContextMenu();
        activeDraggedTabId = tab.id;
        pointerMachine?.send('START_TAB_DRAG', undefined, { tabId: tab.id });
        tabEl.classList.add('dragging');
        document.body.classList.add('dragging-ws-tab');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          try {
            e.dataTransfer.setData('text/plain', tab.id);
          } catch (_) {}
        }
      });
      tabEl.addEventListener('dragend', () => {
        activeDraggedTabId = null;
        pointerMachine?.send('END');
        tabEl.classList.remove('dragging');
        document.body.classList.remove('dragging-ws-tab');
        document.querySelectorAll('#tabBar .ws-tab').forEach((el) => el.classList.remove('drop-before', 'drop-after'));
        document.getElementById('wsDropOverlay')?.classList.add('hidden');
      });
      if (tab.closable) {
        tabEl.addEventListener('auxclick', (e) => {
          if (e.button === 1) {
            e.preventDefault();
            closeTab(tab.id);
          }
        });
        tabEl.querySelector('.ws-tab-close').addEventListener('click', (e) => {
          e.stopPropagation();
          closeTab(tab.id);
        });
      }
      bar.appendChild(tabEl);
    });
  }

  /** Confirm-dialog arguments for deleting local items: to the Trash in the desktop app, permanent in browser mode. */
  function localDeleteConfirmText(count, names) {
    const zh = state.lang === 'zh';
    return state.canTrash
      ? [zh ? '移到废纸篓' : 'Move to Trash', (zh ? `以下 ${count} 项会移到废纸篓，需要时可以从废纸篓恢复：\n\n` : `Move these ${count} item(s) to the Trash? You can restore them from there.\n\n`) + names, zh ? '移到废纸篓' : 'Move to Trash', true]
      : [zh ? '永久删除文件 / 文件夹' : 'Permanently Delete Items', (zh ? `浏览器模式没有废纸篓，以下 ${count} 项（文件夹含其全部内容）会被永久删除，不可恢复：\n\n` : `Browser mode has no Trash: these ${count} item(s) will be deleted for good:\n\n`) + names, zh ? '永久删除' : 'Delete Permanently', true];
  }

  /** Discard: changes to tracked files can't be undone; untracked files go to the Trash in the desktop app (local repos). */
  function discardConfirmText(question) {
    const zh = state.lang === 'zh';
    const remote = !!(state.activeRepo && String(state.activeRepo).startsWith('ssh://'));
    const tail = state.canTrash && !remote
      ? (zh ? '已跟踪文件的改动不可撤销；未跟踪的新文件会移到废纸篓。' : "Changes to tracked files can't be undone; untracked files go to the Trash.")
      : (zh ? '此操作不可撤销（未跟踪的新文件也会被永久删除）。' : 'This cannot be undone (untracked files are deleted for good).');
    return question + '\n' + tail;
  }

  /** Coming back to the Git Map (e.g. after a diff tab): scroll the file opened last in the commit details into view. */
  function revealLastViewedInGitMap() {
    const iframe = document.getElementById('gitMapFrame');
    if (iframe && iframe.contentWindow) iframe.contentWindow.postMessage({ __gitmapRevealLastViewed: true }, window.location.origin || '*');
  }

  function activateTab(tabId, opts) {
    if (!tabById(tabId)) return;
    if (tabId === 'graph' && state.activeTabId !== 'graph') setTimeout(revealLastViewedInGitMap, 60);
    if (!isSplitWorkspace()) {
      state.activeTabId = tabId;
      syncWorkspacePanels();
      return;
    }
    if (tabId === state.primaryPaneTabId) {
      state.focusedPane = 'primary';
      state.activeTabId = tabId;
    } else if (tabId === state.secondaryPaneTabId) {
      state.focusedPane = 'secondary';
      state.activeTabId = tabId;
    } else if (opts && opts.preferSecondaryWhenGraphPrimary && state.primaryPaneTabId === 'graph') {
      state.secondaryPaneTabId = tabId;
      state.focusedPane = 'secondary';
      state.activeTabId = tabId;
    } else if (opts && opts.preferSecondaryWhenGraphPrimary && state.secondaryPaneTabId === 'graph') {
      state.primaryPaneTabId = tabId;
      state.focusedPane = 'primary';
      state.activeTabId = tabId;
    } else if (state.focusedPane === 'primary') {
      state.primaryPaneTabId = tabId;
      state.activeTabId = tabId;
    } else {
      state.secondaryPaneTabId = tabId;
      state.activeTabId = tabId;
    }
    persistWorkspaceLayout();
    syncWorkspacePanels();
  }

  function placeTabInSplitPane(tabId, side) {
    if (!tabById(tabId)) return;
    const nextLayout = (side === 'top' || side === 'bottom') ? 'split-tb' : 'split-lr';
    const intoPrimary = (side === 'left' || side === 'top');
    const prevPrimary = state.primaryPaneTabId;
    const prevSecondary = state.secondaryPaneTabId;
    const wasSplit = isSplitWorkspace();

    state.wsLayout = nextLayout;
    if (intoPrimary) {
      if (wasSplit && prevSecondary === tabId && prevPrimary !== tabId && tabById(prevPrimary)) {
        state.secondaryPaneTabId = prevPrimary;
      } else if (!state.secondaryPaneTabId || state.secondaryPaneTabId === tabId || !tabById(state.secondaryPaneTabId)) {
        state.secondaryPaneTabId = pickCompanionTab(tabId, wasSplit ? prevPrimary : state.activeTabId);
      }
      state.primaryPaneTabId = tabId;
      state.focusedPane = 'primary';
    } else {
      if (wasSplit && prevPrimary === tabId && prevSecondary !== tabId && tabById(prevSecondary)) {
        state.primaryPaneTabId = prevSecondary;
      } else if (!state.primaryPaneTabId || state.primaryPaneTabId === tabId || !tabById(state.primaryPaneTabId)) {
        state.primaryPaneTabId = pickCompanionTab(tabId, wasSplit ? prevSecondary : state.activeTabId);
      }
      state.secondaryPaneTabId = tabId;
      state.focusedPane = 'secondary';
    }
    state.activeTabId = tabId;
    persistWorkspaceLayout();
    syncWorkspacePanels();
  }

  function setWorkspaceLayout(nextMode, targetTab) {
    if (nextMode === 'tabs') {
      state.wsLayout = 'tabs';
      if (targetTab && tabById(targetTab)) {
        state.activeTabId = targetTab;
      } else if (!tabById(state.activeTabId)) {
        state.activeTabId = state.primaryPaneTabId || 'graph';
      }
      persistWorkspaceLayout();
      syncWorkspacePanels();
      return;
    }
    if (nextMode === 'split-rl') {
      state.wsLayout = 'split-lr';
      state.primaryPaneTabId = 'files';
      state.secondaryPaneTabId = 'graph';
      state.focusedPane = 'primary';
    } else if (nextMode === 'split-bt') {
      state.wsLayout = 'split-tb';
      state.primaryPaneTabId = 'files';
      state.secondaryPaneTabId = 'graph';
      state.focusedPane = 'primary';
    } else if (nextMode === 'split-lr' || nextMode === 'split-tb') {
      const wasSplit = isSplitWorkspace();
      state.wsLayout = nextMode;
      if (!wasSplit) {
        const cur = tabById(targetTab || state.activeTabId) ? (targetTab || state.activeTabId) : 'graph';
        if (cur === 'files') {
          state.primaryPaneTabId = 'graph';
          state.secondaryPaneTabId = 'files';
          state.focusedPane = 'secondary';
        } else {
          state.primaryPaneTabId = cur;
          state.secondaryPaneTabId = pickCompanionTab(cur, 'files');
          state.focusedPane = 'primary';
        }
      }
    } else {
      return;
    }
    persistWorkspaceLayout();
    syncWorkspacePanels();
  }

  function swapWorkspaceSplitPanes() {
    const zh = state.lang === 'zh';
    if (!isSplitWorkspace()) {
      setWorkspaceLayout('split-rl');
    } else {
      const tmp = state.primaryPaneTabId;
      state.primaryPaneTabId = state.secondaryPaneTabId;
      state.secondaryPaneTabId = tmp;
      state.focusedPane = state.focusedPane === 'primary' ? 'secondary' : 'primary';
      state.wsSplitRatio = Math.max(20, Math.min(80, Math.round(100 - state.wsSplitRatio)));
      persistWorkspaceLayout();
      syncWorkspacePanels();
    }
    const pTitle = tabDisplayTitle(tabById(state.primaryPaneTabId));
    const sTitle = tabDisplayTitle(tabById(state.secondaryPaneTabId));
    const msg = state.wsLayout === 'split-tb'
      ? (zh ? `已调换：上「${pTitle}」 ⇄ 下「${sTitle}」` : `Swapped: Top "${pTitle}" ⇄ Bottom "${sTitle}"`)
      : (zh ? `已调换：左「${pTitle}」 ⇄ 右「${sTitle}」` : `Swapped: Left "${pTitle}" ⇄ Right "${sTitle}"`);
    showToast(msg, 'status');
  }

  async function closeTab(tabId, forceDiscard) {
    const idx = state.tabs.findIndex((t) => t.id === tabId);
    if (idx === -1 || !state.tabs[idx].closable) return false;
    const panelEl = document.getElementById('panel-' + tabId);
    const contentEl = panelEl ? (panelEl.querySelector('.tab-panel-content') || panelEl) : null;
    if (!forceDiscard && contentEl && typeof contentEl.__confirmDiscardIfDirty === 'function') {
      const ok = await contentEl.__confirmDiscardIfDirty();
      if (!ok) return false;
    }
    if (contentEl && typeof contentEl.__disposeViewer === 'function') {
      contentEl.__disposeViewer();
    }
    const latestIdx = state.tabs.findIndex((t) => t.id === tabId);
    if (latestIdx === -1) return true;
    state.tabs.splice(latestIdx, 1);
    if (tabId.startsWith('vfh-')) {
      sendWs({ type: 'panel:close', panelId: tabId.slice(4) });
    }
    if (panelEl) panelEl.remove();

    if (isSplitWorkspace()) {
      if (state.primaryPaneTabId === tabId) {
        state.primaryPaneTabId = pickCompanionTab(state.secondaryPaneTabId, 'graph');
      }
      if (state.secondaryPaneTabId === tabId) {
        state.secondaryPaneTabId = pickCompanionTab(state.primaryPaneTabId, 'files');
      }
      if (state.activeTabId === tabId) {
        state.activeTabId = state.focusedPane === 'primary' ? state.primaryPaneTabId : state.secondaryPaneTabId;
      }
      persistWorkspaceLayout();
      syncWorkspacePanels();
      return true;
    }

    if (state.activeTabId === tabId) {
      const next = state.tabs[Math.max(0, latestIdx - 1)] || state.tabs[0];
      activateTab(next.id);
    } else {
      renderTabBar();
    }
    return true;
  }

  function createOrReplacePanelTab(tabId, title, iconSvg) {
    let existing = state.tabs.find((t) => t.id === tabId);
    if (!existing) {
      state.tabs.push({ id: tabId, title, iconSvg: iconSvg || '', closable: true });
    } else {
      existing.title = title;
      if (iconSvg) existing.iconSvg = iconSvg;
    }
    let panelEl = document.getElementById('panel-' + tabId);
    if (!panelEl) {
      panelEl = document.createElement('div');
      panelEl.id = 'panel-' + tabId;
      panelEl.className = 'tab-panel core-pane';
      panelEl.setAttribute('data-tab-id', tabId);
      panelEl.innerHTML = `
        <div class="split-pane-header" draggable="true" data-pane-tab="${escapeHtml(tabId)}">
          <span class="split-pane-pos-badge"></span>
          <span class="icon-slot">${iconSvg || ICONS.fileCode || ''}</span>
          <span class="split-pane-dyn-title">${escapeHtml(title)}</span>
          <span class="split-pane-spacer"></span>
          <button type="button" class="mini-icon-btn act-swap-panes" title="${escapeHtml(state.lang === 'zh' ? '调换两栏位置' : 'Swap Panes')}">${ICONS.swapPanes}</button>
          <button type="button" class="mini-icon-btn act-max-pane" data-tab="${escapeHtml(tabId)}" title="${escapeHtml(state.lang === 'zh' ? '单栏全屏显示' : 'Maximize')}">${ICONS.layoutTabs}</button>
        </div>
        <div class="tab-panel-content"></div>
      `;
      document.getElementById('coreSplitStage').appendChild(panelEl);
    } else {
      const titleSpan = panelEl.querySelector('.split-pane-dyn-title');
      if (titleSpan) titleSpan.textContent = title;
    }
    activateTab(tabId, { preferSecondaryWhenGraphPrimary: true });
    return panelEl.querySelector('.tab-panel-content') || panelEl;
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
    const tabId = hashTabKey('diff-', `${payload.repo}:${payload.fromHash}:${payload.toHash}:${payload.newFilePath}`);
    const panel = createOrReplacePanelTab(tabId, payload.title, ICONS.diff);
    panel.innerHTML = `<div class="browser-empty-state"><span class="fb-spinner"></span>Loading diff…</div>`;

    try {
      const diffData = await rpc('diff:compute', payload);
      panel.__rerenderViewer = () => renderSingleDiffIntoContainer(panel, diffData, payload.hideUnchangedRegions, payload.lines);
      panel.__rerenderViewer();
    } catch (err) {
      panel.innerHTML = `<div class="browser-empty-state error-text">${escapeHtml(err.message)}</div>`;
    }
  }

  async function openMultiDiffTab(payload) {
    const tabId = hashTabKey('multidiff-', `${payload.title}:${(payload.files || []).map((f) => f.newFilePath).join(',')}`);
    const panel = createOrReplacePanelTab(tabId, payload.title, ICONS.multiDiff);
    panel.innerHTML = `
      <div class="multi-diff-layout">
        <div class="multi-diff-sidebar"></div>
        <div class="multi-diff-main" style="flex:1;display:flex;flex-direction:column;min-width:0;min-height:0;"></div>
      </div>
    `;
    const sidebar = panel.querySelector('.multi-diff-sidebar');
    const main = panel.querySelector('.multi-diff-main');
    let currentDiffData = null;
    let diffReqSeq = 0;

    const selectFile = async (idx) => {
      const reqSeq = ++diffReqSeq;
      sidebar.querySelectorAll('.multi-diff-file').forEach((el, i) => el.classList.toggle('active', i === idx));
      const file = payload.files[idx];
      if (!file) return;
      main.innerHTML = `<div class="browser-empty-state"><span class="fb-spinner"></span>Loading ${escapeHtml(file.newFilePath)}…</div>`;
      try {
        const computed = await rpc('diff:compute', file);
        if (reqSeq !== diffReqSeq) return;
        currentDiffData = computed;
        renderSingleDiffIntoContainer(main, currentDiffData, payload.hideUnchangedRegions, null);
      } catch (err) {
        if (reqSeq !== diffReqSeq) return;
        main.innerHTML = `<div class="browser-empty-state error-text">${escapeHtml(err.message)}</div>`;
      }
    };

    panel.__rerenderViewer = () => {
      if (currentDiffData) renderSingleDiffIntoContainer(main, currentDiffData, payload.hideUnchangedRegions, null);
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
    let wrapLines = localStorage.getItem('gitmap.viewer.wrapLines') !== '0';
    const expandedBlocks = new Set();

    container.innerHTML = `
      <div class="viewer-toolbar">
        <div class="viewer-toolbar-left">
          <span class="viewer-path" title="${escapeHtml(diffData.newFilePath)}">${escapeHtml(diffData.oldFilePath !== diffData.newFilePath ? diffData.oldFilePath + ' → ' + diffData.newFilePath : diffData.newFilePath)}</span>
          <span class="diff-stat-add">+${diffData.additions}</span>
          <span class="diff-stat-del">-${diffData.deletions}</span>
          ${diffData.truncated ? `<span class="diff-stat-del">${escapeHtml(tr('truncatedDiffNotice'))}</span>` : ''}
        </div>
        <div class="viewer-toolbar-right">
          <div class="segmented-control">
            <button type="button" class="mode-split active">${escapeHtml(tr('sideBySide'))}</button>
            <button type="button" class="mode-inline">${escapeHtml(tr('inlineDiff'))}</button>
          </div>
          <label class="inline-check"><input type="checkbox" class="fold-toggle" ${foldUnchanged ? 'checked' : ''} /> <span>${escapeHtml(tr('foldUnchanged'))}</span></label>
          <label class="inline-check"><input type="checkbox" class="wrap-toggle" ${wrapLines ? 'checked' : ''} /> <span>${escapeHtml(tr('wrapLines'))}</span></label>
          <button type="button" class="mini-btn act-prev-hunk" title="Previous Change">${ICONS.arrowUp}</button>
          <span class="hunk-counter">0 / 0</span>
          <button type="button" class="mini-btn act-next-hunk" title="Next Change">${ICONS.arrowDown}</button>
          <button type="button" class="mini-btn act-open-rev">${escapeHtml(tr('viewFileRev'))}</button>
          <button type="button" class="mini-btn act-file-hist">${escapeHtml(tr('fileHistoryGraph'))}</button>
          <button type="button" class="mini-btn act-vfh">${escapeHtml(tr('visualHistory'))}</button>
          <button type="button" class="mini-btn act-ftm">${ICONS.clock}<span>${escapeHtml(tr('timeMachine'))}</span></button>
        </div>
      </div>
      <div class="diff-scroll-area"></div>
    `;

    const scrollArea = container.querySelector('.diff-scroll-area');
    const hunkCounterEl = container.querySelector('.hunk-counter');
    let hunkRowElements = [];
    let currentHunkIdx = -1;

    function updateHunkCounter() {
      const total = hunkRowElements.length;
      const shown = total === 0 ? 0 : (currentHunkIdx < 0 ? 0 : currentHunkIdx + 1);
      hunkCounterEl.textContent = `${shown} / ${total}`;
    }

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

    function renderTable(initialScroll) {
      if (diffData.error) {
        scrollArea.innerHTML = `<div class="browser-empty-state error-text">${escapeHtml(diffData.error)}</div>`;
        return;
      }
      if (diffData.isBinary) {
        scrollArea.innerHTML = `<div class="browser-empty-state">${escapeHtml(tr('binaryFileNotice'))}</div>`;
        return;
      }
      if (!diffData.rows || diffData.rows.length === 0) {
        scrollArea.innerHTML = `<div class="browser-empty-state">${escapeHtml(tr('emptyFileNotice'))}</div>`;
        hunkRowElements = [];
        currentHunkIdx = -1;
        updateHunkCounter();
        return;
      }

      const chunks = computeDisplayChunks(diffData.rows);
      const table = document.createElement('table');
      table.className = 'diff-table' + (wrapLines ? '' : ' nowrap');
      const tbody = document.createElement('tbody');
      hunkRowElements = [];
      let prevWasChange = false;
      let targetHighlightRow = null;

      chunks.forEach((chunk) => {
        if (chunk.type === 'fold') {
          const trEl = document.createElement('tr');
          trEl.className = 'diff-fold-row';
          const colSpan = viewMode === 'split' ? 4 : 3;
          trEl.innerHTML = `<td colspan="${colSpan}">⋯ ${escapeHtml(tr('expandLines', chunk.count))} ⋯</td>`;
          trEl.addEventListener('click', () => {
            expandedBlocks.add(chunk.id);
            renderTable(false);
          });
          tbody.appendChild(trEl);
          prevWasChange = false;
          return;
        }

        chunk.rows.forEach((r) => {
          const isChange = r.kind !== 'context';
          const matchesRange = highlightRange && r.newLineNumber != null && r.newLineNumber >= highlightRange.start && r.newLineNumber <= highlightRange.end;
          if (viewMode === 'split') {
            const trEl = document.createElement('tr');
            if (matchesRange) trEl.className = 'file-line-row selected-line';
            const leftCls = r.kind === 'deleted' || r.kind === 'change' ? 'diff-cell-del' : r.oldLineNumber == null ? 'diff-cell-empty' : '';
            const rightCls = r.kind === 'added' || r.kind === 'change' ? 'diff-cell-add' : r.newLineNumber == null ? 'diff-cell-empty' : '';
            trEl.innerHTML = `
              <td class="diff-gutter ${leftCls}">${r.oldLineNumber ?? ''}</td>
              <td class="diff-code diff-side-left ${leftCls}">${formatSide(true, r.oldLineNumber, r.oldText, r.oldSegments, 'word-del')}</td>
              <td class="diff-gutter ${rightCls}">${r.newLineNumber ?? ''}</td>
              <td class="diff-code diff-side-right ${rightCls}">${formatSide(false, r.newLineNumber, r.newText, r.newSegments, 'word-add')}</td>
            `;
            if (isChange && !prevWasChange) hunkRowElements.push(trEl);
            if (matchesRange && !targetHighlightRow) targetHighlightRow = trEl;
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
              if (matchesRange) trAdd.className = 'file-line-row selected-line';
              trAdd.innerHTML = `
                <td class="diff-gutter diff-cell-add"></td>
                <td class="diff-gutter diff-cell-add">${r.newLineNumber ?? ''}</td>
                <td class="diff-code diff-cell-add"><span class="diff-sign">+</span>${formatSide(false, r.newLineNumber, r.newText, r.newSegments, 'word-add')}</td>
              `;
              if (!prevWasChange) hunkRowElements.push(trDel);
              if (matchesRange && !targetHighlightRow) targetHighlightRow = trAdd;
              prevWasChange = true;
              tbody.appendChild(trDel);
              tbody.appendChild(trAdd);
            } else {
              const trEl = document.createElement('tr');
              if (matchesRange) trEl.className = 'file-line-row selected-line';
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
              if (matchesRange && !targetHighlightRow) targetHighlightRow = trEl;
              prevWasChange = isChange;
              tbody.appendChild(trEl);
            }
          }
        });
      });

      table.appendChild(tbody);
      scrollArea.innerHTML = '';
      scrollArea.appendChild(table);
      currentHunkIdx = -1;
      updateHunkCounter();
      if (initialScroll && targetHighlightRow) {
        setTimeout(() => targetHighlightRow.scrollIntoView({ block: 'center' }), 20);
      }
    }

    container.querySelector('.mode-split').addEventListener('click', (e) => {
      viewMode = 'split';
      e.target.classList.add('active');
      container.querySelector('.mode-inline').classList.remove('active');
      renderTable(false);
    });
    container.querySelector('.mode-inline').addEventListener('click', (e) => {
      viewMode = 'inline';
      e.target.classList.add('active');
      container.querySelector('.mode-split').classList.remove('active');
      renderTable(false);
    });
    container.querySelector('.fold-toggle').addEventListener('change', (e) => {
      foldUnchanged = e.target.checked;
      renderTable(false);
    });
    container.querySelector('.wrap-toggle').addEventListener('change', (e) => {
      wrapLines = e.target.checked;
      try {
        localStorage.setItem('gitmap.viewer.wrapLines', wrapLines ? '1' : '0');
      } catch (_) {}
      const tbl = scrollArea.querySelector('.diff-table');
      if (tbl) tbl.classList.toggle('nowrap', !wrapLines);
    });
    container.querySelector('.act-prev-hunk').addEventListener('click', () => {
      if (hunkRowElements.length === 0) return;
      currentHunkIdx = currentHunkIdx <= 0 ? hunkRowElements.length - 1 : currentHunkIdx - 1;
      updateHunkCounter();
      hunkRowElements[currentHunkIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    container.querySelector('.act-next-hunk').addEventListener('click', () => {
      if (hunkRowElements.length === 0) return;
      currentHunkIdx = (currentHunkIdx + 1) % hunkRowElements.length;
      updateHunkCounter();
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
    container.querySelector('.act-ftm').addEventListener('click', async () => {
      await rpc('file:timeMachine', {
        repo: diffData.repo,
        filePath: diffData.newFilePath,
        commitHash: diffData.toHash !== '*' ? diffData.toHash : undefined
      });
    });

    renderTable(true);
  }

  /* ==================== Built-in File Viewer (with Blame, Line History & Virtualization) ==================== */
  async function openFileTab(payload) {
    const keySource = payload.inlineContent
      ? 'inline-' + Date.now()
      : `${payload.repo}:${payload.commit || 'work'}:${payload.filePath}`;
    const tabId = hashTabKey('file-', keySource);
    const panel = createOrReplacePanelTab(tabId, payload.title || payload.filePath, ICONS.fileCode);
    await renderFileViewerInto(panel, payload, {});
  }

  async function renderFileViewerInto(panel, payload, extraOpts) {
    const opts = extraOpts || {};
    if (typeof panel.__disposeViewer === 'function') {
      panel.__disposeViewer();
    }
    const loadSeq = (panel.__fileLoadSeq = (panel.__fileLoadSeq || 0) + 1);
    const renderPreviewBarOnly = (bodyHtml) => {
      if (!opts.isInlinePreview) {
        panel.innerHTML = bodyHtml;
        return;
      }
      panel.innerHTML = `
        <div class="viewer-toolbar">
          <div class="viewer-toolbar-left">
            <span class="viewer-path">${escapeHtml(payload.title || payload.filePath || '')}</span>
          </div>
          <div class="viewer-toolbar-right">
            <button type="button" class="mini-icon-btn act-close-preview" title="${escapeHtml(tr('close'))}">${ICONS.close}</button>
          </div>
        </div>
        ${bodyHtml}
      `;
      panel.querySelector('.act-close-preview')?.addEventListener('click', () => opts.onClosePreview && opts.onClosePreview());
    };
    renderPreviewBarOnly(`<div class="browser-empty-state"><span class="fb-spinner"></span>Loading file…</div>`);

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
      if (loadSeq !== panel.__fileLoadSeq) return;

      if (fileRes.error) {
        renderPreviewBarOnly(`<div class="browser-empty-state error-text">${escapeHtml(fileRes.error)}</div>`);
        return;
      }
      if (fileRes.isBinary) {
        renderPreviewBarOnly(`<div class="browser-empty-state">${escapeHtml(tr('binaryFileNotice'))}</div>`);
        return;
      }

      let showBlame = false;
      let blameData = fileRes.blame || null;
      let selStart = payload.lines ? payload.lines.start : null;
      let selEnd = payload.lines ? payload.lines.end : null;
      let wrapLines = localStorage.getItem('gitmap.viewer.wrapLines') !== '0';
      const richPreviewKind = window.GitMapEditorPreview ? window.GitMapEditorPreview.getPreviewKind(fileRes.filePath) : null;
      let richPreviewActive = richPreviewKind === 'pdf' || richPreviewKind === 'audio' || richPreviewKind === 'video';
      const canEdit = !fileRes.commit && !fileRes.truncated && !fileRes.notUtf8 && typeof payload.inlineContent !== 'string' && !!(fileRes.repo || fileRes.sourceUri || payload.filePath) && !['pdf', 'audio', 'video'].includes(richPreviewKind || '');
      let draftContent = typeof payload.initialDraft === 'string' ? payload.initialDraft : fileRes.content;
      const startInEdit = Boolean(canEdit && payload.startEditing);
      const initialEditorState = startInEdit
        ? (draftContent !== fileRes.content ? 'editingDirty' : 'editingClean')
        : 'viewing';

      const editorMachine = fsmApi
        ? fsmApi.createMachine({
            name: 'inlineEditor',
            id: (opts.isInlinePreview ? 'preview:' : 'tab:') + (fileRes.filePath || 'file'),
            initial: initialEditorState,
            bindDataset: { element: panel, attr: 'data-editor-state' },
            transitions: {
              viewing: { EDIT: 'editingClean', EDIT_DIRTY: 'editingDirty' },
              editingClean: { DIRTY: 'editingDirty', CLEAN: 'editingClean', SAVE: 'saving', CANCEL: 'viewing' },
              editingDirty: { DIRTY: 'editingDirty', CLEAN: 'editingClean', SAVE: 'saving', DISCARD: 'viewing' },
              saving: { SAVED: 'viewing', SAVE_FAILED: 'editingDirty' }
            }
          })
        : null;

      let fallbackEditorState = initialEditorState;
      const getEditorState = () => (editorMachine ? editorMachine.state : fallbackEditorState);
      const sendEditorEvent = (ev) => {
        if (editorMachine) {
          editorMachine.send(ev);
        } else {
          if (ev === 'EDIT' || ev === 'CLEAN') fallbackEditorState = 'editingClean';
          else if (ev === 'EDIT_DIRTY' || ev === 'DIRTY' || ev === 'SAVE_FAILED') fallbackEditorState = 'editingDirty';
          else if (ev === 'SAVE') fallbackEditorState = 'saving';
          else fallbackEditorState = 'viewing';
          panel.setAttribute('data-editor-state', fallbackEditorState);
        }
      };
      if (!editorMachine) panel.setAttribute('data-editor-state', fallbackEditorState);

      const isEditorDirty = () => getEditorState() === 'editingDirty';
      const isEditorActive = () => getEditorState() !== 'viewing';

      const confirmDiscardIfDirty = async () => {
        if (!isEditorDirty()) return true;
        const zh = state.lang === 'zh';
        const ok = await confirmDialog(
          zh ? '未保存的文件更改' : 'Unsaved File Changes',
          zh
            ? `文件 "${fileRes.filePath}" 有尚未保存的编辑内容，确定要放弃更改吗？`
            : `"${fileRes.filePath}" has unsaved edits. Discard your changes?`,
          zh ? '放弃更改' : 'Discard Changes',
          true
        );
        if (ok) {
          draftContent = fileRes.content;
          sendEditorEvent('DISCARD');
        }
        return ok;
      };

      panel.__confirmDiscardIfDirty = confirmDiscardIfDirty;
      panel.__disposeViewer = () => {
        editorMachine?.dispose();
        panel.removeAttribute('data-editor-state');
        panel.__confirmDiscardIfDirty = null;
        panel.__disposeViewer = null;
      };

      const mountViewer = () => {
        const hasRepo = !!fileRes.repo;
        const zh = state.lang === 'zh';
        const isEditing = isEditorActive();
        const dirtyNow = isEditorDirty();
        panel.innerHTML = `
          <div class="viewer-toolbar">
            <div class="viewer-toolbar-left">
              <span class="viewer-path" title="${escapeHtml(fileRes.filePath)}">${escapeHtml(fileRes.filePath)}${fileRes.commit ? ' @ ' + escapeHtml(fileRes.commit.slice(0, 8)) : ''}</span>
              ${isEditing ? `<span class="viewer-dirty-badge${dirtyNow ? '' : ' hidden'}">● ${escapeHtml(zh ? '未保存' : 'Unsaved')}</span>` : ''}
              ${fileRes.truncated ? `<span class="diff-stat-del">${escapeHtml(tr('truncatedDiffNotice'))}</span>` : ''}
              ${fileRes.notUtf8 ? `<span class="diff-stat-del" title="${escapeHtml(zh ? '在 GitMap 里保存会把不认识的字节换成 �，所以只读显示' : 'Saving from GitMap would replace the unknown bytes with �, so it is read-only')}">${escapeHtml(zh ? '不是 UTF-8 编码（如 GBK），只读显示' : 'Not UTF-8 (e.g. GBK): read-only')}</span>` : ''}
            </div>
            <div class="viewer-toolbar-right">
              ${canEdit ? (
                isEditing
                  ? `<button type="button" class="mini-btn primary act-save-file">${ICONS.save}<span>${escapeHtml(zh ? '保存 (⌘S)' : 'Save (⌘S)')}</span></button>
                     <button type="button" class="mini-btn act-cancel-edit">${escapeHtml(tr('cancel'))}</button>`
                  : `<button type="button" class="mini-btn act-edit-file">${ICONS.pencil}<span>${escapeHtml(zh ? '在线编辑' : 'Edit')}</span></button>`
              ) : ''}
              ${!isEditing && richPreviewKind && !['pdf', 'audio', 'video'].includes(richPreviewKind) ? `<button type="button" class="mini-btn act-rich-preview ${richPreviewActive ? 'primary' : ''}">${escapeHtml(richPreviewKind === 'markdown' ? (zh ? (richPreviewActive ? '查看源码' : '渲染预览') : (richPreviewActive ? 'Source' : 'Preview')) : (zh ? (richPreviewActive ? '查看源码' : '表格视图') : (richPreviewActive ? 'Source' : 'Table')))}</button>` : ''}
              ${!isEditing && !richPreviewActive ? `<label class="inline-check"><input type="checkbox" class="wrap-toggle" ${wrapLines ? 'checked' : ''} /> <span>${escapeHtml(tr('wrapLines'))}</span></label>` : ''}
              ${hasRepo && !isEditing ? `
                <button type="button" class="mini-btn act-blame ${showBlame ? 'primary' : ''}">${escapeHtml(tr('toggleBlame'))}</button>
                <button type="button" class="mini-btn act-line-hist">${escapeHtml(tr('lineHistoryGraph'))}</button>
                <button type="button" class="mini-btn act-file-hist">${escapeHtml(tr('fileHistoryGraph'))}</button>
                ${opts.isInlinePreview ? '' : `<button type="button" class="mini-btn act-vfh">${escapeHtml(tr('visualHistory'))}</button>
                <button type="button" class="mini-btn act-ftm">${ICONS.clock}<span>${escapeHtml(tr('timeMachine'))}</span></button>`}
              ` : ''}
              ${opts.isInlinePreview ? `
                <button type="button" class="mini-btn act-promote-tab" title="${escapeHtml(zh ? '在独立标签页中全屏打开' : 'Open in Full Tab')}">${ICONS.layoutTabs}<span>${escapeHtml(zh ? '标签页打开' : 'Open Tab')}</span></button>
                <button type="button" class="mini-icon-btn act-close-preview" title="${escapeHtml(tr('close'))}">${ICONS.close}</button>
              ` : ''}
            </div>
          </div>
          <div class="diff-scroll-area"></div>
        `;

        if (opts.isInlinePreview) {
          panel.querySelector('.act-promote-tab')?.addEventListener('click', () => {
            if (!opts.onPromoteTab) return;
            const transferState = isEditorActive()
              ? { startEditing: true, initialDraft: draftContent }
              : {};
            if (isEditorDirty()) {
              draftContent = fileRes.content;
              sendEditorEvent('DISCARD');
            }
            opts.onPromoteTab(transferState);
          });
          panel.querySelector('.act-close-preview')?.addEventListener('click', async () => {
            if (!(await confirmDiscardIfDirty())) return;
            if (opts.onClosePreview) opts.onClosePreview();
          });
        }

        const scrollArea = panel.querySelector('.diff-scroll-area');
        if (isEditing) {
          scrollArea.innerHTML = `<textarea class="inline-file-editor" spellcheck="false"></textarea>`;
          const editorEl = scrollArea.querySelector('.inline-file-editor');
          const dirtyBadgeEl = panel.querySelector('.viewer-dirty-badge');
          editorEl.value = draftContent;

          const syncDraftDirty = () => {
            draftContent = editorEl.value;
            const changed = draftContent !== fileRes.content;
            sendEditorEvent(changed ? 'DIRTY' : 'CLEAN');
            if (dirtyBadgeEl) dirtyBadgeEl.classList.toggle('hidden', !changed);
          };

          editorEl.addEventListener('input', syncDraftDirty);

          const doSave = async () => {
            if (getEditorState() === 'saving') return;
            const saveBtn = panel.querySelector('.act-save-file');
            if (saveBtn) saveBtn.disabled = true;
            sendEditorEvent('SAVE');
            try {
              await rpc('file:write', {
                repo: fileRes.repo || '',
                filePath: fileRes.repo ? fileRes.filePath : (fileRes.sourceUri || payload.filePath),
                content: editorEl.value
              });
              fileRes.content = editorEl.value;
              draftContent = fileRes.content;
              blameData = null;
              sendEditorEvent('SAVED');
              showToast(zh ? '文件已保存' : 'File saved', 'info');
              window.GitMapFeatures?.refreshAllStatusesAndContext();
              mountViewer();
            } catch (err) {
              sendEditorEvent('SAVE_FAILED');
              showToast(err.message, 'error');
              if (saveBtn) saveBtn.disabled = false;
            }
          };
          panel.querySelector('.act-save-file').addEventListener('click', doSave);
          panel.querySelector('.act-cancel-edit').addEventListener('click', async () => {
            if (!(await confirmDiscardIfDirty())) return;
            draftContent = fileRes.content;
            sendEditorEvent('CANCEL');
            mountViewer();
          });
          editorEl.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
              e.preventDefault();
              doSave();
            }
          });
          if (window.GitMapEditorPreview && window.GitMapEditorPreview.upgradeCodeEditor) {
            window.GitMapEditorPreview.upgradeCodeEditor(editorEl, fileRes.filePath, {
              initialLine: payload.initialLine || selStart || null
            });
          }
          setTimeout(() => editorEl.focus(), 20);
          return;
        }
        const editBtn = panel.querySelector('.act-edit-file');
        if (editBtn) {
          editBtn.addEventListener('click', () => {
            draftContent = fileRes.content;
            sendEditorEvent('EDIT');
            mountViewer();
          });
        }
        const richBtn = panel.querySelector('.act-rich-preview');
        if (richBtn) {
          richBtn.addEventListener('click', () => {
            richPreviewActive = !richPreviewActive;
            mountViewer();
          });
        }
        if (richPreviewActive && window.GitMapEditorPreview) {
          const rendered = window.GitMapEditorPreview.renderRichPreview(scrollArea, fileRes.filePath, fileRes.content, {
            repo: fileRes.repo || '',
            filePath: fileRes.filePath
          });
          if (rendered) return;
        }
        const normalizedContent = fileRes.content.replace(/\r\n/g, '\n');
        const lines = normalizedContent.split('\n');
        const isVirtual = lines.length > 1500;
        const ROW_H = 20;
        const fileSyntax = lines.length <= 20000 ? getSyntaxHighlighter(fileRes.filePath) : null;
        const syntaxLines = fileSyntax !== null ? fileSyntax.highlight(normalizedContent) : null;

        const buildRowHtml = (idx, prevBlameHash) => {
          const lineText = lines[idx];
          const lineNo = idx + 1;
          const isSelected = selStart !== null && selEnd !== null && lineNo >= selStart && lineNo <= selEnd;
          let blameHtml = '';
          let nextBlameHash = prevBlameHash;
          if (showBlame && blameData && blameData.lines && blameData.lines[idx]) {
            const bl = blameData.lines[idx];
            const bc = blameData.commits[bl.hash];
            if (bl.hash !== prevBlameHash && bc) {
              const shortHash = bc.committed ? bl.hash.slice(0, 7) : 'Uncomm.';
              const dateStr = bc.authorDate ? new Date(bc.authorDate * 1000).toISOString().slice(0, 10) : '';
              blameHtml = `<td class="blame-gutter" data-hash="${escapeHtml(bc.committed ? bl.hash : '')}" title="${escapeHtml(bc.summary)}">${escapeHtml(shortHash + ' · ' + bc.author + ' · ' + dateStr)}</td>`;
            } else {
              blameHtml = `<td class="blame-gutter" data-hash="${escapeHtml(bc && bc.committed ? bl.hash : '')}"></td>`;
            }
            nextBlameHash = bl.hash;
          } else if (showBlame) {
            blameHtml = `<td class="blame-gutter"></td>`;
          }
          const codeCell = syntaxLines && window.GitMapSyntax
            ? window.GitMapSyntax.renderLine(syntaxLines[idx] || null, lineText, null, '')
            : escapeHtml(lineText);
          return {
            html: `<tr class="file-line-row${isSelected ? ' selected-line' : ''}" data-line="${lineNo}">${blameHtml}<td class="file-line-num" data-line="${lineNo}">${lineNo}</td><td class="diff-code">${codeCell}</td></tr>`,
            nextBlameHash
          };
        };

        const table = document.createElement('table');
        const effectiveWrap = isVirtual ? false : wrapLines;
        table.className = 'diff-table' + (effectiveWrap ? '' : ' nowrap');
        const tbody = document.createElement('tbody');
        table.appendChild(tbody);
        scrollArea.appendChild(table);

        let lastStart = -1;
        let lastEnd = -1;
        const renderFileLines = (force) => {
          if (!isVirtual) {
            let prevHash = null;
            const chunks = [];
            for (let idx = 0; idx < lines.length; idx++) {
              const r = buildRowHtml(idx, prevHash);
              prevHash = r.nextBlameHash;
              chunks.push(r.html);
            }
            tbody.innerHTML = chunks.join('');
            return;
          }
          const viewTop = scrollArea.scrollTop;
          const viewH = scrollArea.clientHeight || 600;
          const start = Math.max(0, Math.floor(viewTop / ROW_H) - 60);
          const end = Math.min(lines.length, Math.ceil((viewTop + viewH) / ROW_H) + 60);
          if (!force && start === lastStart && end === lastEnd) return;
          lastStart = start;
          lastEnd = end;
          const colSpan = showBlame ? 3 : 2;
          const out = [];
          if (start > 0) {
            out.push(`<tr style="height:${start * ROW_H}px"><td colspan="${colSpan}"></td></tr>`);
          }
          let prevHash = start > 0 && showBlame && blameData && blameData.lines && blameData.lines[start - 1]
            ? blameData.lines[start - 1].hash
            : null;
          for (let idx = start; idx < end; idx++) {
            const r = buildRowHtml(idx, prevHash);
            prevHash = r.nextBlameHash;
            out.push(r.html);
          }
          if (end < lines.length) {
            out.push(`<tr style="height:${(lines.length - end) * ROW_H}px"><td colspan="${colSpan}"></td></tr>`);
          }
          tbody.innerHTML = out.join('');
        };

        if (isVirtual) {
          let raf = 0;
          scrollArea.addEventListener('scroll', () => {
            if (raf) return;
            raf = requestAnimationFrame(() => {
              raf = 0;
              renderFileLines(false);
            });
          });
        }

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
            tbody.querySelectorAll('tr.file-line-row').forEach((row) => {
              const ln = Number(row.getAttribute('data-line'));
              row.classList.toggle('selected-line', ln >= selStart && ln <= selEnd);
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

        panel.querySelector('.wrap-toggle').addEventListener('change', (e) => {
          wrapLines = e.target.checked;
          try {
            localStorage.setItem('gitmap.viewer.wrapLines', wrapLines ? '1' : '0');
          } catch (_) {}
          if (!isVirtual) table.classList.toggle('nowrap', !wrapLines);
        });

        if (hasRepo) {
          const blameBtn = panel.querySelector('.act-blame');
          blameBtn.addEventListener('click', async () => {
            if (blameBtn.disabled) return;
            const nextShow = !showBlame;
            if (nextShow && !blameData) {
              blameBtn.disabled = true;
              try {
                const res = await rpc('file:blame', { repo: fileRes.repo, filePath: fileRes.filePath, commit: fileRes.commit || undefined });
                blameData = res.blame;
              } catch (err) {
                showToast(err.message, 'error');
                blameBtn.disabled = false;
                return;
              }
              blameBtn.disabled = false;
            }
            showBlame = nextShow;
            blameBtn.classList.toggle('primary', showBlame);
            renderFileLines(true);
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
          panel.querySelector('.act-vfh')?.addEventListener('click', async () => {
            await rpc('file:visualHistory', {
              repo: fileRes.repo,
              filePath: fileRes.filePath,
              commitHash: fileRes.commit || undefined
            });
          });
          panel.querySelector('.act-ftm')?.addEventListener('click', async () => {
            await rpc('file:timeMachine', {
              repo: fileRes.repo,
              filePath: fileRes.filePath,
              commitHash: fileRes.commit || undefined
            });
          });
        }

        renderFileLines(true);
        if (selStart !== null && selStart > 1) {
          setTimeout(() => {
            if (isVirtual) {
              scrollArea.scrollTop = Math.max(0, (selStart - 5) * ROW_H);
              renderFileLines(true);
            } else {
              const targetRow = tbody.querySelector(`tr.file-line-row[data-line="${selStart}"]`);
              if (targetRow) targetRow.scrollIntoView({ block: 'center' });
            }
          }, 20);
        }
      };

      panel.__rerenderViewer = mountViewer;
      mountViewer();
    } catch (err) {
      if (loadSeq === panel.__fileLoadSeq) {
        renderPreviewBarOnly(`<div class="browser-empty-state error-text">${escapeHtml(err.message)}</div>`);
      }
    }
  }

  /* ==================== Visual File History / Time Machine Tab ==================== */
  function openVfhTab(payload) {
    const tabId = 'vfh-' + payload.panelId;
    const isTimeMachine = payload.viewType === 'git-map.fileTimeMachine';
    const panel = createOrReplacePanelTab(tabId, payload.title, isTimeMachine ? ICONS.clock : ICONS.chart);
    panel.innerHTML = `<iframe src="/webview/vfh/${encodeURIComponent(payload.panelId)}?t=${Date.now()}" title="${escapeHtml(payload.title)}"></iframe>`;
  }

  /* ==================== Integrated Terminal (xterm.js) ==================== */
  const TERMINAL_THEMES = {
    dark: {
      background: '#141414',
      foreground: '#d4d4d4',
      cursor: '#d4d4d4',
      cursorAccent: '#141414',
      selectionBackground: '#264f78',
      black: '#1e1e1e',
      red: '#f44747',
      green: '#6a9955',
      yellow: '#d7ba7d',
      blue: '#569cd6',
      magenta: '#c586c0',
      cyan: '#4ec9b0',
      white: '#d4d4d4',
      brightBlack: '#808080',
      brightRed: '#f48771',
      brightGreen: '#b5cea8',
      brightYellow: '#dcdcaa',
      brightBlue: '#9cdcfe',
      brightMagenta: '#d670d6',
      brightCyan: '#7be0c3',
      brightWhite: '#ffffff'
    },
    light: {
      background: '#ffffff',
      foreground: '#1f2328',
      cursor: '#1f2328',
      cursorAccent: '#ffffff',
      selectionBackground: '#add6ff',
      black: '#1f2328',
      red: '#cf222e',
      green: '#116329',
      yellow: '#7d4e00',
      blue: '#0969da',
      magenta: '#8250df',
      cyan: '#1b7c83',
      white: '#6e7781',
      brightBlack: '#57606a',
      brightRed: '#a40e26',
      brightGreen: '#1a7f37',
      brightYellow: '#9a6700',
      brightBlue: '#218bff',
      brightMagenta: '#a475f9',
      brightCyan: '#3192aa',
      brightWhite: '#8c959f'
    }
  };
  let terminalCreateInFlight = null;
  let fitRafId = 0;

  function setTerminalDrawerVisible(visible) {
    const drawer = document.getElementById('terminalDrawer');
    drawer.classList.toggle('hidden', !visible);
    document.getElementById('btnToggleTerminal').classList.toggle('active', visible);
    if (visible && state.activeTermId) scheduleFitActiveTerminal(true);
  }

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

      state.terminals.set(info.id, { info, term, fitAddon, containerEl, tabEl, exited: false, lastCols: 110, lastRows: 26 });
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
    scheduleFitActiveTerminal(true);
  }

  function scheduleFitActiveTerminal(focusAfter) {
    if (fitRafId) cancelAnimationFrame(fitRafId);
    fitRafId = requestAnimationFrame(() => {
      fitRafId = 0;
      fitActiveTerminal(focusAfter);
    });
  }

  function fitActiveTerminal(focusAfter) {
    if (!state.activeTermId) return;
    const t = state.terminals.get(state.activeTermId);
    if (!t) return;
    try {
      t.fitAddon.fit();
      if (t.term.cols !== t.lastCols || t.term.rows !== t.lastRows) {
        t.lastCols = t.term.cols;
        t.lastRows = t.term.rows;
        sendWs({ type: 'term:resize', id: t.info.id, cols: t.term.cols, rows: t.term.rows });
      }
      if (focusAfter) t.term.focus();
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
      scheduleFitActiveTerminal(false);
    }
  });

  /* Terminal Resizer Drag */
  (function setupTerminalResize() {
    const resizer = document.getElementById('terminalResizer');
    const drawer = document.getElementById('terminalDrawer');
    try {
      const savedH = Number(localStorage.getItem('gitmap.terminal.height'));
      if (savedH >= 130 && savedH <= window.innerHeight * 0.75) {
        drawer.style.height = savedH + 'px';
      }
    } catch (_) {}
    let dragging = false;
    pointerCleanups.add(() => {
      dragging = false;
    });
    resizer.addEventListener('mousedown', (e) => {
      dragging = true;
      pointerMachine?.send('START_TERMINAL_RESIZE');
      document.body.classList.add('resizing-y');
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const newHeight = Math.max(130, Math.min(window.innerHeight * 0.7, window.innerHeight - e.clientY));
      drawer.style.height = newHeight + 'px';
      scheduleFitActiveTerminal(false);
    });
    window.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      pointerMachine?.send('END');
      document.body.classList.remove('resizing-y');
      try {
        localStorage.setItem('gitmap.terminal.height', String(parseInt(drawer.style.height, 10)));
      } catch (_) {}
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
    // Git hosting services last: they're Git remotes, not servers to browse
    const shown = state.sshHosts.filter(matches).sort((a, b) => (isGitHostingHost(a) ? 1 : 0) - (isGitHostingHost(b) ? 1 : 0));
    if (shown.length === 0) {
      listEl.innerHTML = `<div class="sidebar-empty">${escapeHtml(zh ? '没有匹配的主机' : 'No matching hosts')}</div>`;
      return;
    }
    listEl.innerHTML = '';
    shown.forEach((h) => {
      const card = document.createElement('div');
      card.className = 'host-card' + (state.selectedSshHostId === h.id ? ' selected' : '') + (isGitHostingHost(h) ? ' git-hosting' : '');
      card.innerHTML = `
        <div class="host-card-top">
          <span class="host-card-title">
            <i class="status-dot ${h.connected ? 'connected' : ''}"></i>
            <span class="host-card-name">${escapeHtml(h.alias || h.name)}</span>
            ${h.alias ? `<span class="host-card-orig">${escapeHtml(h.name)}</span>` : ''}
          </span>
          <span class="host-card-actions">
            <span class="ssh-chip" title="${escapeHtml(isGitHostingHost(h) ? (zh ? 'Git 托管服务只能用于 Git 推送 / 拉取，无法登录浏览' : 'Git hosting: used for push / pull only, it can\'t be browsed') : '')}">${isGitHostingHost(h) ? (zh ? 'Git 托管' : 'Git hosting') : h.source === 'ssh-config' ? 'ssh-config' : (zh ? '已保存' : 'saved')}</span>
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
        if (isGitHostingHost(h)) {
          showToast(zh ? `${h.name} 是 Git 托管平台（仅支持 git push/pull/clone，不支持远程目录浏览）` : `${h.name} is a Git hosting service (for push/pull/clone only — shell browsing is not supported).`, 'info');
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
      // null = automatic (folders on top only when sorting by name); true / false = the user's choice
      foldersFirst: (() => {
        const v = localStorage.getItem('gitmap.fb.foldersFirst.' + opts.kind);
        return v === '1' ? true : v === '0' ? false : null;
      })(),
      filter: '',
      selected: new Set(),
      expandedDirs: new Set(),
      dirChildren: new Map(),
      loadingDirs: new Set(),
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
          ${opts.inlinePreviewToggle ? `<button type="button" class="mini-btn act-inline-preview${state.repoInlinePreview ? ' primary' : ''}" title="${escapeHtml(T('开启后单击文件直接在内联分栏预览/编辑，双击在独立标签页打开', 'Single-click files to preview inline; double-click to open in a tab'))}">${ICONS.splitHorizontal}<span>${escapeHtml(tr('inlinePreview'))}</span></button>` : ''}
          ${features.scan ? `<button type="button" class="mini-btn act-scan" title="${escapeHtml(T('扫描当前目录下（最多 3 层）的 Git 仓库', 'Find Git repositories up to 3 levels below this folder'))}">${ICONS.scan}<span>${escapeHtml(tr('scanSubfolders'))}</span></button>` : ''}
          ${features.launch ? `<button type="button" class="mini-btn act-here-term" title="${escapeHtml(T('在外部终端中打开当前目录', 'Open This Folder in External Terminal'))}">${ICONS.terminal}<span>${escapeHtml(T('终端', 'Terminal'))}</span></button>
          <button type="button" class="mini-btn act-here-editor" title="${escapeHtml(T('在编辑器中打开当前目录', 'Open This Folder in Editor'))}">${ICONS.editor}<span>${escapeHtml(T('编辑器', 'Editor'))}</span></button>` : ''}
          ${features.nativePicker ? `<button type="button" class="mini-btn act-native">${ICONS.folderOpen}<span>${escapeHtml(tr('osFolderPicker'))}</span></button>` : ''}
        </span>
      </div>
      <div class="fb-toolbar">
        <button type="button" class="icon-btn act-back" title="${escapeHtml(T('后退', 'Back'))} (Alt+←)">${ICONS.arrowLeft}</button>
        <button type="button" class="icon-btn act-forward" title="${escapeHtml(T('前进', 'Forward'))} (Alt+→)">${ICONS.arrowRight}</button>
        <button type="button" class="icon-btn act-up" title="${escapeHtml(T('上级目录', 'Parent Folder'))} (Alt+↑)">${ICONS.arrowUp}</button>
        <button type="button" class="icon-btn act-home" title="${escapeHtml(opts.homeTitle ? opts.homeTitle() : T('主目录 (~)', 'Home Folder (~)'))}">${ICONS.home}</button>
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
        <button type="button" class="mini-icon-btn act-folders-first" aria-pressed="false">${ICONS.folder}</button>
        <button type="button" class="mini-icon-btn act-expand-top" title="${escapeHtml(T('展开当前目录全部文件夹', 'Expand All Top-Level Folders'))}">${ICONS.expandAll}</button>
        <button type="button" class="mini-icon-btn act-collapse-all" title="${escapeHtml(T('收起全部已展开文件夹', 'Collapse All Folders'))}">${ICONS.collapseAll}</button>
        <span class="fb-actions-spacer"></span>
        ${features.createFile ? `<button type="button" class="mini-btn act-new-file">${ICONS.filePlus}<span>${escapeHtml(T('新建文件', 'New File'))}</span></button>` : ''}
        ${features.mkdir ? `<button type="button" class="mini-btn act-mkdir">${ICONS.folderPlus}<span>${escapeHtml(T('新建文件夹', 'New Folder'))}</span></button>` : ''}
        ${features.transfer ? `<button type="button" class="mini-btn act-upload">${ICONS.upload}<span>${escapeHtml(T('上传文件', 'Upload Files'))}</span></button>
        ${desktopApi && desktopApi.isElectron ? `<button type="button" class="mini-btn act-upload-dir">${ICONS.upload}<span>${escapeHtml(T('上传文件夹', 'Upload Folder'))}</span></button>` : ''}` : ''}
      </div>
      <div class="fb-repo-banner hidden">
        <span class="fb-repo-banner-icon">${ICONS.gitRepo}</span>
        <span class="fb-repo-banner-text"></span>
        <span class="branch-pill fb-repo-banner-branch"></span>
        ${opts.showOpenRepo === false ? '' : `<button type="button" class="mini-btn primary act-open-current">${escapeHtml(opts.openRepoLabel || tr('openRepoBtn'))}</button>`}
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
        <div class="fb-floating-bar hidden" role="toolbar"></div>
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

    /** Optional root (opts.rootPath): the repository explorer shows paths from the repository and never leaves it. */
    const normFsPath = (p) => String(p || '').replace(/\\/g, '/').replace(/\/+$/, '') || '/';
    function confinedRoot() {
      const r = opts.rootPath ? opts.rootPath() : null;
      return r ? normFsPath(r) : null;
    }
    function isWithinRoot(p, r) {
      const n = normFsPath(p);
      return n === r || n.startsWith(r === '/' ? '/' : r + '/');
    }

    function renderCrumbs(p) {
      crumbs.innerHTML = '';
      const rootDir = confinedRoot();
      if (rootDir && isWithinRoot(p, rootDir)) {
        const rel = normFsPath(p).slice(rootDir.length).split('/').filter(Boolean);
        const sepChar = !rootDir.startsWith('/') && String(p).includes('\\') ? '\\' : '/';
        const addRel = (label, target, last) => {
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
        const rootTarget = opts.rootPath();
        addRel(opts.rootLabel ? opts.rootLabel() : rootDir.split('/').pop() || '/', rootTarget, rel.length === 0);
        let acc = rootTarget.replace(/[\\/]+$/, '');
        rel.forEach((part, i) => {
          const sep = document.createElement('span');
          sep.className = 'crumb-sep';
          sep.textContent = '/';
          crumbs.appendChild(sep);
          acc += sepChar + part;
          addRel(part, acc, i === rel.length - 1);
        });
        crumbs.scrollLeft = crumbs.scrollWidth;
        return;
      }
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
        if (i >= 1) {
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

    /**
     * Folders on top: by default only when sorting by name (like Finder); sorting by modified time or size mixes
     * folders and files so the newest / largest entry is first whatever it is. The toolbar toggle overrides it (remembered).
     */
    function foldersOnTop() {
      return fb.foldersFirst === null ? fb.sort.key === 'name' : fb.foldersFirst;
    }

    function updateFoldersFirstButton() {
      const btn = $('.act-folders-first');
      if (!btn) return;
      const on = foldersOnTop();
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.title = on
        ? T('文件夹置顶：开（点一下和文件混排）', 'Folders on top: on (click to mix with files)')
        : T('文件夹置顶：关（和文件一起排序，点一下置顶）', 'Folders on top: off (sorted with files; click to keep on top)');
    }

    function sortEntryLevel(items) {
      const list = (items || []).slice();
      const { key, dir } = fb.sort;
      const dirsFirst = foldersOnTop();
      list.sort((a, b) => {
        if (dirsFirst && a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        let c = 0;
        if (key === 'size') c = (a.size || 0) - (b.size || 0);
        else if (key === 'mtime') c = (a.mtime || 0) - (b.mtime || 0);
        if (c === 0) c = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        return c * dir;
      });
      return list;
    }

    function sortedFiltered() {
      const f = fb.filter.trim().toLowerCase();
      const walk = (items, depth, parentPath, visited) => {
        const sorted = sortEntryLevel(items);
        const out = [];
        for (const e of sorted) {
          const hasExpanded = e.isDirectory && fb.expandedDirs.has(e.path) && !visited.has(e.path);
          const loading = e.isDirectory && fb.loadingDirs.has(e.path);
          let childRows = [];
          if (hasExpanded) {
            const subItems = fb.dirChildren.get(e.path);
            if (Array.isArray(subItems)) {
              const nextVisited = new Set(visited);
              nextVisited.add(e.path);
              childRows = walk(subItems, depth + 1, e.path, nextVisited);
            }
          }
          if (!f) {
            out.push({
              ...e,
              _depth: depth,
              _parentPath: parentPath,
              _expanded: hasExpanded,
              _loading: loading
            });
            if (childRows.length > 0) out.push(...childRows);
          } else {
            const selfMatches = e.name.toLowerCase().includes(f);
            if (selfMatches || childRows.length > 0) {
              out.push({
                ...e,
                _depth: depth,
                _parentPath: parentPath,
                _expanded: childRows.length > 0 || hasExpanded,
                _loading: loading
              });
              if (childRows.length > 0) out.push(...childRows);
            }
          }
        }
        return out;
      };
      return walk(fb.entries, 0, fb.currentPath, new Set());
    }

    function collectAllKnownEntries() {
      const map = new Map();
      fb.entries.forEach((e) => map.set(e.path, e));
      fb.dirChildren.forEach((list) => {
        (list || []).forEach((e) => map.set(e.path, e));
      });
      return Array.from(map.values());
    }

    async function toggleExpandDir(entry) {
      if (!entry || !entry.isDirectory) return;
      const dirPath = entry.path;
      if (fb.expandedDirs.has(dirPath)) {
        fb.expandedDirs.delete(dirPath);
        fb.loadingDirs.delete(dirPath);
        renderRows();
        return;
      }
      const expectedSeq = fb.loadSeq;
      fb.expandedDirs.add(dirPath);
      fb.loadingDirs.add(dirPath);
      renderRows();
      try {
        const subListing = await opts.list(dirPath, fb.showHidden, { subtree: true });
        if (expectedSeq !== fb.loadSeq || !fb.expandedDirs.has(dirPath)) {
          fb.loadingDirs.delete(dirPath);
          if (expectedSeq === fb.loadSeq) renderRows();
          return;
        }
        fb.dirChildren.set(dirPath, subListing.entries || []);
        fb.loadingDirs.delete(dirPath);
        renderRows();
      } catch (err) {
        if (expectedSeq !== fb.loadSeq) return;
        fb.expandedDirs.delete(dirPath);
        fb.loadingDirs.delete(dirPath);
        renderRows();
        showToast(err.message, 'error');
      }
    }

    async function refreshExpandedSubtrees(expectedSeq) {
      const dirs = Array.from(fb.expandedDirs);
      if (dirs.length === 0) return;
      const BATCH = 4;
      for (let i = 0; i < dirs.length; i += BATCH) {
        if (expectedSeq !== fb.loadSeq) return;
        const slice = dirs.slice(i, i + BATCH);
        await Promise.all(slice.map(async (dirPath) => {
          try {
            const subListing = await opts.list(dirPath, fb.showHidden, { subtree: true });
            if (expectedSeq === fb.loadSeq && fb.expandedDirs.has(dirPath)) {
              fb.dirChildren.set(dirPath, subListing.entries || []);
            }
          } catch (_) {
            fb.expandedDirs.delete(dirPath);
            fb.dirChildren.delete(dirPath);
          }
        }));
      }
    }

    async function expandTopLevelFolders() {
      const topDirs = fb.entries.filter((e) => e.isDirectory).slice(0, 30);
      if (topDirs.length === 0) return;
      const expectedSeq = fb.loadSeq;
      const toFetch = [];
      topDirs.forEach((d) => {
        fb.expandedDirs.add(d.path);
        if (!fb.dirChildren.has(d.path)) {
          fb.loadingDirs.add(d.path);
          toFetch.push(d.path);
        }
      });
      renderRows();
      const BATCH = 4;
      for (let i = 0; i < toFetch.length; i += BATCH) {
        if (expectedSeq !== fb.loadSeq) return;
        const slice = toFetch.slice(i, i + BATCH);
        await Promise.all(slice.map(async (dirPath) => {
          try {
            const subListing = await opts.list(dirPath, fb.showHidden, { subtree: true });
            if (expectedSeq === fb.loadSeq && fb.expandedDirs.has(dirPath)) {
              fb.dirChildren.set(dirPath, subListing.entries || []);
            }
          } catch (_) {
            if (expectedSeq === fb.loadSeq) fb.expandedDirs.delete(dirPath);
          } finally {
            if (expectedSeq === fb.loadSeq) fb.loadingDirs.delete(dirPath);
          }
        }));
        if (expectedSeq === fb.loadSeq) renderRows();
      }
    }

    function collapseAllFolders() {
      if (fb.expandedDirs.size === 0 && fb.loadingDirs.size === 0) return;
      fb.expandedDirs.clear();
      fb.loadingDirs.clear();
      renderRows();
    }

    const floatingBar = $('.fb-floating-bar');
    let floatRowEl = null;
    let floatIdx = -1;
    let floatLeftPx = 0;
    const FLOAT_POINTER_GAP = 22;
    const FLOAT_APPROACH_PAD = 22;
    const FLOAT_EDGE_MARGIN = 12;

    function hideFloatingBar() {
      if (floatRowEl) floatRowEl.classList.remove('float-target');
      floatRowEl = null;
      floatIdx = -1;
      floatingBar.classList.remove('gliding', 'tip-below');
      floatingBar.classList.add('hidden');
      floatingBar.innerHTML = '';
    }

    function buildEntryContextActions(entry) {
      const zh = state.lang === 'zh';
      const ctxActions = [];
      if (entry.isDirectory) {
        if (entry.isGitRepo && opts.showOpenRepo !== false && opts.onOpenRepo) {
          ctxActions.push({ icon: ICONS.gitRepo, label: tr('openRepoBtn'), run: () => opts.onOpenRepo(entry.path) });
        }
        ctxActions.push({
          icon: entry._expanded ? ICONS.chevronDown : ICONS.chevronRight,
          label: entry._expanded ? (zh ? '折叠子目录' : 'Collapse Subfolder') : (zh ? '展开子目录' : 'Expand Subfolder'),
          run: () => toggleExpandDir(entry)
        });
        ctxActions.push({
          icon: ICONS.folderOpen,
          label: zh ? '进入此文件夹' : 'Enter Folder',
          run: () => openEntry(entry)
        });
        if (features.createFile && opts.createFile) {
          ctxActions.push({ sep: true });
          ctxActions.push({ icon: ICONS.filePlus || ICONS.plus, label: zh ? '在此新建文件…' : 'New File Here…', run: () => { fb.expandedDirs.add(entry.path); opts.createFile(entry.path); } });
        }
        if (features.mkdir && opts.mkdir) {
          ctxActions.push({ icon: ICONS.folderPlus, label: zh ? '在此新建文件夹…' : 'New Folder Here…', run: () => { fb.expandedDirs.add(entry.path); opts.mkdir(entry.path); } });
        }
        if (features.transfer && opts.upload) {
          ctxActions.push({ icon: ICONS.upload, label: zh ? '上传文件到此目录…' : 'Upload Files Here…', run: () => { fb.expandedDirs.add(entry.path); opts.upload(entry.path, false); } });
        }
      } else {
        ctxActions.push({
          icon: ICONS.fileCode || ICONS.file,
          label: zh ? '预览 / 查看文件' : 'Preview / View File',
          run: () => openEntry(entry)
        });
        if (state.activeRepo) {
          ctxActions.push({
            icon: ICONS.history || ICONS.branch,
            label: zh ? '在 Git Map 中查看此文件历史' : 'Filter File History in Git Map',
            run: () => filterGitMapByRepoFile(entry.path)
          });
        }
        if (opts.onDoubleClickFile) {
          ctxActions.push({
            icon: ICONS.layoutTabs,
            label: zh ? '在独立标签页中打开' : 'Open in Full Tab',
            run: () => opts.onDoubleClickFile(entry)
          });
        }
      }
      ctxActions.push({ sep: true });
      if (features.transfer && opts.download) {
        ctxActions.push({ icon: ICONS.download, label: zh ? '下载 / 导出…' : 'Download / Export…', run: () => opts.download([entry.path]) });
      }
      if (features.launch && entry.isDirectory && opts.openTerminal) {
        ctxActions.push({ icon: ICONS.terminal, label: zh ? '在此打开终端' : 'Open Terminal Here', run: () => opts.openTerminal(entry.path) });
      }
      if (features.launch && opts.openEditor) {
        ctxActions.push({ icon: ICONS.editor, label: tr('openInEditor'), run: () => opts.openEditor(entry.path) });
      }
      ctxActions.push({
        icon: ICONS.copy,
        label: zh ? '复制完整路径' : 'Copy Path',
        run: () => {
          navigator.clipboard?.writeText(entry.path).catch(() => {});
          showToast(T('已复制：', 'Copied: ') + entry.path, 'status');
        }
      });
      if (features.rename && opts.rename) {
        ctxActions.push({ sep: true });
        ctxActions.push({ icon: ICONS.pencil, label: zh ? '重命名…' : 'Rename…', run: () => opts.rename(entry) });
      }
      if (features.delete && opts.remove) {
        ctxActions.push({ icon: ICONS.trash, label: zh ? '删除…' : 'Delete…', danger: true, run: () => opts.remove([entry]) });
      }
      return ctxActions;
    }

    function buildFloatingActionsHtml(e) {
      const btns = [];
      const tip = (zhText, enText) => {
        const s = escapeHtml(T(zhText, enText));
        return `data-tip="${s}" aria-label="${s}"`;
      };
      if (e.isGitRepo && opts.showOpenRepo !== false) {
        btns.push(`<button type="button" class="mini-btn primary act-row-open-repo">${escapeHtml(tr('openRepoBtn'))}</button>`);
      }
      if (e.isDirectory) {
        btns.push(`<button type="button" class="mini-btn act-row-toggle-expand" ${tip(e._expanded ? '收起此文件夹' : '展开此文件夹', e._expanded ? 'Collapse folder' : 'Expand folder')}>${e._expanded ? ICONS.chevronDown : ICONS.chevronRight}<span>${escapeHtml(e._expanded ? T('收起', 'Collapse') : T('展开', 'Expand'))}</span></button>`);
        btns.push(`<button type="button" class="mini-btn act-row-enter" ${tip('进入此目录', 'Enter folder')}>${ICONS.folderOpen}<span>${escapeHtml(T('进入', 'Enter'))}</span></button>`);
      } else {
        btns.push(`<button type="button" class="mini-btn primary act-row-open-file" ${tip('独立标签页打开 / 编辑', 'Open or edit in tab')}>${ICONS.fileCode}<span>${escapeHtml(T('打开', 'Open'))}</span></button>`);
      }
      btns.push('<span class="fb-float-sep"></span>');
      if (e.isDirectory) {
        if (features.createFile) {
          btns.push(`<button type="button" class="mini-icon-btn act-row-new-file" ${tip('在此新建文件', 'New File Here')}>${ICONS.filePlus}</button>`);
        }
        if (features.mkdir) {
          btns.push(`<button type="button" class="mini-icon-btn act-row-mkdir" ${tip('在此新建文件夹', 'New Folder Here')}>${ICONS.folderPlus}</button>`);
        }
        if (features.transfer) {
          btns.push(`<button type="button" class="mini-icon-btn act-row-upload" ${tip('上传文件到此目录', 'Upload Files Here')}>${ICONS.upload}</button>`);
        }
      }
      if (features.transfer) {
        btns.push(`<button type="button" class="mini-icon-btn act-row-download" ${tip('下载 / 导出', 'Download / Export')}>${ICONS.download}</button>`);
      }
      if (features.rename) {
        btns.push(`<button type="button" class="mini-icon-btn act-row-rename" ${tip('重命名', 'Rename')}>${ICONS.pencil}</button>`);
      }
      if (features.delete) {
        btns.push(`<button type="button" class="mini-icon-btn danger act-row-delete" ${tip('删除', 'Delete')}>${ICONS.trash}</button>`);
      }
      btns.push('<span class="fb-float-sep"></span>');
      btns.push(`<button type="button" class="mini-icon-btn act-row-more" ${tip('更多操作…', 'More Actions…')}>${ICONS.more}</button>`);
      return btns.join('');
    }

    function placeFloatingBar(clientX, updateVertical) {
      if (!floatRowEl || floatingBar.classList.contains('hidden')) return;
      const tableEl = $('.fb-table');
      const tableRect = tableEl.getBoundingClientRect();
      const rowRect = floatRowEl.getBoundingClientRect();
      if (rowRect.bottom < tableRect.top + 28 || rowRect.top > tableRect.bottom) {
        hideFloatingBar();
        return;
      }
      const barWidth = floatingBar.offsetWidth;
      const barHeight = floatingBar.offsetHeight || 26;
      const minLeft = FLOAT_EDGE_MARGIN;
      const maxLeft = Math.max(minLeft, tableRect.width - barWidth - FLOAT_EDGE_MARGIN);
      const relMouseX = clientX - tableRect.left;
      let left = relMouseX + FLOAT_POINTER_GAP;
      if (left > maxLeft) left = relMouseX - FLOAT_POINTER_GAP - barWidth;
      left = Math.max(minLeft, Math.min(left, maxLeft));
      floatLeftPx = Math.round(left);
      if (updateVertical) {
        floatingBar.classList.remove('gliding');
        const top = rowRect.top - tableRect.top + (rowRect.height - barHeight) / 2;
        floatingBar.classList.toggle('tip-below', top < 58);
        floatingBar.style.top = Math.round(top) + 'px';
      } else {
        floatingBar.classList.add('gliding');
      }
      floatingBar.style.left = floatLeftPx + 'px';
    }

    function showOrFollowFloatingBar(rowEl, clientX) {
      const idx = Number(rowEl.getAttribute('data-idx'));
      const entry = fb.visible[idx];
      if (!entry) {
        hideFloatingBar();
        return;
      }
      if (rowEl === floatRowEl && idx === floatIdx && !floatingBar.classList.contains('hidden')) {
        const tableRect = $('.fb-table').getBoundingClientRect();
        const barLeft = tableRect.left + floatLeftPx;
        const barRight = barLeft + floatingBar.offsetWidth;
        if (clientX < barLeft - FLOAT_APPROACH_PAD || clientX > barRight + FLOAT_APPROACH_PAD) {
          placeFloatingBar(clientX, false);
        }
        return;
      }
      if (floatRowEl) floatRowEl.classList.remove('float-target');
      floatRowEl = rowEl;
      floatIdx = idx;
      floatRowEl.classList.add('float-target');
      floatingBar.innerHTML = buildFloatingActionsHtml(entry);
      floatingBar.classList.remove('hidden');
      placeFloatingBar(clientX, true);
    }

    function renderRows() {
      hideFloatingBar();
      fb.visible = sortedFiltered();
      if (fb.entries.length === 0) {
        body.innerHTML = `<div class="browser-empty-state">${escapeHtml(T('空目录', 'Empty folder'))}</div>`;
      } else if (fb.visible.length === 0) {
        body.innerHTML = `<div class="browser-empty-state">${escapeHtml(T('没有匹配“' + fb.filter + '”的项目', 'Nothing matches "' + fb.filter + '"'))}</div>`;
      } else {
        const renderRowHtml = (e, idx) => {
          const depth = e._depth || 0;
          const guidesHtml = depth > 0
            ? `<span class="fb-tree-guides">${'<span class="fb-tree-guide"></span>'.repeat(depth)}</span>`
            : '';
          const twistyHtml = e.isDirectory
            ? `<button type="button" class="fb-tree-twisty${e._expanded ? ' expanded' : ''}" title="${escapeHtml(e._expanded ? T('收起文件夹', 'Collapse folder') : T('展开文件夹', 'Expand folder'))}" aria-expanded="${e._expanded ? 'true' : 'false'}">${e._loading ? '<span class="fb-mini-spinner"></span>' : (e._expanded ? ICONS.chevronDown : ICONS.chevronRight)}</button>`
            : `<span class="fb-tree-spacer"></span>`;
          const icon = e.isDirectory && e._expanded && !e.isGitRepo
            ? { svg: ICONS.folderOpen, cls: 'is-dir' }
            : fileIconFor(e);
          const m = formatMtime(e.mtime);
          const sel = fb.selected.has(e.path);
          const deco = opts.decorate ? opts.decorate(e) : null;
          const idleAction = e.isGitRepo && opts.showOpenRepo !== false
            ? `<button type="button" class="mini-btn act-row-open-repo">${escapeHtml(tr('openRepoBtn'))}</button>`
            : '';
          return `<div class="fb-row${e.isDirectory ? ' is-dir' : ''}${e.isGitRepo ? ' is-git' : ''}${sel ? ' selected' : ''}${idx === fb.focusIdx ? ' focused' : ''}${deco ? ' gs-' + deco.code : ''}" data-idx="${idx}" role="row" title="${escapeHtml(e.path)}">
            <span class="fb-col-chk"><input type="checkbox" class="fb-check" ${sel ? 'checked' : ''} tabindex="-1" /></span>
            <span class="fb-col-name">${guidesHtml}${twistyHtml}<span class="fb-icon ${icon.cls}">${icon.svg}</span><span class="fb-name">${escapeHtml(e.name)}</span>${deco ? `<span class="fb-git-badge" title="${escapeHtml(deco.title)}">${escapeHtml(deco.badge)}</span>` : ''}${e.isSymlink ? `<span class="fb-link" title="${escapeHtml(T('符号链接', 'Symbolic link'))}">${ICONS.link}</span>` : ''}${e.isGitRepo ? `<span class="branch-pill">${ICONS.branch}${escapeHtml(e.gitBranch || 'HEAD')}</span>` : ''}</span>
            <span class="fb-col-size">${e.isDirectory ? '—' : escapeHtml(formatBytes(e.size))}</span>
            <span class="fb-col-mtime" title="${escapeHtml(m.full)}">${escapeHtml(m.short)}</span>
            <span class="fb-col-actions">${idleAction}</span>
          </div>`;
        };

        // Virtual scrolling for large directories (> 140 rows) to keep 60fps
        if (fb.visible.length > 140) {
          const VROW_H = 34;
          const OVERSCAN = 14;
          const totalH = fb.visible.length * VROW_H;
          body.innerHTML = `<div class="fb-vscroll-spacer" style="height:${totalH}px"><div class="fb-vscroll-viewport"></div></div>`;
          const viewport = body.querySelector('.fb-vscroll-viewport');
          let vRaf = 0;
          const drawSlice = () => {
            vRaf = 0;
            if (!viewport || !viewport.isConnected) return;
            const st = body.scrollTop || 0;
            const vh = body.clientHeight || 560;
            const start = Math.max(0, Math.floor(st / VROW_H) - OVERSCAN);
            const end = Math.min(fb.visible.length, Math.ceil((st + vh) / VROW_H) + OVERSCAN);
            viewport.style.transform = `translateY(${start * VROW_H}px)`;
            const slice = [];
            for (let i = start; i < end; i++) slice.push(renderRowHtml(fb.visible[i], i));
            viewport.innerHTML = slice.join('');
          };
          body.__gmVScrollHandler && body.removeEventListener('scroll', body.__gmVScrollHandler);
          body.__gmVScrollHandler = () => {
            if (!vRaf) vRaf = requestAnimationFrame(drawSlice);
          };
          body.addEventListener('scroll', body.__gmVScrollHandler, { passive: true });
          drawSlice();
        } else {
          if (body.__gmVScrollHandler) {
            body.removeEventListener('scroll', body.__gmVScrollHandler);
            body.__gmVScrollHandler = null;
          }
          body.innerHTML = fb.visible.map(renderRowHtml).join('');
        }
      }
      updateStatus();
    }

    function updateStatus() {
      const dirs = fb.entries.filter((e) => e.isDirectory).length;
      const files = fb.entries.length - dirs;
      const repos = fb.entries.filter((e) => e.isGitRepo).length;
      const parts = [T(`${dirs} 个文件夹`, `${dirs} folder${dirs === 1 ? '' : 's'}`), T(`${files} 个文件`, `${files} file${files === 1 ? '' : 's'}`)];
      if (fb.expandedDirs.size > 0) {
        parts.push(T(`已展开 ${fb.expandedDirs.size} 个子目录`, `${fb.expandedDirs.size} expanded`));
      }
      if (repos > 0 && opts.showOpenRepo !== false) {
        parts.push(T(`${repos} 个 Git 仓库`, `${repos} Git repo${repos === 1 ? '' : 's'}`));
      }
      if (fb.filter) parts.push(T(`显示 ${fb.visible.length} 项`, `showing ${fb.visible.length}`));
      if (fb.selected.size > 0) {
        let bytes = 0;
        collectAllKnownEntries().forEach((e) => {
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
      fb.expandedDirs.clear();
      fb.dirChildren.clear();
      fb.loadingDirs.clear();
      fb.filter = '';
      filterInput.value = '';
      crumbs.innerHTML = '';
      body.innerHTML = '';
    };

    fb.navigate = async function (target, navOpts) {
      const rootDir = confinedRoot();
      if (rootDir && (!target || !isWithinRoot(target, rootDir))) target = opts.rootPath(); // never leave the root
      const seq = ++fb.loadSeq;
      const isRefreshSame = target === fb.currentPath && fb.entries.length > 0;
      if (!isRefreshSame) setLoading(opts.loadingText());
      hideSuggestions();
      try {
        const listing = await opts.list(target, fb.showHidden, { subtree: false });
        if (seq !== fb.loadSeq) return;
        root.classList.remove('fb-failed');
        const changedDir = listing.currentPath !== fb.currentPath;
        fb.currentPath = listing.currentPath;
        // At the root there is no "up" (the remote listing may report the canonical path, so compare the target too)
        const atRoot = !!rootDir && (normFsPath(listing.currentPath) === rootDir || normFsPath(target) === rootDir);
        fb.parentPath = atRoot ? null : listing.parentPath;
        fb.entries = listing.entries || [];
        if (changedDir) {
          fb.selected.clear();
          fb.expandedDirs.clear();
          fb.dirChildren.clear();
          fb.loadingDirs.clear();
          fb.focusIdx = -1;
          fb.filter = '';
          filterInput.value = '';
        } else if (fb.expandedDirs.size > 0) {
          await refreshExpandedSubtrees(seq);
          if (seq !== fb.loadSeq) return;
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
        if (listing.currentRepoRoot && opts.showOpenRepo !== false) {
          banner.classList.remove('hidden');
          $('.fb-repo-banner-text').textContent = opts.displayRepo ? opts.displayRepo(listing.currentRepoRoot) : listing.currentRepoRoot;
          $('.fb-repo-banner-branch').innerHTML = ICONS.branch + escapeHtml(listing.currentRepoBranch || 'HEAD');
          fb.currentRepoRoot = listing.currentRepoRoot;
        } else {
          banner.classList.add('hidden');
          fb.currentRepoRoot = listing.currentRepoRoot || null;
        }
        updateNavButtons();
        renderRows();
        if (opts.onNavigated) opts.onNavigated(listing);
      } catch (err) {
        if (seq !== fb.loadSeq) return;
        root.classList.add('fb-failed');
        if (opts.renderError) {
          body.innerHTML = '';
          body.appendChild(opts.renderError(err, () => fb.navigate(target, navOpts)));
          if (opts.summaryError) $('.fb-conn-summary').innerHTML = opts.summaryError(err);
        } else {
          body.innerHTML = `<div class="browser-empty-state error-text">${escapeHtml(err.message)}</div>`;
        }
        updateNavButtons();
      }
    };

    fb.refresh = function () {
      return fb.navigate(fb.currentPath, { push: false });
    };

    /** Re-draw the rows without listing again (e.g. decorations changed). */
    fb.rerender = function () {
      if (fb.currentPath !== null && fb.entries.length > 0) renderRows();
    };

    fb.ensureExpanded = async function (dirPath) {
      if (dirPath && dirPath !== fb.currentPath) {
        fb.expandedDirs.add(dirPath);
      }
      await fb.refresh();
    };

    fb.entryAt = function (idx) {
      return fb.visible[idx] || null;
    };

    function selectedEntries() {
      return collectAllKnownEntries().filter((e) => fb.selected.has(e.path));
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
      const items = (res.entries || []).slice(0, 80);
      if (items.length === 0) {
        pathInput.classList.add('shake');
        setTimeout(() => pathInput.classList.remove('shake'), 300);
        hideSuggestions();
        return;
      }
      if (items.length === 1 && (res.entries || []).length === 1) {
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
          fb.suggest = { items: (res.entries || []).slice(0, 80), idx: -1, base: '' };
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
    $('.act-home').addEventListener('click', () => fb.navigate(opts.getHomePath ? opts.getHomePath() : '~', { push: true }));
    $('.act-refresh').addEventListener('click', () => fb.refresh());
    $('.act-hidden').addEventListener('click', () => {
      fb.showHidden = !fb.showHidden;
      localStorage.setItem('gitmap.fb.hidden.' + opts.kind, fb.showHidden ? '1' : '0');
      updateHiddenButton();
      fb.refresh();
    });
    $('.act-expand-top').addEventListener('click', () => expandTopLevelFolders());
    $('.act-collapse-all').addEventListener('click', () => collapseAllFolders());
    const inlinePrevBtn = $('.act-inline-preview');
    if (inlinePrevBtn) {
      inlinePrevBtn.addEventListener('click', () => {
        state.repoInlinePreview = !state.repoInlinePreview;
        try {
          localStorage.setItem('gitmap.repo.inlinePreview', state.repoInlinePreview ? '1' : '0');
        } catch (_) {}
        inlinePrevBtn.classList.toggle('primary', state.repoInlinePreview);
        if (!state.repoInlinePreview) {
          document.getElementById('repoFilesPreviewPane')?.classList.add('hidden');
        }
      });
    }
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
        updateFoldersFirstButton();
        renderRows();
      });
    });
    $('.act-folders-first').addEventListener('click', () => {
      fb.foldersFirst = !foldersOnTop();
      try {
        localStorage.setItem('gitmap.fb.foldersFirst.' + opts.kind, fb.foldersFirst ? '1' : '0');
      } catch (_) {}
      updateFoldersFirstButton();
      renderRows();
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
    const openCurBtn = $('.act-open-current');
    if (openCurBtn) {
      openCurBtn.addEventListener('click', () => {
        if (fb.currentRepoRoot) opts.onOpenRepo(fb.currentRepoRoot);
      });
    }

    function dispatchRowButtonAction(btn, entry) {
      if (!entry || !btn) return;
      if (btn.classList.contains('fb-tree-twisty') || btn.classList.contains('act-row-toggle-expand')) {
        toggleExpandDir(entry);
      } else if (btn.classList.contains('act-row-open-repo') && opts.onOpenRepo) {
        opts.onOpenRepo(entry.path);
      } else if (btn.classList.contains('act-row-enter')) {
        openEntry(entry);
      } else if (btn.classList.contains('act-row-open-file')) {
        if (opts.onDoubleClickFile) opts.onDoubleClickFile(entry);
        else openEntry(entry);
      } else if (btn.classList.contains('act-row-new-file') && opts.createFile) {
        fb.expandedDirs.add(entry.path);
        opts.createFile(entry.path);
      } else if (btn.classList.contains('act-row-mkdir') && opts.mkdir) {
        fb.expandedDirs.add(entry.path);
        opts.mkdir(entry.path);
      } else if (btn.classList.contains('act-row-upload') && opts.upload) {
        fb.expandedDirs.add(entry.path);
        opts.upload(entry.path, false);
      } else if (btn.classList.contains('act-row-download') && opts.download) {
        opts.download([entry.path]);
      } else if (btn.classList.contains('act-row-term') && opts.openTerminal) {
        opts.openTerminal(entry.path);
      } else if (btn.classList.contains('act-row-editor') && opts.openEditor) {
        opts.openEditor(entry.path);
      } else if (btn.classList.contains('act-row-copy')) {
        navigator.clipboard?.writeText(entry.path).catch(() => {});
        showToast(T('已复制：', 'Copied: ') + entry.path, 'status');
      } else if (btn.classList.contains('act-row-rename') && opts.rename) {
        opts.rename(entry);
      } else if (btn.classList.contains('act-row-delete') && opts.remove) {
        opts.remove([entry]);
      } else if (btn.classList.contains('act-row-more')) {
        const bRect = btn.getBoundingClientRect();
        hideFloatingBar();
        openGenericContextMenu(buildEntryContextActions(entry), bRect.left, bRect.bottom + 3);
      }
    }

    /* ---- Mouse-following Floating Action Bar & Row Delegation ---- */
    body.addEventListener('mousemove', (e) => {
      const ctxMenu = document.getElementById('tabContextMenu');
      if (e.altKey || (ctxMenu && !ctxMenu.classList.contains('hidden'))) {
        hideFloatingBar();
        return;
      }
      const row = e.target.closest('.fb-row');
      if (!row) {
        hideFloatingBar();
        return;
      }
      showOrFollowFloatingBar(row, e.clientX);
    });
    body.addEventListener('scroll', hideFloatingBar);
    $('.fb-table').addEventListener('mouseleave', (e) => {
      if (e.relatedTarget && $('.fb-table').contains(e.relatedTarget)) return;
      hideFloatingBar();
    });
    floatingBar.addEventListener('mouseleave', (e) => {
      if (e.relatedTarget && body.contains(e.relatedTarget)) return;
      hideFloatingBar();
    });
    floatingBar.addEventListener('click', (e) => {
      e.stopPropagation();
      const btn = e.target.closest('button');
      if (!btn || floatIdx < 0) return;
      const entry = fb.visible[floatIdx];
      dispatchRowButtonAction(btn, entry);
    });

    body.addEventListener('click', (e) => {
      const row = e.target.closest('.fb-row');
      if (!row) return;
      const idx = Number(row.getAttribute('data-idx'));
      const entry = fb.visible[idx];
      if (!entry) return;
      const btn = e.target.closest('button');
      if (btn) {
        e.stopPropagation();
        dispatchRowButtonAction(btn, entry);
        return;
      }
      if (e.target.closest('.fb-col-chk') || e.metaKey || e.ctrlKey || e.shiftKey) {
        toggleSelect(idx, e.shiftKey);
        return;
      }
      setFocus(idx);
      if (e.detail > 1) return;
      if (entry.isDirectory) {
        if (opts.folderClickExpands) toggleExpandDir(entry);
        else openEntry(entry);
      } else if (opts.singleClickOpenFile) {
        openEntry(entry);
      }
    });
    body.addEventListener('contextmenu', (e) => {
      const row = e.target.closest('.fb-row');
      if (!row) return;
      const idx = Number(row.getAttribute('data-idx'));
      const entry = fb.visible[idx];
      if (!entry) return;
      e.preventDefault();
      e.stopPropagation();
      hideFloatingBar();
      setFocus(idx);
      openGenericContextMenu(buildEntryContextActions(entry), e.clientX, e.clientY);
    });
    body.addEventListener('dblclick', (e) => {
      if (e.target.closest('button') || e.target.closest('.fb-col-chk')) return;
      const row = e.target.closest('.fb-row');
      if (!row) return;
      const entry = fb.visible[Number(row.getAttribute('data-idx'))];
      if (!entry) return;
      if (entry.isDirectory) {
        fb.navigate(entry.path, { push: true });
      } else if (opts.onDoubleClickFile) {
        opts.onDoubleClickFile(entry);
      } else {
        openEntry(entry);
      }
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
      } else if (e.key === 'ArrowRight') {
        const cur = fb.visible[fb.focusIdx];
        if (cur && cur.isDirectory) {
          e.preventDefault();
          if (!cur._expanded) {
            toggleExpandDir(cur);
          } else if (fb.visible[fb.focusIdx + 1] && fb.visible[fb.focusIdx + 1]._parentPath === cur.path) {
            setFocus(fb.focusIdx + 1);
          }
        }
      } else if (e.key === 'ArrowLeft') {
        const cur = fb.visible[fb.focusIdx];
        if (cur) {
          e.preventDefault();
          if (cur.isDirectory && cur._expanded) {
            toggleExpandDir(cur);
          } else if (cur._parentPath && cur._parentPath !== fb.currentPath) {
            const pIdx = fb.visible.findIndex((it) => it.path === cur._parentPath);
            if (pIdx >= 0) setFocus(pIdx);
          }
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cur = fb.visible[fb.focusIdx];
        if (!cur) return;
        if (cur.isDirectory && opts.folderClickExpands && !e.metaKey && !e.ctrlKey) {
          toggleExpandDir(cur);
        } else {
          openEntry(cur);
        }
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
    if (features.createFile) $('.act-new-file').addEventListener('click', () => opts.createFile(fb.currentPath));
    if (features.mkdir) $('.act-mkdir').addEventListener('click', () => opts.mkdir(fb.currentPath));
    if (features.transfer) {
      $('.act-upload').addEventListener('click', () => opts.upload(fb.currentPath, false));
      const uploadDirBtn = $('.act-upload-dir');
      if (uploadDirBtn) uploadDirBtn.addEventListener('click', () => opts.upload(fb.currentPath, true));
      $('.act-sel-download').addEventListener('click', () => opts.download(selectedEntries().map((e) => e.path)));

      // Drag & drop local files / folders onto the table to upload them (desktop app or browser FileList)
      const table = $('.fb-table');
      const dropHint = $('.fb-drop-hint');
      let dragDepth = 0;
      const resetDropHint = () => {
        if (dragDepth > 0) {
          dragDepth = 0;
          dropHint.classList.add('hidden');
        }
      };
      window.addEventListener('blur', resetDropHint);
      document.addEventListener('dragend', resetDropHint);
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
        if (paths.length > 0) {
          opts.uploadPaths(fb.currentPath, paths);
        } else if (files.length > 0 && opts.uploadBrowserFiles) {
          opts.uploadBrowserFiles(fb.currentPath, files);
        }
      });
    }
    if (features.delete) {
      $('.act-sel-delete').addEventListener('click', () => opts.remove(selectedEntries()));
    }

    updateHiddenButton();
    updateSortHeader();
    updateFoldersFirstButton();
    return fb;
  }

  /** Ask for confirmation in the dedicated client dialog (#clientDialogModal, isolated from server #promptModal). */
  function confirmDialog(title, message, confirmLabel, danger) {
    return new Promise((resolve) => {
      const modal = document.getElementById('clientDialogModal');
      let settled = false;
      const done = (v) => {
        if (settled) return;
        settled = true;
        activeClientDialogDismiss = null;
        modal.classList.add('hidden');
        resolve(v);
      };
      beginClientDialogSession(() => done(false));
      document.getElementById('clientDialogTitle').textContent = title;
      const bodyEl = document.getElementById('clientDialogBody');
      const footerEl = document.getElementById('clientDialogFooter');
      bodyEl.innerHTML = `<p style="margin:0;white-space:pre-wrap;">${escapeHtml(message)}</p>`;
      footerEl.innerHTML = `<button type="button" class="mini-btn act-cancel">${escapeHtml(tr('cancel'))}</button><button type="button" class="mini-btn ${danger ? 'danger-solid' : 'primary'} act-ok">${escapeHtml(confirmLabel)}</button>`;
      modal.classList.remove('hidden');
      footerEl.querySelector('.act-cancel').onclick = () => done(false);
      footerEl.querySelector('.act-ok').onclick = () => done(true);
      document.getElementById('clientDialogCloseBtn').onclick = () => done(false);
      setTimeout(() => footerEl.querySelector('.act-cancel').focus(), 30);
    });
  }

  /** Ask for a single line of text in the dedicated client dialog (#clientDialogModal). */
  function inputDialog(title, label, value) {
    return new Promise((resolve) => {
      const modal = document.getElementById('clientDialogModal');
      let settled = false;
      const done = (v) => {
        if (settled) return;
        settled = true;
        activeClientDialogDismiss = null;
        modal.classList.add('hidden');
        resolve(v);
      };
      beginClientDialogSession(() => done(null));
      document.getElementById('clientDialogTitle').textContent = title;
      const bodyEl = document.getElementById('clientDialogBody');
      const footerEl = document.getElementById('clientDialogFooter');
      bodyEl.innerHTML = `<label><span>${escapeHtml(label)}</span><input type="text" id="gmInputDialogField" spellcheck="false" value="${escapeHtml(value || '')}" /></label>`;
      footerEl.innerHTML = `<button type="button" class="mini-btn act-cancel">${escapeHtml(tr('cancel'))}</button><button type="button" class="mini-btn primary act-ok">OK</button>`;
      modal.classList.remove('hidden');
      const input = document.getElementById('gmInputDialogField');
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') done(input.value.trim() || null);
        if (e.key === 'Escape') {
          e.stopPropagation();
          e.preventDefault();
          done(null);
        }
      });
      footerEl.querySelector('.act-cancel').onclick = () => done(null);
      footerEl.querySelector('.act-ok').onclick = () => done(input.value.trim() || null);
      document.getElementById('clientDialogCloseBtn').onclick = () => done(null);
      setTimeout(() => {
        input.focus();
        const dot = input.value.lastIndexOf('.');
        input.setSelectionRange(0, dot > 0 ? dot : input.value.length);
      }, 30);
    });
  }

  /* ==================== SSH Connection Diagnosis ==================== */
  function isPrivateNetworkHost(host) {
    const h = String(host || '').toLowerCase();
    return /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || /^169\.254\./.test(h) ||
      /^f[cd][0-9a-f]{2}:/.test(h) || /^fe80:/.test(h) || h.endsWith('.local') || h.endsWith('.lan') || h.endsWith('.home') || h.endsWith('.internal');
  }

  /**
   * Turn a raw SSH / socket error into a title, an explanation, and what can be done about it.
   */
  function diagnoseSshError(err, host) {
    const zh = state.lang === 'zh';
    const msg = String((err && err.message) || err || '');
    const code = (msg.match(/\b(E[A-Z]{3,}[A-Z_]*)\b/) || [])[1] || '';
    const addr = host ? `${host.user}@${host.host}:${host.port || 22}` : '';
    const isMac = (state.platform || (desktopApi && desktopApi.platform)) === 'darwin';
    const lan = host && isPrivateNetworkHost(host.host);
    const d = { title: '', detail: '', tips: [], localNetwork: false, code };
    if (code === 'EHOSTUNREACH' || code === 'ENETUNREACH' || code === 'EHOSTDOWN' || code === 'EADDRNOTAVAIL') {
      d.title = zh ? '无法到达主机' : 'The host can\'t be reached';
      if (isMac && lan && desktopApi && desktopApi.isElectron) {
        d.localNetwork = true;
        d.detail = zh
          ? `${addr} 位于局域网。macOS 需要授予 GitMap “本地网络”权限才能连接局域网地址；未授权时系统会直接返回“主机不可达”，即使在终端里 ssh 能连通。`
          : `${addr} is on your local network. macOS only lets GitMap reach local-network addresses after you allow it under Local Network; until then it reports "host unreachable", even if ssh works in Terminal.`;
        d.tips.push(zh ? '打开 系统设置 → 隐私与安全性 → 本地网络，打开 GitMap 的开关，然后重试。' : 'Open System Settings → Privacy & Security → Local Network, turn GitMap on, then retry.');
        d.tips.push(zh ? '如果列表里没有 GitMap：重新安装最新构建的 GitMap 后再连接一次，系统会弹出授权提示。' : 'If GitMap isn\'t listed: install the latest GitMap build and connect again; macOS then asks for permission.');
      } else {
        d.detail = zh ? `网络无法路由到 ${addr}。` : `The network has no route to ${addr}.`;
        d.tips.push(zh ? '确认主机已开机、与本机在同一网络或已连接 VPN。' : 'Check the host is on, and on the same network or VPN as this computer.');
      }
    } else if (code === 'ECONNREFUSED') {
      d.title = zh ? '连接被拒绝' : 'Connection refused';
      d.detail = zh ? `${addr} 拒绝了连接：该端口上没有运行 SSH 服务。` : `${addr} refused the connection: no SSH server is listening on that port.`;
      d.tips.push(zh ? '检查端口号，以及远程主机上的 sshd 是否已启动。' : 'Check the port, and that sshd is running on the host.');
    } else if (code === 'ETIMEDOUT' || /timed out/i.test(msg)) {
      d.title = zh ? '连接超时' : 'Connection timed out';
      d.detail = zh ? `${addr} 在规定时间内没有响应。` : `${addr} didn\'t answer in time.`;
      d.tips.push(zh ? '检查防火墙 / 安全组是否放行 SSH 端口，或是否需要 VPN / 跳板机 (ProxyJump)。' : 'Check firewalls / security groups allow the SSH port, or whether a VPN or ProxyJump is needed.');
    } else if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
      d.title = zh ? '无法解析主机名' : 'Unknown host name';
      d.detail = zh ? `找不到主机 “${host ? host.host : ''}”。` : `The host name "${host ? host.host : ''}" couldn\'t be resolved.`;
      d.tips.push(zh ? '检查主机名拼写和 DNS / VPN。' : 'Check the spelling, and your DNS or VPN.');
    } else if (/authentication methods failed|auth/i.test(msg)) {
      d.title = zh ? '认证失败' : 'Authentication failed';
      d.detail = zh ? `${addr} 拒绝了所有认证方式（SSH Agent、私钥、密码）。` : `${addr} rejected every authentication method (SSH agent, keys, password).`;
      d.tips.push(zh ? '检查用户名、私钥路径，或在“编辑连接”中填写密码。' : 'Check the user name and key path, or set a password in Edit Connection.');
    } else {
      d.title = zh ? '无法连接' : 'Unable to connect';
      d.detail = msg;
    }
    d.raw = msg;
    return d;
  }

  function renderSshErrorCard(err, retry) {
    const zh = state.lang === 'zh';
    const host = findHost(state.selectedSshHostId);
    const d = diagnoseSshError(err, host);
    const card = document.createElement('div');
    card.className = 'conn-error';
    card.innerHTML = `
      <div class="conn-error-icon">${ICONS.alert}</div>
      <h4>${escapeHtml(d.title)}</h4>
      <p>${escapeHtml(d.detail)}</p>
      ${d.tips.length ? `<ul>${d.tips.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : ''}
      <div class="conn-error-actions">
        <button type="button" class="mini-btn primary act-retry">${ICONS.refresh}<span>${escapeHtml(zh ? '重试' : 'Retry')}</span></button>
        ${d.localNetwork ? `<button type="button" class="mini-btn act-open-lan">${ICONS.settings}<span>${escapeHtml(zh ? '打开“本地网络”设置' : 'Open Local Network Settings')}</span></button>` : ''}
        ${host && host.source === 'saved' ? `<button type="button" class="mini-btn act-edit-conn">${ICONS.pencil}<span>${escapeHtml(zh ? '编辑连接' : 'Edit Connection')}</span></button>` : ''}
        ${host ? `<button type="button" class="mini-btn act-test-term">${ICONS.externalTerminal}<span>${escapeHtml(zh ? '在系统终端中测试 ssh' : 'Test ssh in Terminal')}</span></button>` : ''}
      </div>
      ${d.raw && d.raw !== d.detail ? `<code class="conn-error-raw">${escapeHtml(d.raw)}</code>` : ''}
    `;
    card.querySelector('.act-retry').addEventListener('click', retry);
    const lanBtn = card.querySelector('.act-open-lan');
    if (lanBtn) lanBtn.addEventListener('click', () => rpc('system:openLocalNetworkSettings').catch((e) => showToast(e.message, 'error')));
    const editBtn = card.querySelector('.act-edit-conn');
    if (editBtn) editBtn.addEventListener('click', () => openHostForm(host));
    const termBtn = card.querySelector('.act-test-term');
    if (termBtn) termBtn.addEventListener('click', () => openExternalTerminal('ssh://' + encodeURIComponent(host.id) + '/~').catch((e) => showToast(e.message, 'error')));
    return card;
  }

  function sshUriFor(hostId, remotePath) {
    return 'ssh://' + encodeURIComponent(hostId) + (remotePath.startsWith('/') ? remotePath : '/' + remotePath);
  }

  const sshBrowser = createFileBrowser(document.getElementById('sshBrowserContent'), {
    kind: 'ssh',
    features: { scan: true, launch: true, createFile: true, mkdir: true, transfer: true, rename: true, delete: true },
    openRepoLabel: tr('openCurrentRepo'),
    loadingText: () => tr('connecting'),
    list: (p, showHidden, listOpts) => rpc('ssh:browsePath', { hostId: state.selectedSshHostId, path: p || undefined, showHidden }).then((listing) => {
      state.sshHosts = listing.hosts || state.sshHosts;
      if (!listOpts || !listOpts.subtree) {
        state.sshCurrentPath = listing.currentPath;
        try {
          localStorage.setItem('gitmap.ssh.lastPath.' + state.selectedSshHostId, listing.currentPath);
        } catch (_) {}
      }
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
    renderError: (err, retry) => renderSshErrorCard(err, retry),
    summaryError: () => {
      const h = findHost(state.selectedSshHostId);
      return `<i class="status-dot failed"></i><strong>${escapeHtml(h ? hostLabel(h.id) : state.selectedSshHostId)}</strong>${h ? `<span class="fb-conn-addr">${escapeHtml(hostAddress(h))}</span>` : ''}<span class="fb-conn-meta warn">${escapeHtml(state.lang === 'zh' ? '未连接' : 'Not connected')}</span>`;
    },
    onOpenRepo: (p) => openRemoteRepoAndCloseModal(state.selectedSshHostId, p),
    onOpenFile: (entry) => {
      openFileTab({ repo: '', filePath: sshUriFor(state.selectedSshHostId, entry.path), commit: null, title: entry.name, lines: null });
      document.getElementById('sshModal').classList.add('hidden');
    },
    openTerminal: (p) => openExternalTerminal(sshUriFor(state.selectedSshHostId, p)).catch((err) => showToast(err.message, 'error')),
    openEditor: (p) => openInEditor(sshUriFor(state.selectedSshHostId, p)).catch((err) => showToast(err.message, 'error')),
    scan: (p) => scanRemoteRepos(p),
    createFile: async (dir) => {
      const name = await inputDialog(state.lang === 'zh' ? '新建远程文件' : 'New Remote File', state.lang === 'zh' ? '文件名称（支持相对路径如 src/app.ts）' : 'File name (e.g. src/app.ts)', '');
      if (!name) return;
      try {
        await rpc('ssh:createFile', { hostId: state.selectedSshHostId, path: dir, name });
        await sshBrowser.ensureExpanded(dir);
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    mkdir: async (dir) => {
      const name = await inputDialog(state.lang === 'zh' ? '新建文件夹' : 'New Folder', state.lang === 'zh' ? '文件夹名称' : 'Folder name', '');
      if (!name) return;
      try {
        await rpc('ssh:mkdir', { hostId: state.selectedSshHostId, path: dir, name });
        await sshBrowser.ensureExpanded(dir);
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
      if (!(desktopApi && desktopApi.isElectron)) {
        const input = document.getElementById('webUploadInput');
        input.value = '';
        input.onchange = async () => {
          const files = Array.from(input.files || []);
          if (files.length > 0) await uploadBrowserFilesToSsh(state.selectedSshHostId, destDir, files);
        };
        input.click();
        return;
      }
      try {
        const res = await rpc('transfer:pickUpload', { hostId: state.selectedSshHostId, destDir, folders, both: !folders && desktopApi && desktopApi.platform === 'darwin' });
        if (res.transfer) showTransferPanel(true);
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    uploadBrowserFiles: async (destDir, files) => {
      await uploadBrowserFilesToSsh(state.selectedSshHostId, destDir, files);
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
      if (!(desktopApi && desktopApi.isElectron)) {
        paths.forEach((remotePath) => {
          const a = document.createElement('a');
          a.href = `/api/transfer/web-download?hostId=${encodeURIComponent(state.selectedSshHostId)}&path=${encodeURIComponent(remotePath)}`;
          a.download = remotePath.split('/').pop() || 'download';
          document.body.appendChild(a);
          a.click();
          a.remove();
        });
        return;
      }
      try {
        const res = await rpc('transfer:pickDownload', { hostId: state.selectedSshHostId, sources: paths });
        if (res.transfer) showTransferPanel(true);
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  });

  async function uploadBrowserFilesToSsh(hostId, destDir, files) {
    if (!hostId || !files || files.length === 0) return;
    const zh = state.lang === 'zh';
    showToast(zh ? `正在上传 ${files.length} 个文件…` : `Uploading ${files.length} file(s)…`, 'status');
    let uploaded = 0;
    for (const file of files) {
      try {
        const url = `/api/transfer/web-upload?hostId=${encodeURIComponent(hostId)}&destDir=${encodeURIComponent(destDir || '~')}&name=${encodeURIComponent(file.name)}`;
        const resp = await fetch(url, { method: 'POST', body: file });
        const data = await resp.json();
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        uploaded++;
      } catch (err) {
        showToast(`${file.name}: ${err.message}`, 'error');
      }
    }
    if (uploaded > 0) {
      showToast(zh ? `已上传 ${uploaded} 个文件` : `Uploaded ${uploaded} file(s)`, 'info');
      if (hostId === state.selectedSshHostId && !document.getElementById('sshModal').classList.contains('hidden')) {
        sshBrowser.refresh();
      }
    }
  }

  /* Shared Checklist Modal for Scanning Remote or Local Subfolders */
  async function showScanReposChecklistModal(loadReposFn, parentModalId) {
    const zh = state.lang === 'zh';
    const modal = document.getElementById('clientDialogModal');
    document.getElementById('clientDialogTitle').textContent = zh ? '扫描 Git 仓库' : 'Find Git Repositories';
    const bodyEl = document.getElementById('clientDialogBody');
    const footerEl = document.getElementById('clientDialogFooter');
    bodyEl.innerHTML = `<div class="browser-empty-state"><span class="fb-spinner"></span>${escapeHtml(tr('scanning'))}</div>`;
    footerEl.innerHTML = `<button type="button" class="mini-btn act-cancel">${escapeHtml(tr('cancel'))}</button>`;
    modal.classList.remove('hidden');
    let cancelled = false;
    const close = () => {
      cancelled = true;
      modal.classList.add('hidden');
    };
    footerEl.querySelector('.act-cancel').onclick = close;
    document.getElementById('clientDialogCloseBtn').onclick = close;
    try {
      const repos = await loadReposFn();
      if (cancelled) return;
      if (!repos || repos.length === 0) {
        bodyEl.innerHTML = `<div class="browser-empty-state">${escapeHtml(tr('noReposScanned'))}</div>`;
        return;
      }
      bodyEl.innerHTML = `<p style="margin:0;">${escapeHtml(zh ? `找到 ${repos.length} 个 Git 仓库：` : `Found ${repos.length} Git repositories:`)}</p><div class="scan-results-body"></div>`;
      const list = bodyEl.querySelector('.scan-results-body');
      repos.forEach((r) => {
        const val = r.sshUri || r.path;
        const row = document.createElement('label');
        row.className = 'scan-result-row';
        row.innerHTML = `<input type="checkbox" class="scan-repo-chk" value="${escapeHtml(val)}" checked />
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
          if (parentModalId) document.getElementById(parentModalId).classList.add('hidden');
          activateTab('graph');
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
    } catch (err) {
      if (!cancelled) bodyEl.innerHTML = `<div class="browser-empty-state error-text">${escapeHtml(err.message)}</div>`;
    }
  }

  async function scanRemoteRepos(dirPath) {
    if (!state.selectedSshHostId) return;
    await showScanReposChecklistModal(async () => {
      const res = await rpc('ssh:scanRepos', { hostId: state.selectedSshHostId, path: dirPath, maxDepth: 3 });
      return res.repos || [];
    }, 'sshModal');
  }

  async function uploadBrowserFilesToLocal(destDir, files, refreshFn) {
    if (!files || files.length === 0) return;
    const zh = state.lang === 'zh';
    showToast(zh ? `正在导入 ${files.length} 个文件…` : `Importing ${files.length} file(s)…`, 'status');
    let count = 0;
    for (const file of files) {
      try {
        const url = `/api/local/web-upload?destDir=${encodeURIComponent(destDir || state.homeDir)}&name=${encodeURIComponent(file.name)}`;
        const resp = await fetch(url, { method: 'POST', body: file });
        const data = await resp.json();
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        count++;
      } catch (err) {
        showToast(`${file.name}: ${err.message}`, 'error');
      }
    }
    if (count > 0) {
      showToast(zh ? `已导入 ${count} 个文件` : `Imported ${count} file(s)`, 'info');
      if (refreshFn) await refreshFn();
      window.GitMapFeatures?.refreshAllStatusesAndContext();
    }
  }

  /* ==================== Local Repository Browser Modal ==================== */
  const localBrowser = createFileBrowser(document.getElementById('localBrowserRoot'), {
    kind: 'local',
    features: {
      scan: true,
      launch: true,
      createFile: true,
      mkdir: true,
      rename: true,
      delete: true,
      transfer: true,
      nativePicker: !!(desktopApi && desktopApi.isElectron)
    },
    openRepoLabel: tr('openCurrentLocalRepo'),
    loadingText: () => (state.lang === 'zh' ? '正在读取…' : 'Loading…'),
    list: (p, showHidden, listOpts) => rpc('local:browsePath', { path: p || state.homeDir, showHidden }).then((listing) => {
      if (!listOpts || !listOpts.subtree) {
        state.localCurrentPath = listing.currentPath;
      }
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
      await showScanReposChecklistModal(async () => {
        const res = await rpc('repos:scanLocal', { path: dirPath, maxDepth: 3, previewOnly: true });
        return res.repos || [];
      }, 'localModal');
    },
    createFile: async (dir) => {
      const name = await inputDialog(state.lang === 'zh' ? '新建文件' : 'New File', state.lang === 'zh' ? '文件名称' : 'File name', '');
      if (!name) return;
      try {
        await rpc('local:createFile', { path: dir, name });
        await localBrowser.ensureExpanded(dir);
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    mkdir: async (dir) => {
      const name = await inputDialog(state.lang === 'zh' ? '新建文件夹' : 'New Folder', state.lang === 'zh' ? '文件夹名称' : 'Folder name', '');
      if (!name) return;
      try {
        await rpc('local:mkdir', { path: dir, name });
        await localBrowser.ensureExpanded(dir);
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    rename: async (entry) => {
      const name = await inputDialog(state.lang === 'zh' ? '重命名' : 'Rename', state.lang === 'zh' ? '新名称' : 'New name', entry.name);
      if (!name || name === entry.name) return;
      try {
        await rpc('local:rename', { path: entry.path, name });
        await localBrowser.refresh();
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    remove: async (entries) => {
      if (!entries || entries.length === 0) return;
      const zh = state.lang === 'zh';
      const names = entries.slice(0, 8).map((e) => '• ' + e.name + (e.isDirectory ? '/' : '')).join('\n') + (entries.length > 8 ? `\n… +${entries.length - 8}` : '');
      const ok = await confirmDialog(...localDeleteConfirmText(entries.length, names));
      if (!ok) return;
      try {
        await rpc('local:delete', { paths: entries.map((e) => e.path) });
        await localBrowser.refresh();
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    upload: async (destDir, folders) => {
      if (!(desktopApi && desktopApi.isElectron)) {
        const input = document.getElementById('webUploadInput');
        input.value = '';
        input.onchange = async () => {
          const files = Array.from(input.files || []);
          if (files.length > 0) await uploadBrowserFilesToLocal(destDir, files, () => localBrowser.refresh());
        };
        input.click();
        return;
      }
      try {
        const res = await rpc('local:pickImport', { destDir, folders, both: !folders && desktopApi.platform === 'darwin' });
        if (res.copied && res.copied.length > 0) {
          showToast((state.lang === 'zh' ? `已复制导入 ${res.copied.length} 项` : `Imported ${res.copied.length} item(s)`), 'info');
          await localBrowser.refresh();
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    uploadPaths: async (destDir, paths) => {
      try {
        const res = await rpc('local:importPaths', { destDir, sources: paths });
        if (res.copied && res.copied.length > 0) {
          showToast((state.lang === 'zh' ? `已复制导入 ${res.copied.length} 项` : `Imported ${res.copied.length} item(s)`), 'info');
          await localBrowser.refresh();
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    uploadBrowserFiles: async (destDir, files) => {
      await uploadBrowserFilesToLocal(destDir, files, () => localBrowser.refresh());
    },
    download: async (paths) => {
      if (!paths || paths.length === 0) return;
      if (!(desktopApi && desktopApi.isElectron)) {
        paths.forEach((localPath) => {
          const a = document.createElement('a');
          a.href = `/api/local/web-download?path=${encodeURIComponent(localPath)}`;
          a.download = localPath.split(/[\\/]/).pop() || 'download';
          document.body.appendChild(a);
          a.click();
          a.remove();
        });
        return;
      }
      try {
        const res = await rpc('local:pickExport', { sources: paths });
        if (res.exported && res.exported.length > 0) {
          showToast((state.lang === 'zh' ? `已导出 ${res.exported.length} 项` : `Exported ${res.exported.length} item(s)`), 'info');
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  });

  /* ==================== Workspace Repository File Explorer Tab ==================== */
  let repoExplorerBoundRepo = null;

  function activeRepoTarget() {
    if (!state.activeRepo || !state.repos[state.activeRepo]) return null;
    return parseRepoDisplay(state.activeRepo);
  }

  function buildRepoFileViewerPayload(entryPath, entryName) {
    const info = activeRepoTarget();
    if (!info) return null;
    if (info.isRemote) {
      const rootClean = info.remotePath.replace(/\/+$/, '');
      if (entryPath.startsWith(rootClean + '/')) {
        const rel = entryPath.slice(rootClean.length + 1);
        return { repo: state.activeRepo, filePath: rel, commit: null, title: entryName, lines: null };
      }
      return { repo: '', filePath: sshUriFor(info.hostId, entryPath), commit: null, title: entryName, lines: null };
    }
    const rootClean = info.fullDisplay.replace(/[\\/]+$/, '');
    const normEntry = entryPath.replace(/\\/g, '/');
    const normRoot = rootClean.replace(/\\/g, '/');
    if (normEntry.startsWith(normRoot + '/')) {
      const rel = normEntry.slice(normRoot.length + 1);
      return { repo: state.activeRepo, filePath: rel, commit: null, title: entryName, lines: null };
    }
    return { repo: '', filePath: entryPath, commit: null, title: entryName, lines: null };
  }

  async function openRepoEntryInViewer(entryPath, entryName, forceTab) {
    const payload = buildRepoFileViewerPayload(entryPath, entryName);
    if (!payload) return;
    const previewPane = document.getElementById('repoFilesPreviewPane');
    if (!forceTab && state.repoInlinePreview && previewPane) {
      if (typeof previewPane.__confirmDiscardIfDirty === 'function') {
        const ok = await previewPane.__confirmDiscardIfDirty();
        if (!ok) return;
      }
      previewPane.classList.remove('hidden');
      renderFileViewerInto(previewPane, payload, {
        isInlinePreview: true,
        onPromoteTab: (transferState) => {
          if (typeof previewPane.__disposeViewer === 'function') previewPane.__disposeViewer();
          previewPane.classList.add('hidden');
          openFileTab({ ...payload, ...(transferState || {}) });
        },
        onClosePreview: () => {
          if (typeof previewPane.__disposeViewer === 'function') previewPane.__disposeViewer();
          previewPane.classList.add('hidden');
        }
      });
      return;
    }
    openFileTab(payload);
  }

  /**
   * Git status of the repository explorer: one `scm:status` per folder listing, mapped repository-relative path →
   * status letter. Files get a coloured name and a letter; folders a dot when something below them changed.
   */
  const repoGitStatus = { repo: null, files: new Map(), dirs: new Map(), seq: 0 };
  const GIT_STATUS_RANK = { C: 5, D: 4, M: 3, R: 3, A: 2, U: 1 };
  const GIT_STATUS_TEXT = {
    C: ['有冲突', 'Conflict'], D: ['已删除', 'Deleted'], M: ['已修改', 'Modified'], R: ['已重命名', 'Renamed'], A: ['已添加（已暂存）', 'Added (staged)'], U: ['未跟踪', 'Untracked']
  };

  function repoRelPath(absPath) {
    const info = activeRepoTarget();
    if (!info) return null;
    const rootDir = String(info.isRemote ? info.remotePath : info.fullDisplay).replace(/\\/g, '/').replace(/\/+$/, '');
    const p = String(absPath || '').replace(/\\/g, '/');
    return p.startsWith(rootDir + '/') ? p.slice(rootDir.length + 1) : null;
  }

  async function refreshRepoGitStatus() {
    const repo = state.activeRepo;
    if (!repo) return;
    const seq = ++repoGitStatus.seq;
    try {
      const st = await rpc('scm:status', { repo });
      if (seq !== repoGitStatus.seq || state.activeRepo !== repo) return;
      const files = new Map();
      const put = (rel, code) => {
        if (!rel || !GIT_STATUS_RANK[code]) return;
        const cur = files.get(rel);
        if (!cur || GIT_STATUS_RANK[code] > GIT_STATUS_RANK[cur]) files.set(rel, code);
      };
      (st.staged || []).forEach((f) => put(f.path, f.status === 'C' ? 'A' : f.status));
      (st.unstaged || []).forEach((f) => put(f.path, f.status));
      (st.conflicted || []).forEach((f) => put(f.path, 'C'));
      const dirs = new Map();
      files.forEach((code, rel) => {
        const parts = rel.split('/');
        for (let i = 1; i < parts.length; i++) {
          const d = parts.slice(0, i).join('/');
          const cur = dirs.get(d);
          if (!cur || GIT_STATUS_RANK[code] > GIT_STATUS_RANK[cur]) dirs.set(d, code);
        }
      });
      repoGitStatus.repo = repo;
      repoGitStatus.files = files;
      repoGitStatus.dirs = dirs;
      if (typeof repoFilesBrowser !== 'undefined' && repoFilesBrowser.rerender) repoFilesBrowser.rerender();
    } catch (_) {
      /* status is decoration only */
    }
  }

  function repoGitDecoration(entry) {
    if (repoGitStatus.repo !== state.activeRepo) return null;
    const rel = repoRelPath(entry.path);
    if (rel === null) return null;
    const code = entry.isDirectory ? repoGitStatus.dirs.get(rel) : repoGitStatus.files.get(rel);
    if (!code) return null;
    const [zh, en] = GIT_STATUS_TEXT[code];
    return entry.isDirectory
      ? { code, badge: '●', title: state.lang === 'zh' ? '里面有改动' : 'Contains changes' }
      : { code, badge: code, title: state.lang === 'zh' ? zh : en };
  }

  const repoFilesBrowser = createFileBrowser(document.getElementById('repoFilesBrowserRoot'), {
    kind: 'repo',
    showOpenRepo: false,
    folderClickExpands: true,
    singleClickOpenFile: true,
    inlinePreviewToggle: true,
    features: {
      scan: false,
      launch: true,
      createFile: true,
      mkdir: true,
      rename: true,
      delete: true,
      transfer: true
    },
    homeTitle: () => (state.lang === 'zh' ? '回到当前仓库根目录' : 'Jump to Repository Root'),
    rootPath: () => {
      const info = activeRepoTarget();
      return info ? (info.isRemote ? info.remotePath : info.fullDisplay) : null;
    },
    rootLabel: () => {
      const info = activeRepoTarget();
      return info ? info.name : '';
    },
    decorate: (entry) => repoGitDecoration(entry),
    getHomePath: () => {
      const info = activeRepoTarget();
      if (!info) return '~';
      return info.isRemote ? info.remotePath : info.fullDisplay;
    },
    loadingText: () => (state.lang === 'zh' ? '正在读取仓库目录…' : 'Loading repository files…'),
    list: async (p, showHidden, listOpts) => {
      const info = activeRepoTarget();
      if (!info) throw new Error(tr('noActiveRepo'));
      if (!listOpts || !listOpts.subtree) refreshRepoGitStatus(); // runs alongside the listing; rows re-render when it lands
      if (info.isRemote) {
        const listing = await rpc('ssh:browsePath', { hostId: info.hostId, path: p || info.remotePath, showHidden });
        state.sshHosts = listing.hosts || state.sshHosts;
        renderSidebar();
        return listing;
      }
      return rpc('local:browsePath', { path: p || info.fullDisplay, showHidden });
    },
    complete: (p, showHidden) => {
      const info = activeRepoTarget();
      if (!info) return Promise.resolve({ entries: [], prefix: '', dir: '' });
      return info.isRemote
        ? rpc('ssh:complete', { hostId: info.hostId, path: p, showHidden })
        : rpc('local:complete', { path: p, showHidden });
    },
    summary: () => {
      const info = activeRepoTarget();
      if (!info) return '';
      if (info.isRemote) {
        const h = findHost(info.hostId);
        return `<i class="status-dot connected"></i><strong>${escapeHtml(info.name)}</strong><span class="fb-conn-addr">${escapeHtml(hostLabel(info.hostId) + ':' + info.remotePath)}</span>${h && h.gitVersion ? `<span class="fb-conn-meta">SSH · Git ${escapeHtml(h.gitVersion)}</span>` : '<span class="fb-conn-meta">SSH</span>'}`;
      }
      return `<span class="icon-slot">${ICONS.gitRepo}</span><strong>${escapeHtml(info.name)}</strong><span class="fb-conn-addr">${escapeHtml(info.fullDisplay)}</span><span class="fb-conn-meta">${escapeHtml(state.lang === 'zh' ? '本地仓库' : 'Local Repo')}</span>`;
    },
    displayRepo: (p) => {
      const info = activeRepoTarget();
      return info && info.isRemote ? `${hostLabel(info.hostId)}:${p}` : p;
    },
    onOpenRepo: (p) => {
      const info = activeRepoTarget();
      if (info && info.isRemote) openRemoteRepoAndCloseModal(info.hostId, p);
      else addLocalRepoAndClose(p);
    },
    onOpenFile: (entry) => openRepoEntryInViewer(entry.path, entry.name, false),
    onDoubleClickFile: (entry) => openRepoEntryInViewer(entry.path, entry.name, true),
    openTerminal: (p) => {
      const info = activeRepoTarget();
      if (!info) return;
      const loc = info.isRemote ? sshUriFor(info.hostId, p) : p;
      openExternalTerminal(loc).catch((err) => showToast(err.message, 'error'));
    },
    openEditor: (p) => {
      const info = activeRepoTarget();
      if (!info) return;
      const loc = info.isRemote ? sshUriFor(info.hostId, p) : p;
      openInEditor(loc).catch((err) => showToast(err.message, 'error'));
    },
    createFile: async (dir) => {
      const info = activeRepoTarget();
      if (!info) return;
      const zh = state.lang === 'zh';
      const name = await inputDialog(zh ? '新建文件' : 'New File', zh ? '文件名称（可含子目录，如 src/index.ts）' : 'File name (e.g. src/index.ts)', '');
      if (!name) return;
      try {
        const res = info.isRemote
          ? await rpc('ssh:createFile', { hostId: info.hostId, path: dir, name })
          : await rpc('local:createFile', { path: dir, name });
        await repoFilesBrowser.ensureExpanded(dir);
        window.GitMapFeatures?.refreshAllStatusesAndContext();
        const baseName = res.path.split(/[\\/]/).pop() || name;
        openRepoEntryInViewer(res.path, baseName, false);
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    mkdir: async (dir) => {
      const info = activeRepoTarget();
      if (!info) return;
      const zh = state.lang === 'zh';
      const name = await inputDialog(zh ? '新建文件夹' : 'New Folder', zh ? '文件夹名称' : 'Folder name', '');
      if (!name) return;
      try {
        if (info.isRemote) await rpc('ssh:mkdir', { hostId: info.hostId, path: dir, name });
        else await rpc('local:mkdir', { path: dir, name });
        await repoFilesBrowser.ensureExpanded(dir);
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    rename: async (entry) => {
      const info = activeRepoTarget();
      if (!info) return;
      const zh = state.lang === 'zh';
      const name = await inputDialog(zh ? '重命名' : 'Rename', zh ? '新名称' : 'New name', entry.name);
      if (!name || name === entry.name) return;
      try {
        if (info.isRemote) await rpc('ssh:rename', { hostId: info.hostId, path: entry.path, name });
        else await rpc('local:rename', { path: entry.path, name });
        await repoFilesBrowser.refresh();
        window.GitMapFeatures?.refreshAllStatusesAndContext();
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    remove: async (entries) => {
      const info = activeRepoTarget();
      if (!info || !entries || entries.length === 0) return;
      const zh = state.lang === 'zh';
      const names = entries.slice(0, 8).map((e) => '• ' + e.name + (e.isDirectory ? '/' : '')).join('\n') + (entries.length > 8 ? `\n… +${entries.length - 8}` : '');
      const ok = info.isRemote
        ? await confirmDialog(
          zh ? '永久删除文件 / 文件夹' : 'Permanently Delete Items',
          (zh ? `远端服务器没有废纸篓，以下 ${entries.length} 项（文件夹含其全部内容）会被永久删除，不可恢复：\n\n` : `The server has no Trash: these ${entries.length} item(s) will be deleted for good:\n\n`) + names,
          zh ? '永久删除' : 'Delete Permanently',
          true
        )
        : await confirmDialog(...localDeleteConfirmText(entries.length, names));
      if (!ok) return;
      try {
        if (info.isRemote) await rpc('ssh:delete', { hostId: info.hostId, paths: entries.map((e) => e.path) });
        else await rpc('local:delete', { paths: entries.map((e) => e.path) });
        await repoFilesBrowser.refresh();
        window.GitMapFeatures?.refreshAllStatusesAndContext();
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    upload: async (destDir, folders) => {
      const info = activeRepoTarget();
      if (!info) return;
      if (info.isRemote) {
        if (!(desktopApi && desktopApi.isElectron)) {
          const input = document.getElementById('webUploadInput');
          input.value = '';
          input.onchange = async () => {
            const files = Array.from(input.files || []);
            if (files.length > 0) {
              await uploadBrowserFilesToSsh(info.hostId, destDir, files);
              await repoFilesBrowser.refresh();
            }
          };
          input.click();
          return;
        }
        try {
          const res = await rpc('transfer:pickUpload', { hostId: info.hostId, destDir, folders, both: !folders && desktopApi.platform === 'darwin' });
          if (res.transfer) showTransferPanel(true);
        } catch (err) {
          showToast(err.message, 'error');
        }
      } else {
        if (!(desktopApi && desktopApi.isElectron)) {
          const input = document.getElementById('webUploadInput');
          input.value = '';
          input.onchange = async () => {
            const files = Array.from(input.files || []);
            if (files.length > 0) await uploadBrowserFilesToLocal(destDir, files, () => repoFilesBrowser.refresh());
          };
          input.click();
          return;
        }
        try {
          const res = await rpc('local:pickImport', { destDir, folders, both: !folders && desktopApi.platform === 'darwin' });
          if (res.copied && res.copied.length > 0) {
            showToast((state.lang === 'zh' ? `已上传/导入 ${res.copied.length} 项` : `Imported ${res.copied.length} item(s)`), 'info');
            await repoFilesBrowser.refresh();
            window.GitMapFeatures?.refreshAllStatusesAndContext();
          }
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    },
    uploadPaths: async (destDir, paths) => {
      const info = activeRepoTarget();
      if (!info) return;
      try {
        if (info.isRemote) {
          await rpc('transfer:start', { direction: 'upload', hostId: info.hostId, sources: paths, destDir });
          showTransferPanel(true);
        } else {
          const res = await rpc('local:importPaths', { destDir, sources: paths });
          if (res.copied && res.copied.length > 0) {
            showToast((state.lang === 'zh' ? `已上传/导入 ${res.copied.length} 项` : `Imported ${res.copied.length} item(s)`), 'info');
            await repoFilesBrowser.refresh();
            window.GitMapFeatures?.refreshAllStatusesAndContext();
          }
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    uploadBrowserFiles: async (destDir, files) => {
      const info = activeRepoTarget();
      if (!info) return;
      if (info.isRemote) {
        await uploadBrowserFilesToSsh(info.hostId, destDir, files);
        await repoFilesBrowser.refresh();
      } else {
        await uploadBrowserFilesToLocal(destDir, files, () => repoFilesBrowser.refresh());
      }
    },
    download: async (paths) => {
      const info = activeRepoTarget();
      if (!info || !paths || paths.length === 0) return;
      if (info.isRemote) {
        if (!(desktopApi && desktopApi.isElectron)) {
          paths.forEach((remotePath) => {
            const a = document.createElement('a');
            a.href = `/api/transfer/web-download?hostId=${encodeURIComponent(info.hostId)}&path=${encodeURIComponent(remotePath)}`;
            a.download = remotePath.split('/').pop() || 'download';
            document.body.appendChild(a);
            a.click();
            a.remove();
          });
          return;
        }
        try {
          const res = await rpc('transfer:pickDownload', { hostId: info.hostId, sources: paths });
          if (res.transfer) showTransferPanel(true);
        } catch (err) {
          showToast(err.message, 'error');
        }
      } else {
        if (!(desktopApi && desktopApi.isElectron)) {
          paths.forEach((localPath) => {
            const a = document.createElement('a');
            a.href = `/api/local/web-download?path=${encodeURIComponent(localPath)}`;
            a.download = localPath.split(/[\\/]/).pop() || 'download';
            document.body.appendChild(a);
            a.click();
            a.remove();
          });
          return;
        }
        try {
          const res = await rpc('local:pickExport', { sources: paths });
          if (res.exported && res.exported.length > 0) {
            showToast((state.lang === 'zh' ? `已下载/导出 ${res.exported.length} 项` : `Downloaded ${res.exported.length} item(s)`), 'info');
          }
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    }
  });

  function syncRepoFilesExplorer(forceRoot) {
    const emptyEl = document.getElementById('repoFilesEmpty');
    const splitBodyEl = document.getElementById('repoFilesSplitBody');
    const previewPaneEl = document.getElementById('repoFilesPreviewPane');
    const info = activeRepoTarget();
    if (!info) {
      repoExplorerBoundRepo = null;
      emptyEl.classList.remove('hidden');
      splitBodyEl.classList.add('hidden');
      if (previewPaneEl) previewPaneEl.classList.add('hidden');
      return;
    }
    emptyEl.classList.add('hidden');
    splitBodyEl.classList.remove('hidden');
    const rootTarget = info.isRemote ? info.remotePath : info.fullDisplay;
    if (forceRoot || repoExplorerBoundRepo !== state.activeRepo || !repoFilesBrowser.currentPath) {
      if (repoExplorerBoundRepo !== state.activeRepo && previewPaneEl) {
        previewPaneEl.classList.add('hidden');
      }
      repoExplorerBoundRepo = state.activeRepo;
      repoFilesBrowser.reset();
      repoFilesBrowser.navigate(rootTarget, { push: true });
    }
  }

  function openRepoFilesTab(forceRoot = false) {
    activateTab('files');
    if (forceRoot) syncRepoFilesExplorer(true);
    document.querySelector('#repoFilesBrowserRoot .fb-table')?.focus();
  }

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

  let lastTransferStructureSig = '';
  function renderTransfers() {
    const list = document.getElementById('transferList');
    const zh = state.lang === 'zh';
    const transfers = state.transfers;
    const active = transfers.filter((t) => t.state === 'running' || t.state === 'scanning' || t.state === 'queued');
    const resumable = transfers.filter((t) => t.state === 'paused' || t.state === 'failed');
    const finished = transfers.filter((t) => t.state === 'completed' || t.state === 'cancelled' || t.state === 'undone');
    const btn = document.getElementById('btnTransfers');
    btn.classList.toggle('hidden', transfers.length === 0);
    btn.classList.toggle('busy', active.length > 0);
    const badge = document.getElementById('transfersBadge');
    badge.textContent = String(active.length);
    badge.classList.toggle('hidden', active.length === 0);
    if (transfers.length === 0) showTransferPanel(false);

    document.getElementById('btnTransfersPauseAll').disabled = active.length === 0;
    document.getElementById('btnTransfersResumeAll').disabled = resumable.length === 0;
    document.getElementById('btnTransfersClear').disabled = finished.length === 0;

    let totalDone = 0;
    let total = 0;
    active.forEach((t) => {
      totalDone += t.doneBytes;
      total += t.totalBytes;
    });
    document.getElementById('transferSummary').textContent = active.length > 0
      ? (zh ? `${active.length} 个进行中` : `${active.length} active`) + (total > 0 ? ` · ${Math.floor((totalDone / total) * 100)}%` : '')
      : (zh ? `${transfers.length} 项` : `${transfers.length} item(s)`);

    const buildStatsText = (t) => {
      const stats = [];
      if (t.totalBytes > 0 || t.totalFiles > 0) stats.push(`${formatBytes(t.doneBytes)} / ${formatBytes(t.totalBytes)}`);
      if (t.totalFiles > 1) stats.push(zh ? `${t.doneFiles}/${t.totalFiles} 个文件` : `${t.doneFiles}/${t.totalFiles} files`);
      if (t.state === 'running' && t.speed > 0) stats.push(formatBytes(t.speed) + '/s');
      if (t.etaSeconds != null) stats.push((zh ? '剩余 ' : 'ETA ') + formatEta(t.etaSeconds));
      return stats.join(' · ');
    };

    const sig = state.lang + '|' + transfers.map((t) => `${t.id}:${t.state}:${t.canUndo ? 1 : 0}:${t.canRestore ? 1 : 0}:${t.error || ''}`).join(',');
    if (sig === lastTransferStructureSig && list.children.length === transfers.length) {
      // Update progress bars and stats in place so button hover/focus is never lost on 250ms ticks
      transfers.forEach((t) => {
        const itemEl = list.querySelector(`.transfer-item[data-transfer-id="${CSS.escape(t.id)}"]`);
        if (!itemEl) return;
        const pct = t.totalBytes > 0 ? Math.min(100, (t.doneBytes / t.totalBytes) * 100) : (t.state === 'completed' ? 100 : 0);
        const barFill = itemEl.querySelector('.transfer-bar > i');
        if (barFill) barFill.style.width = pct.toFixed(1) + '%';
        const statsSpan = itemEl.querySelector('.transfer-stats');
        if (statsSpan) statsSpan.textContent = buildStatsText(t);
        const curEl = itemEl.querySelector('.transfer-current');
        if (curEl) {
          curEl.textContent = t.currentFile && t.totalFiles > 1 ? t.currentFile : '';
          curEl.classList.toggle('hidden', !(t.currentFile && t.totalFiles > 1));
        }
      });
      return;
    }
    lastTransferStructureSig = sig;

    list.innerHTML = transfers.map((t) => {
      const pct = t.totalBytes > 0 ? Math.min(100, (t.doneBytes / t.totalBytes) * 100) : (t.state === 'completed' ? 100 : 0);
      const icon = t.direction === 'upload' ? ICONS.upload : ICONS.download;
      const dest = t.direction === 'upload' ? `${t.hostId}:${t.destDir}` : t.destDir;
      const from = t.direction === 'upload' ? (zh ? '上传到 ' : 'to ') + dest : (zh ? `从 ${t.hostId} 下载到 ` : `from ${t.hostId} to `) + dest;
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
      return `<div class="transfer-item state-${t.state}" data-transfer-id="${escapeHtml(t.id)}">
        <div class="transfer-item-top">
          <span class="transfer-dir ${t.direction}">${icon}</span>
          <span class="transfer-name" title="${escapeHtml(t.name)}">${escapeHtml(t.name)}</span>
          <span class="transfer-actions">${actions.join('')}</span>
        </div>
        <div class="transfer-sub" title="${escapeHtml(dest)}">${escapeHtml(from)}</div>
        <div class="transfer-bar"><i style="width:${pct.toFixed(1)}%"></i></div>
        <div class="transfer-meta"><span class="transfer-state">${escapeHtml(transferStateLabel(t))}</span><span class="transfer-stats">${escapeHtml(buildStatsText(t))}</span></div>
        ${t.error ? `<div class="transfer-error">${escapeHtml(t.error)}</div>` : ''}
        <div class="transfer-current ${t.currentFile && t.totalFiles > 1 ? '' : 'hidden'}" title="${escapeHtml(t.currentFile || '')}">${escapeHtml(t.currentFile || '')}</div>
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
        if (t.direction === 'upload' && t.hostId === state.selectedSshHostId && (t.destDir === sshBrowser.currentPath || sshBrowser.expandedDirs.has(t.destDir)) && !document.getElementById('sshModal').classList.contains('hidden')) {
          sshBrowser.refresh();
        }
        const activeInfo = activeRepoTarget();
        if (t.direction === 'upload' && activeInfo && activeInfo.isRemote && t.hostId === activeInfo.hostId && (t.destDir === repoFilesBrowser.currentPath || repoFilesBrowser.expandedDirs.has(t.destDir)) && (state.activeTabId === 'files' || isSplitWorkspace())) {
          repoFilesBrowser.refresh();
          window.GitMapFeatures?.refreshAllStatusesAndContext();
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
    } finally {
      if (btn.isConnected) btn.disabled = false;
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
    const defaultFormat = preset && preset.defaultApiFormat ? preset.defaultApiFormat : 'chat';
    document.getElementById('cfgAiApiFormatDefault').textContent = tr('aiApiFormatDefault', AI_FORMAT_LABELS[defaultFormat] || defaultFormat);
    syncAiRequestFields();
  }

  const AI_FORMAT_LABELS = { chat: 'Chat Completions', responses: 'Responses', anthropic: 'Anthropic Messages' };
  const AI_FORMAT_PATHS = { chat: '/chat/completions', responses: '/responses', anthropic: '/messages' };

  /** The request settings as entered in Settings (not necessarily saved). */
  function readAiRequestForm() {
    return {
      apiFormat: document.getElementById('cfgAiApiFormat').value,
      endpointPath: document.getElementById('cfgAiEndpointPath').value.trim(),
      temperature: document.getElementById('cfgAiTemperature').value.trim(),
      maxTokens: document.getElementById('cfgAiMaxTokens').value.trim(),
      thinking: document.getElementById('cfgAiThinking').value,
      stream: document.getElementById('cfgAiStream').checked,
      timeoutSeconds: document.getElementById('cfgAiTimeout').value.trim(),
      extraBody: document.getElementById('cfgAiExtraBody').value.trim(),
      extraHeaders: document.getElementById('cfgAiExtraHeaders').value.trim()
    };
  }

  let aiPreviewTimer = null;
  let aiPreviewSeq = 0;
  function syncAiRequestFields() {
    const info = settingsUi.aiInfo;
    if (!info) return;
    const providerId = document.getElementById('cfgAiProvider').value;
    const preset = info.presets.find((p) => p.id === providerId) || null;
    const chosen = document.getElementById('cfgAiApiFormat').value || (preset && preset.defaultApiFormat) || 'chat';
    document.getElementById('cfgAiEndpointPath').placeholder = tr('phEndpointPath', AI_FORMAT_PATHS[chosen] || '');
    document.getElementById('cfgAiTemperature').placeholder = tr('phTemperature');
    document.getElementById('cfgAiMaxTokens').placeholder = tr('phMaxTokens');
    document.getElementById('cfgAiTimeout').placeholder = String(info.defaultTimeoutSeconds || 90);
    clearTimeout(aiPreviewTimer);
    aiPreviewTimer = setTimeout(updateAiPreview, 150);
  }

  async function updateAiPreview() {
    const seq = ++aiPreviewSeq;
    const providerId = document.getElementById('cfgAiProvider').value;
    const preset = settingsUi.aiInfo ? settingsUi.aiInfo.presets.find((p) => p.id === providerId) : null;
    const baseUrl = document.getElementById('cfgAiBaseUrl').value.trim() || (preset ? preset.defaultBaseUrl : '');
    const model = document.getElementById('cfgAiModel').value.trim() || (preset ? preset.defaultModel : '');
    const pre = document.getElementById('cfgAiPreview');
    try {
      const res = await rpc('ai:preview', { provider: providerId, baseUrl, model, request: readAiRequestForm() });
      if (seq !== aiPreviewSeq) return;
      let text = 'POST ' + res.url + '\n' + JSON.stringify(res.body, null, 2);
      if (res.fallback) text += '\n\n# ' + tr('aiFallbackNote', AI_FORMAT_PATHS[res.fallback]);
      if (res.error) text = '⚠ ' + res.error + '\n\n' + text;
      pre.textContent = text;
      pre.classList.toggle('has-error', !!res.error);
    } catch (err) {
      if (seq === aiPreviewSeq) pre.textContent = err.message;
    }
  }

  function showAiTestResult(text, kind) {
    const el = document.getElementById('cfgAiTestResult');
    el.textContent = text;
    el.className = 'ai-test-result ' + (kind || '');
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
      document.getElementById('cfgTheme').value = state.themePref;
      if (s['gitmap.app.iconStyle'] && VALID_ICON_STYLE_IDS.has(s['gitmap.app.iconStyle'])) {
        state.iconStyle = s['gitmap.app.iconStyle'];
      }
      if (['auto', 'dark', 'light'].includes(s['gitmap.app.iconTheme'])) {
        state.iconTheme = s['gitmap.app.iconTheme'];
      }
      renderIconStylePicker();
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
      const asText = (v) => (v === undefined || v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
      document.getElementById('cfgAiApiFormat').value = ['chat', 'responses', 'anthropic'].includes(s['git-map.ai.apiFormat']) ? s['git-map.ai.apiFormat'] : '';
      document.getElementById('cfgAiEndpointPath').value = asText(s['git-map.ai.endpointPath']);
      document.getElementById('cfgAiThinking').value = ['off', 'low', 'medium', 'high'].includes(s['git-map.ai.thinking']) ? s['git-map.ai.thinking'] : 'default';
      document.getElementById('cfgAiTemperature').value = asText(s['git-map.ai.temperature']);
      document.getElementById('cfgAiMaxTokens').value = asText(s['git-map.ai.maxTokens']);
      document.getElementById('cfgAiTimeout').value = asText(s['git-map.ai.timeoutSeconds']);
      document.getElementById('cfgAiStream').checked = s['git-map.ai.stream'] !== false;
      document.getElementById('cfgAiExtraBody').value = asText(s['git-map.ai.extraBody']);
      document.getElementById('cfgAiExtraHeaders').value = asText(s['git-map.ai.extraHeaders']);
      document.getElementById('cfgAiTestResult').classList.add('hidden');
      syncAiProviderFields();
      await loadLaunchers(false);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function saveAppSettings(closeAfter) {
    const providerSelect = document.getElementById('cfgAiProvider');
    const prevSyntax = state.settings['gitmap.diff.syntaxHighlight'] !== false;
    const nextSyntax = document.getElementById('cfgSyntaxHighlight').value !== 'off';
    const updates = [
      ['git-map.language', document.getElementById('cfgLanguage').value],
      ['gitmap.app.theme', document.getElementById('cfgTheme').value],
      ['gitmap.app.iconStyle', state.iconStyle],
      ['gitmap.app.iconTheme', state.iconTheme],
      ['git-map.graph.colourPreset', document.getElementById('cfgColourPreset').value],
      ['git-map.graph.style', document.getElementById('cfgGraphStyle').value],
      ['git-map.graph.nodeStyle', document.getElementById('cfgNodeStyle').value],
      ['gitmap.diff.syntaxHighlight', nextSyntax],
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
    const req = readAiRequestForm();
    const toNumber = (v) => (v === '' || !isFinite(Number(v)) ? '' : Number(v));
    updates.push(
      ['git-map.ai.apiFormat', req.apiFormat],
      ['git-map.ai.endpointPath', req.endpointPath],
      ['git-map.ai.thinking', req.thinking === 'default' ? '' : req.thinking],
      ['git-map.ai.temperature', toNumber(req.temperature)],
      ['git-map.ai.maxTokens', toNumber(req.maxTokens)],
      ['git-map.ai.timeoutSeconds', toNumber(req.timeoutSeconds)],
      ['git-map.ai.stream', req.stream],
      ['git-map.ai.extraBody', req.extraBody],
      ['git-map.ai.extraHeaders', req.extraHeaders]
    );
    const changedMap = {};
    for (const [key, value] of updates) {
      if (state.settings[key] !== value && !(state.settings[key] === undefined && (value === '' || (key === 'git-map.ai.stream' && value === true)))) {
        changedMap[key] = value;
      }
    }
    if (Object.keys(changedMap).length > 0) {
      const res = await rpc('settings:updateBatch', { updates: changedMap });
      state.settings = res.settings || state.settings;
    }
    const apiKey = document.getElementById('cfgAiKey').value.trim();
    if (apiKey && !document.getElementById('cfgAiKey').disabled) {
      await rpc('ai:setApiKey', { key: apiKey });
    }

    if (prevSyntax !== nextSyntax) {
      document.querySelectorAll('#coreSplitStage .tab-panel, #coreSplitStage .tab-panel-content, #repoFilesPreviewPane').forEach((panel) => {
        if (typeof panel.__rerenderViewer === 'function') panel.__rerenderViewer();
      });
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
  document.getElementById('cfgTheme').addEventListener('change', (e) => {
    applyTheme(e.target.value);
  });
  document.querySelectorAll('#cfgIconThemeSeg .icon-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-icon-theme');
      setAppIconPrefs(state.iconStyle, mode, true);
    });
  });
  const brandLogoBtn = document.getElementById('brandLogoBtn');
  if (brandLogoBtn) {
    brandLogoBtn.addEventListener('click', () => {
      openAppSettingsModal('appearance').then(() => {
        document.getElementById('appIconPickerSection')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });
  }
  document.getElementById('btnOpenLogsFromSettings').addEventListener('click', () => {
    openLogsModal();
  });
  document.getElementById('btnRestoreHistoryBackup').addEventListener('click', async () => {
    try {
      await rpc('history:restoreBackup');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
  document.getElementById('cfgAiProvider').addEventListener('change', () => {
    // A format chosen for one provider rarely fits another
    document.getElementById('cfgAiApiFormat').value = '';
    document.getElementById('cfgAiEndpointPath').value = '';
    syncAiProviderFields();
  });
  ['cfgAiModel', 'cfgAiBaseUrl', 'cfgAiApiFormat', 'cfgAiEndpointPath', 'cfgAiThinking', 'cfgAiTemperature', 'cfgAiMaxTokens', 'cfgAiTimeout', 'cfgAiStream', 'cfgAiExtraBody', 'cfgAiExtraHeaders'].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener('input', syncAiRequestFields);
    el.addEventListener('change', syncAiRequestFields);
  });
  document.getElementById('btnTestAi').addEventListener('click', async () => {
    const btn = document.getElementById('btnTestAi');
    btn.disabled = true;
    showAiTestResult(tr('aiTesting'), 'pending');
    try {
      await saveAppSettings(false);
      const res = await rpc('ai:test');
      if (res.ok) {
        let text = tr('aiTestOk', res.ms, AI_FORMAT_LABELS[res.format] || res.format, res.text || '(…)');
        if (res.fellBack) text += '\n' + tr('aiTestFellBack', AI_FORMAT_LABELS[res.format] || res.format);
        showAiTestResult(text, 'ok');
      } else {
        showAiTestResult(tr('aiTestFailed', res.error || ''), 'error');
      }
    } catch (err) {
      showAiTestResult(tr('aiTestFailed', err.message), 'error');
    } finally {
      btn.disabled = false;
    }
  });
  document.getElementById('cfgTerminalApp').addEventListener('change', syncLauncherCustomRows);
  document.getElementById('cfgEditorApp').addEventListener('change', syncLauncherCustomRows);
  document.getElementById('btnRedetectApps').addEventListener('click', () => loadLaunchers(true).catch((err) => showToast(err.message, 'error')));
  document.getElementById('btnClearAiKey').addEventListener('click', async () => {
    try {
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

  /* ==================== Working Tree Stage & Commit Modal (#scmModal) ==================== */
  let scmDraftMsg = '';
  let scmSessionSeq = 0;
  async function openScmModal(draftMessage) {
    if (!state.activeRepo) {
      showToast(tr('noActiveRepo'), 'warning');
      return;
    }
    const myScmSeq = ++scmSessionSeq;
    let scmOpSeq = 0;
    if (typeof draftMessage === 'string' && draftMessage.trim()) {
      scmDraftMsg = draftMessage;
    }
    const modal = document.getElementById('scmModal');
    const bodyEl = document.getElementById('scmModalBody');
    const branchBadge = document.getElementById('scmBranchBadge');
    const zh = state.lang === 'zh';
    modal.classList.remove('hidden');
    bodyEl.innerHTML = `<div class="browser-empty-state"><span class="fb-spinner"></span>${escapeHtml(zh ? '正在读取工作区状态…' : 'Loading working tree status…')}</div>`;

    const runScmRpc = async (method, params) => {
      const opId = ++scmOpSeq;
      const res = await rpc(method, params);
      if (myScmSeq === scmSessionSeq && opId === scmOpSeq && !modal.classList.contains('hidden')) {
        renderScmState(res);
      }
      return res;
    };

    const renderScmState = (st) => {
      if (myScmSeq !== scmSessionSeq) return;
      branchBadge.textContent = st.branch || 'HEAD';
      if (st.error) {
        bodyEl.innerHTML = `<div class="browser-empty-state error-text">${escapeHtml(st.error)}</div>`;
        return;
      }
      const prevScrolls = Array.from(bodyEl.querySelectorAll('.scm-group-list')).map((el) => el.scrollTop);
      const existingTextarea = bodyEl.querySelector('.scm-commit-textarea');
      const existingAmend = bodyEl.querySelector('.scm-amend-chk');
      const currentMsg = existingTextarea ? existingTextarea.value : scmDraftMsg;
      const isAmend = existingAmend ? existingAmend.checked : false;

      const buildFileRow = (f, kind) => {
        const displayPath = f.oldPath ? `${f.oldPath} → ${f.path}` : f.path;
        const canHunk = (kind === 'staged' || (kind === 'unstaged' && f.status !== 'U' && f.status !== '?'));
        return `<div class="scm-file-row" data-path="${escapeHtml(f.path)}" data-old="${escapeHtml(f.oldPath || '')}" data-status="${escapeHtml(f.status)}" data-kind="${kind}">
          <span class="scm-status-badge st-${escapeHtml(f.status[0] || 'M')}">${escapeHtml(f.status)}</span>
          <span class="scm-file-path" title="${escapeHtml(displayPath)}">${escapeHtml(displayPath)}</span>
          ${kind === 'conflict'
            ? `<button type="button" class="mini-btn primary act-scm-resolve">${ICONS.merge}<span>${escapeHtml(zh ? '三路解冲突' : 'Resolve 3-Way')}</span></button>`
            : ''}
          ${canHunk
            ? `<button type="button" class="mini-btn act-scm-hunks" title="${escapeHtml(zh ? '按代码块 / 代码行部分暂存或丢弃' : 'Stage / unstage / discard individual hunks or lines')}">${escapeHtml(zh ? '代码块' : 'Hunks')}</button>`
            : ''}
          ${kind === 'staged'
            ? `<button type="button" class="mini-btn act-scm-unstage">${escapeHtml(zh ? '取消暂存' : 'Unstage')}</button>`
            : kind === 'unstaged'
              ? `<button type="button" class="mini-btn danger act-scm-discard" title="${escapeHtml(zh ? '丢弃此文件更改' : 'Discard changes')}">${ICONS.undo}</button>
                 <button type="button" class="mini-btn act-scm-stage">${escapeHtml(zh ? '暂存' : 'Stage')}</button>`
              : ''}
        </div>`;
      };

      bodyEl.innerHTML = `
        ${st.conflicted && st.conflicted.length > 0 ? `
          <div class="scm-group">
            <div class="scm-group-head">
              <span class="error-text">${escapeHtml(zh ? `合并冲突 (${st.conflicted.length})` : `Merge Conflicts (${st.conflicted.length})`)}</span>
            </div>
            <div class="scm-group-list">${st.conflicted.map((f) => buildFileRow(f, 'conflict')).join('')}</div>
          </div>
        ` : ''}
        <div class="scm-group">
          <div class="scm-group-head">
            <span>${escapeHtml(zh ? `已暂存的更改 (${st.staged.length})` : `Staged Changes (${st.staged.length})`)}</span>
            ${st.staged.length > 0 ? `<button type="button" class="mini-btn act-scm-unstage-all">${escapeHtml(zh ? '全部取消暂存' : 'Unstage All')}</button>` : ''}
          </div>
          <div class="scm-group-list">
            ${st.staged.length > 0 ? st.staged.map((f) => buildFileRow(f, 'staged')).join('') : `<div class="scm-empty">${escapeHtml(zh ? '暂无已暂存更改' : 'No staged changes')}</div>`}
          </div>
        </div>
        <div class="scm-group">
          <div class="scm-group-head">
            <span>${escapeHtml(zh ? `工作区更改 (${st.unstaged.length})` : `Working Tree Changes (${st.unstaged.length})`)}</span>
            ${st.unstaged.length > 0 ? `<span style="display:inline-flex;gap:6px;"><button type="button" class="mini-btn danger act-scm-discard-all">${escapeHtml(zh ? '全部丢弃' : 'Discard All')}</button><button type="button" class="mini-btn act-scm-stage-all">${escapeHtml(zh ? '全部暂存' : 'Stage All')}</button></span>` : ''}
          </div>
          <div class="scm-group-list">
            ${st.unstaged.length > 0 ? st.unstaged.map((f) => buildFileRow(f, 'unstaged')).join('') : `<div class="scm-empty">${escapeHtml(zh ? '工作区干净' : 'Working tree clean')}</div>`}
          </div>
        </div>
        <div class="scm-commit-box">
          <textarea class="scm-commit-textarea" placeholder="${escapeHtml(zh ? '输入提交说明 (Cmd/Ctrl+Enter 提交)…' : 'Commit message (Cmd/Ctrl+Enter to commit)…')}">${escapeHtml(currentMsg)}</textarea>
          <div class="scm-commit-footer">
            <label class="inline-check"><input type="checkbox" class="scm-amend-chk" ${isAmend ? 'checked' : ''} /> <span>${escapeHtml(zh ? '修正上一次提交 (--amend)' : 'Amend previous commit (--amend)')}</span></label>
            <div style="display:flex;gap:8px;align-items:center;">
              <button type="button" class="mini-btn act-scm-ai-review" ${(st.staged.length === 0 && st.unstaged.length === 0) ? 'disabled' : ''}>${ICONS.shield}<span>${escapeHtml(zh ? 'AI 审查' : 'AI Review')}</span></button>
              <button type="button" class="mini-btn act-scm-refresh" title="Refresh">${ICONS.refresh}</button>
              <button type="button" class="mini-btn primary act-scm-commit" ${(st.staged.length === 0 && !isAmend) ? 'disabled' : ''}>${ICONS.commit}<span>${escapeHtml(zh ? '提交已暂存更改' : 'Commit Staged')}</span></button>
            </div>
          </div>
        </div>
      `;

      const textarea = bodyEl.querySelector('.scm-commit-textarea');
      const amendChk = bodyEl.querySelector('.scm-amend-chk');
      const commitBtn = bodyEl.querySelector('.act-scm-commit');
      textarea.addEventListener('input', () => {
        scmDraftMsg = textarea.value;
      });
      amendChk.addEventListener('change', () => {
        if (amendChk.checked && !textarea.value.trim() && st.headSubject) {
          textarea.value = st.headSubject;
          scmDraftMsg = textarea.value;
        }
        commitBtn.disabled = st.staged.length === 0 && !amendChk.checked;
      });

      const runCommit = async () => {
        const msg = textarea.value.trim();
        if (!msg) {
          showToast(zh ? '请填写提交说明' : 'Enter a commit message first.', 'warning');
          textarea.focus();
          return;
        }
        commitBtn.disabled = true;
        try {
          const next = await rpc('scm:commit', { repo: state.activeRepo, message: msg, amend: amendChk.checked });
          scmDraftMsg = '';
          showToast(zh ? '提交成功' : 'Committed successfully', 'info');
          if (next.staged.length === 0 && next.unstaged.length === 0) {
            modal.classList.add('hidden');
            activateTab('graph');
          } else {
            renderScmState(next);
          }
        } catch (err) {
          showToast(err.message, 'error');
          commitBtn.disabled = false;
        }
      };

      commitBtn.addEventListener('click', runCommit);
      textarea.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault();
          runCommit();
        }
      });

      bodyEl.querySelector('.act-scm-refresh').addEventListener('click', async () => {
        try {
          await runScmRpc('scm:status', { repo: state.activeRepo });
        } catch (err) {
          showToast(err.message, 'error');
        }
      });

      const stageAllBtn = bodyEl.querySelector('.act-scm-stage-all');
      if (stageAllBtn) {
        stageAllBtn.addEventListener('click', async () => {
          try {
            await runScmRpc('scm:stage', { repo: state.activeRepo, all: true });
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      }

      const unstageAllBtn = bodyEl.querySelector('.act-scm-unstage-all');
      if (unstageAllBtn) {
        unstageAllBtn.addEventListener('click', async () => {
          try {
            await runScmRpc('scm:unstage', { repo: state.activeRepo, all: true });
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      }

      const discardAllBtn = bodyEl.querySelector('.act-scm-discard-all');
      if (discardAllBtn) {
        discardAllBtn.addEventListener('click', async () => {
          const ok = await confirmDialog(
            zh ? '丢弃全部工作区更改' : 'Discard All Working Tree Changes',
            discardConfirmText(zh ? `确定丢弃全部 ${st.unstaged.length} 项未暂存更改（含未跟踪的新文件）？` : `Discard all ${st.unstaged.length} unstaged changes (including untracked files)?`),
            zh ? '全部丢弃' : 'Discard All',
            true
          );
          if (!ok) return;
          try {
            renderScmState(await rpc('scm:discard', { repo: state.activeRepo, files: st.unstaged.map((x) => ({ path: x.path, status: x.status })) }));
            window.GitMapFeatures?.refreshAllStatusesAndContext();
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      }

      const aiReviewBtn = bodyEl.querySelector('.act-scm-ai-review');
      if (aiReviewBtn) {
        aiReviewBtn.addEventListener('click', () => {
          window.GitMapFeatures?.openAiCodeReviewModal(state.activeRepo, st.staged.length > 0 ? 'staged' : 'all');
        });
      }

      bodyEl.querySelectorAll('.scm-file-row').forEach((row) => {
        const filePath = row.getAttribute('data-path');
        const oldPath = row.getAttribute('data-old') || filePath;
        const stCode = row.getAttribute('data-status') || 'M';
        const rowKind = row.getAttribute('data-kind');
        row.querySelector('.scm-file-path').addEventListener('click', () => {
          modal.classList.add('hidden');
          if (rowKind === 'conflict') {
            window.GitMapFeatures?.openConflictResolverTab(state.activeRepo, filePath);
            return;
          }
          openDiffTab({
            repo: state.activeRepo,
            fromHash: 'HEAD',
            toHash: '*',
            oldFilePath: oldPath,
            newFilePath: filePath,
            type: stCode === 'U' ? 'A' : stCode[0],
            title: filePath.split('/').pop() + ' (Working Tree)'
          });
        });
        const resolveBtn = row.querySelector('.act-scm-resolve');
        if (resolveBtn) {
          resolveBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
            window.GitMapFeatures?.openConflictResolverTab(state.activeRepo, filePath);
          });
        }
        const hunksBtn = row.querySelector('.act-scm-hunks');
        if (hunksBtn) {
          hunksBtn.addEventListener('click', () => {
            window.GitMapFeatures?.openHunkStagingModal(state.activeRepo, filePath, rowKind === 'staged', async () => {
              renderScmState(await rpc('scm:status', { repo: state.activeRepo }));
              window.GitMapFeatures?.refreshAllStatusesAndContext();
            });
          });
        }
        const discardBtn = row.querySelector('.act-scm-discard');
        if (discardBtn) {
          discardBtn.addEventListener('click', async () => {
            const ok = await confirmDialog(
              zh ? '丢弃文件更改' : 'Discard File Changes',
              discardConfirmText(zh ? `确定丢弃 "${filePath}" 的未暂存更改？` : `Discard unstaged changes in "${filePath}"?`),
              zh ? '丢弃' : 'Discard',
              true
            );
            if (!ok) return;
            try {
              renderScmState(await rpc('scm:discard', { repo: state.activeRepo, files: [{ path: filePath, status: stCode }] }));
              window.GitMapFeatures?.refreshAllStatusesAndContext();
            } catch (err) {
              showToast(err.message, 'error');
            }
          });
        }
        const stageBtn = row.querySelector('.act-scm-stage');
        if (stageBtn) {
          stageBtn.addEventListener('click', async () => {
            try {
              await runScmRpc('scm:stage', { repo: state.activeRepo, paths: [filePath] });
            } catch (err) {
              showToast(err.message, 'error');
            }
          });
        }
        const unstageBtn = row.querySelector('.act-scm-unstage');
        if (unstageBtn) {
          unstageBtn.addEventListener('click', async () => {
            try {
              await runScmRpc('scm:unstage', { repo: state.activeRepo, paths: [filePath] });
            } catch (err) {
              showToast(err.message, 'error');
            }
          });
        }
      });

      bodyEl.querySelectorAll('.scm-group-list').forEach((el, idx) => {
        if (typeof prevScrolls[idx] === 'number') el.scrollTop = prevScrolls[idx];
      });
      setTimeout(() => textarea.focus(), 20);
    };

    try {
      await runScmRpc('scm:status', { repo: state.activeRepo });
    } catch (err) {
      if (myScmSeq === scmSessionSeq) {
        bodyEl.innerHTML = `<div class="browser-empty-state error-text">${escapeHtml(err.message)}</div>`;
      }
    }
  }

  /* ==================== Clone Repository & Diagnostic Logs Modals ==================== */
  function openCloneModal() {
    const zh = state.lang === 'zh';
    const modal = document.getElementById('clientDialogModal');
    beginClientDialogSession(() => modal.classList.add('hidden'));
    document.getElementById('clientDialogTitle').textContent = zh ? '克隆 Git 仓库' : 'Clone Git Repository';
    const bodyEl = document.getElementById('clientDialogBody');
    const footerEl = document.getElementById('clientDialogFooter');
    const hosts = (state.sshHosts || []).filter((h) => !isGitHostingHost(h));
    bodyEl.innerHTML = `
      <label><span>${escapeHtml(zh ? '仓库地址 (HTTPS / SSH URL)' : 'Repository URL (HTTPS / SSH)')}</span>
        <input type="text" id="cloneRepoUrl" spellcheck="false" placeholder="https://github.com/org/repo.git" /></label>
      <label><span>${escapeHtml(zh ? '克隆目标位置' : 'Clone Target')}</span>
        <select id="cloneTargetHost">
          <option value="">${escapeHtml(zh ? '本机 (Local)' : 'This Computer (Local)')}</option>
          ${hosts.map((h) => `<option value="${escapeHtml(h.id)}">SSH: ${escapeHtml(hostLabel(h.id))} (${escapeHtml(hostAddress(h))})</option>`).join('')}
        </select></label>
      <label><span>${escapeHtml(zh ? '父目录路径' : 'Parent Directory')}</span>
        <span class="input-with-btn">
          <input type="text" id="cloneParentDir" class="path-input" spellcheck="false" value="${escapeHtml(state.homeDir)}" />
          ${desktopApi && desktopApi.pickLocalFolder ? `<button type="button" id="btnBrowseCloneDir" class="mini-btn">…</button>` : ''}
        </span></label>
      <label><span>${escapeHtml(zh ? '文件夹名称（可选，留空自动使用仓库名）' : 'Folder Name (optional)')}</span>
        <input type="text" id="cloneFolderName" spellcheck="false" placeholder="repo" /></label>
    `;
    footerEl.innerHTML = `
      <button type="button" class="mini-btn act-cancel">${escapeHtml(tr('cancel'))}</button>
      <button type="button" class="mini-btn primary act-ok">${escapeHtml(zh ? '克隆并打开' : 'Clone & Open')}</button>
    `;
    modal.classList.remove('hidden');

    const close = () => {
      activeClientDialogDismiss = null;
      modal.classList.add('hidden');
    };
    const hostSel = document.getElementById('cloneTargetHost');
    const dirInput = document.getElementById('cloneParentDir');
    const browseBtn = document.getElementById('btnBrowseCloneDir');
    hostSel.addEventListener('change', () => {
      const hid = hostSel.value;
      if (browseBtn) browseBtn.classList.toggle('hidden', !!hid);
      dirInput.value = hid ? (findHost(hid)?.defaultPath || '~') : state.homeDir;
    });
    if (browseBtn) {
      browseBtn.addEventListener('click', async () => {
        const picked = await desktopApi.pickLocalFolder();
        if (picked) dirInput.value = picked;
      });
    }
    const okBtn = footerEl.querySelector('.act-ok');
    okBtn.onclick = async () => {
      const url = document.getElementById('cloneRepoUrl').value.trim();
      const targetDir = dirInput.value.trim();
      const hostId = hostSel.value;
      const folderName = document.getElementById('cloneFolderName').value.trim();
      if (!url) {
        showToast(zh ? '请输入仓库克隆地址' : 'Enter a repository URL.', 'warning');
        return;
      }
      okBtn.disabled = true;
      okBtn.textContent = zh ? '正在克隆…' : 'Cloning…';
      try {
        const res = await rpc('git:clone', { url, targetDir, hostId: hostId || undefined, folderName: folderName || undefined });
        state.repos = res.repos || state.repos;
        state.activeRepo = res.root;
        renderSidebar();
        renderActiveRepoBadge();
        close();
        activateTab('graph');
        showToast(zh ? '克隆完成' : 'Repository cloned', 'info');
      } catch (err) {
        showToast(err.message, 'error');
        okBtn.disabled = false;
        okBtn.textContent = zh ? '克隆并打开' : 'Clone & Open';
      }
    };
    footerEl.querySelector('.act-cancel').onclick = close;
    document.getElementById('clientDialogCloseBtn').onclick = close;
    setTimeout(() => document.getElementById('cloneRepoUrl').focus(), 30);
  }

  async function openLogsModal() {
    const zh = state.lang === 'zh';
    const modal = document.getElementById('clientDialogModal');
    let cancelled = false;
    beginClientDialogSession(() => {
      cancelled = true;
      modal.classList.add('hidden');
    });
    document.getElementById('clientDialogTitle').textContent = tr('viewLogs');
    const bodyEl = document.getElementById('clientDialogBody');
    const footerEl = document.getElementById('clientDialogFooter');
    bodyEl.innerHTML = `<div class="browser-empty-state"><span class="fb-spinner"></span>Loading…</div>`;
    footerEl.innerHTML = `<button type="button" class="mini-btn act-copy">${ICONS.copy}<span>${escapeHtml(zh ? '复制全部' : 'Copy All')}</span></button><button type="button" class="mini-btn primary act-close">${escapeHtml(tr('close'))}</button>`;
    modal.classList.remove('hidden');
    const close = () => {
      cancelled = true;
      activeClientDialogDismiss = null;
      modal.classList.add('hidden');
    };
    footerEl.querySelector('.act-close').onclick = close;
    document.getElementById('clientDialogCloseBtn').onclick = close;
    try {
      const res = await rpc('logs:get');
      if (cancelled || modal.classList.contains('hidden')) return;
      const text = (res.logs || []).join('\n') || (zh ? '暂无日志记录。' : 'No diagnostic logs recorded yet.');
      bodyEl.innerHTML = `<pre class="logs-pre">${escapeHtml(text)}</pre>`;
      const pre = bodyEl.querySelector('.logs-pre');
      pre.scrollTop = pre.scrollHeight;
      footerEl.querySelector('.act-copy').onclick = () => {
        navigator.clipboard?.writeText(text).catch(() => {});
        showToast(zh ? '已复制诊断日志' : 'Diagnostic logs copied', 'status');
      };
    } catch (err) {
      bodyEl.innerHTML = `<div class="browser-empty-state error-text">${escapeHtml(err.message)}</div>`;
    }
  }

  /* ==================== Host Prompt Handler (FIFO Queued Server RPC Prompts) ==================== */
  const hostPromptQueue = [];
  let hostPromptActive = false;

  function handleHostPrompt(promptId, kind, req) {
    hostPromptQueue.push({ promptId, kind, req });
    if (!hostPromptActive) showNextHostPrompt();
  }

  function showNextHostPrompt() {
    if (hostPromptQueue.length === 0) {
      hostPromptActive = false;
      return;
    }
    hostPromptActive = true;
    const { promptId, kind, req } = hostPromptQueue.shift();
    const modal = document.getElementById('promptModal');
    const titleEl = document.getElementById('promptTitle');
    const bodyEl = document.getElementById('promptBody');
    const footerEl = document.getElementById('promptFooter');
    modal.classList.remove('hidden');

    let settled = false;
    const respond = (val) => {
      if (settled) return;
      settled = true;
      modal.classList.add('hidden');
      bodyEl.innerHTML = '';
      footerEl.innerHTML = '';
      sendWs({ type: 'ui:promptResponse', promptId, value: val });
      showNextHostPrompt();
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
        if (e.key === 'Enter') {
          e.preventDefault();
          respond(input.value);
        } else if (e.key === 'Escape') {
          e.stopPropagation();
          e.preventDefault();
          respond(undefined);
        }
      });
      footerEl.querySelector('.act-cancel').onclick = () => respond(undefined);
      footerEl.querySelector('.act-ok').onclick = () => respond(input.value);
    } else if (kind === 'quickPick') {
      titleEl.textContent = req.placeHolder || 'Select an option';
      bodyEl.innerHTML = `<div class="quickpick-list" tabindex="0"></div>`;
      const list = bodyEl.querySelector('.quickpick-list');
      const items = req.items || [];
      const selectedSet = new Set();
      let focusIdx = items.length > 0 ? 0 : -1;
      items.forEach((it, idx) => {
        if (it.picked) selectedSet.add(idx);
        const row = document.createElement('div');
        row.className = 'quickpick-item' + (it.picked || idx === 0 ? ' selected' : '');
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
      list.addEventListener('keydown', (e) => {
        if (items.length === 0) return;
        const rows = list.querySelectorAll('.quickpick-item');
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          focusIdx = e.key === 'ArrowDown' ? (focusIdx + 1) % items.length : (focusIdx - 1 + items.length) % items.length;
          if (!req.canPickMany) {
            rows.forEach((r, i) => r.classList.toggle('selected', i === focusIdx));
          }
          rows[focusIdx]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (req.canPickMany) respond(Array.from(selectedSet));
          else if (focusIdx >= 0) respond([focusIdx]);
        } else if (e.key === 'Escape') {
          e.stopPropagation();
          e.preventDefault();
          respond(undefined);
        }
      });
      footerEl.innerHTML = req.canPickMany
        ? `<button type="button" class="mini-btn act-cancel">${escapeHtml(tr('cancel'))}</button><button type="button" class="mini-btn primary act-ok">OK</button>`
        : `<button type="button" class="mini-btn act-cancel">${escapeHtml(tr('cancel'))}</button>`;
      footerEl.querySelector('.act-cancel').onclick = () => respond(undefined);
      const okBtn = footerEl.querySelector('.act-ok');
      if (okBtn) okBtn.onclick = () => respond(Array.from(selectedSet));
      setTimeout(() => list.focus(), 30);
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
      setTimeout(() => {
        const primary = footerEl.querySelector('.mini-btn.primary') || footerEl.querySelector('.act-cancel');
        primary?.focus();
      }, 30);
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
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          footerEl.querySelector('.act-ok').click();
        } else if (e.key === 'Escape') {
          e.stopPropagation();
          e.preventDefault();
          respond(undefined);
        }
      });
      footerEl.querySelector('.act-cancel').onclick = () => respond(undefined);
      footerEl.querySelector('.act-ok').onclick = () => {
        const v = input.value.trim();
        if (!v) return respond(undefined);
        respond(isSave ? v : [v]);
      };
      setTimeout(() => input.focus(), 30);
    }
  }

  /* ==================== Event Bindings ==================== */
  document.getElementById('toggleSidebarBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
  });
  document.getElementById('btnAddLocal').addEventListener('click', () => openLocalModal());
  document.getElementById('sidebarAddLocalBtn').addEventListener('click', () => openLocalModal());
  document.getElementById('sidebarCloneBtn').addEventListener('click', () => openCloneModal());
  document.getElementById('btnConnectSsh').addEventListener('click', () => openSshModal());
  document.getElementById('sidebarAddRemoteBtn').addEventListener('click', () => openSshModal());
  document.getElementById('sidebarRefreshSshBtn').addEventListener('click', () => openSshModal().then(() => openHostForm(null)));
  document.getElementById('btnOpenRepoFiles').addEventListener('click', () => openRepoFilesTab(false));
  document.getElementById('btnOpenScm').addEventListener('click', () => openScmModal());
  document.getElementById('btnToggleTerminal').addEventListener('click', () => toggleTerminalDrawer());
  document.getElementById('btnCloseTermDrawer').addEventListener('click', () => toggleTerminalDrawer(false));
  document.getElementById('btnNewRepoTerm').addEventListener('click', () => {
    openTerminalSession(state.activeRepo || state.homeDir, undefined, null);
  });
  document.getElementById('btnOpenSysTerm').addEventListener('click', () => {
    openExternalTerminal(state.activeRepo || state.homeDir).catch((err) => showToast(err.message, 'error'));
  });
  document.getElementById('btnAppSettings').addEventListener('click', () => openAppSettingsModal());

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
  document.getElementById('sshFormAuth').addEventListener('change', syncSshAuthFields);
  document.getElementById('btnBrowseSshKey').addEventListener('click', async () => {
    if (!desktopApi || !desktopApi.pickLocalFile) return;
    const picked = await desktopApi.pickLocalFile();
    if (picked) document.getElementById('sshFormKey').value = picked;
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

  // Sidebar search, collapsible sections & resizing
  const sidebarSearch = document.getElementById('sidebarSearch');
  sidebarSearch.addEventListener('input', () => {
    state.sidebarQuery = sidebarSearch.value;
    renderSidebar();
  });
  sidebarSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebarSearch.value) {
      e.stopPropagation();
      e.preventDefault();
      sidebarSearch.value = '';
      state.sidebarQuery = '';
      renderSidebar();
    } else if (e.key === 'Enter') {
      const first = document.querySelector('#sidebar .repo-item');
      if (first) first.click();
    }
  });
  document.getElementById('sidebarSearchKbd').textContent = navigator.platform.toLowerCase().includes('mac') ? '⌘K' : 'Ctrl K';
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const sidebar = document.getElementById('sidebar');
      sidebar.classList.remove('collapsed');
      sidebarSearch.focus();
      sidebarSearch.select();
    } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'g') {
      e.preventDefault();
      openScmModal();
    } else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      openRepoFilesTab(false);
    } else if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key === '\\') {
      e.preventDefault();
      if (e.shiftKey) {
        setWorkspaceLayout(state.wsLayout === 'split-tb' ? 'tabs' : 'split-tb');
      } else {
        setWorkspaceLayout(state.wsLayout === 'tabs' ? 'split-lr' : 'tabs');
      }
    } else if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      window.GitMapFeatures?.openCommandPalette();
    }
  });

  // Workspace Split Layout Controls, Tab Drag-and-Drop & Drop-Zone Split
  document.querySelectorAll('#wsLayoutControls .ws-layout-btn[data-ws-layout]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-ws-layout');
      if (target === 'tabs' || target === 'split-lr' || target === 'split-tb') {
        if (state.wsLayout !== target) setWorkspaceLayout(target);
      }
    });
  });
  document.getElementById('btnSwapSplitPanes')?.addEventListener('click', () => swapWorkspaceSplitPanes());

  // Delegated pane focus, header buttons, right-click menu & drag-from-header on #coreSplitStage
  const coreStageEl = document.getElementById('coreSplitStage');
  if (coreStageEl) {
    coreStageEl.addEventListener('mousedown', (e) => {
      if (!isSplitWorkspace()) return;
      const paneEl = e.target.closest('.core-split-stage > .tab-panel');
      if (!paneEl) return;
      const nextFocus = paneEl.classList.contains('pane-primary') ? 'primary' : (paneEl.classList.contains('pane-secondary') ? 'secondary' : null);
      if (nextFocus && state.focusedPane !== nextFocus) {
        state.focusedPane = nextFocus;
        state.activeTabId = nextFocus === 'primary' ? state.primaryPaneTabId : state.secondaryPaneTabId;
        syncWorkspacePanels();
      }
    });
    coreStageEl.addEventListener('click', (e) => {
      const swapBtn = e.target.closest('.split-pane-header .act-swap-panes');
      if (swapBtn) {
        e.stopPropagation();
        swapWorkspaceSplitPanes();
        return;
      }
      const maxBtn = e.target.closest('.split-pane-header .act-max-pane');
      if (maxBtn) {
        e.stopPropagation();
        const tabId = maxBtn.getAttribute('data-tab') || maxBtn.closest('.tab-panel')?.getAttribute('data-tab-id') || 'graph';
        setWorkspaceLayout('tabs', tabId);
      }
    });
    coreStageEl.addEventListener('contextmenu', (e) => {
      const hdr = e.target.closest('.split-pane-header');
      if (!hdr) return;
      e.preventDefault();
      e.stopPropagation();
      const tabId = hdr.getAttribute('data-pane-tab') || hdr.closest('.tab-panel')?.getAttribute('data-tab-id') || 'graph';
      openTabContextMenu(tabId, e.clientX, e.clientY);
    });
    coreStageEl.addEventListener('dragstart', (e) => {
      const hdr = e.target.closest('.split-pane-header');
      if (!hdr || e.target.closest('button')) return;
      const tabId = hdr.getAttribute('data-pane-tab') || hdr.closest('.tab-panel')?.getAttribute('data-tab-id');
      if (!tabId) return;
      hideTabContextMenu();
      activeDraggedTabId = tabId;
      pointerMachine?.send('START_TAB_DRAG', undefined, { tabId });
      document.body.classList.add('dragging-ws-tab');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        try {
          e.dataTransfer.setData('text/plain', tabId);
        } catch (_) {}
      }
    });
    coreStageEl.addEventListener('dragend', () => {
      activeDraggedTabId = null;
      pointerMachine?.send('END');
      document.body.classList.remove('dragging-ws-tab');
      document.getElementById('wsDropOverlay')?.classList.add('hidden');
    });
  }

  // Tab Bar Drag-and-Drop Reordering
  (function setupTabBarAndWorkspaceDrop() {
    const tabBarEl = document.getElementById('tabBar');
    const tabPanelsEl = document.getElementById('tabPanels');
    const dropOverlayEl = document.getElementById('wsDropOverlay');
    const dropLabelEl = dropOverlayEl ? dropOverlayEl.querySelector('.ws-drop-label') : null;
    if (!tabBarEl || !tabPanelsEl || !dropOverlayEl) return;

    const clearTabDropClasses = () => {
      tabBarEl.querySelectorAll('.ws-tab').forEach((el) => el.classList.remove('drop-before', 'drop-after'));
    };

    tabBarEl.addEventListener('dragover', (e) => {
      if (!activeDraggedTabId) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      dropOverlayEl.classList.add('hidden');
      clearTabDropClasses();
      const hovered = e.target.closest('.ws-tab');
      if (!hovered) {
        const last = tabBarEl.querySelector('.ws-tab:last-child');
        if (last && last.getAttribute('data-tab-id') !== activeDraggedTabId) {
          last.classList.add('drop-after');
        }
        return;
      }
      const targetId = hovered.getAttribute('data-tab-id');
      if (!targetId || targetId === activeDraggedTabId) return;
      const rect = hovered.getBoundingClientRect();
      const after = e.clientX > rect.left + rect.width / 2;
      hovered.classList.add(after ? 'drop-after' : 'drop-before');
    });

    tabBarEl.addEventListener('dragleave', (e) => {
      if (!e.relatedTarget || !tabBarEl.contains(e.relatedTarget)) {
        clearTabDropClasses();
      }
    });

    tabBarEl.addEventListener('drop', (e) => {
      if (!activeDraggedTabId) return;
      e.preventDefault();
      const draggedId = activeDraggedTabId;
      clearTabDropClasses();
      const hovered = e.target.closest('.ws-tab');
      if (hovered) {
        const targetId = hovered.getAttribute('data-tab-id');
        if (targetId && targetId !== draggedId) {
          const rect = hovered.getBoundingClientRect();
          const after = e.clientX > rect.left + rect.width / 2;
          moveTabOrder(draggedId, targetId, after);
        }
      } else {
        const last = tabBarEl.querySelector('.ws-tab:last-child');
        const lastId = last && last.getAttribute('data-tab-id');
        if (lastId && lastId !== draggedId) {
          moveTabOrder(draggedId, lastId, true);
        }
      }
    });

    const computeDropZone = (clientX, clientY) => {
      const rect = tabPanelsEl.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return 'center';
      const rx = (clientX - rect.left) / rect.width;
      const ry = (clientY - rect.top) / rect.height;
      if (rx < 0.28) return 'left';
      if (rx > 0.72) return 'right';
      if (ry < 0.24) return 'top';
      if (ry > 0.76) return 'bottom';
      return 'center';
    };

    const zoneText = (zone) => {
      const zh = state.lang === 'zh';
      const tTitle = tabDisplayTitle(tabById(activeDraggedTabId));
      if (zone === 'left') return zh ? `在左侧分栏显示「${tTitle}」` : `Show "${tTitle}" on Left`;
      if (zone === 'right') return zh ? `在右侧分栏显示「${tTitle}」` : `Show "${tTitle}" on Right`;
      if (zone === 'top') return zh ? `在上方分栏显示「${tTitle}」` : `Show "${tTitle}" on Top`;
      if (zone === 'bottom') return zh ? `在下方分栏显示「${tTitle}」` : `Show "${tTitle}" on Bottom`;
      return zh ? `单栏全屏显示「${tTitle}」` : `Show "${tTitle}" Full Pane`;
    };

    tabPanelsEl.addEventListener('dragover', (e) => {
      if (!activeDraggedTabId) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      clearTabDropClasses();
      const zone = computeDropZone(e.clientX, e.clientY);
      dropOverlayEl.classList.remove('hidden', 'zone-left', 'zone-right', 'zone-top', 'zone-bottom', 'zone-center');
      dropOverlayEl.classList.add('zone-' + zone);
      if (dropLabelEl) dropLabelEl.textContent = zoneText(zone);
    });

    tabPanelsEl.addEventListener('dragleave', (e) => {
      if (!e.relatedTarget || !tabPanelsEl.contains(e.relatedTarget)) {
        dropOverlayEl.classList.add('hidden');
      }
    });

    pointerCleanups.add(() => {
      activeDraggedTabId = null;
      clearTabDropClasses();
      dropOverlayEl.classList.add('hidden');
    });

    tabPanelsEl.addEventListener('drop', (e) => {
      if (!activeDraggedTabId) return;
      e.preventDefault();
      const draggedId = activeDraggedTabId;
      activeDraggedTabId = null;
      pointerMachine?.send('END');
      document.body.classList.remove('dragging-ws-tab');
      dropOverlayEl.classList.add('hidden');
      const zone = computeDropZone(e.clientX, e.clientY);
      if (zone === 'center') {
        setWorkspaceLayout('tabs', draggedId);
      } else {
        placeTabInSplitPane(draggedId, zone);
      }
    });
  })();

  // Dismiss tab context menu on outside click or window blur
  document.addEventListener('mousedown', (e) => {
    const menu = document.getElementById('tabContextMenu');
    if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target)) {
      hideTabContextMenu();
    }
  });
  window.addEventListener('blur', hideTabContextMenu);

  (function setupWorkspaceSplitResize() {
    const stage = document.getElementById('coreSplitStage');
    const resizer = document.getElementById('workspaceSplitResizer');
    if (!stage || !resizer) return;
    let dragging = false;
    let axis = 'x';
    pointerCleanups.add(() => {
      dragging = false;
    });
    resizer.addEventListener('mousedown', (e) => {
      if (!isSplitWorkspace()) return;
      dragging = true;
      pointerMachine?.send('START_SPLIT_RESIZE');
      axis = state.wsLayout === 'split-tb' ? 'y' : 'x';
      document.body.classList.add(axis === 'y' ? 'resizing-y' : 'resizing-x');
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const rect = stage.getBoundingClientRect();
      let pct = state.wsSplitRatio;
      if (axis === 'x' && rect.width > 100) {
        pct = ((e.clientX - rect.left) / rect.width) * 100;
      } else if (axis === 'y' && rect.height > 100) {
        pct = ((e.clientY - rect.top) / rect.height) * 100;
      }
      state.wsSplitRatio = Math.max(20, Math.min(80, Math.round(pct * 10) / 10));
      stage.style.setProperty('--ws-split-primary', state.wsSplitRatio + '%');
    });
    window.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      pointerMachine?.send('END');
      document.body.classList.remove('resizing-x', 'resizing-y');
      persistWorkspaceLayout();
    });
    resizer.addEventListener('dblclick', () => {
      state.wsSplitRatio = 50;
      stage.style.setProperty('--ws-split-primary', '50%');
      persistWorkspaceLayout();
    });
  })();
  document.querySelectorAll('#sidebar .section-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.closest('.sidebar-section').getAttribute('data-section');
      if (state.collapsedSections.has(id)) state.collapsedSections.delete(id);
      else state.collapsedSections.add(id);
      saveUiSet('gitmap.sidebar.collapsedSections', state.collapsedSections);
      renderSidebar();
    });
  });
  (function setupSidebarResize() {
    const sidebar = document.getElementById('sidebar');
    const resizer = document.getElementById('sidebarResizer');
    try {
      const saved = Number(localStorage.getItem('gitmap.sidebar.width'));
      if (saved >= 200 && saved <= 520) sidebar.style.width = saved + 'px';
    } catch (_) {}
    let dragging = false;
    pointerCleanups.add(() => {
      dragging = false;
    });
    resizer.addEventListener('mousedown', (e) => {
      dragging = true;
      pointerMachine?.send('START_SIDEBAR_RESIZE');
      document.body.classList.add('resizing-x');
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const width = Math.max(200, Math.min(520, e.clientX - sidebar.getBoundingClientRect().left));
      sidebar.style.width = width + 'px';
    });
    window.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      pointerMachine?.send('END');
      document.body.classList.remove('resizing-x');
      try {
        localStorage.setItem('gitmap.sidebar.width', String(parseInt(sidebar.style.width, 10)));
      } catch (_) {}
    });
    resizer.addEventListener('dblclick', () => {
      sidebar.style.width = '';
      try {
        localStorage.removeItem('gitmap.sidebar.width');
      } catch (_) {}
    });
  })();

  function closeTopmostOverlay() {
    if (pointerMachine && !pointerMachine.is('idle')) {
      cancelActivePointerCapture('escape_key');
      return true;
    }
    const tabCtx = document.getElementById('tabContextMenu');
    if (tabCtx && !tabCtx.classList.contains('hidden')) {
      hideTabContextMenu();
      return true;
    }
    const cmdPalette = document.getElementById('commandPaletteModal');
    if (cmdPalette && !cmdPalette.classList.contains('hidden')) {
      cmdPalette.classList.add('hidden');
      return true;
    }
    const toolsPop = document.getElementById('toolsPopover');
    if (toolsPop && !toolsPop.classList.contains('hidden')) {
      toolsPop.classList.add('hidden');
      return true;
    }
    const prompt = document.getElementById('promptModal');
    if (!prompt.classList.contains('hidden')) {
      document.getElementById('promptCloseBtn').click();
      return true;
    }
    const clientDlg = document.getElementById('clientDialogModal');
    if (!clientDlg.classList.contains('hidden')) {
      document.getElementById('clientDialogCloseBtn').click();
      return true;
    }
    for (const id of ['featureModal', 'scmModal', 'appSettingsModal', 'sshModal', 'localModal']) {
      const el = document.getElementById(id);
      if (el && !el.classList.contains('hidden')) {
        el.classList.add('hidden');
        return true;
      }
    }
    if (!document.getElementById('transferPanel').classList.contains('hidden')) {
      showTransferPanel(false);
      return true;
    }
    return false;
  }

  // Escape closes the topmost dialog / panel
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    closeTopmostOverlay();
  });

  // Click on a modal's backdrop (outside the window) closes it
  document.querySelectorAll('#sshModal, #localModal, #appSettingsModal, #scmModal, #featureModal, #commandPaletteModal').forEach((backdrop) => {
    backdrop.addEventListener('mousedown', (e) => {
      if (e.target === backdrop) backdrop.classList.add('hidden');
    });
  });

  // Warn before window reload / close if any inline file editor has unsaved edits
  window.addEventListener('beforeunload', (e) => {
    if (document.querySelector('[data-editor-state="editingDirty"]')) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // Expose read-only DX / AX runtime inspector on window.__GITMAP_INSPECT__
  window.__GITMAP_INSPECT__ = {
    getStateSnapshot() {
      const modalIds = ['promptModal', 'clientDialogModal', 'featureModal', 'commandPaletteModal', 'scmModal', 'appSettingsModal', 'sshModal', 'localModal'];
      return {
        initLoaded: !!state.initLoaded,
        lang: state.lang,
        themePref: state.themePref,
        iconStyle: state.iconStyle,
        iconTheme: state.iconTheme,
        activeRepo: state.activeRepo,
        repoCount: Object.keys(state.repos || {}).length,
        wsState: wsMachine ? wsMachine.state : (ws && ws.readyState === WebSocket.OPEN ? 'ready' : 'disconnected'),
        pointerMode: pointerMachine ? pointerMachine.state : 'idle',
        wsLayout: state.wsLayout,
        wsSplitRatio: state.wsSplitRatio,
        activeTabId: state.activeTabId,
        primaryPaneTabId: state.primaryPaneTabId,
        secondaryPaneTabId: state.secondaryPaneTabId,
        focusedPane: state.focusedPane,
        tabs: state.tabs.map((t) => ({ id: t.id, title: tabDisplayTitle(t), closable: !!t.closable })),
        pendingRpcCount: pendingRpc.size,
        activeModals: modalIds.filter((id) => {
          const el = document.getElementById(id);
          return Boolean(el && !el.classList.contains('hidden'));
        }),
        dirtyEditors: document.querySelectorAll('[data-editor-state="editingDirty"]').length
      };
    },
    getPendingRpcs() {
      return Array.from(pendingRpc.entries()).map(([id, rec]) => ({
        reqId: id,
        method: rec.method,
        ageMs: Date.now() - rec.startedAt
      }));
    },
    getFsmInstances() {
      return fsmApi ? fsmApi.registry.listInstances() : [];
    },
    getFsmTrace(limit) {
      return fsmApi ? fsmApi.registry.getTrace(limit) : [];
    },
    fetchServerDiagnostics() {
      return rpc('system:diagnostics');
    }
  };

  // Expose shell API for modular feature controllers in /features.js
  window.GitMapApp = {
    state,
    ICONS,
    desktopApi,
    tr,
    escapeHtml,
    rpc,
    sendWs,
    showToast,
    confirmDialog,
    inputDialog,
    parseRepoDisplay,
    hostLabel,
    hostAddress,
    renderSidebar,
    renderActiveRepoBadge,
    hashTabKey,
    createOrReplacePanelTab,
    activateTab,
    closeTab,
    openDiffTab,
    openFileTab,
    openLocalModal,
    openSshModal,
    openCloneModal,
    openScmModal,
    openRepoFilesTab,
    setWorkspaceLayout,
    swapWorkspaceSplitPanes,
    placeTabInSplitPane,
    moveTabOrder,
    openAppSettingsModal,
    openLogsModal,
    openTerminalSession,
    openExternalTerminal,
    openInEditor,
    toggleTerminalDrawer,
    refreshGraphView,
    applyTheme,
    APP_ICON_STYLES,
    setAppIconPrefs
  };

  // Initialize UI
  document.querySelectorAll('[data-icon]').forEach((el) => {
    const name = el.getAttribute('data-icon');
    if (ICONS[name]) el.innerHTML = ICONS[name];
  });
  applyTheme(state.themePref);
  applyLanguageUI();
  activateTab(state.activeTabId);
  connectWs();
})();
