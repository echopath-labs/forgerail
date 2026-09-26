import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { adoptionWriteApprovalDigest, applyApprovedAdoptionWrite, loadHostAdapters, planAdoption, verifyCursorNoChangePlan } from "./lib/adoption.mjs";
import { cursorSharedContractCoverageEvidence, cursorSharedCoreCoverageEvidence, validateContract } from "./lib/contracts.mjs";
import { diagnoseWorkspace } from "./lib/diagnosis.mjs";

const recovery = "<!-- forgerail:portable-recovery:v1:start -->\nFixture recovery payload.\n<!-- forgerail:portable-recovery:v1:end -->\n";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function temporary(t, prefix) {
  const path = mkdtempSync(resolve(tmpdir(), prefix));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  return path;
}
function registry(t) {
  const path = temporary(t, "forgerail-closeout-registry-");
  for (const name of ["adapters", "templates"]) cpSync(resolve(root, name), resolve(path, name), { recursive: true });
  return path;
}

test("registry reports every non-object JSON root without crashing", (t) => {
  const plugin = registry(t);
  for (const value of [null, [], false, 1, "invalid"]) {
    writeFileSync(resolve(plugin, "adapters/malformed.json"), JSON.stringify(value));
    const result = loadHostAdapters(plugin);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.startsWith("malformed.json:")));
  }
});

test("received plans reject reserved, case-folded and ancestor target collisions", (t) => {
  const workspace = temporary(t, "forgerail-closeout-plan-");
  const plan = planAdoption(root, workspace, ["codex", "claude-code"]);
  assert.equal(validateContract("adoption-plan", plan).valid, true);
  for (const target of ["FORGERAIL.md/CLAUDE.md", "forgerail.md", "AGENTS.md", "agents.md", "AGENTS.md/nested.md"]) {
    const invalid = structuredClone(plan);
    invalid.hostSelection.hosts["claude-code"].bindingTarget = target;
    const write = invalid.proposedWrites.find(({ path }) => path === "CLAUDE.md");
    write.path = target;
    write.approvalSha256 = adoptionWriteApprovalDigest(write);
    const result = validateContract("adoption-plan", invalid);
    assert.equal(result.valid, false, target);
    assert.ok(result.errors.some((error) => error.includes("conflict")), result.errors.join("; "));
  }
  for (const writes of [null, {}, [null]]) {
    const invalid = structuredClone(plan);
    invalid.proposedWrites = writes;
    assert.equal(validateContract("adoption-plan", invalid).valid, false);
  }
  assert.equal(existsSync(resolve(workspace, "FORGERAIL.md")), false);
});

test("subset plans report existing unselected adoption without granting it writes", (t) => {
  const workspace = temporary(t, "forgerail-closeout-existing-host-");
  const path = resolve(workspace, "AGENTS.md");
  const content = "<!-- forgerail:binding:codex:v1:start -->\nExisting standalone rules.\n<!-- forgerail:binding:codex:v1:end -->\n";
  writeFileSync(path, content);
  const plan = planAdoption(root, workspace, ["claude-code"]);
  assert.equal(plan.currentLevel, "lightweight-adoption");
  assert.ok(plan.evidence.some((value) => value.includes("Unselected managed binding retained: AGENTS.md")));
  assert.deepEqual(plan.proposedWrites.map(({ path }) => path), ["FORGERAIL.md", "CLAUDE.md"]);
  assert.equal(readFileSync(path, "utf8"), content);
  const noChange = planAdoption(root, workspace, ["claude-code"], "plugin-only");
  assert.equal(noChange.strategy, "no-change");
  assert.equal(noChange.currentLevel, "lightweight-adoption");
  assert.deepEqual(noChange.proposedWrites, []);
});

