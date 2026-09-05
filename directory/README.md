# Universal Plugin Directory candidate

This directory contains a local, Skills-only submission candidate. It is not evidence that ForgeRail is listed, under review, or approved in the Universal Plugins Directory.

The Agent Plugin is the product entry. Its Core Skills do not require Node.js, `package.json`, `node_modules`, or `.forgerail/` state in a user project. The separately published npm CLI remains optional validation and lifecycle tooling.

The candidate follows the OpenAI submission guidance observed on 2026-08-30:

- <https://developers.openai.com/plugins/build/plugins>
- <https://developers.openai.com/plugins/deploy/submission>

The alpha.4 forward-fix candidate records the user-confirmed `Productivity` category, GitHub Issues support, repository Privacy and Terms URLs, and an intent to make ForgeRail available in all platform-supported regions. It also keeps the main Plugin within Codex's maximum of three starter prompts while preserving four independently owned Skills. The live portal's exact region enumeration remains `pending_confirmation`; no country list is invented locally.

Before any Platform draft or submission, a human must still verify the publisher identity, Apps Management Write permission, live portal region encoding, accepted asset format, and exact final public source. `submission-candidate.json` records every unresolved item; `evaluations.json` contains the local positive and negative evaluation cases. Remote Git integration cannot grant Directory submission or publication authority.

Local validation:

```bash
npm run test:directory
npm run build:directory-candidate
```

Neither command accesses the network or submits anything.
