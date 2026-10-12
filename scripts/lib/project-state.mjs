import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, opendirSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { inspectBoundedPath } from "./bounded-read.mjs";
import { matchedInlineCodeSpans, markdownRawHtmlOpening } from "./instruction-pointers.mjs";

export const projectFileLimit = 4 * 1024 * 1024;
export const projectDirectoryEntryLimit = 10000;
function boundedDirectoryEntries(path) {
  const directory = opendirSync(path), entries = [];
  try {
    let entry;
    while ((entry = directory.readSync()) !== null) {
      if (entries.length >= projectDirectoryEntryLimit) throw new Error("project directory entry limit exceeded; observation unavailable");
      entries.push(entry.name);
    }
    return entries;
  } finally { directory.closeSync(); }
}
export const CONFIG = ".forgerail/config.json";
export const MANIFEST = ".forgerail/installation.json";
export const JOURNAL = ".forgerail-operation.json";
export const LOCK = ".forgerail-operation.lock";
export const marker = "forgerail:project:codex:v1";
export const framing = `<!-- ${marker}:framing:lf2-lf1 -->`;
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
export const digest = (value) => value === null ? null : hash(value);
const sha = /^[a-f0-9]{64}$/;
export const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[a-zA-Z0-9]+(?:[.-][a-zA-Z0-9]+)*)?$/;
const skills = "(?:architecture-convergence-audit|forgerail|forgerail-workspace-diagnosis|workspace-health-review)";
const ownedSkill = new RegExp(`^\\.agents/skills/${skills}/[A-Za-z0-9._/-]+$`);
export function ownedArtifact(path) {
  return typeof path === "string" && !path.split("/").some((s) => !s || s === "." || s === "..") &&
    (ownedSkill.test(path) || /^\.agents\/vendor\/forgerail\/[0-9A-Za-z.-]+\/(LICENSE|NOTICE)$/.test(path) || path === "AGENTS.md");
}
export function exact(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join() !== [...keys].sort().join()) throw new Error(`invalid ${label}: unknown or missing fields`);
}
export function readProjectFileBytes(workspace, path, maxBytes = projectFileLimit) {
  if (typeof path !== "string" || !/^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/.test(path) || path.split("/").some((s) => s === "." || s === ".." || s.endsWith(".") || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s))) throw new Error(`unsafe project path: ${path}`);
  const root = realpathSync(workspace);
  let cursor = root;
  const parts = path.split("/");
  for (const [index, part] of parts.entries()) {
    let entries;
    try { entries = boundedDirectoryEntries(cursor); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
    if (entries.some((entry) => entry !== part && entry.normalize("NFC").toLowerCase() === part.toLowerCase())) throw new Error(`case alias conflict: ${path}`);
    cursor = resolve(cursor, part);
    let stat;
    try { stat = lstatSync(cursor); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
    if (stat.isSymbolicLink()) throw new Error(`unsafe project target (symbolic link): ${path}`);
    if (index < parts.length - 1 ? !stat.isDirectory() : !stat.isFile()) throw new Error(`unsafe project target (${index < parts.length - 1 ? "not a directory" : "not a regular file"}): ${path}`);
  }
  const fd = openSync(cursor, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = fstatSync(fd);
    if (!before.isFile() || before.size > maxBytes) throw new Error(`oversized/non-file target: ${path}`);
    const bytes = Buffer.alloc(before.size + 1);
    let count = 0;
    while (count < bytes.length) { const n = readSync(fd, bytes, count, bytes.length - count, count); if (!n) break; count += n; }
    const after = fstatSync(fd);
    const current = lstatSync(cursor);
    if (count !== before.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs || current.isSymbolicLink() || current.ino !== before.ino || current.dev !== before.dev) throw new Error(`read drift: ${path}`);
    // Recheck every ancestor following the read, including aliases and symlinks.
    let observed = root;
    for (const part of parts) { observed = resolve(observed, part); if (lstatSync(observed).isSymbolicLink()) throw new Error(`path drift: ${path}`); }
    return bytes.subarray(0, count);
  } finally { closeSync(fd); }
}
export function readProjectFile(workspace, path, maxBytes = projectFileLimit) {
  const bytes = readProjectFileBytes(workspace, path, maxBytes);
  return bytes === null ? null : new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
}
export function validateConfig(value) {
  exact(value, ["schemaVersion", "host"], "project config");
  if (value.schemaVersion !== "1.0" || value.host !== "codex") throw new Error("unsupported project config schema or host");
  return value;
}
export function validateManifest(value) {
  exact(value, ["schemaVersion", "host", "source", "artifacts"], "installation manifest");
  if (value.schemaVersion !== "1.0" || value.host !== "codex") throw new Error("unsupported installation schema or host");
  exact(value.source, ["package", "version", "kind", "sha256"], "installation source");
  if (value.source.package !== "@echopath-labs/forgerail" || !versionPattern.test(value.source.version) || value.source.kind !== "package-content" || !sha.test(value.source.sha256)) throw new Error("invalid installation source");
  if (!Array.isArray(value.artifacts) || !value.artifacts.length || value.artifacts.length > 512) throw new Error("invalid installation artifacts");
  const seen = new Set();
  for (const artifact of value.artifacts) {
    exact(artifact, ["path", "ownership", "sha256"], "installation artifact");
    if (!ownedArtifact(artifact.path) || !sha.test(artifact.sha256) || artifact.ownership !== (artifact.path === "AGENTS.md" ? "managed-block" : "file")) throw new Error("invalid installation artifact ownership");
    const key = artifact.path.toLowerCase();
    if ([...seen].some((p) => p === key || p.startsWith(`${key}/`) || key.startsWith(`${p}/`))) throw new Error("conflicting installation paths");
    seen.add(key);
  }
  if (!seen.has("agents.md")) throw new Error("installation binding missing");
  for (const name of ["license", "notice"]) if (!seen.has(`.agents/vendor/forgerail/${value.source.version.toLowerCase()}/${name}`)) throw new Error("installation license attribution missing");
  for (const name of ["forgerail", "architecture-convergence-audit", "forgerail-workspace-diagnosis", "workspace-health-review"]) if (!seen.has(`.agents/skills/${name}/skill.md`)) throw new Error("installation Skill missing");
  return value;
}
export function managedBlock(content) {
  if (content === null) return null;
  const start = `<!-- ${marker}:start -->`, end = `<!-- ${marker}:end -->`;
  const starts = content.split(start).length - 1, ends = content.split(end).length - 1;
  if (!starts && !ends) return null;
  if (starts !== 1 || ends !== 1 || content.indexOf(start) > content.indexOf(end)) throw new Error("invalid project managed block");
  const from = content.indexOf(start), to = content.indexOf(end) + end.length;
  const block = content.slice(from, to);
  if (block.includes(`<!-- ${marker}:framing:`)) {
    if (!block.startsWith(`${start}\n${framing}\n`) || block.split(framing).length !== 2 || content.slice(from - 2, from) !== "\n\n" || content.slice(to, to + 1) !== "\n") throw new Error("invalid project managed framing; ownership reconciliation required");
    return content.slice(from - 2, to + 1);
  }
  return block;
}

// A bounded structural check, not a general Markdown parser. Blank framing
// ends ordinary paragraph, list and quote contexts, but cannot close a fence
// or HTML comment. Reject those contexts rather than hiding governance in them.
export function assertMarkdownInsertion(content) {
  const text = (content ?? "").replace(/\r\n?/g, "\n").replace(/^\ufeff/gm, "");
  const spans = matchedInlineCodeSpans(text);
  let fence = null, comment = false, rawHtml = null, codeEnd = 0, spanIndex = 0, nextLineOffset = 0;
  for (const line of text.split("\n")) {
    const lineOffset = nextLineOffset;
    nextLineOffset += line.length + 1;
    if (fence) {
      const close = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/);
      if (close && close[1][0] === fence.char && close[1].length >= fence.length) fence = null;
      continue;
    }
    let offset = 0, htmlTail = false;
    if (!comment && !rawHtml && codeEnd <= lineOffset) {
      const open = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
      if (open && !(open[1][0] === "`" && open[2].includes("`"))) { fence = { char: open[1][0], length: open[1].length }; continue; }
      const html = markdownRawHtmlOpening(line);
      // Blank framing ends ordinary HTML blocks; these explicit-terminator
      // blocks must close themselves before governance can be appended.
      if (html?.end !== undefined && html.end !== null) rawHtml = html;
    }
    let commentStart = line.indexOf("<!--", offset), nextHtml;
    const htmlOpen = /<(script|pre|style|textarea)(?=[\s>]|$)|<\?|<!\[CDATA\[|<![A-Z]/ig;
    while (offset < line.length) {
      if (rawHtml) {
        let end;
        if (rawHtml.caseInsensitive) {
          const close = new RegExp(rawHtml.end, "ig"); close.lastIndex = offset;
          end = close.exec(line)?.index ?? -1;
        } else end = line.indexOf(rawHtml.end, offset);
        if (end < 0) break;
        offset = end + rawHtml.end.length; rawHtml = null; htmlTail = true;
        continue;
      }
      if (comment) {
        const end = line.indexOf("-->", offset);
        if (end < 0) break;
        comment = false; offset = end + 3;
        continue;
      }
      if (codeEnd > lineOffset + offset) {
        offset = Math.min(line.length, codeEnd - lineOffset);
        continue;
      }
      if (commentStart !== -1 && commentStart < offset) commentStart = line.indexOf("<!--", offset);
      // The rest of a raw HTML block's closing line is still HTML. Scan it
      // for another container or comment; Markdown escapes/code cannot hide it.
      if (htmlTail && (nextHtml === undefined || (nextHtml !== null && nextHtml.index < offset))) {
        htmlOpen.lastIndex = offset; nextHtml = htmlOpen.exec(line);
      }
      const boundary = Math.min(commentStart < 0 ? line.length : commentStart, nextHtml?.index ?? line.length);
      // Shared block-bounded spans can cross lines. Retain the consumed span's
      // end so its closing ticks cannot become a second opener on the next line.
      // Never consume candidates whose opening ticks were inside real comments.
      while (spanIndex < spans.length && spans.at(spanIndex)[0] < lineOffset + offset) spanIndex++;
      const span = spans.at(spanIndex);
      if (!htmlTail && span && span[0] < lineOffset + boundary) {
        codeEnd = span[1]; offset = Math.min(line.length, codeEnd - lineOffset); continue;
      }
      if (boundary === line.length) break;
      if (boundary === commentStart) { comment = true; offset = boundary + 4; }
      else { rawHtml = markdownRawHtmlOpening(nextHtml[0]); offset = boundary + nextHtml[0].length; }
    }
  }
  if (fence || comment || rawHtml) throw new Error(`unsafe Markdown insertion: unclosed ${fence ? "code fence" : rawHtml ? `HTML ${rawHtml.kind}${rawHtml.caseInsensitive ? " container" : ""}` : "HTML comment"}; reconcile user structure before adoption`);
}
export function projectFileMode(workspace, path) {
  if (readProjectFile(workspace, path) === null) return null;
  const stat = lstatSync(resolve(realpathSync(workspace), path));
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`unsafe permission target: ${path}`);
  return stat.mode & 0o7777;
}
export function readInstallation(workspace) {
  const configText = readProjectFile(workspace, CONFIG), manifestText = readProjectFile(workspace, MANIFEST);
  if (configText === null && manifestText === null) return { configText, manifestText, manifest: null };
  if (configText === null || manifestText === null) throw new Error("partial project metadata; recovery required");
  validateConfig(JSON.parse(configText));
  const manifest = validateManifest(JSON.parse(manifestText));
  return { configText, manifestText, manifest };
}
export function residualWriteEvidence(workspace, paths) {
  const found = [];
  for (const parent of new Set(paths.map((path) => dirname(path)))) {
    if (parent !== ".") {
      const state = inspectBoundedPath(workspace, parent, { finalKind: "directory" }).state;
      if (state === "absent") continue;
      if (state !== "available") throw new Error(`unsafe recovery parent: ${parent}`);
    }
    const location = resolve(workspace, parent);
    let entries;
    try { entries = boundedDirectoryEntries(location); } catch (error) { if (error.code === "ENOENT") continue; throw error; }
    for (const name of entries) if (/^\.forgerail-[a-f0-9]+\.(lock|tmp|bak|source|removed)$/.test(name)) found.push(parent === "." ? name : `${parent}/${name}`);
  }
  return found;
}

export function installationDrift(workspace, manifest) {
  const drift = [];
  for (const artifact of manifest.artifacts) {
    const text = readProjectFile(workspace, artifact.path);
    const actual = artifact.ownership === "managed-block" ? managedBlock(text) : text;
    if (digest(actual) !== artifact.sha256) drift.push(artifact.path);
  }
  return drift;
}
export function projectAdoptionObservation(workspace) {
  let adopted = false;
  try {
    let manifest = null, metadataError = null;
    try { ({ manifest } = readInstallation(workspace)); }
    catch (error) { metadataError = error.message; }
    adopted = manifest !== null;
    let pending = false;
    const recoveryErrors = [];
    for (const path of [JOURNAL, LOCK]) {
      try { if (readProjectFile(workspace, path) !== null) pending = true; }
      catch (error) { pending = true; recoveryErrors.push(error.message); }
    }
    if (pending) {
      const errors = [...(metadataError ? [metadataError] : []), ...recoveryErrors];
      return { status: "recovery-required", adopted, ...(errors.length ? { error: errors.join("; ") } : {}) };
    }
    if (metadataError) return { status: "unavailable", adopted, error: metadataError };
    const residual = residualWriteEvidence(workspace, [JOURNAL, CONFIG, MANIFEST, ...(manifest?.artifacts.map((a) => a.path) ?? [])]);
    if (residual.length) return { status: "recovery-required", adopted, residual };
    if (!manifest) {
      if (readProjectFile(workspace, "AGENTS.md")?.includes(`<!-- ${marker}:`)) return { status: "recovery-required", adopted, error: "orphaned project lifecycle binding in AGENTS.md; ownership reconciliation required" };
      return { status: "not-adopted", adopted };
    }
    const drift = installationDrift(workspace, manifest);
    return { status: drift.length ? "drift" : "ready", adopted, drift };
  } catch (error) { return { status: "unavailable", adopted, error: error.message }; }
}

export function statIdentity(stat) {
  return { device: String(stat.dev), inode: String(stat.ino), size: String(stat.size), mtimeNs: String(stat.mtimeNs), ctimeNs: String(stat.ctimeNs) };
}
export function projectFileIdentity(workspace, path) {
  if (readProjectFile(workspace, path) === null) return null;
  const stat = lstatSync(resolve(realpathSync(workspace), path), { bigint: true });
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`unsafe identity target: ${path}`);
  return statIdentity(stat);
}
export function hasLegacyBinding(text) {
  // Even a single actual boundary needs reconciliation; ordinary prose does not.
  return typeof text === "string" && /<!--\s*forgerail:binding:[a-z0-9-]+:v[0-9]+:(?:start|end)\s*-->/.test(text);
}
export function assertNoProjectLifecycle(workspace) {
  const text = readProjectFile(workspace, "AGENTS.md");
  if (readProjectFile(workspace, JOURNAL) !== null || readProjectFile(workspace, LOCK) !== null ||
      readProjectFile(workspace, CONFIG) !== null || readProjectFile(workspace, MANIFEST) !== null ||
      text?.includes(`<!-- ${marker}:`)) throw new Error("project lifecycle owns this binding; use project update/remove instead of v1 adoption");
}
