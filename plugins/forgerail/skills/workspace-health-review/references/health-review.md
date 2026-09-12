# Workspace Health Review Reference

Use this reference to perform a workspace-level governance health review.

The goal is not to collect every document. The goal is to identify whether a human or agent can safely understand, change, and resume work in the workspace.

## Review Areas

### 1. Workspace Boundary

Check whether the repository or workspace boundary is clear.

Look for:

- `.git/`, worktree boundaries, or nested repositories;
- `AGENTS.md`, `CLAUDE.md`, `.cursor/rules`, `.github/copilot-instructions.md`, or similar agent entries;
- package, service, app, library, plugin, build, CI, or deployment boundaries;
- child workspaces that should own their own instructions or durable records.

Flag risks when:

- the root workspace appears to own details that belong to a child workspace;
- child workspaces have independent build/release behavior but no local agent entry;
- instructions tell agents to read broad parent context before finding the smallest owner.

### 2. Durable Record Health

Review the durable record systems already present. These may include OpenSpec, ADRs, issues, design docs, runbooks, project notes, release notes, or decision records.

Flag risks when:

- important decisions are only in chat history;
- active records have no owner, next step, or status;
- completed records remain active without reason;
- records duplicate each other without references;
- records cannot be used as recovery entry points;
- stale records contradict current code or instructions.

Do not introduce a new durable record system without user approval.

### 3. Agent Instruction Health

Review agent-facing instructions.

Common files include:

- `AGENTS.md`
- `CLAUDE.md`
- `.cursor/rules`
- `.github/copilot-instructions.md`
- `.codex/skills`
- project-specific prompts or playbooks

Flag risks when:

- instructions are too long for routine startup;
- the same rules appear in several files and can drift;
- rules mix general workflow, release safety, project facts, and task-specific history;
- instructions tell agents to mutate durable memory without human approval;
- private or environment-specific operations are described without safety gates.

### 4. Skill And Rule Load

Estimate whether the workspace loads too many rules or skills by default.

Flag risks when:

- many skills are globally active when only a few are relevant;
- project-specific skills are installed globally;
- large references are loaded for casual or read-only tasks;
- rules are not scoped by task type, workspace, or risk level;
- obsolete skills remain available and compete with newer rules.

### 5. Ownership And Recovery Health

Review whether future humans or agents can resume work.

Healthy workspaces usually answer:

- Which workspace owns this behavior?
- Where is the authoritative durable record?
- What is the first file to read?
- Which keywords recover the context?
- What is the next step?
- Which records are active, archived, deprecated, or disposable?

Flag risks when:

- ownership is unclear;
- recovery requires reading many unrelated documents;
- active work has no next step;
- important records have no stable entry point;
- archived or deprecated context still appears as active.

For multi-workspace trees, check whether cross-workspace context has a root
index instead of being duplicated into broad parent docs.

A healthy root index points to child-owned authoritative records and usually
includes:

- owner workspace;
- authoritative record path, such as an OpenSpec change/spec, ADR, issue, doc,
  or runbook;
- first recovery entry;
- fallback search keywords;
- related workspaces;
- current status or lifecycle;
- last verification point.

Flag risks when:

- the root workspace stores detailed child-workspace investigation evidence;
- child OpenSpec, ADR, issue, or doc records contain details but no root index
  points to them;
- root index paths still point to archived or moved active changes;
- root index entries have no fallback keywords or last verification point;
- recovery would require reading broad parent history instead of one child
  authoritative record plus a small index.

### 6. Context Drift And Context Debt

Context drift means instructions, docs, records, and code no longer agree.

Context debt means accumulated context makes future work slower, riskier, or more expensive.

Examples:

- old decisions still appear authoritative;
- root docs duplicate child docs;
- multiple rules describe different branch or release behavior;
- stale active changes remain after completion;
- onboarding requires reading too many files before doing safe work.

## Scoring Guidance

Default to a categorical status: `Healthy`, `Watch`, `Risky`, or `Critical`.
Use that status as the primary communication surface.

A numeric score is optional. Include one only when the report also shows the
method, evaluated signals, and evidence supporting the result. Never invent a
precise score merely to fill a template.

When a numeric score is useful, use it as a communication tool, not as fake
precision.

Suggested scale:

- `85-100`: Healthy. Minor cleanup only.
- `65-84`: Watch. Some debt or unclear ownership exists.
- `40-64`: Risky. Recovery or safe agent work is likely degraded.
- `0-39`: Critical. Governance is unclear enough to block safe scaling.

Always explain the score with concrete evidence.

## Recommendation Levels

- `P0`: Must address before high-risk work, release, or large refactor.
- `P1`: Should address soon to reduce recovery cost or agent error.
- `P2`: Useful cleanup or documentation improvement.

Separate observations from proposed modifications. If a recommendation changes files, label it as requiring approval.

## Additional ForgeRail Signals And Routing

Also report these as recurring Health signals when bounded evidence exists:

- stale or unclaimed worktrees and worktrees whose recovery owner is unknown;
- active specification records that conflict with delivered behavior or remain active after completion;
- stale governance links, superseded ADR references, and generated artifacts that drift from their declared source;
- declared CI topology that differs from provider-observed topology, while keeping unavailable provider evidence unavailable;
- compatibility, test, or abstraction growth whose current consumer and recovery value are unclear;
- runner qualification evidence made stale by a relevant configuration or trust-boundary change.

Health observes recurring drift, debt, orphaning, and recovery cost. It does not
discover the workspace from scratch, mint authority, evaluate a protected
transition, or decide that an implementation layer is redundant. Route those
questions to Workspace Diagnosis, ForgeRail Core, or an explicitly invoked
architecture convergence audit respectively.

Prefer categorical status. Recommendations are:

- `P0`: blocks high-risk work or safe recovery;
- `P1`: should be corrected soon;
- `P2`: useful cleanup.

Every proposed modification must name its target and state that approval is required.
