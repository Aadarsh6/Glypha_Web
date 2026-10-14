import { useEffect, useState } from 'react';
import { onFieldStats, type Stats } from '../engine/field';
import { Decode } from './ui';
import { Icon, CopyButton } from './ui';

function HeroSide() {
  const [stats, setStats] = useState<Stats>({ nodes: 0, pkt: 0 });
  useEffect(() => onFieldStats(setStats), []);
  return (
    <div className="hero-side" aria-hidden="true">
      <div className="hs">
        <span className="hs-k">LIVE FIELD</span>
        <span className="hs-v live">{stats.nodes} NODES · {stats.pkt} PKT/S</span>
      </div>
      <div className="hs">
        <span className="hs-k">YOU</span>
        <span className="hs-v">7F3A 9C1B 42DE 0817</span>
        <span className="hs-v">E5C0 61AA 3B9D F2E4</span>
        <span className="hs-s">SHA-256 PUBLIC KEY · PINNED</span>
      </div>
      <div className="hs legend">
        <span><i className="g" />PEER</span>
        <span><i className="a" />OBSERVER</span>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section id="hero" data-shot="hero" className="hero">
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <p className="kicker">GLYPHA · PEER-TO-PEER ENCRYPTED CHAT · EVERY LAYER BY HAND</p>
          <h1 className="h1">
            <Decode text="Sockets up." delay={0} /><br />
            <Decode text="Keys local." delay={220} /><br />
            <span className="l2"><Decode text="Relay when NATs say no." delay={440} /></span>
          </h1>
          <p className="hero-sub">
            Glypha builds its own chat stack in readable Python — framing, identity, encryption,
            discovery, NAT traversal, relay, encrypted history. Every layer on this page links to
            the file that implements it.
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
          <div className="h3facts">
            <span>X25519 + XSALSA20-POLY1305</span>
            <span>TOFU + KEY PINNING</span>
            <span>ENCRYPTED SQLITE HISTORY</span>
            <span>22 TESTS</span>
            <span>MIT</span>
          </div>
        </div>

        <HeroSide />
      </div>
    </section>
  );
}