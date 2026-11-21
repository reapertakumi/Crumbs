// Applies the saved theme before the page paints (no flash).
try {
  var p = JSON.parse(localStorage.getItem('crumbs.prefs') || '{}');
  if (p.theme === 'light' || p.theme === 'dark') document.documentElement.dataset.theme = p.theme;
} catch (e) { /* storage blocked: follow the system theme */ }
