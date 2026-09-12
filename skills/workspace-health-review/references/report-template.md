# Workspace Health Review Report Template

Use this format for workspace health review output.

This human-readable report is the default. When a user or approved integration
requests machine-readable output, also use [result-contract.md](result-contract.md); do not replace
the readable findings with an unexplained payload.

```markdown
## Workspace Health Review

Workspace:
Review date:
Mode: Analyze first

### Summary

Overall status:
Numeric score: optional
Scoring method and evidence: required when a numeric score is present
Main risk:
Recommended next action:

### Inventory

- Workspace boundary:
- Child workspaces:
- Agent entries:
- Durable record systems:
- Skills / reusable rules:
- Key docs:

### Findings

#### P0

- Finding:
  Evidence:
  Impact:
  Recommended action:
  Requires approval: yes/no

#### P1

- Finding:
  Evidence:
  Impact:
  Recommended action:
  Requires approval: yes/no

#### P2

- Finding:
  Evidence:
  Impact:
  Recommended action:
  Requires approval: yes/no

### Health Signals

- Durable record health:
- Agent instruction health:
- Skill / rule load:
- Ownership clarity:
- Recovery readiness:
- Root index health:
- Lifecycle health:
- Context drift:
- Context debt:

### Root Index Review

- Root index present: yes/no/not needed
- Owner workspace:
- Authoritative record:
- First recovery entry:
- Fallback keywords:
- Last verified:
- Risk:

### Approval Required

- Action:
  Target:
  Reason:
  Risk:

### Next Review

Recommended timing:
Trigger conditions:
```
