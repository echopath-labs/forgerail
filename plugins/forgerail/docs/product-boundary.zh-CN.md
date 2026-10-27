# ForgeRail 产品边界

ForgeRail 帮助宿主 Agent 确定工程任务范围、遵守项目规约和审批边界、提交可验证的结果。实际工作与最终验收由宿主和负责人完成；ForgeRail 提供引导与确定性检查，安装不产生执行授权。

| 能力 | 当前职责 | 边界 |
| --- | --- | --- |
| Core 与 CLI | Profile/Envelope 组合、合同和回执检查、有界本地 Git 观察 | `launch` 生成合同，不启动 Agent |
| Project Profile 与 provider 观测 | 项目自有 source/claim 组合，以及 operation 范围内的 GitHub、SSH、npm identity 预检 | 只产生只读脱敏证据；不提供凭据存储、授权、mutation probe 或执行器 |
| Diagnosis 与 Health | 只读观察、诊断和建议 | 不自动修复，不建立监控 daemon 或项目记忆 |
| Architecture Convergence | 可选的责任归属、工程范式与漂移评估 | 使用项目已接受规则，不强制目录布局，不自带依赖边界执行引擎 |
| Adoption 与宿主 profile | 绑定计划、明确授权的 managed-file 写入与验证 | 已发布 0.1.10 的验收保留为历史；本次精确候选 Core 已于 2026-10-26 结合 Agent 报告和独立文件/Git/测试通过有界复核，未提供完整 transcript。Rule 回退仍为 profile-only；不恢复 Cursor 执行器、不认证 Cloud Agent |
| 可选委派指导 | 判断启用偏好、任务适配、总成本、交接及 Host 验收 | 未发布 Core 指导；RelayPact 保持可选并拥有执行职责。不新增 Skill、CLI、配置、schema、状态或调度 |
| 跨工作区 Pack | 依赖波次、写入冲突、交接与回执检查 | 宿主或 RelayPact 拥有任务派发、进程生命周期、等待、取消和恢复 |
| Rulesets、Release Safety、Thread Closure Pack | 指引、审批及证据要求、本地 fixture 验证 | 经授权后由宿主使用项目工具执行，不内置远端执行器 |
| 版本化控制合同 | 已发布 schema、字段和 fixture 校验 | 合同校验不等于实时 Authority、Topology、Revision 或 Provider evaluator |

更完整的 Control System 架构属于暂缓设计。ForgeRail 不维护持久控制账本，不强制拦截所有工程操作，也不实时求值全部外部审批。Project Profile 的小型受评审 registry 仅执行显式 identity 预检，不是通用 Provider 运行时。保留既有公开 schema 是兼容性决定；扩展为更广运行时需要单独的产品取舍、真实消费者和验证证据。历史计划的未勾选任务不是默认待办。

项目规约和规格保留原 owner。OpenSpec 管变更记录，OpenDomain 管领域语义，EchoPath 管可选连续性，RelayPact 或宿主管委派和执行。这些产品均非安装前提；引用结果不会转移其权威。

## Cursor 实验退出

截至 0.1.2 曾随包分发的 Cursor 实验执行器已移除：不再提供其直接 CLI/模块路径、专用 schema 和 fake-executor 测试。既有发布和历史保持不变。直接使用过实验路径的用户需要另选受支持的宿主或委派能力；没有自动迁移，也不新增 RelayPact 依赖。已发布 0.1.10 Core 已通过 Cursor IDE Agent 的共享 `AGENTS.md` 路径验收，原历史证据保留；本次候选 Core 已于 2026-10-26 通过报告和独立当前证据的单独受理，完整读取顺序未独立审计，见[宿主支持](adoption.zh-CN.md#宿主支持)。Rule 回退路径仍为 profile-only，这并不恢复该执行器。

## 如何保持边界

`package.json.files` 显式列举脚本模块。`npm test` 检查源码或安装包的脚本范围，发布检查与 disposable consumer 另行核对真实 npm 文件清单。fixture 目录仅容纳数据；实验在责任与使用场景得到评审前应留在发布输入之外。

已允许文件内部仍可能发生语义越界。PR 评审需要解释能力 owner、真实消费者、副作用或持久状态，以及为什么现有宿主或产品不能承担。机器检查约束发布范围，不是语义隔离或安全沙箱。

## 0.1.5 项目接入闭环

0.1.5 新增 Codex 项目快照 init/update/doctor/remove 与恢复操作，只维护本产品受管内容；固定版本、来源校验、迁移和用户内容保护见 [接入说明](project-adoption.zh-CN.md)。项目配置与安装清单不是持久治理运行时。AI 工具联网更新提醒仍未实施；已发布 0.1.4 不包含新命令。
