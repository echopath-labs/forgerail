import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { resolveProfile, verifyReceipt } from "./lib/composition.mjs";
import { contractSchemaNames, contractTypes, validateContract } from "./lib/contracts.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const rule = (source, precedence, value) => ({ id: "rule.mode", source, precedence, value, status: "confirmed" });
const input = rules => ({ workspace: "fixture", rules, packs: [] });
const profile = { schemaVersion: "1.0", workspace: "fixture", computed: true, rules: [], packs: {}, conflicts: [] };
const receipt = { schemaVersion: "1.0", taskId: "task:fixture", ownerWorkspace: "unbound-owner", branch: null, commit: null, changedScope: [], validationEvidence: ["self-reported"], externalSideEffects: [], confirmedNonMutations: [], residualRisks: [], rollbackOrRecovery: "No changes.", deviations: [], closeout: "incomplete" };
function workspace(t) {
  const dir = mkdtempSync(resolve(tmpdir(), "forgerail-reliability-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
const permutations = values => values.length ? values.flatMap((v, i) => permutations(values.filter((_, j) => i !== j)).map(rest => [v, ...rest])) : [[]];

test("all rule permutations have the same effective result and conflicts", () => {
  for (const rules of [
    [rule("low-a", 6, "a"), rule("low-b", 6, "b"), rule("platform", 1, "c")],
    [rule("b", 1, { y: 2, x: 1 }), rule("a", 1, { x: 1, y: 2 }), rule("low", 6, "d")],
    [rule("b", 1, "b"), rule("a", 1, "a"), rule("low", 6, "d")],
  ]) {
    const results = permutations(rules).map(values => resolveProfile(input(values)));
    for (const result of results) assert.deepEqual(result, results[0]);
  }
  const overridden = resolveProfile(input([rule("low-a", 6, "a"), rule("low-b", 6, "b"), rule("platform", 1, "c")]));
  assert.equal(overridden.valid, true);
  assert.equal(overridden.profile.rules[0].value, "c");
});

test("all candidates are validated before selection", () => {
  for (const bad of [null, 1, {}, { id: "rule.mode", source: "bad", precedence: "invalid" }, { ...rule("bad", 6, "x"), status: "unknown" }]) {
    for (const rules of [[rule("good", 1, "x"), bad], [bad, rule("good", 1, "x")]]) {
      const result = resolveProfile(input(rules));
      assert.equal(result.valid, false);
      assert.ok(result.errors.length);
    }
  }
  for (const field of ["rules", "packs"]) for (const bad of [null, {}, "text", 1, [null]]) {
    assert.equal(resolveProfile({ ...input([]), [field]: bad }).valid, false);
  }
});

test("malformed Profile values return field errors without throwing", () => {
  for (const bad of [{ rules: {} }, { rules: [null] }, { rules: [1] }, { packs: { "test-pack": null } }, { packs: [] }]) {
    const result = validateContract("profile", { ...profile, ...bad });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.startsWith("profile.")));
  }
  for (const value of [null, [], 1, "text", {}, { rules: {} }]) assert.equal(validateContract("profile", value).valid, false);
});

test("public contract API keeps fixture JSON type mutations structured", t => {
  const fixtureRoot = resolve(root, "scripts/fixtures/contracts");
  const files = readdirSync(fixtureRoot).sort();
  let checks = 0;
  const failures = [];
  for (const [type, schema] of Object.entries(contractSchemaNames)) {
    const prefix = schema.replace(/-v1$/, "") + ".";
    const fixtures = files.filter(file => file.startsWith(prefix) && file.endsWith(".valid.json"));
    assert.ok(fixtures.length, `${type} requires a valid regression fixture`);
    for (const file of fixtures) {
      const payload = JSON.parse(readFileSync(resolve(fixtureRoot, file), "utf8"));
      assert.equal(validateContract(type, payload).valid, true, file);
      function visit(value, path = []) {
        if (value !== null && typeof value === "object") {
          for (const key of Object.keys(value)) visit(value[key], [...path, key]);
        }
        const replacements = Array.isArray(value) ? [null, {}, 7, true, "text", [null]]
          : value !== null && typeof value === "object" ? [null, [], 7, true, "text"]
          : typeof value === "string" ? [null, {}, [], 7, true]
          : typeof value === "boolean" ? [null, {}, [], 7, "text"]
          : value === null ? [{}, [], 7, true] : [null, {}, [], true, "text"];
        for (const replacement of replacements) {
          checks++;
          let mutated = structuredClone(payload);
          if (path.length) {
            let parent = mutated;
            for (const key of path.slice(0, -1)) parent = parent[key];
            parent[path.at(-1)] = replacement;
          } else mutated = replacement;
          try {
            const result = validateContract(type, mutated);
            assert.equal(typeof result.valid, "boolean");
            assert.ok(Array.isArray(result.errors));
            assert.ok(result.valid || result.errors.length > 0);
            assert.ok(result.errors.every(error => typeof error === "string"));
          } catch (error) {
            failures.push(`${file}:${path.join(".") || "<root>"}: ${error.name}`);
          }
        }
      }
      visit(payload);
    }
  }
  t.diagnostic(`${checks} fixture JSON type mutations; ${failures.length} unstructured failures`);
  assert.deepEqual(failures, []);
});

test("public contract API rejects wrong array types and conditional null lengths", () => {
  const fixture = name => JSON.parse(readFileSync(resolve(root, "scripts/fixtures/contracts", name), "utf8"));
  for (const bad of [null, {}, 7, true, "text", [null]]) {
    const phase = fixture("phase-slice-correlation.valid.json");
    phase.requiredSliceIds = bad;
    const result = validateContract("phase-slice-correlation", phase);
    assert.equal(result.valid, false);
    assert.ok(result.errors.includes("phaseSliceCorrelation.requiredSliceIds must be an array") || result.errors.some(error => error.includes("requiredSliceIds[0]")));
    const grant = fixture("operation-grant.valid.json");
    grant.retroactiveEffect = { applies: true, scope: bad };
    assert.equal(validateContract("operation-grant", grant).valid, false);
  }
});

test("public contract API bounds depth and node count before recursive scans", () => {
  const depthError = { valid: false, errors: ["contract input exceeds maximum depth of 64"] };
  const nodeError = { valid: false, errors: ["contract input exceeds maximum node count of 10000"] };
  const deep = JSON.parse("[".repeat(10000) + "0" + "]".repeat(10000));
  const wide = Array(10000).fill(0);
  for (const type of contractTypes) {
    assert.deepEqual(validateContract(type, deep), depthError, type);
    assert.deepEqual(validateContract(type, wide), nodeError, type);
  }
  // Root depth is zero; every value, including scalar array elements, is a node.
  assert.notDeepEqual(validateContract("profile", Array(9999).fill(0)), nodeError);
  let value = 0;
  for (let depth = 0; depth < 61; depth++) value = [value];
  const atLimit = { ...profile, rules: [rule("source", 1, value)] };
  assert.equal(validateContract("profile", atLimit).valid, true);
  atLimit.rules[0].value = [value];
  assert.deepEqual(validateContract("profile", atLimit), depthError);
  const sensitive = { "token=redaction-sentinel": deep };
  assert.deepEqual(validateContract("project-profile-declaration", sensitive), depthError);
  for (const type of ["project-profile-declaration", "workspace-identity", "workspace-relationship", "execution-context-identity"]) {
    const result = validateContract(type, { "token=redaction-sentinel": 7 });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes("credential material")));
    assert.ok(!JSON.stringify(result).includes("redaction-sentinel"));
  }
});

