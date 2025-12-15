// P2PVideoPlayer (MP4Box + MSE)

import { USE_SEQUENCE_MODE } from './config.js';
import { log } from './logger.js';

export class P2PVideoPlayer {
  constructor(fileId) {
    this.fileId = fileId;
    this.mediaSource = new MediaSource();
    this.url = URL.createObjectURL(this.mediaSource);

    if (typeof MP4Box === 'undefined') {
      log('⚠️ MP4Box 未加载，无法使用 MSE 播放器');
      return;
    }

    this.mp4box = MP4Box.createFile();
    this.sourceBuffers = {};
    this.queues = {};
    this.info = null;

    this.wantEOS = false;
    this.ended = false;
    this.trackLast = {};

    this.mp4box.onReady = (info) => {
      try {
        this.info = info;
        const vts = info.videoTracks || [];
        const ats = info.audioTracks || [];
        const tracks = [...vts, ...ats];
        if (!tracks.length) return;

        if (info.duration && info.timescale) {
          try { this.mediaSource.duration = info.duration / info.timescale; } catch (e) {}
        }

        log(`🧠 MP4Ready: dur=${(info.duration / info.timescale).toFixed(2)}s v=${vts.length} a=${ats.length}`);
        
        tracks.forEach(t => {
          this.mp4box.setSegmentOptions(t.id, null, { nbSamples: 20, rapAlignment: true });
        });

        const inits = this.mp4box.initializeSegmentation();
        if (inits && inits.length) {
          inits.forEach(seg => {
            if (!this.queues[seg.id]) this.queues[seg.id] = [];
            this.queues[seg.id].push(seg.buffer);
          });
        }

        this.mp4box.start();

        if (this.mediaSource.readyState === 'open') this.ensureSourceBuffers(tracks);
        this.drain();
        this.logBuffered();
        this.maybeCloseIfDone();
      } catch (e) { log('❌ onReady异常: ' + e.message); }
    };

    this.mp4box.onSegment = (id, user, buf, sampleNum, last) => {
      if (!this.queues[id]) this.queues[id] = [];
      this.queues[id].push(buf);
      if (last) this.trackLast[id] = true;
      this.drain();
      this.logBuffered();
      this.maybeCloseIfDone();
    };

    this.mediaSource.addEventListener('sourceopen', () => {
      const tracks = (this.info ? [...(this.info.videoTracks || []), ...(this.info.audioTracks || [])] : []);
      this.ensureSourceBuffers(tracks);
      this.drain();
      this.logBuffered();
      this.maybeCloseIfDone();
    });
  }

  ensureSourceBuffers(tracks) {
    if (!tracks || !tracks.length) return;
    tracks.forEach(t => {
      if (this.sourceBuffers[t.id]) return;
      const isVideo = (this.info.videoTracks || []).some(v => v.id === t.id);
      const mime = (isVideo ? 'video/mp4' : 'audio/mp4') + `; codecs="${t.codec}"`;
      if (window.MediaSource && MediaSource.isTypeSupported && !MediaSource.isTypeSupported(mime)) return;

      try {
        const sb = this.mediaSource.addSourceBuffer(mime);
        if (USE_SEQUENCE_MODE) {
          try { sb.mode = 'sequence'; sb.timestampOffset = 0; } catch (_) {}
        }
        sb.addEventListener('updateend', () => { this.drain(); this.logBuffered(); this.maybeCloseIfDone(); });
        this.sourceBuffers[t.id] = sb;
        if (!this.queues[t.id]) this.queues[t.id] = [];
      } catch(e) { log('❌ addSourceBuffer error: ' + e); }
    });
  }

  drain() {
    try {
      Object.keys(this.sourceBuffers).forEach(id => {
        const sb = this.sourceBuffers[id];
        const q = this.queues[id];
        let loopGuard = 0;
        
        while (sb && !sb.updating && q && q.length) {
          if (loopGuard++ > 10) break; // 防止异常情况下死循环

          const seg = q[0]; // peek
          try {
            sb.appendBuffer(seg);
            q.shift(); // remove only on success
          } catch (e) {
            if (e && e.name === 'QuotaExceededError') {
              log('🧱 MSE QuotaExceededError，开始清理旧缓冲区...');
              this.evictOldBuffered();
              // 如果清理失败，暂时停止写入，等待下一次 updateend 或时间
              break; 
            } else {
              log('❌ appendBuffer error: ' + e);
              q.shift(); // 丢弃错误块防止阻塞
            }
          }
        }
      });
    } catch (e) { log('❌ drain异常: ' + e); }
  }

  evictOldBuffered() {
    const video = window.smartCore && window.smartCore._videos && window.smartCore._videos[this.fileId];
    const cur = video ? (video.currentTime || 0) : 0;
    const KEEP_BACK = 10; // 收紧缓冲策略
    const KEEP_AHEAD = 60;

    Object.values(this.sourceBuffers).forEach(sb => {
      try {
        if (!sb || !sb.buffered || sb.buffered.length === 0 || sb.updating) return;
        const start = sb.buffered.start(0);
        const end = sb.buffered.end(sb.buffered.length - 1);
        
        // 只有当播放进度已经远离开始点时才清理
        if (cur > start + KEEP_BACK + 5) {
             const removeEnd = cur - KEEP_BACK;
             if (removeEnd > start) {
                sb.remove(start, removeEnd);
                log(`🧹 清理缓冲: [${start.toFixed(1)}, ${removeEnd.toFixed(1)}]`);
             }
        }
      } catch (e) {}
    });
  }

  logBuffered() {
    // 降低日志频率，这里留空或简化
  }

  maybeCloseIfDone() {
    if (this.ended || !this.wantEOS) return;
    if (this.mediaSource.readyState !== 'open') return;

    if (Object.values(this.sourceBuffers).some(sb => sb.updating)) return;
    if (!Object.values(this.queues).every(q => !q || q.length === 0)) return;

    let allLast = true;
    if (this.info) {
      const ids = [...(this.info.videoTracks || []), ...(this.info.audioTracks || [])].map(t => t.id);
      if (ids.length) allLast = ids.every(id => this.trackLast[id]);
    }

    if (!allLast) {
      setTimeout(() => this.maybeCloseIfDone(), 50);
      return;
    }

    try { this.mediaSource.endOfStream(); } catch (e) {}
    this.ended = true;
    log('🎬 MSE EndOfStream called');
  }

  getUrl() { return this.url; }

  appendChunk(buf, offset) {
    if (!this.mp4box) return;
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const ab = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
    try { Object.defineProperty(ab, 'fileStart', { value: offset }); } catch (_) { ab.fileStart = offset; }
    try { this.mp4box.appendBuffer(ab); } catch (e) {}
  }

  flush() {
    this.wantEOS = true;
    try { if(this.mp4box) this.mp4box.flush(); } catch (e) {}
    setTimeout(() => this.maybeCloseIfDone(), 0);
  }

  seek(seconds) {
    try { return this.mp4box ? this.mp4box.seek(seconds, true) : null; } catch (e) { return null; }
  }

  destroy() { try { URL.revokeObjectURL(this.url); } catch (e) {} }
}
