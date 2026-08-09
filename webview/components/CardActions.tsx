import { BookmarkIcon, CloseIcon, ExternalLinkIcon } from './Icons';

interface CardActionsProps {
  cardId: string;
  isSaved: boolean;
  sourceUrl?: string;
  onToggleSave: (id: string) => void;
  onDismiss: (id: string) => void;
  onOpen: (url: string, id: string) => void;
}

interface ReadMoreButtonProps {
  cardId: string;
  sourceUrl?: string;
  onOpen: (url: string, id: string) => void;
}

function ReadMoreButton({ cardId, sourceUrl, onOpen }: ReadMoreButtonProps) {
  if (!sourceUrl) {
    return null;
  }

  return (
    <button
      type="button"
      className="action action--primary"
      onClick={() => onOpen(sourceUrl, cardId)}
    >
      <ExternalLinkIcon />
      Read
    </button>
  );
}

function SaveLabel({ isSaved }: { isSaved: boolean }) {
  if (isSaved) {
    return <>Saved</>;
  }

  return <>Save</>;
}

export function CardActions({
  cardId,
  isSaved,
  sourceUrl,
  onToggleSave,
  onDismiss,
  onOpen,
}: CardActionsProps) {
  return (
    <div className="actions">
      <ReadMoreButton cardId={cardId} sourceUrl={sourceUrl} onOpen={onOpen} />

      <button
        type="button"
        className={isSaved ? 'action action--on' : 'action'}
        onClick={() => onToggleSave(cardId)}
        aria-pressed={isSaved}
      >
        <BookmarkIcon filled={isSaved} />

        <SaveLabel isSaved={isSaved} />
      </button>

      <button
        type="button"
        className="action"
        onClick={() => onDismiss(cardId)}
        aria-label="Hide this card"
        title="Hide this card"
      >
        <CloseIcon />
        Dismiss
      </button>
    </div>
  );
}
