#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const core = readFileSync(resolve(root, "skills/forgerail/SKILL.md"), "utf8");
const diagnosis = readFileSync(resolve(root, "skills/forgerail-workspace-diagnosis/SKILL.md"), "utf8");
const health = readFileSync(resolve(root, "skills/workspace-health-review/SKILL.md"), "utf8");
const frozen = JSON.parse(readFileSync(resolve(root, "docs/agw-frozen-baseline.json"), "utf8"));

function externalSkill(plugin, skill = plugin) {
  const candidates = [
    resolve(root, `../${plugin}/skills/${skill}/SKILL.md`),
    resolve(root, `plugins/${plugin}/skills/${skill}/SKILL.md`),
  ];
  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) throw new Error(`external Capability Pack entry is missing: ${plugin}`);
  return readFileSync(path, "utf8");
}

const rulesets = externalSkill("forgerail-github-rulesets");
const releaseSafety = externalSkill("forgerail-release-safety");
const threadClosure = externalSkill("forgerail-thread-closure");
const agwEvidence = frozen.behaviorAssertions;

const scenarios = [
  {
    id: "feature-branch-records",
    agwEvidence: agwEvidence.featureBranchRecords,
    forgerailEvidence: ["smallest owner workspace", "Task Envelope", "existing habits"],
    source: `${agwEvidence.featureBranchRecords.join("\n")}\n${core}\n${diagnosis}`,
    status: "covered",
  },
  {
    id: "dirty-worktree-preservation",
    agwEvidence: agwEvidence.dirtyWorktreePreservation,
    forgerailEvidence: ["preserve unrelated user changes", "dirty-worktree state"],
    source: `${agwEvidence.dirtyWorktreePreservation.join("\n")}\n${core}`,
    status: "covered",
  },
  {
    id: "markdown-existing-habit",
    agwEvidence: agwEvidence.existingRecordHabit,
    forgerailEvidence: ["existing habits", "OpenSpec may be a preferred example"],
    source: `${agwEvidence.existingRecordHabit.join("\n")}\n${diagnosis}`,
    status: "covered",
  },
  {
    id: "workspace-health",
    agwEvidence: agwEvidence.workspaceHealth,
    forgerailEvidence: ["first built-in ForgeRail Capability Pack", "Analyze First"],
    source: `${agwEvidence.workspaceHealth.join("\n")}\n${health}`,
    status: "covered-with-follow-up",
  },
  {
    id: "github-rulesets-read-first",
    agwEvidence: agwEvidence.githubRulesets,
    forgerailEvidence: ["read-only diagnosis", "Stop until the user explicitly approves"],
    source: `${agwEvidence.githubRulesets.join("\n")}\n${rulesets}`,
    status: "covered",
  },
  {
    id: "release-safety-project-runbook",
    agwEvidence: agwEvidence.releaseSafety,
    forgerailEvidence: ["project-owned release runbook", "does not contain publish, deploy"],
    source: `${agwEvidence.releaseSafety.join("\n")}\n${releaseSafety}`,
    status: "covered",
  },
  {
    id: "evidence-first-thread-closure",
    agwEvidence: agwEvidence.threadClosure,
    forgerailEvidence: ["Keep closeout incomplete", "Do not implement follow-up work"],
    source: `${agwEvidence.threadClosure.join("\n")}\n${core}\n${threadClosure}`,
    status: "covered",
  },
];

for (const scenario of scenarios) {
  scenario.missingAgw = scenario.agwEvidence.filter((phrase) => !scenario.source.toLocaleLowerCase("en-US").includes(phrase.toLocaleLowerCase("en-US")));
  scenario.missingForgeRail = scenario.forgerailEvidence.filter((phrase) => !scenario.source.toLocaleLowerCase("en-US").includes(phrase.toLocaleLowerCase("en-US")));
  scenario.passed = scenario.missingAgw.length === 0 && scenario.missingForgeRail.length === 0 && scenario.status !== "unresolved";
  delete scenario.source;
}

const result = {
  schemaVersion: "1.0",
  agwBaseline: "plugins/agent-workflow-governance@0.2.0-canonical",
  forgeRailCandidate: "plugins/forgerail@0.1.0-alpha.3-canonical",
  scenarios,
  covered: scenarios.filter((item) => item.passed).length,
  unresolved: scenarios.filter((item) => !item.passed).map((item) => item.id),
  behaviorCoverageReady: scenarios.every((item) => item.passed),
  migrationReady: false,
  migrationBlockers: ["usable ForgeRail prerelease is not published", "real compatibility-period canaries are incomplete", "AGW lifecycle change is not approved"],
};
console.log(JSON.stringify(result, null, 2));
