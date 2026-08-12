# Release Approval Package

Record at least:

- exact owner workspace, public repository, branch, source commit, candidate commit/tree, version and immutable artifact digests;
- project-owned runbook path and the exact sections governing validation, publication, promotion and rollback;
- current registry, tag, release, deployment and shared-environment state;
- authenticated identity and credential availability without exposing secrets;
- allowed operations and explicitly prohibited operations;
- independent gates for release, production change, rollback and lifecycle mutation;
- preflight validation, CI, postflight checks, rollback boundary and Return Receipt fields;
- stop conditions for identity, source, artifact, check, base, target or runbook drift.

An approval package is a proposal, not authorization. Record who approved the exact scope and when before the host Agent mutates any external system.
