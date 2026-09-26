# Changelog

## Unreleased

No shipping changes yet.

## 0.1.7 - 2026-09-26

- Support the exact Cursor IDE Agent shared-Core route when an applicable `AGENTS.md` points to the matching project-local ForgeRail Core. Keep the Cursor Rule fallback `profile-only`; broad Cursor CLI behavior, Cloud Agent behavior, and automatic activation remain unverified.
- Add iteration and escalation discipline to the Core guidance: preserve a concise hypothesis ledger, escalate repeated same-class failures to the shared layer, keep optional uncertainty off the critical path, and stop at explicit human gates with a resumable handoff.
- Add adoption closeout regressions and three isolated Codex CLI behavior sessions for the iteration-discipline candidate. These bounded sessions are acceptance evidence, not cross-host or statistical reliability proof.
- Preserve explicit upgrade and recovery boundaries. Existing project snapshots do not update automatically, published 0.1.6 remains immutable, and release or consumer adoption still requires separate authorization.

See [release notes](docs/release-0.1.7.md). Publication status is recorded by npm and the versioned GitHub Release.

## 0.1.6 - 2026-09-23

- Make installation and adoption guidance agent-first: give a coding agent a version-pinned setup task, let it select the verified host route, and report package checks, host discovery, and task behavior separately.
- Explain exact-version CLI use and isolated Skill loading without overwriting a different global installation. Keep the public repository root and nested Plugin documentation aligned.
- Retain 0.1.5 runtime behavior and support boundaries; this patch does not add a new Host Adapter or automatic Skill activation.

See [release notes](docs/release-0.1.6.md). Publication status is recorded by npm and the versioned GitHub Release.

## 0.1.5 - 2026-09-19

- Add shared, action-scoped rule conflict preflight guidance: reuse valid user decisions, distinguish overridable host defaults from mandatory restrictions, and explain unresolved conflicts without adding a configuration editor or routine confirmation gate.
- Add a Codex project adoption lifecycle: read-only init/update/remove plans, offline doctor, bounded managed-file maintenance, legacy snapshot migration and guarded rollback.
- Separate project installation metadata from persisted governance; retain the original v1 adoption contract and writer permissions.
- Add project-operation regression coverage and package-consumer checks.
- Bind rollback to durable completion and file identity; reject oversized recovery plans, preserve instruction-file separators, and prevent duplicate v1/project bindings.

See [release notes](docs/release-0.1.5.md). Publication status is recorded by npm and the versioned GitHub Release.

## 0.1.4 - 2026-09-18

Continuous-progress policy patch; publication status is recorded by npm and the versioned GitHub Release. See [release notes](docs/release-0.1.4.md).

- Clarify Core continuous progress and authorization reuse: complete covered review/fix/verification steps without repetitive confirmation, while retaining scope-specific delivery authorization and host controls.

## 0.1.3 - 2026-09-17

Product boundary and reliability patch candidate; publication is confirmed by npm and the versioned GitHub Release. See [release notes](docs/release-0.1.3.md).

- Preserve ordinary non-Git directories named config, HEAD, objects and refs; retain conservative handling of real damaged metadata.
- Return Host Adapter bindingModes field errors before semantic operations, through both library and CLI.
- Remove the experimental Cursor executor CLI/runtime, dedicated schemas and tests from the next candidate. Direct experimental-path consumers must use a separately supported host/delegation facility. Cursor instruction bindings and published releases remain unchanged.
- Make script publication explicit and check source and npm artifact inventories; clarify governance ownership and deferred Control System plans.

## 0.1.2 - 2026-09-16

Local observation and Envelope validation patch candidate. Publication is confirmed by npm and the versioned GitHub Release. See [release notes](docs/release-0.1.2.md) and [compatibility details](docs/reliability.md).

- Make local receipt observation independent of untracked-file display preferences; distinguish damaged Git metadata from ordinary non-Git directories.
- Disable Git fsmonitor, optional index writes and lazy object retrieval during receipt observation. Return unavailable for active external clean/process filters, submodules, hidden index entries or non-UTF-8 Git output instead of certifying clean. Unused filter configuration remains supported.
- Return field diagnostics for malformed Envelope operations, including embedded Launch inputs, before semantic checks.

## 0.1.1 - 2026-09-16

Reliability patch candidate; publication is confirmed by npm and the versioned GitHub Release. See [release notes](docs/release-0.1.1.md) and [compatibility details](docs/reliability.md).

