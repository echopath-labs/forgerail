#!/usr/bin/env node

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBundle } from "../scripts/lib/bundle.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const index = process.argv.indexOf("--output");
const output = index >= 0 ? process.argv[index + 1] : undefined;
if (!output) {
  console.error("build-public-projection: --output is required");
  process.exit(1);
}
const result = buildBundle(root, output);
const summary = {
  schemaVersion: result.schemaVersion,
  productId: result.productId,
  projection: result.projection,
  fileCount: result.fileCount,
  totalBytes: result.totalBytes,
  digest: result.digest,
  receiptDigest: result.receiptDigest,
};
console.log(JSON.stringify(process.argv.includes("--summary") ? summary : result, null, 2));
