# Host Adapters And Recovery

## Host coordination capabilities

Treat these as Host Adapter capabilities with explicit support status:

- `create`: create an independent task/session;
- `inspect`: read its current state and stable output;
- `wait`: wait without busy polling;
- `message`: deliver bounded follow-up instructions;
- `resume`: continue after interruption or review feedback.

Do not assume Codex task/thread APIs exist in Claude Code, Cursor, or another host. If capabilities are missing or unverified, return bounded owner prompts and use user-created sessions, a stable handoff exchange, or serial execution. Do not invent task state.

## Optional integrations

- RelayPact may transport delegation, execution requests, status, and returns. It does not own ForgeRail approvals, writer locks, review, or acceptance.
- EchoPath may supply user-authorized recovery and context evidence. An unavailable binding is not empty history, and EchoPath is not required to operate this Pack.

## Recovery rules

- **Pause:** stop new dispatch; do not broaden or revoke in-flight authorization implicitly.
- **Partial failure:** preserve accepted independent receipts; pause the failed task and dependency descendants; re-evaluate remaining independent roots.
- **Task drift:** freeze acceptance and return to the owner source with the original envelope and observed mismatch.
- **Priority change:** stop new dispatch, preserve active task scope, recompute pending waves and writer identities.
- **Master restart:** rebuild only owner map, dependency edges, writer identities, active approvals, task statuses, and accepted receipts from observable owner sources and the project's existing record system.
- **Unavailable owner/session:** mark it paused or blocked; never treat silence or transport failure as success.

Fresh authorization is required when a recovered or replanned task would add operations, change owner or writer identity, or cross another approval class.
