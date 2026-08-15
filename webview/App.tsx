import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AgentState,
  ALL_CARD_TYPES,
  ALL_TRACKS,
  CardType,
  InboundMessage,
  OutboundMessage,
  Surface,
} from '../src/types';
// CardType is imported above as a value; that import carries the type too.
import type {
  AboutInfo,
  Card,
  Track,
  WebviewInitPayload,
} from '../src/types';
import { AboutPanel } from './components/AboutPanel';
import { FeedSkeleton } from './components/FeedSkeleton';
import { AgentBanner } from './components/AgentBanner';
import { CardList } from './components/CardList';
import { EmptyState } from './components/EmptyState';
import { Header } from './components/Header';
import { TabBar, SAVED_TAB, ALL_TAB } from './components/TabBar';
import { TrackBar } from './components/TrackBar';
import { persist, restore, send } from './vscodeApi';
import type { PersistedState } from './vscodeApi';

const TICK_MS = 250;

/** The host stamps this on <body> when it builds the HTML. */
function currentSurface(): Surface {
  return document.body.dataset.surface === Surface.FOCUS
    ? Surface.FOCUS
    : Surface.SIDEBAR;
}

interface HostMessage {
  type: string;
  payload: unknown;
}

function filterCards(
  cards: Card[],
  activeTab: string,
  savedIds: Set<string>,
): Card[] {
  if (activeTab === SAVED_TAB) {
    return cards.filter(card => savedIds.has(card.id));
  }

  if (activeTab === ALL_TAB) {
    return cards;
  }

  return cards.filter(card => card.type === activeTab);
}

function withoutKeys(
  source: Record<string, number>,
  keys: string[],
): Record<string, number> {
  const next = { ...source };

  for (const key of keys) {
    delete next[key];
  }

  return next;
}

interface FeedBodyProps {
  showingAbout: boolean;
  about: AboutInfo | undefined;
  onOpenExternal: (url: string) => void;
  onOpenSettings: () => void;
  children: React.ReactNode;
}

/**
 * "Nothing here" and "nothing yet" look identical to a reader, so the empty
 * state has to wait until there is actually an answer to give.
 */
function LoadingGate({
  hasLoaded,
  children,
}: {
  hasLoaded: boolean;
  children: React.ReactNode;
}) {
  if (!hasLoaded) {
    return <FeedSkeleton />;
  }

  return <>{children}</>;
}

/** About replaces the feed rather than stacking on top of it. */
function FeedBody({
  showingAbout,
  about,
  onOpenExternal,
  onOpenSettings,
  children,
}: FeedBodyProps) {
  if (!showingAbout || !about) {
    return <>{children}</>;
  }

  return (
    <div className="scroll">
      <AboutPanel
        about={about}
        onOpenExternal={onOpenExternal}
        onOpenSettings={onOpenSettings}
      />
    </div>
  );
}

