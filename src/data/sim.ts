// Simulation data — everything here is illustrative and offline.
// VERIFY: fingerprints, addresses, and event wording against the real Glypha behavior.

export type PeerId = 'A' | 'B';
export type NodeId = 'A' | 'B' | 'C';
export type Stage = 1 | 2 | 3;
export type NodeStatus = 'OFFLINE' | 'LISTENING' | 'CONNECTED' | 'UNVERIFIED' | 'VERIFIED';

export interface Peer {
  name: string; id: string; created: string; addr: string; fp: string[];
}

export const PEERS: Record<PeerId, Peer> = {
  A: {
    name: 'ALPHA', id: '8f3a…c21e', created: '2025-03-14', addr: '10.0.4.12:4310',
    fp: ['7F3A', '9C1B', '42DE', '0817', 'E5C0', '61AA', '3B9D', 'F2E4'],
  },
  B: {
    name: 'BRAVO', id: 'd407…93b8', created: '2025-03-02', addr: '172.19.8.5:4310',
    fp: ['61AA', '3B9D', 'F2E4', '7F3A', '9C1B', '42DE', '0817', 'E5C0'],
  },
};

export interface Packet { id: number; text: string; cipher: string; start: number; arrived: boolean; }
export interface LogEntry { id: number; t: number; tag: string; msg: string; kind?: 'ok' | 'warn' | 'divider'; }

export interface SimState {
  stage: Stage;
  t: number;
  playing: boolean;
  started: boolean;
  selected: NodeId | null;
  status: Record<NodeId, NodeStatus>;
  path: 'hidden' | 'forming' | 'established';
  announce: { ca: boolean; cb: boolean };
  rendezvousIdle: boolean;
  fired: number;
  log: LogEntry[];
  packets: Packet[];
  queue: string[];
  ids: number;
  lastSent: Packet | null;
  compare: { peer: PeerId | null; rows: number; running: boolean };
  bubble: string | null;
}

export const FLIGHT_MS = 1700;
export const FORMING_AT = 4650;
export const FORMING_MS = 1400;

type Apply = (d: SimState) => void;
interface EvDef { at: number; tag: string; msg: string; kind?: 'ok' | 'warn'; apply?: Apply; }

export interface StageDef { name: string; desc: string; events: EvDef[]; }
export const STAGES: Record<Stage, StageDef> = {
  1: {
    name: 'Peer discovery & connectivity',
    desc:
      'Two peers come online and announce to a rendezvous point. The rendezvous coordinates ' +
      'introductions — it is not where messages live. After the introduction, the peers open a ' +
      'direct path between themselves.',
    events: [
      { at: 300, tag: 'NET', msg: 'alpha online — identity loaded, listening', apply: d => { d.status.A = 'LISTENING'; } },
      { at: 1050, tag: 'NET', msg: 'alpha → rendezvous: announce (coordination channel)', apply: d => { d.announce.ca = true; } },
      { at: 2150, tag: 'NET', msg: 'bravo online — identity loaded, listening', apply: d => { d.status.B = 'LISTENING'; } },
      { at: 2750, tag: 'NET', msg: 'bravo → rendezvous: announce', apply: d => { d.announce.cb = true; } },
      { at: 3950, tag: 'NET', msg: 'rendezvous: addresses exchanged — coordination complete' },
      { at: FORMING_AT, tag: 'NET', msg: 'direct path attempt: alpha ↔ bravo', apply: d => { d.path = 'forming'; } },
      { at: 6050, tag: 'OK', kind: 'ok', msg: 'direct path established — messages travel peer to peer', apply: d => { d.path = 'established'; } },
      { at: 6700, tag: 'NET', msg: 'rendezvous idle — out of the message path', apply: d => { d.rendezvousIdle = true; } },
      { at: 8300, tag: 'SYS', msg: 'stage 01 complete — continue to verification' },
    ],
  },
  2: {
    name: 'Identity verification',
    desc:
      'Every peer is a keypair. The fingerprint — a digest of the public key — is what you actually ' +
      'verify. Compare it through a channel you already trust. Select a peer, then run the comparison.',
    events: [
      { at: 250, tag: 'ID', msg: 'identities: each peer holds a persistent keypair' },
      { at: 850, tag: 'ID', kind: 'warn', msg: 'fingerprint status: UNVERIFIED on both peers' },
      { at: 1600, tag: 'SYS', msg: 'select a peer to inspect its fingerprint' },
    ],
  },
  3: {
    name: 'Encrypted message exchange',
    desc:
      'A message leaves the sender as plaintext, is encrypted to the peer\u2019s public key, crosses the ' +
      'wire as ciphertext, and arrives authenticated — tampering is detected, not delivered. ' +
      'Transmit one and follow it.',
    events: [
      { at: 250, tag: 'SYS', msg: 'channel ready — path established, identities verified' },
      { at: 1400, tag: 'DATA', msg: 'demo transmission queued', apply: d => { d.queue = [...d.queue, 'see you at 19:00']; } },
    ],
  },
};

export function initStage(stage: Stage): SimState {
  const s: SimState = {
    stage, t: 0, playing: false, started: false, selected: null,
    status: { A: 'OFFLINE', B: 'OFFLINE', C: 'OFFLINE' },
    path: 'hidden', announce: { ca: false, cb: false }, rendezvousIdle: false,
    fired: 0, log: [], packets: [], queue: [], ids: 1, lastSent: null,
    compare: { peer: null, rows: 0, running: false }, bubble: null,
  };
  if (stage === 2) { s.status.A = 'UNVERIFIED'; s.status.B = 'UNVERIFIED'; s.path = 'established'; }
  if (stage === 3) { s.status.A = 'VERIFIED'; s.status.B = 'VERIFIED'; s.path = 'established'; }
  s.log = [{ id: 0, t: 0, tag: '—', kind: 'divider', msg: `── stage 0${stage} · ${STAGES[stage].name.toLowerCase()} ──` }];
  return s;
}

