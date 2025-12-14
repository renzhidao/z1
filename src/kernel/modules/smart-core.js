
import { MSG_TYPE, CHAT } from './constants.js';

// === Smart Core (Production Final) ===
// 1. SW 流式驱动 + 256KB Chunk + 24 Parallel + Backpressure
// 2. 逻辑修复：移除 GC 以确保文件完整保存
// 3. 逻辑修复：Seek 强制更新指针，确保预读跟手
// 4. 逻辑修复：本地缓存优先命中

function log(msg) {
    console.log(`[Core] ${msg}`);
    if (window.util) window.util.log(msg);
}

const STAT = { send:0, req:0, recv:0, next:0 };
function statBump(k) {
    STAT[k]++;
    const now = Date.now();
    if (now > STAT.next) {
        log(`📊 速率: req=${STAT.req} send=${STAT.send} recv=${STAT.recv} (≈0.7s)`);
        STAT.send = STAT.req = STAT.recv = 0;
        STAT.next = now + 700;
    }
}

// === 配置参数 ===
const CHUNK_SIZE = 256 * 1024; 
const PARALLEL = 24;           
const PREFETCH_AHEAD = 5 * 1024 * 1024; 

// === 背压参数 ===
const MAX_BUFFERED = 1 * 1024 * 1024; 
const SEND_QUEUE = []; 

export function init() {
  window.virtualFiles = new Map();
  window.smartMetaCache = new Map();
  window.remoteFiles = new Map();
  window.activeTasks = new Map();

  if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', event => {
          const data = event.data;
          if (!data) return;
          if (data.type === 'PING') log('✅ SW 握手成功 (Core)');
          if (data.type === 'STREAM_OPEN') handleStreamOpen(data, event.source);
          if (data.type === 'STREAM_CANCEL') handleStreamCancel(data);
      });
  }

  if (window.protocol) {
      const origSend = window.protocol.sendMsg;
      window.protocol.sendMsg = function(txt, kind, meta) {
          if ((kind === CHAT.KIND_FILE || kind === CHAT.KIND_IMAGE) && meta && meta.fileObj) {
              const file = meta.fileObj;
              const fileId = 'f_' + Date.now() + Math.random().toString(36).substr(2,5);
              window.virtualFiles.set(fileId, file);
              log(`✅ 文件注册: ${file.name}`);
              
              const metaData = { fileId, fileName: file.name, fileSize: file.size, fileType: file.type };
              const msg = {
                  t: 'SMART_META', id: 'm_' + Date.now(), ts: Date.now(), senderId: window.state.myId,
                  n: window.state.myName, kind: 'SMART_FILE_UI', txt: `[文件] ${file.name}`, meta: metaData,
                  target: (window.state.activeChat && window.state.activeChat !== CHAT.PUBLIC_ID) ? window.state.activeChat : CHAT.PUBLIC_ID
              };
              
              window.protocol.processIncoming(msg);
              if (msg.target === CHAT.PUBLIC_ID) window.protocol.flood(msg, null);
              else { const c = window.state.conns[msg.target]; if(c && c.open) c.send(msg); }
              return;
          }
          origSend.apply(this, arguments);
      };

      const origProc = window.protocol.processIncoming;
      window.protocol.processIncoming = function(pkt, fromPeerId) {
          if (pkt.t === 'SMART_META') {
              if (window.state.seenMsgs.has(pkt.id)) return;
              window.state.seenMsgs.add(pkt.id);
              log(`📥 Meta: ${pkt.meta.fileName}`);
              const meta = { ...pkt.meta, senderId: pkt.senderId };
              window.smartMetaCache.set(meta.fileId, meta);
              if(!window.remoteFiles.has(meta.fileId)) window.remoteFiles.set(meta.fileId, new Set());
              window.remoteFiles.get(meta.fileId).add(pkt.senderId);
              if (window.ui) window.ui.appendMsg(pkt);
              return;
          }
          if (pkt.t === 'SMART_GET_CHUNK') {
              handleGetChunk(pkt, fromPeerId);
              return;
          }
          origProc.apply(this, arguments);
      };
  }

  window.smartCore = {
      handleBinary: (data, fromId) => handleBinaryData(data, fromId),
      play: (fileId, name) => {
          if (window.virtualFiles.has(fileId)) return URL.createObjectURL(window.virtualFiles.get(fileId));
          startDownloadTask(fileId); 
          return `./virtual/file/${fileId}/${encodeURIComponent(name)}`;
      },
      download: (fileId, name) => {
          if (window.virtualFiles.has(fileId)) {
              const a = document.createElement('a'); a.href = URL.createObjectURL(window.virtualFiles.get(fileId)); 
              a.download = name; a.click();
          } else {
              startDownloadTask(fileId);
              log('⏳ 后台下载中...');
          }
      },
      runDiag: () => {
          log(`Tasks: ${window.activeTasks.size}, SendQ: ${SEND_QUEUE.length}`);
      }
  };

  setInterval(checkTimeouts, 1000);
  setInterval(flushSendQueue, 100);
}

