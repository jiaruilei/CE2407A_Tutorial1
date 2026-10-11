// Q6: normalise occurrence rates before applying total probability and Bayes.
(function () {
  'use strict';
  function calculateLiquefaction(rates, risks) {
    if (rates.length !== 3 || rates.some(x => !Number.isFinite(x) || x < 0)) {
      throw new Error('Enter three nonnegative occurrence rates.');
    }
    if (risks.length !== 3 || risks.some(x => !Number.isFinite(x) || x < 0 || x > 1)) {
      throw new Error('Enter three liquefaction probabilities from 0 to 1.');
    }
    // Scaling also avoids overflow when valid, large rates are supplied.
    const scale = Math.max(...rates);
    if (scale === 0) throw new Error('At least one occurrence rate must be positive.');
    const scaled = rates.map(rate => rate / scale);
    const total = scaled.reduce((sum, rate) => sum + rate, 0);
    const priors = scaled.map(rate => rate / total);
    const contributions = priors.map((prior, i) => prior * risks[i]);
    const failure = Math.min(1, contributions.reduce((sum, value) => sum + value, 0));
    return {
      priors, contributions, failure,
      survival: (1 - failure) ** 3,
      lowGivenFailure: failure === 0 ? null : contributions[0] / failure
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { calculateLiquefaction };
  if (typeof document === 'undefined') return;

  const rateIds = ['q6rateL', 'q6rateM', 'q6rateH'];
  const riskIds = ['q6riskL', 'q6riskM', 'q6riskH'];
  const clearText = (id, text) => {
    if (globalThis.TutorialMath?.setText) globalThis.TutorialMath.setText(id, text);
    else setText(id, text);
  };
  const setMath = (id, rows) => {
    if (globalThis.TutorialMath?.setLines) globalThis.TutorialMath.setLines(id, rows);
    else setText(id, rows.map(row => `${row.label ? row.label + ' ' : ''}${row.fallback ?? row.text ?? ''}`).join('\n'));
  };
  function clear(message) {
    clearText('q6out', message);
    clearText('q6steps', '');
    clearText('q6weights', 'Calculate to normalise the occurrence rates.');
    clearChart('q6chart');
  }
  on('q6calc', 'click', () => {
    clear('');
    try {
      const rates = rateIds.map(readNumber), risks = riskIds.map(readNumber);
      const result = calculateLiquefaction(rates, risks);
      setMath('q6out', [
        { label: '(a)', tex: String.raw`P(L)\approx${fix(result.priors[0])}`, fallback: `P(low intensity) ≈ ${fix(result.priors[0])}` },
        { label: '(b)', tex: String.raw`P(F)\approx${fix(result.failure)}`, fallback: `P(liquefaction) ≈ ${fix(result.failure)}` },
        { label: '(c)', tex: String.raw`P(F_1^c\cap F_2^c\cap F_3^c)\approx${fix(result.survival)}`, fallback: `P(survive 3 earthquakes) ≈ ${fix(result.survival)}` },
        result.lowGivenFailure === null
          ? { label: '(d)', tex: String.raw`P(L\mid F)\text{ is undefined: }P(F)=0`, fallback: 'P(low | liquefaction) is undefined: P(liquefaction) = 0' }
          : { label: '(d)', tex: String.raw`P(L\mid F)\approx${fix(result.lowGivenFailure)}`, fallback: `P(low | liquefaction) ≈ ${fix(result.lowGivenFailure)}` }
      ]);
      setMath('q6weights', ['L', 'M', 'H'].map((label, i) => ({ tex: String.raw`P(${label})\approx${fix(result.priors[i])}`, fallback: `P(${label}) = ${fix(result.priors[i])}` })));
      setMath('q6steps', [
        { tex: String.raw`P(i)=\frac{\lambda_i}{\lambda_L+\lambda_M+\lambda_H}`, fallback: 'P(i) = rate(i) / [rate(L) + rate(M) + rate(H)]' },
        { tex: String.raw`\lambda_i=\text{occurrence rate of intensity }i`, fallback: 'λᵢ is the occurrence rate of intensity i.' },
        { tex: String.raw`P(F)=\sum_{i\in\{L,M,H\}}P(i)P(F\mid i)\approx${fix(result.failure)}`, fallback: `P(F) = Σ P(i)P(F|i) = ${fix(result.failure)}` },
        { tex: String.raw`P(F_1^c\cap F_2^c\cap F_3^c)=[1-P(F)]^3\approx${fix(result.survival)}`, fallback: `P(survive 3) = [1−P(F)]³ = ${fix(result.survival)}` },
        result.lowGivenFailure === null
          ? { tex: String.raw`P(L\mid F)\text{ is undefined when }P(F)=0`, fallback: 'P(L|F) is undefined when P(F)=0' }
          : { tex: String.raw`P(L\mid F)=\frac{P(L)P(F\mid L)}{P(F)}\approx${fix(result.lowGivenFailure)}`, fallback: `P(L|F) = P(L)P(F|L) / P(F) = ${fix(result.lowGivenFailure)}` }
      ]);
      drawBars('q6chart', ['Low', 'Medium', 'High'], result.contributions, 'Liquefaction contribution by intensity');
    } catch (error) {
      clearText('q6out', error.message);
    }
  });
  [...rateIds, ...riskIds].forEach(id => on(id, 'input', () => clear('Inputs changed. Calculate to update.')));
  on('q6reset', 'click', () => {
    [1, 0.1, 0.01].forEach((value, i) => { byId(rateIds[i]).value = value; });
    [0.05, 0.2, 0.9].forEach((value, i) => { byId(riskIds[i]).value = value; });
    clear('Calculate to evaluate (a)–(d).');
  });
})();
