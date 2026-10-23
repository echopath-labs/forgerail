import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { branchObservationLimits, checkBranchPolicy } from "./lib/branch-policy.mjs";

const policy = { status: "resolved", revision: "profile-v1", source: "project", prefixes: { feature: ["feat/"], fix: ["fix/", "hotfix/"], maintenance: ["chore/"], documentation: ["docs/"] }, sourceIds: ["rules"], claimIds: ["branch-naming"], operationId: "branch-create" };
function git(workspace, ...args) {
  const result = spawnSync("git", args, { cwd: workspace, encoding: "utf8", env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_AUTHOR_NAME: "Fixture", GIT_AUTHOR_EMAIL: "fixture@example.invalid", GIT_COMMITTER_NAME: "Fixture", GIT_COMMITTER_EMAIL: "fixture@example.invalid" } });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function fixture(t) {
  const workspace = realpathSync(mkdtempSync(join(tmpdir(), "forgerail-branch-")));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  git(workspace, "init", "-q", "-b", "main");
  writeFileSync(join(workspace, "file.txt"), "baseline\n");
  git(workspace, "add", "file.txt"); git(workspace, "commit", "-qm", "baseline");
  return workspace;
}
function check(workspace, options = {}, dependencies) {
  return checkBranchPolicy({ workspace, taskType: "feature", branch: "feat/test", intent: "create", checkout: true, policy, ...options }, dependencies);
}
const has = (result, code) => result.issues.some(item => item.code === code);
function treeDigest(root) {
  const entries = [];
  function visit(path, relative = "") {
    for (const entry of readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = join(relative, entry.name), location = join(path, entry.name);
      if (entry.isDirectory()) visit(location, name);
      else entries.push([name, readFileSync(location).toString("base64")]);
    }
  }
  visit(root);
  return createHash("sha256").update(JSON.stringify(entries)).digest("hex");
}
function rawRunner(workspace, args) {
  const result = spawnSync("git", ["--no-optional-locks", ...args], { cwd: workspace });
  return { status: result.status, error: result.error?.code ?? null, output: result.stdout.toString("utf8") };
}

test("B01: explicit feature policy rejects tool namespace; reads preserve all fixture bytes", t => {
  const workspace = fixture(t);
  writeFileSync(join(workspace, "untracked.txt"), "retain me\n");
  writeFileSync(join(workspace, "file.txt"), "staged\n"); git(workspace, "add", "file.txt");
  writeFileSync(join(workspace, "file.txt"), "unstaged\n");
  const digest = treeDigest(workspace);
  const wrong = check(workspace, { branch: "codex/test" });
  assert.equal(wrong.status, "mismatch"); assert.ok(has(wrong, "prefix-mismatch"));
  assert.equal(check(workspace).status, "pass");
  assert.equal(treeDigest(workspace), digest, "observer changed working tree, index or Git metadata");
});

test("B03: actual create/checkout closes the loop, including normal subsequent commits", t => {
  const workspace = fixture(t), before = check(workspace);
  assert.equal(before.status, "pass");
  git(workspace, "switch", "-qc", "feat/test");
  writeFileSync(join(workspace, "file.txt"), "subsequent commit\n");
  git(workspace, "add", "file.txt"); git(workspace, "commit", "-qm", "follow-up");
  const digest = treeDigest(workspace), after = check(workspace, { phase: "after", before });
  assert.equal(after.status, "pass", JSON.stringify(after.issues));
  assert.deepEqual(after.comparison.addedRefs, ["refs/heads/feat/test"]);
  assert.notEqual(after.observation.head.sha, before.observation.head.sha);
  assert.equal(after.comparison.taskOwnership, "unverified");
  assert.equal(after.comparison.correctionAuthorized, false);
  assert.equal(treeDigest(workspace), digest, "post-check changed working tree, index or Git metadata");
});

