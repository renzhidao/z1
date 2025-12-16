import { CHAT } from './constants.js';
import { log, fmtMB } from './smart-core/logger.js';
import { bindMoreVideoLogs, guessMime } from './smart-core/utils.js';
import { MetaManager } from './smart-core/meta.js';
import { TaskManager } from './smart-core/task.js';
import { StreamManager } from './smart-core/stream.js';
import { P2PVideoPlayer } from './smart-core/player.js';
import { CHUNK_SIZE } from './smart-core/config.js';

// SmartCore facade: supports both legacy hook mode and pure API mode.

class SmartCore {
  constructor() {
    this.mode = null; // FIXED: Initialize as null to ensure setMode works on init

    // shared state maps
    window.virtualFiles = window.virtualFiles || new Map();

    this.meta = new MetaManager(() => window.state);
    this.tasks = new TaskManager(this);
    this.stream = new StreamManager(this);

    // expose maps to keep legacy code working
    window.smartMetaCache = this.tasks.smartMetaCache;
    window.remoteFiles = this.tasks.remoteFiles;
    window.activeTasks = this.tasks.activeTasks;
    window.pendingMeta = this.meta.pendingMeta;

    this._videos = {};
    this.activePlayer = null;

    // legacy aliases
    this.handleBinary = (data, fromId) => this.onBinary(data, fromId);

    // hook bookkeeping
    this._hooksInstalled = false;
    this._origSendMsg = null;
    this._origProcIncoming = null;
    this._swListener = null;
  }

  setMode(mode) {
    if (mode !== 'hook' && mode !== 'api') return;
    if (this.mode === mode && this._hooksInstalled) return; // FIXED: Logic check
    this.mode = mode;

    if (mode === 'hook') this.installHooks();
    else this.uninstallHooks();

    log(`🔄 SmartCore mode = ${this.mode}`);
  }

  // -----------------
  // Pure API
  // -----------------

  registerLocalFile(file, fileId = null) {
    const id = fileId || ('f_' + Date.now() + Math.random().toString(36).slice(2, 7));
    window.virtualFiles.set(id, file);
    log(`✅ 文件注册: ${file.name} (${fmtMB(file.size)}) type=${file.type}`);
    return id;
  }

  // one-call API for sending a file: register + local show + reliable meta
  sendFile(file, targetId = null, { kind = 'SMART_FILE_UI', txt = null, showLocal = true } = {}) {
    const fileId = this.registerLocalFile(file);
    const metaData = { fileId, fileName: file.name, fileSize: file.size, fileType: file.type };

    const target = targetId || ((window.state && window.state.activeChat && window.state.activeChat !== CHAT.PUBLIC_ID)
      ? window.state.activeChat
      : CHAT.PUBLIC_ID);

    const msg = {
      t: 'SMART_META',
      id: 'm_' + Date.now(),
      ts: Date.now(),
      senderId: window.state && window.state.myId,
      n: window.state && window.state.myName,
      kind,
      // 修复：如果是 voice，保留 txt (时长)，否则用文件名
      txt: txt || (kind === 'voice' ? null : `[文件] ${file.name}`),
      meta: metaData,
      target
    };

    if (showLocal) {
      // let protocol/ui render (if available)
      try {
        if (window.protocol && typeof window.protocol.processIncoming === 'function') {
          window.protocol.processIncoming(msg);
        } else if (window.ui && typeof window.ui.appendMsg === 'function') {
          window.ui.appendMsg(msg);
        }
      } catch (_) { }
    }

    this.meta.sendReliable(msg);
    return { fileId, msg };
  }

  onPacket(pkt, fromPeerId) {
    if (!pkt || !pkt.t) return false;

    if (pkt.t === 'SMART_META') {
      const seen = window.state && window.state.seenMsgs && window.state.seenMsgs.has(pkt.id);

      if (!seen) {
        try { window.state && window.state.seenMsgs && window.state.seenMsgs.add(pkt.id); } catch (_) { }

        log(`📥 Meta: ${pkt.meta && pkt.meta.fileName} (${fmtMB((pkt.meta && pkt.meta.fileSize) || 0)}) from=${pkt.senderId}`);

        const meta = { ...(pkt.meta || {}), senderId: pkt.senderId };
        this.tasks.smartMetaCache.set(meta.fileId, meta);

        if (!this.tasks.remoteFiles.has(meta.fileId)) this.tasks.remoteFiles.set(meta.fileId, new Set());
        this.tasks.remoteFiles.get(meta.fileId).add(pkt.senderId);

        try { if (window.ui && window.ui.appendMsg) window.ui.appendMsg(pkt); } catch (_) { }
      }

      // ACK
      const pid = fromPeerId || pkt.senderId;
      const c = window.state && window.state.conns && window.state.conns[pid];
      if (c && c.open) {
        try { c.send({ t: 'SMART_META_ACK', refId: pkt.id, from: window.state.myId }); } catch (_) { }
      }
      return true;
    }

    if (pkt.t === 'SMART_META_ACK') {
      this.meta.handleAck(pkt, fromPeerId);
      return true;
    }

    if (pkt.t === 'SMART_GET' || pkt.t === 'SMART_GET_CHUNK') {
      this.tasks.handleGetChunk(pkt, fromPeerId);
      return true;
    }

    return false;
  }

