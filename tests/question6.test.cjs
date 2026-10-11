const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateLiquefaction } = require('../question6.js');
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} ≠ ${expected}`);

test('Q6 uses unrounded normalised rates for all four tutorial answers', () => {
  const r = calculateLiquefaction([1, .1, .01], [.05, .2, .9]);
  close(r.priors[0], 100 / 111);
  close(r.priors.reduce((a, b) => a + b, 0), 1);
  close(r.failure, 79 / 1110);
  close(r.survival, (1031 / 1110) ** 3);
  close(r.lowGivenFailure, 50 / 79);
});
test('Q6 rates are relative frequencies, independent of the common scale', () => {
  const a = calculateLiquefaction([1, .1, .01], [.05, .2, .9]);
  const b = calculateLiquefaction([100, 10, 1], [.05, .2, .9]);
  close(a.failure, b.failure);
  close(a.survival, b.survival);
  const huge = calculateLiquefaction([1e308, 1e308, 1e308], [.1, .2, .3]);
  close(huge.failure, .2);
});
test('Q6 handles impossible evidence and probability endpoints', () => {
  const zero = calculateLiquefaction([1, 0, 0], [0, .2, .9]);
  assert.equal(zero.failure, 0);
  assert.equal(zero.survival, 1);
  assert.equal(zero.lowGivenFailure, null);
  const certain = calculateLiquefaction([0, 0, 1], [0, .2, 1]);
  assert.equal(certain.failure, 1);
  assert.equal(certain.survival, 0);
  assert.equal(certain.lowGivenFailure, 0);
});
test('Q6 rejects invalid rates and conditional probabilities', () => {
  for (const rates of [[0, 0, 0], [-1, .1, .01], [NaN, .1, .01], [Infinity, 0, 0], [1, .1]]) {
    assert.throws(() => calculateLiquefaction(rates, [.05, .2, .9]));
  }
  for (const risks of [[-.1, .2, .9], [1.1, .2, .9], [NaN, .2, .9], [.05, .2]]) {
    assert.throws(() => calculateLiquefaction([1, .1, .01], risks));
  }
});

test('Q6 sends fractions, sums, powers and conditional probabilities to MathJax and clears invalid results', () => {
  const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
  const elements = {};
  const node = id => elements[id] ??= { value: '', textContent: '', handlers: {} };
  const setText = (id, text) => { node(id).textContent = text; delete node(id).mathRows; };
  const TutorialMath = {
    setLines(id, rows) { node(id).mathRows = rows; }, setText
  };
  ['L', 'M', 'H'].forEach((label, i) => {
    node(`q6rate${label}`).value = [1, .1, .01][i];
    node(`q6risk${label}`).value = [.05, .2, .9][i];
  });
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'question6.js'), 'utf8'), {
    document: {}, TutorialMath, setText, byId: node,
    on: (id, event, handler) => { node(id).handlers[event] = handler; },
    readNumber: id => Number(node(id).value), fix: value => Math.round(value * 100000) / 100000,
    pct: value => `${Math.round(value * 100000) / 1000}%`, clearChart() {}, drawBars() {}
  });
  node('q6calc').handlers.click();
  assert.match(node('q6steps').mathRows[0].tex, /\\frac\{\\lambda_i\}/);
  assert.match(node('q6steps').mathRows[2].tex, /\\sum_/);
  assert.match(node('q6steps').mathRows[3].tex, /\]\^3/);
  assert.match(node('q6out').mathRows[3].tex, /P\(L\\mid F\)\\approx0\.63291/);
  assert.deepEqual(Array.from(node('q6out').mathRows, row => row.label), ['(a)', '(b)', '(c)', '(d)']);
  for (const row of node('q6out').mathRows) {
    assert.doesNotMatch(row.tex, /%/);
    assert.doesNotMatch(row.fallback, /%/);
  }
  node('q6riskL').value = 2;
  node('q6calc').handlers.click();
  assert.equal(node('q6out').mathRows, undefined);
  assert.equal(node('q6steps').mathRows, undefined);
  assert.match(node('q6out').textContent, /from 0 to 1/);
});
