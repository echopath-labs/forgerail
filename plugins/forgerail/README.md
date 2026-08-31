<p align="center">
  <img src="assets/forgerail-logo.svg" alt="ForgeRail" width="520">
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

> **Status:** `0.1.0-alpha.3` is the current public prerelease. Codex is the verified host. Interfaces and guidance can change before a stable release.

## Why ForgeRail?

Coding agents are good at doing work. The hard part is keeping that work aligned with the real project:

- Which repository and task actually own this change?
- What existing instructions, specifications, decisions, and CI checks already apply?
- What may the agent read or change, and what still needs a human decision?
- What evidence proves the result, and where should the next agent resume?

ForgeRail helps the agent answer those questions before it expands scope. It observes the workspace, follows existing project habits first, recommends the smallest useful governance level, and verifies observable evidence. **The agent does the work, ForgeRail guides the work, and the human decides.**

ForgeRail is not an autonomous executor, a replacement for OpenSpec or `AGENTS.md`, a security guarantee, or a reason to add process to a simple project.

## Five-minute quickstart

### 1. Install the exact Codex Plugin release

```bash
codex plugin marketplace add echopath-labs/forgerail --ref v0.1.0-alpha.3
codex plugin add forgerail@echopath-labs
```

Start a **new Codex task** in the project you want to review. Plugin Only usage does not require Node.js, `package.json`, `node_modules`, or `.forgerail/` in that project.

### 2. Try it read-only

Send this request to Codex:

```text
Use $forgerail to assess this project read-only. Follow its existing AGENTS.md,
specification, ADR, CI, and documentation habits first. Do not modify files or
perform remote actions. Recommend Plugin Only or Lightweight Adoption, show the
evidence and uncertainties, and wait for my confirmation before any write.
```

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
| `$architecture-convergence-audit` | You suspect duplicated capabilities or competing owners | Independent read-only ownership and minimal-boundary audit |

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
| Persisted Governance | Deferred in the current alpha | Only after machine-consumed configuration has evidence-backed ownership and migration rules |

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
npx --yes @echopath-labs/forgerail@0.1.0-alpha.3 validate
npx --yes @echopath-labs/forgerail@0.1.0-alpha.3 diagnose --workspace .
```

The official package is scoped. The unscoped `forgerail` package is only a reservation and is not an install source.

## Documentation

- [Installation, verification, upgrade, and troubleshooting](docs/installation.md)
- [Progressive project adoption](docs/adoption.md)
- [Capability Pack boundaries](docs/external-capability-packs.md)
- [Pack authoring](docs/pack-authoring.md)
- [Migration from Agent Workflow Governance](docs/migration-from-agw.md)
- [Architecture acceptance](docs/architecture-acceptance.md)
- [Alpha.3 release notes and runbook](docs/release-alpha3.md)

## Project status

ForgeRail is usable for real Codex projects through Plugin Only and reviewed Lightweight Adoption, but it remains alpha software:

- Codex is verified; Claude Code and Cursor profiles remain `profile-only`, not verified integrations.
- Persisted `.forgerail/` governance is deferred.
- External Capability Packs remain separately installed and explicitly invoked.
- Universal Plugins Directory publication is paused; exact-tag Marketplace installation is the supported route.
- Defects are fixed forward in a new version; published tags and packages are not rewritten.

See the [alpha.3 prerelease](https://github.com/echopath-labs/forgerail/releases/tag/v0.1.0-alpha.3) and [changelog](CHANGELOG.md).

## Contributing and support

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Use the repository issue forms for reproducible bugs, product proposals, and documentation problems. Usage questions and troubleshooting start in [SUPPORT.md](SUPPORT.md).

Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md). Never put credentials, private project memory, production configuration, customer data, or unredacted receipts in an issue.

Participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

ForgeRail is licensed under [Apache License 2.0](LICENSE). See [NOTICE](NOTICE) for attribution information.
