// Mock Prism graph matching the PrismGraph runtime schema.
// Each hub is a "page"; each node is an element (navbar, button, card, etc.).
// Shared nodes (hubIds length > 1) appear across multiple hubs.

export type NodeStatus =
  | 'verified'
  | 'code_generated'
  | 'image_ready'
  | 'pending'
  | 'failed';

export type ElementType =
  | 'navbar' | 'button' | 'card' | 'input' | 'modal'
  | 'chart' | 'avatar' | 'form' | 'hero' | 'feature'
  | 'testimonial' | 'footer' | 'sidebar' | 'dropdown'
  | 'table' | 'image' | 'badge' | 'tabs';

export type EdgeType =
  | 'contains' | 'navigates-to' | 'triggers'
  | 'data-flow' | 'shares-state' | 'depends-on';

export interface PrismNode {
  id: string;
  name: string;
  elementType: ElementType;
  hubIds: string[];
  caption: string;
  status: NodeStatus;
  verificationScore: number;
  hasBackend: boolean;
  hasAnimation: boolean;
  animationFrames?: number;
  stateCount: number;
  code: string;
  visualSpec: {
    primaryColor: string;
    secondaryColor?: string;
    font: string;
    radius: number;
    shadow: string;
  };
  textContent: Array<{ text: string; role: string; renderMethod: string }>;
  interactions: Array<{ event: string; action: string; target: string }>;
  backendContract?: {
    service: string;
    route: string;
    method: string;
    schema: string;
  };
}

export interface PrismEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  label?: string;
}

export interface PrismHub {
  id: string;
  name: string;
  route: string;
  glyph: 'home' | 'chart' | 'user' | 'lock';
  color: string;
  accentColor: string;
}

export const HUBS: PrismHub[] = [
  { id: 'home', name: 'Home', route: '/', glyph: 'home', color: '#5d8bff', accentColor: '#a978ff' },
  { id: 'dashboard', name: 'Dashboard', route: '/dashboard', glyph: 'chart', color: '#a978ff', accentColor: '#5ee0ff' },
  { id: 'profile', name: 'Profile', route: '/profile', glyph: 'user', color: '#ff9a44', accentColor: '#ff6ec7' },
  { id: 'auth', name: 'Auth', route: '/auth', glyph: 'lock', color: '#55e6a5', accentColor: '#5ee0ff' },
];

const mkCode = (name: string) => `import { Container, Graphics, Sprite } from 'pixi.js';
import gsap from 'gsap';

export function create${name.replace(/[-_](.)/g, (_, c) => c.toUpperCase()).replace(/^./, s => s.toUpperCase())}(config) {
  const root = new Container();
  root.label = '${name}';

  const bg = new Graphics()
    .roundRect(0, 0, config.width, config.height, 12)
    .fill({ color: 0x14162c });
  root.addChild(bg);

  root.eventMode = 'static';
  root.cursor = 'pointer';
  root.on('pointerover', () => {
    gsap.to(root.scale, { x: 1.04, y: 1.04, duration: 0.25, ease: 'power3.out' });
  });
  root.on('pointerout', () => {
    gsap.to(root.scale, { x: 1, y: 1, duration: 0.25 });
  });

  return root;
}`;

