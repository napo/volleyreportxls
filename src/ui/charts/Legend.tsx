/** HTML legend above a chart: wraps on narrow screens; the key mirrors the mark (box for bars, stroke for lines). */
export function Legend({ items, mark }: { items: readonly { label: string; color: string }[]; mark: 'bar' | 'line' }) {
  return (
    <ul className="vr-legend">
      {items.map((item) => (
        <li key={item.label}>
          <span className={`vr-legend-key ${mark}`} style={{ background: item.color }} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
