// Implements: rotary slasher and fertiliser spreader (on the 3-point linkage, drawn in tractor space), and the tipping
// trailer with its hydraulic grab crane (drawn in world space, following the trailer pose from the simulation).
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { height } from '../sim/estate';
import { TRAILER } from '../sim/work';
import { tr, work } from '../store';
import { Box, Cyl, M, Pipe } from './parts';

/** A fresh fruit bunch: knobbly ellipsoid, black-red with orange ripe fruit. */
export const bunchGeometry = (() => {
  const g = new THREE.IcosahedronGeometry(0.22, 2);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const n = 1 + 0.12 * Math.sin(x * 40) * Math.sin(y * 37) * Math.sin(z * 43);
    p.setXYZ(i, x * n * 1.1, y * n * 1.35, z * n);
    const t = (Math.sin(x * 23 + z * 17) + 1) / 2;
    c.set(t > 0.75 ? '#d2561c' : t > 0.4 ? '#5a1210' : '#1d0b08');
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
})();
export const bunchMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.05 });

// ---------- slasher ----------

export function Slasher() {
  const blades = useRef<THREE.Group>(null);
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    ref.current!.visible = work.kind === 'slasher';
    if (tr.pto && tr.engine === 'running') blades.current!.rotation.y += Math.min(30, (tr.rpm / 2000) * 30) * dt;
  });
  return (
    <group ref={ref} position={[0, 0.05, -1.75]}>
      {/* headstock to the linkage, gearbox and guarded PTO shaft */}
      <Box s={[0.9, 0.5, 0.08]} m={M.orange} position={[0, 0.55, 0.62]} />
      <Box s={[0.08, 0.08, 0.9]} m={M.orange} position={[0, 0.72, 0.25]} rotation={[0.35, 0, 0]} />
      <Box s={[0.32, 0.28, 0.32]} r={0.03} m={M.grey} position={[0, 0.48, 0]} />
      <Cyl r={0.04} l={0.85} axis="z" m={M.yellow} position={[0, 0.6, 0.7]} rotation={[0.1, 0, 0]} />
      {/* round-ended deck 2 m wide, skids */}
      <Box s={[1.6, 0.06, 1.2]} m={M.orange} position={[0, 0.3, 0]} />
      {[-0.8, 0.8].map((x) => (
        <Cyl key={x} r={0.6} l={0.06} m={M.orange} position={[x * 0.75, 0.3, 0]} />
      ))}
      <Box s={[2.0, 0.22, 0.04]} m={M.orange} position={[0, 0.2, 0.6]} />
      <Box s={[2.0, 0.22, 0.04]} m={M.orange} position={[0, 0.2, -0.6]} />
      {[-1, 1].map((s) => (
        <Box key={s} s={[0.06, 0.12, 1.3]} m={M.grey} position={[s * 1.02, 0.08, 0]} />
      ))}
      <group ref={blades} position={[0, 0.16, 0]}>
        <Box s={[1.8, 0.02, 0.12]} m={M.steel} />
        <Box s={[0.12, 0.02, 1.0]} m={M.steel} />
      </group>
    </group>
  );
}

// ---------- spreader ----------

