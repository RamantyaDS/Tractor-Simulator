// Procedural MF 5M.145 with cab, after the brochure photos: red hood with grey side stripe and slim LED lights, black
// grille, front weight frame, 4-post cab with white roof, beacon and work lights, exhaust stack on the right A-pillar,
// fuel tank and steps on the left, wide rear fenders, 3-point linkage, PTO and drawbar.
// Local frame: forward +z, up +y, right −x. Origin on the ground under the rear axle.
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { SPEC } from '../sim/tractor';
import { tr, work } from '../store';
import { Box, Cyl, M, Pipe, useCanvasTexture } from './parts';
import { Slasher, Spreader } from './Implements';

const RR = SPEC.rearR;
const FR = SPEC.frontR;
const WB = SPEC.wheelbase;

/** Agricultural tyre with chevron lugs and a dished rim. Axis along x. */
export function Wheel({ r, width, rim, lugs, side }: { r: number; width: number; rim: number; lugs: number; side: 1 | -1 }) {
  const lugGeo = useMemo(() => new THREE.BoxGeometry(width * 0.5, 0.07, 0.11), [width]);
  return (
    <group>
      {/* casing and sidewalls */}
      <Cyl r={r - 0.05} l={width} axis="x" seg={40} m={M.rubber} open />
      {/* sidewalls from the rim out to the tread */}
      {[-1, 1].map((s) => (
        <mesh key={`sw${s}`} material={M.rubber} position={[(s * width) / 2, 0, 0]} rotation={[0, (s * Math.PI) / 2, 0]}>
          <ringGeometry args={[rim, r - 0.1, 40]} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} material={M.rubber} position={[(s * width) / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[r - 0.12, 0.07, 10, 40]} />
        </mesh>
      ))}
      {/* chevron lugs, staggered left and right */}
      {Array.from({ length: lugs }, (_, i) => {
        const a = (i / lugs) * Math.PI * 2;
        return [-1, 1].map((s) => (
          <mesh
            key={`${i}${s}`}
            geometry={lugGeo}
            material={M.rubber}
            position={[s * width * 0.24, Math.cos(a + (s > 0 ? 0 : Math.PI / lugs)) * (r - 0.02), Math.sin(a + (s > 0 ? 0 : Math.PI / lugs)) * (r - 0.02)]}
            rotation={[-(a + (s > 0 ? 0 : Math.PI / lugs)), s * 0.5, 0]}
            castShadow
          />
        ));
      })}
      {/* rim: disc dished outward with a hub and bolts */}
      <Cyl r={rim} l={width * 0.9} axis="x" seg={32} m={M.rim} open />
      <mesh material={M.rim} position={[side * width * 0.18, 0, 0]} rotation={[0, (side * Math.PI) / 2, 0]}>
        <circleGeometry args={[rim, 32]} />
      </mesh>
      <Cyl r={rim * 0.35} l={0.12} axis="x" m={M.greyLight} position={[side * width * 0.24, 0, 0]} />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return <Cyl key={i} r={0.018} l={0.04} axis="x" m={M.steel} position={[side * width * 0.3, Math.cos(a) * rim * 0.25, Math.sin(a) * rim * 0.25]} />;
      })}
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        return (
          <mesh key={i} material={M.grey} position={[side * width * 0.19, Math.cos(a) * rim * 0.62, Math.sin(a) * rim * 0.62]} rotation={[0, (side * Math.PI) / 2, 0]}>
            <circleGeometry args={[rim * 0.13, 16]} />
          </mesh>
        );
      })}
    </group>
  );
}

function Spinning({ get, children }: { get: () => number; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => (ref.current!.rotation.x = get()));
  return <group ref={ref}>{children}</group>;
}

function Steered({ children, position }: { children: ReactNode; position: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => (ref.current!.rotation.y = tr.steer));
  return (
    <group ref={ref} position={position}>
      {children}
    </group>
  );
}