test("Cursor plan surfaces a shared Core pointer and missing Skill before any write", (t) => {
  const workspace = temporary(t, "forgerail-cursor-shared-core-");
  const instructions = "Use .agents/skills/forgerail/SKILL.md for governed work.\n";
  writeFileSync(resolve(workspace, "AGENTS.md"), instructions);
  const missing = planAdoption(root, workspace, ["cursor"]);
  assert.ok(missing.evidence.some((value) => value.includes("Existing AGENTS.md references the project-local ForgeRail Core Skill")));
  assert.ok(missing.evidence.some((value) => value.includes("Core Skill is absent")));
  assert.deepEqual(missing.proposedWrites.map(({ path }) => path), ["FORGERAIL.md", ".cursor/rules/forgerail.mdc"]);
  assert.equal(existsSync(resolve(workspace, ".cursor")), false);

  mkdirSync(resolve(workspace, ".agents/skills/forgerail"), { recursive: true });
  writeFileSync(resolve(workspace, ".agents/skills/forgerail/SKILL.md"), "# ForgeRail Core\n");
  const wrongCore = planAdoption(root, workspace, ["cursor"]);
  assert.deepEqual(wrongCore.proposedWrites.map(({ path }) => path), ["FORGERAIL.md", ".cursor/rules/forgerail.mdc"]);
  assert.equal(wrongCore.evidence.includes(cursorSharedCoreCoverageEvidence), false);

  cpSync(resolve(root, "skills/forgerail"), resolve(workspace, ".agents/skills/forgerail"), { recursive: true });
  const ready = planAdoption(root, workspace, ["cursor"]);
  assert.ok(ready.evidence.includes(cursorSharedCoreCoverageEvidence));
  assert.equal(ready.hostSelection.hosts.cursor.status, "supported");
  assert.ok(ready.evidence.some((value) => /Core tree matches the package source; SHA-256: [a-f0-9]{64}/.test(value)));
  assert.equal(ready.evidence.some((value) => value.includes("review whether an additional Cursor Rule is needed")), false);
  assert.equal(ready.strategy, "no-change");
  assert.equal(ready.currentLevel, "lightweight-adoption");
  assert.deepEqual(ready.proposedWrites, []);
  assert.equal(validateContract("adoption-plan", ready).valid, true);
  const digest = createHash("sha256").update(instructions).digest("hex");
  const receipt = JSON.parse(readFileSync(resolve(root, "scripts/fixtures/contracts/host-binding-receipt.valid.json"), "utf8"));
  receipt.planId = ready.planId;
  receipt.workspace = ready.workspace;
  receipt.adoptionLevel = ready.proposedLevel;
  receipt.contractPath = null;
  receipt.hosts = [{ adapterId: "cursor", target: "AGENTS.md", baseSha256: digest, appliedSha256: digest, status: "verified", verification: ["Fresh Cursor IDE Agent session discovered the existing Core pointer."] }];
  receipt.changedFiles = [];
  assert.equal(validateContract("binding-receipt", receipt).valid, true);
  const unverifiedExisting = structuredClone(receipt);
  unverifiedExisting.hosts[0].baseSha256 = "0".repeat(64);
  assert.equal(validateContract("binding-receipt", unverifiedExisting).valid, false);
  const contradictoryReceipt = structuredClone(receipt);
  contradictoryReceipt.changedFiles = ["AGENTS.md"];
  assert.equal(validateContract("binding-receipt", contradictoryReceipt).valid, false);
  assert.equal(readFileSync(resolve(workspace, "AGENTS.md"), "utf8"), instructions);
  assert.equal(existsSync(resolve(workspace, "FORGERAIL.md")), false);
  assert.equal(existsSync(resolve(workspace, ".cursor")), false);

  const coexistenceWorkspace = temporary(t, "forgerail-cursor-existing-rule-");
  writeFileSync(resolve(coexistenceWorkspace, "AGENTS.md"), instructions);
  mkdirSync(resolve(coexistenceWorkspace, ".agents/skills"), { recursive: true });
  cpSync(resolve(root, "skills/forgerail"), resolve(coexistenceWorkspace, ".agents/skills/forgerail"), { recursive: true });
  mkdirSync(resolve(coexistenceWorkspace, ".cursor/rules"), { recursive: true });
  const existingRule = "Existing Cursor owner instructions.\n";
  writeFileSync(resolve(coexistenceWorkspace, ".cursor/rules/forgerail.mdc"), existingRule);
  const coexistence = planAdoption(root, coexistenceWorkspace, ["cursor"]);
  assert.ok(coexistence.evidence.some((value) => value.includes("Existing Cursor Rule at .cursor/rules/forgerail.mdc is available")));
  assert.equal(coexistence.strategy, "no-change");
  assert.equal(coexistence.hostSelection.hosts.cursor.status, "profile-only");
  assert.equal(coexistence.cursorCoverage, undefined);
  assert.equal(validateContract("adoption-plan", coexistence).valid, true);
  assert.deepEqual(coexistence.proposedWrites, []);
  assert.equal(diagnoseWorkspace(coexistenceWorkspace, root).evidence.find(({ id }) => id === "host-adapters").value.find(({ id }) => id === "cursor").status, "profile-only");
  assert.throws(() => planAdoption(root, coexistenceWorkspace, ["claude-code", "cursor"]), /Host binding target already exists without a ForgeRail managed marker/);
  assert.equal(readFileSync(resolve(coexistenceWorkspace, ".cursor/rules/forgerail.mdc"), "utf8"), existingRule);

  const withClaude = planAdoption(root, workspace, ["claude-code", "cursor"]);
  assert.deepEqual(withClaude.proposedWrites.map(({ path }) => path), ["FORGERAIL.md", "CLAUDE.md", ".cursor/rules/forgerail.mdc"]);
  assert.equal(withClaude.evidence.includes(cursorSharedCoreCoverageEvidence), false);
  assert.equal(withClaude.hostSelection.hosts.cursor.status, "profile-only");
  const falselySupported = structuredClone(withClaude);
  falselySupported.hostSelection.hosts.cursor.status = "supported";
  falselySupported.hostSelection.hosts.cursor.verificationMode = "new-task-discovery";
  const rejectedPromotion = validateContract("adoption-plan", falselySupported);
  assert.equal(rejectedPromotion.valid, false);
  assert.ok(rejectedPromotion.errors.some((error) => error.includes("must omit the Cursor Rule")));
  writeFileSync(resolve(workspace, "AGENTS.md"), `${instructions}Follow FORGERAIL.md for the shared contract.\n`);
  const withSharedContract = planAdoption(root, workspace, ["claude-code", "cursor"]);
  assert.deepEqual(withSharedContract.proposedWrites.map(({ path }) => path), ["FORGERAIL.md", "CLAUDE.md"]);
  assert.equal(withSharedContract.hostSelection.hosts.cursor.status, "supported");
  assert.ok(withSharedContract.evidence.includes(cursorSharedContractCoverageEvidence));
  writeFileSync(resolve(workspace, "AGENTS.md"), instructions);
  assert.equal(existsSync(resolve(workspace, "CLAUDE.md")), false);

  writeFileSync(resolve(workspace, ".agents/skills/forgerail/references/adoption.md"), "# Drifted reference\n");
  const drifted = planAdoption(root, workspace, ["cursor"]);
  assert.deepEqual(drifted.proposedWrites.map(({ path }) => path), ["FORGERAIL.md", ".cursor/rules/forgerail.mdc"]);
  assert.equal(drifted.evidence.includes(cursorSharedCoreCoverageEvidence), false);

  cpSync(resolve(root, "skills/forgerail"), resolve(workspace, ".agents/skills/forgerail"), { recursive: true });
  writeFileSync(resolve(workspace, ".agents/skills/forgerail/EXTRA.md"), "Competing instructions\n");
  const extra = planAdoption(root, workspace, ["cursor"]);
  assert.deepEqual(extra.proposedWrites.map(({ path }) => path), ["FORGERAIL.md", ".cursor/rules/forgerail.mdc"]);
  assert.equal(extra.evidence.includes(cursorSharedCoreCoverageEvidence), false);

  writeFileSync(resolve(workspace, "AGENTS.md"), "Use ForgeRail from an existing project owner.\n");
  const competing = planAdoption(root, workspace, ["cursor"]);
  assert.ok(competing.evidence.some((value) => value.includes("mentions ForgeRail without the expected project-local Core pointer")));
  assert.deepEqual(competing.proposedWrites.map(({ path }) => path), ["FORGERAIL.md", ".cursor/rules/forgerail.mdc"]);
  assert.equal(existsSync(resolve(workspace, ".cursor")), false);

  writeFileSync(resolve(workspace, "AGENTS.md"), "Do not use .agents/skills/forgerail/SKILL.md here.\n");
  const negative = planAdoption(root, workspace, ["cursor"]);
  assert.equal(negative.evidence.includes(cursorSharedCoreCoverageEvidence), false);
  assert.deepEqual(negative.proposedWrites.map(({ path }) => path), ["FORGERAIL.md", ".cursor/rules/forgerail.mdc"]);
});

