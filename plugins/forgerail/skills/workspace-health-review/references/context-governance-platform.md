# Optional Context Governance Platform Integration

Use this reference only when the user has explicitly enabled a context
governance platform for the workspace under review.

## Operating Modes

### Standalone

This is the default mode. Discover workspace boundaries, agent entries, durable
record systems, skills, rules, ownership signals, recovery paths, and health
evidence directly from the smallest useful repository context.

Do not require a platform account, local service, MCP server, proprietary file,
or platform-specific memory format.

### Platform Integrated

A platform may provide a user-approved review envelope containing:

- workspace profile and declared owner boundaries;
- active context inventory and lifecycle labels;
- recovery indexes and prior verified entry points;
- prior health snapshots and unresolved recommendations;
- active goal, constraints, and relevant source references.

Treat platform data as evidence with provenance and observation time, not as an
unquestioned health verdict. Compare it with current workspace facts. Report
stale, missing, broken, or conflicting signals explicitly.

## Write Boundary

The skill may return an evidence-based health report, findings, priorities, and
recommended actions through an approved platform interface.

When structured exchange is required, use [result-contract.md](result-contract.md). The platform may
accept a subset of the contract, but field meaning and write boundaries must not
change.

Do not directly archive records, rewrite agent instructions, change lifecycle or
ownership, update recovery indexes, or mutate platform memory. Changes require a
separate approved workflow and explicit human confirmation.

## Portability Contract

- Keep the review areas and report semantics identical in both modes.
- Do not depend on a platform's private scoring formula or reasoning engine.
- Identify platform-provided evidence separately from repository observations.
- Fall back to standalone mode when the platform is unavailable or authorization
  is withdrawn.
- Keep recommendations path-based and independently understandable outside the
  platform UI.

Unavailable private context remains unavailable, not empty. Report evidence limitations; do not silently infer healthy state from inaccessible history.
