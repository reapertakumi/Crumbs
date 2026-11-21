'use strict';

/* Crumbs front end. No framework, no build step.
 *
 * Thumbnails, favicons and profile photos are downloaded/resized here in the
 * browser, then uploaded to the Pi as small JPEG/PNG files. The Pi only
 * stores them. */

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

// ---------- icons (24x24 line icons) ----------

const UI_ICONS = {
  chevron: '<path d="M6 9l6 6 6-6"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  inbox: '<path d="M3 13l2.5-7.5A2 2 0 0 1 7.4 4h9.2a2 2 0 0 1 1.9 1.5L21 13v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 13h5l1.5 2.5h5L16 13h5"/>',
  all: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3"/>',
};

// Profile picture choices. Drawn in black & white like everything else.
const AVATAR_ICONS = {
  cookie: '<circle cx="12" cy="12" r="9"/><path d="M8.5 9h.01M14 8h.01M15.5 13.5h.01M9.5 15h.01M12 11.5h.01" stroke-width="3"/>',
  cat: '<path d="M5 20V6l4 3h6l4-3v14z"/><path d="M9.5 13h.01M14.5 13h.01" stroke-width="3"/><path d="M11 16.5h2"/>',
  ghost: '<path d="M6 20v-9a6 6 0 0 1 12 0v9l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5z"/><path d="M10 10.5h.01M14 10.5h.01" stroke-width="3"/>',
  rocket: '<path d="M12 2.5c3 2.2 4.5 5.6 4.5 9.5l-1.5 4h-6L7.5 12c0-3.9 1.5-7.3 4.5-9.5z"/><circle cx="12" cy="9.5" r="1.8"/><path d="M10 19l2 2.5 2-2.5"/>',
  leaf: '<path d="M5 19C5 10 11 5 20 4c-.5 9-6 15-15 15z"/><path d="M5 19l8-8"/>',
  coffee: '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 3.5V6M12 3.5V6"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  bolt: '<path d="M13 2.5L5 14h6l-1 7.5L18 10h-6z"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z"/>',
  music: '<path d="M9 18V5.5l10-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  planet: '<circle cx="12" cy="12" r="5.5"/><ellipse cx="12" cy="12" rx="10" ry="3.5" transform="rotate(-20 12 12)"/>',
  mountain: '<path d="M2.5 19.5l6.5-11 4 6.5 2.5-3.5 6 8z"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5s1.3 2 3.5 2 3.5-2 3.5-2"/><path d="M9 9.5h.01M15 9.5h.01" stroke-width="3"/>',
  code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 4.5l-3 15"/>',
  flame: '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-4.3 3.6-6.3 4.5-10.3 3.4 2 7.5 5.7 7.5 10.3 0 3.6-2.6 6.2-5.5 6.2z"/><path d="M12 21c-1.6 0-2.7-1.2-2.7-2.8 0-2 1.6-3 2.2-4.7 1.6 1 3.2 2.7 3.2 4.7 0 1.6-1.1 2.8-2.7 2.8z"/>',
};

function icon(name, cls = '', set = UI_ICONS) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  if (cls) svg.setAttribute('class', cls);
  svg.innerHTML = set[name] || '';
  return svg;
}

// ---------- preferences (saved in this browser) ----------

function readStore(key, def) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v && typeof v === 'object' ? v : def; } catch { return def; }
}
function writeStore(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* storage blocked */ }
}

const prefs = Object.assign(
  { theme: 'system', size: 'm', newTab: true, sort: { key: 'created', dir: 'desc' }, sideOpen: false },
  readStore('crumbs.prefs', {}));
const savePrefs = () => writeStore('crumbs.prefs', prefs);

function applyPrefs() {
  const root = document.documentElement;
  if (prefs.theme === 'light' || prefs.theme === 'dark') root.dataset.theme = prefs.theme;
  else delete root.dataset.theme;
  root.dataset.size = prefs.size;
}
applyPrefs();

// Which folders are expanded in the sidebar. Folders start collapsed,
// Uncategorized starts open.
const treeState = (() => {
  const t = readStore('crumbs.tree', {});
  return { open: new Set(Array.isArray(t.open) ? t.open : []), uncatClosed: !!t.uncatClosed };
})();
const saveTree = () => writeStore('crumbs.tree', { open: [...treeState.open], uncatClosed: treeState.uncatClosed });

