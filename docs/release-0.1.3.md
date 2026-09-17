# ForgeRail 0.1.3

This candidate narrows ForgeRail to engineering governance and fixes two input/observation edge cases. Publication is confirmed only by the versioned GitHub Release and npm registry.

- Ordinary non-Git directories named `objects`, `refs`, `HEAD` or `config` are no longer rejected solely because two names are present. Damaged metadata, bare repositories and unsupported observations remain unavailable.
- Malformed Host Adapter `bindingModes` returns field diagnostics through both library and CLI instead of a TypeError or INTERNAL_ERROR. Valid adapters retain semantic checks.
- Remove the experimental Cursor executor CLI, runtime, dedicated schemas and tests. Direct users of those experimental paths must use a separately supported host/delegation facility. Cursor rules/Skill binding remains `profile-only`; no RelayPact dependency or automatic migration is added.
- Explicit script publication and actual npm inventory checks prevent undeclared experiments from silently entering the product. Clarify current capabilities versus deferred Control System designs.

See [product boundaries](product-boundary.md) and [reliability details](reliability.md). Existing releases remain unchanged. The observer still requires a trusted Git executable and stable metadata/configuration; these checks are not a sandbox or execution authorization.

After publication:

```sh
npm install --global @echopath-labs/forgerail@0.1.3
forgerail validate
```

Until then use published 0.1.2. Follow [installation](installation.md) and [adoption](adoption.md); installation does not activate Skills or create a Host Binding Receipt. Native Plugin activation, Marketplace/Directory submission, standalone binaries and persisted `.forgerail/` governance remain deferred. Install and discover each external Capability Pack separately; external Packs retain alpha.4 identities. The main package targets `latest`; `next` remains separate. AGW migration is not automatic.

## Maintainer release procedure

This source records the candidate procedure; the versioned GitHub release and registry provide the publication result. Validate the final source and archive on Node.js 22 and 24 with `npm run test:maintainer`, including documentation, fixtures, integrity, release contracts and the actual installed consumer suite. After publication, download the public archive anonymously, compare its digest and installed files with the approved artifact, and verify the CLI and package self-tests on both runtimes.

The public candidate is an ordinary child of the observed remote `main`. Prepare branch `codex/forgerail-0.1.3` from that observed baseline through the source-owned projection. Any required correction is an ordinary source-first successor commit; do not rewrite approved history. The Draft PR base and publication comparison baseline remain bound to the observed remote `main` until revalidated against any concurrent changes.

Request an actual Agent bot review before merge, preferring Codex and otherwise the configured team bot. CI and self-review do not replace it. Resolve accepted findings and ensure the review covers the final head; if neither bot is available, ask the owner how to proceed. The merged public `main` tree must equal the final approved projection tree before creating annotated tag `v0.1.3`, publishing the exact package to npm `latest`, and creating the stable GitHub release.

`remote_integration_approval` covers the concrete public PR and merge; `release_approval` covers the exact tag, npm package/channel and GitHub release. Record the owner's current authorization before those actions. `lifecycle_change_approval` is separate: this release does not retire AGW or migrate active consumer projects. Do not unpublish an existing version or move an immutable release tag. Use a separately approved corrective release if necessary.
