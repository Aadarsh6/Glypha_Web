import { useEffect, useRef, useState, memo } from 'react';
import { STAGES, type LogEntry, type Stage } from '../../data/sim';
import { onStageRequest } from '../../data/stageBus';
import { useReducedMotion } from '../../hooks';
import { Icon, Reveal, SectionHeader } from '../ui';
import { useNetworkSimulation } from './useSim';
import { Topology } from './Topology';
import { Inspector } from './Inspector';

const EventLog = memo(function EventLog({ log, live }: { log: LogEntry[]; live: boolean }) {
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
            <div key={e.id} className={`le ${e.kind ?? ''}`}>
              <span className="lt">t+{(e.t / 1000).toFixed(1)}s</span>
              <span className="lg">{e.tag}</span>
              <span className="lm">{e.msg}</span>
            </div>
          ),
        )}
      </div>
    </div>
  );
});

export function NetworkLab() {
  const reduced = useReducedMotion();
  const labRef = useRef<HTMLDivElement>(null);
  const sim = useNetworkSimulation(labRef);
  const { snap, t, goto, toggle, replay, reset, select, runComparison, transmit } = sim;
  const [tx, setTx] = useState('see you at 19:00');

  /* protocol-strip buttons deep-link into the lab */
  useEffect(() => onStageRequest(n => {
    goto(n);
    labRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }), [goto, reduced]);

  const tabsRef = useRef<HTMLDivElement>(null);
  const onTabKeys = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const tabs = Array.from(tabsRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []);
    const i = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[n].focus();
    tabs[n].click();
  };

  const statusText = `stage 0${snap.stage} · ${snap.playing ? 'running' : snap.started ? 'paused' : 'idle'} · t+${(t / 1000).toFixed(1)}s`;
  const stage = STAGES[snap.stage as Stage];

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
                  <p className="stage-k">STAGE 0{snap.stage} / 03</p>
                  <h3 className="stage-n">{stage.name}</h3>
                  <p className="stage-d">{stage.desc}</p>
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
                <Inspector snap={snap} onCompare={runComparison} />
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