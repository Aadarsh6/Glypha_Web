import { memo } from 'react';
import { PEERS, type Packet, type PeerId, type SimState } from '../../data/sim';

function Blocks({ lastSent }: { lastSent: Packet | null }) {
  return (
    <>
      <div className="ib">
        <span className="ibl">AT SENDER</span>
        <p className="ibv">{lastSent ? `\u201C${lastSent.text}\u201D` : '—'}</p>
        <span className="ibs">plaintext · conceptual</span>
      </div>
      <div className="ib">
        <span className="ibl">IN TRANSIT</span>
        <p className="ibv acc">{lastSent ? `${lastSent.cipher.slice(0, 35)} …` : '—'}</p>
        <span className="ibs">illustrative ciphertext</span>
      </div>
      <div className="ib">
        <span className="ibl">AT RECIPIENT</span>
        <p className="ibv">{lastSent && lastSent.arrived ? `\u201C${lastSent.text}\u201D · verified` : 'waiting'}</p>
        <span className="ibs">decrypted locally</span>
      </div>
      <p className="inote">
        Authenticated encryption: decryption and the integrity check happen together. A modified
        message fails verification instead of arriving silently altered. This panel inspects
        concepts — no real keys exist here.
      </p>
    </>
  );
}

function CmpBox({ rows, active }: { rows: string[]; active: boolean }) {
  return (
    <div className="cmp">
      <div className="cmp-h"><span>LOCAL KEY</span><span className="ceq" /><span>TRUSTED CHANNEL</span></div>
      <div className="cmp-rows">
        {rows.map(g => (
          <div key={g} className={`cmp-row${active ? ' on' : ''}`}>
            <span>{g}</span><span className="ceq">=</span><span>{g}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PeerView({ id, snap, onCompare }: { id: PeerId; snap: SimState; onCompare: () => void }) {
  const P = PEERS[id];
  const verified = snap.status[id] === 'VERIFIED';
  const shownRows = snap.compare.peer === id ? P.fp.slice(0, snap.compare.rows) : [];

  return (
    <>
      <div className="kv"><span>peer id</span><b>{P.id}</b></div>
      <div className="kv"><span>identity</span><b>persistent keypair</b></div>
      <div className="kv"><span>created</span><b>{P.created}</b></div>
      <div className="kv"><span>address</span><b>{P.addr} · demo</b></div>
      <div className="fpbox">
        <span className="fpl">FINGERPRINT · SHA-256 · ILLUSTRATIVE</span>
        <div className="fpg">{P.fp.map(g => <i key={g}>{g}</i>)}</div>
      </div>

      {snap.stage === 2 && (
        verified ? (
          <>
            <CmpBox rows={P.fp} active />
            <div className="vres">8/8 groups match — {P.name} verified</div>
          </>
        ) : (
          <>
            <CmpBox rows={shownRows} active />
            <button className="btn-s acc" onClick={onCompare} disabled={snap.compare.running}>
              {snap.compare.running ? 'COMPARING…' : 'RUN FINGERPRINT COMPARISON'}
            </button>
            <p className="inote">
              Compare through a channel you already trust — in person, on a call, in a signed
              message. A match means the key you encrypt to is really {P.name}&apos;s.
            </p>
          </>
        )
      )}

      {snap.stage === 3 && <Blocks lastSent={snap.lastSent} />}
    </>
  );
}

function NoSelection({ snap }: { snap: SimState }) {
  if (snap.stage === 1) {
    return (
      <>
        <div className="kv"><span>discovery</span><b>via rendezvous</b></div>
        <div className="kv"><span>coordination</span><b>address exchange</b></div>
        <div className="kv"><span>message path</span><b>peer ↔ peer</b></div>
        <p className="inote">
          Finding a peer and talking to a peer are different problems. The rendezvous solves the
          first; the messages solve the second — directly, when the network allows. Select any
          node to inspect it.
        </p>
      </>
    );
  }
  if (snap.stage === 2) {
    const n = (['A', 'B'] as PeerId[]).filter(k => snap.status[k] === 'VERIFIED').length;
    return (
      <>
        <div className="kv"><span>identity</span><b>persistent keypair</b></div>
        <div className="kv"><span>verify by</span><b>fingerprint comparison</b></div>
        <div className="kv"><span>status</span><b className={n ? 'okv' : ''}>{n} / 2 peers verified</b></div>
        <p className="inote">
          The fingerprint is a digest of the peer&apos;s public key — short enough to read aloud.
          That&apos;s the point. Select a peer to inspect its key and run a comparison.
        </p>
      </>
    );
  }
  return <Blocks lastSent={snap.lastSent} />;
}

export const Inspector = memo(function Inspector({ snap, onCompare }: { snap: SimState; onCompare: () => void }) {
  const sel = snap.selected;
  const selName = sel === 'C' ? 'RENDEZVOUS' : sel ? PEERS[sel].name : 'NO SELECTION';
  return (
    <div>
      <div className="ihead">
        <span>INSPECTOR</span>
        <span className={`isel${sel ? ' on' : ''}`}>{selName}</span>
      </div>
      {sel === 'C' ? (
        <>
          <div className="kv"><span>role</span><b>rendezvous point</b></div>
          <div className="kv"><span>phase</span><b>introductions only</b></div>
          <div className="kv"><span>sees</span><b>that peers exist</b></div>
          <div className="kv"><span>relays</span><b>no messages</b></div>
          <p className="inote">
            A rendezvous coordinates discovery — exchanging addresses so peers can connect
            directly. Once a direct path exists, it drops out of the message path. It is not
            invisible: it knows peers are looking for each other.
          </p>
        </>
      ) : sel ? (
        <PeerView id={sel} snap={snap} onCompare={onCompare} />
      ) : (
        <NoSelection snap={snap} />
      )}
    </div>
  );
});