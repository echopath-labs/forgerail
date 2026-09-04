# Adoption Rules

Use the minimum level:

1. `plugin-only`: default; no workspace mutation.
2. `lightweight-adoption`: user-confirmed host instruction binding.
3. `persisted-governance`: evidence-gated and deferred in alpha.1.

For one host, propose one versioned managed block when its adapter supports that mode. For multiple hosts, or one thin-reference-only host, propose `FORGERAIL.md` plus thin references. Host files are adapters, not Core sources.

Translate the user's natural-language host intent into one deterministic selection: repeated `--host <adapter>` for an explicit subset, `--selection all-detected` for registry adapters evidenced in the workspace, or `--selection all-available` for every adapter in the current registry. Omitting both options defaults to `all-detected`. Do not invent a host ID or instruction path; an unknown host needs a reviewed Host Adapter. Run `forgerail adoption-plan --workspace <path> ...` when the deterministic CLI is available. Never infer permission to apply the returned writes. Display the retained selection, exact content, paths and each write's `approvalSha256`, obtain confirmation, and preserve the approved digest separately from the mutable proposal. Node-based integrations must pass that retained digest as the third argument to `applyApprovedAdoptionWrite()` from `scripts/lib/adoption.mjs` to revalidate the canonical workspace identity and complete executable write metadata from one immutable snapshot, plus confinement, no-follow open, file identity and base digest at write time. Produce a Host Binding Receipt after verification.

Codex is `supported` in alpha.1. Claude Code and Cursor are `profile-only`; do not close their binding as verified without a host-specific activation check.
