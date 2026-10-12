import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync, cpSync, symlinkSync, renameSync, chmodSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { planProject, applyProject, doctorProject, planRecovery, recoverProject, releaseInterruptedLock } from "./lib/project-adoption.mjs";
import { projectDirectoryEntryLimit, residualWriteEvidence, hash, json, CONFIG, MANIFEST, JOURNAL, LOCK, readProjectFile } from "./lib/project-state.mjs";
import { planAdoption, observeAdoptionLevel, applyApprovedAdoptionWrite, adoptionWriteApprovalDigest, adoptionWorkspaceIdentity, applyProjectFile } from "./lib/adoption.mjs";
import { diagnoseWorkspace } from "./lib/diagnosis.mjs";
import { managedBlock, assertMarkdownInsertion, framing } from "./lib/project-state.mjs";
import { applicableCorePointer } from "./lib/instruction-pointers.mjs";
const plugin = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function fixture(t) { const path = mkdtempSync(resolve(tmpdir(), "forgerail-project-")); t.after(() => rmSync(path, { recursive: true, force: true })); return path; }
function write(root, path, content) { mkdirSync(dirname(resolve(root, path)), { recursive: true }); writeFileSync(resolve(root, path), content); }
function adopt(root, source = plugin, options) { const plan = planProject(source, root, "init", options); return applyProject(source, root, "init", plan.planSha256, options); }
function snapshot(root) { const files = {}; function walk(path = "") { for (const entry of readdirSync(resolve(root, path), { withFileTypes: true })) { const p = path ? `${path}/${entry.name}` : entry.name; if (entry.isDirectory()) walk(p); else files[p] = readFileSync(resolve(root, p), "utf8"); } } walk(); return files; }