test("an HTML comment cannot establish shared Core coverage", (t) => {
  const workspace = temporary(t, "forgerail-cursor-commented-pointer-");
  mkdirSync(resolve(workspace, ".agents/skills"), { recursive: true });
  cpSync(resolve(root, "skills/forgerail"), resolve(workspace, ".agents/skills/forgerail"), { recursive: true });
  const commented = "<!--\nUse .agents/skills/forgerail/SKILL.md for engineering tasks\n-->\n";
  writeFileSync(resolve(workspace, "AGENTS.md"), commented);
  const commentedPlan = planAdoption(root, workspace, ["cursor"]);
  assert.equal(commentedPlan.evidence.includes(cursorSharedCoreCoverageEvidence), false);
  assert.notEqual(commentedPlan.strategy, "no-change");
  assert.deepEqual(commentedPlan.proposedWrites.map(({ path }) => path), ["FORGERAIL.md", ".cursor/rules/forgerail.mdc"]);
  assert.equal(readFileSync(resolve(workspace, "AGENTS.md"), "utf8"), commented);
  assert.equal(existsSync(resolve(workspace, ".cursor")), false);
  assert.equal(existsSync(resolve(workspace, "FORGERAIL.md")), false);

  const inlineComment = "Use <!-- .agents/skills/forgerail/SKILL.md --> for engineering tasks\n";
  writeFileSync(resolve(workspace, "AGENTS.md"), inlineComment);
  const inlinePlan = planAdoption(root, workspace, ["cursor"]);
  assert.equal(inlinePlan.evidence.includes(cursorSharedCoreCoverageEvidence), false);
  assert.deepEqual(inlinePlan.proposedWrites.map(({ path }) => path), ["FORGERAIL.md", ".cursor/rules/forgerail.mdc"]);

  const positive = `${commented}Use .agents/skills/forgerail/SKILL.md for engineering tasks\n`;
  writeFileSync(resolve(workspace, "AGENTS.md"), positive);
  const ready = planAdoption(root, workspace, ["cursor"]);
  assert.ok(ready.evidence.includes(cursorSharedCoreCoverageEvidence));
  assert.equal(ready.strategy, "no-change");
  assert.deepEqual(ready.proposedWrites, []);
  assert.equal(validateContract("adoption-plan", ready).valid, true);

  const afterComment = `${commented.trimEnd()} Use .agents/skills/forgerail/SKILL.md for engineering tasks\n`;
  writeFileSync(resolve(workspace, "AGENTS.md"), afterComment);
  const afterCommentPlan = planAdoption(root, workspace, ["cursor"]);
  assert.equal(afterCommentPlan.strategy, "no-change");
  assert.deepEqual(afterCommentPlan.proposedWrites, []);

  const leadingComment = "<!-- Context --> Use .agents/skills/forgerail/SKILL.md for engineering tasks\n";
  writeFileSync(resolve(workspace, "AGENTS.md"), leadingComment);
  const leadingCommentPlan = planAdoption(root, workspace, ["cursor"]);
  assert.equal(leadingCommentPlan.strategy, "no-change");
  assert.deepEqual(leadingCommentPlan.proposedWrites, []);

  writeFileSync(resolve(workspace, "AGENTS.md"), positive);
  assert.equal(readFileSync(resolve(workspace, "AGENTS.md"), "utf8"), positive);
  assert.equal(existsSync(resolve(workspace, ".cursor")), false);
  assert.equal(existsSync(resolve(workspace, "FORGERAIL.md")), false);
});

test("tilde-fenced examples cannot establish shared Core or contract coverage", (t) => {
  const workspace = temporary(t, "forgerail-cursor-tilde-fence-");
  mkdirSync(resolve(workspace, ".agents/skills"), { recursive: true });
  cpSync(resolve(root, "skills/forgerail"), resolve(workspace, ".agents/skills/forgerail"), { recursive: true });
  writeFileSync(resolve(workspace, "AGENTS.md"), "~~~~md\nUse .agents/skills/forgerail/SKILL.md\n~~~\n~~~~\n");
  const exampleOnly = planAdoption(root, workspace, ["cursor"]);
  assert.equal(exampleOnly.strategy, "shared-contract-with-thin-bindings");
  assert.equal(exampleOnly.hostSelection.hosts.cursor.status, "profile-only");
  writeFileSync(resolve(workspace, "AGENTS.md"), "Use .agents/skills/forgerail/SKILL.md\n~~~md\nFollow FORGERAIL.md\n~~~\n");
  const hiddenContract = planAdoption(root, workspace, ["claude-code", "cursor"]);
  assert.deepEqual(hiddenContract.proposedWrites.map(({ path }) => path), ["FORGERAIL.md", "CLAUDE.md", ".cursor/rules/forgerail.mdc"]);
  writeFileSync(resolve(workspace, "AGENTS.md"), "Use .agents/skills/forgerail/SKILL.md\nFollow NOTFORGERAIL.md\n");
  const wrongContract = planAdoption(root, workspace, ["claude-code", "cursor"]);
  assert.deepEqual(wrongContract.proposedWrites.map(({ path }) => path), ["FORGERAIL.md", "CLAUDE.md", ".cursor/rules/forgerail.mdc"]);
});

test("indented examples and competing Cursor-local Skills cannot establish shared Core coverage", (t) => {
  const workspace = temporary(t, "forgerail-cursor-competing-core-");
  mkdirSync(resolve(workspace, ".agents/skills"), { recursive: true });
  cpSync(resolve(root, "skills/forgerail"), resolve(workspace, ".agents/skills/forgerail"), { recursive: true });
  writeFileSync(resolve(workspace, "AGENTS.md"), "    Use .agents/skills/forgerail/SKILL.md\n");
  const indented = planAdoption(root, workspace, ["cursor"]);
  assert.equal(indented.hostSelection.hosts.cursor.status, "profile-only");
  assert.notEqual(indented.strategy, "no-change");
  writeFileSync(resolve(workspace, "AGENTS.md"), "Use .agents/skills/forgerail/SKILL.md\n");
  mkdirSync(resolve(workspace, ".cursor/skills/forgerail"), { recursive: true });
  writeFileSync(resolve(workspace, ".cursor/skills/forgerail/SKILL.md"), "# Competing Cursor Core\n");
  const competing = planAdoption(root, workspace, ["cursor"]);
  assert.equal(competing.hostSelection.hosts.cursor.status, "profile-only");
  assert.notEqual(competing.strategy, "no-change");
  assert.ok(competing.evidence.some((value) => value.includes("competing Cursor-local ForgeRail Core Skill")));
});

