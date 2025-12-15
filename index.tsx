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
  root.render(
    <div className="flex h-screen w-full items-center justify-center bg-[#EDEDED] text-gray-500">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-[#07C160] border-t-transparent rounded-full animate-spin"></div>
        <span>正在启动微信核心...</span>
      </div>
    </div>
  );
  
  window.addEventListener('core-ready', mount);
}
