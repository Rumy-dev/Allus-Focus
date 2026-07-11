import { useMemo, useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import allusWatermark from '../../assets/allus-focus-watermark.svg';
import { useAppState } from '../../useAppState';
import { Titlebar } from '../../components/Titlebar';
import { ToastHost } from '../../components/ToastHost';
import { ContextMenu } from '../../components/ContextMenu';
import type { ContextMenuItem } from '../../components/ContextMenu';
import { invokeAction, confirmDialog } from '../../invoke';
import type { Client, Project, Task, TaskPriority, TaskStatus, TeamMember } from '../../../shared/types';

const TASK_STATUSES: TaskStatus[] = ['Pendente', 'Em andamento', 'Bloqueado', 'Concluído'];
const TASK_PRIORITIES: TaskPriority[] = ['Alta', 'Média', 'Baixa'];
const STATUS_COLOR: Record<TaskStatus, string> = {
  Pendente: '#ffd166', // amarelo/âmbar
  'Em andamento': 'var(--allus-status-ativo)', // amarelo forte — mesma cor que "Ativo" já usa no resto do app
  Bloqueado: 'var(--allus-status-interrompido)', // vermelho
  Concluído: 'var(--allus-status-concluido)', // verde
};
const STATUS_BG: Record<TaskStatus, string> = {
  Pendente: 'rgba(255, 209, 102, 0.16)',
  'Em andamento': 'rgba(236, 220, 1, 0.16)',
  Bloqueado: 'rgba(255, 107, 107, 0.16)',
  Concluído: 'rgba(126, 242, 155, 0.16)',
};
const PRIORITY_COLOR: Record<TaskPriority, string> = {
  Alta: 'var(--allus-status-interrompido)',
  Média: 'var(--allus-status-pausado)',
  Baixa: 'var(--allus-text-muted)',
};
import { Z } from '../../styles/zIndex';

interface Clipboard {
  taskId: string;
  title: string;
  cut: boolean;
}

interface MenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

export function TaskCenter() {
  const snapshot = useAppState();
  const [search, setSearch] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [clientField, setClientField] = useState('');
  const [projectField, setProjectField] = useState('');
  const [typeField, setTypeField] = useState('');
  const [newTaskField, setNewTaskField] = useState('');
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [newSubtaskField, setNewSubtaskField] = useState<Record<string, string>>({});
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [savingProject, setSavingProject] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [clipboard, setClipboard] = useState<Clipboard | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [moveTask, setMoveTask] = useState<Task | null>(null);
  const [propsTask, setPropsTask] = useState<Task | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.allus.invoke('window:closeSelf', undefined);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const grouped = useMemo(() => {
    if (!snapshot) return [];
    const term = search.trim().toLowerCase();
    const clients = snapshot.clients
      .filter((c) => showArchived === !!c.archivedAt)
      .map((client) => {
        const projects = snapshot.projects.filter(
          (p) => p.clientId === client.id && showArchived === !!p.archivedAt,
        );
        return { client, projects };
      })
      .filter(
        ({ client, projects }) =>
          !term ||
          client.name.toLowerCase().includes(term) ||
          projects.some((p) => p.name.toLowerCase().includes(term)),
      );
    return clients;
  }, [snapshot, search, showArchived]);

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
      setTypeField(project.type ?? '');
    } else {
      setClientField('');
      setProjectField('');
      setTypeField('');
    }
  }

  async function saveProject() {
    setSavingProject(true);
    if (selectedProjectId) {
      await invokeAction('project:update', {
        projectId: selectedProjectId,
        clientName: clientField,
        projectName: projectField,
        type: typeField,
      });
    } else {
      await invokeAction('project:add', { clientName: clientField, projectName: projectField, type: typeField });
    }
    setSavingProject(false);
    selectProjectForEdit(null);
  }

  async function archiveProjectById(project: Project) {
    if (!confirmDialog(`Arquivar o projeto "${project.name}"? As tarefas dentro dele também são arquivadas — pode restaurar depois em "Ver arquivados".`)) return;
    await invokeAction('project:archive', { projectId: project.id });
    if (selectedProjectId === project.id) selectProjectForEdit(null);
  }

  async function unarchiveProjectById(project: Project) {
    await invokeAction('project:unarchive', { projectId: project.id });
  }

  async function addTaskToSelected() {
    if (!selectedProjectId || !newTaskField.trim()) return;
    setAddingTask(true);
    await invokeAction('taskTree:add', { projectId: selectedProjectId, parentTaskId: null, title: newTaskField.trim() });
    setAddingTask(false);
    setNewTaskField('');
  }

  async function archiveTask(task: Task) {
    if (!confirmDialog(`Arquivar "${task.title}"? Pode restaurar depois em "Ver arquivados".`)) return;
    await invokeAction('taskTree:archive', { taskId: task.id });
  }

  async function unarchiveTask(task: Task) {
    await invokeAction('taskTree:unarchive', { taskId: task.id });
  }

  async function pasteInto(project: Project) {
    if (!clipboard) return;
    await invokeAction('taskTree:add', { projectId: project.id, parentTaskId: null, title: clipboard.title });
    if (clipboard.cut) {
      await invokeAction('taskTree:archive', { taskId: clipboard.taskId });
    }
    setClipboard(null);
  }

  function topLevelTasks(projectId: string): Task[] {
    return snapshot!.tasks.filter(
      (t) => t.projectId === projectId && !t.parentTaskId && showArchived === !!t.archivedAt,
    );
  }

  function subtasksOf(taskId: string): Task[] {
    return snapshot!.tasks.filter((t) => t.parentTaskId === taskId && showArchived === !!t.archivedAt);
  }

  function openProjectMenu(pos: { x: number; y: number }, project: Project) {
    const items: ContextMenuItem[] = project.archivedAt
      ? [{ label: 'Restaurar projeto', onClick: () => unarchiveProjectById(project) }]
      : [
          { label: 'Selecionar', onClick: () => selectProjectForEdit(project) },
          {
            label: 'Colar tarefa aqui',
            disabled: !clipboard,
            onClick: () => pasteInto(project),
          },
          { label: 'Arquivar projeto', danger: true, onClick: () => archiveProjectById(project) },
        ];
    setMenu({ x: pos.x, y: pos.y, items });
  }

  function openTaskMenu(pos: { x: number; y: number }, task: Task) {
    const items: ContextMenuItem[] = task.archivedAt
      ? [{ label: 'Restaurar tarefa', onClick: () => unarchiveTask(task) }]
      : [
          { label: 'Focar', onClick: () => invokeAction('task:focus', { taskId: task.id, subtaskId: null, title: task.title }) },
          { label: 'Renomear', onClick: () => setRenaming({ id: task.id, value: task.title }) },
          { label: 'Copiar', onClick: () => setClipboard({ taskId: task.id, title: task.title, cut: false }) },
          { label: 'Recortar', onClick: () => setClipboard({ taskId: task.id, title: task.title, cut: true }) },
          { label: 'Mover para...', onClick: () => setMoveTask(task) },
          { label: 'Propriedades', onClick: () => setPropsTask(task) },
          { label: 'Arquivar', danger: true, onClick: () => archiveTask(task) },
        ];
    setMenu({ x: pos.x, y: pos.y, items });
  }

  function onProjectContextMenu(e: React.MouseEvent, project: Project) {
    e.preventDefault();
    e.stopPropagation();
    openProjectMenu({ x: e.clientX, y: e.clientY }, project);
  }

  function onProjectMenuButton(e: React.MouseEvent<HTMLButtonElement>, project: Project) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    openProjectMenu({ x: rect.left, y: rect.bottom }, project);
  }

  function onTaskContextMenu(e: React.MouseEvent, task: Task) {
    e.preventDefault();
    e.stopPropagation();
    openTaskMenu({ x: e.clientX, y: e.clientY }, task);
  }

  function onTaskMenuButton(e: React.MouseEvent<HTMLButtonElement>, task: Task) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    openTaskMenu({ x: rect.left, y: rect.bottom }, task);
  }

  async function archiveClientById(client: Client) {
    const projectCount = snapshot!.projects.filter((p) => p.clientId === client.id && !p.archivedAt).length;
    if (!confirmDialog(`Arquivar o cliente "${client.name}"? Os ${projectCount} projeto(s) ativo(s) dentro dele também são arquivados — pode restaurar depois em "Ver arquivados".`)) return;
    try {
      await invokeAction('client:archive', { clientId: client.id });
    } catch (err) {
      console.error('Erro ao arquivar cliente:', err);
    }
  }

  async function unarchiveClientById(client: Client) {
    await invokeAction('client:unarchive', { clientId: client.id });
  }

  function openClientMenu(pos: { x: number; y: number }, client: Client) {
    const items: ContextMenuItem[] = client.archivedAt
      ? [
          {
            label: 'Restaurar cliente',
            onClick: async () => {
              setMenu(null);
              await unarchiveClientById(client);
            },
          },
        ]
      : [
          {
            label: 'Arquivar cliente',
            danger: true,
            onClick: async () => {
              setMenu(null); // Fecha o menu
              await archiveClientById(client);
            },
          },
        ];
    setMenu({ x: pos.x, y: pos.y, items });
  }

  function onClientMenuButton(e: React.MouseEvent<HTMLButtonElement>, client: Client) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    openClientMenu({ x: rect.left, y: rect.bottom }, client);
  }

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
      <Titlebar title="CENTRAL DE TAREFAS · Cliente → Projeto → Tarefa → Subtarefa" />
      <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente ou projeto..."
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            style={{
              ...pillButtonStyle,
              ...(showArchived
                ? { background: 'rgba(255, 184, 77, 0.2)', border: '1px solid rgba(255, 184, 77, 0.4)', color: '#ffb84d' }
                : {}),
            }}
            onClick={() => setShowArchived((v) => !v)}
            title={showArchived ? 'Ver ativos' : 'Ver arquivados'}
          >
            {showArchived ? '📦 Arquivados' : '📦 Ver arquivados'}
          </button>
        </div>

        <section className="allus-glass" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <FieldWithLabel label="Cliente" style={{ flex: 1 }}>
              <input value={clientField} onChange={(e) => setClientField(e.target.value)} placeholder="ex: Empresa X" style={inputStyle} />
            </FieldWithLabel>
            <FieldWithLabel label="Projeto" style={{ flex: 1 }}>
              <input value={projectField} onChange={(e) => setProjectField(e.target.value)} placeholder="ex: Site institucional" style={inputStyle} />
            </FieldWithLabel>
            <FieldWithLabel label="Tipo (opcional)" style={{ flex: 0.8 }}>
              <input value={typeField} onChange={(e) => setTypeField(e.target.value)} placeholder="ex: Web, Design" style={inputStyle} />
            </FieldWithLabel>
            <button style={pillButtonStyle} onClick={saveProject} disabled={savingProject}>
              {savingProject ? 'Salvando...' : 'Salvar projeto'}
            </button>
            {selectedProjectId && (
              <button
                style={pillButtonStyle}
                title="Arquivar projeto"
                onClick={() => {
                  const project = snapshot!.projects.find((p) => p.id === selectedProjectId);
                  if (project) archiveProjectById(project);
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
            <button style={pillButtonStyle} onClick={addTaskToSelected} disabled={!selectedProjectId || addingTask}>
              {addingTask ? 'Adicionando...' : 'Adicionar tarefa'}
            </button>
            <button style={pillButtonStyle} onClick={() => selectProjectForEdit(null)}>
              Novo projeto
            </button>
          </div>
          {clipboard && (
            <div style={{ fontSize: 11, color: 'var(--allus-text-muted)' }}>
              {clipboard.cut ? 'Recortado' : 'Copiado'}: "{clipboard.title}" — clique com o botão direito num projeto pra colar.{' '}
              <button style={{ ...iconGhostButtonStyle, textDecoration: 'underline' }} onClick={() => setClipboard(null)}>
                cancelar
              </button>
            </div>
          )}
        </section>

        <section style={listHeaderStyle}>
          <div>
            <div style={sectionKickerStyle}>{showArchived ? 'Arquivo' : 'Clientes'}</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>
              {showArchived ? 'Itens arquivados' : 'Mapa de trabalho'}
            </div>
          </div>
          <div style={listHintStyle}>Use o botão de opções para copiar, mover, arquivar e restaurar.</div>
        </section>

        <div style={treeListStyle}>
          {grouped.map(({ client, projects }) => (
            <div key={client.id} style={clientGroupStyle}>
              <div
                style={{ ...clientRowStyle, opacity: client.archivedAt ? 0.55 : 1 }}
                onClick={() => toggle(expandedClients, setExpandedClients, client.id)}
              >
                <span style={chevronStyle}>{expandedClients.has(client.id) ? '▾' : '▸'}</span>
                <span style={clientAvatarStyle}>{getInitials(client.name)}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ color: 'var(--allus-yellow)', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {client.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--allus-text-muted)', marginTop: 2 }}>
                    {projects.length} projeto(s) · {projects.reduce((sum, project) => sum + topLevelTasks(project.id).length, 0)} tarefa(s)
                  </div>
                </div>
                <span style={countPillStyle}>{projects.length}</span>
                <button
                  className="allus-no-drag"
                  style={iconGhostButtonStyle}
                  onClick={(e) => onClientMenuButton(e, client)}
                  title="Mais opções"
                >
                  ⋮
                </button>
              </div>

              {expandedClients.has(client.id) &&
                projects.map((project) => (
                  <div key={project.id} style={projectBlockStyle}>
                    <div
                      style={{ ...projectRowStyle, opacity: project.archivedAt ? 0.55 : 1 }}
                      onClick={() => toggle(expandedProjects, setExpandedProjects, project.id)}
                      onContextMenu={(e) => onProjectContextMenu(e, project)}
                    >
                      <span style={chevronStyle}>{expandedProjects.has(project.id) ? '▾' : '▸'}</span>
                      <span
                        style={{
                          color: 'var(--allus-text-primary)',
                          fontWeight: 700,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {project.name}
                      </span>
                      {project.type && (
                        <span
                          style={typeChipStyle}
                        >
                          {project.type}
                        </span>
                      )}
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--allus-text-muted)', whiteSpace: 'nowrap' }}>
                        {topLevelTasks(project.id).length} tarefa(s)
                      </span>
                      <button
                        className="allus-no-drag"
                        style={iconGhostButtonStyle}
                        onClick={(e) => {
                          e.stopPropagation();
                          selectProjectForEdit(project);
                        }}
                        title="Editar projeto"
                      >
                        ⚙
                      </button>
                      <button
                        className="allus-no-drag"
                        style={iconGhostButtonStyle}
                        onClick={(e) => onProjectMenuButton(e, project)}
                        title="Mais opções"
                      >
                        ⋮
                      </button>
                    </div>

                    {expandedProjects.has(project.id) &&
                      topLevelTasks(project.id).map((task) => (
                        <div key={task.id} style={taskBlockStyle}>
                          <TaskRow
                            task={task}
                            renaming={renaming}
                            setRenaming={setRenaming}
                            onToggleExpand={() => toggle(expandedTasks, setExpandedTasks, task.id)}
                            expanded={expandedTasks.has(task.id)}
                            subtaskCount={subtasksOf(task.id).length}
                            onContextMenu={(e) => onTaskContextMenu(e, task)}
                            onMenuButton={(e) => onTaskMenuButton(e, task)}
                          />
                          {expandedTasks.has(task.id) && (
                            <div style={taskChildrenStyle}>
                              {subtasksOf(task.id).map((sub) => (
                                <TaskRow
                                  key={sub.id}
                                  task={sub}
                                  renaming={renaming}
                                  setRenaming={setRenaming}
                                  onContextMenu={(e) => onTaskContextMenu(e, sub)}
                                  onMenuButton={(e) => onTaskMenuButton(e, sub)}
                                />
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
                                    await invokeAction('taskTree:add', { projectId: project.id, parentTaskId: task.id, title });
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

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}

      {moveTask && (
        <MoveToProjectModal
          task={moveTask}
          projects={snapshot.projects}
          clients={snapshot.clients}
          onClose={() => setMoveTask(null)}
        />
      )}

      {propsTask && (
        <PropertiesModal
          task={propsTask}
          projects={snapshot.projects}
          clients={snapshot.clients}
          profiles={snapshot.profiles}
          onClose={() => setPropsTask(null)}
        />
      )}

      <ToastHost />
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
  onContextMenu,
  onMenuButton,
}: {
  task: Task;
  renaming: { id: string; value: string } | null;
  setRenaming: (v: { id: string; value: string } | null) => void;
  onToggleExpand?: () => void;
  expanded?: boolean;
  subtaskCount?: number;
  onContextMenu?: (e: React.MouseEvent) => void;
  onMenuButton?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const isRenaming = renaming?.id === task.id;
  const isArchived = !!task.archivedAt;
  return (
    <div style={{ ...rowStyle, opacity: isArchived ? 0.55 : 1 }} onContextMenu={onContextMenu}>
      {onToggleExpand && (
        <span onClick={onToggleExpand} style={{ cursor: 'pointer' }}>
          {expanded ? '▾' : '▸'}
        </span>
      )}
      {!onToggleExpand && <span />}
      {isArchived ? (
        <span
          title={`Prioridade: ${task.priority}`}
          style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: PRIORITY_COLOR[task.priority] }}
        />
      ) : (
        <span
          className="allus-no-drag"
          title={`Prioridade: ${task.priority} (clique pra trocar)`}
          onClick={(e) => {
            e.stopPropagation();
            const next = TASK_PRIORITIES[(TASK_PRIORITIES.indexOf(task.priority) + 1) % TASK_PRIORITIES.length];
            invokeAction('taskTree:setPriority', { taskId: task.id, priority: next });
          }}
          style={{
            width: 9,
            height: 9,
            borderRadius: '50%',
            flexShrink: 0,
            cursor: 'pointer',
            background: PRIORITY_COLOR[task.priority],
          }}
        />
      )}
      {!isArchived && (
        <select
          className="allus-no-drag"
          value={task.status}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => invokeAction('taskTree:setStatus', { taskId: task.id, status: e.target.value as TaskStatus })}
          style={{
            ...statusSelectStyle,
            color: STATUS_COLOR[task.status],
            borderColor: STATUS_COLOR[task.status],
            background: STATUS_BG[task.status],
          }}
        >
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s} style={{ color: STATUS_COLOR[s], background: '#1a1a1a' }}>
              {s}
            </option>
          ))}
        </select>
      )}
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
              await invokeAction('taskTree:rename', { taskId: task.id, title: renaming.value });
              setRenaming(null);
            }}
          >
            ✓
          </button>
          <button style={iconGhostButtonStyle} onClick={() => setRenaming(null)}>✕</button>
        </>
      ) : (
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textDecoration: isArchived ? 'line-through' : undefined,
          }}
          onDoubleClick={() => !isArchived && setRenaming({ id: task.id, value: task.title })}
        >
          {task.title}
        </span>
      )}
      {subtaskCount !== undefined && subtaskCount > 0 && (
        <span style={{ fontSize: 11, color: 'var(--allus-text-muted)', whiteSpace: 'nowrap' }}>{subtaskCount} sub</span>
      )}
      {isArchived ? (
        <button
          style={iconGhostButtonStyle}
          onClick={() => invokeAction('taskTree:unarchive', { taskId: task.id })}
          title="Restaurar tarefa"
        >
          Restaurar
        </button>
      ) : (
        <button
          style={iconGhostButtonStyle}
          onClick={() => invokeAction('task:focus', { taskId: task.id, subtaskId: null, title: task.title })}
        >
          Focar
        </button>
      )}
      {onMenuButton && (
        <button style={iconGhostButtonStyle} onClick={onMenuButton} title="Mais opções">
          ⋮
        </button>
      )}
    </div>
  );
}

function MoveToProjectModal({
  task,
  projects,
  clients,
  onClose,
}: {
  task: Task;
  projects: Project[];
  clients: Client[];
  onClose: () => void;
}) {
  async function move(project: Project) {
    await invokeAction('taskTree:move', { taskId: task.id, targetProjectId: project.id });
    onClose();
  }
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div className="allus-glass allus-no-drag" style={moveModalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <div style={sectionKickerStyle}>Mover tarefa</div>
          <div style={modalTitleStyle}>{task.title}</div>
        </div>
        <div style={moveListStyle}>
          {clients.map((client) => (
            <div key={client.id} style={moveClientGroupStyle}>
              <div style={moveClientLabelStyle}>{client.name}</div>
              {projects
                .filter((p) => p.clientId === client.id)
                .map((project) => (
                  <button key={project.id} onClick={() => move(project)} style={moveOptionStyle}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</span>
                    <span style={{ color: 'var(--allus-yellow)', fontSize: 12 }}>→</span>
                  </button>
                ))}
            </div>
          ))}
        </div>
        <button style={modalCancelButtonStyle} onClick={onClose}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function PropertiesModal({
  task,
  projects,
  clients,
  profiles,
  onClose,
}: {
  task: Task;
  projects: Project[];
  clients: Client[];
  profiles: TeamMember[];
  onClose: () => void;
}) {
  const project = projects.find((p) => p.id === task.projectId);
  const client = project ? clients.find((c) => c.id === project.clientId) : undefined;
  const author = profiles.find((p) => p.id === task.createdBy);
  const createdAt = new Date(task.createdAt).toLocaleString('pt-BR');

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div className="allus-glass allus-no-drag" style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Propriedades</div>
        <PropRow label="Título" value={task.title} />
        <PropRow label="Status" value={task.status} />
        <PropRow label="Prioridade" value={task.priority} />
        <PropRow label="Projeto" value={project?.name ?? '—'} />
        <PropRow label="Cliente" value={client?.name ?? '—'} />
        <PropRow label="Criado em" value={createdAt} />
        <PropRow label="Criado por" value={author?.fullName ?? 'Desconhecido'} />
        <button style={{ ...pillButtonStyle, marginTop: 10, width: '100%' }} onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  );
}

function FieldWithLabel({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, ...style }}>
      <span style={{ fontSize: 11, color: 'var(--allus-text-muted)' }}>{label}</span>
      {children}
    </div>
  );
}

function PropRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, padding: '4px 0' }}>
      <span style={{ color: 'var(--allus-text-muted)' }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const initials = parts.length === 1 ? parts[0].slice(0, 2) : `${parts[0][0]}${parts[parts.length - 1][0]}`;
  return initials.toUpperCase();
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
  flexShrink: 0,
  minWidth: 0,
  padding: '3px 5px',
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

const clientGroupStyle: React.CSSProperties = {
  borderRadius: 14,
  border: '1px solid rgba(236,220,1,0.10)',
  background: 'linear-gradient(135deg, rgba(236,220,1,0.045), rgba(255,255,255,0.018))',
  overflow: 'visible',
  minWidth: 0,
};

const clientRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 12px',
  fontSize: 13,
  cursor: 'pointer',
  minWidth: 0,
};

const projectBlockStyle: React.CSSProperties = {
  marginLeft: 18,
  marginRight: 6,
  borderLeft: '1px solid rgba(236,220,1,0.16)',
  paddingLeft: 8,
  paddingBottom: 10,
  minWidth: 0,
};

const projectRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '14px minmax(0, 1fr) auto auto 26px 26px',
  alignItems: 'center',
  gap: 8,
  padding: '8px 9px',
  borderRadius: 10,
  fontSize: 13,
  cursor: 'pointer',
  background: 'rgba(0,0,1,0.18)',
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
  paddingBottom: 8,
  borderLeft: '1px solid rgba(126,242,155,0.18)',
  minWidth: 0,
};

