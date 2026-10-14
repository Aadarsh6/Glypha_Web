import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../hooks';

export type ShotId = 'hero' | 'stack' | 'ladder' | 'notes' | 'security' | 'quickstart' | 'source';

interface Shot { yaw: number; pitch: number; dist: number; drift: number; observer: boolean }

/* Camera shots — one per section. This is the knob to tune the feel. */
const SHOTS: Record<ShotId, Shot> = {
  hero:      { yaw: 0.45, pitch: -0.06, dist: 1.00, drift: 0.040, observer: false },
  stack:     { yaw: -0.55, pitch: 0.18, dist: 1.12, drift: 0.030, observer: false },
  ladder:    { yaw: 0.12, pitch: 0.34, dist: 0.72, drift: 0.022, observer: false },
  notes:     { yaw: 1.35, pitch: -0.28, dist: 1.38, drift: 0.026, observer: false },
  security:  { yaw: 0.10, pitch: 0.02, dist: 1.06, drift: 0.030, observer: true },
  quickstart:{ yaw: 0.70, pitch: 0.12, dist: 1.30, drift: 0.024, observer: false },
  source:    { yaw: 2.40, pitch: 0.42, dist: 1.55, drift: 0.034, observer: false },
};

export interface Stats { nodes: number; pkt: number }
type StatsFn = (s: Stats) => void;
const statsFns = new Set<StatsFn>();

export function onFieldStats(fn: StatsFn): () => void {
  statsFns.add(fn);
  return () => { statsFns.delete(fn); };
}

interface N3 { x: number; y: number; z: number; peer: boolean }
interface Packet { e: number; t: number; v: number }

