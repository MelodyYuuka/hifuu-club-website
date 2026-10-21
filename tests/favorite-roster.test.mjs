import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { characters, CATALOG_VERSION } from '../src/favorite/characters.js';
import { FavoriteSorter } from '../src/favorite/sorter.js';
import { applyWorkPresets, selectedWorkPresetIds } from '../src/favorite/presets.js';
import { defaultSettings, candidateIds, matchingCharacters, setCharactersSelected, setWorksSelected, validateSettings, serializeSession, restoreSession } from '../src/favorite/model.js';

const base = () => ({ ...defaultSettings(), games:['a'] });
const empty = () => ({ ...defaultSettings(), games:[] });

test('character picker always searches all 173 characters, not the selected work roster', () => {
  assert.equal(matchingCharacters().length,173);
  assert.deepEqual(matchingCharacters().map(character=>character.id),characters.map(character=>character.id));
  assert.equal(candidateIds(empty()).length,0);
  assert.equal(candidateIds(base()).length,12);
  assert.deepEqual(matchingCharacters('  宇佐见  ').map(character=>character.id),['080','123']);
  assert.deepEqual(matchingCharacters('渡里贝子').map(character=>character.id),['205']);
  const character = characters.find(character=>character.id==='205');
  assert.ok(matchingCharacters(character.title).some(row=>row.id===character.id));
  assert.deepEqual(matchingCharacters('no such character'),[]);
});

test('checking an out-of-range character adds only that person without selecting their works', () => {
  const original = base();
  const snapshot = structuredClone(original);
  const selected = setCharactersSelected(original,['079'],true);
  assert.deepEqual(original,snapshot);
  assert.deepEqual(selected.games,['a']);
  assert.deepEqual(selected.included,['079']);
  assert.equal(candidateIds(selected).length,13);
  assert.ok(candidateIds(selected).includes('079'));
  assert.ok(!candidateIds(selected).includes('080'));
  const again = setCharactersSelected(selected,['079','079'],true);
  assert.deepEqual(again.included,['079']);
  const removed = setCharactersSelected(again,['079'],false);
  assert.deepEqual(removed.included,[]);
  assert.deepEqual(candidateIds(removed),candidateIds(original));
  assert.deepEqual(candidateIds(setCharactersSelected(removed,['079'],true)),candidateIds(selected));
});

test('in-range selections remove exclusions without adding redundant manual overrides', () => {
  const excluded = setCharactersSelected(base(),['001'],false);
  assert.equal(candidateIds(excluded).length,11);
  assert.ok(!candidateIds(excluded).includes('001'));
  const selected = setCharactersSelected(excluded,['001'],true);
  assert.deepEqual(selected.included,[]);
  assert.deepEqual(selected.excluded,[]);
  assert.deepEqual(candidateIds(selected),candidateIds(base()));
});

test('with no works selected, individual characters can form a valid test', () => {
  let settings = setCharactersSelected(empty(),['079','080'],true);
  assert.deepEqual(settings.games,[]);
  assert.deepEqual(candidateIds(settings),['079','080']);
  assert.ok(validateSettings(settings));
  const sorter = new FavoriteSorter(candidateIds(settings),1);
  sorter.choose('right');
  assert.deepEqual(sorter.rankings,[{rank:1,ids:['080']}]);
  settings = setCharactersSelected(settings,['079','080'],false);
  assert.deepEqual(candidateIds(settings),[]);
});

test('bulk search selection and exclusion only affect matching characters, even outside selected works', () => {
  const results = matchingCharacters('宇佐见').map(character=>character.id);
  const selected = setCharactersSelected(base(),results,true);
  assert.deepEqual(selected.games,['a']);
  assert.equal(candidateIds(selected).length,14);
  assert.ok(candidateIds(selected).includes('080') && candidateIds(selected).includes('123'));
  const excluded = setCharactersSelected(selected,results,false);
  assert.deepEqual(candidateIds(excluded),candidateIds(base()));
  const all = setCharactersSelected(empty(),matchingCharacters().map(character=>character.id),true);
  assert.deepEqual(all.games,[]);
  assert.equal(candidateIds(all).length,173);
  assert.deepEqual(candidateIds(setCharactersSelected(all,matchingCharacters().map(character=>character.id),false)),[]);
  const preset = applyWorkPresets(defaultSettings(),['classic']);
  assert.equal(setCharactersSelected(preset,[],true),preset);
  assert.equal(setCharactersSelected(preset,['invalid-id'],false),preset);
});

