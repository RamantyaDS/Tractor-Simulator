// Visual effects for the work being done, all in world space:
// - fertiliser granules fanning out of the spreader disc, and the palm circles they land on marked with granules
// - grass clippings thrown out of the slasher deck, dust when it scrapes bare ground
// - bunches dropping from the grapple into the trailer, sliding out of the tipped body into the bin, which fills up
// - dust behind the wheels on dry ground, mud spray in the mud (more when the wheels spin)
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BIN, BUNCH_KG, PALMS, height } from '../sim/estate';
import { SPEC } from '../sim/tractor';
import { craneBase } from '../sim/work';
import { tr, work } from '../store';
import { bunchGeometry, bunchMaterial } from './Implements';

// ---------- small debris particles (points) ----------

const N = 4000;
const vert = /* glsl */ `
  attribute float size; attribute float alpha; attribute vec3 tint;
  uniform float scale;
  varying float vA; varying vec3 vC;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = max(1.5, size * scale / -mv.z);
    gl_Position = projectionMatrix * mv;
    vA = alpha; vC = tint;
  }`;
const frag = /* glsl */ `
  varying float vA; varying vec3 vC;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vC, vA * smoothstep(0.5, 0.3, d));
  }`;

interface P {
  p: THREE.Vector3;
  v: THREE.Vector3;
  age: number;
  life: number;
  size: number;
  grow: number;
  drag: number;
  grav: number;
  rest: boolean;
  c: THREE.Color;
  a: number;
}

const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
/** Tractor-local point → world. */
function toWorld(x: number, y: number, z: number, out = new THREE.Vector3()) {
  tmpQ.setFromEuler(tmpE.set(-tr.pitch, tr.heading, tr.roll, 'YXZ'));
  return out.set(x, y, z).applyQuaternion(tmpQ).add(new THREE.Vector3(tr.x, tr.y, tr.z));
}

const FERT = [new THREE.Color('#f2efe6'), new THREE.Color('#e7c6c6'), new THREE.Color('#d9dfe8')];
const GRASS = [new THREE.Color('#5d8a2e'), new THREE.Color('#7aa23a'), new THREE.Color('#4a6e24')];
const DUST = new THREE.Color('#b9875c');
const MUD = new THREE.Color('#3f2c1c');

