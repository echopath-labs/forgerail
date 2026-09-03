import { createHash } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, parse, posix, relative, resolve, sep } from "node:path";

const externalPluginNames = [
  "forgerail-cross-workspace-orchestration",
  "forgerail-github-rulesets",
  "forgerail-release-safety",
  "forgerail-thread-closure",
];
const externalRoots = [".codex-plugin", "scripts", "skills"];
const externalFiles = ["LICENSE", "NOTICE", "README.md", "README.zh-CN.md", "pack.json"];
const maintainerRoots = [".github", "tools"];
const deniedSegments = new Set([".git", ".hg", ".svn", "node_modules", "coverage", "dist", "build", ".cache"]);
const deniedNames = new Set([".env", ".npmrc"]);

function compare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function pathIsConfined(base, candidate, pathApi = { isAbsolute, relative, sep }) {
  const path = pathApi.relative(base, candidate);
  return path === "" || (
    !pathApi.isAbsolute(path)
    && path !== ".."
    && !path.startsWith(`..${pathApi.sep}`)
    && !path.startsWith("/")
  );
}

function confined(base, candidate) {
  return pathIsConfined(base, candidate);
}

function deniedFileName(name) {
  const normalized = name.toLowerCase();
  return deniedNames.has(normalized)
    || [...deniedNames].some((denied) => normalized.startsWith(`${denied}.`))
    || normalized.endsWith(".pem")
    || normalized.endsWith(".key");
}

function safeRelativePath(path) {
  const segments = path.split("/");
  return path !== "" && !path.startsWith("/") && !path.includes("\\")
    && !segments.includes("..") && !segments.some((segment) => deniedSegments.has(segment))
    && !segments.some((segment) => deniedFileName(segment));
}

function regularFile(path, label) {
  const metadata = lstatSync(path);
  if (metadata.isSymbolicLink()) throw new Error(`bundle source must not be a symbolic link: ${label}`);
  if (!metadata.isFile()) throw new Error(`bundle source is not a regular file: ${label}`);
  return metadata;
}

function sameFile(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function bindDirectoryRoot(path, label) {
  const target = resolve(path);
  const observed = lstatSync(target, { bigint: true });
  if (observed.isSymbolicLink() || !observed.isDirectory()) {
    throw new Error(`bundle source root is not a regular directory: ${label}`);
  }
  const descriptor = openSync(
    target,
    constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_DIRECTORY ?? 0),
  );
  const opened = fstatSync(descriptor, { bigint: true });
  if (!opened.isDirectory() || !sameFile(observed, opened)) {
    closeSync(descriptor);
    throw new Error(`bundle source root identity changed before build: ${label}`);
  }
  return { path: target, label, descriptor, identity: opened };
}

function verifyBoundDirectoryRoot(boundRoot) {
  const retained = fstatSync(boundRoot.descriptor, { bigint: true });
  let current;
  try {
    current = lstatSync(boundRoot.path, { bigint: true });
  } catch {
    throw new Error(`bundle source root identity changed during build: ${boundRoot.label}`);
  }
  if (!retained.isDirectory() || current.isSymbolicLink() || !current.isDirectory()
      || !sameFile(retained, boundRoot.identity) || !sameFile(current, boundRoot.identity)) {
    throw new Error(`bundle source root identity changed during build: ${boundRoot.label}`);
  }
}

