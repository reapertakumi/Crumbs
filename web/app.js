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
  swap: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3"/>',
  restore: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5"/><path d="M3.5 3.5v5h5"/>',
};

// Profile picture choices: solid black & white glyphs (holes are cut out).
const AVATAR_ICONS = {
  cookie: '<path fill-rule="evenodd" d="M12 3a9 9 0 1 0 9 9 3 3 0 0 0-3.5-3A3 3 0 0 0 14 5.5 3 3 0 0 0 12 3zM7.3 9.5a1.4 1.4 0 1 0 2.8 0 1.4 1.4 0 1 0-2.8 0zm5 5.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0zm-5.1.5a1 1 0 1 0 2 0 1 1 0 1 0-2 0zm4.3-4a.9.9 0 1 0 1.8 0 .9.9 0 1 0-1.8 0z"/>',
  cat: '<path fill-rule="evenodd" d="M4 3.5l4.6 3.8h6.8L20 3.5v10C20 18 16.4 21 12 21s-8-3-8-7.5zM7.8 13a1.3 1.3 0 1 0 2.6 0 1.3 1.3 0 1 0-2.6 0zm5.8 0a1.3 1.3 0 1 0 2.6 0 1.3 1.3 0 1 0-2.6 0zM11 16h2l-1 1.3z"/>',
  fox: '<path fill-rule="evenodd" d="M3 3l5.5 4.5h7L21 3l-1.3 9.5L12 21l-7.7-8.5zM7.6 12a1.3 1.3 0 1 0 2.6 0 1.3 1.3 0 1 0-2.6 0zm6.2 0a1.3 1.3 0 1 0 2.6 0 1.3 1.3 0 1 0-2.6 0zM10.8 16.2h2.4L12 17.8z"/>',
  bear: '<path fill-rule="evenodd" d="M4 7.5a3 3 0 0 1 5-2.2 8 8 0 0 1 6 0 3 3 0 1 1 4.4 3.9A8 8 0 1 1 4.6 9.2 3 3 0 0 1 4 7.5zM8.2 12a1.2 1.2 0 1 0 2.4 0 1.2 1.2 0 1 0-2.4 0zm5.2 0a1.2 1.2 0 1 0 2.4 0 1.2 1.2 0 1 0-2.4 0zM9.5 16a2.5 1.8 0 1 0 5 0 2.5 1.8 0 1 0-5 0z"/><ellipse cx="12" cy="15.6" rx="1" ry=".7"/>',
  owl: '<path fill-rule="evenodd" d="M5 4l3 2.2a7.5 7.5 0 0 1 8 0L19 4v9a7 7 0 0 1-14 0zM7 11a2.4 2.4 0 1 0 4.8 0 2.4 2.4 0 1 0-4.8 0zm5.2 0a2.4 2.4 0 1 0 4.8 0 2.4 2.4 0 1 0-4.8 0zM11 14.5h2L12 16z"/><circle cx="9.4" cy="11" r=".9"/><circle cx="14.6" cy="11" r=".9"/>',
  ghost: '<path fill-rule="evenodd" d="M5 21V11a7 7 0 0 1 14 0v10l-2.33-2-2.34 2L12 19l-2.33 2-2.34-2zM8.2 10.5a1.3 1.5 0 1 0 2.6 0 1.3 1.5 0 1 0-2.6 0zm5 0a1.3 1.5 0 1 0 2.6 0 1.3 1.5 0 1 0-2.6 0z"/>',
  robot: '<path fill-rule="evenodd" d="M11 2.5h2V5h3.5A3.5 3.5 0 0 1 20 8.5v7a3.5 3.5 0 0 1-3.5 3.5h-9A3.5 3.5 0 0 1 4 15.5v-7A3.5 3.5 0 0 1 7.5 5H11zM7.5 11a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0zm6 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0zM9 15h6v1.5H9z"/><rect x="1.5" y="10" width="2" height="4" rx="1"/><rect x="20.5" y="10" width="2" height="4" rx="1"/>',
  alien: '<path fill-rule="evenodd" d="M12 2.5c4.7 0 8 3.3 8 7.6 0 5.3-5 11.4-8 11.4s-8-6.1-8-11.4c0-4.3 3.3-7.6 8-7.6zM6.6 11.2c.3 2 2 3.3 3.8 3.1-.2-2-1.9-3.4-3.8-3.1zm10.8 0c-1.9-.3-3.6 1.1-3.8 3.1 1.8.2 3.5-1.1 3.8-3.1z"/>',
  rocket: '<path fill-rule="evenodd" d="M12 1.5c3.6 2.6 5.2 6.6 5.2 10.8L15.3 17H8.7l-1.9-4.7C6.8 8.1 8.4 4.1 12 1.5zM10.2 9.5a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 1 0-3.6 0z"/><path d="M6.6 13.2L3.5 17v2.5l4.3-1.7zM17.4 13.2l3.1 3.8v2.5l-4.3-1.7zM10 18.3h4L12 22.5z"/>',
  planet: '<circle cx="12" cy="12" r="6.2"/><path d="M3.3 16.8c-1-1.8 1.4-4.2 4.6-5.9l.1 1.6c-2.4 1.4-3.6 2.8-3.2 3.6.7 1.3 5.4.2 9.9-2.4s7.8-6.1 7-7.4c-.4-.8-2.2-.7-4.8.3l-1.2-1.1c3.9-1.6 7-1.8 7.9-.1 1.6 2.8-2.6 7.6-8.3 10.9s-11.4 4.3-12 1.5z"/>',
  moon: '<path d="M20.5 14.5A9 9 0 0 1 9.5 3.5a9 9 0 1 0 11 11z"/><path d="M17 3l.7 1.6L19.3 5.3l-1.6.7L17 7.6l-.7-1.6-1.6-.7 1.6-.7z"/>',
  star: '<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z"/>',
  bolt: '<path d="M14 1.5L4.5 13.5H11L9.5 22.5 19.5 10H13z"/>',
  flame: '<path fill-rule="evenodd" d="M12 22c-4.3 0-7.5-3-7.5-7.1 0-5 4.3-7.4 5.2-12.4 4 2.3 9.8 6.7 9.8 12.4 0 4.1-3.2 7.1-7.5 7.1zm0-1.8c1.9 0 3.2-1.4 3.2-3.2 0-2.3-1.9-4.3-3.8-5.5-.5 2.4-2.6 3.4-2.6 5.5 0 1.8 1.3 3.2 3.2 3.2z"/>',
  heart: '<path d="M12 21.2S2.5 15.6 2.5 9.1A5 5 0 0 1 12 6.6a5 5 0 0 1 9.5 2.5c0 6.5-9.5 12.1-9.5 12.1z"/>',
  crown: '<path d="M2.5 7.5l5 4.3L12 4.5l4.5 7.3 5-4.3-2 10H4.5zM4.5 19h15v2h-15z"/>',
  gem: '<path fill-rule="evenodd" d="M6.5 3h11l4.5 6.2L12 21.5 2 9.2zM8 9.5l4 8 4-8z"/>',
  leaf: '<path fill-rule="evenodd" d="M4 20.5C3.5 10.5 9.5 3.5 21 3c.3 11.5-6.7 17.5-16.3 17.6l-.3.4-1-.6zm2.3-1.6l.9.5c2.6-4.6 5.7-8 9.8-10.6-4.6 1.7-8.2 5.3-10.7 10.1z"/>',
  tree: '<path d="M12 1.5l6.5 8.5H15l4.5 6.5H13.2V22h-2.4v-5.5H4.5L9 10H5.5z"/>',
  mountain: '<path d="M1.5 20.5l7.2-12.5 4.3 7.2 2.8-4.2 6.7 9.5z"/><circle cx="17.5" cy="5.5" r="2.5"/>',
  wave: '<path d="M2 15c2.7 0 2.7-2 5.3-2s2.7 2 5.4 2 2.6-2 5.3-2 2.7 2 4 2v6.5H2zM2 8.5c2.7 0 2.7-2 5.3-2s2.7 2 5.4 2 2.6-2 5.3-2 2.7 2 4 2v3c-1.3 0-1.3-2-4-2s-2.6 2-5.3 2-2.7-2-5.4-2S4.7 11.5 2 11.5z"/>',
  coffee: '<path fill-rule="evenodd" d="M3.5 8.5h13V14a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6zM16.5 9.5h1.3a3.2 3.2 0 0 1 0 6.4h-1.6c.2-.6.3-1.2.3-1.9h1.3a1.3 1.3 0 0 0 0-2.6h-1.3z"/><rect x="6.5" y="2.5" width="1.8" height="4.2" rx=".9"/><rect x="10.7" y="2.5" width="1.8" height="4.2" rx=".9"/>',
  music: '<path d="M8.5 6.2L20.5 3.5v12.3a3 3 0 1 1-1.9-2.8V7.1l-8.2 1.8v9.3a3 3 0 1 1-1.9-2.8z"/>',
  game: '<path fill-rule="evenodd" d="M7 7h10a5 5 0 0 1 5 5v3.6a2.9 2.9 0 0 1-5 2L15.2 16H8.8L7 17.6a2.9 2.9 0 0 1-5-2V12a5 5 0 0 1 5-5zM6 11.3h1.3V10h1.4v1.3H10v1.4H8.7V14H7.3v-1.3H6zm8.3.1a1 1 0 1 0 2 0 1 1 0 1 0-2 0zm2 2a1 1 0 1 0 2 0 1 1 0 1 0-2 0z"/>',
  camera: '<path fill-rule="evenodd" d="M8.5 4h7l1.5 2.5h3A2 2 0 0 1 22 8.5V18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2h3zM8 13a4 4 0 1 0 8 0 4 4 0 1 0-8 0zm2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0z"/>',
  code: '<path d="M8.3 6.2L9.7 7.6 5.3 12l4.4 4.4-1.4 1.4L2.5 12zM15.7 6.2l5.8 5.8-5.8 5.8-1.4-1.4 4.4-4.4-4.4-4.4zM13.2 3.6l1.9.5-4.3 16.3-1.9-.5z"/>',
  book: '<path d="M3 4.5c3-.8 6-.4 8 1.3V21c-2-1.6-5-2-8-1.3zM21 4.5c-3-.8-6-.4-8 1.3V21c2-1.6 5-2 8-1.3z"/>',
  anchor: '<path fill-rule="evenodd" d="M12 2a2.8 2.8 0 0 1 1 5.4V9h3v2h-3v8.4c2.7-.4 4.8-2.4 5.3-5H16l3.5-4 3.5 4h-2.6c-.6 4.4-4.3 7.6-8.4 7.6s-7.8-3.2-8.4-7.6H1l3.5-4 3.5 4H5.7c.5 2.6 2.6 4.6 5.3 5V11H8V9h3V7.4A2.8 2.8 0 0 1 12 2zm0 1.8a1 1 0 1 0 0 2 1 1 0 1 0 0-2z"/>',
};

