import { CardType } from '../../src/types';
import type { Card } from '../../src/types';
import { LearnBody } from './LearnBody';
import { OutputQuestionBody } from './OutputQuestionBody';

interface CardBodyProps {
  card: Card;
  isRevealed: boolean;
  onReveal: (id: string) => void;
}

export function CardBody({ card, isRevealed, onReveal }: CardBodyProps) {
  if (card.type === CardType.OUTPUT_QUESTION) {
    return (
      <OutputQuestionBody
        card={card}
        isRevealed={isRevealed}
        onReveal={onReveal}
      />
    );
  }

  if (card.type === CardType.LEARN) {
    return (
      <LearnBody card={card} isRevealed={isRevealed} onReveal={onReveal} />
    );
  }

  return null;
}