function honeycomb() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0a0a0b';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#2e3033';
  g.lineWidth = 2;
  for (let y = 0; y < 140; y += 12)
    for (let x = (y / 12) % 2 ? 7 : 0; x < 140; x += 14) {
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
        g[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * 6, y + Math.sin(a) * 6);
      }
      g.closePath();
      g.stroke();
    }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function Hood() {
  // Bonnet: side profile (z, y) extruded across the width, then narrowed toward the nose as on the 5M.
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(1.12, 1.3);
    s.lineTo(1.12, 1.9);
    s.bezierCurveTo(2.0, 1.92, 3.0, 1.88, 3.5, 1.8);
    s.bezierCurveTo(3.75, 1.76, 3.9, 1.7, 3.9, 1.6);
    s.lineTo(3.9, 1.3);
    s.lineTo(1.12, 1.3);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.84, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.07, bevelSegments: 5, curveSegments: 20 });
    g.rotateY(-Math.PI / 2);
    g.translate(0.42, 0, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i);
      if (z > 2.6) p.setX(i, p.getX(i) * (1 - 0.14 * Math.min(1, (z - 2.6) / 1.3)));
    }
    g.computeVertexNormals();
    return g;
  }, []);
  const grilleMat = useMemo(() => new THREE.MeshStandardMaterial({ map: honeycomb(), metalness: 0.5, roughness: 0.45 }), []);
  const ventMat = useMemo(() => {
    const t = honeycomb();
    t.repeat.set(8, 1.5);
    return new THREE.MeshStandardMaterial({ map: t, metalness: 0.4, roughness: 0.5 });
  }, []);
  return (
    <group>
      <mesh geometry={geo} material={M.red} castShadow receiveShadow />
      {/* dark lower side panels with long vents under the red bonnet */}
      <Box s={[0.86, 0.36, 2.62]} r={0.03} m={M.black} position={[0, 1.13, 2.48]} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh material={ventMat} position={[s * 0.432, 1.14, 2.75]} rotation={[0, (s * Math.PI) / 2, 0]}>
            <planeGeometry args={[1.6, 0.22]} />
          </mesh>
          {/* grey band with the name along the bonnet side */}
          <mesh material={M.stripe} position={[s * 0.495, 1.58, 2.25]} rotation={[0, (s * Math.PI) / 2, 0]}>
            <planeGeometry args={[2.1, 0.16]} />
          </mesh>
          <Text position={[s * 0.5, 1.58, 2.25]} rotation={[0, (s * Math.PI) / 2, 0]} fontSize={0.085} color="#f2f2f2" anchorX="center" anchorY="middle">
            MASSEY FERGUSON
          </Text>
          <Text position={[s * 0.5, 1.42, 1.5]} rotation={[0, (s * Math.PI) / 2, 0]} fontSize={0.065} color="#e6e6e6">
            5M.145
          </Text>
          {/* slim LED headlight in each upper corner of the nose */}
          <group position={[s * 0.27, 1.6, 3.985]} rotation={[0, 0, -s * 0.12]}>
            <Box s={[0.2, 0.07, 0.03]} r={0.01} m={M.black} />
            <Box s={[0.17, 0.022, 0.012]} m={M.lamp} position={[0, 0.014, 0.016]} />
            <Box s={[0.14, 0.018, 0.012]} m={M.lamp} position={[0, -0.016, 0.016]} />
          </group>
        </group>
      ))}
      {/* black honeycomb grille on the nose (red surround) and the lower intake; MF badge above */}
      <mesh material={grilleMat} position={[0, 1.42, 3.99]}>
        <planeGeometry args={[0.42, 0.2]} />
      </mesh>
      <mesh material={grilleMat} position={[0, 1.13, 3.795]}>
        <planeGeometry args={[0.7, 0.3]} />
      </mesh>
      <group position={[0, 1.57, 3.99]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[(i - 1) * 0.045, i === 1 ? -0.02 : 0, 0.001]} rotation={[0, 0, Math.PI]}>
            <circleGeometry args={[0.035, 3]} />
            <meshStandardMaterial color="#e5e5e5" metalness={0.8} roughness={0.2} />
          </mesh>
        ))}
      </group>
      {/* exhaust after-treatment / air intake box under the bonnet, visible below the panels */}
      <Box s={[0.5, 0.25, 0.6]} r={0.03} m={M.grey} position={[0, 0.92, 3.2]} />
    </group>
  );
}

