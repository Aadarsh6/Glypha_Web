import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { onFieldStats, type Stats } from '../engine/field';
import { Icon } from './ui';
import './nav.css';

const REPO = 'Aadarsh6/GLYPHA';
const REPO_URL = `https://github.com/${REPO}`;
const MIN_STARS_TO_SHOW = 1; // raise this if you would rather hide a small count

const LINKS = [
  { href: '#quickstart', id: 'quickstart', label: 'Quick start' },
  { href: '#ladder', id: 'ladder', label: 'How it works' },
  { href: '#notes', id: 'notes', label: 'Field notes' },
  { href: '#stack', id: 'stack', label: 'The stack' },
  { href: '#security', id: 'security', label: 'Security' },
];

/* live GitHub star count, cached for an hour (unauthenticated API allows 60 calls/hour/IP) */
const CACHE_KEY = 'glypha-stars';
function readCache(): number | null {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    return c && Date.now() - c.t < 3_600_000 ? c.n : null;
  } catch { return null; }
}
function useStars(): number | null {
  const [n, setN] = useState<number | null>(readCache);
  useEffect(() => {
    if (readCache() !== null) return;
    const ac = new AbortController();
    fetch(`https://api.github.com/repos/${REPO}`, { signal: ac.signal })
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (j && typeof j.stargazers_count === 'number') {
          setN(j.stargazers_count);
          try { localStorage.setItem(CACHE_KEY, JSON.stringify({ n: j.stargazers_count, t: Date.now() })); } catch { /* storage blocked */ }
        }
      })
      .catch(() => { /* offline or rate limited: the button simply shows no count */ });
    return () => ac.abort();
  }, []);
  return n;
}
const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));

/* the G from Glypha's own block wordmark */
const G = [' ███ ', '█    ', '█  ██', '█   █', ' ███ '];

function Mark() {
  return (
    <svg className="gn-mark" viewBox="0 0 25 25" aria-hidden="true">
      {G.flatMap((row, r) => [...row].map((ch, c) => ch === '█'
        ? <rect key={`${r}${c}`} x={c * 5} y={r * 5} width="4" height="4" style={{ ['--d' as string]: `${(r + c) * 40}ms` }} />
        : null))}
    </svg>
  );
}

function StarIcon() {
  return (
    <svg className="gn-staricon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8L12 2.5z" />
    </svg>
  );
}

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('');
  const [hover, setHover] = useState('');
  const [stats, setStats] = useState<Stats>({ nodes: 0, pkt: 0 });
  const [ind, setInd] = useState<{ x: number; w: number } | null>(null);
  const stars = useStars();
  const barRef = useRef<HTMLDivElement>(null);
  const linksRef = useRef<HTMLElement>(null);
  const els = useRef<Record<string, HTMLAnchorElement | null>>({});

  useEffect(() => onFieldStats(setStats), []);

  useEffect(() => {
    const fn = () => {
      setScrolled(window.scrollY > 10);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      barRef.current?.style.setProperty('--p', String(max > 0 ? Math.min(1, window.scrollY / max) : 0));
    };
    fn();
    window.addEventListener('scroll', fn, { passive: true });
    window.addEventListener('resize', fn);
    return () => { window.removeEventListener('scroll', fn); window.removeEventListener('resize', fn); };
  }, []);

  useEffect(() => {
    const spy = new IntersectionObserver(
      es => es.forEach(en => { if (en.isIntersecting) setActive(en.target.id); }),
      { rootMargin: '-40% 0px -40% 0px' },
    );
    LINKS.forEach(l => { const el = document.getElementById(l.id); if (el) spy.observe(el); });
    return () => spy.disconnect();
  }, []);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  /* sliding highlight: follows hover, rests on the section you are in */
  const target = hover || active;
  useLayoutEffect(() => {
    const place = () => {
      const el = els.current[target];
      setInd(el ? { x: el.offsetLeft, w: el.offsetWidth } : null);
    };
    place();
    const ro = new ResizeObserver(place);
    if (linksRef.current) ro.observe(linksRef.current);
    return () => ro.disconnect();
  }, [target]);

  const spot = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  const showCount = stars !== null && stars >= MIN_STARS_TO_SHOW;
  const starLabel = showCount ? `Star Glypha on GitHub, ${stars} stars so far` : 'Star Glypha on GitHub';

  return (
    <header className={`gn ${scrolled ? 'sc' : ''} ${open ? 'open' : ''}`}>
      <div className="gn-bar" ref={barRef} onPointerMove={spot}>
        <a className="gn-brand" href="#hero" aria-label="Glypha, back to top">
          <Mark />
          <span>GLYPHA</span>
        </a>

        <nav className="gn-links" aria-label="Primary" ref={linksRef} onPointerLeave={() => setHover('')}>
          <span className="gn-ind" aria-hidden="true"
            style={ind ? { transform: `translateX(${ind.x}px)`, width: ind.w, opacity: 1 } : undefined} />
          {LINKS.map(l => (
            <a key={l.href} href={l.href} ref={el => { els.current[l.id] = el; }}
              className={`gn-link ${active === l.id ? 'on' : ''}`}
              aria-current={active === l.id ? 'true' : undefined}
              onPointerEnter={() => setHover(l.id)} onFocus={() => setHover(l.id)} onBlur={() => setHover('')}>
              {l.label}
            </a>
          ))}
        </nav>

        <span className="gn-stat" title="Live glyph field behind this page">
          <i className="gn-live" />
          <b>{stats.nodes.toLocaleString()}</b> glyphs <u>/</u> <b>{stats.pkt}</b> pkt/s
        </span>

        <a className="gn-ghost" href="https://pypi.org/project/glypha/" target="_blank" rel="noopener">
          PyPI<Icon name="ext" size={12} />
        </a>

        <a className="gn-star" href={REPO_URL} target="_blank" rel="noopener" aria-label={starLabel}>
          <span className="gn-star-l"><StarIcon /><span className="gn-star-t">Star</span></span>
          {showCount && <span className="gn-star-r">{fmt(stars as number)}</span>}
        </a>

        <button className="gn-menu" aria-expanded={open} aria-controls="gn-sheet" aria-label="Menu"
          onClick={() => setOpen(!open)}>
          <span /><span />
        </button>

        <i className="gn-prog" aria-hidden="true"><b /></i>

        <div className="gn-sheet" id="gn-sheet">
          {LINKS.map((l, i) => (
            <a key={l.href} href={l.href} style={{ ['--i' as string]: i }} onClick={() => setOpen(false)}>
              {l.label}<Icon name="arrow" size={14} />
            </a>
          ))}
          <a href="https://pypi.org/project/glypha/" target="_blank" rel="noopener"
            style={{ ['--i' as string]: LINKS.length }} onClick={() => setOpen(false)}>
            PyPI<Icon name="ext" size={14} />
          </a>
        </div>
      </div>
    </header>
  );
}