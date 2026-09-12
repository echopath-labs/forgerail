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

## Stage Summaries

For long-running or multi-thread work, update durable records with stable facts and provide a concise stage summary:

- Current objective.
- Completed work.
- Remaining work.
- Key decisions.
- Validation.
- Risks.
- Next step.

Do not rely on chat history for durable handoff.

## Handoff Discipline

When handing work to another Agent or future thread, provide:

- Current goal.
- Why this work exists.
- Owner workspace or repository.
- Primary context source.
- Minimal recovery set.
- Allowed scope.
- Non-goals.
- Current branch and working tree state.
- Validation already run.
- Residual risks and next step.

Prefer evidence pointers over copied source bodies.
