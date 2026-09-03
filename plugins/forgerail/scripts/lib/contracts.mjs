import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const contractSchemaNames = {
  "adoption-plan": "adoption-plan",
  "authority-evidence": "authority-evidence-v1",
  "binding-receipt": "host-binding-receipt",
  "cross-workspace-pack-composition": "cross-workspace-pack-composition-v1",
  "task-control-revision": "task-control-revision-v1",
  "task-envelope-v2": "task-envelope-v2",
  "entry-mode": "entry-mode-v1",
  envelope: "task-envelope",
  "effective-profile-v2": "effective-profile-v2",
  "evidence-identity": "evidence-identity-v1",
  "execution-context-identity": "execution-context-identity-v1",
  "gate-result": "gate-result-v1",
  "governance-source": "governance-source-v1",
  "host-adapter": "host-adapter",
  "host-adapter-observation": "host-adapter-observation-v1",
  launch: "launch-contract",
  "limited-reason": "limited-reason-v1",
  "operation-authority-requirement": "operation-authority-requirement-v1",
  "operation-grant": "operation-grant-v1",
  pack: "capability-pack",
  "phase-slice-correlation": "phase-slice-correlation-v1",
  profile: "effective-profile",
  "profile-candidate": "profile-change-candidate",
  "profile-explanation": "profile-explanation-v1",
  "provider-adapter-observation": "provider-adapter-observation-v1",
  receipt: "return-receipt",
  "review-authority-requirement": "review-authority-requirement-v1",
  "return-receipt-v2": "return-receipt-v2",
  "rollback-envelope-lineage": "rollback-envelope-lineage-v1",
  "rule-claim": "rule-claim-v1",
  "source-dependency-edge": "source-dependency-edge-v1",
  "validation-result": "validation-result-v1",
  "validation-topology": "validation-topology-v1",
  "workspace-identity": "workspace-identity-v1",
  "workspace-relationship": "workspace-relationship-v1"
};

export const contractTypes = Object.keys(contractSchemaNames);

const packStates = ["available", "recommended", "enabled", "required", "blocked", "disabled"];
const idPattern = /^[a-z][a-z0-9-]+$/;
const ruleIdPattern = /^[a-z][a-z0-9.-]+$/;
const taskIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9._:-]+$/;
const relativePathPattern = /^(?![\\/])(?![a-zA-Z]:)(?!.*(?:^|[\\/])\.\.(?:[\\/]|$))[^\\]+$/;
const commitPattern = /^[0-9a-f]{40}$/;
const digestPattern = /^[0-9a-f]{64}$/;
const authorityClasses = ["agent_review", "automated_validation", "peer_review", "ownership_approval", "security_approval", "release_approval", "environment_approval"];
const trustClasses = ["self-reported", "local-observed", "provider-attested", "trusted-runner", "protected-environment"];
const adapterSupportStates = ["supported", "profile-only", "degraded", "blocked", "unavailable", "unknown"];
const limitedReasonCodes = [
  "missing-required-evidence", "unavailable-provider", "unauthenticated-provider", "unverified-adapter",
  "stale-evidence", "revoked-evidence", "dismissed-evidence", "expired-evidence", "superseded-evidence",
  "wrong-subject", "wrong-trust", "unclassified-surface", "missing-result", "unexpected-result",
  "dangling-dependency", "blocked-prerequisite", "boundary-crossing-dependency", "redacted-sensitive-detail",
  "unsupported-capability", "other"
];

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, required, optional, label, errors) {
  if (!object(value)) {
    errors.push(`${label} must be an object`);
    return false;
  }
  for (const key of required) if (!Object.hasOwn(value, key)) errors.push(`${label}.${key} is required`);
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) if (!allowed.has(key)) errors.push(`${label}.${key} is unsupported`);
  return true;
}

function string(value, label, errors, pattern) {
  if (typeof value !== "string" || value.length === 0) errors.push(`${label} must be a non-empty string`);
  else if (pattern && !pattern.test(value)) errors.push(`${label} has an invalid format`);
}

function nullableString(value, label, errors, pattern) {
  if (value === null) return;
  string(value, label, errors, pattern);
}

function dateTime(value, label, errors) {
  string(value, label, errors);
  if (typeof value !== "string") return;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!match) {
    errors.push(`${label} must be an ISO 8601 date-time with timezone`);
    return;
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, zone, zoneHourText = "0", zoneMinuteText = "0"] = match;
  const [year, month, day, hour, minute, second, zoneHour, zoneMinute] = [yearText, monthText, dayText, hourText, minuteText, secondText, zoneHourText, zoneMinuteText].map(Number);
  const calendar = new Date(0);
  calendar.setUTCHours(0, 0, 0, 0);
  calendar.setUTCFullYear(year, month - 1, day);
  const calendarValid = calendar.getUTCFullYear() === year && calendar.getUTCMonth() === month - 1 && calendar.getUTCDate() === day;
  const clockValid = hour <= 23 && minute <= 59 && second <= 59;
  const zoneValid = zone === "Z" || (zoneHour <= 23 && zoneMinute <= 59);
  if (!calendarValid || !clockValid || !zoneValid || Number.isNaN(Date.parse(value))) errors.push(`${label} must be an ISO 8601 date-time with timezone`);
}

