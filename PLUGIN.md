# ForgeRail Agent Plugin

This source exposes four separately addressable Skills:

- `forgerail` is the small task-governance Core.
- `forgerail-workspace-diagnosis` is a read-only, existing-habits-first diagnosis entry.
- `workspace-health-review` is the first built-in Capability Pack and keeps its established identity.
- `architecture-convergence-audit` is an independently invoked, medium-risk, read-only Pack for capability-owner duplication and minimal retained boundaries.

Version 0.1.0 includes optional [engineering paradigm guidance](skills/architecture-convergence-audit/references/engineering-paradigm.md) to that audit for planning, refactor assessment and bounded drift review against accepted project choices.

Availability is not activation. Installing this Plugin does not make every Skill or pack mandatory in every workspace.

Project adoption is also separate from installation. ForgeRail defaults to Plugin Only, can propose a confirmed lightweight Host Binding, and defers persisted `.forgerail/` governance. See `docs/adoption.md` or `docs/adoption.zh-CN.md`.
