/* Rendering der Ansichten. Liest nur aus Store/Search, Ereignisse verdrahtet main.js. */
(function () {
  'use strict';

  const store = window.Store;
  const { MONTH_NAMES } = window.Search;

  const TYPES = {
    note: { icon: '📝', label: 'Notiz' },
    task: { icon: '✅', label: 'Aufgabe' },
    device: { icon: '🔧', label: 'Gerät' },
    meter: { icon: '📈', label: 'Zähler' },
  };

  const $ = (id) => document.getElementById(id);

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  // Text mit Zeilenumbrüchen und klickbaren Links.
  function richText(s) {
    return esc(s)
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
      .replace(/\n/g, '<br>');
  }
  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
    return isNaN(d) ? '' : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function fmtSize(bytes) {
    if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
  }
  function fmtNum(n, digits = 2) {
    return Number(n).toLocaleString('de-DE', { maximumFractionDigits: digits });
  }
  const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

  // [3,4,5] -> "März–Mai", [4,11] -> "April, November"
  function monthsLabel(months) {
    const sorted = [...(months || [])].sort((a, b) => a - b);
    if (!sorted.length) return '';
    if (sorted.length === 12) return 'jeden Monat';
    const runs = [];
    sorted.forEach((m) => {
      const last = runs[runs.length - 1];
      if (last && m === last[1] + 1) last[1] = m;
      else runs.push([m, m]);
    });
    // Dezember–Februar über den Jahreswechsel zusammenfassen
    if (runs.length > 1 && runs[0][0] === 1 && runs[runs.length - 1][1] === 12) {
      runs[runs.length - 1][1] = runs.shift()[1];
    }
    return runs.map(([a, b]) => (a === b ? MONTH_NAMES[a - 1] : MONTH_NAMES[a - 1] + '–' + MONTH_NAMES[b - 1])).join(', ');
  }

  function areaBadge(areaId) {
    const a = store.getArea(areaId);
    return a ? `<span class="area-badge" data-accent="${esc(a.color)}">${esc(a.icon)} ${esc(a.name)}</span>` : '';
  }

  function snippet(text, len = 110) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    return t.length > len ? t.slice(0, len - 1) + '…' : t;
  }

  // ---- Dateien: Blob-URLs aus IndexedDB nachladen ----
  const urlCache = new Map();
  async function fileUrl(id) {
    if (urlCache.has(id)) return urlCache.get(id);
    const rec = await store.getFile(id);
    if (!rec) return null;
    const url = URL.createObjectURL(rec.blob);
    urlCache.set(id, url);
    return url;
  }
  function hydrateImages(root) {
    root.querySelectorAll('img[data-file-id]').forEach(async (img) => {
      const url = await fileUrl(img.dataset.fileId);
      if (url) img.src = url;
      else img.closest('.file-tile')?.classList.add('missing');
    });
  }

  // ---- Karten ----
  function entryMeta(e) {
    const parts = [];
    if (e.type === 'task' && e.months?.length) parts.push('📅 ' + monthsLabel(e.months));
    if (e.type === 'device' && (e.manufacturer || e.model)) parts.push([e.manufacturer, e.model].filter(Boolean).join(' '));
    if (e.type === 'meter') {
      const last = (e.readings || [])[e.readings.length - 1];
      parts.push(last ? `Letzter Stand ${fmtNum(last.value, 3)} ${esc(e.unit || '')} am ${fmtDate(last.date)}` : 'Noch keine Ablesung');
    }
    if (e.files?.length) parts.push('📎 ' + e.files.length);
    return parts.join(' · ');
  }

  function entryCard(e, { showArea = true } = {}) {
    const t = TYPES[e.type] || TYPES.note;
    const thumb = (e.files || []).find((f) => f.type.startsWith('image/'));
    return `<li>
      <button type="button" class="item-card card-btn" data-action="open-entry" data-id="${esc(e.id)}">
        <span class="card-icon" aria-hidden="true">${t.icon}</span>
        <span class="card-body">
          <span class="item-title">${esc(e.title)}</span>
          <span class="item-meta">${showArea ? areaBadge(e.areaId) : ''}<span class="visually-hidden">${t.label}. </span>${esc(entryMeta(e))}</span>
          ${e.text ? `<span class="item-note">${esc(snippet(e.text))}</span>` : ''}
        </span>
        ${thumb ? `<img class="card-thumb" data-file-id="${esc(thumb.id)}" alt="" />` : ''}
      </button>
    </li>`;
  }

  function contactCard(c) {
    const sub = [c.trade, c.company].filter(Boolean).join(' · ');
    return `<li class="contact-row">
      <button type="button" class="item-card card-btn" data-action="open-contact" data-id="${esc(c.id)}">
        <span class="card-icon" aria-hidden="true">👤</span>
        <span class="card-body">
          <span class="item-title">${esc(c.name)}</span>
          ${sub ? `<span class="item-meta">${esc(sub)}</span>` : ''}
          ${c.notes ? `<span class="item-note">${esc(snippet(c.notes, 80))}</span>` : ''}
        </span>
      </button>
      ${c.phone ? `<a class="btn-icon call-btn" href="tel:${esc(c.phone.replace(/[^\d+]/g, ''))}" aria-label="${esc(c.name)} anrufen">📞</a>` : ''}
    </li>`;
  }

  function taskRow(e, { status = true } = {}) {
    const s = store.taskStatus(e);
    const toggle = status && s.current
      ? `<button type="button" class="check-btn" data-action="toggle-task" data-id="${esc(e.id)}" aria-pressed="${s.done}" aria-label="${esc(e.title)}: ${s.done ? 'erledigt, zurücksetzen' : 'als erledigt markieren'}">${s.done ? '✓' : ''}</button>`
      : `<span class="check-placeholder" aria-hidden="true">•</span>`;
    return `<li class="task-row${s.done ? ' done' : ''}">
      ${toggle}
      <button type="button" class="task-title" data-action="open-entry" data-id="${esc(e.id)}">
        <span class="item-title">${esc(e.title)}</span>
        <span class="item-meta">${areaBadge(e.areaId)}${s.done ? ' Erledigt am ' + fmtDate(e.lastDone) : ''}</span>
      </button>
    </li>`;
  }

  const tasksIn = (month) => store.getEntries().filter((e) => e.type === 'task' && (e.months || []).includes(month));
  const byTitle = (a, b) => a.title.localeCompare(b.title, 'de');

  // ---- Start ----
  function renderStart() {
    const now = new Date();
    const m = now.getMonth() + 1;
    const next = m === 12 ? 1 : m + 1;
    const current = tasksIn(m).sort((a, b) => store.taskStatus(a).done - store.taskStatus(b).done || byTitle(a, b));
    const open = current.filter((e) => !store.taskStatus(e).done).length;
    const upcoming = tasksIn(next).filter((e) => !(e.months || []).includes(m)).sort(byTitle);

    const soon = store.getEntries().filter((e) => {
      if (e.type !== 'device' || !e.warrantyUntil) return false;
      const d = daysBetween(now, e.warrantyUntil);
      return d >= 0 && d <= 90;
    });

    const recent = [...store.getEntries()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);

    let html = `<div class="view-header"><h3 class="section-title">Jetzt dran · ${MONTH_NAMES[m - 1]}</h3>
      <span class="badge">${open ? open + ' offen' : 'alles erledigt'}</span></div>`;
    html += current.length
      ? `<ul class="task-list">${current.map((e) => taskRow(e)).join('')}</ul>`
      : `<p class="hint">Für ${MONTH_NAMES[m - 1]} ist nichts geplant.</p>`;

    if (upcoming.length) {
      html += `<details class="fold"><summary>Ab ${MONTH_NAMES[next - 1]} dazu (${upcoming.length})</summary>
        <ul class="task-list">${upcoming.map((e) => taskRow(e, { status: false })).join('')}</ul></details>`;
    }
    if (soon.length) {
      html += `<h3 class="section-title">Garantie endet bald</h3><ul class="item-list">${soon.map((e) => entryCard(e)).join('')}</ul>`;
    }

    html += `<h3 class="section-title">Bereiche</h3><ul class="area-chips">${store.getAreas().map((a) =>
      `<li><button type="button" class="chip" data-action="open-area" data-id="${esc(a.id)}">${esc(a.icon)} ${esc(a.name)}</button></li>`).join('')}</ul>`;

    html += `<h3 class="section-title">Zuletzt geändert</h3><ul class="item-list">${recent.map((e) => entryCard(e)).join('')}</ul>`;

    const el = $('start-content');
    el.innerHTML = html;
    hydrateImages(el);
  }

  // ---- Suche ----
  function renderSearch(query) {
    const box = $('search-results');
    const start = $('start-content');
    const res = window.Search.search(query, store);
    if (!res) {
      box.hidden = true;
      box.innerHTML = '';
      start.hidden = false;
      return;
    }
    start.hidden = true;
    box.hidden = false;

    let html = '';
    if (res.time) html += `<p class="hint">Aufgaben für <strong>${esc(res.time.label)}</strong> (${esc(monthsLabel(res.time.months))}) und alles, was dazu passt:</p>`;
    if (res.areas.length) {
      html += `<ul class="area-chips">${res.areas.map((a) =>
        `<li><button type="button" class="chip chip-area" data-action="open-area" data-id="${esc(a.id)}">${esc(a.icon)} Bereich ${esc(a.name)} öffnen</button></li>`).join('')}</ul>`;
    }
    if (res.results.length) {
      html += `<p class="hint">${res.results.length} Treffer</p><ul class="item-list">${res.results.map((r) =>
        r.kind === 'contact' ? contactCard(r.item) : entryCard(r.item)).join('')}</ul>`;
    } else {
      html += `<p class="empty-state">Nichts gefunden zu „${esc(query)}“.<br>
        <button type="button" class="btn btn-secondary" data-action="new" data-type="note" data-title="${esc(query)}">Notiz „${esc(query)}“ anlegen</button></p>`;
    }
    box.innerHTML = html;
    hydrateImages(box);
  }

  // ---- Bereiche ----
  function renderAreas() {
    const entries = store.getEntries();
    $('areas-grid').innerHTML = store.getAreas().map((a) => {
      const n = entries.filter((e) => e.areaId === a.id).length;
      return `<li><button type="button" class="area-tile" data-accent="${esc(a.color)}" data-action="open-area" data-id="${esc(a.id)}">
        <span class="area-icon" aria-hidden="true">${esc(a.icon)}</span>
        <span class="area-name">${esc(a.name)}</span>
        <span class="area-count">${n} ${n === 1 ? 'Eintrag' : 'Einträge'}</span>
      </button></li>`;
    }).join('');
  }

  function backBar(label = 'Zurück') {
    return `<button type="button" class="btn-back" data-action="back"><span aria-hidden="true">‹</span> ${label}</button>`;
  }

  function renderArea(id) {
    const el = $('view-area');
    const a = store.getArea(id);
    if (!a) { el.innerHTML = backBar() + '<p class="empty-state">Bereich nicht gefunden.</p>'; return; }
    const entries = store.getEntries().filter((e) => e.areaId === id);
    const linkedContactIds = new Set(entries.flatMap((e) => e.contactIds || []));
    const contacts = store.getContacts().filter((c) => (c.areaIds || []).includes(id) || linkedContactIds.has(c.id));

    const groups = [
      ['note', 'Wissen & Notizen'],
      ['device', 'Geräte'],
      ['meter', 'Zähler'],
    ];
    let html = backBar('Bereiche') + `<div class="view-header detail-head" data-accent="${esc(a.color)}">
      <h2><span aria-hidden="true">${esc(a.icon)}</span> ${esc(a.name)}</h2>
      <button type="button" class="btn-icon" data-action="edit-area" data-id="${esc(a.id)}" aria-label="Bereich bearbeiten">✏️</button></div>`;
    html += `<div class="button-row">
      <button type="button" class="btn btn-primary" data-action="new" data-type="note" data-area="${esc(id)}">+ Notiz</button>
      <button type="button" class="btn btn-secondary" data-action="add-menu" data-area="${esc(id)}">+ Weitere …</button></div>`;

    const tasks = entries.filter((e) => e.type === 'task').sort((x, y) => Math.min(...x.months) - Math.min(...y.months));
    if (tasks.length) html += `<h3 class="section-title">Aufgaben im Jahr</h3><ul class="task-list">${tasks.map((e) =>
      taskRow(e).replace('<span class="item-meta">', `<span class="item-meta">📅 ${esc(monthsLabel(e.months))} `)).join('')}</ul>`;
    groups.forEach(([type, label]) => {
      const list = entries.filter((e) => e.type === type).sort(byTitle);
      if (list.length) html += `<h3 class="section-title">${label}</h3><ul class="item-list">${list.map((e) => entryCard(e, { showArea: false })).join('')}</ul>`;
    });
    if (contacts.length) html += `<h3 class="section-title">Kontakte</h3><ul class="item-list">${contacts.map(contactCard).join('')}</ul>`;
    if (!entries.length && !contacts.length) html += '<p class="empty-state">Hier steht noch nichts. Leg die erste Notiz an.</p>';

    el.innerHTML = html;
    hydrateImages(el);
  }

  // ---- Jahr ----
  function renderYear() {
    const now = new Date();
    const m0 = now.getMonth() + 1;
    let html = '';
    for (let i = 0; i < 12; i++) {
      const m = ((m0 - 1 + i) % 12) + 1;
      const tasks = tasksIn(m).sort(byTitle);
      const season = Object.values(window.Search.SEASONS).find((s) => s.label !== 'Frühjahr' && s.months.includes(m)).label;
      html += `<section class="month-block${i === 0 ? ' current' : ''}">
        <h3 class="section-title">${MONTH_NAMES[m - 1]} <small>${season}${i === 0 ? ' · jetzt' : ''}</small></h3>
        ${tasks.length ? `<ul class="task-list">${tasks.map((e) => taskRow(e, { status: i === 0 })).join('')}</ul>` : '<p class="hint">Nichts geplant.</p>'}
      </section>`;
    }
    $('year-content').innerHTML = html;
  }

  // ---- Kontakte ----
  function renderContacts(filter) {
    const contacts = [...store.getContacts()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
    const trades = [...new Set(contacts.map((c) => c.trade).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
    $('contacts-chips').innerHTML = trades.length > 1
      ? [['', 'Alle'], ...trades.map((t) => [t, t])].map(([v, l]) =>
        `<button type="button" class="chip" data-action="filter-contacts" data-value="${esc(v)}" aria-pressed="${(filter || '') === v}">${esc(l)}</button>`).join('')
      : '';
    const list = filter ? contacts.filter((c) => c.trade === filter) : contacts;
    $('contacts-list').innerHTML = list.length
      ? list.map(contactCard).join('')
      : '<li class="empty-state">Noch keine Kontakte. Wer hat den Boden verlegt, wer die Wände gemacht? Mit „+ Kontakt“ festhalten.</li>';
  }

  // ---- Eintrag ----
  function fileTiles(entry) {
    if (!entry.files.length) return '<p class="hint">Noch keine Fotos oder PDFs.</p>';
    return `<ul class="file-grid">${entry.files.map((f) => {
      const isImg = f.type.startsWith('image/');
      return `<li class="file-tile">
        <button type="button" class="file-open" data-action="open-file" data-id="${esc(f.id)}" data-name="${esc(f.name)}" data-type="${esc(f.type)}" aria-label="${esc(f.name)} öffnen">
          ${isImg ? `<img data-file-id="${esc(f.id)}" alt="" />` : `<span class="file-icon" aria-hidden="true">📄</span><span class="file-name">${esc(f.name)}</span><span class="file-size">${fmtSize(f.size)}</span>`}
        </button>
        <button type="button" class="file-del" data-action="delete-file" data-entry="${esc(entry.id)}" data-id="${esc(f.id)}" aria-label="${esc(f.name)} entfernen">✕</button>
      </li>`;
    }).join('')}</ul>`;
  }

  function dl(rows) {
    const filled = rows.filter(([, v]) => v);
    return filled.length ? `<dl class="facts">${filled.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>` : '';
  }

  function typeBlock(e) {
    if (e.type === 'task') {
      const s = store.taskStatus(e);
      let status = 'Gerade nicht dran.';
      if (s.current) status = s.done ? `Erledigt am ${fmtDate(e.lastDone)}.` : 'Jetzt dran.';
      return dl([
        ['Wann', esc(monthsLabel(e.months))],
        ['Status', status],
        ['Zuletzt erledigt', !s.current && e.lastDone ? fmtDate(e.lastDone) : ''],
      ]) + (s.current ? `<button type="button" class="btn ${s.done ? 'btn-secondary' : 'btn-primary'}" data-action="toggle-task" data-id="${esc(e.id)}">${s.done ? 'Wieder offen' : '✓ Erledigt'}</button>` : '');
    }
    if (e.type === 'device') {
      let warranty = '';
      if (e.warrantyUntil) {
        const d = daysBetween(new Date(), e.warrantyUntil);
        warranty = fmtDate(e.warrantyUntil) + (d < 0 ? ' (abgelaufen)' : ` (noch ${d} Tage)`);
      }
      return dl([
        ['Hersteller', esc(e.manufacturer)],
        ['Modell', esc(e.model)],
        ['Seriennummer', esc(e.serial)],
        ['Gekauft', fmtDate(e.purchaseDate)],
        ['Garantie bis', warranty],
        ['Händler', esc(e.dealer)],
      ]);
    }
    if (e.type === 'meter') {
      const readings = e.readings || [];
      const rows = readings.map((r, i) => {
        const prev = readings[i - 1];
        let diff = '';
        if (prev) {
          const days = daysBetween(prev.date, r.date);
          const delta = r.value - prev.value;
          diff = `+${fmtNum(delta, 3)}${days > 0 ? ` · Ø ${fmtNum(delta / days, 2)}/Tag` : ''}`;
        }
        return `<tr>
          <td>${fmtDate(r.date)}</td>
          <td class="num">${fmtNum(r.value, 3)}</td>
          <td class="num muted">${diff}</td>
          <td class="actions">
            ${r.fileId ? `<button type="button" class="btn-icon" data-action="open-file" data-id="${esc(r.fileId)}" data-type="image/jpeg" data-name="Zählerstand ${esc(r.date)}.jpg" aria-label="Foto der Ablesung vom ${fmtDate(r.date)}">📷</button>` : ''}
            <button type="button" class="btn-icon" data-action="delete-reading" data-entry="${esc(e.id)}" data-id="${esc(r.id)}" aria-label="Ablesung vom ${fmtDate(r.date)} löschen">🗑️</button>
          </td></tr>`;
      }).reverse().join('');
      return dl([['Einheit', esc(e.unit)], ['Zählernummer', esc(e.meterNo)]]) +
        `<button type="button" class="btn btn-primary" data-action="add-reading" data-id="${esc(e.id)}">+ Zählerstand erfassen</button>` +
        (readings.length
          ? `<div class="table-wrap"><table class="readings"><thead><tr><th>Datum</th><th class="num">Stand (${esc(e.unit || '')})</th><th class="num">Verbrauch</th><th><span class="visually-hidden">Aktionen</span></th></tr></thead><tbody>${rows}</tbody></table></div>`
          : '<p class="hint">Noch keine Ablesung. Tipp: Foto vom Zähler gleich mit ablegen.</p>');
    }
    return '';
  }

  function renderEntry(id) {
    const el = $('view-entry');
    const e = store.getEntry(id);
    if (!e) { el.innerHTML = backBar() + '<p class="empty-state">Eintrag nicht gefunden.</p>'; return; }
    const t = TYPES[e.type] || TYPES.note;
    const contacts = (e.contactIds || []).map((cid) => store.getContact(cid)).filter(Boolean);

    el.innerHTML = backBar() + `
      <div class="detail-head">
        <p class="item-meta">${areaBadge(e.areaId)} <span class="badge">${t.icon} ${t.label}</span></p>
        <h2>${esc(e.title)}</h2>
        ${e.tags?.length ? `<p class="tags">${e.tags.map((tag) => `<button type="button" class="tag" data-action="search" data-q="${esc(tag)}">#${esc(tag)}</button>`).join(' ')}</p>` : ''}
      </div>
      ${typeBlock(e)}
      ${e.text ? `<div class="rich">${richText(e.text)}</div>` : ''}
      <h3 class="section-title">Fotos & Dokumente</h3>
      ${fileTiles(e)}
      <div class="button-row">
        <button type="button" class="btn btn-secondary" data-action="add-photo" data-id="${esc(e.id)}">📷 Foto aufnehmen</button>
        <button type="button" class="btn btn-secondary" data-action="add-files" data-id="${esc(e.id)}">📎 Datei / PDF</button>
      </div>
      ${contacts.length ? `<h3 class="section-title">Kontakte</h3><ul class="item-list">${contacts.map(contactCard).join('')}</ul>` : ''}
      <div class="button-row detail-actions">
        <button type="button" class="btn btn-primary" data-action="edit-entry" data-id="${esc(e.id)}">Bearbeiten</button>
        <button type="button" class="btn btn-danger" data-action="delete-entry" data-id="${esc(e.id)}">Löschen</button>
      </div>
      <p class="hint">Zuletzt geändert am ${fmtDate(e.updatedAt)}</p>`;
    hydrateImages(el);
  }

  // ---- Kontakt ----
  function renderContact(id) {
    const el = $('view-contact');
    const c = store.getContact(id);
    if (!c) { el.innerHTML = backBar() + '<p class="empty-state">Kontakt nicht gefunden.</p>'; return; }
    const entries = store.getEntries().filter((e) => (e.contactIds || []).includes(id));
    const areas = (c.areaIds || []).map((a) => areaBadge(a)).join(' ');
    const tel = c.phone ? c.phone.replace(/[^\d+]/g, '') : '';
    const web = c.website ? (/^https?:\/\//.test(c.website) ? c.website : 'https://' + c.website) : '';

    el.innerHTML = backBar() + `
      <div class="detail-head">
        <h2>${esc(c.name)}</h2>
        <p class="item-meta">${esc([c.trade, c.company].filter(Boolean).join(' · '))}</p>
        ${areas ? `<p class="item-meta">${areas}</p>` : ''}
      </div>
      <div class="button-row">
        ${tel ? `<a class="btn btn-primary" href="tel:${esc(tel)}">📞 Anrufen</a>` : ''}
        ${c.email ? `<a class="btn btn-secondary" href="mailto:${esc(c.email)}">✉️ E-Mail</a>` : ''}
        ${c.address ? `<a class="btn btn-secondary" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}" target="_blank" rel="noopener">📍 Karte</a>` : ''}
      </div>
      ${dl([
        ['Telefon', esc(c.phone)],
        ['E-Mail', esc(c.email)],
        ['Adresse', esc(c.address)],
        ['Web', web ? `<a href="${esc(web)}" target="_blank" rel="noopener">${esc(c.website)}</a>` : ''],
      ])}
      ${c.notes ? `<h3 class="section-title">Notizen</h3><div class="rich">${richText(c.notes)}</div>` : ''}
      <h3 class="section-title">Verknüpfte Einträge</h3>
      ${entries.length ? `<ul class="item-list">${entries.map((e) => entryCard(e)).join('')}</ul>` : '<p class="hint">Noch nicht mit Einträgen verknüpft. Beim Bearbeiten einer Notiz oder eines Geräts kannst du den Kontakt auswählen.</p>'}
      <div class="button-row detail-actions">
        <button type="button" class="btn btn-primary" data-action="edit-contact" data-id="${esc(c.id)}">Bearbeiten</button>
        <button type="button" class="btn btn-danger" data-action="delete-contact" data-id="${esc(c.id)}">Löschen</button>
      </div>`;
    hydrateImages(el);
  }

  // ---- Einstellungen ----
  async function renderSettings() {
    const theme = store.getSettings().theme || 'system';
    document.querySelectorAll('#theme-switcher [data-theme]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.theme === theme)));
    $('app-version').textContent = store.APP_VERSION;
    const info = $('storage-info');
    if (navigator.storage?.estimate) {
      const [est, persisted] = await Promise.all([navigator.storage.estimate(), navigator.storage.persisted?.() ?? false]);
      info.textContent = `Belegt: ${fmtSize(est.usage || 0)}. ` + (persisted
        ? 'Der Browser hält die Daten dauerhaft vor.'
        : 'Der Browser darf die Daten bei Speichermangel löschen – regelmäßige Backups sind wichtig.');
    }
  }

  window.UI = {
    TYPES, esc, fmtDate, monthsLabel, fileUrl,
    renderStart, renderSearch, renderAreas, renderArea, renderYear, renderContacts, renderEntry, renderContact, renderSettings,
  };
})();
