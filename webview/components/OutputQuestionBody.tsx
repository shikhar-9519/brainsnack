import { useState } from 'react';
import type { OutputQuestionCard } from '../../src/types';
import { CheckIcon, CloseIcon } from './Icons';

const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

interface OutputQuestionBodyProps {
  card: OutputQuestionCard;
  isRevealed: boolean;
  onReveal: (id: string) => void;
}

interface OptionButtonProps {
  label: string;
  index: number;
  correctIndex: number;
  chosenIndex: number | undefined;
  isRevealed: boolean;
  onChoose: (index: number) => void;
}

function optionClassName(
  index: number,
  correctIndex: number,
  chosenIndex: number | undefined,
  isRevealed: boolean,
): string {
  if (!isRevealed) {
    return 'option';
  }

  if (index === correctIndex) {
    return 'option option--correct';
  }

  if (index === chosenIndex) {
    return 'option option--wrong';
  }

  return 'option option--muted';
}

interface OptionMarkProps {
  index: number;
  correctIndex: number;
  chosenIndex: number | undefined;
  isRevealed: boolean;
}

function OptionMark({
  index,
  correctIndex,
  chosenIndex,
  isRevealed,
}: OptionMarkProps) {
  if (!isRevealed) {
    return null;
  }

  if (index === correctIndex) {
    return (
      <span className="option__mark">
        <CheckIcon />
      </span>
    );
  }

  if (index === chosenIndex) {
    return (
      <span className="option__mark">
        <CloseIcon />
      </span>
    );
  }

  return null;
}

function OptionButton({
  label,
  index,
  correctIndex,
  chosenIndex,
  isRevealed,
  onChoose,
}: OptionButtonProps) {
  return (
    <button
      type="button"
      className={optionClassName(index, correctIndex, chosenIndex, isRevealed)}
      onClick={() => onChoose(index)}
      disabled={isRevealed}
    >
      <span className="option__key">{OPTION_KEYS[index]}</span>

      <span className="option__label">{label}</span>

      <OptionMark
        index={index}
        correctIndex={correctIndex}
        chosenIndex={chosenIndex}
        isRevealed={isRevealed}
      />
    </button>
  );
}

function Explanation({
  card,
  isRevealed,
}: {
  card: OutputQuestionCard;
  isRevealed: boolean;
}) {
  if (!isRevealed) {
    return null;
  }

  return <p className="explanation">{card.explanation}</p>;
}

export function OutputQuestionBody({
  card,
  isRevealed,
  onReveal,
}: OutputQuestionBodyProps) {
  const [chosenIndex, setChosenIndex] = useState<number | undefined>(undefined);

  function handleChoose(index: number) {
    setChosenIndex(index);

    onReveal(card.id);
  }

  return (
    <div className="output-question">
      <pre className="code">
        <code>{card.code}</code>
      </pre>

      <div className="options">
        {card.options.map((option, index) => (
          <OptionButton
            key={option.label}
            label={option.label}
            index={index}
            correctIndex={card.correctOptionIndex}
            chosenIndex={chosenIndex}
            isRevealed={isRevealed}
            onChoose={handleChoose}
          />
        ))}
      </div>

      <Explanation card={card} isRevealed={isRevealed} />
    </div>
  );
}