test("invalid paths cannot pass receipt verification; non-Git directories remain supported", t => {
  const dir = workspace(t);
  writeFileSync(resolve(dir, "file"), "not a directory");
  for (const path of [resolve(dir, "missing"), resolve(dir, "file")]) {
    const result = verifyReceipt({ ...receipt, closeout: "complete" }, path);
    assert.equal(result.valid, false);
    assert.equal(result.closeout, "incomplete");
    assert.equal(result.observationStatus, "invalid-workspace");
  }
  const result = verifyReceipt(receipt, dir);
  assert.equal(result.valid, true);
  assert.equal(result.schemaValid, true);
  assert.equal(result.observationStatus, "not-a-git-workspace");
  assert.ok(result.unverifiedClaims.includes("taskId"));
  assert.ok(result.unverifiedClaims.includes("deviations"));
  const complete = verifyReceipt({ ...receipt, closeout: "complete" }, dir);
  assert.equal(complete.valid, false);
  assert.equal(complete.closeout, "incomplete");
  assert.ok(complete.unverifiedClaims.includes("validationEvidence"));
});

test("Git observation errors do not become non-Git success", t => {
  const dir = workspace(t);
  // The substitute fails promptly; no real Git, credentials or network are used.
  const executable = resolve(dir, "git");
  writeFileSync(executable, "#!/bin/sh\nprintf 'fatal: permission denied' >&2\nexit 128\n");
  chmodSync(executable, 0o755);
  const original = process.env.PATH;
  try {
    process.env.PATH = dir;
    const result = verifyReceipt(receipt, dir);
    assert.equal(result.valid, false);
    assert.equal(result.observationStatus, "unavailable");
    assert.equal(result.observations.gitError.status, 128);
    process.env.PATH = resolve(dir, "missing-bin");
    const missing = verifyReceipt(receipt, dir);
    assert.equal(missing.observationStatus, "unavailable");
    assert.equal(missing.observations.gitError.code, "ENOENT");
  } finally { process.env.PATH = original; }
});

