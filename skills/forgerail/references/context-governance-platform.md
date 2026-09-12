# Optional Context Governance Platform Integration

Use this reference only when the user has explicitly enabled a context
governance platform for the current workspace.

## Operating Modes

### Standalone

This is the default mode. Derive workspace boundary, task scope, durable record
location, git state, validation evidence, risk, and handoff state from the
repository and the user's request.

Do not require a platform account, local service, MCP server, proprietary file,
or platform-specific memory format.

### Platform Integrated

A platform may provide a user-approved context envelope containing:

- current goal and success criteria;
- workspace owner and allowed scope;
- active constraints and relevant source references;
- durable record and recovery entry candidates;
- prior handoff or workspace health signals.

When the platform supplies an Engineering Profile Snapshot, apply the additional
boundary in [engineering-profile-snapshot.md](engineering-profile-snapshot.md). Until a stable shared schema is
accepted, map only explicit fields into the optional input envelope and report
which fields were used.

Treat this envelope as scoped workflow input, not as hidden authority. Verify
machine-checkable claims against repository evidence when practical. Surface
missing, stale, or conflicting inputs instead of silently reconciling them.

## Write Boundary

The skill may return workflow results such as branch state, validation evidence,
risks, durable record status, next step, and handoff state through an approved
platform interface.

When structured exchange is required, use [result-contract.md](result-contract.md). The platform may
accept a subset of the contract, but field meaning and write boundaries must not
change.

Do not directly mutate platform memory, ownership, lifecycle, recovery indexes,
or other durable context. A durable write requires the platform's deterministic
governance boundary and explicit human approval.

## Portability Contract

- Keep the core workflow identical in both modes.
- Do not depend on a platform's internal scoring or reasoning engine.
- Report which platform-provided inputs were used.
- Fall back to standalone mode when the platform is unavailable or authorization
  is withdrawn.
- Keep project-specific release, production, compliance, and operations rules in
  the project workspace.

Unavailable private context stays unavailable, not empty. Standalone fallback can continue only for work whose required evidence is independently available; report a missing required source instead of inventing recovery state.
