import type { Client, Project } from '../../shared/types';
import { invokeAction } from '../invoke';

interface ProjectPickerProps {
  clients: Client[];
  projects: Project[];
  selectedProjectId: string | null;
  onSelect: (projectId: string) => void;
}

export function ProjectPicker({ clients, projects, selectedProjectId, onSelect }: ProjectPickerProps) {
  async function pick(projectId: string) {
    await invokeAction('project:select', { projectId });
    onSelect(projectId);
  }

  if (clients.length === 0) {
    return (
      <div className="allus-glass allus-no-drag" style={panelStyle}>
        <div style={{ fontSize: 12, color: 'var(--allus-text-muted)', padding: 8 }}>
          Nenhum cliente/projeto ainda.
        </div>
      </div>
    );
  }

  return (
    <div className="allus-glass allus-no-drag" style={panelStyle}>
      {clients.map((client) => {
        const clientProjects = projects.filter((p) => p.clientId === client.id);
        if (clientProjects.length === 0) return null;
        return (
          <div key={client.id} style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: 'var(--allus-purple)', padding: '4px 8px' }}>{client.name}</div>
            {clientProjects.map((project) => (
              <button
                key={project.id}
                onClick={() => pick(project.id)}
                style={{
                  ...projectButtonStyle,
                  backgroundImage: selectedProjectId === project.id ? 'var(--allus-gradient)' : undefined,
                  color: selectedProjectId === project.id ? '#0d0b16' : undefined,
                }}
              >
                {project.name}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  zIndex: 50,
  marginTop: 6,
  padding: 8,
  width: 260,
  maxHeight: 260,
  overflowY: 'auto',
};

const projectButtonStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '6px 10px',
  borderRadius: 8,
  border: 'none',
  background: 'transparent',
  color: 'var(--allus-text-primary)',
  fontSize: 13,
};