function withBoundDirectoryPath(boundRoot, path, label, operation) {
  const target = resolve(path);
  if (!confined(boundRoot.path, target)) throw new Error(`bundle source path is not allowed: ${label}`);
  const originalDirectory = process.cwd();
  const descriptors = [];
  try {
    verifyBoundDirectoryRoot(boundRoot);
    const volumeRoot = parse(target).root;
    process.chdir(volumeRoot);
    const rootDescriptor = openSync(
      ".",
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_DIRECTORY ?? 0),
    );
    descriptors.push(rootDescriptor);
    if (volumeRoot === boundRoot.path && !sameFile(fstatSync(rootDescriptor, { bigint: true }), boundRoot.identity)) {
      throw new Error(`bundle source root identity changed during build: ${boundRoot.label}`);
    }

    let cursor = volumeRoot;
    for (const segment of relative(volumeRoot, target).split(sep).filter(Boolean)) {
      const observed = lstatSync(segment, { bigint: true });
      if (observed.isSymbolicLink() || !observed.isDirectory()) {
        throw new Error(`bundle source ancestor is not a bound directory: ${label}`);
      }
      const descriptor = openSync(
        segment,
        constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_DIRECTORY ?? 0),
      );
      const opened = fstatSync(descriptor, { bigint: true });
      if (!opened.isDirectory() || !sameFile(observed, opened)) {
        closeSync(descriptor);
        throw new Error(`bundle source ancestor identity changed before read: ${label}`);
      }
      process.chdir(segment);
      const entered = lstatSync(".", { bigint: true });
      if (!entered.isDirectory() || !sameFile(opened, entered)) {
        closeSync(descriptor);
        throw new Error(`bundle source ancestor identity changed before read: ${label}`);
      }
      descriptors.push(descriptor);
      cursor = resolve(cursor, segment);
      if (cursor === boundRoot.path && !sameFile(opened, boundRoot.identity)) {
        throw new Error(`bundle source root identity changed during build: ${boundRoot.label}`);
      }
    }
    const result = operation();
    verifyBoundDirectoryRoot(boundRoot);
    return result;
  } finally {
    process.chdir(originalDirectory);
    for (const descriptor of descriptors.reverse()) closeSync(descriptor);
  }
}

function readRegularFileBelowBoundRoot(boundRoot, path, label) {
  const source = resolve(boundRoot.path, path);
  if (!confined(boundRoot.path, source)) throw new Error(`bundle source path is not allowed: ${label}`);
  const relativePath = relative(boundRoot.path, source);
  if (!safeRelativePath(relativePath.split(sep).join("/"))) {
    throw new Error(`bundle source path is not allowed: ${label}`);
  }
  return withBoundDirectoryPath(boundRoot, dirname(source), label, () => {
    const leaf = basename(source);
    const observed = lstatSync(leaf, { bigint: true });
    if (observed.isSymbolicLink()) throw new Error(`bundle source must not be a symbolic link: ${label}`);
    if (!observed.isFile()) throw new Error(`bundle source is not a regular file: ${label}`);
    let descriptor;
    try {
      descriptor = openSync(
        leaf,
        constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | constants.O_NONBLOCK,
      );
      const metadata = fstatSync(descriptor, { bigint: true });
      if (!metadata.isFile()) throw new Error(`bundle source is not a regular file: ${label}`);
      if (!sameFile(metadata, observed)) throw new Error(`bundle source identity changed before read: ${label}`);
      return { bytes: readFileSync(descriptor), metadata };
    } finally {
      if (descriptor !== undefined) closeSync(descriptor);
    }
  });
}

function regularFileBelow(root, path, label) {
  const relativePath = relative(root, path);
  const segments = relativePath.split(sep).filter(Boolean);
  if (!safeRelativePath(segments.join("/"))) throw new Error(`bundle source path is not allowed: ${label}`);
  let cursor = root;
  for (const [index, segment] of segments.entries()) {
    cursor = resolve(cursor, segment);
    const metadata = lstatSync(cursor);
    if (metadata.isSymbolicLink()) throw new Error(`bundle source must not traverse a symbolic link: ${label}`);
    if (index < segments.length - 1 && !metadata.isDirectory()) {
      throw new Error(`bundle source ancestor is not a regular directory: ${label}`);
    }
  }
  return regularFile(path, label);
}

function regularDirectoryBelow(root, path, label) {
  const relativePath = relative(root, path);
  const segments = relativePath.split(sep).filter(Boolean);
  if (!safeRelativePath(segments.join("/"))) throw new Error(`bundle source path is not allowed: ${label}`);
  let cursor = root;
  for (const segment of segments) {
    cursor = resolve(cursor, segment);
    const metadata = lstatSync(cursor);
    if (metadata.isSymbolicLink()) throw new Error(`bundle source must not traverse a symbolic link: ${label}`);
    if (!metadata.isDirectory()) throw new Error(`bundle source is not a regular directory: ${label}`);
  }
  return realpathSync(path);
}

