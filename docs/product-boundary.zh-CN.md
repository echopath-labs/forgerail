# ForgeRail 产品边界

ForgeRail 帮助宿主 Agent 确定工程任务范围、遵守项目规约和审批边界、提交可验证的结果。实际工作与最终验收由宿主和负责人完成；ForgeRail 提供引导与确定性检查，安装不产生执行授权。

| 能力 | 当前职责 | 边界 |
| --- | --- | --- |
| Core 与 CLI | Profile/Envelope 组合、合同和回执检查、有界本地 Git 观察 | `launch` 生成合同，不启动 Agent |
| Diagnosis 与 Health | 只读观察、诊断和建议 | 不自动修复，不建立监控 daemon 或项目记忆 |
| Architecture Convergence | 可选的责任归属、工程范式与漂移评估 | 使用项目已接受规则，不强制目录布局，不自带依赖边界执行引擎 |
| Adoption 与宿主 profile | 绑定计划、明确授权的 managed-file 写入与验证 | Cursor rules 保持 `profile-only`；指令接入与执行器是两种能力 |
| 跨工作区 Pack | 依赖波次、写入冲突、交接与回执检查 | 宿主或 RelayPact 拥有任务派发、进程生命周期、等待、取消和恢复 |
| Rulesets、Release Safety、Thread Closure Pack | 指引、审批及证据要求、本地 fixture 验证 | 经授权后由宿主使用项目工具执行，不内置远端执行器 |
| 版本化控制合同 | 已发布 schema、字段和 fixture 校验 | 合同校验不等于实时 Authority、Topology、Revision 或 Provider evaluator |

更完整的 Control System 架构属于暂缓设计，不表示当前已经具备持久控制账本、所有工程操作强制拦截、外部审批实时求值或 Provider 运行时。保留既有公开 schema 是兼容性决定；把它们扩展为运行时需要单独的产品取舍、真实消费者和验证证据。历史计划的未勾选任务不是默认待办。

项目规约和规格保留原 owner。OpenSpec 管变更记录，OpenDomain 管领域语义，EchoPath 管可选连续性，RelayPact 或宿主管委派和执行。这些产品均非安装前提；引用结果不会转移其权威。

## Cursor 实验退出

截至 0.1.2 曾随包分发的 Cursor 实验执行器从下一份源码候选移除：不再提供其直接 CLI/模块路径、专用 schema 和 fake-executor 测试。既有发布和历史保持不变。直接使用过实验路径的用户需要另选受支持的宿主或委派能力；没有自动迁移，也不新增 RelayPact 依赖。Cursor 指令绑定及其 `profile-only` 状态保留。

## 如何保持边界

`package.json.files` 显式列举脚本模块。`npm test` 检查源码或安装包的脚本范围，发布检查与 disposable consumer 另行核对真实 npm 文件清单。fixture 目录仅容纳数据；实验在责任与使用场景得到评审前应留在发布输入之外。

已允许文件内部仍可能发生语义越界。PR 评审需要解释能力 owner、真实消费者、副作用或持久状态，以及为什么现有宿主或产品不能承担。机器检查约束发布范围，不是语义隔离或安全沙箱。

## 0.1.5 项目接入闭环

0.1.5 新增 Codex 项目快照 init/update/doctor/remove 与恢复操作，只维护本产品受管内容；固定版本、来源校验、迁移和用户内容保护见 [接入说明](project-adoption.zh-CN.md)。项目配置与安装清单不是持久治理运行时。AI 工具联网更新提醒仍未实施；已发布 0.1.4 不包含新命令。
