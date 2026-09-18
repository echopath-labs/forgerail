# Git Lifecycle Guide

Use this reference when creating branches, committing, merging, pushing, aligning primary branches, or closing out an iteration.

## Contents

- [Preflight](#preflight)
- [Primary Branch Naming](#primary-branch-naming)
- [Resolve Branch Rules](#resolve-branch-rules)
- [Branch Ownership And Creation](#branch-ownership-and-creation)
- [Lightweight Integration Paths](#lightweight-integration-paths)
- [Release And Shared Environment Work](#release-and-shared-environment-work)
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
these defaults.

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

When the Agent is on a clean primary branch, an explicit implementation request
authorizes creating the repository-appropriate task branch before editing if
task type, scope, ownership, and repository rules are unambiguous. Under the
portable defaults:

- Create `feat/<short-scope>` for a new capability or iteration.
- Create `hotfix/<short-scope>` for a defect whose relevant baseline is the
  primary branch.
- Use the applicable maintenance or documentation prefix for other work.

Do not automatically create or switch branches when the worktree is dirty, the
current branch has unrelated work, branch ownership or scope is ambiguous, the
primary branch is unknown, the branch is tied to a different release, or a
nearer rule requires confirmation. Preserve that state. Reuse the current branch
when it is suitable for the authorized scope; ask for a branch decision only if ownership or isolation remains
materially ambiguous. Do not require confirmation merely because unrelated dirty
files exist when they can safely remain untouched.

Branch creation authorization does not authorize merge, push, branch deletion,
release, or deployment.

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
