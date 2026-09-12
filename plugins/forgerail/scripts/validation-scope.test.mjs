import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const source = resolve(dirname(fileURLToPath(import.meta.url)), "..");
test("isolated main-package scope and full-input failures remain distinct", () => {
  const parent = mkdtempSync(resolve(tmpdir(), "forgerail-scope-"));
  const root = resolve(parent, "forgerail");
  try {
    cpSync(source, root, { recursive: true, filter: (path) => !["node_modules", ".git", "plugins"].includes(path.split(/[\\/]/).at(-1)) });
    const cli = (args) => spawnSync(process.execPath, ["scripts/forgerail.mjs", "validate-fixtures", ...args], { cwd: root, encoding: "utf8" });
    const core = cli(["--scope", "core"]);
    assert.equal(core.status, 0, core.stderr || core.stdout);
    const result = JSON.parse(core.stdout);
    assert.equal(result.scope, "core");
    assert.deepEqual(result.excluded, ["external-orchestration-composition"]);
    for (const args of [[], ["--scope", "full"]]) {
      const full = cli(args);
      assert.equal(full.status, 1);
      const report = JSON.parse(full.stdout);
      assert.equal(report.scope, "full");
      assert.deepEqual(report.excluded, []);
      assert.equal(report.passed, false);
      assert.ok(report.results.some((item) => !item.passed && item.path === "cross-workspace-orchestration-manifest"));
    }
    for (const args of [["--scope", "typo"], ["--scope"], ["--scope", "core", "--scope", "full"]]) {
      assert.equal(cli(args).status, 1, JSON.stringify(args));
    }
    for (const [script, entry] of [["shadow-comparison", "evaluateShadowComparison"], ["validate-release", "validateRelease"]]) {
      const failure = spawnSync(process.execPath, [`scripts/${script}.mjs`], { cwd: root, encoding: "utf8" });
      assert.equal(failure.status, 1, script);
      assert.equal(failure.stderr, "", script);
      const report = JSON.parse(failure.stdout);
      assert.equal(report.valid, false);
      assert.equal(report.scope, "maintainer");
      assert.ok(report.errors.length > 0);
      // Import and evaluate separately: a library caller must retain control.
      const caller = spawnSync(process.execPath, ["--input-type=module", "-e", `
        const module = await import('./scripts/${script}.mjs');
        let caught = false;
        try { module.${entry}(); } catch (error) { caught = error instanceof Error; }
        if (!caught) throw new Error('missing inputs unexpectedly succeeded');
        console.log('caller retained control');
      `], { cwd: root, encoding: "utf8" });
      assert.equal(caller.status, 0, caller.stderr);
      assert.equal(caller.stdout.trim(), "caller retained control");
    }
    const pack = resolve(parent, "forgerail-cross-workspace-orchestration");
    mkdirSync(pack);
    // A present but invalid dependency cannot qualify a full check.
    writeFileSync(resolve(pack, "pack.json"), JSON.stringify({ id: "invalid" }));
    const invalid = cli(["--scope", "full"]);
    assert.equal(invalid.status, 1);
    assert.equal(JSON.parse(invalid.stdout).passed, false);
    assert.equal(cli(["--scope", "core"]).status, 0);
    const validPack = JSON.parse(readFileSync(resolve(root, "scripts/fixtures/contracts/capability-pack.valid.json")));
    validPack.id = "cross-workspace-orchestration";
    writeFileSync(resolve(pack, "pack.json"), JSON.stringify(validPack));
    const restored = cli(["--scope", "full"]);
    assert.equal(restored.status, 0, restored.stderr || restored.stdout);
    assert.equal(JSON.parse(restored.stdout).scope, "full");
    const integrity = spawnSync(process.execPath, ["scripts/integrity-regressions.mjs"], { cwd: root, encoding: "utf8" });
    // Source snapshots contain tools; npm installations intentionally do not.
    const packageFiles = JSON.parse(readFileSync(resolve(root, "package.json"))).files;
    assert.ok(!packageFiles.includes("tools/"));
    if (existsSync(resolve(root, "tools/lib/bundle.mjs"))) {
      assert.equal(integrity.status, 1);
      const failure = JSON.parse(integrity.stderr);
      assert.equal(failure.valid, false);
      assert.equal(failure.scope, "maintainer");
    } else {
      assert.equal(integrity.status, 0, integrity.stderr);
      assert.equal(JSON.parse(integrity.stdout).scope, "installed-package");
    }
  } finally { rmSync(parent, { recursive: true, force: true }); }
});
