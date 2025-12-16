import { CHAT, UI_CONFIG } from './constants.js';

export function init() {
  console.log('📦 加载模块: UI Render (Full Diagnostic + Env Check)');
  window.ui = window.ui || {};
  
  const style = document.createElement('style');
  style.textContent = `
    .img-preview-overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.95); z-index: 9999;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        cursor: zoom-out;
        animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .img-preview-content {
        max-width: 100%; max-height: 90%;
        object-fit: contain;
        box-shadow: 0 0 20px rgba(0,0,0,0.5);
    }
    .stream-card {
        background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; min-width: 220px;
        position: relative;
    }
    .file-expired {
        opacity: 0.6; font-style: italic; font-size: 12px; color: #aaa;
        background: rgba(255,0,0,0.1); padding: 8px; border-radius: 4px;
    }
    .video-error, .img-error-box {
        color: #ff3b30; font-size: 11px; padding: 10px; text-align: center; border: 1px dashed #ff3b30; border-radius: 4px;
    }
    .chat-img.error {
        opacity: 0.3; border: 2px solid #ff3b30;
    }
    /* 媒体占位符样式 */
    .media-cover {
        width: 100%; height: 150px; background: #000; border-radius: 4px;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; position: relative;
    }
    .audio-cover {
        width: 100%; height: 50px; background: #222; border-radius: 4px;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; position: relative; margin-top: 5px;
    }
    .play-btn-overlay {
        width: 40px; height: 40px; border-radius: 50%;
        background: rgba(255,255,255,0.2); border: 2px solid #fff;
        display: flex; align-items: center; justify-content: center;
        font-size: 20px; color: #fff; padding-left: 4px;
    }
    .media-cover:hover .play-btn-overlay, .audio-cover:hover .play-btn-overlay {
        background: rgba(42, 124, 255, 0.8); border-color: transparent;
    }
  `;
  document.head.appendChild(style);
  
  // === 视频错误处理 + 环境检测 ===
  window.handleVideoError = function(el, fileName) {
      if (el.src.includes('/virtual/file/')) {
          let retries = parseInt(el.dataset.retry || '0');
          if (retries < 3) {
              el.dataset.retry = retries + 1;
              if(window.monitor) window.monitor.warn('UI', `⚠️ 视频Error重试(${retries+1})...`);
              setTimeout(() => { const s = el.src; el.src=''; el.src=s; el.load(); }, 1000);
              return;
          }
      }
      el.style.display = 'none';
      const errDiv = el.parentElement.querySelector('.video-error');
      if(errDiv) errDiv.style.display = 'block';
      
      const err = el.error;
      let msg = '未知错误';
      let code = 0;
      if (err) {
          code = err.code;
          switch(err.code) {
              case 1: msg = '用户中止 (MEDIA_ERR_ABORTED)'; break;
              case 2: msg = '网络错误 (MEDIA_ERR_NETWORK)'; break;
              case 3: msg = '解码错误 (MEDIA_ERR_DECODE)'; break;
              case 4: msg = '格式不支持 (MEDIA_ERR_SRC_NOT_SUPPORTED)'; break;
          }
      }
      if (window.monitor) {
          window.monitor.fatal('VIDEO', `❌ 视频挂了 [Code:${code}]: ${fileName}`, {msg});
          
          // === [Env Check] 环境体检 ===
          if (code === 4 || code === 3) {
              const checks = [
                'video/mp4; codecs="avc1.42E01E"', // H.264 Baseline
                'video/mp4; codecs="avc1.640028"', // H.264 High
                'video/mp4; codecs="hev1.1.6.L93.B0"', // H.265 (HEVC)
                'video/webm; codecs="vp9"'
              ];
              let supportMsg = [];
              try {
                  if ('MediaSource' in window) {
                      checks.forEach(mime => {
                          const res = MediaSource.isTypeSupported(mime);
                          const name = mime.includes('avc')?'H264':mime.includes('hev')?'H265':'VP9';
                          supportMsg.push(`${name}:${res?'✅':'❌'}`);
                      });
                      window.monitor.warn('ENV', `环境解码体检: ${supportMsg.join(', ')}`);
                  } else {
                      window.monitor.error('ENV', '⚠️ 当前浏览器不支持 MediaSource API (无法流式播放)');
                  }
              } catch(e) {}
          }
      }
  };

  window.handleImageError = function(el, fileName) {

      // === 修复：SW启动延迟导致的404自动重试 ===
      if (el.src.includes('/virtual/file/')) {
          let retries = parseInt(el.dataset.retry || '0');
          if (retries < 3) {
              el.dataset.retry = retries + 1;
              if(window.monitor) window.monitor.warn('UI', `⚠️ 图片加载失败，正在重试(${retries+1}/3)...`, {file: fileName});
              setTimeout(() => {
                  const src = el.src;
                  el.src = ''; // 强制刷新
                  el.src = src;
              }, 1000);
              return;
          }
      }

      if (el.dataset.errHandled) return;
      el.dataset.errHandled = 'true';
      el.classList.add('error');
      
      if (el.dataset.errHandled) return;
      el.dataset.errHandled = 'true';
      el.classList.add('error');
      const parent = el.parentElement;
      if (parent) {
          const div = document.createElement('div');
          div.className = 'img-error-box';
          div.innerHTML = '❌ 图片加载失败';
          parent.appendChild(div);
      }

      const src = el.src;
      let reason = '未知';
      if (src.startsWith('blob:')) {
          reason = 'Blob已失效';
      } else if (src.includes('/virtual/file/')) {
          fetch(src, {method: 'HEAD'}).then(res => {
              reason = !res.ok ? `HTTP ${res.status}` : '数据损坏';
              report(reason);
          }).catch(e => report('网络探测失败'));
          return;
      } else {
          reason = '资源无法访问';
      }
      report(reason);

      function report(r) {
          if (window.monitor) window.monitor.fatal('IMAGE', `❌ 图片挂了: ${fileName}`, {reason: r});
      }
  };
  
  const render = {
    init() { this.renderList(); this.updateSelf(); },

    updateSelf() {
      const elId = document.getElementById('myId');
      const elNick = document.getElementById('myNick');
      const elSt = document.getElementById('statusText');
      const elDot = document.getElementById('statusDot');
      const elCount = document.getElementById('onlineCount');

      if (elId) elId.innerText = window.state.myId.slice(0, 6);
      if (elNick) elNick.innerText = window.state.myName;
      
      if (elSt) {
        let s = '在线';
        if (window.state.isHub) s = '👑网关';
        if (window.state.mqttStatus === '在线') s += '+MQTT';
        else if (window.state.mqttStatus === '失败') s += '(M离)';
        elSt.innerText = s;
      }
      
      if (elDot) elDot.className = window.state.mqttStatus === '在线' ? 'dot online' : 'dot';
      
      if (elCount) {
         let count = 0;
         Object.values(window.state.conns).forEach(c => { if(c.open) count++; });
         elCount.innerText = count;
      }
    },

    renderList() {
      const list = document.getElementById('contactList');
      if (!list) return;

      const pubUnread = window.state.unread[CHAT.PUBLIC_ID] || 0;
      
      let html = `
        <div class="contact-item ${window.state.activeChat === CHAT.PUBLIC_ID ? 'active' : ''}" 
              data-chat-id="${CHAT.PUBLIC_ID}" data-chat-name="${CHAT.PUBLIC_NAME}">
          <div class="avatar" style="background:${UI_CONFIG.COLOR_GROUP}">群</div>
          <div class="c-info">
            <div class="c-name">${CHAT.PUBLIC_NAME} 
               ${pubUnread > 0 ? `<span class="unread-badge">${pubUnread}</span>` : ''}
            </div>
          </div>
        </div>`;

      const map = new Map();
      Object.values(window.state.contacts).forEach(c => map.set(c.id, c));
      Object.keys(window.state.conns).forEach(k => {
         if (k !== window.state.myId) {
            const existing = map.get(k) || {};
            map.set(k, { ...existing, id: k, n: window.state.conns[k].label || k.slice(0, 6) });
         }
      });

      map.forEach((v, id) => {
        if (!id || id === window.state.myId || id.startsWith(window.config.hub.prefix)) return;
        const isOnline = window.state.conns[id] && window.state.conns[id].open;
        const unread = window.state.unread[id] || 0;
        const safeName = window.util.escape(v.n || id.slice(0, 6));
        const bg = isOnline ? UI_CONFIG.COLOR_ONLINE : window.util.colorHash(id);

        html += `
          <div class="contact-item ${window.state.activeChat === id ? 'active' : ''}" 
                data-chat-id="${id}" data-chat-name="${safeName}">
            <div class="avatar" style="background:${bg}">${safeName[0]}</div>
            <div class="c-info">
              <div class="c-name">${safeName} ${unread > 0 ? `<span class="unread-badge">${unread}</span>` : ''}</div>
              <div class="c-time">${isOnline ? '在线' : '离线'}</div>
            </div>
          </div>`;
      });
      list.innerHTML = html;
    },

    clearMsgs() {
      const box = document.getElementById('msgList');
      if (box) box.innerHTML = '';
    },

    // 懒加载媒体
    loadRemoteMedia(msgId, fileId, fileName, type) {
        const container = document.getElementById(`media-box-${msgId}`);
        if (!container) return;
        
        // 播放逻辑会返回 URL，同时 SW 会拦截这个 URL 并启动下载任务
        const streamUrl = window.smartCore.play(fileId, fileName);
        const safeName = window.util.escape(fileName);
        
        if (type === 'video') {
            container.innerHTML = `
                 <div style="font-weight:bold;color:#4ea8ff">🎬 ${safeName}</div>
                 <div style="font-size:11px;color:#aaa;margin-bottom:8px">正在加载... (流式直连)</div>
                 
                 <video controls autoplay src="${streamUrl}" 
                        style="width:100%;max-width:300px;background:#000;border-radius:4px"
                        onerror="window.handleVideoError(this, '${safeName}')"></video>
                 
                 <div class="video-error" style="display:none">
                    ❌ 视频加载失败<br><span style="font-size:10px">请查看诊断面板()获取错误码</span>
                 </div>
                 <div style="text-align:right;margin-top:4px">
                     <a href="javascript:void(0)" onclick="window.smartCore.download('${fileId}','${safeName}')" style="color:#aaa;font-size:10px;text-decoration:none">⬇ 保存本地</a>
                 </div>`;
        } else if (type === 'audio') {
            container.innerHTML = `
                 <div style="font-weight:bold;color:#4ea8ff">🎵 ${safeName}</div>
                 <div style="font-size:11px;color:#aaa;margin-bottom:8px">正在加载... (流式音频)</div>
                 <audio controls autoplay src="${streamUrl}" 
                        style="width:100%;max-width:260px;height:40px;margin-top:4px"
                        onerror="window.handleVideoError(this, '${safeName}')"></audio>
                 <div class="video-error" style="display:none">❌ 加载失败</div>
                 <div style="text-align:right;margin-top:4px">
                     <a href="javascript:void(0)" onclick="window.smartCore.download('${fileId}','${safeName}')" style="color:#aaa;font-size:10px;text-decoration:none">⬇ 保存本地</a>
                 </div>`;
        }
    },

    appendMsg(m) {
      const box = document.getElementById('msgList');
      if (!box || !m) return;
      if (document.getElementById('msg-' + m.id)) return;

      const isMe = m.senderId === window.state.myId;
      let content = '', style = '';

      if (m.kind === 'SMART_FILE_UI') {
         const meta = m.meta;
         const sizeStr = (meta.fileSize / (1024*1024)).toFixed(2) + ' MB';
         const isVideo = meta.fileType.startsWith('video');
         const isAudio = meta.fileType.startsWith('audio');
         const isImg = meta.fileType.startsWith('image');
         const safeName = window.util.escape(meta.fileName);
         
         if (isMe && !window.virtualFiles.has(meta.fileId)) {
             content = `
             <div class="file-expired">
                 <div style="font-weight:bold">⚠️ ${safeName}</div>
                 <div>文件句柄已丢失 (页面已刷新/后台释放)</div>
             </div>`;
             style = 'background:transparent;padding:0;border:none';
         } else {
             // 只有图片自动加载，音视频需点击
             if (isImg) {
                 const streamUrl = window.smartCore.play(meta.fileId, meta.fileName);
                 content = `
                 <div class="stream-card">
                     <img src="${streamUrl}" class="chat-img" 
                          style="max-width:200px;border-radius:4px;display:block"
                          onerror="window.handleImageError(this, '${safeName}')">
                     <div style="font-size:10px;color:#aaa;margin-top:4px">${sizeStr}</div>
                 </div>`;
                 style = 'background:transparent;padding:0;border:none';
             } 
             // 视频逻辑：如果是自己发的，直接显示（通常本地有缓存）；如果是别人发的，显示点击加载
             else if (isVideo) {
                 if (isMe) {
                    const streamUrl = window.smartCore.play(meta.fileId, meta.fileName);
                    content = `
                    <div class="stream-card">
                        <div style="font-weight:bold;color:#4ea8ff">🎬 ${safeName}</div>
                        <div style="font-size:11px;color:#aaa;margin-bottom:8px">${sizeStr} (本地预览)</div>
                        <video controls src="${streamUrl}" 
                               style="width:100%;max-width:300px;background:#000;border-radius:4px"
                               onerror="window.handleVideoError(this, '${safeName}')"></video>
                    </div>`;
                 } else {
                    // 接收方：懒加载
                    content = `
                    <div class="stream-card" id="media-box-${m.id}">
                        <div style="font-weight:bold;color:#4ea8ff">🎬 ${safeName}</div>
                        <div style="font-size:11px;color:#aaa;margin-bottom:8px">${sizeStr} (点击播放)</div>
                        <div class="media-cover" onclick="window.ui.loadRemoteMedia('${m.id}', '${meta.fileId}', '${window.util.escape(meta.fileName)}', 'video')">
                            <div class="play-btn-overlay">▶</div>
                        </div>
                        <div style="text-align:right;margin-top:4px">
                            <a href="javascript:void(0)" onclick="window.smartCore.download('${meta.fileId}','${safeName}')" style="color:#aaa;font-size:10px;text-decoration:none">⬇ 保存本地</a>
                        </div>
                    </div>`;
                 }
                 style = 'background:transparent;padding:0;border:none';
             } 
             // 音频逻辑
             else if (isAudio) {
                 if (isMe) {
                    const streamUrl = window.smartCore.play(meta.fileId, meta.fileName);
                    content = `
                    <div class="stream-card">
                        <div style="font-weight:bold;color:#4ea8ff">🎵 ${safeName}</div>
                        <div style="font-size:11px;color:#aaa;margin-bottom:8px">${sizeStr} (本地预览)</div>
                        <audio controls src="${streamUrl}" 
                               style="width:100%;max-width:260px;height:40px;margin-top:4px"
                               onerror="window.handleVideoError(this, '${safeName}')"></audio>
                    </div>`;
                 } else {
                    content = `
                    <div class="stream-card" id="media-box-${m.id}">
                        <div style="font-weight:bold;color:#4ea8ff">🎵 ${safeName}</div>
                        <div style="font-size:11px;color:#aaa;margin-bottom:8px">${sizeStr} (点击播放)</div>
                        <div class="audio-cover" onclick="window.ui.loadRemoteMedia('${m.id}', '${meta.fileId}', '${window.util.escape(meta.fileName)}', 'audio')">
                            <div class="play-btn-overlay" style="width:30px;height:30px;font-size:14px">▶</div>
                            <span style="margin-left:10px;color:#888;font-size:12px">点击加载音频</span>
                        </div>
                        <div style="text-align:right;margin-top:4px">
                            <a href="javascript:void(0)" onclick="window.smartCore.download('${meta.fileId}','${safeName}')" style="color:#aaa;font-size:10px;text-decoration:none">⬇ 保存本地</a>
                        </div>
                    </div>`;
                 }
                 style = 'background:transparent;padding:0;border:none';
             } else {
                 content = `
                 <div class="stream-card">
                     <div style="font-weight:bold;color:#fff">📄 ${safeName}</div>
                     <div style="font-size:11px;color:#aaa;margin:4px 0">${sizeStr}</div>
                     <a href="javascript:void(0)" onclick="window.smartCore.download('${meta.fileId}','${safeName}')"
                        style="display:inline-block;background:#2a7cff;color:white;padding:6px 12px;border-radius:4px;text-decoration:none;font-size:12px;cursor:pointer">
                        ⚡ 极速下载
                     </a>
                 </div>`;
                 style = 'background:transparent;padding:0;border:none';
             }
         }

      } else if (m.kind === CHAT.KIND_IMAGE) {
         content = `<img src="${m.txt}" class="chat-img" style="min-height:50px; background:#222;" onerror="window.handleImageError(this, '普通图片')">`;
         style = 'background:transparent;padding:0';
      } else if (m.kind === 'voice') {
         // [修复] 处理语音类型
         content = `[语音] ${m.txt || '1"'} (react-ui)`;
         style = 'font-style:italic;color:#aaa;';
      } else {
         content = window.util.escape(m.txt);
      }
      
      const html = `
        <div class="msg-row ${isMe ? 'me' : 'other'}" id="msg-${m.id}">
          <div>
            <div class="msg-bubble" style="${style}">${content}</div>
            <div class="msg-meta">${isMe ? '我' : window.util.escape(m.n)} ${new Date(m.ts).toLocaleTimeString()}</div>
          </div>
        </div>`;

      box.insertAdjacentHTML('beforeend', html);
      box.scrollTop = box.scrollHeight;
      
      if (window.uiEvents && window.uiEvents.bindMsgEvents) window.uiEvents.bindMsgEvents();
    },
    
    downloadBlob(data, name) {
        try {
            let url;
            if (typeof data === 'string') {
                if (data.startsWith('data:')) {
                     const a = document.createElement('a');
                     a.href = data;
                     a.download = name;
                     a.click();
                     return;
                }
                const blob = new Blob([data], {type: 'text/plain'});
                url = URL.createObjectURL(blob);
            } else {
                url = URL.createObjectURL(data);
            }
            
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch(e) {
            console.error('Download failed', e);
            alert('下载失败: ' + e.message);
        }
    }
  };
  Object.assign(window.ui, render);
}