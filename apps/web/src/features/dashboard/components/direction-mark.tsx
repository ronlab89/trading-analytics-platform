interface DirectionMarkProps {
  percent: number;
}

/** The ▲ or ▼ that goes with a signed figure, so a gain or a loss is not told by color alone. */
export function DirectionMark({ percent }: DirectionMarkProps) {
  if (percent === 0) return null;
  return <span aria-hidden="true">{percent > 0 ? "▲" : "▼"}</span>;
}
