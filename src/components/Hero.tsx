import { useEffect, useState } from 'react';
import { onFieldStats } from '../engine/field';
import { Decode, Icon, CopyButton } from './ui';

type Stats = { nodes: number; pkt: number };

export function Hero() {
  const [stats, setStats] = useState<Stats>({ nodes: 0, pkt: 0 });
  useEffect(() => onFieldStats(setStats), []);

  return (
    <section id="hero" data-shot="hero" className="hero">
      <div className="wrap hero-col">

        <p className="kicker hero-top">PEER-TO-PEER ENCRYPTED CHAT · EVERY LAYER BY HAND</p>

        <div className="hero-mid">
          <svg className="hero-mark" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="6.5" cy="17.5" r="4.2" />
            <circle cx="17.5" cy="6.5" r="4.2" />
            <line x1="9.7" y1="14.3" x2="14.3" y2="9.7" />
          </svg>

          <div className="wm-wrap">
            <h1 className="wordmark"><Decode text="GLYPHA" delay={150} /></h1>
            <span className="wm-ver" aria-hidden="true">v2.3</span>
          </div>

          <p className="hero-line">
            <Decode text="SOCKETS UP · KEYS LOCAL · RELAY WHEN NATS SAY NO" delay={650} />
          </p>

          <div className="cta-row">
            <a className="btn btn-primary" href="#quickstart">Get started</a>
            <a className="tlink" href="https://github.com/Aadarsh6/GLYPHA" target="_blank" rel="noopener">
              Read the source<Icon name="arrow" size={14} />
            </a>
          </div>

          <div className="inst">
            <span className="ip">$</span><code>pip install glypha</code>
            <CopyButton text="pip install glypha" label="install command" />
          </div>

          <p className="hero-facts">
            X25519 · XSALSA20-POLY1305 · TOFU + KEY PINNING · ENCRYPTED SQLITE HISTORY · MIT
          </p>
        </div>

        <div className="hero-status" aria-label="Live field status">
          <span>FIELD <b>{stats.nodes} NODES · {stats.pkt} PKT/S</b></span>
          <span className="fpv">YOU&nbsp; 7F3A 9C1B 42DE 0817 · PINNED</span>
          <span className="legend">
            <span><i className="g" />PEER</span>
            <span><i className="a" />OBSERVER</span>
          </span>
          <span className="scr">SCROLL ↓ 01 · THE STACK</span>
        </div>

      </div>
    </section>
  );
}