import { Surface } from '../../src/types';
import { ExpandIcon, RefreshIcon } from './Icons';

interface HeaderProps {
  surface: Surface;
  onOpenFocus: () => void;
  onRefresh: () => void;
}

/** Focus mode is already the wide surface, so it does not offer itself. */
function FocusButton({
  surface,
  onOpenFocus,
}: {
  surface: Surface;
  onOpenFocus: () => void;
}) {
  if (surface === Surface.FOCUS) {
    return null;
  }

  return (
    <button
      type="button"
      className="icon-button"
      onClick={onOpenFocus}
      aria-label="Open in focus mode"
      title="Open in focus mode"
    >
      <ExpandIcon />
    </button>
  );
}

export function Header({ surface, onOpenFocus, onRefresh }: HeaderProps) {
  return (
    <header className="header">
      <span className="brand">
        Inter<span className="brand__accent">lude</span>
      </span>

      <span className="header__spacer" />

      <button
        type="button"
        className="icon-button"
        onClick={onRefresh}
        aria-label="Refresh feed"
        title="Refresh feed"
      >
        <RefreshIcon />
      </button>

      <FocusButton surface={surface} onOpenFocus={onOpenFocus} />
    </header>
  );
}
