// Simulated glypha shell — every value illustrative.
// VERIFY: command names + fingerprints against the real CLI before publishing.

export type Phase = 'fresh' | 'installed' | 'started' | 'connected' | 'verified';
export interface RLine {
  kind: 'cmd' | 'user' | 'out' | 'ok' | 'sys' | 'fp' | 'ciph' | 'err' | 'dim' | 'sp';
  text: string;
  key?: string;
}
export interface RState { phase: Phase; sent: number }
export interface CmdOut { lines: RLine[]; state?: Partial<RState> }

const FP_A = '7F3A 9C1B 42DE 0817 E5C0 61AA 3B9D F2E4';
const FP_B = '61AA 3B9D F2E4 7F3A 9C1B 42DE 0817 E5C0';

const hex = (s: string) =>
  Array.from(s).map(c => (c.charCodeAt(0) ^ 0x5A).toString(16).padStart(2, '0').toUpperCase()).join(' ');

export const BOOT: RLine[] = [
  { kind: 'cmd', text: 'pip install glypha' },
  { kind: 'out', text: 'Collecting glypha' },
  { kind: 'out', text: '  downloading glypha-0.1.0 — output abridged' },
  { kind: 'ok', text: 'Successfully installed glypha-0.1.0' },
  { kind: 'sp', text: '' },
  { kind: 'cmd', text: 'glypha start' },
  { kind: 'sys', key: 'identity', text: 'persistent keypair loaded' },
  { kind: 'fp', text: `fingerprint  ${FP_A}` },
  { kind: 'sys', key: 'net', text: 'rendezvous registered — coordination channel only' },
  { kind: 'sys', key: 'net', text: 'listening for peers …' },
  { kind: 'sp', text: '' },
  { kind: 'dim', text: '— scripted intro ends here —' },
  { kind: 'dim', text: 'your turn: type `help`, or `connect` to continue' },
];

const need = (st: RState, phases: Phase[], hint: string): CmdOut | null =>
  phases.includes(st.phase) ? null : { lines: [{ kind: 'err', text: `not yet — ${hint}` }] };

interface CmdDef { desc: string; hidden?: boolean; run: (args: string, st: RState) => CmdOut }

