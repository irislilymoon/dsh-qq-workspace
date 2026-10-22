# dsh-qq-workspace · QQ 工作区

给 DSH 官方的 QQ 机器人插件（`@tencent-connect/dsh-qqbot`）指定独立工作目录，并把 QQ 会话归入侧栏工作区分组。

## 功能

- 在「设置 → QQ 工作区」里查看和修改 QQ 机器人的工作目录。
- 支持系统文件夹选择器，也可以手动填写绝对路径；目录不存在时自动创建。
- 应用后自动在 `~/.dsh/profiles/desktop/cordis.patch.yml` 的 `im-qqbot.config.cwd` 写入新目录，并创建/复用对应的 DSH 工作区。
- 新产生的 QQ 会话会自动加入该工作区。
- 应用时重置 QQ 会话 ID，下一条 QQ 消息在新目录新建会话。
- 旧的 QQ 会话会移入 `~/.dsh/qq-workspace/trash/<时间戳>/`，而不是永久删除；其他对话与目录内文件不受影响。
- QQ 上传的图片/文件会落到工作区的 `qq-uploads/`，模型可以直接用 `read` / `read_image` 处理；设置页可选择长期保留。
- **安全锁**：仅对 QQ Bot 自动创建的会话生效，把模型限制在工作区内部。

## 安全锁

在「设置 → QQ 工作区」打开安全锁后：

- 只允许 `read`、`read_image`、`glob`、`grep`、`ask_user_question`；可写权限下额外允许 `write`、`edit`。未勾选「禁止联网」时额外允许 `web_search` 和 `web_fetch`；勾选后两者都禁用。`bash`、PowerShell、终端、`working_directory`、子代理、MCP、skill、文件发送、`run_code` 全部禁用；未列入白名单的新工具一律拒绝。
- 「禁止联网」开关同时控制 `web_search` / `web_fetch`：勾选=禁止，取消=允许。取消时 DSH 的抓取器会校验并固定公网 IP、拒绝本机/内网地址、只跟随同源跳转，所以打开网页不会绕过文件安全锁。
- 所有文件路径必须是工作区内的相对路径；绝对路径、盘符、UNC、设备名、冒号/ADS、`~`、`..`、沙箱升级参数和指向工作区外的符号链接/目录联接都会被拒绝。路径校验使用**会话实际工作目录**，并且该目录必须位于工作区内，避免“校验根目录”和“执行目录”不一致。
- 工作区内的 `.git`、`.dsh`、`.agents`、`.vscode` 控制目录，以及 `AGENTS.md`、`CLAUDE.md`、`.mcp.json` 等控制文件不允许读写；`glob`/`grep` 的搜索根目录包含这些控制项时也会被拒绝。这样可以阻止通过 `.git/hooks`、工作区技能、AGENTS.md 或 IDE 任务进行持久化注入。
- 模型只能知道工作区名字（如 `qq-workspace`），看不到绝对路径、父目录、盘符、用户目录、操作系统或环境变量。系统提示只保留安全锁段（以及 prompt-studio 的自定义提示），DSH 的编码代理、Agent Teams、文件引用和环境段会被移除；工具结果中的路径会被替换。
- 权限卡点：`read-only` 仍然是只读；`workspace-write` 仍然是工作区写入；`danger-full-access` 在 QQ 会话里按工作区写入语义执行。插件会优先把沙箱策略封装到工作区；如果宿主沙箱服务无法封装，所有允许的文件工具仍会经过工作区路径校验，权限选择器保持你原来的显示。此时真正的边界是工具守卫和路径校验，而不是宿主沙箱。
- 只锁定 QQ 会话：你自己的普通会话不受影响。QQ 会话通过 `~/.dsh-qqbot/model-prefs.json` 的会话 ID、QQ 消息特征和父会话关系识别；每次系统提示装配、每步输入和每次工具调用前都会再核对一次偏好文件，降低“会话创建时尚未写入偏好而漏锁”的窗口。
- **QQ 命令锁**：安全锁开启时，`/model` 只显示当前模型（不列出其他模型、不提供切换按钮），带参数的 `/model` 直接拒绝；`/preset` 只显示当前预设，带参数或 `reset/default` 的切换直接拒绝。模型和预设的切换请到 DSH Desktop 宿主端进行。命令解析异常、发送失败或无法识别会话时，命令按失败即阻止处理，不会回落到官方切换逻辑。
- 设置页的安全锁卡片提供独立开关：总开关、核心保护（文件/工具/路径/环境）、禁止联网（网页搜索/打开网页，勾选=禁用）、禁止 QQ 切换模型、禁止 QQ 切换预设。可以单独控制。
- 命令锁通过在 QQ SDK 的斜杠命令中间件中插入一个全局守卫实现；安装时会备份 `slash-command.js.qq-workspace.bak`。QQ SDK 更新后若补丁被覆盖，插件会在启动时提示重新安装/重启。
- 与 `dsh-prompt-studio` 兼容：当提示词工作室的完整替换段存在时，不额外追加安全提示段；工具、路径和命令约束仍然生效。
- 工具守卫初始化失败时不会静默降级：插件会按故障安全策略把 QQ 会话的工具列表清空，并在设置页显示错误。
- **QQ 上传目录**：插件会把官方 QQ 插件的 `~/.dsh-qqbot/media` 重定向为工作区内的 `qq-uploads/`（Windows 目录联接，其他平台为目录符号链接）。QQ 消息里的媒体路径会被改写成 `qq-uploads/文件名`，因此安全锁允许模型用 `read` / `read_image` 直接处理你上传的图片和文件。切换工作区时会自动重指向，旧文件留在旧工作区。
- **上传保留策略**：设置页「QQ 上传文件」卡片提供「长期保留上传文件」开关。开启时写入 QQ 配置的 `im-qqbot.config.media.ttlHours: 0`，官方媒体清理不再删除上传；关闭时恢复 24 小时自动清理。修改会热重载 QQ 插件。长期保留会让 `qq-uploads/` 持续增长，请定期手动清理不需要的文件。
- 设置接口只接受本机 Host、同源 Origin、`x-dsh-qq-workspace: 1` 请求头和 JSON 请求体，避免任何网页通过 `localhost` 跨站请求（CSRF / DNS rebinding）关闭安全锁或改写工作目录。

