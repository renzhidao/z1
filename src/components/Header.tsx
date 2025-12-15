import React, { useState, useEffect, useRef } from 'react';
import { Search, PlusCircle, MessageSquare, UserPlus, ScanLine, Wallet } from 'lucide-react';

interface HeaderProps {
  title: string;
  onSearchClick: () => void;
  onMenuAction: (action: string) => void;
}

const Header: React.FC<HeaderProps> = ({ title, onSearchClick, onMenuAction }) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMenuClick = (action: string) => {
    setShowMenu(false);
    onMenuAction(action);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#EDEDED]/90 backdrop-blur-lg px-4 h-[56px] flex items-center justify-between transition-all duration-300">
      {/* Spacer for balance */}
      <div className="w-16"></div> 
      
      <h1 className="text-[17px] font-medium text-[#191919] tracking-wide">{title}</h1>
      
      <div className="flex items-center space-x-3 w-16 justify-end relative">
        <button 
          onClick={onSearchClick}
          className="text-[#191919] hover:bg-gray-200/50 p-1.5 rounded-full transition-colors active:scale-95 active:opacity-70"
        >
          <Search size={22} strokeWidth={1.5} />
        </button>
        <button 
          onClick={() => setShowMenu(!showMenu)}
          className="text-[#191919] hover:bg-gray-200/50 p-1.5 rounded-full transition-colors active:scale-95 active:opacity-70"
        >
          <PlusCircle size={22} strokeWidth={1.5} />
        </button>

        {/* Dropdown Menu */}
        {showMenu && (
          <div ref={menuRef} className="absolute top-[46px] right-[-8px] w-[160px] bg-[#4C4C4C] rounded-[6px] shadow-xl py-1 z-50 origin-top-right animate-in fade-in zoom-in-95 duration-100">
            {/* Arrow */}
            <div className="absolute -top-1.5 right-4 w-3 h-3 bg-[#4C4C4C] rotate-45"></div>
            
            <MenuItem icon={<MessageSquare size={18} />} label="发起群聊" onClick={() => handleMenuClick('create_chat')} />
            <MenuItem icon={<UserPlus size={18} />} label="添加朋友" onClick={() => handleMenuClick('add_friend')} />
            <MenuItem icon={<ScanLine size={18} />} label="扫一扫" onClick={() => handleMenuClick('scan')} />
            <MenuItem icon={<Wallet size={18} />} label="收付款" onClick={() => handleMenuClick('money')} isLast />
          </div>
        )}
      </div>
    </header>
  );
};

const MenuItem: React.FC<{ icon: React.ReactNode, label: string, onClick: () => void, isLast?: boolean }> = ({ icon, label, onClick, isLast }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center px-4 py-3 text-white active:bg-black/20 ${!isLast ? 'border-b border-white/10' : ''}`}
  >
    <div className="mr-3">{icon}</div>
    <span className="text-[15px] font-normal">{label}</span>
  </button>
);

export default Header;