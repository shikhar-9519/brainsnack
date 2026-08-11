import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as z from 'zod/v4';
import { CardType, Track } from '../src/types';
import type { Card } from '../src/types';
import { appendToQueue, knownIds, readFeed, readQueue } from '../lib/store';
import {
  BackendTipBatch,
  FrontendTipBatch,
  InterviewBatch,
  LinkBatch,
  OutputQuestionBatch,
} from './schema';
import {
  RESEARCH_PROMPT,
  SHARED_RULES,
  backendTipPrompt,
  frontendTipPrompt,
  interviewPrompt,
  newsPrompt,
  outputQuestionPrompt,
} from './prompts';
import { CliModel, Effort, callClaude, extractJson } from './claudeCli';
import type { CallUsage } from './claudeCli';

/**
 * Model and effort split by consequence, not by category size. A wrong answer
 * key in an output question is unrecoverable — the card teaches the wrong
 * thing. A slightly duller tip is not. Thinking tokens bill as output and
 * dominate cost, so deep effort is spent only where correctness is the value.
 */
const Model = CliModel;

/** Frontend:backend is 1:3 — the reader writes frontend by day and reads to learn backend. */
const COUNTS = {
  /** Selected down from 15-20 researched candidates, so quality beats volume. */
  news: 6,
  frontend: 2,
  backend: 6,
  interview: 3,
  outputQuestions: 4,
} as const;

const MAX_ATTEMPTS = 3;

const RUN_LOG = path.resolve(process.cwd(), 'data', 'logs', 'runs.jsonl');

/**
 * Identical on every call so Claude Code's ~20k-token prefix stays cacheable
 * for the hour. Per-call instructions live in the user prompt instead.
 */
const SYSTEM_PROMPT = `${SHARED_RULES}

You are a content generator, not a coding assistant. Output only the requested
JSON object. No prose, no markdown fences, no commentary before or after.`;

const totals: CallUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
  costUsd: 0,
  durationMs: 0,
};

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

/** Stable id from type + title, so the same card never enters the queue twice. */
function cardId(type: string, title: string): string {
  const normalized = title.toLowerCase().replace(/\s+/g, ' ').trim();

  return crypto
    .createHash('sha1')
    .update(`${type}:${normalized}`)
    .digest('hex')
    .slice(0, 12);
}

function recordUsage(usage: CallUsage): void {
  totals.inputTokens += usage.inputTokens;
  totals.outputTokens += usage.outputTokens;
  totals.cacheCreationTokens += usage.cacheCreationTokens;
  totals.cacheReadTokens += usage.cacheReadTokens;
  totals.costUsd += usage.costUsd;
  totals.durationMs += usage.durationMs;
}

function reportUsage(cardsQueued: number): void {
  const billed =
    totals.inputTokens + totals.outputTokens + totals.cacheCreationTokens;

  log('');
  log('Usage this run (drawn from your Claude seat allowance, not billed):');
  log(`  prefix written   ${totals.cacheCreationTokens} tokens`);
  log(`  prefix re-read   ${totals.cacheReadTokens} tokens (cached, cheap)`);
  log(`  prompts          ${totals.inputTokens} tokens`);
  log(`  generated        ${totals.outputTokens} tokens`);
  log(`  equivalent cost  $${totals.costUsd.toFixed(3)} if this were the API`);
  log(`  wall time        ${Math.round(totals.durationMs / 1000)}s`);
  log(`  cards queued     ${cardsQueued}`);

  if (totals.cacheReadTokens === 0 && totals.cacheCreationTokens > 0) {
    log('');
    log('  Note: no cache re-reads. Every call paid the full prefix, which');
    log('  means the system prompt or flags differed between calls.');
  }

  void billed;
}

/** One line per run, so a few days of monitoring is a readable file. */
async function appendRunLog(cardsQueued: number, generatedAt: string): Promise<void> {
  const entry = {
    at: generatedAt,
    cardsQueued,
    equivalentCostUsd: Number(totals.costUsd.toFixed(4)),
    seconds: Math.round(totals.durationMs / 1000),
    tokens: {
      prompt: totals.inputTokens,
      output: totals.outputTokens,
      cacheWrite: totals.cacheCreationTokens,
      cacheRead: totals.cacheReadTokens,
    },
  };

  await fs.mkdir(path.dirname(RUN_LOG), { recursive: true });
  await fs.appendFile(RUN_LOG, `${JSON.stringify(entry)}\n`, 'utf8');
}

/**
 * The CLI gives no schema guarantee, so validity is recovered by retrying with
 * the parse error fed back. The correction goes in the user prompt, never the
 * system prompt, so the cached prefix survives the retry.
 */
async function generateBatch<T extends z.ZodType>(
  label: string,
  model: CliModel,
  effort: Effort,
  schema: T,
  prompt: string,
): Promise<z.infer<T>> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    log(`Generating ${label} (${model}, effort ${effort}, try ${attempt})...`);

    const correction =
      attempt === 1
        ? ''
        : `\n\nYour previous reply could not be parsed: ${String(lastError).slice(0, 300)}\nReturn only the JSON object, with no fences or commentary.`;

    const result = await callClaude({
      model,
      effort,
      systemPrompt: SYSTEM_PROMPT,
      prompt: prompt + correction,
    });

    recordUsage(result.usage);

    try {
      return schema.parse(JSON.parse(extractJson(result.text))) as z.infer<T>;
    } catch (error) {
      lastError = error;
      log(`  unusable response, retrying`);
    }
  }

  throw new Error(
    `${label}: no valid response after ${MAX_ATTEMPTS} attempts — ${String(lastError)}`,
  );
}

