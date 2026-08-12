#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const base = mkdtempSync(resolve(tmpdir(), "forgerail-consumer-"));
const cache = resolve(base, "npm-cache");
const consumer = resolve(base, "consumer");
const target = resolve(base, "target-workspace");
const priorSource = resolve(base, "prior-source");
mkdirSync(consumer, { recursive: true });
mkdirSync(resolve(target, "docs/adr"), { recursive: true });
writeFileSync(resolve(consumer, "package.json"), `${JSON.stringify({ name: "forgerail-disposable-consumer", private: true }, null, 2)}\n`);
writeFileSync(resolve(target, "AGENTS.md"), "# Target\n\nUse the existing Markdown ADRs.\n");
writeFileSync(resolve(target, "docs/adr/0001.md"), "# ADR 0001\n\nUse Markdown decisions.\n");
cpSync(root, priorSource, { recursive: true });
const priorManifest = JSON.parse(readFileSync(resolve(priorSource, "package.json"), "utf8"));
priorManifest.version = "0.1.0-alpha.0";
writeFileSync(resolve(priorSource, "package.json"), `${JSON.stringify(priorManifest, null, 2)}\n`);
const priorPlugin = JSON.parse(readFileSync(resolve(priorSource, ".codex-plugin/plugin.json"), "utf8"));
priorPlugin.version = "0.1.0-alpha.0";
writeFileSync(resolve(priorSource, ".codex-plugin/plugin.json"), `${JSON.stringify(priorPlugin, null, 2)}\n`);

function run(command, args, cwd = consumer) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", env: { ...process.env, npm_config_cache: cache }, maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${(result.stderr || result.stdout).trim()}`);
  return result.stdout.trim();
}

const priorPack = JSON.parse(run("npm", ["pack", priorSource, "--json"], base))[0];
const priorTarball = resolve(base, priorPack.filename);
run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", priorTarball]);
const priorInstalled = JSON.parse(readFileSync(resolve(consumer, "node_modules/forgerail/package.json"), "utf8")).version === "0.1.0-alpha.0";
const pack = JSON.parse(run("npm", ["pack", root, "--json"], base))[0];
const tarball = resolve(base, pack.filename);
run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball]);
const cli = resolve(consumer, "node_modules/.bin/forgerail");
const firstValidation = JSON.parse(run(cli, ["validate"]));
const before = JSON.stringify(readdirSync(target, { recursive: true }).sort());
const diagnosis = JSON.parse(run(cli, ["diagnose", "--workspace", target]));
const after = JSON.stringify(readdirSync(target, { recursive: true }).sort());
const launch = JSON.parse(run(cli, ["launch", "--profile", resolve(root, "scripts/fixtures/contracts/effective-profile.valid.json"), "--envelope", resolve(root, "scripts/fixtures/contracts/task-envelope.valid.json"), "--host-agent", "Codex"]));
const upgraded = JSON.parse(readFileSync(resolve(consumer, "node_modules/forgerail/package.json"), "utf8")).version === pack.version;
run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", priorTarball]);
const rolledBack = JSON.parse(readFileSync(resolve(consumer, "node_modules/forgerail/package.json"), "utf8")).version === "0.1.0-alpha.0";
run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball]);
const reinstallValidation = JSON.parse(run(cli, ["validate"]));
run("npm", ["uninstall", "--no-audit", "--no-fund", "forgerail"]);

const result = {
  schemaVersion: "1.0",
  sourceVersion: pack.version,
  tarball: { files: pack.entryCount, bytes: pack.size, shasum: pack.shasum, integrity: pack.integrity },
  install: firstValidation.valid,
  binaryShim: cli.endsWith("node_modules/.bin/forgerail"),
  priorInstall: priorInstalled,
  discovery: firstValidation.skills,
  diagnosis: diagnosis.mode === "read-only" && diagnosis.recommendations.length === 0,
  targetUnchanged: before === after,
  launch: launch.valid && launch.launch.executionOwner === "host-agent",
  reinstall: reinstallValidation.valid,
  upgrade: upgraded,
  rollback: rolledBack,
  uninstall: !readdirSync(resolve(consumer, "node_modules"), { withFileTypes: true }).some((entry) => entry.name === "forgerail"),
  disposableRoot: "[disposable]",
};
result.passed = result.priorInstall && result.install && result.binaryShim && result.diagnosis && result.targetUnchanged && result.launch && result.upgrade && result.rollback && result.reinstall && result.uninstall;
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
