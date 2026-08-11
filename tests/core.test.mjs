import test from "node:test";
import assert from "node:assert/strict";
import {
  archiveDate,
  archiveUrl,
  extractGameId,
  findPgn,
  isRecentFinish,
  lichessGameUrl,
  lichessPasteUrl
} from "../lib/core.js";
import { fetchGameMetadata, fetchGamePgn } from "../lib/review.js";

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

test("recognizes the short Lichess review URL", () => {
  assert.equal(lichessGameUrl("https://lichess.org/n0uVFFan"), "https://lichess.org/n0uVFFan");
  assert.equal(lichessGameUrl("https://lichess.org/n0uVFFan/white#42"), "https://lichess.org/n0uVFFan");
  assert.equal(lichessGameUrl("https://lichess.org/analysis/game/n0uVFFan"), null);
});

test("builds a private hand-off URL for the Lichess paste page", () => {
  assert.equal(
    lichessPasteUrl("12345678-1234-1234-1234-123456789abc"),
    "https://lichess.org/paste#chessli=12345678-1234-1234-1234-123456789abc"
  );
  assert.throws(() => lichessPasteUrl("short"), /invalid/);
});

test("recognizes a recent completed game", () => {
  const now = Date.UTC(2026, 7, 11, 20, 10, 0);
  const metadata = { game: { endTime: now / 1000 - 30 } };
  assert.equal(isRecentFinish(metadata, now), true);
  assert.equal(isRecentFinish(metadata, now + 10 * 60 * 1000), false);
});

test("runs Chess.com metadata and archive requests with expected contracts", async () => {
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
    throw new Error(`Unexpected URL: ${url}`);
  };

  const fetchedMetadata = await fetchGameMetadata("172857749116", fakeFetch);
  const pgn = await fetchGamePgn("172857749116", fetchedMetadata, fakeFetch);

  assert.equal(pgn, "1. e4 e5 1-0");
  assert.equal(requests.length, 2);
  assert.equal(requests[0].options.credentials, "omit");
  assert.equal(requests[1].options.credentials, "omit");
});

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
