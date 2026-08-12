#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const manifest = JSON.parse(readFileSync(resolve(root, ".codex-plugin/plugin.json"), "utf8"));
const pack = JSON.parse(readFileSync(resolve(root, "pack.json"), "utf8"));
if (manifest.name !== "forgerail-github-rulesets") errors.push("invalid Plugin name");
if (manifest.license !== "Apache-2.0") errors.push("invalid license");
if (pack.id !== "github-rulesets" || pack.risk !== "high") errors.push("invalid pack identity or risk");
if (pack.approvals.length !== 1 || pack.approvals[0] !== "github-ruleset-mutation-approval") errors.push("mutation approval boundary is missing");
if (!existsSync(resolve(root, pack.entry))) errors.push("pack entry is missing");
const skill = readFileSync(resolve(root, pack.entry), "utf8");
for (const phrase of ["read-only diagnosis", "Stop until the user explicitly approves", "does not authorize merge, release"]) if (!skill.includes(phrase)) errors.push(`Skill is missing boundary: ${phrase}`);
const fixtureNames = ["available", "recommended", "enabled-unapproved", "exact-approval"];
const fixtures = fixtureNames.map((name) => ({ name, ...JSON.parse(readFileSync(resolve(root, "scripts/fixtures", `${name}.json`), "utf8")) }));
for (const fixture of fixtures) {
  if (fixture.name !== "exact-approval" && fixture.expectedRemoteMutations.length > 0) errors.push(`${fixture.name} must not permit remote mutations`);
  if (fixture.name === "exact-approval") {
    if (fixture.approvalGate !== "github-ruleset-mutation-approval") errors.push("exact approval fixture has the wrong gate");
    if (!fixture.repository || fixture.allowedOperations.length === 0 || fixture.prohibitedOperations.length === 0) errors.push("exact approval fixture is incomplete");
    if (JSON.stringify(fixture.allowedOperations) !== JSON.stringify(fixture.expectedRemoteMutations)) errors.push("exact approval fixture exceeds allowed operations");
  }
}
console.log(JSON.stringify({ valid: errors.length === 0, errors, fixtureStates: fixtures.map((fixture) => fixture.state), implementationRemoteMutations: [] }, null, 2));
if (errors.length > 0) process.exitCode = 1;
