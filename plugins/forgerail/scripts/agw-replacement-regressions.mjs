import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateReplacement } from "./validate-agw-replacement.mjs";

const source = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function fixture(run) {
  const root = mkdtempSync(resolve(tmpdir(), "forgerail-replacement-"));
  try {
    cpSync(resolve(source, "skills"), resolve(root, "skills"), { recursive: true });
    cpSync(resolve(source, "docs"), resolve(root, "docs"), { recursive: true });
    run(root);
  } finally { rmSync(root, { recursive: true, force: true }); }
}
test("main Plugin reference closure works without legacy AGW or external Packs", () => fixture((root) => {
  const result = validateReplacement(root);
  assert.deepEqual(result.errors, []);
  assert.equal(result.behaviorEquivalence, "not-assessed");
}));
test("missing nested optional-platform dependency blocks structural readiness", () => fixture((root) => {
  rmSync(resolve(root, "skills/forgerail/references/engineering-profile-snapshot.md"));
  assert.equal(validateReplacement(root).structuralReady, false);
}));
test("removing a loading trigger cannot be hidden by a coverage row", () => fixture((root) => {
  const entry = resolve(root, "skills/forgerail/SKILL.md");
  writeFileSync(entry, readFileSync(entry, "utf8").split("\n").filter((line) => !line.includes("references/git-lifecycle.md")).join("\n"));
  assert.match(validateReplacement(root).errors.join("\n"), /unreachable target for branch-choice/);
}));
test("removing a baseline row cannot silently reduce qualification scope", () => fixture((root) => {
  const file = resolve(root, "docs/agw-replacement-coverage.json");
  const data = JSON.parse(readFileSync(file));
  data.behaviors = data.behaviors.filter((row) => row.id !== "root-index");
  writeFileSync(file, JSON.stringify(data));
  assert.match(validateReplacement(root).errors.join("\n"), /missing baseline behavior: root-index/);
}));
test("negative-only merge scenarios cannot qualify integration and restoration", () => fixture((root) => {
  const file = resolve(root, "docs/agw-replacement-coverage.json");
  const data = JSON.parse(readFileSync(file));
  data.behaviors.find((row) => row.id === "merge").scenarioIds = ["feature", "release-preparation"];
  writeFileSync(file, JSON.stringify(data));
  assert.match(validateReplacement(root).errors.join("\n"), /missing authorized integration coverage: merge/);
}));
test("linked external baseline cannot masquerade as a packaged reference", () => fixture((root) => {
  const path = resolve(root, "skills/forgerail/references/git-lifecycle.md");
  rmSync(path);
  symlinkSync(resolve(source, "skills/forgerail/references/git-lifecycle.md"), path);
  assert.match(validateReplacement(root).errors.join("\n"), /linked dependency/);
}));
test("branch cleanup remains gated by explicit deletion authority", () => fixture((root) => {
  const content = readFileSync(resolve(root, "skills/forgerail/references/git-lifecycle.md"), "utf8");
  assert.match(content, /delete the integrated branch only when branch\s+deletion is explicitly authorized/);
  assert.match(content, /otherwise report the retained branch/);
}));
test("a structural manifest cannot claim real-host qualification", () => fixture((root) => {
  const file = resolve(root, "docs/agw-replacement-coverage.json");
  const data = JSON.parse(readFileSync(file));
  data.readiness.hostBehavior = "passed";
  writeFileSync(file, JSON.stringify(data));
  assert.match(validateReplacement(root).errors.join("\n"), /structure cannot qualify host behavior/);
}));

test("portable recovery must be reachable from the packaged entry", () => fixture((root) => {
  rmSync(resolve(root, "skills/forgerail/references/portable-entry.md"));
  assert.equal(validateReplacement(root).structuralReady, false);
}));
test("portable discovery cannot be dropped from qualification", () => fixture((root) => {
  const file = resolve(root, "docs/agw-replacement-coverage.json");
  const data = JSON.parse(readFileSync(file));
  data.behaviors = data.behaviors.filter((row) => row.id !== "portable-discovery");
  writeFileSync(file, JSON.stringify(data));
  assert.match(validateReplacement(root).errors.join("\n"), /missing baseline behavior: portable-discovery/);
}));
