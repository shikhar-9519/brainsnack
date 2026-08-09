import { CARD_TYPE_LABELS, CardType, TRACK_LABELS } from '../../src/types';
import type { Card } from '../../src/types';
import { CardActions } from './CardActions';
import { CardBody } from './CardBody';
import { RemovalNotice } from './RemovalNotice';

interface FeedCardProps {
  card: Card;
  isSaved: boolean;
  isRead: boolean;
  isRevealed: boolean;
  secondsLeft?: number;
  totalSeconds: number;
  onToggleSave: (id: string) => void;
  onDismiss: (id: string) => void;
  onOpen: (url: string, id: string) => void;
  onReveal: (id: string) => void;
}

function cardClassName(isRead: boolean, isClearing: boolean): string {
  if (isClearing) {
    return 'card card--clearing';
  }

  if (isRead) {
    return 'card card--read';
  }

  return 'card';
}

function sourceUrlOf(card: Card): string | undefined {
  if (card.type === CardType.AI_NEWS || card.type === CardType.BLOG) {
    return card.sourceUrl;
  }

  if (card.type === CardType.LEARN) {
    return card.sourceUrl;
  }

  return undefined;
}

function sourceNameOf(card: Card): string | undefined {
  if (card.type === CardType.AI_NEWS || card.type === CardType.BLOG) {
    return card.sourceName;
  }

  return undefined;
}

function durationLabel(seconds: number): string {
  if (seconds < 90) {
    return `${seconds} sec`;
  }

  return `${Math.round(seconds / 60)} min`;
}

function TrackTag({ card }: { card: Card }) {
  if (!('track' in card) || !card.track) {
    return null;
  }

  return <span className="meta__track">{TRACK_LABELS[card.track]}</span>;
}

function SourceTag({ name }: { name?: string }) {
  if (!name) {
    return null;
  }

  return <span className="meta__source">{name}</span>;
}

function ReadDot({ isRead }: { isRead: boolean }) {
  if (!isRead) {
    return null;
  }

  return <span className="meta__read" title="Already read" />;
}

export function FeedCard({
  card,
  isSaved,
  isRead,
  isRevealed,
  secondsLeft,
  totalSeconds,
  onToggleSave,
  onDismiss,
  onOpen,
  onReveal,
}: FeedCardProps) {
  return (
    <article className={cardClassName(isRead, secondsLeft !== undefined)}>
      <div className="meta">
        <span className="meta__type">{CARD_TYPE_LABELS[card.type]}</span>

        <span className="meta__time">
          {durationLabel(card.estimatedReadSeconds)}
        </span>

        <TrackTag card={card} />

        <SourceTag name={sourceNameOf(card)} />

        <ReadDot isRead={isRead} />
      </div>

      <h3 className="card__title">{card.title}</h3>

      <p className="card__summary">{card.summary}</p>

      <CardBody card={card} isRevealed={isRevealed} onReveal={onReveal} />

      <RemovalNotice secondsLeft={secondsLeft} totalSeconds={totalSeconds} />

      <CardActions
        cardId={card.id}
        isSaved={isSaved}
        sourceUrl={sourceUrlOf(card)}
        onToggleSave={onToggleSave}
        onDismiss={onDismiss}
        onOpen={onOpen}
      />
    </article>
  );
}