- Validate every Profile candidate, including overridden inputs; make effective rule selection and conflict reporting independent of input order.
- Fail receipt verification on invalid paths or unavailable Git; retain non-Git and unborn-branch support and explicitly classify self-reported claims. A v1 `complete` request now returns `valid=false` and `closeout=incomplete` because its task/evidence strings are not independently verified.
- Return malformed Profile and CLI input diagnostics safely. CLI errors now use JSON on stdout and a nonzero exit status; stderr parsers must migrate.
- Protect approved binding writes with cooperating-writer locks, source/content drift checks and independent recovery snapshots; preserve edited targets on unsafe rollback. This is a controlled single-writer protocol, not atomic CAS against arbitrary editors.
- Preserve bytes outside managed blocks and trailing whitespace; repeated unchanged writes are no-ops. Reject invalid UTF-8 targets and malformed approved replacement boundaries before writing.
- Add regression coverage to installed-package and maintainer checks on Node.js 22 and 24. Optional external Packs remain at alpha.4.

## 0.1.0 - 2026-09-15

First stable release for npm installation and explicit packaged-Skill loading. The main package uses the `latest` channel; optional external Packs remain at alpha.4. Native Plugin activation, Marketplace submission, standalone binaries and persisted governance remain outside this release scope.

- Add optional, language-independent engineering paradigm guidance to the existing architecture audit for planning, refactor assessment and bounded drift review, using accepted project choices without imposing a directory layout or new governance owner.
- Make `npm test` work from installed archives; retain source documentation checks in CI and the maintainer gate, and test the installed suite in the disposable consumer lifecycle.
- Document the existing repository-local Skill snapshot route, including exact source identity, project-rule preservation, paired rollback checks and fresh-session handoff.
- Qualify the bounded MVP path with template generation and a real project workflow adoption task, existing workflow checks, rollback and a fresh project-root session. This does not certify native Plugin activation or every host/language.

## 0.1.0-alpha.5 - 2026-09-12

Published on npm as `@echopath-labs/forgerail@0.1.0-alpha.5` under `next`; `latest` remains alpha.4. See the [GitHub prerelease](https://github.com/echopath-labs/forgerail/releases/tag/v0.1.0-alpha.5). npm installation with explicit packaged-Skill loading is the current delivery route; Codex Marketplace registration and standalone binaries are deferred.

Repository documentation was corrected after publication to reflect this release. The immutable alpha.5 package and tag retain their original documentation snapshot.

- Make the main Plugin self-contained for AGW/WHR baseline guidance: Git lifecycle, impact checks, durable records, staged progress, handoff and optional structured exchanges.
- Preserve unrelated working-tree and staged changes, stop unsafe integration, and keep workspace health review read-only until scoped edits are approved.
- Add portable recovery guidance to shared and host binding templates, with regression checks that retain the recovery block in approved adoption output.
- Keep main-package checks independent of optional external Packs; return structured CLI diagnostics when maintainer-only validation inputs are missing.
- Reuse two user-operated source-loading behavior trials; distinguish this evidence from native Plugin activation and real consumer compatibility.
- Exclude the Marketplace catalog from the npm payload so private-source and public-projection packages contain the same files.
- Include the optional experimental Cursor local-executor canary and its scoped tests; this does not certify native Cursor Plugin support.
- Keep optional external Capability Pack Plugins at alpha.4. Project migration, Directory submission and legacy AGW lifecycle remain separate actions.

## 0.1.0-alpha.4 - 2026-09-01

- Make contract identifiers, calendar values and portable paths fail closed and align the CLI with the published schemas.
- Reject duplicate Profile, Pack and cross-workspace identities; bind Launch Contracts to the validated Effective Profile and every required active Pack.
- Harden Adoption and source-repository projection construction against symlink traversal, sensitive files, unsupported file types, partial output and non-deterministic inventory modes.
- Restore failed Adoption replacements with one atomic rename, reject sensitive projection filenames case-insensitively, and reserve projection outputs without replacing concurrent directories.
- Materialize every projection descendant through retained no-follow output-directory identities, and represent requested Launch Contract Packs as a schema-native identity-to-manifest-digest map.
- Bind each approved Adoption write to its canonical workspace and complete executable metadata using one immutable apply-time snapshot, atomically replace an existing managed binding without a missing-target window, and preserve literal four-digit years including `0000` through `0099`.
- Reject existing Adoption targets unless both managed-block boundary markers occur exactly once, preventing a replacement from preserving duplicate closing or opening markers.
- Reject non-canonical Adoption paths and mixed-workspace write sets, preserve Task Envelope inputs during Launch construction, encode Effective Profile Packs as identity-keyed objects, and apply projection directory deny lists case-insensitively.
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
