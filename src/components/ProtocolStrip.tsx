import { requestStage } from '../data/stageBus';
import { Icon, Reveal, SectionHeader } from './ui';

function Fig1() {
  return (
    <svg width="200" height="64" viewBox="0 0 200 64" aria-hidden="true">
      <circle className="st" cx="28" cy="44" r="9" /><circle className="st" cx="172" cy="20" r="9" />
      <line className="ac" x1="37" y1="41" x2="163" y2="23" />
      <rect className="st" x="82" y="2" width="56" height="18" rx="4" strokeDasharray="4 4" />
    </svg>
  );
}
function Fig2() {
  return (
    <svg width="200" height="64" viewBox="0 0 200 64" aria-hidden="true">
      <rect className="st" x="8" y="10" width="70" height="22" rx="4" /><text x="20" y="25">7F3A</text>
      <text x="94" y="26">=</text>
      <rect className="st" x="112" y="10" width="70" height="22" rx="4" /><text x="124" y="25">7F3A</text>
      <polyline className="ac" points="95,46 100,51 110,40" />
    </svg>
  );
}
function Fig3() {
  return (
    <svg width="200" height="64" viewBox="0 0 200 64" aria-hidden="true">
      <line className="st" x1="10" y1="32" x2="190" y2="32" />
      <circle className="acf" cx="100" cy="32" r="6" />
      <text x="84" y="14">29 7F 3A</text>
    </svg>
  );
}

const STEPS = [
  { n: '01', title: 'Establish connectivity', p: 'A rendezvous point introduces the peers — coordination, not message storage. The peers then attempt a direct path between themselves.', fig: <Fig1 /> },
  { n: '02', title: "Verify the peer's identity", p: "Compare the peer's fingerprint over a channel you already trust — in person, on a call, in a signed message. A match means the key is really theirs.", fig: <Fig2 /> },
  { n: '03', title: 'Exchange encrypted messages', p: "Messages are encrypted to the peer's public key and authenticated — tampering is detected, not silently delivered.", fig: <Fig3 /> },
];

export function ProtocolStrip() {
  return (
    <section className="hairtop" style={{ paddingBlock: 'clamp(56px,7vw,96px)' }}>
      <div className="wrap">
        <SectionHeader index="02" label="The protocol" title="Three moves, in order." />
        <Reveal>
          {STEPS.map((s, i) => (
            <div key={s.n} className="pstep grid grid-cols-[40px_minmax(0,1fr)] items-center gap-x-6 gap-y-3.5 md:grid-cols-[56px_1fr_220px_auto]">
              <div className="ps-n">{s.n}</div>
              <div className="ps-body">
                <h3>{s.title}</h3>
                <p>{s.p}</p>
              </div>
              <div className="ps-fig hidden md:block md:justify-self-end">{s.fig}</div>
              <button className="ps-link md:justify-self-end" onClick={() => requestStage((i + 1) as 1 | 2 | 3)}>
                OPEN STAGE 0{i + 1}<Icon name="arrow" size={12} />
              </button>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}