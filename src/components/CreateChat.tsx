import React, { useState } from 'react';
import { ChevronLeft, Search } from 'lucide-react';
import { User } from '../types';

interface CreateChatProps {
  onBack: () => void;
  contacts: { letter: string; contacts: { name: string; avatar: string }[] }[];
}

const CreateChat: React.FC<CreateChatProps> = ({ onBack, contacts }) => {
  const [selected, setSelected] = useState<string[]>([]);

  const toggleSelect = (name: string) => {
    if (selected.includes(name)) {
      setSelected(selected.filter(n => n !== name));
    } else {
      setSelected([...selected, name]);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#EDEDED] z-50 flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="bg-[#EDEDED] h-[56px] flex items-center justify-between px-2 shrink-0 border-b border-gray-300/50">
        <button 
          onClick={onBack}
          className="p-2 -ml-1 text-[#191919] hover:bg-gray-200/50 rounded-full transition-colors flex items-center active:opacity-60"
        >
          <ChevronLeft size={26} strokeWidth={1.5} />
        </button>
        <span className="text-[17px] font-medium">发起群聊</span>
        <button 
           className={`px-3 py-1.5 rounded-[4px] text-[15px] font-medium transition-colors ${selected.length > 0 ? 'bg-[#07C160] text-white' : 'bg-gray-200 text-gray-400'}`}
        >
          完成{selected.length > 0 ? `(${selected.length})` : ''}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar relative">
        {/* Search Bar */}
        <div className="px-2 py-2 bg-[#EDEDED]">
            <div className="bg-white rounded-[6px] h-9 flex items-center px-3 text-gray-400">
                <Search size={18} className="mr-2" />
                <span className="text-[16px]">搜索</span>
            </div>
        </div>

        <div className="bg-white border-y border-gray-200/50 mb-0">
           <div className="px-4 py-3 text-[17px] text-[#191919] border-b border-gray-100 active:bg-[#DEDEDE]">选择一个已有的群</div>
           <div className="px-4 py-3 text-[17px] text-[#191919] border-b border-gray-100 active:bg-[#DEDEDE]">面对面建群</div>
           <div className="px-4 py-3 text-[17px] text-[#191919] active:bg-[#DEDEDE]">选择群聊中的朋友</div>
        </div>

         <div className="px-4 py-2 text-[14px] text-gray-500 font-normal">A</div>
         {/* Simple list of contacts logic for demo matching screenshot order roughly */}
         <div className="bg-white border-t border-gray-200/50">
            {contacts.map((group) => (
                <div key={group.letter}>
                     {group.contacts.map((contact, idx) => {
                         const isSelected = selected.includes(contact.name);
                         return (
                            <div 
                                key={idx} 
                                onClick={() => toggleSelect(contact.name)}
                                className="flex items-center px-4 py-2.5 border-b border-gray-100 last:border-0 active:bg-[#DEDEDE] cursor-pointer"
                            >
                                <div className={`w-6 h-6 rounded-full border mr-3 flex items-center justify-center transition-colors ${isSelected ? 'bg-[#07C160] border-[#07C160]' : 'border-gray-300'}`}>
                                    {isSelected && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                </div>
                                <img src={contact.avatar} className="w-10 h-10 rounded-[4px] mr-3 bg-gray-200" alt={contact.name} />
                                <span className="text-[17px] text-[#191919]">{contact.name}</span>
                            </div>
                         );
                     })}
                </div>
            ))}
         </div>
      </div>
      
       {/* Sidebar Index */}
       <div className="fixed top-[180px] right-1 bottom-[70px] flex flex-col items-center justify-center z-10 w-6">
            {['↑', '☆', 'A', 'B', 'C', 'D', 'E', '#'].map((char, i) => (
                <div key={i} className="text-[10px] text-[#555555] font-medium leading-tight py-1 hover:bg-gray-300 rounded-full w-4 h-4 flex items-center justify-center cursor-pointer select-none">
                    {char}
                </div>
            ))}
        </div>
    </div>
  );
};

export default CreateChat;