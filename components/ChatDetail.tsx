import React, { useState, useEffect, useRef } from 'react';
import { Chat, Message } from '../types';
import { ChevronLeft, MoreHorizontal, Mic, Smile, PlusCircle, Image as ImageIcon, Camera, MapPin, Keyboard, Video, Wallet, FolderHeart, User as UserIcon, Smartphone, X, Copy, Share, Trash2, CheckSquare, MessageSquareQuote, Bell, Search as SearchIcon, PlayCircle, Map } from 'lucide-react';
import CallOverlay from './CallOverlay';

interface ChatDetailProps {
  chat: Chat;
  onBack: () => void;
  currentUserId: string;
  onShowToast: (msg: string) => void;
  onUserClick?: () => void;
  onVideoCall?: () => void;
}

// --- 常用 Emoji 列表 ---
const EMOJIS = ["😀","😁","😂","🤣","😃","😄","😅","😆","😉","😊","😋","😎","😍","😘","😗","😙","😚","🙂","🤗","🤩","🤔","🤨","😐","😑","😶","🙄","😏","😣","😥","😮","🤐","😯","😪","😫","😴","😌","😛","😜","😝","🤤","😒","😓","😔","😕","🙃","🤑","😲","☹️","🙁","😖","😞","😟","😤","😢","😭","😦","😧","😨","😩","🤯","😬","😰","😱","😳","🤪","😵","😡","😠","🤬","😷","🤒","🤕","🤢","🤮","","😇","🤠","🤡","🤥","🤫","🤭","🧐","🤓","😈","👿"];

// --- 辅助函数：安全的时间格式化 ---
const formatMessageTime = (date: Date) => {
  if (isNaN(date.getTime())) return ""; // 防止无效日期导致崩溃
  const now = new Date();
  const isToday = now.toDateString() === date.toDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = yesterday.toDateString() === date.toDateString();
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  let period = hours < 6 ? "凌晨" : hours < 12 ? "上午" : hours === 12 ? "中午" : hours < 18 ? "下午" : "晚上";
  let displayHour = hours > 12 ? hours - 12 : (hours === 0 && period !== '凌晨' ? 12 : hours);
  const timePart = `${period}${displayHour.toString().padStart(2, '0')}:${minutes}`;
  if (isToday) return timePart;
  if (isYesterday) return `昨天 ${timePart}`;
  return `${date.getMonth() + 1}月${date.getDate()}日 ${timePart}`;
};

// --- 组件：语音气泡 ---
const VoiceMessage: React.FC<{ duration: number, isMe: boolean, isPlaying: boolean, onPlay: () => void }> = ({ duration, isMe, isPlaying, onPlay }) => {
  const width = Math.min(Math.max(80 + duration * 6, 80), 240);
  const bgColor = isMe ? '#95EC69' : '#FFFFFF';
  return (
    <div className={`flex items-center ${isMe ? 'justify-end' : 'justify-start'}`} onClick={(e) => { e.stopPropagation(); onPlay(); }}>
       <div className={`h-[40px] rounded-[4px] flex items-center px-3 cursor-pointer active:opacity-80 transition-colors select-none relative shadow-sm ${isMe ? 'flex-row-reverse justify-start' : 'flex-row justify-start'}`} style={{ width: `${width}px`, backgroundColor: bgColor }}>
         <div className="flex-shrink-0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={isMe ? 'rotate-180' : ''}>
               <path d="M5 11a1 1 0 0 1 0 2" style={{opacity: isPlaying ? 0 : 1}} className={isPlaying ? 'animate-pulse' : ''}/>
               <path d="M8.5 8.5a5 5 0 0 1 0 7" style={{opacity: isPlaying ? 0 : 1}} className={isPlaying ? 'animate-pulse delay-75' : ''}/>
               <path d="M12 6a8 8 0 0 1 0 12" style={{opacity: isPlaying ? 0 : 1}} className={isPlaying ? 'animate-pulse delay-150' : ''}/>
            </svg>
         </div>
         <span className={`text-[15px] text-[#191919] font-normal flex-shrink-0 ${isMe ? 'mr-1' : 'ml-1'}`}>{duration}"</span>
         <div className={`absolute top-1/2 -translate-y-1/2 w-0 h-0 border-[6px] border-transparent ${isMe ? 'right-[-6px]' : 'left-[-6px]'}`} style={{ borderLeftColor: isMe ? bgColor : 'transparent', borderRightColor: !isMe ? bgColor : 'transparent', borderTopColor: 'transparent', borderBottomColor: 'transparent' }}></div>
       </div>
       {!isMe && !isPlaying && <div className="w-2 h-2 bg-[#FA5151] rounded-full ml-2"></div>}
    </div>
  );
};

