# ForgeRail 0.1.8 candidate

This version is not published. npm and the versioned GitHub Release are the publication authorities.

- Add optional workspace-owned `.forgerail/project-profile.json`, bounded source/claim loading and reuse of the existing Profile resolver.
- Activate or remove declarations through existing plans, locks, writes and recovery. Package upgrade/removal never owns the project Profile.
- Observe GitHub API, Git SSH and npm identity read-only within the requested operation. Identity matches never authorize operations.
- Recheck changed identity claims, sources and ownership; reject any failed applicable observation before replacing the active declaration.
- Verify representative Profile consumption through Codex and Cursor IDE shared Core. Cursor Rule fallback remains profile-only; Cline, broad CLI/Cloud and real PDM activation are outside this acceptance.

The target project needs no package.json. The CLI requires Node.js 22+. Installation does not prove native Plugin activation or model compliance. Every adopted project still needs a fresh-session host verification against its exact Core tree.

Install the exact release:

```sh
npm install --global @echopath-labs/forgerail@0.1.8
forgerail validate
forgerail init --workspace .
```

The final command only previews a plan. Follow [project adoption](project-adoption.md) for authorized application, legacy migration and recovery. Keep existing snapshot source locks and use the documented update path; do not overwrite unknown files.

A crash after writing but before saving its completion receipt still requires reconciliation. Recovery is not transaction isolation from arbitrary editors. Any managed drift blocks the entire remove operation.

AI-tool update reminders and optional RelayPact delegation guidance are not included. ForgeRail does not schedule Agents. Marketplace/Directory submission, standalone binaries, Cursor Rule certification, broad Cursor CLI/Cloud Agent certification and persisted task governance remain deferred. External Packs retain alpha.4 identities; npm latest and next remain separate.

Installation does not create a Host Binding Receipt. The `.forgerail/` directory contains installation metadata, not persisted task governance. Install and discover each external Capability Pack separately.

## Maintainer release procedure

This source records the 0.1.8 release procedure; the versioned GitHub Release and registry provide the publication result. Validate the final source and archive on Node.js 22 and 24 with `npm run test:maintainer`, including documentation, fixtures, integrity, release contracts and the actual installed consumer suite. After publication, download the public archive anonymously, compare its digest and installed files with the approved artifact, and verify the CLI and package self-tests on both runtimes.

The public candidate is an ordinary child of the observed remote `main`. Prepare branch `release/0.1.8` from that observed baseline through the source-owned projection. Any required correction is an ordinary source-first successor commit; do not rewrite approved history. The Draft PR base and publication comparison baseline remain bound to the observed remote `main` until revalidated against any concurrent changes.

Request an actual Agent bot review before merge, preferring Codex and otherwise the configured team bot. CI and self-review do not replace it. Resolve accepted findings and ensure the review covers the final head; if neither bot is available, ask the owner how to proceed. The merged public `main` tree must equal the final approved projection tree before creating annotated tag `v0.1.8`, publishing the exact package to npm `latest`, and creating the stable GitHub release.

`remote_integration_approval` covers the concrete public PR and merge; `release_approval` covers the exact tag, npm package/channel and GitHub release. Record the owner's current authorization before those actions; one explicit request may cover both gates without separate prompts. `lifecycle_change_approval` is separate: this release does not retire AGW or migrate active consumer projects. Do not unpublish an existing version or move an immutable release tag. Use a separately approved corrective release if necessary.

This unpublished candidate adds optional Project Profile activation/removal and read-only identity preflight. Referenced identity/source/owner changes require fresh checks; conflicting applicable observations block activation. Existing projects without a Profile retain their behavior.
