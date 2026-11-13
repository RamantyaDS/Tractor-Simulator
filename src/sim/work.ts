// Implements and the jobs they do in the estate:
// - tipping trailer with a hydraulic grab crane: load fresh fruit bunches (FFB) at the TPH, tip them into the bin
// - rotary slasher on the 3-point linkage, PTO driven: cuts the grass in the inter-rows (gawangan)
// - fertiliser spreader on the 3-point linkage, PTO driven: broadcasts fertiliser onto the palm circles (piringan)
import { BIN, BUNCH_KG, PALMS, ROAD_HALF, ROWS, PATHS, rowZ, makeTph, surface, type Tph } from './estate';
import { ptoRpm, type Tractor } from './tractor';

export type Implement = 'none' | 'trailer' | 'slasher' | 'spreader';

export const IMPLEMENTS: Record<Implement, { name: string; mass: number; towed: boolean; ptoNm: number; desc: string }> = {
  none: { name: 'Tanpa alat', mass: 0, towed: false, ptoNm: 0, desc: 'Traktor saja.' },
  trailer: {
    name: 'Trailer jungkit + crane grabber',
    mass: 2400,
    towed: true,
    ptoNm: 0,
    desc: 'Trailer 8 ton dengan crane hidrolik untuk mengambil janjang dari TPH, lalu dijungkit ke bin.',
  },
  slasher: {
    name: 'Rotary slasher 2 m',
    mass: 650,
    towed: false,
    ptoNm: 95,
    desc: 'Membabat rumput dan gulma di gawangan (jalur antar-barisan). Supaya pemanen mudah lewat, brondolan (buah lepas) mudah dipungut, gulma tidak merebut pupuk dan air dari sawit, dan tikus serta ular tidak bersarang. Pisau diputar PTO, deck diturunkan dengan hitch.',
  },
  spreader: {
    name: 'Spreader pupuk 800 kg',
    mass: 280,
    towed: false,
    ptoNm: 22,
    desc: 'Piringan berputar (PTO) menabur pupuk ke piringan pokok sawit di kiri-kanan traktor.',
  },
};

export const TRAILER = { cap: 8000, drawbar: 1.05, length: 4.2, craneReach: 6.8 };

export type CraneStep = 'idle' | 'swingOut' | 'lower' | 'grab' | 'lift' | 'swingIn' | 'drop';

export interface Work {
  kind: Implement;
  tph: Tph[];
  // trailer
  tx: number; // trailer axle position
  tz: number;
  theading: number;
  load: number; // kg
  bunches: number;
  tip: number; // body angle 0..1
  tipping: boolean;
  autoLoad: boolean;
  crane: { step: CraneStep; t: number; slew: number; reach: number; drop: number; carry: number; target: number };
  delivered: number; // kg tipped into the bin
  trips: number;
  // slasher
  grassCut: Uint8Array;
  cutCount: number;
  // spreader
  fert: number; // kg in hopper
  fed: Set<number>;
  spreading: boolean;
  spreadRadius: number; // m each side, follows PTO speed
  message: string;
  events: string[];
}

// Grass clumps in the inter-rows that are not harvest paths (generated once; the scene draws the same list).
export const GRASS: { x: number; z: number; s: number }[] = (() => {
  const out: { x: number; z: number; s: number }[] = [];
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < ROWS - 1; i++) {
    const zc = rowZ(i) + 3.9;
    if (PATHS.some((p) => Math.abs(p - zc) < 0.5)) continue;
    for (const side of [1, -1])
      for (let x = ROAD_HALF + 4; x < 118; x += 1.15)
        for (let k = -2; k <= 2; k++) {
          const z = zc + k * 1.1 + (rnd() - 0.5) * 0.6;
          out.push({ x: side * (x + (rnd() - 0.5) * 0.8), z, s: 0.6 + rnd() * 0.6 });
        }
  }
  return out;
})();

// Spatial hash for grass lookup.
const CELL = 2;
const grid = new Map<string, number[]>();
GRASS.forEach((g, i) => {
  const k = `${Math.floor(g.x / CELL)},${Math.floor(g.z / CELL)}`;
  const a = grid.get(k);
  if (a) a.push(i);
  else grid.set(k, [i]);
});

