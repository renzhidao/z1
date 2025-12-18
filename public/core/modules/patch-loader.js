// patch-loader.js
// Core Patch Interface: allow loading/stacking patches from separate files

export function init() {
  try {
    const w = window;
    if (w.corePatch && w.corePatch.__inited) return;

    const corePatch = w.corePatch = w.corePatch || {};
    corePatch.__inited = true;

    corePatch._hooks = Array.isArray(corePatch._hooks) ? corePatch._hooks : [];

    corePatch.log = (msg) => {

      try {

        const s = '[Patch] ' + String(msg || '');

        // 1) console（方便 DevTools）

        try { console.log(s); } catch (_) {}



        // 2) logSystem（你现有 LogConsole 面板读取 window.logSystem.history）

        try {

          const sys = w.logSystem;

          if (sys && typeof sys.push === 'function') {

            const ts = new Date().toLocaleTimeString();

            sys.push(`[${ts}] ${s}`);

          }

        } catch (_) {}



        // 3) util.log（部分 core 模块走这里）

        try { if (w.util && typeof w.util.log === 'function') w.util.log(s); } catch (_) {}

      } catch (_) {}

    };


    corePatch.register = (fn) => {
      try {
        if (typeof fn !== 'function') return;
        corePatch._hooks.push(fn);
      } catch (_) {}
    };

    corePatch.run = () => {
      try {
        const arr = corePatch._hooks.slice(0);
        corePatch._hooks = [];
        arr.forEach((fn) => { try { fn(); } catch (e) { corePatch.log('hook error: ' + (e && e.message || e)); } });
      } catch (_) {}
    };

    function _resolveFromHere(p) {
      const s = String(p || '').trim();
      if (!s) return '';
      // p is relative to /core/
      if (s.startsWith('modules/')) return './' + s.slice('modules/'.length);
      return '../' + s;
    }

    corePatch.load = async (path) => {
      try {
        const url = _resolveFromHere(path) + '?t=' + Date.now();
        const m = await import(url);
        if (m && typeof m.init === 'function') {
          m.init();
          corePatch.log('loaded: ' + String(path));
          return true;
        }
        corePatch.log('loaded(no-init): ' + String(path));
        return true;
      } catch (e) {
        corePatch.log('load fail: ' + String(path) + ' ' + (e && e.message || e));
        return false;
      }
    };

    // optional autoload from config
    try {
      const arr = w.config && w.config.patches;
      if (Array.isArray(arr) && arr.length) {
        (async () => {
          for (const p of arr) {
            await corePatch.load(p);
          }
        })();
      }
    } catch (_) {}

    corePatch.log('patch-loader ready');
  } catch (_) {}
}
