// AudioWorklet that synthesizes diesel combustion pulses cylinder by cylinder (used here as a load layer under the
// recorded engine loops). The genset version is a V16; this one fires 4 cylinders: one event every 180° of crank.
// A four-stroke V16 fires 16 times every two crank revolutions, i.e. one event every 45° of crank angle:
// 200 events/s at 1500 rpm, 20/s while cranking at 150 rpm. Each event is a short burst made of
//   - an exhaust "pop": a damped low resonance of the exhaust pipe,
//   - a combustion "bark": band-passed noise,
//   - diesel knock: a sharp high click, loudest at light load and when cold.
// Without combustion (cranking, run-down) each event is only a compression "huff".
// The starter motor is synthesized here too, so its pitch can sag on every compression stroke.
export const ENGINE_WORKLET = /* js */ `
class Biquad {
  constructor() { this.x1 = this.x2 = this.y1 = this.y2 = 0; this.set(1000, 1, 44100, 'bp'); }
  set(f, q, sr, type) {
    const w = 2 * Math.PI * f / sr, a = Math.sin(w) / (2 * q), c = Math.cos(w);
    let b0, b1, b2;
    if (type === 'bp') { b0 = a; b1 = 0; b2 = -a; }
    else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
    else { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
    const a0 = 1 + a;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = -2 * c / a0; this.a2 = (1 - a) / a0;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

class DieselEngine extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rpm', defaultValue: 0, minValue: 0, maxValue: 2500 },
      { name: 'load', defaultValue: 0, minValue: 0, maxValue: 1.5 },
      { name: 'firing', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'starter', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'cold', defaultValue: 0, minValue: 0, maxValue: 1 },
    ];
  }
  constructor() {
    super();
    this.theta = 0; // crank angle since last event
    this.cyl = 0;
    this.cylGain = Array.from({ length: 16 }, () => 0.85 + Math.random() * 0.3);
    this.cylTone = Array.from({ length: 16 }, () => 0.9 + Math.random() * 0.2);
    // active burst envelopes
    this.pop = 0; this.popPh = 0; this.popF = 90;
    this.bark = 0; this.knock = 0; this.huff = 0;
    this.barkF = new Biquad(); this.knockF = new Biquad(); this.huffF = new Biquad();
    this.rumbleF = new Biquad(); this.hissF = new Biquad(); this.stF = new Biquad();
    this.knockF.set(2600, 1.2, sampleRate, 'hp');
    this.huffF.set(260, 0.8, sampleRate, 'bp');
    this.rumbleF.set(90, 0.7, sampleRate, 'lp');
    this.hissF.set(1800, 0.6, sampleRate, 'bp');
    this.stF.set(3200, 0.9, sampleRate, 'bp');
    this.stPh = 0; this.stLoad = 0;
    this.dc = 0;
  }
  process(_, outputs, p) {
    const out = outputs[0][0];
    const rpm = p.rpm[0], load = Math.min(1.3, p.load[0]), firing = p.firing[0] > 0.5, starter = p.starter[0] > 0.5, cold = p.cold[0];
    const step = (rpm / 60) * 2 * Math.PI / sampleRate;
    const ev = Math.PI; // 4-cylinder four-stroke: 4 events per 720°
    const spin = Math.min(1, rpm / 1500);
    // Pop decay and bark band shift with speed and load; a loaded engine sounds deeper and harder.
    const popDecay = Math.exp(-1 / (sampleRate * (0.006 + 0.01 * (1 - spin) + 0.004 * load)));
    const barkDecay = Math.exp(-1 / (sampleRate * 0.004));
    const knockDecay = Math.exp(-1 / (sampleRate * 0.0018));
    const huffDecay = Math.exp(-1 / (sampleRate * 0.03));
    this.barkF.set(380 + 300 * spin + 250 * load, 1.4, sampleRate, 'bp');
    for (let i = 0; i < out.length; i++) {
      this.theta += step;
      if (this.theta >= ev) {
        this.theta -= ev;
        const c = this.cyl = (this.cyl + 1) % 4;
        const jitter = 0.88 + Math.random() * 0.24;
        if (firing) {
          // Catching on start: some cylinders misfire, the ones that fire bang harder.
          const catching = rpm < 550;
          if (!(catching && Math.random() < 0.3)) {
            const strength = this.cylGain[c] * jitter * (catching ? 1.15 : 1);
            this.pop = strength * (0.55 + 0.6 * load);
            this.popPh = 0;
            this.popF = (62 + 40 * spin + 18 * load) * this.cylTone[c];
            this.bark = strength * (0.35 + 0.55 * load);
            this.knock = strength * (0.25 + 0.35 * (1 - Math.min(1, load)) + 0.35 * cold);
          }
        } else if (rpm > 20) {
          this.huff = (0.25 + 0.4 * spin) * jitter;
          this.stLoad = 1; // compression stroke drags the starter
        }
      }
      const n1 = Math.random() * 2 - 1, n2 = Math.random() * 2 - 1, n3 = Math.random() * 2 - 1;
      let s = 0;
      // exhaust pop: damped sine with a little second harmonic
      if (this.pop > 1e-4) {
        this.popPh += 2 * Math.PI * this.popF / sampleRate;
        s += this.pop * (Math.sin(this.popPh) + 0.35 * Math.sin(2 * this.popPh + 0.6));
        this.pop *= popDecay;
      }
      if (this.bark > 1e-4) { s += this.bark * this.barkF.run(n1) * 3.2; this.bark *= barkDecay; } else this.barkF.run(0);
      if (this.knock > 1e-4) { s += this.knock * this.knockF.run(n2) * 0.9; this.knock *= knockDecay; } else this.knockF.run(0);
      if (this.huff > 1e-4) { s += this.huff * this.huffF.run(n3) * 2.2; this.huff *= huffDecay; } else this.huffF.run(0);
      // steady mechanical rumble and air rush
      s += this.rumbleF.run(n1) * (0.25 * spin + 0.25 * load * spin);
      s += this.hissF.run(n2) * 0.05 * spin * spin;
      // starter motor: geared whine whose pitch and level sag on each compression
      if (starter) {
        this.stLoad *= 0.9993;
        const f = 260 + rpm * 0.9 - 70 * this.stLoad;
        this.stPh += f / sampleRate;
        const saw = 2 * (this.stPh % 1) - 1;
        s += (0.1 * saw + 0.36 * this.stF.run(n3) + 0.05 * n3) * (0.7 + 0.3 * this.stLoad);
      }
      // grit: soft saturation, then remove DC
      s = Math.tanh(s * 1.6) * 0.5;
      this.dc += (s - this.dc) * 0.0005;
      out[i] = s - this.dc;
    }
    return true;
  }
}
registerProcessor('diesel-engine', DieselEngine);
`;
