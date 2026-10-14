import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../hooks';

export type ShotId = 'hero' | 'stack' | 'ladder' | 'notes' | 'security' | 'quickstart' | 'source';

interface Shot { yaw: number; pitch: number; dist: number; drift: number; observer: boolean; dim: number }

/* One camera shot per section — including how loud the field is behind the text. */
const SHOTS: Record<ShotId, Shot> = {
  hero:      { yaw: 0.55, pitch: 0.28, dist: 1.00, drift: 0.050, observer: false, dim: 0.42 },
  stack:     { yaw: -0.60, pitch: 0.35, dist: 1.15, drift: 0.030, observer: false, dim: 0.74 },
  ladder:    { yaw: 0.10, pitch: 0.50, dist: 0.80, drift: 0.022, observer: false, dim: 0.66 },
  notes:     { yaw: 1.40, pitch: 0.20, dist: 1.35, drift: 0.026, observer: false, dim: 0.76 },
  security:  { yaw: 0.00, pitch: 0.55, dist: 0.95, drift: 0.030, observer: true,  dim: 0.62 },
  quickstart:{ yaw: 0.80, pitch: 0.30, dist: 1.35, drift: 0.024, observer: false, dim: 0.78 },
  source:    { yaw: 2.60, pitch: 0.45, dist: 1.50, drift: 0.034, observer: false, dim: 0.52 },
};

const TAU = Math.PI * 2;

/* seeded PRNG — the field is identical on every load. authored, not random. */
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Stats { nodes: number; pkt: number }
type StatsFn = (s: Stats) => void;
const statsFns = new Set<StatsFn>();
export function onFieldStats(fn: StatsFn): () => void {
  statsFns.add(fn);
  return () => { statsFns.delete(fn); };
}

interface N3 { x: number; y: number; z: number; peer: boolean; ang: number }
interface Packet { e: number; t: number; v: number }

/* the address space: four concentric rings */
const RINGS = [
  { r: 150, count: 10 },
  { r: 270, count: 16 },
  { r: 390, count: 22 },
  { r: 520, count: 30 },
];
const FOCAL = 640;
const BASE_Z = 700;