export function App() {
  const saved = restore<PersistedState>();

  const [cards, setCards] = useState<Card[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [interests, setInterests] = useState<CardType[]>(
    saved?.interests ?? [...ALL_CARD_TYPES],
  );
  const [tracks, setTracks] = useState<Track[]>([...ALL_TRACKS]);
  const [about, setAbout] = useState<AboutInfo | undefined>(undefined);
  const [showingAbout, setShowingAbout] = useState(false);
  const [removeAfterSeconds, setRemoveAfterSeconds] = useState(10);
  const [agentState, setAgentState] = useState<AgentState>(AgentState.IDLE);
  const [activeTab, setActiveTab] = useState<string>(saved?.activeTab ?? ALL_TAB);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(
    new Set(saved?.revealedIds ?? []),
  );

  // id -> timestamp at which the answered card disappears unless it is saved.
  const [deadlines, setDeadlines] = useState<Record<string, number>>({});
  const [tick, setTick] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);

  const applyInit = useCallback((payload: WebviewInitPayload) => {
    setCards(payload.cards);
    setHasLoaded(true);
    setSavedIds(new Set(payload.savedIds));
    setReadIds(new Set(payload.readIds));
    setInterests(payload.interests);
    setTracks(payload.tracks);
    setAbout(payload.about);
    setRemoveAfterSeconds(payload.removeAfterSeconds);
    setAgentState(payload.agentState);
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent<HostMessage>) {
      const { type, payload } = event.data;

      if (type === OutboundMessage.INIT) {
        applyInit(payload as WebviewInitPayload);
        return;
      }

      if (type === OutboundMessage.AGENT_STATE) {
        setAgentState(payload as AgentState);
        return;
      }

      if (type === OutboundMessage.SAVED_CHANGED) {
        setSavedIds(new Set(payload as string[]));
      }
    }

    window.addEventListener('message', onMessage);

    send(InboundMessage.READY);

    return () => window.removeEventListener('message', onMessage);
  }, [applyInit]);

  const hasPending = Object.keys(deadlines).length > 0;

  // Only runs while something is actually counting down.
  useEffect(() => {
    if (!hasPending) {
      return;
    }

    const timer = setInterval(() => setTick(value => value + 1), TICK_MS);

    return () => clearInterval(timer);
  }, [hasPending]);

  // Idempotent: recomputes expiry from timestamps rather than decrementing, so
  // a dropped tick or a backgrounded webview cannot leave a card stranded.
  useEffect(() => {
    const now = Date.now();

    const expired = Object.keys(deadlines).filter(id => deadlines[id] <= now);

    if (expired.length === 0) {
      return;
    }

    setCards(previous => previous.filter(card => !expired.includes(card.id)));
    setDeadlines(previous => withoutKeys(previous, expired));

    for (const id of expired) {
      send(InboundMessage.DISMISS, { id });
    }
  }, [tick, deadlines]);

  // Hold the reader's place: the panel is disposed and recreated often, and
  // losing scroll position mid-card is the whole failure mode this avoids.
  useEffect(() => {
    const node = scrollRef.current;

    if (!node) {
      return;
    }

    node.scrollTop = saved?.scrollTop ?? 0;
    // Restoring once on mount is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.length]);

  useEffect(() => {
    persist({
      activeTab,
      scrollTop: scrollRef.current?.scrollTop ?? 0,
      revealedIds: [...revealedIds],
      interests,
    } satisfies PersistedState);
  }, [activeTab, revealedIds, interests, cards]);

  const visibleCards = useMemo(
    () => filterCards(cards, activeTab, savedIds),
    [cards, activeTab, savedIds],
  );

  const secondsLeft = useMemo(() => {
    const now = Date.now();

    const entries = Object.entries(deadlines).map(([id, at]) => [
      id,
      Math.max(0, Math.ceil((at - now) / 1000)),
    ]);

    return Object.fromEntries(entries) as Record<string, number>;
    // `tick` is the clock this derives from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadlines, tick]);

  function cancelRemoval(id: string) {
    setDeadlines(previous => withoutKeys(previous, [id]));
  }

  function handleToggleSave(id: string) {
    setSavedIds(previous => {
      const next = new Set(previous);

      if (!next.delete(id)) {
        next.add(id);
      }

      return next;
    });

    cancelRemoval(id);

    send(InboundMessage.TOGGLE_SAVE, { id });
  }

  function handleDismiss(id: string) {
    setCards(previous => previous.filter(card => card.id !== id));

    cancelRemoval(id);

    send(InboundMessage.DISMISS, { id });
  }

  function handleMarkRead(id: string) {
    setReadIds(previous => new Set(previous).add(id));

    send(InboundMessage.MARK_READ, { id });
  }

  function handleOpen(url: string, id: string) {
    handleMarkRead(id);

    send(InboundMessage.OPEN_EXTERNAL, { url });
  }

  /**
   * Only output questions clear themselves. Once you have seen the answer key
   * there is nothing left in the card, whereas an interview answer is worth
   * re-reading — so revealing one marks it read and leaves it alone.
   */
  function handleReveal(id: string) {
    setRevealedIds(previous => new Set(previous).add(id));

    handleMarkRead(id);

    const card = cards.find(candidate => candidate.id === id);

    if (card?.type !== CardType.OUTPUT_QUESTION) {
      return;
    }

    if (removeAfterSeconds <= 0 || savedIds.has(id)) {
      return;
    }

    setDeadlines(previous => ({
      ...previous,
      [id]: Date.now() + removeAfterSeconds * 1000,
    }));
  }

  function handleOpenExternal(url: string) {
    send(InboundMessage.OPEN_EXTERNAL, { url });
  }

  function handleTracksChange(next: Track[]) {
    setTracks(next);

    send(InboundMessage.SET_TRACKS, { tracks: next });
  }

  function handleScroll() {
    persist({
      activeTab,
      scrollTop: scrollRef.current?.scrollTop ?? 0,
      revealedIds: [...revealedIds],
      interests,
    } satisfies PersistedState);
  }

  return (
    <div className="app">
      <Header
        surface={currentSurface()}
        showingAbout={showingAbout}
        onOpenFocus={() => send(InboundMessage.OPEN_FOCUS)}
        onRefresh={() => send(InboundMessage.REFRESH)}
        onToggleAbout={() => setShowingAbout(value => !value)}
      />

      <FeedBody
        showingAbout={showingAbout}
        about={about}
        onOpenExternal={handleOpenExternal}
        onOpenSettings={() => send(InboundMessage.OPEN_SETTINGS)}
      >
      <AgentBanner state={agentState} />

      <TabBar
        interests={interests}
        activeTab={activeTab}
        onSelect={setActiveTab}
      />

      <TrackBar
        activeTab={activeTab}
        tracks={tracks}
        onChange={handleTracksChange}
      />

      <div className="scroll" ref={scrollRef} onScroll={handleScroll}>
        <LoadingGate hasLoaded={hasLoaded}>
          <EmptyState
            count={visibleCards.length}
            activeTab={activeTab}
            isNarrowed={tracks.length < ALL_TRACKS.length}
          />

          <CardList
            cards={visibleCards}
            savedIds={savedIds}
            readIds={readIds}
            revealedIds={revealedIds}
            secondsLeft={secondsLeft}
            totalSeconds={removeAfterSeconds}
            onToggleSave={handleToggleSave}
            onDismiss={handleDismiss}
            onOpen={handleOpen}
            onReveal={handleReveal}
          />
        </LoadingGate>
        </div>
      </FeedBody>
    </div>
  );
}
