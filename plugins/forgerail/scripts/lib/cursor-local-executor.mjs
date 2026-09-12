import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const defaultCursorFixtureRoot = resolve(moduleRoot, "scripts/fixtures/cursor-local-executor/repository");
export const cursorCapabilityNames = [
  "discover",
  "launch_read_only",
  "launch_bounded_write",
  "stream_events",
  "terminal_result",
  "wait",
  "cancel",
  "resume",
  "live_message",
  "instruction_discovery",
];

const reportStates = new Set(["verified", "degraded", "blocked", "unavailable", "failed"]);
const capabilityStates = new Set([
  "verified",
  "supported",
  "profile-only",
  "degraded",
  "blocked",
  "unavailable",
  "unknown",
  "unsupported",
]);
const prohibitedOperations = [
  "credential-read",
  "workspace-external-write",
  "network",
  "push",
  "pull-request",
  "merge",
  "tag",
  "publish",
  "release",
  "deployment",
  "durable-memory-write",
];

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function minimalEnvironment(extra = {}) {
  const names = ["PATH", "HOME", "USER", "LOGNAME", "SHELL", "TMPDIR", "LANG", "LC_ALL", "TERM", "XDG_CONFIG_HOME"];
  const environment = {};
  for (const name of names) if (typeof process.env[name] === "string") environment[name] = process.env[name];
  return { ...environment, ...extra };
}

function runSync(command, args, { cwd, env = {}, timeoutMs = 5_000 } = {}) {
  return spawnSync(command, args, {
    cwd,
    env: minimalEnvironment(env),
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 4 * 1024 * 1024,
  });
}

function capability(status, method, limitedReason = null) {
  return { status, method, limitedReason };
}

function emptyCapabilities() {
  return Object.fromEntries(cursorCapabilityNames.map((name) => [name, capability("unknown", "not-observed", "not verified by this run")]));
}

function commandLabel(command) {
  return command ? basename(command) : null;
}

export function discoverCursorCli({ candidates, env = {} } = {}) {
  const observedAt = new Date().toISOString();
  const requestedCandidates = candidates ?? unique([process.env.FORGERAIL_CURSOR_EXECUTABLE, "cursor-agent", "agent"]);
  const capabilities = emptyCapabilities();

  for (const candidate of requestedCandidates) {
    const versionResult = runSync(candidate, ["--version"], { env });
    if (versionResult.error?.code === "ENOENT") continue;
    if (versionResult.status !== 0) continue;

    const version = `${versionResult.stdout ?? ""}${versionResult.stderr ?? ""}`.trim().split("\n")[0] || "unknown";
    const helpResult = runSync(candidate, ["--help"], { env });
    const help = `${helpResult.stdout ?? ""}${helpResult.stderr ?? ""}`;
    const supportsPrint = /(?:^|\s)(?:-p,\s*)?--print(?:\s|$)/m.test(help);
    const supportsOutput = /--output-format/.test(help);
    const supportsResume = /--resume/.test(help) || /\bresume\b/.test(help);
    const supportsForce = /(?:^|\s)(?:-f,\s*)?--force(?:\s|$)/m.test(help);
    const supportsStatus = /\bstatus\b/.test(help);
    const statusArgs = supportsStatus ? ["status"] : ["auth", "status"];
    const authResult = runSync(candidate, statusArgs, { env });
    const authText = `${authResult.stdout ?? ""}${authResult.stderr ?? ""}`.trim();
    const authentication = authResult.status === 0
      ? "authenticated"
      : /not logged|unauth|sign in|login required/i.test(authText)
        ? "unauthenticated"
        : "unknown";

    capabilities.discover = capability("verified", "version-and-help-probe");
    capabilities.launch_read_only = supportsPrint && supportsOutput
      ? capability("supported", "help-advertised-print-output", "real read-only canary not yet run")
      : capability("unsupported", "help-probe", "print or structured output flag not advertised");
    capabilities.launch_bounded_write = supportsForce
      ? capability("profile-only", "help-advertised-force", "mutation canary not yet run")
      : capability("unknown", "help-probe", "write-enabling semantics not advertised");
    capabilities.stream_events = supportsOutput
      ? capability("supported", "help-advertised-output-format", "stream schema not yet verified")
      : capability("unsupported", "help-probe", "structured output not advertised");
    capabilities.wait = capability("supported", "host-process-lifecycle", "real process wait not yet verified");
    capabilities.cancel = capability("supported", "host-process-signal", "real cancellation not yet verified");
    capabilities.resume = supportsResume
      ? capability("supported", "help-advertised-resume", "session resume canary not yet run")
      : capability("unknown", "help-probe", "resume command not advertised");
    capabilities.live_message = capability("unknown", "not-observed", "no stable non-interactive live-message protocol verified");
    capabilities.instruction_discovery = capability("profile-only", "existing-cursor-rules-profile", "real rule discovery not yet verified");

    return {
      observedAt,
      status: authentication === "unauthenticated" ? "blocked" : authentication === "authenticated" ? "verified" : "degraded",
      executable: candidate,
      cli: {
        command: commandLabel(candidate),
        version,
        authentication,
        helpDigest: help ? sha256(help) : null,
      },
      capabilities,
      limitedReason: authentication === "unauthenticated"
        ? "Cursor CLI is installed but not authenticated"
        : authentication === "unknown"
          ? "Cursor CLI authentication status could not be verified without login"
          : null,
    };
  }

  for (const name of cursorCapabilityNames) {
    capabilities[name] = capability("unavailable", "executable-probe", "no supported Cursor CLI executable found");
  }
  return {
    observedAt,
    status: "unavailable",
    executable: null,
    cli: { command: null, version: null, authentication: "unavailable", helpDigest: null },
    capabilities,
    limitedReason: "Install Cursor CLI and authenticate it explicitly before running a paid Agent canary",
  };
}

