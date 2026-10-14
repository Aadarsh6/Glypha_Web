import { Field } from './engine/field';
import { Nav } from './components/Nav';
import { Hero } from './components/Hero';
import { QuickStart } from './components/QuickStart';
import { Ladder } from './components/Ladder';
import { Notes } from './components/Notes';
import { Security } from './components/Security';
import { Outro } from './components/Outro';
import { Footer } from './components/Footer';
import { Stack } from './components/Stack';

export default function App() {
  return (
    <>
      <Field />
      <Nav />
      <main className="page">
        <Hero />
        <QuickStart />
        <Ladder />
        <Notes />
        <Stack />
        <Security />
        <Outro />
      </main>
      <Footer />
    </>
  );
}