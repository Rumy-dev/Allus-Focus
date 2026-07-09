import { useState } from 'react';
import { useAppState } from '../../useAppState';
import { formatDuration } from '../../../shared/types';
import { useKeyboardShortcuts } from '../../useKeyboardShortcuts';
import { invokeAction } from '../../invoke';
import { ToastHost } from '../../components/ToastHost';

export function FloatingPanel() {
  const snapshot = useAppState();
  const [showAdd, setShowAdd] = useState(false);
  const [text, setText] = useState('');

  useKeyboardShortcuts({
    onPlayPause: () => invokeAction('timer:playPause', undefined),
    onEscape: () => setShowAdd(false),
  });

  if (!snapshot) return <div className="allus-app-bg" style={{ height: '100%' }} />;

  const session = snapshot.activeSession;
  const remaining = session ? Math.max(0, session.plannedSeconds - session.elapsedSeconds) : 0;
  const activeLog = session ? snapshot.activeTaskLogs.find((l) => l.id === session.activeTaskLogId) : null;
  const label = activeLog?.taskTitle ?? (session?.cycleKind === 'Pausa' ? 'Pausa' : 'Nenhuma tarefa em foco');
  const skipLabel = session?.cycleKind === 'Pausa' ? '⏭ foco' : '⏭ pausa';

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    await invokeAction('task:quickAdd', { title: text.trim(), avulsa: false });
    setText('');
    setShowAdd(false);
  }

  return (
    <div
      className="allus-glass allus-titlebar"
      style={{ height: '100%', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <div className="allus-no-drag" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontFamily: 'var(--allus-font-mono)', fontSize: 22, fontWeight: 700, flex: 1 }}>
          {formatDuration(remaining)}
        </div>
        {!snapshot.online && (
          <span title="Sem conexão" style={{ color: 'var(--allus-status-interrompido)', fontSize: 10 }}>
            ●
          </span>
        )}
        <button style={iconBtn} onClick={() => invokeAction('timer:playPause', undefined)} title="Espaço">
          {session?.status === 'Ativo' ? '⏸' : '▶'}
        </button>
        <button style={iconBtn} onClick={() => invokeAction('timer:stop', undefined)}>
          ⏹
        </button>
        <button
          style={iconBtn}
          onClick={() =>
            session?.cycleKind === 'Pausa'
              ? invokeAction('timer:skipToFocus', undefined)
              : invokeAction('timer:skipToBreak', undefined)
          }
          title={skipLabel}
        >
          ⏭
        </button>
        <button style={iconBtn} onClick={() => setShowAdd((v) => !v)}>
          +
        </button>
        <button
          style={iconBtn}
          title="Abrir janela principal (histórico, tarefas, relatórios)"
          onClick={() => window.allus.invoke('window:openMain', undefined)}
        >
          ⤢
        </button>
      </div>

      <div className="allus-no-drag" style={{ fontSize: 11, color: 'var(--allus-text-secondary)' }}>
        {label}
      </div>

      {showAdd && (
        <form className="allus-no-drag" onSubmit={submitAdd} style={{ display: 'flex', gap: 6 }}>
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Nova tarefa..."
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--allus-glass-border)',
              borderRadius: 8,
              padding: '4px 8px',
              color: 'var(--allus-text-primary)',
              fontSize: 12,
            }}
          />
        </form>
      )}

      <div className="allus-no-drag" style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
        {snapshot.recentTasks.map((t) => (
          <button
            key={t.id}
            style={{ ...iconBtn, width: 'auto', padding: '4px 8px', fontSize: 11 }}
            onClick={() => invokeAction('task:focus', { taskId: t.taskId, subtaskId: null, title: t.taskTitle })}
          >
            {t.taskTitle}
          </button>
        ))}
      </div>
      <ToastHost />
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 8,
  border: '1px solid var(--allus-glass-border)',
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--allus-text-primary)',
  fontSize: 13,
};
