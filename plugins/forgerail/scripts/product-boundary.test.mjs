import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { validateProductSurface } from "./lib/product-surface.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
function files(directory, prefix = "scripts") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${prefix}/${entry.name}`;
    return entry.isDirectory() ? files(resolve(directory, entry.name), path) : [path];
  });
}
const paths = files(resolve(root, "scripts"));

test("source or installed package has an explicit script surface", () => {
  assert.deepEqual(validateProductSurface(manifest, paths), []);
});

test("a newly added runner or executable fixture requires publication review", () => {
  for (const path of ["scripts/new-runner.mjs", "scripts/lib/transport.py", "scripts/fixtures/fake-agent.mjs", "scripts/fixtures/runner"]) {
    assert.ok(validateProductSurface(manifest, [...paths, path]).includes(`undeclared script surface: ${path}`));
  }
});

test("broad script inclusion, added bins and missing declared modules fail", () => {
  for (const path of ["scripts", "scripts/", "scripts/lib/", "scripts/*.mjs"]) {
    assert.ok(validateProductSurface({ ...manifest, files: [...manifest.files, path] }, paths).some((error) => error.startsWith("script publication must be explicit:")));
  }
  assert.ok(validateProductSurface({ ...manifest, bin: { ...manifest.bin, executor: "scripts/runner.mjs" } }, paths).length);
  assert.ok(validateProductSurface(manifest, paths.filter((path) => path !== "scripts/lib/composition.mjs")).includes("declared script missing: scripts/lib/composition.mjs"));
});
