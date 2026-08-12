---
name: forgerail-github-rulesets
description: Use when assessing, designing, reviewing, or preparing changes to GitHub repository Rulesets, required checks, enforcement modes, bypass actors, or related branch policy. Defaults to read-only diagnosis and requires a separate exact approval before any remote mutation.
---

# ForgeRail GitHub Rulesets

Default to read-only diagnosis.

## Applicability

Use only when the owner repository is hosted on GitHub and the task concerns Rulesets or equivalent repository policy. Installation alone does not activate this pack or grant GitHub identity.

## Workflow

1. Resolve the exact repository, default branch, candidate branch/commit, authenticated identity, and current permissions.
2. Read current Rulesets, branch protection, required checks, workflow identities, enforcement, bypass actors, and repository default behavior using an authorized GitHub surface.
3. Separate observed facts from recommended policy. Do not assume every repository needs the same rules.
4. If mutation is desired, prepare an approval package containing exact repo, current state, desired state, affected refs, check names and app identities, permitted operations, prohibited operations, validation, rollback, and receipt fields.
5. Stop until the user explicitly approves that exact mutation scope.
6. After authorized execution by the host Agent, verify the returned GitHub receipt and re-read effective rules.

## Independent Gates

Ruleset mutation approval does not authorize merge, release, default-branch change, repository lifecycle, or other products. Never delete or weaken a rule as an implicit fix.

Read `references/approval-package.md` before proposing a remote change.
