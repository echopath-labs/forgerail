# Cursor 本地 Executor Canary — 已退出

曾随包分发至 0.1.2 的实验执行器已从下一份源码候选移除，不再包含其 CLI、运行库、专用 schema 和测试。既有发布保持不变；保留本页以说明原文档入口的变化。

Cursor 指令与 rules 绑定保持 `profile-only`。执行、超时、取消和恢复由宿主或独立受支持的委派工具（如 RelayPact）承担；不会自动迁移或新增 RelayPact 依赖。详见[产品边界](product-boundary.zh-CN.md)。
