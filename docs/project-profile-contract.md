# Project Profile declaration contract

The Project Profile declaration is an optional ForgeRail 0.1.8 capability for a project-owned, runtime-discoverable description of authoritative sources, structured claims, and safe resource locators. Version 0.1.8 includes its bounded lifecycle, inspection path, and read-only provider observations. The released ForgeRail 0.1.7 package does not contain these commands.

## Fixed entry and ownership

An adopted declaration has one active location:

```text
.forgerail/project-profile.json
```

The file is workspace-owned state. It is not a package installation artifact and does not belong in `.forgerail/installation.json`. Package initialization, update, and removal do not create, replace, inventory, or delete it. Profile set and remove reuse ForgeRail's existing bounded operation lock, journal, writer, and recovery engine.

Candidate content lives in the project's ordinary review workflow. Runtime discovery sees only the fixed entry. Superseded revisions remain in Git, pull-request, or specification history; ForgeRail does not scan an archive directory.

## Declaration shape

`project-profile-declaration-v1.schema.json` requires:

- `schemaVersion`, `profileId`, and the owner `workspaceIdentityId`;
- explicitly referenced `workspaceRelationshipIds`;
- bounded `sources` with stable identity, kind, project-relative locator, requiredness, and optional SHA-256;
- explicit `claims` that point to a source location and name applicable operation IDs;
- optional `resourceBindings` that connect an adapter-supported operation and expected identity claims to one reviewed provider adapter and one locator.

Each claim and binding contains at most 64 operation IDs. Every expected identity claim must apply to every operation named by the binding; an existing but out-of-scope claim is not valid evidence for that binding.

The declaration cannot set precedence, enforcement, completeness, authorization, or a computed Profile result. Those remain owned by Governance Source, Rule Claim, Effective Profile v2, Profile Explanation, and the existing task-authorization contracts.

`sourceKind` classifies a source; it does not confer authority. In particular, a project-owned declaration cannot turn a project-relative file into enforced platform policy merely by labeling it `platform-policy`.

## Bounded loading and assembly

The loader receives an exact owner workspace and an independently supplied Workspace Identity. The public inspection CLI requires this as `--workspace-identity`; its canonical root locator must be absolute and resolve to the exact owner, and its identity must match the declaration. The declaration cannot manufacture this evidence for itself. The loader reads only the fixed entry with regular-file, no-follow, UTF-8, and four-megabyte bounds, and never searches a parent, child, or sibling workspace. An absent entry returns `not-adopted` and leaves the existing alpha resolver and task behavior unchanged.

Every declared source is read through the same project-relative boundary. Markdown claims require one exact heading line; structured claims use RFC 6901 JSON Pointer and must equal the declared normalized value. A whole-source SHA-256 mismatch, missing digest, missing or ambiguous heading, invalid JSON Pointer, path escape, symlink, special file, or oversized source prevents confirmation. Required failures make the v2 Profile unresolved; optional source, pointer, or value failures degrade it without activating their claims.

The loader projects confirmed inputs into the existing Workspace Identity, Governance Source, Rule Claim, Effective Profile v2, and Profile Explanation contracts. Equal-precedence claims for the same rule and operation become an explicit unresolved conflict. `profileRevisionId` is deterministic over normalized declaration content, observed Workspace Identity semantics, confirmed source digests, and resolver version; timestamps, declaration ordering, provider observations, and credential values do not affect it.

## Locator kinds

| Kind | Meaning | Boundary |
| --- | --- | --- |
| `workspace-file` | A canonical relative file under the owner workspace | No absolute path, traversal, symlink following, device file, or unbounded read |
| `related-workspace-file` | A canonical relative file under one explicitly related workspace | Names a Workspace Relationship, related Workspace Identity, and root environment variable; never searches parents or siblings |
| `environment-variable` | A reviewed environment-variable name | The declaration stores the name, never its value |
| `provider-native` | A provider account store or session selected by a reviewed adapter | Coordinates are non-secret metadata such as a host, host alias, or registry |

Moving a related workspace changes the environment-provided root binding. A missing, stale, or identity-mismatched root is unresolved; ForgeRail does not infer a replacement absolute path.

## Credential boundary

Declarations, revisions, contracts, command arguments, logs, errors, and evidence digests must not contain tokens, cookies, passwords, private keys, or other credential values. Commands and remote credential-retrieval instructions are not locators.

The declaration loader and Profile resolver do not read credential bytes. A selected, reviewed provider adapter may consume credential material only for an explicit read-only preflight. If a provider client requires a temporary file, the adapter must create it with mode `0600`, omit the value from arguments and output, and remove it on success, error, and interruption paths.

Authentication evidence remains separate from task authorization. A matching GitHub, SSH, or npm actor never grants push, merge, publish, release, or another external effect.

## Lifecycle and inspection

Keep a reviewed candidate at an ordinary project-relative path other than the fixed entry. Preview and apply use the same candidate bytes, exact workspace identity, current fixed-entry baseline, and plan digest:

```bash
forgerail project-profile-set --workspace /path/to/project --candidate docs/governance/project-profile.json
forgerail project-profile-set --workspace /path/to/project --candidate docs/governance/project-profile.json --apply <planSha256>
forgerail project-profile-remove --workspace /path/to/project
forgerail project-profile-remove --workspace /path/to/project --apply <planSha256>
```

