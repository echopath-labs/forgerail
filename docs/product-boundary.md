# ForgeRail product boundary

ForgeRail helps a host Agent scope engineering work, respect project rules and approval boundaries, and report verifiable results. The host and responsible people perform the work and decide acceptance. ForgeRail supplies guidance and deterministic checks; installing it does not create execution authority.

| Surface | Current responsibility | Boundary |
| --- | --- | --- |
| Core and CLI | Profile/Envelope composition, contract and receipt checks, bounded local Git observation | `launch` produces a contract; it does not launch an Agent |
| Project Profile and provider observation | Project-owned source/claim composition plus operation-scoped GitHub, SSH and npm identity preflight | Read-only sanitized evidence only; no credential store, authorization grant, mutation probe or executor |
| Diagnosis and Health | Read-only observations and recommendations | No automatic repair, monitoring daemon or project memory |
| Architecture Convergence | Optional ownership, engineering paradigm and drift assessment | Project-accepted rules; no mandatory layout or dependency-boundary engine |
| Adoption and host profiles | Plan bindings, explicitly approved managed-file writes and verification | Released 0.1.10 acceptance remains historical; this exact Core passed separate bounded review on 2026-10-26, combining Agent reports with independent file/Git/test checks without a complete transcript. The Rule fallback remains profile-only. This does not restore a Cursor executor or certify Cloud Agent |
| Optional delegation guidance | Evaluate enabled preference, task fit, total cost, handoff and Host acceptance | Core guidance; RelayPact is optional and owns execution. No new Skill, CLI, configuration, schema, state or scheduler |
| Cross-workspace Pack | Dependency waves, writer conflicts, handoff and receipt review | Host or RelayPact owns task dispatch, process lifecycle, wait, cancel and resume |
| Rulesets, Release Safety and Thread Closure Packs | Guidance, approval/evidence requirements and local fixture validation | Host uses project tools for authorized side effects; no embedded remote executor |
| Versioned control contracts | Published schemas and field/fixture validation | Schema validation is not a live authority, topology, revision or provider evaluator |

The broader Control System architecture is deferred design. ForgeRail does not maintain a persistent control ledger, enforce every project action, or evaluate all external approvals. Project Profile's small reviewed provider registry performs only explicit identity preflight; it is not a general provider runtime. Existing public schemas remain for compatibility. Extending them into a wider runtime requires a separately scoped product decision, real consumer need and evidence; old unchecked plans are not the default backlog.

Project specifications and rules retain their existing owners. OpenSpec owns change records, OpenDomain owns domain semantics, EchoPath owns optional continuity, and RelayPact or the host owns delegation and execution. These products are optional. Referencing their results does not transfer their authority or require their installation.

## Cursor experiment retirement

The experimental Cursor local executor shipped through 0.1.2 has been removed: its direct CLI/module paths, dedicated schemas and fake-executor tests are no longer provided. Published releases and history remain unchanged. Direct users of those experimental paths must use a separately supported host/delegation facility; there is no automatic migration or added RelayPact dependency. Cursor IDE Agent instruction discovery and bounded behavior passed with the released 0.1.10 Core through the shared `AGENTS.md` route. Its historical evidence is retained. This Core was separately accepted on 2026-10-26 from Agent reports and independent current evidence; the full read sequence is not independently audited. See [host support](adoption.md#host-support). The Cursor Rule fallback remains profile-only and the executor is not restored.

## Keeping the boundary visible

`package.json.files` lists script modules explicitly. `npm test` checks that source/installed scripts match that surface; the release and disposable-consumer checks also examine the actual npm file inventory. Fixture directories contain data only. Experiments must stay outside published inputs until their owner and user workflow are reviewed.

A change to an allowed module can still introduce the wrong behavior. The PR review must explain the capability owner, actual consumer, side effects or persistent state, and why an existing host or product does not already own the work. These checks constrain publication scope; they are not a semantic or security sandbox.
