import { Icon } from './ui';

const REPO = 'https://github.com/Aadarsh6/glypha';

export function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <a className="brand" href="#hero">
              <svg className="logo-g" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="6.5" cy="17.5" r="4.2" />
                <circle cx="17.5" cy="6.5" r="4.2" />
                <line x1="9.7" y1="14.3" x2="14.3" y2="9.7" />
              </svg>
              GLYPHA
            </a>
            <p className="fdesc">
              An open-source Python tool for encrypted peer-to-peer messaging — persistent
              identities, verifiable fingerprints, encrypted local history.
            </p>
          </div>
          <div>
            <p className="fh">PROJECT</p>
            <a className="fl" href={REPO} target="_blank" rel="noopener">GitHub</a>
            <a className="fl" href="https://pypi.org/project/glypha/" target="_blank" rel="noopener">PyPI</a>
            <a className="fl" href={`${REPO}/issues`} target="_blank" rel="noopener">Issues</a>
          </div>
          <div>
            <p className="fh">DEVELOP</p>
            <a className="fl" href={`${REPO}#readme`} target="_blank" rel="noopener">README</a>
            <a className="fl" href={`${REPO}#readme`} target="_blank" rel="noopener">Contributing</a>
            <a className="fl" href={REPO} target="_blank" rel="noopener">License — see repository</a>
          </div>
        </div>
        <div className="fbot">
          <span>GLYPHA · PEER-TO-PEER ENCRYPTED CHAT</span>
          <span>STATIC SITE · NO TRACKERS · {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}