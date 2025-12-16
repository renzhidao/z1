const CACHE_NAME = 'p1-v1765808928-final';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './style.css',
  './loader.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(CORE_ASSETS).catch(() => {}))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())
    )).then(() => self.clients.claim())
  );
});

const streamControllers = new Map();
// 记录每个虚拟请求的状态，用于日志（不影响业务）
const streamStates = new Map();

/** SW -> 页面日志桥：把 SW 内部关键路径打点发到页面，再进 LogConsole */
async function swLogToClientId(clientId, msg, extra) {
  const payload = { type: 'SW_LOG', ts: Date.now(), msg, extra };
  try {
    if (clientId) {
      const c = await self.clients.get(clientId);
      if (c) {
        try { c.postMessage(payload); } catch (_) {}
        return;
      }
    }
  } catch (_) {}

  // fallback：广播到所有 window（多开时也能看到）
  try {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    (list || []).forEach(c => { try { c.postMessage(payload); } catch (_) {} });
  } catch (_) {}
}

function fireSwLog(event, msg, extra) {
  try {
    const clientId = event && event.clientId ? event.clientId : null;
    if (event && event.waitUntil) event.waitUntil(swLogToClientId(clientId, msg, extra));
    else swLogToClientId(clientId, msg, extra);
  } catch (_) {}
}

function byteLenOfChunk(chunk) {
  try {
    if (!chunk) return 0;
    if (chunk instanceof ArrayBuffer) return chunk.byteLength || 0;
    if (chunk instanceof Uint8Array) return chunk.byteLength || 0;
    if (chunk && chunk.buffer instanceof ArrayBuffer) return chunk.byteLength || chunk.length || 0;
    if (chunk instanceof Blob) return chunk.size || 0;
    return 0;
  } catch (_) {
    return 0;
  }
}

// 辅助函数：根据文件名或元数据猜测正确的 Content-Type
// 解决 audio/mp3 变成了 application/octet-stream 导致无法播放的问题
function guessMime(fileName, declaredType) {
  if (declaredType && typeof declaredType === 'string' && declaredType.trim() && declaredType !== 'application/octet-stream') {
    return declaredType;
  }
  const n = (fileName || '').toLowerCase();

  // audio
  if (n.endsWith('.mp3')) return 'audio/mpeg';
  if (n.endsWith('.m4a')) return 'audio/mp4';
  if (n.endsWith('.aac')) return 'audio/aac';
  if (n.endsWith('.wav')) return 'audio/wav';
  if (n.endsWith('.ogg') || n.endsWith('.oga')) return 'audio/ogg';
  if (n.endsWith('.flac')) return 'audio/flac';
  if (n.endsWith('.webm')) return 'audio/webm';

  // image
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.gif')) return 'image/gif';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.svg')) return 'image/svg+xml';

  // video fallback
  if (n.endsWith('.mp4')) return 'video/mp4';

  return 'application/octet-stream';
}

// PATCH: 选择更“正确”的 client（避免多窗口时选错页面导致 STREAM_META/数据链路异常）
async function pickBestClient(event) {
  const clientId = event.clientId;
  let client = clientId ? await self.clients.get(clientId) : null;
  if (client) return client;

  await self.clients.claim();

  const ref = event.request.referrer || '';
  const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

  if (!list || list.length === 0) return null;

  // 优先 referrer 匹配
  const byRef = ref ? list.find(c => (c.url || '').startsWith(ref)) : null;
  if (byRef) return byRef;

  // 再优先 focused/visible
  const focused = list.find(c => c.focused) || list.find(c => c.visibilityState === 'visible');
  return focused || list[0];
}

// PATCH: 统一构造虚拟文件响应头（去掉 Content-Disposition filename，避免中文 header 触发媒体栈问题）
function buildVirtualHeaders({ fileName, fileType, total, start, end, hasRange }) {
  const headers = new Headers();
  const len = end - start + 1;

  headers.set('Content-Type', guessMime(fileName, fileType));
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Vary', 'Range');
  headers.set('Cache-Control', 'no-store');
  headers.set('Pragma', 'no-cache');

  // 不再设置 Content-Disposition（尤其不要带中文 filename）
  // headers.set('Content-Disposition', `inline; filename="${fileName}"`);

  headers.set('Content-Length', String(len));

  if (hasRange) {
    headers.set('Content-Range', `bytes ${start}-${end}/${total}`);
  }
  return headers;
}

