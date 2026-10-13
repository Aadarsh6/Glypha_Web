import { useEffect, useState } from 'react';
import { Icon } from './ui';

const LINKS = [
  { href: '#how-it-works', id: 'how-it-works', label: 'How it works' },
  { href: '#security', id: 'security', label: 'Security' },
  { href: '#quickstart', id: 'quickstart', label: 'Quick start' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('');

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8);
    fn();
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    const spy = new IntersectionObserver(
      es => es.forEach(en => { if (en.isIntersecting) setActive(en.target.id); }),
      { rootMargin: '-45% 0px -50% 0px' },
    );
    LINKS.forEach(l => { const el = document.getElementById(l.id); if (el) spy.observe(el); });
    return () => spy.disconnect();
  }, []);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  return (
    <header id="nav" className={`${scrolled ? 'sc' : ''} ${open ? 'open' : ''}`}>
      <div className="wrap">
        <a className="brand" href="#hero" aria-label="Glypha — back to top">
          <svg className="logo-g" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="6.5" cy="17.5" r="4.2" />
            <circle cx="17.5" cy="6.5" r="4.2" />
            <line x1="9.7" y1="14.3" x2="14.3" y2="9.7" />
          </svg>
          GLYPHA
        </a>

        <nav className="nlinks" aria-label="Primary">
          {LINKS.map(l => (
            <a key={l.href} className={`nlink ${active === l.id ? 'on' : ''}`} href={l.href}>{l.label}</a>
          ))}
          <a className="ghnav" href="https://github.com/Aadarsh6/glypha" target="_blank" rel="noopener">
            <Icon name="github" size={16} />GitHub<Icon name="ext" size={12} />
          </a>
        </nav>

        <button
          id="menu-btn" aria-expanded={open} aria-controls="mnav" aria-label="Menu"
          onClick={() => setOpen(!open)}
        >
          <Icon name="minus" />
        </button>

        <div className="mnav" id="mnav">
          {LINKS.map(l => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
              {l.label} <Icon name="arrow" size={13} />
            </a>
          ))}
          <a href="https://github.com/Aadarsh6/glypha" target="_blank" rel="noopener" onClick={() => setOpen(false)}>
            GitHub <Icon name="ext" size={13} />
          </a>
        </div>
      </div>
    </header>
  );
}