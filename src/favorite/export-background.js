// Resolve relative to this deployment, including sites hosted below a subdirectory.
export const RESULT_BACKGROUND_URL = new URL('./assets/backgrounds/hakugyokurou.jpg', import.meta.url).href;

/** Keep the landscape proportional, fading its courtyard and blossoms into pale paper. */
export function drawResultBackground(ctx, background, width, height) {
  ctx.save();
  const paper = ctx.createLinearGradient(0, 0, width, height);
  paper.addColorStop(0, '#ede4f0');
  paper.addColorStop(.44, '#f8f3f7');
  paper.addColorStop(1, '#f1e9f2');
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, width, height);
  if (background && Number.isFinite(background.naturalWidth) && background.naturalWidth > 0
    && Number.isFinite(background.naturalHeight) && background.naturalHeight > 0) {
    const scenicHeight = width * background.naturalHeight / background.naturalWidth;
    ctx.globalAlpha = .72;
    ctx.drawImage(background, 0, 0, width, scenicHeight);
    ctx.globalAlpha = 1;
    const fade = ctx.createLinearGradient(0, 0, 0, scenicHeight);
    fade.addColorStop(0, '#f7f0f51c');
    fade.addColorStop(.32, '#f6eef34a');
    fade.addColorStop(.72, '#f7f1f4df');
    fade.addColorStop(1, '#f8f3f7');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, width, scenicHeight);
    const wash = ctx.createLinearGradient(0, 0, width, 0);
    wash.addColorStop(0, '#f8f1f5b8');
    wash.addColorStop(.5, '#f8f1f58a');
    wash.addColorStop(1, '#f8f1f500');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, width, 314);
    // A faint reprise at the foot of the poster; the landscape is never stretched vertically.
    ctx.globalAlpha = .13;
    ctx.drawImage(background, 0, height - scenicHeight, width, scenicHeight);
    ctx.globalAlpha = 1;
    const lowerFade = ctx.createLinearGradient(0, height - scenicHeight, 0, height);
    lowerFade.addColorStop(0, '#f8f3f7');
    lowerFade.addColorStop(.4, '#f8f3f7d8');
    lowerFade.addColorStop(1, '#f8f3f71a');
    ctx.fillStyle = lowerFade;
    ctx.fillRect(0, height - scenicHeight, width, scenicHeight);
  }
  ctx.restore();
}