// ---------- state ----------

const S = {
  me: null, guest: false, loginRequired: true,
  list: [], folders: [],
  fmap: new Map(),     // id -> folder
  kids: new Map(),     // parent id (0 = top) -> child folders
  totals: new Map(),   // folder id -> crumbs inside, including subfolders
  view: null,          // null = all, 0 = Uncategorized, n = folder id
  q: '',
};
let cards = new Map();

const coll = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

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
const firstLetter = (s) => ([...(s || '?').trim()][0] || '?').toUpperCase();

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
const wide = () => matchMedia('(min-width: 1000px)').matches;
const narrow = () => matchMedia('(max-width: 820px)').matches;

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

function fillAvatar(el, u) {
  const av = (u && u.avatar) || '';
  if (av.startsWith('/avatar/')) {
    el.replaceChildren(h('img', { src: av, alt: '' }));
  } else if (av.startsWith('icon:') && AVATAR_ICONS[av.slice(5)]) {
    el.replaceChildren(icon(av.slice(5), '', AVATAR_ICONS));
  } else {
    el.replaceChildren(document.createTextNode(firstLetter(u && u.username)));
  }
  return el;
}
const avatarEl = (u, cls = '') => fillAvatar(h('span', { class: 'avatar ' + cls }), u);

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
  closeMenus();
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
  renderMe();
  renderSortMenu();
  setSidebar(prefs.sideOpen && wide(), false);
}

async function signOut() {
  try { await api('POST', '/api/logout'); } catch { /* ignore */ }
  boot();
}

// ---------- header: dropdown menus ----------

function closeMenus(except) {
  document.querySelectorAll('.dd.open').forEach((dd) => {
    if (dd === except) return;
    dd.classList.remove('open');
    dd.querySelector('[data-dd]').setAttribute('aria-expanded', 'false');
  });
}

document.addEventListener('click', (e) => {
  const trigger = e.target.closest('[data-dd]');
  if (trigger) {
    const dd = trigger.closest('.dd');
    const open = !dd.classList.contains('open');
    closeMenus(dd);
    dd.classList.toggle('open', open);
    trigger.setAttribute('aria-expanded', String(open));
    return;
  }
  // Sort options keep the menu open so a second click can flip the order.
  // (composedPath, because the sort menu redraws itself during the click.)
  if (!e.composedPath().includes($('#sort-menu'))) closeMenus();

  const act = e.target.closest('[data-act]');
  if (act) runAction(act.dataset.act);

  const close = e.target.closest('[data-close]');
  if (close) close.closest('dialog').close();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.querySelector('.dd.open')) { closeMenus(); return; }
  if (e.key === 'Escape' && document.body.classList.contains('side-open') && !wide() && !document.querySelector('dialog[open]')) {
    setSidebar(false);
    return;
  }
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
  if (document.querySelector('dialog[open]') || $('#app').hidden) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
  e.preventDefault();
  q.focus();
});

function runAction(name) {
  switch (name) {
    case 'add-bookmark': return openEditor();
    case 'add-folder': return openFolderDialog(null, S.view > 0 ? S.view : null);
    case 'admin': return openAdmin();
    case 'profile': return openProfile();
    case 'settings': return openSettings();
    case 'signout': return signOut();
    case 'signin': return showAuth('login', true);
  }
}

function renderMe() {
  const guestUser = { username: 'Guest', avatar: '' };
  const u = S.guest ? guestUser : S.me;
  $('#me-name').textContent = u.username;
  fillAvatar($('#me-avatar'), u);
  const item = (act, ic, label) => h('button', { type: 'button', role: 'menuitem', 'data-act': act }, icon(ic), label);
  const head = h('div', { class: 'menu-head' }, avatarEl(u, 'sm'),
    h('div', {}, h('strong', { text: u.username }),
      h('span', { class: 'muted small', text: S.guest ? `Using ${S.me.username}'s crumbs` : (S.me.isAdmin ? 'Admin' : 'Member') })));
  const items = S.guest
    ? [item('settings', 'gear', 'Settings'), h('hr'), item('signin', 'logout', 'Sign in')]
    : [S.me.isAdmin ? item('admin', 'shield', 'Admin') : null,
       item('profile', 'user', 'Profile'),
       item('settings', 'gear', 'Settings'),
       h('hr'),
       item('signout', 'logout', 'Sign out')];
  $('#me-menu').replaceChildren(head, h('hr'), ...items);
}

