import { lazy, Suspense } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { NetworkLab } from './components/NetworkLab/NetworkLab';
import { ProtocolStrip } from './components/ProtocolStrip';
import { SystemOverview } from './components/SystemOverview';
import { SecuritySection } from './components/SecuritySection';
import { QuickStart } from './components/QuickStart';
import { OpenSourceCTA } from './components/OpenSourceCTA';
import { Footer } from './components/Footer';

const Observatory = lazy(() =>
  import('./components/Observatory/Observatory').then(m => ({ default: m.Observatory })));

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <NetworkLab />
        <ProtocolStrip />
        <Suspense fallback={<div style={{ height: 420 }} />}>
          <Observatory />
        </Suspense>
        <SystemOverview />
        <SecuritySection />
        <QuickStart />
        <OpenSourceCTA />
      </main>
      <Footer />
    </>
  );
}