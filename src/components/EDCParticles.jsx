import { useEffect, useRef, useState } from 'react';
import styles from './EDCParticles.module.css';

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
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const rafRef = useRef(null);
  const [phase, setPhase] = useState('stars');

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false }); // Optimization: opaque canvas

    let W = (canvas.width = window.innerWidth);
    let H = (canvas.height = window.innerHeight);

    // ── Pre-render Particle Glow (VISUAL OPTIMIZATION) ──
    // We create the glow once so we don't have to calculate gradients in the loop
    const glowCanvas = document.createElement('canvas');
    const glowSize = 10; 
    glowCanvas.width = glowCanvas.height = glowSize * 2;
    const gCtx = glowCanvas.getContext('2d');
    const grad = gCtx.createRadialGradient(glowSize, glowSize, 0, glowSize, glowSize, glowSize);
    grad.addColorStop(0, `rgba(200,220,255, 0.15)`); // Original glow strength
    grad.addColorStop(1, 'rgba(200,220,255, 0)');
    gCtx.fillStyle = grad;
    gCtx.fillRect(0, 0, glowSize * 2, glowSize * 2);

    const TW = Math.min(W, 700);
    const TH = Math.min(H * 0.52, 220);
    const OX = (W - TW) / 2;
    const OY = (H - TH) / 2;

    const raw = sampleTextParticles('EDC', TW, TH, 5);
    const tgts = raw.map((p) => ({ x: p.x + OX, y: p.y + OY }));

    const N = Math.max(tgts.length + 150, 850);
    const px = new Float32Array(N), py = new Float32Array(N);
    const pvx = new Float32Array(N), pvy = new Float32Array(N);
    const ptx = new Float32Array(N), pty = new Float32Array(N);
    const psz = new Float32Array(N), palpha = new Float32Array(N);
    const ptw = new Float32Array(N), ptoff = new Float32Array(N), pdel = new Float32Array(N);

    for (let i = 0; i < N; i++) {
      const t = tgts[i % tgts.length];
      const ex = i >= tgts.length;
      px[i] = Math.random() * W;
      py[i] = Math.random() * H;
      ptx[i] = t.x + (ex ? (Math.random() - 0.5) * 7 : 0);
      pty[i] = t.y + (ex ? (Math.random() - 0.5) * 7 : 0);
      psz[i] = 0.7 + Math.random() * 0.9;
      palpha[i] = 0.18 + Math.random() * 0.35;
      ptw[i] = 0.5 + Math.random() * 1.6;
      ptoff[i] = Math.random() * Math.PI * 2;
      pdel[i] = Math.random() * 0.85;
    }

    const FORM_AT = 3.0, FORM_DUR = 1.8, MR = 55, MR2 = MR * MR;
    const MF = 0.008, K = 0.055, C = 2 * Math.sqrt(K) * 1.0;

    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      mouseRef.current = { x: cx - r.left, y: cy - r.top };
    };

    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('resize', () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    });

    let start = null, curPhase = 'stars';

    function draw(ts) {
      rafRef.current = requestAnimationFrame(draw);
      if (!start) start = ts;
      const t = (ts - start) / 1000;
      const fp = Math.max(0, Math.min(1, (t - FORM_AT) / FORM_DUR));

      if (t >= FORM_AT && fp < 1 && curPhase !== 'forming') { curPhase = 'forming'; setPhase('forming'); }
      else if (fp >= 1 && curPhase !== 'formed') { curPhase = 'formed'; setPhase('formed'); }

      ctx.fillStyle = '#070707';
      ctx.fillRect(0, 0, W, H);

      const mx = mouseRef.current.x, my = mouseRef.current.y;

      for (let i = 0; i < N; i++) {
        const twinkle = 0.5 + 0.5 * Math.sin(t * ptw[i] + ptoff[i]);
        const localStart = FORM_AT + pdel[i] * FORM_DUR;
        const inForm = t > localStart;

        if (!inForm) {
          pvx[i] = (pvx[i] + (Math.random() - 0.5) * 0.014) * 0.988;
          pvy[i] = (pvy[i] + (Math.random() - 0.5) * 0.014) * 0.988;
          px[i] += pvx[i]; py[i] += pvy[i];
          if (px[i] < 0) px[i] = W; if (px[i] > W) px[i] = 0;
          if (py[i] < 0) py[i] = H; if (py[i] > H) py[i] = 0;

          ctx.fillStyle = `rgba(255,255,255,${palpha[i] * twinkle})`;
          ctx.beginPath();
          ctx.arc(px[i], py[i], psz[i], 0, Math.PI * 2);
          ctx.fill();
        } else {
          const lp = Math.min(1, (t - localStart) / (FORM_DUR * 0.55));
          const dx = px[i] - mx, dy = py[i] - my;
          const d2 = dx * dx + dy * dy;

          if (d2 < MR2) {
            const d = Math.sqrt(d2) || 1;
            const falloff = (MR - d) / MR;
            pvx[i] += (dx / d) * falloff * MF * MR;
            pvy[i] += (dy / d) * falloff * MF * MR;
          }

          pvx[i] = (pvx[i] + (ptx[i] - px[i]) * K) * (1 - C);
          pvy[i] = (pvy[i] + (pty[i] - py[i]) * K) * (1 - C);
          px[i] += pvx[i]; py[i] += pvy[i];

          const a = lp * (0.28 + 0.10 * twinkle);

          // Draw cached glow instead of creating a new gradient object
          ctx.globalAlpha = a; 
          ctx.drawImage(glowCanvas, px[i] - glowSize, py[i] - glowSize);
          ctx.globalAlpha = 1.0;

          // Solid core
          ctx.fillStyle = `rgba(255,255,255,${a})`;
          ctx.beginPath();
          ctx.arc(px[i], py[i], psz[i] * Math.max(0.4, lp), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
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