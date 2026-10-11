const test = require('node:test');
const assert = require('node:assert/strict');
const { parseAssistantMessage, safeMath, snapshotQuestion, resolveApiBase, createChatController } = require('../chat.js');
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const response = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

function fixture(options = {}) {
  class Element {
    constructor(tag = 'div', attributes = {}) {
      this.tagName = tag.toUpperCase(); this.attributes = attributes; this.children = []; this.listeners = {};
      this.ownText = ''; this.value = ''; this.className = ''; this.disabled = false; this.checked = false;
      this.classList = { toggle: (name, enabled) => { const classes = new Set(this.className.split(/\s+/).filter(Boolean)); enabled ? classes.add(name) : classes.delete(name); this.className = [...classes].join(' '); } };
    }
    get id() { return this.attributes.id; }
    get name() { return this.attributes.name; }
    get type() { return this.attributes.type || ''; }
    get content() { return this.attributes.content; }
    get textContent() { return this.ownText + this.children.map(node => node.textContent).join(''); }
    set textContent(text) { this.ownText = String(text); this.children = []; }
    getAttribute(key) { return this.attributes[key] ?? null; }
    setAttribute(key, value) { this.attributes[key] = String(value); }
    appendChild(child) { this.children.push(child); return child; }
    focus() { this.focused = true; }
    addEventListener(name, handler) { (this.listeners[name] ??= []).push(handler); }
    fire(name, extra = {}) { const event = { preventDefault() { this.prevented = true; }, ...extra }; (this.listeners[name] || []).forEach(fn => fn(event)); return event; }
    matches(selector) {
      return selector.split(',').some(piece => {
        piece = piece.trim();
        if (piece.startsWith('.')) return this.className.split(/\s+/).includes(piece.slice(1));
        const tag = piece.match(/^[a-z]+/i)?.[0];
        if (tag && tag.toUpperCase() !== this.tagName) return false;
        const attrs = [...piece.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)];
        return Boolean(tag || attrs.length) && attrs.every(([, key, value]) => this.getAttribute(key) !== null && (value === undefined || this.getAttribute(key) === value));
      });
    }
    querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  }
  const body = new Element('body'), elements = {};
  const add = (id, tag = 'div', attrs = {}, parent = body) => { const node = new Element(tag, { id, ...attrs }); elements[id] = node; parent.appendChild(node); return node; };
  for (let i = 1; i <= 7; i++) {
    const tab = add(`tab${i}`, 'button', { 'data-tab': `q${i}`, 'aria-current': String(i === 1) });
    tab.textContent = `Q${i} · Topic ${i}`;
    tab.addEventListener('click', () => { for (let j = 1; j <= 7; j++) elements[`tab${j}`].setAttribute('aria-current', String(i === j)); });
    add(`q${i}`, 'section');
  }
  const chips = add('chips'); chips.className = 'coach-chips';
  add('chip', 'button', { 'data-question': 'Explain the formula.' }, chips);
  for (const id of ['coachLog', 'coachStatus', 'coachContext', 'coachSend', 'coachClear']) add(id);
  add('coachForm', 'form'); add('coachQuestion', 'textarea');
  if (options.meta) add('apiMeta', 'meta', { name: 'tutorial-api-base', content: options.meta });
  const doc = {
    getElementById: id => elements[id] || null,
    createElement: tag => new Element(tag),
    querySelector: selector => body.querySelector(selector),
    querySelectorAll: selector => selector === '.coach-chips [data-question]' ? chips.querySelectorAll('[data-question]') : body.querySelectorAll(selector)
  };
  const calls = [], timers = new Map(), clears = [], typesets = [];
  const fetch = (url, settings) => {
    const pending = deferred(); calls.push({ url, settings, ...pending });
    return pending.promise;
  };
  let timerId = 0;
  const controller = createChatController(doc, {
    fetch, location: options.location || { protocol: 'https:', hostname: 'ce2407a.onrender.com' },
    setTimeout(callback, duration) { const id = ++timerId; timers.set(id, { callback, duration }); return id; },
    clearTimeout(id) { timers.delete(id); },
    math: { setText(node, text) { clears.push(node); node.textContent = text; }, typeset(node) { typesets.push(node); return Promise.resolve(); } }
  });
  const health = async configured => { calls[0].resolve(response({ configured })); await controller.ready; };
  return { controller, elements, add, doc, calls, timers, clears, typesets, health };
}

