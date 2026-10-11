// Authored TeX only. Fallback text remains usable while the local MathJax loads.
(function (global) {
  'use strict';
  const doc = global.document;
  const states = new WeakMap();
  let queue = Promise.resolve();
  let readyState = null;
  let resolveReady;
  const ready = new Promise(resolve => { resolveReady = resolve; });
  const find = target => typeof target === 'string' ? doc?.getElementById(target) : target;

  function clearMath(element) {
    try { global.MathJax?.typesetClear?.([element]); } catch (_) { /* Keep fallback usable. */ }
  }
  function matching(root, selector) {
    if (!root) return [];
    return [...(root.matches?.(selector) ? [root] : []), ...Array.from(root.querySelectorAll?.(selector) || [])];
  }
  function cancelWithin(element) {
    matching(element, '[data-math-managed]').forEach(node => {
      const state = states.get(node);
      if (state) state.cancelled = true;
      states.delete(node);
    });
    // MathJax must forget removed MathItems before their DOM is replaced.
    clearMath(element);
  }
  function setText(target, text) {
    const element = find(target);
    if (!element) return;
    cancelWithin(element);
    element.removeAttribute?.('data-tex');
    element.removeAttribute?.('data-math-displaystyle');
    element.removeAttribute?.('data-math-managed');
    element.removeAttribute?.('data-math-state');
    element.textContent = String(text ?? '');
  }
  function current(state) {
    return !state.cancelled && states.get(state.element) === state && state.element.isConnected !== false;
  }
  function restore(state) {
    if (state.work) {
      clearMath(state.work);
      state.work.remove();
    }
    if (current(state)) {
      state.fallback.className = 'math-fallback';
      state.element.setAttribute('data-math-state', 'fallback');
    }
  }
  function enhance(element) {
    const tex = element.getAttribute('data-tex');
    if (!tex) return Promise.resolve();
    const previous = states.get(element);
    if (previous && !previous.cancelled) return previous.promise;
    const fallback = doc.createElement('span');
    fallback.className = 'math-fallback';
    // Preserve authored fallback markup (for example subscripts) until success.
    while (element.firstChild) fallback.appendChild(element.firstChild);
    element.appendChild(fallback);
    const displayStyle = element.getAttribute('data-math-displaystyle') === 'true';
    const state = { element, fallback, tex, displayStyle, work: null, cancelled: false, promise: null };
    states.set(element, state);
    element.setAttribute('data-math-managed', 'true');
    element.setAttribute('data-math-state', 'pending');
    queue = queue.then(async () => {
      if (!await ready || !current(state)) return;
      // An isolated child keeps an older render from overwriting a later reset.
      // It stays hidden until typesetPromise succeeds; raw TeX is never shown.
      const work = doc.createElement('span');
      work.className = 'math-typeset';
      work.hidden = true;
      work.setAttribute('aria-hidden', 'true');
      // Result rows need full-size fractions while remaining left-aligned inline
      // boxes. Static labels retain the compact inline mathematical style.
      work.textContent = `\\(${state.displayStyle ? '\\displaystyle ' : ''}${tex}\\)`;
      state.work = work;
      element.appendChild(work);
      try {
        await global.MathJax.typesetPromise([work]);
        if (!current(state) || work.parentNode !== element) {
          clearMath(work);
          work.remove();
          return;
        }
        if (!work.querySelector('mjx-container') || work.querySelector('[data-mml-node="merror"], mjx-merror')) {
          throw new Error('Math output unavailable');
        }
        // Plain language remains available to screen readers without loading
        // external accessibility extensions or reading the expression twice.
        fallback.className = 'math-fallback sr-only';
        work.hidden = false;
        element.setAttribute('data-math-state', 'rendered');
      } catch (_) {
        restore(state);
      }
    }).catch(() => restore(state));
    state.promise = queue;
    return queue;
  }
  function typeset(target = doc) {
    const element = find(target);
    if (!element || !doc?.createElement) return Promise.resolve();
    return Promise.all(matching(element, '[data-tex]').map(enhance)).then(() => undefined);
  }
  function setLines(target, rows) {
    const element = find(target);
    if (!element || !doc?.createElement) return Promise.resolve();
    setText(element, '');
    (rows || []).forEach(row => {
      const line = doc.createElement('div');
      line.className = 'math-row';
      if (row.label != null && row.label !== '') {
        const label = doc.createElement('span');
        label.className = 'math-label';
        label.textContent = `${row.label} `;
        line.appendChild(label);
      }
      const content = doc.createElement('span');
      content.className = row.tex ? 'math-formula' : 'math-text';
      content.textContent = String(row.tex ? (row.fallback ?? '') : (row.text ?? ''));
      if (row.tex) {
        content.setAttribute('data-tex', String(row.tex));
        content.setAttribute('data-math-displaystyle', 'true');
      }
      line.appendChild(content);
      element.appendChild(line);
    });
    return typeset(element);
  }
  function finishReady(ok) {
    if (readyState !== null) return;
    readyState = Boolean(ok && typeof global.MathJax?.typesetPromise === 'function');
    // Register static content before resolving readiness so flush() includes it.
    if (readyState) typeset(doc);
    resolveReady(readyState);
  }
  const api = { setLines, setText, typeset, whenReady: () => ready, flush: () => queue };
  global.TutorialMath = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (!doc?.createElement) { finishReady(false); return; }

  global.MathJax = {
    tex: {
      inlineMath: [['\\(', '\\)']],
      displayMath: [['\\[', '\\]']],
      processEscapes: true,
      packages: ['base', 'ams', 'newcommand', 'configmacros']
    },
    svg: { fontCache: 'local' },
    options: {
      enableMenu: false,
      menuOptions: { settings: { assistiveMml: false, collapsible: false, explorer: false } },
      renderActions: { addMenu: [], checkLoading: [] }
    },
    loader: { failed: () => finishReady(false) },
    startup: {
      typeset: false,
      ready() {
        try {
          global.MathJax.startup.defaultReady();
          Promise.resolve(global.MathJax.startup.promise).then(() => finishReady(true), () => finishReady(false));
        } catch (_) { finishReady(false); }
      }
    }
  };
  function init() { typeset(doc); }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  // Reveal handlers also cover content inserted after the initial page scan.
  doc.addEventListener('click', event => {
    const tab = event.target?.closest?.('[data-tab]');
    if (tab) typeset(doc.getElementById(tab.getAttribute('data-tab')));
  });
  doc.addEventListener('toggle', event => {
    if (event.target?.tagName === 'DETAILS' && event.target.open) typeset(event.target);
  }, true);
  doc.addEventListener('error', event => {
    const script = event.target;
    if (script?.tagName === 'SCRIPT' && /(?:^|\/)mathjax\/tex-svg\.js(?:[?#]|$)/i.test(script.src || '')) finishReady(false);
  }, true);
})(globalThis);