test("non-Node project: read-only plan, preserved instructions, repeat init, offline doctor, removal", (t) => {
  const root = fixture(t); write(root, "AGENTS.md", "User instructions\n"); write(root, "go.mod", "module example\n"); write(root, ".agents/skills/other/SKILL.md", "Other\n");
  const before = snapshot(root), plan = planProject(plugin, root, "init"); assert.deepEqual(snapshot(root), before);
  assert.ok(plan.changes > 20); assert.equal(applyProject(plugin, root, "init", plan.planSha256).status, "ready");
  assert.equal(doctorProject(plugin, root).status, "ready"); assert.equal(doctorProject(plugin, root).hostDiscovery, "not-verified");
  assert.equal(observeAdoptionLevel(root), "lightweight-adoption"); assert.equal(adopt(root).status, "no-change");
  assert.equal(existsSync(resolve(root, "package.json")), false);
  const remove = planProject(plugin, root, "remove"); assert.equal(applyProject(plugin, root, "remove", remove.planSha256).status, "removed");
  assert.equal(readProjectFile(root, "AGENTS.md"), "User instructions\n"); assert.equal(readProjectFile(root, CONFIG), null);
  assert.equal(readProjectFile(root, ".agents/skills/other/SKILL.md"), "Other\n"); assert.equal(readProjectFile(root, "go.mod"), before["go.mod"]);
});
test("stale plan and different workspace refuse before artifact changes", (t) => {
  const root = fixture(t), other = fixture(t), plan = planProject(plugin, root, "init");
  write(root, "AGENTS.md", "late edit"); const before = snapshot(root);
  assert.throws(() => applyProject(plugin, root, "init", plan.planSha256), /digest/); assert.deepEqual(snapshot(root), before);
  assert.throws(() => applyProject(plugin, other, "init", plan.planSha256), /digest/); assert.deepEqual(snapshot(other), {});
});
test("unknown same-name content is never adopted even if it matches", (t) => {
  const root = fixture(t); write(root, ".agents/skills/forgerail/SKILL.md", readFileSync(resolve(plugin, "skills/forgerail/SKILL.md")));
  assert.throws(() => planProject(plugin, root, "init"), /unknown same-name/);
});
test("empty metadata is not persisted governance and malformed/future metadata blocks writes", (t) => {
  const root = fixture(t); mkdirSync(resolve(root, ".forgerail")); assert.equal(observeAdoptionLevel(root), "plugin-only"); adopt(root);
  write(root, CONFIG, json({ schemaVersion: "9.0", host: "codex" })); assert.equal(doctorProject(plugin, root).status, "unavailable");
  assert.throws(() => planProject(plugin, root, "update"), /schema/);
});
test("outside block edits remain healthy; inside edits and Skill drift block remove", (t) => {
  const root = fixture(t); adopt(root); const agents = readProjectFile(root, "AGENTS.md"); write(root, "AGENTS.md", `Outside\n${agents}Tail\n`);
  assert.equal(doctorProject(plugin, root).status, "ready"); const p = planProject(plugin, root, "update"); applyProject(plugin, root, "update", p.planSha256); assert.ok(readProjectFile(root, "AGENTS.md").endsWith("Tail\n"));
  write(root, "AGENTS.md", readProjectFile(root, "AGENTS.md").replace("project governance", "edited governance")); assert.equal(doctorProject(plugin, root).status, "drift"); assert.throws(() => planProject(plugin, root, "remove"), /drift/);
});
test("source version update and downgrade boundaries", (t) => {
  const root = fixture(t), source = fixture(t); cpSync(plugin, source, { recursive: true }); adopt(root);
  const packagePath = resolve(source, "package.json"), pkg = JSON.parse(readFileSync(packagePath)); const previousVersion = pkg.version; pkg.version = `${Number(previousVersion.split(".")[0]) + 1}.0.0`; writeFileSync(packagePath, json(pkg));
  const p = planProject(source, root, "update"); applyProject(source, root, "update", p.planSha256); assert.equal(doctorProject(source, root).installedVersion, pkg.version);
  assert.throws(() => planProject(plugin, root, "update"), /downgrade/); assert.equal(readProjectFile(root, `.agents/vendor/forgerail/${previousVersion}/LICENSE`), null);
});
test("partial init rolls back with explicit digest; external changes are retained", (t) => {
  const root = fixture(t); write(root, "AGENTS.md", "Original\n"); const initial = snapshot(root), p = planProject(plugin, root, "init");
  assert.throws(() => applyProject(plugin, root, "init", p.planSha256, {}, { beforeOperation(i) { if (i === 3) throw new Error("injected interruption"); } }), /recovery-required/);
  assert.equal(doctorProject(plugin, root).status, "recovery-required"); assert.throws(() => planProject(plugin, root, "init"), /recovery/);
  const recovery = planRecovery(root); assert.throws(() => recoverProject(root, "0".repeat(64)), /digest/);
  const file = p.operations[0].path; write(root, file, "external edit"); assert.throws(() => planRecovery(root), /external edit/); assert.equal(readProjectFile(root, file), "external edit");
  write(root, file, p.operations[0].after); assert.throws(() => planRecovery(root), /identity change/); assert.ok(recovery.operations.length);
  const clean = fixture(t); write(clean, "AGENTS.md", "Original\n"); const cleanPlan = planProject(plugin, clean, "init");
  assert.throws(() => applyProject(plugin, clean, "init", cleanPlan.planSha256, {}, { beforeOperation(i) { if (i === 3) throw new Error("stop"); } }), /recovery/);
  recoverProject(clean, planRecovery(clean).planSha256); assert.deepEqual(snapshot(clean), initial);
});
test("partial removal restores previous installation", (t) => {
  const root = fixture(t); adopt(root); const before = snapshot(root), p = planProject(plugin, root, "remove");
  assert.throws(() => applyProject(plugin, root, "remove", p.planSha256, {}, { beforeOperation(i) { if (i === 4) throw new Error("stop"); } }), /recovery/);
  recoverProject(root, planRecovery(root).planSha256); assert.deepEqual(snapshot(root), before); assert.equal(doctorProject(plugin, root).status, "ready");
});
test("cooperating operations are mutually exclusive", (t) => {
  const root = fixture(t), p = planProject(plugin, root, "init");
  applyProject(plugin, root, "init", p.planSha256, {}, { beforeOperation(i) { if (i === 0) assert.throws(() => applyProject(plugin, root, "init", p.planSha256), /EEXIST/); } });
});
test("interrupted process lock can be released only after owner exits", (t) => {
  const root = fixture(t), text = json({ pid: process.pid, workspaceSha256: adoptionWorkspaceIdentity(root) }); write(root, LOCK, text);
  assert.throws(() => releaseInterruptedLock(root, hash(text)), /still be running/); assert.equal(readProjectFile(root, LOCK), text);
  const dead = spawnSync(process.execPath, ["-e", "" ]).pid; const stale = json({ pid: dead, workspaceSha256: adoptionWorkspaceIdentity(root) }); write(root, LOCK, stale);
  assert.equal(releaseInterruptedLock(root, hash(stale)).status, "interrupted-lock-released");
});
test("symlinks, case aliases and invalid UTF8 refuse mutation", (t) => {
  const root = fixture(t), outside = fixture(t); symlinkSync(outside, resolve(root, ".agents")); assert.throws(() => planProject(plugin, root, "init"), /unsafe/); rmSync(resolve(root, ".agents"));
  write(root, "agents.md", "alias"); assert.throws(() => planProject(plugin, root, "init"), /alias/); rmSync(resolve(root, "agents.md"));
  write(root, "AGENTS.md", Buffer.from([255])); assert.throws(() => planProject(plugin, root, "init"), /encoded data/);
});
test("v1 writer cannot gain whole-file replacement powers", (t) => {
  const root = fixture(t); write(root, "a.md", "before"); const proposal = { workspaceSha256: adoptionWorkspaceIdentity(root), path: "a.md", operation: "replace-file", baseSha256: hash("before"), content: "after", contentSha256: hash("after"), managedMarker: null }; proposal.approvalSha256 = adoptionWriteApprovalDigest(proposal);
  assert.throws(() => applyApprovedAdoptionWrite(root, proposal, proposal.approvalSha256), /unsupported/); assert.equal(readProjectFile(root, "a.md"), "before");
});
test("guarded removal restores late-edited source and never overwrites replacement", (t) => {
  const root = fixture(t); write(root, "a.md", "before");
  assert.throws(() => applyProjectFile(root, "a.md", "before", null, { beforeRemove() { write(root, "a.md", "edit"); } }), /drift/); assert.equal(readProjectFile(root, "a.md"), "edit");
  write(root, "a.md", "before"); assert.throws(() => applyProjectFile(root, "a.md", "before", null, { afterRemove() { write(root, "a.md", "new file"); } }), /recovery retained/); assert.equal(readProjectFile(root, "a.md"), "new file");
});
test("explicit same-version legacy lock migration preserves custom instructions", (t) => {
  const root = fixture(t); const p = planProject(plugin, root, "init"); const files = {};
  for (const op of p.operations) if (op.path.startsWith(".agents/")) { write(root, op.path, op.after); files[op.path] = hash(op.after); }
  write(root, "AGENTS.md", "Custom project governance\n"); const version = p.source.version;
  const legacyLock = "docs/governance/legacy.lock.json";
  write(root, legacyLock, json({ package: p.source.package, version, archiveSha256: "a".repeat(64), archiveIntegrity: "sha512-YQ==", source: `https://registry.npmjs.org/@echopath-labs/forgerail/-/forgerail-${version}.tgz`, files }));
  const plan = planProject(plugin, root, "init", { legacyLock }); applyProject(plugin, root, "init", plan.planSha256, { legacyLock });
  assert.equal(JSON.parse(readProjectFile(root, legacyLock)).status, "historical"); assert.ok(readProjectFile(root, "AGENTS.md").startsWith("Custom project governance\n"));
});
test("CLI plan/doctor and explicit apply work without host package metadata", (t) => {
  const root = fixture(t); const cli = resolve(plugin, "scripts/forgerail.mjs");
  const call = (args) => spawnSync(process.execPath, [cli, ...args, "--workspace", root], { encoding: "utf8" });
  const plan = call(["init"]); assert.equal(plan.status, 0, plan.stdout); assert.deepEqual(snapshot(root), {});
  assert.equal(call(["init", "--apply", JSON.parse(plan.stdout).planSha256]).status, 0);
  assert.equal(JSON.parse(call(["doctor"]).stdout).status, "ready"); assert.equal(call(["doctor", "--apply", "abc"]).status, 1);
});

test("tampered recovery and lingering primitive evidence refuse rollback", (t) => {
  const root = fixture(t), p = planProject(plugin, root, "init");
  assert.throws(() => applyProject(plugin, root, "init", p.planSha256, {}, { beforeOperation(i) { if (i === 1) throw new Error("stop"); } }), /recovery/);
  const original = readProjectFile(root, JOURNAL), value = JSON.parse(original); value.plan.operations[0].path = "outside.md"; write(root, JOURNAL, json(value)); assert.throws(() => planRecovery(root), /identity/);
  write(root, JOURNAL, original); write(root, ".agents/skills/architecture-convergence-audit/.forgerail-aabbcc.lock", "interrupted"); assert.throws(() => planRecovery(root), /single-file recovery/);
});
test("late earlier-target edit prevents installation commit and survives recovery refusal", (t) => {
  const root = fixture(t), p = planProject(plugin, root, "init");
  assert.throws(() => applyProject(plugin, root, "init", p.planSha256, {}, { beforeOperation(i) { if (i === 2) write(root, p.operations[0].path, "user edit"); } }), /completed target drift/);
  assert.equal(readProjectFile(root, MANIFEST), null); assert.throws(() => planRecovery(root), /external edit/); assert.equal(readProjectFile(root, p.operations[0].path), "user edit");
});
test("real process termination between writes retains recoverable journal and stale project lock", (t) => {
  const root = fixture(t);
  const module = new URL("./lib/project-adoption.mjs", import.meta.url).href;
  const script = `import {planProject,applyProject} from ${JSON.stringify(module)}; const p=planProject(${JSON.stringify(plugin)},${JSON.stringify(root)},'init'); applyProject(${JSON.stringify(plugin)},${JSON.stringify(root)},'init',p.planSha256,{}, {beforeOperation(i){if(i===2)process.exit(91)}});`;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8" }); assert.equal(result.status, 91, result.stderr);
  assert.equal(doctorProject(plugin, root).status, "recovery-required"); releaseInterruptedLock(root, doctorProject(plugin, root).lockDigest);
  recoverProject(root, planRecovery(root).planSha256); assert.deepEqual(snapshot(root), {});
});
test("changed producer invalidates previously generated plan", (t) => {
  const root = fixture(t), source = fixture(t); cpSync(plugin, source, { recursive: true }); const p = planProject(source, root, "init");
  const file = "scripts/lib/project-adoption.mjs"; write(source, file, readProjectFile(source, file) + "\n// producer changed\n");
  assert.throws(() => applyProject(source, root, "init", p.planSha256), /digest/); assert.deepEqual(snapshot(root), {});
});

