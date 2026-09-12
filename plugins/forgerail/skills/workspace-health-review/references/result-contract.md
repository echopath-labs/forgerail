# Workspace Health Review Result Contract

Read this reference only when a user requests machine-readable review state or
an approved integration exchanges structured input or output.

This optional exchange shape retains the established health report fields. In a receipt or discovery evidence, identify the ForgeRail Plugin as the actual provider; this is not evidence that the legacy AGW Plugin ran.

The human-readable report remains the default. This contract is an optional
adapter and must not change the review areas, evidence standard, or approval
boundary.

## Optional Input Envelope

```yaml
schema_version: 1
input_type: workspace_health_review_input
mode: standalone | platform-integrated
workspace:
  root: path
  declared_children: [path]
review_scope: [path]
review_trigger: requested | periodic | pre-refactor | pre-release | onboarding | cleanup | other
declared_sources:
  - ref: path-or-id
    kind: agent-entry | durable-record | skill | rule | recovery-index | health-snapshot | other
    origin: user | repository | platform
    observed_at: timestamp | null
project_extensions:
  - name: string
    source: path-or-id
prior_review: path-or-id | null
```

Platform and project-extension values are review inputs, not a health verdict.
Verify machine-checkable claims against current workspace evidence when
practical. Omit unavailable optional fields or use `null`; never invent values.

## Optional Review Result

```yaml
schema_version: 1
result_type: workspace_health_review
skill: workspace-health-review
mode: standalone | platform-integrated
observed_at: timestamp
workspace:
  root: path
  reviewed_scope: [path]
overall_status: Healthy | Watch | Risky | Critical
numeric_score:
  value: number | null
  method: string | null
inventory:
  child_workspaces: [path]
  agent_entries: [path]
  durable_record_systems: [string]
  skills_and_rules: [path-or-id]
findings:
  - id: string
    priority: P0 | P1 | P2
    area: boundary | durable-records | instructions | skill-load | ownership | recovery | root-index | lifecycle | context-drift | context-debt | other
    observation: string
    evidence: [path-or-command]
    impact: string
    recommendation: string
    requires_approval: boolean
    source: core-review | project-extension | platform-comparison
health_signals:
  durable_record_health: string
  agent_instruction_health: string
  skill_rule_load: string
  ownership_clarity: string
  recovery_readiness: string
  root_index_health: string
  lifecycle_health: string
  context_drift: string
  context_debt: string
approval_required:
  - action: string
    target: string
    reason: string
    risk: string
next_review:
  timing: string | null
  trigger_conditions: [string]
```

## Output Rules

- Findings must lead with observable evidence, not a score.
- Numeric scoring remains optional and requires an explicit method.
- Mark project-specific checks as `project-extension`; do not present them as
  universal rules.
- Keep repository observations separate from platform-provided evidence.
- Do not include secrets, raw private platform state, hidden scoring formulas, or
  chain-of-thought.
- A returned report is not permission to archive, delete, rewrite, or mutate
  durable context.
- If task-level implementation is needed, hand it off as a separate approved
  workflow rather than modifying files during the review.
