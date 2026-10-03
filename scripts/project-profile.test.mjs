import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, mkdirSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolveEffectiveProfileV2, resolveProfile } from "./lib/composition.mjs";
import { discoverProjectProfile, loadProjectProfile, projectProfilePath } from "./lib/project-profile.mjs";
import { applyProject, planProject, planRecovery, recoverProject, projectProfilePreflightBindingIds } from "./lib/project-adoption.mjs";
import { readProjectFile } from "./lib/project-state.mjs";

const plugin = realpathSync(resolve(import.meta.dirname, ".."));

const observedAt = "2026-09-27T00:00:00Z";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function workspace() {
  return mkdtempSync(resolve(tmpdir(), "forgerail-project-profile-"));
}

function identity(root, workspaceIdentityId = "workspace:test") {
  return {
    schemaVersion: "1.0",
    workspaceIdentityId,
    canonicalRootLocator: ".",
    boundaryClaims: [{ providerId: "git", kind: "repository", identity: `repository:${root.split("/").at(-1)}`, observedAt }],
    observedAt,
  };
}

function absoluteIdentity(root, workspaceIdentityId = "workspace:test") {
  return { ...identity(root, workspaceIdentityId), canonicalRootLocator: realpathSync(root) };
}

function source(sourceId, locator, content, sourceKind = "instructions") {
  return { sourceId, sourceKind, locator, requiredness: "required", expectedSha256: sha256(content) };
}

function claim(claimId, sourceId, ruleKey, normalizedValue, sourcePointer = { kind: "markdown-heading", heading: "## Policy" }) {
  return { claimId, sourceId, sourcePointer, ruleKey, normalizedValue, operationIds: ["git.push"] };
}

function declaration(sources, claims, resourceBindings = []) {
  return {
    schemaVersion: "1.0",
    profileId: "profile:test",
    workspaceIdentityId: "workspace:test",
    workspaceRelationshipIds: [],
    sources,
    claims,
    resourceBindings,
  };
}

function write(root, path, content) {
  mkdirSync(dirname(resolve(root, path)), { recursive: true });
  writeFileSync(resolve(root, path), content);
}

function install(root, value) {
  write(root, projectProfilePath, `${JSON.stringify(value, null, 2)}\n`);
}

test("fixed-entry discovery does not inherit a parent profile across a nested repository", () => {
  const parent = workspace();
  const child = resolve(parent, "child");
  mkdirSync(resolve(child, ".git"), { recursive: true });
  const policy = "# Parent\n\n## Policy\n";
  write(parent, "AGENTS.md", policy);
  install(parent, declaration([source("source:parent", "AGENTS.md", policy)], [claim("claim:parent", "source:parent", "git.actor", "parent")]));
  assert.equal(discoverProjectProfile(parent).status, "discovered");
  assert.deepEqual(discoverProjectProfile(child), { status: "not-adopted", workspace: realpathSync(child), declaration: null, errors: [] });
});

test("fixed entry rejects path escape, symbolic links, oversized files, and owner mismatch", () => {
  const escaped = workspace();
  const bad = declaration(
    [{ sourceId: "source:escape", sourceKind: "instructions", locator: "../outside", requiredness: "required", expectedSha256: null }],
    [claim("claim:escape", "source:escape", "git.actor", "nobody")],
  );
  install(escaped, bad);
  assert.equal(discoverProjectProfile(escaped).status, "invalid");

  const linked = workspace();
  const outside = resolve(workspace(), "profile.json");
  writeFileSync(outside, "{}\n");
  mkdirSync(resolve(linked, ".forgerail"), { recursive: true });
  symlinkSync(outside, resolve(linked, projectProfilePath));
  assert.equal(discoverProjectProfile(linked).status, "invalid");

  const oversized = workspace();
  write(oversized, projectProfilePath, "x".repeat(4 * 1024 * 1024 + 1));
  assert.match(discoverProjectProfile(oversized).errors[0], /oversized/);

  const mismatched = workspace();
  const policy = "## Policy\n";
  write(mismatched, "AGENTS.md", policy);
  install(mismatched, declaration([source("source:owner", "AGENTS.md", policy)], [claim("claim:owner", "source:owner", "git.actor", "owner")]));
  assert.equal(loadProjectProfile({ workspace: mismatched, workspaceIdentity: identity(mismatched, "workspace:other"), computedAt: observedAt }).status, "invalid");
});

