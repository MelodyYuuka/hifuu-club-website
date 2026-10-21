import { loadResultFonts } from './typography.js';
import { characters, games, workGroups } from './characters.js';
import { prepareResultPoster, drawResultPoster } from './export-poster.js';
import { BRAND_LOGO_URL } from './export-brand.js';
import { RESULT_BACKGROUND_URL } from './export-background.js';
import { resultPageUrl, prepareResultFooter, drawResultFooter } from './export-footer.js';
import { FavoriteSorter, comparisonBound, shuffleIds } from './sorter.js';
import { workPresets, applyWorkPresets, selectedWorkPresetIds, toggleWorkPreset } from './presets.js';
import { STORAGE_KEY, characterById, defaultSettings, candidateIds, rankingLimit, serializeSession, restoreSession, flattenRankings, resultText, encodeResult, decodeResult, matchingWorks, setWorksSelected, matchingCharacters, setCharactersSelected } from './model.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const icon = name => '<svg aria-hidden="true"><use href="#i-' + name + '"/></svg>';
const escape = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
let settings = defaultSettings();
let sorter = null;
let startedAt = null;
let currentResult = null;
let view = 'setup';
let activeWorkGroup = 'main';
const workCounts = new Map(games.map(game => [game.id, characters.filter(character => character.games.includes(game.id)).length]));
let toastTimer;
let storageAvailable = true;
let lastChoiceAt = 0;
let initialWarning = '';

