# ForgeRail

ForgeRail is an engineering guidance and governance framework for Coding Agents.

It observes a workspace, recommends improvements only when evidence warrants them, composes applicable rules, launches the host Agent with explicit scope and approval boundaries, and verifies observable results. It does not replace the Agent or force a new specification system onto the project.

## First Alpha Shape

- `$forgerail`: task-level guidance and guardrails.
- `$forgerail-workspace-diagnosis`: bounded read-only diagnosis that follows existing workspace habits first.
- `$workspace-health-review`: independently invokable workspace governance health pack.

GitHub Rulesets, Release Safety, and Thread Closure are separately distributed Capability Packs because they have independent authentication, risk, lifecycle, and release boundaries.

The EchoPath Labs Marketplace candidate includes `forgerail-github-rulesets`, `forgerail-release-safety`, and `forgerail-thread-closure` as separate, explicitly installed Plugins with `ON_USE` policy. They are not installed or activated merely because the main ForgeRail Plugin is selected.

## Architecture

ForgeRail composes four layers:

1. Core governance;
2. optional Capability Packs;
3. an effective Workspace Profile resolved from existing sources;
4. a temporary Task Envelope.

The Profile is computed by default. ForgeRail does not create `.forgerail/profile.yaml`, edit `AGENTS.md`, or install OpenSpec merely because it was invoked.

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

An npm installation exposes the same deterministic CLI through the `forgerail` binary shim:

```bash
forgerail validate
forgerail diagnose --workspace .
forgerail adoption-plan --workspace . --host codex
```

## Install The Prerelease

After `v0.1.0-alpha.1` is published, register the exact ForgeRail Marketplace snapshot and install the main Plugin:

```bash
codex plugin marketplace add echopath-labs/forgerail --ref v0.1.0-alpha.1
codex plugin add forgerail@echopath-labs
```

Start a new Codex task after installation. Install high-risk Capability Packs separately and only when the project needs them. See [Installation And Adoption](docs/installation.md) and [Progressive Adoption](docs/adoption.md) for exact commands, adoption levels, Host Adapter status, upgrade, rollback, and uninstall boundaries.

## Status

The public bootstrap and Node.js 22/24 contract CI are complete. `0.1.0-alpha.1` remains a signed release candidate until its ordinary branch/PR CI and independent release approval complete; the commands above become a supported install path only after the tag exists.