test("workspace replacement between operations cannot redirect writes", (t) => {
  const root = fixture(t), moved = `${root}-moved`; t.after(() => rmSync(moved, { recursive: true, force: true }));
  const p = planProject(plugin, root, "init");
  assert.throws(() => applyProject(plugin, root, "init", p.planSha256, {}, { beforeOperation(i) {
    if (i === 1) { const result = spawnSync(process.execPath, ["--input-type=module", "-e", `import {renameSync,mkdirSync} from 'node:fs'; renameSync(${JSON.stringify(root)},${JSON.stringify(moved)}); mkdirSync(${JSON.stringify(root)});`]); assert.equal(result.status, 0); }
  } }), /identity changed/);
  assert.deepEqual(snapshot(root), {}); assert.ok(existsSync(resolve(moved, JOURNAL)));
});

test("new CLI migrates a verified older package without implicitly upgrading its Skills", (t) => {
  const root = fixture(t), old = fixture(t); cpSync(plugin, old, { recursive: true });
  const pkg = JSON.parse(readProjectFile(old, "package.json")); pkg.version = "0.1.3"; write(old, "package.json", json(pkg));
  write(old, "skills/forgerail/SKILL.md", "---\nname: forgerail\ndescription: Old release\n---\nOld released skill\n");
  const oldPlan = planProject(old, root, "init"), files = {};
  for (const op of oldPlan.operations) if (op.path.startsWith(".agents/")) { write(root, op.path, op.after); files[op.path] = hash(op.after); }
  const legacyLock = "docs/old.lock.json";
  write(root, legacyLock, json({ package: pkg.name, version: pkg.version, archiveSha256: "a".repeat(64), archiveIntegrity: "sha512-YQ==", source: "https://registry.npmjs.org/@echopath-labs/forgerail/-/forgerail-0.1.3.tgz", files }));
  rmSync(resolve(old, "scripts/lib/project-adoption.mjs")); rmSync(resolve(old, "scripts/lib/project-state.mjs")); rmSync(resolve(old, "adapters/project"), { recursive: true });
  const options = { legacyLock, legacySource: old }; const plan = planProject(plugin, root, "init", options); applyProject(plugin, root, "init", plan.planSha256, options);
  assert.equal(doctorProject(plugin, root).installedVersion, "0.1.3"); assert.ok(readProjectFile(root, ".agents/skills/forgerail/SKILL.md").includes("Old released skill"));
  const update = planProject(plugin, root, "update"); applyProject(plugin, root, "update", update.planSha256); assert.equal(doctorProject(plugin, root).installedVersion, JSON.parse(readFileSync(resolve(plugin, "package.json"), "utf8")).version);
});
test("UTF8 BOM in user instructions is preserved exactly", (t) => {
  const root = fixture(t); write(root, "AGENTS.md", "\ufeffUser rules\n"); adopt(root); assert.ok(readProjectFile(root, "AGENTS.md").startsWith("\ufeffUser rules\n"));
});

test("unknown manifest fields, escaped ownership and duplicate entries fail closed", (t) => {
  const root = fixture(t); adopt(root); const original = JSON.parse(readProjectFile(root, MANIFEST));
  for (const mutate of [m => { m.authorized = true; }, m => { m.artifacts[0].path = '../external'; }, m => { m.artifacts.push(m.artifacts[0]); }, m => { m.artifacts[0].ownership = 'directory'; }, m => { m.source.kind = 'trusted-registry'; }]) {
    const value = structuredClone(original); mutate(value); write(root, MANIFEST, json(value));
    assert.equal(doctorProject(plugin, root).status, "unavailable"); assert.throws(() => planProject(plugin, root, "remove"));
  }
});

