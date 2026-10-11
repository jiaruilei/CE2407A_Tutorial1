const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'tutorial.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// A small DOM/canvas harness exercises the actual page IDs and event handlers.
function page(withMath = false) {
  function element(tag, attributes = {}) {
    const classes = new Set((attributes.class || '').split(/\s+/));
    const listeners = new Map();
    const canvas = {
      clears: 0, fills: [], labels: [],
      clearRect() { this.clears++; this.fills = []; this.labels = []; },
      fillRect(...args) { this.fills.push(args); },
      fillText(...args) { this.labels.push(args); },
      beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
      arc() {}, setLineDash() {}, closePath() {}, fill() {}, setTransform() {}
    };
    return {
      tag, attributes, id: attributes.id, value: attributes.value || '', checked: false,
      width: Number(attributes.width || 520), height: Number(attributes.height || 260),
      style: {}, textContent: '', innerHTML: '', children: [],
      dataset: Object.fromEntries(Object.entries(attributes).filter(([key]) => key.startsWith('data-')).map(([key, value]) => [key.slice(5), value])),
      classList: {
        contains: value => classes.has(value),
        toggle(value, selected) { if (selected) classes.add(value); else classes.delete(value); }
      },
      addEventListener(event, handler) {
        if (!listeners.has(event)) listeners.set(event, []);
        listeners.get(event).push(handler);
      },
      dispatch(event) { (listeners.get(event) || []).forEach(handler => handler({ target: this })); },
      setAttribute(name, value) { this.attributes[name] = value; },
      getContext() { return canvas; },
      appendChild(child) { this.children.push(child); },
      focus() {}
    };
  }
  const elements = [...html.matchAll(/<([a-z][a-z0-9]*)\b([^>]*)>/gi)].map(([, tag, attrs]) => {
    const attributes = Object.fromEntries([...attrs.matchAll(/([^\s=]+)\s*=\s*"([^"]*)"/g)].map(([, key, value]) => [key, value]));
    return element(tag, attributes);
  });
  const document = {
    getElementById: id => elements.find(node => node.id === id) || null,
    createElement: tag => element(tag),
    querySelectorAll(selector) {
      if (selector === '.tab-btn') return elements.filter(node => node.classList.contains('tab-btn'));
      if (selector === 'main section') return elements.filter(node => node.tag === 'section');
      if (selector === '[data-draw]') return elements.filter(node => node.dataset.draw);
      if (selector === 'button[data-send]') return elements.filter(node => node.tag === 'button' && node.dataset.send);
      if (selector === '.chip[data-prompt]') return elements.filter(node => node.classList.contains('chip') && node.dataset.prompt);
      const radio = selector.match(/^input\[name=(.+)\]$/);
      if (radio) return elements.filter(node => node.tag === 'input' && node.attributes.name === radio[1]);
      throw new Error(`Unsupported selector: ${selector}`);
    }
  };
  const mathCalls = [], typesetCalls = [];
  const TutorialMath = {
    setText(element, text) { element.textContent = text; delete element.mathRows; },
    setLines(element, lines) {
      element.mathRows = lines;
      element.textContent = lines.map(line => line.text ?? `${line.label ? `${line.label} ` : ''}${line.fallback}`).join('\n');
      mathCalls.push({ element, lines });
    },
    typeset(element) { typesetCalls.push(element); }
  };
  const context = vm.createContext({ document, ...(withMath ? { TutorialMath } : {}) });
  vm.runInContext(source, context, { filename: 'tutorial.js' });
  const get = id => {
    const node = document.getElementById(id);
    assert.ok(node, `HTML element #${id} exists`);
    return node;
  };
  get('q4which').value = '0';
  return {
    get, mathCalls, typesetCalls, run: expression => vm.runInContext(expression, context),
    click: id => get(id).dispatch('click'),
    input(id, value) { get(id).value = value; get(id).dispatch('input'); },
    choose(name, value) {
      document.querySelectorAll(`input[name=${name}]`).forEach(node => { node.checked = node.value === value; });
    },
    draw: key => elements.find(node => node.dataset.draw === key),
    tabs: document.querySelectorAll('.tab-btn')
  };
}

test('default Q3 and Q7 values match the independent-event calculations', () => {
  const p = page();
  p.click('q3calc');
  for (const value of ['0.0296', '0.87318', '0.02664', '0.10018']) assert.ok(p.get('q3out').textContent.includes(value));
  p.click('q7calc');
  for (const value of ['0.98', '0.26', '0.848']) assert.ok(p.get('q7out').textContent.includes(value));
  assert.equal(p.get('q7chart').getContext().fills.length, 3);
  assert.match(p.get('q7chart').attributes['aria-label'], /A only: 5.6%\. B only: 7.2%\. Both: 72%/);
});

test('equivalent Q3 expressions are accepted, malformed and wrong expressions are rejected', () => {
  const p = page();
  const evaluate = (expression, allowSM = false) => p.run(`setExpressionMask(${JSON.stringify(expression)}, ${allowSM})`);
  for (const expression of ['E2^c ∩ H^c ∩ E1^c', '(E₁ ∪ E₂ ∪ H)^c', "H' & E1' & E2'", 'Hᶜ ∩ E₁ᶜ ∩ E₂ᶜ']) assert.equal(evaluate(expression), 1);
  for (const expression of ['H^c ∩ (E1 Δ E2)', '((E1 ∩ E2^c) ∪ (E1^c ∩ E2)) ∩ H^c']) assert.equal(evaluate(expression), 20);
  for (const expression of ['H ∪ (E1 ∩ E2)', '(S ∪ M)^c', 'S^c ∩ M^c', 'H ∪ (H^c ∩ E1 ∩ E2)']) assert.equal(evaluate(expression, true), 234);
  assert.notEqual(evaluate('H ∩ E1 ∩ E2'), 234);
  for (const expression of ['', 'H ∩', '(H ∪ E1', 'alert(1)', 'S']) assert.throws(() => evaluate(expression));
  p.click('q3aShow');
  assert.match(p.get('q3aout').textContent, /^S: ✓ · M: ✓ · U: ✓/);
  assert.match(p.get('q3aout').textContent, /S = Hᶜ ∩ E₁ᶜ ∩ E₂ᶜ/);
});

test('Q4 reports the A/C tie and compares scenarios against its baseline', () => {
  const p = page();
  p.click('q4calc');
  for (const value of ['0.8 (80%)', '0.4 (40%)', '0.149 (14.9%)', 'A and C tie: 0.072']) assert.ok(p.get('q4out').textContent.includes(value));
  assert.equal(p.get('q4chart').getContext().fills.length, 4);
  p.input('q4tune', '0.2'); p.click('q4apply');
  assert.match(p.get('q4delta').textContent, /0\.113.*-3\.6 percentage points/s);
  assert.match(p.get('q4chart-title').textContent, /Scenario/);
  assert.match(p.get('q4chart').attributes['aria-label'], /Scenario.*A: 3.6%/);
  p.input('q4tune', '0'); p.click('q4apply');
  assert.match(p.get('q4delta').textContent, /0\.077.*-7\.2 percentage points/s);
});

test('Q4 rejects blanks, invalid probabilities, wrong counts and nonunit priors', () => {
  for (const [id, value] of [
    ['q4poll', '0.4,,0.3,0.1'], ['q4poll', '0.4,0.05,0.3'],
    ['q4poll', '0.4,0.05,1.3,0.1'], ['q4kill', '-0.9,0.1,0.8,0.3'],
    ['q4kill', 'Infinity,0.1,0.8,0.3'], ['q4prior', '0.2,0.4,0.3,0.2']
  ]) {
    const p = page(); p.click('q4calc'); p.input(id, value); p.click('q4calc');
    assert.match(p.get('q4out').textContent, /Enter four|must sum/);
    assert.equal(p.run('q4_state'), null);
    assert.equal(p.get('q4steps').textContent, '');
    assert.equal(p.get('q4chart').getContext().fills.length, 0);
  }
});

test('zero pollution gives an undefined posterior without NaN or Infinity', () => {
  const p = page(); p.input('q4poll', '0,0,0,0'); p.click('q4calc');
  assert.match(p.get('q4out').textContent, /undefined: P\(pollution\) = 0/);
  assert.match(p.get('q4out').textContent, /P\(fish kill\) = 0/);
  assert.doesNotMatch(p.get('q4out').textContent, /NaN|Infinity/);
});

test('edits and resets invalidate Q4 baseline; scenarios require valid explicit inputs', () => {
  const p = page(); p.click('q4apply');
  assert.match(p.get('q4delta').textContent, /Calculate.*first/);
  p.click('q4calc'); p.input('q4tune', ''); p.click('q4apply');
  assert.match(p.get('q4delta').textContent, /probability from 0 to 1/);
  p.input('q4poll', '0.4,0.05,0.2,0.1'); p.click('q4apply');
  assert.match(p.get('q4delta').textContent, /Calculate.*first/);
  p.click('q4calc'); p.click('q4reset'); p.click('q4apply');
  assert.match(p.get('q4delta').textContent, /Calculate.*first/);
});

test('Q3/Q7 empty or out-of-range inputs clear previous results and charts', () => {
  for (const [id, calc, out, steps] of [['p1', 'q3calc', 'q3out', 'q3steps'], ['qa', 'q7calc', 'q7out', 'q7steps']]) {
    for (const invalid of ['', '-0.1', '1.1', 'Infinity']) {
      const p = page(); p.click(calc); p.input(id, invalid); p.click(calc);
      assert.match(p.get(out).textContent, /probability from 0 to 1/);
      assert.equal(p.get(steps).textContent, '');
      if (id === 'qa') assert.equal(p.get('q7chart').getContext().fills.length, 0);
    }
  }
});

test('Q2 redraw toggles and clear keep selected status and pressed state consistent', () => {
  const p = page(), canvas = p.get('polar').getContext(), start = canvas.clears;
  p.draw('A').dispatch('click');
  assert.equal(p.draw('A').attributes['aria-pressed'], 'true');
  assert.match(p.get('q2selection').textContent, /A: V > 20/);
  p.draw('A').dispatch('click');
  assert.equal(p.draw('A').attributes['aria-pressed'], 'false');
  p.draw('E').dispatch('click'); p.click('q2clear');
  assert.equal(p.draw('E').attributes['aria-pressed'], 'false');
  assert.equal(p.run('selectedEvents.size'), 0);
  assert.equal(canvas.clears, start + 4);
});

test('tab navigation updates visible question and aria-current', () => {
  const p = page(); p.tabs.find(tab => tab.dataset.tab === 'q7').dispatch('click');
  assert.equal(p.get('q7').style.display, 'block');
  assert.equal(p.get('q2').style.display, 'none');
  assert.equal(p.tabs.filter(tab => tab.attributes['aria-current'] === 'true').length, 1);
});

test('authored TeX renders Q2 selections, Q3 models/table, results and workings with numeric fallbacks', () => {
  const p = page(true);
  p.draw('Ac').dispatch('click');
  assert.equal(p.get('q2selection').mathRows[0].tex, String.raw`A^{c}=\{0\leq V\leq20\}`);
  assert.ok(p.typesetCalls.includes(p.get('q3tbl')));
  assert.match(p.get('q3tbl').innerHTML, /data-tex="E_1\^\{c\}"/);
  p.click('q3aShow');
  assert.equal(p.get('q3aout').mathRows[1].tex, String.raw`S=H^{c}\cap E_1^{c}\cap E_2^{c}`);
  for (const q of ['q3', 'q4', 'q7']) {
    p.click(`${q}calc`);
    assert.ok(p.get(`${q}out`).mathRows.some(row => row.tex));
    assert.ok(p.get(`${q}steps`).mathRows.some(row => row.tex));
    for (const row of p.get(`${q}out`).mathRows.filter(row => row.tex)) {
      assert.ok(row.fallback.length > 0);
      assert.doesNotMatch(row.tex, /[\u0000-\u001f]/);
      assert.doesNotMatch(row.tex, /(^|[^\\])%/);
    }
  }
  assert.match(p.get('q3out').textContent, /0\.10018/);
  assert.match(p.get('q4steps').mathRows.find(row => row.tex.includes('frac')).tex, /\\frac\{P\(A\)P\(F\\mid A\)\}\{P\(F\)\}/);
  assert.match(p.get('q7out').textContent, /0\.848/);
});

test('edits, reset and invalid inputs clear old MathJax output through the shared helper', () => {
  const p = page(true);
  p.click('q3calc'); assert.ok(p.get('q3out').mathRows);
  p.input('p1', ''); p.click('q3calc');
  assert.equal(p.get('q3out').mathRows, undefined);
  assert.match(p.get('q3out').textContent, /every field/);
  p.click('q4calc'); p.click('q4apply'); assert.ok(p.get('q4delta').mathRows);
  p.click('q4reset');
  assert.equal(p.get('q4out').mathRows, undefined);
  assert.equal(p.get('q4delta').mathRows, undefined);
  p.click('q7calc'); p.input('qb', '0.5');
  assert.equal(p.get('q7out').mathRows, undefined);
});
