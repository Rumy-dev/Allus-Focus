import { useState } from 'react';

interface TrendPoint {
  date: string;
  totalSeconds: number;
}

interface TrendChartProps {
  title: string;
  data: TrendPoint[];
  color: string;
}

export function TrendChart({ title, data, color }: TrendChartProps) {
  const [showTable, setShowTable] = useState(false);

  if (data.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 200 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--allus-text-muted)' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--allus-text-muted)' }}>Sem dados</div>
      </div>
    );
  }

  const maxValue = Math.max(...data.map((p) => p.totalSeconds), 1);
  const height = 140;
  const width = Math.max(data.length * 30, 300);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--allus-text-muted)' }}>{title}</div>
        <button
          onClick={() => setShowTable(!showTable)}
          style={{
            fontSize: 11,
            border: 'none',
            background: 'transparent',
            color: color,
            cursor: 'pointer',
          }}
        >
          {showTable ? 'Gráfico' : 'Tabela'}
        </button>
      </div>

      {showTable ? (
        <div style={{ maxHeight: 200, overflowY: 'auto', fontSize: 11 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--allus-glass-border)' }}>
                <th style={{ textAlign: 'left', padding: 4 }}>Data</th>
                <th style={{ textAlign: 'right', padding: 4 }}>Horas</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.date} style={{ borderBottom: '1px solid var(--allus-glass-border)' }}>
                  <td style={{ padding: 4 }}>{new Date(p.date).toLocaleDateString('pt-BR')}</td>
                  <td style={{ textAlign: 'right', padding: 4 }}>{formatTime(p.totalSeconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <svg width={width} height={height} style={{ border: '1px solid var(--allus-glass-border)', borderRadius: 8 }}>
          {/* Linha de tendência simples (área sob a linha) */}
          <defs>
            <linearGradient id="trendGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Pontos de dados com linha conectando */}
          {data.map((p, i) => {
            const x = 20 + (i / (data.length - 1 || 1)) * (width - 40);
            const y = height - 20 - (p.totalSeconds / maxValue) * (height - 40);
            return (
              <circle key={p.date} cx={x} cy={y} r="3" fill={color} opacity="0.8" />
            );
          })}

          {/* Linha conectando os pontos */}
          {data.length > 1 && (
            <polyline
              points={data.map((p, i) => {
                const x = 20 + (i / (data.length - 1)) * (width - 40);
                const y = height - 20 - (p.totalSeconds / maxValue) * (height - 40);
                return `${x},${y}`;
              }).join(' ')}
              fill="none"
              stroke={color}
              strokeWidth="2"
              opacity="0.7"
            />
          )}

          {/* Área abaixo da linha */}
          {data.length > 1 && (
            <polygon
              points={
                `20,${height - 20}` +
                data.map((p, i) => {
                  const x = 20 + (i / (data.length - 1)) * (width - 40);
                  const y = height - 20 - (p.totalSeconds / maxValue) * (height - 40);
                  return ` ${x},${y}`;
                }).join('') +
                ` ${width - 20},${height - 20}`
              }
              fill="url(#trendGradient)"
            />
          )}
        </svg>
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
