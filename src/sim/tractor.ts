// MF 5M.145 driveline and vehicle dynamics. Pure logic: the scene, sound and dashboard read this state.
// Engine: AGCO Power 4.4 L, 145 hp at 2000 rpm, 560 Nm at 1500 rpm. Transmission: 12x12 synchro, 4 gears × 3 ranges,
// power shuttle. Two-mode traction: wheels roll with the engine until the tyres' grip limit, then they spin.
import { EMBED, hitsSolid } from '../embed';
import { GROUND, height, surface, type Surface } from './estate';

export const SPEC = {
  massKg: 4500,
  wheelbase: 2.62,
  rearR: 0.84, // 420/85 R38
  frontR: 0.68, // 380/85 R28
  rearTrack: 1.8,
  frontTrack: 1.85,
  idleRpm: 850,
  ratedRpm: 2200,
  maxRpm: 2330, // high idle, governor cut-off
  maxSteer: 0.85, // rad, ~49° for a 5 m turning circle
  fuelL: 198,
};

// Full-load torque curve (Nm) built from the brochure points: 560 Nm at 1500, 145 hp (507 Nm) at 2000, 140 hp at 2200.
const TORQUE: [number, number][] = [
  [600, 250],
  [900, 400],
  [1200, 520],
  [1500, 560],
  [1800, 545],
  [2000, 507],
  [2200, 447],
  [2330, 0],
];
export function maxTorque(rpm: number) {
  if (rpm <= TORQUE[0][0]) return TORQUE[0][1] * Math.max(0, rpm / TORQUE[0][0]);
  for (let i = 1; i < TORQUE.length; i++) {
    const [r0, t0] = TORQUE[i - 1];
    const [r1, t1] = TORQUE[i];
    if (rpm <= r1) return t0 + ((t1 - t0) * (rpm - r0)) / (r1 - r0);
  }
  return 0;
}

// Road speed (km/h) in each gear at 2000 rpm. Spread typical of a 40 km/h 12x12 synchro; exact factory ratios unpublished.
export const GEAR_KMH = [
  [2.2, 2.9, 3.8, 5.0], // L
  [5.9, 7.8, 10.2, 13.4], // M
  [16.0, 21.0, 27.5, 36.0], // H
];
export const RANGES = ['L', 'M', 'H'] as const;
const W2000 = (2000 * 2 * Math.PI) / 60;
/** Engine rad/s per wheel rad/s. */
export const ratioOf = (range: number, gear: number) => (W2000 * SPEC.rearR) / (GEAR_KMH[range][gear] / 3.6);

export type Shuttle = 'F' | 'N' | 'R';
export type EngineState = 'off' | 'starting' | 'running' | 'stopping';

export interface Tractor {
  // pose
  x: number;
  z: number;
  y: number;
  heading: number; // 0 = facing +z
  pitch: number;
  roll: number;
  // motion
  v: number; // m/s along heading (negative backwards)
  steer: number; // rad, + = left
  wheelSpin: number; // rear wheel surface speed − ground speed (m/s), >0 spinning
  rearAngle: number; // wheel rotation for drawing
  frontAngle: number;
  // driver inputs
  steerInput: number; // −1..1
  pedal: number; // foot throttle 0..1
  hand: number; // hand throttle 0..1
  brake: number; // 0..1
  shuttle: Shuttle;
  range: number; // 0 L, 1 M, 2 H
  gear: number; // 0..3
  fourWd: boolean;
  diffLock: boolean;
  pto: boolean;
  ptoEco: boolean;
  hitchUp: boolean;
  hitch: number; // 0 lowered .. 1 raised
  // engine
  engine: EngineState;
  starterT: number;
  rpm: number;
  load: number; // 0..1 share of available torque in use
  clutch: number; // 0 open .. 1 engaged (auto-clutch during shifts)
  shiftT: number;
  fuel: number;
  hours: number;
  coolant: number;
  // extra loads from implements
  extraMass: number; // mounted on the tractor (3-point implement): adds weight on the rear tyres
  towedMass: number; // trailer behind: adds inertia and rolling resistance, little grip
  ptoTorque: number; // Nm at the engine
  draft: number; // N pulling back
  ground: Surface;
  stalled: boolean;
  events: string[];
}

