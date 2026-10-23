import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { containsInlineSecret } from "./contracts.mjs";

// This observer neither locks refs nor establishes task ownership. Double reads
// detect visible races, but cannot prove the absence of an intervening writer.
export const branchObservationLimits = Object.freeze({ bytes: 1024 * 1024, refs: 4096, worktrees: 128, timeoutMs: 2000, totalMs: 10000 });
const types = ["feature", "fix", "maintenance", "documentation"];
const oid = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
const ref = /^refs\/heads\/[^\x00-\x20\x7f]+$/;
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const issue = (code, message, severity = "unknown") => ({ code, message, severity });
const limitations = [
  "Local observations apply only at observation time; direct Git commands can bypass this check.",
  "An existing HEAD commit is required; unborn and uncommitted orphan branches remain unverified, not prohibited.",
  "Snapshots are caller-supplied observation material, not authenticated receipts or authorization.",
  "No remote, push status, task ownership, other-task dependencies, non-force creation record, or preservation of index/worktree contents is verified. The host must establish all correction conditions separately.",
  "A matching branch prefix does not establish the correctness of the host's task classification.",
];

function readGit(workspace, args, timeout) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
  const result = spawnSync("git", ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "core.untrackedCache=false", ...args], {
    cwd: workspace, env: { ...env, LC_ALL: "C", LANG: "C", GIT_NO_LAZY_FETCH: "1", GIT_TERMINAL_PROMPT: "0", GIT_ALLOW_PROTOCOL: "" },
    timeout, maxBuffer: branchObservationLimits.bytes,
  });
  let output;
  try { output = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(result.stdout ?? Buffer.alloc(0)); }
  catch { return { status: null, error: "encoding", output: "" }; }
  return { status: result.status, error: result.error?.code ?? null, output };
}

function policyBinding(policy) {
  return { status: policy?.status ?? "unresolved", revision: policy?.revision ?? null, source: policy?.source ?? null,
    prefixes: Object.fromEntries(types.map(type => [type, policy?.prefixes?.[type] ?? null])),
    claimIds: policy?.claimIds ?? [], sourceIds: policy?.sourceIds ?? [], operationId: policy?.operationId ?? null };
}

function validPolicy(policy) {
  return policy.status === "resolved" && typeof policy.revision === "string" && policy.revision.length > 0
    && ["project", "portable-defaults"].includes(policy.source)
    && types.every(type => Array.isArray(policy.prefixes[type]) && policy.prefixes[type].length > 0
      && policy.prefixes[type].every(prefix => typeof prefix === "string" && prefix.length > 0 && prefix.length <= 256 && !/[\x00-\x20\x7f]/.test(prefix)));
}

function parseRefs(output) {
  if (output !== "" && !output.endsWith("\n")) throw new Error("incomplete refs output");
  const lines = output === "" ? [] : output.slice(0, -1).split("\n");
  if (lines.length > branchObservationLimits.refs) throw new Error("local ref observation limit exceeded");
  const refs = {};
  for (const line of lines) {
    const [name, sha, symbolicTarget, extra] = line.split("\0");
    if (symbolicTarget !== "") throw new Error("symbolic branch refs are not supported");
    if (extra !== undefined || !ref.test(name) || !oid.test(sha) || Object.hasOwn(refs, name)) throw new Error("malformed refs output");
    refs[name] = sha;
  }
  return refs;
}

function parseWorktrees(output) {
  if (!output.endsWith("\0\0")) throw new Error("incomplete worktree output");
  const blocks = output.slice(0, -2).split("\0\0");
  if (blocks.length > branchObservationLimits.worktrees) throw new Error("worktree observation limit exceeded");
  return blocks.map(block => {
    const lines = block.split("\0"), path = lines.shift();
    if (!path.startsWith("worktree ") || !isAbsolute(path.slice(9))) throw new Error("malformed worktree output");
    const head = lines.find(line => line.startsWith("HEAD "))?.slice(5);
    const branch = lines.find(line => line.startsWith("branch "))?.slice(7) ?? null;
    if (!oid.test(head ?? "") || (branch !== null && !ref.test(branch))) throw new Error("malformed worktree HEAD/ref");
    return { path: path.slice(9), head, branch, detached: lines.includes("detached"), locked: lines.some(line => line === "locked" || line.startsWith("locked ")), prunable: lines.some(line => line === "prunable" || line.startsWith("prunable ")) };
  });
}

