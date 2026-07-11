import type { SessionDateFilter } from '../../shared/types';

const FILTERS: SessionDateFilter[] = ['Todas', 'Hoje', 'Ontem', 'Mês', '7 dias'];

interface DateFilterBarProps {
  value: SessionDateFilter;
  onChange: (value: SessionDateFilter) => void;
}

export function DateFilterBar({ value, onChange }: DateFilterBarProps) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {FILTERS.map((f) => {
        const active = value === f;
        return (
          <button
            key={f}
            onClick={() => onChange(f)}
            style={{
              ...pillButtonStyle,
              ...(active ? activePillStyle : null),
            }}
          >
            {f}
          </button>
        );
      })}
    </div>
  );
}

const pillButtonStyle: React.CSSProperties = {
  minHeight: 30,
  padding: '6px 14px',
  borderRadius: 12,
  border: '1px solid rgba(236, 220, 1, 0.22)',
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--allus-text-primary)',
  fontSize: 12,
  fontWeight: 650,
  whiteSpace: 'nowrap',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 6px 14px rgba(0,0,0,0.16)',
};

const activePillStyle: React.CSSProperties = {
  backgroundImage: 'var(--allus-gradient)',
  borderColor: 'rgba(236, 220, 1, 0.72)',
  color: '#000001',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.28), 0 8px 18px rgba(236, 220, 1, 0.14)',
};
