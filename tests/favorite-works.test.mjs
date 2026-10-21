import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { characters, games, workGroups, CATALOG_VERSION } from '../src/favorite/characters.js';
import { legacyWorksV3 } from '../src/favorite/catalog-v3.js';
import { FavoriteSorter } from '../src/favorite/sorter.js';
import { workPresets, applyWorkPresets, selectedWorkPresetIds, toggleWorkPreset } from '../src/favorite/presets.js';
import { defaultSettings, candidateIds, matchingWorks, setWorksSelected, restoreSession, serializeSession, validateSettings } from '../src/favorite/model.js';
const idsFor = id => candidateIds({...defaultSettings(),games:[id]});
const save = (settings, catalogVersion, run = null) => JSON.stringify({version:1,catalogVersion,settings,run});
const fightingIds = ['th075','th105','th123','th135','th145','th155','th175'];
const stgIds = ['th095','th125','th128','th143','th165','th185'];
const coarseRoster = id => ['A','B'].includes(id)
  ? [...new Set(Object.values(legacyWorksV3).filter(work=>work.group===id).flatMap(work=>work.ids))] : idsFor(id);

// Model the old preset definitions independently of the new per-work filters.
function version4PresetSettings(presetIds) {
  const selected = new Set();
  const allowed = new Set();
  for (const id of presetIds) {
    const preset = workPresets.find(preset=>preset.id===id);
    const works = id==='hifuu' ? ['E','A'] : [...new Set(preset.games.filter(workId=>workId!=='hr01').map(workId=>legacyWorksV3[workId]?.group || workId))];
    works.forEach(work=>selected.add(work));
    works.flatMap(coarseRoster).forEach(character=>{
      if (!preset.only || preset.only.includes(character)) allowed.add(character);
    });
  }
  const potential = new Set([...selected].flatMap(coarseRoster));
  const excluded = characters.filter(character=>potential.has(character.id) && !allowed.has(character.id)).map(character=>character.id);
  return {...defaultSettings(),games:[...selected],excluded,presetIds,limit:1,showImages:false};
}

test('only the fighting and STG buckets split: 36 entries in three tabs, with Hourai under other',()=>{
  assert.equal(CATALOG_VERSION,7); assert.equal(games.length,36);
  assert.equal(new Set(games.map(game=>game.id)).size,36);
  assert.deepEqual(Object.fromEntries(workGroups.map(group=>[group.id,games.filter(game=>game.group===group.id).length])),{main:15,other:16,old:5});
  assert.deepEqual(games.filter(game=>game.group==='other').map(game=>[game.id,game.name]),[
    ['th075','东方萃梦想'],['th105','东方绯想天'],['th123','东方非想天则'],['th135','东方心绮楼'],
    ['th145','东方深秘录'],['th155','东方凭依华'],['th175','东方刚欲异闻'],
    ['th095','东方文花帖'],['th125','DS 东方文花帖'],['th128','妖精大战争'],
    ['th143','弹幕天邪鬼'],['th165','秘封噩梦日记'],['th185','弹幕狂们的黑市'],
    ['D','官方书籍'],['E','音乐 CD · 秘封'],['hr01','蓬莱人形']]);
  assert.equal(defaultSettings().games.length,31);
  assert.equal(candidateIds(defaultSettings()).length,145);
  for(const character of characters) {
    assert.ok(character.games.length>0);
    assert.ok(character.games.every(id=>games.some(game=>game.id===id)));
    assert.equal(new Set(character.games).size,character.games.length);
  }
});

test('each individual game has its verified roster, not its entire former bucket',()=>{
  const expectedCounts = [13,16,21,15,18,29,17,26,30,9,34,40,28];
  for(const [index,id] of [...fightingIds,...stgIds].entries()) {
    assert.equal(idsFor(id).length,expectedCounts[index],id);
    assert.deepEqual(new Set(idsFor(id)),new Set(legacyWorksV3[id].ids),id);
  }
  assert.ok(idsFor('th075').includes('023'));
  assert.ok(!idsFor('th075').includes('123'));
  assert.ok(idsFor('th145').includes('123'));
  assert.ok(idsFor('th165').includes('123'));
  assert.equal(idsFor('D').length,131);
  assert.deepEqual(new Set(idsFor('E')),new Set(['079','080']));
  assert.equal(idsFor('o').length,25);
  assert.equal(candidateIds({...defaultSettings(),games:games.map(game=>game.id)}).length,173);
});

