# Engineering mode and branch checks

This source capability adds bounded effort guidance and local branch observations.
It does not upgrade an installed ForgeRail package or change a consumer project.
Use commands from a build containing this capability; release and adoption remain
separate operations. [中文](engineering-mode.zh-CN.md).

## Select effort

| Mode | Default investment |
| --- | --- |
| `fast` | Relevant build/run, key smoke, direct regression checks and a brief host impact judgment |
| `balanced` (default) | Fast baseline, relevant regression/impact checks and one scoped review, which the host may perform |
| `strict` | Checks for the affected high-risk system and critical dependencies, with applicable security, release and recovery requirements |

Every mode preserves existing mandatory bot review, CI, data protection and
operation authorization. A required review that covers the same objective need
not be duplicated. Strengthen a concrete risky path rather than making an entire
task strict because it mentions permissions, deletion or release. Stop adding
checks when agreed behavior, applicable checks and gates are satisfied with no
known blocker; continue already-authorized delivery. Failed or missing required
evidence remains a blocker for its affected action. Report non-mandatory gaps,
implementation, deployment readiness, deployment and business acceptance honestly.

A user can explicitly select effort for one task, including fast over a strict
default. The host records the instruction and scope without editing project
configuration. This cannot override higher-priority restrictions, mandatory
gates or concrete risk requirements. There is no CLI task-override authorization
flag; an output field cannot prove the user's intent.

## Use the existing Profile

`engineering.mode` is an optional known rule key whose normalized value is exactly
`fast`, `balanced` or `strict`. `git.branch.naming` is another optional key:

```json
{
  "prefixes": {
    "feature": ["feat/"],
    "fix": ["hotfix/", "fix/"],
    "maintenance": ["chore/"],
    "documentation": ["docs/"]
  }
}
```

These values belong in a project's chosen authoritative source, referenced by
existing claims with source digest, pointer and operation scope. They are value
examples, not complete declarations. Prefix arrays are literal prefixes; no regex
or shell execution is involved. Use structured JSON Pointer sources for
machine-confirmed values; a Markdown-heading claim remains unresolved for these
two keys because locating a heading does not confirm its normalized value.
The [Project Profile contract](project-profile-contract.md) covers identity,
complete declaration shape, preview/apply and inspection. No mode file, local
configuration override, required Profile adoption or new task ledger is added.

No applicable mode claim defaults to balanced without a write. No naming claim
keeps portable branch defaults labeled as defaults. Explicit invalid values are
errors; missing, stale or conflicting declared sources stay unresolved. Inspect
the actual declaration with existing identity evidence:

```sh
forgerail project-profile-inspect --workspace /path/to/project \
  --workspace-identity /path/to/observed-owner-workspace-identity.json \
  --operation git.branch.create --target repository:owner/name
```

Use the operation ID actually covered by the claim; the example uses
`git.branch.create`. Without an operation, scoped claims are not interpreted as
an accepted mode. Existing applicable provider bindings may perform their normal
read-only identity observations during Profile inspection.

The inspection's `engineeringMode` explanation preserves configuration status
separately from task effort policy. The host handles task instructions and
traceable historical strict requirements. If only mode is unconfirmed, other
related required rules remain valid and no stronger requirement is known, the
host may state “mode unresolved; temporarily using balanced effort” and continue
authorized implementation. This does not resolve the configuration or refresh
its hash. Preserve applicable last-confirmed strict strengthening even after
source drift. Unconfirmed new text is not accepted authority. Pause actions that
depend on failed authorization, branch or data rules; continue independent work.
Do not decide from the whole Profile status alone or ignore claim dependencies.
Source repair uses the existing lifecycle against its reviewed baseline.

## Branch checks

`branch-check` is read-only and local. It checks a candidate before the host's
Git operation and observes the actual result afterward. It never creates,
switches, renames or deletes branches, contacts a remote, or grants authorization.

```sh
forgerail branch-check --workspace /path/to/project --phase before \
  --task-type feature --branch feat/example --intent create --checkout true \
  > /tmp/example-branch-before.json
# The host performs the authorized Git operation, then reads its actual result.
forgerail branch-check --workspace /path/to/project --phase after \
  --task-type feature --branch feat/example --intent create --checkout true \
  --before /tmp/example-branch-before.json
```

Use a task-specific temporary before file outside the repository and keep the
original output. `after` requires that before file and identical intent arguments.
Task types are `feature`, `fix`, `maintenance`, `documentation`; intent is `create`
or `reuse`. For creation without checkout, use `--checkout false`: check the ref,
without requiring HEAD to move. A suitable existing branch may be reused even if
it follows a historical name; newly wrong creation cannot be called old reuse.

For an adopted Profile, provide the same independently observed owner identity
used by inspection and the applicable `--operation`/`--target` pair. Both are
required so the command can evaluate the action’s dependencies. Required applicable provider dependencies remain
unverified in this local-only command; the host must resolve that dependency
before the affected action. It does not initiate provider calls.
A before observation carries refs/HEAD and policy revision, not ownership or
non-push proof. Policy change, wrong owner/worktree, failed/truncated observation,
missing before state or concurrency ambiguity cannot establish success. Invoke
at the first related operation and when owner, policy or intent changes, not every
turn. Direct Git commands can bypass the check; it observes one moment.

If the host creates `codex/x` while `feat/x` was intended, it can correct only under
already-confirmed current-task correction authority and all conditions in the
[Git lifecycle guide](../skills/forgerail/references/git-lifecycle.md#check-actual-branch-results):
this task's newly created branch, known unpushed status, clear ownership, no
others' added commits or task dependencies, no other worktree, explicit absent
target, and unchanged commits/worktree/staging through rename. No upstream is not
proof of no push. Unknown evidence stops correction; the CLI never makes it safe
by assertion. Preserve state, pause affected operations and report the concrete
plan. After allowed correction, recheck and report it; do not retry rename loops.

## Select checks and reuse evidence

Choose deterministic CI/test/contract checks separately from semantic review by
actual impact. Ordinary notes or formatting do not need unrelated full tests or
an extra code bot review; API, migration and release guidance need checks against
real behavior. AGENTS.md, SKILL.md, rule templates and executable Markdown need
checks for their behavior changes. A binary document's unreadable diff is not
proof of low risk. Existing mandatory checks and bot gates always remain.

Reuse successful results when tested code/artifacts, relevant dependencies,
configuration, inputs and environment still apply. Same SHA alone is insufficient;
a different SHA after unrelated documentation may preserve relevant evidence.
Recheck affected tests after fixes; do not add JSON receipts per command or a new
log parser. For a changed digest-bound Profile source, inspect it, compare with
the reviewed baseline and use authorized preview/apply when needed; never blindly
refresh a digest. [Impact review](../skills/forgerail/references/impact-review.md)
and [Core mode guidance](../skills/forgerail/references/engineering-mode.md)
describe the host's decisions and reporting limits.

Branch checks currently require an existing HEAD commit. Newly initialized repositories and orphan branches before their first commit return an unverified result; the host must handle those workflows explicitly. This is a verification limit, not a prohibition on Git operations.
