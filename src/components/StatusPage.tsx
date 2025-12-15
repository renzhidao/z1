import React from 'react';

interface StatusPageProps {
  onClose: () => void;
}

const StatusPage: React.FC<StatusPageProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center text-white bg-gradient-to-br from-[#AFBB78] to-[#99AC5D] animate-in fade-in duration-300">
      <div className="flex-1 flex flex-col items-center justify-center pb-20">
        <h1 className="text-[24px] font-medium mb-3">设个状态</h1>
        <p className="text-[17px] opacity-90">朋友24小时内可见</p>
      </div>
      
      <div className="pb-safe-bottom mb-16 w-full px-12">
        <button 
          onClick={onClose}
          className="w-full py-3 bg-white/20 backdrop-blur-md rounded-[8px] text-[17px] font-medium active:bg-white/30 transition-colors"
        >
          我知道了
        </button>
      </div>
    </div>
  );
};

export default StatusPage;