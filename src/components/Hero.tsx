import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useReducedMotion } from '../hooks';
import { Icon, CopyButton } from './ui';

/* ---- ladder schedule: log strings quoted verbatim from the glypha client ---- */
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
    <div ref={boxRef}>
      <div className="ladder">
        <div className="term-head">
          <div className="term-id"><i />connection ladder — live attempt</div>
          <span className="badge-sim"><i />SIMULATED RUN · REAL STRINGS</span>
        </div>

        <svg className="lad-svg" viewBox="0 0 720 470" role="img"
          aria-label="The connection ladder: direct fails at NAT, coordinated punch fails, relay fallback connects">
          {/* peers */}
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

          {/* rung 1 — DIRECT */}
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

          {/* rung 2 — PUNCH */}
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

          {/* rung 3 — RELAY */}
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

        <div className="ladder-log" role="log" aria-live="polite" aria-label="Connection attempt log">
          {logs.map((l, i) => (
            <div key={i} className={`ln ${l.kind === 'ok' ? 'ln-ok' : 'ln-sys'}`}>{l.text}</div>
          ))}
          {running && <span className="cursor" aria-hidden="true" />}
        </div>

        <div className="term-foot">
          <button className="ibtn" onClick={start} aria-label="Replay the connection attempt">
            <Icon name="replay" size={13} />
          </button>
          <span className="tmeta2">you never choose a transport — the ladder does</span>
        </div>
      </div>
      <p className="ladder-note">log strings quoted from the glypha 2.3.0 client · topology illustrative</p>
    </div>
  );
}

export function Hero() {
  const reduced = useReducedMotion();
  return (
    <section id="hero" className="hero2">
      <div className="fpweave" aria-hidden="true">
        <span>7F3A 9C1B 42DE 0817 E5C0 61AA 3B9D F2E4</span>
        <span>61AA 3B9D F2E4 7F3A 9C1B 42DE 0817 E5C0</span>
        <span>7F3A 9C1B 42DE 0817 E5C0 61AA 3B9D F2E4</span>
      </div>

      <div className="wrap hero2-grid">
        <div className="hero2-copy">
          <p className="kicker">GLYPHA v2.3.0 · PEER-TO-PEER ENCRYPTED CHAT · IMPLEMENTED BY HAND</p>

          <motion.h1
            initial={reduced ? false : { opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.21, 0.6, 0.2, 1] }}
          >
            Sockets up. Keys local.
            <span className="l2">Relay when NATs say no.</span>
          </motion.h1>

          <p className="hero2-sub">
            Glypha builds its own chat stack in readable Python — message framing, X25519 identity,
            AEAD encryption, discovery, NAT traversal, blind relay, encrypted history. Every layer
            implemented, not imported. Deliberately not Signal.
          </p>

          <div className="cta-row">
            <a className="btn btn-primary" href="#quickstart">Get started</a>
            <a className="btn btn-ghost" href="https://github.com/Aadarsh6/GLYPHA" target="_blank" rel="noopener">
              <Icon name="github" size={16} />Read the source
            </a>
          </div>

          <div className="inst">
            <span className="ip">$</span><code>pip install glypha</code>
            <CopyButton text="pip install glypha" label="install command" />
          </div>

          <div className="h2facts">
            <span>X25519 + XSALSA20-POLY1305</span>
            <span>TOFU + KEY PINNING</span>
            <span>ENCRYPTED SQLITE HISTORY</span>
            <span>22 TESTS</span>
            <span>MIT</span>
          </div>
        </div>

        <div className="hero2-ladder">
          <LadderMachine />
        </div>
      </div>
    </section>
  );
}