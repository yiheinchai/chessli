import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));

test("ships a minimal Manifest V3 permission set", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["storage"]);
  assert.deepEqual(manifest.host_permissions, [
    "https://www.chess.com/*",
    "https://api.chess.com/*",
    "https://lichess.org/*"
  ]);
});

test("declares only packaged executable code", async () => {
  const files = ["background.js", "content.js", "popup.js", "lib/core.js", "lib/review.js"];
  for (const file of files) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /<script[^>]+src=["']https?:/i);
    assert.doesNotMatch(source, /\beval\s*\(/);
    assert.doesNotMatch(source, /new\s+Function\s*\(/);
  }
});
