#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve, win32 } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { adoptionWriteApprovalDigest, applyApprovedAdoptionWrite, planAdoption, renderProposedWrite, resolveAdoptionWriteTarget } from "./lib/adoption.mjs";
import { createLaunchContract, resolveProfile, verifyReceipt } from "./lib/composition.mjs";
import { readJson, validateContract } from "./lib/contracts.mjs";
import { diagnoseWorkspace } from "./lib/diagnosis.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bundleModulePath = resolve(root, "tools/lib/bundle.mjs");
const bundleModule = existsSync(bundleModulePath)
  ? await import(pathToFileURL(bundleModulePath).href)
  : null;
const buildBundle = bundleModule?.buildBundle ?? null;
const pathIsConfined = bundleModule?.pathIsConfined ?? null;
const workspaceRoot = isPrivateLayout(root) ? resolve(root, "../..") : root;
const fixtureRoot = resolve(root, "scripts/fixtures/contracts");
const externalPluginNames = [
  "forgerail-cross-workspace-orchestration",
  "forgerail-github-rulesets",
  "forgerail-release-safety",
  "forgerail-thread-closure",
];
const hasExternalPackSources = externalPluginNames.every((name) =>
  existsSync(resolve(root, "plugins", name)) || existsSync(resolve(root, "..", name)),
);
const evaluateShadowComparison = hasExternalPackSources
  ? (await import(pathToFileURL(resolve(root, "scripts/shadow-comparison.mjs")).href)).evaluateShadowComparison
  : null;
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
    for (const path of ["..\\outside", "C:\\outside", "\\\\server\\share", "dir//AGENTS.md", "dir/./AGENTS.md", "dir/"]) {
      adapter.bindingTarget = path;
      assert.equal(validateContract("host-adapter", adapter).valid, false, path);
    }
  });

  pass("adoption-rejects-noncanonical-relative-path-segments", () => {
    const workspace = temporary("forgerail-adoption-noncanonical-path-");
    for (const path of ["dir//AGENTS.md", "dir/./AGENTS.md", "dir/"]) {
      assert.throws(() => resolveAdoptionWriteTarget(workspace, path), /unsafe/, path);
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

  pass("profile-schema-encodes-pack-identity", () => {
    const schema = readJson(resolve(root, "contracts/effective-profile.schema.json"));
    assert.equal(schema.properties?.packs?.type, "object");
    assert.equal(schema.properties?.packs?.propertyNames?.pattern, "^[a-z][a-z0-9-]+$");
    assert.deepEqual(Object.keys(resolved.profile.packs), [pack.id]);
    assert.deepEqual(resolved.profile.packs[pack.id], { state: "required", reason: "Required for the fixture." });
  });

  pass("required-pack-and-effective-profile-bound", () => {
    const missing = createLaunchContract(resolved.profile, envelope, "Codex", [pack]);
    assert.equal(missing.valid, false);
    assert.ok(missing.errors.some((error) => error.includes("omits required pack")));
    const included = createLaunchContract(resolved.profile, { ...envelope, packs: [pack.id] }, "Codex", [pack]);
    assert.equal(included.valid, true, included.errors.join("; "));
    assert.equal(Object.hasOwn(included.launch.effectiveProfile, "workspace"), false);
    assert.equal(included.launch.envelope.ownerWorkspace, profileInput.workspace);
    assert.match(included.launch.effectiveProfile.digest, /^[0-9a-f]{64}$/);
    assert.deepEqual(Object.keys(included.launch.effectivePackManifests), [pack.id]);
    assert.match(included.launch.effectivePackManifests[pack.id], /^[0-9a-f]{64}$/);
    assert.deepEqual(included.launch.envelope.packs, {
      [pack.id]: included.launch.effectivePackManifests[pack.id],
    });
    const omittedManifest = clone(included.launch);
    delete omittedManifest.effectivePackManifests[pack.id];
    const omittedManifestValidation = validateContract("launch", omittedManifest);
    assert.equal(omittedManifestValidation.valid, false);
    assert.ok(omittedManifestValidation.errors.some((error) => error.includes(`does not match requested Pack identity: ${pack.id}`)));
    const missingRequestedDigest = clone(included.launch);
    missingRequestedDigest.envelope.packs[pack.id] = null;
    assert.equal(validateContract("launch", missingRequestedDigest).valid, false);
    const changedPack = { ...pack, purpose: `${pack.purpose} Changed.` };
    const changedManifest = createLaunchContract(resolved.profile, { ...envelope, packs: [pack.id] }, "Codex", [changedPack]);
    assert.equal(changedManifest.valid, true, changedManifest.errors.join("; "));
    assert.notEqual(changedManifest.launch.effectivePackManifests[pack.id], included.launch.effectivePackManifests[pack.id]);
    const workspaceMismatch = createLaunchContract(resolved.profile, { ...envelope, ownerWorkspace: "other", packs: [pack.id] }, "Codex", [pack]);
    assert.equal(workspaceMismatch.valid, false);
  });

  pass("launch-schema-binds-requested-pack-identities-with-their-digests", () => {
    const schema = readJson(resolve(root, "contracts/launch-contract.schema.json"));
    const packs = schema.properties?.envelope?.properties?.packs;
    assert.equal(packs?.type, "object");
    assert.equal(packs?.propertyNames?.pattern, "^[a-z][a-z0-9-]+$");
    assert.equal(packs?.additionalProperties?.pattern, "^[0-9a-f]{64}$");
  });

  pass("launch-composition-does-not-mutate-requested-pack-order", () => {
    const secondPack = readJson(resolve(root, "packs/architecture-convergence-audit.json"));
    const twoPackInput = {
      ...profileInput,
      packs: [
        { id: pack.id, state: "enabled", reason: "Enabled for ordering regression." },
        { id: secondPack.id, state: "enabled", reason: "Enabled for ordering regression." },
      ],
    };
    const twoPackProfile = resolveProfile(twoPackInput, [pack, secondPack]);
    assert.equal(twoPackProfile.valid, true, twoPackProfile.errors.join("; "));
    const requested = { ...envelope, packs: [pack.id, secondPack.id] };
    const before = JSON.stringify(requested);
    const launch = createLaunchContract(twoPackProfile.profile, requested, "Codex", [pack, secondPack]);
    assert.equal(launch.valid, true, launch.errors.join("; "));
    assert.equal(JSON.stringify(requested), before);
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
    assert.throws(() => applyApprovedAdoptionWrite(driftWorkspace, plan.proposedWrites[0], plan.proposedWrites[0].approvalSha256), /symbolic link|changed before write/);
    assert.equal(existsSync(driftOutside), false);
  });

  pass("adoption-resolves-host-intent-through-the-registry", () => {
    const explicitWorkspace = temporary("forgerail-adoption-explicit-host-");
    const sharedClaude = resolve(temporary("forgerail-adoption-unselected-host-"), "CLAUDE.md");
    writeFileSync(sharedClaude, "shared Claude instructions\n");
    symlinkSync(sharedClaude, resolve(explicitWorkspace, "CLAUDE.md"));
    const explicit = planAdoption(root, explicitWorkspace, ["codex"]);
    assert.equal(explicit.hostSelection.mode, "explicit");
    assert.deepEqual(Object.keys(explicit.hostSelection.hosts), ["codex"]);
    assert.equal(explicit.strategy, "single-host-managed-block");
    assert.equal(explicit.proposedWrites[0].path, "AGENTS.md");

    const detectedWorkspace = temporary("forgerail-adoption-detected-hosts-");
    writeFileSync(resolve(detectedWorkspace, "AGENTS.md"), "Codex instructions\n");
    mkdirSync(resolve(detectedWorkspace, ".cursor"));
    const detected = planAdoption(root, detectedWorkspace);
    assert.equal(detected.hostSelection.mode, "all-detected");
    assert.deepEqual(Object.keys(detected.hostSelection.hosts), ["codex", "cursor"]);

    const cursorOnlyWorkspace = temporary("forgerail-adoption-detected-cursor-");
    mkdirSync(resolve(cursorOnlyWorkspace, ".cursor"));
    const cursorOnly = planAdoption(root, cursorOnlyWorkspace);
    assert.deepEqual(Object.keys(cursorOnly.hostSelection.hosts), ["cursor"]);
    assert.equal(cursorOnly.strategy, "shared-contract-with-thin-bindings");
    assert.deepEqual(cursorOnly.proposedWrites.map(({ path }) => path), ["FORGERAIL.md", ".cursor/rules/forgerail.mdc"]);

    const claudeOnlyWorkspace = temporary("forgerail-adoption-detected-claude-");
    mkdirSync(resolve(claudeOnlyWorkspace, ".claude"));
    const claudeOnly = planAdoption(root, claudeOnlyWorkspace);
    assert.deepEqual(Object.keys(claudeOnly.hostSelection.hosts), ["claude-code"]);
    assert.equal(claudeOnly.strategy, "shared-contract-with-thin-bindings");
    assert.deepEqual(claudeOnly.proposedWrites.map(({ path }) => path), ["FORGERAIL.md", "CLAUDE.md"]);

    const availableWorkspace = temporary("forgerail-adoption-available-hosts-");
    const available = planAdoption(root, availableWorkspace, [], "lightweight-adoption", "all-available");
    assert.equal(available.hostSelection.mode, "all-available");
    assert.deepEqual(Object.keys(available.hostSelection.hosts), ["claude-code", "codex", "cursor"]);
    assert.throws(() => planAdoption(root, availableWorkspace), /no registered host was detected/);
    assert.throws(() => planAdoption(root, availableWorkspace, ["unknown-host"]), /unknown host adapter/);
    assert.throws(
      () => planAdoption(root, availableWorkspace, ["codex"], "lightweight-adoption", "all-available"),
      /cannot be combined with --host/,
    );

    const malformed = clone(explicit);
    malformed.hosts = [{ adapterId: "cursor" }];
    const validation = validateContract("adoption-plan", malformed);
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.includes("adoptionPlan.hosts is unsupported"));
  });

  pass("adoption-schema-uses-one-identity-keyed-host-selection", () => {
    const schema = readJson(resolve(root, "contracts/adoption-plan.schema.json"));
    assert.deepEqual(schema.properties.hostSelection.required, ["mode", "hosts"]);
    assert.equal(Object.hasOwn(schema.properties, "hosts"), false);
    const hosts = schema.properties.hostSelection.properties.hosts;
    assert.equal(hosts.type, "object");
    assert.equal(hosts.minProperties, 1);
    assert.equal(hosts.propertyNames.pattern, "^[a-z][a-z0-9-]+$");
    assert.deepEqual(hosts.additionalProperties.required, ["status", "bindingTarget", "verificationMode"]);
    assert.equal(hosts.additionalProperties.additionalProperties, false);
  });

  pass("adoption-cli-defaults-to-detected-hosts", () => {
    const workspace = temporary("forgerail-adoption-cli-detected-");
    writeFileSync(resolve(workspace, "AGENTS.md"), "Codex instructions\n");
    const output = execFileSync(process.execPath, [
      resolve(root, "scripts/forgerail.mjs"),
      "adoption-plan",
      "--workspace",
      workspace,
    ], { encoding: "utf8" });
    const plan = JSON.parse(output);
    assert.equal(plan.hostSelection.mode, "all-detected");
    assert.deepEqual(Object.keys(plan.hostSelection.hosts), ["codex"]);
  });

  pass("adoption-rejects-windows-drive-relative-targets", () => {
    const workspace = temporary("forgerail-adoption-drive-relative-");
    assert.throws(() => resolveAdoptionWriteTarget(workspace, "C:AGENTS.md"), /unsafe/);
    const adapter = readJson(resolve(root, "adapters/codex.json"));
    assert.equal(validateContract("host-adapter", { ...adapter, bindingTarget: "C:AGENTS.md" }).valid, false);
  });

  if (process.platform !== "win32") pass("adoption-rejects-non-regular-targets-before-read", () => {
    for (const existing of [false, true]) {
      const workspace = temporary(`forgerail-adoption-fifo-${existing ? "existing" : "create"}-`);
      const target = resolve(workspace, "AGENTS.md");
      if (existing) writeFileSync(target, "existing instructions\n");
      const write = planAdoption(root, workspace, ["codex"]).proposedWrites[0];
      rmSync(target, { force: true });
      execFileSync("mkfifo", [target]);
      assert.throws(
        () => applyApprovedAdoptionWrite(workspace, write, write.approvalSha256),
        /not a regular file|changed before write/,
      );
    }

    const directoryWorkspace = temporary("forgerail-adoption-directory-target-");
    const directoryWrite = planAdoption(root, directoryWorkspace, ["codex"]).proposedWrites[0];
    mkdirSync(resolve(directoryWorkspace, "AGENTS.md"));
    assert.throws(
      () => applyApprovedAdoptionWrite(directoryWorkspace, directoryWrite, directoryWrite.approvalSha256),
      /not a regular file|changed before write/,
    );
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

  pass("adoption-rejects-approved-but-unsupported-operations", () => {
    const workspace = temporary("forgerail-adoption-unsupported-operation-");
    writeFileSync(resolve(workspace, "AGENTS.md"), "existing instructions\n");
    const approved = clone(planAdoption(root, workspace, ["codex"]).proposedWrites[0]);
    approved.operation = "delete";
    approved.approvalSha256 = adoptionWriteApprovalDigest(approved);
    assert.throws(
      () => applyApprovedAdoptionWrite(workspace, approved, approved.approvalSha256),
      /operation is unsupported/,
    );
    assert.equal(readFileSync(resolve(workspace, "AGENTS.md"), "utf8"), "existing instructions\n");
  });

  pass("adoption-binds-approved-workspace-directory-identity", () => {
    const workspace = temporary("forgerail-adoption-workspace-identity-");
    const approved = planAdoption(root, workspace, ["codex"]).proposedWrites[0];
    const originalWorkspace = `${workspace}-approved-inode`;
    renameSync(workspace, originalWorkspace);
    mkdirSync(workspace);

    assert.throws(
      () => applyApprovedAdoptionWrite(workspace, approved, approved.approvalSha256),
      /approved write digest does not match|workspace directory identity changed/,
    );
    assert.deepEqual(readdirSync(workspace), []);
    assert.deepEqual(readdirSync(originalWorkspace), []);
  });

  pass("adoption-keeps-workspace-path-bound-through-install", () => {
    for (const hook of ["beforeInstall", "afterInstall"]) {
      const workspace = temporary(`forgerail-adoption-write-path-${hook}-`);
      const approved = planAdoption(root, workspace, ["codex"]).proposedWrites[0];
      const originalWorkspace = `${workspace}-approved-inode`;
      assert.throws(
        () => applyApprovedAdoptionWrite(workspace, approved, approved.approvalSha256, {
          [hook]() {
            renameSync(workspace, originalWorkspace);
            mkdirSync(workspace);
          },
        }),
        /workspace directory identity changed|target parent identity changed/,
      );
      assert.deepEqual(readdirSync(workspace), []);
      assert.deepEqual(readdirSync(originalWorkspace), []);
    }
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

  pass("adoption-rejects-duplicate-managed-boundaries", () => {
    const marker = "forgerail:binding:codex:v1";
    for (const duplicate of ["start", "end"]) {
      const workspace = temporary(`forgerail-adoption-duplicate-${duplicate}-`);
      const start = `<!-- ${marker}:start -->`;
      const end = `<!-- ${marker}:end -->`;
      const content = duplicate === "start"
        ? `${start}\n${start}\nmanaged\n${end}\n`
        : `${start}\nmanaged\n${end}\n${end}\n`;
      writeFileSync(resolve(workspace, "AGENTS.md"), content);
      assert.throws(() => planAdoption(root, workspace, ["codex"]), /duplicate managed markers/);
      assert.equal(readFileSync(resolve(workspace, "AGENTS.md"), "utf8"), content);
    }
  });

  pass("adoption-plan-requires-one-workspace-identity", () => {
    const workspace = temporary("forgerail-adoption-plan-workspace-identity-");
    const plan = planAdoption(root, workspace, ["codex", "cursor"]);
    const changed = clone(plan);
    changed.proposedWrites[1].workspaceSha256 = "0".repeat(64);
    changed.proposedWrites[1].approvalSha256 = adoptionWriteApprovalDigest(changed.proposedWrites[1]);
    const validation = validateContract("adoption-plan", changed);
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.includes("adoptionPlan.proposedWrites must share one workspace identity"));
  });

  pass("adoption-preserves-existing-binding-mode-across-umask", () => {
    const workspace = temporary("forgerail-adoption-mode-");
    const target = resolve(workspace, "AGENTS.md");
    writeFileSync(target, "existing instructions\n");
    chmodSync(target, 0o664);
    const approved = planAdoption(root, workspace, ["codex"]).proposedWrites[0];
    const priorUmask = process.umask(0o077);
    try {
      applyApprovedAdoptionWrite(workspace, approved, approved.approvalSha256);
    } finally {
      process.umask(priorUmask);
    }
    assert.equal(statSync(target).mode & 0o777, 0o664);
  });

  pass("adoption-does-not-overwrite-concurrent-leaf-replacement", () => {
    const workspace = temporary("forgerail-adoption-concurrent-leaf-");
    const target = resolve(workspace, "AGENTS.md");
    const prior = resolve(workspace, "AGENTS.md.concurrent-prior");
    writeFileSync(target, "existing instructions\n");
    const approved = planAdoption(root, workspace, ["codex"]).proposedWrites[0];
    assert.throws(
      () => applyApprovedAdoptionWrite(workspace, approved, approved.approvalSha256, {
        beforeReplace() {
          renameSync(target, prior);
          writeFileSync(target, "concurrent user change\n");
        },
      }),
      /target changed before atomic replace/,
    );
    assert.equal(readFileSync(target, "utf8"), "concurrent user change\n");
    assert.equal(readFileSync(prior, "utf8"), "existing instructions\n");
    assert.equal(readdirSync(workspace).some((name) => name.startsWith(".forgerail-")), false);
  });

  pass("adoption-restores-original-binding-when-installed-leaf-disappears", () => {
    const workspace = temporary("forgerail-adoption-restore-missing-installed-");
    const target = resolve(workspace, "AGENTS.md");
    writeFileSync(target, "existing instructions\n");
    const approved = planAdoption(root, workspace, ["codex"]).proposedWrites[0];
    assert.throws(
      () => applyApprovedAdoptionWrite(workspace, approved, approved.approvalSha256, {
        afterInstall() { unlinkSync(target); },
      }),
      /target identity mismatch after write/,
    );
    assert.equal(readFileSync(target, "utf8"), "existing instructions\n");
    assert.equal(readdirSync(workspace).some((name) => name.startsWith(".forgerail-")), false);
  });

  pass("adoption-restores-original-binding-with-one-rename", () => {
    const workspace = temporary("forgerail-adoption-atomic-restore-");
    const target = resolve(workspace, "AGENTS.md");
    writeFileSync(target, "existing instructions\n");
    const approved = planAdoption(root, workspace, ["codex"]).proposedWrites[0];
    assert.throws(
      () => applyApprovedAdoptionWrite(workspace, approved, approved.approvalSha256, {
        afterInstall() { throw new Error("forced post-install failure"); },
      }),
      /forced post-install failure/,
    );
    assert.equal(readFileSync(target, "utf8"), "existing instructions\n");
    assert.equal(readdirSync(workspace).some((name) => name.startsWith(".forgerail-")), false);
    const implementation = readFileSync(resolve(root, "scripts/lib/adoption.mjs"), "utf8");
    assert.doesNotMatch(implementation, /renameSync\(leaf, failed\)/);
  });

  pass("adoption-preserves-primary-error-when-cwd-restoration-fails", () => {
    const priorDirectory = process.cwd();
    const callerDirectory = temporary("forgerail-adoption-removed-cwd-");
    const workspace = temporary("forgerail-adoption-primary-error-");
    const approved = planAdoption(root, workspace, ["codex", "cursor"]).proposedWrites.find(({ path }) => path === ".cursor/rules/forgerail.mdc");
    let caught;
    process.chdir(callerDirectory);
    try {
      applyApprovedAdoptionWrite(workspace, approved, approved.approvalSha256, {
        beforeInstall() {
          rmSync(callerDirectory, { recursive: true, force: true });
          throw new Error("primary adoption failure");
        },
      });
    } catch (error) {
      caught = error;
    } finally {
      process.chdir(priorDirectory);
    }
    assert.equal(caught?.message, "primary adoption failure");
    assert.equal(existsSync(resolve(workspace, ".cursor")), false);
  });

  pass("adoption-errors-name-retained-recovery-evidence", () => {
    const workspace = temporary("forgerail-adoption-retained-recovery-");
    const target = resolve(workspace, "AGENTS.md");
    const displacedCandidate = resolve(workspace, "AGENTS.md.displaced-candidate");
    writeFileSync(target, "original instructions\n");
    const approved = planAdoption(root, workspace, ["codex"]).proposedWrites[0];
    let caught;
    try {
      applyApprovedAdoptionWrite(workspace, approved, approved.approvalSha256, {
        afterInstall() {
          renameSync(target, displacedCandidate);
          writeFileSync(target, "concurrent user content\n");
          throw new Error("forced unsafe recovery");
        },
      });
    } catch (error) {
      caught = error;
    }
    assert.match(caught?.message ?? "", /^forced unsafe recovery; recovery evidence retained at \.forgerail-[0-9a-f]{24}\.bak$/);
    const recoveryPath = caught.message.slice(caught.message.lastIndexOf(" at ") + 4);
    assert.equal(readFileSync(resolve(workspace, recoveryPath), "utf8"), "original instructions\n");
    assert.equal(readFileSync(target, "utf8"), "concurrent user content\n");
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

  if (evaluateShadowComparison) pass("shadow-mutation-fails-coverage", () => {
    assert.equal(evaluateShadowComparison().behaviorCoverageReady, true);
    const mutated = evaluateShadowComparison({ "dirty-worktree-preservation": "" });
    assert.equal(mutated.behaviorCoverageReady, false);
    assert.ok(mutated.unresolved.includes("dirty-worktree-preservation"));
    const weakenedBaseline = clone(readJson(resolve(root, "docs/agw-frozen-baseline.json")));
    weakenedBaseline.behaviorAssertions.dirtyWorktreePreservation = [];
    const missingBaselineEvidence = evaluateShadowComparison({}, weakenedBaseline);
    assert.equal(missingBaselineEvidence.behaviorCoverageReady, false);
    assert.ok(missingBaselineEvidence.unresolved.includes("dirty-worktree-preservation"));
  });

  if (!evaluateShadowComparison) assertions.push("source-only-shadow-regressions-not-installed");

  if (buildBundle) pass("bundle-private-public-layouts-are-deterministic-and-safe", () => {
    const bundleImplementation = readFileSync(resolve(root, "tools/lib/bundle.mjs"), "utf8");
    assert.match(bundleImplementation, /O_NOFOLLOW/);
    assert.match(bundleImplementation, /O_DIRECTORY/);
    assert.match(bundleImplementation, /process\.chdir\(segment\)/);
    assert.match(bundleImplementation, /readFileSync\(descriptor\)/);
    assert.doesNotMatch(bundleImplementation, /copyFileSync/);
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

  if (buildBundle && process.platform !== "win32") pass("bundle-rejects-non-regular-package-metadata-before-read", () => {
    const publicRoot = publicLayoutFixture();
    const packagePath = resolve(publicRoot, "package.json");
    rmSync(packagePath);
    execFileSync("mkfifo", [packagePath]);
    const output = resolve(temporary("forgerail-package-fifo-output-parent-"), "bundle");
    assert.throws(() => buildBundle(publicRoot, output), /not a regular file/);
    assert.equal(existsSync(output), false);
  });

  if (buildBundle) pass("bundle-requires-an-explicit-package-publication-allowlist", () => {
    for (const files of [undefined, "scripts/"]) {
      const publicRoot = publicLayoutFixture();
      const packagePath = resolve(publicRoot, "package.json");
      const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
      if (files === undefined) delete packageJson.files;
      else packageJson.files = files;
      writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
      const output = resolve(temporary("forgerail-missing-package-allowlist-output-parent-"), "bundle");
      assert.throws(() => buildBundle(publicRoot, output), /package\.json files must be an array/);
      assert.equal(existsSync(output), false);
    }
  });

  if (buildBundle) pass("bundle-rejects-symlinked-allowlisted-ancestors-before-read", () => {
    const publicRoot = publicLayoutFixture();
    const scriptsRoot = resolve(publicRoot, "scripts");
    const replacementRoot = resolve(publicRoot, "scripts-source");
    cpSync(scriptsRoot, replacementRoot, { recursive: true, dereference: false });
    rmSync(scriptsRoot, { recursive: true, force: true });
    symlinkSync(replacementRoot, scriptsRoot);
    const output = resolve(temporary("forgerail-symlinked-allowlisted-output-parent-"), "bundle");
    assert.throws(() => buildBundle(publicRoot, output), /symbolic link|bound directory/);
    assert.equal(existsSync(output), false);
  });

  if (buildBundle) pass("bundle-rejects-symlinked-external-plugin-roots", () => {
    for (const kind of ["root", "ancestor"]) {
      const publicRoot = publicLayoutFixture();
      if (kind === "root") {
        const pluginRoot = resolve(publicRoot, "plugins/forgerail-release-safety");
        const replacementRoot = resolve(publicRoot, "plugins/forgerail-release-safety-source");
        cpSync(pluginRoot, replacementRoot, { recursive: true, dereference: false });
        rmSync(pluginRoot, { recursive: true, force: true });
        symlinkSync(replacementRoot, pluginRoot);
      } else {
        const pluginsRoot = resolve(publicRoot, "plugins");
        const replacementRoot = resolve(publicRoot, "plugins-source");
        cpSync(pluginsRoot, replacementRoot, { recursive: true, dereference: false });
        rmSync(pluginsRoot, { recursive: true, force: true });
        symlinkSync(replacementRoot, pluginsRoot);
      }
      const output = resolve(temporary(`forgerail-symlinked-plugin-${kind}-output-parent-`), "bundle");
      assert.throws(() => buildBundle(publicRoot, output), /symbolic link/);
      assert.equal(existsSync(output), false);
    }
  });

  if (buildBundle) pass("bundle-rejects-environment-and-npmrc-filename-families", () => {
    for (const path of [
      "scripts/.env.local",
      "docs/.env.production",
      "scripts/.npmrc.backup",
      "scripts/SECRET.KEY",
      "docs/config.PEM",
      "scripts/.ENV.production",
    ]) {
      const publicRoot = publicLayoutFixture();
      writeFileSync(resolve(publicRoot, path), "PRIVATE_VALUE=should-not-project\n");
      const output = resolve(temporary("forgerail-sensitive-name-output-parent-"), "bundle");
      assert.throws(() => buildBundle(publicRoot, output), /path is not allowed/);
      assert.equal(existsSync(output), false);
    }
  });

  if (buildBundle) pass("bundle-applies-directory-denylist-case-insensitively", () => {
    for (const path of ["scripts/NODE_MODULES/private.txt", "docs/COVERAGE/private.txt", "scripts/.CACHE/private.txt"]) {
      const publicRoot = publicLayoutFixture();
      mkdirSync(dirname(resolve(publicRoot, path)), { recursive: true });
      writeFileSync(resolve(publicRoot, path), "private\n");
      const output = resolve(temporary("forgerail-denied-directory-output-parent-"), "bundle");
      assert.throws(() => buildBundle(publicRoot, output), /path is not allowed/);
      assert.equal(existsSync(output), false);
    }
  });

  if (buildBundle) pass("bundle-reserves-output-without-replacing-a-concurrent-directory", () => {
    const publicRoot = publicLayoutFixture();
    const parent = temporary("forgerail-concurrent-output-parent-");
    const output = resolve(parent, "bundle");
    assert.throws(
      () => buildBundle(publicRoot, output, {
        beforeOutputReservation() { mkdirSync(output); },
      }),
      /EEXIST|file already exists/,
    );
    assert.equal(existsSync(output), true);
    assert.deepEqual(readdirSync(output), []);
  });

  if (buildBundle) pass("bundle-rejects-symlinked-descendants-inside-the-reserved-output", () => {
    const publicRoot = publicLayoutFixture();
    const parent = temporary("forgerail-reserved-output-descendant-parent-");
    const escaped = temporary("forgerail-reserved-output-descendant-escaped-");
    const output = resolve(parent, "bundle");
    assert.throws(
      () => buildBundle(publicRoot, output, {
        afterOutputReservation() { symlinkSync(escaped, resolve(output, "docs")); },
      }),
      /output ancestor is not a bound directory/,
    );
    assert.equal(existsSync(output), false);
    assert.deepEqual(readdirSync(escaped), []);
  });

  if (buildBundle) pass("bundle-rejects-output-inside-source-before-staging", () => {
    const publicRoot = publicLayoutFixture();
    const output = resolve(publicRoot, "docs/projection");
    const before = readdirSync(resolve(publicRoot, "docs")).sort();
    assert.throws(() => buildBundle(publicRoot, output), /output must not be inside the source tree/);
    assert.equal(existsSync(output), false);
    assert.deepEqual(readdirSync(resolve(publicRoot, "docs")).sort(), before);
  });

  if (buildBundle) pass("bundle-rejects-output-inside-private-layout-external-plugin", () => {
    const privateRoot = privateLayoutFixture(publicLayoutFixture());
    const pluginRoot = resolve(privateRoot, "..", "forgerail-release-safety");
    const output = resolve(pluginRoot, "projection");
    const before = readdirSync(pluginRoot).sort();
    assert.throws(() => buildBundle(privateRoot, output), /external Plugin source tree/);
    assert.equal(existsSync(output), false);
    assert.deepEqual(readdirSync(pluginRoot).sort(), before);
  });

  if (buildBundle) pass("bundle-rejects-duplicate-projection-targets", () => {
    for (const extra of [".agents/", "plugins/"]) {
      const publicRoot = publicLayoutFixture();
      const packagePath = resolve(publicRoot, "package.json");
      const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
      packageJson.files.push(extra);
      writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
      const output = resolve(temporary("forgerail-duplicate-target-output-parent-"), "bundle");
      assert.throws(() => buildBundle(publicRoot, output), /duplicate bundle target/);
      assert.equal(existsSync(output), false);
    }
  });

  if (buildBundle) pass("bundle-normalizes-marketplace-allowlist-before-exclusion", () => {
    for (const alias of ["./marketplace/", "marketplace//"]) {
      const privateRoot = privateLayoutFixture(publicLayoutFixture());
      const packagePath = resolve(privateRoot, "package.json");
      const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
      packageJson.files = packageJson.files.map((entry) => entry === "marketplace/" ? alias : entry);
      writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
      const output = resolve(temporary("forgerail-marketplace-alias-output-parent-"), "bundle");
      const result = buildBundle(privateRoot, output);
      assert.equal(result.files.some(({ path }) => path.includes("/marketplace/") || path.startsWith("marketplace/")), false);
      assert.equal(result.files.filter(({ path }) => path === ".agents/plugins/marketplace.json").length, 1);
    }
  });

  if (pathIsConfined) pass("bundle-rejects-cross-drive-relative-results", () => {
    assert.equal(pathIsConfined("D:\\forgerail", "C:\\Temp\\bundle", win32), false);
    assert.equal(pathIsConfined("D:\\forgerail", "D:\\forgerail\\nested", win32), true);
  });

  if (buildBundle) pass("bundle-keeps-source-root-bound-for-entire-build", () => {
    const ownerRoot = temporary("forgerail-root-replacement-owner-");
    const publicRoot = resolve(ownerRoot, "forgerail");
    cpSync(publicLayoutFixture(), publicRoot, { recursive: true, dereference: false });
    const originalRoot = resolve(ownerRoot, "forgerail-original");
    const output = resolve(temporary("forgerail-root-replacement-output-parent-"), "bundle");
    assert.throws(
      () => buildBundle(publicRoot, output, {
        afterSourceEnumeration() {
          renameSync(publicRoot, originalRoot);
          cpSync(originalRoot, publicRoot, { recursive: true, dereference: false });
        },
      }),
      /source root identity changed during build/,
    );
    assert.equal(existsSync(output), false);
  });

  if (buildBundle) pass("bundle-keeps-output-parent-bound-through-install", () => {
    const publicRoot = publicLayoutFixture();
    const ownerRoot = temporary("forgerail-output-parent-owner-");
    const outputParent = resolve(ownerRoot, "approved-parent");
    const movedParent = resolve(ownerRoot, "moved-parent");
    const output = resolve(outputParent, "bundle");
    mkdirSync(outputParent);
    assert.throws(
      () => buildBundle(publicRoot, output, {
        afterSourceEnumeration() {
          renameSync(outputParent, movedParent);
          symlinkSync(resolve(publicRoot, "docs"), outputParent);
        },
      }),
      /output parent identity changed during build/,
    );
    assert.equal(existsSync(resolve(publicRoot, "docs/bundle")), false);
    assert.equal(existsSync(resolve(movedParent, "bundle")), false);
    assert.equal(readdirSync(movedParent).some((name) => name.startsWith(".forgerail-bundle-")), false);
  });

  if (!buildBundle) assertions.push("source-only-bundle-regressions-not-installed");

  console.log(JSON.stringify({ valid: true, assertions, mutations: [], externalSideEffects: [] }, null, 2));
} finally {
  for (const path of temporaryRoots.reverse()) rmSync(path, { recursive: true, force: true });
}
