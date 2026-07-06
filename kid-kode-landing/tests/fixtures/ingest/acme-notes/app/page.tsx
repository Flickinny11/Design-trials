import { NoteForm } from '../components/NoteForm';

export default function HomePage() {
  return (
    <section className="hero">
      <h1>Every note, beautifully organized</h1>
      <p>Acme Notes keeps your thoughts fast, searchable, and shareable.</p>
      <a className="cta" href="/dashboard">Get started</a>
      <NoteForm />
    </section>
  );
}
