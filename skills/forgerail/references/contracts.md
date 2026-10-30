# Launch And Return Contracts

## Task Envelope

Record the current task's:

- intent and non-goals;
- owner workspace;
- allowed and prohibited operations;
- applicable packs;
- independent approval gates;
- validation requirements;
- the acceptance item this task advances and the evidence that will prove it;
- required Return Receipt fields.

When useful for the task, express the goal as who or what consumes the result,
what they can accomplish and what evidence would establish it. For user-facing
delivery, prefer a minimal coherent outcome over a collection of finished modules.
Technical subtasks remain valid with their own bounded acceptance; do not enlarge
a CLI, CI, library, research or maintenance task to manufacture a product flow.
When requests or milestones change, relate them to the current outcome and carry
forward unfinished acceptance, marking it continued, replaced or deferred according
to the user's intent. Do not freeze a superseded goal or silently drop unfinished
work. Clear steering needs no repeated confirmation. Use existing task records or
conversation, without an additional report requirement.

Task authorization expires with the task. Never promote it into workspace policy automatically.

## Launch Contract

Give the host Agent the resolved Envelope plus the effective rule sources. In the Launch Contract, `envelope.packs` is an identity-to-canonical-manifest-digest map rather than the Task Envelope's pre-resolution id list. This makes every requested Pack self-bound for schema-only consumers; `effectivePackManifests` retains the complete active Pack set. Specify outcomes and boundaries, not unnecessary implementation steps.

## Return Receipt

Lead with the achieved outcome, supporting evidence and remaining gap, then give
the applicable delivery details below. Require:

- actual workspace, branch, and commit where applicable;
- changed scope;
- validation evidence;
- external side effects and confirmed non-mutations;
- residual risks;
- rollback or recovery entry;
- deviations from the Launch Contract.

Relate completion to the agreed task outcome and actual evidence. A passing build,
test or technical subtask does not by itself establish a wider user flow or human
acceptance. Report those separately when relevant, with unverified gaps and
limits; do not claim user acceptance that did not occur.

Compare the receipt with observable state. A mismatch keeps closeout incomplete.

## Adoption Plan

Record:

- current and proposed adoption level;
- deterministically resolved Host Adapters, their selection mode, and their support status;
- exact target paths, operations, base SHA-256 digests, candidate content, and content digests;
- required user confirmation and activation verification;
- confirmed non-mutations.

Planning is read-only. Do not expose an apply command or generate `.forgerail/` state in alpha.1.

## Host Binding Receipt

After an explicitly approved write, or after verifying that an existing binding already satisfies a `no-change` plan, record:

- the plan identity and adopted level;
- shared contract path when present;
- each host target, base and applied digests, support check, and verification status;
- changed files, discovered Skills, and activation verification mode. For an unchanged binding, use the effective existing instruction file as its host target, record equal base and applied digests, and leave it out of `changedFiles`;
- non-mutations and deviations.

A complete receipt requires every included host to be verified, activation discovery to pass, and deviations to be empty. A `profile-only` host normally keeps closeout incomplete until its host-specific check exists.
