import React, { useState, useEffect } from 'react';
import { ChevronLeft, Settings } from 'lucide-react';

interface ShakeProps {
  onBack: () => void;
}

const Shake: React.FC<ShakeProps> = ({ onBack }) => {
  const [isShaking, setIsShaking] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const handleShake = () => {
    if (isShaking) return;
    setIsShaking(true);
    setShowResult(false);

    // Mock shake duration
    setTimeout(() => {
      setIsShaking(false);
      // Show result slightly after shake stops
      setTimeout(() => setShowResult(true), 500);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 bg-[#2C2C2C] z-50 flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 h-[56px] flex items-center justify-between px-2 pt-safe-top z-20">
        <button 
          onClick={onBack}
          className="p-2 -ml-1 text-white/90 hover:bg-white/10 rounded-full transition-colors flex items-center active:opacity-60"
        >
          <ChevronLeft size={28} strokeWidth={1.5} />
          <span className="text-[17px] font-normal ml-[-4px]">发现</span>
        </button>
        <span className="text-[17px] font-medium text-white">摇一摇</span>
        <button className="p-2 text-white/90 hover:bg-white/10 rounded-full active:opacity-60">
          <Settings size={24} strokeWidth={1.5} />
        </button>
      </div>

      {/* Main Content */}
      <div 
        className="flex-1 flex flex-col items-center justify-center relative overflow-hidden cursor-pointer"
        onClick={handleShake}
      >
         {/* Shake Icon - Hand Holding Phone */}
         <div className="relative w-[150px] h-[150px]">
             {/* Top Half */}
             <div 
               className={`absolute top-0 left-0 w-full h-1/2 overflow-hidden transition-transform duration-500 ease-in-out ${isShaking ? '-translate-y-[60px]' : 'translate-y-0'}`}
             >
                <ShakeIconHalf isTop={true} />
             </div>
             
             {/* Bottom Half */}
             <div 
                className={`absolute bottom-0 left-0 w-full h-1/2 overflow-hidden transition-transform duration-500 ease-in-out ${isShaking ? 'translate-y-[60px]' : 'translate-y-0'}`}
             >
                <ShakeIconHalf isTop={false} />
             </div>

             {/* Center Hidden Content (Revealed during shake) */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center opacity-0 transition-opacity duration-300" style={{ opacity: isShaking ? 1 : 0 }}>
                {/* Visual cue for sound/background */}
                <div className="w-full h-full bg-white/20 rounded-full animate-ping"></div>
             </div>
         </div>
      </div>

      {/* Bottom Tabs */}
      <div className="h-[100px] flex items-center justify-center gap-12 pb-safe-bottom">
         <div className="flex flex-col items-center gap-2 opacity-100">
             <div className="w-12 h-12 bg-[#07C160] rounded-full flex items-center justify-center">
                 <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/><path d="M12 6a1 1 0 0 0-1 1v4H7a1 1 0 0 0 0 2h4v4a1 1 0 0 0 2 0v-4h4a1 1 0 0 0 0-2h-4V7a1 1 0 0 0-1-1z"/></svg>
             </div>
             <span className="text-[12px] text-white">人</span>
         </div>
         <div className="flex flex-col items-center gap-2 opacity-50">
             <div className="w-12 h-12 bg-transparent border border-white/30 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">♫</span>
             </div>
             <span className="text-[12px] text-white">歌曲</span>
         </div>
      </div>

      {/* Result Card */}
      {showResult && (
        <div className="absolute bottom-[120px] left-4 right-4 bg-white rounded-[6px] p-3 flex items-center justify-between animate-in slide-in-from-bottom duration-300 shadow-xl">
           <div className="flex items-center">
             <img src="https://picsum.photos/seed/shake/200/200" className="w-10 h-10 rounded-[4px] bg-gray-200 mr-3" />
             <div>
               <div className="text-[16px] text-black font-medium">一位有缘人</div>
               <div className="text-[12px] text-gray-500">距离 100 米</div>
             </div>
           </div>
           <button className="text-[14px] text-[#576B95] font-medium px-2">打招呼</button>
           <button 
             onClick={(e) => { e.stopPropagation(); setShowResult(false); }}
             className="absolute -top-2 -right-2 w-6 h-6 bg-gray-400 rounded-full text-white flex items-center justify-center border-2 border-[#2C2C2C]"
           >
             ×
           </button>
        </div>
      )}
    </div>
  );
};

const ShakeIconHalf: React.FC<{ isTop: boolean }> = ({ isTop }) => (
    <div className={`w-[150px] h-[150px] bg-[#2C2C2C] flex items-center justify-center ${isTop ? 'translate-y-0' : '-translate-y-1/2'}`}>
        {/* We emulate the icon with SVG logic inside a container that gets clipped */}
        <svg width="120" height="120" viewBox="0 0 24 24" fill="#E0E0E0">
            <path d="M17 2H7C5.3 2 4 3.3 4 5v14c0 1.7 1.3 3 3 3h10c1.7 0 3-1.3 3-3V5c0-1.7-1.3-3-3-3zm-5 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
        </svg>
    </div>
);

export default Shake;