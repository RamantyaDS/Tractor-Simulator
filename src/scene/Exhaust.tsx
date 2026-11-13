// Exhaust from the stack on the right A-pillar: a black puff on start-up and when the engine is loaded hard
// (common rail keeps it short), light haze at idle, soot when lugging.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { onEvent, tr } from '../store';

const N = 300;
const vert = /* glsl */ `
  attribute float size; attribute float alpha; attribute float shade;
  uniform float scale;
  varying float vA; varying float vS;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * scale / -mv.z;
    gl_Position = projectionMatrix * mv;
    vA = alpha; vS = shade;
  }`;
const frag = /* glsl */ `
  varying float vA; varying float vS;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vA;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vec3(vS), a);
  }`;

const LOCAL = new THREE.Vector3(-0.74, 3.08, 1.16);

export function Exhaust() {
  const { geo, mat, parts } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    for (const [k, n] of [['position', 3], ['size', 1], ['alpha', 1], ['shade', 1]] as const) geo.setAttribute(k, new THREE.BufferAttribute(new Float32Array(N * n), n));
    const mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, uniforms: { scale: { value: 800 } } });
    const parts = Array.from({ length: N }, () => ({ p: new THREE.Vector3(0, -99, 0), v: new THREE.Vector3(), age: 9, life: 1, dark: 0, s: 0.1 }));
    return { geo, mat, parts };
  }, []);
  const soot = useRef(0);
  const acc = useRef(0);
  const next = useRef(0);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const at = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => onEvent((e) => e === 'running' && (soot.current = 1)), []);
  useFrame(({ camera, size }, raw) => {
    const dt = Math.min(raw, 0.05);
    mat.uniforms.scale.value = (size.height / 2) * (camera as THREE.PerspectiveCamera).projectionMatrix.elements[5];
    q.setFromEuler(new THREE.Euler(-tr.pitch, tr.heading, tr.roll, 'YXZ'));
    m.compose(new THREE.Vector3(tr.x, tr.y, tr.z), q, new THREE.Vector3(1, 1, 1));
    at.copy(LOCAL).applyMatrix4(m);
    soot.current = Math.max(0, soot.current - dt * 0.8);
    if (tr.engine === 'running') {
      const lug = Math.max(0, tr.load - 0.75) * 3;
      acc.current += (8 + 25 * tr.load + 40 * soot.current) * dt;
      while (acc.current > 1) {
        acc.current -= 1;
        const p = parts[next.current];
        next.current = (next.current + 1) % N;
        p.p.copy(at);
        p.v.set((Math.random() - 0.5) * 0.3, 2.5 + 3 * (tr.rpm / 2200), (Math.random() - 0.5) * 0.3);
        p.age = 0;
        p.life = 2 + Math.random() * 1.5;
        p.dark = Math.min(1, soot.current + lug);
        p.s = 0.15 + Math.random() * 0.1;
      }
    }
    const pos = geo.attributes.position.array as Float32Array;
    const sz = geo.attributes.size.array as Float32Array;
    const al = geo.attributes.alpha.array as Float32Array;
    const sh = geo.attributes.shade.array as Float32Array;
    parts.forEach((p, i) => {
      if (p.age < p.life) {
        p.age += dt;
        p.v.multiplyScalar(1 - dt * 1.5);
        p.v.y += dt * 0.4;
        p.v.x += dt * 0.5;
        p.p.addScaledVector(p.v, dt);
      }
      const t = Math.min(1, p.age / p.life);
      pos.set([p.p.x, p.p.y, p.p.z], i * 3);
      sz[i] = p.s * (1 + t * 7);
      al[i] = t >= 1 ? 0 : (1 - t) * (0.06 + 0.55 * p.dark);
      sh[i] = 0.6 - 0.5 * p.dark + t * 0.15;
    });
    for (const k of ['position', 'size', 'alpha', 'shade']) geo.attributes[k].needsUpdate = true;
  });
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}
