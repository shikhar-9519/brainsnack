export const SHARED_RULES = `
You are writing cards for BrainSnack, a VS Code sidebar a developer reads in the
30-180 seconds while an AI coding agent is working. Constraints that follow from
that context:

- Each card must be fully consumable in the time given by estimatedReadSeconds.
- The reader has been writing code for one to four years. They use these tools
  every day but have not met every edge case. Explain the mechanism properly and
  never talk down to them, but do not assume they have seen it before.
- Prefer what they will touch this week over what they might meet in a senior
  interview. Something they use daily and half-understand beats something
  correct but exotic.
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
- Aim for a spread across a batch: about half beginner, most of the rest
  intermediate, at most one advanced. "beginner" means an everyday thing that
  is commonly misunderstood — why useEffect runs twice in development, what
  git rebase actually moves, how Promise.all handles one rejection. It does not
  mean explaining what a variable is.
- "estimatedReadSeconds" is a number, not a string.
- "tags" is an array of 2-4 lowercase strings.
`.trim();

export const RESEARCH_PROMPT = `
Search the web for what is genuinely interesting in AI and software from the
last 7 days. Run several searches from different angles, not one.

The test for every item: **would a developer stop scrolling for this, and
would they mention it to a colleague over lunch?** Not "should they know it" —
would they actually talk about it.

Actively look for:
- Something that is newly possible that was not possible last month, and what
  it means
- Research findings that are surprising or overturn an assumption people held
- Where the industry is moving: notable bets, who is pulling ahead, funding and
  acquisitions that signal direction
- Real companies reporting real outcomes from using AI — including the ones
  that went badly, which are usually more informative
- Things that went wrong: outages, breaches, models behaving unexpectedly,
  expensive mistakes
- Genuine capability or price shifts that change what is worth building
- The occasional breaking change or serious vulnerability a developer must act
  on — but at most two or three of these, they are not the point

Do not report:
- Pure version bumps. A release number is not a story. "X 2.4.1 ships updated
  root certificates" tells nobody anything they will repeat.
- Marketing copy with no substance behind it, listicles, "top 10" anything
- Benchmarks with no methodology, or vendor claims nobody independent checked
- "X is dead", "Y changes everything", and predictions about 2030

For each item report: the headline, the publishing organisation, the canonical
URL, the publication date, and — most importantly — two sentences on **why it
is interesting**, not merely what happened.

The URL must be the primary source: the actual announcement, paper, or
engineering post. Never an aggregator or a site reporting on it second-hand.
Drop any item you cannot find a primary URL for.

Return 15-20 items as plain text, most interesting first. More candidates than
needed is deliberate: the next stage selects from them.
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

Rank by how interesting the item is, not how actionable. A developer reading
this is on a short break, not triaging — they want to know what is going on in
their field, not what to patch.

Aim for a spread across the ${count}: something newly possible, something
surprising, something about where the industry is heading, something that went
wrong. **At most one may be a version release or security patch.** If the
research offers nothing but release notes, return fewer cards rather than
padding with them.

When two items cover the same story, keep the better source and drop the other.

Rules specific to these cards:
- type is "ai_news" for model/product releases, "blog" for engineering write-ups.
- sourceUrl must be copied verbatim from the research. Never invent a URL.
- sourceName is the publication or organisation.
- If the research does not contain a usable URL for an item, drop that item.
- title says the interesting thing plainly. Specific beats vague, but a title
  that is only a version number and a component list is not worth a card.
- summary gives the substance and why it matters — the context a colleague
  would add when telling you about it. Never restate the title in longer words,
  and never pad with "this is significant because".

Already covered (skip these):
${covered.join('\n') || '(nothing yet)'}

Research:
${research}
`.trim();
}

export function frontendTipPrompt(count: number, covered: string[]): string {
  return `
Write ${count} frontend tips: type "learn", track "frontend", isQuestion false.
Each one explains something they use constantly but may not fully understand,
or corrects a misconception that trips people up in ordinary work. The test is
whether it comes up in a normal week — not whether it is obscure enough to
impress someone.

- body is 2-4 sentences explaining the mechanism, not just the rule.
- code is a short, self-contained snippet (under 15 lines) demonstrating it.
- Spread across React, TypeScript, CSS layout, browser APIs and plain
  JavaScript. Do not make every card about React.
- Favour the everyday: why a key prop matters, what a dependency array
  actually compares, how flex-grow decides widths, why a fetch in an effect
  fires twice. Save the exotic corners for the occasional advanced card.

Already covered (skip these):
${covered.join('\n') || '(nothing yet)'}
`.trim();
}

export function backendTipPrompt(count: number, covered: string[]): string {
  return `
Write ${count} backend tips: type "learn", isQuestion false. Same bar as the frontend cards: something met in ordinary work and commonly
half-understood, not general advice and not an exotic corner.

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
Write ${count} interview questions: type "learn", isQuestion true. The kind actually
asked of developers with one to four years' experience — questions that probe
whether someone understands the tools they use daily, not trivia recall and not
staff-level system design. These share a feed with the tips above, so the
reader meets both shapes while waiting; the difference is that these withhold
the explanation until asked.

- Every card needs a "track": frontend, node, python, java, go, system_design,
  or misc. Use "system_design" for architecture questions, pitched at the level
  actually asked of a mid-level candidate — caching, database choice, why an
  API is slow — rather than distributed consensus.
- Distribute across tracks. A reader filters to one track, so a run that is all
  frontend leaves a backend developer with nothing.
- title is the question as an interviewer would ask it.
- summary states what the question is really testing.
- body is a complete but tight answer (4-8 sentences) that would satisfy an
  interviewer, written so someone who has not met the topic still follows it.
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
