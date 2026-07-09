import { Menu, Tray, app, nativeImage } from 'electron';
import { appStore } from './store/appStore';
import * as timerEngine from './store/timerEngine';
import * as windowManager from './windows/windowManager';
import { authManager } from './auth/authManager';
import { POMO_MODES, formatDuration } from '../shared/types';
import type { PomoMode } from '../shared/types';

let tray: Tray | null = null;

// TODO(fase 2): trocar por um ícone de verdade (asset .png/.ico). Por
// enquanto usamos uma imagem vazia — funciona, mas fica "invisível" na
// bandeja em alguns temas do Windows.
function trayIcon() {
  return nativeImage.createEmpty();
}

export function initTray(): void {
  if (tray) return;
  tray = new Tray(trayIcon());
  tray.setToolTip('Allus Clock');
  tray.on('double-click', () => windowManager.showMainWindow());
  render();
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}

export function render(): void {
  if (!tray) return;
  const snapshot = appStore.getSnapshot();
  const session = snapshot.activeSession;
  const timeLabel = session ? formatDuration(Math.max(0, session.plannedSeconds - session.elapsedSeconds)) : '--:--';

  // No Windows não existe texto ao lado do ícone da bandeja como no
  // macOS (NSStatusItem.title) — usamos o tooltip. No macOS, setTitle()
  // funciona e mostra o texto ao lado do ícone.
  tray.setToolTip(`Allus Clock — ${timeLabel}`);
  if (process.platform === 'darwin') {
    tray.setTitle(timeLabel);
  }

  const modeItem = (mode: PomoMode) => ({
    label: POMO_MODES[mode].menuTitle,
    type: 'radio' as const,
    checked: snapshot.selectedMode === mode,
    click: () => timerEngine.setMode(mode),
  });

  const menu = Menu.buildFromTemplate([
    { label: `Timer: ${timeLabel}`, enabled: false },
    { type: 'separator' },
    { label: 'Play / Pause', click: () => timerEngine.playPause() },
    { label: 'Stop', click: () => timerEngine.stop() },
    { type: 'separator' },
    modeItem('classic'),
    modeItem('deskTime'),
    modeItem('deepWork'),
    { type: 'separator' },
    { label: 'Abrir Allus Clock', click: () => windowManager.showMainWindow() },
    { label: 'Central de Tarefas', click: () => windowManager.showTaskCenter() },
    { label: 'Central de Tempos', click: () => windowManager.showTimeCenter() },
    { type: 'separator' },
    {
      label: 'Sair da conta',
      click: async () => {
        await authManager.signOut();
        windowManager.closeAllAppWindows();
        destroyTray();
        windowManager.showLogin();
      },
    },
    {
      label: 'Sair do Allus Clock',
      accelerator: 'CmdOrCtrl+Q',
      click: () => {
        windowManager.setQuitting(true);
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
}