test("bounded Markdown and JSON sources assemble into validated v2 Profile contracts", () => {
  const root = workspace();
  const markdown = "# Instructions\n\n## Policy\nUse the project actor.\n";
  const structured = `${JSON.stringify({ release: { branch: "main" } }, null, 2)}\n`;
  write(root, "AGENTS.md", markdown);
  write(root, "policy.json", structured);
  install(root, declaration(
    [source("source:agents", "AGENTS.md", markdown), source("source:json", "policy.json", structured, "structured-profile")],
    [
      claim("claim:actor", "source:agents", "git.actor", "chasechou007"),
      claim("claim:branch", "source:json", "git.primary-branch", "main", { kind: "json-pointer", pointer: "/release/branch" }),
    ],
  ));
  const result = loadProjectProfile({ workspace: root, workspaceIdentity: identity(root), computedAt: observedAt });
  assert.equal(result.status, "resolved");
  assert.equal(result.errors.length, 0);
  assert.equal(result.profile.completeness, "complete");
  assert.deepEqual(result.profile.ruleClaims.map((item) => item.claimId), ["claim:actor", "claim:branch"]);
  assert.equal(result.explanation.completeness, "complete");
});

test("source drift and structured projection mismatch invalidate claim confirmation", () => {
  const root = workspace();
  const reviewed = "## Policy\nReviewed actor.\n";
  write(root, "AGENTS.md", "## Policy\nChanged actor.\n");
  install(root, declaration([source("source:agents", "AGENTS.md", reviewed)], [claim("claim:actor", "source:agents", "git.actor", "chasechou007")]));
  const drifted = loadProjectProfile({ workspace: root, workspaceIdentity: identity(root), computedAt: observedAt });
  assert.equal(drifted.status, "resolved");
  assert.equal(drifted.profile.completeness, "unresolved");
  assert.equal(drifted.ruleClaims[0].enforcement, "unresolved");
  assert.match(drifted.ruleClaims[0].limitedReason, /digest differs/);

  const structured = `${JSON.stringify({ actor: "someone-else" })}\n`;
  write(root, "policy.json", structured);
  install(root, declaration(
    [source("source:json", "policy.json", structured, "structured-profile")],
    [claim("claim:json", "source:json", "git.actor", "chasechou007", { kind: "json-pointer", pointer: "/actor" })],
  ));
  const mismatch = loadProjectProfile({ workspace: root, workspaceIdentity: identity(root), computedAt: observedAt });
  assert.equal(mismatch.profile.completeness, "unresolved");
  assert.match(mismatch.ruleClaims[0].limitedReason, /does not match/);
});

test("an observed optional source with an unconfirmed claim remains visibly degraded", () => {
  const root = workspace();
  const structured = `${JSON.stringify({ actor: "someone-else" })}\n`;
  write(root, "policy.json", structured);
  install(root, declaration(
    [{ ...source("source:optional", "policy.json", structured, "structured-profile"), requiredness: "optional" }],
    [claim("claim:optional", "source:optional", "git.actor", "expected-user", { kind: "json-pointer", pointer: "/actor" })],
  ));
  const result = loadProjectProfile({ workspace: root, workspaceIdentity: identity(root), computedAt: observedAt });
  assert.equal(result.profile.completeness, "degraded");
  assert.equal(result.ruleClaims.length, 0);
  assert.equal(result.governanceSources[0].observationStatus, "unverified");
  assert.match(result.governanceSources[0].limitedReason, /does not match/);
});