export const NODES: PrismNode[] = [
  // HOME HUB
  {
    id: 'home-navbar', name: 'navbar', elementType: 'navbar',
    hubIds: ['home', 'dashboard', 'profile'],
    caption: 'Primary navigation with logo, menu links, and authentication state. Sticky on scroll with glass backdrop and subtle bottom border.',
    status: 'verified', verificationScore: 0.94,
    hasBackend: true, hasAnimation: true, animationFrames: 6, stateCount: 3,
    code: mkCode('navbar'),
    visualSpec: { primaryColor: '#0e1025', secondaryColor: '#5d8bff', font: 'Inter 14px', radius: 0, shadow: 'lg' },
    textContent: [
      { text: 'Home', role: 'link', renderMethod: 'sharp-svg' },
      { text: 'About', role: 'link', renderMethod: 'sharp-svg' },
      { text: 'Sign In', role: 'cta', renderMethod: 'sharp-svg' },
    ],
    interactions: [
      { event: 'click', action: 'navigate', target: 'auth-login-button' },
      { event: 'scroll', action: 'state-update', target: 'isScrolled' },
    ],
    backendContract: {
      service: 'auth-service', route: '/api/auth/session', method: 'GET',
      schema: '{ userId: string | null, email: string | null }',
    },
  },
  {
    id: 'home-hero', name: 'hero-section', elementType: 'hero',
    hubIds: ['home'],
    caption: 'Full-viewport hero with animated gradient headline, supporting subhead, and primary CTA. Parallax scroll effect on secondary layers.',
    status: 'verified', verificationScore: 0.91,
    hasBackend: false, hasAnimation: true, animationFrames: 12, stateCount: 2,
    code: mkCode('hero'),
    visualSpec: { primaryColor: '#0e1025', secondaryColor: '#a978ff', font: 'Display 72px', radius: 0, shadow: 'none' },
    textContent: [
      { text: 'Build apps that think', role: 'headline', renderMethod: 'sharp-svg' },
      { text: 'The diffusion-powered builder', role: 'subhead', renderMethod: 'msdf' },
    ],
    interactions: [{ event: 'load', action: 'animate-in', target: 'self' }],
  },
  {
    id: 'home-cta', name: 'cta-button', elementType: 'button',
    hubIds: ['home'],
    caption: 'Pill CTA button, 240×56, lime-to-green gradient. "Get Started" label in Inter 18 semibold. Hover lifts + brightens; click routes to auth.',
    status: 'verified', verificationScore: 0.96,
    hasBackend: false, hasAnimation: true, animationFrames: 8, stateCount: 4,
    code: mkCode('cta-button'),
    visualSpec: { primaryColor: '#55e6a5', secondaryColor: '#5ee0ff', font: 'Inter 18px', radius: 28, shadow: 'xl' },
    textContent: [{ text: 'Get Started', role: 'label', renderMethod: 'sharp-svg' }],
    interactions: [
      { event: 'hover', action: 'scale', target: '1.05' },
      { event: 'click', action: 'navigate', target: 'auth-login-form' },
    ],
  },
  {
    id: 'home-features', name: 'feature-grid', elementType: 'feature',
    hubIds: ['home'],
    caption: 'Three-column feature grid with icon cards, each containing an illustrated icon, heading, and two-line body. Hover raises the card with soft shadow.',
    status: 'verified', verificationScore: 0.88,
    hasBackend: false, hasAnimation: false, stateCount: 1,
    code: mkCode('feature-grid'),
    visualSpec: { primaryColor: '#14162c', secondaryColor: '#5d8bff', font: 'Inter 16px', radius: 14, shadow: 'md' },
    textContent: [
      { text: 'Diffusion-native', role: 'heading', renderMethod: 'sharp-svg' },
      { text: 'Images become UI', role: 'body', renderMethod: 'msdf' },
    ],
    interactions: [],
  },
  {
    id: 'home-testimonial', name: 'testimonial', elementType: 'testimonial',
    hubIds: ['home'],
    caption: 'Rotating testimonial carousel with avatar, quote, attribution. Auto-advances every 6s. Pauses on hover. Respects reduced motion.',
    status: 'code_generated', verificationScore: 0.71,
    hasBackend: true, hasAnimation: true, animationFrames: 16, stateCount: 3,
    code: mkCode('testimonial'),
    visualSpec: { primaryColor: '#14162c', secondaryColor: '#a978ff', font: 'Serif italic 20px', radius: 18, shadow: 'lg' },
    textContent: [{ text: '"Changes everything."', role: 'quote', renderMethod: 'msdf' }],
    interactions: [
      { event: 'hover', action: 'pause', target: 'carousel' },
      { event: 'timer', action: 'advance', target: 'slide-index' },
    ],
    backendContract: {
      service: 'testimonials-api', route: '/api/testimonials', method: 'GET',
      schema: '{ items: Array<{ quote, author, avatar }> }',
    },
  },
  {
    id: 'home-footer', name: 'footer', elementType: 'footer',
    hubIds: ['home', 'dashboard', 'profile'],
    caption: 'Multi-column footer with nav, socials, newsletter signup, and copyright. Dark variant with thin top divider.',
    status: 'verified', verificationScore: 0.89,
    hasBackend: true, hasAnimation: false, stateCount: 2,
    code: mkCode('footer'),
    visualSpec: { primaryColor: '#04050a', font: 'Inter 13px', radius: 0, shadow: 'none' },
    textContent: [{ text: '© 2026 Kriptik', role: 'copyright', renderMethod: 'sharp-svg' }],
    interactions: [{ event: 'submit', action: 'api-call', target: 'newsletter-api' }],
    backendContract: {
      service: 'newsletter-service', route: '/api/newsletter/subscribe', method: 'POST',
      schema: '{ email: string }',
    },
  },

  // DASHBOARD HUB
  {
    id: 'dash-sidebar', name: 'sidebar', elementType: 'sidebar',
    hubIds: ['dashboard'],
    caption: 'Collapsible left sidebar with primary nav, section dividers, and a user card at the bottom. State persists via shared store.',
    status: 'verified', verificationScore: 0.87,
    hasBackend: false, hasAnimation: true, animationFrames: 10, stateCount: 5,
    code: mkCode('sidebar'),
    visualSpec: { primaryColor: '#0e1025', secondaryColor: '#a978ff', font: 'Inter 14px', radius: 0, shadow: 'md' },
    textContent: [{ text: 'Dashboard', role: 'nav-item', renderMethod: 'sharp-svg' }],
    interactions: [{ event: 'click', action: 'toggle-collapse', target: 'sidebar-state' }],
  },
  {
    id: 'dash-chart', name: 'chart-widget', elementType: 'chart',
    hubIds: ['dashboard'],
    caption: 'Real-time line chart of user activity over last 7 days. Canvas-rendered with smooth bezier curves and animated entry.',
    status: 'failed', verificationScore: 0.42,
    hasBackend: true, hasAnimation: true, animationFrames: 24, stateCount: 6,
    code: mkCode('chart-widget'),
    visualSpec: { primaryColor: '#5d8bff', secondaryColor: '#ef4466', font: 'Mono 11px', radius: 12, shadow: 'sm' },
    textContent: [{ text: '7-day trend', role: 'label', renderMethod: 'sharp-svg' }],
    interactions: [{ event: 'hover', action: 'show-tooltip', target: 'data-point' }],
    backendContract: {
      service: 'analytics-service', route: '/api/metrics/activity', method: 'GET',
      schema: '{ points: Array<{ t: number, v: number }> }',
    },
  },
  {
    id: 'dash-stats', name: 'stats-card', elementType: 'card',
    hubIds: ['dashboard'],
    caption: 'KPI card with large metric, delta indicator (up/down with color), and sparkline. Glass-morphism background with inner gradient.',
    status: 'verified', verificationScore: 0.93,
    hasBackend: true, hasAnimation: true, animationFrames: 6, stateCount: 2,
    code: mkCode('stats-card'),
    visualSpec: { primaryColor: '#14162c', secondaryColor: '#55e6a5', font: 'Display 36px', radius: 14, shadow: 'lg' },
    textContent: [{ text: '12,487', role: 'metric', renderMethod: 'sharp-svg' }],
    interactions: [{ event: 'hover', action: 'reveal-detail', target: 'tooltip' }],
    backendContract: {
      service: 'metrics-service', route: '/api/metrics/kpi', method: 'GET',
      schema: '{ value: number, delta: number }',
    },
  },
  {
    id: 'dash-table', name: 'data-table', elementType: 'table',
    hubIds: ['dashboard'],
    caption: 'Sortable data table with row selection, pagination, and column resize. Virtualized for large datasets. Custom scrollbar.',
    status: 'code_generated', verificationScore: 0.68,
    hasBackend: true, hasAnimation: false, stateCount: 8,
    code: mkCode('data-table'),
    visualSpec: { primaryColor: '#0e1025', secondaryColor: '#5ee0ff', font: 'Mono 13px', radius: 10, shadow: 'md' },
    textContent: [{ text: 'Recent activity', role: 'heading', renderMethod: 'sharp-svg' }],
    interactions: [
      { event: 'click', action: 'sort', target: 'column' },
      { event: 'click', action: 'select-row', target: 'row' },
    ],
    backendContract: {
      service: 'activity-service', route: '/api/activity', method: 'GET',
      schema: '{ rows: Array<Activity>, total: number }',
    },
  },
  {
    id: 'dash-filter', name: 'filter-bar', elementType: 'input',
    hubIds: ['dashboard'],
    caption: 'Horizontal filter bar: date range, category dropdown, search input. Filters update URL query params on change.',
    status: 'pending', verificationScore: 0,
    hasBackend: false, hasAnimation: false, stateCount: 4,
    code: mkCode('filter-bar'),
    visualSpec: { primaryColor: '#14162c', font: 'Inter 14px', radius: 10, shadow: 'sm' },
    textContent: [{ text: 'Filter…', role: 'placeholder', renderMethod: 'sharp-svg' }],
    interactions: [{ event: 'change', action: 'update-query', target: 'url-params' }],
  },
  {
    id: 'dash-notif-badge', name: 'notif-badge', elementType: 'badge',
    hubIds: ['dashboard', 'profile'],
    caption: 'Notification counter: crimson dot with numeric count. Pulses on new alerts. Subscribes to real-time notification stream.',
    status: 'verified', verificationScore: 0.91,
    hasBackend: true, hasAnimation: true, animationFrames: 4, stateCount: 2,
    code: mkCode('notif-badge'),
    visualSpec: { primaryColor: '#ff5577', font: 'Mono 10px bold', radius: 999, shadow: 'none' },
    textContent: [{ text: '3', role: 'count', renderMethod: 'sharp-svg' }],
    interactions: [{ event: 'click', action: 'open-panel', target: 'notification-panel' }],
    backendContract: {
      service: 'notifications-service', route: '/api/notifications/unread', method: 'GET',
      schema: '{ count: number, items: Array<Notification> }',
    },
  },
  {
    id: 'dash-calendar', name: 'calendar-widget', elementType: 'card',
    hubIds: ['dashboard'],
    caption: 'Compact monthly calendar with event dots. Click a day to reveal events in a detail popover. Keyboard-navigable.',
    status: 'image_ready', verificationScore: 0,
    hasBackend: true, hasAnimation: true, animationFrames: 8, stateCount: 4,
    code: mkCode('calendar-widget'),
    visualSpec: { primaryColor: '#14162c', secondaryColor: '#ff9a44', font: 'Inter 12px', radius: 14, shadow: 'md' },
    textContent: [{ text: 'April', role: 'heading', renderMethod: 'sharp-svg' }],
    interactions: [{ event: 'click', action: 'show-events', target: 'day' }],
    backendContract: {
      service: 'calendar-service', route: '/api/events', method: 'GET',
      schema: '{ events: Array<Event> }',
    },
  },

  // PROFILE HUB
  {
    id: 'prof-avatar', name: 'avatar', elementType: 'avatar',
    hubIds: ['profile', 'dashboard'],
    caption: 'Circular user avatar, 40px. User photo or generated initials fallback. Online status dot in bottom-right.',
    status: 'verified', verificationScore: 0.95,
    hasBackend: true, hasAnimation: false, stateCount: 2,
    code: mkCode('avatar'),
    visualSpec: { primaryColor: '#a978ff', font: 'Inter 14px bold', radius: 999, shadow: 'md' },
    textContent: [{ text: 'LH', role: 'initials', renderMethod: 'sharp-svg' }],
    interactions: [{ event: 'click', action: 'open-menu', target: 'user-menu' }],
    backendContract: {
      service: 'user-service', route: '/api/user/me', method: 'GET',
      schema: '{ id, name, avatar }',
    },
  },
  {
    id: 'prof-edit', name: 'edit-form', elementType: 'form',
    hubIds: ['profile'],
    caption: 'Profile edit form with inline validation, avatar uploader, save/cancel actions. Debounced autosave with toast feedback.',
    status: 'verified', verificationScore: 0.83,
    hasBackend: true, hasAnimation: true, animationFrames: 8, stateCount: 7,
    code: mkCode('edit-form'),
    visualSpec: { primaryColor: '#14162c', secondaryColor: '#55e6a5', font: 'Inter 14px', radius: 12, shadow: 'lg' },
    textContent: [{ text: 'Edit Profile', role: 'heading', renderMethod: 'sharp-svg' }],
    interactions: [
      { event: 'submit', action: 'api-call', target: 'update-user' },
      { event: 'change', action: 'validate', target: 'field' },
    ],
    backendContract: {
      service: 'user-service', route: '/api/user/update', method: 'PUT',
      schema: '{ name?, email?, avatar? }',
    },
  },
  {
    id: 'prof-tabs', name: 'settings-tabs', elementType: 'tabs',
    hubIds: ['profile'],
    caption: 'Horizontal tab nav with underline indicator that slides between active tabs. Keyboard accessible via arrow keys.',
    status: 'verified', verificationScore: 0.89,
    hasBackend: false, hasAnimation: true, animationFrames: 10, stateCount: 3,
    code: mkCode('settings-tabs'),
    visualSpec: { primaryColor: '#0e1025', secondaryColor: '#5d8bff', font: 'Inter 14px', radius: 0, shadow: 'none' },
    textContent: [
      { text: 'Account', role: 'tab-label', renderMethod: 'sharp-svg' },
      { text: 'Security', role: 'tab-label', renderMethod: 'sharp-svg' },
      { text: 'Billing', role: 'tab-label', renderMethod: 'sharp-svg' },
    ],
    interactions: [{ event: 'click', action: 'switch-tab', target: 'active-tab' }],
  },
  {
    id: 'prof-payment', name: 'payment-form', elementType: 'form',
    hubIds: ['profile'],
    caption: 'Payment method form: card number, expiry, CVC. Tokenizes via Stripe. Shows brand icon as user types card number.',
    status: 'failed', verificationScore: 0.38,
    hasBackend: true, hasAnimation: true, animationFrames: 6, stateCount: 6,
    code: mkCode('payment-form'),
    visualSpec: { primaryColor: '#14162c', secondaryColor: '#ef4466', font: 'Mono 14px', radius: 12, shadow: 'lg' },
    textContent: [{ text: 'Payment', role: 'heading', renderMethod: 'sharp-svg' }],
    interactions: [
      { event: 'submit', action: 'tokenize', target: 'stripe-api' },
      { event: 'input', action: 'format', target: 'card-number' },
    ],
    backendContract: {
      service: 'payment-service', route: '/api/payment/methods', method: 'POST',
      schema: '{ token: string }',
    },
  },

  // AUTH HUB
  {
    id: 'auth-form', name: 'login-form', elementType: 'form',
    hubIds: ['auth'],
    caption: 'Email+password login with inline validation, "Remember me" toggle, forgot-password link. Shake animation on error.',
    status: 'verified', verificationScore: 0.92,
    hasBackend: true, hasAnimation: true, animationFrames: 12, stateCount: 5,
    code: mkCode('login-form'),
    visualSpec: { primaryColor: '#0e1025', secondaryColor: '#55e6a5', font: 'Inter 14px', radius: 16, shadow: 'xl' },
    textContent: [{ text: 'Welcome back', role: 'heading', renderMethod: 'sharp-svg' }],
    interactions: [
      { event: 'submit', action: 'api-call', target: 'auth-login' },
      { event: 'error', action: 'shake', target: 'form' },
    ],
    backendContract: {
      service: 'auth-service', route: '/api/auth/login', method: 'POST',
      schema: '{ email, password }',
    },
  },
  {
    id: 'auth-btn', name: 'login-btn', elementType: 'button',
    hubIds: ['auth'],
    caption: 'Full-width pill button, 48px, primary green. Loading spinner on submit. Disabled while pending.',
    status: 'verified', verificationScore: 0.97,
    hasBackend: false, hasAnimation: true, animationFrames: 8, stateCount: 3,
    code: mkCode('login-btn'),
    visualSpec: { primaryColor: '#55e6a5', secondaryColor: '#22c55e', font: 'Inter 15px semibold', radius: 24, shadow: 'md' },
    textContent: [{ text: 'Sign in', role: 'label', renderMethod: 'sharp-svg' }],
    interactions: [
      { event: 'click', action: 'submit', target: 'parent-form' },
      { event: 'state:loading', action: 'show-spinner', target: 'self' },
    ],
  },
  {
    id: 'auth-modal', name: 'auth-modal', elementType: 'modal',
    hubIds: ['auth'],
    caption: 'Centered auth modal, 400px wide, rounded corners. Backdrop blur. ESC dismisses. Focus-trap inside.',
    status: 'code_generated', verificationScore: 0.74,
    hasBackend: false, hasAnimation: true, animationFrames: 10, stateCount: 3,
    code: mkCode('auth-modal'),
    visualSpec: { primaryColor: '#14162c', secondaryColor: '#a978ff', font: 'Inter 14px', radius: 20, shadow: 'xxl' },
    textContent: [{ text: 'Sign in', role: 'heading', renderMethod: 'sharp-svg' }],
    interactions: [
      { event: 'escape', action: 'close', target: 'self' },
      { event: 'backdrop-click', action: 'close', target: 'self' },
    ],
  },
  {
    id: 'auth-oauth', name: 'oauth-buttons', elementType: 'button',
    hubIds: ['auth'],
    caption: 'OAuth provider buttons: Google, Apple, GitHub. Stacked vertically with provider-specific icon on left.',
    status: 'image_ready', verificationScore: 0,
    hasBackend: true, hasAnimation: false, stateCount: 3,
    code: mkCode('oauth-buttons'),
    visualSpec: { primaryColor: '#14162c', secondaryColor: '#ffffff', font: 'Inter 14px', radius: 12, shadow: 'sm' },
    textContent: [{ text: 'Continue with Google', role: 'label', renderMethod: 'sharp-svg' }],
    interactions: [{ event: 'click', action: 'oauth-redirect', target: 'provider' }],
    backendContract: {
      service: 'auth-service', route: '/api/auth/oauth/:provider', method: 'POST',
      schema: '{ provider: string, code: string }',
    },
  },
];

