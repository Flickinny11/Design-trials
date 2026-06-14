// PRISM NODE-EDITOR V2 — build-safe optional dependency import. Server-only.
//
// The live prompt-edit / capability / snippet paths dynamic-import SDKs that are
// NOT in package.json yet (`ai`, `@ai-sdk/anthropic`, `@modelcontextprotocol/sdk`,
// `@supabase/supabase-js`). They are reached ONLY when the corresponding env key
// is set (offline harness never executes them). This helper hides the specifier
// from the bundler so `next build` does not try to resolve an absent module:
//   • the specifier is a runtime VARIABLE (not statically analyzable), and
//   • `webpackIgnore` / `turbopackIgnore` leave it as a real runtime import.
// Installing the dep later (the production swap) makes the import resolve live.
import 'server-only';

export async function optionalImport<T = unknown>(specifier: string): Promise<T | null> {
  try {
    return (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ specifier)) as T;
  } catch {
    return null;
  }
}
