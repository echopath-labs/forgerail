// Interpret the existing Project Profile result. This module neither loads
// sources nor computes precedence, and never grants permission to act.
export const engineeringModes = ["fast", "balanced", "strict"];
export const branchTaskTypes = ["feature", "fix", "maintenance", "documentation"];
export const portableBranchPrefixes = Object.freeze({
  feature: Object.freeze(["feat/"]), fix: Object.freeze(["hotfix/"]),
  maintenance: Object.freeze(["chore/"]), documentation: Object.freeze(["docs/"]),
});

// Literal Git namespace prefixes only; no regular expression or shell syntax.
export const branchPrefixPattern = "^(?!.*\\.\\.)(?!.*@\\{)(?!.*//)(?!.*(?:^|/)\\.)(?!.*(?:\\.|\\.lock)/)[A-Za-z0-9_][A-Za-z0-9._/-]*/$";
const prefixPattern = new RegExp(branchPrefixPattern);
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const unique = (values) => [...new Set(values)].sort();
const applies = (claim, operationId) => operationId !== null && (claim.applicabilityScope ?? claim.operationIds ?? []).includes(operationId);

export function validateKnownRuleValue(ruleKey, value, label, errors) {
  if (ruleKey === "engineering.mode" && !engineeringModes.includes(value)) errors.push(`${label} must be fast, balanced or strict`);
  if (ruleKey !== "git.branch.naming") return;
  if (!object(value) || Object.keys(value).length !== 1 || !object(value.prefixes)) {
    errors.push(`${label} must contain only a prefixes object`);
    return;
  }
  if (Object.keys(value.prefixes).some((key) => !branchTaskTypes.includes(key))) errors.push(`${label}.prefixes contains an unsupported task type`);
  for (const taskType of branchTaskTypes) {
    const prefixes = value.prefixes[taskType];
    if (!Array.isArray(prefixes) || prefixes.length < 1 || prefixes.length > 32
        || prefixes.some((prefix) => typeof prefix !== "string" || prefix.length > 200 || !prefixPattern.test(prefix))
        || new Set(prefixes).size !== prefixes.length) {
      errors.push(`${label}.prefixes.${taskType} must contain 1-32 unique literal Git namespace prefixes ending in / (at most 200 characters each)`);
    }
  }
}

function relevantClaims(loaded, operationId) {
  const decisions = new Map((loaded?.explanation?.claimDecisions ?? []).map((decision) => [decision.claimId, decision]));
  return (loaded?.profile?.ruleClaims ?? []).filter((claim) => applies(claim, operationId) && decisions.get(claim.claimId)?.disposition !== "shadowed");
}

function relevantConflicts(loaded, claims) {
  const ids = new Set(claims.map((claim) => claim.claimId));
  // The generic resolver records whole-claim conflicts. A conflict on another
  // operation must not poison this operation's interpretation.
  return (loaded?.profile?.conflicts ?? []).filter((conflict) => conflict.claimIds.filter((id) => ids.has(id)).length > 1);
}

function interpretRule(loaded, ruleKey, operationId) {
  const base = { ruleKey, operationId, revision: loaded?.profileRevisionId ?? loaded?.profile?.revisionId ?? null,
    source: "project", claimIds: [], sourceIds: [], claims: [], limitedReasons: [], readOnly: true, authorizationClaim: false };
  if (loaded?.status === "not-adopted") return { ...base, status: "default", source: "portable-defaults", value: null };
  if (!loaded?.profile || !loaded.explanation || loaded.status === "invalid") {
    return { ...base, status: "invalid", value: null, limitedReasons: loaded?.errors?.length ? loaded.errors : ["a valid loaded Project Profile is required"] };
  }
  const declared = (loaded.declaration?.claims ?? loaded.profile.ruleClaims).filter((claim) => claim.ruleKey === ruleKey);
  if (operationId === null && declared.length) return { ...base, status: "unresolved", value: null, limitedReasons: ["an operation is required to interpret scoped claims"] };
  const applicableDeclared = declared.filter((claim) => applies(claim, operationId));
  const claims = relevantClaims(loaded, operationId).filter((claim) => claim.ruleKey === ruleKey);
  if (!applicableDeclared.length && !claims.length) return { ...base, status: "default", source: "portable-defaults", value: null };
  const decisions = new Map(loaded.explanation.claimDecisions.map((decision) => [decision.claimId, decision]));
  const omitted = applicableDeclared.filter((claim) => !loaded.profile.ruleClaims.some((item) => item.claimId === claim.claimId)
    && decisions.get(claim.claimId)?.disposition !== "shadowed");
  const conflicts = relevantConflicts(loaded, claims);
  const reasons = [
    ...omitted.map((claim) => `declared claim ${claim.claimId} is not confirmed in the effective Profile`),
    ...applicableDeclared.filter((claim) => claims.some((item) => item.claimId === claim.claimId) && claim.sourcePointer?.kind === "markdown-heading")
      .map((claim) => `claim ${claim.claimId} requires a JSON Pointer to confirm its machine-consumed value; a Markdown heading only confirms a locator`),
    ...claims.filter((claim) => claim.status !== "confirmed" || claim.enforcement !== "enforceable").map((claim) => claim.limitedReason ?? `claim ${claim.claimId} is not confirmed and enforceable`),
    ...conflicts.map((conflict) => conflict.limitedReason),
  ];
  for (const claim of claims) validateKnownRuleValue(ruleKey, claim.normalizedValue, `claim ${claim.claimId}`, reasons);
  return { ...base, status: reasons.length || !claims.length ? "unresolved" : "resolved",
    value: reasons.length || !claims.length ? null : claims[0].normalizedValue,
    claimIds: unique([...claims, ...omitted].map((claim) => claim.claimId)),
    sourceIds: unique([...claims, ...omitted].map((claim) => claim.sourceId)),
    claims: claims.map((claim) => ({ claimId: claim.claimId, sourceId: claim.sourceId, observationPoint: claim.observationPoint,
      applicabilityScope: claim.applicabilityScope, status: claim.status, enforcement: claim.enforcement,
      normalizedValue: claim.normalizedValue, dependencyEdgeIds: claim.dependencyEdgeIds,
      valueConfirmed: declared.find((item) => item.claimId === claim.claimId)?.sourcePointer?.kind !== "markdown-heading" })),
    limitedReasons: unique(reasons),
  };
}

