// Applies saved look-and-feel settings before the page paints (no flash).
try {
  var p = JSON.parse(localStorage.getItem('crumbs.prefs') || '{}');
  var r = document.documentElement;
  if (p.theme === 'light' || p.theme === 'dark') r.dataset.theme = p.theme;
  if (p.size) r.dataset.size = p.size;
  if (p.layout) r.dataset.layout = p.layout;
  var img = p.bg === 'image' ? localStorage.getItem('crumbs.bgimg') : '';
  if (p.bg && (p.bg !== 'image' || img)) r.dataset.bg = p.bg;
  if (img) r.style.setProperty('--bg-img', 'url("' + img + '")');
  if (p.bgBW !== false) r.setAttribute('data-bgbw', '');
  if (p.bgStrength) r.style.setProperty('--bg-strength', String(p.bgStrength / 100));
} catch (e) { /* storage blocked: defaults */ }
