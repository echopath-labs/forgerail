# Control Authority And Validation Contracts

ForgeRail adds eight versioned Control System contracts without changing the alpha contracts, the task-control contracts, or any Host Adapter profile.

| Contract | Schema version | File |
| --- | --- | --- |
| Review Authority Requirement | 1.0 | `contracts/review-authority-requirement-v1.schema.json` |
| Authority Evidence | 1.0 | `contracts/authority-evidence-v1.schema.json` |
| Validation Topology | 1.0 | `contracts/validation-topology-v1.schema.json` |
| Validation Result | 1.0 | `contracts/validation-result-v1.schema.json` |
| Execution Context Identity | 1.0 | `contracts/execution-context-identity-v1.schema.json` |
| Host Adapter Observation | 1.0 | `contracts/host-adapter-observation-v1.schema.json` |
| Provider Adapter Observation | 1.0 | `contracts/provider-adapter-observation-v1.schema.json` |
| Limited Reason | 1.0 | `contracts/limited-reason-v1.schema.json` |

The contracts enforce these initial boundaries:

- Review Authority is independent from Operation Authority and Operation Grants. Requirements bind authority class, exact subject and scope, accepted evidence, quorum, actor exclusions, owner coverage, freshness, default non-substitution, and bounded waiver policy.
- Authority Evidence references an Evidence Identity and distinguishes `current`, `stale`, `revoked`, `dismissed`, `expired`, and `superseded`. Invalidated evidence cannot remain current.
- Validation Topology links changed surfaces, owners, consumers, selected requirements, governance dependency edges, accepted trust classes, expected results, entrypoints, and evidence locators.
- Validation Result preserves the seven result states: `passed`, `failed`, `blocked`, `unavailable`, `not_applicable`, `not_selected`, and `waived`. A passed result requires evidence; a waiver binds current authority, exact requirement, subject, scope, and expiry.
- Execution Context Identity records the authoritative entrypoint, invocation root, executor or runner, trust class, tools, providers, and sanitized external dependencies. Consuming an external dependency does not make it a governance source.
- Host and Provider Adapter observations report capability-specific state. Installation, authentication, activation, or mutation capability does not mint authority, and observations always set `authorizationClaim` to `false`.
- Limited Reason uses a bounded code set, a capped sanitized summary, evidence pointers, and sanitized locators. It is used by the new contracts without modifying the already-versioned Profile or Task contracts.

These are schema and deterministic validation contracts only. Authority, topology, execution-context, and adapter evaluators remain later tasks. The version-compatible Pack composition schema is defined in [Cross-Workspace Pack Composition Contract](cross-workspace-pack-composition-contract.md); the pre-evaluator invalid boundary set is recorded in the [Control System Fixture Matrix](control-system-fixture-matrix.md). Canonical serialization, digest calculation, and version negotiation remain task 2.10.

Run the focused checks with:

```bash
node scripts/forgerail.mjs validate
node scripts/forgerail.mjs validate-fixtures
node scripts/forgerail.mjs validate-contract --type review-authority-requirement --file scripts/fixtures/contracts/review-authority-requirement.valid.json
node scripts/forgerail.mjs validate-contract --type validation-result --file scripts/fixtures/contracts/validation-result.valid.json
node scripts/forgerail.mjs validate-contract --type provider-adapter-observation --file scripts/fixtures/contracts/provider-adapter-observation.valid.json
```