const chevronStyle: React.CSSProperties = {
  width: 14,
  color: 'var(--allus-yellow)',
  fontSize: 11,
  flexShrink: 0,
};

const clientAvatarStyle: React.CSSProperties = {
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

const countPillStyle: React.CSSProperties = {
  minWidth: 28,
  padding: '4px 8px',
  borderRadius: 999,
  border: '1px solid rgba(236,220,1,0.18)',
  color: 'var(--allus-yellow)',
  fontSize: 11,
  fontWeight: 800,
  textAlign: 'center',
};

const typeChipStyle: React.CSSProperties = {
  fontSize: 10,
  color: 'var(--allus-text-muted)',
  border: '1px solid rgba(236,220,1,0.16)',
  background: 'rgba(236,220,1,0.06)',
  borderRadius: 999,
  padding: '2px 8px',
};

const statusSelectStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid var(--allus-glass-border)',
  borderRadius: 6,
  padding: '2px 4px',
  fontSize: 10,
  fontWeight: 600,
  cursor: 'pointer',
  flexShrink: 0,
  width: '100%',
  maxWidth: 112,
};

const rowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '12px 9px minmax(76px, 104px) minmax(0, 1fr) minmax(0, auto) 38px 22px',
  alignItems: 'center',
  gap: 8,
  padding: '7px 9px',
  borderRadius: 10,
  fontSize: 13,
  cursor: 'pointer',
  background: 'rgba(255,255,255,0.025)',
  border: '1px solid rgba(255,255,255,0.055)',
  marginTop: 4,
  minWidth: 0,
  overflow: 'hidden',
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.35)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: Z.panel,
};

