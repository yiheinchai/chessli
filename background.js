import {
  extractGameId,
  isRecentFinish,
  lichessGameUrl,
  lichessPasteUrl
} from "./lib/core.js";
import { fetchGameMetadata, fetchGamePgn } from "./lib/review.js";

const PENDING_IMPORT_TTL_MS = 15 * 60 * 1000;

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
  await cleanupExpiredPendingImport();
  await updateBadge("ready");
});

chrome.runtime.onStartup.addListener(() => {
  cleanupExpiredPendingImport().catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url) return;
  completeLichessImport(tabId, changeInfo.url).catch((error) => recordError(error));
});

chrome.tabs.onRemoved.addListener((tabId) => {
  cancelPendingImport(tabId).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

  if (message?.type === "GET_LICHESS_IMPORT") {
    getPendingImport(message.token, sender)
      .then(sendResponse)
      .catch(async (error) => sendResponse(await errorResponse(error)));
    return true;
  }

  if (message?.type === "LICHESS_IMPORT_SUBMITTING") {
    markImportSubmitting(message.token, sender)
      .then(sendResponse)
      .catch(async (error) => sendResponse(await errorResponse(error)));
    return true;
  }

  if (message?.type === "LICHESS_IMPORT_ERROR") {
    reportImportError(message.token, message.error, sender)
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

  await cleanupExpiredPendingImport();
  const settings = await chrome.storage.local.get([
    "autoOpen",
    "recentReviews",
    "pendingLichessImport"
  ]);
  if (!force && settings.autoOpen === false) return { state: "disabled" };

  const existing = findRecent(settings.recentReviews, gameId);
  if (existing) {
    if (force) await chrome.tabs.create({ url: existing.lichessUrl });
    return { state: force ? "reopened" : "already_opened", review: existing };
  }

  const pending = settings.pendingLichessImport;
  if (pending?.chessGameId === String(gameId) && !isPendingExpired(pending)) {
    if (force && Number.isInteger(pending.tabId)) {
      await chrome.tabs.update(pending.tabId, { active: true }).catch(() => {});
    }
    return { state: "opening" };
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
  await setStatus("working", "Preparing the Lichess computer review", { chessGameId: gameId });

  const pgn = await fetchGamePgn(gameId, metadata);
  if (!pgn) {
    await setStatus("waiting", "Waiting for Chess.com to finish the PGN", { chessGameId: gameId });
    return { state: "waiting" };
  }

  const token = crypto.randomUUID();
  let pendingImport = {
    token,
    chessGameId: gameId,
    pgn,
    createdAt: Date.now(),
    white: metadata?.game?.pgnHeaders?.White ?? "White",
    black: metadata?.game?.pgnHeaders?.Black ?? "Black"
  };
  await chrome.storage.local.set({ pendingLichessImport: pendingImport });

  const tab = await chrome.tabs.create({ url: lichessPasteUrl(token) });
  const { pendingLichessImport: latestPending } =
    await chrome.storage.local.get("pendingLichessImport");
  if (latestPending?.token === token) {
    pendingImport = { ...latestPending, tabId: tab.id };
    await chrome.storage.local.set({ pendingLichessImport: pendingImport });
  }
  await setStatus("working", "Requesting Lichess computer review", { chessGameId: gameId });
  return { state: "opening" };
}

async function getPendingImport(token, sender) {
  assertLichessPasteSender(sender);
  const { pendingLichessImport: pending } = await chrome.storage.local.get("pendingLichessImport");
  assertPendingImport(pending, token);
  if (typeof pending.pgn !== "string" || !pending.pgn.trim()) {
    throw new Error("The pending Chess.com PGN is no longer available.");
  }

  const next = { ...pending, tabId: sender.tab.id, phase: "ready" };
  await chrome.storage.local.set({ pendingLichessImport: next });
  return { state: "ready", pgn: pending.pgn };
}

async function markImportSubmitting(token, sender) {
  assertLichessPasteSender(sender);
  const { pendingLichessImport: pending } = await chrome.storage.local.get("pendingLichessImport");
  assertPendingImport(pending, token);

  const next = {
    ...pending,
    tabId: sender.tab.id,
    pgn: null,
    phase: "submitted",
    submittedAt: Date.now()
  };
  await chrome.storage.local.set({ pendingLichessImport: next });
  await setStatus("working", "Lichess computer review requested", {
    chessGameId: pending.chessGameId
  });
  return { state: "submitting" };
}

async function reportImportError(token, error, sender) {
  assertLichessPasteSender(sender);
  const { pendingLichessImport: pending } = await chrome.storage.local.get("pendingLichessImport");
  assertPendingImport(pending, token);
  const message = typeof error === "string" && error.trim()
    ? error.trim()
    : "Lichess could not start the computer review.";
  await setStatus("error", message, { chessGameId: pending.chessGameId });
  return { state: "error", error: message };
}

async function completeLichessImport(tabId, url) {
  const reviewUrl = lichessGameUrl(url);
  if (!reviewUrl) return;

  const { pendingLichessImport: pending, recentReviews = [] } =
    await chrome.storage.local.get(["pendingLichessImport", "recentReviews"]);
  if (!pending || pending.tabId !== tabId || isPendingExpired(pending)) return;

  const review = {
    chessGameId: pending.chessGameId,
    lichessUrl: reviewUrl,
    importedAt: Date.now(),
    white: pending.white ?? "White",
    black: pending.black ?? "Black"
  };
  const deduplicated = recentReviews.filter(
    (item) => item.chessGameId !== pending.chessGameId
  );
  await chrome.storage.local.set({ recentReviews: [review, ...deduplicated].slice(0, 20) });
  await chrome.storage.local.remove("pendingLichessImport");
  await setStatus("opened", "Lichess computer review opened", review);
}

async function cancelPendingImport(tabId) {
  const { pendingLichessImport: pending } = await chrome.storage.local.get("pendingLichessImport");
  if (!pending || pending.tabId !== tabId) return;
  await chrome.storage.local.remove("pendingLichessImport");
  await setStatus("error", "Lichess review was cancelled", {
    chessGameId: pending.chessGameId
  });
}

async function cleanupExpiredPendingImport() {
  const { pendingLichessImport: pending } = await chrome.storage.local.get("pendingLichessImport");
  if (pending && isPendingExpired(pending)) {
    await chrome.storage.local.remove("pendingLichessImport");
  }
}

function assertLichessPasteSender(sender) {
  if (!Number.isInteger(sender?.tab?.id) || !sender?.url?.startsWith("https://lichess.org/paste")) {
    throw new Error("The Lichess import request came from an unexpected page.");
  }
}

function assertPendingImport(pending, token) {
  if (!pending || pending.token !== token || isPendingExpired(pending)) {
    throw new Error("This Lichess review request has expired. Start it again from Chess.com.");
  }
}

function isPendingExpired(pending) {
  return !Number.isFinite(pending?.createdAt) ||
    Date.now() - pending.createdAt > PENDING_IMPORT_TTL_MS;
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
