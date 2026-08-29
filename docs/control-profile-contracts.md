# Control Profile Contracts

ForgeRail keeps the alpha contracts intact while introducing the first versioned Control System contracts inside the same package.

| Contract | Schema version | File |
| --- | --- | --- |
| Workspace Identity | 1.0 | `contracts/workspace-identity-v1.schema.json` |
| Workspace Relationship | 1.0 | `contracts/workspace-relationship-v1.schema.json` |
| Governance Source | 1.0 | `contracts/governance-source-v1.schema.json` |
| Source Dependency Edge | 1.0 | `contracts/source-dependency-edge-v1.schema.json` |
| Rule Claim | 1.0 | `contracts/rule-claim-v1.schema.json` |
| Effective Profile | 2.0 | `contracts/effective-profile-v2.schema.json` |
| Profile Explanation | 1.0 | `contracts/profile-explanation-v1.schema.json` |

`effective-profile-v2` is intentionally separate from the frozen alpha `effective-profile-v1` contract. It binds claims and dependency edges to one exact Workspace Identity and makes `complete`, `degraded`, and `unresolved` explicit without changing the alpha resolver or user entry.

The contracts enforce these initial invariants:

- filesystem nesting does not transfer authority;
- only confirmed or provider-declared relationships may apply scoped governance;
- inferred claims cannot be enforceable;
- unavailable, ambiguous, or unverified sources and dependencies carry a limited reason;
- a required unavailable dependency, unresolved claim, or conflict cannot appear in a complete Profile;
- Profile Explanation contains identities, dispositions, reason codes, confirmation needs, and limited reasons rather than private rule bodies.

Task Envelope, Operation Grant, Control Revision, Evidence Identity, Return Receipt, and rollback lineage are defined in [Control Task Contracts](control-task-contracts.md). Review Authority lifecycle, Validation Topology, Execution Context, and Adapter observations are defined in [Control Authority And Validation Contracts](control-authority-validation-contracts.md). Pack bundles remain later work.

Run the focused catalog and fixture checks with:

```bash
node scripts/forgerail.mjs validate
node scripts/forgerail.mjs validate-fixtures
node scripts/forgerail.mjs validate-contract --type workspace-identity --file scripts/fixtures/contracts/workspace-identity.valid.json
node scripts/forgerail.mjs validate-contract --type effective-profile-v2 --file scripts/fixtures/contracts/effective-profile-v2.valid.json
```
