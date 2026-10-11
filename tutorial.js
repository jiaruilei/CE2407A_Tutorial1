// Navigation
const tabs = document.querySelectorAll('.tab-btn');
tabs.forEach(btn => {
  btn.setAttribute('aria-current', btn.classList.contains('active') ? 'true' : 'false');
  btn.addEventListener('click', () => {
    tabs.forEach(tab => {
      tab.classList.toggle('active', tab === btn);
      tab.setAttribute('aria-current', tab === btn ? 'true' : 'false');
    });
    document.querySelectorAll('main section').forEach(section => {
      section.style.display = section.id === btn.dataset.tab ? 'block' : 'none';
    });
    if (btn.dataset.tab === 'q2') renderQ2();
    const chartId = `${btn.dataset.tab}chart`, chart = chartDrawings.get(chartId);
    if (chart) drawBars(chartId, chart.labels, chart.values, chart.title);
  });
});

const byId = id => document.getElementById(id);
const setText = (id, text) => { const element = byId(id); if (element) element.textContent = text; };
const on = (id, event, handler) => byId(id)?.addEventListener(event, handler);
const chosen = name => [...document.querySelectorAll(`input[name=${name}]`)].find(input => input.checked)?.value;
const fix = value => Math.round(value * 100000) / 100000;
const pct = value => `${Math.round(value * 100000) / 1000}%`;
const isProbability = value => Number.isFinite(value) && value >= 0 && value <= 1;
const readNumber = id => byId(id).value.trim() === '' ? NaN : Number(byId(id).value);
const canvasSizes = new WeakMap();
const chartDrawings = new Map();
function canvasContext(canvas) {
  const context = canvas?.getContext('2d');
  if (context && !canvasSizes.has(canvas)) {
    const size = { width: canvas.width, height: canvas.height, label: canvas.getAttribute?.('aria-label') || 'Probability chart' };
    const scale = Math.max(2, Math.min(3, globalThis.devicePixelRatio || 1));
    canvasSizes.set(canvas, size);
    canvas.width = Math.round(size.width * scale);
    canvas.height = Math.round(size.height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
  }
  return context;
}
function canvasFont(canvas, preferredSize) {
  const width = canvasSizes.get(canvas).width;
  const shownWidth = canvas.getBoundingClientRect?.().width || width;
  return `${Math.max(preferredSize, 12 * width / shownWidth)}px system-ui, sans-serif`;
}
function hidePill(id) {
  const pill = byId(id);
  if (pill) { pill.style.display = 'none'; pill.textContent = ''; }
}
function showPill(id, text) {
  const pill = byId(id);
  if (pill) { pill.style.display = 'inline-flex'; pill.textContent = text; }
}
function clearChart(id) {
  const canvas = byId(id);
  const context = canvasContext(canvas), size = canvas && canvasSizes.get(canvas);
  if (context) {
    context.clearRect(0, 0, size.width, size.height);
    canvas.setAttribute('aria-label', size.label);
  }
  chartDrawings.delete(id);
}
function clearChoices(name) {
  document.querySelectorAll(`input[name=${name}]`).forEach(input => { input.checked = false; });
}

// Q2: selected events are redrawn from scratch, so toggles never leave old shading.
const polar = byId('polar');
const ctx = canvasContext(polar);
const { width: W, height: H } = canvasSizes.get(polar) || { width: 520, height: 420 };
const origin = { x: 70, y: H - 58 };
const R = Math.min(W - 140, H - 120);
const PX_PER_MPH = 4;
const m2px = speed => speed * PX_PER_MPH;
const selectedEvents = new Set();
const eventNames = {
  A: 'A: V > 20', B: 'B: 12 < V ≤ 30', C: 'C: θ ≤ 30°',
  Ac: 'Aᶜ: V ≤ 20', D: 'D: V > 20, θ ≤ 30°',
  E: 'E: V > 12', F: 'F: 20 < V ≤ 30, θ ≤ 30°'
};
function clearBase() {
  if (!ctx) return;
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = '#dce4ee'; ctx.lineWidth = 1;
  ctx.fillStyle = '#5d6b7d'; ctx.font = canvasFont(polar, 15);
  for (let mph = 10; mph <= Math.floor(R / PX_PER_MPH); mph += 10) {
    const radius = m2px(mph);
    ctx.beginPath(); ctx.arc(origin.x, origin.y, radius, -Math.PI / 2, 0);
    ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
    ctx.textAlign = 'center'; ctx.fillText(String(mph), origin.x + radius, origin.y + 18);
  }
  ctx.strokeStyle = '#5d6b7d'; ctx.beginPath();
  ctx.moveTo(origin.x, origin.y - R - 8); ctx.lineTo(origin.x, origin.y);
  ctx.lineTo(origin.x + R + 12, origin.y); ctx.stroke();
  ctx.strokeStyle = '#dce4ee'; ctx.beginPath(); ctx.moveTo(origin.x, origin.y);
  ctx.lineTo(origin.x + R * Math.cos(Math.PI / 6), origin.y - R * 0.5); ctx.stroke();
  ctx.fillStyle = '#5d6b7d'; ctx.textAlign = 'left';
  ctx.fillText('30°', origin.x + R * Math.cos(Math.PI / 6) + 5, origin.y - R * 0.5);
  ctx.fillText('North · V sin θ', 16, origin.y - R - 13);
  ctx.textAlign = 'right'; ctx.fillText('East · V cos θ (mph)', W - 20, H - 12);
  ctx.textAlign = 'left';
}
function sector(color, rMin, rMax, tMinDeg, tMaxDeg) {
  if (!ctx) return;
  const start = -tMaxDeg * Math.PI / 180, end = -tMinDeg * Math.PI / 180;
  ctx.fillStyle = color; ctx.globalAlpha = 0.24; ctx.beginPath();
  ctx.moveTo(origin.x + rMin * Math.cos(start), origin.y + rMin * Math.sin(start));
  ctx.arc(origin.x, origin.y, rMax, start, end, false);
  ctx.lineTo(origin.x + rMin * Math.cos(end), origin.y + rMin * Math.sin(end));
  ctx.arc(origin.x, origin.y, rMin, end, start, true);
  ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
}
const eventDrawers = {
  A: () => sector('#2563eb', m2px(20), R, 0, 90),
  B: () => sector('#0f766e', m2px(12), m2px(30), 0, 90),
  C: () => sector('#d97706', 0, R, 0, 30),
  Ac: () => sector('#dc2626', 0, m2px(20), 0, 90),
  D: () => sector('#7c3aed', m2px(20), R, 0, 30),
  E: () => sector('#0891b2', m2px(12), R, 0, 90),
  F: () => sector('#c026d3', m2px(20), m2px(30), 0, 30)
};
function renderQ2() {
  clearBase();
  selectedEvents.forEach(key => eventDrawers[key]());
  document.querySelectorAll('[data-draw]').forEach(btn => {
    btn.setAttribute('aria-pressed', String(selectedEvents.has(btn.dataset.draw)));
  });
  setText('q2selection', selectedEvents.size
    ? [...selectedEvents].map(key => eventNames[key]).join(' · ')
    : 'No events selected · V is unbounded');
}
document.querySelectorAll('[data-draw]').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.draw;
    if (!eventDrawers[key]) return;
    if (selectedEvents.has(key)) selectedEvents.delete(key); else selectedEvents.add(key);
    renderQ2();
  });
});
on('q2clear', 'click', () => { selectedEvents.clear(); renderQ2(); });
on('q2check', 'click', () => {
  const a = chosen('q2a'), b = chosen('q2b');
  showPill('q2res', !a || !b ? 'Answer both first.' : `D and E: ${a === 'no' ? '✓' : '✗'} · A and C: ${b === 'no' ? '✓' : '✗'}`);
});
['q2a', 'q2b'].forEach(name => document.querySelectorAll(`input[name=${name}]`).forEach(input => {
  input.addEventListener('change', () => hidePill('q2res'));
}));
renderQ2();

