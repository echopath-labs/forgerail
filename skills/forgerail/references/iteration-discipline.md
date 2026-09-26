# Iteration And Escalation Discipline

Use this reference when work involves repeated attempts against a verification
system (CI, tests, deployment, shared environment, external service), when
progress stalls across sessions, or when the critical path is blocked.

## Verification Systems Are Not Trial Harnesses

- Treat CI runs, deployments, and shared-environment mutations as evidence
  gathering, not error discovery. Before each attempt, state the reproduced
  failure or the concrete hypothesis that this attempt will confirm or refute,
  and why this attempt can distinguish it.
- On the second failure of the same class, stop point-fixing. Either batch the
  known issues of that class into one systemic fix owned by the appropriate
  toolchain or platform owner, or state explicitly what new hypothesis the next
  attempt carries and why it differs from the previous ones. Repetition without
  new information is not iteration.
- Environment and toolchain failures belong to their owner; do not route them
  through the product delivery pipeline as single-symptom changes.

## Progress Is Anchored To Acceptance

- Every unit of work (branch, review request, sprint) SHALL name the acceptance
  item it advances and the evidence that will prove it. Work that advances no
  acceptance item is not progress, however well executed.
- Preparatory work (inactive, staged, candidate artifacts) is legitimate only
  when it names the gate it waits for and that gate is reachable within the
  current plan. Do not produce successive layers of preparation to avoid facing
  a blocker.

## Waiting Is Not Idling

- Classify every blocker: agent-actionable within current authorization, or
  human-decision (approval, review, real-account access, credential, risk
  acceptance).
- Stop the affected line of work only when a human decision sits on the
  critical path AND cannot be resolved within current authorization.
  Uncertainty on a side path is not a stop line.
- On a stop line, emit an escalation memo: the exact decision needed, its
  owner, the materials already prepared, and the resume entry. Then stop;
  do not substitute adjacent work to remain busy.
- While waiting on a human gate, preparing the verified next step (rehearsal
  scripts, checklists, draft changes) is legitimate; executing gated actions
  is not.

## Verify Planning Inputs Against Evidence

- Task lists, checkboxes, branch states, and status documents are claims, not
  facts. Before using a record as planning input, cross-check it against
  observable evidence: merged changes, check results, live state, revision
  topology. Scale verification depth to how much the plan depends on the
  record; do not audit everything.
- Report discrepancies between records and evidence as findings. Repairing a
  stale record is a separately scoped task; do not mix it into feature work.
