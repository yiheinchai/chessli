# Chrome Web Store listing

## Product details

- **Name:** Chessli
- **Summary:** Open finished Chess.com games as Lichess computer reviews automatically.
- **Category:** Tools
- **Language:** English
- **Visibility:** Public
- **Pricing:** Free
- **Privacy policy:** https://yiheinchai.com/chessli/privacy.html
- **Chrome Web Store item ID:** `oipnihhbifnkmkfilgnimpffmjabgmkm`

## Detailed description

Your game ends. Your computer review begins.

Chessli detects when a supported Chess.com game finishes, retrieves its public PGN, opens Lichess’s import page, selects “Request a computer analysis,” and submits the game through your signed-in Lichess session. The result opens at a short, shareable Lichess game URL.

Use the toolbar popup to pause automatic opening, review the game in your current Chess.com tab, or return to your latest Lichess computer review. You must be signed in to Lichess for server-side computer analysis.

Important privacy note: the game PGN—including player usernames, ratings, timestamps, moves, clock times, result, and original game link—is sent to Lichess and imported publicly. Anyone with the resulting link may view it.

Chessli has no developer-operated server, analytics, advertising, data sale, or account system. Settings, a short-lived pending PGN, and up to 20 recent review links stay in Chrome’s local extension storage. Chessli never reads your Lichess credentials.

Chessli is not affiliated with Chess.com or Lichess.

## Single purpose

Automatically transfer a finished Chess.com game to Lichess, request server-side computer analysis through the user’s signed-in Lichess session, and open the resulting shareable game review.

## Permission justifications

### storage

Stores the automatic-opening preference, current status, a pending PGN for up to 15 minutes, and up to 20 recent Chess.com-to-Lichess review links locally. The pending PGN is removed when the Lichess import completes. Storage also prevents the same game from opening more than once.

### Host access: www.chess.com

Runs only on Chess.com game/play pages, reads the numeric game ID from the URL, and requests public finished-game metadata from Chess.com’s game endpoint so the extension can detect completion and identify the players.

### Host access: api.chess.com

Retrieves the finished game’s public PGN from Chess.com’s official Published Data API.

### Host access: lichess.org

Opens Lichess’s official import page, fills the PGN, selects “Request a computer analysis,” submits the form through the user’s signed-in Lichess session, and records the resulting short Lichess game URL. Chessli does not read or store Lichess credentials.

## Remote code

No. All executable JavaScript is included in the extension package. Network responses are handled as data only.

## Data-use disclosures

Select these data types:

- Web history: the current supported Chess.com game URL/ID is used to provide the feature.
- Website content: public game metadata and PGN are retrieved from Chess.com.
- Personally identifiable information: Chess.com usernames can appear in the PGN.
- User activity: chess moves, results, ratings, clock times, and game timestamps can appear in the PGN.

The data is used only for the extension’s single purpose. It is not sold, used for advertising or creditworthiness, or accessed by a developer. PGN data is transferred to Lichess over HTTPS because that transfer is necessary to create the requested public computer review.

## Reviewer test instructions

1. Install the extension.
2. Open `https://www.chess.com/game/172857749116`.
3. Open the Chessli toolbar popup.
4. Choose **Review this game**.
5. If signed in to Lichess, verify that the import form is filled, “Request a computer analysis” is selected, and the tab redirects to a short URL such as `https://lichess.org/n0uVFFan` showing the same players and moves.
6. If signed out, verify that the form is filled and Chessli asks the reviewer to sign in instead of silently importing without computer analysis.
7. Return to the popup and verify that the automatic-opening switch and latest-review link work.

No Chess.com credentials are required because the supplied test game is public. Lichess requires an account for server-side computer analysis; reviewers may use their own Lichess test account. Chessli does not receive those credentials.
