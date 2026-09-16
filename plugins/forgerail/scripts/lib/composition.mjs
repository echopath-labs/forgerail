import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { accessSync, constants, realpathSync, statSync } from "node:fs";
import { validateContract } from "./contracts.mjs";

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
  return value;
}

function equalValue(left, right) {
  return JSON.stringify(canonicalValue(left)) === JSON.stringify(canonicalValue(right));
}

function digest(value) {
  return createHash("sha256").update(`${JSON.stringify(canonicalValue(value))}\n`).digest("hex");
}

function duplicateIds(values = []) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
}

function validatePackManifests(packManifests) {
  if (!Array.isArray(packManifests)) return { valid: false, manifests: [], errors: ["pack manifests must be an array"] };
  const manifests = [];
  const errors = [];
  for (const [index, manifest] of packManifests.entries()) {
    const validation = validateContract("pack", manifest);
    const identity = manifest && typeof manifest === "object" && !Array.isArray(manifest) && typeof manifest.id === "string"
      ? manifest.id
      : `pack[${index}]`;
    if (!validation.valid) {
      errors.push(...validation.errors.map((error) => `${identity}: ${error}`));
      continue;
    }
    manifests.push(manifest);
  }
  for (const id of duplicateIds(manifests.map((manifest) => manifest.id))) errors.push(`${id}: duplicate pack manifest identity`);
  return { valid: errors.length === 0, manifests, errors };
}

export function resolveProfile(input, packManifests = []) {
  const conflicts = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) return { profile: null, activePacks: [], valid: false, errors: ["profile input must be an object"] };
  const manifestValidation = validatePackManifests(packManifests);
  if (!manifestValidation.valid) return { profile: null, activePacks: [], valid: false, errors: manifestValidation.errors };
  const inputErrors = [];
  for (const field of ["rules", "packs"]) {
    if (input[field] !== undefined && !Array.isArray(input[field])) inputErrors.push(`profile input.${field} must be an array`);
  }
  if (inputErrors.length) return { profile: null, activePacks: [], valid: false, errors: inputErrors };
  // Validate every source before reduction, including sources that will lose.
  for (const [index, rule] of (input.rules ?? []).entries()) {
    const result = validateContract("profile", { schemaVersion: "1.0", workspace: input.workspace, computed: true, rules: [rule], packs: {}, conflicts: [] });
    inputErrors.push(...result.errors.map(error => `input.rules[${index}]: ${error}`));
  }
  for (const [index, pack] of (input.packs ?? []).entries()) {
    if (!pack || typeof pack !== "object" || Array.isArray(pack) || typeof pack.id !== "string") {
      inputErrors.push(`input.packs[${index}] must be a pack state with an id`);
      continue;
    }
    const result = validateContract("profile", { schemaVersion: "1.0", workspace: input.workspace, computed: true, rules: [], packs: { [pack.id]: { state: pack.state, reason: pack.reason } }, conflicts: [] });
    inputErrors.push(...result.errors.map(error => `input.packs[${index}]: ${error}`));
  }
  if (inputErrors.length) return { profile: null, activePacks: [], valid: false, errors: inputErrors };
  for (const id of duplicateIds((input.packs ?? []).map((pack) => pack?.id))) conflicts.push(`${id}: duplicate pack state identity`);
  for (const identity of duplicateIds((input.rules ?? []).map((rule) => `${rule?.id}\u0000${rule?.source}`))) {
    const [id, source] = identity.split("\u0000");
    conflicts.push(`${id}: duplicate rule source identity (${source})`);
  }
  const groups = new Map();
  for (const rule of input.rules ?? []) {
    if (!groups.has(rule.id)) groups.set(rule.id, []);
    groups.get(rule.id).push(rule);
  }
  const selected = new Map();
  for (const [id, rules] of groups) {
    const precedence = Math.min(...rules.map(rule => rule.precedence));
    const effective = rules.filter(rule => rule.precedence === precedence).sort((a, b) => {
      const left = JSON.stringify(canonicalValue(a)), right = JSON.stringify(canonicalValue(b));
      return left < right ? -1 : left > right ? 1 : 0;
    });
    selected.set(id, canonicalValue(effective[0]));
    for (const rule of effective.slice(1)) {
      if (!equalValue(effective[0].value, rule.value)) conflicts.push(`${id}: equal-precedence sources disagree (${effective[0].source} vs ${rule.source})`);
    }
  }

  const manifests = new Map(manifestValidation.manifests.map((pack) => [pack.id, pack]));
  const states = new Map((input.packs ?? []).map((pack) => [pack.id, pack]));
  const active = new Set([...states.values()].filter((pack) => ["enabled", "required"].includes(pack.state)).map((pack) => pack.id));
  for (const id of active) {
    const manifest = manifests.get(id);
    if (!manifest) {
      conflicts.push(`${id}: enabled pack manifest is unavailable`);
      continue;
    }
    for (const dependency of manifest.dependencies) if (!active.has(dependency)) conflicts.push(`${id}: missing active dependency ${dependency}`);
    for (const conflict of manifest.conflicts) if (active.has(conflict)) conflicts.push(`${id}: conflicts with active pack ${conflict}`);
  }
  if (active.has("agent-workflow-governance") && active.has("forgerail-core")) conflicts.push("duplicate core workflow owners: agent-workflow-governance and forgerail-core");

  const profile = {
    schemaVersion: "1.0",
    workspace: input.workspace,
    computed: true,
    rules: [...selected.values()].sort((left, right) => left.id.localeCompare(right.id)),
    packs: Object.fromEntries((input.packs ?? []).slice().sort((left, right) => left.id.localeCompare(right.id)).map((pack) => [pack.id, { state: pack.state, reason: pack.reason }])),
    conflicts: [...new Set(conflicts)].sort(),
  };
  const contract = validateContract("profile", profile);
  return { profile, activePacks: [...active].sort(), valid: contract.valid && profile.conflicts.length === 0, errors: [...contract.errors, ...profile.conflicts] };
}

