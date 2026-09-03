# ForgeRail 跨工作区编排

这是一个按需安装的 ForgeRail Capability Pack，用于治理真正具有独立 owner workspace、repository 或 release identity 的安全并行工作。

当主控任务需要划分产品 owner、依赖波次、single writer、独立审批门、稳定 handoff、receipt 评审与部分失败恢复时使用。每个部署都必须声明 `deploymentEnvironment`（`development`、`preview`、`staging` 或 `production`）；只有生产部署会在 release approval 之外追加独立的 production-change gate。普通单仓任务、monorepo 目录拆分或同一 branch/PR/release 的并行写入不应触发。

ForgeRail 负责治理和验收；RelayPact 可选地承担委派与回传 transport，EchoPath 可选地提供获授权的恢复上下文，两者都不是硬依赖。安装只代表可用，不会自动创建任务、写 durable record、远端集成、发布或改变 lifecycle。

许可证：Apache-2.0。
