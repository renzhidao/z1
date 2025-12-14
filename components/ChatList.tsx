import React, { useState, useRef, useEffect } from 'react';
import { Chat } from '../types';
import ChatItem from './ChatItem';
import { deleteChat, markChatRead } from '../services/m3Bridge';

interface ChatListProps {
  chats: Chat[];
  onChatClick: (chat: Chat) => void;
  onChatAction?: (action: string, chat: Chat) => void;
}

const ChatList: React.FC<ChatListProps> = ({ chats, onChatClick, onChatAction }) => {
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    chat: Chat | null;
  }>({ visible: false, x: 0, y: 0, chat: null });

  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when scrolling
  useEffect(() => {
    const handleScroll = () => {
      if (contextMenu.visible) setContextMenu(prev => ({ ...prev, visible: false }));
    };
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [contextMenu.visible]);

  const handleLongPress = (chat: Chat, coords: { x: number; y: number }) => {
    const MENU_WIDTH = 150;
    const MENU_HEIGHT = 220;
    const SCREEN_W = window.innerWidth;
    const SCREEN_H = window.innerHeight;

    let x = coords.x;
    let y = coords.y + 10; 

    if (x + MENU_WIDTH > SCREEN_W - 10) {
      x = x - MENU_WIDTH;
    }
    if (y + MENU_HEIGHT > SCREEN_H - 10) {
      y = coords.y - MENU_HEIGHT - 10;
    }

    if (navigator.vibrate) navigator.vibrate(50);

    setContextMenu({ visible: true, x, y, chat });
  };

  const closeMenu = (e?: React.MouseEvent | React.TouchEvent) => {
    setContextMenu({ ...contextMenu, visible: false });
  };

  const handleAction = (action: string, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    
    if (contextMenu.chat) {
        if (action === 'delete') {
            deleteChat(contextMenu.chat.id);
        } else if (action === 'unread') {
            // Toggle read status logic could be complex, for now we just support marking read
            if (contextMenu.chat.unreadCount > 0) {
                markChatRead(contextMenu.chat.id);
            } else {
                // Mark unread logic (optional, requires bridge update if needed)
            }
        }
        
        if (onChatAction) {
            onChatAction(action, contextMenu.chat);
        }
    }
    setContextMenu({ ...contextMenu, visible: false });
  };

  return (
    <div className="flex flex-col bg-white pb-[60px] min-h-screen relative">
      <div className="px-2 py-2 bg-[#EDEDED]">
        <div className="bg-white rounded-[6px] h-9 flex items-center justify-center text-gray-400 text-[15px] cursor-pointer hover:bg-gray-50 transition-colors">
          <span className="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            搜索
          </span>
        </div>
      </div>

      {chats.map((chat) => (
        <ChatItem 
          key={chat.id} 
          chat={chat} 
          onClick={onChatClick} 
          onLongPress={handleLongPress}
        />
      ))}

      {contextMenu.visible && (
        <div 
          className="fixed inset-0 z-[9999]" 
          onClick={closeMenu}
          onTouchStart={closeMenu} 
        >
           <div 
             ref={menuRef}
             className="fixed bg-white rounded-[8px] shadow-[0_0_15px_rgba(0,0,0,0.2)] py-1.5 min-w-[150px] overflow-hidden flex flex-col origin-top-left animate-in fade-in zoom-in-95 duration-100"
             style={{ top: contextMenu.y, left: contextMenu.x }}
             onClick={(e) => e.stopPropagation()} 
             onTouchStart={(e) => e.stopPropagation()} 
           >
              <MenuOption 
                label={contextMenu.chat?.unreadCount ? "标为已读" : "标为未读"} 
                onClick={(e) => handleAction('unread', e)} 
              />
              <MenuOption 
                label={contextMenu.chat?.isPinned ? "取消置顶" : "置顶该聊天"} 
                onClick={(e) => handleAction('pin', e)} 
              />
              <MenuOption label="不显示该聊天" onClick={(e) => handleAction('hide', e)} />
              <MenuOption label="删除该聊天" onClick={(e) => handleAction('delete', e)} isDestructive />
           </div>
        </div>
      )}
    </div>
  );
};

const MenuOption: React.FC<{ label: string, onClick: (e: any) => void, isDestructive?: boolean }> = ({ label, onClick, isDestructive }) => (
  <button 
    onClick={onClick}
    className={`w-full text-left px-5 py-3.5 text-[16px] active:bg-[#EDEDED] transition-colors hover:bg-gray-50 font-normal leading-none ${isDestructive ? 'text-[#FA5151]' : 'text-[#191919]'}`}
  >
    {label}
  </button>
);

export default ChatList;