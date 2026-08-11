import test from "node:test";
import assert from "node:assert/strict";
import {
  analysisUrl,
  archiveDate,
  archiveUrl,
  extractGameId,
  findPgn,
  isRecentFinish
} from "../lib/core.js";
import { fetchGameMetadata, fetchGamePgn, importPgnToLichess } from "../lib/review.js";

test("extracts IDs from current Chess.com game URL shapes", () => {
  assert.equal(extractGameId("https://www.chess.com/game/172857749116"), "172857749116");
  assert.equal(extractGameId("https://www.chess.com/game/live/172857749116?tab=analysis"), "172857749116");
  assert.equal(extractGameId("https://www.chess.com/game/daily/12345"), null);
  assert.equal(extractGameId("https://www.chess.com/play/online"), null);
});

test("builds the public archive location from PGN date", () => {
  const metadata = { game: { pgnHeaders: { Date: "2026.08.11" } } };
  assert.deepEqual(archiveDate(metadata), { year: "2026", month: "08" });
  assert.equal(
    archiveUrl("A Player", archiveDate(metadata)),
    "https://api.chess.com/pub/player/A%20Player/games/2026/08"
  );
});

test("finds only the matching game PGN", () => {
  const games = [
    { url: "https://www.chess.com/game/live/1", pgn: "wrong" },
    { url: "https://www.chess.com/game/live/172857749116", pgn: "1. e4 e5" }
  ];
  assert.equal(findPgn(games, "172857749116"), "1. e4 e5");
  assert.equal(findPgn(games, "2"), null);
});

test("builds and validates the Lichess analysis URL", () => {
  assert.equal(analysisUrl("3qsoF7x1"), "https://lichess.org/analysis/game/3qsoF7x1");
  assert.throws(() => analysisUrl("bad/id"), /invalid/);
});

test("recognizes a recent completed game", () => {
  const now = Date.UTC(2026, 7, 11, 20, 10, 0);
  const metadata = { game: { endTime: now / 1000 - 30 } };
  assert.equal(isRecentFinish(metadata, now), true);
  assert.equal(isRecentFinish(metadata, now + 10 * 60 * 1000), false);
});

test("runs metadata, archive, and Lichess requests with expected contracts", async () => {
  const requests = [];
  const metadata = {
    game: {
      id: 172857749116,
      isFinished: true,
      pgnHeaders: { Date: "2026.08.11", White: "white", Black: "black" }
    }
  };

  const fakeFetch = async (url, options = {}) => {
    requests.push({ url, options });
    if (url.includes("callback/live/game")) return jsonResponse(metadata);
    if (url.includes("api.chess.com")) {
      return jsonResponse({ games: [{ url: "https://www.chess.com/game/live/172857749116", pgn: "1. e4 e5 1-0" }] });
    }
    if (url === "https://lichess.org/api/import") {
      return jsonResponse({ id: "3qsoF7x1", url: "https://lichess.org/3qsoF7x1" });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const fetchedMetadata = await fetchGameMetadata("172857749116", fakeFetch);
  const pgn = await fetchGamePgn("172857749116", fetchedMetadata, fakeFetch);
  const imported = await importPgnToLichess(pgn, fakeFetch);

  assert.equal(imported.analysisUrl, "https://lichess.org/analysis/game/3qsoF7x1");
  assert.match(requests[2].options.body, /pgn=1\.\+e4\+e5\+1-0/);
  assert.equal(requests[2].options.credentials, "omit");
});

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
