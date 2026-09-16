# Reliability fixes — 0.1.1

These changes are included in the 0.1.1 candidate and are absent from the immutable 0.1.0 npm archive. Publication is confirmed by npm and the versioned GitHub Release.

## Local receipt verification

The v1 verifier checks contract shape and the current local Git claims that it can observe. Its result adds schemaValid, observationStatus, verificationScope, verifiedClaims and unverifiedClaims. Invalid paths and unavailable Git observations fail; an existing non-Git directory remains supported. Git environment overrides cannot redirect this observation to another repository.

A newly initialized Git workspace with an unborn branch remains observable, with commit=null. A claimed non-null commit still fails comparison; corrupt refs and Git failures remain unavailable.

A v1 Receipt has self-reported task, workspace and validation strings, not independently linked execution evidence. Therefore a requested complete result returns valid=false and closeout=incomplete. An incomplete Receipt can pass local checks while retaining explicitly unverified claims. Consumers must not treat valid=true as an authorization or completion certificate. No v2 execution engine or new durable state is introduced.

## Profile resolution and errors

Every candidate is checked before selection, even if overridden. Only the effective highest-priority level contributes equal-precedence value conflicts. A stable canonical ordering selects the representative of equal candidates; input discovery order does not change the result. Duplicate source identities remain invalid.

Malformed Profile structure returns field errors before semantic access. CLI usage and exception errors use JSON with valid=false, a code and errors. INVALID_INPUT, INVALID_JSON, INPUT_UNAVAILABLE and INTERNAL_ERROR distinguish those failure paths; an internal exception remains a failure, never a successful validation. Consumers previously parsing stderr should read this JSON result instead.

## Approved adoption writes

The helper supports a controlled single-writer workspace. A per-target exclusive lock prevents cooperating helpers from interleaving; it does not lock editors that ignore this protocol. Do not use it for unattended updates while another tool is editing the target. The synchronous helper also changes process cwd internally and is not a concurrent general-purpose SDK.

Source identity, content/version and installed content are rechecked. A detected change fails rather than overwriting user edits. An independent baseline snapshot is created before replacement; the original inode is kept reachable during the operation so failures while capturing a late edit can retain recovery evidence. Rollback only replaces an unedited installed candidate; edited targets remain in place with the named recovery snapshot. This is conflict detection under the stated model, not atomic compare-and-swap against arbitrary external editors.

On interruption, inspect any named .bak/.source recovery files and the per-target .lock alongside the target. Confirm no writer is active, preserve or reconcile user edits, then remove only the inspected stale lock/recovery files. Do not automatically delete these files or rerun stale approval. Ordinary successful operations remove their temporary files.

Managed replacement owns only the start-to-end marker interval; the existing suffix keeps its newline. Appending preserves all prior bytes. Reapplying unchanged content with fresh approval returns unchanged=true without replacing the file. Non-UTF-8 instruction files are rejected rather than rewritten lossily.

Approved replacement content must contain exactly one ordered managed boundary, including for direct helper callers. Malformed replacement content is rejected before changing the target.
