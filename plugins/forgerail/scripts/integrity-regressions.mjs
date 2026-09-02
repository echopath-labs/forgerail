#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { applyApprovedAdoptionWrite, planAdoption, renderProposedWrite } from "./lib/adoption.mjs";
import { buildBundle } from "../tools/lib/bundle.mjs";
import { createLaunchContract, resolveProfile, verifyReceipt } from "./lib/composition.mjs";
import { readJson, validateContract } from "./lib/contracts.mjs";
import { diagnoseWorkspace } from "./lib/diagnosis.mjs";
import { evaluateShadowComparison } from "./shadow-comparison.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = isPrivateLayout(root) ? resolve(root, "../..") : root;
const fixtureRoot = resolve(root, "scripts/fixtures/contracts");
const externalPluginNames = [
  "forgerail-cross-workspace-orchestration",
  "forgerail-github-rulesets",
  "forgerail-release-safety",
  "forgerail-thread-closure",
];
const assertions = [];
const temporaryRoots = [];

function pass(id, operation) {
  operation();
  assertions.push(id);
}

function temporary(prefix, base = tmpdir()) {
  const value = mkdtempSync(resolve(base, prefix));
  temporaryRoots.push(value);
  return value;
}

function clone(value) {
  return structuredClone(value);
}

function isPrivateLayout(path) {
  return existsSync(resolve(path, "marketplace/.agents/plugins/marketplace.json"));
}

function publicLayoutFixture(sourceRoot = root) {
  const publicRoot = resolve(temporary("forgerail-public-layout-"), "forgerail");
  cpSync(sourceRoot, publicRoot, { recursive: true, dereference: false });
  if (isPrivateLayout(publicRoot)) {
    mkdirSync(resolve(publicRoot, ".agents/plugins"), { recursive: true });
    cpSync(
      resolve(publicRoot, "marketplace/.agents/plugins/marketplace.json"),
      resolve(publicRoot, ".agents/plugins/marketplace.json"),
    );
    rmSync(resolve(publicRoot, "marketplace"), { recursive: true, force: true });
    for (const name of externalPluginNames) {
      cpSync(resolve(sourceRoot, "..", name), resolve(publicRoot, "plugins", name), { recursive: true, dereference: false });
    }
  }
  return publicRoot;
}

function privateLayoutFixture(sourceRoot = root) {
  if (isPrivateLayout(sourceRoot)) return sourceRoot;
  const ownerRoot = temporary("forgerail-private-owner-");
  const privateRoot = resolve(ownerRoot, "forgerail");
  cpSync(sourceRoot, privateRoot, { recursive: true, dereference: false });
  mkdirSync(resolve(privateRoot, "marketplace/.agents/plugins"), { recursive: true });
  cpSync(
    resolve(sourceRoot, ".agents/plugins/marketplace.json"),
    resolve(privateRoot, "marketplace/.agents/plugins/marketplace.json"),
  );
  rmSync(resolve(privateRoot, ".agents"), { recursive: true, force: true });
  for (const name of externalPluginNames) {
    cpSync(resolve(sourceRoot, "plugins", name), resolve(ownerRoot, name), { recursive: true, dereference: false });
  }
  rmSync(resolve(privateRoot, "plugins"), { recursive: true, force: true });
  return privateRoot;
}

