import React, { useEffect } from 'react';
import { Check, Loader2 } from 'lucide-react';

interface ToastProps {
  message: string;
  icon?: 'success' | 'loading' | 'none';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, icon = 'none', onClose }) => {
  useEffect(() => {
    if (icon !== 'loading') {
      const timer = setTimeout(() => {
        onClose();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [message, icon, onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
      <div className="bg-[#4C4C4C] text-white px-6 py-4 rounded-[8px] flex flex-col items-center justify-center min-w-[120px] min-h-[120px] shadow-lg animate-in fade-in zoom-in duration-200">
        {icon === 'success' && <Check size={40} className="mb-3 text-white" />}
        {icon === 'loading' && <Loader2 size={40} className="mb-3 text-white animate-spin" />}
        <span className="text-[16px] font-normal text-center leading-normal">{message}</span>
      </div>
    </div>
  );
};

export default Toast;