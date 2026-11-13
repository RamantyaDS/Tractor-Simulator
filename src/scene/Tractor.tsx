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

function Hood() {
  // Side profile (z, y) of the bonnet, extruded across the width.
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(1.12, 1.0);
    s.lineTo(1.12, 1.9);
    s.bezierCurveTo(2.0, 1.9, 3.0, 1.86, 3.55, 1.74);
    s.bezierCurveTo(3.78, 1.68, 3.86, 1.5, 3.86, 1.3);
    s.lineTo(3.84, 1.0);
    s.lineTo(1.12, 1.0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.92, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3, curveSegments: 16 });
    g.rotateY(-Math.PI / 2);
    g.translate(0.46, 0, 0);
    return g;
  }, []);
  const grille = useCanvasTexture(256, 256, (g) => {
    g.fillStyle = '#0c0c0d';
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#2a2b2d';
    g.lineWidth = 3;
    for (let y = -256; y < 512; y += 18) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(256, y + 128);
      g.stroke();
      g.beginPath();
      g.moveTo(0, y + 128);
      g.lineTo(256, y);
      g.stroke();
    }
  });
  const grilleMat = useMemo(() => new THREE.MeshStandardMaterial({ map: grille, metalness: 0.5, roughness: 0.5 }), [grille]);
  return (
    <group>
      <mesh geometry={geo} material={M.red} castShadow receiveShadow />
      {/* grey side stripe with the name, as on the 5M bonnet */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh material={M.stripe} position={[s * 0.502, 1.66, 2.35]} rotation={[0, (s * Math.PI) / 2, 0]}>
            <planeGeometry args={[2.3, 0.2]} />
          </mesh>
          <Text position={[s * 0.506, 1.66, 2.35]} rotation={[0, (s * Math.PI) / 2, 0]} fontSize={0.1} color="#f2f2f2" anchorX="center" anchorY="middle">
            MASSEY FERGUSON
          </Text>
          {/* side air intake */}
          <mesh material={grilleMat} position={[s * 0.503, 1.32, 3.05]} rotation={[0, (s * Math.PI) / 2, 0]}>
            <planeGeometry args={[0.8, 0.3]} />
          </mesh>
          <Text position={[s * 0.506, 1.48, 1.55]} rotation={[0, (s * Math.PI) / 2, 0]} fontSize={0.07} color="#e6e6e6">
            5M.145
          </Text>
        </group>
      ))}
      {/* front grille, slim LED headlights and lower lamps */}
      <mesh material={grilleMat} position={[0, 1.33, 3.905]}>
        <planeGeometry args={[0.78, 0.55]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box s={[0.26, 0.05, 0.05]} m={M.lamp} position={[s * 0.3, 1.66, 3.72]} rotation={[0.25, 0, -s * 0.15]} />
          <Box s={[0.14, 0.08, 0.04]} m={M.lamp} position={[s * 0.33, 1.08, 3.86]} />
        </group>
      ))}
      {/* MF triple-triangle badge */}
      <mesh position={[0, 1.66, 3.79]} rotation={[-0.3, 0, Math.PI]}>
        <circleGeometry args={[0.07, 3]} />
        <meshStandardMaterial color="#d9d9d9" metalness={0.8} roughness={0.25} />
      </mesh>
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
      {/* door frames and handles */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box s={[0.03, 1.15, 0.03]} m={M.black} position={[s * 0.665, 2.04, 0.3]} />
          <Box s={[0.02, 0.03, 0.12]} m={M.chrome} position={[s * 0.68, 1.95, 0.22]} />
        </group>
      ))}
      {/* white roof with visor, work lights, beacon and antenna */}
      <Box s={[1.58, 0.12, 1.8]} r={0.04} m={M.white} position={[0, 2.69, 0.36]} />
      <Box s={[1.4, 0.05, 0.25]} m={M.black} position={[0, 2.62, 1.3]} rotation={[0.15, 0, 0]} />
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
          <Box s={[0.05, 0.32, 0.18]} r={0.02} m={M.black} position={[s * 1.1, 2.12, 1.2]} />
          <mesh position={[s * 1.1, 2.12, 1.11]}>
            <planeGeometry args={[0.15, 0.28]} />
            <meshStandardMaterial color="#9fb4c2" metalness={1} roughness={0.05} />
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
      <Box s={[0.7, 0.55, 0.22]} m={M.grey} position={[0, 0.9, 3.95]} />
      {Array.from({ length: 7 }, (_, i) => (
        <Box key={i} s={[0.09, 0.45, 0.3]} r={0.015} m={M.greyLight} position={[-0.3 + i * 0.1, 0.92, 4.2]} />
      ))}
      {/* front axle beam and diff */}
      <Box s={[SPEC.frontTrack - 0.35, 0.16, 0.2]} m={M.grey} position={[0, FR, WB]} />
      <Cyl r={0.17} l={0.3} axis="z" m={M.grey} position={[0, FR, WB]} />
      {/* fuel tank and steps on the left (+x), exhaust stack on the right A-pillar */}
      <Box s={[0.3, 0.5, 0.75]} r={0.06} m={M.black} position={[0.62, 1.05, 1.35]} />
      <Cyl r={0.06} l={0.06} m={M.black} position={[0.66, 1.33, 1.6]} />
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
          <Box s={[0.12, 0.08, 0.06]} m={M.amber} position={[s * 0.25, 0.25, RR + 0.08]} />
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
