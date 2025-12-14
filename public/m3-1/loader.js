const debugBox = document.getElementById('debug-console');
function log(msg, type='ok') {
    if (debugBox) {
        // console.log(msg);
    }
}

// 1. 设置初始状态，供 UI 读取
window.m3_boot_status = "正在初始化加载器...";

// 确定当前模块的基准路径
// 使用 import.meta.url 动态获取当前脚本所在目录，支持相对路径部署
let basePath;
try {
    const selfUrl = new URL(import.meta.url);
    basePath = new URL('.', selfUrl).href;
} catch (e) {
    // Fallback if import.meta fails (unlikely in module)
    basePath = new URL('m3-1/', window.location.href).href;
}

window.m3BaseUrl = basePath;
console.log('🔗 M3 Base Path:', basePath);

// 模块加载列表
const FALLBACK_MODULES = ["monitor", "constants", "utils", "state", "db", "protocol", "smart-core", "p2p", "hub", "mqtt", "ui-render", "ui-events"];

// SW Registration
async function ensureServiceWorkerControl() {
    window.m3_boot_status = "正在注册 Service Worker...";
    if (!('serviceWorker' in navigator)) return true;

    try {
        const swUrl = new URL('sw.js', basePath).href;
        const reg = await navigator.serviceWorker.register(swUrl, { scope: basePath });
        // Don't wait indefinitely for ready in case of issues, just proceed
        // await navigator.serviceWorker.ready; 
        return true;
    } catch (err) {
        // Ignore errors in environments that don't support SW or restricted
        console.warn('⚠️ SW Init Failed/Skipped:', err.message);
        return true; 
    }
}

async function boot() {
    const ok = await ensureServiceWorkerControl();
    if (!ok) return;

    // 1. 加载配置
    window.m3_boot_status = "正在加载配置 config.json...";
    try {
        const configUrl = new URL('config.json', basePath).href;
        const cfg = await fetch(configUrl).then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
        });
        window.config = cfg;
    } catch (e) {
        console.warn('❌ Config Load Failed (using default):', e);
        window.m3_boot_status = "配置加载失败，使用默认设置...";
        // Fallback config
        window.config = {
            peer: { config: { iceServers: [{"urls": "stun:stun.l.google.com:19302"}] } },
            mqtt: { broker: "broker.emqx.io", port: 8084, path: "/mqtt", topic: "p1-chat/fallback" },
            hub: { prefix: "p1-hub-", count: 2 },
            params: { loop_interval: 1000 }
        };
    }

    // 2. 获取模块列表
    window.m3_boot_status = "正在获取模块列表...";
    let modules = [];
    try {
        const regUrl = new URL('registry.txt?t=' + Date.now(), basePath).href;
        const res = await fetch(regUrl);
        if (res.ok) {
            const text = await res.text();
            modules = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
        } else {
            throw new Error('404');
        }
    } catch (e) {
        console.warn('Loader: Registry fallback.');
        modules = FALLBACK_MODULES;
    }

    // 3. 逐个加载模块
    for (const mod of modules) {
        window.m3_boot_status = `正在加载模块: ${mod}...`;
        const path = new URL(`./modules/${mod}.js`, basePath).href;
        try {
            const m = await import(path);
            if (m.init) {
                m.init();
            }
        } catch (e) {
            console.error(`❌ Module failed: ${mod}`, e);
            window.m3_boot_status = `模块 ${mod} 加载失败: ${e.message}`;
            await new Promise(r => setTimeout(r, 500)); // Show error briefly
        }
    }

    // 4. 启动新核心 (app.js)
    window.m3_boot_status = "正在启动核心 app.js...";
    setTimeout(async () => {
        try {
            const appUrl = new URL('./app.js', basePath).href;
            const main = await import(appUrl);
            if (main.init) {
                main.init();
                console.log('🚀 System Booting...');
                window.m3_boot_status = "系统启动中...";
            }
        } catch (e) {
            console.error('Failed to load app.js', e);
            window.m3_boot_status = `核心启动失败: ${e.message}`;
        }
    }, 100);
}

window.onerror = function (msg, url, line) {
    console.error(`Global Error: ${msg} @ ${url}:${line}`);
    window.m3_boot_status = `错误: ${msg}`;
};

boot();

export { boot };