test('assistant equations are isolated while markup and unsafe TeX stay plain text', () => {
  const parts = parseAssistantMessage(String.raw`Use <img src=x onerror=alert(1)> and \(P(A\mid B)=\frac{43}{50}\). Then \[\sum_i p_i=1\].`);
  assert.equal(parts.filter(p => p.tex).length, 2);
  assert.equal(parts.find(p => p.tex).fallback, 'P(A| B)=(43)/(50)');
  assert.equal(parts.filter(p => p.tex)[1].display, true);
  for (const command of ['href{https://example.com}{link}', 'require{html}', 'htmlClass{x}{y}', 'def\\x{\\x}\\x', 'newcommand{\\a}{b}', 'csname input\\endcsname', 'includegraphics{x}']) {
    assert.equal(safeMath(`\\${command}`), false);
    const value = `Unsafe \\(\\${command}\\)`;
    assert.deepEqual(parseAssistantMessage(value), [{ text: value }]);
  }
  assert.equal(safeMath(String.raw`\begin{aligned}P(A)&=0.4\\P(B)&=0.6\end{aligned}`), true);
  assert.equal(safeMath(String.raw`\begin{html}abc\end{html}`), false);
  assert.equal(safeMath(String.raw`P(A\triangle B)=30\%`), true);
  assert.equal(safeMath('x% hide following source'), false);
  assert.deepEqual(parseAssistantMessage('Unclosed \\(x+1'), [{ text: 'Unclosed \\(x+1' }]);
});

test('only local files and GitHub Pages use the configured API destination', () => {
  assert.equal(resolveApiBase({ protocol: 'https:', hostname: 'ce.onrender.com' }, 'https://other.example'), '');
  assert.equal(resolveApiBase({ protocol: 'http:', hostname: 'localhost' }, 'https://other.example'), '');
  assert.equal(resolveApiBase({ protocol: 'file:' }, 'https://ce.onrender.com/'), 'https://ce.onrender.com');
  assert.equal(resolveApiBase({ protocol: 'https:', hostname: 'jiaruilei.github.io' }, 'https://ce.onrender.com'), 'https://ce.onrender.com');
  for (const value of ['javascript:alert(1)', 'https://user:pass@example.com', 'https://example.com/?key=secret', 'invalid']) {
    assert.equal(resolveApiBase({ protocol: 'file:' }, value), '');
  }
});

test('snapshots capture the current input, selected event/part and semantic route without duplicate rendered math', () => {
  const p = fixture();
  const rate = p.add('q6rateL', 'input', {}, p.elements.q6); rate.value = '2.5';
  const radio = p.add('quiz', 'input', { name: 'q6quiz', type: 'radio' }, p.elements.q6); radio.value = 'wrong';
  assert.deepEqual(snapshotQuestion(p.doc, 'q6'), { fields: { q6rateL: '2.5' } });
  radio.checked = true;
  assert.equal(snapshotQuestion(p.doc, 'q6').fields.q6quiz, 'wrong');
  const route = p.add('q1-current', 'div', {}, p.elements.q1);
  p.add('fallback', 'span', {}, route).className = 'math-fallback'; p.elements.fallback.textContent = '1 → 2 → 9 · Complete route';
  p.add('svgText', 'span', {}, route).textContent = 'duplicate visual symbols';
  assert.equal(snapshotQuestion(p.doc, 'q1').route, '1 → 2 → 9 · Complete route');
  p.add('event', 'button', { 'data-draw': 'D', 'aria-pressed': 'true' }, p.elements.q2);
  p.add('part', 'button', { 'data-q5-part': 'c', 'aria-pressed': 'true' }, p.elements.q5);
  p.add('event2', 'button', { 'data-draw': 'C', 'aria-pressed': 'true' }, p.elements.q2);
  assert.deepEqual(snapshotQuestion(p.doc, 'q2').selectedEvents, ['D', 'C']);
  assert.equal(snapshotQuestion(p.doc, 'q5').selectedPart, 'c');
});