try {
  const saved = restoreSession(localStorage.getItem(STORAGE_KEY));
  settings = saved.settings;
  sorter = saved.sorter;
  startedAt = saved.startedAt;
} catch (error) {
  if (error instanceof SyntaxError || error.message.startsWith('Invalid') || error.message.includes('complete')) {
    initialWarning = '上次的存档无法读取，已安全恢复默认设置。';
  } else {
    storageAvailable = false;
    initialWarning = '进度暂时无法保存，请勿刷新或关闭页面。';
  }
}
function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4500);
}
function renderSaveStatus() {
  $('#save-status').textContent = storageAvailable ? '已保存' : '未能保存，请勿刷新';
  const warning = $('#storage-warning');
  warning.hidden = storageAvailable;
  warning.textContent = storageAvailable ? '' : '进度暂时无法保存，请勿刷新或关闭页面。';
}
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, serializeSession(settings, sorter, startedAt));
    storageAvailable = true;
  } catch {
    if (storageAvailable) toast('进度暂时无法保存，请勿刷新或关闭页面。');
    storageAvailable = false;
  }
  renderSaveStatus();
}
function setView(next, focus = true) {
  view = next;
  document.body.dataset.view = next;
  $('#hero').hidden = next !== 'setup';
  for (const name of ['setup', 'battle', 'result']) $('#' + name + '-view').hidden = name !== next;
  const order = ['setup', 'battle', 'result'];
  $$('[data-step]').forEach(item => {
    const current = item.dataset.step === next;
    item.classList.toggle('is-current', current);
    item.classList.toggle('is-done', order.indexOf(item.dataset.step) < order.indexOf(next));
    if (current) item.setAttribute('aria-current', 'step'); else item.removeAttribute('aria-current');
  });
  if (focus) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    $('#' + next + '-title').focus({ preventScroll: true });
  }
}
function setTab(group, focus = false) {
  activeWorkGroup = group;
  $$('[data-tab]').forEach(tab => {
    const selected = tab.dataset.tab === group;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    $('#works-' + tab.dataset.tab).hidden = !selected;
    if (selected && focus) tab.focus();
  });
  renderWorkGroupControls();
}
function renderWorkGroupControls() {
  const query = $('#work-search').value;
  const visible = matchingWorks(activeWorkGroup, query);
  const selected = visible.filter(game => settings.games.includes(game.id)).length;
  const checkbox = $('#select-work-group');
  checkbox.checked = visible.length > 0 && selected === visible.length;
  checkbox.indeterminate = selected > 0 && selected < visible.length;
  checkbox.disabled = !visible.length;
  $('#select-work-group-label').textContent = query.trim() ? '全选本类搜索结果' : '全选本类';
  $('#work-group-count').textContent = '已选 ' + selected + ' / ' + visible.length + ' 项';
  $('#works-total').textContent = '已选 ' + settings.games.length + ' / ' + games.length + ' 个作品条目';
  $('#work-search-count').textContent = query.trim() ? '共找到 ' + matchingWorks(null, query).length + ' 项' : '';
  $('#work-empty').hidden = visible.length > 0;
}
function renderGames() {
  const query = $('#work-search').value;
  for (const { id: group } of workGroups) {
    const visible = matchingWorks(group, query);
    $('[data-tab="' + group + '"] span').textContent = visible.length;
    $('#works-' + group).innerHTML = visible.map(game =>
      '<label class="work-option"><input type="checkbox" data-game="' + game.id + '" ' + (settings.games.includes(game.id) ? 'checked' : '') + '><span class="work-info"><span>' + escape(game.name) + '</span><small>' + escape(game.code) + ' · ' + workCounts.get(game.id) + ' 位</small></span><span class="work-check" aria-hidden="true">' + icon('check') + '</span></label>'
    ).join('');
  }
  renderWorkGroupControls();
}
function visibleRoster() {
  return matchingCharacters($('#character-search').value);
}
function renderRosterSummary() {
  $('#roster-summary').textContent = '已选 ' + candidateIds(settings).length + ' / ' + characters.length + ' 位角色'
    + ($('#character-search').value.trim() ? ' · 搜索到 ' + visibleRoster().length + ' 位' : '');
}
function renderRoster() {
  if (!$('#roster-details').open) return;
  const rows = visibleRoster();
  const selected = new Set(candidateIds(settings));
  renderRosterSummary();
  $('#roster-list').innerHTML = rows.map(character => '<label class="roster-character"><input type="checkbox" data-character="' + character.id + '" ' + (selected.has(character.id) ? 'checked' : '') + '>' + '<img src="' + character.image + '" alt="" width="25" height="32" loading="lazy">' + '<span>' + escape(character.name) + '</span></label>').join('');
  $('#roster-empty').hidden = rows.length > 0;
}
function renderPresetState() {
  const activeIds = selectedWorkPresetIds(settings);
  $$('#work-presets [data-preset]').forEach(input => { input.checked = activeIds.includes(input.dataset.preset); });
  const active = workPresets.filter(preset => activeIds.includes(preset.id));
  $('#preset-description').textContent = active.length
    ? '已选预设：' + active.map(preset => preset.label).join(' ＋ ')
    : settings.games.length || settings.included?.length ? '自定义范围' : '尚未选择范围';
}
function renderCounts() {
  renderPresetState();
  renderRosterSummary();
  const count = candidateIds(settings).length;
  const limit = rankingLimit(settings, count);
  const bound = count < 2 ? 0 : comparisonBound(count, limit);
  const minutes = Math.max(1, Math.ceil(bound * 3 / 60));
  $('#character-count').textContent = count;
  renderWorkGroupControls();
  $('#ranking-summary').textContent = settings.limit === 'all' ? '完整排名' : settings.limit === 1 ? '只找本命' : '前 ' + limit + ' 位';
  $('#time-estimate').textContent = count < 2 ? '—' : bound < 12 ? '不到 1 分钟' : '约 ' + minutes + ' 分钟';
  $('#comparison-estimate').textContent = count < 2 ? '至少需要两位角色，才能开始比较。' : '最多 ' + bound + ' 次选择';
  $('#start-button').disabled = count < 2;
  $('#start-hint').textContent = count < 2 ? '请再邀请几位角色加入吧。' : '不必着急，途中可以随时暂停。';
}
function renderResume() {
  $('#resume-banner').hidden = !sorter;
  if (!sorter) return;
  $('#resume-detail').textContent = sorter.done ? '已完成的本命榜单，仍为你妥善保存。' : '已完成 ' + sorter.decisions.length + ' 次选择 · ' + sorter.ids.length + ' 位角色';
  $('#resume-button').textContent = sorter.done ? '查看上次结果 →' : '继续测试 →';
}
function renderSetup() {
  renderGames();
  $$('input[name="limit"]').forEach(input => { input.checked = input.value === String(settings.limit); });
  renderCounts();
  renderRoster();
  renderResume();
}
function settingsChanged(rebuild = false) {
  if (rebuild) renderSetup(); else { renderCounts(); renderRoster(); }
  save();
}
function begin() {
  const ids = candidateIds(settings);
  if (ids.length < 2) return;
  sorter = new FavoriteSorter(shuffleIds(ids), rankingLimit(settings, ids.length));
  startedAt = Date.now();
  currentResult = null;
  clearResultHash();
  save();
  renderBattle();
  setView('battle');
}
function cardHTML(id) {
  const character = characterById.get(id);
  return '<div class="portrait-stage">'
    + '<img src="' + character.image + '" alt="" width="200" height="300" draggable="false">'
    + '<span class="portrait-fallback" aria-hidden="true">' + escape(character.name.slice(0, 2)) + '</span></div><div class="character-info"><h2>' + escape(character.name) + '</h2><p>' + escape(character.title) + '</p><span class="pick-label">' + icon('heart') + '更喜欢这一位</span></div>';
}
function renderBattle() {
  if (sorter.done) { renderResult(); return; }
  for (const side of ['left', 'right']) {
    const button = $('#choose-' + side);
    button.innerHTML = cardHTML(sorter.pair[side]);
    button.setAttribute('aria-label', '更喜欢' + characterById.get(sorter.pair[side]).name);
  }
  const count = sorter.decisions.length;
  const bound = comparisonBound(sorter.ids.length, sorter.limit);
  $('#battle-number').textContent = '第 ' + String(count + 1).padStart(3, '0') + ' 次抉择';
  $('#battle-progress-text').textContent = '已选 ' + count + ' 次 / 最多 ' + bound + ' 次';
  $('#battle-progress').value = Math.min(99, Math.floor(count / bound * 100));
  $('#undo-button').disabled = count === 0;
  $('#battle-announcement').textContent = '第 ' + (count + 1) + ' 次选择：' + characterById.get(sorter.pair.left).name + '，或' + characterById.get(sorter.pair.right).name + '。';
}
function choose(choice) {
  if (view !== 'battle' || !sorter || sorter.done || document.querySelector('dialog[open]')) return;
  // Ignore accidental double taps and held keys; never auto-answer for the user.
  const now = performance.now();
  if (now - lastChoiceAt < 180) return;
  lastChoiceAt = now;
  sorter.choose(choice);
  save();
  if (sorter.done) { renderResult(); setView('result'); } else renderBattle();
}
function undo() {
  if (!sorter || !sorter.decisions.length) return;
  sorter = sorter.undo();
  currentResult = null;
  clearResultHash();
  save();
  renderBattle();
  if (view !== 'battle') setView('battle');
}
function renderResult(shared = null) {
  currentResult = shared || { rankings: sorter.rankings, total: sorter.ids.length };
  const { rankings, total } = currentResult;
  const first = rankings[0];
  const winner = characterById.get(first.ids[0]);
  const isTie = first.ids.length > 1;
  const count = flattenRankings(rankings).length;
  $('#result-description').textContent = shared ? '一份被分享的心动名单 · 从 ' + total + ' 位角色中选出' : total + ' 位角色，' + sorter.decisions.length + ' 次选择。每一次偏爱，都有了答案。';
  $('#winner-card').innerHTML = '<div class="winner-portrait">' + '<img src="' + winner.image + '" alt="' + escape(winner.name) + '的立绘">' + '</div><div class="winner-copy"><h2>' + (isTie ? '这份喜欢，不分先后。' : escape(winner.name)) + '</h2>' + (isTie ? '<div class="tied-winners">' + first.ids.map(id => '<span>' + escape(characterById.get(id).name) + '</span>').join('') + '</div>' : '<p>' + escape(winner.title) + '</p><p class="winner-quote">穿过幻想的边界，<br>原来最想遇见的，一直是你。</p>') + '<span class="winner-badge">' + (isTie ? first.ids.length + ' 位角色并列本命' : '♡ 我的本命角色') + '</span></div>';
  $('#result-count').textContent = count + ' 位角色' + (rankings.some(group => group.ids.length > 1) ? ' · 含并列名次' : '');
  $('#ranking-list').innerHTML = flattenRankings(rankings).map(({ rank, character }) => '<li class="ranking-row" value="' + rank + '"><span class="rank-number" aria-label="第' + rank + '名">' + String(rank).padStart(2, '0') + '</span>' + '<img class="rank-avatar" src="' + character.image + '" alt="" loading="lazy" width="36" height="46">' + '<div class="rank-info"><strong>' + escape(character.name) + '</strong><p>' + escape(character.title) + '</p></div><span class="rank-work">' + escape(games.find(game => game.id === character.games[0])?.name || '幻想乡') + '</span></li>').join('');
  $('#result-undo').hidden = !!shared;
}
function clearResultHash() {
  if (location.hash.startsWith('#result=')) history.replaceState(null, '', location.pathname + location.search);
}
function openSharedResult() {
  if (!location.hash.startsWith('#result=')) return false;
  try {
    renderResult(decodeResult(location.hash.slice(8)));
    setView('result');
    return true;
  } catch {
    toast('这份分享链接不完整或已不兼容。你仍可以开始自己的测试。');
    return false;
  }
}
async function copyText(text, message) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('No clipboard API');
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.append(textarea);
    textarea.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch { /* Manual copy remains available. */ }
    finally { textarea.remove(); }
    if (!copied) { showCopyFallback(text); return; }
  }
  toast(message);
}
function showCopyFallback(text) {
  const dialog = document.createElement('dialog');
  dialog.className = 'about-dialog';
  dialog.setAttribute('aria-label', '手动复制结果');
  const heading = document.createElement('h2'); heading.textContent = '长按或全选，复制这份心动';
  const area = document.createElement('textarea'); area.value = text; area.readOnly = true;
  area.style.cssText = 'width:100%;height:240px;margin:20px 0;font:inherit';
  area.setAttribute('aria-label', '可复制的结果');
  const close = document.createElement('button'); close.className = 'button'; close.textContent = '关闭';
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => dialog.remove());
  dialog.append(heading, area, close); document.body.append(dialog); dialog.showModal(); area.select();
}