// ---------- sorting ----------

const SORTS = [
  { key: 'title', label: 'Title', def: 'asc', get: (b) => b.name },
  { key: 'created', label: 'Date created', def: 'desc', num: true, get: (b) => b.created },
  { key: 'updated', label: 'Last updated', def: 'desc', num: true, get: (b) => b.updated },
  { key: 'url', label: 'URL', def: 'asc', get: (b) => b.url.replace(/^https?:\/\/(www\.)?/i, '') },
  { key: 'description', label: 'Description', def: 'asc', get: (b) => b.description },
  { key: 'folder', label: 'Folder', def: 'asc', get: (b) => folderPath(b.folderId) },
];
const currentSort = () => SORTS.find((s) => s.key === prefs.sort.key) || SORTS[1];
const dirText = (s, dir) => (s.num ? (dir === 'asc' ? 'Oldest first' : 'Newest first') : (dir === 'asc' ? 'A to Z' : 'Z to A'));

function sorted(list) {
  const s = currentSort();
  const dir = prefs.sort.dir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    let c;
    if (s.num) {
      c = (s.get(a) - s.get(b)) * dir;
    } else {
      const x = s.get(a) || '', y = s.get(b) || '';
      if (!x !== !y) return x ? -1 : 1; // empty values always go last
      c = coll.compare(x, y) * dir;
    }
    return c || (b.created - a.created) || (b.id - a.id);
  });
}

function renderSortMenu() {
  const cur = currentSort();
  $('#sort-menu').replaceChildren(
    h('div', { class: 'menu-cap', text: 'Sort by' }),
    ...SORTS.map((s) => {
      const active = s.key === cur.key;
      const desc = active && prefs.sort.dir === 'desc';
      return h('button', {
        type: 'button', role: 'menuitemradio', 'aria-checked': String(active),
        class: 'sort-item' + (active ? ' active' : '') + (desc ? ' desc' : ''),
        onclick: () => setSort(s),
      }, s.label, active ? h('span', { class: 'dir-txt', text: dirText(s, prefs.sort.dir) }) : null, icon('arrowUp', 'dir'));
    }));
  const btn = $('#sort-btn');
  btn.title = `Sorted by ${cur.label.toLowerCase()}, ${dirText(cur, prefs.sort.dir).toLowerCase()}`;
}

function setSort(s) {
  if (prefs.sort.key === s.key) prefs.sort.dir = prefs.sort.dir === 'asc' ? 'desc' : 'asc';
  else prefs.sort = { key: s.key, dir: s.def };
  savePrefs();
  renderSortMenu();
  orderGrid();
  renderTree();
}

// ---------- search (expands when used) ----------

const q = $('#q');
const searchBox = $('#search');
function setSearchOpen(open) {
  searchBox.classList.toggle('open', open);
  $('#top').classList.toggle('searching', open && narrow());
}
q.addEventListener('focus', () => setSearchOpen(true));
q.addEventListener('blur', () => { if (!q.value || narrow()) setSearchOpen(false); });
q.addEventListener('input', () => { S.q = q.value; filterGrid(); });
q.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { q.value = ''; S.q = ''; filterGrid(); q.blur(); }
});

// ---------- folders (data) ----------

function indexFolders() {
  S.fmap = new Map(S.folders.map((f) => [f.id, f]));
  S.kids = new Map();
  for (const f of S.folders) {
    const p = f.parentId && S.fmap.has(f.parentId) ? f.parentId : 0;
    if (!S.kids.has(p)) S.kids.set(p, []);
    S.kids.get(p).push(f);
  }
  for (const list of S.kids.values()) list.sort((a, b) => coll.compare(a.name, b.name));
  S.totals = new Map();
  for (const b of S.list) {
    for (let id = b.folderId, guard = 0; id && S.fmap.has(id) && guard < 100; id = S.fmap.get(id).parentId, guard++) {
      S.totals.set(id, (S.totals.get(id) || 0) + 1);
    }
  }
}

