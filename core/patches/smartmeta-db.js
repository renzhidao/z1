// patches/smartmeta-db.js
// Persist SMART_META (voice/file/video meta) into IndexedDB msgs store
// Robust: even if other modules override protocol.processIncoming later, we re-wrap periodically.

export function init() {
  const w = window;

  function log(msg) {
    try {
      const s = '[Patch] ' + String(msg || '');
      try { console.log(s); } catch (_) {}
      try { if (w.util && typeof w.util.log === 'function') w.util.log(s); } catch (_) {}
      try {
        const sys = w.logSystem;
        if (sys && typeof sys.push === 'function') {
          const ts = new Date().toLocaleTimeString();
          sys.push(`[${ts}] ${s}`);
        }
      } catch (_) {}
      try { if (w.corePatch && typeof w.corePatch.log === 'function') w.corePatch.log(msg); } catch (_) {}
    } catch (_) {}
  }

  try { w.__p1_patch_smartmeta_db_loaded = true; } catch (_) {}
  log('smartmeta-db loaded');

  function wrapOnce() {
    try {
      if (!w || !w.protocol || typeof w.protocol.processIncoming !== 'function') return false;
      if (!w.db || typeof w.db.saveMsg !== 'function') return false;
      if (!w.state || !w.state.seenMsgs) return false;

      const cur = w.protocol.processIncoming;
      if (cur && cur.__p1_smartmeta_db_wrapper) return true;

      const wrapped = function(pkt, fromPeerId) {
        let wasSeen = false;
        try {
          if (pkt && pkt.t === 'SMART_META' && pkt.id && w.state && w.state.seenMsgs && typeof w.state.seenMsgs.has === 'function') {
            wasSeen = w.state.seenMsgs.has(pkt.id);
          }
        } catch (_) {}

        let r;
        try { r = cur.call(this, pkt, fromPeerId); } catch (e) { r = undefined; }

        try {
          if (pkt && pkt.t === 'SMART_META' && pkt.id && !wasSeen) {
            w.db.saveMsg(pkt); // 只存元数据，不存文件本体
          }
        } catch (_) {}

        return r;
      };

      wrapped.__p1_smartmeta_db_wrapper = true;
      try { wrapped.__p1_prev = cur; } catch (_) {}
      w.protocol.processIncoming = wrapped;

      log('SMART_META -> db.saveMsg enabled');
      return true;
    } catch (_) {
      return false;
    }
  }

  // 立即尝试 + 定时确保（防被后续覆盖）
  let ok = wrapOnce();
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    ok = wrapOnce() || ok;
    if ((ok && tries > 10) || tries > 240) {
      try { clearInterval(t); } catch (_) {}
    }
  }, 250);
}
