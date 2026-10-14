import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { NetworkLab } from './components/NetworkLab/NetworkLab';
import { SecuritySection } from './components/SecuritySection';
import { QuickStart } from './components/QuickStart';
import { OpenSourceCTA } from './components/OpenSourceCTA';
import { Footer } from './components/Footer';

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <NetworkLab />
        <SecuritySection />
        <QuickStart />
        <OpenSourceCTA />
      </main>
      <Footer />
    </>
  );
}