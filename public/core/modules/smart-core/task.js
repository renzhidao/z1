// Download/Chunk task manager

import { CHUNK_SIZE, PARALLEL, PREFETCH_AHEAD, MAX_BUFFERED } from './config.js';
import { log, statBump, fmtMB } from './logger.js';
import { toNum, guessMime } from './utils.js';

export class TaskManager {
  constructor(core) {
    this.core = core;

    this.activeTasks = new Map();
    this.smartMetaCache = new Map();
    this.remoteFiles = new Map();

    this.SEND_QUEUE = [];

    // timers
    this._timerTimeouts = setInterval(() => this.checkTimeouts(), 1000);
    this._timerFlush = setInterval(() => this.flushSendQueue(), 100);
  }

  destroy() {
    try { clearInterval(this._timerTimeouts); } catch (_) {}
    try { clearInterval(this._timerFlush); } catch (_) {}
  }

  startDownloadTask(fileId) {
    if (this.activeTasks.has(fileId)) return;

    const meta = this.smartMetaCache.get(fileId);
    if (!meta) return;

    const fixedType = guessMime(meta.fileName, meta.fileType);

    const task = {
      fileId,
      size: meta.fileSize,
      fileType: fixedType,
      isVideo: /\.(mp4|mov|m4v)$/i.test((meta.fileName || '')) || /^video\//.test((fixedType || '')) || /mp4|quicktime/.test((fixedType || '')),

      parts: new Map(),
      swRequests: new Map(),

      // peers to try (do not require an existing conn here; pickConn will connect if needed)
      peers: [],
      peerIndex: 0,
      _lastConnectTry: 0,

      nextOffset: 0,
      lastWanted: -CHUNK_SIZE,
      wantQueue: [],
      inflight: new Set(),
      inflightTimestamps: new Map(),

      completed: false
    };

    // Prefer sender as primary peer even if conn not created yet
    const myId = window.state && window.state.myId;
    if (meta.senderId && meta.senderId !== myId && !task.peers.includes(meta.senderId)) {
      task.peers.push(meta.senderId);
    }

    // Add known remote peers (even if conn not created yet)
    if (this.remoteFiles.has(fileId)) {
      this.remoteFiles.get(fileId).forEach(pid => {
        if (pid && pid !== myId && !task.peers.includes(pid)) task.peers.push(pid);
      });
    }

    log(`🚀 任务开始: ${fileId} (${fmtMB(task.size)}) peers=${task.peers.length}`);

    this.activeTasks.set(fileId, task);

    // head first
    if (!task.wantQueue.includes(0)) task.wantQueue.unshift(0);

    // tail probe only for video
    if (task.isVideo && task.size > CHUNK_SIZE) {
      const lastChunk = Math.floor((task.size - 1) / CHUNK_SIZE) * CHUNK_SIZE;
      for (let i = 0; i < 6; i++) {
        const off = lastChunk - i * CHUNK_SIZE;
        if (off >= 0 && off !== 0 && !task.wantQueue.includes(off)) task.wantQueue.push(off);
      }
    }

    this.requestNextChunk(task);
  }

  requestNextChunk(task) {
    if (task.completed) return;

    const desired = PARALLEL;

    // SW prefetch
    task.swRequests.forEach(req => {
      let cursor = Math.floor(req.current / CHUNK_SIZE) * CHUNK_SIZE;
      const limit = cursor + PREFETCH_AHEAD;
      while (task.wantQueue.length < desired && cursor < limit && cursor < task.size) {
        if (!task.parts.has(cursor) && !task.inflight.has(cursor) && !task.wantQueue.includes(cursor)) {
          task.wantQueue.push(cursor);
        }
        cursor += CHUNK_SIZE;
      }
    });

    // sequential
    while (task.wantQueue.length < desired) {
      const off = Math.max(task.nextOffset, task.lastWanted + CHUNK_SIZE);
      if (off >= task.size) break;

      if (task.parts.has(off)) {
        task.nextOffset = off;
        task.lastWanted = off;
        continue;
      }

      if (!task.inflight.has(off) && !task.wantQueue.includes(off)) {
        task.wantQueue.push(off);
        task.lastWanted = off;
      } else {
        task.lastWanted += CHUNK_SIZE;
      }
    }

    this.dispatchRequests(task);
  }

