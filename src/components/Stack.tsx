import { Icon, Reveal, SectionHead } from './ui';

const REPO = 'https://github.com/Aadarsh6/GLYPHA';

interface Layer { n: string; name: string; desc: string; file: string | null; href: string }

const LAYERS: Layer[] = [
  { n: '01', name: 'Chat & history', desc: 'Bubbles, banners, slash commands. /history replays the archive grouped by sender and day.', file: 'ui.py', href: `${REPO}/blob/main/ui.py` },
  { n: '02', name: 'Peer management', desc: 'The auto-fallback ladder — direct, punch, relay. You never pick a transport.', file: 'peer.py', href: `${REPO}/blob/main/peer.py` },
  { n: '03', name: 'Cryptographic identity', desc: 'Persistent keypairs in ~/.glypha/. Your fingerprint is SHA-256 of your public key.', file: 'identity.py', href: `${REPO}/blob/main/identity.py` },
  { n: '04', name: 'PyNaCl Box', desc: 'X25519 key exchange + XSalsa20-Poly1305 AEAD — the one import: the cipher itself.', file: null, href: 'https://pynacl.readthedocs.io/' },
  { n: '05', name: 'Custom framing', desc: '4-byte big-endian length prefix, hard 1 MiB cap, oversized frames rejected before allocation.', file: 'protocol.py', href: `${REPO}/blob/main/protocol.py` },
  { n: '06', name: 'Encrypted storage', desc: 'SQLite holds SecretBox ciphertext only, under a key separate from the identity key.', file: 'storage.py', href: `${REPO}/blob/main/storage.py` },
  { n: '07', name: 'Rendezvous', desc: 'Maps peer names to endpoints and fingerprints. Port 7000, 90-second registration TTL.', file: 'rendezvous_server.py', href: `${REPO}/blob/main/rendezvous_server.py` },
  { n: '08', name: 'Blind relay', desc: 'Splices two outbound TCP streams. No keys, no parsing — availability, never secrecy.', file: 'relay_server.py', href: `${REPO}/blob/main/relay_server.py` },
];

export function Stack() {
  return (
    <section id="stack" data-shot="stack" className="hairtop">
      <div className="wrap">
        <SectionHead
          index="01" kicker="The stack"
          title="Implemented, not imported."
          lede="Most chat tutorials hand you a networking SDK and never explain what's underneath. Glypha goes the other direction — every layer is readable Python, and every engineering decision, including the failures, is documented."
        />
        <Reveal>
          {LAYERS.map(l => (
            <a key={l.n} className="layer" href={l.href} target="_blank" rel="noopener">
              <span className="lay-n">{l.n}</span>
              <span className="lay-name">{l.name}</span>
              <span className="lay-desc">{l.desc}</span>
              <span className="lay-file">
                {l.file ?? 'external'}
                <Icon name={l.file ? 'ext' : 'arrow'} size={12} />
              </span>
            </a>
          ))}
        </Reveal>
      </div>
    </section>
  );
}