export function Spreader() {
  const disc = useRef<THREE.Group>(null);
  const ref = useRef<THREE.Group>(null);
  const pts = useRef<THREE.Points>(null);
  const N = 400;
  const { geo, parts } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    return { geo, parts: Array.from({ length: N }, () => ({ p: new THREE.Vector3(0, -9, 0), v: new THREE.Vector3(), age: 9 })) };
  }, []);
  const next = useRef(0);
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    ref.current!.visible = work.kind === 'spreader';
    const spinning = tr.pto && tr.engine === 'running' && work.kind === 'spreader';
    if (spinning) disc.current!.rotation.y += 25 * dt;
    // granules flung sideways and back from the spinning disc
    if (work.spreading) {
      for (let k = 0; k < 14; k++) {
        const q = parts[next.current];
        next.current = (next.current + 1) % N;
        const a = (Math.random() - 0.5) * Math.PI * 1.3 + Math.PI;
        const sp = 5 + Math.random() * 4;
        q.p.set(0, 0.55, -0.35);
        q.v.set(Math.sin(a) * sp, 1.2 + Math.random(), Math.cos(a) * sp * 0.6);
        q.age = 0;
      }
    }
    const pos = geo.attributes.position.array as Float32Array;
    parts.forEach((q, i) => {
      q.age += dt;
      if (q.p.y > -0.4) {
        q.v.y -= 9.8 * dt;
        q.p.addScaledVector(q.v, dt);
      }
      pos[i * 3] = q.p.x;
      pos[i * 3 + 1] = q.age > 1.5 ? -9 : q.p.y;
      pos[i * 3 + 2] = q.p.z;
    });
    geo.attributes.position.needsUpdate = true;
    void pts;
  });
  return (
    <group ref={ref} position={[0, 0.2, -1.55]}>
      <Box s={[0.9, 0.5, 0.08]} m={M.blue} position={[0, 0.45, 0.45]} />
      {/* conical hopper */}
      <mesh material={M.blue} position={[0, 1.05, 0]} castShadow>
        <cylinderGeometry args={[0.65, 0.18, 0.75, 24, 1, true]} />
      </mesh>
      <mesh material={M.blue} position={[0, 1.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.6, 0.66, 24]} />
      </mesh>
      <mesh position={[0, 1.35, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.6, 24]} />
        <meshStandardMaterial color="#e8e2d0" roughness={0.9} />
      </mesh>
      {[-1, 1].map((s) => (
        <Box key={s} s={[0.06, 0.8, 0.06]} m={M.grey} position={[s * 0.4, 0.35, 0]} />
      ))}
      <Cyl r={0.035} l={0.7} axis="z" m={M.yellow} position={[0, 0.5, 0.65]} />
      <group ref={disc} position={[0, 0.55, -0.1]}>
        <Cyl r={0.32} l={0.02} m={M.steel} />
        {[0, 1, 2, 3].map((i) => (
          <Box key={i} s={[0.3, 0.05, 0.02]} m={M.steel} position={[Math.cos((i * Math.PI) / 2) * 0.15, 0.03, Math.sin((i * Math.PI) / 2) * 0.15]} rotation={[0, (-i * Math.PI) / 2, 0]} />
        ))}
      </group>
      <points ref={pts} geometry={geo}>
        <pointsMaterial color="#efe9d8" size={0.06} />
      </points>
    </group>
  );
}

// ---------- trailer with grab crane ----------

const BUNCH_SLOTS = 220;