test('question switching preserves drafts and replies arrive in their original conversation', async () => {
  const p = fixture(); await p.health(true);
  p.elements.coachQuestion.value = 'My first question';
  const request = p.controller.send();
  assert.equal(await p.controller.send('duplicate'), false);
  assert.equal(p.calls.length, 2);
  assert.equal(JSON.parse(p.calls[1].settings.body).question, 'q1');
  p.elements.coachQuestion.value = 'Next Q1 draft';
  p.elements.tab2.fire('click');
  assert.equal(p.elements.coachQuestion.value, '');
  p.elements.coachQuestion.value = 'Q2 draft';
  p.calls[1].resolve(response({ answer: 'Answer for Q1.' })); await request;
  assert.doesNotMatch(p.elements.coachLog.textContent, /Answer for Q1/);
  p.elements.tab1.fire('click');
  assert.match(p.elements.coachLog.textContent, /Answer for Q1/);
  assert.equal(p.elements.coachQuestion.value, 'Next Q1 draft');
  p.elements.tab2.fire('click'); assert.equal(p.elements.coachQuestion.value, 'Q2 draft');
});

test('clear aborts the request and ignores its late completion', async () => {
  const p = fixture(); await p.health(true);
  const request = p.controller.send('Explain Q1');
  p.controller.clear();
  assert.equal(p.calls[1].settings.signal.aborted, true);
  const next = p.controller.send('Start again');
  assert.deepEqual(JSON.parse(p.calls[2].settings.body).history, []);
  p.calls[1].resolve(response({ answer: 'Late answer' }));
  assert.equal(await request, false);
  assert.doesNotMatch(p.elements.coachLog.textContent, /Late answer|Explain Q1/);
  assert.equal(p.elements.coachSend.disabled, true, 'old completion cannot end the new request');
  p.calls[2].resolve(response({ answer: 'Fresh reply' })); await next;
  assert.ok(p.clears.length >= 4, 'MathJax cleanup runs before every log replacement');
});

test('rate errors restore the sent input for retry and exclude failed turns from API history', async () => {
  const p = fixture(); await p.health(true);
  p.elements.coachQuestion.value = 'Please help';
  const first = p.controller.send(); p.calls[1].resolve(response({ error: 'limit' }, 429));
  assert.equal(await first, false);
  assert.equal(p.elements.coachQuestion.value, 'Please help');
  assert.equal(p.elements.coachStatus.textContent, 'Rate limit · retry');
  assert.match(p.elements.coachLog.textContent, /Too many requests/);
  assert.equal(p.elements.coachSend.disabled, false);
  const retry = p.controller.send();
  assert.deepEqual(JSON.parse(p.calls[2].settings.body).history, []);
  p.calls[2].resolve(response({ answer: 'Try a conditional probability.' })); await retry;
  assert.equal(p.elements.coachStatus.textContent, 'AI online');
});

test('a failure in another question restores its draft without overwriting the active input', async () => {
  const p = fixture(); await p.health(true);
  p.elements.coachQuestion.value = 'Saved request'; const request = p.controller.send();
  p.elements.tab3.fire('click'); p.elements.coachQuestion.value = 'Unrelated draft';
  p.calls[1].reject(new TypeError('Network error')); await request;
  assert.equal(p.elements.coachQuestion.value, 'Unrelated draft');
  p.elements.tab1.fire('click'); assert.equal(p.elements.coachQuestion.value, 'Saved request');
});

