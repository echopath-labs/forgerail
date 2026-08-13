# Progressive Adoption

ForgeRail separates availability from project adoption. Installing the Agent Plugin or optional CLI makes capabilities available; it does not edit workspace instructions, create durable state, enable Capability Packs, or authorize external effects.

## Three Levels

### Level 0 — Plugin Only

This is the default. Skills are available to the host Agent, while the workspace remains unchanged. Use this level when occasional explicit or implicit Skill discovery is enough.

### Level 1 — Lightweight Adoption

Use this only after an Agent shows an exact Adoption Plan and the user confirms its writes.

- For one host with concise principles, ForgeRail proposes one versioned managed block in that host's native instruction entry.
- For multiple hosts, ForgeRail proposes `FORGERAIL.md` as the portable Adoption Contract plus thin host bindings that point to it.

The planner is read-only:

```bash
forgerail adoption-plan --workspace . --host codex
forgerail adoption-plan --workspace . --host codex --host claude-code --host cursor
```

Each proposal contains the current and proposed level, exact target paths and content, base SHA-256 digests, required confirmation, verification steps, support status, and confirmed non-mutations. There is deliberately no `apply-adoption` command. The host Agent must display the proposal or diff, wait for confirmation, make only the approved writes, then return a Host Binding Receipt.

### Level 2 — Persisted Governance

This level is reserved for evidence that cannot be represented coherently through existing workspace sources: machine-consumed configuration, CI enforcement, or repeated cross-host conflicts. ForgeRail alpha.1 neither creates nor proposes `.forgerail/` state. A future design must define ownership, precedence, migration, and deletion semantics before enabling it.

## Host Support

| Host | Native target | Alpha.1 status | Verification |
| --- | --- | --- | --- |
| Codex | `AGENTS.md` | `supported` | Start a new Codex task, verify the binding is in scope, and discover the three main Plugin Skills. |
| Claude Code | `CLAUDE.md` | `profile-only` | The target and thin binding are modeled, but end-to-end activation is not claimed until host-specific verification exists. |
| Cursor | `.cursor/rules/forgerail.mdc` | `profile-only` | The Rules target is modeled, but Skill discovery and end-to-end activation are not claimed. |

Unknown hosts require a reviewed Host Adapter before ForgeRail can generate a binding. A Host Adapter is a projection boundary, not the ForgeRail Core or a second policy source.

## Verification And Removal

An adoption is complete only when the applied file digest matches the approved plan, supported-host discovery is verified in a new task or equivalent supported check, deviations are empty, and non-mutations are recorded. Profile-only hosts remain unverified until their own host check passes.

Removing ForgeRail does not silently remove adopted project instructions. Uninstall the Plugin separately; remove or revise managed blocks through another reviewed plan so unrelated project content is preserved.
