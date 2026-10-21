import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, writeFile, readFile, stat, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const build = fileURLToPath(new URL('../build.mjs', import.meta.url));
const app = await readFile(new URL('../src/favorite/app.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../src/favorite/index.html', import.meta.url), 'utf8');

test('original setup removes promotional headings while retaining its accessible focus target', () => {
  assert.doesNotMatch(html, /让这场相遇，从哪里开始？|一场只属于你的|幻想乡巡礼/);
  assert.match(html, /<section id="setup-view" aria-labelledby="setup-title">/);
  assert.match(html, /<h2 id="setup-title" class="sr-only" tabindex="-1">测试设置<\/h2>/);
  const invitation = html.match(/<div class="invitation-card">([\s\S]*?)<p id="start-hint"/);
  assert.ok(invitation);
  assert.doesNotMatch(invitation[1], /<h2\b/);
  for (const id of ['reset-settings', 'character-count', 'ranking-summary', 'time-estimate', 'start-button']) {
    assert.ok(html.includes('id="' + id + '"'), 'preserves #' + id);
  }
});

test('removed titles leave no spacer row and the mobile count fills the first row', async () => {
  assert.doesNotMatch(html, /class="(?:section-heading|invitation-top|invitation-rule)"/);
  assert.match(html, /<h2 id="setup-title" class="sr-only" tabindex="-1">测试设置<\/h2>\s*<div class="field-heading works-heading">/);
  const heading = html.match(/<div class="field-heading works-heading">([\s\S]*?)<\/div><\/div>/);
  assert.ok(heading);
  assert.match(heading[1], /<h3>选择作品范围<\/h3>/);
  assert.match(heading[1], /id="works-total"/);
  assert.match(heading[1], /id="reset-settings"/);
  assert.match(html, /<div class="invitation-card">\s*<div class="invited-count">/);
  const css = await readFile(new URL('../src/favorite/style.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /\.(?:section-heading|invitation-top|invitation-rule)\b/);
  assert.match(css, /\.invited-count\s*\{\s*grid-column:\s*1\/-1;\s*grid-row:\s*1;\s*justify-content:\s*flex-start;\s*gap:\s*10px;\s*margin-top:\s*0\s*\}/);
});

test('pausing preserves progress and focuses the visually hidden setup heading', () => {
  const viewStart = app.indexOf('function setView(');
  const viewEnd = app.indexOf('function setTab(', viewStart);
  const pauseStart = app.indexOf("$('#pause-button').addEventListener");
  const pauseEnd = app.indexOf("$('#choose-left')", pauseStart);
  assert.ok(viewStart >= 0 && viewEnd > viewStart && pauseStart >= 0 && pauseEnd > pauseStart);

  const calls = [];
  const session = { decisions: ['tie'], ids: ['079', '080', '158'] };
  let pause;
  const nodes = new Map([
    ['#hero', { hidden: true }],
    ['#setup-view', { hidden: true }],
    ['#battle-view', { hidden: false }],
    ['#result-view', { hidden: true }],
    ['#setup-title', { focus(options) {
      assert.equal(options.preventScroll, true);
      calls.push('focus:setup-title');
    } }],
    ['#pause-button', { addEventListener(event, handler) {
      assert.equal(event, 'click');
      pause = handler;
    } }],
  ]);
  const steps = ['setup', 'battle', 'result'].map(step => ({
    dataset: { step },
    classes: new Set(),
    attributes: new Map(),
    classList: { toggle(name, enabled) {
      const classes = steps.find(item => item.dataset.step === step).classes;
      if (enabled) classes.add(name); else classes.delete(name);
    } },
    setAttribute(name, value) { this.attributes.set(name, value); },
    removeAttribute(name) { this.attributes.delete(name); },
  }));
  const document = { body: { dataset: { view: 'battle' } } };
  const context = vm.createContext({
    view: 'battle', sorter: session, document,
    $: selector => {
      assert.ok(nodes.has(selector), 'expected existing focus and view target ' + selector);
      return nodes.get(selector);
    },
    $$: selector => { assert.equal(selector, '[data-step]'); return steps; },
    window: { scrollTo(options) {
      assert.equal(options.top, 0);
      assert.equal(options.behavior, 'instant');
      calls.push('scroll:top');
    } },
    save: () => calls.push('save'),
    renderSetup: () => calls.push('renderSetup'),
  });
  vm.runInContext(app.slice(viewStart, viewEnd) + app.slice(pauseStart, pauseEnd), context);
  pause();

  assert.deepEqual(calls, ['save', 'renderSetup', 'scroll:top', 'focus:setup-title']);
  assert.equal(context.sorter, session);
  assert.deepEqual(session.decisions, ['tie']);
  assert.equal(context.view, 'setup');
  assert.equal(document.body.dataset.view, 'setup');
  assert.equal(nodes.get('#hero').hidden, false);
  assert.equal(nodes.get('#setup-view').hidden, false);
  assert.equal(nodes.get('#battle-view').hidden, true);
  assert.equal(nodes.get('#result-view').hidden, true);
  assert.equal(steps[0].attributes.get('aria-current'), 'step');
  assert.ok(steps[0].classes.has('is-current'));
  assert.ok(steps.slice(1).every(step => !step.attributes.has('aria-current') && !step.classes.has('is-current')));
});

async function buildFixture(callback) {
  const temporaryRoot = path.resolve(os.tmpdir());
  const root = await mkdtemp(path.join(temporaryRoot, 'hifuu-build-test-'));
  try {
    await mkdir(path.join(root, 'src/favorite/vendor'), { recursive: true });
    return await callback(root);
  } finally {
    // Only remove the private fixture created above; never a workspace or shared temp root.
    assert.equal(path.dirname(path.resolve(root)), temporaryRoot);
    assert.ok(path.basename(root).startsWith('hifuu-build-test-'));
    await rm(root, { recursive: true, force: true });
  }
}

test('build walks literal nested filenames and retains credits while excluding Node-only favorite metadata', async () => {
  await buildFixture(async root => {
    const files = {
      'index.html': '<!doctype html><html><body>  Hello  world </body></html>',
      'favorite/app.js': 'export const value = 1 + 2;',
      'favorite/style.css': 'body { color: red; }',
      'favorite/package.json': '{"type":"module","private":true}',
      'favorite/CREDITS.md': '# Credits\nKeep the artists credited.\n',
      'favorite/vendor/qrcode-generator.LICENSE.txt': 'MIT license record\n',
      'favorite/[reference].webp': 'literal asset bytes',
      '.well-known.json': '{"preserved":true}',
    };
    for (const [file, content] of Object.entries(files)) await writeFile(path.join(root, 'src', file), content);
    await exec(process.execPath, [build], { cwd: root });
    await assert.rejects(stat(path.join(root, 'dist/favorite/package.json')), { code: 'ENOENT' });
    for (const file of ['favorite/CREDITS.md', 'favorite/vendor/qrcode-generator.LICENSE.txt', 'favorite/[reference].webp', '.well-known.json']) {
      assert.equal(await readFile(path.join(root, 'dist', file), 'utf8'), files[file]);
    }
    assert.match(await readFile(path.join(root, 'dist/index.html'), 'utf8'), /Hello world/);
    assert.equal(await readFile(path.join(root, 'dist/favorite/style.css'), 'utf8'), 'body{color:red}');
    assert.match(await readFile(path.join(root, 'dist/favorite/app.js'), 'utf8'), /export const value=3/);
  });
});

test('real build exits unsuccessfully for invalid JavaScript and does not print success', async () => {
  await buildFixture(async root => {
    await writeFile(path.join(root, 'src/favorite/app.js'), 'export const broken = ;');
    await assert.rejects(exec(process.execPath, [build], { cwd: root }), error => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /构建失败/);
      assert.doesNotMatch(error.stdout, /构建完成/);
      return true;
    });
  });
});

test('resuming either an active or completed local test clears a previously viewed share hash', () => {
  const start = app.indexOf("$('#resume-button').addEventListener");
  const end = app.indexOf("$('#pause-button')", start);
  assert.ok(start >= 0 && end > start);
  for (const done of [false, true]) {
    const calls = [];
    let click;
    vm.runInNewContext(app.slice(start, end), {
      $: () => ({ addEventListener(event, handler) { assert.equal(event, 'click'); click = handler; } }),
      sorter: { done },
      clearResultHash: () => calls.push('clearHash'),
      renderResult: () => calls.push('result'),
      renderBattle: () => calls.push('battle'),
      setView: view => calls.push(view),
    });
    click();
    assert.deepEqual(calls, ['clearHash', done ? 'result' : 'battle', done ? 'result' : 'battle']);
  }
});

test('manual copy fallback handles both unavailable and throwing legacy clipboard APIs and removes temporary fields', async () => {
  const start = app.indexOf('async function copyText');
  const end = app.indexOf('function showCopyFallback', start);
  assert.ok(start >= 0 && end > start);
  for (const execCommand of [() => false, () => { throw new Error('NotAllowedError'); }]) {
    const fields = [];
    const messages = [];
    const context = vm.createContext({
      navigator: { clipboard: { async writeText() { throw new Error('Denied'); } } },
      document: {
        body: { append: area => fields.push(area) },
        createElement: () => ({ style: {}, select() {}, remove() { fields.pop(); } }),
        execCommand,
      },
      showCopyFallback: text => messages.push(text),
      toast: () => assert.fail('Do not report successful copy when both APIs failed'),
    });
    vm.runInContext(app.slice(start, end), context);
    await vm.runInContext("copyText('complete ranking', 'copied')", context);
    assert.deepEqual(fields, []);
    assert.deepEqual(messages, ['complete ranking']);
  }
});