test("rollback preserves same-byte external creation at an operation that never started", (t) => {
  const root = fixture(t), p = planProject(plugin, root, "init");
  const target = p.operations.find((op) => op.path.endsWith("/LICENSE"));
  assert.throws(() => applyProject(plugin, root, "init", p.planSha256, {}, { beforeOperation(i, op) {
    if (op.path === target.path) write(root, op.path, op.after);
  } }), /baseline changed/);
  const recovery = planRecovery(root); assert.ok(recovery.preserved.includes(target.path));
  const op = recovery.operations.find((op) => op.path === target.path); assert.equal(op.before, op.after);
  const result = recoverProject(root, recovery.planSha256); assert.ok(result.preserved.includes(target.path));
  assert.equal(readProjectFile(root, target.path), target.after); assert.equal(readProjectFile(root, JOURNAL), null);
});
test("rollback rejects same-byte replacement of a completed target", (t) => {
  const root = fixture(t), p = planProject(plugin, root, "init"); const first = p.operations[0];
  assert.throws(() => applyProject(plugin, root, "init", p.planSha256, {}, { beforeOperation(i) {
    if (i === 1) { write(root, "replacement.md", first.after); renameSync(resolve(root, "replacement.md"), resolve(root, first.path)); throw new Error("stop"); }
  } }), /recovery/);
  assert.throws(() => planRecovery(root), /identity change/); assert.equal(readProjectFile(root, first.path), first.after);
});
test("write completed without durable receipt is not guessed to be owned", (t) => {
  const root = fixture(t), p = planProject(plugin, root, "init");
  assert.throws(() => applyProject(plugin, root, "init", p.planSha256, {}, { afterOperation() { throw new Error("lost completion receipt"); } }), /recovery/);
  assert.throws(() => planRecovery(root), /ownership reconciliation/); assert.equal(readProjectFile(root, p.operations[0].path), p.operations[0].after);
});
test("journal budget rejects large user instructions before any writes; admitted journal remains recoverable", (t) => {
  const root = fixture(t); write(root, "AGENTS.md", "x".repeat(2200000)); const before = snapshot(root);
  assert.throws(() => planProject(plugin, root, "init"), /journal exceeds 4 MiB/);
  assert.throws(() => applyProject(plugin, root, "init", "a".repeat(64)), /journal exceeds 4 MiB/); assert.deepEqual(snapshot(root), before);
  write(root, "AGENTS.md", "x".repeat(1800000)); const initial = snapshot(root), p = planProject(plugin, root, "init");
  assert.throws(() => applyProject(plugin, root, "init", p.planSha256, {}, { beforeOperation(i) { if (i === 1) throw new Error("stop"); } }), /recovery/);
  const journal = readProjectFile(root, JOURNAL); assert.ok(Buffer.byteLength(journal) < 4194304);
  recoverProject(root, planRecovery(root).planSha256); assert.deepEqual(snapshot(root), initial);
});
test("repeated init/remove preserves every user byte including separators", (t) => {
  for (const text of ["User rules", "\ufeffUser rules\r\n\r\n", ""]) {
    const root = fixture(t); write(root, "AGENTS.md", text);
    for (let cycle = 0; cycle < 2; cycle++) {
      adopt(root); const plan = planProject(plugin, root, "remove"); applyProject(plugin, root, "remove", plan.planSha256);
      assert.equal(readProjectFile(root, "AGENTS.md"), text);
    }
  }
});
test("ordinary legacy-marker prose is allowed; real boundaries and reverse v1 adoption are refused", (t) => {
  const root = fixture(t); write(root, "AGENTS.md", "Do not invent forgerail:binding: markers yourself.\n");
  const old = planAdoption(plugin, root, ["codex"]).proposedWrites[0]; adopt(root);
  assert.throws(() => planAdoption(plugin, root, ["codex"]), /project lifecycle owns/);
  assert.throws(() => applyApprovedAdoptionWrite(root, old, old.approvalSha256), /project lifecycle owns/);
  const other = fixture(t); write(other, "AGENTS.md", "<!-- forgerail:binding:codex:v1:start -->");
  assert.throws(() => planProject(plugin, other, "init"), /legacy managed binding/);
});
test("old candidate journals without ownership receipts refuse automatic recovery", (t) => {
  const root = fixture(t), plan = planProject(plugin, root, "init"); write(root, JOURNAL, json({ schemaVersion: "1.0", plan }));
  assert.throws(() => planRecovery(root), /ownership receipts required/); assert.ok(readProjectFile(root, JOURNAL));
});


test("pending lifecycle evidence blocks both legacy planning and approved writes", (t) => {
  for (const path of [JOURNAL, LOCK]) {
    const root = fixture(t), legacy = planAdoption(plugin, root, ["codex"]);
    write(root, path, "pending"); const before = snapshot(root);
    assert.throws(() => planAdoption(plugin, root, ["codex"]), /project lifecycle owns/);
    const proposed = legacy.proposedWrites[0];
    assert.throws(() => applyApprovedAdoptionWrite(root, proposed, proposed.approvalSha256), /project lifecycle owns/);
    assert.deepEqual(snapshot(root), before);
  }
});
test("managed drift retains lightweight adoption and is not healthy", (t) => {
  const root = fixture(t); adopt(root);
  write(root, ".agents/skills/forgerail/SKILL.md", "user edit");
  assert.equal(observeAdoptionLevel(root), "lightweight-adoption");
  const doctor = doctorProject(plugin, root);
  assert.equal(doctor.status, "drift"); assert.equal(doctor.valid, false);
  assert.equal(doctor.governanceLevel, "lightweight-adoption");
});
test("old installed artifact recovery evidence blocks update and remove", (t) => {
  const root = fixture(t), source = fixture(t); cpSync(plugin, source, { recursive: true });
  const pkg = JSON.parse(readFileSync(resolve(source, "package.json"))); pkg.version = "0.0.1"; write(source, "package.json", json(pkg)); adopt(root, source);
  write(root, ".agents/vendor/forgerail/0.0.1/.forgerail-abcd.source", "retained evidence"); const before = snapshot(root);
  assert.equal(doctorProject(plugin, root).status, "recovery-required");
  for (const action of ["update", "remove"]) assert.throws(() => planProject(plugin, root, action), /single-file recovery evidence/);
  assert.deepEqual(snapshot(root), before);
});
test("unavailable source retains project recovery digests", (t) => {
  const root = fixture(t), source = fixture(t); cpSync(plugin, source, { recursive: true });
  rmSync(resolve(source, "LICENSE")); write(root, JOURNAL, "journal"); write(root, LOCK, "lock");
  const doctor = doctorProject(source, root);
  assert.equal(doctor.valid, false); assert.equal(doctor.status, "recovery-required");
  assert.equal(doctor.cliVersion, null); assert.ok(doctor.errors.length);
  assert.equal(doctor.lockDigest, hash("lock")); assert.equal(doctor.recoveryDigest, hash("journal"));
});


test("recovery health preserves valid installation ownership across all observers", (t) => {
  const root = fixture(t); adopt(root);
  const manifest = JSON.parse(readProjectFile(root, MANIFEST));
  const artifact = manifest.artifacts.find((a) => a.path.endsWith("/LICENSE"));
  const residual = `${dirname(artifact.path)}/.forgerail-abcd.source`;
  for (const path of [JOURNAL, LOCK, residual]) {
    write(root, path, "recovery evidence");
    const before = snapshot(root), doctor = doctorProject(plugin, root);
    assert.equal(doctor.status, "recovery-required"); assert.equal(doctor.valid, false);
    assert.equal(doctor.adopted, true); assert.equal(doctor.governanceLevel, "lightweight-adoption");
    assert.equal(observeAdoptionLevel(root), "lightweight-adoption");
    const diagnosis = diagnoseWorkspace(root, plugin);
    assert.equal(diagnosis.adoption.currentLevel, "lightweight-adoption");
    assert.equal(diagnosis.adoption.changeRecommended, false);
    assert.deepEqual(snapshot(root), before); rmSync(resolve(root, path));
  }
});
test("interrupted initial adoption does not invent installation ownership", (t) => {
  const root = fixture(t); write(root, JOURNAL, "pending");
  for (const config of [null, json({ schemaVersion: "1.0", host: "codex" })]) {
    if (config !== null) write(root, CONFIG, config);
    const doctor = doctorProject(plugin, root);
    assert.equal(doctor.status, "recovery-required"); assert.equal(doctor.valid, false);
    assert.equal(doctor.adopted, false); assert.equal(doctor.governanceLevel, "plugin-only");
    assert.equal(doctor.recoveryDigest, hash("pending"));
  }
});


