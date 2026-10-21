/** Record Canvas calls while retaining enough state to test real rendering functions. */
export function recordingCanvas() {
  const images = [], texts = [], stack = [], boxes = [], gradients = [], fills = [], imageStates = [];
  const ctx = {
    globalAlpha:1, fillStyle:'#000000', font:'10px sans-serif', textAlign:'right', textBaseline:'top',
    save() { stack.push({globalAlpha:this.globalAlpha, fillStyle:this.fillStyle, font:this.font, textAlign:this.textAlign, textBaseline:this.textBaseline}); },
    restore() { Object.assign(this, stack.pop()); },
    drawImage(...args) { images.push(args); imageStates.push({image:args[0], alpha:this.globalAlpha}); },
    fillText(text, x, y, maxWidth) { texts.push({text, x, y, font:this.font, align:this.textAlign, baseline:this.textBaseline, ...(maxWidth === undefined ? {} : {maxWidth})}); },
    measureText(text) { const size = Number(this.font.match(/([\d.]+)px/)?.[1] || 10); return {width:[...text].reduce((width, ch) => width + size * (/[^\x00-\x7F]/.test(ch) ? 1 : .55), 0)}; },
    fillRect(...args) { fills.push({args, style:this.fillStyle}); }, beginPath() {}, roundRect(...args) { boxes.push(args); }, clip() {},
    fill() {}, stroke() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {}, arc() {}, ellipse() {},
    createLinearGradient(...args) { const gradient = {args, stops:[], addColorStop(offset, color) { this.stops.push([offset, color]); }}; gradients.push(gradient); return gradient; },
  };
  return {ctx, images, texts, boxes, gradients, fills, imageStates};
}
