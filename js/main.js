/* Navigation (Hash-Routing), Formulare, Datei-Upload und Event-Wiring. */
(function () {
  'use strict';

  const store = window.Store;
  const ui = window.UI;
  const { esc } = ui;
  const $ = (id) => document.getElementById(id);

  // ---------- Toast & Bestätigung ----------
  let toastTimer = null;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function confirmDialog(message, okLabel = 'OK') {
    const dlg = $('confirm-dialog');
    $('confirm-text').textContent = message;
    $('confirm-ok').textContent = okLabel;
    return new Promise((resolve) => {
      const finish = (result) => {
        $('confirm-ok').onclick = $('confirm-cancel').onclick = null;
        dlg.removeEventListener('close', onClose);
        if (dlg.open) dlg.close();
        resolve(result);
      };
      const onClose = () => finish(false);
      $('confirm-ok').onclick = () => finish(true);
      $('confirm-cancel').onclick = () => finish(false);
      dlg.addEventListener('close', onClose);
      dlg.showModal();
    });
  }

  // ---------- Theme ----------
  function applyTheme() {
    const t = store.getSettings().theme;
    if (!t || t === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
  }

  // ---------- Routing ----------
  const ROUTES = {
    start: 'view-start',
    bereiche: 'view-areas',
    bereich: 'view-area',
    jahr: 'view-year',
    kontakte: 'view-contacts',
    kontakt: 'view-contact',
    eintrag: 'view-entry',
    einstellungen: 'view-settings',
  };
  const NAV_OF = { bereich: 'bereiche', kontakt: 'kontakte' };
  let lastNav = 'start';
  let navCount = 0;
  let contactFilter = '';

  function parseHash() {
    const [name, id] = location.hash.slice(1).split('/');
    return { name: ROUTES[name] ? name : 'start', id: id ? decodeURIComponent(id) : '' };
  }
  const go = (hash) => { location.hash = hash; };

  function renderRoute() {
    const { name, id } = parseHash();
    Object.entries(ROUTES).forEach(([key, viewId]) => { $(viewId).hidden = key !== name; });
    const nav = NAV_OF[name] || (name === 'eintrag' ? lastNav : name);
    lastNav = nav;
    document.querySelectorAll('.nav-btn').forEach((b) => {
      if (b.dataset.view === nav) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    $('fab').hidden = name === 'einstellungen';

    if (name === 'start') {
      ui.renderStart();
      ui.renderSearch($('search-input').value);
    } else if (name === 'bereiche') ui.renderAreas();
    else if (name === 'bereich') ui.renderArea(id);
    else if (name === 'jahr') ui.renderYear();
    else if (name === 'kontakte') ui.renderContacts(contactFilter);
    else if (name === 'kontakt') ui.renderContact(id);
    else if (name === 'eintrag') ui.renderEntry(id);
    else if (name === 'einstellungen') ui.renderSettings();
  }

  function back() {
    if (navCount > 0) history.back();
    else go('start');
  }

  // ---------- Formular-Bausteine ----------
  let submitHandler = null;

  function openForm(title, fieldsHtml, onSubmit, submitLabel = 'Speichern') {
    $('form-dialog-title').textContent = title;
    $('form-fields').innerHTML = fieldsHtml;
    $('btn-form-submit').textContent = submitLabel;
    $('form-error').hidden = true;
    submitHandler = onSubmit;
    $('form-dialog').showModal();
    const first = $('form-fields').querySelector('input:not([type=checkbox]):not([type=file]), textarea, select');
    if (first) first.focus();
  }

  let fieldSeq = 0;
  function field(name, label, value = '', { type = 'text', placeholder = '', required = false, hint = '', list = '', step = '', inputmode = '' } = {}) {
    const id = 'f-' + name + '-' + ++fieldSeq;
    return `<div class="field"><label for="${id}">${label}${required ? ' <span aria-hidden="true">*</span>' : ''}</label>
      <input id="${id}" name="${name}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}"
        ${required ? 'required aria-required="true"' : ''} ${list ? `list="${list}"` : ''} ${step ? `step="${step}"` : ''} ${inputmode ? `inputmode="${inputmode}"` : ''} autocomplete="off" />
      ${hint ? `<span class="field-hint">${hint}</span>` : ''}</div>`;
  }
  function textarea(name, label, value = '', placeholder = '') {
    const id = 'f-' + name + '-' + ++fieldSeq;
    return `<div class="field"><label for="${id}">${label}</label>
      <textarea id="${id}" name="${name}" rows="5" placeholder="${esc(placeholder)}">${esc(value)}</textarea></div>`;
  }
  function select(name, label, options, value) {
    const id = 'f-' + name + '-' + ++fieldSeq;
    return `<div class="field"><label for="${id}">${label}</label><select id="${id}" name="${name}">
      ${options.map(([v, l]) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`;
  }
  function checkGroup(name, legend, options, selected, extra = '') {
    return `<fieldset class="field check-group"><legend>${legend}</legend>${extra}<div class="check-list">
      ${options.map(([v, l]) => `<label class="check-chip"><input type="checkbox" name="${name}" value="${esc(v)}"${selected.includes(v) ? ' checked' : ''} /> <span>${esc(l)}</span></label>`).join('')}
      </div></fieldset>`;
  }
  function monthsPicker(selected) {
    const seasons = `<div class="season-row">${['Frühling', 'Sommer', 'Herbst', 'Winter'].map((s) =>
      `<button type="button" class="chip chip-small" data-action="pick-season" data-season="${s}">${s}</button>`).join('')}</div>`;
    return checkGroup('months', 'In welchen Monaten? *', window.Search.MONTH_NAMES.map((n, i) => [String(i + 1), n.slice(0, 3)]),
      (selected || []).map(String), seasons).replace('check-list', 'check-list month-grid');
  }
  function contactsPicker(selected) {
    const contacts = [...store.getContacts()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
    if (!contacts.length) return '';
    return checkGroup('contactIds', 'Kontakte verknüpfen', contacts.map((c) => [c.id, c.name + (c.trade ? ' (' + c.trade + ')' : '')]), selected || []);
  }
  function filesField(label = 'Fotos / PDFs anhängen') {
    const id = 'f-files-' + ++fieldSeq;
    return `<div class="field"><label for="${id}">${label}</label>
      <input id="${id}" name="files" type="file" accept="image/*,application/pdf" multiple />
      <span class="field-hint">Fotos werden automatisch verkleinert.</span></div>`;
  }
  const areaOptions = () => store.getAreas().map((a) => [a.id, a.icon + ' ' + a.name]);
  const splitList = (s) => String(s || '').split(',').map((t) => t.trim()).filter(Boolean);
  const todayIso = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  // ---------- Bilder verkleinern ----------
  async function compressImage(file, max = 1600, quality = 0.82) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
      bmp.close?.();
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));
      if (!blob || blob.size >= file.size) return { blob: file, name: file.name };
      return { blob, name: file.name.replace(/\.[^.]+$/, '') + '.jpg' };
    } catch {
      return { blob: file, name: file.name };
    }
  }
  async function prepareFiles(fileList) {
    const out = [];
    for (const f of fileList) {
      if (f.type.startsWith('image/') && f.type !== 'image/gif') out.push(await compressImage(f));
      else out.push({ blob: f, name: f.name });
    }
    return out;
  }

  // ---------- Einträge ----------
  const PLACEHOLDERS = {
    note: 'z. B. Wo ist der Haupthahn? Welcher Druck soll auf der Heizung sein? Welche Farbe hat die Wand im Flur?',
    task: 'Was ist zu tun, worauf achten?',
    device: 'Besonderheiten, Wartung, Fehlercodes …',
    meter: 'z. B. Wo hängt der Zähler?',
  };

  function entryForm(type, existing, { areaId, title } = {}) {
    const e = existing || { type, areaId: areaId || 'area-allgemein', title: title || '', tags: [], contactIds: [] };
    const t = ui.TYPES[e.type];
    let html = field('title', 'Titel', e.title, { required: true, placeholder: e.type === 'device' ? 'z. B. Geschirrspüler' : '' });
    html += select('areaId', 'Bereich', areaOptions(), e.areaId);
    if (e.type === 'task') html += monthsPicker(e.months);
    if (e.type === 'device') {
      html += `<div class="field-row">${field('manufacturer', 'Hersteller', e.manufacturer)}${field('model', 'Modell', e.model)}</div>`;
      html += field('serial', 'Seriennummer', e.serial, { hint: 'Tipp: Typenschild fotografieren und anhängen.' });
      html += `<div class="field-row">${field('purchaseDate', 'Gekauft am', e.purchaseDate, { type: 'date' })}${field('warrantyUntil', 'Garantie bis', e.warrantyUntil, { type: 'date' })}</div>`;
      html += field('dealer', 'Händler', e.dealer);
    }
    if (e.type === 'meter') {
      html += `<div class="field-row">${field('unit', 'Einheit', e.unit || 'm³', { list: 'units' })}${field('meterNo', 'Zählernummer', e.meterNo)}</div>
        <datalist id="units"><option value="m³"><option value="kWh"><option value="l"></datalist>`;
    }
    html += textarea('text', e.type === 'note' ? 'Notiz' : 'Beschreibung', e.text, PLACEHOLDERS[e.type]);
    html += field('tags', 'Stichwörter', (e.tags || []).join(', '), { placeholder: 'z. B. holz, ofen, winter', hint: 'Mit Komma trennen. Helfen beim Finden.' });
    html += contactsPicker(e.contactIds);
    if (!existing) html += filesField();

    openForm((existing ? 'Bearbeiten: ' : 'Neu: ') + t.label, html, async (form) => {
      const fd = new FormData(form);
      const patch = {
        type: e.type,
        title: String(fd.get('title') || '').trim(),
        areaId: fd.get('areaId'),
        text: String(fd.get('text') || '').trim(),
        tags: splitList(fd.get('tags')).map((s) => s.toLowerCase()),
        contactIds: fd.getAll('contactIds'),
      };
      if (!patch.title) return 'Bitte einen Titel eingeben.';
      if (e.type === 'task') {
        patch.months = fd.getAll('months').map(Number).sort((a, b) => a - b);
        if (!patch.months.length) return 'Bitte mindestens einen Monat wählen.';
      }
      ['manufacturer', 'model', 'serial', 'purchaseDate', 'warrantyUntil', 'dealer', 'unit', 'meterNo'].forEach((k) => {
        if (fd.has(k)) patch[k] = String(fd.get(k)).trim();
      });
      if (existing) {
        store.saveEntry({ ...patch, id: existing.id });
        toast('Gespeichert');
        return true;
      }
      const created = store.saveEntry(patch);
      const files = form.querySelector('input[name=files]')?.files;
      if (files?.length) await store.attachFiles(created.id, await prepareFiles(files));
      toast('Angelegt');
      go('eintrag/' + encodeURIComponent(created.id));
      return true;
    });
  }

  function readingForm(entry) {
    const last = (entry.readings || [])[entry.readings.length - 1];
    let html = field('date', 'Datum', todayIso(), { type: 'date', required: true });
    html += field('value', `Zählerstand (${esc(entry.unit || '')})`, '', {
      // Text statt number: Manche Handy-Tastaturen liefern bei Komma sonst einen leeren Wert.
      inputmode: 'decimal', required: true,
      hint: last ? `Letzter Stand: ${last.value.toLocaleString('de-DE')} am ${ui.fmtDate(last.date)}` : '',
    });
    const id = 'f-photo-' + ++fieldSeq;
    html += `<div class="field"><label for="${id}">Foto vom Zähler (optional)</label>
      <input id="${id}" name="photo" type="file" accept="image/*" capture="environment" /></div>`;
    openForm(entry.title + ': Ablesung', html, async (form) => {
      const fd = new FormData(form);
      const date = String(fd.get('date') || '');
      // "13.001,5" (deutsch) und "13001.5" beides zulassen
      const raw = String(fd.get('value') || '').replace(/\s/g, '');
      const value = Number(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw);
      if (!date) return 'Bitte ein Datum wählen.';
      if (!raw || isNaN(value)) return 'Bitte den Zählerstand als Zahl eingeben.';
      const reading = { date, value };
      const photo = form.querySelector('input[name=photo]').files[0];
      if (photo) {
        const [prepared] = await prepareFiles([photo]);
        reading.fileId = (await store.putFile(prepared.blob, prepared.name)).id;
      }
      store.addReading(entry.id, reading);
      toast('Zählerstand gespeichert');
      return true;
    });
  }

  // ---------- Kontakte ----------
  const TRADES = ['Bodenleger', 'Maler', 'Elektriker', 'Installateur', 'Heizungsbauer', 'Schornsteinfeger', 'Dachdecker', 'Gärtner',
    'Schreiner', 'Fliesenleger', 'Trockenbau', 'Fensterbauer', 'Zimmerer', 'Hausverwaltung', 'Versicherung', 'Nachbar'];

  function contactForm(existing) {
    const c = existing || { areaIds: [] };
    let html = field('name', 'Name', c.name, { required: true, placeholder: 'Person oder Firma' });
    html += field('trade', 'Gewerk / Rolle', c.trade, { list: 'trades', placeholder: 'z. B. Bodenleger' });
    html += `<datalist id="trades">${TRADES.map((t) => `<option value="${t}">`).join('')}</datalist>`;
    html += field('company', 'Firma', c.company);
    html += `<div class="field-row">${field('phone', 'Telefon', c.phone, { type: 'tel' })}${field('email', 'E-Mail', c.email, { type: 'email' })}</div>`;
    html += field('address', 'Adresse', c.address);
    html += field('website', 'Webseite', c.website, { type: 'url' });
    html += textarea('notes', 'Notizen', c.notes, 'z. B. 2019 Parkett im Wohnzimmer verlegt, sehr sauber gearbeitet. Rechnung Nr. …');
    html += checkGroup('areaIds', 'Zuständig für', store.getAreas().map((a) => [a.id, a.icon + ' ' + a.name]), c.areaIds || []);

    openForm(existing ? 'Kontakt bearbeiten' : 'Neuer Kontakt', html, (form) => {
      const fd = new FormData(form);
      const patch = { areaIds: fd.getAll('areaIds') };
      ['name', 'trade', 'company', 'phone', 'email', 'address', 'website', 'notes'].forEach((k) => { patch[k] = String(fd.get(k) || '').trim(); });
      if (!patch.name) return 'Bitte einen Namen eingeben.';
      if (existing) {
        store.saveContact({ ...patch, id: existing.id });
        toast('Gespeichert');
      } else {
        const created = store.saveContact(patch);
        toast('Kontakt angelegt');
        go('kontakt/' + encodeURIComponent(created.id));
      }
      return true;
    });
  }

  // ---------- Bereiche ----------
  const COLORS = [['sky', 'Blau'], ['teal', 'Grün'], ['amber', 'Orange'], ['rose', 'Rot'], ['violet', 'Violett']];

  function areaForm(existing) {
    const a = existing || { icon: '📌', color: 'sky', keywords: [] };
    let html = field('name', 'Name', a.name, { required: true });
    html += `<div class="field-row">${field('icon', 'Symbol (Emoji)', a.icon)}${select('color', 'Farbe', COLORS, a.color)}</div>`;
    html += field('keywords', 'Suchbegriffe', (a.keywords || []).join(', '), { hint: 'Wer danach sucht, landet in diesem Bereich, z. B. „holz, ofen, kamin“.' });
    if (existing && store.getAreas().length > 1) {
      html += `<button type="button" class="btn btn-danger" data-action="delete-area" data-id="${esc(a.id)}">Bereich löschen</button>`;
    }
    openForm(existing ? 'Bereich bearbeiten' : 'Neuer Bereich', html, (form) => {
      const fd = new FormData(form);
      const patch = {
        name: String(fd.get('name') || '').trim(),
        icon: String(fd.get('icon') || '').trim() || '📌',
        color: fd.get('color'),
        keywords: splitList(fd.get('keywords')).map((s) => s.toLowerCase()),
      };
      if (!patch.name) return 'Bitte einen Namen eingeben.';
      store.saveArea(existing ? { ...patch, id: existing.id } : patch);
      toast('Gespeichert');
      return true;
    });
  }

  // ---------- Dateien ----------
  let fileTarget = null;
  let viewerFile = null;

  async function openFile(id, type, name) {
    const url = await ui.fileUrl(id);
    if (!url) { toast('Datei nicht gefunden'); return; }
    if (type.startsWith('image/')) {
      viewerFile = { url, name };
      $('viewer-img').src = url;
      $('viewer-img').alt = name;
      $('viewer-dialog').showModal();
      return;
    }
    // PDFs im Browser-Viewer öffnen; klappt das nicht (z. B. Popup-Sperre), herunterladen.
    if (!window.open(url, '_blank')) download(url, name);
  }
  function download(url, name) {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function onFilesPicked(input) {
    const files = [...(input.files || [])];
    input.value = '';
    if (!files.length || !fileTarget) return;
    toast('Wird gespeichert …');
    await store.attachFiles(fileTarget, await prepareFiles(files));
    toast(files.length === 1 ? 'Datei hinzugefügt' : files.length + ' Dateien hinzugefügt');
  }

  // ---------- Backup ----------
  async function exportBackup() {
    toast('Backup wird erstellt …');
    const json = await store.exportSnapshot();
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    download(url, 'Hauswiki-backup-' + todayIso() + '.json');
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    window.AppBackup.markExternal('Download');
  }
  function importBackup(input) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      if (!(await confirmDialog('Backup einspielen? Die aktuellen Daten auf diesem Gerät werden ersetzt.', 'Einspielen'))) return;
      const res = await store.importSnapshot(String(reader.result));
      if (!res.ok) { toast('Das sieht nicht nach einem Hauswiki-Backup aus'); return; }
      applyTheme();
      window.AppBackup.markExternal('Wiederherstellung');
      toast('Backup eingespielt');
    };
    reader.readAsText(file);
  }

  // ---------- Aktionen ----------
  let pendingArea = '';

  const actions = {
    'open-entry': (d) => go('eintrag/' + encodeURIComponent(d.id)),
    'open-contact': (d) => go('kontakt/' + encodeURIComponent(d.id)),
    'open-area': (d) => go('bereich/' + encodeURIComponent(d.id)),
    back,
    'close-dialog': (d, el) => el.closest('dialog').close(),
    'add-menu': (d) => {
      pendingArea = d.area || (parseHash().name === 'bereich' ? parseHash().id : '');
      $('add-dialog').showModal();
    },
    new: (d) => {
      if ($('add-dialog').open) $('add-dialog').close();
      const areaId = d.area || pendingArea || undefined;
      pendingArea = '';
      if (d.type === 'contact') contactForm(null);
      else entryForm(d.type, null, { areaId, title: d.title });
    },
    'edit-entry': (d) => entryForm(null, store.getEntry(d.id)),
    'delete-entry': async (d) => {
      const e = store.getEntry(d.id);
      if (!e || !(await confirmDialog(`„${e.title}“ mit allen Fotos und Dateien löschen?`, 'Löschen'))) return;
      await store.deleteEntry(d.id);
      toast('Gelöscht');
      back();
    },
    'toggle-task': (d) => store.toggleTaskDone(d.id),
    'add-reading': (d) => readingForm(store.getEntry(d.id)),
    'delete-reading': async (d) => {
      if (await confirmDialog('Diese Ablesung löschen?', 'Löschen')) await store.deleteReading(d.entry, d.id);
    },
    'add-photo': (d) => { fileTarget = d.id; $('input-camera').click(); },
    'add-files': (d) => { fileTarget = d.id; $('input-files').click(); },
    'open-file': (d) => openFile(d.id, d.type || '', d.name || 'Datei'),
    'delete-file': async (d) => {
      if (await confirmDialog('Diese Datei entfernen?', 'Entfernen')) await store.detachFile(d.entry, d.id);
    },
    'viewer-download': () => { if (viewerFile) download(viewerFile.url, viewerFile.name); },
    'edit-contact': (d) => contactForm(store.getContact(d.id)),
    'delete-contact': async (d) => {
      const c = store.getContact(d.id);
      if (!c || !(await confirmDialog(`Kontakt „${c.name}“ löschen?`, 'Löschen'))) return;
      store.deleteContact(d.id);
      toast('Gelöscht');
      back();
    },
    'filter-contacts': (d) => { contactFilter = d.value; ui.renderContacts(contactFilter); },
    'new-area': () => areaForm(null),
    'edit-area': (d) => areaForm(store.getArea(d.id)),
    'delete-area': async (d) => {
      const a = store.getArea(d.id);
      $('form-dialog').close();
      if (!a || !(await confirmDialog(`Bereich „${a.name}“ löschen? Die Einträge wandern in einen anderen Bereich.`, 'Löschen'))) return;
      store.deleteArea(d.id);
      go('bereiche');
    },
    'pick-season': (d, el) => {
      const months = window.Search.SEASONS[window.Search.norm(d.season)].months.map(String);
      const boxes = [...el.closest('fieldset').querySelectorAll('input[name=months]')];
      const target = boxes.filter((b) => months.includes(b.value));
      const allOn = target.every((b) => b.checked);
      target.forEach((b) => { b.checked = !allOn; });
    },
    search: (d) => {
      $('search-input').value = d.q;
      if (parseHash().name !== 'start') go('start');
      else renderRoute();
      syncSearchClear();
    },
    export: exportBackup,
    import: () => $('file-import').click(),
    reset: async () => {
      if (!(await confirmDialog('Wirklich alle Einträge, Kontakte, Fotos und PDFs auf diesem Gerät löschen? Das lässt sich nur mit einem Backup rückgängig machen.', 'Alles löschen'))) return;
      await store.resetAll();
      toast('Zurückgesetzt');
    },
  };

  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-action]');
    if (!el || !actions[el.dataset.action]) return;
    ev.preventDefault();
    actions[el.dataset.action](el.dataset, el);
  });

  document.querySelectorAll('.nav-btn').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.view === 'start' && parseHash().name === 'start') {
      $('search-input').value = '';
      syncSearchClear();
      renderRoute();
      return;
    }
    go(b.dataset.view);
  }));

  $('theme-switcher').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-theme]');
    if (!b) return;
    store.updateSettings({ theme: b.dataset.theme });
    applyTheme();
  });

  $('entity-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!submitHandler) return;
    const btn = $('btn-form-submit');
    btn.disabled = true;
    try {
      const res = await submitHandler(ev.target);
      if (res === true) $('form-dialog').close();
      else if (typeof res === 'string') {
        $('form-error').textContent = res;
        $('form-error').hidden = false;
      }
    } finally {
      btn.disabled = false;
    }
  });

  function syncSearchClear() {
    $('btn-search-clear').hidden = !$('search-input').value;
  }
  $('search-input').addEventListener('input', () => {
    syncSearchClear();
    ui.renderSearch($('search-input').value);
  });
  $('btn-search-clear').addEventListener('click', () => {
    $('search-input').value = '';
    syncSearchClear();
    ui.renderSearch('');
    $('search-input').focus();
  });

  $('input-camera').addEventListener('change', (ev) => onFilesPicked(ev.target));
  $('input-files').addEventListener('change', (ev) => onFilesPicked(ev.target));
  $('file-import').addEventListener('change', (ev) => importBackup(ev.target));

  window.addEventListener('hashchange', () => {
    navCount++;
    renderRoute();
    window.scrollTo(0, 0);
  });
  store.subscribe(renderRoute);

  // ---------- Start ----------
  applyTheme();
  window.AppBackup.init({
    appId: 'hauswiki',
    appName: 'Hauswiki+',
    filePrefix: 'Hauswiki',
    getData: () => store.getData(),
    getSnapshot: () => store.exportSnapshot(),
    restore: async (text) => {
      const ok = (await store.importSnapshot(text)).ok;
      if (ok) applyTheme();
      return ok;
    },
    isFresh: () => store.wasFresh(),
    toast,
    bannerParent: document.getElementById('main-content'),
    btnClass: 'btn btn-secondary',
    btnPrimaryClass: 'btn btn-primary',
  });
  $('backup-slot').appendChild(window.AppBackup.createPanel());
  renderRoute();

  if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    });
  }
})();
