// The oil palm block: rolling ground coloured by surface (grass inter-rows, bare harvest paths and palm circles,
// laterite road, mud patches, concrete pad), instanced palms with fruit bunches, grass the slasher can cut,
// TPH piles of bunches with numbered posts, and the FFB bin.
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { crownGeometry, palmMaterials, palmTrunkH } from './palmKit';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BIN, MUD, PAD, PALMS, PALM_GAP, ROAD_HALF, ROW_GAP, Z0, height, rowZ, surface, BLOCK_X0 } from '../sim/estate';
import { GRASS } from '../sim/work';
import { work } from '../store';
import { bunchGeometry, bunchMaterial } from './Implements';
import { Box, M } from './parts';

const X_HALF = 130;
const Z_MIN = -125;
const Z_MAX = 160;

/** Distance to the nearest palm (for drawing the weeded palm circles). */
function nearestPalm(x: number, z: number) {
  const i = Math.round((z - Z0) / ROW_GAP);
  let best = 99;
  for (let k = i - 1; k <= i + 1; k++) {
    if (k < 0 || k >= 30) continue;
    const ax = Math.abs(x) - BLOCK_X0 - (k % 2) * (PALM_GAP / 2);
    if (ax < -PALM_GAP / 2) continue;
    const j = Math.max(0, Math.min(11, Math.round(ax / PALM_GAP)));
    const px = BLOCK_X0 + j * PALM_GAP + (k % 2) * (PALM_GAP / 2);
    best = Math.min(best, Math.hypot(Math.abs(x) - px, z - rowZ(k)));
  }
  return best;
}

function Ground() {
  const geo = useMemo(() => {
    const w = X_HALF * 2;
    const d = Z_MAX - Z_MIN;
    const g = new THREE.PlaneGeometry(w, d, Math.round(w / 1.2), Math.round(d / 1.2));
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, (Z_MIN + Z_MAX) / 2);
    const p = g.attributes.position;
    const col = new Float32Array(p.count * 3);
    const c = new THREE.Color();
    const grass = new THREE.Color('#4d7a2c');
    const grass2 = new THREE.Color('#6a8a35');
    const soil = new THREE.Color('#6e4c2d');
    const road = new THREE.Color('#a25a32');
    const mud = new THREE.Color('#4a3523');
    const pad = new THREE.Color('#9d9d98');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      p.setY(i, height(x, z) + (surface(x, z) === 'mud' ? -0.06 : 0));
      const s = surface(x, z);
      const n = (Math.sin(x * 1.7) * Math.sin(z * 1.3) + 1) / 2;
      if (s === 'road') c.copy(road).offsetHSL(0, 0, (n - 0.5) * 0.06);
      else if (s === 'mud') c.copy(mud);
      else if (s === 'pad') c.copy(pad);
      else if (s === 'path') c.copy(soil).offsetHSL(0, 0, (n - 0.5) * 0.05);
      else {
        c.copy(grass).lerp(grass2, n * 0.6);
        // weeded palm circle (piringan) of ~2 m radius around each palm
        const dp = nearestPalm(x, z);
        if (dp < 2.1) c.lerp(soil, Math.min(1, (2.1 - dp) / 0.4));
      }
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.95} />
    </mesh>
  );
}

function Puddles() {
  return (
    <group>
      {MUD.map((m) => (
        <mesh key={m.z0} rotation={[-Math.PI / 2, 0, 0]} position={[0.4, height(0, (m.z0 + m.z1) / 2) - 0.02, (m.z0 + m.z1) / 2]}>
          <circleGeometry args={[2.4, 24]} />
          <meshStandardMaterial color="#3a3226" metalness={0.6} roughness={0.15} transparent opacity={0.85} />
        </mesh>
      ))}
    </group>
  );
}

// ---------- palms ----------

