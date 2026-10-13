import Lenis from 'lenis';

let lenis: Lenis | null = null;

export function initScroll(): void {
  if (typeof window === 'undefined') return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  lenis = new Lenis({ lerp: 0.11, anchors: { offset: -72 } });
  const raf = (t: number) => { lenis?.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
}

export function scrollToEl(el: HTMLElement | null): void {
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: -72 });
  else el.scrollIntoView({
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });
}