function toCipher(text: string): string {
  return Array.from(text)
    .map(ch => ((ch.charCodeAt(0) ^ 0x5A).toString(16).padStart(2, '0')).toUpperCase())
    .join(' ');
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

/** Advances the draft in place. Returns true if discrete state changed (besides time). */
export function advance(d: SimState, dt: number): boolean {
  if (!d.playing) return false;
  d.t += dt;
  const stage = STAGES[d.stage];
  let discrete = false;

  while (d.fired < stage.events.length && stage.events[d.fired].at <= d.t) {
    const ev = stage.events[d.fired++];
    d.log = [...d.log, { id: d.ids++, t: d.t, tag: ev.tag, msg: ev.msg, kind: ev.kind }];
    ev.apply?.(d);
    discrete = true;
  }

  if (d.queue.length > 0 && !d.packets.some(p => !p.arrived)) {
    const text = d.queue[0];
    d.queue = d.queue.slice(1);
    const p: Packet = { id: d.ids++, text, cipher: toCipher(text), start: d.t, arrived: false };
    d.packets = [...d.packets, p];
    d.lastSent = p;
    d.log = [
      ...d.log,
      { id: d.ids++, t: d.t, tag: 'DATA', msg: `alpha → "${text}" (${text.length} bytes, encrypted to peer's public key)` },
      { id: d.ids++, t: d.t, tag: 'CRYPT', msg: `in transit: ${p.cipher.slice(0, 23)} … — illustrative ciphertext` },
    ];
    discrete = true;
  }

  for (const p of d.packets) {
    if (!p.arrived && d.t - p.start >= FLIGHT_MS) {
      const np: Packet = { ...p, arrived: true };
      d.packets = d.packets.map(q => (q === p ? np : q));
      if (d.lastSent === p) d.lastSent = np;
      d.bubble = truncate(p.text, 24);
      d.log = [...d.log, { id: d.ids++, t: d.t, tag: 'DATA', kind: 'ok', msg: 'bravo: received — authenticated, decrypted' }];
      discrete = true;
    }
  }

  if (d.fired >= stage.events.length && d.queue.length === 0 && d.packets.every(p => p.arrived)) {
    d.playing = false;
    discrete = true;
  }
  return discrete;
}

/** Completes a stage instantly — used for prefers-reduced-motion. */
export function fastForward(d: SimState): void {
  const stage = STAGES[d.stage];
  while (d.fired < stage.events.length) {
    const ev = stage.events[d.fired++];
    d.log = [...d.log, { id: d.ids++, t: ev.at, tag: ev.tag, msg: ev.msg, kind: ev.kind }];
    ev.apply?.(d);
  }
  d.t = stage.events.length ? stage.events[stage.events.length - 1].at + 300 : 0;
  while (d.queue.length > 0 || d.packets.some(p => !p.arrived)) {
    if (d.queue.length > 0 && !d.packets.some(p => !p.arrived)) {
      const text = d.queue[0];
      d.queue = d.queue.slice(1);
      const p: Packet = { id: d.ids++, text, cipher: toCipher(text), start: d.t, arrived: false };
      d.packets = [...d.packets, p];
      d.lastSent = p;
    }
    for (const p of d.packets) {
      if (!p.arrived) {
        const np: Packet = { ...p, arrived: true };
        d.packets = d.packets.map(q => (q === p ? np : q));
        if (d.lastSent === p) d.lastSent = np;
        d.bubble = truncate(p.text, 24);
        d.log = [...d.log, { id: d.ids++, t: d.t, tag: 'DATA', kind: 'ok', msg: 'bravo: received — authenticated, decrypted' }];
      }
    }
  }
  d.playing = false;
  d.started = true;
}

export function isFinished(d: SimState): boolean {
  return (
    d.fired >= STAGES[d.stage].events.length &&
    d.queue.length === 0 &&
    d.packets.every(p => p.arrived) &&
    !d.compare.running
  );
}

/** Topology geometry: one landscape set, one portrait set for small screens. */
export interface Layout {
  vb: string;
  A: [number, number]; B: [number, number]; C: [number, number];
  direct: string; ca: string; cb: string;
  lca: [number, number]; lcb: [number, number];
  lpath: { x: number; y: number; anchor: 'start' | 'middle' };
  pkt: { a: number; b: number; fixed: number; axis: 'x' | 'y' };
  directLen: number;
}

export const LAYOUTS: { wide: Layout; narrow: Layout } = {
  wide: {
    vb: '0 0 840 520', A: [175, 305], B: [665, 305], C: [420, 118],
    direct: 'M 255 305 L 585 305',
    ca: 'M 238 252 Q 250 172 330 142', cb: 'M 602 252 Q 590 172 510 142',
    lca: [262, 180], lcb: [578, 180], lpath: { x: 420, y: 291, anchor: 'middle' },
    pkt: { a: 300, b: 540, fixed: 305, axis: 'x' }, directLen: 330,
  },
  narrow: {
    vb: '0 0 480 780', A: [240, 160], B: [240, 610], C: [100, 385],
    direct: 'M 240 215 L 240 555',
    ca: 'M 160 192 Q 118 268 104 354', cb: 'M 160 578 Q 118 502 104 416',
    lca: [150, 258], lcb: [150, 522], lpath: { x: 256, y: 384, anchor: 'start' },
    pkt: { a: 245, b: 525, fixed: 240, axis: 'y' }, directLen: 340,
  },
};