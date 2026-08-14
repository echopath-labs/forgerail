# External Capability Packs

ForgeRail's first main Plugin keeps remote and release mutation domains outside its runtime payload.

## Cross-Workspace Orchestration

The `forgerail-cross-workspace-orchestration` Plugin is for a master task coordinating at least two genuinely independent owner workspaces, repositories, or release identities with safe parallel dependency stages. It governs owner assignment, waves, single-writer identities, independent approvals, stable handoff review, and recovery. Do not install or invoke it merely because one repository has several folders, packages, or agents.

It is read/plan/recommend by default. Host task creation, inspection, wait, messaging, and resume are Host Adapter capabilities; hosts without verified task APIs degrade to user-created sessions, stable handoffs, or serial work. RelayPact may carry delegation and returns, and EchoPath may provide authorized recovery context, but neither is required or owns ForgeRail acceptance.

## GitHub Rulesets

The `forgerail-github-rulesets` Plugin diagnoses applicability, inspects current rules and required checks, prepares an exact approval package, and verifies a returned GitHub receipt. Installation does not change Rulesets, branch protection, repository settings, or default branches.

## Release Safety

The `forgerail-release-safety` Plugin activates only for release, rollback, registry, image, CI/CD, or shared-environment work. It requires the project's own runbook and does not invent generic production procedures or contain release commands.

## Thread Closure

The `forgerail-thread-closure` Plugin activates only after implementation, validation, and task evidence are ready for closeout. It verifies ownership, durable-record status, recovery entry, Profile candidates, and context debt without implementing follow-up work or writing durable changes without confirmation.

These packs retain separate authentication, release cadence, risk, and rollback boundaries while using the same ForgeRail Profile, Task Envelope, and Return Receipt contracts.

All four are separately installed and explicitly invoked. Being present in the Marketplace means available, not recommended, enabled, required, authenticated, or authorized.
