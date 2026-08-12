import { useCallback, useEffect, useMemo, useState } from 'react';
import { ALL_CARD_TYPES, CARD_TYPE_LABELS } from '../../src/types';
import type { Card, CardType } from '../../src/types';
import { AdminAction, fetchState, runAction } from './api';
import type { AdminState } from './api';
import { ReviewCard } from './components/ReviewCard';

const Tab = {
  QUEUE: 'queue',
  LIVE: 'live',
} as const;

type Tab = (typeof Tab)[keyof typeof Tab];

function EmptyPane({ tab }: { tab: Tab }) {
  if (tab === Tab.QUEUE) {
    return (
      <p className="empty__body">
        Queue is empty. Run <code>npm run generate</code> to produce cards.
      </p>
    );
  }

  return (
    <p className="empty__body">
      Nothing approved yet. Approve cards from the Pending tab, then run{' '}
      <code>npm run publish</code> to push them live.
    </p>
  );
}

function CardPane({
  cards,
  tab,
  selected,
  onToggle,
}: {
  cards: Card[];
  tab: Tab;
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (cards.length === 0) {
    return <EmptyPane tab={tab} />;
  }

  return (
    <div className="review-list">
      {cards.map(card => (
        <ReviewCard
          key={card.id}
          card={card}
          isSelected={selected.has(card.id)}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}

function QueueActions({
  count,
  busy,
  onApprove,
  onReject,
}: {
  count: number;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <>
      <button
        type="button"
        className="action action--primary"
        onClick={onApprove}
        disabled={busy}
      >
        Approve {count}
      </button>

      <button
        type="button"
        className="action"
        onClick={onReject}
        disabled={busy}
      >
        Reject {count}
      </button>
    </>
  );
}

function LiveActions({
  count,
  busy,
  onRemove,
}: {
  count: number;
  busy: boolean;
  onRemove: () => void;
}) {
  return (
    <button type="button" className="action" onClick={onRemove} disabled={busy}>
      Remove {count} from feed
    </button>
  );
}

function SelectionBar({
  tab,
  count,
  busy,
  onApprove,
  onReject,
  onRemove,
  onClear,
}: {
  tab: Tab;
  count: number;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onRemove: () => void;
  onClear: () => void;
}) {
  if (count === 0) {
    return null;
  }

  if (tab === Tab.QUEUE) {
    return (
      <div className="selection">
        <QueueActions
          count={count}
          busy={busy}
          onApprove={onApprove}
          onReject={onReject}
        />

        <button type="button" className="action" onClick={onClear}>
          Clear
        </button>
      </div>
    );
  }

  return (
    <div className="selection">
      <LiveActions count={count} busy={busy} onRemove={onRemove} />

      <button type="button" className="action" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}

/**
 * Approving only writes data/feed.json locally. Readers see nothing until it is
 * pushed, which is a separate command — so say so rather than letting "approved"
 * be mistaken for "live".
 */
function PublishHint({ count }: { count: number }) {
  if (count === 0) {
    return null;
  }

  return (
    <p className="notice notice--info">
      {count} approved card{count === 1 ? '' : 's'} are in your local feed. Run{' '}
      <code>npm run publish</code> to push them live — approving alone does not
      reach readers.
    </p>
  );
}

const ALL_TYPES = 'all';

/**
 * Removing fifteen stale news cards from sixty-three meant hunting for them one
 * at a time. Filtering first makes "select all" mean "all of this kind", which
 * is how the pruning actually gets done.
 */
function TypeFilter({
  active,
  counts,
  onSelect,
}: {
  active: string;
  counts: Record<string, number>;
  onSelect: (type: string) => void;
}) {
  const present = ALL_CARD_TYPES.filter(type => counts[type] > 0);

  if (present.length < 2) {
    return null;
  }

  return (
    <nav className="filters">
      <button
        type="button"
        className={active === ALL_TYPES ? 'tab tab--active' : 'tab'}
        onClick={() => onSelect(ALL_TYPES)}
      >
        All {Object.values(counts).reduce((a, b) => a + b, 0)}
      </button>

      {present.map(type => (
        <button
          key={type}
          type="button"
          className={active === type ? 'tab tab--active' : 'tab'}
          onClick={() => onSelect(type)}
        >
          {CARD_TYPE_LABELS[type]} {counts[type]}
        </button>
      ))}
    </nav>
  );
}

function ErrorNotice({ message }: { message: string | undefined }) {
  if (!message) {
    return null;
  }

  return <p className="notice notice--error">{message}</p>;
}

export function App() {
  const [state, setState] = useState<AdminState | undefined>(undefined);
  const [tab, setTab] = useState<Tab>(Tab.QUEUE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<string>(ALL_TYPES);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      setState(await fetchState());
      setError(undefined);
    } catch (caught) {
      setError(String(caught));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const allCards = useMemo(() => {
    if (!state) {
      return [];
    }

    return tab === Tab.QUEUE ? state.queue : state.feed;
  }, [state, tab]);

  const counts = useMemo(() => {
    const tally: Record<string, number> = {};

    for (const card of allCards) {
      tally[card.type] = (tally[card.type] ?? 0) + 1;
    }

    return tally;
  }, [allCards]);

  // Select-all and the bulk actions operate on what is visible, never on the
  // hidden remainder — otherwise filtering would be actively dangerous.
  const cards = useMemo(
    () =>
      typeFilter === ALL_TYPES
        ? allCards
        : allCards.filter(card => card.type === typeFilter),
    [allCards, typeFilter],
  );

  function toggle(id: string) {
    setSelected(previous => {
      const next = new Set(previous);

      if (!next.delete(id)) {
        next.add(id);
      }

      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(cards.map(card => card.id)));
  }

  async function apply(action: AdminAction) {
    setBusy(true);

    try {
      await runAction(action, [...selected]);

      setSelected(new Set());

      await load();
    } catch (caught) {
      setError(String(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin">
      <header className="admin__head">
        <span className="brand">
          Brain<span className="brand__accent">Snack</span>
        </span>

        <span className="admin__label">admin</span>

        <span className="header__spacer" />

        <button type="button" className="action" onClick={() => void load()}>
          Reload
        </button>
      </header>

      <nav className="tabs">
        <button
          type="button"
          className={tab === Tab.QUEUE ? 'tab tab--active' : 'tab'}
          onClick={() => setTab(Tab.QUEUE)}
        >
          Pending {state?.queue.length ?? 0}
        </button>

        <button
          type="button"
          className={tab === Tab.LIVE ? 'tab tab--active' : 'tab'}
          onClick={() => setTab(Tab.LIVE)}
        >
          Live {state?.feed.length ?? 0}
        </button>

        <span className="header__spacer" />

        <button type="button" className="tab" onClick={selectAll}>
          Select all
        </button>
      </nav>

      <TypeFilter
        active={typeFilter}
        counts={counts}
        onSelect={type => {
          setTypeFilter(type);
          setSelected(new Set());
        }}
      />

      <ErrorNotice message={error} />

      <SelectionBar
        tab={tab}
        count={selected.size}
        busy={busy}
        onApprove={() => void apply(AdminAction.APPROVE)}
        onReject={() => void apply(AdminAction.REJECT)}
        onRemove={() => void apply(AdminAction.REMOVE)}
        onClear={() => setSelected(new Set())}
      />

      <PublishHint count={state?.feed.length ?? 0} />

      <main className="admin__body">
        <CardPane
          cards={cards}
          tab={tab}
          selected={selected}
          onToggle={toggle}
        />
      </main>
    </div>
  );
}
