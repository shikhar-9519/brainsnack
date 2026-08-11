export const SHARED_RULES = `
You are writing cards for Interlude, a VS Code sidebar a developer reads in the
30-180 seconds while an AI coding agent is working. Constraints that follow from
that context:

- Each card must be fully consumable in the time given by estimatedReadSeconds.
- The reader is an experienced web developer. Do not explain basics.
- No filler, no "in today's fast-paced world", no restating the title.
- summary is one or two sentences of actual substance, not a teaser.
- estimatedReadSeconds must be honest: 30-60 for news, 60-180 for the rest.
- tags are lowercase, 2-4 per card.
- Never repeat a topic that appears in the "already covered" list.

Output contract, which overrides any shape implied below:
- Return ONE JSON object of the form {"cards": [ ... ]}.
- Never return a bare array. Never wrap it in markdown fences.
- Every field named in the request must be present on every card, including
  literal ones such as "type" and "isQuestion".
- "difficulty" is exactly one of: beginner, intermediate, advanced.
- "estimatedReadSeconds" is a number, not a string.
- "tags" is an array of 2-4 lowercase strings.
`.trim();

export const RESEARCH_PROMPT = `
Search the web for notable developments in AI engineering and developer tooling
from the last 7 days. Run several searches, not one.

Worth reporting — it changes what a working developer does tomorrow:
- Model and API releases with a real capability or pricing shift
- Framework, language and tooling releases with breaking or notable changes
- Engineering write-ups from teams operating at scale, with specifics in them
- Security advisories and deprecations that force action

Not worth reporting, discard on sight:
- Funding rounds, acquisitions, executive moves, layoffs
- Opinion, prediction, "X is dead", "Y changed everything"
- Listicles, tutorials, and anything a search engine would rank for "best of"
- Benchmarks with no methodology, and vendor claims with no third-party check

For each item report: headline, publishing organisation, the canonical URL, the
publication date, and two sentences on what specifically changed and who it
affects.

The URL must be the primary source — the actual release note, changelog or
engineering post. Never an aggregator, newsletter or news site reporting on it
second-hand. If you cannot find the primary URL, drop the item.

Return 15-20 items as plain text, newest first. Do not editorialise. More
candidates than needed is deliberate: the next stage selects from them.
`.trim();

export function newsPrompt(
  count: number,
  research: string,
  covered: string[],
): string {
  return `
Select the ${count} best items from the research below and turn them into feed
cards. You are selecting, not transcribing — there are deliberately more
candidates than slots.

Rank by: does a working developer need to know this today? Prefer a concrete
capability or breaking change over an announcement. Prefer primary engineering
detail over marketing. When two items cover the same story, keep the better
source and drop the other.

Rules specific to these cards:
- type is "ai_news" for model/product releases, "blog" for engineering write-ups.
- sourceUrl must be copied verbatim from the research. Never invent a URL.
- sourceName is the publication or organisation.
- If the research does not contain a usable URL for an item, drop that item.
- title states what changed, not the publisher's headline. "Anthropic ships
  1M-token context on Sonnet" beats "Introducing our biggest update yet".
- summary says what it means for the reader's own work in two sentences. Never
  restate the title in longer words.

Already covered (skip these):
${covered.join('\n') || '(nothing yet)'}

Research:
${research}
`.trim();
}

export function frontendTipPrompt(count: number, covered: string[]): string {
  return `
Write ${count} frontend tips: type "learn", track "frontend", isQuestion false.
Each one corrects a specific
misconception or shows a non-obvious behaviour that bites people in real
codebases — the kind of thing a senior developer learns from a production bug,
not from the docs' first page.

- body is 2-4 sentences explaining the mechanism, not just the rule.
- code is a short, self-contained snippet (under 15 lines) demonstrating it.
- Spread across React 18/19 semantics, TypeScript, CSS layout and modern
  browser APIs. Do not make every card about React.

Already covered (skip these):
${covered.join('\n') || '(nothing yet)'}
`.trim();
}

export function backendTipPrompt(count: number, covered: string[]): string {
  return `
Write ${count} backend tips: type "learn", isQuestion false. Same bar as the frontend
cards: a specific mechanism a working engineer gets wrong, not general advice.

- body is 2-4 sentences explaining the mechanism, not just the rule.
- code is a short, self-contained snippet (under 15 lines). SQL, shell or
  config are all fine where they fit better than application code.
- Every card needs a "track": node, python, java, go, system_design, or misc.
  Use "system_design" for architecture, scaling, distributed systems, caching
  strategy, database design and trade-off reasoning. Use "misc" only for
  cross-cutting content that is neither language-specific nor architectural —
  tooling, protocols, observability, security.
- Distribute roughly evenly across node, python, java and go, with a couple on
  system_design. A reader filters to the one area they work in, so a run
  weighted to Node leaves a Go developer with nothing.
- This reader writes frontend by day and reads these to learn backend, so
  assume fluency in JavaScript and none in the others: name the language's own
  idiom rather than translating from JS.
- Write the code snippet in the track's language.

Already covered (skip these):
${covered.join('\n') || '(nothing yet)'}
`.trim();
}

export function interviewPrompt(count: number, covered: string[]): string {
  return `
Write ${count} interview questions: type "learn", isQuestion true. The kind
actually asked at senior level — questions that probe understanding of
mechanisms, not trivia recall. These share a feed with the tips above, so the
reader meets both shapes while waiting; the difference is that these withhold
the explanation until asked.

- Every card needs a "track": frontend, node, python, java, go, system_design,
  or misc. Use "system_design" for architecture and scaling questions — that is
  the single most asked-about area at senior level, so give it real weight.
- Distribute across tracks. A reader filters to one track, so a run that is all
  frontend leaves a backend developer with nothing.
- title is the question as an interviewer would ask it.
- summary states what the question is really testing.
- body is a complete but tight answer (4-8 sentences) that would satisfy a
  strong interviewer.
- followUps are 2-3 harder probes the interviewer would ask next.
- Spread across the tracks above: browser and React internals, server-side
  runtime behaviour, databases, system design, and performance.

Already covered (skip these):
${covered.join('\n') || '(nothing yet)'}
`.trim();
}

export function outputQuestionPrompt(count: number, covered: string[]): string {
  return `
Write ${count} output-based questions: type "output_question". A short code
snippet, and four options for what it prints or evaluates to.

Hard requirements:
- code is self-contained, under 20 lines, and deterministic. No randomness, no
  dates, no network, no platform-dependent behaviour.
- Exactly 4 options. Each option label is the literal output, formatted as it
  would appear in a console.
- correctOptionIndex is the 0-based index of the correct option.
- The wrong options must be plausible — each should correspond to a specific
  wrong mental model, not be random noise.
- explanation is 2-4 sentences naming the exact mechanism (hoisting, the event
  loop, coercion rules, closure capture, prototype lookup, and so on).
- Every card needs a "track": one of frontend, node, python, java, or go.
  Use "frontend" for browser and DOM semantics, "node" for server-side
  JavaScript specifics, and the language name for the others.
- Distribute across tracks rather than making them all JavaScript.
- language names the actual language of the snippet.
- VERIFY the answer by evaluating the snippet mentally step by step before
  committing to it. A wrong answer key makes the card worse than useless.

Already covered (skip these):
${covered.join('\n') || '(nothing yet)'}
`.trim();
}