export const EDGES: PrismEdge[] = [
  { id: 'e1', source: 'home-navbar', target: 'home-hero', type: 'contains' },
  { id: 'e2', source: 'home-hero', target: 'home-cta', type: 'contains' },
  { id: 'e3', source: 'home-cta', target: 'auth-form', type: 'navigates-to' },
  { id: 'e4', source: 'home-hero', target: 'home-features', type: 'contains' },
  { id: 'e5', source: 'home-features', target: 'home-testimonial', type: 'contains' },
  { id: 'e6', source: 'home-testimonial', target: 'home-footer', type: 'contains' },
  { id: 'e7', source: 'home-navbar', target: 'auth-btn', type: 'triggers' },
  { id: 'e8', source: 'home-navbar', target: 'dash-sidebar', type: 'contains' },
  { id: 'e9', source: 'dash-sidebar', target: 'dash-chart', type: 'contains' },
  { id: 'e10', source: 'dash-sidebar', target: 'dash-stats', type: 'contains' },
  { id: 'e11', source: 'dash-stats', target: 'dash-chart', type: 'data-flow' },
  { id: 'e12', source: 'dash-filter', target: 'dash-chart', type: 'data-flow' },
  { id: 'e13', source: 'dash-filter', target: 'dash-table', type: 'data-flow' },
  { id: 'e14', source: 'dash-sidebar', target: 'dash-table', type: 'contains' },
  { id: 'e15', source: 'dash-sidebar', target: 'dash-filter', type: 'contains' },
  { id: 'e16', source: 'dash-sidebar', target: 'dash-calendar', type: 'contains' },
  { id: 'e17', source: 'dash-notif-badge', target: 'prof-avatar', type: 'shares-state' },
  { id: 'e18', source: 'prof-avatar', target: 'prof-edit', type: 'triggers' },
  { id: 'e19', source: 'prof-tabs', target: 'prof-edit', type: 'contains' },
  { id: 'e20', source: 'prof-tabs', target: 'prof-payment', type: 'contains' },
  { id: 'e21', source: 'prof-edit', target: 'prof-avatar', type: 'data-flow' },
  { id: 'e22', source: 'auth-form', target: 'auth-btn', type: 'contains' },
  { id: 'e23', source: 'auth-modal', target: 'auth-form', type: 'contains' },
  { id: 'e24', source: 'auth-modal', target: 'auth-oauth', type: 'contains' },
  { id: 'e25', source: 'auth-btn', target: 'dash-sidebar', type: 'navigates-to' },
  { id: 'e26', source: 'home-navbar', target: 'prof-avatar', type: 'depends-on' },
  { id: 'e27', source: 'dash-notif-badge', target: 'home-navbar', type: 'shares-state' },
];

export const GRAPH = {
  id: 'demo-graph-001',
  hubs: HUBS,
  nodes: NODES,
  edges: EDGES,
  metadata: {
    version: 4,
    createdAt: '2026-04-16T08:00:00Z',
    engineType: 'prism',
    verificationThreshold: 0.6,
  },
};
