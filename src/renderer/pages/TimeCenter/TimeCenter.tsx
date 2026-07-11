import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import allusWatermark from '../../assets/allus-focus-watermark.svg';
import { useAppState } from '../../useAppState';
import { Titlebar } from '../../components/Titlebar';
import { DateFilterBar } from '../../components/DateFilterBar';
import { FilterDropdown } from '../../components/FilterDropdown';
import { ToastHost } from '../../components/ToastHost';
import { invokeAction } from '../../invoke';
import { useDataRefreshKey } from '../../useDataRefreshKey';
import { formatDuration } from '../../../shared/types';
import type { DateRangeFilter, SessionDateFilter, TimeReportPerson } from '../../../shared/types';

function previousRange(filter: SessionDateFilter): DateRangeFilter | null {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).toISOString();

  if (filter === 'Hoje') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { filter: 'Intervalo', start: startOfDay(y), end: endOfDay(y) };
  }
  if (filter === '7 dias') {
    const start = new Date(now);
    start.setDate(start.getDate() - 13);
    const end = new Date(now);
    end.setDate(end.getDate() - 7);
    return { filter: 'Intervalo', start: startOfDay(start), end: endOfDay(end) };
  }
  if (filter === 'Mês') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { filter: 'Intervalo', start: start.toISOString(), end: end.toISOString() };
  }
  return null; // sem comparação sensata pra "Todas"/"Ontem"/"Intervalo" custom
}

function daysInFilter(filter: SessionDateFilter): number {
  if (filter === 'Hoje' || filter === 'Ontem') return 1;
  if (filter === '7 dias') return 7;
  if (filter === 'Mês') return new Date().getDate();
  return 1;
}

