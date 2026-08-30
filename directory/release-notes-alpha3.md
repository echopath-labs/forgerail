# ForgeRail 0.1.0-alpha.3 release notes candidate

ForgeRail alpha.3 is a narrow host-compatibility forward fix. The main Agent Plugin now exposes three reviewed starter prompts, which stays within the Codex host limit, while all four Skills remain independently discoverable and directly invokable.

The third prompt is an either-or router: it directs a workspace-health request to `$workspace-health-review` or a duplicated-architecture-ownership request to `$architecture-convergence-audit`. It does not merge those Skills, make either depend on the other, or activate both implicitly.

The candidate retains the alpha.2 Skills-only Directory shape, public Privacy and Terms, GitHub Issues support, Productivity category, all-platform-supported-regions intent, optional scoped npm CLI, no project Node.js requirement, and no implicit `.forgerail/` state. Directory submission, release, and lifecycle approvals remain separate and are not granted by this candidate.
