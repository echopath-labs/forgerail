# ForgeRail 0.1.0-alpha.5 替代引导候选

本地候选为 `@echopath-labs/forgerail@0.1.0-alpha.5`、tag `v0.1.0-alpha.5`，尚未发布。当前公开安装继续使用 alpha.4；发布核验后才切换默认安装入口。

主 Plugin 已自包含原 AGW/WHR 的 Git 生命周期、暂存区保护、目录归属、记录、影响验证、分阶段交接、健康评审及便携恢复指引。用户操作的两个 Agent 各执行24个源码加载样本，文件/Git与实现测试得到复核。该证据不等于原生 Plugin 激活、严格会话隔离或真实旧格式消费者兼容。机器可读产物仍需按实际合同验证，默认使用可读回报。外部 Capability Pack 保持 alpha.4。

本次采用npm安装与包内Skill显式加载，暂不注册Codex市场，原生Plugin激活不作为发布门槛。尚无内置Node运行时的独立二进制。Codex可作为源码加载宿主；Cursor/WorkBuddy 的源码实验不升级其原生安装与绑定支持等级。项目接入时核对实际宿主加载、原项目规则及实际存在的旧格式消费者。CLI所在机器需要Node.js 22+，目标项目无需新增package.json、node_modules或隐式 `.forgerail/`。

本次发布只剩三类门槛：固定候选和已知限制；在临时工具目录安装最终npm包、验证CLI与只读诊断、核对四Skill及引用和源码一致后卸载；完成既有门禁、Node.js 22 and 24、最终产物和精确远端身份检查。已有显式源码Agent证据用于未修改的指导，不声称已完成原生Plugin激活；无需新增ChatGPT登录。没有新证据不重跑所有行为场景，不增加全宿主认证。

公共候选是已观测远端 `main` 的普通子 commit。准备公共投影前实时读取base，分支提议为 `codex/forgerail-alpha5-agw-replacement`。Draft PR base 与 publication comparison baseline 继续绑定已观测远端 `main`，修正使用普通的 source-first successor commit。合并后的公共 `main` tree 必须等于最终签名 projection tree。

公开投影/PR需要精确 `remote_integration_approval`；合并、tag、npm `next` 和GitHub prerelease分别受 `release_approval` 约束。执行前核对授权发布身份，已发布版本不可覆盖、移动或撤销，缺陷通过后续版本处理。主包安装不会自动授权用户项目改写；采用需保留规则并返回 Host Binding Receipt。

每个外部 Capability Pack 分别安装与发现，只在使用该Pack时验证，不成为主包基线的默认依赖。Directory提交、逐项目迁移与旧AGW退役不阻塞本次候选准备，亦不随发布自动获批；退役仍需 `lifecycle_change_approval`。