export function TimeCenter() {
  const snapshot = useAppState();
  const [filter, setFilter] = useState<SessionDateFilter>('Hoje');
  const [people, setPeople] = useState<TimeReportPerson[]>([]);
  const [total, setTotal] = useState(0);
  const [prevTotal, setPrevTotal] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [personFilter, setPersonFilter] = useState<string>('');
  const [clientFilter, setClientFilter] = useState<string>('');
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [manualRefreshTick, setManualRefreshTick] = useState(0);

  const range: DateRangeFilter = { filter };
  // A tela não escuta mudanças de sessions/task_logs de outras pessoas em
  // tempo real (só reage a mudanças na sua própria sessão/taxonomia local) —
  // por isso o botão "Atualizar" abaixo força um novo fetch manual.
  const refreshKey = useDataRefreshKey(snapshot);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    window.allus
      .invoke('report:query', { range })
      .then((result) => {
        if (cancelled) return;
        setPeople(result.people);
        setTotal(result.totalSeconds);
      })
      .catch((err) => {
        console.error('[TimeCenter] erro ao carregar relatório', err);
        if (!cancelled) {
          setPeople([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filter, refreshKey, manualRefreshTick]);

  useEffect(() => {
    const prev = previousRange(filter);
    if (!prev) {
      setPrevTotal(null);
      return;
    }
    let cancelled = false;
    window.allus
      .invoke('report:query', { range: prev })
      .then((result) => {
        if (!cancelled) setPrevTotal(result.totalSeconds);
      })
      .catch(() => {
        if (!cancelled) setPrevTotal(null);
      });
    return () => {
      cancelled = true;
    };
  }, [filter, refreshKey, manualRefreshTick]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.allus.invoke('window:closeSelf', undefined);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  function toggle(id: string) {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  }

  function expandAll() {
    const ids = new Set<string>();
    for (const person of filteredPeople) {
      ids.add(`p:${person.userId}`);
      for (const client of person.clients) {
        ids.add(`c:${client.id}`);
        for (const project of client.projects) {
          ids.add(`pr:${project.id}`);
          for (const task of project.tasks) ids.add(`t:${task.id}`);
        }
      }
    }
    setExpanded(ids);
  }

  async function handleExport() {
    await invokeAction('report:exportCsv', { range });
  }

  // Filtros client-side sobre a árvore já carregada — não dispara IPC novo.
  const filteredPeople = useMemo(() => {
    return people
      .filter((p) => !personFilter || p.userId === personFilter)
      .map((p) => ({
        ...p,
        clients: p.clients
          .filter((c) => !clientFilter || c.id === clientFilter)
          .map((c) => ({
            ...c,
            projects: c.projects.filter((pr) => !projectFilter || pr.id === projectFilter),
          }))
          .filter((c) => c.projects.length > 0),
      }))
      .filter((p) => p.clients.length > 0);
  }, [people, personFilter, clientFilter, projectFilter]);

  const filteredTotal = useMemo(() => {
    if (!personFilter && !clientFilter && !projectFilter) return total;
    return filteredPeople.reduce(
      (sum, p) => sum + p.clients.reduce((s2, c) => s2 + c.projects.reduce((s3, pr) => s3 + pr.totalSeconds, 0), 0),
      0,
    );
  }, [filteredPeople, personFilter, clientFilter, projectFilter, total]);

  const clientOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of people) {
      if (personFilter && p.userId !== personFilter) continue;
      for (const c of p.clients) map.set(c.id, c.clientName);
    }
    return Array.from(map.entries());
  }, [people, personFilter]);

  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of people) {
      if (personFilter && p.userId !== personFilter) continue;
      for (const c of p.clients) {
        if (clientFilter && c.id !== clientFilter) continue;
        for (const pr of c.projects) map.set(pr.id, pr.projectName);
      }
    }
    return Array.from(map.entries());
  }, [people, personFilter, clientFilter]);

  const avgPerDay = filteredTotal / daysInFilter(filter);
  const deltaPct = prevTotal !== null && prevTotal > 0 ? ((filteredTotal - prevTotal) / prevTotal) * 100 : null;

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
      <Titlebar title="CENTRAL DE TEMPOS · Tempo acumulado por pessoa/tarefa" />
      <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <SummaryCard label="Total no período" value={formatDuration(filteredTotal)} />
          <SummaryCard label="Média por dia" value={formatDuration(Math.round(avgPerDay))} />
          <SummaryCard
            label="Vs. período anterior"
            value={deltaPct === null ? '—' : `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(0)}%`}
            valueColor={deltaPct === null ? undefined : deltaPct >= 0 ? 'var(--allus-status-concluido)' : 'var(--allus-status-interrompido)'}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }} />
          <button
            style={pillButtonStyle}
            onClick={() => setManualRefreshTick((t) => t + 1)}
            title="Recarrega os dados agora — a tela não atualiza sozinha quando outra pessoa registra horas"
          >
            ↻ Atualizar
          </button>
          <button style={pillButtonStyle} onClick={expandAll}>Expandir tudo</button>
          <button style={pillButtonStyle} onClick={() => setExpanded(new Set())}>Recolher tudo</button>
          <button style={pillButtonStyle} onClick={handleExport} disabled={people.length === 0}>
            Exportar CSV
          </button>
        </div>

        <DateFilterBar value={filter} onChange={setFilter} />

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {people.length > 1 && (
            <FilterDropdown
              value={personFilter}
              placeholderLabel="Todas as pessoas"
              options={people.map((p) => ({ value: p.userId, label: p.fullName }))}
              onChange={(value) => {
                setPersonFilter(value);
                setClientFilter('');
                setProjectFilter('');
              }}
            />
          )}
          <FilterDropdown
            value={clientFilter}
            placeholderLabel="Todos os clientes"
            options={clientOptions.map(([id, name]) => ({ value: id, label: name }))}
            disabled={clientOptions.length === 0}
            onChange={(value) => {
              setClientFilter(value);
              setProjectFilter('');
            }}
          />
          <FilterDropdown
            value={projectFilter}
            placeholderLabel="Todos os projetos"
            options={projectOptions.map(([id, name]) => ({ value: id, label: name }))}
            disabled={projectOptions.length === 0}
            onChange={setProjectFilter}
          />
          {(personFilter || clientFilter || projectFilter) && (
            <button
              style={pillButtonStyle}
              onClick={() => {
                setPersonFilter('');
                setClientFilter('');
                setProjectFilter('');
              }}
            >
              Limpar filtros
            </button>
          )}
        </div>

        <section style={listHeaderStyle}>
          <div>
            <div style={sectionKickerStyle}>Time</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>Horas por pessoa</div>
          </div>
          <div style={listHintStyle}>Clique numa linha pra expandir clientes, projetos e tarefas.</div>
        </section>

        <div style={treeListStyle}>
          {loading && <div style={{ fontSize: 13, color: 'var(--allus-text-muted)', padding: '8px 6px' }}>Carregando...</div>}
          {!loading && filteredPeople.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--allus-text-muted)', padding: '8px 6px' }}>
              {people.length === 0 ? 'Nenhuma tarefa registrada neste período.' : 'Nenhum resultado para esses filtros.'}
            </div>
          )}
          {filteredPeople.map((person) => {
            const personSeconds = person.clients.reduce((s, c) => s + c.projects.reduce((s2, p) => s2 + p.totalSeconds, 0), 0);
            const personSessions = person.clients.reduce(
              (s, c) => s + c.projects.reduce((s2, p) => s2 + p.tasks.reduce((s3, t) => s3 + t.totalSessionCount, 0), 0),
              0,
            );
            return (
              <div key={person.userId} style={personGroupStyle}>
                <div className="allus-tree-row" style={personRowStyle} onClick={() => toggle(`p:${person.userId}`)}>
                  <span style={chevronStyle}>{expanded.has(`p:${person.userId}`) ? '▾' : '▸'}</span>
                  <span style={personAvatarStyle}>{getInitials(person.fullName)}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ color: 'var(--allus-yellow)', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {person.fullName}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--allus-text-muted)', marginTop: 2 }}>
                      {person.clients.length} cliente(s) · {personSessions} sessão(ões)
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--allus-text-muted)', whiteSpace: 'nowrap' }}>{personSessions}</span>
                  <span style={{ fontFamily: 'var(--allus-font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--allus-yellow)', whiteSpace: 'nowrap' }}>
                    {formatDuration(personSeconds)}
                  </span>
                </div>

                {expanded.has(`p:${person.userId}`) && (
                  <div style={clientBlockStyle}>
                    {person.clients.map((client) => (
                      <div key={client.id}>
                        <TreeRow
                          label={client.clientName}
                          seconds={client.projects.reduce((s, p) => s + p.totalSeconds, 0)}
                          expandable
                          expanded={expanded.has(`c:${client.id}`)}
                          onToggle={() => toggle(`c:${client.id}`)}
                        />
                        {expanded.has(`c:${client.id}`) && (
                          <div style={projectBlockStyle}>
                            {client.projects.map((project) => (
                              <div key={project.id}>
                                <TreeRow
                                  label={project.projectName}
                                  color="var(--allus-yellow)"
                                  seconds={project.totalSeconds}
                                  expandable
                                  expanded={expanded.has(`pr:${project.id}`)}
                                  onToggle={() => toggle(`pr:${project.id}`)}
                                />
                                {expanded.has(`pr:${project.id}`) && (
                                  <div style={taskBlockStyle}>
                                    {project.tasks.map((task) => (
                                      <div key={task.id}>
                                        <TreeRow
                                          label={task.title}
                                          seconds={task.totalSeconds}
                                          sessions={task.totalSessionCount}
                                          expandable={task.subtasks.length > 0}
                                          expanded={expanded.has(`t:${task.id}`)}
                                          onToggle={() => toggle(`t:${task.id}`)}
                                        />
                                        {expanded.has(`t:${task.id}`) && (
                                          <div style={taskChildrenStyle}>
                                            {task.directSeconds > 0 && (
                                              <TreeRow label="Direto na tarefa" seconds={task.directSeconds} muted />
                                            )}
                                            {task.subtasks.map((sub) => (
                                              <TreeRow key={sub.id} label={sub.title} seconds={sub.totalSeconds} sessions={sub.sessionCount} />
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <ToastHost />
    </div>
  );
}

function SummaryCard({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 140,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid var(--allus-glass-border)',
        borderRadius: 12,
        padding: '10px 14px',
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--allus-text-muted)' }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          fontFamily: 'var(--allus-font-mono)',
          color: valueColor ?? 'var(--allus-yellow)',
          marginTop: 2,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TreeRow({
  label,
  color,
  seconds,
  sessions,
  expandable,
  expanded,
  onToggle,
  muted,
}: {
  label: string;
  color?: string;
  seconds: number;
  sessions?: number;
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  muted?: boolean;
}) {
  return (
    <div
      className={expandable ? 'allus-tree-row' : undefined}
      style={{ ...treeRowStyle, cursor: expandable ? 'pointer' : 'default' }}
      onClick={expandable ? onToggle : undefined}
    >
      <span style={chevronStyle}>{expandable ? (expanded ? '▾' : '▸') : ''}</span>
      <span
        style={{
          color: muted ? 'var(--allus-text-muted)' : color,
          fontWeight: color ? 700 : 500,
          minWidth: 0,
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 11, color: 'var(--allus-text-muted)', whiteSpace: 'nowrap' }}>{sessions ?? ''}</span>
      <span style={{ fontFamily: 'var(--allus-font-mono)', fontSize: 12, whiteSpace: 'nowrap' }}>{formatDuration(seconds)}</span>
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const initials = parts.length === 1 ? parts[0].slice(0, 2) : `${parts[0][0]}${parts[parts.length - 1][0]}`;
  return initials.toUpperCase();
}

const pillButtonStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 999,
  border: '1px solid var(--allus-glass-border)',
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--allus-text-primary)',
  fontSize: 12,
  whiteSpace: 'nowrap',
};

const listHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: 16,
  padding: '2px 4px',
};

const sectionKickerStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  color: 'var(--allus-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

const listHintStyle: React.CSSProperties = {
  maxWidth: 360,
  fontSize: 11,
  color: 'var(--allus-text-muted)',
  textAlign: 'right',
};

const treeListStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  paddingRight: 4,
};

const personGroupStyle: React.CSSProperties = {
  borderRadius: 14,
  border: '1px solid rgba(236,220,1,0.10)',
  background: 'linear-gradient(135deg, rgba(236,220,1,0.045), rgba(255,255,255,0.018))',
  overflow: 'visible',
  minWidth: 0,
};

const personRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 12px',
  fontSize: 13,
  cursor: 'pointer',
  minWidth: 0,
};

const personAvatarStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 10,
  display: 'grid',
  placeItems: 'center',
  background: 'rgba(236,220,1,0.14)',
  color: 'var(--allus-yellow)',
  fontSize: 11,
  fontWeight: 900,
  flexShrink: 0,
};

const clientBlockStyle: React.CSSProperties = {
  marginLeft: 18,
  marginRight: 6,
  borderLeft: '1px solid rgba(236,220,1,0.16)',
  paddingLeft: 8,
  paddingBottom: 10,
  minWidth: 0,
};

const projectBlockStyle: React.CSSProperties = {
  marginLeft: 8,
  paddingLeft: 6,
  borderLeft: '1px solid rgba(255,255,255,0.08)',
  minWidth: 0,
};

const taskBlockStyle: React.CSSProperties = {
  marginLeft: 8,
  paddingLeft: 6,
  borderLeft: '1px solid rgba(255,255,255,0.08)',
  minWidth: 0,
};

const taskChildrenStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  marginLeft: 8,
  paddingLeft: 8,
  paddingBottom: 4,
  borderLeft: '1px solid rgba(126,242,155,0.18)',
  minWidth: 0,
};

const chevronStyle: React.CSSProperties = {
  width: 14,
  color: 'var(--allus-yellow)',
  fontSize: 11,
  flexShrink: 0,
};

const treeRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '7px 9px',
  borderRadius: 8,
  fontSize: 13,
  minWidth: 0,
};
