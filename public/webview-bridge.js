(function () {
  var STATE_KEY = 'gitmap.webview.state';

  function applyTheme(theme) {
    if (!document.body) return;
    document.body.classList.remove('vscode-dark', 'vscode-light');
    document.body.classList.add(theme === 'light' ? 'vscode-light' : 'vscode-dark');
  }

  // The shell stores a preference ('system', 'dark' or 'light'); resolve 'system' from the OS appearance
  var initialTheme = 'system';
  try {
    initialTheme = localStorage.getItem('gitmap.theme') || 'system';
  } catch (_) {}
  if (initialTheme !== 'light' && initialTheme !== 'dark') {
    initialTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

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

  window.acquireVsCodeApi = function () {
    return {
      postMessage: function (msg) {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'gitmap-webview-req', payload: msg }, '*');
        }
      },
      getState: function () {
        try {
          var raw = sessionStorage.getItem(STATE_KEY);
          return raw ? JSON.parse(raw) : null;
        } catch (_) {
          return null;
        }
      },
      setState: function (state) {
        try {
          sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
        } catch (_) {}
      }
    };
  };
})();
