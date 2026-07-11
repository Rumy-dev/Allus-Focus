interface BarItem {
  id: string;
  label: string;
  value: number;
}

interface BarChartProps {
  title: string;
  items: BarItem[];
  color: string;
  onItemClick?: (item: BarItem) => void;
}

export function BarChart({ title, items, color, onItemClick }: BarChartProps) {
  const maxValue = Math.max(...items.map((i) => i.value), 1);
  const sorted = [...items].sort((a, b) => b.value - a.value);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 200 }}>
      {title && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--allus-text-muted)' }}>{title}</div>}
      {sorted.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--allus-text-muted)' }}>Sem dados</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {sorted.map((item, index) => {
            const pct = (item.value / maxValue) * 100;
            return (
              <button
                className="allus-menu-item"
                key={item.id}
                onClick={() => onItemClick?.(item)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '24px minmax(0, 1fr) 72px',
                  alignItems: 'center',
                  gap: 10,
                  minHeight: 34,
                  padding: '6px 0',
                  border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.07)',
                  background: 'transparent',
                  color: 'var(--allus-text-primary)',
                  cursor: onItemClick ? 'pointer' : 'default',
                  opacity: onItemClick ? 0.9 : 1,
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  if (!onItemClick) return;
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.background = 'rgba(236,220,1,0.045)';
                }}
                onMouseLeave={(e) => {
                  if (!onItemClick) return;
                  e.currentTarget.style.opacity = '0.9';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 8,
                    display: 'grid',
                    placeItems: 'center',
                    background: index === 0 ? 'rgba(236,220,1,0.18)' : 'rgba(255,255,255,0.06)',
                    color: index === 0 ? 'var(--allus-yellow)' : 'var(--allus-text-muted)',
                    fontSize: 10,
                    fontWeight: 800,
                  }}
                >
                  {index + 1}
                </span>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 5,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: 12,
                      color: 'var(--allus-text-primary)',
                      fontWeight: 700,
                    }}
                  >
                    {item.label}
                  </span>
                  <div
                    style={{
                      width: '100%',
                      height: 4,
                      background: 'rgba(236,220,1,0.10)',
                      borderRadius: 999,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: color,
                        borderRadius: 999,
                      }}
                    />
                  </div>
                </div>
                <span
                  style={{
                    textAlign: 'right',
                    fontSize: 11,
                    color: 'var(--allus-yellow)',
                    fontFamily: 'var(--allus-font-mono)',
                    fontWeight: 700,
                  }}
                >
                  {formatTime(item.value)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m`;
}