function icon(name, cls = '', set = UI_ICONS) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  if (set === AVATAR_ICONS) cls = (cls + ' fill').trim();
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
  {
    theme: 'system', size: 'm', layout: 'grid', bg: 'plain', bgBW: true, bgStrength: 35,
    newTab: true, sort: { key: 'created', dir: 'desc' }, sideOpen: false,
  },
  readStore('crumbs.prefs', {}));
const savePrefs = () => writeStore('crumbs.prefs', prefs);

// The background photo is kept separately (it can be a few hundred KB).
function readBgImage() { try { return localStorage.getItem('crumbs.bgimg') || ''; } catch { return ''; } }

function applyPrefs() {
  const root = document.documentElement;
  if (prefs.theme === 'light' || prefs.theme === 'dark') root.dataset.theme = prefs.theme;
  else delete root.dataset.theme;
  root.dataset.size = prefs.size;
  root.dataset.layout = prefs.layout;
  const img = prefs.bg === 'image' ? readBgImage() : '';
  root.dataset.bg = prefs.bg === 'image' && !img ? 'plain' : prefs.bg;
  root.toggleAttribute('data-bgbw', !!prefs.bgBW);
  root.style.setProperty('--bg-strength', String(prefs.bgStrength / 100));
  if (img) root.style.setProperty('--bg-img', `url("${img}")`);
  else root.style.removeProperty('--bg-img');
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
  me: null, guest: false, loginRequired: true, registration: false,
  list: [], trash: [], trashDays: 30, folders: [],
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
// toast('Saved') or toast('Moved to the trash', { label: 'Undo', fn })
function toast(msg, action = null) {
  const t = $('#toast');
  t.replaceChildren(h('span', { text: msg }));
  if (action) {
    t.append(h('button', {
      type: 'button', class: 'toast-btn', text: action.label,
      onclick: () => { t.hidden = true; action.fn(); },
    }));
  }
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, action ? 6000 : 2600);
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
// input: 'password', or { type, value, min, step, placeholder }.
function ask({ title, text = '', ok = 'OK', input = null }) {
  const d = $('#ask'), inp = $('#ask-input');
  $('#ask-title').textContent = title;
  $('#ask-text').textContent = text;
  $('#ask-ok').textContent = ok;
  const opt = typeof input === 'string' ? { type: input } : input;
  inp.hidden = !opt;
  inp.value = '';
  inp.required = !!opt;
  for (const a of ['min', 'step', 'placeholder', 'minLength']) inp.removeAttribute(a);
  if (opt) {
    inp.type = opt.type || 'text';
    if (opt.type === 'password') { inp.minLength = 6; inp.autocomplete = 'new-password'; }
    if (opt.min != null) inp.min = opt.min;
    if (opt.step != null) inp.step = opt.step;
    if (opt.placeholder) inp.placeholder = opt.placeholder;
    if (opt.value != null) inp.value = opt.value;
  }
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
    el.replaceChildren(document.createTextNode(firstLetter(u && nameOf(u))));
  }
  return el;
}
const avatarEl = (u, cls = '') => fillAvatar(h('span', { class: 'avatar ' + cls }), u);
const nameOf = (u) => (u && (u.displayName || u.username)) || '';

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
}

// ---------- boot & auth ----------

async function boot() {
  let s;
  try { s = await api('GET', '/api/state'); }
  catch (e) { toast('Cannot reach Crumbs: ' + e.message); return; }
  S.me = s.user; S.guest = s.guest; S.loginRequired = s.loginRequired; S.registration = s.registration;
  if (s.setup) return showAuth('setup');
  if (!s.user) return showAuth('login');
  showApp();
  try { await loadBookmarks(); } catch (e) { toast(e.message); }
  handleAddParam();
}

// Auth modes: 'login', 'register' (when the admin allows it), 'setup' (first run).
let authMode = 'login';
let authCanGoBack = false;
function showAuth(mode, canGoBack = authCanGoBack) {
  authMode = mode;
  authCanGoBack = canGoBack;
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  closeMenus();
  $('#app').hidden = true;
  $('#auth').hidden = false;
  const f = $('#auth-form');
  f.reset();
  const creating = mode !== 'login';
  $('#auth-sub').textContent = {
    setup: 'Welcome! Create the first account. It becomes the admin.',
    register: 'Create your account.',
    login: 'Sign in to see your crumbs.',
  }[mode];
  $('#auth-confirm').hidden = !creating;
  $('#auth-display').hidden = !creating;
  field(f, 'confirm').required = creating;
  field(f, 'password').autocomplete = creating ? 'new-password' : 'current-password';
  $('#auth-submit').textContent = { setup: 'Create admin account', register: 'Create account', login: 'Sign in' }[mode];
  const sw = $('#auth-switch');
  sw.hidden = mode === 'setup' || !S.registration;
  sw.textContent = mode === 'register' ? 'I already have an account' : 'Create an account';
  $('#auth-back').hidden = !canGoBack;
  showError('#auth-error', '');
  field(f, creating ? 'displayName' : 'username').focus();
}

$('#auth-switch').addEventListener('click', () => showAuth(authMode === 'register' ? 'login' : 'register'));

$('#auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const username = field(f, 'username').value.trim();
  const password = field(f, 'password').value;
  const displayName = field(f, 'displayName').value.trim();
  if (authMode !== 'login' && password !== field(f, 'confirm').value) {
    return showError('#auth-error', 'The passwords do not match.');
  }
  const btn = $('#auth-submit');
  busy(btn, true, authMode === 'login' ? 'Signing in…' : 'Creating…');
  try {
    const path = { setup: '/api/setup', register: '/api/register', login: '/api/login' }[authMode];
    await api('POST', path, { username, password, displayName });
    authCanGoBack = false;
    await boot();
  } catch (err) {
    showError('#auth-error', err.message);
  } finally {
    busy(btn, false);
  }
});
$('#auth-back').addEventListener('click', () => { authCanGoBack = false; boot(); });

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
    dd.querySelector('[data-dd]')?.setAttribute('aria-expanded', 'false');
  });
  document.querySelectorAll('.more-btn[aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
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
    case 'io': return openIO(null);
  }
}