test('upper family presets select all their games and combine without duplicated characters',()=>{
  const fighting = applyWorkPresets(defaultSettings(),['fighting']);
  const stg = applyWorkPresets(defaultSettings(),['stg']);
  assert.deepEqual(fighting.games,fightingIds); assert.deepEqual(stg.games,stgIds);
  assert.equal(candidateIds(fighting).length,58); assert.equal(candidateIds(stg).length,98);
  const both = toggleWorkPreset(fighting,'stg');
  assert.deepEqual(new Set(both.games),new Set([...fightingIds,...stgIds]));
  assert.equal(candidateIds(both).length,107);
  assert.deepEqual(selectedWorkPresetIds(both),['fighting','stg']);
  assert.deepEqual(candidateIds(toggleWorkPreset(both,'fighting')),candidateIds(stg));
  assert.deepEqual(candidateIds(toggleWorkPreset(both,'stg')),candidateIds(fighting));
  const manual = setWorksSelected(fighting,['th145'],false);
  assert.deepEqual(manual.presetIds,[]);
  assert.equal(manual.games.length,6);
});

test('work search finds expanded names and codes; category selection stays scoped',()=>{
  assert.deepEqual(matchingWorks(null,'TH 20').map(game=>game.id),['o']);
  assert.deepEqual(matchingWorks('other','书籍').map(game=>game.id),['D']);
  assert.deepEqual(matchingWorks('other','东方刚欲异闻').map(game=>game.id),['th175']);
  assert.deepEqual(matchingWorks('other','TH 12.5').map(game=>game.id),['th125']);
  const initial = {...defaultSettings(),games:['a','th075'],excluded:['001']};
  const selected = setWorksSelected(initial,matchingWorks('other').map(game=>game.id),true);
  assert.equal(selected.games.length,17);
  assert.deepEqual(selected.excluded,['001']);
  assert.deepEqual(setWorksSelected(selected,matchingWorks('other').map(game=>game.id),false).games,['a']);
  assert.deepEqual(initial.games,['a','th075']);
});

test('every v3 detailed work migrates exactly; only books and CDs remain collapsed',()=>{
  for(const [id,legacy] of Object.entries(legacyWorksV3)) {
    const settings = {...defaultSettings(),games:[id],excluded:[],showImages:false};
    const migrated = restoreSession(save(settings,3)).settings;
    assert.deepEqual(migrated.games,[['A','B'].includes(legacy.group) ? id : legacy.group]);
    assert.deepEqual(new Set(candidateIds(migrated)),new Set(legacy.ids),id);
    assert.equal(migrated.showImages,true);
    assert.deepEqual(migrated.presetIds,[]);
  }
});

test('v3 mixed selections preserve exact candidates and the running test',()=>{
  const sorter = new FavoriteSorter(['001','034','079','080'],2); sorter.choose('right');
  const settings = {...defaultSettings(),games:['a','th175','book-kasen','cd11'],excluded:['001'],limit:1};
  const expected = new Set([...idsFor('a'),...legacyWorksV3.th175.ids,...legacyWorksV3['book-kasen'].ids,...legacyWorksV3.cd11.ids].filter(id=>id!=='001'));
  const raw = JSON.parse(serializeSession(settings,sorter,1792407600000)); raw.catalogVersion=3;
  const migrated = restoreSession(JSON.stringify(raw));
  assert.deepEqual(new Set(migrated.settings.games),new Set(['a','th175','D','E']));
  assert.deepEqual(new Set(candidateIds(migrated.settings)),expected);
  assert.deepEqual(migrated.sorter.pair,sorter.pair);
  assert.deepEqual(migrated.sorter.ids,sorter.ids);
  assert.deepEqual(migrated.sorter.decisions,sorter.decisions);
  assert.equal(migrated.settings.limit,1);
});

test('v1, v2 and v4 coarse selections expand without widening or dropping exclusions',()=>{
  for (const version of [1,2,4]) for (const works of [['A'],['B'],['A','B'],['a','A','D','E']]) {
    const settings = {...defaultSettings(),games:works,excluded:['001','205']};
    const expected = new Set(works.flatMap(coarseRoster).filter(id=>!settings.excluded.includes(id)));
    const migrated = restoreSession(save(settings,version)).settings;
    assert.deepEqual(new Set(candidateIds(migrated)),expected);
    assert.deepEqual(migrated.excluded,settings.excluded);
    assert.deepEqual(migrated.presetIds,[]);
    assert.ok(!migrated.games.includes('A') && !migrated.games.includes('B'));
    assert.deepEqual(restoreSession(serializeSession(migrated,null,null)).settings,migrated);
  }
});

