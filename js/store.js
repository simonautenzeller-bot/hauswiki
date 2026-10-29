/* Datenschicht: Einträge, Bereiche und Kontakte in localStorage, Fotos/PDFs als Blobs in IndexedDB. */
(function () {
  'use strict';

  const APP_VERSION = '0.1.3';
  const KEY = 'hauswiki:v1';
  const DB_NAME = 'hauswiki-files';

  function uid() {
    if (window.crypto?.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function baseAreas() {
    return [
      { id: 'area-allgemein', name: 'Haus allgemein', icon: '🏠', color: 'sky', keywords: ['haus', 'allgemein', 'schlüssel', 'versicherung', 'rauchmelder'] },
      { id: 'area-garten', name: 'Garten', icon: '🌳', color: 'teal', keywords: ['rasen', 'hecke', 'beet', 'baum', 'bewässerung', 'rasenmäher', 'terrasse', 'laub'] },
      { id: 'area-heizung', name: 'Heizung', icon: '🔥', color: 'rose', keywords: ['therme', 'brenner', 'heizkörper', 'warmwasser', 'wärmepumpe', 'gas', 'entlüften', 'heizanlage'] },
      { id: 'area-holz', name: 'Kamin & Holz', icon: '🪵', color: 'amber', keywords: ['holz', 'brennholz', 'kamin', 'ofen', 'kaminofen', 'schornstein', 'schornsteinfeger', 'asche'] },
      { id: 'area-wasser', name: 'Wasser & Sanitär', icon: '🚿', color: 'sky', keywords: ['wasser', 'bad', 'dusche', 'wc', 'abfluss', 'haupthahn', 'absperrhahn', 'entkalken'] },
      { id: 'area-strom', name: 'Strom & Elektrik', icon: '⚡', color: 'amber', keywords: ['strom', 'sicherung', 'sicherungskasten', 'photovoltaik', 'pv', 'steckdose', 'licht'] },
      { id: 'area-kueche', name: 'Küche & Geräte', icon: '🍽️', color: 'violet', keywords: ['küche', 'geschirrspüler', 'spülmaschine', 'kühlschrank', 'herd', 'backofen', 'waschmaschine', 'trockner'] },
      { id: 'area-dach', name: 'Dach & Fassade', icon: '🏚️', color: 'rose', keywords: ['dach', 'dachrinne', 'regenrinne', 'fassade', 'fenster'] },
      { id: 'area-keller', name: 'Keller & Lager', icon: '📦', color: 'violet', keywords: ['keller', 'lager', 'vorrat', 'feuchtigkeit'] },
    ];
  }

  // Grundstock an Aufgaben übers Jahr, frei änder- und löschbar.
  function seedEntries() {
    const now = new Date().toISOString();
    const task = (areaId, title, months, text = '') =>
      ({ id: uid(), type: 'task', areaId, title, months, text, tags: [], contactIds: [], files: [], createdAt: now, updatedAt: now });
    const meter = (title, unit) =>
      ({ id: uid(), type: 'meter', areaId: title === 'Gaszähler' ? 'area-heizung' : title === 'Stromzähler' ? 'area-strom' : 'area-wasser',
        title, unit, meterNo: '', readings: [], text: '', tags: ['zähler', 'zählerstand'], contactIds: [], files: [], createdAt: now, updatedAt: now });
    return [
      task('area-garten', 'Rasen vertikutieren und düngen', [3, 4]),
      task('area-garten', 'Rasenmäher fit machen (Messer, Öl, Akku)', [3]),
      task('area-garten', 'Außenwasserhahn wieder aufdrehen', [4]),
      task('area-garten', 'Hecke in Form schneiden', [6, 7], 'Nur Formschnitt: Radikaler Rückschnitt ist vom 1. März bis 30. September nicht erlaubt.'),
      task('area-garten', 'Laub rechen, Beete winterfest machen', [10, 11]),
      task('area-garten', 'Außenwasserhahn absperren und entleeren', [10, 11], 'Vor dem ersten Frost, sonst kann die Leitung platzen.'),
      task('area-garten', 'Gartenmöbel und Polster einlagern', [10]),
      task('area-heizung', 'Heizkörper entlüften', [10]),
      task('area-heizung', 'Heizungswartung beim Fachbetrieb', [9]),
      task('area-heizung', 'Heizung auf Sommerbetrieb stellen', [5]),
      task('area-holz', 'Brennholz für den nächsten Winter bestellen/spalten', [4, 5], 'Frisches Holz braucht ca. 2 Jahre zum Trocknen (Restfeuchte unter 20 %).'),
      task('area-holz', 'Holzvorrat prüfen und eindecken', [9, 10]),
      task('area-holz', 'Schornsteinfeger-Termin', [9]),
      task('area-dach', 'Dachrinnen reinigen', [4, 11]),
      task('area-wasser', 'Perlatoren und Duschkopf entkalken', [3, 9]),
      task('area-allgemein', 'Rauchmelder testen', [1]),
      task('area-allgemein', 'Zählerstände ablesen (Jahresablesung)', [12]),
      meter('Gaszähler', 'm³'),
      meter('Stromzähler', 'kWh'),
      meter('Wasserzähler', 'm³'),
    ];
  }

  function emptyData() {
    return { version: 1, areas: baseAreas(), entries: seedEntries(), contacts: [], settings: { theme: 'system' } };
  }

  function normalize(d) {
    const base = emptyData();
    return {
      version: 1,
      areas: Array.isArray(d.areas) ? d.areas : base.areas,
      entries: Array.isArray(d.entries) ? d.entries.map((e) => ({ tags: [], contactIds: [], files: [], text: '', ...e })) : [],
      contacts: Array.isArray(d.contacts) ? d.contacts.map((c) => ({ areaIds: [], ...c })) : [],
      settings: { ...base.settings, ...(d.settings || {}) },
    };
  }

  // true, wenn die Daten fehlten (Erststart oder Browser-Speicher geleert)
  let freshStart = false;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      freshStart = !raw;
      if (!raw) {
        const seeded = emptyData();
        localStorage.setItem(KEY, JSON.stringify(seeded));
        return seeded;
      }
      return normalize(JSON.parse(raw));
    } catch {
      freshStart = true;
      return emptyData();
    }
  }

  let data = load();
  const listeners = new Set();

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Speichern fehlgeschlagen', e);
    }
  }
  function notify() {
    save();
    listeners.forEach((fn) => fn());
  }
  function subscribe(fn) {
    listeners.add(fn);
  }

  // ---- Bereiche ----
  const getAreas = () => data.areas;
  const getArea = (id) => data.areas.find((a) => a.id === id);
  function saveArea(area) {
    const i = data.areas.findIndex((a) => a.id === area.id);
    if (i >= 0) data.areas[i] = { ...data.areas[i], ...area };
    else data.areas.push({ ...area, id: uid() });
    notify();
  }
  function deleteArea(id) {
    const fallback = data.areas.find((a) => a.id !== id);
    data.areas = data.areas.filter((a) => a.id !== id);
    data.entries.forEach((e) => { if (e.areaId === id) e.areaId = fallback ? fallback.id : ''; });
    data.contacts.forEach((c) => { c.areaIds = c.areaIds.filter((a) => a !== id); });
    notify();
  }

  // ---- Einträge ----
  const getEntries = () => data.entries;
  const getEntry = (id) => data.entries.find((e) => e.id === id);
  function saveEntry(entry) {
    const now = new Date().toISOString();
    const i = data.entries.findIndex((e) => e.id === entry.id);
    if (i >= 0) {
      data.entries[i] = { ...data.entries[i], ...entry, updatedAt: now };
      notify();
      return data.entries[i];
    }
    const created = { tags: [], contactIds: [], files: [], text: '', ...entry, id: uid(), createdAt: now, updatedAt: now };
    if (created.type === 'meter' && !created.readings) created.readings = [];
    data.entries.push(created);
    notify();
    return created;
  }
  async function deleteEntry(id) {
    const entry = getEntry(id);
    if (!entry) return;
    const fileIds = [...entry.files, ...(entry.readings || []).map((r) => r.fileId).filter(Boolean)];
    data.entries = data.entries.filter((e) => e.id !== id);
    notify();
    await Promise.all(fileIds.map(deleteFile));
  }

  // ---- Saisonale Aufgaben ----
  // Beginn des aktuellen "Fensters": zusammenhängende Monate rund um den aktuellen Monat (z. B. Okt+Nov).
  function taskWindowStart(months, now = new Date()) {
    const m = now.getMonth() + 1;
    if (!months || !months.includes(m)) return null;
    let y = now.getFullYear();
    let mm = m;
    if (months.length < 12) {
      for (let i = 0; i < 11; i++) {
        const prev = mm === 1 ? 12 : mm - 1;
        if (!months.includes(prev)) break;
        if (mm === 1) y--;
        mm = prev;
      }
    }
    return new Date(y, mm - 1, 1);
  }
  function taskStatus(entry, now = new Date()) {
    const start = taskWindowStart(entry.months, now);
    if (!start) return { current: false, done: false };
    const done = !!entry.lastDone && new Date(entry.lastDone) >= start;
    return { current: true, done };
  }
  function toggleTaskDone(id) {
    const entry = getEntry(id);
    if (!entry) return;
    const status = taskStatus(entry);
    if (status.done) entry.lastDone = entry.prevDone || null;
    else {
      entry.prevDone = entry.lastDone || null;
      entry.lastDone = new Date().toISOString();
    }
    notify();
  }

  // ---- Zählerstände ----
  function addReading(entryId, reading) {
    const entry = getEntry(entryId);
    if (!entry) return;
    entry.readings = [...(entry.readings || []), { id: uid(), ...reading }].sort((a, b) => a.date.localeCompare(b.date));
    entry.updatedAt = new Date().toISOString();
    notify();
  }
  async function deleteReading(entryId, readingId) {
    const entry = getEntry(entryId);
    if (!entry) return;
    const r = entry.readings.find((x) => x.id === readingId);
    entry.readings = entry.readings.filter((x) => x.id !== readingId);
    notify();
    if (r?.fileId) await deleteFile(r.fileId);
  }

  // ---- Kontakte ----
  const getContacts = () => data.contacts;
  const getContact = (id) => data.contacts.find((c) => c.id === id);
  function saveContact(contact) {
    const i = data.contacts.findIndex((c) => c.id === contact.id);
    if (i >= 0) {
      data.contacts[i] = { ...data.contacts[i], ...contact };
      notify();
      return data.contacts[i];
    }
    const created = { areaIds: [], ...contact, id: uid(), createdAt: new Date().toISOString() };
    data.contacts.push(created);
    notify();
    return created;
  }
  function deleteContact(id) {
    data.contacts = data.contacts.filter((c) => c.id !== id);
    data.entries.forEach((e) => { e.contactIds = e.contactIds.filter((c) => c !== id); });
    notify();
  }

  // ---- Einstellungen ----
  const getSettings = () => data.settings;
  function updateSettings(patch) {
    data.settings = { ...data.settings, ...patch };
    notify();
  }

  // ---- Dateien (IndexedDB) ----
  let dbPromise = null;
  function db() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore('files', { keyPath: 'id' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }
  async function tx(mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const t = d.transaction('files', mode);
      const req = fn(t.objectStore('files'));
      t.oncomplete = () => resolve(req?.result);
      t.onerror = t.onabort = () => reject(t.error);
    });
  }
  async function putFile(blob, name) {
    const rec = { id: uid(), name, type: blob.type || 'application/octet-stream', size: blob.size, blob, createdAt: new Date().toISOString() };
    await tx('readwrite', (s) => s.put(rec));
    // Browser bitten, die Daten nicht bei Speicherknappheit zu löschen.
    if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
    return rec;
  }
  const getFile = (id) => tx('readonly', (s) => s.get(id));
  const deleteFile = (id) => tx('readwrite', (s) => s.delete(id)).catch(() => {});
  const allFiles = () => tx('readonly', (s) => s.getAll());

  // Datei-Metadaten im Eintrag, damit Liste/Suche ohne IndexedDB auskommen.
  async function attachFiles(entryId, blobs) {
    const entry = getEntry(entryId);
    if (!entry) return;
    for (const { blob, name } of blobs) {
      const rec = await putFile(blob, name);
      entry.files.push({ id: rec.id, name: rec.name, type: rec.type, size: rec.size });
    }
    entry.updatedAt = new Date().toISOString();
    notify();
  }
  async function detachFile(entryId, fileId) {
    const entry = getEntry(entryId);
    if (!entry) return;
    entry.files = entry.files.filter((f) => f.id !== fileId);
    notify();
    await deleteFile(fileId);
  }

  // ---- Backup (Daten + Dateien als eine JSON-Datei) ----
  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  }
  async function exportSnapshot() {
    const files = await allFiles();
    const packed = [];
    for (const f of files) packed.push({ id: f.id, name: f.name, type: f.type, size: f.size, createdAt: f.createdAt, dataUrl: await blobToDataUrl(f.blob) });
    return JSON.stringify({ app: 'hauswiki', appVersion: APP_VERSION, exportedAt: new Date().toISOString(), data, files: packed });
  }
  async function importSnapshot(text) {
    let parsed;
    try { parsed = JSON.parse(text); } catch { return { ok: false }; }
    if (!parsed || parsed.app !== 'hauswiki' || !parsed.data || !Array.isArray(parsed.data.entries)) return { ok: false };
    await tx('readwrite', (s) => s.clear());
    for (const f of parsed.files || []) {
      const blob = await (await fetch(f.dataUrl)).blob();
      await tx('readwrite', (s) => s.put({ id: f.id, name: f.name, type: f.type, size: f.size, createdAt: f.createdAt, blob }));
    }
    data = normalize(parsed.data);
    freshStart = false;
    notify();
    return { ok: true };
  }
  async function resetAll() {
    await tx('readwrite', (s) => s.clear());
    data = emptyData();
    notify();
  }

  window.Store = {
    APP_VERSION,
    wasFresh: () => freshStart,
    getData: () => data,
    subscribe,
    getAreas, getArea, saveArea, deleteArea,
    getEntries, getEntry, saveEntry, deleteEntry,
    taskStatus, toggleTaskDone,
    addReading, deleteReading,
    getContacts, getContact, saveContact, deleteContact,
    getSettings, updateSettings,
    putFile, getFile, attachFiles, detachFile,
    exportSnapshot, importSnapshot, resetAll,
  };
})();
