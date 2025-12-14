
import React, { useState, useEffect, useRef } from 'react';
import { Chat, Message } from '../types';
import { ChevronLeft, MoreHorizontal, Mic, Smile, PlusCircle, Image as ImageIcon, Video, Keyboard, Send } from 'lucide-react';
import { useChatMessages } from '../src/bridge/useP1';

interface ChatDetailProps {
  chat: Chat;
  onBack: () => void;
  currentUserId: string;
  onShowToast: (msg: string) => void;
  onUserClick?: () => void;
}

// === Smart Video Component ===
// 专门处理 m1 的流式视频逻辑
const SmartVideo: React.FC<{ fileId: string; name: string; size: number }> = ({ fileId, name, size }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [src, setSrc] = useState('');
    const [error, setError] = useState(false);

    useEffect(() => {
        // 1. 获取播放链接 (可能是 Blob URL 或 Virtual Stream URL)
        if (window.smartCore && window.smartCore.play) {
            const url = window.smartCore.play(fileId, name);
            setSrc(url);
        }
    }, [fileId, name]);

    // 2. 在渲染后绑定流 (触发 SW 下载任务)
    useEffect(() => {
        // 这步看似多余，但在某些浏览器策略下，需要显式触发下载链
        // m1 原版代码有这个 bindVideo，虽然我们现在只靠 play() 返回的 URL 也能触发 fetch
        // 但保留这个副作用以防万一
    }, [src]);

    const download = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.smartCore && window.smartCore.download) {
            window.smartCore.download(fileId, name);
        }
    };

    if (error) {
        return (
            <div className="bg-black/80 p-4 rounded-[6px] text-white flex flex-col items-center min-w-[200px]">
                <span className="text-[12px] text-red-400 mb-2">播放失败</span>
                <button onClick={download} className="text-[12px] underline">尝试下载文件</button>
            </div>
        );
    }

    return (
        <div className="bg-black rounded-[6px] overflow-hidden max-w-[240px] relative group">
            <video 
                ref={videoRef}
                src={src} 
                controls 
                className="w-full h-auto max-h-[300px]"
                onError={() => setError(true)}
                playsInline
            />
            <div className="absolute top-2 left-2 text-white/80 text-[10px] bg-black/40 px-1 rounded backdrop-blur-sm pointer-events-none">
                {(size / (1024 * 1024)).toFixed(1)} MB (流式)
            </div>
            <button 
                onClick={download}
                className="absolute top-2 right-2 bg-white/20 p-1 rounded text-white text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
            >
                下载
            </button>
        </div>
    );
};

