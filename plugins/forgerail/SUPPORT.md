# ForgeRail Support

ForgeRail is alpha software maintained as an open-source project. Support is best effort; no response-time or resolution-time service level is promised.

## Start here

1. Read the [README](README.md) and [installation guide](docs/installation.md).
2. Confirm you installed the exact public tag `v0.1.0-alpha.4`.
3. Start a new Codex task and verify the four ForgeRail Skills.
4. Reproduce the problem with Plugin Only and a read-only request when possible.
5. Remove secrets, private paths, project memory, customer data, and production configuration before sharing evidence.

## Where to ask

- **Reproducible bug:** use the Bug report issue form.
- **Feature or product proposal:** use the Feature request form and explain the user problem before the proposed mechanism.
- **Documentation problem:** use the Documentation issue form.
- **Security vulnerability:** do not open a normal issue; follow [SECURITY.md](SECURITY.md).
- **Conduct concern:** follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

The issue tracker is not a place to request access to private repositories, share API keys, ask maintainers to operate production systems, or bypass a human approval boundary.

## Include useful evidence

Share the ForgeRail version, Codex/host version, operating system, installation route, exact Skill invoked, expected result, observed result, and the smallest sanitized reproduction. State whether the workspace changed and whether any remote action occurred.

Screenshots and receipts must be redacted. Prefer copied error text over an image when it does not expose private data.

## Current support boundary

- Codex is the verified host for `0.1.0-alpha.4`.
- Claude Code and Cursor are `profile-only`; end-to-end support is not claimed.
- Plugin Only and reviewed Lightweight Adoption are usable; persisted `.forgerail/` governance is deferred.
- Capability Packs are independent Plugins and keep their own identity, permissions, and approval requirements.
- Universal Plugins Directory publication is not currently available; exact-tag Marketplace installation is the supported route.

If your case falls outside this boundary, an issue can still be useful as product evidence, but it may not receive an immediate fix.