function strings(value, label, errors, { min = 0, pattern, unique = false } = {}) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array`);
    return;
  }
  if (value.length < min) errors.push(`${label} must contain at least ${min} item(s)`);
  value.forEach((item, index) => string(item, `${label}[${index}]`, errors, pattern));
  if (unique && new Set(value).size !== value.length) errors.push(`${label} must not contain duplicates`);
}

function schemaVersion(value, label, errors) {
  if (value !== "1.0") errors.push(`${label}.schemaVersion must equal 1.0`);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function contractVersion(value, expected, label, errors) {
  if (value !== expected) errors.push(`${label}.schemaVersion must equal ${expected}`);
}

function validateTarget(value, label, errors) {
  if (!exactKeys(value, ["kind", "locator", "identity", "ref", "environment"], [], label, errors)) return;
  if (!["file", "directory", "repository", "ref", "artifact", "environment", "profile-source", "other"].includes(value.kind)) errors.push(`${label}.kind is invalid`);
  string(value.locator, `${label}.locator`, errors);
  nullableString(value.identity, `${label}.identity`, errors);
  nullableString(value.ref, `${label}.ref`, errors);
  nullableString(value.environment, `${label}.environment`, errors);
}

function validateSubject(value, label, errors) {
  if (!exactKeys(value, ["subjectId", "kind", "digest", "locator"], [], label, errors)) return;
  string(value.subjectId, `${label}.subjectId`, errors, taskIdPattern);
  if (!["commit", "tree", "diff", "artifact", "candidate", "workspace-state", "other"].includes(value.kind)) errors.push(`${label}.kind is invalid`);
  string(value.digest, `${label}.digest`, errors, digestPattern);
  nullableString(value.locator, `${label}.locator`, errors);
}

function validateEnvelopeReference(value, label, errors) {
  if (!exactKeys(value, ["envelopeId", "revisionId", "subjectId"], [], label, errors)) return;
  string(value.envelopeId, `${label}.envelopeId`, errors, taskIdPattern);
  string(value.revisionId, `${label}.revisionId`, errors, taskIdPattern);
  string(value.subjectId, `${label}.subjectId`, errors, taskIdPattern);
}

function validateLimitedReason(value, errors, label = "limitedReason") {
  const keys = ["schemaVersion", "reasonId", "code", "impact", "summary", "evidenceIdentityIds", "locators", "observedAt", "sanitized"];
  if (!exactKeys(value, keys, [], label, errors)) return;
  contractVersion(value.schemaVersion, "1.0", label, errors);
  string(value.reasonId, `${label}.reasonId`, errors, taskIdPattern);
  if (!limitedReasonCodes.includes(value.code)) errors.push(`${label}.code is invalid`);
  if (!["degraded", "blocked", "unavailable", "unresolved", "unverified"].includes(value.impact)) errors.push(`${label}.impact is invalid`);
  string(value.summary, `${label}.summary`, errors);
  if (typeof value.summary === "string" && value.summary.length > 500) errors.push(`${label}.summary must not exceed 500 characters`);
  strings(value.evidenceIdentityIds, `${label}.evidenceIdentityIds`, errors, { pattern: taskIdPattern, unique: true });
  strings(value.locators, `${label}.locators`, errors, { unique: true });
  dateTime(value.observedAt, `${label}.observedAt`, errors);
  if (value.sanitized !== true) errors.push(`${label}.sanitized must equal true`);
}

function validateNullableLimitedReason(value, errors, label) {
  if (value === null) return;
  validateLimitedReason(value, errors, label);
}

function validatePack(value, errors) {
  const keys = ["schemaVersion", "id", "purpose", "entry", "risk", "states", "triggers", "inputs", "dependencies", "conflicts", "approvals", "validation", "receiptExtensions"];
  if (!exactKeys(value, keys, [], "pack", errors)) return;
  schemaVersion(value.schemaVersion, "pack", errors);
  string(value.id, "pack.id", errors, idPattern);
  string(value.purpose, "pack.purpose", errors);
  if (typeof value.purpose === "string" && value.purpose.length < 12) errors.push("pack.purpose is too short");
  string(value.entry, "pack.entry", errors, /^skills\/[a-z][a-z0-9-]+\/SKILL\.md$/);
  if (!["low", "medium", "high"].includes(value.risk)) errors.push("pack.risk is invalid");
  if (JSON.stringify(value.states) !== JSON.stringify(packStates)) errors.push("pack.states must use the canonical ordered state set");
  strings(value.triggers, "pack.triggers", errors, { unique: true });
  strings(value.inputs, "pack.inputs", errors, { unique: true });
  strings(value.dependencies, "pack.dependencies", errors, { pattern: idPattern, unique: true });
  strings(value.conflicts, "pack.conflicts", errors, { pattern: idPattern, unique: true });
  strings(value.approvals, "pack.approvals", errors, { pattern: idPattern, unique: true });
  strings(value.validation, "pack.validation", errors, { unique: true });
  strings(value.receiptExtensions, "pack.receiptExtensions", errors, { pattern: /^[a-z][A-Za-z0-9]*$/, unique: true });
}

function validateProfile(value, errors) {
  if (!exactKeys(value, ["schemaVersion", "workspace", "computed", "rules", "packs", "conflicts"], [], "profile", errors)) return;
  schemaVersion(value.schemaVersion, "profile", errors);
  string(value.workspace, "profile.workspace", errors);
  if (value.computed !== true) errors.push("profile.computed must equal true");
  if (!Array.isArray(value.rules)) errors.push("profile.rules must be an array");
  else value.rules.forEach((rule, index) => {
    const label = `profile.rules[${index}]`;
    if (!exactKeys(rule, ["id", "value", "source", "precedence", "status"], [], label, errors)) return;
    string(rule.id, `${label}.id`, errors, ruleIdPattern);
    string(rule.source, `${label}.source`, errors);
    if (!Number.isInteger(rule.precedence) || rule.precedence < 1 || rule.precedence > 6) errors.push(`${label}.precedence must be 1-6`);
    if (!["observed", "inferred", "confirmed", "default"].includes(rule.status)) errors.push(`${label}.status is invalid`);
  });
  if (!Array.isArray(value.packs)) errors.push("profile.packs must be an array");
  else value.packs.forEach((pack, index) => {
    const label = `profile.packs[${index}]`;
    if (!exactKeys(pack, ["id", "state", "reason"], [], label, errors)) return;
    string(pack.id, `${label}.id`, errors, idPattern);
    if (!packStates.includes(pack.state)) errors.push(`${label}.state is invalid`);
    string(pack.reason, `${label}.reason`, errors);
  });
  strings(value.conflicts, "profile.conflicts", errors);
  const ids = value.rules?.map((rule) => rule.id) ?? [];
  if (new Set(ids).size !== ids.length) errors.push("profile.rules contains duplicate ids");
  const packIds = value.packs?.map((pack) => pack.id) ?? [];
  if (new Set(packIds).size !== packIds.length) errors.push("profile.packs contains duplicate ids");
  const enabled = new Set((value.packs ?? []).filter((item) => ["enabled", "required"].includes(item.state)).map((item) => item.id));
  for (const pack of value.packs ?? []) {
    if (!["enabled", "required"].includes(pack.state)) continue;
    if (pack.id === "agent-workflow-governance" && enabled.has("forgerail-core")) errors.push("profile has duplicate core workflow owners");
  }
}

function validateEnvelope(value, errors, label = "envelope", packsMode = "ids") {
  const keys = ["schemaVersion", "taskId", "intent", "nonGoals", "ownerWorkspace", "allowedOperations", "prohibitedOperations", "packs", "approvalGates", "validation", "returnContract"];
  if (!exactKeys(value, keys, [], label, errors)) return;
  schemaVersion(value.schemaVersion, label, errors);
  string(value.taskId, `${label}.taskId`, errors, taskIdPattern);
  string(value.intent, `${label}.intent`, errors);
  strings(value.nonGoals, `${label}.nonGoals`, errors);
  string(value.ownerWorkspace, `${label}.ownerWorkspace`, errors);
  strings(value.allowedOperations, `${label}.allowedOperations`, errors, { unique: true });
  strings(value.prohibitedOperations, `${label}.prohibitedOperations`, errors, { unique: true });
  if (packsMode === "manifest-map") {
    if (!object(value.packs)) errors.push(`${label}.packs must be an object keyed by requested Pack identity`);
    else for (const [id, manifestDigest] of Object.entries(value.packs)) {
      string(id, `${label}.packs Pack identity`, errors, idPattern);
      string(manifestDigest, `${label}.packs.${id}`, errors, digestPattern);
    }
  } else {
    strings(value.packs, `${label}.packs`, errors, { pattern: idPattern, unique: true });
  }
  strings(value.approvalGates, `${label}.approvalGates`, errors, { pattern: idPattern, unique: true });
  strings(value.validation, `${label}.validation`, errors);
  if (value.returnContract !== "forgerail-return-receipt-v1") errors.push(`${label}.returnContract is invalid`);
  const overlap = (value.allowedOperations ?? []).filter((item) => (value.prohibitedOperations ?? []).includes(item));
  if (overlap.length > 0) errors.push(`${label} allows and prohibits the same operations: ${overlap.join(", ")}`);
}

function validateProfileCandidate(value, errors) {
  const keys = ["schemaVersion", "candidateId", "workspace", "ruleId", "proposedValue", "evidence", "targetOwner", "targetSource", "reason", "requiresConfirmation", "status"];
  if (!exactKeys(value, keys, [], "profileCandidate", errors)) return;
  schemaVersion(value.schemaVersion, "profileCandidate", errors);
  string(value.candidateId, "profileCandidate.candidateId", errors, taskIdPattern);
  string(value.workspace, "profileCandidate.workspace", errors);
  string(value.ruleId, "profileCandidate.ruleId", errors, ruleIdPattern);
  strings(value.evidence, "profileCandidate.evidence", errors, { min: 1, unique: true });
  string(value.targetOwner, "profileCandidate.targetOwner", errors);
  string(value.targetSource, "profileCandidate.targetSource", errors);
  string(value.reason, "profileCandidate.reason", errors);
  if (value.requiresConfirmation !== true) errors.push("profileCandidate.requiresConfirmation must equal true");
  if (value.status !== "candidate") errors.push("profileCandidate.status must equal candidate");
}

function validateLaunch(value, errors) {
  if (!exactKeys(value, ["schemaVersion", "envelope", "effectiveProfile", "effectivePackManifests", "effectiveRuleSources", "hostAgent", "executionOwner"], [], "launch", errors)) return;
  schemaVersion(value.schemaVersion, "launch", errors);
  validateEnvelope(value.envelope, errors, "launch.envelope", "manifest-map");
  if (exactKeys(value.effectiveProfile, ["digest"], [], "launch.effectiveProfile", errors)) {
    string(value.effectiveProfile.digest, "launch.effectiveProfile.digest", errors, digestPattern);
  }
  if (!object(value.effectivePackManifests)) errors.push("launch.effectivePackManifests must be an object keyed by Pack identity");
  else for (const [id, manifestDigest] of Object.entries(value.effectivePackManifests)) {
    string(id, "launch.effectivePackManifests Pack identity", errors, idPattern);
    string(manifestDigest, `launch.effectivePackManifests.${id}`, errors, digestPattern);
  }
  if (object(value.effectivePackManifests) && object(value.envelope?.packs)) {
    for (const [id, manifestDigest] of Object.entries(value.envelope.packs)) {
      if (value.effectivePackManifests[id] !== manifestDigest) {
        errors.push(`launch.effectivePackManifests does not match requested Pack identity: ${id}`);
      }
    }
  }
  strings(value.effectiveRuleSources, "launch.effectiveRuleSources", errors, { min: 1, unique: true });
  string(value.hostAgent, "launch.hostAgent", errors);
  if (value.executionOwner !== "host-agent") errors.push("launch.executionOwner must equal host-agent");
}

function validateReceipt(value, errors) {
  const keys = ["schemaVersion", "taskId", "ownerWorkspace", "branch", "commit", "changedScope", "validationEvidence", "externalSideEffects", "confirmedNonMutations", "residualRisks", "rollbackOrRecovery", "deviations", "closeout"];
  if (!exactKeys(value, keys, [], "receipt", errors)) return;
  schemaVersion(value.schemaVersion, "receipt", errors);
  string(value.taskId, "receipt.taskId", errors, taskIdPattern);
  string(value.ownerWorkspace, "receipt.ownerWorkspace", errors);
  nullableString(value.branch, "receipt.branch", errors);
  nullableString(value.commit, "receipt.commit", errors, commitPattern);
  strings(value.changedScope, "receipt.changedScope", errors);
  strings(value.validationEvidence, "receipt.validationEvidence", errors, { min: 1 });
  strings(value.externalSideEffects, "receipt.externalSideEffects", errors);
  strings(value.confirmedNonMutations, "receipt.confirmedNonMutations", errors);
  strings(value.residualRisks, "receipt.residualRisks", errors);
  string(value.rollbackOrRecovery, "receipt.rollbackOrRecovery", errors);
  strings(value.deviations, "receipt.deviations", errors);
  if (!["complete", "incomplete", "blocked"].includes(value.closeout)) errors.push("receipt.closeout is invalid");
  if (value.closeout === "complete" && value.deviations?.length > 0) errors.push("receipt with deviations cannot be complete");
}

function validateHostAdapter(value, errors) {
  const keys = ["schemaVersion", "id", "displayName", "status", "instructionDiscovery", "skillDiscovery", "bindingTarget", "bindingModes", "managedMarker", "activationBoundary", "verification", "limitations"];
  if (!exactKeys(value, keys, [], "hostAdapter", errors)) return;
  schemaVersion(value.schemaVersion, "hostAdapter", errors);
  string(value.id, "hostAdapter.id", errors, idPattern);
  string(value.displayName, "hostAdapter.displayName", errors);
  if (!["supported", "profile-only"].includes(value.status)) errors.push("hostAdapter.status is invalid");
  if (!["task-start", "rules", "explicit-only", "unknown"].includes(value.instructionDiscovery)) errors.push("hostAdapter.instructionDiscovery is invalid");
  if (!["agent-plugin-skills", "agent-skills", "explicit-only", "unknown"].includes(value.skillDiscovery)) errors.push("hostAdapter.skillDiscovery is invalid");
  string(value.bindingTarget, "hostAdapter.bindingTarget", errors, relativePathPattern);
  strings(value.bindingModes, "hostAdapter.bindingModes", errors, { min: 1, unique: true });
  for (const mode of value.bindingModes ?? []) if (!["managed-block", "thin-reference"].includes(mode)) errors.push(`hostAdapter.bindingModes contains invalid mode: ${mode}`);
  string(value.managedMarker, "hostAdapter.managedMarker", errors, /^forgerail:binding:[a-z][a-z0-9-]+:v1$/);
  if (value.managedMarker !== `forgerail:binding:${value.id}:v1`) errors.push("hostAdapter.managedMarker must match hostAdapter.id");
  if (!["new-task-required", "host-specific-verification-required"].includes(value.activationBoundary)) errors.push("hostAdapter.activationBoundary is invalid");
  if (exactKeys(value.verification, ["mode", "expectedSkills"], [], "hostAdapter.verification", errors)) {
    if (!["new-task-discovery", "profile-only"].includes(value.verification.mode)) errors.push("hostAdapter.verification.mode is invalid");
    strings(value.verification.expectedSkills, "hostAdapter.verification.expectedSkills", errors, { pattern: idPattern, unique: true });
  }
  strings(value.limitations, "hostAdapter.limitations", errors, { unique: true });
  if (value.status === "supported") {
    if (value.verification?.mode !== "new-task-discovery") errors.push("supported hostAdapter must use new-task-discovery verification");
    if ((value.verification?.expectedSkills?.length ?? 0) === 0) errors.push("supported hostAdapter must declare expected Skills");
    if (value.activationBoundary !== "new-task-required") errors.push("supported hostAdapter must require a new task");
  }
  if (value.status === "profile-only") {
    if (value.verification?.mode !== "profile-only") errors.push("profile-only hostAdapter must use profile-only verification");
    if ((value.verification?.expectedSkills?.length ?? 0) !== 0) errors.push("profile-only hostAdapter cannot claim discovered Skills");
    if (value.activationBoundary !== "host-specific-verification-required") errors.push("profile-only hostAdapter must require host-specific verification");
  }
}

function validateAdoptionPlan(value, errors) {
  const keys = ["schemaVersion", "planId", "workspace", "currentLevel", "proposedLevel", "strategy", "evidence", "hosts", "proposedWrites", "requiredConfirmation", "verification", "confirmedNonMutations", "mutations", "status"];
  if (!exactKeys(value, keys, [], "adoptionPlan", errors)) return;
  schemaVersion(value.schemaVersion, "adoptionPlan", errors);
  string(value.planId, "adoptionPlan.planId", errors, taskIdPattern);
  string(value.workspace, "adoptionPlan.workspace", errors);
  const levels = ["plugin-only", "lightweight-adoption", "persisted-governance"];
  if (!levels.includes(value.currentLevel)) errors.push("adoptionPlan.currentLevel is invalid");
  if (!levels.includes(value.proposedLevel)) errors.push("adoptionPlan.proposedLevel is invalid");
  if (!["no-change", "single-host-managed-block", "shared-contract-with-thin-bindings"].includes(value.strategy)) errors.push("adoptionPlan.strategy is invalid");
  strings(value.evidence, "adoptionPlan.evidence", errors, { min: 1, unique: true });
  if (!Array.isArray(value.hosts) || value.hosts.length === 0) errors.push("adoptionPlan.hosts must contain at least one host");
  else value.hosts.forEach((host, index) => {
    const label = `adoptionPlan.hosts[${index}]`;
    if (!exactKeys(host, ["adapterId", "status", "bindingTarget", "verificationMode"], [], label, errors)) return;
    string(host.adapterId, `${label}.adapterId`, errors, idPattern);
    if (!["supported", "profile-only"].includes(host.status)) errors.push(`${label}.status is invalid`);
    string(host.bindingTarget, `${label}.bindingTarget`, errors, relativePathPattern);
    if (!["new-task-discovery", "profile-only"].includes(host.verificationMode)) errors.push(`${label}.verificationMode is invalid`);
    if (host.status === "supported" && host.verificationMode !== "new-task-discovery") errors.push(`${label} supported host must use new-task-discovery`);
    if (host.status === "profile-only" && host.verificationMode !== "profile-only") errors.push(`${label} profile-only host must not claim verified discovery`);
  });
  const hostIds = value.hosts?.map((host) => host.adapterId) ?? [];
  if (new Set(hostIds).size !== hostIds.length) errors.push("adoptionPlan.hosts contains duplicate adapter ids");
  if (!Array.isArray(value.proposedWrites)) errors.push("adoptionPlan.proposedWrites must be an array");
  else value.proposedWrites.forEach((write, index) => {
    const label = `adoptionPlan.proposedWrites[${index}]`;
    if (!exactKeys(write, ["workspaceSha256", "path", "operation", "baseSha256", "contentSha256", "content", "managedMarker", "approvalSha256"], [], label, errors)) return;
    string(write.workspaceSha256, `${label}.workspaceSha256`, errors, digestPattern);
    string(write.path, `${label}.path`, errors, relativePathPattern);
    if (!["create", "append-managed-block", "replace-managed-block"].includes(write.operation)) errors.push(`${label}.operation is invalid`);
    nullableString(write.baseSha256, `${label}.baseSha256`, errors, digestPattern);
    string(write.contentSha256, `${label}.contentSha256`, errors, digestPattern);
    string(write.content, `${label}.content`, errors);
    string(write.managedMarker, `${label}.managedMarker`, errors, /^forgerail:(?:binding:[a-z][a-z0-9-]+|adoption-contract):v1$/);
    string(write.approvalSha256, `${label}.approvalSha256`, errors, digestPattern);
    if (typeof write.content === "string" && write.contentSha256 !== sha256(write.content)) errors.push(`${label}.contentSha256 does not match content`);
    if (typeof write.content === "string") {
      const approvalBound = {
        workspaceSha256: write.workspaceSha256,
        path: write.path,
        operation: write.operation,
        baseSha256: write.baseSha256,
        contentSha256: write.contentSha256,
        content: write.content,
        managedMarker: write.managedMarker,
      };
      if (write.approvalSha256 !== sha256(JSON.stringify(approvalBound))) errors.push(`${label}.approvalSha256 does not match the proposed write`);
    }
    if (typeof write.content === "string" && (!write.content.includes(`<!-- ${write.managedMarker}:start -->`) || !write.content.includes(`<!-- ${write.managedMarker}:end -->`))) errors.push(`${label}.content must contain its complete managed marker`);
    if (write.operation === "create" && write.baseSha256 !== null) errors.push(`${label}.baseSha256 must be null for create`);
    if (write.operation !== "create" && !digestPattern.test(write.baseSha256 ?? "")) errors.push(`${label}.baseSha256 is required for managed-block updates`);
    if (write.path === ".forgerail" || write.path.startsWith(".forgerail/")) errors.push(`${label} cannot target deferred .forgerail state`);
  });
  const writePaths = value.proposedWrites?.map((write) => write.path) ?? [];
  if (new Set(writePaths).size !== writePaths.length) errors.push("adoptionPlan.proposedWrites contains duplicate paths");
  if (value.requiredConfirmation !== true) errors.push("adoptionPlan.requiredConfirmation must equal true");
  strings(value.verification, "adoptionPlan.verification", errors, { min: 1, unique: true });
  strings(value.confirmedNonMutations, "adoptionPlan.confirmedNonMutations", errors, { min: 1, unique: true });
  if (!Array.isArray(value.mutations) || value.mutations.length !== 0) errors.push("adoptionPlan.mutations must be empty");
  if (value.status !== "candidate") errors.push("adoptionPlan.status must equal candidate");
  if (value.strategy === "no-change" && (value.proposedWrites?.length ?? 0) !== 0) errors.push("no-change adoptionPlan cannot propose writes");
  if (value.strategy === "single-host-managed-block") {
    if (value.hosts?.length !== 1) errors.push("single-host-managed-block requires exactly one host");
    if (value.proposedWrites?.length !== 1) errors.push("single-host-managed-block requires exactly one proposed write");
    if (value.proposedWrites?.[0]?.path !== value.hosts?.[0]?.bindingTarget) errors.push("single-host managed write must target its Host Adapter entry");
    if (value.proposedWrites?.[0]?.managedMarker !== `forgerail:binding:${value.hosts?.[0]?.adapterId}:v1`) errors.push("single-host managed write marker must match its Host Adapter");
  }
  if (value.strategy === "shared-contract-with-thin-bindings") {
    if ((value.hosts?.length ?? 0) < 2) errors.push("shared-contract-with-thin-bindings requires at least two hosts");
    if (value.proposedWrites?.length !== (value.hosts?.length ?? 0) + 1) errors.push("shared-contract-with-thin-bindings requires one contract and one write per host");
    const contract = value.proposedWrites?.find((write) => write.path === "FORGERAIL.md");
    if (!contract) errors.push("shared-contract-with-thin-bindings must propose FORGERAIL.md");
    else if (contract.managedMarker !== "forgerail:adoption-contract:v1") errors.push("FORGERAIL.md must use the portable Adoption Contract marker");
    for (const host of value.hosts ?? []) {
      const binding = value.proposedWrites?.find((write) => write.path === host.bindingTarget);
      if (!binding) errors.push(`shared-contract plan is missing host binding: ${host.adapterId}`);
      else if (binding.managedMarker !== `forgerail:binding:${host.adapterId}:v1`) errors.push(`shared-contract binding marker is invalid: ${host.adapterId}`);
    }
  }
  if (value.proposedLevel === "persisted-governance") errors.push("persisted-governance plan generation is deferred in ForgeRail alpha.1");
}

function validateBindingReceipt(value, errors) {
  const keys = ["schemaVersion", "planId", "workspace", "adoptionLevel", "contractPath", "hosts", "changedFiles", "validationEvidence", "discoveredSkills", "activationVerification", "confirmedNonMutations", "deviations", "closeout"];
  if (!exactKeys(value, keys, [], "bindingReceipt", errors)) return;
  schemaVersion(value.schemaVersion, "bindingReceipt", errors);
  string(value.planId, "bindingReceipt.planId", errors, taskIdPattern);
  string(value.workspace, "bindingReceipt.workspace", errors);
  if (!["plugin-only", "lightweight-adoption", "persisted-governance"].includes(value.adoptionLevel)) errors.push("bindingReceipt.adoptionLevel is invalid");
  nullableString(value.contractPath, "bindingReceipt.contractPath", errors);
  if (!Array.isArray(value.hosts) || value.hosts.length === 0) errors.push("bindingReceipt.hosts must contain at least one host");
  else value.hosts.forEach((host, index) => {
    const label = `bindingReceipt.hosts[${index}]`;
    if (!exactKeys(host, ["adapterId", "target", "baseSha256", "appliedSha256", "status", "verification"], [], label, errors)) return;
    string(host.adapterId, `${label}.adapterId`, errors, idPattern);
    string(host.target, `${label}.target`, errors);
    nullableString(host.baseSha256, `${label}.baseSha256`, errors, digestPattern);
    string(host.appliedSha256, `${label}.appliedSha256`, errors, digestPattern);
    if (!["verified", "unverified", "failed"].includes(host.status)) errors.push(`${label}.status is invalid`);
    strings(host.verification, `${label}.verification`, errors, { min: 1, unique: true });
  });
  strings(value.changedFiles, "bindingReceipt.changedFiles", errors, { unique: true });
  strings(value.validationEvidence, "bindingReceipt.validationEvidence", errors, { min: 1, unique: true });
  strings(value.discoveredSkills, "bindingReceipt.discoveredSkills", errors, { pattern: idPattern, unique: true });
  if (exactKeys(value.activationVerification, ["mode", "verified"], [], "bindingReceipt.activationVerification", errors)) {
    if (!["new-task", "equivalent-supported-discovery", "host-specific"].includes(value.activationVerification.mode)) errors.push("bindingReceipt.activationVerification.mode is invalid");
    if (typeof value.activationVerification.verified !== "boolean") errors.push("bindingReceipt.activationVerification.verified must be a boolean");
  }
  strings(value.confirmedNonMutations, "bindingReceipt.confirmedNonMutations", errors, { min: 1, unique: true });
  strings(value.deviations, "bindingReceipt.deviations", errors, { unique: true });
  if (!["complete", "incomplete", "blocked"].includes(value.closeout)) errors.push("bindingReceipt.closeout is invalid");
  if (value.closeout === "complete") {
    if (value.activationVerification?.verified !== true) errors.push("complete bindingReceipt requires verified activation discovery");
    if ((value.hosts ?? []).some((host) => host.status !== "verified")) errors.push("complete bindingReceipt requires every host binding to be verified");
    if ((value.deviations?.length ?? 0) > 0) errors.push("bindingReceipt with deviations cannot be complete");
    for (const host of value.hosts ?? []) if (!value.changedFiles?.includes(host.target)) errors.push(`complete bindingReceipt.changedFiles is missing host target: ${host.target}`);
    if (value.contractPath !== null && !value.changedFiles?.includes(value.contractPath)) errors.push("complete bindingReceipt.changedFiles is missing contractPath");
  }
}

function validateWorkspaceIdentity(value, errors) {
  const keys = ["schemaVersion", "workspaceIdentityId", "canonicalRootLocator", "boundaryClaims", "observedAt"];
  if (!exactKeys(value, keys, [], "workspaceIdentity", errors)) return;
  schemaVersion(value.schemaVersion, "workspaceIdentity", errors);
  string(value.workspaceIdentityId, "workspaceIdentity.workspaceIdentityId", errors, taskIdPattern);
  string(value.canonicalRootLocator, "workspaceIdentity.canonicalRootLocator", errors);
  if (!Array.isArray(value.boundaryClaims)) errors.push("workspaceIdentity.boundaryClaims must be an array");
  else value.boundaryClaims.forEach((claim, index) => {
    const label = `workspaceIdentity.boundaryClaims[${index}]`;
    if (!exactKeys(claim, ["providerId", "kind", "identity", "observedAt"], [], label, errors)) return;
    string(claim.providerId, `${label}.providerId`, errors, idPattern);
    if (!["repository", "vcs-root", "worktree", "explicit-workspace", "provider-project"].includes(claim.kind)) errors.push(`${label}.kind is invalid`);
    string(claim.identity, `${label}.identity`, errors);
    dateTime(claim.observedAt, `${label}.observedAt`, errors);
  });
  const boundaryKeys = value.boundaryClaims?.map((claim) => `${claim.providerId}:${claim.kind}:${claim.identity}`) ?? [];
  if (new Set(boundaryKeys).size !== boundaryKeys.length) errors.push("workspaceIdentity.boundaryClaims contains duplicate identities");
  dateTime(value.observedAt, "workspaceIdentity.observedAt", errors);
}

function validateWorkspaceRelationship(value, errors) {
  const keys = ["schemaVersion", "relationshipId", "sourceWorkspaceIdentityId", "targetWorkspaceIdentityId", "relationshipType", "governanceApplicability", "applicabilityScope", "declaredBySourceId", "provenanceStatus", "authorityTransfer", "observedAt"];
  if (!exactKeys(value, keys, [], "workspaceRelationship", errors)) return;
  schemaVersion(value.schemaVersion, "workspaceRelationship", errors);
  string(value.relationshipId, "workspaceRelationship.relationshipId", errors, taskIdPattern);
  string(value.sourceWorkspaceIdentityId, "workspaceRelationship.sourceWorkspaceIdentityId", errors, taskIdPattern);
  string(value.targetWorkspaceIdentityId, "workspaceRelationship.targetWorkspaceIdentityId", errors, taskIdPattern);
  if (value.sourceWorkspaceIdentityId === value.targetWorkspaceIdentityId) errors.push("workspaceRelationship must relate distinct Workspace Identities");
  if (!["governance-scope", "coordination", "dependency", "ownership-reference"].includes(value.relationshipType)) errors.push("workspaceRelationship.relationshipType is invalid");
  if (!["none", "scoped"].includes(value.governanceApplicability)) errors.push("workspaceRelationship.governanceApplicability is invalid");
  strings(value.applicabilityScope, "workspaceRelationship.applicabilityScope", errors, { unique: true });
  string(value.declaredBySourceId, "workspaceRelationship.declaredBySourceId", errors, taskIdPattern);
  if (!["provider-declared", "confirmed", "inferred", "requires-confirmation"].includes(value.provenanceStatus)) errors.push("workspaceRelationship.provenanceStatus is invalid");
  if (value.authorityTransfer !== false) errors.push("workspaceRelationship.authorityTransfer must equal false");
  if (["inferred", "requires-confirmation"].includes(value.provenanceStatus) && value.governanceApplicability !== "none") errors.push("inferred workspaceRelationship cannot apply governance");
  if (value.governanceApplicability === "scoped" && (value.applicabilityScope?.length ?? 0) === 0) errors.push("scoped workspaceRelationship requires applicabilityScope");
  dateTime(value.observedAt, "workspaceRelationship.observedAt", errors);
}

function validateGovernanceSource(value, errors) {
  const keys = ["schemaVersion", "sourceId", "workspaceIdentityId", "sourceKind", "locator", "ownerId", "precedenceClass", "applicabilityScope", "workspaceRelationshipIds", "observationStatus", "ruleClaimIds", "dependencyEdgeIds", "observedAt", "limitedReason"];
  if (!exactKeys(value, keys, [], "governanceSource", errors)) return;
  schemaVersion(value.schemaVersion, "governanceSource", errors);
  string(value.sourceId, "governanceSource.sourceId", errors, taskIdPattern);
  string(value.workspaceIdentityId, "governanceSource.workspaceIdentityId", errors, taskIdPattern);
  if (!["instructions", "ownership", "platform-policy", "ci", "script", "specification", "decision-record", "structured-profile", "other"].includes(value.sourceKind)) errors.push("governanceSource.sourceKind is invalid");
  string(value.locator, "governanceSource.locator", errors);
  nullableString(value.ownerId, "governanceSource.ownerId", errors);
  string(value.precedenceClass, "governanceSource.precedenceClass", errors);
  strings(value.applicabilityScope, "governanceSource.applicabilityScope", errors, { min: 1, unique: true });
  strings(value.workspaceRelationshipIds, "governanceSource.workspaceRelationshipIds", errors, { pattern: taskIdPattern, unique: true });
  if (!["observed", "unavailable", "ambiguous", "unverified"].includes(value.observationStatus)) errors.push("governanceSource.observationStatus is invalid");
  strings(value.ruleClaimIds, "governanceSource.ruleClaimIds", errors, { pattern: taskIdPattern, unique: true });
  strings(value.dependencyEdgeIds, "governanceSource.dependencyEdgeIds", errors, { pattern: taskIdPattern, unique: true });
  dateTime(value.observedAt, "governanceSource.observedAt", errors);
  nullableString(value.limitedReason, "governanceSource.limitedReason", errors);
  if (["unavailable", "ambiguous", "unverified"].includes(value.observationStatus) && (typeof value.limitedReason !== "string" || value.limitedReason.length === 0)) errors.push("governanceSource.limitedReason is required when source is not observed");
}

function validateSourceDependencyEdge(value, errors) {
  const keys = ["schemaVersion", "edgeId", "workspaceIdentityId", "declaringSourceId", "target", "requiredness", "applicabilityScope", "provenanceStatus", "observationStatus", "affectedClaimIds", "observedAt", "limitedReason"];
  if (!exactKeys(value, keys, [], "sourceDependencyEdge", errors)) return;
  schemaVersion(value.schemaVersion, "sourceDependencyEdge", errors);
  string(value.edgeId, "sourceDependencyEdge.edgeId", errors, taskIdPattern);
  string(value.workspaceIdentityId, "sourceDependencyEdge.workspaceIdentityId", errors, taskIdPattern);
  string(value.declaringSourceId, "sourceDependencyEdge.declaringSourceId", errors, taskIdPattern);
  if (exactKeys(value.target, ["kind", "locator", "identity"], [], "sourceDependencyEdge.target", errors)) {
    if (!["skill", "pack", "command", "script", "record-entry", "source", "schema", "other"].includes(value.target.kind)) errors.push("sourceDependencyEdge.target.kind is invalid");
    string(value.target.locator, "sourceDependencyEdge.target.locator", errors);
    nullableString(value.target.identity, "sourceDependencyEdge.target.identity", errors);
  }
  if (!["required", "optional"].includes(value.requiredness)) errors.push("sourceDependencyEdge.requiredness is invalid");
  strings(value.applicabilityScope, "sourceDependencyEdge.applicabilityScope", errors, { min: 1, unique: true });
  if (!["structured", "provider-declared", "confirmed", "inferred", "requires-confirmation"].includes(value.provenanceStatus)) errors.push("sourceDependencyEdge.provenanceStatus is invalid");
  if (!["available", "unavailable", "ambiguous", "unverified"].includes(value.observationStatus)) errors.push("sourceDependencyEdge.observationStatus is invalid");
  strings(value.affectedClaimIds, "sourceDependencyEdge.affectedClaimIds", errors, { pattern: taskIdPattern, unique: true });
  dateTime(value.observedAt, "sourceDependencyEdge.observedAt", errors);
  nullableString(value.limitedReason, "sourceDependencyEdge.limitedReason", errors);
  if (value.observationStatus !== "available" && (typeof value.limitedReason !== "string" || value.limitedReason.length === 0)) errors.push("sourceDependencyEdge.limitedReason is required when dependency is not available");
}

function validateRuleClaim(value, errors, label = "ruleClaim") {
  const keys = ["schemaVersion", "claimId", "workspaceIdentityId", "sourceId", "ruleKey", "normalizedValue", "precedenceClass", "applicabilityScope", "observationPoint", "status", "enforcement", "dependencyEdgeIds", "observedAt", "limitedReason"];
  if (!exactKeys(value, keys, [], label, errors)) return;
  schemaVersion(value.schemaVersion, label, errors);
  string(value.claimId, `${label}.claimId`, errors, taskIdPattern);
  string(value.workspaceIdentityId, `${label}.workspaceIdentityId`, errors, taskIdPattern);
  string(value.sourceId, `${label}.sourceId`, errors, taskIdPattern);
  string(value.ruleKey, `${label}.ruleKey`, errors, ruleIdPattern);
  string(value.precedenceClass, `${label}.precedenceClass`, errors);
  strings(value.applicabilityScope, `${label}.applicabilityScope`, errors, { min: 1, unique: true });
  string(value.observationPoint, `${label}.observationPoint`, errors);
  if (!["observed", "inferred", "confirmed", "default", "requires-confirmation"].includes(value.status)) errors.push(`${label}.status is invalid`);
  if (!["enforceable", "advisory", "unresolved"].includes(value.enforcement)) errors.push(`${label}.enforcement is invalid`);
  if (["inferred", "requires-confirmation"].includes(value.status) && value.enforcement === "enforceable") errors.push(`${label} inferred claim cannot be enforceable`);
  strings(value.dependencyEdgeIds, `${label}.dependencyEdgeIds`, errors, { pattern: taskIdPattern, unique: true });
  dateTime(value.observedAt, `${label}.observedAt`, errors);
  nullableString(value.limitedReason, `${label}.limitedReason`, errors);
  if (value.enforcement === "unresolved" && (typeof value.limitedReason !== "string" || value.limitedReason.length === 0)) errors.push(`${label}.limitedReason is required when enforcement is unresolved`);
}

function validateEffectiveProfileV2(value, errors) {
  const keys = ["schemaVersion", "profileId", "revisionId", "workspaceIdentityId", "computed", "computedAt", "completeness", "sourceIds", "workspaceRelationshipIds", "ruleClaims", "dependencyEdges", "applicablePackIds", "conflicts", "explanationId", "limitedReasons"];
  if (!exactKeys(value, keys, [], "effectiveProfileV2", errors)) return;
  if (value.schemaVersion !== "2.0") errors.push("effectiveProfileV2.schemaVersion must equal 2.0");
  string(value.profileId, "effectiveProfileV2.profileId", errors, taskIdPattern);
  string(value.revisionId, "effectiveProfileV2.revisionId", errors, taskIdPattern);
  string(value.workspaceIdentityId, "effectiveProfileV2.workspaceIdentityId", errors, taskIdPattern);
  if (value.computed !== true) errors.push("effectiveProfileV2.computed must equal true");
  dateTime(value.computedAt, "effectiveProfileV2.computedAt", errors);
  if (!["complete", "degraded", "unresolved"].includes(value.completeness)) errors.push("effectiveProfileV2.completeness is invalid");
  strings(value.sourceIds, "effectiveProfileV2.sourceIds", errors, { pattern: taskIdPattern, unique: true });
  strings(value.workspaceRelationshipIds, "effectiveProfileV2.workspaceRelationshipIds", errors, { pattern: taskIdPattern, unique: true });
  if (!Array.isArray(value.ruleClaims)) errors.push("effectiveProfileV2.ruleClaims must be an array");
  else value.ruleClaims.forEach((claim, index) => validateRuleClaim(claim, errors, `effectiveProfileV2.ruleClaims[${index}]`));
  if (!Array.isArray(value.dependencyEdges)) errors.push("effectiveProfileV2.dependencyEdges must be an array");
  else value.dependencyEdges.forEach((edge, index) => {
    const nestedErrors = [];
    validateSourceDependencyEdge(edge, nestedErrors);
    errors.push(...nestedErrors.map((error) => error.replace(/^sourceDependencyEdge/, `effectiveProfileV2.dependencyEdges[${index}]`)));
  });
  strings(value.applicablePackIds, "effectiveProfileV2.applicablePackIds", errors, { pattern: idPattern, unique: true });
  if (!Array.isArray(value.conflicts)) errors.push("effectiveProfileV2.conflicts must be an array");
  else value.conflicts.forEach((conflict, index) => {
    const label = `effectiveProfileV2.conflicts[${index}]`;
    if (!exactKeys(conflict, ["conflictId", "claimIds", "status", "limitedReason"], [], label, errors)) return;
    string(conflict.conflictId, `${label}.conflictId`, errors, taskIdPattern);
    strings(conflict.claimIds, `${label}.claimIds`, errors, { min: 2, pattern: taskIdPattern, unique: true });
    if (conflict.status !== "unresolved") errors.push(`${label}.status must equal unresolved`);
    string(conflict.limitedReason, `${label}.limitedReason`, errors);
  });
  string(value.explanationId, "effectiveProfileV2.explanationId", errors, taskIdPattern);
  strings(value.limitedReasons, "effectiveProfileV2.limitedReasons", errors, { unique: true });

  const sourceIds = new Set(value.sourceIds ?? []);
  const claimIds = value.ruleClaims?.map((claim) => claim.claimId) ?? [];
  const edgeIds = value.dependencyEdges?.map((edge) => edge.edgeId) ?? [];
  if (new Set(claimIds).size !== claimIds.length) errors.push("effectiveProfileV2.ruleClaims contains duplicate claim ids");
  if (new Set(edgeIds).size !== edgeIds.length) errors.push("effectiveProfileV2.dependencyEdges contains duplicate edge ids");
  const conflictIds = value.conflicts?.map((conflict) => conflict.conflictId) ?? [];
  if (new Set(conflictIds).size !== conflictIds.length) errors.push("effectiveProfileV2.conflicts contains duplicate conflict ids");
  const claimSet = new Set(claimIds);
  const edgeSet = new Set(edgeIds);
  for (const claim of value.ruleClaims ?? []) {
    if (claim.workspaceIdentityId !== value.workspaceIdentityId) errors.push(`effectiveProfileV2 claim Workspace Identity mismatch: ${claim.claimId}`);
    if (!sourceIds.has(claim.sourceId)) errors.push(`effectiveProfileV2 claim source is not inventoried: ${claim.claimId}`);
    for (const edgeId of claim.dependencyEdgeIds ?? []) if (!edgeSet.has(edgeId)) errors.push(`effectiveProfileV2 claim references unknown dependency edge: ${edgeId}`);
  }
  for (const edge of value.dependencyEdges ?? []) {
    if (edge.workspaceIdentityId !== value.workspaceIdentityId) errors.push(`effectiveProfileV2 dependency Workspace Identity mismatch: ${edge.edgeId}`);
    if (!sourceIds.has(edge.declaringSourceId)) errors.push(`effectiveProfileV2 dependency source is not inventoried: ${edge.edgeId}`);
    for (const claimId of edge.affectedClaimIds ?? []) if (!claimSet.has(claimId)) errors.push(`effectiveProfileV2 dependency references unknown claim: ${claimId}`);
  }
  for (const conflict of value.conflicts ?? []) for (const claimId of conflict.claimIds ?? []) if (!claimSet.has(claimId)) errors.push(`effectiveProfileV2 conflict references unknown claim: ${claimId}`);
  const requiredUnavailable = (value.dependencyEdges ?? []).some((edge) => edge.requiredness === "required" && edge.observationStatus !== "available");
  const anyUnavailable = (value.dependencyEdges ?? []).some((edge) => edge.observationStatus !== "available");
  const unresolvedClaim = (value.ruleClaims ?? []).some((claim) => claim.enforcement === "unresolved");
  if (value.completeness === "complete" && ((value.conflicts?.length ?? 0) > 0 || (value.limitedReasons?.length ?? 0) > 0 || anyUnavailable || unresolvedClaim)) errors.push("complete effectiveProfileV2 cannot contain unresolved, unavailable, conflict, or limited state");
  if (["degraded", "unresolved"].includes(value.completeness) && (value.limitedReasons?.length ?? 0) === 0) errors.push("non-complete effectiveProfileV2 requires limitedReasons");
  if ((requiredUnavailable || unresolvedClaim || (value.conflicts?.length ?? 0) > 0) && value.completeness !== "unresolved") errors.push("required dependency, unresolved claim, or conflict requires unresolved effectiveProfileV2");
}

function validateProfileExplanation(value, errors) {
  const keys = ["schemaVersion", "explanationId", "profileId", "profileRevisionId", "workspaceIdentityId", "generatedAt", "completeness", "sourceSummaries", "claimDecisions", "conflicts", "confirmationNeeds", "limitedReasons"];
  if (!exactKeys(value, keys, [], "profileExplanation", errors)) return;
  schemaVersion(value.schemaVersion, "profileExplanation", errors);
  string(value.explanationId, "profileExplanation.explanationId", errors, taskIdPattern);
  string(value.profileId, "profileExplanation.profileId", errors, taskIdPattern);
  string(value.profileRevisionId, "profileExplanation.profileRevisionId", errors, taskIdPattern);
  string(value.workspaceIdentityId, "profileExplanation.workspaceIdentityId", errors, taskIdPattern);
  dateTime(value.generatedAt, "profileExplanation.generatedAt", errors);
  if (!["complete", "degraded", "unresolved"].includes(value.completeness)) errors.push("profileExplanation.completeness is invalid");
  if (!Array.isArray(value.sourceSummaries)) errors.push("profileExplanation.sourceSummaries must be an array");
  else value.sourceSummaries.forEach((source, index) => {
    const label = `profileExplanation.sourceSummaries[${index}]`;
    if (!exactKeys(source, ["sourceId", "status", "claimIds", "limitedReason"], [], label, errors)) return;
    string(source.sourceId, `${label}.sourceId`, errors, taskIdPattern);
    if (!["observed", "unavailable", "ambiguous", "unverified"].includes(source.status)) errors.push(`${label}.status is invalid`);
    strings(source.claimIds, `${label}.claimIds`, errors, { pattern: taskIdPattern, unique: true });
    nullableString(source.limitedReason, `${label}.limitedReason`, errors);
    if (source.status !== "observed" && (typeof source.limitedReason !== "string" || source.limitedReason.length === 0)) errors.push(`${label}.limitedReason is required when source is not observed`);
  });
  if (!Array.isArray(value.claimDecisions)) errors.push("profileExplanation.claimDecisions must be an array");
  else value.claimDecisions.forEach((decision, index) => {
    const label = `profileExplanation.claimDecisions[${index}]`;
    if (!exactKeys(decision, ["claimId", "sourceId", "disposition", "reasonCode", "dependencyEdgeIds"], [], label, errors)) return;
    string(decision.claimId, `${label}.claimId`, errors, taskIdPattern);
    string(decision.sourceId, `${label}.sourceId`, errors, taskIdPattern);
    if (!["active", "shadowed", "unresolved", "excluded"].includes(decision.disposition)) errors.push(`${label}.disposition is invalid`);
    string(decision.reasonCode, `${label}.reasonCode`, errors);
    strings(decision.dependencyEdgeIds, `${label}.dependencyEdgeIds`, errors, { pattern: taskIdPattern, unique: true });
  });
  if (!Array.isArray(value.conflicts)) errors.push("profileExplanation.conflicts must be an array");
  else value.conflicts.forEach((conflict, index) => {
    const label = `profileExplanation.conflicts[${index}]`;
    if (!exactKeys(conflict, ["conflictId", "claimIds", "limitedReason", "confirmationRequired"], [], label, errors)) return;
    string(conflict.conflictId, `${label}.conflictId`, errors, taskIdPattern);
    strings(conflict.claimIds, `${label}.claimIds`, errors, { min: 2, pattern: taskIdPattern, unique: true });
    string(conflict.limitedReason, `${label}.limitedReason`, errors);
    if (typeof conflict.confirmationRequired !== "boolean") errors.push(`${label}.confirmationRequired must be a boolean`);
  });
  if (!Array.isArray(value.confirmationNeeds)) errors.push("profileExplanation.confirmationNeeds must be an array");
  else value.confirmationNeeds.forEach((need, index) => {
    const label = `profileExplanation.confirmationNeeds[${index}]`;
    if (!exactKeys(need, ["needId", "claimIds", "reasonCode", "prompt"], [], label, errors)) return;
    string(need.needId, `${label}.needId`, errors, taskIdPattern);
    strings(need.claimIds, `${label}.claimIds`, errors, { min: 1, pattern: taskIdPattern, unique: true });
    string(need.reasonCode, `${label}.reasonCode`, errors);
    string(need.prompt, `${label}.prompt`, errors);
  });
  strings(value.limitedReasons, "profileExplanation.limitedReasons", errors, { unique: true });
  const sourceIds = value.sourceSummaries?.map((source) => source.sourceId) ?? [];
  const claimIds = value.claimDecisions?.map((decision) => decision.claimId) ?? [];
  const conflictIds = value.conflicts?.map((conflict) => conflict.conflictId) ?? [];
  const needIds = value.confirmationNeeds?.map((need) => need.needId) ?? [];
  if (new Set(sourceIds).size !== sourceIds.length) errors.push("profileExplanation.sourceSummaries contains duplicate source ids");
  if (new Set(claimIds).size !== claimIds.length) errors.push("profileExplanation.claimDecisions contains duplicate claim ids");
  if (new Set(conflictIds).size !== conflictIds.length) errors.push("profileExplanation.conflicts contains duplicate conflict ids");
  if (new Set(needIds).size !== needIds.length) errors.push("profileExplanation.confirmationNeeds contains duplicate need ids");
  const sourceSet = new Set(sourceIds);
  const claimSet = new Set(claimIds);
  for (const source of value.sourceSummaries ?? []) for (const claimId of source.claimIds ?? []) if (!claimSet.has(claimId)) errors.push(`profileExplanation source references unknown claim: ${claimId}`);
  for (const decision of value.claimDecisions ?? []) if (!sourceSet.has(decision.sourceId)) errors.push(`profileExplanation decision references unknown source: ${decision.claimId}`);
  for (const conflict of value.conflicts ?? []) for (const claimId of conflict.claimIds ?? []) if (!claimSet.has(claimId)) errors.push(`profileExplanation conflict references unknown claim: ${claimId}`);
  for (const need of value.confirmationNeeds ?? []) for (const claimId of need.claimIds ?? []) if (!claimSet.has(claimId)) errors.push(`profileExplanation confirmation need references unknown claim: ${claimId}`);
  const unresolved = (value.claimDecisions ?? []).some((decision) => decision.disposition === "unresolved");
  const sourceGap = (value.sourceSummaries ?? []).some((source) => source.status !== "observed");
  if (value.completeness === "complete" && ((value.conflicts?.length ?? 0) > 0 || (value.confirmationNeeds?.length ?? 0) > 0 || (value.limitedReasons?.length ?? 0) > 0 || unresolved || sourceGap)) errors.push("complete profileExplanation cannot contain unresolved, unavailable, conflict, confirmation, or limited state");
  if (["degraded", "unresolved"].includes(value.completeness) && (value.limitedReasons?.length ?? 0) === 0) errors.push("non-complete profileExplanation requires limitedReasons");
  if ((unresolved || (value.conflicts?.length ?? 0) > 0) && value.completeness !== "unresolved") errors.push("unresolved decisions or conflicts require unresolved profileExplanation");
}

function validateEntryMode(value, errors, label = "entryMode") {
  const keys = ["schemaVersion", "mode", "sourceEvidenceIds", "observedAt"];
  if (!exactKeys(value, keys, [], label, errors)) return;
  contractVersion(value.schemaVersion, "1.0", label, errors);
  if (!["new", "resumed", "imported"].includes(value.mode)) errors.push(`${label}.mode is invalid`);
  strings(value.sourceEvidenceIds, `${label}.sourceEvidenceIds`, errors, { pattern: taskIdPattern, unique: true });
  if (["resumed", "imported"].includes(value.mode) && (value.sourceEvidenceIds?.length ?? 0) === 0) errors.push(`${label} resumed/imported mode requires sourceEvidenceIds`);
  dateTime(value.observedAt, `${label}.observedAt`, errors);
}

function validatePhaseSliceCorrelation(value, errors, label = "phaseSliceCorrelation") {
  const keys = ["schemaVersion", "correlationId", "taskId", "parentTaskId", "phaseId", "sliceId", "executionAttemptId", "ownerWorkspaceIdentityId", "requiredSliceIds", "aggregateClosureClaim"];
  if (!exactKeys(value, keys, [], label, errors)) return;
  contractVersion(value.schemaVersion, "1.0", label, errors);
  string(value.correlationId, `${label}.correlationId`, errors, taskIdPattern);
  string(value.taskId, `${label}.taskId`, errors, taskIdPattern);
  nullableString(value.parentTaskId, `${label}.parentTaskId`, errors, taskIdPattern);
  string(value.phaseId, `${label}.phaseId`, errors, taskIdPattern);
  string(value.sliceId, `${label}.sliceId`, errors, taskIdPattern);
  string(value.executionAttemptId, `${label}.executionAttemptId`, errors, taskIdPattern);
  string(value.ownerWorkspaceIdentityId, `${label}.ownerWorkspaceIdentityId`, errors, taskIdPattern);
  strings(value.requiredSliceIds, `${label}.requiredSliceIds`, errors, { min: 1, pattern: taskIdPattern, unique: true });
  if (!value.requiredSliceIds?.includes(value.sliceId)) errors.push(`${label}.requiredSliceIds must include the exact sliceId`);
  if (value.aggregateClosureClaim !== false) errors.push(`${label}.aggregateClosureClaim must equal false`);
}

function validateOperationAuthorityRequirement(value, errors) {
  const label = "operationAuthorityRequirement";
  const keys = ["schemaVersion", "requirementId", "workspaceIdentityId", "operation", "target", "subjectId", "scope", "eligibleIssuerSourceIds", "acceptedIssuerEvidenceKinds", "freshness", "declaredAt"];
  if (!exactKeys(value, keys, [], label, errors)) return;
  contractVersion(value.schemaVersion, "1.0", label, errors);
  string(value.requirementId, `${label}.requirementId`, errors, taskIdPattern);
  string(value.workspaceIdentityId, `${label}.workspaceIdentityId`, errors, taskIdPattern);
  string(value.operation, `${label}.operation`, errors);
  validateTarget(value.target, `${label}.target`, errors);
  string(value.subjectId, `${label}.subjectId`, errors, taskIdPattern);
  strings(value.scope, `${label}.scope`, errors, { min: 1, unique: true });
  strings(value.eligibleIssuerSourceIds, `${label}.eligibleIssuerSourceIds`, errors, { min: 1, pattern: taskIdPattern, unique: true });
  strings(value.acceptedIssuerEvidenceKinds, `${label}.acceptedIssuerEvidenceKinds`, errors, { min: 1, unique: true });
  if (exactKeys(value.freshness, ["maxAgeSeconds", "expiresRequired"], [], `${label}.freshness`, errors)) {
    if (!Number.isInteger(value.freshness.maxAgeSeconds) || value.freshness.maxAgeSeconds < 1) errors.push(`${label}.freshness.maxAgeSeconds must be a positive integer`);
    if (typeof value.freshness.expiresRequired !== "boolean") errors.push(`${label}.freshness.expiresRequired must be a boolean`);
  }
  dateTime(value.declaredAt, `${label}.declaredAt`, errors);
}

function validateEvidenceIdentity(value, errors) {
  const label = "evidenceIdentity";
  const keys = ["schemaVersion", "evidenceId", "workspaceIdentityId", "scopeKind", "taskId", "subjectId", "envelopeRevisionId", "controlRevisionId", "source", "contentDigest", "observedAt", "availability", "sanitized", "limitedReason"];
  if (!exactKeys(value, keys, [], label, errors)) return;
  contractVersion(value.schemaVersion, "1.0", label, errors);
  string(value.evidenceId, `${label}.evidenceId`, errors, taskIdPattern);
  string(value.workspaceIdentityId, `${label}.workspaceIdentityId`, errors, taskIdPattern);
  if (!["workspace", "task", "subject"].includes(value.scopeKind)) errors.push(`${label}.scopeKind is invalid`);
  nullableString(value.taskId, `${label}.taskId`, errors, taskIdPattern);
  nullableString(value.subjectId, `${label}.subjectId`, errors, taskIdPattern);
  nullableString(value.envelopeRevisionId, `${label}.envelopeRevisionId`, errors, taskIdPattern);
  nullableString(value.controlRevisionId, `${label}.controlRevisionId`, errors, taskIdPattern);
  if (exactKeys(value.source, ["kind", "providerId", "locator", "providerEvidenceId"], [], `${label}.source`, errors)) {
    if (!["file", "git", "test", "log", "provider", "external-receipt", "agent-claim", "other"].includes(value.source.kind)) errors.push(`${label}.source.kind is invalid`);
    nullableString(value.source.providerId, `${label}.source.providerId`, errors, idPattern);
    string(value.source.locator, `${label}.source.locator`, errors);
    nullableString(value.source.providerEvidenceId, `${label}.source.providerEvidenceId`, errors);
  }
  nullableString(value.contentDigest, `${label}.contentDigest`, errors, digestPattern);
  dateTime(value.observedAt, `${label}.observedAt`, errors);
  if (!["available", "unavailable", "unverified"].includes(value.availability)) errors.push(`${label}.availability is invalid`);
  if (value.sanitized !== true) errors.push(`${label}.sanitized must equal true`);
  nullableString(value.limitedReason, `${label}.limitedReason`, errors);
  if (["task", "subject"].includes(value.scopeKind) && (!value.taskId || !value.envelopeRevisionId || !value.controlRevisionId)) errors.push(`${label} task-scoped evidence requires taskId, envelopeRevisionId, and controlRevisionId`);
  if (value.scopeKind === "subject" && !value.subjectId) errors.push(`${label} subject-scoped evidence requires subjectId`);
  if (value.availability !== "available" && !value.limitedReason) errors.push(`${label}.limitedReason is required when evidence is not available`);
}

function validateControlTaskEnvelope(value, errors) {
  const label = "controlTaskEnvelope";
  const keys = ["schemaVersion", "envelopeId", "revisionId", "taskId", "workspaceIdentityId", "profileId", "profileRevisionId", "subject", "intent", "nonGoals", "entryMode", "phaseSliceCorrelation", "operations", "prohibitedOperations", "requiredGateIds", "returnContract", "createdAt"];
  if (!exactKeys(value, keys, [], label, errors)) return;
  contractVersion(value.schemaVersion, "2.0", label, errors);
  for (const key of ["envelopeId", "revisionId", "taskId", "workspaceIdentityId", "profileId", "profileRevisionId"]) string(value[key], `${label}.${key}`, errors, taskIdPattern);
  validateSubject(value.subject, `${label}.subject`, errors);
  string(value.intent, `${label}.intent`, errors);
  strings(value.nonGoals, `${label}.nonGoals`, errors, { unique: true });
  validateEntryMode(value.entryMode, errors, `${label}.entryMode`);
  validatePhaseSliceCorrelation(value.phaseSliceCorrelation, errors, `${label}.phaseSliceCorrelation`);
  if (!Array.isArray(value.operations)) errors.push(`${label}.operations must be an array`);
  else value.operations.forEach((operation, index) => {
    const operationLabel = `${label}.operations[${index}]`;
    if (!exactKeys(operation, ["operationId", "operation", "target", "scope", "authorityRequirementId"], [], operationLabel, errors)) return;
    string(operation.operationId, `${operationLabel}.operationId`, errors, taskIdPattern);
    string(operation.operation, `${operationLabel}.operation`, errors);
    validateTarget(operation.target, `${operationLabel}.target`, errors);
    strings(operation.scope, `${operationLabel}.scope`, errors, { min: 1, unique: true });
    string(operation.authorityRequirementId, `${operationLabel}.authorityRequirementId`, errors, taskIdPattern);
  });
  const operationIds = value.operations?.map((operation) => operation.operationId) ?? [];
  if (new Set(operationIds).size !== operationIds.length) errors.push(`${label}.operations contains duplicate operation ids`);
  strings(value.prohibitedOperations, `${label}.prohibitedOperations`, errors, { unique: true });
  for (const operation of value.operations ?? []) if (value.prohibitedOperations?.includes(operation.operation)) errors.push(`${label} allows and prohibits the same operation: ${operation.operation}`);
  strings(value.requiredGateIds, `${label}.requiredGateIds`, errors, { pattern: taskIdPattern, unique: true });
  if (value.returnContract !== "return-receipt-v2") errors.push(`${label}.returnContract is invalid`);
  dateTime(value.createdAt, `${label}.createdAt`, errors);
  if (value.phaseSliceCorrelation?.taskId !== value.taskId) errors.push(`${label} taskId does not match phase/slice correlation`);
  if (value.phaseSliceCorrelation?.ownerWorkspaceIdentityId !== value.workspaceIdentityId) errors.push(`${label} Workspace Identity does not match phase/slice correlation`);
}

function validateOperationGrant(value, errors) {
  const label = "operationGrant";
  const keys = ["schemaVersion", "grantId", "grantDigest", "authorityRequirementId", "workspaceIdentityId", "envelopeId", "envelopeRevisionId", "executorId", "operation", "target", "subjectId", "candidateId", "scope", "issuerId", "issuerEvidenceId", "issuedAt", "notBefore", "expiresAt", "status", "invalidatedAt", "invalidationEvidenceId", "supersededByGrantId", "retroactiveEffect"];
  if (!exactKeys(value, keys, [], label, errors)) return;
  contractVersion(value.schemaVersion, "1.0", label, errors);
  for (const key of ["grantId", "authorityRequirementId", "workspaceIdentityId", "envelopeId", "envelopeRevisionId", "subjectId", "issuerEvidenceId"]) string(value[key], `${label}.${key}`, errors, taskIdPattern);
  string(value.grantDigest, `${label}.grantDigest`, errors, digestPattern);
  string(value.executorId, `${label}.executorId`, errors);
  string(value.operation, `${label}.operation`, errors);
  validateTarget(value.target, `${label}.target`, errors);
  nullableString(value.candidateId, `${label}.candidateId`, errors, taskIdPattern);
  strings(value.scope, `${label}.scope`, errors, { min: 1, unique: true });
  string(value.issuerId, `${label}.issuerId`, errors);
  dateTime(value.issuedAt, `${label}.issuedAt`, errors);
  dateTime(value.notBefore, `${label}.notBefore`, errors);
  dateTime(value.expiresAt, `${label}.expiresAt`, errors);
  if (!["current", "expired", "revoked", "stale", "superseded"].includes(value.status)) errors.push(`${label}.status is invalid`);
  if (value.invalidatedAt !== null) dateTime(value.invalidatedAt, `${label}.invalidatedAt`, errors);
  nullableString(value.invalidationEvidenceId, `${label}.invalidationEvidenceId`, errors, taskIdPattern);
  nullableString(value.supersededByGrantId, `${label}.supersededByGrantId`, errors, taskIdPattern);
  if (exactKeys(value.retroactiveEffect, ["applies", "scope"], [], `${label}.retroactiveEffect`, errors)) {
    if (typeof value.retroactiveEffect.applies !== "boolean") errors.push(`${label}.retroactiveEffect.applies must be a boolean`);
    strings(value.retroactiveEffect.scope, `${label}.retroactiveEffect.scope`, errors, { unique: true });
    if (value.retroactiveEffect.applies && value.retroactiveEffect.scope.length === 0) errors.push(`${label} bounded retroactive effect requires scope`);
  }
  if (Date.parse(value.notBefore) < Date.parse(value.issuedAt)) errors.push(`${label}.notBefore cannot precede issuedAt`);
  if (Date.parse(value.expiresAt) <= Date.parse(value.notBefore)) errors.push(`${label}.expiresAt must follow notBefore`);
  if (value.status === "current" && (value.invalidatedAt !== null || value.invalidationEvidenceId !== null || value.supersededByGrantId !== null)) errors.push(`${label} current grant cannot carry invalidation or successor identity`);
  if (value.status !== "current" && value.invalidatedAt === null) errors.push(`${label} non-current grant requires invalidatedAt`);
  if (["revoked", "stale", "superseded"].includes(value.status) && !value.invalidationEvidenceId) errors.push(`${label} revoked, stale, or superseded grant requires invalidationEvidenceId`);
  if (value.status === "superseded" && !value.supersededByGrantId) errors.push(`${label} superseded grant requires supersededByGrantId`);
}

function validateGateResult(value, errors) {
  const label = "gateResult";
  const keys = ["schemaVersion", "gateResultId", "gateId", "gateKind", "workspaceIdentityId", "envelopeRevisionId", "controlRevisionId", "subjectId", "disposition", "evidenceIdentityIds", "evaluatedAt", "limitedReason"];
  if (!exactKeys(value, keys, [], label, errors)) return;
  contractVersion(value.schemaVersion, "1.0", label, errors);
  for (const key of ["gateResultId", "gateId", "workspaceIdentityId", "envelopeRevisionId", "controlRevisionId", "subjectId"]) string(value[key], `${label}.${key}`, errors, taskIdPattern);
  if (!["operation-authorization", "review-authority", "validation", "governance-dependency", "receipt-verification"].includes(value.gateKind)) errors.push(`${label}.gateKind is invalid`);
  if (!["satisfied", "unsatisfied", "blocked", "deviation_requires_review"].includes(value.disposition)) errors.push(`${label}.disposition is invalid`);
  strings(value.evidenceIdentityIds, `${label}.evidenceIdentityIds`, errors, { pattern: taskIdPattern, unique: true });
  dateTime(value.evaluatedAt, `${label}.evaluatedAt`, errors);
  nullableString(value.limitedReason, `${label}.limitedReason`, errors);
  if (value.disposition === "satisfied" && (value.evidenceIdentityIds?.length ?? 0) === 0) errors.push(`${label} satisfied result requires evidence`);
  if (value.disposition === "satisfied" && value.limitedReason !== null) errors.push(`${label} satisfied result cannot carry limitedReason`);
  if (value.disposition !== "satisfied" && !value.limitedReason) errors.push(`${label} non-satisfied result requires limitedReason`);
}

function validateControlRevision(value, errors) {
  const label = "controlRevision";
  const keys = ["schemaVersion", "revisionId", "predecessorRevisionId", "taskId", "workspaceIdentityId", "profileId", "profileRevisionId", "envelopeId", "envelopeRevisionId", "subjectId", "entryMode", "phaseSliceCorrelation", "state", "operationGrantIds", "gateResultIds", "evidenceIdentityIds", "deviationEvidenceIds", "returnReceiptId", "observedAt"];
  if (!exactKeys(value, keys, [], label, errors)) return;
  contractVersion(value.schemaVersion, "1.0", label, errors);
  for (const key of ["revisionId", "taskId", "workspaceIdentityId", "profileId", "profileRevisionId", "envelopeId", "envelopeRevisionId", "subjectId"]) string(value[key], `${label}.${key}`, errors, taskIdPattern);
  nullableString(value.predecessorRevisionId, `${label}.predecessorRevisionId`, errors, taskIdPattern);
  if (value.predecessorRevisionId === value.revisionId) errors.push(`${label} cannot be its own predecessor`);
  validateEntryMode(value.entryMode, errors, `${label}.entryMode`);
  validatePhaseSliceCorrelation(value.phaseSliceCorrelation, errors, `${label}.phaseSliceCorrelation`);
  if (!["observed", "profile_resolved", "awaiting_authorization", "ready_for_execution", "execution_finished", "verification_pending", "deviation_requires_review", "blocked", "closed"].includes(value.state)) errors.push(`${label}.state is invalid`);
  for (const key of ["operationGrantIds", "gateResultIds", "evidenceIdentityIds", "deviationEvidenceIds"]) strings(value[key], `${label}.${key}`, errors, { pattern: taskIdPattern, unique: true });
  nullableString(value.returnReceiptId, `${label}.returnReceiptId`, errors, taskIdPattern);
  dateTime(value.observedAt, `${label}.observedAt`, errors);
  if (value.phaseSliceCorrelation?.taskId !== value.taskId) errors.push(`${label} taskId does not match phase/slice correlation`);
  if (value.phaseSliceCorrelation?.ownerWorkspaceIdentityId !== value.workspaceIdentityId) errors.push(`${label} Workspace Identity does not match phase/slice correlation`);
  if (value.state === "closed" && (!value.returnReceiptId || (value.deviationEvidenceIds?.length ?? 0) > 0)) errors.push(`${label} closed state requires a receipt and no unresolved deviations`);
  if (value.state === "deviation_requires_review" && (value.deviationEvidenceIds?.length ?? 0) === 0) errors.push(`${label} deviation state requires evidence`);
}

function validateReturnReceiptV2(value, errors) {
  const label = "returnReceiptV2";
  const keys = ["schemaVersion", "receiptId", "taskId", "workspaceIdentityId", "profileId", "profileRevisionId", "envelopeId", "envelopeRevisionId", "controlRevisionId", "subjectId", "phaseSliceCorrelation", "exercisedOperationGrantIds", "changedScope", "validationEvidenceIdentityIds", "externalSideEffects", "confirmedNonMutations", "residualRisks", "rollbackEnvelopeLineageId", "deviations", "claimStatus", "verificationGateResultId", "closeout", "claimedAt"];
  if (!exactKeys(value, keys, [], label, errors)) return;
  contractVersion(value.schemaVersion, "2.0", label, errors);
  for (const key of ["receiptId", "taskId", "workspaceIdentityId", "profileId", "profileRevisionId", "envelopeId", "envelopeRevisionId", "controlRevisionId", "subjectId"]) string(value[key], `${label}.${key}`, errors, taskIdPattern);
  validatePhaseSliceCorrelation(value.phaseSliceCorrelation, errors, `${label}.phaseSliceCorrelation`);
  strings(value.exercisedOperationGrantIds, `${label}.exercisedOperationGrantIds`, errors, { pattern: taskIdPattern, unique: true });
  strings(value.changedScope, `${label}.changedScope`, errors, { unique: true });
  strings(value.validationEvidenceIdentityIds, `${label}.validationEvidenceIdentityIds`, errors, { pattern: taskIdPattern, unique: true });
  if (!Array.isArray(value.externalSideEffects)) errors.push(`${label}.externalSideEffects must be an array`);
  else value.externalSideEffects.forEach((effect, index) => {
    const effectLabel = `${label}.externalSideEffects[${index}]`;
    if (!exactKeys(effect, ["operationId", "targetLocator", "observedAt"], [], effectLabel, errors)) return;
    string(effect.operationId, `${effectLabel}.operationId`, errors, taskIdPattern);
    string(effect.targetLocator, `${effectLabel}.targetLocator`, errors);
    dateTime(effect.observedAt, `${effectLabel}.observedAt`, errors);
  });
  const sideEffectIds = value.externalSideEffects?.map((effect) => effect.operationId) ?? [];
  if (new Set(sideEffectIds).size !== sideEffectIds.length) errors.push(`${label}.externalSideEffects contains duplicate operation ids`);
  for (const key of ["confirmedNonMutations", "residualRisks", "deviations"]) strings(value[key], `${label}.${key}`, errors, { unique: true });
  nullableString(value.rollbackEnvelopeLineageId, `${label}.rollbackEnvelopeLineageId`, errors, taskIdPattern);
  if (!["claimed", "verified", "rejected", "stale"].includes(value.claimStatus)) errors.push(`${label}.claimStatus is invalid`);
  nullableString(value.verificationGateResultId, `${label}.verificationGateResultId`, errors, taskIdPattern);
  if (!["complete", "incomplete", "blocked"].includes(value.closeout)) errors.push(`${label}.closeout is invalid`);
  dateTime(value.claimedAt, `${label}.claimedAt`, errors);
  if (value.phaseSliceCorrelation?.taskId !== value.taskId) errors.push(`${label} taskId does not match phase/slice correlation`);
  if (value.phaseSliceCorrelation?.ownerWorkspaceIdentityId !== value.workspaceIdentityId) errors.push(`${label} Workspace Identity does not match phase/slice correlation`);
  if (value.claimStatus === "verified" && !value.verificationGateResultId) errors.push(`${label} verified receipt requires verificationGateResultId`);
  if (value.closeout === "complete" && (value.claimStatus !== "verified" || !value.verificationGateResultId || (value.deviations?.length ?? 0) > 0)) errors.push(`${label} complete closeout requires verified status, verification evidence, and no deviations`);
}

function validateRollbackEnvelopeLineage(value, errors) {
  const label = "rollbackEnvelopeLineage";
  const keys = ["schemaVersion", "lineageId", "workspaceIdentityId", "forwardEnvelope", "rollbackEnvelope", "forwardOperationGrantIds", "rollbackOperationGrantIds", "rollbackOperationIds", "state", "validationGateResultIds", "rollbackReceiptId", "declaredByEvidenceId", "reason", "createdAt"];
  if (!exactKeys(value, keys, [], label, errors)) return;
  contractVersion(value.schemaVersion, "1.0", label, errors);
  string(value.lineageId, `${label}.lineageId`, errors, taskIdPattern);
  string(value.workspaceIdentityId, `${label}.workspaceIdentityId`, errors, taskIdPattern);
  validateEnvelopeReference(value.forwardEnvelope, `${label}.forwardEnvelope`, errors);
  validateEnvelopeReference(value.rollbackEnvelope, `${label}.rollbackEnvelope`, errors);
  for (const key of ["forwardOperationGrantIds", "rollbackOperationGrantIds", "rollbackOperationIds", "validationGateResultIds"]) strings(value[key], `${label}.${key}`, errors, { pattern: taskIdPattern, unique: true, min: key === "rollbackOperationIds" ? 1 : 0 });
  if (!["awaiting_authorization", "authorized", "executed", "verified", "blocked"].includes(value.state)) errors.push(`${label}.state is invalid`);
  nullableString(value.rollbackReceiptId, `${label}.rollbackReceiptId`, errors, taskIdPattern);
  string(value.declaredByEvidenceId, `${label}.declaredByEvidenceId`, errors, taskIdPattern);
  string(value.reason, `${label}.reason`, errors);
  dateTime(value.createdAt, `${label}.createdAt`, errors);
  if (value.forwardEnvelope?.envelopeId === value.rollbackEnvelope?.envelopeId && value.forwardEnvelope?.revisionId === value.rollbackEnvelope?.revisionId) errors.push(`${label} rollback must use a new Envelope revision`);
  const reusedGrants = (value.rollbackOperationGrantIds ?? []).filter((grantId) => value.forwardOperationGrantIds?.includes(grantId));
  if (reusedGrants.length > 0) errors.push(`${label} rollback cannot reuse forward Operation Grants: ${reusedGrants.join(", ")}`);
  if (["authorized", "executed", "verified"].includes(value.state) && (value.rollbackOperationGrantIds?.length ?? 0) === 0) errors.push(`${label} authorized or executed rollback requires rollback-specific grants`);
  if (value.state === "verified" && (!value.rollbackReceiptId || (value.validationGateResultIds?.length ?? 0) === 0)) errors.push(`${label} verified rollback requires validation gates and its own receipt`);
}

function validateReviewAuthorityRequirement(value, errors) {
  const label = "reviewAuthorityRequirement";
  const keys = ["schemaVersion", "requirementId", "workspaceIdentityId", "operation", "authorityClass", "subjectId", "scope", "authoritySourceIds", "acceptedEvidenceKinds", "quorum", "actorConstraints", "ownerCoverage", "freshness", "substitutionPolicy", "waiverPolicy", "declaredAt"];
  if (!exactKeys(value, keys, [], label, errors)) return;
  contractVersion(value.schemaVersion, "1.0", label, errors);
  for (const key of ["requirementId", "workspaceIdentityId", "subjectId"]) string(value[key], `${label}.${key}`, errors, taskIdPattern);
  string(value.operation, `${label}.operation`, errors);
  if (!authorityClasses.includes(value.authorityClass)) errors.push(`${label}.authorityClass is invalid`);
  strings(value.scope, `${label}.scope`, errors, { min: 1, unique: true });
  strings(value.authoritySourceIds, `${label}.authoritySourceIds`, errors, { min: 1, pattern: taskIdPattern, unique: true });
  strings(value.acceptedEvidenceKinds, `${label}.acceptedEvidenceKinds`, errors, { min: 1, unique: true });
  if (exactKeys(value.quorum, ["minimumCount", "distinctActors"], [], `${label}.quorum`, errors)) {
    if (!Number.isInteger(value.quorum.minimumCount) || value.quorum.minimumCount < 1) errors.push(`${label}.quorum.minimumCount must be a positive integer`);
    if (typeof value.quorum.distinctActors !== "boolean") errors.push(`${label}.quorum.distinctActors must be a boolean`);
  }
  if (exactKeys(value.actorConstraints, ["eligibleActorSourceIds", "excludedRelations"], [], `${label}.actorConstraints`, errors)) {
    strings(value.actorConstraints.eligibleActorSourceIds, `${label}.actorConstraints.eligibleActorSourceIds`, errors, { pattern: taskIdPattern, unique: true });
    strings(value.actorConstraints.excludedRelations, `${label}.actorConstraints.excludedRelations`, errors, { unique: true });
    for (const relation of value.actorConstraints.excludedRelations ?? []) if (!["subject-author", "executor", "evidence-author"].includes(relation)) errors.push(`${label}.actorConstraints.excludedRelations contains an invalid relation`);
  }
  if (exactKeys(value.ownerCoverage, ["required", "surfaceIds"], [], `${label}.ownerCoverage`, errors)) {
    if (typeof value.ownerCoverage.required !== "boolean") errors.push(`${label}.ownerCoverage.required must be a boolean`);
    strings(value.ownerCoverage.surfaceIds, `${label}.ownerCoverage.surfaceIds`, errors, { pattern: taskIdPattern, unique: true });
    if (value.ownerCoverage.required && value.ownerCoverage.surfaceIds.length === 0) errors.push(`${label} required owner coverage needs at least one surface`);
  }
  if (exactKeys(value.freshness, ["maxAgeSeconds", "expiresRequired"], [], `${label}.freshness`, errors)) {
    if (!Number.isInteger(value.freshness.maxAgeSeconds) || value.freshness.maxAgeSeconds < 1) errors.push(`${label}.freshness.maxAgeSeconds must be a positive integer`);
    if (typeof value.freshness.expiresRequired !== "boolean") errors.push(`${label}.freshness.expiresRequired must be a boolean`);
  }
  if (exactKeys(value.substitutionPolicy, ["mode", "equivalenceEdges"], [], `${label}.substitutionPolicy`, errors)) {
    if (!["none", "bounded-equivalence"].includes(value.substitutionPolicy.mode)) errors.push(`${label}.substitutionPolicy.mode is invalid`);
    if (!Array.isArray(value.substitutionPolicy.equivalenceEdges)) errors.push(`${label}.substitutionPolicy.equivalenceEdges must be an array`);
    else value.substitutionPolicy.equivalenceEdges.forEach((edge, index) => {
      const edgeLabel = `${label}.substitutionPolicy.equivalenceEdges[${index}]`;
      if (!exactKeys(edge, ["edgeId", "fromAuthorityClass", "toRequirementId", "sourceId", "direction", "transitive"], [], edgeLabel, errors)) return;
      string(edge.edgeId, `${edgeLabel}.edgeId`, errors, taskIdPattern);
      if (!authorityClasses.includes(edge.fromAuthorityClass)) errors.push(`${edgeLabel}.fromAuthorityClass is invalid`);
      string(edge.toRequirementId, `${edgeLabel}.toRequirementId`, errors, taskIdPattern);
      string(edge.sourceId, `${edgeLabel}.sourceId`, errors, taskIdPattern);
      if (edge.toRequirementId !== value.requirementId) errors.push(`${edgeLabel} must target the exact authority requirement`);
      if (edge.direction !== "one-way" || edge.transitive !== false) errors.push(`${edgeLabel} equivalence must be one-way and non-transitive`);
    });
    const edgeIds = value.substitutionPolicy.equivalenceEdges?.map((edge) => edge.edgeId) ?? [];
    if (new Set(edgeIds).size !== edgeIds.length) errors.push(`${label}.substitutionPolicy.equivalenceEdges contains duplicate edge ids`);
    if (value.substitutionPolicy.mode === "none" && edgeIds.length > 0) errors.push(`${label} non-substitutable requirement cannot declare equivalence edges`);
    if (value.substitutionPolicy.mode === "bounded-equivalence" && edgeIds.length === 0) errors.push(`${label} bounded equivalence requires an explicit edge`);
  }
  if (exactKeys(value.waiverPolicy, ["allowed", "requiredAuthorityClass"], [], `${label}.waiverPolicy`, errors)) {
    if (typeof value.waiverPolicy.allowed !== "boolean") errors.push(`${label}.waiverPolicy.allowed must be a boolean`);
    if (value.waiverPolicy.allowed && !authorityClasses.includes(value.waiverPolicy.requiredAuthorityClass)) errors.push(`${label} allowed waiver requires an authority class`);
    if (!value.waiverPolicy.allowed && value.waiverPolicy.requiredAuthorityClass !== null) errors.push(`${label} disallowed waiver cannot declare an authority class`);
  }
  dateTime(value.declaredAt, `${label}.declaredAt`, errors);
}

function validateAuthorityEvidence(value, errors) {
  const label = "authorityEvidence";
  const keys = ["schemaVersion", "authorityEvidenceId", "evidenceIdentityId", "requirementId", "workspaceIdentityId", "operation", "authorityClass", "subjectId", "actorId", "actorRelations", "scope", "coveredSurfaceIds", "lifecycle", "observedAt", "effectiveAt", "expiresAt", "invalidatedAt", "invalidationEvidenceIdentityId", "supersededByAuthorityEvidenceId", "limitedReason"];
  if (!exactKeys(value, keys, [], label, errors)) return;
  contractVersion(value.schemaVersion, "1.0", label, errors);
  for (const key of ["authorityEvidenceId", "evidenceIdentityId", "requirementId", "workspaceIdentityId", "subjectId"]) string(value[key], `${label}.${key}`, errors, taskIdPattern);
  string(value.operation, `${label}.operation`, errors);
  if (!authorityClasses.includes(value.authorityClass)) errors.push(`${label}.authorityClass is invalid`);
  string(value.actorId, `${label}.actorId`, errors);
  strings(value.actorRelations, `${label}.actorRelations`, errors, { unique: true });
  for (const relation of value.actorRelations ?? []) if (!["subject-author", "executor", "evidence-author", "surface-owner", "independent-reviewer"].includes(relation)) errors.push(`${label}.actorRelations contains an invalid relation`);
  strings(value.scope, `${label}.scope`, errors, { min: 1, unique: true });
  strings(value.coveredSurfaceIds, `${label}.coveredSurfaceIds`, errors, { pattern: taskIdPattern, unique: true });
  const lifecycleStates = ["current", "stale", "revoked", "dismissed", "expired", "superseded"];
  if (!lifecycleStates.includes(value.lifecycle)) errors.push(`${label}.lifecycle is invalid`);
  dateTime(value.observedAt, `${label}.observedAt`, errors);
  dateTime(value.effectiveAt, `${label}.effectiveAt`, errors);
  if (value.expiresAt !== null) dateTime(value.expiresAt, `${label}.expiresAt`, errors);
  if (value.invalidatedAt !== null) dateTime(value.invalidatedAt, `${label}.invalidatedAt`, errors);
  nullableString(value.invalidationEvidenceIdentityId, `${label}.invalidationEvidenceIdentityId`, errors, taskIdPattern);
  nullableString(value.supersededByAuthorityEvidenceId, `${label}.supersededByAuthorityEvidenceId`, errors, taskIdPattern);
  validateNullableLimitedReason(value.limitedReason, errors, `${label}.limitedReason`);
  if (value.lifecycle === "current" && (value.invalidatedAt !== null || value.invalidationEvidenceIdentityId !== null || value.supersededByAuthorityEvidenceId !== null || value.limitedReason !== null)) errors.push(`${label} current evidence cannot carry invalidation, successor, or limited reason`);
  if (value.lifecycle !== "current" && (value.invalidatedAt === null || value.limitedReason === null)) errors.push(`${label} non-current evidence requires invalidation time and limited reason`);
  if (["stale", "revoked", "dismissed", "superseded"].includes(value.lifecycle) && !value.invalidationEvidenceIdentityId) errors.push(`${label} invalidated evidence requires invalidation evidence identity`);
  if (value.lifecycle === "superseded" && !value.supersededByAuthorityEvidenceId) errors.push(`${label} superseded evidence requires successor identity`);
  const expectedCode = { stale: "stale-evidence", revoked: "revoked-evidence", dismissed: "dismissed-evidence", expired: "expired-evidence", superseded: "superseded-evidence" }[value.lifecycle];
  if (expectedCode && value.limitedReason?.code !== expectedCode) errors.push(`${label} lifecycle must use the matching bounded limited reason code`);
}

function validateValidationTopology(value, errors) {
  const label = "validationTopology";
  const keys = ["schemaVersion", "topologyId", "topologyRevisionId", "workspaceIdentityId", "profileId", "profileRevisionId", "subjectId", "coverageMode", "changedSurfaces", "validationRequirements", "declaredAt"];
  if (!exactKeys(value, keys, [], label, errors)) return;
  contractVersion(value.schemaVersion, "1.0", label, errors);
  for (const key of ["topologyId", "topologyRevisionId", "workspaceIdentityId", "profileId", "profileRevisionId", "subjectId"]) string(value[key], `${label}.${key}`, errors, taskIdPattern);
  if (!["required", "advisory", "undeclared"].includes(value.coverageMode)) errors.push(`${label}.coverageMode is invalid`);
  if (!Array.isArray(value.changedSurfaces)) errors.push(`${label}.changedSurfaces must be an array`);
  else value.changedSurfaces.forEach((surface, index) => {
    const surfaceLabel = `${label}.changedSurfaces[${index}]`;
    if (!exactKeys(surface, ["surfaceId", "locator", "ownerIds", "consumerIds", "validationRequirementIds", "sourceIdentityIds"], [], surfaceLabel, errors)) return;
    string(surface.surfaceId, `${surfaceLabel}.surfaceId`, errors, taskIdPattern);
    string(surface.locator, `${surfaceLabel}.locator`, errors);
    strings(surface.ownerIds, `${surfaceLabel}.ownerIds`, errors, { unique: true });
    strings(surface.consumerIds, `${surfaceLabel}.consumerIds`, errors, { unique: true });
    strings(surface.validationRequirementIds, `${surfaceLabel}.validationRequirementIds`, errors, { pattern: taskIdPattern, unique: true });
    strings(surface.sourceIdentityIds, `${surfaceLabel}.sourceIdentityIds`, errors, { min: 1, pattern: taskIdPattern, unique: true });
  });
  if (!Array.isArray(value.validationRequirements)) errors.push(`${label}.validationRequirements must be an array`);
  else value.validationRequirements.forEach((requirement, index) => {
    const requirementLabel = `${label}.validationRequirements[${index}]`;
    if (!exactKeys(requirement, ["requirementId", "entrypointId", "prerequisiteDependencyEdgeIds", "acceptedTrustClasses", "expectedResults", "evidenceLocators", "selected"], [], requirementLabel, errors)) return;
    string(requirement.requirementId, `${requirementLabel}.requirementId`, errors, taskIdPattern);
    string(requirement.entrypointId, `${requirementLabel}.entrypointId`, errors, taskIdPattern);
    strings(requirement.prerequisiteDependencyEdgeIds, `${requirementLabel}.prerequisiteDependencyEdgeIds`, errors, { pattern: taskIdPattern, unique: true });
    strings(requirement.acceptedTrustClasses, `${requirementLabel}.acceptedTrustClasses`, errors, { min: 1, unique: true });
    for (const trustClass of requirement.acceptedTrustClasses ?? []) if (!trustClasses.includes(trustClass)) errors.push(`${requirementLabel}.acceptedTrustClasses contains an invalid trust class`);
    strings(requirement.expectedResults, `${requirementLabel}.expectedResults`, errors, { min: 1, unique: true });
    for (const result of requirement.expectedResults ?? []) if (!["passed", "not_applicable"].includes(result)) errors.push(`${requirementLabel}.expectedResults contains an invalid result`);
    strings(requirement.evidenceLocators, `${requirementLabel}.evidenceLocators`, errors, { min: 1, unique: true });
    if (typeof requirement.selected !== "boolean") errors.push(`${requirementLabel}.selected must be a boolean`);
  });
  const surfaceIds = value.changedSurfaces?.map((surface) => surface.surfaceId) ?? [];
  const requirementIds = value.validationRequirements?.map((requirement) => requirement.requirementId) ?? [];
  if (new Set(surfaceIds).size !== surfaceIds.length) errors.push(`${label}.changedSurfaces contains duplicate surface ids`);
  if (new Set(requirementIds).size !== requirementIds.length) errors.push(`${label}.validationRequirements contains duplicate requirement ids`);
  const requirementSet = new Set(requirementIds);
  const selectedSet = new Set((value.validationRequirements ?? []).filter((requirement) => requirement.selected).map((requirement) => requirement.requirementId));
  for (const surface of value.changedSurfaces ?? []) {
    for (const requirementId of surface.validationRequirementIds ?? []) if (!requirementSet.has(requirementId)) errors.push(`${label} surface references unknown validation requirement: ${requirementId}`);
    if (value.coverageMode === "required" && !(surface.validationRequirementIds ?? []).some((requirementId) => selectedSet.has(requirementId))) errors.push(`${label} required coverage surface lacks a selected validation requirement: ${surface.surfaceId}`);
  }
  dateTime(value.declaredAt, `${label}.declaredAt`, errors);
}

function validateValidationResult(value, errors) {
  const label = "validationResult";
  const keys = ["schemaVersion", "resultId", "topologyId", "topologyRevisionId", "requirementId", "workspaceIdentityId", "envelopeRevisionId", "controlRevisionId", "subjectId", "executionContextIdentityId", "status", "expectedResult", "trustClass", "evidenceIdentityIds", "waiver", "observedAt", "limitedReason"];
  if (!exactKeys(value, keys, [], label, errors)) return;
  contractVersion(value.schemaVersion, "1.0", label, errors);
  for (const key of ["resultId", "topologyId", "topologyRevisionId", "requirementId", "workspaceIdentityId", "envelopeRevisionId", "controlRevisionId", "subjectId", "executionContextIdentityId"]) string(value[key], `${label}.${key}`, errors, taskIdPattern);
  const statuses = ["passed", "failed", "blocked", "unavailable", "not_applicable", "not_selected", "waived"];
  if (!statuses.includes(value.status)) errors.push(`${label}.status is invalid`);
  if (!["passed", "not_applicable"].includes(value.expectedResult)) errors.push(`${label}.expectedResult is invalid`);
  if (!trustClasses.includes(value.trustClass)) errors.push(`${label}.trustClass is invalid`);
  strings(value.evidenceIdentityIds, `${label}.evidenceIdentityIds`, errors, { pattern: taskIdPattern, unique: true });
  if (value.waiver !== null && exactKeys(value.waiver, ["authorityEvidenceId", "requirementId", "subjectId", "scope", "expiresAt"], [], `${label}.waiver`, errors)) {
    for (const key of ["authorityEvidenceId", "requirementId", "subjectId"]) string(value.waiver[key], `${label}.waiver.${key}`, errors, taskIdPattern);
    strings(value.waiver.scope, `${label}.waiver.scope`, errors, { min: 1, unique: true });
    dateTime(value.waiver.expiresAt, `${label}.waiver.expiresAt`, errors);
    if (value.waiver.requirementId !== value.requirementId || value.waiver.subjectId !== value.subjectId) errors.push(`${label} waiver must bind the exact requirement and subject`);
  }
  dateTime(value.observedAt, `${label}.observedAt`, errors);
  validateNullableLimitedReason(value.limitedReason, errors, `${label}.limitedReason`);
  if (value.status === "passed" && ((value.evidenceIdentityIds?.length ?? 0) === 0 || value.waiver !== null || value.limitedReason !== null)) errors.push(`${label} passed result requires evidence and cannot carry waiver or limited reason`);
  if (value.status === "failed" && (value.evidenceIdentityIds?.length ?? 0) === 0) errors.push(`${label} failed result requires observed evidence`);
  if (value.status === "waived" && (value.waiver === null || (value.evidenceIdentityIds?.length ?? 0) === 0 || value.limitedReason === null)) errors.push(`${label} waived result requires bounded authority, evidence, and limited reason`);
  if (value.status !== "waived" && value.waiver !== null) errors.push(`${label} non-waived result cannot carry waiver authority`);
  if (value.status !== "passed" && value.limitedReason === null) errors.push(`${label} non-passed result requires a bounded limited reason`);
}

function validateExecutionContextIdentity(value, errors) {
  const label = "executionContextIdentity";
  const keys = ["schemaVersion", "executionContextIdentityId", "workspaceIdentityId", "subjectId", "entrypoint", "invocationRoot", "executor", "runner", "toolIdentities", "providerIdentities", "dependencies", "observedAt", "sanitized"];
  if (!exactKeys(value, keys, [], label, errors)) return;
  contractVersion(value.schemaVersion, "1.0", label, errors);
  for (const key of ["executionContextIdentityId", "workspaceIdentityId", "subjectId"]) string(value[key], `${label}.${key}`, errors, taskIdPattern);
  if (exactKeys(value.entrypoint, ["entrypointId", "kind", "locator", "digest"], [], `${label}.entrypoint`, errors)) {
    string(value.entrypoint.entrypointId, `${label}.entrypoint.entrypointId`, errors, taskIdPattern);
    if (!["documented", "local-command", "hook", "ci", "nightly", "protected-environment", "other"].includes(value.entrypoint.kind)) errors.push(`${label}.entrypoint.kind is invalid`);
    string(value.entrypoint.locator, `${label}.entrypoint.locator`, errors);
    nullableString(value.entrypoint.digest, `${label}.entrypoint.digest`, errors, digestPattern);
  }
  string(value.invocationRoot, `${label}.invocationRoot`, errors);
  if (exactKeys(value.executor, ["executorId", "kind"], [], `${label}.executor`, errors)) {
    string(value.executor.executorId, `${label}.executor.executorId`, errors);
    if (!["host-agent", "human", "local-process", "provider-runner", "other"].includes(value.executor.kind)) errors.push(`${label}.executor.kind is invalid`);
  }
  if (exactKeys(value.runner, ["runnerId", "trustClass"], [], `${label}.runner`, errors)) {
    string(value.runner.runnerId, `${label}.runner.runnerId`, errors);
    if (!trustClasses.includes(value.runner.trustClass)) errors.push(`${label}.runner.trustClass is invalid`);
  }
  strings(value.toolIdentities, `${label}.toolIdentities`, errors, { unique: true });
  strings(value.providerIdentities, `${label}.providerIdentities`, errors, { unique: true });
  if (!Array.isArray(value.dependencies)) errors.push(`${label}.dependencies must be an array`);
  else value.dependencies.forEach((dependency, index) => {
    const dependencyLabel = `${label}.dependencies[${index}]`;
    if (!exactKeys(dependency, ["dependencyId", "kind", "locator", "boundary", "declared", "availability", "evidenceIdentityId", "limitedReason"], [], dependencyLabel, errors)) return;
    string(dependency.dependencyId, `${dependencyLabel}.dependencyId`, errors, taskIdPattern);
    if (!["environment-file", "configuration", "credential", "toolchain", "network-service", "provider-state", "other"].includes(dependency.kind)) errors.push(`${dependencyLabel}.kind is invalid`);
    string(dependency.locator, `${dependencyLabel}.locator`, errors);
    if (!["workspace-contained", "allowlisted-external", "undeclared-external", "unavailable-external"].includes(dependency.boundary)) errors.push(`${dependencyLabel}.boundary is invalid`);
    if (typeof dependency.declared !== "boolean") errors.push(`${dependencyLabel}.declared must be a boolean`);
    if (!["available", "unavailable", "unverified"].includes(dependency.availability)) errors.push(`${dependencyLabel}.availability is invalid`);
    nullableString(dependency.evidenceIdentityId, `${dependencyLabel}.evidenceIdentityId`, errors, taskIdPattern);
    validateNullableLimitedReason(dependency.limitedReason, errors, `${dependencyLabel}.limitedReason`);
    if ((dependency.availability !== "available" || ["undeclared-external", "unavailable-external"].includes(dependency.boundary)) && dependency.limitedReason === null) errors.push(`${dependencyLabel} unavailable or boundary-crossing dependency requires a limited reason`);
  });
  const dependencyIds = value.dependencies?.map((dependency) => dependency.dependencyId) ?? [];
  if (new Set(dependencyIds).size !== dependencyIds.length) errors.push(`${label}.dependencies contains duplicate ids`);
  dateTime(value.observedAt, `${label}.observedAt`, errors);
  if (value.sanitized !== true) errors.push(`${label}.sanitized must equal true`);
}

function validateAdapterCapabilityObservation(value, errors, label, allowedCapabilities) {
  if (!exactKeys(value, ["capability", "state", "evidenceIdentityIds", "limitedReason"], [], label, errors)) return;
  if (!allowedCapabilities.includes(value.capability)) errors.push(`${label}.capability is invalid`);
  if (!adapterSupportStates.includes(value.state)) errors.push(`${label}.state is invalid`);
  strings(value.evidenceIdentityIds, `${label}.evidenceIdentityIds`, errors, { pattern: taskIdPattern, unique: true });
  validateNullableLimitedReason(value.limitedReason, errors, `${label}.limitedReason`);
  if (value.state === "supported" && ((value.evidenceIdentityIds?.length ?? 0) === 0 || value.limitedReason !== null)) errors.push(`${label} supported capability requires evidence and no limited reason`);
  if (value.state !== "supported" && value.limitedReason === null) errors.push(`${label} non-supported capability requires a bounded limited reason`);
}

function validateAdapterScope(value, errors, label) {
  if (!["workspace", "task", "subject"].includes(value.scopeKind)) errors.push(`${label}.scopeKind is invalid`);
  nullableString(value.taskId, `${label}.taskId`, errors, taskIdPattern);
  nullableString(value.subjectId, `${label}.subjectId`, errors, taskIdPattern);
  nullableString(value.controlRevisionId, `${label}.controlRevisionId`, errors, taskIdPattern);
  if (["task", "subject"].includes(value.scopeKind) && (!value.taskId || !value.controlRevisionId)) errors.push(`${label} task-scoped observation requires taskId and controlRevisionId`);
  if (value.scopeKind === "subject" && !value.subjectId) errors.push(`${label} subject-scoped observation requires subjectId`);
}

function validateHostAdapterObservation(value, errors) {
  const label = "hostAdapterObservation";
  const keys = ["schemaVersion", "observationId", "adapterId", "adapterVersion", "hostIdentityId", "workspaceIdentityId", "scopeKind", "taskId", "subjectId", "controlRevisionId", "authorizationClaim", "capabilities", "observedAt", "sanitized"];
  if (!exactKeys(value, keys, [], label, errors)) return;
  contractVersion(value.schemaVersion, "1.0", label, errors);
  string(value.observationId, `${label}.observationId`, errors, taskIdPattern);
  string(value.adapterId, `${label}.adapterId`, errors, idPattern);
  string(value.adapterVersion, `${label}.adapterVersion`, errors);
  string(value.hostIdentityId, `${label}.hostIdentityId`, errors);
  string(value.workspaceIdentityId, `${label}.workspaceIdentityId`, errors, taskIdPattern);
  validateAdapterScope(value, errors, label);
  if (value.authorizationClaim !== false) errors.push(`${label}.authorizationClaim must equal false`);
  const capabilities = ["instruction-discovery", "workspace-boundary-discovery", "skill-or-plugin-discovery", "binding", "activation", "mutation", "execution-context", "verification"];
  if (!Array.isArray(value.capabilities) || value.capabilities.length === 0) errors.push(`${label}.capabilities must be a non-empty array`);
  else value.capabilities.forEach((capability, index) => validateAdapterCapabilityObservation(capability, errors, `${label}.capabilities[${index}]`, capabilities));
  const capabilityIds = value.capabilities?.map((capability) => capability.capability) ?? [];
  if (new Set(capabilityIds).size !== capabilityIds.length) errors.push(`${label}.capabilities contains duplicate capability observations`);
  dateTime(value.observedAt, `${label}.observedAt`, errors);
  if (value.sanitized !== true) errors.push(`${label}.sanitized must equal true`);
}

function validateProviderAdapterObservation(value, errors) {
  const label = "providerAdapterObservation";
  const keys = ["schemaVersion", "observationId", "adapterId", "adapterVersion", "providerId", "workspaceIdentityId", "sourceIdentityId", "scopeKind", "taskId", "subjectId", "controlRevisionId", "identity", "authorizationClaim", "capabilities", "observedAt", "sanitized"];
  if (!exactKeys(value, keys, [], label, errors)) return;
  contractVersion(value.schemaVersion, "1.0", label, errors);
  string(value.observationId, `${label}.observationId`, errors, taskIdPattern);
  string(value.adapterId, `${label}.adapterId`, errors, idPattern);
  string(value.adapterVersion, `${label}.adapterVersion`, errors);
  string(value.providerId, `${label}.providerId`, errors, idPattern);
  string(value.workspaceIdentityId, `${label}.workspaceIdentityId`, errors, taskIdPattern);
  string(value.sourceIdentityId, `${label}.sourceIdentityId`, errors, taskIdPattern);
  validateAdapterScope(value, errors, label);
  if (exactKeys(value.identity, ["state", "actorId", "evidenceIdentityIds", "limitedReason"], [], `${label}.identity`, errors)) {
    if (!["authenticated", "unauthenticated", "unverified", "unavailable", "not-required"].includes(value.identity.state)) errors.push(`${label}.identity.state is invalid`);
    nullableString(value.identity.actorId, `${label}.identity.actorId`, errors);
    strings(value.identity.evidenceIdentityIds, `${label}.identity.evidenceIdentityIds`, errors, { pattern: taskIdPattern, unique: true });
    validateNullableLimitedReason(value.identity.limitedReason, errors, `${label}.identity.limitedReason`);
    if (value.identity.state === "authenticated" && (!value.identity.actorId || (value.identity.evidenceIdentityIds?.length ?? 0) === 0 || value.identity.limitedReason !== null)) errors.push(`${label} authenticated identity requires actor, evidence, and no limited reason`);
    if (["unauthenticated", "unverified", "unavailable"].includes(value.identity.state) && (value.identity.actorId !== null || value.identity.limitedReason === null)) errors.push(`${label} unavailable identity cannot claim actor and requires a limited reason`);
    if (value.identity.state === "not-required" && (value.identity.actorId !== null || value.identity.limitedReason !== null)) errors.push(`${label} identity-not-required cannot claim actor or limited reason`);
  }
  if (value.authorizationClaim !== false) errors.push(`${label}.authorizationClaim must equal false`);
  const allowedCapabilities = ["source-observation", "evidence-observation", "authority-observation", "read", "write", "side-effect", "trust-observation", "freshness-observation", "revocation-observation"];
  if (!Array.isArray(value.capabilities) || value.capabilities.length === 0) errors.push(`${label}.capabilities must be a non-empty array`);
  else value.capabilities.forEach((capability, index) => {
    const capabilityLabel = `${label}.capabilities[${index}]`;
    if (!exactKeys(capability, ["capability", "state", "requiresIdentity", "sideEffectKinds", "approvalRequirementIds", "evidenceIdentityIds", "limitedReason"], [], capabilityLabel, errors)) return;
    if (!allowedCapabilities.includes(capability.capability)) errors.push(`${capabilityLabel}.capability is invalid`);
    if (!adapterSupportStates.includes(capability.state)) errors.push(`${capabilityLabel}.state is invalid`);
    if (typeof capability.requiresIdentity !== "boolean") errors.push(`${capabilityLabel}.requiresIdentity must be a boolean`);
    strings(capability.sideEffectKinds, `${capabilityLabel}.sideEffectKinds`, errors, { unique: true });
    strings(capability.approvalRequirementIds, `${capabilityLabel}.approvalRequirementIds`, errors, { pattern: taskIdPattern, unique: true });
    strings(capability.evidenceIdentityIds, `${capabilityLabel}.evidenceIdentityIds`, errors, { pattern: taskIdPattern, unique: true });
    validateNullableLimitedReason(capability.limitedReason, errors, `${capabilityLabel}.limitedReason`);
    if (capability.state === "supported" && ((capability.evidenceIdentityIds?.length ?? 0) === 0 || capability.limitedReason !== null)) errors.push(`${capabilityLabel} supported capability requires evidence and no limited reason`);
    if (capability.state !== "supported" && capability.limitedReason === null) errors.push(`${capabilityLabel} non-supported capability requires a bounded limited reason`);
    if (capability.requiresIdentity && value.identity?.state !== "authenticated" && capability.state === "supported") errors.push(`${capabilityLabel} cannot be supported without authenticated identity`);
  });
  const capabilityIds = value.capabilities?.map((capability) => capability.capability) ?? [];
  if (new Set(capabilityIds).size !== capabilityIds.length) errors.push(`${label}.capabilities contains duplicate capability observations`);
  dateTime(value.observedAt, `${label}.observedAt`, errors);
  if (value.sanitized !== true) errors.push(`${label}.sanitized must equal true`);
}

function sameStringSet(left, right) {
  return Array.isArray(left) && Array.isArray(right)
    && left.length === right.length
    && left.every((item) => right.includes(item));
}

function validateCrossWorkspacePackComposition(value, errors) {
  const label = "crossWorkspacePackComposition";
  const keys = ["schemaVersion", "compositionId", "packId", "packVersion", "coreCompatibility", "kernelInvariants", "workspaceSet", "nodes", "dependencyEdges", "phases", "workspaceReceiptBundle", "declaredAt"];
  if (!exactKeys(value, keys, [], label, errors)) return;
  contractVersion(value.schemaVersion, "1.0", label, errors);
  string(value.compositionId, `${label}.compositionId`, errors, taskIdPattern);
  if (value.packId !== "forgerail-cross-workspace-orchestration") errors.push(`${label}.packId is invalid`);
  string(value.packVersion, `${label}.packVersion`, errors);

  const compatibilityKeys = ["workspaceIdentityVersions", "taskEnvelopeVersions", "returnReceiptVersions", "phaseSliceCorrelationVersions", "status", "evidenceIdentityIds"];
  if (exactKeys(value.coreCompatibility, compatibilityKeys, [], `${label}.coreCompatibility`, errors)) {
    for (const key of ["workspaceIdentityVersions", "taskEnvelopeVersions", "returnReceiptVersions", "phaseSliceCorrelationVersions"]) strings(value.coreCompatibility[key], `${label}.coreCompatibility.${key}`, errors, { min: 1, unique: true });
    if (!["compatible", "incompatible", "unverified"].includes(value.coreCompatibility.status)) errors.push(`${label}.coreCompatibility.status is invalid`);
    strings(value.coreCompatibility.evidenceIdentityIds, `${label}.coreCompatibility.evidenceIdentityIds`, errors, { pattern: taskIdPattern, unique: true });
    if (value.coreCompatibility.status === "compatible" && value.coreCompatibility.evidenceIdentityIds.length === 0) errors.push(`${label} compatible Core contracts require evidence`);
  }

  const invariantKeys = ["stateModelRedefined", "operationGrantMinting", "authoritySubstitution", "waiverBroadening", "freshnessBroadening", "receiptVerificationBypass", "transportAsAcceptance"];
  if (exactKeys(value.kernelInvariants, invariantKeys, [], `${label}.kernelInvariants`, errors)) {
    for (const key of invariantKeys) if (value.kernelInvariants[key] !== false) errors.push(`${label}.kernelInvariants.${key} must equal false`);
  }

  const workspaceSetLabel = `${label}.workspaceSet`;
  if (exactKeys(value.workspaceSet, ["workspaceSetId", "ownerWorkspaceIdentityIds", "coordinatorWorkspaceIdentityId", "aggregateWriterId", "relationshipIds", "observedAt"], [], workspaceSetLabel, errors)) {
    string(value.workspaceSet.workspaceSetId, `${workspaceSetLabel}.workspaceSetId`, errors, taskIdPattern);
    strings(value.workspaceSet.ownerWorkspaceIdentityIds, `${workspaceSetLabel}.ownerWorkspaceIdentityIds`, errors, { min: 2, pattern: taskIdPattern, unique: true });
    nullableString(value.workspaceSet.coordinatorWorkspaceIdentityId, `${workspaceSetLabel}.coordinatorWorkspaceIdentityId`, errors, taskIdPattern);
    string(value.workspaceSet.aggregateWriterId, `${workspaceSetLabel}.aggregateWriterId`, errors, taskIdPattern);
    strings(value.workspaceSet.relationshipIds, `${workspaceSetLabel}.relationshipIds`, errors, { pattern: taskIdPattern, unique: true });
    dateTime(value.workspaceSet.observedAt, `${workspaceSetLabel}.observedAt`, errors);
  }

  if (!Array.isArray(value.nodes) || value.nodes.length < 2) errors.push(`${label}.nodes must contain at least two nodes`);
  else value.nodes.forEach((node, index) => {
    const nodeLabel = `${label}.nodes[${index}]`;
    if (!exactKeys(node, ["nodeId", "workspaceIdentityId", "workspaceIdentitySchemaVersion", "writerIdentityId", "coreEnvelope", "phaseSlice", "coreReceipt", "state"], [], nodeLabel, errors)) return;
    for (const key of ["nodeId", "workspaceIdentityId", "writerIdentityId"]) string(node[key], `${nodeLabel}.${key}`, errors, taskIdPattern);
    string(node.workspaceIdentitySchemaVersion, `${nodeLabel}.workspaceIdentitySchemaVersion`, errors);
    if (exactKeys(node.coreEnvelope, ["contract", "schemaVersion", "envelopeId", "envelopeRevisionId", "workspaceIdentityId", "subjectId"], [], `${nodeLabel}.coreEnvelope`, errors)) {
      if (node.coreEnvelope.contract !== "task-envelope-v2") errors.push(`${nodeLabel}.coreEnvelope.contract is invalid`);
      string(node.coreEnvelope.schemaVersion, `${nodeLabel}.coreEnvelope.schemaVersion`, errors);
      for (const key of ["envelopeId", "envelopeRevisionId", "workspaceIdentityId", "subjectId"]) string(node.coreEnvelope[key], `${nodeLabel}.coreEnvelope.${key}`, errors, taskIdPattern);
      if (node.coreEnvelope.workspaceIdentityId !== node.workspaceIdentityId) errors.push(`${nodeLabel} Core Envelope must bind the node Workspace Identity`);
    }
    if (exactKeys(node.phaseSlice, ["contract", "schemaVersion", "correlationId", "phaseId", "sliceId", "executionAttemptId"], [], `${nodeLabel}.phaseSlice`, errors)) {
      if (node.phaseSlice.contract !== "phase-slice-correlation-v1") errors.push(`${nodeLabel}.phaseSlice.contract is invalid`);
      string(node.phaseSlice.schemaVersion, `${nodeLabel}.phaseSlice.schemaVersion`, errors);
      for (const key of ["correlationId", "phaseId", "sliceId", "executionAttemptId"]) string(node.phaseSlice[key], `${nodeLabel}.phaseSlice.${key}`, errors, taskIdPattern);
    }
    if (node.coreReceipt !== null) {
      const receiptLabel = `${nodeLabel}.coreReceipt`;
      const receiptKeys = ["contract", "schemaVersion", "receiptId", "workspaceIdentityId", "envelopeId", "envelopeRevisionId", "controlRevisionId", "subjectId", "verificationStatus", "verificationGateResultId", "transportStatus", "coordinatorAcceptance", "coordinatorAcceptanceEvidenceIdentityIds", "observedAt"];
      if (exactKeys(node.coreReceipt, receiptKeys, [], receiptLabel, errors)) {
        if (node.coreReceipt.contract !== "return-receipt-v2") errors.push(`${receiptLabel}.contract is invalid`);
        string(node.coreReceipt.schemaVersion, `${receiptLabel}.schemaVersion`, errors);
        for (const key of ["receiptId", "workspaceIdentityId", "envelopeId", "envelopeRevisionId", "controlRevisionId", "subjectId"]) string(node.coreReceipt[key], `${receiptLabel}.${key}`, errors, taskIdPattern);
        if (!["pending", "verified", "rejected", "stale"].includes(node.coreReceipt.verificationStatus)) errors.push(`${receiptLabel}.verificationStatus is invalid`);
        nullableString(node.coreReceipt.verificationGateResultId, `${receiptLabel}.verificationGateResultId`, errors, taskIdPattern);
        if (!["not_delivered", "delivered", "failed"].includes(node.coreReceipt.transportStatus)) errors.push(`${receiptLabel}.transportStatus is invalid`);
        if (!["pending", "accepted", "rejected", "stale"].includes(node.coreReceipt.coordinatorAcceptance)) errors.push(`${receiptLabel}.coordinatorAcceptance is invalid`);
        strings(node.coreReceipt.coordinatorAcceptanceEvidenceIdentityIds, `${receiptLabel}.coordinatorAcceptanceEvidenceIdentityIds`, errors, { pattern: taskIdPattern, unique: true });
        dateTime(node.coreReceipt.observedAt, `${receiptLabel}.observedAt`, errors);
        if (node.coreReceipt.workspaceIdentityId !== node.workspaceIdentityId
          || node.coreReceipt.envelopeId !== node.coreEnvelope?.envelopeId
          || node.coreReceipt.envelopeRevisionId !== node.coreEnvelope?.envelopeRevisionId
          || node.coreReceipt.subjectId !== node.coreEnvelope?.subjectId) errors.push(`${receiptLabel} must bind the exact node, Envelope revision, and subject`);
        if (node.coreReceipt.verificationStatus === "verified" && !node.coreReceipt.verificationGateResultId) errors.push(`${receiptLabel} verified receipt requires a verification gate result`);
        if (node.coreReceipt.coordinatorAcceptance === "accepted" && (node.coreReceipt.verificationStatus !== "verified" || node.coreReceipt.coordinatorAcceptanceEvidenceIdentityIds.length === 0)) errors.push(`${receiptLabel} coordinator acceptance requires a Core-verified receipt and acceptance evidence`);
      }
    }
    if (!["pending", "ready", "executing", "receipt_pending", "verification_pending", "acceptance_pending", "accepted", "blocked", "failed", "stale"].includes(node.state)) errors.push(`${nodeLabel}.state is invalid`);
    if (node.state === "accepted" && (node.coreReceipt === null || node.coreReceipt.verificationStatus !== "verified" || node.coreReceipt.coordinatorAcceptance !== "accepted")) errors.push(`${nodeLabel} accepted state requires a Core-verified and coordinator-accepted receipt`);
    if (node.coreReceipt?.coordinatorAcceptance === "accepted" && node.state !== "accepted") errors.push(`${nodeLabel} coordinator-accepted receipt requires accepted node state`);
  });

  if (!Array.isArray(value.dependencyEdges)) errors.push(`${label}.dependencyEdges must be an array`);
  else value.dependencyEdges.forEach((edge, index) => {
    const edgeLabel = `${label}.dependencyEdges[${index}]`;
    if (!exactKeys(edge, ["edgeId", "predecessorNodeId", "successorNodeId", "kind", "required", "unlockCondition", "authorityTransfer", "operationGrantTransfer", "receiptSubstitution"], [], edgeLabel, errors)) return;
    for (const key of ["edgeId", "predecessorNodeId", "successorNodeId"]) string(edge[key], `${edgeLabel}.${key}`, errors, taskIdPattern);
    if (!["delivery", "validation", "acceptance", "rollback"].includes(edge.kind)) errors.push(`${edgeLabel}.kind is invalid`);
    if (typeof edge.required !== "boolean") errors.push(`${edgeLabel}.required must be a boolean`);
    if (edge.unlockCondition !== "core-receipt-verified-and-coordinator-accepted") errors.push(`${edgeLabel}.unlockCondition is invalid`);
    for (const key of ["authorityTransfer", "operationGrantTransfer", "receiptSubstitution"]) if (edge[key] !== false) errors.push(`${edgeLabel}.${key} must equal false`);
  });

  if (!Array.isArray(value.phases) || value.phases.length === 0) errors.push(`${label}.phases must be a non-empty array`);
  else value.phases.forEach((phase, index) => {
    const phaseLabel = `${label}.phases[${index}]`;
    const phaseKeys = ["phaseId", "requiredNodeIds", "acceptedNodeIds", "pendingNodeIds", "failedNodeIds", "blockedNodeIds", "staleNodeIds", "state", "aggregateClosureClaim"];
    if (!exactKeys(phase, phaseKeys, [], phaseLabel, errors)) return;
    string(phase.phaseId, `${phaseLabel}.phaseId`, errors, taskIdPattern);
    for (const key of ["requiredNodeIds", "acceptedNodeIds", "pendingNodeIds", "failedNodeIds", "blockedNodeIds", "staleNodeIds"]) strings(phase[key], `${phaseLabel}.${key}`, errors, { min: key === "requiredNodeIds" ? 1 : 0, pattern: taskIdPattern, unique: true });
    if (!["open", "blocked", "closed", "stale"].includes(phase.state)) errors.push(`${phaseLabel}.state is invalid`);
    if (typeof phase.aggregateClosureClaim !== "boolean") errors.push(`${phaseLabel}.aggregateClosureClaim must be a boolean`);
    if (phase.state === "closed" && ((phase.pendingNodeIds?.length ?? 0) > 0 || (phase.failedNodeIds?.length ?? 0) > 0 || (phase.blockedNodeIds?.length ?? 0) > 0 || (phase.staleNodeIds?.length ?? 0) > 0 || phase.aggregateClosureClaim !== true)) errors.push(`${phaseLabel} closed phase requires all nodes accepted and an exact aggregate closure claim`);
    if (phase.state !== "closed" && phase.aggregateClosureClaim !== false) errors.push(`${phaseLabel} non-closed phase cannot claim aggregate closure`);
  });

  const bundle = value.workspaceReceiptBundle;
  const bundleLabel = `${label}.workspaceReceiptBundle`;
  const bundleKeys = ["bundleId", "bundleRevisionId", "predecessorBundleRevisionId", "bundleDigest", "compositionId", "workspaceSetId", "phaseIds", "nodeReceipts", "dependencyStatus", "pendingNodeIds", "failedNodeIds", "blockedNodeIds", "staleNodeIds", "deviationEvidenceIdentityIds", "nextEligibleNodeIds", "state", "observedAt", "immutable"];
  if (exactKeys(bundle, bundleKeys, [], bundleLabel, errors)) {
    for (const key of ["bundleId", "bundleRevisionId", "compositionId", "workspaceSetId"]) string(bundle[key], `${bundleLabel}.${key}`, errors, taskIdPattern);
    nullableString(bundle.predecessorBundleRevisionId, `${bundleLabel}.predecessorBundleRevisionId`, errors, taskIdPattern);
    string(bundle.bundleDigest, `${bundleLabel}.bundleDigest`, errors, digestPattern);
    strings(bundle.phaseIds, `${bundleLabel}.phaseIds`, errors, { min: 1, pattern: taskIdPattern, unique: true });
    if (!Array.isArray(bundle.nodeReceipts)) errors.push(`${bundleLabel}.nodeReceipts must be an array`);
    else bundle.nodeReceipts.forEach((receipt, index) => {
      const receiptLabel = `${bundleLabel}.nodeReceipts[${index}]`;
      if (!exactKeys(receipt, ["nodeId", "receiptId", "verificationStatus", "coordinatorAcceptance"], [], receiptLabel, errors)) return;
      string(receipt.nodeId, `${receiptLabel}.nodeId`, errors, taskIdPattern);
      string(receipt.receiptId, `${receiptLabel}.receiptId`, errors, taskIdPattern);
      if (receipt.verificationStatus !== "verified" || receipt.coordinatorAcceptance !== "accepted") errors.push(`${receiptLabel} must reference a Core-verified and coordinator-accepted receipt`);
    });
    if (!Array.isArray(bundle.dependencyStatus)) errors.push(`${bundleLabel}.dependencyStatus must be an array`);
    else bundle.dependencyStatus.forEach((status, index) => {
      const statusLabel = `${bundleLabel}.dependencyStatus[${index}]`;
      if (!exactKeys(status, ["edgeId", "status", "evidenceIdentityIds"], [], statusLabel, errors)) return;
      string(status.edgeId, `${statusLabel}.edgeId`, errors, taskIdPattern);
      if (!["locked", "unlocked", "blocked", "stale"].includes(status.status)) errors.push(`${statusLabel}.status is invalid`);
      strings(status.evidenceIdentityIds, `${statusLabel}.evidenceIdentityIds`, errors, { pattern: taskIdPattern, unique: true });
    });
    for (const key of ["pendingNodeIds", "failedNodeIds", "blockedNodeIds", "staleNodeIds", "deviationEvidenceIdentityIds", "nextEligibleNodeIds"]) strings(bundle[key], `${bundleLabel}.${key}`, errors, { pattern: taskIdPattern, unique: true });
    if (!["assembling", "review_required", "accepted", "blocked", "stale"].includes(bundle.state)) errors.push(`${bundleLabel}.state is invalid`);
    dateTime(bundle.observedAt, `${bundleLabel}.observedAt`, errors);
    if (bundle.immutable !== true) errors.push(`${bundleLabel}.immutable must equal true`);
    if (bundle.compositionId !== value.compositionId || bundle.workspaceSetId !== value.workspaceSet?.workspaceSetId) errors.push(`${bundleLabel} must bind the exact composition and Workspace Set`);
    if (bundle.predecessorBundleRevisionId === bundle.bundleRevisionId) errors.push(`${bundleLabel} cannot be its own predecessor`);
  }

  const nodes = value.nodes ?? [];
  const nodeIds = nodes.map((node) => node.nodeId);
  const nodeMap = new Map(nodes.map((node) => [node.nodeId, node]));
  if (new Set(nodeIds).size !== nodeIds.length) errors.push(`${label}.nodes contains duplicate node ids`);
  const nodeWorkspaceIds = [...new Set(nodes.map((node) => node.workspaceIdentityId))];
  if (!sameStringSet(nodeWorkspaceIds, value.workspaceSet?.ownerWorkspaceIdentityIds ?? [])) errors.push(`${label} Workspace Set must exactly match node owner Workspace Identities`);

  if (value.coreCompatibility?.status === "compatible") {
    for (const node of nodes) {
      if (!value.coreCompatibility.workspaceIdentityVersions.includes(node.workspaceIdentitySchemaVersion)) errors.push(`${label} node uses an unsupported Workspace Identity version: ${node.nodeId}`);
      if (!value.coreCompatibility.taskEnvelopeVersions.includes(node.coreEnvelope?.schemaVersion)) errors.push(`${label} node uses an unsupported Task Envelope version: ${node.nodeId}`);
      if (!value.coreCompatibility.phaseSliceCorrelationVersions.includes(node.phaseSlice?.schemaVersion)) errors.push(`${label} node uses an unsupported Phase/Slice version: ${node.nodeId}`);
      if (node.coreReceipt && !value.coreCompatibility.returnReceiptVersions.includes(node.coreReceipt.schemaVersion)) errors.push(`${label} node uses an unsupported Return Receipt version: ${node.nodeId}`);
    }
  }
  if (nodes.some((node) => node.state === "accepted") && value.coreCompatibility?.status !== "compatible") errors.push(`${label} accepted nodes require compatible Core contract versions`);

  const edges = value.dependencyEdges ?? [];
  const edgeIds = edges.map((edge) => edge.edgeId);
  if (new Set(edgeIds).size !== edgeIds.length) errors.push(`${label}.dependencyEdges contains duplicate edge ids`);
  for (const edge of edges) {
    if (!nodeMap.has(edge.predecessorNodeId) || !nodeMap.has(edge.successorNodeId)) errors.push(`${label} dependency edge references an unknown node: ${edge.edgeId}`);
    if (edge.predecessorNodeId === edge.successorNodeId) errors.push(`${label} dependency edge cannot be self-referential: ${edge.edgeId}`);
  }
  const predecessors = new Map(nodeIds.map((nodeId) => [nodeId, []]));
  for (const edge of edges) predecessors.get(edge.successorNodeId)?.push(edge.predecessorNodeId);
  const dependsOn = (nodeId, targetId, seen = new Set()) => {
    if (seen.has(nodeId)) return false;
    seen.add(nodeId);
    const direct = predecessors.get(nodeId) ?? [];
    return direct.includes(targetId) || direct.some((predecessor) => dependsOn(predecessor, targetId, seen));
  };
  for (const nodeId of nodeIds) if (dependsOn(nodeId, nodeId)) errors.push(`${label} dependency graph contains a cycle at node: ${nodeId}`);
  const writers = new Map();
  for (const node of nodes) {
    const prior = writers.get(node.writerIdentityId) ?? [];
    for (const priorNodeId of prior) if (!dependsOn(node.nodeId, priorNodeId) && !dependsOn(priorNodeId, node.nodeId)) errors.push(`${label} concurrent nodes cannot share writer identity: ${node.writerIdentityId}`);
    prior.push(node.nodeId);
    writers.set(node.writerIdentityId, prior);
  }

  const phases = value.phases ?? [];
  const phaseIds = phases.map((phase) => phase.phaseId);
  if (new Set(phaseIds).size !== phaseIds.length) errors.push(`${label}.phases contains duplicate phase ids`);
  for (const phase of phases) {
    const partitions = [phase.acceptedNodeIds ?? [], phase.pendingNodeIds ?? [], phase.failedNodeIds ?? [], phase.blockedNodeIds ?? [], phase.staleNodeIds ?? []];
    const partitioned = partitions.flat();
    if (new Set(partitioned).size !== partitioned.length) errors.push(`${label} phase partitions overlap: ${phase.phaseId}`);
    if (!sameStringSet(partitioned, phase.requiredNodeIds ?? [])) errors.push(`${label} phase partitions must exactly cover required nodes: ${phase.phaseId}`);
    for (const nodeId of phase.requiredNodeIds ?? []) {
      const node = nodeMap.get(nodeId);
      if (!node) errors.push(`${label} phase references unknown node: ${nodeId}`);
      else if (node.phaseSlice?.phaseId !== phase.phaseId) errors.push(`${label} node phase identity does not match aggregation: ${nodeId}`);
    }
    const expectedAccepted = (phase.requiredNodeIds ?? []).filter((nodeId) => nodeMap.get(nodeId)?.state === "accepted");
    if (!sameStringSet(expectedAccepted, phase.acceptedNodeIds ?? [])) errors.push(`${label} phase accepted nodes must match accepted Core receipts: ${phase.phaseId}`);
    const expectedFailed = (phase.requiredNodeIds ?? []).filter((nodeId) => nodeMap.get(nodeId)?.state === "failed");
    if (!sameStringSet(expectedFailed, phase.failedNodeIds ?? [])) errors.push(`${label} phase failed nodes must match node state: ${phase.phaseId}`);
    const expectedBlocked = (phase.requiredNodeIds ?? []).filter((nodeId) => nodeMap.get(nodeId)?.state === "blocked");
    if (!sameStringSet(expectedBlocked, phase.blockedNodeIds ?? [])) errors.push(`${label} phase blocked nodes must match node state: ${phase.phaseId}`);
    const expectedStale = (phase.requiredNodeIds ?? []).filter((nodeId) => nodeMap.get(nodeId)?.state === "stale");
    if (!sameStringSet(expectedStale, phase.staleNodeIds ?? [])) errors.push(`${label} phase stale nodes must match node state: ${phase.phaseId}`);
    const expectedPending = (phase.requiredNodeIds ?? []).filter((nodeId) => !["accepted", "failed", "blocked", "stale"].includes(nodeMap.get(nodeId)?.state));
    if (!sameStringSet(expectedPending, phase.pendingNodeIds ?? [])) errors.push(`${label} phase pending nodes must match unresolved node state: ${phase.phaseId}`);
  }
  for (const node of nodes) if (!phases.some((phase) => phase.requiredNodeIds?.includes(node.nodeId))) errors.push(`${label} node is missing from phase aggregation: ${node.nodeId}`);

  if (bundle) {
    if (!sameStringSet(bundle.phaseIds ?? [], phaseIds)) errors.push(`${bundleLabel}.phaseIds must exactly match the composition phases`);
    const bundleNodeSets = [bundle.pendingNodeIds ?? [], bundle.failedNodeIds ?? [], bundle.blockedNodeIds ?? [], bundle.staleNodeIds ?? []];
    const bundleNonAccepted = bundleNodeSets.flat();
    if (new Set(bundleNonAccepted).size !== bundleNonAccepted.length) errors.push(`${bundleLabel} node state lists overlap`);
    for (const nodeId of [...bundleNonAccepted, ...(bundle.nextEligibleNodeIds ?? [])]) if (!nodeMap.has(nodeId)) errors.push(`${bundleLabel} references unknown node: ${nodeId}`);
    const receiptNodeIds = bundle.nodeReceipts?.map((receipt) => receipt.nodeId) ?? [];
    if (new Set(receiptNodeIds).size !== receiptNodeIds.length) errors.push(`${bundleLabel}.nodeReceipts contains duplicate node ids`);
    const acceptedNodeIds = nodes.filter((node) => node.state === "accepted").map((node) => node.nodeId);
    const failedNodeIds = nodes.filter((node) => node.state === "failed").map((node) => node.nodeId);
    const blockedNodeIds = nodes.filter((node) => node.state === "blocked").map((node) => node.nodeId);
    const staleNodeIds = nodes.filter((node) => node.state === "stale").map((node) => node.nodeId);
    const pendingNodeIds = nodes.filter((node) => !["accepted", "failed", "blocked", "stale"].includes(node.state)).map((node) => node.nodeId);
    if (!sameStringSet(bundle.failedNodeIds ?? [], failedNodeIds)) errors.push(`${bundleLabel}.failedNodeIds must match node state`);
    if (!sameStringSet(bundle.blockedNodeIds ?? [], blockedNodeIds)) errors.push(`${bundleLabel}.blockedNodeIds must match node state`);
    if (!sameStringSet(bundle.staleNodeIds ?? [], staleNodeIds)) errors.push(`${bundleLabel}.staleNodeIds must match node state`);
    if (!sameStringSet(bundle.pendingNodeIds ?? [], pendingNodeIds)) errors.push(`${bundleLabel}.pendingNodeIds must match unresolved node state`);
    if (!sameStringSet(receiptNodeIds, acceptedNodeIds)) errors.push(`${bundleLabel}.nodeReceipts must exactly preserve accepted node receipts`);
    for (const receipt of bundle.nodeReceipts ?? []) {
      const node = nodeMap.get(receipt.nodeId);
      if (!node || node.coreReceipt?.receiptId !== receipt.receiptId || node.coreReceipt?.verificationStatus !== "verified" || node.coreReceipt?.coordinatorAcceptance !== "accepted") errors.push(`${bundleLabel} node receipt does not match a Core-verified accepted node: ${receipt.nodeId}`);
    }
    const bundleEdgeIds = bundle.dependencyStatus?.map((status) => status.edgeId) ?? [];
    if (!sameStringSet(bundleEdgeIds, edgeIds)) errors.push(`${bundleLabel}.dependencyStatus must exactly cover dependency edges`);
    for (const status of bundle.dependencyStatus ?? []) {
      const edge = edges.find((candidate) => candidate.edgeId === status.edgeId);
      if (!edge) continue;
      const predecessorAccepted = nodeMap.get(edge.predecessorNodeId)?.state === "accepted";
      if (status.status === "unlocked" && (!predecessorAccepted || status.evidenceIdentityIds.length === 0)) errors.push(`${bundleLabel} dependency cannot unlock without an accepted predecessor and evidence: ${status.edgeId}`);
      if (edge.required && predecessorAccepted && status.status !== "unlocked") errors.push(`${bundleLabel} accepted predecessor must unlock the required dependency: ${status.edgeId}`);
    }
    if (bundle.state === "accepted") {
      if (value.coreCompatibility?.status !== "compatible"
        || acceptedNodeIds.length !== nodes.length
        || phases.some((phase) => phase.state !== "closed")
        || (bundle.pendingNodeIds?.length ?? 0) > 0
        || (bundle.failedNodeIds?.length ?? 0) > 0
        || (bundle.blockedNodeIds?.length ?? 0) > 0
        || (bundle.staleNodeIds?.length ?? 0) > 0
        || (bundle.deviationEvidenceIdentityIds?.length ?? 0) > 0) errors.push(`${bundleLabel} accepted state requires compatible Core contracts, all phases closed, all nodes accepted, and no unresolved state`);
    }
  }
  dateTime(value.declaredAt, `${label}.declaredAt`, errors);
}

export function validateContract(type, payload) {
  const errors = [];
  if (!contractTypes.includes(type)) return { valid: false, errors: [`unknown contract type: ${type}`] };
  ({
    pack: validatePack,
    profile: validateProfile,
    "profile-candidate": validateProfileCandidate,
    envelope: validateEnvelope,
    launch: validateLaunch,
    receipt: validateReceipt,
    "host-adapter": validateHostAdapter,
    "adoption-plan": validateAdoptionPlan,
    "binding-receipt": validateBindingReceipt,
    "cross-workspace-pack-composition": validateCrossWorkspacePackComposition,
    "workspace-identity": validateWorkspaceIdentity,
    "workspace-relationship": validateWorkspaceRelationship,
    "limited-reason": validateLimitedReason,
    "governance-source": validateGovernanceSource,
    "source-dependency-edge": validateSourceDependencyEdge,
    "rule-claim": validateRuleClaim,
    "effective-profile-v2": validateEffectiveProfileV2,
    "profile-explanation": validateProfileExplanation,
    "entry-mode": validateEntryMode,
    "phase-slice-correlation": validatePhaseSliceCorrelation,
    "operation-authority-requirement": validateOperationAuthorityRequirement,
    "evidence-identity": validateEvidenceIdentity,
    "task-envelope-v2": validateControlTaskEnvelope,
    "operation-grant": validateOperationGrant,
    "gate-result": validateGateResult,
    "task-control-revision": validateControlRevision,
    "return-receipt-v2": validateReturnReceiptV2,
    "rollback-envelope-lineage": validateRollbackEnvelopeLineage,
    "review-authority-requirement": validateReviewAuthorityRequirement,
    "authority-evidence": validateAuthorityEvidence,
    "validation-topology": validateValidationTopology,
    "validation-result": validateValidationResult,
    "execution-context-identity": validateExecutionContextIdentity,
    "host-adapter-observation": validateHostAdapterObservation,
    "provider-adapter-observation": validateProviderAdapterObservation
  })[type](payload, errors);
  return { valid: errors.length === 0, errors };
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
