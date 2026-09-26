#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateProductSurface } from "./lib/product-surface.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export function validateRelease() {
  const expectedPackageName = "@echopath-labs/forgerail";
  const expectedVersion = "0.1.7";
  const expectedTag = `v${expectedVersion}`;
  const expectedDate = "2026-09-26";
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

  const packageJson = json("package.json");
  const packageLock = json("package-lock.json");
  const launchContractSchema = json("contracts/launch-contract.schema.json");
  const effectiveProfileSchema = json("contracts/effective-profile.schema.json");
  const publicCli = read("scripts/forgerail.mjs");
  const packCache = mkdtempSync(resolve(tmpdir(), "forgerail-pack-cache-"));
  const packEnvironment = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => key.toLowerCase() !== "npm_config_cache"),
  );
  packEnvironment.NPM_CONFIG_CACHE = packCache;
  let packResult;
  try {
    packResult = spawnSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
      cwd: root,
      encoding: "utf8",
      env: packEnvironment,
    });
  } finally {
    rmSync(packCache, { recursive: true, force: true });
  }
  let packedFiles = [];
  try {
    packedFiles = packResult.status === 0
      ? JSON.parse(packResult.stdout)[0]?.files?.map(({ path }) => path) ?? []
      : [];
  } catch {}
  record("package-name", packageJson.name === expectedPackageName, packageJson.name);
  record("package-lock-name", packageLock.name === expectedPackageName && packageLock.packages?.[""]?.name === expectedPackageName, packageLock.name);
  record("package-version", packageJson.version === expectedVersion, packageJson.version);
  record("package-lock-version", packageLock.version === expectedVersion && packageLock.packages?.[""]?.version === expectedVersion, packageLock.version);
  record("package-license", packageJson.license === "Apache-2.0", packageJson.license);
  record("package-lock-license", packageLock.packages?.[""]?.license === "Apache-2.0", packageLock.packages?.[""]?.license ?? null);
  record("npm-latest-tag", packageJson.publishConfig?.tag === "latest", packageJson.publishConfig?.tag ?? null);
  record("no-public-bundle-builder-command", !publicCli.includes('command === "build-bundle"'), "source-repository maintainer tool only");
  record("npm-pack-dry-run", packResult.status === 0 && packedFiles.length > 0, packResult.status === 0 ? `${packedFiles.length} files` : packResult.stderr.trim());
  const surfaceErrors = validateProductSurface(packageJson, packedFiles);
  record("package-script-surface", surfaceErrors.length === 0, surfaceErrors);
  record("bundle-builder-source-only", existsSync(resolve(root, "tools/lib/bundle.mjs")) && !packedFiles.includes("tools/lib/bundle.mjs"), "tools/lib/bundle.mjs");
  record(
    "launch-requested-pack-schema-native-binding",
    launchContractSchema.properties?.envelope?.properties?.packs?.type === "object"
      && launchContractSchema.properties?.envelope?.properties?.packs?.additionalProperties?.pattern === "^[0-9a-f]{64}$",
    launchContractSchema.properties?.envelope?.properties?.packs ?? null,
  );
  record(
    "profile-pack-schema-native-identity",
    effectiveProfileSchema.properties?.packs?.type === "object"
      && effectiveProfileSchema.properties?.packs?.propertyNames?.pattern === "^[a-z][a-z0-9-]+$"
      && effectiveProfileSchema.properties?.packs?.additionalProperties?.required?.includes("state")
      && effectiveProfileSchema.properties?.packs?.additionalProperties?.required?.includes("reason"),
    effectiveProfileSchema.properties?.packs ?? null,
  );
  record(
    "prepublish-gate",
    packageJson.scripts?.prepublishOnly === "npm run test:maintainer"
      && ["npm test", "npm run test:docs", "node scripts/forgerail.mjs validate-fixtures --scope full", "npm run test:integrity", "npm run test:shadow", "npm run test:release", "npm run test:consumer", "npm run test:directory"].every((command) => packageJson.scripts?.["test:maintainer"]?.split(" && ").includes(command)),
    { prepublishOnly: packageJson.scripts?.prepublishOnly, maintainer: packageJson.scripts?.["test:maintainer"] },
  );

  for (const name of expectedPlugins) {
    const plugin = json(pluginPaths[name]);
    record(`${name}-identity`, plugin.name === name, plugin.name);
    record(`${name}-version`, plugin.version === (name === "forgerail" ? expectedVersion : "0.1.0-alpha.4"), plugin.version);
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

  const marketplacePath = findExisting([
    "marketplace/.agents/plugins/marketplace.json",
    ".agents/plugins/marketplace.json",
    "../../.agents/plugins/marketplace.json",
  ]);
  const marketplace = json(marketplacePath);
  const marketplacePlugins = new Map(marketplace.plugins.map((plugin) => [plugin.name, plugin]));
  record("marketplace-name", marketplace.name === "echopath-labs", marketplace.name);
  for (const name of expectedPlugins) {
    const plugin = marketplacePlugins.get(name);
    record(`marketplace-${name}`, Boolean(plugin), plugin?.source?.path ?? null);
    if (name !== "forgerail") record(`marketplace-${name}-on-use`, plugin?.policy?.authentication === "ON_USE", plugin?.policy?.authentication ?? null);
  }

  const installation = `${read("docs/installation.md")}\n${read("docs/installation.zh-CN.md")}\n${read("docs/adoption.md")}\n${read("docs/adoption.zh-CN.md")}`;
  for (const phrase of [
    `npm install --global ${expectedPackageName}@${expectedVersion}`,
    `${expectedPackageName}@${expectedVersion}`,
    "new Codex task",
    "adoption-plan --workspace . --host codex",
    "adoption-plan --workspace . --selection all-detected",
    "adoption-plan --workspace . --selection all-available",
    "Host Binding Receipt",
  ]) {
    record(`installation-${phrase.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`, installation.includes(phrase), phrase);
  }
  const support = read("SUPPORT.md");
  record("support-current-version", support.includes(expectedVersion) && support.includes(expectedTag) && !support.includes("0.1.6"), { expectedVersion, expectedTag });
  record("support-cursor-boundary", support.includes("Cursor IDE Agent") && support.includes("Cursor CLI") && support.includes("Cloud Agent") && support.includes("profile-only"), "evidence-bounded Cursor support is explicit");

  for (const path of [
    "contracts/adoption-plan.schema.json",
    "contracts/host-adapter.schema.json",
    "contracts/host-binding-receipt.schema.json",
    "adapters/codex.json",
    "adapters/claude-code.json",
    "adapters/cursor.json",
    "templates/FORGERAIL.md",
    "templates/bindings/codex-compact.md",
    "templates/bindings/codex-thin.md",
    "templates/bindings/claude-code-thin.md",
    "templates/bindings/cursor-thin.mdc",
    "docs/adoption.md",
    "docs/adoption.zh-CN.md",
  ]) record(`adoption-path-${path.replaceAll(/[^a-z0-9]+/gi, "-").toLowerCase()}`, existsSync(resolve(root, path)), path);

  const codexAdapter = json("adapters/codex.json");
  const claudeAdapter = json("adapters/claude-code.json");
  const cursorAdapter = json("adapters/cursor.json");
  record("codex-adapter-supported", codexAdapter.status === "supported" && codexAdapter.bindingTarget === "AGENTS.md" && codexAdapter.detectionTargets?.includes("AGENTS.md"), codexAdapter.status);
  record("claude-adapter-profile-only", claudeAdapter.status === "profile-only" && claudeAdapter.detectionTargets?.includes("CLAUDE.md"), claudeAdapter.status);
  record("claude-adapter-thin-only", JSON.stringify(claudeAdapter.bindingModes) === JSON.stringify(["thin-reference"]), claudeAdapter.bindingModes);
  const cursorSupported = cursorAdapter.status === "supported"
    && cursorAdapter.activationBoundary === "new-task-required"
    && cursorAdapter.verification?.mode === "new-task-discovery"
    && cursorAdapter.verification?.expectedSkills?.includes("forgerail");
  const cursorProfileOnly = cursorAdapter.status === "profile-only"
    && cursorAdapter.activationBoundary === "host-specific-verification-required"
    && cursorAdapter.verification?.mode === "profile-only"
    && cursorAdapter.verification?.expectedSkills?.length === 0;
  record("cursor-adapter-evidence-gated", (cursorSupported || cursorProfileOnly)
    && cursorAdapter.skillDiscovery === "agent-skills" && cursorAdapter.detectionTargets?.includes(".cursor"), cursorAdapter.status);
  for (const adapter of [codexAdapter, claudeAdapter, cursorAdapter]) {
    const modes = Object.keys(adapter.bindingTemplates ?? {}).sort();
    record(`adapter-${adapter.id}-template-modes`, JSON.stringify(modes) === JSON.stringify([...adapter.bindingModes].sort()), { modes, bindingModes: adapter.bindingModes });
    record(`adapter-${adapter.id}-all-host-thin-reference`, adapter.bindingModes.includes("thin-reference"), adapter.bindingModes);
    for (const [mode, template] of Object.entries(adapter.bindingTemplates ?? {})) {
      record(`adapter-${adapter.id}-${mode}-template`, existsSync(resolve(root, "templates", template)), template);
    }
  }
  record("package-adapters", packageJson.files?.includes("adapters/"), packageJson.files ?? null);
  record("package-templates", packageJson.files?.includes("templates/"), packageJson.files ?? null);
  record("project-lifecycle-publication", ["scripts/lib/project-adoption.mjs", "scripts/lib/project-state.mjs", "scripts/project-adoption.test.mjs"].every((path) => packageJson.files.includes(path)) && packageJson.scripts.test.includes("npm run test:project-adoption"), "explicit lifecycle modules and installed regression suite");
  record("no-apply-adoption-script", !read("scripts/forgerail.mjs").includes('command === "apply-adoption"'), "no apply-adoption command");

  const releaseEnglish = read("docs/release-0.1.7.md");
  const releaseChinese = read("docs/release-0.1.7.zh-CN.md");
  const releaseDocs = `${releaseEnglish}\n${releaseChinese}`;
  const currentRunbookEnglish = read("docs/release.md");
  const currentRunbookChinese = read("docs/release.zh-CN.md");
  const currentRunbooks = `${currentRunbookEnglish}\n${currentRunbookChinese}`;
  record("current-runbook-version", currentRunbooks.includes(expectedVersion) && currentRunbooks.includes(expectedTag), { expectedVersion, expectedTag });
  record("current-runbook-no-alpha1-release-identity", !currentRunbooks.includes("0.1.0-alpha.1"), "generic runbooks must not retain the first-prerelease identity");
  record("current-runbook-stable-channel", currentRunbookEnglish.includes("npm `latest`") && currentRunbookChinese.includes("npm `latest`"), "stable runbooks publish to latest");
  for (const phrase of [
    "remote_integration_approval",
    "release_approval",
    "lifecycle_change_approval",
    expectedVersion,
    expectedTag,
    "Node.js 22 and 24",
    "release/0.1.7",
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
      "The merged public `main` tree must equal the final approved projection tree",
      "Install and discover each external Capability Pack separately",
    ]],
    ["chinese", releaseChinese, [
      "公共候选是已观测远端 `main` 的普通子 commit。",
      "普通的 source-first successor commit",
      "Draft PR base 与 publication comparison baseline 继续绑定已观测远端 `main`",
      "合并后的公共 `main` tree 必须等于最终批准的 projection tree",
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
  record("ci-full-core", workflow.includes("run: npm test"), "npm test");
  record("ci-full-fixtures", workflow.includes("run: node scripts/forgerail.mjs validate-fixtures --scope full"), "full external composition fixtures");
  record("ci-integrity-regressions", workflow.includes("run: npm run test:integrity"), "npm run test:integrity");
  record("ci-release-source", workflow.includes("node scripts/validate-release.mjs"), "release source validator");
  record("ci-progressive-adoption", workflow.includes("node scripts/forgerail.mjs validate-adoption"), "progressive adoption validator");
  record("ci-directory", workflow.includes("node scripts/validate-universal-directory.mjs"), "Universal Directory validator");

  const failures = checks.filter((check) => !check.passed);
  const report = {
    schemaVersion: "1.0",
    release: { version: expectedVersion, tag: expectedTag, date: expectedDate },
    status: failures.length === 0 ? "passed" : "failed",
    checks,
    failures: failures.map(({ id, detail }) => ({ id, detail })),
  };
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const report = validateRelease();
    console.log(JSON.stringify(report, null, 2));
    if (report.status !== "passed") process.exitCode = 1;
  } catch (error) {
    console.log(JSON.stringify({ valid: false, scope: "maintainer", errors: [error.message] }, null, 2));
    process.exitCode = 1;
  }
}
