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
  const files = [
    "background.js",
    "content.js",
    "lichess-paste.js",
    "popup.js",
    "lib/core.js",
    "lib/review.js"
  ];
  for (const file of files) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /<script[^>]+src=["']https?:/i);
    assert.doesNotMatch(source, /\beval\s*\(/);
    assert.doesNotMatch(source, /new\s+Function\s*\(/);
  }
});

test("hands the PGN to Lichess's signed-in computer-review form", async () => {
  const lichessScript = await readFile(new URL("../lichess-paste.js", import.meta.url), "utf8");
  assert.match(lichessScript, /input\[name="analyse"\]/);
  assert.match(lichessScript, /analyseInput\.checked = true/);
  assert.match(lichessScript, /form\.requestSubmit\(\)/);
});
