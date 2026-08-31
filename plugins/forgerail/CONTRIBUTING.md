# Contributing to ForgeRail

Thank you for helping make agent-assisted engineering more understandable, bounded, and verifiable.

ForgeRail is not a general automation framework. Contributions should preserve its core boundary: **the Agent performs the engineering work, ForgeRail guides scope and evidence, and a human retains meaningful decisions.**

## Before opening work

Use a GitHub issue when the change affects product behavior, contracts, adoption semantics, supported hosts, Capability Packs, security boundaries, or release compatibility. Small documentation corrections may go directly to a pull request.

Search existing issues first. Do not include credentials, private project memory, customer data, production configuration, private repository paths, or unredacted receipts.

## Development setup

ForgeRail's public package uses Node.js 22 or newer for deterministic validation and fixtures:

```bash
npm ci
npm test
```

Plugin users do not need project-local Node.js; this development requirement applies only to contributors and optional CLI users.

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
