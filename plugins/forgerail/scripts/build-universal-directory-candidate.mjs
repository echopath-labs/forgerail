#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const include = [
  ".codex-plugin/plugin.json",
  "CHANGELOG.md",
  "PRIVACY.md",
  "README.md",
  "README.zh-CN.md",
  "TERMS.md",
  "assets",
  "directory",
  "docs/installation.md",
  "docs/installation.zh-CN.md",
  "scripts/build-universal-directory-candidate.mjs",
  "scripts/fixtures/workspaces/no-node-project",
  "scripts/validate-universal-directory.mjs",
  "skills"
];

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function filesAt(path) {
  if (!existsSync(path)) throw new Error(`candidate source does not exist: ${path}`);
  if (statSync(path).isFile()) return [path];
  return readdirSync(path, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => filesAt(resolve(path, entry.name)));
}

const paths = [...new Set(include.flatMap((entry) => filesAt(resolve(pluginRoot, entry))))]
  .sort((a, b) => a.localeCompare(b));
const inventory = paths.map((path) => {
  const content = readFileSync(path);
  return {
    path: relative(pluginRoot, path).split(sep).join("/"),
    bytes: content.length,
    sha256: sha256(content)
  };
});
const manifest = JSON.parse(readFileSync(resolve(pluginRoot, ".codex-plugin/plugin.json"), "utf8"));
const candidate = JSON.parse(readFileSync(resolve(pluginRoot, "directory/submission-candidate.json"), "utf8"));
const result = {
  schemaVersion: "1.0",
  candidateType: "openai-universal-plugin-directory-skills-only",
  status: "local_candidate",
  approvalStatus: candidate.approval.status,
  product: manifest.name,
  pluginVersion: manifest.version,
  privateBaseline: "59c7bb52f16cda2d47a8a49bb43860517f9bd7eb",
  sourceDate: "2026-08-30",
  inventory,
  contentDigest: sha256(JSON.stringify(inventory)),
  unresolvedGates: candidate.unresolvedGates,
  nonMutations: candidate.confirmedNonMutations
};

const outputFlag = process.argv.indexOf("--output");
const serialized = `${JSON.stringify(result, null, 2)}\n`;
if (outputFlag >= 0) {
  const output = process.argv[outputFlag + 1];
  if (!output) throw new Error("--output requires a path");
  writeFileSync(resolve(process.cwd(), output), serialized);
}
process.stdout.write(serialized);
