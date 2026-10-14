// Interactive glypha chat session, simulated peer, REAL crypto.
// Identity keys are generated in the visitor's tab; messages are sealed with
// the same primitives Glypha uses (NaCl Box: X25519 + XSalsa20-Poly1305), and
// fingerprints follow peer.py's format_fingerprint (SHA-256, 4-hex groups).
import nacl from 'tweetnacl';
import { sha256 } from '../lib/sha256';

export type Phase = 'fresh' | 'installed' | 'started' | 'connected' | 'verified';
export interface RLine {
  kind: 'cmd' | 'user' | 'out' | 'ok' | 'sys' | 'fp' | 'ciph' | 'err' | 'dim' | 'sp' | 'try' | 'fail';
  text: string;
  key?: string;
}
export interface RState { phase: Phase; sent: number }
export interface CmdOut { lines: RLine[]; state?: Partial<RState> }

const me = nacl.box.keyPair();
const world = nacl.box.keyPair();
const toHex = (u: Uint8Array) => Array.from(u, b => b.toString(16).padStart(2, '0')).join('');
const fpOf = (pub: Uint8Array) => (toHex(sha256(pub)).match(/.{4}/g) ?? []).join(':');
const FP_ME = fpOf(me.publicKey);
const FP_WORLD = fpOf(world.publicKey);
const half = (fp: string) => [fp.split(':').slice(0, 8).join(':'), fp.split(':').slice(8).join(':')];

const enc = new TextEncoder();
const dec = new TextDecoder();
const seal = (t: string, from: nacl.BoxKeyPair, to: nacl.BoxKeyPair) => {
  const nonce = nacl.randomBytes(24);
  return { nonce, box: nacl.box(enc.encode(t), nonce, to.publicKey, from.secretKey) };
};
const open = (p: { nonce: Uint8Array; box: Uint8Array }, from: nacl.BoxKeyPair, to: nacl.BoxKeyPair) => {
  const m = nacl.box.open(p.box, p.nonce, from.publicKey, to.secretKey);
  return m ? dec.decode(m) : null;
};
const wire = (p: { nonce: Uint8Array; box: Uint8Array }): RLine => ({
  kind: 'ciph',
  text: `${toHex(p.nonce).slice(0, 12)}…${toHex(p.box).slice(0, 16)}…  ${24 + p.box.length} bytes on the wire`,
});

let lastSealed: { nonce: Uint8Array; box: Uint8Array } | null = null;
const sentLog: string[] = [];
const REPLIES = [
  'received. the relay never saw a word.',
  'my NAT said no too.',
  'keys stay local. messages stay sealed.',
  'nobody in the middle can read this.',
];

const [f1, f2] = half(FP_ME);
export const BOOT: RLine[] = [
  { kind: 'cmd', text: 'pip install glypha' },
  { kind: 'out', text: '  downloading glypha-2.3.0 — output abridged' },
  { kind: 'ok', text: 'Successfully installed glypha-2.3.0' },
  { kind: 'sp', text: '' },
  { kind: 'cmd', text: 'glypha chat you world' },
  { kind: 'try', text: "• reaching 'world' via glypha.duckdns.org..." },
  { kind: 'try', text: '• trying direct to 203.0.113.7:34059...' },
  { kind: 'fail', text: '✕ direct connect failed — trying NAT traversal...' },
  { kind: 'fail', text: '✕ traversal failed — falling back to relay...' },
  { kind: 'ok', text: '● identity created in your browser' },
  { kind: 'fp', text: `  ${f1}` },
  { kind: 'fp', text: `  ${f2}` },
  { kind: 'ok', text: '● connected via relay' },
  { kind: 'dim', text: '— simulated peer · real X25519 + XSalsa20-Poly1305 —' },
  { kind: 'dim', text: 'type a message, or `help`' },
];

interface CmdDef { desc: string; hidden?: boolean; run: (args: string, st: RState) => CmdOut }

function sendMessage(text: string, st: RState): CmdOut {
  const p = seal(text, me, world);
  lastSealed = p;
  sentLog.push(text);
  const reply = REPLIES[(sentLog.length - 1) % REPLIES.length];
  const q = seal(reply, world, me);
  return {
    lines: [
      { kind: 'sys', key: 'you', text: text.slice(0, 70) },
      wire(p),
      { kind: 'sys', key: 'world', text: `authenticated, decrypted: ${open(p, me, world)}` },
      { kind: 'sys', key: 'world', text: open(q, world, me) ?? '' },
    ],
    state: { sent: st.sent + 1 },
  };
}

