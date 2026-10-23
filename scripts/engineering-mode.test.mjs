import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { validateContract } from "./lib/contracts.mjs";
import { loadProjectProfile, projectProfilePath } from "./lib/project-profile.mjs";
import { resolveEffectiveProfileV2 } from "./lib/composition.mjs";
import { branchPrefixPattern, explainEngineeringMode, portableBranchPrefixes, resolveBranchPolicy } from "./lib/engineering-mode.mjs";

const observedAt = "2026-10-20T00:00:00Z";
const digest = (text) => createHash("sha256").update(text).digest("hex");
function fixture(t, rules, { kind = "structured-profile", operationIds = ["engineering.implement"] } = {}) {
  const root = mkdtempSync(resolve(tmpdir(), "forgerail-engineering-mode-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const content = JSON.stringify(Object.fromEntries(rules));
  writeFileSync(resolve(root, "policy.json"), content);
  const declaration = {
    schemaVersion: "1.0", profileId: "profile:test", workspaceIdentityId: "workspace:test", workspaceRelationshipIds: [],
    sources: [{ sourceId: "source:policy", sourceKind: kind, locator: "policy.json", requiredness: "required", expectedSha256: digest(content) }],
    claims: rules.map(([ruleKey, normalizedValue], index) => ({ claimId: `claim:${index}`, sourceId: "source:policy", ruleKey, normalizedValue,
      sourcePointer: { kind: "json-pointer", pointer: `/${ruleKey}` }, operationIds })), resourceBindings: [],
  };
  const workspaceIdentity = { schemaVersion: "1.0", workspaceIdentityId: "workspace:test", canonicalRootLocator: root,
    boundaryClaims: [{ providerId: "git", kind: "repository", identity: "repo:test", observedAt }], observedAt };
  mkdirSync(resolve(root, ".forgerail"));
  const install = () => writeFileSync(resolve(root, projectProfilePath), JSON.stringify(declaration));
  install();
  return { root, declaration, install, load: () => loadProjectProfile({ workspace: root, workspaceIdentity, computedAt: observedAt }) };
}
const explain = (loadedProfile, extra = {}) => explainEngineeringMode({ loadedProfile, operationId: "engineering.implement", ...extra });
const policy = (loadedProfile, extra = {}) => resolveBranchPolicy({ loadedProfile, operationId: "engineering.implement", ...extra });

test("known rule semantics reject invalid enums and executable prefixes while unknown keys remain compatible", (t) => {
  const value = fixture(t, [["engineering.mode", "fast"]]);
  for (const mode of ["fast", "balanced", "strict"]) {
    value.declaration.claims[0].normalizedValue = mode;
    assert.equal(validateContract("project-profile-declaration", value.declaration).valid, true);
  }
  for (const mode of ["FAST", "", null, {}, ["fast"]]) {
    value.declaration.claims[0].normalizedValue = mode;
    assert.equal(validateContract("project-profile-declaration", value.declaration).valid, false);
  }
  const claim = value.declaration.claims[0];
  claim.ruleKey = "git.branch.naming";
  claim.normalizedValue = { prefixes: { ...portableBranchPrefixes } };
  assert.equal(validateContract("project-profile-declaration", value.declaration).valid, true);
  for (const prefix of ["feat", "../", "a//", ".hidden/", "a.lock/", "a./", "-bad/", "a b/", "$(id)/", "feat/.*/", "feat/[a-z]/", "feat/|x/"]) {
    claim.normalizedValue.prefixes = { ...portableBranchPrefixes, feature: [prefix] };
    assert.equal(validateContract("project-profile-declaration", value.declaration).valid, false, prefix);
  }
  for (const prefixes of [{ ...portableBranchPrefixes, feature: [] }, { ...portableBranchPrefixes, fix: ["fix/", "fix/"] }, { feature: ["feat/"] }, { ...portableBranchPrefixes, other: ["other/"] }]) {
    claim.normalizedValue = { prefixes };
    assert.equal(validateContract("project-profile-declaration", value.declaration).valid, false);
  }
  claim.ruleKey = "project.custom-rule";
  claim.normalizedValue = { arbitrary: [1, false, null] };
  assert.equal(validateContract("project-profile-declaration", value.declaration).valid, true);
  const declarationSchema = JSON.parse(readFileSync(new URL("../contracts/project-profile-declaration-v1.schema.json", import.meta.url)));
  const ruleSchema = JSON.parse(readFileSync(new URL("../contracts/rule-claim-v1.schema.json", import.meta.url)));
  assert.equal(declarationSchema.$defs.branchPrefixes.items.pattern, branchPrefixPattern);
  assert.deepEqual(ruleSchema.$defs.branchPrefixes, declarationSchema.$defs.branchPrefixes);
});

test("M01/M02: absent and old profiles default balanced; valid modes retain source, scope and revision", (t) => {
  assert.equal(explain({ status: "not-adopted" }).mode, "balanced");
  const old = fixture(t, [["git.actor", "chase"]]);
  assert.equal(explain(old.load()).mode, "balanced");
  assert.equal(explain(old.load()).source, "portable-defaults");
  assert.equal(policy(old.load()).mandatory, false);
  for (const mode of ["fast", "balanced", "strict"]) {
    const value = fixture(t, [["engineering.mode", mode]]);
    const loaded = value.load();
    const result = explain(loaded);
    assert.equal(result.status, "resolved");
    assert.equal(result.mode, mode);
    assert.equal(result.revision, loaded.profileRevisionId);
    assert.deepEqual(result.claims[0].applicabilityScope, ["engineering.implement"]);
    assert.equal(result.claims[0].observationPoint, "policy.json#/engineering.mode");
    assert.equal(explain(loaded, { operationId: "git.push" }).mode, "balanced");
    assert.equal(explain(loaded, { operationId: null }).status, "unresolved");
  }
});

test("M03/M17: invalid mode errors; drift stays unresolved and temporary balanced never repairs configuration", (t) => {
  const value = fixture(t, [["engineering.mode", "fast"]]);
  writeFileSync(resolve(value.root, "policy.json"), '{"engineering.mode":"balanced"}');
  const before = readFileSync(resolve(value.root, projectProfilePath));
  const result = explain(value.load());
  assert.equal(result.status, "unresolved");
  assert.equal(result.mode, null);
  assert.equal(result.temporaryPolicy.mode, "balanced");
  assert.equal(result.temporaryPolicy.requiresHostCheck, true);
  assert.equal(result.temporaryPolicy.resolvesConfiguration, false);
  assert.match(result.limitedReasons.join(), /digest differs/);
  assert.deepEqual(readFileSync(resolve(value.root, projectProfilePath)), before);
  value.declaration.claims[0].normalizedValue = "turbo";
  value.install();
  assert.equal(explain(value.load()).status, "invalid");
  assert.equal(explain(value.load()).temporaryPolicy, null);
});

test("M18: action limitations follow relevant rules, source failure and operation scope, not global completeness", (t) => {
  const value = fixture(t, [["engineering.mode", "fast"], ["git.branch.naming", { prefixes: portableBranchPrefixes }]]);
  writeFileSync(resolve(value.root, "policy.json"), "{}");
  const result = explain(value.load());
  assert.equal(result.temporaryPolicy.dependentActionsMayContinue, false);
  assert.equal(result.actionLimitations[0].ruleKey, "git.branch.naming");
  assert.equal(policy(value.load()).status, "unresolved");
  const unrelated = explain(value.load(), { operationId: "other.operation" });
  assert.equal(unrelated.mode, "balanced");
  assert.deepEqual(unrelated.actionLimitations, []);
  const observed = fixture(t, [["engineering.mode", "fast"]]);
  const blocked = explain(observed.load(), { providerObservation: { bindings: [
    { bindingId: "binding:push", requiredness: "required", operationIds: ["engineering.implement"], status: "wrong-actor" },
    { bindingId: "binding:other", requiredness: "required", operationIds: ["git.push"], status: "wrong-actor" },
  ] } });
  assert.equal(blocked.mode, "fast");
  assert.deepEqual(blocked.actionLimitations.map((item) => item.bindingId), ["binding:push"]);
});

test("M19: strict history must be confirmed and bound to owner and scope; current unconfirmed text is not authority", (t) => {
  const value = fixture(t, [["engineering.mode", "strict"]]);
  const confirmed = value.load();
  writeFileSync(resolve(value.root, "policy.json"), "{}");
  const drifted = value.load();
  const unknown = explain(drifted);
  assert.equal(unknown.temporaryPolicy.mode, "balanced");
  assert.match(unknown.strictHistory, /not-observed/);
  assert.equal(unknown.temporaryPolicy.requiresHostCheck, true);
  const retained = explain(drifted, { confirmedStrict: confirmed });
  assert.equal(retained.status, "unresolved");
  assert.equal(retained.temporaryPolicy.mode, "strict");
  assert.equal(retained.retainedStrict.revision, confirmed.profileRevisionId);
  assert.equal(explain(drifted, { confirmedStrict: drifted }).retainedStrict, null);
  assert.equal(explain(drifted, { confirmedStrict: { ...confirmed, workspace: "/another" } }).retainedStrict, null);
});

test("M04: explicit task decisions stay host scoped, preserve independent limitations and never write Profile", (t) => {
  const value = fixture(t, [["engineering.mode", "balanced"]]);
  const before = readFileSync(resolve(value.root, projectProfilePath));
  const result = explain(value.load(), { taskOverride: { mode: "fast", source: "user:current-task", reason: "bounded prototype" } });
  assert.equal(result.mode, "balanced");
  assert.equal(result.taskMode, "fast");
  assert.equal(result.authorizationClaim, false);
  assert.equal(result.taskOverride.authorizationClaim, false);
  assert.equal(result.taskOverride.higherPriorityAndMandatoryRequirements, "host-must-check-and-preserve");
  assert.deepEqual(readFileSync(resolve(value.root, projectProfilePath)), before);
  assert.equal(explain(value.load(), { taskOverride: { mode: "fast" } }).taskOverride, null);
});

test("existing precedence, relevant equal-authority conflicts and dependencies remain authoritative", (t) => {
  const value = fixture(t, [["engineering.mode", "fast"]]);
  const loaded = value.load();
  const source = loaded.governanceSources[0];
  const claim = loaded.ruleClaims[0];
  const compose = (otherSource, otherClaim, dependencyEdges = []) => {
    const resolved = resolveEffectiveProfileV2({ profileId: "profile:test", profileRevisionId: "revision:test", workspaceIdentityId: "workspace:test",
      governanceSources: [source, otherSource], ruleClaims: [claim, otherClaim], dependencyEdges, computedAt: observedAt });
    assert.equal(resolved.valid, true, resolved.errors.join());
    return { ...loaded, ...resolved, declaration: null, profileRevisionId: "revision:test" };
  };
  const otherSource = { ...source, sourceId: "source:second", ruleClaimIds: ["claim:second"] };
  const otherClaim = { ...claim, sourceId: "source:second", claimId: "claim:second", normalizedValue: "strict" };
  const conflict = explain(compose(otherSource, otherClaim));
  assert.equal(conflict.status, "unresolved");
  assert.equal(conflict.temporaryPolicy.mode, "strict");
  assert.equal(explain(compose({ ...otherSource, precedenceClass: "workspace-instructions" }, { ...otherClaim, precedenceClass: "workspace-instructions" })).mode, "strict");
  const edge = { schemaVersion: "1.0", edgeId: "edge:required", workspaceIdentityId: "workspace:test", declaringSourceId: "source:second",
    target: { kind: "source", locator: "required.json", identity: null }, requiredness: "required", applicabilityScope: ["engineering.implement"],
    provenanceStatus: "structured", observationStatus: "unavailable", affectedClaimIds: ["claim:second"], observedAt, limitedReason: "required source unavailable" };
  const dependent = compose({ ...otherSource, dependencyEdgeIds: [edge.edgeId] }, { ...otherClaim, normalizedValue: "fast", dependencyEdgeIds: [edge.edgeId] }, [edge]);
  assert.equal(explain(dependent).status, "unresolved");
  assert.match(explain(dependent).limitedReasons.join(), /required claim dependency/);
});

test("branch policy is independent of Engineering Mode and preserves project prefixes", (t) => {
  const prefixes = { ...portableBranchPrefixes, feature: ["feature/", "feat/"], fix: ["fix/"] };
  for (const mode of ["fast", "balanced", "strict"]) {
    const value = fixture(t, [["engineering.mode", mode], ["git.branch.naming", { prefixes }]]);
    const result = policy(value.load());
    assert.equal(result.status, "resolved");
    assert.equal(result.mandatory, true);
    assert.deepEqual(result.prefixes, prefixes);
    assert.equal(result.source, "project");
    assert.equal(result.readOnly, true);
    assert.equal(result.authorizationClaim, false);
  }
});

test("shared-source unrelated rules do not block branch policy; relevant failures and required provider checks do", (t) => {
  const value = fixture(t, [["git.branch.naming", { prefixes: portableBranchPrefixes }], ["authorization.deploy", "required"]]);
  value.declaration.claims[1].operationIds = ["production.deploy"];
  value.install();
  const loaded = value.load();
  // A source pointer mismatch affects only its own rule, despite sharing a
  // digest-confirmed source with the valid branch claim.
  value.declaration.claims[1].normalizedValue = "different";
  value.install();
  assert.equal(value.load().profile.completeness, "unresolved");
  assert.equal(policy(value.load()).status, "resolved");
  value.declaration.claims[1].operationIds = ["engineering.implement"];
  value.install();
  assert.equal(policy(value.load()).status, "unresolved");
  assert.equal(policy(value.load()).actionLimitations[0].ruleKey, "authorization.deploy");
  for (const status of ["unresolved", "wrong-actor", "unsupported", "not-requested"]) {
    assert.equal(policy(loaded, { providerObservation: { bindings: [{ bindingId: "binding:required", requiredness: "required", operationIds: ["engineering.implement"], status }] } }).status, "unresolved");
  }
  assert.equal(policy(loaded, { providerObservation: { bindings: [{ bindingId: "binding:optional", requiredness: "optional", operationIds: ["engineering.implement"], status: "unresolved" }] } }).status, "resolved");
});

test("partial precedence and conflicts on another operation reuse the effective claim scopes", (t) => {
  const value = fixture(t, [["engineering.mode", "fast"]], { operationIds: ["engineering.implement", "git.push"] });
  const loaded = value.load();
  const original = loaded.ruleClaims[0];
  const source = loaded.governanceSources[0];
  const higherSource = { ...source, sourceId: "source:higher", ruleClaimIds: ["claim:higher"], precedenceClass: "workspace-instructions" };
  const higherClaim = { ...original, claimId: "claim:higher", sourceId: "source:higher", precedenceClass: "workspace-instructions", normalizedValue: "strict", applicabilityScope: ["engineering.implement"] };
  const resolved = resolveEffectiveProfileV2({ profileId: "profile:test", profileRevisionId: "revision:test", workspaceIdentityId: "workspace:test",
    governanceSources: [source, higherSource], ruleClaims: [original, higherClaim], computedAt: observedAt });
  const interpreted = { ...loaded, ...resolved };
  assert.equal(explain(interpreted).mode, "strict");
  assert.equal(explain(interpreted, { operationId: "git.push" }).mode, "fast");
  const conflictSource = { ...source, sourceId: "source:conflict", ruleClaimIds: ["claim:conflict"] };
  const conflictClaim = { ...original, claimId: "claim:conflict", sourceId: "source:conflict", normalizedValue: "strict", applicabilityScope: ["git.push"] };
  const conflictResult = resolveEffectiveProfileV2({ profileId: "profile:test", profileRevisionId: "revision:test", workspaceIdentityId: "workspace:test",
    governanceSources: [source, conflictSource], ruleClaims: [original, conflictClaim], computedAt: observedAt });
  assert.equal(explain({ ...loaded, ...conflictResult }).mode, "fast");
  assert.equal(explain({ ...loaded, ...conflictResult }, { operationId: "git.push" }).status, "unresolved");
});

test("explicit optional mode failure is unresolved instead of silently adopting portable balanced", (t) => {
  const value = fixture(t, [["engineering.mode", "fast"]]);
  value.declaration.sources[0].requiredness = "optional";
  value.install();
  writeFileSync(resolve(value.root, "policy.json"), "{}");
  const loaded = value.load();
  assert.equal(loaded.profile.completeness, "degraded");
  assert.equal(loaded.profile.ruleClaims.length, 0);
  assert.equal(explain(loaded).status, "unresolved");
  assert.equal(explain(loaded).mode, null);
});

test("Markdown heading existence does not machine-confirm mode or branch prefix values", (t) => {
  const value = fixture(t, [["engineering.mode", "fast"], ["git.branch.naming", { prefixes: portableBranchPrefixes }]]);
  const text = "## Policy\nThe human-readable choice is strict.\n";
  writeFileSync(resolve(value.root, "policy.md"), text);
  value.declaration.sources[0].locator = "policy.md";
  value.declaration.sources[0].expectedSha256 = digest(text);
  for (const claim of value.declaration.claims) claim.sourcePointer = { kind: "markdown-heading", heading: "## Policy" };
  value.install();
  const loaded = value.load();
  assert.equal(loaded.profile.completeness, "complete");
  assert.equal(explain(loaded).status, "unresolved");
  assert.equal(explain(loaded).mode, null);
  assert.match(explain(loaded).limitedReasons.join(), /JSON Pointer/);
  assert.equal(policy(loaded).status, "unresolved");
  value.declaration.claims[0].normalizedValue = "strict";
  value.install();
  const strictText = explain(value.load());
  assert.equal(strictText.claims[0].valueConfirmed, false);
  assert.equal(strictText.confirmedStrictConflict, false);
  assert.equal(strictText.mode, null);
  assert.equal(strictText.temporaryPolicy.requiresHostCheck, true);
});

test('fully covering higher precedence shadows lower conflicts for mode and branch policy', t => {
  for(const key of ['engineering.mode','git.branch.naming']) {
    const val=key==='engineering.mode'?'fast':{prefixes:portableBranchPrefixes};
    const alt=key==='engineering.mode'?'strict':{prefixes:{...portableBranchPrefixes,feature:['feature/']}};
    const loaded=fixture(t,[[key,val]]).load();
    const source=loaded.governanceSources[0], claim=loaded.ruleClaims[0];
    const sources=[source,{...source,sourceId:'source:second',ruleClaimIds:['claim:second']},{...source,sourceId:'source:higher',ruleClaimIds:['claim:higher'],precedenceClass:'workspace-instructions'}];
    const claims=[claim,{...claim,sourceId:'source:second',claimId:'claim:second',normalizedValue:alt},{...claim,sourceId:'source:higher',claimId:'claim:higher',precedenceClass:'workspace-instructions'}];
    const resolved=resolveEffectiveProfileV2({profileId:'profile:test',profileRevisionId:'revision:test',workspaceIdentityId:'workspace:test',governanceSources:sources,ruleClaims:claims,computedAt:observedAt});
    assert.equal(resolved.valid,true,JSON.stringify(resolved.errors));
    const input={...loaded,...resolved,declaration:null};
    const result=key==='engineering.mode'?explain(input):policy(input);
    assert.equal(result.status,'resolved');
    assert.deepEqual(result.claimIds,['claim:higher']);
    assert.deepEqual(result.actionLimitations,[]);
  }
});
