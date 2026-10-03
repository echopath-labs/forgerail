import { createHash } from "node:crypto";
import { isAbsolute, resolve } from "node:path";
import { realpathSync } from "node:fs";
import { resolveEffectiveProfileV2 } from "./composition.mjs";
import { validateContract } from "./contracts.mjs";
import { readProjectFileBytes } from "./project-state.mjs";

export const projectProfilePath = ".forgerail/project-profile.json";
export const projectProfileResolverVersion = "project-profile-resolver-v1";

const sourcePrecedence = {
  // A project-owned declaration cannot promote itself to platform authority.
  "platform-policy": "project-record",
  instructions: "workspace-instructions",
  ownership: "workspace-instructions",
  ci: "project-automation",
  script: "project-automation",
  specification: "project-record",
  "decision-record": "project-record",
  "structured-profile": "project-record",
  other: "documentation",
};

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
  return value;
}

export function semanticDeclaration(declaration) {
  return canonicalValue({
    ...declaration,
    workspaceRelationshipIds: [...declaration.workspaceRelationshipIds].sort(),
    sources: declaration.sources.map((source) => canonicalValue(source)).sort((left, right) => left.sourceId.localeCompare(right.sourceId)),
    claims: declaration.claims.map((claim) => canonicalValue({ ...claim, operationIds: [...claim.operationIds].sort() })).sort((left, right) => left.claimId.localeCompare(right.claimId)),
    resourceBindings: declaration.resourceBindings.map((binding) => canonicalValue({
      ...binding,
      operationIds: [...binding.operationIds].sort(),
      expectedIdentityClaimIds: [...binding.expectedIdentityClaimIds].sort(),
    })).sort((left, right) => left.bindingId.localeCompare(right.bindingId)),
  });
}

function semanticWorkspaceIdentity(identity) {
  return canonicalValue({
    schemaVersion: identity.schemaVersion,
    workspaceIdentityId: identity.workspaceIdentityId,
    canonicalRootLocator: identity.canonicalRootLocator,
    boundaryClaims: identity.boundaryClaims.map(({ observedAt: _observedAt, ...claim }) => canonicalValue(claim))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
  });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function revisionId(declaration, workspaceIdentity, confirmedSourceDigests) {
  const semanticInput = canonicalValue({
    declaration: semanticDeclaration(declaration),
    workspaceIdentity: semanticWorkspaceIdentity(workspaceIdentity),
    confirmedSourceDigests: Object.fromEntries(Object.entries(confirmedSourceDigests).sort(([left], [right]) => left.localeCompare(right))),
    resolverVersion: projectProfileResolverVersion,
  });
  return `profile-revision:${sha256(`${JSON.stringify(semanticInput)}\n`)}`;
}

function pointerResult(text, pointer) {
  if (pointer.kind === "markdown-heading") {
    const count = text.split(/\r?\n/).filter((line) => line === pointer.heading).length;
    return { valid: count === 1, observationPoint: pointer.heading, valueMatches: true };
  }
  let value;
  try { value = JSON.parse(text); }
  catch { return { valid: false, observationPoint: pointer.pointer, valueMatches: false }; }
  for (const token of pointer.pointer.slice(1).split("/").map((item) => item.replaceAll("~1", "/").replaceAll("~0", "~"))) {
    if (!value || typeof value !== "object" || !Object.hasOwn(value, token)) return { valid: false, observationPoint: pointer.pointer, valueMatches: false };
    value = value[token];
  }
  return { valid: true, observationPoint: pointer.pointer, value };
}

function equalValue(left, right) {
  return JSON.stringify(canonicalValue(left)) === JSON.stringify(canonicalValue(right));
}

function invalid(workspace, ...errors) {
  return { status: "invalid", workspace, declaration: null, workspaceIdentity: null, governanceSources: [], ruleClaims: [], profile: null, explanation: null, errors };
}

export function discoverProjectProfile(workspace) {
  let root;
  try { root = realpathSync(resolve(workspace)); }
  catch { return invalid(null, "owner workspace is unavailable"); }
  let bytes;
  try { bytes = readProjectFileBytes(root, projectProfilePath); }
  catch (error) { return invalid(root, `Project Profile entry is unsafe or unreadable: ${error.message}`); }
  if (bytes === null) return { status: "not-adopted", workspace: root, declaration: null, errors: [] };
  let declaration;
  try { declaration = JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes)); }
  catch { return invalid(root, "Project Profile entry is not valid JSON"); }
  const validation = validateContract("project-profile-declaration", declaration);
  if (!validation.valid) return invalid(root, ...validation.errors);
  return { status: "discovered", workspace: root, declaration, errors: [] };
}

