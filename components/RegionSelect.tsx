import React from 'react';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';

interface RegionSelectProps {
  onBack: () => void;
}

const RegionSelect: React.FC<RegionSelectProps> = ({ onBack }) => {
  const regions = [
    '安道尔', '中国大陆', '中国香港', '中国澳门', '中国台湾', '阿尔巴尼亚', '阿尔及利亚', '阿富汗', '阿根廷', '阿联酋', '阿鲁巴', '阿曼', '阿塞拜疆'
  ];

  return (
    <div className="fixed inset-0 bg-[#EDEDED] z-50 flex flex-col animate-in slide-in-from-right duration-300">
      <div className="bg-[#EDEDED] h-[56px] flex items-center justify-between px-2 shrink-0 border-b border-gray-300/50">
        <button 
          onClick={onBack}
          className="p-2 -ml-1 text-[#191919] hover:bg-gray-200/50 rounded-full transition-colors flex items-center active:opacity-60"
        >
          <ChevronLeft size={26} strokeWidth={1.5} />
        </button>
        <span className="text-[17px] font-medium text-[#191919]">选择地区</span>
        <div className="w-10"></div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
         <div className="px-4 py-2 text-[14px] text-gray-500 mt-2">当前位置</div>
         <div className="bg-white px-4 py-3 border-y border-gray-200/50 flex items-center gap-2 mb-4">
             <MapPin size={18} className="text-[#07C160]" fill="#07C160" />
             <span className="text-[16px] text-[#191919]">定位中...</span>
         </div>

         <div className="px-4 py-2 text-[14px] text-gray-500">全部地区</div>
         <div className="bg-white border-y border-gray-200/50">
             {regions.map((region, idx) => (
                 <div 
                   key={idx}
                   onClick={onBack}
                   className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 last:border-0 active:bg-[#DEDEDE] cursor-pointer"
                 >
                     <span className="text-[16px] text-[#191919]">{region}</span>
                     {region === '安道尔' && (
                         <div className="flex items-center gap-2">
                             <span className="text-[14px] text-gray-400">已选地区</span>
                             <ChevronRight size={16} className="text-gray-300" />
                         </div>
                     )}
                     {region !== '安道尔' && <ChevronRight size={16} className="text-gray-300" />}
                 </div>
             ))}
         </div>
      </div>
    </div>
  );
};

export default RegionSelect;