# Changelog

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
