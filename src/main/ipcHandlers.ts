import { BrowserWindow, app, ipcMain } from 'electron';
import { appStore } from './store/appStore';
import { authManager } from './auth/authManager';
import { supabase } from './supabase/client';
import * as timerEngine from './store/timerEngine';
import * as taskStore from './store/taskStore';
import * as reportBuilder from './store/reportBuilder';
import * as pulseBuilder from './store/pulseBuilder';
import { savePrefs } from './store/prefsStore';
import * as windowManager from './windows/windowManager';
import { restartForUpdate } from './updater';
import type { IpcInvokeMap } from '../shared/ipc-contract';

function handle<K extends keyof IpcInvokeMap>(
  channel: K,
  fn: (args: Parameters<IpcInvokeMap[K]>[0]) => ReturnType<IpcInvokeMap[K]> | Promise<ReturnType<IpcInvokeMap[K]>>,
): void {
  ipcMain.handle(channel, async (_event, args) => {
    try {
      return await fn(args);
    } catch (err) {
      console.error(`[ipc:${channel}]`, err);
      throw err;
    }
  });
}

export function registerIpcHandlers(): void {
  handle('auth:signIn', async ({ email, password }) => authManager.signIn(email, password));
  handle('auth:signOut', async () => {
    await authManager.signOut();
  });
  handle('auth:changePassword', async ({ newPassword }) => authManager.changePassword(newPassword));
  handle('auth:requestPasswordReset', async ({ email }) => authManager.requestPasswordReset(email));
  handle('auth:confirmPasswordReset', async ({ email, code, newPassword }) =>
    authManager.confirmPasswordReset(email, code, newPassword),
  );

  handle('timer:playPause', async () => {
    const before = appStore.getSnapshot().activeSession?.status;
    await timerEngine.playPause();
    const after = appStore.getSnapshot().activeSession?.status;
    if (before === 'Ativo' && after === 'Pausado') windowManager.playSoundCue('buttonPause');
    else if (before !== 'Ativo' && after === 'Ativo') windowManager.playSoundCue('buttonPlay');
    else if (after === 'Ativo') windowManager.playSoundCue('buttonPlay');
  });
  handle('timer:pause', async () => {
    await timerEngine.pause();
    windowManager.playSoundCue('buttonPause');
  });
  handle('timer:resume', async () => {
    await timerEngine.resume();
    windowManager.playSoundCue('buttonPlay');
  });
  handle('timer:stop', async () => {
    await timerEngine.stop();
    windowManager.playSoundCue('buttonStop');
  });
  handle('timer:skipToBreak', async () => timerEngine.skipToBreak());
  handle('timer:skipToFocus', async () => timerEngine.skipToFocus());
  handle('timer:restart', async ({ sessionId }) => timerEngine.restart(sessionId));
  handle('timer:setMode', async ({ mode }) => timerEngine.setMode(mode));
  handle('session:delete', async ({ sessionId }) => timerEngine.deleteSession(sessionId));

  handle('task:quickAdd', async ({ title, avulsa }) => timerEngine.quickAdd(title, avulsa));
  handle('task:focus', async ({ taskId, subtaskId, title }) => timerEngine.focusTask(taskId, subtaskId, title));
  handle('task:toggleDone', async ({ taskLogId }) => {
    const state = appStore.getSnapshot();
    const log = state.activeTaskLogs.find((l) => l.id === taskLogId);
    if (!log) return;
    const updated = { ...log, isDone: !log.isDone, completedAt: !log.isDone ? new Date().toISOString() : null };
    appStore.patch({ activeTaskLogs: state.activeTaskLogs.map((l) => (l.id === taskLogId ? updated : l)) });
    if (updated.taskId) await taskStore.setTaskNodeDone(updated.taskId, updated.isDone);
  });
  handle('task:deleteLog', async ({ taskLogId }) => timerEngine.deleteTaskLog(taskLogId));

  handle('project:add', async ({ clientName, projectName, type }) => taskStore.addProject(clientName, projectName, type));
  handle('project:update', async ({ projectId, clientName, projectName, type }) =>
    taskStore.updateProject(projectId, clientName, projectName, type),
  );
  handle('project:archive', async ({ projectId }) => taskStore.archiveProject(projectId));
  handle('project:unarchive', async ({ projectId }) => taskStore.unarchiveProject(projectId));
  handle('project:select', async ({ projectId }) => {
    savePrefs({ selectedProjectId: projectId });
    appStore.patch({ selectedProjectId: projectId });
  });
  handle('client:archive', async ({ clientId }) => taskStore.archiveClient(clientId));
  handle('client:unarchive', async ({ clientId }) => taskStore.unarchiveClient(clientId));

  handle('taskTree:add', async ({ projectId, parentTaskId, title }) => {
    await taskStore.addTaskNode(projectId, parentTaskId, title);
  });
  handle('taskTree:rename', async ({ taskId, title }) => taskStore.renameTaskNode(taskId, title));
  handle('taskTree:toggleDone', async ({ taskId }) => taskStore.toggleTaskNodeDone(taskId));
  handle('taskTree:setStatus', async ({ taskId, status }) => taskStore.setTaskStatus(taskId, status));
  handle('taskTree:setPriority', async ({ taskId, priority }) => taskStore.setTaskPriority(taskId, priority));
  handle('taskTree:archive', async ({ taskId }) => taskStore.archiveTaskNode(taskId));
  handle('taskTree:unarchive', async ({ taskId }) => taskStore.unarchiveTaskNode(taskId));
  handle('taskTree:move', async ({ taskId, targetProjectId }) => taskStore.moveTaskNode(taskId, targetProjectId));

  // Fora do Allus Pulse, só admin vê horas de outras pessoas — usuário comum
  // fica restrito às próprias horas (mesma regra em Central de Tempos e Dashboard).
  function ownUserIdIfNotAdmin(): string | undefined {
    const state = authManager.getState();
    if (state.status !== 'signedIn') throw new Error('Não autenticado.');
    return state.profile.role === 'admin' ? undefined : state.profile.id;
  }

  handle('report:query', async ({ range }) => reportBuilder.queryReport(range, ownUserIdIfNotAdmin()));
  handle('report:exportCsv', async ({ range }) => reportBuilder.exportCsv(range, ownUserIdIfNotAdmin()));
  handle('session:list', async ({ range }) => reportBuilder.querySessions(range, ownUserIdIfNotAdmin()));
  handle('dashboard:trend', async ({ range, clientId, projectId, userId }) =>
    reportBuilder.queryTrend(range, { clientId, projectId, userId: ownUserIdIfNotAdmin() ?? userId }),
  );

  handle('pulse:query', async () => {
    const state = authManager.getState();
    if (state.status !== 'signedIn' || state.profile.role !== 'admin') {
      throw new Error('Acesso negado: apenas admins podem acessar Allus Pulse.');
    }
    return pulseBuilder.queryPulse();
  });

  handle('admin:inviteMember', async ({ fullName, email }) => {
    const state = authManager.getState();
    if (state.status !== 'signedIn' || state.profile.role !== 'admin') {
      return { ok: false, error: 'Acesso negado: apenas admins podem convidar membros.' };
    }

    const safeFullName = fullName.trim();
    const safeEmail = email.trim().toLowerCase();
    if (!safeFullName || !safeEmail) {
      return { ok: false, error: 'Preencha nome e e-mail.' };
    }

    const { data, error } = await supabase.functions.invoke('invite-member', {
      body: { fullName: safeFullName, email: safeEmail },
    });

    if (error) {
      return { ok: false, error: error.message };
    }
    if (!data?.ok) {
      return { ok: false, error: data?.error ?? 'Não foi possível convidar o membro.' };
    }

    return { ok: true };
  });

  handle('prefs:setSound', async ({ enabled }) => {
    await authManager.updatePreferences({ soundEnabled: enabled });
    appStore.patch({ soundEnabled: enabled });
  });
  handle('prefs:setSoundOption', async ({ key, enabled }) => {
    await authManager.updatePreferences({ [key]: enabled } as Partial<import('../shared/types').UserPreferences>);
    appStore.patch({ [key]: enabled } as Partial<import('../shared/types').UserPreferences>);
  });
  handle('prefs:setFloatingMinimizable', async ({ enabled }) => {
    await authManager.updatePreferences({ floatingMinimizable: enabled });
    appStore.patch({ floatingMinimizable: enabled });
  });
  handle('prefs:setFloatingPanelOpacity', async ({ opacity }) => {
    const clamped = Math.max(0, Math.min(100, opacity));
    await authManager.updatePreferences({ floatingPanelOpacity: clamped });
    appStore.patch({ floatingPanelOpacity: clamped });
  });
  handle('app:restartForUpdate', async () => {
    await restartForUpdate();
  });
  handle('prefs:setFloatingPanelSize', async ({ size }) => {
    await authManager.updatePreferences({ floatingPanelSize: size });
    appStore.patch({ floatingPanelSize: size });
  });
  handle('prefs:setFloatingPanelCompactSize', async ({ size }) => {
    await authManager.updatePreferences({ floatingPanelCompactSize: size });
    appStore.patch({ floatingPanelCompactSize: size });
  });
  handle('prefs:setFloatingPanelPosition', async ({ position }) => {
    await authManager.updatePreferences({ floatingPanelPosition: position });
    appStore.patch({ floatingPanelPosition: position });
  });
  handle('prefs:setFloatingPanelSizeLocked', async ({ locked }) => {
    await authManager.updatePreferences({ floatingPanelSizeLocked: locked });
    appStore.patch({ floatingPanelSizeLocked: locked });
  });
  handle('prefs:setFloatingPanelExpanded', async ({ expanded }) => {
    await authManager.updatePreferences({ floatingPanelExpanded: expanded });
    appStore.patch({ floatingPanelExpanded: expanded });
  });
  handle('prefs:setFloatingPanelIsCompactMode', async ({ compact }) => {
    await authManager.updatePreferences({ floatingPanelIsCompactMode: compact });
    appStore.patch({ floatingPanelIsCompactMode: compact });
  });
  handle('prefs:setNotify', async ({ event, enabled }) => {
    const key = (`notify${event.charAt(0).toUpperCase()}${event.slice(1)}`) as
      | 'notifyFocusStart'
      | 'notifyFocusEnd'
      | 'notifyBreakEnd';
    await authManager.updatePreferences({ [key]: enabled });
  });
  handle('account:updateName', async ({ fullName }) => authManager.updateFullName(fullName));
  handle('prefs:setAutoLaunch', async ({ enabled }) => {
    app.setLoginItemSettings({ openAtLogin: enabled });
    appStore.patch({ autoLaunchEnabled: enabled });
  });

  handle('state:get', async () => appStore.getSnapshot());

  handle('window:openTaskCenter', async () => windowManager.showTaskCenter());
  handle('window:openTimeCenter', async () => windowManager.showTimeCenter());
  handle('window:openDashboard', async () => windowManager.showDashboard());
  handle('window:openPulse', async () => windowManager.showPulse());
  handle('window:openMain', async () => windowManager.showMainWindow());
  handle('window:openFloating', async () => {
    windowManager.showFloatingPanel();
  });

  handle('window:toggleTaskCenter', async () => windowManager.toggleTaskCenter());
  handle('window:toggleTimeCenter', async () => windowManager.toggleTimeCenter());
  handle('window:toggleDashboard', async () => windowManager.toggleDashboard());
  handle('window:togglePulse', async () => windowManager.togglePulse());

  ipcMain.handle('window:minimizeSelf', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });
  ipcMain.handle('window:closeSelf', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    // Painel flutuante tem fade próprio (windowManager.hideFloatingPanel) —
    // as demais janelas só escondem direto.
    if (win === windowManager.getFloatingWindow()) {
      windowManager.hideFloatingPanel();
    } else {
      win.hide();
    }
  });
  ipcMain.handle('window:openDevTools', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.webContents.toggleDevTools();
    }
  });
  handle('app:getInfo', async () => ({
    version: app.getVersion(),
    isDev: !app.isPackaged,
    platform: process.platform,
  }));
  ipcMain.handle('window:setFloatingHeight', (_event, { width, height }: { width?: number; height?: number }) => {
    if (appStore.getSnapshot().floatingPanelSizeLocked) return;
    const win = BrowserWindow.fromWebContents(_event.sender);
    if (win) {
      windowManager.markProgrammaticFloatingResize();
      const bounds = win.getBounds();
      win.setBounds({
        ...bounds,
        width: width !== undefined ? Math.min(Math.max(width, 170), 700) : bounds.width,
        height: height !== undefined ? Math.min(Math.max(height, 50), 700) : bounds.height,
      });
    }
  });

  ipcMain.handle('window:setFloatingSizeLocked', async (_event, { locked }: { locked: boolean }) => {
    windowManager.setFloatingPanelSizeLocked(locked);
  });

}
