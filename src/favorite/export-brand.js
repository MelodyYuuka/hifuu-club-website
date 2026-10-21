import { SANS_FONT } from './typography.js';
// Reuse the main site's logo from this deployment, not a hard-coded preview host.
export const BRAND_NAME = '云梦都 HifuuCraft';
export const BRAND_LOGO_URL = new URL('../assets/favicon.png', import.meta.url).href;

/** Add the full emblem beside the site name without moving the result title. */
export function drawResultBrand(ctx, logo) {
  ctx.save();
  if (logo) {
    const size = 44;
    const scale = Math.min(size / logo.naturalWidth, size / logo.naturalHeight);
    const width = logo.naturalWidth * scale;
    const height = logo.naturalHeight * scale;
    ctx.drawImage(logo, 70 + (size - width) / 2, 41 + (size - height) / 2, width, height);
  }
  ctx.fillStyle = '#80658e';
  ctx.font = '19px ' + SANS_FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(BRAND_NAME, logo ? 128 : 70, 70);
  ctx.restore();
}
