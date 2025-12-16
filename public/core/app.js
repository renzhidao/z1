import { NET_PARAMS, CHAT, APP_VERSION } from './modules/constants.js';

export function init() {
  console.log(`🚀 启动主程序: App Core v${APP_VERSION}`);

  window.app = {
    async waitForSW() {
      if (!('serviceWorker' in navigator)) return true;

      try {
        // 关键修复：这里必须主动 register + 等待 ready，否则很多“壳页面”不会运行 core/loader.js 的 ensure
        const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
        try { window.util && window.util.log && window.util.log(`✅ SW Registered: ${reg && reg.scope ? reg.scope : ''}`); } catch (_) {}

        // 等待 SW 激活
        try { await navigator.serviceWorker.ready; } catch (_) {}

        // 已接管就结束
        if (navigator.serviceWorker.controller) return true;

        // 等 controllerchange
        try { window.util && window.util.log && window.util.log('⏳ 等待 SW 接管页面...'); } catch (_) {}
        const controlled = await new Promise(resolve => {
          const onChange = () => resolve(true);
          try { navigator.serviceWorker.addEventListener('controllerchange', onChange, { once: true }); } catch (_) {}
          setTimeout(() => resolve(false), 5000);
        });

        if (controlled && navigator.serviceWorker.controller) return true;

        // 仍未接管：强制刷新一次（防止永远 404 /virtual/file/）
        try {
          const k = '__sw_force_reload_once__';
          if (!sessionStorage.getItem(k)) {
            sessionStorage.setItem(k, '1');
            try { window.util && window.util.log && window.util.log('🔁 SW 未接管，执行一次强制刷新'); } catch (_) {}
            location.reload();
            return false; // 阻止继续启动
          }
        } catch (_) {}

        return true;
      } catch (err) {
        try {
          const msg = (err && err.message) ? err.message : String(err);
          window.util && window.util.log && window.util.log('❌ SW 注册失败: ' + msg);
        } catch (_) {}
        return true; // 不阻塞启动（但虚拟流可能不可用）
      }
    },

    async init() {
      window.util.log(`正在启动 P1 v${APP_VERSION}...`);

      await window.util.syncTime();
      localStorage.setItem('p1_my_id', window.state.myId);
      await window.db.init();

      if (window.ui && window.ui.init) window.ui.init();
      if (window.uiEvents && window.uiEvents.init) window.uiEvents.init();

      // 修复：必须先恢复文件元数据，再渲染UI，防止历史图片/视频报404
      if (window.smartCore && window.smartCore.initMeta) await window.smartCore.initMeta();

      const swOk = await this.waitForSW();
      if (swOk === false) return;

      this.loadHistory(20);

      // 启动时并发：P2P 和 MQTT 同时开始连接，不互相等待
      if (window.p2p) window.p2p.start();
      if (window.mqtt) window.mqtt.start();

      // 主动握手 SW（只有在被接管后才发）
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        try { navigator.serviceWorker.controller.postMessage({ type: 'PING' }); } catch (_) {}
      }

      this.loopTimer = setInterval(() => this.loop(), NET_PARAMS.LOOP_INTERVAL);
      this.bindLifecycle();

      setTimeout(() => {
        if (!window.state.isHub && Object.keys(window.state.conns).length < 1) {
          if (window.state.mqttStatus === '在线') {
            if (window.p2p) window.p2p.patrolHubs();
          } else {
            if (window.hub) window.hub.connectToAnyHub();
          }
        }
      }, 2000);
    },

    bindLifecycle() {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          window.util.log(' 应用切入后台 (跟随浏览器自动挂起)...');
        } else {
          window.util.log('☀️ 应用切回前台 (并发重连)...');
          if (!this.loopTimer) {
            this.loopTimer = setInterval(() => this.loop(), NET_PARAMS.LOOP_INTERVAL);
          }
          if (window.p2p) {
            if (!window.state.peer || window.state.peer.destroyed || window.state.peer.disconnected) {
              window.util.log('🔧 P2P 失效，立即重启');
              window.p2p.start();
            } else {
              window.p2p.maintenance();
              window.p2p.patrolHubs();
            }
          }
          if (window.mqtt) {
            if (!window.state.mqttClient || !window.state.mqttClient.isConnected()) {
              window.util.log('🔧 MQTT 断开，立即重连');
              window.mqtt.start();
            } else {
              window.mqtt.sendPresence();
            }
          }
        }
        window.util.syncTime();
      });
    },

    loop() {
      if (document.hidden) return;

      if (window.p2p) window.p2p.maintenance();
      if (window.protocol) window.protocol.retryPending();

      if (!window.state.isHub && window.state.mqttStatus === '在线') {
        if (window.p2p) window.p2p.patrolHubs();
      } else if (!window.state.isHub && window.state.mqttStatus !== '在线') {
        if (window.hub) window.hub.connectToAnyHub();
      }
    },

    async loadHistory(limit) {
      if (window.state.loading) return;
      window.state.loading = true;

      const msgs = await window.db.getRecent(limit, window.state.activeChat, window.state.oldestTs);

      if (msgs && msgs.length > 0) {
        window.state.oldestTs = msgs[0].ts;
        msgs.forEach(m => {
          window.state.seenMsgs.add(m.id);
          if (window.ui) window.ui.appendMsg(m);
        });
      }
      window.state.loading = false;
    }
  };

  window.app.init();
}
