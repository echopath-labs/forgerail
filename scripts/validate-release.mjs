#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const expectedPackageName = "@echopath-labs/forgerail";
const expectedVersion = "0.1.0-alpha.2";
const expectedTag = `v${expectedVersion}`;
const expectedDate = "2026-08-30";
const expectedPlugins = [
  "forgerail",
  "forgerail-cross-workspace-orchestration",
  "forgerail-github-rulesets",
  "forgerail-release-safety",
  "forgerail-thread-closure",
];
const checks = [];

function record(id, passed, detail) {
  checks.push({ id, passed, detail });
}

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function json(path) {
  return JSON.parse(read(path));
}

function findExisting(candidates) {
  const path = candidates.find((candidate) => existsSync(resolve(root, candidate)));
  if (!path) throw new Error(`none of the expected paths exist: ${candidates.join(", ")}`);
  return path;
}

const packageJson = json("package.json");
const packageLock = json("package-lock.json");
record("package-name", packageJson.name === expectedPackageName, packageJson.name);
record("package-lock-name", packageLock.name === expectedPackageName && packageLock.packages?.[""]?.name === expectedPackageName, packageLock.name);
record("package-version", packageJson.version === expectedVersion, packageJson.version);
record("package-lock-version", packageLock.version === expectedVersion && packageLock.packages?.[""]?.version === expectedVersion, packageLock.version);
record("package-license", packageJson.license === "Apache-2.0", packageJson.license);
record("package-lock-license", packageLock.packages?.[""]?.license === "Apache-2.0", packageLock.packages?.[""]?.license ?? null);
record("npm-next-tag", packageJson.publishConfig?.tag === "next", packageJson.publishConfig?.tag ?? null);
record(
  "prepublish-gate",
  ["npm test", "npm run test:shadow", "npm run test:release", "npm run test:consumer", "npm run test:directory"].every((command) => packageJson.scripts?.prepublishOnly?.includes(command)),
  packageJson.scripts?.prepublishOnly ?? null,
);

const pluginPaths = {
  forgerail: ".codex-plugin/plugin.json",
  "forgerail-cross-workspace-orchestration": findExisting([
    "../forgerail-cross-workspace-orchestration/.codex-plugin/plugin.json",
    "plugins/forgerail-cross-workspace-orchestration/.codex-plugin/plugin.json",
  ]),
  "forgerail-github-rulesets": findExisting([
    "../forgerail-github-rulesets/.codex-plugin/plugin.json",
    "plugins/forgerail-github-rulesets/.codex-plugin/plugin.json",
  ]),
  "forgerail-release-safety": findExisting([
    "../forgerail-release-safety/.codex-plugin/plugin.json",
    "plugins/forgerail-release-safety/.codex-plugin/plugin.json",
  ]),
  "forgerail-thread-closure": findExisting([
    "../forgerail-thread-closure/.codex-plugin/plugin.json",
    "plugins/forgerail-thread-closure/.codex-plugin/plugin.json",
  ]),
};

for (const name of expectedPlugins) {
  const plugin = json(pluginPaths[name]);
  record(`${name}-identity`, plugin.name === name, plugin.name);
  record(`${name}-version`, plugin.version === expectedVersion, plugin.version);
  record(`${name}-license`, plugin.license === "Apache-2.0", plugin.license);
  const licensePath = name === "forgerail" ? "LICENSE" : pluginPaths[name].replace(".codex-plugin/plugin.json", "LICENSE");
  record(`${name}-license-file`, existsSync(resolve(root, licensePath)), licensePath);
}

const changelog = read("CHANGELOG.md");
const releaseHeading = `## ${expectedVersion} - ${expectedDate}`;
const unreleased = changelog.slice(changelog.indexOf("## Unreleased") + "## Unreleased".length, changelog.indexOf(releaseHeading)).trim();
record("changelog-version", changelog.includes(releaseHeading), releaseHeading);
record("changelog-clean-unreleased", unreleased === "No shipping changes yet.", unreleased);
for (const phrase of ["Workspace Diagnosis", "Return Receipts", "GitHub Rulesets", "Node.js 22 and 24", "Apache-2.0"]) {
  record(`changelog-${phrase.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`, changelog.includes(phrase), phrase);
}

const marketplacePath = findExisting(["marketplace/.agents/plugins/marketplace.json", ".agents/plugins/marketplace.json"]);
const marketplace = json(marketplacePath);
const marketplacePlugins = new Map(marketplace.plugins.map((plugin) => [plugin.name, plugin]));
record("marketplace-name", marketplace.name === "echopath-labs", marketplace.name);
for (const name of expectedPlugins) {
  const plugin = marketplacePlugins.get(name);
  record(`marketplace-${name}`, Boolean(plugin), plugin?.source?.path ?? null);
  if (name !== "forgerail") record(`marketplace-${name}-on-use`, plugin?.policy?.authentication === "ON_USE", plugin?.policy?.authentication ?? null);
}

