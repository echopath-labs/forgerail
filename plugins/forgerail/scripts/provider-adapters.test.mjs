import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import { classifyProjectProfileInspection, observeProjectProfileBindings, providerAdapterRegistry } from "./lib/provider-adapters.mjs";
import { validateContract } from "./lib/contracts.mjs";

const observedAt = "2026-09-27T00:00:00Z";
const workspace = () => realpathSync(mkdtempSync(resolve(tmpdir(), "forgerail-provider-")));
function write(root, path, content) { mkdirSync(dirname(resolve(root, path)), { recursive: true }); writeFileSync(resolve(root, path), content); }
function declaration(binding) {
  return { schemaVersion: "1.0", profileId: "profile:test", workspaceIdentityId: "workspace:test", workspaceRelationshipIds: binding.locator.kind === "related-workspace-file" ? [binding.locator.workspaceRelationshipId] : [], sources: [{ sourceId: "source:policy", sourceKind: "instructions", locator: "AGENTS.md", requiredness: "required", expectedSha256: null }], claims: [{ claimId: "claim:actor", sourceId: "source:policy", sourcePointer: { kind: "markdown-heading", heading: "## Policy" }, ruleKey: "provider.actor", normalizedValue: "expected-user", operationIds: binding.operationIds }], resourceBindings: [{ ...binding, expectedIdentityClaimIds: ["claim:actor"], requiredness: "required" }] };
}
function context(root, executionContextIdentityId = "execution:test") {
  return { schemaVersion: "1.0", executionContextIdentityId, workspaceIdentityId: "workspace:test", subjectId: "subject:test", entrypoint: { entrypointId: "entrypoint:inspect", kind: "local-command", locator: "forgerail project-profile-inspect", digest: null }, invocationRoot: root, executor: { executorId: "forgerail", kind: "local-process" }, runner: { runnerId: "local", trustClass: "local-observed" }, toolIdentities: ["forgerail:0.1.7"], providerIdentities: [], dependencies: [], observedAt, sanitized: true };
}
const base = { bindingId: "binding:actor", purpose: "Observe the authenticated actor without mutation." };

test("provider registry is separate, bounded, and read-only", () => {
  assert.deepEqual(Object.keys(providerAdapterRegistry).sort(), ["git-ssh", "github-cli-api", "npm-registry"]);
  for (const adapter of Object.values(providerAdapterRegistry)) { assert.equal(adapter.readOnly, true); assert.ok(adapter.operations.length); assert.ok(adapter.locatorKinds.length); }
});

test("resource bindings reject operations outside the selected adapter registry", () => {
  const value = declaration({ ...base, providerId: "github", adapterId: "github-cli-api", operationIds: ["github.pull-request"], locator: { kind: "provider-native", providerId: "github", coordinates: { host: "github.com" } } });
  const result = validateContract("project-profile-declaration", value);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("unsupported by github-cli-api")));
});

test("declaration validation enforces operation bounds and identity-claim applicability", () => {
  const binding = { ...base, providerId: "npm", adapterId: "npm-registry", operationIds: ["package.publish"], locator: { kind: "provider-native", providerId: "npm", coordinates: { registry: "https://registry.npmjs.org" } } };
  const mismatched = declaration(binding);
  mismatched.claims[0].operationIds = ["git.push"];
  const mismatchResult = validateContract("project-profile-declaration", mismatched);
  assert.equal(mismatchResult.valid, false);
  assert.ok(mismatchResult.errors.some((error) => error.includes("does not apply to binding operations")));
  const oversized = declaration(binding);
  oversized.resourceBindings = [];
  oversized.claims[0].operationIds = Array.from({ length: 65 }, (_, index) => `operation.${index}`);
  const oversizedResult = validateContract("project-profile-declaration", oversized);
  assert.equal(oversizedResult.valid, false);
  assert.ok(oversizedResult.errors.some((error) => error.includes("at most 64 items")));
});

