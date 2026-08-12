import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";

const roots = [".codex-plugin", ".github", "contracts", "docs", "packs", "scripts", "skills"];
const files = ["CHANGELOG.md", "CONTRIBUTING.md", "LICENSE", "NOTICE", "PLUGIN.md", "README.md", "README.zh-CN.md", "SECURITY.md", "package.json"];
const catalog = "marketplace/.agents/plugins/marketplace.json";
const externalPluginNames = [
  "forgerail-github-rulesets",
  "forgerail-release-safety",
  "forgerail-thread-closure",
];

function below(base, prefix, result = []) {
  for (const entry of readdirSync(resolve(base, prefix), { withFileTypes: true })) {
    const path = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) below(base, path, result);
    else if (entry.isFile()) result.push(path);
    else throw new Error(`unsupported entry: ${path}`);
  }
  return result;
}

export function buildBundle(root, output) {
  const target = resolve(output);
  const relativeToTmp = relative("/private/tmp", target);
  const relativeToSystemTmp = relative("/tmp", target);
  const safe = (value) => value !== "" && value !== ".." && !value.startsWith(`..${sep}`) && !value.startsWith("/");
  if (!safe(relativeToTmp) && !safe(relativeToSystemTmp)) throw new Error("output must be a new directory below /private/tmp or /tmp");
  if (existsSync(target)) throw new Error("output already exists");
  for (const required of [...roots, ...files, catalog]) if (!existsSync(resolve(root, required))) throw new Error(`public bundle source is missing: ${required}`);
  const payload = [...files, ...roots.flatMap((prefix) => below(root, prefix))].sort();
  const externalPlugins = externalPluginNames.map((name) => {
    const pluginRoot = resolve(root, `../${name}`);
    if (!existsSync(pluginRoot)) throw new Error(`external Plugin source is missing: ${name}`);
    return {
      name,
      root: pluginRoot,
      files: below(pluginRoot, ".").map((path) => path.startsWith("./") ? path.slice(2) : path).sort(),
    };
  });
  const inventory = [];
  const projections = [
    { source: catalog, target: ".agents/plugins/marketplace.json" },
    ...payload.flatMap((path) => [
      { source: path, target: path },
      { source: path, target: `plugins/forgerail/${path}` },
    ]),
    ...externalPlugins.flatMap((plugin) => plugin.files.map((path) => ({
      source: resolve(plugin.root, path),
      target: `plugins/${plugin.name}/${path}`,
      externalSource: `../${plugin.name}/${path}`,
      absolute: true,
    }))),
  ].sort((left, right) => left.target.localeCompare(right.target));
  for (const { source: path, target: publicPath, externalSource, absolute = false } of projections) {
    const source = absolute ? path : resolve(root, path);
    if (!statSync(source).isFile()) throw new Error(`bundle source is not a file: ${path}`);
    const destination = resolve(target, publicPath);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
    const bytes = readFileSync(source);
    inventory.push({ path: publicPath, source: absolute ? externalSource : path, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  const digest = createHash("sha256").update(`${JSON.stringify(inventory)}\n`).digest("hex");
  return {
    schemaVersion: "1.0",
    productId: "forgerail",
    projection: "marketplace-root-plus-nested-plugin",
    fileCount: inventory.length,
    totalBytes: inventory.reduce((sum, item) => sum + item.bytes, 0),
    digest,
    receiptDigest: createHash("sha256").update(`forgerail\n${digest}\n${inventory.length}\n`).digest("hex"),
    files: inventory,
  };
}