/** Pivoting front mudguards: they turn with the wheels but don't spin. */
function FrontFender({ side }: { side: 1 | -1 }) {
  return (
    <group>
      <mesh material={M.black} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[FR + 0.06, FR + 0.06, 0.44, 24, 1, true, Math.PI * 0.12, Math.PI * 0.62]} />
      </mesh>
      <Box s={[0.05, 0.05, 0.45]} m={M.grey} position={[-side * 0.25, FR * 0.55, 0.1]} rotation={[0.6, 0, 0]} />
    </group>
  );
}

function Cab() {
  const posts: [number, number][] = [
    [0.64, 1.12],
    [-0.64, 1.12],
    [0.64, -0.38],
    [-0.64, -0.38],
  ];
  return (
    <group>
      {/* floor / cab base */}
      <Box s={[1.36, 0.12, 1.56]} m={M.grey} position={[0, 1.42, 0.37]} />
      {/* four posts, front ones slightly raked */}
      {posts.map(([x, z]) => (
        <Box key={`${x}${z}`} s={[0.06, 1.22, 0.07]} m={M.black} position={[x, 2.05, z]} rotation={[z > 0 ? -0.05 : 0.03, 0, 0]} />
      ))}
      {/* glass all round (doors both sides, curved rear) */}
      <mesh material={M.glass} position={[0, 2.06, 1.14]} rotation={[-0.05, 0, 0]}>
        <planeGeometry args={[1.24, 1.2]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={M.glass} position={[s * 0.66, 2.06, 0.37]} rotation={[0, (s * Math.PI) / 2, 0]}>
          <planeGeometry args={[1.48, 1.2]} />
        </mesh>
      ))}
      <mesh material={M.glass} position={[0, 2.06, -0.4]}>
        <planeGeometry args={[1.24, 1.2]} />
      </mesh>
      {/* full-glass doors: rubber edges, hinge side, handle; handrail beside the left door */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box s={[0.03, 1.15, 0.03]} m={M.black} position={[s * 0.665, 2.04, 0.3]} />
          <Box s={[0.025, 0.025, 1.4]} m={M.black} position={[s * 0.665, 1.5, 0.37]} />
          <Box s={[0.025, 0.025, 1.4]} m={M.black} position={[s * 0.665, 2.62, 0.37]} />
          <Box s={[0.03, 0.035, 0.14]} m={M.chrome} position={[s * 0.68, 1.95, 0.22]} />
          {[0.95, -0.25].map((z) => (
            <Box key={z} s={[0.03, 0.08, 0.04]} m={M.grey} position={[s * 0.67, z > 0 ? 2.4 : 1.7, z]} />
          ))}
        </group>
      ))}
      <Cyl r={0.014} l={0.95} m={M.chrome} position={[0.72, 1.98, 1.02]} />
      <Cyl r={0.014} l={0.85} m={M.chrome} position={[0.72, 2.0, -0.32]} />
      {/* windscreen and rear wipers */}
      <Box s={[0.6, 0.012, 0.012]} m={M.black} position={[0.05, 1.62, 1.16]} rotation={[0, 0, 0.55]} />
      <Box s={[0.5, 0.012, 0.012]} m={M.black} position={[0, 2.3, -0.42]} rotation={[0, 0, -0.4]} />
      {/* white roof, slightly crowned, with a black lower trim and front visor; work lights, beacon, antenna */}
      <Box s={[1.6, 0.14, 1.82]} r={0.06} m={M.white} position={[0, 2.7, 0.36]} />
      <Box s={[1.5, 0.06, 1.72]} r={0.05} m={M.white} position={[0, 2.79, 0.36]} />
      <Box s={[1.62, 0.04, 1.84]} m={M.black} position={[0, 2.62, 0.36]} />
      <Box s={[1.4, 0.05, 0.25]} m={M.black} position={[0, 2.62, 1.3]} rotation={[0.15, 0, 0]} />
      <Box s={[0.5, 0.05, 0.35]} r={0.02} m={M.greyLight} position={[0, 2.84, 0.1]} />
      {[-0.55, -0.2, 0.2, 0.55].map((x) => (
        <Box key={x} s={[0.14, 0.08, 0.06]} m={M.lamp} position={[x, 2.66, 1.27]} />
      ))}
      {[-0.5, 0.5].map((x) => (
        <Box key={x} s={[0.14, 0.08, 0.06]} m={M.lamp} position={[x, 2.66, -0.55]} />
      ))}
      <Beacon />
      <Cyl r={0.008} l={0.45} m={M.black} position={[-0.6, 2.98, -0.2]} />
      {/* wide mirrors on arms in front of the cab */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Pipe pts={[[s * 0.66, 2.3, 1.05], [s * 0.95, 2.35, 1.15], [s * 1.08, 2.25, 1.2]]} r={0.015} m={M.black} />
          {/* split mirror: main glass above, wide-angle below */}
          <Box s={[0.05, 0.4, 0.2]} r={0.02} m={M.black} position={[s * 1.1, 2.1, 1.2]} />
          <mesh position={[s * 1.1, 2.17, 1.095]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[0.16, 0.22]} />
            <meshStandardMaterial color="#9fb4c2" metalness={1} roughness={0.05} />
          </mesh>
          <mesh position={[s * 1.1, 1.97, 1.095]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[0.16, 0.12]} />
            <meshStandardMaterial color="#8aa2b2" metalness={1} roughness={0.1} />
          </mesh>
        </group>
      ))}
      <CabInterior />
    </group>
  );
}

