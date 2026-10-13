import { Icon, Reveal, SectionHeader, Accordion, type AccItem } from './ui';

const PROTECTS = [
  'Message contents on the wire — encrypted in transit between the peers.',
  'Impersonation — identities are keypairs, verified by fingerprint comparison.',
  'Casual local snooping — the on-disk history archive is encrypted.',
];

const DOES_NOT = [
  'IP exposure — each peer sees the other\u2019s address; networks see who connects to whom.',
  'Traffic analysis — timing and volume patterns remain observable.',
  'Compromised endpoints — a compromised device reads messages before encryption can help.',
  'Connectivity guarantees — restrictive NATs can prevent a direct path.',
];

// VERIFY: each claim below against the implementation before publishing.
const DETAILS: AccItem[] = [
  {
    title: 'Encryption in transit',
    body: <p>Messages are encrypted between the two peers and authenticated, so a modified message fails verification instead of arriving silently altered. Only the peers&apos; keys can decrypt the traffic — the rendezvous used to coordinate the introduction cannot read messages. The exact cipher is defined in the source.</p>,
  },
  {
    title: 'Fingerprints and identity',
    body: <p>Each peer holds a persistent keypair; the fingerprint is a digest of the public key. Compare it through a channel you already trust — in person, on a call, in a signed message. A matching fingerprint tells you the key you&apos;re encrypting to belongs to your peer and not an impostor. On a mismatch: stop and re-verify.</p>,
  },
  {
    title: 'Local history at rest',
    body: <p>Conversation history is written to disk encrypted, not in the clear. The key material lives on your machine — there is no server-side copy to leak. If the local key is lost, the history can&apos;t be read.</p>,
  },
  {
    title: 'What stays visible',
    body: <p>Glypha is not anonymous. Peers see each other&apos;s IP addresses; networks in between can observe connection timing and volume; a rendezvous knows that peers exist and when they coordinate. Message contents are protected — the existence of the conversation is not hidden.</p>,
  },
  {
    title: 'Endpoints and connectivity',
    body: <p>Encryption ends at the endpoints — a compromised device defeats everything. And connectivity is a property of the network, not the protocol: restrictive NATs and firewalls can block a direct path between peers. Better an honest failure than a silent detour.</p>,
  },
];

export function SecuritySection() {
  return (
    <section id="security" className="hairtop">
      <div className="wrap">
        <SectionHeader
          index="04" label="Security & threat model"
          title="Trust is something you verify."
          lede="Every claim below is scoped to what the code actually does. Where something is out of scope, it says so plainly."
        />
        <div className="grid items-start gap-[clamp(28px,4vw,64px)] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <Reveal>
            <div className="plist">
              <div className="plh yes"><Icon name="check" />PROTECTS AGAINST</div>
              {PROTECTS.map(t => (
                <div key={t} className="pli yes"><Icon name="check" /><span>{t}</span></div>
              ))}
            </div>
            <div className="plist">
              <div className="plh no"><Icon name="minus" />DOES NOT PROTECT AGAINST</div>
              {DOES_NOT.map(t => (
                <div key={t} className="pli no"><Icon name="minus" /><span>{t}</span></div>
              ))}
            </div>
            <p className="secnote">
              This page claims no anonymity and no audits. The source is the specification — read
              it before you trust it.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <Accordion items={DETAILS} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}