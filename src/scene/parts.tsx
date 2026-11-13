// Small building blocks and shared materials for the procedural models. Units are metres.
import { RoundedBox } from '@react-three/drei';
import type { ThreeElements } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';

export const M = {
  red: new THREE.MeshStandardMaterial({ color: '#b5121b', metalness: 0.35, roughness: 0.32 }),
  redDark: new THREE.MeshStandardMaterial({ color: '#7d0c12', metalness: 0.3, roughness: 0.45 }),
  grey: new THREE.MeshStandardMaterial({ color: '#3a3d41', metalness: 0.45, roughness: 0.5 }),
  greyLight: new THREE.MeshStandardMaterial({ color: '#8d9297', metalness: 0.4, roughness: 0.45 }),
  stripe: new THREE.MeshStandardMaterial({ color: '#4b4f54', metalness: 0.5, roughness: 0.35 }),
  black: new THREE.MeshStandardMaterial({ color: '#151617', metalness: 0.2, roughness: 0.6 }),
  rubber: new THREE.MeshStandardMaterial({ color: '#1b1b1b', metalness: 0, roughness: 0.92 }),
  rim: new THREE.MeshStandardMaterial({ color: '#c9ccce', metalness: 0.55, roughness: 0.35 }),
  white: new THREE.MeshStandardMaterial({ color: '#eceeee', metalness: 0.15, roughness: 0.4 }),
  steel: new THREE.MeshStandardMaterial({ color: '#9aa0a5', metalness: 0.85, roughness: 0.3 }),
  chrome: new THREE.MeshStandardMaterial({ color: '#d7dadc', metalness: 1, roughness: 0.15 }),
  glass: new THREE.MeshStandardMaterial({ color: '#1d2b33', metalness: 0.9, roughness: 0.05, transparent: true, opacity: 0.35, depthWrite: false }),
  amber: new THREE.MeshStandardMaterial({ color: '#ffae1a', emissive: '#ff8a00', emissiveIntensity: 0.4 }),
  lamp: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 1.5 }),
  seat: new THREE.MeshStandardMaterial({ color: '#2a2c2f', metalness: 0, roughness: 0.85 }),
  yellow: new THREE.MeshStandardMaterial({ color: '#e8b923', metalness: 0.2, roughness: 0.5 }),
  orange: new THREE.MeshStandardMaterial({ color: '#c8521f', metalness: 0.3, roughness: 0.5 }),
  green: new THREE.MeshStandardMaterial({ color: '#3d6b3a', metalness: 0.3, roughness: 0.55 }),
  blue: new THREE.MeshStandardMaterial({ color: '#1f4e8c', metalness: 0.3, roughness: 0.5 }),
};

type V3 = [number, number, number];
type MeshProps = Omit<ThreeElements['mesh'], 'args'>;

export function Box({ s, r = 0, m, ...p }: MeshProps & { s: V3; r?: number; m: THREE.Material }) {
  if (r > 0)
    return <RoundedBox args={s} radius={r} smoothness={2} material={m} castShadow receiveShadow {...(p as object)} />;
  return (
    <mesh material={m} castShadow receiveShadow {...p}>
      <boxGeometry args={s} />
    </mesh>
  );
}

const ROT = { x: [0, 0, Math.PI / 2] as V3, y: [0, 0, 0] as V3, z: [Math.PI / 2, 0, 0] as V3 };

/** Cylinder along an axis. `r2` makes a cone. */
export function Cyl({
  r,
  r2,
  l,
  axis = 'y',
  seg = 24,
  m,
  open = false,
  ...p
}: MeshProps & { r: number; r2?: number; l: number; axis?: 'x' | 'y' | 'z'; seg?: number; m: THREE.Material; open?: boolean }) {
  return (
    <mesh material={m} rotation={ROT[axis]} castShadow receiveShadow {...p}>
      <cylinderGeometry args={[r2 ?? r, r, l, seg, 1, open]} />
    </mesh>
  );
}

/** A pipe or hose following points. */
export function Pipe({ pts, r, m, seg = 48 }: { pts: V3[]; r: number; m: THREE.Material; seg?: number }) {
  const geo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.2);
    return new THREE.TubeGeometry(curve, seg, r, 12, false);
  }, [pts, r, seg]);
  return <mesh geometry={geo} material={m} castShadow receiveShadow />;
}

/** Ring of bolts on a flange face (axis x). */
export function BoltRing({ r, n, m, ...p }: ThreeElements['group'] & { r: number; n: number; m: THREE.Material }) {
  return (
    <group {...p}>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        return <Cyl key={i} r={0.012} l={0.03} axis="x" seg={6} m={m} position={[0, Math.cos(a) * r, Math.sin(a) * r]} />;
      })}
    </group>
  );
}

/** Canvas texture helper: draws once with the given painter. */
export function useCanvasTexture(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    paint(c.getContext('2d')!);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    if (repeat) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(...repeat);
    }
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