// Q3: compare all eight outcomes instead of requiring one exact expression.
// Each bit represents an (E1, E2, H) outcome. Parse set notation without eval.
const eventMasks = { E1: 240, E2: 204, H: 170, S: 1, M: 20 };
function setExpressionMask(expression, allowSM = false) {
  const source = String(expression).toUpperCase()
    .replace(/₁/g, '1').replace(/₂/g, '2').replace(/ᶜ/gi, '^C')
    .replace(/[′’']/g, '^C').replace(/\\CAP/g, '∩').replace(/\\CUP/g, '∪')
    .replace(/\\(?:TRIANGLE|DELTA)/g, 'Δ').replace(/\bXOR\b/g, 'Δ')
    .replace(/\bAND\b/g, '∩').replace(/\bOR\b/g, '∪').replace(/\bNOT\b/g, '!')
    .replace(/&/g, '∩').replace(/\|/g, '∪').replace(/⊕/g, 'Δ').replace(/\s/g, '');
  const tokens = source.match(/E[12]|H|S|M|\^C|[∩∪Δ()!~]/g) || [];
  if (!source || tokens.join('') !== source) throw new Error('Use set notation.');
  let index = 0;
  function atom() {
    let value;
    if (tokens[index] === '!' || tokens[index] === '~') {
      index++; value = 255 ^ atom();
    } else if (tokens[index] === '(') {
      index++; value = union();
      if (tokens[index++] !== ')') throw new Error('Missing parenthesis.');
    } else {
      const token = tokens[index++];
      if (!(token in eventMasks) || (!allowSM && (token === 'S' || token === 'M'))) throw new Error('Use H, E1 and E2.');
      value = eventMasks[token];
    }
    while (tokens[index] === '^C') { index++; value ^= 255; }
    return value;
  }
  function intersection() {
    let value = atom();
    while (tokens[index] === '∩') { index++; value &= atom(); }
    return value;
  }
  function difference() {
    let value = intersection();
    while (tokens[index] === 'Δ') { index++; value ^= intersection(); }
    return value;
  }
  function union() {
    let value = difference();
    while (tokens[index] === '∪') { index++; value |= difference(); }
    return value;
  }
  const result = union();
  if (index !== tokens.length) throw new Error('Check the operators.');
  return result;
}
function definitionChecks() {
  return [['S', 'q3a_s', 1], ['M', 'q3a_m', 20], ['U', 'q3a_u', 234]].map(([name, id, expected]) => {
    try { return `${name}: ${setExpressionMask(byId(id).value, name === 'U') === expected ? '✓' : '✗'}`; }
    catch { return `${name}: check notation`; }
  }).join(' · ');
}
on('q3aCheck', 'click', () => setText('q3aout', definitionChecks()));
on('q3aShow', 'click', () => {
  byId('q3a_s').value = 'H^c ∩ E1^c ∩ E2^c';
  byId('q3a_m').value = 'H^c ∩ (E1 Δ E2)';
  byId('q3a_u').value = 'H ∪ (E1 ∩ E2)';
  setText('q3aout', definitionChecks());
});
['q3a_s', 'q3a_m', 'q3a_u'].forEach(id => on(id, 'input', () => setText('q3aout', 'Check your expressions.')));
const rows = [];
for (const e1 of [0, 1]) for (const e2 of [0, 1]) for (const h of [0, 1]) {
  const cls = !e1 && !e2 && !h ? 'S' : e1 !== e2 && !h ? 'M' : 'U';
  rows.push(`<tr><td>${e1 ? 'E₁' : 'E₁ᶜ'}</td><td>${e2 ? 'E₂' : 'E₂ᶜ'}</td><td>${h ? 'H' : 'Hᶜ'}</td><td>${cls}</td></tr>`);
}
if (byId('q3tbl')) byId('q3tbl').innerHTML = rows.join('');

function q3Calculate() {
  const [p1, p2, ph] = ['p1', 'p2', 'ph'].map(readNumber);
  setText('q3steps', '');
  if (![p1, p2, ph].every(isProbability)) {
    setText('q3out', 'Enter a probability from 0 to 1 in every field.'); return;
  }
  const exactlyOne = p1 * (1 - p2) + (1 - p1) * p2;
  const S = (1 - p1) * (1 - p2) * (1 - ph), M = exactlyOne * (1 - ph), U = ph + p1 * p2 * (1 - ph);
  setText('q3out', `(b) P(exactly one outage) = ${fix(exactlyOne)} (${pct(exactlyOne)})\n(c) P(S) = ${fix(S)} · P(M) = ${fix(M)} · P(U) = ${fix(U)}`);
  setText('q3steps', [
    `Independence gives P(exactly one) = p₁(1−p₂) + (1−p₁)p₂ = ${fix(exactlyOne)}`,
    `P(S) = (1−p₁)(1−p₂)(1−P(H)) = ${fix(S)}`,
    `P(M) = P(exactly one)(1−P(H)) = ${fix(M)}`,
    `P(U) = P(H) + p₁p₂(1−P(H)) = ${fix(U)}`
  ].join('\n'));
}
on('q3calc', 'click', q3Calculate);
['p1', 'p2', 'ph'].forEach(id => on(id, 'input', () => {
  setText('q3out', 'Inputs changed. Calculate to update.'); setText('q3steps', '');
}));
on('q3reset', 'click', () => {
  ['0.01', '0.02', '0.10'].forEach((value, i) => { byId(['p1', 'p2', 'ph'][i]).value = value; });
  setText('q3out', 'Calculate parts (b) and (c).'); setText('q3steps', '');
  ['q3a_s', 'q3a_m', 'q3a_u'].forEach(id => { byId(id).value = ''; });
  setText('q3aout', 'Enter the expressions, then check.');
});

// Probability charts use a common white-background palette and label values.
function drawBars(canvasId, labels, values, title) {
  const canvas = byId(canvasId), g = canvasContext(canvas);
  if (!g) return;
  const { width, height } = canvasSizes.get(canvas), pad = 36;
  const max = Math.max(1e-9, ...values), slot = (width - 2 * pad) / values.length, barWidth = slot * 0.55;
  g.clearRect(0, 0, width, height);
  g.font = canvasFont(canvas, 16);
  setText(`${canvasId}-title`, title);
  canvas.setAttribute('aria-label', `${title}. ${labels.map((label, i) => `${label}: ${pct(values[i])}`).join('; ')}.`);
  chartDrawings.set(canvasId, { labels, values, title });
  g.strokeStyle = '#dce4ee'; g.beginPath(); g.moveTo(pad, height - pad); g.lineTo(width - pad, height - pad); g.stroke();
  values.forEach((value, i) => {
    const x = pad + i * slot + (slot - barWidth) / 2, barHeight = (height - 3 * pad) * value / max;
    g.fillStyle = '#2563eb'; g.fillRect(x, height - pad - barHeight, barWidth, barHeight);
    g.textAlign = 'center'; g.fillStyle = '#142033'; g.fillText(pct(value), x + barWidth / 2, height - pad - barHeight - 8);
    g.fillStyle = '#5d6b7d'; g.fillText(labels[i], x + barWidth / 2, height - 12);
  });
}

// Q4: a scenario is always compared with an explicitly computed baseline.
const processLabels = ['A', 'B', 'C', 'D'];
let q4_state = null;
function toNums(text) {
  return text.split(',').map(value => value.trim() === '' ? NaN : Number(value));
}
function clearQ4Results(message) {
  q4_state = null;
  setText('q4chart-title', 'Fish-kill contribution by process');
  setText('q4out', message); setText('q4steps', ''); clearChart('q4chart');
  hidePill('q4qRes'); hidePill('q4delta');
}
function q4Calculate() {
  clearQ4Results('');
  const [prior, poll, kill] = ['q4prior', 'q4poll', 'q4kill'].map(id => toNums(byId(id).value));
  if ([prior, poll, kill].some(values => values.length !== 4 || !values.every(isProbability))) {
    setText('q4out', 'Enter four comma-separated probabilities from 0 to 1 in each row.'); return;
  }
  if (Math.abs(prior.reduce((sum, value) => sum + value, 0) - 1) > 1e-6) {
    setText('q4out', 'Process probabilities must sum to 1.'); return;
  }
  const pYes = prior.reduce((sum, value, i) => sum + value * poll[i], 0), pNo = 1 - pYes;
  const contrib = prior.map((value, i) => value * poll[i] * kill[i]);
  const pKill = contrib.reduce((sum, value) => sum + value, 0), max = Math.max(...contrib);
  const best = processLabels.filter((_, i) => Math.abs(contrib[i] - max) <= Math.max(1e-15, max * 1e-12));
  q4_state = { prior, poll, kill, contrib, best, pKill };
  const bestText = max === 0 ? 'All contributions are zero.' : `${best.join(' and ')}${best.length > 1 ? ' tie' : ''}: ${fix(max)}${best.length > 1 ? ' each' : ''}.`;
  setText('q4out', [
    `(a) P(no pollution) = ${fix(pNo)} (${pct(pNo)})`,
    `(b) P(A | pollution) = ${pYes === 0 ? 'undefined: P(pollution) = 0' : `${fix(prior[0] * poll[0] / pYes)} (${pct(prior[0] * poll[0] / pYes)})`}`,
    `(c) P(fish kill) = ${fix(pKill)} (${pct(pKill)})`,
    `(d) Largest contribution: ${bestText}`
  ].join('\n'));
  setText('q4steps', [
    'P(no pollution) = Σ P(i)[1−P(pollution|i)]',
    'P(A|pollution) = P(A)P(pollution|A) / P(pollution)',
    'P(fish kill) = Σ P(i)P(pollution|i)P(kill|pollution,i)',
    'Compare contributions for complete clean-up or equal proportional reductions.'
  ].join('\n'));
  drawBars('q4chart', processLabels, contrib, 'Fish-kill contribution by process');
}
on('q4calc', 'click', q4Calculate);
['q4prior', 'q4poll', 'q4kill'].forEach(id => on(id, 'input', () => clearQ4Results('Inputs changed. Calculate to update.')));
on('q4reset', 'click', () => {
  ['0.2,0.4,0.3,0.1', '0.40,0.05,0.30,0.10', '0.9,0.1,0.8,0.3'].forEach((value, i) => { byId(['q4prior', 'q4poll', 'q4kill'][i]).value = value; });
  byId('q4which').value = '0'; byId('q4tune').value = '0.20';
  clearQ4Results('Calculate parts (a)–(d).'); clearChoices('q4quiz');
});
on('q4qCheck', 'click', () => {
  const value = chosen('q4quiz');
  if (!q4_state) { showPill('q4qRes', 'Calculate the current inputs first.'); return; }
  if (!value) { showPill('q4qRes', 'Select an option.'); return; }
  const best = q4_state.best, correct = best.includes(value) || (value === 'AC' && best.join('') === 'AC');
  showPill('q4qRes', `${correct ? 'Correct.' : 'Try again.'} ${best.join(' and ')}${best.length > 1 ? ' tie' : ' contributes most'}.`);
});
on('q4apply', 'click', () => {
  if (!q4_state) { showPill('q4delta', 'Calculate the current inputs first.'); return; }
  const which = readNumber('q4which'), newp = readNumber('q4tune');
  if (!Number.isInteger(which) || which < 0 || which > 3 || !isProbability(newp)) {
    showPill('q4delta', 'Choose a process and enter a probability from 0 to 1.'); return;
  }
  const poll = q4_state.poll.slice(); poll[which] = newp;
  const contrib = q4_state.prior.map((value, i) => value * poll[i] * q4_state.kill[i]);
  const pKill = contrib.reduce((sum, value) => sum + value, 0), delta = fix((pKill - q4_state.pKill) * 100);
  drawBars('q4chart', processLabels, contrib, 'Scenario: fish-kill contribution');
  showPill('q4delta', `P(fish kill) = ${fix(pKill)} (${pct(pKill)}) · Change: ${delta > 0 ? '+' : ''}${delta} percentage points`);
});
['q4which', 'q4tune'].forEach(id => on(id, 'input', () => {
  hidePill('q4delta');
  if (q4_state) drawBars('q4chart', processLabels, q4_state.contrib, 'Fish-kill contribution by process');
}));

// Q7: accuracy is unconditional; no detection contributes zero.
function q7Calculate() {
  const [pa, pb, accA, accB] = ['qa', 'qb', 'qaccA', 'qaccB'].map(readNumber);
  setText('q7steps', ''); clearChart('q7chart');
  if (![pa, pb, accA, accB].every(isProbability)) {
    setText('q7out', 'Enter a probability from 0 to 1 in every field.'); return;
  }
  const pAtLeastOne = 1 - (1 - pa) * (1 - pb), aOnly = pa * (1 - pb), bOnly = pb * (1 - pa), both = pa * pb;
  const pOnlyOne = aOnly + bOnly, pAccurate = aOnly * accA + bOnly * accB + both;
  setText('q7out', [
    `(a) P(at least one detection) = ${fix(pAtLeastOne)} (${pct(pAtLeastOne)})`,
    `(b) P(exactly one detection) = ${fix(pOnlyOne)} (${pct(pOnlyOne)})`,
    `(c) P(accurate location) = ${fix(pAccurate)} (${pct(pAccurate)})`
  ].join('\n'));
  setText('q7steps', [
    'Independence gives P(at least one) = 1−(1−P(A))(1−P(B))',
    'P(exactly one) = P(A)(1−P(B)) + (1−P(A))P(B)',
    'P(accurate) = P(A only)·accA + P(B only)·accB + P(A∩B)'
  ].join('\n'));
  drawBars('q7chart', ['A only', 'B only', 'Both'], [aOnly * accA, bOnly * accB, both], 'Accurate-location contributions');
}
on('q7calc', 'click', q7Calculate);
['qa', 'qb', 'qaccA', 'qaccB'].forEach(id => on(id, 'input', () => {
  setText('q7out', 'Inputs changed. Calculate to update.'); setText('q7steps', ''); clearChart('q7chart');
}));
on('q7reset', 'click', () => {
  ['0.8', '0.9', '0.7', '0.4'].forEach((value, i) => { byId(['qa', 'qb', 'qaccA', 'qaccB'][i]).value = value; });
  setText('q7out', 'Calculate parts (a)–(c).'); setText('q7steps', ''); clearChart('q7chart');
  hidePill('q7qRes'); clearChoices('q7quiz');
});
on('q7qCheck', 'click', () => {
  const value = chosen('q7quiz');
  showPill('q7qRes', !value ? 'Select true or false.' : `${value === 'F' ? 'Correct.' : 'Try again.'} “Exactly one” is an outcome; both detectors can detect together.`);
});
['q4quiz', 'q7quiz'].forEach(name => document.querySelectorAll(`input[name=${name}]`).forEach(input => {
  input.addEventListener('change', () => hidePill(name === 'q4quiz' ? 'q4qRes' : 'q7qRes'));
}));

// Local hints use the current page state. No network or generative AI is involved.
function localTutor(section, userText) {
  if (section === 'q2') {
    if (/check/i.test(userText)) return 'Both answers are no: D∩E=D and A∩C=D, with D nonempty.';
    if (/subset|⊆/i.test(userText)) return 'D=A∩C ⊆ A ⊆ A∪B=E.';
    return 'Test whether the intersection contains any outcome. Use D=A∩C and E=A∪B.';
  }
  if (section === 'q3') {
    if (/check.*\(a\)|definitions?/i.test(userText)) return definitionChecks();
    if (/part.*b|exact(ly)? one/i.test(userText)) return 'Exactly one = (E₁∩E₂ᶜ) ∪ (E₁ᶜ∩E₂). Independence gives p₁(1−p₂)+(1−p₁)p₂.';
    if (/intuitive|S.*M.*U/i.test(userText)) return 'S: both units working, not hot. M: one outage, not hot. U: hot or both units out.';
    if (/compute|numbers|verify/i.test(userText)) {
      const [p1, p2, ph] = ['p1', 'p2', 'ph'].map(readNumber);
      if (![p1, p2, ph].every(isProbability)) return 'Enter probabilities from 0 to 1 in every field.';
      const one = p1 * (1 - p2) + (1 - p1) * p2;
      return `P(exactly one)=${fix(one)}; P(S)=${fix((1 - p1) * (1 - p2) * (1 - ph))}; P(M)=${fix(one * (1 - ph))}; P(U)=${fix(ph + p1 * p2 * (1 - ph))}.`;
    }
    return 'Use independence for products; use disjoint cases for sums.';
  }
  if (section === 'q4') {
    if (/why.*best|explain.*best|why that process/i.test(userText)) return 'Compare P(i)P(pollution|i)P(kill|pollution,i) for complete clean-up or equal proportional reductions. With the original inputs, A and C tie.';
    if (/check|verify/i.test(userText)) return q4_state
      ? `P(fish kill)=${fix(q4_state.pKill)}. Largest contributors: ${q4_state.best.join(' and ')}. Bayes divides the A-and-pollution branch by all pollution branches.`
      : 'Calculate the current inputs first. Multiply along each branch, then sum across processes.';
    return 'Tree: process → pollution → fish kill. Multiply along branches; sum over processes.';
  }
  if (section === 'q7') {
    if (/exclusive|mutual/i.test(userText)) return '“Exactly one” is A∩Bᶜ or Aᶜ∩B. Mutual exclusivity would require A∩B=∅; independent detectors can both detect.';
    if (/check|verify|values/i.test(userText)) return 'P(at least one)=1−(1−pA)(1−pB). P(exactly one)=pA(1−pB)+(1−pA)pB. Weight A-only, B-only and both by their accuracies for part (c).';
    return 'Find A-only, B-only and both. Add all three for (a), the first two for (b), and weight by accuracy for (c).';
  }
  return 'Choose a question to see its hints.';
}
function addMsg(boxId, who, message) {
  const box = byId(boxId); if (!box) return;
  const div = document.createElement('div');
  div.className = `msg ${who === 'you' ? 'me' : 'bot'}`;
  div.textContent = `${who === 'you' ? 'You' : 'Hint'}: ${message}`;
  box.appendChild(div); box.scrollTop = box.scrollHeight;
}
function handleAsk(section) {
  const input = byId(`ask-${section}`), message = input?.value.trim();
  if (!message) return;
  addMsg(`msgs-${section}`, 'you', message); input.value = '';
  addMsg(`msgs-${section}`, 'hint', localTutor(section, message));
}
document.querySelectorAll('button[data-send]').forEach(btn => btn.addEventListener('click', () => handleAsk(btn.dataset.send)));
document.querySelectorAll('.chip[data-prompt]').forEach(chip => chip.addEventListener('click', () => {
  const area = byId(`ask-${chip.dataset.prompt}`);
  if (area) { area.value = chip.dataset.text || ''; area.focus(); }
}));
globalThis.addEventListener?.('resize', () => {
  renderQ2();
  chartDrawings.forEach(({ labels, values, title }, id) => drawBars(id, labels, values, title));
});