  onBinary(data, fromPeerId) {
    this.tasks.handleBinaryData(data, fromPeerId);
  }

  onSwMessage(event) {
    const data = event && event.data;
    if (!data) return;

    if (data.type === 'PING') log('✅ SW 握手成功 (Core)');
    if (data.type === 'STREAM_OPEN') this.stream.handleStreamOpen(data, event.source);
    if (data.type === 'STREAM_CANCEL') this.stream.handleStreamCancel(data);
  }

  play(fileId, name = '') {
    const meta = this.tasks.smartMetaCache.get(fileId) || {};
    const fileName = name || meta.fileName || '';
    const fileType = meta.fileType || '';
    const fileSize = meta.fileSize || 0;

    // 1. 本地 Blob 优先 (最快，最稳)
    if (window.virtualFiles.has(fileId)) {
      const url = URL.createObjectURL(window.virtualFiles.get(fileId));
      // log(`▶️ 本地Blob播放 ${fileName} (${fmtMB(fileSize)}) type=${fileType}`);
      return url;
    }

    const hasSW = navigator.serviceWorker && navigator.serviceWorker.controller;
    const isVideo = /\.(mp4|mov|m4v)$/i.test(fileName) || /video\//.test(fileType);

    // 2. 远程文件：仅做“主动连接”尝试
    // [关键修复] 不在 play() 里强行 startDownloadTask；下载应由 SW 的 STREAM_OPEN 触发（更稳，避免 SW 未 ready / 连接抖动导致卡死）
    const conns = window.state && window.state.conns;
    if (meta.senderId && window.p2p && conns && (!conns[meta.senderId] || !conns[meta.senderId].open)) {
      log(` play() 触发主动连接 -> ${meta.senderId}`);
      try {
        window.p2p.connectTo(meta.senderId);
      } catch (_) { }
    }

    // 3. MSE 降级模式 (针对无 SW 环境或特定视频)
    if (!hasSW && isVideo) {
      log(`🎥 播放路径 = MSE + MP4Box (无SW降级) | ${fileName}`);

      // 无 SW 时必须由任务拉取数据
      try { this.tasks.startDownloadTask(fileId); } catch (_) { }

      if (this.activePlayer) {
        try { this.activePlayer.destroy(); } catch (_) { }
      }

      this.activePlayer = new P2PVideoPlayer(fileId);

      const task = this.tasks.activeTasks.get(fileId);
      if (task) {
        const offsets = Array.from(task.parts.keys()).sort((a, b) => a - b);
        for (const off of offsets) {
          try { this.activePlayer.appendChunk(task.parts.get(off), off); } catch (_) { }
        }
      }

      this.autoBindVideo(fileId);
      setTimeout(() => {
        const v = document.querySelector && document.querySelector('video');
        if (v) { this.bindVideo(v, fileId); }
      }, 300);

      return this.activePlayer.getUrl();
    }

    // 4. 标准 SW 直链（SW 会触发 STREAM_OPEN -> 才启动下载/调度）
    // log(` 播放路径 = SW直链 | ${fileName}`);
    const vUrl = `./virtual/file/${fileId}/${encodeURIComponent(fileName)}`;

    if (isVideo) {
      setTimeout(() => {
        const v = document.querySelector && document.querySelector('video');
        if (v) { this.bindVideo(v, fileId); }
      }, 300);
    }

    return vUrl;
  }