test("B04: create without checkout checks target ref and preserves current HEAD branch", t => {
  const workspace = fixture(t), before = check(workspace, { checkout: false });
  git(workspace, "branch", "feat/test");
  const after = check(workspace, { phase: "after", checkout: false, before });
  assert.equal(after.status, "pass", JSON.stringify(after.issues));
  assert.equal(after.observation.head.ref, "refs/heads/main");
  git(workspace, "switch", "-q", "feat/test");
  assert.ok(has(check(workspace, { phase: "after", checkout: false, before }), "unexpected-checkout"));
});

test("B02: wrong actual branch is reported, and a host correction can be rechecked", t => {
  const workspace = fixture(t), before = check(workspace);
  git(workspace, "switch", "-qc", "codex/test");
  const wrong = check(workspace, { phase: "after", before });
  assert.notEqual(wrong.status, "pass");
  assert.ok(has(wrong, "head-mismatch")); assert.ok(has(wrong, "target-missing-after"));
  assert.ok(has(wrong, "unexpected-ref-changes")); assert.equal(wrong.comparison.correctionAuthorized, false);
  const sha = git(workspace, "rev-parse", "HEAD");
  git(workspace, "branch", "-m", "feat/test");
  const after = check(workspace, { phase: "after", before });
  assert.equal(after.status, "pass"); assert.equal(after.observation.head.sha, sha);
});

test("B05: historical reuse is observed, but new wrong branches cannot claim a reuse exemption", t => {
  const workspace = fixture(t);
  git(workspace, "branch", "legacy/test");
  const before = check(workspace, { branch: "legacy/test", intent: "reuse" });
  assert.equal(before.status, "pass"); assert.ok(has(before, "historical-reuse"));
  git(workspace, "switch", "-q", "legacy/test");
  assert.equal(check(workspace, { phase: "after", branch: "legacy/test", intent: "reuse", before }).status, "pass");
  assert.ok(has(check(workspace, { branch: "legacy/new", intent: "reuse" }), "reuse-target-missing"));
  const createBefore = check(workspace);
  git(workspace, "switch", "-qc", "codex/new");
  const switchedIntent = check(workspace, { phase: "after", branch: "codex/new", intent: "reuse", before: createBefore });
  assert.equal(switchedIntent.status, "unknown"); assert.ok(has(switchedIntent, "intent-changed"));
});

test("B07: exact owner, detached HEAD, changed policy and changed worktree cannot pass", t => {
  const workspace = fixture(t), before = check(workspace);
  mkdirSync(join(workspace, "child"));
  assert.equal(check(join(workspace, "child")).status, "unknown");
  const other = fixture(t);
  assert.ok(has(check(other, { phase: "after", before }), "owner-changed"));
  git(workspace, "switch", "-qc", "feat/test");
  for (const changed of [{ ...policy, revision: "v2" }, { ...policy, prefixes: { ...policy.prefixes, feature: ["feature/"] } }]) {
    const result = check(workspace, { phase: "after", before, policy: changed });
    assert.equal(result.status, "unknown"); assert.ok(has(result, "policy-changed"));
  }
  git(workspace, "checkout", "-q", "--detach");
  assert.ok(has(check(workspace, { phase: "after", before }), "detached-head"));
});

test("B09/B10: target conflict and checkout in another worktree retain state", t => {
  const workspace = fixture(t);
  git(workspace, "branch", "feat/test");
  assert.ok(has(check(workspace), "target-exists"));
  const linked = join(workspace, "linked");
  git(workspace, "worktree", "add", "-q", linked, "feat/test");
  const result = check(workspace, { intent: "reuse" });
  assert.equal(result.status, "mismatch"); assert.ok(has(result, "target-other-worktree"));
  assert.equal(git(linked, "branch", "--show-current"), "feat/test");
  const linkedBefore = check(linked, { branch: "feat/linked" });
  assert.equal(linkedBefore.status, "pass", JSON.stringify(linkedBefore.issues));
  assert.ok(has(check(workspace, { phase: "after", branch: "feat/linked", before: linkedBefore }), "owner-changed"));
});