export function Trailer() {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const slew = useRef<THREE.Group>(null);
  const boom = useRef<THREE.Group>(null);
  const stick = useRef<THREE.Group>(null);
  const grapple = useRef<THREE.Group>(null);
  const tines = useRef<THREE.Group[]>([]);
  const carried = useRef<THREE.InstancedMesh | null>(null);
  const load = useRef<THREE.InstancedMesh>(null);
  const wheels = useRef<THREE.Group[]>([]);
  const drawbar = useRef<THREE.Group>(null);

  // Fixed, random-looking places for bunches in the body, filled bottom-up.
  const slots = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    let s = 9;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < BUNCH_SLOTS; i++) {
      const layer = Math.floor(i / 44);
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3((rnd() - 0.5) * 1.8, 0.25 + layer * 0.24 + rnd() * 0.06, (rnd() - 0.5) * 3.9),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3)),
        new THREE.Vector3(1, 1, 1),
      );
      out.push(m);
    }
    return out;
  }, []);

  useFrame((_, dt) => {
    const g = group.current!;
    g.visible = work.kind === 'trailer';
    if (!g.visible) return;
    const y = height(work.tx, work.tz);
    g.position.set(work.tx, y, work.tz);
    const fy = height(work.tx + Math.sin(work.theading) * 2, work.tz + Math.cos(work.theading) * 2);
    g.rotation.set(-Math.atan2(fy - y, 2), work.theading, 0, 'YXZ');
    // body tips up to ~50° about its rear edge
    body.current!.rotation.x = work.tip * 0.85;
    const c = work.crane;
    slew.current!.rotation.y = c.slew;
    boom.current!.rotation.x = -0.9 + c.reach * 0.75 + c.drop * 0.35;
    stick.current!.rotation.x = 1.9 - c.reach * 1.25 + c.drop * 0.5;
    // the grapple hangs plumb
    grapple.current!.rotation.x = -(boom.current!.rotation.x + stick.current!.rotation.x);
    const open = c.step === 'lower' || c.step === 'swingOut' ? 0.6 : c.step === 'drop' ? 0.6 : 0.1;
    tines.current.forEach((t, i) => t && (t.rotation.z = open * (i === 0 ? 1 : -1)));
    const n = Math.min(BUNCH_SLOTS, Math.round(work.bunches * 0.55));
    const lm = load.current!;
    for (let i = 0; i < n; i++) lm.setMatrixAt(i, slots[i]);
    lm.count = n;
    lm.instanceMatrix.needsUpdate = true;
    carried.current!.count = c.carry > 0 ? 4 : 0;
    // wheels roll with the tractor
    wheels.current.forEach((w) => w && (w.rotation.x += (tr.v / 0.46) * dt));
    // drawbar points at the tractor hitch
    const rel = Math.atan2(Math.sin(tr.heading - work.theading), Math.cos(tr.heading - work.theading));
    drawbar.current!.rotation.y = rel * 0.5;
  });

  const L = TRAILER.length;
  return (
    <group ref={group} visible={false}>
      {/* tandem axle */}
      {[-0.55, 0.55].map((z, k) =>
        [-1, 1].map((s, j) => (
          <group key={`${z}${s}`} position={[s * 1.05, 0.46, z]}>
            <group ref={(g) => (wheels.current[k * 2 + j] = g!)}>
              <Cyl r={0.46} l={0.32} axis="x" seg={28} m={M.rubber} />
              <Cyl r={0.26} l={0.33} axis="x" m={M.rim} />
            </group>
          </group>
        )),
      )}
      {/* chassis and drawbar */}
      <Box s={[1.2, 0.18, 4.6]} m={M.grey} position={[0, 0.82, 0.6]} />
      <group ref={drawbar} position={[0, 0.7, 2.9]}>
        <Box s={[0.12, 0.12, L - 2.8]} m={M.grey} position={[0, 0, (L - 2.9) / 2]} />
      </group>
      {/* tipping body, hinged at its rear edge */}
      <group position={[0, 0.92, -1.6]}>
        <group ref={body}>
          <group position={[0, 0, 2.05]}>
            <Box s={[2.1, 0.08, 4.2]} m={M.green} position={[0, 0.04, 0]} />
            {[-1, 1].map((s) => (
              <Box key={s} s={[0.06, 1.0, 4.2]} m={M.green} position={[s * 1.05, 0.5, 0]} />
            ))}
            <Box s={[2.1, 1.0, 0.06]} m={M.green} position={[0, 0.5, 2.1]} />
            <Box s={[2.1, 1.0, 0.06]} m={M.green} position={[0, 0.5, -2.1]} />
            {[-1.4, -0.7, 0, 0.7, 1.4].map((z) =>
              [-1, 1].map((s) => <Box key={`${z}${s}`} s={[0.03, 1.0, 0.06]} m={M.grey} position={[s * 1.09, 0.5, z]} />),
            )}
            <instancedMesh ref={load} args={[bunchGeometry, bunchMaterial, BUNCH_SLOTS]} castShadow frustumCulled={false} />
          </group>
        </group>
      </group>
      {/* tipping ram */}
      <Cyl r={0.06} l={0.9} m={M.steel} position={[0, 1.2, 1.9]} rotation={[0.4, 0, 0]} />
      {/* grab crane on a column at the front of the body */}
      <group position={[0.55, 1.0, 2.75]}>
        <Cyl r={0.16} l={0.5} m={M.yellow} position={[0, 0.25, 0]} />
        <group ref={slew} position={[0, 0.5, 0]}>
          <Cyl r={0.1} l={1.3} m={M.yellow} position={[0, 0.65, 0]} />
          <group ref={boom} position={[0, 1.3, 0]}>
            <Box s={[0.14, 0.18, 3.0]} m={M.yellow} position={[0, 0, 1.5]} />
            <Cyl r={0.04} l={1.6} axis="z" m={M.steel} position={[0, -0.16, 0.9]} />
            <group ref={stick} position={[0, 0, 3.0]}>
              <Box s={[0.12, 0.15, 2.6]} m={M.yellow} position={[0, 0, 1.3]} />
              <group ref={grapple} position={[0, 0, 2.6]}>
                <Cyl r={0.06} l={0.25} m={M.grey} position={[0, -0.15, 0]} />
                {[0, 1].map((i) => (
                  <group key={i} ref={(g) => (tines.current[i] = g!)} position={[i === 0 ? 0.08 : -0.08, -0.3, 0]}>
                    <Pipe pts={[[0, 0, 0], [i === 0 ? 0.15 : -0.15, -0.25, 0], [i === 0 ? 0.08 : -0.08, -0.5, 0]]} r={0.025} m={M.grey} />
                  </group>
                ))}
                <instancedMesh
                  ref={(m) => {
                    carried.current = m;
                    if (m) initCarried(m);
                  }}
                  args={[bunchGeometry, bunchMaterial, 4]}
                  position={[0, -0.5, 0]}
                  frustumCulled={false}
                />
              </group>
            </group>
          </group>
          <Box s={[0.6, 0.06, 0.5]} m={M.grey} position={[0, 0.2, -0.3]} />
        </group>
      </group>
    </group>
  );
}

/** Place the grapple's bunches once (they move with the grapple). */
export function initCarried(mesh: THREE.InstancedMesh) {
  const m = new THREE.Matrix4();
  for (let i = 0; i < 4; i++) mesh.setMatrixAt(i, m.makeTranslation((i % 2) * 0.3 - 0.15, 0, Math.floor(i / 2) * 0.3 - 0.15));
}
