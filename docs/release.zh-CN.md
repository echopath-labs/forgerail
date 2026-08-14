# ForgeRail 0.1.0-alpha.1 发布 Runbook

这是 ForgeRail 首个可用预发布版的项目专属 runbook，约束 `@echopath-labs/forgerail@0.1.0-alpha.1`、Git tag `v0.1.0-alpha.1` 与同一 EchoPath Labs Marketplace 快照。未作用域 `forgerail@0.0.0-reserved.0` 继续只作名称占位，不属于产品发布路径；文档本身不授予任何执行权限。

## 独立审批门

三个审批门互不继承：

1. `remote_integration_approval` 只允许将一个精确签名 commit 推到 `release/0.1.0-alpha.1`，基于精确 `main` 创建 Draft PR，观察 Node.js 22 and 24 CI 并返回 receipt。
2. `release_approval` 才可把该精确 PR 转 Ready、按批准方式合并、发布精确 npm 预发布版、创建 annotated tag 与 GitHub prerelease，并核验消费者安装。
3. 任何 AGW 弃用、重定向、归档、删除或激活切换都需要单独的 `lifecycle_change_approval`。

Ruleset、branch protection、稳定版、其他产品与 OpenSpec archive 不在上述授权内，除非新的审批明确加入。

## Source-first 候选

- canonical source 只在 EchoPath 工作区维护；禁止 public-only 修复。
- 每次修正都要重新校验、确定性投影，并绑定精确 source commit、tree、inventory、manifest digest 与 projection receipt。
- 首个公共候选必须是已观测 `main` 的普通子 commit。remote integration 后若在同一 release branch 上进行 source-first 替换，新候选必须是当前 release head 的普通 fast-forward successor。两种形式都只能用精确 SHA refspec 推送且不得 force push；PR base 与 publication comparison baseline 继续绑定已观测 `main`。
- squash merge 后的公共 `main` tree 必须等于最终签名 projection tree。
- Draft PR 必须绑定精确 base/head；任何 SHA、tree、版本、许可证或 check 漂移都停止。
- 必须通过 Node.js 22 and 24 Plugin Contracts，包括 Core/contracts、渐进式采用、外部 packs、冻结 AGW 覆盖、发布源校验与一次性消费者生命周期。

## 发布审批后的门序

获得新的精确 `release_approval` 后才执行：

1. 复核 PR 仍为 Open/Draft、可合并、base/head 与批准包一致，required checks 全部成功。
2. 仅将该 PR 转 Ready，并用 exact-head guard squash merge；确认合并后 `main` tree 等于签名候选 tree。
3. 在干净的 merged `main` 上用 Node.js 22 和 24 运行 `npm test`、`npm run test:shadow`、`npm run test:release`、`npm run test:consumer`、`npm pack --dry-run --json` 与 `npm audit`。
4. 不暴露凭据地验证 npm 身份及 `@echopath-labs` 组织 package 权限；确认 scoped alpha.1 尚不存在，并记录 scoped package 的 `latest`、`next`。另行确认未作用域 `forgerail` 仍只有 `0.0.0-reserved.0` 且占位 tags 未变。
5. 仅以 public access 与 `next` tag 发布 `@echopath-labs/forgerail@0.1.0-alpha.1`；在可信发布链完成独立验证前关闭 provenance。不得向未作用域 `forgerail` 发布产品代码。
6. 核验 registry version、shasum、integrity、license、repository、binary shim，并执行精确版本隔离安装、`forgerail validate` 与一次有界只读诊断。
7. 精确版本 smoke 通过后才把 scoped package 的 `latest` 移到 alpha.1；核验 exact、scoped `next`、scoped `latest` 隔离安装，并保持未作用域 `forgerail` 的所有 version/dist-tag 不变。
8. 在精确 merged `main` 上创建 annotated `v0.1.0-alpha.1` 并推送，不移动任何已有 tag。
9. 发布标题为 `ForgeRail v0.1.0-alpha.1` 的 GitHub prerelease，release notes 使用版本化 CHANGELOG；此版本没有 standalone binary assets。
10. 在一次性环境中注册精确 tag Marketplace，安装主插件并启动新 Codex 任务，验证三个主 Skill；生成单宿主 Codex Adoption Plan，证明规划不修改工作区，仅在显式批准后向一次性项目写入 managed block，再启动新任务或执行受支持的等价发现检查，并校验 Host Binding Receipt；确认没有 `.forgerail/` 状态。每个外部 Capability Pack 分别安装与发现，不认证、不执行。
11. 返回绑定 canonical、PR/merge、tree、npm、dist-tags、tag、prerelease、Plugin discovery、校验、非变更项与恢复锚点的 durable receipt。

## 停止与回滚

- npm 发布前任何身份、tree、check、凭据、package 或消费者结果漂移都立即停止，不产生发布副作用。
- Do not unpublish 或覆盖不可变 npm version；不得移动已发布 Git tag。发布后缺陷通过新版本前向修复。
- 若 scoped npm 精确发布成功但消费者 smoke 失败，只有得到单独批准后才可删除或移动 scoped `latest`/`next` 到最近已验证的 scoped 版本。首个 scoped prerelease 没有更早 runtime，immutable alpha.1 必须保留；不得把 scoped tags 指向未作用域占位版本。
- PR 或 merge 缺陷使用普通 review 后的 revert/forward commit；禁止 force push 与历史重写。
- 真实兼容期 canary 完成前 AGW 继续可用；本次发布不授权 AGW 生命周期变更。

## 必需 receipt

记录精确 repo、branch、PR、批准 head/base、merged commit/tree、canonical 与投影 digest、Node.js 22/24 checks、Host Adapter 状态、采用规划非变更、Codex Host Binding Receipt、pack metadata、npm 身份及不可变 package metadata、最终 dist-tags、annotated tag object/peeled commit、GitHub prerelease、一次性 Plugin/CLI 安装结果、rollback anchors，并确认没有 `.forgerail/`、Ruleset、branch protection、stable release、AGW lifecycle 或 OpenSpec archive 变更。
