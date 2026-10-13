import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../hooks';
import { Icon } from './ui';
import { TERMINAL_SCHED, TERMINAL_TOTAL, projectTerminal, type TermSlot } from '../data/terminal';

function Cursor() {
  return <span className="cursor" aria-hidden="true" />;
}

function LineView({ s, chars, cursor }: { s: TermSlot; chars?: number; cursor?: boolean }) {
  const L = s.line;
  if (L.type === 'sp') return <div className="ln ln-sp">&nbsp;</div>;
  if (L.type === 'cmd') {
    const txt = chars == null ? L.text : (L.text ?? '').slice(0, chars);
    return (
      <div className="ln ln-cmd">
        <span className="p">$</span><span className="tx">{txt}</span>
        {cursor ? <Cursor /> : null}
      </div>
    );
  }
  if (L.type === 'sys') {
    return (
      <div className="ln ln-sys">
        <span className="k">[{(L.key ?? '').padEnd(8, ' ')}]</span>{L.text}
        {cursor ? <Cursor /> : null}
      </div>
    );
  }
  return <div className={`ln ln-${L.type}`}>{L.text}{cursor ? <Cursor /> : null}</div>;
}

export function TerminalDemo() {
  const reduced = useReducedMotion();
  const termRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const tRef = useRef(0);
  const playingRef = useRef(false);
  const autoRef = useRef(false);

  const [st, setSt] = useState({ n: 0, chars: 0, done: false, playing: false, time: 0 });

  const apply = useCallback((playing: boolean) => {
    const p = projectTerminal(tRef.current);
    setSt({ ...p, playing, time: tRef.current });
  }, []);

  const skipToFull = useCallback(() => {
    tRef.current = TERMINAL_TOTAL + 1;
    playingRef.current = false;
    apply(false);
  }, [apply]);

  const replay = useCallback(() => {
    tRef.current = 0;
    if (reduced) { skipToFull(); return; }
    playingRef.current = true;
    apply(true);
  }, [apply, reduced, skipToFull]);

  const toggle = useCallback(() => {
    if (projectTerminal(tRef.current).done) { replay(); return; }
    if (reduced) { skipToFull(); return; }
    playingRef.current = !playingRef.current;
    apply(playingRef.current);
  }, [apply, reduced, replay, skipToFull]);

  /* engine — one clock for the whole terminal */
  useEffect(() => {
    let raf = 0;
    let last: number | null = null;
    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      if (last == null) last = ts;
      const dt = Math.min(50, ts - last);
      last = ts;
      if (!playingRef.current) return;
      tRef.current += dt;
      const p = projectTerminal(tRef.current);
      if (p.done) playingRef.current = false;
      setSt({ ...p, playing: playingRef.current, time: tRef.current });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* autoplay when scrolled into view */
  useEffect(() => {
    const el = termRef.current;
    if (!el) return;
    const io = new IntersectionObserver(es => {
      if (es[0].isIntersecting && !autoRef.current) {
        autoRef.current = true;
        io.disconnect();
        if (reduced) skipToFull();
        else { playingRef.current = true; apply(true); }
      }
    }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, [apply, reduced, skipToFull]);

  /* keep the body scrolled to the newest line */
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [st.n, st.done]);

  const cur = !st.done ? TERMINAL_SCHED[st.n] : null;

  return (
    <div className="term" ref={termRef} aria-label="Simulated terminal demonstration">
      <div className="term-head">
        <div className="term-id"><i />glypha — demo session</div>
        <span className="badge-sim"><i />SIMULATED</span>
      </div>

      <div className="term-body" ref={bodyRef}>
        {TERMINAL_SCHED.slice(0, st.n).map((s, i) => <LineView key={i} s={s} />)}
        {cur ? <LineView key={st.n} s={cur} chars={st.chars} cursor /> : null}
        {st.done ? (
          <div className="ln ln-cmd">
            <span className="p">$</span><span className="tx" /><Cursor />
          </div>
        ) : null}
      </div>

      <div className="term-foot">
        <div className="tctl">
          <button className="ibtn" onClick={toggle} disabled={st.done} aria-label={st.playing ? 'Pause terminal demo' : 'Play terminal demo'}>
            <Icon name={st.playing ? 'pause' : 'play'} size={13} />
          </button>
          <button className="ibtn" onClick={replay} aria-label="Replay terminal demo">
            <Icon name="replay" size={13} />
          </button>
          <button className="ibtn" onClick={skipToFull} aria-label="Skip to full output">
            <Icon name="ext" size={13} />
          </button>
        </div>
        <div className="tmeta2">
          <b>L {String(st.n).padStart(2, '0')} / {TERMINAL_SCHED.length}</b> · t+{String(Math.floor(Math.min(st.time, TERMINAL_TOTAL) / 1000)).padStart(2, '0')}s
        </div>
      </div>
    </div>
  );
}