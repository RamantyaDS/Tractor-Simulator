import { describe, expect, it } from 'vitest';
import { GEAR_KMH, create, kmh, maxTorque, setShuttle, shift, startEngine, step, type Tractor } from './tractor';

const run = (t: Tractor, s: number, dt = 0.005) => {
  for (let i = 0; i < s / dt; i++) step(t, dt);
};
const started = () => {
  const t = create();
  startEngine(t);
  run(t, 2);
  return t;
};

describe('engine', () => {
  it('follows the brochure torque points', () => {
    expect(maxTorque(1500)).toBe(560);
    expect(Math.round((maxTorque(2000) * 2000 * 2 * Math.PI) / 60 / 745.7)).toBe(142); // ~145 hp
  });

  it('only cranks in neutral, then idles', () => {
    const t = create();
    setShuttle(t, 'F');
    startEngine(t);
    expect(t.engine).toBe('off');
    setShuttle(t, 'N');
    startEngine(t);
    run(t, 2);
    expect(t.engine).toBe('running');
    expect(t.rpm).toBeGreaterThan(800);
    expect(t.rpm).toBeLessThan(900);
  });
});

describe('driving', () => {
  it('reaches the gear speed at 2000 rpm', () => {
    const t = started();
    t.z = -80;
    shift(t, 1, 1); // M2
    setShuttle(t, 'F');
    t.hand = (2000 - 850) / (2330 - 850);
    run(t, 12);
    expect(kmh(t)).toBeGreaterThan(GEAR_KMH[1][1] * 0.9);
    expect(kmh(t)).toBeLessThan(GEAR_KMH[1][1] * 1.1);
  });

  it('reverses with the power shuttle without touching the gears', () => {
    const t = started();
    t.z = -80;
    shift(t, 0, 3);
    setShuttle(t, 'R');
    t.hand = 0.5;
    run(t, 6);
    expect(t.v).toBeLessThan(-0.5);
  });

  it('refuses a range change while moving', () => {
    const t = started();
    t.z = -80;
    shift(t, 1, 3);
    setShuttle(t, 'F');
    t.hand = 1;
    run(t, 8);
    shift(t, 2, 0);
    expect(t.range).toBe(1);
    expect(t.events).toContain('rangeRefused');
  });

  it('spins the wheels in mud with a heavy pull and stalls a lugged engine', () => {
    const t = started();
    t.z = 33; // mud patch on the road
    t.fourWd = false;
    t.draft = 30000;
    shift(t, 0, 0);
    setShuttle(t, 'F');
    t.hand = 1;
    run(t, 4);
    expect(t.wheelSpin).toBeGreaterThan(0.2);

    const s = started();
    s.z = -80;
    s.draft = 60000;
    shift(s, 2, 3);
    setShuttle(s, 'F');
    s.hand = 0.2;
    run(s, 6);
    expect(s.stalled).toBe(true);
  });
});