function folderPath(id) {
  const parts = [];
  for (let cur = id, guard = 0; cur && S.fmap.has(cur) && guard < 100; cur = S.fmap.get(cur).parentId, guard++) {
    parts.unshift(S.fmap.get(cur).name);
  }
  return parts.join(' / ');
}

function subtree(id) {
  const out = new Set([id]);
  const walk = (pid) => (S.kids.get(pid) || []).forEach((f) => { out.add(f.id); walk(f.id); });
  walk(id);
  return out;
}

// Fill a <select> with the folder tree.
function folderOptions(select, { selected = null, exclude = new Set(), rootLabel, allowNew = false }) {
  const opts = [h('option', { value: '', text: rootLabel })];
  const walk = (pid, depth) => {
    for (const f of S.kids.get(pid) || []) {
      if (exclude.has(f.id)) continue;
      opts.push(h('option', { value: String(f.id), text: ' '.repeat(depth) + f.name }));
      walk(f.id, depth + 1);
    }
  };
  walk(0, 0);
  if (allowNew) opts.push(h('option', { value: '__new', text: '+ New folder…' }));
  select.replaceChildren(...opts);
  select.value = selected == null ? '' : String(selected);
}

// ---------- bookmarks list ----------

async function loadBookmarks() {
  const data = await api('GET', '/api/bookmarks');
  S.list = data.bookmarks || [];
  S.folders = data.folders || [];
  indexFolders();
  if (S.view > 0 && !S.fmap.has(S.view)) S.view = null;
  buildCards();
  renderTree();
}

function buildCards() {
  cards = new Map(S.list.map((b) => [b.id, card(b)]));
  orderGrid();
}

function card(b) {
  const host = hostOf(b.url);
  const thumb = h('div', { class: 'thumb' },
    b.thumb
      ? h('img', { src: b.thumb, alt: '', loading: 'lazy', decoding: 'async' })
      : h('div', { class: 'thumb-empty' },
          b.icon ? h('img', { src: b.icon, alt: '', loading: 'lazy' }) : h('span', { text: firstLetter(b.name || host) })));
  const folder = b.folderId && S.fmap.get(b.folderId);
  const body = h('div', { class: 'card-body' },
    h('div', { class: 'card-title' },
      b.icon ? h('img', { class: 'fav', src: b.icon, alt: '', loading: 'lazy' }) : null,
      h('span', { text: b.name })),
    h('div', { class: 'card-meta' },
      h('span', { text: host }),
      folder ? h('span', { class: 'tag', text: folder.name, title: folderPath(folder.id) }) : null),
    b.description ? h('p', { class: 'card-desc', text: b.description }) : null);

  const edit = h('button', {
    class: 'card-edit', type: 'button', title: 'Edit', 'aria-label': `Edit ${b.name}`,
    onclick: () => openEditor(b),
  }, icon('edit'));

  return h('article', { class: 'card' },
    h('a', { class: 'card-link', href: b.url, target: prefs.newTab ? '_blank' : null, rel: 'noopener noreferrer', title: b.url }, thumb, body),
    edit);
}

function inView(b) {
  if (S.view === null) return true;
  if (S.view === 0) return !b.folderId || !S.fmap.has(b.folderId);
  return viewSet.has(b.folderId);
}
let viewSet = new Set();

// Put the cards in sort order (only needed when data or sort changes).
function orderGrid() {
  const grid = $('#grid');
  grid.replaceChildren(...sorted(S.list).map((b) => cards.get(b.id)));
  filterGrid();
}

function filterGrid() {
  viewSet = S.view > 0 ? subtree(S.view) : new Set();
  const terms = S.q.toLowerCase().split(/\s+/).filter(Boolean);
  let shown = 0;
  for (const b of S.list) {
    let ok = inView(b);
    if (ok && terms.length) {
      const hay = `${b.name} ${b.url} ${b.description} ${folderPath(b.folderId)}`.toLowerCase();
      ok = terms.every((t) => hay.includes(t));
    }
    cards.get(b.id).hidden = !ok;
    if (ok) shown++;
  }

  $('#view-title').textContent = S.view === null ? 'All crumbs' : S.view === 0 ? 'Uncategorized' : folderPath(S.view);
  $('#view-clear').hidden = S.view === null;
  $('#view-count').textContent = S.q.trim()
    ? `${shown} result${shown === 1 ? '' : 's'} for “${S.q.trim()}”`
    : `${shown} crumb${shown === 1 ? '' : 's'}`;
  const empty = $('#empty');
  empty.hidden = shown > 0;
  empty.textContent = !S.list.length
    ? 'No crumbs yet. Hit “Add” and drop your first one.'
    : S.q.trim() ? 'No crumbs match that.' : 'This folder is empty.';
}

