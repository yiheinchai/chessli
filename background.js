import { extractGameId, isRecentFinish } from "./lib/core.js";
import { fetchGameMetadata, fetchGamePgn, importPgnToLichess } from "./lib/review.js";

const DEFAULTS = {
  autoOpen: true,
  recentReviews: [],
  lastStatus: {
    kind: "ready",
    message: "Ready for your next game",
    updatedAt: Date.now()
  }
};

const activeReviews = new Map();

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(Object.keys(DEFAULTS));
  const missing = Object.fromEntries(
    Object.entries(DEFAULTS).filter(([key]) => current[key] === undefined)
  );
  if (Object.keys(missing).length) await chrome.storage.local.set(missing);
  await updateBadge("ready");
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "CHECK_GAME") {
    checkGame(message.gameId, { force: false, armed: Boolean(message.armed) })
      .then(sendResponse)
      .catch(async (error) => sendResponse(await errorResponse(error)));
    return true;
  }

  if (message?.type === "REVIEW_GAME") {
    checkGame(message.gameId, { force: true, armed: true })
      .then(sendResponse)
      .catch(async (error) => sendResponse(await errorResponse(error)));
    return true;
  }

  if (message?.type === "GET_POPUP_STATE") {
    getPopupState(message.url)
      .then(sendResponse)
      .catch(async (error) => sendResponse(await errorResponse(error)));
    return true;
  }

  return false;
});

async function checkGame(gameId, { force, armed }) {
  if (!/^\d+$/.test(String(gameId ?? ""))) {
    throw new Error("Open a Chess.com game before starting a review.");
  }

  const settings = await chrome.storage.local.get(["autoOpen", "recentReviews"]);
  if (!force && settings.autoOpen === false) return { state: "disabled" };

  const existing = findRecent(settings.recentReviews, gameId);
  if (existing) {
    if (force) await chrome.tabs.create({ url: existing.lichessUrl });
    return { state: force ? "reopened" : "already_opened", review: existing };
  }

  const metadata = await fetchGameMetadata(gameId);
  if (!metadata.game.isFinished) {
    await setStatus("watching", "Watching this game", { chessGameId: String(gameId) });
    return { state: "playing" };
  }

  if (!force && !armed && !isRecentFinish(metadata)) {
    return { state: "expired" };
  }

  if (activeReviews.has(String(gameId))) return activeReviews.get(String(gameId));

  const task = finishReview(String(gameId), metadata).finally(() => {
    activeReviews.delete(String(gameId));
  });
  activeReviews.set(String(gameId), task);
  return task;
}

async function finishReview(gameId, metadata) {
  await setStatus("working", "Sending the finished game to Lichess", { chessGameId: gameId });

  const pgn = await fetchGamePgn(gameId, metadata);
  if (!pgn) {
    await setStatus("waiting", "Waiting for Chess.com to finish the PGN", { chessGameId: gameId });
    return { state: "waiting" };
  }

  const imported = await importPgnToLichess(pgn);
  const review = {
    chessGameId: gameId,
    lichessUrl: imported.analysisUrl,
    importedAt: Date.now(),
    white: metadata?.game?.pgnHeaders?.White ?? "White",
    black: metadata?.game?.pgnHeaders?.Black ?? "Black"
  };

  const { recentReviews = [] } = await chrome.storage.local.get("recentReviews");
  const deduplicated = recentReviews.filter((item) => item.chessGameId !== gameId);
  await chrome.storage.local.set({ recentReviews: [review, ...deduplicated].slice(0, 20) });
  await setStatus("opened", "Lichess analysis opened", review);
  await chrome.tabs.create({ url: imported.analysisUrl });
  return { state: "opened", review };
}

async function getPopupState(url) {
  const gameId = extractGameId(url);
  const state = await chrome.storage.local.get(Object.keys(DEFAULTS));
  return {
    state: "ready",
    gameId,
    autoOpen: state.autoOpen !== false,
    lastStatus: state.lastStatus ?? DEFAULTS.lastStatus,
    recentReview: state.recentReviews?.[0] ?? null
  };
}

function findRecent(reviews, gameId) {
  return Array.isArray(reviews)
    ? reviews.find((review) => review.chessGameId === String(gameId)) ?? null
    : null;
}

async function setStatus(kind, message, extra = {}) {
  const lastStatus = { kind, message, updatedAt: Date.now(), ...extra };
  await chrome.storage.local.set({ lastStatus });
  await updateBadge(kind);
}

async function updateBadge(kind) {
  const badges = {
    working: { text: "…", color: "#739552" },
    waiting: { text: "…", color: "#b88a3b" },
    opened: { text: "✓", color: "#739552" },
    error: { text: "!", color: "#c45c54" },
    ready: { text: "", color: "#739552" },
    watching: { text: "", color: "#739552" }
  };
  const badge = badges[kind] ?? badges.ready;
  await chrome.action.setBadgeBackgroundColor({ color: badge.color });
  await chrome.action.setBadgeText({ text: badge.text });
}

async function recordError(error) {
  const message = error instanceof Error ? error.message : "The review could not be opened.";
  await setStatus("error", message);
  return { state: "error", error: message };
}

async function errorResponse(error) {
  const message = error instanceof Error ? error.message : "The review could not be opened.";
  await recordError(error).catch(() => {});
  return { state: "error", error: message };
}
