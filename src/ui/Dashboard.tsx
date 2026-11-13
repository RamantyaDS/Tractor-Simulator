import { GROUND } from '../sim/estate';
import { RANGES, SPEC, fuelRate, kmh, ptoRpm } from '../sim/tractor';
import { tr, useUI } from '../store';

/** Analog tachometer like the 5M's dash: 0–2500 rpm, needle, plus digital speed and gear. */
function Tach() {
  const a0 = -220;
  const a1 = 40;
  const ang = (r: number) => ((a0 + (a1 - a0) * Math.min(1, r / 2500)) * Math.PI) / 180;
  const pt = (r: number, rad: number) => [60 + Math.cos(ang(r)) * rad, 60 + Math.sin(ang(r)) * rad];
  const ticks = Array.from({ length: 26 }, (_, i) => i * 100);
  const [nx, ny] = pt(tr.rpm, 44);
  return (
    <svg viewBox="0 0 120 120" className="tach" aria-label={`Putaran mesin ${Math.round(tr.rpm)} rpm`}>
      <circle cx="60" cy="60" r="57" fill="#101215" stroke="#2c3036" strokeWidth="3" />
      {/* economy band (torque peak) and red line */}
      <path d={arc(1300, 1800, 50)} stroke="#2fb36b" strokeWidth="5" fill="none" />
      <path d={arc(2200, 2500, 50)} stroke="#e0533c" strokeWidth="5" fill="none" />
      {ticks.map((r) => {
        const [x1, y1] = pt(r, r % 500 ? 47 : 43);
        const [x2, y2] = pt(r, 52);
        return <line key={r} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#d8dde2" strokeWidth={r % 500 ? 1 : 2} />;
      })}
      {[0, 5, 10, 15, 20, 25].map((n) => {
        const [x, y] = pt(n * 100, 35);
        return (
          <text key={n} x={x} y={y + 3} fill="#d8dde2" fontSize="8" textAnchor="middle">
            {n}
          </text>
        );
      })}
      <text x="60" y="80" fill="#8b949c" fontSize="6" textAnchor="middle">
        ×100 rpm
      </text>
      <line x1="60" y1="60" x2={nx} y2={ny} stroke="#ff4433" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="60" cy="60" r="4" fill="#333" />
    </svg>
  );
  function arc(r0: number, r1: number, rad: number) {
    const [x0, y0] = pt(r0, rad);
    const [x1, y1] = pt(r1, rad);
    return `M ${x0} ${y0} A ${rad} ${rad} 0 0 1 ${x1} ${y1}`;
  }
}

function Lamp({ on, color, label }: { on: boolean; color: string; label: string }) {
  return (
    <span className={`lamp ${on ? 'on' : ''}`} style={{ ['--c' as string]: color }}>
      {label}
    </span>
  );
}

export function Dashboard() {
  useUI((s) => s.tick);
  const shuttle = tr.shuttle === 'F' ? 'MAJU' : tr.shuttle === 'R' ? 'MUNDUR' : 'NETRAL';
  return (
    <div className="dash" aria-label="Dashboard">
      <Tach />
      <div className="dash-mid">
        <div className="speed">
          <b>{Math.abs(kmh(tr)).toFixed(1)}</b> <span>km/jam</span>
        </div>
        <div className="gear">
          <span className={`sh sh-${tr.shuttle}`}>{shuttle}</span>
          <b>
            {RANGES[tr.range]}
            {tr.gear + 1}
          </b>
        </div>
        <div className="lamps">
          <Lamp on={tr.fourWd} color="#39d353" label="4WD" />
          <Lamp on={tr.diffLock} color="#ffb020" label="DIFF" />
          <Lamp on={tr.pto} color="#ffb020" label={`PTO ${tr.pto ? Math.round(ptoRpm(tr)) : ''}`} />
          <Lamp on={tr.brake > 0.1} color="#e0533c" label="REM" />
          <Lamp on={tr.engine === 'off'} color="#e0533c" label="AKI" />
          <Lamp on={tr.wheelSpin > 0.3} color="#ffb020" label="SLIP" />
        </div>
      </div>
      <div className="dash-right">
        <Bar label="Solar" value={tr.fuel / SPEC.fuelL} text={`${Math.round(tr.fuel)} L · ${fuelRate(tr).toFixed(1)} L/jam`} />
        <Bar label="Suhu mesin" value={(tr.coolant - 40) / 70} text={`${Math.round(tr.coolant)} °C`} />
        <Bar label="Beban mesin" value={tr.load} text={`${Math.round(Math.min(1.2, tr.load) * 100)}%`} warn={tr.load > 0.95} />
        <Bar label="Hitch" value={tr.hitch} text={tr.hitchUp ? 'naik' : 'turun'} />
        <small className="ground">{GROUND[tr.ground].name}</small>
      </div>
    </div>
  );
}

function Bar({ label, value, text, warn }: { label: string; value: number; text: string; warn?: boolean }) {
  return (
    <div className="bar">
      <span>{label}</span>
      <i>
        <em style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: warn ? '#e0533c' : undefined }} />
      </i>
      <small>{text}</small>
    </div>
  );
}
