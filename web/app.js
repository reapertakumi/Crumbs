'use strict';

/* Crumbs front end. No framework, no build step.
 *
 * Thumbnails and favicons are downloaded and resized here in the browser,
 * then uploaded to the Pi as small JPEG/PNG files. The Pi only stores them. */

const $ = (sel, root = document) => root.querySelector(sel);

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
}

const EDIT_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>';

const S = { me: null, guest: false, loginRequired: true, list: [], folder: null, q: '' };
let cards = new Map();

// ---------- small helpers ----------

async function api(method, path, body) {
  const opt = { method, headers: {} };
  if (body instanceof Blob) {
    opt.body = body;
    opt.headers['Content-Type'] = body.type || 'application/octet-stream';
  } else if (body !== undefined) {
    opt.body = JSON.stringify(body);
    opt.headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(path, opt);
  const data = (res.headers.get('Content-Type') || '').includes('json') ? await res.json() : null;
  if (!res.ok) {
    const err = new Error((data && data.error) || `${res.status} ${res.statusText}`);
    err.status = res.status;
    if (res.status === 401 && path !== '/api/login') boot();
    throw err;
  }
  return data;
}

function normalizeUrl(s) {
  s = (s || '').trim();
  if (!s) return '';
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s;
  return s;
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function showError(sel, msg) {
  const el = $(sel);
  el.textContent = msg || '';
  el.hidden = !msg;
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

function busy(btn, on, label) {
  if (on) {
    btn.dataset.label = btn.textContent;
    if (label) btn.textContent = label;
    btn.disabled = true;
  } else {
    if (btn.dataset.label) btn.textContent = btn.dataset.label;
    btn.disabled = false;
  }
}

const field = (form, name) => form.elements.namedItem(name);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Small confirm / prompt dialog. Resolves to true, the typed value, or null.
function ask({ title, text = '', ok = 'OK', input = null }) {
  const d = $('#ask'), inp = $('#ask-input');
  $('#ask-title').textContent = title;
  $('#ask-text').textContent = text;
  $('#ask-ok').textContent = ok;
  inp.hidden = !input;
  inp.value = '';
  inp.required = !!input;
  if (input) { inp.type = input; inp.minLength = 6; inp.autocomplete = 'new-password'; }
  d.returnValue = '';
  d.showModal();
  (input ? inp : $('#ask-ok')).focus();
  return new Promise((resolve) => {
    d.addEventListener('close', () => {
      resolve(d.returnValue === 'ok' ? (input ? inp.value : true) : null);
    }, { once: true });
  });
}

// ---------- boot & auth ----------

async function boot() {
  let s;
  try { s = await api('GET', '/api/state'); }
  catch (e) { toast('Cannot reach Crumbs: ' + e.message); return; }
  S.me = s.user; S.guest = s.guest; S.loginRequired = s.loginRequired;
  if (s.setup) return showAuth('setup');
  if (!s.user) return showAuth('login');
  showApp();
  try { await loadBookmarks(); } catch (e) { toast(e.message); }
  handleAddParam();
}

let authMode = 'login';
function showAuth(mode, canGoBack = false) {
  authMode = mode;
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  $('#app').hidden = true;
  $('#auth').hidden = false;
  const f = $('#auth-form');
  f.reset();
  const setup = mode === 'setup';
  $('#auth-sub').textContent = setup
    ? 'Welcome! Create the first account. It becomes the admin.'
    : 'Sign in to see your crumbs.';
  $('#auth-confirm').hidden = !setup;
  field(f, 'confirm').required = setup;
  field(f, 'password').autocomplete = setup ? 'new-password' : 'current-password';
  $('#auth-submit').textContent = setup ? 'Create admin account' : 'Sign in';
  $('#auth-back').hidden = !canGoBack;
  showError('#auth-error', '');
  field(f, 'username').focus();
}

$('#auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const username = field(f, 'username').value.trim();
  const password = field(f, 'password').value;
  if (authMode === 'setup' && password !== field(f, 'confirm').value) {
    return showError('#auth-error', 'The passwords do not match.');
  }
  const btn = $('#auth-submit');
  busy(btn, true, authMode === 'setup' ? 'Creating…' : 'Signing in…');
  try {
    await api('POST', authMode === 'setup' ? '/api/setup' : '/api/login', { username, password });
    await boot();
  } catch (err) {
    showError('#auth-error', err.message);
  } finally {
    busy(btn, false);
  }
});
$('#auth-back').addEventListener('click', () => boot());

function showApp() {
  $('#auth').hidden = true;
  $('#app').hidden = false;
  $('#who').textContent = S.guest ? 'Guest' : S.me.username;
  $('#who').title = S.guest ? `Browsing ${S.me.username}'s crumbs without signing in` : '';
  $('#settings-btn').hidden = S.guest;
  $('#signout-btn').hidden = S.guest;
  $('#signin-btn').hidden = !S.guest;
}

$('#signout-btn').addEventListener('click', async () => {
  try { await api('POST', '/api/logout'); } catch { /* ignore */ }
  boot();
});
$('#signin-btn').addEventListener('click', () => showAuth('login', true));

// ---------- bookmarks list ----------

async function loadBookmarks() {
  const data = await api('GET', '/api/bookmarks');
  S.list = data.bookmarks || [];
  cards = new Map(S.list.map((b) => [b.id, card(b)]));
  $('#grid').replaceChildren(...cards.values());
  renderFolders();
  applyFilter();
}

function card(b) {
  const host = hostOf(b.url);
  const letter = [...(b.name || host || '?').trim()][0] || '?';
  const thumb = h('div', { class: 'thumb' },
    b.thumb
      ? h('img', { src: b.thumb, alt: '', loading: 'lazy', decoding: 'async' })
      : h('div', { class: 'thumb-empty' },
          b.icon ? h('img', { src: b.icon, alt: '', loading: 'lazy' }) : h('span', { text: letter.toUpperCase() })));

  const body = h('div', { class: 'card-body' },
    h('div', { class: 'card-title' },
      b.icon ? h('img', { class: 'fav', src: b.icon, alt: '', loading: 'lazy' }) : null,
      h('span', { text: b.name })),
    h('div', { class: 'card-meta' },
      h('span', { text: host }),
      b.folder ? h('span', { class: 'tag', text: b.folder }) : null),
    b.description ? h('p', { class: 'card-desc', text: b.description }) : null);

  const edit = h('button', {
    class: 'card-edit', type: 'button', title: 'Edit', 'aria-label': `Edit ${b.name}`,
    onclick: () => openEditor(b),
  });
  edit.innerHTML = EDIT_ICON;

  return h('article', { class: 'card' },
    h('a', { class: 'card-link', href: b.url, target: '_blank', rel: 'noopener noreferrer', title: b.url }, thumb, body),
    edit);
}

function renderFolders() {
  const counts = new Map();
  let unfiled = 0;
  for (const b of S.list) {
    if (b.folder) counts.set(b.folder, (counts.get(b.folder) || 0) + 1);
    else unfiled++;
  }
  const names = [...counts.keys()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  if (S.folder !== null && S.folder !== '' && !counts.has(S.folder)) S.folder = null;
  if (S.folder === '' && !unfiled) S.folder = null;

  const chip = (label, value, n) => h('button', {
    type: 'button',
    class: 'chip' + (S.folder === value ? ' active' : ''),
    onclick: () => { S.folder = value; renderFolders(); applyFilter(); },
  }, label, h('span', { class: 'chip-n', text: String(n) }));

  const chips = [chip('All', null, S.list.length), ...names.map((n) => chip(n, n, counts.get(n)))];
  if (unfiled && names.length) chips.push(chip('No folder', '', unfiled));
  const nav = $('#folders');
  nav.replaceChildren(...chips);
  nav.hidden = names.length === 0;
  $('#folder-list').replaceChildren(...names.map((n) => h('option', { value: n })));
}

function applyFilter() {
  const terms = S.q.toLowerCase().split(/\s+/).filter(Boolean);
  let shown = 0;
  for (const b of S.list) {
    let ok = S.folder === null || b.folder === S.folder;
    if (ok && terms.length) {
      const hay = `${b.name} ${b.url} ${b.description} ${b.folder}`.toLowerCase();
      ok = terms.every((t) => hay.includes(t));
    }
    cards.get(b.id).hidden = !ok;
    if (ok) shown++;
  }
  const empty = $('#empty');
  empty.hidden = shown > 0;
  empty.textContent = S.list.length
    ? 'No crumbs match that.'
    : 'No crumbs yet. Hit “+ Add” and drop your first one.';
}

const q = $('#q');
q.addEventListener('input', () => { S.q = q.value; applyFilter(); });
q.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { q.value = ''; S.q = ''; applyFilter(); q.blur(); }
});
document.addEventListener('keydown', (e) => {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
  if (document.querySelector('dialog[open]') || $('#app').hidden) return;
  if (/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
  e.preventDefault();
  q.focus();
});

$('#add-btn').addEventListener('click', () => openEditor());

// Bookmarklet support: http://pi:9099/?add=<url>
function handleAddParam() {
  const params = new URLSearchParams(location.search);
  const url = params.get('add');
  if (!url) return;
  history.replaceState(null, '', '/');
  openEditor(null, url);
}

// ---------- image handling (runs in the browser) ----------

// Download an image. Try the site directly first; most sites block that with
// CORS, so fall back to the Pi's relay, which just passes the bytes through.
async function grab(url) {
  let res = null;
  try {
    res = await fetch(url, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(8000) });
  } catch { res = null; }
  if (res) {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const blob = await res.blob();
    if (blob.size) return blob;
  }
  res = await fetch('/api/fetch?url=' + encodeURIComponent(url), { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error('relay ' + res.status);
  return res.blob();
}

function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve({ img, done: () => URL.revokeObjectURL(url) });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('not an image')); };
    img.src = url;
  });
}

