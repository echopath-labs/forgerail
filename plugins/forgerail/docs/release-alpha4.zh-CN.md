# ForgeRail 0.1.0-alpha.4 完整性发布 Runbook

本 source-first runbook 约束拟议的 `@echopath-labs/forgerail@0.1.0-alpha.4`、tag `v0.1.0-alpha.4` 与对应 Agent Plugin 投影。文档本身不授予 `remote_integration_approval`、`release_approval`、`submission_approval`、`rollback_approval` 或 `lifecycle_change_approval`。未作用域 `forgerail@0.0.0-reserved.0` 继续只作占位，不得接收产品代码，也不是安装或回滚来源。

## 候选集成

公共候选是已观测远端 `main` 的普通子 commit。该基线精确为 `e8fa29cd9f0f782d423d2fdd8abd778fbd362d61`。未来的精确 `remote_integration_approval` 最多允许把已签名 commit 推送到 `codex/forgerail-alpha4-critical-integrity`、创建一个 Draft PR，并观察 Node.js 22 与 24 Plugin Contracts CI。Draft PR base 与 publication comparison baseline 继续绑定已观测远端 `main`。

任何修正都必须形成普通的 source-first successor commit。远端集成授权不允许 force push、改写候选、把 PR 转为 Ready、合并、打 tag、发布 npm 或创建 Release。每个外部 Capability Pack 分别安装与发现；可见不等于已认证、已启用或具有变更权限。

## 完整性与兼容性证明

运行 Core、完整性回归、Shadow comparison、release source、Directory、一次性消费者与外部 Pack 验证。仍满足 alpha.4 显式约束的 alpha.3 Profile、Pack、Task Envelope 与 Return Receipt 必须继续通过；Launch Contract 与 Adoption Plan 已有意收紧，必须重新生成后再交给 alpha.4 validator。非法标识符、日期、路径、重复身份、缺少必需 Pack、畸形 receipt、逃逸 adoption target、不安全 bundle source 与矛盾 orchestration event 必须 fail closed。

每一条 Adoption 候选写入都携带 `approvalSha256`，绑定 canonical workspace 身份与完整可执行元数据：路径、操作、基线摘要、内容摘要、内容与 managed marker。集成方必须把人类已批准的摘要与可变候选分开保存，并在应用写入时显式传入；ForgeRail 只校验并使用一次不可变字段快照，且只接受 `create`、`append-managed-block`、`replace-managed-block` 三种操作，因此跨工作区重放、accessor 漂移、非法操作重放或普通元数据漂移都会在目标修改之前失败。替换既有 managed binding 时使用同目录原子 rename，并以 hard link 保留恢复入口，因此不会主动制造目标路径缺失的时间窗；若已安装 leaf 消失，可恢复原 binding 且不会遮蔽原始错误。四位年份（包括 `0000` 至 `0099`）按字面解释，不再触发 JavaScript 旧式的 1900 年偏移。

相对 alpha.3 的兼容性收紧必须明确：contract 标识符至少包含两个字符且首字符必须为字母或数字；每个 Launch Contract 必须携带已验证的 `effectiveProfile` 摘要以及当前 active Pack manifest 的规范身份摘要，工作区身份仅在 `envelope.ownerWorkspace` 出现一次；每个 required active Pack 必须存在可用 manifest，并由 task envelope 显式包含。这些是 fail-closed 修正，不是未说明的兼容性回归。

source-repository projection builder 仅供维护者使用，不得进入 npm 包或公共 CLI。公共投影必须要求 `package.json.files` 是显式数组、保持可重复、以不区分大小写的方式拒绝敏感文件名族、先独占保留新输出目录且不得替换并发出现的目标、排除私有过程证据，并保留公共 main 的文档基线。

## 独立发布门

只有后续精确 `release_approval` 才能授权 Ready/merge、作用域 npm 发布、dist-tags、annotated tag、GitHub prerelease 与一次性消费者复验。合并后的公共 `main` tree 必须等于最终签名 projection tree，之后才能开始发布验证。

Node.js 22 和 24 必须验证 Core、contracts、integrity、外部 Packs、冻结 AGW 行为覆盖、release source、Directory readiness、一次性消费者生命周期、pack metadata 与 audit。GitHub API/SSH/npm 身份必须为 `chasechou007`，且不得暴露凭据。保留 Apache-2.0、未作用域占位包以及 alpha.1 至 alpha.3 的不可变 package/tag 历史。

不得 unpublish 或移动不可变版本和 Git tag。已发布缺陷只能通过普通的 source-first successor commit 修复。安装和诊断默认不得修改项目文件；只有用户另行批准精确 managed binding 后才可写入，并须返回 Host Binding Receipt，确认未隐式创建 `.forgerail/` 状态。

## 独立 Directory 与生命周期门

Universal Plugins Directory draft、submission、review publication、verified publisher identity、Apps Management Write、portal regions 与 assets 仍属于独立 `submission_approval` 或 publication gate。AGW deprecation、redirect、archive 或 deletion 需要 `lifecycle_change_approval`。任何审批都不可传递。