Removal leaves candidate, Git, pull-request, and specification history untouched and never activates another file. Interrupted writes use the same `recover` flow as package adoption.

The preview reports `profilePreflightBindingIds`. When a candidate adds or changes any resource binding, apply requires independent owner Workspace Identity evidence plus one or more matching `--operation`/`--target` pairs. ForgeRail runs only the affected adapters under the existing operation lock before creating a journal or changing the active declaration. A binding must reference 1–16 string-valued identity claims that agree on one actor. Reordering declaration keys or identity-keyed collections alone does not require fresh preflight. Every changed binding must authenticate its expected actor; otherwise apply fails and preserves the previous active declaration. Relationship and related-identity evidence use the same repeatable options as inspection.

```bash
forgerail project-profile-set --workspace /path/to/project \
  --candidate docs/governance/project-profile.json --apply <planSha256> \
  --workspace-identity /path/to/observed-owner-workspace-identity.json \
  --operation pull-request.create --target repository:owner/name#123
```

Inspection is read-only. Without `--operation`, it performs no provider calls. `--operation` and `--target` must be provided together. With an operation, only applicable bindings are considered; unrelated bindings remain `not-applicable` and do not block local Profile assembly. The top-level operation result is `ready`, `degraded`, `blocked`, or `unresolved`, while `profileStatus` preserves the separate local Profile assembly result. None of these states grants the requested operation.

```bash
forgerail project-profile-inspect --workspace /path/to/project --workspace-identity /path/to/observed-owner-workspace-identity.json
forgerail project-profile-inspect --workspace /path/to/project --workspace-identity /path/to/observed-owner-workspace-identity.json --operation git.push --target repository:owner/name
forgerail project-profile-inspect --workspace /path/to/project \
  --workspace-identity /path/to/observed-owner-workspace-identity.json \
  --operation package.publish --target package:@scope/name \
  --workspace-relationship /path/to/workspace-relationship.json \
  --related-workspace-identity /path/to/related-workspace-identity.json
```

Related-workspace evidence options are repeatable. Each relationship and identity document is validated before a credential file is read; the relationship must be confirmed, name the declared owner and target identities, and be declared by a Profile source. Missing or invalid evidence leaves the binding unresolved without a provider call.

The reviewed registry supports GitHub CLI API identity, Git SSH identity through an explicit host alias, and npm identity. A binding operation must appear in its selected adapter's allow-list. API and SSH observations stay independent. npm uses a process-local `0600` configuration when locator credentials are needed, isolates explicit credentials from ambient npm authentication, and registers process-signal cleanup in addition to setup, success, error, and thrown-interruption cleanup. Exact target permission remains `unverified` unless read-only evidence proves it; a required binding with unverified permission is `unresolved`, not `ready`. Provider observations are sanitized, bound to the exact workspace and Execution Context Identity, and always set `authorizationClaim` to false.

## Contract validation

Validate a declaration without discovering a workspace or contacting a provider:

```bash
node scripts/forgerail.mjs validate-contract \
  --type project-profile-declaration \
  --file path/to/project-profile.json
```

This validation checks schema identity, bounded fields, collection identities, source and claim references, stable operation IDs, locator and adapter compatibility, secret-like material, and executable content. The loader and assembler are in `scripts/lib/project-profile.mjs`; provider observation is in `scripts/lib/provider-adapters.mjs`.

Activation preflight also covers changes to referenced expected identity claims, their declared sources and workspace ownership. Every supplied applicable observation must match; one successful observation cannot hide a failed observation for the same binding. Unrelated claims do not trigger revalidation.

Relationship inventories are limited to 128 IDs. Inspection and activation preflight reject credential-like operation and target selectors before deriving context IDs. Provider evidence IDs include the exact operation, target and execution context. A claim is wholly shadowed only when higher-precedence claims cover all its operations; partial coverage preserves its remaining scopes.

Project Profile source loading has a 16 MiB aggregate byte budget in addition to the 4 MiB per-file bound. Source IDs are read in deterministic order; inputs outside the budget remain unconfirmed. Native provider coordinates are exact: `host` for GitHub API, `hostAlias` for Git SSH, and `registry` for npm. Independently supplied workspace/relationship/execution-context evidence is also screened for credential material before use or output.

Profile canonicalization and aggregate-budget ordering use locale-independent string order. A related-workspace credential root must resolve to a different canonical directory from the owner workspace; a second identity label does not create a separate filesystem boundary.

Computed Profile claims narrow partially shadowed operations to their remaining effective scopes; the loader's observed `ruleClaims` retain the original scopes. Required unavailable dependency edges make affected claims unresolved, and edge/claim inventories must agree. Revision hashing uses the verified real owner path. Adding an unrelated relationship ID does not invalidate unchanged resource-binding preflight. Explicit CLI identity/relationship evidence is limited to 256 KiB per file and 16 MiB total per invocation before parsing.

Npm identity observation requires an HTTPS registry URL without userinfo, query or fragment; unsupported URLs are rejected before invoking npm. Credential screening includes percent-encoded query names.
