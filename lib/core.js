const CHESS_COM_GAME_URL = /^https:\/\/(?:www\.)?chess\.com\/game\/(?:(?:live|daily)\/)?(\d+)(?:[/?#]|$)/i;

export function extractGameId(url) {
  if (typeof url !== "string") return null;
  return CHESS_COM_GAME_URL.exec(url)?.[1] ?? null;
}

export function callbackUrl(gameId) {
  assertGameId(gameId);
  return `https://www.chess.com/callback/live/game/${gameId}`;
}

export function archiveDate(metadata) {
  const headerDate = metadata?.game?.pgnHeaders?.Date;
  const match = /^(\d{4})\.(\d{2})\.\d{2}$/.exec(headerDate ?? "");
  if (match) return { year: match[1], month: match[2] };

  const endTime = Number(metadata?.game?.endTime);
  if (Number.isFinite(endTime) && endTime > 0) {
    const date = new Date(endTime * 1000);
    return {
      year: String(date.getUTCFullYear()),
      month: String(date.getUTCMonth() + 1).padStart(2, "0")
    };
  }

  const now = new Date();
  return {
    year: String(now.getUTCFullYear()),
    month: String(now.getUTCMonth() + 1).padStart(2, "0")
  };
}

export function archiveUrl(username, date) {
  if (!username || !date?.year || !date?.month) {
    throw new Error("The Chess.com archive location is incomplete.");
  }
  return `https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/${date.year}/${date.month}`;
}

export function findPgn(games, gameId) {
  assertGameId(gameId);
  if (!Array.isArray(games)) return null;

  const game = games.find((candidate) => extractGameId(candidate?.url) === String(gameId));
  return typeof game?.pgn === "string" && game.pgn.trim() ? game.pgn : null;
}

export function analysisUrl(lichessGameId) {
  if (!/^[A-Za-z0-9]{8}$/.test(lichessGameId ?? "")) {
    throw new Error("Lichess returned an invalid game identifier.");
  }
  return `https://lichess.org/analysis/game/${lichessGameId}`;
}

export function isRecentFinish(metadata, nowMs = Date.now(), windowMs = 5 * 60 * 1000) {
  const endTime = Number(metadata?.game?.endTime);
  return Number.isFinite(endTime) && endTime > 0 && nowMs - endTime * 1000 <= windowMs;
}

function assertGameId(gameId) {
  if (!/^\d+$/.test(String(gameId ?? ""))) {
    throw new Error("The Chess.com game identifier is invalid.");
  }
}