export function verifyProjectWorkspaceIdentity(workspace, workspaceIdentity, { requireAbsoluteLocator = false } = {}) {
  const root = realpathSync(resolve(workspace));
  const validation = validateContract("workspace-identity", workspaceIdentity);
  if (!validation.valid) throw new Error(`invalid observed Workspace Identity: ${validation.errors.join("; ")}`);
  if (requireAbsoluteLocator && !isAbsolute(workspaceIdentity.canonicalRootLocator)) throw new Error("observed Workspace Identity requires an absolute canonical root locator");
  const locator = workspaceIdentity.canonicalRootLocator;
  const observedRoot = realpathSync(isAbsolute(locator) ? locator : resolve(root, locator));
  if (observedRoot !== root) throw new Error("observed Workspace Identity root does not match the exact owner workspace");
  return workspaceIdentity;
}

export function loadProjectProfile({ workspace, workspaceIdentity, computedAt = new Date().toISOString(), discoverySnapshot = null }) {
  const discovery = discoverySnapshot ?? discoverProjectProfile(workspace);
  if (discovery.status !== "discovered") return discovery;
  let requestedRoot;
  try { requestedRoot = realpathSync(resolve(workspace)); }
  catch { return invalid(null, "owner workspace is unavailable"); }
  if (discovery.workspace !== requestedRoot) return invalid(requestedRoot, "Project Profile discovery snapshot does not match the exact owner workspace");
  try { verifyProjectWorkspaceIdentity(discovery.workspace, workspaceIdentity); }
  catch (error) { return invalid(discovery.workspace, error.message); }
  if (workspaceIdentity.workspaceIdentityId !== discovery.declaration.workspaceIdentityId) return invalid(discovery.workspace, "Project Profile Workspace Identity does not match the observed owner");

  const confirmedSourceDigests = {};
  const sourceState = new Map();
  const claimsBySource = new Map(discovery.declaration.sources.map((source) => [source.sourceId, []]));
  for (const claim of discovery.declaration.claims) claimsBySource.get(claim.sourceId).push(claim);

  for (const source of discovery.declaration.sources) {
    let text = null;
    let bytes = null;
    let limitedReason = null;
    try {
      bytes = readProjectFileBytes(discovery.workspace, source.locator);
      if (bytes !== null) text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    }
    catch { limitedReason = `source ${source.sourceId} is not a bounded readable regular file`; }
    if (text === null && limitedReason === null) limitedReason = `source ${source.sourceId} is absent`;
    const actualDigest = bytes === null ? null : sha256(bytes);
    if (text !== null && source.expectedSha256 === null) limitedReason = `source ${source.sourceId} digest is not pinned`;
    else if (text !== null && source.expectedSha256 !== actualDigest) limitedReason = `source ${source.sourceId} digest differs from the reviewed declaration`;
    if (text !== null && source.expectedSha256 === actualDigest) confirmedSourceDigests[source.sourceId] = actualDigest;
    sourceState.set(source.sourceId, {
      source,
      text,
      observed: text !== null && source.expectedSha256 === actualDigest,
      limitedReason,
    });
  }

  const governanceSources = [];
  const ruleClaims = [];
  const sourceRequiredness = {};
  for (const source of discovery.declaration.sources.slice().sort((left, right) => left.sourceId.localeCompare(right.sourceId))) {
    const state = sourceState.get(source.sourceId);
    const declaredClaims = claimsBySource.get(source.sourceId).slice().sort((left, right) => left.claimId.localeCompare(right.claimId));
    const evaluatedClaims = declaredClaims.map((claim) => {
      const pointer = state.text === null ? { valid: false, observationPoint: claim.sourcePointer.kind === "markdown-heading" ? claim.sourcePointer.heading : claim.sourcePointer.pointer, valueMatches: false } : pointerResult(state.text, claim.sourcePointer);
      const structuredValueMatches = claim.sourcePointer.kind !== "json-pointer" || equalValue(pointer.value, claim.normalizedValue);
      const confirmed = state.observed && pointer.valid && structuredValueMatches;
      const limitedReason = confirmed
        ? null
        : !state.observed
          ? state.limitedReason
          : !pointer.valid
            ? `claim ${claim.claimId} source pointer is unavailable or ambiguous`
            : `claim ${claim.claimId} does not match its structured source value`;
      return { claim, pointer, confirmed, limitedReason };
    });
    const optionalClaimFailure = source.requiredness === "optional" ? evaluatedClaims.find((item) => !item.confirmed) : null;
    const sourceObserved = state.observed && optionalClaimFailure === null;
    sourceRequiredness[source.sourceId] = source.requiredness;
    const applicabilityScope = [...new Set(declaredClaims.flatMap((claim) => claim.operationIds))].sort();
    governanceSources.push({
      schemaVersion: "1.0",
      sourceId: source.sourceId,
      workspaceIdentityId: discovery.declaration.workspaceIdentityId,
      sourceKind: source.sourceKind,
      locator: source.locator,
      ownerId: discovery.declaration.profileId,
      precedenceClass: sourcePrecedence[source.sourceKind],
      applicabilityScope: applicabilityScope.length ? applicabilityScope : ["workspace"],
      workspaceRelationshipIds: [...discovery.declaration.workspaceRelationshipIds].sort(),
      observationStatus: sourceObserved ? "observed" : "unverified",
      ruleClaimIds: evaluatedClaims.filter((item) => item.confirmed || source.requiredness !== "optional").map((item) => item.claim.claimId),
      dependencyEdgeIds: [],
      observedAt: computedAt,
      limitedReason: sourceObserved ? null : optionalClaimFailure?.limitedReason ?? state.limitedReason,
    });
    for (const { claim, pointer, confirmed, limitedReason } of evaluatedClaims) {
      if (!confirmed && source.requiredness === "optional") continue;
      ruleClaims.push({
        schemaVersion: "1.0",
        claimId: claim.claimId,
        workspaceIdentityId: discovery.declaration.workspaceIdentityId,
        sourceId: claim.sourceId,
        ruleKey: claim.ruleKey,
        normalizedValue: claim.normalizedValue,
        precedenceClass: sourcePrecedence[source.sourceKind],
        applicabilityScope: [...claim.operationIds].sort(),
        observationPoint: `${source.locator}#${pointer.observationPoint}`,
        status: confirmed ? "confirmed" : "requires-confirmation",
        enforcement: confirmed ? "enforceable" : "unresolved",
        dependencyEdgeIds: [],
        observedAt: computedAt,
        limitedReason,
      });
    }
  }

  const profileRevisionId = revisionId(discovery.declaration, workspaceIdentity, confirmedSourceDigests);
  const resolved = resolveEffectiveProfileV2({
    profileId: discovery.declaration.profileId,
    profileRevisionId,
    workspaceIdentityId: discovery.declaration.workspaceIdentityId,
    workspaceRelationshipIds: discovery.declaration.workspaceRelationshipIds,
    governanceSources,
    ruleClaims,
    sourceRequiredness,
    computedAt,
  });
  return {
    status: resolved.valid ? "resolved" : "invalid",
    workspace: discovery.workspace,
    declaration: discovery.declaration,
    workspaceIdentity,
    governanceSources,
    ruleClaims,
    confirmedSourceDigests,
    profileRevisionId,
    profile: resolved.profile,
    explanation: resolved.explanation,
    errors: resolved.errors,
  };
}