test("equal-precedence claim disagreement is surfaced as an unresolved deterministic conflict", () => {
  const root = workspace();
  const first = "## Policy\nFirst.\n";
  const second = "## Policy\nSecond.\n";
  write(root, "AGENTS.md", first);
  write(root, "CONTRIBUTING.md", second);
  install(root, declaration(
    [source("source:first", "AGENTS.md", first), source("source:second", "CONTRIBUTING.md", second)],
    [claim("claim:first", "source:first", "git.actor", "first"), claim("claim:second", "source:second", "git.actor", "second")],
  ));
  const result = loadProjectProfile({ workspace: root, workspaceIdentity: identity(root), computedAt: observedAt });
  assert.equal(result.profile.completeness, "unresolved");
  assert.equal(result.profile.conflicts.length, 1);
  assert.deepEqual(result.profile.conflicts[0].claimIds, ["claim:first", "claim:second"]);
  assert.equal(result.explanation.conflicts[0].confirmationRequired, true);
});

test("a project-owned sourceKind cannot self-promote a file to platform authority", () => {
  const root = workspace();
  const instructions = "## Policy\nWorkspace instructions.\n";
  const labeledPolicy = "## Policy\nProject-labeled platform policy.\n";
  write(root, "AGENTS.md", instructions);
  write(root, "policy.md", labeledPolicy);
  install(root, declaration(
    [source("source:instructions", "AGENTS.md", instructions), source("source:labeled", "policy.md", labeledPolicy, "platform-policy")],
    [claim("claim:instructions", "source:instructions", "git.actor", "workspace"), claim("claim:labeled", "source:labeled", "git.actor", "labeled")],
  ));
  const result = loadProjectProfile({ workspace: root, workspaceIdentity: identity(root), computedAt: observedAt });
  assert.equal(result.profile.completeness, "complete");
  assert.equal(result.profile.conflicts.length, 0);
  assert.equal(result.explanation.claimDecisions.find((item) => item.claimId === "claim:instructions").disposition, "active");
  assert.equal(result.explanation.claimDecisions.find((item) => item.claimId === "claim:labeled").disposition, "shadowed");

  const forged = resolveEffectiveProfileV2({
    profileId: result.profile.profileId,
    profileRevisionId: result.profileRevisionId,
    workspaceIdentityId: "workspace:test",
    governanceSources: result.governanceSources,
    ruleClaims: [{ ...result.ruleClaims[1], precedenceClass: "platform-enforced" }],
    computedAt: observedAt,
  });
  assert.equal(forged.valid, false);
  assert.ok(forged.errors.some((error) => error.includes("precedence must come from its Governance Source")));
});

test("semantic revision and assembly are independent of identity-keyed declaration ordering", () => {
  const root = workspace();
  const first = "## Policy\nFirst.\n";
  const second = `${JSON.stringify({ release: "main" })}\n`;
  write(root, "AGENTS.md", first);
  write(root, "policy.json", second);
  const sources = [source("source:first", "AGENTS.md", first), source("source:second", "policy.json", second, "structured-profile")];
  const claims = [
    claim("claim:first", "source:first", "git.actor", "chasechou007"),
    claim("claim:second", "source:second", "git.primary-branch", "main", { kind: "json-pointer", pointer: "/release" }),
  ];
  install(root, declaration(sources, claims));
  const original = loadProjectProfile({ workspace: root, workspaceIdentity: identity(root), computedAt: observedAt });
  install(root, declaration([...sources].reverse(), [...claims].reverse()));
  const reordered = loadProjectProfile({ workspace: root, workspaceIdentity: identity(root), computedAt: observedAt });
  assert.equal(reordered.profileRevisionId, original.profileRevisionId);
  assert.deepEqual(reordered.profile, original.profile);
  assert.deepEqual(reordered.explanation, original.explanation);

  const laterIdentity = identity(root);
  laterIdentity.observedAt = "2026-09-28T00:00:00Z";
  laterIdentity.boundaryClaims[0].observedAt = "2026-09-28T00:00:00Z";
  const later = loadProjectProfile({ workspace: root, workspaceIdentity: laterIdentity, computedAt: "2026-09-28T00:00:00Z" });
  assert.equal(later.profileRevisionId, original.profileRevisionId);
});