  download(fileId, name = '') {
    const meta = this.tasks.smartMetaCache.get(fileId) || {};
    const fileName = name || meta.fileName || 'file';

    if (window.virtualFiles.has(fileId)) {
      const data = window.virtualFiles.get(fileId);
      if (window.ui && window.ui.downloadBlob) {
        window.ui.downloadBlob(data, fileName);
        return;
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(data);
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    // remote: use SW virtual URL; do NOT force startDownloadTask here (由 SW 的 STREAM_OPEN 触发更稳)
    const url = `./virtual/file/${fileId}/${encodeURIComponent(fileName)}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  bindVideo(video, fileId) {
    if (!video || video._p2pBound) return;

    try {
      video.controls = true;
      video.playsInline = true;
      video._p2pBound = true;
      this._videos[fileId] = video;

      video.addEventListener('loadedmetadata', () => {
        try { if (video.currentTime === 0) video.currentTime = 0.05; } catch (_) { }
      });

      video.addEventListener('seeking', () => {
        const t = isNaN(video.currentTime) ? 0 : video.currentTime;
        this.seek(fileId, t);
      });

      bindMoreVideoLogs(video, fileId);
    } catch (_) { }
  }

  autoBindVideo(fileId) {
    setTimeout(() => {
      const v = document.querySelector && document.querySelector('video');
      if (v) {
        if (!v.controls) v.controls = true;
        this.bindVideo(v, fileId);
      }
    }, 500);
  }

  seek(fileId, seconds) {
    if (this.activePlayer && this.activePlayer.fileId === fileId) {
      const res = this.activePlayer.seek(seconds);
      if (res && typeof res.offset === 'number') {
        const task = this.tasks.activeTasks.get(fileId);
        if (task) {
          const off = Math.floor(res.offset / CHUNK_SIZE) * CHUNK_SIZE;
          log(`⏩ MSE Seek -> ${off}`);
          task.nextOffset = off;
          task.wantQueue = [];
          task.inflight.clear();
          task.inflightTimestamps.clear();
          task.lastWanted = off - CHUNK_SIZE;
          this.tasks.requestNextChunk(task);
        }
      }
    }
  }

  runDiag() {
    log(`Tasks: ${this.tasks.activeTasks.size}`);
  }

  onPeerConnect(pid) {
    // reserved for future optimization
  }

  // -----------------
  // Legacy hooks
  // -----------------

  installHooks() {
    if (this._hooksInstalled) return;
    this._hooksInstalled = true;

    // SW listener (removable)
    if (navigator.serviceWorker) {
      this._swListener = (e) => this.onSwMessage(e);
      navigator.serviceWorker.addEventListener('message', this._swListener);
    }

    // protocol hook
    if (window.protocol) {
      const self = this;
      this._origSendMsg = window.protocol.sendMsg;
      this._origProcIncoming = window.protocol.processIncoming;

      window.protocol.sendMsg = function (txt, kind, meta) {
        // [修复] 增加对 'voice' 的拦截，并确保 'txt' (时长) 能透传
        if ((kind === CHAT.KIND_FILE || kind === CHAT.KIND_IMAGE || kind === 'voice') && meta && meta.fileObj) {
          const file = meta.fileObj;
          const target = (window.state && window.state.activeChat && window.state.activeChat !== CHAT.PUBLIC_ID)
            ? window.state.activeChat
            : CHAT.PUBLIC_ID;

          // [修复] 透传 kind 和 txt 参数
          const { msg } = self.sendFile(file, target, {
            showLocal: false,
            kind: kind,
            txt: txt // 语音时长/文本描述会在这里透传
          });

          // 本地立即显示（复用原流程）
          try { window.protocol.processIncoming(msg); } catch (_) { }

          return;
        }
        return self._origSendMsg.apply(this, arguments);
      };

      window.protocol.processIncoming = function (pkt, fromPeerId) {
        // handle SMART_* before protocol does id checks
        if (pkt && pkt.t && String(pkt.t).startsWith('SMART_')) {
          if (self.onPacket(pkt, fromPeerId)) return;
        }
        return self._origProcIncoming.apply(this, arguments);
      };
    }
  }

  uninstallHooks() {
    if (!this._hooksInstalled) return;
    this._hooksInstalled = false;

    // restore protocol
    if (window.protocol && this._origSendMsg) {
      window.protocol.sendMsg = this._origSendMsg;
      window.protocol.processIncoming = this._origProcIncoming;
    }

    // remove SW listener
    if (navigator.serviceWorker && this._swListener) {
      try { navigator.serviceWorker.removeEventListener('message', this._swListener); } catch (_) { }
      this._swListener = null;
    }
  }
}

let _instance = null;

export function getSmartCore() {
  if (_instance) return _instance;
  _instance = new SmartCore();
  return _instance;
}

export function init({ mode = 'hook' } = {}) {
  const sc = getSmartCore();
  window.smartCore = sc;
  sc.setMode(mode);
  return sc;
}
