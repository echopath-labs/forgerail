#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBundle } from "./lib/bundle.mjs";
import { createLaunchContract, resolveProfile, verifyReceipt } from "./lib/composition.mjs";
import { contractTypes, readJson, validateContract } from "./lib/contracts.mjs";
import { diagnoseWorkspace } from "./lib/diagnosis.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function fail(message) { console.error(`forgerail: ${message}`); process.exit(1); }
function emit(value) { console.log(JSON.stringify(value, null, 2)); }
function arg(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function args(name) {
  const values = [];
  process.argv.forEach((value, index) => { if (value === name && process.argv[index + 1]) values.push(process.argv[index + 1]); });
  return values;
}

function validatePlugin() {
  const errors = [];
  const manifestPath = resolve(root, ".codex-plugin/plugin.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.name !== "forgerail") errors.push("Plugin name must be forgerail");
  if (manifest.version !== "0.1.0-alpha.1") errors.push("Plugin version must be 0.1.0-alpha.1");
  if (manifest.license !== "Apache-2.0") errors.push("Plugin license must be Apache-2.0");
  const expectedSkills = ["forgerail", "forgerail-workspace-diagnosis", "workspace-health-review"];
  const actualSkills = readdirSync(resolve(root, "skills"), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  if (JSON.stringify(actualSkills) !== JSON.stringify(expectedSkills)) errors.push(`Expected Skills ${expectedSkills.join(", ")}; received ${actualSkills.join(", ")}`);
  for (const skill of expectedSkills) {
    const skillRoot = resolve(root, "skills", skill);
    const content = readFileSync(resolve(skillRoot, "SKILL.md"), "utf8");
    const name = content.match(/^---\s*[\s\S]*?^name:\s*([^\n]+)$/m)?.[1]?.trim();
    if (name !== skill) errors.push(`${skill} frontmatter name is invalid`);
    if (!existsSync(resolve(skillRoot, "agents/openai.yaml"))) errors.push(`${skill}/agents/openai.yaml is missing`);
    for (const match of content.matchAll(/`(references\/[a-z0-9._/-]+\.md)`/g)) {
      if (!existsSync(resolve(skillRoot, match[1]))) errors.push(`${skill} reference is missing: ${match[1]}`);
    }
  }
  for (const type of contractTypes) {
    const name = { pack: "capability-pack", profile: "effective-profile", "profile-candidate": "profile-change-candidate", envelope: "task-envelope", launch: "launch-contract", receipt: "return-receipt" }[type];
    JSON.parse(readFileSync(resolve(root, "contracts", `${name}.schema.json`), "utf8"));
  }
  const packPath = resolve(root, "packs/workspace-health-review.json");
  const packResult = validateContract("pack", readJson(packPath));
  if (!packResult.valid) errors.push(...packResult.errors);
  const coverage = readJson(resolve(root, "docs/agw-coverage-baseline.json"));
  const allowedDispositions = new Set(coverage.allowedDispositions);
  if (new Set(coverage.items.map((item) => item.id)).size !== coverage.items.length) errors.push("AGW coverage contains duplicate ids");
  for (const item of coverage.items) {
    if (!allowedDispositions.has(item.target)) errors.push(`AGW coverage target is invalid: ${item.id}`);
    if (!["mapped", "unresolved"].includes(item.status)) errors.push(`AGW coverage status is invalid: ${item.id}`);
    if (item.status === "unresolved" && item.target !== "unresolved") errors.push(`AGW unresolved item must target unresolved: ${item.id}`);
  }
  if (coverage.migrationReady && coverage.items.some((item) => item.status !== "mapped")) errors.push("AGW migration cannot be ready with unresolved coverage");
  const contextBytes = Object.fromEntries(actualSkills.map((skill) => [skill, readFileSync(resolve(root, "skills", skill, "SKILL.md")).length]));
  return { valid: errors.length === 0, errors, skills: actualSkills, contracts: contractTypes, contextBytes };
}

function validateFixtures() {
  const fixtureRoot = resolve(root, "scripts/fixtures");
  const cases = [
    ["profile", "contracts/effective-profile.valid.json", true],
    ["profile-candidate", "contracts/profile-change-candidate.valid.json", true],
    ["envelope", "contracts/task-envelope.valid.json", true],
    ["envelope", "contracts/task-envelope.overlap.invalid.json", false],
    ["launch", "contracts/launch-contract.valid.json", true],
    ["receipt", "contracts/return-receipt.valid.json", true],
    ["receipt", "contracts/return-receipt.deviation.invalid.json", false],
  ];
  const results = cases.map(([type, path, expected]) => {
    const result = validateContract(type, readJson(resolve(fixtureRoot, path)));
    return { type, path, expected, actual: result.valid, passed: result.valid === expected, errors: result.errors };
  });
  for (const workspace of ["markdown-existing", "empty-records"]) {
    const path = resolve(fixtureRoot, "workspaces", workspace);
    const before = JSON.stringify(readdirSync(path, { recursive: true }).sort());
    const diagnosis = diagnoseWorkspace(path);
    const after = JSON.stringify(readdirSync(path, { recursive: true }).sort());
    results.push({ type: "diagnosis", path: relative(fixtureRoot, path), expected: true, actual: diagnosis.mutations.length === 0 && before === after, passed: diagnosis.mutations.length === 0 && before === after, errors: [] });
  }
  const manifests = readdirSync(resolve(root, "packs")).filter((name) => name.endsWith(".json")).map((name) => readJson(resolve(root, "packs", name)));
  const available = resolveProfile(readJson(resolve(fixtureRoot, "contracts/profile-input.available-pack.json")), manifests);
  results.push({ type: "composition", path: "contracts/profile-input.available-pack.json", expected: true, actual: available.valid && available.activePacks.length === 0 && available.profile.rules[0]?.value === "release", passed: available.valid && available.activePacks.length === 0 && available.profile.rules[0]?.value === "release", errors: available.errors });
  const conflict = resolveProfile(readJson(resolve(fixtureRoot, "contracts/profile-input.conflict.json")), manifests);
  results.push({ type: "composition", path: "contracts/profile-input.conflict.json", expected: false, actual: conflict.valid, passed: !conflict.valid && conflict.profile.conflicts.length === 1, errors: conflict.errors });
  const inactiveLaunch = createLaunchContract(available.profile, { ...readJson(resolve(fixtureRoot, "contracts/task-envelope.valid.json")), packs: ["workspace-health-review"] }, "Codex");
  results.push({ type: "launch", path: "inactive-pack", expected: false, actual: inactiveLaunch.valid, passed: !inactiveLaunch.valid && inactiveLaunch.errors.some((error) => error.includes("inactive pack")), errors: inactiveLaunch.errors });
  const receipt = readJson(resolve(fixtureRoot, "contracts/return-receipt.valid.json"));
  const mismatch = verifyReceipt({ ...receipt, branch: "not-the-current-branch", commit: null }, resolve(root, "../.."));
  results.push({ type: "receipt-observation", path: "observable-git-mismatch", expected: false, actual: mismatch.valid, passed: !mismatch.valid && mismatch.closeout === "incomplete", errors: mismatch.errors });
  return { passed: results.every((item) => item.passed), results };
}

const [command] = process.argv.slice(2);
if (command === "validate") {
  const result = validatePlugin(); emit(result); if (!result.valid) process.exitCode = 1;
} else if (command === "validate-fixtures") {
  const result = validateFixtures(); emit(result); if (!result.passed) process.exitCode = 1;
} else if (command === "validate-contract") {
  const type = arg("--type"); const file = arg("--file");
  if (!type || !file) fail("validate-contract requires --type and --file");
  const result = validateContract(type, readJson(resolve(file))); emit(result); if (!result.valid) process.exitCode = 1;
} else if (command === "diagnose") {
  const workspace = arg("--workspace"); if (!workspace) fail("diagnose requires --workspace"); emit(diagnoseWorkspace(workspace));
} else if (command === "resolve-profile") {
  const file = arg("--file"); if (!file) fail("resolve-profile requires --file");
  const manifests = [
    ...readdirSync(resolve(root, "packs")).filter((name) => name.endsWith(".json")).map((name) => readJson(resolve(root, "packs", name))),
    ...args("--pack-manifest").map((path) => readJson(resolve(path))),
  ];
  for (const manifest of manifests) {
    const validation = validateContract("pack", manifest);
    if (!validation.valid) fail(`invalid pack manifest ${manifest.id ?? "unknown"}: ${validation.errors.join("; ")}`);
  }
  const result = resolveProfile(readJson(resolve(file)), manifests); emit(result); if (!result.valid) process.exitCode = 1;
} else if (command === "launch") {
  const profile = arg("--profile"); const envelope = arg("--envelope"); const hostAgent = arg("--host-agent");
  if (!profile || !envelope || !hostAgent) fail("launch requires --profile, --envelope, and --host-agent");
  const profilePayload = readJson(resolve(profile));
  const effectiveProfile = profilePayload.profile ?? profilePayload;
  const result = createLaunchContract(effectiveProfile, readJson(resolve(envelope)), hostAgent); emit(result); if (!result.valid) process.exitCode = 1;
} else if (command === "verify-receipt") {
  const receipt = arg("--receipt"); const workspace = arg("--workspace");
  if (!receipt || !workspace) fail("verify-receipt requires --receipt and --workspace");
  const result = verifyReceipt(readJson(resolve(receipt)), workspace); emit(result); if (!result.valid) process.exitCode = 1;
} else if (command === "build-bundle") {
  const output = arg("--output"); if (!output) fail("build-bundle requires --output");
  const result = buildBundle(root, output);
  emit(process.argv.includes("--summary") ? { schemaVersion: result.schemaVersion, productId: result.productId, projection: result.projection, fileCount: result.fileCount, totalBytes: result.totalBytes, digest: result.digest, receiptDigest: result.receiptDigest } : result);
} else fail("usage: forgerail.mjs validate | validate-fixtures | validate-contract | diagnose | resolve-profile | launch | verify-receipt | build-bundle");
