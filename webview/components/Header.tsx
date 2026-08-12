import { Surface } from '../../src/types';
import { ArrowLeftIcon, ExpandIcon, RefreshIcon, UserIcon } from './Icons';

interface HeaderProps {
  surface: Surface;
  showingAbout: boolean;
  onOpenFocus: () => void;
  onRefresh: () => void;
  onToggleAbout: () => void;
}

/** Refresh and focus mode are meaningless while About is open. */
function FeedActions({
  surface,
  showingAbout,
  onOpenFocus,
  onRefresh,
}: {
  surface: Surface;
  showingAbout: boolean;
  onOpenFocus: () => void;
  onRefresh: () => void;
}) {
  if (showingAbout) {
    return null;
  }

  return (
    <>
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
    </>
  );
}

function AboutToggleIcon({ showingAbout }: { showingAbout: boolean }) {
  if (showingAbout) {
    return <ArrowLeftIcon />;
  }

  return <UserIcon />;
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

export function Header({
  surface,
  showingAbout,
  onOpenFocus,
  onRefresh,
  onToggleAbout,
}: HeaderProps) {
  return (
    <header className="header">
      <span className="brand">
        Brain<span className="brand__accent">Snack</span>
      </span>

      <span className="header__spacer" />

      <FeedActions
        surface={surface}
        showingAbout={showingAbout}
        onOpenFocus={onOpenFocus}
        onRefresh={onRefresh}
      />

      <button
        type="button"
        className={showingAbout ? 'icon-button icon-button--on' : 'icon-button'}
        onClick={onToggleAbout}
        aria-label={showingAbout ? 'Back to feed' : 'About BrainSnack'}
        aria-pressed={showingAbout}
        title={showingAbout ? 'Back to feed' : 'About BrainSnack'}
      >
        <AboutToggleIcon showingAbout={showingAbout} />
      </button>
    </header>
  );
}
