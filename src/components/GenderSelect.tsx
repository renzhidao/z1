import React, { useState } from 'react';
import { ChevronLeft, Check } from 'lucide-react';

interface GenderSelectProps {
  onBack: () => void;
  initialGender?: string;
}

const GenderSelect: React.FC<GenderSelectProps> = ({ onBack, initialGender = '男' }) => {
  const [selected, setSelected] = useState(initialGender);

  return (
    <div className="fixed inset-0 bg-[#EDEDED] z-50 flex flex-col animate-in slide-in-from-right duration-300">
      <div className="bg-[#EDEDED] h-[56px] flex items-center justify-between px-2 shrink-0 border-b border-gray-300/50">
        <button 
          onClick={onBack}
          className="p-2 -ml-1 text-[#191919] hover:bg-gray-200/50 rounded-full transition-colors flex items-center active:opacity-60"
        >
          <ChevronLeft size={26} strokeWidth={1.5} />
        </button>
        <span className="text-[17px] font-medium text-[#191919]">设置性别</span>
        <button 
          onClick={onBack}
          className="px-3 py-1.5 bg-[#07C160] text-white rounded-[4px] text-[14px] font-medium active:bg-[#06AD56]"
        >
          完成
        </button>
      </div>

      <div className="mt-2 bg-white border-y border-gray-200/50">
          {['男', '女'].map((gender) => (
              <div 
                key={gender}
                onClick={() => setSelected(gender)}
                className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 last:border-0 active:bg-[#DEDEDE] cursor-pointer"
              >
                  <span className="text-[16px] text-[#191919]">{gender}</span>
                  {selected === gender && <Check size={20} className="text-[#07C160]" strokeWidth={2.5} />}
              </div>
          ))}
      </div>
    </div>
  );
};

export default GenderSelect;