import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { buildCharacters, characterSourceIds, renderCatalog } from '../tools/import-favorite-characters.mjs';
import { characters, games, workGroups, CATALOG_VERSION } from '../src/favorite/characters.js';
import { candidateIds, defaultSettings, matchingCharacters, restoreSession, serializeSession, encodeResult, decodeResult } from '../src/favorite/model.js';
import { applyWorkPresets } from '../src/favorite/presets.js';
import { FavoriteSorter } from '../src/favorite/sorter.js';

const byId = new Map(characters.map(character => [character.id, character]));
const supplementalIds = new Set(['112', '120', '139']);

// Synthetic input keeps the importer tests portable; real-snapshot verification is --check.
function fixture() {
  return {
    archive: { characters: characters.filter(character => !supplementalIds.has(character.id)).map(character => ({
      id: characterSourceIds[character.id],
      name: '档案名字' + character.id,
      short_description: '档案简介' + character.id,
      alias: ['来源别名' + character.id, '共同别名', '共同别名'],
      introduction: character.id === '065' ? '能够驱使入道云山。' : '',
      abilities: character.id === '014' ? '操控人偶程度的能力' : '',
    })) },
    aliases: Object.fromEntries(characters.map(character => [characterSourceIds[character.id],
      ['别名' + character.id, '  共同别名  ', '共同别名']])),
  };
}

test('all 173 stable IDs have explicit robot-source mappings with reviewed exceptions', () => {
  assert.equal(CATALOG_VERSION, 7);
  assert.equal(characters.length, 173);
  assert.deepEqual(Object.keys(characterSourceIds).sort(), characters.map(character => character.id).sort());
  assert.equal(new Set(Object.values(characterSourceIds)).size, characters.length);
  for (const [id, source] of [['065', '云居一轮'], ['112', '云山'], ['120', '人偶（含上海人偶、哥利亚人偶）'], ['139', '占卜师（易者）'], ['205', '渡里妮娜']]) {
    assert.equal(characterSourceIds[id], source);
  }
  assert.equal(candidateIds(defaultSettings()).length, 145);
  assert.equal(games.length, 36);
});

test('display names normalize robot translations while all former spellings remain searchable', () => {
  for (const [id, name, previous] of [
    ['015', '莉莉霍瓦特', '莉莉白'],
    ['027', '因幡天为', '因幡帝'],
    ['032', 'Reisen', '铃仙 II 号'],
    ['039', '四季映姬·夜摩仙那度', '四季映姬·亚玛萨那度'],
    ['040', '桑尼米尔克', '桑妮·米尔克'],
    ['041', '斯塔萨菲雅', '斯塔·萨菲雅'],
    ['042', '露娜切露德', '露娜·切尔德'],
    ['087', '幽幻魔眼', '幽玄魔眼'],
    ['119', '无名的读书妖怪', '朱鹭子'],
    ['143', '爱塔妮缇拉尔瓦', '爱塔妮缇·拉尔瓦'],
    ['144', '坂田合欢', '坂田合欢乃'],
  ]) {
    assert.equal(byId.get(id).name, name);
    assert.ok(matchingCharacters(previous).some(character => character.id === id), previous);
  }
  for (const [query, id] of [['红白', '001'], ['はくれいれいむ', '001'], ['Hakurei Reimu', '001'], ['泠仙', '032'], ['渡里妮娜', '205'], ['夹克子', '206'], ['label子', '207']]) {
    assert.ok(matchingCharacters(query).some(character => character.id === id), query);
  }
});

test('identity splits, compact descriptions and the corrected instruments survive import', () => {
  for (const [id, name, title] of [
    ['065', '云居一轮', '守护与被守护的大轮'],
    ['112', '云山', '守护一轮的入道'],
    ['120', '爱丽丝的人偶', '爱丽丝操纵的人偶'],
    ['139', '易者', '占卜师'],
    ['123', '宇佐见堇子', '秘封俱乐部初代会长'],
    ['127', '九十九弁弁', '古琵琶的付丧神'],
    ['128', '九十九八桥', '古琴的付丧神'],
    ['079', '玛艾露贝莉·赫恩', '秘封俱乐部的相对性精神学学生'],
    ['080', '宇佐见莲子', '秘封俱乐部的超统一物理学学生'],
    ['206', '封套子', '《蓬莱人形》封面角色'],
    ['207', '碟面子', '《蓬莱人形》C62 碟面角色'],
  ]) {
    assert.equal(byId.get(id).name, name);
    assert.equal(byId.get(id).title, title);
  }
  assert.deepEqual(matchingCharacters('云山').map(character => character.id), ['112']);
  for (const character of characters) {
    assert.ok(character.title.length && [...character.title].length <= 24, character.id);
    assert.ok(character.aliases.length, character.id);
    const aliases = character.aliases.map(alias => alias.toLocaleLowerCase());
    assert.equal(new Set(aliases).size, aliases.length, character.id);
    assert.ok(!aliases.includes(character.name.toLocaleLowerCase()), character.id);
  }
});

