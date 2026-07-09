import { app } from 'electron';
import started from 'electron-squirrel-startup';
import { authManager } from './auth/authManager';
import { appStore } from './store/appStore';
import * as taskStore from './store/taskStore';
import * as windowManager from './windows/windowManager';
import * as tray from './tray';
import { registerIpcHandlers } from './ipcHandlers';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

// App roda em segundo plano via bandeja mesmo sem janelas abertas — não
// encerra no fechar-todas-as-janelas (seção 13 do handoff).
app.on('window-all-closed', () => {
  // intencionalmente vazio
});

app.on('before-quit', () => windowManager.setQuitting(true));

app.whenReady().then(async () => {
  registerIpcHandlers();

  appStore.subscribe((snapshot) => {
    windowManager.broadcast(snapshot);
    tray.render();
  });

  authManager.on('change', async (state) => {
    if (state.status === 'signedIn') {
      appStore.patch({ auth: { status: 'signedIn', profile: state.profile } });
      windowManager.closeLogin();
      await taskStore.hydrateTaxonomy();
      taskStore.subscribeRealtime();
      windowManager.showMainWindow();
      windowManager.showFloatingPanel();
      tray.initTray();
    } else {
      appStore.patch({ auth: { status: 'signedOut', profile: null } });
      await taskStore.unsubscribeRealtime();
    }
  });

  // authManager.init() já dispara 'change' internamente (via hydrateProfile)
  // quando havia uma sessão salva — o handler acima cuida de todo o setup
  // nesse caso. Só precisamos abrir a tela de Login quando não há sessão.
  const initialState = await authManager.init();
  if (initialState.status !== 'signedIn') {
    windowManager.showLogin();
  }
});

app.on('activate', () => {
  if (authManager.getState().status === 'signedIn') {
    windowManager.showMainWindow();
  } else {
    windowManager.showLogin();
  }
});
