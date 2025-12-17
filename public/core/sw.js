const CACHE_NAME = 'p1-stream-v1765199409-p2'; // PATCH: Version Bump（确保 sw 更新生效）
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
  headers.set('Vary', 'Range');                // PATCH
  headers.set('Cache-Control', 'no-store');    // PATCH: 虚拟流不要缓存
  headers.set('Pragma', 'no-cache');           // PATCH: 兼容老内核

  // PATCH: 不再设置 Content-Disposition（尤其不要带中文 filename）
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
  if (!controller) return;

  switch (data.type) {
    case 'STREAM_DATA':
      try {
        // PATCH: 更健壮地处理 chunk 类型（ArrayBuffer / Uint8Array / Blob）
        const chunk = data.chunk;
        if (!chunk) return;

        if (chunk instanceof ArrayBuffer) {
          controller.enqueue(new Uint8Array(chunk));
        } else if (chunk instanceof Uint8Array) {
          controller.enqueue(chunk);
        } else if (chunk && chunk.buffer instanceof ArrayBuffer) {
          // 其它 TypedArray
          controller.enqueue(new Uint8Array(chunk.buffer, chunk.byteOffset || 0, chunk.byteLength || chunk.length || 0));
        } else if (chunk instanceof Blob && chunk.arrayBuffer) {
          chunk.arrayBuffer().then(ab => {
            try { controller.enqueue(new Uint8Array(ab)); } catch (e) {}
          }).catch(() => {});
        }
      } catch (e) {}
      break;

    case 'STREAM_END':
      try { controller.close(); } catch (e) {}
      streamControllers.delete(data.requestId);
      break;

    case 'STREAM_ERROR':
      try { controller.error(new Error(data.msg)); } catch (e) {}
      streamControllers.delete(data.requestId);
      break;
  }
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. 拦截虚拟文件请求 (核心逻辑)
  if (url.pathname.includes('/virtual/file/')) {
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

// PATCH: HEAD 请求专用（只拿 STREAM_META 回 headers，然后立刻 CANCEL，避免媒体探测请求被错误走成“有 body 的流”）
async function handleVirtualHead(event, client, { fileId, fileName, rangeHeader }) {
  const requestId = Math.random().toString(36).slice(2) + Date.now();

  // 先发 OPEN
  try { client.postMessage({ type: 'STREAM_OPEN', requestId, fileId, range: rangeHeader, preview: !!isPreview }); } catch (e) {}

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

        // HEAD：无 body
        resolve(new Response(null, { status: hasRange ? 206 : 200, headers }));

        // 立刻取消，避免 client 继续下载/推数据
        try { client.postMessage({ type: 'STREAM_CANCEL', requestId }); } catch (e) {}
        return;
      }

      if (d.type === 'STREAM_ERROR') {
        self.removeEventListener('message', metaHandler);
        resolve(new Response(d.msg || 'File Not Found', { status: 404 }));
        try { client.postMessage({ type: 'STREAM_CANCEL', requestId }); } catch (e) {}
      }
    };

    self.addEventListener('message', metaHandler);

    setTimeout(() => {
      self.removeEventListener('message', metaHandler);
      try { client.postMessage({ type: 'STREAM_CANCEL', requestId }); } catch (e) {}
      resolve(new Response('Gateway Timeout (Metadata Wait, HEAD)', { status: 504 }));
    }, 8000); // PATCH: HEAD 探测不需要等太久
  });
}

async function handleVirtualStream(event) {
  // 1. 查找 Client
  const client = await pickBestClient(event);
  if (!client) return new Response('Service Worker: No Client Active', { status: 503 });

  // 2. 解析路径 /virtual/file/{fileId}/{fileName}
  const pathname = new URL(event.request.url).pathname;
  const marker = '/virtual/file/';
  const idx = pathname.indexOf(marker);
  if (idx === -1) return new Response('Bad Virtual URL', { status: 400 });

  const tail = pathname.slice(idx + marker.length);
  const segs = tail.split('/').filter(Boolean);
  const fileId = segs[0];
  if (!fileId) return new Response('Bad Virtual URL (missing fileId)', { status: 400 });

  let fileName = 'file';
  try { fileName = decodeURIComponent(segs.slice(1).join('/') || 'file'); }
  catch (e) { fileName = segs.slice(1).join('/') || 'file'; }

  const reqUrl = new URL(event.request.url);
  const isPreview = !!(reqUrl.searchParams && reqUrl.searchParams.has('p1_preview'));
  let rangeHeader = event.request.headers.get('Range');
  // 预览：首次点击只取前 1MB，用来拿到首帧封面（后续会主动取消，不继续下载）
  if (isPreview && !rangeHeader) rangeHeader = 'bytes=0-1048575';

  // PATCH: 处理 HEAD（媒体元素常见探测行为）
  if (event.request.method === 'HEAD') {
    return handleVirtualHead(event, client, { fileId, fileName, rangeHeader });
  }

  const requestId = Math.random().toString(36).slice(2) + Date.now();

  // PATCH: 用 bytes stream，媒体/Fetch 管线兼容性更好
  const stream = new ReadableStream({
    type: 'bytes',
    start(controller) {
      streamControllers.set(requestId, controller);
      try { client.postMessage({ type: 'STREAM_OPEN', requestId, fileId, range: rangeHeader, preview: !!isPreview }); } catch (e) {}
    },
    cancel() {
      streamControllers.delete(requestId);
      try { client.postMessage({ type: 'STREAM_CANCEL', requestId }); } catch (e) {}
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
        resolve(new Response(d.msg || 'File Not Found', { status: 404 }));
        try { client.postMessage({ type: 'STREAM_CANCEL', requestId }); } catch (e) {}
      }
    };

    self.addEventListener('message', metaHandler);

    // PATCH: 超时要主动 cancel + 结束 controller，避免死流
    setTimeout(() => {
      self.removeEventListener('message', metaHandler);

      const ctl = streamControllers.get(requestId);
      if (ctl) {
        try { ctl.error(new Error('Gateway Timeout (Metadata Wait)')); } catch (e) {}
        streamControllers.delete(requestId);
      }

      try { client.postMessage({ type: 'STREAM_CANCEL', requestId }); } catch (e) {}

      resolve(new Response('Gateway Timeout (Metadata Wait)', { status: 504 }));
    }, 15000);
  });
}