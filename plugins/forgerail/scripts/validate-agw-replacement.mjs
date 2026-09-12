#!/usr/bin/env node
import { readFileSync, lstatSync, realpathSync } from "node:fs";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Structural completeness only; never promote this check to behavioral parity.
const requiredIds = [
  "activation", "precedence", "ownership", "git-state", "branch-choice", "commit",
  "merge", "branch-restore", "record-decision", "root-index", "relationships",
  "human-docs", "impact", "authorization", "context-budget", "stage-summary",
  "handoff", "structured-workflow", "optional-platform", "profile-snapshot",
  "health-areas", "health-report", "health-structured", "health-platform", "single-owner",
  "portable-discovery",
];
const requiredScenarios = ["feature", "integration-restore", "dirty-fix", "docs-only", "no-record-system",
  "multi-owner", "resume", "release-preparation", "health", "structured",
  "platform-unavailable", "precedence", "worktree"];

export function validateReplacement(root) {
  root = realpathSync(root);
  const errors = [];
  const visited = new Map();
  const fail = (message) => errors.push(message);
  function read(local) {
    const path = resolve(root, local);
    const rel = relative(root, path);
    if (isAbsolute(rel) || rel === ".." || rel.startsWith("../")) throw new Error(`outside Plugin: ${local}`);
    // A symlinked reference cannot prove an independently packaged baseline.
    let cursor = root;
    for (const part of rel.split(/[\\/]/)) {
      cursor = resolve(cursor, part);
      if (lstatSync(cursor).isSymbolicLink()) throw new Error(`linked dependency: ${local}`);
    }
    if (!lstatSync(path).isFile()) throw new Error(`not a regular file: ${local}`);
    return readFileSync(path, "utf8");
  }
  function walk(local, reached = new Set()) {
    if (reached.has(local)) return reached;
    const content = read(local);
    reached.add(local);
    visited.set(local, content);
    const refs = new Set();
    for (const match of content.matchAll(/\[[^\]]+\]\(([^)\s]+\.md)(?:#[^)\s]*)?\)/g)) refs.add(match[1]);
    for (const match of content.matchAll(/`([a-zA-Z0-9_./-]+\.md)`/g)) {
      if (match[1].startsWith("references/")) {
        // Bare documentation examples such as README.md are not loading links.
        if (["README.md", "AGENTS.md", "CLAUDE.md", "FORGERAIL.md", "SKILL.md"].includes(match[1])) continue;
        refs.add(match[1]);
      }
    }
    for (const ref of refs) {
      if (/^https?:/.test(ref)) continue;
      walk(relative(root, resolve(root, dirname(local), ref)).replaceAll("\\", "/"), reached);
    }
    return reached;
  }
  try {
    const manifest = JSON.parse(read("docs/agw-replacement-coverage.json"));
    const ids = manifest.behaviors.map((row) => row.id);
    if (new Set(ids).size !== ids.length) fail("duplicate behavior identity");
    for (const id of requiredIds) if (!ids.includes(id)) fail(`missing baseline behavior: ${id}`);
    const protocol = read("docs/agw-replacement-validation.md");
    for (const id of requiredScenarios) if (!protocol.includes(`| ${id} |`)) fail(`missing behavioral scenario: ${id}`);
    const entries = new Map();
    for (const row of manifest.behaviors) {
      if (!entries.has(row.entry)) entries.set(row.entry, walk(row.entry));
      if (!entries.get(row.entry).has(row.target)) fail(`unreachable target for ${row.id}: ${row.target}`);
      if (!Array.isArray(row.scenarioIds) || !row.scenarioIds.length || row.scenarioIds.some((id) => !requiredScenarios.includes(id))) fail(`invalid scenario coverage: ${row.id}`);
      if (["merge", "branch-restore"].includes(row.id) && !row.scenarioIds?.includes("integration-restore")) fail(`missing authorized integration coverage: ${row.id}`);
      if (row.behaviorStatus !== "pending") fail(`behavior verdict requires separate reviewed evidence: ${row.id}`);
    }
    if (manifest.readiness?.hostBehavior !== "pending") fail("structure cannot qualify host behavior");
  } catch (error) { fail(error.message); }
  return {
    check: "agw-replacement-structure", structuralReady: errors.length === 0,
    filesChecked: [...visited.keys()].sort(), errors,
    behaviorEquivalence: "not-assessed", migrationAuthorization: "none",
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = validateReplacement(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
  console.log(JSON.stringify(result, null, 2));
  if (!result.structuralReady) process.exitCode = 1;
}
