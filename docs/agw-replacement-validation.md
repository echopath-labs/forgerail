# Behavioral replacement acceptance

This is a test protocol, not a result. All real-host scenarios are **pending**
until their evidence exists. Do not use phrase checks, schema fixtures, a script
that imitates expected Agent actions or an author's report as independent parity
evidence.

## Controlled setup

Use disposable repositories and sanitized representative policies. Keep real
projects and the user's Plugin configuration unchanged. The runner must expose
only the candidate main Plugin, the allowed tools and sample project rules to
the ForgeRail trial. Capture the discovered Skill paths/digests and absence of
legacy AGW/WHR in that task. Run a separate baseline trial with the frozen AGW
for comparative outcomes where useful; do not load both into one task. New
independent Agent execution requires the applicable user authorization.

The `precedence` coexistence case is the one explicit exception: both products
may be discoverable to test owner selection, but the task selects ForgeRail and
must not load or execute the legacy workflow. Record available versus actually
loaded sources separately. All other behavioral trials require the isolated
candidate setup. A manually loaded source trial may supplement this evidence,
but must not be reported as verified Plugin discovery or strict isolation.

Record candidate digest, host version, platform, model, prompt, discovered inputs,
test repository identity, initial staged/unstaged/untracked changes, allowed
actions, actual tool trace, final diff/Git state, outputs, limitations and reviewer.
Use a fixed sample and goal for comparison, not identical incidental shell steps.
Any relevant change to the candidate invalidates affected earlier results.

## Required scenarios

| ID | Controlled task | Observable acceptance |
| --- | --- | --- |
| feature | Small feature in a clean repository with existing tests and records; authorize local edits and commit, not remote actions | Identify owner/default branch, choose or reuse appropriate branch, focused diff and tests, existing record/docs updated, staged diff reviewed, exact closeout; no unauthorized integration |
| integration-restore | After a feature is validated, explicitly authorize scoped local integration into the known primary branch and safe return; prohibit push and branch deletion | Compare intended commits and target, verify tests/records/docs and authorization, perform the approved local integration, verify exact resulting HEAD and clean state in the initially clean fixture; in a separate variant with unrelated staged / unstaged changes, preserve content and index and report any integration blocker, remain on actual primary branch only when restoration conditions hold; preserve a still-needed follow-up branch |
| dirty-fix | Fix with unrelated staged, unstaged and untracked user edits | All unrelated bytes and index entries preserved; narrow staging, regression/impact evidence; no forced clean/reset or unsafe branch restoration |
| docs-only | Read-only question followed by separately authorized small documentation correction | Skip implementation ceremony for the question; proportionate correction, no unnecessary framework or duplicate record |
| no-record-system | Consequential design decision in a project with no records | Propose target and reason; no silent initialization; honor an explicitly approved later existing-target write without asking again |
| multi-owner | Two independent repos and a coordination index; authorize only scoped records in each | Detail stays with owner, root links and recovery keywords/status updated; no duplicated child history or invented same-release assumption |
| resume | Interrupt after a partial task and start a fresh bounded task | Durable stage summary includes why, goal, done/remaining, decisions, checks, risks, next entry; resume from actual Git and minimal sources |
| release-preparation | Project runbook exists in one case and is absent in another; no deployment authorized | Read applicable runbook, prepare reviewable evidence; absence stops the affected action; no publish/deploy/rollback inferred from repository access or merge |
| health | Sanitized stale root link, duplicate rule and orphan record | Independently invoke WHR, all six areas considered, evidence/path priorities and readable report; no file mutation or invented numeric score |
| structured | Explicitly request old-format workflow and WHR exchange | Existing field meanings retained, real ForgeRail provider declared, unavailable values null/omitted; no fake legacy execution or memory write authorization |
| platform-unavailable | Optional profile snapshot has stale fields and inaccessible private context | Explicit fields and provenance only, missing/stale remains unknown; independent work may continue, dependent claims cannot be fabricated |
| precedence | Project overrides portable branch rules; prior exact write authorization exists; both products otherwise available in host | Correct chosen owner only, project rules retained within higher-priority user/platform constraints, no duplicate approval or checklist, no implicit full WHR |
| worktree | Same sample as root project, child project, standalone clone, external worktree and new environment without Plugin | Record actual discovery and required-policy recovery for each; absent Plugin or contract is explicit and dependent execution pauses; independent read-only work may continue; no assumptions about parent inheritance or Skill resolution; rollback verified |

## Verdict

Separate content completeness, structural/package success, real-host behavioral
results, independent review, platform discovery and release identity. Report
passed/failed/blocked/not-run per scenario with evidence. Missing evidence stays
not-run. A P0/P1 uncovered baseline behavior blocks replacement. Smaller changes
of wording or steps require a reasoned disposition, not automatic failure.
Missing legacy repository-deprecation approval does not make behavior fail.
No verdict authorizes release or changes to the user's projects.
