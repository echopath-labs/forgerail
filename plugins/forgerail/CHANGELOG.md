# Changelog

## Unreleased

No shipping changes yet.

## 0.1.0-alpha.4 - 2026-09-01

- Make contract identifiers, calendar values and portable paths fail closed and align the CLI with the published schemas.
- Reject duplicate Profile, Pack and cross-workspace identities; bind Launch Contracts to the validated Effective Profile and every required active Pack.
- Harden Adoption and source-repository projection construction against symlink traversal, sensitive files, unsupported file types, partial output and non-deterministic inventory modes.
- Bind each approved Adoption write to its canonical workspace and complete executable metadata using one immutable apply-time snapshot, atomically replace an existing managed binding without a missing-target window, and preserve literal four-digit years including `0000` through `0099`.
- Make Shadow comparison independent from its expected phrases and fail non-zero when coverage is missing.
- Reject unknown orchestration operations, dependencies and conflicting terminal events; handle malformed receipts and package metadata without crashes or private absolute paths.
- Add complete Node.js 22 and 24 integrity, Core, shadow, release, consumer, Directory and external Pack gates while preserving Skills-only installation, no project Node.js requirement, no implicit `.forgerail/` state and Apache-2.0.

## 0.1.0-alpha.3 - 2026-08-31

- Keep the main Agent Plugin within Codex's maximum of three `defaultPrompt` entries while preserving discovery and direct invocation for all four ForgeRail Skills.
- Route the third starter prompt to either Workspace Health Review or the independently owned Architecture Convergence Audit without merging their ownership or activation boundaries.
- Add deterministic prompt-cardinality validation and a fresh disposable-host compatibility check; classify unrelated `openai-primary-runtime/template-creator` icon warnings as external observations rather than ForgeRail failures.
- Preserve the Skills-only, no-project-Node, no-implicit-`.forgerail/`, Apache-2.0, optional scoped npm CLI, and unscoped reservation boundaries from alpha.2.

## 0.1.0-alpha.2 - 2026-08-30

- Add the built-in, independently invoked `architecture-convergence-audit` Pack with Analyze First, read-only behavior, evidence-backed ownership maps, retention burden, deletion-first slices, and no external-write or persisted-state authority.
- Add private capability-harvest shadows plus sanitized Diagnosis and Health separation fixtures without changing existing Core nouns or creating a second Health Pack.
- Prepare a Skills-only Universal Plugins Directory candidate with root-confined visual assets, five positive and three negative evaluations, deterministic validation, and no project Node.js or `.forgerail/` requirement.
- Add ForgeRail-specific Privacy and Terms documents, GitHub Issues support, a confirmed Productivity category, and an all-platform-supported-regions intent while keeping publisher, permission, portal-format, submission, and publication gates explicit.
- Preserve exact-tag Marketplace installation as the available route and keep the scoped npm CLI optional; alpha.2 subsequently completed its separately approved remote integration and prerelease publication.

## 0.1.0-alpha.1 - 2026-08-13

- Establish the first ForgeRail Agent Plugin with Core, Workspace Diagnosis, and Workspace Health Review entrypoints.
- Add deterministic contracts for Capability Packs, effective Profiles, Task Envelopes, Launch Contracts, Return Receipts, and Profile evolution candidates.
- Add progressive project adoption with deterministic Adoption Plan, Host Adapter, and Host Binding Receipt contracts; a supported Codex binding; profile-only Claude Code and Cursor boundaries; and read-only single-host or multi-host planning without an apply command or `.forgerail/` state.
- Add offline validation, read-only diagnosis fixtures, deterministic public projection, and a disposable npm consumer lifecycle covering install, diagnosis, Launch/Receipt, upgrade, rollback, reinstall, and uninstall.
- Publish the EchoPath Labs Marketplace catalog with the main Plugin plus separately installed GitHub Rulesets, Release Safety, and Thread Closure Capability Pack Plugins.
- Add Cross-Workspace Orchestration as a separately installed, explicit-use Capability Pack for genuine independent owner boundaries; keep it out of the main Plugin's default Skill set.
- Add Node.js 22 and 24 Plugin contract CI, frozen AGW behavior coverage, installation guidance, and a project-owned prerelease runbook.
- Publish the optional CLI under the official `@echopath-labs/forgerail` organization scope while preserving the `forgerail` binary shim and leaving the unscoped reservation package unchanged.
- Adopt Apache-2.0 for ForgeRail and every Capability Pack included in this release candidate.
