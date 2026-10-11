(function () {
  'use strict';

  // Directed highways and travel times (hours), Tutorial Set 1, Q1.
  const edges = [
    [1, 2, [1, 2]], [1, 3, [1, 1.5]], [1, 4, [1.5, 2]],
    [2, 9, [3, 4, 5]], [2, 5, [2, 2.5]], [3, 5, [1, 2]],
    [4, 5, [2]], [4, 6, [1.5, 2.5]], [5, 7, [0.5, 1]],
    [5, 8, [1, 1.5]], [6, 8, [0.5]], [7, 9, [1]], [8, 9, [2, 3]]
  ];
  edges.forEach(edge => { Object.freeze(edge[2]); Object.freeze(edge); });
  Object.freeze(edges);

  const nextCities = city => edges.filter(edge => edge[0] === city).map(edge => edge[1]);
  function allRoutes(start = 1, end = 9) {
    const result = [];
    function visit(path) {
      const last = path[path.length - 1];
      if (last === end) { result.push(path); return; }
      nextCities(last).forEach(next => {
        if (!path.includes(next)) visit([...path, next]);
      });
    }
    visit([start]);
    return result;
  }
  function routeCombinations(route) {
    if (!Array.isArray(route) || route.length < 2) throw new Error('Choose a route with at least two cities.');
    let combinations = [[]];
    for (let i = 1; i < route.length; i++) {
      const edge = edges.find(edge => edge[0] === route[i - 1] && edge[1] === route[i]);
      if (!edge) throw new Error('The route must follow the highway arrows.');
      combinations = combinations.flatMap(parts => edge[2].map(time => [...parts, time]));
    }
    return combinations.map(parts => ({ parts, total: parts.reduce((sum, time) => sum + time, 0) }));
  }
  const possibleTimes = route => [...new Set(routeCombinations(route).map(row => row.total))].sort((a, b) => a - b);
  const api = { edges, nextCities, allRoutes, routeCombinations, possibleTimes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;
  const get = id => document.getElementById(id);
  if (!get('q1network')) return;
  const listen = (id, action, handler) => get(id)?.addEventListener(action, handler);
  const text = (id, value) => {
    const element = get(id);
    if (!element) return;
    if (globalThis.TutorialMath?.setText) globalThis.TutorialMath.setText(element, value);
    else element.textContent = value;
  };
  const math = (target, rows) => {
    if (globalThis.TutorialMath?.setLines) globalThis.TutorialMath.setLines(target, rows);
    else {
      const element = typeof target === 'string' ? get(target) : target;
      if (element) element.textContent = rows.map(row => row.fallback ?? row.text ?? '').join('\n');
    }
  };
  const routeLabel = route => route.join(' → ');
  const routeTex = route => route.join(String.raw`\to`);
  let currentRoute = [1];

  const points = {
    1: [45, 235], 2: [160, 105], 3: [190, 245], 4: [245, 370],
    5: [365, 190], 6: [445, 385], 7: [540, 125], 8: [565, 265], 9: [690, 35]
  };
  const labelPositions = {
    '1-2': [75, 157], '1-3': [111, 224], '1-4': [130, 322],
    '2-9': [425, 50], '2-5': [258, 130], '3-5': [274, 201],
    '4-5': [293, 282], '4-6': [345, 401], '5-7': [451, 142],
    '5-8': [474, 215], '6-8': [524, 340], '7-9': [608, 64], '8-9': [654, 168]
  };
  function drawNetwork() {
    const active = new Set(currentRoute.slice(1).map((city, index) => `${currentRoute[index]}-${city}`));
    const links = edges.map(([from, to, times]) => {
      const key = `${from}-${to}`, [x1, y1] = points[from], [x2, y2] = points[to];
      const length = Math.hypot(x2 - x1, y2 - y1), dx = (x2 - x1) / length, dy = (y2 - y1) / length;
      const selected = active.has(key), color = selected ? '#2563eb' : '#94a3b8';
      const [lx, ly] = labelPositions[key];
      return `<g><title>${from} to ${to}: ${times.join(', ')} hours</title><line x1="${x1 + 21 * dx}" y1="${y1 + 21 * dy}" x2="${x2 - 26 * dx}" y2="${y2 - 26 * dy}" stroke="${color}" stroke-width="${selected ? 4 : 2}" marker-end="url(#q1arrow-${selected ? 'active' : 'base'})"/><text x="${lx}" y="${ly}" text-anchor="middle" font-size="18" fill="#334155" stroke="white" stroke-width="6" paint-order="stroke">${times.join(', ')}</text></g>`;
    }).join('');
    const nodes = Object.entries(points).map(([city, [x, y]]) => {
      const selected = currentRoute.includes(Number(city));
      return `<g><circle cx="${x}" cy="${y}" r="21" fill="${selected ? '#eff6ff' : 'white'}" stroke="${selected ? '#2563eb' : '#64748b'}" stroke-width="${selected ? 3 : 1.5}"/><text x="${x}" y="${y + 6}" text-anchor="middle" font-size="19" font-weight="600" fill="#142033">${city}</text></g>`;
    }).join('');
    get('q1network').innerHTML = `<title id="q1-network-title">Highways from city 1 to city 9</title><desc id="q1-network-desc">Arrows give travel direction. Labels give possible times in hours. Highlighted route: ${routeLabel(currentRoute)}.</desc><defs><marker id="q1arrow-base" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8"/></marker><marker id="q1arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#2563eb"/></marker></defs>${links}${nodes}`;
  }
  function updateRoute() {
    const last = currentRoute[currentRoute.length - 1], choices = nextCities(last);
    get('q1-next').innerHTML = choices.length ? choices.map(city => `<option value="${city}">${city}</option>`).join('') : '<option value="">Arrived at 9</option>';
    get('q1-next').disabled = !choices.length;
    get('q1-add').disabled = !choices.length;
    get('q1-undo').disabled = currentRoute.length < 2;
    math('q1-current', [{ tex: routeTex(currentRoute) + (last === 9 ? String.raw`\quad\text{Complete route}` : ''), fallback: routeLabel(currentRoute) + (last === 9 ? ' · Complete route' : '') }]);
    math('q1-highlight', [{ tex: String.raw`\text{Route: }${routeTex(currentRoute)}`, fallback: `Route: ${routeLabel(currentRoute)}` }]);
    drawNetwork();
  }
  listen('q1-add', 'click', () => {
    const next = Number(get('q1-next').value);
    if (nextCities(currentRoute[currentRoute.length - 1]).includes(next)) { currentRoute.push(next); updateRoute(); }
  });
  listen('q1-undo', 'click', () => { if (currentRoute.length > 1) { currentRoute.pop(); updateRoute(); } });
  listen('q1-reset', 'click', () => { currentRoute = [1]; updateRoute(); });
  listen('q1-show-routes', 'click', () => {
    const container = get('q1-routes'), isHidden = container.hidden;
    container.hidden = !isHidden;
    get('q1-show-routes').setAttribute('aria-expanded', String(isHidden));
    get('q1-show-routes').textContent = isHidden ? 'Hide all routes' : 'Show all routes';
    if (isHidden && !container.childElementCount) {
      const routes = allRoutes();
      const count = document.createElement('p'); count.className = 'brief'; count.textContent = `${routes.length} routes in the sample space.`; container.append(count);
      routes.forEach(route => {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary q1-route-button';
        button.addEventListener('click', () => { currentRoute = [...route]; updateRoute(); });
        container.append(button);
        math(button, [{ tex: routeTex(route), fallback: routeLabel(route) }]);
      });
    }
  });

  function timeRoute() { return get('q1-time-route').value.split(',').map(Number); }
  listen('q1-time-route', 'change', () => {
    currentRoute = timeRoute(); updateRoute();
    text('q1-time-results', 'Calculate the possible travel times.');
    text('q1-combinations', '');
  });
  listen('q1-calculate', 'click', () => {
    currentRoute = timeRoute(); updateRoute();
    const combinations = routeCombinations(currentRoute), times = possibleTimes(currentRoute);
    math('q1-time-results', [
      { tex: routeTex(currentRoute), fallback: routeLabel(currentRoute) },
      { tex: String.raw`T\in\left\{${times.join(String.raw`,\,`)}\right\}\ \mathrm{h}`, fallback: `Possible travel times: {${times.join(', ')}} hours.` }
    ]);
    const table = document.createElement('table'); table.className = 'tbl';
    const headings = currentRoute.slice(1).map((city, index) =>
      `<span data-tex="${routeTex([currentRoute[index], city])}">${currentRoute[index]} → ${city}</span>`).concat('Total (h)');
    table.innerHTML = `<caption class="sr-only">All leg-time combinations for ${routeLabel(currentRoute)}, in hours</caption><thead><tr>${headings.map(heading => `<th scope="col">${heading}</th>`).join('')}</tr></thead><tbody>${combinations.map(row => `<tr>${[...row.parts, row.total].map(value => `<td>${value}</td>`).join('')}</tr>`).join('')}</tbody>`;
    text('q1-combinations', '');
    get('q1-combinations').append(table);
    globalThis.TutorialMath?.typeset?.(table);
  });
  updateRoute();
})();
