import { useMemo, useState } from 'react';
import { useAppState } from '../../useAppState';
import { Titlebar } from '../../components/Titlebar';
import type { Project, Task } from '../../../shared/types';

export function TaskCenter() {
  const snapshot = useAppState();
  const [search, setSearch] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [clientField, setClientField] = useState('');
  const [projectField, setProjectField] = useState('');
  const [newTaskField, setNewTaskField] = useState('');
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [newSubtaskField, setNewSubtaskField] = useState<Record<string, string>>({});
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);

  const grouped = useMemo(() => {
    if (!snapshot) return [];
    const term = search.trim().toLowerCase();
    const clients = snapshot.clients
      .map((client) => {
        const projects = snapshot.projects.filter((p) => p.clientId === client.id);
        return { client, projects };
      })
      .filter(
        ({ client, projects }) =>
          !term ||
          client.name.toLowerCase().includes(term) ||
          projects.some((p) => p.name.toLowerCase().includes(term)),
      );
    return clients;
  }, [snapshot, search]);

  if (!snapshot) return <div className="allus-app-bg" style={{ height: '100%' }} />;

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  function selectProjectForEdit(project: Project | null) {
    setSelectedProjectId(project?.id ?? null);
    if (project) {
      const client = snapshot!.clients.find((c) => c.id === project.clientId);
      setClientField(client?.name ?? '');
      setProjectField(project.name);
    } else {
      setClientField('');
      setProjectField('');
    }
  }

  async function saveProject() {
    if (selectedProjectId) {
      await window.allus.invoke('project:update', { projectId: selectedProjectId, clientName: clientField, projectName: projectField });
    } else {
      await window.allus.invoke('project:add', { clientName: clientField, projectName: projectField });
    }
    selectProjectForEdit(null);
  }

  async function addTaskToSelected() {
    if (!selectedProjectId || !newTaskField.trim()) return;
    await window.allus.invoke('taskTree:add', { projectId: selectedProjectId, parentTaskId: null, title: newTaskField.trim() });
    setNewTaskField('');
  }

  function topLevelTasks(projectId: string): Task[] {
    return snapshot!.tasks.filter((t) => t.projectId === projectId && !t.parentTaskId);
  }

  function subtasksOf(taskId: string): Task[] {
    return snapshot!.tasks.filter((t) => t.parentTaskId === taskId);
  }

  return (
    <div className="allus-app-bg" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Titlebar title="CENTRAL DE TAREFAS · Cliente → Projeto → Tarefa → Subtarefa" />
      <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1, overflow: 'hidden' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cliente ou projeto..."
          style={inputStyle}
        />

        <section className="allus-glass" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={clientField} onChange={(e) => setClientField(e.target.value)} placeholder="Cliente" style={{ ...inputStyle, flex: 1 }} />
            <input value={projectField} onChange={(e) => setProjectField(e.target.value)} placeholder="Projeto" style={{ ...inputStyle, flex: 1 }} />
            <button style={pillButtonStyle} onClick={saveProject}>Salvar projeto</button>
            {selectedProjectId && (
              <button
                style={pillButtonStyle}
                onClick={async () => {
                  await window.allus.invoke('project:delete', { projectId: selectedProjectId });
                  selectProjectForEdit(null);
                }}
              >
                🗑
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={newTaskField}
              onChange={(e) => setNewTaskField(e.target.value)}
              placeholder="Nova tarefa neste projeto"
              style={{ ...inputStyle, flex: 1 }}
              disabled={!selectedProjectId}
            />
            <button style={pillButtonStyle} onClick={addTaskToSelected} disabled={!selectedProjectId}>
              Adicionar tarefa
            </button>
            <button style={pillButtonStyle} onClick={() => selectProjectForEdit(null)}>
              Novo projeto
            </button>
          </div>
        </section>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {grouped.map(({ client, projects }) => (
            <div key={client.id}>
              <div
                style={rowStyle}
                onClick={() => toggle(expandedClients, setExpandedClients, client.id)}
              >
                <span>{expandedClients.has(client.id) ? '▾' : '▸'}</span>
                <strong style={{ color: 'var(--allus-purple)' }}>{client.name}</strong>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--allus-text-muted)' }}>
                  {projects.length} projeto(s)
                </span>
              </div>

              {expandedClients.has(client.id) &&
                projects.map((project) => (
                  <div key={project.id} style={{ marginLeft: 18 }}>
                    <div style={rowStyle} onClick={() => toggle(expandedProjects, setExpandedProjects, project.id)}>
                      <span>{expandedProjects.has(project.id) ? '▾' : '▸'}</span>
                      <span style={{ color: 'var(--allus-cyan)' }}>{project.name}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--allus-text-muted)' }}>
                        {topLevelTasks(project.id).length} tarefa(s)
                      </span>
                      <button
                        className="allus-no-drag"
                        style={iconGhostButtonStyle}
                        onClick={(e) => {
                          e.stopPropagation();
                          selectProjectForEdit(project);
                        }}
                      >
                        ⚙
                      </button>
                    </div>

                    {expandedProjects.has(project.id) &&
                      topLevelTasks(project.id).map((task) => (
                        <div key={task.id} style={{ marginLeft: 18 }}>
                          <TaskRow
                            task={task}
                            renaming={renaming}
                            setRenaming={setRenaming}
                            onToggleExpand={() => toggle(expandedTasks, setExpandedTasks, task.id)}
                            expanded={expandedTasks.has(task.id)}
                            subtaskCount={subtasksOf(task.id).length}
                          />
                          {expandedTasks.has(task.id) && (
                            <div style={{ marginLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {subtasksOf(task.id).map((sub) => (
                                <TaskRow key={sub.id} task={sub} renaming={renaming} setRenaming={setRenaming} />
                              ))}
                              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                <input
                                  value={newSubtaskField[task.id] ?? ''}
                                  onChange={(e) => setNewSubtaskField({ ...newSubtaskField, [task.id]: e.target.value })}
                                  placeholder="Nova subtarefa"
                                  style={{ ...inputStyle, flex: 1, padding: '4px 8px', fontSize: 12 }}
                                />
                                <button
                                  style={pillButtonStyle}
                                  onClick={async () => {
                                    const title = newSubtaskField[task.id]?.trim();
                                    if (!title) return;
                                    await window.allus.invoke('taskTree:add', { projectId: project.id, parentTaskId: task.id, title });
                                    setNewSubtaskField({ ...newSubtaskField, [task.id]: '' });
                                  }}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TaskRow({
  task,
  renaming,
  setRenaming,
  onToggleExpand,
  expanded,
  subtaskCount,
}: {
  task: Task;
  renaming: { id: string; value: string } | null;
  setRenaming: (v: { id: string; value: string } | null) => void;
  onToggleExpand?: () => void;
  expanded?: boolean;
  subtaskCount?: number;
}) {
  const isRenaming = renaming?.id === task.id;
  return (
    <div style={rowStyle}>
      {onToggleExpand && (
        <span onClick={onToggleExpand} style={{ cursor: 'pointer' }}>
          {expanded ? '▾' : '▸'}
        </span>
      )}
      <input
        type="checkbox"
        checked={task.isDone}
        onChange={() => window.allus.invoke('taskTree:toggleDone', { taskId: task.id })}
      />
      {isRenaming ? (
        <>
          <input
            autoFocus
            value={renaming.value}
            onChange={(e) => setRenaming({ id: task.id, value: e.target.value })}
            style={{ ...inputStyle, padding: '2px 6px', fontSize: 12 }}
          />
          <button
            style={iconGhostButtonStyle}
            onClick={async () => {
              await window.allus.invoke('taskTree:rename', { taskId: task.id, title: renaming.value });
              setRenaming(null);
            }}
          >
            ✓
          </button>
          <button style={iconGhostButtonStyle} onClick={() => setRenaming(null)}>✕</button>
        </>
      ) : (
        <span style={{ flex: 1, textDecoration: task.isDone ? 'line-through' : undefined }} onDoubleClick={() => setRenaming({ id: task.id, value: task.title })}>
          {task.title}
        </span>
      )}
      {subtaskCount !== undefined && subtaskCount > 0 && (
        <span style={{ fontSize: 11, color: 'var(--allus-text-muted)' }}>{subtaskCount} subtarefa(s)</span>
      )}
      <button
        style={iconGhostButtonStyle}
        onClick={() => window.allus.invoke('task:focus', { taskId: task.id, subtaskId: null, title: task.title })}
      >
        Focar
      </button>
      <button style={iconGhostButtonStyle} onClick={() => window.allus.invoke('taskTree:delete', { taskId: task.id })}>
        🗑
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid var(--allus-glass-border)',
  borderRadius: 10,
  padding: '8px 10px',
  color: 'var(--allus-text-primary)',
  outline: 'none',
  fontSize: 13,
};

const pillButtonStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 999,
  border: '1px solid var(--allus-glass-border)',
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--allus-text-primary)',
  fontSize: 12,
  whiteSpace: 'nowrap',
};

const iconGhostButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--allus-text-muted)',
  fontSize: 12,
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 8px',
  borderRadius: 8,
  fontSize: 13,
  cursor: 'pointer',
};
