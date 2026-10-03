import { createHash } from "node:crypto";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { validateContract, containsInlineSecret } from "./contracts.mjs";
import { readProjectFileBytes } from "./project-state.mjs";
import { providerAdapterRegistry } from "./provider-adapter-registry.mjs";
export { providerAdapterRegistry } from "./provider-adapter-registry.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const transientCredentialCleanups = new Set();
let transientSignalHandlers = null;

function retainSignalCleanup(cleanup) {
  transientCredentialCleanups.add(cleanup);
  if (transientSignalHandlers === null) {
    transientSignalHandlers = new Map(["SIGINT", "SIGTERM", "SIGHUP"].map((signal) => [signal, () => {
      for (const activeCleanup of transientCredentialCleanups) activeCleanup();
      transientCredentialCleanups.clear();
      for (const [name, handler] of transientSignalHandlers) process.off(name, handler);
      transientSignalHandlers = null;
      process.kill(process.pid, signal);
    }]));
    for (const [signal, handler] of transientSignalHandlers) process.once(signal, handler);
  }
  return () => {
    transientCredentialCleanups.delete(cleanup);
    setImmediate(() => {
      if (transientCredentialCleanups.size || transientSignalHandlers === null) return;
      for (const [signal, handler] of transientSignalHandlers) process.off(signal, handler);
      transientSignalHandlers = null;
    });
  };
}
export function validateObservationSelectors(operationId, targetId) {
  if ((operationId === null) !== (targetId === null)) throw new Error("provider observation requires operation and target together");
  for (const [label, value] of [["operation", operationId], ["target", targetId]]) {
    if (value !== null && (typeof value !== "string" || !value.length || value.length > 300 || /[\r\n]/.test(value) || containsInlineSecret(value))) {
      throw new Error(`${label} identity is unsafe or contains credential-like material`);
    }
  }
}

function sanitizedActor(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)) return null;
  if (containsInlineSecret(value) || /^(?:gh[pousr]_|github_pat_|npm_)/i.test(value)) return null;
  return value;
}

function reason(binding, observedAt, code, impact, summary) {
  return { schemaVersion: "1.0", reasonId: `reason:${binding.bindingId}:${code}`, code, impact, summary, evidenceIdentityIds: [], locators: [`provider://${binding.providerId}/${binding.adapterId}`], observedAt, sanitized: true };
}