function safeRelativePath(value) {
  return typeof value === "string"
    && value.length > 0
    && !isAbsolute(value)
    && value !== ".."
    && !value.startsWith(`..${sep}`)
    && !value.includes(`${sep}..${sep}`);
}

function inside(candidate, root) {
  const path = relative(resolve(root), resolve(candidate));
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

function exactStringArray(value, label, errors, { min = 0 } = {}) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array`);
    return;
  }
  if (value.length < min) errors.push(`${label} must contain at least ${min} item(s)`);
  if (value.some((item) => typeof item !== "string" || item.length === 0)) errors.push(`${label} must contain non-empty strings`);
  if (new Set(value).size !== value.length) errors.push(`${label} must not contain duplicates`);
}

export function validateCanaryContract(contract) {
  const errors = [];
  if (!contract || typeof contract !== "object" || Array.isArray(contract)) return ["contract must be an object"];
  if (contract.schemaVersion !== "1.0") errors.push("schemaVersion must equal 1.0");
  if (typeof contract.canaryId !== "string" || !/^[a-z][a-z0-9._:-]+$/.test(contract.canaryId)) errors.push("canaryId has an invalid format");
  if (!["read-only", "bounded-write", "resume"].includes(contract.mode)) errors.push("mode is invalid");
  if (!contract.workspace || typeof contract.workspace !== "object") errors.push("workspace is required");
  else {
    for (const key of ["workspaceId", "canonicalRoot", "disposableRoot", "cwd"]) {
      if (typeof contract.workspace[key] !== "string" || contract.workspace[key].length === 0) errors.push(`workspace.${key} is required`);
    }
    if (errors.length === 0) {
      const { canonicalRoot, disposableRoot, cwd } = contract.workspace;
      if (!inside(cwd, disposableRoot)) errors.push("workspace.cwd must be inside workspace.disposableRoot");
      if (resolve(disposableRoot) === resolve(canonicalRoot) || inside(disposableRoot, canonicalRoot)) {
        errors.push("workspace.disposableRoot must be outside workspace.canonicalRoot");
      }
      if (contract.mode === "bounded-write" && inside(cwd, canonicalRoot)) errors.push("bounded-write cwd must not resolve inside the canonical workspace");
    }
  }
  if (typeof contract.prompt !== "string" || contract.prompt.length === 0) errors.push("prompt is required");
  exactStringArray(contract.allowedPaths, "allowedPaths", errors);
  exactStringArray(contract.allowedOperations, "allowedOperations", errors);
  exactStringArray(contract.prohibitedOperations, "prohibitedOperations", errors, { min: 1 });
  for (const path of contract.allowedPaths ?? []) if (!safeRelativePath(path)) errors.push(`allowedPaths contains unsafe path: ${path}`);
  const overlap = (contract.allowedOperations ?? []).filter((operation) => (contract.prohibitedOperations ?? []).includes(operation));
  if (overlap.length > 0) errors.push(`operations are both allowed and prohibited: ${overlap.join(", ")}`);
  if (typeof contract.mutationAuthorized !== "boolean") errors.push("mutationAuthorized must be boolean");
  if (contract.mode === "bounded-write" && contract.mutationAuthorized !== true) errors.push("bounded-write requires mutationAuthorized=true");
  if (contract.mode === "read-only" && contract.mutationAuthorized !== false) errors.push("read-only requires mutationAuthorized=false");
  if (!Number.isInteger(contract.timeoutMs) || contract.timeoutMs < 1_000 || contract.timeoutMs > 600_000) errors.push("timeoutMs must be between 1000 and 600000");
  if (contract.outputFormat !== "stream-json") errors.push("outputFormat must equal stream-json");
  if (!contract.expected || typeof contract.expected !== "object") errors.push("expected is required");
  else {
    exactStringArray(contract.expected.changedPaths, "expected.changedPaths", errors);
    for (const path of contract.expected.changedPaths ?? []) if (!safeRelativePath(path)) errors.push(`expected.changedPaths contains unsafe path: ${path}`);
    if (!Array.isArray(contract.expected.fileAssertions)) errors.push("expected.fileAssertions must be an array");
    else for (const [index, assertion] of contract.expected.fileAssertions.entries()) {
      if (!assertion || !safeRelativePath(assertion.path) || typeof assertion.equals !== "string") errors.push(`expected.fileAssertions[${index}] is invalid`);
    }
    if (!Array.isArray(contract.expected.validation)) errors.push("expected.validation must be an array");
    else for (const [index, validation] of contract.expected.validation.entries()) {
      if (!validation || typeof validation.command !== "string" || !Array.isArray(validation.args) || validation.args.some((arg) => typeof arg !== "string")) {
        errors.push(`expected.validation[${index}] is invalid`);
      }
    }
  }
  return unique(errors);
}

function git(cwd, args, { preserveLeading = false } = {}) {
  const result = runSync("git", args, { cwd, timeoutMs: 10_000 });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${`${result.stderr ?? ""}`.trim()}`);
  const output = `${result.stdout ?? ""}`;
  return preserveLeading ? output.trimEnd() : output.trim();
}

