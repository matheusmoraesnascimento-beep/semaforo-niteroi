import { formatClock, formatDistance, formatDuration, formatSpeed } from './format';

interface Props {
  remainingS: number;
  remainingM: number;
  speed: number | null;
  onStop(): void;
}

export function NavFooter({ remainingS, remainingM, speed, onStop }: Props) {
  const eta = new Date(Date.now() + remainingS * 1000);
  return (
    <>
      <div className="speed-bubble">
        <div className="speed-value">{formatSpeed(speed)}</div>
        <div className="speed-unit">km/h</div>
      </div>
      <div className="nav-footer">
        <button className="nav-stop" onClick={onStop} aria-label="Encerrar navegação">✕</button>
        <div className="nav-eta">
          <div className="nav-time">{formatDuration(remainingS)}</div>
          <div className="nav-sub">{formatDistance(remainingM)} • {formatClock(eta)}</div>
        </div>
      </div>
    </>
  );
}
