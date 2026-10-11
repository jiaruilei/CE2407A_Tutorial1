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
