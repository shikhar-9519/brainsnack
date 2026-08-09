import { CARD_TYPE_LABELS, CardType, TRACK_LABELS } from '../../../src/types';
import type { Card } from '../../../src/types';

interface ReviewCardProps {
  card: Card;
  isSelected: boolean;
  onToggle: (id: string) => void;
}

function TrackBadge({ card }: { card: Card }) {
  if (!('track' in card) || !card.track) {
    return null;
  }

  return <span className="review__track">{TRACK_LABELS[card.track]}</span>;
}

function AnswerKey({ card }: { card: Card }) {
  if (card.type !== CardType.OUTPUT_QUESTION) {
    return null;
  }

  return (
    <div className="review__detail">
      <pre className="review__code">
        <code>{card.code}</code>
      </pre>

      <ol className="review__options">
        {card.options.map((option, index) => (
          <li
            key={option.label}
            className={
              index === card.correctOptionIndex
                ? 'review__option review__option--correct'
                : 'review__option'
            }
          >
            <code>{option.label}</code>
          </li>
        ))}
      </ol>

      <p className="review__explanation">{card.explanation}</p>
    </div>
  );
}

function LearnDetail({ card }: { card: Card }) {
  if (card.type !== CardType.LEARN) {
    return null;
  }

  return (
    <div className="review__detail">
      <p className="review__explanation">{card.body}</p>

      <pre className="review__code">
        <code>{card.code}</code>
      </pre>
    </div>
  );
}

function SourceLink({ card }: { card: Card }) {
  if (card.type !== CardType.AI_NEWS && card.type !== CardType.BLOG) {
    return null;
  }

  return (
    <div className="review__detail">
      <a
        className="review__link"
        href={card.sourceUrl}
        target="_blank"
        rel="noreferrer noopener"
      >
        {card.sourceName} — {card.sourceUrl}
      </a>
    </div>
  );
}

export function ReviewCard({ card, isSelected, onToggle }: ReviewCardProps) {
  return (
    <article className={isSelected ? 'review review--on' : 'review'}>
      <label className="review__head">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(card.id)}
        />

        <span className="review__type">{CARD_TYPE_LABELS[card.type]}</span>

        <TrackBadge card={card} />

        <span className="review__title">{card.title}</span>
      </label>

      <p className="review__summary">{card.summary}</p>

      <AnswerKey card={card} />

      <LearnDetail card={card} />

      <SourceLink card={card} />
    </article>
  );
}
