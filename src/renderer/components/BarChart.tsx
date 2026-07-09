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
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--allus-text-muted)' }}>{title}</div>
      {sorted.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--allus-text-muted)' }}>Sem dados</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sorted.map((item) => {
            const pct = (item.value / maxValue) * 100;
            return (
              <div
                key={item.id}
                onClick={() => onItemClick?.(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: onItemClick ? 'pointer' : 'default',
                  opacity: onItemClick ? 0.9 : 1,
                }}
                onMouseEnter={(e) => {
                  if (onItemClick) (e.currentTarget.style.opacity = '1');
                }}
                onMouseLeave={(e) => {
                  if (onItemClick) (e.currentTarget.style.opacity = '0.9');
                }}
              >
                <div
                  style={{
                    flex: 1,
                    position: 'relative',
                    height: 24,
                    background: 'transparent',
                    borderRadius: 4,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      height: '100%',
                      width: `${pct}%`,
                      background: color,
                      borderRadius: '0px 4px 4px 0px',
                    }}
                  />
                </div>
                <div
                  style={{
                    minWidth: 120,
                    textAlign: 'right',
                    fontSize: 12,
                    color: 'var(--allus-text-primary)',
                  }}
                >
                  <div>{item.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--allus-text-muted)' }}>{formatTime(item.value)}</div>
                </div>
              </div>
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