function selectView(v) {
  S.view = v;
  filterGrid();
  renderTree();
  if (!wide()) setSidebar(false);
}
$('#view-clear').addEventListener('click', () => selectView(null));

// Bookmarklet support: http://pi:9099/?add=<url>
function handleAddParam() {
  const params = new URLSearchParams(location.search);
  const url = params.get('add');
  if (!url) return;
  history.replaceState(null, '', '/');
  openEditor(null, url);
}

// ---------- sidebar ----------

function setSidebar(open, remember = true) {
  document.body.classList.toggle('side-open', open);
  $('#menu-btn').setAttribute('aria-expanded', String(open));
  $('#menu-btn').setAttribute('aria-label', open ? 'Hide folders' : 'Show folders');
  $('#scrim').hidden = !open;
  if (remember && wide()) { prefs.sideOpen = open; savePrefs(); }
}
$('#menu-btn').addEventListener('click', () => setSidebar(!document.body.classList.contains('side-open')));
$('#scrim').addEventListener('click', () => setSidebar(false));

const actBtn = (ic, label, fn) => h('button', { type: 'button', title: label, 'aria-label': label, onclick: fn }, icon(ic));

function twisty(hasKids, collapsed, onToggle) {
  if (!hasKids) return h('span', { class: 'twisty none' });
  return h('button', {
    type: 'button', class: 'twisty',
    'aria-label': collapsed ? 'Expand' : 'Collapse', 'aria-expanded': String(!collapsed),
    onclick: onToggle,
  }, icon('chevron'));
}

function toggleNode(node, btn, onChange) {
  const collapsed = node.classList.toggle('collapsed');
  btn.setAttribute('aria-expanded', String(!collapsed));
  btn.setAttribute('aria-label', collapsed ? 'Expand' : 'Collapse');
  onChange(collapsed);
  saveTree();
}

function renderTree() {
  const tabsIn = new Map();
  for (const b of sorted(S.list)) {
    const key = b.folderId && S.fmap.has(b.folderId) ? b.folderId : 0;
    if (!tabsIn.has(key)) tabsIn.set(key, []);
    tabsIn.get(key).push(b);
  }

  const all = h('div', { class: 'ti' + (S.view === null ? ' active' : '') },
    h('span', { class: 'twisty none' }),
    icon('all', 'ico'),
    h('button', { type: 'button', class: 'label', text: 'All crumbs', onclick: () => selectView(null) }),
    h('span', { class: 'count', text: String(S.list.length) }));

  const top = (S.kids.get(0) || []).map((f) => folderNode(f, 0, tabsIn));
  $('#tree').replaceChildren(all, h('div', { class: 'tree-sep' }), ...top, uncategorizedNode(tabsIn.get(0) || []));
}

function folderNode(f, depth, tabsIn) {
  const subs = S.kids.get(f.id) || [];
  const tabs = tabsIn.get(f.id) || [];
  const hasKids = subs.length + tabs.length > 0;
  const collapsed = !treeState.open.has(f.id);
  const node = h('div', { class: 'node' + (collapsed ? ' collapsed' : '') });
  node.style.setProperty('--depth', depth);

  const tw = twisty(hasKids, collapsed, () => toggleNode(node, tw, (c) => {
    if (c) treeState.open.delete(f.id); else treeState.open.add(f.id);
  }));
  const row = h('div', { class: 'ti folder' + (S.view === f.id ? ' active' : '') },
    tw,
    icon('folder', 'ico'),
    h('button', { type: 'button', class: 'label', text: f.name, title: folderPath(f.id), onclick: () => selectView(f.id) }),
    h('span', { class: 'count', text: String(S.totals.get(f.id) || 0) }),
    h('span', { class: 'acts' },
      actBtn('plus', 'New folder inside', () => openFolderDialog(null, f.id)),
      actBtn('edit', 'Edit folder', () => openFolderDialog(f))));

  const inner = h('div', { class: 'inner' },
    ...subs.map((s) => folderNode(s, depth + 1, tabsIn)),
    ...tabs.map((b) => tabRow(b, depth + 1)));
  node.append(row, h('div', { class: 'kids' }, inner));
  return node;
}

