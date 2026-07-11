import { useState, useEffect, useRef } from 'react';
import { useAppState } from '../../useAppState';
import { displayPath, formatDuration } from '../../../shared/types';
import { useKeyboardShortcuts } from '../../useKeyboardShortcuts';
import { invokeAction } from '../../invoke';
import { ToastHost } from '../../components/ToastHost';
import { TaskSuggestions } from '../../components/TaskSuggestions';
import { TaskModeSelector } from '../../components/TaskModeSelector';
import { ProjectPicker } from '../../components/ProjectPicker';

export function FloatingPanel() {
  const snapshot = useAppState();
  const [showAdd, setShowAdd] = useState(false);
  const [text, setText] = useState('');
  const [modeSelectTask, setModeSelectTask] = useState<{ taskId: string | null; title: string } | null>(null);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [myHoursSeconds, setMyHoursSeconds] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMini, setIsMini] = useState(true);
  const didSyncExpandedRef = useRef(false);
  const didSyncMiniRef = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const modalCardRef = useRef<HTMLDivElement>(null);
  const projectPickerRef = useRef<HTMLDivElement>(null);
  const quickAddWrapRef = useRef<HTMLDivElement>(null);
  const lastSizeRef = useRef<{ width: number; height: number } | null>(null);

  const panelOpacity = (snapshot?.floatingPanelOpacity ?? 90) / 100;

  // Sincroniza o estado expandido/recolhido com a preferência salva, uma
  // única vez ao carregar (depois disso, o toggle local manda).
  useEffect(() => {
    if (didSyncExpandedRef.current) return;
    if (snapshot?.floatingPanelExpanded === undefined) return;
    didSyncExpandedRef.current = true;
    setIsExpanded(snapshot.floatingPanelExpanded);
  }, [snapshot?.floatingPanelExpanded]);

  function toggleExpanded() {
    const next = !isExpanded;
    setIsExpanded(next);
    invokeAction('prefs:setFloatingPanelExpanded', { expanded: next });
  }

  // Sincroniza o modo mini/completo com a preferência salva, uma única vez
  // ao carregar (depois disso, o toggle local manda).
  useEffect(() => {
    if (didSyncMiniRef.current) return;
    if (snapshot?.floatingPanelIsCompactMode === undefined) return;
    didSyncMiniRef.current = true;
    setIsMini(snapshot.floatingPanelIsCompactMode);
  }, [snapshot?.floatingPanelIsCompactMode]);

  function toggleMini() {
    const next = !isMini;
    setIsMini(next);
    invokeAction('prefs:setFloatingPanelIsCompactMode', { compact: next });
  }

  useKeyboardShortcuts({
    onPlayPause: () => invokeAction('timer:playPause', undefined),
    onEscape: () => {
      // Fechar modal primeiro, se estiver aberto
      if (modeSelectTask) {
        setModeSelectTask(null);
      } else if (showProjectPicker) {
        setShowProjectPicker(false);
      } else if (showAdd) {
        setShowAdd(false);
      } else {
        // Se nenhum modal aberto, fechar o painel
        window.allus.invoke('window:closeSelf', undefined);
      }
    },
  });

  const session = snapshot?.activeSession ?? null;
  const activeLog = session ? snapshot?.activeTaskLogs.find((l) => l.id === session.activeTaskLogId) ?? null : null;

  // Auto-fit apenas quando há modal/overlay aberto. Caso contrário, respeita
  // o tamanho que o usuário pode ter definido manualmente.
  useEffect(() => {
    const measure = () => {
      // Quando há modal/overlay, força o tamanho para o modal
      if (modeSelectTask) {
        const el = modalCardRef.current;
        if (!el) return;
        const width = el.offsetWidth + 48;
        const height = Math.min(el.offsetHeight + 48, window.screen.availHeight * 0.85);
        applySize(width, height);
        return;
      }

      if (showProjectPicker) {
        const el = projectPickerRef.current;
        if (!el) return;
        const width = el.offsetWidth + 48;
        const height = Math.min(el.offsetHeight + 48, window.screen.availHeight * 0.85);
        applySize(width, height);
        return;
      }

      // Sem modal: tamanho segue o conteúdo real do painel (mini, recolhido
      // ou expandido — a altura varia conforme o modo e as 0-3 últimas
      // tarefas). Se o usuário já redimensionou manualmente ESSE modo
      // específico (mini/expandido têm slots de tamanho separados), respeita
      // o tamanho customizado.
      const savedModeSize = isMini ? snapshot?.floatingPanelCompactSize : snapshot?.floatingPanelSize;
      if (savedModeSize !== null && savedModeSize !== undefined) {
        applySize(savedModeSize.width, savedModeSize.height);
        return;
      }
      const el = contentRef.current;
      if (!el) return;
      const width = isMini ? 260 : 300;
      const height = Math.min(el.scrollHeight + (isMini ? 24 : 48), window.screen.availHeight * 0.85);
      applySize(width, height);
    };

    function applySize(width: number, height: number) {
      // Apenas aplicar se o modal realmente precisa de um tamanho diferente
      const next = { width: Math.round(width), height: Math.round(height) };
      const last = lastSizeRef.current;
      if (last && last.width === next.width && last.height === next.height) return;
      lastSizeRef.current = next;
      invokeAction('window:setFloatingHeight', next);
    }

    const observed = [modalCardRef.current, projectPickerRef.current].filter(
      (el): el is HTMLDivElement => el !== null,
    );
    if (observed.length === 0) {
      // Sem modais: acompanha o crescimento/encolhimento do conteúdo do
      // painel (compacto ou expandido), a menos que o usuário já tenha
      // redimensionado manualmente esse modo específico.
      const savedModeSizeGuard = isMini ? snapshot?.floatingPanelCompactSize : snapshot?.floatingPanelSize;
      if (savedModeSizeGuard !== null && savedModeSizeGuard !== undefined) {
        applySize(savedModeSizeGuard.width, savedModeSizeGuard.height);
        return;
      }
      const el = contentRef.current;
      if (!el) {
        measure();
        return;
      }
      const observer = new ResizeObserver(measure);
      observer.observe(el);
      measure();
      return () => observer.disconnect();
    }
    const observer = new ResizeObserver(measure);
    observed.forEach((el) => observer.observe(el));
    measure();
    return () => observer.disconnect();
    // floatingPanelSize é lido só pra decisão de "primeira medição" no ramo
    // colapsado/sem-modal — não deve disparar o efeito de novo sozinho, senão
    // qualquer resize (inclusive o auto-fit programático abaixo) re-executa
    // esse efeito e cria um vaivém de resizes que aparenta tremor.
  }, [modeSelectTask, showProjectPicker, isExpanded, isMini]);

  useEffect(() => {
    if (!snapshot?.auth.profile) return;
    let cancelled = false;
    invokeAction('report:query', { range: { filter: '7 dias' } }).then((result) => {
      if (cancelled || !result) return;
      const me = result.people.find((p) => p.userId === snapshot.auth.profile!.id);
      const seconds = me ? me.clients.reduce((sum, c) => sum + c.totalSeconds, 0) : 0;
      setMyHoursSeconds(seconds);
    });
    return () => {
      cancelled = true;
    };
  }, [snapshot?.auth.profile?.id]);

  if (!snapshot) return <div className="allus-app-bg" style={{ height: '100%' }} />;

  const lastTask = snapshot.recentTasks[0]
    ? { taskId: snapshot.recentTasks[0].taskId, title: snapshot.recentTasks[0].taskTitle }
    : null;

  // Últimas 3 tarefas trabalhadas, excluindo a que já está em foco agora
  // (não faz sentido oferecer "retomar" a própria tarefa ativa).
  const switchableRecentTasks = snapshot.recentTasks.filter((t) => t.taskId !== activeLog?.taskId).slice(0, 3);
  // No HUD compacto, a tarefa ativa já ocupa a 1ª posição da lista (destacada),
  // então só sobram 2 vagas pras recentes, pra manter o total em 3 itens.
  const hudSwitchableTasks = switchableRecentTasks.slice(0, 2);

  const destinoProject = snapshot.projects.find((p) => p.id === snapshot.selectedProjectId);
  const destinoClient = destinoProject ? snapshot.clients.find((c) => c.id === destinoProject.clientId) : null;
  const destinoLabel = destinoProject ? displayPath([destinoClient?.name, destinoProject.name]) : 'Avulsa';

  const remaining = session ? Math.max(0, session.plannedSeconds - session.elapsedSeconds) : 0;
  const elapsed = session ? session.elapsedSeconds : 0;
  const progress = session ? elapsed / Math.max(1, session.plannedSeconds) : 0;
  const isAlertTime = remaining <= 300 && remaining > 0 && session?.status === 'Ativo';

  // Histórico do dia
  const today = new Date().toISOString().split('T')[0];
  const todaySessions = snapshot.recentSessions.filter(
    (s) => s.startedAt?.startsWith(today) && s.cycleKind === 'Foco' && s.status === 'Concluído',
  );
  const totalFocusSecondsToday = todaySessions.reduce((sum, s) => sum + s.elapsedSeconds, 0);
  const cyclesCompletedToday = todaySessions.length;
  const focusHours = Math.floor(totalFocusSecondsToday / 3600);
  const focusMinutes = Math.floor((totalFocusSecondsToday % 3600) / 60);

  let label = session?.cycleKind === 'Pausa' ? 'Pausa ⏸' : 'Nenhuma tarefa em foco';
  if (activeLog) {
    const project = snapshot.projects.find((p) => p.id === activeLog.projectId);
    const client = project ? snapshot.clients.find((c) => c.id === project.clientId) : null;
    const breadcrumb = [client?.name, project?.name, activeLog.taskTitle].filter(Boolean).join(' › ');
    label = breadcrumb || activeLog.taskTitle;
  }

  const isFocus = session?.cycleKind === 'Foco';
  const cycleColor = isFocus ? '#ecdc01' : '#fafafa';
  const cycleEmoji = isFocus ? '🔴' : '🟢';
  const alertColor = isAlertTime ? '#ffd166' : 'var(--allus-text-primary)';

  const isSizeLocked = snapshot?.floatingPanelSizeLocked ?? false;
  const handleSizeLockToggle = () => {
    const newValue = !isSizeLocked;
    window.allus.invoke('window:setFloatingSizeLocked', { locked: newValue });
    window.allus.invoke('prefs:setFloatingPanelSizeLocked', { locked: newValue });
  };

  // Status badge — usa a mesma bolinha de status do resto do app (allus-status-dot)
  const statusDotStatus: 'Ativo' | 'Pausado' | 'Concluído' | 'Interrompido' = session?.status ?? 'Interrompido';
  const statusLabel = !session ? 'Parado' : session.status === 'Interrompido' ? 'Parado' : session.status;

  async function submitAdd(e?: React.FormEvent) {
    e?.preventDefault();
    if (!text.trim()) return;
    await invokeAction('task:quickAdd', { title: text.trim(), avulsa: false });
    await invokeAction('timer:resume', undefined);
    setText('');
    setShowAdd(false);
  }

  // Atalho do modo mini: assume a tarefa (cria/reaproveita o log dentro da
  // sessão atual, sem perguntar tipo de ciclo) e garante que o timer esteja
  // rodando — sem abrir o TaskModeSelector nem sair do tamanho compacto.
  async function quickStartTask(taskId: string | null, title: string) {
    await invokeAction('task:focus', { taskId, subtaskId: null, title });
    await invokeAction('timer:resume', undefined);
  }

  // Opacidades padronizadas em função da preferência do usuário
  const bgOpacity = panelOpacity * 0.85;
  const borderOpacity = panelOpacity * 0.5;

  // Layout compacto

  return (
    <div
      className="allus-titlebar allus-floating-root"
      style={{
        height: '100%',
        padding: 'var(--allus-space-4) var(--allus-space-3)',
        borderLeft: `3px solid ${session ? cycleColor : `rgba(255,255,255,${borderOpacity * 0.3})`}`,
        overflowY: 'auto',
        background: `rgba(0, 0, 1, ${bgOpacity})`,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        flexDirection: 'column',
      } as any}
    >
      <div ref={contentRef} style={{ display: 'flex', flexDirection: 'column', gap: isMini ? 6 : 'var(--allus-space-4)', flex: 1, overflowY: 'auto' }}>
      {isMini ? (
        <>
          {/* HUD horizontal compacto: cronômetro (esquerda) + botões circulares (direita) — sem texto de tarefa aqui, pra não esticar a janela na horizontal */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            {/* Cronômetro — maior elemento da tela, nunca encolhe */}
            <div
              style={{
                fontFamily: 'var(--allus-font-mono)',
                fontSize: 30,
                fontWeight: 700,
                color: session ? alertColor : 'var(--allus-text-muted)',
                letterSpacing: '-0.5px',
                flexShrink: 0,
                lineHeight: 1,
              }}
            >
              {session ? formatDuration(remaining) : '–'}
            </div>

            {/* Botões circulares, mesmo diâmetro, alinhados */}
            <div className="allus-no-drag" style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
              {!session || session.status === 'Interrompido' || session.status === 'Concluído' ? (
                <button
                  onClick={() => (lastTask ? quickStartTask(lastTask.taskId, lastTask.title) : showAdd ? submitAdd() : setShowAdd(true))}
                  style={{ ...hudCircleBtn, color: '#ecdc01', borderColor: 'rgba(236, 220, 1, 0.4)' }}
                  title={lastTask ? `Continuar: ${lastTask.title}` : 'Começar'}
                >
                  ▶
                </button>
              ) : (
                <>
                  <button
                    onClick={() => invokeAction('timer:playPause', undefined)}
                    style={{ ...hudCircleBtn, color: session.status === 'Ativo' ? '#ffb84d' : '#ecdc01' }}
                    title={session.status === 'Ativo' ? 'Pausar' : 'Retomar'}
                  >
                    {session.status === 'Ativo' ? '⏸' : '▶'}
                  </button>
                  <button
                    onClick={() => invokeAction('timer:stop', undefined)}
                    style={{ ...hudCircleBtn, color: 'var(--allus-status-interrompido)' }}
                    title="Parar"
                  >
                    ⏹
                  </button>
                  <button
                    onClick={() =>
                      invokeAction(session.cycleKind === 'Foco' ? 'timer:skipToBreak' : 'timer:skipToFocus', undefined)
                    }
                    style={{ ...hudCircleBtn, background: 'rgba(236, 220, 1, 0.85)', borderColor: 'rgba(236, 220, 1, 0.85)', color: '#141400' }}
                    title={session.cycleKind === 'Foco' ? 'Pular pra pausa' : 'Encerrar pausa'}
                  >
                    ⏭
                  </button>
                </>
              )}
              <button
                className="allus-no-drag"
                onClick={toggleMini}
                style={{ ...hudCircleBtn, width: 20, height: 20, fontSize: 10, opacity: 0.7 }}
                title="Abrir painel completo"
              >
                ⤢
              </button>
            </div>
          </div>

          {/* Lista de tarefas: a ativa (se houver) vem destacada como 1º item,
              seguida das últimas recentes — substitui o texto ao lado do
              relógio, que forçava a janela a esticar na horizontal. */}
          {(activeLog || hudSwitchableTasks.length > 0) && (
            <div className="allus-no-drag" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {session && activeLog && (
                <div
                  style={{
                    width: '100%',
                    padding: '4px 6px',
                    borderRadius: 5,
                    border: '1px solid rgba(236, 220, 1, 0.35)',
                    background: 'rgba(236, 220, 1, 0.14)',
                    color: '#ecdc01',
                    fontSize: 10,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={label}
                >
                  {label}
                </div>
              )}
              {hudSwitchableTasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => quickStartTask(t.taskId, t.taskTitle)}
                  style={{
                    width: '100%',
                    padding: '4px 6px',
                    borderRadius: 5,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.04)',
                    fontSize: 10,
                    textAlign: 'left',
                    color: 'var(--allus-text-secondary)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={`Retomar: ${t.taskTitle}`}
                >
                  {t.taskTitle}
                </button>
              ))}
            </div>
          )}

          {/* Campo "Nova tarefa" — só quando não há nenhuma tarefa recente ainda */}
          {showAdd && (
            <form className="allus-no-drag" onSubmit={submitAdd} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div ref={quickAddWrapRef} style={{ position: 'relative' }}>
                <input
                  autoFocus
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Nome da tarefa..."
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 5,
                    padding: '5px 7px',
                    color: 'var(--allus-text-primary)',
                    fontSize: 11,
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitAdd(e as any);
                    if (e.key === 'Escape') setShowAdd(false);
                  }}
                />
                <TaskSuggestions
                  query={text}
                  tasks={snapshot?.tasks ?? []}
                  projects={snapshot?.projects ?? []}
                  clients={snapshot?.clients ?? []}
                  onPick={() => setText('')}
                  anchorRect={quickAddWrapRef.current?.getBoundingClientRect() ?? null}
                />
              </div>
            </form>
          )}
        </>
      ) : (
        <>
      {/* Seção superior: Status, Ciclo, Timer, Progresso — sem no-drag, não tem
          nada clicável aqui, então o espaço vazio arrasta o painel como o resto */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--allus-space-3)',
          paddingBottom: 'var(--allus-space-3)',
          borderBottom: `1px solid rgba(255,255,255,${borderOpacity * 0.3})`,
        }}
      >
        {/* Alça de arraste + Status Badge + Ciclo em uma linha */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, gap: 'var(--allus-space-2)' }}>
          <div className="allus-drag" style={{ width: '4px', height: '16px', cursor: 'grab', flexShrink: 0, borderRadius: 2, background: `rgba(255,255,255,${borderOpacity * 0.2})` }} title="Arrastar painel" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--allus-text-secondary)' }}>
            <span className="allus-status-dot" data-status={statusDotStatus} style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }} />
            {statusLabel}
          </div>
          {session && (
            <div style={{ color: cycleColor }}>
              {cycleEmoji} {isFocus ? 'FOCO' : 'PAUSA'}
            </div>
          )}
          <button className="allus-no-drag" onClick={toggleMini} style={{ ...miniIconBtn, width: 20, height: 20, fontSize: 10, flexShrink: 0 }} title="Modo mini">
            ⤡
          </button>
        </div>

        {/* Timer grande no topo */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--allus-space-2)', justifyContent: 'space-between' }}>
          <div
            style={{
              fontFamily: 'var(--allus-font-mono)',
              fontSize: session ? 36 : 28,
              fontWeight: 700,
              color: session ? alertColor : 'var(--allus-text-muted)',
              letterSpacing: '-0.5px',
            }}
          >
            {session ? formatDuration(remaining) : '–'}
          </div>
          {!snapshot.online && (
            <span title="Sem conexão" style={{ color: 'var(--allus-status-interrompido)', fontSize: 12, marginBottom: 'var(--allus-space-1)' }}>
              ●
            </span>
          )}
        </div>

        {/* Barra de progresso */}
        {session && (
          <div
            style={{
              width: '100%',
              height: 6,
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progress * 100}%`,
                height: '100%',
                background: cycleColor,
                transition: 'width 0.3s ease',
                borderRadius: 3,
              }}
            />
          </div>
        )}
      </div>

      {/* Identificação da tarefa + botão marcar como feita */}
      <div className="allus-no-drag" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div
          style={{
            flex: 1,
            fontSize: 13,
            lineHeight: 1.4,
            color: session ? 'var(--allus-text-primary)' : 'var(--allus-text-muted)',
            wordBreak: 'break-word',
            minHeight: 18,
            fontWeight: 500,
          }}
        >
          {session ? label : 'Nenhum bloco em andamento'}
        </div>
        {session && activeLog && (
          <button
            onClick={() => invokeAction('task:toggleDone', { taskLogId: activeLog.id })}
            style={{
              padding: '6px 8px',
              borderRadius: 6,
              border: activeLog.isDone ? `1.5px solid #ecdc01` : '1px solid rgba(255,255,255,0.2)',
              background: activeLog.isDone ? 'rgba(236, 220, 1, 0.15)' : 'transparent',
              color: activeLog.isDone ? '#ecdc01' : 'var(--allus-text-muted)',
              fontSize: 13,
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'all 0.2s ease',
              flexShrink: 0,
            }}
            title="Marcar como feita"
          >
            ✓
          </button>
        )}
      </div>

      {/* Controles - dinâmicos por estado */}
      {!session || (session.status === 'Interrompido' || session.status === 'Concluído') ? (
        // Estado: Parado - opções de começar
        <div className="allus-no-drag" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--allus-space-2)' }}>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
            {lastTask ? (
              <>
                <button
                  onClick={() => setModeSelectTask(lastTask)}
                  style={{
                    flex: 1,
                    minWidth: 100,
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1.5px solid rgba(236, 220, 1, 0.5)',
                    background: 'rgba(236, 220, 1, 0.12)',
                    color: '#ecdc01',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    transition: 'all 0.2s ease',
                  }}
                  title={`Continuar: ${lastTask.title}`}
                >
                  ▶ Continuar
                </button>
                <button
                  onClick={() => setModeSelectTask({ taskId: null, title: '' })}
                  style={{
                    padding: '10px 10px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'var(--allus-text-secondary)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  title="Escolher outra tarefa"
                >
                  ↻
                </button>
              </>
            ) : (
              <button
                onClick={() => (showAdd ? submitAdd() : setShowAdd(true))}
                style={{
                  flex: 1,
                  padding: '11px 16px',
                  borderRadius: 8,
                  border: '1.5px solid rgba(236, 220, 1, 0.4)',
                  background: 'rgba(236, 220, 1, 0.1)',
                  color: '#ecdc01',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                title="Criar e iniciar uma tarefa"
              >
                ▶ Começar
              </button>
            )}
          </div>
        </div>
      ) : (
        // Estado: Ativo ou Pausado - controles do timer
        <div className="allus-no-drag" style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          <button
            onClick={() => invokeAction('timer:playPause', undefined)}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 8,
              border: session.status === 'Ativo' ? '1.5px solid #ffb84d' : '1.5px solid #ecdc01',
              background:
                session.status === 'Ativo'
                  ? 'rgba(255, 184, 77, 0.12)'
                  : 'rgba(236, 220, 1, 0.12)',
              color: session.status === 'Ativo' ? '#ffb84d' : '#ecdc01',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            title={session.status === 'Ativo' ? 'Pausar (Espaço)' : 'Retomar (Espaço)'}
          >
            {session.status === 'Ativo' ? '⏸ Pausar' : '▶ Retomar'}
          </button>
          <button
            onClick={() => invokeAction('timer:stop', undefined)}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 8,
              border: '1.5px solid var(--allus-status-interrompido)',
              background: 'rgba(235, 59, 90, 0.12)',
              color: 'var(--allus-status-interrompido)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            title="Parar completamente — encerra o bloco atual"
          >
            ⏹ Parar
          </button>
          <button
            style={{
              ...iconBtn,
              transition: 'all 0.2s ease',
            }}
            onClick={() => setModeSelectTask({ taskId: null, title: '' })}
            title="Trocar de tarefa"
          >
            ↻
          </button>
        </div>
      )}

      {/* Últimas 3 tarefas trabalhadas — atalho de retomada, sem abrir telas maiores */}
      {switchableRecentTasks.length > 0 && (
        <div className="allus-no-drag" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {switchableRecentTasks.map((t) => (
            <button
              key={t.id}
              onClick={() => setModeSelectTask({ taskId: t.taskId, title: t.taskTitle })}
              style={{
                width: '100%',
                padding: '7px 10px',
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)',
                fontSize: 11,
                textAlign: 'left',
                color: 'var(--allus-text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={`Retomar: ${t.taskTitle}`}
            >
              {t.taskTitle}
            </button>
          ))}
        </div>
      )}

      {/* Campo "Nova tarefa" - só aparece quando clica + */}
      {showAdd && (
        <form className="allus-no-drag" onSubmit={submitAdd} style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 11, color: 'var(--allus-text-muted)', fontWeight: 500 }}>Adicionar tarefa</div>
          <div ref={quickAddWrapRef} style={{ position: 'relative' }}>
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Nome da tarefa..."
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 6,
                padding: '8px 10px',
                color: 'var(--allus-text-primary)',
                fontSize: 12,
                transition: 'all 0.2s ease',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitAdd(e as any);
                if (e.key === 'Escape') setShowAdd(false);
              }}
            />
            <TaskSuggestions
              query={text}
              tasks={snapshot?.tasks ?? []}
              projects={snapshot?.projects ?? []}
              clients={snapshot?.clients ?? []}
              onPick={() => setText('')}
              anchorRect={quickAddWrapRef.current?.getBoundingClientRect() ?? null}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowProjectPicker(true)}
            style={{
              fontSize: 11,
              color: 'var(--allus-text-primary)',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6,
              padding: '6px 8px',
              width: '100%',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
          >
            <span>
              <span style={{ color: 'var(--allus-text-muted)' }}>Vai para: </span>
              <strong>{destinoLabel}</strong>
            </span>
            <span>▾</span>
          </button>
        </form>
      )}

      {showProjectPicker && (
        <ProjectPicker
          clients={snapshot.clients}
          projects={snapshot.projects}
          selectedProjectId={snapshot.selectedProjectId}
          onSelect={() => setShowProjectPicker(false)}
          panelRef={projectPickerRef}
        />
      )}

      {/* Toggle expandir/recolher — sempre visível, no rodapé da parte compacta */}
      <button
        className="allus-no-drag"
        onClick={toggleExpanded}
        style={{
          marginTop: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '6px 8px',
          borderRadius: 6,
          border: 'none',
          background: 'transparent',
          color: 'var(--allus-text-muted)',
          fontSize: 11,
          fontWeight: 500,
          cursor: 'pointer',
        }}
        title={isExpanded ? 'Recolher painel' : 'Mais opções, tarefas recentes e histórico'}
      >
        {isExpanded ? '▲ Recolher' : '▼ Mais'}
      </button>

      {/* Drawer expandido — recentes, histórico, configurações */}
      {isExpanded && (
        <div className="allus-no-drag" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--allus-space-3)', paddingTop: 'var(--allus-space-2)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          {/* Nova tarefa avulsa */}
          <button
            onClick={() => setShowAdd((v) => !v)}
            style={{
              padding: '8px 10px',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--allus-text-secondary)',
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            + Nova tarefa
          </button>

          {/* Break Reminder - quando está em pausa */}
          {session && session.cycleKind === 'Pausa' && session.status === 'Ativo' && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: 'rgba(236, 220, 1, 0.1)',
                border: '1px solid rgba(236, 220, 1, 0.25)',
                fontSize: 12,
                color: '#ecdc01',
                textAlign: 'center',
                fontWeight: 500,
              }}
            >
              💪 Alongue, beba água e descanse!
            </div>
          )}

          {/* Histórico do dia */}
          {(focusHours > 0 || focusMinutes > 0) && (
            <div style={{ fontSize: 11, color: 'var(--allus-text-muted)' }}>
              📊 Hoje: {focusHours > 0 ? `${focusHours}h` : ''} {focusMinutes}m em {cyclesCompletedToday} {cyclesCompletedToday === 1 ? 'ciclo' : 'ciclos'}
            </div>
          )}

          {/* Minhas horas (7 dias) */}
          <button
            onClick={() => window.allus.invoke('window:openTimeCenter', undefined)}
            style={{
              fontSize: 11,
              color: 'var(--allus-text-muted)',
              background: 'transparent',
              border: 'none',
              padding: 0,
              textAlign: 'left',
              cursor: 'pointer',
            }}
            title="Abrir Central de Tempos"
          >
            Minhas horas (7 dias): <span style={{ color: '#ecdc01', fontWeight: 600 }}>{myHoursSeconds === null ? '...' : formatHoursSummary(myHoursSeconds)}</span>
          </button>

          {/* Configurações */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--allus-space-2)' }}>
            <div style={{ fontSize: 11, color: 'var(--allus-text-muted)', fontWeight: 500 }}>Configurações</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                style={{
                  ...iconBtn,
                  transition: 'all 0.2s ease',
                  background: isSizeLocked ? 'rgba(255, 184, 77, 0.2)' : 'rgba(255,255,255,0.06)',
                  borderColor: isSizeLocked ? 'rgba(255, 184, 77, 0.3)' : 'rgba(255,255,255,0.12)',
                  color: isSizeLocked ? '#ffb84d' : 'var(--allus-text-primary)',
                }}
                onClick={handleSizeLockToggle}
                title={isSizeLocked ? 'Destravar tamanho' : 'Travar tamanho'}
              >
                {isSizeLocked ? '🔒' : '🔓'}
              </button>
              <button
                style={{ ...iconBtn, transition: 'all 0.2s ease' }}
                onClick={() => window.allus.invoke('window:openMain', undefined)}
                title="Abrir janela principal"
              >
                ⤢
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
      </div>

      {/* Modal de seleção de tarefa e modo */}
      {modeSelectTask && (
        <TaskModeSelector
          task={modeSelectTask}
          recentTasks={snapshot.recentTasks}
          onSelectTask={setModeSelectTask}
          onClose={() => setModeSelectTask(null)}
          cardRef={modalCardRef}
        />
      )}

      <ToastHost />
    </div>
  );
}

function formatHoursSummary(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

const iconBtn: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--allus-text-primary)',
  fontSize: 14,
  fontWeight: 500,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

const miniIconBtn: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--allus-text-primary)',
  fontSize: 11,
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
};

// Botões circulares do HUD compacto — mesmo diâmetro, hover suave.
const hudCircleBtn: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: '50%',
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--allus-text-primary)',
  fontSize: 11,
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
  transition: 'all 0.15s ease',
};
