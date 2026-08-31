#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const checks = [];
const failures = [];

const requiredFiles = [
  "README.md",
  "README.zh-CN.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "CODE_OF_CONDUCT.md",
  "SUPPORT.md",
  "LICENSE",
  "docs/installation.md",
  "docs/installation.zh-CN.md",
  "docs/adoption.md",
  "docs/adoption.zh-CN.md",
  "docs/composable-autonomy.zh-CN.md",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/ISSUE_TEMPLATE/bug_report.yml",
  ".github/ISSUE_TEMPLATE/feature_request.yml",
  ".github/ISSUE_TEMPLATE/documentation.yml",
  ".github/ISSUE_TEMPLATE/config.yml"
];

const publicTextFiles = requiredFiles.filter((path) => extname(path) === ".md" || extname(path) === ".yml");
const entryFiles = ["README.md", "README.zh-CN.md", "docs/installation.md", "docs/installation.zh-CN.md", "docs/adoption.md", "docs/adoption.zh-CN.md"];
const issueForms = [
  ".github/ISSUE_TEMPLATE/bug_report.yml",
  ".github/ISSUE_TEMPLATE/feature_request.yml",
  ".github/ISSUE_TEMPLATE/documentation.yml"
];
const skills = ["$forgerail", "$forgerail-workspace-diagnosis", "$workspace-health-review", "$architecture-convergence-audit"];
const exactInstall = "codex plugin marketplace add echopath-labs/forgerail --ref v0.1.0-alpha.3";

function record(condition, message) {
  if (!condition) failures.push(message);
  else checks.push(message);
}

function read(relativePath) {
  return readFileSync(resolve(pluginRoot, relativePath), "utf8");
}

function classify(kind, content, base = pluginRoot) {
  const errors = [];
  if (kind === "release-text") {
    if (/current[^\n]{0,80}(?:alpha\.2|0\.1\.0-alpha\.2)|install[^\n]{0,80}v0\.1\.0-alpha\.2/i.test(content)) errors.push("stale-release");
  }
  if (kind === "markdown-link") {
    for (const match of content.matchAll(/\[[^\]]+\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g)) {
      const target = match[1];
      if (/^(?:https?:\/\/|mailto:|#)/.test(target)) continue;
      const path = decodeURIComponent(target.split("#")[0]);
      if (!path) continue;
      const resolved = resolve(base, path);
      if (!resolved.startsWith(`${pluginRoot}${sep}`) || !existsSync(resolved)) errors.push("broken-link");
    }
  }
  if (kind === "issue-form") {
    if (!/^name:\s*\S.+$/m.test(content) || !/^description:\s*\S.+$/m.test(content)) errors.push("invalid-issue-metadata");
  }
  if (kind === "public-text") {
    if (/\/Users\/|\.codex\/worktrees\/|[A-Za-z]:\\Users\\/.test(content)) errors.push("private-path");
    if (/openspec\/changes\/|canonical private source workspace|active change[^\n]{0,80}tasks\.md|inventory\/[^\s`)]+-\d{8}\.md/i.test(content)) {
      errors.push("private-process-reference");
    }
  }
  if (kind === "no-node-claim") {
    const lines = content.split(/\r?\n/);
    const requiresProjectNode = lines.some((line) => {
      if (!/(?:project|workspace)[^\n]{0,80}(?:requires?|must have|needs?)[^\n]{0,40}Node\.js/i.test(line)) return false;
      return !/(?:does not|doesn't|do not|don't|no project-local|不要求|不需要|无需)/i.test(line);
    });
    if (/(?:before|to) (?:use|using|install)[^\n]{0,100}(?:initialize|create|add)[^\n]{0,40}package\.json/i.test(content) || requiresProjectNode) errors.push("project-node-required");
  }
  return [...new Set(errors)].sort();
}

for (const path of requiredFiles) record(existsSync(resolve(pluginRoot, path)), `required public file exists: ${path}`);

for (const path of entryFiles) {
  const content = read(path);
  record(content.includes("0.1.0-alpha.3") && content.includes("v0.1.0-alpha.3"), `released alpha.3 identity is explicit: ${path}`);
  record(!classify("release-text", content).includes("stale-release"), `no stale alpha.2 current-install claim: ${path}`);
  record(classify("public-text", content).length === 0, `no private path: ${path}`);
  record(classify("markdown-link", content, dirname(resolve(pluginRoot, path))).length === 0, `relative Markdown links resolve: ${path}`);
}

for (const path of ["README.md", "README.zh-CN.md", "docs/installation.md", "docs/installation.zh-CN.md"]) {
  const content = read(path);
  record(content.includes(exactInstall), `exact alpha.3 Marketplace command is present: ${path}`);
  for (const skill of skills) record(content.includes(skill), `${path} covers ${skill}`);
}

for (const path of ["README.md", "README.zh-CN.md", "docs/installation.md", "docs/installation.zh-CN.md"]) {
  const content = read(path);
  record(/does not (?:require|need)|不要求|不需要/.test(content) && content.includes("package.json") && content.includes("node_modules") && content.includes(".forgerail/"), `Plugin Only no-project-Node boundary is explicit: ${path}`);
  record(classify("no-node-claim", content).length === 0, `no accidental project Node requirement: ${path}`);
}

for (const path of publicTextFiles) {
  const content = read(path);
  record(classify("public-text", content).length === 0, `public text has no private path or process reference: ${path}`);
}

for (const path of issueForms) {
  record(classify("issue-form", read(path)).length === 0, `issue form has name and description: ${path}`);
}

const fixtures = JSON.parse(read("scripts/fixtures/open-source-docs/cases.json"));
record(fixtures.schemaVersion === "1.0" && Array.isArray(fixtures.cases), "documentation fixture schema is valid");
for (const fixture of fixtures.cases) {
  const base = fixture.kind === "markdown-link" ? resolve(pluginRoot, "scripts/fixtures/open-source-docs") : pluginRoot;
  const content = fixture.content.replace("__PRIVATE_USER_PATH__", ["", "Users", "example", ".codex", "worktrees", "private", "project"].join("/"));
  const actual = classify(fixture.kind, content, base);
  const expected = [...fixture.expectedErrors].sort();
  record(JSON.stringify(actual) === JSON.stringify(expected), `fixture fails closed as expected: ${fixture.id}`);
}

if (failures.length > 0) {
  console.error(JSON.stringify({ status: "failed", checks: checks.length, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ status: "passed", checks: checks.length, fixtures: fixtures.cases.length }, null, 2));