export const COMMANDS: Record<string, CmdDef> = {
  help: {
    desc: 'this list',
    run: () => ({
      lines: [
        { kind: 'out', text: 'COMMANDS' },
        { kind: 'out', text: '  install           pip install glypha (simulated)' },
        { kind: 'out', text: '  start             boot your identity and listen' },
        { kind: 'out', text: '  connect           find a peer through the rendezvous' },
        { kind: 'out', text: '  verify            compare fingerprints out-of-band' },
        { kind: 'out', text: '  send <message>    encrypt and transmit to your peer' },
        { kind: 'out', text: '  peers             list known peers' },
        { kind: 'out', text: '  whoami            who you are' },
        { kind: 'out', text: '  ls / cat <file>   look around' },
        { kind: 'out', text: '  clear             wipe the screen' },
        { kind: 'sp', text: '' },
        { kind: 'dim', text: 'hidden commands exist — terminals reward the curious' },
      ],
    }),
  },
  install: {
    desc: 'pip install glypha (simulated)',
    run: (_a, st) => {
      if (st.phase !== 'fresh') return { lines: [{ kind: 'dim', text: 'already installed — nothing to do' }] };
      return {
        lines: [
          { kind: 'out', text: 'Collecting glypha' },
          { kind: 'out', text: '  downloading glypha-0.1.0 — output abridged' },
          { kind: 'ok', text: 'Successfully installed glypha-0.1.0' },
        ],
        state: { phase: 'installed' },
      };
    },
  },
  start: {
    desc: 'boot your identity and listen',
    run: (_a, st) =>
      need(st, ['installed'], 'run `install` first') ?? {
        lines: [
          { kind: 'sys', key: 'identity', text: 'persistent keypair loaded' },
          { kind: 'fp', text: `fingerprint  ${FP_A}` },
          { kind: 'sys', key: 'net', text: 'rendezvous registered — coordination channel only' },
          { kind: 'sys', key: 'net', text: 'listening for peers …' },
        ],
        state: { phase: 'started' },
      },
  },
  connect: {
    desc: 'find a peer through the rendezvous',
    run: (_a, st) =>
      need(st, ['started'], 'run `start` first') ?? {
        lines: [
          { kind: 'sys', key: 'net', text: 'rendezvous: peer discovered — bravo' },
          { kind: 'sys', key: 'net', text: 'direct path established' },
          { kind: 'fp', text: `peer fingerprint  ${FP_B}` },
          { kind: 'dim', text: 'verify before sending anything — try `verify`' },
        ],
        state: { phase: 'connected' },
      },
  },
  verify: {
    desc: 'compare fingerprints out-of-band',
    run: (_a, st) =>
      need(st, ['connected', 'verified'], 'connect to a peer first') ?? {
        lines: [
          { kind: 'out', text: 'comparing bravo fingerprint — out-of-band channel' },
          { kind: 'fp', text: `local     61AA 3B9D F2E4 7F3A` },
          { kind: 'fp', text: `channel   61AA 3B9D F2E4 7F3A` },
          { kind: 'out', text: '          9C1B 42DE 0817 E5C0 · 8/8 groups' },
          { kind: 'ok', text: 'match — bravo verified' },
        ],
        state: { phase: 'verified' },
      },
  },
  send: {
    desc: 'encrypt and transmit to your peer',
    run: (args, st) => {
      if (!args.trim()) return { lines: [{ kind: 'err', text: 'usage: send <message>' }] };
      return (
        need(st, ['verified'], 'verify the peer first — `verify`') ?? {
          lines: [
            { kind: 'sys', key: 'you', text: args.trim().slice(0, 60) },
            { kind: 'ciph', text: `${hex(args.trim()).slice(0, 35)} … in transit` },
            { kind: 'sys', key: 'peer', text: 'received — authenticated, decrypted' },
            { kind: 'dim', text: 'hint: try `cat history.db`' },
          ],
          state: { sent: st.sent + 1 },
        }
      );
    },
  },
  peers: {
    desc: 'list known peers',
    run: (_a, st) => ({
      lines: st.phase === 'fresh' || st.phase === 'installed'
        ? [{ kind: 'out', text: 'no peers — not listening yet' }]
        : [{ kind: 'out', text: 'bravo   61AA 3B9D F2E4 …   connected' }],
    }),
  },
  whoami: {
    desc: 'who you are',
    run: () => ({ lines: [
      { kind: 'out', text: 'alpha — persistent identity' },
      { kind: 'fp', text: `fingerprint  ${FP_A}` },
      { kind: 'dim', text: '(you, presumably)' },
    ] }),
  },
  ls: {
    desc: 'look around',
    run: () => ({ lines: [{ kind: 'out', text: 'identity.json   history.db   README.md' }] }),
  },
  cat: {
    desc: 'read a file',
    run: (args) => {
      const f = args.trim();
      if (f === 'history.db') {
        return { lines: [
          { kind: 'ciph', text: '9f 3a 7c 01 d4 ee 22 b8 5a 71 0c 9f 3e 48 d2 …' },
          { kind: 'ciph', text: '44 1b 8e 90 2f c7 13 a6 5d 0b 99 e2 30 7f 4c …' },
          { kind: 'dim', text: 'encrypted at rest — unreadable without your key. that\u2019s the point.' },
        ] };
      }
      if (f === 'identity.json') {
        return { lines: [
          { kind: 'out', text: '{ "peer": "alpha", "fingerprint": "7F3A 9C1B 42DE …" }' },
          { kind: 'dim', text: 'your keys never leave this machine' },
        ] };
      }
      if (f === 'README.md') {
        return { lines: [{ kind: 'dim', text: 'you\u2019re already on the website — github.com/Aadarsh6/glypha' }] };
      }
      return { lines: [{ kind: 'err', text: `cat: ${f || '?'}: no such file` }] };
    },
  },
  ping: { hidden: true, desc: '', run: () => ({ lines: [{ kind: 'dim', text: 'this is a simulation — no packets were harmed' }] }) },
  sudo: { hidden: true, desc: '', run: (args) => ({ lines: [{ kind: 'dim', text: `sudo: ${args.trim() || '…'} — you\u2019re already the root of your own machine` }] }) },
  rm: { hidden: true, desc: '', run: () => ({ lines: [{ kind: 'err', text: 'rm: this terminal guards its own filesystem. (also: no.)' }] }) },
  exit: { hidden: true, desc: '', run: () => ({ lines: [{ kind: 'dim', text: 'a peer-to-peer connection doesn\u2019t exit — it just goes quiet' }] }) },
};

export function nextHint(st: RState): string {
  switch (st.phase) {
    case 'fresh': return 'install';
    case 'installed': return 'start';
    case 'started': return 'connect';
    case 'connected': return 'verify';
    case 'verified': return st.sent === 0 ? 'send hello' : 'cat history.db';
  }
}

export function runCommand(raw: string, st: RState): { lines: RLine[]; state: RState } {
  const input = raw.trim();
  let name = input.toLowerCase();
  if (name === 'pip install glypha') name = 'install';
  if (name.startsWith('glypha ')) name = name.slice(7).trim();
  if (name === 'glypha') name = 'help';
  if (name.startsWith('sudo ') || name === 'sudo') return sudoPath(input, st);
  const def = COMMANDS[name];
  if (!def) {
    return {
      lines: [{ kind: 'err', text: `command not found: ${input.split(' ')[0]} — type \`help\`` }],
      state: st,
    };
  }
  const args = input.slice(name.length).trim();
  const out = def.run(name === 'cat' || name === 'send' ? raw.trim().slice(name.length).trim() : args, st);
  return { lines: out.lines, state: { ...st, ...out.state } };
}

function sudoPath(input: string, st: RState): { lines: RLine[]; state: RState } {
  const out = COMMANDS.sudo.run(input.slice(5), st);
  return { lines: out.lines, state: st };
}