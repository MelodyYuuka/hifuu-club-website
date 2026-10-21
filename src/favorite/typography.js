// Keep Canvas exports on the same self-hosted families as the page.
export const SANS_FONT = '"Favorite Noto Sans", "Microsoft YaHei", "PingFang SC", system-ui, sans-serif';
export const SERIF_FONT = '"Favorite Noto Serif", "Noto Serif SC", "Source Han Serif SC", "Songti SC", "SimSun", serif';

/** Load before measuring or drawing; unavailable fonts must never prevent a PNG export. */
export async function loadResultFonts(fonts = globalThis.document?.fonts, timeoutMs = 5000) {
  if (!fonts?.load) return false;
  let timer;
  try {
    const text = '东方本命角色榜单 云梦都 HifuuCraft';
    const ready = Promise.all([
      fonts.load('400 17px "Favorite Noto Sans"', text),
      fonts.load('600 24px "Favorite Noto Sans"', text),
      fonts.load('400 22px "Favorite Noto Serif"', text),
      fonts.load('600 50px "Favorite Noto Serif"', text),
    ]).then(faces => faces.every(face => face.length > 0));
    return await Promise.race([
      ready,
      new Promise(resolve => { timer = setTimeout(() => resolve(false), timeoutMs); }),
    ]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
