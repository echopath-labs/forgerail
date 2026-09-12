# ForgeRail 0.1.0-alpha.5 发布说明

`@echopath-labs/forgerail@0.1.0-alpha.5` 与 tag `v0.1.0-alpha.5` 已于 2026-09-12 发布。npm `next` 指向 alpha.5，`latest` 保持 alpha.4。请按[安装说明](installation.zh-CN.md)使用精确版本。见 [GitHub 预发布](https://github.com/echopath-labs/forgerail/releases/tag/v0.1.0-alpha.5)。

主 Plugin 已自包含原 AGW/WHR 的 Git 生命周期、暂存区保护、目录归属、记录、影响验证、分阶段交接、健康评审及便携恢复指引。用户操作的两个 Agent 各执行24个源码加载样本，文件/Git与实现测试得到复核。该证据不等于原生 Plugin 激活、严格会话隔离或真实旧格式消费者兼容。机器可读产物仍需按实际合同验证，默认使用可读回报。外部 Capability Pack 保持 alpha.4。

本次采用npm安装与包内Skill显式加载，暂不注册Codex市场，原生Plugin激活不作为发布门槛。尚无内置Node运行时的独立二进制。Codex可作为源码加载宿主；Cursor/WorkBuddy 的源码实验不升级其原生安装与绑定支持等级。项目接入时核对实际宿主加载、原项目规则及实际存在的旧格式消费者。CLI所在机器需要Node.js 22+，目标项目无需新增package.json、node_modules或隐式 `.forgerail/`。

## 发布与验证结果

[PR #8](https://github.com/echopath-labs/forgerail/pull/8) 已合并为 `fd73bbdbb3b8c5c96383f81c636458a4cc6c1bd9`，合并后的文件树与批准候选一致。Annotated tag `v0.1.0-alpha.5` 指向该提交。[PR CI](https://github.com/echopath-labs/forgerail/actions/runs/34669917318) 与 [main CI](https://github.com/echopath-labs/forgerail/actions/runs/34669982373) 的 Node.js 22 and 24 检查全部通过，实际 npm 发布也通过了完整维护者门禁。

发布后匿名下载公共 npm 包，核对结果与批准产物一致：

```text
SHA-256: caefd9c0bae3172938c8b557ffa1c432a8de1e0b604ccc72e255a8f7674859f6
```

258 个安装文件逐一匹配。Node.js 22.23.2 和 24.20.0 下，已安装 CLI 均通过四 Skill 校验、只读诊断及卸载检查，样本工作区保持不变。

仓库文档在发布后修正为上述实际状态。不可变 npm 包与 Git tag 保留发布时文档快照，其中仍有发布前措辞；当前可用性以仓库最新安装说明与 GitHub Release 为准。

## 项目采用

主包安装不会自动授权用户项目改写；采用需保留原有规则并返回 Host Binding Receipt。每个外部 Capability Pack 分别安装与发现，只在使用该 Pack 时验证，不成为主包基线的默认依赖。Directory 提交、逐项目迁移与旧 AGW 退役不随发布自动获批；退役仍需 `lifecycle_change_approval`。

已发布版本与标签保持不可变；未来发布需要独立的精确授权与验证，不覆盖 alpha.5，也不使用无 scope 的 `forgerail` 占位包作为安装来源。

## 历史准备流程

以下保留发布前的流程要求；本次实际完成结果见上文，不表示仍在等待发布。这里的投影批准以精确提交、文件树与产物摘要约束，不声称 Git 加密签名。

发布前约定了三类门槛：固定候选和已知限制；在临时工具目录安装最终npm包、验证CLI与只读诊断、核对四Skill及引用和源码一致后卸载；完成既有门禁、Node.js 22 and 24、最终产物和精确远端身份检查。已有显式源码Agent证据用于未修改的指导，不声称已完成原生Plugin激活；无需新增ChatGPT登录。没有新证据不重跑所有行为场景，不增加全宿主认证。

公共候选是已观测远端 `main` 的普通子 commit。准备公共投影前实时读取base，当时的发布分支为 `codex/forgerail-alpha5-agw-replacement`。Draft PR base 与 publication comparison baseline 继续绑定已观测远端 `main`，修正使用普通的 source-first successor commit。合并后的公共 `main` tree 必须等于最终批准的 projection tree。

公开投影/PR需要精确 `remote_integration_approval`；合并、tag、npm `next` 和GitHub prerelease分别受 `release_approval` 约束。执行前核对授权发布身份，已发布版本不可覆盖、移动或撤销，缺陷通过后续版本处理。主包安装不会自动授权用户项目改写；采用需保留规则并返回 Host Binding Receipt。

每个外部 Capability Pack 分别安装与发现，只在使用该Pack时验证，不成为主包基线的默认依赖。Directory提交、逐项目迁移与旧AGW退役不阻塞本次候选准备，亦不随发布自动获批；退役仍需 `lifecycle_change_approval`。
