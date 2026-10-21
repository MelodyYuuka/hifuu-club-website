import { SANS_FONT } from '../src/favorite/typography.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import jsQR from 'jsqr';
import { TEST_PAGE_URL, resultPageUrl, wrapCanvasText, prepareResultFooter, drawResultFooter } from '../src/favorite/export-footer.js';

function context(width=1080,height=4000) {
 const pixels=new Uint8ClampedArray(width*height*4).fill(255);
 const texts=[]; const rectangles=[];
 const ctx={font:'',fillStyle:'#ffffff',textAlign:'left',textBaseline:'alphabetic',
  save(){},restore(){},measureText(text){
   const size=Number(this.font.match(/([\d.]+)px/)?.[1] || 17);
   return {width:[...text].reduce((width,character)=>width+size*(/[^\x00-\x7F]/.test(character)?1:.55),0),actualBoundingBoxAscent:size*.8,actualBoundingBoxDescent:size*.2};
  },
  fillText(text,x,y){texts.push({text,x,y,align:this.textAlign,font:this.font,...this.measureText(text)});},
  fillRect(x,y,w,h){
   rectangles.push({x,y,w,h,color:this.fillStyle});
   const rgb=this.fillStyle==='#ffffff'?[255,255,255]:[24,21,28];
   for(let row=y;row<y+h;row++)for(let column=x;column<x+w;column++){
    const i=(row*width+column)*4;
    pixels[i]=rgb[0];pixels[i+1]=rgb[1];pixels[i+2]=rgb[2];pixels[i+3]=255;
   }
  },
 };
 return {ctx,pixels,texts,rectangles,width,height};
}
function cropQr(raster,footer) {
 const result=new Uint8ClampedArray(footer.size*footer.size*4);
 for(let row=0;row<footer.size;row++) {
  const start=((footer.top+row)*raster.width+footer.x)*4;
  result.set(raster.pixels.slice(start,start+footer.size*4),row*footer.size*4);
 }
 return result;
}

test('test URL always uses hifuu.club regardless of preview origin, path or tracking',()=>{
 assert.equal(TEST_PAGE_URL,'https://hifuu.club/favorite/');
 for(const href of [
  'https://hifuu.club/favorite/#result=abc',
  'https://example.com/favorite/#result=abc',
  'https://example.com/club/favorite/index.html?utm_source=share#result=abc',
  'http://127.0.0.1:4174/favorite/?test=1',
  'http://localhost:4173/favorite/',
  'https://user:password@example.com/favorite/',
  'https://example.com/东方/本命测试/',
 ]) assert.equal(resultPageUrl(href),'https://hifuu.club/favorite/');
 assert.throws(()=>resultPageUrl('file:///favorite/index.html'));
 assert.throws(()=>resultPageUrl('javascript:alert(1)'));
});

test('rendered QR codes decode to the exact page URL with a real independent decoder',()=>{
 for(const href of [
  'http://127.0.0.1:4174/favorite/#result=ignored',
  'https://example.com/favorite/',
  'https://example.com/hifuu-club-website/favorite/index.html?tracking=ignored',
  'https://example.com/东方/本命测试/',
  'https://example.com/'+('long-subdirectory/'.repeat(7))+'favorite/',
 ]) {
  const raster=context();
  const footer=prepareResultFooter(raster.ctx,raster.width,504,href);
  drawResultFooter(raster.ctx,footer,{truncated:false,showImages:true});
  const decoded=jsQR(cropQr(raster,footer),footer.size,footer.size,{inversionAttempts:'dontInvert'});
  assert.ok(decoded,href);
  assert.equal(decoded.data,'https://hifuu.club/favorite/');
  assert.equal(footer.urlLines.join(''),decoded.data);
  assert.ok(raster.rectangles.every(rect=>[rect.x,rect.y,rect.w,rect.h].every(Number.isInteger)));
  const urlText=raster.texts.find(text=>text.text===footer.url);
  assert.equal(urlText.align,'left');
  assert.equal(urlText.x,70);
  assert.ok(urlText.x+urlText.width<=footer.x-30);
  assert.equal(urlText.y+urlText.actualBoundingBoxDescent,footer.top+footer.size);
  const light=cropQr(raster,footer);
  const quiet=footer.quietZone*footer.cellSize;
  for(let row=0;row<quiet;row++)for(let x=0;x<footer.size;x++)assert.equal(light[(row*footer.size+x)*4],255);
 }
});

test('QR stays bottom-right and the URL sits at its lower left, with simplified footer copy',()=>{
 for(const count of [1,10,20]) for(const showImages of [true,false]) {
  const raster=context();
  const top=400+count*104;
  const footer=prepareResultFooter(raster.ctx,1080,top,'https://example.com/favorite/');
  drawResultFooter(raster.ctx,footer,{truncated:count===20,showImages});
  assert.equal(footer.x+footer.size,1010);
  assert.ok(footer.top>365+(count-1)*104+94);
  const credits=raster.texts.filter(text=>!footer.urlLines.includes(text.text));
  assert.ok(credits.every(text=>text.x+text.width<footer.x));
  const urlText=raster.texts.filter(text=>footer.urlLines.includes(text.text)).at(-1);
  assert.ok(footer.size<=160);
  assert.equal(credits[0].y-credits[0].actualBoundingBoxAscent,footer.top);
  assert.ok(urlText.y-urlText.actualBoundingBoxAscent-credits.at(-1).y-credits.at(-1).actualBoundingBoxDescent>=12);
  assert.equal(urlText.align,'left');
  assert.equal(urlText.x,70);
  assert.equal(urlText.y+urlText.actualBoundingBoxDescent,footer.top+footer.size);
  assert.ok(urlText.x+urlText.width<=footer.x-30);
  assert.ok(credits.some(text=>text.text==='云梦都 HifuuCraft'));
  assert.ok(credits.some(text=>text.text==='东方 Project © 上海アリス幻樂団'));
  assert.doesNotMatch(credits.map(text=>text.text).join('\n'),/非官方同人测试|图像：|dairi|はるか|ZUN/);
  assert.ok(raster.texts.some(text=>text.text==='https://hifuu.club/favorite/'));
 }
});

