# Changelog

## 0.1.2

- Fixed the icon, which was rendering as a small mark in the corner of a white
  square instead of filling the tile.

## 0.1.1

**Fixed: multiple VS Code windows.** If you had more than one window open, only
one of them reacted — and it was whichever opened first, not the one you were
working in. Every window now gets its own notification, and the window that has
the project open is the one that responds.

**After updating, re-run `BrainSnack: Install Claude Code Hooks`** so the fix
takes effect.

- Settings are grouped and there are fewer of them. A port clash now resolves
  itself instead of needing a setting changed by hand.
- Sound settings now tell you which file formats work — `.wav` on any platform,
  and macOS also takes `.aiff`, `.mp3` and `.m4a`.
- Clearer icon and a rewritten description.

## 0.1.0

First release.

- Detects Claude Code agent state and plays a sound the moment Claude needs your
  input or finishes
- Works wherever you run Claude — any terminal, or the Claude Code extension
- Opens the sidebar when Claude starts working, without taking keyboard focus
- Cards across AI news, engineering blogs, system design, frontend and backend
  tips, senior interview questions, and code quizzes
- Filter by technology so you only see what you work in
- Focus mode opens the same feed in a full editor tab
