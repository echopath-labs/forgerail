# Engineering Mode

Use this reference for effort selection, local risk, evidence reuse and stopping.
ForgeRail supplies principles and bounded checks; the host executes authorized
work and compares observable results. Mode does not grant authorization or
certify business completion.

## Resolve The Existing Profile

Use only the applicable `engineering.mode` claim through existing Profile source,
digest, pointer, scope, dependency and precedence rules. Values are exactly
`fast`, `balanced`, `strict`; explicit invalid values are errors. No declaration
or no applicable claim uses `balanced` as a portable default without a write.
Machine confirmation of the two known keys requires a structured JSON Pointer;
a Markdown-heading binding alone remains unresolved for their normalized values.
Do not create mode-specific files or another precedence system.

An explicit user choice may raise or lower default effort for this task and scope,
including choosing fast over a project's strict default. Record that choice and
its reason in the conversation or existing task record. It neither changes the
project default nor overrides higher-priority restrictions, independent mandatory
review/CI, authorization, data protection or concrete risk requirements. The host
cannot silently downgrade effort. Durable defaults use the existing Profile
preview/apply lifecycle; task choices do not.

Keep configuration resolution separate from temporary work policy:

- If only effort preference is unconfirmed, other relevant required rules remain
  valid, and no stronger requirement is known, say “mode unresolved; temporarily
  using balanced effort for this task” and continue authorized implementation and
  focused verification. Keep invalid, missing, digest-mismatched or conflicting
  configuration visible; do not report resolution success or modify its digest.
- Preserve applicable strengthening from a reliably traceable last confirmed
  strict requirement even after its source digest becomes stale. Unconfirmed new
  source text is a risk hint, not accepted authority. If there is no traceable
  confirmation, report it as unknown rather than inventing history.
- Check the action's relevant claims and dependencies. If the same failed source
  also carries required branch, authorization or data rules, stop actions that
  depend on those rules while continuing independent authorized work. An active
  claim alone does not excuse an unresolved dependency; an unresolved whole
  Profile alone does not stop unrelated work. If the affected scope is unclear,
  investigate that scope before assuming only mode failed.
- Repair source bindings through the existing lifecycle. Compare changed source
  content with the reviewed baseline behind the old expected digest; do not
  refresh a hash merely to hide drift. A file affects confirmation only when it
  is actually bound as a digest-checked source.

Explain the base mode, actual task effort, source and scope, default/override or
provisional reason, configuration status and available Profile revision without
requiring a new receipt file. CLI output cannot prove a user's task authorization.

## Choose Bounded Effort

| Mode | Verification and review | Stop expanding checks when |
| --- | --- | --- |
| fast | Relevant build/run, key smoke, direct regression checks and a brief host impact judgment; retain mandatory review | Agreed behavior works, these checks finish, and no known blocker remains |
| balanced (default) | Fast baseline plus relevant regression/impact checks and one scoped review; the host may review | The final relevant diff has that review and required checks/gates are satisfied |
| strict | Checks for the affected high-risk system and its critical dependencies, with applicable security, release and recovery requirements | Required risk evidence and gates are satisfied and residual risk is explicit |

“One review” includes fixing blocking findings and checking the affected fix; it
does not demand another full review round. A required bot review that serves the
same objective avoids a duplicate independent review, while the host still
assesses its conclusion. Review independence follows an existing rule or concrete
risk, not the mode name alone. Never treat CI execution as semantic review or a
bot comment as a substitute for required tests.

Strengthen only the path with a concrete risk. State its evidence, scope, extra
checks and end condition briefly. For example, a server authorization change
needs allow/deny/unauthorized cases; a reference-aware delete needs no-reference,
real-reference and lookup-failure cases. A permission button or MVP test release
does not by itself make the whole task strict. An irreversible production
migration needs migration-scoped strict evidence and the project's authorization
and runbook; mode does not authorize a rehearsal, backup, restore or shared-data
operation. Investigate unclear impact within a bound before expanding scope.

## Reuse Evidence And Deliver

Use existing process results, test logs, CI runs and delivery records. Retain enough
context to identify the check, purpose, command/environment, tested code or
artifact, relevant inputs, actual exit/failure/skip status and evidence source.
This is guidance for interpreting evidence, not a mandatory field list for every
command. Do not add a task ledger or collect secrets and full environment dumps.

Reuse successful results when the tested object and relevant code, dependencies,
configuration, inputs and environment still apply. A matching SHA is insufficient
if relevant external state changed; a different SHA does not invalidate unrelated
results after documentation-only changes. Recheck only affected checks after a
fix unless a mandatory rule requires more. If applicability is unclear, say so
and perform a bounded follow-up. Reobserve external identity/permission and live
state at the action's required freshness boundary; past evidence is not current
authorization. Mark failed, skipped, stale and unverified results accurately.

Unmet requirements, a broken core path, destructive regression, evidenced data
corruption/unauthorized access/secret disclosure, failed mandatory checks and
missing required evidence block the affected delivery. Missing authorization,
platform denial or an unavailable environment blocks the corresponding action.
Non-mandatory unchecked behavior is disclosed without mechanically blocking all
delivery. Style suggestions, harmless wording and future ideas do not restart
work; a wrong critical usage contract can be blocking even in documentation.

When the mode's conditions are met, continue already-authorized delivery without
adding “one more” full suite or review. Required fresh pre-release checks still
apply. Report implementation, deployment readiness, actual deployment and human
business acceptance separately. The existing receipt verifier retains its limited
Git observations and cannot turn self-reported success into certified completion.
