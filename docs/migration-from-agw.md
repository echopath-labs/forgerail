# Migration From Agent Workflow Governance

ForgeRail does not rename AGW in place.

1. Freeze the exact AGW/WHR source, installation, behavior, docs, and rollback baseline.
2. Map every in-scope behavior to ForgeRail Core, a Capability Pack, Profile, source reference, Task Envelope, or unresolved status.
3. Run representative tasks in shadow without changing activation.
4. Canary ForgeRail with one explicit core owner and immediate AGW rollback.
5. Publish versioned upgrade, coexistence, rollback, and uninstall guidance.
6. Decide AGW repository and entrypoint lifecycle only through a separate approval.

Current rollback baseline is the existing Agent Workflow Governance Plugin at its validated `0.2.0` candidate source. Exact public release identity must be reverified before a ForgeRail release approval package is issued.
