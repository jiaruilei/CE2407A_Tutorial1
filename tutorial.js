// Navigation
const tabs = document.querySelectorAll('.tab-btn');
function activateQuestion(question) {
  const selected = [...tabs].find(tab => tab.dataset.tab === question);
  if (!selected) return false;
  tabs.forEach(tab => {
    tab.classList.toggle('active', tab === selected);
    tab.setAttribute('aria-current', tab === selected ? 'true' : 'false');
  });
  document.querySelectorAll('main section').forEach(section => {
    section.style.display = section.id === question ? 'block' : 'none';
  });
  if (question === 'q2') renderQ2();
  const chartId = `${question}chart`, chart = chartDrawings.get(chartId);
  if (chart) drawBars(chartId, chart.labels, chart.values, chart.title);
  globalThis.TutorialMath?.typeset?.(document.getElementById(question));
  return true;
}
tabs.forEach(btn => {
  btn.setAttribute('aria-current', btn.classList.contains('active') ? 'true' : 'false');
  btn.addEventListener('click', () => activateQuestion(btn.dataset.tab));
});

const byId = id => document.getElementById(id);
const setText = (target, text) => {
  const element = typeof target === 'string' ? byId(target) : target;
  if (!element) return;
  if (globalThis.TutorialMath?.setText) globalThis.TutorialMath.setText(element, text);
  else element.textContent = text;
};
// Only authored TeX and validated numeric results enter the math renderer.
function setMathLines(target, lines) {
  const element = typeof target === 'string' ? byId(target) : target;
  if (!element) return;
  if (globalThis.TutorialMath?.setLines) globalThis.TutorialMath.setLines(element, lines);
  else setText(element, lines.map(line => line.text ?? `${line.label ? `${line.label} ` : ''}${line.fallback}`).join('\n'));
}
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
  if (pill) { pill.style.display = 'none'; setText(pill, ''); }
}
function showPill(id, text) {
  const pill = byId(id);
  if (pill) { pill.style.display = 'inline-flex'; setText(pill, text); }
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
  byId('q3a_u').value = 'H ∪ (E1 ∩ E2 ∩ H^c)';
  setMathLines('q3aout', [
    { text: definitionChecks() },
    { tex: String.raw`S=H^{c}\cap E_1^{c}\cap E_2^{c}`, fallback: 'S = Hᶜ ∩ E₁ᶜ ∩ E₂ᶜ' },
    { tex: String.raw`M=H^{c}\cap(E_1\triangle E_2)`, fallback: 'M = Hᶜ ∩ (E₁ Δ E₂)' },
    { tex: String.raw`U=H\cup(E_1\cap E_2\cap H^{c})`, fallback: 'U = H ∪ (E₁ ∩ E₂ ∩ Hᶜ)' }
  ]);
});
['q3a_s', 'q3a_m', 'q3a_u'].forEach(id => on(id, 'input', () => setText('q3aout', 'Check your expressions.')));
const rows = [];
for (const e1 of [0, 1]) for (const e2 of [0, 1]) for (const h of [0, 1]) {
  const cls = !e1 && !e2 && !h ? 'S' : e1 !== e2 && !h ? 'M' : 'U';
  rows.push(`<tr><td data-tex="${e1 ? 'E_1' : 'E_1^{c}'}">${e1 ? 'E₁' : 'E₁ᶜ'}</td><td data-tex="${e2 ? 'E_2' : 'E_2^{c}'}">${e2 ? 'E₂' : 'E₂ᶜ'}</td><td data-tex="${h ? 'H' : 'H^{c}'}">${h ? 'H' : 'Hᶜ'}</td><td data-tex="${cls}">${cls}</td></tr>`);
}
if (byId('q3tbl')) {
  byId('q3tbl').innerHTML = rows.join('');
  globalThis.TutorialMath?.typeset?.(byId('q3tbl'));
}