function Palms() {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const crownRef = useRef<THREE.InstancedMesh>(null);
  const fruitRef = useRef<THREE.InstancedMesh>(null);
  const { trunkGeo, trunkMat, crownGeo, crownMat } = useMemo(() => {
    const trunkGeo = new THREE.CylinderGeometry(0.32, 0.42, 1, 12);
    trunkGeo.translate(0, 0.5, 0);
    return { trunkGeo, crownGeo: crownGeometry(), ...palmMaterials() };
  }, []);
  useLayoutEffect(() => {
    {
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const e = new THREE.Euler();
      PALMS.forEach((p, i) => {
        const h = height(p.x, p.z);
        const trunkH = palmTrunkH(p.s);
        m.compose(new THREE.Vector3(p.x, h - 0.1, p.z), q.setFromEuler(e.set(0, p.r, 0)), new THREE.Vector3(p.s, trunkH, p.s));
        trunkRef.current?.setMatrixAt(i, m);
        m.compose(new THREE.Vector3(p.x, h + trunkH - 0.2, p.z), q.setFromEuler(e.set(0, p.r, 0)), new THREE.Vector3(p.s, p.s, p.s));
        crownRef.current?.setMatrixAt(i, m);
        for (let k = 0; k < 3; k++) {
          const a = p.r + k * 2.1;
          m.compose(new THREE.Vector3(p.x + Math.sin(a) * 0.45, h + trunkH - 0.55, p.z + Math.cos(a) * 0.45), q.setFromEuler(e.set(0, a, 0)), new THREE.Vector3(1.1, 1.1, 1.1));
          fruitRef.current?.setMatrixAt(i * 3 + k, m);
        }
      });
      [trunkRef, crownRef, fruitRef].forEach((r) => r.current && (r.current.instanceMatrix.needsUpdate = true));
    }
  }, []);
  return (
    <group>
      <instancedMesh ref={trunkRef} args={[trunkGeo, trunkMat, PALMS.length]} castShadow receiveShadow frustumCulled={false} />
      <instancedMesh ref={crownRef} args={[crownGeo, crownMat, PALMS.length]} castShadow frustumCulled={false} />
      <instancedMesh ref={fruitRef} args={[bunchGeometry, bunchMaterial, PALMS.length * 3]} frustumCulled={false} />
    </group>
  );
}

// ---------- grass ----------

function Grass() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const last = useRef(-1);
  const { geo, mat } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const g = c.getContext('2d')!;
    for (let i = 0; i < 26; i++) {
      const x = 4 + Math.random() * 56;
      g.strokeStyle = `rgb(${60 + Math.random() * 40},${110 + Math.random() * 50},${40})`;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x, 64);
      g.quadraticCurveTo(x + (Math.random() - 0.5) * 20, 30, x + (Math.random() - 0.5) * 24, 4 + Math.random() * 20);
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const a = new THREE.PlaneGeometry(0.9, 0.6);
    a.translate(0, 0.3, 0);
    const b = a.clone().rotateY(Math.PI / 2);
    const geo = mergeGeometries([a, b])!;
    const mat = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.9 });
    return { geo, mat };
  }, []);
  const place = (cutOnly: boolean) => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    GRASS.forEach((g, i) => {
      const cut = work.grassCut[i] === 1;
      if (cutOnly && !cut) return;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (i * 2.39) % 6.28);
      m.compose(new THREE.Vector3(g.x, height(g.x, g.z), g.z), q, new THREE.Vector3(g.s, cut ? 0.12 : g.s, g.s));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  useFrame(() => {
    if (last.current === work.cutCount) return;
    place(last.current >= 0);
    last.current = work.cutCount;
  });
  return <instancedMesh ref={ref} args={[geo, mat, GRASS.length]} receiveShadow frustumCulled={false} />;
}

// ---------- TPH piles and the bin ----------

const PER_TPH = 60;

