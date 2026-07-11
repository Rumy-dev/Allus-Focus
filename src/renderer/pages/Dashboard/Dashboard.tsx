import { useMemo, useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import allusWatermark from '../../assets/allus-focus-watermark.svg';
import { useAppState } from '../../useAppState';
import { invokeAction } from '../../invoke';
import { Titlebar } from '../../components/Titlebar';
import { DateFilterBar } from '../../components/DateFilterBar';
import { BarChart } from '../../components/BarChart';
import { TrendChart } from '../../components/TrendChart';
import { ToastHost } from '../../components/ToastHost';
import { FilterDropdown } from '../../components/FilterDropdown';
import { useDataRefreshKey } from '../../useDataRefreshKey';
import type { DateRangeFilter, SessionDateFilter, TimeReportPerson } from '../../../shared/types';

type DrillLevel = 'clients' | 'projects' | 'tasks';

interface DrillState {
  level: DrillLevel;
  clientId?: string;
  projectId?: string;
  label?: string;
}

interface ChartItem {
  id: string;
  label: string;
  value: number;
}

export function Dashboard() {
  const snapshot = useAppState();
  const isAdmin = snapshot?.auth.profile?.role === 'admin';
  const ownUserId = snapshot?.auth.profile?.id ?? null;
  const [sessionFilter, setSessionFilter] = useState<SessionDateFilter>('Mês');
  const range: DateRangeFilter = { filter: sessionFilter };
  const [drill, setDrill] = useState<DrillState>({ level: 'clients' });
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const effectiveUserId = isAdmin ? selectedUserId : ownUserId;
  const [report, setReport] = useState<{ people: TimeReportPerson[] } | null>(null);
  const [trend, setTrend] = useState<{ date: string; totalSeconds: number }[]>([]);
  const [manualRefreshTick, setManualRefreshTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshKey = useDataRefreshKey(snapshot);

  const loadReport = async () => {
    try {
      const result = await invokeAction('report:query', { range });
      if (result) setReport(result);
    } catch (err) {
      console.error('Erro ao carregar relatório', err);
    }
  };

  const loadTrend = async () => {
    try {
      const trendData = await invokeAction('dashboard:trend', {
        range,
        clientId: drill.clientId,
        projectId: drill.projectId,
        userId: effectiveUserId ?? undefined,
      });
      if (trendData) setTrend(trendData);
    } catch (err) {
      console.error('Erro ao carregar tendência', err);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setRefreshing(true);
    Promise.allSettled([loadReport(), loadTrend()]).finally(() => {
      if (!cancelled) setRefreshing(false);
    });
    return () => {
      cancelled = true;
    };
  }, [sessionFilter, drill, effectiveUserId, refreshKey, manualRefreshTick]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.allus.invoke('window:closeSelf', undefined);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const filteredPeople = useMemo(() => {
    if (!report) return [];
    if (!effectiveUserId) return report.people;
    return report.people.filter((p) => p.userId === effectiveUserId);
  }, [report, effectiveUserId]);

  const peopleNames = useMemo(() => {
    if (!report) return [];
    return report.people.map((p) => ({ id: p.userId, name: p.fullName }));
  }, [report]);

  const personData = useMemo<ChartItem[]>(() => {
    if (!report || effectiveUserId) return [];
    return report.people
      .map((p) => ({
        id: p.userId,
        label: p.fullName,
        value: p.clients.reduce((sum, c) => sum + c.totalSeconds, 0),
      }))
      .sort((a, b) => b.value - a.value);
  }, [report, selectedUserId]);

  const drillItems = useMemo<ChartItem[]>(() => {
    if (filteredPeople.length === 0) return [];

    if (drill.level === 'clients') {
      const map = new Map<string, ChartItem>();
      for (const person of filteredPeople) {
        for (const client of person.clients) {
          const current = map.get(client.id);
          map.set(client.id, {
            id: client.id,
            label: client.clientName,
            value: (current?.value ?? 0) + client.totalSeconds,
          });
        }
      }
      return Array.from(map.values()).sort((a, b) => b.value - a.value);
    }

    if (drill.level === 'projects' && drill.clientId) {
      const map = new Map<string, ChartItem>();
      for (const person of filteredPeople) {
        const client = person.clients.find((c) => c.id === drill.clientId);
        if (!client) continue;
        for (const project of client.projects) {
          const current = map.get(project.id);
          map.set(project.id, {
            id: project.id,
            label: project.projectName,
            value: (current?.value ?? 0) + project.totalSeconds,
          });
        }
      }
      return Array.from(map.values()).sort((a, b) => b.value - a.value);
    }

    if (drill.level === 'tasks' && drill.projectId) {
      const map = new Map<string, ChartItem>();
      for (const person of filteredPeople) {
        for (const client of person.clients) {
          const project = client.projects.find((p) => p.id === drill.projectId);
          if (!project) continue;
          for (const task of project.tasks) {
            const current = map.get(task.id);
            map.set(task.id, {
              id: task.id,
              label: task.title,
              value: (current?.value ?? 0) + task.totalSeconds,
            });
          }
        }
      }
      return Array.from(map.values()).sort((a, b) => b.value - a.value);
    }

    return [];
  }, [filteredPeople, drill]);

  const typeData = useMemo<ChartItem[]>(() => {
    if (!snapshot) return [];
    const map = new Map<string, number>();
    for (const person of filteredPeople) {
      for (const client of person.clients) {
        for (const project of client.projects) {
          const type = snapshot.projects.find((p) => p.id === project.id)?.type || 'Sem tipo';
          map.set(type, (map.get(type) ?? 0) + project.totalSeconds);
        }
      }
    }
    return Array.from(map.entries())
      .map(([label, value]) => ({ id: label, label, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredPeople, snapshot]);

  const totalSeconds = useMemo(
    () => filteredPeople.reduce((sum, p) => sum + p.clients.reduce((s, c) => s + c.totalSeconds, 0), 0),
    [filteredPeople],
  );

  const activePeople = useMemo(() => {
    return filteredPeople.filter((p) => p.clients.reduce((sum, c) => sum + c.totalSeconds, 0) > 0).length;
  }, [filteredPeople]);

  const topPerson = personData[0] ?? null;
  const topFocus = drillItems[0] ?? null;
  const avgPerPerson = activePeople > 0 ? Math.round(totalSeconds / activePeople) : 0;
  const topFocusShare = totalSeconds > 0 && topFocus ? Math.round((topFocus.value / totalSeconds) * 100) : 0;
  const trendTotal = trend.reduce((sum, point) => sum + point.totalSeconds, 0);
  const trendAvg = trend.length > 0 ? Math.round(trendTotal / trend.length) : 0;

  const drillTitle =
    drill.level === 'clients'
      ? 'Horas por cliente'
      : drill.level === 'projects'
        ? `Projetos de ${drill.label ?? 'cliente'}`
        : `Tarefas de ${drill.label ?? 'projeto'}`;

  if (!snapshot) return <div className="allus-app-bg" style={{ height: '100%' }} />;

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
      <Titlebar title={isAdmin ? 'PAINEL DO GESTOR' : 'MEU PAINEL'} />
      <div style={pageStyle}>
        <section style={heroStyle}>
          <div>
            <div style={eyebrowStyle}>{isAdmin ? 'Visão executiva' : 'Seus dados'}</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 3 }}>{isAdmin ? 'Foco do time' : 'Seu foco'}</div>
            <div style={{ fontSize: 12, color: 'var(--allus-text-secondary)', marginTop: 4 }}>
              Período: {sessionFilter} {isAdmin ? (selectedUserId ? '· pessoa filtrada' : '· equipe completa') : ''}
            </div>
          </div>
          <div style={filtersStyle}>
            <DateFilterBar value={sessionFilter} onChange={setSessionFilter} />
            <button
              type="button"
              style={refreshButtonStyle}
              onClick={() => setManualRefreshTick((tick) => tick + 1)}
              disabled={refreshing}
              title="Atualizar dados do painel"
            >
              {refreshing ? 'Atualizando...' : '↻ Atualizar'}
            </button>
            {isAdmin && (
              <div style={personFilterStyle}>
                <span style={filterLabelTextStyle}>Pessoa</span>
                <FilterDropdown
                  value={selectedUserId ?? ''}
                  placeholderLabel="Todas"
                  options={peopleNames.map((p) => ({ value: p.id, label: p.name }))}
                  onChange={(value) => {
                    setSelectedUserId(value || null);
                    setDrill({ level: 'clients' });
                  }}
                  style={{ maxWidth: 180 }}
                />
              </div>
            )}
          </div>
        </section>

        <section style={kpiGridStyle}>
          <KpiCard label="Horas no período" value={formatTime(totalSeconds)} accent />
          {isAdmin && (
            <KpiCard label="Pessoas com foco" value={`${activePeople}/${filteredPeople.length || 0}`} helper="com horas registradas" />
          )}
          {isAdmin && <KpiCard label="Média por pessoa" value={formatTime(avgPerPerson)} helper="entre pessoas ativas" />}
          <KpiCard label="Maior concentração" value={`${topFocusShare}%`} helper={topFocus?.label ?? 'sem dados'} />
        </section>

        <section style={mainGridStyle}>
          <div className="allus-glass" style={panelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <div style={panelTitleStyle}>{drillTitle}</div>
                <div style={panelSubtitleStyle}>Clique em uma barra para aprofundar</div>
              </div>
              {drill.level !== 'clients' && (
                <button
                  onClick={() => {
                    if (drill.level === 'projects') {
                      setDrill({ level: 'clients' });
                    } else {
                      setDrill({ level: 'projects', clientId: drill.clientId, label: drill.label });
                    }
                  }}
                  style={ghostButtonStyle}
                >
                  Voltar
                </button>
              )}
            </div>
            <BarChart
              title=""
              items={drillItems}
              color={drill.level === 'clients' ? '#ecdc01' : drill.level === 'projects' ? '#b8ac00' : '#f5ec6b'}
              onItemClick={(item) => {
                if (drill.level === 'clients') {
                  setDrill({ level: 'projects', clientId: item.id, label: item.label });
                } else if (drill.level === 'projects') {
                  setDrill({ level: 'tasks', clientId: drill.clientId, projectId: item.id, label: item.label });
                }
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
            <div className="allus-glass" style={panelStyle}>
              <div style={panelTitleStyle}>{isAdmin ? 'Ranking da equipe' : 'Onde você mais focou'}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 12 }}>
                {(isAdmin && !selectedUserId ? personData : drillItems).slice(0, 6).map((item, index) => (
                  <RankingRow key={item.id} index={index + 1} label={item.label} seconds={item.value} totalSeconds={totalSeconds} />
                ))}
                {(isAdmin && !selectedUserId ? personData : drillItems).length === 0 && (
                  <div style={emptyStyle}>Sem dados para o período.</div>
                )}
              </div>
            </div>

            <div className="allus-glass" style={panelStyle}>
              <div style={panelTitleStyle}>Leitura rápida</div>
              <div style={insightGridStyle}>
                {isAdmin && <Insight label="Pessoa destaque" value={topPerson?.label ?? '—'} />}
                <Insight label="Foco principal" value={topFocus?.label ?? '—'} />
                <Insight label="Média diária" value={formatTime(trendAvg)} />
                <Insight label="Tipos ativos" value={String(typeData.filter((i) => i.value > 0).length)} />
              </div>
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

function RankingRow({ index, label, seconds, totalSeconds }: { index: number; label: string; seconds: number; totalSeconds: number }) {
  const pct = totalSeconds > 0 ? Math.max(4, (seconds / totalSeconds) * 100) : 0;
  return (
    <div style={rankingRowStyle}>
      <span style={rankingIndexStyle}>{index}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
          <span style={{ color: 'var(--allus-yellow)', fontFamily: 'var(--allus-font-mono)' }}>{formatTime(seconds)}</span>
        </div>
        <div style={miniTrackStyle}>
          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: 'var(--allus-gradient)' }} />
        </div>
      </div>
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

function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m`;
}

const pageStyle: React.CSSProperties = {
  padding: 16,
  flex: 1,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
};

const heroStyle: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
};

const filtersStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'flex-end',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
};

const filterLabelTextStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  color: 'var(--allus-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};

const personFilterStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
  padding: 8,
  borderRadius: 14,
  border: '1px solid rgba(236, 220, 1, 0.18)',
  background: 'linear-gradient(135deg, rgba(236, 220, 1, 0.07), rgba(255,255,255,0.025))',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 18px rgba(0,0,0,0.16)',
};

const refreshButtonStyle: React.CSSProperties = {
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

const kpiGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 10,
};

const kpiCardStyle: React.CSSProperties = {
  padding: 14,
  minWidth: 0,
  borderRadius: 14,
};

const mainGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.45fr) minmax(280px, 0.85fr)',
  gap: 14,
  alignItems: 'stretch',
};

const bottomGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.1fr)',
  gap: 14,
};

const panelStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 14,
  minWidth: 0,
};

const panelHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  marginBottom: 8,
};

const panelTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: 'var(--allus-text-primary)',
};

const panelSubtitleStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--allus-text-muted)',
  marginTop: 3,
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--allus-text-muted)',
};

const ghostButtonStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 12,
  border: '1px solid rgba(236, 220, 1, 0.22)',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--allus-yellow)',
  fontSize: 11,
};

const rankingRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 9,
  alignItems: 'center',
  padding: '8px 9px',
  borderRadius: 10,
  background: 'rgba(255,255,255,0.035)',
  border: '1px solid rgba(255,255,255,0.06)',
};

const rankingIndexStyle: React.CSSProperties = {
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

const miniTrackStyle: React.CSSProperties = {
  height: 4,
  marginTop: 6,
  borderRadius: 999,
  background: 'rgba(255,255,255,0.08)',
  overflow: 'hidden',
};

const insightGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
  marginTop: 12,
};

const insightStyle: React.CSSProperties = {
  minWidth: 0,
  padding: 10,
  borderRadius: 10,
  background: 'rgba(255,255,255,0.035)',
  border: '1px solid rgba(255,255,255,0.06)',
};

const emptyStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--allus-text-muted)',
  padding: 10,
};
