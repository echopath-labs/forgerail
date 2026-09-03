import { createHash, randomBytes } from "node:crypto";
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmdirSync,
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
  const segments = path.split("/");
  for (const [index, segment] of segments.entries()) {
    const candidate = resolve(cursor, segment);
    if (!confined(root, candidate)) throw new Error(`adoption target escapes workspace: ${path}`);
    const metadata = linkAwareStat(candidate);
    if (metadata !== null) {
      if (metadata.isSymbolicLink()) throw new Error(`adoption target cannot traverse a symbolic link: ${path}`);
      const final = index === segments.length - 1;
      if (final && !metadata.isFile()) throw new Error(`adoption target is not a regular file: ${path}`);
      if (!final && !metadata.isDirectory()) throw new Error(`adoption target ancestor is not a regular directory: ${path}`);
      const observed = realpathSync(candidate);
      if (!confined(root, observed)) throw new Error(`adoption target escapes workspace: ${path}`);
      cursor = observed;
    } else cursor = candidate;
  }
  return cursor;
}

function readAdoptionTarget(path, label) {
  let descriptor;
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const metadata = fstatSync(descriptor);
    if (!metadata.isFile()) throw new Error(`adoption target is not a regular file: ${label}`);
    return readFileSync(descriptor, "utf8");
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

export function resolveAdoptionWriteTarget(workspace, path) {
  return adoptionTarget(workspace, path);
}

function sameFile(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function workspaceIdentitySha256(root, metadata) {
  return sha256(JSON.stringify({
    schemaVersion: "1.0",
    canonicalPath: root,
    device: String(metadata.dev),
    inode: String(metadata.ino),
  }));
}

function openBoundWorkspace(workspace) {
  const root = realpathSync(resolve(workspace));
  let descriptor;
  try {
    descriptor = openSync(root, constants.O_RDONLY | constants.O_NOFOLLOW | (constants.O_DIRECTORY ?? 0));
    const metadata = fstatSync(descriptor, { bigint: true });
    const pathMetadata = lstatSync(root, { bigint: true });
    if (!metadata.isDirectory() || pathMetadata.isSymbolicLink() || !sameFile(metadata, pathMetadata)) {
      throw new Error("workspace directory identity changed while binding approval");
    }
    return {
      root,
      descriptor,
      metadata,
      workspaceSha256: workspaceIdentitySha256(root, metadata),
    };
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    throw error;
  }
}

function verifyBoundWorkspacePath(binding) {
  const descriptorMetadata = fstatSync(binding.descriptor, { bigint: true });
  let pathMetadata;
  try {
    pathMetadata = lstatSync(binding.root, { bigint: true });
  } catch {
    throw new Error("approved workspace directory identity changed before write");
  }
  if (
    !descriptorMetadata.isDirectory()
    || pathMetadata.isSymbolicLink()
    || !sameFile(binding.metadata, descriptorMetadata)
    || !sameFile(binding.metadata, pathMetadata)
    || workspaceIdentitySha256(binding.root, descriptorMetadata) !== binding.workspaceSha256
  ) {
    throw new Error("approved workspace directory identity changed before write");
  }
}

function snapshotAdoptionWrite(write) {
  return Object.freeze({
    workspaceSha256: write.workspaceSha256,
    path: write.path,
    operation: write.operation,
    baseSha256: write.baseSha256,
    contentSha256: write.contentSha256,
    content: write.content,
    managedMarker: write.managedMarker,
    approvalSha256: write.approvalSha256,
  });
}

function approvalBoundWrite(write) {
  return {
    workspaceSha256: write.workspaceSha256,
    path: write.path,
    operation: write.operation,
    baseSha256: write.baseSha256,
    contentSha256: write.contentSha256,
    content: write.content,
    managedMarker: write.managedMarker,
  };
}

export function adoptionWriteApprovalDigest(write) {
  return sha256(JSON.stringify(approvalBoundWrite(snapshotAdoptionWrite(write))));
}

function verifyApprovedWrite(write, approvedWriteDigest, workspaceSha256) {
  const snapshot = snapshotAdoptionWrite(write);
  const currentDigest = sha256(JSON.stringify(approvalBoundWrite(snapshot)));
  if (
    typeof approvedWriteDigest !== "string"
    || approvedWriteDigest !== snapshot.approvalSha256
    || approvedWriteDigest !== currentDigest
    || snapshot.workspaceSha256 !== workspaceSha256
  ) {
    throw new Error("approved write digest does not match the proposed write");
  }
  return snapshot;
}

function approvedContent(write) {
  if (typeof write.content !== "string" || sha256(write.content) !== write.contentSha256) {
    throw new Error(`approved content digest does not match for ${write.path}`);
  }
  return write.content;
}

function removeCreatedParents(root, created) {
  for (const directory of created.reverse()) {
    try {
      const metadata = lstatSync(directory.path);
      if (confined(root, directory.path) && sameFile(metadata, directory.metadata)) rmdirSync(directory.path);
    } catch {}
  }
}

function withBoundAdoptionParent(root, path, workspaceMetadata, operation) {
  const parentPath = dirname(path);
  const segments = parentPath === "." ? [] : parentPath.split("/");
  const originalDirectory = process.cwd();
  const created = [];
  let failed = false;
  try {
    process.chdir(root);
    const enteredWorkspace = lstatSync(".", { bigint: true });
    if (!enteredWorkspace.isDirectory() || !sameFile(workspaceMetadata, enteredWorkspace)) {
      throw new Error("approved workspace directory identity changed before write");
    }
    for (const segment of segments) {
      let metadata = linkAwareStat(segment);
      let directoryCreated = false;
      if (metadata === null) {
        try {
          mkdirSync(segment, { mode: 0o755 });
          directoryCreated = true;
        } catch (error) {
          if (!error || typeof error !== "object" || error.code !== "EEXIST") throw error;
        }
        metadata = lstatSync(segment);
      }
      if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
        throw new Error(`adoption target parent is not a regular directory: ${path}`);
      }
      process.chdir(segment);
      const observed = realpathSync(".");
      if (!confined(root, observed)) throw new Error(`adoption target parent escapes workspace: ${path}`);
      if (directoryCreated) created.push({ path: observed, metadata: lstatSync(".") });
    }
    return operation(basename(path));
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    process.chdir(originalDirectory);
    if (failed) removeCreatedParents(root, created);
  }
}

function writeAll(descriptor, content) {
  const buffer = Buffer.from(content, "utf8");
  let offset = 0;
  while (offset < buffer.length) {
    const written = writeSync(descriptor, buffer, offset, buffer.length - offset, null);
    if (written <= 0) throw new Error("adoption target write made no progress");
    offset += written;
  }
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
    if (existsSync(target) && readAdoptionTarget(target, adapter.bindingTarget).includes(`<!-- ${adapter.managedMarker}:start -->`)) return "lightweight-adoption";
  }
  return "plugin-only";
}

