interface RemovalNoticeProps {
  secondsLeft?: number;
  totalSeconds: number;
}

/**
 * A card vanishing with no warning reads as a bug, so the countdown is always
 * visible and always names the way out.
 */
export function RemovalNotice({
  secondsLeft,
  totalSeconds,
}: RemovalNoticeProps) {
  if (secondsLeft === undefined) {
    return null;
  }

  const remaining = Math.max(0, Math.min(1, secondsLeft / totalSeconds));

  return (
    <div className="removal" role="status">
      <div className="removal__track">
        <div
          className="removal__fill"
          style={{ width: `${remaining * 100}%` }}
        />
      </div>

      <span className="removal__label">
        Clearing in {secondsLeft}s — Save to keep it
      </span>
    </div>
  );
}