test("local-only and unrelated operation inspection performs no provider calls", () => {
  const root = workspace(); let calls = 0;
  const value = declaration({ ...base, providerId: "github", adapterId: "github-cli-api", operationIds: ["git.push"], locator: { kind: "provider-native", providerId: "github", coordinates: { host: "github.com" } } });
  const local = observeProjectProfileBindings({ workspace: root, declaration: value, run() { calls++; }, observedAt });
  const unrelated = observeProjectProfileBindings({ workspace: root, declaration: value, operationId: "release.publish", targetId: "release:v1", executionContextIdentity: context(root), run() { calls++; }, observedAt });
  assert.equal(calls, 0); assert.equal(local.providerCalls, 0); assert.equal(unrelated.bindings[0].status, "not-applicable");
});

test("GitHub API and Git SSH identities stay independent and wrong actors remain visible", () => {
  const root = workspace(); const calls = [];
  const bindings = [
    { ...base, bindingId: "binding:github", providerId: "github", adapterId: "github-cli-api", operationIds: ["git.push"], locator: { kind: "provider-native", providerId: "github", coordinates: { host: "github.com" } } },
    { ...base, bindingId: "binding:ssh", providerId: "git", adapterId: "git-ssh", operationIds: ["git.push"], locator: { kind: "provider-native", providerId: "git", coordinates: { hostAlias: "github-work" } } },
  ];
  const value = declaration(bindings[0]); value.resourceBindings.push({ ...bindings[1], expectedIdentityClaimIds: ["claim:actor"], requiredness: "required" });
  const result = observeProjectProfileBindings({ workspace: root, declaration: value, operationId: "git.push", targetId: "repo:one", executionContextIdentity: context(root), observedAt, run(command, args) { calls.push([command, ...args]); return command === "gh" ? { status: 0, stdout: "expected-user\n", stderr: "" } : { status: 1, stdout: "", stderr: "Hi other-user! Authentication succeeded.\n" }; } });
  assert.equal(result.providerCalls, 2); assert.equal(result.bindings[0].status, "matched"); assert.equal(result.bindings[1].status, "wrong-actor");
  assert.equal(result.observations[0].identity.actorId, "expected-user"); assert.equal(result.observations[1].identity.actorId, "other-user");
  assert.deepEqual(calls[0], ["gh", "api", "user", "--hostname", "github.com", "--jq", ".login"]); assert.deepEqual(calls[1], ["ssh", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", "-T", "git@github-work"]);
});

test("npm sentinel credentials are temporary, never arguments or observations, and permission stays unverified", () => {
  const root = workspace(); const sentinel = "npm_SENTINEL_SECRET_12345678901234567890"; let configPath;
  const value = declaration({ ...base, providerId: "npm", adapterId: "npm-registry", operationIds: ["package.publish"], locator: { kind: "environment-variable", name: "FORGERAIL_TEST_NPM_TOKEN" } });
  const result = observeProjectProfileBindings({ workspace: root, declaration: value, operationId: "package.publish", targetId: "package:@scope/name", executionContextIdentity: context(root), environment: { FORGERAIL_TEST_NPM_TOKEN: sentinel, NPM_TOKEN: "ambient-token", NPM_CONFIG_GLOBALCONFIG: "/ambient/npmrc" }, observedAt, run(command, args, options) { configPath = options.env.NPM_CONFIG_USERCONFIG; assert.equal(command, "npm"); assert.ok(readFileSync(configPath, "utf8").includes(sentinel)); assert.equal(options.env.FORGERAIL_TEST_NPM_TOKEN, undefined); assert.equal(options.env.NPM_TOKEN, undefined); assert.equal(options.env.NPM_CONFIG_GLOBALCONFIG, undefined); assert.notEqual(options.cwd, root); assert.ok(!args.join(" ").includes(sentinel)); return { status: 0, stdout: "expected-user\n", stderr: sentinel }; } });
  assert.equal(existsSync(configPath), false); assert.equal(JSON.stringify(result).includes(sentinel), false); assert.equal(result.bindings[0].status, "matched");
  assert.equal(result.observations[0].capabilities.find((item) => item.capability === "authority-observation").state, "unknown");
  assert.equal(result.bindings[0].targetPermission, "unverified");
});

test("npm temporary credential material is removed on provider error and interruption", () => {
  for (const mode of ["error", "interruption"]) {
    const root = workspace(); let configPath;
    const value = declaration({ ...base, providerId: "npm", adapterId: "npm-registry", operationIds: ["package.publish"], locator: { kind: "environment-variable", name: "FORGERAIL_TEST_NPM_TOKEN" } });
    const result = observeProjectProfileBindings({ workspace: root, declaration: value, operationId: "package.publish", targetId: "package:@scope/name", executionContextIdentity: context(root), environment: { FORGERAIL_TEST_NPM_TOKEN: "npm_SENTINEL_CLEANUP_12345678901234567890" }, observedAt, run(_command, _args, options) { configPath = options.env.NPM_CONFIG_USERCONFIG; if (mode === "interruption") throw new Error("simulated interruption"); return { status: 1, stdout: "", stderr: "provider error" }; } });
    assert.equal(existsSync(configPath), false); assert.equal(result.bindings[0].status, "unresolved");
  }
});

for (const signalName of ["SIGINT", "SIGTERM", "SIGHUP"]) test(`npm temporary credentials are removed when the observing process receives ${signalName}`, async () => {
  const root = workspace();
  const marker = resolve(root, "config-path.txt");
  const childScript = resolve(root, "signal-observer.mjs");
  const moduleUrl = new URL("./lib/provider-adapters.mjs", import.meta.url).href;
  writeFileSync(childScript, `import { writeFileSync } from "node:fs";\nimport { spawnSync } from "node:child_process";\nimport { observeProjectProfileBindings } from ${JSON.stringify(moduleUrl)};\nconst observedAt = ${JSON.stringify(observedAt)};\nconst root = ${JSON.stringify(root)};\nconst marker = ${JSON.stringify(marker)};\nconst declaration = ${JSON.stringify(declaration({ ...base, providerId: "npm", adapterId: "npm-registry", operationIds: ["package.publish"], locator: { kind: "environment-variable", name: "FORGERAIL_TEST_NPM_TOKEN" } }))};\nconst executionContextIdentity = ${JSON.stringify(context(root))};\nobserveProjectProfileBindings({ workspace: root, declaration, operationId: "package.publish", targetId: "package:@scope/name", executionContextIdentity, environment: { FORGERAIL_TEST_NPM_TOKEN: "npm_SIGNAL_SENTINEL_12345678901234567890" }, observedAt, run(_command, _args, options) { writeFileSync(marker, options.env.NPM_CONFIG_USERCONFIG); spawnSync(process.execPath, ["-e", "setTimeout(() => {}, 1000)"]); return { status: 0, stdout: "expected-user\\n", stderr: "" }; } });\n`);
  const child = spawn(process.execPath, [childScript], { stdio: "ignore" });
  for (let attempt = 0; attempt < 200 && !existsSync(marker); attempt++) await new Promise((resolveWait) => setTimeout(resolveWait, 10));
  assert.equal(existsSync(marker), true);
  const configPath = readFileSync(marker, "utf8");
  assert.equal(existsSync(configPath), true);
  child.kill(signalName);
  const result = await new Promise((resolveExit) => child.once("exit", (code, signal) => resolveExit({ code, signal })));
  assert.equal(result.signal, signalName);
  assert.equal(existsSync(configPath), false);
});

test("missing explicit credentials never fall back to ambient npm authentication", () => {
  const root = workspace(); let calls = 0;
  const value = declaration({ ...base, providerId: "npm", adapterId: "npm-registry", operationIds: ["package.publish"], locator: { kind: "environment-variable", name: "FORGERAIL_TEST_NPM_TOKEN" } });
  const result = observeProjectProfileBindings({ workspace: root, declaration: value, operationId: "package.publish", targetId: "package:@scope/name", executionContextIdentity: context(root), environment: { NPM_TOKEN: "npm_AMBIENT_12345678901234567890" }, observedAt, run() { calls++; return { status: 0, stdout: "expected-user\n", stderr: "" }; } });
  assert.equal(calls, 0);
  assert.equal(result.bindings[0].status, "unresolved");
});

test("npm setup failures remove temporary state before returning an unresolved observation", () => {
  const root = workspace(); let calls = 0;
  const before = new Set(readdirSync(tmpdir()).filter((name) => name.startsWith("forgerail-npm-observe-")));
  const value = declaration({ ...base, providerId: "npm", adapterId: "npm-registry", operationIds: ["package.publish"], locator: { kind: "provider-native", providerId: "npm", coordinates: { registry: "not-a-url" } } });
  const result = observeProjectProfileBindings({ workspace: root, declaration: value, operationId: "package.publish", targetId: "package:@scope/name", executionContextIdentity: context(root), environment: {}, observedAt, run() { calls++; } });
  const created = readdirSync(tmpdir()).filter((name) => name.startsWith("forgerail-npm-observe-") && !before.has(name));
  assert.equal(calls, 0);
  assert.deepEqual(created, []);
  assert.equal(result.bindings[0].status, "unresolved");
});

test("credential-like provider output and target values are never retained or hashed", () => {
  const root = workspace(); const sentinel = "npm_SENTINEL_OUTPUT_12345678901234567890";
  const value = declaration({ ...base, providerId: "github", adapterId: "github-cli-api", operationIds: ["git.push"], locator: { kind: "provider-native", providerId: "github", coordinates: { host: "github.com" } } });
  const result = observeProjectProfileBindings({ workspace: root, declaration: value, operationId: "git.push", targetId: "repository:owner/name", executionContextIdentity: context(root), observedAt, run() { return { status: 0, stdout: `${sentinel}\n`, stderr: sentinel }; } });
  assert.equal(result.bindings[0].status, "unresolved"); assert.equal(JSON.stringify(result).includes(sentinel), false);
  assert.throws(() => observeProjectProfileBindings({ workspace: root, declaration: value, operationId: "git.push", targetId: sentinel, executionContextIdentity: context(root), observedAt, run() {} }), /unsafe/);
});

test("a provider-native session hidden in one sandbox is unavailable only in that execution context", () => {
  const root = workspace();
  const value = declaration({ ...base, providerId: "github", adapterId: "github-cli-api", operationIds: ["git.push"], locator: { kind: "provider-native", providerId: "github", coordinates: { host: "github.com" } } });
  const hidden = observeProjectProfileBindings({ workspace: root, declaration: value, operationId: "git.push", targetId: "repository:owner/name", executionContextIdentity: context(root, "execution:hidden-keychain"), observedAt, run() { return { status: 1, stdout: "", stderr: "credential store unavailable" }; } });
  const visible = observeProjectProfileBindings({ workspace: root, declaration: value, operationId: "git.push", targetId: "repository:owner/name", executionContextIdentity: context(root, "execution:visible-keychain"), observedAt, run() { return { status: 0, stdout: "expected-user\n", stderr: "" }; } });
  assert.equal(hidden.executionContextIdentityId, "execution:hidden-keychain"); assert.equal(hidden.observations[0].identity.state, "unavailable");
  assert.equal(visible.executionContextIdentityId, "execution:visible-keychain"); assert.equal(visible.observations[0].identity.state, "authenticated");
});

test("operation-scoped provider observation requires an exact operation and target pair", () => {
  const root = workspace();
  const value = declaration({ ...base, providerId: "github", adapterId: "github-cli-api", operationIds: ["git.push"], locator: { kind: "provider-native", providerId: "github", coordinates: { host: "github.com" } } });
  assert.throws(() => observeProjectProfileBindings({ workspace: root, declaration: value, operationId: "git.push", executionContextIdentity: context(root), observedAt }), /operation and target together/);
  assert.throws(() => observeProjectProfileBindings({ workspace: root, declaration: value, targetId: "repository:owner/name", executionContextIdentity: context(root), observedAt }), /operation and target together/);
});

test("missing locators and related-workspace identity mismatch produce sanitized unresolved observations without calls", () => {
  const owner = workspace(); const related = workspace(); let calls = 0;
  const locator = { kind: "related-workspace-file", workspaceRelationshipId: "relationship:credentials", workspaceIdentityId: "workspace:related", rootEnvironmentVariable: "RELATED_ROOT", path: "token" };
  const value = declaration({ ...base, providerId: "npm", adapterId: "npm-registry", operationIds: ["package.publish"], locator });
  const relationship = { schemaVersion: "1.0", relationshipId: "relationship:credentials", sourceWorkspaceIdentityId: "workspace:test", targetWorkspaceIdentityId: "workspace:related", relationshipType: "dependency", governanceApplicability: "none", applicabilityScope: [], declaredBySourceId: "source:policy", provenanceStatus: "confirmed", authorityTransfer: false, observedAt };
  write(related, "token", "secret-sentinel");
  const relatedIdentity = { schemaVersion: "1.0", workspaceIdentityId: "workspace:related", canonicalRootLocator: owner, boundaryClaims: [{ providerId: "local", kind: "explicit-workspace", identity: "wrong", observedAt }], observedAt };
  const result = observeProjectProfileBindings({ workspace: owner, declaration: value, operationId: "package.publish", targetId: "package:@scope/name", executionContextIdentity: context(owner), workspaceRelationships: [relationship], relatedWorkspaceIdentities: [relatedIdentity], environment: { RELATED_ROOT: related }, observedAt, run() { calls++; } });
  assert.equal(calls, 0); assert.equal(result.bindings[0].status, "unresolved"); assert.equal(result.bindings[0].rebind.action, "review-project-profile-candidate"); assert.deepEqual(result.bindings[0].operationIds, ["package.publish"]); assert.equal(JSON.stringify(result).includes("secret-sentinel"), false);
});

test("related-workspace credentials require valid confirmed relationship and identity evidence", () => {
  const owner = workspace(); const related = workspace(); let calls = 0;
  const locator = { kind: "related-workspace-file", workspaceRelationshipId: "relationship:credentials", workspaceIdentityId: "workspace:related", rootEnvironmentVariable: "RELATED_ROOT", path: "token" };
  const value = declaration({ ...base, providerId: "npm", adapterId: "npm-registry", operationIds: ["package.publish"], locator });
  const relationship = { schemaVersion: "1.0", relationshipId: "relationship:credentials", sourceWorkspaceIdentityId: "workspace:test", targetWorkspaceIdentityId: "workspace:related", relationshipType: "dependency", governanceApplicability: "none", applicabilityScope: [], declaredBySourceId: "source:policy", provenanceStatus: "confirmed", authorityTransfer: false, observedAt };
  const relatedIdentity = { schemaVersion: "1.0", workspaceIdentityId: "workspace:related", canonicalRootLocator: related, boundaryClaims: [{ providerId: "local", kind: "explicit-workspace", identity: "related-root", observedAt }], observedAt };
  write(related, "token", "npm_RELATED_12345678901234567890");
  const valid = observeProjectProfileBindings({ workspace: owner, declaration: value, operationId: "package.publish", targetId: "package:@scope/name", executionContextIdentity: context(owner), workspaceRelationships: [relationship], relatedWorkspaceIdentities: [relatedIdentity], environment: { RELATED_ROOT: related }, observedAt, run() { calls++; return { status: 0, stdout: "expected-user\n", stderr: "" }; } });
  assert.equal(calls, 1);
  assert.equal(valid.bindings[0].status, "matched");
  const unconfirmed = observeProjectProfileBindings({ workspace: owner, declaration: value, operationId: "package.publish", targetId: "package:@scope/name", executionContextIdentity: context(owner), workspaceRelationships: [{ ...relationship, provenanceStatus: "inferred" }], relatedWorkspaceIdentities: [relatedIdentity], environment: { RELATED_ROOT: related }, observedAt, run() { calls++; } });
  assert.equal(calls, 1);
  assert.equal(unconfirmed.bindings[0].status, "unresolved");
  write(owner, "token", "npm_OWNER_SENTINEL_12345678901234567890");
  for (const alias of [owner, `${owner}/.`]) {
    const aliased = observeProjectProfileBindings({ workspace: owner, declaration: value, operationId: "package.publish", targetId: "package:@scope/name", executionContextIdentity: context(owner), workspaceRelationships: [relationship], relatedWorkspaceIdentities: [{ ...relatedIdentity, canonicalRootLocator: alias }], environment: { RELATED_ROOT: alias }, observedAt, run() { calls++; return { status: 0, stdout: "expected-user", stderr: "" }; } });
    assert.equal(aliased.bindings[0].status, "unresolved");
    assert.equal(calls, 1);
  }
});

test("inspection classification blocks required wrong actors and degrades optional failures", () => {
  const profile = { status: "resolved", profile: { completeness: "complete" } };
  assert.equal(classifyProjectProfileInspection(profile, { bindings: [{ requiredness: "required", status: "matched" }] }, "git.push"), "ready");
  assert.equal(classifyProjectProfileInspection(profile, { bindings: [{ requiredness: "required", status: "wrong-actor" }] }, "git.push"), "blocked");
  assert.equal(classifyProjectProfileInspection(profile, { bindings: [{ requiredness: "required", status: "unresolved" }] }, "git.push"), "unresolved");
  assert.equal(classifyProjectProfileInspection(profile, { bindings: [{ requiredness: "required", status: "matched", targetPermission: "unverified" }] }, "package.publish"), "unresolved");
  assert.equal(classifyProjectProfileInspection(profile, { bindings: [{ requiredness: "required", status: "matched", targetPermission: "unverified" }] }, "package.inspect"), "ready");
  assert.equal(classifyProjectProfileInspection(profile, { bindings: [{ requiredness: "optional", status: "unresolved" }] }, "git.push"), "degraded");
});


test("bindings reject contradictory identities before observing and bound identity references", () => {
  const value = declaration({ ...base, providerId: "github", adapterId: "github-cli-api", operationIds: ["git.push"], locator: { kind: "provider-native", providerId: "github", coordinates: { host: "github.com" } } });
  value.claims = Array.from({ length: 16 }, (_, index) => ({ ...value.claims[0], claimId: `claim:actor-${index}` }));
  value.resourceBindings[0].expectedIdentityClaimIds = value.claims.map((claim) => claim.claimId);
  assert.equal(validateContract("project-profile-declaration", value).valid, true);
  value.claims.push({ ...value.claims[0], claimId: "claim:actor-16" });
  value.resourceBindings[0].expectedIdentityClaimIds.push("claim:actor-16");
  assert.match(validateContract("project-profile-declaration", value).errors.join("\n"), /at most 16/);
  value.claims.pop(); value.resourceBindings[0].expectedIdentityClaimIds.pop();
  value.claims[1].normalizedValue = "other-user";
  assert.match(validateContract("project-profile-declaration", value).errors.join("\n"), /consistent string identity/);
  let calls = 0;
  assert.throws(() => observeProjectProfileBindings({ workspace: workspace(), declaration: value, observedAt, run() { calls++; } }), /consistent string identity/);
  assert.equal(calls, 0);
});

test("credential-like identifiers and unknown keys are rejected without echoing secrets", () => {
  const secret = "ghp_" + "A".repeat(30);
  const baseValue = declaration({ ...base, providerId: "github", adapterId: "github-cli-api", operationIds: ["git.push"], locator: { kind: "provider-native", providerId: "github", coordinates: { host: "github.com" } } });
  const mutate = [
    (v) => v.profileId = secret,
    (v) => v.workspaceIdentityId = secret,
    (v) => v.sources[0].sourceId = secret,
    (v) => v.claims[0].claimId = secret,
    (v) => v.resourceBindings[0].bindingId = secret,
    (v) => v.claims[0].sourcePointer.heading = secret,
    (v) => v[secret] = "unknown",
    (v) => v.claims[0].normalizedValue = { [secret]: "unknown" },
  ];
  for (const change of mutate) {
    const value = structuredClone(baseValue); change(value);
    const result = validateContract("project-profile-declaration", value);
    assert.equal(result.valid, false);
    assert.match(result.errors.join("\n"), /credential material/);
    assert.equal(JSON.stringify(result).includes(secret), false);
  }
});

test("inspection selectors reject all declaration-grade credentials before provider calls", () => {
  const root = workspace(); let calls = 0;
  const value = declaration({ ...base, providerId: "github", adapterId: "github-cli-api", operationIds: ["git.push"], locator: { kind: "provider-native", providerId: "github", coordinates: { host: "github.com" } } });
  for (const secret of ["npm_" + "A".repeat(30), "https://user:password@example.test", "eyJ" + "a".repeat(12) + "." + "b".repeat(12) + "." + "c".repeat(12)].flatMap((value) => [value, `repo:${value}:suffix`])) {
    for (const field of ["operationId", "targetId"]) {
      assert.throws(() => observeProjectProfileBindings({ workspace: root, declaration: value, operationId: "git.push", targetId: "repo:test", [field]: secret, executionContextIdentity: context(root), observedAt, run() { calls++; } }), (error) => /credential-like material/.test(error.message) && !error.message.includes(secret));
    }
  }
  assert.equal(calls, 0);
  const jwt = "eyJ" + "a".repeat(12) + "." + "b".repeat(12) + "." + "c".repeat(12);
  const result = observeProjectProfileBindings({ workspace: root, declaration: value, operationId: "git.push", targetId: "repo:test", executionContextIdentity: context(root), observedAt, run() { return { status: 0, stdout: jwt, stderr: "" }; } });
  assert.equal(result.bindings[0].status, "unresolved");
  assert.equal(JSON.stringify(result).includes(jwt), false);
});

test("observation and evidence identities distinguish targets and execution contexts", () => {
  const root = workspace();
  const value = declaration({ ...base, providerId: "github", adapterId: "github-cli-api", operationIds: ["git.push"], locator: { kind: "provider-native", providerId: "github", coordinates: { host: "github.com" } } });
  const results = [["repo:one", "execution:one"], ["repo:two", "execution:one"], ["repo:one", "execution:two"]].map(([targetId, executionId]) => observeProjectProfileBindings({ workspace: root, declaration: value, operationId: "git.push", targetId, executionContextIdentity: context(root, executionId), observedAt, run() { return { status: 0, stdout: "expected-user", stderr: "" }; } }));
  assert.equal(new Set(results.map((r) => r.observations[0].observationId)).size, 3);
  assert.equal(new Set(results.map((r) => r.observations[0].identity.evidenceIdentityIds[0])).size, 3);
});

test("workspace relationship declarations enforce the shared 128 item limit", () => {
  const value = declaration({ ...base, providerId: "github", adapterId: "github-cli-api", operationIds: ["git.push"], locator: { kind: "provider-native", providerId: "github", coordinates: { host: "github.com" } } });
  value.workspaceRelationshipIds = Array.from({length:128}, (_, i) => `relationship:${i}`);
  assert.equal(validateContract("project-profile-declaration", value).valid, true);
  value.workspaceRelationshipIds.push("relationship:overflow");
  assert.match(validateContract("project-profile-declaration", value).errors.join("\n"), /at most 128/);
});


test("native provider bindings require their own coordinate and reject unrelated keys", () => {
  for (const [adapterId, providerId, coordinate, coordinateValue, operationId] of [["github-cli-api", "github", "host", "github.com", "git.push"], ["git-ssh", "git", "hostAlias", "github-work", "git.push"], ["npm-registry", "npm", "registry", "https://registry.npmjs.org", "package.publish"]]) {
    const value = declaration({ ...base, providerId, adapterId, operationIds: [operationId], locator: { kind: "provider-native", providerId, coordinates: { [coordinate]: coordinateValue } } });
    assert.equal(validateContract("project-profile-declaration", value).valid, true);
    value.resourceBindings[0].locator.coordinates.foo = "bar";
    assert.equal(validateContract("project-profile-declaration", value).valid, false);
    delete value.resourceBindings[0].locator.coordinates[coordinate];
    assert.equal(validateContract("project-profile-declaration", value).valid, false);
  }
});
