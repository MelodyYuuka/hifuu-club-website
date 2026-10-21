const toggle = document.getElementById('readable');
function update() {
  document.body.classList.toggle('readable', toggle.checked);
  for (const link of document.querySelectorAll('.sample footer a')) {
    const url = new URL(link.href);
    if (toggle.checked) url.searchParams.delete('readable');
    else url.searchParams.set('readable','0');
    link.href = url.href;
  }
}
toggle.addEventListener('change', update);
update();
Promise.all([
  document.fonts.load('500 34px "Favorite Noto Serif"'),
  document.fonts.load('400 14px "Favorite Noto Sans"'),
  document.fonts.load('400 34px "Favorite WenKai"'),
]).then(() => {
  const loaded = ['Favorite Noto Serif','Favorite Noto Sans','Favorite WenKai'].every(name => [...document.fonts].some(face => face.family.replaceAll('"','') === name && face.status === 'loaded'));
  document.getElementById('font-status').textContent = loaded ? '三款真实字体已就绪' : '字体未完整载入，请刷新重试';
}).catch(() => { document.getElementById('font-status').textContent = '字体载入失败，请刷新重试'; });
