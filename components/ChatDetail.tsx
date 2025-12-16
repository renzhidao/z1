import React, { useState, useEffect, useRef } from 'react';
import { Chat, Message } from '../types';
import { ChevronLeft, MoreHorizontal, Smile, PlusCircle, Mic, Keyboard, Volume2, Video, FileText } from 'lucide-react';
import { sendMessageToGemini } from '../services/geminiService';

interface ChatDetailProps {
  chat: Chat;
  onBack: () => void;
  currentUserId: string;
  onShowToast: (msg: string) => void;
  onUserClick: (user: any) => void;
  onVideoCall: () => void;
}

// === Smart Image Component (Simplified & Robust) ===
// 修复：移除 fetch HEAD 预检，改用原生 onError + 自动重试参数
const SmartImage: React.FC<{ 
    src: string; 
    alt: string; 
    fileId?: string;
    className?: string; 
    onClick?: () => void; 
}> = ({ src, alt, fileId, className, onClick }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [retryKey, setRetryKey] = useState(0);

    // 自动为虚拟文件添加 retry 参数，触发 SW 重新处理
    const displaySrc = src.includes('/virtual/file/') ? `${src}${src.includes('?') ? '&' : '?'}retry=${retryKey}` : src;

    return (
        <div className={`relative overflow-hidden bg-[#e5e5e5] ${className}`} style={{ minWidth: '60px', minHeight: '60px' }}>
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}
            {isError ? (
                <div 
                    className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 text-[10px] cursor-pointer bg-[#f0f0f0]"
                    onClick={(e) => { e.stopPropagation(); setIsError(false); setIsLoading(true); setRetryKey(k => k + 1); }}
                >
                    <span>图片裂了</span>
                    <span className="mt-1 text-blue-500">点我重试</span>
                </div>
            ) : (
                <img 
                    src={displaySrc} 
                    alt={alt} 
                    className={`w-full h-full object-cover transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                    onLoad={() => setIsLoading(false)}
                    onError={() => { setIsLoading(false); setIsError(true); }}
                    onClick={onClick}
                />
            )}
        </div>
    );
};

const ChatDetail: React.FC<ChatDetailProps> = ({ chat, onBack, currentUserId, onShowToast, onUserClick, onVideoCall }) => {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Voice State
  const [mode, setMode] = useState<'text' | 'voice'>('text');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // === Core Logic Injection ===
  useEffect(() => {
    const processMessages = (msgs: any[]) => {
      // 过滤掉无效的媒体消息
      const filtered = msgs.filter(m => {
        const isBroken = (m.kind === 'image' || m.kind === 'video') && !m.txt && !(m.meta && m.meta.fileId);
        return !isBroken;
      });

      return filtered.map(m => ({
        ...m,
        text: m.txt || (m.kind === 'SMART_FILE_UI' ? `[文件] ${m.meta?.fileName}` : m.kind === 'image' ? '[图片]' : m.kind === 'voice' ? `[语音] ${m.txt || ''}` : ''),
        timestamp: new Date(m.ts)
      })).sort((a: any, b: any) => a.ts - b.ts);
    };

    // Load initial history
    if (window.db) {
      window.db.getRecent(50, chat.id).then((msgs: any[]) => {
        setMessages(processMessages(msgs));
        setTimeout(scrollToBottom, 100);
      });
    }

    // Listen for real-time updates
    const handler = (e: CustomEvent) => {
      const { type, data } = e.detail;
      
      if (type === 'clear') {
          setMessages([]);
          return;
      }
      
      if (type !== 'msg') return;

      const raw = data;
      const isPublic = chat.id === 'all' && raw.target === 'all';
      const isRelated = (raw.senderId === chat.id && raw.target === currentUserId) || (raw.senderId === currentUserId && raw.target === chat.id);

      if (isPublic || isRelated) {
        // Filter broken
        const isBroken = (raw.kind === 'image' || raw.kind === 'video') && !raw.txt && !(raw.meta && raw.meta.fileId);
        if (isBroken) return;

        const newMsg = {
          ...raw,
          text: raw.txt || (raw.kind === 'SMART_FILE_UI' ? `[文件] ${raw.meta?.fileName}` : raw.kind === 'image' ? '[图片]' : raw.kind === 'voice' ? `[语音] ${raw.txt || ''}` : ''),
          timestamp: new Date(raw.ts)
        };

        setMessages(prev => {
          if (prev.find(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg].sort((a: any, b: any) => a.ts - b.ts);
        });
        setTimeout(scrollToBottom, 100);
      }
    };

    window.addEventListener('core-ui-update', handler as EventListener);
    return () => window.removeEventListener('core-ui-update', handler as EventListener);
  }, [chat.id, currentUserId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isAiTyping]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const textToSend = inputText;
    setInputText('');

    // 修复：移除 setMessages 乐观更新，防止重复
    // 消息会通过 Core -> Protocol -> ProcessIncoming -> Event 环路回来

    if (window.protocol) {
        window.protocol.sendMsg(textToSend);
    } else {
        onShowToast("核心未连接");
    }

    // AI Logic (Keep local for now)
    if (chat.isAi) {
      setIsAiTyping(true);
      const history = messages.map(m => ({
        role: m.senderId === 'gemini' ? 'model' : 'user' as 'model' | 'user',
        parts: [{ text: m.text }]
      }));

      try {
        const responseText = await sendMessageToGemini(textToSend, history);
        
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: responseText,
          senderId: 'gemini',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMessage]);
      } catch (error) {
        console.error("AI Error", error);
      } finally {
        setIsAiTyping(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // --- Voice Logic ---
  const startRecording = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const recorder = new MediaRecorder(stream);
          mediaRecorderRef.current = recorder;
          chunksRef.current = [];

          recorder.ondataavailable = (e) => {
              if (e.data.size > 0) chunksRef.current.push(e.data);
          };

          recorder.onstop = () => {
              const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
              const durationSec = Math.ceil(recordingTime / 10); 
              handleSendVoice(blob, durationSec);
              stream.getTracks().forEach(track => track.stop());
          };

          recorder.start();
          setIsRecording(true);
          setRecordingTime(0);
          timerRef.current = setInterval(() => {
              setRecordingTime(t => t + 1);
          }, 100);

      } catch (e) {
          console.error("Mic error", e);
          onShowToast("无法访问麦克风");
      }
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
          if (timerRef.current) clearInterval(timerRef.current);
      }
  };

  const handleSendVoice = (blob: Blob, duration: number) => {
      const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
      
      // 修复：移除乐观更新
      if (window.protocol) {
          // Pass duration string as 'txt' for display
          window.protocol.sendMsg(`${duration}"`, 'voice', {
              fileObj: file,
              name: file.name,
              size: file.size,
              type: file.type
          });
      }
  };

  // --- Image Logic ---
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // 修复：移除乐观更新
      if (window.protocol) {
          window.protocol.sendMsg(null, 'image', {
              fileObj: file,
              name: file.name,
              size: file.size,
              type: file.type
          });
      }
  };

  return (
    <div className="flex flex-col h-full bg-[#EDEDED] relative">
      {/* Header */}
      <div className="h-[56px] flex items-center justify-between px-2 bg-[#EDEDED] border-b border-gray-300/50 shrink-0 z-10">
        <button 
          onClick={onBack}
          className="p-2 -ml-1 text-[#191919] hover:bg-gray-200/50 rounded-full transition-colors flex items-center active:opacity-60"
        >
          <ChevronLeft size={26} strokeWidth={1.5} />
          <span className="text-[16px] font-normal ml-[-4px]">{window.state?.activeChat === 'all' ? '微信' : '返回'}</span>
        </button>
        <span className="text-[17px] font-medium text-[#191919]">{chat.user.name}</span>
        <button className="p-2 text-[#191919] hover:bg-gray-200/50 rounded-full active:opacity-60">
          <MoreHorizontal size={24} />
        </button>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#EDEDED] no-scrollbar">
        {messages.map((msg) => {
          const isMe = msg.senderId === currentUserId;
          const showAvatar = true; 
          
          let content;
          
          // 1. SmartCore/Protocol File Message
          if (msg.kind === 'SMART_FILE_UI' || msg.kind === 'image' || msg.kind === 'voice' || msg.kind === 'video') {
              const meta = msg.meta;
              
              // Handle Image
              if (msg.kind === 'image' && meta) {
                  const url = window.smartCore ? window.smartCore.play(meta.fileId, meta.fileName) : '';
                  content = (
                      <SmartImage 
                          src={url} 
                          alt="Image" 
                          fileId={meta.fileId}
                          className="max-w-[180px] max-h-[180px] rounded-[6px] cursor-pointer"
                          onClick={() => { /* Open full screen preview */ }}
                      />
                  );
              } 
              // Handle Voice
              else if (msg.kind === 'voice') {
                  const duration = msg.text || msg.txt || '1"';
                  const cleanDuration = parseInt(duration.replace(/[^0-9]/g, '')) || 1;
                  const barWidth = Math.min(60 + cleanDuration * 5, 200);
                  
                  content = (
                      <div 
                        className="flex items-center gap-2 cursor-pointer h-[24px] select-none" 
                        style={{ width: `${barWidth}px`, justifyContent: isMe ? 'flex-end' : 'flex-start' }}
                        onClick={() => {
                          if (meta && window.smartCore) {
                              const audio = new Audio(window.smartCore.play(meta.fileId, meta.fileName));
                              audio.play().catch(e => onShowToast("播放失败"));
                          }
                        }}
                      >
                          {isMe ? (
                              <>
                                <span className="text-[#191919] mr-1">{cleanDuration}"</span>
                                <Volume2 size={20} className="rotate-180 text-[#191919]" /> 
                              </>
                          ) : (
                              <>
                                <Volume2 size={20} className="text-[#191919]" />
                                <span className="text-[#191919] ml-1">{cleanDuration}"</span>
                              </>
                          )}
                      </div>
                  );
              }
              // Handle Video
              else if (msg.kind === 'video' && meta) {
                   const url = window.smartCore ? window.smartCore.play(meta.fileId, meta.fileName) : '';
                   content = (
                       <div className="relative">
                           <video src={url} className="max-w-[200px] max-h-[200px] rounded-[6px] bg-black" controls />
                       </div>
                   );
              }
              // Generic File
              else if (meta) {
                  content = (
                      <div className="flex items-center gap-3 p-1 min-w-[180px]" onClick={() => {
                          if(window.smartCore) window.smartCore.download(meta.fileId, meta.fileName);
                      }}>
                          <div className="bg-white p-2 rounded shrink-0">
                              <FileText size={24} className="text-[#FA9D3B]" />
                          </div>
                          <div className="flex flex-col overflow-hidden">
                              <span className="text-[14px] text-[#191919] truncate max-w-[140px]">{meta.fileName}</span>
                              <span className="text-[10px] text-gray-400">{(meta.fileSize / 1024).toFixed(1)} KB</span>
                          </div>
                      </div>
                  );
              } else {
                  content = <span className="text-gray-400 text-sm">[未知文件]</span>;
              }
          } 
          // 2. Legacy Text Message
          else {
              content = <span>{msg.text || msg.txt}</span>;
          }

          return (
            <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex max-w-[80%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                {showAvatar && (
                  <img 
                    src={isMe ? (window.state?.currentUser?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUserId}`) : chat.user.avatar} 
                    className="w-10 h-10 rounded-[6px] shrink-0 bg-gray-200 cursor-pointer"
                    onClick={() => onUserClick(isMe ? {id:currentUserId} : chat.user)}
                  />
                )}
                
                <div className={`flex flex-col ${isMe ? 'items-end mr-2.5' : 'items-start ml-2.5'}`}>
                   {/* Name if group */}
                   {chat.id === 'all' && !isMe && (
                       <span className="text-[12px] text-gray-400 mb-1 ml-1">{msg.n || msg.senderId.slice(0,6)}</span>
                   )}
                   
                   <div 
                     className={`px-3 py-2 rounded-[6px] text-[16px] leading-relaxed break-all shadow-sm relative ${
                       isMe 
                         ? msg.kind === 'image' || msg.kind === 'video' ? 'bg-transparent shadow-none p-0' : 'bg-[#95EC69] text-[#191919]' 
                         : msg.kind === 'image' || msg.kind === 'video' ? 'bg-transparent shadow-none p-0' : 'bg-white text-[#191919]'
                     }`}
                   >
                     {/* Triangle for text bubbles */}
                     {!(msg.kind === 'image' || msg.kind === 'video') && (
                         isMe ? (
                             <div className="absolute top-3 -right-1.5 w-3 h-3 bg-[#95EC69] rotate-45 rounded-[1px]"></div>
                         ) : (
                             <div className="absolute top-3 -left-1.5 w-3 h-3 bg-white rotate-45 rounded-[1px]"></div>
                         )
                     )}
                     
                     {/* Content z-index fix */}
                     <div className="relative z-10">
                        {content}
                     </div>
                   </div>
                </div>
              </div>
            </div>
          );
        })}
        
        {isAiTyping && (
           <div className="flex w-full justify-start">
              <div className="flex max-w-[80%] flex-row">
                 <img src={chat.user.avatar} className="w-10 h-10 rounded-[6px] shrink-0 bg-gray-200" />
                 <div className="flex flex-col items-start ml-2.5">
                    <div className="bg-white px-4 py-3 rounded-[6px] shadow-sm relative">
                        <div className="absolute top-3 -left-1.5 w-3 h-3 bg-white rotate-45 rounded-[1px]"></div>
                        <div className="flex gap-1 relative z-10">
                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></div>
                        </div>
                    </div>
                 </div>
              </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-[#F7F7F7] border-t border-gray-300/50 pb-safe-bottom px-2 py-2 flex items-end gap-2 shrink-0 z-20">
        <button 
            className="p-2 mb-1 text-[#191919] hover:bg-gray-200/50 rounded-full active:opacity-60"
            onClick={() => setMode(mode === 'text' ? 'voice' : 'text')}
        >
          {mode === 'text' ? <Mic size={26} strokeWidth={1.5} /> : <Keyboard size={26} strokeWidth={1.5} />}
        </button>

        {mode === 'text' ? (
            <div className="flex-1 bg-white rounded-[6px] min-h-[40px] flex items-center px-3 mb-1">
                <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-transparent outline-none text-[16px] text-[#191919] caret-[#07C160]"
                    placeholder=""
                />
            </div>
        ) : (
            <div 
                className={`flex-1 rounded-[6px] h-[40px] flex items-center justify-center mb-1 cursor-pointer select-none transition-colors ${isRecording ? 'bg-[#c6c6c6]' : 'bg-white'} active:bg-[#c6c6c6]`}
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
            >
                <span className="text-[16px] font-medium text-[#191919]">
                    {isRecording ? (recordingTime > 0 ? `松开 发送 ${Math.ceil(recordingTime/10)}"` : "松开 结束") : "按住 说话"}
                </span>
            </div>
        )}

        <button className="p-2 mb-1 text-[#191919] hover:bg-gray-200/50 rounded-full active:opacity-60">
          <Smile size={26} strokeWidth={1.5} />
        </button>
        
        {inputText.length > 0 ? (
            <button 
                onClick={handleSendMessage}
                className="mb-1 px-3 h-[34px] bg-[#07C160] text-white rounded-[4px] text-[14px] font-medium flex items-center active:bg-[#06AD56]"
            >
                发送
            </button>
        ) : (
            <div className="relative">
                <button className="p-2 mb-1 text-[#191919] hover:bg-gray-200/50 rounded-full active:opacity-60 peer">
                    <PlusCircle size={26} strokeWidth={1.5} />
                </button>
                {/* Hidden File Input Trigger */}
                <input 
                    type="file" 
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    accept="image/*"
                    onChange={handleImageSelect}
                />
            </div>
        )}
      </div>
      
      {/* Voice Recording Overlay */}
      {isRecording && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none bg-black/0">
              <div className="bg-black/70 w-[160px] h-[160px] rounded-[12px] flex flex-col items-center justify-center text-white backdrop-blur-sm">
                  <div className="mb-4 animate-pulse">
                      <Mic size={50} fill="white" />
                  </div>
                  <span className="text-[14px] font-normal bg-[#95EC69] text-black px-2 rounded-[2px]">
                      手指上滑，取消发送
                  </span>
              </div>
          </div>
      )}
    </div>
  );
};

export default ChatDetail;