function Debris() {
  const { geo, mat, parts } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    for (const [k, n] of [['position', 3], ['size', 1], ['alpha', 1], ['tint', 3]] as const) geo.setAttribute(k, new THREE.BufferAttribute(new Float32Array(N * n), n));
    const mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, uniforms: { scale: { value: 800 } } });
    const parts: P[] = Array.from({ length: N }, () => ({ p: new THREE.Vector3(0, -99, 0), v: new THREE.Vector3(), age: 9, life: 1, size: 0, grow: 0, drag: 0, grav: 0, rest: false, c: new THREE.Color(), a: 1 }));
    return { geo, mat, parts };
  }, []);
  const next = useRef(0);
  const acc = useRef({ fert: 0, grass: 0, dust: 0, mud: 0 });
  const lastCut = useRef(work.cutCount);
  const v3 = useMemo(() => new THREE.Vector3(), []);

  const emit = (p: THREE.Vector3, v: THREE.Vector3, c: THREE.Color, size: number, life: number, o: Partial<P> = {}) => {
    const q = parts[next.current];
    next.current = (next.current + 1) % N;
    q.p.copy(p);
    q.v.copy(v);
    q.c.copy(c);
    q.size = size;
    q.life = life;
    q.age = 0;
    q.grow = o.grow ?? 0;
    q.drag = o.drag ?? 0.2;
    q.grav = o.grav ?? 9.8;
    q.a = o.a ?? 1;
    q.rest = false;
  };

  useFrame(({ camera, size }, raw) => {
    const dt = Math.min(raw, 0.05);
    mat.uniforms.scale.value = (size.height / 2) * (camera as THREE.PerspectiveCamera).projectionMatrix.elements[5];
    const fx = Math.sin(tr.heading);
    const fz = Math.cos(tr.heading);
    const rx = -fz; // tractor's right in world
    const rz = fx;
    const speed = Math.abs(tr.v);
    const A = acc.current;

    // Spreader: granules thrown in a wide fan behind and to both sides; how far depends on disc (PTO) speed.
    if (work.kind === 'spreader' && work.spreading) {
      A.fert += dt * 420;
      const disc = toWorld(0, 0.95 + tr.hitch * 0.55, -1.65, v3.clone());
      const reach = work.spreadRadius;
      while (A.fert > 1) {
        A.fert--;
        const side = Math.random() < 0.5 ? -1 : 1;
        const lat = (0.3 + Math.random()) * reach * 1.1 * side; // lateral distance it should fly
        const back = -(0.5 + Math.random() * 2.5);
        const flight = 0.55 + Math.random() * 0.25;
        const v = new THREE.Vector3(rx * lat + fx * back, 2.3 + Math.random() * 1.2, rz * lat + fz * back).multiplyScalar(1 / flight);
        v.y = 2.5 + Math.random() * 1.5;
        v.add(new THREE.Vector3(fx * tr.v, 0, fz * tr.v));
        emit(disc, v, FERT[Math.floor(Math.random() * 3)], 0.08, 4, { drag: 0.15 });
      }
    }

    // Slasher: clippings blown out of the back and sides of the deck for every clump it cuts; dust on bare ground.
    if (work.kind === 'slasher') {
      const cut = work.cutCount - lastCut.current;
      lastCut.current = work.cutCount;
      const working = tr.pto && tr.engine === 'running' && tr.hitch < 0.15 && speed > 0.05;
      A.grass += cut * 18;
      if (working && tr.ground !== 'grass') A.dust += dt * 25;
      const deck = toWorld(0, 0.35, -1.75, v3.clone());
      while (A.grass > 1) {
        A.grass--;
        const side = Math.random() < 0.5 ? -1 : 1;
        const out = 1.5 + Math.random() * 3;
        const p = deck.clone().add(new THREE.Vector3(rx * side * Math.random(), 0, rz * side * Math.random()));
        const v = new THREE.Vector3(rx * side * out - fx * (1 + Math.random() * 2), 1 + Math.random() * 2.5, rz * side * out - fz * (1 + Math.random() * 2));
        emit(p, v, GRASS[Math.floor(Math.random() * 3)], 0.07, 2.5, { drag: 1.2, grav: 5 });
      }
      while (A.dust > 1) {
        A.dust--;
        const p = deck.clone().add(new THREE.Vector3(-fx * 0.7, -0.2, -fz * 0.7));
        emit(p, new THREE.Vector3((Math.random() - 0.5) * 1.5, 0.6 + Math.random(), (Math.random() - 0.5) * 1.5), DUST, 0.35, 1.6, { grow: 3, drag: 1.5, grav: -0.3, a: 0.35 });
      }
    } else lastCut.current = work.cutCount;

    // Wheels: dust on dry ground at speed, mud spray in the mud, more when they spin.
    const spin = tr.wheelSpin;
    const dry = tr.ground === 'road' || tr.ground === 'path';
    if (dry && speed > 1.2) A.dust += dt * (speed * 6 + spin * 20);
    if (tr.ground === 'mud' && (speed > 0.3 || spin > 0.1)) A.mud += dt * (speed * 25 + spin * 60);
    while (A.dust > 1) {
      A.dust--;
      const side = Math.random() < 0.5 ? -1 : 1;
      const w = toWorld(side * (SPEC.rearTrack / 2), 0.1, -0.5, v3.clone());
      emit(w, new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.4 + Math.random() * 0.6, (Math.random() - 0.5) * 0.8), DUST, 0.4, 2.2, { grow: 4, drag: 1.2, grav: -0.2, a: 0.28 });
    }
    while (A.mud > 1) {
      A.mud--;
      const side = Math.random() < 0.5 ? -1 : 1;
      const w = toWorld(side * (SPEC.rearTrack / 2), 0.25, -0.75, v3.clone());
      const back = Math.sign(tr.v || 1);
      emit(w, new THREE.Vector3(side * rx * 0.6 - fx * back * (2 + spin * 3), 1.5 + Math.random() * 2, side * rz * 0.6 - fz * back * (2 + spin * 3)), MUD, 0.08, 1.4, { drag: 0.4 });
    }

    // integrate
    const pos = geo.attributes.position.array as Float32Array;
    const sz = geo.attributes.size.array as Float32Array;
    const al = geo.attributes.alpha.array as Float32Array;
    const tn = geo.attributes.tint.array as Float32Array;
    for (let i = 0; i < N; i++) {
      const q = parts[i];
      if (q.age < q.life) {
        q.age += dt;
        if (!q.rest) {
          q.v.multiplyScalar(1 - Math.min(0.9, q.drag * dt));
          q.v.y -= q.grav * dt;
          q.p.addScaledVector(q.v, dt);
          const g = height(q.p.x, q.p.z) + 0.02;
          if (q.p.y < g && q.grav > 0) {
            q.p.y = g;
            q.rest = true; // lands and lies on the ground for a moment
          }
        }
      }
      const t = Math.min(1, q.age / q.life);
      pos[i * 3] = q.p.x;
      pos[i * 3 + 1] = t >= 1 ? -99 : q.p.y;
      pos[i * 3 + 2] = q.p.z;
      sz[i] = q.size * (1 + q.grow * t);
      al[i] = q.a * (t > 0.7 ? (1 - t) / 0.3 : 1);
      tn.set([q.c.r, q.c.g, q.c.b], i * 3);
    }
    for (const k of ['position', 'size', 'alpha', 'tint']) geo.attributes[k].needsUpdate = true;
  });

  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={4} />;
}

// ---------- fertilised palm circles ----------