test("multi-host Cursor coverage is bound to every approved write", (t) => {
  const workspace = temporary(t, "forgerail-cursor-coverage-drift-");
  const instructions = "Use .agents/skills/forgerail/SKILL.md\nFollow FORGERAIL.md\n";
  writeFileSync(resolve(workspace, "AGENTS.md"), instructions);
  mkdirSync(resolve(workspace, ".agents/skills"), { recursive: true });
  cpSync(resolve(root, "skills/forgerail"), resolve(workspace, ".agents/skills/forgerail"), { recursive: true });
  const plan = planAdoption(root, workspace, ["claude-code", "cursor"]);
  assert.deepEqual(plan.proposedWrites.map(({ path }) => path), ["FORGERAIL.md", "CLAUDE.md"]);
  assert.equal(validateContract("adoption-plan", plan).valid, true);
  assert.ok(plan.proposedWrites.every((write) => write.coverage?.agentsSha256 && write.coverage?.coreSha256));
  const omittedCoverage = structuredClone(plan);
  delete omittedCoverage.proposedWrites[1].coverage;
  omittedCoverage.proposedWrites[1].approvalSha256 = adoptionWriteApprovalDigest(omittedCoverage.proposedWrites[1]);
  assert.equal(validateContract("adoption-plan", omittedCoverage).valid, false);
  const reorderedCoverage = structuredClone(plan);
  const reorderedWrite = reorderedCoverage.proposedWrites[1];
  reorderedWrite.coverage = { sourceCoreSha256: reorderedWrite.coverage.sourceCoreSha256, coreSha256: reorderedWrite.coverage.coreSha256, agentsSha256: reorderedWrite.coverage.agentsSha256 };
  reorderedWrite.approvalSha256 = adoptionWriteApprovalDigest(reorderedWrite);
  assert.equal(validateContract("adoption-plan", reorderedCoverage).valid, true);

  writeFileSync(resolve(workspace, "AGENTS.md"), "No ForgeRail pointer here.\n");
  for (const write of plan.proposedWrites) {
    assert.throws(() => applyApprovedAdoptionWrite(workspace, write, write.approvalSha256), /Cursor shared coverage changed/);
    assert.equal(existsSync(resolve(workspace, write.path)), false);
  }
  writeFileSync(resolve(workspace, "AGENTS.md"), instructions);
  const corePath = resolve(workspace, ".agents/skills/forgerail/references/adoption.md");
  const prior = readFileSync(corePath, "utf8");
  writeFileSync(corePath, "# Drifted Core\n");
  assert.throws(() => applyApprovedAdoptionWrite(workspace, plan.proposedWrites[0], plan.proposedWrites[0].approvalSha256), /Cursor shared coverage changed/);
  writeFileSync(corePath, prior);
  const competingSkill = resolve(workspace, ".cursor/skills/forgerail/SKILL.md");
  mkdirSync(dirname(competingSkill), { recursive: true });
  writeFileSync(competingSkill, "# Competing Core\n");
  assert.throws(() => applyApprovedAdoptionWrite(workspace, plan.proposedWrites[0], plan.proposedWrites[0].approvalSha256), /Cursor shared coverage changed/);
  rmSync(resolve(workspace, ".cursor"), { recursive: true });
  mkdirSync(resolve(workspace, ".cursor/rules"), { recursive: true });
  writeFileSync(resolve(workspace, ".cursor/rules/forgerail.mdc"), "New competing Rule\n");
  assert.throws(() => applyApprovedAdoptionWrite(workspace, plan.proposedWrites[0], plan.proposedWrites[0].approvalSha256), /Cursor shared coverage changed/);
  rmSync(resolve(workspace, ".cursor"), { recursive: true });
  const applied = applyApprovedAdoptionWrite(workspace, plan.proposedWrites[0], plan.proposedWrites[0].approvalSha256);
  assert.equal(applied.path, "FORGERAIL.md");
});

test("covered writes reject a package Core that changed after planning", async (t) => {
  const workspace = temporary(t, "forgerail-cursor-package-drift-");
  const plugin = realpathSync(temporary(t, "forgerail-cursor-package-drift-source-"));
  for (const path of ["scripts/lib", "skills/forgerail", "adapters", "templates"]) {
    cpSync(resolve(root, path), resolve(plugin, path), { recursive: true });
  }
  const runtime = await import(pathToFileURL(resolve(plugin, "scripts/lib/adoption.mjs")).href);
  writeFileSync(resolve(workspace, "AGENTS.md"), "Use .agents/skills/forgerail/SKILL.md.\nFollow FORGERAIL.md.\n");
  mkdirSync(resolve(workspace, ".agents/skills"), { recursive: true });
  cpSync(resolve(plugin, "skills/forgerail"), resolve(workspace, ".agents/skills/forgerail"), { recursive: true });
  const plan = runtime.planAdoption(plugin, workspace, ["claude-code", "cursor"]);
  const write = plan.proposedWrites[0];
  assert.ok(write.coverage?.sourceCoreSha256, JSON.stringify(plan.evidence));
  writeFileSync(resolve(plugin, "skills/forgerail/references/adoption.md"), "# Changed package Core\n");
  assert.throws(() => runtime.applyApprovedAdoptionWrite(workspace, write, write.approvalSha256), /Cursor shared coverage changed/);
  writeFileSync(resolve(workspace, ".agents/skills/forgerail/references/adoption.md"), "# Changed package Core\n");
  const unaccepted = runtime.planAdoption(plugin, workspace, ["cursor"]);
  assert.equal(unaccepted.hostSelection.hosts.cursor.status, "profile-only");
  assert.notEqual(unaccepted.strategy, "no-change");
});

