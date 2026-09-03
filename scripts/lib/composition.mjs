import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
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
  for (const id of duplicateIds((input.packs ?? []).map((pack) => pack?.id))) conflicts.push(`${id}: duplicate pack state identity`);
  for (const identity of duplicateIds((input.rules ?? []).map((rule) => `${rule?.id}\u0000${rule?.source}`))) {
    const [id, source] = identity.split("\u0000");
    conflicts.push(`${id}: duplicate rule source identity (${source})`);
  }
  const selected = new Map();
  for (const rule of input.rules ?? []) {
    const prior = selected.get(rule.id);
    if (!prior || rule.precedence < prior.precedence) selected.set(rule.id, rule);
    else if (rule.precedence === prior.precedence && !equalValue(rule.value, prior.value)) {
      conflicts.push(`${rule.id}: equal-precedence sources disagree (${prior.source} vs ${rule.source})`);
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
    packs: (input.packs ?? []).map((pack) => ({ id: pack.id, state: pack.state, reason: pack.reason })),
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
  const activePacks = new Set((profile.packs ?? []).filter((pack) => ["enabled", "required"].includes(pack.state)).map((pack) => pack.id));
  const requiredPacks = new Set((profile.packs ?? []).filter((pack) => pack.state === "required").map((pack) => pack.id));
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
  const launch = {
    schemaVersion: "1.0",
    envelope,
    effectiveProfile: { digest: digest(profile) },
    effectivePackManifests: Object.fromEntries([...activePacks].sort().flatMap((id) => {
      const manifest = manifests.get(id);
      return manifest ? [[id, digest(manifest)]] : [];
    })),
    effectiveRuleSources: [...new Set(["ForgeRail Core", ...(profile.rules ?? []).map((rule) => rule.source)])],
    hostAgent,
    executionOwner: "host-agent",
  };
  const launchResult = validateContract("launch", launch);
  errors.push(...launchResult.errors);
  return { launch, valid: errors.length === 0, errors };
}

function git(workspace, ...args) {
  const result = spawnSync("git", args, { cwd: workspace, encoding: "utf8", timeout: 10_000, maxBuffer: 1024 * 1024 });
  return result.status === 0 ? result.stdout.trim() : null;
}

export function verifyReceipt(receipt, workspace) {
  const validation = validateContract("receipt", receipt);
  const errors = [...validation.errors];
  const observations = {};
  if (!validation.valid) return { valid: false, closeout: "incomplete", observations, errors };
  const root = resolve(workspace);
  const inside = git(root, "rev-parse", "--is-inside-work-tree") === "true";
  observations.git = inside;
  if (inside) {
    observations.branch = git(root, "branch", "--show-current");
    observations.commit = git(root, "rev-parse", "HEAD");
    observations.worktree = git(root, "status", "--porcelain=v1") === "" ? "clean" : "dirty";
    if (receipt.branch !== null && receipt.branch !== observations.branch) errors.push(`receipt branch mismatch: ${receipt.branch} != ${observations.branch}`);
    if (receipt.commit !== null && receipt.commit !== observations.commit) errors.push(`receipt commit mismatch: ${receipt.commit} != ${observations.commit}`);
    if (receipt.confirmedNonMutations.includes("clean worktree") && observations.worktree !== "clean") errors.push("receipt claims clean worktree but observable Git state is dirty");
  } else if (receipt.branch !== null || receipt.commit !== null) errors.push("receipt declares Git identity for a non-Git workspace");
  return {
    valid: errors.length === 0,
    closeout: errors.length === 0 ? receipt.closeout : "incomplete",
    observations,
    errors,
  };
}
