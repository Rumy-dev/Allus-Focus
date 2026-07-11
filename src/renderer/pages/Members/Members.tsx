import { useEffect, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import allusWatermark from '../../assets/allus-focus-watermark.svg';
import { useAppState } from '../../useAppState';
import { Titlebar } from '../../components/Titlebar';
import { ToastHost } from '../../components/ToastHost';
import { invokeAction } from '../../invoke';
import { toast } from '../../toast';
import type { AdminMemberRecord } from '../../../shared/ipc-contract';

export function Members() {
  const snapshot = useAppState();
  const [members, setMembers] = useState<AdminMemberRecord[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteSaving, setInviteSaving] = useState(false);

  const [passwordEditUserId, setPasswordEditUserId] = useState<string | null>(null);
  const [passwordEditValue, setPasswordEditValue] = useState('');
  const [passwordEditSaving, setPasswordEditSaving] = useState(false);

  const loadMembers = async () => {
    setMembersLoading(true);
    setMembersError(null);
    const result = await invokeAction('admin:members:list', undefined);
    if (!result || !result.ok) {
      setMembersError(!result ? 'resultado indisponível' : result.error);
      setMembers([]);
    } else {
      setMembers(result.members);
    }
    setMembersLoading(false);
  };

  useEffect(() => {
    loadMembers();
  }, []);

  async function handleInviteMember(e: FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim() || invitePassword.trim().length < 6) return;
    setInviteSaving(true);
    const result = await invokeAction('admin:members:invite', {
      email: inviteEmail.trim(),
      fullName: inviteName.trim(),
      role: inviteRole,
      password: invitePassword.trim(),
    });
    setInviteSaving(false);
    if (result?.ok) {
      toast.success('Membro criado! Já pode fazer login com o e-mail e a senha definidos.');
      setInviteEmail('');
      setInviteName('');
      setInviteRole('member');
      setInvitePassword('');
      await loadMembers();
    }
  }

  async function handleChangeMemberRole(userId: string, role: 'member' | 'admin') {
    const result = await invokeAction('admin:members:setRole', { userId, role });
    if (result?.ok) {
      toast.success('Perfil atualizado');
      setMembers((prev) => prev.map((member) => (member.id === userId ? { ...member, role } : member)));
    }
  }

  async function handleSetMemberPassword(e: FormEvent, userId: string) {
    e.preventDefault();
    if (passwordEditValue.trim().length < 6) return;
    setPasswordEditSaving(true);
    const result = await invokeAction('admin:members:setPassword', { userId, password: passwordEditValue.trim() });
    setPasswordEditSaving(false);
    if (result?.ok) {
      toast.success('Senha atualizada');
      setPasswordEditUserId(null);
      setPasswordEditValue('');
    }
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
      <Titlebar title="ALLUS · Membros da equipe" />
      <div style={pageStyle}>
        <form onSubmit={handleInviteMember} style={cardStyle}>
          <div style={cardTitleStyle}>Criar novo membro</div>
          <label style={fieldWrapStyle}>
            <span style={fieldLabelStyle}>E-mail</span>
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="nome@allus.com.br"
              style={inputStyle}
            />
          </label>
          <label style={fieldWrapStyle}>
            <span style={fieldLabelStyle}>Nome</span>
            <input
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="Nome completo"
              style={inputStyle}
            />
          </label>
          <label style={fieldWrapStyle}>
            <span style={fieldLabelStyle}>Senha</span>
            <input
              type="password"
              value={invitePassword}
              onChange={(e) => setInvitePassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              style={inputStyle}
            />
          </label>
          <div style={fieldWrapStyle}>
            <span style={fieldLabelStyle}>Cargo</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                style={{ ...pillButtonStyle, flex: 1, ...(inviteRole === 'member' ? pillButtonActiveStyle : null) }}
                onClick={() => setInviteRole('member')}
              >
                Membro
              </button>
              <button
                type="button"
                style={{ ...pillButtonStyle, flex: 1, ...(inviteRole === 'admin' ? pillButtonActiveStyle : null) }}
                onClick={() => setInviteRole('admin')}
              >
                Admin
              </button>
            </div>
          </div>
          <button
            type="submit"
            style={{ ...pillButtonStyle, ...pillButtonActiveStyle, minHeight: 36 }}
            disabled={inviteSaving || !inviteEmail.trim() || invitePassword.trim().length < 6}
          >
            {inviteSaving ? 'Criando...' : 'Criar membro'}
          </button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <div style={cardTitleStyle}>Equipe</div>
          {membersLoading && <div style={mutedTextStyle}>Carregando membros...</div>}
          {membersError && <div style={{ fontSize: 12, color: 'var(--allus-status-interrompido)' }}>{membersError}</div>}
          {!membersLoading && members.length === 0 && !membersError && (
            <div style={mutedTextStyle}>Nenhum membro carregado.</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
            {members.map((member) => {
              const isMe = member.id === snapshot?.auth.profile?.id;
              return (
                <div key={member.id} className="allus-glass" style={memberCardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={memberNameStyle}>{member.fullName}</div>
                      <div style={memberEmailStyle}>{member.email ?? 'E-mail não disponível'}</div>
                    </div>
                    <span style={roleBadgeStyle}>{member.role}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      style={{ ...pillButtonStyle, flex: 1, ...(member.role === 'member' ? pillButtonActiveStyle : null) }}
                      disabled={member.role === 'member' || isMe}
                      onClick={() => handleChangeMemberRole(member.id, 'member')}
                      title={isMe ? 'O seu papel pode ser alterado por outro admin' : 'Definir como membro'}
                    >
                      Membro
                    </button>
                    <button
                      type="button"
                      style={{ ...pillButtonStyle, flex: 1, ...(member.role === 'admin' ? pillButtonActiveStyle : null) }}
                      disabled={member.role === 'admin'}
                      onClick={() => handleChangeMemberRole(member.id, 'admin')}
                    >
                      Admin
                    </button>
                  </div>
                  {passwordEditUserId === member.id ? (
                    <form onSubmit={(e) => handleSetMemberPassword(e, member.id)} style={{ display: 'flex', gap: 6 }}>
                      <input
                        autoFocus
                        type="password"
                        value={passwordEditValue}
                        onChange={(e) => setPasswordEditValue(e.target.value)}
                        placeholder="Nova senha (mín. 6)"
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      <button
                        type="submit"
                        style={{ ...pillButtonStyle, ...pillButtonActiveStyle }}
                        disabled={passwordEditSaving || passwordEditValue.trim().length < 6}
                      >
                        {passwordEditSaving ? 'Salvando...' : 'Salvar'}
                      </button>
                      <button
                        type="button"
                        style={pillButtonStyle}
                        onClick={() => {
                          setPasswordEditUserId(null);
                          setPasswordEditValue('');
                        }}
                      >
                        Cancelar
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      style={pillButtonStyle}
                      onClick={() => {
                        setPasswordEditUserId(member.id);
                        setPasswordEditValue('');
                      }}
                    >
                      Trocar senha
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <ToastHost />
    </div>
  );
}

const pageStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'grid',
  gridTemplateColumns: 'minmax(260px, 320px) 1fr',
  gap: 20,
  padding: 20,
  overflow: 'hidden',
};

const cardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  border: '1px solid var(--allus-glass-border)',
  borderRadius: 14,
  padding: 16,
  background: 'rgba(255,255,255,0.03)',
  alignSelf: 'flex-start',
};

const cardTitleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: 'var(--allus-text-primary)',
};

const fieldWrapStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const fieldLabelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: 'var(--allus-text-muted)',
};

const mutedTextStyle: CSSProperties = {
  fontSize: 12,
  color: 'var(--allus-text-muted)',
};

const inputStyle: CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid var(--allus-glass-border)',
  borderRadius: 10,
  padding: '9px 11px',
  color: 'var(--allus-text-primary)',
  outline: 'none',
  fontSize: 13,
};

const pillButtonStyle: CSSProperties = {
  padding: '7px 12px',
  borderRadius: 999,
  border: '1px solid var(--allus-glass-border)',
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--allus-text-primary)',
  fontSize: 12,
};

const pillButtonActiveStyle: CSSProperties = {
  background: 'var(--allus-gradient)',
  color: '#000001',
  fontWeight: 700,
  border: '1px solid transparent',
};

const memberCardStyle: CSSProperties = {
  border: '1px solid var(--allus-glass-border)',
  borderRadius: 12,
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const memberNameStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const memberEmailStyle: CSSProperties = {
  fontSize: 12,
  color: 'var(--allus-text-muted)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const roleBadgeStyle: CSSProperties = {
  fontSize: 9,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--allus-text-muted)',
  border: '1px solid var(--allus-glass-border)',
  borderRadius: 999,
  padding: '2px 6px',
  height: 'fit-content',
};