export function create(): Tractor {
  return {
    x: 0.6,
    z: -96,
    y: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
    v: 0,
    steer: 0,
    wheelSpin: 0,
    rearAngle: 0,
    frontAngle: 0,
    steerInput: 0,
    pedal: 0,
    hand: 0,
    brake: 0,
    shuttle: 'N',
    range: 1,
    gear: 1,
    fourWd: true,
    diffLock: false,
    pto: false,
    ptoEco: false,
    hitchUp: true,
    hitch: 1,
    engine: 'off',
    starterT: 0,
    rpm: 0,
    load: 0,
    clutch: 1,
    shiftT: 0,
    fuel: 150,
    hours: 412.6,
    coolant: 40,
    extraMass: 0,
    towedMass: 0,
    ptoTorque: 0,
    draft: 0,
    ground: 'road',
    stalled: false,
    events: [],
  };
}

// ---------- driver actions ----------

export function startEngine(t: Tractor) {
  if (t.engine !== 'off' || t.fuel <= 0) return;
  // Safety start switch: the shuttle must be in neutral.
  if (t.shuttle !== 'N') {
    t.events.push('needNeutral');
    return;
  }
  t.engine = 'starting';
  t.starterT = 0;
  t.stalled = false;
  t.events.push('start');
}

export function stopEngine(t: Tractor) {
  if (t.engine === 'off' || t.engine === 'stopping') return;
  t.engine = 'stopping';
  t.events.push('stop');
}

export function setShuttle(t: Tractor, s: Shuttle) {
  if (t.shuttle === s) return;
  t.shuttle = s;
  t.clutch = s === 'N' ? 1 : 0; // power shuttle: wet clutch packs re-engage smoothly
  t.events.push('shuttle');
}

export function shift(t: Tractor, range: number, gear: number) {
  range = Math.max(0, Math.min(2, range));
  gear = Math.max(0, Math.min(3, gear));
  if (range === t.range && gear === t.gear) return;
  // Range changes on a synchro box are made at (near) standstill.
  if (range !== t.range && Math.abs(t.v) > 1.2) {
    t.events.push('rangeRefused');
    return;
  }
  t.range = range;
  t.gear = gear;
  t.clutch = 0; // clutch dipped for the shift
  t.shiftT = 0.35;
  t.events.push('shift');
}

// ---------- step ----------

const G = 9.81;
const I_ENGINE = 2.2; // kg·m² engine + flywheel
const ETA = 0.88; // driveline efficiency

