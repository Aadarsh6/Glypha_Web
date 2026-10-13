import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../hooks';
import { Icon, CopyButton, Reveal } from './ui';
import { TerminalDemo } from './TerminalDemo';
// import { TerminalDemo } from './TerminalDemo';

function FieldCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const hero = cv.parentElement as HTMLElement;

    const GAP = 30;
    let W = 0, H = 0;
    let dots: { x: number; y: number }[] = [];
    type Pk = { x: number; y: number; dx: number; dy: number; t: number; len: number };
    const pk: Pk[] = [];
    let mx = -1e4, my = -1e4;
    let run = false;
    let raf = 0;
    let lastSpawn = 0;

    const staticDraw = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(233,236,231,.055)';
      for (const d of dots) ctx.fillRect(d.x - .75, d.y - .75, 1.5, 1.5);
    };

    const resize = () => {
      const r = hero.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width; H = r.height;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = [];
      for (let y = GAP / 2; y < H; y += GAP)
        for (let x = GAP / 2; x < W; x += GAP) dots.push({ x, y });
      if (reduced) staticDraw();
    };

    const frame = (ts: number) => {
      raf = requestAnimationFrame(frame);
      if (!run || reduced) return;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(233,236,231,.055)';
      for (const d of dots) ctx.fillRect(d.x - .75, d.y - .75, 1.5, 1.5);
      for (const d of dots) {
        const dist = Math.hypot(d.x - mx, d.y - my);
        if (dist < 160) {
          const a = .06 + (1 - dist / 160) * .30;
          ctx.fillStyle = `rgba(103,221,161,${a.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(d.x, d.y, 1.1, 0, 7);
          ctx.fill();
        }
      }
      if (ts - lastSpawn > 900 + Math.random() * 900 && pk.length < 6) {
        lastSpawn = ts;
        const s = dots[(Math.random() * dots.length) | 0];
        const ang = Math.random() * Math.PI * 2;
        const len = GAP * (2 + ((Math.random() * 4) | 0));
        pk.push({ x: s.x, y: s.y, dx: Math.cos(ang), dy: Math.sin(ang), t: 0, len });
      }
      ctx.lineWidth = 1;
      for (let i = pk.length - 1; i >= 0; i--) {
        const p = pk[i];
        p.t += 1 / 42;
        if (p.t >= 1) { pk.splice(i, 1); continue; }
        const x = p.x + p.dx * p.len * p.t, y = p.y + p.dy * p.len * p.t;
        ctx.strokeStyle = 'rgba(103,221,161,.25)';
        ctx.beginPath();
        ctx.moveTo(x - p.dx * 6, y - p.dy * 6);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    };

    const onMove = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      mx = e.clientX - r.left; my = e.clientY - r.top;
    };
    const onLeave = () => { mx = -1e4; my = -1e4; };

    const io = new IntersectionObserver(es => {
      run = es[0].isIntersecting && !reduced;
      if (reduced && es[0].isIntersecting) staticDraw();
    });
    io.observe(hero);
    hero.addEventListener('pointermove', onMove, { passive: true });
    hero.addEventListener('pointerleave', onLeave);
    window.addEventListener('resize', resize);
    resize();
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      hero.removeEventListener('pointermove', onMove);
      hero.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('resize', resize);
    };
  }, [reduced]);

  return <canvas id="field" ref={ref} aria-hidden="true" />;
}

export function Hero() {
  return (
    <section id="hero">
      <FieldCanvas />
      <div className="wrap relative z-[1] grid w-full items-center gap-[clamp(24px,3vw,48px)] lg:grid-cols-12">
        <div className="lg:col-span-5">
          <p className="tag"><b>Open source</b> · Python · peer-to-peer</p>
          <h1>
            Not another chat server.
            <span className="l2">A connection between peers.</span>
          </h1>
          <p className="hero-p">
            An open-source Python tool for encrypted peer-to-peer messaging, with persistent
            identities and verifiable peer fingerprints. No accounts — your keys are your identity.
          </p>
          <div className="cta-row">
            <a className="btn btn-primary" href="#quickstart">Get started</a>
            <a className="btn btn-ghost" href="https://github.com/Aadarsh6/glypha" target="_blank" rel="noopener">
              <Icon name="github" size={16} />Explore the source
            </a>
          </div>
          <div className="inst">
            <span className="ip">$</span><code>pip install glypha</code>
            <CopyButton text="pip install glypha" label="install command" />
          </div>
        </div>

        <Reveal delay={120} className="lg:col-span-7 min-w-0">
          <TerminalDemo />
        </Reveal>
      </div>
    </section>
  );
}