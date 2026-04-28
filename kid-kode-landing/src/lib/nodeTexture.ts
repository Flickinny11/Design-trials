'use client';

import * as THREE from 'three';
import type { EditorNode as PrismNode } from '@/lib/prism-graph/view-model';

const W = 2048;
const H = 1024;

/**
 * Build the sphere texture.
 * When `capturedImage` (a dataURL of the real rendered element) is provided, the
 * front hemisphere is composed from that screenshot with premium framing. Otherwise
 * we fall back to the procedural renderer so spheres always look nice.
 */
export async function generateNodeTexture(
  node: PrismNode,
  capturedImage?: string
): Promise<THREE.CanvasTexture> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (capturedImage) {
    await drawFrontFromCapture(ctx, node, capturedImage);
  } else {
    drawFrontProcedural(ctx, node);
  }
  drawBack(ctx, node);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ═══════════════════════════════════════════════════════════════════
// FRONT — from captured element image (real rendered UI)
// ═══════════════════════════════════════════════════════════════════
async function drawFrontFromCapture(
  ctx: CanvasRenderingContext2D,
  node: PrismNode,
  dataUrl: string
) {
  const w = 1024, h = 1024;
  const primary = node.visualSpec.primaryColor || '#14162c';
  const accent = node.visualSpec.secondaryColor || node.visualSpec.primaryColor || '#5d8bff';

  // Deep hub-tinted base
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.8);
  g.addColorStop(0, '#1e2140');
  g.addColorStop(0.5, '#0e1029');
  g.addColorStop(1, '#04060f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Prism edge glow (hub color)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const eg = ctx.createRadialGradient(w / 2, h / 2, w * 0.38, w / 2, h / 2, w * 0.58);
  eg.addColorStop(0, 'rgba(0,0,0,0)');
  eg.addColorStop(1, accent);
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = eg;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Try to draw the captured DOM screenshot centered
  try {
    const img = await loadImage(dataUrl);
    const maxW = w - 120;
    const maxH = h - 240;
    const ratio = Math.min(maxW / img.width, maxH / img.height);
    const iw = img.width * ratio;
    const ih = img.height * ratio;
    const ix = (w - iw) / 2;
    const iy = 160;

    // Drop shadow behind image
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 50;
    ctx.shadowOffsetY = 16;
    ctx.fillStyle = '#0a0b1c';
    roundRect(ctx, ix, iy, iw, ih, 18);
    ctx.fill();
    ctx.restore();

    // Clip to rounded corners and draw screenshot
    ctx.save();
    roundRect(ctx, ix, iy, iw, ih, 18);
    ctx.clip();
    ctx.drawImage(img, ix, iy, iw, ih);
    ctx.restore();

    // Subtle inner border
    ctx.save();
    roundRect(ctx, ix, iy, iw, ih, 18);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Animation "stacked" layer indicator
    if (node.hasAnimation) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      roundRect(ctx, ix + 10, iy + 10, iw, ih, 18);
      ctx.stroke();
      ctx.globalAlpha = 0.22;
      roundRect(ctx, ix + 20, iy + 20, iw, ih, 18);
      ctx.stroke();
      ctx.restore();
    }
  } catch {
    // If image fails to load, fall back
    drawFrontProcedural(ctx, node);
    return;
  }

  // Header: node name + type
  ctx.save();
  ctx.font = '600 34px ui-monospace, "JetBrains Mono", Menlo, monospace';
  ctx.fillStyle = 'rgba(232,234,245,0.9)';
  ctx.fillText(node.name, 40, 72);
  ctx.font = '22px ui-monospace, monospace';
  ctx.fillStyle = accent;
  ctx.fillText('◆ ' + node.elementType.toUpperCase(), 40, 108);
  ctx.restore();

  // Status bar
  drawStatusBar(ctx, node, 40, h - 74, w - 80);
}