function metadataOwner(root) {
  for (let path = root; ; path = dirname(path)) {
    try { lstatSync(resolve(path, ".git")); return path; }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    if (dirname(path) === path) return null;
  }
}

function observe(workspace, run) {
  const owner = metadataOwner(workspace);
  if (owner !== workspace) throw new Error("workspace must be the exact Git owner root");
  const top = run(["rev-parse", "--show-toplevel"]).trim();
  const gitDir = run(["rev-parse", "--absolute-git-dir"]).trim();
  const commonDir = run(["rev-parse", "--path-format=absolute", "--git-common-dir"]).trim();
  if (!isAbsolute(top) || realpathSync(top) !== workspace || !isAbsolute(gitDir) || !isAbsolute(commonDir)) throw new Error("Git owner identity mismatch");
  const headRef = run(["symbolic-ref", "--quiet", "HEAD"], true).trim() || null;
  const head = run(["rev-parse", "--verify", "HEAD"]).trim();
  const refs = parseRefs(run(["for-each-ref", "--format=%(refname)%00%(objectname)%00%(symref)", "refs/heads/"]));
  const worktrees = parseWorktrees(run(["worktree", "list", "--porcelain", "-z"]));
  if (!oid.test(head) || (headRef !== null && (!ref.test(headRef) || refs[headRef] !== head))) throw new Error("HEAD/ref observation inconsistent");
  const self = worktrees.filter(item => realpathSync(item.path) === workspace);
  if (self.length !== 1 || self[0].head !== head || self[0].branch !== headRef) throw new Error("worktree/HEAD observation inconsistent");
  return { identity: { owner: workspace, gitDir: realpathSync(gitDir), commonDir: realpathSync(commonDir) }, head: { ref: headRef, sha: head }, refs, worktrees };
}

function validObservation(value) {
  return value && typeof value === "object" && value.identity && ["owner", "gitDir", "commonDir"].every(key => typeof value.identity[key] === "string" && isAbsolute(value.identity[key]))
    && value.head && oid.test(value.head.sha) && (value.head.ref === null || ref.test(value.head.ref))
    && value.refs && typeof value.refs === "object" && !Array.isArray(value.refs) && Object.keys(value.refs).length <= branchObservationLimits.refs
    && Object.entries(value.refs).every(([key, sha]) => ref.test(key) && oid.test(sha))
    && (value.head.ref === null || value.refs[value.head.ref] === value.head.sha)
    && Array.isArray(value.worktrees) && value.worktrees.length > 0 && value.worktrees.length <= branchObservationLimits.worktrees
    && value.worktrees.every(item => item && typeof item.path === "string" && isAbsolute(item.path) && oid.test(item.head) && (item.branch === null || ref.test(item.branch))
      && ["detached", "locked", "prunable"].every(key => typeof item[key] === "boolean"))
    && value.worktrees.filter(item => item.path === value.identity.owner && item.head === value.head.sha && item.branch === value.head.ref).length === 1;
}

function unpackSnapshot(before) {
  if (containsInlineSecret(before)) return null;
  const snapshot = before?.snapshot ?? before;
  if (!snapshot || snapshot.kind !== "branch-policy-before" || snapshot.schemaVersion !== 1 || snapshot.preflightStatus !== "pass"
    || typeof snapshot.observedAt !== "string" || !Number.isFinite(Date.parse(snapshot.observedAt)) || Date.parse(snapshot.observedAt) > Date.now() + 1000
    || !validObservation(snapshot.observation) || !snapshot.input || !validPolicy(snapshot.policy)) return null;
  const { digest, ...payload } = snapshot;
  if (digest !== hash(payload)) return null;
  return snapshot;
}

