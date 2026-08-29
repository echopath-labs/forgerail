# Cross-Workspace Pack Composition Contract

ForgeRail defines one versioned `cross-workspace-pack-composition-v1` contract for an optional Cross-Workspace Orchestration Pack. The Pack composes independent Core-governed workspaces; it does not introduce a second state model, authority system, grant mechanism, or receipt-verification path.

The contract binds these composition surfaces:

- `coreCompatibility` declares the supported Workspace Identity, Task Envelope, Return Receipt, and Phase/Slice Correlation schema versions, plus the Evidence Identities that support the compatibility claim.
- `workspaceSet` identifies at least two independent owner workspaces, the optional coordinator workspace, the aggregate writer, and the governing relationships.
- every node keeps one owner Workspace Identity, one writer identity, one `task-envelope-v2` reference, one `phase-slice-correlation-v1` reference, and at most one `return-receipt-v2` reference;
- dependency edges remain directional and may unlock only from a Core-verified Receipt that the coordinator independently accepts;
- phase aggregation partitions every required node into accepted, pending, failed, blocked, or stale state; aggregate closure is permitted only when all required nodes are accepted;
- the immutable Workspace Receipt Bundle binds the composition, Workspace Set, phases, accepted Core Receipts, dependency status, unresolved nodes, deviations, and next eligible nodes.

## Kernel Boundaries

The Pack cannot redefine Core or weaken Kernel invariants. Its invariant flags are fixed to `false`: no state-model redefinition, Operation Grant minting, authority substitution, waiver or freshness broadening, receipt-verification bypass, or treating transport as acceptance.

Receipt delivery, Core verification, and coordinator acceptance remain independent claims. A delivered Receipt is not necessarily verified or accepted. A node cannot become accepted, unlock a required successor, or enter an accepted bundle until its Core Receipt is verified and coordinator acceptance carries Evidence Identity references.

Writer identity is explicit. Concurrent nodes cannot share a writer unless a dependency edge orders them. Dependency edges never transfer authority, Operation Grants, or Receipts between workspaces.

This contract defines only the schema, deterministic hand-validation, schema-native assertions, and focused fixtures. The pre-evaluator authority-collapse and other invalid boundaries are recorded in the [Control System Fixture Matrix](control-system-fixture-matrix.md); canonical serialization, digest computation, and version negotiation remain task 2.10. No Pack runtime, evaluator, adapter expansion, or alpha contract migration is implemented here.

Run the focused checks with:

```bash
node scripts/forgerail.mjs validate
node scripts/forgerail.mjs validate-fixtures
node scripts/forgerail.mjs validate-contract --type cross-workspace-pack-composition --file scripts/fixtures/contracts/cross-workspace-pack-composition.valid.json
node scripts/forgerail.mjs validate-contract --type cross-workspace-pack-composition --file scripts/fixtures/contracts/cross-workspace-pack-composition.false-closure.invalid.json
```