export const COMMANDS: Record<string, CmdDef> = {
  help: {
    desc: 'this list',
    run: () => ({
      lines: [
        { kind: 'out', text: 'type anything to send it. commands:' },
        { kind: 'out', text: '  /whoami         your identity and fingerprint' },
        { kind: 'out', text: '  /fingerprint    the peer fingerprint' },
        { kind: 'out', text: '  /status         how this connection was made' },
        { kind: 'out', text: '  /history        messages sent this session' },
        { kind: 'out', text: '  tamper          flip one bit of your last message' },
        { kind: 'out', text: '  clear           wipe the screen' },
        { kind: 'sp', text: '' },
        { kind: 'dim', text: 'hidden commands exist. terminals reward the curious.' },
      ],
    }),
  },
  whoami: {
    desc: 'identity',
    run: () => {
      const [a, b] = half(FP_ME);
      return { lines: [
        { kind: 'out', text: 'you: identity generated in this tab, gone on refresh' },
        { kind: 'fp', text: `  ${a}` }, { kind: 'fp', text: `  ${b}` },
      ] };
    },
  },
  fingerprint: {
    desc: 'peer fingerprint',
    run: () => {
      const [a, b] = half(FP_WORLD);
      return { lines: [
        { kind: 'out', text: 'peer fingerprint (compare out-of-band in the real app)' },
        { kind: 'fp', text: `  ${a}` }, { kind: 'fp', text: `  ${b}` },
      ] };
    },
  },
  status: {
    desc: 'connection',
    run: () => ({ lines: [
      { kind: 'ok', text: '● connected via relay' },
      { kind: 'out', text: '  direct: failed · NAT traversal: failed · relay: ok' },
      { kind: 'dim', text: '  the relay splices bytes. it has no crypto library installed.' },
    ] }),
  },
  history: {
    desc: 'messages',
    run: () => ({ lines: sentLog.length
      ? [{ kind: 'dim', text: `history: showing last ${sentLog.length} of ${sentLog.length}` },
         ...sentLog.map(t => ({ kind: 'out' as const, text: `  you  ${t}` }))]
      : [{ kind: 'dim', text: 'no messages yet' }] }),
  },
  tamper: {
    desc: 'flip one bit',
    run: () => {
      if (!lastSealed) return { lines: [{ kind: 'err', text: 'send a message first, then tamper with it' }] };
      const b = new Uint8Array(lastSealed.box);
      b[b.length >> 1] ^= 1;
      const ok = nacl.box.open(b, lastSealed.nonce, me.publicKey, world.secretKey);
      return { lines: [
        { kind: ok ? 'err' : 'fail', text: ok ? 'unexpected: tampered message accepted' : '✕ one bit flipped in transit: authentication failed, message not delivered' },
        { kind: 'dim', text: 'the cipher is authenticated. changing the ciphertext breaks it.' },
      ] };
    },
  },
  ls: { desc: 'look around', hidden: true, run: () => ({ lines: [{ kind: 'out', text: 'identity.bin   history.db   known_peers.json' }] }) },
  ping: { hidden: true, desc: '', run: () => ({ lines: [{ kind: 'dim', text: 'this is a simulation. no packets were harmed' }] }) },
  sudo: { hidden: true, desc: '', run: (a) => ({ lines: [{ kind: 'dim', text: `sudo: ${a.trim() || '…'}: you're already the root of your own machine` }] }) },
  rm: { hidden: true, desc: '', run: () => ({ lines: [{ kind: 'err', text: 'rm: this terminal guards its own filesystem. (also: no.)' }] }) },
  exit: { hidden: true, desc: '', run: () => ({ lines: [{ kind: 'dim', text: "a peer-to-peer connection doesn't exit, it just goes quiet" }] }) },
};

export function nextHint(st: RState): string {
  return st.phase === 'fresh' ? '…' : st.sent === 0 ? 'say hello' : 'tamper';
}

export function runCommand(raw: string, st: RState): { lines: RLine[]; state: RState } {
  const input = raw.trim();
  let name = input.toLowerCase().replace(/^\//, '');
  if (name.startsWith('glypha ')) name = name.slice(7).trim();
  const word = name.split(' ')[0];
  const def = COMMANDS[word];
  if (def && (name === word || word === 'sudo' || word === 'rm')) {
    const out = def.run(name.slice(word.length), st);
    return { lines: out.lines, state: { ...st, ...out.state } };
  }
  // like the real chat: anything that is not a command is a message
  const out = sendMessage(input, st);
  return { lines: out.lines, state: { ...st, ...out.state } };
}
