/**
 * Shown until the first payload lands. Without it the feed renders its empty
 * state during the fetch, which tells the reader they are caught up at the one
 * moment nothing is known yet.
 *
 * Card-shaped rather than a spinner: the placeholder occupies the space the
 * cards will occupy, so arrival is a fill rather than a jump.
 */

const PLACEHOLDER_CARDS = [0, 1, 2];

function SkeletonCard() {
  return (
    <div className="card skeleton">
      <span className="skeleton__line skeleton__line--meta" />

      <span className="skeleton__line skeleton__line--title" />

      <span className="skeleton__line" />

      <span className="skeleton__line skeleton__line--short" />
    </div>
  );
}

export function FeedSkeleton() {
  return (
    <div className="list" role="status" aria-label="Loading cards">
      {PLACEHOLDER_CARDS.map(index => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}
