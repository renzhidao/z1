// p1-voice.js
export function init() {
  const META_RETRY_MS = 1500;
  const META_MAX_RETRIES = 6;
  const META_MAX_TTL_MS = 20000;

  function ensureMaps() {
    if (!window.virtualFiles) window.virtualFiles = new Map();
    if (!window.smartMetaCache) window.smartMetaCache = new Map();
    if (!window.remoteFiles) window.remoteFiles = new Map();
  }

  function sendReliable(msg) {
    ensureMaps();
    window.__p1_voice_pending = window.__p1_voice_pending || new Map();
    const entry = { msg, targets: new Map(), start: Date.now(), discoveryTimer: null };
    window.__p1_voice_pending.set(msg.id, entry);

    const addTargetIf = (pid) => {
      if (!pid || pid === window.state.myId) return;
if (!entry.targets.has(pid)) entry.targets.set(pid, { acked: false, tries: 0, timer: null });
    };

    const isPublic = msg.target === 'all';
    if (!isPublic) addTargetIf(msg.target);
    else {
      Object.keys(window.state.conns || {}).forEach(pid => {
        const c = window.state.conns[pid];
        if (c && c.open) addTargetIf(pid);
      });
    }

    const sendTo = (pid) => {
      const c = window.state.conns && window.state.conns[pid];
      if (c && c.open) { try { c.send(msg); } catch (_) {} }
      else { try { window.p2p && window.p2p.connectTo && window.p2p.connectTo(pid); } catch (_) {} }
    };

    const armRetry = (pid) => {
      const t = entry.targets.get(pid);
      if (!t || t.acked) return;
      if (t.timer) { try { clearTimeout(t.timer); } catch (_) {} }
      t.timer = setTimeout(() => {
        if (t.acked) return;
        if ((Date.now() - entry.start > META_MAX_TTL_MS) || (t.tries >= META_MAX_RETRIES)) {
          try { clearTimeout(t.timer); } catch (_) {}
          t.timer = null;
          return;
        }
        t.tries++;
        sendTo(pid);
        armRetry(pid);
      }, META_RETRY_MS);
    };

    entry.targets.forEach((_, pid) => { sendTo(pid); armRetry(pid); });
  }

  function handleAck(pkt, fromPeerId) {
    const refId = pkt && pkt.refId;
    if (!refId) return false;
    const pend = window.__p1_voice_pending;
    if (!pend || !pend.get) return false;
    const entry = pend.get(refId);
    if (!entry) return false;
    const pid = fromPeerId || pkt.from || '';
    const t = entry.targets.get(pid);
    if (t) {
      t.acked = true;
      if (t.timer) { try { clearTimeout(t.timer); } catch (_) {} t.timer = null; }
    }
    const allAcked = Array.from(entry.targets.values()).every(x => x.acked);
    if (allAcked) pend.delete(refId);
    return true;
  }

  function patchOnce() {
    if (!window.protocol || !window.state) return false;

    if (!window.protocol.__p1_voice_proc_patched && typeof window.protocol.processIncoming === 'function') {
      const origProc = window.protocol.processIncoming.bind(window.protocol);
      window.protocol.processIncoming = function(pkt, fromPeerId) {
        try { if (pkt && pkt.t === 'SMART_META_ACK') { try { handleAck(pkt, fromPeerId); } catch (_) {} } } catch (_) {}
        return origProc(pkt, fromPeerId);
      };
      window.protocol.__p1_voice_proc_patched = true;
    }

    if (!window.protocol.__p1_voice_send_patched && typeof window.protocol.sendMsg === 'function') {
      const origSend = window.protocol.sendMsg.bind(window.protocol);
      window.protocol.sendMsg = async function(txt, kind, meta) {
        try {
          if (String(kind) === 'voice' && meta && meta.fileObj) {
            ensureMaps();

            const file = meta.fileObj;
            const fileId = 'v_' + Date.now() + Math.random().toString(36).slice(2, 7);
            window.virtualFiles.set(fileId, file);

            const duration = (meta.duration != null) ? meta.duration : (txt != null ? txt : 0);
            const durStr = String(duration);

            const metaData = {
              fileId,
              fileName: (meta.name || file.name || ('voice_' + Date.now() + '.webm')),
              fileSize: (meta.size || file.size || 0),
              fileType: (meta.type || file.type || 'audio/webm'),
              duration: Number(duration) || 0
            };

            const msg = {
              t: 'SMART_META',
              id: 'm_' + Date.now() + Math.random().toString(36).slice(2, 7),
              ts: Date.now(),
              senderId: window.state.myId,
              n: window.state.myName,
              kind: 'voice',
              txt: durStr,
              meta: metaData,
              target: (window.state.activeChat && window.state.activeChat !== 'all') ? window.state.activeChat : 'all'
            };

            try { window.protocol.processIncoming(msg); } catch (_) {}
            sendReliable(msg);
            return;
          }
        } catch (_) {}
        return origSend(txt, kind, meta);
      };
      window.protocol.__p1_voice_send_patched = true;
    }
    return true;
  }

  if (!patchOnce()) {
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (patchOnce() || tries > 80) clearInterval(t);
    }, 50);
  }
}
