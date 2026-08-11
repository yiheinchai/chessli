(() => {
  const GAME_URL = /^https:\/\/(?:www\.)?chess\.com\/game\/(?:live\/)?(\d+)(?:[/?#]|$)/i;
  const FALLBACK_INTERVAL_MS = 12_000;
  const GAME_OVER_SELECTORS = [
    "game-over-modal",
    "game-over-modal-component",
    "wc-game-over-modal",
    "[data-cy*='game-over']",
    "[class*='game-over-modal']"
  ].join(",");

  let currentGameId = null;
  let armed = false;
  let stopped = false;
  let checkInFlight = false;
  let lastUrl = location.href;
  let modalCheckTimer = null;

  function gameIdFromPage() {
    return GAME_URL.exec(location.href)?.[1] ?? null;
  }

  async function checkGame() {
    if (!currentGameId || stopped || checkInFlight) return;
    checkInFlight = true;
    try {
      const response = await chrome.runtime.sendMessage({
        type: "CHECK_GAME",
        gameId: currentGameId,
        armed
      });

      if (response?.state === "playing") armed = true;
      if (["opening", "opened", "already_opened", "expired", "disabled"].includes(response?.state)) {
        stopped = true;
      }
    } catch {
      // The service worker can briefly restart; the fallback timer will retry.
    } finally {
      checkInFlight = false;
    }
  }

  function resetForUrl() {
    const nextGameId = gameIdFromPage();
    if (nextGameId === currentGameId) return;
    currentGameId = nextGameId;
    armed = false;
    stopped = false;
    if (currentGameId) checkGame();
  }

  const observer = new MutationObserver(() => {
    if (!currentGameId || stopped || !document.querySelector(GAME_OVER_SELECTORS)) return;
    clearTimeout(modalCheckTimer);
    modalCheckTimer = setTimeout(checkGame, 250);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      resetForUrl();
    }
    checkGame();
  }, FALLBACK_INTERVAL_MS);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || changes.autoOpen?.newValue !== true) return;
    stopped = false;
    resetForUrl();
    checkGame();
  });

  resetForUrl();
})();