test('all v4 single and paired presets retain their checked state and precise roster after migration',()=>{
  const combinations = workPresets.flatMap(first=>[
    [first.id],...workPresets.filter(second=>second.id!==first.id).map(second=>[first.id,second.id])
  ]);
  combinations.push(['classic','hifuu','old'],workPresets.map(preset=>preset.id));
  for(const presetIds of combinations) {
    const legacy = version4PresetSettings(presetIds);
    const migrated = restoreSession(save(legacy,4)).settings;
    const expected = applyWorkPresets(defaultSettings(),presetIds);
    const originalIds = new Set(legacy.games.flatMap(coarseRoster).filter(id=>!legacy.excluded.includes(id)));
    if(presetIds.includes('all')) ['206','207'].forEach(id=>originalIds.add(id));
    assert.deepEqual(selectedWorkPresetIds(migrated),presetIds,presetIds.join('+'));
    assert.deepEqual(new Set(migrated.games),new Set(expected.games));
    assert.deepEqual(new Set(candidateIds(migrated)),originalIds);
    assert.equal(migrated.limit,1); assert.equal(migrated.showImages,true);
    assert.deepEqual(restoreSession(serializeSession(migrated,null,null)).settings,migrated);
  }
});

test('v4 manual edits never become presets and active comparison history is unchanged',()=>{
  const selected = version4PresetSettings(['fighting','stg','hifuu']);
  const sorter = new FavoriteSorter(['001','002','079','080'],3); sorter.choose('tie');
  const raw = JSON.parse(serializeSession(selected,sorter,1792407600000,true)); raw.catalogVersion=4;
  const restored = restoreSession(JSON.stringify(raw));
  assert.deepEqual(selectedWorkPresetIds(restored.settings),selected.presetIds);
  assert.deepEqual(restored.sorter.ids,sorter.ids);
  assert.deepEqual(restored.sorter.pair,sorter.pair);
  assert.deepEqual(restored.sorter.decisions,sorter.decisions);
  assert.equal(restored.showImages,true);
  for (const custom of [
    {...selected,excluded:[...selected.excluded,'001']},
    {...selected,games:[...selected.games,'D']},
    {...selected,excluded:[...selected.excluded,'205']},
  ]) {
    const migrated = restoreSession(save(custom,4)).settings;
    assert.deepEqual(migrated.presetIds,[]);
    assert.deepEqual(new Set(candidateIds(migrated)),new Set(custom.games.flatMap(coarseRoster).filter(id=>!custom.excluded.includes(id))));
  }
});

test('v5 validates detailed games, rejects retired IDs and uses version-specific save validation',()=>{
  const settings = {...defaultSettings(),games:['th175','D'],excluded:['001']};
  assert.ok(validateSettings(settings));
  assert.deepEqual(restoreSession(serializeSession(settings,null,null)).settings,settings);
  for (const id of ['A','B','book-kasen','cd11']) {
    assert.equal(validateSettings({...settings,games:[id]}),false);
    assert.throws(()=>restoreSession(serializeSession({...settings,games:[id]},null,null)));
  }
  assert.throws(()=>restoreSession(save(settings,4)));
  for(const presetIds of [['bogus'],['classic','classic'],'all']) assert.throws(()=>restoreSession(serializeSession({...settings,presetIds},null,null)));
});

test('UI keeps the original panels and documents every selectable work',async()=>{
  const html = await readFile(new URL('../src/favorite/index.html',import.meta.url),'utf8');
  const docs = await readFile(new URL('../src/favorite/WORKS.md',import.meta.url),'utf8');
  for(const group of workGroups) { assert.ok(html.includes('id="tab-'+group.id+'"')); assert.ok(html.includes('id="works-'+group.id+'"')); }
  assert.ok(!html.includes('id="tab-fighting"'));
  assert.match(html,/外传与秘封 <span>16<\/span>/);
  for(const game of games) assert.ok(docs.includes(game.name),game.name);
});