test("one discovery snapshot drives Profile assembly even if the fixed entry changes", () => {
  const root = workspace();
  const policy = "## Policy\n";
  write(root, "AGENTS.md", policy);
  const first = declaration([source("source:policy", "AGENTS.md", policy)], [claim("claim:first", "source:policy", "git.actor", "first")]);
  install(root, first);
  const discoverySnapshot = discoverProjectProfile(root);
  install(root, declaration([source("source:policy", "AGENTS.md", policy)], [claim("claim:second", "source:policy", "git.actor", "second")]));
  const result = loadProjectProfile({ workspace: root, workspaceIdentity: identity(root), computedAt: observedAt, discoverySnapshot });
  assert.equal(result.declaration.claims[0].claimId, "claim:first");
  assert.equal(result.ruleClaims[0].claimId, "claim:first");
});

test("Project Profile assembly leaves the alpha resolver behavior unchanged", () => {
  const result = resolveProfile({
    workspace: "fixture-workspace",
    rules: [
      { id: "git.primary-branch", value: "main", source: "portable default", precedence: 6, status: "default" },
      { id: "git.primary-branch", value: "release", source: "AGENTS.md", precedence: 2, status: "confirmed" },
    ],
    packs: [],
  });
  assert.equal(result.valid, true);
  assert.equal(result.profile.schemaVersion, "1.0");
  assert.equal(result.profile.rules[0].value, "release");
});

test("reviewed Profile candidates activate and remove through the existing journaled writer", () => {
  const root = workspace();
  const policy = "## Policy\n";
  write(root, "AGENTS.md", policy);
  const candidate = declaration([source("source:policy", "AGENTS.md", policy)], [claim("claim:actor", "source:policy", "git.actor", "owner")]);
  const candidateText = JSON.stringify(candidate);
  assert.equal(discoverProjectProfile(root).status, "not-adopted");
  const setPlan = planProject(plugin, root, "profile-set", { profileCandidateText: candidateText });
  assert.equal(setPlan.operations.length, 1);
  assert.equal(setPlan.operations[0].path, projectProfilePath);
  assert.equal(discoverProjectProfile(root).status, "not-adopted");
  assert.equal(applyProject(plugin, root, "profile-set", setPlan.planSha256, { profileCandidateText: candidateText }).status, "ready");
  assert.equal(discoverProjectProfile(root).status, "discovered");
  const removePlan = planProject(plugin, root, "profile-remove");
  assert.equal(applyProject(plugin, root, "profile-remove", removePlan.planSha256).status, "removed");
  assert.equal(discoverProjectProfile(root).status, "not-adopted");
});

test("Profile lifecycle can replace or remove an invalid active declaration", () => {
  const policy = "## Policy\n";
  const replacementRoot = workspace();
  write(replacementRoot, "AGENTS.md", policy);
  write(replacementRoot, projectProfilePath, "{\"schemaVersion\":\"obsolete\"}\n");
  const candidateText = JSON.stringify(declaration([source("source:policy", "AGENTS.md", policy)], [claim("claim:actor", "source:policy", "git.actor", "owner")]));
  const setPlan = planProject(plugin, replacementRoot, "profile-set", { profileCandidateText: candidateText });
  assert.equal(applyProject(plugin, replacementRoot, "profile-set", setPlan.planSha256, { profileCandidateText: candidateText }).status, "ready");
  assert.equal(discoverProjectProfile(replacementRoot).status, "discovered");

  const removalRoot = workspace();
  write(removalRoot, projectProfilePath, "not-json\n");
  const removePlan = planProject(plugin, removalRoot, "profile-remove");
  assert.equal(applyProject(plugin, removalRoot, "profile-remove", removePlan.planSha256).status, "removed");
  assert.equal(discoverProjectProfile(removalRoot).status, "not-adopted");
});

