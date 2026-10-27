# ForgeRail 0.1.11 release notes

Publication status is recorded by npm and the versioned GitHub Release. Source metadata, a local package archive and passing static checks do not establish npm publication or host acceptance.


- Add optional RelayPact delegation guidance through the existing Core and one on-demand reference. Project rules or the user must explicitly enable preference; the Host assesses task fit, current verified capabilities and the full cost of decomposition, handoff, execution, review and rework.
- Reuse valid task authorization without repeated confirmation. Preference does not broaden scope or bypass mandatory host limits; the Host collects results, checks actual artifacts/evidence and owns acceptance and the final report.
- Keep small, tightly coupled or uneconomic tasks with the Host. Report unavailable routes, partial results and unknown cost honestly; do not claim success or savings without evidence. RelayPact/host retains dispatch, models, processes, wait, cancellation, retry and recovery.

See [optional delegation](../skills/forgerail/references/optional-delegation.md). This candidate adds no Skill owner, CLI command, configuration/schema, persistent task state or execution runtime. Existing engineering-mode, branch-check and reliability behavior is retained. External Capability Packs keep their independent `0.1.0-alpha.4` versions.

## Host acceptance and installation

Core `7ad344f3eb2b77f3d4b25d98bbbd0142150540108d2f8153c8f500f36aa6bb7d` received bounded Cursor IDE acceptance on 2026-10-26 after the user ran two fresh isolated sessions. Agent-authored reports describe Core/optional-reference/Profile loading and reasonable direct handling of the small engineering task within an external-worker prohibition; the unrelated read-only report describes README-only activity. Independent preparation-anchor, immutable Core/input, current Git/file/test checks and retained passing branch before/after observations support that limited result. No complete original transcript was supplied, so the full read sequence and absence of unrecorded actions are not independently audited. Cursor version, model and tier are unknown; Grok 4.7 is only a report's system self-description. Explicit condition probes are reasoning evidence, not runtime/recovery tests. Rule fallback remains profile-only; CLI, Cloud Agent and other-host support do not increase. Each adopted project still requires fresh-session verification. See [host support](adoption.md#host-support).

Install only after confirming exact-version publication through npm and the versioned GitHub Release:

```sh
npm install --global @echopath-labs/forgerail@0.1.11
forgerail validate
forgerail init --workspace .
```

The final command previews a plan. Existing projects need an explicit reviewed update and fresh-session verification. npm installation alone does not prove Skill discovery or native Plugin activation and does not create a Host Binding Receipt. `.forgerail/` contains installation metadata, not persisted task governance. Install and discover each external Capability Pack separately.

## Maintainer release procedure

Preparation does not authorize public integration, tag creation, publication or lifecycle changes. Validate the final source and installed archive on Node.js 22 and 24 with `npm run test:maintainer`; the accepted Core digest must continue to match the final source. The [current runbook](release.md) governs any later authorized execution, including staged npm publishing and personal owner approval.

The public candidate is an ordinary child of the observed remote `main`. Prepare branch `release/0.1.11` from that observed baseline through the source-owned projection. Any required correction is an ordinary source-first successor commit; do not rewrite approved history. The Draft PR base and publication comparison baseline remain bound to the observed remote `main` until revalidated against any concurrent changes.

Request an actual Agent bot review before merge, preferring Codex and otherwise the configured team bot. CI and self-review do not replace it. Resolve accepted findings and ensure the review covers the final head; if neither bot is available, ask the owner how to proceed. The merged public `main` tree must equal the final approved projection tree before authorized release execution.

`remote_integration_approval` covers the concrete public PR and merge; `release_approval` covers the exact tag `v0.1.11`, staged npm package `@echopath-labs/forgerail@0.1.11` with public access and npm `latest`, and matching stable GitHub Release. Stage upload is not publication: verify the staged metadata and downloaded archive against the approved bytes, then the owner personally completes web approval and 2FA. The Agent never approves on the owner's behalf. Registry readback and an anonymous download must match the approved archive before claiming publication. One explicit request may cover multiple gates when it names the exact actions; each gate requires authorization for its exact target and actions.

`lifecycle_change_approval` is separate: this release does not retire AGW or migrate active consumers. Do not unpublish an existing version or move an immutable release tag. Use a separately approved corrective release if necessary. Directory submission remains deferred and unapproved.
