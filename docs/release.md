# ForgeRail 0.1.0-alpha.1 Release Runbook

This is the project-owned runbook for the first usable ForgeRail prerelease. It governs `forgerail@0.1.0-alpha.1`, the Git tag `v0.1.0-alpha.1`, and the matching EchoPath Labs Marketplace snapshot. It does not authorize any operation by itself.

## Independent Gates

The gates are independent and non-transitive:

1. `remote_integration_approval` may push one exact signed commit to `release/0.1.0-alpha.1`, open a Draft PR to an exact `main` base, observe Node.js 22 and 24 CI, and return a receipt.
2. `release_approval` may make that exact PR Ready, merge it by the approved method, publish the exact npm prerelease, create the annotated tag and GitHub prerelease, and verify consumer installation.
3. `lifecycle_change_approval` is required for any AGW deprecation, redirect, archive, removal, or activation change.

Rulesets, branch protection, stable releases, other products, and OpenSpec archival are outside all three gates unless explicitly added to a new approval.

## Source-First Candidate

- Canonical source is owned in the EchoPath workspace.
- Public-only fixes are prohibited. Change canonical source, validate it, generate the deterministic projection, and sign an exact source commit, tree, inventory, manifest digest, and projection receipt.
- The public branch commit must be an ordinary child of the observed public `main`. Push it by exact SHA refspec without force.
- Open a Draft PR from `release/0.1.0-alpha.1` to the bound `main` SHA. Any head, base, tree, version, license, or check drift stops the gate.
- Required PR checks are Plugin Contracts on Node.js 22 and 24, including Core/contracts, progressive adoption, external packs, frozen AGW coverage, release-source validation, and disposable consumer lifecycle.

## Release-Approval Execution

Only after a new exact `release_approval`:

1. Confirm the PR remains Open, Draft, mergeable, based on the approved `main`, and at the approved head with all required checks successful.
2. Mark only that PR Ready and squash-merge it with an exact-head guard. Confirm merged `main` has the signed candidate tree.
3. From a clean checkout of the merged `main`, run Node.js 22 and 24 validation: `npm test`, `npm run test:shadow`, `npm run test:release`, `npm run test:consumer`, `npm pack --dry-run --json`, and `npm audit`.
4. Verify npm identity and package ownership without printing credentials. Confirm `forgerail@0.1.0-alpha.1` is absent and record the current `latest`, `next`, and `reserved` dist-tags.
5. Publish exactly `forgerail@0.1.0-alpha.1` with public access and the `next` tag. Keep provenance disabled unless a separately validated trusted-publishing path replaces credential publication.
6. Verify registry version, shasum, integrity, license, repository, binary shim, and exact isolated install. Run `forgerail validate` and one bounded read-only diagnosis.
7. Only after exact-version smoke succeeds, move `latest` to `0.1.0-alpha.1`. Verify exact, `next`, and `latest` isolated installs. Preserve the `reserved` dist-tag as historical reservation evidence.
8. Create annotated `v0.1.0-alpha.1` on the exact merged `main` commit and push it without moving any existing tag.
9. Publish a GitHub prerelease titled `ForgeRail v0.1.0-alpha.1` using the versioned CHANGELOG section. ForgeRail has no standalone binary release assets in this version.
10. Register the exact tag as a disposable Codex Marketplace, install the main Plugin, start a new Codex task, and verify `$forgerail`, `$forgerail-workspace-diagnosis`, and `$workspace-health-review`. Generate a single-host Codex Adoption Plan, prove planning leaves the workspace unchanged, explicitly approve and apply only its managed block in a disposable project, start another new task or perform the supported equivalent discovery check, and validate a Host Binding Receipt. Confirm no `.forgerail/` state appears. Install and discover each external Capability Pack separately without authenticating or executing it.
11. Return one durable receipt binding canonical source, public PR/merge, tree, npm package, dist-tags, Git tag, GitHub prerelease, Plugin discovery, checks, non-mutations, and recovery anchors.

## Stop And Rollback

- Before npm publication, stop without remote release mutation when any identity, tree, check, credential, package, or consumer result differs.
- Do not unpublish or overwrite an immutable npm version. Do not move a published Git tag. Shipped defects require a forward fix and a new version.
- If exact publication succeeds but consumer smoke fails, an explicitly approved rollback may restore mutable `latest` and `next` to the last verified usable version. For the first prerelease, the recovery value is `0.0.0-reserved.0`. Preserve `reserved=0.0.0-reserved.0`.
- A PR or merge defect is recovered with an ordinary reviewed revert or forward commit; no force push or history rewrite.
- AGW remains available during the real compatibility-period canary. This release does not authorize an AGW lifecycle change.

## Required Release Receipt

Record exact repository, branch, PR, approved head/base, merged commit/tree, canonical source and projection digests, Node.js 22 and 24 checks, Host Adapter statuses, adoption non-mutation, Codex Host Binding Receipt, pack metadata, npm identity and immutable package metadata, final dist-tags, annotated tag object and peeled commit, GitHub prerelease identity, disposable Plugin/CLI install results, rollback anchors, and confirmation that no `.forgerail/`, Ruleset, branch-protection, stable-release, AGW lifecycle, or OpenSpec archive mutation occurred.
