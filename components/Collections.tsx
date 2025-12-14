import React from 'react';
import { ChevronLeft, Plus, Search, FileText, MessageSquare } from 'lucide-react';

interface CollectionsProps {
  onBack: () => void;
}

const Collections: React.FC<CollectionsProps> = ({ onBack }) => {
  const items = [
    {
      type: 'link',
      title: '【珍藏版】《姬氏道德经》由来及传承全文',
      source: '开心每天',
      date: '2024年1月1日',
      image: 'https://picsum.photos/seed/tao/100/100'
    },
    {
      type: 'link',
      title: '解开心的反应链锁',
      source: '一念觉法践行课堂',
      date: '2019年5月10日',
      image: 'https://picsum.photos/seed/mind/100/100'
    },
    {
      type: 'chat',
      title: '落雨天与微信团队的聊天记录',
      content: '落雨天: I like you',
      source: '微信团队',
      date: '2019年3月18日'
    },
    {
      type: 'chat',
      title: '落雨天与微信团队的聊天记录',
      content: '落雨天: I like you',
      source: '微信团队',
      date: '2019年3月18日'
    },
    {
      type: 'link',
      title: '25道喜庆年夜饭素菜品，家常味，让春节成为真正吉祥的日子！',
      source: '素食',
      date: '2019年2月4日',
      image: 'https://picsum.photos/seed/food/100/100'
    },
    {
      type: 'link',
      title: '除夕吃什么饺子祈什么福？送你22道素饺，吃饺子，交好运！',
      source: '开心每天',
      date: '2019年1月29日',
      image: 'https://picsum.photos/seed/dumpling/100/100'
    }
  ];

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
        <span className="text-[17px] font-medium text-[#191919]">我的收藏</span>
        <button className="p-2 text-[#191919] hover:bg-gray-200/50 rounded-full active:opacity-60">
          <Plus size={24} strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {/* Search */}
        <div className="px-2 py-2 bg-[#EDEDED]">
            <div className="bg-white rounded-[6px] h-[36px] flex items-center justify-center text-gray-400 gap-1.5">
                <Search size={16} />
                <span className="text-[15px]">搜索</span>
            </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-[#EDEDED] px-4 pb-2 flex gap-6 text-[14px] text-gray-500 overflow-x-auto no-scrollbar">
            <span className="whitespace-nowrap">最近使用</span>
            <span className="whitespace-nowrap">链接</span>
            <span className="whitespace-nowrap">图片与视频</span>
            <span className="whitespace-nowrap">聊天记录</span>
            <span className="whitespace-nowrap">文件</span>
        </div>

        {/* Content List */}
        <div className="px-2 pb-4 space-y-2">
            {items.map((item, idx) => (
                <div key={idx} className="bg-white rounded-[8px] p-4 flex gap-3 active:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <h3 className="text-[16px] text-[#191919] font-normal line-clamp-2 leading-snug mb-1">
                            {item.title}
                        </h3>
                        {item.type === 'chat' && (
                            <p className="text-[13px] text-gray-400 mb-2">{item.content}</p>
                        )}
                        <div className="flex items-center gap-2 text-[12px] text-gray-400 mt-auto">
                            {item.type === 'link' && <FileText size={12} />}
                            {item.type === 'chat' && <MessageSquare size={12} />}
                            <span>{item.source}</span>
                            <span>{item.date}</span>
                        </div>
                    </div>
                    {item.image && (
                        <img src={item.image} className="w-[70px] h-[70px] object-cover shrink-0" alt="thumb" />
                    )}
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default Collections;