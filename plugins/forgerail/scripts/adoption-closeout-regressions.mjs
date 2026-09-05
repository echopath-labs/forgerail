import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { adoptionWriteApprovalDigest, loadHostAdapters, planAdoption } from "./lib/adoption.mjs";
import { validateContract } from "./lib/contracts.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function temporary(t, prefix) {
  const path = mkdtempSync(resolve(tmpdir(), prefix));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  return path;
}
function registry(t) {
  const path = temporary(t, "forgerail-closeout-registry-");
  for (const name of ["adapters", "templates"]) cpSync(resolve(root, name), resolve(path, name), { recursive: true });
  return path;
}

test("registry reports every non-object JSON root without crashing", (t) => {
  const plugin = registry(t);
  for (const value of [null, [], false, 1, "invalid"]) {
    writeFileSync(resolve(plugin, "adapters/malformed.json"), JSON.stringify(value));
    const result = loadHostAdapters(plugin);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.startsWith("malformed.json:")));
  }
});

test("received plans reject reserved, case-folded and ancestor target collisions", (t) => {
  const workspace = temporary(t, "forgerail-closeout-plan-");
  const plan = planAdoption(root, workspace, ["codex", "claude-code"]);
  assert.equal(validateContract("adoption-plan", plan).valid, true);
  for (const target of ["FORGERAIL.md/CLAUDE.md", "forgerail.md", "AGENTS.md", "agents.md", "AGENTS.md/nested.md"]) {
    const invalid = structuredClone(plan);
    invalid.hostSelection.hosts["claude-code"].bindingTarget = target;
    const write = invalid.proposedWrites.find(({ path }) => path === "CLAUDE.md");
    write.path = target;
    write.approvalSha256 = adoptionWriteApprovalDigest(write);
    const result = validateContract("adoption-plan", invalid);
    assert.equal(result.valid, false, target);
    assert.ok(result.errors.some((error) => error.includes("conflict")), result.errors.join("; "));
  }
  for (const writes of [null, {}, [null]]) {
    const invalid = structuredClone(plan);
    invalid.proposedWrites = writes;
    assert.equal(validateContract("adoption-plan", invalid).valid, false);
  }
  assert.equal(existsSync(resolve(workspace, "FORGERAIL.md")), false);
});

test("subset plans report existing unselected adoption without granting it writes", (t) => {
  const workspace = temporary(t, "forgerail-closeout-existing-host-");
  const path = resolve(workspace, "AGENTS.md");
  const content = "<!-- forgerail:binding:codex:v1:start -->\nExisting standalone rules.\n<!-- forgerail:binding:codex:v1:end -->\n";
  writeFileSync(path, content);
  const plan = planAdoption(root, workspace, ["claude-code"]);
  assert.equal(plan.currentLevel, "lightweight-adoption");
  assert.ok(plan.evidence.some((value) => value.includes("Unselected managed binding retained: AGENTS.md")));
  assert.deepEqual(plan.proposedWrites.map(({ path }) => path), ["FORGERAIL.md", "CLAUDE.md"]);
  assert.equal(readFileSync(path, "utf8"), content);
  const noChange = planAdoption(root, workspace, ["claude-code"], "plugin-only");
  assert.equal(noChange.strategy, "no-change");
  assert.equal(noChange.currentLevel, "lightweight-adoption");
  assert.deepEqual(noChange.proposedWrites, []);
});

test("unsafe unselected bindings remain non-blocking and unavailable", (t) => {
  const workspace = temporary(t, "forgerail-closeout-unsafe-host-");
  const outside = temporary(t, "forgerail-closeout-outside-");
  writeFileSync(resolve(outside, "CLAUDE.md"), "<!-- forgerail:binding:claude-code:v1:start -->\n");
  symlinkSync(resolve(outside, "CLAUDE.md"), resolve(workspace, "CLAUDE.md"));
  const plan = planAdoption(root, workspace, ["codex"]);
  assert.equal(plan.currentLevel, "plugin-only");
  assert.ok(plan.evidence.some((value) => value.includes("Unselected binding unavailable: CLAUDE.md")));
  assert.equal(plan.evidence.some((value) => value.includes(outside)), false);
  assert.deepEqual(plan.proposedWrites.map(({ path }) => path), ["AGENTS.md"]);
});

test("thin templates contain an exact shared-contract reference inside their managed block", (t) => {
  const plugin = registry(t);
  const adapter = JSON.parse(readFileSync(resolve(plugin, "adapters/claude-code.json"), "utf8"));
  const path = resolve(plugin, "templates", adapter.bindingTemplates["thin-reference"]);
  const start = `<!-- ${adapter.managedMarker}:start -->`;
  const end = `<!-- ${adapter.managedMarker}:end -->`;
  for (const content of [
    `${start}\nUnrelated instructions.\n${end}`,
    `Follow FORGERAIL.md.\n${start}\nUnrelated instructions.\n${end}`,
    `${start}\nFollow NOTFORGERAIL.md.\n${end}`,
  ]) {
    writeFileSync(path, content);
    const result = loadHostAdapters(plugin);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.includes("shared contract reference")), result.errors.join("; "));
  }
  writeFileSync(path, `${start}\nFollow \`FORGERAIL.md\`.\n${end}\n`);
  assert.equal(loadHostAdapters(plugin).valid, true);
});
