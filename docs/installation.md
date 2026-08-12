# Installation And Adoption

ForgeRail is primarily an Agent Plugin. The npm package is an optional deterministic CLI and compatibility payload.

## Install

The public Marketplace command will be finalized only after a signed public candidate exists. A releasable candidate must support exact-version Plugin installation and a new Codex task must discover:

- `$forgerail`;
- `$forgerail-workspace-diagnosis`;
- `$workspace-health-review`.

For local canonical testing, build a disposable bundle or npm tarball; do not point production workspaces at an uncommitted source tree.

## Adoption

Installation makes capabilities available. It does not edit a project's `AGENTS.md`, create `.forgerail/`, install OpenSpec, or make Workspace Health mandatory. Project adoption is a separate, explicit decision.

## Upgrade And Reinstall

Upgrade from one exact ForgeRail version to another. Restart Codex and repeat discovery plus a bounded diagnosis smoke. Reinstall must preserve project files and Profile sources.

## Rollback And Uninstall

Rollback to the last validated ForgeRail version or the frozen AGW version. Remove the ForgeRail Plugin and optional CLI without deleting project records, Agent instructions, or Git history. AGW remains the compatibility rollback until the migration gate is separately approved.

## Release Boundary

Publishing npm, moving `latest`, pushing a public candidate, tagging, creating a GitHub Release, or changing AGW lifecycle requires separate approval and exact release receipts.
