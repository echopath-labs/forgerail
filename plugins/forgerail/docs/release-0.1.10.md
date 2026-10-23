# ForgeRail 0.1.10 preparation

Prepared on 2026-10-22. This version is not released. Source metadata, a local package archive and passing static checks do not establish npm publication or host acceptance.

- Add fast/balanced/strict engineering effort guidance, scoped risk strengthening, evidence reuse and stopping conditions. Existing mandatory review, CI and operation authorization remain binding.
- Interpret `engineering.mode` and `git.branch.naming` through the existing Project Profile sources and scopes. Invalid, stale or conflicting declarations stay unresolved; there is no automatic digest refresh or new policy store.
- Add local, read-only `branch-check` observations before and after a host's branch operation. The host owns authorized Git actions and bounded correction; the command does not mutate branches, contact remotes or grant authorization. An existing HEAD commit is required; newly initialized and orphan branches without a first commit remain unverified.
- Clarify cohesive PRs, intentional commits and pre-coding batch planning. Size reminders remain project-specific; changes preserve existing safety boundaries and gates.

See [engineering mode and branch checks](engineering-mode.md) for usage and limits. Existing 0.1.9 reliability fixes are retained. External Capability Packs remain at their independent `0.1.0-alpha.4` versions. No Agent runtime, automatic project migration or persisted task-governance system is added.

## Host acceptance and installation

Current unreleased 0.1.10 candidate: the user exercised two fresh isolated Cursor IDE sessions on 2026-10-22 against Core `3c75fcfd8f11317e0b2ff40878ef86d87d12b4be61b2df4654328f96de7a5a9a`; bounded evidence review completed on 2026-10-23. Original transcripts show engineering Skill/Profile/declared-policy reads, branch-check before/create/after calls, scoped implementation, testing calls and impact judgment; the unrelated read-only transcript contains only one README Read. A retained before observation passed. Independent current immutable-input/Git/file/test checks and an after comparison passed; these reruns do not reconstruct missing original tool-result bodies. Cursor version and original model are unknown. The session also read extra references and initially looked for policy at an incorrect path before using the declared source, so this does not certify minimal effort or every guidance clause. Acceptance covers this exact shared Core route only; Rule fallback, Cloud Agent and broad CLI behavior retain their prior boundaries. Earlier 2026-10-20 acceptance for Core `bc188e56d4753a295b90e1e6ad422366a1b41aa83fef3999bac0340ec2c539b5` with Cursor IDE 3.25.6 / Claude Opus 5.5 High remains historical and does not identify the new sessions.

Install only after confirming exact-version publication through npm and the versioned GitHub Release:

```sh
npm install --global @echopath-labs/forgerail@0.1.10
forgerail validate
forgerail init --workspace .
```

The final command previews a plan. Existing projects need an explicit reviewed update and fresh-session verification. npm installation alone does not prove Skill discovery or native Plugin activation and does not create a Host Binding Receipt. `.forgerail/` contains installation metadata, not persisted task governance. Install and discover each external Capability Pack separately.

## Maintainer release procedure

Preparation does not authorize public integration, tag creation, publication or lifecycle changes. Validate the final source and installed archive on Node.js 22 and 24 with `npm run test:maintainer`; the accepted Core digest must continue to match the final source. The [current runbook](release.md) governs any later authorized execution, including staged npm publishing and personal owner approval.

The public candidate is an ordinary child of the observed remote `main`. Prepare branch `release/0.1.10` from that observed baseline through the source-owned projection. Any required correction is an ordinary source-first successor commit; do not rewrite approved history. The Draft PR base and publication comparison baseline remain bound to the observed remote `main` until revalidated against any concurrent changes.

Request an actual Agent bot review before merge, preferring Codex and otherwise the configured team bot. CI and self-review do not replace it. Resolve accepted findings and ensure the review covers the final head; if neither bot is available, ask the owner how to proceed. The merged public `main` tree must equal the final approved projection tree before authorized release execution.

`remote_integration_approval` covers the concrete public PR and merge; `release_approval` covers the exact tag `v0.1.10`, staged npm package `@echopath-labs/forgerail@0.1.10` with public access and npm `latest`, and matching stable GitHub Release. Stage upload is not publication: verify the staged metadata and downloaded archive against the approved bytes, then the owner personally completes web approval and 2FA. The Agent never approves on the owner's behalf. Registry readback and an anonymous download must match the approved archive before claiming publication. One explicit request may cover multiple gates when it names the exact actions; the current request covers preparation only.

`lifecycle_change_approval` is separate: this release does not retire AGW or migrate active consumers. Do not unpublish an existing version or move an immutable release tag. Use a separately approved corrective release if necessary. Directory submission remains deferred and unapproved.
