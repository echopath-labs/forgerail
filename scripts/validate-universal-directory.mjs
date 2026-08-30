#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { diagnoseWorkspace } from "./lib/diagnosis.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const manifest = readJson(resolve(pluginRoot, ".codex-plugin/plugin.json"));
const packageJson = readJson(resolve(pluginRoot, "package.json"));
const candidate = readJson(resolve(pluginRoot, "directory/submission-candidate.json"));
const evaluations = readJson(resolve(pluginRoot, "directory/evaluations.json"));
const fixture = resolve(pluginRoot, "scripts/fixtures/workspaces/no-node-project");
const checks = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}

function hashTree(root) {
  const entries = [];
  function visit(current) {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = resolve(current, entry.name);
      const rel = relative(root, full).split(sep).join("/");
      if (entry.isDirectory()) visit(full);
      else {
        assert(!lstatSync(full).isSymbolicLink(), `fixture contains no symlink: ${rel}`);
        const content = readFileSync(full);
        entries.push({ path: rel, bytes: content.length, sha256: createHash("sha256").update(content).digest("hex") });
      }
    }
  }
  visit(root);
  return entries;
}

function validateAsset(label, assetPath) {
  assert(typeof assetPath === "string", `${label} is a string`);
  assert(assetPath.startsWith("./assets/"), `${label} starts with ./assets/`);
  assert(!assetPath.split("/").includes(".."), `${label} contains no parent traversal`);
  const resolved = resolve(pluginRoot, assetPath);
  assert(resolved.startsWith(`${pluginRoot}${sep}`), `${label} remains inside the Plugin root`);
  assert(existsSync(resolved), `${label} exists`);
  const svg = readFileSync(resolved, "utf8");
  assert(svg.includes("<svg") && svg.includes("</svg>"), `${label} is parseable SVG source`);
  assert(!/(?:href|src)\s*=\s*["'](?:https?:|data:)/i.test(svg), `${label} has no external or data URL`);
}

function validateMarkdownLinks(relativePath) {
  const documentPath = resolve(pluginRoot, relativePath);
  const markdown = readFileSync(documentPath, "utf8");
  for (const match of markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (/^(?:https:\/\/|mailto:|#)/.test(target)) continue;
    const withoutFragment = target.split("#")[0];
    const resolved = resolve(dirname(documentPath), withoutFragment);
    assert(resolved.startsWith(`${pluginRoot}${sep}`), `Markdown link remains in Plugin root: ${relativePath} -> ${target}`);
    assert(existsSync(resolved), `Markdown link target exists: ${relativePath} -> ${target}`);
  }
}

assert(candidate.submissionType === "skills_only", "candidate is Skills-only");
assert(candidate.status === "local_alpha2_source_candidate", "candidate status is local alpha.2 source preparation");
assert(candidate.approval.status === "not_granted", "submission approval is not granted");
assert(candidate.plugin.id === manifest.name, "candidate and manifest Plugin identity match");
assert(candidate.plugin.version === manifest.version, "candidate and manifest version match");
assert(candidate.plugin.version === "0.1.0-alpha.2", "candidate version is alpha.2");
assert(packageJson.version === candidate.plugin.version, "optional scoped package version matches candidate");
assert(candidate.plugin.mcpServers.length === 0, "candidate has no MCP server requirement");
assert(candidate.plugin.authentication === "none", "candidate has no authentication requirement");
assert(candidate.plugin.coreRequirements.projectPackageJson === false, "Core requires no project package.json");
assert(candidate.plugin.coreRequirements.projectNodeModules === false, "Core requires no project node_modules");
assert(candidate.plugin.coreRequirements.npmCli === "optional", "npm CLI is optional");

for (const skill of candidate.plugin.skills) {
  assert(existsSync(resolve(pluginRoot, "skills", skill, "SKILL.md")), `declared Skill exists: ${skill}`);
}
assert(new Set(candidate.plugin.skills).size === candidate.plugin.skills.length, "declared Skill identities are unique");

validateAsset("composerIcon", manifest.interface.composerIcon);
validateAsset("logo", manifest.interface.logo);
assert(manifest.interface.composerIcon === candidate.listing.composerIcon.value, "composer icon candidate matches manifest");
assert(manifest.interface.logo === candidate.listing.logo.value, "logo candidate matches manifest");

assert(candidate.listing.category.state === "confirmed_by_user" && candidate.listing.category.value === "Productivity", "Productivity category is user-confirmed");
assert(candidate.listing.supportUrl.state === "confirmed_by_user" && candidate.listing.supportUrl.value === "https://github.com/echopath-labs/forgerail/issues", "GitHub Issues support URL is user-confirmed");
assert(candidate.listing.privacyPolicyUrl.state === "confirmed_by_user" && candidate.listing.privacyPolicyUrl.value.endsWith("/PRIVACY.md"), "Privacy URL is user-confirmed and repository-owned");
assert(candidate.listing.termsOfServiceUrl.state === "confirmed_by_user" && candidate.listing.termsOfServiceUrl.value.endsWith("/TERMS.md"), "Terms URL is user-confirmed and repository-owned");
for (const field of ["websiteUrl", "supportUrl", "privacyPolicyUrl", "termsOfServiceUrl"]) {
  const url = new URL(candidate.listing[field].value);
  assert(url.protocol === "https:" && url.hostname === "github.com", `listing URL is confined to reviewed GitHub HTTPS origin: ${field}`);
}
assert(candidate.availability.intent.state === "confirmed_by_user" && candidate.availability.intent.value === "all_platform_supported_regions", "all-platform-supported-regions intent is user-confirmed");
assert(candidate.availability.portalEnumeration.state === "pending_confirmation" && candidate.availability.portalEnumeration.values.length === 0, "portal region enumeration remains pending without an invented country list");
assert(candidate.releaseNotes.state === "candidate" && candidate.releaseNotes.path === "./directory/release-notes-alpha2.md", "alpha.2 release notes path is explicit");
assert(existsSync(resolve(pluginRoot, candidate.releaseNotes.path)), "alpha.2 release notes file exists");

const privacy = readFileSync(resolve(pluginRoot, "PRIVACY.md"), "utf8");
const terms = readFileSync(resolve(pluginRoot, "TERMS.md"), "utf8");
for (const phrase of ["Skills-only Agent Plugin", "does not operate its own server", "do not themselves collect, transmit, or store telemetry", "host Agent or platform", "external Capability Packs"]) {
  assert(privacy.includes(phrase), `Privacy notice contains required boundary: ${phrase}`);
}
for (const phrase of ["Apache License 2.0", "without warranties", "You are responsible", "external actions", "does not provide legal advice", "service-level agreement"]) {
  assert(terms.includes(phrase), `Terms contain required boundary: ${phrase}`);
}
for (const path of ["PRIVACY.md", "TERMS.md", "README.md", "README.zh-CN.md", "docs/installation.md", "docs/installation.zh-CN.md", "docs/release-alpha2.md", "docs/release-alpha2.zh-CN.md"]) {
  validateMarkdownLinks(path);
}

const requiredGates = [
  "publisher_verified_identity",
  "apps_management_write_permission",
  "portal_region_enumeration",
  "portal_asset_format_acceptance",
  "exact_submission_public_source_confirmation"
];
assert(JSON.stringify(candidate.unresolvedGates) === JSON.stringify(requiredGates), "all external submission facts remain explicit gates");

const positive = evaluations.cases.filter((item) => item.polarity === "positive");
const negative = evaluations.cases.filter((item) => item.polarity === "negative");
assert(positive.length >= 5, "evaluation set has at least five positive cases");
assert(negative.length >= 3, "evaluation set has at least three negative cases");
assert(new Set(evaluations.cases.map((item) => item.id)).size === evaluations.cases.length, "evaluation ids are unique");
for (const item of positive) {
  assert(Boolean(item.prompt && item.expectedBehavior && item.expectedResultShape?.length && item.fixture), `positive case is complete: ${item.id}`);
}
for (const item of negative) {
  assert(Boolean(item.prompt && item.expectedFallback && item.reason && item.fixture), `negative case is complete: ${item.id}`);
}
for (const skill of candidate.plugin.skills) {
  assert(positive.some((item) => item.skill === skill), `positive cases cover Skill: ${skill}`);
}
assert(!evaluations.cases.some((item) => /\/Users\/|secret|token=/i.test(item.prompt)), "evaluation prompts contain no private paths or credential material");

assert(!existsSync(resolve(fixture, "package.json")), "fixture has no package.json");
assert(!existsSync(resolve(fixture, "node_modules")), "fixture has no node_modules");
assert(!existsSync(resolve(fixture, ".forgerail")), "fixture starts without .forgerail state");
const before = hashTree(fixture);
const diagnosis = diagnoseWorkspace(fixture);
const after = hashTree(fixture);
assert(diagnosis.mode === "read-only", "no-Node-project diagnosis is read-only");
assert(diagnosis.mutations.length === 0, "no-Node-project diagnosis reports no mutation");
assert(diagnosis.inheritedHabits.some((item) => item.type === "markdown-adr"), "no-Node-project diagnosis discovers Markdown ADR habit");
assert(JSON.stringify(before) === JSON.stringify(after), "no-Node-project fixture remains byte-for-byte unchanged");
assert(!existsSync(resolve(fixture, ".forgerail")), "diagnosis creates no .forgerail state");

process.stdout.write(`${JSON.stringify({ status: "passed", checks: checks.length, positiveCases: positive.length, negativeCases: negative.length, skills: candidate.plugin.skills, fixture: "scripts/fixtures/workspaces/no-node-project", mutations: [] }, null, 2)}\n`);
