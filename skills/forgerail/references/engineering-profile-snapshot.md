# Optional Engineering Profile Snapshot

Read this reference only when the user or an explicitly enabled context governance platform supplies an Engineering
Profile Snapshot for the current task.

The snapshot is optional scoped input. It does not change ForgeRail's core workflow, create a platform dependency, or grant
authority to update Profile state.

Until a versioned shared schema is accepted:

- consume only explicit goal, success criteria, owner, allowed scope, constraints, source references, observation
  time and expiry fields that map unambiguously to [result-contract.md](result-contract.md);
- report the snapshot source, version if present, observed time and fields used;
- verify machine-checkable repository claims when practical;
- surface stale, expired, unknown or conflicting fields instead of inferring replacements;
- ignore platform-only memory, approval, recovery, scoring and lifecycle internals;
- fall back to standalone repository evidence when the snapshot is missing or unusable.

ForgeRail must not create, refresh, approve, persist or publish the snapshot. EchoPath integration remains additive and the
same explicit input must produce the same governance interpretation in standalone and platform-integrated modes.
