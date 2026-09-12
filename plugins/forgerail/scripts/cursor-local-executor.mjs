#!/usr/bin/env node

import { resolve } from "node:path";
import {
  createCapabilityReport,
  discoverCursorCli,
  materializeCursorCanary,
  runCursorCanary,
  validateCapabilityReport,
} from "./lib/cursor-local-executor.mjs";

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function print(value) {
  console.log(JSON.stringify(value, null, 2));
}

const command = process.argv[2] ?? "discover";
const explicitExecutable = option("--executable");
const candidates = explicitExecutable ? [resolve(explicitExecutable)] : undefined;
const discovery = discoverCursorCli({ candidates });

if (command === "discover") {
  const report = createCapabilityReport({ discovery });
  const errors = validateCapabilityReport(report);
  print(errors.length === 0 ? report : { status: "failed", errors, report });
  if (errors.length > 0) process.exitCode = 1;
} else if (command === "canary") {
  if (!discovery.executable || discovery.cli.authentication !== "authenticated") {
    print(createCapabilityReport({ discovery }));
    process.exitCode = 2;
  } else {
    const mode = option("--mode") ?? "read-only";
    const mutationAuthorized = process.argv.includes("--authorize-mutation");
    const verifyResume = process.argv.includes("--verify-resume");
    if (mode === "bounded-write" && !mutationAuthorized) {
      print({ status: "blocked", limitedReason: "bounded-write requires --authorize-mutation for this exact disposable canary" });
      process.exitCode = 2;
    } else {
      const canary = materializeCursorCanary({
        mode,
        canonicalRoot: resolve("."),
        mutationAuthorized,
      });
      try {
        const result = await runCursorCanary({ contract: canary.contract, executable: discovery.executable });
        const report = createCapabilityReport({
          discovery,
          canary: result,
          roots: { disposableRoot: canary.temporaryRoot, canonicalRoot: resolve(".") },
        });
        if (verifyResume && result.status === "verified" && result.execution.sessionId) {
          const resumeContract = structuredClone(canary.contract);
          resumeContract.canaryId = `cursor-local-${mode}-resume`;
          resumeContract.mode = "resume";
          resumeContract.prompt = "Restate the current disposable workspace boundary and current src/value.txt value. Do not modify files or run shell, network, credential, or Git remote operations.";
          const resumed = await runCursorCanary({
            contract: resumeContract,
            executable: discovery.executable,
            resumeSessionId: result.execution.sessionId,
          });
          const resumeReport = createCapabilityReport({
            discovery,
            canary: resumed,
            roots: { disposableRoot: canary.temporaryRoot, canonicalRoot: resolve(".") },
          });
          print({
            sequence: "initial-and-resume",
            status: resumed.status === "verified" ? "verified" : "degraded",
            initial: report,
            resume: resumeReport,
          });
          if (resumed.status !== "verified") process.exitCode = 1;
        } else {
          print(report);
          if (result.status !== "verified" || verifyResume) process.exitCode = 1;
        }
      } finally {
        canary.cleanup();
      }
    }
  }
} else {
  console.error("Usage: node scripts/cursor-local-executor.mjs discover [--executable PATH] | canary --mode read-only|bounded-write [--authorize-mutation] [--verify-resume] [--executable PATH]");
  process.exitCode = 2;
}