function uncategorizedNode(tabs) {
  const collapsed = treeState.uncatClosed;
  const node = h('div', { class: 'node' + (collapsed ? ' collapsed' : '') });
  node.style.setProperty('--depth', 0);
  const tw = twisty(tabs.length > 0, collapsed, () => toggleNode(node, tw, (c) => { treeState.uncatClosed = c; }));
  const row = h('div', { class: 'ti folder' + (S.view === 0 ? ' active' : '') },
    tw,
    icon('inbox', 'ico'),
    h('button', { type: 'button', class: 'label', text: 'Uncategorized', onclick: () => selectView(0) }),
    h('span', { class: 'count', text: String(tabs.length) }));
  const inner = h('div', { class: 'inner' }, ...tabs.map((b) => tabRow(b, 1)));
  node.append(row, h('div', { class: 'kids' }, inner));
  return node;
}

function tabRow(b, depth) {
  const row = h('div', { class: 'ti tab' },
    h('span', { class: 'twisty none' }),
    b.icon ? h('img', { class: 'fav', src: b.icon, alt: '', loading: 'lazy' }) : h('span', { class: 'dot', text: firstLetter(b.name) }),
    h('a', { class: 'label', href: b.url, target: prefs.newTab ? '_blank' : null, rel: 'noopener noreferrer', text: b.name, title: b.url }),
    h('span', { class: 'acts' }, actBtn('edit', 'Edit bookmark', () => openEditor(b))));
  row.style.setProperty('--depth', depth);
  return row;
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

// Make a 256x256 JPEG profile photo (center crop).
async function makeSquare(blob) {
  const { img, done } = await loadImage(blob);
  try {
    const w = img.naturalWidth, hgt = img.naturalHeight;
    if (!w || !hgt) throw new Error('not an image');
    const N = 256, side = Math.min(w, hgt);
    const c = document.createElement('canvas');
    c.width = N; c.height = N;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (w - side) / 2, (hgt - side) / 2, side, side, 0, 0, N, N);
    return await canvasBlob(c, 'image/jpeg', 0.88);
  } finally { done(); }
}

async function firstOk(urls, convert) {
  for (const u of urls || []) {
    try { return await convert(await grab(u)); } catch { /* try the next one */ }
  }
  return null;
}

// ---------- bookmark editor ----------

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
    folderPrev: '',
  };
}