export function Field() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    let W = 0, H = 0;
    let nodes: N3[] = [];
    let edges: { a: number; b: number }[] = [];
    let spokes: number[] = [];
    let packets: Packet[] = [];
    let raf = 0;
    let last = 0, spawn = 0, spawnCount = 0, statTime = 0, driftA = 0, scanA = 0;
    let dirty = true;

    let cur = { yaw: SHOTS.hero.yaw, pitch: SHOTS.hero.pitch, dist: SHOTS.hero.dist, obs: 0, dim: SHOTS.hero.dim };
    let shot: Shot = SHOTS.hero;
    let tx = 0, ty = 0;

    const build = () => {
      const rng = mulberry32(0x676c7970); // "glyp"
      nodes = [];
      RINGS.forEach((ring, k) => {
        for (let i = 0; i < ring.count; i++) {
          const ang = (i / ring.count) * TAU + (rng() - 0.5) * 0.10;
          const r = ring.r + (rng() - 0.5) * 52;
          nodes.push({
            x: Math.cos(ang) * r,
            y: (rng() - 0.5) * 130,
            z: Math.sin(ang) * r,
            peer: rng() < 0.28,
            ang,
          });
        }
        void k;
      });

      edges = [];
      /* ring polygons — the visible structure */
      let base = 0;
      RINGS.forEach(ring => {
        for (let i = 0; i < ring.count; i++) {
          edges.push({ a: base + i, b: base + ((i + 1) % ring.count) });
        }
        base += ring.count;
      });
      /* radial ties between adjacent rings — deterministic web */
      for (let k = 0; k < RINGS.length - 1; k++) {
        const off = RINGS.slice(0, k).reduce((s, r) => s + r.count, 0);
        const offNext = off + RINGS[k].count;
        for (let i = 0; i < RINGS[k].count; i += 2) {
          const ang = (i / RINGS[k].count) * TAU;
          const j = Math.round((ang / TAU) * RINGS[k + 1].count) % RINGS[k + 1].count;
          edges.push({ a: off + i, b: offNext + j });
        }
      }

      spokes = nodes
        .map((n, i) => ({ i, d: n.x * n.x + n.y * n.y + n.z * n.z }))
        .sort((p, q) => p.d - q.d)
        .slice(0, 18)
        .map(v => v.i);
      packets = [];
    };

    const project = (x: number, y: number, z: number) => {
      const cy = Math.cos(cur.yaw), sy = Math.sin(cur.yaw);
      const cp = Math.cos(cur.pitch), sp = Math.sin(cur.pitch);
      const x1 = x * cy + z * sy;
      const z1 = -x * sy + z * cy;
      const y2 = y * cp - z1 * sp;
      const z2 = y * sp + z1 * cp;
      const s = FOCAL / (FOCAL + z2 + BASE_Z * cur.dist);
      return { sx: W / 2 + x1 * s, sy: H / 2 + y2 * s, s };
    };

    const mixAmber = (v: number) => Math.round(v + (231 - v) * cur.obs);

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1;

      /* ring guides — the form of the address space */
      ctx.strokeStyle = 'rgba(233,236,231,.05)';
      RINGS.forEach(ring => {
        ctx.beginPath();
        for (let i = 0; i <= 72; i++) {
          const a = (i / 72) * TAU;
          const p = project(Math.cos(a) * ring.r, 0, Math.sin(a) * ring.r);
          if (i === 0) ctx.moveTo(p.sx, p.sy); else ctx.lineTo(p.sx, p.sy);
        }
        ctx.stroke();
      });

      const proj = nodes.map(n => {
        const p = project(n.x, n.y, n.z);
        return { sx: p.sx, sy: p.sy, s: p.s, peer: n.peer, ang: n.ang };
      });

      /* edges */
      for (const e of edges) {
        const p = proj[e.a], q = proj[e.b];
        const s = (p.s + q.s) / 2;
        const a = Math.max(0, (s - 0.34) / 0.5) * 0.26;
        if (a <= 0.012) continue;
        ctx.strokeStyle = `rgba(233,236,231,${a.toFixed(3)})`;
        ctx.beginPath(); ctx.moveTo(p.sx, p.sy); ctx.lineTo(q.sx, q.sy); ctx.stroke();
      }

      /* scan sweep on the outer ring — the observatory sweep */
      const sr = RINGS[RINGS.length - 1].r;
      const a0 = scanA - 0.42, a1 = scanA;
      const scr = mixAmber(103), scg = mixAmber(221), scb = mixAmber(161);
      ctx.strokeStyle = `rgba(${scr},${scg},${scb},.22)`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let a = a0; a <= a1; a += 0.05) {
        const p = project(Math.cos(a) * sr, 0, Math.sin(a) * sr);
        if (a === a0) ctx.moveTo(p.sx, p.sy); else ctx.lineTo(p.sx, p.sy);
      }
      ctx.stroke();
      const hp = project(Math.cos(scanA) * sr, 0, Math.sin(scanA) * sr);
      ctx.fillStyle = `rgba(${scr},${scg},${scb},.55)`;
      ctx.beginPath(); ctx.arc(hp.sx, hp.sy, 2.2 * hp.s, 0, TAU); ctx.fill();
      ctx.lineWidth = 1;

      /* observer spokes + marker */
      if (cur.obs > 0.02) {
        const o = project(0, 0, 0);
        ctx.setLineDash([3, 6]);
        for (const ni of spokes) {
          const p = proj[ni];
          const a = 0.30 * cur.obs * Math.min(1, p.s);
          if (a <= 0.02) continue;
          ctx.strokeStyle = `rgba(231,184,109,${a.toFixed(3)})`;
          ctx.beginPath(); ctx.moveTo(o.sx, o.sy); ctx.lineTo(p.sx, p.sy); ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.fillStyle = `rgba(231,184,109,${(0.95 * cur.obs).toFixed(3)})`;
        ctx.fillRect(o.sx - 3.5 * o.s, o.sy - 3.5 * o.s, 7 * o.s, 7 * o.s);
        if (cur.obs > 0.6) {
          ctx.font = `500 ${Math.max(8, 9 * o.s)}px "JetBrains Mono", monospace`;
          ctx.fillStyle = `rgba(231,184,109,${(0.75 * cur.obs).toFixed(3)})`;
          ctx.textAlign = 'center';
          ctx.fillText('T H E   O B S E R V E R', o.sx, o.sy + 26 * o.s);
        }
      }

      /* packets */
      const cr = mixAmber(103), cg = mixAmber(221), cb = mixAmber(161);
      ctx.lineWidth = 1.4;
      for (const k of packets) {
        const p = proj[edges[k.e].a], q = proj[edges[k.e].b];
        const x = p.sx + (q.sx - p.sx) * k.t;
        const y = p.sy + (q.sy - p.sy) * k.t;
        const s = (p.s + q.s) / 2;
        const bt = Math.max(0, k.t - 0.12);
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},${(0.5 * s).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(p.sx + (q.sx - p.sx) * bt, p.sy + (q.sy - p.sy) * bt);
        ctx.lineTo(x, y); ctx.stroke();
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${(0.9 * s + 0.1).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(x, y, 2.1 * s, 0, TAU); ctx.fill();
      }

      /* nodes — brighten as the sweep passes: blips on a scope */
      for (const p of proj) {
        const d = Math.atan2(Math.sin(p.ang - scanA), Math.cos(p.ang - scanA));
        const boost = Math.max(0, 1 - Math.abs(d) / 0.25);
        const a = Math.max(0.06, (p.s - 0.3) / 0.55) + boost * 0.30;
        const r = ((p.peer ? 2.6 : 1.4) + boost * 0.9) * p.s;
        if (p.peer) {
          ctx.fillStyle = cur.obs > 0.5
            ? `rgba(231,184,109,${Math.min(1, 0.5 * a).toFixed(3)})`
            : `rgba(103,221,161,${Math.min(1, 0.32 + a * 0.5).toFixed(3)})`;
        } else {
          ctx.fillStyle = `rgba(174,182,173,${Math.min(1, a * 0.42).toFixed(3)})`;
        }
        ctx.beginPath(); ctx.arc(p.sx, p.sy, r, 0, TAU); ctx.fill();
      }

      /* per-shot dim — the readability guarantee, drawn by the engine itself */
      ctx.fillStyle = `rgba(6,7,6,${cur.dim.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    };

    const frame = (ts: number) => {
      raf = requestAnimationFrame(frame);
      if (last === 0) last = ts;
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;

      if (reduced) {
        if (dirty) {
          cur.yaw = shot.yaw; cur.pitch = shot.pitch; cur.dist = shot.dist;
          cur.obs = shot.observer ? 1 : 0; cur.dim = shot.dim;
          draw(); dirty = false;
        }
        return;
      }

      driftA += dt * shot.drift;
      scanA = (scanA + dt * 0.45) % TAU;
      cur.yaw += (shot.yaw + driftA + tx * 0.20 - cur.yaw) * 0.035;
      cur.pitch += (shot.pitch + ty * 0.10 - cur.pitch) * 0.035;
      cur.dist += (shot.dist - cur.dist) * 0.030;
      cur.obs += ((shot.observer ? 1 : 0) - cur.obs) * 0.045;
      cur.dim += (shot.dim - cur.dim) * 0.035;

      const rate = 620 - 360 * cur.obs;
      const maxP = 7 + Math.round(9 * cur.obs);
      if (ts - spawn > rate * (0.6 + Math.random() * 0.8) && packets.length < maxP && edges.length > 0) {
        spawn = ts; spawnCount++;
        packets.push({ e: (Math.random() * edges.length) | 0, t: 0, v: 0.45 + Math.random() * 0.5 });
      }
      for (let i = packets.length - 1; i >= 0; i--) {
        packets[i].t += packets[i].v * dt;
        if (packets[i].t >= 1) packets.splice(i, 1);
      }
      draw();

      if (ts - statTime > 600) {
        statTime = ts;
        const s: Stats = { nodes: nodes.length, pkt: Math.round(spawnCount * 1.67) };
        statsFns.forEach(f => f(s));
        spawnCount = 0;
      }
    };

    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
      statsFns.forEach(f => f({ nodes: nodes.length, pkt: 0 }));
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

    if (!reduced) window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('resize', resize);
    resize();
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', resize);
    };
  }, [reduced]);

  return <canvas className="field" ref={ref} aria-hidden="true" />;
}