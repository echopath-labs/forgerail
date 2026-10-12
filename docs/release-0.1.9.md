# ForgeRail 0.1.9

This reliability-only patch retains the capabilities and host support boundaries introduced in 0.1.8. npm and the versioned GitHub Release confirm publication; source metadata alone does not.

- Keep lifecycle journals and temporary recovery copies POSIX `0600`; preserve original modes, including supported special bits, and reject mode or original-presence drift before replacement.
- Journal 1.2 records original POSIX modes for recovery. Legacy 1.1 journals require manual original-permission verification for both replaced and deleted files; newly created files can still be safely undone. ACLs, owner/group and extended attributes are not restored; Windows ACL acceptance remains separate.
- Keep project governance blocks independently framed and preserve original user bytes on removal. Refuse insertion inside unfinished fences and HTML contexts.
- Recognize bounded Markdown structure, excluding code, comments, raw HTML and explicit instruction examples from rule evidence. This is not a complete Markdown renderer.
- Reconfirm declared identity sources before and after preflight. Each request shares a maximum 128 provider calls and a 15-second provider budget; duplicate selectors fail without provider calls. Late success is unresolved. This budget excludes source/filesystem checks. Forced timeout applies to direct children, without a guarantee for arbitrary descendant processes.
- Return bounded field/input errors for malformed or excessive contracts (depth 64 and 10,000 JSON values), and avoid repeated scans and delimiter-heavy allocations.

Install only after confirming exact-version publication:

```sh
npm install --global @echopath-labs/forgerail@0.1.9
forgerail validate
forgerail init --workspace .
```

The final command previews a plan. See [project adoption](project-adoption.md) and [Privacy](../PRIVACY.md). Existing project Skills and installation metadata need explicit update; npm installation does not migrate them or prove native Plugin activation. The unchanged shared Core keeps its existing Codex/Cursor IDE evidence; fresh-session project verification is still required. External Packs keep their independent alpha.4 versions. No new capability, Agent runtime, persisted task governance or Directory submission is introduced.

Installation does not create a Host Binding Receipt. The `.forgerail/` directory contains installation metadata, not persisted task governance. Install and discover each external Capability Pack separately.

## Maintainer release procedure

This source records the 0.1.9 release procedure; the versioned GitHub Release and registry provide the publication result. Validate the final source and archive on Node.js 22 and 24 with `npm run test:maintainer`, including documentation, fixtures, integrity, release contracts and the actual installed consumer suite. After publication, download the public archive anonymously, compare its digest and installed files with the approved artifact, and verify the CLI and package self-tests on both runtimes.

The public candidate is an ordinary child of the observed remote `main`. Prepare branch `release/0.1.9` from that observed baseline through the source-owned projection. Any required correction is an ordinary source-first successor commit; do not rewrite approved history. The Draft PR base and publication comparison baseline remain bound to the observed remote `main` until revalidated against any concurrent changes.

Request an actual Agent bot review before merge, preferring Codex and otherwise the configured team bot. CI and self-review do not replace it. Resolve accepted findings and ensure the review covers the final head; if neither bot is available, ask the owner how to proceed. The merged public `main` tree must equal the final approved projection tree before creating annotated tag `v0.1.9`, publishing the exact package to npm `latest`, and creating the stable GitHub release.

`remote_integration_approval` covers the concrete public PR and merge; `release_approval` covers the exact tag, npm package/channel and GitHub release. Record the owner's current authorization before those actions; one explicit request may cover both gates without separate prompts. `lifecycle_change_approval` is separate: this release does not retire AGW or migrate active consumer projects. Do not unpublish an existing version or move an immutable release tag. Use a separately approved corrective release if necessary.
