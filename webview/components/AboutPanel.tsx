import type { AboutInfo } from '../../src/types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Past this, the feed is stale enough that the reader should be told. */
const STALE_AFTER_DAYS = 4;

interface AboutPanelProps {
  about: AboutInfo;
  cardCount: number;
  feedGeneratedAt: string;
  onOpenExternal: (url: string) => void;
  onOpenSettings: () => void;
}

function daysSince(iso: string): number | undefined {
  const then = Date.parse(iso);

  if (Number.isNaN(then)) {
    return undefined;
  }

  return Math.floor((Date.now() - then) / DAY_MS);
}

function freshnessLabel(days: number | undefined): string {
  if (days === undefined) {
    return 'date unknown';
  }

  if (days <= 0) {
    return 'updated today';
  }

  if (days === 1) {
    return 'updated yesterday';
  }

  return `updated ${days} days ago`;
}

/**
 * The failure mode this guards against is silent: generation stops, the feed
 * keeps serving, and month-old "news" reads as current. Saying how old it is
 * turns that into something the reader can see.
 */
function StaleNotice({ days }: { days: number | undefined }) {
  if (days === undefined || days < STALE_AFTER_DAYS) {
    return null;
  }

  return (
    <p className="about__warn">
      This feed has not been updated in {days} days. Anything filed as news is
      probably no longer news.
    </p>
  );
}

function LinkRow({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="about__link" onClick={onClick}>
      {label}
    </button>
  );
}

export function AboutPanel({
  about,
  cardCount,
  feedGeneratedAt,
  onOpenExternal,
  onOpenSettings,
}: AboutPanelProps) {
  const days = daysSince(feedGeneratedAt);

  return (
    <div className="about">
      <section className="about__block">
        <h2 className="about__heading">Built by</h2>

        <p className="about__name">{about.authorName}</p>

        <LinkRow
          label="LinkedIn"
          onClick={() => onOpenExternal(about.authorUrl)}
        />
      </section>

      <section className="about__block">
        <h2 className="about__heading">Feed</h2>

        <p className="about__body">
          {cardCount} cards · {freshnessLabel(days)}
        </p>

        <StaleNotice days={days} />
      </section>

      <section className="about__block">
        <h2 className="about__heading">Project</h2>

        <LinkRow
          label="Source on GitHub"
          onClick={() => onOpenExternal(about.repositoryUrl)}
        />

        <LinkRow
          label="Report an issue"
          onClick={() => onOpenExternal(about.issuesUrl)}
        />

        <LinkRow label="Settings" onClick={onOpenSettings} />
      </section>

      <p className="about__version">Interlude {about.version}</p>
    </div>
  );
}