function checkTimeouts() {
    const now = Date.now();
    window.activeTasks.forEach(task => {
        if (task.completed) return;
        task.inflightTimestamps.forEach((ts, offset) => {
            if (now - ts > 3000) { 
                task.inflight.delete(offset);
                task.inflightTimestamps.delete(offset);
                task.wantQueue.unshift(offset); 
            }
        });
        if (task.inflight.size === 0 && task.wantQueue.length === 0 && !task.completed) {
            requestNextChunk(task);
        }
    });
}

// === SW 逻辑 ===
function handleStreamOpen(data, source) {
    const { requestId, fileId, range } = data;

    // 1. 本地 Blob 命中
    if (window.virtualFiles.has(fileId)) {
        log(`📂 本地命中: ${fileId}`);
        serveLocalBlob(fileId, requestId, range, source);
        return;
    }

    let task = window.activeTasks.get(fileId);
    if (!task) {
        startDownloadTask(fileId);
        task = window.activeTasks.get(fileId);
    }
    if (!task) {
        source.postMessage({ type: 'STREAM_ERROR', requestId, msg: 'Task Start Failed' });
        return;
    }

    let start = 0;
    let end = task.size - 1;
    if (range && range.startsWith('bytes=')) {
        const parts = range.replace('bytes=', '').split('-');
        const s = parseInt(parts[0], 10);
        const e = parts[1] ? parseInt(parts[1], 10) : end;
        if (!isNaN(s)) start = s;
        if (!isNaN(e)) end = Math.min(e, task.size - 1);
    }

    source.postMessage({
        type: 'STREAM_META',
        requestId,
        fileId,
        fileSize: task.size,
        fileType: task.fileType || 'application/octet-stream',
        start, end
    });

    task.swRequests.set(requestId, { start, end, current: start, source });

    const reqChunkIndex = Math.floor(start / CHUNK_SIZE) * CHUNK_SIZE;
    
    // 2. Seek 判定修复：只要位置变动大，强制更新指针，不检查缓存是否存在
    // 这样能确保下载重心立即转移到新的播放位置之后
    if (Math.abs(task.nextOffset - start) > CHUNK_SIZE * 2) {
        log(`⏩ Seek -> ${start}`);
        task.nextOffset = reqChunkIndex;
        
        // 重置队列，优先响应新位置
        task.wantQueue = []; 
        task.inflight.clear(); 
        task.inflightTimestamps.clear();
        task.lastWanted = reqChunkIndex - CHUNK_SIZE;
    }

    // 3. 移除 GC 逻辑：确保数据全量保留，以便最终合成文件

    processSwQueue(task);
    requestNextChunk(task);
}

