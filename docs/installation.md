# Install ForgeRail

ForgeRail is primarily a Codex Agent Plugin. The default installation does not add Node.js, `package.json`, `node_modules`, or `.forgerail/` to the project you use it with.

The current public prerelease is `0.1.0-alpha.4`. Pin the immutable Git tag so another user can reproduce the same Plugin snapshot.

## Prerequisites

- Codex with the `codex plugin` command available;
- Git/network access to GitHub during installation;
- a new Codex task after installation so Plugin discovery starts from a fresh host context.

The target project does not require Node.js, `package.json`, `node_modules`, or `.forgerail/`. Node.js 22 or newer is required only if you choose to run ForgeRail's optional npm CLI.

## Install the Codex Plugin

```bash
codex plugin marketplace add echopath-labs/forgerail --ref v0.1.0-alpha.4
codex plugin add forgerail@echopath-labs
```

Then start a new Codex task in the project you want to assess.

## Verify the installation

Run:

```bash
codex plugin list
```

Confirm that the `forgerail@echopath-labs` Plugin is enabled. In the new task, Codex should discover these four namespaced Skills:

- `$forgerail`;
- `$forgerail-workspace-diagnosis`;
- `$workspace-health-review`;
- `$architecture-convergence-audit`.

If another Plugin defines the same short Skill name, use the exact namespaced name shown by Codex.

## First use: stay read-only

Send this request to Codex:

```text
Use $forgerail to assess this project read-only. Follow its existing AGENTS.md,
specification, ADR, CI, and documentation habits first. Do not modify files or
perform remote actions. Recommend Plugin Only or Lightweight Adoption, show the
evidence and uncertainties, and wait for my confirmation before any write.
```

A useful first result identifies the workspace and task boundary, applicable project rules, unresolved conflicts, the smallest suitable adoption level, validation evidence, explicit non-actions, and the next decision for a human. Installation alone never authorizes a write or remote operation.

## Optional Capability Pack Plugins

Capability Packs are separate Plugins with separate authentication, risk, and lifecycle boundaries. Install only the ones the project actually needs:

```bash
codex plugin add forgerail-github-rulesets@echopath-labs
codex plugin add forgerail-release-safety@echopath-labs
codex plugin add forgerail-thread-closure@echopath-labs
codex plugin add forgerail-cross-workspace-orchestration@echopath-labs
```

Installation only makes a Pack available. It does not authenticate, enable, invoke, or approve the Pack, and it does not grant repository, release, deployment, or lifecycle authority.

## Optional npm CLI

The CLI is useful for deterministic validation or read-only diagnosis, but it is not required for Plugin use:

```bash
npx --yes @echopath-labs/forgerail@0.1.0-alpha.4 validate
npx --yes @echopath-labs/forgerail@0.1.0-alpha.4 diagnose --workspace .
```

For a global CLI:

```bash
npm install --global @echopath-labs/forgerail@0.1.0-alpha.4
forgerail validate
```

The official package is scoped. The unscoped `forgerail` package is only a reservation and is not an installation source.

## Upgrade or reinstall

Marketplace registrations are exact-tag snapshots. To move to a newer release, remove the installed Plugin and Marketplace registration using the current `codex plugin` command surface, register the new exact tag, reinstall the Plugin, and start a new task. Verify the four Skills and repeat the read-only smoke test before relying on it.

Do not replace the exact tag with a mutable branch when reproducibility matters. An upgrade must not modify project files or persisted governance unless the user separately approves an exact adoption plan.

## Uninstall

Use `codex plugin remove forgerail@echopath-labs`, then remove the `echopath-labs` Marketplace registration if you no longer use any Plugin from it. Remove the optional global CLI with:

```bash
npm uninstall --global @echopath-labs/forgerail
```

Uninstalling ForgeRail must not delete project instructions, specifications, receipts, Git history, or other project records. Remove a previously approved Lightweight Adoption block only through a separate reviewed change.

## Troubleshooting

### The Skills do not appear

1. Confirm the Marketplace and Plugin are listed and enabled with `codex plugin list`.
2. Confirm the registration is pinned to `v0.1.0-alpha.4`.
3. Start a new Codex task; an already-running task may not refresh Plugin discovery.
4. Use the namespaced Skill name if another Plugin or personal Skill has the same short name.

### The project asks for Node.js

Plugin Only should not require project-local Node.js. Check that you are invoking the installed Plugin rather than running `npx`, `npm install`, or repository source. Please report a bug if normal Plugin use creates `package.json`, `node_modules`, or `.forgerail/`.

### ForgeRail proposes too much process

Ask it to remain read-only and explain why Plugin Only is insufficient. ForgeRail should recommend the smallest useful level and follow existing project governance before proposing new files.

### A command requests credentials or remote authority

Stop and review the exact Pack, identity, scope, and approval boundary. ForgeRail installation is never approval for login, publishing, repository administration, deployment, or lifecycle mutation.

For more help, see [SUPPORT.md](../SUPPORT.md). Report security concerns privately using [SECURITY.md](../SECURITY.md).

## Adoption is separate

Installation makes ForgeRail available. It does not edit `AGENTS.md`, install OpenSpec, create `.forgerail/`, or make Workspace Health mandatory. See [Progressive Adoption](adoption.md) before approving any durable project integration.
