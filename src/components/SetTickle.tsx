import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';

interface SetTickleProps {
  onBack: () => void;
}

const SetTickle: React.FC<SetTickleProps> = ({ onBack }) => {
  const [value, setValue] = useState('');

  return (
    <div className="fixed inset-0 bg-[#EDEDED] z-50 flex flex-col animate-in slide-in-from-right duration-300">
      <div className="bg-[#EDEDED] h-[56px] flex items-center justify-between px-2 shrink-0 border-b border-gray-300/50">
        <button 
          onClick={onBack}
          className="p-2 -ml-1 text-[#191919] hover:bg-gray-200/50 rounded-full transition-colors flex items-center active:opacity-60"
        >
          <ChevronLeft size={26} strokeWidth={1.5} />
        </button>
        <span className="text-[17px] font-medium text-[#191919]">设置拍一拍</span>
        <div className="w-10"></div>
      </div>

      <div className="p-4 pt-6">
         <div className="text-[14px] text-[#191919] mb-3 ml-1">朋友拍了拍我</div>
         <div className="bg-white rounded-[6px] px-3 py-3 mb-2 flex items-center">
             <input 
               value={value}
               onChange={(e) => setValue(e.target.value)}
               className="flex-1 text-[17px] outline-none bg-transparent caret-[#07C160]"
               placeholder="输入后缀"
               autoFocus
             />
         </div>
         <div className="text-[13px] text-gray-400 ml-1">
             朋友拍你的时候将出现
         </div>
         
         <div className="mt-8 px-1">
             <button 
                onClick={onBack}
                className="w-full bg-[#EDEDED] text-gray-400 py-3 rounded-[8px] text-[17px] font-medium border border-gray-200/50 active:bg-gray-200"
             >
                 完成
             </button>
         </div>
      </div>
    </div>
  );
};

export default SetTickle;