test("unreadable journal does not hide an independently readable lock", (t) => {
  const root = fixture(t); write(root, LOCK, "retained lock");
  symlinkSync(resolve(root, "missing-journal"), resolve(root, JOURNAL));
  const doctor = doctorProject(plugin, root);
  assert.equal(doctor.valid, false); assert.equal(doctor.lockDigest, hash("retained lock"));
  assert.equal(doctor.recoveryDigest, null);
});
test("repeat init with large user prose needs no recovery journal", (t) => {
  const root = fixture(t); adopt(root);
  write(root, "AGENTS.md", "x".repeat(2200000) + readProjectFile(root, "AGENTS.md"));
  const before = snapshot(root); assert.equal(doctorProject(plugin, root).status, "ready");
  const plan = planProject(plugin, root, "init"); assert.equal(plan.changes, 0);
  assert.equal(applyProject(plugin, root, "init", plan.planSha256).status, "no-change");
  assert.deepEqual(snapshot(root), before); assert.equal(readProjectFile(root, JOURNAL), null);
});


test("unreadable recovery evidence retains independently valid installation ownership", (t) => {
  const root = fixture(t); adopt(root);
  for (const path of [JOURNAL, LOCK]) {
    for (const kind of ["symlink", "oversized"]) {
      if (kind === "symlink") symlinkSync(resolve(root, "missing-recovery"), resolve(root, path));
      else write(root, path, "x".repeat(4 * 1024 * 1024 + 1));
      const doctor = doctorProject(plugin, root);
      assert.equal(doctor.status, "recovery-required"); assert.equal(doctor.valid, false);
      assert.equal(doctor.adopted, true); assert.equal(doctor.governanceLevel, "lightweight-adoption");
      assert.ok(doctor.error); assert.equal(observeAdoptionLevel(root), "lightweight-adoption");
      assert.equal(diagnoseWorkspace(root, plugin).adoption.currentLevel, "lightweight-adoption");
      rmSync(resolve(root, path));
    }
  }
});
test("directory scans reject excessive entries and release their handles", (t) => {
  const root = fixture(t);
  for (let i = 0; i < projectDirectoryEntryLimit; i++) write(root, `entry-${i}`, "");
  assert.deepEqual(residualWriteEvidence(root, ["AGENTS.md"]), []);
  write(root, "one-more", "");
  assert.throws(() => residualWriteEvidence(root, ["AGENTS.md"]), /directory entry limit/);
  assert.throws(() => readProjectFile(root, "AGENTS.md"), /directory entry limit/);
  rmSync(resolve(root, "one-more"));
  assert.deepEqual(residualWriteEvidence(root, ["AGENTS.md"]), []);
  assert.equal(readProjectFile(root, "AGENTS.md"), null);
});


function operationLimitFixture(t, extra) {
  const root = fixture(t), source = fixture(t); adopt(root);
  const manifest = JSON.parse(readProjectFile(root, MANIFEST));
  for (let i = manifest.artifacts.length; i < 512; i++) {
    const path = `.agents/skills/forgerail/old/group-${Math.floor(i / 32)}/entry-${i}.md`;
    write(root, path, ""); manifest.artifacts.push({ path, ownership: "file", sha256: hash("") });
  }
  write(root, MANIFEST, json(manifest));
  cpSync(plugin, source, { recursive: true });
  for (let i = 0; i < extra; i++) write(source, `skills/forgerail/new/entry-${i}.md`, "");
  return { root, source };
}
test("plan operation limit rejects 521 operations during preview without mutation", (t) => {
  const { root, source } = operationLimitFixture(t, 7), before = snapshot(root);
  assert.throws(() => planProject(source, root, "update"), /invalid project plan identity/);
  assert.deepEqual(snapshot(root), before);
});
test("plan operation limit completes all 520 operations", (t) => {
  const { root, source } = operationLimitFixture(t, 6);
  const plan = planProject(source, root, "update"); assert.equal(plan.operations.length, 520);
  assert.equal(applyProject(source, root, "update", plan.planSha256).status, "ready");
  assert.equal(doctorProject(source, root).status, "ready");
  assert.equal(readProjectFile(root, JOURNAL), null);
});

test("completed file identity replacement blocks installation commit and journal cleanup", (t) => {
  for (const timing of ["before-manifest", "after-manifest"]) {
    const root = fixture(t), plan = planProject(plugin, root, "init");
    const first = plan.operations[0];
    const replace = () => { write(root, "replacement", first.after); renameSync(resolve(root, "replacement"), resolve(root, first.path)); };
    const hooks = timing === "before-manifest"
      ? { beforeOperation(i) { if (i === plan.operations.length - 1) replace(); } }
      : { afterOperation(i) { if (i === plan.operations.length - 1) replace(); } };
    assert.throws(() => applyProject(plugin, root, "init", plan.planSha256, {}, hooks), /completed target ownership changed/);
    assert.notEqual(readProjectFile(root, JOURNAL), null);
    if (timing === "before-manifest") assert.equal(readProjectFile(root, MANIFEST), null);
    assert.equal(readProjectFile(root, first.path), first.after);
    assert.throws(() => planRecovery(root), /identity|ownership|external edit/);
  }
});
test("orphaned initial recovery evidence is unhealthy without installation metadata", (t) => {
  for (const path of [".forgerail-abcd.tmp", ".forgerail-abcd.lock", ".forgerail/.forgerail-abcd.source"]) {
    const root = fixture(t); write(root, path, "retained evidence"); const before = snapshot(root);
    const doctor = doctorProject(plugin, root);
    assert.equal(doctor.status, "recovery-required"); assert.equal(doctor.valid, false); assert.equal(doctor.adopted, false);
    assert.ok(doctor.residual.includes(path));
    assert.throws(() => planProject(plugin, root, "init"), /recovery evidence/);
    assert.deepEqual(snapshot(root), before);
  }
});

