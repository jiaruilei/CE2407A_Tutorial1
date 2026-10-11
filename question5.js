// The plot is rendered directly from Tutorial Questions Set 1, page 3.
// Counts are from Tutorial Solutions Set 1 (complete), page 7; no points are synthesized.
(() => {
  const get = id => document.getElementById(id);
  const setText = (id, text) => { const element = get(id); if (element) element.textContent = text; };
  const buttons = [...document.querySelectorAll('[data-q5-part]')];
  if (!get('q5')) return;

  // Coordinates match the original figure crop's 560 × 404 logical view box.
  const bounds = { left: 66.5, right: 492, top: 48, bottom: 326.5, c70: 328.5, c95: 430.5, l20: 239.5, l30: 153, l40: 71.5 };
  const box = (left, top, right, bottom) => ({ x: left, y: top, width: right - left, height: bottom - top });
  const { left, right, top, bottom, c70, c95, l20, l30, l40 } = bounds;
  const parts = {
    a: {
      expression: 'P(20 < L ≤ 40 | C ≥ 70)', sample: 'C ≥ 70', event: '20 < L ≤ 40 and C ≥ 70',
      numerator: 43, denominator: 50,
      conditionRegion: box(c70, top, right, bottom), eventRegion: box(c70, l40, right, l20),
      hint: 'Condition on C first. Count the outcomes with 20 < L ≤ 40 within that sample.'
    },
    b: {
      expression: 'P(L > 40 | C ≤ 95)', sample: 'C ≤ 95', event: 'L > 40 and C ≤ 95',
      numerator: 6, denominator: 95,
      conditionRegion: box(left, top, c95, bottom), eventRegion: box(left, top, c95, l40),
      hint: 'Keep C ≤ 95. Of those tests, count the points above L = 40.'
    },
    c: {
      expression: 'P(L > 40 | 70 < C ≤ 95)', sample: '70 < C ≤ 95', event: 'L > 40 and 70 < C ≤ 95',
      numerator: 5, denominator: 45,
      conditionRegion: box(c70, top, c95, bottom), eventRegion: box(c70, top, c95, l40),
      hint: 'Restrict the sample to the strip 70 < C ≤ 95, then count the points above L = 40.'
    },
    d: {
      expression: 'P(L > 30 and C < 70)', sample: 'all 100 tests', event: 'L > 30 and C < 70',
      numerator: 11, denominator: 100,
      conditionRegion: box(left, top, right, bottom), eventRegion: box(left, top, c70, l30),
      hint: 'This is a joint probability. The denominator is all 100 tests.'
    }
  };
  let selected = 'a';

  function setRegion(id, region) {
    const element = get(id);
    if (element) Object.entries(region).forEach(([attribute, value]) => element.setAttribute(attribute, String(value)));
  }
  function selectPart(key) {
    if (!Object.hasOwn(parts, key)) return;
    selected = key;
    const part = parts[key];
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.q5Part === key)));
    setRegion('q5condition-region', part.conditionRegion);
    setRegion('q5event-region', part.eventRegion);
    setText('q5selection', `Sample: ${part.sample}. Count: ${part.event}.`);
    setText('q5hint', part.hint);
    setText('q5denominator', '—'); setText('q5numerator', '—');
    setText('q5out', 'Calculate from the highlighted region.'); setText('q5steps', '');
  }
  function calculate() {
    const part = parts[selected], probability = part.numerator / part.denominator;
    const value = Number(probability.toFixed(5)), percent = Number((100 * probability).toFixed(3));
    const relation = selected === 'b' || selected === 'c' ? '≈' : '=';
    setText('q5denominator', `${part.denominator} (${part.sample})`);
    setText('q5numerator', `${part.numerator} (${part.event})`);
    setText('q5out', `${part.expression}\n= ${part.numerator}/${part.denominator} ${relation} ${value} (${percent}%)`);
    setText('q5steps', selected === 'd'
      ? `P(L > 30 and C < 70) = 11/100 = 0.11`
      : `P(A | B) = n(A ∩ B) / n(B)\n= (${part.numerator}/100) / (${part.denominator}/100) = ${part.numerator}/${part.denominator}`);
  }
  buttons.forEach(button => button.addEventListener('click', () => selectPart(button.dataset.q5Part)));
  get('q5calc')?.addEventListener('click', calculate);
  selectPart(selected);
})();