function renderMe() {
  const guestUser = { username: 'Guest', avatar: '' };
  const u = S.guest ? guestUser : S.me;
  $('#me-name').textContent = nameOf(u);
  fillAvatar($('#me-avatar'), u);
  const item = (act, ic, label) => h('button', { type: 'button', role: 'menuitem', 'data-act': act }, icon(ic), label);
  const head = h('div', { class: 'menu-head' }, avatarEl(u, 'sm'),
    h('div', {}, h('strong', { text: nameOf(u) }),
      h('span', { class: 'muted small', text: S.guest ? `Using ${nameOf(S.me)}'s crumbs` : `@${S.me.username}${S.me.isAdmin ? ' · Admin' : ''}` })));
  const items = S.guest
    ? [item('settings', 'gear', 'Settings'), h('hr'), item('signin', 'logout', 'Sign in')]
    : [S.me.isAdmin ? item('admin', 'shield', 'Admin') : null,
       item('profile', 'user', 'Profile'),
       item('io', 'swap', 'Import / export'),
       item('settings', 'gear', 'Settings'),
       h('hr'),
       item('signout', 'logout', 'Sign out')];
  $('#me-menu').replaceChildren(head, h('hr'), ...items);
}

// ---------- sorting ----------

const SORTS = [
  { key: 'title', label: 'Title', def: 'asc', get: (b) => b.name },
  { key: 'created', label: 'Created', def: 'desc', num: true, get: (b) => b.created },
  { key: 'updated', label: 'Updated', def: 'desc', num: true, get: (b) => b.updated },
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
      }, s.label, icon('arrowUp', 'dir'));
    }));
  // The header button just says what it sorts by, plus an up/down arrow.
  const desc = prefs.sort.dir === 'desc';
  const btn = $('#sort-btn');
  btn.replaceChildren(h('span', { class: 'lbl', text: cur.label }), icon('arrowUp', 'sort-dir' + (desc ? ' desc' : '')));
  btn.title = `Sorted by ${cur.label.toLowerCase()}, ${dirText(cur, prefs.sort.dir).toLowerCase()}`;
  btn.setAttribute('aria-label', btn.title);
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
  for (const list of S.kids.values()) list.sort((a, b) => (a.position - b.position) || coll.compare(a.name, b.name));
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

// ---------- folder looks: color + icon ----------

const FOLDER_COLORS = ['', '#8e8e93', '#e5484d', '#f76b15', '#f5b400', '#30a46c', '#12a594', '#3e63dd', '#8e4ec6', '#d6409f', '#a07553'];
const FOLDER_ICONS = {
  folder: UI_ICONS.folder,
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z"/>',
  work: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12.5h18"/>',
  home: '<path d="M3.5 11L12 4l8.5 7v9a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z"/>',
  code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/>',
  book: '<path d="M4 4.5h6a2 2 0 0 1 2 2V20a1.5 1.5 0 0 0-1.5-1.5H4zM20 4.5h-6a2 2 0 0 0-2 2V20a1.5 1.5 0 0 1 1.5-1.5H20z"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7.5 4v16M16.5 4v16M3 9h4.5M3 15h4.5M16.5 9H21M16.5 15H21"/>',
  camera: '<path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.8"/>',
  game: '<rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7 10.5v4M5 12.5h4"/><circle cx="15.5" cy="11.5" r=".6"/><circle cx="17.8" cy="13.7" r=".6"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3.5h3l2.5 12.5h11l2-8.5H6.4"/>',
  travel: '<path d="M21 3L3 10.5l7.5 3L13.5 21z"/><path d="M10.5 13.5L21 3"/>',
  idea: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
  coffee: '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5V6M12 3.5V6"/>',
  leaf: '<path d="M5 19C5 10 11 5 20 4c-.5 9-6 15-15 15z"/><path d="M5 19l8-8"/>',
  bolt: '<path d="M13 2.5L5 14h6l-1 7.5L18 10h-6z"/>',
  flag: '<path d="M5 21V4M5 4h12l-2.5 4.5L17 13H5"/>',
  box: '<path d="M3 7.5l9-4.5 9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5l9 4.5 9-4.5M12 12v9"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.4"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4L11.5 6"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.5-1.5"/>',
  school: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c2 2 10 2 12 0v-5M22 9v5"/>',
  money: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.8"/><path d="M6 9v6M18 9v6"/>',
};

function folderIcon(f, cls = 'ico') {
  const name = f && f.icon && FOLDER_ICONS[f.icon] ? f.icon : 'folder';
  const svg = icon(name, cls, FOLDER_ICONS);
  if (f && f.color) svg.style.setProperty('color', f.color);
  return svg;
}

// ---------- bookmarks list ----------

async function loadBookmarks() {
  const data = await api('GET', '/api/bookmarks');
  S.list = data.bookmarks || [];
  S.trash = data.trash || [];
  S.trashDays = data.trashDays || 30;
  S.folders = data.folders || [];
  indexFolders();
  if (S.view > 0 && !S.fmap.has(S.view)) S.view = null;
  buildCards();
  renderTree();
}

function buildCards() {
  cards = new Map([...S.list, ...S.trash].map((b) => [b.id, card(b)]));
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
  let tag = null;
  if (folder) {
    tag = h('span', { class: 'tag', title: folderPath(folder.id) }, folderIcon(folder, 'tag-ico'), folder.name);
  }
  const body = h('div', { class: 'card-body' },
    h('div', { class: 'card-title' },
      b.icon ? h('img', { class: 'fav', src: b.icon, alt: '', loading: 'lazy' }) : null,
      h('span', { text: b.name })),
    h('div', { class: 'card-meta' }, h('span', { text: host }), tag),
    b.description ? h('p', { class: 'card-desc', text: b.description }) : null);

  const actions = b.deleted
    ? h('div', { class: 'card-actions' },
        h('button', { class: 'card-edit', type: 'button', title: 'Restore', 'aria-label': `Restore ${b.name}`, onclick: () => restoreBookmark(b) }, icon('restore')),
        h('button', { class: 'card-edit', type: 'button', title: 'Delete forever', 'aria-label': `Delete ${b.name} forever`, onclick: () => deleteForever(b) }, icon('trash')))
    : h('button', { class: 'card-edit', type: 'button', title: 'Edit', 'aria-label': `Edit ${b.name}`, onclick: () => openEditor(b) }, icon('edit'));

  return h('article', { class: 'card' + (b.deleted ? ' trashed' : '') },
    h('a', { class: 'card-link', href: b.url, target: prefs.newTab ? '_blank' : null, rel: 'noopener noreferrer', title: b.url }, thumb, body),
    actions);
}

let viewSet = new Set();
function inView(b) {
  if (S.view === 'trash') return !!b.deleted;
  if (b.deleted) return false;
  if (S.view === null) return true;
  if (S.view === 0) return !b.folderId || !S.fmap.has(b.folderId);
  return viewSet.has(b.folderId);
}

// Put the cards in sort order (only needed when data or sort changes).
function orderGrid() {
  $('#grid').replaceChildren(...sorted([...S.list, ...S.trash]).map((b) => cards.get(b.id)));
  filterGrid();
}

function filterGrid() {
  viewSet = S.view > 0 ? subtree(S.view) : new Set();
  const terms = S.q.toLowerCase().split(/\s+/).filter(Boolean);
  let shown = 0;
  for (const b of [...S.list, ...S.trash]) {
    let ok = inView(b);
    if (ok && terms.length) {
      const hay = `${b.name} ${b.url} ${b.description} ${folderPath(b.folderId)}`.toLowerCase();
      ok = terms.every((t) => hay.includes(t));
    }
    cards.get(b.id).hidden = !ok;
    if (ok) shown++;
  }

  const trash = S.view === 'trash';
  $('#view-title').textContent = S.view === null ? 'All crumbs' : S.view === 0 ? 'Uncategorized' : trash ? 'Trash' : folderPath(S.view);
  $('#view-clear').hidden = S.view === null;
  $('#view-empty').hidden = !trash || !S.trash.length;
  $('#view-count').textContent = (S.q.trim()
    ? `${shown} result${shown === 1 ? '' : 's'} for “${S.q.trim()}”`
    : `${shown} crumb${shown === 1 ? '' : 's'}`) + (trash ? ` · deleted for good after ${S.trashDays} days` : '');
  const empty = $('#empty');
  empty.hidden = shown > 0;
  empty.textContent = trash ? (S.q.trim() ? 'Nothing in the trash matches that.' : 'The trash is empty.')
    : !S.list.length ? 'No crumbs yet. Hit “Add” and drop your first one.'
    : S.q.trim() ? 'No crumbs match that.' : 'This folder is empty.';
}

function selectView(v) {
  S.view = v;
  filterGrid();
  renderTree();
  if (!wide()) setSidebar(false);
}
$('#view-clear').addEventListener('click', () => selectView(null));

// ---------- trash ----------

async function trashBookmark(b) {
  await api('DELETE', `/api/bookmarks/${b.id}`);
  await loadBookmarks();
  toast('Moved to the trash', { label: 'Undo', fn: () => restoreBookmark(b, true) });
}

