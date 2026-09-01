#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { planAdoption } from "./lib/adoption.mjs";
import { buildBundle } from "./lib/bundle.mjs";
import { createLaunchContract, resolveProfile, verifyReceipt } from "./lib/composition.mjs";
import { readJson, validateContract } from "./lib/contracts.mjs";
import { diagnoseWorkspace } from "./lib/diagnosis.mjs";
import { evaluateShadowComparison } from "./shadow-comparison.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(root, "../..");
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

function publicLayoutFixture() {
  const publicRoot = resolve(temporary("forgerail-public-layout-"), "forgerail");
  cpSync(root, publicRoot, { recursive: true, dereference: false });
  if (isPrivateLayout(publicRoot)) {
    mkdirSync(resolve(publicRoot, ".agents/plugins"), { recursive: true });
    cpSync(
      resolve(publicRoot, "marketplace/.agents/plugins/marketplace.json"),
      resolve(publicRoot, ".agents/plugins/marketplace.json"),
    );
    rmSync(resolve(publicRoot, "marketplace"), { recursive: true, force: true });
    for (const name of externalPluginNames) {
      cpSync(resolve(root, "..", name), resolve(publicRoot, "plugins", name), { recursive: true, dereference: false });
    }
  }
  return publicRoot;
}

function privateLayoutFixture() {
  if (isPrivateLayout(root)) return root;
  const ownerRoot = temporary("forgerail-private-owner-");
  const privateRoot = resolve(ownerRoot, "forgerail");
  cpSync(root, privateRoot, { recursive: true, dereference: false });
  mkdirSync(resolve(privateRoot, "marketplace/.agents/plugins"), { recursive: true });
  cpSync(
    resolve(privateRoot, ".agents/plugins/marketplace.json"),
    resolve(privateRoot, "marketplace/.agents/plugins/marketplace.json"),
  );
  rmSync(resolve(privateRoot, ".agents"), { recursive: true, force: true });
  for (const name of externalPluginNames) {
    cpSync(resolve(privateRoot, "plugins", name), resolve(ownerRoot, name), { recursive: true, dereference: false });
    rmSync(resolve(privateRoot, "plugins", name), { recursive: true, force: true });
  }
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

  pass("adoption-rejects-symlink-target", () => {
    const workspace = temporary("forgerail-adoption-");
    const outside = resolve(temporary("forgerail-outside-"), "AGENTS.md");
    writeFileSync(outside, "outside\n");
    symlinkSync(outside, resolve(workspace, "AGENTS.md"));
    assert.throws(() => planAdoption(root, workspace, ["codex"]), /symbolic link/);
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

    const unsafeRoot = resolve(temporary("forgerail-unsafe-layout-"), "forgerail");
    cpSync(publicRoot, unsafeRoot, { recursive: true, dereference: false });
    symlinkSync(resolve(unsafeRoot, "README.md"), resolve(unsafeRoot, "plugins/forgerail-release-safety/scripts/leak.mjs"));
    const unsafeOutput = resolve(temporary("forgerail-unsafe-output-parent-"), "bundle");
    assert.throws(() => buildBundle(unsafeRoot, unsafeOutput), /symbolic link/);
    assert.equal(existsSync(unsafeOutput), false);

    const escapedParentTarget = temporary("forgerail-escaped-output-parent-");
    const outputLink = resolve(temporary("forgerail-output-link-parent-"), "outside");
    symlinkSync(escapedParentTarget, outputLink);
    assert.throws(() => buildBundle(root, resolve(outputLink, "bundle")), /symbolic links|below the host temporary directory/);
  });

  console.log(JSON.stringify({ valid: true, assertions, mutations: [], externalSideEffects: [] }, null, 2));
} finally {
  for (const path of temporaryRoots.reverse()) rmSync(path, { recursive: true, force: true });
}
