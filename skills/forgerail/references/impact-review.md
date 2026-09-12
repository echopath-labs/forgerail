# Existing-Behavior Impact Review

Run an impact review after every bug fix, feature, optimization, refactor, dependency change, or configuration change.

## Review Questions

- Which existing user flows, APIs, jobs, commands, deployments, integrations, or data paths could be affected?
- Does the change touch shared code, auth, upload/download, storage, payment, rendering, parsing, conversion, deployment, or release tooling?
- What focused regression checks were run?
- What could not be checked in the current environment?
- What residual risk remains?

## Validation Examples

Choose checks that match the work:

| Area | Common checks |
| --- | --- |
| Product | Acceptance criteria, user flow, scope and non-goals |
| Development | Tests, lint, build, API checks, UI checks |
| QA | Reproduction steps, regression scope, test data, defect status |
| Operations | Checklist execution, metric definition, rollout or rollback evidence |
| Data | Data source, metric consistency, anomaly checks |
| Customer success | Customer config, delivery checklist, handoff risk |

## Reporting

Report impact review in the final response and in durable records when one exists.

Use this shape:

- Affected existing behavior.
- Checks performed.
- Unchecked behavior.
- Residual risk.

If impact cannot be assessed, treat that as a blocker unless the user explicitly approves proceeding with the risk.
