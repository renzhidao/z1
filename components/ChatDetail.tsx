import React, { useState, useEffect, useRef } from 'react';
import { Chat, Message } from '../types';
import { ChevronLeft, MoreHorizontal, Smile, PlusCircle, Mic, Keyboard, Volume2, Video } from 'lucide-react';
import { sendMessageToGemini } from '../services/geminiService';

interface ChatDetailProps {
  chat: Chat;
  onBack: () => void;
  currentUserId: string;
  onShowToast: (msg: string) => void;
  onUserClick: (user: any) => void;
  onVideoCall: () => void;
}

// === Smart Image Component (Refactored for Reliability) ===
const SmartImage: React.FC<{ 
    src: string; 
    alt: string; 
    fileId?: string;
    className?: string; 
    onClick?: () => void; 
}> = ({ src, alt, fileId, className, onClick }) => {
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [retryCount, setRetryCount] = useState(0);
    const [displaySrc, setDisplaySrc] = useState<string>('');

    useEffect(() => {
        let active = true;
        setStatus('loading');

        // 1. Blob URL directly (Local file)
        if (src.startsWith('blob:')) {
            setDisplaySrc(src);
            setStatus('success');
            return;
        }

        // 2. Virtual URL (Remote P2P file)
        if (src.includes('/virtual/file/')) {
            // Append timestamp to bust cache on retries
            const probeUrl = retryCount > 0 ? `${src}?retry=${retryCount}&t=${Date.now()}` : src;
            
            // Pre-flight check (HEAD request) to ensure SW is ready and task is started
            fetch(probeUrl, { method: 'HEAD' })
                .then(res => {
                    if (!active) return;
                    if (res.ok || res.status === 200 || res.status === 206) {
                        setDisplaySrc(probeUrl);
                        setStatus('success');
                    } else {
                        // If 404/504, it might be temporary (connecting...)
                        console.warn(`SmartImage Probe Failed: ${res.status}`);
                        setStatus('error');
                    }
                })
                .catch(err => {
                    if (!active) return;
                    console.error("SmartImage Probe Error:", err);
                    setStatus('error');
                });
        } else {
            // 3. Normal URL
            setDisplaySrc(src);
            setStatus('success');
        }

        return () => { active = false; };
    }, [src, retryCount]);

    const handleRetry = (e: React.MouseEvent) => {
        e.stopPropagation();
        setRetryCount(c => c + 1);
    };

    if (status === 'loading') {
        return (
            <div className={`flex items-center justify-center bg-[#2b2b2b] ${className}`} style={{ width: '100px', height: '100px' }}>
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className={`flex flex-col items-center justify-center bg-[#1f1f1f] text-gray-500 text-xs gap-2 cursor-pointer ${className}`} 
                 style={{ minWidth: '100px', minHeight: '100px' }}
                 onClick={handleRetry}
            >
                <span>图片加载失败</span>
                <span className="text-[#07C160] border border-[#07C160] px-2 py-0.5 rounded text-[10px]">点击重试</span>
            </div>
        );
    }

    return (
        <img 
            src={displaySrc} 
            alt={alt} 
            className={className} 
            onClick={onClick}
            onError={() => setStatus('error')} // Fallback if <img> tag fails even after probe
        />
    );
};


const ChatDetail: React.FC<ChatDetailProps> = ({ chat, onBack, currentUserId, onShowToast, onUserClick, onVideoCall }) => {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>(chat.messages || []);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Voice State
  const [mode, setMode] = useState<'text' | 'voice'>('text');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync with prop updates
  useEffect(() => {
      setMessages(chat.messages || []);
  }, [chat.messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isAiTyping]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      senderId: currentUserId,
      timestamp: new Date(),
    };

    // Optimistic UI update
    setMessages(prev => [...prev, newMessage]);
    setInputText('');

    // Call Core Protocol
    if (window.protocol) {
        window.protocol.sendMsg(newMessage.text);
    }

    // AI Logic
    if (chat.isAi) {
      setIsAiTyping(true);
      const history = messages.map(m => ({
        role: m.senderId === 'gemini' ? 'model' : 'user' as 'model' | 'user',
        parts: [{ text: m.text }]
      }));

      try {
        const responseText = await sendMessageToGemini(newMessage.text, history);
        
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
              // Calculate duration based on recordingTime state
              // Note: recordingTime is incremented every 100ms, so /10 is seconds
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
      
      // Update Local UI (Optimistic)
      const msg: Message = {
          id: Date.now().toString(),
          text: `[语音] ${duration}"`, 
          senderId: currentUserId,
          timestamp: new Date(),
          kind: 'voice',
          // Generate a temporary local blob URL for immediate playback
          meta: {
              fileId: 'temp_' + Date.now(),
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              fileObj: file 
          }
      };
      setMessages(prev => [...prev, msg]);

      // Call Core
      if (window.protocol) {
          // IMPORTANT: Pass duration string as the first argument 'txt'
          // SmartCore hook will pick this up.
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

      // Optimistic UI
      const msg: Message = {
          id: Date.now().toString(),
          text: '[图片]',
          senderId: currentUserId,
          timestamp: new Date(),
          kind: 'image',
          // Store file object locally for blob preview
          meta: {
              fileId: 'local_' + Date.now(),
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              fileObj: file 
          }
      };
      setMessages(prev => [...prev, msg]);

      // Send to Core
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
          
          // Determine Content to Render
          let content;
          
          // 1. SmartCore/Protocol File Message
          if (msg.kind === 'SMART_FILE_UI' || msg.kind === 'image' || msg.kind === 'voice' || msg.kind === 'video') {
              const meta = msg.meta;
              
              // Handle Image
              if (msg.kind === 'image' && meta) {
                  // Get URL from SmartCore (could be blob or virtual)
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
                  // Clean up duration string if needed
                  const cleanDuration = duration.replace('"', '').replace('”', '');
                  
                  content = (
                      <div className="flex items-center gap-2 cursor-pointer min-w-[60px]" onClick={() => {
                          if (meta && window.smartCore) {
                              const audio = new Audio(window.smartCore.play(meta.fileId, meta.fileName));
                              audio.play();
                          }
                      }}>
                          {isMe ? (
                              <>
                                <span>{cleanDuration}"</span>
                                <Volume2 size={18} className="rotate-180" /> 
                              </>
                          ) : (
                              <>
                                <Volume2 size={18} />
                                <span>{cleanDuration}"</span>
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
                           <video src={url} className="max-w-[200px] rounded-[6px] bg-black" controls />
                           <div className="absolute top-2 right-2 text-white text-xs drop-shadow-md">{meta.fileName}</div>
                       </div>
                   );
              }
              // Generic File
              else if (meta) {
                  content = (
                      <div className="flex items-center gap-3 p-1">
                          <div className="bg-white p-2 rounded">
                              <FileText size={24} className="text-gray-500" />
                          </div>
                          <div className="flex flex-col overflow-hidden">
                              <span className="text-sm truncate max-w-[140px]">{meta.fileName}</span>
                              <span className="text-xs text-gray-400">{(meta.fileSize / 1024).toFixed(1)} KB</span>
                          </div>
                      </div>
                  );
              } else {
                  content = <span>[文件]</span>;
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
                {/* Expand menu hint (just for visual matching, actual logic is simple file input) */}
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