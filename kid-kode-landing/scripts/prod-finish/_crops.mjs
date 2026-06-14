import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
const HERO = 'notes/verification/prod-finish/heroes';
const ATM = 'notes/verification/prod-finish/atmosphere';
const OUT = 'notes/verification/prod-finish/capstone';
mkdirSync(OUT, { recursive: true });
// crop helper: normalized box -> 2x zoom PNG
async function crop(src, nx, ny, nw, nh, out) {
  const m = await sharp(src).metadata();
  const left = Math.round(nx * m.width), top = Math.round(ny * m.height);
  const width = Math.round(nw * m.width), height = Math.round(nh * m.height);
  await sharp(src).extract({ left, top, width, height }).resize({ width: width * 2 }).png().toFile(out);
}
// Corner crops (atmosphere, chrome-hidden) — prove no oval edge / flat plate / stipple.
for (const [f, tag] of [['desktop-s1-arrival','desk-arrival'],['desktop-s2-movement','desk-movement'],['constrained-s4-celestia','con-celestia'],['tablet-s3-materia','tab-materia']]) {
  await crop(`${ATM}/${f}.png`, 0.0, 0.0, 0.26, 0.32, `${OUT}/CORNER-TL-${tag}.png`).catch(e=>console.log('skip',f,e.message));
  await crop(`${ATM}/${f}.png`, 0.74, 0.68, 0.26, 0.32, `${OUT}/CORNER-BR-${tag}.png`).catch(()=>{});
}
// Hero center crops (real app w/ chrome) — prove hero present + lit + detailed.
for (const [f, tag] of [['desktop-s1-arrival','desk-arrival'],['desktop-s5-acquire','desk-acquire'],['desktop-s2-movement','desk-movement'],['desktop-s4-celestia','desk-celestia'],['constrained-s5-acquire','con-acquire'],['mobile-s1-arrival','mob-arrival']]) {
  await crop(`${HERO}/${f}.png`, 0.30, 0.28, 0.40, 0.46, `${OUT}/HERO-${tag}.png`).catch(e=>console.log('skip',f,e.message));
}
console.log('crops written to', OUT);