self.addEventListener('message', event => {
  const data = event.data;
  if (!data) return;

  // 握手
  if (data.type === 'PING') {
    try { event.source && event.source.postMessage({ type: 'PING' }); } catch (e) {}
    return;
  }

  if (!data.requestId) return;

  const controller = streamControllers.get(data.requestId);
  // 允许 META/ERROR 日志即使 controller 已不存在
  const st = streamStates.get(data.requestId);

  switch (data.type) {
    case 'STREAM_DATA':
      try {
        const chunk = data.chunk;
        if (!chunk) return;

        const bl = byteLenOfChunk(chunk);
        if (st) {
          st.bytes = (st.bytes || 0) + bl;
          if (!st.firstDataTs) st.firstDataTs = Date.now();
        }

        if (!controller) return;

        // 更健壮地处理 chunk 类型（ArrayBuffer / Uint8Array / Blob）
        if (chunk instanceof ArrayBuffer) {
          controller.enqueue(new Uint8Array(chunk));
        } else if (chunk instanceof Uint8Array) {
          controller.enqueue(chunk);
        } else if (chunk && chunk.buffer instanceof ArrayBuffer) {
          controller.enqueue(new Uint8Array(chunk.buffer, chunk.byteOffset || 0, chunk.byteLength || chunk.length || 0));
        } else if (chunk instanceof Blob && chunk.arrayBuffer) {
          chunk.arrayBuffer().then(ab => {
            try { controller.enqueue(new Uint8Array(ab)); } catch (e) {}
          }).catch(() => {});
        }
      } catch (e) {}
      break;

    case 'STREAM_END':
      try { if (controller) controller.close(); } catch (e) {}
      streamControllers.delete(data.requestId);
      if (st) {
        st.endedTs = Date.now();
        const dur = (st.endedTs - (st.startedTs || st.endedTs));
        swLogToClientId(st.clientId, 'VFILE_END', {
          requestId: data.requestId,
          fileId: st.fileId,
          method: st.method,
          range: st.range || '',
          bytes: st.bytes || 0,
          ms: dur
        });
      }
      streamStates.delete(data.requestId);
      break;

    case 'STREAM_ERROR':
      try { if (controller) controller.error(new Error(data.msg)); } catch (e) {}
      streamControllers.delete(data.requestId);
      if (st) {
        swLogToClientId(st.clientId, 'VFILE_STREAM_ERROR', {
          requestId: data.requestId,
          fileId: st.fileId,
          method: st.method,
          range: st.range || '',
          msg: data.msg || ''
        });
      }
      streamStates.delete(data.requestId);
      break;

    case 'STREAM_META':
      // 不做 controller 操作；但记录日志更利于定位“图片加载失败”
      if (st) {
        st.metaTs = Date.now();
        st.meta = { fileSize: data.fileSize, fileType: data.fileType, start: data.start, end: data.end };
        swLogToClientId(st.clientId, 'VFILE_META', {
          requestId: data.requestId,
          fileId: st.fileId,
          method: st.method,
          range: st.range || '',
          fileType: data.fileType,
          fileSize: data.fileSize,
          start: data.start,
          end: data.end
        });
      }
      break;
  }
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. 拦截虚拟文件请求 (核心逻辑)
  if (url.pathname.includes('/virtual/file/')) {
    fireSwLog(event, 'VFILE_FETCH', {
      method: event.request.method,
      path: url.pathname,
      range: event.request.headers.get('Range') || '',
      clientId: event.clientId || ''
    });
    event.respondWith(handleVirtualStream(event));
    return;
  }

  // 2. 静态资源策略
  if (url.pathname.endsWith('registry.txt') || url.pathname.endsWith('.js')) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }

  // 3. 通用缓存策略
  event.respondWith(
    caches.match(event.request).then(cached => {
      const netFetch = fetch(event.request).then(res => {
        // 确保只缓存 http/https 协议的成功请求
        if (event.request.method === 'GET' && url.protocol.startsWith('http')) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return res;
      }).catch(() => null);
      return cached || netFetch;
    })
  );
});

