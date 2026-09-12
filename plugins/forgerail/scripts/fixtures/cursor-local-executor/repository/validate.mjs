import { readFileSync } from "node:fs";

const expected = process.argv[2] ?? "original";
const actual = readFileSync(new URL("./src/value.txt", import.meta.url), "utf8");

if (actual !== `${expected}\n`) {
  console.error(`expected src/value.txt to equal ${JSON.stringify(`${expected}\n`)}, received ${JSON.stringify(actual)}`);
  process.exit(1);
}

console.log(JSON.stringify({ status: "passed", path: "src/value.txt", expected }));
