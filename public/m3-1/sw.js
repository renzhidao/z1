const CACHE_NAME = 'p1-stream-v1765199410-fix'; // PATCH: Version Bump
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

// PATCH: 选择更“正确”的 client
async function pickBestClient(event) {
  const clientId = event.clientId;
  let client = clientId ? await self.clients.get(clientId) : null;
  if (client) return client;

  await self.clients.claim();

  const ref = event.request.referrer || '';
  const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

  if (!list || list.length === 0) return null;

  const byRef = ref ? list.find(c => (c.url || '').startsWith(ref)) : null;
  if (byRef) return byRef;

  const focused = list.find(c => c.focused) || list.find(c => c.visibilityState === 'visible');
  return focused || list[0];
}

// PATCH: 统一构造虚拟文件响应头
function buildVirtualHeaders({ fileName, fileType, total, start, end, hasRange }) {
  const headers = new Headers();
  const len = end - start + 1;

  headers.set('Content-Type', guessMime(fileName, fileType));
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Vary', 'Range');
  headers.set('Cache-Control', 'no-store');
  headers.set('Pragma', 'no-cache');
  headers.set('Content-Length', String(len));

  if (hasRange) {
    headers.set('Content-Range', `bytes ${start}-${end}/${total}`);
  }
  return headers;
}

self.addEventListener('message', event => {
  const data = event.data;
  if (!data) return;

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
        const chunk = data.chunk;
        if (!chunk) return;

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

  if (url.pathname.includes('/virtual/file/')) {
    event.respondWith(handleVirtualStream(event));
    return;
  }

  if (url.pathname.endsWith('registry.txt') || url.pathname.endsWith('.js')) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      const netFetch = fetch(event.request).then(res => {
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

async function handleVirtualHead(event, client, { fileId, fileName, rangeHeader }) {
  const requestId = Math.random().toString(36).slice(2) + Date.now();

  try { client.postMessage({ type: 'STREAM_OPEN', requestId, fileId, range: rangeHeader }); } catch (e) {}

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
    }, 8000);
  });
}

async function handleVirtualStream(event) {
  const client = await pickBestClient(event);
  if (!client) return new Response('Service Worker: No Client Active', { status: 503 });

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

  const rangeHeader = event.request.headers.get('Range');

  if (event.request.method === 'HEAD') {
    return handleVirtualHead(event, client, { fileId, fileName, rangeHeader });
  }

  const requestId = Math.random().toString(36).slice(2) + Date.now();

  const stream = new ReadableStream({
    type: 'bytes',
    start(controller) {
      streamControllers.set(requestId, controller);
      try { client.postMessage({ type: 'STREAM_OPEN', requestId, fileId, range: rangeHeader }); } catch (e) {}
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