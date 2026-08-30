---
name: architecture-convergence-audit
description: Use when explicitly asked to find duplicate capability ownership, parallel state or recovery paths, premature abstractions, or the smallest remaining implementation boundary. Produces a read-only evidence-backed convergence audit; do not use for general workspace discovery or recurring health review.
---

# Architecture Convergence Audit

Run independently when applicable. ForgeRail Core does not need to run first.
Default to Analyze First, read-only operation, and `medium` risk.

## Audit

1. Bind the request to a reproducible baseline and state what freshness remains unverified.
2. Map each requested outcome as `product invariant -> authoritative owner -> current implementation -> callers -> persistence/lifecycle -> validation evidence`.
3. Trace suspected duplicate identity fences, state machines, parsers, adapters, compatibility paths, workers, recovery paths, schemas, and implementation-shaped tests to their durable fact owner and current consumer.
4. Apply the retention burden: require accepted behavior or a real failure/concurrency scenario, why the existing owner is insufficient, the durable fact owner, a current or committed consumer, and a validation method.
5. Separate confirmed redundancy from inference. Incomplete evidence returns an exact verification need, not a deletion claim.
6. Return the smallest remaining independently useful vertical slices and a deletion-first consolidation plan that preserves required invariants and failure coverage.

Do not infer redundancy from diff size, file count, test count, interface thinness,
or abstraction count. Read `references/audit-contract.md` for ownership routing,
required output, negative constraints, and acceptance rules.

## Boundaries

- Workspace Diagnosis discovers sources, habits, owner boundaries, commands, and dependency availability.
- Workspace Health owns recurring stale, drift, orphan, debt, and recovery signals.
- ForgeRail Core owns deterministic identity, authority, topology, revision, and Receipt invariants.
- This Pack owns only bounded capability-owner duplication analysis and the convergence plan.
- Project facts come from the existing Governance Source Inventory, Effective Profile, and Task Envelope. Do not create another Profile, adoption lifecycle, task ledger, Receipt, `.forgerail/` state, or writeback path.
- Do not edit, delete, merge, release, deploy, publish, change lifecycle state, or create an external issue. The template in `assets/github-issue-template.md` is output material only and requires exact external-write authorization before use.
