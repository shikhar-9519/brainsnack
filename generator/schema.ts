import * as z from 'zod/v4';
import { CardType, Difficulty, Track } from '../src/types';

const difficulty = z.enum([
  Difficulty.BEGINNER,
  Difficulty.INTERMEDIATE,
  Difficulty.ADVANCED,
]);

/**
 * The model never invents ids or timestamps — those are stamped locally so a
 * re-run produces stable ids and dedupes against everything already seen.
 */
const base = {
  title: z.string(),
  summary: z.string(),
  estimatedReadSeconds: z.number(),
  difficulty,
  tags: z.array(z.string()),
};

export const LinkCardDraft = z.object({
  ...base,
  type: z.enum([CardType.AI_NEWS, CardType.BLOG]),
  sourceName: z.string(),
  sourceUrl: z.string(),
});

const backendTrack = z.enum([
  Track.NODE,
  Track.PYTHON,
  Track.JAVA,
  Track.GO,
  Track.SYSTEM_DESIGN,
  Track.MISC,
]);

const outputTrack = z.enum([
  Track.FRONTEND,
  Track.NODE,
  Track.PYTHON,
  Track.JAVA,
  Track.GO,
]);

const fullTrack = z.enum([
  Track.FRONTEND,
  Track.NODE,
  Track.PYTHON,
  Track.JAVA,
  Track.GO,
  Track.SYSTEM_DESIGN,
  Track.MISC,
]);

/**
 * Frontend, backend and question-shaped cards are all one type; splitting the
 * request in three is purely to guarantee the mix. One call asking for "a
 * spread" reliably over-produces whichever shape the model finds easiest.
 */
export const FrontendTipDraft = z.object({
  ...base,
  type: z.literal(CardType.LEARN),
  track: z.literal(Track.FRONTEND),
  isQuestion: z.literal(false),
  body: z.string(),
  code: z.string(),
});

export const BackendTipDraft = z.object({
  ...base,
  type: z.literal(CardType.LEARN),
  track: backendTrack,
  isQuestion: z.literal(false),
  body: z.string(),
  code: z.string(),
});

export const InterviewQuestionDraft = z.object({
  ...base,
  type: z.literal(CardType.LEARN),
  track: fullTrack,
  isQuestion: z.literal(true),
  body: z.string(),
  followUps: z.array(z.string()),
});

export const OutputQuestionDraft = z.object({
  ...base,
  type: z.literal(CardType.OUTPUT_QUESTION),
  track: outputTrack,
  language: z.string(),
  code: z.string(),
  options: z.array(z.object({ label: z.string() })),
  correctOptionIndex: z.number(),
  explanation: z.string(),
});

export const LinkBatch = z.object({ cards: z.array(LinkCardDraft) });
export const FrontendTipBatch = z.object({ cards: z.array(FrontendTipDraft) });
export const BackendTipBatch = z.object({ cards: z.array(BackendTipDraft) });
export const InterviewBatch = z.object({
  cards: z.array(InterviewQuestionDraft),
});
export const OutputQuestionBatch = z.object({
  cards: z.array(OutputQuestionDraft),
});

export type LinkBatch = z.infer<typeof LinkBatch>;
export type FrontendTipBatch = z.infer<typeof FrontendTipBatch>;
export type BackendTipBatch = z.infer<typeof BackendTipBatch>;
export type InterviewBatch = z.infer<typeof InterviewBatch>;
export type OutputQuestionBatch = z.infer<typeof OutputQuestionBatch>;
