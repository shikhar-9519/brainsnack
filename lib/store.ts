import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Card, Feed } from '../src/types';

const DATA_DIR = path.resolve(process.cwd(), 'data');

export const StoreFile = {
  QUEUE: path.join(DATA_DIR, 'queue.json'),
  FEED: path.join(DATA_DIR, 'feed.json'),
  REJECTED: path.join(DATA_DIR, 'rejected.json'),
} as const;

export interface RejectedRecord {
  id: string;
  title: string;
  type: string;
  rejectedAt: string;
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return fallback;
    }

    throw error;
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });

  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function readQueue(): Promise<Card[]> {
  return readJson<Card[]>(StoreFile.QUEUE, []);
}

export async function writeQueue(cards: Card[]): Promise<void> {
  await writeJson(StoreFile.QUEUE, cards);
}

export async function readFeed(): Promise<Feed> {
  return readJson<Feed>(StoreFile.FEED, {
    generatedAt: new Date(0).toISOString(),
    cards: [],
  });
}

export async function writeFeed(feed: Feed): Promise<void> {
  await writeJson(StoreFile.FEED, feed);
}

export async function readRejected(): Promise<RejectedRecord[]> {
  return readJson<RejectedRecord[]>(StoreFile.REJECTED, []);
}

export async function writeRejected(records: RejectedRecord[]): Promise<void> {
  await writeJson(StoreFile.REJECTED, records);
}

/**
 * Every id the pipeline has ever seen. The generator dedups against this so a
 * rejected card never comes back, which is the difference between a queue that
 * converges and one that shows you the same bad card twice a day forever.
 */
export async function knownIds(): Promise<Set<string>> {
  const [queue, feed, rejected] = await Promise.all([
    readQueue(),
    readFeed(),
    readRejected(),
  ]);

  return new Set([
    ...queue.map(card => card.id),
    ...feed.cards.map(card => card.id),
    ...rejected.map(record => record.id),
  ]);
}

export async function appendToQueue(cards: Card[]): Promise<number> {
  const existing = await readQueue();

  const seen = new Set(existing.map(card => card.id));

  const fresh = cards.filter(card => !seen.has(card.id));

  await writeQueue([...fresh, ...existing]);

  return fresh.length;
}

/** Moves cards from the queue into the live feed. */
export async function approve(ids: string[]): Promise<number> {
  const wanted = new Set(ids);

  const [queue, feed] = await Promise.all([readQueue(), readFeed()]);

  const promoted = queue.filter(card => wanted.has(card.id));

  if (promoted.length === 0) {
    return 0;
  }

  await writeQueue(queue.filter(card => !wanted.has(card.id)));

  await writeFeed({
    generatedAt: new Date().toISOString(),
    cards: [...promoted, ...feed.cards],
  });

  return promoted.length;
}

export async function reject(ids: string[]): Promise<number> {
  const wanted = new Set(ids);

  const [queue, rejected] = await Promise.all([readQueue(), readRejected()]);

  const dropped = queue.filter(card => wanted.has(card.id));

  if (dropped.length === 0) {
    return 0;
  }

  const rejectedAt = new Date().toISOString();

  await writeQueue(queue.filter(card => !wanted.has(card.id)));

  await writeRejected([
    ...dropped.map(card => ({
      id: card.id,
      title: card.title,
      type: card.type,
      rejectedAt,
    })),
    ...rejected,
  ]);

  return dropped.length;
}

/** Pulls a card back out of the live feed and records it as rejected. */
export async function removeFromFeed(ids: string[]): Promise<number> {
  const wanted = new Set(ids);

  const [feed, rejected] = await Promise.all([readFeed(), readRejected()]);

  const dropped = feed.cards.filter(card => wanted.has(card.id));

  if (dropped.length === 0) {
    return 0;
  }

  const rejectedAt = new Date().toISOString();

  await writeFeed({
    generatedAt: new Date().toISOString(),
    cards: feed.cards.filter(card => !wanted.has(card.id)),
  });

  await writeRejected([
    ...dropped.map(card => ({
      id: card.id,
      title: card.title,
      type: card.type,
      rejectedAt,
    })),
    ...rejected,
  ]);

  return dropped.length;
}
