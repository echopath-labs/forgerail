#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginParentCandidates = [resolve(root, ".."), resolve(root, "plugins")];
const pluginParent = pluginParentCandidates.find((candidate) => existsSync(resolve(candidate, "forgerail-github-rulesets/scripts/validate.mjs")));
if (!pluginParent) {
  console.error(JSON.stringify({ schemaVersion: "1.0", status: "failed", blocker: "external-capability-pack-layout-not-found" }, null, 2));
  process.exit(1);
}
const entries = [
  "forgerail-cross-workspace-orchestration/scripts/validate.mjs",
  "forgerail-github-rulesets/scripts/validate.mjs",
  "forgerail-release-safety/scripts/validate.mjs",
  "forgerail-thread-closure/scripts/validate.mjs",
];
const results = [];
for (const entry of entries) {
  const result = spawnSync(process.execPath, [resolve(pluginParent, entry)], { cwd: root, encoding: "utf8" });
  results.push({ entry, status: result.status === 0 ? "passed" : "failed", exitCode: result.status, output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim() });
}
const report = { schemaVersion: "1.0", status: results.every(({ status }) => status === "passed") ? "passed" : "failed", results };
console.log(JSON.stringify(report, null, 2));
if (report.status !== "passed") process.exitCode = 1;
