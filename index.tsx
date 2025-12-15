import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

function mount() {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// Boot Blocking: Wait for Core
if (window.__CORE_READY__) {
  mount();
} else {
  // Render loading screen
  const LoadingScreen = () => {
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
                <button onClick={() => window.location.reload()} className="px-6 py-2 bg-[#07C160] text-white rounded-lg active:opacity-80">
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
  
  window.addEventListener('core-ready', mount);
}
