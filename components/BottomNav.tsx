
import React from 'react';
import { MessageCircle, Users, Compass, User } from 'lucide-react';
import { Tab } from '../types';

interface BottomNavProps {
  currentTab: Tab;
  onTabChange: (tab: Tab) => void;
  unreadCount?: number;
}

const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onTabChange, unreadCount = 0 }) => {
  const navItems = [
    { id: Tab.CHATS, label: '微信', icon: MessageCircle },
    { id: Tab.CONTACTS, label: '通讯录', icon: Users },
    { id: Tab.DISCOVER, label: '发现', icon: Compass },
    { id: Tab.ME, label: '我', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 w-full bg-[#F7F7F7]/95 backdrop-blur-xl border-t border-gray-300/50 safe-bottom z-40">
      <div className="flex justify-between items-center h-[56px] px-2">
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          const Icon = item.icon;
          
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className="flex-1 flex flex-col items-center justify-center space-y-[2px] w-full h-full active:bg-gray-200/30 transition-colors cursor-pointer"
            >
              <div className={`relative transition-transform duration-200 ${isActive ? 'scale-100' : 'scale-100'}`}>
                <Icon 
                  size={26} 
                  strokeWidth={isActive ? 2 : 1.5}
                  className={isActive ? 'text-[#07C160] fill-[#07C160]' : 'text-[#191919]'} 
                  fill={isActive ? 'currentColor' : 'none'}
                />
                
                {/* Dynamic Badge for Chats tab */}
                {item.id === Tab.CHATS && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-2 bg-[#FA5151] text-white text-[10px] font-medium px-[5px] min-w-[16px] h-[16px] flex items-center justify-center rounded-full border border-[#F7F7F7]">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
                
                {/* Discovery Dot (Mock) */}
                {item.id === Tab.DISCOVER && (
                   <span className="absolute top-0 -right-1 bg-[#FA5151] w-2 h-2 rounded-full border border-[#F7F7F7]"></span>
                )}
              </div>
              <span className={`text-[10px] tracking-wide ${isActive ? 'text-[#07C160] font-medium' : 'text-[#191919] font-normal'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
