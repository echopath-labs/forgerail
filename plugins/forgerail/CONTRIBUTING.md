# Contributing to ForgeRail

Thank you for helping make agent-assisted engineering more understandable, bounded, and verifiable.

ForgeRail is not a general automation framework. Contributions should preserve its core boundary: **the Agent performs the engineering work, ForgeRail guides scope and evidence, and a human retains meaningful decisions.**

## Before opening work

Use a GitHub issue when the change affects product behavior, contracts, adoption semantics, supported hosts, Capability Packs, security boundaries, or release compatibility. Small documentation corrections may go directly to a pull request.

Search existing issues first. Do not include credentials, private project memory, customer data, production configuration, private repository paths, or unredacted receipts.

## Development setup

From a ForgeRail source checkout, use Node.js 22 or newer for deterministic validation and fixtures:

```bash
npm ci
npm test
npm run test:docs
```

`npm test` is the main-package suite: it runs from both a source checkout and
an installed npm package, without adjacent external Packs or GitHub templates.
Its fixture result reports `scope: core` and explicitly lists excluded external
composition coverage. It does not qualify combined publication or host behavior.

`npm run test:docs` checks source documentation, including `.github/` templates
that are intentionally excluded from npm installations. Run it in a source
checkout; missing source files remain failures. Source CI runs it separately,
and the disposable consumer test runs `npm test` from the actual installed
archive to protect the package-only path.

`npm run test:maintainer` includes the documentation check, is the full
source/release gate, and is also the
`prepublishOnly` hook. It requires `tools/lib/bundle.mjs` and all four source
Packs (`forgerail-cross-workspace-orchestration`, `forgerail-github-rulesets`,
`forgerail-release-safety`, `forgerail-thread-closure`) beside the main Plugin
in the private layout, or under `plugins/` in the public source layout. Missing
or invalid required inputs fail this gate; copy only verified matching sources.

`validate-fixtures` defaults to `--scope full` for compatibility; select
`--scope core` explicitly for an isolated main package. `test:shadow` requires
external Pack sources. `test:integrity` requires the complete source layout when
source bundle tools are present; an installed npm package without those tools
reports `scope: installed-package` and identifies unavailable source-only tests.
That installed-package result is not the full maintainer gate.

Plugin users do not need project-local Node.js; this development requirement applies only to contributors and optional CLI users.


Adoption templates must contain one non-empty `forgerail:portable-recovery:v1`
start/end block inside the outer managed block. The planner validates this
boundary for each binding and the shared contract before proposing a write;
the generated owner files retain the guidance when the Plugin is absent.
`npm run test:adoption` runs in the main-package suite and covers removal,
displacement, duplication, empty content, and approved output retention.
These are structural and data-preservation checks; edits to the guidance's
meaning still need content review and host behavior evidence.

The shadow and release CLIs report input/evaluation exceptions on stdout as
`{ valid: false, scope: "maintainer", errors: [...] }` and exit 1. Their exported
validators throw to callers instead of terminating the process. Missing inputs
never become a passing full check.

Useful focused checks include:

```bash
npm run test:docs
npm run test:shadow
npm run test:consumer
npm run test:directory
npm run test:release
```

Run the official Plugin and Skill validators when changing manifests, Skills, or Plugin discovery. Keep all tests deterministic and network-free unless a separately reviewed integration test explicitly requires otherwise.

## Design principles

- Follow the project's existing governance sources before proposing ForgeRail-specific state.
- Prefer Plugin Only; recommend Lightweight Adoption only with evidence.
- Keep persisted `.forgerail/` governance deferred until ownership, precedence, migration, recovery, and deletion are designed.
- Keep Capability Packs independent when authentication, permissions, side effects, or lifecycle differ.
- Treat installation, adoption, task authorization, remote integration, release, and lifecycle as separate decisions.
- Preserve explicit non-actions and fail closed when identity, authority, scope, or evidence is uncertain.
- Do not turn ForgeRail into an executor, a second OpenSpec/ADR system, or a promise of security correctness.

## Pull requests

Keep each pull request focused and explain:

1. the user problem and owning capability;
2. what changed and what deliberately did not change;
3. validation evidence, including positive and fail-closed fixtures;
4. compatibility, migration, security, and rollback impact;
5. documentation or release-note updates.

Contract changes need corresponding fixtures. Capability behavior normally belongs in a Pack instead of the Core. Host-specific behavior needs an explicit Host Adapter and must not imply support beyond observed verification.

Use the repository pull-request template. A maintainer may request a smaller scope, additional evidence, or an OpenSpec/ADR before merging a structural change.

## Commit and generated-file hygiene

- Do not commit secrets, local absolute paths, caches, temporary projections, package tarballs, or private governance evidence.
- Preserve generated-file provenance and use the documented builder rather than hand-editing public projections.
- Do not rewrite published tags, npm versions, receipts, or release evidence; defects move forward in a new version.
- Keep formatting changes separate from behavioral changes when practical.

## Community and license

Be respectful and follow the [Code of Conduct](CODE_OF_CONDUCT.md). Usage questions belong in the route described by [SUPPORT.md](SUPPORT.md); vulnerabilities must follow [SECURITY.md](SECURITY.md).

Unless stated otherwise, contributions are accepted under the [Apache License 2.0](LICENSE).
