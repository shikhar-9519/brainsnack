import { CardType, TRACK_LABELS, Track } from '../../src/types';

const FULL_SET: Track[] = [
  Track.FRONTEND,
  Track.NODE,
  Track.PYTHON,
  Track.JAVA,
  Track.GO,
  Track.SYSTEM_DESIGN,
  Track.MISC,
];

/**
 * Which tracks are meaningful per card type. Output questions omit
 * `system_design` and `misc` because a runnable snippet is always in some
 * specific language; news and blogs have no track at all.
 */
const TRACKS_BY_TYPE: Partial<Record<CardType, Track[]>> = {
  [CardType.LEARN]: FULL_SET,
  [CardType.OUTPUT_QUESTION]: [
    Track.FRONTEND,
    Track.NODE,
    Track.PYTHON,
    Track.JAVA,
    Track.GO,
  ],
};

interface TrackBarProps {
  activeTab: string;
  tracks: Track[];
  onChange: (tracks: Track[]) => void;
}

interface TrackChipProps {
  track: Track;
  isActive: boolean;
  onToggle: (track: Track) => void;
}

function TrackChip({ track, isActive, onToggle }: TrackChipProps) {
  return (
    <button
      type="button"
      className={isActive ? 'track track--active' : 'track'}
      onClick={() => onToggle(track)}
      aria-pressed={isActive}
    >
      {TRACK_LABELS[track]}
    </button>
  );
}

export function TrackBar({ activeTab, tracks, onChange }: TrackBarProps) {
  const available = TRACKS_BY_TYPE[activeTab as CardType];

  if (!available) {
    return null;
  }

  const selected = new Set(tracks);

  function toggle(track: Track) {
    const next = new Set(selected);

    if (!next.delete(track)) {
      next.add(track);
    }

    // Never let the user filter themselves into an empty feed with no way out.
    const remaining = available!.filter(candidate => next.has(candidate));

    if (remaining.length === 0) {
      onChange([...new Set([...tracks, ...available!])]);
      return;
    }

    onChange([...next]);
  }

  return (
    <nav className="tracks" aria-label="Technology filter">
      {available.map(track => (
        <TrackChip
          key={track}
          track={track}
          isActive={selected.has(track)}
          onToggle={toggle}
        />
      ))}
    </nav>
  );
}