test('health and request timeouts use cold-start limits and truthful unavailable states', async () => {
  const p = fixture();
  assert.equal([...p.timers.values()][0].duration, 90000);
  await p.health(false); assert.equal(p.elements.coachStatus.textContent, 'AI not configured');
  const request = p.controller.send('Hello');
  const timeout = [...p.timers.values()][0]; assert.equal(timeout.duration, 65000);
  timeout.callback(); assert.equal(p.calls[1].settings.signal.aborted, true);
  p.calls[1].reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); await request;
  assert.equal(p.elements.coachStatus.textContent, 'AI unavailable');
  assert.match(p.elements.coachLog.textContent, /timed out/);
  assert.equal(p.elements.coachSend.disabled, false);
});

test('assistant HTML is never inserted, user TeX stays plain and valid reply math is scoped', async () => {
  const p = fixture(); await p.health(true);
  const request = p.controller.send(String.raw`User \(x\) <img>`);
  p.calls[1].resolve(response({ answer: String.raw`Answer <img> \(\frac{1}{2}\) and \(\href{https://example.com}{x}\).` })); await request;
  const [user, assistant] = p.elements.coachLog.children;
  assert.equal(user.children.length, 0);
  assert.equal(assistant.querySelectorAll('[data-tex]').length, 1);
  assert.equal(assistant.querySelector('[data-tex]').getAttribute('data-tex'), String.raw`\frac{1}{2}`);
  assert.match(assistant.textContent, /<img>/);
  assert.equal(assistant.querySelectorAll('img').length, 0);
});

test('history stays at eight bounded messages and chips preserve an unsent draft', async () => {
  const p = fixture(); await p.health(true);
  for (let i = 0; i < 6; i++) {
    const request = p.controller.send(`Question ${i}`);
    const call = p.calls.at(-1), payload = JSON.parse(call.settings.body);
    assert.ok(payload.history.length <= 8);
    assert.ok(payload.history.every(item => item.content.length <= 1000));
    call.resolve(response({ answer: 'a'.repeat(1200) })); await request;
  }
  p.elements.coachQuestion.value = 'An unfinished thought';
  const chip = p.controller.send('Explain the formula.');
  assert.equal(p.elements.coachQuestion.value, 'An unfinished thought');
  assert.equal(JSON.parse(p.calls.at(-1).settings.body).history.length, 8);
  p.calls.at(-1).resolve(response({ answer: 'A formula.' })); await chip;
  assert.equal(p.elements.coachQuestion.value, 'An unfinished thought');
  const count = p.calls.length;
  assert.equal(await p.controller.send('x'.repeat(801)), false);
  assert.equal(p.calls.length, count);
});

test('Enter submits, Shift+Enter and IME composition retain multiline editing', async () => {
  const p = fixture(); await p.health(true);
  p.elements.coachQuestion.value = 'Question';
  assert.equal(p.elements.coachQuestion.fire('keydown', { key: 'Enter', shiftKey: true }).prevented, undefined);
  assert.equal(p.elements.coachQuestion.fire('keydown', { key: 'Enter', isComposing: true }).prevented, undefined);
  assert.equal(p.calls.length, 1);
  assert.equal(p.elements.coachQuestion.fire('keydown', { key: 'Enter' }).prevented, true);
  assert.equal(p.calls.length, 2);
  p.calls[1].resolve(response({ answer: 'Reply' }));
});

test('a delayed startup health result cannot overwrite a successful live reply', async () => {
  const p = fixture();
  const request = p.controller.send('Hello');
  p.calls[1].resolve(response({ answer: 'Ready.' })); await request;
  assert.equal(p.elements.coachStatus.textContent, 'AI online');
  await p.health(false);
  assert.equal(p.elements.coachStatus.textContent, 'AI online');
});