/** Bounded, local-only pre/post observation; never executes a Git mutation. */
export function checkBranchPolicy({ workspace, phase = "before", taskType, branch, intent = "create", checkout = true, targetId = null, policy, before = null }, { runGit = readGit } = {}) {
  if (containsInlineSecret({ phase, taskType, branch, intent, checkout, targetId })) throw new Error("branch check input is unsafe or contains credential-like material");
  const issues = [], binding = policyBinding(policy), input = { taskType, branch, intent, checkout, targetId };
  const result = { schemaVersion: 1, kind: "branch-policy-check", phase, status: "unknown", valid: false, issues, policy: binding, input, observation: null, snapshot: null, comparison: null, limitations };
  const finish = () => { result.status = issues.some(item => item.severity === "unknown") ? "unknown" : issues.some(item => item.severity === "mismatch") ? "mismatch" : "pass"; result.valid = result.status === "pass"; return result; };
  if (!["before", "after"].includes(phase) || !types.includes(taskType) || typeof branch !== "string" || branch.length > 1024 || !["create", "reuse"].includes(intent) || typeof checkout !== "boolean") {
    issues.push(issue("invalid-input", "Provide a known task type, branch, create/reuse intent and boolean checkout intent.")); return finish();
  }
  if (!validPolicy(binding)) { issues.push(issue("policy-unresolved", "Branch naming policy is invalid, unresolved or conflicting; re-resolve its sources.")); return finish(); }
  let root;
  try { root = realpathSync(resolve(workspace)); }
  catch { issues.push(issue("owner-unavailable", "The exact owner workspace is unavailable.")); return finish(); }
  const deadline = performance.now() + branchObservationLimits.totalMs;
  const run = (args, detached = false) => {
    const remaining = Math.ceil(deadline - performance.now());
    if (remaining <= 0) throw new Error("Git observation time limit exceeded");
    const observed = runGit(root, args, Math.min(remaining, branchObservationLimits.timeoutMs));
    if (typeof observed?.output !== "string" || Buffer.byteLength(observed.output) > branchObservationLimits.bytes || observed.error || (observed.status !== 0 && !(detached && observed.status === 1 && observed.output === ""))) throw new Error("Git observation failed, timed out, or exceeded output limit");
    return observed.output;
  };
  try {
    // --branch additionally rejects leading '-' and Git's reserved HEAD name.
    // Reject checkout's @{-n} shorthand before Git can expand it.
    if (branch.includes("@{") || branch.startsWith("-") || /[\x00-\x20\x7f]/.test(branch)) { issues.push(issue("invalid-branch-name", "Candidate is not a literal legal Git branch name.", "mismatch")); return finish(); }
    const validName = runGit(root, ["check-ref-format", "--branch", branch], branchObservationLimits.timeoutMs);
    if (validName.error || validName.status === null) throw new Error("Git name validation unavailable");
    if (validName.status !== 0) { issues.push(issue("invalid-branch-name", "Candidate is not a legal Git branch name.", "mismatch")); return finish(); }
    const first = observe(root, run), second = observe(root, run);
    if (hash(first) !== hash(second)) throw new Error("Git state changed during observation; ownership cannot be inferred");
    if (containsInlineSecret(second)) throw new Error("Git observation contains credential-like material");
    result.observation = second;
  } catch (error) { issues.push(issue("observation-incomplete", containsInlineSecret(error.message) ? "Git observation failed with sensitive context" : error.message)); return finish(); }
  const observation = result.observation, target = `refs/heads/${branch}`;
  if (observation.head.ref === null) issues.push(issue("detached-head", "Detached HEAD requires a fresh host decision; this check cannot establish the intended task branch."));
  const matches = binding.prefixes[taskType].some(prefix => branch.startsWith(prefix) && branch.length > prefix.length);
  const checkNaming = reuse => {
    if (!matches) issues.push(issue(reuse ? "historical-reuse" : "prefix-mismatch", reuse ? "Existing branch observed before the operation; naming alone does not require renaming. Host must establish task ownership." : binding.source === "portable-defaults" ? "Candidate differs from the selected portable naming recommendation; these defaults are nonmandatory and applicable project/user choices can override them." : "Candidate does not match the task type's allowed prefixes.", reuse ? "advisory" : "mismatch"));
  };
  if (phase === "before") {
    const exists = Object.hasOwn(observation.refs, target);
    if (intent === "create" && exists) issues.push(issue("target-exists", "Create intent cannot overwrite or masquerade as reuse of an existing local branch.", "mismatch"));
    if (intent === "reuse" && !exists) issues.push(issue("reuse-target-missing", "Reuse requires a local branch that already exists in the before observation.", "mismatch"));
    checkNaming(intent === "reuse" && exists);
    if (checkout && observation.worktrees.some(item => item.branch === target && item.path !== root)) issues.push(issue("target-other-worktree", "Target branch is checked out in another worktree.", "mismatch"));
    finish();
    const payload = { schemaVersion: 1, kind: "branch-policy-before", preflightStatus: result.status, observedAt: new Date().toISOString(), input, policy: binding, observation };
    result.snapshot = { ...payload, digest: hash(payload) };
    return result;
  }
  const snapshot = unpackSnapshot(before);
  if (!snapshot) { issues.push(issue("before-untrusted", "A complete passing before observation with intact structure/digest is required; it remains unauthenticated input.")); return finish(); }
  if (hash(snapshot.input) !== hash(input)) issues.push(issue("intent-changed", "Task type, candidate or operation intent changed; obtain a fresh before check."));
  if (hash(snapshot.policy) !== hash(binding)) issues.push(issue("policy-changed", "Policy revision, source or effective prefixes changed; obtain a fresh before check."));
  if (hash(snapshot.observation.identity) !== hash(observation.identity)) issues.push(issue("owner-changed", "Owner repository or worktree differs from the before observation."));
  const previous = snapshot.observation;
  const existedBefore = Object.hasOwn(previous.refs, target);
  if ((intent === "create" && existedBefore) || (intent === "reuse" && !existedBefore)) issues.push(issue("before-intent-inconsistent", "Before refs do not support the claimed create/reuse intent."));
  checkNaming(intent === "reuse" && existedBefore);
  const added = Object.keys(observation.refs).filter(name => !Object.hasOwn(previous.refs, name));
  const removed = Object.keys(previous.refs).filter(name => !Object.hasOwn(observation.refs, name));
  const moved = Object.keys(previous.refs).filter(name => Object.hasOwn(observation.refs, name) && previous.refs[name] !== observation.refs[name]);
  result.comparison = { candidateExistedBefore: existedBefore, candidateExistsAfter: Object.hasOwn(observation.refs, target), addedRefs: added, removedRefs: removed, movedRefs: moved, taskOwnership: "unverified", correctionAuthorized: false };
  if (!Object.hasOwn(observation.refs, target)) issues.push(issue("target-missing-after", "Expected local branch was not observed after the operation.", "mismatch"));
  if (checkout && observation.head.ref !== target) issues.push(issue("head-mismatch", "Actual HEAD branch does not match the checked candidate.", "mismatch"));
  if (!checkout && observation.head.ref !== previous.head.ref) issues.push(issue("unexpected-checkout", "Create/reuse without checkout unexpectedly changed the HEAD branch.", "mismatch"));
  if (removed.length || added.some(name => name !== target) || moved.some(name => name !== target || (intent === "reuse" && !checkout && target !== previous.head.ref))) issues.push(issue("unexpected-ref-changes", "Unrelated local refs changed between observations; concurrent or unrelated work is possible."));
  if (observation.worktrees.some(item => item.branch === target && item.path !== root)) issues.push(issue("target-other-worktree", "Target branch is checked out in another worktree; task isolation is unverified."));
  const worktreeTopology = value => value.worktrees.map(item => ({ ...item, head: item.path === root ? null : item.head, branch: item.path === root ? null : item.branch }));
  if (hash(worktreeTopology(previous)) !== hash(worktreeTopology(observation))) issues.push(issue("worktree-topology-changed", "Worktree identity or another worktree's checkout changed between observations."));
  return finish();
}