function openEditor(b = null, presetUrl = '') {
  if (ed) cleanupEditor();
  form.reset();
  ed = newEditorState(b);
  $('#edit-title').textContent = b ? 'Edit bookmark' : 'Add bookmark';
  $('#edit-delete').hidden = !b;
  $('#tp-refetch').textContent = b ? 'Refetch preview' : 'Fetch preview';
  showError('#edit-error', '');
  const folderId = b ? b.folderId : (S.view > 0 ? S.view : null);
  folderOptions(F('folder'), { selected: folderId && S.fmap.has(folderId) ? folderId : null, rootLabel: 'Uncategorized', allowNew: true });
  ed.folderPrev = F('folder').value;
  if (b) {
    F('url').value = b.url;
    F('name').value = b.name;
    F('description').value = b.description;
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

F('folder').addEventListener('change', async () => {
  const sel = F('folder');
  if (sel.value !== '__new') { ed.folderPrev = sel.value; return; }
  const cur = ed;
  const created = await openFolderDialog(null, ed.folderPrev ? Number(ed.folderPrev) : null);
  if (ed !== cur) return;
  const value = created ? String(created.id) : cur.folderPrev;
  folderOptions(sel, { selected: value ? Number(value) : null, rootLabel: 'Uncategorized', allowNew: true });
  cur.folderPrev = sel.value;
});

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

    const [thumb, ico] = await Promise.all([
      cur.manualThumb ? null : firstOk(meta.images, (b) => makeThumb(b)),
      firstOk(meta.icons, makeIcon),
    ]);
    if (!alive()) return;
    if (ico) { cur.icon = ico; setFav(objURL(ico)); }
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
    const folder = F('folder').value;
    const body = {
      url: F('url').value,
      name: F('name').value,
      description: F('description').value,
      folderId: folder && folder !== '__new' ? Number(folder) : null,
    };
    const b = isNew
      ? await api('POST', '/api/bookmarks', body)
      : await api('PUT', `/api/bookmarks/${cur.id}`, body);
    if (cur.thumb instanceof Blob) await api('PUT', `/api/bookmarks/${b.id}/thumb`, cur.thumb);
    else if (cur.thumb === null && !isNew) await api('DELETE', `/api/bookmarks/${b.id}/thumb`);
    if (cur.icon instanceof Blob) await api('PUT', `/api/bookmarks/${b.id}/icon`, cur.icon);
    if (b.folderId) { treeState.open.add(b.folderId); saveTree(); }
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

// ---------- folder dialog ----------

const fdlg = $('#folder-dlg');
const fform = $('#folder-form');
let fd = null;

// Resolves to the created/updated folder, or null when cancelled.
function openFolderDialog(folder = null, parentId = null) {
  if (fd) fd.resolve(null);
  return new Promise((resolve) => {
    fd = { folder, resolve, result: null };
    fform.reset();
    showError('#folder-error', '');
    $('#folder-title').textContent = folder ? 'Edit folder' : 'Add folder';
    $('#folder-delete').hidden = !folder;
    field(fform, 'name').value = folder ? folder.name : '';
    const parent = folder ? folder.parentId : parentId;
    folderOptions($('#folder-parent'), {
      selected: parent && S.fmap.has(parent) ? parent : null,
      exclude: folder ? subtree(folder.id) : new Set(),
      rootLabel: 'Top level',
    });
    fdlg.showModal();
    field(fform, 'name').focus();
  });
}
fdlg.addEventListener('close', () => { if (fd) { fd.resolve(fd.result); fd = null; } });

fform.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = field(fform, 'name').value.trim();
  if (!name) { showError('#folder-error', 'Give the folder a name.'); return; }
  const p = $('#folder-parent').value;
  const body = { name, parentId: p ? Number(p) : null };
  const btn = $('#folder-save');
  const isNew = !fd.folder;
  busy(btn, true, 'Saving…');
  try {
    let saved;
    if (!isNew) {
      await api('PUT', `/api/folders/${fd.folder.id}`, body);
      saved = { ...fd.folder, ...body };
    } else {
      saved = await api('POST', '/api/folders', body);
    }
    if (body.parentId) treeState.open.add(body.parentId);
    saveTree();
    fd.result = saved;
    await loadBookmarks();
    fdlg.close();
    toast(isNew ? 'Folder added' : 'Folder saved');
  } catch (err) {
    showError('#folder-error', err.message);
  } finally {
    busy(btn, false);
  }
});

$('#folder-delete').addEventListener('click', async () => {
  const f = fd.folder;
  const parent = f.parentId && S.fmap.get(f.parentId);
  const ok = await ask({
    title: `Delete “${f.name}”?`,
    text: `Its crumbs and subfolders move to ${parent ? `“${parent.name}”` : 'Uncategorized'}. Nothing else is deleted.`,
    ok: 'Delete folder',
  });
  if (!ok) return;
  try {
    await api('DELETE', `/api/folders/${f.id}`);
    if (S.view === f.id) S.view = parent ? parent.id : null;
    fdlg.close();
    await loadBookmarks();
    filterGrid();
    toast('Folder deleted');
  } catch (err) {
    showError('#folder-error', err.message);
  }
});

// ---------- profile ----------

function openProfile() {
  $('#pw-form').reset();
  showError('#pw-error', '');
  renderProfile();
  $('#profile').showModal();
}

