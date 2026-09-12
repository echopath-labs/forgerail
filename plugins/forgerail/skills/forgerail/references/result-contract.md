# Workflow Governance Result Contract

Read this reference only when a user requests machine-readable workflow state or
an approved integration exchanges structured input or closeout output.

This is the optional legacy exchange shape for existing consumers, not the ForgeRail v1/v2 Return Receipt schema. Use it only when requested; do not pass it to `verify-receipt` or claim that AGW executed. Confirm consumer compatibility with the actual `skill: forgerail` identity.

The human-readable closeout remains the default. This contract is an optional
adapter and must not change the core workflow.

## Precedence

Apply inputs in this order:

1. Non-overridable safety and authorization boundaries.
2. The user's confirmed task scope and approvals.
3. The nearest workspace instructions and project-specific workflow or safety
   checklists.
4. This generic skill.
5. Optional platform-provided candidates.

Project-specific rules may extend or tighten this skill. Do not execute two
equivalent skills as duplicate checklists. Report material conflicts and stop
before acting when the conflict affects safety, ownership, release, or durable
write location.

## Optional Input Envelope

```yaml
schema_version: 1
input_type: workflow_governance_input
mode: standalone | platform-integrated
task:
  goal: string
  success_criteria: [string]
workspace:
  started_from: path
  owner_candidate: path | null
  allowed_scope: [path]
constraints: [string]
sources:
  - ref: path-or-id
    origin: user | repository | platform
    observed_at: timestamp | null
durable_record_candidate:
  system: string | null
  path: path | null
recovery_entry_candidate: path-or-id | null
```

Platform values are candidates, not hidden authority. Verify machine-checkable
claims against repository evidence when practical. Omit unavailable optional
fields or use `null`; never invent values to complete the envelope.

## Optional Closeout Result

```yaml
schema_version: 1
result_type: workflow_governance_closeout
skill: forgerail
mode: standalone | platform-integrated
observed_at: timestamp
workspace:
  started_from: path
  owner: path | null
task:
  goal: string
  status: completed | partial | blocked | investigation-only
git:
  repositories:
    - path: path
      branch: string | null
      head: string | null
      worktree_state: clean | dirty | unknown
      commits: [string]
durable_record:
  system: string | null
  path: path | null
  status: updated | proposed | skipped | unknown
  write_approved: boolean | null
validation:
  checks: [string]
  unchecked: [string]
  impact_review: string | null
risks: [string]
next_step: string | null
health_signals:
  - area: ownership | lifecycle | recovery | instructions | skill-load | context-debt | other
    observation: string
    evidence: [path-or-command]
    suggested_action: string | null
approval_required:
  - action: string
    target: string
    reason: string
evidence: [path-or-command]
```

## Output Rules

- Keep facts separate from proposals and recommendations.
- Every health signal must name observable evidence.
- Do not include secrets, raw private platform state, hidden scoring formulas, or
  chain-of-thought.
- A returned result is not permission to mutate project or platform memory.
- Durable writeback requires the target system's deterministic governance
  boundary and explicit human approval.
- A workspace-wide health signal may recommend `workspace-health-review`, but it
  must not start that review automatically.
