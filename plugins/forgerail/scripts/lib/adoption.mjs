import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  fsyncSync,
  ftruncateSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { validateContract } from "./contracts.mjs";

const levels = ["plugin-only", "lightweight-adoption", "persisted-governance"];
const portableRelativePath = /^(?![\\/])(?![a-zA-Z]:[\\/])(?!.*(?:^|[\\/])\.\.(?:[\\/]|$))[^\\]+$/;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function read(path) {
  return readFileSync(path, "utf8");
}

function adapterFiles(pluginRoot) {
  return readdirSync(resolve(pluginRoot, "adapters"))
    .filter((name) => name.endsWith(".json"))
    .sort();
}

function confined(root, target) {
  const value = relative(root, target);
  return value === "" || (value !== ".." && !value.startsWith(`..${sep}`) && !value.startsWith("/"));
}

function linkAwareStat(path) {
  try { return lstatSync(path); }
  catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return null;
    throw error;
  }
}

function adoptionTarget(workspace, path) {
  if (typeof path !== "string" || !portableRelativePath.test(path)) throw new Error(`adoption target path is unsafe: ${path}`);
  const root = realpathSync(resolve(workspace));
  let cursor = root;
  for (const segment of path.split("/")) {
    const candidate = resolve(cursor, segment);
    if (!confined(root, candidate)) throw new Error(`adoption target escapes workspace: ${path}`);
    const metadata = linkAwareStat(candidate);
    if (metadata !== null) {
      if (metadata.isSymbolicLink()) throw new Error(`adoption target cannot traverse a symbolic link: ${path}`);
      const observed = realpathSync(candidate);
      if (!confined(root, observed)) throw new Error(`adoption target escapes workspace: ${path}`);
      cursor = observed;
    } else cursor = candidate;
  }
  return cursor;
}

export function resolveAdoptionWriteTarget(workspace, path) {
  return adoptionTarget(workspace, path);
}