关闭安全锁后，QQ 会话恢复普通权限。安全锁状态保存在 `~/.dsh/qq-workspace/security.json`。

## 安装

从 GitHub 克隆或下载后，在 DSH Desktop 里：

1. `git clone https://github.com/irislilymoon/dsh-qq-workspace.git`（或下载 ZIP 解压到任意目录）。
2. 设置 → 插件 → 添加插件，填写本目录的绝对路径，例如：

```
D:\Code\dsh-qq-workspace
```

3. 启用插件并重启 DSH Desktop（宿主部分需要重启才生效）。
4. 进入 设置 → QQ 工作区，选择工作区目录并应用。

也可以直接把本目录复制到新电脑，再按上面的「添加插件」路径安装；不需要 `node_modules`。

## 行为说明

- **旧 QQ 会话清理**：只处理 QQ 插件 `~/.dsh-qqbot/model-prefs.json` 里的会话，以及位于 Desktop profile 目录、且带有 QQ 消息特征的会话。其他工作区里的对话不会被识别或删除。
- **回收站**：会话目录与 `~/.dsh/storages/session_projcache` 对应缓存会一起移入回收站；确认无误后可手动清空 `~/.dsh/qq-workspace/trash/`。
- **工作区归属**：DSH 的会话分组要求会话的 `cwd` 与工作区目录一致。已有会话的 `cwd` 是创建时固定的，所以切换目录时采用「新会话」而不是迁移旧会话。
- **配置写入**：修改 `cordis.patch.yml` 会触发 QQ 插件热重载；旧配置备份为 `cordis.patch.yml.qq-workspace.bak`。
- **QQ 会话偏好**：重置前的文件备份为 `~/.dsh-qqbot/model-prefs.json.qq-workspace.bak`。

## 新电脑安装

1. 先安装 DSH Desktop 和官方 QQ Bot 插件，完成扫码或 AppID/AppSecret 绑定。QQ 凭据属于机器/宿主的配置，不要从旧电脑复制带密钥的文件。
2. 把本插件目录 `dsh-qq-workspace` 复制到新电脑（只需源码目录，无需 `node_modules`）。
3. 在 DSH Desktop 的「设置 → 插件 → 添加插件」里填入该目录的绝对路径，启用后重启 DSH。
4. 打开「设置 → QQ 工作区」，填写你想用的工作区绝对路径并应用。插件会自动创建该目录、创建 `<工作区>/qq-uploads`，并把 `~/.dsh-qqbot/media` 联接过去。
5. 需要长期保留上传时，打开「QQ 上传文件」卡片里的开关。该设置保存在本机 QQ 配置中，新电脑需要重新打开。
6. 在 QQ 发一次 `/new` 后测试图片和文件。

上传文件的迁移规则：

