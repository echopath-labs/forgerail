# Cursor 本地 Executor Canary

这个实验 harness 用于验证：Codex 保持 Host，Cursor CLI 作为有界本地 Executor，而 ForgeRail 独立验证结果。它是 disposable 验证面，不是生产 delegation runtime，也不会把 Cursor Host Adapter 的全局状态从 `profile-only` 改为 `supported`。

## 前置条件与用量边界

只从 Cursor 官方渠道安装 CLI，并在执行前检查安装脚本。安装、shell integration、账户登录、API key 创建和按量付费开关都由用户控制；ForgeRail 不自动执行这些操作。

以下命令只检查本地前置条件，不启动 Agent 请求：

```bash
node scripts/cursor-local-executor.mjs discover
cursor-agent status
```

真实 canary 会消耗已登录账户的 Cursor Agent 用量。启用按量付费前应先查看 Cursor usage dashboard 与 spending controls；harness 不会开启超额付费。

## 确定性 Self-Test

Self-test 使用 fake Cursor executable 与临时 Git repository，不调用 Cursor 服务：

```bash
npm run test:cursor-adapter
```

覆盖 unavailable、unauthenticated、结构化成功、malformed/missing terminal、非零退出、timeout、cancel、越界写入、有界写入、resume 与 durable report 脱敏。

## 真实 Disposable Canary

必须先运行只读验证：

```bash
node scripts/cursor-local-executor.mjs canary --mode read-only
```

在同一 disposable workspace 中验证一次初始只读 session 和一次 resume：

```bash
node scripts/cursor-local-executor.mjs canary --mode read-only --verify-resume
```

只读验证通过，并且用户仍明确授权这个 exact disposable task 后，才运行：

```bash
node scripts/cursor-local-executor.mjs canary --mode bounded-write --authorize-mutation
```

Harness 会把 repository-owned fixture 物化到操作系统临时目录，并只对这份由 harness 生成的 fixture 显式授予 workspace trust，避免 headless 执行停在 Cursor 的信任确认门禁。只读模式组合 Cursor `plan` mode、Cursor sandbox、deny rules 与 Git tree 不变验证；仅省略 `--force` 不能作为只读保证，因为当前 headless print mode 可以访问 write 与 shell tools。有界写入模式也启用 sandbox，只允许 `src/value.txt`，拒绝已知 shell 与敏感文件操作，并由 Host 独立检查 changed paths、文件 digest 和 validation command。两种模式都不会把 canonical checkout 作为目标。

`--verify-resume` 只会让生成的临时仓库多保留到第二次结构化调用完成，并使用首轮捕获的 session identity 和完全相同的 workspace；它不代表 live-message 已受支持。

Cursor CLI 的实际能力可能大于 contract，但 capability availability 不产生 authorization。任何意外路径、缺失 terminal event、timeout、非零退出、malformed event 或独立验证失败都会阻止 verified verdict。

## Evidence 与隐私

原始 prompt、stream events、临时绝对路径、环境值、credential 和无界 stderr 保持 disposable。Durable capability report 只包含 exact CLI version、逐项 capability state、观察时间、脱敏 locator/digest、Git/validation 结果、偏差和 promotion recommendation。

Agent self-report 与 transport delivery 只是 evidence input，不是 ForgeRail acceptance。在必要 canary 通过，且 ForgeRail Control System Host Adapter owner 按 canonical serialization、authorization、execution-context 与 receipt contracts 接受证据前，Cursor profile 继续保持 `profile-only`。

## 产品边界与回滚

ForgeRail 拥有 control input、authorization evaluation 与 receipt verification。薄 Host bridge 只拥有本地 subprocess 启动、等待、取消、结构化输出捕获和 resume 调用。若后续需要通用 execution lifecycle，应由 RelayPact 拥有该 lifecycle 并引用 ForgeRail decision，而不是把 orchestration 扩张进 ForgeRail。

回滚只移除实验 harness、fixtures 和未接受的 reports，保留 `adapters/cursor.json` 与项目 records。临时 canary repositories 可直接丢弃。卸载 Cursor CLI 是单独的用户操作，删除前必须精确解析已安装版本目录与 symlink target。