export function step(t: Tractor, dt: number) {
  t.ground = surface(t.x, t.z);
  const g = GROUND[t.ground];
  const mass = SPEC.massKg + t.extraMass + t.towedMass;
  const onTyres = SPEC.massKg + t.extraMass + 0.15 * t.towedMass; // trailer only adds its drawbar load

  // Engine start / stop.
  if (t.engine === 'starting') {
    t.starterT += dt;
    t.rpm = Math.min(t.rpm + 400 * dt, 180);
    if (t.starterT > 1.1) {
      t.engine = 'running';
      t.rpm = 720; // fires and flares up toward idle
      t.events.push('running');
    }
  }
  const running = t.engine === 'running';

  // Hitch moves on the linkage's hydraulics (~3 s full stroke) only with the engine running.
  const hitchTarget = t.hitchUp ? 1 : 0;
  if (running && Math.abs(t.hitch - hitchTarget) > 0.001) t.hitch += Math.sign(hitchTarget - t.hitch) * Math.min(Math.abs(hitchTarget - t.hitch), dt / 3);

  // Steering: hydrostatic, rate limited; less lock at speed for stability.
  const lock = SPEC.maxSteer * (1 - Math.min(0.6, Math.abs(t.v) / 14));
  const target = t.steerInput * lock;
  t.steer += Math.sign(target - t.steer) * Math.min(Math.abs(target - t.steer), dt * (running ? 1.4 : 0.3));

  // Engine governor: throttle sets the target speed between idle and high idle; torque is limited by the curve.
  const throttle = Math.max(t.hand, t.pedal);
  const target_rpm = running ? SPEC.idleRpm + throttle * (SPEC.maxRpm - SPEC.idleRpm) : 0;
  const w = (t.rpm * 2 * Math.PI) / 60;
  const tMax = running ? maxTorque(t.rpm) : 0;
  const govern = running ? Math.max(0, Math.min(1, (target_rpm - t.rpm) / 60 + 0.5)) : 0;
  const tEngine = tMax * govern;
  const friction = 25 + 0.03 * t.rpm;

  // PTO: 540 at 2000 engine rpm, 540E at 1550.
  const ptoLoad = t.pto && running ? t.ptoTorque : 0;

  const sign = t.shuttle === 'F' ? 1 : t.shuttle === 'R' ? -1 : 0;
  const ratio = ratioOf(t.range, t.gear) * (t.shuttle === 'R' ? 0.95 : 1);
  const r = SPEC.rearR;
  // Resistances along the direction of travel.
  const slope = t.pitch; // + nose up
  const fRoll = g.crr * mass * G * Math.cos(slope) * Math.sign(t.v) * Math.min(1, Math.abs(t.v) / 0.2);
  const fGrade = mass * G * Math.sin(slope);
  const fDraft = t.draft * Math.sign(t.v || 1) * Math.min(1, Math.abs(t.v) / 0.3);
  const fBrake = t.brake * 0.65 * onTyres * G;
  // Usable grip: 4WD uses all the weight, 2WD ~65% on the rear axle; diff lock helps where one side slips.
  const grip = g.mu * onTyres * G * (t.fourWd ? 1 : 0.65) * (t.diffLock ? 1.15 : 1);

  // Clutch re-engagement after a shift or shuttle change.
  if (t.shiftT > 0) t.shiftT -= dt;
  else if (t.clutch < 1) t.clutch = Math.min(1, t.clutch + dt / 0.5);

  let wNew = w;
  let vNew = t.v;
  let spin = 0;
  let used = 0;
  if (sign === 0 || t.clutch < 0.05 || t.engine === 'off') {
    // Disengaged: engine free-revs, tractor coasts.
    wNew = w + ((tEngine - friction - ptoLoad) / I_ENGINE) * dt;
    const fRes = fRoll + fGrade;
    let a = -fRes / mass;
    // brakes oppose motion up to standstill
    if (Math.abs(t.v) > 0.01) a -= (Math.sign(t.v) * fBrake) / mass;
    else if (fBrake > Math.abs(fGrade)) a = -t.v / dt;
    vNew = t.v + a * dt;
    if (Math.sign(vNew) !== Math.sign(t.v) && t.v !== 0 && fBrake > 0) vNew = 0;
  } else {
    const wWheelFromV = (t.v / r) * sign; // wheel speed implied by ground speed, in the engaged direction
    const slipClutch = w - wWheelFromV * ratio;
    if (t.clutch < 1 && Math.abs(slipClutch) > 4) {
      // Clutch slipping: it passes a torque that grows as it engages.
      const tc = Math.sign(slipClutch) * t.clutch * 900;
      wNew = w + ((tEngine - friction - ptoLoad - tc) / I_ENGINE) * dt;
      let f = (tc * ratio * ETA) / r;
      f = Math.max(-grip, Math.min(grip, f));
      const fRes = fRoll + fGrade + fDraft + Math.sign(t.v) * fBrake;
      vNew = t.v + ((sign * f - fRes) / (mass * 1.08)) * dt;
      used = Math.abs(tc) / Math.max(1, tMax);
    } else {
      // Locked: engine and wheels turn together. Solve the combined inertia, then check the grip limit.
      const fRes = fRoll + fGrade + fDraft + Math.sign(t.v || sign) * fBrake;
      const J = I_ENGINE + (mass * 1.08 * r * r) / (ratio * ratio);
      const tLoad = (sign * fRes * r) / (ratio * ETA);
      const dw = ((tEngine - friction - ptoLoad - tLoad) / J) * dt;
      wNew = Math.max(0, w + dw);
      const vLocked = ((wNew / ratio) * r) * sign;
      const aNeeded = (vLocked - t.v) / dt;
      const fDrive = mass * 1.08 * aNeeded + fRes;
      if (Math.abs(fDrive) > grip && t.engine === 'running') {
        // Wheels break loose: the ground only gives `grip`; the engine spins the wheels faster than the tractor moves.
        const fGround = Math.sign(fDrive) * grip;
        vNew = t.v + ((fGround - fRes) / (mass * 1.08)) * dt;
        const tWheelSide = (grip * r) / (ratio * ETA);
        wNew = Math.max(0, w + ((tEngine - friction - ptoLoad - tWheelSide) / (I_ENGINE + 60 / (ratio * ratio))) * dt);
        spin = (wNew / ratio) * r - Math.abs(vNew);
      } else vNew = vLocked;
      used = (Math.abs(tLoad) + ptoLoad + friction) / Math.max(1, tMax);
    }
  }

  // Stall: lugged below ~500 rpm with the drive engaged.
  const rpmNew = (wNew * 60) / (2 * Math.PI);
  if (running && rpmNew < 480 && sign !== 0 && t.clutch > 0.9) {
    t.engine = 'off';
    t.stalled = true;
    t.events.push('stall');
  }
  if (t.engine === 'stopping' || t.engine === 'off') {
    t.rpm = Math.max(0, t.rpm - dt * (t.rpm > 300 ? 700 : 400));
    if (t.rpm <= 0 && t.engine === 'stopping') t.engine = 'off';
    if (sign !== 0 && t.clutch > 0.5) vNew = t.v * (1 - dt * 3); // engine braking to a stop
  } else if (t.engine === 'running') t.rpm = Math.max(0, Math.min(SPEC.maxRpm + 30, rpmNew));
  t.v = vNew;
  t.wheelSpin = spin;
  t.load += (Math.min(1.2, used) - t.load) * Math.min(1, dt * 4);

  // Kinematic bicycle model for heading; slower when the front wheels lose grip in mud.
  const yawRate = (t.v * Math.tan(t.steer)) / SPEC.wheelbase * (t.ground === 'mud' ? 0.8 : 1);
  t.heading += yawRate * dt;
  t.x += Math.sin(t.heading) * t.v * dt;
  t.z += Math.cos(t.heading) * t.v * dt;
  // a solid of the Traknus World (its truck) stops the tractor
  if (EMBED.solids.length) {
    const mid = SPEC.wheelbase / 2;
    const box = { x: t.x + Math.sin(t.heading) * mid, z: t.z + Math.cos(t.heading) * mid, hx: 1.2, hz: 2.2, yaw: t.heading, y0: 0, y1: 3 };
    if (hitsSolid(box)) {
      t.x -= Math.sin(t.heading) * t.v * dt;
      t.z -= Math.cos(t.heading) * t.v * dt;
      t.v = 0;
    }
  }

  // Body follows the ground under the four wheels.
  const fx = Math.sin(t.heading);
  const fz = Math.cos(t.heading);
  const hRear = height(t.x, t.z);
  const hFront = height(t.x + fx * SPEC.wheelbase, t.z + fz * SPEC.wheelbase);
  const hL = height(t.x + fz * 0.9, t.z - fx * 0.9);
  const hR = height(t.x - fz * 0.9, t.z + fx * 0.9);
  t.pitch = Math.atan2(hFront - hRear, SPEC.wheelbase);
  t.roll = Math.atan2(hL - hR, 1.8);
  t.y = hRear;

  t.rearAngle += ((t.v + Math.sign(t.v || 1) * spin) / SPEC.rearR) * dt;
  t.frontAngle += (t.v / SPEC.frontR) * dt;

  // Fuel: ~230 g/kWh at work plus a small idle draw; engine hours.
  if (t.engine === 'running') {
    const kw = (tEngine * wNew) / 1000;
    t.fuel = Math.max(0, t.fuel - ((kw * 0.23) / 0.84 / 3600 + 1.6 / 3600) * dt);
    t.hours += dt / 3600;
    if (t.fuel <= 0) stopEngine(t);
  }
  t.coolant += ((running ? 82 + 8 * t.load : 35) - t.coolant) * Math.min(1, dt / (running ? 120 : 600));
}

/** Litres per hour right now, for the dashboard. */
export function fuelRate(t: Tractor) {
  if (t.engine !== 'running') return 0;
  const w = (t.rpm * 2 * Math.PI) / 60;
  const kw = (maxTorque(t.rpm) * Math.min(1, t.load) * w) / 1000;
  return (kw * 0.23) / 0.84 + 1.6;
}

export const kmh = (t: Tractor) => t.v * 3.6;
export const ptoRpm = (t: Tractor) => (t.pto ? (t.rpm * 540) / (t.ptoEco ? 1550 : 2000) : 0);