export function create(): Work {
  return {
    kind: 'none',
    tph: makeTph(),
    tx: 0,
    tz: 0,
    theading: 0,
    load: 0,
    bunches: 0,
    tip: 0,
    tipping: false,
    autoLoad: false,
    crane: { step: 'idle', t: 0, slew: Math.PI, reach: 0.35, drop: 0, carry: 0, target: -1 },
    delivered: 0,
    trips: 0,
    grassCut: new Uint8Array(GRASS.length),
    cutCount: 0,
    fert: 800,
    fed: new Set(),
    spreading: false,
    spreadRadius: 0,
    message: '',
    events: [],
  };
}

/** Hitch point (drawbar pin) behind the rear axle, and the trailer's crane base near its front. */
export const hitchPoint = (t: Tractor) => ({ x: t.x - Math.sin(t.heading) * TRAILER.drawbar, z: t.z - Math.cos(t.heading) * TRAILER.drawbar });
export const craneBase = (w: Work) => ({ x: w.tx + Math.sin(w.theading) * 3.4, z: w.tz + Math.cos(w.theading) * 3.4 });
/** Centre of the 3-point implement, ~1.4 m behind the rear axle. */
export const implementPoint = (t: Tractor) => ({ x: t.x - Math.sin(t.heading) * 1.6, z: t.z - Math.cos(t.heading) * 1.6 });

export function attach(w: Work, t: Tractor, kind: Implement) {
  w.kind = kind;
  const spec = IMPLEMENTS[kind];
  t.extraMass = spec.towed ? 0 : spec.mass + (kind === 'spreader' ? w.fert : 0);
  t.towedMass = spec.towed ? spec.mass + w.load : 0;
  t.ptoTorque = spec.ptoNm;
  t.draft = 0;
  t.pto = false;
  w.autoLoad = false;
  w.crane.step = 'idle';
  const h = hitchPoint(t);
  w.tx = h.x - Math.sin(t.heading) * TRAILER.length;
  w.tz = h.z - Math.cos(t.heading) * TRAILER.length;
  w.theading = t.heading;
  w.events.push('attach');
}

/** The nearest TPH that still has bunches, if the crane can reach it. */
export function reachableTph(w: Work) {
  const b = craneBase(w);
  let best: Tph | null = null;
  let bd = TRAILER.craneReach;
  for (const p of w.tph) {
    if (p.bunches <= 0) continue;
    const d = Math.hypot(p.x - b.x, p.z - b.z);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}

export function nearBin(w: Work) {
  // trailer tail within 5 m of the bin and pointing roughly at it
  const tailX = w.tx - Math.sin(w.theading) * 1.6;
  const tailZ = w.tz - Math.cos(w.theading) * 1.6;
  return Math.hypot(tailX - BIN.x, tailZ - BIN.z) < 5.5;
}

export function toggleLoad(w: Work, t: Tractor) {
  if (w.kind !== 'trailer') return;
  if (w.autoLoad) {
    w.autoLoad = false;
    return;
  }
  if (t.engine !== 'running') return void (w.message = 'Hidupkan mesin dulu: crane memakai oli hidrolik dari traktor.');
  if (Math.abs(t.v) > 0.3) return void (w.message = 'Berhenti dulu sebelum memakai crane.');
  if (w.load >= TRAILER.cap) return void (w.message = 'Trailer penuh. Bawa ke bin di ujung utara jalan.');
  if (!reachableTph(w)) return void (w.message = 'Tidak ada TPH dalam jangkauan crane (±6,8 m). Dekatkan trailer ke tumpukan janjang.');
  w.autoLoad = true;
  w.message = '';
}

export function toggleTip(w: Work, t: Tractor) {
  if (w.kind !== 'trailer') return;
  if (t.engine !== 'running') return void (w.message = 'Hidupkan mesin dulu: bak dijungkit oleh silinder hidrolik.');
  if (Math.abs(t.v) > 0.3) return void (w.message = 'Berhenti dulu sebelum menjungkit bak.');
  if (w.load <= 0 && w.tip === 0) return void (w.message = 'Bak masih kosong.');
  if (!nearBin(w) && w.load > 0) return void (w.message = 'Mundurkan ujung trailer ke bin TBS (kotak hijau di lantai beton) dulu.');
  w.tipping = !w.tipping;
  w.message = '';
}

const angDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// Crane slew is kept out of the sector ahead of the trailer (where the tractor cab is): angles are handled in
// [FRONT, 2π − FRONT], so swinging from the body to a TPH always goes round the side, never over the cab.
export const CRANE_FRONT = 1.0;
const slewDomain = (a: number) => Math.min(2 * Math.PI - CRANE_FRONT, Math.max(CRANE_FRONT, ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)));