export function gitSnapshot(cwd) {
  const status = git(cwd, ["status", "--porcelain=v1", "--untracked-files=all"], { preserveLeading: true });
  const changedPaths = status
    ? status.split("\n").map((line) => line.slice(3).split(" -> ").at(-1)).filter(Boolean).sort()
    : [];
  return {
    commit: git(cwd, ["rev-parse", "HEAD"]),
    tree: git(cwd, ["write-tree"]),
    statusDigest: sha256(status),
    changedPaths,
  };
}

function cursorPermissions(mode) {
  if (mode === "read-only") {
    return {
      permissions: {
        allow: ["Read(**/*)"],
        deny: ["Write(**/*)", "Shell(git)", "Shell(curl)", "Shell(ssh)", "Shell(npm)", "Shell(node)"],
      },
    };
  }
  return {
    permissions: {
      allow: ["Read(**/*)", "Write(src/value.txt)"],
      deny: [
        "Write(AGENTS.md)",
        "Write(FORGERAIL.md)",
        "Write(package.json)",
        "Write(validate.mjs)",
        "Write(.cursor/**)",
        "Write(.git/**)",
        "Shell(git)",
        "Shell(curl)",
        "Shell(ssh)",
        "Shell(npm)",
        "Shell(node)",
      ],
    },
  };
}