export function createLaunchContract(profile, envelope, hostAgent, packManifests = []) {
  const profileResult = validateContract("profile", profile);
  const envelopeResult = validateContract("envelope", envelope);
  const errors = [...profileResult.errors, ...envelopeResult.errors];
  if (!profileResult.valid || !envelopeResult.valid) return { launch: null, valid: false, errors };
  if (profile.workspace !== envelope.ownerWorkspace) errors.push(`profile workspace mismatch: ${profile.workspace} != ${envelope.ownerWorkspace}`);
  if (profile.conflicts?.length > 0) errors.push(...profile.conflicts.map((conflict) => `unresolved profile conflict: ${conflict}`));
  const profilePacks = profile.packs && typeof profile.packs === "object" && !Array.isArray(profile.packs) ? Object.entries(profile.packs) : [];
  const activePacks = new Set(profilePacks.filter(([, pack]) => ["enabled", "required"].includes(pack.state)).map(([id]) => id));
  const requiredPacks = new Set(profilePacks.filter(([, pack]) => pack.state === "required").map(([id]) => id));
  const manifestValidation = validatePackManifests(packManifests);
  if (!manifestValidation.valid) return { launch: null, valid: false, errors: [...errors, ...manifestValidation.errors] };
  const manifests = new Map(manifestValidation.manifests.map((pack) => [pack.id, pack]));
  for (const id of activePacks) {
    const manifest = manifests.get(id);
    if (!manifest) {
      errors.push(`active pack manifest is unavailable: ${id}`);
      continue;
    }
    for (const dependency of manifest.dependencies) if (!activePacks.has(dependency)) errors.push(`${id}: missing active dependency ${dependency}`);
    for (const conflict of manifest.conflicts) if (activePacks.has(conflict)) errors.push(`${id}: conflicts with active pack ${conflict}`);
  }
  for (const pack of envelope.packs ?? []) if (!activePacks.has(pack)) errors.push(`task requests inactive pack: ${pack}`);
  for (const pack of requiredPacks) if (!(envelope.packs ?? []).includes(pack)) errors.push(`task omits required pack: ${pack}`);
  const effectivePackManifests = Object.fromEntries([...activePacks].sort().flatMap((id) => {
    const manifest = manifests.get(id);
    return manifest ? [[id, digest(manifest)]] : [];
  }));
  const requestedPackManifests = Object.fromEntries([...(envelope.packs ?? [])].sort().flatMap((id) => (
    Object.hasOwn(effectivePackManifests, id) ? [[id, effectivePackManifests[id]]] : []
  )));
  const launch = {
    schemaVersion: "1.0",
    envelope: { ...envelope, packs: requestedPackManifests },
    effectiveProfile: { digest: digest(profile) },
    effectivePackManifests,
    effectiveRuleSources: [...new Set(["ForgeRail Core", ...(profile.rules ?? []).map((rule) => rule.source)])],
    hostAgent,
    executionOwner: "host-agent",
  };
  const launchResult = validateContract("launch", launch);
  errors.push(...launchResult.errors);
  return { launch, valid: errors.length === 0, errors };
}

