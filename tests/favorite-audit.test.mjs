import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { portraitCrop } from '../src/favorite/image-layout.js';
import { prepareResultPoster, drawResultPoster } from '../src/favorite/export-poster.js';
import { recordingCanvas } from './helpers/canvas.mjs';

test('export portrait crops preserve proportions for square, tall and wide assets',()=>{
 for(const [width,height] of [[279,290],[154,207],[200,300],[500,500],[900,200],[100,1000]]) {
  const crop=portraitCrop(width,height,60,80);
  assert.ok(Math.abs(crop.width/crop.height-60/80)<1e-12);
  assert.ok(crop.x>=0 && crop.y===0);
  assert.ok(crop.x+crop.width<=width+1e-10 && crop.height<=height+1e-10);
  assert.equal(crop.x,(width-crop.width)/2);
  assert.ok(Math.abs(crop.width-width)<1e-10 || Math.abs(crop.height-height)<1e-10);
 }
 assert.deepEqual(portraitCrop(200,400,60,80),{x:0,y:0,width:200,height:80/(60/200)});
 for(const bad of [0,-1,NaN,Infinity,'200']) assert.throws(()=>portraitCrop(bad,300,60,80));
});

test('actual result export uses proportional crops for list portraits and full featured art',()=>{
 const allRows=Array.from({length:4},(_,index)=>({rank:index+1,character:{name:'博丽灵梦',title:'乐园的巫女'}}));
 const image={naturalWidth:279,naturalHeight:290};
 const layout=prepareResultPoster(allRows);
 const {ctx,images}=recordingCanvas();
 drawResultPoster(ctx,layout,{total:173,allRows,logo:null,images:allRows.map(()=>image),height:1500});
 assert.equal(images.length,4);
 for(const call of images.slice(0,3)) {
  assert.equal(call.length,5);
  assert.ok(Math.abs(call[3]/call[4]-279/290)<1e-12);
 }
 const [,x,y,width,height,...destination]=images[3];
 assert.ok(x>0);assert.equal(y,0);
 assert.ok(Math.abs(width/height-78/86)<1e-12);
 const card=layout.cards[3];
 assert.deepEqual(destination,[card.x+76,card.y+8,78,86]);
});

test('build failures propagate a failing exit status instead of reporting success to CI',async()=>{
 const source=(await readFile(new URL('../build.mjs',import.meta.url),'utf8')).replaceAll('\r\n','\n');
 const entry=source.slice(source.indexOf('minifyAndCopy()\n'));
 assert.ok(entry.startsWith('minifyAndCopy()'));
 const output=[];
 const process={exitCode:undefined};
 const failure=new Error('Broken JavaScript source');
 await vm.runInNewContext(entry,{process,console:{log:message=>output.push(message),error:(message,error)=>output.push([message,error])},minifyAndCopy:()=>Promise.reject(failure)});
 assert.equal(process.exitCode,1);
 assert.equal(output.length,1);
 assert.equal(output[0][1],failure);
 const successProcess={exitCode:undefined};
 await vm.runInNewContext(entry,{process:successProcess,console:{log(){},error(){throw new Error('Unexpected error');}},minifyAndCopy:()=>Promise.resolve()});
 assert.equal(successProcess.exitCode,undefined);
});

test('stylesheet minification errors abort the build instead of publishing broken CSS',async()=>{
 const source=(await readFile(new URL('../build.mjs',import.meta.url),'utf8')).replaceAll('\r\n','\n');
 const block=source.match(/const minified = new CleanCSS\(\)\.minify\(content\);([\s\S]*?)\n        } else/)[0].split('\n        } else')[0];
 for(const errors of [[],['Broken @import path']]) {
  const writes=[];
  const context={content:'css',file:'favorite/style.css',distPath:'dist/favorite/style.css',fs:{writeFile:(...args)=>writes.push(args)},CleanCSS:class { minify(){return {styles:'minified css',errors};} }};
  const run=vm.runInNewContext('(async()=>{'+block+'})()',context);
  if(errors.length) {await assert.rejects(run,/favorite\/style\.css: Broken @import path/);assert.equal(writes.length,0);}
  else {await run;assert.deepEqual(writes,[['dist/favorite/style.css','minified css','utf8']]);}
 }
});
