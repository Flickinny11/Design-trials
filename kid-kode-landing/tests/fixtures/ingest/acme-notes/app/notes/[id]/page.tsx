export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await fetch(`/api/notes?id=${id}`, { cache: 'no-store' });
  const note = await res.json();
  return (
    <article className="note">
      <h1>{note.title ?? 'Untitled note'}</h1>
      <p>{note.body}</p>
    </article>
  );
}