async function researchNews(): Promise<string> {
  log(`Researching recent AI and tooling news (${Model.FAST})...`);

  const result = await callClaude({
    model: Model.FAST,
    // Research quality decides news quality; low effort here starves it.
    effort: Effort.MEDIUM,
    systemPrompt: SYSTEM_PROMPT,
    prompt: RESEARCH_PROMPT,
    allowedTools: ['WebSearch'],
  });

  recordUsage(result.usage);

  return result.text;
}

interface Draft {
  type: string;
  title: string;
  [key: string]: unknown;
}

function stamp(drafts: Draft[], generatedAt: string): Card[] {
  return drafts.map(
    draft =>
      ({
        ...draft,
        id: cardId(draft.type, draft.title),
        publishedAt: generatedAt,
      }) as unknown as Card,
  );
}

/**
 * Tips all share one card type now, so "already covered" has to be narrowed by
 * track — otherwise the backend request is shown a list of frontend titles.
 */
function coveredTitles(
  cards: Card[],
  type: CardType,
  tracks?: Track[],
): string[] {
  const wanted = tracks ? new Set<string>(tracks) : undefined;

  return cards
    .filter(card => card.type === type)
    .filter(card => {
      if (!wanted) {
        return true;
      }

      return 'track' in card && card.track ? wanted.has(card.track) : false;
    })
    .slice(0, 40)
    .map(card => `- ${card.title}`);
}

const failed: string[] = [];

/**
 * A run makes five generation calls. Letting one rejection propagate threw away
 * everything the other four produced — fifteen minutes of generation and seat
 * allowance discarded because one category came back malformed. Each section is
 * now independent: what succeeded gets queued, what failed is reported.
 */
async function section(
  label: string,
  run: () => Promise<{ cards: unknown[] }>,
): Promise<unknown[]> {
  try {
    return (await run()).cards;
  } catch (error) {
    failed.push(label);

    log(`  ${label} failed, continuing without it`);
    log(`    ${String(error).slice(0, 200)}`);

    return [];
  }
}

async function main(): Promise<void> {
  const [feed, queue, seen] = await Promise.all([
    readFeed(),
    readQueue(),
    knownIds(),
  ]);

  const history = [...feed.cards, ...queue];

  log(
    `Known: ${feed.cards.length} live, ${queue.length} pending, ${seen.size} ids total`,
  );

  const generatedAt = new Date().toISOString();

  const research = await researchNews();

  const news = await section('news', () => generateBatch(
    'news and blog cards',
    Model.FAST,
    Effort.LOW,
    LinkBatch,
    newsPrompt(COUNTS.news, research, [
      ...coveredTitles(history, CardType.AI_NEWS),
      ...coveredTitles(history, CardType.BLOG),
    ]),
  ));

  const frontend = await section('frontend tips', () => generateBatch(
    'frontend tips',
    Model.FAST,
    Effort.LOW,
    FrontendTipBatch,
    frontendTipPrompt(
      COUNTS.frontend,
      coveredTitles(history, CardType.LEARN, [Track.FRONTEND]),
    ),
  ));

  const backend = await section('backend tips', () => generateBatch(
    'backend tips',
    Model.FAST,
    Effort.MEDIUM,
    BackendTipBatch,
    backendTipPrompt(
      COUNTS.backend,
      coveredTitles(history, CardType.LEARN, [
        Track.NODE,
        Track.PYTHON,
        Track.JAVA,
        Track.GO,
        Track.SYSTEM_DESIGN,
        Track.MISC,
      ]),
    ),
  ));

  const interview = await section('interview questions', () => generateBatch(
    'interview questions',
    Model.DEEP,
    Effort.HIGH,
    InterviewBatch,
    interviewPrompt(
      COUNTS.interview,
      coveredTitles(history, CardType.LEARN),
    ),
  ));

  const outputQuestions = await section('output questions', () => generateBatch(
    'output-based questions',
    Model.DEEP,
    Effort.HIGH,
    OutputQuestionBatch,
    outputQuestionPrompt(
      COUNTS.outputQuestions,
      coveredTitles(history, CardType.OUTPUT_QUESTION),
    ),
  ));

  const drafts = [
    ...news,
    ...frontend,
    ...backend,
    ...interview,
    ...outputQuestions,
  ] as Draft[];

  const stamped = stamp(drafts, generatedAt);

  const fresh = stamped.filter(card => !seen.has(card.id));

  const duplicates = stamped.length - fresh.length;

  const added = await appendToQueue(fresh);

  log('');
  log(`Generated ${stamped.length}, ${duplicates} already seen, ${added} queued`);

  reportUsage(added);

  await appendRunLog(added, generatedAt);

  if (failed.length > 0) {
    log('');
    log(`Sections that failed: ${failed.join(', ')}`);
  }

  log('');
  log('Review them with: npm run admin');

  if (added === 0) {
    throw new Error('No cards were queued — every section failed');
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