function serveLocalBlob(fileId, requestId, range, source) {
    const blob = window.virtualFiles.get(fileId);
    if (!blob) return;

    let start = 0;
    let end = blob.size - 1;
    if (range && range.startsWith('bytes=')) {
        const parts = range.replace('bytes=', '').split('-');
        const s = parseInt(parts[0], 10);
        const e = parts[1] ? parseInt(parts[1], 10) : end;
        if (!isNaN(s)) start = s;
        if (!isNaN(e)) end = Math.min(e, blob.size - 1);
    }

    source.postMessage({
        type: 'STREAM_META',
        requestId,
        fileId,
        fileSize: blob.size,
        fileType: blob.type,
        start, end
    });

    const reader = new FileReader();
    reader.onload = () => {
        const buffer = reader.result;
        source.postMessage({
            type: 'STREAM_DATA',
            requestId,
            chunk: new Uint8Array(buffer)
        }, [buffer]);
        source.postMessage({ type: 'STREAM_END', requestId });
    };
    reader.readAsArrayBuffer(blob.slice(start, end + 1));
}

function handleStreamCancel(data) {
    const { requestId } = data;
    window.activeTasks.forEach(t => t.swRequests.delete(requestId));
}

function processSwQueue(task) {
    if (task.swRequests.size === 0) return;
    task.swRequests.forEach((req, reqId) => {
        while (req.current <= req.end) {
            const chunkOffset = Math.floor(req.current / CHUNK_SIZE) * CHUNK_SIZE;
            const insideOffset = req.current % CHUNK_SIZE;
            const chunkData = task.parts.get(chunkOffset);
            
            if (chunkData) {
                const available = chunkData.byteLength - insideOffset;
                const needed = req.end - req.current + 1;
                const sendLen = Math.min(available, needed);
                const slice = chunkData.slice(insideOffset, insideOffset + sendLen);
                
                req.source.postMessage({ type: 'STREAM_DATA', requestId: reqId, chunk: slice }, [slice.buffer]);
                req.current += sendLen;
                
                if (req.current > req.end) {
                    req.source.postMessage({ type: 'STREAM_END', requestId: reqId });
                    task.swRequests.delete(reqId);
                    break;
                }
            } else { break; }
        }
    });
}

function startDownloadTask(fileId) {
    if (window.activeTasks.has(fileId)) return;
    const meta = window.smartMetaCache.get(fileId);
    if (!meta) return;

    const task = {
        fileId, 
        size: meta.fileSize, 
        fileType: meta.fileType,
        parts: new Map(),
        swRequests: new Map(),
        peers: [], 
        peerIndex: 0,
        nextOffset: 0,
        lastWanted: -CHUNK_SIZE,
        wantQueue: [],
        inflight: new Set(),
        inflightTimestamps: new Map(), 
        completed: false
    };
    
    if (meta.senderId && window.state.conns[meta.senderId]) task.peers.push(meta.senderId);
    if (window.remoteFiles.has(fileId)) {
        window.remoteFiles.get(fileId).forEach(pid => {
            if (!task.peers.includes(pid) && window.state.conns[pid]) task.peers.push(pid);
        });
    }

    log(`🚀 任务开始: ${fileId} (${(task.size/1024/1024).toFixed(1)}MB)`);
    window.activeTasks.set(fileId, task);
    requestNextChunk(task);
}

function requestNextChunk(task) {
    if (task.completed) return;
    const desired = PARALLEL;
    
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

    while (task.wantQueue.length < desired) {
        const off = Math.max(task.nextOffset, task.lastWanted + CHUNK_SIZE);
        if (off >= task.size) break;
        if (task.parts.has(off)) {
            task.nextOffset = off; task.lastWanted = off; continue;
        }
        if (!task.inflight.has(off) && !task.wantQueue.includes(off)) {
            task.wantQueue.push(off); task.lastWanted = off;
        } else {
             task.lastWanted += CHUNK_SIZE;
        }
    }
    dispatchRequests(task);
}

function dispatchRequests(task) {
    while (task.inflight.size < PARALLEL && task.wantQueue.length > 0) {
        const off = task.wantQueue.shift();
        const conn = pickConn(task);
        if (!conn) { task.wantQueue.unshift(off); break; }
        
        try {
            conn.send({ t: 'SMART_GET_CHUNK', fileId: task.fileId, offset: off, size: CHUNK_SIZE });
            task.inflight.add(off);
            task.inflightTimestamps.set(off, Date.now()); 
            statBump('req');
        } catch(e) {
            task.wantQueue.unshift(off); break;
        }
    }
}

