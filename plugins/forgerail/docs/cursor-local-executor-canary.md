# Cursor Local Executor Canary

This experimental harness validates whether a local Cursor CLI can act as a bounded Executor while Codex remains the Host and ForgeRail independently verifies the result. It is a disposable validation surface, not a production delegation runtime, and it does not change the global Cursor Host Adapter from `profile-only`.

## Prerequisites And Cost Boundary

Install Cursor CLI only from Cursor's official distribution and inspect the installer before execution. Installation, shell integration, account login, API-key creation, and on-demand billing remain user-controlled actions. ForgeRail never performs them automatically.

Check the local prerequisite without starting an Agent request:

```bash
node scripts/cursor-local-executor.mjs discover
cursor-agent status
```

Real canaries consume Cursor Agent usage from the authenticated account. Check the Cursor usage dashboard and spending controls before enabling on-demand usage. The harness never enables paid overage.

## Deterministic Self-Test

The self-test uses a fake Cursor executable and temporary Git repositories. It does not call Cursor services:

```bash
npm run test:cursor-adapter
```

It covers unavailable and unauthenticated states, structured success, malformed or missing terminal output, non-zero exit, timeout, cancellation, out-of-scope mutation, bounded write, resume, and durable-report sanitization.

## Real Disposable Canary

Run read-only validation first:

```bash
node scripts/cursor-local-executor.mjs canary --mode read-only
```

Verify one initial read-only session and one resume against the same disposable workspace:

```bash
node scripts/cursor-local-executor.mjs canary --mode read-only --verify-resume
```

Only after read-only verification and explicit authorization for this exact disposable task, run:

```bash
node scripts/cursor-local-executor.mjs canary --mode bounded-write --authorize-mutation
```

The harness materializes a repository-owned fixture under the operating system temporary directory and explicitly trusts only that generated fixture so headless execution does not pause at Cursor's workspace-trust gate. Read-only mode combines Cursor `plan` mode, Cursor sandbox, deny rules, and an unchanged-Git-tree check; omitting `--force` alone is not treated as a read-only guarantee because current headless print mode can access write and shell tools. Bounded-write mode also enables the sandbox, permits only `src/value.txt`, denies known shell and sensitive-file operations, and independently checks changed paths, file digests, and a validation command. Neither mode targets the canonical checkout.

`--verify-resume` keeps the generated repository alive only long enough to invoke a second structured call with the captured session identity and exact same workspace. It does not imply live-message support.

The Cursor CLI can still be more capable than the contract. Availability does not create authorization. Any unexpected path, missing terminal event, timeout, non-zero exit, malformed event, or failed independent validation prevents a verified verdict.

## Evidence And Privacy

Raw prompts, stream events, temporary absolute paths, environment values, credentials, and unbounded stderr remain disposable. A durable capability report contains only exact CLI version, per-capability state, observation time, sanitized locators or digests, Git/validation results, deviations, and a promotion recommendation.

Agent self-report and transport delivery are evidence inputs, not ForgeRail acceptance. The current Cursor profile remains `profile-only` until the required canaries pass and the ForgeRail Control System Host Adapter owner accepts the evidence against canonical serialization, authorization, execution-context, and receipt contracts.

## Product Boundary And Rollback

ForgeRail owns control inputs, authorization evaluation, and receipt verification. The thin Host bridge owns only local subprocess invocation, waiting, cancellation, structured-output capture, and resume calls. If a general execution lifecycle is needed, RelayPact should own that lifecycle and reference ForgeRail decisions rather than moving orchestration into ForgeRail.

Rollback removes the experimental harness, fixtures, and unaccepted reports while leaving `adapters/cursor.json` and project records unchanged. Temporary canary repositories are disposable. Removing Cursor CLI itself is a separate user-controlled action and must resolve the exact installed version directory and symlinks before deletion.
