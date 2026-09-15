# ForgeRail 0.1.0

The first stable release supports npm installation and explicit loading of the packaged Skills. It includes the self-contained AGW/WHR guidance, optional language-independent engineering paradigm guidance in the existing architecture audit, installed-package self-tests, and the documented repository-local Skill snapshot route.

Install the exact version:

```sh
npm install --global @echopath-labs/forgerail@0.1.0
forgerail validate
```

Then follow [installation](installation.md) and [project adoption](adoption.md). Installation provides files and the CLI; the host Agent must load the relevant Skill. Repository-local adoption preserves existing project rules and records the exact archive identity. A project-root fresh-session handoff and paired rollback were exercised in a template and a Go service workflow adoption task.

The main package targets npm `latest`; `next` remains the existing prerelease channel. Optional external Packs retain their alpha.4 identities. Install and discover each external Capability Pack separately when needed. Native Plugin activation, Marketplace/Directory submission, standalone binaries, and persisted `.forgerail/` governance are outside this release. These are support boundaries, not hidden installation prerequisites. A Host Binding Receipt describes approved project binding; npm installation does not create one.

## Maintainer release procedure

This source records the candidate procedure; the versioned GitHub release and registry provide the publication result. Validate the final source and archive on Node.js 22 and 24 with `npm run test:maintainer`, including documentation, fixtures, integrity, release contracts and the actual installed consumer suite. After publication, download the public archive anonymously, compare its digest and installed files with the approved artifact, and verify the CLI and package self-tests on both runtimes.

The public candidate is an ordinary child of the observed remote `main`. Prepare branch `codex/forgerail-0.1.0` from that observed baseline through the source-owned projection. Any required correction is an ordinary source-first successor commit; do not rewrite approved history. The Draft PR base and publication comparison baseline remain bound to the observed remote `main` until revalidated against any concurrent changes.

Request an actual Agent bot review before merge, preferring Codex and otherwise the configured team bot. CI and self-review do not replace it. Resolve accepted findings and ensure the review covers the final head; if neither bot is available, ask the owner how to proceed. The merged public `main` tree must equal the final approved projection tree before creating annotated tag `v0.1.0`, publishing the exact package to npm `latest`, and creating the stable GitHub release.

`remote_integration_approval` covers the concrete public PR and merge; `release_approval` covers the exact tag, npm package/channel and GitHub release. Record the owner's current authorization before those actions. `lifecycle_change_approval` is separate: this release does not retire AGW or migrate active consumer projects. Do not unpublish an existing version or move an immutable release tag. Use a separately approved corrective release if necessary.

## Validation scope

The pre-release MVP evidence covers explicit Skill loading, a template initialization, an engineering workflow adoption task, existing project checks, paired rollback and a fresh project-root handoff. It does not certify every language or host, native discovery, or unrelated business requirements. Historical alpha.5 evidence remains in [its release notes](release-alpha5.md).
