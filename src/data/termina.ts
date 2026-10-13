// VERIFY: version string + CLI commands against the repo README before publishing.
export interface TermLine {
  type: 'cmd' | 'out' | 'ok' | 'sys' | 'fp' | 'ciph' | 'dim' | 'sp';
  text?: string;
  key?: string;
  pre?: number;  // extra delay before this line
  hold?: number; // pause after this line
}

export const TERMINAL_LINES: TermLine[] = [
  { type: 'cmd', text: 'pip install glypha' },
  { type: 'out', text: 'Collecting glypha' },
  { type: 'out', text: '  downloading glypha-0.1.0 — output abridged' },
  { type: 'ok', text: 'Successfully installed glypha-0.1.0' },
  { type: 'sp' },
  { type: 'cmd', text: 'glypha start', pre: 400 },
  { type: 'sys', key: 'identity', text: 'persistent keypair loaded' },
  { type: 'fp', text: 'fingerprint  7F3A 9C1B 42DE 0817 E5C0 61AA 3B9D F2E4' },
  { type: 'out', text: '             sha-256, truncated · verify out-of-band' },
  { type: 'sys', key: 'net', text: 'rendezvous registered — coordination channel only' },
  { type: 'sys', key: 'net', text: 'listening for peers …', hold: 900 },
  { type: 'sys', key: 'net', text: 'peer connected — direct path established', pre: 900 },
  { type: 'ok', key: 'trust', text: 'fingerprints verified — compared out-of-band' },
  { type: 'sp' },
  { type: 'sys', key: 'you', text: 'see you at 19:00' },
  { type: 'ciph', text: '29 7F 7F 3A 55 12 48 5A 9C 04 D1 … in transit' },
  { type: 'sys', key: 'peer', text: 'received — authenticated, decrypted' },
  { type: 'sp' },
  { type: 'dim', text: '— simulated session · no real commands, keys, or network —' },
];

export const TYP = 26;
const PAUSE: Record<TermLine['type'], number> = {
  cmd: 420, out: 150, ok: 340, sys: 240, fp: 300, ciph: 420, dim: 200, sp: 80,
};

export interface TermSlot { line: TermLine; start: number; dur: number; }

export const TERMINAL_SCHED: TermSlot[] = (() => {
  let time = 600;
  return TERMINAL_LINES.map(L => {
    const start = time + (L.pre ?? 0);
    const dur = L.type === 'cmd' ? (L.text?.length ?? 0) * TYP + 120 : 0;
    time = start + dur + (L.hold ?? PAUSE[L.type]);
    return { line: L, start, dur };
  });
})();

export const TERMINAL_TOTAL =
  TERMINAL_SCHED.length > 0
    ? TERMINAL_SCHED[TERMINAL_SCHED.length - 1].start + TERMINAL_SCHED[TERMINAL_SCHED.length - 1].dur + 300
    : 0;

export function projectTerminal(t: number): { n: number; chars: number; done: boolean } {
  let n = 0;
  for (const s of TERMINAL_SCHED) {
    if (t >= s.start + s.dur) n++;
    else break;
  }
  const cur = TERMINAL_SCHED[n];
  const chars = cur && cur.line.type === 'cmd' ? Math.floor(Math.max(0, t - cur.start) / TYP) : 0;
  return { n, chars, done: n >= TERMINAL_SCHED.length };
}