try {
  pass("identifier-leading-punctuation-rejected", () => {
    const profile = clone(readJson(resolve(fixtureRoot, "effective-profile-v2.valid.json")));
    profile.profileId = "_invalid";
    assert.equal(validateContract("effective-profile-v2", profile).valid, false);
  });

  pass("adoption-plan-identifier-policy-matches-schema", () => {
    const plan = clone(readJson(resolve(fixtureRoot, "adoption-plan.single-host.valid.json")));
    const schema = readJson(resolve(root, "contracts/adoption-plan.schema.json"));
    const schemaPattern = new RegExp(schema.properties.planId.pattern);
    plan.planId = "a";
    assert.equal(validateContract("adoption-plan", plan).valid, false);
    assert.equal(schemaPattern.test(plan.planId), false);
    plan.planId = "a1";
    assert.equal(validateContract("adoption-plan", plan).valid, true);
    assert.equal(schemaPattern.test(plan.planId), true);
  });

  pass("invalid-calendar-date-rejected", () => {
    const reason = clone(readJson(resolve(fixtureRoot, "limited-reason.valid.json")));
    reason.observedAt = "2026-02-31T12:00:00Z";
    assert.equal(validateContract("limited-reason", reason).valid, false);
  });

  pass("literal-four-digit-years-are-preserved", () => {
    const reason = clone(readJson(resolve(fixtureRoot, "limited-reason.valid.json")));
    for (const observedAt of ["0000-02-29T00:00:00Z", "0001-01-01T00:00:00Z", "0099-12-31T23:59:59+23:59"]) {
      reason.observedAt = observedAt;
      assert.equal(validateContract("limited-reason", reason).valid, true, observedAt);
    }
    reason.observedAt = "0001-02-29T00:00:00Z";
    assert.equal(validateContract("limited-reason", reason).valid, false);
  });

  pass("windows-and-parent-paths-rejected", () => {
    const adapter = clone(readJson(resolve(fixtureRoot, "host-adapter.codex.valid.json")));
    for (const path of ["..\\outside", "C:\\outside", "\\\\server\\share"]) {
      adapter.bindingTarget = path;
      assert.equal(validateContract("host-adapter", adapter).valid, false, path);
    }
  });

  const pack = readJson(resolve(root, "packs/workspace-health-review.json"));
  const profileInput = {
    workspace: "fixture-workspace",
    rules: [{ id: "git.primary-branch", value: "main", source: "AGENTS.md", precedence: 1, status: "confirmed" }],
    packs: [{ id: pack.id, state: "required", reason: "Required for the fixture." }],
  };

  pass("duplicate-profile-identities-rejected", () => {
    assert.equal(resolveProfile(profileInput, [pack, pack]).valid, false);
    assert.equal(resolveProfile({ ...profileInput, packs: [...profileInput.packs, ...profileInput.packs] }, [pack]).valid, false);
    assert.equal(resolveProfile({ ...profileInput, rules: [...profileInput.rules, ...profileInput.rules] }, [pack]).valid, false);
  });

  const resolved = resolveProfile(profileInput, [pack]);
  assert.equal(resolved.valid, true, resolved.errors.join("; "));
  const envelope = readJson(resolve(fixtureRoot, "task-envelope.valid.json"));

  pass("required-pack-and-effective-profile-bound", () => {
    const missing = createLaunchContract(resolved.profile, envelope, "Codex", [pack]);
    assert.equal(missing.valid, false);
    assert.ok(missing.errors.some((error) => error.includes("omits required pack")));
    const included = createLaunchContract(resolved.profile, { ...envelope, packs: [pack.id] }, "Codex", [pack]);
    assert.equal(included.valid, true, included.errors.join("; "));
    assert.equal(included.launch.effectiveProfile.workspace, profileInput.workspace);
    assert.match(included.launch.effectiveProfile.digest, /^[0-9a-f]{64}$/);
    const workspaceMismatch = createLaunchContract(resolved.profile, { ...envelope, ownerWorkspace: "other", packs: [pack.id] }, "Codex", [pack]);
    assert.equal(workspaceMismatch.valid, false);
  });

  pass("malformed-receipt-fails-closed", () => {
    const result = verifyReceipt({}, workspaceRoot);
    assert.equal(result.valid, false);
    assert.equal(result.closeout, "incomplete");
    assert.ok(result.errors.length > 0);
  });

  pass("malformed-package-metadata-is-visible-and-private", () => {
    const workspace = temporary("forgerail-malformed-package-");
    writeFileSync(resolve(workspace, "package.json"), "{ invalid json\n");
    const result = diagnoseWorkspace(workspace, root);
    assert.ok(result.gaps.includes("package-metadata-malformed"));
    assert.equal(Object.hasOwn(result, "workspacePath"), false);
    assert.equal(JSON.stringify(result).includes(workspace), false);
  });

  pass("unusable-package-json-roots-are-visible-and-private", () => {
    for (const [name, value] of [["null", "null\n"], ["array", "[]\n"], ["scalar", '"package"\n']]) {
      const workspace = temporary(`forgerail-${name}-package-`);
      writeFileSync(resolve(workspace, "package.json"), value);
      const result = diagnoseWorkspace(workspace, root);
      assert.ok(result.gaps.includes("package-metadata-malformed"));
      assert.equal(result.evidence.find(({ id }) => id === "package-metadata")?.value.reason, "invalid-root-shape");
      assert.equal(JSON.stringify(result).includes(workspace), false);
    }
  });

  pass("adoption-rejects-symlink-target", () => {
    const workspace = temporary("forgerail-adoption-");
    const outside = resolve(temporary("forgerail-outside-"), "AGENTS.md");
    writeFileSync(outside, "outside\n");
    symlinkSync(outside, resolve(workspace, "AGENTS.md"));
    assert.throws(() => planAdoption(root, workspace, ["codex"]), /symbolic link/);
  });

  pass("adoption-rejects-dangling-symlink-target-and-ancestor", () => {
    const finalWorkspace = temporary("forgerail-adoption-dangling-final-");
    const finalOutside = resolve(temporary("forgerail-dangling-final-outside-"), "missing-AGENTS.md");
    symlinkSync(finalOutside, resolve(finalWorkspace, "AGENTS.md"));
    assert.throws(() => planAdoption(root, finalWorkspace, ["codex"]), /symbolic link/);
    assert.equal(existsSync(finalOutside), false);

    const ancestorWorkspace = temporary("forgerail-adoption-dangling-ancestor-");
    const ancestorOutside = resolve(temporary("forgerail-dangling-ancestor-outside-"), "missing-rules");
    mkdirSync(resolve(ancestorWorkspace, ".cursor"), { recursive: true });
    symlinkSync(ancestorOutside, resolve(ancestorWorkspace, ".cursor/rules"));
    assert.throws(() => planAdoption(root, ancestorWorkspace, ["cursor"]), /symbolic link/);
    assert.equal(existsSync(resolve(ancestorOutside, "forgerail.mdc")), false);

    const driftWorkspace = temporary("forgerail-adoption-dangling-drift-");
    const plan = planAdoption(root, driftWorkspace, ["codex"]);
    const driftOutside = resolve(temporary("forgerail-dangling-drift-outside-"), "missing-AGENTS.md");
    symlinkSync(driftOutside, resolve(driftWorkspace, "AGENTS.md"));
    assert.throws(() => renderProposedWrite(driftWorkspace, plan.proposedWrites[0]), /symbolic link/);
    assert.throws(() => applyApprovedAdoptionWrite(driftWorkspace, plan.proposedWrites[0], plan.proposedWrites[0].approvalSha256), /symbolic link/);
    assert.equal(existsSync(driftOutside), false);
  });

  pass("adoption-applies-only-approved-content", () => {
    const workspace = temporary("forgerail-adoption-approved-content-");
    const plan = planAdoption(root, workspace, ["codex", "cursor"]);
    const write = clone(plan.proposedWrites.find(({ path }) => path === ".cursor/rules/forgerail.mdc"));
    const approvedWriteDigest = write.approvalSha256;
    write.content = `${write.content}\nunapproved\n`;
    assert.throws(() => renderProposedWrite(workspace, write), /approved content digest does not match/);
    assert.throws(() => applyApprovedAdoptionWrite(workspace, write, approvedWriteDigest), /approved write digest does not match/);
    assert.equal(existsSync(resolve(workspace, ".cursor")), false);
  });

  pass("adoption-binds-approved-write-metadata-before-destination-selection", () => {
    for (const mutate of [
      (write) => { write.workspaceSha256 = "0".repeat(64); },
      (write) => { write.path = "UNAPPROVED.md"; },
      (write) => { write.operation = "append-managed-block"; },
      (write) => { write.managedMarker = "forgerail:binding:cursor:v1"; },
    ]) {
      const workspace = temporary("forgerail-adoption-approved-metadata-");
      const write = clone(planAdoption(root, workspace, ["codex"]).proposedWrites[0]);
      const approvedWriteDigest = write.approvalSha256;
      mutate(write);
      assert.throws(() => applyApprovedAdoptionWrite(workspace, write, approvedWriteDigest), /approved write digest does not match/);
      assert.deepEqual(readdirSync(workspace), []);
    }
    const workspace = temporary("forgerail-adoption-missing-approval-digest-");
    const write = planAdoption(root, workspace, ["codex"]).proposedWrites[0];
    assert.throws(() => applyApprovedAdoptionWrite(workspace, write), /approved write digest does not match/);
    assert.deepEqual(readdirSync(workspace), []);

    const approvedWorkspace = temporary("forgerail-adoption-approved-workspace-");
    const replayWorkspace = temporary("forgerail-adoption-replay-workspace-");
    const approved = planAdoption(root, approvedWorkspace, ["codex"]).proposedWrites[0];
    assert.throws(
      () => applyApprovedAdoptionWrite(replayWorkspace, approved, approved.approvalSha256),
      /approved write digest does not match/,
    );
    assert.deepEqual(readdirSync(approvedWorkspace), []);
    assert.deepEqual(readdirSync(replayWorkspace), []);

    const dynamicWorkspace = temporary("forgerail-adoption-dynamic-write-");
    const stable = planAdoption(root, dynamicWorkspace, ["codex"]).proposedWrites[0];
    let pathReads = 0;
    const dynamic = { ...stable };
    Object.defineProperty(dynamic, "path", {
      enumerable: true,
      get() {
        pathReads += 1;
        return pathReads === 1 ? stable.path : "UNAPPROVED.md";
      },
    });
    const receipt = applyApprovedAdoptionWrite(dynamicWorkspace, dynamic, stable.approvalSha256);
    assert.equal(receipt.path, "AGENTS.md");
    assert.equal(existsSync(resolve(dynamicWorkspace, "AGENTS.md")), true);
    assert.equal(existsSync(resolve(dynamicWorkspace, "UNAPPROVED.md")), false);
    assert.equal(pathReads, 1);
  });

  pass("adoption-creates-bounded-parents-and-replaces-atomically", () => {
    const cursorWorkspace = temporary("forgerail-adoption-cursor-");
    const multiHost = planAdoption(root, cursorWorkspace, ["codex", "cursor"]);
    const cursorWrite = multiHost.proposedWrites.find(({ path }) => path === ".cursor/rules/forgerail.mdc");
    const cursorReceipt = applyApprovedAdoptionWrite(cursorWorkspace, cursorWrite, cursorWrite.approvalSha256);
    assert.equal(cursorReceipt.contentSha256, createHash("sha256").update(cursorWrite.content).digest("hex"));
    assert.equal(readFileSync(resolve(cursorWorkspace, cursorWrite.path), "utf8"), cursorWrite.content);
    assert.equal(readdirSync(resolve(cursorWorkspace, ".cursor/rules")).some((name) => name.startsWith(".forgerail-") && (name.endsWith(".tmp") || name.endsWith(".bak"))), false);

    const existingWorkspace = temporary("forgerail-adoption-existing-");
    writeFileSync(resolve(existingWorkspace, "AGENTS.md"), "existing instructions\n");
    const plan = planAdoption(root, existingWorkspace, ["codex"]);
    const approved = plan.proposedWrites[0];
    const expected = renderProposedWrite(existingWorkspace, approved);
    const receipt = applyApprovedAdoptionWrite(existingWorkspace, approved, approved.approvalSha256);
    assert.equal(readFileSync(resolve(existingWorkspace, "AGENTS.md"), "utf8"), expected);
    assert.equal(receipt.contentSha256, createHash("sha256").update(expected).digest("hex"));
    assert.equal(readdirSync(existingWorkspace).some((name) => name.startsWith(".forgerail-") && (name.endsWith(".tmp") || name.endsWith(".bak"))), false);
  });

  pass("invalid-pack-collections-fail-closed-with-structured-errors", () => {
    for (const [field, value] of [["dependencies", {}], ["dependencies", null], ["conflicts", "other-pack"]]) {
      const malformed = { ...clone(pack), [field]: value };
      const profileResult = resolveProfile(profileInput, [malformed]);
      assert.equal(profileResult.valid, false);
      assert.ok(profileResult.errors.some((error) => error.includes(`${field} must be an array`)), profileResult.errors.join("; "));
      const launchResult = createLaunchContract(resolved.profile, { ...envelope, packs: [pack.id] }, "Codex", [malformed]);
      assert.equal(launchResult.valid, false);
      assert.ok(launchResult.errors.some((error) => error.includes(`${field} must be an array`)), launchResult.errors.join("; "));
    }
  });

  pass("shadow-mutation-fails-coverage", () => {
    assert.equal(evaluateShadowComparison().behaviorCoverageReady, true);
    const mutated = evaluateShadowComparison({ "dirty-worktree-preservation": "" });
    assert.equal(mutated.behaviorCoverageReady, false);
    assert.ok(mutated.unresolved.includes("dirty-worktree-preservation"));
  });

  pass("bundle-private-public-layouts-are-deterministic-and-safe", () => {
    const privateRoot = privateLayoutFixture();
    const privateOutput = resolve(temporary("forgerail-private-output-parent-"), "bundle");
    const privateSecondOutput = resolve(temporary("forgerail-private-output-parent-"), "bundle");
    const first = buildBundle(privateRoot, privateOutput);
    const second = buildBundle(privateRoot, privateSecondOutput);
    assert.equal(first.digest, second.digest);
    assert.deepEqual(first.files, second.files);
    assert.ok(first.files.every((item) => item.type === "file" && /^[0-7]{3}$/.test(item.mode)));

    const publicRoot = publicLayoutFixture();
    writeFileSync(resolve(publicRoot, ".env"), "SHOULD_NOT_APPEAR=true\n");
    mkdirSync(resolve(publicRoot, "plugins/forgerail-release-safety/.git"), { recursive: true });
    writeFileSync(resolve(publicRoot, "plugins/forgerail-release-safety/.git/config"), "private\n");
    const publicOutput = resolve(temporary("forgerail-public-output-parent-"), "bundle");
    const publicResult = buildBundle(publicRoot, publicOutput);
    assert.equal(publicResult.digest, first.digest);
    assert.ok(publicResult.files.some((item) => item.path === "package-lock.json"));
    assert.ok(publicResult.files.some((item) => item.path === "plugins/forgerail/package-lock.json"));
    assert.equal(publicResult.files.some((item) => item.path.includes(".env") || item.path.includes("/.git/")), false);
    for (const item of publicResult.files) {
      const bytes = readFileSync(resolve(publicOutput, item.path));
      assert.equal(item.bytes, bytes.length, item.path);
      assert.equal(item.sha256, createHash("sha256").update(bytes).digest("hex"), item.path);
    }

    const reconstructedPrivateRoot = privateLayoutFixture(publicRoot);
    const reconstructedPrivateOutput = resolve(temporary("forgerail-reconstructed-private-output-parent-"), "bundle");
    const reconstructedPrivateResult = buildBundle(reconstructedPrivateRoot, reconstructedPrivateOutput);
    assert.equal(reconstructedPrivateResult.digest, first.digest);
    assert.deepEqual(reconstructedPrivateResult.files, first.files);

    const unsafeRoot = resolve(temporary("forgerail-unsafe-layout-"), "forgerail");
    cpSync(publicRoot, unsafeRoot, { recursive: true, dereference: false });
    symlinkSync(resolve(unsafeRoot, "README.md"), resolve(unsafeRoot, "plugins/forgerail-release-safety/scripts/leak.mjs"));
    const unsafeOutput = resolve(temporary("forgerail-unsafe-output-parent-"), "bundle");
    assert.throws(() => buildBundle(unsafeRoot, unsafeOutput), /symbolic link/);
    assert.equal(existsSync(unsafeOutput), false);

    const catalogSymlinkRoot = publicLayoutFixture();
    const catalogOutside = temporary("forgerail-catalog-outside-");
    mkdirSync(resolve(catalogOutside, "plugins"), { recursive: true });
    cpSync(
      resolve(catalogSymlinkRoot, ".agents/plugins/marketplace.json"),
      resolve(catalogOutside, "plugins/marketplace.json"),
    );
    rmSync(resolve(catalogSymlinkRoot, ".agents"), { recursive: true, force: true });
    symlinkSync(catalogOutside, resolve(catalogSymlinkRoot, ".agents"));
    const catalogSymlinkOutput = resolve(temporary("forgerail-catalog-symlink-output-"), "bundle");
    assert.throws(() => buildBundle(catalogSymlinkRoot, catalogSymlinkOutput), /symbolic link/);
    assert.equal(existsSync(catalogSymlinkOutput), false);

    const escapedParentTarget = temporary("forgerail-escaped-output-parent-");
    const outputLink = resolve(temporary("forgerail-output-link-parent-"), "outside");
    symlinkSync(escapedParentTarget, outputLink);
    assert.throws(() => buildBundle(root, resolve(outputLink, "bundle")), /symbolic links|below the host temporary directory/);
  });

  console.log(JSON.stringify({ valid: true, assertions, mutations: [], externalSideEffects: [] }, null, 2));
} finally {
  for (const path of temporaryRoots.reverse()) rmSync(path, { recursive: true, force: true });
}