function Beacon() {
  const ref = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.emissiveIntensity = tr.engine === 'running' ? 1 + 2.5 * Math.max(0, Math.sin(clock.elapsedTime * 7)) : 0.1;
  });
  return (
    <group position={[0.62, 2.82, -0.42]}>
      <Cyl r={0.06} l={0.04} m={M.black} position={[0, -0.05, 0]} />
      <mesh>
        <cylinderGeometry args={[0.05, 0.06, 0.11, 16]} />
        <meshStandardMaterial ref={ref} color="#ffae1a" emissive="#ff8a00" transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

function CabInterior() {
  const wheel = useRef<THREE.Group>(null);
  useFrame(() => {
    if (wheel.current) wheel.current.rotation.z = -tr.steer * 3.2;
  });
  return (
    <group>
      {/* seat */}
      <Box s={[0.5, 0.12, 0.5]} r={0.04} m={M.seat} position={[0, 1.78, 0.05]} />
      <Box s={[0.5, 0.62, 0.12]} r={0.05} m={M.seat} position={[0, 2.12, -0.2]} rotation={[-0.15, 0, 0]} />
      <Box s={[0.2, 0.3, 0.3]} m={M.grey} position={[0, 1.6, 0.05]} />
      {/* right-hand console with gear lever, range lever, hand throttle and spool levers */}
      <Box s={[0.2, 0.18, 0.6]} r={0.03} m={M.grey} position={[-0.38, 1.85, 0.1]} />
      <Cyl r={0.012} l={0.28} m={M.black} position={[-0.36, 2.0, 0.28]} rotation={[0.2, 0, 0]} />
      <mesh position={[-0.36, 2.15, 0.31]}>
        <sphereGeometry args={[0.03, 12, 12]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <Cyl r={0.01} l={0.2} m={M.black} position={[-0.42, 1.98, 0.18]} />
      <Box s={[0.05, 0.04, 0.03]} m={M.orange} position={[-0.42, 2.08, 0.18]} />
      {[-0.44, -0.4, -0.36].map((x, i) => (
        <Cyl key={x} r={0.008} l={0.2} m={M.black} position={[x, 1.98, 0.0 - i * 0.04]} />
      ))}
      {/* steering column, dashboard pod and wheel */}
      <Box s={[0.3, 0.42, 0.24]} r={0.05} m={M.grey} position={[0, 1.68, 0.95]} />
      <Box s={[0.28, 0.1, 0.12]} r={0.03} m={M.black} position={[0, 1.94, 0.9]} rotation={[-0.6, 0, 0]} />
      <Cyl r={0.03} l={0.4} m={M.black} position={[0, 2.0, 0.78]} rotation={[0.7, 0, 0]} />
      <group position={[0, 2.12, 0.66]} rotation={[0.7, 0, 0]}>
        <group ref={wheel}>
          <mesh material={M.black}>
            <torusGeometry args={[0.2, 0.018, 8, 32]} />
          </mesh>
          {[0, 2.1, 4.2].map((a) => (
            <Box key={a} s={[0.02, 0.19, 0.015]} m={M.black} position={[Math.sin(a) * 0.095, Math.cos(a) * 0.095, 0]} rotation={[0, 0, -a]} />
          ))}
          <Cyl r={0.05} l={0.03} axis="z" m={M.redDark} />
        </group>
      </group>
      {/* shuttle lever left of the column */}
      <Cyl r={0.008} l={0.2} m={M.black} position={[0.2, 2.02, 0.8]} rotation={[0, 0, -0.9]} />
      {/* pedals */}
      {[-0.12, 0.08, 0.16].map((x) => (
        <Box key={x} s={[0.07, 0.12, 0.02]} m={M.black} position={[x, 1.55, 0.95]} rotation={[-0.5, 0, 0]} />
      ))}
      {/* right pillar switch panel */}
      <Box s={[0.08, 0.36, 0.1]} m={M.black} position={[-0.58, 2.1, 0.95]} />
    </group>
  );
}

/** Vertical lift rods from the lift arms down to the lower links, following the hitch. */
function LiftRods() {
  const rods = useRef<THREE.Mesh[]>([]);
  useFrame(() => {
    const a = -0.3 + tr.hitch * 0.75;
    const lowY = 0.55 + Math.sin(a) * 0.45;
    const armA = -0.2 - tr.hitch * 0.6;
    const topY = 1.15 - Math.sin(armA) * 0.5;
    rods.current.forEach((m) => {
      if (!m) return;
      m.position.y = (lowY + topY) / 2;
      m.scale.y = Math.max(0.2, topY - lowY);
    });
  });
  return (
    <group>
      {[-1, 1].map((s, i) => (
        <mesh key={s} ref={(m) => (rods.current[i] = m!)} material={M.grey} position={[s * 0.35, 0.8, -0.78]}>
          <boxGeometry args={[0.04, 1, 0.04]} />
        </mesh>
      ))}
    </group>
  );
}

/** Three-point linkage: lower links, lift arms with lift rods, top link; lifts with the hitch value. */
function Linkage() {
  const lower = useRef<THREE.Group[]>([]);
  const arms = useRef<THREE.Group[]>([]);
  useFrame(() => {
    const a = -0.3 + tr.hitch * 0.75;
    lower.current.forEach((g) => g && (g.rotation.x = -a));
    arms.current.forEach((g) => g && (g.rotation.x = -0.2 - tr.hitch * 0.6));
  });
  return (
    <group>
      {[-1, 1].map((s, i) => (
        <group key={s}>
          <group ref={(g) => (lower.current[i] = g!)} position={[s * 0.38, 0.55, -0.45]}>
            <Box s={[0.06, 0.08, 0.85]} m={M.grey} position={[0, 0, -0.42]} />
            <mesh material={M.grey} position={[0, 0, -0.86]} rotation={[0, Math.PI / 2, 0]}>
              <torusGeometry args={[0.05, 0.02, 8, 16]} />
            </mesh>
          </group>
          <group ref={(g) => (arms.current[i] = g!)} position={[s * 0.32, 1.15, -0.3]}>
            <Box s={[0.07, 0.07, 0.55]} m={M.grey} position={[0, 0, -0.27]} />
          </group>
        </group>
      ))}
      <Box s={[0.06, 0.06, 0.5]} m={M.yellow} position={[0, 1.0, -0.7]} rotation={[0.15, 0, 0]} />
      <LiftRods />
      {/* pick-up hitch hook under the PTO */}
      <Box s={[0.5, 0.12, 0.18]} m={M.grey} position={[0, 0.58, -0.5]} />
      <mesh material={M.steel} position={[0, 0.5, -0.62]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.06, 0.02, 8, 16, Math.PI * 1.4]} />
      </mesh>
      {/* PTO stub with shield, drawbar with pin */}
      <Cyl r={0.025} l={0.12} axis="z" m={M.steel} position={[0, 0.66, -0.62]} />
      <Box s={[0.26, 0.03, 0.14]} m={M.redDark} position={[0, 0.76, -0.6]} />
      <Box s={[0.12, 0.05, 0.75]} m={M.grey} position={[0, 0.46, -0.65]} />
      <Cyl r={0.025} l={0.16} m={M.steel} position={[0, 0.49, -0.95]} />
      {/* rear hydraulic couplers */}
      {[-0.18, -0.08, 0.08, 0.18].map((x) => (
        <Cyl key={x} r={0.018} l={0.06} axis="z" m={x > 0 ? M.red : M.blue} position={[x, 1.12, -0.48]} />
      ))}
    </group>
  );
}

function Body() {
  return (
    <group>
      {/* engine sump, gearbox and rear axle housing */}
      <Box s={[0.66, 0.5, 2.7]} r={0.04} m={M.grey} position={[0, 0.82, 2.25]} />
      <Box s={[0.78, 0.66, 1.5]} r={0.04} m={M.grey} position={[0, 0.88, 0.35]} />
      <Box s={[0.9, 0.55, 0.7]} r={0.05} m={M.grey} position={[0, RR, -0.05]} />
      <Cyl r={0.15} l={SPEC.rearTrack - 0.2} axis="x" m={M.grey} position={[0, RR, 0]} />
      {/* front weight frame with weights */}
      <Box s={[0.7, 0.4, 0.22]} m={M.grey} position={[0, 0.78, 3.9]} />
      {Array.from({ length: 7 }, (_, i) => (
        <Box key={i} s={[0.09, 0.38, 0.28]} r={0.015} m={M.greyLight} position={[-0.3 + i * 0.1, 0.76, 4.14]} />
      ))}
      <mesh material={M.steel} position={[0, 0.62, 4.3]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.05, 0.018, 8, 16]} />
      </mesh>
      {/* front axle: beam, centre diff, steering cylinder, drive shaft from the gearbox */}
      <Box s={[SPEC.frontTrack - 0.35, 0.16, 0.2]} m={M.grey} position={[0, FR, WB]} />
      <Cyl r={0.17} l={0.3} axis="z" m={M.grey} position={[0, FR, WB]} />
      <Cyl r={0.035} l={1.1} axis="x" m={M.steel} position={[0, FR + 0.05, WB - 0.18]} />
      <Cyl r={0.05} l={0.4} axis="x" m={M.black} position={[0.3, FR + 0.05, WB - 0.18]} />
      <Cyl r={0.04} l={1.7} axis="z" m={M.steel} position={[0, 0.55, WB / 2 + 0.3]} />
      {/* fuel tank and steps on the left (+x), exhaust stack on the right A-pillar */}
      <Box s={[0.3, 0.5, 0.75]} r={0.06} m={M.black} position={[0.62, 1.05, 1.35]} />
      <Cyl r={0.06} l={0.06} m={M.black} position={[0.66, 1.33, 1.6]} />
      {/* AdBlue-style blue cap and battery box under the steps */}
      <Cyl r={0.03} l={0.04} m={M.blue} position={[0.66, 1.33, 1.2]} />
      <Box s={[0.28, 0.22, 0.35]} r={0.02} m={M.black} position={[0.66, 0.38, 0.75]} />
      {[0.5, 0.82, 1.14].map((y, i) => (
        <Box key={y} s={[0.3, 0.035, 0.32]} m={M.black} position={[0.88 + (2 - i) * 0.03, y, 0.75]} />
      ))}
      <Box s={[0.035, 0.75, 0.035]} m={M.black} position={[1.04, 0.85, 0.6]} />
      <Box s={[0.035, 0.75, 0.035]} m={M.black} position={[1.0, 0.85, 0.92]} />
      <Cyl r={0.015} l={0.9} m={M.chrome} position={[0.7, 2.0, 1.17]} />
      <group position={[-0.74, 0, 1.2]}>
        <Cyl r={0.065} l={1.45} m={M.black} position={[0, 2.25, 0]} />
        <Cyl r={0.085} l={0.55} m={M.grey} position={[0, 1.95, 0]} />
        <mesh material={M.black} position={[0, 3.02, -0.02]} rotation={[0.5, 0, 0]}>
          <cylinderGeometry args={[0.065, 0.065, 0.14, 16, 1, true]} />
        </mesh>
      </group>
      {/* rear fenders with side lights */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (SPEC.rearTrack / 2 + 0.02), RR, 0]}>
          {/* arched fender over the top of the wheel, open at front and back like the 5M's */}
          <mesh material={M.red} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[RR + 0.08, RR + 0.08, 0.56, 32, 1, true, Math.PI * 0.22, Math.PI * 0.62]} />
          </mesh>
          <mesh material={M.red} position={[s * 0.28, 0, 0]} rotation={[0, (s * Math.PI) / 2, 0]}>
            <ringGeometry args={[RR - 0.02, RR + 0.08, 32, 1, Math.PI * 0.2, Math.PI * 0.6]} />
          </mesh>
          <Box s={[0.62, 0.04, 0.5]} m={M.black} position={[0, RR + 0.08, -0.7]} rotation={[-0.4, 0, 0]} />
          {/* indicator at the front of the fender; rear cluster (tail, brake, indicator) and work light at the back */}
          <Box s={[0.12, 0.08, 0.06]} m={M.amber} position={[s * 0.25, 0.25, RR + 0.08]} />
          <group position={[s * 0.2, 0.42, -RR + 0.02]}>
            <Box s={[0.22, 0.12, 0.05]} r={0.015} m={M.black} />
            <Box s={[0.08, 0.06, 0.02]} m={M.amber} position={[-s * 0.05, 0, -0.03]} />
            <mesh position={[s * 0.05, 0, -0.026]} rotation={[0, Math.PI, 0]}>
              <planeGeometry args={[0.08, 0.06]} />
              <meshStandardMaterial color="#c3141c" emissive="#7a0006" emissiveIntensity={0.6} />
            </mesh>
          </group>
          <Box s={[0.12, 0.08, 0.06]} m={M.lamp} position={[s * 0.25, 0.75, -0.75]} />
        </group>
      ))}
    </group>
  );
}

