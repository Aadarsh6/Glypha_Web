import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../hooks';

export type ShotId = 'hero' | 'stack' | 'ladder' | 'notes' | 'security' | 'quickstart' | 'source';

interface Shot { yaw: number; pitch: number; dist: number; drift: number; observer: boolean; dim: number }

/* dim lowered everywhere — the field stays visible behind text, just quieter */
const SHOTS: Record<ShotId, Shot> = {
  hero:      { yaw: 0.55, pitch: 0.34, dist: 1.02, drift: 0.050, observer: false, dim: 0.20 },
  stack:     { yaw: -0.60, pitch: 0.35, dist: 1.15, drift: 0.030, observer: false, dim: 0.52 },
  ladder:    { yaw: 0.10, pitch: 0.50, dist: 0.82, drift: 0.022, observer: false, dim: 0.44 },
  notes:     { yaw: 1.40, pitch: 0.20, dist: 1.35, drift: 0.026, observer: false, dim: 0.56 },
  security:  { yaw: 0.00, pitch: 0.55, dist: 0.95, drift: 0.030, observer: true,  dim: 0.46 },
  quickstart:{ yaw: 0.80, pitch: 0.30, dist: 1.35, drift: 0.024, observer: false, dim: 0.56 },
  source:    { yaw: 2.60, pitch: 0.45, dist: 1.50, drift: 0.034, observer: false, dim: 0.24 },
};

const TAU = Math.PI * 2;

/* seeded PRNG — identical field on every load */
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

/* Each ring: own radius, center offset, two plane tilts, eccentricity.
   The anti-symmetry lives here. */
interface Ring { r: number; count: number; cx: number; cz: number; tx: number; tz: number; ecc: number; yAmp: number }
const RINGS: Ring[] = [
  { r: 175, count: 12, cx: 70,  cz: 50,  tx: 0.00,  tz: 0.30,  ecc: 0.86, yAmp: 30 },
  { r: 305, count: 18, cx: -95, cz: -40, tx: -0.38, tz: 0.10,  ecc: 1.02, yAmp: 46 },
  { r: 435, count: 26, cx: 120, cz: -85, tx: 0.16,  tz: -0.52, ecc: 0.92, yAmp: 66 },
  { r: 585, count: 34, cx: -50, cz: 100, tx: -0.22, tz: 0.42,  ecc: 1.06, yAmp: 86 },
];
const OUTER = RINGS[RINGS.length - 1];
const FOCAL = 640;
const BASE_Z = 700;

/* point on a ring: circle -> tilt around x -> tilt around z -> offset */
function ringPoint(ring: Ring, ang: number, yJit = 0) {
  const lx = Math.cos(ang) * ring.r * ring.ecc;
  const lz = Math.sin(ang) * ring.r;
  const ctx_ = Math.cos(ring.tx), stx = Math.sin(ring.tx);
  const y1 = -lz * stx;
  const z1 = lz * ctx_;
  const ctz = Math.cos(ring.tz), stz = Math.sin(ring.tz);
  const x2 = lx * ctz - y1 * stz;
  const y2 = lx * stz + y1 * ctz;
  return { x: x2 + ring.cx, y: y2 + yJit, z: z1 + ring.cz };
}

interface N3 { x: number; y: number; z: number; peer: boolean; ang: number }
interface Packet { e: number; t: number; v: number }

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
      const offsets: number[] = [];
      RINGS.forEach(ring => {
        offsets.push(nodes.length);
        for (let i = 0; i < ring.count; i++) {
          const ang = (i / ring.count) * TAU + (rng() - 0.5) * 0.12;
          const p = ringPoint(ring, ang, (rng() - 0.5) * ring.yAmp);
          nodes.push({ x: p.x, y: p.y, z: p.z, peer: rng() < 0.3, ang });
        }
      });

      edges = [];
      /* ring polygons */
      RINGS.forEach((ring, k) => {
        const off = offsets[k];
        for (let i = 0; i < ring.count; i++) {
          edges.push({ a: off + i, b: off + ((i + 1) % ring.count) });
        }
      });
      /* ties between adjacent rings, angle-matched */
      for (let k = 0; k < RINGS.length - 1; k++) {
        const off = offsets[k], offNext = offsets[k + 1];
        for (let i = 0; i < RINGS[k].count; i += 2) {
          const ang = (i / RINGS[k].count) * TAU;
          const j = Math.round((ang / TAU) * RINGS[k + 1].count) % RINGS[k + 1].count;
          edges.push({ a: off + i, b: offNext + j });
        }
      }
      /* a few long diagonals — inner to outer ring, keeps it from feeling layered */
      for (let i = 0; i < RINGS[0].count; i += 4) {
        const ang = (i / RINGS[0].count) * TAU;
        const j = Math.round((ang / TAU) * OUTER.count) % OUTER.count;
        edges.push({ a: offsets[0] + i, b: offsets[RINGS.length - 1] + j });
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

      /* ring guides — each in its own tilted plane */
      ctx.strokeStyle = 'rgba(233,236,231,.06)';
      RINGS.forEach(ring => {
        ctx.beginPath();
        for (let i = 0; i <= 96; i++) {
          const a = (i / 96) * TAU;
          const p = project.apply?.call?.(null); // placeholder removed below
          void p;
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
        const a = Math.max(0, (s - 0.34) / 0.5) * 0.30;
        if (a <= 0.012) continue;
        ctx.strokeStyle = `rgba(233,236,231,${a.toFixed(3)})`;
        ctx.beginPath(); ctx.moveTo(p.sx, p.sy); ctx.lineTo(q.sx, q.sy); ctx.stroke();
      }

      /* scan sweep on the outer ring */
      const scr = mixAmber(103), scg = mixAmber(221), scb = mixAmber(161);
      ctx.strokeStyle = `rgba(${scr},${scg},${scb},.25)`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let a = scanA - 0.5; a <= scanA; a += 0.04) {
        const q = ringPoint(OUTER, a);
        const p = project(q.x, q.y, q.z);
        if (a <= scanA - 0.5 + 0.001) ctx.moveTo(p.sx, p.sy); else ctx.lineTo(p.sx, p.sy);
      }
      ctx.stroke();
      const hq = ringPoint(OUTER, scanA);
      const hp = project(hq.x, hq.y, hq.z);
      ctx.fillStyle = `rgba(${scr},${scg},${scb},.6)`;
      ctx.beginPath(); ctx.arc(hp.sx, hp.sy, 2.4 * hp.s, 0, TAU); ctx.fill();
      ctx.lineWidth = 1;

      /* observer spokes */
      if (cur.obs > 0.02) {
        const o = project(20, -30, 30);
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

      /* nodes — blips that flare as the sweep passes */
      for (const p of proj) {
        const d = Math.atan2(Math.sin(p.ang - scanA), Math.cos(p.ang - scanA));
        const boost = Math.max(0, 1 - Math.abs(d) / 0.25);
        const a = Math.max(0.06, (p.s - 0.3) / 0.55) + boost * 0.34;
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

      /* per-shot dim — quieter behind text, present everywhere */
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