test("adopted metadata recovery evidence blocks healthy diagnosis", (t) => {
  const root = fixture(t); adopt(root);
  const path = ".forgerail/.forgerail-abcd.source"; write(root, path, "evidence");
  const doctor = doctorProject(plugin, root);
  assert.equal(doctor.status, "recovery-required"); assert.equal(doctor.adopted, true); assert.ok(doctor.residual.includes(path));
  for (const action of ["update", "remove"]) assert.throws(() => planProject(plugin, root, action), /recovery evidence/);
});
test("recovery refuses externally restored prior bytes and interrupted rollback retries", (t) => {
  for (const origin of ["external", "interrupted-rollback"]) {
    const root = fixture(t); adopt(root); const plan = planProject(plugin, root, "remove");
    assert.throws(() => applyProject(plugin, root, "remove", plan.planSha256, {}, { beforeOperation(i) { if (i === 4) throw new Error("stop"); } }), /recovery/);
    if (origin === "external") write(root, plan.operations[0].path, plan.operations[0].before);
    else {
      const recovery = planRecovery(root);
      assert.throws(() => recoverProject(root, recovery.planSha256, { afterOperation() { throw new Error("rollback interrupted"); } }), /rollback interrupted/);
    }
    const before = snapshot(root);
    assert.throws(() => planRecovery(root), /ownership reconciliation/);
    assert.throws(() => recoverProject(root, "0".repeat(64)), /ownership reconciliation/);
    assert.deepEqual(snapshot(root), before); assert.notEqual(readProjectFile(root, JOURNAL), null);
    assert.equal(doctorProject(plugin, root).status, "recovery-required");
  }
});
test("orphaned lifecycle binding requires reconciliation without claiming adoption", (t) => {
  for (const kind of ["complete", "start-only", "end-only"]) {
    const root = fixture(t); adopt(root);
    rmSync(resolve(root, CONFIG)); rmSync(resolve(root, MANIFEST));
    if (kind !== "complete") write(root, "AGENTS.md", `<!-- forgerail:project:codex:v1:${kind === "start-only" ? "start" : "end"} -->`);
    const before = snapshot(root), doctor = doctorProject(plugin, root);
    assert.equal(doctor.valid, false); assert.equal(doctor.status, "recovery-required"); assert.equal(doctor.adopted, false);
    assert.match(doctor.error, /orphaned.*binding.*reconciliation/);
    assert.equal(doctor.recoveryDigest, null); assert.equal(observeAdoptionLevel(root), "plugin-only");
    assert.deepEqual(snapshot(root), before);
  }
  const root = fixture(t); write(root, "AGENTS.md", "Documentation mentions forgerail:project:codex:v1 without a binding.");
  assert.equal(doctorProject(plugin, root).status, "not-adopted");
});
test("rollback rechecks restored identities before metadata and cleanup", (t) => {
  for (const timing of ["before-metadata", "after-metadata"]) {
    const root = fixture(t); adopt(root); const plan = planProject(plugin, root, "remove");
    assert.throws(() => applyProject(plugin, root, "remove", plan.planSha256, {}, { beforeOperation(i) { if (i === plan.operations.length - 1) throw new Error("stop"); } }), /recovery/);
    const recovery = planRecovery(root); let restored;
    const replace = () => { write(root, "replacement", restored.after); renameSync(resolve(root, "replacement"), resolve(root, restored.path)); };
    assert.throws(() => recoverProject(root, recovery.planSha256, {
      beforeOperation(i, op) { if (timing === "before-metadata" && op.path === CONFIG) replace(); },
      afterOperation(i, op) { if (!restored && ![CONFIG, MANIFEST].includes(op.path) && op.after !== null) restored = op; if (timing === "after-metadata" && op.path === CONFIG) replace(); }
    }), /recovered target identity or content changed/);
    assert.notEqual(readProjectFile(root, JOURNAL), null); assert.equal(readProjectFile(root, restored.path), restored.after);
  }
});

