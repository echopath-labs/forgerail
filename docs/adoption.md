# Progressive Adoption

ForgeRail separates **installation**, **availability**, **project adoption**, and **execution approval**. Installing the Plugin exposes guidance to the Agent; it does not edit workspace instructions, create durable state, enable Capability Packs, or authorize external effects.

This guide describes the current `0.1.0-alpha.4` / `v0.1.0-alpha.4` public prerelease.

Start with Plugin Only. Move up only when repeated evidence shows that a small durable project binding is more useful than asking explicitly each time.

## Level 0 — Plugin Only

This is the default and recommended first experience. The workspace remains unchanged while these four Skills are available:

- `$forgerail` for bounded engineering guidance;
- `$forgerail-workspace-diagnosis` for a read-only project picture;
- `$workspace-health-review` for an independent health review;
- `$architecture-convergence-audit` for duplicated-capability and ownership review.

Use Plugin Only for occasional diagnosis, unfamiliar repositories, early experimentation, and any project whose existing instructions are already sufficient.

## Level 1 — Lightweight Adoption

Use this level only when repeated ForgeRail use justifies a small, reviewable project binding.

- A single-host project may add one versioned managed block to the host's native instruction file.
- A multi-host project may use `FORGERAIL.md` as a portable Adoption Contract plus thin host bindings.
- Existing project instructions, specifications, ADRs, CI, and documentation remain authoritative in their own domains.

The optional planner is read-only:

```bash
npx --yes @echopath-labs/forgerail@0.1.0-alpha.4 adoption-plan --workspace . --host codex
npx --yes @echopath-labs/forgerail@0.1.0-alpha.4 adoption-plan --workspace . --host codex --host claude-code --host cursor
```

Every proposal must show the current and proposed level, exact target paths and content, base digests, each write's `approvalSha256`, required confirmation, verification steps, support status, and non-actions. ForgeRail deliberately has no `apply-adoption` command. The Agent shows the proposal and waits for a human decision. Node-based integrations must retain the approved `approvalSha256` separately from the mutable proposal, then pass it as the third argument to `applyApprovedAdoptionWrite()` from `scripts/lib/adoption.mjs` so the canonical workspace path plus opened directory identity, destination, operation, marker, content, confinement, no-follow open, file identity and base digest are revalidated against one immutable snapshot at write time. Apply accepts only `create`, `append-managed-block`, or `replace-managed-block`, even when another operation is covered by a syntactically valid digest. Replacing the directory at the same path invalidates the approval. If a post-install check fails after replacing an existing binding, ForgeRail atomically renames the retained original inode directly over the verified installed candidate; it preserves recovery evidence and returns the original failure when safe restoration is impossible. The Agent verifies discovery in a new task and returns a Host Binding Receipt.

## Level 2 — Persisted Governance

Persisted machine-consumed ForgeRail state is deferred in the current alpha. It should be considered only when important evidence cannot be represented coherently through existing project sources, such as repeated cross-host conflicts or genuinely machine-enforced policy.

ForgeRail does not create `.forgerail/` at this level today. A future design must define ownership, precedence, migration, recovery, and deletion before enabling it.

## Host support

| Host | Native target | Alpha.4 status | Verification boundary |
| --- | --- | --- | --- |
| Codex | `AGENTS.md` | `supported` | New Codex task discovers all four main Skills and the approved binding is in scope |
| Claude Code | `CLAUDE.md` | `profile-only` | Target and thin binding are modeled; end-to-end activation is not claimed |
| Cursor | `.cursor/rules/forgerail.mdc` | `profile-only` | Target is modeled; Skill discovery and end-to-end activation are not claimed |

Unknown hosts need a reviewed Host Adapter before ForgeRail can generate a binding. A Host Adapter projects ForgeRail into a host; it is not ForgeRail Core or a second policy source.

## Capability Packs stay separate

Do not add a Capability Pack to project instructions simply because it is installed. Recommend one only when project evidence calls for that capability. Packs keep independent authentication, approval, validation, rollback, and lifecycle boundaries.

Cross-Workspace Orchestration is for genuine multi-owner, multi-repository, or multi-release coordination with safe dependency waves. It is not a reason to split an ordinary repository into artificial tasks. RelayPact can transport a bounded delegation and EchoPath can support recovery/context; neither is a ForgeRail runtime dependency.

## Completion and removal

A Lightweight Adoption is complete only when:

1. the applied file digest matches the approved plan;
2. supported-host discovery is verified in a new task or equivalent fresh check;
3. deviations are empty or explicitly accepted;
4. the receipt records exactly what changed and did not change.

Uninstalling the Plugin does not silently remove adopted instructions. Revise or remove managed blocks through another exact, reviewed plan so unrelated project content is preserved.

For normal use, begin with the [installation guide](installation.md) and stay at Plugin Only until a real project need appears.
