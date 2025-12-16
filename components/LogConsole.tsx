import React, { useEffect, useState, useRef } from 'react';
import { X, Copy, Trash2, RefreshCw } from 'lucide-react';

interface LogConsoleProps {
  onClose: () => void;
}

const LogConsole: React.FC<LogConsoleProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchLogs = () => {
      // @ts-ignore
      if (window.logSystem && window.logSystem.history) {
        // @ts-ignore
        setLogs([...window.logSystem.history]);
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto scroll
  useEffect(() => {
    if (contentRef.current) {
        contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [logs]);

  const handleCopy = () => {
    // @ts-ignore
    const text = window.logSystem?.fullHistory?.join('\n') || logs.join('\n');
    navigator.clipboard.writeText(text).then(() => alert('日志已复制'));
  };

  const handleClear = () => {
    // @ts-ignore
    if (window.logSystem) window.logSystem.clear();
    setLogs([]);
  };

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none flex flex-col justify-end items-end p-4">
      <div className="w-full max-w-lg h-1/2 bg-black/90 text-green-400 font-mono text-[11px] rounded-lg shadow-2xl flex flex-col pointer-events-auto border border-gray-700 backdrop-blur-md">
        
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 bg-gray-900/50 rounded-t-lg">
          <div className="flex items-center gap-2">
             <span className="text-white font-bold">系统日志</span>
             <span className="text-gray-500">{logs.length} 条</span>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCopy} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white" title="复制">
              <Copy size={14} />
            </button>
            <button onClick={handleClear} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white" title="清空">
              <Trash2 size={14} />
            </button>
            <button onClick={onClose} className="p-1 hover:bg-red-900/50 rounded text-gray-400 hover:text-red-400" title="关闭">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto p-3 space-y-1 select-text scroll-smooth">
           {logs.length === 0 && <div className="text-gray-600 italic">暂无日志...</div>}
           {logs.map((log, i) => (
             <div key={i} className="break-all whitespace-pre-wrap border-b border-gray-800/30 pb-0.5 mb-0.5">
               {log}
             </div>
           ))}
        </div>
      </div>
    </div>
  );
};

export default LogConsole;