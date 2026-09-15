---
name: architecture-convergence-audit
description: Use when asked to assess engineering structure, plan a refactor, review bounded architectural drift, or find duplicate capability ownership and premature abstractions. Produces read-only, evidence-backed recommendations; not general workspace discovery or recurring health review.
---

# Architecture Convergence Audit

Run independently when applicable. ForgeRail Core does not need to run first.
Default to Analyze First, read-only operation, and `medium` risk.

## Choose the assessment

For engineering paradigm planning, refactor assessment, or drift against accepted
project choices, read [engineering paradigm guidance](references/engineering-paradigm.md).
For capability-owner duplication, use the convergence audit below. Combine them
only when the requested outcome needs both; a paradigm assessment need not
produce the full duplication report. Ordinary implementation does not require
an architecture audit.

## Convergence audit

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
- Workspace Health owns recurring workspace-wide stale, drift, orphan, debt, and recovery signals; a selected architectural question can be assessed here.
- ForgeRail Core owns deterministic identity, authority, topology, revision, and Receipt invariants.
- This Pack owns bounded engineering-structure assessment, architectural drift analysis and capability-owner convergence recommendations.
- Project facts come from the existing Governance Source Inventory, Effective Profile, and Task Envelope. Do not create another Profile, adoption lifecycle, task ledger, Receipt, `.forgerail/` state, or writeback path.
- Do not edit, delete, merge, release, deploy, publish, change lifecycle state, or create an external issue. The template in `assets/github-issue-template.md` is output material only and requires exact external-write authorization before use.
