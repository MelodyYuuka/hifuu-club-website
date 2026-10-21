import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { characters,games,workGroups,CATALOG_VERSION } from '../src/favorite/characters.js';
import { defaultSettings,candidateIds,matchingCharacters,matchingWorks,restoreSession,serializeSession,encodeResult,decodeResult,setCharactersSelected } from '../src/favorite/model.js';
import { applyWorkPresets,selectedWorkPresetIds } from '../src/favorite/presets.js';
import { FavoriteSorter } from '../src/favorite/sorter.js';
const save=(settings,catalogVersion=5,run=null)=>JSON.stringify({version:1,catalogVersion,settings,run});

test('Hourai belongs to other as a distinct album with two cover/disc characters',()=>{
 assert.equal(CATALOG_VERSION,7);
 assert.equal(characters.length,173); assert.equal(games.length,36); assert.equal(workGroups.length,3);
 assert.ok(!workGroups.some(group=>group.id==='hourai'));
 assert.equal(games.find(game=>game.id==='hr01').group,'other');
 const members=characters.filter(character=>character.games.includes('hr01'));
 assert.deepEqual(members.map(character=>[character.id,character.name]),[['206','封套子'],['207','碟面子']]);
 for(const character of members) assert.deepEqual(character.games,['hr01']);
 assert.deepEqual(candidateIds({...defaultSettings(),games:['hr01']}),['206','207']);
 assert.equal(candidateIds(defaultSettings()).length,145);
 assert.deepEqual(candidateIds(applyWorkPresets(defaultSettings(),['hifuu'])),['079','080','123']);
 assert.deepEqual(matchingWorks('other','蓬莱人形').map(game=>game.id),['hr01']);
 assert.deepEqual(matchingCharacters('夹克子').map(character=>character.id),['206']);
 assert.deepEqual(matchingCharacters('label子').map(character=>character.id),['207']);
});

test('new characters support individual selection, sorting, replay and result links',()=>{
 const settings=setCharactersSelected({...defaultSettings(),games:[]},['206','207'],true);
 const sorter=new FavoriteSorter(candidateIds(settings),1);sorter.choose('tie');
 assert.deepEqual(sorter.rankings,[{rank:1,ids:['206','207']}]);
 const restored=restoreSession(serializeSession(settings,sorter,1792407600000));
 assert.deepEqual(restored.settings,settings);assert.deepEqual(restored.sorter.rankings,sorter.rankings);
 assert.deepEqual(decodeResult(encodeResult(sorter.rankings,2)).rankings,sorter.rankings);
});

test('v5 presets migrate without changing custom selections or active tournament rosters',()=>{
 const priorAll=games.filter(game=>game.id!=='hr01').map(game=>game.id);
 const old={...defaultSettings(),games:priorAll,presetIds:['all']};
 const migrated=restoreSession(save(old));
 assert.deepEqual(selectedWorkPresetIds(migrated.settings),['all']);
 assert.equal(candidateIds(migrated.settings).length,173);
 for(const custom of [{...old,presetIds:[]},{...old,excluded:['001']},{...old,included:['079']}]) {
  const restored=restoreSession(save(custom));
  assert.deepEqual(restored.settings.games,priorAll);
  assert.deepEqual(candidateIds(restored.settings),candidateIds(custom));
  assert.deepEqual(restored.settings.presetIds,[]);
 }
 for(const presetIds of [['classic'],['hifuu'],['fighting','stg'],['classic','hifuu']]) {
  const settings=applyWorkPresets(defaultSettings(),presetIds);
  assert.deepEqual(restoreSession(save(settings)).settings,settings);
 }
 const sorter=new FavoriteSorter(['001','002','079'],2);sorter.choose('left');
 const value=JSON.parse(serializeSession(old,sorter,1792407600000,false));value.catalogVersion=5;
 const restored=restoreSession(JSON.stringify(value));
 assert.deepEqual(restored.sorter.ids,sorter.ids);assert.deepEqual(restored.sorter.pair,sorter.pair);
 assert.deepEqual(restored.sorter.decisions,sorter.decisions);assert.equal(restored.showImages,true);
 for(const catalogVersion of [1,2,3,4,5]) assert.throws(()=>restoreSession(save({...defaultSettings(),games:['hr01']},catalogVersion)));
});

test('all surfaces omit decorative English subtitles and the requested licensing sentence',async()=>{
 const html=await readFile(new URL('../src/favorite/index.html',import.meta.url),'utf8');
 const app=await readFile(new URL('../src/favorite/app.js',import.meta.url),'utf8');
 for(const text of ['HIFUU CLUB','TOUHOU PROJECT · CHARACTER SORTER','THE FIRST ENCOUNTER','FIND YOUR FAVORITE','YOUR INVITATION','FOLLOW YOUR HEART','A LITTLE RECORD OF YOUR HEART','ABOUT THIS ENCOUNTER','YOUR NO. 1','01 / LEFT','02 / RIGHT','HIFUU CLUB  /  TOUHOU CHARACTER SORTER','二创许可不等于所有立绘可任意使用','素材不随代码许可证授权']) assert.ok(!(html+app).includes(text),text);
 assert.doesNotMatch(html,/<small>OR<\/small>|class="eyebrow/);
 assert.doesNotMatch(html,/id="(?:tab|works)-hourai"/);
 assert.match(html,/ZUN/);
 const credits=await readFile(new URL('../src/favorite/CREDITS.md',import.meta.url),'utf8');
 for(const text of ['206.webp','207.webp','hr01_jk00.jpg','蓬莱人形光盘.jpg','ZUN'])assert.ok(credits.includes(text));
});
