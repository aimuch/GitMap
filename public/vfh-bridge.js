(function () {
  var targetOrigin = window.location.origin || '*';

  function applyTheme(theme) {
    if (!document.body) return;
    document.body.classList.remove('vscode-dark', 'vscode-light');
    document.body.classList.add(theme === 'light' ? 'vscode-light' : 'vscode-dark');
  }

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
    if (window.location.origin && ev.origin && ev.origin !== window.location.origin) return;
    if (ev.data && ev.data.__gitmapTheme) {
      applyTheme(ev.data.__gitmapTheme);
      ev.stopImmediatePropagation();
    }
  }, true);

  document.addEventListener('keydown', function (ev) {
    if (!ev.defaultPrevented && ev.key === 'Escape' && window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'gitmap-shell-key', key: 'Escape' }, targetOrigin);
    } else if ((ev.metaKey || ev.ctrlKey) && (ev.key === 'p' || ev.key === 'P') && window.parent && window.parent !== window) {
      ev.preventDefault();
      window.parent.postMessage({ type: 'gitmap-shell-action', action: 'open-command-palette' }, targetOrigin);
    }
  });

  var parts = window.location.pathname.split('/');
  var panelId = decodeURIComponent(parts[parts.length - 1] || '');

  window.acquireVsCodeApi = function () {
    return {
      postMessage: function (msg) {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'gitmap-vfh-req', panelId: panelId, payload: msg }, targetOrigin);
        }
      },
      getState: function () {
        return null;
      },
      setState: function () {}
    };
  };
})();
