'use client';

import { useState } from 'react';

export function NoteForm() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetch('/api/notes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: crypto.randomUUID(), title, body }),
    });
    setSaved(true);
  }

  return (
    <form className="note-form" onSubmit={onSubmit}>
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Note title" />
      </label>
      <label>
        Body
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write something…" />
      </label>
      <button type="submit">Save note</button>
      {saved ? <span className="saved">Saved!</span> : null}
    </form>
  );
}
