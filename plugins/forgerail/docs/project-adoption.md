# Project adoption lifecycle (0.1.6)

This guide targets 0.1.6. Consult npm and the versioned GitHub Release for publication status. Published 0.1.4 lacks these commands. Existing workspace snapshots require an explicit update; installing the CLI does not migrate them.

ForgeRail manages its own Codex project Skills and a bounded AGENTS block.
The target project needs no package.json, dependency installation or Node project.
The CLI itself requires Node.js 22+. Other hosts retain their existing support
levels. No network access, tool updater, executor or background service is added.

## Operator workflow

Use the CLI from the exact intended package. `init`, `update` and `remove`
produce JSON plans by default and do not modify files:

```sh
forgerail init --workspace /path/to/project
forgerail init --workspace /path/to/project --apply <planSha256>
forgerail doctor --workspace /path/to/project
forgerail update --workspace /path/to/project
forgerail update --workspace /path/to/project --apply <planSha256>
forgerail remove --workspace /path/to/project
forgerail remove --workspace /path/to/project --apply <planSha256>
```

The Agent displays exact changes and applies them within existing user
permission. A digest binds a plan; it is not human approval. The CLI regenerates
the plan from its own package and the current project, rejecting a different
workspace, changed baseline or changed package. It never executes an input plan
file. A repeated matching init is a no-op. A different installed version/content
requires update. Implicit downgrades and ambiguous prerelease ordering fail.

`doctor` is offline and read-only. It reports CLI and installed versions
separately, ready/not-adopted/drift/unavailable/recovery-required, and explicitly
leaves host discovery and behavior unverified. No metadata means not-adopted;
partial, invalid or future metadata is not interpreted as defaults. A directory
alone never proves persisted governance.

## Stored contracts

These version 1.0 contracts use strict runtime validation in
`scripts/lib/project-state.mjs` and `scripts/lib/project-adoption.mjs`:

- `.forgerail/config.json`: exactly schemaVersion and host (`codex`). Project
  choice, not authorization. No personal override, timestamps or tool reminders.
- `.forgerail/installation.json`: exactly schemaVersion, host, source and
  artifacts. Source holds package, version, kind (`package-content`) and SHA-256
  of the bounded producer inventory. This is an observed content identity, not
  registry attestation or verified archive integrity. Artifacts hold path,
  ownership (`file` or `managed-block`) and content SHA-256.
- Project plan: schemaVersion, action, workspaceSha256, source, legacyLock,
  legacySourceSha256, operations, warnings, hostDiscovery, planSha256 and changes. Each operation
  includes path, before/after content and their hashes (null means absent).
  The manifest operation is last. Whole-file baselines protect concurrent edits
  even when only a block is owned.
- The versioned delivery descriptor is `adapters/project/codex.json`. It owns
  the supported Skill names, project destinations, binding marker and activation
  boundary. The v1 Host Adapter and Adoption Plan schemas stay unchanged.

All inserted bytes are inside the managed markers: init adds no unowned leading
or trailing separator. Removal preserves user bytes exactly, including a missing
final newline, BOM and CRLF. Whitespace left by older development candidates is
not retroactively deleted because its ownership cannot be proved.

The managed block owns only its marker-delimited content; edits outside it are
preserved and do not imply long-term drift. Unknown same-name Skills cannot be
taken over. Drift blocks mutations, including removal. Remove retains user
content, unrelated files and empty directories, and does not uninstall the CLI.
An AGENTS file created by init is retained as an empty file after removal because
ownership covers the block, not the whole file. Existing v1 boundary comments
require reconciliation before init; mentioning the marker in ordinary prose does
not. Conversely, v1 planning and writing refuse a project already owned by the
lifecycle, including one with unhealthy metadata.

## Interruption and recovery

A project-wide cooperating lock (`.forgerail-operation.lock`) serializes lifecycle
writers. Before any managed mutation, `.forgerail-operation.json` stores the
exact operation and recovery baselines, plus version 1.1 progress receipts. A
receipt records whether a write is in flight or completed and the identity of
the file actually installed (device, inode, size and modification/change times).
Completed writes are rolled back only while that identity and content still
match. Matching bytes alone never establish ownership. Files created or edited
at operations that never started are preserved and listed in the rollback result.
These are temporary recovery materials,
not team policy, permanent history or an authorization source. Do not commit
these files (project-local ignore entries may name `/.forgerail-operation.lock`
and `/.forgerail-operation.json`); inspect and resolve interrupted operations before committing.
The installation manifest is written only after verifying the preceding targets.
These protections do not provide atomic transactions against arbitrary editors.

```sh
forgerail recover --workspace /path/to/project
forgerail recover --workspace /path/to/project --apply <recovery-planSha256>
```

