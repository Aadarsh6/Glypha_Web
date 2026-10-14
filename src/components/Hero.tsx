import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useReducedMotion } from '../hooks';
import { Icon, CopyButton } from './ui';

/* ============================================================
   HeroField — a 3D network, perspective-projected on canvas.
   Peers (green nodes) drift in address space; encrypted bytes
   travel the edges. Pointer tilts the camera. No libraries.
   ============================================================ */
function HeroField() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const hero = cv.parentElement as HTMLElement;

    interface N3 { x: number; y: number; z: number; peer: boolean }
    let nodes: N3[] = [];
    let edges: { a: number; b: number }[] = [];
    let packets: { e: number; t: number; v: number }[] = [];

    let W = 0, H = 0;
    let raf = 0;
    let running = false;
    let baseYaw = 0.4, yaw = 0.4, pitch = 0;
    let px = 0, py = 0, mx = 0, my = 0;
    let last = 0, spawn = 0;

    const WORLD = { w: 950, h: 560, d: 900 };
    const FOCAL = 640;
    const ZOFF = 720;
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);

    const build = () => {
      const area = Math.max(1, cv.clientWidth * cv.clientHeight);
      const count = Math.max(64, Math.min(148, Math.round(area / 8500)));
      nodes = [];
      for (let i = 0; i < count; i++) {
        nodes.push({
          x: rnd(-WORLD.w, WORLD.w),
          y: rnd(-WORLD.h, WORLD.h),
          z: rnd(-WORLD.d / 2, WORLD.d / 2),
          peer: false,
        });
      }
      const step = Math.max(1, Math.floor(count / 5));
      for (let i = 2; i < count; i += step) nodes[i].peer = true;

      const LINK = 300, L2 = LINK * LINK;
      const cand: { a: number; b: number; d2: number }[] = [];
      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dz = nodes[i].z - nodes[j].z;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < L2) cand.push({ a: i, b: j, d2 });
        }
      }
      cand.sort((p, q) => p.d2 - q.d2);
      edges = cand.slice(0, 380).map(c => ({ a: c.a, b: c.b }));
      packets = [];
    };

    const resize = () => {
      const r = hero.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width; H = r.height;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
      if (reduced) draw(0);
    };

    interface P2 { sx: number; sy: number; s: number; peer: boolean }

    const project = (n: N3): P2 => {
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      const x1 = n.x * cy + n.z * sy;
      const z1 = -n.x * sy + n.z * cy;
      const y2 = n.y * cp - z1 * sp;
      const z2 = n.y * sp + z1 * cp;
      const s = FOCAL / (FOCAL + z2 + ZOFF);
      return { sx: W / 2 + x1 * s, sy: H / 2 + y2 * s, s, peer: n.peer };
    };

    const draw = (dt: number) => {
      ctx.clearRect(0, 0, W, H);
      const proj = nodes.map(project);

      ctx.lineWidth = 1;
      for (const e of edges) {
        const p = proj[e.a], q = proj[e.b];
        const s = (p.s + q.s) / 2;
        const a = Math.max(0, (s - 0.33) / 0.5) * 0.34;
        if (a <= 0.01) continue;
        ctx.strokeStyle = `rgba(233,236,231,${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(p.sx, p.sy);
        ctx.lineTo(q.sx, q.sy);
        ctx.stroke();
      }

      for (const p of proj) {
        const a = Math.max(0.06, (p.s - 0.3) / 0.55);
        const r = (p.peer ? 2.6 : 1.5) * p.s;
        ctx.fillStyle = p.peer
          ? `rgba(103,221,161,${(0.35 + a * 0.55).toFixed(3)})`
          : `rgba(174,182,173,${(a * 0.5).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r, 0, 7);
        ctx.fill();
      }

      ctx.lineWidth = 1.4;
      for (let i = packets.length - 1; i >= 0; i--) {
        const k = packets[i];
        k.t += k.v * dt;
        if (k.t >= 1) { packets.splice(i, 1); continue; }
        const p = proj[edges[k.e].a], q = proj[edges[k.e].b];
        const x = p.sx + (q.sx - p.sx) * k.t;
        const y = p.sy + (q.sy - p.sy) * k.t;
        const s = (p.s + q.s) / 2;
        const bx = p.sx + (q.sx - p.sx) * Math.max(0, k.t - 0.12);
        const by = p.sy + (q.sy - p.sy) * Math.max(0, k.t - 0.12);
        ctx.strokeStyle = `rgba(103,221,161,${(0.5 * s).toFixed(3)})`;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(x, y); ctx.stroke();
        ctx.fillStyle = `rgba(103,221,161,${(0.9 * s + 0.1).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(x, y, 2.2 * s, 0, 7); ctx.fill();
      }
    };

    const frame = (ts: number) => {
      raf = requestAnimationFrame(frame);
      if (last === 0) last = ts;
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      if (!running || reduced) return;
      baseYaw += dt * 0.045;
      px += (mx - px) * 0.05;
      py += (my - py) * 0.05;
      yaw = baseYaw + px * 0.22;
      pitch = py * 0.12;
      if (ts - spawn > 620 && packets.length < 9 && edges.length > 0) {
        spawn = ts;
        packets.push({ e: (Math.random() * edges.length) | 0, t: 0, v: 0.5 + Math.random() * 0.5 });
      }
      draw(dt);
    };

    const onMove = (e: PointerEvent) => {
      const r = hero.getBoundingClientRect();
      mx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      my = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    const onLeave = () => { mx = 0; my = 0; };

    const io = new IntersectionObserver(es => {
      running = es[0].isIntersecting && !reduced;
    });
    io.observe(hero);

    if (!reduced) {
      hero.addEventListener('pointermove', onMove, { passive: true });
      hero.addEventListener('pointerleave', onLeave);
    }
    window.addEventListener('resize', resize);
    resize();
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      hero.removeEventListener('pointermove', onMove);
      hero.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('resize', resize);
    };
  }, [reduced]);

  return <canvas id="hero-field" ref={ref} aria-hidden="true" />;
}

/* ============================================================
   LadderMachine — DIRECT → PUNCH → RELAY, log strings quoted
   verbatim from the glypha client. Chrome-less: no outer box.
   ============================================================ */
interface SchedItem { at: number; step?: number; log?: { text: string; kind?: 'ok' }; done?: boolean }
const SCHED: SchedItem[] = [
  { at: 150, log: { text: "• reaching 'bob' via glypha.duckdns.org..." } },
  { at: 600, step: 1, log: { text: '• trying direct to 203.0.113.7:34059...' } },
  { at: 2200, step: 2, log: { text: '• direct failed — trying NAT traversal...' } },
  { at: 2600, step: 3 },
  { at: 4600, step: 4, log: { text: '• traversal failed — falling back to relay...' } },
  { at: 5000, step: 5 },
  { at: 5600, log: { text: "● 'bob' verified against pinned key", kind: 'ok' } },
  { at: 6200, step: 6, log: { text: '● connected via relay', kind: 'ok' }, done: true },
];
const ALL_LOGS = SCHED.filter(s => s.log).map(s => s.log!);

type RState = 'idle' | 'trying' | 'failed' | 'dialing' | 'live';

function LadderMachine() {
  const reduced = useReducedMotion();
  const boxRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const started = useRef(false);

  const [step, setStep] = useState(0);
  const [logs, setLogs] = useState<{ text: string; kind?: 'ok' }[]>([]);
  const [running, setRunning] = useState(false);

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  const finalize = useCallback(() => {
    setStep(6); setLogs(ALL_LOGS); setRunning(false);
  }, []);

  const start = useCallback(() => {
    clear(); setStep(0); setLogs([]);
    if (reduced) { finalize(); return; }
    setRunning(true);
    SCHED.forEach(s => timers.current.push(window.setTimeout(() => {
      if (s.step !== undefined) setStep(s.step);
      if (s.log) setLogs(l => [...l, s.log!]);
      if (s.done) setRunning(false);
    }, s.at)));
  }, [reduced, finalize]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const io = new IntersectionObserver(es => {
      if (es[0].isIntersecting && !started.current) {
        started.current = true; io.disconnect(); start();
      }
    }, { threshold: 0.25 });
    io.observe(el);
    return () => { io.disconnect(); clear(); };
  }, [start]);

  const rstate = (i: 1 | 2 | 3): RState => {
    if (i === 1) return step >= 2 ? 'failed' : step >= 1 ? 'trying' : 'idle';
    if (i === 2) return step >= 4 ? 'failed' : step >= 3 ? 'trying' : 'idle';
    return step >= 6 ? 'live' : step >= 5 ? 'dialing' : 'idle';
  };
  const cls = (i: 1 | 2 | 3) => `rung r${i} ${rstate(i)}`;

  const STATUS: Record<number, Record<RState, string>> = {
    1: { idle: '', trying: 'dialing 203.0.113.7:34059', failed: '✗ NAT REJECTED', dialing: '', live: '' },
    2: { idle: '', trying: 'simultaneous open', failed: '✗ NO SYN DELIVERY', dialing: '', live: '' },
    3: { idle: '', trying: '', failed: '', dialing: 'dialing out · both peers', live: '✓ CONNECTED' },
  };
  const scls = (s: RState) => `lst ${s === 'trying' || s === 'dialing' ? 'try' : s}`;

  return (
    <div ref={boxRef} className="lad">
      <div className="lad-top">
        <div className="lad-label"><i />CONNECTION LADDER · LIVE ATTEMPT</div>
        <span className="badge-sim"><i />SIMULATED</span>
      </div>

      <svg className="lad-svg" viewBox="0 0 720 470" role="img"
        aria-label="The connection ladder: direct fails at NAT, coordinated punch fails, relay fallback connects">
        <g>
          <rect x="14" y="64" width="112" height="352" rx="10" className="pbox" />
          <text x="70" y="98" textAnchor="middle" className="pname">ALICE</text>
          <text x="70" y="116" textAnchor="middle" className="psub">peer · you</text>
          <text x="70" y="386" textAnchor="middle" className="pfp">7F3A 9C1B</text>
          <text x="70" y="400" textAnchor="middle" className="pfp">42DE 0817</text>
        </g>
        <g>
          <rect x="594" y="64" width="112" height="352" rx="10" className="pbox" />
          <text x="650" y="98" textAnchor="middle" className="pname">BOB</text>
          <text x="650" y="116" textAnchor="middle" className="psub">peer</text>
          <text x="650" y="386" textAnchor="middle" className="pfp">61AA 3B9D</text>
          <text x="650" y="400" textAnchor="middle" className="pfp">F2E4 7F3A</text>
        </g>

        <g className={cls(1)}>
          <path className="pth" d="M126 110 H540" />
          <path className="pth ghost" d="M540 110 H594" />
          <line className="barrier" x1="540" y1="88" x2="540" y2="132" />
          <text x="547" y="86" className="blabel">NAT</text>
          <text x="360" y="94" textAnchor="middle" className="rlabel">01 · DIRECT</text>
          <text x="360" y="132" textAnchor="middle" className={scls(rstate(1))}>{STATUS[1][rstate(1)]}</text>
          {rstate(1) === 'trying' && !reduced && (
            <circle r="3.5" className="ldot">
              <animateMotion dur="1.4s" fill="freeze" path="M126 110 H540" />
            </circle>
          )}
          {rstate(1) === 'failed' && (
            <g className="failx">
              <line x1="533" y1="103" x2="547" y2="117" />
              <line x1="547" y1="103" x2="533" y2="117" />
            </g>
          )}
        </g>

        <g className={cls(2)}>
          <path className="pth" d="M126 235 Q 243 168 360 235" />
          <path className="pth" d="M594 235 Q 477 168 360 235" />
          <line className="barrier" x1="230" y1="194" x2="230" y2="264" />
          <line className="barrier" x1="490" y1="194" x2="490" y2="264" />
          <text x="237" y="192" className="blabel">NAT</text>
          <text x="497" y="192" className="blabel">NAT</text>
          <text x="360" y="264" textAnchor="middle" className="rlabel">02 · TCP PUNCH</text>
          <text x="360" y="282" textAnchor="middle" className={scls(rstate(2))}>{STATUS[2][rstate(2)]}</text>
          {rstate(2) === 'trying' && !reduced && (
            <>
              <circle r="3.5" className="ldot">
                <animateMotion dur="1.9s" fill="freeze" path="M126 235 Q 185 190 230 203" />
              </circle>
              <circle r="3.5" className="ldot">
                <animateMotion dur="1.9s" fill="freeze" path="M594 235 Q 535 190 490 203" />
              </circle>
            </>
          )}
          {rstate(2) === 'failed' && (
            <>
              <g className="failx"><line x1="224" y1="197" x2="236" y2="209" /><line x1="236" y1="197" x2="224" y2="209" /></g>
              <g className="failx"><line x1="484" y1="197" x2="496" y2="209" /><line x1="496" y1="197" x2="484" y2="209" /></g>
            </>
          )}
        </g>

        <g className={cls(3)}>
          <path className="pth" d="M126 360 H336" />
          <path className="pth" d="M384 360 H594" />
          <rect x="336" y="336" width="48" height="48" rx="8" className="relaybox" />
          <text x="360" y="357" textAnchor="middle" className="pname sm">RELAY</text>
          <text x="360" y="371" textAnchor="middle" className="psub">blind</text>
          <text x="360" y="400" textAnchor="middle" className="blabel">no keys · no parse</text>
          <text x="231" y="344" textAnchor="middle" className="rlabel">03 · RELAY</text>
          <text x="489" y="344" textAnchor="middle" className={scls(rstate(3))}>{STATUS[3][rstate(3)]}</text>

          {rstate(3) === 'dialing' && !reduced && (
            <>
              <circle r="3.5" className="ldot"><animateMotion dur="0.8s" fill="freeze" path="M126 360 H336" /></circle>
              <circle r="3.5" className="ldot"><animateMotion dur="0.8s" fill="freeze" path="M594 360 H384" /></circle>
            </>
          )}
          {rstate(3) === 'live' && !reduced && (
            <>
              <rect width="7" height="7" rx="1.5" className="byte"><animateMotion dur="1.7s" repeatCount="indefinite" path="M126 356.5 H336" /></rect>
              <rect width="7" height="7" rx="1.5" className="byte"><animateMotion dur="1.7s" begin="0.55s" repeatCount="indefinite" path="M384 356.5 H594" /></rect>
              <rect width="7" height="7" rx="1.5" className="byte"><animateMotion dur="1.7s" begin="0.9s" repeatCount="indefinite" path="M594 363.5 H384" /></rect>
              <rect width="7" height="7" rx="1.5" className="byte"><animateMotion dur="1.7s" begin="1.35s" repeatCount="indefinite" path="M336 363.5 H126" /></rect>
            </>
          )}
        </g>
      </svg>

      <div className="lad-log" role="log" aria-live="polite" aria-label="Connection attempt log">
        {logs.map((l, i) => (
          <div key={i} className={`ln ${l.kind === 'ok' ? 'ln-ok' : 'ln-sys'}`}>{l.text}</div>
        ))}
        {running && <span className="cursor" aria-hidden="true" />}
      </div>

      <div className="lad-foot">
        <button className="ibtn" onClick={start} aria-label="Replay the connection attempt">
          <Icon name="replay" size={13} />
        </button>
        <span className="tmeta2">you never choose a transport — the ladder does</span>
      </div>
    </div>
  );
}

export function Hero() {
  const reduced = useReducedMotion();
  return (
    <section id="hero" className="hero3">
      <HeroField />
      <div className="field-fade" aria-hidden="true" />

      <div className="wrap hero3-grid">
        <div className="hero3-copy">
          <p className="kicker">GLYPHA · PEER-TO-PEER ENCRYPTED CHAT · IMPLEMENTED BY HAND</p>

          <motion.h1
            initial={reduced ? false : { opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.21, 0.6, 0.2, 1] }}
          >
            Sockets up. Keys local.
            <span className="l2">Relay when NATs say no.</span>
          </motion.h1>

          <p className="hero3-sub">
            Glypha builds its own chat stack in readable Python — message framing, X25519 identity,
            AEAD encryption, peer discovery, NAT traversal, blind relay, encrypted history.
            Every layer implemented, not imported. Deliberately not Signal.
          </p>

          <div className="cta-row">
            <a className="btn btn-primary" href="#quickstart">Get started</a>
            <a className="tlink" href="https://github.com/Aadarsh6/GLYPHA" target="_blank" rel="noopener">
              Read the source<Icon name="arrow" size={14} />
            </a>
          </div>

          <div className="inst">
            <span className="ip">$</span><code>pip install glypha</code>
            <CopyButton text="pip install glypha" label="install command" />
          </div>

          <div className="h3facts">
            <span>X25519 + XSALSA20-POLY1305</span>
            <span>TOFU + KEY PINNING</span>
            <span>ENCRYPTED SQLITE HISTORY</span>
            <span>22 TESTS</span>
            <span>MIT</span>
          </div>
        </div>

        <div className="hero3-ladder">
          <LadderMachine />
          <p className="lad-note">log strings quoted from the glypha client · topology illustrative</p>
        </div>
      </div>
    </section>
  );
}