import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";

function observed(id, source, value) {
  return { id, kind: "observed_fact", source, value };
}

function safeJson(path) {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; }
}

function hasMarkdown(directory) {
  if (!existsSync(directory) || !statSync(directory).isDirectory()) return false;
  return readdirSync(directory, { withFileTypes: true }).some((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"));
}

export function diagnoseWorkspace(workspace) {
  const root = resolve(workspace);
  if (!existsSync(root) || !statSync(root).isDirectory()) throw new Error("workspace must be an existing directory");
  const evidence = [];
  const recommendations = [];
  const confirmationRequired = [];

  for (const entry of ["AGENTS.md", "CLAUDE.md", ".github/copilot-instructions.md", "README.md"]) {
    if (existsSync(resolve(root, entry))) evidence.push(observed(`instructions:${entry}`, entry, "available"));
  }

  const recordSystems = [];
  if (existsSync(resolve(root, "openspec"))) recordSystems.push({ type: "openspec", source: "openspec/" });
  if (existsSync(resolve(root, ".specify")) || existsSync(resolve(root, "specs"))) recordSystems.push({ type: "spec-kit-or-spec-directory", source: existsSync(resolve(root, ".specify")) ? ".specify/" : "specs/" });
  for (const directory of ["docs/adr", "docs/adrs", "adr", "adrs", "decisions"]) {
    if (hasMarkdown(resolve(root, directory))) recordSystems.push({ type: "markdown-adr", source: `${directory}/` });
  }
  if (hasMarkdown(resolve(root, "docs")) && recordSystems.length === 0) recordSystems.push({ type: "markdown-docs", source: "docs/" });
  evidence.push(observed("record-systems", "bounded well-known paths", recordSystems));

  const packageJsonPath = resolve(root, "package.json");
  const packageJson = existsSync(packageJsonPath) ? safeJson(packageJsonPath) : null;
  if (packageJson) evidence.push(observed("package-scripts", "package.json", Object.keys(packageJson.scripts ?? {}).sort()));

  if (existsSync(resolve(root, ".git"))) evidence.push(observed("git-root", ".git/", "available"));
  const skillRoots = [".codex/skills", ".agents/skills"].filter((path) => existsSync(resolve(root, path)));
  evidence.push(observed("skill-roots", "bounded well-known paths", skillRoots));

  if (recordSystems.length === 0) {
    recommendations.push({
      kind: "recommendation",
      priority: "P1",
      reason: "No bounded durable record practice was observed for non-trivial engineering work.",
      options: ["continue with an existing custom documented practice", "use concise Markdown/ADR", "adopt OpenSpec or Spec Kit when structured change tracking is needed"],
    });
    confirmationRequired.push("Confirm the durable record target before creating files or installing a record system.");
  }

  return {
    schemaVersion: "1.0",
    mode: "read-only",
    workspace: basename(root),
    workspacePath: root,
    evidence,
    inheritedHabits: recordSystems,
    gaps: recordSystems.length === 0 ? ["durable-record-practice-not-observed"] : [],
    recommendations,
    confirmationRequired,
    mutations: [],
    fullHealthReviewRecommended: evidence.filter((item) => item.id.startsWith("instructions:")).length > 2,
  };
}
