import { OrbitControls, Sky } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitImpl } from 'three-stdlib';
import { applyHeld } from '../input';
import { playEvent, updateSound } from '../sound';
import { advance, onEvent, tr, useUI, work } from '../store';
import { Exhaust } from './Exhaust';
import { Trailer } from './Implements';
import { TractorModel } from './Tractor';
import { World } from './World';

// Cab view look-around (drag to look).
const look = { yaw: 0, pitch: -0.12 };

function Driver() {
  useEffect(() => onEvent(playEvent), []);
  useEffect(() => {
    const id = setInterval(() => useUI.getState().bump(), 120);
    return () => clearInterval(id);
  }, []);
  const camera = useThree((s) => s.camera);
  useFrame((_, dt) => {
    applyHeld(Math.min(dt, 0.05));
    advance(dt);
    const d = camera.position.distanceTo(new THREE.Vector3(tr.x, tr.y + 1.5, tr.z));
    updateSound(d, useUI.getState().cam === 'cab');
  });
  return null;
}

function SunFollow() {
  const light = useRef<THREE.DirectionalLight>(null);
  useFrame(() => {
    const l = light.current!;
    l.position.set(tr.x + 30, 60, tr.z + 20);
    l.target.position.set(tr.x, 0, tr.z);
    l.target.updateMatrixWorld();
  });
  return (
    <directionalLight
      ref={light}
      intensity={2.6}
      color="#fff3dc"
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-30}
      shadow-camera-right={30}
      shadow-camera-top={30}
      shadow-camera-bottom={-30}
      shadow-camera-far={150}
      shadow-bias={-0.0005}
    />
  );
}

function CameraRig() {
  const cam = useUI((s) => s.cam);
  const camera = useThree((s) => s.camera as THREE.PerspectiveCamera);
  const gl = useThree((s) => s.gl);
  const orbit = useRef<OrbitImpl>(null);
  const tmp = useMemo(() => ({ q: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), t: new THREE.Vector3(), last: new THREE.Vector3() }), []);

  // Drag to look around in the cab.
  useEffect(() => {
    if (cam !== 'cab') return;
    let down = false;
    const el = gl.domElement;
    const dn = () => (down = true);
    const up = () => (down = false);
    const mv = (e: PointerEvent) => {
      if (!down) return;
      look.yaw = Math.max(-2.6, Math.min(2.6, look.yaw - e.movementX * 0.004));
      look.pitch = Math.max(-0.8, Math.min(0.5, look.pitch - e.movementY * 0.004));
    };
    el.addEventListener('pointerdown', dn);
    addEventListener('pointerup', up);
    el.addEventListener('pointermove', mv);
    return () => {
      el.removeEventListener('pointerdown', dn);
      removeEventListener('pointerup', up);
      el.removeEventListener('pointermove', mv);
    };
  }, [cam, gl]);

  useEffect(() => {
    camera.fov = cam === 'cab' ? 70 : 50;
    camera.updateProjectionMatrix();
    tmp.last.set(tr.x, tr.y, tr.z);
  }, [cam, camera, tmp]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const fx = Math.sin(tr.heading);
    const fz = Math.cos(tr.heading);
    tmp.t.set(tr.x, tr.y, tr.z);
    if (cam === 'cab') {
      tmp.q.setFromEuler(tmp.e.set(-tr.pitch, tr.heading, tr.roll, 'YXZ'));
      tmp.v.set(0.02, 2.45, 0.12).applyQuaternion(tmp.q).add(tmp.t);
      camera.position.copy(tmp.v);
      camera.quaternion.copy(tmp.q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(look.pitch, look.yaw + Math.PI, 0, 'YXZ')));
      return;
    }
    if (cam === 'orbit') {
      // keep orbiting around the moving tractor
      const delta = tmp.v.copy(tmp.t).sub(tmp.last);
      camera.position.add(delta);
      orbit.current?.target.set(tr.x, tr.y + 1.3, tr.z);
      tmp.last.copy(tmp.t);
      return;
    }
    if (cam === 'show') {
      // slow turntable around the tractor
      const a = performance.now() / 6000;
      const r = work.kind === 'trailer' ? 13 : 8;
      camera.position.set(tr.x + Math.sin(a) * r, tr.y + 2.6, tr.z + Math.cos(a) * r);
      camera.lookAt(tr.x + fx * 1.2, tr.y + 1.3, tr.z + fz * 1.2);
      return;
    }
    const back = work.kind === 'trailer' ? 14 : 9;
    const want = cam === 'top' ? tmp.v.set(tr.x - fx * 8, tr.y + 38, tr.z - fz * 8) : tmp.v.set(tr.x - fx * back, tr.y + (work.kind === 'trailer' ? 6 : 4.5), tr.z - fz * back);
    camera.position.lerp(want, 1 - Math.exp(-dt * 3));
    camera.lookAt(tr.x + fx * 3, tr.y + 1.3, tr.z + fz * 3);
  });

  return cam === 'orbit' ? <OrbitControls ref={orbit} makeDefault enablePan={false} minDistance={4} maxDistance={40} maxPolarAngle={Math.PI * 0.48} target={[tr.x, tr.y + 1.3, tr.z]} /> : null;
}

export function Experience() {
  return (
    <Canvas shadows dpr={[1, 1.75]} camera={{ position: [6, 5, -106], fov: 50, near: 0.1, far: 400 }}>
      <color attach="background" args={['#cfe3f2']} />
      <fog attach="fog" args={['#c9dbe6', 45, 190]} />
      <Sky sunPosition={[60, 45, 30]} turbidity={6} rayleigh={1.2} mieCoefficient={0.006} />
      <hemisphereLight args={['#d8ecff', '#4a5a2a', 0.85]} />
      <SunFollow />
      <World />
      <TractorModel />
      <Trailer />
      <Exhaust />
      <CameraRig />
      <Driver />
    </Canvas>
  );
}