test("package adoption lifecycle preserves the workspace-owned Project Profile", () => {
  const root = workspace();
  const policy = "## Policy\n";
  write(root, "AGENTS.md", policy);
  const candidate = declaration([source("source:policy", "AGENTS.md", policy)], [claim("claim:actor", "source:policy", "git.actor", "owner")]);
  const candidateText = JSON.stringify(candidate);
  const setPlan = planProject(plugin, root, "profile-set", { profileCandidateText: candidateText });
  applyProject(plugin, root, "profile-set", setPlan.planSha256, { profileCandidateText: candidateText });
  const active = readProjectFile(root, projectProfilePath);
  for (const action of ["init", "remove"]) {
    const plan = planProject(plugin, root, action);
    assert.ok(plan.operations.every((operation) => operation.path !== projectProfilePath));
    applyProject(plugin, root, action, plan.planSha256);
    assert.equal(readProjectFile(root, projectProfilePath), active);
  }
});

test("Profile approval binds candidate and base content and refuses concurrent drift", () => {
  const root = workspace();
  const policy = "## Policy\n";
  write(root, "AGENTS.md", policy);
  const first = JSON.stringify(declaration([source("source:policy", "AGENTS.md", policy)], [claim("claim:first", "source:policy", "git.actor", "first")]));
  const second = JSON.stringify(declaration([source("source:policy", "AGENTS.md", policy)], [claim("claim:second", "source:policy", "git.actor", "second")]));
  const approved = planProject(plugin, root, "profile-set", { profileCandidateText: first });
  assert.throws(() => applyProject(plugin, root, "profile-set", approved.planSha256, { profileCandidateText: second }), /stale or mismatched/);
  assert.throws(() => applyProject(plugin, root, "profile-set", approved.planSha256, { profileCandidateText: `${first}\n` }), /stale or mismatched/);
  assert.equal(readProjectFile(root, projectProfilePath), null);
  write(root, projectProfilePath, `${first}\n`);
  assert.throws(() => applyProject(plugin, root, "profile-set", approved.planSha256, { profileCandidateText: first }), /stale or mismatched/);
});

test("interrupted Profile activation uses shared recovery and preserves prior content", () => {
  const root = workspace();
  const policy = "## Policy\n";
  write(root, "AGENTS.md", policy);
  const candidateText = JSON.stringify(declaration([source("source:policy", "AGENTS.md", policy)], [claim("claim:actor", "source:policy", "git.actor", "owner")]));
  const plan = planProject(plugin, root, "profile-set", { profileCandidateText: candidateText });
  assert.throws(() => applyProject(plugin, root, "profile-set", plan.planSha256, { profileCandidateText: candidateText }, { beforeOperation() { throw new Error("interrupt"); } }), /recovery-required/);
  assert.equal(readProjectFile(root, projectProfilePath), null);
  const rollback = planRecovery(root);
  assert.equal(recoverProject(root, rollback.planSha256).status, "rolled-back");
  assert.equal(readProjectFile(root, projectProfilePath), null);
});

