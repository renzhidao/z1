import { CHAT, UI_CONFIG } from './constants.js';

export function init() {
  console.log('📦 加载模块: UI Render (React Bridge Mode)');
  window.ui = window.ui || {};
  
  // 派发事件辅助函数
  const dispatch = (name, detail) => {
      window.dispatchEvent(new CustomEvent(name, { detail }));
  };

  const render = {
    init() { 
        // React 模式下，不需要渲染 HTML 列表，只需要通知数据更新
        this.renderList(); 
        this.updateSelf(); 
    },

    updateSelf() {
      // 通知 React 更新 "我" 的状态
      dispatch('m3-self-update', {
          id: window.state.myId,
          name: window.state.myName,
          mqttStatus: window.state.mqttStatus,
          onlineCount: Object.keys(window.state.conns).filter(k => window.state.conns[k].open).length
      });
    },

    renderList() {
      // 通知 React 更新联系人/聊天列表
      dispatch('m3-list-update');
    },

    clearMsgs() {
      // React 会处理清除，这里无需操作 DOM
    },

    loadRemoteMedia(msgId, fileId, fileName, type) {
        // 媒体加载逻辑保留，因为它是通过 DOM ID 查找占位符。
        // 在 React 中，我们需要稍作修改，或者让 React 直接调用 smartCore.play
        // 这里保留是为了兼容性，但 React 端主要通过 smartCore 直接获取 URL
    },

    appendMsg(m) {
      // 通知 React 有新消息
      // 注意：React 通常会监听数据库或网络事件，但这个钩子对于实时消息很有用
      dispatch('m3-msg-incoming', m);
    },
    
    downloadBlob(data, name) {
        // 通用下载逻辑保留
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