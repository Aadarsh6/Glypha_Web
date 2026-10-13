import { useEffect, useRef, useState, memo, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { STAGES, type LogEntry, type Stage } from '../../data/sim';
import { onStageRequest } from '../../data/stageBus';
import { scrollToEl } from '../../lib/scroll';
import { useReducedMotion } from '../../hooks';
import { Icon, Reveal, SectionHeader } from '../ui';
import { useNetworkSimulation } from './useSim';
import { Topology } from './Topology';
import { Inspector } from './Inspector';

const EventLog = memo(function EventLog({ log, live }: { log: LogEntry[]; live: boolean }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log.length]);
  const count = log.filter(e => e.kind !== 'divider').length;
  return (
    <div className={`logp${live ? ' live' : ''}`}>
      <div className="logh">
        <span className="logdot" aria-hidden="true" />
        <span>EVENT LOG</span>
        <span className="logn">{count} events</span>
      </div>
      <div className="log-body" ref={ref} role="log" aria-label="Simulation event log">
        {log.map(e =>
          e.kind === 'divider' ? (
            <div key={e.id} className="ldiv">{e.msg}</div>
          ) : (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: reduced ? 0 : 0.2 }}
              className={`le ${e.kind ?? ''}`}
            >
              <span className="lt">t+{(e.t / 1000).toFixed(1)}s</span>
              <span className="lg">{e.tag}</span>
              <span className="lm">{e.msg}</span>
            </motion.div>
          ),
        )}
      </div>
    </div>
  );
});

export function NetworkLab() {
  const reduced = useReducedMotion();
  const labRef = useRef<HTMLDivElement>(null!);
  const sim = useNetworkSimulation(labRef);
  const { snap, t, goto, toggle, replay, reset, select, runComparison, transmit } = sim;
  const [tx, setTx] = useState('see you at 19:00');

  /* protocol-strip buttons deep-link into the lab (Lenis-aware) */
  useEffect(() => onStageRequest(n => {
    goto(n);
    scrollToEl(labRef.current);
  }), [goto]);

  const tabsRef = useRef<HTMLDivElement>(null);
  const onTabKeys = (e: ReactKeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const tabs = Array.from(tabsRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []);
    const i = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[n].focus();
    tabs[n].click();
  };

  const statusText = `stage 0${snap.stage} · ${snap.playing ? 'running' : snap.started ? 'paused' : 'idle'} · t+${(t / 1000).toFixed(1)}s`;

  return (
    <section id="how-it-works" className="hairtop">
      <div className="wrap">
        <SectionHeader
          index="01" label="Network lab"
          title="Watch a connection happen."
          lede="A scripted, offline simulation of Glypha's connection sequence. One shared state drives everything — the topology, the inspector, and the event log stay in sync as the connection forms, gets verified, and carries a message."
        />

        <Reveal>
          <div ref={labRef}>
            <div className="labbar">
              <div className="tabs" role="tablist" aria-label="Lab stages" ref={tabsRef} onKeyDown={onTabKeys}>
                {([1, 2, 3] as Stage[]).map(n => (
                  <button
                    key={n} className="tab" role="tab"
                    aria-selected={snap.stage === n}
                    onClick={() => goto(n)}
                  >
                    <b>0{n}</b>{['Discovery', 'Verification', 'Exchange'][n - 1]}
                  </button>
                ))}
              </div>
              <div className="tctrl">
                <span className="lstat">{statusText}</span>
                <button className="ibtn" onClick={toggle} aria-label={snap.playing ? 'Pause simulation' : 'Play simulation'}>
                  <Icon name={snap.playing ? 'pause' : 'play'} size={13} />
                </button>
                <button className="ibtn" onClick={replay} aria-label="Replay current stage">
                  <Icon name="replay" size={13} />
                </button>
                <button className="ibtn" onClick={reset} aria-label="Reset lab to stage one">
                  <Icon name="reset" size={13} />
                </button>
              </div>
            </div>

            <div className="grid items-start gap-4.5 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div>
                <div className="stagehead">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={snap.stage}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: reduced ? 0 : 0.22 }}
                    >
                      <p className="stage-k">STAGE 0{snap.stage} / 03</p>
                      <h3 className="stage-n">{STAGES[snap.stage].name}</h3>
                      <p className="stage-d">{STAGES[snap.stage].desc}</p>
                    </motion.div>
                  </AnimatePresence>
                </div>

                <Topology snap={snap} t={t} onSelect={select} />

                <form
                  className="txbar" hidden={snap.stage !== 3}
                  onSubmit={e => { e.preventDefault(); transmit(tx); }}
                >
                  <label className="txl" htmlFor="tx-input">TX · PLAINTEXT</label>
                  <input
                    id="tx-input" maxLength={60} value={tx}
                    autoComplete="off" spellCheck={false}
                    onChange={e => setTx(e.target.value)}
                  />
                  <button type="submit" className="btn-s acc" style={{ marginTop: 0 }}>TRANSMIT</button>
                  <span className="txn">conceptual demo — your browser never runs the real cipher</span>
                </form>
              </div>

              <aside className="insp" aria-label="Node inspector">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={`${snap.stage}-${snap.selected ?? 'none'}`}
                    initial={{ opacity: 0, x: 6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -6 }}
                    transition={{ duration: reduced ? 0 : 0.2 }}
                  >
                    <Inspector snap={snap} onCompare={runComparison} />
                  </motion.div>
                </AnimatePresence>
              </aside>
            </div>

            <EventLog log={snap.log} live={snap.playing} />
            <p className="labnote">
              simulation only — no network connections, keys, or encryption are involved · all values illustrative
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}