test("missing, tampered, failed, malformed before snapshots remain unknown", t => {
  const workspace = fixture(t), before = check(workspace);
  git(workspace, "switch", "-qc", "feat/test");
  const tampered = structuredClone(before); tampered.snapshot.observation.refs["refs/heads/main"] = "a".repeat(40);
  const failed = structuredClone(before); failed.snapshot.preflightStatus = "mismatch";
  const malformed = { kind: "branch-policy-before", schemaVersion: 1, preflightStatus: "pass", observation: {} };
  for (const value of [null, {}, tampered, failed, malformed]) {
    const result = check(workspace, { phase: "after", before: value });
    assert.equal(result.status, "unknown"); assert.ok(has(result, "before-untrusted"));
  }
});

test("snapshot supplies no authority even when its digest is valid", t => {
  const workspace = fixture(t), before = check(workspace);
  git(workspace, "switch", "-qc", "feat/test");
  const result = check(workspace, { phase: "after", before: JSON.parse(JSON.stringify(before)) });
  assert.equal(result.status, "pass");
  assert.ok(result.limitations.some(text => /not authenticated/.test(text)));
  assert.ok(result.limitations.some(text => /No remote/.test(text)));
  assert.equal(result.comparison.correctionAuthorized, false);
});

test("portable defaults remain recommendations; unresolved policy does not become a default", t => {
  const workspace = fixture(t);
  const defaults = check(workspace, { branch: "user-choice/test", policy: { ...policy, source: "portable-defaults" } });
  assert.equal(defaults.status, "mismatch"); assert.match(defaults.issues[0].message, /nonmandatory/);
  for (const value of [null, { ...policy, status: "unresolved" }, { ...policy, status: "invalid" }]) {
    const result = check(workspace, { policy: value });
    assert.equal(result.status, "unknown"); assert.ok(has(result, "policy-unresolved"));
  }
});

test("invalid names are literal input and never shell or checkout revision syntax", t => {
  const workspace = fixture(t);
  for (const branch of ["-bad", "@{-1}", "HEAD", "feat/bad space", "feat/bad\0name", "feat/test;touch pwned", "feat//bad", "feat/a..b"]) {
    const result = check(workspace, { branch });
    assert.equal(result.status, "mismatch"); assert.ok(has(result, "invalid-branch-name"));
  }
});

test("failed, timed out, oversized and truncated Git observations are unknown", t => {
  const workspace = fixture(t);
  for (const fault of [
    { status: 128, error: null, output: "" },
    { status: null, error: "ETIMEDOUT", output: "partial" },
    { status: 0, error: null, output: "x".repeat(branchObservationLimits.bytes + 1) },
    { status: 0, error: null, output: "refs/heads/main\0" + "a".repeat(40) },
  ]) {
    const result = check(workspace, {}, { runGit: (root, args) => args[0] === "for-each-ref" ? fault : rawRunner(root, args) });
    assert.equal(result.status, "unknown"); assert.ok(has(result, "observation-incomplete"));
  }
  const limit = check(workspace, {}, { runGit: (root, args) => args[0] === "for-each-ref"
    ? { status: 0, error: null, output: Array.from({ length: branchObservationLimits.refs + 1 }, (_, index) => `refs/heads/b${index}\0${"a".repeat(40)}\n`).join("") }
    : rawRunner(root, args) });
  assert.equal(limit.status, "unknown"); assert.match(limit.issues[0].message, /limit/);
  const truncatedWorktree = check(workspace, {}, { runGit: (root, args) => {
    const result = rawRunner(root, args);
    return args[0] === "worktree" ? { ...result, output: result.output.slice(0, -1) } : result;
  } });
  assert.equal(truncatedWorktree.status, "unknown"); assert.match(truncatedWorktree.issues[0].message, /incomplete worktree/);
});

