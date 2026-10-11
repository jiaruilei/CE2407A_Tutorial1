// The plot is rendered directly from Tutorial Questions Set 1, page 3.
// Counts are from Tutorial Solutions Set 1 (complete), page 7; no points are synthesized.
(() => {
  const get = id => document.getElementById(id);
  const setText = (id, text) => {
    const element = get(id);
    if (!element) return;
    if (globalThis.TutorialMath?.setText) globalThis.TutorialMath.setText(element, text);
    else element.textContent = text;
  };
  const setMath = (id, rows) => {
    if (globalThis.TutorialMath?.setLines) globalThis.TutorialMath.setLines(id, rows);
    else setText(id, rows.map(row => row.fallback ?? row.text ?? '').join('\n'));
  };
  const buttons = [...document.querySelectorAll('[data-q5-part]')];
  if (!get('q5')) return;

  // Coordinates match the original figure crop's 560 × 404 logical view box.
  const bounds = { left: 66.5, right: 492, top: 48, bottom: 326.5, c70: 328.5, c95: 430.5, l20: 239.5, l30: 153, l40: 71.5 };
  const box = (left, top, right, bottom) => ({ x: left, y: top, width: right - left, height: bottom - top });
  const { left, right, top, bottom, c70, c95, l20, l30, l40 } = bounds;
  const parts = {
    a: {
      expression: 'P(20 < L ≤ 40 | C ≥ 70)', sample: 'C ≥ 70', event: '20 < L ≤ 40 and C ≥ 70',
      expressionTex: String.raw`P(20<L\le40\mid C\ge70)`, sampleTex: String.raw`C\ge70`, eventTex: String.raw`\{20<L\le40\}\cap\{C\ge70\}`,
      numerator: 43, denominator: 50,
      conditionRegion: box(c70, top, right, bottom), eventRegion: box(c70, l40, right, l20),
      hint: 'Condition on compaction first. Count the highlighted outcomes within that sample.'
    },
    b: {
      expression: 'P(L > 40 | C ≤ 95)', sample: 'C ≤ 95', event: 'L > 40 and C ≤ 95',
      expressionTex: String.raw`P(L>40\mid C\le95)`, sampleTex: String.raw`C\le95`, eventTex: String.raw`\{L>40\}\cap\{C\le95\}`,
      numerator: 6, denominator: 95,
      conditionRegion: box(left, top, c95, bottom), eventRegion: box(left, top, c95, l40),
      hint: 'Keep the highlighted compaction range. Count the tests above 40 months.'
    },
    c: {
      expression: 'P(L > 40 | 70 < C ≤ 95)', sample: '70 < C ≤ 95', event: 'L > 40 and 70 < C ≤ 95',
      expressionTex: String.raw`P(L>40\mid70<C\le95)`, sampleTex: String.raw`70<C\le95`, eventTex: String.raw`\{L>40\}\cap\{70<C\le95\}`,
      numerator: 5, denominator: 45,
      conditionRegion: box(c70, top, c95, bottom), eventRegion: box(c70, top, c95, l40),
      hint: 'Restrict the sample to the highlighted strip. Count the tests above 40 months.'
    },
    d: {
      expression: 'P(L > 30 and C < 70)', sample: 'all 100 tests', event: 'L > 30 and C < 70',
      expressionTex: String.raw`P(\{L>30\}\cap\{C<70\})`, sampleTex: String.raw`\text{all 100 tests}`, eventTex: String.raw`\{L>30\}\cap\{C<70\}`,
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
    setMath('q5selection', [
      { tex: String.raw`\text{Sample: }${part.sampleTex}`, fallback: `Sample: ${part.sample}.` },
      { tex: String.raw`\text{Count: }${part.eventTex}`, fallback: `Count: ${part.event}.` }
    ]);
    setText('q5hint', part.hint);
    setText('q5denominator', '—'); setText('q5numerator', '—');
    setText('q5out', 'Calculate from the highlighted region.'); setText('q5steps', '');
  }
  function calculate() {
    const part = parts[selected], probability = part.numerator / part.denominator;
    const value = Number(probability.toFixed(5)), percent = Number((100 * probability).toFixed(3));
    const relation = selected === 'b' || selected === 'c' ? '≈' : '=';
    setText('q5denominator', String(part.denominator));
    setText('q5numerator', String(part.numerator));
    setMath('q5out', [
      { tex: part.expressionTex, fallback: part.expression },
      { tex: String.raw`=\frac{${part.numerator}}{${part.denominator}}${relation === '≈' ? '\\approx' : '='}${value}\quad(${percent}\%)`, fallback: `= ${part.numerator}/${part.denominator} ${relation} ${value} (${percent}%)` }
    ]);
    setMath('q5steps', selected === 'd'
      ? [{ tex: String.raw`${part.expressionTex}=\frac{11}{100}=0.11`, fallback: 'P(L > 30 and C < 70) = 11/100 = 0.11' }]
      : [
          { tex: String.raw`P(A\mid B)=\frac{n(A\cap B)}{n(B)}`, fallback: 'P(A | B) = n(A ∩ B) / n(B)' },
          { tex: String.raw`=\frac{${part.numerator}/100}{${part.denominator}/100}=\frac{${part.numerator}}{${part.denominator}}`, fallback: `= (${part.numerator}/100) / (${part.denominator}/100) = ${part.numerator}/${part.denominator}` }
        ]);
  }
  buttons.forEach(button => button.addEventListener('click', () => selectPart(button.dataset.q5Part)));
  get('q5calc')?.addEventListener('click', calculate);
  selectPart(selected);
})();
