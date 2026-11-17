(function () {
  function applyTheme(theme) {
    if (!document.body) return;
    document.body.classList.remove('vscode-dark', 'vscode-light');
    document.body.classList.add(theme === 'light' ? 'vscode-light' : 'vscode-dark');
  }

  var initialTheme = 'dark';
  try {
    initialTheme = localStorage.getItem('gitmap.theme') || 'dark';
  } catch (_) {}

  if (document.body) {
    applyTheme(initialTheme);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      applyTheme(initialTheme);
    });
  }

  window.addEventListener('message', function (ev) {
    if (ev.data && ev.data.__gitmapTheme) {
      applyTheme(ev.data.__gitmapTheme);
      ev.stopImmediatePropagation();
    }
  }, true);

  var parts = window.location.pathname.split('/');
  var panelId = decodeURIComponent(parts[parts.length - 1] || '');

  window.acquireVsCodeApi = function () {
    return {
      postMessage: function (msg) {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'gitmap-vfh-req', panelId: panelId, payload: msg }, '*');
        }
      },
      getState: function () {
        return null;
      },
      setState: function () {}
    };
  };
})();
