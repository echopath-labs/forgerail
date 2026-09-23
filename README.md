<p align="center">
  <img src="assets/forgerail-logo.svg" alt="ForgeRail" width="520">
ForgeRail 0.1.5 adds explicit Codex project adoption: plan and apply init/update/remove, inspect offline readiness, and recover interrupted operations while preserving user content. Existing snapshots do not upgrade automatically.

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

> **Release line:** `0.1.5` project-adoption release for npm installation and explicit packaged-Skill loading. Check the versioned GitHub Release and npm registry for publication status. Install the exact version below; native Plugin activation and experimental integrations remain outside the stable support boundary.

> **0.1.5 scope:** Generic AGW/WHR guidance is self-contained, and principal behaviors have been verified with explicit source loading. Use npm installation and explicit Agent loading; native Plugin activation and Codex Marketplace registration are deferred. See the [release notes](docs/release-0.1.5.md) and [project replacement requirements](docs/agw-replacement.md).

Rule conflict preflight is Host Agent guidance shared across capabilities: inspect relevant visible rules, reuse valid decisions, and ask only about unresolved choices that affect the action. Mandatory host restrictions cannot be bypassed by approval. See [Profile resolution](skills/forgerail/references/profile-resolution.md).

## Why ForgeRail?

Coding agents are good at doing work. The hard part is keeping that work aligned with the real project:

- Which repository and task actually own this change?
- What existing instructions, specifications, decisions, and CI checks already apply?
- What may the agent read or change, and what still needs a human decision?
- What evidence proves the result, and where should the next agent resume?

ForgeRail helps the agent answer those questions before it expands scope. It observes the workspace, follows existing project habits first, recommends the smallest useful governance level, and verifies observable evidence. **The agent does the work, ForgeRail guides the work, and the human decides.**

ForgeRail is not an autonomous executor, a replacement for OpenSpec or `AGENTS.md`, a security guarantee, or a reason to add process to a simple project.

## Five-minute quickstart

**Delegate setup to your coding agent.** Open the agent in the target project and paste this prompt. You state the outcome; the agent reads the docs, chooses a route supported by its host, performs the work, and returns evidence. Codex project adoption is one released route; other hosts have separate support boundaries.

```text
Set up the released ForgeRail 0.1.5 from https://github.com/echopath-labs/forgerail/tree/v0.1.5 in this project so future engineering tasks can use it under project rules. Read installation and adoption guides from that tag or the exact npm package, not future commands from main. Check this agent host, Node.js, existing adoption, project instructions, and Git state, then choose a route actually supported for this host. Use the exact package @echopath-labs/forgerail@0.1.5. If another global version serves other projects, keep it and use an isolated tools directory or exact-version npm exec. For Codex project adoption, show and review the read-only plan, apply only its owned changes within this authorization, then run offline checks. For other hosts, do not call explicit loading automatic discovery. Preserve user content; explain unknown same-name Skills, drift, or rule conflicts instead of overwriting them.

Report package/project-file checks, host discovery, and behavior on a concrete engineering task separately. Where possible, test with a small reversible task in a fresh session; do not change unrelated content or push, merge, or publish for this test. If you cannot start a fresh task, give me a copyable follow-up prompt and mark the missing checks unverified. Report the actual version and source, changed files, checks, applicable and non-applicable triggers, and any host capability still unverified.
```

See the [agent-facing installation and verification guide](docs/installation.md#delegate-setup-to-an-agent) for route selection, reporting, and the concrete Codex commands.

The manual steps below offer a read-only first look. The prompt above chooses an adoption route according to verified host support.

### 1. Install 0.1.5 with npm

Use Node.js 22 or newer. Check the existing global version first; use `npx` below or an isolated tools directory if another project depends on a different global version. When global installation is appropriate, pin the version explicitly:

```bash
npm install --global @echopath-labs/forgerail@0.1.5
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

During this read-only first look, report a bug if it writes files, creates `.forgerail/`, performs a remote action, or treats installation as approval. The project adoption explicitly requested in the prompt above follows its reviewed plan.

### After setup, describe the task

You do not need to memorize Skill names. Tell the agent the goal and boundary, and let it select applicable guidance under project rules:

| You can say | Applicable guidance |
| --- | --- |
| “Fix this bug, preserve existing changes, and report the verified result.” | Core governance for a non-trivial engineering task |
| “Inspect this workspace's rules and conflicts read-only, then suggest the next step.” | Workspace diagnosis |
| “Check whether this refactor duplicates ownership or drifts across dependency boundaries.” | Architecture convergence audit |
| “Review recovery risks and long-term governance issues in this workspace.” | Workspace health review |

The agent selects by actual trigger conditions; successful installation alone does not guarantee automatic Skill discovery in every task.

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
| Persisted Governance | Deferred beyond 0.1.5 | Only after machine-consumed configuration has evidence-backed ownership and migration rules |

ForgeRail never applies a Lightweight Adoption plan by itself. The agent must show exact paths and content, check current authorization, preserve unrelated content, verify the result in a new task, and return a receipt. A request that already authorizes adoption needs no repeated confirmation. Read [Progressive Adoption](docs/adoption.md) for details.

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
npx --yes @echopath-labs/forgerail@0.1.5 validate
npx --yes @echopath-labs/forgerail@0.1.5 diagnose --workspace .
```

The official package is scoped. The unscoped `forgerail` package is only a reservation and is not an install source.

## Documentation

- [Installation, verification, upgrade, and troubleshooting](docs/installation.md)
- [Progressive project adoption](docs/adoption.md)
- [Capability Pack boundaries](docs/external-capability-packs.md)
- [Pack authoring](docs/pack-authoring.md)
- [Migration from Agent Workflow Governance](docs/migration-from-agw.md)
- [Architecture acceptance](docs/architecture-acceptance.md)
- [0.1.5 release notes](docs/release-0.1.5.md)

See [product boundaries and current capability status](docs/product-boundary.md). The [Cursor executor experiment](docs/cursor-local-executor-canary.md) is retired from the next source candidate; Cursor instruction binding remains `profile-only`.

## Project status

ForgeRail 0.1.5 uses npm distribution and explicit loading of the packaged Skills. Start with Plugin Only; review any durable project binding separately:

- Codex can load packaged guidance explicitly; native Plugin activation is unverified. Claude Code and Cursor adapters remain `profile-only`.
- Persisted `.forgerail/` governance is deferred.
- External Capability Packs remain separately installed and explicitly invoked.
- npm installation is the current route; Codex Marketplace registration and Universal Plugins Directory publication are deferred.
- Defects are fixed forward in a new version; published tags and packages are not rewritten.

See the [0.1.5 release](https://github.com/echopath-labs/forgerail/releases/tag/v0.1.5) and [changelog](CHANGELOG.md).

## Contributing and support

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Use the repository issue forms for reproducible bugs, product proposals, and documentation problems. Usage questions and troubleshooting start in [SUPPORT.md](SUPPORT.md).

Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md). Never put credentials, private project memory, production configuration, customer data, or unredacted receipts in an issue.

Participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

ForgeRail is licensed under [Apache License 2.0](LICENSE). See [NOTICE](NOTICE) for attribution information.

## Optional project adoption

Version 0.1.5 adds an opt-in Codex project lifecycle; older 0.1.4 installations do not include these commands. See [project adoption and recovery](docs/project-adoption.md). Existing read-only assessment and explicit source loading remain available.
