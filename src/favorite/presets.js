import { characters, games } from './characters.js';

const inFamily = family => games.filter(game => game.family === family).map(game => game.id);
const inGroup = group => games.filter(game => game.group === group).map(game => game.id);

/** Presets are independent selections. Their character rosters combine by union. */
export const workPresets = [
  { id:'all', label:'全部作品', tab:'main', games:games.map(game => game.id), description:'全部作品，包括旧作。' },
  { id:'classic', label:'红 · 妖 · 永', tab:'main', games:['a','b','c'], description:'红魔乡、妖妖梦、永夜抄。' },
  { id:'hifuu', label:'秘封', tab:'other', games:['E','th145'], only:['079','080','123'], description:'莲子、梅莉与堇子。' },
  { id:'windows', label:'正作', tab:'main', games:inGroup('main'), description:'红魔乡至锦上京的全部整数正作。' },
  { id:'mountain', label:'风 · 地 · 星', tab:'main', games:['e','f','g'], description:'风神录、地灵殿、星莲船。' },
  { id:'belief', label:'神 · 辉 · 绀', tab:'main', games:['h','i','j'], description:'神灵庙、辉针城、绀珠传。' },
  { id:'recent', label:'近作巡礼', tab:'main', games:['k','l','m','n','o'], description:'天空璋、鬼形兽、虹龙洞、兽王园、锦上京。' },
  { id:'th20', label:'锦上京', tab:'main', games:['o'], description:'锦上京。' },
  { id:'fighting', label:'格斗作品', tab:'other', games:inFamily('fighting'), description:'萃梦想、绯想天、非想天则、心绮楼、深秘录、凭依华与刚欲异闻。' },
  { id:'stg', label:'外传 STG', tab:'other', games:inFamily('stg'), description:'摄影作、妖精大战争、天邪鬼、噩梦日记与黑市。' },
  { id:'books', label:'官方书籍', tab:'other', games:['D'], description:'已收录的官方漫画、小说与设定集角色。' },
  { id:'old', label:'旧作巡礼', tab:'old', games:inGroup('old'), description:'灵异传、封魔录、梦时空、幻想乡、怪绮谈。' },
];

const presetById = new Map(workPresets.map(preset => [preset.id, preset]));
const sameSet = (left, right) => left.length === right.length && left.every(id => right.includes(id));

export function validPresetIds(ids) {
  return Array.isArray(ids) && ids.length <= workPresets.length
    && new Set(ids).size === ids.length && ids.every(id => presetById.has(id));
}

export function applyWorkPresets(settings, presetIds) {
  if (!validPresetIds(presetIds)) throw new Error('Invalid work presets.');
  const selectedWorks = new Set();
  const allowedCharacters = new Set();
  for (const id of presetIds) {
    const preset = presetById.get(id);
    preset.games.forEach(game => selectedWorks.add(game));
    for (const character of characters) {
      if (character.games.some(game => preset.games.includes(game))
        && (!preset.only || preset.only.includes(character.id))) allowedCharacters.add(character.id);
    }
  }
  // Apply each preset's restriction before unioning, never as a global filter.
  const excluded = characters.filter(character => character.games.some(game => selectedWorks.has(game))
    && !allowedCharacters.has(character.id)).map(character => character.id);
  return { ...settings, games:[...selectedWorks], excluded, included:[], presetIds:[...presetIds] };
}

/** Manual range edits invalidate the preset selection rather than show stale checked chips. */
export function selectedWorkPresetIds(settings) {
  if (!validPresetIds(settings.presetIds) || !settings.presetIds.length || settings.included?.length) return [];
  const expected = applyWorkPresets(settings, settings.presetIds);
  return sameSet(settings.games, expected.games) && sameSet(settings.excluded, expected.excluded)
    ? [...settings.presetIds] : [];
}

export function toggleWorkPreset(settings, id) {
  if (!presetById.has(id)) throw new Error('Unknown work preset: '+id);
  const selected = new Set(selectedWorkPresetIds(settings));
  if (selected.has(id)) selected.delete(id); else selected.add(id);
  // With a custom range, the first checked preset starts a fresh combination.
  return applyWorkPresets(settings, [...selected]);
}
