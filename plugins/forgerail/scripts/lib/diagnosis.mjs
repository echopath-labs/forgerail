import {
  lstatSync,
  opendirSync,
  realpathSync,
} from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { loadHostAdapters } from "./adoption.mjs";
import { inspectBoundedPath } from "./bounded-read.mjs";

const defaultPluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const maximumDiagnosticDirectoryEntries = 4096;

function observed(id, source, value) {
  return { id, kind: "observed_fact", source, value };
}

function confined(root, target) {
  const value = relative(root, target);
  return value === "" || (
    !isAbsolute(value)
    && !/^[a-zA-Z]:/.test(value)
    && value !== ".."
    && !value.startsWith(`..${sep}`)
    && !value.startsWith("/")
  );
}

function sameFile(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function safeJson(root, path) {
  const inspected = inspectBoundedPath(root, path, { finalKind: "file", read: true });
  if (inspected.state === "absent") return { state: "absent", value: null, error: null };
  if (inspected.state !== "available") return { state: "unavailable", value: null, error: inspected.state };
  try {
    const value = JSON.parse(inspected.content);
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return { state: "malformed", value: null, error: "invalid-root-shape" };
    }
    return { state: "available", value, error: null };
  } catch (error) {
    return { state: "malformed", value: null, error: error instanceof SyntaxError ? "invalid-json" : "unreadable" };
  }
}

function hasMarkdownRecord(root, path) {
  const inspected = inspectBoundedPath(root, path, { finalKind: "directory" });
  if (inspected.state !== "available") return false;
  const directory = resolve(root, path);
  let before;
  let observed;
  let handle;
  try {
    before = lstatSync(directory);
    observed = realpathSync(directory);
    const after = lstatSync(observed);
    if (!confined(root, observed) || after.isSymbolicLink() || !sameFile(before, after) || !after.isDirectory()) return false;
    handle = opendirSync(observed);
    const openedObserved = realpathSync(directory);
    const opened = lstatSync(openedObserved);
    if (openedObserved !== observed || !confined(root, openedObserved) || !sameFile(after, opened) || !opened.isDirectory()) return false;
    const names = [];
    while (true) {
      const entry = handle.readSync();
      if (entry === null) break;
      if (names.length >= maximumDiagnosticDirectoryEntries) return false;
      names.push(entry.name);
    }
    const finalObserved = realpathSync(directory);
    const final = lstatSync(finalObserved);
    if (finalObserved !== observed || !confined(root, finalObserved) || !sameFile(after, final) || !final.isDirectory()) return false;
    return names.some((name) => typeof name === "string"
      && name.toLowerCase().endsWith(".md")
      && inspectBoundedPath(root, `${path}/${name}`, { finalKind: "file", verify: true }).state === "available");
  } catch {
    return false;
  } finally {
    try { handle?.closeSync(); } catch {}
  }
}

