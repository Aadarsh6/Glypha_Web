import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  advance, fastForward, initStage, isFinished,
  PEERS, type NodeId, type PeerId, type SimState, type Stage,
} from '../../data/sim';
import { useReducedMotion } from '../../hooks';

function snapshot(d: SimState): SimState {
  return { ...d, status: { ...d.status }, announce: { ...d.announce }, compare: { ...d.compare } };
}

export function useNetworkSimulation(container: RefObject<HTMLElement>) {
  const reduced = useReducedMotion();
  // Keep the initial state in React state so render does not read from a ref.
  const [initial] = useState<SimState>(() => initStage(1));
  const ref = useRef<SimState>(initial);

  const [snap, setSnap] = useState<SimState>(() => snapshot(initial));
  const [t, setT] = useState(0);
  const visibleRef = useRef(false);
  const startedRef = useRef(false);

  const commit = useCallback(() => {
    setSnap(snapshot(ref.current!));
    setT(ref.current!.t);
  }, []);

  const goto = useCallback((n: Stage, autoplay = true) => {
    ref.current = initStage(n);
    const d = ref.current;
    if (autoplay) {
      d.started = true;
      startedRef.current = true;
      if (reduced) fastForward(d);
      else d.playing = true;
    }
    commit();
  }, [reduced, commit]);

  /* visibility: pause the sim off-screen, autoplay once when first seen */
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const io = new IntersectionObserver(es => {
      visibleRef.current = es[0].isIntersecting;
      if (es[0].isIntersecting && !startedRef.current) {
        startedRef.current = true;
        const d = ref.current!;
        d.started = true;
        if (reduced) fastForward(d);
        else d.playing = true;
        commit();
      }
    }, { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, [container, reduced, commit]);

  /* the clock */
  useEffect(() => {
    let raf = 0;
    let last: number | null = null;
    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      if (last == null) last = ts;
      const dt = Math.min(50, ts - last);
      last = ts;
      if (!visibleRef.current) return;
      const d = ref.current!;
      const changed = advance(d, dt);
      if (changed) commit();
      else setT(d.t); // same value when paused → React bails out, no re-render
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [commit]);

  const toggle = useCallback(() => {
    const d = ref.current!;
    if (isFinished(d)) { goto(d.stage, true); return; }
    if (reduced) { fastForward(d); commit(); return; }
    d.playing = !d.playing;
    d.started = true;
    startedRef.current = true;
    commit();
  }, [reduced, commit, goto]);

  const replay = useCallback(() => goto(ref.current!.stage, true), [goto]);
  const reset = useCallback(() => goto(1, true), [goto]);

  const select = useCallback((id: NodeId) => {
    const d = ref.current!;
    if (id === 'C' && d.stage !== 1) return;
    d.selected = id;
    commit();
  }, [commit]);

  const runComparison = useCallback(() => {
    const d = ref.current!;
    const k = d.selected;
    if (d.stage !== 2 || !k || k === 'C' || d.compare.running || d.status[k] === 'VERIFIED') return;
    const P = PEERS[k as PeerId];

    if (reduced) {
      d.compare = { peer: k, rows: P.fp.length, running: false };
      d.status = { ...d.status, [k]: 'VERIFIED' as const };
      d.log = [
        ...d.log,
        { id: d.ids++, t: d.t, tag: 'VERIFY', msg: `${P.name}: comparing local fingerprint vs trusted channel` },
        { id: d.ids++, t: d.t, tag: 'OK', kind: 'ok', msg: `${P.name}: 8/8 groups match — identity verified` },
      ];
      commit();
      return;
    }

    d.compare = { peer: k, rows: 0, running: true };
    d.log = [...d.log, { id: d.ids++, t: d.t, tag: 'VERIFY', msg: `${P.name}: comparing local fingerprint vs trusted channel` }];
    commit();

    const total = P.fp.length;
    let i = 0;
    const step = () => {
      const dd = ref.current!;
      if (dd.compare.peer !== k || !dd.compare.running) return; // stage changed mid-run
      i++;
      dd.compare = { ...dd.compare, rows: i };
      if (i >= total) {
        dd.compare = { peer: k, rows: i, running: false };
        dd.status = { ...dd.status, [k]: 'VERIFIED' as const };
        dd.log = [...dd.log, { id: dd.ids++, t: dd.t, tag: 'OK', kind: 'ok', msg: `${P.name}: 8/8 groups match — identity verified` }];
      }
      commit();
      if (i < total) window.setTimeout(step, 170);
    };
    window.setTimeout(step, 350);
  }, [reduced, commit]);

  const transmit = useCallback((text: string) => {
    const d = ref.current!;
    if (d.stage !== 3) return;
    const clean = (text.trim() || 'see you at 19:00').slice(0, 60);
    d.queue = [...d.queue, clean];
    if (reduced) {
      d.playing = true;
      advance(d, 99999);
      commit();
    } else {
      d.playing = true;
      d.started = true;
      commit();
    }
  }, [reduced, commit]);

  return { snap, t, goto, toggle, replay, reset, select, runComparison, transmit };
}