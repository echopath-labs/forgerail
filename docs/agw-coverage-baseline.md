# AGW To ForgeRail Coverage Baseline

This is the initial deterministic owner map. Behavioral equivalence still requires shadow tasks.

| AGW/WHR behavior | ForgeRail owner | State |
| --- | --- | --- |
| smallest owner workspace | Core | mapped |
| preserve user changes and inspect Git state | Core | mapped |
| durable record decision using existing systems | Workspace Diagnosis + Profile | mapped |
| Git branch lifecycle | Profile/source reference | mapped; detailed baseline remains in AGW during compatibility |
| validation and impact evidence | Core + Task Envelope | mapped |
| independent approval gates | Core + Task Envelope | mapped |
| risk and context guardrails | Core + applicable pack | mapped |
| machine-readable closeout | Return Receipt | mapped |
| optional EchoPath integration | optional ecosystem contract | mapped conceptually; runtime integration pending |
| Workspace Health Review | built-in `workspace-health-review` pack | mapped; full historical signal parity pending |
| release and shared-environment safety | external `forgerail-release-safety` Plugin | mapped; project runbook and separate approval remain required |
| thread closure governance | external `forgerail-thread-closure` Plugin | mapped; durable write and lifecycle gates remain independent |
| GitHub Rulesets governance | external `forgerail-github-rulesets` Plugin | mapped; remote execution remains separately approved host-Agent work |

The local behavior map is complete, but migration is not ready merely because the map is complete. Remote integration/CI, a usable prerelease, canary evidence, and a separate AGW lifecycle approval remain independent gates.
