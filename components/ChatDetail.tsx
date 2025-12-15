import React, { useState, useEffect, useRef } from 'react';
import { Chat, Message } from '../types';
import { ChevronLeft, MoreHorizontal, Mic, Smile, PlusCircle, Image as ImageIcon, Camera, MapPin, Keyboard, Video, Wallet, FolderHeart, User as UserIcon, Smartphone, X, Copy, Share, Trash2, CheckSquare, MessageSquareQuote, Bell, Search as SearchIcon, PlayCircle, Loader2, Download } from 'lucide-react';
import CallOverlay from './CallOverlay';

interface ChatDetailProps {
  chat: Chat;
  onBack: () => void;
  currentUserId: string;
  onShowToast: (msg: string) => void;
  onUserClick?: () => void;
  onVideoCall?: () => void;
}

const EMOJIS = ["😀","😁","😂","🤣","","😄","","😆","😉","😊","😋","😎","","😘","😗","😙","😚","🙂","","🤩","🤔","🤨","😐","😑","😶","🙄","😏","😣","😥","","🤐","😯","😪","😫","😴","😌","😛","😜","😝","🤤","😒","😓","😔","😕","🙃","🤑","😲","☹️","🙁","😖","😞","😟","😤","😢","😭","😦","😧","😨","😩","🤯","😬","😰","😱","😳","🤪","😵","😡","😠","🤬","😷","🤒","🤕","🤢","🤮","🤧","😇","🤠","🤡","🤥","🤫","🤭","🧐","🤓","😈","👿"];

// --- 辅助函数 ---
const formatMessageTime = (date: Date) => {
  const now = new Date();
  const isToday = now.toDateString() === date.toDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  let period = hours < 6 ? "凌晨" : hours < 12 ? "上午" : hours === 12 ? "中午" : hours < 18 ? "下午" : "晚上";
  let displayHour = hours > 12 ? hours - 12 : (hours === 0 && period !== '凌晨' ? 12 : hours);
  const timePart = `${period}${displayHour.toString().padStart(2, '0')}:${minutes}`;
  if (isToday) return timePart;
  if (isYesterday) return `昨天 ${timePart}`;
  return `${date.getMonth() + 1}月${date.getDate()}日 ${timePart}`;
};

// --- 组件：语音消息 ---
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

