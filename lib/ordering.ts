import type { Card, CardType } from '../src/types';

/**
 * Round-robin by type. The feed file is grouped by type because that is how it
 * is generated, so serving it verbatim puts every output question at the top
 * and buries everything else — the All tab looked like a wall of one kind.
 *
 * Interleaving also means the maxCards cap trims evenly instead of amputating
 * whichever type happens to sort last.
 *
 * Kept free of vscode imports so it can be tested on its own.
 */
export function interleaveByType(cards: Card[]): Card[] {
  const buckets = new Map<CardType, Card[]>();

  for (const card of cards) {
    const bucket = buckets.get(card.type);

    if (bucket) {
      bucket.push(card);
      continue;
    }

    buckets.set(card.type, [card]);
  }

  const lists = [...buckets.values()];

  const longest = Math.max(0, ...lists.map(list => list.length));

  const ordered: Card[] = [];

  for (let index = 0; index < longest; index += 1) {
    for (const list of lists) {
      const card = list[index];

      if (card) {
        ordered.push(card);
      }
    }
  }

  return ordered;
}
