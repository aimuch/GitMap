# GitMap — 跨平台独立桌面应用 & Web 服务（含 Remote - SSH 远程仓库浏览）

基于 `vscode-git-map` 核心引擎构建的**独立跨平台 Git 可视化图谱与仓库管理应用**，同时支持：
1. **Electron 跨平台桌面客户端**（macOS `.dmg/.app`、Windows `.exe`、Linux `.AppImage/.deb`）
2. **本地 / 自托管 Web 服务模式**（直接在任意现代浏览器中打开使用）
3. **类 VS Code Remote - SSH 远程仓库路径浏览与操作**（自动解析 `~/.ssh/config`、支持密钥/Agent/密码/ProxyJump、可视化浏览远程目录树、自动识别 `.git` 仓库与当前分支、批量扫描远程子目录仓库、远程执行完整 Git 图谱操作与终端会话）

---

## 核心特性

### 1. Remote - SSH 远程仓库支持（类 VS Code Remote）
- **自动发现 `~/.ssh/config`**：自动解析本机 `~/.ssh/config` 及 `Include` 子配置中的所有主机、端口、用户名、`IdentityFile` 与 `ProxyJump` 跳板机配置，也可在界面中新增自定义 SSH 服务器。
- **远程目录路径可视化浏览器**：
  - 支持输入任意远程路径（如 `~/projects`、`/var/www`、`/srv`）快速跳转、面包屑导航、返回上级与显示隐藏目录。
  - **实时 Git 仓库识别**：浏览远程目录时自动检测哪些文件夹是 Git 仓库，并实时展示 `Git · <当前分支>` 徽章，一键打开远程仓库。
  - **子目录批量扫描**：支持一键扫描远程工作区多级子目录中的所有 Git 仓库并批量添加。
- **单连接多路复用**：基于持久化的 SSHv2 + SFTP 连接池执行远程 Git 命令与文件读写，无需在远程服务器预装额外 Agent（仅需远程装有 `git`）。

### 2. 100% 完整 Git Map 图谱能力
- 完整保留分支图谱、Minimap 缩略图、提交搜索、分支对比（Branch Compare）、分支清理（Branch Cleanup）、交互式变基（Interactive Rebase）、拣选（Cherry-pick）、储藏（Stash）、工作树（Worktree）、二分查找（Bisect）、补丁导出/应用（Patch）、操作撤销（Undo）等全部能力，且**本地仓库与远程 SSH 仓库均可一致使用**。
- 内置 **AI 提交解释（Explain Commit）与 AI 提交说明生成**，支持 DeepSeek、Qwen（通义千问）、Kimi、Doubao（豆包）、OpenAI、Ollama 与任意 OpenAI 兼容接口。

### 3. 完整内置独立视图（无需依赖 VS Code 编辑器）
- **内置 Diff 对比编辑器**：支持 **并排对比（Side-by-Side）** 与 **行内对比（Inline）** 切换、行内词级高亮、未变更代码折叠/展开、上下变更块跳转，以及多文件变更列表对比。
- **内置文件与版本查看器**：查看任意提交版本或工作区文件，内置 **Git Blame 逐行追溯**（点击可直接跳转到对应提交）与 **选中行历史（Line History）**。
- **内置可视化文件演进（Visual File History）**：按作者与时间轴可视化展示单文件的历史演进轨迹。
- **内置交互式终端 + 系统终端联动**：底部抽屉内置 `xterm.js` 交互式终端，本地仓库自动进入本地目录，**远程 SSH 仓库自动开启远程 PTY 终端并 `cd` 到远程仓库路径**；同时支持一键唤起系统原生终端。

---

## 快速开始

### 安装依赖与构建

```bash
npm install
npm run build
```

> 若国内网络下载 Electron 二进制较慢，可使用：
> `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install`

### 模式一：启动跨平台桌面端 App（Electron）

```bash
npm start
# 或已构建后直接启动：
npm run desktop
```

### 模式二：启动独立 Web 服务模式（浏览器访问）

```bash
# 构建并启动 Web 服务（默认 http://127.0.0.1:3847）
npm run dev:web

# 自定义端口、监听地址并自动打开浏览器，或直接传入初始本地/SSH仓库：
node dist/cli.js --web --port 4000 --open /path/to/repo ssh://my-server/home/ubuntu/repo
```

### 打包跨平台安装包（本地打包 & GitHub Actions 自动发布 Releases）

#### 1. 本地打包
项目内置了智能打包脚本 [scripts/package-app.js](./scripts/package-app.js)，在本地（非 GitHub Actions 环境）会自动使用国内高速镜像加速 Electron 与打包工具链下载，输出至 `release/` 目录：

```bash
npm run dist          # 打包当前系统对应的安装包
npm run dist:mac      # 打包当前架构 macOS (.dmg + .zip)
npm run dist:mac:all  # 同时打包 Apple Silicon (arm64) 与 Intel (x64) macOS 安装包
npm run dist:win      # 打包 Windows x64 (setup 安装版 .exe + portable 便携版 .exe)
npm run dist:linux    # 打包 Linux x64 (.AppImage + .deb)
npm run pack          # 仅生成免安装解包目录（调试打包产物用）
```

#### 2. GitHub Actions CI 自动打包发布到 Releases
仓库已配置好以下工作流：
- **日常测试 CI**（[.github/workflows/ci.yml](./.github/workflows/ci.yml)）：推送 `main`/`master` 或发起 PR 时自动编译并执行全部单元与 SSH 集成测试。
- **多端打包与 Release 发布**（[.github/workflows/release.yml](./.github/workflows/release.yml)）：
  - **自动发版**：推送以 `v` 开头的版本标签时自动构建 **macOS (`arm64` + `x64`)、Windows (`x64` Setup + Portable)、Linux (`x64` AppImage + deb)** 全平台安装包，并自动创建 GitHub Release 上传所有产物与变更说明：
    ```bash
    git tag v1.0.0
    git push origin v1.0.0
    ```
  - **手动触发**：也支持在 GitHub Actions 页面点击 **Run workflow** 手动触发全平台打包（填写 `tag_name` 则同步发布到 Releases，留空则仅生成 Actions 构建产物）。

### 运行自动化测试（含真实 SSHv2 + SFTP 回路集成测试）

```bash
npm test
```

---

## 目录结构

- `src/desktop/` — Electron 跨平台桌面主进程（`main.ts`）与安全预加载桥（`preload.ts`）
- `src/server/` — 双模式共享 HTTP + WebSocket 核心服务（`appServer.ts`）、内置 Diff 引擎（`diffService.ts`）、本地/SSH 终端管理（`terminalManager.ts`）
- `src/remote/` — `~/.ssh/config` 解析器（`sshConfigParser.ts`）、SSHv2/SFTP 连接池与远程目录路径浏览器（`sshManager.ts`）、统一本地/远程传输抽象（`repoTransport.ts`）
- `src/platform/` — 独立运行时平台适配层（`vscode.ts`、`hostBridge.ts`），持久化配置、状态与密钥存储于 `~/.gitmap/`（桌面端位于应用 `userData` 目录）
- `src/` & `web/` — Git Map 核心引擎与图谱前端组件
- `public/` — 独立应用外壳界面（本地/远程侧边栏、Remote-SSH 路径浏览器弹窗、并排/行内 Diff 视图、文件 Blame 视图、内置 xterm 终端、深浅色主题）
- `src/tests/` — 自动化单元与端到端 SSH 回路测试
