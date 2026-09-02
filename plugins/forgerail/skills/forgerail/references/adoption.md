# Adoption Rules

Use the minimum level:

1. `plugin-only`: default; no workspace mutation.
2. `lightweight-adoption`: user-confirmed host instruction binding.
3. `persisted-governance`: evidence-gated and deferred in alpha.1.

For one host, propose one versioned managed block in its native target. For multiple hosts, propose `FORGERAIL.md` plus thin references. Host files are adapters, not Core sources.

Run `forgerail adoption-plan --workspace <path> --host <adapter>` when the deterministic CLI is available. Never infer permission to apply the returned writes. Display exact content and paths, obtain confirmation, and preserve unrelated content. Node-based integrations should use `applyApprovedAdoptionWrite()` from `scripts/lib/adoption.mjs` to revalidate confinement, no-follow open, file identity and base digest at write time. Produce a Host Binding Receipt after verification.

Codex is `supported` in alpha.1. Claude Code and Cursor are `profile-only`; do not close their binding as verified without a host-specific activation check.