- **新电脑首次应用工作区**：`qq-uploads` 会自动创建，新上传自动落到所选工作区。跨电脑不会自动传输旧上传；把旧电脑工作区里的 `qq-uploads/` 复制到新工作区的 `qq-uploads/` 即可继续使用。
- 如果新电脑的 `~/.dsh-qqbot/media` 是普通文件夹且里面已有文件（例如你手动复制过去的），首次应用会把它们迁移到所选工作区的 `qq-uploads/`。
- **同一台电脑切换工作区**：只把 `~/.dsh-qqbot/media` 重指向新工作区，旧上传留在旧工作区的 `qq-uploads/`，不会自动搬走。需要自动搬运可以再加。
- 媒体联接是 Windows Junction（其他平台是目录符号链接），不能跨电脑复制；新电脑会重新创建。

## 目录结构

- `index.js`：宿主插件入口，工作目录/工作区、QQ 上传目录联接、设置 HTTP 路由。
- `security.js`：QQ 会话识别、安全锁工具守卫、路径/提示/工具结果过滤、QQ 命令锁。
- `qq-commands.js`：QQ SDK 斜杠命令补丁与全局守卫。
- `client.js`：DSH 设置页「QQ 工作区」。
- `cordis.patch.yml`：DSH bundle 插入补丁。
- `test/security.test.mjs`：不依赖 DSH 的安全逻辑测试。

## 测试

```bash
node --test test/*.test.mjs
```

测试只使用 Node 内置模块和临时目录，不需要安装依赖，也不会读写真实工作区。

## 接口

设置页会自带请求头；手动调用时必须同时满足：`Host` 是本机回环地址（或宿主实际绑定地址）、`Origin`（如有）与 `Host` 同源、带 `x-dsh-qq-workspace: 1` 请求头。`POST` 还必须是 `application/json`。

- `GET /qq-workspace/state`：当前配置、工作区、QQ 上传目录映射状态、待清理会话、安全锁开关和命令补丁状态。
- `POST /qq-workspace/apply`：`{ "path": "D:\\qq-workspace" }`，写入目录并重置/清理旧 QQ 会话。
- `POST /qq-workspace/media`：`{ "retainForever": true | false }`，写入 QQ 配置的 `media.ttlHours`（0 或 24）。
- `POST /qq-workspace/security`：`{ "enabled": true | false, "core": true | false, "allowWeb": true | false, "blockModelSwitch": true | false, "blockPresetSwitch": true | false }`，可只提交其中一项。

## 限制与残余风险

- 工作区**内部**的文件按设计对该 QQ 会话可见；不要把密钥、密码、身份证件等敏感文件放进 QQ 工作区，也不要运行 QQ 生成的可执行文件或脚本。
- 工作区里的**嵌套**控制目录（例如 `sub/.git`）以及硬链接仍可能被宽泛搜索命中；建议把 QQ 工作区当作纯文件交换目录，不要放 Git 仓库或含技能的工程。
- QQ 上传文件统一落在工作区的 `qq-uploads/`，所有与这个机器人对话的 QQ 用户/群共用同一目录；如果机器人会在不受信任的群里使用，请不要把敏感上传留在里面。默认 24 小时后清理；开启长期保留后会一直占用磁盘，需要手动清理。
- 图片能否直接查看取决于当前主模型是否声明 `image` 输入；如果 `read_image` 提示模型不支持图片，需要换用支持图片的模型，或启用官方 `qqbot_describe_image` 视觉工具（默认关闭，需要单独配置 provider/model）。文本、代码、压缩包内的文本等文件可直接用 `read` 处理。
- `web_fetch` 经由本机 HTTP 代理时，DSH 抓取器只拦截字面量内网 IP，域名解析到内网/本机的情况依赖代理自身策略；重要隐私场景建议保持 `web_fetch` 关闭，或让代理拒绝私有地址。插件自身的设置接口已用 Host/Origin/请求头校验，不受该路径影响。
- 只支持一个全局 QQ 工作目录（与官方插件的 `cwd` 配置一致），不支持每个群/私聊分别设置。
- 不迁移旧 QQ 会话的上下文；切换目录后从新会话开始。
- 文件发送（`qqbot_send_file`）仍然禁用；取消「禁止联网」只恢复 `web_search` / `web_fetch`，文件访问仍只限工作区。
- `/model` 和 `/preset` 的拦截依赖 QQ SDK 的命令补丁；如果 SDK 更新覆盖了补丁，设置页会显示警告，重新应用补丁后需要重启 DSH。
- 模型/预设切换只能在 DSH Desktop 宿主端进行；QQ 侧只显示当前值。
- 依赖 DSH Desktop 的 `workspaceRegistry`、`sessionPersistence`、`tools`、`sandboxPolicy` 服务；Web/CLI 组合若缺少这些服务，插件不会加载。

## License

MIT，见 [LICENSE](LICENSE)。
