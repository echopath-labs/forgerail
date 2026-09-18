# Install ForgeRail with npm

> This guide targets 0.1.4. Consult npm and the versioned GitHub Release for publication status.

This guide targets `@echopath-labs/forgerail@0.1.4`, source tag `v0.1.4`, on npm `latest`. The prerelease `next` channel remains separate; use the exact version below. Codex Marketplace registration and native Plugin activation are deferred for this release route.

## Requirements

Install Node.js 22 or newer on the machine running the CLI. Node.js 22 and 24 are tested. The target project does not require its own `package.json`, `node_modules`, or `.forgerail/`; install the tool globally or in a separate tools directory.

There is currently no standalone binary that bundles Node.js. The npm `forgerail` command is a Node.js executable entrypoint, not a runtime-free binary. A standalone binary is a future distribution option and does not block this npm release.

## Install and verify 0.1.4

Install the exact package from the npm registry:

```bash
npm install --global @echopath-labs/forgerail@0.1.4
forgerail validate
forgerail diagnose --workspace .
```

`validate` checks the installed package. `diagnose` reads the selected project without adopting it or modifying its files. The unscoped `forgerail` package is a reservation, not an installation source.

For a one-off CLI invocation:

```bash
npx --yes @echopath-labs/forgerail@0.1.4 diagnose --workspace .
```

## Load the packaged guidance in an Agent

The npm package includes all four Skills and their references. Installing npm does not register Skills in Codex or any other Agent. Find the global package directory with:

```bash
npm root --global
```

Append `@echopath-labs/forgerail` to that directory. Its independent entrypoints are:

| Skill label | Path inside the installed package |
| --- | --- |
| `$forgerail` | `skills/forgerail/SKILL.md` |
| `$forgerail-workspace-diagnosis` | `skills/forgerail-workspace-diagnosis/SKILL.md` |
| `$workspace-health-review` | `skills/workspace-health-review/SKILL.md` |
| `$architecture-convergence-audit` | `skills/architecture-convergence-audit/SKILL.md` |

In a new task in your existing Agent, provide the absolute path to the appropriate installed Skill. For Core, ask:

```text
Read <installed-package>/skills/forgerail/SKILL.md and only the references needed
for a read-only assessment of this project. Follow the project's existing
AGENTS.md and records. Identify ownership, scope, useful checks and the next step.
Do not write files, install anything, or perform remote actions. Report loadingMode
as explicit_source from the npm-installed package, not native Plugin discovery.
```

Replace the placeholder with the actual installed path. `$forgerail` by itself is not an automatic registration mechanism. CLI diagnosis is not the same as having an Agent execute the governance guidance. No new Codex task or login is needed for CLI use; a new Codex task is merely one possible host for explicit source loading.

Project bindings and automatic recovery have their own adoption requirements. Do not apply a binding that demands a native Plugin unless that dependency has actually been met. See [adoption](adoption.md).

## Release verification

The 0.1.4 release gate tests the actual installed archive, CLI validation, read-only diagnosis and package self-tests on Node.js 22 and 24. Publication closeout downloads the public artifact and checks it against the approved archive; see the [versioned release notes](release-0.1.4.md) and GitHub release for the final publication result. Historical alpha.5 receipts remain in [its release notes](release-alpha5.md).

## Upgrade, rollback and uninstall

Use the exact scoped version for upgrades. Roll back by installing the previously verified exact version again; preserve project records and user changes. To remove the tool:

```bash
npm uninstall --global @echopath-labs/forgerail
```

Uninstalling the package does not remove user project bindings or records. Review any previously approved binding separately. Existing historical Plugin instructions remain in prior release runbooks; Marketplace setup is not part of this npm installation flow.
