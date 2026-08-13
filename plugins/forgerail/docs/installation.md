# Installation And Adoption

ForgeRail is primarily an Agent Plugin. The npm package is an optional deterministic CLI and compatibility payload.

## Install

After `v0.1.0-alpha.1` is published, register the immutable Marketplace snapshot and install the main Plugin:

```bash
codex plugin marketplace add echopath-labs/forgerail --ref v0.1.0-alpha.1
codex plugin add forgerail@echopath-labs
```

Start a new Codex task after installation so discovery uses the installed snapshot. The new task must discover:

- `$forgerail`;
- `$forgerail-workspace-diagnosis`;
- `$workspace-health-review`.

The versioned Marketplace registration is the Plugin release identity; do not replace the tag with a mutable branch when reproducibility matters. For local canonical testing, build a disposable bundle or npm tarball; do not point production workspaces at an uncommitted source tree.

## Optional Capability Pack Plugins

Install only the packs the project needs. Installation makes a pack available; it does not authenticate, activate, require, or approve its external effects.

```bash
codex plugin add forgerail-github-rulesets@echopath-labs
codex plugin add forgerail-release-safety@echopath-labs
codex plugin add forgerail-thread-closure@echopath-labs
```

The Rulesets and Release Safety packs remain read-first. Ruleset mutations, repository protection changes, publishing, deployment, and lifecycle changes require their own exact approvals.

## Optional npm CLI

The npm package is not required by the Agent Plugin. After registry publication, use an exact prerelease when validating or diagnosing a workspace:

```bash
npx --yes forgerail@0.1.0-alpha.1 validate
npx --yes forgerail@0.1.0-alpha.1 diagnose --workspace .
```

For a persistent CLI shim:

```bash
npm install --global forgerail@0.1.0-alpha.1
forgerail validate
```

## Adoption

Installation makes capabilities available. It does not edit a project's `AGENTS.md`, create `.forgerail/`, install OpenSpec, or make Workspace Health mandatory. Project adoption is a separate, explicit decision.

ForgeRail uses progressive adoption:

1. **Plugin Only** is the default and leaves the workspace unchanged.
2. **Lightweight Adoption** requires an exact read-only plan and user confirmation. One host gets a versioned managed block; multiple hosts may share `FORGERAIL.md` through thin bindings.
3. **Persisted Governance** is evidence-gated and deferred in alpha.1; the CLI will not generate `.forgerail/` state.

The optional CLI can prepare, but never apply, a candidate:

```bash
forgerail adoption-plan --workspace . --host codex
forgerail adoption-plan --workspace . --host codex --host claude-code --host cursor
```

Codex is the only `supported` Host Adapter in alpha.1. Claude Code and Cursor are published as `profile-only` boundaries so their target files and limitations are explicit without claiming verified activation. The host Agent must show the exact proposal, obtain confirmation, preserve unrelated content, write only the approved paths, then verify discovery in a new task or equivalent supported check and return a Host Binding Receipt.

See [Progressive Adoption](adoption.md) for the full model, support matrix, verification, and removal semantics.

## Upgrade And Reinstall

Register the new exact Marketplace tag, reinstall the selected Plugin names from `echopath-labs`, then start a new Codex task. Repeat Skill discovery and a bounded read-only diagnosis smoke. Upgrade from one exact npm version to another. Reinstall must preserve project files and Profile sources.

## Rollback And Uninstall

Re-register the last validated Marketplace tag and reinstall the selected Plugin names, or return to the frozen AGW version. Remove ForgeRail Plugins with the Codex plugin command surface and remove the optional CLI with `npm uninstall --global forgerail`; do not delete project records, Agent instructions, or Git history. AGW remains the compatibility rollback until the migration gate is separately approved.

## Release Boundary

Publishing npm, moving `latest`, pushing a public candidate, tagging, creating a GitHub Release, or changing AGW lifecycle requires separate approval and exact release receipts.

See [ForgeRail 0.1.0-alpha.1 Release Runbook](release.md) for the project-owned gate order and rollback boundary.
