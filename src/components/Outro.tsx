import { Icon, CopyButton, Reveal, SectionHead } from './ui';

const REPO = 'https://github.com/Aadarsh6/GLYPHA';

const ROWS = [
  { k: 'REPOSITORY', v: 'github.com/Aadarsh6/GLYPHA', href: REPO },
  { k: 'PACKAGE', v: 'pypi.org/project/glypha', href: 'https://pypi.org/project/glypha/' },
  { k: 'ENGINEERING LOG', v: 'project.md — every milestone, every bug', href: `${REPO}/blob/main/project.md` },
  { k: 'ISSUES', v: 'report a bug · propose a change', href: `${REPO}/issues` },
  { k: 'LICENSE', v: 'MIT', href: `${REPO}/blob/main/LICENSE` },
];

export function Outro() {
  return (
    <section id="source" data-shot="source" className="hairtop">
      <div className="wrap">
        <SectionHead
          index="06" kicker="Source"
          title="Read the code. Improve the connection."
          lede="Bug reports, pull requests, and NAT-behavior results from topologies not yet measured — symmetric NAT, IPv6-only, double NAT. Run Glypha behind your network and report what happens. That's the data this project is built to collect."
        />
        <Reveal>
          <div className="cmdline" style={{ marginBottom: 34 }}>
            <span className="p">$</span>
            <code>git clone {REPO}</code>
            <CopyButton text={`git clone ${REPO}`} label="clone command" />
          </div>
          {ROWS.map(r => (
            <a key={r.k} className="osrow" href={r.href} target="_blank" rel="noopener">
              <span className="os-k">{r.k}</span>
              <span className="osv">{r.v}</span>
              <Icon name="ext" size={14} />
            </a>
          ))}
        </Reveal>
      </div>
    </section>
  );
}