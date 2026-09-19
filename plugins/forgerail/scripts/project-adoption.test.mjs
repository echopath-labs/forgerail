import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync, cpSync, symlinkSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { planProject, applyProject, doctorProject, planRecovery, recoverProject, releaseInterruptedLock } from "./lib/project-adoption.mjs";
import { projectDirectoryEntryLimit, residualWriteEvidence, hash, json, CONFIG, MANIFEST, JOURNAL, LOCK, readProjectFile } from "./lib/project-state.mjs";
import { planAdoption, observeAdoptionLevel, applyApprovedAdoptionWrite, adoptionWriteApprovalDigest, adoptionWorkspaceIdentity, applyProjectFile } from "./lib/adoption.mjs";
import { diagnoseWorkspace } from "./lib/diagnosis.mjs";
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
  const update = planProject(plugin, root, "update"); applyProject(plugin, root, "update", update.planSha256); assert.equal(doctorProject(plugin, root).installedVersion, "0.1.5");
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
test("plan operation limit accepts 520 operations through the execution gate", (t) => {
  const { root, source } = operationLimitFixture(t, 6), before = snapshot(root);
  const plan = planProject(source, root, "update"); assert.equal(plan.operations.length, 520);
  let reachedExecution = false;
  // Stop after real apply validation and journal creation, before the quadratic
  // write loop: ordinary lifecycle tests cover completed writes and rollback.
  assert.throws(() => applyProject(source, root, "update", plan.planSha256, {}, {
    beforeOperation(index) { assert.equal(index, 0); reachedExecution = true; throw new Error("boundary execution reached"); }
  }), /boundary execution reached; recovery-required/);
  assert.equal(reachedExecution, true);
  assert.equal(JSON.parse(readProjectFile(root, JOURNAL)).plan.operations.length, 520);
  recoverProject(root, planRecovery(root).planSha256);
  assert.deepEqual(snapshot(root), before);
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
