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

### 5. 远程文件管理与传输
- **路径浏览器**：面包屑 / 可编辑路径（`Tab` 补全、再按 `Tab` 循环候选、`⌘L` / `Ctrl+L` 编辑）、前进 / 后退历史、按名称 / 大小 / 修改时间排序、即时筛选、多选、键盘导航（↑↓ / Enter / Backspace），记住每台主机上次浏览的目录。
- **文件操作**：新建文件夹、重命名、删除（二次确认）、复制路径、在外部终端 / 编辑器中打开任意目录。
- **上传 / 下载**：文件与文件夹（桌面版支持拖拽上传），带进度条、速度与剩余时间；支持 **暂停（中断）/ 继续（断点续传）/ 取消（删除未完成文件）/ 重试 / 撤销（移入回收站）/ 恢复**。同名目标自动改名为 `name (1)`，绝不覆盖。

### 6. 外部终端与编辑器
- 设置 → 终端与编辑器：可选 Terminal、iTerm2、Ghostty、WezTerm、kitty、Alacritty、Warp、Windows Terminal、PowerShell、GNOME Terminal、Konsole 等，以及 VS Code、Cursor、Windsurf、VSCodium、Zed、Sublime Text、JetBrains IDE，或自定义命令（占位符 `{path}` `{host}` `{sshCommand}` `{sshUri}`）。
- 本地仓库在仓库目录打开；远程仓库通过 SSH 登录并 `cd` 到远程仓库路径（VS Code 系编辑器使用 Remote-SSH，Zed 使用 `ssh://`）。

### 7. AI 服务
- 支持 DeepSeek、Kimi、豆包、通义千问、OpenAI、Ollama、**Magpie（本地网关）**、**CC Switch（本地路由）** 与任意 OpenAI 兼容接口；API Key 在设置中保存，Magpie / CC Switch / Ollama 无需 Key。
- 设置 → AI → 接口与参数：
  - **接口格式**：OpenAI Chat Completions（`/chat/completions`）、OpenAI Responses（`/responses`）、Anthropic Messages（`/messages`）。CC Switch 默认用 Responses，其余默认用 Chat Completions。用默认格式时如果返回 404/405，会自动改试另一种 OpenAI 格式。
  - **接口路径**：可自定义路径，也可以直接填完整 URL。
  - 还可以设置思考 / 推理强度（默认 / 关闭 / 低 / 中 / 高，按服务商映射为 `reasoning_effort`、`reasoning.effort`、`enable_thinking`、`thinking` 等参数）、温度、最大输出 Tokens、超时、是否流式输出，以及额外请求参数 / 请求头（JSON）。
  - 设置页会实时显示**请求预览**，还有「保存并测试连接」按钮。

### 8. 安全
- 内置服务只接受来自 GitMap 页面本身的 WebSocket 连接（校验 Origin 与 Host），防止其它网页或 DNS 重绑定驱动终端与 SSH。

---

## 快速开始

### 安装依赖与编译源码

```bash
npm install
npm run build
```

> `npm run build` **只是把 TypeScript 编译到 `dist/`**（供 `npm run desktop` / `npm run web` 直接运行），**不会生成安装包**。要生成 `.dmg` / `.exe` / `.AppImage` 等安装包，请看下面的 [打包跨平台安装包](#打包跨平台安装包本地打包--github-actions-自动发布-releases)（`npm run dist*` 会先自动执行一次 `build`，无需手动先跑）。
>
> 若国内网络下载 Electron 二进制较慢，可使用：
> `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install`

| 命令 | 作用 | 产物 |
| --- | --- | --- |
| `npm run build` | 编译源码 | `dist/`（不是安装包） |
| `npm start` | 编译并启动桌面版 | 无 |
| `npm run desktop` | 直接启动已编译的桌面版 | 无 |
| `npm run pack` | 编译并生成免安装 App 目录 | `release/mac-arm64/GitMap.app` 等 |
| `npm run dist:mac` 等 | 编译并打包安装包 | `release/GitMap-<版本>-mac-arm64.dmg` 等 |

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

> 以上命令都会先执行 `npm run build` 再调用 electron-builder，产物在 `release/` 下。本地构建默认使用 ad-hoc 签名（未经 Apple 公证），首次在其它 Mac 上打开需右键 →「打开」。跨平台打包（如在 macOS 上打 Windows / Linux 包）可能缺少依赖，建议在目标系统上打包，或直接用下面的 GitHub Actions。

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
