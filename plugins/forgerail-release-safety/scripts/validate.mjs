#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const manifest = readJson(".codex-plugin/plugin.json");
const pack = readJson("pack.json");
if (manifest.name !== "forgerail-release-safety") errors.push("invalid Plugin name");
if (manifest.license !== "Apache-2.0") errors.push("invalid license");
if (pack.id !== "release-safety" || pack.risk !== "high") errors.push("invalid pack identity or risk");
if (JSON.stringify(pack.approvals) !== JSON.stringify(["release-approval", "production-change-approval"])) errors.push("independent release gates are missing");
if (!existsSync(resolve(root, pack.entry))) errors.push("pack entry is missing");
const skill = readFileSync(resolve(root, pack.entry), "utf8");
for (const phrase of ["project-owned release runbook", "Stop until the user explicitly approves", "does not contain publish, deploy"]) if (!skill.includes(phrase)) errors.push(`Skill is missing boundary: ${phrase}`);
const fixtureNames = ["available", "recommended", "blocked-no-runbook", "exact-approval-package"];
const fixtures = fixtureNames.map((name) => ({ name, ...readJson(`scripts/fixtures/${name}.json`) }));
for (const fixture of fixtures) {
  const mutations = fixture.expectedRemoteMutations ?? fixture.implementationRemoteMutations ?? [];
  if (mutations.length > 0) errors.push(`${fixture.name} must not implement remote mutations`);
}
const exact = fixtures.at(-1);
for (const field of ["runbook", "target", "sourceCommit", "artifactDigest", "allowedOperations", "prohibitedOperations", "rollback"]) if (!exact[field] || exact[field].length === 0) errors.push(`exact approval package is missing ${field}`);
if (exact.approvalGate !== "release-approval") errors.push("exact approval fixture has the wrong gate");
console.log(JSON.stringify({ valid: errors.length === 0, errors, fixtureStates: fixtures.map(({ state }) => state), implementationRemoteMutations: [] }, null, 2));
if (errors.length > 0) process.exitCode = 1;
