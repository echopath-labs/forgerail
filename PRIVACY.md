# ForgeRail Privacy Notice

Applies to ForgeRail 0.1.14

ForgeRail is a Skills-only Agent Plugin with a separately invoked CLI. Skills do not collect telemetry. After explicit opt-in, the CLI sends the command name, package version and exit result to the ForgeRail HTTPS collector hosted by Vercel. The collector forwards those fields to PostHog US Cloud with a random ID per event. Telemetry is off by default. The PostHog token stays on the server. Vercel can observe the source IP at the connection layer. The collector does not forward the client IP or request headers to PostHog. See [telemetry controls, fields and network/IP limits](docs/telemetry.md). No user content, persistent identity or Person Profile is collected.

ForgeRail Skills run through the host Agent or platform selected by the user. That host may process prompts, workspace files, command output, and other context under the host provider's own privacy terms and settings. Installing ForgeRail does not change those terms or data controls.

The optional main-package Project Profile CLI can perform explicitly requested read-only identity preflight through the installed `gh` CLI (GitHub API), Git SSH, and npm CLI (registry). These provider requests use local protected credential facilities and are governed by the provider's privacy terms. Identity observations do not authorize push, merge, publication or any other mutation. They are not telemetry sent to EchoPath Labs.

For npm preflight, credential material is read in-process into an owner-readable temporary configuration (POSIX `0600`); it is not written into project records or returned in observation output. The configuration is cleaned on normal completion and handled SIGINT, SIGTERM and SIGHUP. A hard kill or machine failure can bypass cleanup; inspect any retained temporary credential configuration using protected local procedures.

Optional external Capability Packs are separately installed and explicitly invoked. A Pack that connects to GitHub, a registry, or another provider is subject to that provider's privacy terms, credentials, permissions, and the Pack's disclosed behavior. Installing the main ForgeRail Plugin does not install, authenticate, enable, or authorize those external connections.

ForgeRail defaults to read-only observation where documented. It does not create `.forgerail/` state, edit project instructions, or transmit workspace material merely because the Plugin is installed. Any host-executed file change or external action remains subject to the user's explicit task scope and approval boundary.

For product support or privacy questions, use [ForgeRail GitHub Issues](https://github.com/echopath-labs/forgerail/issues). Do not include secrets, access tokens, private source code, personal data, or confidential logs in a public issue.

This notice describes ForgeRail-owned behavior. It does not replace the privacy terms of OpenAI, another host Agent, GitHub, npm, or any service the user chooses to connect.
