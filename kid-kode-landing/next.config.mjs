/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // P1 TEXT (criterion 27): msdf-bmfont-xml shells out to its bundled native
  // msdfgen binary; webpack-bundling it into .next/server/vendor-chunks breaks
  // that path resolution. Externalize so the on-demand atlas bake requires it
  // from real node_modules at runtime.
  // opentype.js (3D-text glyph-outline gen) is CommonJS and reads font files
  // at runtime; externalize alongside msdf-bmfont-xml so it resolves from real
  // node_modules rather than a webpack vendor chunk.
  serverExternalPackages: ['msdf-bmfont-xml', 'opentype.js'],
  outputFileTracingExcludes: {
    '*': [
      'node_modules/@swc/core-linux-x64-gnu',
      'node_modules/@swc/core-linux-x64-musl',
      'node_modules/three/examples',
    ],
  },
  transpilePackages: [
    'three',
    '@react-three/fiber',
    '@react-three/drei',
    '@react-three/postprocessing',
    'postprocessing',
    'camera-controls',
  ],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // SHELL W6 (decision D) — surface split. The public marketing landing lives
  // at /home; the editor prototype occupies / and is FP7-protected (never
  // touched). On the MARKETING deployment (PRISM_SURFACE=marketing) we serve
  // the landing at the apex via a beforeFiles rewrite — config only, no editor
  // change. OFF by default: / continues to resolve to the editor, and every
  // existing verify script that hits / is unaffected.
  async rewrites() {
    if (process.env.PRISM_SURFACE !== 'marketing') {
      return { beforeFiles: [], afterFiles: [], fallback: [] };
    }
    return {
      beforeFiles: [{ source: '/', destination: '/home' }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
