import { extractGameId } from "./lib/core.js";

const autoOpen = document.querySelector("#auto-open");
const reviewButton = document.querySelector("#review-button");
const statusText = document.querySelector("#status-text");
const statusDot = document.querySelector("#status-dot");
const recentLink = document.querySelector("#recent-link");
const recentPlayers = document.querySelector("#recent-players");

let activeGameId = null;

init().catch((error) => showStatus("error", error.message));

autoOpen.addEventListener("change", async () => {
  await chrome.storage.local.set({ autoOpen: autoOpen.checked });
  showStatus("ready", autoOpen.checked ? "Ready for your next game" : "Automatic opening is paused");
});

reviewButton.addEventListener("click", async () => {
  if (!activeGameId) return;
  reviewButton.disabled = true;
  reviewButton.textContent = "Starting review…";
  showStatus("working", "Requesting Lichess computer review");

  const response = await chrome.runtime.sendMessage({ type: "REVIEW_GAME", gameId: activeGameId });
  if (response?.state === "error") {
    showStatus("error", response.error);
    reviewButton.disabled = false;
    reviewButton.innerHTML = "Try again <span aria-hidden=\"true\">↗</span>";
    return;
  }

  const reopened = response?.state === "reopened";
  showStatus(reopened ? "opened" : "working", reopened
    ? "Lichess computer review reopened"
    : "Opening Lichess computer review");
  reviewButton.textContent = reopened ? "Reopened in Lichess" : "Opening in Lichess…";
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.lastStatus?.newValue) {
    const status = changes.lastStatus.newValue;
    showStatus(status.kind, status.message);
  }
});

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeGameId = extractGameId(tab?.url);
  const response = await chrome.runtime.sendMessage({ type: "GET_POPUP_STATE", url: tab?.url ?? "" });
  if (response?.state === "error") throw new Error(response.error);

  autoOpen.checked = response.autoOpen;
  reviewButton.disabled = !activeGameId;
  if (!activeGameId) reviewButton.textContent = "Open a Chess.com game first";
  showStatus(response.lastStatus?.kind ?? "ready", response.lastStatus?.message ?? "Ready for your next game");

  if (response.recentReview?.lichessUrl) {
    recentLink.href = response.recentReview.lichessUrl;
    recentPlayers.textContent = `${response.recentReview.white} – ${response.recentReview.black}`;
    recentLink.classList.remove("is-hidden");
  }
}

function showStatus(kind, message) {
  statusDot.dataset.kind = kind;
  statusText.textContent = message;
}
