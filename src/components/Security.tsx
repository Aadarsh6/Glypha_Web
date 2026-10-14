import { Icon, Reveal, SectionHead } from './ui';

const PROTECTS = [
  'Passive network observers — messages are AEAD-encrypted end to end',
  'Peer impersonation across reconnects — persistent identity, out-of-band verification, pin-based key-change detection',
  'Plaintext history at rest — SQLite holds only ciphertext, under a key separate from the identity key',
  'IP reassignment redefining who someone is — identity is the fingerprint',
  'Hostile framing — oversized and illegal headers rejected before allocation',
];

const DOES_NOT = [
  'Forward secrecy — static-static ECDH means a later private-key compromise can decrypt recorded traffic. No ratchet; that\u2019s Signal\u2019s territory',
  'Stolen key files — identity keys live unencrypted on disk',
  'Replay — no counters or nonces yet',
  'A malicious rendezvous — it can serve wrong endpoints. Pin cross-checks mitigate; TOFU doesn\u2019t eliminate',
  'Traffic analysis — endpoints, timing, and sizes remain visible',
  'Machine compromise — out of scope',
  'A hostile relay — it can drop or delay traffic (availability), but never read it',
];

export function Security() {
  return (
    <section id="security" data-shot="security" className="hairtop">
      <div className="wrap">
        <SectionHead
          index="04" kicker="Security model"
          title="Deliberately not Signal."
          lede="The gaps are stated, not implied. Glypha exists so you can read and understand every layer it stands on — which starts with knowing exactly where the guarantees end."
        />

        <Reveal>
          <div className="sec-grid">
            <div>
              <p className="plist-h yes">PROTECTS AGAINST</p>
              {PROTECTS.map(t => (
                <div key={t} className="ptrow yes"><Icon name="check" size={14} /><span>{t}</span></div>
              ))}
            </div>
            <div>
              <p className="plist-h no">DOES NOT PROTECT AGAINST</p>
              {DOES_NOT.map(t => (
                <div key={t} className="ptrow no"><Icon name="minus" size={14} /><span>{t}</span></div>
              ))}
            </div>
          </div>

          <div className="tofu">
            <b>first contact</b> <span className="arr">→</span> fingerprints displayed{' '}
            <span className="arr">→</span> human compares out-of-band <span className="arr">→</span>{' '}
            <b>pinned</b> <span className="arr">→</span> reconnects auto-verify <span className="arr">→</span>{' '}
            <span className="end">key change: loud rejection</span>
          </div>

          <p className="warnquote">
            Do not use Glypha for sensitive real-world communications. It exists so you can read
            and understand every layer it stands on.
          </p>

          <p className="obs-cap">
            <i />THE FIELD BEHIND THIS SECTION IS IN OBSERVER MODE — THE AMBER SPIKES ARE EVERYTHING
            A NETWORK CAN SEE. THE WORDS STAY GREEN.
          </p>
        </Reveal>
      </div>
    </section>
  );
}