function defaultRun(command, args, options) {
  const result = spawnSync(command, args, { cwd: options.cwd, env: options.env, encoding: "utf8", timeout: 15000, maxBuffer: 64 * 1024 });
  return { status: result.status, errorCode: result.error?.code ?? null, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function credentialBytes(binding, context) {
  const locator = binding.locator;
  if (locator.kind === "provider-native") return null;
  if (locator.kind === "environment-variable") {
    const value = context.environment[locator.name];
    if (typeof value !== "string" || !value.length) throw new Error("declared environment credential is unavailable");
    return Buffer.from(value);
  }
  if (locator.kind === "workspace-file") {
    const value = readProjectFileBytes(context.workspace, locator.path, 64 * 1024);
    if (value === null) throw new Error("declared workspace credential is unavailable");
    return value;
  }
  const relationship = context.workspaceRelationships.find((item) => item.relationshipId === locator.workspaceRelationshipId);
  const relatedIdentity = context.relatedWorkspaceIdentities.find((item) => item.workspaceIdentityId === locator.workspaceIdentityId);
  const declaredRoot = context.environment[locator.rootEnvironmentVariable];
  if (!relationship || !relatedIdentity || typeof declaredRoot !== "string" || !declaredRoot.length) throw new Error("related workspace binding is unresolved");
  const relationshipValidation = validateContract("workspace-relationship", relationship);
  const identityValidation = validateContract("workspace-identity", relatedIdentity);
  if (!relationshipValidation.valid || !identityValidation.valid || relationship.provenanceStatus !== "confirmed") throw new Error("related workspace evidence is invalid or unconfirmed");
  if (!context.declaration.workspaceRelationshipIds.includes(relationship.relationshipId)
    || !context.declaration.sources.some((source) => source.sourceId === relationship.declaredBySourceId)
    || relationship.sourceWorkspaceIdentityId !== context.declaration.workspaceIdentityId
    || relationship.targetWorkspaceIdentityId !== locator.workspaceIdentityId
    || relationship.authorityTransfer !== false) throw new Error("related workspace relationship mismatch");
  const root = realpathSync(declaredRoot);
  if (root === context.workspace) throw new Error("related workspace root aliases the owner workspace");
  const identityRoot = realpathSync(isAbsolute(relatedIdentity.canonicalRootLocator) ? relatedIdentity.canonicalRootLocator : resolve(root, relatedIdentity.canonicalRootLocator));
  if (root !== identityRoot) throw new Error("related workspace identity mismatch");
  const value = readProjectFileBytes(root, locator.path, 64 * 1024);
  if (value === null) throw new Error("declared related-workspace credential is unavailable");
  return value;
}

function commandFor(binding, context, credentials) {
  const coordinates = binding.locator.coordinates ?? {};
  if (binding.adapterId === "github-cli-api") {
    if (!coordinates.host) throw new Error("GitHub host coordinate is required");
    return { command: "gh", args: ["api", "user", "--hostname", coordinates.host, "--jq", ".login"], env: context.environment, parse: (result) => result.status === 0 ? result.stdout.trim() : null };
  }
  if (binding.adapterId === "git-ssh") {
    if (!coordinates.hostAlias) throw new Error("Git SSH hostAlias coordinate is required");
    return { command: "ssh", args: ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", "-T", `git@${coordinates.hostAlias}`], env: context.environment, parse: (result) => result.errorCode || result.status !== 1 ? null : /(?:^|\n)Hi ([^!\s]+)! You\'ve successfully authenticated, but GitHub does not provide shell access\.(?:\r?\n|$)/.exec(`${result.stdout}\n${result.stderr}`)?.[1] ?? null };
  }
  const registry = coordinates.registry ?? "https://registry.npmjs.org";
  let temporaryRoot = null;
  let releaseSignalCleanup = null;
  const cleanupMaterial = () => { credentials?.fill(0); if (temporaryRoot !== null) rmSync(temporaryRoot, { recursive: true, force: true }); };
  const cleanup = () => { cleanupMaterial(); releaseSignalCleanup?.(); releaseSignalCleanup = null; };
  try {
    const parsedRegistry = new URL(registry);
    if (parsedRegistry.protocol !== "https:" || parsedRegistry.username || parsedRegistry.password || parsedRegistry.search || parsedRegistry.hash) throw new Error("npm registry requires HTTPS without userinfo, query or fragment");
    temporaryRoot = mkdtempSync(resolve(tmpdir(), "forgerail-npm-observe-"));
    releaseSignalCleanup = retainSignalCleanup(cleanupMaterial);
    const env = { ...context.environment };
    env.NPM_CONFIG_CACHE = resolve(temporaryRoot, "cache");
    let cwd = context.workspace;
    if (credentials !== null) {
      const config = resolve(temporaryRoot, "npmrc");
      const hostPath = parsedRegistry.host + parsedRegistry.pathname.replace(/\/$/, "");
      writeFileSync(config, `//${hostPath}/:_authToken=${credentials.toString("utf8")}\n`, { mode: 0o600 });
      for (const key of Object.keys(env)) if (/^(?:NPM_TOKEN|NODE_AUTH_TOKEN|NPM_CONFIG_(?:USERCONFIG|GLOBALCONFIG|.*AUTH.*|.*TOKEN.*))$/i.test(key)) delete env[key];
      if (binding.locator.kind === "environment-variable") delete env[binding.locator.name];
      env.NPM_CONFIG_USERCONFIG = config;
      cwd = temporaryRoot;
    }
    return { command: "npm", args: ["whoami", "--registry", registry], cwd, env, cleanup, parse: (result) => result.status === 0 ? result.stdout.trim() : null };
  } catch (error) {
    cleanup();
    throw error;
  }
}

function capability(binding, authenticated, evidenceIdentityIds, observedAt) {
  if (binding.adapterId === "npm-registry") return [
    { capability: "source-observation", state: authenticated ? "supported" : "unavailable", requiresIdentity: true, sideEffectKinds: [], approvalRequirementIds: [], evidenceIdentityIds, limitedReason: authenticated ? null : reason(binding, observedAt, "unauthenticated-provider", "unavailable", "npm identity could not be authenticated.") },
    { capability: "authority-observation", state: "unknown", requiresIdentity: true, sideEffectKinds: [], approvalRequirementIds: [], evidenceIdentityIds: [], limitedReason: reason(binding, observedAt, "missing-required-evidence", "unverified", "Exact npm target permission was not proven by this read-only observation.") },
  ];
  return [{ capability: "source-observation", state: authenticated ? "supported" : "unavailable", requiresIdentity: true, sideEffectKinds: [], approvalRequirementIds: [], evidenceIdentityIds, limitedReason: authenticated ? null : reason(binding, observedAt, "unauthenticated-provider", "unavailable", "Provider identity could not be authenticated.") }];
}

export function observeProjectProfileBindings({ workspace, declaration, operationId = null, targetId = null, executionContextIdentity = null, workspaceRelationships = [], relatedWorkspaceIdentities = [], environment = process.env, run = defaultRun, observedAt = new Date().toISOString() }) {
  const validation = validateContract("project-profile-declaration", declaration);
  if (!validation.valid) throw new Error(`invalid Project Profile declaration: ${validation.errors.join("; ")}`);
  const root = realpathSync(workspace);
  validateObservationSelectors(operationId, targetId);
  if (executionContextIdentity !== null) {
    const contextValidation = validateContract("execution-context-identity", executionContextIdentity);
    if (!contextValidation.valid || executionContextIdentity.workspaceIdentityId !== declaration.workspaceIdentityId || realpathSync(executionContextIdentity.invocationRoot) !== root) throw new Error("Execution Context Identity does not match the exact workspace");
  }
  if (operationId === null) return { executionContextIdentityId: executionContextIdentity?.executionContextIdentityId ?? null, observations: [], bindings: declaration.resourceBindings.map(({ bindingId, operationIds, requiredness }) => ({ bindingId, operationIds, requiredness, status: "not-requested" })), providerCalls: 0 };
  if (executionContextIdentity === null) throw new Error("provider observation requires an exact Execution Context Identity");
  const observations = [], bindings = [];
  let providerCalls = 0;
  for (const binding of declaration.resourceBindings) {
    if (!binding.operationIds.includes(operationId)) { bindings.push({ bindingId: binding.bindingId, operationIds: binding.operationIds, requiredness: binding.requiredness, status: "not-applicable" }); continue; }
    const adapter = providerAdapterRegistry[binding.adapterId];
    if (!adapter || !adapter.operations.includes(operationId) || !adapter.locatorKinds.includes(binding.locator.kind)) { bindings.push({ bindingId: binding.bindingId, operationIds: binding.operationIds, requiredness: binding.requiredness, status: "unsupported" }); continue; }
    const observationId = `provider-observation:${sha256(JSON.stringify([declaration.workspaceIdentityId, executionContextIdentity.executionContextIdentityId, binding.bindingId, operationId, targetId, observedAt])).slice(0, 32)}`;
    let actorId = null, limitedReason = null, resultEvidence = [];
    try {
      const credentials = credentialBytes(binding, { workspace: root, declaration, workspaceRelationships, relatedWorkspaceIdentities, environment });
      const command = commandFor(binding, { workspace: root, environment }, credentials);
      try { const result = run(command.command, command.args, { cwd: command.cwd ?? root, env: command.env }); providerCalls += 1; actorId = sanitizedActor(command.parse(result)); }
      finally { command.cleanup?.(); }
      if (actorId) resultEvidence = [`evidence:${sha256(observationId).slice(0, 32)}`];
      else limitedReason = reason(binding, observedAt, "unauthenticated-provider", "unavailable", "Provider identity could not be authenticated.");
    } catch {
      limitedReason = reason(binding, observedAt, "unavailable-provider", "unavailable", "Provider observation prerequisites are unavailable or do not match the declared boundary.");
    }
    const identity = actorId ? { state: "authenticated", actorId, evidenceIdentityIds: resultEvidence, limitedReason: null } : { state: "unavailable", actorId: null, evidenceIdentityIds: [], limitedReason };
    const observation = { schemaVersion: "1.0", observationId, adapterId: binding.adapterId, adapterVersion: adapter.version, providerId: binding.providerId, workspaceIdentityId: declaration.workspaceIdentityId, sourceIdentityId: binding.bindingId, scopeKind: "workspace", taskId: null, subjectId: null, controlRevisionId: null, identity, authorizationClaim: false, capabilities: capability(binding, Boolean(actorId), resultEvidence, observedAt), observedAt, sanitized: true };
    const observationValidation = validateContract("provider-adapter-observation", observation);
    if (!observationValidation.valid) throw new Error(`invalid sanitized provider observation: ${observationValidation.errors.join("; ")}`);
    const expected = binding.expectedIdentityClaimIds.map((id) => declaration.claims.find((claim) => claim.claimId === id)?.normalizedValue).filter((value) => typeof value === "string");
    observations.push(observation);
    const status = actorId ? expected.length > 0 && expected.every((value) => value === actorId) ? "matched" : "wrong-actor" : "unresolved";
    bindings.push({ bindingId: binding.bindingId, operationIds: binding.operationIds, requiredness: binding.requiredness, status, targetId, targetPermission: binding.adapterId === "npm-registry" ? "unverified" : "not-observed", observationId: observation.observationId, rebind: status === "unresolved" ? { required: true, currentLocator: binding.locator, action: "review-project-profile-candidate" } : null });
  }
  return { executionContextIdentityId: executionContextIdentity.executionContextIdentityId, observations, bindings, providerCalls };
}

export function classifyProjectProfileInspection(profile, providerObservation, operationId) {
  if (profile.status === "invalid") return "invalid";
  if (operationId === null) return profile.status;
  const applicable = providerObservation.bindings.filter((binding) => !["not-applicable", "not-requested"].includes(binding.status));
  if (applicable.some((binding) => binding.requiredness === "required" && binding.status === "wrong-actor")) return "blocked";
  if (profile.profile?.completeness === "unresolved" || applicable.some((binding) => binding.requiredness === "required" && (["unresolved", "unsupported"].includes(binding.status) || (operationId === "package.publish" && binding.targetPermission === "unverified")))) return "unresolved";
  if (profile.profile?.completeness === "degraded" || applicable.some((binding) => binding.requiredness === "optional" && binding.status !== "matched")) return "degraded";
  return "ready";
}
