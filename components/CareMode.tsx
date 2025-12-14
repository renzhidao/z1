import React from 'react';
import { ChevronLeft } from 'lucide-react';

interface CareModeProps {
  onBack: () => void;
}

const CareMode: React.FC<CareModeProps> = ({ onBack }) => {
  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col animate-in slide-in-from-right duration-300">
      <div className="h-[56px] flex items-center px-2 shrink-0">
        <button 
          onClick={onBack}
          className="p-2 -ml-1 text-[#191919] hover:bg-gray-200/50 rounded-full transition-colors active:opacity-60"
        >
          <ChevronLeft size={26} strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center pt-10 px-8">
         <div className="w-20 h-20 mb-6">
            {/* Custom Hands/Heart Icon */}
            <svg viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                <path d="M12 7v5" stroke="white" strokeWidth="2"/>
                <path d="M9.5 9.5L12 12l2.5-2.5" stroke="white" strokeWidth="2"/>
            </svg>
         </div>
         
         <h2 className="text-[22px] font-medium text-[#191919] mb-8">关怀模式</h2>
         
         <div className="w-full flex flex-col items-center space-y-4">
             <div className="text-[17px] text-[#191919] font-normal text-center">
                 开启「关怀模式」后，可选择以下功能：
             </div>
             <div className="text-[16px] text-gray-500 text-center space-y-2">
                 <p>文字更大，色彩更强，按钮更大</p>
                 <p>听聊天中的文字消息</p>
                 <p>安静模式，避免声音外放打扰</p>
             </div>
         </div>

         <div className="mt-auto pb-16 w-full">
             <button className="w-full bg-[#07C160] text-white py-3 rounded-[8px] text-[17px] font-medium active:bg-[#06AD56]">
                 开启
             </button>
         </div>
      </div>
    </div>
  );
};

export default CareMode;