export function materializeCursorCanary({
  mode,
  canonicalRoot,
  fixtureRoot = defaultCursorFixtureRoot,
  timeoutMs = 120_000,
  mutationAuthorized = false,
} = {}) {
  if (!["read-only", "bounded-write"].includes(mode)) throw new Error("materialization mode must be read-only or bounded-write");
  const temporaryRoot = mkdtempSync(resolve(tmpdir(), "forgerail-cursor-canary-"));
  const workspace = resolve(temporaryRoot, "workspace");
  cpSync(fixtureRoot, workspace, { recursive: true });
  mkdirSync(resolve(workspace, ".cursor"), { recursive: true });
  writeFileSync(resolve(workspace, ".cursor/cli.json"), `${JSON.stringify(cursorPermissions(mode), null, 2)}\n`);
  git(workspace, ["init", "--quiet"]);
  git(workspace, ["add", "."]);
  git(workspace, ["-c", "user.name=ForgeRail Canary", "-c", "user.email=canary@invalid", "commit", "--quiet", "-m", "fixture baseline"]);

  const boundedWrite = mode === "bounded-write";
  const contract = {
    schemaVersion: "1.0",
    canaryId: `cursor-local-${mode}`,
    mode,
    workspace: {
      workspaceId: "forgerail-cursor-disposable-canary",
      canonicalRoot: realpathSync(canonicalRoot),
      disposableRoot: realpathSync(temporaryRoot),
      cwd: realpathSync(workspace),
    },
    prompt: boundedWrite
      ? "Read AGENTS.md and FORGERAIL.md. Change only src/value.txt so its complete content is updated followed by one newline. Do not use shell, network, credentials, Git remotes, or modify any other file."
      : "Read AGENTS.md, FORGERAIL.md, and src/value.txt. Report the current value and the execution boundary. Do not modify any file or run shell, network, credential, or Git remote operations.",
    allowedPaths: boundedWrite ? ["src/value.txt"] : [],
    allowedOperations: boundedWrite ? ["read", "write-declared-path"] : ["read"],
    prohibitedOperations,
    mutationAuthorized: boundedWrite ? mutationAuthorized : false,
    timeoutMs,
    outputFormat: "stream-json",
    expected: {
      changedPaths: boundedWrite ? ["src/value.txt"] : [],
      fileAssertions: [{ path: "src/value.txt", equals: boundedWrite ? "updated\n" : "original\n" }],
      validation: [{ command: "node", args: ["validate.mjs", boundedWrite ? "updated" : "original"] }],
    },
  };

  const errors = validateCanaryContract(contract);
  if (errors.length > 0) {
    rmSync(temporaryRoot, { recursive: true, force: true });
    throw new Error(`materialized invalid canary contract: ${errors.join("; ")}`);
  }
  return {
    temporaryRoot,
    workspace,
    contract,
    cleanup() {
      rmSync(temporaryRoot, { recursive: true, force: true });
    },
  };
}

export function parseCursorStream(stdout) {
  const events = [];
  const errors = [];
  for (const [index, line] of stdout.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (!event || typeof event !== "object" || Array.isArray(event)) errors.push(`line ${index + 1} is not an object`);
      else events.push(event);
    } catch {
      errors.push(`line ${index + 1} is not valid JSON`);
    }
  }
  const init = events.find((event) => event.type === "system" && event.subtype === "init") ?? null;
  const terminal = [...events].reverse().find((event) => event.type === "result") ?? null;
  const sessionId = terminal?.session_id ?? init?.session_id ?? events.find((event) => event.session_id)?.session_id ?? null;
  return { events, errors, init, terminal, sessionId };
}

