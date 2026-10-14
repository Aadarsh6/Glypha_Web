import { useEffect, useState } from 'react';
import { onFieldStats, type Stats } from '../engine/field';
import { Decode, Icon, CopyButton } from './ui';

export function Hero() {
  const [stats, setStats] = useState<Stats>({ nodes: 0, pkt: 0 });
  useEffect(() => onFieldStats(setStats), []);

  return (
    <section id="hero" data-shot="hero" className="hero">
      <div className="wrap hero-col">

        <p className="kicker hero-top">PEER-TO-PEER ENCRYPTED CHAT · EVERY LAYER BY HAND</p>

        <div className="hero-mid">

<svg
  className="hero-mark"
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 320 320"
  fill="none"
  aria-hidden="true"
>
  <g fill="#ECEBE6">
    <rect x="104" y="32" width="48" height="48" rx="10" />
    <rect x="160" y="32" width="48" height="48" rx="10" />
    <rect x="216" y="32" width="48" height="48" rx="10" />

    <rect x="48" y="88" width="48" height="48" rx="10" />
    <rect x="48" y="144" width="48" height="48" rx="10" />
    <rect x="48" y="200" width="48" height="48" rx="10" />

    <rect x="104" y="256" width="48" height="32" rx="10" />
    <rect x="160" y="256" width="48" height="32" rx="10" />
    <rect x="216" y="200" width="48" height="48" rx="10" />
  </g>

  <rect
    x="160"
    y="144"
    width="48"
    height="48"
    rx="10"
    fill="#67DDA1"
  />
  <rect
    x="216"
    y="144"
    width="48"
    height="48"
    rx="10"
    fill="#67DDA1"
    fillOpacity=".18"
  />
</svg>


          <div className="wm-wrap">
            <h1 className="wordmark"><Decode text="GLYPHA" delay={150} /></h1>
            <span className="wm-ver" aria-hidden="true">v2.3</span>
          </div>

          <p className="hero-line">
            <Decode text="SOCKETS UP · KEYS LOCAL · RELAY WHEN NATS SAY NO" delay={650} />
          </p>

          <div className="cta-row">
            <a className="btn-key" href="#quickstart">
              GET STARTED<Icon name="arrow" size={13} />
            </a>
            <div className="inst">
              <span className="ip">$</span><code>pip install glypha</code>
              <CopyButton text="pip install glypha" label="install command" />
            </div>
          </div>

          <a className="hero-src" href="https://github.com/Aadarsh6/GLYPHA" target="_blank" rel="noopener">
            read the source<Icon name="arrow" size={11} />
          </a>

          <p className="hero-facts">
            X25519 · XSALSA20-POLY1305 · TOFU + KEY PINNING · ENCRYPTED SQLITE HISTORY · MIT
          </p>
        </div>

        <div className="hero-status" aria-label="Live field status">
          <span>FIELD <b>{stats.nodes.toLocaleString()} GLYPHS</b> · <b>{stats.pkt} PKT/S</b></span>
          <span className="fpv">YOU&nbsp; 7F3A 9C1B 42DE 0817 · PINNED</span>
          <span className="legend">
            <span><i className="g" />PACKET</span>
            <span><i className="a" />OBSERVER</span>
          </span>
          <span className="scr">SCROLL ↓ 01 · QUICK START</span>
        </div>

      </div>
    </section>
  );
}