<p align="center">
  <img src="assets/forgerail-logo.svg" alt="ForgeRail" width="520">
The 0.1.4 Core clarifies continuous progress: proceed through already-authorized work and review fixes without repeated confirmation. An explicit delivery request can cover multiple stages; passing checks alone never grants merge or release authority. Earlier published snapshots remain unchanged.

</p>

<h1 align="center">ForgeRail</h1>

<p align="center"><strong>Engineering guidance and governance for coding agents, without replacing the agent or your project's existing workflow.</strong></p>

<p align="center">
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="docs/installation.md">Installation</a> ·
  <a href="docs/adoption.md">Adoption</a> ·
  <a href="https://github.com/echopath-labs/forgerail/issues">Issues</a> ·
  <a href="CHANGELOG.md">Changelog</a>
</p>

> **Release line:** `0.1.4` continuous-progress patch candidate for npm installation and explicit packaged-Skill loading. Check the versioned GitHub Release and npm registry for publication status. Install the exact version below; native Plugin activation and experimental integrations remain outside the stable support boundary.

> **0.1.4 scope:** Generic AGW/WHR guidance is self-contained, and principal behaviors have been verified with explicit source loading. Use npm installation and explicit Agent loading; native Plugin activation and Codex Marketplace registration are deferred. See the [release notes](docs/release-0.1.4.md) and [project replacement requirements](docs/agw-replacement.md).

## Why ForgeRail?

Coding agents are good at doing work. The hard part is keeping that work aligned with the real project:

- Which repository and task actually own this change?
- What existing instructions, specifications, decisions, and CI checks already apply?
- What may the agent read or change, and what still needs a human decision?
- What evidence proves the result, and where should the next agent resume?

ForgeRail helps the agent answer those questions before it expands scope. It observes the workspace, follows existing project habits first, recommends the smallest useful governance level, and verifies observable evidence. **The agent does the work, ForgeRail guides the work, and the human decides.**

ForgeRail is not an autonomous executor, a replacement for OpenSpec or `AGENTS.md`, a security guarantee, or a reason to add process to a simple project.

## Five-minute quickstart

### 1. Install 0.1.4 with npm

Use Node.js 22 or newer and pin the version explicitly:

```bash
npm install --global @echopath-labs/forgerail@0.1.4
forgerail validate
forgerail diagnose --workspace .
```

The target project does not require its own `package.json`, `node_modules`, or `.forgerail/`. Codex Marketplace registration is deferred. A standalone binary without Node.js is not currently available.

### 2. Load guidance only when needed

The installed package contains four Skills. Use `npm root --global` to locate it, then give your existing Agent the absolute path to `@echopath-labs/forgerail/skills/forgerail/SKILL.md` for a read-only assessment. Follow the project's existing instructions and records. Report `explicit_source` loading from the npm package; npm does not register a native Plugin. See [installation and Agent loading](docs/installation.md).

### 3. Review the result

ForgeRail should return:

- the workspace and task boundary it could actually verify;
- applicable existing governance sources and unresolved conflicts;
- the smallest recommended adoption level;
- validation evidence and explicit non-actions;
- at most the next decision that needs human confirmation.

If it writes files, creates `.forgerail/`, performs a remote action, or treats installation as approval, report a bug.

## What is included?

| Skill | Use it when | Default effect |
| --- | --- | --- |
| `$forgerail` | Starting or governing a non-trivial engineering task | Guidance, scope, approval, and verification boundaries |
| `$forgerail-workspace-diagnosis` | You need a bounded picture of the current workspace | Read-only diagnosis that follows existing habits first |
| `$workspace-health-review` | You want to review recovery, ownership, and governance debt | Independent read-only health review |
| `$architecture-convergence-audit` | You need ownership, engineering paradigm or bounded drift assessment | Independent read-only ownership and minimal-boundary audit |

**Included since 0.1.0:** the existing architecture audit also offers optional [engineering paradigm guidance](skills/architecture-convergence-audit/references/engineering-paradigm.md) for planning, refactor assessment and bounded drift review. It uses project-accepted choices, does not prescribe a language or directory layout, and remains read-only.

