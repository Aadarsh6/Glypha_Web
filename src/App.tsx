import { Field } from './engine/field';
// import { Nav } from './components/Nav';
import { Hero } from './components/Hero';
// import { Stack } from './components/Stack';
import { Ladder } from './components/Ladder';
import { Notes } from './components/Notes';
// import { Security } from './components/Security';
import { QuickStart } from './components/QuickStart';
// import { Outro } from './components/Outro';
import { Footer } from './components/Footer';
import { Nav } from './components/Navbar';
import { Stack } from './components/Stcak';
import { Security } from './components/Security';

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