// HEAD 请求专用：只拿 STREAM_META 回 headers，然后立刻 CANCEL
async function handleVirtualHead(event, client, { fileId, fileName, rangeHeader }) {
  const requestId = Math.random().toString(36).slice(2) + Date.now();

  // 记录状态，用于后续 SW message 里打点
  streamStates.set(requestId, {
    requestId,
    clientId: client && client.id,
    fileId,
    fileName,
    method: 'HEAD',
    range: rangeHeader || '',
    startedTs: Date.now(),
    bytes: 0
  });

  // 先发 OPEN
  try {
    client.postMessage({ type: 'STREAM_OPEN', requestId, fileId, range: rangeHeader });
    swLogToClientId(client.id, 'VFILE_OPEN', { requestId, method: 'HEAD', fileId, range: rangeHeader || '' });
  } catch (e) {
    swLogToClientId(client.id, 'VFILE_OPEN_FAIL', { requestId, method: 'HEAD', fileId, err: String(e && e.message || e) });
  }

  return new Promise(resolve => {
    const metaHandler = (e) => {
      const d = e.data;
      if (!d || d.requestId !== requestId) return;

      if (d.type === 'STREAM_META') {
        self.removeEventListener('message', metaHandler);

        const total = d.fileSize;
        const start = d.start;
        const end = d.end;

        const hasRange = !!rangeHeader;
        const headers = buildVirtualHeaders({
          fileName,
          fileType: d.fileType,
          total,
          start,
          end,
          hasRange
        });

        resolve(new Response(null, { status: hasRange ? 206 : 200, headers }));

        // 立刻取消，避免 client 继续下载/推数据
        try {
          client.postMessage({ type: 'STREAM_CANCEL', requestId });
          swLogToClientId(client.id, 'VFILE_CANCEL', { requestId, method: 'HEAD', fileId });
        } catch (_) {}

        // HEAD 结束就清状态（避免堆积）
        streamStates.delete(requestId);
        return;
      }

      if (d.type === 'STREAM_ERROR') {
        self.removeEventListener('message', metaHandler);
        resolve(new Response(d.msg || 'File Not Found', { status: 404 }));
        try { client.postMessage({ type: 'STREAM_CANCEL', requestId }); } catch (e) {}
        swLogToClientId(client.id, 'VFILE_HEAD_ERROR', { requestId, fileId, msg: d.msg || '' });
        streamStates.delete(requestId);
      }
    };

    self.addEventListener('message', metaHandler);

    setTimeout(() => {
      self.removeEventListener('message', metaHandler);
      try { client.postMessage({ type: 'STREAM_CANCEL', requestId }); } catch (e) {}
      swLogToClientId(client.id, 'VFILE_HEAD_META_TIMEOUT', { requestId, fileId, ms: 8000 });
      streamStates.delete(requestId);
      resolve(new Response('Gateway Timeout (Metadata Wait, HEAD)', { status: 504 }));
    }, 8000);
  });
}

