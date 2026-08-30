# Control Task Contracts

ForgeRail keeps the alpha Task Envelope and Return Receipt intact while adding versioned Control System task contracts in the same package.

| Contract | Schema version | File |
| --- | --- | --- |
| Task Envelope | 2.0 | `contracts/task-envelope-v2.schema.json` |
| Operation Authority Requirement | 1.0 | `contracts/operation-authority-requirement-v1.schema.json` |
| Operation Grant | 1.0 | `contracts/operation-grant-v1.schema.json` |
| Task Control Revision | 1.0 | `contracts/task-control-revision-v1.schema.json` |
| Entry Mode | 1.0 | `contracts/entry-mode-v1.schema.json` |
| Phase/Slice Correlation | 1.0 | `contracts/phase-slice-correlation-v1.schema.json` |
| Gate Result | 1.0 | `contracts/gate-result-v1.schema.json` |
| Evidence Identity | 1.0 | `contracts/evidence-identity-v1.schema.json` |
| Return Receipt | 2.0 | `contracts/return-receipt-v2.schema.json` |
| Rollback Envelope Lineage | 1.0 | `contracts/rollback-envelope-lineage-v1.schema.json` |

These contracts establish the task-control identity boundary without implementing the evaluator:

- every Envelope, revision, gate, evidence item, and Receipt binds one exact Workspace Identity and subject;
- `new`, `resumed`, and `imported` entry modes remain explicit, and resumed/imported work requires source evidence;
- Core closure stays on one exact owner phase/slice and never claims aggregate closure;
- an Operation Grant binds one executor, operation, exact target/ref/environment, subject, scope, authority requirement, issuer evidence, and validity window;
- review or validation evidence does not mint an Operation Grant;
- task-control revisions and Receipts are immutable identity-bearing claims; changed subjects or evidence require successors;
- a Host receipt is not complete until receipt verification is satisfied and unresolved deviations are absent;
- rollback uses a new Envelope revision, rollback-specific grants, validation, and Receipt; forward grants cannot be reused.

The alpha `task-envelope-v1` and `return-receipt-v1` schemas and their runtime paths are unchanged. Review-authority lifecycle, validation topology/result, Execution Context, adapter observations, and bounded limited reasons are defined in [Control Authority And Validation Contracts](control-authority-validation-contracts.md). The Workspace Receipt Bundle is defined by the [Cross-Workspace Pack Composition Contract](cross-workspace-pack-composition-contract.md), and its pre-evaluator invalid boundaries are included in the [Control System Fixture Matrix](control-system-fixture-matrix.md). Canonical serialization, digest calculation, and version negotiation remain later work.

Run the focused checks with:

```bash
node scripts/forgerail.mjs validate
node scripts/forgerail.mjs validate-fixtures
node scripts/forgerail.mjs validate-contract --type task-envelope-v2 --file scripts/fixtures/contracts/task-envelope-v2.valid.json
node scripts/forgerail.mjs validate-contract --type operation-grant --file scripts/fixtures/contracts/operation-grant.valid.json
node scripts/forgerail.mjs validate-contract --type return-receipt-v2 --file scripts/fixtures/contracts/return-receipt-v2.valid.json
```