export function step(w: Work, t: Tractor, dt: number) {
  const flow = t.engine === 'running' ? Math.min(1.4, Math.max(0.35, t.rpm / 1500)) : 0; // hydraulic speed follows engine rpm

  if (w.kind === 'trailer') {
    // Trailer axle is dragged by the hitch at fixed distance (tractrix). Reversing naturally tends to jackknife.
    const h = hitchPoint(t);
    let dx = h.x - w.tx;
    let dz = h.z - w.tz;
    const d = Math.hypot(dx, dz) || 1;
    w.tx = h.x - (dx / d) * TRAILER.length;
    w.tz = h.z - (dz / d) * TRAILER.length;
    dx = h.x - w.tx;
    dz = h.z - w.tz;
    w.theading = Math.atan2(dx, dz);
    const rel = angDiff(w.theading, t.heading);
    const lim = 1.3;
    if (Math.abs(rel) > lim) {
      w.theading = t.heading + Math.sign(rel) * lim;
      w.tx = h.x - Math.sin(w.theading) * TRAILER.length;
      w.tz = h.z - Math.cos(w.theading) * TRAILER.length;
      if (!w.message) w.message = 'Jackknife! Trailer menekuk terlalu tajam. Luruskan setir.';
    }
    t.towedMass = IMPLEMENTS.trailer.mass + w.load;

    // Grab crane cycle: swing out, lower, grab 4–6 bunches, lift, swing in, drop into the body.
    const c = w.crane;
    if (w.autoLoad && c.step === 'idle') {
      const p = reachableTph(w);
      if (!p || w.load >= TRAILER.cap || Math.abs(t.v) > 0.3 || t.engine !== 'running') {
        w.autoLoad = false;
        if (w.load >= TRAILER.cap) w.message = 'Trailer penuh! Bawa ke bin di ujung utara jalan.';
        else if (!p) w.message = 'TPH ini sudah kosong. Pindah ke TPH berikutnya.';
      } else {
        c.target = p.id;
        c.step = 'swingOut';
        c.t = 0;
      }
    }
    if (c.step !== 'idle') {
      const p = w.tph[c.target];
      const b = craneBase(w);
      const want = slewDomain(p ? Math.atan2(p.x - b.x, p.z - b.z) - w.theading : Math.PI);
      const dist = p ? Math.hypot(p.x - b.x, p.z - b.z) : 2;
      const sp = dt * flow * 1.9;
      const towards = (v: number, to: number, rate: number) => v + Math.sign(to - v) * Math.min(Math.abs(to - v), rate);
      switch (c.step) {
        case 'swingOut':
          c.slew = towards(c.slew, want, sp * 1.1);
          c.reach = towards(c.reach, Math.min(1, dist / TRAILER.craneReach), sp * 0.6);
          if (Math.abs(c.slew - want) < 0.02 && Math.abs(c.reach - Math.min(1, dist / TRAILER.craneReach)) < 0.02) c.step = 'lower';
          break;
        case 'lower':
          c.drop = towards(c.drop, 1, sp * 0.9);
          if (c.drop >= 1) {
            c.step = 'grab';
            c.t = 0;
          }
          break;
        case 'grab':
          c.t += sp;
          if (c.t > 0.7 && p) {
            const n = Math.min(p.bunches, 6 + Math.floor(Math.random() * 4), Math.floor((TRAILER.cap - w.load) / BUNCH_KG));
            p.bunches -= n;
            c.carry = n;
            c.step = 'lift';
            w.events.push('grab');
          }
          break;
        case 'lift':
          c.drop = towards(c.drop, 0, sp * 0.9);
          if (c.drop <= 0) c.step = 'swingIn';
          break;
        case 'swingIn':
          c.slew = towards(c.slew, Math.PI, sp * 1.1);
          c.reach = towards(c.reach, 0.35, sp * 0.6);
          if (Math.abs(c.slew - Math.PI) < 0.02) c.step = 'drop';
          break;
        case 'drop':
          w.bunches += c.carry;
          w.load += c.carry * BUNCH_KG;
          c.carry = 0;
          w.events.push('drop');
          c.step = 'idle';
          break;
      }
    }

    // Tipping: body rises on its ram in ~6 s, the load slides out at the bin, then it comes back down.
    if (w.tipping) {
      w.tip = Math.min(1, w.tip + (dt * flow) / 6);
      if (w.tip > 0.45 && w.load > 0) {
        const out = Math.min(w.load, dt * 2200);
        w.load -= out;
        w.delivered += out;
        w.bunches = Math.round(w.load / BUNCH_KG);
        if (w.load <= 0) {
          w.trips++;
          w.events.push('emptied');
        }
      }
      if (w.tip >= 1 && w.load <= 0) w.tipping = false;
    } else if (w.tip > 0) w.tip = Math.max(0, w.tip - (dt * flow) / 5);
  }

  if (w.kind === 'slasher') {
    const lowered = t.hitch < 0.15;
    t.draft = lowered ? 1800 : 0;
    t.ptoTorque = IMPLEMENTS.slasher.ptoNm * (lowered ? 1 : 0.4);
    if (lowered && t.pto && t.engine === 'running' && Math.abs(t.v) > 0.05) {
      const ip = implementPoint(t);
      const ax = Math.cos(t.heading);
      const az = -Math.sin(t.heading);
      for (let gx = Math.floor((ip.x - 2) / CELL); gx <= Math.floor((ip.x + 2) / CELL); gx++)
        for (let gz = Math.floor((ip.z - 2) / CELL); gz <= Math.floor((ip.z + 2) / CELL); gz++)
          for (const i of grid.get(`${gx},${gz}`) ?? []) {
            if (w.grassCut[i]) continue;
            const g = GRASS[i];
            const rx = g.x - ip.x;
            const rz = g.z - ip.z;
            const lateral = rx * ax + rz * az;
            const along = rx * Math.sin(t.heading) + rz * Math.cos(t.heading);
            if (Math.abs(lateral) < 1.05 && Math.abs(along) < 0.9) {
              w.grassCut[i] = 1;
              w.cutCount++;
            }
          }
    }
  }

  if (w.kind === 'spreader') {
    t.draft = 0;
    t.extraMass = IMPLEMENTS.spreader.mass + w.fert;
    // The disc throws further the faster it spins: ~7 m each side at PTO 540, only ~2–3 m at idle.
    const disc = Math.min(1.1, ptoRpm(t) / 540);
    w.spreadRadius = t.pto && t.engine === 'running' ? 7 * disc : 0;
    w.spreading = t.pto && t.engine === 'running' && w.fert > 0 && Math.abs(t.v) > 0.2;
    if (w.spreading) {
      // ~3.5 kg per palm at walking speed.
      w.fert = Math.max(0, w.fert - dt * 1.2 * Math.abs(t.v) * Math.max(0.3, disc));
      const ip = implementPoint(t);
      PALMS.forEach((p, i) => {
        if (w.fed.has(i)) return;
        if (Math.hypot(p.x - ip.x, p.z - ip.z) < w.spreadRadius) {
          w.fed.add(i);
          w.events.push('fed');
        }
      });
      if (w.fert <= 0) w.message = 'Hopper pupuk habis. Isi ulang di lantai beton.';
    }
  }

  // Refill the spreader at the concrete pad.
  if (w.kind === 'spreader' && surface(t.x, t.z) === 'pad' && w.fert < 800 && Math.abs(t.v) < 0.2) w.fert = 800;
}

export const grassTotal = GRASS.length;
