/* Suche über Einträge, Kontakte und Bereiche – inkl. Jahreszeiten/Monaten ("Frühling", "april"). */
(function () {
  'use strict';

  const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const SEASONS = {
    fruehling: { label: 'Frühling', months: [3, 4, 5] },
    fruehjahr: { label: 'Frühjahr', months: [3, 4, 5] },
    sommer: { label: 'Sommer', months: [6, 7, 8] },
    herbst: { label: 'Herbst', months: [9, 10, 11] },
    winter: { label: 'Winter', months: [12, 1, 2] },
  };
  const TYPE_WORDS = {
    note: ['notiz', 'wissen', 'info'],
    task: ['aufgabe', 'todo', 'erledigen'],
    device: ['gerät', 'geraet', 'anleitung', 'garantie', 'handbuch'],
    meter: ['zähler', 'zaehler', 'zählerstand', 'ablesung'],
  };

  function norm(s) {
    return String(s || '').toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  }

  // Erkennt Jahreszeit, Monat oder "jetzt" in einem Suchwort.
  function timeToken(token) {
    if (SEASONS[token]) return SEASONS[token];
    if (token === 'jetzt' || token === 'aktuell') {
      const m = new Date().getMonth() + 1;
      return { label: MONTH_NAMES[m - 1], months: [m] };
    }
    if (token.length >= 3) {
      const i = MONTH_NAMES.findIndex((n) => norm(n).startsWith(token));
      if (i >= 0) return { label: MONTH_NAMES[i], months: [i + 1] };
    }
    return null;
  }

  function entryFields(e, store) {
    const area = store.getArea(e.areaId);
    const contacts = (e.contactIds || []).map((id) => store.getContact(id)).filter(Boolean);
    return [
      [e.title, 6],
      [(e.tags || []).join(' '), 4],
      [area ? area.name + ' ' + (area.keywords || []).join(' ') : '', 3],
      [[e.manufacturer, e.model, e.serial, e.dealer, e.meterNo].filter(Boolean).join(' '), 3],
      [contacts.map((c) => [c.name, c.company, c.trade].join(' ')).join(' '), 2],
      [(TYPE_WORDS[e.type] || []).join(' '), 2],
      [e.text, 1],
      [(e.files || []).map((f) => f.name).join(' '), 1],
    ].map(([t, w]) => [norm(t), w]);
  }

  function contactFields(c, store) {
    const areas = (c.areaIds || []).map((id) => store.getArea(id)).filter(Boolean);
    return [
      [c.name, 6],
      [c.trade, 5],
      [c.company, 4],
      [areas.map((a) => a.name + ' ' + (a.keywords || []).join(' ')).join(' '), 2],
      ['kontakt handwerker firma', 1],
      [[c.notes, c.phone, c.email, c.address].join(' '), 1],
    ].map(([t, w]) => [norm(t), w]);
  }

  // Alle Suchwörter müssen irgendwo treffen (UND), die Gewichte ergeben die Reihenfolge.
  function scoreFields(fields, tokens, item, timeHits) {
    let total = 0;
    for (const t of tokens) {
      let best = 0;
      for (const [text, w] of fields) {
        if (text && text.includes(t)) best = Math.max(best, w);
      }
      const time = timeHits.get(t);
      if (time && item && item.type === 'task' && (item.months || []).some((m) => time.months.includes(m))) best = Math.max(best, 5);
      if (!best) return 0;
      total += best;
    }
    return total;
  }

  function search(query, store) {
    const tokens = norm(query).split(/[\s,]+/).filter((t) => t.length >= 2);
    if (!tokens.length) return null;

    const timeHits = new Map();
    tokens.forEach((t) => { const hit = timeToken(t); if (hit) timeHits.set(t, hit); });

    const areas = store.getAreas().filter((a) => {
      const text = norm(a.name + ' ' + (a.keywords || []).join(' '));
      return tokens.every((t) => text.includes(t));
    });

    const results = [];
    store.getEntries().forEach((e) => {
      const score = scoreFields(entryFields(e, store), tokens, e, timeHits);
      if (score) results.push({ kind: 'entry', item: e, score });
    });
    store.getContacts().forEach((c) => {
      const score = scoreFields(contactFields(c, store), tokens, null, timeHits);
      if (score) results.push({ kind: 'contact', item: c, score });
    });
    results.sort((a, b) => b.score - a.score || (a.item.title || a.item.name).localeCompare(b.item.title || b.item.name, 'de'));

    const time = timeHits.size ? [...timeHits.values()][0] : null;
    return { areas, results, time };
  }

  window.Search = { search, norm, MONTH_NAMES, SEASONS };
})();
