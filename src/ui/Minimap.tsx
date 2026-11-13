import { useEffect, useRef } from 'react';
import { BIN, MUD, PAD, PATHS, ROAD_HALF } from '../sim/estate';
import { tr, work } from '../store';

/** Top-down map of the block: road, harvest paths, TPH with remaining bunches, bin, tractor and trailer. */
export function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let id = 0;
    const W = 150;
    const H = 230;
    // seen from above with north up, +x (west of the road here) is on the left
    const sx = (x: number) => W / 2 - x * 0.55;
    const sz = (z: number) => H - (z + 120) * 0.8;
    const draw = () => {
      const g = ref.current?.getContext('2d');
      if (g) {
        g.clearRect(0, 0, W, H);
        g.fillStyle = '#3f6a2a';
        g.fillRect(0, 0, W, H);
        g.fillStyle = '#6e4c2d';
        for (const p of PATHS) g.fillRect(0, sz(p) - 1, W, 2);
        g.fillStyle = '#b06a3e';
        g.fillRect(sx(ROAD_HALF), 0, ROAD_HALF * 2 * 0.55, H);
        g.fillStyle = '#4a3523';
        for (const m of MUD) g.fillRect(sx(ROAD_HALF), sz(m.z1), ROAD_HALF * 2 * 0.55, (m.z1 - m.z0) * 0.8);
        g.fillStyle = '#a3a39e';
        g.fillRect(sx(PAD.x1), sz(PAD.z1), (PAD.x1 - PAD.x0) * 0.55, (PAD.z1 - PAD.z0) * 0.8);
        g.fillStyle = '#2f8a3a';
        g.fillRect(sx(BIN.x + BIN.w / 2), sz(BIN.z + BIN.d / 2), BIN.w * 0.55, BIN.d * 0.8);
        for (const p of work.tph) {
          g.fillStyle = p.bunches > 0 ? '#ffb020' : '#55585c';
          g.beginPath();
          g.arc(sx(p.x), sz(p.z), 1.5 + Math.min(3, p.bunches / 20), 0, Math.PI * 2);
          g.fill();
        }
        if (work.kind === 'trailer') {
          g.fillStyle = '#9cd38f';
          g.beginPath();
          g.arc(sx(work.tx), sz(work.tz), 2.5, 0, Math.PI * 2);
          g.fill();
        }
        // tractor arrow
        g.save();
        g.translate(sx(tr.x), sz(tr.z));
        g.rotate(-tr.heading);
        g.fillStyle = '#ff3b30';
        g.beginPath();
        g.moveTo(0, -6);
        g.lineTo(4, 4);
        g.lineTo(-4, 4);
        g.closePath();
        g.fill();
        g.restore();
      }
      id = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(id);
  }, []);
  return <canvas ref={ref} width={150} height={230} className="minimap" aria-label="Peta blok" />;
}