function FedCircles() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const shown = useRef(0);
  const { geo, mat } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    for (let i = 0; i < 900; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 60;
      g.fillStyle = ['#f4f1e8', '#ead0cf', '#dfe5ee'][i % 3];
      g.fillRect(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 2, 2);
    }
    const tex = new THREE.CanvasTexture(c);
    const geo = new THREE.CircleGeometry(2.0, 24);
    geo.rotateX(-Math.PI / 2);
    return { geo, mat: new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 1 }) };
  }, []);
  useFrame(() => {
    const m = ref.current;
    if (!m || shown.current === work.fed.size) return;
    const mx = new THREE.Matrix4();
    let i = 0;
    for (const k of work.fed) {
      const p = PALMS[k];
      mx.makeTranslation(p.x, height(p.x, p.z) + 0.04, p.z);
      m.setMatrixAt(i++, mx);
    }
    m.count = i;
    m.instanceMatrix.needsUpdate = true;
    shown.current = work.fed.size;
  });
  return <instancedMesh ref={ref} args={[geo, mat, PALMS.length]} frustumCulled={false} />;
}

// ---------- bunches falling into the trailer and out into the bin ----------

const FALL = 60;

function FallingBunches() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const items = useMemo(() => Array.from({ length: FALL }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), alive: false, floor: 0 })), []);
  const next = useRef(0);
  const lastBunches = useRef(work.bunches);
  const lastDelivered = useRef(work.delivered);
  const acc = useRef(0);
  const mx = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);

  const spawn = (p: THREE.Vector3, v: THREE.Vector3, floor: number) => {
    const it = items[next.current];
    next.current = (next.current + 1) % FALL;
    it.p.copy(p);
    it.v.copy(v);
    it.r.set(Math.random() * 3, Math.random() * 3, 0);
    it.w.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, 0);
    it.alive = true;
    it.floor = floor;
  };

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    if (work.kind === 'trailer') {
      // grapple released over the body: bunches drop in
      const added = work.bunches - lastBunches.current;
      if (added > 0 && work.crane.step === 'idle') {
        const b = craneBase(work);
        const back = new THREE.Vector3(-Math.sin(work.theading), 0, -Math.cos(work.theading));
        for (let i = 0; i < Math.min(5, added); i++) {
          const p = new THREE.Vector3(b.x, height(b.x, b.z) + 3.3, b.z).addScaledVector(back, 1.2 + Math.random() * 1.2);
          p.x += (Math.random() - 0.5) * 0.6;
          spawn(p, new THREE.Vector3(0, -0.5, 0), height(p.x, p.z) + 1.3);
        }
      }
      // tipping into the bin: a stream of bunches off the back edge
      const out = work.delivered - lastDelivered.current;
      if (out > 0) {
        acc.current += out / BUNCH_KG;
        const tailX = work.tx - Math.sin(work.theading) * 1.9;
        const tailZ = work.tz - Math.cos(work.theading) * 1.9;
        while (acc.current > 1.5) {
          acc.current -= 1.5;
          const p = new THREE.Vector3(tailX + (Math.random() - 0.5) * 1.6, height(tailX, tailZ) + 1.3, tailZ);
          spawn(p, new THREE.Vector3(-Math.sin(work.theading) * 1.5, 0.5, -Math.cos(work.theading) * 1.5), 0.1 + 0.3);
        }
      }
    }
    lastBunches.current = work.bunches;
    lastDelivered.current = work.delivered;
    const m = ref.current!;
    items.forEach((it, i) => {
      if (it.alive) {
        it.v.y -= 9.8 * dt;
        it.p.addScaledVector(it.v, dt);
        it.r.x += it.w.x * dt;
        it.r.y += it.w.y * dt;
        if (it.p.y < it.floor) it.alive = false;
      }
      mx.compose(it.p, q.setFromEuler(it.r), new THREE.Vector3().setScalar(it.alive ? 1 : 0));
      m.setMatrixAt(i, mx);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[bunchGeometry, bunchMaterial, FALL]} castShadow frustumCulled={false} />;
}

/** The bin fills up with what has been tipped into it. */
function BinPile() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const shown = useRef(-1);
  const slots = useMemo(() => {
    let s = 21;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: 300 }, (_, i) => {
      const layer = Math.floor(i / 60);
      return new THREE.Matrix4().compose(
        new THREE.Vector3(BIN.x + (rnd() - 0.5) * (BIN.w - 0.5), 0.35 + layer * 0.26 + rnd() * 0.06, BIN.z + (rnd() - 0.5) * (BIN.d - 0.4)),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, 0)),
        new THREE.Vector3(1, 1, 1),
      );
    });
  }, []);
  useFrame(() => {
    const n = Math.min(slots.length, Math.round(work.delivered / BUNCH_KG / 1.5));
    if (n === shown.current || !ref.current) return;
    for (let i = 0; i < n; i++) ref.current.setMatrixAt(i, slots[i]);
    ref.current.count = n;
    ref.current.instanceMatrix.needsUpdate = true;
    shown.current = n;
  });
  return <instancedMesh ref={ref} args={[bunchGeometry, bunchMaterial, slots.length]} frustumCulled={false} />;
}

export function Fx() {
  return (
    <group>
      <Debris />
      <FedCircles />
      <FallingBunches />
      <BinPile />
    </group>
  );
}
