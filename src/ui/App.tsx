import { useEffect } from 'react';
import { bindKeys, CAMS, KEYS, setImplement, toggleEngine, touch } from '../input';
import { Experience } from '../scene/Experience';
import { BUNCH_KG } from '../sim/estate';
import { RANGES, setShuttle, shift } from '../sim/tractor';
import { IMPLEMENTS, TRAILER, grassTotal, nearBin, reachableTph, toggleLoad, toggleTip, type Implement } from '../sim/work';
import { initSound } from '../sound';
import { tr, useUI, work, type CamMode } from '../store';
import { Dashboard } from './Dashboard';
import { Minimap } from './Minimap';

const CAM_LABEL: Record<CamMode, string> = { chase: 'Belakang', cab: 'Kabin', orbit: 'Bebas', top: 'Atas', show: 'Pamer' };

function Panel() {
  const ui = useUI();
  const running = tr.engine === 'running';
  const kinds = Object.keys(IMPLEMENTS) as Implement[];
  const tph = work.kind === 'trailer' ? reachableTph(work) : null;
  return (
    <aside className="panel">
      <h2>Mesin</h2>
      <button className={`big ${running ? 'warn' : 'ok'}`} onClick={toggleEngine}>
        {tr.engine === 'off' ? '🔑 Hidupkan mesin' : tr.engine === 'starting' ? 'Starter…' : 'Matikan mesin'}
      </button>
      <div className="row">
        {(['R', 'N', 'F'] as const).map((s) => (
          <button key={s} className={tr.shuttle === s ? 'on' : ''} onClick={() => setShuttle(tr, s)}>
            {s === 'F' ? 'Maju' : s === 'R' ? 'Mundur' : 'N'}
          </button>
        ))}
      </div>
      <div className="row">
        {RANGES.map((r, i) => (
          <button key={r} className={tr.range === i ? 'on' : ''} onClick={() => shift(tr, i, tr.gear)}>
            {r}
          </button>
        ))}
        {[0, 1, 2, 3].map((g) => (
          <button key={g} className={tr.gear === g ? 'on' : ''} onClick={() => shift(tr, tr.range, g)}>
            {g + 1}
          </button>
        ))}
      </div>
      <label className="slider">
        <span>
          Gas tangan <b>{Math.round(850 + tr.hand * (2330 - 850))} rpm</b>
        </span>
        <input aria-label="Gas tangan" type="range" min={0} max={1} step={0.01} value={tr.hand} onChange={(e) => (tr.hand = +e.target.value)} />
      </label>
      <div className="row">
        <button className={tr.fourWd ? 'on' : ''} onClick={() => (tr.fourWd = !tr.fourWd)}>
          4WD
        </button>
        <button className={tr.diffLock ? 'on' : ''} onClick={() => (tr.diffLock = !tr.diffLock)}>
          Diff lock
        </button>
        <button className={tr.pto ? 'on' : ''} onClick={() => (tr.pto = !tr.pto)}>
          PTO
        </button>
        <button className={tr.hitchUp ? '' : 'on'} onClick={() => (tr.hitchUp = !tr.hitchUp)}>
          {tr.hitchUp ? 'Hitch ↓' : 'Hitch ↑'}
        </button>
      </div>

      <h2>Alat</h2>
      <select aria-label="Pilih alat" value={work.kind} onChange={(e) => setImplement(e.target.value as Implement)}>
        {kinds.map((k) => (
          <option key={k} value={k}>
            {IMPLEMENTS[k].name}
          </option>
        ))}
      </select>
      <p className="desc">{IMPLEMENTS[work.kind].desc}</p>
      {work.kind === 'trailer' && (
        <>
          <div className="row">
            <button className={work.autoLoad ? 'on' : ''} onClick={() => toggleLoad(work, tr)}>
              {work.autoLoad ? 'Hentikan crane' : 'Muat janjang'}
            </button>
            <button className={work.tipping ? 'on' : ''} onClick={() => toggleTip(work, tr)}>
              Jungkit bak
            </button>
          </div>
          <div className="stats">
            <span>
              Muatan <b>{(work.load / 1000).toFixed(2)} / {TRAILER.cap / 1000} t</b> ({work.bunches} janjang)
            </span>
            <span>
              Terkirim ke bin <b>{(work.delivered / 1000).toFixed(2)} t</b> · {work.trips} trip
            </span>
            <span className="hint">
              {tph ? `TPH ${tph.id + 1} dalam jangkauan crane (${tph.bunches} janjang, ±${((tph.bunches * BUNCH_KG) / 1000).toFixed(1)} t)` : nearBin(work) ? 'Trailer di bin: siap dijungkit.' : 'Dekati TPH (titik oranye di peta) untuk memuat.'}
            </span>
          </div>
        </>
      )}
      {work.kind === 'slasher' && (
        <div className="stats">
          <span>
            Rumput terbabat <b>{((work.cutCount / grassTotal) * 100).toFixed(1)}%</b>
          </span>
          <span className="hint">Masuk ke gawangan berumput, turunkan hitch, nyalakan PTO, jalan pelan di gigi L/M.</span>
        </div>
      )}
      {work.kind === 'spreader' && (
        <div className="stats">
          <span>
            Pupuk di hopper <b>{Math.round(work.fert)} kg</b>
          </span>
          <span>
            Pokok sawit terpupuk <b>{work.fed.size}</b>
          </span>
          <span className="hint">Hitch naik ke posisi kerja, PTO on, lalu jalan di jalan panen di antara barisan pokok.</span>
        </div>
      )}

      <h2>Kamera</h2>
      <div className="row">
        {CAMS.map((c) => (
          <button key={c} className={ui.cam === c ? 'on' : ''} onClick={() => ui.set({ cam: c })}>
            {CAM_LABEL[c]}
          </button>
        ))}
      </div>
      <button className="small" onClick={() => ui.set({ help: !ui.help })}>
        ⌨ Tombol keyboard
      </button>
    </aside>
  );
}

