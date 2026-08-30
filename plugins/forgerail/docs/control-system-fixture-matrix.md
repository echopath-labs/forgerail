# Control System Fixture Matrix

ForgeRail's pre-evaluator fixture gate covers every registered contract schema with at least one schema-valid and one schema-invalid focused fixture. The deterministic `validate-fixture-matrix` command checks all 35 registered contract types, verifies every referenced fixture through its existing dependency-free contract validator, and requires the ten task 2.9 invalid boundaries exactly once.

The required invalid boundaries are:

- missing Workspace Identity;
- stale Profile Change Candidate base digest;
- forged Operation Grant digest;
- ineligible Operation Grant issuer;
- duplicate actor used for a distinct-actor quorum;
- revoked approval evidence;
- validation evidence from the wrong trust class;
- dangling governance dependency;
- Return Receipt bound to a changed subject;
- cross-workspace authority, Operation Grant, or Receipt collapse.

## Validation Layers

`schema` cases contain at least one structurally invalid contract and are rejected by the current hand-validator. `cross-contract` cases intentionally keep every component schema-valid and declare the observations that a later evaluator must compare. The fixture checker validates coverage, references, component schema validity, expected rejection labels, and the explicit `evaluatorImplemented: false` boundary; it does not make transition, quorum, issuer, trust, freshness, subject, or dependency decisions.

The alpha Profile Change Candidate does not contain a base-digest field, and canonical Grant digest computation is not defined yet. Their task 2.9 cases therefore preserve mismatching comparison inputs in fixture metadata without modifying the existing contract or implementing task 2.10 serialization/digest rules. The future Profile Change Candidate successor and evaluators must consume these fixtures when their separately gated tasks begin.

Run the focused and full checks with:

```bash
node scripts/forgerail.mjs validate-fixture-matrix
node scripts/forgerail.mjs validate-fixtures
npm test
```
