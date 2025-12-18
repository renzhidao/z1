import React, { useEffect, useState, useRef } from 'react';
import { X, Copy, Trash2 } from 'lucide-react';

interface LogConsoleProps {
  onClose: () => void;
}

const LogConsole: React.FC<LogConsoleProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

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

  // Scroll follow: 只有当你在底部时才自动跟随；你滚上去就不抢滚动
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const onScroll = () => {
      try {
        const nearBottom = (el.scrollHeight - el.scrollTop - el.clientHeight) < 24;
        stickToBottomRef.current = !!nearBottom;
      } catch (_) {}
    };

    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (!stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [logs]);

  const fallbackCopyByTextarea = (text: string) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;

      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';

      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        textarea.setSelectionRange(0, textarea.value.length);
      } catch (_) {}

      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch (_) {
      return false;
    }
  };

  const safeCopyText = async (text: string) => {
    try {
      if (!text) return false;

      try {
        if (!document.hasFocus() && typeof window.focus === 'function') window.focus();
      } catch (_) {}

      const canClipboardApi =
        typeof navigator !== 'undefined' &&
        !!navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function' &&
        typeof window !== 'undefined' &&
        // Clipboard API 通常要求安全上下文；不满足就直接走兜底
        // @ts-ignore
        !!window.isSecureContext;

      if (canClipboardApi && document.hasFocus()) {
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch (_) {
          // 典型：NotAllowedError: Document is not focused / 权限被拒绝
          // 继续走兜底
        }
      }

      return fallbackCopyByTextarea(text);
    } catch (_) {
      return false;
    }
  };

  const handleCopy = async () => {
    // @ts-ignore
    const full = Array.isArray(window.logSystem?.fullHistory) ? window.logSystem.fullHistory : null;
    const text = (full && full.length ? full.join('\n') : (logs || []).join('\n')) || '';

    const ok = await safeCopyText(text);
    if (ok) alert('日志已复制');
    else alert('复制失败：请确保页面处于前台后重试（或手动选择文本复制）');
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