// These are action dependencies, not a global stop decision. The existing
// Profile and provider observation remain visible in the enclosing inspect.
function actionLimitations(loaded, operationId, providerObservation) {
  if (operationId === null) return [];
  const claims = relevantClaims(loaded, operationId);
  const conflicts = relevantConflicts(loaded, claims);
  const conflicted = new Set(conflicts.flatMap((conflict) => conflict.claimIds));
  const limitations = claims.filter((claim) => claim.ruleKey !== "engineering.mode" && (claim.enforcement === "unresolved" || conflicted.has(claim.claimId)))
    .map((claim) => ({ kind: "rule", ruleKey: claim.ruleKey, claimId: claim.claimId, sourceId: claim.sourceId,
      reason: claim.limitedReason ?? "applicable equal-precedence rule conflict" }));
  for (const binding of providerObservation?.bindings ?? []) {
    if (binding.requiredness !== "required" || !binding.operationIds?.includes(operationId) || binding.status === "not-applicable") continue;
    if (binding.status === "matched" && !(operationId === "package.publish" && binding.targetPermission === "unverified")) continue;
    limitations.push({ kind: "provider-binding", bindingId: binding.bindingId, reason: `required binding is ${binding.status}; target permission ${binding.targetPermission ?? "not-observed"}` });
  }
  return limitations;
}

export function resolveBranchPolicy({ loadedProfile, operationId = null, providerObservation = null }) {
  const result = interpretRule(loadedProfile, "git.branch.naming", operationId);
  const limitations = actionLimitations(loadedProfile, operationId, providerObservation);
  return { ...result, status: result.status === "invalid" ? "invalid" : limitations.length ? "unresolved" : result.status === "default" ? "resolved" : result.status,
    revision: result.status === "default" ? "portable-branch-defaults-v1" : result.revision,
    prefixes: result.status === "default" ? portableBranchPrefixes : result.value?.prefixes ?? null,
    mandatory: result.status !== "default", actionLimitations: limitations };
}

export function explainEngineeringMode({ loadedProfile, operationId = null, providerObservation = null, taskOverride = null, confirmedStrict = null }) {
  const result = interpretRule(loadedProfile, "engineering.mode", operationId);
  const limitations = actionLimitations(loadedProfile, operationId, providerObservation);
  const historical = confirmedStrict ? interpretRule(confirmedStrict, "engineering.mode", operationId) : null;
  const sameOwner = loadedProfile?.workspace === confirmedStrict?.workspace
    && loadedProfile?.profile?.workspaceIdentityId === confirmedStrict?.profile?.workspaceIdentityId;
  const retainedStrict = historical?.status === "resolved" && historical.value === "strict" && sameOwner
    ? { revision: historical.revision, claimIds: historical.claimIds, sourceIds: historical.sourceIds } : null;
  const confirmedStrictConflict = result.status === "unresolved" && result.claims.some((claim) => claim.valueConfirmed && claim.status === "confirmed" && claim.enforcement === "enforceable" && claim.normalizedValue === "strict");
  const preservedStrict = retainedStrict !== null || confirmedStrictConflict;
  const mode = result.status === "resolved" ? result.value : result.status === "default" ? "balanced" : null;
  const errors = [];
  if (taskOverride !== null && (!object(taskOverride) || !engineeringModes.includes(taskOverride.mode)
      || typeof taskOverride.source !== "string" || !taskOverride.source.trim()
      || typeof taskOverride.reason !== "string" || !taskOverride.reason.trim())) errors.push("task override requires mode, explicit user decision source and reason");
  const override = taskOverride !== null && !errors.length ? { ...taskOverride, provenance: "host-supplied-user-decision", authorizationClaim: false,
    higherPriorityAndMandatoryRequirements: "host-must-check-and-preserve" } : null;
  return { ...result, mode, taskOverride: override, taskMode: override?.mode ?? mode,
    temporaryPolicy: result.status === "unresolved" ? { mode: preservedStrict ? "strict" : "balanced", status: "conditional-host-policy",
      statement: preservedStrict ? "mode 未确认，保留适用的已确认 strict 要求" : "mode 未确认，仅在宿主确认没有已知更强要求时，本任务暂按 balanced 投入继续",
      requiresHostCheck: true, resolvesConfiguration: false, dependentActionsMayContinue: limitations.length === 0 } : null,
    retainedStrict, confirmedStrictConflict, actionLimitations: limitations,
    strictHistory: retainedStrict ? "supplied-confirmed-profile" : "not-observed; host must retain any traceable previously confirmed strict requirements",
    mandatoryRequirements: "unchanged; mode and task override never grant authorization or waive independent gates",
    errors };
}
