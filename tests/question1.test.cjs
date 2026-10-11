const test = require('node:test');
const assert = require('node:assert/strict');
const { edges, allRoutes, nextCities, possibleTimes, routeCombinations } = require('../question1.js');

test('network matches all eight directed routes in the supplied solution', () => {
  const actual = allRoutes().map(route => route.join('-')).sort();
  assert.deepEqual(actual, [
    '1-2-9', '1-2-5-7-9', '1-2-5-8-9', '1-3-5-7-9',
    '1-3-5-8-9', '1-4-5-7-9', '1-4-5-8-9', '1-4-6-8-9'
  ].sort());
  assert.equal(edges.length, 13);
  assert.deepEqual(nextCities(1), [2, 3, 4]);
  assert.deepEqual(nextCities(9), []);
});

test('route 1-2-9 enumerates six combinations and four distinct totals', () => {
  assert.deepEqual(possibleTimes([1, 2, 9]), [4, 5, 6, 7]);
  assert.deepEqual(routeCombinations([1, 2, 9]).map(row => row.total), [4, 5, 6, 5, 6, 7]);
});

test('route 1-4-6-8-9 preserves its fixed half-hour leg and repeated totals', () => {
  assert.deepEqual(possibleTimes([1, 4, 6, 8, 9]), [5.5, 6, 6.5, 7, 7.5, 8]);
  const combinations = routeCombinations([1, 4, 6, 8, 9]);
  assert.equal(combinations.length, 8);
  assert.ok(combinations.every(row => row.parts[2] === 0.5));
  assert.deepEqual(combinations.map(row => row.total), [5.5, 6.5, 6.5, 7.5, 6, 7, 7, 8]);
});

test('travel times reject nonexistent links and reversed highways', () => {
  assert.throws(() => possibleTimes([1, 2, 3, 9]), /arrows/);
  assert.throws(() => possibleTimes([9, 2, 1]), /arrows/);
  assert.throws(() => possibleTimes([1]), /at least two/);
});

test('Q1 renders route arrows and travel-time sets, clearing the previous table on route change', () => {
  const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
  const node = () => ({
    value: '', textContent: '', handlers: {}, children: [],
    addEventListener(event, handler) { this.handlers[event] = handler; },
    setAttribute() {}, append(child) { this.children.push(child); }
  });
  const elements = Object.fromEntries([
    'q1network', 'q1-next', 'q1-add', 'q1-undo', 'q1-reset', 'q1-current', 'q1-highlight',
    'q1-show-routes', 'q1-routes', 'q1-time-route', 'q1-calculate', 'q1-time-results', 'q1-combinations'
  ].map(id => [id, node()]));
  elements['q1-time-route'].value = '1,2,9';
  const TutorialMath = {
    setLines(target, rows) { (typeof target === 'string' ? elements[target] : target).mathRows = rows; },
    setText(target, value) { const element = typeof target === 'string' ? elements[target] : target; element.textContent = value; delete element.mathRows; element.children = []; },
    typeset() {}
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'question1.js'), 'utf8'), {
    document: { getElementById: id => elements[id], createElement: node }, TutorialMath
  });
  elements['q1-calculate'].handlers.click();
  assert.equal(elements['q1-time-results'].mathRows[0].tex, String.raw`1\to2\to9`);
  assert.equal(elements['q1-time-results'].mathRows[1].tex, String.raw`T\in\left\{4,\,5,\,6,\,7\right\}\ \mathrm{h}`);
  assert.equal(elements['q1-combinations'].children.length, 1);
  const tableHTML = elements['q1-combinations'].children[0].innerHTML;
  assert.match(tableHTML, /data-tex="1\\to2">1 → 2/);
  assert.match(tableHTML, /data-tex="2\\to9">2 → 9/);
  assert.doesNotMatch(tableHTML, /\\[()[\]]/);
  elements['q1-time-route'].value = '1,4,6,8,9';
  elements['q1-time-route'].handlers.change();
  assert.equal(elements['q1-time-results'].mathRows, undefined);
  assert.equal(elements['q1-combinations'].children.length, 0);
});
