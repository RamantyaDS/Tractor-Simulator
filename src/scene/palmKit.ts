// Oil palm parts shared by the estate and the Traknus World's palms (so the plantation looks the same from afar):
// leaflet fronds on a drooping golden-angle crown, a trunk with old frond bases, their materials.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function frondTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 64, 256);
  // leaflets angled off the midrib
  // oil palm leaflets: dark glossy olive-green, a little lighter towards the tips, gaps between them
  for (let y = 0; y < 256; y += 5) {
    const shade = 52 + Math.floor(Math.random() * 30) + (y < 80 ? 10 : 0);
    g.strokeStyle = `rgb(${22 + shade * 0.25},${shade + 22},${18 + shade * 0.1})`;
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(32, y);
    g.lineTo(2, y - 22);
    g.moveTo(32, y);
    g.lineTo(62, y - 22);
    g.stroke();
  }
  g.fillStyle = '#4e5a26';
  g.fillRect(30, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function trunkTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#5a4a36';
  g.fillRect(0, 0, 128, 256);
  // old frond bases in a diamond pattern
  for (let y = 0; y < 256; y += 24)
    for (let x = (y / 24) % 2 ? 16 : 0; x < 128; x += 32) {
      g.fillStyle = '#4a3c2b';
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 16, y + 12);
      g.lineTo(x, y + 24);
      g.lineTo(x - 16, y + 12);
      g.fill();
      g.fillStyle = '#6d5a42';
      g.fillRect(x - 6, y + 4, 12, 4);
    }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 3);
  return t;
}

/** An oil palm crown: N fronds of `segs` segments (fewer for distant stand-ins, the same look). */
export function crownGeometry(N = 28, segs = 14) {
  const fronds: THREE.BufferGeometry[] = [];
  for (let f = 0; f < N; f++) {
    const L = 4.2 + (f % 3) * 0.5;
    const elev = 0.9 - (f % 4) * 0.22; // younger fronds point up, older ones droop
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const x = t * L;
      const y = Math.sin(elev) * x - 0.35 * x * x * (0.6 + (f % 4) * 0.25) / L;
      const w = 0.75 * Math.sin(Math.PI * Math.min(1, t * 1.2 + 0.05)) + 0.05;
      pos.push(x, y + 0.1, -w, x, y, 0, x, y + 0.1, w);
      uv.push(0, t, 0.5, t, 1, t);
      if (i < segs) {
        const a = i * 3;
        idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.rotateY((f / N) * Math.PI * 2 * 2.618); // golden-angle spiral
    fronds.push(g);
  }
  const merged = mergeGeometries(fronds)!;
  // Normals point up so both faces of the thin fronds catch the sky light (no black undersides).
  const n = merged.attributes.normal ?? new THREE.BufferAttribute(new Float32Array(merged.attributes.position.count * 3), 3);
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  merged.setAttribute('normal', n);
  return merged;
}

let palmMats: { trunkMat: THREE.MeshStandardMaterial; crownMat: THREE.MeshStandardMaterial } | null = null;
/** Bark and frond materials, shared (also by the Traknus World's palms, so they look the same from afar). */
export function palmMaterials() {
  return (palmMats ??= {
    trunkMat: new THREE.MeshStandardMaterial({ map: trunkTexture(), roughness: 0.95 }),
    crownMat: new THREE.MeshStandardMaterial({ map: frondTexture(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8, envMapIntensity: 0.5, emissive: '#1d2a0c', emissiveIntensity: 0.25 }),
  });
}
/** Trunk height of a palm of size s (its crown sits on top, 0.2 m down). */
export const palmTrunkH = (s: number) => 3.6 * s;