const ChatDetail: React.FC<ChatDetailProps> = ({ chat, onBack, currentUserId, onShowToast, onUserClick }) => {
  // Use Hook for Real Messages
  const messages = useChatMessages(chat.id);
  
  const [inputValue, setInputValue] = useState('');
  const [isPlusOpen, setIsPlusOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPlusOpen]);

  // Update Kernel Active Chat
  useEffect(() => {
      if (window.state) {
          window.state.activeChat = chat.id;
          window.state.unread[chat.id] = 0;
      }
      return () => {
          if (window.state) window.state.activeChat = null;
      };
  }, [chat.id]);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    
    // Call Kernel Protocol
    if (window.protocol && window.protocol.sendMsg) {
        window.protocol.sendMsg(inputValue.trim());
    }
    
    setInputValue('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
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
          <span className="text-[16px] font-normal ml-[-4px]">微信</span>
        </button>
        <span className="text-[17px] font-medium text-[#191919] absolute left-1/2 -translate-x-1/2">
           {chat.user.name}
        </span>
        <button className="p-2 text-[#191919] hover:bg-gray-200/50 rounded-full active:opacity-60">
          <MoreHorizontal size={24} strokeWidth={1.5} />
        </button>
      </header>

      {/* Message List */}
      <div 
         className="flex-1 overflow-y-auto no-scrollbar p-4 bg-[#EDEDED] relative"
         onClick={() => setIsPlusOpen(false)}
      >
        {messages.map((msg, idx) => {
          const isMe = msg.senderId === currentUserId;
          let content = null;

          if (msg.type === 'video' || (msg.text && msg.text.startsWith('{'))) {
              try {
                  const meta = JSON.parse(msg.text);
                  if (meta.isSmart) {
                      content = <SmartVideo fileId={meta.fileId} name={meta.fileName} size={meta.fileSize} />;
                  }
              } catch(e) {}
          }
          
          if (!content) {
              content = (
                <div 
                    className={`relative px-2.5 py-2 rounded-[4px] text-[16px] text-[#191919] leading-relaxed break-words shadow-sm min-h-[40px] flex items-center ${isMe ? 'bg-[#95EC69]' : 'bg-white'}`}
                >
                    {/* Arrow */}
                    <div 
                    className={`absolute top-1/2 -translate-y-1/2 w-0 h-0 border-[6px] border-transparent ${
                        isMe ? 'right-[-6px]' : 'left-[-6px]'
                    }`}
                    style={{
                        borderLeftColor: isMe ? '#95EC69' : 'transparent',
                        borderRightColor: !isMe ? '#FFFFFF' : 'transparent',
                    }}
                    ></div>
                    <span className="text-left whitespace-pre-wrap">{msg.text}</span>
                </div>
              );
          }

          return (
            <div key={msg.id} className="mb-4 flex flex-col">
              <div className={`flex ${isMe ? 'flex-row-reverse' : 'flex-row'} items-start`}>
                <img 
                  src={isMe ? 'https://picsum.photos/seed/me/200/200' : chat.user.avatar} 
                  className="w-10 h-10 rounded-[6px] shadow-sm object-cover bg-gray-200 cursor-pointer flex-shrink-0"
                />
                <div className={`max-w-[70%] ${isMe ? 'mr-2.5' : 'ml-2.5'}`}>
                   {content}
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
           <button className="mb-2 p-1 text-[#191919]"><Mic size={28} strokeWidth={1.5} /></button>
           <div className="flex-1 mb-1.5">
               <textarea
                 value={inputValue}
                 onChange={(e) => setInputValue(e.target.value)}
                 onKeyDown={handleKeyPress}
                 rows={1}
                 className="w-full bg-white rounded-[6px] px-3 py-2.5 text-[16px] text-[#191919] outline-none resize-none max-h-[120px] shadow-sm caret-[#07C160]"
                 style={{ minHeight: '40px' }}
               />
           </div>
           <button className="mb-2 p-1 text-[#191919]"><Smile size={28} strokeWidth={1.5} /></button>
           {inputValue.trim() ? (
              <button onClick={handleSend} className="mb-2 bg-[#07C160] text-white px-3 py-1.5 rounded-[4px] text-[14px] font-medium">发送</button>
           ) : (
              <button onClick={() => setIsPlusOpen(!isPlusOpen)} className="mb-2 p-1 text-[#191919]"><PlusCircle size={28} strokeWidth={1.5} /></button>
           )}
        </div>
        
        {isPlusOpen && (
           <div className="h-[200px] bg-[#F7F7F7] border-t border-gray-300/50 p-6 grid grid-cols-4 gap-4">
               <div className="flex flex-col items-center gap-2" onClick={() => document.getElementById('kernelFileSelect')?.click()}>
                   <div className="w-[60px] h-[60px] bg-white rounded-[16px] flex items-center justify-center text-[#5C5C5C] shadow-sm"><ImageIcon size={28} /></div>
                   <span className="text-[12px] text-gray-500">相册/文件</span>
               </div>
               {/* Hidden File Input bound to Kernel Protocol */}
               <input 
                  id="kernelFileSelect" 
                  type="file" 
                  className="hidden" 
                  onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                          const f = e.target.files[0];
                          if (window.protocol) {
                              window.protocol.sendMsg(null, f.type.startsWith('image') ? 'image' : 'file', {
                                  fileObj: f, name: f.name, size: f.size, type: f.type
                              });
                              setIsPlusOpen(false);
                          }
                      }
                  }} 
                />
           </div>
        )}
      </div>
    </div>
  );
};

export default ChatDetail;
