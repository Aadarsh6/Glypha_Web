import { Icon, CopyButton, Reveal, SectionHeader } from './ui';

const REPO = 'https://github.com/Aadarsh6/glypha';

const ROWS = [
  { k: 'REPOSITORY', v: 'github.com/Aadarsh6/glypha', href: REPO },
  { k: 'PACKAGE', v: 'pypi.org/project/glypha', href: 'https://pypi.org/project/glypha/' },
  { k: 'ISSUES', v: 'report a bug · propose a change', href: `${REPO}/issues` },
  { k: 'README', v: 'documentation & contributing', href: `${REPO}#readme` },
  { k: 'LICENSE', v: 'see the repository', href: REPO },
];

export function OpenSourceCTA() {
  return (
    <section id="source" className="hairtop">
      <div className="wrap">
        <div className="grid items-start gap-[clamp(28px,4vw,72px)] lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
          <Reveal>
            <SectionHeader
              index="06" label="Source"
              title={<>Inspect the code.<br />Improve the connection.</>}
            />
            <p className="lede" style={{ marginBottom: 28 }}>
              Glypha is developed in the open. Every claim on this page can be checked against the
              implementation — and every issue, fix, and idea is welcome.
            </p>
            <a className="btn btn-primary" href={REPO} target="_blank" rel="noopener">
              <Icon name="github" size={16} />Star on GitHub
            </a>
            <div className="cmdblock" style={{ marginTop: 24 }}>
              <div className="cmd">
                <span className="cmd-p">$</span><code>git clone {REPO}</code>
                <CopyButton text={`git clone ${REPO}`} label="clone command" />
              </div>
            </div>
          </Reveal>

          <Reveal delay={100}>
            {ROWS.map(r => (
              <a key={r.k} className="osrow" href={r.href} target="_blank" rel="noopener">
                <span className="os-k">{r.k}</span>
                <span className="osv">{r.v}</span>
                <Icon name="ext" />
              </a>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  );
}