function below(base, prefix, result = []) {
  const directory = resolve(base, prefix);
  const metadata = lstatSync(directory);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) throw new Error(`bundle source is not a regular directory: ${prefix}`);
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => compare(left.name, right.name))) {
    const path = prefix === "." ? entry.name : `${prefix}/${entry.name}`;
    if (!safeRelativePath(path)) throw new Error(`bundle source path is not allowed: ${path}`);
    if (entry.isSymbolicLink()) throw new Error(`bundle source must not be a symbolic link: ${path}`);
    if (entry.isDirectory()) below(base, path, result);
    else if (entry.isFile()) result.push(path);
    else throw new Error(`unsupported bundle source entry: ${path}`);
  }
  return result;
}

function packagePayload(boundRoot) {
  const root = boundRoot.path;
  const packageJsonBytes = readRegularFileBelowBoundRoot(boundRoot, "package.json", "package.json").bytes;
  const packageJson = JSON.parse(packageJsonBytes.toString("utf8"));
  if (!Array.isArray(packageJson.files)) throw new Error("package.json files must be an array");
  const entries = packageJson.files;
  const payload = ["package.json"];
  const packageLock = resolve(root, "package-lock.json");
  if (existsSync(packageLock)) {
    regularFile(packageLock, "package-lock.json");
    payload.push("package-lock.json");
  }
  for (const raw of entries) {
    if (typeof raw !== "string" || !safeRelativePath(raw)) {
      throw new Error(`package allowlist path is not allowed: ${raw}`);
    }
    const entry = posix.normalize(raw).replace(/\/+$/, "");
    if (!safeRelativePath(entry)) throw new Error(`package allowlist path is not allowed: ${raw}`);
    if (entry === "marketplace") continue;
    const source = resolve(root, entry);
    if (!confined(root, source) || !existsSync(source)) throw new Error(`package allowlist source is missing: ${raw}`);
    const metadata = lstatSync(source);
    if (metadata.isSymbolicLink()) throw new Error(`package allowlist source must not be a symbolic link: ${raw}`);
    if (metadata.isDirectory()) payload.push(...below(root, entry));
    else if (metadata.isFile()) payload.push(entry);
    else throw new Error(`unsupported package allowlist entry: ${raw}`);
  }
  for (const entry of maintainerRoots) {
    const source = resolve(root, entry);
    if (!existsSync(source)) throw new Error(`maintainer publication source is missing: ${entry}`);
    payload.push(...below(root, entry));
  }
  return [...new Set(payload)].sort(compare);
}

function externalPayload(boundRoot) {
  const root = boundRoot.path;
  const payload = [];
  for (const entry of externalFiles) {
    const source = resolve(root, entry);
    if (existsSync(source)) {
      regularFile(source, entry);
      payload.push(entry);
    }
  }
  for (const entry of externalRoots) {
    const source = resolve(root, entry);
    if (!existsSync(source)) continue;
    payload.push(...below(root, entry));
  }
  if (!payload.includes(".codex-plugin/plugin.json") || !payload.includes("pack.json")) {
    throw new Error(`external Plugin publication allowlist is incomplete: ${root}`);
  }
  return payload.sort(compare);
}

function sourceLayout(root) {
  const privateCatalog = resolve(root, "marketplace/.agents/plugins/marketplace.json");
  const publicCatalog = resolve(root, ".agents/plugins/marketplace.json");
  if (existsSync(privateCatalog)) {
    return {
      catalog: privateCatalog,
      externalRoots: Object.fromEntries(externalPluginNames.map((name) => [name, resolve(root, "..", name)])),
    };
  }
  if (existsSync(publicCatalog)) {
    return {
      catalog: publicCatalog,
      externalRoots: Object.fromEntries(externalPluginNames.map((name) => [name, resolve(root, "plugins", name)])),
    };
  }
  throw new Error("supported ForgeRail private or public bundle layout was not found");
}

