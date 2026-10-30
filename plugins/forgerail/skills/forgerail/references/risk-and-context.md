# Risk And Context Discipline

Use this reference when handling high-risk operations, long-running work, or context-heavy tasks.

## Context Budget

Read only context that helps the current task. Do not bulk-load unrelated specs, changes, docs, skill references, logs, or historical notes.

Use the smallest useful set:

- Project or workspace overview.
- Relevant specs, ADRs, issues, or docs.
- Relevant active change or task record.
- Specific files, commands, or docs needed for the next step.

If more context is needed, explain why before expanding the search.

## High-Risk Operations

Verify explicit authorization for the exact action and scope before the operations below. Reuse existing valid authorization; if it is missing, show a concrete preview and ask before execution. Ordinary scoped edits are not a new approval gate merely because they overwrite previous file content.

Operations requiring this check:

- Destructive deletion, loss of unrelated content, or bulk changes outside the approved scope.
- Database migrations, production data changes, or production config changes.
- Releases, deployments, rollbacks, image changes, or shared-environment operations.
- Customer configuration, delivery scope, or externally visible commitments.
- Sending final reports or external communications on behalf of the team.

Before asking for confirmation, state:

- What will be done.
- Affected files, environments, data, users, or customers.
- Dry-run, preview, backup, or rollback plan when applicable.
- What validation will prove success.

## Stage Summaries And Handoff

For long-running work, material state changes or handoff, update the existing
owner record with the smallest useful recovery set:

- Current goal and why it matters; achieved results, unfinished acceptance and key decisions.
- Owner, scope, non-goals and authorization boundaries.
- Actual branch, working tree and candidate or running version where relevant.
- Applicable evidence, its limitations, remaining risks and the next executable step.
- Primary context source and minimal recovery pointers.

On resumption, check the facts the next action depends on. Use relevant confirmed
experience within its original scope and version; do not treat old success as
current state or proposed knowledge as accepted policy. Reuse unchanged evidence.
Prefer pointers over copied bodies, do not depend solely on chat history, and do
not create a new ledger or update a summary after every small action.
