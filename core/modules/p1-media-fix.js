// p1-media-fix.js
// P1 模块：修复“下载失败 + 音频播放”
// 核心：把 ./virtual/file/ 统一修正到受 SW scope 控制的 /core/virtual/file/；并对下载提供 fetch->blob 兜底
export function init() {
  function getCoreBaseUrl() {
    try {
      const loc = window.location;
      const origin = loc.origin === 'null' ? '' : loc.origin;

      let path = loc.pathname || '/';
      if (path.endsWith('.html') || path.endsWith('.htm')) {
        path = path.substring(0, path.lastIndexOf('/') + 1);
      }
      if (!path.endsWith('/')) {
        path = path.substring(0, path.lastIndexOf('/') + 1);
      }

      const idx = path.indexOf('/core/');
      if (idx >= 0) return origin + path.substring(0, idx + '/core/'.length);
      return origin + path + 'core/';
    } catch (_) {
      return './core/';
    }
  }

  function getVirtualFileUrl(fileId, fileName) {
    const base = getCoreBaseUrl(); // .../core/
    const safeName = fileName || 'file';
    return base + 'virtual/file/' + fileId + '/' + encodeURIComponent(safeName);
  }

  function toCoreVirtualUrl(u) {
    if (!u || typeof u !== 'string') return u;
    if (u.startsWith('blob:') || u.startsWith('data:') || u.startsWith('http')) return u;
    if (u.includes('/core/virtual/file/')) return u;

    const base = getCoreBaseUrl();
    if (u.startsWith('./virtual/file/')) return base + u.slice(2);
    if (u.startsWith('/virtual/file/')) return base + u.slice(1);
    if (u.startsWith('virtual/file/')) return base + u;
    return u;
  }

  function patchOnce() {
    if (!window.smartCore) return false;

    // play(): 返回 URL 强制走 /core/ scope
    if (!window.smartCore.__p1_media_fix_play_patched && typeof window.smartCore.play === 'function') {
      const origPlay = window.smartCore.play.bind(window.smartCore);
      window.smartCore.play = (fileId, name) => {
        const u = origPlay(fileId, name);
        return toCoreVirtualUrl(u);
      };
      window.smartCore.__p1_media_fix_play_patched = true;
    }

    // download(): 远端下载优先 fetch->blob 保存，兜底用 <a download>
    if (!window.smartCore.__p1_media_fix_download_patched && typeof window.smartCore.download === 'function') {
      const origDownload = window.smartCore.download.bind(window.smartCore);

      window.smartCore.download = async (fileId, name) => {
        try {
          const meta = (window.smartMetaCache && window.smartMetaCache.get(fileId)) || {};
          const fileName = name || meta.fileName || 'file';

          // 本地文件：保留原逻辑
          if (window.virtualFiles && window.virtualFiles.has && window.virtualFiles.has(fileId)) {
            return origDownload(fileId, fileName);
          }

          const url = getVirtualFileUrl(fileId, fileName);

          // 小于等于 30MB：fetch->blob 更稳
          try {
            const size2 = meta.fileSize || 0;
            const canBuffer = !size2 || size2 <= 30 * 1024 * 1024;
            if (canBuffer) {
              const res = await fetch(url);
              if (!res || !res.ok) throw new Error('HTTP ' + (res && res.status));
              const blob = await res.blob();

              if (window.ui && typeof window.ui.downloadBlob === 'function') {
                window.ui.downloadBlob(blob, fileName);
                return;
              }

              const blobUrl = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = blobUrl;
              a.download = fileName;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              setTimeout(() => { try { URL.revokeObjectURL(blobUrl); } catch(_) {} }, 5000);
              return;
            }
          } catch (_) {}

          // 兜底：直链下载（由 SW 虚拟流提供）
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } catch (e) {
          try { return origDownload(fileId, name); } catch (_) {}
        }
      };

      window.smartCore.__p1_media_fix_download_patched = true;
    }

    return true;
  }

  if (!patchOnce()) {
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (patchOnce() || tries > 50) clearInterval(t);
    }, 50);
  }
}
