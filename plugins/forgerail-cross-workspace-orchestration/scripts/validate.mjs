#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateOrchestration } from "./lib/orchestration.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const manifest = readJson(".codex-plugin/plugin.json");
const pack = readJson("pack.json");

if (manifest.name !== "forgerail-cross-workspace-orchestration") errors.push("invalid Plugin name");
if (manifest.version !== "0.1.0-alpha.4" || manifest.license !== "Apache-2.0") errors.push("invalid version or license");
if (pack.id !== "cross-workspace-orchestration" || pack.risk !== "medium") errors.push("invalid pack identity or risk");
if (!existsSync(resolve(root, pack.entry))) errors.push("pack entry is missing");
if (!existsSync(resolve(root, "LICENSE")) || !existsSync(resolve(root, "NOTICE"))) errors.push("license files are missing");

const skill = readFileSync(resolve(root, pack.entry), "utf8");
for (const phrase of [
  "Default to read, plan, and recommend",
  "At least two work items",
  "one concurrent writer",
  "independent and non-transitive",
  "transport delivery",
  "do not create orchestration state",
]) if (!skill.includes(phrase)) errors.push(`Skill is missing boundary: ${phrase}`);

const fixtureFiles = readdirSync(resolve(root, "scripts/fixtures")).filter((name) => name.endsWith(".json")).sort();
const results = [];
for (const file of fixtureFiles) {
  const fixture = readJson(`scripts/fixtures/${file}`);
  let actual;
  let error = null;
  try { actual = evaluateOrchestration(fixture.input); }
  catch (caught) { error = caught instanceof Error ? caught.message : String(caught); }
  if (fixture.expectedErrorContains) {
    const passed = typeof error === "string" && error.includes(fixture.expectedErrorContains);
    results.push({ name: fixture.name, passed, checks: [{ key: "expected-error", passed, expected: fixture.expectedErrorContains, actual: error }] });
    continue;
  }
  if (error) {
    results.push({ name: fixture.name, passed: false, checks: [{ key: "unexpected-error", passed: false, expected: null, actual: error }] });
    continue;
  }
  const checks = Object.entries(fixture.expected).map(([key, expected]) => ({
    key,
    passed: JSON.stringify(actual[key]) === JSON.stringify(expected),
    expected,
    actual: actual[key],
  }));
  if (actual.mutations.length > 0 || actual.proposedDurableWrites.length > 0) checks.push({ key: "read-only", passed: false, expected: [], actual: [...actual.mutations, ...actual.proposedDurableWrites] });
  results.push({ name: fixture.name, passed: checks.every(({ passed }) => passed), checks });
}

for (const required of [
  "two-independent-products",
  "aggregate-single-writer",
  "same-pr-conflict",
  "non-transitive-approvals",
  "partial-failure-replan",
  "no-thread-api-host",
  "existing-habits-first",
  "relaypact-optional",
  "duplicate-work-item-rejected",
  "unknown-operation-rejected",
  "unknown-dependency-rejected",
  "conflicting-event-rejected",
  "duplicate-terminal-event-rejected",
  "failed-status-missing-event-rejected",
  "accepted-status-missing-event-rejected",
  "unknown-status-rejected",
  "documented-statuses-supported",
  "explicit-paused-status-propagates",
  "documented-operations-approval-mapping",
  "failed-event-status-mismatch-rejected",
  "accepted-event-status-mismatch-rejected",
  "self-dependency-rejected",
  "dependency-cycle-rejected",
  "production-deployment-requires-independent-approval",
  "staging-deployment-does-not-require-production-approval",
  "blocking-roots-propagate-to-dependents",
]) if (!results.some(({ name }) => name === required)) errors.push(`missing fixture: ${required}`);

for (const result of results) if (!result.passed) errors.push(`fixture failed: ${result.name}`);
console.log(JSON.stringify({ valid: errors.length === 0, errors, fixtures: results, mutations: [], externalSideEffects: [] }, null, 2));
if (errors.length > 0) process.exitCode = 1;
