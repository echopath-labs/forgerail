#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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

const scenarioDefinitions = [
  {
    id: "feature-branch-records",
    agwEvidence: agwEvidence.featureBranchRecords,
    forgerailEvidence: ["smallest owner workspace", "Task Envelope", "existing habits"],
    source: `${core}\n${diagnosis}`,
    status: "covered",
  },
  {
    id: "dirty-worktree-preservation",
    agwEvidence: agwEvidence.dirtyWorktreePreservation,
    forgerailEvidence: ["preserve unrelated user changes", "dirty-worktree state"],
    source: core,
    status: "covered",
  },
  {
    id: "markdown-existing-habit",
    agwEvidence: agwEvidence.existingRecordHabit,
    forgerailEvidence: ["existing habits", "OpenSpec may be a preferred example"],
    source: diagnosis,
    status: "covered",
  },
  {
    id: "workspace-health",
    agwEvidence: agwEvidence.workspaceHealth,
    forgerailEvidence: ["first built-in ForgeRail Capability Pack", "Analyze First"],
    source: health,
    status: "covered-with-follow-up",
  },
  {
    id: "github-rulesets-read-first",
    agwEvidence: agwEvidence.githubRulesets,
    forgerailEvidence: ["read-only diagnosis", "Stop until the user explicitly approves"],
    source: rulesets,
    status: "covered",
  },
  {
    id: "release-safety-project-runbook",
    agwEvidence: agwEvidence.releaseSafety,
    forgerailEvidence: ["project-owned release runbook", "does not contain publish, deploy"],
    source: releaseSafety,
    status: "covered",
  },
  {
    id: "evidence-first-thread-closure",
    agwEvidence: agwEvidence.threadClosure,
    forgerailEvidence: ["Keep closeout incomplete", "Do not implement follow-up work"],
    source: `${core}\n${threadClosure}`,
    status: "covered",
  },
];

export function evaluateShadowComparison(overrides = {}) {
  const baselineSource = JSON.stringify(frozen);
  const scenarios = scenarioDefinitions.map((definition) => {
    const source = overrides[definition.id] ?? definition.source;
    const scenario = { ...definition };
    scenario.missingAgw = scenario.agwEvidence.filter((phrase) => !baselineSource.toLocaleLowerCase("en-US").includes(phrase.toLocaleLowerCase("en-US")));
    scenario.missingForgeRail = scenario.forgerailEvidence.filter((phrase) => !source.toLocaleLowerCase("en-US").includes(phrase.toLocaleLowerCase("en-US")));
    scenario.passed = scenario.missingAgw.length === 0 && scenario.missingForgeRail.length === 0 && scenario.status !== "unresolved";
    delete scenario.source;
    return scenario;
  });
  return {
    schemaVersion: "1.0",
    agwBaseline: "plugins/agent-workflow-governance@0.2.0-canonical",
    forgeRailCandidate: "plugins/forgerail@0.1.0-alpha.4-canonical",
    scenarios,
    covered: scenarios.filter((item) => item.passed).length,
    unresolved: scenarios.filter((item) => !item.passed).map((item) => item.id),
    behaviorCoverageReady: scenarios.every((item) => item.passed),
    migrationReady: false,
    migrationBlockers: ["real compatibility-period canaries are incomplete", "AGW lifecycle change is not approved"],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = evaluateShadowComparison();
  console.log(JSON.stringify(result, null, 2));
  if (!result.behaviorCoverageReady) process.exitCode = 1;
}