function templateName(adapterId, strategy) {
  if (adapterId === "codex") return strategy === "single-host-managed-block" ? "codex-compact.md" : "codex-thin.md";
  if (adapterId === "claude-code") return "claude-code-thin.md";
  if (adapterId === "cursor") return "cursor-thin.mdc";
  throw new Error(`no binding template for host adapter: ${adapterId}`);
}

function proposedWrite(workspace, workspaceSha256, path, content, managedMarker) {
  const target = adoptionTarget(workspace, path);
  const exists = existsSync(target);
  if (exists && !statSync(target).isFile()) throw new Error(`adoption target is not a file: ${path}`);
  const prior = exists ? readAdoptionTarget(target, path) : null;
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
  const write = {
    workspaceSha256,
    path,
    operation,
    baseSha256: prior === null ? null : sha256(prior),
    contentSha256: sha256(approvedContent),
    content: approvedContent,
    managedMarker,
  };
  return { ...write, approvalSha256: adoptionWriteApprovalDigest(write) };
}

export function renderProposedWrite(workspace, write) {
  const target = adoptionTarget(workspace, write.path);
  const prior = existsSync(target) ? readAdoptionTarget(target, write.path) : "";
  return renderApprovedWriteContent(write, prior);
}

function renderApprovedWriteContent(write, prior) {
  const content = approvedContent(write);
  if (write.operation === "create") return content;
  if (sha256(prior) !== write.baseSha256) throw new Error(`base digest drifted for ${write.path}`);
  if (write.operation === "append-managed-block") return `${prior.replace(/\s*$/, "")}\n\n${content}`;
  const start = `<!-- ${write.managedMarker}:start -->`;
  const end = `<!-- ${write.managedMarker}:end -->`;
  const startIndex = prior.indexOf(start);
  const endIndex = prior.indexOf(end, startIndex);
  if (startIndex < 0 || endIndex < 0) throw new Error(`managed block is missing for ${write.path}`);
  return `${prior.slice(0, startIndex)}${content}${prior.slice(endIndex + end.length)}`;
}

