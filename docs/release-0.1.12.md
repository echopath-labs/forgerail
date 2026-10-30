# ForgeRail 0.1.12 release notes

Publication status is recorded by npm and the versioned GitHub Release. Source metadata, a local package archive and passing static checks do not establish publication or installation in a consumer project.

- Guide work toward a coherent user or consumer result when useful; technical subtasks, CLI, CI, libraries and research can finish at their own agreed outcome. The Host chooses applicable practices from actual scope and risk, without a compulsory UI walkthrough or extra report.
- Preserve unfinished acceptance when a user changes direction, distinguishing continued, replaced or deferred work instead of freezing a superseded goal or silently dropping it.
- Select the shortest meaningful feedback path and check critical uncertainties early; reuse applicable evidence and keep recovery context compact, tied to actual state and the next relevant gap.
- Lead completion with the achieved outcome, supporting evidence and remaining gap. Implementation, programmatic checks, real-browser activity and human acceptance remain separate.

These changes reuse Core and its existing references across engineering modes. Authorization, data protection and mandatory gates remain. No Skill owner, CLI command, schema/configuration or execution runtime is added; optional RelayPact guidance and the existing mode/branch-check capabilities are retained. External Capability Packs keep independent versions.

## Host acceptance and installation

Exact Core `003e26034a9cb7d0650f7ace6a5ff48f65ddaa6f0546b419f003c04bdb29faa8` passed bounded Cursor IDE evidence review on 2026-10-30 following three fresh isolated sessions: a programmatic page-entry repair, a library repair and read-only continuation. Agent-authored reports and retained command outputs were compared with independent candidate/Core, protected-file, Git and functional checks. Full original tool transcripts were not supplied, so complete read order, absence of unrecorded actions and a reported host browser rule's exact priority were not independently audited. Cursor version/tier are unknown; Grok 4.7 is reported self-description. Programmatic DOM checks are not real-browser or human acceptance. Read-only investigation may legitimately skip Core activation; that scene does not establish Core's causal effect. Acceptance covers only shared `AGENTS.md` plus this exact project-local Core; Rule fallback, broad CLI, Cloud and other-host support do not increase. Each adopted project still needs fresh-session verification. See [host support](adoption.md#host-support).

Install only after confirming exact-version publication:

```sh
npm install --global @echopath-labs/forgerail@0.1.12
forgerail validate
forgerail init --workspace .
```

The final command previews a plan. Existing projects require an explicitly reviewed update; npm installation alone does not prove discovery or native Plugin activation and does not create a Host Binding Receipt. `.forgerail/` holds installation metadata rather than persistent task governance. Install and discover each external Capability Pack separately.

## Maintainer release procedure

Preparation does not authorize public integration, tag creation, publication or lifecycle changes. Validate the final source and installed archive on Node.js 22 and 24 with `npm run test:maintainer`; the accepted Core digest must continue to match the final source. The [current runbook](release.md) governs any later authorized execution, including staged npm publishing and personal owner approval.

The public candidate is an ordinary child of the observed remote `main`. Prepare branch `release/0.1.12` from that observed baseline through the source-owned projection. Any required correction is an ordinary source-first successor commit; do not rewrite approved history. The Draft PR base and publication comparison baseline remain bound to the observed remote `main` until revalidated against any concurrent changes.

Request an actual Agent bot review before merge, preferring Codex and otherwise the configured team bot. CI and self-review do not replace it. Resolve accepted findings and ensure the review covers the final head; if neither bot is available, ask the owner how to proceed. The merged public `main` tree must equal the final approved projection tree before authorized release execution.

`remote_integration_approval` covers the concrete public PR and merge; `release_approval` covers the exact tag `v0.1.12`, staged npm package `@echopath-labs/forgerail@0.1.12` with public access and npm `latest`, and matching stable GitHub Release. Stage upload is not publication: verify the staged metadata and downloaded archive against the approved bytes, then the owner personally completes web approval and 2FA. The Agent never approves on the owner's behalf. Registry readback and an anonymous download must match the approved archive before claiming publication. One explicit request may cover multiple gates when it names the exact actions; each gate requires authorization for its exact target and actions.

`lifecycle_change_approval` is separate: this release does not retire AGW or migrate active consumers. Do not unpublish an existing version or move an immutable release tag. Use a separately approved corrective release if necessary. Directory submission remains deferred and unapproved.
