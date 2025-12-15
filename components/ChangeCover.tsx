import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ChangeCoverProps {
  onBack: () => void;
}

const ChangeCover: React.FC<ChangeCoverProps> = ({ onBack }) => {
  return (
    <div className="fixed inset-0 bg-[#EDEDED] z-[60] flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="bg-[#EDEDED] h-[56px] flex items-center justify-between px-2 shrink-0 border-b border-gray-300/50">
        <button 
          onClick={onBack}
          className="p-2 -ml-1 text-[#191919] hover:bg-gray-200/50 rounded-full transition-colors flex items-center active:opacity-60"
        >
          <ChevronLeft size={26} strokeWidth={1.5} />
        </button>
        <span className="text-[17px] font-medium text-[#191919]">更换相册封面</span>
        <div className="w-10"></div>
      </div>

      <div className="mt-2 bg-white border-y border-gray-200/50">
         <CoverOption label="从手机相册选择" />
         <CoverOption label="从视频号选择" />
         <CoverOption label="拍一个" />
         <CoverOption label="摄影师作品" />
      </div>
    </div>
  );
};

const CoverOption: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 last:border-0 active:bg-[#DEDEDE] cursor-pointer">
    <span className="text-[17px] text-[#191919]">{label}</span>
    <ChevronRight size={16} className="text-gray-300" />
  </div>
);

export default ChangeCover;