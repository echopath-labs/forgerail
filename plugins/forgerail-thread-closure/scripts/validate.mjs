#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const manifest = readJson(".codex-plugin/plugin.json");
const pack = readJson("pack.json");
if (manifest.name !== "forgerail-thread-closure") errors.push("invalid Plugin name");
if (manifest.license !== "Apache-2.0") errors.push("invalid license");
if (pack.id !== "thread-closure" || pack.risk !== "medium") errors.push("invalid pack identity or risk");
if (JSON.stringify(pack.approvals) !== JSON.stringify(["durable-record-write-approval", "lifecycle-change-approval"])) errors.push("independent closure gates are missing");
if (!existsSync(resolve(root, pack.entry))) errors.push("pack entry is missing");
const skill = readFileSync(resolve(root, pack.entry), "utf8");
for (const phrase of ["Default to Analyze First", "Keep closeout incomplete", "do not silently persist", "Do not implement follow-up work"]) if (!skill.includes(phrase)) errors.push(`Skill is missing boundary: ${phrase}`);
const fixtureNames = ["available", "incomplete-evidence", "ready-analyze", "durable-write-approved"];
const fixtures = fixtureNames.map((name) => ({ name, ...readJson(`scripts/fixtures/${name}.json`) }));
for (const fixture of fixtures) {
  if ((fixture.expectedDurableWrites ?? fixture.implementationDurableWrites ?? []).length > 0) errors.push(`${fixture.name} must not implement durable writes`);
  if ((fixture.expectedLifecycleMutations ?? []).length > 0) errors.push(`${fixture.name} must not implement lifecycle mutations`);
}
const incomplete = fixtures.find(({ name }) => name === "incomplete-evidence");
if (incomplete.expectedClosureState !== "incomplete") errors.push("missing evidence must keep closure incomplete");
const approved = fixtures.at(-1);
for (const field of ["approvalGate", "destination", "candidateDigest"]) if (!approved[field]) errors.push(`durable-write approval fixture is missing ${field}`);
console.log(JSON.stringify({ valid: errors.length === 0, errors, fixtureStates: fixtures.map(({ state }) => state), implementationDurableWrites: [], implementationLifecycleMutations: [] }, null, 2));
if (errors.length > 0) process.exitCode = 1;
