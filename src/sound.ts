// Tractor sound built from real recordings (Wikimedia Commons, see README):
// - John Deere 5820 (4.5 L turbo 4-cylinder, the closest recorded match to the MF 5M's 4.4 L AGCO Power):
//   an idle loop recorded at ~810 rpm and a raised-speed loop at ~1290 rpm, pitch-shifted to the engine speed and
//   cross-faded; its shutdown for engine stop
// - a Cummins diesel bus starting, for the starter and the engine catching
// - a Komatsu 941 harvester's hydraulic pump whine, for the crane, linkage and tipping ram
// On top: a synthesized combustion layer that gets louder with load, tyre/ground noise, PTO and implement sounds.
import { ENGINE_WORKLET } from './engineWorklet';
import { ptoRpm } from './sim/tractor';
import { tr, work } from './store';

const BASE = import.meta.env.BASE_URL + 'audio/';
let ctx: AudioContext | null = null;
let master: GainNode;
let enabled = true;
let N: Awaited<ReturnType<typeof build>> | null = null;

async function load(c: AudioContext, name: string) {
  const r = await fetch(BASE + name);
  return c.decodeAudioData(await r.arrayBuffer());
}

function noise(c: AudioContext) {
  const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function loop(c: AudioContext, buf: AudioBuffer, out: AudioNode) {
  const s = c.createBufferSource();
  s.buffer = buf;
  s.loop = true;
  const g = c.createGain();
  g.gain.value = 0;
  s.connect(g).connect(out);
  s.start();
  return { s, g };
}

async function build(c: AudioContext) {
  const [idleB, midB, startB, stopB, hydB] = await Promise.all(
    ['engine-idle-810rpm.wav', 'engine-mid-1290rpm.wav', 'engine-start.wav', 'engine-stop.wav', 'hydraulic-pump.wav'].map((n) => load(c, n)),
  );
  // Engine bus: load opens up the tone (lowpass) and adds a little grit.
  const engineBus = c.createGain();
  const tone = c.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 2500;
  const body = c.createBiquadFilter();
  body.type = 'lowshelf';
  body.frequency.value = 140;
  body.gain.value = 3;
  const shaper = c.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    const x = (i / 1023) * 2 - 1;
    curve[i] = Math.tanh(x * 1.6) / Math.tanh(1.6);
  }
  shaper.curve = curve;
  engineBus.connect(body).connect(tone).connect(shaper).connect(master);

  const idle = loop(c, idleB, engineBus);
  const mid = loop(c, midB, engineBus);

  // Synth combustion layer for load (same worklet as the genset, 4 cylinders).
  const url = URL.createObjectURL(new Blob([ENGINE_WORKLET], { type: 'application/javascript' }));
  await c.audioWorklet.addModule(url);
  const synth = new AudioWorkletNode(c, 'diesel-engine', { outputChannelCount: [1] });
  const synthG = c.createGain();
  synthG.gain.value = 0;
  const synthLp = c.createBiquadFilter();
  synthLp.type = 'lowpass';
  synthLp.frequency.value = 900;
  synth.connect(synthLp).connect(synthG).connect(engineBus);

  // Turbo whistle.
  const turbo = c.createOscillator();
  turbo.frequency.value = 3000;
  const turboG = c.createGain();
  turboG.gain.value = 0;
  turbo.connect(turboG).connect(master);
  turbo.start();

  // Hydraulic pump whine (crane, linkage, tipping).
  const hyd = loop(c, hydB, master);

  // Tyres on the ground: band-passed noise, rougher off-road; squelch in mud.
  const nb = noise(c);
  const tyre = c.createBufferSource();
  tyre.buffer = nb;
  tyre.loop = true;
  const tyreF = c.createBiquadFilter();
  tyreF.type = 'bandpass';
  tyreF.frequency.value = 500;
  tyreF.Q.value = 0.6;
  const tyreG = c.createGain();
  tyreG.gain.value = 0;
  tyre.connect(tyreF).connect(tyreG).connect(master);
  tyre.start();

  // PTO driveline and implement: gear whine plus blade/disc whoosh.
  const pto = c.createOscillator();
  pto.type = 'triangle';
  const ptoG = c.createGain();
  ptoG.gain.value = 0;
  pto.connect(ptoG).connect(master);
  pto.start();
  const blade = c.createBufferSource();
  blade.buffer = nb;
  blade.loop = true;
  const bladeF = c.createBiquadFilter();
  bladeF.type = 'bandpass';
  bladeF.frequency.value = 900;
  bladeF.Q.value = 1.2;
  const bladeAm = c.createGain();
  const bladeLfo = c.createOscillator();
  bladeLfo.frequency.value = 18;
  const bladeDepth = c.createGain();
  bladeDepth.gain.value = 0.5;
  bladeLfo.connect(bladeDepth).connect(bladeAm.gain);
  bladeAm.gain.value = 0.5;
  bladeLfo.start();
  const bladeG = c.createGain();
  bladeG.gain.value = 0;
  blade.connect(bladeF).connect(bladeAm).connect(bladeG).connect(master);
  blade.start();

  return { startB, stopB, nb, engineBus, tone, idle, mid, synth, synthG, turbo, turboG, hyd, tyreF, tyreG, pto, ptoG, bladeF, bladeG, bladeLfo };
}

/** Must be called from a user gesture. */
export async function initSound() {
  if (ctx) return ctx.resume();
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = enabled ? 0.9 : 0;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12;
  master.connect(comp).connect(ctx.destination);
  N = await build(ctx);
}

