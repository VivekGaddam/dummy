import { useEffect, useRef, useState } from 'react';
import styles from './EDCParticles.module.css';

// ── sample text pixels from offscreen canvas ──────────────────────────────────
function sampleTextParticles(text, w, h, step = 5) {
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const c = off.getContext('2d');
  const fs = Math.min(w / (text.length * 0.58), h * 0.72);
  c.fillStyle = '#fff';
  c.font = `900 ${fs}px Arial Black, Arial`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, w / 2, h / 2);
  const data = c.getImageData(0, 0, w, h).data;
  const pts = [];
  for (let y = 0; y < h; y += step)
    for (let x = 0; x < w; x += step)
      if (data[(y * w + x) * 4 + 3] > 120) pts.push({ x, y });
  return pts;
}

export default function EDCParticles() {
  const canvasRef = useRef(null);
  const mouseRef  = useRef({ x: -9999, y: -9999 });
  const rafRef    = useRef(null);
  const [phase, setPhase] = useState('stars'); // 'stars' | 'forming' | 'formed'

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');

    let W = canvas.width  = window.innerWidth;
    let H = canvas.height = window.innerHeight;

    // ── build text targets ───────────────────────────────────────────────────
    const TW = Math.min(W, 700);
    const TH = Math.min(H * 0.52, 220);
    const OX = (W - TW) / 2;
    const OY = (H - TH) / 2;

    const raw  = sampleTextParticles('EDC', TW, TH, 5);
    const tgts = raw.map(p => ({ x: p.x + OX, y: p.y + OY }));

    // ── init particles ───────────────────────────────────────────────────────
    const N = Math.max(tgts.length + 150, 850);

    const px   = new Float32Array(N);
    const py   = new Float32Array(N);
    const pvx  = new Float32Array(N);
    const pvy  = new Float32Array(N);
    const ptx  = new Float32Array(N);
    const pty  = new Float32Array(N);
    const psz  = new Float32Array(N);
    const palpha = new Float32Array(N);
    const ptw  = new Float32Array(N);
    const ptoff = new Float32Array(N);
    const pdel  = new Float32Array(N);

    for (let i = 0; i < N; i++) {
      const t  = tgts[i % tgts.length];
      const ex = i >= tgts.length;

      px[i]  = Math.random() * W;
      py[i]  = Math.random() * H;

      // ── TUNED: text targets with small jitter for overflow particles ──
      ptx[i] = t.x + (ex ? (Math.random() - 0.5) * 7 : 0);
      pty[i] = t.y + (ex ? (Math.random() - 0.5) * 7 : 0);

      // ── TUNED: dot size — fine grain ──────────────────────────────────
      psz[i]    = 0.7 + Math.random() * 0.9;

      // ── TUNED: star alpha — subtle, like the reference image ──────────
      palpha[i] = 0.18 + Math.random() * 0.35;

      ptw[i]   = 0.5 + Math.random() * 1.6;
      ptoff[i] = Math.random() * Math.PI * 2;
      pdel[i]  = Math.random() * 0.85;
    }

    // ── physics constants (all tuned) ────────────────────────────────────────
    const FORM_AT  = 3.0;   // seconds before forming starts
    const FORM_DUR = 1.8;   // seconds for full form animation
    const MR       = 55;    // mouse influence radius px — tight, precise
    const MF       = 0.008; // TUNED: repulsion force — gentle, shape-preserving
    const K        = 0.055; // spring stiffness
    const C        = 2 * Math.sqrt(K) * 1.0; // TUNED: critically damped — zero bounce

    // ── mouse ────────────────────────────────────────────────────────────────
    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: (e.clientX ?? e.touches?.[0]?.clientX) - r.left,
        y: (e.clientY ?? e.touches?.[0]?.clientY) - r.top,
      };
    };
    const onLeave = () => { mouseRef.current = { x: -9999, y: -9999 }; };

    canvas.addEventListener('mousemove',  onMove);
    canvas.addEventListener('touchmove',  onMove, { passive: true });
    canvas.addEventListener('mouseleave', onLeave);

    // ── resize ───────────────────────────────────────────────────────────────
    const onResize = () => {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    // ── animation loop ───────────────────────────────────────────────────────
    let start    = null;
    let curPhase = 'stars';

    function draw(ts) {
      rafRef.current = requestAnimationFrame(draw);
      if (!start) start = ts;
      const t  = (ts - start) / 1000;

      ctx.clearRect(0, 0, W, H);

      const fp = Math.max(0, Math.min(1, (t - FORM_AT) / FORM_DUR));

      // update phase label once
      if (t < FORM_AT && curPhase !== 'stars') {
        curPhase = 'stars'; setPhase('stars');
      } else if (t >= FORM_AT && fp < 1 && curPhase !== 'forming') {
        curPhase = 'forming'; setPhase('forming');
      } else if (fp >= 1 && curPhase !== 'formed') {
        curPhase = 'formed'; setPhase('formed');
      }

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      for (let i = 0; i < N; i++) {
        const twinkle    = 0.5 + 0.5 * Math.sin(t * ptw[i] + ptoff[i]);
        const localStart = FORM_AT + pdel[i] * FORM_DUR;
        const inForm     = t > localStart;

        if (!inForm) {
          // ── STAR PHASE: gentle calm drift ──────────────────────────────
          pvx[i] += (Math.random() - 0.5) * 0.014;
          pvy[i] += (Math.random() - 0.5) * 0.014;
          pvx[i] *= 0.988;
          pvy[i] *= 0.988;
          px[i]  += pvx[i];
          py[i]  += pvy[i];

          if (px[i] < 0) px[i] = W;
          if (px[i] > W) px[i] = 0;
          if (py[i] < 0) py[i] = H;
          if (py[i] > H) py[i] = 0;

          const a = palpha[i] * twinkle;
          ctx.beginPath();
          ctx.arc(px[i], py[i], psz[i], 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${a})`;
          ctx.fill();

        } else {
          // ── FORMED PHASE: spring + mouse repulsion ─────────────────────
          const lp = Math.min(1, (t - localStart) / (FORM_DUR * 0.55));

          // mouse repulsion — gentle outward nudge only
          const dx = px[i] - mx;
          const dy = py[i] - my;
          const d  = Math.sqrt(dx * dx + dy * dy) || 1;
          if (d < MR) {
            const falloff = (MR - d) / MR; // 1 at center, 0 at edge
            pvx[i] += (dx / d) * falloff * MF * MR;
            pvy[i] += (dy / d) * falloff * MF * MR;
          }

          // critically damped spring toward target
          pvx[i] += (ptx[i] - px[i]) * K;
          pvy[i] += (pty[i] - py[i]) * K;
          pvx[i] -= pvx[i] * C; // TUNED: C = 2√K → zero bounce
          pvy[i] -= pvy[i] * C;
          px[i]  += pvx[i];
          py[i]  += pvy[i];

          // ── TUNED: formed brightness — subtle not blown out ────────────
          const base = 0.28 + 0.10 * twinkle; // was 0.42 + 0.18
          const a    = lp * base;

          // ── TUNED: very faint micro-glow only ─────────────────────────
          const g = ctx.createRadialGradient(px[i], py[i], 0, px[i], py[i], psz[i] * 2.5);
          g.addColorStop(0, `rgba(200,220,255,${a * 0.08})`); // was 0.15
          g.addColorStop(1, 'rgba(200,220,255,0)');
          ctx.beginPath();
          ctx.arc(px[i], py[i], psz[i] * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = g;
          ctx.fill();

          // solid core dot
          ctx.beginPath();
          ctx.arc(px[i], py[i], psz[i] * Math.max(0.4, lp), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${a})`;
          ctx.fill();
        }
      }
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener('mousemove',  onMove);
      canvas.removeEventListener('touchmove',  onMove);
      canvas.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('resize',     onResize);
    };
  }, []);

  return (
    <div className={styles.root}>
      <canvas ref={canvasRef} className={styles.canvas} />

      <p className={`${styles.subtitle} ${phase === 'formed' ? styles.subtitleVisible : ''}`}>
        ENGINEERING &nbsp;·&nbsp; DESIGN &nbsp;·&nbsp; CRAFT
      </p>

      <div className={`${styles.line} ${phase === 'formed' ? styles.lineVisible : ''}`} />
    </div>
  );
}
