# ForgeRail 0.1.4

This patch clarifies continuous progress and authorization reuse in Core. For publication status, consult the versioned GitHub Release and npm registry.

- Continue authorized engineering work, review fixes and revalidation instead of stopping at a next-step suggestion.
- One explicit request can cover multiple stages; independent gates do not require repeated prompts when each action and target is already covered.
- Ask for material decisions, scope changes or missing authorization. Passing CI, bot approval and low risk are not permission to merge or publish.
- Preserve unrelated dirty files and reuse a suitable branch without redundant confirmation. Stop at the requested outcome, user pause or a genuine blocker; do not add endless review rounds.

This is instruction-level guidance, not an auto-approval runtime or bypass for host permissions. No new Skill, executor, schema or CLI operation is added. Existing releases and project snapshots do not upgrade automatically. Public automated gates validate structure, package contents and existing regressions; they do not certify the new policy's model behavior. The release preparation also used limited local scenario rehearsals, not a public automated behavioral suite or a guarantee of compliance.

Install the exact release:

```sh
npm install --global @echopath-labs/forgerail@0.1.4
forgerail validate
```

Follow [installation](installation.md) and [adoption](adoption.md); installation does not activate Skills or create a Host Binding Receipt. Native Plugin activation, Marketplace/Directory submission, standalone binaries and persisted `.forgerail/` governance remain deferred. Install and discover each external Capability Pack separately; external Packs retain alpha.4 identities. The main package targets `latest`; `next` remains separate. AGW migration is not automatic.

## Maintainer release procedure

This source records the candidate procedure; the versioned GitHub release and registry provide the publication result. Validate the final source and archive on Node.js 22 and 24 with `npm run test:maintainer`, including documentation, fixtures, integrity, release contracts and the actual installed consumer suite. After publication, download the public archive anonymously, compare its digest and installed files with the approved artifact, and verify the CLI and package self-tests on both runtimes.

The public candidate is an ordinary child of the observed remote `main`. Prepare branch `codex/forgerail-0.1.4` from that observed baseline through the source-owned projection. Any required correction is an ordinary source-first successor commit; do not rewrite approved history. The Draft PR base and publication comparison baseline remain bound to the observed remote `main` until revalidated against any concurrent changes.

Request an actual Agent bot review before merge, preferring Codex and otherwise the configured team bot. CI and self-review do not replace it. Resolve accepted findings and ensure the review covers the final head; if neither bot is available, ask the owner how to proceed. The merged public `main` tree must equal the final approved projection tree before creating annotated tag `v0.1.4`, publishing the exact package to npm `latest`, and creating the stable GitHub release.

`remote_integration_approval` covers the concrete public PR and merge; `release_approval` covers the exact tag, npm package/channel and GitHub release. Record the owner's current authorization before those actions; one explicit request may cover both gates without separate prompts. `lifecycle_change_approval` is separate: this release does not retire AGW or migrate active consumer projects. Do not unpublish an existing version or move an immutable release tag. Use a separately approved corrective release if necessary.
