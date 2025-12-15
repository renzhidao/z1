// SMART_META reliable delivery

import { CHAT } from '../constants.js';
import { META_RETRY_MS, META_MAX_RETRIES, META_MAX_TTL_MS } from './config.js';
import { log } from './logger.js';

export class MetaManager {
  constructor(getState) {
    this.getState = getState;
    this.pendingMeta = new Map();
  }

  sendReliable(msg) {
    const state = this.getState();
    const entry = {
      scope: (msg.target === CHAT.PUBLIC_ID) ? 'public' : 'direct',
      msg,
      targets: new Map(),
      start: Date.now(),
      discoveryTimer: null
    };

    this.pendingMeta.set(msg.id, entry);

    const addTargetIf = (pid) => {
      if (!pid || pid === state.myId) return;
      if (!state.conns || !state.conns[pid]) return;
      if (!entry.targets.has(pid)) entry.targets.set(pid, { acked: false, tries: 0, timer: null });
    };

    if (entry.scope === 'direct') {
      addTargetIf(msg.target);
    } else {
      Object.keys(state.conns || {}).forEach(pid => {
        const c = state.conns[pid];
        if (c && c.open) addTargetIf(pid);
      });
    }

    const sendTo = (pid) => {
      const c = state.conns && state.conns[pid];
      if (c && c.open) {
        try { c.send(msg); } catch (e) {}
      }
    };

    const armRetry = (pid) => {
      const target = entry.targets.get(pid);
      if (!target || target.acked) return;
      if (target.timer) clearTimeout(target.timer);

      target.timer = setTimeout(() => {
        if (target.acked) return;

        if (Date.now() - entry.start > META_MAX_TTL_MS || target.tries >= META_MAX_RETRIES) {
          log(`❌ SMART_META ${msg.id} -> ${pid} 超时未确认 (tries=${target.tries})`);
          clearTimeout(target.timer);
          target.timer = null;
          return;
        }

        target.tries++;
        log(`🔁 重新发送 SMART_META #${target.tries} -> ${pid}`);
        sendTo(pid);
        armRetry(pid);
      }, META_RETRY_MS);
    };

    entry.targets.forEach((_, pid) => {
      sendTo(pid);
      armRetry(pid);
    });

    if (entry.scope === 'public') {
      entry.discoveryTimer = setInterval(() => {
        if (Date.now() - entry.start > META_MAX_TTL_MS) {
          clearInterval(entry.discoveryTimer);
          entry.discoveryTimer = null;
          return;
        }

        Object.keys(state.conns || {}).forEach(pid => {
          const c = state.conns[pid];
          if (c && c.open && !entry.targets.has(pid)) {
            log(`🆕 新上线 peer，补发 SMART_META -> ${pid}`);
            addTargetIf(pid);
            sendTo(pid);
            armRetry(pid);
          }
        });
      }, 1000);
    }
  }

  handleAck(pkt, fromPeerId) {
    const refId = pkt && pkt.refId;
    const entry = refId ? this.pendingMeta.get(refId) : null;
    if (!entry) return;

    const pid = fromPeerId || pkt.from || '';
    const target = entry.targets.get(pid);
    if (!target) return;

    target.acked = true;
    if (target.timer) clearTimeout(target.timer);
    target.timer = null;

    log(`✅ 收到 SMART_META ACK <- ${pid} ref=${refId}`);

    const allAcked = Array.from(entry.targets.values()).every(t => t.acked);
    if (allAcked) {
      if (entry.discoveryTimer) clearInterval(entry.discoveryTimer);
      this.pendingMeta.delete(refId);
    }
  }
}