function canvasBlob(c, type, quality) {
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), type, quality));
}

// Make a 640x360 JPEG thumbnail.
//   mode 'auto': crop wide images, letterbox square/tall ones (logos)
//   mode 'top' : always fill, anchored to the top (good for screenshots)
async function makeThumb(blob, mode = 'auto') {
  const { img, done } = await loadImage(blob);
  try {
    const w = img.naturalWidth || 640, hgt = img.naturalHeight || 360;
    if (mode === 'auto' && (w < 100 || hgt < 60)) throw new Error('too small');
    const W = 640, H = 360;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingQuality = 'high';
    const ratio = w / hgt;
    const cover = mode === 'top' || (ratio > 1.25 && ratio < 2.4);
    const scale = cover ? Math.max(W / w, H / hgt) : Math.min(W / w, H / hgt, 3);
    const dw = w * scale, dh = hgt * scale;
    const y = mode === 'top' ? 0 : (H - dh) / 2;
    ctx.drawImage(img, (W - dw) / 2, y, dw, dh);
    return await canvasBlob(c, 'image/jpeg', 0.85);
  } finally { done(); }
}

// Make a 64x64 PNG favicon.
async function makeIcon(blob) {
  const { img, done } = await loadImage(blob);
  try {
    const w = img.naturalWidth || 64, hgt = img.naturalHeight || 64;
    const N = 64;
    const c = document.createElement('canvas');
    c.width = N; c.height = N;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    const scale = Math.min(N / w, N / hgt);
    const dw = w * scale, dh = hgt * scale;
    ctx.drawImage(img, (N - dw) / 2, (N - dh) / 2, dw, dh);
    return await canvasBlob(c, 'image/png');
  } finally { done(); }
}

