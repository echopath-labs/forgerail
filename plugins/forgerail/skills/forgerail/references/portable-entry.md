# Portable Entry And Recovery

Use this guide on a new machine, standalone clone, external worktree, or when a
required policy or Plugin cannot be discovered.

1. Identify the actual owner repository and entry location. Inspect its versioned
   instructions, adoption contract or binding, and declared required dependencies.
   Do not assume the original parent AGENTS.md, nested Skills, or another machine's
   installed Plugin will be loaded here.
2. Verify the host actually discovers the required entry and the intended Plugin
   source/version. Installation, file presence, and successful discovery are
   separate observations; none proves behavior or authorizes project adoption.
3. If a required dependency is missing, report its exact identity, available
   provenance, affected work and the recovery entry. Mark it unavailable, not
   empty or satisfied. Pause only the governed execution that depends on it;
   continue independent read-only investigation within the user's scope.
4. Prepare the smallest recovery using a verified source and the owner's existing
   contract. Show exact installation or binding changes and rollback before
   requesting any missing authorization. Reuse current authorization when it
   covers that action and target. Never silently fall back to AGW, copy obsolete
   parent policy into a second authority, or install all optional Packs.
5. After authorized recovery, verify discovery in the actual entry location and
   a new task or supported host check. Report remaining gaps and rollback status.
   A proposed rollback is not an executed or verified rollback.

A missing Plugin cannot instruct its own recovery. For durable adoption, keep the
required Plugin identity and missing-dependency behavior in the versioned owner
contract or host binding. Read [adoption guidance](adoption.md) when preparing
those changes; do not write a new contract merely to perform this check.