test('importer rebuilds metadata exclusively from its inputs and preserves gameplay structure', () => {
  const { archive, aliases } = fixture();
  const poisoned = characters.map(character => ({ ...character, name: '旧名字不能泄漏', title: '旧简介不能泄漏', aliases: ['旧别名不能泄漏'] }));
  const rebuilt = buildCharacters(poisoned, archive, aliases);
  assert.deepEqual(rebuilt, buildCharacters(characters, archive, aliases));
  assert.equal(rebuilt[0].name, '档案名字001');
  assert.equal(rebuilt[0].title, '档案简介001');
  assert.equal(rebuilt[0].aliases.filter(alias => alias === '共同别名').length, 1);
  for (const [i, character] of rebuilt.entries()) {
    assert.equal(character.id, characters[i].id);
    assert.deepEqual(character.games, characters[i].games);
    assert.notEqual(character.games, characters[i].games);
    assert.equal(character.image, characters[i].image);
    assert.doesNotMatch(JSON.stringify(character), /不能泄漏/);
  }
  assert.deepEqual(buildCharacters(rebuilt, archive, aliases), rebuilt);
});

test('importer fails rather than silently reusing old metadata when source coverage changes', () => {
  const { archive, aliases } = fixture();
  assert.throws(() => buildCharacters(characters.slice(1), archive, aliases), /Stable character IDs/);
  const duplicate = [characters[0], ...characters.slice(0, -1)];
  assert.throws(() => buildCharacters(duplicate, archive, aliases), /Stable character IDs/);
  assert.throws(() => buildCharacters(characters, { characters: [...archive.characters, archive.characters[0]] }, aliases), /Duplicate source/);
  assert.throws(() => buildCharacters(characters, { characters: archive.characters.slice(1) }, aliases), /Missing source character/);
  const missingAlias = structuredClone(aliases);
  delete missingAlias['云山'];
  assert.throws(() => buildCharacters(characters, archive, missingAlias), /Missing aliases/);
  const missingEvidence = structuredClone(archive);
  missingEvidence.characters.find(character => character.id === '云居一轮').introduction = '';
  assert.throws(() => buildCharacters(characters, missingEvidence, aliases), /Missing related evidence/);
  const overlong = structuredClone(archive);
  overlong.characters[0].short_description = '长'.repeat(25);
  assert.throws(() => buildCharacters(characters, overlong, aliases), /overlong description/);
});

test('catalog serialization is deterministic and has no discarded metadata attribution header', async () => {
  const data = await readFile(new URL('../src/favorite/characters.js', import.meta.url), 'utf8');
  assert.equal(renderCatalog({ CATALOG_VERSION, workGroups, games, characters }), data.replace(/\r\n/g, '\n'));
  assert.ok(data.startsWith('export const CATALOG_VERSION = 7;'));
  assert.doesNotMatch(data, /Shigma|uzkk|Base character metadata/);
});

test('v6 and v7 preserve exact presets, custom ranges, active logs and ID-based result links', () => {
  const settingsList = [
    defaultSettings(),
    applyWorkPresets(defaultSettings(), ['all']),
    applyWorkPresets(defaultSettings(), ['classic', 'hifuu']),
    { ...defaultSettings(), games: ['hr01', 'o'], included: ['079'], excluded: ['001'], presetIds: [] },
  ];
  const sorter = new FavoriteSorter(['032', '065', '112', '127', '206'], 3);
  sorter.choose('left'); sorter.choose('tie');
  for (const settings of settingsList) for (const catalogVersion of [6, 7]) {
    const saved = JSON.parse(serializeSession(settings, sorter, 1792721584000));
    saved.catalogVersion = catalogVersion;
    const restored = restoreSession(JSON.stringify(saved));
    assert.deepEqual(restored.settings, settings);
    assert.deepEqual(candidateIds(restored.settings), candidateIds(settings));
    assert.deepEqual(restored.sorter.ids, sorter.ids);
    assert.deepEqual(restored.sorter.decisions, sorter.decisions);
    assert.deepEqual(restored.sorter.pair, sorter.pair);
    assert.equal(restored.startedAt, 1792721584000);
  }
  const rankings = [{ rank: 1, ids: ['032', '112'] }, { rank: 3, ids: ['206'] }];
  assert.deepEqual(decodeResult(encodeResult(rankings, 173)).rankings, rankings);
});