function q3Calculate() {
  const [p1, p2, ph] = ['p1', 'p2', 'ph'].map(readNumber);
  setText('q3steps', '');
  if (![p1, p2, ph].every(isProbability)) {
    setText('q3out', 'Enter a probability from 0 to 1 in every field.'); return;
  }
  const exactlyOne = p1 * (1 - p2) + (1 - p1) * p2;
  const S = (1 - p1) * (1 - p2) * (1 - ph), M = exactlyOne * (1 - ph), U = ph + p1 * p2 * (1 - ph);
  setMathLines('q3out', [
    { label: '(b)', tex: String.raw`P(E_1\triangle E_2)=${fix(exactlyOne)}`, fallback: `P(exactly one outage) = ${fix(exactlyOne)}` },
    { label: '(c)', tex: String.raw`P(S)=${fix(S)}`, fallback: `P(S) = ${fix(S)}` },
    { tex: String.raw`P(M)=${fix(M)}`, fallback: `P(M) = ${fix(M)}` },
    { tex: String.raw`P(U)=${fix(U)}`, fallback: `P(U) = ${fix(U)}` }
  ]);
  setMathLines('q3steps', [
    { text: 'By independence:' },
    { tex: String.raw`p_i=P(E_i),\qquad i=1,2`, fallback: 'pᵢ = P(Eᵢ), i = 1,2' },
    { tex: String.raw`P(E_1\triangle E_2)=p_1(1-p_2)+(1-p_1)p_2=${fix(exactlyOne)}`, fallback: `P(exactly one) = p₁(1−p₂) + (1−p₁)p₂ = ${fix(exactlyOne)}` },
    { tex: String.raw`P(S)=(1-p_1)(1-p_2)[1-P(H)]=${fix(S)}`, fallback: `P(S) = (1−p₁)(1−p₂)(1−P(H)) = ${fix(S)}` },
    { tex: String.raw`P(M)=P(E_1\triangle E_2)[1-P(H)]=${fix(M)}`, fallback: `P(M) = P(exactly one)(1−P(H)) = ${fix(M)}` },
    { tex: String.raw`P(U)=P(H)+p_1p_2[1-P(H)]=${fix(U)}`, fallback: `P(U) = P(H) + p₁p₂(1−P(H)) = ${fix(U)}` }
  ]);
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
  canvas.setAttribute('aria-label', `${title}. ${labels.map((label, i) => `${label}: ${pct(values[i])}`).join('. ')}.`);
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
  hidePill('q4delta');
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
  q4_state = { prior, poll, kill, contrib, pKill };
  const bestText = max === 0 ? 'All contributions are zero.' : `${best.join(' and ')}${best.length > 1 ? ' tie' : ''}: ${fix(max)}${best.length > 1 ? ' each' : ''}.`;
  setMathLines('q4out', [
    { label: '(a)', tex: String.raw`P(F^c)=${fix(pNo)}\quad(${pct(pNo).replace('%', '\\%')})`, fallback: `P(no pollution) = ${fix(pNo)} (${pct(pNo)})` },
    pYes === 0
      ? { label: '(b)', tex: String.raw`\begin{gathered}P(A\mid F)\text{ is undefined:}\\P(F)=0\end{gathered}`, fallback: 'P(A | pollution) = undefined: P(pollution) = 0' }
      : { label: '(b)', tex: String.raw`P(A\mid F)=${fix(prior[0] * poll[0] / pYes)}\quad(${pct(prior[0] * poll[0] / pYes).replace('%', '\\%')})`, fallback: `P(A | pollution) = ${fix(prior[0] * poll[0] / pYes)} (${pct(prior[0] * poll[0] / pYes)})` },
    { label: '(c)', tex: String.raw`P(K)=${fix(pKill)}\quad(${pct(pKill).replace('%', '\\%')})`, fallback: `P(fish kill) = ${fix(pKill)} (${pct(pKill)})` },
    { text: `(d) Largest contribution: ${bestText}` }
  ]);
  setMathLines('q4steps', [
    { tex: String.raw`P(F^c)=\sum_i P(i)[1-P(F\mid i)]`, fallback: 'P(no pollution) = Σ P(i)[1−P(pollution|i)]' },
    { tex: String.raw`P(A\mid F)=\frac{P(A)P(F\mid A)}{P(F)}`, fallback: 'P(A|pollution) = P(A)P(pollution|A) / P(pollution)' },
    { tex: String.raw`P(K)=\sum_i P(i)P(F\mid i)P(K\mid F,i)`, fallback: 'P(fish kill) = Σ P(i)P(pollution|i)P(kill|pollution,i)' },
    { text: 'Compare contributions for complete clean-up or equal proportional reductions.' }
  ]);
  drawBars('q4chart', processLabels, contrib, 'Fish-kill contribution by process');
}
on('q4calc', 'click', q4Calculate);
['q4prior', 'q4poll', 'q4kill'].forEach(id => on(id, 'input', () => clearQ4Results('Inputs changed. Calculate to update.')));
on('q4reset', 'click', () => {
  ['0.2,0.4,0.3,0.1', '0.40,0.05,0.30,0.10', '0.9,0.1,0.8,0.3'].forEach((value, i) => { byId(['q4prior', 'q4poll', 'q4kill'][i]).value = value; });
  byId('q4which').value = '0'; byId('q4tune').value = '0.20';
  clearQ4Results('Calculate parts (a)–(d).');
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
  showPill('q4delta', '');
  byId('q4delta').style.display = 'block';
  setMathLines('q4delta', [
    { tex: String.raw`P(K)=${fix(pKill)}\quad(${pct(pKill).replace('%', '\\%')})`, fallback: `P(fish kill) = ${fix(pKill)} (${pct(pKill)})` },
    { text: `Change: ${delta > 0 ? '+' : ''}${delta} percentage points` }
  ]);
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
  setMathLines('q7out', [
    { label: '(a)', tex: String.raw`P(A\cup B)=${fix(pAtLeastOne)}\quad(${pct(pAtLeastOne).replace('%', '\\%')})`, fallback: `P(at least one detection) = ${fix(pAtLeastOne)} (${pct(pAtLeastOne)})` },
    { label: '(b)', tex: String.raw`P(A\triangle B)=${fix(pOnlyOne)}\quad(${pct(pOnlyOne).replace('%', '\\%')})`, fallback: `P(exactly one detection) = ${fix(pOnlyOne)} (${pct(pOnlyOne)})` },
    { label: '(c)', tex: String.raw`P(\text{accurate})=${fix(pAccurate)}`, fallback: `P(accurate location) = ${fix(pAccurate)}` }
  ]);
  setMathLines('q7steps', [
    { text: 'By independence:' },
    { tex: String.raw`P(A\cup B)=1-(1-p_A)(1-p_B)`, fallback: 'P(at least one) = 1−(1−P(A))(1−P(B))' },
    { tex: String.raw`P(A\triangle B)=p_A(1-p_B)+(1-p_A)p_B`, fallback: 'P(exactly one) = P(A)(1−P(B)) + (1−P(A))P(B)' },
    { tex: String.raw`\begin{aligned}P(\text{accurate})={}&a_Ap_A(1-p_B)\\&+a_B(1-p_A)p_B+p_Ap_B\end{aligned}`, fallback: 'P(accurate) = a_A p_A(1−p_B) + a_B(1−p_A)p_B + p_A p_B' }
  ]);
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
  showPill('q7qRes', !value ? 'Select true or false.' : `${value === 'F' ? 'Correct.' : 'Try again.'} “Exactly one” is an outcome. Both detectors can detect together.`);
});
document.querySelectorAll('input[name=q7quiz]').forEach(input => {
  input.addEventListener('change', () => hidePill('q7qRes'));
});

globalThis.addEventListener?.('resize', () => {
  renderQ2();
  chartDrawings.forEach(({ labels, values, title }, id) => drawBars(id, labels, values, title));
});

// Apply deep links after the controls and charts are ready, before chat.js
// reads aria-current to choose its initial question and conversation.
const tutorialQuery = new URLSearchParams(globalThis.location?.search || '');
document.body.classList.toggle('tutorial-embed', tutorialQuery.get('embed') === '1');
const requestedQuestion = tutorialQuery.get('question');
if (/^q[1-7]$/.test(requestedQuestion || '')) activateQuestion(requestedQuestion);