const modalStyle: React.CSSProperties = {
  width: 320,
  padding: 16,
};

const moveModalStyle: React.CSSProperties = {
  width: 360,
  maxWidth: '92vw',
  padding: 16,
  borderRadius: 18,
};

const modalHeaderStyle: React.CSSProperties = {
  paddingBottom: 12,
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  marginBottom: 10,
};

const modalTitleStyle: React.CSSProperties = {
  marginTop: 4,
  fontSize: 15,
  fontWeight: 800,
  color: 'var(--allus-text-primary)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const moveListStyle: React.CSSProperties = {
  maxHeight: 330,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  paddingRight: 4,
};

const moveClientGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const moveClientLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  color: 'var(--allus-yellow)',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  padding: '2px 4px',
};

const moveOptionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  width: '100%',
  textAlign: 'left',
  padding: '8px 10px',
  borderRadius: 10,
  border: '1px solid rgba(236,220,1,0.10)',
  background: 'rgba(255,255,255,0.035)',
  color: 'var(--allus-text-primary)',
  fontSize: 13,
  minWidth: 0,
};

const modalCancelButtonStyle: React.CSSProperties = {
  ...pillButtonStyle,
  marginTop: 12,
  width: '100%',
  borderRadius: 12,
  padding: '8px 12px',
};
