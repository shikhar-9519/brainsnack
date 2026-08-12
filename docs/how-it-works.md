# How BrainSnack works

Implementation notes. Nothing here is needed to use the extension —
see the [README](../README.md) for that.

The interesting parts are the constraints rather than the code.

The rest of this file is implementation detail, kept because the interesting
parts are the constraints rather than the code.

## Wire up Claude detection

Run **BrainSnack: Install Claude Code Hooks** from the command palette, then
restart Claude Code.

This merges eight entries into `~/.claude/settings.json` — it preserves anything
already in that file, and running it twice does not duplicate entries.
**BrainSnack: Remove Claude Code Hooks** reverses it, leaving your own hooks alone.

Each hook is a one-second `curl` to `127.0.0.1` that can never block or fail
Claude (`-m 1 ... || true`).

| Claude event | State | What happens |
|---|---|---|
| `UserPromptSubmit`, `PreToolUse` | working | **Sidebar opens**, spinner in the status bar |
| `PermissionRequest` | waiting | **Sound**, amber status bar, badge on the sidebar icon |
| `Elicitation` | waiting | Same — an MCP server is asking for input |
| `Notification` | waiting | Backstop only, scoped to input-related types |
| `PostToolUse` | working | Back to working once the approved tool actually runs |
| `Stop` | finished | **Sound** |
| `SessionStart` | idle | Status bar hides |

`PermissionRequest` is what makes the sound immediate. `Notification` alone is
not enough: its matcher types include `idle_prompt`, which is on a timer, so
depending on it delays the alert by 15-20 seconds after Claude is already
blocked. `PreToolUse` fires *before* the permission prompt, `PermissionRequest`
fires *at* it — that's the one you want.

Auto-open uses `WebviewView.show(true)`, which preserves keyboard focus — the
panel appears without taking your cursor mid-keystroke. It fires only on the
transition *into* working, so the many tool calls in one turn don't re-open it,
and closing it mid-turn keeps it closed. Turn it off with `brainsnack.autoOpen`.

## When nothing happens

Run **BrainSnack: Show Status (Diagnose Hooks)**. Every silent failure mode looks
identical from the outside, so the report separates them:

- hook server not listening → port conflict, change `brainsnack.hookPort`
- hooks not installed → run the install command
- hooks installed but pointing at a different port → re-run the install command
- installed, correct port, zero events received → **restart Claude Code**; it
  reads `settings.json` at startup, so an already-running session ignores them

### Why not read the terminal?

VS Code's terminal APIs give you an ANSI redraw stream from a TUI. Deriving
state from that breaks on every Claude Code UI change. Hooks give exact,
structured transitions instead.

### Why isn't the sidebar icon itself animated?

There is no API for it — the activity bar icon is declared statically in
`package.json` and VS Code renders it. The animated part lives in the status
bar, where `$(sync~spin)` genuinely spins, plus a badge on the icon.

## Content pipeline

```
launchd (23:00 daily)
   ↓
generator ────── dedups against every id ever seen
   ↓
data/queue.json      pending — NOT visible in the feed
   ↓
admin console        approve / reject
   ↓
data/feed.json       what the extension reads
```

Generation writes to a **queue**, never straight to the feed. An LLM-written
MCQ will occasionally ship a wrong answer key, and a card that confidently
teaches the wrong thing is worse than no card. The review step is the quality
gate that makes unattended generation safe.

`data/rejected.json` keeps every rejected id forever, and the generator dedups
against queue + feed + rejected. Without that, a bad card reappears twice a day
for the rest of time.

### Two filter axes

`type` is the *format* of a card; `track` is the *technology* it is about.
Strictly orthogonal — "frontend" is a track and never a card type, so it exists
in exactly one place.

| Axis | Values |
|---|---|
| **type** | `ai_news` · `blog` · `learn` · `output_question` |
| **track** | `frontend` · `node` · `python` · `java` · `go` · `system_design` · `misc` |

| Card type | Tracks offered |
|---|---|
| `learn` | all seven |
| `output_question` | languages only — a runnable snippet has no `system_design` or `misc` |
| `ai_news`, `blog` | none; a release announcement is not per-language |

Tips and interview questions used to be separate types. They differ only in
whether the explanation is gated behind a reveal — same subjects, same length,
same value — so that is now an `isQuestion` flag on one `learn` card and they
share a pool. One tab, better variety per scroll.

`system_design` covers architecture, scaling, distributed systems, caching
strategy and trade-off reasoning. It is a track of its own rather than a corner
of `misc` because it is one of the most-studied areas at senior level, and Misc
is where things go to be ignored.

`misc` is what is left: tooling, protocols, observability, security — content
that is neither language-specific nor architectural. It is labelled "Misc"
rather than "General" because, sitting beside Frontend/Node/Python/Go, the word
"General" reads like a select-all rather than a category.

