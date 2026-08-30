# Architecture Convergence Audit Contract

## Evidence and ownership

Start from the selected task outcome, not the shape of the proposed code. For
each outcome, identify:

- the accepted behavior and failure or concurrency scenario;
- the component that owns the durable fact;
- current implementation and direct callers;
- persistence, lifecycle, recovery, and compatibility responsibilities;
- local validation, provider/CI evidence, deployment, and real-consumer proof;
- freshness and any exact evidence still required.

An interface that owns authorization, transactionality, substitution,
anti-corruption, or failure isolation is not redundant merely because it is
thin. A large cohesive slice is not overbuilt merely because it spans many
files.

## Duplication tests

Investigate when evidence indicates two owners for the same:

- canonical identity or normalization boundary;
- durable state transition or lifecycle;
- parser or source-of-truth interpretation;
- compatibility or version negotiation path;
- recovery, replay, rollback, or resume mechanism;
- background worker coordination responsibility;
- schema, projection, or generated-contract authority.

Classify a finding as `confirmed` only when ownership and behavior are traced.
Otherwise use `inferred` and name the smallest verification that can resolve it.

## Required output

Return:

1. baseline, freshness, allowed scope, and explicit non-mutations;
2. already-owned capability map;
3. confirmed redundancy and inferred redundancy in separate sections;
4. invariants and failure coverage that must remain;
5. smallest remaining implementation boundary;
6. deletion, consolidation, or deferral candidates;
7. negative constraints and prohibited shortcuts;
8. independently verifiable vertical slices;
9. validation requirements and observable acceptance conditions;
10. owner decisions or confirmations still required.

Prefer deletion or consolidation before introducing a replacement abstraction.
Tests that only encode an obsolete duplicate implementation may be removed,
while tests that prove user-visible behavior, security, concurrency, data, or
operational invariants remain.

## Routing and stopping conditions

- Route source discovery to Workspace Diagnosis.
- Route recurring stale or drift assessment to Workspace Health.
- Route deterministic transition decisions to ForgeRail Core.
- Stop with inference when callers, durable fact ownership, or current behavior cannot be verified.
- Do not block an otherwise safe functional path solely for incomplete convergence evidence.
- Any mutation or external tracker operation requires a separate exact target, content, authority, and validation boundary.