export function runCursorProcess(command, args, { cwd, env = {}, timeoutMs, signal, maxOutputBytes = 4 * 1024 * 1024 } = {}) {
  return new Promise((resolveProcess) => {
    const startedAt = new Date().toISOString();
    const child = spawn(command, args, {
      cwd,
      env: minimalEnvironment(env),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let cancelled = false;
    let outputTruncated = false;
    let spawnError = null;

    function append(current, chunk) {
      const next = current + chunk.toString("utf8");
      if (Buffer.byteLength(next) <= maxOutputBytes) return next;
      outputTruncated = true;
      return Buffer.from(next).subarray(0, maxOutputBytes).toString("utf8");
    }
    child.stdout?.on("data", (chunk) => { stdout = append(stdout, chunk); });
    child.stderr?.on("data", (chunk) => { stderr = append(stderr, chunk); });
    child.on("error", (error) => { spawnError = error; });

    const terminate = (reason) => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      if (reason === "timeout") timedOut = true;
      if (reason === "cancel") cancelled = true;
      child.kill("SIGTERM");
    };
    const timer = setTimeout(() => terminate("timeout"), timeoutMs);
    const abort = () => terminate("cancel");
    if (signal) {
      if (signal.aborted) abort();
      else signal.addEventListener("abort", abort, { once: true });
    }

    child.on("close", (exitCode, processSignal) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      resolveProcess({
        startedAt,
        finishedAt: new Date().toISOString(),
        exitCode,
        signal: processSignal,
        timedOut,
        cancelled,
        outputTruncated,
        spawnError: spawnError ? { code: spawnError.code ?? null, message: spawnError.message } : null,
        stdout,
        stderr,
      });
    });
  });
}

function validateFiles(contract) {
  const validations = [];
  for (const assertion of contract.expected.fileAssertions) {
    const target = resolve(contract.workspace.cwd, assertion.path);
    const actual = existsSync(target) ? readFileSync(target, "utf8") : null;
    validations.push({
      kind: "file-assertion",
      path: assertion.path,
      status: actual === assertion.equals ? "passed" : "failed",
      expectedDigest: sha256(assertion.equals),
      actualDigest: actual === null ? null : sha256(actual),
    });
  }
  for (const validation of contract.expected.validation) {
    const command = validation.command === "node" ? process.execPath : validation.command;
    const result = runSync(command, validation.args, { cwd: contract.workspace.cwd, timeoutMs: 30_000 });
    validations.push({
      kind: "command",
      command: validation.command,
      args: validation.args,
      status: result.status === 0 ? "passed" : "failed",
      exitCode: result.status,
      outputDigest: sha256(`${result.stdout ?? ""}${result.stderr ?? ""}`),
    });
  }
  return validations;
}

