import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../hooks';

console.log('[glypha field] v5 · radar + ciphertext loaded');

export type ShotId = 'hero' | 'stack' | 'ladder' | 'notes' | 'security' | 'quickstart' | 'source';

interface Shot { dim: number; observer: boolean }

const SHOTS: Record<ShotId, Shot> = {
  hero:       { dim: 0.08, observer: false },
  quickstart: { dim: 0.54, observer: false },
  ladder:     { dim: 0.46, observer: false },
  stack:      { dim: 0.54, observer: false },
  notes:      { dim: 0.58, observer: false },
  security:   { dim: 0.50, observer: true  },
  source:     { dim: 0.22, observer: false },
};

/* seeded PRNG — identical field on every load */
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Stats { nodes: number; pkt: number }
type StatsFn = (s: Stats) => void;
const statsFns = new Set<StatsFn>();
// eslint-disable-next-line react-refresh/only-export-components
export function onFieldStats(fn: StatsFn): () => void {
  statsFns.add(fn);
  return () => { statsFns.delete(fn); };
}

const TAU = Math.PI * 2;
const SWEEP_S = 14; // seconds per revolution
const HEX = '0123456789ABCDEF';
const C_INK = '233,236,231';
const C_GREEN = '103,221,161';

/* glyph density — three soft off-center clusters, no mirror */
const BLOBS = [
  { x: 0.78, y: 0.26, s: 0.34, p: 0.42 },
  { x: 0.90, y: 0.72, s: 0.26, p: 0.30 },
  { x: 0.36, y: 0.90, s: 0.30, p: 0.20 },
];
const BASELINE = 0.05;

const density = (nx: number, ny: number): number => {
  let d = BASELINE;
  for (const b of BLOBS) {
    const dx = nx - b.x;
    const dy = (ny - b.y) * 0.8;
    const g = Math.exp(-(dx * dx + dy * dy) / (2 * b.s * b.s));
    d = Math.max(d, BASELINE + (b.p - BASELINE) * g);
  }
  return d;
};

/* what a hovered contact identifies itself as */
const LABELS = [
  '10.0.4.12:4310', '172.19.8.5:34059', '203.0.113.7:7000', '192.168.1.23:9999',
  '157.49.119.123:7001', '10.1.9.7:4310', '172.20.3.44:34059', '198.51.100.9:7000',
];

interface Blip { r: number; th: number; glow: number; echo: number; label: string; la: number }

/* glyph layer — offscreen grid of sparse hex pairs */
interface GlyphLayer {
  cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D;
  cellW: number; cellH: number; cols: number; rows: number; w: number; h: number;
  cells: string[][];
}