async function firstOk(urls, convert) {
  for (const u of urls || []) {
    try { return await convert(await grab(u)); } catch { /* try the next one */ }
  }
  return null;
}

// ---------- editor ----------

const dlg = $('#edit');
const form = $('#edit-form');
const F = (n) => field(form, n);
let ed = null;

function newEditorState(b) {
  return {
    id: b ? b.id : null,
    seq: 0,
    fetched: b ? b.url : '',
    autoName: '', autoDesc: '',
    thumb: undefined, // undefined = unchanged, null = remove, Blob = new image
    icon: undefined,
    manualThumb: false,
    pending: null,
    urls: [],
  };
}

function openEditor(b = null, presetUrl = '') {
  if (ed) cleanupEditor();
  form.reset();
  ed = newEditorState(b);
  $('#edit-title').textContent = b ? 'Edit crumb' : 'Add crumb';
  $('#edit-delete').hidden = !b;
  $('#tp-refetch').textContent = b ? 'Refetch preview' : 'Fetch preview';
  showError('#edit-error', '');
  if (b) {
    F('url').value = b.url;
    F('name').value = b.name;
    F('description').value = b.description;
    F('folder').value = b.folder;
  } else if (S.folder) {
    F('folder').value = S.folder;
  }
  setPreview(b && b.thumb ? b.thumb : null);
  setStatus(b ? (b.thumb ? '' : 'No thumbnail yet') : 'Paste a link to fetch a preview');
  setFav(b && b.icon ? b.icon : null);
  dlg.showModal();
  if (presetUrl) {
    F('url').value = presetUrl;
    fetchPreview();
    F('name').focus();
  } else {
    (b ? F('name') : F('url')).focus();
  }
}

