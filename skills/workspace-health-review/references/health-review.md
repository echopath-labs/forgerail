# Workspace Health Signals

Review the smallest useful evidence for:

- unclear root versus child workspace ownership;
- important decisions existing only in chat;
- completed records left active without reason;
- duplicated or conflicting Agent instructions;
- too many globally or implicitly loaded Skills;
- missing owner, next entry, fallback keyword, lifecycle, or recovery path;
- stale active links pointing to moved or archived records;
- release or production rules mixed into generic workflow guidance;
- hidden durable mutation without human approval.

Also report these as recurring Health signals when bounded evidence exists:

- stale or unclaimed worktrees and worktrees whose recovery owner is unknown;
- active specification records that conflict with delivered behavior or remain active after completion;
- stale governance links, superseded ADR references, and generated artifacts that drift from their declared source;
- declared CI topology that differs from provider-observed topology, while keeping unavailable provider evidence unavailable;
- compatibility, test, or abstraction growth whose current consumer and recovery value are unclear;
- runner qualification evidence made stale by a relevant configuration or trust-boundary change.

Health observes recurring drift, debt, orphaning, and recovery cost. It does not
discover the workspace from scratch, mint authority, evaluate a protected
transition, or decide that an implementation layer is redundant. Route those
questions to Workspace Diagnosis, ForgeRail Core, or an explicitly invoked
architecture convergence audit respectively.

Prefer categorical status. Recommendations are:

- `P0`: blocks high-risk work or safe recovery;
- `P1`: should be corrected soon;
- `P2`: useful cleanup.

Every proposed modification must name its target and state that approval is required.
