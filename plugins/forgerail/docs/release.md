# ForgeRail 0.1.7 Stable Release Runbook

This project-owned runbook governs `@echopath-labs/forgerail@0.1.7`, annotated
tag `v0.1.7`, and the matching stable GitHub Release. The public repository is a
deterministic projection of the private canonical source. External Capability
Packs keep their independent alpha.4 identities and release lifecycles. This
document describes the procedure; it does not grant authority by itself.

## Independent gates

1. `remote_integration_approval` covers the exact public projection branch,
   Draft PR, required checks, final review and approved merge.
2. `release_approval` covers the exact merged tree, npm `latest` publication,
   annotated tag and stable GitHub Release.
3. `lifecycle_change_approval` separately covers any AGW retirement, consumer
   migration, Ruleset or branch-protection change, rollback, or removal.

One explicit owner instruction may grant the first two gates together when it
names the release and asks for publication. Authority never transfers to the
third gate.

## Source-first public integration

- Change and validate canonical source before producing the public projection.
  Public-only fixes are prohibited.
- Bind the candidate to the private source commit and tree, public base,
  deterministic projection digest, npm archive digest and exact version.
- Create `release/0.1.7` as an ordinary child of the observed public `main` and
  apply only the generated projection. Push by exact SHA refspec without force.
- Open a Draft PR to the observed `main`. Recheck head, base, tree, version,
  license, required checks and Agent review after any correction.
- Merge only when the final approved projection is current. The merged public
  `main` tree must equal the signed projection tree.

Required CI covers Node.js 22 and 24, Core/contracts, full fixtures, progressive
adoption, integrity, release-source validation, disposable consumer lifecycle
and the Universal Directory.

## Stable release execution

1. Confirm the public PR is open, mergeable, based on the approved `main`, at
   the approved head, and has successful required checks and final Agent review.
2. Mark only that PR Ready and squash-merge it with an exact-head guard. Confirm
   the merged `main` tree equals the signed projection tree.
3. From a clean checkout of merged `main`, run `npm run test:maintainer` and
   `npm audit` on Node.js 22 and 24. Create the exact npm archive and compare its
   inventory and digest with the approved candidate.
4. Verify `gh`, Git SSH and npm all resolve to the authorized EchoPath Labs
   identity. Confirm `@echopath-labs/forgerail@0.1.7` is absent and observe the
   current `latest` and `next` dist-tags.
5. Publish exactly `@echopath-labs/forgerail@0.1.7` with public access and the
   `latest` tag. Keep provenance disabled unless trusted publishing has been
   independently configured and verified.
6. Read back registry version, shasum, integrity, license, repository, binary
   shim and dist-tags. Anonymously install the exact version on Node.js 22 and
   24, then run `forgerail validate`, package self-tests and one bounded
   read-only diagnosis.
7. Create annotated tag `v0.1.7` on the exact merged public `main` commit and
   push it without moving an existing tag. Publish stable GitHub Release
   `ForgeRail 0.1.7` from the versioned release notes. This release has no
   standalone binary assets.
8. Validate the exact tag as a disposable Codex Marketplace: discover the main
   Plugin Skills, verify read-only adoption planning, apply only an explicitly
   approved managed block in a disposable workspace, validate a Host Binding
   Receipt, and confirm no persisted task-governance state appears. Discover
   each external Capability Pack independently without authenticating or
   executing it.
9. Record a durable release receipt and re-observe public `main`, npm dist-tags,
   the annotated tag and GitHub Release before closing the change.

## Stop and recovery

- Stop before npm publication when identity, source, projection, checks, review,
  package inventory or consumer behavior drifts.
- Never unpublish or overwrite an immutable npm version and never move an
  immutable release tag. Shipped defects use a separately approved forward fix.
- A PR or merge defect is recovered with an ordinary reviewed revert or forward
  commit; do not force-push or rewrite public history.
- Mutable dist-tag rollback, AGW lifecycle changes and real consumer migration
  require separate exact authorization.

## Required receipt

Record canonical source and evidence commits, public base/head/PR/merge/tree,
projection and archive digests, Node.js 22/24 results, Agent review, npm identity
and immutable package metadata, final dist-tags, annotated tag object and peeled
commit, GitHub Release identity, disposable install and Plugin checks,
non-mutations, residual risk and recovery anchors.