function TphPiles() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const last = useRef('');
  const slots = useMemo(() => {
    // a low mound of bunches
    let s = 5;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: PER_TPH }, (_, i) => {
      const r = Math.sqrt(i / PER_TPH) * 1.5;
      const a = i * 2.4;
      return { dx: Math.cos(a) * r, dz: Math.sin(a) * r * 0.8, dy: (1 - r / 1.6) * 0.55 + 0.18, rx: rnd() * 3, ry: rnd() * 3 };
    });
  }, []);
  useFrame(() => {
    const key = work.tph.map((p) => p.bunches).join(',');
    if (key === last.current || !ref.current) return;
    last.current = key;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    work.tph.forEach((p, k) => {
      const h = height(p.x, p.z);
      slots.forEach((s, i) => {
        // keep the top of the mound for the last bunches: the crane takes from the top
        const shown = i < Math.ceil((p.bunches / 60) * PER_TPH);
        m.compose(new THREE.Vector3(p.x + s.dx * p.side, h + s.dy, p.z + s.dz), q.setFromEuler(e.set(s.rx, s.ry, 0)), new THREE.Vector3().setScalar(shown ? 1 : 0));
        ref.current!.setMatrixAt(k * PER_TPH + i, m);
      });
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <instancedMesh ref={ref} args={[bunchGeometry, bunchMaterial, work.tph.length * PER_TPH]} castShadow frustumCulled={false} />
      {work.tph.map((p) => (
        <group key={p.id} position={[p.x + p.side * 2.4, height(p.x, p.z), p.z - 1.6]}>
          <Box s={[0.08, 1.3, 0.08]} m={M.white} position={[0, 0.65, 0]} />
          <Box s={[0.45, 0.3, 0.03]} m={M.yellow} position={[0, 1.25, 0]} />
          <Text position={[0, 1.25, 0.02]} fontSize={0.12} color="#1b1b1b">
            {`TPH ${String(p.id + 1).padStart(2, '0')}`}
          </Text>
        </group>
      ))}
    </group>
  );
}

function BinStation() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(PAD.x0 + PAD.x1) / 2, 0.11, (PAD.z0 + PAD.z1) / 2]} receiveShadow>
        <planeGeometry args={[PAD.x1 - PAD.x0, PAD.z1 - PAD.z0]} />
        <meshStandardMaterial color="#a3a39e" roughness={0.9} />
      </mesh>
      {/* bin: open-top steel box */}
      <group position={[BIN.x, 0.1, BIN.z]}>
        {[-1, 1].map((s) => (
          <Box key={s} s={[BIN.w, BIN.h, 0.08]} m={M.green} position={[0, BIN.h / 2, (s * BIN.d) / 2]} />
        ))}
        {[-1, 1].map((s) => (
          <Box key={s} s={[0.08, BIN.h, BIN.d]} m={M.green} position={[(s * BIN.w) / 2, BIN.h / 2, 0]} />
        ))}
        <Box s={[BIN.w, 0.08, BIN.d]} m={M.grey} position={[0, 0.05, 0]} />
        <Text position={[0, BIN.h * 0.6, -BIN.d / 2 - 0.05]} rotation={[0, Math.PI, 0]} fontSize={0.35} color="#f2f2f2">
          BIN TBS
        </Text>
      </group>
      {/* marking where to back the trailer up */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[BIN.x, 0.13, BIN.z - BIN.d / 2 - 3]}>
        <ringGeometry args={[2.2, 2.4, 32]} />
        <meshBasicMaterial color="#39d353" />
      </mesh>
      <group position={[-8, 0.1, 130]}>
        <Box s={[0.1, 2.2, 0.1]} m={M.white} position={[0, 1.1, 0]} />
        <Box s={[2.4, 0.8, 0.05]} m={M.green} position={[0, 2.0, 0]} />
        <Text position={[0, 2.05, 0.04]} fontSize={0.22} color="#ffffff" maxWidth={2.2} textAlign="center">
          STASIUN BIN TBS
        </Text>
      </group>
      {/* block sign at the south end of the road */}
      <group position={[-ROAD_HALF - 1.5, height(-5, -100), -100]}>
        <Box s={[0.1, 2, 0.1]} m={M.white} position={[0, 1, 0]} />
        <Box s={[1.4, 0.6, 0.05]} m={M.yellow} position={[0, 1.8, 0]} />
        <Text position={[0, 1.85, 0.04]} fontSize={0.22} color="#1b1b1b">
          BLOK C-12
        </Text>
      </group>
    </group>
  );
}

export function World() {
  return (
    <group>
      <Ground />
      <Puddles />
      <Palms />
      <Grass />
      <TphPiles />
      <BinStation />
    </group>
  );
}

export const WORLD = { X_HALF, Z_MIN, Z_MAX };
