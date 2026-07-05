// SHELL W7 — tiny ESM resolve hook (no dependency).
//
// Node 24 strips TypeScript types from `.ts` on import, but ESM still requires
// explicit file extensions for relative specifiers. The repo (and Next) use
// extensionless imports, so this hook retries a failed relative resolution with
// `.ts` / `.tsx` / `/index.ts`. It ONLY affects relative/absolute specifiers;
// bare package imports fall straight through. This exists solely so the
// standalone CollabRoom host (deviation W7-D1) can run under plain Node.

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    const relativeish =
      specifier.startsWith('.') ||
      specifier.startsWith('/') ||
      specifier.startsWith('file:');
    if (!relativeish) throw err;
    for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
      try {
        return await nextResolve(specifier + ext, context);
      } catch {
        /* try the next candidate */
      }
    }
    throw err;
  }
}
