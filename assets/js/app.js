/*
 * Moon & Soma Jyotish — interface.
 * Renders into every element with [data-msj-app]. Config comes from
 * window.MSJ_CONFIG (set by the WordPress plugin); without a REST URL the
 * saved charts live in localStorage (handy for local previews).
 */
(function () {
  'use strict';

  var J = window.MSJyotish;
  var TEXTS = window.MSJyotishTexts || {};
  var CFG = Object.assign({
    restUrl: '',
    nonce: '',
    defaultPlace: { label: 'London, United Kingdom', lat: 51.5074, lon: -0.1278, tz: 'Europe/London' }
  }, window.MSJ_CONFIG || {});

  // ---------- helpers ----------

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    [].concat(children || []).forEach(function (c) {
      if (c == null || c === false) return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }

  function svg(tag, attrs, text) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    if (text != null) el.textContent = text;
    return el;
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtDate(ms, tz) { return J.formatInZone(ms, tz || 'UTC', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function fmtTime(ms, tz) { return ms ? J.formatInZone(ms, tz || 'UTC', { hour: '2-digit', minute: '2-digit' }) : '—'; }

  // Current wall-clock date and time in the chart's zone (not the device's), for the date/time inputs.
  function nowIn(tz) {
    var p = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: tz || 'UTC', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
    return { date: p.year + '-' + p.month + '-' + p.day, time: p.hour + ':' + p.minute };
  }

  function guessTz(lat, lon) {
    try { return window.tzlookup(lat, lon); } catch (e) { return 'UTC'; }
  }

  function allZones() {
    try { return Intl.supportedValuesOf('timeZone'); } catch (e) { return ['UTC', 'Europe/London']; }
  }

  // ---------- storage ----------

  var store = CFG.restUrl ? {
    req: function (method, path, body) {
      return fetch(CFG.restUrl.replace(/\/$/, '') + path, {
        method: method,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': CFG.nonce },
        body: body ? JSON.stringify(body) : undefined
      }).then(function (r) {
        if (r.ok) return r.json();
        return r.json().catch(function () { return {}; }).then(function (e) {
          if (r.status === 401 || r.status === 403) throw new Error('your session has expired — reload the page to log in again');
          throw new Error(e.message || r.statusText);
        });
      });
    },
    list: function () { return this.req('GET', '/charts'); },
    save: function (c) { return c.id ? this.req('POST', '/charts/' + c.id, c) : this.req('POST', '/charts', c); },
    remove: function (id) { return this.req('DELETE', '/charts/' + id); }
  } : {
    key: 'msj-charts',
    all: function () { try { return JSON.parse(localStorage.getItem(this.key)) || []; } catch (e) { return []; } },
    put: function (list) { localStorage.setItem(this.key, JSON.stringify(list)); },
    list: function () { return Promise.resolve(this.all()); },
    save: function (c) {
      var list = this.all();
      c = Object.assign({}, c);
      if (!c.id) { c.id = Date.now(); list.push(c); }
      else list = list.map(function (x) { return x.id === c.id ? c : x; });
      this.put(list);
      return Promise.resolve(c);
    },
    remove: function (id) { this.put(this.all().filter(function (x) { return x.id !== id; })); return Promise.resolve({ deleted: true }); }
  };

  // ---------- chart drawings ----------

  var SOUTH_CELLS = { 11: [0, 0], 0: [0, 1], 1: [0, 2], 2: [0, 3], 3: [1, 3], 4: [2, 3], 5: [3, 3], 6: [3, 2], 7: [3, 1], 8: [3, 0], 9: [2, 0], 10: [1, 0] };
  // North Indian: label anchor for each house (1..12) in a 400×400 box.
  var NORTH_CENTERS = [null, [200, 110], [100, 48], [48, 100], [110, 200], [48, 300], [100, 352], [200, 290], [300, 352], [352, 300], [290, 200], [352, 100], [300, 48]];
  var NORTH_SIGN_POS = [null, [200, 180], [100, 88], [88, 100], [180, 200], [88, 300], [100, 312], [200, 220], [300, 312], [312, 300], [220, 200], [312, 100], [300, 88]];

  function planetLabel(p) {
    var t = p.abbr;
    if (p.retrograde && p.name !== 'Rahu' && p.name !== 'Ketu') t += 'ᴿ';
    if (p.combust) t += 'ᶜ';
    return t;
  }

  function stackLabels(g, items, cx, cy, size, lineH) {
    var total = items.length;
    var cols = total > 4 ? 2 : 1;
    var rows = Math.ceil(total / cols);
    items.forEach(function (it, i) {
      var col = cols === 2 ? (i % 2) : 0;
      var row = cols === 2 ? Math.floor(i / 2) : i;
      var x = cx + (cols === 2 ? (col ? 22 : -22) : 0);
      var y = cy + (row - (rows - 1) / 2) * lineH;
      g.appendChild(svg('text', { x: x, y: y, 'text-anchor': 'middle', 'dominant-baseline': 'middle', class: 'msj-pl' + (it.asc ? ' msj-asc' : ''), 'font-size': size }, it.text));
    });
  }

  function drawSouth(chart, varga, title) {
    var s = svg('svg', { viewBox: '0 0 400 400', class: 'msj-chart-svg', role: 'img', 'aria-label': title });
    var groups = J.bySign(chart.points.filter(function (p) { return p.name !== 'Asc'; }), varga);
    var asc = chart.points[0];
    var ascSign = varga === 'D9' ? asc.navamsa : asc.sign;
    Object.keys(SOUTH_CELLS).forEach(function (k) {
      var sign = +k, rc = SOUTH_CELLS[k];
      var x = rc[1] * 100, y = rc[0] * 100;
      s.appendChild(svg('rect', { x: x, y: y, width: 100, height: 100, class: 'msj-cell' }));
      s.appendChild(svg('text', { x: x + (sign === ascSign ? 26 : 6), y: y + 14, class: 'msj-signno' }, J.SIGNS[sign].slice(0, 3)));
      if (sign === ascSign) {
        s.appendChild(svg('line', { x1: x, y1: y + 22, x2: x + 22, y2: y, class: 'msj-ascmark' }));
      }
      var items = groups[sign].map(function (p) { return { text: planetLabel(p) + (varga === 'D1' ? ' ' + Math.floor(p.deg) + '°' : '') }; });
      if (sign === ascSign) items.unshift({ text: 'Asc' + (varga === 'D1' ? ' ' + Math.floor(asc.deg) + '°' : ''), asc: true });
      stackLabels(s, items, x + 50, y + 56, 13, 16);
    });
    s.appendChild(svg('rect', { x: 100, y: 100, width: 200, height: 200, class: 'msj-center' }));
    s.appendChild(svg('text', { x: 200, y: 192, 'text-anchor': 'middle', class: 'msj-center-title' }, varga === 'D1' ? 'Rāśi' : 'Navāṁśa'));
    s.appendChild(svg('text', { x: 200, y: 216, 'text-anchor': 'middle', class: 'msj-center-sub' }, varga));
    return s;
  }

  function drawNorth(chart, varga, title) {
    var s = svg('svg', { viewBox: '0 0 400 400', class: 'msj-chart-svg', role: 'img', 'aria-label': title });
    s.appendChild(svg('rect', { x: 1, y: 1, width: 398, height: 398, class: 'msj-cell' }));
    [[0, 0, 400, 400], [400, 0, 0, 400], [200, 0, 0, 200], [0, 200, 200, 400], [200, 400, 400, 200], [400, 200, 200, 0]].forEach(function (l) {
      s.appendChild(svg('line', { x1: l[0], y1: l[1], x2: l[2], y2: l[3], class: 'msj-line' }));
    });
    var asc = chart.points[0];
    var ascSign = varga === 'D9' ? asc.navamsa : asc.sign;
    var groups = J.bySign(chart.points.filter(function (p) { return p.name !== 'Asc'; }), varga);
    for (var house = 1; house <= 12; house++) {
      var sign = (ascSign + house - 1) % 12;
      var sp = NORTH_SIGN_POS[house];
      s.appendChild(svg('text', { x: sp[0], y: sp[1], 'text-anchor': 'middle', 'dominant-baseline': 'middle', class: 'msj-signno' }, String(sign + 1)));
      var items = groups[sign].map(function (p) { return { text: planetLabel(p) + (varga === 'D1' ? ' ' + Math.floor(p.deg) + '°' : '') }; });
      if (house === 1) items.unshift({ text: 'Asc' + (varga === 'D1' ? ' ' + Math.floor(asc.deg) + '°' : ''), asc: true });
      var c = NORTH_CENTERS[house];
      var corner = [2, 3, 5, 6, 8, 9, 11, 12].indexOf(house) >= 0;
      stackLabels(s, items, c[0], c[1], corner ? 11 : 13, corner ? 13 : 16);
    }
    return s;
  }

  // ---------- app ----------

  function App(root) {
    this.root = root;
    this.state = {
      style: localStorage.getItem('msj-style') || 'north',
      tab: 'chart',
      current: null,      // saved record { id, name, birth, notes }
      chart: null,
      saved: [],
      place: Object.assign({}, CFG.defaultPlace)
    };
    this.build();
    this.refreshSaved();
  }

  App.prototype.build = function () {
    var self = this;
    var st = this.state;
    var now = nowIn(st.place.tz);

    this.f = {
      name: h('input', { type: 'text', placeholder: 'Name', autocomplete: 'off' }),
      date: h('input', { type: 'date', required: true, value: now.date }),
      time: h('input', { type: 'time', required: true, step: 60, value: now.time }),
      place: h('input', { type: 'text', placeholder: 'City, country', value: st.place.label }),
      lat: h('input', { type: 'number', step: 'any', value: st.place.lat }),
      lon: h('input', { type: 'number', step: 'any', value: st.place.lon }),
      tz: h('select', {}, allZones().map(function (z) { return h('option', { value: z, text: z }); })),
      notes: h('textarea', { rows: 6, placeholder: 'Consultation notes…' }),
      ayanamsa: h('select', {}, [h('option', { value: 'lahiri', text: 'Lahiri (Swiss Ephemeris)' }), h('option', { value: 'lahiri-deva', text: 'Lahiri as deva.guru' })]),
      dashaYear: h('select', {}, [h('option', { value: 'gregorian', text: '365.2425 days' }), h('option', { value: 'sidereal', text: '365.2564 days (sidereal, deva.guru)' })])
    };
    this.f.ayanamsa.value = localStorage.getItem('msj-ayanamsa') || CFG.ayanamsa || 'lahiri';
    this.f.dashaYear.value = localStorage.getItem('msj-dasha-year') || CFG.dashaYear || 'gregorian';
    [['ayanamsa', 'msj-ayanamsa'], ['dashaYear', 'msj-dasha-year']].forEach(function (k) {
      self.f[k[0]].addEventListener('change', function () { localStorage.setItem(k[1], self.f[k[0]].value); self.calculate(); });
    });
    this.f.tz.value = st.place.tz;
    this.f.lat.addEventListener('change', function () { self.autoTz(); });
    this.f.lon.addEventListener('change', function () { self.autoTz(); });

    this.placeResults = h('ul', { class: 'msj-places' });
    this.savedList = h('ul', { class: 'msj-saved' });
    this.savedFilter = h('input', { type: 'search', placeholder: 'Search charts', oninput: function () { self.renderSaved(); } });
    this.status = h('p', { class: 'msj-status', 'aria-live': 'polite' });

    var form = h('form', { class: 'msj-form', onsubmit: function (e) { e.preventDefault(); self.calculate(); self.reveal(); } }, [
      field('Name', this.f.name),
      h('div', { class: 'msj-row' }, [field('Date', this.f.date), field('Time', this.f.time)]),
      field('Place', h('div', { class: 'msj-place' }, [
        this.f.place,
        h('button', { type: 'button', class: 'msj-btn msj-btn-ghost', text: 'Find', onclick: function () { self.findPlace(); } })
      ])),
      this.placeResults,
      h('div', { class: 'msj-row' }, [field('Latitude', this.f.lat), field('Longitude', this.f.lon)]),
      field('Time zone', this.f.tz),
      h('div', { class: 'msj-actions' }, [
        h('button', { type: 'submit', class: 'msj-btn', text: 'Cast chart' }),
        h('button', { type: 'button', class: 'msj-btn msj-btn-ghost', text: 'Now', onclick: function () { self.setNow(); } })
      ])
    ]);
    this.f.place.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); self.findPlace(); } });

    var standalone = this.root.hasAttribute('data-msj-standalone');
    var side = h('aside', { class: 'msj-side' }, [
      standalone ? h('div', { class: 'msj-brand' }, [h('span', { class: 'msj-brand-name', text: 'Moon & Soma' }), h('span', { class: 'msj-brand-sub', text: 'Jyotiṣa' })]) : null,
      h('h3', { text: 'Birth data' }), form,
      h('details', { class: 'msj-settings' }, [h('summary', { text: 'Settings' }), field('Ayanāṃśa', this.f.ayanamsa), field('Daśā year', this.f.dashaYear)]),
      h('h3', { text: 'Notes' }), this.f.notes,
      h('div', { class: 'msj-actions' }, [
        h('button', { type: 'button', class: 'msj-btn', text: 'Save', onclick: function () { self.save(); } }),
        h('button', { type: 'button', class: 'msj-btn msj-btn-ghost', text: 'New', onclick: function () { self.reset(); } }),
        h('button', { type: 'button', class: 'msj-btn msj-btn-ghost msj-danger', text: 'Delete', onclick: function () { self.remove(); } })
      ]),
      this.status,
      h('h3', { text: 'Saved charts' }), this.savedFilter, this.savedList,
      standalone && CFG.user ? h('p', { class: 'msj-account' }, [CFG.user + ' · ', h('a', { href: CFG.logoutUrl, text: 'Log out' })]) : null
    ]);

    this.tabs = h('nav', { class: 'msj-tabs', role: 'tablist' }, [['chart', 'Chart'], ['dasha', 'Daśā'], ['panchang', 'Panchāṅga'], ['reading', 'Reading']].map(function (t) {
      return h('button', { type: 'button', role: 'tab', 'data-tab': t[0], text: t[1], onclick: function () { self.setTab(t[0]); } });
    }));
    this.styleToggle = h('div', { class: 'msj-style' }, [['north', 'North'], ['south', 'South']].map(function (s) {
      return h('button', { type: 'button', 'data-style': s[0], text: s[1], onclick: function () { self.setStyle(s[0]); } });
    }));
    // Phone layout of the app page: a bottom bar switches between the birth-data panel and each tab.
    this.mnav = standalone ? h('nav', { class: 'msj-mnav', 'aria-label': 'Sections' }, [['birth', 'Birth'], ['chart', 'Chart'], ['dasha', 'Daśā'], ['panchang', 'Panchāṅga'], ['reading', 'Reading']].map(function (t) {
      return h('button', { type: 'button', 'data-tab': t[0], onclick: function () { self.go(t[0]); } }, [navIcon(t[0]), h('span', { text: t[1] })]);
    })) : null;
    this.title = h('div', { class: 'msj-title' });
    this.body = h('div', { class: 'msj-body' });

    var main = h('section', { class: 'msj-main' }, [
      standalone ? h('p', { class: 'msj-mbrand', text: 'Moon & Soma · Jyotiṣa' }) : null,
      h('header', { class: 'msj-head' }, [this.title, h('div', { class: 'msj-tools' }, [
        this.styleToggle,
        h('button', { type: 'button', class: 'msj-btn msj-btn-ghost msj-print', text: 'Print', onclick: function () { window.print(); } })
      ])]),
      this.tabs, this.body
    ]);

    this.root.innerHTML = '';
    this.root.classList.add('msj');
    this.wrap = h('div', { class: 'msj-wrap' }, [side, main]);
    this.root.appendChild(this.wrap);
    if (this.mnav) this.root.appendChild(this.mnav);
    this.syncToggles();
    this.calculate();

    function field(label, input) { return h('label', { class: 'msj-field' }, [h('span', { text: label }), input]); }

    function navIcon(name) {
      var paths = {
        birth: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6'],
        chart: ['M3.5 3.5h17v17h-17z', 'M3.5 3.5l17 17M20.5 3.5l-17 17', 'M12 3.5L20.5 12 12 20.5 3.5 12z'],
        dasha: ['M4 6h16', 'M4 12h10', 'M4 18h6', 'M17 10.5v3M11 16.5v3'],
        panchang: ['M15.5 3.8A8.5 8.5 0 1 0 20.2 15 7 7 0 0 1 15.5 3.8z'],
        reading: ['M12 6.5C10 5 7 4.5 3.5 5v13.5c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z', 'M12 6.5V20']
      };
      var s = svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' });
      paths[name].forEach(function (d) { s.appendChild(svg('path', { d: d })); });
      return s;
    }
  };

  App.prototype.isPhone = function () { return !!this.mnav && window.matchMedia('(max-width: 900px)').matches; };

  // Bottom bar: 'birth' shows the side panel, anything else shows that tab.
  App.prototype.go = function (t) {
    this.state.onSide = t === 'birth';
    this.wrap.classList.toggle('msj-on-side', this.state.onSide);
    if (this.state.onSide) this.syncToggles();
    else this.setTab(t);
    window.scrollTo(0, 0);
  };

  App.prototype.say = function (msg, isError) {
    this.status.textContent = msg || '';
    this.status.classList.toggle('msj-error', !!isError);
  };

  App.prototype.autoTz = function () {
    var lat = parseFloat(this.f.lat.value), lon = parseFloat(this.f.lon.value);
    if (isFinite(lat) && isFinite(lon)) this.f.tz.value = guessTz(lat, lon);
  };

  App.prototype.setNow = function () {
    var now = nowIn(this.f.tz.value);
    this.f.date.value = now.date;
    this.f.time.value = now.time;
    this.calculate();
  };

  App.prototype.findPlace = function () {
    var self = this;
    var q = this.f.place.value.trim();
    if (!q) return;
    this.placeResults.innerHTML = '';
    this.say('Searching…');
    fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=' + encodeURIComponent(q), { headers: { 'Accept-Language': 'en' } })
      .then(function (r) { return r.json(); })
      .then(function (rows) {
        self.say(rows.length ? '' : 'No places found.');
        rows.forEach(function (r) {
          self.placeResults.appendChild(h('li', {}, [h('button', {
            type: 'button', text: r.display_name, onclick: function () {
              self.f.place.value = r.display_name.split(',').slice(0, 3).join(',');
              self.f.lat.value = (+r.lat).toFixed(4);
              self.f.lon.value = (+r.lon).toFixed(4);
              self.autoTz();
              self.placeResults.innerHTML = '';
              self.calculate();
            }
          })]));
        });
      })
      .catch(function () { self.say('Place search is unavailable — enter latitude and longitude.', true); });
  };

  App.prototype.readForm = function () {
    var d = this.f.date.value.split('-').map(Number);
    var t = this.f.time.value.split(':').map(Number);
    var lat = parseFloat(this.f.lat.value), lon = parseFloat(this.f.lon.value);
    if (d.length !== 3 || t.length < 2 || !isFinite(lat) || !isFinite(lon)) return null;
    return {
      name: this.f.name.value.trim(),
      year: d[0], month: d[1], day: d[2], hour: t[0], minute: t[1],
      place: this.f.place.value.trim(), lat: lat, lon: lon, tz: this.f.tz.value,
      ayanamsa: this.f.ayanamsa.value, dashaYear: this.f.dashaYear.value
    };
  };

  App.prototype.writeForm = function (b) {
    this.f.name.value = b.name || '';
    this.f.date.value = b.year + '-' + pad(b.month) + '-' + pad(b.day);
    this.f.time.value = pad(b.hour) + ':' + pad(b.minute);
    this.f.place.value = b.place || '';
    this.f.lat.value = b.lat;
    this.f.lon.value = b.lon;
    this.f.tz.value = b.tz;
  };

  App.prototype.calculate = function () {
    var input = this.readForm();
    if (!input) { this.say('Please complete date, time and coordinates.', true); return; }
    try {
      this.state.chart = J.chart(input);
      this.say('');
    } catch (e) {
      this.say('Could not calculate this chart: ' + e.message, true);
      return;
    }
    this.render();
  };

  App.prototype.setTab = function (t) { this.state.tab = t; this.syncToggles(); this.render(); };
  App.prototype.setStyle = function (s) { this.state.style = s; localStorage.setItem('msj-style', s); this.syncToggles(); this.render(); };

  App.prototype.syncToggles = function () {
    var st = this.state;
    [].forEach.call(this.tabs.children, function (b) { b.setAttribute('aria-selected', b.dataset.tab === st.tab); });
    [].forEach.call(this.styleToggle.children, function (b) { b.classList.toggle('is-on', b.dataset.style === st.style); });
    this.styleToggle.hidden = st.tab !== 'chart';
    if (this.mnav) [].forEach.call(this.mnav.children, function (b) {
      var on = st.onSide ? b.dataset.tab === 'birth' : b.dataset.tab === st.tab;
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  };

  App.prototype.render = function () {
    var c = this.state.chart;
    if (!c) return;
    var inp = c.input;
    this.title.innerHTML = '';
    this.title.appendChild(h('h2', { text: inp.name || 'Untitled chart' }));
    this.title.appendChild(h('p', {
      text: fmtDate(c.utcMs, inp.tz) + ' · ' + pad(inp.hour) + ':' + pad(inp.minute) + ' (' + inp.tz + ') · ' +
        (inp.place || (inp.lat.toFixed(2) + ', ' + inp.lon.toFixed(2))) + ' · ' + (inp.ayanamsa === 'lahiri-deva' ? 'Lahiri (deva.guru) ' : 'Lahiri ') + c.ayanamsaText
    }));
    this.body.innerHTML = '';
    var r = { chart: this.renderChart, dasha: this.renderDasha, panchang: this.renderPanchang, reading: this.renderReading }[this.state.tab];
    this.body.appendChild(r.call(this, c));
  };

  App.prototype.renderChart = function (c) {
    var draw = this.state.style === 'south' ? drawSouth : drawNorth;
    var charts = h('div', { class: 'msj-charts' }, [
      h('figure', {}, [draw(c, 'D1', 'Rāśi chart'), h('figcaption', { text: 'Rāśi · D1' })]),
      h('figure', {}, [draw(c, 'D9', 'Navāṁśa chart'), h('figcaption', { text: 'Navāṁśa · D9' })])
    ]);

    var rows = c.points.map(function (p) {
      var flags = [];
      if (p.retrograde && p.name !== 'Rahu' && p.name !== 'Ketu') flags.push('Retrograde');
      if (p.combust) flags.push('Combust');
      if (p.dignity) flags.push(p.dignity);
      if (p.gandanta) flags.push('Gaṇḍānta');
      return h('tr', {}, [
        h('th', { scope: 'row', text: p.name === 'Asc' ? 'Lagna' : p.name }),
        h('td', { text: p.signName }),
        h('td', { class: 'msj-num', text: p.degText }),
        h('td', { text: p.nakshatraName + ' ' + p.pada }),
        h('td', { text: p.nakshatraLord }),
        h('td', { class: 'msj-num', text: String(p.house) }),
        h('td', { text: p.navamsaName }),
        h('td', { class: 'msj-flags', text: flags.join(' · ') })
      ]);
    });
    var table = h('table', { class: 'msj-table' }, [
      h('thead', {}, h('tr', {}, ['Graha', 'Rāśi', 'Degree', 'Nakṣatra · pada', 'Nak. lord', 'House', 'Navāṁśa', ''].map(function (t) { return h('th', { scope: 'col', text: t }); }))),
      h('tbody', {}, rows)
    ]);

    var houses = h('table', { class: 'msj-table msj-houses' }, [
      h('thead', {}, h('tr', {}, ['Bhāva', 'Rāśi', 'Lord', 'Lord in'].map(function (t) { return h('th', { scope: 'col', text: t }); }))),
      h('tbody', {}, c.houses.map(function (hs) {
        var lord = c.points.filter(function (p) { return p.name === hs.lord; })[0];
        return h('tr', {}, [h('th', { scope: 'row', text: String(hs.house) }), h('td', { text: hs.signName }), h('td', { text: hs.lord }), h('td', { text: 'H' + lord.house + ' · ' + lord.signName })]);
      }))
    ]);

    return h('div', {}, [charts, h('div', { class: 'msj-scroll' }, table), h('p', { class: 'msj-legend', text: 'ᴿ retrograde · ᶜ combust · Whole-sign houses · Mean nodes' }), h('details', { class: 'msj-more' }, [h('summary', { text: 'House lords' }), houses])]);
  };

  App.prototype.renderDasha = function (c) {
    var tz = c.input.tz;
    var now = Date.now();
    var chain = J.currentDasha(c.dasha, now);
    var current = chain.length ? h('div', { class: 'msj-now' }, [
      h('span', { class: 'msj-kicker', text: 'Running now' }),
      h('p', { class: 'msj-big', text: chain.map(function (p) { return p.lord; }).join(' › ') }),
      h('p', { text: chain.map(function (p, i) { return ['Mahādaśā', 'Antardaśā', 'Pratyantardaśā'][i] + ' until ' + fmtDate(p.end, tz); }).join(' · ') })
    ]) : null;

    var list = h('div', { class: 'msj-dasha' }, c.dasha.periods.filter(function (p) { return p.end > c.utcMs; }).map(function (p) {
      var isNow = now >= p.start && now < p.end;
      return h('details', { class: isNow ? 'is-now' : '', open: isNow }, [
        h('summary', {}, [h('strong', { text: p.lord }), h('span', { text: fmtDate(Math.max(p.start, c.utcMs), tz) + ' – ' + fmtDate(p.end, tz) })]),
        h('ul', {}, p.sub.filter(function (a) { return a.end > c.utcMs; }).map(function (a) {
          var aNow = now >= a.start && now < a.end;
          return h('li', { class: aNow ? 'is-now' : '' }, [
            h('details', { open: aNow }, [
              h('summary', {}, [h('span', { text: p.lord + ' / ' + a.lord }), h('span', { text: fmtDate(Math.max(a.start, c.utcMs), tz) + ' – ' + fmtDate(a.end, tz) })]),
              h('ul', { class: 'msj-pd' }, a.sub.filter(function (x) { return x.end > c.utcMs; }).map(function (x) {
                var xNow = now >= x.start && now < x.end;
                return h('li', { class: xNow ? 'is-now' : '' }, [h('span', { text: x.lord }), h('span', { text: fmtDate(Math.max(x.start, c.utcMs), tz) })]);
              }))
            ])
          ]);
        }))
      ]);
    }));

    var balance = c.dasha.balanceYears;
    var y = Math.floor(balance), m = Math.floor((balance - y) * 12), d = Math.round(((balance - y) * 12 - m) * 30.44);
    return h('div', {}, [
      current,
      h('p', { class: 'msj-legend', text: 'Viṁśottarī · Moon in ' + c.points[2].nakshatraName + ' · balance of ' + c.dasha.firstLord + ' at birth: ' + y + 'y ' + m + 'm ' + d + 'd' }),
      list
    ]);
  };

  function panchangCard(title, p, tz) {
    function row(k, v, left) {
      return h('tr', {}, [h('th', { scope: 'row', text: k }), h('td', { text: v }), h('td', { class: 'msj-num', text: left != null ? left + '% left' : '' })]);
    }
    return h('div', { class: 'msj-card' }, [
      h('h3', { text: title }),
      h('table', { class: 'msj-table' }, h('tbody', {}, [
        row('Vāra', p.vara),
        row('Tithi', p.tithi.paksha + ' ' + p.tithi.name, p.tithi.left),
        row('Nakṣatra', p.nakshatra.name + ' ' + p.nakshatra.pada + ' (' + p.nakshatra.lord + ')', p.nakshatra.left),
        row('Yoga', p.yoga.name, p.yoga.left),
        row('Karaṇa', p.karana.name, p.karana.left),
        row('Moon · Sun', p.moonSign + ' · ' + p.sunSign),
        row('Sunrise · sunset', fmtTime(p.sunrise, tz) + ' · ' + fmtTime(p.sunset, tz))
      ]))
    ]);
  }

  App.prototype.renderPanchang = function (c) {
    var pl = CFG.defaultPlace;
    var today = J.panchang(Date.now(), pl.lat, pl.lon, pl.tz);
    return h('div', { class: 'msj-cards' }, [
      panchangCard('At birth', c.panchang, c.input.tz),
      panchangCard('Today · ' + pl.label.split(',')[0] + ' · ' + J.formatInZone(Date.now(), pl.tz, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), today, pl.tz)
    ]);
  };

  App.prototype.renderReading = function (c) {
    var self = this;
    var asc = c.points[0], moon = c.points[2], sun = c.points[1];
    var chain = J.currentDasha(c.dasha, Date.now());
    var blocks = [
      ['Lagna in ' + asc.signName, (TEXTS.lagna || {})[asc.signName]],
      ['Moon in ' + moon.signName, (TEXTS.moonSign || {})[moon.signName]],
      ['Janma nakṣatra · ' + moon.nakshatraName + ' ' + moon.pada, (TEXTS.nakshatra || {})[moon.nakshatraName]],
      ['Sun in ' + sun.signName + ' · ' + sun.nakshatraName, null]
    ];
    if (chain[0]) blocks.push([chain[0].lord + ' Mahādaśā (until ' + fmtDate(chain[0].end, c.input.tz) + ')', (TEXTS.dasha || {})[chain[0].lord]]);
    if (chain[1]) blocks.push([chain[1].lord + ' Antardaśā (until ' + fmtDate(chain[1].end, c.input.tz) + ')', (TEXTS.dasha || {})[chain[1].lord]]);

    var text = blocks.map(function (b) { return b[0] + (b[1] ? '\n' + b[1] : ''); }).join('\n\n');
    return h('div', { class: 'msj-reading' }, blocks.map(function (b) {
      return h('section', {}, [h('h3', { text: b[0] }), b[1] ? h('p', { text: b[1] }) : null]);
    }).concat([
      h('div', { class: 'msj-actions' }, [h('button', {
        type: 'button', class: 'msj-btn msj-btn-ghost', text: 'Add to notes', onclick: function () {
          self.f.notes.value = (self.f.notes.value ? self.f.notes.value + '\n\n' : '') + text;
          self.say('Reading added to notes — remember to save.');
        }
      })])
    ]));
  };

  // ---------- saved charts ----------

  App.prototype.refreshSaved = function () {
    var self = this;
    return store.list().then(function (list) { self.state.saved = list; self.renderSaved(); })
      .catch(function (e) { self.say('Could not load saved charts: ' + e.message, true); });
  };

  App.prototype.renderSaved = function () {
    var self = this;
    var q = this.savedFilter.value.trim().toLowerCase();
    var cur = this.state.current && this.state.current.id;
    this.savedList.innerHTML = '';
    var list = this.state.saved.filter(function (s) { return !q || (s.name || '').toLowerCase().indexOf(q) >= 0; })
      .sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
    if (!list.length) this.savedList.appendChild(h('li', { class: 'msj-empty', text: q ? 'No matches.' : 'No saved charts yet.' }));
    list.forEach(function (s) {
      var b = s.birth;
      self.savedList.appendChild(h('li', { class: s.id === cur ? 'is-on' : '' }, h('button', {
        type: 'button', onclick: function () { self.open(s); }
      }, [h('strong', { text: s.name || 'Untitled' }), h('span', { text: b.day + '/' + b.month + '/' + b.year + ' · ' + (b.place || '').split(',')[0] })])));
    });
  };

  App.prototype.open = function (s) {
    this.state.current = s;
    this.writeForm(s.birth);
    this.f.notes.value = s.notes || '';
    this.calculate();
    this.renderSaved();
    this.reveal();
  };

  // On narrow screens bring the chart into view: switch away from the birth panel on the
  // app page, or scroll up to it in the shortcode layout.
  App.prototype.reveal = function () {
    if (this.isPhone()) this.go(this.state.tab);
    else if (window.matchMedia('(max-width: 900px)').matches) this.title.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  App.prototype.save = function () {
    var self = this;
    var birth = this.readForm();
    if (!birth) { this.say('Please complete date, time and coordinates.', true); return; }
    var rec = { id: this.state.current && this.state.current.id, name: birth.name || 'Untitled', birth: birth, notes: this.f.notes.value };
    this.say('Saving…');
    store.save(rec).then(function (saved) {
      self.state.current = saved;
      self.say('Saved.');
      return self.refreshSaved();
    }).catch(function (e) { self.say('Could not save: ' + e.message, true); });
  };

  App.prototype.remove = function () {
    var self = this;
    var cur = this.state.current;
    if (!cur || !cur.id) { this.say('This chart is not saved.'); return; }
    if (!window.confirm('Delete the chart for ' + (cur.name || 'Untitled') + '?')) return;
    store.remove(cur.id).then(function () {
      self.say('Deleted.');
      self.reset();
      return self.refreshSaved();
    }).catch(function (e) { self.say('Could not delete: ' + e.message, true); });
  };

  App.prototype.reset = function () {
    this.state.current = null;
    this.f.name.value = '';
    this.f.notes.value = '';
    this.f.place.value = CFG.defaultPlace.label;
    this.f.lat.value = CFG.defaultPlace.lat;
    this.f.lon.value = CFG.defaultPlace.lon;
    this.f.tz.value = CFG.defaultPlace.tz;
    this.setNow();
    this.renderSaved();
  };

  function boot() {
    [].forEach.call(document.querySelectorAll('[data-msj-app]'), function (el) {
      if (!el.__msj) el.__msj = new App(el);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
