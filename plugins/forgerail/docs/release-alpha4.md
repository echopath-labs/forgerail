# ForgeRail 0.1.0-alpha.4 Integrity Runbook

This source-first runbook governs the proposed `@echopath-labs/forgerail@0.1.0-alpha.4`, tag `v0.1.0-alpha.4`, and matching Agent Plugin projection. It does not grant `remote_integration_approval`, `release_approval`, `submission_approval`, `rollback_approval`, or `lifecycle_change_approval`. The unscoped `forgerail@0.0.0-reserved.0` remains a reservation and must never receive product code or serve as an install or rollback source.

## Candidate integration

The public candidate is an ordinary child of the observed remote `main`. The observed base is exactly `e8fa29cd9f0f782d423d2fdd8abd778fbd362d61`. A future exact `remote_integration_approval` may push only the signed commit to `codex/forgerail-alpha4-critical-integrity`, create one Draft PR, and observe Node.js 22 and 24 Plugin Contracts CI. The Draft PR base and publication comparison baseline remain bound to the observed remote `main`.

Any correction is an ordinary source-first successor commit. Do not force push, rewrite the candidate, transition the PR to Ready, merge, tag, publish, or create a release under remote-integration authority. Install and discover each external Capability Pack separately; availability never implies authentication, enablement, or mutation authority.

## Integrity and compatibility proof

Run Core, integrity regressions, Shadow comparison, release source, Directory, disposable consumer and external Pack validation. Alpha.3 Profiles, Packs, Task Envelopes and Return Receipts that remain valid under the explicit alpha.4 constraints must continue to pass. Launch Contracts and Adoption Plans are intentionally tightened and require regeneration before alpha.4 validation. Invalid identifiers, dates, paths, duplicate identities, missing required Packs, malformed receipts, escaped adoption targets, unsafe bundle sources and inconsistent orchestration events must fail closed.

Each proposed Adoption write carries an `approvalSha256` over its canonical workspace identity and complete executable metadata: path, operation, base digest, content digest, content and managed marker. An integration must preserve the human-approved digest separately from the mutable proposal and provide it when applying the write; ForgeRail validates one immutable field snapshot, so workspace replay, accessor drift or ordinary metadata drift fails before destination selection or mutation. Replacing an existing managed binding uses a same-directory atomic rename while retaining a recovery hard link, so the target path is never deliberately absent. Four-digit contract years, including `0000` through `0099`, are interpreted literally rather than through JavaScript's legacy 1900 offset.

The intentional alpha.3 compatibility tightenings are explicit: contract identifiers now require at least two characters and a leading alphanumeric character; every Launch Contract requires the validated `effectiveProfile` plus canonical identities for its active Pack manifests; and every required active Pack must have an available manifest and be included by the task envelope. These are fail-closed corrections, not silent compatibility regressions.

The source-repository projection builder is a maintainer tool and must not enter the npm package or public CLI. Public projection must be repeatable, exclude private process evidence and preserve the exact public-main documentation baseline.

## Separate release gate

Only a later exact `release_approval` can authorize Ready/merge, scoped npm publication, dist-tags, annotated tag, GitHub prerelease, and disposable consumer verification. The merged public `main` tree must equal the final signed projection tree before release validation begins.

Run Node.js 22 and 24 checks for Core, contracts, integrity, external Packs, frozen AGW behavior coverage, release source, Directory readiness, disposable consumer lifecycle, pack metadata, and audit. Verify GitHub API/SSH/npm identity as `chasechou007` without exposing credentials. Preserve Apache-2.0, the unscoped reservation, and the immutable alpha.1 through alpha.3 package/tag history.

Do not unpublish or move an immutable version or Git tag. A shipped defect requires an ordinary source-first successor commit. Installation and diagnosis must leave project files unchanged unless the user separately approves an exact managed binding; return a Host Binding Receipt and confirm no implicit `.forgerail/` state.

## Independent Directory and lifecycle gates

Universal Plugins Directory draft, submission, review publication, verified publisher identity, Apps Management Write, portal regions and assets remain under a separate `submission_approval` or publication gate. AGW deprecation, redirect, archive, or deletion requires `lifecycle_change_approval`. No approval is transitive.
