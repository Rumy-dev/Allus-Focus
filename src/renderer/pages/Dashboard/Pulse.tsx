import { useEffect, useState, useRef } from 'react';
import { useAppState } from '../../useAppState';
import { invokeAction } from '../../invoke';
import { Titlebar } from '../../components/Titlebar';
import { ToastHost } from '../../components/ToastHost';
import type { PulseResult, PulseTeamMember } from '../../../shared/types';
import { formatDuration } from '../../../shared/types';

export function Pulse() {
  const snapshot = useAppState();
  const [pulse, setPulse] = useState<PulseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPulse = async () => {
    try {
      setError(null);
      const result = await invokeAction('pulse:query', undefined);
      setPulse(result ?? null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      console.error('[Pulse] erro ao carregar dados', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPulse();
    const interval = setInterval(loadPulse, 18000); // ~15-20s
    return () => clearInterval(interval);
  }, []);

  if (!snapshot) return <div className="allus-app-bg" style={{ height: '100%' }} />;

  if (error) {
    return (
      <div className="allus-app-bg" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Titlebar title="ALLUS PULSE" />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff5fae', fontSize: 14 }}>
          {error}
        </div>
      </div>
    );
  }

  if (loading || !pulse) {
    return (
      <div className="allus-app-bg" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Titlebar title="ALLUS PULSE" />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--allus-text-muted)', fontSize: 12 }}>
          Carregando...
        </div>
      </div>
    );
  }

  // Formata data por extenso
  const now = new Date(pulse.generatedAt);
  const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const day = daysOfWeek[now.getDay()];
  const date = now.toLocaleString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).toLowerCase();
  const headerDate = `${day.split('-')[0].split(' ')[0]} · ${date}`;

  const todayHours = formatDuration(pulse.teamTodaySeconds);
  const unclassifiedHours = formatDuration(pulse.insights.unclassifiedSeconds);
  const longestBlockHours = formatDuration(pulse.insights.longestBlockSeconds);

  return (
    <div className="allus-app-bg" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Titlebar title={`ALLUS PULSE · ${headerDate}`} />
      <div style={{ padding: 16, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Resumo Executivo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div className="allus-glass" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--allus-text-muted)', marginBottom: 8 }}>FOCANDO AGORA</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#4bf5e3', fontFamily: 'Courier New, monospace' }}>
              {pulse.teamFocusingCount}
            </div>
          </div>
          <div className="allus-glass" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--allus-text-muted)', marginBottom: 8 }}>HOJE (HORAS)</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#ff5fae', fontFamily: 'Courier New, monospace' }}>{todayHours}</div>
          </div>
          <div className="allus-glass" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--allus-text-muted)', marginBottom: 8 }}>META DIÁRIA</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: pulse.dailyGoalPct >= 100 ? '#4bf5e3' : '#9b6bff', fontFamily: 'Courier New, monospace' }}>
              {pulse.dailyGoalPct}%
            </div>
          </div>
        </div>

        {/* EQUIPE AO VIVO */}
        <div className="allus-glass" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--allus-text-muted)', marginBottom: 12 }}>EQUIPE AO VIVO</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pulse.teamMembers.map((member) => (
              <TeamMemberRow key={member.userId} member={member} />
            ))}
          </div>
        </div>

        {/* Grid de Radar + Insights */}
        {(pulse.projectBudgets.length > 0 || pulse.insights.unclassifiedSeconds > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* RADAR DE ORÇAMENTO */}
            {pulse.projectBudgets.length > 0 && (
              <div className="allus-glass" style={{ padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--allus-text-muted)', marginBottom: 12 }}>RADAR DE PROJETOS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {pulse.projectBudgets.slice(0, 3).map((proj) => (
                    <div key={proj.projectId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--allus-text-primary)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {proj.projectName}
                        </div>
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
                              width: `${Math.min(proj.pct, 100)}%`,
                              height: '100%',
                              background: proj.pct <= 100 ? '#4bf5e3' : '#ff5fae',
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--allus-text-muted)', fontFamily: 'Courier New, monospace', minWidth: 40, textAlign: 'right' }}>
                        {proj.pct}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* INSIGHTS */}
            <div className="allus-glass" style={{ padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--allus-text-muted)', marginBottom: 12 }}>INSIGHTS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 11 }}>
                <div style={{ paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ color: 'var(--allus-text-muted)', marginBottom: 4 }}>↑ Top cliente</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#9b6bff' }}>{pulse.insights.topClientPct}%</div>
                </div>
                {pulse.insights.unclassifiedSeconds > 0 && (
                  <div style={{ paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ color: 'var(--allus-text-muted)', marginBottom: 4 }}>⚠ Sem classificação</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#ff5fae' }}>{unclassifiedHours}</div>
                  </div>
                )}
                <div>
                  <div style={{ color: 'var(--allus-text-muted)', marginBottom: 4 }}>★ Maior foco</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#4bf5e3' }}>{longestBlockHours}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <ToastHost />
    </div>
  );
}

interface TeamMemberRowProps {
  member: PulseTeamMember;
}

function TeamMemberRow({ member }: TeamMemberRowProps) {
  const [highlighted, setHighlighted] = useState(false);
  const prevStatusRef = useRef(member.status);

  useEffect(() => {
    if (prevStatusRef.current !== 'offline' && member.status === 'Concluído') {
      setHighlighted(true);
      const timer = setTimeout(() => setHighlighted(false), 1500);
      return () => clearTimeout(timer);
    }
    prevStatusRef.current = member.status;
  }, [member.status]);

  const statusDot = member.status === 'Ativo' ? '●' : member.status === 'Pausado' ? '◐' : '○';
  const statusColor = member.status === 'Ativo' ? '#4bf5e3' : member.status === 'Pausado' ? '#9b6bff' : '#555';

  const displayTime = member.status !== 'offline' ? `${formatDuration(member.elapsedSeconds)} / ${formatDuration(member.plannedSeconds)}` : '—';
  const taskDisplay = member.currentTaskTitle
    ? `${member.clientName ? member.clientName + ' · ' : ''}${member.currentTaskTitle}`
    : '—';

  return (
    <div
      style={{
        padding: 10,
        borderRadius: 8,
        background: highlighted ? 'rgba(75, 245, 227, 0.15)' : 'rgba(255,255,255,0.04)',
        border: highlighted ? '1px solid rgba(75, 245, 227, 0.3)' : '1px solid rgba(255,255,255,0.08)',
        transition: highlighted ? 'all 0.15s ease' : 'all 0.3s ease',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 11,
        animation: highlighted ? 'pulse 1.5s ease-out' : 'none',
      }}
    >
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1); opacity: 0.8; }
        }
      `}</style>
      <span style={{ color: statusColor, fontSize: 14, fontWeight: 'bold' }}>{statusDot}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, color: 'var(--allus-text-primary)', marginBottom: 2 }}>{member.fullName}</div>
        <div style={{ color: 'var(--allus-text-muted)', fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {taskDisplay}
        </div>
      </div>
      <div style={{ color: 'var(--allus-text-muted)', fontFamily: 'Courier New, monospace', fontSize: 10, whiteSpace: 'nowrap', textAlign: 'right' }}>
        {displayTime}
      </div>
    </div>
  );
}
