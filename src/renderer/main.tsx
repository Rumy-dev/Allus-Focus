import type { ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { Login } from './pages/Login/Login';
import { MainWindow } from './pages/MainWindow/MainWindow';
import { FloatingPanel } from './pages/FloatingPanel/FloatingPanel';
import { TaskCenter } from './pages/TaskCenter/TaskCenter';
import { TimeCenter } from './pages/TimeCenter/TimeCenter';
import { Dashboard } from './pages/Dashboard/Dashboard';
import { Pulse } from './pages/Dashboard/Pulse';
import { Splash } from './pages/Splash/Splash';
import './styles/index.css';

const params = new URLSearchParams(window.location.search);
const page = params.get('window') ?? 'main';

const pages: Record<string, ComponentType> = {
  login: Login,
  main: MainWindow,
  floating: FloatingPanel,
  taskCenter: TaskCenter,
  timeCenter: TimeCenter,
  dashboard: Dashboard,
  pulse: Pulse,
  splash: Splash,
};

const Page = pages[page] ?? MainWindow;

const root = createRoot(document.getElementById('root')!);
root.render(<Page />);
