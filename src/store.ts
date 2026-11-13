import { create as createStore } from 'zustand';
import { create as createTractor, step as stepTractor, type Tractor } from './sim/tractor';
import { create as createWork, step as stepWork, type Work } from './sim/work';

// Simulation state, mutated in place every frame; `tick` bumps so React panels refresh at a modest rate.
export const tr: Tractor = createTractor();
export const work: Work = createWork();

export type CamMode = 'chase' | 'cab' | 'orbit' | 'top' | 'show';

interface UI {
  tick: number;
  cam: CamMode;
  help: boolean;
  started: boolean;
  toast: string;
  toastUntil: number;
  bump: () => void;
  set: (p: Partial<Omit<UI, 'bump' | 'set'>>) => void;
}

export const useUI = createStore<UI>((set) => ({
  tick: 0,
  cam: 'chase',
  help: false,
  started: false,
  toast: '',
  toastUntil: 0,
  bump: () => set((s) => ({ tick: s.tick + 1 })),
  set: (p) => set(p),
}));

export function toast(msg: string, ms = 3500) {
  useUI.getState().set({ toast: msg, toastUntil: performance.now() + ms });
}

const listeners = new Set<(e: string) => void>();
export function onEvent(f: (e: string) => void) {
  listeners.add(f);
  return () => void listeners.delete(f);
}

/** Advances the simulation with fixed 5 ms steps. */
export function advance(dt: number) {
  const total = Math.min(dt, 0.1);
  const n = Math.max(1, Math.ceil(total / 0.005));
  for (let i = 0; i < n; i++) {
    stepTractor(tr, total / n);
    stepWork(work, tr, total / n);
  }
  for (const list of [tr.events, work.events]) {
    if (!list.length) continue;
    for (const e of list.splice(0)) for (const f of listeners) f(e);
  }
  if (work.message) {
    toast(work.message);
    work.message = '';
  }
}
