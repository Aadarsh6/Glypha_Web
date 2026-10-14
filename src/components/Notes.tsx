import { Reveal, SectionHead } from './ui';

const NAT_ROWS: { attempt: string; result: string; ok: boolean }[] = [
  { attempt: 'Uncoordinated direct dial across the Internet', result: 'NAT rejected unsolicited inbound traffic (WinError 10060)', ok: false },
  { attempt: 'Simultaneous-open control test (loopback)', result: 'mechanics worked', ok: true },
  { attempt: 'Coordinated punch, home NAT ↔ carrier-grade NAT', result: 'neither NAT delivered the peer\u2019s SYNs', ok: false },
  { attempt: 'Relay fallback', result: 'both peers established outbound connections', ok: true },
];

export function Notes() {
  return (
    <section id="notes" data-shot="notes" className="hairtop">
      <div className="wrap">
        <SectionHead
          index="04" kicker="Field notes"
          title="Two honest failures."
          lede="Glypha's engineering log records what actually happened, including the parts that didn't work. Both entries below are from the real deployment."
        />

        <Reveal>
          <article className="entry">
            <div className="entry-head">
              <span className="eno">ENTRY 01 · THE NAT EXPERIMENT</span>
              <span className="emeta">rendezvous + relay on a cloud VM, Central India · peer A on home Wi-Fi · peer B on a mobile hotspot behind carrier-grade NAT</span>
            </div>
            <h3>The code is right. The networks refuse.</h3>
            <p>
              One public IP shared across thousands of subscribers — carrier-grade NAT is where
              traversal goes to die. Glypha doesn't hide this behind a "may not work in some
              networks" footnote; it runs the experiment, records the result, and ships the relay
              as the honest final rung.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table className="ntable">
                <thead><tr><th>ATTEMPT</th><th>RESULT</th></tr></thead>
                <tbody>
                  {NAT_ROWS.map(r => (
                    <tr key={r.attempt}>
                      <td>{r.attempt}</td>
                      <td className={`r ${r.ok ? 'yes' : 'no'}`}>{r.ok ? '✓' : '✗'} {r.result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="nq">The important result is the failure itself: the code performs the traversal attempt correctly while the network topology still prevents it.</p>
          </article>

          <article className="entry">
            <div className="entry-head">
              <span className="eno">ENTRY 02 · T+48 HOURS</span>
              <span className="emeta">the night the internet attacked</span>
            </div>
            <h3>A 4-byte header tried to allocate gigabytes.</h3>
            <p>
              Forty-eight hours after the rendezvous server became publicly reachable, internet
              scanners found it and began sending hostile length headers — the exact flaw that had
              been documented and deferred since V1, with the trigger <em>fix when remotely
              reachable</em>. The trigger fired on schedule: the unpatched receiver attempted
              multi-gigabyte allocations from a single 4-byte header, one MemoryError per
              connection thread.
            </p>
            <div className="frame-vis">
              [ len · 4 bytes ][ payload ≤ <b>1 MiB</b> ] <span className="cap">→ oversized frames rejected before allocation</span>
            </div>
            <p>
              The fix was a hard cap, already written and waiting: <code>MAX_MESSAGE_SIZE</code>.
              Deployed to the servers, the attack became silent drops. Shipped to every client in
              the next release. The incident, with before/after logs, lives in the project's
              engineering log — which is exactly why the framing section never says the cap is
              theoretical.
            </p>
          </article>
        </Reveal>
      </div>
    </section>
  );
}