function sameValues(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

export async function runCursorCanary({ contract, executable, env = {}, resumeSessionId = null, signal } = {}) {
  const contractErrors = validateCanaryContract(contract);
  if (contractErrors.length > 0) {
    return {
      status: "blocked",
      contractErrors,
      capabilities: emptyCapabilities(),
      execution: null,
      evidence: { rawOutputDigest: null, gitBefore: null, gitAfter: null, changedPaths: [], validations: [] },
      deviations: contractErrors,
    };
  }
  const before = gitSnapshot(contract.workspace.cwd);
  const safeArgs = [
    "-p",
    "--output-format",
    "stream-json",
    "--trust",
    "--sandbox",
    "enabled",
    "--workspace",
    contract.workspace.cwd,
  ];
  if (contract.mode === "read-only" || contract.mode === "resume") safeArgs.push("--mode", "plan");
  if (contract.mode === "bounded-write") safeArgs.push("--force");
  if (contract.mode === "resume") {
    if (!resumeSessionId) throw new Error("resumeSessionId is required for resume mode");
    safeArgs.push(`--resume=${resumeSessionId}`);
  }
  const processResult = await runCursorProcess(executable, [...safeArgs, contract.prompt], {
    cwd: contract.workspace.cwd,
    env,
    timeoutMs: contract.timeoutMs,
    signal,
  });
  const parsed = parseCursorStream(processResult.stdout);
  const after = gitSnapshot(contract.workspace.cwd);
  const validations = validateFiles(contract);
  const deviations = [];
  if (processResult.spawnError) deviations.push(`spawn failed: ${processResult.spawnError.code ?? "unknown"}`);
  if (processResult.timedOut) deviations.push("execution timed out");
  if (processResult.cancelled) deviations.push("execution was cancelled");
  if (processResult.outputTruncated) deviations.push("structured output exceeded the capture limit");
  if (processResult.exitCode !== 0) deviations.push(`process exit code was ${processResult.exitCode}`);
  if (parsed.errors.length > 0) deviations.push(...parsed.errors);
  if (!parsed.terminal) deviations.push("required terminal result event is missing");
  if (parsed.terminal?.subtype !== "success" || parsed.terminal?.is_error === true) deviations.push("terminal result did not report structured success");
  if (parsed.init?.cwd && resolve(parsed.init.cwd) !== resolve(contract.workspace.cwd)) deviations.push("Cursor init cwd differs from the contract cwd");
  if (!sameValues(after.changedPaths, contract.expected.changedPaths)) {
    deviations.push(`changed paths differ: expected ${JSON.stringify(contract.expected.changedPaths)}, observed ${JSON.stringify(after.changedPaths)}`);
  }
  const outsideAllowlist = after.changedPaths.filter((path) => !contract.allowedPaths.includes(path));
  if (outsideAllowlist.length > 0) deviations.push(`out-of-allowlist paths changed: ${outsideAllowlist.join(", ")}`);
  if (contract.mode === "read-only" && before.tree !== after.tree) deviations.push("read-only Git tree changed");
  if (validations.some((validation) => validation.status !== "passed")) deviations.push("independent validation failed");

  const capabilities = emptyCapabilities();
  capabilities.discover = capability("verified", "real-executable-invocation");
  capabilities.wait = capability("verified", "host-process-close-event");
  capabilities.cancel = processResult.cancelled
    ? capability("verified", "host-abort-signal")
    : capability("supported", "host-process-signal", "cancellation not exercised by this run");
  capabilities.stream_events = parsed.errors.length === 0 && parsed.events.length > 0
    ? capability("verified", "parsed-stream-json")
    : capability("degraded", "parsed-stream-json", parsed.errors.join("; ") || "no events observed");
  capabilities.terminal_result = parsed.terminal
    ? capability("verified", "terminal-result-event")
    : capability("degraded", "terminal-result-event", "terminal result missing");
  capabilities.launch_read_only = contract.mode === "read-only" && deviations.length === 0
    ? capability("verified", "disposable-read-only-canary")
    : capability("unknown", "not-observed", "read-only canary not verified by this run");
  capabilities.launch_bounded_write = contract.mode === "bounded-write" && deviations.length === 0
    ? capability("verified", "disposable-bounded-write-canary")
    : capability("profile-only", "not-observed", "bounded-write canary not verified by this run");
  capabilities.resume = contract.mode === "resume" && deviations.length === 0
    ? capability("verified", "same-workspace-session-resume")
    : capability("unknown", "not-observed", "resume not verified by this run");
  capabilities.live_message = capability("unknown", "not-observed", "no stable non-interactive live-message protocol verified");
  capabilities.instruction_discovery = capability("profile-only", "fixture-rules-present", "rule loading cannot be proven from transport events alone");

  return {
    status: deviations.length === 0 ? "verified" : processResult.timedOut || processResult.cancelled ? "failed" : "degraded",
    contractErrors: [],
    capabilities,
    execution: {
      mode: contract.mode,
      command: commandLabel(executable),
      args: safeArgs,
      cwd: contract.workspace.cwd,
      startedAt: processResult.startedAt,
      finishedAt: processResult.finishedAt,
      exitCode: processResult.exitCode,
      signal: processResult.signal,
      timedOut: processResult.timedOut,
      cancelled: processResult.cancelled,
      outputTruncated: processResult.outputTruncated,
      sessionId: parsed.sessionId,
      terminalSubtype: parsed.terminal?.subtype ?? null,
      stderrSummary: processResult.stderr.slice(0, 500),
    },
    evidence: {
      rawOutputDigest: sha256(`${processResult.stdout}\n${processResult.stderr}`),
      gitBefore: before,
      gitAfter: after,
      changedPaths: after.changedPaths,
      validations,
    },
    deviations: unique(deviations),
  };
}

function sanitizeValue(value, replacements) {
  if (typeof value === "string") {
    let sanitized = value;
    for (const [target, replacement] of replacements) if (target) sanitized = sanitized.split(target).join(replacement);
    return sanitized.length > 500 ? `${sanitized.slice(0, 500)}…` : sanitized;
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, replacements));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeValue(item, replacements)]));
  return value;
}

