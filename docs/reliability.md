# Reliability and local observation

The baseline receipt, Profile and adoption-write fixes shipped in 0.1.1 and are absent from the immutable 0.1.0 npm archive. Publication is confirmed by npm and the versioned GitHub Release.

The additional observation and Envelope safeguards below are included in the **0.1.2 candidate**; they are not present in the published 0.1.1 archive.

## Local receipt verification

The v1 verifier checks contract shape and the current local Git claims that it can observe. Its result adds schemaValid, observationStatus, verificationScope, verifiedClaims and unverifiedClaims. Invalid paths and unavailable Git observations fail; an existing non-Git directory remains supported. Git environment overrides cannot redirect this observation to another repository.

A newly initialized Git workspace with an unborn branch remains observable, with commit=null. A claimed non-null commit still fails comparison; corrupt refs and Git failures remain unavailable.

A v1 Receipt has self-reported task, workspace and validation strings, not independently linked execution evidence. Therefore a requested complete result returns valid=false and closeout=incomplete. An incomplete Receipt can pass local checks while retaining explicitly unverified claims. Consumers must not treat valid=true as an authorization or completion certificate. No v2 execution engine or new durable state is introduced.

### Additional safeguards (0.1.2)

`clean worktree` covers the owning repository's index, tracked files and non-ignored untracked files, including when called from a subdirectory. It excludes ignored files; it is not a promise that the directory contains no user data. `status.showUntrackedFiles` cannot hide work from this check. Ordinary repositories, detached HEADs, unborn branches and linked worktrees remain supported. Bare repositories and damaged metadata return `observationStatus=unavailable`, not ordinary non-Git success.

Observation disables fsmonitor and optional index writes and prevents lazy object retrieval or transport access. It uses Git's effective configuration and attributes (including includes, global/worktree settings, macros and index fallback). If an indexed path uses a configured clean/process filter, it returns unavailable without launching that driver. Merely having unused Git LFS/filter configuration does not block observation. It does not disable transformations and then certify their content as clean.

Submodule entries, assume-unchanged/skip-worktree flags and non-UTF-8 Git output also return unavailable. Status never recurses into submodules. Errors include a bounded reason in `observations.gitError`; no clean claim is verified on an unavailable result. No trust override or new approval state is introduced.

This is a bounded local check using a trusted Git executable. Configuration, attributes and repository metadata must remain stable during observation. It is not an atomic snapshot or a sandbox against an adversary modifying Git configuration concurrently. Large outputs (over 1 MiB per command), a command exceeding 10 seconds, missing objects or unsupported Git behavior fail observation. A clean result never authorizes cleanup or switching by itself.

## Profile resolution and errors

Every candidate is checked before selection, even if overridden. Only the effective highest-priority level contributes equal-precedence value conflicts. A stable canonical ordering selects the representative of equal candidates; input discovery order does not change the result. Duplicate source identities remain invalid.

Malformed Profile structure returns field errors before semantic access. CLI usage and exception errors use JSON with valid=false, a code and errors. INVALID_INPUT, INVALID_JSON, INPUT_UNAVAILABLE and INTERNAL_ERROR distinguish those failure paths; an internal exception remains a failure, never a successful validation. Consumers previously parsing stderr should read this JSON result instead.

0.1.2: malformed `allowedOperations` / `prohibitedOperations` return field diagnostics for both Envelope and embedded Launch validation. Valid operation arrays still undergo overlap checks.

## Approved adoption writes

The helper supports a controlled single-writer workspace. A per-target exclusive lock prevents cooperating helpers from interleaving; it does not lock editors that ignore this protocol. Do not use it for unattended updates while another tool is editing the target. The synchronous helper also changes process cwd internally and is not a concurrent general-purpose SDK.

Source identity, content/version and installed content are rechecked. A detected change fails rather than overwriting user edits. An independent baseline snapshot is created before replacement; the original inode is kept reachable during the operation so failures while capturing a late edit can retain recovery evidence. Rollback only replaces an unedited installed candidate; edited targets remain in place with the named recovery snapshot. This is conflict detection under the stated model, not atomic compare-and-swap against arbitrary external editors.

On interruption, inspect any named .bak/.source recovery files and the per-target .lock alongside the target. Confirm no writer is active, preserve or reconcile user edits, then remove only the inspected stale lock/recovery files. Do not automatically delete these files or rerun stale approval. Ordinary successful operations remove their temporary files.

Managed replacement owns only the start-to-end marker interval; the existing suffix keeps its newline. Appending preserves all prior bytes. Reapplying unchanged content with fresh approval returns unchanged=true without replacing the file. Non-UTF-8 instruction files are rejected rather than rewritten lossily.

Approved replacement content must contain exactly one ordered managed boundary, including for direct helper callers. Malformed replacement content is rejected before changing the target.
