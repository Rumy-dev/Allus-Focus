import type { AllusApi } from '../preload/preload';

declare global {
  interface Window {
    allus: AllusApi;
  }
}

export {};
