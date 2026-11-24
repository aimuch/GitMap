(function () {
  var STATE_KEY = 'gitmap.webview.state';
  var targetOrigin = window.location.origin || '*';

  function applyTheme(theme) {
    if (!document.body) return;
    document.body.classList.add('gitmap-standalone');
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
    } else if (ev.data && ev.data.__gitmapRevealLastViewed) {
      window.dispatchEvent(new CustomEvent('gitmap-reveal-last-viewed', {
        detail: { filePath: typeof ev.data.filePath === 'string' ? ev.data.filePath : '' }
      }));
      ev.stopImmediatePropagation();
    } else if (ev.data && typeof ev.data.__gitmapFilterByFile === 'string') {
      window.dispatchEvent(new CustomEvent('gitmap-filter-by-file', { detail: { filePath: ev.data.__gitmapFilterByFile } }));
      ev.stopImmediatePropagation();
    }
  }, true);

  // Forward unhandled Escape & shell shortcuts to the parent window when focus is inside the iframe
  document.addEventListener('keydown', function (ev) {
    if (ev.defaultPrevented) return;
    var tag = ev.target && ev.target.tagName ? ev.target.tagName.toLowerCase() : '';
    var isEditable = tag === 'input' || tag === 'textarea' || (ev.target && ev.target.isContentEditable);
    if (ev.key === 'Escape' && window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'gitmap-shell-key', key: 'Escape' }, targetOrigin);
    } else if (!isEditable && !ev.metaKey && !ev.ctrlKey && !ev.altKey && ev.key === '?') {
      if (window.parent && window.parent !== window) {
        ev.preventDefault();
        window.parent.postMessage({ type: 'gitmap-shell-action', action: 'open-shortcuts' }, targetOrigin);
      }
    } else if ((ev.metaKey || ev.ctrlKey) && ev.shiftKey && !ev.altKey && (ev.key === 'f' || ev.key === 'F')) {
      if (window.parent && window.parent !== window) {
        ev.preventDefault();
        window.parent.postMessage({ type: 'gitmap-shell-action', action: 'open-content-search' }, targetOrigin);
      }
    } else if ((ev.metaKey || ev.ctrlKey) && (ev.key === 'k' || ev.key === 'K') && !ev.shiftKey) {
      if (window.parent && window.parent !== window) {
        ev.preventDefault();
        window.parent.postMessage({ type: 'gitmap-shell-action', action: 'focus-search' }, targetOrigin);
      }
    } else if ((ev.metaKey || ev.ctrlKey) && (ev.key === 'p' || ev.key === 'P')) {
      if (window.parent && window.parent !== window) {
        ev.preventDefault();
        window.parent.postMessage({ type: 'gitmap-shell-action', action: 'open-command-palette' }, targetOrigin);
      }
    } else if ((ev.metaKey || ev.ctrlKey) && !ev.shiftKey && !ev.altKey && (ev.key === 'e' || ev.key === 'E')) {
      if (window.parent && window.parent !== window) {
        ev.preventDefault();
        window.parent.postMessage({ type: 'gitmap-shell-action', action: 'open-repo-files' }, targetOrigin);
      }
    } else if ((ev.metaKey || ev.ctrlKey) && !ev.altKey && ev.key === '\\') {
      if (window.parent && window.parent !== window) {
        ev.preventDefault();
        window.parent.postMessage({ type: 'gitmap-shell-action', action: 'toggle-split-layout', shiftKey: !!ev.shiftKey }, targetOrigin);
      }
    }
  });

  window.acquireVsCodeApi = function () {
    return {
      postMessage: function (msg) {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'gitmap-webview-req', payload: msg }, targetOrigin);
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
