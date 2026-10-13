import { CopyButton, Reveal, SectionHeader, Accordion, type AccItem } from './ui';

function Cmd({ cmd, label, out }: { cmd: string; label?: string; out?: string }) {
  return (
    <div className="cmdblock">
      <div className="cmd">
        <span className="cmd-p">$</span><code>{cmd}</code>
        <CopyButton text={cmd} label={label ?? 'command'} />
      </div>
      {out ? <div className="cmd-out">{out}</div> : null}
    </div>
  );
}

const TROUBLE: AccItem[] = [
  {
    title: "Peers can't find each other",
    body: <p>Confirm both peers reference the same rendezvous and that it&apos;s reachable. A restrictive NAT or firewall on either side can prevent a direct path — connectivity depends on both networks.</p>,
  },
  {
    title: 'Fingerprint mismatch',
    body: <p>Don&apos;t talk. A mismatch means the key you&apos;re encrypting to is not the one your peer actually holds. Re-verify over your trusted channel; if it still differs, treat the connection as hostile.</p>,
  },
  {
    title: "Encrypted history won't open",
    body: <p>History is encrypted at rest with local key material. If the identity or key files were moved or deleted, the archive can&apos;t be decrypted — that&apos;s the design working, not failing. Check the README for the current details.</p>,
  },
];

export function QuickStart() {
  return (
    <section id="quickstart" className="hairtop">
      <div className="wrap">
        <SectionHeader index="05" label="Quick start" title="From package to first message." />

        <Reveal className="qnote">
          <b>NOTE</b>
          <span>
            Exact CLI syntax in this section is illustrative for the demo — confirm flags for your
            installed version with <code style={{ fontFamily: 'var(--font-mono)' }}>glypha --help</code> and the README.
          </span>
        </Reveal>

        {/* VERIFY: Python version requirement against pyproject.toml / README */}
        <Reveal className="qs-step grid grid-cols-[64px_minmax(0,1fr)] gap-x-6">
          <div className="qs-n">01</div>
          <div>
            <h3>Prerequisites</h3>
            <p className="qd">Python 3.10 or newer and pip. Glypha is a terminal tool — everything below happens in your shell.</p>
            <Cmd cmd="python3 --version" />
          </div>
        </Reveal>

        <Reveal className="qs-step grid grid-cols-[64px_minmax(0,1fr)] gap-x-6">
          <div className="qs-n">02</div>
          <div>
            <h3>Install</h3>
            <p className="qd">Glypha is published on PyPI. One line, no build step.</p>
            <Cmd cmd="pip install glypha" label="install command" />
          </div>
        </Reveal>

        {/* VERIFY: rendezvous configuration step against the README */}
        <Reveal className="qs-step grid grid-cols-[64px_minmax(0,1fr)] gap-x-6">
          <div className="qs-n">03</div>
          <div>
            <h3>Point at a rendezvous</h3>
            <p className="qd">
              Peers find each other through a rendezvous point used for coordination — introductions,
              not message storage. Both peers must reference the same rendezvous. Check the README for
              the current configuration step for your version.
            </p>
            <Cmd cmd="glypha --help" out="lists available commands, flags, and rendezvous options for your version" />
          </div>
        </Reveal>

        {/* VERIFY: exact session commands against README / CLI help */}
        <Reveal className="qs-step grid grid-cols-[64px_minmax(0,1fr)] gap-x-6">
          <div className="qs-n">04</div>
          <div>
            <h3>Start a peer, connect a peer</h3>
            <p className="qd">Open two terminals — one for each peer. The first starts and prints its fingerprint; the second connects to it.</p>
            <div className="grid max-w-[820px] gap-4 sm:grid-cols-2">
              <div className="cmdblock" style={{ maxWidth: 'none' }}>
                <div className="mt-h"><span>TERMINAL A · PEER ALPHA</span><span>SIMULATED</span></div>
                <div className="cmd">
                  <span className="cmd-p">$</span><code>glypha start</code>
                  <CopyButton text="glypha start" />
                </div>
                <div className="cmd-out">
                  identity loaded — fingerprint:<br />
                  &nbsp;&nbsp;7F3A 9C1B 42DE 0817 E5C0 61AA 3B9D F2E4<br />
                  listening for peers …
                </div>
              </div>
              <div className="cmdblock" style={{ maxWidth: 'none' }}>
                <div className="mt-h"><span>TERMINAL B · PEER BRAVO</span><span>SIMULATED</span></div>
                <div className="cmd">
                  <span className="cmd-p">$</span><code>glypha connect</code>
                  <CopyButton text="glypha connect" />
                </div>
                <div className="cmd-out">
                  peer found — verify the fingerprint<br />
                  before sending anything sensitive
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal className="qs-step grid grid-cols-[64px_minmax(0,1fr)] gap-x-6">
          <div className="qs-n">05</div>
          <div>
            <h3>Verify fingerprints</h3>
            <p className="qd">
              Compare what your terminal shows against what your peer tells you out-of-band — read it
              aloud on a call, show it in person, send it signed. The two lines must match exactly.
            </p>
            <div className="fpgs" aria-label="Fingerprint comparison example">
              <span className="fpc">shown locally&nbsp;&nbsp;7F3A 9C1B 42DE 0817</span>
              <span className="fpc eq">via trusted channel&nbsp;&nbsp;<i>7F3A 9C1B 42DE 0817</i></span>
            </div>
            <p className="qd" style={{ margin: 0 }}>
              A mismatch means the key isn&apos;t your peer&apos;s. Stop and re-verify before exchanging anything sensitive.
            </p>
          </div>
        </Reveal>

        <Reveal className="qs-step grid grid-cols-[64px_minmax(0,1fr)] gap-x-6">
          <div className="qs-n">06</div>
          <div>
            <h3>Send the first message</h3>
            <p className="qd">
              Type and send. Messages are encrypted in transit, arrive authenticated, and land in an
              encrypted local history on each side. Try it interactively in the{' '}
              <a href="#how-it-works" style={{ color: 'var(--color-accent)', textDecoration: 'none' }}>Network Lab</a> above.
            </p>
          </div>
        </Reveal>

        <Reveal className="qs-step grid grid-cols-[64px_minmax(0,1fr)] gap-x-6">
          <div className="qs-n">07</div>
          <div>
            <h3>Troubleshooting</h3>
            <Accordion items={TROUBLE} />
          </div>
        </Reveal>
      </div>
    </section>
  );
}