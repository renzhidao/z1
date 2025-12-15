import React, { useRef } from 'react';
import { Chat } from '../types';
import { BellOff, Sparkles } from 'lucide-react';

interface ChatItemProps {
  chat: Chat;
  onClick: (chat: Chat) => void;
  onLongPress: (chat: Chat, coords: { x: number; y: number }) => void;
}

const ChatItem: React.FC<ChatItemProps> = ({ chat, onClick, onLongPress }) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);
  const startPos = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    isLongPress.current = false;
    const touch = e.touches[0];
    const { clientX, clientY } = touch;
    startPos.current = { x: clientX, y: clientY };
    
    timerRef.current = setTimeout(() => {
      isLongPress.current = true;
      onLongPress(chat, { x: clientX, y: clientY });
    }, 500); // 500ms for long press
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!startPos.current) return;
    const touch = e.touches[0];
    const moveX = Math.abs(touch.clientX - startPos.current.x);
    const moveY = Math.abs(touch.clientY - startPos.current.y);

    // If moved more than 10px, cancel long press (it's a scroll)
    if (moveX > 10 || moveY > 10) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleTouchEnd = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    // If a long press happened, don't trigger the click
    if (isLongPress.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onClick(chat);
  };

  // Prevent default context menu on long press
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  return (
    <div 
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onContextMenu={handleContextMenu}
      className={`flex items-center px-4 py-3 active:bg-[#DEDEDE] transition-colors cursor-pointer group select-none relative ${chat.isPinned ? 'bg-[#F7F7F7]' : 'bg-white'}`}
    >
      {/* Avatar Container */}
      <div className="relative flex-shrink-0 mr-3.5">
        {chat.isAi ? (
           <div className="w-[48px] h-[48px] rounded-[6px] bg-gradient-to-br from-[#2b2e4a] to-[#53354a] flex items-center justify-center shadow-sm">
             <Sparkles className="text-white w-6 h-6 opacity-90" />
           </div>
        ) : (
          <img 
            src={chat.user.avatar} 
            alt={chat.user.name} 
            className="w-[48px] h-[48px] rounded-[6px] object-cover shadow-[0_0_1px_rgba(0,0,0,0.1)] bg-gray-200"
          />
        )}
        
        {chat.unreadCount > 0 && (
          <div className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-[#FA5151] text-white text-[11px] font-medium flex items-center justify-center rounded-full px-1">
            {chat.unreadCount}
          </div>
        )}
      </div>

      {/* Content Container */}
      <div className="flex-1 min-w-0 border-b border-gray-100 py-1.5 group-last:border-0 h-full flex flex-col justify-center">
        <div className="flex justify-between items-center mb-0.5">
          <h3 className="text-[16px] font-normal text-[#191919] truncate pr-2">
            {chat.user.name}
          </h3>
          <span className="text-[11px] text-gray-400 font-normal whitespace-nowrap">
            {chat.timestamp}
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <p className="text-[13px] text-gray-500 truncate pr-4 leading-normal">
            {chat.lastMessage}
          </p>
          {chat.isMuted && (
            <BellOff size={14} className="text-gray-300 flex-shrink-0" />
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatItem;