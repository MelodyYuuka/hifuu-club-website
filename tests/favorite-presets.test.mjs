import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { characters, games, workGroups } from '../src/favorite/characters.js';
import { workPresets, applyWorkPresets, selectedWorkPresetIds, toggleWorkPreset, validPresetIds } from '../src/favorite/presets.js';
import { defaultSettings, candidateIds, restoreSession, serializeSession, validateSettings, setWorksSelected } from '../src/favorite/model.js';
import { FavoriteSorter } from '../src/favorite/sorter.js';
const settings = defaultSettings();
const idsFor = presetIds => candidateIds(applyWorkPresets(settings, presetIds));

test('12 independent presets reference individual works with the requested labels', () => {
  assert.equal(workPresets.length,12);
  assert.equal(new Set(workPresets.map(preset=>preset.id)).size,12);
  assert.equal(workPresets.find(preset=>preset.id==='windows').label,'正作');
  assert.equal(workPresets.find(preset=>preset.id==='hifuu').label,'秘封');
  assert.equal(workPresets.find(preset=>preset.id==='fighting').label,'格斗作品');
  assert.equal(workPresets.find(preset=>preset.id==='stg').label,'外传 STG');
  assert.equal(games.length,36);
  assert.equal(characters.length,173);
  for (const preset of workPresets) {
    assert.ok(workGroups.some(group=>group.id===preset.tab));
    assert.ok(preset.games.every(id=>games.some(game=>game.id===id)));
    const applied=applyWorkPresets(settings,[preset.id]);
    assert.ok(validateSettings(applied));
    assert.ok(candidateIds(applied).length>=2);
    assert.deepEqual(selectedWorkPresetIds(applied),[preset.id]);
  }
});

test('checking multiple presets unions their works and unchecking removes only that contribution', () => {
  let selected=toggleWorkPreset(settings,'classic');
  selected=toggleWorkPreset(selected,'mountain');
  assert.deepEqual(selectedWorkPresetIds(selected),['classic','mountain']);
  assert.deepEqual(new Set(selected.games),new Set(['a','b','c','e','f','g']));
  assert.deepEqual(new Set(candidateIds(selected)),new Set([...idsFor(['classic']),...idsFor(['mountain'])]));
  selected=toggleWorkPreset(selected,'classic');
  assert.deepEqual(selectedWorkPresetIds(selected),['mountain']);
  assert.deepEqual(candidateIds(selected),idsFor(['mountain']));
  selected=toggleWorkPreset(selected,'mountain');
  assert.deepEqual(selectedWorkPresetIds(selected),[]);
  assert.equal(candidateIds(selected).length,0);
});

test('overlapping presets retain shared works and characters when either one is removed', () => {
  let selected=applyWorkPresets(settings,['windows','classic','th20']);
  assert.equal(selected.games.length,15);
  assert.equal(new Set(candidateIds(selected)).size,candidateIds(selected).length);
  selected=toggleWorkPreset(selected,'classic');
  assert.deepEqual(candidateIds(selected),idsFor(['windows']));
  selected=toggleWorkPreset(selected,'windows');
  assert.deepEqual(selected.games,['o']);
  assert.equal(candidateIds(selected).length,25);
});

test('Hifuu restrictions apply to its own roster only, never to the other checked presets', () => {
  assert.deepEqual(new Set(idsFor(['hifuu'])),new Set(['079','080','123']));
  let selected=applyWorkPresets(settings,['classic','hifuu']);
  assert.deepEqual(new Set(candidateIds(selected)),new Set([...idsFor(['classic']),'079','080','123']));
  assert.equal(candidateIds(selected).length,37);
  assert.deepEqual(candidateIds(toggleWorkPreset(selected,'hifuu')),idsFor(['classic']));
  assert.deepEqual(candidateIds(toggleWorkPreset(selected,'classic')),idsFor(['hifuu']));
  selected=applyWorkPresets(settings,['hifuu','fighting']);
  assert.deepEqual(new Set(candidateIds(selected)),new Set([...idsFor(['fighting']),'079','080']));
});

test('all can coexist with narrower presets and canceling it restores their union', () => {
  let selected=applyWorkPresets(settings,['classic','hifuu','all']);
  assert.equal(candidateIds(selected).length,173);
  assert.deepEqual(selectedWorkPresetIds(selected),['classic','hifuu','all']);
  selected=toggleWorkPreset(selected,'all');
  assert.equal(candidateIds(selected).length,37);
  assert.deepEqual(selectedWorkPresetIds(selected),['classic','hifuu']);
});

test('preset order does not change the resulting roster for any pair', () => {
  for(const first of workPresets)for(const second of workPresets) {
    if(first.id===second.id)continue;
    assert.deepEqual(new Set(idsFor([first.id,second.id])),new Set(idsFor([second.id,first.id])));
  }
});

test('presets leave ranking and image settings untouched without mutating input arrays', () => {
  const original={...settings,games:['a'],excluded:['001'],limit:1,showImages:false};
  const snapshot=structuredClone(original);
  const applied=applyWorkPresets(original,['classic','old']);
  assert.equal(applied.limit,1); assert.equal(applied.showImages,false);
  applied.games.pop(); applied.presetIds.pop();
  assert.deepEqual(original,snapshot);
  assert.equal(applyWorkPresets(original,['classic','old']).games.length,8);
  for(const invalid of [null,['unknown'],['classic','classic']]) {
    assert.equal(validPresetIds(invalid),false);
    assert.throws(()=>applyWorkPresets(settings,invalid));
  }
  assert.throws(()=>toggleWorkPreset(settings,'unknown'));
});

test('manual edits switch to custom without falsely showing stale preset checkmarks', () => {
  const selected=applyWorkPresets(settings,['classic','mountain']);
  assert.deepEqual(selectedWorkPresetIds({...selected,games:[...selected.games].reverse()}),['classic','mountain']);
  assert.deepEqual(selectedWorkPresetIds({...selected,excluded:['001']}),[]);
  const manual=setWorksSelected(selected,['a'],false);
  assert.deepEqual(manual.presetIds,[]);
  assert.ok(manual.games.includes('e'));
  assert.deepEqual(selectedWorkPresetIds(toggleWorkPreset(manual,'hifuu')),['hifuu']);
  const cleared=applyWorkPresets(selected,[]);
  assert.deepEqual(cleared.games,[]); assert.deepEqual(cleared.excluded,[]);
});

test('multiple checked presets survive reload without altering the ongoing test', () => {
  const sorter=new FavoriteSorter(['001','002','079','080'],3); sorter.choose('tie');
  const selected=applyWorkPresets(settings,['classic','hifuu','old']);
  const saved=restoreSession(serializeSession(selected,sorter,1792407600000,false));
  assert.deepEqual(selectedWorkPresetIds(saved.settings),['classic','hifuu','old']);
  assert.deepEqual(candidateIds(saved.settings),candidateIds(selected));
  assert.deepEqual(saved.sorter.ids,sorter.ids);
  assert.deepEqual(saved.sorter.decisions,sorter.decisions);
  assert.deepEqual(saved.sorter.pair,sorter.pair);
  assert.equal(saved.showImages,true);
  assert.deepEqual(selectedWorkPresetIds(toggleWorkPreset(saved.settings,'hifuu')),['classic','old']);
});

test('logo remains the supplied favicon and presets use real accessible multiselect checkboxes', async () => {
  const html=await readFile(new URL('../src/favorite/index.html',import.meta.url),'utf8');
  const app=await readFile(new URL('../src/favorite/app.js',import.meta.url),'utf8');
  const css=await readFile(new URL('../src/favorite/style.css',import.meta.url),'utf8');
  assert.match(html,/<img class="brand-logo" src="\.\.\/assets\/favicon\.png" alt="" width="43" height="43">/);
  assert.doesNotMatch(html,/class="brand-mark"|一键替换范围|Windows 正作/);
  assert.match(html,/可多选 · 叠加范围/);
  assert.match(html,/id="work-presets"[^>]*role="group"/);
  assert.match(app,/<input type="checkbox" data-preset=/);
  assert.match(css,/\.preset-chip:has\(input:checked\)/);
});
