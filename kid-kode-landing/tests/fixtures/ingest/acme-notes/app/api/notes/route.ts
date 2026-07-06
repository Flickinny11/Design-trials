import { NextResponse } from 'next/server';

// In-memory demo store — the real app uses Prisma (see prisma/schema.prisma).
const notes: Record<string, { title: string; body: string }> = {
  welcome: { title: 'Welcome to Acme Notes', body: 'This is your first note.' },
};

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id') ?? 'welcome';
  return NextResponse.json(notes[id] ?? { title: 'Untitled note', body: '' });
}

export async function POST(request: Request) {
  const data = (await request.json()) as { id: string; title: string; body: string };
  notes[data.id] = { title: data.title, body: data.body };
  return NextResponse.json({ ok: true, id: data.id });
}
