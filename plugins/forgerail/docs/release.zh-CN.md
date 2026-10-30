# ForgeRail 0.1.12 稳定版发布 Runbook

本项目自有 runbook 约束 `@echopath-labs/forgerail@0.1.12`、annotated tag
`v0.1.12` 与对应的正式 GitHub Release。公开仓是私有 canonical source 的
确定性投影；外部 Capability Pack 保持各自 alpha.4 身份和独立生命周期。
本文描述流程，本身不授予执行权限。

发布状态以 npm 和版本化 GitHub Release 为准；执行须获得精确目标与动作的授权。精确共用 Core 已于 2026-10-30 通过有界 Cursor IDE 证据复核，接受摘要必须继续匹配最终源码。
版本/档位未知，模型为报告自述且未提供完整原始工具轨迹，见 0.1.12 发布说明；不得刷新验收摘要来绕过门禁。

## 独立门禁

1. `remote_integration_approval` 覆盖精确公开投影分支、Draft PR、required
   checks、最终评审与获批合并。
2. `release_approval` 覆盖精确合并树、npm `latest` 发布、annotated tag 与
   正式 GitHub Release。
3. `lifecycle_change_approval` 单独约束 AGW 退役、消费者迁移、Ruleset、
   branch protection、回滚或删除。

Owner 明确要求发布某个版本时，可以在一条指令中同时授予前两个门禁；
该授权不会传递到第三个门禁。

## Source-first 公开集成

- 先修改并验证 canonical source，再生成公开投影；禁止 public-only 修复。
- 将候选绑定到私有 source commit/tree、公开 base、确定性投影摘要、npm
  归档摘要与精确版本。
- `release/0.1.12` 必须是已观测公开 `main` 的普通子 commit，并且只应用
  生成的投影。使用精确 SHA refspec 非强制推送。
- 基于已观测 `main` 创建 Draft PR；任何修正后都重新核对 head、base、
  tree、版本、许可证、required checks 和 Agent review。
- 只有最终投影仍为当前候选时才合并；公开 `main` 的合并 tree 必须等于
  已签名 projection tree。

Required CI 覆盖 Node.js 22/24、Core/contracts、完整 fixtures、渐进接入、
完整性、发布源校验、一次性消费者生命周期和 Universal Directory。

## 稳定版执行

1. 确认公开 PR 仍为 Open、可合并，base/head 与批准对象一致，required
   checks 和最终 Agent review 全部通过。
2. 仅将该 PR 转为 Ready，并通过 exact-head guard squash merge；确认合并后
   的公开 `main` tree 等于签名投影。
3. 在干净的 merged `main` 上使用 Node.js 22 和 24 执行
   `npm run test:maintainer` 与 `npm audit`；重新生成精确 npm 归档并比较
   inventory 与摘要。
4. 核实 `gh`、Git SSH、npm 都解析为获授权的 EchoPath Labs 身份；确认
   `@echopath-labs/forgerail@0.1.12` 尚不存在，并观察 `latest`、`next`。
5. 获得精确 stage 上传授权后，仅通过 staged publishing 上传批准归档，目标为
   `@echopath-labs/forgerail@0.1.12`、public access 与 npm `latest`；不使用
   direct token 发布。核对 stage 身份、name/version/channel/access，并回下载
   归档比较批准字节。Owner 本人完成网页批准与 2FA，Agent 不代为批准。
   stage 上传不等于发布；registry 确认前停止后续发布动作。除非 trusted
   publishing 已独立核实，否则关闭 provenance。
6. 回读 registry version、shasum、integrity、license、repository、binary
   shim 和 dist-tags；在 Node.js 22/24 匿名安装精确版本，运行
   `forgerail validate`、包内自检和一次有边界只读诊断。
7. 在精确 merged public `main` 上创建 annotated `v0.1.12` 并非强制推送；
   使用版本化发布说明创建正式 GitHub Release `ForgeRail 0.1.12`。本版没有
   standalone binary assets。
8. 将精确 tag 作为一次性 Codex Marketplace 验证：发现主 Plugin Skills，
   验证只读接入规划，只在一次性工作区应用明确批准的 managed block，
   校验 Host Binding Receipt，并确认没有持久任务治理状态。每个外部
   Capability Pack 独立发现，不认证、不执行。
9. 写入耐久发布回执，并在收尾前重新观察公开 `main`、npm dist-tags、
   annotated tag 与 GitHub Release。

## 停止与恢复

- npm 发布前若身份、源码、投影、检查、评审、包清单或消费者行为漂移，
  立即停止。
- 不撤回或覆盖不可变 npm 版本，不移动不可变发布 tag；已发布缺陷通过
  单独批准的前向修正版解决。
- PR 或 merge 缺陷使用普通 review 后的 revert/forward commit；禁止强推
  或改写公开历史。
- 可变 dist-tag 回滚、AGW 生命周期变化与真实消费者迁移需要单独授权。

## 必需回执

记录 canonical source/evidence commits、public base/head/PR/merge/tree、投影
和归档摘要、Node.js 22/24 结果、Agent review、npm 身份和不可变包元数据、
stage 身份与归档比较、不含 OTP 或凭据的 owner 本人批准证据、最终 dist-tags、
annotated tag object/peeled commit、GitHub Release、一次性
安装和 Plugin 检查、非变更项、剩余风险与恢复锚点。