async function restoreBookmark(b, quiet = false) {
  try {
    await api('POST', `/api/bookmarks/${b.id}/restore`);
    await loadBookmarks();
    if (!quiet) toast('Crumb restored', { label: 'Show', fn: () => selectView(b.folderId && S.fmap.has(b.folderId) ? b.folderId : 0) });
  } catch (err) { toast(err.message); }
}

async function deleteForever(b) {
  if (!(await ask({ title: 'Delete forever?', text: `“${b.name}” and its thumbnail will be gone for good.`, ok: 'Delete forever' }))) return;
  try {
    await api('DELETE', `/api/bookmarks/${b.id}?forever=1`);
    await loadBookmarks();
    toast('Deleted forever');
  } catch (err) { toast(err.message); }
}

$('#view-empty').addEventListener('click', async () => {
  const n = S.trash.length;
  if (!(await ask({ title: 'Empty the trash?', text: `${n} crumb${n === 1 ? '' : 's'} will be deleted for good. This can't be undone.`, ok: 'Empty trash' }))) return;
  try {
    await api('DELETE', '/api/trash');
    await loadBookmarks();
    toast('Trash emptied');
  } catch (err) { toast(err.message); }
});

// Bookmarklet support: http://pi:9099/?add=<url>
function handleAddParam() {
  const params = new URLSearchParams(location.search);
  const url = params.get('add');
  if (!url) return;
  history.replaceState(null, '', '/');
  openEditor(null, url);
}

// ---------- sidebar ----------

// Smoothly move the cards when the layout jumps (sidebar opening/closing):
// remember where every visible card was, change the layout in one go, then
// animate each card from its old box to its new one (FLIP).
function flipLayout(change) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { change(); return; }
  const vh = innerHeight;
  const first = new Map();
  for (const el of document.querySelectorAll('#grid > .card:not([hidden]), .view-head')) {
    const r = el.getBoundingClientRect();
    if (r.bottom > -100 && r.top < vh + 100) first.set(el, r);
  }
  change();
  for (const [el, a] of first) {
    const b = el.getBoundingClientRect();
    const dx = a.left - b.left, dy = a.top - b.top;
    const sx = el.classList.contains('card') ? a.width / b.width : 1;
    const sy = el.classList.contains('card') ? a.height / b.height : 1;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) continue;
    el.animate([
      { transformOrigin: '0 0', transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
      { transformOrigin: '0 0', transform: 'none' },
    ], { duration: 320, easing: 'cubic-bezier(.2, .8, .2, 1)' });
  }
}

