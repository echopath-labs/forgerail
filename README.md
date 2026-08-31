# ForgeRail

ForgeRail is an engineering guidance and governance framework for Coding Agents.

This canonical source is preparing the local `0.1.0-alpha.3` / `v0.1.0-alpha.3` forward-fix candidate. It is not yet remotely integrated, released, or listed in the Universal Plugins Directory; the currently installable public version remains alpha.2.

It observes a workspace, recommends improvements only when evidence warrants them, composes applicable rules, launches the host Agent with explicit scope and approval boundaries, and verifies observable results. It does not replace the Agent or force a new specification system onto the project.

## First Alpha Shape

- `$forgerail`: task-level guidance and guardrails.
- `$forgerail-workspace-diagnosis`: bounded read-only diagnosis that follows existing workspace habits first.
- `$workspace-health-review`: independently invokable workspace governance health pack.
- `$architecture-convergence-audit`: independently invoked, medium-risk, read-only capability-owner and minimal-boundary audit.

The Architecture Convergence Pack is a post-alpha source candidate. It remains
available rather than automatically enabled, does not require ForgeRail Core to
run first, and creates no Profile, task ledger, Receipt, `.forgerail/` state, or
external issue.

GitHub Rulesets, Release Safety, and Thread Closure are separately distributed Capability Packs because they have independent authentication, risk, lifecycle, and release boundaries.

Cross-Workspace Orchestration is also separately distributed and explicit-use. It applies only when a master task coordinates multiple genuine owner/repository/release boundaries with safe parallel dependency stages; it is not a general multi-agent mode for one repository.

The EchoPath Labs Marketplace candidate includes `forgerail-github-rulesets`, `forgerail-release-safety`, `forgerail-thread-closure`, and `forgerail-cross-workspace-orchestration` as separate, explicitly installed Plugins with `ON_USE` policy. They are not installed or activated merely because the main ForgeRail Plugin is selected.

## Architecture

ForgeRail composes four layers:

1. Core governance;
2. optional Capability Packs;
3. an effective Workspace Profile resolved from existing sources;
4. a temporary Task Envelope.

The Profile is computed by default. ForgeRail does not create `.forgerail/profile.yaml`, edit `AGENTS.md`, or install OpenSpec merely because it was invoked.

The Control System migration now includes versioned Workspace/Profile, Task Control, Review Authority, Validation Topology, Execution Context, Adapter Observation, and Cross-Workspace Pack composition contracts while preserving the alpha v1 contracts. See [Control Profile Contracts](docs/control-profile-contracts.md), [Control Task Contracts](docs/control-task-contracts.md), [Control Authority And Validation Contracts](docs/control-authority-validation-contracts.md), [Cross-Workspace Pack Composition Contract](docs/cross-workspace-pack-composition-contract.md), and the pre-evaluator [Control System Fixture Matrix](docs/control-system-fixture-matrix.md).

Workspace adoption is progressive: Plugin Only by default; user-confirmed lightweight bindings when durable guidance is valuable; persisted `.forgerail/` governance only for future evidence-backed machine configuration or repeated conflicts. Host-specific instruction files are adapters, not ForgeRail Core. Codex is supported for alpha.1; Claude Code and Cursor profiles are explicit but unverified.

## Local Validation

```bash
node scripts/forgerail.mjs validate
node scripts/forgerail.mjs validate-fixtures
node scripts/forgerail.mjs validate-adoption
node scripts/validate-release.mjs
node scripts/forgerail.mjs diagnose --workspace scripts/fixtures/workspaces/markdown-existing
node scripts/forgerail.mjs adoption-plan --workspace scripts/fixtures/workspaces/markdown-existing --host codex
```

The optional official npm package is `@echopath-labs/forgerail`; it exposes the same deterministic CLI through the short `forgerail` binary shim. The unscoped `forgerail` package remains a reservation and is not the product install path.

```bash
npm install --global @echopath-labs/forgerail@0.1.0-alpha.2
forgerail validate
forgerail diagnose --workspace .
forgerail adoption-plan --workspace . --host codex
```

## Install The Prerelease

The intended future default is the Universal Plugins Directory UI, but ForgeRail is not listed there yet. Until a separate submission, review, and publication complete, install the released exact ForgeRail Marketplace snapshot:

```bash
codex plugin marketplace add echopath-labs/forgerail --ref v0.1.0-alpha.2
codex plugin add forgerail@echopath-labs
```

Start a new Codex task after installation. Install high-risk Capability Packs separately and only when the project needs them. See [Installation And Adoption](docs/installation.md) and [Progressive Adoption](docs/adoption.md) for exact commands, adoption levels, Host Adapter status, upgrade, rollback, and uninstall boundaries.

The Agent Plugin does not require Node.js or `package.json` in the target project. npm/npx remains optional maintainer and validation tooling.

## Status

The immutable public alpha.2 remains the current install source. Alpha.3 is a local source-first forward fix that limits the main Plugin to three starter prompts while keeping all four Skills independently discoverable and invokable. Its proposed version and tag do not authorize public projection application, remote integration, release, or Directory submission/publication.
