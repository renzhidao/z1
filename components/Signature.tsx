import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';

interface SignatureProps {
  onBack: () => void; /* 返回回调 */
}

const Signature: React.FC<SignatureProps> = ({ onBack }) => {
  const [text, setText] = useState('');
  const maxLength = 30;

  return (
    <div className="fixed inset-0 bg-[#EDEDED] z-50 flex flex-col animate-in slide-in-from-right duration-300">
      <div className="bg-[#EDEDED] h-[56px] flex items-center justify-between px-2 shrink-0">
        <button 
          onClick={onBack}
          className="p-2 -ml-1 text-[#191919] hover:bg-gray-200/50 rounded-full transition-colors flex items-center active:opacity-60"
        >
          <ChevronLeft size={26} strokeWidth={1.5} />
        </button>
        <span className="text-[17px] font-medium text-[#191919]">个性签名</span>
        <button 
          onClick={onBack}
          className={`px-3 py-1.5 rounded-[4px] text-[14px] font-medium ${text.length > 0 ? 'bg-[#07C160] text-white active:bg-[#06AD56]' : 'bg-gray-200 text-gray-400'}`}
        >
          保存
        </button>
      </div>

      <div className="p-4 pt-2">
          <div className="relative">
              <input 
                value={text}
                onChange={(e) => setText(e.target.value)} /* 监听输入变化 */
                maxLength={maxLength} /* 最大长度30 */
                className="w-full px-0 py-2 text-[16px] text-[#191919] outline-none bg-transparent border-b border-[#07C160] caret-[#07C160] pb-2"
                autoFocus
              />
              <div className="absolute right-0 -bottom-6 text-[13px] text-gray-400">
                  {maxLength - text.length}
              </div>
          </div>
      </div>
    </div>
  );
};

export default Signature;