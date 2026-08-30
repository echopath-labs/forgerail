# ForgeRail 0.1.0-alpha.3 Forward-Fix Runbook

本 source-first runbook 约束拟议的 `@echopath-labs/forgerail@0.1.0-alpha.3`、tag `v0.1.0-alpha.3` 与对应 Agent Plugin 投影。文档本身不授予 `remote_integration_approval`、`release_approval`、`submission_approval`、`rollback_approval` 或 `lifecycle_change_approval`。未作用域 `forgerail@0.0.0-reserved.0` 继续只作占位，不得接收产品代码，也不是安装或回滚来源。

## 候选集成

公共候选是已观测远端 `main` 的普通子 commit。该基线精确为 `dba155d7f7092a3f852bf2c0244a35bd153fcedb`。未来精确 `remote_integration_approval` 只能把签名 commit 推到 `codex/forgerail-alpha3-scoped`，创建一个 Draft PR，并观察 Node.js 22 and 24 Plugin Contracts CI。Draft PR base 与 publication comparison baseline 继续绑定已观测远端 `main`。

任何修正都必须形成普通的 source-first successor commit。remote integration 权限不允许 force push、历史重写、转 Ready、merge、tag、publish 或创建 Release。每个外部 Capability Pack 分别安装与发现；可用不等于认证、启用或获得 mutation authority。

## 兼容性证明

主 Plugin 的 `defaultPrompt` 不得超过三条，同时四个 Skills 必须继续独立发现与直接调用。第三条只是 Workspace Health Review 与 Architecture Convergence Audit 的二选一路由，不合并 owner，也不同时激活两者。必须在 fresh disposable Codex host 验证精确投影，只有 ForgeRail 自有 prompt overflow warning 才判失败。归属 `openai-primary-runtime/template-creator` 的 icon 路径告警是 external observation，不得通过复制或修改该外部 Plugin 修复。

## 独立发布门

只有后续精确 `release_approval` 才能授权 Ready/merge、scoped npm 发布、dist-tag、annotated tag、GitHub prerelease 与一次性消费者验证。发布验证开始前，合并后的公共 `main` tree 必须等于最终签名 projection tree。

在 Node.js 22 和 24 上运行 Core、contracts、external Packs、冻结 AGW 行为覆盖、release source、Directory readiness、一次性 consumer、pack metadata 与 audit。不得暴露凭据地确认 GitHub API/SSH/npm 身份为 `chasechou007`。保持 Apache-2.0、未作用域占位，以及不可变 alpha.1/alpha.2 package/tag 历史。

Do not unpublish 或移动不可变 version/tag。已发布缺陷使用前向版本修复。安装和诊断默认不修改项目；只有用户另行批准精确 managed binding 后才写入，并返回 Host Binding Receipt，确认没有隐式 `.forgerail/` 状态。

## 独立 Directory 与生命周期门

Universal Plugins Directory draft、submit、review publication、verified publisher identity、Apps Management Write、portal regions/assets 继续属于独立 `submission_approval` 或 publication gate。AGW deprecation、redirect、archive 或 deletion 需要 `lifecycle_change_approval`。任何审批都不传递。
