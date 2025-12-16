// ServiceWorker virtual stream support

import { CHUNK_SIZE, PREFETCH_AHEAD } from './config.js';
import { log } from './logger.js';

export class StreamManager {
  constructor(core) {
    this.core = core;
  }

  handleStreamOpen(data, source) {
    const { requestId, fileId, range } = data || {};

    if (!requestId || !fileId) return;

    if (window.virtualFiles && window.virtualFiles.has(fileId)) {
      this.serveLocalBlob(fileId, requestId, range, source);
      return;
    }

    let task = this.core.tasks.activeTasks.get(fileId);
    if (!task) {
      this.core.tasks.startDownloadTask(fileId);
      task = this.core.tasks.activeTasks.get(fileId);
    }

    if (!task) {
      try { source.postMessage({ type: 'STREAM_ERROR', requestId, msg: 'Task Start Failed' }); } catch (_) {}
      return;
    }

    let start = 0;
    let end = task.size - 1;

    // Range parse (bytes=start-end / bytes=start- / bytes=-suffix)
    if (range && /^bytes=/.test(range)) {
      const mm = range.match(/^bytes=(\d*)-(\d*)$/);
      if (mm) {
        const a = mm[1];
        const b = mm[2];
        if (a === '' && b !== '') {
          const suffix = parseInt(b, 10);
          if (!isNaN(suffix) && suffix > 0) {
            start = Math.max(0, task.size - suffix);
            end = task.size - 1;
          }
        } else {
          const ss = parseInt(a, 10);
          if (!isNaN(ss)) start = ss;
          if (b !== '') {
            const ee = parseInt(b, 10);
            if (!isNaN(ee)) end = Math.min(ee, task.size - 1);
          }
        }
      }
    }

    if (start < 0) start = 0;
    if (end >= task.size) end = task.size - 1;
    if (end < start) end = start;

    log(`📡 SW OPEN ${requestId}: file=${fileId} hdr=${range || ''} -> ${start}-${end} (${(end - start + 1)} bytes)`);

    try {
      source.postMessage({
        type: 'STREAM_META',
        requestId,
        fileId,
        fileSize: task.size,
        fileType: task.fileType || 'application/octet-stream',
        start,
        end
      });
    } catch (_) {}

    task.swRequests.set(requestId, { start, end, current: start, source });

    const reqChunkIndex = Math.floor(start / CHUNK_SIZE) * CHUNK_SIZE;

    try {
      log(`🧷 SW REQ ${requestId}: cur=${start} end=${end} reqChunk=${reqChunkIndex} inflight=${task.inflight.size} q=${task.wantQueue.length}`);
    } catch (_) {}

    // small file prefetch / seek reset
    if (task.size < 2 * 1024 * 1024) {
      for (let off = Math.floor((task.size - 1) / CHUNK_SIZE) * CHUNK_SIZE; off >= 0; off -= CHUNK_SIZE) {
        if (!task.parts.has(off) && !task.wantQueue.includes(off) && !task.inflight.has(off)) {
          task.wantQueue.unshift(off);
        }
      }
    } else if (Math.abs(task.nextOffset - start) > CHUNK_SIZE * 2) {
      log(`⏩ SW Seek -> ${start}`);
      task.nextOffset = reqChunkIndex;
      task.wantQueue = [];
      task.inflight.clear();
      task.inflightTimestamps.clear();
      task.lastWanted = reqChunkIndex - CHUNK_SIZE;
    }

    // [稳定性修复] 把当前 Range 所在 chunk 置顶，避免队列被其它探测/预取挤占导致卡住
    try {
      const must = [reqChunkIndex, reqChunkIndex + CHUNK_SIZE, reqChunkIndex + 2 * CHUNK_SIZE];
      for (let i = must.length - 1; i >= 0; i--) {
        const off = must[i];
        if (off < 0 || off >= task.size) continue;
        if (task.parts.has(off) || task.inflight.has(off)) continue;
        const idx = task.wantQueue.indexOf(off);
        if (idx >= 0) task.wantQueue.splice(idx, 1);
        task.wantQueue.unshift(off);
      }
    } catch (_) {}

    // 图片：强制将调度对齐至当前 Range 起点，避免被其它预取挤占
    try {
      if (task.isImage) {
        log(`🖼️ SW Img Align -> ${reqChunkIndex}`);
        task.nextOffset = reqChunkIndex;
        // 保留近端优先区间
        const maxKeep = Math.max(PREFETCH_AHEAD / CHUNK_SIZE, 32);
        task.wantQueue = task.wantQueue.filter(off => (off >= reqChunkIndex && off < reqChunkIndex + PREFETCH_AHEAD)).slice(0, maxKeep);
      }
    } catch (_) {}

    this.processSwQueue(task);
    this.core.tasks.requestNextChunk(task);
  }