// --- 组件：智能视频 (缺失补全) ---
const VideoMessage: React.FC<{ msg: Message, isMe: boolean }> = ({ msg, isMe }) => {
    const [src, setSrc] = useState<string>('');
    useEffect(() => {
        if (msg.meta?.fileObj) {
            const url = URL.createObjectURL(msg.meta.fileObj);
            setSrc(url);
            return () => URL.revokeObjectURL(url);
        } else if (msg.meta?.fileId && window.smartCore) {
            setSrc(window.smartCore.play(msg.meta.fileId));
        }
    }, [msg]);

    return (
        <div className="relative rounded-[6px] overflow-hidden max-w-[240px] border border-gray-200 bg-black group cursor-pointer min-h-[150px] min-w-[150px] flex items-center justify-center">
            {src ? (
                <video src={src} controls playsInline className="w-full max-h-[300px] bg-black" />
            ) : (
                <div className="text-white text-xs flex flex-col items-center gap-2">
                    <Loader2 className="animate-spin" /><span>加载视频...</span>
                </div>
            )}
            {!isMe && <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-full backdrop-blur-sm">视频</div>}
        </div>
    );
};

// --- 组件：智能图片 (缺失补全) ---
const ImageMessage: React.FC<{ msg: Message, isMe: boolean, onRetry: () => void }> = ({ msg, isMe, onRetry }) => {
    const [src, setSrc] = useState<string>('');
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setError(false);
        setLoading(true);
        if (msg.meta?.fileObj) {
            // 本地文件：0延迟预览
            const url = URL.createObjectURL(msg.meta.fileObj);
            setSrc(url);
            setLoading(false);
            return () => URL.revokeObjectURL(url);
        } else if (msg.meta?.fileId && window.smartCore) {
            // 远程文件
            const url = window.smartCore.play(msg.meta.fileId);
            if (url) {
                setSrc(url);
                setLoading(false);
            } else {
                setError(true);
                setLoading(false);
                if (!isMe) onRetry(); // 自动下载
            }
        } else if (msg.txt) {
            setSrc(msg.txt);
            setLoading(false);
        } else {
            setError(true);
            setLoading(false);
        }
    }, [msg]);

    if (error) {
         return (
             <div onClick={() => { setError(false); onRetry(); }} className="w-[120px] h-[120px] bg-gray-100 flex flex-col items-center justify-center rounded-[6px] text-gray-400 gap-2 cursor-pointer border border-gray-200 active:bg-gray-200">
                 <Download size={24} /><span className="text-[12px]">{isMe ? "发送中..." : "点击下载"}</span>
             </div>
         );
    }
    return (
        <div className="relative min-w-[50px] min-h-[50px]">
            {loading && <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-[6px]"><Loader2 className="animate-spin text-gray-400" size={20}/></div>}
            <img src={src} className={`rounded-[6px] border border-gray-200 max-w-[200px] bg-white object-cover ${loading ? 'opacity-0' : 'opacity-100'}`} alt="Image" onError={() => { setError(true); if(!isMe) onRetry(); }} onLoad={() => setLoading(false)}/>
        </div>
    );
};

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
  const [msgContextMenu, setMsgContextMenu] = useState<{ visible: boolean; x: number; y: number; message: Message | null; }>({ visible: false, x: 0, y: 0, message: null });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const voiceStartTimeRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => {
    if (window.db) {
        window.db.getRecent(50, chat.id).then(msgs => {
            setMessages(processMessages(msgs));
            setTimeout(scrollToBottom, 100);
        });
    }
    const handler = (e: CustomEvent) => {
        const { type, data } = e.detail;
        if (type === 'msg') {
            const raw = data;
            if ((chat.id === 'all' && raw.target === 'all') || (raw.senderId === chat.id && raw.target === currentUserId) || (raw.senderId === currentUserId && raw.target === chat.id)) {
                setMessages(prev => {
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

  const processMessages = (msgs: any[]): Message[] => {
      const unique = Array.from(new Map(msgs.map(m => [m.id, m])).values());
      return unique.map(m => {
          let kind = m.kind;
          if (kind === 'SMART_FILE_UI' && m.meta?.fileType) {
              if (m.meta.fileType.startsWith('image/')) kind = 'image';
              else if (m.meta.fileType.startsWith('video/')) kind = 'video';
          }
          return { ...m, kind, timestamp: new Date(m.ts) };
      }).sort((a: any, b: any) => a.ts - b.ts);
  };

  const triggerDownload = (msg: Message) => {
      if (msg.meta?.fileId && window.smartCore) window.smartCore.download(msg.meta.fileId, msg.meta.fileName);
  };

  const handleSendText = () => {
    if (!inputValue.trim()) return;
    if (window.protocol) window.protocol.sendMsg(inputValue);
    else onShowToast("核心未连接");
    setInputValue('');
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

  const handlePlayVoice = (msg: Message) => {
    if (!msg.meta?.fileId || !window.smartCore) return;
    if (!window.smartCore.play(msg.meta.fileId)) window.smartCore.download(msg.meta.fileId);
    if (playingMessageId === msg.id) { audioRef.current?.pause(); setPlayingMessageId(null); return; }
    if (audioRef.current) audioRef.current.pause();
    const url = window.smartCore.play(msg.meta.fileId, msg.meta.fileName);
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingMessageId(msg.id);
    audio.onended = () => setPlayingMessageId(null);
    audio.play().catch(() => { onShowToast("正在加载语音..."); triggerDownload(msg); });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      let kind = 'SMART_FILE_UI';
      if (file.type.startsWith('image/')) kind = 'image';
      else if (file.type.startsWith('video/')) kind = 'video';

      if (window.smartCore && window.protocol) {
          const { msg } = window.smartCore.sendFile(file, chat.id, { kind });
          const metaWithFile = { ...msg.meta, fileType: file.type, fileObj: file }; // 本地预览关键
          window.protocol.sendMsg(null, kind as any, metaWithFile);
          setMessages(prev => processMessages([...prev, { ...msg, meta: metaWithFile, kind, ts: Date.now(), timestamp: new Date() }]));
      }
      setIsPlusOpen(false);
  };

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
  const stopRecording = () => { if (mediaRecorderRef.current && voiceRecording) { mediaRecorderRef.current.stop(); setVoiceRecording(false); } };

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
        <button onClick={onBack} className="p-2 -ml-1 text-[#191919] hover:bg-gray-200/50 rounded-full flex items-center active:opacity-60">
          <ChevronLeft size={26} strokeWidth={1.5} /><span className="text-[16px] ml-[-4px]">{chat.unreadCount > 0 ? `(${chat.unreadCount})` : '微信'}</span>
        </button>
        <span className="text-[17px] font-medium text-[#191919] absolute left-1/2 -translate-x-1/2">{chat.user.name}</span>
        <button onClick={onUserClick} className="p-2 text-[#191919] hover:bg-gray-200/50 rounded-full active:opacity-60"><MoreHorizontal size={24} /></button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar p-4 bg-[#EDEDED] relative" onClick={() => { setIsPlusOpen(false); setIsEmojiOpen(false); setMsgContextMenu({ ...msgContextMenu, visible: false }); }} onTouchStart={() => setMsgContextMenu({ ...msgContextMenu, visible: false })}>
        {messages.map((msg, idx) => {
          const isMe = msg.senderId === currentUserId;
          const showTime = idx === 0 || (new Date(msg.timestamp).getTime() - new Date(messages[idx - 1].timestamp).getTime() > 5 * 60 * 1000);
          const bubbleColorHex = isMe ? '#95EC69' : '#FFFFFF';
          
          return (
            <div key={msg.id} className="mb-4 relative">
              {showTime && <div className="flex justify-center mt-6 mb-[18px]"><span className="text-[12px] text-gray-400/90 bg-gray-200/60 px-2 py-0.5 rounded-[4px]">{formatMessageTime(msg.timestamp)}</span></div>}
              <div className={`flex ${isMe ? 'flex-row-reverse' : 'flex-row'} items-start group`}>
                <img src={isMe ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUserId}` : chat.user.avatar} className="w-10 h-10 rounded-[6px] shadow-sm object-cover bg-gray-200 cursor-pointer flex-shrink-0" onClick={!isMe && onUserClick ? onUserClick : undefined} />
                <div className={`max-w-[70%] ${isMe ? 'mr-2.5' : 'ml-2.5'}`} onTouchStart={(e) => handleMessageTouchStart(e, msg)} onTouchEnd={handleMessageTouchEnd} onContextMenu={(e) => e.preventDefault()}>
                   {msg.kind === 'image' ? (
                       <ImageMessage msg={msg} isMe={isMe} onRetry={() => triggerDownload(msg)} />
                   ) : msg.kind === 'video' ? (
                       <VideoMessage msg={msg} isMe={isMe} />
                   ) : msg.kind === 'voice' ? (
                       <VoiceMessage duration={parseInt(msg.txt || '0')} isMe={isMe} isPlaying={playingMessageId === msg.id} onPlay={() => handlePlayVoice(msg)} />
                   ) : msg.kind === 'SMART_FILE_UI' ? (
                       <div onClick={() => triggerDownload(msg)} className="bg-white p-3 rounded-[4px] shadow-sm border border-gray-100 cursor-pointer active:bg-gray-50 flex items-center gap-2">
                           <div className="bg-blue-500 text-white p-2 rounded">📄</div>
                           <div><div className="text-sm font-medium">{msg.meta?.fileName}</div><div className="text-xs text-gray-400">{(msg.meta?.fileSize || 0) / 1024 / 1024 < 1 ? '<1 MB' : `${((msg.meta?.fileSize || 0) / 1024 / 1024).toFixed(1)} MB`}</div></div>
                       </div>
                   ) : (
                      <div className="relative px-2.5 py-2 rounded-[4px] text-[16px] text-[#191919] leading-relaxed break-words shadow-sm select-none min-h-[40px] flex items-center" style={{ backgroundColor: bubbleColorHex }}>
                         <div className={`absolute top-1/2 -translate-y-1/2 w-0 h-0 border-[6px] border-transparent ${isMe ? 'right-[-6px]' : 'left-[-6px]'}`} style={{ borderLeftColor: isMe ? bubbleColorHex : 'transparent', borderRightColor: !isMe ? bubbleColorHex : 'transparent', borderTopColor: 'transparent', borderBottomColor: 'transparent' }}></div>
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

      <div className={`bg-[#F7F7F7] border-t border-gray-300/50 transition-all duration-200 z-30 ${isPlusOpen || isEmojiOpen ? 'pb-0' : 'pb-safe-bottom'}`}>
        <div className="flex items-end px-3 py-2 gap-2 min-h-[56px]">
           <button onClick={() => setIsVoiceMode(!isVoiceMode)} className="mb-2 p-1 text-[#191919] active:opacity-60">{isVoiceMode ? <Keyboard size={28} /> : <Mic size={28} />}</button>
           <div className="flex-1 mb-1.5">
             {isVoiceMode ? (
               <button className={`w-full h-[40px] rounded-[6px] font-medium text-[16px] select-none ${voiceRecording ? 'bg-[#DEDEDE]' : 'bg-white active:bg-[#DEDEDE]'}`} onMouseDown={startRecording} onMouseUp={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording}>{voiceRecording ? '松开 结束' : '按住 说话'}</button>
             ) : (
               <textarea value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyPress} rows={1} className="w-full bg-white rounded-[6px] px-3 py-2.5 text-[16px] outline-none resize-none max-h-[120px] shadow-sm" style={{ minHeight: '40px' }} />
             )}
           </div>
           <button onClick={toggleEmojiMenu} className="mb-2 p-1 text-[#191919] active:opacity-60"><Smile size={28} /></button>
           {inputValue.trim() ? (
              <button onClick={handleSendText} className="mb-2 bg-[#07C160] text-white px-3 py-1.5 rounded-[4px] text-[14px] font-medium active:bg-[#06AD56]">发送</button>
           ) : (
              <button onClick={togglePlusMenu} className="mb-2 p-1 text-[#191919] active:opacity-60 transition-transform duration-200" style={{ transform: isPlusOpen ? 'rotate(45deg)' : 'rotate(0)' }}><PlusCircle size={28} /></button>
           )}
        </div>
        {isEmojiOpen && <div className="h-[240px] bg-[#F7F7F7] border-t border-gray-300/50 p-4 pb-safe-bottom overflow-y-auto grid grid-cols-8 gap-4 content-start">{EMOJIS.map(emo => <button key={emo} onClick={() => handleEmojiClick(emo)} className="text-2xl hover:bg-gray-200 rounded p-1">{emo}</button>)}</div>}
        {isPlusOpen && <div className="h-[240px] bg-[#F7F7F7] border-t border-gray-300/50 p-6 pb-safe-bottom grid grid-cols-4 gap-y-6 content-start">{menuItems.map((item, idx) => (<div key={idx} className="flex flex-col items-center gap-2 cursor-pointer active:opacity-60" onClick={item.action}><div className="w-[60px] h-[60px] bg-white rounded-[16px] flex items-center justify-center text-[#5C5C5C] shadow-sm border border-gray-100">{item.icon}</div><span className="text-[12px] text-gray-500">{item.label}</span></div>))}</div>}
      </div>
    </div>
  );
};

export default ChatDetail;