test("received covered plans reject a final AGENTS.md without the Core pointer", (t) => {
  const workspace = temporary(t, "forgerail-cursor-final-agents-");
  const prior = "<!-- forgerail:binding:codex:v1:start -->\nUse .agents/skills/forgerail/SKILL.md.\nFollow FORGERAIL.md.\n<!-- forgerail:binding:codex:v1:end -->\n";
  writeFileSync(resolve(workspace, "AGENTS.md"), prior);
  mkdirSync(resolve(workspace, ".agents/skills"), { recursive: true });
  cpSync(resolve(root, "skills/forgerail"), resolve(workspace, ".agents/skills/forgerail"), { recursive: true });
  const plan = planAdoption(root, workspace, ["codex", "cursor"]);
  assert.equal(plan.hostSelection.hosts.cursor.status, "profile-only");
  const received = structuredClone(plan);
  received.hostSelection.hosts.cursor.status = "supported";
  received.hostSelection.hosts.cursor.verificationMode = "new-task-discovery";
  received.evidence.push(cursorSharedContractCoverageEvidence);
  received.proposedWrites = received.proposedWrites.filter((write) => write.path !== ".cursor/rules/forgerail.mdc");
  const digest = createHash("sha256").update(prior).digest("hex");
  const coreDigest = plan.evidence.find((item) => item.includes("Core tree matches the package source"))?.match(/[a-f0-9]{64}/)?.[0];
  const workspaceSha256 = received.proposedWrites[0].workspaceSha256;
  received.cursorCoverage = { workspaceSha256, agentsContent: prior, agentsSha256: digest, coreSha256: coreDigest, sourceCoreSha256: coreDigest };
  for (const write of received.proposedWrites) {
    write.coverage = { agentsSha256: digest, coreSha256: coreDigest, sourceCoreSha256: coreDigest };
    write.approvalSha256 = adoptionWriteApprovalDigest(write);
  }
  assert.ok(validateContract("adoption-plan", received).errors.some((error) => error.includes("final covered AGENTS.md must retain")));
});

test("supported Cursor no-change plans require checked workspace evidence", (t) => {
  const workspace = temporary(t, "forgerail-cursor-no-change-check-");
  const instructions = "Use .agents/skills/forgerail/SKILL.md.\n";
  writeFileSync(resolve(workspace, "AGENTS.md"), instructions);
  mkdirSync(resolve(workspace, ".agents/skills"), { recursive: true });
  cpSync(resolve(root, "skills/forgerail"), resolve(workspace, ".agents/skills/forgerail"), { recursive: true });
  const plan = planAdoption(root, workspace, ["cursor"]);
  assert.equal(validateContract("adoption-plan", plan).valid, true);
  assert.doesNotThrow(() => verifyCursorNoChangePlan(workspace, plan));
  const replayWorkspace = temporary(t, "forgerail-cursor-no-change-replay-");
  writeFileSync(resolve(replayWorkspace, "AGENTS.md"), instructions);
  mkdirSync(resolve(replayWorkspace, ".agents/skills"), { recursive: true });
  cpSync(resolve(root, "skills/forgerail"), resolve(replayWorkspace, ".agents/skills/forgerail"), { recursive: true });
  assert.throws(() => verifyCursorNoChangePlan(replayWorkspace, plan), /different workspace/);
  writeFileSync(resolve(workspace, "AGENTS.md"), `${instructions}Use this Core for bounded tasks.\n`);
  const renewed = planAdoption(root, workspace, ["cursor"]);
  assert.notEqual(renewed.planId, plan.planId);
  writeFileSync(resolve(workspace, "AGENTS.md"), instructions);
  const missing = structuredClone(plan);
  delete missing.cursorCoverage;
  assert.equal(validateContract("adoption-plan", missing).valid, false);
  const extraHost = structuredClone(plan);
  extraHost.hostSelection.hosts["claude-code"] = { status: "profile-only", bindingTarget: "CLAUDE.md", verificationMode: "profile-only" };
  assert.ok(validateContract("adoption-plan", extraHost).errors.some((error) => error.includes("Cursor-only selection")));
  const falsePointer = structuredClone(plan);
  falsePointer.cursorCoverage.agentsContent = "Do not use .agents/skills/forgerail/SKILL.md.\n";
  falsePointer.cursorCoverage.agentsSha256 = createHash("sha256").update(falsePointer.cursorCoverage.agentsContent).digest("hex");
  assert.ok(validateContract("adoption-plan", falsePointer).errors.some((error) => error.includes("applicable Core pointer")));
  rmSync(resolve(workspace, "AGENTS.md"));
  assert.throws(() => verifyCursorNoChangePlan(workspace, plan), /Cursor shared coverage changed/);
});

test("a shared Cursor plan applies a selected AGENTS.md binding after its other writes", (t) => {
  const workspace = temporary(t, "forgerail-cursor-shared-codex-");
  writeFileSync(resolve(workspace, "AGENTS.md"), "Use .agents/skills/forgerail/SKILL.md\nFollow FORGERAIL.md\n");
  mkdirSync(resolve(workspace, ".agents/skills"), { recursive: true });
  cpSync(resolve(root, "skills/forgerail"), resolve(workspace, ".agents/skills/forgerail"), { recursive: true });
  const plan = planAdoption(root, workspace, ["codex", "cursor", "claude-code"]);
  assert.deepEqual(plan.proposedWrites.map(({ path }) => path), ["FORGERAIL.md", "CLAUDE.md", "AGENTS.md"]);
  assert.equal(validateContract("adoption-plan", plan).valid, true);
  const agentsFirst = structuredClone(plan);
  agentsFirst.proposedWrites = [plan.proposedWrites[2], plan.proposedWrites[0], plan.proposedWrites[1]];
  assert.ok(validateContract("adoption-plan", agentsFirst).errors.some((error) => error.includes("AGENTS.md to be the final write")));
  const contractSecond = structuredClone(plan);
  contractSecond.proposedWrites = [plan.proposedWrites[1], plan.proposedWrites[0], plan.proposedWrites[2]];
  assert.ok(validateContract("adoption-plan", contractSecond).errors.some((error) => error.includes("FORGERAIL.md before Host bindings")));
  for (const write of plan.proposedWrites) assert.equal(applyApprovedAdoptionWrite(workspace, write, write.approvalSha256).path, write.path);
});

