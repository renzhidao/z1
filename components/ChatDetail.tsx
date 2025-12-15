import React, { useState, useEffect, useRef } from 'react';
import { Chat, Message } from '../types';
import { ChevronLeft, MoreHorizontal, Mic, Smile, PlusCircle, Image as ImageIcon, Camera, Video, MapPin, Wallet, FolderHeart, User as UserIcon, Smartphone, Keyboard } from 'lucide-react';

interface ChatDetailProps {
  chat: Chat;
  onBack: () => void;
  currentUserId: string;
  onShowToast: (msg: string) => void;
  onUserClick?: () => void;
  onVideoCall?: () => void;
}

const ChatDetail: React.FC<ChatDetailProps> = ({ chat, onBack, currentUserId, onShowToast, onUserClick, onVideoCall }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isPlusOpen, setIsPlusOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // 1. Initial Load from DB
    if (window.db) {
        window.db.getRecent(50, chat.id).then(msgs => {
            // Map core msgs to UI msgs
            const mapped = msgs.map(m => ({
                ...m,
                text: m.txt || (m.kind === 'SMART_FILE_UI' ? `[文件] ${m.meta?.fileName}` : ''),
                timestamp: new Date(m.ts)
            }));
            setMessages(mapped.sort((a,b) => a.ts - b.ts));
            setTimeout(scrollToBottom, 100);
        });
    }

    // 2. Subscribe to realtime updates
    const handler = (e: CustomEvent) => {
        const { type, data } = e.detail;
        if (type === 'msg') {
            const raw = data;
            
            // Filter
            const isPublic = chat.id === 'all' && raw.target === 'all';
            const isRelated = (raw.senderId === chat.id && raw.target === currentUserId) || (raw.senderId === currentUserId && raw.target === chat.id);
            
            if (isPublic || isRelated) {
                const newMsg: Message = {
                    ...raw,
                    text: raw.txt || (raw.kind === 'SMART_FILE_UI' ? `[文件] ${raw.meta?.fileName}` : ''),
                    timestamp: new Date(raw.ts)
                };
                setMessages(prev => {
                    if (prev.find(m => m.id === newMsg.id)) return prev;
                    return [...prev, newMsg].sort((a: any,b: any) => a.ts - b.ts);
                });
                setTimeout(scrollToBottom, 100);
            }
        }
    };
    
    window.addEventListener('core-ui-update', handler as EventListener);
    return () => window.removeEventListener('core-ui-update', handler as EventListener);
  }, [chat.id, currentUserId]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    
    if (window.protocol) {
        window.protocol.sendMsg(inputValue);
    } else {
        onShowToast("核心未连接");
    }
    setInputValue('');
  };

  const handleSmartFileDownload = (msg: any) => {
      if (msg.kind === 'SMART_FILE_UI' && msg.meta) {
          if (window.smartCore) {
              window.smartCore.download(msg.meta.fileId, msg.meta.fileName);
              onShowToast("开始下载...");
          }
      }
  };

  // Mock function for menu items that are not implemented yet
  const handleNotImplemented = (label: string) => {
      onShowToast(`${label}功能暂未开放`);
  };

  return (
    <div className="fixed inset-0 bg-[#EDEDED] z-50 flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <header className="flex items-center justify-between px-2 h-[56px] bg-[#EDEDED]/90 backdrop-blur-md border-b border-gray-300/50 shrink-0 z-10">
        <button 
          onClick={onBack}
          className="p-2 -ml-1 text-[#191919] hover:bg-gray-200/50 rounded-full transition-colors flex items-center active:opacity-60"
        >
          <ChevronLeft size={26} strokeWidth={1.5} />
          <span className="text-[16px] font-normal ml-[-4px]">
             微信
          </span>
        </button>
        <span className="text-[17px] font-medium text-[#191919] absolute left-1/2 -translate-x-1/2">
           {chat.user.name}
        </span>
        <button 
           onClick={onUserClick}
           className="p-2 text-[#191919] hover:bg-gray-200/50 rounded-full active:opacity-60"
        >
          <MoreHorizontal size={24} strokeWidth={1.5} />
        </button>
      </header>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 bg-[#EDEDED] relative" onClick={() => setIsPlusOpen(false)}>
        {messages.map((msg: any, idx) => {
          const isMe = msg.senderId === currentUserId;
          const isFile = msg.kind === 'SMART_FILE_UI';
          
          return (
            <div key={msg.id || idx} className="mb-4 relative">
              <div className={`flex ${isMe ? 'flex-row-reverse' : 'flex-row'} items-start group`}>
                <img 
                  src={isMe ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUserId}` : chat.user.avatar} 
                  className="w-10 h-10 rounded-[6px] shadow-sm object-cover bg-gray-200 cursor-pointer flex-shrink-0"
                  alt="Avatar"
                />
                <div className={`max-w-[70%] ${isMe ? 'mr-2.5' : 'ml-2.5'}`}>
                   {isFile ? (
                       <div 
                         onClick={() => handleSmartFileDownload(msg)}
                         className="bg-white p-3 rounded-[4px] shadow-sm border border-gray-100 cursor-pointer active:bg-gray-50"
                       >
                           <div className="flex items-center gap-2">
                               <div className="bg-blue-500 text-white p-2 rounded">📄</div>
                               <div>
                                   <div className="text-sm font-medium">{msg.meta?.fileName}</div>
                                   <div className="text-xs text-gray-400">{(msg.meta?.fileSize / 1024 / 1024).toFixed(2)} MB</div>
                               </div>
                           </div>
                       </div>
                   ) : (
                      <div 
                        className={`relative px-2.5 py-2 rounded-[4px] text-[16px] text-[#191919] leading-relaxed break-words shadow-sm ${isMe ? 'bg-[#95EC69]' : 'bg-white'}`}
                      >
                         <span className="text-left">{msg.text}</span>
                      </div>
                   )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className={`bg-[#F7F7F7] border-t border-gray-300/50 transition-all duration-200 z-30 ${isPlusOpen ? 'pb-0' : 'pb-safe-bottom'}`}>
        <div className="flex items-end px-3 py-2 gap-2 min-h-[56px]">
           <div className="flex-1 mb-1.5">
               <textarea
                 value={inputValue}
                 onChange={(e) => setInputValue(e.target.value)}
                 onFocus={() => setIsPlusOpen(false)}
                 rows={1}
                 className="w-full bg-white rounded-[6px] px-3 py-2.5 text-[16px] text-[#191919] outline-none resize-none overflow-hidden max-h-[120px] shadow-sm caret-[#07C160]"
                 style={{ minHeight: '40px' }}
               />
           </div>
           {inputValue.trim() ? (
              <button 
                onClick={handleSend}
                className="mb-2 bg-[#07C160] text-white px-3 py-1.5 rounded-[4px] text-[14px] font-medium active:bg-[#06AD56]"
              >
                发送
              </button>
           ) : (
              <button 
                onClick={() => setIsPlusOpen(!isPlusOpen)}
                className={`mb-2 p-1 text-[#191919] active:opacity-60 transition-transform duration-200 ${isPlusOpen ? 'rotate-45' : ''}`}
              >
                <PlusCircle size={28} strokeWidth={1.5} />
              </button>
           )}
        </div>

        {/* Plus Menu Action Sheet */}
        {isPlusOpen && (
            <div className="h-[220px] bg-[#F7F7F7] border-t border-gray-300/50 p-6 grid grid-cols-4 gap-y-6 gap-x-4 animate-in slide-in-from-bottom-10 duration-200">
                <ActionItem icon={<ImageIcon size={28} strokeWidth={1.5} />} label="照片" onClick={() => handleNotImplemented('照片')} />
                <ActionItem icon={<Camera size={28} strokeWidth={1.5} />} label="拍摄" onClick={() => handleNotImplemented('拍摄')} />
                <ActionItem icon={<Video size={28} strokeWidth={1.5} />} label="视频通话" onClick={() => { if(onVideoCall) onVideoCall(); else handleNotImplemented('通话'); }} />
                <ActionItem icon={<MapPin size={28} strokeWidth={1.5} />} label="位置" onClick={() => handleNotImplemented('位置')} />
                <ActionItem icon={<Wallet size={28} strokeWidth={1.5} />} label="红包" onClick={() => handleNotImplemented('红包')} />
                <ActionItem icon={<FolderHeart size={28} strokeWidth={1.5} />} label="文件" onClick={() => document.getElementById('fileInput')?.click()} />
                <ActionItem icon={<UserIcon size={28} strokeWidth={1.5} />} label="名片" onClick={() => handleNotImplemented('名片')} />
                <ActionItem icon={<div className="w-6 h-6 flex items-center justify-center font-bold text-gray-500">···</div>} label="更多" onClick={() => {}} />
            </div>
        )}
      </div>
    </div>
  );
};

const ActionItem: React.FC<{ icon: React.ReactNode, label: string, onClick: () => void }> = ({ icon, label, onClick }) => (
    <div className="flex flex-col items-center gap-2 cursor-pointer active:opacity-60" onClick={onClick}>
        <div className="w-[56px] h-[56px] bg-white rounded-[12px] flex items-center justify-center text-[#4C4C4C] shadow-sm border border-gray-200/50">
            {icon}
        </div>
        <span className="text-[12px] text-gray-500">{label}</span>
    </div>
);

export default ChatDetail;