function setSidebar(open, remember = true) {
  const apply = () => {
    document.body.classList.toggle('side-open', open);
    $('#scrim').hidden = !open;
  };
  if (remember && wide()) flipLayout(apply); else apply();
  $('#menu-btn').setAttribute('aria-expanded', String(open));
  $('#menu-btn').setAttribute('aria-label', open ? 'Hide folders' : 'Show folders');
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
  const simpleRow = (view, ic, label, count) => h('div', { class: 'ti' + (S.view === view ? ' active' : '') },
    h('span', { class: 'twisty none' }),
    icon(ic, 'ico'),
    h('button', { type: 'button', class: 'label', text: label, onclick: () => selectView(view) }),
    h('span', { class: 'count', text: String(count) }));

  const top = (S.kids.get(0) || []).map((f) => folderNode(f, 0, tabsIn));
  const parts = [
    simpleRow(null, 'all', 'All crumbs', S.list.length),
    uncategorizedNode(tabsIn.get(0) || []),
    simpleRow('trash', 'trash', 'Trash', S.trash.length),
    h('div', { class: 'tree-sep' }),
    ...top,
  ];
  if (!top.length) parts.push(h('div', { class: 'tree-empty', text: 'No folders yet. Use “Add folder”.' }));
  $('#tree').replaceChildren(...parts);
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
  const row = h('div', { class: 'ti folder' + (S.view === f.id ? ' active' : ''), title: 'Drag to move' },
    tw,
    folderIcon(f),
    h('button', { type: 'button', class: 'label', text: f.name, title: folderPath(f.id), onclick: () => selectView(f.id) }),
    h('span', { class: 'count', text: String(S.totals.get(f.id) || 0) }),
    h('span', { class: 'acts' },
      actBtn('plus', 'New folder inside', () => openFolderDialog(null, f.id)),
      actBtn('edit', 'Edit folder', () => openFolderDialog(f))));
  folderDrag(row, f);

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

// ---- drag folders to reorder them ----
// Drop on the top part of a folder = put it above, bottom part = below,
// middle = put it inside.

let dragFolder = null;

function clearDropMarks() {
  document.querySelectorAll('.drop-before, .drop-after, .drop-into')
    .forEach((el) => el.classList.remove('drop-before', 'drop-after', 'drop-into'));
}

function folderDrag(row, f) {
  row.draggable = true;
  row.addEventListener('dragstart', (e) => {
    dragFolder = f.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', f.name);
    requestAnimationFrame(() => row.classList.add('dragging'));
  });
  row.addEventListener('dragend', () => {
    dragFolder = null;
    row.classList.remove('dragging');
    clearDropMarks();
  });
  row.addEventListener('dragover', (e) => {
    if (dragFolder == null || subtree(dragFolder).has(f.id)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const r = row.getBoundingClientRect();
    const y = (e.clientY - r.top) / r.height;
    const zone = y < 0.3 ? 'before' : y > 0.7 ? 'after' : 'into';
    if (!row.classList.contains('drop-' + zone)) { clearDropMarks(); row.classList.add('drop-' + zone); }
    row.dataset.zone = zone;
  });
  row.addEventListener('dragleave', (e) => {
    if (!row.contains(e.relatedTarget)) row.classList.remove('drop-before', 'drop-after', 'drop-into');
  });
  row.addEventListener('drop', (e) => {
    e.preventDefault();
    const zone = row.dataset.zone;
    clearDropMarks();
    if (dragFolder != null && dragFolder !== f.id) moveFolder(dragFolder, f, zone);
  });
}

async function moveFolder(id, target, zone) {
  let parentId, ids;
  if (zone === 'into') {
    parentId = target.id;
    ids = [...(S.kids.get(target.id) || []).map((x) => x.id).filter((x) => x !== id), id];
    treeState.open.add(target.id);
    saveTree();
  } else {
    parentId = target.parentId && S.fmap.has(target.parentId) ? target.parentId : null;
    ids = (S.kids.get(parentId || 0) || []).map((x) => x.id).filter((x) => x !== id);
    ids.splice(ids.indexOf(target.id) + (zone === 'after' ? 1 : 0), 0, id);
  }
  try {
    await api('PUT', '/api/folders/order', { parentId, ids });
    await loadBookmarks();
  } catch (err) { toast(err.message); }
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

// Delete = move to the trash (with Undo); nothing is lost right away.
$('#edit-delete').addEventListener('click', async () => {
  const b = S.list.find((x) => x.id === ed.id);
  if (!b) return;
  try {
    dlg.close();
    await trashBookmark(b);
  } catch (err) {
    toast(err.message);
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
    fd = { folder, resolve, result: null, color: folder ? folder.color || '' : '', icon: folder ? folder.icon || '' : '' };
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
    renderFolderLook();
    fdlg.showModal();
    field(fform, 'name').focus();
  });
}
fdlg.addEventListener('close', () => { if (fd) { fd.resolve(fd.result); fd = null; } });

// Color swatches and icon choices in the folder dialog.
function renderFolderLook() {
  $('#folder-colors').replaceChildren(...FOLDER_COLORS.map((c) => {
    const b = h('button', {
      type: 'button', class: 'swatch' + (c ? '' : ' none') + (fd.color === c ? ' on' : ''),
      title: c || 'No color', 'aria-label': c ? `Color ${c}` : 'No color', 'aria-pressed': String(fd.color === c),
      onclick: () => { fd.color = c; renderFolderLook(); },
    });
    if (c) b.style.setProperty('--sw', c);
    return b;
  }));
  $('#folder-icons').replaceChildren(...Object.keys(FOLDER_ICONS).map((k) => h('button', {
    type: 'button', class: 'icon-opt' + ((fd.icon || 'folder') === k ? ' on' : ''),
    title: k, 'aria-label': `Icon ${k}`, 'aria-pressed': String((fd.icon || 'folder') === k),
    onclick: () => { fd.icon = k === 'folder' ? '' : k; renderFolderLook(); },
  }, folderIcon({ icon: k, color: fd.color }, ''))));
}

fform.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = field(fform, 'name').value.trim();
  if (!name) { showError('#folder-error', 'Give the folder a name.'); return; }
  const p = $('#folder-parent').value;
  const body = { name, parentId: p ? Number(p) : null, color: fd.color, icon: fd.icon };
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
  field($('#name-form'), 'displayName').value = S.me.displayName || '';
  renderProfile();
  $('#profile').showModal();
}

// Built-in choices: the first letter, then every icon. A current photo comes first.
function avatarChoices(u) {
  const cur = u.avatar || '';
  const opts = [{ v: '', label: 'First letter' }, ...Object.keys(AVATAR_ICONS).map((k) => ({ v: 'icon:' + k, label: k }))];
  if (cur.startsWith('/avatar/')) opts.unshift({ v: cur, label: 'Uploaded photo', photo: true });
  return opts.map((o) => ({ ...o, active: o.v === cur }));
}

function avatarGrid(u, onPick) {
  return avatarChoices(u).map((o) => h('button', {
    type: 'button', class: 'avatar-opt' + (o.active ? ' active' : ''),
    title: o.label, 'aria-label': o.label, 'aria-pressed': String(o.active),
    onclick: () => { if (!o.photo) onPick(o.v); },
  }, avatarEl({ username: u.username, displayName: u.displayName, avatar: o.v })));
}

function renderProfile() {
  fillAvatar($('#profile-avatar'), S.me);
  $('#profile-name').textContent = nameOf(S.me);
  $('#profile-role').textContent = `@${S.me.username}${S.me.isAdmin ? ' · Admin' : ''}`;
  $('#avatar-grid').replaceChildren(...avatarGrid(S.me, setAvatar));
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

$('#name-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    refreshMe(await api('PUT', '/api/me', { displayName: field(e.currentTarget, 'displayName').value }));
    toast('Display name saved');
  } catch (err) { toast(err.message); }
});

$('#avatar-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (file) openCropper(file);
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

// ---------- photo cropper: drag to move, scroll / pinch / slider to zoom ----------

const crop = { url: '', w: 0, h: 0, V: 0, s: 1, min: 1, x: 0, y: 0, pointers: new Map(), pinch: null };
const cropDlg = $('#crop-dlg'), cropStage = $('#crop-stage'), cropImg = $('#crop-img'), cropZoom = $('#crop-zoom');

function openCropper(file) {
  if (crop.url) URL.revokeObjectURL(crop.url);
  crop.url = URL.createObjectURL(file);
  cropImg.onload = () => {
    crop.w = cropImg.naturalWidth;
    crop.h = cropImg.naturalHeight;
    crop.V = cropStage.clientWidth;
    crop.min = crop.V / Math.min(crop.w, crop.h);
    crop.s = crop.min;
    crop.x = (crop.V - crop.w * crop.s) / 2;
    crop.y = (crop.V - crop.h * crop.s) / 2;
    cropImg.style.width = crop.w + 'px';
    cropZoom.value = '1';
    renderCrop();
  };
  cropImg.onerror = () => { cropDlg.close(); toast('That file is not an image Crumbs can read.'); };
  cropImg.removeAttribute('style');
  cropDlg.showModal();
  cropImg.src = crop.url;
}

function renderCrop() {
  const { V, w, h, s } = crop;
  crop.x = Math.min(0, Math.max(V - w * s, crop.x));
  crop.y = Math.min(0, Math.max(V - h * s, crop.y));
  cropImg.style.transform = `translate(${crop.x}px, ${crop.y}px) scale(${s})`;
}

// Zoom around a point (cx, cy) inside the stage so that point stays put.
function zoomTo(next, cx = crop.V / 2, cy = crop.V / 2) {
  next = Math.min(crop.min * 5, Math.max(crop.min, next));
  const px = (cx - crop.x) / crop.s, py = (cy - crop.y) / crop.s;
  crop.s = next;
  crop.x = cx - px * next;
  crop.y = cy - py * next;
  cropZoom.value = String(next / crop.min);
  renderCrop();
}

const stagePoint = (e) => {
  const r = cropStage.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
};

cropZoom.addEventListener('input', () => zoomTo(crop.min * Number(cropZoom.value)));
cropStage.addEventListener('wheel', (e) => {
  e.preventDefault();
  const p = stagePoint(e);
  zoomTo(crop.s * Math.exp(-e.deltaY * 0.0015), p.x, p.y);
}, { passive: false });

cropStage.addEventListener('pointerdown', (e) => {
  cropStage.setPointerCapture(e.pointerId);
  crop.pointers.set(e.pointerId, stagePoint(e));
  cropStage.classList.add('dragging');
  if (crop.pointers.size === 2) {
    const [a, b] = [...crop.pointers.values()];
    crop.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), s: crop.s };
  }
});
cropStage.addEventListener('pointermove', (e) => {
  const prev = crop.pointers.get(e.pointerId);
  if (!prev) return;
  const p = stagePoint(e);
  crop.pointers.set(e.pointerId, p);
  if (crop.pointers.size === 1) {
    crop.x += p.x - prev.x;
    crop.y += p.y - prev.y;
    renderCrop();
  } else if (crop.pinch && crop.pointers.size === 2) {
    const [a, b] = [...crop.pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    zoomTo(crop.pinch.s * (dist / crop.pinch.dist), (a.x + b.x) / 2, (a.y + b.y) / 2);
  }
});
const endPointer = (e) => {
  crop.pointers.delete(e.pointerId);
  if (crop.pointers.size < 2) crop.pinch = null;
  if (!crop.pointers.size) cropStage.classList.remove('dragging');
};
cropStage.addEventListener('pointerup', endPointer);
cropStage.addEventListener('pointercancel', endPointer);
cropDlg.addEventListener('close', () => {
  crop.pointers.clear();
  if (crop.url) { URL.revokeObjectURL(crop.url); crop.url = ''; }
});

$('#crop-save').addEventListener('click', async () => {
  const btn = $('#crop-save');
  busy(btn, true, 'Saving…');
  try {
    const N = 256, c = document.createElement('canvas');
    c.width = N; c.height = N;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cropImg, -crop.x / crop.s, -crop.y / crop.s, crop.V / crop.s, crop.V / crop.s, 0, 0, N, N);
    const blob = await canvasBlob(c, 'image/jpeg', 0.9);
    refreshMe(await api('PUT', '/api/me/avatar/image', blob));
    cropDlg.close();
    toast('Profile picture updated');
  } catch (err) {
    toast(err.message);
  } finally {
    busy(btn, false);
  }
});

// ---------- import / export ----------

let ioUser = null; // null = me, otherwise the admin's target user

function openIO(user) {
  ioUser = user;
  $('#io-title').textContent = user ? `Import & export: ${nameOf(user)}` : 'Import & export';
  $('#io-previews').hidden = !!user;
  $('#io-result').hidden = true;
  // With "Remove duplicates" on in Settings, imports always skip duplicates.
  const forced = !user && !!dupMode();
  $('#io-skip').disabled = forced;
  if (forced) $('#io-skip').checked = true;
  $('#io-skip').parentElement.title = forced ? 'Always on: Remove duplicates is turned on in Settings' : '';
  updatePreviewCount();
  $('#io-dlg').showModal();
}

function updatePreviewCount() {
  const missing = S.list.filter((b) => !b.thumb).length;
  $('#io-fetch').disabled = !missing || previewJob;
  if (!previewJob) $('#io-fetch-status').textContent = missing ? `${missing} crumb${missing === 1 ? ' has' : 's have'} no thumbnail.` : 'Every crumb has a thumbnail.';
}

function download(text, filename, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

$('#io-export').addEventListener('click', async () => {
  const btn = $('#io-export');
  busy(btn, true, 'Preparing…');
  try {
    const data = await api('GET', ioUser ? `/api/users/${ioUser.id}/export` : '/api/export');
    const fmt = $('#io-format').value;
    const out = EXPORTERS[fmt](data);
    const day = new Date().toISOString().slice(0, 10);
    download(out.text, `crumbs-${data.user}-${day}.${out.ext}`, out.mime);
  } catch (err) {
    toast(err.message);
  } finally {
    busy(btn, false);
  }
});

$('#io-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const res = $('#io-result');
  res.hidden = false;
  res.textContent = `Reading ${file.name}…`;
  try {
    const items = parseImport(await file.text(), file.name);
    if (!items.length) { res.textContent = 'No links found in that file.'; return; }
    res.textContent = `Importing ${items.length} links…`;
    const r = await api('POST', ioUser ? `/api/users/${ioUser.id}/import` : '/api/import',
      { items, skipDuplicates: $('#io-skip').checked });
    res.textContent = `Added ${r.added} crumb${r.added === 1 ? '' : 's'}`
      + (r.folders ? ` and ${r.folders} folder${r.folders === 1 ? '' : 's'}` : '')
      + (r.skipped ? `. Skipped ${r.skipped} (already saved or not a web link).` : '.');
    if (ioUser) { if ($('#admin').open) await loadUsers(); }
    else { await loadBookmarks(); updatePreviewCount(); }
  } catch (err) {
    res.textContent = 'Import failed: ' + err.message;
  }
});

