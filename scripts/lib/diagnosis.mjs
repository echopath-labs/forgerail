import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";

function observed(id, source, value) {
  return { id, kind: "observed_fact", source, value };
}

function safeJson(path) {
  try {
    const value = JSON.parse(readFileSync(path, "utf8"));
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return { state: "malformed", value: null, error: "invalid-root-shape" };
    }
    return { state: "available", value, error: null };
  }
  catch (error) { return { state: "malformed", value: null, error: error instanceof SyntaxError ? "invalid-json" : "unreadable" }; }
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

  for (const entry of ["AGENTS.md", "CLAUDE.md", ".cursor/rules/forgerail.mdc", ".github/copilot-instructions.md", "README.md"]) {
    if (existsSync(resolve(root, entry))) evidence.push(observed(`instructions:${entry}`, entry, "available"));
  }

  const hostAdapters = [
    { id: "codex", status: "supported", target: "AGENTS.md", observed: existsSync(resolve(root, "AGENTS.md")) },
    { id: "claude-code", status: "profile-only", target: "CLAUDE.md", observed: existsSync(resolve(root, "CLAUDE.md")) },
    { id: "cursor", status: "profile-only", target: ".cursor/rules/forgerail.mdc", observed: existsSync(resolve(root, ".cursor/rules/forgerail.mdc")) },
  ];
  const managedBindingObserved = hostAdapters.some((adapter) => {
    if (!adapter.observed) return false;
    try { return readFileSync(resolve(root, adapter.target), "utf8").includes(`forgerail:binding:${adapter.id}:v1:start`); } catch { return false; }
  });
  const adoptionLevel = existsSync(resolve(root, ".forgerail"))
    ? "persisted-governance"
    : existsSync(resolve(root, "FORGERAIL.md")) || managedBindingObserved
      ? "lightweight-adoption"
      : "plugin-only";
  evidence.push(observed("host-adapters", "bounded host instruction paths", hostAdapters));
  evidence.push(observed("forgerail-adoption-level", "bounded ForgeRail markers", adoptionLevel));

  const recordSystems = [];
  if (existsSync(resolve(root, "openspec"))) recordSystems.push({ type: "openspec", source: "openspec/" });
  if (existsSync(resolve(root, ".specify")) || existsSync(resolve(root, "specs"))) recordSystems.push({ type: "spec-kit-or-spec-directory", source: existsSync(resolve(root, ".specify")) ? ".specify/" : "specs/" });
  for (const directory of ["docs/adr", "docs/adrs", "adr", "adrs", "decisions"]) {
    if (hasMarkdown(resolve(root, directory))) recordSystems.push({ type: "markdown-adr", source: `${directory}/` });
  }
  if (hasMarkdown(resolve(root, "docs")) && recordSystems.length === 0) recordSystems.push({ type: "markdown-docs", source: "docs/" });
  evidence.push(observed("record-systems", "bounded well-known paths", recordSystems));

  const packageJsonPath = resolve(root, "package.json");
  const packageJson = existsSync(packageJsonPath) ? safeJson(packageJsonPath) : { state: "absent", value: null, error: null };
  if (packageJson.state === "available") evidence.push(observed("package-scripts", "package.json", Object.keys(packageJson.value.scripts ?? {}).sort()));
  else if (packageJson.state === "malformed") {
    evidence.push(observed("package-metadata", "package.json", { state: "malformed", reason: packageJson.error }));
    recommendations.push({ kind: "recommendation", priority: "P1", reason: "package.json exists but is not usable as object metadata.", options: ["repair package.json before relying on package-script observations"] });
    confirmationRequired.push("Confirm whether malformed package metadata should block the intended task.");
  }

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
    evidence,
    inheritedHabits: recordSystems,
    gaps: [
      ...(recordSystems.length === 0 ? ["durable-record-practice-not-observed"] : []),
      ...(packageJson.state === "malformed" ? ["package-metadata-malformed"] : []),
    ],
    recommendations,
    confirmationRequired,
    mutations: [],
    adoption: {
      currentLevel: adoptionLevel,
      recommendedLevel: adoptionLevel,
      changeRecommended: false,
      reason: "ForgeRail keeps the minimum observed adoption level unless the user requests durable adoption or concrete evidence justifies escalation.",
      planCommandAvailable: "forgerail adoption-plan --workspace .",
      persistedGovernanceGeneration: "deferred",
    },
    fullHealthReviewRecommended: evidence.filter((item) => item.id.startsWith("instructions:")).length > 2,
  };
}
