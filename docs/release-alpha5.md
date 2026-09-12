# ForgeRail 0.1.0-alpha.5 replacement guidance candidate

This is the local candidate for `@echopath-labs/forgerail@0.1.0-alpha.5` and tag `v0.1.0-alpha.5`, not a publication receipt. Existing public installation instructions remain pinned to alpha.4 until publication is verified.

## Scope and evidence

The main Plugin now contains the baseline AGW/WHR guidance for Git lifecycle, staged-work protection, workspace ownership, durable records, impact review, staged progress, handoff, health review and portable recovery. The npm CLI requires Node.js 22+ on the tool host; target projects need no added `package.json`, `node_modules` or implicit `.forgerail/` state. Optional machine-readable exchanges retain the actual ForgeRail Skill identity.

Two user-operated agents each exercised 24 synthetic steps using explicitly loaded candidate sources. Their outputs were checked against file and Git state, and the changed implementation samples passed independent test reruns. This supports the source-loaded behavior, not automatic Plugin activation, fully isolated sessions or compatibility with an unnamed legacy consumer. Model output still requires validation against its intended contract. External Capability Pack Plugins remain at alpha.4 with unchanged behavior.

This release route uses npm installation and explicit loading of the packaged Skills. Codex Marketplace registration and native Plugin activation are deferred. There is no standalone binary bundling Node.js in this release. Codex remains a supported source-loading host. Cursor and WorkBuddy results do not promote their native installation or binding support. Existing projects retain their current governance until their target-host loading and project-specific rules are checked. If a project consumes legacy structured output, verify that real consumer during its adoption; a YAML parser is not a replacement consumer. Use human-readable closeout by default.

## Bounded release gate

1. Freeze the candidate, release notes and known limitations; resolve confirmed release-blocking defects. Documentation-only report corrections do not require repeating every behavior trial.
2. Install the final npm archive in a disposable tools prefix, run its CLI validation and read-only diagnosis, verify all four packaged Skill entries and their references against the reviewed source, and uninstall. Reuse the existing explicit-source Agent evidence for unchanged guidance. Native Plugin discovery/activation is outside this npm release gate.
3. Run the existing main/maintainer checks and Node.js 22 and 24 coverage, inspect the publication allowlist, and record exact artifacts and digests. Reuse behavior evidence only for unchanged guidance and implementation. Final public CI and remote identity are checked against the final target, not a historical approval.

No new feature or full cross-host certification is added to this release gate. Universal Directory submission, all-project adoption and AGW retirement are outside it.

## Candidate integration and publication

The public candidate is an ordinary child of the observed remote `main`. Resolve the current base before creating the public projection; do not reuse a historical base SHA. The proposed branch is `codex/forgerail-alpha5-agw-replacement`. The Draft PR base and publication comparison baseline remain bound to the observed remote `main`. Every correction is an ordinary source-first successor commit. No force-push or rewrite of an existing release is permitted.

`remote_integration_approval` is required for the exact public projection and Draft PR. `release_approval` is separately required for merge, annotated tag, scoped npm `next` publication and GitHub prerelease. The merged public `main` tree must equal the final signed projection tree. Verify GitHub and npm identity as the authorized publisher immediately before those actions. Do not unpublish or move an immutable tag/version; ship a successor for a published defect. The unscoped `forgerail` reservation is not a product installation source.

Install and discover each external Capability Pack separately when it is used; the main Plugin does not require these optional Plugins for the old baseline safety guidance. Project binding edits require the exact approved adoption scope, preserve existing rules and return a Host Binding Receipt. Do not infer project migration from publication. AGW retirement requires `lifecycle_change_approval`; Directory submission also has its own authorization.