  dispatchRequests(task) {
    // non-video must get head chunk first
    if (!task.isVideo && !task.parts.has(0)) {
      if (task.inflight.size > 0) return;
      task.wantQueue = [0];
    }

    while (task.inflight.size < PARALLEL && task.wantQueue.length > 0) {
      const off = task.wantQueue.shift();
      const conn = this.pickConn(task);
      if (!conn) { task.wantQueue.unshift(off); break; }

      try {
        const offNum = toNum(off);
        if (!Number.isFinite(offNum) || offNum < 0) continue;

        conn.send({ t: 'SMART_GET', fileId: task.fileId, offset: offNum, size: CHUNK_SIZE, reqId: task.fileId });
        task.inflight.add(offNum);
        task.inflightTimestamps.set(offNum, Date.now());
        statBump('req');
      } catch (e) {
        task.wantQueue.unshift(off);
        break;
      }
    }
  }

  pickConn(task) {
    if (!task.peers.length) return null;

    const conns = window.state && window.state.conns;

    const isConnOpen = (c) => {
      if (!c) return false;
      if (c.open) return true;
      const dc = c.dataChannel || c._dc;
      if (dc && dc.readyState === 'open') return true;
      return false;
    };

    // try existing open conns first (round-robin)
    if (conns) {
      for (let i = 0; i < task.peers.length; i++) {
        const idx = (task.peerIndex + i) % task.peers.length;
        const pid = task.peers[idx];
        const c = conns[pid];
        if (isConnOpen(c)) {
          task.peerIndex = (idx + 1) % task.peers.length;
          return c;
        }
      }
    }

    // ✅ 缺失功能修复：当没有 open 连接时，主动触发重连（节流）
    const now = Date.now();
    if (window.p2p && typeof window.p2p.connectTo === 'function') {
      if (!task._lastConnectTry || (now - task._lastConnectTry) > 2000) {
        task._lastConnectTry = now;
        for (const pid of task.peers) {
          try { if (pid) window.p2p.connectTo(pid); } catch (_) {}
        }
      }
    }

    return null;
  }

  handleBinaryData(buffer, fromId) {
    try {
      let u8;
      if (buffer instanceof ArrayBuffer) u8 = new Uint8Array(buffer);
      else if (buffer instanceof Uint8Array) u8 = buffer;
      else return;

      const len = u8[0];
      if (len === undefined) return;

      const headerStr = new TextDecoder().decode(u8.slice(1, 1 + len));
      const header = JSON.parse(headerStr);

      const off = toNum(header.offset);
      if (!Number.isFinite(off) || off < 0) return;
      header.offset = off;

      const body = u8.slice(1 + len);
      const safeBody = new Uint8Array(body);

      const fid = header.fileId || header.reqId;
      if (!fid) return;
      const task = this.activeTasks.get(fid);
      if (!task) return;

      task.inflight.delete(off);
      task.inflightTimestamps.delete(off);

      if (!task.parts.has(off)) {
        task.parts.set(off, safeBody);
        log(`RECV ← off=${off} size=${safeBody.byteLength}`);
        statBump('recv');
      }

      // feed SW
      try { this.core.stream && this.core.stream.processSwQueue(task); } catch (_) {}

      // feed MSE
      if (this.core.activePlayer && this.core.activePlayer.fileId === fid) {
        try { this.core.activePlayer.appendChunk(safeBody, off); } catch (_) {}
      }

      // strict completion
      const expectedChunks = Math.ceil(task.size / CHUNK_SIZE);
      if (!task.completed) {
        let haveAll = true;
        let totalBytes = 0;

        for (let i = 0; i < expectedChunks; i++) {
          const oo = i * CHUNK_SIZE;
          const d = task.parts.get(oo);
          if (!d) { haveAll = false; break; }
          totalBytes += d.byteLength;
        }

        if (haveAll && totalBytes === task.size) {
          task.completed = true;
          log('✅ 下载完成 (严格块校验通过)');

          const chunks = [];
          for (let i = 0; i < expectedChunks; i++) chunks.push(task.parts.get(i * CHUNK_SIZE));

          const blob = new Blob(chunks, { type: task.fileType || 'application/octet-stream' });
          window.virtualFiles.set(task.fileId, blob);

          if (this.core.activePlayer && this.core.activePlayer.fileId === task.fileId) {
            try { this.core.activePlayer.flush(); } catch (_) {}
          }

          if (task.swRequests.size > 0) {
            log(`🟡 下载已完成，但仍有 ${task.swRequests.size} 个 SW 流未结束，继续供流后再清理`);
          } else {
            this.cleanupTask(task.fileId);
          }
          return;
        }
      }

      this.requestNextChunk(task);
    } catch (e) {}
  }

