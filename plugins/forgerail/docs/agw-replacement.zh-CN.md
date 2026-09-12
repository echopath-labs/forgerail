# 完整取代 AGW：范围与验收

本文描述**未发布的后续开发**。已发布 alpha.4 不因此获得完整替代资格；开发期间版本字段仍沿用发布基线，正式交付前必须形成新的不可变版本和证据。

## 主包需要完整承接什么

主 Plugin 应自包含 AGW 的启用/跳过条件、最小属主、Git 生命周期、记录系统选择、根索引与关系维护、影响验证、独立授权、阶段摘要、交接、可选结构化交换，以及独立 WHR 的详细信号、报告模板和平台边界。按需 references 是正式实现入口，不再加载旧 AGW 文件补齐规则。

项目自己的分支策略、OpenSpec/OpenDomain、组件验证、发布流程和业务规则继续由项目持有。外部 Release Safety、Thread Closure 等 Pack 增强相关任务，不成为恢复旧 AGW 基础安全规则或普通收尾的必要条件。

完整替代按行为判断，不要求逐字复制，也不要求每条声明式规则都由 CLI 强制执行。Envelope/Receipt 可通过当前任务和项目已有记录表达，不强制增加 JSON 文件或第二套历史。已有明确授权应复用，新记录系统或超出范围的动作才需补充确认。

## 验收顺序

1. 冻结实际安装副本及其摘要，区分通用行为、版本差异和项目扩展。
2. 检查每项行为在主包中的内容、owner 和加载入口。
3. 在没有旧 AGW 或相邻 Pack 的打包环境检查引用闭包；这只是结构验证。
4. 在独立宿主任务执行[真实工程场景](agw-replacement-validation.md)，保留发现来源、提示词、操作轨迹、初始/最终状态和独立评审结果。
5. 将通过的证据绑定到后续精确发布版本，再批准具体项目接入。

[行为清单](agw-replacement-coverage.json)中的真实行为状态保持 pending，直到相应证据存在。旧 shadow 短语测试、schema 和模拟脚本都不能证明实际 Agent 等价。AGW 仓库归档、重定向或弃用是独立生命周期决策，不是单项目功能替代的必要前置条件。

## 如何接入已有项目

- 每个受支持的 Codex 环境安装一次合格版本；项目克隆不会携带机器级 Plugin。
- 用项目现有 onboarding 文档记录固定版本、setup、发现检查和回退入口。
- 根工作区保留共用政策，独立仓库保留自己的工程和交付政策。单独克隆或位于外部的 worktree 必须能自行找到必要规则；不能假设原父目录指令或嵌套 Skills 会被加载。
- 从宿主实际输出确认 Skill 身份。既有 Codex 证据使用 `forgerail:forgerail`、`forgerail:forgerail-workspace-diagnosis`、`forgerail:workspace-health-review`、`forgerail:architecture-convergence-audit`；未来候选仍需重新验证。
- 只切换获批项目的准确激活入口。同名 WHR 和 AGW/ForgeRail 各只能有一个有效 owner。回退副本若仍在自动发现目录中，不能声称旧入口已停用。
- 缺少 Plugin 时明确报告依赖缺失，执行已批准的 setup 或恢复旧激活；不假装治理已生效。
- 单宿主也可用 managed block，多宿主可用共享契约；初次验证无需写入。adoption-plan 不是完整 AGW 迁移器，不负责删除旧指令、处理同名 Skill 或证明父目录政策恢复。

## 回退与验证边界

迁移前保存原激活文件、Skill 摘要、版本和恢复入口。失败时核对并发修改，只恢复获批路径，再由新任务验证原 owner。保留代码、记录、Git 历史和用户已有改动；不要顺手卸载其他 Plugin 共用的 Marketplace。卸载不会删除项目绑定。

验收比较前后状态，不要求原本有改动的仓库变干净。Windows、其他宿主及未经测试的项目版本都不从 macOS 成功推断通过。当前用户项目在完整能力验收之前继续使用 AGW。

详细英文协议：[qualification](agw-replacement.md)。
