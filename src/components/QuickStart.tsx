import { CopyButton, Reveal, SectionHead, Accordion, type AccItem } from './ui';

function CmdLine({ cmd, label }: { cmd: string; label?: string }) {
  return (
    <div className="cmdline">
      <span className="p">$</span>
      <code>{cmd}</code>
      <CopyButton text={cmd} label={label ?? 'command'} />
    </div>
  );
}

function PeerTag({ name }: { name: string }) {
  return <div className="peer-tag"><i />{name}</div>;
}

const LADDER_OUT: { text: string; ok?: boolean }[] = [
  { text: "• reaching 'bob' via glypha.duckdns.org..." },
  { text: '• trying direct to 203.0.113.7:34059...' },
  { text: '• direct failed — trying NAT traversal...' },
  { text: '• traversal failed — falling back to relay...' },
  { text: "● 'bob' verified against pinned key", ok: true },
  { text: '● connected via relay', ok: true },
];

const TROUBLE: AccItem[] = [
  {
    title: 'The punch fails behind carrier-grade NAT',
    body: <p>A CGNAT public IP is shared across thousands of subscribers — neither NAT delivers the peer&apos;s SYNs, so coordinated traversal can&apos;t succeed. The ladder notices and falls back to the relay automatically. Results from other topologies — symmetric NAT, IPv6-only, double NAT — are exactly what the project wants reported.</p>,
  },
  {
    title: "Peers can't find each other",
    body: <p>Both peers must reach the same rendezvous. If you self-host, port 7000 and 7001 must be open at <em>both</em> firewall layers — the provider&apos;s security group and the OS firewall. A closed layer at either level looks identical to an unreachable server.</p>,
  },
  {
    title: 'A loud impersonation warning on reconnect',
    body: <p>That&apos;s pinning doing its job: the peer&apos;s key no longer matches the one pinned at first contact. Re-verify through your trusted channel; if the change is unexpected, treat the connection as hostile — Glypha rejects it rather than silently reconnecting.</p>,
  },
];

export function QuickStart() {
  return (
    <section id="quickstart" data-shot="quickstart" className="hairtop">
      <div className="wrap">
        <SectionHead
          index="01" kicker="Quick start"
          title="From package to first message."
          lede="Every command below is real — the same ones from the README. The full walkthrough, including self-hosting with DuckDNS, lives in the repository."
        />

        <Reveal className="qs-step">
          <div className="qs-n">01</div>
          <div>
            <h3>Install</h3>
            <p className="qd">Python 3 and pip. Published on PyPI — one line, no build step.</p>
            <CmdLine cmd="pip install glypha" label="install command" />
          </div>
        </Reveal>

        <Reveal className="qs-step">
          <div className="qs-n">02</div>
          <div>
            <h3>Point at a rendezvous</h3>
            <p className="qd">One-time setup: maps peer names to endpoints and fingerprints. Use the public host, or your own if you self-host the infrastructure.</p>
            <CmdLine cmd="glypha config glypha.duckdns.org" label="config command" />
          </div>
        </Reveal>

        <Reveal className="qs-step">
          <div className="qs-n">03</div>
          <div>
            <h3>Start a chat</h3>
            <p className="qd">Two terminals, one per peer. You never choose a transport — the ladder does.</p>
            <PeerTag name="ALICE'S TERMINAL" />
            <CmdLine cmd="glypha chat alice bob" />
            <PeerTag name="BOB'S TERMINAL" />
            <CmdLine cmd="glypha chat bob alice" />
            <div className="term-out">
              {LADDER_OUT.map((l, i) => (
                <div key={i} className={l.ok ? 'ok' : undefined}>{l.text}</div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal className="qs-step">
          <div className="qs-n">04</div>
          <div>
            <h3>Verify once, then zero prompts</h3>
            <p className="qd">
              Compare fingerprints through a separate channel — a call, a text — and confirm with{' '}
              <code>yes</code>. That one human check pins the identity. Every later reconnect
              auto-verifies; a changed key is rejected loudly.
            </p>
            <div className="fpgs" aria-label="Fingerprint comparison">
              <span className="fpc">shown locally&nbsp;&nbsp;7F3A 9C1B 42DE 0817</span>
              <span className="fpc eq">via trusted channel&nbsp;&nbsp;<i>7F3A 9C1B 42DE 0817</i></span>
            </div>
            <p className="qd" style={{ margin: 0 }}>
              Your fingerprint is SHA-256 of your public key — identity lives in the key, so moving
              machines or directories never rebirths it.
            </p>
          </div>
        </Reveal>

        <Reveal className="qs-step">
          <div className="qs-n">01</div>
          <div>
            <h3>Talk</h3>
            <p className="qd">
              Chat bubbles, timestamps, connection events, slash commands.{' '}
              <code>/history</code> replays the encrypted local archive grouped by sender and day —
              SQLite only ever stores ciphertext.
            </p>
          </div>
        </Reveal>

        <Reveal className="qs-step">
          <div className="qs-n">06</div>
          <div>
            <h3>Same-LAN mode — zero setup</h3>
            <p className="qd">No rendezvous needed on a local network. The first machine prints the exact command for the second:</p>
            <PeerTag name="MACHINE A · LISTENER" />
            <CmdLine cmd="glypha listen 9999 alice" />
            <PeerTag name="MACHINE B · CONNECTOR" />
            <CmdLine cmd="glypha connect 192.168.1.6 9999 bob" />
          </div>
        </Reveal>

        <Reveal className="qs-step">
          <div className="qs-n">07</div>
          <div>
            <h3>Self-host the infrastructure</h3>
            <p className="qd">The rendezvous and relay ship inside the package. On any public machine:</p>
            <CmdLine cmd="glypha-rendezvous" />
            <CmdLine cmd="glypha-relay" />
            <p className="qd" style={{ margin: '14px 0 0' }}>
              Rendezvous on port 7000 (90s TTL), relay on 7001 — a blind byte-splice with no crypto
              library installed. Open both ports at both firewall layers, keep the hostname stable,
              then point both peers at it with <code>glypha config</code>.
            </p>
          </div>
        </Reveal>

        <Reveal className="qs-step">
          <div className="qs-n">08</div>
          <div>
            <h3>Troubleshooting</h3>
            <Accordion items={TROUBLE} />
          </div>
        </Reveal>
      </div>
    </section>
  );
}