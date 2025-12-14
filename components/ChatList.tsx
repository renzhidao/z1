
import React from 'react';
import { Chat } from '../types';
import ChatItem from './ChatItem';
import { useContactList } from '../bridge/useP1';

interface ChatListProps {
  onChatClick: (chat: Chat) => void;
  onChatAction?: (action: string, chat: Chat) => void;
}

const ChatList: React.FC<ChatListProps> = ({ onChatClick, onChatAction }) => {
  // 使用 Hook 获取真实数据
  const { chats, mqttStatus } = useContactList();

  return (
    <div className="flex flex-col bg-white pb-[60px] min-h-screen relative">
      {/* 状态栏提示 (Optional) */}
      {mqttStatus !== '在线' && (
          <div className="bg-[#FFE4E4] text-[#F56C6C] text-[12px] py-1 px-4 text-center">
              网络状态: {mqttStatus} (正在重连...)
          </div>
      )}

      {/* Search Bar - Visual Only within list */}
      <div className="px-2 py-2 bg-[#EDEDED]">
        <div className="bg-white rounded-[6px] h-9 flex items-center justify-center text-gray-400 text-[15px] cursor-pointer hover:bg-gray-50 transition-colors">
          <span className="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            搜索
          </span>
        </div>
      </div>

      {chats.length === 0 && (
          <div className="flex flex-col items-center justify-center pt-20 text-gray-400">
              <span className="text-[14px]">正在寻找节点...</span>
          </div>
      )}

      {chats.map((chat) => (
        <ChatItem 
          key={chat.id} 
          chat={chat} 
          onClick={onChatClick} 
          onLongPress={() => {}} // 简化：暂不处理长按
        />
      ))}
    </div>
  );
};

export default ChatList;
