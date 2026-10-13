import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useReducedMotion } from '../hooks';

/* ---------- icons ---------- */
const ICONS = {
  github: { viewBox: '0 0 16 16', fill: true, node: <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" /> },
  copy: { viewBox: '0 0 24 24', fill: false, node: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></> },
  check: { viewBox: '0 0 24 24', fill: false, node: <polyline points="20 6 9 17 4 12" /> },
  play: { viewBox: '0 0 24 24', fill: false, node: <polygon points="6 4 20 12 6 20 6 4" /> },
  pause: { viewBox: '0 0 24 24', fill: false, node: <><line x1="9" y1="5" x2="9" y2="19" /><line x1="15" y1="5" x2="15" y2="19" /></> },
  replay: { viewBox: '0 0 24 24', fill: false, node: <><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></> },
  reset: { viewBox: '0 0 24 24', fill: false, node: <><polygon points="19 20 9 12 19 4 19 20" /><line x1="5" y1="19" x2="5" y2="5" /></> },
  ext: { viewBox: '0 0 24 24', fill: false, node: <><line x1="7" y1="17" x2="17" y2="7" /><polyline points="8 7 17 7 17 16" /></> },
  chev: { viewBox: '0 0 24 24', fill: false, node: <polyline points="6 9 12 15 18 9" /> },
  arrow: { viewBox: '0 0 24 24', fill: false, node: <><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></> },
  minus: { viewBox: '0 0 24 24', fill: false, node: <line x1="5" y1="12" x2="19" y2="12" /> },
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 15, className }: { name: IconName; size?: number; className?: string }) {
  const d = ICONS[name];
  return (
    <svg
      className={`ic ${d.fill ? 'ic-f' : ''} ${className ?? ''}`}
      width={size} height={size} viewBox={d.viewBox} aria-hidden="true"
    >
      {d.node}
    </svg>
  );
}

/* ---------- copy button ---------- */
function legacyCopy(text: string): boolean {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  let ok: boolean;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}

export function CopyButton({ text, label = 'command', className }: { text: string; label?: string; className?: string }) {
  const [ok, setOk] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onCopy = async () => {
    let success = true;
    try { await navigator.clipboard.writeText(text); }
    catch { success = legacyCopy(text); }
    if (success) {
      setOk(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setOk(false), 1800);
    }
  };

  return (
    <button type="button" onClick={onCopy} className={`copy ${ok ? 'ok' : ''} ${className ?? ''}`} aria-label={`Copy ${label}`}>
      <Icon name={ok ? 'check' : 'copy'} size={13} />
      <span className="cpt">{ok ? 'copied' : 'copy'}</span>
      <span className="vh" aria-live="polite">{ok ? `Copied: ${text}` : ''}</span>
    </button>
  );
}

/* ---------- reveal-on-scroll wrapper ---------- */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      es => es.forEach(e => { if (e.isIntersecting) { setInView(true); io.disconnect(); } }),
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  const style = delay ? ({ '--d': `${delay}ms` } as CSSProperties) : undefined;
  return (
    <div ref={ref} className={`rv ${reduced || inView ? 'in' : ''} ${className ?? ''}`} style={style}>
      {children}
    </div>
  );
}

/* ---------- section header ---------- */
export function SectionHeader({ index, label, title, lede }: { index: string; label: string; title: ReactNode; lede?: ReactNode }) {
  return (
    <Reveal className="shead">
      <p className="tag"><b>{index}</b> {label}</p>
      <h2>{title}</h2>
      {lede ? <p className="lede">{lede}</p> : null}
    </Reveal>
  );
}

/* ---------- accordion ---------- */
export interface AccItem { title: string; body: ReactNode; }

export function Accordion({ items, className }: { items: AccItem[]; className?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className={className}>
      {items.map((it, i) => (
        <div key={i} className={`acc ${open === i ? 'open' : ''}`}>
          <button className="acc-h" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
            <span>{it.title}</span>
            <Icon name="chev" />
          </button>
          <div className="acc-body">
            <div className="acc-inner">
              <div className="acc-i">{it.body}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}