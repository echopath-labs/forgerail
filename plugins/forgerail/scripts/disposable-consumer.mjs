#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const base = mkdtempSync(resolve(tmpdir(), "forgerail-consumer-"));
const cache = resolve(base, "npm-cache");
const consumer = resolve(base, "consumer");
const target = resolve(base, "target-workspace");
const priorSource = resolve(base, "prior-source");
const packageName = "@echopath-labs/forgerail";
const installedPackageRoot = resolve(consumer, "node_modules", "@echopath-labs", "forgerail");
mkdirSync(consumer, { recursive: true });
mkdirSync(resolve(target, "docs/adr"), { recursive: true });
writeFileSync(resolve(consumer, "package.json"), `${JSON.stringify({ name: "forgerail-disposable-consumer", private: true }, null, 2)}\n`);
writeFileSync(resolve(target, "AGENTS.md"), "# Target\n\nUse the existing Markdown ADRs.\n");
writeFileSync(resolve(target, "docs/adr/0001.md"), "# ADR 0001\n\nUse Markdown decisions.\n");
cpSync(root, priorSource, { recursive: true });
const priorManifest = JSON.parse(readFileSync(resolve(priorSource, "package.json"), "utf8"));
priorManifest.version = "0.1.0-alpha.0";
writeFileSync(resolve(priorSource, "package.json"), `${JSON.stringify(priorManifest, null, 2)}\n`);
const priorPlugin = JSON.parse(readFileSync(resolve(priorSource, ".codex-plugin/plugin.json"), "utf8"));
priorPlugin.version = "0.1.0-alpha.0";
writeFileSync(resolve(priorSource, ".codex-plugin/plugin.json"), `${JSON.stringify(priorPlugin, null, 2)}\n`);

function run(command, args, cwd = consumer) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", env: { ...process.env, npm_config_cache: cache }, maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${(result.stderr || result.stdout).trim()}`);
  return result.stdout.trim();
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function snapshot(path) {
  return readdirSync(path, { recursive: true })
    .sort()
    .map((entry) => {
      const target = resolve(path, entry);
      const stat = statSync(target);
      return stat.isFile() ? `${entry}:file:${sha256(readFileSync(target))}` : `${entry}:directory`;
    });
}

