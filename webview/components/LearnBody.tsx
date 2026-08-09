import type { LearnCard } from '../../src/types';
import { EyeIcon } from './Icons';

interface LearnBodyProps {
  card: LearnCard;
  isRevealed: boolean;
  onReveal: (id: string) => void;
}

function TipCode({ code }: { code?: string }) {
  if (!code) {
    return null;
  }

  return (
    <pre className="code">
      <code>{code}</code>
    </pre>
  );
}

function FollowUps({ followUps }: { followUps?: string[] }) {
  if (!followUps || followUps.length === 0) {
    return null;
  }

  return (
    <ul className="follow-ups">
      {followUps.map(question => (
        <li key={question}>{question}</li>
      ))}
    </ul>
  );
}

function Explanation({ card }: { card: LearnCard }) {
  return (
    <div className="answer">
      <p>{card.body}</p>

      <TipCode code={card.code} />

      <FollowUps followUps={card.followUps} />
    </div>
  );
}

function RevealButton({
  cardId,
  onReveal,
}: {
  cardId: string;
  onReveal: (id: string) => void;
}) {
  return (
    <div className="actions">
      <button
        type="button"
        className="action action--primary"
        onClick={() => onReveal(cardId)}
      >
        <EyeIcon />
        Show answer
      </button>
    </div>
  );
}

/**
 * One body for the whole Learn pool. A question-shaped card withholds its
 * explanation until asked; everything else reads straight through.
 */
export function LearnBody({ card, isRevealed, onReveal }: LearnBodyProps) {
  if (card.isQuestion && !isRevealed) {
    return <RevealButton cardId={card.id} onReveal={onReveal} />;
  }

  return <Explanation card={card} />;
}
