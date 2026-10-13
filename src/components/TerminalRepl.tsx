import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../hooks';
import { Icon } from './ui';
import { BOOT, COMMANDS, nextHint, runCommand, type RLine, type RState } from '../data/repl';

const LINE_MS = 70;

function LineView({ L }: { L: RLine }) {
  if (L.kind === 'sp') return <div className="ln ln-sp">&nbsp;</div>;
  if (L.kind === 'cmd' || L.kind === 'user') {
    return <div className="ln ln-cmd"><span className="p">$</span><span className="tx">{L.text}</span></div>;
  }
  if (L.kind === 'sys') {
    return <div className="ln ln-sys"><span className="k">[{(L.key ?? '').padEnd(8, ' ')}]</span>{L.text}</div>;
  }
  return <div className={`ln ln-${L.kind}`}>{L.text}</div>;
}

export function TerminalRepl() {
  const reduced = useReducedMotion();
  const termRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [lines, setLines] = useState<RLine[]>([]);
  const [queue, setQueue] = useState<RLine[]>([]);
  const [value, setValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [replState, setReplState] = useState<RState>({ phase: 'fresh', sent: 0 });
  const [hasBooted, setHasBooted] = useState(false);
  const histIdx = useRef(-1);
  const stRef = useRef<RState>({ phase: 'fresh', sent: 0 });
  const booting = useRef(false);
  const autoRef = useRef(false);

  /* drain the output queue line by line */
  useEffect(() => {
    if (queue.length === 0) {
      if (booting.current) {
        booting.current = false;
        const nextState: RState = { phase: 'started', sent: 0 };
        stRef.current = nextState;
        setReplState(nextState);
        setHasBooted(true);
      }
      return;
    }
    const t = window.setTimeout(() => {
      setLines(prev => [...prev, queue[0]]);
      setQueue(q => q.slice(1));
    }, reduced ? 0 : LINE_MS);
    return () => window.clearTimeout(t);
  }, [queue, reduced]);

  /* autoplay boot once when scrolled into view */
  useEffect(() => {
    const el = termRef.current;
    if (!el) return;
    const io = new IntersectionObserver(es => {
      if (es[0].isIntersecting && !autoRef.current) {
        autoRef.current = true;
        io.disconnect();
        booting.current = true;
        setQueue(BOOT);
      }
    }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* keep newest line visible */
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length, queue.length]);

  const skip = () => {
    setLines(prev => [...prev, ...queue]);
    setQueue([]);
  };
  const replay = () => {
    setLines([]); setQueue([]); setValue('');
    const nextState: RState = { phase: 'fresh', sent: 0 };
    stRef.current = nextState;
    setReplState(nextState);
    booting.current = true; setHasBooted(false);
    setQueue(BOOT);
  };

  const streaming = queue.length > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = value;
    if (!raw.trim() || streaming) return;
    setValue('');
    setHistory(h => [...h, raw]);
    histIdx.current = -1;

    const low = raw.trim().toLowerCase();
    if (low === 'clear') { setLines([]); return; }
    if (low === 'history') {
      setLines(prev => [
        ...prev,
        { kind: 'user', text: raw },
        ...history.map(h => ({ kind: 'out' as const, text: `  ${h}` })),
      ]);
      return;
    }
    const res = runCommand(raw, stRef.current);
    stRef.current = res.state;
    setReplState(res.state);
    setLines(prev => [...prev, { kind: 'user', text: raw }]);
    setQueue(res.lines);
  };

  /* tab completion + history */
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const v = value.toLowerCase();
      if (!v) return;
      const pool = Object.keys(COMMANDS).filter(c => !COMMANDS[c].hidden);
      const cands = pool.filter(c => c.startsWith(v));
      if (cands.length === 1) setValue(cands[0] + ' ');
      else if (cands.length > 1) {
        let common = cands[0];
        for (const c of cands) while (!c.startsWith(common)) common = common.slice(0, -1);
        setValue(common);
      }
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (history.length === 0) return;
      if (e.key === 'ArrowUp') {
        histIdx.current = histIdx.current === -1 ? history.length - 1 : Math.max(0, histIdx.current - 1);
      } else {
        if (histIdx.current === -1) return;
        histIdx.current = Math.min(history.length - 1, histIdx.current + 1);
        if (histIdx.current === history.length - 1) { setValue(''); histIdx.current = -1; return; }
      }
      setValue(history[histIdx.current] ?? '');
    }
  };

  const hint = streaming ? '…' : nextHint(replState);

  return (
    <div className="term" ref={termRef} aria-label="Simulated interactive terminal">
      <div className="term-head">
        <div className="term-id"><i />glypha — demo shell</div>
        <span className="badge-sim"><i />SIMULATED</span>
      </div>

      <div
        className="term-body" ref={bodyRef} role="log" aria-live="polite"
        onClick={() => inputRef.current?.focus()}
      >
        {lines.map((L, i) => <LineView key={i} L={L} />)}
        {streaming && <span className="cursor" aria-hidden="true" />}

        <form className="repl-row" onSubmit={submit}>
          <span className="p">$</span>
          <input
            ref={inputRef} className="repl-input" value={value}
            onChange={e => setValue(e.target.value)} onKeyDown={onKeyDown}
            disabled={streaming}
            autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
            aria-label="Terminal input — type a command, or help"
            placeholder={hasBooted || !streaming ? '' : 'type `help`'}
          />
        </form>
      </div>

      <div className="term-foot">
        <div className="tctl">
          <button className="ibtn" onClick={replay} aria-label="Replay intro sequence">
            <Icon name="replay" size={13} />
          </button>
          <button className="ibtn" onClick={skip} disabled={!streaming} aria-label="Skip intro sequence">
            <Icon name="ext" size={13} />
          </button>
        </div>
        <div className="tmeta2">NEXT: <b>{hint}</b></div>
      </div>
    </div>
  );
}