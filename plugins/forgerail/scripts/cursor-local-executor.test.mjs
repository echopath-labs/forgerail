import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  createCapabilityReport,
  discoverCursorCli,
  materializeCursorCanary,
  runCursorCanary,
  validateCanaryContract,
  validateCapabilityReport,
} from "./lib/cursor-local-executor.mjs";

const pluginRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const canonicalRoot = resolve(pluginRoot, "../..");
const fakeCursor = resolve(pluginRoot, "scripts/fixtures/cursor-local-executor/fake-cursor-agent.mjs");

function fakeDiscovery(scenario = "success-read-only") {
  return discoverCursorCli({
    candidates: [fakeCursor],
    env: { FORGERAIL_CURSOR_FAKE_SCENARIO: scenario },
  });
}

async function withCanary(options, callback) {
  const canary = materializeCursorCanary({ canonicalRoot, ...options });
  try {
    return await callback(canary);
  } finally {
    canary.cleanup();
  }
}

test("discovery reports an absent CLI without side effects", () => {
  const missing = resolve("/private/tmp/forgerail-cursor-cli-that-does-not-exist");
  const discovery = discoverCursorCli({ candidates: [missing] });
  assert.equal(discovery.status, "unavailable");
  assert.equal(discovery.executable, null);
  assert.equal(discovery.cli.authentication, "unavailable");
  assert.equal(discovery.capabilities.launch_read_only.status, "unavailable");
  assert.equal(existsSync(missing), false);
  const report = createCapabilityReport({ discovery });
  assert.deepEqual(validateCapabilityReport(report), []);
});

test("discovery distinguishes installed but unauthenticated Cursor", () => {
  const discovery = fakeDiscovery("unauthenticated");
  assert.equal(discovery.status, "blocked");
  assert.equal(discovery.cli.authentication, "unauthenticated");
  assert.equal(discovery.capabilities.discover.status, "verified");
  assert.notEqual(discovery.capabilities.resume.status, "verified");
});

test("read-only canary verifies stream evidence and preserves the Git tree", async () => {
  await withCanary({ mode: "read-only" }, async (canary) => {
    const result = await runCursorCanary({
      contract: canary.contract,
      executable: fakeCursor,
      env: { FORGERAIL_CURSOR_FAKE_SCENARIO: "success-read-only" },
    });
    assert.equal(result.status, "verified");
    assert.equal(result.capabilities.launch_read_only.status, "verified");
    assert.equal(result.capabilities.launch_bounded_write.status, "profile-only");
    assert.equal(result.capabilities.resume.status, "unknown");
    assert.ok(result.execution.args.includes("plan"));
    assert.ok(result.execution.args.includes("enabled"));
    assert.deepEqual(result.evidence.changedPaths, []);
    assert.equal(result.evidence.gitBefore.tree, result.evidence.gitAfter.tree);
    assert.equal(readFileSync(resolve(canary.workspace, "src/value.txt"), "utf8"), "original\n");
  });
});

test("bounded-write requires exact mutation authorization", async () => {
  await withCanary({ mode: "bounded-write", mutationAuthorized: true }, async (canary) => {
    const unauthorized = structuredClone(canary.contract);
    unauthorized.mutationAuthorized = false;
    assert.ok(validateCanaryContract(unauthorized).includes("bounded-write requires mutationAuthorized=true"));
    const result = await runCursorCanary({ contract: unauthorized, executable: fakeCursor });
    assert.equal(result.status, "blocked");
  });
});

test("bounded-write canary accepts only the declared file after independent validation", async () => {
  await withCanary({ mode: "bounded-write", mutationAuthorized: true }, async (canary) => {
    const result = await runCursorCanary({
      contract: canary.contract,
      executable: fakeCursor,
      env: { FORGERAIL_CURSOR_FAKE_SCENARIO: "success-write" },
    });
    assert.equal(result.status, "verified");
    assert.equal(result.capabilities.launch_bounded_write.status, "verified");
    assert.ok(result.execution.args.includes("--force"));
    assert.ok(result.execution.args.includes("--trust"));
    assert.ok(result.execution.args.includes("--sandbox"));
    assert.deepEqual(result.evidence.changedPaths, ["src/value.txt"]);
    assert.ok(result.evidence.validations.every(({ status }) => status === "passed"));
  });
});

test("out-of-scope mutation fails even when the Agent emits structured success", async () => {
  await withCanary({ mode: "read-only" }, async (canary) => {
    const result = await runCursorCanary({
      contract: canary.contract,
      executable: fakeCursor,
      env: { FORGERAIL_CURSOR_FAKE_SCENARIO: "out-of-scope" },
    });
    assert.equal(result.status, "degraded");
    assert.ok(result.deviations.some((item) => item.includes("out-of-allowlist")));
    assert.deepEqual(result.evidence.changedPaths, ["outside.txt"]);
  });
});

