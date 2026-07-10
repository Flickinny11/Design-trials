// W-BAKE Axis 2 — dev-only bundle server for the /bakeoff-lab render harness.
//
// Serves prepared contestant bundles (esbuild-CJS'd generated node modules +
// case node + sceneSpec) from notes/bakeoff/renders/bundles/. Lab-route
// infrastructure for the model bakeoff — NOT a product surface; disabled
// outside development unless PRISM_BAKEOFF_LAB=1 (the same dev-gating idiom as
// the other lab routes). Path-traversal guarded; id is a whitelist of
// [a-z0-9./-] with '..' rejected.

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const BUNDLES_DIR = path.resolve(process.cwd(), 'notes', 'bakeoff', 'renders', 'bundles');

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development' && process.env.PRISM_BAKEOFF_LAB !== '1') {
    return NextResponse.json({ error: 'bakeoff lab is dev-only' }, { status: 404 });
  }
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!/^[a-z0-9./_-]+$/i.test(id) || id.includes('..')) {
    return NextResponse.json({ error: 'bad id' }, { status: 400 });
  }
  const file = path.join(BUNDLES_DIR, `${id}.json`);
  if (!file.startsWith(BUNDLES_DIR) || !existsSync(file)) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  return new NextResponse(readFileSync(file, 'utf8'), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
