# Chessli

Chessli opens a finished Chess.com game as a Lichess computer review automatically.

## How it works

1. A small content script recognizes supported Chess.com game URLs and watches for the game to finish.
2. The extension retrieves the finished game’s public PGN from Chess.com.
3. It opens Lichess’s import page, fills the PGN, requests computer analysis through your signed-in Lichess session, and opens the resulting shareable game URL.

Lichess computer analysis requires you to be signed in to Lichess. Imports are public. Chessli has no developer-operated server, analytics, ads, or account system.

Privacy policy: <https://yiheinchai.com/chessli/privacy.html>

## Local installation

1. Run `npm test` and `npm run package`.
2. Open `chrome://extensions`, enable Developer mode, and choose **Load unpacked**.
3. Select this repository directory.
4. Finish a Chess.com live game, or open a game and choose **Review this game** from the extension popup.

## Publishing

The uploadable ZIP is written to `dist/chessli-1.0.1.zip`. Store copy and reviewer disclosures are in `STORE_LISTING.md`.

Chessli is not affiliated with Chess.com or Lichess.
