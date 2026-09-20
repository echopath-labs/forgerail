# ForgeRail 0.1.5

This release adds explicit Codex project adoption. Consult npm and the versioned GitHub Release for publication status.

- Add shared rule conflict preflight guidance: reuse valid decisions, distinguish user-overridable defaults from mandatory host restrictions, and pause only affected actions. This is Agent guidance, not a configuration editor or host enforcement mechanism.
- Preview init/update/remove plans and apply a digest-bound plan only within the user's authorization.
- Keep project choices and generated installation identity separate; maintain only known managed files and the AGENTS block.
- Diagnose offline readiness, reject drift and conflicting legacy bindings, and migrate known legacy snapshots through explicit source verification.
- Recover interrupted operations using completion receipts and file identity; preserve uncertain external changes. Oversized recovery journals are rejected before writes.

The target project needs no package.json. The CLI requires Node.js 22+. Existing project snapshots and globally installed tools are not automatically upgraded. Native Codex discovery was verified in a disposable project for four enabled repo-scoped Skills; this does not certify model compliance or native Plugin activation.

Install the exact release:

```sh
npm install --global @echopath-labs/forgerail@0.1.5
forgerail validate
forgerail init --workspace .
```

The final command only previews a plan. Follow [project adoption](project-adoption.md) for authorized application, legacy migration and recovery. For an existing 0.1.4 snapshot, retain its source lock and use the documented same-version migration before updating; do not overwrite unknown files.

A crash after writing but before saving its completion receipt requires reconciliation. Journals from earlier unpublished candidates without ownership receipts cannot be automatically rolled back. Recovery is not transaction isolation from arbitrary editors. Any managed drift blocks the entire remove operation.

AI-tool update reminders and optional RelayPact delegation guidance are not included. ForgeRail does not schedule Agents. Marketplace/Directory submission, standalone binaries, other host certification and persisted task governance remain deferred. External Packs retain alpha.4 identities; npm latest and next remain separate.

Installation does not create a Host Binding Receipt. The `.forgerail/` directory contains installation metadata, not persisted task governance. Install and discover each external Capability Pack separately.

## Maintainer release procedure

This source records the candidate procedure; the versioned GitHub release and registry provide the publication result. Validate the final source and archive on Node.js 22 and 24 with `npm run test:maintainer`, including documentation, fixtures, integrity, release contracts and the actual installed consumer suite. After publication, download the public archive anonymously, compare its digest and installed files with the approved artifact, and verify the CLI and package self-tests on both runtimes.

The public candidate is an ordinary child of the observed remote `main`. Prepare branch `codex/project-adoption-lifecycle` from that observed baseline through the source-owned projection. Any required correction is an ordinary source-first successor commit; do not rewrite approved history. The Draft PR base and publication comparison baseline remain bound to the observed remote `main` until revalidated against any concurrent changes.

Request an actual Agent bot review before merge, preferring Codex and otherwise the configured team bot. CI and self-review do not replace it. Resolve accepted findings and ensure the review covers the final head; if neither bot is available, ask the owner how to proceed. The merged public `main` tree must equal the final approved projection tree before creating annotated tag `v0.1.5`, publishing the exact package to npm `latest`, and creating the stable GitHub release.

`remote_integration_approval` covers the concrete public PR and merge; `release_approval` covers the exact tag, npm package/channel and GitHub release. Record the owner's current authorization before those actions; one explicit request may cover both gates without separate prompts. `lifecycle_change_approval` is separate: this release does not retire AGW or migrate active consumer projects. Do not unpublish an existing version or move an immutable release tag. Use a separately approved corrective release if necessary.
