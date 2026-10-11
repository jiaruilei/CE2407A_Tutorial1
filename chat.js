(function (global) {
  'use strict';
  const QUESTIONS = /^q[1-7]$/;
  // Only mathematical commands enter MathJax. In particular, definitions,
  // HTML, links, extension loading and file/network commands stay plain text.
  const MATH_COMMANDS = new Set(('frac dfrac tfrac binom dbinom tbinom sqrt root over atop choose ' +
    'left right big Big bigg Bigg bigl bigr Bigl Bigr biggl biggr Biggl Biggr ' +
    'text textrm textbf textit texttt mathrm mathbf mathit mathsf mathtt mathbb mathcal mathfrak boldsymbol operatorname mathop ' +
    'displaystyle textstyle scriptstyle scriptscriptstyle limits nolimits ' +
    'sum prod coproduct int iint iiint oint lim log ln exp sin cos tan min max inf sup Pr ' +
    'cap cup bigcap bigcup triangle bigtriangleup setminus backslash mid middle vert Vert lvert rvert lVert rVert ' +
    'in notin ni subset subseteq supset supseteq emptyset varnothing complement ' +
    'le leq ge geq lt gt ne neq approx simeq sim equiv propto ll gg not ' +
    'times cdot dots ldots cdots vdots ddots pm mp div ast circ bullet ' +
    'to mapsto rightarrow leftarrow leftrightarrow Rightarrow Leftarrow Leftrightarrow implies iff ' +
    'infty partial nabla forall exists neg land lor wedge vee ' +
    'alpha beta gamma delta epsilon varepsilon zeta eta theta vartheta iota kappa lambda mu nu xi pi rho sigma tau upsilon phi varphi chi psi omega ' +
    'Gamma Delta Theta Lambda Xi Pi Sigma Upsilon Phi Psi Omega ' +
    'hat widehat bar overline underline underbrace overbrace overset underset substack tilde widetilde vec dot ddot ' +
    'quad qquad space thinspace medspace thickspace lbrace rbrace langle rangle lceil rceil lfloor rfloor ' +
    'begin end').split(/\s+/));
  const MATH_ENVIRONMENTS = new Set(['aligned', 'alignedat', 'gathered', 'cases', 'matrix', 'pmatrix', 'bmatrix', 'vmatrix', 'Vmatrix', 'smallmatrix', 'array']);

  function safeMath(tex) {
    if (!tex.trim() || tex.length > 2400 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(tex) || tex.replace(/\\%/g, '').includes('%')) return false;
    for (const match of tex.matchAll(/\\([a-zA-Z]+|.)/g)) {
      if (/^[a-zA-Z]+$/.test(match[1]) && !MATH_COMMANDS.has(match[1])) return false;
    }
    for (const match of tex.matchAll(/\\(?:begin|end)\s*\{([^}]*)\}/g)) {
      if (!MATH_ENVIRONMENTS.has(match[1])) return false;
    }
    return true;
  }

  function mathFallback(tex) {
    const symbols = { cap: '∩', cup: '∪', triangle: '△', mid: '|', times: '×', cdot: '·', le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈', in: '∈', notin: '∉', emptyset: '∅', varnothing: '∅', lambda: 'λ', theta: 'θ', pi: 'π', sigma: 'σ', sum: 'Σ', prod: 'Π', to: '→', rightarrow: '→', infty: '∞', pm: '±', quad: ' ', qquad: ' ', dots: '…', ldots: '…' };
    let text = tex.replace(/\\(?:dfrac|tfrac)/g, '\\frac');
    for (let i = 0; i < 5; i += 1) text = text.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)');
    text = text.replace(/\\(?:text|textrm|mathrm|mathbf|mathit|mathbb)\{([^{}]*)\}/g, '$1')
      .replace(/\\(?:left|right|displaystyle|textstyle)\b/g, '')
      .replace(/\\([a-zA-Z]+)/g, (full, command) => symbols[command] ?? full)
      .replace(/\\([,;! ])/g, ' ').replace(/\\([{}_%#$&])/g, '$1')
      .replace(/\^\{([^{}]*)\}/g, '^($1)').replace(/_\{([^{}]*)\}/g, '_($1)');
    return text.trim();
  }

  function parseAssistantMessage(value) {
    const text = String(value ?? '');
    const segments = [];
    const opening = /\\\(|\\\[|\$\$/g;
    let position = 0, match;
    while ((match = opening.exec(text))) {
      const start = match.index, marker = match[0];
      // Escaped delimiters are literal text.
      if (start > 0 && text[start - 1] === '\\') continue;
      const close = marker === '\\(' ? '\\)' : marker === '\\[' ? '\\]' : '$$';
      const end = text.indexOf(close, start + marker.length);
      if (end < 0) continue;
      const tex = text.slice(start + marker.length, end).trim();
      if (safeMath(tex)) {
        if (start > position) segments.push({ text: text.slice(position, start) });
        segments.push({ tex, fallback: mathFallback(tex), display: marker !== '\\(' });
        position = end + close.length;
      }
      opening.lastIndex = end + close.length;
    }
    if (position < text.length) segments.push({ text: text.slice(position) });
    return segments;
  }

  function semanticText(element) {
    if (!element) return '';
    const fallbacks = Array.from(element.querySelectorAll('.math-fallback'));
    return (fallbacks.length ? fallbacks.map(node => node.textContent).join(' ') : element.textContent).trim().slice(0, 1000);
  }

  function snapshotQuestion(doc, question) {
    const section = QUESTIONS.test(question) ? doc.getElementById(question) : null;
    const fields = {};
    for (const field of section?.querySelectorAll('input, select, textarea') || []) {
      if (['button', 'submit', 'password', 'hidden', 'file'].includes(field.type) || field.disabled) continue;
      if (['radio', 'checkbox'].includes(field.type) && !field.checked) continue;
      const key = field.name || field.id;
      if (key && key !== '__proto__' && key !== 'constructor') fields[key] = String(field.value ?? '').slice(0, 1000);
    }
    const context = { fields };
    if (question === 'q1') context.route = semanticText(doc.getElementById('q1-current'));
    if (question === 'q2') context.selectedEvents = Array.from(section?.querySelectorAll('[data-draw][aria-pressed="true"]') || []).map(button => button.getAttribute('data-draw'));
    if (question === 'q5') context.selectedPart = section?.querySelector('[data-q5-part][aria-pressed="true"]')?.getAttribute('data-q5-part') || 'a';
    return context;
  }

  function resolveApiBase(location, configured) {
    if (location.protocol !== 'file:' && !/(^|\.)github\.io$/i.test(location.hostname || '')) return '';
    if (!configured) return '';
    try {
      const url = new URL(configured);
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return '';
      return url.href.replace(/\/$/, '');
    } catch (_) { return ''; }
  }

  function createChatController(doc, options = {}) {
    const get = id => doc.getElementById(id);
    const log = get('coachLog'), input = get('coachQuestion'), form = get('coachForm');
    if (!log || !input || !form) return null;
    const fetch = options.fetch || global.fetch.bind(global);
    const timer = options.setTimeout || global.setTimeout.bind(global);
    const cancelTimer = options.clearTimeout || global.clearTimeout.bind(global);
    const Abort = options.AbortController || global.AbortController;
    const math = options.math || global.TutorialMath;
    const location = options.location || global.location || {};
    const base = resolveApiBase(location, doc.querySelector('meta[name="tutorial-api-base"]')?.content);
    const states = new Map();
    const chips = Array.from(doc.querySelectorAll('.coach-chips [data-question]'));
    const tabs = Array.from(doc.querySelectorAll('[data-tab]'));
    let active = 'q1', health = 'checking', answered = false;
    function state(question = active) {
      if (!states.has(question)) states.set(question, { messages: [], history: [], draft: '', pending: null, error: '' });
      return states.get(question);
    }
    function currentQuestion() {
      const value = tabs.find(tab => tab.getAttribute('aria-current') === 'true')?.getAttribute('data-tab');
      return QUESTIONS.test(value) ? value : 'q1';
    }
    function status() {
      const s = state(), pending = Boolean(s.pending);
      const statusNode = get('coachStatus');
      const errorStatus = s.error ? (/800/.test(s.error) ? 'Question too long' : /Too many/.test(s.error) ? 'Rate limit · retry' : 'AI unavailable') : '';
      const statusText = pending ? 'Thinking…' : errorStatus || ({ checking: 'Checking server…', ready: 'AI online', missing: 'AI not configured', unavailable: 'Server unavailable' })[health];
      if (statusNode) {
        statusNode.textContent = statusText;
        statusNode.classList.toggle('online', health === 'ready' && !s.error && !pending);
      }
      get('coachSend').disabled = pending;
      get('coachSend').textContent = pending ? 'Thinking…' : 'Ask';
      chips.forEach(chip => { chip.disabled = pending; });
      form.setAttribute('aria-busy', String(pending));
    }
    function appendMessage(message) {
      const node = doc.createElement('div');
      node.className = `coach-message ${message.role}`;
      if (message.role === 'assistant') {
        for (const part of parseAssistantMessage(message.content)) {
          const span = doc.createElement('span');
          if (part.tex) {
            span.setAttribute('data-tex', part.tex);
            span.textContent = part.fallback;
            if (part.display) { span.className = 'chat-math-display'; span.setAttribute('data-math-displaystyle', 'true'); }
          } else span.textContent = part.text;
          node.appendChild(span);
        }
      } else node.textContent = message.content;
      log.appendChild(node);
    }
    function render() {
      if (math?.setText) math.setText(log, ''); else log.textContent = '';
      const s = state();
      if (!s.messages.length) appendMessage({ role: 'assistant', content: 'Ask about the current question, or choose a prompt below.' });
      s.messages.forEach(appendMessage);
      if (s.pending) appendMessage({ role: 'pending', content: 'Thinking…' });
      const result = math?.typeset?.(log);
      Promise.resolve(result).catch(() => {}).finally(() => { log.scrollTop = log.scrollHeight; });
      log.scrollTop = log.scrollHeight;
      const tab = tabs.find(item => item.getAttribute('data-tab') === active);
      if (get('coachContext')) get('coachContext').textContent = tab?.textContent || active.toUpperCase();
      input.placeholder = `Ask about ${active.toUpperCase()}…`;
      status();
    }
    function syncQuestion() {
      const next = currentQuestion();
      if (next === active) return;
      state().draft = input.value;
      active = next;
      input.value = state().draft;
      render();
    }
    function clear() {
      const s = state();
      s.pending?.controller.abort();
      if (s.pending) cancelTimer(s.pending.timeout);
      s.pending = null;
      s.messages = [];
      s.history = [];
      s.draft = '';
      s.error = '';
      input.value = '';
      render();
    }
    function failure(response) {
      if (response.status === 429) return 'Too many requests. Wait a moment and try again.';
      if (response.status === 503) return health === 'missing' ? 'AI not configured. The teacher needs to configure the server API key.' : 'AI unavailable. Please try again shortly.';
      if (response.status === 504) return 'The AI took too long. Please try again.';
      return 'The AI could not reply. Please try again.';
    }
    async function send(value) {
      syncQuestion();
      const question = active, s = state(question);
      if (s.pending) return false;
      const message = String(value ?? input.value).trim();
      if (!message) { input.focus(); return false; }
      if (message.length > 800) { s.error = 'Keep your question within 800 characters.'; status(); return false; }
      const context = snapshotQuestion(doc, question);
      const history = s.history.slice(-8).map(item => ({ role: item.role, content: item.content.slice(0, 1000) }));
      const request = { controller: new Abort(), timeout: null, timedOut: false };
      s.pending = request;
      s.error = '';
      // A chip must not discard a draft already being composed.
      const sentDraft = value === undefined || input.value.trim() === message;
      if (sentDraft) { s.draft = ''; input.value = ''; }
      else s.draft = input.value;
      s.messages = s.messages.filter(item => item.role !== 'error');
      const userMessage = { role: 'user', content: message };
      s.messages.push(userMessage);
      s.messages = s.messages.slice(-60);
      render();
      request.timeout = timer(() => { request.timedOut = true; request.controller.abort(); }, 65000);
      try {
        const response = await fetch(`${base}/api/chat`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, message, context, history }), signal: request.controller.signal
        });
        if (!response.ok) throw new Error(failure(response));
        const data = await response.json();
        if (typeof data.answer !== 'string' || !data.answer.trim()) throw new Error('The AI returned an empty reply. Please try again.');
        if (s.pending !== request) return false;
        const answer = data.answer.trim().slice(0, 20000);
        s.messages.push({ role: 'assistant', content: answer });
        s.messages = s.messages.slice(-60);
        s.history.push(userMessage, { role: 'assistant', content: answer });
        s.history = s.history.slice(-8);
        health = 'ready';
        answered = true;
        return true;
      } catch (error) {
        if (s.pending !== request) return false;
        const text = request.timedOut ? 'The request timed out. Please try again.' : error instanceof TypeError || error.name === 'AbortError' ? 'Could not reach the server. Please try again.' : error.message || 'The AI could not reply. Please try again.';
        s.error = text;
        s.messages.push({ role: 'error', content: text });
        s.messages = s.messages.slice(-60);
        // Remove the failed turn from history, but retain it visibly and restore
        // the question for retry without overwriting a newly composed draft.
        if (question === active) s.draft = input.value;
        if (sentDraft && !s.draft) s.draft = message;
        if (question === active) input.value = s.draft;
        return false;
      } finally {
        cancelTimer(request.timeout);
        if (s.pending === request) {
          s.pending = null;
          if (question === active) render();
        }
      }
    }
    async function checkHealth() {
      if (location.protocol === 'file:' && !base) { health = 'unavailable'; status(); return; }
      const controller = new Abort();
      const timeout = timer(() => controller.abort(), 90000);
      try {
        const response = await fetch(`${base}/health`, { signal: controller.signal });
        if (!response.ok) throw new Error('health');
        const data = await response.json();
        if (!answered) health = data.configured === true ? 'ready' : data.configured === false ? 'missing' : 'unavailable';
      } catch (_) { if (!answered) health = 'unavailable'; }
      finally { cancelTimer(timeout); status(); }
    }
    active = currentQuestion();
    form.addEventListener('submit', event => { event.preventDefault(); void send(); });
    input.addEventListener('input', () => { state().draft = input.value; });
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); void send(); }
    });
    get('coachClear').addEventListener('click', clear);
    tabs.forEach(tab => tab.addEventListener('click', syncQuestion));
    chips.forEach(chip => chip.addEventListener('click', () => { void send(chip.getAttribute('data-question')); }));
    render();
    const ready = checkHealth();
    return { ready, send, clear, syncQuestion };
  }
  const api = { safeMath, mathFallback, parseAssistantMessage, snapshotQuestion, resolveApiBase, createChatController };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global.document) global.TutorialChat = createChatController(global.document);
})(globalThis);