function renderProfile() {
  fillAvatar($('#profile-avatar'), S.me);
  $('#profile-name').textContent = S.me.username;
  $('#profile-role').textContent = S.me.isAdmin ? 'Admin' : 'Member';
  const cur = S.me.avatar || '';
  const opts = [{ v: '', label: 'First letter' }, ...Object.keys(AVATAR_ICONS).map((k) => ({ v: 'icon:' + k, label: k }))];
  if (cur.startsWith('/avatar/')) opts.unshift({ v: cur, label: 'Your photo', photo: true });
  $('#avatar-grid').replaceChildren(...opts.map((o) => h('button', {
    type: 'button', class: 'avatar-opt' + (o.v === cur ? ' active' : ''),
    title: o.label, 'aria-label': o.label, 'aria-pressed': String(o.v === cur),
    onclick: () => { if (!o.photo) setAvatar(o.v); },
  }, avatarEl({ username: S.me.username, avatar: o.v }))));
}

function refreshMe(u) {
  S.me = u;
  renderMe();
  if ($('#profile').open) renderProfile();
}

async function setAvatar(v) {
  try { refreshMe(await api('PUT', '/api/me/avatar', { avatar: v })); }
  catch (err) { toast(err.message); }
}

$('#avatar-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const blob = await makeSquare(file);
    refreshMe(await api('PUT', '/api/me/avatar/image', blob));
    toast('Profile picture updated');
  } catch (err) {
    toast(err.message === 'not an image' ? 'That file is not an image Crumbs can read.' : err.message);
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

// ---------- settings (this browser) ----------

function openSettings() {
  renderSettings();
  $('#settings').showModal();
}

function renderSettings() {
  for (const [id, key] of [['#set-theme', 'theme'], ['#set-size', 'size']]) {
    for (const b of $(id).querySelectorAll('button')) {
      b.classList.toggle('on', b.dataset.v === prefs[key]);
      b.setAttribute('aria-pressed', String(b.dataset.v === prefs[key]));
    }
  }
  $('#set-newtab').checked = prefs.newTab;
}

for (const [id, key] of [['#set-theme', 'theme'], ['#set-size', 'size']]) {
  $(id).addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    prefs[key] = b.dataset.v;
    savePrefs();
    applyPrefs();
    renderSettings();
  });
}
$('#set-newtab').addEventListener('change', (e) => {
  prefs.newTab = e.target.checked;
  savePrefs();
  buildCards();
  renderTree();
});

// ---------- admin ----------

let ownerName = '';

async function openAdmin() {
  showError('#user-error', '');
  $('#user-form').reset();
  try { await loadUsers(); } catch (e) { toast(e.message); return; }
  $('#admin').showModal();
}

async function loadUsers() {
  const data = await api('GET', '/api/users');
  ownerName = data.owner;
  S.loginRequired = data.loginRequired;
  $('#login-req').checked = data.loginRequired;
  updateLoginNote();
  $('#user-list').replaceChildren(...data.users.map((u) => h('li', { class: 'user-row' },
    avatarEl(u, 'sm'),
    h('div', { class: 'who' },
      h('div', {}, h('strong', { text: u.username }), u.isAdmin ? h('span', { class: 'tag', text: 'admin' }) : null),
      h('div', { class: 'muted small', text: `${u.bookmarks} crumb${u.bookmarks === 1 ? '' : 's'}${u.id === S.me.id ? ' · you' : ''}` })),
    h('div', { class: 'row-actions' },
      h('button', { class: 'btn small', type: 'button', text: 'Reset password', onclick: () => resetPassword(u) }),
      u.id === S.me.id ? null : h('button', { class: 'btn small', type: 'button', text: 'Delete', onclick: () => deleteUser(u) })))));
}

function updateLoginNote() {
  $('#login-note').textContent = S.loginRequired
    ? 'Everyone has to sign in with a username and password.'
    : `Login is off: anyone who can reach this Pi sees and edits ${ownerName}'s crumbs without a password. Admin and Profile still need a sign-in.`;
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
  const ok = await ask({ title: `Delete ${u.username}?`, text: `Their account, folders and all ${u.bookmarks} of their crumbs will be deleted. This can't be undone.`, ok: 'Delete user' });
  if (!ok) return;
  try {
    await api('DELETE', `/api/users/${u.id}`);
    await loadUsers();
    toast('User deleted');
  } catch (err) { toast(err.message); }
}

boot();
