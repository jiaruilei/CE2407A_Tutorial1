const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'math-rendering.js'), 'utf8');
const defer = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));

// Deliberately delayed renderer: the old output may arrive after a reset.
function page() {
  const listeners = new Map();
  class Element {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.attributes = {}; this.childNodes = []; this.parentNode = null; this.className = ''; this.hidden = false; this.ownText = ''; }
    get firstChild() { return this.childNodes[0] || null; }
    get isConnected() { return this === document.body || Boolean(this.parentNode?.isConnected); }
    get textContent() { return this.ownText + this.childNodes.map(child => child.textContent).join(''); }
    set textContent(value) { this.replaceChildren(); this.ownText = String(value); }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return Object.hasOwn(this.attributes, name) ? this.attributes[name] : null; }
    removeAttribute(name) { delete this.attributes[name]; }
    appendChild(child) { child.remove(); child.parentNode = this; this.childNodes.push(child); return child; }
    remove() { if (this.parentNode) this.parentNode.childNodes = this.parentNode.childNodes.filter(child => child !== this); this.parentNode = null; }
    replaceChildren(...children) { this.childNodes.forEach(child => { child.parentNode = null; }); this.childNodes = []; this.ownText = ''; children.forEach(child => this.appendChild(child)); }
    matches(selector) {
      if (selector.includes(',')) return selector.split(',').some(part => this.matches(part.trim()));
      const attr = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
      if (attr) return this.getAttribute(attr[1]) !== null && (attr[2] === undefined || this.getAttribute(attr[1]) === attr[2]);
      return this.tagName.toLowerCase() === selector.toLowerCase();
    }
    querySelectorAll(selector) { return this.childNodes.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector); }
  }
  const document = {
    readyState: 'complete',
    createElement: tag => new Element(tag),
    getElementById: id => document.body.querySelectorAll('[id]').find(element => element.getAttribute('id') === id) || null,
    querySelectorAll: selector => document.body.querySelectorAll(selector),
    addEventListener(name, callback) { const callbacks = listeners.get(name) || []; callbacks.push(callback); listeners.set(name, callbacks); }
  };
  document.body = new Element('body');
  const context = vm.createContext({ document });
  vm.runInContext(source, context);
  const calls = [], clears = [];
  const add = (tag, id, parent = document.body) => {
    const element = document.createElement(tag);
    if (id) element.setAttribute('id', id);
    parent.appendChild(element);
    return element;
  };
  const start = (startup = Promise.resolve()) => {
    context.MathJax.typesetClear = elements => clears.push({ element: elements[0], before: elements[0].textContent });
    context.MathJax.typesetPromise = elements => {
      const pending = defer(), element = elements[0];
      calls.push({ element, source: element.textContent, resolve() {
        const output = document.createElement('mjx-container'); output.textContent = `Rendered ${element.textContent}`;
        element.replaceChildren(output); pending.resolve();
      }, reject: pending.reject });
      return pending.promise;
    };
    context.MathJax.startup.defaultReady = () => { context.MathJax.startup.promise = startup; };
    context.MathJax.startup.ready();
  };
  return { api: context.TutorialMath, context, document, add, start, calls, clears,
    event: (name, target) => (listeners.get(name) || []).forEach(callback => callback({ target })) };
}

test('delayed startup retains fallbacks and coalesces pre-start updates to the latest math', async () => {
  const p = page(), target = p.add('div', 'answer'), startup = defer();
  const first = p.api.setLines('answer', [{ label: '(a)', tex: 'x=1', fallback: 'x = 1' }]);
  const latest = p.api.setLines('answer', [{ label: '(a)', tex: 'x=2', fallback: 'x = 2' }, { text: '<img src=x>' }]);
  assert.equal(target.textContent, '(a) x = 2<img src=x>');
  assert.equal(target.querySelector('img'), null);
  p.start(startup.promise);
  await tick();
  assert.equal(p.calls.length, 0);
  startup.resolve(); await p.api.whenReady(); await tick();
  assert.equal(p.calls.length, 1);
  assert.equal(p.calls[0].source, '\\(\\displaystyle x=2\\)');
  assert.equal(p.calls[0].element.hidden, true);
  p.calls[0].resolve(); await latest; await first;
  assert.equal(target.querySelector('[data-tex]').getAttribute('data-math-state'), 'rendered');
  assert.equal(p.calls[0].element.hidden, false);
});

test('a late old render cannot replace newer Calculate results and all rendering is serial', async () => {
  const p = page(), target = p.add('div', 'answer'); p.start(); await p.api.whenReady();
  p.api.setLines(target, [{ tex: 'old', fallback: 'Old value' }]); await tick();
  const old = p.calls[0];
  const latest = p.api.setLines(target, [{ tex: 'new', fallback: 'New value' }]);
  assert.equal(target.textContent, 'New value');
  assert.equal(p.calls.length, 1);
  old.resolve(); await tick();
  assert.equal(p.calls.length, 2);
  assert.equal(old.element.parentNode, null);
  assert.ok(p.clears.some(call => call.element === old.element));
  p.calls[1].resolve(); await latest;
  assert.doesNotMatch(target.textContent, /old|Old/);
  assert.match(target.textContent, /New value/);
});

