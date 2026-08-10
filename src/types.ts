export const CardType = {
  AI_NEWS: 'ai_news',
  BLOG: 'blog',
  LEARN: 'learn',
  OUTPUT_QUESTION: 'output_question',
} as const;

export type CardType = (typeof CardType)[keyof typeof CardType];

export const CARD_TYPE_LABELS: Record<CardType, string> = {
  [CardType.AI_NEWS]: 'AI News',
  [CardType.BLOG]: 'Blogs',
  [CardType.LEARN]: 'Learn',
  [CardType.OUTPUT_QUESTION]: 'Output',
};

export const ALL_CARD_TYPES: CardType[] = [
  CardType.AI_NEWS,
  CardType.BLOG,
  CardType.LEARN,
  CardType.OUTPUT_QUESTION,
];

/**
 * Second axis, orthogonal to CardType. `type` is the format of a card; `track`
 * is the technology it is about. Kept strictly separate: "frontend" is a track,
 * never a card type, so it exists in exactly one place.
 *
 * Learn and output cards carry a track. News and blogs do not — a release
 * announcement is not per-language.
 */
export const Track = {
  FRONTEND: 'frontend',
  NODE: 'node',
  PYTHON: 'python',
  JAVA: 'java',
  GO: 'go',
  /** Architecture, scaling, distributed systems, trade-off reasoning. */
  SYSTEM_DESIGN: 'system_design',
  /**
   * Tooling, protocols, observability, security — cross-cutting content that
   * is neither language-specific nor architecture. Labelled "Misc" rather than
   * "General" because, sitting beside Frontend/Node/Python/Go, "General" reads
   * like a select-all.
   */
  MISC: 'misc',
} as const;

export type Track = (typeof Track)[keyof typeof Track];

export const TRACK_LABELS: Record<Track, string> = {
  [Track.FRONTEND]: 'Frontend',
  [Track.NODE]: 'Node.js',
  [Track.PYTHON]: 'Python',
  [Track.JAVA]: 'Java',
  [Track.GO]: 'Go',
  [Track.SYSTEM_DESIGN]: 'System Design',
  [Track.MISC]: 'Misc',
};

export const ALL_TRACKS: Track[] = [
  Track.FRONTEND,
  Track.NODE,
  Track.PYTHON,
  Track.JAVA,
  Track.GO,
  Track.SYSTEM_DESIGN,
  Track.MISC,
];

export const Difficulty = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
} as const;

export type Difficulty = (typeof Difficulty)[keyof typeof Difficulty];

interface CardBase {
  id: string;
  title: string;
  summary: string;
  /** Rough time to consume the card. Used to match a card to the expected wait. */
  estimatedReadSeconds: number;
  difficulty: Difficulty;
  tags: string[];
  publishedAt: string;
}

export interface LinkCard extends CardBase {
  type: typeof CardType.AI_NEWS | typeof CardType.BLOG;
  sourceName: string;
  sourceUrl: string;
}

/**
 * Tips and interview questions were separate types, but they differ only in
 * whether the explanation is gated behind a reveal — same subjects, same
 * length, same value. That is a property of a card, not a category, so it is a
 * flag and they share one pool.
 */
export interface LearnCard extends CardBase {
  type: typeof CardType.LEARN;
  track: Track;
  /** Question-shaped cards hide `body` until the reader asks for it. */
  isQuestion: boolean;
  body: string;
  code?: string;
  followUps?: string[];
  sourceUrl?: string;
}

export interface OutputQuestionOption {
  label: string;
}

export interface OutputQuestionCard extends CardBase {
  type: typeof CardType.OUTPUT_QUESTION;
  track?: Track;
  language: string;
  code: string;
  options: OutputQuestionOption[];
  correctOptionIndex: number;
  explanation: string;
}

export type Card = LinkCard | LearnCard | OutputQuestionCard;

export interface Feed {
  generatedAt: string;
  cards: Card[];
}

export const AgentState = {
  IDLE: 'idle',
  WORKING: 'working',
  WAITING: 'waiting',
  FINISHED: 'finished',
} as const;

export type AgentState = (typeof AgentState)[keyof typeof AgentState];

/** extension -> webview */
export const OutboundMessage = {
  INIT: 'init',
  CARDS: 'cards',
  AGENT_STATE: 'agentState',
  SAVED_CHANGED: 'savedChanged',
} as const;

/** webview -> extension */
export const InboundMessage = {
  READY: 'ready',
  TOGGLE_SAVE: 'toggleSave',
  DISMISS: 'dismiss',
  MARK_READ: 'markRead',
  OPEN_EXTERNAL: 'openExternal',
  SET_INTERESTS: 'setInterests',
  SET_TRACKS: 'setTracks',
  REFRESH: 'refresh',
  OPEN_FOCUS: 'openFocus',
  OPEN_SETTINGS: 'openSettings',
} as const;

export const Surface = {
  SIDEBAR: 'sidebar',
  FOCUS: 'focus',
} as const;

export type Surface = (typeof Surface)[keyof typeof Surface];

export interface AboutInfo {
  version: string;
  /** publisher.name — what the settings editor filters on. */
  publisherId: string;
  authorName: string;
  authorUrl: string;
  repositoryUrl: string;
  issuesUrl: string;
}

export interface WebviewInitPayload {
  cards: Card[];
  savedIds: string[];
  readIds: string[];
  interests: CardType[];
  tracks: Track[];
  about: AboutInfo;
  /** When the feed was generated, so the reader can judge how fresh it is. */
  feedGeneratedAt: string;
  /** Grace period before an answered card clears itself. 0 disables it. */
  removeAfterSeconds: number;
  agentState: AgentState;
}