function cleanupEditor() {
  if (!ed) return;
  ed.seq++; // cancel anything in flight
  ed.urls.forEach((u) => URL.revokeObjectURL(u));
  ed.urls = [];
}
dlg.addEventListener('close', cleanupEditor);

function objURL(blob) {
  const u = URL.createObjectURL(blob);
  ed.urls.push(u);
  return u;
}

function setPreview(src) {
  const img = $('#tp-img');
  img.hidden = !src;
  if (src) img.src = src; else img.removeAttribute('src');
  $('#tp-remove').hidden = !src;
}
function setStatus(text) { $('#tp-status').textContent = text || ''; }
function setFav(src) {
  const img = $('#fav-img');
  img.hidden = !src;
  if (src) img.src = src; else img.removeAttribute('src');
}
function setThumb(blob) {
  ed.thumb = blob;
  setPreview(blob ? objURL(blob) : null);
}

function fillAuto(name, value, key) {
  if (!value) return;
  const el = F(name);
  if (!el.value.trim() || el.value === ed[key]) {
    el.value = value;
    ed[key] = value;
  }
}

async function fetchPreview(force = false) {
  const url = normalizeUrl(F('url').value);
  if (!url) return;
  F('url').value = url;
  if (!force && url === ed.fetched) return;
  ed.fetched = url;
  if (force) ed.manualThumb = false;
  const cur = ed, seq = ++cur.seq;
  const alive = () => ed === cur && cur.seq === seq;

  const run = (async () => {
    setStatus('Fetching preview…');
    let meta;
    try {
      meta = await api('GET', '/api/meta?url=' + encodeURIComponent(url));
    } catch (e) {
      if (alive()) setStatus('Could not fetch: ' + e.message);
      return;
    }
    if (!alive()) return;
    fillAuto('name', meta.title, 'autoName');
    fillAuto('description', meta.description, 'autoDesc');

    const [thumb, icon] = await Promise.all([
      cur.manualThumb ? null : firstOk(meta.images, (b) => makeThumb(b)),
      firstOk(meta.icons, makeIcon),
    ]);
    if (!alive()) return;
    if (icon) { cur.icon = icon; setFav(objURL(icon)); }
    if (cur.manualThumb) { setStatus(''); return; }
    if (thumb) {
      setThumb(thumb);
      setStatus('');
    } else if ($('#tp-img').hidden) {
      setStatus(meta.images.length
        ? 'The preview image could not be loaded. Upload or paste one.'
        : meta.error
          ? 'The site could not be reached. Upload or paste a thumbnail.'
          : 'No preview image on this page. Upload or paste one.');
    } else {
      setStatus('');
    }
  })();
  cur.pending = run;
  await run;
}