// ═══════════════════════════════════════════════════════════════════
// FRONT — procedural fallback (original)
// ═══════════════════════════════════════════════════════════════════
function drawFrontProcedural(ctx: CanvasRenderingContext2D, node: PrismNode) {
  const w = 1024, h = 1024;

  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.8);
  g.addColorStop(0, '#1e2140');
  g.addColorStop(0.45, '#0f1029');
  g.addColorStop(1, '#05060f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const grain = ctx.createImageData(w, h);
  for (let i = 0; i < grain.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 8;
    grain.data[i] = grain.data[i + 1] = grain.data[i + 2] = 128 + n;
    grain.data[i + 3] = 10;
  }
  ctx.putImageData(grain, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const edgeGrad = ctx.createRadialGradient(w / 2, h / 2, w * 0.38, w / 2, h / 2, w * 0.55);
  edgeGrad.addColorStop(0, 'rgba(0,0,0,0)');
  edgeGrad.addColorStop(1, node.visualSpec.secondaryColor || node.visualSpec.primaryColor || '#5d8bff');
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = edgeGrad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Generic rectangle with element type name
  ctx.save();
  ctx.translate(w / 2, h / 2);
  const primary = node.visualSpec.primaryColor || '#14162c';
  const accent = node.visualSpec.secondaryColor || '#5d8bff';

  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 38;
  ctx.fillStyle = primary;
  roundRect(ctx, -300, -200, 600, 400, 22);
  ctx.fill();
  ctx.shadowBlur = 0;

  const grad = ctx.createLinearGradient(-300, -200, 300, 200);
  grad.addColorStop(0, primary);
  grad.addColorStop(1, accent);
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = grad;
  roundRect(ctx, -270, -170, 540, 120, 16);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = 'rgba(232,234,245,0.95)';
  ctx.font = '700 56px "Bricolage Grotesque", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(node.name, 0, 20);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
  ctx.restore();

  ctx.save();
  ctx.font = '600 32px ui-monospace, monospace';
  ctx.fillStyle = 'rgba(232,234,245,0.75)';
  ctx.fillText(node.name, 40, 70);
  ctx.font = '22px ui-monospace, monospace';
  ctx.fillStyle = 'rgba(232,234,245,0.38)';
  ctx.fillText(node.elementType.toUpperCase(), 40, 102);
  ctx.restore();

  drawStatusBar(ctx, node, 40, h - 74, w - 80);
}

function drawStatusBar(ctx: CanvasRenderingContext2D, node: PrismNode, x: number, y: number, w: number) {
  const c =
    node.status === 'verified' ? '#22c55e' :
    node.status === 'failed' ? '#ef4466' :
    node.status === 'code_generated' ? '#5d8bff' :
    node.status === 'image_ready' ? '#f5a524' : '#6b7694';

  ctx.fillStyle = 'rgba(232,234,245,0.08)';
  roundRect(ctx, x, y, w, 12, 6); ctx.fill();
  const pct = Math.max(0.02, node.verificationScore || 0);
  ctx.fillStyle = c;
  roundRect(ctx, x, y, w * pct, 12, 6); ctx.fill();

  ctx.font = '600 20px ui-monospace, monospace';
  ctx.fillStyle = c;
  ctx.fillText(node.status.toUpperCase(), x, y - 14);
  ctx.textAlign = 'right';
  ctx.fillText(pct.toFixed(2), x + w, y - 14);
  ctx.textAlign = 'start';
}

// ═══════════════════════════════════════════════════════════════════
// BACK HEMISPHERE (backend diagram)
// ═══════════════════════════════════════════════════════════════════
function drawBack(ctx: CanvasRenderingContext2D, node: PrismNode) {
  ctx.save();
  ctx.translate(1024, 0);
  const w = 1024, h = 1024;

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#030412');
  g.addColorStop(1, '#0a0f24');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(93,139,255,0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 48) ctx.beginPath(), ctx.moveTo(x, 0), ctx.lineTo(x, h), ctx.stroke();
  for (let y = 0; y < h; y += 48) ctx.beginPath(), ctx.moveTo(0, y), ctx.lineTo(w, y), ctx.stroke();

  const cx = w / 2, cy = h / 2;

  if (node.hasBackend && node.backendContract) {
    const bc = node.backendContract;

    ctx.save();
    ctx.translate(cx, cy);
    const r = 148;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    grad.addColorStop(0, 'rgba(93,139,255,0.38)');
    grad.addColorStop(1, 'rgba(93,139,255,0.04)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(93,139,255,0.78)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = 'rgba(220,230,255,0.95)';
    ctx.font = '600 28px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(bc.service, 0, -10);
    ctx.font = '20px ui-monospace, monospace';
    ctx.fillStyle = 'rgba(93,139,255,0.88)';
    ctx.fillText(bc.method + ' ' + bc.route.slice(0, 22), 0, 26);
    ctx.restore();

    const sats = [
      { x: 180, y: 180, label: 'DB' },
      { x: w - 180, y: 180, label: 'AUTH' },
      { x: 180, y: h - 180, label: 'CACHE' },
      { x: w - 180, y: h - 180, label: 'QUEUE' },
    ];
    sats.forEach((s) => {
      ctx.strokeStyle = 'rgba(93,139,255,0.28)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(93,139,255,0.85)';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(5,10,20,0.95)';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 15, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(200,220,255,0.7)';
      ctx.font = '16px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(s.label, s.x, s.y + 48);
    });
    ctx.textAlign = 'start';

    ctx.fillStyle = 'rgba(93,139,255,0.38)';
    ctx.font = '600 20px ui-monospace, monospace';
    ctx.fillText('◆ BACKEND CONTRACT', 48, 72);
    ctx.fillStyle = 'rgba(200,220,255,0.55)';
    ctx.font = '18px ui-monospace, monospace';
    ctx.fillText(bc.schema.slice(0, 72), 48, h - 48);
  } else {
    ctx.fillStyle = 'rgba(150,160,190,0.24)';
    ctx.font = '600 34px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('◯  CLIENT ONLY', cx, cy);
    ctx.font = '20px ui-monospace, monospace';
    ctx.fillText('no backend contract', cx, cy + 44);
    ctx.textAlign = 'start';

    ctx.fillStyle = 'rgba(150,160,190,0.2)';
    ctx.font = '600 20px ui-monospace, monospace';
    ctx.fillText('◇ STATELESS', 48, 72);
  }

  ctx.restore();
}