function sameFile(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

export function loadHostAdapters(pluginRoot) {
  const adapters = adapterFiles(pluginRoot).map((name) => JSON.parse(read(resolve(pluginRoot, "adapters", name))));
  const errors = [];
  const ids = new Set();
  for (const adapter of adapters) {
    const validation = validateContract("host-adapter", adapter);
    if (!validation.valid) errors.push(...validation.errors.map((error) => `${adapter.id ?? name}: ${error}`));
    if (ids.has(adapter.id)) errors.push(`duplicate host adapter: ${adapter.id}`);
    ids.add(adapter.id);
  }
  return { valid: errors.length === 0, errors, adapters };
}

export function observeAdoptionLevel(workspace, adapters = []) {
  const root = realpathSync(resolve(workspace));
  if (existsSync(resolve(root, ".forgerail"))) return "persisted-governance";
  if (existsSync(resolve(root, "FORGERAIL.md"))) return "lightweight-adoption";
  for (const adapter of adapters) {
    const target = adoptionTarget(root, adapter.bindingTarget);
    if (existsSync(target) && statSync(target).isFile() && read(target).includes(`<!-- ${adapter.managedMarker}:start -->`)) return "lightweight-adoption";
  }
  return "plugin-only";
}

function templateName(adapterId, strategy) {
  if (adapterId === "codex") return strategy === "single-host-managed-block" ? "codex-compact.md" : "codex-thin.md";
  if (adapterId === "claude-code") return "claude-code-thin.md";
  if (adapterId === "cursor") return "cursor-thin.mdc";
  throw new Error(`no binding template for host adapter: ${adapterId}`);
}

function proposedWrite(workspace, path, content, managedMarker) {
  const target = adoptionTarget(workspace, path);
  const exists = existsSync(target);
  if (exists && !statSync(target).isFile()) throw new Error(`adoption target is not a file: ${path}`);
  const prior = exists ? read(target) : null;
  const start = `<!-- ${managedMarker}:start -->`;
  const end = `<!-- ${managedMarker}:end -->`;
  const hasStart = prior?.includes(start) ?? false;
  const hasEnd = prior?.includes(end) ?? false;
  if (hasStart !== hasEnd) throw new Error(`adoption target has an incomplete managed marker: ${path}`);
  if (hasStart && prior.indexOf(start) > prior.indexOf(end)) throw new Error(`adoption target has reversed managed markers: ${path}`);
  if (hasStart && (prior.match(new RegExp(start.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))?.length ?? 0) !== 1) throw new Error(`adoption target has duplicate managed markers: ${path}`);
  if (exists && path === ".cursor/rules/forgerail.mdc" && !hasStart) throw new Error("Cursor binding target already exists without a ForgeRail managed marker");
  const operation = exists ? (hasStart ? "replace-managed-block" : "append-managed-block") : "create";
  const approvedContent = operation === "replace-managed-block" && content.indexOf(start) > 0
    ? `${content.slice(content.indexOf(start), content.indexOf(end) + end.length)}\n`
    : content;
  return {
    path,
    operation,
    baseSha256: prior === null ? null : sha256(prior),
    contentSha256: sha256(approvedContent),
    content: approvedContent,
    managedMarker,
  };
}

export function renderProposedWrite(workspace, write) {
  const target = adoptionTarget(workspace, write.path);
  const prior = existsSync(target) ? read(target) : "";
  if (write.operation === "create") return write.content;
  if (sha256(prior) !== write.baseSha256) throw new Error(`base digest drifted for ${write.path}`);
  if (write.operation === "append-managed-block") return `${prior.replace(/\s*$/, "")}\n\n${write.content}`;
  const start = `<!-- ${write.managedMarker}:start -->`;
  const end = `<!-- ${write.managedMarker}:end -->`;
  const startIndex = prior.indexOf(start);
  const endIndex = prior.indexOf(end, startIndex);
  if (startIndex < 0 || endIndex < 0) throw new Error(`managed block is missing for ${write.path}`);
  return `${prior.slice(0, startIndex)}${write.content}${prior.slice(endIndex + end.length)}`;
}

export function applyApprovedAdoptionWrite(workspace, write) {
  const root = realpathSync(resolve(workspace));
  const content = renderProposedWrite(root, write);
  const target = adoptionTarget(root, write.path);
  const parent = realpathSync(dirname(target));
  if (!confined(root, parent)) throw new Error(`adoption target parent escapes workspace: ${write.path}`);
  const leaf = basename(target);
  const creating = write.operation === "create";
  const flags = creating
    ? constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW
    : constants.O_RDWR | constants.O_NOFOLLOW;
  let descriptor;
  let created = false;
  const originalDirectory = process.cwd();
  let parentBound = false;
  try {
    process.chdir(parent);
    parentBound = true;
    const boundParent = realpathSync(".");
    if (!confined(root, boundParent)) throw new Error(`adoption target parent moved outside workspace: ${write.path}`);
    descriptor = openSync(leaf, flags, 0o644);
    created = creating;
    const descriptorStat = fstatSync(descriptor);
    const pathStat = lstatSync(leaf);
    if (pathStat.isSymbolicLink() || !sameFile(descriptorStat, pathStat)) throw new Error(`adoption target changed before write: ${write.path}`);
    const observed = realpathSync(leaf);
    if (!confined(root, observed)) throw new Error(`adoption target escapes workspace before write: ${write.path}`);
    if (!creating) {
      const current = readFileSync(descriptor, "utf8");
      if (sha256(current) !== write.baseSha256) throw new Error(`base digest drifted for ${write.path}`);
    }
    ftruncateSync(descriptor, 0);
    writeSync(descriptor, content, 0, "utf8");
    fsyncSync(descriptor);
    return { path: write.path, contentSha256: sha256(content) };
  } catch (error) {
    if (created) {
      try {
        const pathStat = lstatSync(leaf);
        if (descriptor !== undefined && sameFile(fstatSync(descriptor), pathStat)) unlinkSync(leaf);
      } catch {}
    }
    throw error;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    if (parentBound) process.chdir(originalDirectory);
  }
}

export function planAdoption(pluginRoot, workspace, hostIds, proposedLevel = "lightweight-adoption") {
  const root = resolve(workspace);
  if (!existsSync(root) || !statSync(root).isDirectory()) throw new Error("workspace must be an existing directory");
  const realRoot = realpathSync(root);
  if (!levels.includes(proposedLevel)) throw new Error(`unknown adoption level: ${proposedLevel}`);
  if (proposedLevel === "persisted-governance") throw new Error("persisted-governance is evidence-gated and deferred in ForgeRail alpha.1");
  if (!Array.isArray(hostIds) || hostIds.length === 0) throw new Error("at least one explicit --host is required");
  if (new Set(hostIds).size !== hostIds.length) throw new Error("host selection contains duplicates");
  const registry = loadHostAdapters(pluginRoot);
  if (!registry.valid) throw new Error(`host adapter registry is invalid: ${registry.errors.join("; ")}`);
  const byId = new Map(registry.adapters.map((adapter) => [adapter.id, adapter]));
  const selected = hostIds.map((id) => {
    const adapter = byId.get(id);
    if (!adapter) throw new Error(`unknown host adapter: ${id}`);
    return adapter;
  });
  const currentLevel = observeAdoptionLevel(realRoot, registry.adapters);
  if (currentLevel !== "plugin-only" && proposedLevel === "plugin-only") throw new Error("adoption removal or downgrade requires a separate reviewed plan and is not generated by alpha.1");
  if (currentLevel === "persisted-governance") throw new Error("persisted-governance was observed; alpha.1 will diagnose it but will not generate replacement or downgrade writes");
  const strategy = proposedLevel === "plugin-only" ? "no-change" : selected.length === 1 ? "single-host-managed-block" : "shared-contract-with-thin-bindings";
  const writes = [];
  if (strategy === "single-host-managed-block") {
    const adapter = selected[0];
    if (!adapter.bindingModes.includes("managed-block")) throw new Error(`${adapter.id} does not support a managed-block binding`);
    const content = read(resolve(pluginRoot, "templates/bindings", templateName(adapter.id, strategy)));
    writes.push(proposedWrite(realRoot, adapter.bindingTarget, content, adapter.managedMarker));
  } else if (strategy === "shared-contract-with-thin-bindings") {
    const contract = read(resolve(pluginRoot, "templates/FORGERAIL.md")).replace("{{HOSTS}}", selected.map((adapter) => adapter.displayName).join(", "));
    writes.push(proposedWrite(realRoot, "FORGERAIL.md", contract, "forgerail:adoption-contract:v1"));
    for (const adapter of selected) {
      if (!adapter.bindingModes.includes("thin-reference")) throw new Error(`${adapter.id} does not support a thin-reference binding`);
      const content = read(resolve(pluginRoot, "templates/bindings", templateName(adapter.id, strategy)));
      writes.push(proposedWrite(realRoot, adapter.bindingTarget, content, adapter.managedMarker));
    }
  }
  const identity = sha256(JSON.stringify({ workspace: basename(root), currentLevel, proposedLevel, strategy, hosts: hostIds, writes: writes.map(({ path, operation, baseSha256, contentSha256 }) => ({ path, operation, baseSha256, contentSha256 })) })).slice(0, 20);
  const plan = {
    schemaVersion: "1.0",
    planId: `adoption:${identity}`,
    workspace: basename(root),
    currentLevel,
    proposedLevel,
    strategy,
    evidence: [
      `Observed current adoption level: ${currentLevel}.`,
      `User or host Agent explicitly selected host adapters: ${hostIds.join(", ")}.`,
      "ForgeRail alpha.1 does not generate persisted .forgerail state.",
    ],
    hosts: selected.map((adapter) => ({ adapterId: adapter.id, status: adapter.status, bindingTarget: adapter.bindingTarget, verificationMode: adapter.verification.mode })),
    proposedWrites: writes,
    requiredConfirmation: true,
    verification: selected.map((adapter) => adapter.status === "supported"
      ? `${adapter.displayName}: start a new task in the adopted workspace and verify the binding plus expected Skills are discovered.`
      : `${adapter.displayName}: profile-only; perform host-specific discovery verification before treating this binding as active.`),
    confirmedNonMutations: [
      "The planner did not write workspace files.",
      "The planner did not create .forgerail/ state.",
      "The planner did not enable Capability Packs or authorize external side effects.",
    ],
    mutations: [],
    status: "candidate",
  };
  const validation = validateContract("adoption-plan", plan);
  if (!validation.valid) throw new Error(`generated adoption plan is invalid: ${validation.errors.join("; ")}`);
  return plan;
}
