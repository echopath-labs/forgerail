#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadHostAdapters, planAdoption } from "./lib/adoption.mjs";
import { buildBundle } from "./lib/bundle.mjs";
import { createLaunchContract, resolveProfile, verifyReceipt } from "./lib/composition.mjs";
import { contractSchemaNames, contractTypes, readJson, validateContract } from "./lib/contracts.mjs";
import { diagnoseWorkspace } from "./lib/diagnosis.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function fail(message) { console.error(`forgerail: ${message}`); process.exit(1); }
function emit(value) { console.log(JSON.stringify(value, null, 2)); }
function arg(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function args(name) {
  const values = [];
  process.argv.forEach((value, index) => { if (value === name && process.argv[index + 1]) values.push(process.argv[index + 1]); });
  return values;
}

function collectSchemaRefs(value, refs = []) {
  if (Array.isArray(value)) value.forEach((item) => collectSchemaRefs(item, refs));
  else if (value && typeof value === "object") {
    if (typeof value.$ref === "string") refs.push(value.$ref);
    Object.values(value).forEach((item) => collectSchemaRefs(item, refs));
  }
  return refs;
}

function sameMembers(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length && expected.every((item) => actual.includes(item));
}

function validateEffectiveProfileV2Schema(schema, errors) {
  const assertions = [];
  const rules = Array.isArray(schema?.allOf) ? schema.allOf : [];
  const nonAvailable = ["unavailable", "ambiguous", "unverified"];
  const completeRule = rules.find((rule) => rule.if?.properties?.completeness?.const === "complete");
  const completeClaims = completeRule?.then?.properties?.ruleClaims?.not?.contains;
  if (completeClaims?.properties?.enforcement?.const === "unresolved" && completeClaims.required?.includes("enforcement")) assertions.push("complete_excludes_unresolved_claim");
  else errors.push("effective-profile-v2 schema must natively exclude unresolved claims from complete Profiles");
  const completeDependencies = completeRule?.then?.properties?.dependencyEdges?.not?.contains;
  if (sameMembers(completeDependencies?.properties?.observationStatus?.enum, nonAvailable) && completeDependencies.required?.includes("observationStatus")) assertions.push("complete_excludes_non_available_dependency");
  else errors.push("effective-profile-v2 schema must natively exclude non-available dependencies from complete Profiles");

  const unresolvedClaimRule = rules.find((rule) => rule.if?.properties?.ruleClaims?.contains?.properties?.enforcement?.const === "unresolved");
  if (unresolvedClaimRule?.if?.properties?.ruleClaims?.contains?.required?.includes("enforcement") && unresolvedClaimRule?.then?.properties?.completeness?.const === "unresolved") assertions.push("unresolved_claim_forces_unresolved_profile");
  else errors.push("effective-profile-v2 schema must natively require unresolved completeness for unresolved claims");

  const requiredDependencyRule = rules.find((rule) => {
    const clauses = rule.if?.properties?.dependencyEdges?.contains?.allOf;
    return Array.isArray(clauses)
      && clauses.some((clause) => clause.properties?.requiredness?.const === "required" && clause.required?.includes("requiredness"))
      && clauses.some((clause) => sameMembers(clause.properties?.observationStatus?.enum, nonAvailable) && clause.required?.includes("observationStatus"));
  });
  if (requiredDependencyRule?.then?.properties?.completeness?.const === "unresolved") {
    assertions.push("required_non_available_dependency_forces_unresolved_profile");
    assertions.push("optional_non_available_dependency_may_remain_degraded");
  } else errors.push("effective-profile-v2 schema must natively require unresolved completeness only for required non-available dependencies");

  const conflictRule = rules.find((rule) => rule.if?.properties?.conflicts?.minItems === 1);
  if (conflictRule?.then?.properties?.completeness?.const === "unresolved") assertions.push("conflict_forces_unresolved_profile");
  else errors.push("effective-profile-v2 schema must natively require unresolved completeness for non-empty conflicts");
  return assertions;
}

function validateTaskControlSchemas(schemas, errors) {
  const assertions = [];
  const byType = new Map(schemas.map(({ type, schema }) => [type, schema]));
  const envelope = byType.get("task-envelope-v2");
  if (envelope?.properties?.entryMode?.$ref === "https://forgerail.dev/schemas/entry-mode-v1.json"
    && envelope?.properties?.phaseSliceCorrelation?.$ref === "https://forgerail.dev/schemas/phase-slice-correlation-v1.json"
    && envelope?.properties?.returnContract?.const === "return-receipt-v2") assertions.push("envelope_binds_entry_slice_and_receipt_version");
  else errors.push("task-envelope-v2 schema must bind versioned entry mode, phase/slice correlation, and Return Receipt v2");

  const grant = byType.get("operation-grant");
  const grantRequired = grant?.required ?? [];
  const currentRule = grant?.allOf?.find((rule) => rule.if?.properties?.status?.const === "current");
  if (["grantDigest", "authorityRequirementId", "workspaceIdentityId", "envelopeRevisionId", "executorId", "operation", "target", "subjectId", "scope", "issuerEvidenceId", "expiresAt"].every((key) => grantRequired.includes(key))
    && currentRule?.then?.properties?.invalidatedAt?.const === null) assertions.push("grant_binds_exact_authority_and_current_state");
  else errors.push("operation-grant-v1 schema must bind exact authority fields and exclude invalidation from current grants");

  const controlRevision = byType.get("task-control-revision");
  const closedRule = controlRevision?.allOf?.find((rule) => rule.if?.properties?.state?.const === "closed");
  if (controlRevision?.properties?.entryMode?.$ref === "https://forgerail.dev/schemas/entry-mode-v1.json"
    && controlRevision?.properties?.phaseSliceCorrelation?.$ref === "https://forgerail.dev/schemas/phase-slice-correlation-v1.json"
    && closedRule?.then?.properties?.returnReceiptId?.type === "string"
    && closedRule?.then?.properties?.deviationEvidenceIds?.maxItems === 0) assertions.push("closed_revision_requires_receipt_without_deviation");
  else errors.push("task-control-revision-v1 schema must bind entry/slice identity and require a deviation-free receipt for closure");

  const receipt = byType.get("return-receipt-v2");
  const completeRule = receipt?.allOf?.find((rule) => rule.if?.properties?.closeout?.const === "complete");
  if (receipt?.properties?.phaseSliceCorrelation?.$ref === "https://forgerail.dev/schemas/phase-slice-correlation-v1.json"
    && completeRule?.then?.properties?.claimStatus?.const === "verified"
    && completeRule?.then?.properties?.deviations?.maxItems === 0) assertions.push("complete_receipt_requires_verification_without_deviation");
  else errors.push("return-receipt-v2 schema must require verified, deviation-free exact-slice closure");

  const rollback = byType.get("rollback-envelope-lineage");
  const verifiedRule = rollback?.allOf?.find((rule) => rule.if?.properties?.state?.const === "verified");
  if (rollback?.properties?.forwardEnvelope?.$ref === "#/$defs/envelopeReference"
    && rollback?.properties?.rollbackEnvelope?.$ref === "#/$defs/envelopeReference"
    && verifiedRule?.then?.properties?.validationGateResultIds?.minItems === 1
    && verifiedRule?.then?.properties?.rollbackReceiptId?.type === "string") assertions.push("rollback_lineage_requires_new_control_evidence");
  else errors.push("rollback-envelope-lineage-v1 schema must separate Envelope references and require rollback verification evidence");
  return assertions;
}

function validateTask27Schemas(schemas, errors) {
  const assertions = [];
  const byType = new Map(schemas.map(({ type, schema }) => [type, schema]));

  const limitedReason = byType.get("limited-reason");
  if ((limitedReason?.properties?.code?.enum?.length ?? 0) >= 10
    && limitedReason?.properties?.sanitized?.const === true
    && limitedReason?.properties?.summary?.maxLength === 500) assertions.push("limited_reason_is_bounded_and_sanitized");
  else errors.push("limited-reason-v1 schema must bound reason codes, summary exposure, and sanitization");

  const reviewRequirement = byType.get("review-authority-requirement");
  const noSubstitutionRule = reviewRequirement?.allOf?.find((rule) => rule.if?.properties?.substitutionPolicy?.properties?.mode?.const === "none");
  if (reviewRequirement?.properties?.quorum?.properties?.minimumCount?.minimum === 1
    && reviewRequirement?.properties?.ownerCoverage?.properties?.surfaceIds
    && noSubstitutionRule?.then?.properties?.substitutionPolicy?.properties?.equivalenceEdges?.maxItems === 0) assertions.push("review_authority_binds_quorum_owner_and_non_substitution");
  else errors.push("review-authority-requirement-v1 schema must bind quorum, owner coverage, and default non-substitution");

  const authorityEvidence = byType.get("authority-evidence");
  const currentEvidenceRule = authorityEvidence?.allOf?.find((rule) => rule.if?.properties?.lifecycle?.const === "current");
  const lifecycle = authorityEvidence?.properties?.lifecycle?.enum ?? [];
  if (["current", "stale", "revoked", "dismissed", "expired", "superseded"].every((state) => lifecycle.includes(state))
    && currentEvidenceRule?.then?.properties?.limitedReason?.const === null) assertions.push("authority_evidence_lifecycle_is_explicit_and_current_only");
  else errors.push("authority-evidence-v1 schema must expose the complete lifecycle and exclude invalidation from current evidence");

  const topology = byType.get("validation-topology");
  if (topology?.properties?.changedSurfaces?.items?.properties?.validationRequirementIds
    && topology?.properties?.validationRequirements?.items?.properties?.prerequisiteDependencyEdgeIds
    && topology?.properties?.validationRequirements?.items?.properties?.acceptedTrustClasses
    && topology?.properties?.validationRequirements?.items?.properties?.expectedResults) assertions.push("validation_topology_links_surface_dependency_trust_and_expected_result");
  else errors.push("validation-topology-v1 schema must link changed surfaces to prerequisites, trust, and expected results");

  const validationResult = byType.get("validation-result");
  const resultStates = validationResult?.properties?.status?.enum ?? [];
  const passedRule = validationResult?.allOf?.find((rule) => rule.if?.properties?.status?.const === "passed");
  if (["passed", "failed", "blocked", "unavailable", "not_applicable", "not_selected", "waived"].every((state) => resultStates.includes(state))
    && passedRule?.then?.properties?.evidenceIdentityIds?.minItems === 1
    && passedRule?.then?.properties?.limitedReason?.const === null) assertions.push("validation_result_taxonomy_preserves_evidence_and_truthful_pass");
  else errors.push("validation-result-v1 schema must expose the complete taxonomy and require evidence for passed results");

  const executionContext = byType.get("execution-context-identity");
  const dependency = executionContext?.properties?.dependencies?.items;
  if (executionContext?.properties?.entrypoint
    && executionContext?.properties?.invocationRoot
    && executionContext?.properties?.runner?.properties?.trustClass
    && dependency?.properties?.boundary
    && dependency?.properties?.limitedReason) assertions.push("execution_context_binds_entrypoint_runner_and_external_dependencies");
  else errors.push("execution-context-identity-v1 schema must bind entrypoint, runner trust, and external dependencies");

  const hostObservation = byType.get("host-adapter-observation");
  if (hostObservation?.properties?.authorizationClaim?.const === false
    && hostObservation?.properties?.capabilities?.items?.$ref === "#/$defs/capabilityObservation"
    && hostObservation?.$defs?.capabilityObservation?.properties?.state?.enum?.includes("profile-only")) assertions.push("host_observation_separates_capability_from_authority");
  else errors.push("host-adapter-observation-v1 schema must separate capability observation from authorization");

  const providerObservation = byType.get("provider-adapter-observation");
  const identityStates = providerObservation?.properties?.identity?.properties?.state?.enum ?? [];
  if (providerObservation?.properties?.authorizationClaim?.const === false
    && ["authenticated", "unauthenticated", "unverified", "unavailable", "not-required"].every((state) => identityStates.includes(state))
    && providerObservation?.properties?.capabilities?.items?.properties?.requiresIdentity) assertions.push("provider_observation_separates_identity_capability_and_authority");
  else errors.push("provider-adapter-observation-v1 schema must separate identity, capability, and authorization");
  return assertions;
}

function validateTask28Schemas(schemas, errors) {
  const assertions = [];
  const composition = schemas.find(({ type }) => type === "cross-workspace-pack-composition")?.schema;
  const compatibility = composition?.$defs?.coreCompatibility;
  const node = composition?.$defs?.node;
  if (compatibility?.properties?.workspaceIdentityVersions?.minItems === 1
    && compatibility?.properties?.taskEnvelopeVersions?.minItems === 1
    && compatibility?.properties?.returnReceiptVersions?.minItems === 1
    && compatibility?.properties?.phaseSliceCorrelationVersions?.minItems === 1
    && node?.properties?.workspaceIdentitySchemaVersion
    && node?.properties?.coreEnvelope?.$ref === "#/$defs/coreEnvelopeReference") assertions.push("pack_composition_declares_version_compatible_core_contracts");
  else errors.push("cross-workspace-pack-composition-v1 must declare version compatibility for every referenced Core contract");

  const invariants = composition?.$defs?.kernelInvariants?.properties ?? {};
  const dependency = composition?.$defs?.dependencyEdge?.properties ?? {};
  if (["stateModelRedefined", "operationGrantMinting", "authoritySubstitution", "waiverBroadening", "freshnessBroadening", "receiptVerificationBypass", "transportAsAcceptance"].every((key) => invariants[key]?.const === false)
    && dependency.authorityTransfer?.const === false
    && dependency.operationGrantTransfer?.const === false
    && dependency.receiptSubstitution?.const === false) assertions.push("pack_composition_cannot_override_kernel_or_transfer_authority");
  else errors.push("cross-workspace-pack-composition-v1 must prohibit Kernel overrides and cross-node authority transfer");

  const receipt = composition?.$defs?.coreReceiptReference?.anyOf?.find((item) => item.type === "object");
  const acceptedReceiptRule = receipt?.allOf?.find((rule) => rule.if?.properties?.coordinatorAcceptance?.const === "accepted");
  if (receipt?.properties?.verificationStatus
    && receipt?.properties?.transportStatus
    && receipt?.properties?.coordinatorAcceptance
    && acceptedReceiptRule?.then?.properties?.verificationStatus?.const === "verified"
    && acceptedReceiptRule?.then?.properties?.coordinatorAcceptanceEvidenceIdentityIds?.minItems === 1) assertions.push("core_verification_transport_and_acceptance_remain_independent");
  else errors.push("cross-workspace-pack-composition-v1 must separate Core verification, transport, and coordinator acceptance");

  const phase = composition?.$defs?.phaseAggregation;
  const closedPhaseRule = phase?.allOf?.find((rule) => rule.if?.properties?.state?.const === "closed");
  const bundle = composition?.$defs?.workspaceReceiptBundle;
  const acceptedBundleRule = bundle?.allOf?.find((rule) => rule.if?.properties?.state?.const === "accepted");
  if (closedPhaseRule?.then?.properties?.aggregateClosureClaim?.const === true
    && ["pendingNodeIds", "failedNodeIds", "blockedNodeIds", "staleNodeIds"].every((key) => closedPhaseRule?.then?.properties?.[key]?.maxItems === 0)
    && bundle?.properties?.immutable?.const === true
    && ["pendingNodeIds", "failedNodeIds", "blockedNodeIds", "staleNodeIds"].every((key) => acceptedBundleRule?.then?.properties?.[key]?.maxItems === 0)
    && acceptedBundleRule?.then?.properties?.deviationEvidenceIdentityIds?.maxItems === 0) assertions.push("phase_and_workspace_bundle_close_only_without_unresolved_nodes");
  else errors.push("cross-workspace-pack-composition-v1 must make phase and bundle closure exact and immutable");
  return assertions;
}

function workspaceSnapshot(path) {
  return readdirSync(path, { recursive: true })
    .sort()
    .map((entry) => {
      const target = resolve(path, entry);
      const stat = statSync(target);
      return stat.isFile() ? `${entry}:file:${createHash("sha256").update(readFileSync(target)).digest("hex")}` : `${entry}:directory`;
    });
}

function validatePlugin() {
  const errors = [];
  const manifestPath = resolve(root, ".codex-plugin/plugin.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.name !== "forgerail") errors.push("Plugin name must be forgerail");
  if (manifest.version !== "0.1.0-alpha.2") errors.push("Plugin version must be 0.1.0-alpha.2");
  if (manifest.license !== "Apache-2.0") errors.push("Plugin license must be Apache-2.0");
  const expectedSkills = ["architecture-convergence-audit", "forgerail", "forgerail-workspace-diagnosis", "workspace-health-review"];
  const actualSkills = readdirSync(resolve(root, "skills"), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  if (JSON.stringify(actualSkills) !== JSON.stringify(expectedSkills)) errors.push(`Expected Skills ${expectedSkills.join(", ")}; received ${actualSkills.join(", ")}`);
  for (const skill of expectedSkills) {
    const skillRoot = resolve(root, "skills", skill);
    const content = readFileSync(resolve(skillRoot, "SKILL.md"), "utf8");
    const name = content.match(/^---\s*[\s\S]*?^name:\s*([^\n]+)$/m)?.[1]?.trim();
    if (name !== skill) errors.push(`${skill} frontmatter name is invalid`);
    if (!existsSync(resolve(skillRoot, "agents/openai.yaml"))) errors.push(`${skill}/agents/openai.yaml is missing`);
    for (const match of content.matchAll(/`(references\/[a-z0-9._/-]+\.md)`/g)) {
      if (!existsSync(resolve(skillRoot, match[1]))) errors.push(`${skill} reference is missing: ${match[1]}`);
    }
  }
  const schemas = [];
  const schemaRefs = [];
  for (const type of contractTypes) {
    const name = contractSchemaNames[type];
    const path = resolve(root, "contracts", `${name}.schema.json`);
    const schema = JSON.parse(readFileSync(path, "utf8"));
    schemas.push({ type, name, schema });
    if (schema.$schema !== "https://json-schema.org/draft/2020-12/schema") errors.push(`${name}.schema.json must use JSON Schema draft 2020-12`);
    if (typeof schema.$id !== "string" || !/-v[0-9]+\.json$/.test(schema.$id)) errors.push(`${name}.schema.json must declare a versioned $id`);
    if (!Object.hasOwn(schema.properties ?? {}, "schemaVersion")) errors.push(`${name}.schema.json must declare schemaVersion`);
    for (const ref of collectSchemaRefs(schema)) {
      schemaRefs.push({ name, ref });
      if (ref.startsWith("#") || /^[a-z]+:/i.test(ref)) continue;
      if (!existsSync(resolve(root, "contracts", ref))) errors.push(`${name}.schema.json has unresolved $ref: ${ref}`);
    }
  }
  const schemaIds = schemas.map(({ schema }) => schema.$id).filter(Boolean);
  if (new Set(schemaIds).size !== schemaIds.length) errors.push("contract schemas must use unique $id values");
  const schemaIdSet = new Set(schemaIds);
  for (const { name, ref } of schemaRefs) if (ref.startsWith("https://forgerail.dev/schemas/") && !schemaIdSet.has(ref)) errors.push(`${name}.schema.json has unresolved schema $id reference: ${ref}`);
  const effectiveProfileV2Schema = schemas.find(({ type }) => type === "effective-profile-v2")?.schema;
  const schemaNativeAssertions = [
    ...validateEffectiveProfileV2Schema(effectiveProfileV2Schema, errors),
    ...validateTaskControlSchemas(schemas, errors),
    ...validateTask27Schemas(schemas, errors),
    ...validateTask28Schemas(schemas, errors),
  ];
  const adapterRegistry = loadHostAdapters(root);
  if (!adapterRegistry.valid) errors.push(...adapterRegistry.errors);
  const packPaths = readdirSync(resolve(root, "packs")).filter((name) => name.endsWith(".json")).sort();
  for (const packName of packPaths) {
    const packResult = validateContract("pack", readJson(resolve(root, "packs", packName)));
    if (!packResult.valid) errors.push(...packResult.errors.map((error) => `${packName}: ${error}`));
  }
  const coverage = readJson(resolve(root, "docs/agw-coverage-baseline.json"));
  const allowedDispositions = new Set(coverage.allowedDispositions);
  if (new Set(coverage.items.map((item) => item.id)).size !== coverage.items.length) errors.push("AGW coverage contains duplicate ids");
  for (const item of coverage.items) {
    if (!allowedDispositions.has(item.target)) errors.push(`AGW coverage target is invalid: ${item.id}`);
    if (!["mapped", "unresolved"].includes(item.status)) errors.push(`AGW coverage status is invalid: ${item.id}`);
    if (item.status === "unresolved" && item.target !== "unresolved") errors.push(`AGW unresolved item must target unresolved: ${item.id}`);
  }
  if (coverage.migrationReady && coverage.items.some((item) => item.status !== "mapped")) errors.push("AGW migration cannot be ready with unresolved coverage");
  const contextBytes = Object.fromEntries(actualSkills.map((skill) => [skill, readFileSync(resolve(root, "skills", skill, "SKILL.md")).length]));
  if (contextBytes["architecture-convergence-audit"] > 5000) errors.push("architecture convergence default Skill context exceeds 5000 bytes");
  return { valid: errors.length === 0, errors, skills: actualSkills, packs: packPaths, contracts: contractTypes, schemaNativeAssertions, contextBytes };
}

const contractFixtureCases = [
    ["workspace-identity", "contracts/workspace-identity.valid.json", true],
    ["workspace-identity", "contracts/workspace-identity.missing-root.invalid.json", false],
    ["workspace-relationship", "contracts/workspace-relationship.valid.json", true],
    ["workspace-relationship", "contracts/workspace-relationship.inferred-authority.invalid.json", false],
    ["governance-source", "contracts/governance-source.valid.json", true],
    ["governance-source", "contracts/governance-source.unavailable-without-reason.invalid.json", false],
    ["source-dependency-edge", "contracts/source-dependency-edge.valid.json", true],
    ["source-dependency-edge", "contracts/source-dependency-edge.unavailable-without-reason.invalid.json", false],
    ["rule-claim", "contracts/rule-claim.valid.json", true],
    ["rule-claim", "contracts/rule-claim.inferred-enforceable.invalid.json", false],
    ["effective-profile-v2", "contracts/effective-profile-v2.valid.json", true],
    ["effective-profile-v2", "contracts/effective-profile-v2.unresolved-claim-false-complete.invalid.json", false],
    ["effective-profile-v2", "contracts/effective-profile-v2.required-unavailable-degraded.invalid.json", false],
    ["effective-profile-v2", "contracts/effective-profile-v2.optional-unavailable-degraded.valid.json", true],
    ["profile-explanation", "contracts/profile-explanation.valid.json", true],
    ["profile-explanation", "contracts/profile-explanation.false-complete.invalid.json", false],
    ["entry-mode", "contracts/entry-mode.valid.json", true],
    ["entry-mode", "contracts/entry-mode.missing-evidence.invalid.json", false],
    ["phase-slice-correlation", "contracts/phase-slice-correlation.valid.json", true],
    ["phase-slice-correlation", "contracts/phase-slice-correlation.aggregate-closure.invalid.json", false],
    ["operation-authority-requirement", "contracts/operation-authority-requirement.valid.json", true],
    ["operation-authority-requirement", "contracts/operation-authority-requirement.no-issuer.invalid.json", false],
    ["evidence-identity", "contracts/evidence-identity.valid.json", true],
    ["evidence-identity", "contracts/evidence-identity.unavailable-without-reason.invalid.json", false],
    ["task-envelope-v2", "contracts/task-envelope-v2.valid.json", true],
    ["task-envelope-v2", "contracts/task-envelope-v2.workspace-mismatch.invalid.json", false],
    ["task-envelope-v2", "contracts/task-envelope-v2.missing-workspace-identity.invalid.json", false],
    ["operation-grant", "contracts/operation-grant.valid.json", true],
    ["operation-grant", "contracts/operation-grant.missing-issuer-evidence.invalid.json", false],
    ["gate-result", "contracts/gate-result.valid.json", true],
    ["gate-result", "contracts/gate-result.satisfied-without-evidence.invalid.json", false],
    ["task-control-revision", "contracts/task-control-revision.valid.json", true],
    ["task-control-revision", "contracts/task-control-revision.closed-without-receipt.invalid.json", false],
    ["return-receipt-v2", "contracts/return-receipt-v2.valid.json", true],
    ["return-receipt-v2", "contracts/return-receipt-v2.unverified-closeout.invalid.json", false],
    ["rollback-envelope-lineage", "contracts/rollback-envelope-lineage.valid.json", true],
    ["rollback-envelope-lineage", "contracts/rollback-envelope-lineage.reused-grant.invalid.json", false],
    ["limited-reason", "contracts/limited-reason.valid.json", true],
    ["limited-reason", "contracts/limited-reason.unbounded.invalid.json", false],
    ["review-authority-requirement", "contracts/review-authority-requirement.valid.json", true],
    ["review-authority-requirement", "contracts/review-authority-requirement.transitive.invalid.json", false],
    ["authority-evidence", "contracts/authority-evidence.valid.json", true],
    ["authority-evidence", "contracts/authority-evidence.revoked.valid.json", true],
    ["authority-evidence", "contracts/authority-evidence.revoked-without-invalidation.invalid.json", false],
    ["validation-topology", "contracts/validation-topology.valid.json", true],
    ["validation-topology", "contracts/validation-topology.protected-environment.valid.json", true],
    ["validation-topology", "contracts/validation-topology.dangling-requirement.invalid.json", false],
    ["validation-result", "contracts/validation-result.valid.json", true],
    ["validation-result", "contracts/validation-result.passed-without-evidence.invalid.json", false],
    ["execution-context-identity", "contracts/execution-context-identity.valid.json", true],
    ["execution-context-identity", "contracts/execution-context-identity.unavailable-without-reason.invalid.json", false],
    ["host-adapter-observation", "contracts/host-adapter-observation.valid.json", true],
    ["host-adapter-observation", "contracts/host-adapter-observation.claims-authorization.invalid.json", false],
    ["provider-adapter-observation", "contracts/provider-adapter-observation.valid.json", true],
    ["provider-adapter-observation", "contracts/provider-adapter-observation.unauthenticated-supported.invalid.json", false],
    ["cross-workspace-pack-composition", "contracts/cross-workspace-pack-composition.valid.json", true],
    ["cross-workspace-pack-composition", "contracts/cross-workspace-pack-composition.false-closure.invalid.json", false],
    ["cross-workspace-pack-composition", "contracts/cross-workspace-pack-composition.authority-collapse.invalid.json", false],
    ["pack", "contracts/capability-pack.valid.json", true],
    ["pack", "contracts/capability-pack.missing-entry.invalid.json", false],
    ["profile", "contracts/effective-profile.valid.json", true],
    ["profile", "contracts/effective-profile.duplicate-rule.invalid.json", false],
    ["profile-candidate", "contracts/profile-change-candidate.valid.json", true],
    ["profile-candidate", "contracts/profile-change-candidate.unconfirmed.invalid.json", false],
    ["envelope", "contracts/task-envelope.valid.json", true],
    ["envelope", "contracts/task-envelope.overlap.invalid.json", false],
    ["launch", "contracts/launch-contract.valid.json", true],
    ["launch", "contracts/launch-contract.execution-owner.invalid.json", false],
    ["receipt", "contracts/return-receipt.valid.json", true],
    ["receipt", "contracts/return-receipt.deviation.invalid.json", false],
    ["host-adapter", "contracts/host-adapter.codex.valid.json", true],
    ["host-adapter", "contracts/host-adapter.claude-code.profile-only.valid.json", true],
    ["host-adapter", "contracts/host-adapter.cursor.profile-only.valid.json", true],
    ["host-adapter", "contracts/host-adapter.false-supported.invalid.json", false],
    ["adoption-plan", "contracts/adoption-plan.single-host.valid.json", true],
    ["adoption-plan", "contracts/adoption-plan.multi-host.valid.json", true],
    ["adoption-plan", "contracts/adoption-plan.mutating.invalid.json", false],
    ["binding-receipt", "contracts/host-binding-receipt.valid.json", true],
    ["binding-receipt", "contracts/host-binding-receipt.unverified.invalid.json", false],
];

function task29InvalidityWitness(caseId, observations) {
  const digest = (value) => typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
  if (caseId === "missing-identity") return typeof observations.requiredIdentity === "string" && observations.observedIdentity === null;
  if (caseId === "stale-base-digest") return digest(observations.candidateBaseDigest) && digest(observations.observedTargetDigest) && observations.candidateBaseDigest !== observations.observedTargetDigest;
  if (caseId === "forged-grant") return digest(observations.declaredGrantDigest) && digest(observations.expectedGrantDigest) && observations.declaredGrantDigest !== observations.expectedGrantDigest;
  if (caseId === "ineligible-issuer") return Array.isArray(observations.eligibleIssuerSourceIds) && !observations.eligibleIssuerSourceIds.includes(observations.observedIssuerSourceId);
  if (caseId === "duplicate-actor") return Number.isInteger(observations.minimumDistinctActors) && new Set(observations.observedActorIds ?? []).size < observations.minimumDistinctActors;
  if (caseId === "revoked-approval") return observations.requiredLifecycle === "current" && observations.observedLifecycle === "revoked";
  if (caseId === "wrong-trust") return Array.isArray(observations.acceptedTrustClasses) && !observations.acceptedTrustClasses.includes(observations.observedTrustClass);
  if (caseId === "dangling-dependency") return Array.isArray(observations.declaredDependencyEdgeIds) && observations.declaredDependencyEdgeIds.some((id) => !(observations.availableDependencyEdgeIds ?? []).includes(id));
  if (caseId === "changed-subject") return typeof observations.envelopeSubjectId === "string" && typeof observations.receiptSubjectId === "string" && observations.envelopeSubjectId !== observations.receiptSubjectId;
  if (caseId === "cross-workspace-authority-collapse") return observations.authorityTransfer === true || observations.operationGrantTransfer === true || observations.receiptSubstitution === true;
  return false;
}

function validateTask29FixtureMatrix(fixtureRoot = resolve(root, "scripts/fixtures")) {
  const errors = [];
  const schemaCoverage = contractTypes.map((type) => ({
    type,
    valid: contractFixtureCases.some(([candidate, , expected]) => candidate === type && expected === true),
    invalid: contractFixtureCases.some(([candidate, , expected]) => candidate === type && expected === false),
  }));
  for (const coverage of schemaCoverage) {
    if (!coverage.valid) errors.push(`task 2.9 fixture coverage is missing a valid case for ${coverage.type}`);
    if (!coverage.invalid) errors.push(`task 2.9 fixture coverage is missing an invalid case for ${coverage.type}`);
  }

  const matrixPath = resolve(fixtureRoot, "control-system/task-2.9-invalid-boundary-matrix.json");
  const matrix = readJson(matrixPath);
  const expectedCaseIds = [
    "missing-identity", "stale-base-digest", "forged-grant", "ineligible-issuer", "duplicate-actor",
    "revoked-approval", "wrong-trust", "dangling-dependency", "changed-subject", "cross-workspace-authority-collapse",
  ];
  if (matrix.schemaVersion !== "1.0") errors.push("task 2.9 boundary matrix schemaVersion must equal 1.0");
  if (matrix.matrixId !== "task-2.9-invalid-boundaries") errors.push("task 2.9 boundary matrix id is invalid");
  if (matrix.evaluatorImplemented !== false) errors.push("task 2.9 boundary matrix must not claim an evaluator implementation");
  if (!Array.isArray(matrix.cases)) errors.push("task 2.9 boundary matrix cases must be an array");
  const caseIds = (matrix.cases ?? []).map((item) => item.caseId);
  if (new Set(caseIds).size !== caseIds.length || !sameMembers(caseIds, expectedCaseIds)) errors.push("task 2.9 boundary matrix must cover each required invalid boundary exactly once");

  const results = [];
  for (const item of matrix.cases ?? []) {
    const caseErrors = [];
    if (!expectedCaseIds.includes(item.caseId)) caseErrors.push(`unknown case id: ${item.caseId}`);
    if (!["schema", "cross-contract"].includes(item.validationLayer)) caseErrors.push("validationLayer must be schema or cross-contract");
    if (item.expectedDisposition !== "rejected" || item.expectedReason !== item.caseId) caseErrors.push("expected rejection reason must match case id");
    if (!item.observations || typeof item.observations !== "object" || Array.isArray(item.observations) || Object.keys(item.observations).length < 2) caseErrors.push("case must carry bounded comparison observations");
    else if (!task29InvalidityWitness(item.caseId, item.observations)) caseErrors.push("bounded observations do not witness the declared invalid boundary");
    if (!Array.isArray(item.contractFixtures) || item.contractFixtures.length === 0) caseErrors.push("case must reference at least one contract fixture");
    const componentResults = [];
    for (const component of item.contractFixtures ?? []) {
      const componentPath = typeof component.path === "string" && /^contracts\/[a-z0-9.-]+\.json$/.test(component.path)
        ? resolve(fixtureRoot, component.path)
        : null;
      if (!contractTypes.includes(component.type)) caseErrors.push(`unknown contract type: ${component.type}`);
      if (!componentPath || !existsSync(componentPath)) caseErrors.push(`missing contract fixture: ${component.path}`);
      if (typeof component.expectedSchemaValid !== "boolean") caseErrors.push(`expectedSchemaValid must be boolean: ${component.path}`);
      if (contractTypes.includes(component.type) && componentPath && existsSync(componentPath)) {
        const validation = validateContract(component.type, readJson(componentPath));
        componentResults.push({ type: component.type, path: component.path, expected: component.expectedSchemaValid, actual: validation.valid, errors: validation.errors });
        if (validation.valid !== component.expectedSchemaValid) caseErrors.push(`contract fixture validity mismatch: ${component.path}`);
      }
    }
    if (item.validationLayer === "schema" && !(item.contractFixtures ?? []).some((component) => component.expectedSchemaValid === false)) caseErrors.push("schema-layer invalid case must contain an invalid contract fixture");
    if (item.validationLayer === "cross-contract" && (item.contractFixtures ?? []).some((component) => component.expectedSchemaValid !== true)) caseErrors.push("cross-contract invalid case must keep every component schema-valid");
    results.push({ caseId: item.caseId, validationLayer: item.validationLayer, passed: caseErrors.length === 0, errors: caseErrors, components: componentResults });
    errors.push(...caseErrors.map((error) => `${item.caseId}: ${error}`));
  }
  return {
    passed: errors.length === 0,
    errors,
    schemaCoverage: {
      total: schemaCoverage.length,
      valid: schemaCoverage.filter((item) => item.valid).length,
      invalid: schemaCoverage.filter((item) => item.invalid).length,
      items: schemaCoverage,
    },
    evaluatorImplemented: false,
    boundaryCases: results,
  };
}

function validateTask4IncubationMatrix(fixtureRoot = resolve(root, "scripts/fixtures")) {
  const errors = [];
  const matrix = readJson(resolve(fixtureRoot, "control-system/task-4-diagnosis-health-separation.json"));
  const allowedOwners = new Set(["diagnosis", "health", "core", "architecture-convergence"]);
  const expectedOwners = new Map([
    ["nested-owner-boundary", "diagnosis"],
    ["nearest-governance-sources", "diagnosis"],
    ["dependency-unavailable", "diagnosis"],
    ["baseline-debt", "diagnosis"],
    ["stale-unclaimed-worktree", "health"],
    ["specification-adr-residue", "health"],
    ["ci-generated-drift", "health"],
    ["compatibility-test-abstraction-bloat", "health"],
    ["runner-qualification-stale", "health"],
    ["exact-authority-and-receipt", "core"],
    ["duplicate-capability-owner", "architecture-convergence"],
  ]);
  if (matrix.schemaVersion !== "1.0") errors.push("task 4 matrix schemaVersion must equal 1.0");
  if (matrix.matrixId !== "task-4-diagnosis-health-separation") errors.push("task 4 matrix id is invalid");
  if (matrix.analyzeFirst !== true || matrix.mutationsAllowed !== false) errors.push("task 4 matrix must remain Analyze First and non-mutating");
  const caseIds = (matrix.cases ?? []).map((item) => item.caseId);
  if (caseIds.length !== expectedOwners.size || new Set(caseIds).size !== caseIds.length) errors.push("task 4 matrix must cover each owner-separation case exactly once");
  for (const [caseId, owner] of expectedOwners) {
    const item = (matrix.cases ?? []).find((candidate) => candidate.caseId === caseId);
    if (!item) errors.push(`task 4 matrix is missing ${caseId}`);
    else {
      if (!allowedOwners.has(item.expectedOwner) || item.expectedOwner !== owner) errors.push(`${caseId}: expected owner must be ${owner}`);
      if (!Array.isArray(item.observations) || item.observations.length === 0) errors.push(`${caseId}: bounded observations are required`);
      if (typeof item.expectedOutput !== "string" || item.expectedOutput.length === 0) errors.push(`${caseId}: expected output is required`);
    }
  }
  return { passed: errors.length === 0, errors, cases: matrix.cases?.length ?? 0, mutationsAllowed: matrix.mutationsAllowed };
}

function validateArchitectureConvergenceMatrix(fixtureRoot = resolve(root, "scripts/fixtures")) {
  const errors = [];
  const matrix = readJson(resolve(fixtureRoot, "control-system/architecture-convergence-cases.json"));
  const expectedActions = new Map([
    ["diagnosis-routes-source-discovery", "discover-sources"],
    ["health-routes-stale-worktrees", "assess-recurring-health"],
    ["core-routes-authority", "evaluate-deterministic-control"],
    ["thin-seam-retained", "retain"],
    ["large-cohesive-slice-retained", "retain"],
    ["second-identity-fence", "consolidate"],
    ["parallel-state-machine", "delete-duplicate"],
    ["duplicate-parser", "reuse-parser"],
    ["speculative-compatibility", "defer-or-delete"],
    ["recovery-multiplication", "consolidate"],
    ["implementation-shaped-tests", "delete-tests-preserve-invariants"],
    ["incomplete-evidence", "verify-before-deletion"],
    ["existing-profile-objects", "read-existing-objects"],
    ["issue-without-authorization", "return-template-only"],
  ]);
  if (matrix.schemaVersion !== "1.0" || matrix.matrixId !== "architecture-convergence-audit") errors.push("architecture convergence matrix identity is invalid");
  if (matrix.risk !== "medium" || matrix.analyzeFirst !== true || matrix.defaultMutation !== "read-only") errors.push("architecture convergence must be medium-risk Analyze First and read-only");
  if (matrix.createsState !== false || matrix.requiresAuthentication !== false) errors.push("architecture convergence cannot create state or require authentication");
  const ids = (matrix.cases ?? []).map((item) => item.caseId);
  if (ids.length !== expectedActions.size || new Set(ids).size !== ids.length) errors.push("architecture convergence cases must be unique and complete");
  for (const [caseId, action] of expectedActions) {
    const item = (matrix.cases ?? []).find((candidate) => candidate.caseId === caseId);
    if (!item) errors.push(`architecture convergence is missing ${caseId}`);
    else {
      if (item.expectedAction !== action) errors.push(`${caseId}: expected action must be ${action}`);
      if (item.evidenceCompleteness === "incomplete" && item.expectedFinding !== "inferred-redundancy") errors.push(`${caseId}: incomplete evidence must remain inference`);
      if (item.expectedAction.includes("delete") && item.evidenceCompleteness !== "complete") errors.push(`${caseId}: deletion requires complete evidence`);
    }
  }
  const pack = readJson(resolve(root, "packs/architecture-convergence-audit.json"));
  const packValidation = validateContract("pack", pack);
  if (!packValidation.valid) errors.push(...packValidation.errors);
  if (pack.risk !== "medium" || pack.dependencies.length !== 0 || pack.approvals.length !== 0) errors.push("architecture convergence manifest boundary is invalid");
  for (const path of [
    "skills/architecture-convergence-audit/SKILL.md",
    "skills/architecture-convergence-audit/references/audit-contract.md",
    "skills/architecture-convergence-audit/assets/github-issue-template.md",
  ]) if (!existsSync(resolve(root, path))) errors.push(`architecture convergence asset is missing: ${path}`);
  return { passed: errors.length === 0, errors, cases: matrix.cases?.length ?? 0, externalMutations: 0, persistedState: 0 };
}

function validateFixtures() {
  const fixtureRoot = resolve(root, "scripts/fixtures");
  const results = contractFixtureCases.map(([type, path, expected]) => {
    const result = validateContract(type, readJson(resolve(fixtureRoot, path)));
    return { type, path, expected, actual: result.valid, passed: result.valid === expected, errors: result.errors };
  });
  const task29Matrix = validateTask29FixtureMatrix(fixtureRoot);
  results.push({ type: "fixture-matrix", path: "control-system/task-2.9-invalid-boundary-matrix.json", expected: true, actual: task29Matrix.passed, passed: task29Matrix.passed, errors: task29Matrix.errors, details: task29Matrix });
  const task4Matrix = validateTask4IncubationMatrix(fixtureRoot);
  results.push({ type: "fixture-matrix", path: "control-system/task-4-diagnosis-health-separation.json", expected: true, actual: task4Matrix.passed, passed: task4Matrix.passed, errors: task4Matrix.errors, details: task4Matrix });
  const architectureConvergence = validateArchitectureConvergenceMatrix(fixtureRoot);
  results.push({ type: "fixture-matrix", path: "control-system/architecture-convergence-cases.json", expected: true, actual: architectureConvergence.passed, passed: architectureConvergence.passed, errors: architectureConvergence.errors, details: architectureConvergence });
  for (const workspace of ["markdown-existing", "empty-records"]) {
    const path = resolve(fixtureRoot, "workspaces", workspace);
    const before = JSON.stringify(workspaceSnapshot(path));
    const diagnosis = diagnoseWorkspace(path);
    const after = JSON.stringify(workspaceSnapshot(path));
    results.push({ type: "diagnosis", path: relative(fixtureRoot, path), expected: true, actual: diagnosis.mutations.length === 0 && before === after, passed: diagnosis.mutations.length === 0 && before === after, errors: [] });
  }
  const manifests = readdirSync(resolve(root, "packs")).filter((name) => name.endsWith(".json")).map((name) => readJson(resolve(root, "packs", name)));
  const available = resolveProfile(readJson(resolve(fixtureRoot, "contracts/profile-input.available-pack.json")), manifests);
  results.push({ type: "composition", path: "contracts/profile-input.available-pack.json", expected: true, actual: available.valid && available.activePacks.length === 0 && available.profile.rules[0]?.value === "release", passed: available.valid && available.activePacks.length === 0 && available.profile.rules[0]?.value === "release", errors: available.errors });
  const conflict = resolveProfile(readJson(resolve(fixtureRoot, "contracts/profile-input.conflict.json")), manifests);
  results.push({ type: "composition", path: "contracts/profile-input.conflict.json", expected: false, actual: conflict.valid, passed: !conflict.valid && conflict.profile.conflicts.length === 1, errors: conflict.errors });
  const orchestrationPackCandidates = [
    resolve(root, "../forgerail-cross-workspace-orchestration/pack.json"),
    resolve(root, "plugins/forgerail-cross-workspace-orchestration/pack.json"),
  ];
  const orchestrationPackPath = orchestrationPackCandidates.find((path) => existsSync(path));
  if (orchestrationPackPath) {
    const orchestrationPack = readJson(orchestrationPackPath);
    const orchestrationPackValidation = validateContract("pack", orchestrationPack);
    const orchestrationAvailable = resolveProfile(readJson(resolve(fixtureRoot, "contracts/profile-input.orchestration-available.json")), [...manifests, orchestrationPack]);
    results.push({
      type: "composition",
      path: "contracts/profile-input.orchestration-available.json",
      expected: true,
      actual: orchestrationPackValidation.valid && orchestrationAvailable.valid && orchestrationAvailable.activePacks.length === 0,
      passed: orchestrationPackValidation.valid && orchestrationAvailable.valid && orchestrationAvailable.activePacks.length === 0,
      errors: [...orchestrationPackValidation.errors, ...orchestrationAvailable.errors],
    });
  } else results.push({ type: "composition", path: "cross-workspace-orchestration-manifest", expected: true, actual: false, passed: false, errors: ["external orchestration Pack manifest is unavailable"] });
  const inactiveLaunch = createLaunchContract(available.profile, { ...readJson(resolve(fixtureRoot, "contracts/task-envelope.valid.json")), packs: ["workspace-health-review"] }, "Codex");
  results.push({ type: "launch", path: "inactive-pack", expected: false, actual: inactiveLaunch.valid, passed: !inactiveLaunch.valid && inactiveLaunch.errors.some((error) => error.includes("inactive pack")), errors: inactiveLaunch.errors });
  const receipt = readJson(resolve(fixtureRoot, "contracts/return-receipt.valid.json"));
  const mismatch = verifyReceipt({ ...receipt, branch: "not-the-current-branch", commit: null }, resolve(root, "../.."));
  results.push({ type: "receipt-observation", path: "observable-git-mismatch", expected: false, actual: mismatch.valid, passed: !mismatch.valid && mismatch.closeout === "incomplete", errors: mismatch.errors });
  const adoption = validateAdoption();
  results.push({ type: "adoption", path: "read-only-planner", expected: true, actual: adoption.passed, passed: adoption.passed, errors: adoption.errors });
  return { passed: results.every((item) => item.passed), results };
}

function validateAdoption() {
  const errors = [];
  const registry = loadHostAdapters(root);
  if (!registry.valid) errors.push(...registry.errors);
  const workspace = resolve(root, "scripts/fixtures/workspaces/markdown-existing");
  const before = JSON.stringify(workspaceSnapshot(workspace));
  let single;
  let multi;
  try {
    single = planAdoption(root, workspace, ["codex"]);
    multi = planAdoption(root, workspace, ["codex", "claude-code", "cursor"]);
  } catch (error) {
    errors.push(error.message);
  }
  const after = JSON.stringify(workspaceSnapshot(workspace));
  if (before !== after) errors.push("adoption planning mutated its fixture workspace");
  if (single?.strategy !== "single-host-managed-block" || single?.proposedWrites?.length !== 1 || single?.proposedWrites?.[0]?.path !== "AGENTS.md") errors.push("single-host plan is not a bounded AGENTS.md managed block");
  if (multi?.strategy !== "shared-contract-with-thin-bindings" || !multi?.proposedWrites?.some((write) => write.path === "FORGERAIL.md")) errors.push("multi-host plan is missing the shared Adoption Contract");
  if (multi?.hosts?.find((host) => host.adapterId === "claude-code")?.status !== "profile-only" || multi?.hosts?.find((host) => host.adapterId === "cursor")?.status !== "profile-only") errors.push("unverified hosts must remain profile-only");
  if ([...(single?.proposedWrites ?? []), ...(multi?.proposedWrites ?? [])].some((write) => write.path === ".forgerail" || write.path.startsWith(".forgerail/"))) errors.push("alpha.1 adoption plan cannot propose .forgerail state");
  try {
    planAdoption(root, workspace, ["codex"], "persisted-governance");
    errors.push("persisted-governance planning must be refused in alpha.1");
  } catch (error) {
    if (!error.message.includes("evidence-gated")) errors.push(`unexpected persisted-governance error: ${error.message}`);
  }
  return { passed: errors.length === 0, errors, adapters: registry.adapters.map(({ id, status }) => ({ id, status })), single, multi };
}

const [command] = process.argv.slice(2);
if (command === "validate") {
  const result = validatePlugin(); emit(result); if (!result.valid) process.exitCode = 1;
} else if (command === "validate-fixtures") {
  const result = validateFixtures(); emit(result); if (!result.passed) process.exitCode = 1;
} else if (command === "validate-fixture-matrix") {
  const result = validateTask29FixtureMatrix(); emit(result); if (!result.passed) process.exitCode = 1;
} else if (command === "validate-adoption") {
  const result = validateAdoption(); emit(result); if (!result.passed) process.exitCode = 1;
} else if (command === "validate-contract") {
  const type = arg("--type"); const file = arg("--file");
  if (!type || !file) fail("validate-contract requires --type and --file");
  const result = validateContract(type, readJson(resolve(file))); emit(result); if (!result.valid) process.exitCode = 1;
} else if (command === "diagnose") {
  const workspace = arg("--workspace"); if (!workspace) fail("diagnose requires --workspace"); emit(diagnoseWorkspace(workspace));
} else if (command === "adoption-plan") {
  const workspace = arg("--workspace"); const hosts = args("--host"); const level = arg("--level") ?? "lightweight-adoption";
  if (!workspace || hosts.length === 0) fail("adoption-plan requires --workspace and at least one --host");
  try { emit(planAdoption(root, workspace, hosts, level)); } catch (error) { fail(error.message); }
} else if (command === "resolve-profile") {
  const file = arg("--file"); if (!file) fail("resolve-profile requires --file");
  const manifests = [
    ...readdirSync(resolve(root, "packs")).filter((name) => name.endsWith(".json")).map((name) => readJson(resolve(root, "packs", name))),
    ...args("--pack-manifest").map((path) => readJson(resolve(path))),
  ];
  for (const manifest of manifests) {
    const validation = validateContract("pack", manifest);
    if (!validation.valid) fail(`invalid pack manifest ${manifest.id ?? "unknown"}: ${validation.errors.join("; ")}`);
  }
  const result = resolveProfile(readJson(resolve(file)), manifests); emit(result); if (!result.valid) process.exitCode = 1;
} else if (command === "launch") {
  const profile = arg("--profile"); const envelope = arg("--envelope"); const hostAgent = arg("--host-agent");
  if (!profile || !envelope || !hostAgent) fail("launch requires --profile, --envelope, and --host-agent");
  const profilePayload = readJson(resolve(profile));
  const effectiveProfile = profilePayload.profile ?? profilePayload;
  const result = createLaunchContract(effectiveProfile, readJson(resolve(envelope)), hostAgent); emit(result); if (!result.valid) process.exitCode = 1;
} else if (command === "verify-receipt") {
  const receipt = arg("--receipt"); const workspace = arg("--workspace");
  if (!receipt || !workspace) fail("verify-receipt requires --receipt and --workspace");
  const result = verifyReceipt(readJson(resolve(receipt)), workspace); emit(result); if (!result.valid) process.exitCode = 1;
} else if (command === "build-bundle") {
  const output = arg("--output"); if (!output) fail("build-bundle requires --output");
  const result = buildBundle(root, output);
  emit(process.argv.includes("--summary") ? { schemaVersion: result.schemaVersion, productId: result.productId, projection: result.projection, fileCount: result.fileCount, totalBytes: result.totalBytes, digest: result.digest, receiptDigest: result.receiptDigest } : result);
} else fail("usage: forgerail.mjs validate | validate-fixtures | validate-fixture-matrix | validate-adoption | validate-contract | diagnose | adoption-plan | resolve-profile | launch | verify-receipt | build-bundle");