export function setSound(on: boolean) {
  enabled = on;
  if (ctx) master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.05);
}

function oneShot(buf: AudioBuffer, gain = 1, rate = 1) {
  if (!ctx) return;
  const s = ctx.createBufferSource();
  s.buffer = buf;
  s.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = gain;
  s.connect(g).connect(master);
  s.start();
}

function clunk(freq = 1600, gain = 0.4, len = 0.1) {
  if (!ctx || !N) return;
  const t = ctx.currentTime;
  const s = ctx.createBufferSource();
  s.buffer = N.nb;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  s.connect(f).connect(g).connect(master);
  s.start(t);
  s.stop(t + len + 0.05);
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(freq / 12, t);
  o.frequency.exponentialRampToValueAtTime(40, t + len * 1.5);
  const og = ctx.createGain();
  og.gain.setValueAtTime(gain, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + len * 1.5);
  o.connect(og).connect(master);
  o.start(t);
  o.stop(t + len * 2);
}

export function playEvent(e: string) {
  if (!N) return;
  if (e === 'start') oneShot(N.startB, 1);
  else if (e === 'stop' || e === 'stall') oneShot(N.stopB, 1);
  else if (e === 'shift') clunk(1200, 0.35, 0.09);
  else if (e === 'shuttle') clunk(800, 0.3, 0.12);
  else if (e === 'grab') clunk(500, 0.25, 0.15);
  else if (e === 'drop') clunk(260, 0.6, 0.25); // bunches thudding into the body
  else if (e === 'attach') clunk(1800, 0.45, 0.08);
}

/** Per-frame update; `distance` from the camera to the tractor, `inCab` for the muffled cab view. */
export function updateSound(distance: number, inCab: boolean) {
  if (!ctx || !N) return;
  const t = ctx.currentTime;
  const k = (p: AudioParam, v: number, tc = 0.05) => p.setTargetAtTime(v, t, tc);
  const near = Math.min(1, 10 / Math.max(4, distance));
  const running = tr.engine === 'running' || tr.engine === 'starting';
  const rpm = Math.max(1, tr.rpm);

  // Engine loops: pitch follows rpm, cross-fade between the idle and the raised-speed recording.
  const x = Math.max(0, Math.min(1, (rpm - 900) / 450));
  const on = tr.engine === 'running' ? 1 : 0;
  k(N.idle.s.playbackRate, Math.max(0.5, rpm / 810), 0.03);
  k(N.mid.s.playbackRate, Math.max(0.5, rpm / 1290), 0.03);
  k(N.idle.g.gain, on * (1 - x) * 0.9);
  k(N.mid.g.gain, on * x * (0.85 + 0.25 * tr.load));
  // In the cab the windows take off the top; outside, load opens the sound up.
  k(N.tone.frequency, inCab ? 900 + tr.load * 500 : 1800 + tr.load * 3500, 0.15);
  k(N.engineBus.gain, near * (inCab ? 0.7 : 1), 0.2);

  const p = N.synth.parameters;
  k(p.get('rpm')!, running ? rpm : 0, 0.02);
  k(p.get('load')!, tr.load, 0.2);
  p.get('firing')!.setValueAtTime(on, t);
  p.get('starter')!.setValueAtTime(0, t);
  k(p.get('cold')!, Math.max(0, Math.min(1, (60 - tr.coolant) / 30)), 1);
  k(N.synthG.gain, on * (0.08 + 0.55 * Math.min(1, tr.load)), 0.15);

  k(N.turbo.frequency, 2500 + 5000 * Math.min(1, rpm / 2200) * (0.4 + 0.6 * Math.min(1, tr.load)), 0.4);
  k(N.turboG.gain, on * near * (0.002 + 0.012 * tr.load) * (inCab ? 0.4 : 1), 0.3);

  // Hydraulics: crane moving, linkage moving or the body tipping.
  const c = work.crane;
  const hydActive = (work.kind === 'trailer' && (c.step !== 'idle' || work.tipping || (work.tip > 0 && work.tip < 1))) || (Math.abs(tr.hitch - (tr.hitchUp ? 1 : 0)) > 0.01);
  k(N.hyd.s.playbackRate, Math.max(0.6, rpm / 1500), 0.1);
  k(N.hyd.g.gain, on * (hydActive ? 0.55 : 0) * near, 0.12);

  // Tyres: louder with speed, rougher and lower in grass and mud.
  const sp = Math.abs(tr.v);
  const g = tr.ground;
  k(N.tyreF.frequency, g === 'mud' ? 220 : g === 'grass' ? 380 : g === 'pad' ? 900 : 650, 0.2);
  k(N.tyreG.gain, Math.min(0.25, sp * 0.035 + tr.wheelSpin * 0.05) * near * (inCab ? 0.5 : 1), 0.1);

  // PTO and implement.
  const pr = ptoRpm(tr);
  k(N.pto.frequency, Math.max(20, (pr / 60) * 21), 0.1);
  k(N.ptoG.gain, pr > 10 ? 0.01 * near : 0, 0.2);
  const cutting = work.kind === 'slasher' && pr > 10;
  const spreading = work.kind === 'spreader' && pr > 10;
  k(N.bladeF.frequency, cutting ? 700 + (tr.hitch < 0.15 ? 300 : 0) : 2200, 0.2);
  k(N.bladeLfo.frequency, Math.max(1, (pr / 60) * 2), 0.1);
  k(N.bladeG.gain, (cutting ? (tr.hitch < 0.15 && sp > 0.05 ? 0.22 : 0.1) : spreading ? 0.05 : 0) * near, 0.15);
}
