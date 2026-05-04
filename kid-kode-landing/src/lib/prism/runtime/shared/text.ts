// MSDF font atlas loader — wires `three-msdf-text-webgpu` (and the build-time
// `msdf-bmfont-xml` atlas output) into the runtime so node modules can call
// `ctx.fontAtlas` to render crisp text at any zoom.
//
// Spec: PRISM-RENDERER-MIGRATION-SPEC.md §3 (Tech Stack) and §13 (Editor —
// Text rendering). Forbidden alternatives: THREE.TextGeometry, DOM text
// overlays, troika-three-text.

import { Group, TextureLoader, type Object3D, type Texture, type ColorRepresentation } from 'three';
import type { BMFontJSON } from 'three-msdf-text-webgpu';

export interface TextOpts {
  fontSize?: number;
  color?: ColorRepresentation;
  align?: 'left' | 'center' | 'right';
  maxWidthPx?: number;
  letterSpacingPx?: number;
}

export interface CreateFontAtlasOptions {
  /** Inject already-loaded atlas + font JSON (used for tests + offline builds). */
  preloaded?: {
    atlas: Texture;
    data: BMFontJSON;
  };
  /** Inject a custom TextureLoader (defaults to Three's TextureLoader). */
  textureLoader?: { load(url: string, onLoad: (tex: Texture) => void, onProgress?: unknown, onError?: (err: unknown) => void): unknown };
  /** Inject a JSON fetcher (defaults to `fetch().then(r => r.json())`). */
  fetchJSON?: (url: string) => Promise<BMFontJSON>;
  /** Inject a factory for the underlying `MSDFText`. Defaults to lazy-loading
   *  `three-msdf-text-webgpu` on first `createText()`. */
  msdfTextFactory?: (
    content: string,
    opts: TextOpts | undefined,
    atlas: Texture,
    data: BMFontJSON,
  ) => Object3D;
}

export interface FontAtlasHandle {
  /** True once `load()` resolves (or `preloaded` was provided). */
  readonly ready: boolean;
  /** Load the MSDF atlas PNG + BMFont JSON. Idempotent: a second call with
   *  the same URLs resolves immediately. */
  load(atlasUrl: string, fontJsonUrl: string): Promise<void>;
  /** Build a `THREE.Mesh<MSDFTextGeometry, MSDFTextNodeMaterial>` for the
   *  given content. Throws if not yet ready. */
  createText(content: string, opts?: TextOpts): Object3D;
  /** Dispose of the atlas texture and any cached materials. */
  dispose(): void;
}

/** Lazy-load `three-msdf-text-webgpu` only when no factory was injected and
 *  on first `createText()` call. Allows node tests to bypass MSDF entirely. */
async function defaultMSDFTextFactoryAsync(): Promise<
  (content: string, opts: TextOpts | undefined, atlas: Texture, data: BMFontJSON) => Object3D
> {
  const mod = await import('three-msdf-text-webgpu');
  return (content, opts, atlas, data) => {
    const obj = new mod.MSDFText(
      {
        text: content,
        textStyles: {
          fontSize: opts?.fontSize ?? 32,
          color: opts?.color,
          textAlign: opts?.align ?? 'left',
          widthPx: opts?.maxWidthPx,
          letterSpacingPx: opts?.letterSpacingPx,
        },
      },
      { atlas, data },
    );
    return obj;
  };
}

export function createFontAtlas(
  options: CreateFontAtlasOptions = {},
): FontAtlasHandle {
  let atlas: Texture | null = options.preloaded?.atlas ?? null;
  let data: BMFontJSON | null = options.preloaded?.data ?? null;
  let loadPromise: Promise<void> | null = null;
  let lastUrls: { atlas: string; json: string } | null = null;
  // Sync factory; falls back to a placeholder Group when the async default
  // hasn't loaded yet — tests inject a sync factory directly.
  let textFactory: ((content: string, opts: TextOpts | undefined, atlas: Texture, data: BMFontJSON) => Object3D) | null =
    options.msdfTextFactory ?? null;

  function isReady(): boolean {
    return atlas !== null && data !== null;
  }

  async function load(atlasUrl: string, fontJsonUrl: string): Promise<void> {
    if (lastUrls && lastUrls.atlas === atlasUrl && lastUrls.json === fontJsonUrl && loadPromise) {
      return loadPromise;
    }
    lastUrls = { atlas: atlasUrl, json: fontJsonUrl };

    const texLoader = options.textureLoader ?? (new TextureLoader() as unknown as NonNullable<CreateFontAtlasOptions['textureLoader']>);
    const fetchJSON =
      options.fetchJSON ??
      (async (url: string): Promise<BMFontJSON> => {
        const r = await fetch(url);
        return (await r.json()) as BMFontJSON;
      });

    loadPromise = (async () => {
      const [tex, json] = await Promise.all([
        new Promise<Texture>((resolve, reject) => {
          texLoader.load(atlasUrl, (t) => resolve(t), undefined, (err) =>
            reject(err instanceof Error ? err : new Error(String(err))),
          );
        }),
        fetchJSON(fontJsonUrl),
      ]);
      atlas = tex;
      data = json;
    })();
    return loadPromise;
  }

  function createText(content: string, opts?: TextOpts): Object3D {
    if (!atlas || !data) {
      throw new Error('createText: font atlas not loaded — call load() first or supply preloaded option');
    }
    if (textFactory) return textFactory(content, opts, atlas, data);
    // Lazy-init the default MSDF factory. Until it's ready synchronously,
    // we return an empty placeholder Group; T03+ uses the editor's async
    // bootstrap path so this only matters for tests / the very first frame.
    void defaultMSDFTextFactoryAsync().then((fac) => {
      textFactory = fac;
    });
    const placeholder = new Group();
    placeholder.name = `text:${content}`;
    return placeholder;
  }

  function dispose(): void {
    if (atlas) {
      try {
        atlas.dispose();
      } catch {
        // ignore
      }
    }
    atlas = null;
    data = null;
    loadPromise = null;
    lastUrls = null;
    textFactory = null;
  }

  return {
    get ready() {
      return isReady();
    },
    load,
    createText,
    dispose,
  };
}
