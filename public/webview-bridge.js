(function () {
  var STATE_KEY = 'gitmap.webview.state';

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
