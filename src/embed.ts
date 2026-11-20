// Set by the Traknus World (github.com/RamantyaDS/Traknus-World) when it mounts this simulator as one zone of the
// shared world. `on`: the world owns the sky, lights, fog and post effects, so the zone leaves out its own and its
// backdrop. `input`: the keyboard and gamepad reach this simulator only while the player is at the controls.
// `solids`: things of the world standing in this zone (the delivery truck), in this simulator's coordinates; the
// machine and what it carries cannot pass through them. On this site all stay at their defaults and nothing changes.

/** A solid box: centre, half sizes, yaw (local x → (cos, −sin), local z → (sin, cos)), bottom and top. */
export interface Solid {
  id: string;
  x: number;
  z: number;
  hx: number;
  hz: number;
  yaw: number;
  y0: number;
  y1: number;
}

export const EMBED = { on: false, input: true, solids: [] as Solid[] };

/** The first world solid a box overlaps (separating-axis test on the ground plan, plus the height ranges). */
export function hitsSolid(b: Omit<Solid, 'id'>): Solid | null {
  for (const s of EMBED.solids) {
    if (b.y1 <= s.y0 || b.y0 >= s.y1) continue;
    const dx = s.x - b.x;
    const dz = s.z - b.z;
    const axes = [b.yaw, s.yaw].flatMap((a) => [
      [Math.cos(a), -Math.sin(a)],
      [Math.sin(a), Math.cos(a)],
    ]);
    const r = (o: Omit<Solid, 'id'>, nx: number, nz: number) =>
      o.hx * Math.abs(Math.cos(o.yaw) * nx - Math.sin(o.yaw) * nz) + o.hz * Math.abs(Math.sin(o.yaw) * nx + Math.cos(o.yaw) * nz);
    if (axes.every(([nx, nz]) => Math.abs(dx * nx + dz * nz) < r(b, nx, nz) + r(s, nx, nz))) return s;
  }
  return null;
}