for (const [scenario, expectedDeviation] of [
  ["malformed", "not valid JSON"],
  ["missing-terminal", "terminal result event is missing"],
  ["nonzero", "process exit code was 7"],
]) {
  test(`${scenario} structured execution fails closed`, async () => {
    await withCanary({ mode: "read-only" }, async (canary) => {
      const result = await runCursorCanary({
        contract: canary.contract,
        executable: fakeCursor,
        env: { FORGERAIL_CURSOR_FAKE_SCENARIO: scenario },
      });
      assert.notEqual(result.status, "verified");
      assert.ok(result.deviations.some((item) => item.includes(expectedDeviation)));
    });
  });
}

test("timeout terminates the child and cannot become success", async () => {
  await withCanary({ mode: "read-only", timeoutMs: 1_000 }, async (canary) => {
    const result = await runCursorCanary({
      contract: canary.contract,
      executable: fakeCursor,
      env: { FORGERAIL_CURSOR_FAKE_SCENARIO: "timeout" },
    });
    assert.equal(result.status, "failed");
    assert.equal(result.execution.timedOut, true);
    assert.ok(result.deviations.includes("execution timed out"));
  });
});

test("AbortSignal cancellation is classified independently", async () => {
  await withCanary({ mode: "read-only", timeoutMs: 5_000 }, async (canary) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 50);
    const result = await runCursorCanary({
      contract: canary.contract,
      executable: fakeCursor,
      env: { FORGERAIL_CURSOR_FAKE_SCENARIO: "timeout" },
      signal: controller.signal,
    });
    assert.equal(result.status, "failed");
    assert.equal(result.execution.cancelled, true);
    assert.equal(result.capabilities.cancel.status, "verified");
  });
});

test("canonical checkout and ancestor targets are rejected before launch", async () => {
  await withCanary({ mode: "bounded-write", mutationAuthorized: true }, async (canary) => {
    const unsafe = structuredClone(canary.contract);
    unsafe.workspace.disposableRoot = unsafe.workspace.canonicalRoot;
    unsafe.workspace.cwd = unsafe.workspace.canonicalRoot;
    const errors = validateCanaryContract(unsafe);
    assert.ok(errors.includes("workspace.disposableRoot must be outside workspace.canonicalRoot"));
    assert.ok(errors.includes("bounded-write cwd must not resolve inside the canonical workspace"));
    const result = await runCursorCanary({ contract: unsafe, executable: fakeCursor });
    assert.equal(result.status, "blocked");
  });
});

test("resume is verified only by an explicit same-workspace resume run", async () => {
  await withCanary({ mode: "read-only" }, async (canary) => {
    const initial = await runCursorCanary({
      contract: canary.contract,
      executable: fakeCursor,
      env: { FORGERAIL_CURSOR_FAKE_SCENARIO: "success-read-only" },
    });
    assert.equal(initial.capabilities.resume.status, "unknown");
    const resumeContract = structuredClone(canary.contract);
    resumeContract.canaryId = "cursor-local-resume";
    resumeContract.mode = "resume";
    resumeContract.prompt = "Restate the current disposable boundary without modifying files.";
    const resumed = await runCursorCanary({
      contract: resumeContract,
      executable: fakeCursor,
      resumeSessionId: initial.execution.sessionId,
      env: {
        FORGERAIL_CURSOR_FAKE_SCENARIO: "success-read-only",
        FORGERAIL_CURSOR_FAKE_SESSION_ID: initial.execution.sessionId,
      },
    });
    assert.equal(resumed.status, "verified");
    assert.equal(resumed.capabilities.resume.status, "verified");
    assert.equal(resumed.capabilities.live_message.status, "unknown");
  });
});

test("durable report sanitizes local paths and validates its complete shape", async () => {
  await withCanary({ mode: "read-only" }, async (canary) => {
    const discovery = fakeDiscovery();
    const result = await runCursorCanary({
      contract: canary.contract,
      executable: fakeCursor,
      env: { FORGERAIL_CURSOR_FAKE_SCENARIO: "success-read-only" },
    });
    const report = createCapabilityReport({
      discovery,
      canary: result,
      roots: { disposableRoot: canary.temporaryRoot, canonicalRoot },
    });
    assert.deepEqual(validateCapabilityReport(report), []);
    const serialized = JSON.stringify(report);
    assert.equal(serialized.includes(canary.temporaryRoot), false);
    assert.equal(serialized.includes(canonicalRoot), false);
    assert.equal(serialized.includes("<disposable-root>"), true);
    assert.equal(Object.hasOwn(report.execution, "prompt"), false);
  });
});
