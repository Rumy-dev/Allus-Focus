import allusFocusIcon from '../assets/allus-focus-icon.svg';

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
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '12px 16px',
        gap: 12,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minWidth: 0,
          maxWidth: 'calc(100% - 120px)',
        }}
      >
        <img src={allusFocusIcon} alt="" style={{ width: 26, height: 26, flexShrink: 0, opacity: 0.9 }} />
        <div style={{ minWidth: 0, textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1.2, color: 'var(--allus-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 11, color: 'var(--allus-text-muted)', marginTop: 2 }}>{subtitle}</div>
          )}
        </div>
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
          title="Fechar (o Allus Focus continua rodando no painel flutuante e na bandeja)"
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
