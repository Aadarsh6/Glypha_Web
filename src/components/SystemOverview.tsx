import { Reveal, SectionHeader } from './ui';

const ROWS = [
  {
    n: '01', title: 'Peers, not servers',
    p: 'Messages travel directly between you and your peer. A rendezvous point helps peers find each other — it\u2019s an introducer, not a message warehouse. There is no inbox sitting on someone else\u2019s machine.',
    glyph: (
      <svg className="sys-g" width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
        <circle className="st" cx="11" cy="33" r="6" /><circle className="st" cx="33" cy="11" r="6" />
        <line className="ac" x1="16" y1="28" x2="28" y2="16" />
      </svg>
    ),
    kv: <>transport · <b>peer ↔ peer</b><br />rendezvous · <b>coordination</b></>,
  },
  {
    n: '02', title: 'Identity you can hold',
    p: 'Each peer keeps a persistent keypair — no accounts, no usernames on a server. The fingerprint is a short, quotable digest of the public key that you can compare over a channel you trust before you say anything sensitive.',
    glyph: (
      <svg className="sys-g" width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
        <line className="st" x1="8" y1="14" x2="36" y2="14" /><line className="st" x1="8" y1="22" x2="28" y2="22" />
        <line className="ac" x1="8" y1="30" x2="36" y2="30" />
      </svg>
    ),
    kv: <>identity · <b>persistent keypair</b><br />verify · <b>fingerprint digest</b></>,
  },
  {
    n: '03', title: 'Encrypted, including at rest',
    p: 'Messages are encrypted in transit between peers — and the history saved on your own disk is encrypted too. The key material lives on your machine, not in a server-side archive waiting to leak.',
    glyph: (
      <svg className="sys-g" width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
        <rect className="st" x="8" y="10" width="28" height="24" rx="4" />
        <circle className="acf" cx="22" cy="22" r="4" />
      </svg>
    ),
    kv: <>in transit · <b>encrypted</b><br />on disk · <b>encrypted history</b></>,
  },
];

export function SystemOverview() {
  return (
    <section id="system" className="hairtop">
      <div className="wrap">
        <SectionHeader
          index="03" label="System"
          title="Small surface. Explicit trust."
          lede="Glypha does three things and is honest about the boundaries of each."
        />
        <Reveal>
          {ROWS.map(r => (
            <div key={r.n} className="sysrow grid grid-cols-[40px_minmax(0,1fr)] items-start gap-x-7 md:grid-cols-[56px_1fr_300px]">
              <div className="sys-n">{r.n}</div>
              <div>
                <h3>{r.title}</h3>
                <p>{r.p}</p>
              </div>
              <div className="mt-4 flex items-center gap-5 md:mt-0 md:justify-self-end md:text-right">
                {r.glyph}
                <div className="sys-kv">{r.kv}</div>
              </div>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}