// Fetch thumbnails and favicons for crumbs that have none (e.g. after an import).
let previewJob = false;
$('#io-fetch').addEventListener('click', async () => {
  const todo = S.list.filter((b) => !b.thumb);
  if (!todo.length || previewJob) return;
  previewJob = true;
  $('#io-fetch').disabled = true;
  const status = $('#io-fetch-status');
  let done = 0, found = 0;
  const step = async (b) => {
    try {
      const meta = await api('GET', '/api/meta?url=' + encodeURIComponent(b.url));
      const [thumb, ico] = await Promise.all([
        firstOk(meta.images, (x) => makeThumb(x)),
        b.icon ? null : firstOk(meta.icons, makeIcon),
      ]);
      if (thumb) { await api('PUT', `/api/bookmarks/${b.id}/thumb`, thumb); found++; }
      if (ico) await api('PUT', `/api/bookmarks/${b.id}/icon`, ico);
    } catch { /* skip this one */ }
    done++;
    status.textContent = `Fetching previews… ${done} of ${todo.length}`;
  };
  const queue = [...todo];
  const worker = async () => { while (queue.length) await step(queue.shift()); };
  await Promise.all([worker(), worker(), worker()]); // 3 at a time keeps the Pi relaxed
  previewJob = false;
  await loadBookmarks();
  status.textContent = `Done: found ${found} thumbnail${found === 1 ? '' : 's'} for ${todo.length} crumb${todo.length === 1 ? '' : 's'}.`;
  $('#io-fetch').disabled = !S.list.some((b) => !b.thumb);
  if (!$('#io-dlg').open) toast(`Previews fetched for ${found} crumbs`);
});

// ---- exporters ----

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function exportTree(data) {
  const fmap = new Map(data.folders.map((f) => [f.id, f]));
  const kids = new Map();
  for (const f of data.folders) {
    const p = f.parentId && fmap.has(f.parentId) ? f.parentId : 0;
    if (!kids.has(p)) kids.set(p, []);
    kids.get(p).push(f);
  }
  const marks = new Map();
  for (const b of data.bookmarks) {
    const k = b.folderId && fmap.has(b.folderId) ? b.folderId : 0;
    if (!marks.has(k)) marks.set(k, []);
    marks.get(k).push(b);
  }
  const path = (id) => {
    const out = [];
    for (let cur = id, g = 0; cur && fmap.has(cur) && g < 100; cur = fmap.get(cur).parentId, g++) out.unshift(fmap.get(cur).name);
    return out;
  };
  return { kids: (id) => kids.get(id) || [], marks: (id) => marks.get(id) || [], path };
}

const csvCell = (v) => (/[",\n\r]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const iso = (t) => (t ? new Date(t * 1000).toISOString() : '');

const EXPORTERS = {
  html(data) {
    const t = exportTree(data);
    const lines = [
      '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
      '<!-- This is an automatically generated file. It will be read and overwritten. DO NOT EDIT! -->',
      '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
      '<TITLE>Bookmarks</TITLE>',
      '<H1>Bookmarks</H1>',
      '<DL><p>',
    ];
    const walk = (id, pad) => {
      for (const f of t.kids(id)) {
        lines.push(`${pad}<DT><H3 ADD_DATE="${f.created || ''}">${esc(f.name)}</H3>`, `${pad}<DL><p>`);
        walk(f.id, pad + '    ');
        lines.push(`${pad}</DL><p>`);
      }
      for (const b of t.marks(id)) {
        lines.push(`${pad}<DT><A HREF="${esc(b.url)}" ADD_DATE="${b.created || ''}" LAST_MODIFIED="${b.updated || ''}">${esc(b.name)}</A>`);
        if (b.description) lines.push(`${pad}<DD>${esc(b.description)}`);
      }
    };
    walk(0, '    ');
    lines.push('</DL><p>');
    return { text: lines.join('\n') + '\n', ext: 'html', mime: 'text/html' };
  },
  json(data) {
    return { text: JSON.stringify(data, null, 2), ext: 'json', mime: 'application/json' };
  },
  csv(data) {
    const t = exportTree(data);
    const rows = [['name', 'url', 'description', 'folder', 'created', 'updated']];
    for (const b of data.bookmarks) rows.push([b.name, b.url, b.description, t.path(b.folderId).join(' / '), iso(b.created), iso(b.updated)]);
    return { text: rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n', ext: 'csv', mime: 'text/csv' };
  },
  md(data) {
    const t = exportTree(data);
    const lines = ['# Crumbs', ''];
    const link = (b) => `- [${b.name.replace(/([\[\]])/g, '\\$1')}](${b.url.replace(/\)/g, '%29')})${b.description ? ' — ' + b.description.replace(/\s+/g, ' ') : ''}`;
    const top = t.marks(0);
    if (top.length) lines.push('## Uncategorized', '', ...top.map(link), '');
    const walk = (id, depth) => {
      for (const f of t.kids(id)) {
        lines.push(`${'#'.repeat(Math.min(depth, 6))} ${f.name}`, '');
        const ms = t.marks(f.id);
        if (ms.length) lines.push(...ms.map(link), '');
        walk(f.id, depth + 1);
      }
    };
    walk(0, 2);
    return { text: lines.join('\n'), ext: 'md', mime: 'text/markdown' };
  },
  txt(data) {
    return { text: data.bookmarks.map((b) => b.url).join('\n') + '\n', ext: 'txt', mime: 'text/plain' };
  },
};

// ---- importers: everything becomes { name, url, description, path, created } ----

function toSeconds(v) {
  if (v == null || v === '') return 0;
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) {
    if (n > 1e16) return Math.floor(n / 1e6) - 11644473600; // Chrome: µs since 1601
    if (n > 1e14) return Math.floor(n / 1e6);             // Firefox: µs since 1970
    if (n > 1e11) return Math.floor(n / 1e3);             // ms
    return Math.floor(n);                                  // s
  }
  const d = Date.parse(v);
  return Number.isFinite(d) ? Math.floor(d / 1000) : 0;
}

const splitPath = (s) => (s ? String(s).split(String(s).includes(' / ') ? ' / ' : /\s*[\/>]\s*/).map((x) => x.trim()).filter(Boolean) : []);

function parseImport(text, filename = '') {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const head = text.slice(0, 2000);
  if (ext === 'json' || /^\s*[\[{]/.test(head)) return importJSON(JSON.parse(text));
  if (ext === 'html' || ext === 'htm' || /<!DOCTYPE NETSCAPE|<dl[\s>]|<a\s+href/i.test(head)) return importHTML(text);
  if (ext === 'csv') return importCSV(text);
  if (ext === 'md' || ext === 'markdown' || /\]\(https?:\/\//.test(head)) return importMarkdown(text);
  return importText(text);
}

function importHTML(text) {
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const items = [];
  const walk = (dl, path) => {
    for (const dt of dl.children) {
      if (dt.tagName !== 'DT') continue;
      const h3 = dt.querySelector(':scope > h3');
      const a = dt.querySelector(':scope > a');
      if (h3) {
        const next = dt.nextElementSibling;
        const sub = dt.querySelector(':scope > dl') || (next && next.tagName === 'DL' ? next : null);
        if (sub) walk(sub, [...path, h3.textContent.trim()]);
      } else if (a && a.getAttribute('href')) {
        const next = dt.nextElementSibling;
        const dd = next && next.tagName === 'DD' ? next : dt.querySelector(':scope > dd');
        items.push({
          name: a.textContent.trim(), url: a.getAttribute('href'),
          description: dd ? dd.textContent.trim() : '', path, created: toSeconds(a.getAttribute('add_date')),
        });
      }
    }
  };
  const root = doc.querySelector('dl');
  if (root) walk(root, []);
  if (!items.length) {
    for (const a of doc.querySelectorAll('a[href]')) items.push({ name: a.textContent.trim(), url: a.getAttribute('href'), description: '', path: [], created: 0 });
  }
  return items.filter((i) => /^https?:/i.test(i.url));
}

function importJSON(data) {
  const items = [];
  // Crumbs backup
  if (data && Array.isArray(data.bookmarks)) {
    const t = exportTree({ folders: data.folders || [], bookmarks: [] });
    for (const b of data.bookmarks) {
      items.push({ name: b.name || b.title || '', url: b.url || '', description: b.description || '', path: t.path(b.folderId), created: toSeconds(b.created) });
    }
    return items;
  }
  // Chrome / Edge "Bookmarks" file, Firefox .json backup, or any tree with children
  const walk = (node, path) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach((n) => walk(n, path)); return; }
    const url = node.url || node.uri || node.href || node.link;
    if (typeof url === 'string' && /^https?:/i.test(url)) {
      const folder = node.folder || node.path || node.collection || node.category;
      items.push({
        name: node.name || node.title || '', url,
        description: node.description || node.note || node.excerpt || '',
        path: folder ? (Array.isArray(folder) ? folder : splitPath(folder)) : path,
        created: toSeconds(node.created || node.date_added || node.dateAdded || node.created_at || node.time_added),
      });
      return;
    }
    const kids = node.children || (node.roots && Object.values(node.roots));
    if (kids) {
      const name = node.name || node.title;
      walk(kids, name && !node.roots ? [...path, name] : path);
    }
  };
  walk(data, []);
  return items;
}

function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',' || c === ';' && !text.slice(0, 500).includes(',')) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

function importCSV(text) {
  const rows = parseCSV(text.replace(/^﻿/, ''));
  if (!rows.length) return [];
  const header = rows[0].map((x) => x.trim().toLowerCase());
  const col = (...names) => header.findIndex((x) => names.includes(x));
  const iu = col('url', 'link', 'href', 'uri', 'address');
  const items = [];
  if (iu >= 0) {
    const iname = col('name', 'title'), idesc = col('description', 'note', 'notes', 'excerpt', 'comment');
    const ifold = col('folder', 'path', 'collection', 'category'), icreated = col('created', 'created_at', 'time_added', 'date_added', 'added', 'date');
    for (const r of rows.slice(1)) {
      items.push({
        name: iname >= 0 ? r[iname] || '' : '', url: (r[iu] || '').trim(),
        description: idesc >= 0 ? r[idesc] || '' : '', path: ifold >= 0 ? splitPath(r[ifold]) : [],
        created: icreated >= 0 ? toSeconds(r[icreated]) : 0,
      });
    }
  } else {
    for (const r of rows) {
      const url = r.find((x) => /^https?:\/\//i.test(x.trim()));
      if (url) items.push({ name: r.find((x) => x.trim() && x !== url) || '', url: url.trim(), description: '', path: [], created: 0 });
    }
  }
  return items.filter((i) => /^https?:/i.test(i.url));
}

function importMarkdown(text) {
  const items = [];
  let path = [];
  for (const line of text.split(/\r?\n/)) {
    const hd = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (hd) {
      const level = hd[1].length;
      if (level === 1) { path = []; continue; } // the document title
      path = path.slice(0, level - 2);
      path[level - 2] = hd[2].trim();
      if (/^uncategori[sz]ed$/i.test(hd[2].trim()) && level === 2) path = [];
      continue;
    }
    const re = /\[((?:\\.|[^\]])*)\]\((https?:\/\/[^)\s]+)\)/g;
    let m, any = false;
    while ((m = re.exec(line))) {
      any = true;
      const rest = line.slice(m.index + m[0].length);
      const desc = /^\s*[—–-]\s*(.+)$/.exec(rest);
      items.push({ name: m[1].replace(/\\(.)/g, '$1'), url: m[2], description: desc ? desc[1].trim() : '', path: path.filter(Boolean), created: 0 });
    }
    if (!any) {
      const u = /(https?:\/\/[^\s<>()]+)/.exec(line);
      if (u) items.push({ name: '', url: u[1], description: '', path: path.filter(Boolean), created: 0 });
    }
  }
  return items;
}

function importText(text) {
  const items = [];
  for (const line of text.split(/\r?\n/)) {
    const m = /(https?:\/\/[^\s<>"']+)/.exec(line);
    if (!m) continue;
    const name = line.replace(m[1], '').replace(/^[\s\-*•|:,]+|[\s\-*•|:,]+$/g, '');
    items.push({ name, url: m[1], description: '', path: [], created: 0 });
  }
  return items;
}

// ---------- settings (this browser) ----------

function openSettings() {
  renderSettings();
  $('#settings').showModal();
}

const SEGMENTS = [['#set-theme', 'theme'], ['#set-size', 'size'], ['#set-layout', 'layout'], ['#set-bg', 'bg']];

function renderSettings() {
  for (const [id, key] of SEGMENTS) {
    for (const b of $(id).querySelectorAll('button[data-v]')) {
      b.classList.toggle('on', b.dataset.v === prefs[key]);
      b.setAttribute('aria-pressed', String(b.dataset.v === prefs[key]));
    }
  }
  $('#bg-image-opts').hidden = prefs.bg !== 'image';
  $('#bg-bw').checked = !!prefs.bgBW;
  $('#bg-strength').value = String(prefs.bgStrength);
  $('#set-newtab').checked = prefs.newTab;
  renderDup();
}

for (const [id, key] of SEGMENTS) {
  $(id).addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    if (key === 'bg' && b.dataset.v === 'image' && !readBgImage()) { $('#bg-file').click(); return; }
    prefs[key] = b.dataset.v;
    savePrefs();
    applyPrefs();
    renderSettings();
  });
}

$('#bg-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    // Shrink the photo so it fits in browser storage.
    const { img, done } = await loadImage(file);
    let url;
    try {
      const scale = Math.min(1, 1920 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      url = c.toDataURL('image/jpeg', 0.78);
    } finally { done(); }
    try { localStorage.setItem('crumbs.bgimg', url); }
    catch { toast('That photo is too big to keep in this browser. Try a smaller one.'); return; }
    prefs.bg = 'image';
    savePrefs();
    applyPrefs();
    renderSettings();
  } catch {
    toast('That file is not an image Crumbs can read.');
  }
});
$('#bg-bw').addEventListener('change', (e) => { prefs.bgBW = e.target.checked; savePrefs(); applyPrefs(); });
$('#bg-strength').addEventListener('input', (e) => { prefs.bgStrength = Number(e.target.value); savePrefs(); applyPrefs(); });

