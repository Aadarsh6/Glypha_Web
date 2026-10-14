const REPO = 'https://github.com/Aadarsh6/GLYPHA';

export function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="fbot">
          <span>GLYPHA · SOCKETS UP · KEYS LOCAL · RELAY WHEN NATS SAY NO</span>
          <span>
            <a href={REPO} target="_blank" rel="noopener" style={{ color: 'inherit', textDecoration: 'none' }}>GITHUB</a>
            {' · '}
            <a href="https://pypi.org/project/glypha/" target="_blank" rel="noopener" style={{ color: 'inherit', textDecoration: 'none' }}>PYPI</a>
            {' · MIT · 22 TESTS · NO TRACKERS'}
          </span>
        </div>
      </div>
    </footer>
  );
}