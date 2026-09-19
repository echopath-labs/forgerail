import { lstatSync, readdirSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { adoptionWorkspaceIdentity, applyProjectFile, withProjectOperationLock } from "./adoption.mjs";
import { CONFIG, MANIFEST, JOURNAL, LOCK, marker, hash, json, digest, exact, ownedArtifact, versionPattern, readProjectFile, validateConfig, validateManifest, managedBlock, readInstallation, installationDrift, projectAdoptionObservation, residualWriteEvidence, projectFileLimit, projectFileIdentity, hasLegacyBinding } from "./project-state.mjs";

function delivery(pluginRoot) {
  const adapter = JSON.parse(readProjectFile(pluginRoot, "adapters/project/codex.json"));
  exact(adapter, ["schemaVersion", "host", "skillRoot", "vendorRoot", "bindingTarget", "managedMarker", "skills", "activationBoundary"], "project delivery adapter");
  if (adapter.schemaVersion !== "1.0" || adapter.host !== "codex" || adapter.skillRoot !== ".agents/skills" || adapter.vendorRoot !== ".agents/vendor/forgerail" || adapter.bindingTarget !== "AGENTS.md" || adapter.managedMarker !== marker || adapter.activationBoundary !== "new-task-required" || JSON.stringify(adapter.skills) !== JSON.stringify(["architecture-convergence-audit", "forgerail", "forgerail-workspace-diagnosis", "workspace-health-review"])) throw new Error("unsupported project delivery adapter");
  return adapter;
}
function sourceBundle(pluginRoot, legacyAdapter = null) {
  const pkgText = readProjectFile(pluginRoot, "package.json"), pkg = JSON.parse(pkgText);
  if (pkg.name !== "@echopath-labs/forgerail" || !versionPattern.test(pkg.version)) throw new Error("invalid ForgeRail package identity");
  const adapter = legacyAdapter ?? delivery(pluginRoot), files = new Map(), sources = { "package.json": hash(pkgText) };
  let size = 0;
  function collect(path) {
    if (Object.keys(sources).length > 1024) throw new Error("source inventory exceeds limit");
    const meta = lstatSync(resolve(pluginRoot, path));
    if (meta.isSymbolicLink()) throw new Error(`source symbolic link: ${path}`);
    if (meta.isDirectory()) {
      for (const entry of readdirSync(resolve(pluginRoot, path)).sort()) collect(`${path}/${entry}`);
      return;
    }
    const content = readProjectFile(pluginRoot, path);
    size += Buffer.byteLength(content);
    if (size > 16 * 1024 * 1024) throw new Error("source content exceeds limit");
    sources[path] = hash(content);
    if (path.startsWith("skills/")) files.set(`${adapter.skillRoot}/${path.slice(7)}`, content);
  }
  for (const skill of adapter.skills) collect(`skills/${skill}`);
  for (const name of ["LICENSE", "NOTICE"]) { collect(name); files.set(`${adapter.vendorRoot}/${pkg.version}/${name}`, readProjectFile(pluginRoot, name)); }
  // Bind the executing implementation and adapter, not just the generated Skill text.
  collect("scripts/forgerail.mjs");
  collect("scripts/lib");
  if (!legacyAdapter || readProjectFile(pluginRoot, "adapters/project/codex.json") !== null) collect("adapters/project/codex.json");
  const block = `<!-- ${marker}:start -->\n## ForgeRail project governance\n\nUse [ForgeRail](.agents/skills/forgerail/SKILL.md) for non-trivial engineering tasks.\nRead the installed project Skill and its applicable references. Respect existing project rules and user authorization.\nProject adoption is recorded in .forgerail/config.json and .forgerail/installation.json.\nMissing or changed managed content requires diagnosis; do not silently substitute development sources or global Skills.\nUse project-local architecture-convergence-audit, forgerail-workspace-diagnosis and workspace-health-review only at their triggers.\nCLI installation, project adoption, host discovery and behavior verification are distinct.\n<!-- ${marker}:end -->`;
  files.set(adapter.bindingTarget, block);
  const source = { package: pkg.name, version: pkg.version, kind: "package-content", sha256: hash(json(sources)) };
  const manifest = { schemaVersion: "1.0", host: adapter.host, source, artifacts: [...files].map(([path, content]) => ({ path, ownership: path === adapter.bindingTarget ? "managed-block" : "file", sha256: hash(content) })).sort((a, b) => a.path.localeCompare(b.path, "en")) };
  validateManifest(manifest);
  return { adapter, files, manifest };
}
function blockAfter(before, replacement) {
  const old = managedBlock(before);
  if (old !== null) return before.replace(old, () => replacement ?? "");
  if (replacement === null) throw new Error("owned binding block missing");
  // Every added byte is inside the managed markers; user separators stay untouched.
  return `${before ?? ""}${replacement}`;
}
function operation(path, before, after) { return { path, before, after, beforeSha256: digest(before), afterSha256: digest(after) }; }
function compareVersions(a, b) {
  const parse = (v) => v.split(/[.-]/);
  const x = parse(a), y = parse(b);
  for (let i = 0; i < 3; i++) { const d = Number(x[i]) - Number(y[i]); if (d) return Math.sign(d); }
  if (a === b) return 0;
  if (x.length === 3) return 1;
  if (y.length === 3) return -1;
  throw new Error("prerelease ordering requires an explicit separately reviewed migration");
}
export function doctorProject(pluginRoot, workspace) {
  const root = realpathSync(workspace), observation = projectAdoptionObservation(root);
  let cliVersion = null, sourceError = null;
  try { cliVersion = sourceBundle(pluginRoot).manifest.source.version; } catch (error) { sourceError = error.message; }
  let installedVersion = null;
  try { installedVersion = readInstallation(root).manifest?.source.version ?? null; } catch {}
  let journal = null, lock = null;
  try { journal = readProjectFile(root, JOURNAL); } catch {}
  try { lock = readProjectFile(root, LOCK); } catch {}
  return { ...observation, valid: !sourceError && (observation.status === "ready" || observation.status === "not-adopted"), ...(sourceError ? { status: observation.status === "recovery-required" ? "recovery-required" : "source-unavailable", projectStatus: observation.status, errors: [sourceError] } : {}), cliVersion, installedVersion, readOnly: true, network: false, governanceLevel: observation.adopted ? "lightweight-adoption" : "plugin-only", hostDiscovery: "not-verified", behavior: "not-verified", lockDigest: lock === null ? null : hash(lock), recoveryDigest: journal === null ? null : hash(journal) };
}
export function planProject(pluginRoot, workspace, action, { legacyLock = null, legacySource = null } = {}) {
  if (!["init", "update", "remove"].includes(action)) throw new Error("unsupported project action");
  const root = realpathSync(workspace);
  if (readProjectFile(root, JOURNAL) !== null) throw new Error("recovery required before another project operation");
  const producer = sourceBundle(pluginRoot);
  if (legacySource && !legacyLock) throw new Error("legacy source requires an explicit source lock");
  const bundle = legacySource ? sourceBundle(realpathSync(legacySource), producer.adapter) : producer;
  const installed = readInstallation(root);
  const { manifest } = installed;
  if (action === "update" && !manifest) throw new Error("project is not adopted; use init");
  if (legacyLock && !/^docs\/[A-Za-z0-9._/-]+\.lock\.json$/.test(legacyLock)) throw new Error("legacy lock must be an explicit docs source lock");
  if (legacyLock && (action !== "init" || manifest)) throw new Error("legacy migration requires an unadopted init");
  if (manifest && installationDrift(root, manifest).length) throw new Error(`managed content drift: ${installationDrift(root, manifest).join(", ")}`);
  if (manifest && action !== "remove" && compareVersions(bundle.manifest.source.version, manifest.source.version) < 0) throw new Error("implicit downgrade refused");
  if (manifest && action === "init" && json(manifest.source) !== json(bundle.manifest.source)) throw new Error("already adopted with different content; use update");
  let legacy = null, legacyText = null;
  if (legacyLock) {
    legacyText = readProjectFile(root, legacyLock);
    if (legacyText === null) throw new Error("legacy source lock missing");
    legacy = JSON.parse(legacyText);
    exact(legacy, ["package", "version", "archiveSha256", "archiveIntegrity", "source", "files"], "legacy lock");
    if (legacy.package !== bundle.manifest.source.package || legacy.version !== bundle.manifest.source.version || !/^[a-f0-9]{64}$/.test(legacy.archiveSha256) || !/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(legacy.archiveIntegrity) || legacy.source !== `https://registry.npmjs.org/@echopath-labs/forgerail/-/forgerail-${legacy.version}.tgz` || !legacy.files || typeof legacy.files !== "object" || Array.isArray(legacy.files)) throw new Error("legacy identity cannot be migrated to this exact version");
    const expected = [...bundle.files.keys()].filter((p) => p !== "AGENTS.md").sort();
    if (JSON.stringify(Object.keys(legacy.files).sort()) !== JSON.stringify(expected)) throw new Error("legacy inventory does not match target package");
    for (const path of expected) if (legacy.files[path] !== hash(bundle.files.get(path)) || digest(readProjectFile(root, path)) !== legacy.files[path]) throw new Error(`legacy source mismatch: ${path}`);
  }
  const residual = residualWriteEvidence(root, [...bundle.files.keys(), ...(manifest?.artifacts.map((a) => a.path) ?? []), CONFIG, MANIFEST, ...(legacyLock ? [legacyLock] : [])]);
  if (residual.length) throw new Error(`inspect interrupted single-file recovery evidence: ${residual.join(", ")}`);
  const operations = [];
  const oldPaths = new Set(manifest?.artifacts.map((a) => a.path) ?? []);
  if (action === "remove") {
    if (manifest) for (const artifact of manifest.artifacts) {
      const before = readProjectFile(root, artifact.path);
      operations.push(operation(artifact.path, before, artifact.ownership === "managed-block" ? blockAfter(before, null) : null));
    }
  } else {
    for (const [path, text] of bundle.files) {
      const before = readProjectFile(root, path);
      if (path === "AGENTS.md") {
        if (!manifest && managedBlock(before) !== null) throw new Error("unowned project binding exists");
        // A legacy v1 binding is not this lifecycle's block and requires explicit reconciliation.
        if (!manifest && hasLegacyBinding(before)) throw new Error("legacy managed binding needs explicit reconciliation before init");
      } else if (before !== null && !oldPaths.has(path) && !legacy) throw new Error(`unknown same-name content cannot be taken over: ${path}`);
      operations.push(operation(path, before, path === "AGENTS.md" ? blockAfter(before, text) : text));
      oldPaths.delete(path);
    }
    for (const path of oldPaths) operations.push(operation(path, readProjectFile(root, path), null));
  }
  const config = json({ schemaVersion: "1.0", host: "codex" });
  operations.push(operation(CONFIG, installed.configText, action === "remove" ? null : installed.configText ?? config));
  // The prior lock is historical after migration, with no competing version fields.
  if (legacyLock) operations.push(operation(legacyLock, legacyText, json({ schemaVersion: "1.0", status: "historical", activeManifest: MANIFEST, previousLockSha256: hash(legacyText) })));
  operations.push(operation(MANIFEST, installed.manifestText, action === "remove" ? null : json(bundle.manifest)));
  const plan = { schemaVersion: "1.0", action, workspaceSha256: adoptionWorkspaceIdentity(root), source: producer.manifest.source, legacyLock, legacySourceSha256: legacySource ? hash(realpathSync(legacySource)) : null, operations, warnings: legacyLock ? ["Custom legacy AGENTS prose is preserved. Review the displayed full-file change for duplicate historical instructions."] : [], hostDiscovery: "not-verified" };
  const result = { ...plan, planSha256: hash(json(plan)), changes: operations.filter((op) => op.before !== op.after).length };
  verifyPlan(result);
  assertJournalCapacity(result);
  return result;
}
function verifyPlan(plan) {
  exact(plan, ["schemaVersion", "action", "workspaceSha256", "source", "legacyLock", "legacySourceSha256", "operations", "warnings", "hostDiscovery", "planSha256", "changes"], "project plan");
  const { planSha256, changes, ...bound } = plan;
  if (plan.hostDiscovery !== "not-verified" || !Array.isArray(plan.warnings) || !plan.warnings.every((warning) => typeof warning === "string")) throw new Error("invalid plan observation fields");
  exact(plan.source, ["package", "version", "kind", "sha256"], "plan source");
  if (plan.source.package !== "@echopath-labs/forgerail" || plan.source.kind !== "package-content" || !versionPattern.test(plan.source.version) || !/^[a-f0-9]{64}$/.test(plan.source.sha256)) throw new Error("invalid plan source");
  if (plan.legacySourceSha256 !== null && (!plan.legacyLock || !/^[a-f0-9]{64}$/.test(plan.legacySourceSha256))) throw new Error("invalid legacy source binding");
  if (plan.schemaVersion !== "1.0" || !["init", "update", "remove"].includes(plan.action) || hash(json(bound)) !== planSha256 || !/^[a-f0-9]{64}$/.test(plan.workspaceSha256) || !Array.isArray(plan.operations) || plan.operations.length > 520) throw new Error("invalid project plan identity");
  const seen = new Set();
  for (const op of plan.operations) {
    exact(op, ["path", "before", "after", "beforeSha256", "afterSha256"], "project operation");
    if (typeof op.path !== "string" || (!ownedArtifact(op.path) && ![CONFIG, MANIFEST, plan.legacyLock].includes(op.path)) || seen.has(op.path) || ![op.before, op.after].every((v) => v === null || typeof v === "string") || digest(op.before) !== op.beforeSha256 || digest(op.after) !== op.afterSha256) throw new Error("invalid project operation");
    seen.add(op.path);
    if (op.path === CONFIG) for (const content of [op.before, op.after]) if (content !== null) validateConfig(JSON.parse(content));
    if (op.path === MANIFEST) for (const content of [op.before, op.after]) if (content !== null) validateManifest(JSON.parse(content));
  }
  if (changes !== plan.operations.filter((op) => op.before !== op.after).length) throw new Error("invalid project change count");
  if (plan.legacyLock !== null && (typeof plan.legacyLock !== "string" || !/^docs\/[A-Za-z0-9._/-]+\.lock\.json$/.test(plan.legacyLock))) throw new Error("invalid legacy lock path");
  if (plan.operations.at(-1)?.path !== MANIFEST || !seen.has(CONFIG)) throw new Error("metadata commit order invalid");
}

const journalVersion = "1.1";
const identityKeys = ["device", "inode", "size", "mtimeNs", "ctimeNs"];
function validateIdentity(identity) {
  if (identity === null) return;
  exact(identity, identityKeys, "written file identity");
  if (!Object.values(identity).every((value) => typeof value === "string" && /^-?[0-9]{1,32}$/.test(value))) throw new Error("invalid written file identity");
}
function assertJournalCapacity(plan) {
  if (plan.changes === 0) return;
  // Reserve enough room for every durable completion receipt before writing anything.
  const maximumIdentity = Object.fromEntries(identityKeys.map((key) => [key, "-" + "9".repeat(32)]));
  const progress = plan.operations.map(() => ({ state: "completed", identity: maximumIdentity }));
  if (Buffer.byteLength(json({ schemaVersion: journalVersion, plan, progress }), "utf8") > projectFileLimit) throw new Error("project recovery journal exceeds 4 MiB capacity; no project files were changed");
}
export function applyProject(pluginRoot, workspace, action, approvedDigest, options = {}, hooks = {}) {
  const root = realpathSync(workspace);
  return withProjectOperationLock(root, () => {
    const plan = planProject(pluginRoot, root, action, options);
    if (approvedDigest !== plan.planSha256) throw new Error("stale or mismatched project plan digest");
    verifyPlan(plan);
    assertJournalCapacity(plan);
    if (!plan.changes) return { valid: true, status: "no-change", planSha256: plan.planSha256, hostDiscovery: "not-verified" };
    const state = { schemaVersion: journalVersion, plan, progress: plan.operations.map(() => null) };
    let journal = json(state);
    const write = (path, before, after, identity) => applyProjectFile(root, path, before, after, {}, plan.workspaceSha256, identity);
    write(JOURNAL, null, journal);
    function record(index, entry) {
      state.progress[index] = entry;
      const next = json(state);
      if (Buffer.byteLength(next, "utf8") > projectFileLimit) throw new Error("recovery journal capacity exceeded");
      write(JOURNAL, journal, next);
      journal = next;
    }
    try {
      for (const [index, op] of plan.operations.entries()) {
        hooks.beforeOperation?.(index, op);
        if (adoptionWorkspaceIdentity(root) !== plan.workspaceSha256) throw new Error("project workspace identity changed");
        for (const previous of plan.operations.slice(0, index)) if (readProjectFile(root, previous.path) !== previous.after) throw new Error(`completed target drift: ${previous.path}`);
        if (readProjectFile(root, op.path) !== op.before) throw new Error(`operation baseline changed: ${op.path}`);
        if (op.before !== op.after) {
          record(index, { state: "in-flight", identity: null });
          const result = write(op.path, op.before, op.after);
          hooks.afterOperation?.(index, op);
          const identity = result.identity;
          validateIdentity(identity);
          if (JSON.stringify(projectFileIdentity(root, op.path)) !== JSON.stringify(identity)) throw new Error(`completed target ownership changed: ${op.path}`);
          record(index, { state: "completed", identity });
        }
        if (readProjectFile(root, op.path) !== op.after) throw new Error(`operation verification failed: ${op.path}`);
        for (const previous of plan.operations.slice(0, index + 1)) if (readProjectFile(root, previous.path) !== previous.after) throw new Error(`completed target drift: ${previous.path}`);
      }
      write(JOURNAL, journal, null);
      return { valid: true, status: action === "remove" ? "removed" : "ready", planSha256: plan.planSha256, changedFiles: plan.changes, hostDiscovery: "not-verified", behavior: "not-verified" };
    } catch (error) { throw new Error(`${error.message}; recovery-required; run recover to inspect rollback plan`); }
  });
}
export function planRecovery(workspace) {
  const root = realpathSync(workspace), text = readProjectFile(root, JOURNAL);
  if (text === null) throw new Error("no recovery journal");
  const journal = JSON.parse(text);
  if (journal?.schemaVersion !== journalVersion) throw new Error("unsupported recovery journal; ownership receipts required for automatic rollback");
  exact(journal, ["schemaVersion", "plan", "progress"], "recovery journal");
  verifyPlan(journal.plan);
  if (!Array.isArray(journal.progress) || journal.progress.length !== journal.plan.operations.length) throw new Error("invalid recovery progress");
  for (const entry of journal.progress) {
    if (entry === null) continue;
    exact(entry, ["state", "identity"], "operation progress");
    if (!["in-flight", "completed"].includes(entry.state) || (entry.state === "in-flight" && entry.identity !== null)) throw new Error("invalid operation progress");
    validateIdentity(entry.identity);
  }
  if (journal.plan.workspaceSha256 !== adoptionWorkspaceIdentity(root)) throw new Error("recovery workspace mismatch");
  const residual = residualWriteEvidence(root, journal.plan.operations.map((op) => op.path));
  if (residual.length) throw new Error(`inspect interrupted single-file recovery evidence before rollback: ${residual.join(", ")}`);
  const ordered = journal.plan.operations.map((op, index) => ({ ...op, progress: journal.progress[index] })).reverse();
  const preserved = [];
  const operations = [...ordered.filter((op) => ![CONFIG, MANIFEST].includes(op.path)), ...ordered.filter((op) => op.path === CONFIG), ...ordered.filter((op) => op.path === MANIFEST)].map((op) => {
    const current = readProjectFile(root, op.path);
    if (op.progress === null) {
      if (current !== op.before) preserved.push(op.path);
      return { ...operation(op.path, current, current), identity: null };
    }
    if (current === op.before) return { ...operation(op.path, current, current), identity: null };
    if (op.progress.state !== "completed") throw new Error(`recovery requires ownership reconciliation for interrupted write: ${op.path}`);
    if (current !== op.after) throw new Error(`recovery blocked by external edit: ${op.path}`);
    const identity = projectFileIdentity(root, op.path);
    if (JSON.stringify(identity) !== JSON.stringify(op.progress.identity)) throw new Error(`recovery blocked by external file identity change: ${op.path}`);
    return { ...operation(op.path, current, op.before), identity };
  });
  const plan = { schemaVersion: "1.1", action: "rollback", journalSha256: hash(text), workspaceSha256: journal.plan.workspaceSha256, operations, preserved };
  return { ...plan, planSha256: hash(json(plan)) };
}
export function recoverProject(workspace, approvedDigest) {
  const root = realpathSync(workspace);
  return withProjectOperationLock(root, () => {
    const plan = planRecovery(root);
    if (plan.planSha256 !== approvedDigest) throw new Error("stale recovery plan digest");
    for (const op of plan.operations) {
      if (adoptionWorkspaceIdentity(root) !== plan.workspaceSha256) throw new Error("recovery workspace identity changed");
      if (readProjectFile(root, op.path) !== op.before) throw new Error(`recovery drift: ${op.path}`);
      if (op.before !== op.after) applyProjectFile(root, op.path, op.before, op.after, {}, plan.workspaceSha256, op.identity);
    }
    for (const op of plan.operations) if (readProjectFile(root, op.path) !== op.after) throw new Error(`recovered target changed: ${op.path}`);
    const text = readProjectFile(root, JOURNAL);
    if (hash(text) !== plan.journalSha256) throw new Error("recovery journal changed");
    applyProjectFile(root, JOURNAL, text, null, {}, plan.workspaceSha256);
    return { valid: true, status: "rolled-back", preserved: plan.preserved, hostDiscovery: "not-verified" };
  });
}
export function releaseInterruptedLock(workspace, approvedDigest) {
  const root = realpathSync(workspace), text = readProjectFile(root, LOCK);
  if (text === null || hash(text) !== approvedDigest) throw new Error("lock digest mismatch");
  const value = JSON.parse(text);
  exact(value, ["pid", "workspaceSha256"], "operation lock");
  if (!Number.isSafeInteger(value.pid) || value.pid <= 0 || value.workspaceSha256 !== adoptionWorkspaceIdentity(root)) throw new Error("invalid lock owner");
  try { process.kill(value.pid, 0); } catch (error) { if (error.code === "ESRCH") { applyProjectFile(root, LOCK, text, null); return { valid: true, status: "interrupted-lock-released" }; } throw error; }
  throw new Error("lock owner may still be running; lock retained");
}
