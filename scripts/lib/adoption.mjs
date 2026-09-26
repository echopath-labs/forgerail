import { createHash, randomBytes } from "node:crypto";
import {
  closeSync,
  constants,
  existsSync,
  fchmodSync,
  fstatSync,
  ftruncateSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { cursorSharedContractCoverageEvidence, cursorSharedCoreCoverageEvidence, validateContract } from "./contracts.mjs";
import { applicableCorePointer, applicableContractPointer } from "./instruction-pointers.mjs";
import { projectAdoptionObservation, assertNoProjectLifecycle, statIdentity } from "./project-state.mjs";
import { inspectBoundedPath } from "./bounded-read.mjs";

const levels = ["plugin-only", "lightweight-adoption", "persisted-governance"];
const adoptionOperations = new Set(["create", "append-managed-block", "replace-managed-block"]);
const hostSelectionModes = new Set(["explicit", "all-detected", "all-available"]);
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
// Fresh Cursor IDE Agent acceptance is limited to this exact Core tree.
const acceptedCursorIdeCoreSha256 = "00f8af0e805cd66a4fc034a35fc76ce9b0c4d1d235d511a12e49cb3b167574fc";
const portableRelativePath = /^(?![\\/])(?![a-zA-Z]:)(?!.*\/\/)(?!.*(?:^|\/)\.(?:\/|$))(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*(?:^|\/)[^/]*\.(?:\/|$))(?!.*(?:^|\/)(?:[Cc][Oo][Nn]|[Pp][Rr][Nn]|[Aa][Uu][Xx]|[Nn][Uu][Ll]|[Cc][Oo][Mm][1-9]|[Ll][Pp][Tt][1-9])(?:\.|\/|$))(?!.*\/$)[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function coreFiles(root, base) {
  const pending = [base];
  const files = [];
  let entries = 0;
  try {
    while (pending.length) {
      const path = pending.pop();
      if (++entries > 128 || inspectBoundedPath(root, path).state !== "available") return null;
      const metadata = lstatSync(resolve(root, path));
      if (metadata.isDirectory()) {
        for (const name of readdirSync(resolve(root, path))) pending.push(`${path}/${name}`);
      } else if (metadata.isFile()) files.push(path.slice(base.length + 1));
      else return null;
    }
    return files.sort();
  } catch { return null; }
}

function coreTreeDigest(root, base) {
  const files = coreFiles(root, base);
  if (!files?.includes("SKILL.md")) return null;
  try {
    const identities = [];
    for (const path of files) {
      const observed = inspectBoundedPath(root, `${base}/${path}`, { finalKind: "file", read: true });
      if (observed.state !== "available") return null;
      identities.push([path, sha256(observed.content)]);
    }
    return sha256(JSON.stringify(identities));
  } catch { return null; }
}

function matchingProjectCore(pluginRoot, workspace) {
  const source = coreTreeDigest(pluginRoot, "skills/forgerail");
  const project = coreTreeDigest(workspace, ".agents/skills/forgerail");
  return source !== null && source === project && source === acceptedCursorIdeCoreSha256 ? project : null;
}

export function hasMatchingCursorSharedCore(pluginRoot, workspace) {
  const instructions = inspectBoundedPath(workspace, "AGENTS.md", { finalKind: "file", read: true });
  return instructions.state === "available"
    && applicableCorePointer(instructions.content)
    && !inspectBoundedPath(workspace, ".cursor/skills/forgerail/SKILL.md", { finalKind: "file" }).present
    && !inspectBoundedPath(workspace, ".cursor/rules/forgerail.mdc", { finalKind: "file" }).present
    && matchingProjectCore(pluginRoot, workspace) !== null;
}

function verifyCursorCoverage(workspace, coverage, requiresContract = true, allowContractRecovery = false) {
  if (coverage === undefined) return;
  const instructions = inspectBoundedPath(workspace, "AGENTS.md", { finalKind: "file", read: true });
  const referencedContract = instructions.state === "available" && applicableContractPointer(instructions.content);
  const contract = referencedContract ? inspectBoundedPath(workspace, "FORGERAIL.md", { finalKind: "file", read: true }) : null;
  if (
    instructions.state !== "available"
    || sha256(instructions.content) !== coverage.agentsSha256
    || !applicableCorePointer(instructions.content)
    || (requiresContract && !applicableContractPointer(instructions.content))
    || (referencedContract && contract.state !== "available" && !allowContractRecovery)
    || coreTreeDigest(workspace, ".agents/skills/forgerail") !== coverage.coreSha256
    || coverage.sourceCoreSha256 !== acceptedCursorIdeCoreSha256
    || coreTreeDigest(packageRoot, "skills/forgerail") !== coverage.sourceCoreSha256
    || inspectBoundedPath(workspace, ".cursor/skills/forgerail/SKILL.md", { finalKind: "file" }).present
    || inspectBoundedPath(workspace, ".cursor/rules/forgerail.mdc", { finalKind: "file" }).present
  ) throw new Error("Cursor shared coverage changed before approved adoption write");
}

function verifyFinalCursorInstructions(path, content, coverage) {
  if (path === "AGENTS.md" && coverage !== undefined && (!applicableCorePointer(content) || !applicableContractPointer(content))) {
    throw new Error("final AGENTS.md would remove Cursor shared Core or contract coverage");
  }
}

export function verifyCursorNoChangePlan(workspace, plan) {
  const validation = validateContract("adoption-plan", plan);
  if (!validation.valid) throw new Error(`invalid adoption plan: ${validation.errors.join("; ")}`);
  if (plan.strategy !== "no-change" || plan.hostSelection.hosts.cursor?.status !== "supported") return;
  const binding = openBoundWorkspace(workspace);
  try {
    if (plan.cursorCoverage.workspaceSha256 !== binding.workspaceSha256) throw new Error("Cursor no-change plan belongs to a different workspace");
    verifyCursorCoverage(binding.root, plan.cursorCoverage, plan.evidence.includes(cursorSharedContractCoverageEvidence));
  } finally {
    closeSync(binding.descriptor);
  }
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
    ...(write.coverage === undefined ? {} : { coverage: Object.freeze({ ...write.coverage }) }),
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
    ...(write.coverage === undefined ? {} : { coverage: write.coverage }),
  };
}

export function adoptionWriteApprovalDigest(write) {
  return sha256(JSON.stringify(approvalBoundWrite(snapshotAdoptionWrite(write))));
}

function verifyApprovedWrite(write, approvedWriteDigest, workspaceSha256, operations = adoptionOperations) {
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
  if (!operations.has(snapshot.operation)) {
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
    if (!validation.valid) {
      errors.push(...validation.errors.map((error) => `${name}: ${error}`));
      continue;
    }
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
          readBindingTemplate(pluginRoot, adapter, mode);
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
  const managed = content.slice(content.indexOf(start) + start.length, content.indexOf(end));
  const recoveryStart = "<!-- forgerail:portable-recovery:v1:start -->";
  const recoveryEnd = "<!-- forgerail:portable-recovery:v1:end -->";
  const first = managed.indexOf(recoveryStart);
  const last = managed.indexOf(recoveryEnd);
  if (countLiteralOccurrences(content, recoveryStart) !== 1
    || countLiteralOccurrences(content, recoveryEnd) !== 1
    || first < 0 || last < first + recoveryStart.length
    || !managed.slice(first + recoveryStart.length, last).trim()) {
    throw new Error(`template for ${mode} must contain one non-empty portable recovery block inside its managed boundary`);
  }
  if (mode === "thin-reference" && !/(?<![A-Za-z0-9_./\\-])FORGERAIL\.md(?![A-Za-z0-9_./\\-])/.test(managed)) {
    throw new Error("thin-reference template must contain the shared contract reference FORGERAIL.md inside its managed block");
  }
}

function readBindingTemplate(pluginRoot, adapter, mode) {
  const path = adapter.bindingTemplates?.[mode];
  if (typeof path !== "string" || !portableRelativePath.test(path)) {
    throw new Error(`binding template for ${mode} is missing or unsafe`);
  }
  const content = readTemplate(pluginRoot, path);
  validateBindingTemplateMarkers(adapter, mode, content);
  return content;
}

function readTemplate(pluginRoot, path) {
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

function resolveHostSelection(root, pluginRoot, adapters, hostIds, selectionMode) {
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
    selected = adapters.filter((adapter) => adapter.detectionTargets.some((path) => detectionTargetPresent(root, path))
      || (adapter.id === "cursor" && hasMatchingCursorSharedCore(pluginRoot, root)));
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
  if (projectAdoptionObservation(root).adopted) return "lightweight-adoption";
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

function proposedWrite(workspace, workspaceSha256, path, content, managedMarker, unmanagedBindingPolicy = "append-managed-block", coverage) {
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
    ...(coverage === undefined ? {} : { coverage }),
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
  if (write.operation === "replace-file") return content;
  if (write.operation === "append-managed-block") return `${prior}${prior.length === 0 ? "" : prior.endsWith("\n\n") || prior.endsWith("\r\n\r\n") ? "" : prior.endsWith("\n") ? "\n" : "\n\n"}${content}`;
  const start = `<!-- ${write.managedMarker}:start -->`;
  const end = `<!-- ${write.managedMarker}:end -->`;
  if (countLiteralOccurrences(content, start) !== 1 || countLiteralOccurrences(content, end) !== 1 || content.indexOf(start) > content.indexOf(end)) {
    throw new Error(`approved content must contain exactly one ordered managed boundary for ${write.path}`);
  }
  const startIndex = prior.indexOf(start);
  const endIndex = prior.indexOf(end, startIndex);
  if (startIndex < 0 || endIndex < 0) throw new Error(`managed block is missing for ${write.path}`);
  // The existing suffix owns its newline; template trailing newlines do not.
  const managedEnd = content.indexOf(end) + end.length;
  return `${prior.slice(0, startIndex)}${content.slice(0, managedEnd)}${prior.slice(endIndex + end.length)}`;
}

function readSourceVersion(descriptor) {
  const before = fstatSync(descriptor);
  const bytes = Buffer.alloc(before.size);
  let offset = 0;
  while (offset < bytes.length) {
    const count = readSync(descriptor, bytes, offset, bytes.length - offset, offset);
    if (count === 0) throw new Error("adoption source changed during read");
    offset += count;
  }
  const after = fstatSync(descriptor);
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) throw new Error("adoption source changed during read");
  return { bytes, metadata: after };
}

function sourceMatches(version, baseline, digest, detached = false) {
  return version.metadata.size === baseline.size && version.metadata.mtimeMs === baseline.mtimeMs
    && (detached || version.metadata.ctimeMs === baseline.ctimeMs) && sha256(version.bytes) === digest;
}

function targetContentMatches(path, identity, content) {
  let descriptor;
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    if (!sameFile(fstatSync(descriptor), identity)) return false;
    return readSourceVersion(descriptor).bytes.equals(Buffer.from(content, "utf8"));
  } catch { return false; }
  finally { if (descriptor !== undefined) closeSync(descriptor); }
}

export function applyApprovedAdoptionWrite(workspace, write, approvedWriteDigest, testHooks = {}) {
  assertNoProjectLifecycle(workspace);
  return applyBoundWrite(workspace, write, approvedWriteDigest, testHooks, adoptionOperations);
}

function applyBoundWrite(workspace, write, approvedWriteDigest, testHooks, operations, expectedIdentity) {
  const binding = openBoundWorkspace(workspace);
  try {
    const { root } = binding;
    const approvedWrite = verifyApprovedWrite(write, approvedWriteDigest, binding.workspaceSha256, operations);
    verifyBoundWorkspacePath(binding);
    verifyCursorCoverage(root, approvedWrite.coverage, true, approvedWrite.path === "FORGERAIL.md");
    const creating = approvedWrite.operation === "create";
    return withBoundAdoptionParent(root, approvedWrite.path, binding.metadata, (leaf, parentBinding) => {
    const boundParent = parentBinding.path;
    if (!confined(root, boundParent)) throw new Error(`adoption target parent moved outside workspace: ${approvedWrite.path}`);
    const identity = randomBytes(12).toString("hex");
    const temporary = `.forgerail-${identity}.tmp`;
    let backup;
    let sourceDescriptor;
    let backupDescriptor;
    let lockDescriptor;
    let lockStat;
    const lockPath = `.forgerail-${sha256(approvedWrite.path).slice(0, 24)}.lock`;
    let temporaryDescriptor;
    let directoryDescriptor;
    let temporaryExists = false;
    let backupExists = false;
    let createdTarget = false;
    let replacementInstalled = false;
    let preserveBackup = false;
    let temporaryStat;
    let sourceStat;
    let originalBytes;
    let content;
    const sourceRecovery = `.forgerail-${identity}.source`;
    let sourceRecoveryExists = false;
    let preserveSourceRecovery = false;
    const refreshRecovery = () => {
      const latest = readSourceVersion(sourceDescriptor);
      if (sourceMatches(latest, sourceStat, approvedWrite.baseSha256, true)) return false;
      ftruncateSync(backupDescriptor, 0);
      let offset = 0;
      while (offset < latest.bytes.length) {
        const count = writeSync(backupDescriptor, latest.bytes, offset, latest.bytes.length - offset, offset);
        if (count <= 0) throw new Error("adoption recovery write made no progress");
        offset += count;
      }
      fsyncSync(backupDescriptor);
      return true;
    };
    try {
      try {
        lockDescriptor = openSync(lockPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      } catch (error) {
        if (error.code === "EEXIST") throw new Error(`adoption target is locked; inspect an in-progress or interrupted write: ${approvedWrite.path}`);
        throw error;
      }
      lockStat = fstatSync(lockDescriptor);
      writeAll(lockDescriptor, JSON.stringify({ pid: process.pid, path: approvedWrite.path, approvalSha256: approvedWriteDigest }));
      fsyncSync(lockDescriptor);
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
        if (expectedIdentity !== undefined && JSON.stringify(statIdentity(fstatSync(sourceDescriptor, { bigint: true }))) !== JSON.stringify(expectedIdentity)) throw new Error(`target ownership changed: ${approvedWrite.path}`);
        if (!sourceStat.isFile() || pathStat.isSymbolicLink() || !sameFile(sourceStat, pathStat)) {
          throw new Error(`adoption target changed before write: ${approvedWrite.path}`);
        }
        const observed = realpathSync(leaf);
        if (!confined(root, observed)) throw new Error(`adoption target escapes workspace before write: ${approvedWrite.path}`);
        const source = readSourceVersion(sourceDescriptor);
        sourceStat = source.metadata;
        originalBytes = source.bytes;
        const current = originalBytes.toString("utf8");
        if (!Buffer.from(current, "utf8").equals(originalBytes)) throw new Error(`adoption target is not valid UTF-8: ${approvedWrite.path}`);
        content = renderApprovedWriteContent(approvedWrite, current);
        verifyFinalCursorInstructions(approvedWrite.path, content, approvedWrite.coverage);
        if (content === current) {
          verifyBoundAdoptionParentPath(binding, parentBinding, approvedWrite.path);
          verifyCursorCoverage(root, approvedWrite.coverage, true, approvedWrite.path === "FORGERAIL.md");
          if (!targetContentMatches(leaf, sourceStat, current)) throw new Error(`adoption source drifted before no-op: ${approvedWrite.path}`);
          return { path: approvedWrite.path, contentSha256: sha256(content), unchanged: true };
        }
      }

      verifyFinalCursorInstructions(approvedWrite.path, content, approvedWrite.coverage);

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
      verifyCursorCoverage(root, approvedWrite.coverage, true, approvedWrite.path === "FORGERAIL.md");
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
        // An independent snapshot must not share edits to the original inode.
        backupDescriptor = openSync(backup, constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, mode);
        backupExists = true;
        fchmodSync(backupDescriptor, mode);
        writeAll(backupDescriptor, originalBytes);
        fsyncSync(backupDescriptor);
        // Keep the original inode reachable if a late edit cannot be snapshotted.
        linkSync(leaf, sourceRecovery);
        sourceRecoveryExists = true;
        if (!sameFile(lstatSync(sourceRecovery), sourceStat)) throw new Error(`adoption target changed while preparing recovery: ${approvedWrite.path}`);
        sourceStat = fstatSync(sourceDescriptor); // Our hard link changes ctime.
        fsyncSync(directoryDescriptor);
        const beforeReplace = lstatSync(leaf);
        if (beforeReplace.isSymbolicLink() || !sameFile(sourceStat, beforeReplace)) {
          throw new Error(`adoption target changed before atomic replace: ${approvedWrite.path}`);
        }
        if (typeof testHooks.beforeReplace === "function") testHooks.beforeReplace();
        verifyCursorCoverage(root, approvedWrite.coverage);
        const installPathStat = lstatSync(leaf);
        if (installPathStat.isSymbolicLink() || !sameFile(sourceStat, installPathStat)) {
          throw new Error(`adoption target changed before atomic replace: ${approvedWrite.path}`);
        }
        if (!sourceMatches(readSourceVersion(sourceDescriptor), sourceStat, approvedWrite.baseSha256)) throw new Error(`adoption source drifted before replace: ${approvedWrite.path}`);
        const checkedPath = lstatSync(leaf);
        if (checkedPath.isSymbolicLink() || !sameFile(sourceStat, checkedPath)) throw new Error(`adoption target changed before atomic replace: ${approvedWrite.path}`);
        renameSync(temporary, leaf);
        temporaryExists = false;
        replacementInstalled = true;
      }
      if (typeof testHooks.afterInstall === "function") testHooks.afterInstall();
      if (!creating) {
        // Our rename detaches the old inode and itself changes ctime/link count.
        if (refreshRecovery()) {
          throw new Error(`adoption source drifted during replace: ${approvedWrite.path}`);
        }
      }
      verifyBoundAdoptionParentPath(binding, parentBinding, approvedWrite.path);
      const installed = linkAwareStat(leaf);
      if (installed === null || installed.isSymbolicLink() || !sameFile(temporaryStat, installed)) {
        throw new Error(`adoption target identity mismatch after write: ${approvedWrite.path}`);
      }
      if (!targetContentMatches(leaf, temporaryStat, content)) throw new Error(`adoption target content changed after write: ${approvedWrite.path}`);
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
      const installedIdentity = lstatSync(leaf, { bigint: true });
      if (String(installedIdentity.dev) !== String(temporaryStat.dev) || String(installedIdentity.ino) !== String(temporaryStat.ino)) throw new Error(`installed ownership changed: ${approvedWrite.path}`);
      return { path: approvedWrite.path, contentSha256: sha256(content), identity: statIdentity(installedIdentity) };
    } catch (error) {
      if (replacementInstalled && backupExists) {
        try {
          // Hooks and OS errors can fail before the normal post-install check.
          try { refreshRecovery(); }
          catch (recoveryError) {
            preserveSourceRecovery = sourceRecoveryExists;
            preserveBackup = true;
            throw recoveryError;
          }
          const installed = linkAwareStat(leaf);
          if (installed === null) {
            renameSync(backup, leaf);
            backupExists = false;
            replacementInstalled = false;
          } else if (temporaryStat !== undefined && !installed.isSymbolicLink() && sameFile(temporaryStat, installed) && targetContentMatches(leaf, temporaryStat, content)) {
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
          if (temporaryStat !== undefined && sameFile(temporaryStat, installed) && targetContentMatches(leaf, temporaryStat, content)) unlinkSync(leaf);
        } catch {}
      }
      if (preserveBackup && backup !== undefined && error instanceof Error) {
        const parent = dirname(approvedWrite.path);
        const recoveryPath = parent === "." ? backup : `${parent}/${backup}`;
        error.message = `${error.message}; recovery evidence retained at ${recoveryPath}`;
      }
      if (preserveSourceRecovery && error instanceof Error) error.message += `; original source retained at ${resolve(boundParent, sourceRecovery)}`;
      throw error;
    } finally {
      if (sourceDescriptor !== undefined) closeSync(sourceDescriptor);
      if (backupDescriptor !== undefined) closeSync(backupDescriptor);
      if (temporaryDescriptor !== undefined) closeSync(temporaryDescriptor);
      if (directoryDescriptor !== undefined) closeSync(directoryDescriptor);
      if (temporaryExists) {
        try { unlinkSync(temporary); } catch {}
      }
      if (backupExists && !preserveBackup) {
        try { unlinkSync(backup); } catch {}
      }
      if (sourceRecoveryExists && !preserveSourceRecovery) {
        try { unlinkSync(sourceRecovery); } catch {}
      }
      if (lockDescriptor !== undefined) {
        closeSync(lockDescriptor);
        const currentLock = linkAwareStat(lockPath);
        if (currentLock !== null && !currentLock.isSymbolicLink() && sameFile(lockStat, currentLock)) unlinkSync(lockPath);
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
  assertNoProjectLifecycle(realRoot);
  if (!levels.includes(proposedLevel)) throw new Error(`unknown adoption level: ${proposedLevel}`);
  if (proposedLevel === "persisted-governance") throw new Error("persisted-governance is evidence-gated and deferred in ForgeRail alpha.1");
  const registry = loadHostAdapters(pluginRoot);
  if (!registry.valid) throw new Error(`host adapter registry is invalid: ${registry.errors.join("; ")}`);
  const selection = resolveHostSelection(realRoot, pluginRoot, registry.adapters, hostIds, selectionMode);
  const selected = selection.selected;
  let selectedLevel = observeAdoptionLevel(realRoot, selected);
  let currentLevel = selectedLevel;
  const unselectedEvidence = [];
  const cursorEvidence = [];
  let cursorRuleCovered = false;
  let cursorExistingRule = false;
  let cursorCoverage;
  if (selected.some(({ id }) => id === "cursor")) {
    const instructions = inspectBoundedPath(realRoot, "AGENTS.md", { finalKind: "file", read: true });
    const core = inspectBoundedPath(realRoot, ".agents/skills/forgerail/SKILL.md", { finalKind: "file" });
    const cursorLocalCore = inspectBoundedPath(realRoot, ".cursor/skills/forgerail/SKILL.md", { finalKind: "file" });
    const existingRule = inspectBoundedPath(realRoot, ".cursor/rules/forgerail.mdc", { finalKind: "file", read: true });
    const contract = inspectBoundedPath(realRoot, "FORGERAIL.md", { finalKind: "file", read: true });
    cursorExistingRule = existingRule.present;
    const sharedPointer = instructions.state === "available" && applicableCorePointer(instructions.content);
    const contractPointer = instructions.state === "available" && applicableContractPointer(instructions.content);
    const coreDigest = sharedPointer && core.state === "available" && !cursorLocalCore.present ? matchingProjectCore(pluginRoot, realRoot) : null;
    if (cursorLocalCore.present) cursorEvidence.push(`A competing Cursor-local ForgeRail Core Skill at .cursor/skills/forgerail/SKILL.md is ${cursorLocalCore.state}; resolve its owner before treating shared Core coverage as verified. A Cursor Rule cannot resolve two same-name Skills.`);
    if (coreDigest !== null) {
      selectedLevel = "lightweight-adoption";
      currentLevel = "lightweight-adoption";
      cursorRuleCovered = (selected.length === 1 ? !contractPointer || contract.state === "available" : contractPointer) && (!cursorExistingRule || selected.length === 1);
      const codex = selected.find(({ id }) => id === "codex");
      if (cursorRuleCovered && codex) {
        const codexWrite = proposedWrite(realRoot, binding.workspaceSha256, codex.bindingTarget,
          readBindingTemplate(pluginRoot, codex, "thin-reference"), codex.managedMarker, codex.unmanagedBindingPolicy);
        const finalInstructions = renderProposedWrite(realRoot, codexWrite);
        if (!applicableCorePointer(finalInstructions) || !applicableContractPointer(finalInstructions)) {
          cursorRuleCovered = false;
          cursorEvidence.push("The selected Codex binding would replace the only shared Core or contract pointer in AGENTS.md; retain a Cursor Rule for the resulting workspace.");
        }
      }
      if (cursorRuleCovered && !cursorExistingRule) cursorCoverage = { workspaceSha256: binding.workspaceSha256, agentsSha256: sha256(instructions.content), coreSha256: coreDigest, sourceCoreSha256: coreDigest };
      if (cursorRuleCovered && !cursorExistingRule) cursorEvidence.push(selected.length === 1 ? cursorSharedCoreCoverageEvidence : cursorSharedContractCoverageEvidence);
      else if (cursorExistingRule) cursorEvidence.push("An existing Cursor Rule remains a separate, unverified instruction owner; do not claim the shared-Core-only IDE acceptance for this workspace.");
      else if (selected.length === 1 && contractPointer && contract.state !== "available") cursorEvidence.push(`AGENTS.md requires FORGERAIL.md, but that contract is ${contract.state}; recover the referenced contract before certifying a no-change Cursor route.`);
      else if (!applicableContractPointer(instructions.content)) cursorEvidence.push("The existing AGENTS.md Core pointer does not reference FORGERAIL.md; a Cursor Rule is needed to expose the new shared contract to Cursor.");
      cursorEvidence.push(`Project-local ForgeRail Core tree matches the package source; SHA-256: ${coreDigest}.`);
    } else if (sharedPointer) {
      cursorEvidence.push(`Existing AGENTS.md references the project-local ForgeRail Core Skill; Skill path is ${core.state}, but the complete Core does not match the package source or accepted Cursor IDE evidence. Review the Core owner before approving a Cursor Rule.`);
    } else if (instructions.state === "available" && /forgerail/i.test(instructions.content)) {
      cursorEvidence.push("Existing AGENTS.md mentions ForgeRail without the expected project-local Core pointer; review its workflow owner and references before approving a Cursor Rule.");
    } else if (instructions.present && instructions.state !== "available") {
      cursorEvidence.push(`Existing AGENTS.md is ${instructions.state}; inspect it before approving a Cursor Rule to avoid competing instruction owners.`);
    }
    if (core.state !== "available") {
      cursorEvidence.push(`Project-local ForgeRail Core Skill is ${core.state}; a Cursor Rule cannot activate the Core until the Skill is installed and verified.`);
    }
    if (existingRule.present) {
      cursorEvidence.push(`Existing Cursor Rule at .cursor/rules/forgerail.mdc is ${existingRule.state}; review its instruction ownership and coexistence with AGENTS.md. This plan does not remove or replace it implicitly.`);
    }
  }
  const selectedIds = new Set(selected.map(({ id }) => id));
  for (const adapter of registry.adapters.filter(({ id }) => !selectedIds.has(id))) {
    const inspected = inspectBoundedPath(realRoot, adapter.bindingTarget, { finalKind: "file", read: true });
    if (inspected.state === "available" && inspected.content.includes(`<!-- ${adapter.managedMarker}:start -->`)) {
      if (currentLevel === "plugin-only") currentLevel = "lightweight-adoption";
      unselectedEvidence.push(`Unselected managed binding retained: ${adapter.bindingTarget}. This plan does not migrate or consolidate its rules into the selected hosts' contract; review coexistence before approval.`);
    } else if (inspected.present && inspected.state !== "available") {
      unselectedEvidence.push(`Unselected binding unavailable: ${adapter.bindingTarget} (${inspected.state}). Adoption level reflects only readable evidence; this entry is not followed, changed or a selected-host blocker.`);
    }
  }
  if (selectedLevel !== "plugin-only" && proposedLevel === "plugin-only") throw new Error("adoption removal or downgrade requires a separate reviewed plan and is not generated by alpha.1");
  if (currentLevel === "persisted-governance") throw new Error("persisted-governance was observed; alpha.1 will diagnose it but will not generate replacement or downgrade writes");
  const cursorOnlyCovered = selected.length === 1 && selected[0].id === "cursor" && cursorRuleCovered;
  if (cursorOnlyCovered && proposedLevel !== "plugin-only") {
    cursorEvidence.push("Cursor is the only selected host and existing project instructions cover its Core; no new FORGERAIL.md or Cursor Rule is needed. Verify activation in a new Cursor task, then use unchanged AGENTS.md as the effective Host Binding Receipt target.");
  }
  const strategy = proposedLevel === "plugin-only" || cursorOnlyCovered
    ? "no-change"
    : selected.length === 1 && selected[0].bindingModes.includes("managed-block")
      ? "single-host-managed-block"
      : "shared-contract-with-thin-bindings";
  const writes = [];
  const writeCursorCoverage = cursorCoverage === undefined ? undefined : {
    agentsSha256: cursorCoverage.agentsSha256,
    coreSha256: cursorCoverage.coreSha256,
    sourceCoreSha256: cursorCoverage.sourceCoreSha256,
  };
  if (strategy === "single-host-managed-block") {
    const adapter = selected[0];
    if (!adapter.bindingModes.includes("managed-block")) throw new Error(`${adapter.id} does not support a managed-block binding`);
    const content = readBindingTemplate(pluginRoot, adapter, "managed-block");
    writes.push(proposedWrite(realRoot, binding.workspaceSha256, adapter.bindingTarget, content, adapter.managedMarker, adapter.unmanagedBindingPolicy));
  } else if (strategy === "shared-contract-with-thin-bindings") {
    const contract = readTemplate(pluginRoot, "FORGERAIL.md").replace("{{HOSTS}}", selected.map((adapter) => adapter.displayName).join(", "));
    validateBindingTemplateMarkers({ managedMarker: "forgerail:adoption-contract:v1" }, "shared-contract", contract);
    writes.push(proposedWrite(realRoot, binding.workspaceSha256, "FORGERAIL.md", contract, "forgerail:adoption-contract:v1", undefined, writeCursorCoverage));
    const bindingAdapters = cursorCoverage === undefined ? selected : [...selected].sort((left, right) => Number(left.bindingTarget === "AGENTS.md") - Number(right.bindingTarget === "AGENTS.md"));
    for (const adapter of bindingAdapters) {
      if (cursorRuleCovered && adapter.id === "cursor") continue;
      const content = readBindingTemplate(pluginRoot, adapter, "thin-reference");
      writes.push(proposedWrite(realRoot, binding.workspaceSha256, adapter.bindingTarget, content, adapter.managedMarker, adapter.unmanagedBindingPolicy, writeCursorCoverage));
    }
  }
  const selectedHosts = Object.fromEntries(selected.map((adapter) => [adapter.id, {
    status: adapter.id === "cursor" && (!cursorRuleCovered || cursorExistingRule) ? "profile-only" : adapter.status,
    bindingTarget: adapter.bindingTarget,
    verificationMode: adapter.id === "cursor" && (!cursorRuleCovered || cursorExistingRule || adapter.status !== "supported") ? "profile-only" : adapter.verification.mode,
  }]));
  const identity = sha256(JSON.stringify({ workspace: basename(root), currentLevel, proposedLevel, strategy, hostSelection: { mode: selection.mode, hosts: selectedHosts }, cursorCoverage: cursorCoverage === undefined ? null : [cursorCoverage.workspaceSha256, cursorCoverage.agentsSha256, cursorCoverage.coreSha256, cursorCoverage.sourceCoreSha256], writes: writes.map(({ approvalSha256 }) => approvalSha256) })).slice(0, 20);
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
      ...unselectedEvidence,
      ...cursorEvidence,
      "ForgeRail alpha.1 does not generate persisted .forgerail state.",
    ],
    ...(cursorCoverage !== undefined && (strategy === "no-change" || strategy === "shared-contract-with-thin-bindings")
      ? { cursorCoverage: { ...cursorCoverage, agentsContent: inspectBoundedPath(realRoot, "AGENTS.md", { finalKind: "file", read: true }).content } }
      : {}),
    proposedWrites: writes,
    requiredConfirmation: true,
    verification: selected.map((adapter) => selectedHosts[adapter.id].status === "supported"
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

// Lifecycle-only primitives. The public v1 writer retains its original operation set.
export function adoptionWorkspaceIdentity(workspace) {
  const binding = openBoundWorkspace(workspace);
  try { return binding.workspaceSha256; }
  finally { closeSync(binding.descriptor); }
}

export function applyProjectFile(workspace, path, before, after, testHooks = {}, expectedWorkspaceSha256 = adoptionWorkspaceIdentity(workspace), expectedIdentity) {
  adoptionTarget(workspace, path);
  if (after === null) return removeProjectFile(workspace, path, before, testHooks, expectedWorkspaceSha256, expectedIdentity);
  const write = {
    workspaceSha256: expectedWorkspaceSha256, path,
    operation: before === null ? "create" : "replace-file",
    baseSha256: before === null ? null : sha256(before), content: after,
    contentSha256: sha256(after), managedMarker: null,
  };
  write.approvalSha256 = adoptionWriteApprovalDigest(write);
  return applyBoundWrite(workspace, write, write.approvalSha256, testHooks, new Set(["create", "replace-file"]), expectedIdentity);
}

function removeProjectFile(workspace, path, before, hooks, expectedWorkspaceSha256, expectedIdentity) {
  if (typeof before !== "string") throw new Error("removal requires a known baseline");
  const binding = openBoundWorkspace(workspace);
  try {
    if (binding.workspaceSha256 !== expectedWorkspaceSha256) throw new Error("project workspace identity changed");
    return withBoundAdoptionParent(binding.root, path, binding.metadata, (leaf, parent) => {
      const lock = `.forgerail-${sha256(path).slice(0, 24)}.lock`;
      const fd = openSync(lock, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      const lockStat = fstatSync(fd);
      const recovery = `.forgerail-${randomBytes(12).toString("hex")}.removed`;
      let moved = false;
      try {
        const original = lstatSync(leaf);
        if (!original.isFile() || original.isSymbolicLink() || !targetContentMatches(leaf, original, before)) throw new Error(`removal baseline drift: ${path}`);
        hooks.beforeRemove?.();
        verifyBoundAdoptionParentPath(binding, parent, path);
        if (!targetContentMatches(leaf, original, before)) throw new Error(`removal baseline drift: ${path}`);
        if (expectedIdentity !== undefined && JSON.stringify(statIdentity(lstatSync(leaf, { bigint: true }))) !== JSON.stringify(expectedIdentity)) throw new Error(`removal ownership changed: ${path}`);
        renameSync(leaf, recovery);
        moved = true;
        if (!targetContentMatches(recovery, original, before)) throw new Error(`removal changed during rename: ${path}`);
        hooks.afterRemove?.();
        verifyBoundAdoptionParentPath(binding, parent, path);
        if (linkAwareStat(leaf) !== null || !targetContentMatches(recovery, original, before)) throw new Error(`removal changed after rename: ${path}`);
        fsyncSync(parent.descriptor);
        unlinkSync(recovery);
        moved = false;
        fsyncSync(parent.descriptor);
        return { path, removed: true, identity: null };
      } catch (error) {
        if (moved) {
          try {
            // Exclusive linking restores without overwriting a concurrent new file.
            linkSync(recovery, leaf);
            unlinkSync(recovery);
            moved = false;
          } catch {}
          if (moved) error.message += `; recovery retained: ${dirname(path)}/${recovery}`;
        }
        throw error;
      } finally {
        closeSync(fd);
        const current = linkAwareStat(lock);
        if (current && !current.isSymbolicLink() && sameFile(current, lockStat)) unlinkSync(lock);
      }
    });
  } finally { closeSync(binding.descriptor); }
}

export function withProjectOperationLock(workspace, operation) {
  const binding = openBoundWorkspace(workspace);
  try {
    return withBoundAdoptionParent(binding.root, ".forgerail-operation.lock", binding.metadata, (leaf, parent) => {
      const fd = openSync(leaf, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      const identity = fstatSync(fd);
      try {
        writeAll(fd, JSON.stringify({ pid: process.pid, workspaceSha256: binding.workspaceSha256 }));
        fsyncSync(fd);
        fsyncSync(parent.descriptor);
        verifyBoundAdoptionParentPath(binding, parent, leaf);
        const result = operation();
        verifyBoundAdoptionParentPath(binding, parent, leaf);
        return result;
      } finally {
        closeSync(fd);
        const current = linkAwareStat(leaf);
        if (current && !current.isSymbolicLink() && sameFile(current, identity)) unlinkSync(leaf);
      }
    });
  } finally { closeSync(binding.descriptor); }
}
