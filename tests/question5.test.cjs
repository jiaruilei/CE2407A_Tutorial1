const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'question5.js'), 'utf8');
function loadQuestion(withMath = false) {
  const node = () => ({
    textContent: '', attributes: {}, handlers: {},
    setAttribute(key, value) { this.attributes[key] = value; },
    addEventListener(event, handler) { this.handlers[event] = handler; }
  });
  const elements = Object.fromEntries([
    'q5', 'q5calc', 'q5condition-region', 'q5event-region', 'q5selection',
    'q5hint', 'q5denominator', 'q5numerator', 'q5out', 'q5steps'
  ].map(id => [id, node()]));
  const buttons = ['a', 'b', 'c', 'd'].map(key => ({ ...node(), dataset: { q5Part: key } }));
  const document = {
    getElementById: id => elements[id],
    querySelectorAll: selector => selector === '[data-q5-part]' ? buttons : []
  };
  const TutorialMath = withMath ? {
    setLines(id, rows) { elements[id].mathRows = rows; elements[id].textContent = rows.map(row => row.fallback ?? row.text ?? '').join('\n'); },
    setText(target, text) { const element = typeof target === 'string' ? elements[target] : target; delete element.mathRows; element.textContent = text; }
  } : undefined;
  vm.runInNewContext(source, { document, TutorialMath });
  return {
    elements, buttons,
    select: key => buttons.find(button => button.dataset.q5Part === key).handlers.click(),
    calculate: () => elements.q5calc.handlers.click()
  };
}

test('Q5 uses the official conditional and joint counts for all four parts', () => {
  const page = loadQuestion();
  const expected = {
    a: [43, 50, '0.86 (86%)'], b: [6, 95, '0.06316 (6.316%)'],
    c: [5, 45, '0.11111 (11.111%)'], d: [11, 100, '0.11 (11%)']
  };
  for (const [key, [numerator, denominator, result]] of Object.entries(expected)) {
    page.select(key); page.calculate();
    assert.equal(page.elements.q5numerator.textContent, String(numerator));
    assert.equal(page.elements.q5denominator.textContent, String(denominator));
    assert.ok(page.elements.q5out.textContent.includes(`${numerator}/${denominator}`));
    assert.ok(page.elements.q5out.textContent.includes(result));
  }
});

test('part selection clears old counts and working, updates highlight and pressed state', () => {
  const page = loadQuestion();
  page.calculate();
  assert.match(page.elements.q5out.textContent, /43\/50/);
  const firstRegion = { ...page.elements['q5event-region'].attributes };
  page.select('b');
  assert.equal(page.elements.q5numerator.textContent, '—');
  assert.equal(page.elements.q5denominator.textContent, '—');
  assert.equal(page.elements.q5steps.textContent, '');
  assert.doesNotMatch(page.elements.q5out.textContent, /43\/50/);
  assert.notDeepEqual(page.elements['q5event-region'].attributes, firstRegion);
  assert.equal(page.buttons.filter(button => button.attributes['aria-pressed'] === 'true').length, 1);
  assert.equal(page.buttons[1].attributes['aria-pressed'], 'true');
});

test('highlighted intersection remains within each part’s conditioning sample', () => {
  const page = loadQuestion();
  for (const key of ['a', 'b', 'c', 'd']) {
    page.select(key);
    const sample = Object.fromEntries(Object.entries(page.elements['q5condition-region'].attributes).map(([key, value]) => [key, Number(value)]));
    const intersection = Object.fromEntries(Object.entries(page.elements['q5event-region'].attributes).map(([key, value]) => [key, Number(value)]));
    assert.ok(intersection.width > 0 && intersection.height > 0);
    assert.ok(intersection.x >= sample.x && intersection.y >= sample.y);
    assert.ok(intersection.x + intersection.width <= sample.x + sample.width);
    assert.ok(intersection.y + intersection.height <= sample.y + sample.height);
  }
});

test('part (d) is joint probability over all tests, without conditioning on C', () => {
  const page = loadQuestion(); page.select('d'); page.calculate();
  assert.match(page.elements.q5selection.textContent, /Sample: all 100 tests/);
  assert.match(page.elements.q5steps.textContent, /11\/100/);
  assert.doesNotMatch(page.elements.q5steps.textContent, /P\(A \| B\)/);
  assert.match(page.elements.q5hint.textContent, /joint probability/);
});

test('the original plot asset is present at the intended crop resolution', () => {
  const image = fs.readFileSync(path.join(__dirname, '..', 'assets', 'q5-original-plot.png'));
  assert.equal(image.subarray(1, 4).toString(), 'PNG');
  assert.equal(image.readUInt32BE(16), 1120);
  assert.equal(image.readUInt32BE(20), 808);
});

test('Q5 submits conditional probabilities and count fractions to MathJax, then clears them on selection', () => {
  const page = loadQuestion(true);
  page.select('b'); page.calculate();
  assert.equal(page.elements.q5out.mathRows[0].tex, String.raw`P(L>40\mid C\le95)`);
  assert.match(page.elements.q5out.mathRows[1].tex, /\\frac\{6\}\{95\}\\approx0\.06316/);
  assert.match(page.elements.q5steps.mathRows[0].tex, /\\frac\{n\(A\\cap B\)\}\{n\(B\)\}/);
  page.select('d');
  assert.equal(page.elements.q5out.mathRows, undefined);
  assert.equal(page.elements.q5steps.mathRows, undefined);
  page.calculate();
  assert.match(page.elements.q5out.mathRows[0].tex, /\\cap/);
  assert.doesNotMatch(page.elements.q5out.mathRows[0].tex, /\\mid/);
});
