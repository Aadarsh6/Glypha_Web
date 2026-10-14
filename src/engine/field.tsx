import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../hooks';

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

/* ---------- tunables ---------- */
const SWEEP_S = 14;      // seconds per revolution
const FAN = 0.52;        // radians of persistence behind the beam (~30°)
const MARGIN = 72;       // glyph layer overscan (px) — absorbs drift + small resizes
const LENS_R = 120;      // cursor lens radius (px)
const PING_S = 2.6;      // seconds for a ping ring to reach full range
const VIGNETTE = 0.3;    // edge darkening, 0 to disable
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const GLYPH_FONT = `500 12px ${MONO}`;
const LABEL_FONT = `500 10px ${MONO}`;

const TAU = Math.PI * 2;
const HEX = '0123456789ABCDEF';
const C_INK = '233,236,231';
const C_GREEN = '103,221,161';

/* seeded PRNG — identical field on every load */
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* stateless hash — lets scrambling be a pure function of (cell, time) */
const hash = (a: number, b: number, c: number): number => {
  let h = Math.imul(a + 0x9e3779b9, 374761393)
        ^ Math.imul(b + 0x85ebca6b, 668265263)
        ^ Math.imul(c + 0xc2b2ae35, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};

const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const randHex = () => HEX[(Math.random() * 16) | 0] + HEX[(Math.random() * 16) | 0];

export interface Stats { nodes: number; pkt: number }
type StatsFn = (s: Stats) => void;
const statsFns = new Set<StatsFn>();
// eslint-disable-next-line react-refresh/only-export-components
export function onFieldStats(fn: StatsFn): () => void {
  statsFns.add(fn);
  return () => { statsFns.delete(fn); };
}

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

/* contact labels — private + RFC 5737 documentation ranges only, so nothing
   here can ever be a real address */
const NETS = ['10.0.', '10.1.', '172.19.', '172.20.', '192.168.1.', '203.0.113.', '198.51.100.', '192.0.2.'];
const PORTS = [4310, 7000, 7001, 9999, 34059];

const makeLabel = (rng: () => number): string => {
  const prefix = NETS[(rng() * NETS.length) | 0];
  const need = 4 - (prefix.split('.').length - 1);
  const tail: number[] = [];
  for (let i = 0; i < need; i++) tail.push(1 + ((rng() * 253) | 0));
  return `${prefix}${tail.join('.')}:${PORTS[(rng() * PORTS.length) | 0]}`;
};

/* label text as it "decrypts": resolved prefix is real, the rest is churning hex */
const scrambleTail = (s: string, from: number, seed: number, tick: number): string => {
  let out = '';
  for (let i = from; i < s.length; i++) {
    const ch = s[i];
    out += ch === '.' || ch === ':' ? ch : HEX[hash(i, seed, tick) & 15];
  }
  return out;
};

interface Blip {
  r: number; th: number;          // polar position, r normalised 0–1
  x: number; y: number;           // resolved each frame
  glow: number; echo: number;
  label: string; la: number;      // label alpha
  rev: number;                    // decrypt progress 0–1
}
interface Packet { to: number; t: number; dur: number }
interface Ping { t: number; r: number }
interface Flash { c: number; r: number; t: number }

interface GlyphLayer {
  cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D;
  cellW: number; cellH: number; cols: number; rows: number; w: number; h: number;
  cells: string[][];
}

type ConicCtx = CanvasRenderingContext2D & {
  createConicGradient?: (startAngle: number, x: number, y: number) => CanvasGradient;
};

export function Field() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const conic = (ctx as ConicCtx).createConicGradient?.bind(ctx);
    const coarse = window.matchMedia('(pointer: coarse)').matches;

    let W = 0, H = 0, dpr = 1, dprCap = 1.5, maxR = 0;
    let ox = 0, oy = 0;
    let gdx = -MARGIN, gdy = -MARGIN;           // glyph layer offset (drifts)
    let blips: Blip[] = [];
    let G: GlyphLayer | null = null;
    let vig: CanvasGradient | null = null;
    let raf = 0, resizeT = 0;
    let last = 0, sweepA = 5.35, statT = 0, mutT = 0, pktT = 1.2, slowFor = 0;
    let pktCount = 0, lastHit = -1;
    let px = 0, py = 0;                         // parallax input, -1..1
    let heroOn = false, heroSeen = false;
    let lensA = 0;
    let disposed = false;
    const ptr = { x: -999, y: -999 };
    const packets: Packet[] = [];
    const pings: Ping[] = [];
    const flashes: Flash[] = [];

    let curDim = SHOTS.hero.dim, curObs = 0;
    let shot: Shot = SHOTS.hero;

    const heroEl = document.getElementById('hero');
    const emit = () => statsFns.forEach(f => f({ nodes: blips.length, pkt: pktCount }));

    /* ---------- glyph layer ---------- */
    const drawGlyphCell = (c: number, r: number, green = false) => {
      const g = G;
      if (!g) return;
      const ch = g.cells[r][c];
      g.ctx.clearRect(c * g.cellW, r * g.cellH, g.cellW, g.cellH);
      if (!ch) return;
      g.ctx.fillStyle = green ? `rgba(${C_GREEN},.11)` : `rgba(${C_INK},.085)`;
      g.ctx.fillText(ch, c * g.cellW + g.cellW / 2, r * g.cellH + g.cellH / 2);
    };

    const buildGlyphs = () => {
      const rng = mulberry32(0x676c7970); // "glyp"
      const cellW = 26, cellH = 22;
      const cols = Math.ceil((W + MARGIN * 2) / cellW);
      const rows = Math.ceil((H + MARGIN * 2) / cellH);
      const gcv = document.createElement('canvas');
      gcv.width = Math.round(cols * cellW * dpr);
      gcv.height = Math.round(rows * cellH * dpr);
      const gctx = gcv.getContext('2d')!;
      gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gctx.font = GLYPH_FONT;
      gctx.textAlign = 'center';
      gctx.textBaseline = 'middle';
      const g: GlyphLayer = { cv: gcv, ctx: gctx, cellW, cellH, cols, rows,
        w: cols * cellW, h: rows * cellH, cells: [] };
      G = g;

      let count = 0;
      for (let r = 0; r < rows; r++) {
        g.cells.push([]);
        for (let c = 0; c < cols; c++) {
          if (rng() < density(c / cols, r / rows)) {
            g.cells[r].push(HEX[(rng() * 16) | 0] + HEX[(rng() * 16) | 0]);
            count++;
          } else {
            g.cells[r].push('');
          }
        }
      }
      /* the base layer is painted once, then individual cells are patched */
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) drawGlyphCell(c, r);
      for (let i = 0, n = Math.round(count * 0.07); i < n; i++) {
        const r = (rng() * rows) | 0, c = (rng() * cols) | 0;
        if (!g.cells[r][c]) continue;
        drawGlyphCell(c, r, true);
      }
    };

    /* ---------- contacts ---------- */
    const build = () => {
      const rng = mulberry32(0x52534144);
      blips = [];
      const n = 12 + ((rng() * 5) | 0);
      const seen = new Set<string>();
      for (let i = 0; i < n; i++) {
        let label = makeLabel(rng);
        while (seen.has(label)) label = makeLabel(rng);
        seen.add(label);
        blips.push({
          r: 0.14 + rng() * 0.82,
          th: rng() * TAU,
          x: 0, y: 0,
          glow: rng() * 0.4,
          echo: -1,
          label, la: 0, rev: 0,
        });
      }
      emit();
    };

    const place = () => {
      for (const b of blips) {
        b.x = ox + Math.cos(b.th) * b.r * maxR;
        b.y = oy + Math.sin(b.th) * b.r * maxR;
      }
    };

    /* a packet landing rewrites a few glyphs beside the node and flashes them */
    const arrive = (b: Blip) => {
      b.glow = Math.max(b.glow, 0.9);
      b.echo = 0;
      pktCount++;
      const g = G;
      if (!g) return;
      for (let i = 0; i < 2; i++) {
        const c = Math.floor((b.x - gdx) / g.cellW) + ((Math.random() * 5) | 0) - 2;
        const r = Math.floor((b.y - gdy) / g.cellH) + ((Math.random() * 5) | 0) - 2;
        if (r < 0 || r >= g.rows || c < 0 || c >= g.cols) continue;
        g.cells[r][c] = randHex();
        drawGlyphCell(c, r, true);
        flashes.push({ c, r, t: 0 });
      }
      if (flashes.length > 18) flashes.splice(0, flashes.length - 18);
    };

    /* ---------- render ---------- */
    const draw = (simT: number) => {
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1;

      const mr = Math.round(103 + (231 - 103) * curObs);
      const mg = Math.round(221 + (184 - 221) * curObs);
      const mb = Math.round(161 + (109 - 161) * curObs);
      const M = `${mr},${mg},${mb}`;
      const g = G;

      /* glyph field first — the substance under the instrument */
      if (g) ctx.drawImage(g.cv, gdx, gdy, g.w, g.h);

      /* range rings */
      ctx.strokeStyle = `rgba(${C_INK},.05)`;
      for (const f of [0.2, 0.42, 0.66, 0.92]) {
        ctx.beginPath(); ctx.arc(ox, oy, maxR * f, 0, TAU); ctx.stroke();
      }

      /* origin — the rendezvous point */
      ctx.fillStyle = `rgba(${M},.45)`;
      ctx.beginPath(); ctx.arc(ox, oy, 2.2, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(${M},.2)`;
      ctx.beginPath(); ctx.arc(ox, oy, 7, 0, TAU); ctx.stroke();

      /* sweep fan — one conic gradient instead of 42 strokes */
      if (conic) {
        const a0 = sweepA - FAN;
        const grad = conic(a0, ox, oy);
        const f = FAN / TAU;
        grad.addColorStop(0, `rgba(${M},0)`);
        grad.addColorStop(f * 0.5, `rgba(${M},.02)`);
        grad.addColorStop(f * 0.8, `rgba(${M},.05)`);
        grad.addColorStop(f, `rgba(${M},.085)`);
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.arc(ox, oy, maxR, a0, sweepA); ctx.closePath(); ctx.fill();
      } else {
        const STEPS = 30;
        for (let i = 0; i < STEPS; i++) {
          const a = sweepA - i * (FAN / STEPS);
          ctx.strokeStyle = `rgba(${M},${(0.06 * Math.pow(1 - i / STEPS, 2)).toFixed(3)})`;
          ctx.beginPath(); ctx.moveTo(ox, oy);
          ctx.lineTo(ox + Math.cos(a) * maxR, oy + Math.sin(a) * maxR); ctx.stroke();
        }
      }
      ctx.strokeStyle = `rgba(${M},.13)`;
      ctx.beginPath(); ctx.moveTo(ox, oy);
      ctx.lineTo(ox + Math.cos(sweepA) * maxR, oy + Math.sin(sweepA) * maxR); ctx.stroke();

      /* glyph persistence — every glyph inside the fan lights up and decays as
         the beam moves on, like phosphor. this fuses the two layers. */
      if (g && !reduced) {
        ctx.font = GLYPH_FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const hw = g.cellW / 2, hh = g.cellH / 2;
        for (let r = 0; r < g.rows; r++) {
          const cy = gdy + r * g.cellH + hh;
          if (cy < -g.cellH || cy > H + g.cellH) continue;
          const row = g.cells[r];
          for (let c = 0; c < g.cols; c++) {
            const ch = row[c];
            if (!ch) continue;
            const cx = gdx + c * g.cellW + hw;
            if (cx < -g.cellW || cx > W + g.cellW) continue;
            const rx = cx - ox, ry = cy - oy;
            let d = (sweepA - Math.atan2(ry, rx)) % TAU;
            if (d < 0) d += TAU;
            if (d > FAN) continue;
            const k = 1 - d / FAN;
            const far = Math.min(1, Math.hypot(rx, ry) / maxR);
            const a = 0.36 * Math.pow(k, 1.8) * (1 - 0.45 * far);
            ctx.fillStyle = `rgba(${M},${a.toFixed(3)})`;
            ctx.fillText(ch, cx, cy);
          }
        }

        /* arrival flashes */
        for (const f of flashes) {
          const ch = g.cells[f.r]?.[f.c];
          if (!ch) continue;
          const a = 0.6 * Math.pow(1 - f.t / 1.6, 1.5);
          ctx.fillStyle = `rgba(${M},${a.toFixed(3)})`;
          ctx.fillText(ch, gdx + f.c * g.cellW + hw, gdy + f.r * g.cellH + hh);
        }

        /* cursor lens — glyphs under the pointer brighten; the outer ring
           churns while the core holds steady */
        if (lensA > 0.02) {
          const c0 = Math.max(0, Math.floor((ptr.x - LENS_R - gdx) / g.cellW));
          const c1 = Math.min(g.cols - 1, Math.floor((ptr.x + LENS_R - gdx) / g.cellW));
          const r0 = Math.max(0, Math.floor((ptr.y - LENS_R - gdy) / g.cellH));
          const r1 = Math.min(g.rows - 1, Math.floor((ptr.y + LENS_R - gdy) / g.cellH));
          const tick = (simT * 9) | 0;
          for (let r = r0; r <= r1; r++) {
            for (let c = c0; c <= c1; c++) {
              const ch = g.cells[r][c];
              if (!ch) continue;
              const cx = gdx + c * g.cellW + hw;
              const cy = gdy + r * g.cellH + hh;
              const d = Math.hypot(cx - ptr.x, cy - ptr.y);
              if (d > LENS_R) continue;
              const k = 1 - d / LENS_R;
              let text = ch;
              if (d > LENS_R * 0.45) {
                const h = hash(c, r, tick);
                if ((h & 3) === 0) text = HEX[(h >>> 4) & 15] + HEX[(h >>> 8) & 15];
              }
              ctx.fillStyle = `rgba(${C_INK},${(0.42 * k * k * lensA).toFixed(3)})`;
              ctx.fillText(text, cx, cy);
            }
          }
        }
      }

      /* ping rings — emitted on click and on every scene change */
      for (const p of pings) {
        const u = p.t / PING_S;
        ctx.strokeStyle = `rgba(${M},${(0.16 * Math.pow(1 - u, 1.5)).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(ox, oy, p.r, 0, TAU); ctx.stroke();
      }

      /* packets in flight: rendezvous → node */
      for (const p of packets) {
        const b = blips[p.to];
        const u = p.t / p.dur;
        const e = u * u * (3 - 2 * u);
        const hx = ox + (b.x - ox) * e, hy = oy + (b.y - oy) * e;
        const e0 = Math.max(0, e - 0.22);
        const tx0 = ox + (b.x - ox) * e0, ty0 = oy + (b.y - oy) * e0;
        ctx.strokeStyle = `rgba(${M},.05)`;
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(b.x, b.y); ctx.stroke();
        const lg = ctx.createLinearGradient(tx0, ty0, hx, hy);
        lg.addColorStop(0, `rgba(${M},0)`);
        lg.addColorStop(1, `rgba(${M},.6)`);
        ctx.strokeStyle = lg;
        ctx.beginPath(); ctx.moveTo(tx0, ty0); ctx.lineTo(hx, hy); ctx.stroke();
        ctx.fillStyle = `rgba(${M},.85)`;
        ctx.beginPath(); ctx.arc(hx, hy, 1.6, 0, TAU); ctx.fill();
      }

      /* contacts */
      ctx.font = LABEL_FONT;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const cw = ctx.measureText('0').width;
      const tick = (simT * 18) | 0;
      for (let i = 0; i < blips.length; i++) {
        const b = blips[i];

        if (b.echo >= 0 && b.echo < 2.4) {
          ctx.strokeStyle = `rgba(${M},${(0.16 * (1 - b.echo / 2.4)).toFixed(3)})`;
          ctx.beginPath(); ctx.arc(b.x, b.y, 4 + b.echo * 30, 0, TAU); ctx.stroke();
        }

        const al = Math.min(0.75, 0.12 + b.glow * 0.5);
        const rr = 1.6 + b.glow * 1.8 + b.la * 1.2;
        ctx.fillStyle = `rgba(${M},${al.toFixed(3)})`;
        ctx.beginPath(); ctx.arc(b.x, b.y, rr, 0, TAU); ctx.fill();

        if (b.la > 0.02) {
          const len = b.label.length;
          const flip = b.x + 12 + len * cw > W - 12;   // keep labels on-screen
          const dir = flip ? -1 : 1;
          ctx.strokeStyle = `rgba(${M},${(0.25 * b.la).toFixed(3)})`;
          ctx.beginPath(); ctx.moveTo(b.x + dir * 4, b.y); ctx.lineTo(b.x + dir * 9, b.y); ctx.stroke();

          const x0 = flip ? b.x - 12 - len * cw : b.x + 12;
          const done = Math.floor(b.rev * len);
          ctx.fillStyle = `rgba(${C_INK},${(0.62 * b.la).toFixed(3)})`;
          ctx.fillText(b.label.slice(0, done), x0, b.y);
          if (done < len) {
            ctx.fillStyle = `rgba(${M},${(0.5 * b.la).toFixed(3)})`;
            ctx.fillText(scrambleTail(b.label, done, i, tick), x0 + done * cw, b.y);
          }
        }
      }

      /* per-shot dim */
      ctx.fillStyle = `rgba(6,7,6,${curDim.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);

      if (vig) { ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H); }
    };

    const renderStatic = () => {
      ox = W * 0.62; oy = H * 0.38;
      gdx = gdy = -MARGIN;
      curDim = shot.dim; curObs = shot.observer ? 1 : 0;
      place();
      draw(0);
    };

    /* ---------- loop ---------- */
    const frame = (ts: number) => {
      raf = requestAnimationFrame(frame);
      if (last === 0) last = ts;
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;

      /* if the device can't hold ~40fps at hi-dpi, drop to 1x once */
      if (dpr > 1) {
        slowFor = dt > 0.026 ? slowFor + dt : Math.max(0, slowFor - dt * 2);
        if (slowFor > 3) { dprCap = 1; slowFor = 0; resize(true); }
      }

      /* frame-rate independent easing */
      const k = (rate: number) => 1 - Math.pow(1 - rate, dt * 60);

      const simT = ts / 1000;
      const prevA = sweepA;
      sweepA = (sweepA + (TAU / SWEEP_S) * dt) % TAU;
      ox += (W * 0.62 - px * 9 - ox) * k(0.04);
      oy += (H * 0.38 - py * 6 - oy) * k(0.04);
      curDim += (shot.dim - curDim) * k(0.035);
      curObs += ((shot.observer ? 1 : 0) - curObs) * k(0.045);
      gdx = -MARGIN + Math.sin(simT * 0.045) * 7;
      gdy = -MARGIN + Math.cos(simT * 0.032) * 5;
      place();

      /* the beam lights a contact exactly once, as it crosses it */
      const decay = Math.pow(0.5, dt / 1.15);
      for (let i = 0; i < blips.length; i++) {
        const b = blips[i];
        if (wrapPi(b.th - prevA) > 0 && wrapPi(b.th - sweepA) <= 0) {
          b.glow = 1; b.echo = 0; lastHit = i;
        }
        b.glow *= decay;
        if (b.echo >= 0) { b.echo += dt; if (b.echo > 2.4) b.echo = -1; }
      }

      /* hover: nearest contact within 90px (mouse) — or, on touch, whichever
         contact the beam just crossed, so the ciphertext is visible without hover */
      let hover = -1;
      if (coarse) {
        if (heroSeen && lastHit >= 0 && blips[lastHit].glow > 0.55) hover = lastHit;
      } else if (heroOn) {
        let best = 90;
        for (let i = 0; i < blips.length; i++) {
          const d = Math.hypot(ptr.x - blips[i].x, ptr.y - blips[i].y);
          if (d < best) { best = d; hover = i; }
        }
      }
      const kLa = k(0.12);
      for (let i = 0; i < blips.length; i++) {
        const b = blips[i];
        b.la += ((i === hover ? 1 : 0) - b.la) * kLa;
        if (i === hover) b.rev = Math.min(1, b.rev + dt / 0.5);
        else if (b.la < 0.02) b.rev = 0;
      }
      lensA += ((heroOn && !coarse ? 1 : 0) - lensA) * k(0.1);

      /* packets */
      pktT -= dt;
      if (pktT <= 0 && packets.length < 3 && blips.length) {
        pktT = 1.4 + Math.random() * 1.8;
        packets.push({ to: (Math.random() * blips.length) | 0, t: 0, dur: 0.9 + Math.random() * 0.6 });
      }
      for (let i = packets.length - 1; i >= 0; i--) {
        const p = packets[i];
        p.t += dt;
        if (p.t >= p.dur) { arrive(blips[p.to]); packets.splice(i, 1); }
      }

      /* pings excite any contact their ring passes through */
      for (let i = pings.length - 1; i >= 0; i--) {
        const p = pings[i];
        p.t += dt;
        const u = Math.min(1, p.t / PING_S);
        const R = maxR * (1 - (1 - u) * (1 - u));
        for (const b of blips) {
          const br = b.r * maxR;
          if (br > p.r && br <= R) { b.glow = Math.max(b.glow, 0.7); b.echo = 0; }
        }
        p.r = R;
        if (p.t >= PING_S) pings.splice(i, 1);
      }

      for (let i = flashes.length - 1; i >= 0; i--) {
        flashes[i].t += dt;
        if (flashes[i].t > 1.6) flashes.splice(i, 1);
      }

      /* occasional glyph mutation — the field quietly rewrites itself */
      mutT += dt;
      const g = G;
      if (mutT > 1.6 && g) {
        mutT = 0;
        const r = (Math.random() * g.rows) | 0;
        const c = (Math.random() * g.cols) | 0;
        g.cells[r][c] = Math.random() < 0.35 ? randHex() : '';
        drawGlyphCell(c, r, Math.random() < 0.1);
      }

      draw(simT);

      if (ts - statT > 700) { statT = ts; emit(); }
    };

    /* ---------- input ---------- */
    const measureHero = () => {
      const hr = heroEl?.getBoundingClientRect();
      heroSeen = !!hr && hr.bottom > 0 && hr.top < H;
      heroOn = !!hr && hr.bottom > 0 && ptr.y <= hr.bottom;
    };
    const onMove = (e: PointerEvent) => {
      px = (e.clientX / window.innerWidth - 0.5) * 2;
      py = (e.clientY / window.innerHeight - 0.5) * 2;
      if (e.pointerType === 'touch') return;
      ptr.x = e.clientX; ptr.y = e.clientY;
      measureHero();
    };
    const onLeave = () => { heroOn = false; ptr.x = -999; ptr.y = -999; };
    const onScroll = () => measureHero();
    const onDown = (e: PointerEvent) => {
      if (!heroSeen || pings.length >= 3) return;
      const t = e.target as Element | null;
      if (t?.closest?.('a,button,input,textarea,select,summary,[role="button"]')) return;
      pings.push({ t: 0, r: 0 });
    };

    function resize(force = false) {
      const nw = window.innerWidth, nh = window.innerHeight;
      /* mobile URL-bar show/hide fires resize constantly — ignore small height shifts */
      if (!force && W && nw === W && Math.abs(nh - H) < 64) return;
      dpr = Math.min(dprCap, window.devicePixelRatio || 1);
      W = nw; H = nh;
      cv!.width = Math.round(W * dpr);
      cv!.height = Math.round(H * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      maxR = Math.min(W, H) * 1.05;

      if (VIGNETTE > 0) {
        vig = ctx!.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.55);
        vig.addColorStop(0, 'rgba(6,7,6,0)');
        vig.addColorStop(1, `rgba(6,7,6,${VIGNETTE})`);
      }

      buildGlyphs();
      if (!blips.length) build();   // contacts are normalised — no need to re-roll on resize
      measureHero();
      if (reduced) renderStatic();
    }
    const onResize = () => {
      window.clearTimeout(resizeT);
      resizeT = window.setTimeout(() => resize(), 120);
    };

    const io = new IntersectionObserver(es => {
      es.forEach(en => {
        if (!en.isIntersecting) return;
        const id = en.target.getAttribute('data-shot') as ShotId | null;
        if (id && SHOTS[id] && SHOTS[id] !== shot) {
          shot = SHOTS[id];
          if (reduced) renderStatic();
          else if (pings.length < 3) pings.push({ t: 0, r: 0 });
        }
      });
    }, { rootMargin: '-40% 0px -40% 0px' });
    document.querySelectorAll('[data-shot]').forEach(el => io.observe(el));

    if (!reduced) {
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerdown', onDown, { passive: true });
      document.documentElement.addEventListener('pointerleave', onLeave);
      window.addEventListener('scroll', onScroll, { passive: true });
    }
    window.addEventListener('resize', onResize);
    resize(true);
    if (!reduced) raf = requestAnimationFrame(frame);   // reduced motion: draw once, no loop

    document.fonts.ready.then(() => {
      if (disposed) return;
      buildGlyphs();
      if (reduced) renderStatic();
    }).catch(() => {});

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(resizeT);
      io.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, [reduced]);

  return <canvas className="field" ref={ref} aria-hidden="true" />;
}