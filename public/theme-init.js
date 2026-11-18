(function () {
  var pref = 'system';
  var iconStyle = 'classic';
  var iconTheme = 'auto';
  try {
    pref = localStorage.getItem('gitmap.theme') || 'system';
    iconStyle = localStorage.getItem('gitmap.iconStyle') || 'classic';
    iconTheme = localStorage.getItem('gitmap.iconTheme') || 'auto';
  } catch (_) {}
  var theme =
    pref === 'light' || pref === 'dark'
      ? pref
      : window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark';
  if (document.body) {
    document.body.className = theme === 'light' ? 'vscode-light theme-light' : 'vscode-dark theme-dark';
  }
  var validStyles = { classic: 1, metro: 1, neon: 1, compass: 1, isometric: 1, minimal: 1 };
  if (!validStyles[iconStyle]) iconStyle = 'classic';
  var variant = iconTheme === 'light' || iconTheme === 'dark' ? iconTheme : theme;
  var fav = document.getElementById('appFavicon');
  if (fav) fav.href = '/resources/icons/' + iconStyle + '-' + variant + '.png';
})();