function Toast() {
  const { toast, toastUntil } = useUI();
  useUI((s) => s.tick);
  if (!toast || performance.now() > toastUntil) return null;
  return (
    <div className="toast" role="status">
      {toast}
    </div>
  );
}

function Help() {
  const ui = useUI();
  if (!ui.help) return null;
  return (
    <div className="help" role="dialog" aria-label="Tombol keyboard">
      <button className="x" onClick={() => ui.set({ help: false })} aria-label="Tutup">
        ×
      </button>
      <h3>Tombol keyboard</h3>
      <dl>
        {KEYS.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="credit">
        Suara: rekaman John Deere 5820 dan Komatsu 941 oleh Work With Sounds / Werstas (CC BY 4.0), start mesin bus diesel oleh Evan0512 (CC BY-SA 4.0),
        dari Wikimedia Commons.
      </p>
    </div>
  );
}

/** Touch: steering pad on the left, pedals on the right. */
function Touch() {
  const steer = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    touch.steer = Math.max(-1, Math.min(1, -((e.clientX - r.left) / r.width - 0.5) * 2.2));
  };
  return (
    <div className="touch">
      <div
        className="steerpad"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          steer(e);
        }}
        onPointerMove={(e) => e.buttons && steer(e)}
        onPointerUp={() => (touch.steer = 0)}
      >
        ◀ setir ▶
      </div>
      <div className="pedals">
        <button onPointerDown={() => (touch.brake = 1)} onPointerUp={() => (touch.brake = 0)} onPointerLeave={() => (touch.brake = 0)}>
          Rem
        </button>
        <button onPointerDown={() => (touch.gas = 1)} onPointerUp={() => (touch.gas = 0)} onPointerLeave={() => (touch.gas = 0)}>
          Gas
        </button>
      </div>
    </div>
  );
}

export function App() {
  const started = useUI((s) => s.started);
  useEffect(() => bindKeys(), []);
  return (
    <>
      <Experience />
      <header className="brand">
        <h1>MF 5M.145</h1>
        <p>Simulator traktor · kebun sawit</p>
      </header>
      <Minimap />
      <Panel />
      <Dashboard />
      <Toast />
      <Help />
      <Touch />
      {!started && (
        <div className="intro">
          <div>
            <h1>Simulator Traktor MF 5M.145</h1>
            <p>
              Kendarai traktor 145 hp di blok kebun sawit: angkut janjang dari TPH dengan trailer dan crane, babat gawangan dengan slasher, atau tabur pupuk
              dengan spreader. Suara mesin dari rekaman traktor diesel asli.
            </p>
            <ol>
              <li>Klik Hidupkan mesin (shuttle harus di N)</li>
              <li>Pilih gigi, lalu tekan Maju</li>
              <li>Tambah gas tangan atau tekan W</li>
            </ol>
            <button
              className="big ok"
              onClick={() => {
                initSound();
                useUI.getState().set({ started: true });
              }}
            >
              Mulai (suara aktif)
            </button>
          </div>
        </div>
      )}
    </>
  );
}