test("real Git claims are compared but self-reported completion is not certified", t => {
  const dir = workspace(t);
  const git = (...args) => {
    const result = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git("init", "-b", "main");
  const unborn = verifyReceipt({ ...receipt, branch: "main" }, dir);
  assert.equal(unborn.valid, true);
  assert.equal(unborn.observationStatus, "available");
  assert.equal(unborn.observations.commit, null);
  assert.ok(unborn.verifiedClaims.includes("branch"));
  assert.ok(unborn.unverifiedClaims.includes("commit"));
  assert.equal(verifyReceipt({ ...receipt, commit: "0".repeat(40) }, dir).valid, false);
  git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--allow-empty", "-m", "fixture");
  const exact = { ...receipt, branch: "main", commit: git("rev-parse", "HEAD") };
  const result = verifyReceipt(exact, dir);
  assert.equal(result.valid, true);
  assert.ok(result.verifiedClaims.includes("commit"));
  assert.equal(verifyReceipt({ ...exact, commit: "0".repeat(40) }, dir).valid, false);
  assert.equal(verifyReceipt({ ...exact, closeout: "complete" }, dir).closeout, "incomplete");
  writeFileSync(resolve(dir, ".git/refs/heads/main"), "1".repeat(40) + "\n");
  assert.equal(verifyReceipt(receipt, dir).observationStatus, "unavailable");
});

test("public CLI returns structured errors for malformed JSON, types and budgets", t => {
  const dir = workspace(t);
  const path = resolve(dir, "input.json");
  const missing = spawnSync(process.execPath, [resolve(root, "scripts/forgerail.mjs"), "validate-contract", "--type", "profile", "--file", path], { encoding: "utf8" });
  assert.equal(missing.status, 1);
  assert.equal(missing.stderr, "");
  const missingOutput = JSON.parse(missing.stdout);
  assert.equal(missingOutput.code, "INPUT_UNAVAILABLE");
  assert.equal(missingOutput.errors[0].split("ENOENT").length - 1, 1);
  const phase = JSON.parse(readFileSync(resolve(root, "scripts/fixtures/contracts/phase-slice-correlation.valid.json"), "utf8"));
  for (const [type, value, error] of [
    ["profile", JSON.stringify({ ...profile, rules: {} })],
    ["profile", "{broken"],
    ["phase-slice-correlation", JSON.stringify({ ...phase, requiredSliceIds: 7 }), "phaseSliceCorrelation.requiredSliceIds must be an array"],
    ["project-profile-declaration", "[".repeat(10000) + "0" + "]".repeat(10000), "contract input exceeds maximum depth of 64"],
    ["project-profile-declaration", JSON.stringify(Array(10000).fill(0)), "contract input exceeds maximum node count of 10000"],
  ]) {
    writeFileSync(path, value);
    const result = spawnSync(process.execPath, [resolve(root, "scripts/forgerail.mjs"), "validate-contract", "--type", type, "--file", path], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.equal(result.stderr, "");
    const output = JSON.parse(result.stdout);
    assert.equal(output.valid, false);
    assert.ok(output.errors.length);
    assert.notEqual(output.code, "INTERNAL_ERROR");
    if (error) assert.deepEqual(output.errors, [error]);
  }
});
