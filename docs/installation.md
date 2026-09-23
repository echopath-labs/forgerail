# Install ForgeRail with npm

> This guide targets 0.1.5. Consult npm and the versioned GitHub Release for publication status.

This guide targets `@echopath-labs/forgerail@0.1.5`, source tag `v0.1.5`, on npm `latest`. The prerelease `next` channel remains separate; use the exact version below. Codex Marketplace registration and native Plugin activation are deferred for this release route.

## Requirements

Install Node.js 22 or newer on the machine running the CLI. Node.js 22 and 24 are tested. The target project does not require its own `package.json`, `node_modules`, or `.forgerail/`; install the tool globally or in a separate tools directory.

There is currently no standalone binary that bundles Node.js. The npm `forgerail` command is a Node.js executable entrypoint, not a runtime-free binary. A standalone binary is a future distribution option and does not block this npm release.

## Install and verify 0.1.5

First inspect any global installation, for example with `npm list --global @echopath-labs/forgerail --depth=0`. If another project depends on a different version, keep it and use exact-version `npm exec` below or an isolated tools directory. When global installation is appropriate, install the exact package from npm:

```bash
npm install --global @echopath-labs/forgerail@0.1.5
forgerail validate
forgerail diagnose --workspace .
```

`validate` checks the installed package. `diagnose` reads the selected project without adopting it or modifying its files. The unscoped `forgerail` package is a reservation, not an installation source.

For a one-off CLI invocation:

```bash
npx --yes @echopath-labs/forgerail@0.1.5 diagnose --workspace .
```

## Delegate setup to an agent

Open your coding agent in the **target project** and send it the [complete prompt in the README](../README.md#five-minute-quickstart). The human states the outcome and decisions; the agent reads the docs, inspects the workspace, performs authorized steps, and returns evidence. You do not need to learn every CLI flag before delegating. The prompt authorizes safe setup steps for this project without repeated approval. Existing adoption, unknown same-name Skills, or drift require source and ownership checks before a write.

The agent should choose a route supported by its actual host: Codex has the 0.1.5 **project adoption lifecycle** shown below; other agents can **explicitly load** the packaged Skills while following their host rules. Claude Code and Cursor adapters remain `profile-only`. A template or package file does not establish automatic discovery or activation. If the host cannot support a project binding, report the completed installation and explicit loading alongside the missing discovery verification.

Ask the agent to return a short result with the exact version and source, chosen host route, changed files, static checks, host discovery evidence, behavior on a concrete task, and any unverified layer or real blocker. On failure, report the current state and recovery entry instead of claiming success.

### Concrete Codex project adoption commands

For a new project adoption, Codex should follow this sequence (`<project>` is the target project's absolute path):

```bash
node --version
npm exec --yes --package=@echopath-labs/forgerail@0.1.5 -- forgerail init --workspace "<project>"
# Review operations, warnings, change count, and planSha256; confirm managed ownership
npm exec --yes --package=@echopath-labs/forgerail@0.1.5 -- forgerail init --workspace "<project>" --apply <planSha256>
npm exec --yes --package=@echopath-labs/forgerail@0.1.5 -- forgerail validate
npm exec --yes --package=@echopath-labs/forgerail@0.1.5 -- forgerail doctor --workspace "<project>"
```

If an older version is already adopted, follow [project adoption and recovery](project-adoption.md) to inspect its identity and choose the appropriate `update` or legacy migration path. A failed `init` is not permission to overwrite it. `init` returns a read-only plan by default; `--apply` binds the current plan but does not grant permission. A successful adoption places pinned project Skills, a managed `AGENTS.md` block, and installation records under `.forgerail/`. The latter do not enable persisted governance. The CLI can live in a tools environment; the target does not become a Node project.

**Test three distinct layers:**

| Layer | Evidence | Does not prove |
| --- | --- | --- |
| Static readiness | `validate`, `doctor`, and the planned versus actual managed paths | Codex discovered or followed a Skill |
| Host discovery | A fresh task confirms the Skill path, source and availability seen by that host | The model followed it on a task |
| Behavior | On a small reversible engineering task, Codex reads project rules, scopes the change, runs applicable checks, and reports results | Every future task will do so |

For Codex project adoption, open a **fresh task in the same project** and send the following prompt, which does not name ForgeRail. Afterwards, check the host's Skill discovery source and the project guidance paths actually read during the task. If the host offers no observable discovery evidence, mark host discovery unverified. Other hosts can test behavior on a real engineering task, but explicit loading proves guidance only for that task. Use an existing, bounded, non-trivial task that requires a code change, such as a confirmed failing test or defect. Do not invent a product change merely for the test.

```text
Choose one bounded, non-trivial defect from this project's existing backlog or failing tests that requires a code change. Fix it locally and show that the problem is resolved. Do not commit, push, merge, or publish. If there is no real task that is safe to take on, explain why and stop rather than inventing a test change.
```

The follow-up does not name ForgeRail, so it tests whether project guidance enters ordinary engineering work. Use observed file reads, actions and results as evidence; an Agent's claim that it “triggered” is not independent proof. If the current host cannot start a fresh task, provide the follow-up prompt and mark discovery and behavior unverified. Explicit loading in the original task is not automatic discovery.

Core governance applies to non-trivial features, fixes, refactors, dependency/configuration and API changes, Git delivery, and consequential investigations or handoffs. Casual conversation, purely read-only questions, and simple command output do not start the full engineering checklist. Explicit workspace diagnosis and health reviews have separate Skill triggers. Host discovery, project bindings, and higher-priority instructions affect activation; ForgeRail does not bypass enforced host rules.

## Load the packaged guidance in an Agent

The npm package includes all four Skills and their references. Installing npm does not register Skills in Codex or any other Agent. **Only after confirming the global package is 0.1.5**, find its directory with:

```bash
npm root --global
```

Append `@echopath-labs/forgerail` to that directory. If the global version differs, choose an isolated tools directory outside the target project and install the exact version there:

```bash
npm install --prefix "<tools-dir>" --no-save @echopath-labs/forgerail@0.1.5
```

The package path is then `<tools-dir>/node_modules/@echopath-labs/forgerail`. `npm exec` runs an exact-version CLI but does not make that version the global Skill path. With either route, verify that the package's `package.json` reports version `0.1.5` before loading. Its independent entrypoints are:

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

The 0.1.5 release gate tests the actual installed archive, CLI validation, read-only diagnosis and package self-tests on Node.js 22 and 24. Publication closeout downloads the public artifact and checks it against the approved archive; see the [versioned release notes](release-0.1.5.md) and GitHub release for the final publication result. Historical alpha.5 receipts remain in [its release notes](release-alpha5.md).

## Upgrade, rollback and uninstall

Use the exact scoped version for upgrades. Roll back by installing the previously verified exact version again; preserve project records and user changes. To remove the tool:

```bash
npm uninstall --global @echopath-labs/forgerail
```

Uninstalling the package does not remove user project bindings or records. Review any previously approved binding separately. Existing historical Plugin instructions remain in prior release runbooks; Marketplace setup is not part of this npm installation flow.
