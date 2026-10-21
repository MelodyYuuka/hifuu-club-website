import { SANS_FONT } from '../src/favorite/typography.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { characters } from '../src/favorite/characters.js';
import { prepareResultPoster, drawResultPoster } from '../src/favorite/export-poster.js';
import { prepareResultFooter } from '../src/favorite/export-footer.js';
import { recordingCanvas } from './helpers/canvas.mjs';

function rows(count, ranks = []) {
  return characters.slice(0,count).map((character,index)=>({character,rank:ranks[index] ?? index+1}));
}

for (const count of [1,2,3,10,20,30,173]) test('poster contains every visible character once with no overlapping cards: '+count,()=>{
  const allRows=rows(count);
  const layout=prepareResultPoster(allRows);
  const visible=Math.min(count,20);
  assert.equal(layout.cards.length,visible);
  assert.deepEqual(layout.cards.map(card=>card.row),allRows.slice(0,20));
  for (const card of layout.cards) {
    assert.ok(card.x>=0 && card.x+card.width<=layout.width);
    assert.ok(card.y>=300 && card.y+card.height<layout.footerTop);
    for (const other of layout.cards) if (other!==card) {
      assert.ok(card.x+card.width<=other.x || other.x+other.width<=card.x || card.y+card.height<=other.y || other.y+other.height<=card.y);
    }
  }
  const {ctx,images,texts}=recordingCanvas();
  const footer=prepareResultFooter(ctx,layout.width,layout.footerTop,'http://localhost:4174/favorite/');
  const portrait={naturalWidth:279,naturalHeight:290};
  drawResultPoster(ctx,layout,{total:173,allRows,logo:null,images:layout.rows.map(()=>portrait),height:footer.height});
  assert.equal(images.length,visible);
  assert.ok(texts.every(text=>text.y>=0 && text.y<footer.height));
  assert.ok(footer.top>Math.max(...layout.cards.map(card=>card.y+card.height)));
});

for (const ranks of [[1,1,3,4],[1,1,1,4],[1,2,2,4],[1,2,3,3],[1,1,1,1,5],Array(30).fill(1),[1,2,3,...Array(27).fill(4)]]) {
  test('tied ranks retain equal card styles and honest labels: '+ranks.slice(0,6).join(','),()=>{
    const allRows=rows(ranks.length,ranks);
    const layout=prepareResultPoster(allRows);
    const firstStyles=new Map();
    for(const card of layout.cards) {
      const style=[card.kind,card.width,card.height];
      if(firstStyles.has(card.row.rank)) assert.deepEqual(style,firstStyles.get(card.row.rank));
      firstStyles.set(card.row.rank,style);
      assert.equal(card.tied,ranks.filter(rank=>rank===card.row.rank).length>1);
    }
    if(ranks[1]===1) assert.ok(layout.cards.every(card=>card.kind!=='winner'));
  });
}

test('missing images still draw every name, and rendering does not mutate the ranking data',()=>{
  const allRows=rows(20), original=structuredClone(allRows);
  const layout=prepareResultPoster(allRows);
  const {ctx,texts}=recordingCanvas();
  drawResultPoster(ctx,layout,{total:173,allRows,logo:null,images:Array(20).fill(null),height:2200});
  // Names can wrap in large cards, but every character remains present in the drawn text.
  const drawn=texts.map(item=>item.text).join('');
  for(const {character} of allRows) assert.ok(drawn.includes(character.name));
  assert.deepEqual(allRows,original);
});


test('header summary badge fits its label with equal horizontal padding for short and full results',()=>{
  for(const [total,count] of [[1,1],[173,1],[173,10],[173,20],[173,30],[173,173]]) {
    const allRows=rows(count);
    const layout=prepareResultPoster(allRows);
    const {ctx,texts,boxes}=recordingCanvas();
    drawResultPoster(ctx,layout,{total,allRows,logo:null,images:Array(layout.rows.length).fill(null),height:layout.footerTop+220});
    const label=texts.find(item=>item.text.startsWith('从 '));
    const badge=boxes.find(box=>box[0]===70 && box[1]===247);
    assert.equal(label.text,'从 '+total+' 位角色中选出  ·  '+count+' 位上榜角色');
    assert.equal(label.font,'17px ' + SANS_FONT);
    assert.equal(label.maxWidth,undefined,'do not compress the label into a fixed-width box');
    ctx.font=label.font;
    const labelWidth=ctx.measureText(label.text).width;
    const leftPadding=label.x-badge[0];
    const rightPadding=badge[0]+badge[2]-label.x-labelWidth;
    assert.equal(leftPadding,16);
    assert.ok(rightPadding>=16 && rightPadding<17);
    assert.equal(badge[2],Math.ceil(labelWidth)+32);
    assert.ok(badge[0]+badge[2]<786,'keep the badge clear of the header decorations');
  }
});


test('ranking cards follow featured cards directly without the decorative heading or its reserved space',()=>{
  for(const [count,ranks] of [[10,[]],[20,[]],[4,[1,1,3,4]],[8,[1,1,1,1,5,6,7,8]],[20,Array(20).fill(1)]]) {
    const allRows=rows(count,ranks);
    const layout=prepareResultPoster(allRows);
    const firstRow=layout.cards.find(card=>card.kind==='row');
    const features=layout.cards.filter(card=>card.kind!=='row');
    assert.ok(firstRow);
    if(features.length) {
      const featureBottom=Math.max(...features.map(card=>card.y+card.height));
      assert.ok(firstRow.y-featureBottom>=22 && firstRow.y-featureBottom<=26,'keep only normal card spacing');
    } else assert.equal(firstRow.y,314);
    assert.equal('listHeading' in layout,false);
    const {ctx,texts}=recordingCanvas();
    drawResultPoster(ctx,layout,{total:173,allRows,logo:null,images:Array(layout.rows.length).fill(null),height:layout.footerTop+220});
    assert.ok(texts.every(item=>!item.text.includes('每一次心动')));
  }
});
