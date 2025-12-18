// patches/smartmeta-db.js
// Persist SMART_META (voice/file/video meta) into IndexedDB msgs store

export function init() {
  function applyOnce() {
    try {
      const w = window;
      if (!w || !w.protocol || typeof w.protocol.processIncoming !== 'function') return false;
      if (!w.db || typeof w.db.saveMsg !== 'function') return false;
      if (!w.state || !w.state.seenMsgs) return false;
      if (w.protocol.__p1_smartmeta_db_patched) return true;

      const orig = w.protocol.processIncoming.bind(w.protocol);
      w.protocol.processIncoming = function(pkt, fromPeerId) {
        let wasSeen = false;
        try {
          if (pkt && pkt.t === 'SMART_META' && pkt.id && w.state && w.state.seenMsgs) {
            wasSeen = w.state.seenMsgs.has(pkt.id);
          }
        } catch (_) {}

        const r = orig(pkt, fromPeerId);

        try {
          if (pkt && pkt.t === 'SMART_META' && pkt.id && !wasSeen) {
            // only save meta message itself (not file body)
            w.db.saveMsg(pkt);
          }
        } catch (_) {}

        return r;
      };

      w.protocol.__p1_smartmeta_db_patched = true;
      try {
        const msg = 'SMART_META -> db.saveMsg enabled';
        try { console.log('[Patch]', msg); } catch (_) {}
        try { if (w.util && typeof w.util.log === 'function') w.util.log('[Patch] ' + msg); } catch (_) {}
        try {
          const sys = w.logSystem;
          if (sys && typeof sys.push === 'function') {
            const ts = new Date().toLocaleTimeString();
            sys.push(`[${ts}] [Patch] ${msg}`);
          }
        } catch (_) {}
        try { w.corePatch && w.corePatch.log && w.corePatch.log(msg); } catch (_) {}
      } catch (_) {}
      return true;
    } catch (_) {
      return false;
    }
  }

  if (applyOnce()) return;
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (applyOnce() || tries > 200) clearInterval(t);
  }, 50);
}
