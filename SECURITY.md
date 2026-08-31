# Security Policy

ForgeRail guides Agents around project context, scope, authority, evidence, and validation. It does not provide a security guarantee, replace code review, or authorize external effects.

## Supported versions

| Version | Security support |
| --- | --- |
| `0.1.0-alpha.3` | Current public prerelease; fixes move forward |
| Earlier alpha releases | Upgrade to the current prerelease before reporting unless the issue is version-specific |

Published npm versions and Git tags are immutable. Security fixes are released as a new version; maintainers do not overwrite packages or move published tags.

## Report a vulnerability privately

Use GitHub's private vulnerability reporting surface:

https://github.com/echopath-labs/forgerail/security/advisories/new

Include only what is needed to reproduce and assess the issue:

- affected version, host, and Skill or Capability Pack;
- expected versus observed behavior;
- minimal reproduction with secrets and private data removed;
- security impact and preconditions;
- whether the issue has been disclosed elsewhere.

If private vulnerability reporting is unavailable, open a minimal public issue asking the maintainers to establish a private channel. Do **not** include exploit details, credentials, tokens, customer data, private repository content, production configuration, or unredacted receipts in that issue.

## Scope

Security reports may include:

- unintended writes or remote effects during documented read-only use;
- scope escape, path traversal, unsafe projection, or inclusion of denied/private files;
- credential exposure or cross-identity confusion;
- approval, authority, validation, or rollback boundaries that fail open;
- malicious or unsafe Plugin/Skill/Pack packaging behavior;
- dependency or release-integrity problems in the official scoped package.

General product limitations, governance disagreements, support questions, and findings that require an already-compromised host without increasing impact may be routed to normal issues.

## Security boundaries for users

- Workspace diagnosis is read-only by default and should not inspect secrets, broad private archives, or unrelated repositories.
- Installation never grants login, repository administration, publishing, deployment, or lifecycle authority.
- Capability Packs with remote access must declare identity, permissions, approval, validation, rollback, and cleanup boundaries.
- Use exact tags and the scoped `@echopath-labs/forgerail` package; the unscoped package is only a reservation.
- Review Agent output and project diffs. ForgeRail guidance is not a substitute for least privilege, secure configuration, CI, or human review.

Maintainers will acknowledge a usable private report when possible, coordinate validation and remediation, and credit reporters who want attribution. Timelines depend on severity, reproducibility, and release risk; no service-level agreement is promised.
