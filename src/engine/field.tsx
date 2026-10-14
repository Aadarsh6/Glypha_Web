import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../hooks';

console.log('[glypha field] v4 · rendezvous radar loaded');

export type ShotId = 'hero' | 'stack' | 'ladder' | 'notes' | 'security' | 'quickstart' | 'source';

interface Shot { dim: number; observer: boolean }

const SHOTS: Record<ShotId, Shot> = {
  hero:       { dim: 0.10, observer: false },
  quickstart: { dim: 0.56, observer: false },
  ladder:     { dim: 0.48, observer: false },
  stack:      { dim: 0.56, observer: false },
  notes:      { dim: 0.60, observer: false },
  security:   { dim: 0.52, observer: true  },
  source:     { dim: 0.24, observer: false },
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
const C_INK = '233,236,231';

/* what a hovered contact identifies itself as */
const LABELS = [
  '10.0.4.12:4310', '172.19.8.5:34059', '203.0.113.7:7000', '192.168.1.23:9999',
  '157.49.119.123:7001', '10.1.9.7:4310', '172.20.3.44:34059', '198.51.100.9:7000',
];

interface Blip { r: number; th: number; glow: number; echo: number; label: string; la: number }

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
    let raf = 0;
    let last = 0, sweepA = 0, statT = 0;
    let dirty = true;
    let tx = 0, ty = 0;
    let heroOn = false;
    const ptr = { x: -999, y: -999 };

    let curDim = SHOTS.hero.dim, curObs = 0;
    let shot: Shot = SHOTS.hero;

    const heroEl = document.getElementById('hero');

    const build = () => {
      const rng = mulberry32(0x676c7970); // "glyp"
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

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1;

      const mr = Math.round(103 + (231 - 103) * curObs);
      const mg = Math.round(221 + (184 - 221) * curObs);
      const mb = Math.round(161 + (109 - 161) * curObs);

      /* range rings — cropped by the viewport, so the composition never centers */
      ctx.strokeStyle = `rgba(${C_INK},.045)`;
      for (const f of [0.2, 0.42, 0.66, 0.92]) {
        ctx.beginPath(); ctx.arc(ox, oy, maxR * f, 0, TAU); ctx.stroke();
      }

      /* the origin — the rendezvous point */
      ctx.fillStyle = `rgba(${mr},${mg},${mb},.4)`;
      ctx.beginPath(); ctx.arc(ox, oy, 2.2, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(${mr},${mg},${mb},.18)`;
      ctx.beginPath(); ctx.arc(ox, oy, 7, 0, TAU); ctx.stroke();

      /* the sweep — a fan of fading rays behind the leading edge */
      const FAN = 42;
      for (let i = 0; i < FAN; i++) {
        const a = sweepA - i * 0.0125;
        const al = 0.05 * Math.pow(1 - i / FAN, 2);
        ctx.strokeStyle = `rgba(${mr},${mg},${mb},${al.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox + Math.cos(a) * maxR, oy + Math.sin(a) * maxR);
        ctx.stroke();
      }
      ctx.strokeStyle = `rgba(${mr},${mg},${mb},.11)`;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + Math.cos(sweepA) * maxR, oy + Math.sin(sweepA) * maxR);
      ctx.stroke();

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

        /* identification — hero only, on approach */
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
          draw(); dirty = false;
        }
        return;
      }

      sweepA = (sweepA + (TAU / SWEEP_S) * dt) % TAU;
      ox += (W * 0.62 - tx * 9 - ox) * 0.04;
      oy += (H * 0.38 - ty * 6 - oy) * 0.04;
      curDim += (shot.dim - curDim) * 0.035;
      curObs += ((shot.observer ? 1 : 0) - curObs) * 0.045;

      for (const b of blips) {
        /* flare the moment the beam crosses the contact */
        const d = Math.atan2(Math.sin(b.th - sweepA), Math.cos(b.th - sweepA));
        if (d > 0 && d < 0.05) { b.glow = 1; b.echo = 0; }
        b.glow *= Math.pow(0.5, dt / 1.15);
        if (b.echo >= 0) { b.echo += dt; if (b.echo > 2.4) b.echo = -1; }

        const bx = ox + Math.cos(b.th) * b.r * maxR;
        const by = oy + Math.sin(b.th) * b.r * maxR;
        const near = heroOn && Math.hypot(ptr.x - bx, ptr.y - by) < 90;
        b.la += ((near ? 1 : 0) - b.la) * 0.12;
      }

      draw();

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