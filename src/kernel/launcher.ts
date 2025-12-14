
// Kernel Launcher
// Replaces m1/loader.js and m1/app.js structure
import * as Constants from './modules/constants';
import * as Utils from './modules/utils';
import * as State from './modules/state';
import * as DB from './modules/db';
import * as Protocol from './modules/protocol';
import * as SmartCore from './modules/smart-core';
import * as P2P from './modules/p2p';
import * as MQTT from './modules/mqtt';
import * as Hub from './modules/hub';
import * as Monitor from './modules/monitor';

export async function initKernel() {
    console.log('🚀 Kernel: Booting...');
    
    // 1. Load Config
    try {
        // Fix: Use relative path './config.json' instead of absolute '/config.json'
        // This is crucial for GitHub Pages or any sub-path deployment.
        window.config = await fetch('./config.json').then(r => r.json());
    } catch(e) {
        console.error('Kernel: Config Load Failed', e);
        window.config = { peer: {}, mqtt: {} }; 
    }

    // 2. Initialize Modules (Order matters)
    Monitor.init();
    State.init(); // Initialize global window.state
    Utils.init(); // Initialize logging and utils
    DB.init();    // Initialize IndexedDB
    
    // 3. App Core Logic (ported from app.js)
    window.app = {
        async init() {
            window.util.log(`正在启动 P1 Core...`);
            
            // Basic Init
            await window.util.syncTime();
            localStorage.setItem('p1_my_id', window.state.myId);
            await window.db.init();

            // Init Networking Modules
            Protocol.init();
            SmartCore.init();
            P2P.init();
            MQTT.init();
            Hub.init();

            // Load History
            this.loadHistory(500);

            // Start Networking
            if (window.p2p) window.p2p.start();
            if (window.mqtt) window.mqtt.start();

            // Check SW
            if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ type: 'PING' });
            }

            // Start Loop
            // @ts-ignore
            this.loopTimer = setInterval(() => this.loop(), Constants.NET_PARAMS.LOOP_INTERVAL);
            
            // Patrol Check
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

        async loadHistory(limit: number) {
            if (window.state.loading) return;
            window.state.loading = true;
            const msgs = await window.db.getRecent(limit, window.state.activeChat, window.state.oldestTs);
            if (msgs && msgs.length > 0) {
               window.state.oldestTs = msgs[0].ts;
               msgs.forEach((m: any) => {
                  window.state.seenMsgs.add(m.id);
                  if (window.ui) window.ui.appendMsg(m);
               });
            }
            window.state.loading = false;
        }
    };

    // Ignite
    window.app.init();
    console.log('🚀 Kernel: Online');
}
