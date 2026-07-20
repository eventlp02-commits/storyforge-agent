type ShotTiming = { id: string; start: number; end: number };

type TimingIssue = {
  from: number;
  to: number;
  afterShotId?: string;
};

export type TimelineResult = {
  valid: boolean;
  totalDuration: number;
  targetDuration: number;
  difference: number;
  gaps: TimingIssue[];
  overlaps: TimingIssue[];
};

export function calculateTimeline(shots: ShotTiming[], targetDuration: number, tolerance = 0.05): TimelineResult {
  const ordered = [...shots].sort((a, b) => a.start - b.start);
  const gaps: TimingIssue[] = [];
  const overlaps: TimingIssue[] = [];
  let cursor = 0;

  for (const shot of ordered) {
    if (shot.end <= shot.start) {
      overlaps.push({ from: shot.start, to: shot.end, afterShotId: shot.id });
      continue;
    }
    if (shot.start > cursor + tolerance) {
      gaps.push({ from: cursor, to: shot.start, afterShotId: shot.id });
    } else if (shot.start < cursor - tolerance) {
      overlaps.push({ from: shot.start, to: cursor, afterShotId: shot.id });
    }
    cursor = Math.max(cursor, shot.end);
  }

  if (cursor < targetDuration - tolerance) {
    gaps.push({ from: cursor, to: targetDuration });
  } else if (cursor > targetDuration + tolerance) {
    overlaps.push({ from: targetDuration, to: cursor });
  }

  const roundedTotal = Math.round(cursor * 1000) / 1000;
  const difference = Math.round((roundedTotal - targetDuration) * 1000) / 1000;
  return {
    valid: gaps.length === 0 && overlaps.length === 0 && Math.abs(difference) <= tolerance,
    totalDuration: roundedTotal,
    targetDuration,
    difference,
    gaps,
    overlaps,
  };
}
