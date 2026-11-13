// Keyboard and touch input mapped onto the tractor and implement controls.
import { setShuttle, shift, startEngine, stopEngine } from './sim/tractor';
import { attach, toggleLoad, toggleTip, type Implement } from './sim/work';
import { initSound } from './sound';
import { toast, tr, useUI, work } from './store';

const held = new Set<string>();
// Touch controls write here; keyboard and touch are combined each frame.
export const touch = { steer: 0, gas: 0, brake: 0 };

export const KEYS: [string, string][] = [
  ['W / S', 'Gas kaki / rem'],
  ['A / D', 'Setir kiri / kanan'],
  ['T / G', 'Gas tangan naik / turun'],
  ['Spasi', 'Shuttle maju ↔ mundur'],
  ['N', 'Shuttle netral'],
  ['1 – 4', 'Gigi 1–4'],
  ['Z / X / C', 'Range L / M / H (saat berhenti)'],
  ['K', 'Hidupkan / matikan mesin'],
  ['P', 'PTO on / off'],
  ['H', 'Hitch naik / turun'],
  ['O', '4WD on / off'],
  ['L', 'Diff lock'],
  ['Enter', 'Crane: muat janjang'],
  ['J', 'Jungkit bak trailer'],
  ['V', 'Ganti kamera'],
];

export function toggleEngine() {
  void initSound(); // the key is a user gesture too: make sure audio exists
  if (tr.engine === 'off') {
    if (tr.shuttle !== 'N') toast('Pindahkan shuttle ke N (netral) dulu: mesin hanya bisa distarter di netral.');
    startEngine(tr);
  } else stopEngine(tr);
}

export function setImplement(k: Implement) {
  if (Math.abs(tr.v) > 0.5) return toast('Berhenti dulu sebelum mengganti alat.');
  attach(work, tr, k);
}

export const CAMS = ['chase', 'cab', 'orbit', 'top', 'show'] as const;

function onKey(e: KeyboardEvent) {
  if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'SELECT') return;
  const k = e.key.toLowerCase();
  if (e.type === 'keyup') return void held.delete(k);
  if (held.has(k)) return;
  held.add(k);
  if (['w', 'a', 's', 'd', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  if (k === ' ') setShuttle(tr, tr.shuttle === 'F' ? 'R' : 'F');
  else if (k === 'n') setShuttle(tr, 'N');
  else if ('1234'.includes(k)) shift(tr, tr.range, +k - 1);
  else if (k === 'z') shift(tr, 0, tr.gear);
  else if (k === 'x') shift(tr, 1, tr.gear);
  else if (k === 'c') shift(tr, 2, tr.gear);
  else if (k === 'k') toggleEngine();
  else if (k === 'p') tr.pto = !tr.pto;
  else if (k === 'h') tr.hitchUp = !tr.hitchUp;
  else if (k === 'o') tr.fourWd = !tr.fourWd;
  else if (k === 'l') tr.diffLock = !tr.diffLock;
  else if (k === 'enter') toggleLoad(work, tr);
  else if (k === 'j') toggleTip(work, tr);
  else if (k === 'v') {
    const ui = useUI.getState();
    ui.set({ cam: CAMS[(CAMS.indexOf(ui.cam) + 1) % CAMS.length] });
  }
}

export function bindKeys() {
  addEventListener('keydown', onKey);
  addEventListener('keyup', onKey);
  addEventListener('blur', () => held.clear());
}

/** Continuous controls, called every frame. */
export function applyHeld(dt: number) {
  const left = held.has('a') || held.has('arrowleft');
  const right = held.has('d') || held.has('arrowright');
  const want = touch.steer !== 0 ? touch.steer : left ? 1 : right ? -1 : 0;
  // keyboard steering eases in and out like turning a wheel
  tr.steerInput += Math.sign(want - tr.steerInput) * Math.min(Math.abs(want - tr.steerInput), dt * (want === 0 ? 2.5 : 1.6));
  const gas = held.has('w') || held.has('arrowup') ? 1 : touch.gas;
  tr.pedal += (gas - tr.pedal) * Math.min(1, dt * 4);
  const brake = held.has('s') || held.has('arrowdown') ? 1 : touch.brake;
  tr.brake = brake;
  if (held.has('t')) tr.hand = Math.min(1, tr.hand + dt * 0.4);
  if (held.has('g')) tr.hand = Math.max(0, tr.hand - dt * 0.4);
}