Use the exact namespaced Skill name shown by Codex if another installed Plugin defines a Skill with the same short name.

### Optional Capability Pack Plugins

These are separate Plugins because they have different authentication, risk, and lifecycle boundaries:

- `forgerail-github-rulesets`
- `forgerail-release-safety`
- `forgerail-thread-closure`
- `forgerail-cross-workspace-orchestration`

Installing the main ForgeRail Plugin does not install, enable, authenticate, invoke, or approve them. See [External Capability Packs](docs/external-capability-packs.md).

## Progressive adoption

ForgeRail separates **availability** from **project adoption**:

| Level | What changes in the project? | When to use it |
| --- | --- | --- |
| Plugin Only | Nothing | Default; occasional guidance and diagnosis |
| Lightweight Adoption | One reviewed managed instruction block or `FORGERAIL.md` binding | Repeated use where durable guidance adds value |
| Persisted Governance | Deferred beyond 0.1.4 | Only after machine-consumed configuration has evidence-backed ownership and migration rules |

ForgeRail never applies a Lightweight Adoption plan by itself. The agent must show exact paths and content, obtain confirmation, preserve unrelated content, verify the result in a new task, and return a receipt. Read [Progressive Adoption](docs/adoption.md) for details.

## How it works

ForgeRail composes four layers without making each project persist all four:

1. **Core governance** — portable rules for scope, authority, evidence, validation, and closure.
2. **Capability Packs** — independent domain capabilities selected only when relevant.
3. **Effective Workspace Profile** — computed from the project's existing sources by default.
4. **Temporary Task Envelope** — the bounded task, allowed scope, approvals, checks, and return contract for the current work.

Host instruction files are adapters, not ForgeRail Core. OpenSpec, ADRs, project docs, CI, and code retain their own authority. See [Control Profile Contracts](docs/control-profile-contracts.md), [Task Contracts](docs/control-task-contracts.md), and [Authority and Validation Contracts](docs/control-authority-validation-contracts.md).

## Optional CLI

The npm package exposes deterministic validation and diagnosis for maintainers and CI. It is **not** required for the Agent Plugin or target project.

```bash
npx --yes @echopath-labs/forgerail@0.1.4 validate
npx --yes @echopath-labs/forgerail@0.1.4 diagnose --workspace .
```

The official package is scoped. The unscoped `forgerail` package is only a reservation and is not an install source.

## Documentation

- [Installation, verification, upgrade, and troubleshooting](docs/installation.md)
- [Progressive project adoption](docs/adoption.md)
- [Capability Pack boundaries](docs/external-capability-packs.md)
- [Pack authoring](docs/pack-authoring.md)
- [Migration from Agent Workflow Governance](docs/migration-from-agw.md)
- [Architecture acceptance](docs/architecture-acceptance.md)
- [0.1.4 release notes](docs/release-0.1.4.md)

See [product boundaries and current capability status](docs/product-boundary.md). The [Cursor executor experiment](docs/cursor-local-executor-canary.md) is retired from the next source candidate; Cursor instruction binding remains `profile-only`.

## Project status

ForgeRail 0.1.4 uses npm distribution and explicit loading of the packaged Skills. Start with Plugin Only; review any durable project binding separately:

- Codex can load packaged guidance explicitly; native Plugin activation is unverified. Claude Code and Cursor adapters remain `profile-only`.
- Persisted `.forgerail/` governance is deferred.
- External Capability Packs remain separately installed and explicitly invoked.
- npm installation is the current route; Codex Marketplace registration and Universal Plugins Directory publication are deferred.
- Defects are fixed forward in a new version; published tags and packages are not rewritten.

See the [0.1.4 release](https://github.com/echopath-labs/forgerail/releases/tag/v0.1.4) and [changelog](CHANGELOG.md).

## Contributing and support

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Use the repository issue forms for reproducible bugs, product proposals, and documentation problems. Usage questions and troubleshooting start in [SUPPORT.md](SUPPORT.md).

Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md). Never put credentials, private project memory, production configuration, customer data, or unredacted receipts in an issue.

Participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

ForgeRail is licensed under [Apache License 2.0](LICENSE). See [NOTICE](NOTICE) for attribution information.
