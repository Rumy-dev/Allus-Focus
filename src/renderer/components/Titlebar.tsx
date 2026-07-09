interface TitlebarProps {
  title: string;
  subtitle?: string;
  onClose?: () => void;
  closeLabel?: string;
}

export function Titlebar({ title, subtitle, onClose, closeLabel = '✕' }: TitlebarProps) {
  return (
    <div
      className="allus-titlebar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        gap: 12,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, letterSpacing: 1, color: 'var(--allus-text-secondary)' }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 11, color: 'var(--allus-text-muted)', marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
      <div className="allus-no-drag" style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => window.allus.invoke('window:minimizeSelf', undefined)}
          style={iconButtonStyle}
          title="Minimizar"
        >
          –
        </button>
        <button
          onClick={onClose ?? (() => window.allus.invoke('window:closeSelf', undefined))}
          style={closeButtonStyle}
          title="Fechar (o Allus Clock continua rodando no painel flutuante e na bandeja)"
        >
          {closeLabel}
        </button>
      </div>
    </div>
  );
}

const iconButtonStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.12)',
  border: '1px solid var(--allus-glass-border)',
  borderRadius: 8,
  width: 30,
  height: 30,
  color: 'var(--allus-text-primary)',
  fontSize: 15,
  lineHeight: 1,
};

const closeButtonStyle: React.CSSProperties = {
  ...iconButtonStyle,
  background: 'rgba(255, 107, 107, 0.18)',
  border: '1px solid rgba(255, 107, 107, 0.4)',
  fontSize: 13,
};
