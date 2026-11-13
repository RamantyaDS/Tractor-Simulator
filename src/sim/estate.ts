// Layout of the oil palm block: a laterite collection road running north–south, palm rows on both sides
// (triangular planting, 9 m between palms, ~7.8 m between rows), harvest paths every other inter-row ending at a
// TPH (tempat pengumpulan hasil) on the road edge, and an FFB bin station at the north end of the road.
// Units are metres; x east, z north, y up.

export const ROAD_HALF = 3.2;
export const ROW_GAP = 7.8;
export const PALM_GAP = 9;
export const ROWS = 30;
export const PALMS_PER_ROW = 12;
export const Z0 = -110;
export const BLOCK_X0 = 10; // first palm distance from the road centre
export const BIN = { x: 9, z: 136, w: 6, d: 3, h: 1.7 }; // 10 t FFB bin beside the road
export const PAD = { x0: -14, x1: 18, z0: 124, z1: 152 }; // concrete loading pad

export const rowZ = (i: number) => Z0 + i * ROW_GAP;

export interface Palm {
  x: number;
  z: number;
  s: number; // size factor
  r: number; // rotation
  side: 1 | -1;
}

function rand(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export const PALMS: Palm[] = (() => {
  const rnd = rand(7);
  const out: Palm[] = [];
  for (let i = 0; i < ROWS; i++)
    for (const side of [1, -1] as const)
      for (let j = 0; j < PALMS_PER_ROW; j++) {
        const x = side * (BLOCK_X0 + j * PALM_GAP + (i % 2) * (PALM_GAP / 2));
        out.push({ x, z: rowZ(i), s: 0.85 + rnd() * 0.3, r: rnd() * Math.PI * 2, side });
      }
  return out;
})();

/** Harvest paths: the inter-row after every even row. Bare soil, no grass; bunches are carried along them to the TPH. */
export const PATHS = Array.from({ length: ROWS / 2 }, (_, k) => rowZ(2 * k) + ROW_GAP / 2);

export interface Tph {
  id: number;
  x: number;
  z: number;
  side: 1 | -1;
  bunches: number; // fresh fruit bunches waiting
}

/** One TPH at the road end of each harvest path, alternating sides; 25–60 bunches each (~23 kg per bunch). */
export function makeTph(): Tph[] {
  const rnd = rand(11);
  return PATHS.map((z, k) => {
    const side = (k % 2 ? -1 : 1) as 1 | -1;
    return { id: k, x: side * (ROAD_HALF + 1.6), z, side, bunches: 25 + Math.floor(rnd() * 36) };
  });
}

export const BUNCH_KG = 23;

/** Gently rolling ground, flattened on the road and pad. */
export function height(x: number, z: number) {
  const roll = 0.45 * Math.sin(x / 23) * Math.cos(z / 31) + 0.25 * Math.sin((x + z) / 17) + 0.12 * Math.sin(x / 7.3 + z / 11);
  const roadW = Math.min(1, Math.max(0, (Math.abs(x) - ROAD_HALF) / 4));
  const road = 0.15 * Math.sin(z / 40);
  const onPad = x > PAD.x0 - 4 && x < PAD.x1 + 4 && z > PAD.z0 - 4 && z < PAD.z1 + 4;
  let h = road + (roll - road) * roadW;
  if (onPad) {
    const k = Math.min(1, Math.max(0, Math.min(x - PAD.x0 + 4, PAD.x1 + 4 - x, z - PAD.z0 + 4, PAD.z1 + 4 - z) / 4));
    h = h * (1 - k) + 0.1 * k;
  }
  return h;
}

export const MUD: { z0: number; z1: number }[] = [
  { z0: 28, z1: 41 },
  { z0: -66, z1: -55 },
];

export type Surface = 'road' | 'mud' | 'path' | 'grass' | 'pad';

export function surface(x: number, z: number): Surface {
  if (x > PAD.x0 && x < PAD.x1 && z > PAD.z0 && z < PAD.z1) return 'pad';
  if (Math.abs(x) < ROAD_HALF + 0.3) return MUD.some((m) => z > m.z0 && z < m.z1) ? 'mud' : 'road';
  if (PATHS.some((p) => Math.abs(z - p) < 1.6)) return 'path';
  return 'grass';
}

/** Grip and rolling resistance by surface (rubber tractor tyres). */
export const GROUND: Record<Surface, { mu: number; crr: number; name: string }> = {
  road: { mu: 0.62, crr: 0.04, name: 'Jalan laterit' },
  pad: { mu: 0.75, crr: 0.025, name: 'Lantai beton' },
  path: { mu: 0.55, crr: 0.07, name: 'Jalan panen' },
  grass: { mu: 0.5, crr: 0.09, name: 'Gawangan berumput' },
  mud: { mu: 0.28, crr: 0.16, name: 'Lumpur' },
};