async function handleVirtualStream(event) {
  const url = new URL(event.request.url);

  // 1. 查找 Client
  const client = await pickBestClient(event);
  if (!client) {
    fireSwLog(event, 'VFILE_NO_CLIENT', { clientId: event.clientId || '', path: url.pathname });
    return new Response('Service Worker: No Client Active', { status: 503 });
  }

  fireSwLog(event, 'VFILE_PICK_CLIENT', { pickedId: client.id, pickedUrl: client.url || '' });

  // 2. 解析路径 /virtual/file/{fileId}/{fileName}
  const pathname = url.pathname;
  const marker = '/virtual/file/';
  const idx = pathname.indexOf(marker);
  if (idx === -1) {
    fireSwLog(event, 'VFILE_BAD_URL', { path: pathname });
    return new Response('Bad Virtual URL', { status: 400 });
  }

  const tail = pathname.slice(idx + marker.length);
  const segs = tail.split('/').filter(Boolean);
  const fileId = segs[0];
  if (!fileId) {
    fireSwLog(event, 'VFILE_MISSING_FILEID', { path: pathname });
    return new Response('Bad Virtual URL (missing fileId)', { status: 400 });
  }

  let fileName = 'file';
  try { fileName = decodeURIComponent(segs.slice(1).join('/') || 'file'); }
  catch (e) { fileName = segs.slice(1).join('/') || 'file'; }

  const rangeHeader = event.request.headers.get('Range');

  // 处理 HEAD
  if (event.request.method === 'HEAD') {
    return handleVirtualHead(event, client, { fileId, fileName, rangeHeader });
  }

  const requestId = Math.random().toString(36).slice(2) + Date.now();

  // 建立状态
  streamStates.set(requestId, {
    requestId,
    clientId: client.id,
    fileId,
    fileName,
    method: event.request.method || 'GET',
    range: rangeHeader || '',
    startedTs: Date.now(),
    bytes: 0
  });

  // 用 bytes stream，媒体/Fetch 管线兼容性更好
  const stream = new ReadableStream({
    type: 'bytes',
    start(controller) {
      streamControllers.set(requestId, controller);
      try {
        client.postMessage({ type: 'STREAM_OPEN', requestId, fileId, range: rangeHeader });
        swLogToClientId(client.id, 'VFILE_OPEN', {
          requestId,
          method: event.request.method || 'GET',
          fileId,
          fileName,
          range: rangeHeader || ''
        });
      } catch (e) {
        swLogToClientId(client.id, 'VFILE_OPEN_FAIL', { requestId, fileId, err: String(e && e.message || e) });
      }
    },
    cancel() {
      streamControllers.delete(requestId);
      try { client.postMessage({ type: 'STREAM_CANCEL', requestId }); } catch (e) {}
      swLogToClientId(client.id, 'VFILE_STREAM_CANCELLED', { requestId, fileId });
      streamStates.delete(requestId);
    }
  });

  return new Promise(resolve => {
    const metaHandler = (e) => {
      const d = e.data;
      if (!d || d.requestId !== requestId) return;

      if (d.type === 'STREAM_META') {
        self.removeEventListener('message', metaHandler);

        const total = d.fileSize;
        const start = d.start;
        const end = d.end;

        const hasRange = !!rangeHeader;
        const headers = buildVirtualHeaders({
          fileName,
          fileType: d.fileType,
          total,
          start,
          end,
          hasRange
        });

        resolve(new Response(stream, { status: hasRange ? 206 : 200, headers }));
        return;
      }

      if (d.type === 'STREAM_ERROR') {
        self.removeEventListener('message', metaHandler);
        streamControllers.delete(requestId);
        swLogToClientId(client.id, 'VFILE_META_ERROR', { requestId, fileId, msg: d.msg || '' });
        streamStates.delete(requestId);
        resolve(new Response(d.msg || 'File Not Found', { status: 404 }));
        try { client.postMessage({ type: 'STREAM_CANCEL', requestId }); } catch (e) {}
      }
    };

    self.addEventListener('message', metaHandler);

    // 超时要主动 cancel + 结束 controller，避免死流
    setTimeout(() => {
      self.removeEventListener('message', metaHandler);

      const ctl = streamControllers.get(requestId);
      if (ctl) {
        try { ctl.error(new Error('Gateway Timeout (Metadata Wait)')); } catch (e) {}
        streamControllers.delete(requestId);
      }

      swLogToClientId(client.id, 'VFILE_META_TIMEOUT', { requestId, fileId, ms: 15000, range: rangeHeader || '' });
      streamStates.delete(requestId);

      try { client.postMessage({ type: 'STREAM_CANCEL', requestId }); } catch (e) {}

      resolve(new Response('Gateway Timeout (Metadata Wait)', { status: 504 }));
    }, 15000);
  });
}