test('footer invites viewers to test their favorite while preserving the truncation notice',()=>{
 for(const truncated of [false,true]) {
  const raster=context();
  const footer=prepareResultFooter(raster.ctx,raster.width,504,TEST_PAGE_URL);
  drawResultFooter(raster.ctx,footer,{truncated});
  const copy=raster.texts.filter(text=>text.align==='left').map(text=>text.text).join('');
  const invitation='扫码测测，你的东方本命是谁？';
  const notice='此图展示前 20 位角色，完整榜单请查看分享链接或文字。';
  assert.ok(copy.startsWith(truncated?notice:invitation));
  assert.equal(copy.includes(invitation),!truncated);
  assert.equal(copy.includes(notice),truncated);
  assert.doesNotMatch(copy,/每一份喜欢，都值得被认真记下/);
 }
});

test('enlarged footer lettering stays aligned and separated even when the truncation notice wraps',()=>{
 for(const width of [1080,760]) for(const truncated of [false,true]) {
  const raster=context(width);
  const footer=prepareResultFooter(raster.ctx,width,504,TEST_PAGE_URL);
  drawResultFooter(raster.ctx,footer,{truncated});
  const credits=raster.texts.filter(text=>!footer.urlLines.includes(text.text));
  const urlText=raster.texts.filter(text=>footer.urlLines.includes(text.text)).at(-1);
  assert.equal(footer.size,148);
  assert.equal(credits[0].font,'22px ' + SANS_FONT);
  assert.equal(credits.find(text=>text.text.includes('HifuuCraft')).font,'20px ' + SANS_FONT);
  assert.equal(credits.find(text=>text.text.includes('东方 Project')).font,'18px ' + SANS_FONT);
  assert.ok(credits.every(text=>text.x+text.width<=footer.x-30));
  for(let index=1;index<credits.length;index++) {
   const previousBottom=credits[index-1].y+credits[index-1].actualBoundingBoxDescent;
   const nextTop=credits[index].y-credits[index].actualBoundingBoxAscent;
   assert.ok(nextTop-previousBottom>=12,'wrapped text needs breathing room');
  }
  assert.equal(credits[0].y-credits[0].actualBoundingBoxAscent,footer.top);
  assert.ok(urlText.y-urlText.actualBoundingBoxAscent-credits.at(-1).y-credits.at(-1).actualBoundingBoxDescent>=12);
  assert.equal(urlText.align,'left');
  assert.equal(urlText.x,70);
  assert.equal(urlText.y+urlText.actualBoundingBoxDescent,footer.top+footer.size);
  assert.ok(urlText.x+urlText.width<=footer.x-30);
  assert.ok(footer.height>footer.bottom+30);
  if(width===760 && truncated) assert.ok(credits.length>3,'exercise the wrapped truncation notice');
 }
});

test('long preview paths never leak into the exported URL or change its footer height',()=>{
 const {ctx}=context();
 const preview='https://example.com/'+('very-long-section/'.repeat(14))+'favorite/?tracking=ignored#result=old';
 const footer=prepareResultFooter(ctx,1080,504,preview);
 const canonical=prepareResultFooter(ctx,1080,504,TEST_PAGE_URL);
 assert.deepEqual(footer.urlLines,['https://hifuu.club/favorite/']);
 assert.equal(footer.height,canonical.height);
 assert.equal(footer.height,footer.bottom+40);
 assert.equal(footer.bottom,footer.top+footer.size);
});

test('canvas text wrapping still handles long strings without truncation',()=>{
 const {ctx}=context();
 const text='https://example.com/'+('very-long-section/'.repeat(14))+'favorite/';
 const lines=wrapCanvasText(ctx,text,940);
 assert.ok(lines.length>1);
 assert.equal(lines.join(''),text);
 assert.ok(lines.every(line=>ctx.measureText(line).width<=940));
 assert.deepEqual(wrapCanvasText(ctx,'',940),[]);
});

test('actual download handler always draws the QR footer and uses its calculated height',async()=>{
 const app=await readFile(new URL('../src/favorite/app.js',import.meta.url),'utf8');
 assert.match(app,/const pageHref = location\.href/);
 assert.match(app,/const footer = prepareResultFooter\(ctx, canvas\.width, layout\.footerTop, pageHref\)/);
 assert.match(app,/canvas\.height = footer\.height/);
 assert.match(app,/drawResultFooter\(ctx, footer, \{ truncated:allRows\.length > 20 \}\)/);
 assert.ok(app.indexOf('drawResultFooter(ctx')<app.indexOf('canvas.toBlob'));
});