test('result rows use display-style fractions without changing inline static labels', async () => {
  const p = page(), label = p.add('span', 'label');
  label.setAttribute('data-tex', 'P(F\\mid L)'); label.textContent = 'P(F | L)';
  p.start(); await p.api.whenReady(); await tick();
  assert.equal(p.calls[0].source, '\\(P(F\\mid L)\\)');
  p.calls[0].resolve(); await p.api.flush();
  const target = p.add('div', 'result');
  const tex = '\\frac{\\frac{43}{100}}{\\frac{50}{100}} = 0.86';
  const done = p.api.setLines(target, [{ tex, fallback: '(43/100) / (50/100) = 0.86' }]);
  await tick();
  assert.equal(p.calls[1].source, `\\(\\displaystyle ${tex}\\)`);
  assert.equal(target.querySelector('[data-tex]').getAttribute('data-math-displaystyle'), 'true');
  assert.ok(!p.calls[1].source.includes('\\['));
  p.calls[1].resolve(); await done;
});

test('reset during rendering remains plain text after the delayed renderer finishes', async () => {
  const p = page(), target = p.add('div', 'answer'); p.start(); await p.api.whenReady();
  p.api.setLines(target, [{ tex: 'x=3', fallback: 'x = 3' }]); await tick();
  p.api.setText(target, 'Calculate to update.');
  assert.equal(target.textContent, 'Calculate to update.');
  assert.ok(p.clears.some(call => call.element === target && call.before.includes('x = 3')));
  p.calls[0].resolve(); await p.api.flush();
  assert.equal(target.textContent, 'Calculate to update.');
  assert.equal(target.querySelector('mjx-container'), null);
});

test('completed MathItems are cleared before replacing rendered content', async () => {
  const p = page(), target = p.add('div', 'answer'); p.start(); await p.api.whenReady();
  const done = p.api.setLines(target, [{ tex: 'P(A)=1', fallback: 'P(A) = 1' }]);
  await tick(); p.calls[0].resolve(); await done;
  p.api.setText('answer', 'Reset');
  const clearing = p.clears.filter(call => call.element === target).at(-1);
  assert.match(clearing.before, /Rendered/);
  assert.equal(target.textContent, 'Reset');
});

test('typesetting rejection preserves fallback markup and does not poison later jobs', async () => {
  const p = page(), formula = p.add('span', 'static');
  formula.setAttribute('data-tex', 'E_1');
  const sub = p.add('sub', '', formula); sub.textContent = '1';
  p.start(); await p.api.whenReady(); await tick();
  p.calls[0].reject(new Error('render failed')); await p.api.flush();
  assert.equal(formula.querySelector('sub'), sub);
  assert.equal(formula.getAttribute('data-math-state'), 'fallback');
  assert.equal(formula.querySelector('[aria-hidden="true"]'), null);
  const other = p.add('div', 'other');
  const done = p.api.setLines(other, [{ tex: 'P(B)=0', fallback: 'P(B) = 0' }]);
  await tick(); p.calls[1].resolve(); await done;
  assert.equal(other.querySelector('[data-tex]').getAttribute('data-math-state'), 'rendered');
});

test('revealing tabs and details typesets newly inserted authored formulas once', async () => {
  const p = page(); p.start(); await p.api.whenReady();
  const section = p.add('section', 'q1'), button = p.add('button'); button.setAttribute('data-tab', 'q1');
  const formula = p.add('span', '', section); formula.setAttribute('data-tex', 'S'); formula.textContent = 'S';
  p.event('click', button); await tick(); p.calls[0].resolve(); await p.api.flush();
  p.event('click', button); await p.api.flush(); assert.equal(p.calls.length, 1);
  const details = p.add('details'); details.open = true;
  const second = p.add('span', '', details); second.setAttribute('data-tex', 'P(S)'); second.textContent = 'P(S)';
  p.event('toggle', details); await tick(); p.calls[1].resolve(); await p.api.flush();
  assert.equal(second.getAttribute('data-math-state'), 'rendered');
});

test('failed startup or a missing vendor script leaves usable fallback and settles the queue', async () => {
  for (const mode of ['startup', 'script']) {
    const p = page(), target = p.add('div', 'answer');
    const done = p.api.setLines(target, [{ tex: 'x', fallback: 'Fallback x' }]);
    if (mode === 'startup') p.start(Promise.reject(new Error('startup failed')));
    else { const script = p.add('script'); script.src = 'file:///site/assets/mathjax/tex-svg.js'; p.event('error', script); }
    assert.equal(await p.api.whenReady(), false);
    await done; await p.api.flush();
    assert.equal(target.textContent, 'Fallback x');
    assert.equal(p.calls.length, 0);
  }
});

test('configuration uses bundled packages and disables network-loading menu extensions', () => {
  const p = page(), config = p.context.MathJax;
  assert.equal(config.startup.typeset, false);
  assert.equal(config.options.enableMenu, false);
  assert.equal(config.options.menuOptions.settings.assistiveMml, false);
  assert.equal(config.options.menuOptions.settings.explorer, false);
  assert.ok(!config.tex.packages.includes('autoload'));
  assert.ok(!config.tex.packages.includes('require'));
});

test('loading without a browser DOM is harmless', async () => {
  const context = vm.createContext({}); vm.runInContext(source, context);
  context.TutorialMath.setText('none', 'ignored');
  await context.TutorialMath.setLines('none', [{ tex: 'x', fallback: 'x' }]);
  assert.equal(await context.TutorialMath.whenReady(), false);
});
