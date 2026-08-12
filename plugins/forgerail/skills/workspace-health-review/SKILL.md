---
name: workspace-health-review
description: Use for periodic or requested workspace health reviews focused on durable records, agent instructions, skills, rules, ownership, stale context, context drift, context debt, and recovery risks. Use before large refactors, releases, onboarding, or cleanup. Do not use for implementation or release execution.
---

# Workspace Health Review

Review whether the workspace remains maintainable, recoverable, and safe for Agents.

This is the first built-in ForgeRail Capability Pack and preserves the established `workspace-health-review` identity. It remains independently invokable and defaults to Analyze First.

## Boundaries

- Do not implement features, execute releases, archive records, rewrite Skills, or change Agent instructions without approval.
- Follow the smallest owner workspace and distinguish project extensions from portable findings.
- Do not require ForgeRail Core to be invoked first.

## Review

1. Map workspace and child ownership boundaries.
2. Inventory existing Agent entries, record systems, Skills, docs, rules, and recovery surfaces.
3. Review durable-record health, instruction duplication, default context load, ownership, recovery, drift, and debt.
4. Use categorical status: `Healthy`, `Watch`, `Risky`, or `Critical`. Use a number only with an explained method and evidence.
5. Return path-based P0/P1/P2 findings and separate observations from proposed modifications.
6. Recommend ForgeRail Profile or pack changes only as candidates requiring confirmation.

Read `references/health-review.md` for detailed signals.