The chip row is **multi-select**. On and off differ on colour, solid vs dashed
border, and background fill — the border style carries the state without
relying on colour, so no tick is needed. Turning every chip off restores them all rather
than leaving a filtered-to-nothing feed with no way back.

Selections write straight to `brainsnack.tracks`, so the sidebar and focus mode
cannot drift apart and the choice survives a reload.
[FeedSession](src/feedSession.ts) sanitises both settings on read: values
retired from an enum survive in a user's config across upgrades and would
otherwise render as blank tabs.

Learn cards are requested in three calls — frontend tips, backend tips, then
question-shaped cards — purely to guarantee the mix. One call asking for "a
spread" reliably over-produces whichever shape and track the model finds
easiest, and a run weighted to Node leaves a Go developer with an empty tab.

### Feed ordering

The generator writes grouped by type, so serving the file verbatim put every
output question at the top and buried the rest. [interleaveByType](lib/ordering.ts)
round-robins so the top of All always has variety, and so the `maxCards` cap
trims evenly instead of amputating whichever type sorts last. It is kept free
of vscode imports so it can be tested on its own.

### Transport: the Claude CLI, not the API

The generator drives `claude -p` ([generator/claudeCli.ts](generator/claudeCli.ts))
rather than the Anthropic SDK, so it runs on the Claude subscription already
signed in on this machine. No API key, no per-token bill. Usage draws from the
seat allowance instead, on a rolling five-hour window and a weekly one, shared
with Claude chat.

What that costs you, concretely:

- **~17k tokens of prefix per run.** Claude Code sends its tool definitions and
  system prompt before your question. It is cached for an hour on a
  subscription, so only the first call in a run pays full price — measured, a
  second call cost 22% of the first. This only holds while the system prompt
  and flags are **byte-identical** across calls, which is why `SYSTEM_PROMPT`
  is a single shared constant and per-call text goes in the user prompt.
- **No schema guarantee.** The API's `output_config.format` enforced the Zod
  schema server-side; the CLI cannot. Validity is recovered by retrying with
  the parse error fed back, up to `MAX_ATTEMPTS`. Every enum now has to be
  spelled out in the prompt — the output contract in `SHARED_RULES` exists
  because without it the model returned bare arrays and invented `difficulty`
  values.
- **MCP servers are stripped** (`--strict-mcp-config`); they would sit in the
  cached prefix for nothing.
- **stdin is closed explicitly.** Given an open pipe the CLI waits for input
  that never arrives and hangs until the timeout — silently, on every
  scheduled run.

Model and effort are split by consequence, not volume:

| Categories | Model | Effort |
|---|---|---|
| news, blogs, frontend tips | Sonnet | low |
| backend tips | Sonnet | medium |
| interview questions, output questions | Opus | high |

Thinking tokens bill as output and dominate cost, so deep effort is spent only
where a wrong answer is unrecoverable.

`@anthropic-ai/sdk` is still a dependency so the API transport can be restored
by reverting `request()`; nothing imports it today.

### Monitoring a run

Every run appends one line to `data/logs/runs.jsonl` — tokens split by prompt,
output, cache write and cache read, plus an equivalent-cost figure and card
count. A few days of that file is enough to see whether generation is denting
your seat allowance.

### Schedule

```bash
npm run schedule:install
```

Installs a launchd agent running once daily at 23:00 (override with
`BRAINSNACK_RUN_HOUR`). launchd rather than cron: `StartCalendarInterval` fires a
missed run when the Mac wakes, whereas cron skips it entirely.

23:00 rather than something later is deliberate. launchd does **not** wake a
sleeping Mac, so a 02:00 schedule on a closed laptop fires whenever you next
open it — usually the start of the working day, which is exactly when you do
not want six Claude calls drawing on the same seat allowance. At 23:00 the
machine is typically still awake, so the run happens on time, and the rolling
five-hour window resets long before morning.

No API key is needed — the wrapper checks for the `claude` CLI instead, and the
plist puts both node and claude on PATH since launchd inherits no shell
profile.

Logs land in `data/logs/generate.log`.

### Admin console

```bash
npm run admin
```

Opens on `http://127.0.0.1:4319` — bound to loopback with no auth on purpose:
it is a single-operator tool that edits files in this repo and must never be
reachable from anywhere else. Never expose it.

Pending and Live tabs, multi-select, publish / reject / remove. Output
questions render with the correct option highlighted so the answer key can be
checked at a glance — that is the main thing review is for.

To explore it without spending anything on generation:

```bash
npm run admin:demo
```

### Pointing the extension at the reviewed feed