function git(workspace, ...args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
  const result = spawnSync("git", args, { cwd: workspace, env: { ...env, LC_ALL: "C", LANG: "C" }, encoding: "utf8", timeout: 10_000, maxBuffer: 1024 * 1024 });
  return { ok: result.status === 0 && !result.error, value: result.stdout?.trim() ?? "", status: result.status, code: result.error?.code ?? null, stderr: result.stderr?.trim().slice(0, 512) ?? "" };
}

export function verifyReceipt(receipt, workspace) {
  const validation = validateContract("receipt", receipt);
  const errors = [...validation.errors];
  const observations = {};
  const verifiedClaims = [], unverifiedClaims = [];
  let observationStatus = "not-observed";
  const result = () => ({ valid: errors.length === 0, schemaValid: validation.valid, verificationScope: "local-observation", observationStatus, closeout: errors.length === 0 ? receipt.closeout : "incomplete", observations, verifiedClaims, unverifiedClaims, errors });
  if (!validation.valid) return result();
  unverifiedClaims.push("ownerWorkspace", "taskId", "changedScope", "validationEvidence", "externalSideEffects", "residualRisks", "rollbackOrRecovery", "deviations");
  // A v1 receipt contains strings, not independently verified task/evidence bindings.
  if (receipt.closeout === "complete") {
    unverifiedClaims.push("closeout");
    errors.push("complete cannot be verified from self-reported v1 task and validation evidence");
  }
  let root;
  try {
    root = realpathSync(resolve(workspace));
    if (!statSync(root).isDirectory()) {
      observationStatus = "invalid-workspace";
      errors.push("workspace must be an existing directory");
      return result();
    }
    accessSync(root, constants.R_OK | constants.X_OK);
    observations.workspace = root;
  } catch (error) {
    observationStatus = ["ENOENT", "ENOTDIR", "ERR_INVALID_ARG_TYPE"].includes(error.code) ? "invalid-workspace" : "unavailable";
    errors.push(`workspace observation failed: ${error.code ?? "UNKNOWN"}`);
    return result();
  }
  const probe = git(root, "rev-parse", "--is-inside-work-tree");
  const unavailable = observation => {
    observationStatus = "unavailable";
    observations.gitError = { status: observation.status, code: observation.code, stderr: observation.stderr };
    errors.push(`Git observation failed: ${observation.code ?? `exit ${observation.status}`}`);
  };
  const nonGit = !probe.code && probe.status === 128 && /^fatal: not a git repository(?:\s|\()/i.test(probe.stderr);
  if (!probe.ok && !nonGit) { unavailable(probe); return result(); }
  observations.git = probe.ok && probe.value === "true";
  if (observations.git) {
    observationStatus = "available";
    for (const [field, args] of [["branch", ["branch", "--show-current"]], ["commit", ["rev-parse", "--verify", "--quiet", "HEAD"]], ["worktree", ["status", "--porcelain=v1"]]]) {
      const observation = git(root, ...args);
      if (field === "commit" && observation.status === 1 && !observation.code) {
        // An unborn branch has a symbolic HEAD but no branch ref. Do not infer
        // this from stderr alone or swallow corrupt refs / Git failures.
        const head = git(root, "symbolic-ref", "--quiet", "HEAD");
        if (head.ok && head.value.startsWith("refs/heads/")) {
          const ref = git(root, "show-ref", "--verify", "--quiet", head.value);
          if (ref.status === 1 && !ref.code) { observations.commit = null; continue; }
        }
      }
      if (!observation.ok) { unavailable(observation); return result(); }
      observations[field] = field === "worktree" ? (observation.value === "" ? "clean" : "dirty") : observation.value;
    }
    if (receipt.branch !== null && receipt.branch !== observations.branch) errors.push(`receipt branch mismatch: ${receipt.branch} != ${observations.branch}`);
    if (receipt.commit !== null && receipt.commit !== observations.commit) errors.push(`receipt commit mismatch: ${receipt.commit} != ${observations.commit}`);
    if (receipt.confirmedNonMutations.includes("clean worktree") && observations.worktree !== "clean") errors.push("receipt claims clean worktree but observable Git state is dirty");
    for (const field of ["branch", "commit"]) {
      (receipt[field] !== null && receipt[field] === observations[field] ? verifiedClaims : unverifiedClaims).push(field);
    }
    if (receipt.confirmedNonMutations.includes("clean worktree") && observations.worktree === "clean") verifiedClaims.push("confirmedNonMutations:clean worktree");
  } else {
    observationStatus = "not-a-git-workspace";
    if (receipt.branch !== null || receipt.commit !== null) errors.push("receipt declares Git identity for a non-Git workspace");
  }
  unverifiedClaims.push(...receipt.confirmedNonMutations.filter(claim => claim !== "clean worktree" || !observations.git).map(claim => `confirmedNonMutations:${claim}`));
  return result();
}