// Settings use stable native controls; filtering never mutates the active test.
$$('[data-tab]').forEach(tab => {
  tab.addEventListener('click', () => setTab(tab.dataset.tab));
  tab.addEventListener('keydown', event => {
    const tabs = $$('[data-tab]');
    let index = tabs.indexOf(tab);
    if (event.key === 'ArrowRight') index = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') index = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = tabs.length - 1;
    else return;
    event.preventDefault(); setTab(tabs[index].dataset.tab, true);
  });
});
$('#work-search').addEventListener('input', () => {
  renderGames();
  const query = $('#work-search').value;
  if (query.trim() && !matchingWorks(activeWorkGroup, query).length) {
    const firstMatch = matchingWorks(null, query)[0];
    if (firstMatch) setTab(firstMatch.group);
  }
});
$('#select-work-group').addEventListener('change', event => {
  settings = setWorksSelected(settings, matchingWorks(activeWorkGroup, $('#work-search').value).map(game => game.id), event.target.checked);
  settingsChanged(true);
});
$('#setup-view').addEventListener('change', event => {
  const input = event.target;
  if (input.dataset.game) {
    const selected = new Set(settings.games);
    if (input.checked) selected.add(input.dataset.game); else selected.delete(input.dataset.game);
    settings.games = [...selected]; settings.presetIds = []; settingsChanged();
  } else if (input.dataset.character) {
    settings = setCharactersSelected(settings, [input.dataset.character], input.checked);
    renderCounts(); save();
  } else if (input.name === 'limit') {
    settings.limit = input.value === 'all' ? 'all' : Number(input.value); renderCounts(); save();
  }
});
$('#work-presets').innerHTML = workPresets.map(preset =>
  '<label class="preset-chip" title="' + escape(preset.description) + '"><input type="checkbox" data-preset="' + preset.id + '"><span>' + escape(preset.label) + '</span></label>'
).join('');
$('#work-presets').addEventListener('change', event => {
  const input = event.target.closest('[data-preset]');
  if (!input) return;
  const preset = workPresets.find(item => item.id === input.dataset.preset);
  settings = toggleWorkPreset(settings, preset.id);
  $('#work-search').value = '';
  $('#character-search').value = '';
  if (input.checked) setTab(preset.tab);
  settingsChanged(true);
});
$('#clear-work-range').addEventListener('click', () => {
  settings = applyWorkPresets(settings, []);
  $('#work-search').value = '';
  $('#character-search').value = '';
  settingsChanged(true);
});
$('#reset-settings').addEventListener('click', () => { settings = defaultSettings(); $('#character-search').value = ''; $('#work-search').value = ''; setTab('main'); settingsChanged(true); toast(sorter ? '已恢复默认范围；上次的测试进度仍然保留。' : '已恢复默认作品范围和测试设置。'); });
$('#roster-details').addEventListener('toggle', renderRoster);
$('#character-search').addEventListener('input', renderRoster);
for (const action of ['select', 'exclude']) $('#'+ action +'-visible').addEventListener('click', () => {
  settings = setCharactersSelected(settings, visibleRoster().map(character => character.id), action === 'select');
  settingsChanged();
});
$('#start-button').addEventListener('click', () => {
  if (sorter) $('#confirm-dialog').showModal(); else begin();
});
$('#cancel-new').addEventListener('click', () => $('#confirm-dialog').close());
$('#confirm-new').addEventListener('click', () => { $('#confirm-dialog').close(); begin(); });
$('#resume-button').addEventListener('click', () => {
  if (!sorter) return;
  clearResultHash();
  if (sorter.done) { renderResult(); setView('result'); } else { renderBattle(); setView('battle'); }
});
$('#pause-button').addEventListener('click', () => { save(); renderSetup(); setView('setup'); });
$('#choose-left').addEventListener('click', () => choose('left'));
$('#choose-right').addEventListener('click', () => choose('right'));
$('#tie-button').addEventListener('click', () => choose('tie'));
$('#undo-button').addEventListener('click', undo);
$('#result-undo').addEventListener('click', undo);
$('#restart-button').addEventListener('click', () => { clearResultHash(); renderSetup(); setView('setup'); });
$('#copy-result').addEventListener('click', () => copyText(resultText(currentResult.rankings, resultPageUrl(location.href)), '心动榜单已复制，去分享这份喜欢吧。'));
$('#share-result').addEventListener('click', () => {
  const url = new URL(resultPageUrl(location.href));
  url.hash = 'result=' + encodeResult(currentResult.rankings, currentResult.total);
  copyText(url.href, '结果链接已复制，打开即可查看完整榜单。');
});
$$('[data-open-about]').forEach(button => button.addEventListener('click', () => $('#about-dialog').showModal()));
$('[data-close-dialog]').addEventListener('click', () => $('#about-dialog').close());
$('#catalog-description').textContent = '收录 ' + characters.length + ' 位角色，涵盖旧作、正作、外传、官方书籍、秘封音乐 CD 与《蓬莱人形》，至锦上京（TH20）。';
document.addEventListener('keydown', event => {
  if (view !== 'battle' || event.repeat || event.ctrlKey || event.metaKey || event.altKey || document.querySelector('dialog[open]') || event.target.closest('input,textarea,select,[contenteditable]')) return;
  const choices = { ArrowLeft: 'left', '1': 'left', ArrowRight: 'right', '2': 'right', ArrowDown: 'tie', '3': 'tie' };
  if (choices[event.key]) { event.preventDefault(); choose(choices[event.key]); }
  if (event.key === 'Backspace') { event.preventDefault(); undo(); }
});
document.addEventListener('error', event => {
  const image = event.target;
  if (image instanceof HTMLImageElement && image.closest('.portrait-stage')) image.parentElement.classList.add('image-failed');
  else if (image instanceof HTMLImageElement && image.closest('.winner-portrait')) {
    const fallback = document.createElement('span'); fallback.className = 'winner-initial'; fallback.textContent = currentResult ? characterById.get(currentResult.rankings[0].ids[0]).name.slice(0, 2) : '心动'; image.replaceWith(fallback);
  }
}, true);
window.addEventListener('hashchange', () => { if (!openSharedResult()) { renderSetup(); setView('setup'); } });