for (const direction of ["present-to-absent", "absent-to-present"]) test(`mode capture ${direction} drift refuses before journal or project writes`, (t) => {
  const root = fixture(t), target = "AGENTS.md";
  write(root, "notes.txt", "Unrelated user content\n");
  if (direction === "present-to-absent") write(root, target, "Original user instructions\n");
  const plan = planProject(plugin, root, "init"), targetIndex = plan.operations.findIndex((op) => op.path === target);
  assert.ok(targetIndex > 0, "capture drift must occur after earlier operations were planned");
  let expected, started = 0;
  assert.throws(() => applyProject(plugin, root, "init", plan.planSha256, {}, {
    beforeModeCapture(index) {
      if (index !== targetIndex) return;
      if (direction === "present-to-absent") rmSync(resolve(root, target));
      else write(root, target, "Externally created user instructions\n");
      expected = snapshot(root); delete expected[LOCK];
    },
    beforeOperation() { started++; }
  }), /mode capture presence changed: AGENTS\.md/);
  assert.ok(expected); assert.equal(started, 0);
  assert.equal(readProjectFile(root, JOURNAL), null); assert.equal(readProjectFile(root, LOCK), null);
  assert.deepEqual(snapshot(root), expected);
});
test("confidential journal and every journal temporary copy stay private under both umasks", (t) => {
  for (const umask of [0o022, 0o077]) {
    const root = fixture(t), previous = process.umask(umask);
    try {
      write(root, "AGENTS.md", "PRIVATE SENTINEL\n"); chmodSync(resolve(root, "AGENTS.md"), 0o600);
      const plan = planProject(plugin, root, "init");
      assert.throws(() => applyProject(plugin, root, "init", plan.planSha256, {}, { beforeOperation(i) { if (i === 0) throw new Error("stop"); } }), /recovery/);
      assert.equal(statSync(resolve(root, JOURNAL)).mode & 0o777, 0o600);
      assert.ok(readProjectFile(root, JOURNAL).includes("PRIVATE SENTINEL"));
      applyProjectFile(root, JOURNAL, readProjectFile(root, JOURNAL), "private replacement", {
        beforeInstall() { for (const file of readdirSync(root).filter((name) => name.endsWith(".tmp"))) assert.equal(statSync(resolve(root, file)).mode & 0o777, 0o600); },
        beforeReplace() { for (const file of readdirSync(root).filter((name) => /\.(tmp|bak|source)$/.test(name))) assert.equal(statSync(resolve(root, file)).mode & 0o777, 0o600); }
      }, adoptionWorkspaceIdentity(root), undefined, { purpose: "journal" });
      assert.equal(statSync(resolve(root, JOURNAL)).mode & 0o777, 0o600);
    } finally { process.umask(previous); }
  }
});
test("partial deletion recovery restores recorded private and executable permission modes", (t) => {
  for (const mode of [0o600, 0o700, 0o640]) {
    const root = fixture(t); adopt(root); let plan = planProject(plugin, root, "remove");
    const target = plan.operations.find((op) => op.after === null && op.before !== null).path;
    chmodSync(resolve(root, target), mode); plan = planProject(plugin, root, "remove");
    const index = plan.operations.findIndex((op) => op.path === target);
    assert.throws(() => applyProject(plugin, root, "remove", plan.planSha256, {}, { beforeOperation(i) { if (i === index + 1) throw new Error("stop"); } }), /recovery/);
    assert.equal(readProjectFile(root, target), null);
    const journal = JSON.parse(readProjectFile(root, JOURNAL)); assert.equal(journal.originalModes[index], mode);
    recoverProject(root, planRecovery(root).planSha256);
    assert.equal(statSync(resolve(root, target)).mode & 0o777, mode); assert.equal(doctorProject(plugin, root).status, "ready");
  }
});
test("legacy receipt journals recover provable creates but refuse deleted permission guesses", (t) => {
  for (const action of ["init", "remove"]) {
    const root = fixture(t); if (action === "remove") adopt(root);
    const plan = planProject(plugin, root, action);
    assert.throws(() => applyProject(plugin, root, action, plan.planSha256, {}, { beforeOperation(i) { if (i === 1) throw new Error("stop"); } }), /recovery/);
    const journal = JSON.parse(readProjectFile(root, JOURNAL)); journal.schemaVersion = "1.1"; delete journal.originalModes; write(root, JOURNAL, json(journal));
    if (action === "init") { recoverProject(root, planRecovery(root).planSha256); assert.equal(readProjectFile(root, JOURNAL), null); }
    else { const before = snapshot(root); assert.throws(() => planRecovery(root), /missing original permissions.*manual/); assert.deepEqual(snapshot(root), before); }
  }
});
test("legacy replacement journals cannot infer original permissions from the completed file", (t) => {
  const root = fixture(t), source = fixture(t); cpSync(plugin, source, { recursive: true }); adopt(root);
  const target = ".agents/skills/forgerail/SKILL.md";
  chmodSync(resolve(root, target), 0o750);
  write(source, "skills/forgerail/SKILL.md", `${readFileSync(resolve(source, "skills/forgerail/SKILL.md"), "utf8")}\nReplacement fixture\n`);
  const plan = planProject(source, root, "update"), index = plan.operations.findIndex((op) => op.path === target);
  assert.throws(() => applyProject(source, root, "update", plan.planSha256, {}, { beforeOperation(i) { if (i === index + 1) throw new Error("stop"); } }), /recovery/);
  const journal = JSON.parse(readProjectFile(root, JOURNAL));
  assert.equal(journal.progress[index].state, "completed"); assert.equal(statSync(resolve(root, target)).mode & 0o7777, 0o750);
  // A 1.1 writer could have produced these bytes and mode from 02750: its
  // completed identity proves the replacement, never the original special bits.
  journal.schemaVersion = "1.1"; delete journal.originalModes; write(root, JOURNAL, json(journal));
  const before = snapshot(root);
  assert.throws(() => planRecovery(root), /missing original permissions for replaced target.*manual/);
  assert.deepEqual(snapshot(root), before); assert.equal(statSync(resolve(root, target)).mode & 0o7777, 0o750);
});
test("permission drift before a delete is retained and prevents writes", (t) => {
  const root = fixture(t); adopt(root); const plan = planProject(plugin, root, "remove");
  const target = plan.operations[0].path;
  assert.throws(() => applyProject(plugin, root, "remove", plan.planSha256, {}, { beforeOperation(i) { if (i === 0) chmodSync(resolve(root, target), 0o600); } }), /permissions changed/);
  assert.equal(readProjectFile(root, target), plan.operations[0].before); assert.equal(statSync(resolve(root, target)).mode & 0o777, 0o600);
  write(root, "private.txt", "known"); chmodSync(resolve(root, "private.txt"), 0o600);
  assert.throws(() => applyProjectFile(root, "private.txt", "known", null, { beforeRemove() { chmodSync(resolve(root, "private.txt"), 0o640); } }), /permission drift/);
  assert.equal(readProjectFile(root, "private.txt"), "known"); assert.equal(statSync(resolve(root, "private.txt")).mode & 0o777, 0o640);
});
test("managed framing separates valid Markdown tails and preserves exact user bytes", (t) => {
  for (const text of ["```text\nexample\n```", "~~~text\r\nexample\r\n~~~", "User rules", "<!-- complete -->", "> quote", "- list item", "", "\ufeffRules\r\n", "Inline `<!--` example"]) {
    const root = fixture(t); write(root, "AGENTS.md", text);
    for (let cycle = 0; cycle < 2; cycle++) {
      adopt(root); const adopted = readProjectFile(root, "AGENTS.md"), block = managedBlock(adopted);
      assert.ok(block.startsWith("\n\n<!--")); assert.ok(block.includes(framing)); assert.ok(block.endsWith("-->\n"));
      assertMarkdownInsertion(adopted.slice(0, adopted.indexOf(block)));
      assert.equal(applicableCorePointer(adopted), true, `active Core pointer after ${JSON.stringify(text)}`);
      const plan = planProject(plugin, root, "remove"); applyProject(plugin, root, "remove", plan.planSha256);
      assert.equal(readProjectFile(root, "AGENTS.md"), text);
    }
  }
});
test("legacy plain managed blocks remain removable and update to owned framing", (t) => {
  for (const action of ["update", "remove"]) {
    const root = fixture(t); adopt(root);
    const current = managedBlock(readProjectFile(root, "AGENTS.md"));
    const plain = current.slice(2, -1).replace(`${framing}\n`, "");
    write(root, "AGENTS.md", `Legacy user\n${plain}Suffix`);
    const manifest = JSON.parse(readProjectFile(root, MANIFEST)); manifest.artifacts.find((artifact) => artifact.path === "AGENTS.md").sha256 = hash(plain); write(root, MANIFEST, json(manifest));
    assert.equal(doctorProject(plugin, root).status, "ready");
    let plan = planProject(plugin, root, action); applyProject(plugin, root, action, plan.planSha256);
    if (action === "update") { assert.ok(managedBlock(readProjectFile(root, "AGENTS.md")).includes(framing)); plan = planProject(plugin, root, "remove"); applyProject(plugin, root, "remove", plan.planSha256); }
    assert.equal(readProjectFile(root, "AGENTS.md"), "Legacy user\nSuffix");
  }
});
test("unsafe unclosed user Markdown refuses during read-only plan", (t) => {
  for (const text of ["```text\nexample", "~~~\nexample", "<!-- unfinished", "Text\n<!-- unfinished\n```\n"]) {
    const root = fixture(t); write(root, "AGENTS.md", text); const before = snapshot(root);
    assert.throws(() => planProject(plugin, root, "init"), /unsafe Markdown insertion/); assert.deepEqual(snapshot(root), before);
  }
});
test("raw HTML containers must close before inserting governance", (t) => {
  for (const tag of ["script", "pre", "style", "textarea"]) {
    const root = fixture(t); write(root, "AGENTS.md", `<${tag}>\nexample`); const before = snapshot(root);
    assert.throws(() => planProject(plugin, root, "init"), new RegExp(`unclosed HTML ${tag} container`)); assert.deepEqual(snapshot(root), before);
    write(root, "AGENTS.md", `<${tag}>\nexample\n</${tag} >`); assert.throws(() => planProject(plugin, root, "init"), /unclosed HTML/);
    for (const text of [`<${tag}>\nexample\n</${tag}>`, `<${tag.toUpperCase()}>text</${tag.toUpperCase()}>`, `\`\`\`html\n<${tag}>\n\`\`\``, `<!--\n<${tag}>\n-->`]) {
      write(root, "AGENTS.md", text); const plan = planProject(plugin, root, "init"); const agents = plan.operations.find((op) => op.path === "AGENTS.md").after;
      assert.equal(applicableCorePointer(agents), true);
    }
  }
});
test("unclosed processing instructions declarations and CDATA refuse insertion", (t) => {
  for (const [open, end, label] of [["<?processing", "?>", "processing instruction"], ["<!DECL", ">", "declaration"], ["<![CDATA[", "]]>", "CDATA"]]) {
    for (const text of [open, `   ${open}`, `${open}\nunfinished`, `${open}\n\`\`\`\n<!-- unfinished`, `<pre>closed</pre>${open}`, `<?closed?>${open}`]) {
      const root = fixture(t); write(root, "AGENTS.md", text); const before = snapshot(root);
      assert.throws(() => planProject(plugin, root, "init"), new RegExp(`unclosed HTML ${label}`)); assert.deepEqual(snapshot(root), before);
    }
    for (const text of [`${open}closed${end}`, `${open}\nclosed\n${end}`, `   ${open}closed${end}`, `${open}\n<!--\n<pre>\n\`\n${end}`, `<pre>closed</pre>${open}closed${end}`]) {
      assert.doesNotThrow(() => assertMarkdownInsertion(text), JSON.stringify(text));
    }
    for (const text of [`\`\`\`html\n${open}\n\`\`\``, `\`${open}\``, `    ${open}`, `\\${open}`, `<!--\n${open}\n-->`, `<pre>${open}</pre>`]) {
      assert.doesNotThrow(() => assertMarkdownInsertion(text), JSON.stringify(text));
    }
    assert.throws(() => assertMarkdownInsertion(`${open}closed${end}<!-- unfinished`), /unclosed HTML comment/);
    assert.throws(() => assertMarkdownInsertion(`${open}closed${end}<pre>unfinished`), /unclosed HTML pre container/);
  }
  for (const prefix of ["<pre>closed</pre><!lowercase>", "<pre>closed</pre><![cdata[ignored]]>"]) {
    assert.doesNotThrow(() => assertMarkdownInsertion(prefix));
    assert.throws(() => assertMarkdownInsertion(`${prefix}<!-- unfinished`), /unclosed HTML comment/);
    assert.throws(() => assertMarkdownInsertion(`${prefix}<?unfinished`), /unclosed HTML processing instruction/);
  }
});
test("raw HTML closing tags do not hide unsafe trailing comments or containers", (t) => {
  for (const tag of ["script", "pre", "style", "textarea"]) {
    for (const prefix of [`<${tag}>text</${tag}>`, `<${tag}>\ntext\n</${tag}>`]) {
      for (const tail of ["<!-- unfinished", "<!-- closed --><!-- unfinished", "<pre>unfinished", "<!-- closed --><textarea>unfinished", "`<!--`", "\\`<!--\\`"]) {
        const root = fixture(t); write(root, "AGENTS.md", `${prefix}${tail}`); const before = snapshot(root);
        assert.throws(() => planProject(plugin, root, "init"), /unsafe Markdown insertion/); assert.deepEqual(snapshot(root), before);
      }
      for (const tail of ["<!-- closed -->", "<!-- <pre> -->", "<pre>closed</pre>", "<!-- closed --><textarea>closed</textarea>"]) {
        assert.doesNotThrow(() => assertMarkdownInsertion(`${prefix}${tail}`));
      }
    }
  }
});
test("escaped backtick openers cannot hide real unclosed HTML comments", (t) => {
  for (const text of ["\\`<!--\\`", "\\```<!--\\```", "\\\\\\`<!--`", "<!-- closed --> \\`<!--\\`", "`<!--` \\`<!--\\`"]) {
    const root = fixture(t); write(root, "AGENTS.md", text); const before = snapshot(root);
    assert.throws(() => planProject(plugin, root, "init"), /unclosed HTML comment/); assert.deepEqual(snapshot(root), before);
  }
  for (const text of ["`<!--`", "\\\\`<!--`", "`<!--\\`", "`` <!-- ` ``", "\\`<!-- complete -->\\`", "<!-- ` --> `<!--`"]) {
    assert.doesNotThrow(() => assertMarkdownInsertion(text), JSON.stringify(text));
  }
});
test("multiline code span closing ticks cannot conceal following real comments", (t) => {
  for (const text of ["`open\n`<!--`", "`open\r\n`<!--`", "`open\r`<!--`", "``open\n``<!--``", "\ufeff`open\n`<!--`", "`open\ncontinued\n`<!--`", "`open\n\\`<!--`", "`open\n`<!-- closed --><!-- unfinished`", "`unmatched\n\n`<!--` real <!-- unfinished", "`open\n<!--`", "``open\n<!--``", "`open\r\n<!--`", "`open\r<!--`", "\ufeff`open\n<!--`", "> prose `open\n<!-- `"]) {
    const root = fixture(t); write(root, "AGENTS.md", text); const before = snapshot(root);
    assert.throws(() => planProject(plugin, root, "init"), /unclosed HTML comment/, JSON.stringify(text)); assert.deepEqual(snapshot(root), before);
  }
  // Line-start <!-- is an interrupting HTML block, not a multiline code
  // literal. Prefix prose to retain a genuine inline-code positive case.
  for (const text of ["`open\ncontinued text <!--`", "``open\ncontinued text <!--``", "`open\r\ncontinued text <!--`", "`open\rcontinued text <!--`", "\ufeff`open\ncontinued text <!--`", "`open\n`<!-- closed -->`", "\\`open\n`<!--`", "`unmatched\n\n`<!--`", "`unmatched\n\n`<!--` <!-- closed -->"]) {
    assert.doesNotThrow(() => assertMarkdownInsertion(text), JSON.stringify(text));
  }
});
test("code spans respect block boundaries before insertion checks", (t) => {
  for (const text of ["`unmatched\n<pre>`", "`unmatched\n<?processing `", "`unmatched\n<![CDATA[ `"]) {
    const root = fixture(t); write(root, "AGENTS.md", text); const before = snapshot(root);
    assert.throws(() => planProject(plugin, root, "init"), /unclosed HTML/, JSON.stringify(text)); assert.deepEqual(snapshot(root), before);
  }
  for (const text of ["`unmatched\n\n`<!--`", "`unmatched\n---\n`<!--`", "`unmatched\n# Heading\n`<!--`", "`unmatched\n```example\n`<!--\n```\n`<!--`", "`unmatched\n<pre>`</pre>\n\n`<!--`"]) {
    assert.doesNotThrow(() => assertMarkdownInsertion(text), JSON.stringify(text));
  }
});
test("framing ownership detects edits and preserves independent prefix and suffix edits", (t) => {
  const root = fixture(t); write(root, "AGENTS.md", "original"); adopt(root);
  const original = readProjectFile(root, "AGENTS.md"); write(root, "AGENTS.md", `Prefix\n${original}Suffix\n`);
  let plan = planProject(plugin, root, "update"); applyProject(plugin, root, "update", plan.planSha256);
  plan = planProject(plugin, root, "remove"); applyProject(plugin, root, "remove", plan.planSha256);
  assert.equal(readProjectFile(root, "AGENTS.md"), "Prefix\noriginalSuffix\n");
  adopt(root); const content = readProjectFile(root, "AGENTS.md"); write(root, "AGENTS.md", content.replace("\n\n<!-- forgerail:project", "\nX\n<!-- forgerail:project"));
  assert.throws(() => planProject(plugin, root, "remove"), /framing/);
});
