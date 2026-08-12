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

## Local Validation

```bash
node scripts/forgerail.mjs validate
node scripts/forgerail.mjs validate-fixtures
node scripts/forgerail.mjs diagnose --workspace scripts/fixtures/workspaces/markdown-existing
```

An npm installation exposes the same deterministic CLI through the `forgerail` binary shim:

```bash
forgerail validate
forgerail diagnose --workspace .
```

## Status

This is a canonical pre-release implementation source. It is not yet a published usable npm or GitHub release.
