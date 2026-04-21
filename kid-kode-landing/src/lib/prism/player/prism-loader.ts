// Unzip a .prism artifact into in-memory buffers.
import JSZip from 'jszip';

export interface PrismBundle {
  manifest: Manifest;
  graph: CompiledGraph;
  nodeModules: Map<string, string>;          // filename → source
  backendModules: Map<string, string>;       // filename → source
  atlasAvif: ArrayBuffer;
  atlasRegions: AtlasRegions;
  msdfFnt: string | null;
  msdfPng: ArrayBuffer | null;
}

export interface Manifest {
  prismVersion: string;
  playerVersionRequired: string;
  entryHub: string;
  hubs: string[];
  nodeCount: number;
  artifactHash: string;
  assets: Record<string, { sha256: string; size: number }>;
  entries?: Array<{ path: string; sha256: string; bytes: number }>;
  [k: string]: unknown;
}

export interface CompiledGraph {
  version: string;
  hubs: HubDef[];
  nodes: NodeDef[];
  edges: EdgeDef[];
}

export interface HubDef {
  hubId: string;
  title: string;
  nodeIds?: string[];
  layout: { viewportWidth: number; viewportHeight: number; contentHeight: number; backgroundColor: string };
}

export interface NodeDef {
  nodeId: string;
  subtype: string;
  parentHubId: string;
  serviceTag: string;
  visual: {
    atlasId?: string;
    region?: Region;
    regions?: Record<string, Region>;
    overlayRegions?: Record<string, Region>;
    frameRegions?: Region[];
    transform: { x: number; y: number; width: number; height: number; z: number };
    sourceAsset?: string;
    regionKeys?: string[];
    defaultRegion?: string;
    frameCount?: number;
  };
  intent: Record<string, unknown> & { caption?: string };
  codeRef: string;
  backendRef?: string | null;
}

export interface Region { atlasId: string; x: number; y: number; w: number; h: number; }

export interface EdgeDef {
  from: string;
  to: string;
  type: 'triggers' | 'state-update' | 'data-flow' | 'event-bubble';
  event?: string;
}

export interface AtlasRegions {
  schemaVersion: string;
  atlasFile: string;
  atlasWidth: number;
  atlasHeight: number;
  regionCount: number;
  regions: Record<string, Region & { nativeWidth?: number; nativeHeight?: number; hash?: string; kind?: string }>;
}

export async function loadPrism(url: string): Promise<PrismBundle> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to fetch ${url}: ${res.status}`);
  const buf = await res.arrayBuffer();
  return unpackPrism(buf);
}

export async function unpackPrism(buf: ArrayBuffer): Promise<PrismBundle> {
  const zip = await JSZip.loadAsync(buf);

  async function text(path: string) {
    const f = zip.file(path);
    if (!f) throw new Error(`missing zip entry: ${path}`);
    return f.async('string');
  }
  async function bin(path: string): Promise<ArrayBuffer> {
    const f = zip.file(path);
    if (!f) throw new Error(`missing zip entry: ${path}`);
    const u8 = await f.async('uint8array');
    return toArrayBuffer(u8);
  }
  async function optionalText(path: string) {
    const f = zip.file(path);
    return f ? f.async('string') : null;
  }
  async function optionalBin(path: string): Promise<ArrayBuffer | null> {
    const f = zip.file(path);
    if (!f) return null;
    const u8 = await f.async('uint8array');
    return toArrayBuffer(u8);
  }
  function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
    const copy = new ArrayBuffer(u8.byteLength);
    new Uint8Array(copy).set(u8);
    return copy;
  }

  const manifest: Manifest = JSON.parse(await text('manifest.json'));
  const graph: CompiledGraph = JSON.parse(await text('graph.json'));
  const atlasRegions: AtlasRegions = JSON.parse(await text('assets/atlas-regions.json'));
  const atlasAvif = await bin('assets/atlas-0.avif');
  const msdfFnt = await optionalText('assets/font-inter.msdf.fnt');
  const msdfPng = await optionalBin('assets/font-inter.msdf.png');

  const nodeModules = new Map<string, string>();
  const backendModules = new Map<string, string>();
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    if (path.startsWith('nodes/')) {
      nodeModules.set(path.slice('nodes/'.length), await entry.async('string'));
    } else if (path.startsWith('backends/')) {
      backendModules.set(path.slice('backends/'.length), await entry.async('string'));
    }
  }

  return { manifest, graph, nodeModules, backendModules, atlasAvif, atlasRegions, msdfFnt, msdfPng };
}
