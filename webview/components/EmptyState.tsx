import { InboxIcon } from './Icons';
import { SAVED_TAB } from './TabBar';

interface EmptyStateProps {
  count: number;
  activeTab: string;
  /** True when the reader has narrowed the track filter below the full set. */
  isNarrowed: boolean;
}

function SavedEmptyState() {
  return (
    <>
      <p className="empty__title">Nothing saved yet</p>

      <p className="empty__body">
        Hit Save on a card and it will wait for you here.
      </p>
    </>
  );
}

/**
 * Nothing here is actionable by the reader beyond their own filters — content
 * arrives on a schedule they do not control — so the copy sets an expectation
 * rather than asking them to do something.
 */
function CaughtUpState() {
  return (
    <>
      <p className="empty__title">You are all caught up</p>

      <p className="empty__body">
        New cards are added through the day. Check back on your next wait.
      </p>
    </>
  );
}

function FilteredEmptyState() {
  return (
    <>
      <p className="empty__title">Nothing matches this filter</p>

      <p className="empty__body">
        Widen the filter above to see more, or check back later — new cards are
        added through the day.
      </p>
    </>
  );
}

function EmptyBody({
  activeTab,
  isNarrowed,
}: {
  activeTab: string;
  isNarrowed: boolean;
}) {
  if (activeTab === SAVED_TAB) {
    return <SavedEmptyState />;
  }

  if (isNarrowed) {
    return <FilteredEmptyState />;
  }

  return <CaughtUpState />;
}

export function EmptyState({ count, activeTab, isNarrowed }: EmptyStateProps) {
  if (count > 0) {
    return null;
  }

  return (
    <div className="empty">
      <span className="empty__icon">
        <InboxIcon />
      </span>

      <EmptyBody activeTab={activeTab} isNarrowed={isNarrowed} />
    </div>
  );
}