test("negated Core and contract mentions cannot suppress the Cursor Rule", (t) => {
  const workspace = temporary(t, "forgerail-cursor-negated-pointers-");
  mkdirSync(resolve(workspace, ".agents/skills"), { recursive: true });
  cpSync(resolve(root, "skills/forgerail"), resolve(workspace, ".agents/skills/forgerail"), { recursive: true });
  writeFileSync(resolve(workspace, "AGENTS.md"), "Use another Core, not .agents/skills/forgerail/SKILL.md.\nFollow FORGERAIL.md.\n");
  const rejectedCore = planAdoption(root, workspace, ["cursor"]);
  assert.equal(rejectedCore.hostSelection.hosts.cursor.status, "profile-only");
  assert.deepEqual(rejectedCore.proposedWrites.map(({ path }) => path), ["FORGERAIL.md", ".cursor/rules/forgerail.mdc"]);

  writeFileSync(resolve(workspace, "AGENTS.md"), "Use .agents/skills/forgerail/SKILL.md.\nFollow another contract, not FORGERAIL.md.\n");
  const rejectedContract = planAdoption(root, workspace, ["claude-code", "cursor"]);
  assert.equal(rejectedContract.hostSelection.hosts.cursor.status, "profile-only");
  assert.deepEqual(rejectedContract.proposedWrites.map(({ path }) => path), ["FORGERAIL.md", "CLAUDE.md", ".cursor/rules/forgerail.mdc"]);

  writeFileSync(resolve(workspace, "AGENTS.md"), "1. Use .agents/skills/forgerail/SKILL.md.\n2) Follow FORGERAIL.md.\n");
  const orderedCore = planAdoption(root, workspace, ["cursor"]);
  assert.equal(orderedCore.hostSelection.hosts.cursor.status, "profile-only");
  assert.deepEqual(orderedCore.proposedWrites.map(({ path }) => path), ["FORGERAIL.md", ".cursor/rules/forgerail.mdc"]);
  const orderedContract = planAdoption(root, workspace, ["claude-code", "cursor"]);
  assert.deepEqual(orderedContract.proposedWrites.map(({ path }) => path), ["FORGERAIL.md", "CLAUDE.md"]);

  writeFileSync(resolve(workspace, "AGENTS.md"), "Use another workflow; don't use .agents/skills/forgerail/SKILL.md.\n");
  const contractedNegative = planAdoption(root, workspace, ["cursor"]);
  assert.deepEqual(contractedNegative.proposedWrites.map(({ path }) => path), ["FORGERAIL.md", ".cursor/rules/forgerail.mdc"]);

  writeFileSync(resolve(workspace, "AGENTS.md"), "Use any Core but .agents/skills/forgerail/SKILL.md.\n");
  const exclusion = planAdoption(root, workspace, ["cursor"]);
  assert.equal(exclusion.hostSelection.hosts.cursor.status, "profile-only");
  assert.deepEqual(exclusion.proposedWrites.map(({ path }) => path), ["FORGERAIL.md", ".cursor/rules/forgerail.mdc"]);

  writeFileSync(resolve(workspace, "AGENTS.md"), "Use .agents/skills/forgerail/SKILL.md for old tasks. Do not use .agents/skills/forgerail/SKILL.md in this workspace.\n");
  const revoked = planAdoption(root, workspace, ["cursor"]);
  assert.equal(revoked.hostSelection.hosts.cursor.status, "profile-only");
  assert.deepEqual(revoked.proposedWrites.map(({ path }) => path), ["FORGERAIL.md", ".cursor/rules/forgerail.mdc"]);

  writeFileSync(resolve(workspace, "AGENTS.md"), "Use .agents/skills/forgerail/SKILL.md; do not edit it.\n");
  const separateRestriction = planAdoption(root, workspace, ["cursor"]);
  assert.equal(separateRestriction.hostSelection.hosts.cursor.status, "supported");
  assert.equal(separateRestriction.strategy, "no-change");

  writeFileSync(resolve(workspace, "AGENTS.md"), "Use .agents/skills/forgerail/SKILL.md, but do not edit it.\n");
  const inlineRestriction = planAdoption(root, workspace, ["cursor"]);
  assert.equal(inlineRestriction.hostSelection.hosts.cursor.status, "supported");
  assert.equal(inlineRestriction.strategy, "no-change");

  writeFileSync(resolve(workspace, "AGENTS.md"), "Use ../.agents/skills/forgerail/SKILL.md.\n");
  const traversingPointer = planAdoption(root, workspace, ["cursor"]);
  assert.equal(traversingPointer.hostSelection.hosts.cursor.status, "profile-only");
  assert.deepEqual(traversingPointer.proposedWrites.map(({ path }) => path), ["FORGERAIL.md", ".cursor/rules/forgerail.mdc"]);

  writeFileSync(resolve(workspace, "AGENTS.md"), "Use ./.agents/skills/forgerail/SKILL.md.\n");
  const localRelativePointer = planAdoption(root, workspace, ["cursor"]);
  assert.equal(localRelativePointer.hostSelection.hosts.cursor.status, "supported");
  assert.equal(localRelativePointer.strategy, "no-change");
});

test("Cursor no-change requires an available referenced contract", (t) => {
  const workspace = temporary(t, "forgerail-cursor-contract-availability-");
  mkdirSync(resolve(workspace, ".agents/skills"), { recursive: true });
  cpSync(resolve(root, "skills/forgerail"), resolve(workspace, ".agents/skills/forgerail"), { recursive: true });
  writeFileSync(resolve(workspace, "AGENTS.md"), "Use .agents/skills/forgerail/SKILL.md.\nFollow FORGERAIL.md.\n");
  const missing = planAdoption(root, workspace, ["cursor"]);
  assert.equal(missing.hostSelection.hosts.cursor.status, "profile-only");
  assert.deepEqual(missing.proposedWrites.map(({ path }) => path), ["FORGERAIL.md", ".cursor/rules/forgerail.mdc"]);
  assert.ok(missing.evidence.some((value) => value.includes("requires FORGERAIL.md")));

  writeFileSync(resolve(workspace, "FORGERAIL.md"), "# Existing shared contract\n");
  const available = planAdoption(root, workspace, ["cursor"]);
  assert.equal(available.hostSelection.hosts.cursor.status, "supported");
  assert.equal(available.strategy, "no-change");
  rmSync(resolve(workspace, "FORGERAIL.md"));
  assert.throws(() => verifyCursorNoChangePlan(workspace, available), /Cursor shared coverage changed/);
});