Set `brainsnack.feedUrl` to
`file:///Users/you/Desktop/brainsnack/data/feed.json`. `fetch` does not implement
the `file:` scheme, so [FeedLoader](src/feedLoader.ts) reads local paths off
disk directly.

## Running the generator by hand

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm run generate
```

Appends to `data/queue.json`. Nothing reaches the feed until you approve it in
the admin console.

### What it does

1. One `web_search` pass for genuinely recent AI/tooling news (plain text).
2. Five structured passes — news/blogs, frontend tips, backend tips, interview
   questions, output questions — each constrained by a Zod schema via
   `output_config.format`, so the JSON is valid by construction.

Cards get a stable id from `type + title`, and previously seen titles are fed
back in as a "skip these" list, so successive runs diverge instead of repeating.

All calls stream — 24K-token responses would otherwise hit the SDK's HTTP
timeout. Adaptive thinking at `high` effort throughout.

Requests include `fallbacks: "default"`, which re-runs on Anthropic's
recommended fallback model if a safety classifier declines. If your org doesn't
have that beta enabled, delete the `betas` and `fallbacks` lines in
[generator/generate.ts](generator/generate.ts).

### Hosting it later

The pipeline is deliberately serverless. When you want it running without your
laptop, the same generator script runs unchanged in a GitHub Action on a cron —
commit `data/queue.json`, review on pull, publish `data/feed.json` to a CDN or
GitHub Pages, and point `brainsnack.feedUrl` at that URL. Only the trigger and
the feed URL change.

## Answered output questions clear themselves

Answering an output-based question starts a 10-second countdown shown on the
card. When it expires the card is dismissed for good, so it never comes back on
reload. **Save** during the countdown cancels it and keeps the card.

This applies to **output questions only**. Once you have seen the answer key
there is nothing left in the card. Interview questions, blogs, AI news and React
tips are never auto-removed — they are worth re-reading, and are only marked
read (dimmed).

Tune with `brainsnack.removeAnsweredAfterSeconds`; `0` keeps answered cards
forever.

Saving outranks dismissal in `visibleCards`, so a card you keep still shows up
under Saved. One edge case: if the webview is destroyed mid-countdown (a window
reload, not just hiding the panel), the dismissal never fires and the card
returns on next load.

## Design

Fully branded — none of the colours derive from VS Code's theme variables. The
only thing taken from the editor is whether it is light or dark, via the
`vscode-light` / `vscode-dark` class VS Code puts on `<body>`, because a dark
panel dropped into a light editor reads as broken regardless of how good it
looks alone.

Tokens live in [webview/theme.css](webview/theme.css).

- **Type** — IBM Plex Serif for titles (editorial), IBM Plex Sans for UI,
  JetBrains Mono for code. Bundled locally via `@fontsource`; the webview CSP
  blocks external font hosts.
- **Colour** — warm paper / ink neutrals with a single amber accent, plus
  semantic green and red for answer states.
- **Motion** — 140–320ms, ease-out entering. Cards stagger in, correct answers
  settle, wrong answers shake, the countdown drains. `prefers-reduced-motion`
  disables all of it.

### Two surfaces

The same React app renders both, distinguished only by `data-surface` on
`<body>`:

| Surface | Type scale | Layout |
|---|---|---|
| `sidebar` | 13px body | Single ~350px column |
| `focus` | 16px body, 34px display | Centred 820px reading column |

Focus mode opens in a full editor tab — the expand icon in the header, or
**BrainSnack: Open Focus Mode**. Both surfaces stay live and share one
[FeedSession](src/feedSession.ts).

### Previewing the UI without launching the extension

```bash
npm run build && python3 -m http.server 8791
```

Open `http://localhost:8791/dev/preview.html`. It runs the real bundle against
the seed feed with a stubbed `acquireVsCodeApi`, and has toggles for
light/dark, sidebar/focus, and agent state. Far faster than an F5 cycle for
design work.

## Settings

All under `brainsnack.*`: `feedUrl`, `autoOpen`, `interests`, `maxCards`,
`tracks`, `removeAnsweredAfterSeconds`, `refreshMinutes`, `sound.enabled`,
`sound.onWaiting`, `sound.onFinished`, `statusBar.enabled`, `hookPort`.

Sound defaults to macOS system sounds. On Linux and Windows, set
`sound.onWaiting` / `sound.onFinished` to a file path — otherwise Windows falls
back to a console beep and Linux is silent.

## Notes

- Saves, dismissals and read state live in VS Code's `globalState` — per
  machine, no sync.
- The hook server binds to `127.0.0.1` only.
- Card links are validated as `http(s)` before opening.
- The panel keeps its state when hidden (`retainContextWhenHidden`), so your
  scroll position survives an approval prompt.

## Development

```bash
npm run typecheck   # extension, webview and generator
npm run build
```
