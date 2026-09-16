import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFileSync, closeSync, mkdtempSync, openSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { adoptionWriteApprovalDigest, applyApprovedAdoptionWrite } from "./lib/adoption.mjs";

const hash = value => createHash("sha256").update(value).digest("hex");
const marker = "forgerail:binding:codex:v1";
const start = `<!-- ${marker}:start -->`, end = `<!-- ${marker}:end -->`;
function fixture(t, prior, operation = "append-managed-block") {
  const workspace = realpathSync(mkdtempSync(resolve(tmpdir(), "forgerail-write-reliability-")));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  const target = resolve(workspace, "AGENTS.md");
  writeFileSync(target, prior);
  const metadata = statSync(workspace, { bigint: true });
  const workspaceSha256 = hash(JSON.stringify({ schemaVersion: "1.0", canonicalPath: workspace, device: String(metadata.dev), inode: String(metadata.ino) }));
  const content = `${start}\nNew rules.\n${end}\n`;
  const write = { workspaceSha256, path: "AGENTS.md", operation, baseSha256: hash(prior), content, contentSha256: hash(content), managedMarker: marker };
  write.approvalSha256 = adoptionWriteApprovalDigest(write);
  return { workspace, target, write };
}
const apply = (f, hooks) => applyApprovedAdoptionWrite(f.workspace, f.write, f.write.approvalSha256, hooks);

test("malformed approved replacement boundaries fail without changing the target", t => {
  const prior = `Prefix\n${start}\nOld\n${end}\nSuffix\n`;
  for (const content of [`${start}\nNew\n`, `New\n${end}`, `${end}\n${start}`, `${start}\n${start}\n${end}`, `${start}\n${end}\n${end}`]) {
    const f = fixture(t, prior, "replace-managed-block");
    f.write.content = content;
    f.write.contentSha256 = hash(content);
    f.write.approvalSha256 = adoptionWriteApprovalDigest(f.write);
    assert.throws(() => apply(f), /ordered.*boundary/);
    assert.equal(readFileSync(f.target, "utf8"), prior);
    assert.deepEqual(readdirSync(f.workspace), ["AGENTS.md"]);
  }
});

test("in-place append and rewrite before replacement are conflicts without data loss", t => {
  for (const mutate of [path => appendFileSync(path, "USER-EDIT\n"), path => writeFileSync(path, "USER-REWRITE\n")]) {
    const f = fixture(t, "Original\n");
    const inode = statSync(f.target).ino;
    let edited;
    assert.throws(() => apply(f, { beforeReplace() { mutate(f.target); edited = readFileSync(f.target); assert.equal(statSync(f.target).ino, inode); } }), /drift|changed/);
    assert.deepEqual(readFileSync(f.target), edited);
    assert.deepEqual(readdirSync(f.workspace), ["AGENTS.md"]);
  }
});

test("cooperating helpers cannot write the same target concurrently", t => {
  const f = fixture(t, "Original\n");
  apply(f, { beforeReplace() { assert.throws(() => apply(f), /locked|in progress/); } });
  assert.ok(readFileSync(f.target, "utf8").includes("New rules."));
  assert.deepEqual(readdirSync(f.workspace), ["AGENTS.md"]);
});

test("recovery snapshot is independent of the original inode", t => {
  const f = fixture(t, "Original\n");
  apply(f, { beforeReplace() {
    const backup = readdirSync(f.workspace).find(name => name.endsWith(".bak"));
    assert.ok(backup);
    assert.notEqual(statSync(resolve(f.workspace, backup)).ino, statSync(f.target).ino);
    assert.equal(readFileSync(resolve(f.workspace, backup), "utf8"), "Original\n");
  } });
});

test("editing the replaced source through an open descriptor is recovered", t => {
  for (const throwAfterEdit of [false, true]) {
  const f = fixture(t, "Original\n");
  const fd = openSync(f.target, "a");
  try {
    assert.throws(() => apply(f, { afterInstall() { writeSync(fd, "LATE-USER-EDIT\n"); if (throwAfterEdit) throw Error("injected failure"); } }), /drift|changed|injected failure/);
  } finally { closeSync(fd); }
  assert.equal(readFileSync(f.target, "utf8"), "Original\nLATE-USER-EDIT\n");
  }
});

test("same-inode edits of the installed file survive failure and retain recovery", t => {
  for (const throwAfterEdit of [false, true]) {
    const f = fixture(t, "Original\n");
    let error;
    try { apply(f, { afterInstall() { appendFileSync(f.target, "NEW-USER-EDIT\n"); if (throwAfterEdit) throw Error("injected failure"); } }); } catch (caught) { error = caught; }
    assert.ok(error);
    assert.match(error.message, /recovery evidence retained/);
    assert.ok(readFileSync(f.target, "utf8").endsWith("NEW-USER-EDIT\n"));
    const backup = readdirSync(f.workspace).find(name => name.endsWith(".bak"));
    assert.equal(readFileSync(resolve(f.workspace, backup), "utf8"), "Original\n");
  }
});

test("managed writes preserve every prefix/suffix byte and repeated writes are no-ops", t => {
  for (const eol of ["\n", "\r\n"]) for (const suffix of ["", eol, `${eol}${eol}Suffix  ${eol}`]) {
    const prefix = `Prefix  ${eol}${eol}`;
    const f = fixture(t, `${prefix}${start}${eol}Old${eol}${end}${suffix}`, "replace-managed-block");
    apply(f);
    const first = readFileSync(f.target, "utf8");
    assert.equal(first.slice(0, prefix.length), prefix);
    assert.equal(first.slice(first.indexOf(end) + end.length), suffix);
    const inode = statSync(f.target).ino;
    for (let i = 0; i < 10; i++) {
      f.write.baseSha256 = hash(first);
      f.write.approvalSha256 = adoptionWriteApprovalDigest(f.write);
      assert.equal(apply(f).unchanged, true);
      assert.equal(readFileSync(f.target, "utf8"), first);
      assert.equal(statSync(f.target).ino, inode);
    }
  }
  for (const prior of ["", "No newline  ", "Trailing spaces  \n\n\n", "CRLF  \r\n\r\n"]) {
    const f = fixture(t, prior);
    apply(f);
    assert.ok(readFileSync(f.target, "utf8").startsWith(prior));
  }
});
