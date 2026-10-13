import { type CSSProperties } from 'react';
import {
  FLIGHT_MS, FORMING_AT, FORMING_MS, LAYOUTS, PEERS,
  type Layout, type NodeId, type PeerId, type SimState,
} from '../../data/sim';
import { useMediaQuery } from '../../hooks';

const STATUS_CLASS: Record<string, string> = {
  OFFLINE: '', LISTENING: 'listening', CONNECTED: 'connected',
  UNVERIFIED: 'unverified', VERIFIED: 'verified',
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
const easeInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

function PeerNode({ id, L, snap, onSelect }: { id: PeerId; L: Layout; snap: SimState; onSelect: (id: NodeId) => void }) {
  const P = PEERS[id];
  const stt = snap.status[id];
  const cls = `node peer ${STATUS_CLASS[stt]}${snap.selected === id ? ' selected' : ''}`;
  return (
    <g
      className={cls} transform={`translate(${L[id][0]} ${L[id][1]})`}
      tabIndex={0} role="button" aria-label={`Inspect peer ${P.name}`}
      onClick={() => onSelect(id)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(id); } }}
    >
      <rect className="nbox" x={-80} y={-55} width={160} height={110} rx={10} />
      <circle className="led" cx={-62} cy={-33} r={3.5} />
      <text className="ntitle" x={-50} y={-29}>{P.name}</text>
      <text className="nstate" x={76} y={-29} textAnchor="end">{stt}</text>
      <text className="nsub" x={-64} y={-6}>persistent identity</text>
      <text className="nfp" x={-64} y={16}>{P.fp.slice(0, 4).join(' ')}</text>
      <text className="naddr" x={-64} y={36}>{P.addr} · demo</text>
      <g className="vbadge" transform="translate(18,-55)">
        <rect x={0} y={-11} width={92} height={22} rx={11} />
        <polyline points="13,0 18,5 25,-5" />
        <text x={36} y={4}>VERIFIED</text>
      </g>
      {id === 'B' && (
        <g className={`bubble${snap.bubble ? ' show' : ''}`} transform="translate(-85,64)">
          <rect x={0} y={0} width={170} height={48} rx={8} />
          <text className="btext" x={85} y={21} textAnchor="middle">{snap.bubble ?? '—'}</text>
          <text className="btag" x={85} y={38} textAnchor="middle">authenticated · decrypted</text>
        </g>
      )}
    </g>
  );
}

function CoordNode({ L, snap, onSelect }: { L: Layout; snap: SimState; onSelect: (id: NodeId) => void }) {
  const cls = `node coord${snap.stage !== 1 ? ' dim' : ''}${snap.rendezvousIdle ? ' idle' : ''}${snap.selected === 'C' ? ' selected' : ''}`;
  return (
    <g
      className={cls} transform={`translate(${L.C[0]} ${L.C[1]})`}
      tabIndex={snap.stage === 1 ? 0 : -1} role="button" aria-label="Inspect the rendezvous node"
      onClick={() => onSelect('C')}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect('C'); } }}
    >
      <rect className="nbox cbox" x={-95} y={-31} width={190} height={62} rx={8} />
      <text className="ntitle" x={-79} y={-4}>RENDEZVOUS</text>
      <text className="nsub" x={-79} y={16}>coordination · introductions</text>
    </g>
  );
}

export function Topology({ snap, t, onSelect }: { snap: SimState; t: number; onSelect: (id: NodeId) => void }) {
  const narrow = useMediaQuery('(max-width: 720px)');
  const L = narrow ? LAYOUTS.narrow : LAYOUTS.wide;

  const draw =
    snap.path === 'established' ? 1 :
    snap.path === 'forming' ? easeOut(clamp01((t - FORMING_AT) / FORMING_MS)) : 0;
  const dashOffset = L.directLen * (1 - draw);

  const pathLabel =
    snap.path === 'established' ? 'MESSAGE PATH · PEER → PEER' :
    snap.path === 'forming' ? 'ESTABLISHING DIRECT PATH' : '';

  const wireCls = (on: boolean) =>
    `wire${on ? (snap.rendezvousIdle ? ' on idle' : ' on') : ''}`;

  return (
    <div className="topo-box">
      <svg
        id="topo"
        className={`topo s${snap.stage}${snap.playing ? ' playing' : ''}`}
        viewBox={L.vb}
        role="img"
        aria-label="Interactive network topology simulation"
        style={{ '--plen': L.directLen } as CSSProperties}
      >
        <defs>
          <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#1A1E1A" />
          </pattern>
        </defs>
        <rect className="dotsbg" width="100%" height="100%" fill="url(#dots)" />

        <g id="w-ca" className={wireCls(snap.announce.ca)}>
          <path id="e-ca" className="cline" d={L.ca} />
          <text id="el-ca" className="elab" x={L.lca[0]} y={L.lca[1]} textAnchor="middle">ANNOUNCE</text>
        </g>
        <g id="w-cb" className={wireCls(snap.announce.cb)}>
          <path id="e-cb" className="cline" d={L.cb} />
          <text id="el-cb" className="elab" x={L.lcb[0]} y={L.lcb[1]} textAnchor="middle">ANNOUNCE</text>
        </g>

        <g id="w-dir" className={`wire ${snap.path}`}>
          <path
            id="e-direct" className="dline" d={L.direct}
            strokeDasharray={L.directLen} strokeDashoffset={dashOffset}
          />
          <path id="e-pulse" d={L.direct} style={{ strokeDasharray: `16 ${L.directLen - 16}` }} />
          <text
            id="el-path" className={`elab${snap.path === 'established' ? ' acc' : ''}`}
            x={L.lpath.x} y={L.lpath.y} textAnchor={L.lpath.anchor}
          >
            {pathLabel}
          </text>
        </g>

        <CoordNode L={L} snap={snap} onSelect={onSelect} />
        <PeerNode id="A" L={L} snap={snap} onSelect={onSelect} />
        <PeerNode id="B" L={L} snap={snap} onSelect={onSelect} />

        {snap.packets.filter(p => !p.arrived).map(p => {
          const pr = easeInOut(clamp01((t - p.start) / FLIGHT_MS));
          const { a, b, fixed, axis } = L.pkt;
          const x = axis === 'x' ? a + (b - a) * pr : fixed + 26 * Math.sin(Math.PI * pr);
          const y = axis === 'x' ? fixed - 26 * Math.sin(Math.PI * pr) : a + (b - a) * pr;
          return (
            <g key={p.id} className="pkt" transform={`translate(${x} ${y})`}>
              <rect x={-46} y={-14} width={92} height={28} rx={6} />
              <text y={4} textAnchor="middle">{p.cipher.slice(0, 8)}…</text>
            </g>
          );
        })}
      </svg>

      <span className="m-tl">TOPOLOGY · LOCAL SIM</span>
      <span className="m-tr">SIMULATED · NO NETWORK</span>
      <span className="m-bl">PEERS 2 · RENDEZVOUS 1</span>
      <span className="m-br">GLYPHA · LAB 01</span>
    </div>
  );
}