test("diagnosis reports the effective Cursor route instead of registry capability", (t) => {
  const workspace = temporary(t, "forgerail-cursor-diagnosis-");
  mkdirSync(resolve(workspace, ".cursor"));
  const cursor = () => diagnoseWorkspace(workspace, root).evidence.find(({ id }) => id === "host-adapters").value.find(({ id }) => id === "cursor");
  assert.equal(cursor().status, "profile-only");
  assert.equal(cursor().effectiveRoute, "Cursor Rule or incomplete shared Core");
  rmSync(resolve(workspace, ".cursor"), { recursive: true });
  mkdirSync(resolve(workspace, ".agents/skills"), { recursive: true });
  cpSync(resolve(root, "skills/forgerail"), resolve(workspace, ".agents/skills/forgerail"), { recursive: true });
  writeFileSync(resolve(workspace, "AGENTS.md"), "Use .agents/skills/forgerail/SKILL.md.\n");
  assert.equal(cursor().status, "supported");
  assert.equal(cursor().effectiveRoute, "AGENTS.md + matching shared Core");
  assert.equal(cursor().observed, true);
  assert.deepEqual(Object.keys(planAdoption(root, workspace).hostSelection.hosts), ["codex", "cursor"]);
  assert.equal(diagnoseWorkspace(workspace, root).evidence.find(({ id }) => id === "forgerail-adoption-level").value, "lightweight-adoption");
});

test("received plans cannot attach Cursor coverage to unsupported routes", (t) => {
  const workspace = temporary(t, "forgerail-cursor-illegal-coverage-");
  const bogusCoverage = { agentsSha256: "0".repeat(64), coreSha256: "1".repeat(64) };
  const addCoverage = (plan, index) => {
    const changed = structuredClone(plan);
    changed.proposedWrites[index].coverage = bogusCoverage;
    changed.proposedWrites[index].approvalSha256 = adoptionWriteApprovalDigest(changed.proposedWrites[index]);
    return changed;
  };
  const single = planAdoption(root, workspace, ["codex"]);
  assert.equal(validateContract("adoption-plan", single).valid, true);
  assert.ok(validateContract("adoption-plan", addCoverage(single, 0)).errors.some((error) => error.includes("Cursor shared coverage is allowed only")));

  const withRule = planAdoption(root, workspace, ["claude-code", "cursor"]);
  assert.equal(validateContract("adoption-plan", withRule).valid, true);
  assert.ok(validateContract("adoption-plan", addCoverage(withRule, withRule.proposedWrites.length - 1)).errors.some((error) => error.includes("Cursor shared coverage is allowed only")));
});

test("Codex managed replacement cannot erase Cursor's only Core pointer", (t) => {
  const workspace = temporary(t, "forgerail-cursor-codex-replacement-");
  mkdirSync(resolve(workspace, ".agents/skills"), { recursive: true });
  cpSync(resolve(root, "skills/forgerail"), resolve(workspace, ".agents/skills/forgerail"), { recursive: true });
  writeFileSync(resolve(workspace, "AGENTS.md"), "<!-- forgerail:binding:codex:v1:start -->\nUse .agents/skills/forgerail/SKILL.md.\nFollow FORGERAIL.md.\n<!-- forgerail:binding:codex:v1:end -->\n");
  const plan = planAdoption(root, workspace, ["codex", "cursor"]);
  assert.equal(plan.hostSelection.hosts.cursor.status, "profile-only");
  assert.deepEqual(plan.proposedWrites.map(({ path }) => path), ["FORGERAIL.md", "AGENTS.md", ".cursor/rules/forgerail.mdc"]);
  assert.equal(validateContract("adoption-plan", plan).valid, true);
  for (const write of plan.proposedWrites) applyApprovedAdoptionWrite(workspace, write, write.approvalSha256);
  assert.equal(readFileSync(resolve(workspace, "AGENTS.md"), "utf8").includes(".agents/skills/forgerail/SKILL.md"), false);
  assert.equal(existsSync(resolve(workspace, ".cursor/rules/forgerail.mdc")), true);
});

test("shared Core coverage cannot drop another host write or keep the Cursor Rule", (t) => {
  const workspace = temporary(t, "forgerail-cursor-coverage-contract-");
  writeFileSync(resolve(workspace, "AGENTS.md"), "Use .agents/skills/forgerail/SKILL.md for governed work.\nFollow FORGERAIL.md for the shared contract.\n");
  mkdirSync(resolve(workspace, ".agents/skills"), { recursive: true });
  cpSync(resolve(root, "skills/forgerail"), resolve(workspace, ".agents/skills/forgerail"), { recursive: true });
  const withoutRule = planAdoption(root, workspace, ["claude-code", "cursor"]);
  assert.equal(validateContract("adoption-plan", withoutRule).valid, true);

  const uncovered = structuredClone(withoutRule);
  uncovered.evidence = uncovered.evidence.filter((value) => value !== cursorSharedContractCoverageEvidence);
  const missingCoverage = validateContract("adoption-plan", uncovered);
  assert.equal(missingCoverage.valid, false);
  assert.ok(missingCoverage.errors.some((error) => error.includes("one write per host")));

  const coreOnlyClaim = structuredClone(uncovered);
  coreOnlyClaim.evidence.push(cursorSharedCoreCoverageEvidence);
  const missingContractPointer = validateContract("adoption-plan", coreOnlyClaim);
  assert.equal(missingContractPointer.valid, false);
  assert.ok(missingContractPointer.errors.some((error) => error.includes("one write per host")));

  const stillProposed = structuredClone(withoutRule);
  writeFileSync(resolve(workspace, "AGENTS.md"), "No ForgeRail pointer here.\n");
  const cursorOnly = planAdoption(root, workspace, ["cursor"]);
  stillProposed.proposedWrites.push(cursorOnly.proposedWrites.find(({ path }) => path === ".cursor/rules/forgerail.mdc"));
  const contradictory = validateContract("adoption-plan", stillProposed);
  assert.equal(contradictory.valid, false);
  assert.ok(contradictory.errors.some((error) => error.includes("must not propose a Cursor Rule")));

  const droppedClaude = structuredClone(withoutRule);
  droppedClaude.proposedWrites = droppedClaude.proposedWrites.filter(({ path }) => path !== "CLAUDE.md");
  const missingClaude = validateContract("adoption-plan", droppedClaude);
  assert.equal(missingClaude.valid, false);
  assert.ok(missingClaude.errors.some((error) => error.includes("missing host binding: claude-code")));
});