// --- 组件：视频消息 ---
const VideoMessage: React.FC<{ src: string, fileName: string, isMe: boolean }> = ({ src, fileName, isMe }) => (
    <div className="relative rounded-[6px] overflow-hidden max-w-[240px] border border-gray-200 bg-black group cursor-pointer">
        <video 
            src={src} 
            controls 
            playsInline
            className="w-full max-h-[300px] bg-black"
            onError={(e) => { (e.target as HTMLVideoElement).poster = "https://placehold.co/400x300/000000/FFFFFF?text=点击加载视频"; }}
        />
        {!isMe && <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-full backdrop-blur-sm">视频</div>}
    </div>
);

// --- 组件：图片消息（修复白屏 + 防止崩溃）---
const ImageMessage: React.FC<{ msg: Message, isMe: boolean, onRetry: () => void }> = ({ msg, isMe, onRetry }) => {
    const getInitialSrc = () => {
        if (msg.meta?.blobUrl) return msg.meta.blobUrl;
        if (msg.meta?.fileId && window.smartCore) return window.smartCore.play(msg.meta.fileId);
        return msg.txt || '';
    };

    const [src, setSrc] = useState<string>(getInitialSrc());
    const [error, setError] = useState(false);

    useEffect(() => {
        if (msg.meta?.fileId && window.smartCore && !msg.meta.blobUrl) {
            setSrc(window.smartCore.play(msg.meta.fileId));
        }
    }, [msg]);

    const handleError = () => {
        if (!error && !isMe) {
            setError(true);
            onRetry(); 
        }
    };

    if (error) {
         return (
             <div onClick={() => { setError(false); onRetry(); }} className="w-[120px] h-[120px] bg-gray-100 flex flex-col items-center justify-center rounded-[6px] text-gray-400 gap-2 cursor-pointer border border-gray-200">
                 <ImageIcon size={32} />
                 <span className="text-[12px]">点击加载图片</span>
             </div>
         );
    }

    return (
        <img 
            src={src} 
            className="rounded-[6px] border border-gray-200 max-w-[200px] bg-white min-h-[50px] min-w-[50px] object-cover" 
            alt="Image" 
            onError={handleError}
        />
    );
};

// --- 组件：长按菜单项 ---
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
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [showCallMenu, setShowCallMenu] = useState(false);
  const [activeCall, setActiveCall] = useState<'voice' | 'video' | null>(null);
  
  // 恢复：长按菜单状态
  const [msgContextMenu, setMsgContextMenu] = useState<{ visible: boolean; x: number; y: number; message: Message | null; }>({ visible: false, x: 0, y: 0, message: null });

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const voiceStartTimeRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  // --- 核心逻辑注入 ---
  useEffect(() => {
    if (window.db) {
        window.db.getRecent(50, chat.id).then(msgs => {
            if (msgs) setMessages(processMessages(msgs));
            setTimeout(scrollToBottom, 100);
        });
    }
    const handler = (e: CustomEvent) => {
        const { type, data } = e.detail;
        if (type === 'msg' && data) { // 增加 data 存在性检查
            const raw = data;
            if ((chat.id === 'all' && raw.target === 'all') || 
                (raw.senderId === chat.id && raw.target === currentUserId) || 
                (raw.senderId === currentUserId && raw.target === chat.id)) {
                
                setMessages(prev => {
                    // 防止重复添加
                    if (prev.find(m => m.id === raw.id)) return prev;
                    return processMessages([...prev, raw]);
                });
                setTimeout(scrollToBottom, 100);
            }
        }
    };
    window.addEventListener('core-ui-update', handler as EventListener);
    return () => window.removeEventListener('core-ui-update', handler as EventListener);
  }, [chat.id, currentUserId]);

  // 修复：增加安全检查，防止渲染崩溃
  const processMessages = (msgs: any[]): Message[] => {
      if (!Array.isArray(msgs)) return [];
      const unique = Array.from(new Map(msgs.filter(m => m && m.id).map(m => [m.id, m])).values());
      return unique.map(m => {
          let kind = m.kind;
          if (kind === 'SMART_FILE_UI' && m.meta?.fileType) {
              if (m.meta.fileType.startsWith('image/')) kind = 'image';
              else if (m.meta.fileType.startsWith('video/')) kind = 'video';
          }
          // 确保 timestamp 是有效的 Date 对象
          return { ...m, kind, timestamp: m.ts ? new Date(m.ts) : new Date() };
      }).sort((a: any, b: any) => (a.ts || 0) - (b.ts || 0));
  };

  const triggerDownload = (msg: Message) => {
      if (msg.meta?.fileId && window.smartCore) {
          window.smartCore.download(msg.meta.fileId, msg.meta.fileName);
      }
  };

  // --- 发送逻辑 ---
  const handleSendText = () => {
    if (!inputValue.trim()) return;
    if (window.protocol) window.protocol.sendMsg(inputValue);
    else onShowToast("核心未连接");
    setInputValue('');
  };

  // 恢复：PC端回车发送，阻止默认提交
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { 
        e.preventDefault(); 
        handleSendText(); 
    }
  };

  const handleSendLocation = () => {
      if (!navigator.geolocation) return onShowToast("不支持定位");
      onShowToast("正在获取位置...");
      navigator.geolocation.getCurrentPosition(pos => {
          const text = `[位置] ${pos.coords.latitude.toFixed(4)},${pos.coords.longitude.toFixed(4)}`;
          if (window.protocol) window.protocol.sendMsg(text);
          setIsPlusOpen(false);
      }, () => onShowToast("获取位置失败"));
  };

  // --- 语音/文件处理 ---
  const handlePlayVoice = (msg: Message) => {
    if (!msg.meta?.fileId || !window.smartCore) return;
    if (!window.smartCore.play(msg.meta.fileId)) window.smartCore.download(msg.meta.fileId);

    if (playingMessageId === msg.id) {
        audioRef.current?.pause(); setPlayingMessageId(null);
        return;
    }
    if (audioRef.current) audioRef.current.pause();

    const url = window.smartCore.play(msg.meta.fileId, msg.meta.fileName);
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingMessageId(msg.id);
    audio.onended = () => setPlayingMessageId(null);
    audio.play().catch(() => { onShowToast("正在加载语音..."); triggerDownload(msg); });
  };

  // 修复：发送图片白屏 - 生成 blobUrl
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      let kind = 'SMART_FILE_UI';
      if (file.type.startsWith('image/')) kind = 'image';
      else if (file.type.startsWith('video/')) kind = 'video';

      // 生成临时预览地址
      const blobUrl = URL.createObjectURL(file);

      if (window.smartCore && window.protocol) {
          const { msg } = window.smartCore.sendFile(file, chat.id, { kind });
          if (kind === 'video' || kind === 'image') {
               msg.meta = { ...msg.meta, fileType: file.type, blobUrl }; // 注入 blobUrl
          }
          window.protocol.sendMsg(null, kind as any, { ...msg.meta, fileObj: file });
          // 手动乐观更新
          setMessages(prev => processMessages([...prev, { ...msg, ts: Date.now(), timestamp: new Date() }]));
      }
      setIsPlusOpen(false);
  };

  // --- 恢复：长按/右键菜单逻辑 ---
  const handleMessageTouchStart = (e: React.TouchEvent, msg: Message) => {
    if (msg.kind === 'voice') return;
    const touch = e.touches[0];
    const { clientX, clientY } = touch;
    timerRef.current = setTimeout(() => {
      let menuY = clientY - 140; 
      if (menuY < 60) menuY = clientY + 20;
      setMsgContextMenu({ visible: true, x: Math.min(Math.max(clientX - 150, 10), window.innerWidth - 310), y: menuY, message: msg });
      if (navigator.vibrate) navigator.vibrate(50);
    }, 500);
  };
  const handleMessageTouchEnd = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };

  // --- UI 交互 ---
  const togglePlusMenu = () => { setIsPlusOpen(!isPlusOpen); setIsEmojiOpen(false); setTimeout(scrollToBottom, 100); };
  const toggleEmojiMenu = () => { setIsEmojiOpen(!isEmojiOpen); setIsPlusOpen(false); setTimeout(scrollToBottom, 100); };
  const handleEmojiClick = (emoji: string) => setInputValue(prev => prev + emoji);

  const startRecording = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];
        voiceStartTimeRef.current = Date.now();
        mediaRecorderRef.current.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        mediaRecorderRef.current.onstop = () => {
            const duration = Math.round((Date.now() - voiceStartTimeRef.current) / 1000);
            if (duration < 1) return onShowToast("说话时间太短");
            const file = new File([new Blob(audioChunksRef.current, { type: 'audio/webm' })], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
            if (window.smartCore && window.protocol) {
                const { msg } = window.smartCore.sendFile(file, chat.id, { kind: 'voice', txt: duration.toString() });
                window.protocol.sendMsg(null, 'voice', { ...msg.meta, fileObj: file });
            }
        };
        mediaRecorderRef.current.start();
        setVoiceRecording(true);
    } catch { onShowToast("无法访问麦克风"); }
  };
  const stopRecording = () => {
    if (mediaRecorderRef.current && voiceRecording) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        setVoiceRecording(false);
    }
  };

  const menuItems = [
      { icon: <ImageIcon size={24} />, label: '照片', action: () => { fileInputRef.current!.accept="image/*"; fileInputRef.current!.click(); } },
      { icon: <Camera size={24} />, label: '拍摄', action: () => { fileInputRef.current!.accept="image/*"; fileInputRef.current!.capture="environment"; fileInputRef.current!.click(); } },
      { icon: <Video size={24} />, label: '视频通话', action: () => setShowCallMenu(true) },
      { icon: <MapPin size={24} />, label: '位置', action: handleSendLocation },
      { icon: <Wallet size={24} />, label: '红包', action: () => {} },
      { icon: <FolderHeart size={24} />, label: '收藏', action: () => {} },
      { icon: <UserIcon size={24} />, label: '个人名片', action: () => {} },
      { icon: <Smartphone size={24} />, label: '文件', action: () => { fileInputRef.current!.accept="*/*"; fileInputRef.current!.click(); } },
  ];

  return (
    <div className="fixed inset-0 bg-[#EDEDED] z-50 flex flex-col animate-in slide-in-from-right duration-300">
      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
      {activeCall && <CallOverlay user={chat.user} type={activeCall} onHangup={() => setActiveCall(null)} />}

      <header className="flex items-center justify-between px-2 h-[56px] bg-[#EDEDED]/90 backdrop-blur-md border-b border-gray-300/50 shrink-0 z-10">
        <button type="button" onClick={onBack} className="p-2 -ml-1 text-[#191919] hover:bg-gray-200/50 rounded-full flex items-center active:opacity-60">
          <ChevronLeft size={26} strokeWidth={1.5} /><span className="text-[16px] ml-[-4px]">{chat.unreadCount > 0 ? `(${chat.unreadCount})` : '微信'}</span>
        </button>
        <span className="text-[17px] font-medium text-[#191919] absolute left-1/2 -translate-x-1/2">{chat.user.name}</span>
        <button type="button" onClick={onUserClick} className="p-2 text-[#191919] hover:bg-gray-200/50 rounded-full active:opacity-60"><MoreHorizontal size={24} /></button>
      </header>

      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-auto no-scrollbar p-4 bg-[#EDEDED] relative" 
        onClick={() => { setIsPlusOpen(false); setIsEmojiOpen(false); setMsgContextMenu({ ...msgContextMenu, visible: false }); }}
        onTouchStart={() => setMsgContextMenu({ ...msgContextMenu, visible: false })}
      >
        {messages.map((msg, idx) => {
          const isMe = msg.senderId === currentUserId;
          // 安全的日期比较
          const prevTime = idx > 0 && messages[idx-1] ? new Date(messages[idx - 1].timestamp).getTime() : 0;
          const currTime = new Date(msg.timestamp).getTime();
          const showTime = idx === 0 || (currTime - prevTime > 5 * 60 * 1000);
          
          const isContextActive = msgContextMenu.visible && msgContextMenu.message?.id === msg.id;
          const bubbleColor = isMe ? (isContextActive ? '#89D960' : '#95EC69') : (isContextActive ? '#F2F2F2' : '#FFFFFF');
          
          return (
            <div key={msg.id || idx} className="mb-4 relative">
              {showTime && !isNaN(currTime) && <div className="flex justify-center mt-6 mb-[18px]"><span className="text-[12px] text-gray-400 bg-gray-200 px-2 py-0.5 rounded-[4px]">{formatMessageTime(new Date(msg.timestamp))}</span></div>}
              <div className={`flex ${isMe ? 'flex-row-reverse' : 'flex-row'} items-start`}>
                <img 
                    src={isMe ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUserId}` : chat.user.avatar} 
                    className="w-10 h-10 rounded-[6px] bg-gray-200 object-cover flex-shrink-0" 
                    onClick={!isMe && onUserClick ? onUserClick : undefined}
                />
                
                <div 
                    className={`max-w-[70%] ${isMe ? 'mr-2.5' : 'ml-2.5'} transition-opacity duration-200`}
                    onTouchStart={(e) => handleMessageTouchStart(e, msg)}
                    onTouchEnd={handleMessageTouchEnd}
                    onContextMenu={(e) => e.preventDefault()}
                >
                   {msg.kind === 'image' ? (
                       <ImageMessage msg={msg} isMe={isMe} onRetry={() => triggerDownload(msg)} />
                   ) : msg.kind === 'video' ? (
                       <VideoMessage src={msg.meta?.fileId && window.smartCore ? window.smartCore.play(msg.meta.fileId) : ''} fileName={msg.meta?.fileName || 'Video'} isMe={isMe} />
                   ) : msg.kind === 'voice' ? (
                       <VoiceMessage duration={parseInt(msg.txt || '0')} isMe={isMe} isPlaying={playingMessageId === msg.id} onPlay={() => handlePlayVoice(msg)} />
                   ) : msg.kind === 'SMART_FILE_UI' ? (
                       <div onClick={() => triggerDownload(msg)} className="bg-white p-3 rounded-[4px] border border-gray-100 flex items-center gap-2 cursor-pointer active:bg-gray-50">
                           <div className="bg-blue-500 text-white p-2 rounded">📄</div>
                           <div><div className="text-sm font-medium">{msg.meta?.fileName}</div><div className="text-xs text-gray-400">{(msg.meta?.fileSize || 0) / 1024 / 1024 < 1 ? '<1 MB' : `${((msg.meta?.fileSize || 0) / 1024 / 1024).toFixed(1)} MB`}</div></div>
                       </div>
                   ) : (
                      <div className="relative px-2.5 py-2 rounded-[4px] text-[16px] text-[#191919] leading-relaxed break-words shadow-sm min-h-[40px] flex items-center" style={{ backgroundColor: bubbleColor }}>
                         <div className={`absolute top-1/2 -translate-y-1/2 w-0 h-0 border-[6px] border-transparent ${isMe ? 'right-[-6px]' : 'left-[-6px]'}`} style={{ borderLeftColor: isMe ? bubbleColor : 'transparent', borderRightColor: !isMe ? bubbleColor : 'transparent', borderTopColor: 'transparent', borderBottomColor: 'transparent' }}></div>
                         <span className="text-left">{msg.text}</span>
                      </div>
                   )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
        
        {/* 恢复：长按菜单 UI */}
        {msgContextMenu.visible && (
          <div className="fixed z-[9999] flex flex-col items-center" style={{ top: msgContextMenu.y, left: '50%', transform: 'translateX(-50%)' }} onClick={(e) => e.stopPropagation()}>
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

      <div className={`bg-[#F7F7F7] border-t border-gray-300/50 transition-all duration-200 z-30 ${isPlusOpen || isEmojiOpen ? 'pb-0' : 'pb-safe-bottom'}`}>
        <div className="flex items-end px-3 py-2 gap-2 min-h-[56px]">
           <button type="button" onClick={() => setIsVoiceMode(!isVoiceMode)} className="mb-2 p-1 text-[#191919] active:opacity-60">{isVoiceMode ? <Keyboard size={28} /> : <Mic size={28} />}</button>
           <div className="flex-1 mb-1.5">
             {isVoiceMode ? (
               <button type="button" className={`w-full h-[40px] rounded-[6px] font-medium text-[16px] select-none ${voiceRecording ? 'bg-[#DEDEDE]' : 'bg-white active:bg-[#DEDEDE]'}`} onMouseDown={startRecording} onMouseUp={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording}>{voiceRecording ? '松开 结束' : '按住 说话'}</button>
             ) : (
               <textarea 
                  value={inputValue} 
                  onChange={(e) => setInputValue(e.target.value)} 
                  onKeyDown={handleKeyPress} 
                  rows={1} 
                  className="w-full bg-white rounded-[6px] px-3 py-2.5 text-[16px] outline-none resize-none max-h-[120px] shadow-sm" 
                  style={{ minHeight: '40px' }} 
               />
             )}
           </div>
           <button type="button" onClick={toggleEmojiMenu} className="mb-2 p-1 text-[#191919] active:opacity-60"><Smile size={28} /></button>
           {inputValue.trim() ? (
              <button type="button" onClick={handleSendText} className="mb-2 bg-[#07C160] text-white px-3 py-1.5 rounded-[4px] text-[14px] font-medium active:bg-[#06AD56]">发送</button>
           ) : (
              <button type="button" onClick={togglePlusMenu} className="mb-2 p-1 text-[#191919] active:opacity-60 transition-transform duration-200" style={{ transform: isPlusOpen ? 'rotate(45deg)' : 'rotate(0)' }}><PlusCircle size={28} /></button>
           )}
        </div>

        {isEmojiOpen && (
            <div className="h-[240px] bg-[#F7F7F7] border-t border-gray-300/50 p-4 pb-safe-bottom overflow-y-auto grid grid-cols-8 gap-4 content-start">
                {EMOJIS.map(emo => <button type="button" key={emo} onClick={() => handleEmojiClick(emo)} className="text-2xl hover:bg-gray-200 rounded p-1">{emo}</button>)}
            </div>
        )}

        {isPlusOpen && (
           <div className="h-[240px] bg-[#F7F7F7] border-t border-gray-300/50 p-6 pb-safe-bottom grid grid-cols-4 gap-y-6 content-start">
              {menuItems.map((item, idx) => (
                 <div key={idx} className="flex flex-col items-center gap-2 cursor-pointer active:opacity-60" onClick={item.action}>
                    <div className="w-[60px] h-[60px] bg-white rounded-[16px] flex items-center justify-center text-[#5C5C5C] shadow-sm border border-gray-100">{item.icon}</div><span className="text-[12px] text-gray-500">{item.label}</span>
                 </div>
              ))}
           </div>
        )}
      </div>
    </div>
  );
};

export default ChatDetail;