export function diagnoseWorkspace(workspace, pluginRoot = defaultPluginRoot) {
  let root;
  try { root = realpathSync(resolve(workspace)); }
  catch { throw new Error("workspace must be an existing directory"); }
  const rootMetadata = lstatSync(root);
  if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) throw new Error("workspace must be an existing directory");
  const registry = loadHostAdapters(pluginRoot);
  if (!registry.valid) throw new Error(`host adapter registry is invalid: ${registry.errors.join("; ")}`);
  const evidence = [];
  const recommendations = [];
  const confirmationRequired = [];
  const gaps = [];

  const hostAdapters = registry.adapters.map((adapter) => {
    const binding = inspectBoundedPath(root, adapter.bindingTarget, { finalKind: "file", read: true });
    const detected = adapter.detectionTargets.some((path) => inspectBoundedPath(root, path).present);
    if (binding.present && binding.state !== "available") gaps.push(`host-binding-unavailable:${adapter.id}`);
    return {
      id: adapter.id,
      status: adapter.status,
      target: adapter.bindingTarget,
      observed: detected || binding.present,
      readState: binding.state,
      managedBindingObserved: binding.state === "available" && binding.content.includes(`<!-- ${adapter.managedMarker}:start -->`),
    };
  });

  for (const adapter of hostAdapters) {
    if (adapter.readState === "available") evidence.push(observed(`instructions:${adapter.target}`, adapter.target, "available"));
  }
  if (inspectBoundedPath(root, "README.md", { finalKind: "file" }).state === "available") {
    evidence.push(observed("instructions:README.md", "README.md", "available"));
  }

  const managedBindingObserved = hostAdapters.some((adapter) => adapter.managedBindingObserved);
  const persisted = inspectBoundedPath(root, ".forgerail").state === "available";
  const portableContract = inspectBoundedPath(root, "FORGERAIL.md", { finalKind: "file" }).state === "available";
  const adoptionLevel = persisted ? "persisted-governance" : portableContract || managedBindingObserved ? "lightweight-adoption" : "plugin-only";
  evidence.push(observed("host-adapters", "registry-owned bounded host instruction paths", hostAdapters));
  evidence.push(observed("forgerail-adoption-level", "bounded ForgeRail markers", adoptionLevel));

  const recordSystems = [];
  if (inspectBoundedPath(root, "openspec").state === "available") recordSystems.push({ type: "openspec", source: "openspec/" });
  const specify = inspectBoundedPath(root, ".specify").state === "available";
  const specs = inspectBoundedPath(root, "specs").state === "available";
  if (specify || specs) recordSystems.push({ type: "spec-kit-or-spec-directory", source: specify ? ".specify/" : "specs/" });
  for (const directory of ["docs/adr", "docs/adrs", "adr", "adrs", "decisions"]) {
    if (hasMarkdownRecord(root, directory)) recordSystems.push({ type: "markdown-adr", source: `${directory}/` });
  }
  if (hasMarkdownRecord(root, "docs") && recordSystems.length === 0) recordSystems.push({ type: "markdown-docs", source: "docs/" });
  evidence.push(observed("record-systems", "bounded well-known paths", recordSystems));

  const packageJson = safeJson(root, "package.json");
  if (packageJson.state === "available") evidence.push(observed("package-scripts", "package.json", Object.keys(packageJson.value.scripts ?? {}).sort()));
  else if (packageJson.state === "malformed" || packageJson.state === "unavailable") {
    const state = packageJson.state === "malformed" ? "malformed" : "unavailable";
    evidence.push(observed("package-metadata", "package.json", { state, reason: packageJson.error }));
    gaps.push(packageJson.state === "malformed" ? "package-metadata-malformed" : "package-metadata-unavailable");
    recommendations.push({
      kind: "recommendation",
      priority: "P1",
      reason: packageJson.state === "malformed"
        ? "package.json exists but is not usable as object metadata."
        : "package.json is not a bounded readable regular file.",
      options: [packageJson.state === "malformed"
        ? "repair package.json before relying on package-script observations"
        : "replace the unsafe package.json entry with a reviewed regular file before relying on package-script observations"],
    });
    confirmationRequired.push("Confirm whether unavailable package metadata should block the intended task.");
  }

  if (gaps.some((gap) => gap.startsWith("host-binding-unavailable:"))) {
    recommendations.push({
      kind: "recommendation",
      priority: "P1",
      reason: "One or more registered Host bindings are present but cannot be read within the no-follow regular-file boundary.",
      options: ["inspect the named Host binding and replace unsafe entries only after human confirmation"],
    });
    confirmationRequired.push("Confirm how each unavailable Host binding should be repaired before adoption.");
  }

  if (inspectBoundedPath(root, ".git").state === "available") evidence.push(observed("git-root", ".git/", "available"));
  const skillRoots = [".codex/skills", ".agents/skills"].filter((path) => inspectBoundedPath(root, path).state === "available");
  evidence.push(observed("skill-roots", "bounded well-known paths", skillRoots));

  if (recordSystems.length === 0) {
    gaps.push("durable-record-practice-not-observed");
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
    gaps,
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
