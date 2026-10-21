/** Source crop matching CSS object-fit: cover; object-position: top center. */
export function portraitCrop(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  if (![sourceWidth, sourceHeight, targetWidth, targetHeight].every(value => Number.isFinite(value) && value > 0)) {
    throw new Error('Invalid image dimensions.');
  }
  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = Math.min(sourceWidth, targetWidth / scale);
  const height = Math.min(sourceHeight, targetHeight / scale);
  return { x:(sourceWidth - width) / 2, y:0, width, height };
}