$('#set-newtab').addEventListener('change', (e) => {
  prefs.newTab = e.target.checked;
  savePrefs();
  buildCards();
  renderTree();
});

// ---- duplicates (saved to the account, not the browser) ----
// "" = off, "all" = a link only once anywhere, "folder" = only once per folder.

const dupMode = () => (S.me && S.me.dedupe) || '';
const pickedDupMode = () => (document.querySelector('input[name="dup-mode"]:checked') || {}).value || 'all';

function renderDup() {
  const mode = dupMode();
  $('#dup-on').checked = !!mode;
  $('#dup-modes').hidden = !mode;
  for (const r of document.querySelectorAll('input[name="dup-mode"]')) r.checked = r.value === (mode || 'all');
}

async function setDedupe(mode) {
  const u = await api('PUT', '/api/me', { dedupe: mode });
  if (S.guest) S.me.dedupe = u.dedupe; else refreshMe(u);
  renderDup();
  if (mode) await cleanDuplicates(mode, false);
  else toast('Duplicates are allowed again');
}

// Count duplicates first, then ask before moving the extra copies to the trash.
async function cleanDuplicates(mode, sayIfNone) {
  const { count } = await api('POST', '/api/dedupe?dry=1', { mode });
  if (!count) {
    toast(sayIfNone ? 'No duplicates found' : (mode === 'all' ? 'Duplicates are now blocked everywhere' : 'Duplicates are now blocked inside each folder'));
    return;
  }
  const ok = await ask({
    title: `Found ${count} duplicate${count === 1 ? '' : 's'}`,
    text: (mode === 'all'
      ? 'Keep one copy of each link and move the other copies to the Trash?'
      : 'Keep one copy of each link per folder and move the extra copies to the Trash?')
      + ' The copy with a thumbnail (or the oldest one) is kept.',
    ok: 'Move to Trash',
  });
  if (!ok) return;
  const r = await api('POST', '/api/dedupe', { mode });
  await loadBookmarks();
  toast(`Moved ${r.count} duplicate${r.count === 1 ? '' : 's'} to the Trash`, { label: 'Show', fn: () => selectView('trash') });
}

$('#dup-on').addEventListener('change', async (e) => {
  try { await setDedupe(e.target.checked ? pickedDupMode() : ''); }
  catch (err) { toast(err.message); renderDup(); }
});
for (const r of document.querySelectorAll('input[name="dup-mode"]')) {
  r.addEventListener('change', async () => {
    try { await setDedupe(r.value); }
    catch (err) { toast(err.message); renderDup(); }
  });
}
$('#dup-clean').addEventListener('click', async () => {
  try { await cleanDuplicates(dupMode() || pickedDupMode(), true); }
  catch (err) { toast(err.message); }
});

// ---------- admin ----------

let ownerName = '';
let adminUsers = [];

async function openAdmin() {
  showError('#user-error', '');
  $('#user-form').reset();
  try { await loadUsers(); } catch (e) { toast(e.message); return; }
  $('#admin').showModal();
}