const installation = `${read("docs/installation.md")}\n${read("docs/installation.zh-CN.md")}`;
for (const phrase of [
  "codex plugin marketplace add echopath-labs/forgerail --ref v0.1.0-alpha.1",
  "codex plugin add forgerail@echopath-labs",
  "codex plugin add forgerail-cross-workspace-orchestration@echopath-labs",
  "codex plugin add forgerail-github-rulesets@echopath-labs",
  `${expectedPackageName}@${expectedVersion}`,
  "new Codex task",
  "adoption-plan --workspace . --host codex",
  "Host Binding Receipt",
]) {
  record(`installation-${phrase.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`, installation.includes(phrase), phrase);
}

for (const path of [
  "contracts/adoption-plan.schema.json",
  "contracts/host-adapter.schema.json",
  "contracts/host-binding-receipt.schema.json",
  "adapters/codex.json",
  "adapters/claude-code.json",
  "adapters/cursor.json",
  "templates/FORGERAIL.md",
  "templates/bindings/codex-compact.md",
  "docs/adoption.md",
  "docs/adoption.zh-CN.md",
]) record(`adoption-path-${path.replaceAll(/[^a-z0-9]+/gi, "-").toLowerCase()}`, existsSync(resolve(root, path)), path);

const codexAdapter = json("adapters/codex.json");
const claudeAdapter = json("adapters/claude-code.json");
const cursorAdapter = json("adapters/cursor.json");
record("codex-adapter-supported", codexAdapter.status === "supported" && codexAdapter.bindingTarget === "AGENTS.md", codexAdapter.status);
record("claude-adapter-profile-only", claudeAdapter.status === "profile-only", claudeAdapter.status);
record("cursor-adapter-profile-only", cursorAdapter.status === "profile-only", cursorAdapter.status);
record("package-adapters", packageJson.files?.includes("adapters/"), packageJson.files ?? null);
record("package-templates", packageJson.files?.includes("templates/"), packageJson.files ?? null);
record("no-apply-adoption-script", !read("scripts/forgerail.mjs").includes('command === "apply-adoption"'), "no apply-adoption command");

const releaseEnglish = read("docs/release-alpha2.md");
const releaseChinese = read("docs/release-alpha2.zh-CN.md");
const releaseDocs = `${releaseEnglish}\n${releaseChinese}`;
for (const phrase of [
  "remote_integration_approval",
  "release_approval",
  "lifecycle_change_approval",
  expectedVersion,
  expectedTag,
  "Node.js 22 and 24",
  "codex/forgerail-alpha2-scoped",
  "Do not unpublish",
  "AGW",
  "Host Binding Receipt",
  ".forgerail/",
]) {
  record(`runbook-${phrase.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`, releaseDocs.includes(phrase), phrase);
}
for (const [id, document, phrases] of [
  ["english", releaseEnglish, [
    "The public candidate is an ordinary child of the observed remote `main`.",
    "an ordinary source-first successor commit",
    "The Draft PR base and publication comparison baseline remain bound to the observed remote `main`",
    "The merged public `main` tree must equal the final signed projection tree",
    "Install and discover each external Capability Pack separately",
  ]],
  ["chinese", releaseChinese, [
    "公共候选是已观测远端 `main` 的普通子 commit。",
    "普通的 source-first successor commit",
    "Draft PR base 与 publication comparison baseline 继续绑定已观测远端 `main`",
    "合并后的公共 `main` tree 必须等于最终签名 projection tree",
    "每个外部 Capability Pack 分别安装与发现",
  ]],
]) {
  for (const phrase of phrases) {
    record(`runbook-${id}-${phrase.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`, document.includes(phrase), phrase);
  }
}
record("runbook-no-fixed-external-pack-count", !releaseChinese.includes("三个外部 Capability Pack"), "external Pack count is future-proof");

const workflow = read(".github/workflows/plugin-contracts.yml");
record("ci-node-22", workflow.includes("- 22"), "Node.js 22");
record("ci-node-24", workflow.includes("- 24"), "Node.js 24");
record("ci-release-source", workflow.includes("node scripts/validate-release.mjs"), "release source validator");
record("ci-progressive-adoption", workflow.includes("node scripts/forgerail.mjs validate-adoption"), "progressive adoption validator");

const failures = checks.filter((check) => !check.passed);
const report = {
  schemaVersion: "1.0",
  release: { version: expectedVersion, tag: expectedTag, date: expectedDate },
  status: failures.length === 0 ? "passed" : "failed",
  checks,
  failures: failures.map(({ id, detail }) => ({ id, detail })),
};
console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exitCode = 1;