renderSetup();
setTab(settings.games.some(id => games.find(game => game.id === id)?.group === 'main') ? 'main' : games.find(game => settings.games.includes(game.id))?.group || 'main');
setView('setup', false);
if (!openSharedResult() && initialWarning) toast(initialWarning);
renderSaveStatus();

// Canvas export uses same-origin images and local fonts, with safe system fallbacks.
async function loadExportImage(src) {
  return new Promise(resolve => {
    const image = new Image();
    const timer = setTimeout(() => resolve(null), 5000);
    image.onload = () => { clearTimeout(timer); resolve(image); };
    image.onerror = () => { clearTimeout(timer); resolve(null); };
    image.src = src;
  });
}
$('#download-result').addEventListener('click', async () => {
  const button = $('#download-result');
  if (!currentResult || button.disabled) return;
  button.disabled = true;
  try {
    const { rankings, total } = currentResult;
    const allRows = flattenRankings(rankings);
    const rows = allRows.slice(0, 20);
    const pageHref = location.href;
    const [logo, background, images] = await Promise.all([
      loadExportImage(BRAND_LOGO_URL),
      loadExportImage(RESULT_BACKGROUND_URL),
      Promise.all(rows.map(row => loadExportImage(row.character.image))),
      loadResultFonts(),
    ]);
    const canvas = document.createElement('canvas');
    const layout = prepareResultPoster(allRows);
    canvas.width = layout.width;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    const footer = prepareResultFooter(ctx, canvas.width, layout.footerTop, pageHref);
    canvas.height = footer.height;
    drawResultPoster(ctx, layout, { total, allRows, logo, background, images, height:canvas.height });
    drawResultFooter(ctx, footer, { truncated:allRows.length > 20 });
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Export failed');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = '我的东方本命榜单.png';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    toast('结果图已生成。如果未自动下载，请使用浏览器的下载菜单。');
  } catch {
    toast('结果图暂时无法生成，可以先复制完整榜单。');
  } finally { button.disabled = false; }
});