async function loadUsers() {
  const data = await api('GET', '/api/users');
  adminUsers = data.users;
  ownerName = data.owner;
  S.loginRequired = data.loginRequired;
  S.registration = data.registration;
  $('#login-req').checked = data.loginRequired;
  $('#registration').checked = data.registration;
  updateLoginNote();
  updateRegNote();
  $('#user-count').textContent = `· ${data.users.length}`;
  $('#user-list').replaceChildren(...data.users.map(userRow));
}

function usageLine(u) {
  if (u.storageLimit > 0) {
    const pct = Math.min(100, (u.storageUsed / u.storageLimit) * 100);
    const bar = h('span', { class: 'bar' }, h('i'));
    bar.firstChild.style.setProperty('width', pct.toFixed(1) + '%');
    return h('div', { class: 'usage' }, bar, `${formatBytes(u.storageUsed)} of ${formatBytes(u.storageLimit)}`);
  }
  return h('div', { class: 'usage' }, `${formatBytes(u.storageUsed)} used · no limit`);
}

function userRow(u) {
  const me = u.id === S.me.id;
  const more = h('button', {
    type: 'button', class: 'more-btn', title: 'More', 'aria-label': `Actions for ${nameOf(u)}`,
    'aria-haspopup': 'menu', 'aria-expanded': 'false',
    onclick: (e) => { e.stopPropagation(); openUserMenu(u, e.currentTarget); },
  });
  more.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></svg>';
  return h('li', { class: 'user-row' + (u.blocked ? ' blocked' : '') },
    avatarEl(u),
    h('div', { class: 'who' },
      h('div', { class: 'name' },
        h('strong', { text: nameOf(u) }),
        u.isAdmin ? h('span', { class: 'tag', text: 'admin' }) : null,
        u.blocked ? h('span', { class: 'tag', text: 'blocked' }) : null,
        me ? h('span', { class: 'tag', text: 'you' }) : null),
      h('div', { class: 'handle', text: `@${u.username} · ${u.bookmarks} crumb${u.bookmarks === 1 ? '' : 's'}` }),
      usageLine(u)),
    more);
}

function openUserMenu(u, btn) {
  const dd = $('#user-dd');
  const wasOpen = dd.classList.contains('open') && btn.getAttribute('aria-expanded') === 'true';
  closeMenus();
  if (wasOpen) return;
  const me = u.id === S.me.id;
  const item = (label, fn) => h('button', { type: 'button', role: 'menuitem', text: label, onclick: fn });
  $('#user-menu').replaceChildren(
    h('div', { class: 'menu-cap', text: nameOf(u) }),
    item('Change name', () => editUserName(u)),
    item('Change picture', () => pickUserPicture(u)),
    item('Storage limit…', () => setStorageLimit(u)),
    item('Reset password', () => resetPassword(u)),
    item('Import / export bookmarks', () => openIO(u)),
    me ? null : h('hr'),
    me ? null : item(u.isAdmin ? 'Remove admin rights' : 'Make admin', () => toggleAdmin(u)),
    me ? null : item(u.blocked ? 'Unblock access' : 'Block access', () => toggleBlock(u)),
    me ? null : item('Delete user', () => deleteUser(u)));
  const r = btn.getBoundingClientRect();
  const up = r.bottom + 340 > innerHeight;
  dd.classList.toggle('up', up);
  dd.style.setProperty('left', `${r.right}px`);
  dd.style.setProperty('top', `${up ? r.top : r.bottom}px`);
  dd.classList.add('open');
  btn.setAttribute('aria-expanded', 'true');
}
$('#admin').addEventListener('scroll', () => closeMenus(), true);

async function patchUser(u, body, msg) {
  try {
    const updated = await api('PATCH', `/api/users/${u.id}`, body);
    if (u.id === S.me.id && updated) refreshMe(updated);
    await loadUsers();
    if (msg) toast(msg);
    return true;
  } catch (err) {
    toast(err.message);
    return false;
  }
}

let unameUser = null;
function editUserName(u) {
  unameUser = u;
  const f = $('#uname-form');
  field(f, 'displayName').value = u.displayName || '';
  field(f, 'username').value = u.username;
  showError('#uname-error', '');
  $('#uname-dlg').showModal();
  field(f, 'displayName').focus();
}
$('#uname-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  try {
    const updated = await api('PATCH', `/api/users/${unameUser.id}`, {
      displayName: field(f, 'displayName').value, username: field(f, 'username').value.trim(),
    });
    if (unameUser.id === S.me.id) refreshMe(updated);
    $('#uname-dlg').close();
    await loadUsers();
    toast('Name updated');
  } catch (err) {
    showError('#uname-error', err.message);
  }
});

function pickUserPicture(u) {
  $('#upic-title').textContent = `Picture for ${nameOf(u)}`;
  $('#upic-note').textContent = (u.avatar || '').startsWith('/avatar/')
    ? 'They uploaded their own photo. Picking something else removes it.'
    : 'Only they can upload a photo, from their Profile.';
  $('#upic-grid').replaceChildren(...avatarGrid(u, async (v) => {
    if (await patchUser(u, { avatar: v }, 'Picture changed')) $('#upic-dlg').close();
  }));
  $('#upic-dlg').showModal();
}

async function setStorageLimit(u) {
  const mb = await ask({
    title: `Storage limit for ${nameOf(u)}`,
    text: `They use ${formatBytes(u.storageUsed)} now (thumbnails, icons, photo and text). Enter a limit in MB, or 0 for no limit.`,
    ok: 'Save limit',
    input: { type: 'number', min: 0, step: 'any', value: u.storageLimit ? +(u.storageLimit / 1048576).toFixed(2) : 0 },
  });
  if (mb == null || mb === '') return;
  const n = Number(mb);
  if (!Number.isFinite(n) || n < 0) { toast('Enter a number of MB, or 0'); return; }
  patchUser(u, { storageLimit: Math.round(n * 1048576) }, n ? `Limit set to ${formatBytes(Math.round(n * 1048576))}` : 'Limit removed');
}

async function toggleAdmin(u) {
  const ok = await ask(u.isAdmin
    ? { title: `Remove admin rights from ${nameOf(u)}?`, text: 'They keep their account and crumbs but lose the Admin menu.', ok: 'Remove admin' }
    : { title: `Make ${nameOf(u)} an admin?`, text: 'Admins can manage every user, see the Admin menu and change who can sign in.', ok: 'Make admin' });
  if (ok) patchUser(u, { isAdmin: !u.isAdmin }, u.isAdmin ? 'Admin rights removed' : `${nameOf(u)} is now an admin`);
}

async function toggleBlock(u) {
  const ok = await ask(u.blocked
    ? { title: `Unblock ${nameOf(u)}?`, text: 'They can sign in again.', ok: 'Unblock' }
    : { title: `Block ${nameOf(u)}?`, text: "They're signed out right away and can't sign in until you unblock them. Their crumbs are kept.", ok: 'Block access' });
  if (ok) patchUser(u, { blocked: !u.blocked }, u.blocked ? 'Access restored' : 'User blocked');
}

function updateLoginNote() {
  $('#login-note').textContent = S.loginRequired
    ? 'Everyone has to sign in with a username and password.'
    : `Login is off: anyone who can reach this Pi sees and edits ${ownerName}'s crumbs without a password. Admin and Profile still need a sign-in.`;
}

function updateRegNote() {
  $('#reg-note').textContent = S.registration
    ? 'Anyone who can open Crumbs can create their own account from the sign-in page.'
    : 'Only admins can add new users (below).';
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

$('#registration').addEventListener('change', async (e) => {
  const on = e.target.checked;
  try {
    await api('PUT', '/api/settings', { registration: on });
    S.registration = on;
    updateRegNote();
    toast(on ? 'Registration is open' : 'Registration is closed');
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
      displayName: field(f, 'displayName').value.trim(),
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
  const pw = await ask({ title: `New password for ${nameOf(u)}`, text: 'At least 6 characters. They will be signed out everywhere.', ok: 'Set password', input: 'password' });
  if (!pw) return;
  try {
    await api('PUT', `/api/users/${u.id}/password`, { password: pw });
    toast('Password changed');
  } catch (err) { toast(err.message); }
}

async function deleteUser(u) {
  const ok = await ask({ title: `Delete ${nameOf(u)}?`, text: `Their account, folders and all ${u.bookmarks} of their crumbs will be deleted. This can't be undone.`, ok: 'Delete user' });
  if (!ok) return;
  try {
    await api('DELETE', `/api/users/${u.id}`);
    await loadUsers();
    toast('User deleted');
  } catch (err) { toast(err.message); }
}

boot();