test("project-profile CLI previews, applies, inspects locally, and removes without provider calls", () => {
  const root = workspace();
  const policy = "## Policy\n";
  write(root, "AGENTS.md", policy);
  const candidatePath = ".forgerail/candidates/reviewed.json";
  write(root, candidatePath, JSON.stringify(declaration([source("source:policy", "AGENTS.md", policy)], [claim("claim:actor", "source:policy", "git.actor", "owner")])));
  const cli = resolve(plugin, "scripts/forgerail.mjs");
  const run = (...args) => { const result = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", env: { PATH: "" } }); return { ...result, json: JSON.parse(result.stdout) }; };
  const workspaceIdentityPath = resolve(root, "workspace-identity.json");
  writeFileSync(workspaceIdentityPath, JSON.stringify(absoluteIdentity(root)));
  const preview = run("project-profile-set", "--workspace", root, "--candidate", candidatePath);
  assert.equal(preview.status, 0); assert.equal(preview.json.action, "profile-set"); assert.equal(discoverProjectProfile(root).status, "not-adopted");
  const applied = run("project-profile-set", "--workspace", root, "--candidate", candidatePath, "--apply", preview.json.planSha256);
  assert.equal(applied.status, 0); assert.equal(applied.json.status, "ready");
  const inspected = run("project-profile-inspect", "--workspace", root, "--workspace-identity", workspaceIdentityPath);
  assert.equal(inspected.status, 0); assert.equal(inspected.json.status, "resolved"); assert.equal(inspected.json.profileStatus, "resolved"); assert.equal(inspected.json.localOnly, true); assert.equal(inspected.json.providerObservation.providerCalls, 0); assert.equal(inspected.json.authorizationClaim, false);
  const scoped = run("project-profile-inspect", "--workspace", root, "--workspace-identity", workspaceIdentityPath, "--operation", "git.push", "--target", "repository:owner/name");
  assert.equal(scoped.status, 0); assert.equal(scoped.json.status, "ready"); assert.equal(scoped.json.profileStatus, "resolved"); assert.equal(scoped.json.localOnly, false); assert.equal(scoped.json.providerObservation.providerCalls, 0); assert.match(scoped.json.executionContextIdentity.subjectId, /^workspace-subject:/);
  const incompleteScope = run("project-profile-inspect", "--workspace", root, "--operation", "git.push");
  assert.equal(incompleteScope.status, 1); assert.match(incompleteScope.json.errors[0], /operation and --target together/);
  const removal = run("project-profile-remove", "--workspace", root);
  assert.equal(removal.status, 0); const removed = run("project-profile-remove", "--workspace", root, "--apply", removal.json.planSha256);
  assert.equal(removed.status, 0); assert.equal(discoverProjectProfile(root).status, "not-adopted");
});

test("project-profile inspection requires independent exact-root Workspace Identity evidence", () => {
  const root = workspace(); const other = workspace();
  const policy = "## Policy\n";
  write(root, "AGENTS.md", policy);
  install(root, declaration([source("source:policy", "AGENTS.md", policy)], [claim("claim:actor", "source:policy", "git.actor", "owner")]));
  const copiedIdentityPath = resolve(root, "copied-workspace-identity.json");
  writeFileSync(copiedIdentityPath, JSON.stringify(absoluteIdentity(other)));
  const cli = resolve(plugin, "scripts/forgerail.mjs");
  const missing = spawnSync(process.execPath, [cli, "project-profile-inspect", "--workspace", root], { encoding: "utf8", env: { PATH: "" } });
  assert.equal(missing.status, 1);
  assert.match(JSON.parse(missing.stdout).errors[0], /workspace-identity evidence/);
  const copied = spawnSync(process.execPath, [cli, "project-profile-inspect", "--workspace", root, "--workspace-identity", copiedIdentityPath], { encoding: "utf8", env: { PATH: "" } });
  assert.equal(copied.status, 1);
  assert.match(JSON.parse(copied.stdout).errors[0], /does not match the exact owner workspace/);
});

test("project-profile rebind verifies every changed binding before activation", () => {
  const root = workspace(); const fakeBin = resolve(root, "fake-bin");
  const policy = "## Policy\n";
  write(root, "AGENTS.md", policy);
  mkdirSync(fakeBin, { recursive: true });
  const fakeGh = resolve(fakeBin, "gh");
  writeFileSync(fakeGh, "#!/bin/sh\nprintf '%s\\n' expected-user\n");
  chmodSync(fakeGh, 0o755);
  const operationIds = ["pull-request.create"];
  const candidate = declaration(
    [source("source:policy", "AGENTS.md", policy)],
    [{ ...claim("claim:actor", "source:policy", "github.actor", "expected-user"), operationIds }],
    [{ bindingId: "binding:github", providerId: "github", purpose: "Observe GitHub actor.", operationIds, adapterId: "github-cli-api", locator: { kind: "provider-native", providerId: "github", coordinates: { host: "github.com" } }, expectedIdentityClaimIds: ["claim:actor"], requiredness: "required" }],
  );
  const candidatePath = ".forgerail/candidates/rebind.json";
  write(root, candidatePath, JSON.stringify(candidate));
  const workspaceIdentityPath = resolve(root, "workspace-identity.json");
  writeFileSync(workspaceIdentityPath, JSON.stringify(absoluteIdentity(root)));
  const cli = resolve(plugin, "scripts/forgerail.mjs");
  const preview = spawnSync(process.execPath, [cli, "project-profile-set", "--workspace", root, "--candidate", candidatePath], { encoding: "utf8", env: { PATH: fakeBin } });
  const plan = JSON.parse(preview.stdout);
  assert.deepEqual(plan.profilePreflightBindingIds, ["binding:github"]);
  const unverified = spawnSync(process.execPath, [cli, "project-profile-set", "--workspace", root, "--candidate", candidatePath, "--apply", plan.planSha256], { encoding: "utf8", env: { PATH: fakeBin } });
  assert.equal(unverified.status, 1);
  assert.equal(discoverProjectProfile(root).status, "not-adopted");
  // A successful first observation must not hide a wrong actor in the next.
  const marker = resolve(root, "observed-once");
  writeFileSync(fakeGh, `#!/bin/sh\nif [ -e '${marker}' ]; then printf '%s\\n' wrong-user; else : > '${marker}'; printf '%s\\n' expected-user; fi\n`);
  const mixed = spawnSync(process.execPath, [cli, "project-profile-set", "--workspace", root, "--candidate", candidatePath, "--apply", plan.planSha256, "--workspace-identity", workspaceIdentityPath, "--operation", "pull-request.create", "--target", "repository:owner/name#1", "--operation", "pull-request.create", "--target", "repository:owner/name#2"], { encoding: "utf8", env: { PATH: fakeBin } });
  assert.equal(mixed.status, 1);
  assert.equal(discoverProjectProfile(root).status, "not-adopted");
  writeFileSync(fakeGh, "#!/bin/sh\nprintf '%s\\n' expected-user\n");
  const applied = spawnSync(process.execPath, [cli, "project-profile-set", "--workspace", root, "--candidate", candidatePath, "--apply", plan.planSha256, "--workspace-identity", workspaceIdentityPath, "--operation", "pull-request.create", "--target", "repository:owner/name#1"], { encoding: "utf8", env: { PATH: fakeBin } });
  const result = JSON.parse(applied.stdout);
  assert.equal(applied.status, 0);
  assert.equal(result.status, "ready");
  assert.deepEqual(result.profilePreflight.requiredBindingIds, ["binding:github"]);
  assert.equal(discoverProjectProfile(root).status, "discovered");
  const before = readProjectFile(root, projectProfilePath);
  candidate.claims[0].normalizedValue = "replacement-user";
  write(root, candidatePath, JSON.stringify(candidate));
  const changed = spawnSync(process.execPath, [cli, "project-profile-set", "--workspace", root, "--candidate", candidatePath], { encoding: "utf8", env: { PATH: fakeBin } });
  const changedPlan = JSON.parse(changed.stdout);
  assert.deepEqual(changedPlan.profilePreflightBindingIds, ["binding:github"]);
  const rejected = spawnSync(process.execPath, [cli, "project-profile-set", "--workspace", root, "--candidate", candidatePath, "--apply", changedPlan.planSha256, "--workspace-identity", workspaceIdentityPath, "--operation", "pull-request.create", "--target", "repository:owner/name#1"], { encoding: "utf8", env: { PATH: fakeBin } });
  assert.equal(rejected.status, 1);
  assert.equal(readProjectFile(root, projectProfilePath), before);
  const original = JSON.parse(before);
  for (const mutate of [value => { value.sources[0].expectedSha256 = "a".repeat(64); }, value => { value.workspaceIdentityId = "workspace:other"; }]) {
    const next = structuredClone(original); mutate(next);
    assert.deepEqual(projectProfilePreflightBindingIds(before, JSON.stringify(next)), ["binding:github"]);
  }
  original.claims.push(claim("claim:unrelated", "source:policy", "git.actor", "other"));
  assert.deepEqual(projectProfilePreflightBindingIds(before, JSON.stringify(original)), []);
});

test("project-profile CLI accepts validated related-workspace evidence and surfaces required preflight failure", () => {
  const root = workspace(); const related = workspace();
  const policy = "## Policy\n";
  write(root, "AGENTS.md", policy);
  write(related, "token", "npm_RELATED_12345678901234567890");
  const operationIds = ["package.publish"];
  const resourceBinding = {
    bindingId: "binding:npm-related", providerId: "npm", purpose: "Observe npm actor.", operationIds,
    adapterId: "npm-registry",
    locator: { kind: "related-workspace-file", workspaceRelationshipId: "relationship:credentials", workspaceIdentityId: "workspace:related", rootEnvironmentVariable: "RELATED_ROOT", path: "token" },
    expectedIdentityClaimIds: ["claim:actor"], requiredness: "required",
  };
  const value = declaration(
    [source("source:policy", "AGENTS.md", policy)],
    [{ ...claim("claim:actor", "source:policy", "npm.actor", "expected-user"), operationIds }],
    [resourceBinding],
  );
  value.workspaceRelationshipIds = ["relationship:credentials"];
  install(root, value);
  const relationshipPath = resolve(root, "relationship.json");
  const identityPath = resolve(root, "related-identity.json");
  const ownerIdentityPath = resolve(root, "owner-identity.json");
  writeFileSync(relationshipPath, JSON.stringify({ schemaVersion: "1.0", relationshipId: "relationship:credentials", sourceWorkspaceIdentityId: "workspace:test", targetWorkspaceIdentityId: "workspace:related", relationshipType: "dependency", governanceApplicability: "none", applicabilityScope: [], declaredBySourceId: "source:policy", provenanceStatus: "confirmed", authorityTransfer: false, observedAt }));
  writeFileSync(identityPath, JSON.stringify({ schemaVersion: "1.0", workspaceIdentityId: "workspace:related", canonicalRootLocator: related, boundaryClaims: [{ providerId: "local", kind: "explicit-workspace", identity: "related-root", observedAt }], observedAt }));
  writeFileSync(ownerIdentityPath, JSON.stringify(absoluteIdentity(root)));
  const cli = resolve(plugin, "scripts/forgerail.mjs");
  const result = spawnSync(process.execPath, [cli, "project-profile-inspect", "--workspace", root, "--workspace-identity", ownerIdentityPath, "--operation", "package.publish", "--target", "package:@scope/name", "--workspace-relationship", relationshipPath, "--related-workspace-identity", identityPath], { encoding: "utf8", env: { PATH: "", RELATED_ROOT: related } });
  const output = JSON.parse(result.stdout);
  assert.equal(result.status, 1);
  assert.equal(output.status, "unresolved");
  assert.equal(output.profileStatus, "resolved");
  assert.equal(output.providerObservation.providerCalls, 1);
  assert.equal(JSON.stringify(output).includes("npm_RELATED"), false);
});
