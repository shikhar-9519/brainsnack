# Changelog

## 0.2.0

- **Multiple VS Code windows now work.** Previously the first window to start
  claimed the only port and every event went to it, so the other windows looked
  broken and notifications arrived in whichever window you were not using.
  Each window now listens on its own port, hooks reach all of them, and the
  window that has the project open is the one that reacts.
- Re-run **BrainSnack: Install Claude Code Hooks** after updating.

## 0.1.3

- Removed the Advanced settings group. The hook port now walks forward to the
  next free port on its own, so a clash no longer needs anyone to pick a number.
- Sound settings now say which file formats work: `.wav` everywhere, with
  macOS also accepting `.aiff`, `.mp3` and `.m4a`.

## 0.1.2

- Settings are grouped into BrainSnack, Content, Sounds and Advanced instead of
  one alphabetical list, and described for people using the extension rather
  than maintaining it.

## 0.1.1

- Rewrote the Marketplace listing: what the extension does and how to set it
  up, rather than how it is built. Implementation notes moved to
  `docs/how-it-works.md`.
- Simplified the icon so it stays legible at the size search results use.

## 0.1.0

First release.

- Detects Claude Code agent state through lifecycle hooks rather than terminal
  scraping, so it does not break when the CLI's interface changes
- Opens the sidebar when the agent starts working, without taking keyboard focus
- Plays a sound the moment Claude needs input, driven by `PermissionRequest`
  rather than `Notification` — the latter is on a timer and lags 15-20 seconds
- Cards across AI news, engineering blogs, frontend and backend tips, senior
  interview questions, and output-based code quizzes
- Filter by technology track: Frontend, Node.js, Python, Java, Go, System
  Design, Misc
- Focus mode opens the same feed in a full editor tab
- Answered quizzes clear themselves after ten seconds unless saved
