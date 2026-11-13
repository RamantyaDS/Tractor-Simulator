import { describe, expect, it } from 'vitest';
import { BIN } from './estate';
import { create as tractor, startEngine, step as stepT } from './tractor';
import { attach, CRANE_FRONT, craneBase, create, GRASS, step, toggleLoad, toggleTip, TRAILER } from './work';

const run = (fn: (dt: number) => void, s: number, dt = 0.02) => {
  for (let i = 0; i < s / dt; i++) fn(dt);
};

describe('trailer and crane', () => {
  it('loads bunches from a TPH and tips them into the bin', () => {
    const t = tractor();
    const w = create();
    startEngine(t);
    run((dt) => stepT(t, dt), 2);
    const p = w.tph[0];
    // park so the crane base sits beside the TPH
    t.x = 0.5;
    t.z = p.z + 3.2;
    t.heading = 0;
    attach(w, t, 'trailer');
    step(w, t, 0.02);
    expect(Math.hypot(craneBase(w).x - p.x, craneBase(w).z - p.z)).toBeLessThan(TRAILER.craneReach);
    const before = p.bunches;
    toggleLoad(w, t);
    expect(w.autoLoad).toBe(true);
    let overCab = false;
    run((dt) => {
      stepT(t, dt);
      step(w, t, dt);
      if (w.crane.slew < CRANE_FRONT - 1e-6 || w.crane.slew > 2 * Math.PI - CRANE_FRONT + 1e-6) overCab = true;
    }, 60);
    expect(overCab).toBe(false); // never swings over the tractor cab
    expect(w.bunches).toBeGreaterThan(10);
    expect(p.bunches).toBeLessThan(before);
    expect(t.towedMass).toBeGreaterThan(2400);

    // back the trailer up to the bin
    w.autoLoad = false;
    run((dt) => w.crane.step !== 'idle' && step(w, t, dt), 20); // let the last grab finish
    w.tx = BIN.x;
    w.tz = BIN.z - 3.5;
    w.theading = Math.PI;
    toggleTip(w, t);
    expect(w.tipping).toBe(true);
    const load = w.load;
    run((dt) => step(w, t, dt), 15);
    expect(w.delivered).toBeCloseTo(load, 0);
    expect(w.trips).toBe(1);
  });
});

describe('slasher', () => {
  it('cuts grass only when lowered with the PTO on', () => {
    const t = tractor();
    const w = create();
    startEngine(t);
    run((dt) => stepT(t, dt), 2);
    attach(w, t, 'slasher');
    const g = GRASS[500];
    t.x = g.x;
    t.z = g.z + 1.6;
    t.heading = 0;
    t.v = 1;
    t.pto = true;
    step(w, t, 0.02);
    expect(w.cutCount).toBe(0); // still raised
    t.hitch = 0;
    step(w, t, 0.02);
    expect(w.cutCount).toBeGreaterThan(0);
  });
});