test('work edits retain manually added characters and character unions stay deduplicated', () => {
  const selected = setCharactersSelected(base(),['079'],true);
  const joined = setWorksSelected(selected,['E'],true);
  assert.equal(candidateIds(joined).length,14);
  assert.equal(candidateIds(joined).filter(id=>id==='079').length,1);
  const withoutWorks = setWorksSelected(joined,['a','E'],false);
  assert.deepEqual(candidateIds(withoutWorks),['079']);
  assert.deepEqual(withoutWorks.included,['079']);
  const removed = setCharactersSelected(joined,['079'],false);
  assert.deepEqual(removed.included,[]);
  assert.ok(!candidateIds(removed).includes('079'));
  assert.ok(candidateIds(removed,true).includes('079'));
});

test('individual edits switch to custom; fresh presets, clear and reset discard manual additions', () => {
  const preset = applyWorkPresets(defaultSettings(),['classic']);
  const selected = setCharactersSelected(preset,['079'],true);
  assert.deepEqual(selected.presetIds,[]);
  assert.deepEqual(selectedWorkPresetIds({...preset,included:['079']}),[]);
  const hifuu = applyWorkPresets(selected,['hifuu']);
  assert.deepEqual(hifuu.included,[]);
  assert.deepEqual(candidateIds(hifuu),['079','080','123']);
  const customHifuu = setCharactersSelected(hifuu,['001','205'],true);
  assert.deepEqual(new Set(candidateIds(customHifuu)),new Set(['001','079','080','123','205']));
  assert.deepEqual(candidateIds(applyWorkPresets(customHifuu,[])),[]);
  assert.deepEqual(defaultSettings().included,[]);
});

test('manual additions survive reload without changing an active test, with portraits enabled', () => {
  const settings = setCharactersSelected({...base(),showImages:false,limit:1},['079','205'],true);
  const sorter = new FavoriteSorter(['001','002','079'],2); sorter.choose('tie');
  const restored = restoreSession(serializeSession(settings,sorter,1792407600000,true));
  assert.deepEqual(restored.settings,{...settings,showImages:true});
  assert.deepEqual(candidateIds(restored.settings),candidateIds(settings));
  assert.deepEqual(restored.sorter.ids,sorter.ids);
  assert.deepEqual(restored.sorter.decisions,sorter.decisions);
  assert.deepEqual(restored.sorter.pair,sorter.pair);
  assert.equal(restored.showImages,true);
  assert.equal(restored.settings.showImages,true);
});

test('older saves without included restore identically with an empty manual-selection list', () => {
  const preset = applyWorkPresets(defaultSettings(),['classic']);
  const {included,...oldSettings} = preset;
  for (const catalogVersion of [1,2,4,CATALOG_VERSION]) {
    const restored = restoreSession(JSON.stringify({version:1,catalogVersion,settings:oldSettings,run:null}));
    assert.deepEqual(restored.settings.included,[]);
    assert.deepEqual(candidateIds(restored.settings),candidateIds(preset));
    if (catalogVersion>=4) assert.deepEqual(selectedWorkPresetIds(restored.settings),['classic']);
  }
  const legacy = {...oldSettings,games:['th175'],presetIds:[]};
  const restored = restoreSession(JSON.stringify({version:1,catalogVersion:3,settings:legacy,run:null}));
  assert.deepEqual(restored.settings.included,[]);
  assert.equal(candidateIds(restored.settings).length,17);
});

test('manual-selection validation rejects unknown, duplicate, conflicting or malformed IDs', () => {
  for (const included of [null,'079',['bogus'],['079','079'],['001']]) {
    const settings = {...base(),excluded:['001'],included};
    assert.equal(validateSettings(settings),false);
    assert.throws(()=>restoreSession(serializeSession(settings,null,null)));
  }
  const settings = setCharactersSelected(base(),['079','001'],true);
  assert.ok(validateSettings(settings));
});

test('UI renders all matching characters and checked states from actual candidates', async () => {
  const app = await readFile(new URL('../src/favorite/app.js',import.meta.url),'utf8');
  const html = await readFile(new URL('../src/favorite/index.html',import.meta.url),'utf8');
  assert.match(app,/return matchingCharacters\(\$\('#character-search'\)\.value\)/);
  assert.match(app,/const selected = new Set\(candidateIds\(settings\)\)/);
  assert.match(app,/selected\.has\(character\.id\) \? 'checked'/);
  assert.match(app,/setCharactersSelected\(settings, \[input\.dataset\.character\], input\.checked\)/);
  assert.match(app,/setCharactersSelected\(settings, visibleRoster\(\)\.map/);
  assert.ok(html.includes('<p id="roster-summary" class="roster-note" role="status"></p>'));
  assert.doesNotMatch(html,/或扩大作品范围吧/);
});
