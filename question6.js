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
  function clear(message) {
    setText('q6out', message);
    setText('q6steps', '');
    setText('q6weights', 'Calculate to normalise the occurrence rates.');
    clearChart('q6chart');
  }
  on('q6calc', 'click', () => {
    clear('');
    try {
      const rates = rateIds.map(readNumber), risks = riskIds.map(readNumber);
      const result = calculateLiquefaction(rates, risks);
      setText('q6out', [
        `(a) P(low intensity) = ${fix(result.priors[0])} (${pct(result.priors[0])})`,
        `(b) P(liquefaction) = ${fix(result.failure)} (${pct(result.failure)})`,
        `(c) P(survive 3 earthquakes) = ${fix(result.survival)} (${pct(result.survival)})`,
        `(d) P(low | liquefaction) = ${result.lowGivenFailure === null ? 'undefined: P(liquefaction) = 0' : `${fix(result.lowGivenFailure)} (${pct(result.lowGivenFailure)})`}`
      ].join('\n'));
      setText('q6weights', ['L', 'M', 'H'].map((label, i) => `P(${label}) = ${fix(result.priors[i])}`).join(' · '));
      setText('q6steps', [
        'P(i) = rate(i) / [rate(L) + rate(M) + rate(H)]',
        `P(F) = Σ P(i)P(F|i) = ${fix(result.failure)}`,
        `P(survive 3) = [1−P(F)]³ = ${fix(result.survival)}`,
        `P(L|F) = P(L)P(F|L) / P(F)${result.lowGivenFailure === null ? ' (undefined when P(F)=0)' : ` = ${fix(result.lowGivenFailure)}`}`
      ].join('\n'));
      drawBars('q6chart', ['Low', 'Medium', 'High'], result.contributions, 'Liquefaction contribution by intensity');
    } catch (error) {
      setText('q6out', error.message);
    }
  });
  [...rateIds, ...riskIds].forEach(id => on(id, 'input', () => clear('Inputs changed. Calculate to update.')));
  on('q6reset', 'click', () => {
    [1, 0.1, 0.01].forEach((value, i) => { byId(rateIds[i]).value = value; });
    [0.05, 0.2, 0.9].forEach((value, i) => { byId(riskIds[i]).value = value; });
    clear('Calculate to evaluate (a)–(d).');
  });
})();
