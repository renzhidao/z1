import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// ---- SW bootstrap (v2025-12-16-fix5) ----
try {
  if ('serviceWorker' in navigator) {
    const __key = 'p1_sw_reloaded_once';

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      try {
        if (!sessionStorage.getItem(__key)) {
          sessionStorage.setItem(__key, '1');
          location.reload();
        }
      } catch (_) {}
    });

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
} catch (_) {}
// ---- /SW bootstrap ----

const root = ReactDOM.createRoot(rootElement);

function mount() {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// Boot Blocking: Wait for Core
if ((window as any).__CORE_READY__) {
  mount();
} else {
  // Render loading screen
  const LoadingScreen: React.FC = () => {
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
      if ((window as any).__CORE_ERROR__) {
        setError((window as any).__CORE_ERROR__);
      }

      const errorHandler = () => {
        setError((window as any).__CORE_ERROR__ || 'Unknown Error');
      };
      window.addEventListener('core-error', errorHandler);
      return () => window.removeEventListener('core-error', errorHandler);
    }, []);

    if (error) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-[#EDEDED] text-gray-500 p-4">
          <div className="flex flex-col items-center gap-4 max-w-md text-center">
            <div className="w-12 h-12 bg-[#FA5151] rounded-full flex items-center justify-center text-white text-2xl">!</div>
            <h2 className="text-lg font-bold text-[#191919]">核心启动失败</h2>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-red-100 w-full text-left">
              <p className="text-xs text-red-500 font-mono break-all">{error}</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-[#07C160] text-white rounded-lg active:opacity-80"
            >
              重试
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#EDEDED] text-gray-500">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-[#07C160] border-t-transparent rounded-full animate-spin"></div>
          <span>正在启动微信核心...</span>
        </div>
      </div>
    );
  };

  root.render(<LoadingScreen />);

  window.addEventListener('core-ready', () => {
    mount();
  });
}

/* __P1_LOGSYSTEM_BOOT__ */
(function(){
  try{
    const w = window;
    if (w.__p1_logsystem_booted) return;
    w.__p1_logsystem_booted = true;

    const sys = w.logSystem = w.logSystem || {};
    sys.history = Array.isArray(sys.history) ? sys.history : [];
    sys.fullHistory = Array.isArray(sys.fullHistory) ? sys.fullHistory : [];
    sys.max = (typeof sys.max === 'number') ? sys.max : 600;
    sys.maxFull = (typeof sys.maxFull === 'number') ? sys.maxFull : 6000;

    let inPush = false;
    const pushLine = (line) => {
      try{
        if (inPush) return;
        inPush = true;
        const s = String(line || '');
        if (!s) return;
        sys.fullHistory.push(s);
        sys.history.push(s);
        if (sys.history.length > sys.max) sys.history = sys.history.slice(sys.history.length - sys.max);
        if (sys.fullHistory.length > sys.maxFull) sys.fullHistory = sys.fullHistory.slice(sys.fullHistory.length - sys.maxFull);
      } finally {
        inPush = false;
      }
    };

    sys.push = sys.push || pushLine;
    sys.clear = sys.clear || (() => { sys.history = []; sys.fullHistory = []; });

    // patch util.log (很多 core 日志走这里)
    w.util = w.util || {};
    const oldUtilLog = w.util.log;
    w.util.log = (msg) => {
      try{
        const ts = new Date().toLocaleTimeString();
        sys.push(`[${ts}] [util] ${String(msg||'')}`);
      }catch(_){}
      try{ if (typeof oldUtilLog === 'function') oldUtilLog(msg); }catch(_){}
    };

    // capture console to log panel (避免漏掉模块日志)
    const orig = {
      log: console.log.bind(console),
      info: console.info ? console.info.bind(console) : console.log.bind(console),
      warn: console.warn ? console.warn.bind(console) : console.log.bind(console),
      error: console.error ? console.error.bind(console) : console.log.bind(console),
    };

    ['log','info','warn','error'].forEach((k) => {
      const fn = orig[k];
      console[k] = (...args) => {
        try{
          const ts = new Date().toLocaleTimeString();
          const text = args.map(a => {
            try { return (typeof a === 'string') ? a : JSON.stringify(a); }
            catch(_) { return String(a); }
          }).join(' ');
          sys.push(`[${ts}] [${k}] ${text}`);
        }catch(_){}
        try{ fn(...args); }catch(_){}
      };
    });
  }catch(_){}
})();