const WORLD = { w: 980, h: 560, d: 900 };
const FOCAL = 640;
const BASE_Z = 700;
const OBS = { x: 0, y: 300, z: 480 };

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
    let last = 0, spawn = 0, spawnCount = 0, statTime = 0, driftA = 0;
    let dirty = true;

    let cur = { yaw: SHOTS.hero.yaw, pitch: SHOTS.hero.pitch, dist: SHOTS.hero.dist, obs: 0 };
    let shot: Shot = SHOTS.hero;
    let tx = 0, ty = 0;

    const rnd = (a: number, b: number) => a + Math.random() * (b - a);

    const build = () => {
      const area = Math.max(1, cv.clientWidth * cv.clientHeight);
      const count = Math.max(70, Math.min(170, Math.round(area / 9000)));
      nodes = [];
      for (let i = 0; i < count; i++) {
        nodes.push({
          x: rnd(-WORLD.w, WORLD.w), y: rnd(-WORLD.h, WORLD.h),
          z: rnd(-WORLD.d / 2, WORLD.d / 2), peer: i % 7 === 3,
        });
      }
      const LINK = 300, L2 = LINK * LINK;
      const cand: { a: number; b: number; d2: number }[] = [];
      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y, dz = nodes[i].z - nodes[j].z;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < L2) cand.push({ a: i, b: j, d2 });
        }
      }
      cand.sort((p, q) => p.d2 - q.d2);
      edges = cand.slice(0, 340).map(c => ({ a: c.a, b: c.b }));
      spokes = nodes
        .map((n, i) => ({ i, d: (n.x - OBS.x) ** 2 + (n.y - OBS.y) ** 2 + (n.z - OBS.z) ** 2 }))
        .sort((p, q) => p.d - q.d)
        .slice(0, 16)
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

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1;

      /* graticule plane — the instrument feel */
      const gy = 360;
      ctx.strokeStyle = 'rgba(233,236,231,.045)';
      for (let x = -800; x <= 800; x += 200) {
        const p = project(x, gy, -450), q = project(x, gy, 450);
        ctx.beginPath(); ctx.moveTo(p.sx, p.sy); ctx.lineTo(q.sx, q.sy); ctx.stroke();
      }
      for (let z = -400; z <= 400; z += 200) {
        const p = project(-800, gy, z), q = project(800, gy, z);
        ctx.beginPath(); ctx.moveTo(p.sx, p.sy); ctx.lineTo(q.sx, q.sy); ctx.stroke();
      }

      const proj = nodes.map(n => {
        const p = project(n.x, n.y, n.z);
        return { sx: p.sx, sy: p.sy, s: p.s, peer: n.peer };
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

      /* observer spokes */
      if (cur.obs > 0.02) {
        const o = project(OBS.x, OBS.y, OBS.z);
        ctx.setLineDash([3, 6]);
        for (const ni of spokes) {
          const p = proj[ni];
          const a = 0.30 * cur.obs * Math.min(1, p.s);
          if (a <= 0.02) continue;
          ctx.strokeStyle = `rgba(231,184,109,${a.toFixed(3)})`;
          ctx.beginPath(); ctx.moveTo(o.sx, o.sy); ctx.lineTo(p.sx, p.sy); ctx.stroke();
        }
        ctx.setLineDash([]);
        const os = o.s;
        ctx.fillStyle = `rgba(231,184,109,${(0.95 * cur.obs).toFixed(3)})`;
        ctx.fillRect(o.sx - 3.5 * os, o.sy - 3.5 * os, 7 * os, 7 * os);
        if (cur.obs > 0.6) {
          ctx.font = `500 ${Math.max(8, 9 * os)}px "JetBrains Mono", monospace`;
          ctx.fillStyle = `rgba(231,184,109,${(0.75 * cur.obs).toFixed(3)})`;
          ctx.textAlign = 'center';
          ctx.fillText('T H E   O B S E R V E R', o.sx, o.sy - 12 * os);
        }
      }

      /* packets */
      const cr = Math.round(103 + (231 - 103) * cur.obs);
      const cg = Math.round(221 + (184 - 221) * cur.obs);
      const cb = Math.round(161 + (109 - 161) * cur.obs);
      ctx.lineWidth = 1.4;
      for (const k of packets) {
        const p = proj[edges[k.e].a], q = proj[edges[k.e].b];
        const x = p.sx + (q.sx - p.sx) * k.t;
        const y = p.sy + (q.sy - p.sy) * k.t;
        const s = (p.s + q.s) / 2;
        const bt = Math.max(0, k.t - 0.12);
        const bx = p.sx + (q.sx - p.sx) * bt;
        const by = p.sy + (q.sy - p.sy) * bt;
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},${(0.5 * s).toFixed(3)})`;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(x, y); ctx.stroke();
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${(0.9 * s + 0.1).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(x, y, 2.1 * s, 0, 7); ctx.fill();
      }

      /* nodes */
      for (const p of proj) {
        const a = Math.max(0.06, (p.s - 0.3) / 0.55);
        if (p.peer) {
          const mix = cur.obs;
          const r = Math.round(103 + (231 - 103) * 0);
          ctx.fillStyle = mix > 0.5
            ? `rgba(231,184,109,${(0.55 * a).toFixed(3)})`
            : `rgba(103,221,161,${(0.35 + a * 0.5).toFixed(3)})`;
          void r;
          ctx.beginPath(); ctx.arc(p.sx, p.sy, 2.6 * p.s, 0, 7); ctx.fill();
        } else {
          ctx.fillStyle = `rgba(174,182,173,${(a * 0.42).toFixed(3)})`;
          ctx.beginPath(); ctx.arc(p.sx, p.sy, 1.4 * p.s, 0, 7); ctx.fill();
        }
      }
    };

    const frame = (ts: number) => {
      raf = requestAnimationFrame(frame);
      if (last === 0) last = ts;
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;

      if (reduced) {
        if (dirty) { draw(); dirty = false; }
        return;
      }

      driftA += dt * shot.drift;
      const tYaw = shot.yaw + driftA + tx * 0.20;
      const tPitch = shot.pitch + ty * 0.10;
      cur.yaw += (tYaw - cur.yaw) * 0.035;
      cur.pitch += (tPitch - cur.pitch) * 0.035;
      cur.dist += (shot.dist - cur.dist) * 0.030;
      cur.obs += ((shot.observer ? 1 : 0) - cur.obs) * 0.045;

      const rate = 650 - 380 * cur.obs;
      const maxP = 8 + Math.round(10 * cur.obs);
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

  return (
    <>
      <canvas className="field" ref={ref} aria-hidden="true" />
      <div className="field-veil" aria-hidden="true" />
    </>
  );
}