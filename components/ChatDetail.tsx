import React, { useState, useEffect, useRef } from 'react';
import { Chat, Message } from '../types';
import { ChevronLeft, MoreHorizontal, Mic, Smile, PlusCircle, Image as ImageIcon, Camera, MapPin, Keyboard, Video, Wallet, FolderHeart, User as UserIcon, Smartphone, X, Copy, Share, Trash2, CheckSquare, MessageSquareQuote, Bell, Search as SearchIcon } from 'lucide-react';

interface ChatDetailProps {
  chat: Chat;
  onBack: () => void;
  currentUserId: string;
  onShowToast: (msg: string) => void;
  onUserClick?: () => void;
  onVideoCall?: () => void;
}

// --- 辅助函数：时间格式化 ---
const formatMessageTime = (date: Date) => {
  const now = new Date();
  const isToday = now.toDateString() === date.toDateString();
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = yesterday.toDateString() === date.toDateString();

  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  let period = "上午";
  let displayHour = hours;

  if (hours < 6) { period = "凌晨"; }
  else if (hours < 12) { period = "上午"; }
  else if (hours === 12) { period = "中午"; }
  else if (hours < 18) { period = "下午"; displayHour = hours - 12; }
  else { period = "晚上"; displayHour = hours - 12; }
  
  if (displayHour === 0 && period !== '凌晨') displayHour = 12;

  const timePart = `${period}${displayHour.toString().padStart(2, '0')}:${minutes}`;

  if (isToday) {
    return timePart;
  } else if (isYesterday) {
    return `昨天 ${timePart}`;
  } else {
    return `${date.getMonth() + 1}月${date.getDate()}日 ${timePart}`;
  }
};

// --- 辅助组件：语音图标 ---
const VoiceIcon: React.FC<{ isMe: boolean; isPlaying: boolean }> = ({ isMe, isPlaying }) => {
  return (
    <div className={`flex items-center justify-center w-5 h-5 ${isMe ? 'rotate-180' : ''}`}>
       <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 11a1 1 0 0 1 0 2" className={`${isPlaying ? 'animate-voice-1' : ''} text-[#191919]`} style={{opacity: isPlaying ? 0 : 1}} />
          <path d="M8.5 8.5a5 5 0 0 1 0 7" className={`${isPlaying ? 'animate-voice-2' : ''} text-[#191919]`} style={{opacity: isPlaying ? 0 : 1}} />
          <path d="M12 6a8 8 0 0 1 0 12" className={`${isPlaying ? 'animate-voice-3' : ''} text-[#191919]`} style={{opacity: isPlaying ? 0 : 1}} />
       </svg>
    </div>
  );
};

// --- 辅助组件：语音气泡 ---
const VoiceMessage: React.FC<{ duration: number, isMe: boolean, isPlaying: boolean, onPlay: () => void }> = ({ duration, isMe, isPlaying, onPlay }) => {
  const width = Math.min(Math.max(80 + duration * 6, 80), 240);
  const bgColor = isMe ? '#95EC69' : '#FFFFFF';
  return (
    <div className={`flex items-center ${isMe ? 'justify-end' : 'justify-start'}`} onClick={(e) => { e.stopPropagation(); onPlay(); }}>
       <div className={`h-[40px] rounded-[4px] flex items-center px-3 cursor-pointer active:opacity-80 transition-colors select-none relative shadow-sm ${isMe ? 'flex-row-reverse justify-start' : 'flex-row justify-start'}`} style={{ width: `${width}px`, backgroundColor: bgColor }}>
         <div className="flex-shrink-0"><VoiceIcon isMe={isMe} isPlaying={isPlaying} /></div>
         <span className={`text-[15px] text-[#191919] font-normal flex-shrink-0 ${isMe ? 'mr-1' : 'ml-1'}`}>{duration}"</span>
         <div className={`absolute top-1/2 -translate-y-1/2 w-0 h-0 border-[6px] border-transparent ${isMe ? 'right-[-6px]' : 'left-[-6px]'}`} style={{ borderLeftColor: isMe ? bgColor : 'transparent', borderRightColor: !isMe ? bgColor : 'transparent', borderTopColor: 'transparent', borderBottomColor: 'transparent' }}></div>
       </div>
       {!isMe && !isPlaying && duration > 0 && <div className="w-2 h-2 bg-[#FA5151] rounded-full ml-2"></div>}
    </div>
  );
};

