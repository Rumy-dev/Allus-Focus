import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import allusWatermark from '../../assets/allus-focus-watermark.svg';
import { BarChart } from '../../components/BarChart';
import { TrendChart } from '../../components/TrendChart';
import { useAppState } from '../../useAppState';
import { Titlebar } from '../../components/Titlebar';
import { ToastHost } from '../../components/ToastHost';
import { useDataRefreshKey } from '../../useDataRefreshKey';
import type { PulseResult, PulseTeamMember } from '../../../shared/types';
import { formatDuration } from '../../../shared/types';

export function Pulse() {
  const snapshot = useAppState();
  const refreshKey = useDataRefreshKey(snapshot);
  const [pulse, setPulse] = useState<PulseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllBudgets, setShowAllBudgets] = useState(false);

  const loadPulse = async () => {
    try {
      setError(null);
      const result = await window.allus.invoke('pulse:query', undefined);
      setPulse(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      console.error('[Pulse] erro ao carregar dados', err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await loadPulse();
    setRefreshing(false);
  };

  useEffect(() => {
    loadPulse();
    let interval: NodeJS.Timeout | null = null;

    const startPolling = () => {
      if (interval) clearInterval(interval);
      interval = setInterval(loadPulse, 18000);
    };

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        loadPulse();
        startPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!snapshot) return;
    loadPulse();
  }, [refreshKey]);

  if (!snapshot) return <div className="allus-app-bg" style={{ height: '100%' }} />;

  if (error) {
    return (
      <div className="allus-app-bg" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Titlebar title="ALLUS PULSE" />
        <div style={centerStateStyle}>
          <div style={centerStateCardStyle}>
            <div style={{ fontSize: 12, color: 'var(--allus-status-interrompido)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Não foi possível abrir o Pulse
            </div>
            <div style={{ marginTop: 8, color: 'var(--allus-text-primary)', fontSize: 14, lineHeight: 1.5 }}>{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !pulse) {
    return (
      <div className="allus-app-bg" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Titlebar title="ALLUS PULSE" />
        <div style={centerStateStyle}>
          <div style={centerStateCardStyle}>
            <div style={{ fontSize: 12, color: 'var(--allus-text-muted)' }}>Carregando o painel ao vivo...</div>
          </div>
        </div>
      </div>
    );
  }

  const now = new Date(pulse.generatedAt);
  const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const day = daysOfWeek[now.getDay()];
  const date = now.toLocaleString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).toLowerCase();
  const headerDate = `${day} · ${date}`;

  const todayHours = formatDuration(pulse.teamTodaySeconds);
  const unclassifiedHours = formatDuration(pulse.insights.unclassifiedSeconds);
  const longestBlockHours = formatDuration(pulse.insights.longestBlockSeconds);
  const yesterdayTrend = pulse.insights.todayVsYesterdayPct;
  const yesterdayIndicator = yesterdayTrend > 0 ? '↑' : yesterdayTrend < 0 ? '↓' : '→';
  const yesterdayColor = yesterdayTrend > 0 ? 'var(--allus-status-concluido)' : yesterdayTrend < 0 ? 'var(--allus-status-interrompido)' : '#999';
  const noFocusMemberIds = pulse.insights.noFocusMemberIds;
  const topPerson = [...pulse.teamMembers].sort((a, b) => b.todayTotalSeconds - a.todayTotalSeconds)[0] ?? null;
  const trend = pulse.teamMembers.map((member, index) => ({
    date: String(index + 1),
    totalSeconds: member.todayTotalSeconds,
  }));
  const typeData = pulse.projectBudgets.map((project) => ({
    id: project.projectId,
    label: project.projectName,
    value: Math.round(project.loggedHours * 3600),
  }));

  return (
    <div
      className="allus-app-bg allus-watermark"
      style={
        {
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          '--allus-watermark-image': `url(${allusWatermark})`,
        } as CSSProperties
      }
    >
      <Titlebar title={`ALLUS PULSE · ${headerDate}`} />
      <div style={pageStyle}>
        <section style={heroStyle}>
          <div style={{ minWidth: 0 }}>
            <div style={eyebrowStyle}>Visão ao vivo do time</div>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.04em', marginTop: 4 }}>Pulse</div>
            <div style={{ fontSize: 12, color: 'var(--allus-text-secondary)', marginTop: 6, maxWidth: 560, lineHeight: 1.5 }}>
              Leitura rápida de foco, orçamento e distribuição do tempo. Clique nos painéis para aprofundar.
            </div>
          </div>
          <div style={heroMetaStyle}>
            <div style={heroMetaChipStyle}>Atualizado {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              style={{
                ...refreshButtonStyle,
                opacity: refreshing ? 0.75 : 1,
              }}
            >
              <span style={{ display: 'inline-block', animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }}>↻</span>
              {refreshing ? 'Atualizando' : 'Atualizar'}
            </button>
          </div>
        </section>

        <section style={kpiGridStyle}>
          <KpiCard label="Focando agora" value={String(pulse.teamFocusingCount)} helper="pessoas com sessão ativa" accent />
          <KpiCard
            label="Horas do dia"
            value={todayHours}
            helper={yesterdayTrend === 0 ? 'estável vs. ontem' : `vs. ontem ${yesterdayIndicator}${Math.abs(yesterdayTrend)}%`}
          />
          <KpiCard label="Meta diária" value={`${pulse.dailyGoalPct}%`} helper={pulse.dailyGoalPct >= 100 ? 'meta atingida' : 'rumo à meta'} />
          <KpiCard label="Maior bloco" value={longestBlockHours} helper="maior foco contínuo de hoje" />
        </section>

        <section style={summaryStripStyle}>
          <div style={summaryPillStyle}>
            <div style={summaryLabelStyle}>Sem classificação</div>
            <div style={summaryValueStyle}>{unclassifiedHours}</div>
          </div>
          <div style={summaryPillStyle}>
            <div style={summaryLabelStyle}>Top cliente</div>
            <div style={summaryValueStyle}>{pulse.insights.topClientPct}%</div>
          </div>
          <div style={summaryPillStyle}>
            <div style={summaryLabelStyle}>Sem bloco hoje</div>
            <div style={summaryValueStyle}>{noFocusMemberIds.length}</div>
          </div>
        </section>

        <section style={mainGridStyle}>
          <div className="allus-glass" style={panelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <div style={panelTitleStyle}>Equipe ao vivo</div>
                <div style={panelSubtitleStyle}>{pulse.teamMembers.length} pessoas monitoradas em tempo real</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pulse.teamMembers.map((member) => (
                <TeamMemberRow key={member.userId} member={member} />
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            <div className="allus-glass" style={panelStyle}>
              <div style={panelHeaderStyle}>
                <div>
                  <div style={panelTitleStyle}>Ranking de horas</div>
                  <div style={panelSubtitleStyle}>Ordenado por tempo acumulado hoje</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pulse.teamMembers
                  .filter((m) => m.todayTotalSeconds > 0)
                  .sort((a, b) => b.todayTotalSeconds - a.todayTotalSeconds)
                  .slice(0, 6)
                  .map((member, idx, arr) => {
                    const max = Math.max(...arr.map((m) => m.todayTotalSeconds), 1);
                    const pct = Math.round((member.todayTotalSeconds / max) * 100);
                    return (
                      <div key={member.userId} style={rankingRowStyle}>
                        <div style={rankingIndexStyle}>{idx + 1}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.fullName}</span>
                            <span style={{ color: 'var(--allus-yellow)', fontFamily: 'var(--allus-font-mono)' }}>
                              {formatDuration(member.todayTotalSeconds)}
                            </span>
                          </div>
                          <div style={miniTrackStyle}>
                            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: 'var(--allus-gradient)' }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="allus-glass" style={panelStyle}>
              <div style={panelHeaderStyle}>
                <div>
                  <div style={panelTitleStyle}>Leitura rápida</div>
                  <div style={panelSubtitleStyle}>Sinais resumidos para decisão</div>
                </div>
              </div>
              <div style={insightGridStyle}>
                <Insight label="Pessoa destaque" value={topPerson?.fullName ?? '—'} />
                <Insight label="Top cliente" value={`${pulse.insights.topClientPct}%`} />
                <Insight label="Média diária" value={todayHours} />
                <Insight label="Maior foco" value={longestBlockHours} />
              </div>
            </div>
          </div>
        </section>

        <section style={chartGridStyle}>
          {pulse.projectBudgets.length > 0 && (
            <div className="allus-glass" style={panelStyle}>
              <div style={panelHeaderStyle}>
                <div>
                  <div style={panelTitleStyle}>Radar de projetos</div>
                  <div style={panelSubtitleStyle}>{pulse.projectBudgets.length} projetos com orçamento monitorado</div>
                </div>
                {pulse.projectBudgets.length > 3 && (
                  <button
                    onClick={() => setShowAllBudgets((v) => !v)}
                    style={ghostButtonStyle}
                  >
                    {showAllBudgets ? 'Ver menos' : 'Ver todos'}
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: showAllBudgets ? 320 : 'none', overflowY: showAllBudgets ? 'auto' : 'visible' }}>
                {[...pulse.projectBudgets]
                  .sort((a, b) => b.pct - a.pct)
                  .slice(0, showAllBudgets ? undefined : 3)
                  .map((proj) => (
                    <button
                      key={proj.projectId}
                      type="button"
                      onClick={() => window.allus.invoke('window:openDashboard', undefined)}
                      style={budgetRowButtonStyle}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={budgetLabelRowStyle}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proj.projectName}</span>
                          {proj.pct > 100 && <span style={{ color: 'var(--allus-status-interrompido)', fontWeight: 800 }}>⚠</span>}
                        </div>
                        <div style={budgetTrackStyle}>
                          <div
                            style={{
                              width: `${Math.min(proj.pct, 100)}%`,
                              height: '100%',
                              borderRadius: 999,
                              background: proj.pct <= 100 ? 'var(--allus-yellow)' : 'var(--allus-status-interrompido)',
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                      </div>
                      <div style={budgetPctStyle}>{proj.pct}%</div>
                    </button>
                  ))}
              </div>
            </div>
          )}

          <div className="allus-glass" style={panelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <div style={panelTitleStyle}>Insights</div>
                <div style={panelSubtitleStyle}>Sinais rápidos para acompanhar o time</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <MiniInsight label="Sem classificação" value={unclassifiedHours} />
              <MiniInsight label="Maior bloco" value={longestBlockHours} />
              <MiniInsight label="Top cliente" value={`${pulse.insights.topClientPct}%`} />
              <MiniInsight label="Sem bloco hoje" value={String(noFocusMemberIds.length)} />
            </div>
          </div>
        </section>

        <section style={bottomGridStyle}>
          <div className="allus-glass" style={panelStyle}>
            <BarChart title="Horas por tipo de projeto" items={typeData} color="#b8ac00" />
          </div>
          <div className="allus-glass" style={panelStyle}>
            <TrendChart title="Tendência diária" data={trend} color="#ecdc01" />
          </div>
        </section>
      </div>
      <ToastHost />
    </div>
  );
}

function KpiCard({ label, value, helper, accent }: { label: string; value: string; helper?: string; accent?: boolean }) {
  return (
    <div className="allus-glass" style={{ ...kpiCardStyle, borderColor: accent ? 'rgba(236, 220, 1, 0.42)' : undefined }}>
      <div style={eyebrowStyle}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--allus-font-mono)', color: accent ? 'var(--allus-yellow)' : 'var(--allus-text-primary)', marginTop: 5 }}>
        {value}
      </div>
      {helper && <div style={{ fontSize: 11, color: 'var(--allus-text-muted)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{helper}</div>}
    </div>
  );
}

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <div style={insightStyle}>
      <div style={{ fontSize: 10, color: 'var(--allus-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  );
}

function MiniInsight({ label, value }: { label: string; value: string }) {
  return (
    <div style={miniInsightStyle}>
      <div style={eyebrowStyle}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 14, fontWeight: 800, color: 'var(--allus-yellow)', fontFamily: 'var(--allus-font-mono)' }}>{value}</div>
    </div>
  );
}

function TeamMemberRow({ member }: { member: PulseTeamMember }) {
  const [highlighted, setHighlighted] = useState(false);
  const [liveElapsedSeconds, setLiveElapsedSeconds] = useState(member.elapsedSeconds);
  const prevStatusRef = useRef(member.status);

  useEffect(() => {
    if (member.status === 'Ativo') {
      const syncedAtMs = member.syncedAt ? new Date(member.syncedAt).getTime() : Date.now();
      const nowMs = Date.now();
      const elapsedSinceSyncMs = Math.max(0, nowMs - syncedAtMs);
      const baseLiveElapsed = member.elapsedSeconds + Math.floor(elapsedSinceSyncMs / 1000);
      setLiveElapsedSeconds(baseLiveElapsed);

      const interval = setInterval(() => {
        setLiveElapsedSeconds((prev) => prev + 1);
      }, 1000);

      return () => clearInterval(interval);
    }

    setLiveElapsedSeconds(member.elapsedSeconds);
  }, [member.status, member.elapsedSeconds, member.syncedAt]);

  useEffect(() => {
    if (prevStatusRef.current !== 'offline' && member.status === 'Concluído') {
      setHighlighted(true);
      const timer = setTimeout(() => setHighlighted(false), 1500);
      return () => clearTimeout(timer);
    }
    prevStatusRef.current = member.status;
  }, [member.status]);

  const statusDot = member.status === 'Ativo' ? '●' : member.status === 'Pausado' ? '◐' : '○';
  const statusColor = member.status === 'Ativo' ? 'var(--allus-status-ativo)' : member.status === 'Pausado' ? 'var(--allus-status-pausado)' : '#555';
  const displayTime = member.status !== 'offline' ? `${formatDuration(liveElapsedSeconds)} / ${formatDuration(member.plannedSeconds)}` : '—';
  const taskDisplay = member.currentTaskTitle
    ? `${member.clientName ? member.clientName + ' · ' : ''}${member.currentTaskTitle}`
    : '—';

  return (
    <div
      style={{
        padding: 10,
        borderRadius: 12,
        background: highlighted ? 'rgba(236, 220, 1, 0.12)' : 'rgba(255,255,255,0.04)',
        border: highlighted ? '1px solid rgba(236, 220, 1, 0.24)' : '1px solid rgba(255,255,255,0.08)',
        transition: 'all 0.25s ease',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 11,
      }}
    >
      <span style={{ color: statusColor, fontSize: 14, fontWeight: 'bold' }}>{statusDot}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: 'var(--allus-text-primary)', marginBottom: 2 }}>{member.fullName}</div>
        <div style={{ color: 'var(--allus-text-muted)', fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {taskDisplay}
        </div>
      </div>
      <div style={{ color: 'var(--allus-text-muted)', fontFamily: 'var(--allus-font-mono)', fontSize: 10, whiteSpace: 'nowrap', textAlign: 'right' }}>
        {displayTime}
      </div>
    </div>
  );
}

const pageStyle: CSSProperties = {
  padding: 16,
  flex: 1,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
};

const heroStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  alignItems: 'flex-end',
  flexWrap: 'wrap',
  padding: 16,
  borderRadius: 18,
  border: '1px solid rgba(236, 220, 1, 0.16)',
  background: 'linear-gradient(135deg, rgba(236, 220, 1, 0.10), rgba(255,255,255,0.03) 56%, rgba(0,0,0,0.08))',
};

const heroMetaStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
};

const heroMetaChipStyle: CSSProperties = {
  padding: '7px 11px',
  borderRadius: 999,
  border: '1px solid rgba(236, 220, 1, 0.16)',
  background: 'rgba(0,0,0,0.18)',
  color: 'var(--allus-text-secondary)',
  fontSize: 11,
  fontWeight: 700,
};

const refreshButtonStyle: CSSProperties = {
  minHeight: 32,
  padding: '7px 13px',
  borderRadius: 12,
  border: '1px solid rgba(236, 220, 1, 0.22)',
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--allus-text-primary)',
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: 'nowrap',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 6px 14px rgba(0,0,0,0.16)',
};

const kpiGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 10,
};

const kpiCardStyle: CSSProperties = {
  padding: 14,
  minWidth: 0,
  borderRadius: 16,
};

const summaryStripStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: 10,
};

const summaryPillStyle: CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.035)',
};

const summaryLabelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--allus-text-muted)',
};

const summaryValueStyle: CSSProperties = {
  marginTop: 5,
  fontSize: 14,
  fontWeight: 800,
  color: 'var(--allus-yellow)',
  fontFamily: 'var(--allus-font-mono)',
};

const mainGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.3fr) minmax(290px, 0.9fr)',
  gap: 14,
  alignItems: 'stretch',
};

const chartGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 0.95fr)',
  gap: 14,
};

const bottomGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.1fr)',
  gap: 14,
};

const panelStyle: CSSProperties = {
  padding: 14,
  borderRadius: 16,
  minWidth: 0,
};

const panelHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  marginBottom: 10,
};

const panelTitleStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: 'var(--allus-text-primary)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

const panelSubtitleStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--allus-text-muted)',
  marginTop: 4,
};

const eyebrowStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--allus-text-muted)',
};

const ghostButtonStyle: CSSProperties = {
  padding: '6px 10px',
  borderRadius: 12,
  border: '1px solid rgba(236, 220, 1, 0.22)',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--allus-yellow)',
  fontSize: 11,
};

const rankingRowStyle: CSSProperties = {
  display: 'flex',
  gap: 9,
  alignItems: 'center',
  padding: '8px 9px',
  borderRadius: 10,
  background: 'rgba(255,255,255,0.035)',
  border: '1px solid rgba(255,255,255,0.06)',
};

const rankingIndexStyle: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 8,
  display: 'grid',
  placeItems: 'center',
  background: 'rgba(236, 220, 1, 0.12)',
  color: 'var(--allus-yellow)',
  fontSize: 11,
  fontWeight: 800,
  flexShrink: 0,
};

const miniTrackStyle: CSSProperties = {
  height: 4,
  marginTop: 6,
  borderRadius: 999,
  background: 'rgba(255,255,255,0.08)',
  overflow: 'hidden',
};

const insightGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
  marginTop: 10,
};

const insightStyle: CSSProperties = {
  minWidth: 0,
  padding: 10,
  borderRadius: 10,
  background: 'rgba(255,255,255,0.035)',
  border: '1px solid rgba(255,255,255,0.06)',
};

const miniInsightStyle: CSSProperties = {
  padding: 10,
  borderRadius: 12,
  background: 'rgba(255,255,255,0.035)',
  border: '1px solid rgba(255,255,255,0.06)',
};

const budgetRowButtonStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: 8,
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.06)',
  background: 'rgba(255,255,255,0.03)',
  textAlign: 'left',
};

const budgetLabelRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 8,
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--allus-text-primary)',
  marginBottom: 4,
};

const budgetTrackStyle: CSSProperties = {
  width: '100%',
  height: 6,
  background: 'rgba(255,255,255,0.08)',
  borderRadius: 3,
  overflow: 'hidden',
};

const budgetPctStyle: CSSProperties = {
  fontSize: 10,
  color: 'var(--allus-text-muted)',
  fontFamily: 'var(--allus-font-mono)',
  minWidth: 40,
  textAlign: 'right',
};

const centerStateStyle: CSSProperties = {
  flex: 1,
  display: 'grid',
  placeItems: 'center',
  padding: 24,
};

const centerStateCardStyle: CSSProperties = {
  maxWidth: 520,
  width: '100%',
  padding: 18,
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
};
