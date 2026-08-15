import { useState } from 'react';
import type { AboutInfo } from '../../src/types';
import { LinkedInIcon, StarIcon } from './Icons';

interface AboutPanelProps {
  about: AboutInfo;
  onOpenExternal: (url: string) => void;
  onOpenSettings: () => void;
}

const STARS = [1, 2, 3, 4, 5];

function LinkRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="about__link" onClick={onClick}>
      {label}
    </button>
  );
}

function SocialButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="social"
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      {children}
    </button>
  );
}

function Star({
  position,
  isLit,
  onHover,
  onPick,
}: {
  position: number;
  isLit: boolean;
  onHover: (position: number) => void;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      className={isLit ? 'star star--lit' : 'star'}
      onMouseEnter={() => onHover(position)}
      onFocus={() => onHover(position)}
      onClick={onPick}
      aria-label={`Rate ${position} out of 5`}
    >
      <StarIcon size={20} filled={isLit} />
    </button>
  );
}

/**
 * The Marketplace owns the actual rating, so the stars cannot record a score —
 * they are the invitation, not the input. Filling on hover is what makes that
 * invitation land; a bordered button saying "Rate this extension" reads as a
 * form control and gets ignored.
 */
function RateRow({ onRate }: { onRate: () => void }) {
  const [lit, setLit] = useState(0);

  return (
    <div className="rate">
      <p className="rate__ask">Enjoying BrainSnack?</p>

      <div
        className="rate__stars"
        onMouseLeave={() => setLit(0)}
        onBlur={() => setLit(0)}
      >
        {STARS.map(position => (
          <Star
            key={position}
            position={position}
            isLit={position <= lit}
            onHover={setLit}
            onPick={onRate}
          />
        ))}
      </div>
    </div>
  );
}

export function AboutPanel({
  about,
  onOpenExternal,
  onOpenSettings,
}: AboutPanelProps) {
  return (
    <div className="about">
      <section className="about__block">
        <h2 className="about__heading">Built by</h2>

        <p className="about__name">{about.authorName}</p>

        <SocialButton
          label="Shikhar Gupta on LinkedIn"
          onClick={() => onOpenExternal(about.authorUrl)}
        >
          <LinkedInIcon size={17} />
        </SocialButton>
      </section>

      <section className="about__block">
        <RateRow onRate={() => onOpenExternal(about.reviewUrl)} />
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

      <p className="about__version">BrainSnack {about.version}</p>
    </div>
  );
}
