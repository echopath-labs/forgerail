# First Alpha Architecture Acceptance

Accepted on 2026-08-12:

- Core + Workspace Diagnosis + Workspace Health Review ship in the main Agent Plugin.
- GitHub Rulesets, Release Safety, and Thread Closure begin as external Capability Packs.
- Workspace Profile is computed from existing sources; no `.forgerail/profile.yaml` is created by default.
- A lightweight npm/npx CLI is approved for deterministic diagnosis, contract validation, installation inspection, and bundle construction; it is not a prerequisite for using the Agent Plugin.

## Measurable Acceptance

The first usable prerelease must prove:

1. official Plugin and Skill validators accept the payload;
2. clean discovery of exactly three main-Plugin Skills;
3. bounded diagnosis inherits an existing Markdown/ADR practice without recommending OpenSpec;
4. a workspace with no observed record practice receives recommendations but no file mutation;
5. installed Workspace Health remains `available` unless enabled, required, or explicitly invoked;
6. conflicting allowed/prohibited operations fail validation;
7. a Return Receipt with unresolved deviations cannot close as complete;
8. deterministic bundle inventory and digest are reproducible;
9. disposable install, diagnosis, Launch/Receipt, upgrade, rollback, and uninstall smoke pass before public release;
10. AGW remains the rollback baseline until shadow comparison and an explicitly approved migration gate complete.

## Representative Shadow Tasks

- normal feature work with branch and durable-record handling;
- bug fix with dirty-worktree preservation;
- documentation-only task using existing Markdown decisions;
- shared-environment release preparation requiring a project runbook;
- GitHub Rulesets assessment where no remote mutation is authorized;
- completed task requiring a workspace health or closure recommendation.

The compatibility period cannot end until all mapped AGW/WHR behaviors have owners, disposable and real canaries show no uncovered P0/P1 behavior, rollback is proven, and lifecycle change receives separate approval.
