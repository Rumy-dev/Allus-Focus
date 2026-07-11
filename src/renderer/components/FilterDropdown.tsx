import { useState } from 'react';
import type { CSSProperties } from 'react';
import { ContextMenu } from './ContextMenu';
import type { ContextMenuItem } from './ContextMenu';

export interface FilterDropdownOption {
  value: string;
  label: string;
}

interface FilterDropdownProps {
  value: string;
  options: FilterDropdownOption[];
  placeholderLabel: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  style?: CSSProperties;
}

export function FilterDropdown({ value, options, placeholderLabel, onChange, disabled, style }: FilterDropdownProps) {
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const selectedLabel = value ? options.find((o) => o.value === value)?.label ?? placeholderLabel : placeholderLabel;

  return (
    <>
      <button
        type="button"
        className="allus-no-drag"
        disabled={disabled}
        style={{ ...dropdownButtonStyle, opacity: disabled ? 0.5 : 1, ...style }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setMenuPos({ x: rect.left, y: rect.bottom + 4 });
        }}
      >
        {selectedLabel} ▾
      </button>
      {menuPos && (
        <ContextMenu
          x={menuPos.x}
          y={menuPos.y}
          onClose={() => setMenuPos(null)}
          items={[
            { label: placeholderLabel, onClick: () => onChange('') },
            ...options.map<ContextMenuItem>((o) => ({ label: o.label, onClick: () => onChange(o.value) })),
          ]}
        />
      )}
    </>
  );
}

const dropdownButtonStyle: CSSProperties = {
  minHeight: 30,
  padding: '6px 11px',
  borderRadius: 12,
  border: '1px solid var(--allus-glass-border)',
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--allus-text-primary)',
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: 'nowrap',
  textAlign: 'left',
  maxWidth: 200,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
