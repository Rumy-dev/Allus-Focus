import { app, autoUpdater } from 'electron';
import { updateElectronApp } from 'update-electron-app';
import { appStore } from './store/appStore';
import * as timerEngine from './store/timerEngine';

// autoUpdater (Squirrel.Windows/Squirrel.Mac por baixo) só funciona em app
// empacotado — em dev (`npm start`) não há instalador Squirrel gerenciando
// o processo, e no Linux o Electron nem implementa autoUpdater. Checar
// update fora dessas condições só gera erro de rede/estado inconsistente.
const SUPPORTED = app.isPackaged && process.platform !== 'linux';

export function initAutoUpdater(): void {
  if (!SUPPORTED) return;

  // notifyUser:false porque exibimos o próprio status (verificando /
  // baixando / pronto) na MainWindow em vez do dialog nativo do pacote.
  updateElectronApp({ updateInterval: '1 hour', notifyUser: false, logger: console });

  autoUpdater.on('checking-for-update', () => {
    appStore.patch({ updateStatus: 'checking' });
  });
  autoUpdater.on('update-available', () => {
    appStore.patch({ updateStatus: 'downloading' });
  });
  autoUpdater.on('update-not-available', () => {
    appStore.patch({ updateStatus: 'idle' });
  });
  autoUpdater.on('update-downloaded', () => {
    appStore.patch({ updateStatus: 'ready' });
  });
  autoUpdater.on('error', (err) => {
    console.error('[autoUpdater]', err);
    appStore.patch({ updateStatus: 'error' });
  });
}

const UPDATE_FLUSH_TIMEOUT_MS = 5000;

export async function restartForUpdate(): Promise<void> {
  if (!SUPPORTED) return;
  // Faz flush de sessão ativa + fila offline antes de reiniciar
  await Promise.race([
    timerEngine.flushBeforeQuit(),
    new Promise<void>((resolve) => setTimeout(resolve, UPDATE_FLUSH_TIMEOUT_MS)),
  ]).catch((err) => console.error('[updater] pre-restart flush falhou', err));
  autoUpdater.quitAndInstall();
}
