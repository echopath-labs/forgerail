import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyReceipt } from "./lib/composition.mjs";
import { validateContract } from "./lib/contracts.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const receipt = { schemaVersion: "1.0", taskId: "test:observation", ownerWorkspace: "fixture", branch: null, commit: null, changedScope: [], validationEvidence: ["fixture"], externalSideEffects: [], confirmedNonMutations: ["clean worktree"], residualRisks: [], rollbackOrRecovery: "Disposable fixture.", deviations: [], closeout: "incomplete" };
const git = (cwd, ...args) => {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", timeout: 10000 });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};
const commit = dir => git(dir, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--allow-empty", "-m", "fixture");
function fixture(t, initialized = true) {
  const dir = mkdtempSync(join(tmpdir(), "forgerail-observation-"));
  t.after(() => rmSync(dir, { force: true, recursive: true }));
  if (initialized) {
    git(dir, "init", "-b", "main");
    writeFileSync(join(dir, "tracked.txt"), "original\n");
    git(dir, "add", "tracked.txt");
    commit(dir);
  }
  return dir;
}
function unavailable(dir) {
  const result = verifyReceipt(receipt, dir);
  assert.equal(result.valid, false);
  assert.equal(result.observationStatus, "unavailable");
  assert.equal(result.verifiedClaims.includes("confirmedNonMutations:clean worktree"), false);
  return result;
}
function command(t) {
  const dir = fixture(t, false), marker = join(dir, "executed"), script = join(dir, "driver.sh");
  // Only a harmless local sentinel; no network, credentials or user files.
  writeFileSync(script, `#!/bin/sh\nprintf observed > '${marker}'\ncat\n`);
  chmodSync(script, 0o700);
  return { script, marker };
}

test("clean means tracked, staged and non-ignored untracked, independent of presentation", t => {
  for (const kind of ["untracked", "tracked", "staged", "ignored"]) {
    const dir = fixture(t);
    writeFileSync(join(dir, ".gitignore"), "ignored\n");
    git(dir, "add", ".gitignore"); commit(dir);
    git(dir, "config", "status.showUntrackedFiles", "no");
    assert.equal(verifyReceipt(receipt, dir).valid, true);
    writeFileSync(join(dir, kind === "tracked" || kind === "staged" ? "tracked.txt" : kind), "changed\n");
    if (kind === "staged") git(dir, "add", "tracked.txt");
    const result = verifyReceipt(receipt, dir);
    assert.equal(result.valid, kind === "ignored", kind);
    assert.equal(result.observations.worktree, kind === "ignored" ? "clean" : "dirty");
  }
});

test("fsmonitor is disabled and observation does not refresh the index on disk", t => {
  const dir = fixture(t), { script, marker } = command(t);
  git(dir, "config", "core.fsmonitor", script);
  const before = readFileSync(join(dir, ".git/index"));
  const later = new Date(Date.now() + 100000);
  utimesSync(join(dir, "tracked.txt"), later, later);
  assert.equal(verifyReceipt(receipt, dir).valid, true);
  assert.equal(existsSync(marker), false);
  assert.deepEqual(readFileSync(join(dir, ".git/index")), before);
});

test("active clean/process filters from local, include and global config are not executed", t => {
  for (const mode of ["local-clean", "local-process", "include-clean", "global-process"]) {
    const dir = fixture(t), { script, marker } = command(t);
    writeFileSync(join(dir, ".gitattributes"), "tracked.txt filter=Review.Driver\n");
    git(dir, "add", ".gitattributes"); commit(dir);
    const kind = mode.endsWith("clean") ? "clean" : "process";
    const config = join(fixture(t, false), "config");
    const oldHome = process.env.HOME, oldXdg = process.env.XDG_CONFIG_HOME;
    try {
      if (mode.startsWith("global")) {
        process.env.HOME = fixture(t, false);
        process.env.XDG_CONFIG_HOME = join(process.env.HOME, "xdg");
        git(dir, "config", "--global", `filter.Review.Driver.${kind}`, script);
      } else if (mode.startsWith("include")) {
        git(dir, "config", "--file", config, `filter.Review.Driver.${kind}`, script);
        git(dir, "config", "include.path", config);
      } else git(dir, "config", `filter.Review.Driver.${kind}`, script);
      const later = new Date(Date.now() + 100000);
      utimesSync(join(dir, "tracked.txt"), later, later);
      unavailable(dir);
      assert.equal(existsSync(marker), false, mode);
    } finally {
      if (oldHome === undefined) delete process.env.HOME; else process.env.HOME = oldHome;
      if (oldXdg === undefined) delete process.env.XDG_CONFIG_HOME; else process.env.XDG_CONFIG_HOME = oldXdg;
    }
  }
});

test("unused filters stay compatible; attributes outside the requested subdirectory are checked", t => {
  const dir = fixture(t), { script, marker } = command(t);
  git(dir, "config", "filter.review.clean", script);
  assert.equal(verifyReceipt(receipt, dir).valid, true);
  mkdirSync(join(dir, "subdir"));
  writeFileSync(join(dir, ".git/info/attributes"), "tracked.txt filter=review\n");
  unavailable(join(dir, "subdir"));
  assert.equal(existsSync(marker), false);
});

test("submodules and hidden tracked-file index flags cannot certify clean", t => {
  for (const flag of ["--assume-unchanged", "--skip-worktree"]) {
    const dir = fixture(t);
    git(dir, "update-index", flag, "tracked.txt");
    writeFileSync(join(dir, "tracked.txt"), "hidden work\n");
    unavailable(dir);
  }
  const dir = fixture(t), child = fixture(t), { script, marker } = command(t);
  git(dir, "-c", "protocol.file.allow=always", "submodule", "add", child, "child"); commit(dir);
  const nested = join(dir, "child");
  writeFileSync(join(dir, ".git/modules/child/info/attributes"), "tracked.txt filter=nested\n");
  git(nested, "config", "filter.nested.clean", script);
  writeFileSync(join(nested, "tracked.txt"), "modified\n");
  unavailable(dir);
  assert.equal(existsSync(marker), false);
});

test("broken metadata and bare repositories are unavailable; normal and linked worktrees work", t => {
  const plain = fixture(t, false);
  assert.equal(verifyReceipt(receipt, plain).observationStatus, "not-a-git-workspace");
  for (const kind of ["missing-head", "bad-gitfile", "bare", "bare-missing-HEAD", "bare-missing-objects", "bare-missing-refs"]) {
    const dir = fixture(t, false);
    if (kind.includes("bare")) {
      git(dir, "init", "--bare");
      if (kind.startsWith("bare-missing-")) rmSync(join(dir, kind.slice("bare-missing-".length)), { recursive: true });
    } else if (kind === "bad-gitfile") writeFileSync(join(dir, ".git"), "gitdir: missing\n");
    else { git(dir, "init"); rmSync(join(dir, ".git/HEAD")); }
    unavailable(dir);
  }
  const dir = fixture(t), linked = join(fixture(t, false), "linked");
  const assets = join(dir, "assets");
  mkdirSync(join(assets, "objects"), { recursive: true });
  mkdirSync(join(assets, "refs"));
  assert.equal(verifyReceipt(receipt, assets).valid, true);
  git(dir, "worktree", "add", "-b", "linked", linked);
  assert.equal(verifyReceipt(receipt, linked).valid, true);
  writeFileSync(join(linked, "new.txt"), "work\n");
  assert.equal(verifyReceipt(receipt, linked).observations.worktree, "dirty");
  rmSync(join(dir, ".git/worktrees/linked/HEAD"));
  unavailable(linked);
});

test("attribute index fallback, worktree config and unusual UTF-8 paths preserve filter boundaries", t => {
  for (const mode of ["index-fallback", "worktree-config", "unusual-path"]) {
    const dir = fixture(t), { script, marker } = command(t);
    const path = mode === "unusual-path" ? "odd \t\né.txt" : "tracked.txt";
    writeFileSync(join(dir, path), "fixture\n");
    writeFileSync(join(dir, ".gitattributes"), "* filter=review\n");
    git(dir, "add", "."); commit(dir);
    if (mode === "worktree-config") {
      git(dir, "config", "extensions.worktreeConfig", "true");
      git(dir, "config", "--worktree", "filter.review.process", script);
    } else git(dir, "config", "filter.review.clean", script);
    if (mode === "index-fallback") rmSync(join(dir, ".gitattributes"));
    unavailable(dir);
    assert.equal(existsSync(marker), false);
  }
});

test("non-UTF8 index paths are unavailable instead of replacement-decoded attribute queries", t => {
  const dir = fixture(t), oid = git(dir, "rev-parse", "HEAD:tracked.txt");
  const result = spawnSync("git", ["update-index", "-z", "--index-info"], {
    cwd: dir, input: Buffer.concat([Buffer.from(`100644 ${oid}\tbad`), Buffer.from([0xff, 0])]), encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(unavailable(dir).observations.gitError.code, "GIT_OUTPUT_ENCODING");
});

test("ordinary metadata-named directories remain non-Git from root and child", t => {
  const names = ["objects", "refs", "HEAD", "config"];
  for (let a = 0; a < names.length; a++) for (let b = a + 1; b < names.length; b++) {
    const dir = fixture(t, false);
    for (const name of [names[a], names[b], "child"]) mkdirSync(join(dir, name));
    for (const workspace of [dir, join(dir, "child")]) {
      const result = verifyReceipt({ ...receipt, confirmedNonMutations: [] }, workspace);
      assert.equal(result.observationStatus, "not-a-git-workspace", `${names[a]} + ${names[b]}`);
      assert.equal(result.valid, true);
      assert.equal(result.verifiedClaims.includes("confirmedNonMutations:clean worktree"), false);
    }
  }
});

test("Host Adapter malformed bindingModes returns field errors through library and CLI", t => {
  const dir = fixture(t, false), input = join(dir, "adapter.json");
  const original = JSON.parse(readFileSync(join(root, "adapters/codex.json")));
  assert.equal(validateContract("host-adapter", original).valid, true);
  for (const bad of [{}, 1, false, null, [], [null], "thin-reference", [1], [{}]]) {
    const value = { ...original, bindingModes: bad };
    const result = validateContract("host-adapter", value);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes("hostAdapter.bindingModes")));
    writeFileSync(input, JSON.stringify(value));
    const cli = spawnSync(process.execPath, [join(root, "scripts/forgerail.mjs"), "validate-contract", "--type", "host-adapter", "--file", input], { encoding: "utf8" });
    assert.equal(cli.status, 1); assert.equal(cli.stderr, "");
    const output = JSON.parse(cli.stdout);
    assert.notEqual(output.code, "INTERNAL_ERROR");
    assert.ok(output.errors.some(error => error.includes("hostAdapter.bindingModes")));
  }
  for (const bindingModes of [["managed-block"], ["thin-reference", "unknown"]]) {
    assert.equal(validateContract("host-adapter", { ...original, bindingModes }).valid, false);
  }
});

test("Envelope and embedded Launch return field errors before semantic operations", t => {
  const dir = fixture(t, false), input = join(dir, "input.json");
  for (const type of ["envelope", "launch"]) {
    const filename = type === "envelope" ? "task-envelope" : "launch-contract";
    const original = JSON.parse(readFileSync(join(root, "scripts/fixtures/contracts", `${filename}.valid.json`)));
    assert.equal(validateContract(type, original).valid, true);
    for (const field of ["allowedOperations", "prohibitedOperations"]) {
      for (const bad of [null, {}, "read", 3, [null], [1]]) {
        const value = structuredClone(original), envelope = type === "envelope" ? value : value.envelope;
        envelope[field] = bad;
        const result = validateContract(type, value);
        assert.equal(result.valid, false);
        assert.ok(result.errors.some(error => error.includes(field)));
        writeFileSync(input, JSON.stringify(value));
        const cli = spawnSync(process.execPath, [join(root, "scripts/forgerail.mjs"), "validate-contract", "--type", type, "--file", input], { encoding: "utf8" });
        assert.equal(cli.status, 1); assert.equal(cli.stderr, "");
        const output = JSON.parse(cli.stdout);
        assert.notEqual(output.code, "INTERNAL_ERROR");
        assert.ok(output.errors.some(error => error.includes(field)));
      }
    }
    const overlap = structuredClone(original), envelope = type === "envelope" ? overlap : overlap.envelope;
    envelope.prohibitedOperations = [...envelope.allowedOperations];
    assert.ok(validateContract(type, overlap).errors.some(error => error.includes("allows and prohibits")));
  }
});
