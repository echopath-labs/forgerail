# Launch And Return Contracts

## Task Envelope

Record the current task's:

- intent and non-goals;
- owner workspace;
- allowed and prohibited operations;
- applicable packs;
- independent approval gates;
- validation requirements;
- required Return Receipt fields.

Task authorization expires with the task. Never promote it into workspace policy automatically.

## Launch Contract

Give the host Agent the Envelope plus the effective rule sources. Specify outcomes and boundaries, not unnecessary implementation steps.

## Return Receipt

Require:

- actual workspace, branch, and commit where applicable;
- changed scope;
- validation evidence;
- external side effects and confirmed non-mutations;
- residual risks;
- rollback or recovery entry;
- deviations from the Launch Contract.

Compare the receipt with observable state. A mismatch keeps closeout incomplete.