test("unsafe unselected bindings remain non-blocking and unavailable", (t) => {
  const workspace = temporary(t, "forgerail-closeout-unsafe-host-");
  const outside = temporary(t, "forgerail-closeout-outside-");
  writeFileSync(resolve(outside, "CLAUDE.md"), "<!-- forgerail:binding:claude-code:v1:start -->\n");
  symlinkSync(resolve(outside, "CLAUDE.md"), resolve(workspace, "CLAUDE.md"));
  const plan = planAdoption(root, workspace, ["codex"]);
  assert.equal(plan.currentLevel, "plugin-only");
  assert.ok(plan.evidence.some((value) => value.includes("Unselected binding unavailable: CLAUDE.md")));
  assert.equal(plan.evidence.some((value) => value.includes(outside)), false);
  assert.deepEqual(plan.proposedWrites.map(({ path }) => path), ["AGENTS.md"]);
});

test("thin templates contain an exact shared-contract reference inside their managed block", (t) => {
  const plugin = registry(t);
  const adapter = JSON.parse(readFileSync(resolve(plugin, "adapters/claude-code.json"), "utf8"));
  const path = resolve(plugin, "templates", adapter.bindingTemplates["thin-reference"]);
  const start = `<!-- ${adapter.managedMarker}:start -->`;
  const end = `<!-- ${adapter.managedMarker}:end -->`;
  for (const content of [
    `${start}\n${recovery}Unrelated instructions.\n${end}`,
    `Follow FORGERAIL.md.\n${start}\n${recovery}Unrelated instructions.\n${end}`,
    `${start}\n${recovery}Follow NOTFORGERAIL.md.\n${end}`,
  ]) {
    writeFileSync(path, content);
    const result = loadHostAdapters(plugin);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.includes("shared contract reference")), result.errors.join("; "));
  }
  writeFileSync(path, `${start}\n${recovery}Follow \`FORGERAIL.md\`.\n${end}\n`);
  assert.equal(loadHostAdapters(plugin).valid, true);
});

function recoveryRange(content) {
  const start = content.indexOf("<!-- forgerail:portable-recovery:v1:start -->");
  const endMarker = "<!-- forgerail:portable-recovery:v1:end -->";
  const end = content.indexOf(endMarker, start) + endMarker.length;
  assert.ok(start >= 0 && end > start);
  return { start, end, block: content.slice(start, end) };
}

test("every adoption template rejects removed, empty, repeated or displaced recovery blocks", (t) => {
  const plugin = registry(t);
  const workspace = temporary(t, "forgerail-recovery-mutation-");
  const adapters = loadHostAdapters(plugin).adapters;
  const cases = [{ path: "FORGERAIL.md", hosts: adapters.map(({ id }) => id) }];
  for (const adapter of adapters) {
    for (const [mode, path] of Object.entries(adapter.bindingTemplates)) {
      cases.push({ path, hosts: mode === "managed-block" ? [adapter.id] : adapters.map(({ id }) => id) });
    }
  }
  for (const { path, hosts } of cases) {
    const template = resolve(plugin, "templates", path);
    const original = readFileSync(template, "utf8");
    const { start, end, block } = recoveryRange(original);
    const removed = original.slice(0, start) + original.slice(end);
    const empty = "<!-- forgerail:portable-recovery:v1:start -->\n \n<!-- forgerail:portable-recovery:v1:end -->";
    for (const invalid of [removed, original.slice(0, start) + empty + original.slice(end), block + "\n" + removed, original.slice(0, start) + block + block + original.slice(end)]) {
      writeFileSync(template, invalid);
      assert.throws(() => planAdoption(plugin, workspace, hosts), /portable recovery block/, path);
    }
    writeFileSync(template, original);
  }
  assert.equal(existsSync(resolve(workspace, "AGENTS.md")), false);
  assert.equal(existsSync(resolve(workspace, "FORGERAIL.md")), false);
});

test("approved compact and all-host adoption retain recovery in owner files without the Plugin", (t) => {
  const plugin = registry(t);
  const adapters = loadHostAdapters(plugin).adapters;
  const selections = [...adapters.filter((a) => a.bindingModes.includes("managed-block")).map((a) => [a.id]), adapters.map((a) => a.id)];
  const installed = [];
  for (const hosts of selections) {
    const workspace = temporary(t, "forgerail-recovery-installed-");
    writeFileSync(resolve(workspace, "AGENTS.md"), "# Existing owner instructions\n\nKeep the current records.\n");
    const plan = planAdoption(plugin, workspace, hosts);
    for (const write of plan.proposedWrites) {
      const adapter = adapters.find((a) => a.bindingTarget === write.path);
      const mode = plan.strategy === "single-host-managed-block" ? "managed-block" : "thin-reference";
      const sourcePath = adapter ? adapter.bindingTemplates[mode] : "FORGERAIL.md";
      const expected = recoveryRange(readFileSync(resolve(plugin, "templates", sourcePath), "utf8")).block;
      assert.equal(recoveryRange(write.content).block, expected);
      applyApprovedAdoptionWrite(workspace, write, write.approvalSha256);
      installed.push({ path: resolve(workspace, write.path), expected, marker: write.managedMarker });
    }
    assert.ok(readFileSync(resolve(workspace, "AGENTS.md"), "utf8").startsWith("# Existing owner instructions\n"));
  }
  rmSync(plugin, { recursive: true, force: true });
  for (const { path, expected, marker } of installed) {
    const content = readFileSync(path, "utf8");
    const { start, end, block } = recoveryRange(content);
    assert.equal(block, expected);
    assert.ok(start > content.indexOf(`<!-- ${marker}:start -->`));
    assert.ok(end < content.indexOf(`<!-- ${marker}:end -->`));
  }
});
