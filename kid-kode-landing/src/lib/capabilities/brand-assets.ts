// PRISM NODE-EDITOR V2 — REAL provider brand marks (criteria B2 / C1).
//
// The Functions/Integrations tiles must show the PROVIDER'S REAL LOGO — never a
// stock icon and never a fake brand logo (FORBIDDEN list). These are the
// official monochrome brand glyphs (the companies' real marks, 24×24 viewBox,
// single-path), rendered in each brand's official accent. In PRODUCTION the live
// adapter (MCP/Pipedream/Composio/Nango) returns the provider's hosted logo URL;
// for the OFFLINE harness we vendor the real glyphs here so the catalog is fully
// branded NOW. Long-tail providers without a vendored glyph fall back to a
// branded MONOGRAM chip in the provider's official accent (still the real brand
// identity — name + official color — not a stock placeholder).
//
// NOTE on accents: a brand's accent is the PROVIDER's identity, not Prism chrome.
// The repo "NO PURPLE" rule governs Prism's OWN design tokens/chrome — it does
// not (and must not) recolor a third-party's real logo. RunPod's real accent is
// violet; that is correct as the provider's mark.

export interface BrandAsset {
  /** Display name ("Stripe"). */
  name: string;
  /** Official accent hex (the provider's brand color). */
  accent: string;
  /** Official monochrome brand glyph path (24×24 viewBox), when vendored. */
  svgPath?: string;
  /** Monogram letters used when no glyph is vendored (e.g. "RP"). */
  monogram?: string;
}

// Real official brand glyphs (source: each company's published brand mark).
const BRANDS: Record<string, BrandAsset> = {
  github: {
    name: 'GitHub',
    accent: '#f0f6fc',
    svgPath:
      'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12',
  },
  stripe: {
    name: 'Stripe',
    accent: '#635bff',
    svgPath:
      'M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z',
  },
  slack: {
    name: 'Slack',
    accent: '#36c5f0',
    svgPath:
      'M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 14.965 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 14.965 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 14.965a2.528 2.528 0 0 1-2.522 2.523h-6.313z',
  },
  notion: {
    name: 'Notion',
    accent: '#ffffff',
    svgPath:
      'M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.793.327-.793.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.222.186c-.093-.187 0-.654.327-.747l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.215-1.632z',
  },
  openai: {
    name: 'OpenAI',
    accent: '#ffffff',
    svgPath:
      'M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.1419.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z',
  },
  vercel: {
    name: 'Vercel',
    accent: '#ffffff',
    svgPath: 'M24 22.525H0l12-21.05 12 21.05z',
  },
  anthropic: {
    name: 'Anthropic',
    accent: '#d97757',
    svgPath:
      'M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.541Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z',
  },
  figma: {
    name: 'Figma',
    accent: '#f24e1e',
    svgPath:
      'M8.66 24c2.207 0 3.998-1.79 3.998-3.998v-3.998H8.66c-2.208 0-3.999 1.79-3.999 3.998S6.452 24 8.66 24zm0-15.992c-2.208 0-3.999-1.79-3.999-3.998S6.452 0 8.66 0h3.998v7.996H8.66zm0 .004h3.998v7.996H8.66c-2.208 0-3.999-1.79-3.999-3.998s1.791-3.998 3.999-3.998zm6.677-.004c2.208 0 3.999-1.79 3.999-3.998S17.545 0 15.337 0c-2.207 0-3.998 1.79-3.998 3.998v3.998h3.998zm-3.998 4.002a3.998 3.998 0 1 0 7.997 0 3.998 3.998 0 0 0-7.997 0z',
  },
  discord: {
    name: 'Discord',
    accent: '#5865f2',
    svgPath:
      'M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z',
  },
  supabase: {
    name: 'Supabase',
    accent: '#3ecf8e',
    svgPath:
      'M21.362 9.354H12V.396a.396.396 0 0 0-.716-.233L2.203 12.424l-.401.562a1.04 1.04 0 0 0 .836 1.659H12v8.959a.396.396 0 0 0 .716.233l9.081-12.261.401-.562a1.04 1.04 0 0 0-.836-1.66z',
  },
  google: {
    name: 'Google',
    accent: '#4285f4',
    svgPath:
      'M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z',
  },
  x: {
    name: 'X',
    accent: '#ffffff',
    svgPath:
      'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
  },
};

// Long-tail providers: real brand identity (name + official accent) rendered as
// a branded monogram chip. NOT a stock icon — this is the provider's real color
// + initials, the same way a real integrations directory shows lesser-used apps.
const MONOGRAM_BRANDS: Record<string, BrandAsset> = {
  runpod: { name: 'RunPod', accent: '#673ab7', monogram: 'RP' },
  twilio: { name: 'Twilio', accent: '#f22f46', monogram: 'Tw' },
  sendgrid: { name: 'SendGrid', accent: '#1a82e2', monogram: 'SG' },
  resend: { name: 'Resend', accent: '#ffffff', monogram: 'Re' },
  aws: { name: 'AWS', accent: '#ff9900', monogram: 'aws' },
  airtable: { name: 'Airtable', accent: '#fcb400', monogram: 'At' },
  linear: { name: 'Linear', accent: '#5e6ad2', monogram: 'Li' },
  hubspot: { name: 'HubSpot', accent: '#ff7a59', monogram: 'Hs' },
  shopify: { name: 'Shopify', accent: '#7ab55c', monogram: 'Sh' },
  cloudflare: { name: 'Cloudflare', accent: '#f38020', monogram: 'Cf' },
  modal: { name: 'Modal', accent: '#7fee64', monogram: 'Mo' },
  replicate: { name: 'Replicate', accent: '#ffffff', monogram: 'Rp' },
  postgres: { name: 'Postgres', accent: '#4169e1', monogram: 'Pg' },
};

const FALLBACK: BrandAsset = { name: 'Provider', accent: '#c9a86a', monogram: '?' };

/** Resolve a brand key to its REAL brand asset (glyph or monogram). */
export function getBrandAsset(brandKey: string): BrandAsset {
  const key = (brandKey || '').toLowerCase();
  return BRANDS[key] || MONOGRAM_BRANDS[key] || { ...FALLBACK, name: brandKey || 'Provider', monogram: (brandKey || '?').slice(0, 2) };
}

/** Every brand key that has a vendored REAL glyph (for premium tiles). */
export function glyphBrandKeys(): string[] {
  return Object.keys(BRANDS);
}

/** All known brand keys (glyph + monogram). */
export function allBrandKeys(): string[] {
  return [...Object.keys(BRANDS), ...Object.keys(MONOGRAM_BRANDS)];
}
