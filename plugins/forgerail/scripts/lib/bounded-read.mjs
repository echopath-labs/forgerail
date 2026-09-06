import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const portableRelativePath = /^(?![\\/])(?![a-zA-Z]:)(?!.*\/\/)(?!.*(?:^|\/)\.(?:\/|$))(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\/$)[^\\]+$/;
const maximumDiagnosticFileBytes = 4 * 1024 * 1024;

function confined(root, target) {
  const value = relative(root, target);
  return value === "" || (
    !isAbsolute(value)
    && !/^[a-zA-Z]:/.test(value)
    && value !== ".."
    && !value.startsWith(`..${sep}`)
    && !value.startsWith("/")
  );
}

function sameFile(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function linkAwareStat(path) {
  try { return lstatSync(path); }
  catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return null;
    throw error;
  }
}

export function inspectBoundedPath(root, path, { finalKind = "any", read = false, verify = false } = {}) {
  if (typeof path !== "string" || !portableRelativePath.test(path)) {
    return { state: "unsafe-path", present: false, content: null };
  }
  let cursor = root;
  const segments = path.split("/");
  for (const [index, segment] of segments.entries()) {
    const candidate = resolve(cursor, segment);
    if (!confined(root, candidate)) return { state: "unsafe-path", present: false, content: null };
    let metadata;
    try { metadata = linkAwareStat(candidate); }
    catch { return { state: "unreadable", present: true, content: null }; }
    if (metadata === null) return { state: "absent", present: false, content: null };
    if (metadata.isSymbolicLink()) return { state: "unsafe-symbolic-link", present: true, content: null };
    const final = index === segments.length - 1;
    if (!final && !metadata.isDirectory()) return { state: "unsafe-non-directory", present: true, content: null };
    if (final && finalKind === "file" && !metadata.isFile()) return { state: "unsafe-non-regular", present: true, content: null };
    if (final && finalKind === "directory" && !metadata.isDirectory()) return { state: "unsafe-non-directory", present: true, content: null };
    cursor = candidate;
  }
  if (!read && !verify) return { state: "available", present: true, content: null };
  let descriptor;
  try {
    const before = lstatSync(cursor);
    descriptor = openSync(cursor, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
    const opened = fstatSync(descriptor);
    const observed = realpathSync(cursor);
    const after = lstatSync(observed);
    if (!confined(root, observed) || after.isSymbolicLink() || !sameFile(after, opened)) {
      return { state: "unsafe-identity-change", present: true, content: null };
    }
    if (!opened.isFile() || !sameFile(before, opened)) return { state: "unsafe-identity-change", present: true, content: null };
    if (!read) return { state: "available", present: true, content: null };
    if (opened.size > maximumDiagnosticFileBytes) return { state: "oversized", present: true, content: null };
    const chunks = [];
    let total = 0;
    while (true) {
      const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, maximumDiagnosticFileBytes + 1 - total));
      const count = readSync(descriptor, chunk, 0, chunk.length, null);
      if (count === 0) break;
      total += count;
      if (total > maximumDiagnosticFileBytes) return { state: "oversized", present: true, content: null };
      chunks.push(chunk.subarray(0, count));
    }
    return { state: "available", present: true, content: Buffer.concat(chunks, total).toString("utf8") };
  } catch {
    return { state: "unreadable", present: true, content: null };
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}
