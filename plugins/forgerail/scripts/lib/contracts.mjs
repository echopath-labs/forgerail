import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const contractTypes = ["pack", "profile", "profile-candidate", "envelope", "launch", "receipt", "host-adapter", "adoption-plan", "binding-receipt"];

const packStates = ["available", "recommended", "enabled", "required", "blocked", "disabled"];
const idPattern = /^[a-z][a-z0-9-]+$/;
const ruleIdPattern = /^[a-z][a-z0-9.-]+$/;
const taskIdPattern = /^[a-zA-Z0-9._:-]+$/;
const commitPattern = /^[0-9a-f]{40}$/;
const digestPattern = /^[0-9a-f]{64}$/;

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

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
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

function validateHostAdapter(value, errors) {
  const keys = ["schemaVersion", "id", "displayName", "status", "instructionDiscovery", "skillDiscovery", "bindingTarget", "bindingModes", "managedMarker", "activationBoundary", "verification", "limitations"];
  if (!exactKeys(value, keys, [], "hostAdapter", errors)) return;
  schemaVersion(value.schemaVersion, "hostAdapter", errors);
  string(value.id, "hostAdapter.id", errors, idPattern);
  string(value.displayName, "hostAdapter.displayName", errors);
  if (!["supported", "profile-only"].includes(value.status)) errors.push("hostAdapter.status is invalid");
  if (!["task-start", "rules", "explicit-only", "unknown"].includes(value.instructionDiscovery)) errors.push("hostAdapter.instructionDiscovery is invalid");
  if (!["agent-plugin-skills", "agent-skills", "explicit-only", "unknown"].includes(value.skillDiscovery)) errors.push("hostAdapter.skillDiscovery is invalid");
  string(value.bindingTarget, "hostAdapter.bindingTarget", errors, /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$)).+$/);
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
    string(host.bindingTarget, `${label}.bindingTarget`, errors, /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$)).+$/);
    if (!["new-task-discovery", "profile-only"].includes(host.verificationMode)) errors.push(`${label}.verificationMode is invalid`);
    if (host.status === "supported" && host.verificationMode !== "new-task-discovery") errors.push(`${label} supported host must use new-task-discovery`);
    if (host.status === "profile-only" && host.verificationMode !== "profile-only") errors.push(`${label} profile-only host must not claim verified discovery`);
  });
  const hostIds = value.hosts?.map((host) => host.adapterId) ?? [];
  if (new Set(hostIds).size !== hostIds.length) errors.push("adoptionPlan.hosts contains duplicate adapter ids");
  if (!Array.isArray(value.proposedWrites)) errors.push("adoptionPlan.proposedWrites must be an array");
  else value.proposedWrites.forEach((write, index) => {
    const label = `adoptionPlan.proposedWrites[${index}]`;
    if (!exactKeys(write, ["path", "operation", "baseSha256", "contentSha256", "content", "managedMarker"], [], label, errors)) return;
    string(write.path, `${label}.path`, errors, /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$)).+$/);
    if (!["create", "append-managed-block", "replace-managed-block"].includes(write.operation)) errors.push(`${label}.operation is invalid`);
    nullableString(write.baseSha256, `${label}.baseSha256`, errors, digestPattern);
    string(write.contentSha256, `${label}.contentSha256`, errors, digestPattern);
    string(write.content, `${label}.content`, errors);
    string(write.managedMarker, `${label}.managedMarker`, errors, /^forgerail:(?:binding:[a-z][a-z0-9-]+|adoption-contract):v1$/);
    if (typeof write.content === "string" && write.contentSha256 !== sha256(write.content)) errors.push(`${label}.contentSha256 does not match content`);
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

export function validateContract(type, payload) {
  const errors = [];
  if (!contractTypes.includes(type)) return { valid: false, errors: [`unknown contract type: ${type}`] };
  ({ pack: validatePack, profile: validateProfile, "profile-candidate": validateProfileCandidate, envelope: validateEnvelope, launch: validateLaunch, receipt: validateReceipt, "host-adapter": validateHostAdapter, "adoption-plan": validateAdoptionPlan, "binding-receipt": validateBindingReceipt })[type](payload, errors);
  return { valid: errors.length === 0, errors };
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
