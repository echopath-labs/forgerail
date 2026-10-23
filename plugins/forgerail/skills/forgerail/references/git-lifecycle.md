# Git Lifecycle Guide

Use this reference when creating branches, committing, merging, pushing, aligning primary branches, or closing out an iteration.

## Contents

- [Preflight](#preflight)
- [Primary Branch Naming](#primary-branch-naming)
- [Resolve Branch Rules](#resolve-branch-rules)
- [Branch Ownership And Creation](#branch-ownership-and-creation)
- [Check Actual Branch Results](#check-actual-branch-results)
- [Bounded Parallel Work](#bounded-parallel-work)
- [Lightweight Integration Paths](#lightweight-integration-paths)
- [Release And Shared Environment Work](#release-and-shared-environment-work)
- [PR And Commit Granularity](#pr-and-commit-granularity)
- [Commit Rules](#commit-rules)
- [Merge And Closeout](#merge-and-closeout)
- [Closeout Branch Restore](#closeout-branch-restore)

## Preflight

Run git status in every involved repository before editing.

Record mentally or in durable notes when relevant:

- Current branch.
- Whether the branch tracks a remote.
- Uncommitted changes and whether they are yours.
- Relevant remote state when pushing, merging, or releasing.

Never revert, overwrite, reformat, or stage user changes unless the user explicitly asks.
Preserve unrelated staged, unstaged, and untracked content and existing index
entries. Inspect both the staged diff and the working-tree diff, including hunks
within the same file. Do not reset, unstage, stash, or clean user changes merely
to narrow a commit, unblock integration, or obtain a clean status.

## Primary Branch Naming

For new repositories, prefer `main` as the default primary branch.

For existing repositories, identify the actual primary branch in this order:

1. Use an explicit default branch from repository metadata, the hosting
   platform, or applicable project governance. Preserve project-specific names,
   including a primary branch that is neither `main` nor `master`.
2. Otherwise, use the symbolic HEAD of the relevant authoritative or upstream
   remote, such as `refs/remotes/<remote>/HEAD`. Do not treat an arbitrary
   remote as authoritative when several remotes exist.
3. If no usable remote HEAD exists, use `main` or `master` only when exactly one
   of those candidates exists in the relevant local and remote branch evidence.
4. If both `main` and `master` exist, the relevant remote is unclear, or the
   available evidence conflicts, report the evidence and ask the user to
   identify the primary branch. Do not create or switch branches from a guess.

The currently checked-out branch alone is not reliable primary-branch evidence.
Respect an existing `master`, `main`, or project-specific primary branch. Never
rename `master` to `main`, or rename any existing primary branch, without an
explicit migration request and a plan covering remotes, CI, branch protection,
release scripts, and documentation.

When saying a repository is aligned, refer to its primary branch instead of assuming one name.

## Resolve Branch Rules

Resolve branch naming and lifecycle in this order:

1. Follow enforced hosting, CI, and repository rules.
2. Follow the nearest applicable workspace or repository governance, such as
   `AGENTS.md`, `CONTRIBUTING.md`, or a documented development workflow.
3. When no written rule exists, follow a clear and consistent recent convention
   from human-owned branches or pull requests. Do not infer a rule from one
   branch or from automation-owned branches.
4. If no convention is established, use:
   - `feat/<short-scope>` for a new capability or iteration.
   - `hotfix/<short-scope>` for a defect whose relevant code is on the primary
     branch, including an already released defect or security fix.
   - `chore/<short-scope>` for maintenance, tooling, dependency, build, CI,
     test-infrastructure, or configuration work.
   - `docs/<short-scope>` for documentation-only work.
   - `release/<version-or-scope>` only for an explicitly needed integration
     test branch, grouped release, or release candidate.

Use a concise lowercase kebab-case scope unless the repository requires a ticket
identifier or another format. Choose the prefix from the primary outcome: tests
and documentation that accompany a feature do not change `feat/` into `chore/`
or `docs/`.

Treat these prefixes as portable defaults, not an allow-list. Use `feature/`,
`fix/`, `bugfix/`, `backport/`, or another namespace when the repository defines
the corresponding convention or lifecycle. Never rename or bypass a repository
rule merely to force these portable defaults.

Do not create `codex/*` or another Agent- or tool-branded prefix merely to
identify AI-authored work. Preserve a suitable current branch, including one
created or required by the user, repository, hosting platform, or automation. If
an enforced rule requires a different namespace, follow it and report the
exception instead of renaming or bypassing it.

Do not rename an existing or pushed branch merely because it does not match
these defaults. A mistakenly created branch in the current task has the narrower
[bounded correction](#check-actual-branch-results) path below when every condition
and the current task's correction authorization are established.

## Branch Ownership And Creation

Before editing, determine:

- The repository's actual primary branch and current branch.
- Whether the current branch owns the requested work and has no conflicting
  unrelated work.
- Whether a bug belongs to the primary baseline or only to unreleased code on
  the current task or release branch.
- Whether the user's request explicitly authorizes implementation.
- Whether the worktree is clean enough for a safe branch switch.

Reuse the current branch when it owns the requested work. In particular:

- Fix a defect discovered during feature work on the owning `feat/*` branch.
- Fix a stabilization defect discovered during release testing on the owning
  `release/*` branch.
- Keep related follow-up work on another suitable task branch when switching
  would lose the required code context.

Do not mechanically create `hotfix/*` from the primary branch for a defect that
exists only in unreleased feature or release-candidate code.

When the Agent is on the verified primary branch, an explicit implementation
request authorizes creating the repository-appropriate task branch at its current
HEAD before editing if task type, scope, ownership and repository rules are
unambiguous. A clean worktree is sufficient; unrelated dirty files are also
acceptable when their content and existing index entries can be preserved exactly.
Record and verify that preservation when creating the branch. Under the
portable defaults:

- Create `feat/<short-scope>` for a new capability or iteration.
- Create `hotfix/<short-scope>` for a defect whose relevant baseline is the
  primary branch.
- Use the applicable maintenance or documentation prefix for other work.

Do not automatically create or switch branches when ownership or isolation is
ambiguous, the primary baseline is unknown, the branch belongs to unrelated
committed work or a different release, or a nearer rule requires confirmation.
If unrelated dirty files cannot be safely preserved, stop the affected branch
operation and explain the concrete conflict; never clean or stash them to proceed.
Reuse an existing task branch when it owns the authorized work. Do not ask for a
branch decision merely because safely preservable unrelated dirty files exist.

Branch creation authorization does not authorize merge, push, branch deletion,
release, or deployment.

## Check Actual Branch Results

Resolve explicit `git.branch.naming` claims through the existing Profile, source,
digest, scope and precedence rules. The known value is a `prefixes` object mapping
`feature`, `fix`, `maintenance`, and `documentation` to non-empty prefix arrays.
Absent an applicable declaration, keep the portable defaults above labeled as
defaults; they are not a project-enforced allow-list. All modes preserve the same
explicit branch rules.

For the first relevant branch operation, and when owner, policy or operation
intent changes, use the CLI's read-only `branch-check` before/after phases:
`forgerail branch-check --workspace <owner> --phase before --task-type <type>
--branch <name> --intent create|reuse --checkout true|false`. Save its JSON output
outside the repository; afterward use the same arguments with `--phase after
--before <saved-before.json>`. For adopted Profiles, supply independent
`--workspace-identity` evidence and the applicable `--operation`/`--target` scope;
required applicable provider dependencies remain unverified in this local-only
command and must be resolved before the affected action. The checker does not
create Profile state. Before the host creates or reuses a branch, supply the exact owner,
task type, candidate, create/reuse intent and whether checkout is intended.
Preserve the returned local refs/HEAD and policy revision in a temporary task file;
it is an observation, not an authorization token or ownership certificate.
Choose a compliant candidate and recheck within existing authorization if the
candidate is wrong. Do not invoke the check on every conversation turn.

The host performs the authorized Git operation, then checks its actual result
using the original before observation and identical intent. Creation without
checkout needs the ref to exist; it does not require HEAD to switch. Checkout
intent also needs the actual HEAD to match. A changed policy, wrong owner/worktree,
missing before state, truncated/failed observation or concurrent ambiguity cannot
prove success. Read the result instead of claiming success from the command plan.
The checker never creates, switches, renames or deletes branches and never reads
remote state. Direct Git commands can bypass it; a check proves only its observed
moment, not global enforcement.

If actual creation produced an unexpected name, the host may correct it without
another prompt only within already-confirmed current-task correction authority
and when **all** of the following are supported by evidence:

- Before state plus this task's non-forcing creation record and after observation
  establish this is a newly created branch of this task, not an old branch.
- It was not pushed; no upstream alone is insufficient. Use current relevant
  remote evidence when needed and authorized; unknown push state is not safe.
- No commits added by others, no other task dependency, and clear task ownership.
  Inherited baseline commits are legitimate; author fields alone cannot prove
  ownership or the absence of another task's dependency.
- No other worktree has it checked out, the correct target is explicit and absent,
  and the rename preserves commits, working tree and staging area.
- Correction does not delete, reset, clean, overwrite a ref, force push, or bypass
  a mandatory host limitation.

Compare commits, worktree and staging state before and after a permitted rename,
rerun the post-check and report the actual correction (for example, created
`codex/x`, corrected to `feat/x`). If any condition is unknown or false, preserve
state, explain the bounded correction plan and missing decision, and pause only
related operations. A naming-only mismatch with established ownership/isolation
can still allow authorized local edits; ambiguous ownership or other-task
dependence cannot. On correction failure or renewed inconsistency, stop that
correction and report; do not enter a rename loop.

Reuse a suitable existing task branch even if it follows historical naming.
Use the before observation to distinguish reuse from creation; a newly wrong
branch cannot be relabeled “historical reuse” using a caller-supplied flag.

## Bounded Parallel Work

Keep parallel lines of work for the same objective bounded and attributable.
Each active branch or worktree SHALL be able to answer which acceptance item it
advances and when it converges; a line that cannot answer both is debt, not
parallelism. After integration, delete the integrated branch only when branch
deletion is explicitly authorized; otherwise report the retained branch. Re-sync
local state before opening the next line. Before stacking new work on an existing
branch, verify it has not been orphaned by an upstream rewrite; reconcile or
rebase deliberately instead of building on an unreconciled divergence.

## Lightweight Integration Paths

Use the direct path by default:

1. Create or reuse the task branch.
2. Implement and validate the scoped work.
3. When integration is requested and repository checks pass, merge the task
   branch directly into the primary branch.

Do not require a `release/*` branch for an individual feature or hotfix that
does not need a separate integration stage.

Use the optional release path only when the user or repository workflow requires
grouped integration testing, a test branch, or a release candidate:

1. Create a short-lived `release/<version-or-scope>` from the intended primary
   baseline.
2. Merge only the selected task branches for that release.
3. Allow stabilization fixes discovered during testing on the release branch,
   but do not add unrelated new features.
4. After required validation passes and integration is authorized, merge the
   release branch into the primary branch.
5. If a source task branch remains active, report whether a release-only fix
   needs to be backported.

## Release And Shared Environment Work

Branch names do not define environments. A `release/*` branch is an optional Git
integration mechanism, not proof that a test environment exists and not
authorization to deploy.

For repositories that release to shared environments, respect the repository's
own release rules.

Do not infer production, staging, Kubernetes, CI/CD, rollback, image, or customer-data procedures from this generic skill. If a project-specific release checklist exists, use it. If none exists, stop and ask for explicit instructions before triggering high-risk release actions.

## PR And Commit Granularity

Before coding a large or multi-goal task, identify cohesive batches and their
acceptance evidence. One PR should advance one independently reviewable,
verifiable objective; state scope, non-goals and dependencies in the existing
Task Envelope or PR description. Keep unrelated refactors out. If batches need
stacked PRs, name their order and base dependencies; each integrated batch must
remain buildable, compatible and safe. Do not split transaction, authorization
or consistency boundaries merely to reduce diff size.

One commit should express one clear intent, including its necessary code and
tests, so it can be understood, diagnosed and safely reverted. Do not mechanically
split by file, or separate a fix from the tests needed to establish its behavior.
Follow repository history rules without automatically rewriting pushed history.

Core supplies these principles. Project-specific size reminders, counting
methods, exceptions and mandatory gates belong to the existing project Profile;
this guidance introduces no new Profile key or required configuration. File and
line counts are reminders, not universal hard limits. Consider handwritten code,
generated output, migrations and tests by their actual review cost. When an
applicable reminder is exceeded, reassess splitting or record why keeping the
change together is safer. Without a numeric reminder, use cohesion, dependencies
and reviewability; do not invent a fixed limit or split to game a count.

| Situation | Decision |
| --- | --- |
| Two independent CLI improvements with separate acceptance tests | Plan separate PRs before coding; keep each improvement and its tests together. |
| A storage change and validation needed to preserve one atomic write boundary | Keep the safety-critical change together and explain the dependency; split only with a demonstrated compatible intermediate state. |
| A cohesive PR is already reviewed and ready to merge | Do not force a history rewrite just to meet a size reminder; record the rationale and use smaller batches for subsequent work. Still fix acceptance-blocking defects. |

Reuse [iteration discipline](iteration-discipline.md) for repeated same-class
failures and [impact review](impact-review.md) for validation selection. Fix
known acceptance-blocking defects together where they share a root cause;
separate deferrable suggestions instead of expanding every review. Reuse still
applicable evidence and avoid requesting the same review again for the same
unchanged commit unless new evidence or an existing gate requires it. This adds
no approval stage, record system or automatic enforcement; existing authorization,
CI, bot review and release gates remain in force.

## Commit Rules

Commit only the intended task changes. Inspect the exact proposed commit diff
against the preflight index and working-tree state, including partially staged
files. Choose an isolation method that preserves unrelated content and index
entries, then verify both after the commit. A path-limited commit can include
unstaged changes in the selected file; it is not a general isolation guarantee.
If safe isolation cannot be established, leave the state intact and report the
specific blocker before committing.

Use concise messages:

- `feat: ...`
- `fix: ...`
- `hotfix: ...`
- `chore: ...`
- `docs: ...`

Avoid one commit that mixes code, unrelated formatting, durable-record archive churn, and deployment source updates unless they are inseparable for the same closeout.

## Merge And Closeout

Do not treat task implementation, validation, or branch creation as implicit
authorization to merge or push. Follow the user's request, repository workflow,
and hosting protections. If the current request already explicitly covers these
operations for the target, reuse that authorization after required checks; do not
ask again merely because work reached the next stage. Follow the Core continuous
progress policy for review, fixes and revalidation.

If unrelated user changes block integration or a branch switch, preserve the
working tree and index and report the blocker. Do not force cleanup to satisfy
a clean-state acceptance condition.

Before merging to the primary branch or saying the primary branch is aligned:

- Compare intended branch commits with the target branch.
- Confirm focused tests or checks.
- Confirm whether the direct task-branch path or optional release path applies.
- Confirm durable records have final evidence and remaining risk.
- Confirm human-facing docs are updated when the iteration changed workflow, usage, release/build behavior, templates, or team rules.
- Check git status after merge.

## Closeout Branch Restore

At the end of a completed iteration, evaluate whether to restore the repository to its actual primary branch.

Restore only when all of these are true:

- The working tree is clean.
- The completed work has been committed and integrated into the primary branch, or the task branch no longer needs to remain active.
- The current branch is not needed for validation, follow-up patches, rollback, customer verification, or release source comparison.
- If a release happened, the deployment succeeded and the live environment or release source of truth is confirmed to match the primary branch.

Do not restore when any of these are true:

- There are uncommitted changes.
- The task branch has unmerged, unpushed, or unverified commits that still matter.
- Production deployment, live-state validation, or primary-branch alignment is still pending.
- The user intends to continue work on the current branch.
- The repository's primary branch is unknown.

When restore is safe, switch to the repository's actual primary branch and report the final branch. For multi-repository work, summarize each repository separately.
