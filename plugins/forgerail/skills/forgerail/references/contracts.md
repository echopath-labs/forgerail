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

Give the host Agent the resolved Envelope plus the effective rule sources. In the Launch Contract, `envelope.packs` is an identity-to-canonical-manifest-digest map rather than the Task Envelope's pre-resolution id list. This makes every requested Pack self-bound for schema-only consumers; `effectivePackManifests` retains the complete active Pack set. Specify outcomes and boundaries, not unnecessary implementation steps.

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

## Adoption Plan

Record:

- current and proposed adoption level;
- deterministically resolved Host Adapters, their selection mode, and their support status;
- exact target paths, operations, base SHA-256 digests, candidate content, and content digests;
- required user confirmation and activation verification;
- confirmed non-mutations.

Planning is read-only. Do not expose an apply command or generate `.forgerail/` state in alpha.1.

## Host Binding Receipt

After an explicitly approved write, record:

- the plan identity and adopted level;
- shared contract path when present;
- each host target, base and applied digests, support check, and verification status;
- changed files, discovered Skills, and activation verification mode;
- non-mutations and deviations.

A complete receipt requires every included host to be verified, activation discovery to pass, and deviations to be empty. A `profile-only` host normally keeps closeout incomplete until its host-specific check exists.
