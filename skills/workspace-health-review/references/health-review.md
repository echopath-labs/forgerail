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

Prefer categorical status. Recommendations are:

- `P0`: blocks high-risk work or safe recovery;
- `P1`: should be corrected soon;
- `P2`: useful cleanup.

Every proposed modification must name its target and state that approval is required.