function outputParent(target) {
  const lexicalBases = [...new Set([tmpdir(), "/private/tmp", "/tmp"].map((base) => resolve(base)))]
    .filter((base) => existsSync(base));
  const lexicalBase = lexicalBases.find((base) => confined(base, target) && target !== base);
  if (!lexicalBase) throw new Error("output must be a new directory below the host temporary directory");
  const parentSegments = relative(lexicalBase, dirname(target)).split(sep).filter(Boolean);
  let cursor = realpathSync(lexicalBase);
  for (const segment of parentSegments) {
    const candidate = resolve(cursor, segment);
    if (!existsSync(candidate)) throw new Error("output parent directory must already exist");
    const metadata = lstatSync(candidate);
    if (metadata.isSymbolicLink()) throw new Error("output parent directory must not contain symbolic links");
    if (!metadata.isDirectory()) throw new Error("output parent must be a directory");
    cursor = realpathSync(candidate);
  }
  const realBases = [...new Set(lexicalBases.map((base) => realpathSync(base)))];
  if (!realBases.some((base) => confined(base, cursor))) throw new Error("output must be a new directory below the host temporary directory");
  return cursor;
}

function bindOutputParent(path) {
  const observed = lstatSync(path, { bigint: true });
  if (observed.isSymbolicLink() || !observed.isDirectory()) {
    throw new Error("output parent must be a bound directory");
  }
  const descriptor = openSync(
    path,
    constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_DIRECTORY ?? 0),
  );
  const opened = fstatSync(descriptor, { bigint: true });
  if (!opened.isDirectory() || !sameFile(observed, opened)) {
    closeSync(descriptor);
    throw new Error("output parent identity changed before build");
  }
  return { path, descriptor, identity: opened };
}

function verifyBoundOutputParent(binding) {
  const retained = fstatSync(binding.descriptor, { bigint: true });
  let current;
  try {
    current = lstatSync(binding.path, { bigint: true });
  } catch {
    throw new Error("output parent identity changed during build");
  }
  const entered = lstatSync(".", { bigint: true });
  if (
    !retained.isDirectory()
    || current.isSymbolicLink()
    || !current.isDirectory()
    || !entered.isDirectory()
    || !sameFile(binding.identity, retained)
    || !sameFile(binding.identity, current)
    || !sameFile(binding.identity, entered)
  ) {
    throw new Error("output parent identity changed during build");
  }
}

