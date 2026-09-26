# Adoption Rules

Use the minimum level:

1. `plugin-only`: default; no workspace mutation.
2. `lightweight-adoption`: user-confirmed host instruction binding.
3. `persisted-governance`: evidence-gated and deferred in alpha.1.

For one host, propose one versioned managed block when its adapter supports that mode. For multiple hosts, or one thin-reference-only host, propose `FORGERAIL.md` plus thin references. Host files are adapters, not Core sources.

Translate the user's natural-language host intent into one deterministic selection: repeated `--host <adapter>` for an explicit subset, `--selection all-detected` for registry adapters evidenced in the workspace, or `--selection all-available` for every adapter in the current registry. Omitting both options defaults to `all-detected`. Do not invent a host ID or instruction path; an unknown host needs a reviewed Host Adapter. Run `forgerail adoption-plan --workspace <path> ...` when the deterministic CLI is available. Never infer permission to apply the returned writes. Display the retained selection, exact content, paths and each write's `approvalSha256`, obtain confirmation, and preserve the approved digest separately from the mutable proposal. Node-based integrations must pass that retained digest as the third argument to `applyApprovedAdoptionWrite()` from `scripts/lib/adoption.mjs` to revalidate the canonical workspace identity and complete executable write metadata from one immutable snapshot, plus confinement, no-follow open, file identity and base digest at write time. Produce a Host Binding Receipt after verification.

Codex is `supported`. Claude Code remains `profile-only`. For Cursor, read the current Host Adapter status: mark the shared `AGENTS.md` plus matching project Core route `supported` only after a fresh IDE Agent session verifies that exact packaged Core tree and mode. A Core content change requires a new acceptance before renewing that claim. The proposed Cursor Rule route stays `profile-only` until separately verified in the IDE; Cursor CLI and Cloud Agent are not certified by an IDE result. Every adopted project needs its own fresh-session activation check.

When Cursor alone already has an applicable `AGENTS.md` pointer and a project Core tree matching the candidate package, the planner can return `no-change` at `lightweight-adoption`. After fresh-session verification, record `AGENTS.md` as the effective host target in the Host Binding Receipt, with equal base and applied SHA-256 digests and no changed file. In a multi-host plan, Cursor also needs a visible reference to `FORGERAIL.md`; otherwise the planner proposes a thin Cursor Rule and keeps that route `profile-only` until verified.

An indented, fenced, or negated path mention is not an instruction pointer. A competing Cursor-local Core Skill prevents shared-Core coverage. When a multi-host plan omits the Cursor Rule, its approved writes bind the observed `AGENTS.md` and Core tree digests; replan if either source changes before applying a write. If a selected Codex managed block would remove the only shared Core pointer, retain the Cursor Rule in the plan.

## Explicit project snapshot lifecycle

When the executing package supports init/update/doctor/remove, use those separate
project lifecycle commands for user-requested Codex snapshot adoption. First
generate and show the read-only plan, then apply its digest within existing
operation authorization. Reuse valid approval rather than asking at every step.
Keep config (project choice), installation manifest (generated identity), and
operation receipt separate. Drift and unknown schema block writes. Project
metadata does not enable persisted governance. Use recover to preview rollback
after interruption; preserve external edits and individual recovery evidence.
CLI and project Skill versions are separate. Verify static readiness, fresh-host
discovery and model behavior independently. Published 0.1.4 lacks these lifecycle
commands; never route it to a command it does not provide.
