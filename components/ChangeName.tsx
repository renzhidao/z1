
import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';

interface ChangeNameProps {
  onBack: () => void;
  initialName: string;
  onSave: (name: string) => void;
}

const ChangeName: React.FC<ChangeNameProps> = ({ onBack, initialName, onSave }) => {
  const [name, setName] = useState(initialName);

  return (
    <div className="fixed inset-0 bg-[#EDEDED] z-50 flex flex-col animate-in slide-in-from-right duration-300">
      <div className="bg-[#EDEDED] h-[56px] flex items-center justify-between px-2 shrink-0">
        <button 
          onClick={onBack}
          className="p-2 -ml-1 text-[#191919] hover:bg-gray-200/50 rounded-full transition-colors flex items-center active:opacity-60"
        >
          <ChevronLeft size={26} strokeWidth={1.5} />
        </button>
        <span className="text-[17px] font-medium text-[#191919]">更改名字</span>
        <button 
          onClick={() => { if(name.trim()) onSave(name); }}
          className={`px-3 py-1.5 rounded-[4px] text-[14px] font-medium transition-colors ${name.trim() ? 'bg-[#07C160] text-white active:bg-[#06AD56]' : 'bg-gray-200 text-gray-400'}`}
          disabled={!name.trim()}
        >
          保存
        </button>
      </div>

      <div className="p-4 pt-2">
          {/* Custom Input container with green bottom border simulation */}
          <div className="bg-transparent px-0 py-0 border-b border-[#07C160]">
              <input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-2 py-3 text-[16px] text-[#191919] outline-none bg-transparent caret-[#07C160]"
                autoFocus
                placeholder="好名字更容易被记住"
              />
          </div>
          <div className="text-[13px] text-gray-400 mt-2 px-2">
              好名字可以让你的 P2P 朋友更容易记住你。
          </div>
      </div>
    </div>
  );
};

export default ChangeName;