F('url').addEventListener('change', () => fetchPreview());
F('url').addEventListener('paste', () => setTimeout(() => fetchPreview(), 0));
$('#tp-refetch').addEventListener('click', () => {
  if (!normalizeUrl(F('url').value)) { F('url').focus(); return; }
  fetchPreview(true);
});

async function useUserImage(file) {
  if (!file || !ed) return;
  ed.manualThumb = true;
  try {
    setThumb(await makeThumb(file, 'top'));
    setStatus('');
  } catch {
    setStatus('That file is not an image Crumbs can read.');
  }
}

$('#tp-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  useUserImage(file);
});
$('#tp-remove').addEventListener('click', () => {
  ed.manualThumb = true;
  setThumb(null);
  setStatus('No thumbnail');
});

document.addEventListener('paste', (e) => {
  if (!dlg.open) return;
  const item = [...(e.clipboardData ? e.clipboardData.items : [])].find((i) => i.type.startsWith('image/'));
  if (!item) return;
  e.preventDefault();
  useUserImage(item.getAsFile());
});

const tp = $('#tp');
tp.addEventListener('dragover', (e) => { e.preventDefault(); tp.classList.add('drag'); });
tp.addEventListener('dragleave', () => tp.classList.remove('drag'));
tp.addEventListener('drop', (e) => {
  e.preventDefault();
  tp.classList.remove('drag');
  const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'));
  if (file) useUserImage(file);
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = normalizeUrl(F('url').value);
  if (!url) { showError('#edit-error', 'Please enter a URL.'); F('url').focus(); return; }
  const cur = ed, isNew = !cur.id;
  const btn = $('#edit-save');
  busy(btn, true, 'Saving…');
  showError('#edit-error', '');
  try {
    if (isNew && url !== cur.fetched) fetchPreview();
    if (cur.pending) await Promise.race([cur.pending, sleep(15000)]);
    const body = {
      url: F('url').value,
      name: F('name').value,
      description: F('description').value,
      folder: F('folder').value,
    };
    const b = isNew
      ? await api('POST', '/api/bookmarks', body)
      : await api('PUT', `/api/bookmarks/${cur.id}`, body);
    if (cur.thumb instanceof Blob) await api('PUT', `/api/bookmarks/${b.id}/thumb`, cur.thumb);
    else if (cur.thumb === null && !isNew) await api('DELETE', `/api/bookmarks/${b.id}/thumb`);
    if (cur.icon instanceof Blob) await api('PUT', `/api/bookmarks/${b.id}/icon`, cur.icon);
    dlg.close();
    await loadBookmarks();
    toast(isNew ? 'Crumb saved' : 'Changes saved');
  } catch (err) {
    showError('#edit-error', err.message);
  } finally {
    busy(btn, false);
  }
});

$('#edit-delete').addEventListener('click', async () => {
  const id = ed.id;
  const label = F('name').value || F('url').value;
  if (!(await ask({ title: 'Delete this crumb?', text: `“${label}” will be gone for good.`, ok: 'Delete' }))) return;
  try {
    await api('DELETE', `/api/bookmarks/${id}`);
    dlg.close();
    await loadBookmarks();
    toast('Crumb deleted');
  } catch (err) {
    showError('#edit-error', err.message);
  }
});

// Close buttons and backdrop clicks
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-close]');
  if (btn) btn.closest('dialog').close();
});
$('#settings').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });

// ---------- settings ----------

let ownerName = '';

$('#settings-btn').addEventListener('click', async () => {
  $('#pw-form').reset();
  showError('#pw-error', '');
  showError('#user-error', '');
  $('#admin-sec').hidden = !S.me.isAdmin;
  if (S.me.isAdmin) {
    try { await loadUsers(); } catch (e) { toast(e.message); }
  }
  $('#settings').showModal();
});

async function loadUsers() {
  const data = await api('GET', '/api/users');
  ownerName = data.owner;
  S.loginRequired = data.loginRequired;
  $('#login-req').checked = data.loginRequired;
  updateLoginNote();
  $('#user-list').replaceChildren(...data.users.map((u) => h('li', { class: 'user-row' },
    h('div', {},
      h('div', {}, h('strong', { text: u.username }), u.isAdmin ? h('span', { class: 'tag', text: 'admin' }) : null),
      h('div', { class: 'muted small', text: `${u.bookmarks} crumb${u.bookmarks === 1 ? '' : 's'}${u.id === S.me.id ? ' · you' : ''}` })),
    h('div', { class: 'row-actions' },
      h('button', { class: 'btn small', type: 'button', text: 'Reset password', onclick: () => resetPassword(u) }),
      u.id === S.me.id ? null : h('button', { class: 'btn small', type: 'button', text: 'Delete', onclick: () => deleteUser(u) })))));
}

function updateLoginNote() {
  $('#login-note').textContent = S.loginRequired
    ? 'Everyone has to sign in with a username and password.'
    : `Login is off: anyone who can reach this Pi sees and edits ${ownerName}'s crumbs without a password. Settings still need a sign-in.`;
}

$('#login-req').addEventListener('change', async (e) => {
  const on = e.target.checked;
  if (!on) {
    const ok = await ask({
      title: 'Turn off login?',
      text: `Anyone on your network will be able to open Crumbs and edit ${ownerName}'s crumbs without a password.`,
      ok: 'Turn off login',
    });
    if (!ok) { e.target.checked = true; return; }
  }
  try {
    await api('PUT', '/api/settings', { loginRequired: on });
    S.loginRequired = on;
    updateLoginNote();
    toast(on ? 'Login is now required' : 'Login is now off');
  } catch (err) {
    e.target.checked = !on;
    toast(err.message);
  }
});

$('#pw-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  if (field(f, 'new').value !== field(f, 'confirm').value) return showError('#pw-error', 'The new passwords do not match.');
  try {
    await api('POST', '/api/password', { current: field(f, 'current').value, new: field(f, 'new').value });
    f.reset();
    showError('#pw-error', '');
    toast('Password updated');
  } catch (err) {
    showError('#pw-error', err.message);
  }
});

$('#user-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  try {
    await api('POST', '/api/users', {
      username: field(f, 'username').value.trim(),
      password: field(f, 'password').value,
      isAdmin: field(f, 'isAdmin').checked,
    });
    f.reset();
    showError('#user-error', '');
    await loadUsers();
    toast('User added');
  } catch (err) {
    showError('#user-error', err.message);
  }
});

async function resetPassword(u) {
  const pw = await ask({ title: `New password for ${u.username}`, text: 'At least 6 characters. They will be signed out everywhere.', ok: 'Set password', input: 'password' });
  if (!pw) return;
  try {
    await api('PUT', `/api/users/${u.id}/password`, { password: pw });
    toast('Password changed');
  } catch (err) { toast(err.message); }
}

async function deleteUser(u) {
  const ok = await ask({ title: `Delete ${u.username}?`, text: `Their account and all ${u.bookmarks} of their crumbs will be deleted. This can't be undone.`, ok: 'Delete user' });
  if (!ok) return;
  try {
    await api('DELETE', `/api/users/${u.id}`);
    await loadUsers();
    toast('User deleted');
  } catch (err) { toast(err.message); }
}

boot();