export function TractorModel() {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = group.current!;
    g.position.set(tr.x, tr.y, tr.z);
    // engine shake: a light shiver at idle, more when lugging
    const shake = tr.engine === 'running' ? 0.004 + tr.load * 0.004 : tr.engine === 'starting' ? 0.01 : 0;
    const t = performance.now() / 1000;
    g.rotation.set(-tr.pitch + Math.sin(t * 55) * shake * 0.3, tr.heading, tr.roll + Math.sin(t * 43) * shake * 0.4, 'YXZ');
  });
  return (
    <group ref={group}>
      <Body />
      <Hood />
      <Cab />
      <Linkage />
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (SPEC.rearTrack / 2), RR, 0]}>
          <Spinning get={() => tr.rearAngle}>
            <Wheel r={RR} width={0.42} rim={0.49} lugs={22} side={s as 1 | -1} />
          </Spinning>
        </group>
      ))}
      {[-1, 1].map((s) => (
        <Steered key={s} position={[s * (SPEC.frontTrack / 2), FR, WB]}>
          <FrontFender side={s as 1 | -1} />
          <Spinning get={() => tr.frontAngle}>
            <Wheel r={FR} width={0.38} rim={0.36} lugs={18} side={s as 1 | -1} />
          </Spinning>
        </Steered>
      ))}
      <ImplementMount />
    </group>
  );
}

/** 3-point implements ride on the linkage: they rise with the hitch. */
function ImplementMount() {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    ref.current!.position.y = tr.hitch * 0.55;
    ref.current!.visible = work.kind === 'slasher' || work.kind === 'spreader';
  });
  return (
    <group ref={ref}>
      <Slasher />
      <Spreader />
    </group>
  );
}