// --- 辅助组件：长按菜单项 ---
const ContextMenuItem: React.FC<{ icon: React.ReactNode, label: string, onClick?: () => void }> = ({ icon, label, onClick }) => (
  <div onClick={onClick} className="flex flex-col items-center justify-center py-2 cursor-pointer active:bg-white/10 rounded-[4px]">
     <div className="text-white mb-1.5">{React.cloneElement(icon as React.ReactElement<any>, { size: 20, strokeWidth: 1.5 })}</div><span className="text-[11px] text-white/90">{label}</span>
  </div>
);

// --- 主组件 ---
const ChatDetail: React.FC<ChatDetailProps> = ({ chat, onBack, currentUserId, onShowToast, onUserClick, onVideoCall }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isPlusOpen, setIsPlusOpen] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [showCallMenu, setShowCallMenu] = useState(false);
  
  const [msgContextMenu, setMsgContextMenu] = useState<{ visible: boolean; x: number; y: number; message: Message | null; }>({ visible: false, x: 0, y: 0, message: null });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // --- 核心逻辑注入：数据加载与监听 ---
  useEffect(() => {
    // 1. Initial Load from DB
    if (window.db) {
        window.db.getRecent(50, chat.id).then(msgs => {
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

  const handlePlayVoice = (id: string) => {
    if (playingMessageId === id) {
        setPlayingMessageId(null);
    } else {
        setPlayingMessageId(id);
        setTimeout(() => setPlayingMessageId(null), 3000);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
  };

  const togglePlusMenu = () => {
    setIsPlusOpen(!isPlusOpen);
    setTimeout(scrollToBottom, 100);
  };

  // --- 长按菜单逻辑 ---
  const handleMessageTouchStart = (e: React.TouchEvent, msg: Message) => {
    if (msg.text.startsWith('[语音]')) return; 
    const touch = e.touches[0];
    const { clientX, clientY } = touch;
    
    timerRef.current = setTimeout(() => {
      let menuY = clientY - 140; 
      if (menuY < 60) menuY = clientY + 20;

      setMsgContextMenu({
        visible: true,
        x: Math.min(Math.max(clientX - 150, 10), window.innerWidth - 310),
        y: menuY,
        message: msg
      });
      if (navigator.vibrate) navigator.vibrate(50);
    }, 500);
  };

  const handleMessageTouchEnd = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleMessageTouchMove = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const closeMsgMenu = () => {
    setMsgContextMenu({ ...msgContextMenu, visible: false });
  };

  const menuItems = [
      { icon: <ImageIcon size={24} />, label: '照片', action: () => {} },
      { icon: <Camera size={24} />, label: '拍摄', action: () => {} },
      { icon: <Video size={24} />, label: '视频通话', action: () => setShowCallMenu(true) },
      { icon: <MapPin size={24} />, label: '位置', action: () => {} },
      { icon: <Wallet size={24} />, label: '红包', action: () => {} },
      { icon: <FolderHeart size={24} />, label: '收藏', action: () => {} },
      { icon: <UserIcon size={24} />, label: '个人名片', action: () => {} },
      { icon: <Smartphone size={24} />, label: '文件', action: () => {} },
  ];

  return (
    <div className="fixed inset-0 bg-[#EDEDED] z-50 flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <header className="flex items-center justify-between px-2 h-[56px] bg-[#EDEDED]/90 backdrop-blur-md border-b border-gray-300/50 shrink-0 z-10">
        <button onClick={onBack} className="p-2 -ml-1 text-[#191919] hover:bg-gray-200/50 rounded-full transition-colors flex items-center active:opacity-60">
          <ChevronLeft size={26} strokeWidth={1.5} />
          <span className="text-[16px] font-normal ml-[-4px]">
             {chat.unreadCount > 0 ? `(${chat.unreadCount})` : '微信'}
          </span>
        </button>
        <span className="text-[17px] font-medium text-[#191919] absolute left-1/2 -translate-x-1/2">
           {chat.user.name}
        </span>
        <button onClick={onUserClick} className="p-2 text-[#191919] hover:bg-gray-200/50 rounded-full active:opacity-60">
          <MoreHorizontal size={24} strokeWidth={1.5} />
        </button>
      </header>

      {/* Message List */}
      <div 
         ref={scrollRef}
         className="flex-1 overflow-y-auto no-scrollbar p-4 bg-[#EDEDED] relative"
         onClick={() => { setIsPlusOpen(false); closeMsgMenu(); }}
         onTouchStart={closeMsgMenu}
      >
        {messages.map((msg: any, idx) => {
          const isMe = msg.senderId === currentUserId;
          const showTime = idx === 0 || (new Date(msg.timestamp).getTime() - new Date(messages[idx - 1].timestamp).getTime() > 5 * 60 * 1000);
          const isContextActive = msgContextMenu.visible && msgContextMenu.message?.id === msg.id;
          const bubbleColorHex = isMe ? (isContextActive ? '#89D960' : '#95EC69') : (isContextActive ? '#F2F2F2' : '#FFFFFF');
          const isFile = msg.kind === 'SMART_FILE_UI';

          return (
            <div key={msg.id || idx} className="mb-4 relative">
              {showTime && (
                <div className="flex justify-center mt-6 mb-[18px]">
                  <span className="text-[12px] text-gray-400/90 bg-gray-200/60 px-2 py-0.5 rounded-[4px]">
                    {formatMessageTime(msg.timestamp)}
                  </span>
                </div>
              )}
              
              <div className={`flex ${isMe ? 'flex-row-reverse' : 'flex-row'} items-start group`}>
                <img 
                  src={isMe ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUserId}` : chat.user.avatar} 
                  className="w-10 h-10 rounded-[6px] shadow-sm object-cover bg-gray-200 cursor-pointer flex-shrink-0"
                  onClick={!isMe && onUserClick ? onUserClick : undefined}
                  alt="Avatar"
                />

                <div 
                  className={`max-w-[70%] ${isMe ? 'mr-2.5' : 'ml-2.5'} transition-opacity duration-200`}
                  onTouchStart={(e) => handleMessageTouchStart(e, msg)}
                  onTouchEnd={handleMessageTouchEnd}
                  onTouchMove={handleMessageTouchMove}
                  onContextMenu={(e) => e.preventDefault()}
                >
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
                   ) : msg.text.startsWith('[语音]') ? (
                      <VoiceMessage duration={10} isMe={isMe} isPlaying={false} onPlay={() => {}} />
                   ) : (
                      <div 
                        className="relative px-2.5 py-2 rounded-[4px] text-[16px] text-[#191919] leading-relaxed break-words shadow-sm select-none min-h-[40px] flex items-center"
                        style={{ backgroundColor: bubbleColorHex }}
                      >
                         <div 
                            className={`absolute top-1/2 -translate-y-1/2 w-0 h-0 border-[6px] border-transparent ${isMe ? 'right-[-6px]' : 'left-[-6px]'}`}
                            style={{
                                borderLeftColor: isMe ? bubbleColorHex : 'transparent',
                                borderRightColor: !isMe ? bubbleColorHex : 'transparent',
                                borderTopColor: 'transparent',
                                borderBottomColor: 'transparent'
                            }}
                         ></div>
                         <span className="text-left">{msg.text}</span>
                      </div>
                   )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />

        {msgContextMenu.visible && (
          <div className="fixed z-[9999] flex flex-col items-center" style={{ top: msgContextMenu.y, left: '50%', transform: 'translateX(-50%)' }} onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
             <div className="bg-[#4C4C4C] rounded-[8px] p-2 shadow-2xl animate-in zoom-in-95 duration-100 w-[300px]">
                <div className="grid grid-cols-5 gap-y-3 gap-x-1">
                   <ContextMenuItem icon={<Copy />} label="复制" />
                   <ContextMenuItem icon={<Share />} label="转发" />
                   <ContextMenuItem icon={<FolderHeart />} label="收藏" />
                   <ContextMenuItem icon={<Trash2 />} label="删除" />
                   <ContextMenuItem icon={<CheckSquare />} label="多选" />
                   <ContextMenuItem icon={<MessageSquareQuote />} label="引用" />
                   <ContextMenuItem icon={<Bell />} label="提醒" />
                   <ContextMenuItem icon={<SearchIcon />} label="搜一搜" />
                </div>
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#4C4C4C] rotate-45"></div>
             </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className={`bg-[#F7F7F7] border-t border-gray-300/50 transition-all duration-200 z-30 ${isPlusOpen ? 'pb-0' : 'pb-safe-bottom'}`}>
        <div className="flex items-end px-3 py-2 gap-2 min-h-[56px]">
           <button onClick={() => setIsVoiceMode(!isVoiceMode)} className="mb-2 p-1 text-[#191919] active:opacity-60">
             {isVoiceMode ? <Keyboard size={28} strokeWidth={1.5} /> : <Mic size={28} strokeWidth={1.5} />}
           </button>

           <div className="flex-1 mb-1.5">
             {isVoiceMode ? (
               <button 
                 className={`w-full h-[40px] rounded-[6px] font-medium text-[16px] transition-colors select-none ${voiceRecording ? 'bg-[#DEDEDE] text-[#191919]' : 'bg-white text-[#191919] active:bg-[#DEDEDE]'}`}
                 onMouseDown={() => setVoiceRecording(true)}
                 onMouseUp={() => { setVoiceRecording(false); onShowToast("语音发送功能暂未接入"); }}
                 onTouchStart={() => setVoiceRecording(true)}
                 onTouchEnd={() => { setVoiceRecording(false); onShowToast("语音发送功能暂未接入"); }}
               >
                 {voiceRecording ? '松开 结束' : '按住 说话'}
               </button>
             ) : (
               <textarea
                 value={inputValue}
                 onChange={(e) => setInputValue(e.target.value)}
                 onKeyDown={handleKeyPress}
                 rows={1}
                 className="w-full bg-white rounded-[6px] px-3 py-2.5 text-[16px] text-[#191919] outline-none resize-none overflow-hidden max-h-[120px] shadow-sm caret-[#07C160]"
                 style={{ minHeight: '40px' }}
               />
             )}
           </div>

           <button className="mb-2 p-1 text-[#191919] active:opacity-60">
             <Smile size={28} strokeWidth={1.5} />
           </button>

           {inputValue.trim() ? (
              <button onClick={handleSend} className="mb-2 bg-[#07C160] text-white px-3 py-1.5 rounded-[4px] text-[14px] font-medium active:bg-[#06AD56]">发送</button>
           ) : (
              <button onClick={togglePlusMenu} className="mb-2 p-1 text-[#191919] active:opacity-60 transition-transform duration-200" style={{ transform: isPlusOpen ? 'rotate(45deg)' : 'rotate(0)' }}>
                <PlusCircle size={28} strokeWidth={1.5} />
              </button>
           )}
        </div>

        {isPlusOpen && (
           <div className="h-[240px] bg-[#F7F7F7] border-t border-gray-300/50 p-6 pb-safe-bottom grid grid-cols-4 gap-y-6">
              {menuItems.map((item, idx) => (
                 <div key={idx} className="flex flex-col items-center gap-2 cursor-pointer active:opacity-60" onClick={item.action ? item.action : () => onShowToast("功能暂未开放")}>
                    <div className="w-[60px] h-[60px] bg-white rounded-[16px] flex items-center justify-center text-[#5C5C5C] shadow-sm border border-gray-100">
                       {React.cloneElement(item.icon as React.ReactElement<any>, { strokeWidth: 1.2, size: 28 })}
                    </div><span className="text-[12px] text-gray-500">{item.label}</span>
                 </div>
              ))}
           </div>
        )}
      </div>

       {showCallMenu && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40 transition-opacity" onClick={() => setShowCallMenu(false)}></div>
          <div className="relative z-[110] bg-[#F7F7F7] rounded-t-[12px] overflow-hidden safe-bottom slide-in-from-bottom">
             <div className="bg-white flex flex-col">
               <button onClick={() => { setShowCallMenu(false); if (onVideoCall) onVideoCall(); }} className="w-full py-3.5 text-[17px] text-[#191919] font-normal active:bg-[#F2F2F2] border-b border-gray-100/50 flex items-center justify-center">视频通话</button>
               <button onClick={() => { setShowCallMenu(false); onShowToast("语音通话暂未接入"); }} className="w-full py-3.5 text-[17px] text-[#191919] font-normal active:bg-[#F2F2F2] flex items-center justify-center">语音通话</button>
             </div>
             <div className="mt-2 bg-white"><button className="w-full py-3.5 text-[17px] text-[#191919] font-normal active:bg-[#F2F2F2]" onClick={() => setShowCallMenu(false)}>取消</button></div>
          </div>
        </div>
      )}

       {voiceRecording && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
           <div className="absolute inset-0 bg-black/40"></div><div className="relative bg-[#95EC69] w-[180px] h-[180px] rounded-[16px] flex flex-col items-center justify-center shadow-2xl animate-in zoom-in duration-200">
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#95EC69] rotate-45"></div>
              <div className="flex items-center gap-1.5 h-12 mb-4">
                  {[1,2,3,4,5,6,7].map(i => (
                    <div key={i} className="w-1.5 bg-[#191919] rounded-full animate-pulse" style={{ height: `${Math.random() * 24 + 12}px`, animationDuration: `${Math.random() * 0.3 + 0.2}s` }}></div>
                  ))}
              </div>
              <div className="absolute bottom-[-100px] left-[-80px] text-white/60 flex flex-col items-center">
                 <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-2"><X /></div><span className="text-[14px]">取消</span>
              </div>
              <div className="absolute bottom-[-100px] right-[-80px] text-white/60 flex flex-col items-center">
                 <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-2"><span className="font-bold text-lg">文</span></div><span className="text-[14px]">转文字 发送</span>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ChatDetail;