import { readFileSync } from "node:fs";

export const contractTypes = ["pack", "profile", "profile-candidate", "envelope", "launch", "receipt"];

const packStates = ["available", "recommended", "enabled", "required", "blocked", "disabled"];
const idPattern = /^[a-z][a-z0-9-]+$/;
const ruleIdPattern = /^[a-z][a-z0-9.-]+$/;
const taskIdPattern = /^[a-zA-Z0-9._:-]+$/;
const commitPattern = /^[0-9a-f]{40}$/;

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
  const enabled = new Set((value.packs ?? []).filter((item) => ["enabled", "required"].includes(item.state)).map((item) => item.id));
  for (const pack of value.packs ?? []) {
    if (!["enabled", "required"].includes(pack.state)) continue;
    if (pack.id === "agent-workflow-governance" && enabled.has("forgerail-core")) errors.push("profile has duplicate core workflow owners");
  }
}

function validateEnvelope(value, errors, label = "envelope") {
  const keys = ["schemaVersion", "taskId", "intent", "nonGoals", "ownerWorkspace", "allowedOperations", "prohibitedOperations", "packs", "approvalGates", "validation", "returnContract"];
  if (!exactKeys(value, keys, [], label, errors)) return;
  schemaVersion(value.schemaVersion, label, errors);
  string(value.taskId, `${label}.taskId`, errors, taskIdPattern);
  string(value.intent, `${label}.intent`, errors);
  strings(value.nonGoals, `${label}.nonGoals`, errors);
  string(value.ownerWorkspace, `${label}.ownerWorkspace`, errors);
  strings(value.allowedOperations, `${label}.allowedOperations`, errors, { unique: true });
  strings(value.prohibitedOperations, `${label}.prohibitedOperations`, errors, { unique: true });
  strings(value.packs, `${label}.packs`, errors, { pattern: idPattern, unique: true });
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
  if (!exactKeys(value, ["schemaVersion", "envelope", "effectiveRuleSources", "hostAgent", "executionOwner"], [], "launch", errors)) return;
  schemaVersion(value.schemaVersion, "launch", errors);
  validateEnvelope(value.envelope, errors, "launch.envelope");
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

export function validateContract(type, payload) {
  const errors = [];
  if (!contractTypes.includes(type)) return { valid: false, errors: [`unknown contract type: ${type}`] };
  ({ pack: validatePack, profile: validateProfile, "profile-candidate": validateProfileCandidate, envelope: validateEnvelope, launch: validateLaunch, receipt: validateReceipt })[type](payload, errors);
  return { valid: errors.length === 0, errors };
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
