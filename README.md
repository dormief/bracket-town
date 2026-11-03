# Bracket Town
A nested-clue sentence puzzle (in the style of bracket-nesting word games) with a puzzle editor. No backend.

- `npm install`, `npm run dev` → http://localhost:5180 (bound to 0.0.0.0)
- `npm run build` → `dist/` is static and uses relative paths; host it anywhere (any subpath). Routing and share links use the URL hash.
- iPhone: open in Safari → Share → Add to Home Screen (PWA, works offline after the first visit; service worker requires HTTPS or localhost).

## Authoring format
Write `[clue text|answer]`; clues can be nested: `The [capital of [boot-shaped country|Italy]|Rome] is lovely.`
The text after the last top-level `|` is the answer. Answers are matched ignoring case, spaces and punctuation.

## Scoring
Start at 100. Wrong guess −2, hint (next letter) −5, reveal −15. Tap/click a highlighted clue to select it (Tab / Shift+Tab or Alt+←/→ cycles); a typed answer that matches any solvable clue is accepted.

Puzzles are saved in localStorage; export/import JSON from "My puzzles"; share links encode the puzzle in `#/s/<base64url>`.
