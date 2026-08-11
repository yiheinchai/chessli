import {
  analysisUrl,
  archiveDate,
  archiveUrl,
  callbackUrl,
  findPgn
} from "./core.js";

export async function fetchGameMetadata(gameId, fetchFn = fetch) {
  const response = await fetchFn(callbackUrl(gameId), {
    headers: { Accept: "application/json" },
    cache: "no-store",
    credentials: "omit"
  });

  if (!response.ok) {
    throw new Error(`Chess.com game lookup failed (${response.status}).`);
  }

  const metadata = await response.json();
  if (!metadata?.game || String(metadata.game.id) !== String(gameId)) {
    throw new Error("Chess.com returned an unexpected game response.");
  }
  return metadata;
}

export async function fetchGamePgn(gameId, metadata, fetchFn = fetch) {
  const username = metadata?.game?.pgnHeaders?.White ?? metadata?.players?.bottom?.username;
  const response = await fetchFn(archiveUrl(username, archiveDate(metadata)), {
    headers: { Accept: "application/json" },
    cache: "no-store",
    credentials: "omit"
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Chess.com PGN lookup failed (${response.status}).`);
  }

  const archive = await response.json();
  return findPgn(archive?.games, gameId);
}

export async function importPgnToLichess(pgn, fetchFn = fetch) {
  if (typeof pgn !== "string" || !pgn.trim()) {
    throw new Error("The PGN is empty.");
  }

  const body = new URLSearchParams({ pgn });
  const response = await fetchFn("https://lichess.org/api/import", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
    },
    body: body.toString(),
    credentials: "omit"
  });

  if (!response.ok) {
    let detail = "";
    try {
      const payload = await response.json();
      detail = payload?.error ? ` ${payload.error}` : "";
    } catch {
      // Lichess may return an empty or non-JSON error body.
    }
    throw new Error(`Lichess import failed (${response.status}).${detail}`.trim());
  }

  const imported = await response.json();
  return {
    id: imported.id,
    sourceUrl: imported.url,
    analysisUrl: analysisUrl(imported.id)
  };
}