test("visible concurrent Git changes during or between observations cannot establish success", t => {
  const workspace = fixture(t);
  let refReads = 0;
  const raced = check(workspace, {}, { runGit: (root, args) => {
    if (args[0] === "for-each-ref" && ++refReads === 2) git(root, "branch", "feat/concurrent");
    return rawRunner(root, args);
  } });
  assert.equal(raced.status, "unknown"); assert.match(raced.issues[0].message, /changed during/);
  const before = check(workspace);
  git(workspace, "switch", "-qc", "feat/test");
  git(workspace, "branch", "feat/another-task");
  const after = check(workspace, { phase: "after", before });
  assert.equal(after.status, "unknown"); assert.ok(has(after, "unexpected-ref-changes"));
});

test("inherited GIT_DIR/GIT_WORK_TREE cannot redirect an observation", t => {
  const workspace = fixture(t), other = fixture(t);
  const previous = { GIT_DIR: process.env.GIT_DIR, GIT_WORK_TREE: process.env.GIT_WORK_TREE };
  try {
    process.env.GIT_DIR = join(other, ".git"); process.env.GIT_WORK_TREE = other;
    const result = check(workspace);
    assert.equal(result.status, "pass", JSON.stringify(result.issues));
    assert.equal(result.observation.identity.owner, workspace);
  } finally {
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

test('another detached worktree moving commits cannot pass the after check', t => {
  const workspace=fixture(t), first=git(workspace,'rev-parse','HEAD');
  git(workspace,'commit','--allow-empty','-qm','second');
  const second=git(workspace,'rev-parse','HEAD'), linked=join(workspace,'detached');
  git(workspace,'worktree','add','--detach',linked,first);
  const before=check(workspace); assert.equal(before.status,'pass');
  git(workspace,'switch','-qc','feat/test');
  assert.equal(check(workspace,{phase:'after',before}).status,'pass');
  git(linked,'checkout','--detach',second);
  assert.ok(has(check(workspace,{phase:'after',before}),'worktree-topology-changed'));
});
test('unborn and uncommitted orphan branches remain explicitly unverified', t => {
  const workspace=fixture(t);
  git(workspace,'switch','--orphan','empty');
  const result=check(workspace);
  assert.equal(result.valid,false);
  assert.ok(has(result,'observation-incomplete'));
  assert.ok(result.limitations.some(x=>x.includes('unborn')));
});

test('existing credential-like refs never enter branch observation output', t => {
  const workspace=fixture(t), sentinel='npm_'+'z'.repeat(40);
  git(workspace,'branch',sentinel);
  const result=check(workspace);
  assert.equal(result.valid,false);
  assert.equal(result.observation,null);
  assert.equal(result.snapshot,null);
  assert.equal(JSON.stringify(result).includes(sentinel),false);
});
test('symbolic branch aliases cannot satisfy creation without checkout', t => {
  const workspace=fixture(t), before=check(workspace,{checkout:false});
  assert.equal(before.valid,true);
  git(workspace,'symbolic-ref','refs/heads/feat/test','refs/heads/main');
  const result=check(workspace,{phase:'after',checkout:false,before});
  assert.equal(result.valid,false);
  assert.ok(has(result,'observation-incomplete'));
});

test('reuse without checkout rejects movement of a noncurrent target', t => {
  const workspace=fixture(t);
  git(workspace,'branch','feat/test');
  git(workspace,'commit','--allow-empty','-qm','next');
  const options={intent:'reuse',checkout:false}, before=check(workspace,options);
  assert.equal(before.valid,true);
  assert.equal(check(workspace,{...options,phase:'after',before}).valid,true);
  git(workspace,'update-ref','refs/heads/feat/test',git(workspace,'rev-parse','HEAD'));
  const after=check(workspace,{...options,phase:'after',before});
  assert.equal(after.valid,false);
  assert.ok(has(after,'unexpected-ref-changes'));
});