Recovery previews a rollback and binds current content and file identities. An
external edit to a completed target blocks rollback and is preserved. An
unstarted operation is never rolled back; its current content is retained. The user/Agent must inspect that
specific conflict; do not force-reset the workspace. Retrying an interrupted
rollback re-observes its targets. Config and manifest are restored last. A write whose completion receipt was not
durably saved requires ownership reconciliation if the target changed. This
includes a process killed after the write but before its receipt. Do not infer
ownership from matching bytes in that window. Old development journals without
receipts refuse automatic rollback; do not rewrite their schema to bypass this.

The serialized recovery journal is limited to 4 MiB, including reserved capacity
for all completion receipts. Planning and apply reject oversized operations before
any project artifact is changed. The artifact-count limit is not a promise that
every combination of files fits the aggregate recovery budget.

If the process terminated without releasing the project lock, doctor shows its
`lockDigest`. After verifying the recorded PID is no longer running, release the
exact lock with `recover --release-lock <lockDigest> --workspace <path>`, then
preview recovery. A live or inaccessible PID retains the lock; PID reuse fails
conservatively. Lock release alone does not recover changes.

A process killed *inside* the underlying single-file writer can leave a file
lock, `.tmp`, `.bak`, `.source` or `.removed` evidence. Automated rollback refuses
while that evidence is present. Inspect the named files and their identities,
preserve any user edits, and reconcile that individual write before retrying.
Never delete all `.forgerail-*` files or infer that a dead process makes every
backup disposable. Successful command-boundary rollback is automated; arbitrary
mid-system-call crash recovery may require operator reconciliation.

## Legacy snapshots

`init --legacy-lock docs/governance/example.lock.json --workspace <path>` accepts
only the explicit legacy source-lock shape: package, version, archiveSha256,
archiveIntegrity, source and files. Every declared artifact must match both the
project bytes and the verified package content used for migration; the version
must match the source lock. Use `--legacy-source <installed-or-extracted-old-package>`
when the executing CLI is newer: it reads that package without executing it,
preserves its installed Skill version, and binds the source location and content
to the migration plan. Run update separately after migration if authorized.
Without that flag, the executing package must itself match the legacy lock. The historical archive fields are retained as prior claims, not reverified
registry evidence. This command does not download old or future packages.

The plan replaces the old lock with a historical pointer and its prior digest,
while making installation.json the only active installation identity. The
operation journal preserves the old text for rollback. Retain a reviewed Git
baseline if the full legacy lock must remain recoverable after completion.
Custom AGENTS prose is preserved and displayed for review; an old v1 managed
binding requires explicit reconciliation before lifecycle init. Migration cannot
silently remove bespoke instructions or combine a format migration with upgrade.

## Verification boundary

Run the installed test suite and a disposable init/update/remove cycle. In a
fresh host session or equivalent supported discovery probe, verify each Skill's
project path, source and enabled state. This demonstrates discovery, not model
obedience. The old `adoption-plan` command remains read-only and its public v1
writer still accepts only create/append-managed-block/replace-managed-block.

A drifted but valid installation remains lightweight adoption; drift is an unhealthy state, not loss of ownership. Pending operation locks/journals block legacy binding writes. Recovery evidence next to installed artifacts is checked even when the CLI version differs. If CLI source files are unavailable, doctor retains project observations and recovery digests alongside the source error.

Pending recovery does not erase installation ownership: a valid config and installation manifest retain lightweight adoption, while health remains recovery-required. Interrupted initial adoption without a complete valid installation does not claim adopted status.

Unreadable recovery locks or journals retain independently verified installation ownership and block writes. Project lifecycle directory checks are bounded to 10,000 entries per directory; exceeding the bound reports an observation error instead of scanning without a limit.

Plans support at most 520 operations, including metadata writes. Preview and apply use the same validation; an update that combines too many old and new artifact paths is rejected during preview even if each installation fits the 512-artifact manifest limit.

Each write is checked immediately; completed writes are rechecked against their recorded file identities at metadata commit and journal-cleanup boundaries, rather than rescanning every prior target after every write; identical bytes do not permit an external replacement. Without installation metadata, doctor still checks root and metadata-directory recovery evidence and reports recovery-required without claiming adoption.

Rollback also retains the identities returned by writes in the current recovery attempt and checks them before restoring metadata and removing the journal. Recovery evidence in metadata directories is checked for both adopted and unadopted projects. A 520-operation update is exercised to completion by the lifecycle regression suite; duration depends on the filesystem and file sizes.

If a started operation's target already contains its prior non-null content when recovery is previewed, automatic rollback requires ownership reconciliation. Identical bytes cannot distinguish an external restoration from an interrupted rollback; version 1.1 journals do not retain rollback receipts across attempts. The journal and current files are preserved. An absent prior baseline claims no file and remains safe to skip. A lifecycle binding left in AGENTS.md without installation metadata is also reported as recovery-required, without claiming adoption or inventing a recovery journal; reconcile the retained binding and metadata before retrying adoption.
