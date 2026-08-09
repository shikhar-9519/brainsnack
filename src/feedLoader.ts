import * as fs from 'node:fs/promises';
import * as vscode from 'vscode';
import { ConfigKey, EXTENSION_ID } from './constants';
import { ALL_CARD_TYPES, ALL_TRACKS, CardType, Track } from './types';
import type { Card, Feed } from './types';
import type { Storage } from './storage';
import type { Logger } from './logger';
import { interleaveByType } from '../lib/ordering';

const FETCH_TIMEOUT_MS = 10_000;

function isCardType(value: unknown): value is CardType {
  return ALL_CARD_TYPES.includes(value as CardType);
}

function isCard(value: unknown): value is Card {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const card = value as Partial<Card>;

  return (
    typeof card.id === 'string' &&
    typeof card.title === 'string' &&
    typeof card.summary === 'string' &&
    isCardType(card.type)
  );
}

function parseFeed(raw: unknown): Feed | undefined {
  if (typeof raw !== 'object' || raw === null) {
    return undefined;
  }

  const feed = raw as Partial<Feed>;

  if (!Array.isArray(feed.cards)) {
    return undefined;
  }

  return {
    generatedAt:
      typeof feed.generatedAt === 'string'
        ? feed.generatedAt
        : new Date(0).toISOString(),
    cards: feed.cards.filter(isCard),
  };
}

/**
 * Feed resolution order: remote URL, then last successful fetch, then the
 * bundled seed. Swapping `feedUrl` for a real API later needs no other change.
 */
export class FeedLoader {
  constructor(
    private readonly seedPath: vscode.Uri,
    private readonly storage: Storage,
    private readonly output: Logger,
  ) {}

  private configuredUrl(): string {
    return vscode.workspace
      .getConfiguration(EXTENSION_ID)
      .get<string>(ConfigKey.FEED_URL, '')
      .trim();
  }

  private async loadSeed(): Promise<Feed> {
    const raw = await fs.readFile(this.seedPath.fsPath, 'utf8');

    return parseFeed(JSON.parse(raw)) ?? { generatedAt: '', cards: [] };
  }

  /**
   * `fetch` does not implement the file: scheme, so a local feed produced by
   * the generator has to be read off disk directly.
   */
  private async readLocal(url: string): Promise<Feed | undefined> {
    try {
      const raw = await fs.readFile(vscode.Uri.parse(url).fsPath, 'utf8');

      const feed = parseFeed(JSON.parse(raw));

      if (!feed) {
        this.output.log(`Local feed at ${url} has an unrecognised shape`);
        return undefined;
      }

      this.output.log(`Loaded ${feed.cards.length} cards from ${url}`);

      return feed;
    } catch (error) {
      this.output.log(`Could not read local feed: ${String(error)}`);
      return undefined;
    }
  }

  private async fetchRemote(url: string): Promise<Feed | undefined> {
    if (url.startsWith('file:')) {
      return this.readLocal(url);
    }

    const controller = new AbortController();

    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, { signal: controller.signal });

      if (!response.ok) {
        this.output.log(`Feed fetch failed: HTTP ${response.status}`);
        return undefined;
      }

      const feed = parseFeed(await response.json());

      if (!feed) {
        this.output.log('Feed fetch returned an unrecognised shape');
        return undefined;
      }

      await this.storage.setCachedFeed(feed);

      this.output.log(`Fetched ${feed.cards.length} cards from ${url}`);

      return feed;
    } catch (error) {
      this.output.log(`Feed fetch error: ${String(error)}`);
      return undefined;
    } finally {
      clearTimeout(timer);
    }
  }

  async load(): Promise<Feed> {
    const url = this.configuredUrl();

    if (url) {
      const remote = await this.fetchRemote(url);

      if (remote) {
        return remote;
      }

      const cached = this.storage.getCachedFeed();

      if (cached) {
        this.output.log('Serving cached feed');
        return cached;
      }
    }

    return this.loadSeed();
  }

  /** Applies interests, dismissals and the card cap. */
  visibleCards(feed: Feed): Card[] {
    const config = vscode.workspace.getConfiguration(EXTENSION_ID);

    const interests = config.get<CardType[]>(ConfigKey.INTERESTS, [
      ...ALL_CARD_TYPES,
    ]);

    const maxCards = config.get<number>(ConfigKey.MAX_CARDS, 60);

    const allowedTracks = new Set(
      config.get<Track[]>(ConfigKey.TRACKS, [...ALL_TRACKS]),
    );

    const dismissed = new Set(this.storage.getDismissedIds());

    const saved = new Set(this.storage.getSavedIds());

    const allowed = new Set(interests.filter(isCardType));

    // Saving outranks dismissal, so a card kept during its countdown still
    // reaches the Saved tab.
    const visible = feed.cards.filter(
      card =>
        allowed.has(card.type) &&
        // A card without a track is language-agnostic and always shown.
        (!('track' in card) || !card.track || allowedTracks.has(card.track)) &&
        (saved.has(card.id) || !dismissed.has(card.id)),
    );

    return interleaveByType(visible).slice(0, Math.max(1, maxCards));
  }
}
