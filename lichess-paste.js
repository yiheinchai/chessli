(() => {
  const params = new URLSearchParams(location.hash.slice(1));
  const token = params.get("chessli");
  if (!token) return;

  startComputerReview(token).catch(async (error) => {
    const message = error instanceof Error
      ? error.message
      : "Lichess could not start the computer review.";
    await notifyBackground(token, message).catch(() => {});
    showNotice(message, true);
  });

  async function startComputerReview(importToken) {
    const form = document.querySelector('form.import[action="/import"]');
    const pgnInput = form?.querySelector('textarea[name="pgn"]');
    const analyseInput = form?.querySelector('input[name="analyse"]');
    if (!form || !pgnInput || !analyseInput) {
      throw new Error("The Lichess import form could not be found.");
    }

    const response = await chrome.runtime.sendMessage({
      type: "GET_LICHESS_IMPORT",
      token: importToken
    });
    if (response?.state === "error") throw new Error(response.error);
    if (typeof response?.pgn !== "string" || !response.pgn.trim()) {
      throw new Error("The Chess.com PGN is unavailable.");
    }

    pgnInput.value = response.pgn;
    pgnInput.dispatchEvent(new Event("input", { bubbles: true }));
    analyseInput.checked = true;
    analyseInput.dispatchEvent(new Event("change", { bubbles: true }));

    const signIn = document.querySelector("a.signin");
    if (signIn) {
      signIn.href = `/login?referrer=${encodeURIComponent(`/paste${location.hash}`)}`;
      throw new Error("Sign in to Lichess, then Chessli will request the computer review.");
    }

    const submitting = await chrome.runtime.sendMessage({
      type: "LICHESS_IMPORT_SUBMITTING",
      token: importToken
    });
    if (submitting?.state === "error") throw new Error(submitting.error);

    showNotice("Requesting the Lichess computer review…", false);
    form.requestSubmit();
  }

  async function notifyBackground(importToken, error) {
    return chrome.runtime.sendMessage({
      type: "LICHESS_IMPORT_ERROR",
      token: importToken,
      error
    });
  }

  function showNotice(message, isError) {
    const page = document.querySelector("main.importer");
    if (!page) return;
    let notice = document.querySelector("#chessli-notice");
    if (!notice) {
      notice = document.createElement("p");
      notice.id = "chessli-notice";
      notice.className = "explanation";
      page.querySelector("h1")?.insertAdjacentElement("afterend", notice);
    }
    notice.textContent = `Chessli: ${message}`;
    notice.style.color = isError ? "#d85040" : "#759900";
  }
})();