  handleGetChunk(pkt, fromId) {
    const file = window.virtualFiles.get(pkt.fileId);
    if (!file) return;

    const offset = toNum(pkt.offset);
    let size = toNum(pkt.size);
    if (!Number.isFinite(offset) || offset < 0) return;
    if (!Number.isFinite(size) || size <= 0) size = CHUNK_SIZE;
    if (offset >= file.size) return;
    size = Math.min(size, file.size - offset);

    const reader = new FileReader();

    reader.onload = () => {
      if (!reader.result) return;
      try {
        const buffer = reader.result;
        const header = JSON.stringify({ fileId: pkt.fileId, reqId: pkt.reqId, offset });
        const headerBytes = new TextEncoder().encode(header);

        const packet = new Uint8Array(1 + headerBytes.byteLength + buffer.byteLength);
        packet[0] = headerBytes.byteLength;
        packet.set(headerBytes, 1);
        packet.set(new Uint8Array(buffer), 1 + headerBytes.byteLength);

        const conn = window.state && window.state.conns && window.state.conns[fromId];
        if (conn && conn.open) this.sendSafe(conn, packet);
      } catch (e) {
        log('❌ 发送组包异常: ' + e);
      }
    };

    reader.onerror = () => {
      log(`❌ 发送端读取失败 (Offset ${offset}): ${reader.error}`);
    };

    try {
      const blob = file.slice(offset, offset + size);
      reader.readAsArrayBuffer(blob);
    } catch (e) {
      log('❌ 发送端 Slice 异常: ' + e);
    }
  }

  sendSafe(conn, packet) {
    const dc = conn.dataChannel || conn._dc;

    if (this.SEND_QUEUE.length > 200) {
      this.SEND_QUEUE.shift();
    }

    if (dc && dc.bufferedAmount > MAX_BUFFERED) {
      this.SEND_QUEUE.push({ conn, packet });
      return;
    }

    try {
      conn.send(packet);
      statBump('send');
    } catch (e) {
      this.SEND_QUEUE.push({ conn, packet });
    }
  }

  flushSendQueue() {
    if (this.SEND_QUEUE.length === 0) return;

    let processCount = 8;
    const fails = [];

    while (this.SEND_QUEUE.length > 0 && processCount > 0) {
      const item = this.SEND_QUEUE.shift();
      if (!item.conn || item.conn.readyState === 'closed' || !item.conn.open) continue;

      const dc = item.conn.dataChannel || item.conn._dc;
      if (dc && dc.bufferedAmount > MAX_BUFFERED) {
        fails.push(item);
      } else {
        try {
          item.conn.send(item.packet);
          statBump('send');
          processCount--;
        } catch (e) {
          fails.push(item);
        }
      }
    }

    if (fails.length > 0) this.SEND_QUEUE.unshift(...fails);
  }

  checkTimeouts() {
    const now = Date.now();
    this.activeTasks.forEach(task => {
      if (task.completed) return;

      task.inflightTimestamps.forEach((ts, offset) => {
        if (now - ts > 3000) {
          task.inflight.delete(offset);
          task.inflightTimestamps.delete(offset);
          task.wantQueue.unshift(offset);
          log(`⏱️ 超时重试 off=${offset}`);
        }
      });

      // wantQueue 非空但暂时没有可用连接时，每秒尝试一次 dispatch（连接恢复后即可继续请求）
      if (task.inflight.size === 0 && task.wantQueue.length > 0 && !task.completed) {
        this.dispatchRequests(task);
      }

      if (task.inflight.size === 0 && task.wantQueue.length === 0 && !task.completed) {
        this.requestNextChunk(task);
      }
    });
  }

  cleanupTask(fileId) {
    const task = this.activeTasks.get(fileId);
    if (!task) return;

    if (task.swRequests.size === 0) {
      try { task.parts.clear(); } catch (e) {}
      this.activeTasks.delete(fileId);
      log(`🧽 任务清理完成: ${fileId}`);
    } else {
      setTimeout(() => this.cleanupTask(fileId), 1000);
    }
  }
}