  handleStreamCancel(data) {
    const { requestId } = data || {};
    if (!requestId) return;

    let hit = 0;
    this.core.tasks.activeTasks.forEach(t => {
      try { if (t.swRequests && t.swRequests.has(requestId)) hit++; } catch (_) {}
      t.swRequests.delete(requestId);
      if (t.completed) this.core.tasks.cleanupTask(t.fileId);
    });

    try { log(`🛑 SW CANCEL ${requestId} hitTasks=${hit}`); } catch (_) {}
  }

  processSwQueue(task) {
    if (!task || task.swRequests.size === 0) return;

    task.swRequests.forEach((req, reqId) => {
      let sentBytes = 0;

      while (req.current <= req.end) {
        const chunkOffset = Math.floor(req.current / CHUNK_SIZE) * CHUNK_SIZE;
        const insideOffset = req.current % CHUNK_SIZE;
        const chunkData = task.parts.get(chunkOffset);

        if (chunkData) {
          const available = chunkData.byteLength - insideOffset;
          const needed = req.end - req.current + 1;
          const sendLen = Math.min(available, needed);
          const slice = chunkData.slice(insideOffset, insideOffset + sendLen);

          try {
            req.source.postMessage({ type: 'STREAM_DATA', requestId: reqId, chunk: slice.buffer }, [slice.buffer]);
          } catch (_) {}

          req.current += sendLen;
          sentBytes += sendLen;

          if (sentBytes >= 2 * 1024 * 1024) {
            log(`📤 SW ${reqId} -> +${sentBytes} bytes (cur=${req.current})`);
            sentBytes = 0;
          }

          if (req.current > req.end) {
            try { req.source.postMessage({ type: 'STREAM_END', requestId: reqId }); } catch (_) {}
            task.swRequests.delete(reqId);
            log(`🏁 SW END ${reqId}`);
            if (task.completed) this.core.tasks.cleanupTask(task.fileId);
            break;
          }
        } else {
          // 缺块：把当前 chunk 顶到最高优先级，并尝试立刻发起请求（避免只等下次调度）
          try {
            log(`⏳ SW WAIT ${reqId}: needChunk=${chunkOffset} cur=${req.current} end=${req.end} inflight=${task.inflight.has(chunkOffset)} q=${task.wantQueue.length}`);
          } catch (_) {}
          try {
            if (!task.parts.has(chunkOffset) && !task.inflight.has(chunkOffset)) {
              const idx = task.wantQueue.indexOf(chunkOffset);
              if (idx >= 0) task.wantQueue.splice(idx, 1);
              task.wantQueue.unshift(chunkOffset);
            }
            if (this.core && this.core.tasks && typeof this.core.tasks.dispatchRequests === 'function') {
              this.core.tasks.dispatchRequests(task);
            }
          } catch (_) {}
          break;
        }
      }
    });
  }

  serveLocalBlob(fileId, requestId, range, source) {
    const blob = window.virtualFiles.get(fileId);
    if (!blob) return;

    let start = 0;
    let end = blob.size - 1;

    if (range && /^bytes=/.test(range)) {
      const mm = range.match(/^bytes=(\d*)-(\d*)$/);
      if (mm) {
        const a = mm[1];
        const b = mm[2];
        if (a === '' && b !== '') {
          const suffix = parseInt(b, 10);
          if (!isNaN(suffix) && suffix > 0) {
            start = Math.max(0, blob.size - suffix);
            end = blob.size - 1;
          }
        } else {
          const ss = parseInt(a, 10);
          if (!isNaN(ss)) start = ss;
          if (b !== '') {
            const ee = parseInt(b, 10);
            if (!isNaN(ee)) end = Math.min(ee, blob.size - 1);
          }
        }
      }
    }

    if (start < 0) start = 0;
    if (end >= blob.size) end = blob.size - 1;
    if (end < start) end = start;

    try {
      source.postMessage({
        type: 'STREAM_META',
        requestId,
        fileId,
        fileSize: blob.size,
        fileType: blob.type,
        start,
        end
      });
    } catch (_) {}

    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result;
      try { source.postMessage({ type: 'STREAM_DATA', requestId, chunk: buffer }, [buffer]); } catch (_) {}
      try { source.postMessage({ type: 'STREAM_END', requestId }); } catch (_) {}
      log(`📤 SW 本地Blob响应完成 ${requestId} bytes=${end - start + 1}`);
    };
    reader.readAsArrayBuffer(blob.slice(start, end + 1));
  }
}