export function createCapabilityReport({ discovery, canary = null, roots = {} } = {}) {
  const capabilities = { ...discovery.capabilities, ...(canary?.capabilities ?? {}) };
  const status = canary?.status ?? discovery.status;
  const report = {
    schemaVersion: "1.0",
    adapterId: "cursor-local-executor",
    observedAt: canary?.execution?.finishedAt ?? discovery.observedAt,
    status: reportStates.has(status) ? status : "degraded",
    cli: discovery.cli,
    capabilities,
    execution: canary?.execution ?? null,
    evidence: canary?.evidence ?? {
      rawOutputDigest: null,
      gitBefore: null,
      gitAfter: null,
      changedPaths: [],
      validations: [],
    },
    deviations: canary?.deviations ?? (discovery.limitedReason ? [discovery.limitedReason] : []),
    promotionRecommendation: canary?.status === "verified"
      ? "capability-evidence-only"
      : "retain-profile-only",
  };
  const replacements = [
    [roots.disposableRoot, "<disposable-root>"],
    [roots.canonicalRoot, "<canonical-root>"],
    [process.env.HOME, "<user-home>"],
  ].sort(([left], [right]) => (right?.length ?? 0) - (left?.length ?? 0));
  return sanitizeValue(report, replacements);
}

export function validateCapabilityReport(report) {
  const errors = [];
  if (report?.schemaVersion !== "1.0") errors.push("schemaVersion must equal 1.0");
  if (report?.adapterId !== "cursor-local-executor") errors.push("adapterId is invalid");
  if (!reportStates.has(report?.status)) errors.push("status is invalid");
  if (!report?.observedAt || Number.isNaN(Date.parse(report.observedAt))) errors.push("observedAt is invalid");
  if (!report?.cli || !Object.hasOwn(report.cli, "authentication")) errors.push("cli is invalid");
  for (const name of cursorCapabilityNames) {
    const item = report?.capabilities?.[name];
    if (!item || !capabilityStates.has(item.status) || typeof item.method !== "string") errors.push(`capabilities.${name} is invalid`);
  }
  if (!report?.evidence || !Array.isArray(report.evidence.changedPaths) || !Array.isArray(report.evidence.validations)) errors.push("evidence is invalid");
  if (!Array.isArray(report?.deviations)) errors.push("deviations must be an array");
  if (!["retain-profile-only", "capability-evidence-only", "eligible-for-upstream-review"].includes(report?.promotionRecommendation)) {
    errors.push("promotionRecommendation is invalid");
  }
  return errors;
}