function pickConn(task) {
    if (!task.peers.length) return null;
    for (let i=0; i<task.peers.length; i++) {
        const idx = (task.peerIndex + i) % task.peers.length;
        const pid = task.peers[idx];
        const c = window.state.conns[pid];
        if (c && c.open) {
            task.peerIndex = (idx + 1) % task.peers.length;
            return c;
        }
    }
    return null;
}

function handleBinaryData(buffer, fromId) {
    try {
        let u8;
        if (buffer instanceof ArrayBuffer) u8 = new Uint8Array(buffer);
        else if (buffer instanceof Uint8Array) u8 = buffer;
        else return;

        const len = u8[0];
        const headerStr = new TextDecoder().decode(u8.slice(1, 1 + len));
        const header = JSON.parse(headerStr);
        const body = u8.slice(1 + len); 
        const safeBody = new Uint8Array(body); 

        const task = window.activeTasks.get(header.fileId);
        if (!task) return;

        task.inflight.delete(header.offset);
        task.inflightTimestamps.delete(header.offset);

        if (!task.parts.has(header.offset)) {
            task.parts.set(header.offset, safeBody);
            statBump('recv');
        }

        processSwQueue(task);

        // 检查下载完成
        const expectedChunks = Math.ceil(task.size / CHUNK_SIZE);
        if (task.parts.size >= expectedChunks && !task.completed) {
            task.completed = true;
            log('✅ 下载完成');
            const chunks = [];
            for(let i=0; i<expectedChunks; i++) {
                const off = i * CHUNK_SIZE;
                const d = task.parts.get(off);
                if (d) chunks.push(d);
            }
            const blob = new Blob(chunks, { type: task.fileType });
            window.virtualFiles.set(task.fileId, blob);
            
            task.parts.clear(); 
            task.swRequests.clear();
            window.activeTasks.delete(task.fileId);
            return;
        }
        requestNextChunk(task);
    } catch(e) {}
}

function handleGetChunk(pkt, fromId) {
    const file = window.virtualFiles.get(pkt.fileId);
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        try {
            const buffer = reader.result;
            const header = JSON.stringify({ fileId: pkt.fileId, offset: pkt.offset });
            const headerBytes = new TextEncoder().encode(header);
            
            const packet = new Uint8Array(1 + headerBytes.byteLength + buffer.byteLength);
            packet[0] = headerBytes.byteLength;
            packet.set(headerBytes, 1);
            packet.set(new Uint8Array(buffer), 1 + headerBytes.byteLength);

            const conn = window.state.conns[fromId];
            if (conn && conn.open) sendSafe(conn, packet);
        } catch(e) {}
    };
    const blob = file.slice(pkt.offset, pkt.offset + pkt.size);
    reader.readAsArrayBuffer(blob);
}

function sendSafe(conn, packet) {
    const dc = conn.dataChannel || conn._dc || (conn.peerConnection && conn.peerConnection.createDataChannel ? null : null);
    if (dc && dc.bufferedAmount > MAX_BUFFERED) {
        SEND_QUEUE.push({ conn, packet });
        return;
    }
    try {
        conn.send(packet);
        statBump('send');
    } catch(e) {
        SEND_QUEUE.push({ conn, packet });
    }
}

function flushSendQueue() {
    if (SEND_QUEUE.length === 0) return;
    let processCount = 5;
    const fails = [];
    while (SEND_QUEUE.length > 0 && processCount > 0) {
        const item = SEND_QUEUE.shift();
        const dc = item.conn.dataChannel || item.conn._dc;
        if (dc && dc.bufferedAmount > MAX_BUFFERED) {
            fails.push(item); 
        } else {
            try {
                item.conn.send(item.packet);
                statBump('send');
                processCount--;
            } catch(e) {
                fails.push(item);
            }
        }
    }
    if (fails.length > 0) SEND_QUEUE.unshift(...fails);
}