export function buildBundle(rootInput, output, testHooks = {}) {
  const root = realpathSync(resolve(rootInput));
  const requestedTarget = resolve(output);
  if (existsSync(requestedTarget)) throw new Error("output already exists");
  const parent = outputParent(requestedTarget);
  const targetName = basename(requestedTarget);
  const target = resolve(parent, targetName);
  if (!confined(parent, target)) throw new Error("output escapes its parent directory");
  if (confined(root, target)) throw new Error("output must not be inside the source tree");

  const boundRoots = [];
  const originalDirectory = process.cwd();
  const outputBinding = bindOutputParent(parent);
  try {
    process.chdir(parent);
    verifyBoundOutputParent(outputBinding);
    if (existsSync(targetName)) throw new Error("output already exists");
    const rootBinding = bindDirectoryRoot(root, "ForgeRail Core");
    boundRoots.push(rootBinding);
    const layout = sourceLayout(root);
    regularFileBelow(root, layout.catalog, "marketplace catalog");
    const payload = packagePayload(rootBinding);
    const externalPluginRoots = externalPluginNames.map((name) => {
      const pluginRoot = layout.externalRoots[name];
      if (!existsSync(pluginRoot)) throw new Error(`external Plugin source is missing: ${name}`);
      const pluginBase = confined(root, pluginRoot) ? root : confined(dirname(root), pluginRoot) ? dirname(root) : null;
      if (!pluginBase) {
        throw new Error(`external Plugin source escapes supported roots: ${name}`);
      }
      const realPluginRoot = regularDirectoryBelow(pluginBase, pluginRoot, `external Plugin ${name}`);
      if (!confined(pluginBase, realPluginRoot)) throw new Error(`external Plugin source escapes supported roots: ${name}`);
      const binding = bindDirectoryRoot(realPluginRoot, `external Plugin ${name}`);
      boundRoots.push(binding);
      return { name, root: realPluginRoot, binding };
    });
    if (externalPluginRoots.some((plugin) => confined(plugin.root, target))) {
      throw new Error("output must not be inside an external Plugin source tree");
    }
    const externalPlugins = externalPluginRoots.map((plugin) => ({
      ...plugin,
      files: externalPayload(plugin.binding),
    }));

    const projections = [
      {
        sourceRoot: rootBinding,
        sourcePath: relative(root, layout.catalog),
        sourceIdentity: "marketplace/.agents/plugins/marketplace.json",
        target: ".agents/plugins/marketplace.json",
      },
      ...payload.flatMap((path) => [
        { sourceRoot: rootBinding, sourcePath: path, sourceIdentity: path, target: path },
        { sourceRoot: rootBinding, sourcePath: path, sourceIdentity: path, target: `plugins/forgerail/${path}` },
      ]),
      ...externalPlugins.flatMap((plugin) => plugin.files.map((path) => ({
        sourceRoot: plugin.binding,
        sourcePath: path,
        sourceIdentity: `../${plugin.name}/${path}`,
        target: `plugins/${plugin.name}/${path}`,
      }))),
    ].sort((left, right) => compare(left.target, right.target));

    const targets = new Set();
    for (const projection of projections) {
      if (targets.has(projection.target)) throw new Error(`duplicate bundle target: ${projection.target}`);
      targets.add(projection.target);
    }
    if (typeof testHooks.afterSourceEnumeration === "function") testHooks.afterSourceEnumeration();
    verifyBoundOutputParent(outputBinding);

    let targetBinding;
    const inventory = [];
    let targetReserved = false;
    try {
      const materialized = projections.map((projection) => {
        if (!safeRelativePath(projection.target)) throw new Error(`bundle target path is not allowed: ${projection.target}`);
        const { bytes, metadata } = readRegularFileBelowBoundRoot(
          projection.sourceRoot,
          projection.sourcePath,
          projection.sourceIdentity,
        );
        return { projection, bytes, metadata };
      });
      for (const boundRoot of boundRoots) verifyBoundDirectoryRoot(boundRoot);
      verifyBoundOutputParent(outputBinding);
      if (typeof testHooks.beforeOutputReservation === "function") testHooks.beforeOutputReservation();
      mkdirSync(targetName, { mode: 0o700 });
      targetReserved = true;
      targetBinding = bindDirectoryRoot(target, "bundle output");

      for (const { projection, bytes, metadata } of materialized) {
        verifyBoundDirectoryRoot(targetBinding);
        const destination = resolve(target, projection.target);
        if (!confined(target, destination)) throw new Error(`bundle target escapes reserved output directory: ${projection.target}`);
        mkdirSync(dirname(destination), { recursive: true });
        const mode = (metadata.mode & 0o111n) === 0n ? 0o644 : 0o755;
        writeFileSync(destination, bytes, { flag: "wx", mode });
        chmodSync(destination, mode);
        const stagedBytes = readFileSync(destination);
        inventory.push({
          path: projection.target,
          source: projection.sourceIdentity,
          type: "file",
          mode: mode.toString(8).padStart(3, "0"),
          bytes: stagedBytes.length,
          sha256: createHash("sha256").update(stagedBytes).digest("hex"),
        });
      }
      for (const boundRoot of boundRoots) verifyBoundDirectoryRoot(boundRoot);
      verifyBoundDirectoryRoot(targetBinding);
      verifyBoundOutputParent(outputBinding);
      verifyBoundOutputParent(outputBinding);
    } catch (error) {
      if (targetReserved) {
        try {
          const current = lstatSync(target, { bigint: true });
          if (targetBinding !== undefined && sameFile(current, targetBinding.identity)) {
            closeSync(targetBinding.descriptor);
            targetBinding = undefined;
            rmSync(target, { recursive: true, force: true });
          }
        } catch {}
      }
      throw error;
    } finally {
      if (targetBinding !== undefined) closeSync(targetBinding.descriptor);
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
  } finally {
    for (const boundRoot of boundRoots.reverse()) closeSync(boundRoot.descriptor);
    process.chdir(originalDirectory);
    closeSync(outputBinding.descriptor);
  }
}
