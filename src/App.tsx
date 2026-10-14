import { Field } from './engine/field';
import { Hero } from './components/Hero';
import { Ladder } from './components/Ladder';
import { Notes } from './components/Notes';
import { QuickStart } from './components/QuickStart';
import { Footer } from './components/Footer';
import { Nav } from './components/Nav';
import { Stack } from './components/Stcak';
import { Security } from './components/Security';
import { Outro } from './components/Outro';

export default function App() {
  return (
    <>
      <Field />
      <Nav />
      <main className="page">
        <Hero />
        <Stack />
        <Ladder />
        <Notes />
        <Security />
        <QuickStart />
        <Outro />
      </main>
      <Footer />
    </>
  );
}