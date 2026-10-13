import { Footer } from "./components/Footer";
import { Hero } from "./components/Hero";
import { Navbar } from "./components/Navbar";
import { NetworkLab } from "./components/NetworkLab/NetworkLab";
import { OpenSourceCTA } from "./components/OpenSourceCTA";
import { ProtocolStrip } from "./components/ProtocolStrip";
import { QuickStart } from "./components/QuickStart";
import { SecuritySection } from "./components/SecuritySection";
import { SystemOverview } from "./components/SystemOverview";

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <NetworkLab />
        <ProtocolStrip />
        <SystemOverview />
        <SecuritySection />
        <QuickStart />
        <OpenSourceCTA />
      </main>
      <Footer />
    </>
  );
}