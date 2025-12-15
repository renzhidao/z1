import React, { useState } from 'react';
import { ChevronLeft, Search, ChevronRight, QrCode } from 'lucide-react';

interface AddFriendProps {
  onBack: () => void;
  myWechatId: string;
}

const AddFriend: React.FC<AddFriendProps> = ({ onBack, myWechatId }) => {
  const [peerId, setPeerId] = useState('');

  const handleConnect = () => {
      if (peerId && window.p2p) {
          window.p2p.connectTo(peerId);
          alert(`正在尝试连接节点: ${peerId}`);
          onBack();
      }
  };

  return (
    <div className="fixed inset-0 bg-[#EDEDED] z-50 flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="bg-[#EDEDED] h-[56px] flex items-center px-2 shrink-0 border-b border-gray-300/50">
        <button 
          onClick={onBack}
          className="p-2 -ml-1 text-[#191919] hover:bg-gray-200/50 rounded-full transition-colors flex items-center active:opacity-60"
        >
          <ChevronLeft size={26} strokeWidth={1.5} />
          <span className="text-[16px] font-normal ml-[-4px]">通讯录</span>
        </button>
        <span className="ml-1 text-[17px] font-medium absolute left-1/2 -translate-x-1/2">添加朋友</span>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {/* Search Bar Area */}
        <div className="px-2 py-3 bg-[#EDEDED]">
            <div className="bg-white rounded-[6px] h-[40px] flex items-center px-3 gap-2">
                <Search size={18} className="opacity-40" />
                <input 
                    placeholder="输入 P2P Node ID" 
                    className="flex-1 outline-none text-[16px]"
                    value={peerId}
                    onChange={e => setPeerId(e.target.value)}
                />
            </div>
        </div>
        
        {peerId && (
            <div 
                onClick={handleConnect}
                className="bg-white px-4 py-3 flex items-center gap-4 active:bg-gray-100 cursor-pointer border-b border-gray-200"
            >
                <div className="w-10 h-10 bg-[#07C160] rounded flex items-center justify-center text-white">
                    <Search size={20} />
                </div>
                <div>
                    <div className="text-[17px] text-[#191919]">搜索: <span className="text-[#07C160]">{peerId}</span></div>
                    <div className="text-xs text-gray-400">P2P 网络查找</div>
                </div>
            </div>
        )}

        {/* My Wechat ID */}
        <div className="flex justify-center items-center pb-5 pt-5 text-[14px] text-gray-500/80 cursor-pointer active:opacity-60">
           <span className="font-normal mr-1">我的ID：{myWechatId.slice(0,12)}...</span>
           <QrCode size={16} className="text-black opacity-80" />
        </div>
      </div>
    </div>
  );
};

export default AddFriend;