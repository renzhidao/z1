import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  icon?: 'success' | 'loading' | 'none';
  onClose: () => void;
}

export default function Toast({ message, icon, onClose }: ToastProps) {
  useEffect(() => {
    if (icon === 'loading') return;
    const timer = setTimeout(onClose, 2000);
    return () => clearTimeout(timer);
  }, [icon, onClose]);

  if (!message && icon !== 'loading') return null;

  return (
    <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[9999] flex flex-col items-center justify-center">
      <div className="bg-[#4C4C4C] text-white px-8 py-4 rounded-[8px] flex flex-col items-center min-w-[120px] min-h-[120px] justify-center shadow-lg">
        {icon === 'loading' && (
           <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/20 border-t-white mb-3"></div>
        )}
        {icon === 'success' && (
           <div className="mb-3 text-white">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
           </div>
        )}
        <span className="text-[14px]">{message}</span>
      </div>
    </div>
  );
}
