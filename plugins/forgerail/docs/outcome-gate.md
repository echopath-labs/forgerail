# Outcome Gate — Experimental / Opt-in (0.1.13)

An explicit local check, not a default engineering gate or business-completion decision. Existing `verify-receipt` is unchanged. Outcome Gate observes file/index state and actual selected process exits rather than trusting validationEvidence strings.

## Session interface

Start `forgerail outcome-gate` and keep stdin/stdout open. Each newline-terminated JSON request produces one JSON response. This is a single local process, not a server or persistent task service. IDs expire on exit. Never write session output into the workspace being observed: it would change the snapshot.

1. At the real task start send `{"action":"capture","workspace":"/absolute/owner"}`. Retain the returned `baseline` ID. A late capture cannot prove earlier state; the Host owns correct task-start timing.
2. Perform authorized work using the Host's normal tools.
3. Send `{"action":"unchanged","requirement":{"source":"user:preserve-contract","workspace":"/absolute/owner","baseline":"<returned-id>","paths":["src/contract.mjs"],"expected":"unchanged"}}`.
4. Send `{"action":"run","requirement":{"source":"project:required-unit-test","workspace":"/absolute/owner","script":"scripts/test.mjs","args":[],"expectedExit":0,"authorized":true,"hostIsolation":"confirmed","timeoutMs":30000}}` only after the Host has confirmed exact authorization and suitable isolation for that existing script.
5. Before reusing a result send `{"action":"check","workspace":"/absolute/owner","evidence":"<returned-id>"}`. Never reuse an earlier response as proof of current state without rechecking.

`paths` are literal owner-relative file or directory prefixes, not globs. Each requirement includes its source, exact workspace, subject and expected result. The Host must retain all mandatory conditions; this interface cannot prove an omitted natural-language requirement was included. Unknown evidence, missing baseline and unavailable observations are UNVERIFIED. A JSON file containing an old ID cannot restore evidence in another process.

## Results

- VERIFIED: current observation supports this specific requirement.
- FAILED: observed protected-file/index difference or a nonzero selected validation exit.
- UNVERIFIED: missing evidence, different worktree, unsupported environment, timeout/output overflow or unsafe observation.
- STALE: workspace state differs from execution-bound state, including changes during execution.

Responses retain requirement/source, scope, identity/digests where available, execution exit metadata and limitations. No aggregate task-complete field. Returning partial results is allowed and does not block Host feedback. stdout/stderr contents are not retained or echoed (only byte count) to reduce secret leakage; use project-approved diagnostics separately.

## Explicit MVP limits

- POSIX local Node `.js/.mjs/.cjs` scripts only, literal arguments, no shell. No npm install, tool recovery or generic command runner. Other toolchains are not implemented.
- 60-second maximum execution, 64 KiB combined output, 32 baselines and 32 evidence records per session, 64 KiB input buffer.
- Snapshot includes ignored regular files, file permissions, contents, staged entries, HEAD and exact real worktree identity. Limits: 10,000 entries, 8 MiB/file, 32 MiB total. No symlinks, nested repos, submodules or unborn HEAD. Unsupported state is UNVERIFIED, never guessed.
- Generated build artifacts count as changed state; a build writing files may return STALE. This deliberately favors conservative refusal over invented source exclusions.
- The Host's sandbox owns filesystem/network/credential boundaries. Authorization flags are caller attestations, not permission grants. Do not run untrusted scripts or scripts with unauthorized external effects. Process-group termination does not constrain deliberately escaping children.
- This is not an atomic filesystem snapshot or adversarial-proof attestation. Requires a stable, trusted workspace without concurrent writers. External files/services, toolchain replacement, environment changes and business semantics are outside evidence coverage. Same local snapshot is not proof those inputs remain unchanged.

Final release checks and required review remain mandatory. No new default Core/Skill loading is introduced.

## Reliability notes (candidate)

Observation failures include bounded `diagnostic` fields (`code`, `phase`, and for Git failures exit code, signal, errno and elapsed milliseconds). They exclude Git stderr, filesystem exception text and malformed JSON excerpts. They explain refusal, not environmental health.

Evidence binds symbolic HEAD as well as the commit. Once `check` observes changed state, that record remains STALE even if files are restored. Returned JS objects are detached copies. Concurrent `run` calls return SESSION_BUSY; unmerged index entries and nonzero index flags (including intent-to-add, assume-unchanged and skip-worktree) are unsupported and return INDEX_UNSUPPORTED. Protected path aliases are rejected instead of mistaken for absent paths.

Process-group cleanup errors other than an already absent group produce UNVERIFIED. This cannot guarantee cleanup of deliberately escaped children. Stable-workspace and external-input limitations remain unchanged.

SIGINT and SIGTERM cancel the active validation process group and wait for the child to close before the CLI exits, with a one-second cleanup grace. If closure cannot be confirmed within that grace, cleanup is unverified and no successful evidence is issued. SIGKILL, Host crashes and deliberately escaped descendants cannot be handled by session cleanup; the Host isolation boundary remains required.
