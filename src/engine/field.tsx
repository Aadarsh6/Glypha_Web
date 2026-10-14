import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../hooks';

export type ShotId = 'hero' | 'stack' | 'ladder' | 'notes' | 'security' | 'quickstart' | 'source';

interface Shot { dim: number; rate: number; band: number; observer: boolean }

const SHOTS: Record<ShotId, Shot> = {
  hero:       { dim: 0.06, rate: 1.0,  band: 1.0,  observer: false },
  quickstart: { dim: 0.50, rate: 0.45, band: 0.55, observer: false },
  ladder:     { dim: 0.42, rate: 0.85, band: 0.8,  observer: false },
  stack:      { dim: 0.50, rate: 0.45, band: 0.6,  observer: false },
  notes:      { dim: 0.54, rate: 0.35, band: 0.5,  observer: false },
  security:   { dim: 0.44, rate: 1.5,  band: 1.25, observer: true },
  source:     { dim: 0.18, rate: 0.8,  band: 0.9,  observer: false },
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
// This module intentionally exports the stats subscription alongside Field.
// eslint-disable-next-line react-refresh/only-export-components
export function onFieldStats(fn: StatsFn): () => void {
  statsFns.add(fn);
  return () => { statsFns.delete(fn); };
}

const HEX = '0123456789ABCDEF';
const MARGIN = 28;

/* The hidden text the lens decrypts. Real facts from the project. */
const SECRET = [
  'the code is right. the networks refuse.',
  'direct failed. traversal failed. relay.',
  'keys stay local. relay when NATs say no.',
  'X25519 key exchange, XSalsa20-Poly1305 seal',
  'frame = [4-byte length][payload]',
  'a frame over 1 MiB is rejected before allocation',
  'the relay has no crypto library installed',
  'peer verified against pinned key',
  'every layer is readable python',
  '22 tests. 45 lines of framing.',
  'no accounts. your keys are your identity.',
  'educational. honest. deliberately not signal.',
].map(s => s + '   //   ');

const hc = (r: number, c: number) => (((Math.imul(r, 73856093) ^ Math.imul(c, 19349663)) >>> 0) % 1000) / 1000;
const LENS_CW = 8.2, LENS_CH = 17;

interface Layer {
  cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D;
  cellW: number; cellH: number; cols: number; rows: number; w: number; h: number;
  cells: string[][]; tint: boolean[][];
  font: string; baseRGB: string; baseA: number;
  tintRGB: string; tintA: number;
  empty: number; pair: boolean; mult: number;
  px: number; py: number;
}

interface Hot { l: number; c: number; r: number; age: number }
/* fate: 'drop' packets hit a wall and die red, 'relay' packets turn green and get through */
interface Pkt { row: number; col: number; dir: number; len: number; v: number; turn: number; drop: boolean; dying: number }

export function Field() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    let W = 0, H = 0, dpr = 1;
    let layers: Layer[] = [];
    let hot: Hot[] = [];
    let pkts: Pkt[] = [];
    let raf = 0;
    let last = 0, mutT = 0, spawnT = 0, bandT = 0, statT = 0, spawnCount = 0;
    let dirty = true;
    let tx = 0, ty = 0;
    const lens = { x: -999, y: -999, mx: -999, my: -999, a: 0, t: 0, r: 150 };

    const cur = { dim: SHOTS.hero.dim, obs: 0 };
    let shot: Shot = SHOTS.hero;

    const rand = (rng: () => number, empty: number, pair: boolean): string => {
      if (rng() < empty) return '';
      if (pair) return HEX[(rng() * 16) | 0] + HEX[(rng() * 16) | 0];
      return HEX[(rng() * 16) | 0];
    };

    const drawLayerCell = (L: Layer, c: number, r: number) => {
      const ch = L.cells[r][c];
      L.ctx.clearRect(c * L.cellW, r * L.cellH, L.cellW, L.cellH);
      if (!ch) return;
      L.ctx.fillStyle = L.tint[r][c]
        ? `rgba(${L.tintRGB},${L.tintA})`
        : `rgba(${L.baseRGB},${L.baseA})`;
      L.ctx.fillText(ch, c * L.cellW + L.cellW / 2, r * L.cellH + L.cellH / 2);
    };

    const makeLayer = (
      rng: () => number,
      size: number, cellW: number, cellH: number,
      empty: number, pair: boolean,
      baseRGB: string, baseA: number,
      tintRGB: string, tintA: number, tintP: number,
      mult: number,
    ): Layer => {
      const font = `500 ${size}px "JetBrains Mono", monospace`;
      const cols = Math.ceil((W + MARGIN * 2) / cellW);
      const rows = Math.ceil((H + MARGIN * 2) / cellH);
      const w = cols * cellW, h = rows * cellH;
      const lcv = document.createElement('canvas');
      lcv.width = Math.round(w * dpr);
      lcv.height = Math.round(h * dpr);
      const lctx = lcv.getContext('2d')!;
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lctx.font = font;
      lctx.textAlign = 'center';
      lctx.textBaseline = 'middle';
      const L: Layer = {
        cv: lcv, ctx: lctx, cellW, cellH, cols, rows, w, h,
        cells: [], tint: [], font, baseRGB, baseA, tintRGB, tintA,
        empty, pair, mult, px: 0, py: 0,
      };
      for (let r = 0; r < rows; r++) {
        L.cells.push([]); L.tint.push([]);
        for (let c = 0; c < cols; c++) {
          const ch = rand(rng, empty, pair);
          L.cells[r].push(ch);
          L.tint[r].push(ch !== '' && rng() < tintP);
        }
      }
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) drawLayerCell(L, c, r);
      return L;
    };

    const buildLayers = () => {
      const rng = mulberry32(0x676c7970); // "glyp"
      layers = [
        makeLayer(rng, 9, 20, 17, 0.24, false, '174,182,173', 0.05, '103,221,161', 0.08, 0.02, 4),
        makeLayer(rng, 13, 30, 24, 0.14, true, '233,236,231', 0.07, '103,221,161', 0.10, 0.03, 8),
      ];
      hot = []; pkts = [];
      lens.r = Math.max(105, Math.min(170, W * 0.11));
      if (layers[1]) statsFns.forEach(f => f({ nodes: layers[1].cols * layers[1].rows, pkt: 0 }));
    };

    /* the decryption lens: ciphertext under the cursor resolves into plaintext */
    const drawLens = (ts: number) => {
      if (lens.a < 0.01) return;
      const { x, y, r: R, a } = lens;
      const g = ctx.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, `rgba(6,7,6,${(0.78 * a).toFixed(3)})`);
      g.addColorStop(0.7, `rgba(6,7,6,${(0.45 * a).toFixed(3)})`);
      g.addColorStop(1, 'rgba(6,7,6,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - R, y - R, R * 2, R * 2);
      ctx.font = '500 13px "JetBrains Mono", monospace';
      const tick = Math.floor(ts / 90);
      const r0 = Math.floor((y - R) / LENS_CH), r1 = Math.ceil((y + R) / LENS_CH);
      const c0 = Math.floor((x - R) / LENS_CW), c1 = Math.ceil((x + R) / LENS_CW);
      for (let r = r0; r <= r1; r++) {
        const line = SECRET[((r % SECRET.length) + SECRET.length) % SECRET.length];
        for (let c = c0; c <= c1; c++) {
          const px = c * LENS_CW + LENS_CW / 2, py = r * LENS_CH + LENS_CH / 2;
          const d = Math.hypot(px - x, py - y);
          if (d >= R) continue;
          const ch = line[(((c + r * 5) % line.length) + line.length) % line.length];
          if (ch === ' ') continue;
          const t = 1 - d / R;
          const th = hc(r, c) * 0.55 + 0.05; // each cell resolves at its own depth: ragged edge
          if (t > th) {
            const fresh = t - th < 0.07; // just decrypted: flash green
            ctx.fillStyle = fresh
              ? `rgba(103,221,161,${(0.9 * a).toFixed(3)})`
              : `rgba(233,236,231,${((0.4 + 0.6 * t) * a).toFixed(3)})`;
            ctx.fillText(ch, px, py);
          } else {
            ctx.fillStyle = `rgba(103,221,161,${((0.18 + 0.5 * t) * a).toFixed(3)})`;
            ctx.fillText(HEX[(((hc(r, c) * 1000) | 0) + tick) % 16], px, py);
          }
        }
      }
    };

    const draw = (ts: number) => {
      ctx.clearRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (const L of layers) {
        ctx.drawImage(L.cv, -MARGIN + L.px, -MARGIN + L.py, L.w, L.h);
      }

      /* hot cells — mutation flickers */
      for (const h of hot) {
        const L = layers[h.l];
        const ch = L.cells[h.r][h.c];
        if (!ch) continue;
        const a = 0.22 * Math.max(0, 1 - h.age / 0.7);
        ctx.font = L.font;
        ctx.fillStyle = `rgba(${L.baseRGB},${a.toFixed(3)})`;
        ctx.fillText(ch,
          -MARGIN + L.px + h.c * L.cellW + L.cellW / 2,
          -MARGIN + L.py + h.r * L.cellH + L.cellH / 2);
      }

      /* packets — blue while trying, then red (refused, dies) or green (relay, gets through) */
      const pr = Math.round(103 + (231 - 103) * cur.obs);
      const pg = Math.round(221 + (184 - 221) * cur.obs);
      const pb = Math.round(161 + (109 - 161) * cur.obs);
      if (layers[1]) {
        const L = layers[1];
        for (const p of pkts) {
          const fade = p.drop ? Math.max(0, 1 - p.dying / 0.9) : 1;
          for (let i = 0; i < p.len; i++) {
            const c = Math.round(p.col) - p.dir * i;
            if (c < 0 || c >= L.cols) continue;
            const ch = L.cells[p.row][c];
            if (!ch) continue;
            const a = (0.85 * Math.pow(1 - i / p.len, 1.4) + 0.05) * fade;
            const crossed = p.dir > 0 ? c >= p.turn : c <= p.turn;
            const rgb = !crossed ? '110,155,255' : p.drop ? '255,122,89' : `${pr},${pg},${pb}`;
            ctx.font = L.font;
            ctx.fillStyle = `rgba(${rgb},${a.toFixed(3)})`;
            ctx.fillText(ch,
              -MARGIN + L.px + c * L.cellW + L.cellW / 2,
              -MARGIN + L.py + p.row * L.cellH + L.cellH / 2);
          }
        }
      }

      /* light band sweeping across the texture */
      if (!reduced) {
        const bandW = W * 0.55;
        const bandX = -bandW + ((bandT / 9) % 1) * (W + bandW * 2);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.translate(bandX, H / 2);
        ctx.rotate(-0.16);
        const g = ctx.createLinearGradient(-bandW / 2, 0, bandW / 2, 0);
        const br = Math.round(233 + (231 - 233) * cur.obs);
        const bg = Math.round(236 + (184 - 236) * cur.obs);
        const bb = Math.round(231 + (109 - 231) * cur.obs);
        const ba = 0.05 + 0.012 * cur.obs;
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(0.5, `rgba(${br},${bg},${bb},${ba.toFixed(3)})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(-bandW / 2, -H, bandW, H * 2);
        ctx.restore();
      }

      /* per-shot dim */
      ctx.fillStyle = `rgba(6,7,6,${cur.dim.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);

      /* lens sits above the dim so the message stays readable in dark sections */
      if (!reduced) drawLens(ts);
    };

    const frame = (ts: number) => {
      raf = requestAnimationFrame(frame);
      if (last === 0) last = ts;
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;

      if (reduced) {
        if (dirty) {
          cur.dim = shot.dim;
          cur.obs = shot.observer ? 1 : 0;
          draw(ts);
          dirty = false;
        }
        return;
      }

      /* pointer parallax — the two layers drift at different rates */
      for (const L of layers) {
        L.px += (tx * L.mult - L.px) * 0.06;
        L.py += (ty * L.mult * 0.6 - L.py) * 0.06;
      }
      lens.x += (lens.mx - lens.x) * 0.2;
      lens.y += (lens.my - lens.y) * 0.2;
      lens.a += (lens.t - lens.a) * 0.12;

      /* mutations — a few cells rewrite themselves */
      mutT += dt;
      if (mutT > 0.26) {
        mutT = 0;
        for (let l = 0; l < layers.length; l++) {
          const L = layers[l];
          const r = (Math.random() * L.rows) | 0;
          const c = (Math.random() * L.cols) | 0;
          L.cells[r][c] = rand(Math.random, L.empty, L.pair);
          drawLayerCell(L, c, r);
          hot.push({ l, c, r, age: 0 });
        }
        if (hot.length > 48) hot.splice(0, hot.length - 48);
      }
      for (let i = hot.length - 1; i >= 0; i--) {
        hot[i].age += dt;
        if (hot[i].age > 0.7) hot.splice(i, 1);
      }

      /* packets */
      spawnT += dt;
      const interval = 1.4 / shot.rate;
      if (spawnT > interval && pkts.length < 6 && layers.length > 1) {
        spawnT = 0; spawnCount++;
        const L = layers[1];
        const dir = Math.random() < 0.5 ? 1 : -1;
        pkts.push({
          row: (Math.random() * L.rows) | 0,
          col: dir > 0 ? -1 : L.cols,
          dir,
          len: 10 + ((Math.random() * 9) | 0),
          v: 12 + Math.random() * 8,
          turn: L.cols * (0.25 + Math.random() * 0.5),
          drop: Math.random() < 0.4,
          dying: 0,
        });
      }
      if (layers[1]) {
        const L = layers[1];
        for (let i = pkts.length - 1; i >= 0; i--) {
          const p = pkts[i];
          const crossed = p.dir > 0 ? p.col >= p.turn : p.col <= p.turn;
          if (p.drop && crossed) {
            p.col = p.turn; p.dying += dt; // refused: freezes at the wall, then fades
            if (p.dying > 0.9) pkts.splice(i, 1);
            continue;
          }
          p.col += p.dir * p.v * dt;
          if (p.dir > 0 && p.col - p.len > L.cols) pkts.splice(i, 1);
          else if (p.dir < 0 && p.col + p.len < 0) pkts.splice(i, 1);
        }
      }

      bandT += dt * shot.band;
      cur.dim += (shot.dim - cur.dim) * 0.035;
      cur.obs += ((shot.observer ? 1 : 0) - cur.obs) * 0.045;

      draw(ts);

      if (ts - statT > 600) {
        statT = ts;
        if (layers[1]) {
          const s: Stats = { nodes: layers[1].cols * layers[1].rows, pkt: Math.round(spawnCount * 1.67) };
          statsFns.forEach(f => f(s));
        }
        spawnCount = 0;
      }
    };

    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
      if (e.pointerType === 'touch') return; // the lens is a mouse/pen thing
      if (lens.t === 0) { lens.x = e.clientX; lens.y = e.clientY; }
      lens.mx = e.clientX; lens.my = e.clientY;
      // the lens lives in the negative space: it steps aside for real content
      const onContent = (e.target as Element | null)?.closest?.('a,button,input,textarea,h1,h2,h3,h4,p,li,pre,.term,.natbox');
      lens.t = onContent ? 0 : 1;
    };
    const onLeave = () => { lens.t = 0; };

    const resize = () => {
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      buildLayers();
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
    }
    window.addEventListener('resize', resize);
    resize();
    raf = requestAnimationFrame(frame);

    /* re-render once JetBrains Mono has actually loaded */
    document.fonts.ready.then(() => { buildLayers(); dirty = true; }).catch(() => {});

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('resize', resize);
    };
  }, [reduced]);

  return <canvas className="field" ref={ref} aria-hidden="true" />;
}