export function Field() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    let W = 0, H = 0, dpr = 1, maxR = 0;
    let ox = 0, oy = 0;
    let blips: Blip[] = [];
    let G: GlyphLayer | null = null;
    let raf = 0;
    let last = 0, sweepA = 0, statT = 0, mutT = 0;
    let dirty = true;
    let tx = 0, ty = 0;
    let heroOn = false;
    const ptr = { x: -999, y: -999 };

    let curDim = SHOTS.hero.dim, curObs = 0;
    let shot: Shot = SHOTS.hero;

    const heroEl = document.getElementById('hero');

    /* ---------- glyph layer ---------- */
    const drawGlyphCell = (c: number, r: number, green = false) => {
      if (!G) return;
      const ch = G.cells[r][c];
      G.ctx.clearRect(c * G.cellW, r * G.cellH, G.cellW, G.cellH);
      if (!ch) return;
      G.ctx.fillStyle = green ? `rgba(${C_GREEN},.11)` : `rgba(${C_INK},.085)`;
      G.ctx.fillText(ch, c * G.cellW + G.cellW / 2, r * G.cellH + G.cellH / 2);
    };

    const buildGlyphs = () => {
      const rng = mulberry32(0x676c7970); // "glyp"
      const cellW = 26, cellH = 22;
      const margin = 40;
      const cols = Math.ceil((W + margin * 2) / cellW);
      const rows = Math.ceil((H + margin * 2) / cellH);
      const gcv = document.createElement('canvas');
      gcv.width = Math.round(cols * cellW * dpr);
      gcv.height = Math.round(rows * cellH * dpr);
      const gctx = gcv.getContext('2d')!;
      gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gctx.font = '500 12px "JetBrains Mono", monospace';
      gctx.textAlign = 'center';
      gctx.textBaseline = 'middle';
      G = { cv: gcv, ctx: gctx, cellW, cellH, cols, rows,
        w: cols * cellW, h: rows * cellH, cells: [] };

      let count = 0;
      for (let r = 0; r < rows; r++) {
        G.cells.push([]);
        for (let c = 0; c < cols; c++) {
          if (rng() < density(c / cols, r / rows)) {
            G.cells[r].push(HEX[(rng() * 16) | 0] + HEX[(rng() * 16) | 0]);
            count++;
          } else {
            G.cells[r].push('');
          }
        }
      }
      /* a few green-tinted accents, seeded */
      for (let i = 0, n = Math.round(count * 0.07); i < n; i++) {
        const r = (rng() * rows) | 0, c = (rng() * cols) | 0;
        if (!G.cells[r][c]) continue;
        drawGlyphCell(c, r, true);
      }
    };

    /* ---------- radar ---------- */
    const build = () => {
      const rng = mulberry32(0x52534144); // "RSAD"-ish second stream
      blips = [];
      const n = 12 + ((rng() * 5) | 0);
      for (let i = 0; i < n; i++) {
        blips.push({
          r: 0.14 + rng() * 0.82,
          th: rng() * TAU,
          glow: rng() * 0.4,
          echo: -1,
          label: LABELS[i % LABELS.length],
          la: 0,
        });
      }
      statsFns.forEach(f => f({ nodes: blips.length, pkt: Math.round(360 / SWEEP_S) }));
    };

    const draw = (simT: number) => {
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1;

      const mr = Math.round(103 + (231 - 103) * curObs);
      const mg = Math.round(221 + (184 - 221) * curObs);
      const mb = Math.round(161 + (109 - 161) * curObs);

      /* glyph field first — the substance under the instrument */
      if (G) {
        const dx = -40 + Math.sin(simT * 0.045) * 7;
        const dy = -40 + Math.cos(simT * 0.032) * 5;
        ctx.drawImage(G.cv, dx, dy, G.w, G.h);
      }

      /* range rings */
      ctx.strokeStyle = `rgba(${C_INK},.05)`;
      for (const f of [0.2, 0.42, 0.66, 0.92]) {
        ctx.beginPath(); ctx.arc(ox, oy, maxR * f, 0, TAU); ctx.stroke();
      }

      /* origin — the rendezvous point */
      ctx.fillStyle = `rgba(${mr},${mg},${mb},.45)`;
      ctx.beginPath(); ctx.arc(ox, oy, 2.2, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(${mr},${mg},${mb},.2)`;
      ctx.beginPath(); ctx.arc(ox, oy, 7, 0, TAU); ctx.stroke();

      /* the sweep fan */
      const FAN = 42;
      for (let i = 0; i < FAN; i++) {
        const a = sweepA - i * 0.0125;
        const al = 0.06 * Math.pow(1 - i / FAN, 2);
        ctx.strokeStyle = `rgba(${mr},${mg},${mb},${al.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox + Math.cos(a) * maxR, oy + Math.sin(a) * maxR);
        ctx.stroke();
      }
      ctx.strokeStyle = `rgba(${mr},${mg},${mb},.13)`;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + Math.cos(sweepA) * maxR, oy + Math.sin(sweepA) * maxR);
      ctx.stroke();

      /* beam shimmer — glyphs brighten as the sweep passes through them.
         this is what fuses the two layers into one instrument. */
      if (G && !reduced) {
        ctx.font = '500 12px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const dx = -40 + Math.sin(simT * 0.045) * 7;
        const dy = -40 + Math.cos(simT * 0.032) * 5;
        const step = G.cellW;
        for (let d = step; d < maxR; d += step) {
          for (let k = 0; k < 4; k++) { // a few trail steps behind the head
            const dist = d - k * step * 0.6;
            if (dist <= 0) break;
            const bx = ox + Math.cos(sweepA) * dist;
            const by = oy + Math.sin(sweepA) * dist;
            if (bx < 0 || bx > W || by < 0 || by > H) continue;
            const c = Math.floor((bx - dx) / G.cellW);
            const r = Math.floor((by - dy) / G.cellH);
            if (r < 0 || r >= G.rows || c < 0 || c >= G.cols) continue;
            const ch = G.cells[r][c];
            if (!ch) continue;
            const a = 0.34 * Math.pow(1 - k / 4, 1.6);
            ctx.fillStyle = `rgba(${mr},${mg},${mb},${a.toFixed(3)})`;
            ctx.fillText(ch, dx + c * G.cellW + G.cellW / 2, dy + r * G.cellH + G.cellH / 2);
          }
        }
      }

      /* contacts */
      ctx.font = '500 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      for (const b of blips) {
        const bx = ox + Math.cos(b.th) * b.r * maxR;
        const by = oy + Math.sin(b.th) * b.r * maxR;

        if (b.echo >= 0 && b.echo < 2.4) {
          ctx.strokeStyle = `rgba(${mr},${mg},${mb},${(0.16 * (1 - b.echo / 2.4)).toFixed(3)})`;
          ctx.beginPath(); ctx.arc(bx, by, 4 + b.echo * 30, 0, TAU); ctx.stroke();
        }

        const al = Math.min(0.75, 0.12 + b.glow * 0.5);
        const rr = 1.6 + b.glow * 1.8 + b.la * 1.2;
        ctx.fillStyle = `rgba(${mr},${mg},${mb},${al.toFixed(3)})`;
        ctx.beginPath(); ctx.arc(bx, by, rr, 0, TAU); ctx.fill();

        if (b.la > 0.02) {
          ctx.strokeStyle = `rgba(${mr},${mg},${mb},${(0.25 * b.la).toFixed(3)})`;
          ctx.beginPath(); ctx.moveTo(bx + 4, by); ctx.lineTo(bx + 9, by); ctx.stroke();
          ctx.fillStyle = `rgba(${C_INK},${(0.62 * b.la).toFixed(3)})`;
          ctx.fillText(b.label, bx + 12, by);
        }
      }

      /* per-shot dim */
      ctx.fillStyle = `rgba(6,7,6,${curDim.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    };

    const frame = (ts: number) => {
      raf = requestAnimationFrame(frame);
      if (last === 0) last = ts;
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;

      if (reduced) {
        if (dirty) {
          ox = W * 0.62; oy = H * 0.38;
          curDim = shot.dim; curObs = shot.observer ? 1 : 0;
          draw(0); dirty = false;
        }
        return;
      }

      const simT = ts / 1000;
      sweepA = (sweepA + (TAU / SWEEP_S) * dt) % TAU;
      ox += (W * 0.62 - tx * 9 - ox) * 0.04;
      oy += (H * 0.38 - ty * 6 - oy) * 0.04;
      curDim += (shot.dim - curDim) * 0.035;
      curObs += ((shot.observer ? 1 : 0) - curObs) * 0.045;

      for (const b of blips) {
        const d = Math.atan2(Math.sin(b.th - sweepA), Math.cos(b.th - sweepA));
        if (d > 0 && d < 0.05) { b.glow = 1; b.echo = 0; }
        b.glow *= Math.pow(0.5, dt / 1.15);
        if (b.echo >= 0) { b.echo += dt; if (b.echo > 2.4) b.echo = -1; }

        const bx = ox + Math.cos(b.th) * b.r * maxR;
        const by = oy + Math.sin(b.th) * b.r * maxR;
        const near = heroOn && Math.hypot(ptr.x - bx, ptr.y - by) < 90;
        b.la += ((near ? 1 : 0) - b.la) * 0.12;
      }

      /* occasional glyph mutation — the field quietly rewrites itself */
      mutT += dt;
      if (mutT > 2.4 && G) {
        mutT = 0;
        const r = (Math.random() * G.rows) | 0;
        const c = (Math.random() * G.cols) | 0;
        G.cells[r][c] = Math.random() < 0.35
          ? HEX[(Math.random() * 16) | 0] + HEX[(Math.random() * 16) | 0]
          : '';
        drawGlyphCell(c, r, Math.random() < 0.1);
      }

      draw(simT);

      if (ts - statT > 700) {
        statT = ts;
        statsFns.forEach(f => f({ nodes: blips.length, pkt: Math.round(360 / SWEEP_S) }));
      }
    };

    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
      if (e.pointerType === 'touch') return;
      ptr.x = e.clientX; ptr.y = e.clientY;
      const hr = heroEl?.getBoundingClientRect();
      heroOn = !!hr && hr.bottom > 0 && e.clientY <= hr.bottom;
    };
    const onLeave = () => { heroOn = false; ptr.x = -999; ptr.y = -999; };
    const onScroll = () => {
      const hr = heroEl?.getBoundingClientRect();
      heroOn = !!hr && hr.bottom > 0 && ptr.y <= hr.bottom;
    };

    const resize = () => {
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      maxR = Math.min(W, H) * 1.05;
      buildGlyphs();
      build();
      dirty = true;
    };

    const io = new IntersectionObserver(es => {
      es.forEach(en => {
        if (!en.isIntersecting) return;
        const id = en.target.getAttribute('data-shot') as ShotId | null;
        if (id && SHOTS[id] && SHOTS[id] !== shot) { shot = SHOTS[id]; dirty = true; }
      });
    }, { rootMargin: '-40% 0px -40% 0px' });
    document.querySelectorAll('[data-shot]').forEach(el => io.observe(el));

    if (!reduced) {
      window.addEventListener('pointermove', onMove, { passive: true });
      document.documentElement.addEventListener('pointerleave', onLeave);
      window.addEventListener('scroll', onScroll, { passive: true });
    }
    window.addEventListener('resize', resize);
    resize();
    raf = requestAnimationFrame(frame);

    document.fonts.ready.then(() => { buildGlyphs(); dirty = true; }).catch(() => {});

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', resize);
    };
  }, [reduced]);

  return <canvas className="field" ref={ref} aria-hidden="true" />;
}