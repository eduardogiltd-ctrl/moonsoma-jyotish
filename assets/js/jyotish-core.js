/*
 * Moon & Soma Jyotish — calculation core.
 *
 * Sidereal (Lahiri / Chitrapaksha) positions, whole-sign houses, D1/D9,
 * nakshatras, dignities, Vimshottari dasha and Panchang.
 *
 * Depends on astronomy-engine (global `Astronomy` in the browser, or
 * require('astronomy-engine') in Node). Works as a browser global
 * (`MSJyotish`) or a CommonJS module for tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require(process.env.MSJ_ASTRONOMY_PATH || 'astronomy-engine'));
  } else {
    root.MSJyotish = factory(root.Astronomy);
  }
})(typeof self !== 'undefined' ? self : this, function (A) {
  'use strict';

  var DEG = Math.PI / 180;
  var NAK_SPAN = 360 / 27;   // 13°20'
  var PADA_SPAN = NAK_SPAN / 4;
  var DAY_MS = 86400000;

  var SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
  var SIGNS_SA = ['Meṣa', 'Vṛṣabha', 'Mithuna', 'Karka', 'Siṁha', 'Kanyā',
    'Tulā', 'Vṛścika', 'Dhanu', 'Makara', 'Kumbha', 'Mīna'];
  var SIGN_LORDS = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
    'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'];

  var NAKSHATRAS = ['Aśvinī', 'Bharaṇī', 'Kṛttikā', 'Rohiṇī', 'Mṛgaśirā', 'Ārdrā',
    'Punarvasu', 'Puṣya', 'Āśleṣā', 'Maghā', 'Pūrva Phalgunī', 'Uttara Phalgunī',
    'Hasta', 'Citrā', 'Svātī', 'Viśākhā', 'Anurādhā', 'Jyeṣṭhā', 'Mūla',
    'Pūrva Āṣāḍhā', 'Uttara Āṣāḍhā', 'Śravaṇa', 'Dhaniṣṭhā', 'Śatabhiṣā',
    'Pūrva Bhādrapadā', 'Uttara Bhādrapadā', 'Revatī'];

  // Vimshottari order, starting from Aśvinī's lord.
  var DASHA_LORDS = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
  var DASHA_YEARS = { Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17 };
  // Daśā year lengths (days).
  var YEARS = { gregorian: 365.2425, sidereal: 365.256363 };
  // Ayanāṃśas. Fixed ones are mean values at J2000 (TT) taken from Swiss Ephemeris
  // and carried with general precession; True Citrā follows the star Spica.
  // All agree with Swiss Ephemeris to within 0.3″ over 1900–2100.
  var AYANAMSAS = {
    lahiri: { label: 'Lahiri', short: 'Lahiri', j2000: 23.857092325 },
    'true-citra': { label: 'True Citrā Pakṣa (deva.guru default)', short: 'True Citrā', star: true },
    raman: { label: 'Raman', short: 'Raman', j2000: 22.410791012 },
    kp: { label: 'Krishnamurti (KP)', short: 'KP', j2000: 23.760240012 },
    yukteshwar: { label: 'Yukteshwar', short: 'Yukteshwar', j2000: 22.478803 }
  };
  // Older saved charts: deva.guru's "Lahiri" is in fact True Citrā.
  var AYANAMSA_ALIASES = { 'lahiri-deva': 'true-citra' };
  function ayanamsaKey(key) {
    key = AYANAMSA_ALIASES[key] || key;
    return AYANAMSAS[key] ? key : 'lahiri';
  }

  // Spica (α Virginis), ICRS J2000 with proper motion in mas/yr (μα·cosδ, μδ).
  var SPICA = { ra: (13 + 25 / 60 + 11.57937 / 3600) * 15, dec: -(11 + 9 / 60 + 40.7501 / 3600), pmRa: -42.35, pmDec: -30.67 };
  var LIGHT_AU_PER_DAY = 173.1446327;

  var PLANETS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
  var ABBR = { Asc: 'As', Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me', Jupiter: 'Ju', Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke' };

  // sign index (0 = Aries) for exaltation; debilitation is +6.
  var EXALT = { Sun: 0, Moon: 1, Mars: 9, Mercury: 5, Jupiter: 3, Venus: 11, Saturn: 6, Rahu: 1, Ketu: 7 };
  var MOOLATRIKONA = {
    Sun: [4, 0, 20], Moon: [1, 3, 30], Mars: [0, 0, 12], Mercury: [5, 15, 20],
    Jupiter: [8, 0, 10], Venus: [6, 0, 15], Saturn: [10, 0, 20]
  };
  var OWN = {
    Sun: [4], Moon: [3], Mars: [0, 7], Mercury: [2, 5], Jupiter: [8, 11], Venus: [1, 6], Saturn: [9, 10]
  };
  // Combustion orbs [direct, retrograde].
  var COMBUST = { Moon: [12, 12], Mars: [17, 17], Mercury: [14, 12], Jupiter: [11, 11], Venus: [10, 8], Saturn: [15, 15] };

  var VARAS = ['Ravivāra (Sun)', 'Somavāra (Moon)', 'Maṅgalavāra (Mars)', 'Budhavāra (Mercury)',
    'Guruvāra (Jupiter)', 'Śukravāra (Venus)', 'Śanivāra (Saturn)'];
  var TITHIS = ['Pratipadā', 'Dvitīyā', 'Tṛtīyā', 'Caturthī', 'Pañcamī', 'Ṣaṣṭhī', 'Saptamī',
    'Aṣṭamī', 'Navamī', 'Daśamī', 'Ekādaśī', 'Dvādaśī', 'Trayodaśī', 'Caturdaśī'];
  var YOGAS = ['Viṣkumbha', 'Prīti', 'Āyuṣmān', 'Saubhāgya', 'Śobhana', 'Atigaṇḍa', 'Sukarmā',
    'Dhṛti', 'Śūla', 'Gaṇḍa', 'Vṛddhi', 'Dhruva', 'Vyāghāta', 'Harṣaṇa', 'Vajra', 'Siddhi',
    'Vyatīpāta', 'Varīyān', 'Parigha', 'Śiva', 'Siddha', 'Sādhya', 'Śubha', 'Śukla', 'Brahma',
    'Indra', 'Vaidhṛti'];
  var KARANAS_MOVABLE = ['Bava', 'Bālava', 'Kaulava', 'Taitila', 'Gara', 'Vaṇija', 'Viṣṭi (Bhadrā)'];

  function norm360(x) { x %= 360; return x < 0 ? x + 360 : x; }

  function dms(deg) {
    var d = Math.floor(deg);
    var mf = (deg - d) * 60;
    var m = Math.floor(mf);
    var s = Math.round((mf - m) * 60);
    if (s === 60) { s = 0; m += 1; }
    if (m === 60) { m = 0; d += 1; }
    return d + '°' + (m < 10 ? '0' : '') + m + '′' + (s < 10 ? '0' : '') + s + '″';
  }

  // ---------- time zones ----------

  // Offset (minutes, east positive) of an IANA zone at a UTC instant.
  function tzOffsetMinutes(tz, utcMs) {
    var f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    var p = {};
    f.formatToParts(new Date(utcMs)).forEach(function (x) { p[x.type] = x.value; });
    var asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000);
  }

  // Local wall-clock time in `tz` -> UTC milliseconds.
  function zonedToUtc(y, mo, d, h, mi, tz) {
    var guess = Date.UTC(y, mo - 1, d, h, mi);
    var off1 = tzOffsetMinutes(tz, guess - 0);
    var utc = guess - off1 * 60000;
    var off2 = tzOffsetMinutes(tz, utc);
    if (off2 !== off1) utc = guess - off2 * 60000;
    return utc;
  }

  function formatInZone(utcMs, tz, opts) {
    var o = Object.assign({ timeZone: tz }, opts || { dateStyle: 'medium', timeStyle: 'short' });
    return new Intl.DateTimeFormat('en-GB', o).format(new Date(utcMs));
  }

  // ---------- astronomy ----------

  // IAU 1976 general precession in longitude since J2000, in degrees.
  function precessionSinceJ2000(time) {
    var T = time.tt / 36525;
    return (5029.0966 * T + 1.11113 * T * T - 0.000006 * T * T * T) / 3600;
  }

  // Lahiri (Chitrapaksha) mean ayanamsa, as in Swiss Ephemeris.
  function lahiriMean(jdTT) {
    return AYANAMSAS.lahiri.j2000 + precessionSinceJ2000({ tt: jdTT - 2451545.0 });
  }

  // True Citrā: Spica's apparent longitude (true ecliptic and equinox of date,
  // with annual aberration, as Swiss Ephemeris does) minus 180°.
  function spicaAyanamsaTrue(time) {
    var yrs = time.tt / 365.25;
    var dec = (SPICA.dec + SPICA.pmDec * yrs / 3.6e6) * DEG;
    var ra = (SPICA.ra + SPICA.pmRa * yrs / 3.6e6 / Math.cos(SPICA.dec * DEG)) * DEG;
    var ev = A.HelioState(A.Body.Earth, time);
    var v = new A.Vector(
      Math.cos(dec) * Math.cos(ra) + ev.vx / LIGHT_AU_PER_DAY,
      Math.cos(dec) * Math.sin(ra) + ev.vy / LIGHT_AU_PER_DAY,
      Math.sin(dec) + ev.vz / LIGHT_AU_PER_DAY, time);
    var e = A.RotateVector(A.Rotation_EQJ_ECT(time), v);
    return norm360(Math.atan2(e.y, e.x) / DEG - 180);
  }

  // Ayanāṃśa measured from the true equinox of date (the one tropical
  // positions use), in degrees. The mean value is this minus Δψ.
  function ayanamsaTrue(key, time, et) {
    var a = AYANAMSAS[ayanamsaKey(key)];
    if (a.star) return spicaAyanamsaTrue(time);
    return a.j2000 + precessionSinceJ2000(time) + et.dpsi / 3600;
  }

  function tropicalLon(body, time) {
    if (body === 'Sun') return A.SunPosition(time).elon;
    if (body === 'Moon') return A.EclipticGeoMoon(time).lon;
    return A.Ecliptic(A.GeoVector(A.Body[body], time, true)).elon;
  }

  function meanNode(time) {
    var T = time.tt / 36525;
    return norm360(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + T * T * T / 467441 - T * T * T * T / 60616000);
  }

  function signedDiff(a, b) { var d = norm360(a - b); return d > 180 ? d - 360 : d; }

  function describePoint(name, lon, extra) {
    var sign = Math.floor(lon / 30);
    var deg = lon - sign * 30;
    var nak = Math.floor(lon / NAK_SPAN);
    var pada = Math.floor((lon - nak * NAK_SPAN) / PADA_SPAN) + 1;
    var navamsa = Math.floor(lon * 9 / 30) % 12;
    var p = {
      name: name, abbr: ABBR[name] || name.slice(0, 2), lon: lon, sign: sign, signName: SIGNS[sign],
      deg: deg, degText: dms(deg), nakshatra: nak, nakshatraName: NAKSHATRAS[nak], pada: pada,
      nakshatraLord: DASHA_LORDS[nak % 9], navamsa: navamsa, navamsaName: SIGNS[navamsa]
    };
    return Object.assign(p, extra || {});
  }

  function dignity(name, sign, deg) {
    if (!(name in EXALT)) return '';
    if (EXALT[name] === sign) return 'Exalted';
    if ((EXALT[name] + 6) % 12 === sign) return 'Debilitated';
    var mt = MOOLATRIKONA[name];
    if (mt && mt[0] === sign && deg >= mt[1] && deg < mt[2]) return 'Moolatrikona';
    if (OWN[name] && OWN[name].indexOf(sign) >= 0) return 'Own sign';
    return '';
  }

  // Water/fire sign junctions (Cancer–Leo, Scorpio–Sagittarius, Pisces–Aries),
  // within one pada (3°20′) either side.
  function gandanta(lon) {
    var x = lon % 120;
    return x < PADA_SPAN || x > 120 - PADA_SPAN;
  }

  function ascendant(time, latDeg, lonDeg) {
    var et = A.e_tilt(time);
    var ramc = norm360(A.SiderealTime(time) * 15 + lonDeg) * DEG;
    var eps = et.tobl * DEG;
    var phi = latDeg * DEG;
    var asc = Math.atan2(Math.cos(ramc), -(Math.sin(ramc) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps)));
    var mc = Math.atan2(Math.sin(ramc), Math.cos(ramc) * Math.cos(eps));
    return { asc: norm360(asc / DEG), mc: norm360(mc / DEG) };
  }

  // All sidereal positions for a UTC instant.
  function positions(utcMs, lat, lon, key) {
    var time = A.MakeTime(new Date(utcMs));
    var et = A.e_tilt(time);
    // Planets and lagna are apparent (true equinox), so they take the true
    // ayanāṃśa; the mean node takes the mean one. The mean value is the one
    // shown, as in Swiss Ephemeris and deva.guru.
    var pAyan = ayanamsaTrue(key, time, et);
    var ayanamsa = pAyan - et.dpsi / 3600;
    var res = { ayanamsa: ayanamsa, ayanamsaText: dms(ayanamsa), ayanamsaKey: ayanamsaKey(key), planets: {} };

    ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'].forEach(function (b) {
      var l = tropicalLon(b, time);
      var speed = signedDiff(tropicalLon(b, time.AddDays(0.5)), tropicalLon(b, time.AddDays(-0.5)));
      res.planets[b] = { tropical: l, sidereal: norm360(l - pAyan), speed: speed };
    });
    var node = norm360(meanNode(time) - ayanamsa);
    res.planets.Rahu = { sidereal: node, speed: -0.0529539 };
    res.planets.Ketu = { sidereal: norm360(node + 180), speed: -0.0529539 };

    if (lat != null && lon != null) {
      var a = ascendant(time, lat, lon);
      res.asc = norm360(a.asc - pAyan);
      res.mc = norm360(a.mc - pAyan);
    }
    return res;
  }

  // ---------- dasha ----------

  function subPeriods(lord, startMs, years, depth, addYears) {
    var i = DASHA_LORDS.indexOf(lord);
    var out = [];
    var t = startMs;
    for (var k = 0; k < 9; k++) {
      var l = DASHA_LORDS[(i + k) % 9];
      var y = years * DASHA_YEARS[l] / 120;
      var p = { lord: l, start: t, end: addYears(t, y), years: y };
      if (depth > 1) p.sub = subPeriods(l, t, y, depth - 1, addYears);
      out.push(p);
      t = p.end;
    }
    return out;
  }

  function vimshottari(moonLon, birthMs, yearKey) {
    var yearDays = YEARS[yearKey] || YEARS.gregorian;
    function addYears(ms, years) { return ms + years * yearDays * DAY_MS; }
    var nak = Math.floor(moonLon / NAK_SPAN);
    var frac = (moonLon - nak * NAK_SPAN) / NAK_SPAN;
    var first = DASHA_LORDS[nak % 9];
    var start = addYears(birthMs, -frac * DASHA_YEARS[first]);
    var i = DASHA_LORDS.indexOf(first);
    var out = [];
    var t = start;
    // Two full cycles (240 years) covers any lifetime from the pre-birth start.
    for (var k = 0; k < 11; k++) {
      var l = DASHA_LORDS[(i + k) % 9];
      var y = DASHA_YEARS[l];
      out.push({ lord: l, start: t, end: addYears(t, y), years: y, sub: subPeriods(l, t, y, 2, addYears) });
      t = addYears(t, y);
    }
    return { balanceYears: (1 - frac) * DASHA_YEARS[first], firstLord: first, periods: out };
  }

  function currentDasha(dasha, atMs) {
    var chain = [];
    var list = dasha.periods;
    while (list) {
      var hit = null;
      for (var i = 0; i < list.length; i++) {
        if (atMs >= list[i].start && atMs < list[i].end) { hit = list[i]; break; }
      }
      if (!hit) break;
      chain.push(hit);
      list = hit.sub;
    }
    return chain;
  }

  // ---------- panchang ----------

  function sunEvents(utcMs, lat, lon) {
    var obs = new A.Observer(lat, lon, 0);
    var dayStart = A.MakeTime(new Date(utcMs - DAY_MS));
    var rise = A.SearchRiseSet(A.Body.Sun, obs, +1, dayStart, 2);
    // Last sunrise at or before the moment.
    var lastRise = null;
    var probe = rise;
    var guard = 0;
    while (probe && probe.date.getTime() <= utcMs && guard++ < 3) {
      lastRise = probe;
      probe = A.SearchRiseSet(A.Body.Sun, obs, +1, probe.AddDays(0.01), 2);
    }
    var set = lastRise ? A.SearchRiseSet(A.Body.Sun, obs, -1, lastRise, 1) : null;
    return {
      sunrise: lastRise ? lastRise.date.getTime() : null,
      sunset: set ? set.date.getTime() : null,
      nextSunrise: probe ? probe.date.getTime() : null
    };
  }

  function panchang(utcMs, lat, lon, tz, pos) {
    pos = pos || positions(utcMs, lat, lon, 'lahiri');
    var sun = pos.planets.Sun.sidereal;
    var moon = pos.planets.Moon.sidereal;
    var elong = norm360(moon - sun);

    var tIdx = Math.floor(elong / 12);           // 0..29
    var paksha = tIdx < 15 ? 'Śukla' : 'Kṛṣṇa';
    var tNum = tIdx % 15;
    var tithiName = tIdx === 14 ? 'Pūrṇimā' : tIdx === 29 ? 'Amāvāsyā' : TITHIS[tNum];

    var kIdx = Math.floor(elong / 6);            // 0..59
    var karana;
    if (kIdx === 0) karana = 'Kiṁstughna';
    else if (kIdx >= 57) karana = ['Śakuni', 'Catuṣpāda', 'Nāga'][kIdx - 57];
    else karana = KARANAS_MOVABLE[(kIdx - 1) % 7];

    var ySum = norm360(sun + moon);
    var yIdx = Math.floor(ySum / NAK_SPAN);
    var nIdx = Math.floor(moon / NAK_SPAN);

    var ev = (lat != null) ? sunEvents(utcMs, lat, lon) : {};
    // The Vedic day begins at sunrise.
    var dayRef = ev.sunrise || utcMs;
    var wd = new Intl.DateTimeFormat('en-US', { timeZone: tz || 'UTC', weekday: 'short' }).format(new Date(dayRef));
    var vIdx = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);

    function left(x, span) { return Math.round((1 - (x % span) / span) * 100); }

    return {
      vara: VARAS[vIdx],
      tithi: { index: tIdx + 1, paksha: paksha, name: tithiName, left: left(elong, 12) },
      nakshatra: { index: nIdx + 1, name: NAKSHATRAS[nIdx], pada: Math.floor((moon % NAK_SPAN) / PADA_SPAN) + 1, lord: DASHA_LORDS[nIdx % 9], left: left(moon, NAK_SPAN) },
      yoga: { index: yIdx + 1, name: YOGAS[yIdx], left: left(ySum, NAK_SPAN) },
      karana: { index: kIdx + 1, name: karana, left: left(elong, 6) },
      moonSign: SIGNS[Math.floor(moon / 30)],
      sunSign: SIGNS[Math.floor(sun / 30)],
      sunrise: ev.sunrise, sunset: ev.sunset,
      ayanamsa: pos.ayanamsaText
    };
  }

  // ---------- full chart ----------

  /*
   * input: { name, year, month, day, hour, minute, tz, lat, lon }
   * `tz` is an IANA zone name; `utcOffset` (minutes) overrides it when set.
   */
  function chart(input) {
    var utcMs = (input.utcOffset != null && input.utcOffset !== '')
      ? Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute) - Number(input.utcOffset) * 60000
      : zonedToUtc(input.year, input.month, input.day, input.hour, input.minute, input.tz);

    var pos = positions(utcMs, input.lat, input.lon, input.ayanamsa);
    var ascSign = Math.floor(pos.asc / 30);
    var sunLon = pos.planets.Sun.sidereal;

    var points = [describePoint('Asc', pos.asc, { house: 1, gandanta: gandanta(pos.asc) })];
    PLANETS.forEach(function (n) {
      var p = pos.planets[n];
      var d = describePoint(n, p.sidereal);
      d.retrograde = (n === 'Rahu' || n === 'Ketu') ? true : p.speed < 0;
      d.speed = p.speed;
      d.house = ((d.sign - ascSign + 12) % 12) + 1;
      d.dignity = dignity(n, d.sign, d.deg);
      if (COMBUST[n]) {
        var orb = COMBUST[n][d.retrograde ? 1 : 0];
        d.combust = Math.abs(signedDiff(p.sidereal, sunLon)) < orb;
      }
      d.signLord = SIGN_LORDS[d.sign];
      d.gandanta = gandanta(p.sidereal);
      points.push(d);
    });

    var moonLon = pos.planets.Moon.sidereal;
    var dasha = vimshottari(moonLon, utcMs, input.dashaYear);

    var houses = [];
    for (var h = 0; h < 12; h++) {
      var s = (ascSign + h) % 12;
      houses.push({ house: h + 1, sign: s, signName: SIGNS[s], lord: SIGN_LORDS[s] });
    }

    return {
      input: input,
      utcMs: utcMs,
      ayanamsa: pos.ayanamsa,
      ayanamsaText: pos.ayanamsaText,
      ascSign: ascSign,
      points: points,
      houses: houses,
      dasha: dasha,
      panchang: panchang(utcMs, input.lat, input.lon, input.tz, pos)
    };
  }

  // Groups points by sign for a given varga ('D1' | 'D9').
  function bySign(points, varga) {
    var out = [[], [], [], [], [], [], [], [], [], [], [], []];
    points.forEach(function (p) {
      out[varga === 'D9' ? p.navamsa : p.sign].push(p);
    });
    return out;
  }

  return {
    SIGNS: SIGNS, SIGNS_SA: SIGNS_SA, SIGN_LORDS: SIGN_LORDS, NAKSHATRAS: NAKSHATRAS,
    DASHA_LORDS: DASHA_LORDS, AYANAMSAS: AYANAMSAS, YEARS: YEARS, DASHA_YEARS: DASHA_YEARS, PLANETS: PLANETS, ABBR: ABBR,
    norm360: norm360, dms: dms,
    tzOffsetMinutes: tzOffsetMinutes, zonedToUtc: zonedToUtc, formatInZone: formatInZone,
    lahiriMean: lahiriMean, ayanamsaKey: ayanamsaKey, positions: positions, ascendant: ascendant,
    vimshottari: vimshottari, currentDasha: currentDasha,
    panchang: panchang, chart: chart, bySign: bySign
  };
});