const priorPack = JSON.parse(run("npm", ["pack", priorSource, "--json"], base))[0];
const priorTarball = resolve(base, priorPack.filename);
run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", priorTarball]);
const priorInstalled = JSON.parse(readFileSync(resolve(installedPackageRoot, "package.json"), "utf8")).version === "0.1.0-alpha.0";
const pack = JSON.parse(run("npm", ["pack", root, "--json"], base))[0];
const tarball = resolve(base, pack.filename);
run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball]);
const cli = resolve(consumer, "node_modules/.bin/forgerail");
const firstValidation = JSON.parse(run(cli, ["validate"]));
const before = JSON.stringify(snapshot(target));
const diagnosis = JSON.parse(run(cli, ["diagnose", "--workspace", target]));
const after = JSON.stringify(snapshot(target));
const adoptionPlan = JSON.parse(run(cli, ["adoption-plan", "--workspace", target, "--host", "codex"]));
const afterPlan = JSON.stringify(snapshot(target));
const proposed = adoptionPlan.proposedWrites[0];
const adoptionLibrary = await import(pathToFileURL(resolve(installedPackageRoot, "scripts/lib/adoption.mjs")).href);
const approvedContent = adoptionLibrary.renderProposedWrite(target, proposed);
const appliedWrite = adoptionLibrary.applyApprovedAdoptionWrite(target, proposed);
const approvedDigest = sha256(approvedContent);
if (appliedWrite.contentSha256 !== approvedDigest) throw new Error("approved adoption write digest mismatch");
const discoveredSkills = firstValidation.skills;
const bindingReceipt = {
  schemaVersion: "1.0",
  planId: adoptionPlan.planId,
  workspace: adoptionPlan.workspace,
  adoptionLevel: "lightweight-adoption",
  contractPath: null,
  hosts: [{
    adapterId: "codex",
    target: proposed.path,
    baseSha256: proposed.baseSha256,
    appliedSha256: approvedDigest,
    status: "verified",
    verification: ["Equivalent supported discovery read the approved managed block and the installed Plugin Skill inventory from the disposable package."],
  }],
  changedFiles: [proposed.path],
  validationEvidence: ["Applied managed content and exact base digest matched the approved Adoption Plan."],
  discoveredSkills,
  activationVerification: { mode: "equivalent-supported-discovery", verified: approvedContent.includes("forgerail:binding:codex:v1:start") && discoveredSkills.includes("forgerail") },
  confirmedNonMutations: ["No .forgerail directory was created.", "No Capability Pack was enabled or executed."],
  deviations: [],
  closeout: "complete",
};
const receiptPath = resolve(base, "host-binding-receipt.json");
writeFileSync(receiptPath, `${JSON.stringify(bindingReceipt, null, 2)}\n`);
const receiptValidation = JSON.parse(run(cli, ["validate-contract", "--type", "binding-receipt", "--file", receiptPath]));
const launch = JSON.parse(run(cli, ["launch", "--profile", resolve(root, "scripts/fixtures/contracts/effective-profile.valid.json"), "--envelope", resolve(root, "scripts/fixtures/contracts/task-envelope.valid.json"), "--host-agent", "Codex"]));
const upgraded = JSON.parse(readFileSync(resolve(installedPackageRoot, "package.json"), "utf8")).version === pack.version;
run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", priorTarball]);
const rolledBack = JSON.parse(readFileSync(resolve(installedPackageRoot, "package.json"), "utf8")).version === "0.1.0-alpha.0";
run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball]);
const reinstallValidation = JSON.parse(run(cli, ["validate"]));
run("npm", ["uninstall", "--no-audit", "--no-fund", packageName]);

const result = {
  schemaVersion: "1.0",
  packageName,
  sourceVersion: pack.version,
  tarball: { files: pack.entryCount, bytes: pack.size, shasum: pack.shasum, integrity: pack.integrity },
  install: firstValidation.valid,
  binaryShim: cli.endsWith("node_modules/.bin/forgerail"),
  priorInstall: priorInstalled,
  discovery: firstValidation.skills,
  diagnosis: diagnosis.mode === "read-only" && diagnosis.recommendations.length === 0 && diagnosis.adoption.currentLevel === "plugin-only",
  targetUnchangedByDiagnosis: before === after,
  adoptionPlan: adoptionPlan.strategy === "single-host-managed-block" && adoptionPlan.requiredConfirmation && adoptionPlan.mutations.length === 0 && proposed.path === "AGENTS.md",
  targetUnchangedByPlanner: after === afterPlan,
  explicitApprovedWrite: approvedDigest === sha256(approvedContent) && approvedContent.includes("forgerail:binding:codex:v1:start"),
  equivalentNewTaskDiscovery: bindingReceipt.activationVerification.verified && discoveredSkills.length === 4,
  bindingReceipt: receiptValidation.valid,
  noPersistedGovernance: !existsSync(resolve(target, ".forgerail")),
  launch: launch.valid && launch.launch.executionOwner === "host-agent",
  reinstall: reinstallValidation.valid,
  upgrade: upgraded,
  rollback: rolledBack,
  uninstall: !existsSync(installedPackageRoot),
  disposableRoot: "[disposable]",
};
result.passed = result.priorInstall && result.install && result.binaryShim && result.diagnosis && result.targetUnchangedByDiagnosis && result.adoptionPlan && result.targetUnchangedByPlanner && result.explicitApprovedWrite && result.equivalentNewTaskDiscovery && result.bindingReceipt && result.noPersistedGovernance && result.launch && result.upgrade && result.rollback && result.reinstall && result.uninstall;
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
