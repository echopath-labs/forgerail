import { createHash, randomBytes } from "node:crypto";
import {
  closeSync,
  constants,
  existsSync,
  fchmodSync,
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
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { validateContract } from "./contracts.mjs";

const levels = ["plugin-only", "lightweight-adoption", "persisted-governance"];
const adoptionOperations = new Set(["create", "append-managed-block", "replace-managed-block"]);
const hostSelectionModes = new Set(["explicit", "all-detected", "all-available"]);
const portableRelativePath = /^(?![\\/])(?![a-zA-Z]:)(?!.*\/\/)(?!.*(?:^|\/)\.(?:\/|$))(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*(?:^|\/)[^/]*\.(?:\/|$))(?!.*(?:^|\/)(?:[Cc][Oo][Nn]|[Pp][Rr][Nn]|[Aa][Uu][Xx]|[Nn][Uu][Ll]|[Cc][Oo][Mm][1-9]|[Ll][Pp][Tt][1-9])(?:\.|\/|$))(?!.*\/$)[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;

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
  return value === "" || (
    !isAbsolute(value)
    && !/^[a-zA-Z]:/.test(value)
    && value !== ".."
    && !value.startsWith(`..${sep}`)
    && !value.startsWith("/")
  );
}

function portableTargetIdentity(path) {
  return path.normalize("NFC").toLowerCase();
}

function targetIdentitiesConflict(left, right) {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
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
  if (!adoptionOperations.has(snapshot.operation)) {
    throw new Error(`approved adoption operation is unsupported: ${snapshot.operation}`);
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

function verifyBoundAdoptionParentPath(workspaceBinding, parentBinding, path) {
  verifyBoundWorkspacePath(workspaceBinding);
  const retained = fstatSync(parentBinding.descriptor, { bigint: true });
  let current;
  try {
    current = lstatSync(parentBinding.path, { bigint: true });
  } catch {
    throw new Error(`approved adoption target parent identity changed during write: ${path}`);
  }
  const entered = lstatSync(".", { bigint: true });
  if (
    !retained.isDirectory()
    || current.isSymbolicLink()
    || !current.isDirectory()
    || !entered.isDirectory()
    || !sameFile(parentBinding.metadata, retained)
    || !sameFile(parentBinding.metadata, current)
    || !sameFile(parentBinding.metadata, entered)
    || !confined(workspaceBinding.root, parentBinding.path)
  ) {
    throw new Error(`approved adoption target parent identity changed during write: ${path}`);
  }
}

function withBoundAdoptionParent(root, path, workspaceMetadata, operation) {
  const parentPath = dirname(path);
  const segments = parentPath === "." ? [] : parentPath.split("/");
  const originalDirectory = process.cwd();
  const created = [];
  let operationError;
  let parentDescriptor;
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
    const boundParent = realpathSync(".");
    const observedParent = lstatSync(".", { bigint: true });
    parentDescriptor = openSync(
      ".",
      constants.O_RDONLY | constants.O_NOFOLLOW | (constants.O_DIRECTORY ?? 0),
    );
    const openedParent = fstatSync(parentDescriptor, { bigint: true });
    if (
      observedParent.isSymbolicLink()
      || !observedParent.isDirectory()
      || !openedParent.isDirectory()
      || !sameFile(observedParent, openedParent)
    ) {
      throw new Error(`approved adoption target parent identity changed before write: ${path}`);
    }
    return operation(basename(path), {
      path: boundParent,
      descriptor: parentDescriptor,
      metadata: openedParent,
    });
  } catch (error) {
    operationError = error;
    throw error;
  } finally {
    if (parentDescriptor !== undefined) closeSync(parentDescriptor);
    let restoreError;
    try { process.chdir(originalDirectory); }
    catch (error) { restoreError = error; }
    if (operationError !== undefined) removeCreatedParents(root, created);
    if (operationError === undefined && restoreError !== undefined) throw restoreError;
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
  const entries = [];
  const errors = [];
  for (const name of adapterFiles(pluginRoot)) {
    try { entries.push({ name, adapter: JSON.parse(read(resolve(pluginRoot, "adapters", name))) }); }
    catch { errors.push(`${name}: host adapter is not valid JSON`); }
  }
  const ids = new Set();
  const bindingTargets = new Map();
  for (const { name, adapter } of entries) {
    const validation = validateContract("host-adapter", adapter);
    if (!validation.valid) errors.push(...validation.errors.map((error) => `${adapter.id ?? name}: ${error}`));
    if (typeof adapter.id === "string") {
      if (ids.has(adapter.id)) errors.push(`duplicate host adapter: ${adapter.id}`);
      ids.add(adapter.id);
    }
    if (typeof adapter.bindingTarget === "string") {
      const targetIdentity = portableTargetIdentity(adapter.bindingTarget);
      const reservedIdentity = portableTargetIdentity("FORGERAIL.md");
      if (targetIdentitiesConflict(targetIdentity, reservedIdentity)) errors.push(`${adapter.id ?? name}: binding target conflicts with the reserved shared contract: ${adapter.bindingTarget}`);
      const collision = [...bindingTargets.entries()].find(([existing]) => targetIdentitiesConflict(targetIdentity, existing));
      if (collision) errors.push(`${adapter.id ?? name}: binding target conflicts with ${collision[1]}: ${adapter.bindingTarget}`);
      else bindingTargets.set(targetIdentity, adapter.id ?? name);
    }
    if (validation.valid) {
      for (const mode of adapter.bindingModes) {
        try {
          const content = readBindingTemplate(pluginRoot, adapter, mode);
          validateBindingTemplateMarkers(adapter, mode, content);
        }
        catch (error) { errors.push(`${adapter.id}: ${error.message}`); }
      }
    }
  }
  return { valid: errors.length === 0, errors, adapters: entries.map(({ adapter }) => adapter) };
}

function validateBindingTemplateMarkers(adapter, mode, content) {
  const start = `<!-- ${adapter.managedMarker}:start -->`;
  const end = `<!-- ${adapter.managedMarker}:end -->`;
  const startCount = countLiteralOccurrences(content, start);
  const endCount = countLiteralOccurrences(content, end);
  if (startCount !== 1 || endCount !== 1 || content.indexOf(start) > content.indexOf(end)) {
    throw new Error(`binding template for ${mode} must contain exactly one ordered ${adapter.managedMarker} boundary`);
  }
}

function readBindingTemplate(pluginRoot, adapter, mode) {
  const path = adapter.bindingTemplates?.[mode];
  if (typeof path !== "string" || !portableRelativePath.test(path)) {
    throw new Error(`binding template for ${mode} is missing or unsafe`);
  }
  const templateRoot = realpathSync(resolve(pluginRoot, "templates"));
  let cursor = templateRoot;
  const segments = path.split("/");
  for (const [index, segment] of segments.entries()) {
    const candidate = resolve(cursor, segment);
    if (!confined(templateRoot, candidate)) throw new Error(`binding template escapes template root: ${path}`);
    const metadata = linkAwareStat(candidate);
    if (metadata === null) throw new Error(`binding template does not exist: ${path}`);
    if (metadata.isSymbolicLink()) throw new Error(`binding template cannot traverse a symbolic link: ${path}`);
    const final = index === segments.length - 1;
    if (final && !metadata.isFile()) throw new Error(`binding template is not a regular file: ${path}`);
    if (!final && !metadata.isDirectory()) throw new Error(`binding template ancestor is not a directory: ${path}`);
    cursor = candidate;
  }
  let descriptor;
  try {
    const before = lstatSync(cursor);
    descriptor = openSync(cursor, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
    const opened = fstatSync(descriptor);
    const observed = realpathSync(cursor);
    const after = lstatSync(observed);
    if (!confined(templateRoot, observed) || after.isSymbolicLink() || !sameFile(after, opened)) throw new Error(`binding template escaped or changed before read: ${path}`);
    if (!opened.isFile() || !sameFile(before, opened)) throw new Error(`binding template identity changed before read: ${path}`);
    return readFileSync(descriptor, "utf8");
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function detectionTargetPresent(root, path) {
  let cursor = root;
  for (const segment of path.split("/")) {
    const candidate = resolve(cursor, segment);
    if (!confined(root, candidate)) throw new Error(`host detection target escapes workspace: ${path}`);
    const metadata = linkAwareStat(candidate);
    if (metadata === null) return false;
    if (metadata.isSymbolicLink()) return true;
    cursor = candidate;
  }
  return true;
}

function resolveHostSelection(root, adapters, hostIds, selectionMode) {
  if (!Array.isArray(hostIds)) throw new Error("host selection must be an array");
  if (new Set(hostIds).size !== hostIds.length) throw new Error("host selection contains duplicates");
  const mode = selectionMode ?? (hostIds.length > 0 ? "explicit" : "all-detected");
  if (!hostSelectionModes.has(mode)) throw new Error(`unknown host selection mode: ${mode}`);
  if (mode === "explicit" && hostIds.length === 0) throw new Error("explicit host selection requires at least one --host");
  if (mode !== "explicit" && hostIds.length > 0) throw new Error(`${mode} host selection cannot be combined with --host`);

  const byId = new Map(adapters.map((adapter) => [adapter.id, adapter]));
  let selected;
  if (mode === "explicit") {
    selected = hostIds.map((id) => {
      const adapter = byId.get(id);
      if (!adapter) throw new Error(`unknown host adapter: ${id}`);
      return adapter;
    });
  } else if (mode === "all-available") {
    selected = [...adapters];
  } else {
    selected = adapters.filter((adapter) => adapter.detectionTargets.some((path) => detectionTargetPresent(root, path)));
    if (selected.length === 0) {
      throw new Error("no registered host was detected; select an explicit --host or use --selection all-available");
    }
  }
  return {
    mode,
    selected,
  };
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

function countLiteralOccurrences(content, marker) {
  let count = 0;
  let offset = 0;
  while ((offset = content.indexOf(marker, offset)) >= 0) {
    count += 1;
    offset += marker.length;
  }
  return count;
}

function proposedWrite(workspace, workspaceSha256, path, content, managedMarker, unmanagedBindingPolicy = "append-managed-block") {
  const target = adoptionTarget(workspace, path);
  const exists = existsSync(target);
  if (exists && !statSync(target).isFile()) throw new Error(`adoption target is not a file: ${path}`);
  const prior = exists ? readAdoptionTarget(target, path) : null;
  const start = `<!-- ${managedMarker}:start -->`;
  const end = `<!-- ${managedMarker}:end -->`;
  const startCount = prior === null ? 0 : countLiteralOccurrences(prior, start);
  const endCount = prior === null ? 0 : countLiteralOccurrences(prior, end);
  const hasStart = startCount > 0;
  const hasEnd = endCount > 0;
  if (hasStart !== hasEnd) throw new Error(`adoption target has an incomplete managed marker: ${path}`);
  if (hasStart && prior.indexOf(start) > prior.indexOf(end)) throw new Error(`adoption target has reversed managed markers: ${path}`);
  if (startCount > 1 || endCount > 1) throw new Error(`adoption target has duplicate managed markers: ${path}`);
  if (exists && !hasStart && unmanagedBindingPolicy === "reject") {
    throw new Error(`Host binding target already exists without a ForgeRail managed marker: ${path}`);
  }
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

export function applyApprovedAdoptionWrite(workspace, write, approvedWriteDigest, testHooks = {}) {
  const binding = openBoundWorkspace(workspace);
  try {
    const { root } = binding;
    const approvedWrite = verifyApprovedWrite(write, approvedWriteDigest, binding.workspaceSha256);
    verifyBoundWorkspacePath(binding);
    const creating = approvedWrite.operation === "create";
    return withBoundAdoptionParent(root, approvedWrite.path, binding.metadata, (leaf, parentBinding) => {
    const boundParent = parentBinding.path;
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
      fchmodSync(temporaryDescriptor, mode);
      writeAll(temporaryDescriptor, content);
      fsyncSync(temporaryDescriptor);
      temporaryStat = fstatSync(temporaryDescriptor);
      closeSync(temporaryDescriptor);
      temporaryDescriptor = undefined;

      directoryDescriptor = openSync(".", constants.O_RDONLY);
      if (typeof testHooks.beforeInstall === "function") testHooks.beforeInstall();
      verifyBoundAdoptionParentPath(binding, parentBinding, approvedWrite.path);
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
        if (typeof testHooks.beforeReplace === "function") testHooks.beforeReplace();
        const installPathStat = lstatSync(leaf);
        if (installPathStat.isSymbolicLink() || !sameFile(sourceStat, installPathStat)) {
          throw new Error(`adoption target changed before atomic replace: ${approvedWrite.path}`);
        }
        renameSync(temporary, leaf);
        temporaryExists = false;
        replacementInstalled = true;
      }
      if (typeof testHooks.afterInstall === "function") testHooks.afterInstall();
      verifyBoundAdoptionParentPath(binding, parentBinding, approvedWrite.path);
      const installed = linkAwareStat(leaf);
      if (installed === null || installed.isSymbolicLink() || !sameFile(temporaryStat, installed)) {
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
      verifyBoundAdoptionParentPath(binding, parentBinding, approvedWrite.path);
      return { path: approvedWrite.path, contentSha256: sha256(content) };
    } catch (error) {
      if (replacementInstalled && backupExists) {
        try {
          const installed = linkAwareStat(leaf);
          if (installed === null) {
            renameSync(backup, leaf);
            backupExists = false;
            replacementInstalled = false;
          } else if (temporaryStat !== undefined && !installed.isSymbolicLink() && sameFile(temporaryStat, installed)) {
            renameSync(backup, leaf);
            backupExists = false;
            replacementInstalled = false;
          } else {
            preserveBackup = true;
          }
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
      if (preserveBackup && backup !== undefined && error instanceof Error) {
        const parent = dirname(approvedWrite.path);
        const recoveryPath = parent === "." ? backup : `${parent}/${backup}`;
        error.message = `${error.message}; recovery evidence retained at ${recoveryPath}`;
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

export function planAdoption(pluginRoot, workspace, hostIds = [], proposedLevel = "lightweight-adoption", selectionMode) {
  const root = resolve(workspace);
  if (!existsSync(root) || !statSync(root).isDirectory()) throw new Error("workspace must be an existing directory");
  const binding = openBoundWorkspace(root);
  const realRoot = binding.root;
  try {
  if (!levels.includes(proposedLevel)) throw new Error(`unknown adoption level: ${proposedLevel}`);
  if (proposedLevel === "persisted-governance") throw new Error("persisted-governance is evidence-gated and deferred in ForgeRail alpha.1");
  const registry = loadHostAdapters(pluginRoot);
  if (!registry.valid) throw new Error(`host adapter registry is invalid: ${registry.errors.join("; ")}`);
  const selection = resolveHostSelection(realRoot, registry.adapters, hostIds, selectionMode);
  const selected = selection.selected;
  const currentLevel = observeAdoptionLevel(realRoot, selected);
  if (currentLevel !== "plugin-only" && proposedLevel === "plugin-only") throw new Error("adoption removal or downgrade requires a separate reviewed plan and is not generated by alpha.1");
  if (currentLevel === "persisted-governance") throw new Error("persisted-governance was observed; alpha.1 will diagnose it but will not generate replacement or downgrade writes");
  const strategy = proposedLevel === "plugin-only"
    ? "no-change"
    : selected.length === 1 && selected[0].bindingModes.includes("managed-block")
      ? "single-host-managed-block"
      : "shared-contract-with-thin-bindings";
  const writes = [];
  if (strategy === "single-host-managed-block") {
    const adapter = selected[0];
    if (!adapter.bindingModes.includes("managed-block")) throw new Error(`${adapter.id} does not support a managed-block binding`);
    const content = readBindingTemplate(pluginRoot, adapter, "managed-block");
    writes.push(proposedWrite(realRoot, binding.workspaceSha256, adapter.bindingTarget, content, adapter.managedMarker, adapter.unmanagedBindingPolicy));
  } else if (strategy === "shared-contract-with-thin-bindings") {
    const contract = read(resolve(pluginRoot, "templates/FORGERAIL.md")).replace("{{HOSTS}}", selected.map((adapter) => adapter.displayName).join(", "));
    writes.push(proposedWrite(realRoot, binding.workspaceSha256, "FORGERAIL.md", contract, "forgerail:adoption-contract:v1"));
    for (const adapter of selected) {
      const content = readBindingTemplate(pluginRoot, adapter, "thin-reference");
      writes.push(proposedWrite(realRoot, binding.workspaceSha256, adapter.bindingTarget, content, adapter.managedMarker, adapter.unmanagedBindingPolicy));
    }
  }
  const selectedHosts = Object.fromEntries(selected.map((adapter) => [adapter.id, {
    status: adapter.status,
    bindingTarget: adapter.bindingTarget,
    verificationMode: adapter.verification.mode,
  }]));
  const identity = sha256(JSON.stringify({ workspace: basename(root), currentLevel, proposedLevel, strategy, hostSelection: { mode: selection.mode, hosts: selectedHosts }, writes: writes.map(({ approvalSha256 }) => approvalSha256) })).slice(0, 20);
  const plan = {
    schemaVersion: "1.0",
    planId: `adoption:${identity}`,
    workspace: basename(root),
    currentLevel,
    proposedLevel,
    strategy,
    hostSelection: {
      mode: selection.mode,
      hosts: selectedHosts,
    },
    evidence: [
      `Observed current adoption level: ${currentLevel}.`,
      `Host selection mode ${selection.mode} resolved adapters: ${selected.map((adapter) => adapter.id).join(", ")}.`,
      "ForgeRail alpha.1 does not generate persisted .forgerail state.",
    ],
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
