import type { Card } from '../../src/types';
import { FeedCard } from './FeedCard';

interface CardListProps {
  cards: Card[];
  savedIds: Set<string>;
  readIds: Set<string>;
  revealedIds: Set<string>;
  secondsLeft: Record<string, number>;
  totalSeconds: number;
  onToggleSave: (id: string) => void;
  onDismiss: (id: string) => void;
  onOpen: (url: string, id: string) => void;
  onReveal: (id: string) => void;
}

export function CardList({
  cards,
  savedIds,
  readIds,
  revealedIds,
  secondsLeft,
  totalSeconds,
  onToggleSave,
  onDismiss,
  onOpen,
  onReveal,
}: CardListProps) {
  return (
    <div className="list">
      {cards.map(card => (
        <FeedCard
          key={card.id}
          card={card}
          isSaved={savedIds.has(card.id)}
          isRead={readIds.has(card.id)}
          isRevealed={revealedIds.has(card.id)}
          secondsLeft={secondsLeft[card.id]}
          totalSeconds={totalSeconds}
          onToggleSave={onToggleSave}
          onDismiss={onDismiss}
          onOpen={onOpen}
          onReveal={onReveal}
        />
      ))}
    </div>
  );
}
