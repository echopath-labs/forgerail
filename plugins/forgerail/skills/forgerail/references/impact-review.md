# Existing-Behavior Impact Review

Assess existing-behavior impact after a bug fix, feature, optimization, refactor,
dependency or configuration change, including instructions and executable
documentation that change host behavior. Scale the judgment and checks to the
actual impact and [engineering mode](engineering-mode.md); a brief host judgment
can satisfy fast. Do not equate “impact review” with an additional independent
review or full regression suite.

## Review Questions

- Which existing user flows, APIs, jobs, commands, deployments, integrations, or data paths could be affected?
- Does the change touch shared code, auth, upload/download, storage, payment, rendering, parsing, conversion, deployment, or release tooling?
- What focused regression checks were run?
- What could not be checked in the current environment?
- What residual risk remains?

## CI Checks And Semantic Review

Select deterministic CI/build/test/contract checks separately from semantic
Agent/bot review. CI running does not prove review happened; a review comment does
not replace required tests. Use an existing project classification and check map
when present instead of creating competing path rules. Extensions and paths are
clues; read the actual meaning, including additions, deletions, renames and mixed
changes. If impact is unclear, inspect a bounded scope first.

| Change | Default checks and review |
| --- | --- |
| Ordinary notes, process material or pure layout | Accuracy, scope and sensitive-content judgment plus relevant light checks; no unrelated build/full suite or extra code bot review |
| Usage, API contracts, release or migration guidance | Relevant examples, contracts, links or operational checks; review consistency with real behavior |
| AGENTS.md, SKILL.md, rule templates, generator inputs or executable documentation | Relevant contract, generation or behavior checks and semantic review based on changed behavior, including Markdown |
| Binary documents | Inspect content with supported extraction or reading when needed; unreadable diff is not evidence of low risk; report required gaps |
| Mixed code/docs, CI, test scripts, dependencies or release configuration | Combined behavior and delivery impact, with related documentation in the same scoped review |

Formatting may be semantic: YAML indentation, heading locators, managed markers
and script blocks can affect behavior. Process records carrying important
acceptance or release conclusions still need factual verification.

All modes retain existing mandatory CI and bot review even for ordinary documents.
Suggest configuration improvements separately; do not disable, skip or label
unrun checks passed. A future authorized CI change must inspect actual triggers
and required-check relationships so filtering neither leaves required checks
waiting forever nor reports skipped applicable checks as success. This guidance
does not require a GitHub integration, new workflow or automatic classifier.

When an edited file is a digest-bound Profile source, use the existing
`project-profile-inspect` with required identity and operation evidence. Compare
content, locator and scope against the traceable reviewed baseline behind the
old digest. Explain expected mismatch; when authorized, update the candidate
through existing preview/apply and inspect again. Do not blindly refresh hashes,
activate unreviewed drift or change a consumer's configuration without authority.
Unbound files do not need a mechanical Profile inspection. New-session behavior
validation is useful when activation, authorization, gates or data protection
actually change or existing rules require it, not for every wording edit.

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

Explain why selected checks cover the relevant impact, reuse still-applicable
results and name unverified behavior. If missing impact evidence prevents a
required safety or acceptance judgment, block only the affected action and
prepare the concrete decision needed. Do not stop independent authorized work
or add another review after the applicable completion conditions are met.
