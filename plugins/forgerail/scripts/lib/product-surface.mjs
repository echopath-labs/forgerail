// Publication scope check, not a semantic or security sandbox.
export function validateProductSurface(manifest, paths) {
  const errors = [];
  const declared = (manifest.files ?? []).filter((path) => /^scripts(?:\/|$)/.test(path));
  const code = declared.filter((path) => /^scripts\/(?:lib\/)?[a-z0-9.-]+\.mjs$/.test(path));
  for (const path of declared) {
    if (path !== "scripts/fixtures/" && !code.includes(path)) errors.push(`script publication must be explicit: ${path}`);
  }
  if (JSON.stringify(manifest.bin) !== JSON.stringify({ forgerail: "scripts/forgerail.mjs" })) {
    errors.push("the public CLI entrypoint must remain forgerail");
  }
  const files = new Set(paths);
  for (const path of code) if (!files.has(path)) errors.push(`declared script missing: ${path}`);
  for (const path of files) {
    if (!path.startsWith("scripts/")) continue;
    const fixtureData = path.startsWith("scripts/fixtures/") && /\.(?:json|md)$/.test(path);
    if (!fixtureData && !code.includes(path)) errors.push(`undeclared script surface: ${path}`);
  }
  return errors;
}