export function applyApprovedAdoptionWrite(workspace, write, approvedWriteDigest) {
  const binding = openBoundWorkspace(workspace);
  try {
    const { root } = binding;
    const approvedWrite = verifyApprovedWrite(write, approvedWriteDigest, binding.workspaceSha256);
    verifyBoundWorkspacePath(binding);
    const creating = approvedWrite.operation === "create";
    return withBoundAdoptionParent(root, approvedWrite.path, binding.metadata, (leaf) => {
    const boundParent = realpathSync(".");
    if (!confined(root, boundParent)) throw new Error(`adoption target parent moved outside workspace: ${approvedWrite.path}`);
    const identity = randomBytes(12).toString("hex");
    const temporary = `.forgerail-${identity}.tmp`;
    let backup;
    let sourceDescriptor;
    let temporaryDescriptor;
    let directoryDescriptor;
    let temporaryExists = false;
    let backupExists = false;
    let createdTarget = false;
    let replacementInstalled = false;
    let preserveBackup = false;
    let temporaryStat;
    let sourceStat;
    let content;
    try {
      const pathStat = linkAwareStat(leaf);
      if (creating) {
        if (pathStat !== null) throw new Error(`adoption target changed before write: ${approvedWrite.path}`);
        content = renderApprovedWriteContent(approvedWrite, "");
      } else {
        if (pathStat === null || !pathStat.isFile()) {
          throw new Error(`adoption target is not a regular file: ${approvedWrite.path}`);
        }
        sourceDescriptor = openSync(leaf, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        sourceStat = fstatSync(sourceDescriptor);
        if (!sourceStat.isFile() || pathStat.isSymbolicLink() || !sameFile(sourceStat, pathStat)) {
          throw new Error(`adoption target changed before write: ${approvedWrite.path}`);
        }
        const observed = realpathSync(leaf);
        if (!confined(root, observed)) throw new Error(`adoption target escapes workspace before write: ${approvedWrite.path}`);
        const current = readFileSync(sourceDescriptor, "utf8");
        content = renderApprovedWriteContent(approvedWrite, current);
      }

      const mode = creating ? 0o644 : sourceStat.mode & 0o777;
      temporaryDescriptor = openSync(
        temporary,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
        mode,
      );
      temporaryExists = true;
      writeAll(temporaryDescriptor, content);
      fsyncSync(temporaryDescriptor);
      temporaryStat = fstatSync(temporaryDescriptor);
      closeSync(temporaryDescriptor);
      temporaryDescriptor = undefined;

      directoryDescriptor = openSync(".", constants.O_RDONLY);
      if (creating) {
        linkSync(temporary, leaf);
        createdTarget = true;
      } else {
        const finalPathStat = lstatSync(leaf);
        if (finalPathStat.isSymbolicLink() || !sameFile(sourceStat, finalPathStat)) {
          throw new Error(`adoption target changed before replace: ${approvedWrite.path}`);
        }
        backup = `.forgerail-${randomBytes(12).toString("hex")}.bak`;
        if (linkAwareStat(backup) !== null) throw new Error(`adoption recovery path already exists: ${approvedWrite.path}`);
        linkSync(leaf, backup);
        backupExists = true;
        const detached = lstatSync(backup);
        if (detached.isSymbolicLink() || !sameFile(sourceStat, detached)) {
          throw new Error(`adoption target changed while preparing replacement: ${approvedWrite.path}`);
        }
        const beforeReplace = lstatSync(leaf);
        if (beforeReplace.isSymbolicLink() || !sameFile(sourceStat, beforeReplace)) {
          throw new Error(`adoption target changed before atomic replace: ${approvedWrite.path}`);
        }
        renameSync(temporary, leaf);
        temporaryExists = false;
        replacementInstalled = true;
      }
      const installed = lstatSync(leaf);
      if (installed.isSymbolicLink() || !sameFile(temporaryStat, installed)) {
        throw new Error(`adoption target identity mismatch after write: ${approvedWrite.path}`);
      }
      fsyncSync(directoryDescriptor);
      if (creating) {
        unlinkSync(temporary);
        temporaryExists = false;
      } else {
        unlinkSync(backup);
        backupExists = false;
        fsyncSync(directoryDescriptor);
      }
      return { path: approvedWrite.path, contentSha256: sha256(content) };
    } catch (error) {
      if (replacementInstalled && backupExists) {
        try {
          const installed = lstatSync(leaf);
          if (temporaryStat === undefined || installed.isSymbolicLink() || !sameFile(temporaryStat, installed)) {
            throw new Error(`adoption target changed before recovery: ${approvedWrite.path}`);
          }
          renameSync(backup, leaf);
          backupExists = false;
          if (directoryDescriptor !== undefined) fsyncSync(directoryDescriptor);
        } catch {
          preserveBackup = true;
        }
      } else if (createdTarget) {
        try {
          const installed = lstatSync(leaf);
          if (temporaryStat !== undefined && sameFile(temporaryStat, installed)) unlinkSync(leaf);
        } catch {}
      }
      throw error;
    } finally {
      if (sourceDescriptor !== undefined) closeSync(sourceDescriptor);
      if (temporaryDescriptor !== undefined) closeSync(temporaryDescriptor);
      if (directoryDescriptor !== undefined) closeSync(directoryDescriptor);
      if (temporaryExists) {
        try { unlinkSync(temporary); } catch {}
      }
      if (backupExists && !preserveBackup) {
        try { unlinkSync(backup); } catch {}
      }
    }
    });
  } finally {
    closeSync(binding.descriptor);
  }
}

export function planAdoption(pluginRoot, workspace, hostIds, proposedLevel = "lightweight-adoption") {
  const root = resolve(workspace);
  if (!existsSync(root) || !statSync(root).isDirectory()) throw new Error("workspace must be an existing directory");
  const binding = openBoundWorkspace(root);
  const realRoot = binding.root;
  try {
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
    writes.push(proposedWrite(realRoot, binding.workspaceSha256, adapter.bindingTarget, content, adapter.managedMarker));
  } else if (strategy === "shared-contract-with-thin-bindings") {
    const contract = read(resolve(pluginRoot, "templates/FORGERAIL.md")).replace("{{HOSTS}}", selected.map((adapter) => adapter.displayName).join(", "));
    writes.push(proposedWrite(realRoot, binding.workspaceSha256, "FORGERAIL.md", contract, "forgerail:adoption-contract:v1"));
    for (const adapter of selected) {
      if (!adapter.bindingModes.includes("thin-reference")) throw new Error(`${adapter.id} does not support a thin-reference binding`);
      const content = read(resolve(pluginRoot, "templates/bindings", templateName(adapter.id, strategy)));
      writes.push(proposedWrite(realRoot, binding.workspaceSha256, adapter.bindingTarget, content, adapter.managedMarker));
    }
  }
  const identity = sha256(JSON.stringify({ workspace: basename(root), currentLevel, proposedLevel, strategy, hosts: hostIds, writes: writes.map(({ approvalSha256 }) => approvalSha256) })).slice(0, 20);
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
  } finally {
    closeSync(binding.descriptor);
  }
}
