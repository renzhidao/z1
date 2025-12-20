import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Chat, Message } from '../types';
import {
  MoreHorizontal,
  Mic,
  Smile,
  PlusCircle,
  Image as ImageIcon,
  Camera,
  MapPin,
  Keyboard,
  Video,
  Wallet,
  FolderHeart,
  User as UserIcon,
  Smartphone,
  Copy,
  Share,
  Trash2,
  CheckSquare,
  MessageSquareQuote,
  Bell,
  Search as SearchIcon,
  X,
  FileText,
  ChevronLeft,
} from 'lucide-react';
import CallOverlay from './CallOverlay';
import LogConsole from './LogConsole';

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

  let period = '上午';
  let displayHour = hours;

  if (hours < 6) {
    period = '凌晨';
  } else if (hours < 12) {
    period = '上午';
  } else if (hours === 12) {
    period = '中午';
  } else if (hours < 18) {
    period = '下午';
    displayHour = hours - 12;
  } else {
    period = '晚上';
    displayHour = hours - 12;
  }

  if (displayHour === 0 && period !== '凌晨') displayHour = 12;

  const timePart = `${period}${displayHour.toString().padStart(2, '0')}:${minutes}`;

  if (isToday) return timePart;
  if (isYesterday) return `昨天 ${timePart}`;
  return `${date.getMonth() + 1}月${date.getDate()}日 ${timePart}`;
};

// --- 辅助组件：语音图标 ---
const VoiceIcon: React.FC<{ isMe: boolean; isPlaying: boolean }> = ({ isMe, isPlaying }) => (
  <div className={`flex items-center justify-center w-5 h-5 ${isMe ? 'rotate-180' : ''}`}>
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M5 11a1 1 0 0 1 0 2"
        className={`${isPlaying ? 'animate-voice-1' : ''} text-[#191919]`}
        style={{ opacity: isPlaying ? 0 : 1 }}
      />
      <path
        d="M8.5 8.5a5 5 0 0 1 0 7"
        className={`${isPlaying ? 'animate-voice-2' : ''} text-[#191919]`}
        style={{ opacity: isPlaying ? 0 : 1 }}
      />
      <path
        d="M12 6a8 8 0 0 1 0 12"
        className={`${isPlaying ? 'animate-voice-3' : ''} text-[#191919]`}
        style={{ opacity: isPlaying ? 0 : 1 }}
      />
    </svg>
  </div>
);

// --- 辅助组件：语音气泡 ---
const VoiceMessage: React.FC<{
  duration: number;
  isMe: boolean;
  isPlaying: boolean;
  onPlay: () => void;
}> = ({ duration, isMe, isPlaying, onPlay }) => {
  const width = Math.min(Math.max(80 + duration * 6, 80), 240);
  const bgColor = isMe ? '#95EC69' : '#FFFFFF';
  return (
    <div
      className={`flex items-center ${isMe ? 'justify-end' : 'justify-start'}`}
      onClick={(e) => {
        e.stopPropagation();
        onPlay();
      }}
    >
      <div
        className={`h-[40px] rounded-[4px] flex items-center px-3 cursor-pointer active:opacity-80 transition-colors select-none relative shadow-sm ${
          isMe ? 'flex-row-reverse justify-start' : 'flex-row justify-start'
        }`}
        style={{ width: `${width}px`, backgroundColor: bgColor }}
      >
        <div className="flex-shrink-0">
          <VoiceIcon isMe={isMe} isPlaying={isPlaying} />
        </div>
        <span
          className={`text-[15px] text-[#191919] font-normal flex-shrink-0 ${
            isMe ? 'mr-1' : 'ml-1'
          }`}
        >
          {duration}"
        </span>
        <div
          className={`absolute top-[14px] w-0 h-0 border-[6px] border-transparent ${
            isMe ? 'right-[-6px]' : 'left-[-6px]'
          }`}
          style={{
            borderLeftColor: isMe ? bgColor : 'transparent',
            borderRightColor: !isMe ? bgColor : 'transparent',
            borderTopColor: 'transparent',
            borderBottomColor: 'transparent',
          }}
        ></div>
      </div>
      {!isMe && !isPlaying && (
        <div className="w-2 h-2 bg-[#FA5151] rounded-full ml-2"></div>
      )}
    </div>
  );
};

// --- 辅助组件：图片消息 ---
const ImageMessage: React.FC<{
  src: string;
  alt: string;
  isMe: boolean;
  onPreview: (url: string) => void;
}> = ({ src, alt, isMe, onPreview }) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [currentSrc, setCurrentSrc] = useState(src);

  useEffect(() => {
    setCurrentSrc(src);
    setHasError(false);
    setIsLoading(true);
    setRetryCount(0);
  }, [src]);

  const handleError = () => {
    // 针对虚拟文件路径，最多自动重试 3 次
    if (currentSrc.includes('virtual/file/') && retryCount < 3) {
      const nextRetry = retryCount + 1;
      setRetryCount(nextRetry);
      setTimeout(() => {
        try {
          const base = src.split('#')[0];
          const withBust = base.includes('?') 
            ? `${base}&r=${Date.now()}` 
            : `${base}?r=${Date.now()}`;
          setCurrentSrc(withBust);
        } catch (_) {}
      }, 800);
    } else {
      setHasError(true);
      setIsLoading(false);
    }
  };

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center p-2 bg-gray-50 rounded-[6px] border border-gray-200 min-w-[100px] min-h-[100px]">
         <div className="text-2xl mb-1">❌</div>
         <span className="text-[12px] text-red-500">
           {src.startsWith('blob:') ? '本地图片失效' : '加载失败'}
         </span>
      </div>
    );
  }

  return (
    <div className="relative inline-block min-h-[50px] min-w-[50px]">
      <img
        src={currentSrc}
        className={`rounded-[6px] border border-gray-200 max-w-[200px] bg-white object-cover transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        alt={alt}
        onClick={(e) => {
          e.stopPropagation();
          onPreview(src); // 预览原始链接
        }}
        onLoad={() => setIsLoading(false)}
        onError={handleError}
      />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-[6px]">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
};

// --- 辅助组件：视频消息 ---

// P1_PREVIEW_POSTER + FLEX_PREVIEW: 优先用发送方海报；无海报时自适应预览(1MB→2MB→4MB)

const VideoMessage: React.FC<{ src: string; fileName: string; isMe: boolean; posterUrl?: string }> = ({ src, fileName, isMe, posterUrl }) => {

  const [poster, setPoster] = useState<string | null>(posterUrl || null);


  /* __P1_CHAT_PERSIST_V1__ */
  const __p1GetConvId = () => {
    try {
      // 优先 chat.id / activeChat / user.id
      // @ts-ignore
      const w = window as any;
      // @ts-ignore
      const anyChat: any = (typeof (chat as any) !== 'undefined') ? (chat as any) : null;
      if (anyChat && anyChat.id) return String(anyChat.id);
      if (w && w.state && w.state.activeChat) return String(w.state.activeChat);
      // @ts-ignore
      const anyUser: any = (typeof (user as any) !== 'undefined') ? (user as any) : null;
      if (anyUser && anyUser.id) return String(anyUser.id);
    } catch (_) {}
    return 'all';
  };
  const __p1ConvId = __p1GetConvId();
  const __p1CacheKey = 'p1_chat_cache_v1:' + __p1ConvId;

  const __p1LoadCache = () => {
    try {
      const raw = localStorage.getItem(__p1CacheKey);
      if (!raw) return null;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return null;
      return arr;
    } catch (_) {
      return null;
    }
  };

  const __p1SaveCache = (arr: any[]) => {
    try {
      if (!Array.isArray(arr)) return;
      const cut = arr.slice(Math.max(0, arr.length - 300));
      localStorage.setItem(__p1CacheKey, JSON.stringify(cut));
    } catch (_) {}
  };

  const __p1FetchRecent = async () => {
    try {
      // @ts-ignore
      const w = window as any;
      const db = w && w.db;
      if (db && typeof db.getRecent === 'function') {
        const list = await db.getRecent(300, __p1ConvId);
        if (Array.isArray(list)) return list;
      }
    } catch (_) {}
    return null;
  };
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {

    if (!isPlaying && posterUrl && !poster) setPoster(posterUrl);

  }, [posterUrl, isPlaying, poster]);

  const withPreviewParam = (u: string, bytes: number) => {

    try {

      const url = new URL(u, window.location.href);

      url.searchParams.set('p1_preview', '1');

      url.searchParams.set('p1_preview_bytes', String(bytes));

      return url.toString();

    } catch (_) {

      const qp = `p1_preview=1&p1_preview_bytes=${bytes}`;

      return u.includes('?') ? `${u}&${qp}` : `${u}?${qp}`;

    }

  };

  // 自适应预览：尝试 1MB -> 2MB -> 4MB，拿到首帧就停

  useEffect(() => {

    if (isMe) return;                       // 发送方不预览

    if (isPlaying) return;                  // 已经在播就不预览

    if (poster) return;                     // 有海报不预览

    if (!src || typeof src !== 'string' || !src.includes('virtual/file/')) return; // 只对虚拟直链预览

    const steps = [1*1024*1024, 2*1024*1024, 4*1024*1024];

    let cancelled = false;

    let currentVideo: HTMLVideoElement | null = null;

    let timer: any = null;

    const cleanup = () => {

      if (timer) { try { clearTimeout(timer); } catch (_) {} timer = null; }

      try { currentVideo && currentVideo.pause(); } catch (_) {}

      try {

        if (currentVideo) {

          currentVideo.removeAttribute('src');

          (currentVideo as any).srcObject = null;

          currentVideo.load();

          if (currentVideo.parentNode) currentVideo.parentNode.removeChild(currentVideo);

        }

      } catch (_) {}

      currentVideo = null;

    };

    cleanupRef.current = cleanup;

    const grab = () => {

      if (cancelled) return;

      try {

        if (!currentVideo) return;

        const w = currentVideo.videoWidth || 240;

        const h = currentVideo.videoHeight || 160;

        const canvas = document.createElement('canvas');

        canvas.width = w;

        canvas.height = h;

        const ctx = canvas.getContext('2d');

        if (ctx) {

          ctx.drawImage(currentVideo, 0, 0, w, h);

          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);

          setPoster(dataUrl);

        }

      } catch (_) {}

      cleanup(); // 首帧拿到就立刻停下载

    };

    const tryStep = (idx: number) => {

      if (cancelled || idx >= steps.length) { cleanup(); return; }

      cleanup();

      const previewUrl = withPreviewParam(src, steps[idx]);

      const v = document.createElement('video');

      v.muted = true;

      (v as any).playsInline = true;

      v.preload = 'auto';

      v.src = previewUrl;

      v.style.position = 'fixed';

      v.style.left = '-9999px';

      v.style.top = '-9999px';

      v.style.width = '1px';

      v.style.height = '1px';

      v.style.opacity = '0';

      document.body.appendChild(v);

      currentVideo = v;

      const onLoadedMeta = () => {

        try {

          const p = v.play();

          if (p && typeof (p as any).then === 'function') {

            (p as any).then(() => { try { v.pause(); } catch (_) {} }).catch(() => {});

          }

        } catch (_) {}

        try { v.currentTime = 0; } catch (_) {}

      };

      const onLoadedData = () => grab();

      const onSeeked = () => grab();

      const onError = () => { tryStep(idx + 1); };

      v.addEventListener('loadedmetadata', onLoadedMeta, { once: true } as any);

      v.addEventListener('loadeddata', onLoadedData, { once: true } as any);

      v.addEventListener('seeked', onSeeked, { once: true } as any);

      v.addEventListener('error', onError, { once: true } as any);

      // 超时升级下一档

      timer = setTimeout(() => { tryStep(idx + 1); }, 1200);

    };

    tryStep(0);

    return () => { cancelled = true; cleanup(); };

  }, [src, isMe, isPlaying, poster]);

  // 发送方：保持原样直接播放（不走预览/封面）

  if (isMe) {

    return (

      <div className="relative rounded-[6px] overflow-hidden max-w-[240px] border border-gray-200 bg-black">

        <video

          src={src}

          controls

          playsInline

          className="w-full max-h-[300px]"

          onError={(e) => console.error('Video load error', e)}

        />

      </div>

    );

  }

  // 接收方：点封面才真正播放

  if (isPlaying) {

    return (

      <div className="relative rounded-[6px] overflow-hidden max-w-[240px] border border-gray-200 bg-black">

        <video

          src={src}

          controls

          autoPlay

          playsInline

          className="w-full max-h-[300px]"

          onError={(e) => console.error('Video load error', e)}

        />

      </div>

    );

  }

  return (

    <div

      className="relative rounded-[6px] overflow-hidden max-w-[240px] border border-gray-200 bg-black cursor-pointer select-none active:opacity-90"

      onClick={(e) => {

        e.stopPropagation();

        try { cleanupRef.current && cleanupRef.current(); } catch (_) {}

        cleanupRef.current = null;

        setIsPlaying(true);

      }}

    >

      {poster ? (

        <img

          src={poster}

          alt={fileName || 'Video'}

          className="w-full max-h-[300px] object-contain"

          draggable={false}

        />

      ) : (

        <div className="w-[240px] h-[160px] bg-black" />

      )}

      {/* play icon overlay (no text) */}

      <div className="absolute inset-0 flex items-center justify-center">

        <div className="w-12 h-12 rounded-full bg-black/40 flex items-center justify-center">

          <div

            style={{

              width: 0,

              height: 0,

              borderTop: '10px solid transparent',

              borderBottom: '10px solid transparent',

              borderLeft: '16px solid rgba(255,255,255,0.95)',

              marginLeft: '3px',

            }}

          />

        </div>

      </div>

    </div>

  );

};

// --- 辅助组件：长按菜单项 ---

const ContextMenuItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}> = ({ icon, label, onClick }) => (
  <div
    onClick={onClick}
    className="flex flex-col items-center justify-center py-2 cursor-pointer active:bg-white/10 rounded-[4px]"
  >
    <div className="text-white mb-1.5">
      {React.cloneElement(icon as React.ReactElement<any>, {
        size: 20,
        strokeWidth: 1.5,
      })}
    </div>
    <span className="text-[11px] text-white/90">{label}</span>
  </div>
);

// --- 主组件 ---
const ChatDetail: React.FC<ChatDetailProps> = ({
  chat,
  onBack,
  currentUserId,
  onShowToast,
  onUserClick,
  onVideoCall,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);

  // __P1_LOCAL_CHAT_CACHE_V2__: 退出/返回列表再进，仍能看到待上传图片的预览（避免 blob: 失效）
  const __p1ChatCacheKey = useMemo(() => `p1_chat_cache_v2:${chat.id}`, [chat.id]);

  const __p1LoadChatCache = (): any[] | null => {
    try {
      const raw = localStorage.getItem(__p1ChatCacheKey);
      if (!raw) return null;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return null;
      return arr
        .map((m: any) => {
          const ts = (m && (m.ts ?? m.timestamp ?? m.time)) ?? Date.now();
          return { ...m, timestamp: new Date(ts) };
        })
        .filter(Boolean);
    } catch (_) {
      return null;
    }
  };

  const __p1SaveChatCache = (arr: any[]) => {
    try {
      if (!Array.isArray(arr)) return;
      const cut = arr.slice(Math.max(0, arr.length - 300));
      let pendingPreviewKept = 0;

      const safe = cut.map((m: any) => {
        const mm: any = m ? { ...m } : m;
        if (!mm || typeof mm !== 'object') return mm;

        const meta: any = mm.meta && typeof mm.meta === 'object' ? { ...mm.meta } : undefined;
        if (meta && meta.fileObj) delete meta.fileObj; // File 无法 JSON 化

        // 仅对待上传图片保留少量 previewDataUrl，避免 localStorage 爆掉
        if (meta && meta.__pending && typeof meta.previewDataUrl === 'string') {
          pendingPreviewKept += 1;
          const tooMany = pendingPreviewKept > 8;
          const tooBig = meta.previewDataUrl.length > 260000;
          if (tooMany || tooBig) delete meta.previewDataUrl;
        } else if (meta && meta.previewDataUrl) {
          delete meta.previewDataUrl;
        }

        mm.meta = meta;
        // 不缓存 Date 对象，统一靠 ts 恢复
        if (mm.timestamp instanceof Date) mm.timestamp = (mm.ts ?? (mm.timestamp as Date).getTime());
        return mm;
      });

      localStorage.setItem(__p1ChatCacheKey, JSON.stringify(safe));
    } catch (_) {}
  };

  useEffect(() => {
    try {
      const cached = __p1LoadChatCache();
      if (cached && cached.length) {
        setMessages(cached as any);
      }
    } catch (_) {}
  }, [__p1ChatCacheKey]);

  useEffect(() => {
    try {
      __p1SaveChatCache(messages as any);
    } catch (_) {}
  }, [__p1ChatCacheKey, messages]);

  const [inputValue, setInputValue] = useState('');
  const [isPlusOpen, setIsPlusOpen] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [isRecordingCancel, setIsRecordingCancel] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [showCallMenu, setShowCallMenu] = useState(false);
  const [activeCall, setActiveCall] = useState<'voice' | 'video' | null>(null);
  const [msgContextMenu, setMsgContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    message: Message | null;
  }>({ visible: false, x: 0, y: 0, message: null });

  // 日志控制
  const [showLog, setShowLog] = useState(false);

  // 图片预览
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const voiceStartTimeRef = useRef<number>(0);
const audioRef = useRef<HTMLAudioElement | null>(null);
  const pressToRecordRef = useRef<boolean>(false);
  const cancelRecordRef = useRef<boolean>(false);
  const recordReqIdRef = useRef<number>(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 修复虚拟路径（/core/ 前缀）
  const getCoreBase = () => {
    try {
      const loc = window.location;
      const origin = loc.origin === 'null' ? '' : loc.origin;

      let path = loc.pathname || '/';
      // 取目录
      if (path.endsWith('.html') || path.endsWith('.htm')) {
        path = path.substring(0, path.lastIndexOf('/') + 1);
      }
      if (!path.endsWith('/')) {
        path = path.substring(0, path.lastIndexOf('/') + 1);
      }

      // 如果当前页面已经在 /core/ 里，避免变成 /core/core/
      const idx = path.indexOf('/core/');
      if (idx >= 0) {
        return origin + path.substring(0, idx + '/core/'.length);
      }
      return origin + path + 'core/';
    } catch (_) {
      return './core/';
    }
  };

const normalizeVirtualUrl = (url: string) => {
    if (!url) return url;
    if (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('http'))
      return url;

    // 已经是 core 虚拟直链就直接返回
    if (url.includes('/core/virtual/file/')) return url;

    const coreBase = getCoreBase(); // .../core/
    if (url.startsWith('./virtual/file/')) {
      return coreBase + url.slice(2); // 去掉 './'
    }
    if (url.startsWith('/virtual/file/')) {
      return coreBase + url.slice(1); // 去掉 '/'
    }
    if (url.startsWith('virtual/file/')) {
      return coreBase + url;
    }
    return url;
  };

// 进入聊天时同步 Core 的 activeChat
  useEffect(() => {
    try {
      if (window.state) {
        window.state.activeChat = chat.id;
        window.state.activeChatName = chat.user?.name || '';
        if (window.state.unread && typeof window.state.unread === 'object') {
          window.state.unread[chat.id] = 0;
        }
      }
    } catch (_) {}
  }, [chat.id]);

  // 来电：仅在当前聊天页接听（由 p1-call-webrtc 模块派发）
  useEffect(() => {
    if ((window as any).__p1_call_ui_native) return;

    const onIncoming = (e: CustomEvent) => {
      try {
        const d = e && (e as any).detail ? (e as any).detail : null;
        if (!d) return;
        if (d.from !== chat.id) return; // 仅处理当前联系人的来电

        setActiveCall(d.mode === 'video' ? 'video' : 'voice');

        // 自动接听信令
        try { (window as any).p1Call && (window as any).p1Call.accept && (window as any).p1Call.accept(d); } catch (_) {}
      } catch (_) {}
    };

    window.addEventListener('p1-call-incoming', onIncoming as any);
    return () => window.removeEventListener('p1-call-incoming', onIncoming as any);
  }, [chat.id]);
// --- 核心逻辑注入：数据加载与监听 ---
  useEffect(() => {
    const processMessages = (msgs: any[]) => {
      // 过滤破损媒体消息（没有 txt 且没有 meta.fileId 的 image/video）
      const filtered = msgs.filter((m) => {
        const hasLocalMedia = !!(m.meta && (m.meta.fileObj || m.meta.previewDataUrl));
        const isBroken =
          (m.kind === 'image' || m.kind === 'video') &&
          !m.txt &&
          !(m.meta && m.meta.fileId) &&
          !hasLocalMedia;
        return !isBroken;
      });

      return filtered
        .map((m) => ({
          ...m,
          text:
            m.txt ||
            (m.kind === 'SMART_FILE_UI'
              ? `[文件] ${m.meta?.fileName}`
              : m.kind === 'image'
              ? '[图片]'
              : m.kind === 'voice'
              ? `[语音] ${m.meta?.fileName}`
              : ''),
          timestamp: new Date(m.ts),
        }))
        .sort((a: any, b: any) => a.ts - b.ts);
    };

    if (window.db) {
      window.db.getRecent(50, chat.id).then((msgs: any[]) => {
        const dbList = processMessages(msgs);
        setMessages((prev) => {
          const pending = Array.isArray(prev)
            ? (prev as any[]).filter((m: any) => m && m.meta && m.meta.__pending)
            : [];
          const byId = new Map<string, any>();
          for (const m of [...dbList, ...pending]) {
            const id = m && m.id != null ? String(m.id) : `noid_${Math.random()}`;
            if (!byId.has(id) || !(byId.get(id) as any).meta?.__pending) byId.set(id, m);
          }
          return Array.from(byId.values()).sort((a: any, b: any) => (a.ts || 0) - (b.ts || 0));
        });
        setTimeout(scrollToBottom, 100);
      });
    }

const handler = (ev: any) => {

  try {

    const detail = ev && (ev as any).detail;

    if (!detail || typeof detail !== 'object') return;

    const type = (detail as any).type;

    const data = (detail as any).data;

    if (type !== 'msg' || !data) return;



    const raw = data;

    const isPublic = chat.id === 'all' && raw.target === 'all';

    const isRelated =

      (raw.senderId === chat.id && raw.target === currentUserId) ||

      (raw.senderId === currentUserId && raw.target === chat.id);



    if (!(isPublic || isRelated)) return;



    const hasLocalMedia = !!(raw.meta && ((raw.meta as any).fileObj || (raw.meta as any).previewDataUrl));
    const isBroken =
      (raw.kind === 'image' || raw.kind === 'video') &&
      !raw.txt &&
      !(raw.meta && raw.meta.fileId) &&
      !hasLocalMedia;
    if (isBroken) return;



    const newMsg = {

      ...raw,

      text:

        raw.txt ||

        (raw.kind === 'SMART_FILE_UI'

          ? `[文件] ${raw.meta?.fileName}`

          : raw.kind === 'image'

          ? '[图片]'

          : raw.kind === 'voice'

          ? `[语音] ${raw.meta?.fileName}`

          : ''),

      timestamp: new Date(raw.ts),

    };



    setMessages((prev) => {

      if (prev.find((m) => m.id === newMsg.id)) return prev;

      return [...prev, newMsg].sort((a: any, b: any) => a.ts - b.ts);

    });

    setTimeout(scrollToBottom, 100);

  } catch (err) {

    try { console.error('core-ui-update handler error', err); } catch (_) {}

  }

};
    window.addEventListener('core-ui-update', handler as EventListener);

    return () =>

      window.removeEventListener('core-ui-update', handler as EventListener);
  }, [chat.id, currentUserId]);

  const handleSendText = async () => {
    if (!inputValue.trim()) return;
    if (window.protocol) window.protocol.sendMsg(inputValue);
    else onShowToast('核心未连接');
    setInputValue('');
  };

  const handleSmartFileDownload = (msg: any) => {
    if (msg.meta && window.smartCore) {
      window.smartCore.download(msg.meta.fileId, msg.meta.fileName);
      onShowToast('开始下载...');
    }
  };

  const handlePlayVoice = (msg: any) => {
    if (!msg.meta?.fileId || !window.smartCore) return;
    if (playingMessageId === msg.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingMessageId(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();

    const url = normalizeVirtualUrl(
      window.smartCore.play(msg.meta.fileId, msg.meta.fileName),
    );
    const audio = new Audio(url);
    audioRef.current = audio;

    setPlayingMessageId(msg.id);
    audio.onended = () => {
      setPlayingMessageId(null);
      audioRef.current = null;
    };
    audio
      .play()
      .catch((e) => {
        console.error('Play failed', e);
        onShowToast('播放失败');
        setPlayingMessageId(null);
      });
  };

  // --- 录音 ---
  const startRecording = async (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();

    // 防止 touch/mouse 双触发 + getUserMedia 异步竞态
    if (pressToRecordRef.current) return;
    pressToRecordRef.current = true;
    const reqId = ++recordReqIdRef.current;

    setVoiceRecording(true);
    setIsRecordingCancel(false);
    cancelRecordRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // 如果已经松手/取消：立刻结束，不进入录音
      if (!pressToRecordRef.current || reqId !== recordReqIdRef.current) {
        try { stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
        setVoiceRecording(false);
        return;
      }
      const mimeCandidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      let mimeType = '';
      try {
        for (const m of mimeCandidates) {
          if ((MediaRecorder as any).isTypeSupported && (MediaRecorder as any).isTypeSupported(m)) { mimeType = m; break; }
        }
      } catch (_) {}

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType } as any)
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      voiceStartTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = async () => {
        try { stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
        mediaRecorderRef.current = null;
        pressToRecordRef.current = false;
        if (cancelRecordRef.current) return;

        const ms = Date.now() - voiceStartTimeRef.current;
        const duration = Math.max(1, Math.round(ms / 1000));

        const blobType = mimeType || (mediaRecorder as any).mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: blobType });

        if (!audioBlob || audioBlob.size <= 0) {
          onShowToast('录音失败，请重试');
          return;
        }
        if (ms < 600) {
          onShowToast('说话时间太短');
          return;
        }

        const ext =
          blobType.includes('mp4') ? 'mp4' :
          blobType.includes('webm') ? 'webm' : 'bin';

        const file = new File([audioBlob], `voice_${Date.now()}.${ext}`, { type: blobType });

        if (window.protocol) {
          window.protocol.sendMsg(String(duration), 'voice' as any, { duration,
            fileObj: file,
            name: file.name,
            size: file.size,
            type: file.type,
          });
        }
      };
      try { mediaRecorder.start(200); } catch (_) { mediaRecorder.start(); }
    } catch (err) {
      console.error(err);
      pressToRecordRef.current = false;
      setVoiceRecording(false);
      onShowToast('无法访问麦克风');
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!voiceRecording) return;
    const touch = e.touches[0];
    const { clientY } = touch;
    // 简单的阈值判定：如果上滑超过一定距离（例如屏幕高度的 20% 或固定像素），则视为取消
    // 假设按钮在底部，向上滑 y 变小。
    const winHeight = window.innerHeight;
    // 如果手指位置在底部 120px 以上，视为取消意图（根据 UI 调整）
    if (winHeight - clientY > 120) {
      if (!isRecordingCancel) {
        setIsRecordingCancel(true);
        cancelRecordRef.current = true;
      }
    } else {
      if (isRecordingCancel) {
        setIsRecordingCancel(false);
        cancelRecordRef.current = false;
      }
    }
  };

  const stopRecording = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    pressToRecordRef.current = false;
    setVoiceRecording(false);

    const mr = mediaRecorderRef.current;
    if (!mr) return;

    try { (mr as any).requestData && (mr as any).requestData(); } catch (_) {}
    try { if ((mr as any).state && (mr as any).state !== 'inactive') mr.stop(); } catch (_) {}
  };

  // --- 文件选择 ---
  const handleFileAction = (type: 'image' | 'video' | 'file') => {
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';
    if (type === 'image') fileInputRef.current.accept = 'image/*';
    else if (type === 'video') fileInputRef.current.accept = 'video/*';
    else fileInputRef.current.accept = '*/*';
    fileInputRef.current.click();
    setIsPlusOpen(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 只调 protocol.sendMsg，让 SmartCore Hook 自动生成 SMART_META（对齐旧前端）
    let kind: any = 'file';
    if (file.type.startsWith('image/')) kind = 'image';

    const localId = `local_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const makePreview = (f: File) =>
      new Promise<string | null>((resolve) => {
        try {
          const reader = new FileReader();
          reader.onerror = () => resolve(null);
          reader.onload = () => {
            try {
              const dataUrl = String(reader.result || '');
              if (!dataUrl.startsWith('data:')) return resolve(null);
              const img = new Image();
              img.onload = () => {
                try {
                  const max = 900;
                  const w = img.width || 0;
                  const h = img.height || 0;
                  if (!w || !h) return resolve(dataUrl);
                  const scale = Math.min(1, max / Math.max(w, h));
                  const cw = Math.max(1, Math.round(w * scale));
                  const ch = Math.max(1, Math.round(h * scale));
                  const canvas = document.createElement('canvas');
                  canvas.width = cw;
                  canvas.height = ch;
                  const ctx = canvas.getContext('2d');
                  if (!ctx) return resolve(dataUrl);
                  ctx.drawImage(img, 0, 0, cw, ch);
                  const out = canvas.toDataURL('image/jpeg', 0.82);
                  resolve(out || dataUrl);
                } catch (_) {
                  resolve(dataUrl);
                }
              };
              img.onerror = () => resolve(dataUrl);
              img.src = dataUrl;
            } catch (_) {
              resolve(null);
            }
          };
          reader.readAsDataURL(f);
        } catch (_) {
          resolve(null);
        }
      });

    // 图片：先本地上屏（并可被 localStorage 缓存），避免退出/返回后 blob 失效
    if (kind === 'image') {
      const previewDataUrl = await makePreview(file);
      const localMsg: any = {
        id: localId,
        kind: 'image',
        senderId: currentUserId,
        target: chat.id,
        ts: Date.now(),
        txt: previewDataUrl || '',
        meta: {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          previewDataUrl: previewDataUrl || undefined,
          __pending: true,
          clientMsgId: localId,
        },
        text: '[图片]',
        timestamp: new Date(),
      };
      setMessages((prev: any) => {
        const arr = Array.isArray(prev) ? prev : [];
        return [...arr, localMsg].sort((a: any, b: any) => (a.ts || 0) - (b.ts || 0));
      });
      setTimeout(scrollToBottom, 100);
    }

    if (window.protocol) {
      window.protocol.sendMsg(null, kind, {
        fileObj: file,
        name: file.name,
        size: file.size,
        type: file.type,
        clientMsgId: localId,
      });
    } else {
      onShowToast('核心未连接');
    }
    setIsPlusOpen(false);
  };

  // --- 通话发起 ---
  const startCall = (type: 'voice' | 'video') => {
    setShowCallMenu(false);
    setActiveCall(type);
      try { (window as any).p1Call && (window as any).p1Call.start && (window as any).p1Call.start(chat.id, type); } catch (_) {}
};

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const togglePlusMenu = () => {
    setIsPlusOpen(!isPlusOpen);
    setTimeout(scrollToBottom, 100);
  };

  const handleMessageTouchStart = (e: React.TouchEvent, msg: Message) => {
    if (msg.kind === 'voice') return;
    const touch = e.touches[0];
    const { clientX, clientY } = touch;
    timerRef.current = setTimeout(() => {
      let menuY = clientY - 140;
      if (menuY < 60) menuY = clientY + 20;
      setMsgContextMenu({
        visible: true,
        x: Math.min(Math.max(clientX - 150, 10), window.innerWidth - 310),
        y: menuY,
        message: msg,
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

  const menuItems = [
    { icon: <ImageIcon size={24} />, label: '照片', action: () => handleFileAction('image') },
    { icon: <Camera size={24} />, label: '拍摄', action: () => handleFileAction('image') },
    { icon: <Video size={24} />, label: '视频通话', action: () => setShowCallMenu(true) },
    { icon: <MapPin size={24} />, label: '位置', action: () => {} },
    { icon: <Wallet size={24} />, label: '红包', action: () => {} },
    { icon: <FolderHeart size={24} />, label: '收藏', action: () => {} },
    { icon: <UserIcon size={24} />, label: '个人名片', action: () => {} },
    { icon: <Smartphone size={24} />, label: '文件', action: () => handleFileAction('file') },
  ];

  // 媒体 URL：对齐旧版 smartCore.play + 修正 /core/ 作用域
  const getMediaSrc = (msg: any) => {
    if (msg.meta?.previewDataUrl) return msg.meta.previewDataUrl;
    if (msg.meta?.fileObj) return URL.createObjectURL(msg.meta.fileObj);
    if (msg.meta?.fileId && window.smartCore) {
      const u = window.smartCore.play(
        msg.meta.fileId,
        msg.meta.fileName || msg.meta.fileName || '',
      );
      return normalizeVirtualUrl(u);
    }
    return msg.txt || '';
  };

  return (
    <div className="fixed inset-0 bg-[#EDEDED] z-50 flex flex-col animate-in slide-in-from-right duration-300">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* 图片预览覆盖层 */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center animate-in fade-in duration-200"
          onClick={() => setPreviewUrl(null)}
        >
          <img
            src={previewUrl}
            className="max-w-full max-h-full object-contain"
            alt="Preview"
          />
          <button
            className="absolute top-10 right-4 p-2 bg-white/20 rounded-full text-white backdrop-blur-sm active:bg-white/30"
            onClick={() => setPreviewUrl(null)}
          >
            <X size={24} strokeWidth={2} />
          </button>
        </div>
      )}

      {/* 日志控制台 */}
      {showLog && <LogConsole onClose={() => setShowLog(false)} />}

      {/* Call Overlay */}
      {activeCall && !(window as any).__p1_call_ui_native && (
        <CallOverlay
          user={chat.user}
          type={activeCall}
          onHangup={() => { try { (window as any).p1Call && (window as any).p1Call.hangup && (window as any).p1Call.hangup(); } catch (_) {} setActiveCall(null); }}
        />
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-2 h-[56px] bg-[#EDEDED]/90 backdrop-blur-md border-b border-gray-300/50 shrink-0 z-10">
        <button
          onClick={onBack}
          className="p-2 -ml-1 text-[#191919] hover:bg-gray-200/50 rounded-full transition-colors flex items-center active:opacity-60"
        >
          <ChevronLeft size={26} strokeWidth={1.5} />
          <span className="text-[16px] font-normal ml-[-4px]">
            {chat.unreadCount > 0 ? `(${chat.unreadCount})` : '微信'}
          </span>
        </button>
        <span className="text-[17px] font-medium text-[#191919] absolute left-1/2 -translate-x-1/2">
          {chat.user.name}
        </span>
        <div className="flex items-center">
          {/* 日志按钮 */}
          <button
            onClick={() => setShowLog(true)}
            className="p-2 text-[#191919] hover:bg-gray-200/50 rounded-full active:opacity-60 mr-1"
            title="打开日志"
          >
            <FileText size={24} strokeWidth={1.5} />
          </button>

          <button
            onClick={onUserClick}
            className="p-2 text-[#191919] hover:bg-gray-200/50 rounded-full active:opacity-60"
          >
            <MoreHorizontal size={24} strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {/* Message List */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto no-scrollbar p-4 bg-[#EDEDED] relative"
        onClick={() => {
          setIsPlusOpen(false);
          setMsgContextMenu({ ...msgContextMenu, visible: false });
        }}
        onTouchStart={() =>
          setMsgContextMenu({ ...msgContextMenu, visible: false })
        }
      >
        {messages.map((msg: any, idx) => {
          const isMe = msg.senderId === currentUserId;
          const showTime =
            idx === 0 ||
            new Date(msg.timestamp).getTime() -
              new Date(messages[idx - 1].timestamp).getTime() >
              5 * 60 * 1000;
          const isContextActive =
            msgContextMenu.visible && msgContextMenu.message?.id === msg.id;
          const bubbleColorHex = isMe
            ? isContextActive
              ? '#89D960'
              : '#95EC69'
            : isContextActive
            ? '#F2F2F2'
            : '#FFFFFF';

          const meta = msg.meta || {};
          const fileType = meta.fileType || msg.fileType || '';
          const fileName = meta.fileName || msg.fileName || '';

          // 修复：优先判断 voice 类型，防止 webm 格式录音被误判为视频
          const isVoice = msg.kind === 'voice';

          const isVideo =
            !isVoice &&
            ((typeof fileType === 'string' && fileType.startsWith('video/')) ||
            /\.(mp4|mov|m4v|webm)$/i.test(fileName || '') ||
            msg.kind === 'video');

          const isImage =
            !isVoice &&
            !isVideo &&
            ((typeof fileType === 'string' &&
              fileType.startsWith('image/')) ||
              /\.(png|jpe?g|gif|webp|bmp)$/i.test(fileName || '') ||
              msg.kind === 'image');

          const isFile =
            msg.kind === 'SMART_FILE_UI' && !isVideo && !isImage && !isVoice;



          const mediaSrc = (isImage || isVideo) ? getMediaSrc(msg) : '';

          return (
            <div key={msg.id || idx} className="mb-4 relative">
              {showTime && (
                <div className="flex justify-center mt-6 mb-[18px]">
                  <span className="text-[12px] text-gray-400/90 bg-gray-200/60 px-2 py-0.5 rounded-[4px]">
                    {formatMessageTime(msg.timestamp)}
                  </span>
                </div>
              )}

              <div
                className={`flex ${
                  isMe ? 'flex-row-reverse' : 'flex-row'
                } items-start group`}
              >
                <img
                  src={
                    isMe
                      ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUserId}`
                      : chat.user.avatar
                  }
                  className="w-10 h-10 rounded-[6px] shadow-sm object-cover bg-gray-200 cursor-pointer flex-shrink-0"
                  onClick={!isMe && onUserClick ? onUserClick : undefined}
                  alt="Avatar"
                />

                <div
                  className={`max-w-[70%] ${
                    isMe ? 'mr-2.5' : 'ml-2.5'
                  } transition-opacity duration-200`}
                  onTouchStart={(e) => handleMessageTouchStart(e, msg)}
                  onTouchEnd={handleMessageTouchEnd}
                  onContextMenu={(e) => e.preventDefault()}
                >
{isImage ? (
                    <ImageMessage
                      src={mediaSrc}
                      alt="Image"
                      isMe={isMe}
                      onPreview={setPreviewUrl}
                    />
                  ) : isVideo ? (
                    <VideoMessage
                      src={mediaSrc}
                      fileName={fileName || 'Video'}
                      isMe={isMe}
                       posterUrl={meta?.poster}
                    />
                  ) : isFile ? (
                    <div
                      onClick={() => handleSmartFileDownload(msg)}
                      className="bg-white p-3 rounded-[4px] shadow-sm border border-gray-100 cursor-pointer active:bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        <div className="bg-blue-500 text-white p-2 rounded">
                          📄
                        </div>
                        <div>
                          <div className="text-sm font-medium">
                            {meta?.fileName || '未知文件'}
                          </div>
                          <div className="text-xs text-gray-400">
                            {meta?.fileSize
                              ? (
                                  meta.fileSize /
                                  1024 /
                                  1024
                                ).toFixed(2)
                              : 0}{' '}
                            MB
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : isVoice ? (
                    <VoiceMessage
                      duration={parseInt(msg.txt || '0')}
                      isMe={isMe}
                      isPlaying={playingMessageId === msg.id}
                      onPlay={() => handlePlayVoice(msg)}
                    />
                  ) : (
                    <div
                      className="relative px-2.5 py-2 rounded-[4px] text-[16px] text-[#191919] leading-relaxed break-words shadow-sm select-none min-h-[40px] flex items-center"
                      style={{ backgroundColor: bubbleColorHex }}
                    >
                      <div
                        className={`absolute top-[14px] w-0 h-0 border-[6px] border-transparent ${
                          isMe ? 'right-[-6px]' : 'left-[-6px]'
                        }`}
                        style={{
                          borderLeftColor: isMe
                            ? bubbleColorHex
                            : 'transparent',
                          borderRightColor: !isMe
                            ? bubbleColorHex
                            : 'transparent',
                          borderTopColor: 'transparent',
                          borderBottomColor: 'transparent',
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
          <div
            className="fixed z-[9999] flex flex-col items-center"
            style={{
              top: msgContextMenu.y,
              left: '50%',
              transform: 'translateX(-50%)',
            }}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="bg-[#4C4C4C] rounded-[8px] p-2 shadow-2xl animate-in zoom-in-95 duration-100 w-[300px]">
              <div className="grid grid-cols-5 gap-y-3 gap-x-1">
                <ContextMenuItem icon={<Copy />} label="复制" />
                <ContextMenuItem icon={<Share />} label="转发" />
                <ContextMenuItem icon={<FolderHeart />} label="收藏" />
                <ContextMenuItem icon={<Trash2 />} label="删除" onClick={() => {
                   if (msgContextMenu.message) {
                     setMessages(prev => prev.filter(m => m.id !== msgContextMenu.message?.id));
                     setMsgContextMenu(prev => ({ ...prev, visible: false }));
                   }
                }} />
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

      <div
        className={`bg-[#F7F7F7] border-t border-gray-300/50 transition-all duration-200 z-30 ${
          isPlusOpen ? 'pb-0' : 'pb-safe-bottom'
        }`}
      >
        <div className="flex items-end px-3 py-2 gap-2 min-h-[56px]">
          <button
            onClick={() => setIsVoiceMode(!isVoiceMode)}
            className="mb-2 p-1 text-[#191919] active:opacity-60"
          >
            {isVoiceMode ? (
              <Keyboard size={28} strokeWidth={1.5} />
            ) : (
              <Mic size={28} strokeWidth={1.5} />
            )}
          </button>
          <div className="flex-1 mb-1.5">
            {isVoiceMode ? (
              <button
                className={`w-full h-[40px] rounded-[6px] font-medium text-[16px] transition-colors select-none ${
                  voiceRecording
                    ? 'bg-[#DEDEDE] text-[#191919]'
                    : 'bg-white text-[#191919] active:bg-[#DEDEDE]'
                }`}
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                onTouchMove={handleTouchMove}
              >
                {voiceRecording ? (isRecordingCancel ? '松开 取消' : '松开 结束') : '按住 说话'}
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
            <button
              onClick={handleSendText}
              className="mb-2 bg-[#07C160] text-white px-3 py-1.5 rounded-[4px] text-[14px] font-medium active:bg-[#06AD56]"
            >
              发送
            </button>
          ) : (
            <button
              onClick={togglePlusMenu}
              className="mb-2 p-1 text-[#191919] active:opacity-60 transition-transform duration-200"
              style={{ transform: isPlusOpen ? 'rotate(45deg)' : 'rotate(0)' }}
            >
              <PlusCircle size={28} strokeWidth={1.5} />
            </button>
          )}
        </div>
        {isPlusOpen && (
          <div className="h-[240px] bg-[#F7F7F7] border-t border-gray-300/50 p-6 pb-safe-bottom grid grid-cols-4 gap-y-6">
            {menuItems.map((item, idx) => (
              <div
                key={idx}
                className="flex flex-col items-center gap-2 cursor-pointer active:opacity-60"
                onClick={
                  item.action
                    ? item.action
                    : () => onShowToast('功能暂未开放')
                }
              >
                <div className="w-[60px] h-[60px] bg-white rounded-[16px] flex items-center justify-center text-[#5C5C5C] shadow-sm border border-gray-100">
                  {React.cloneElement(
                    item.icon as React.ReactElement<any>,
                    { strokeWidth: 1.2, size: 28 },
                  )}
                </div>
                <span className="text-[12px] text-gray-500">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCallMenu && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/40 transition-opacity"
            onClick={() => setShowCallMenu(false)}
          ></div>
          <div className="relative z-[110] bg-[#F7F7F7] rounded-t-[12px] overflow-hidden safe-bottom slide-in-from-bottom">
            <div className="bg-white flex flex-col">
              <button
                onClick={() => startCall('video')}
                className="w-full py-3.5 text-[17px] text-[#191919] font-normal active:bg-[#F2F2F2] border-b border-gray-100/50 flex items-center justify-center"
              >
                视频通话
              </button>
              <button
                onClick={() => startCall('voice')}
                className="w-full py-3.5 text-[17px] text-[#191919] font-normal active:bg-[#F2F2F2] flex items-center justify-center"
              >
                语音通话
              </button>
            </div>
            <div className="mt-2 bg-white">
              <button
                className="w-full py-3.5 text-[17px] text-[#191919] font-normal active:bg-[#F2F2F2]"
                onClick={() => setShowCallMenu(false)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {voiceRecording && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
           <div className="absolute inset-0 bg-black/40"></div>
           <style>{`
             @keyframes voice-wave {
               0%, 100% { transform: scaleY(0.25); opacity: 0.55; }
               50% { transform: scaleY(1); opacity: 1; }
             }
           `}</style>
           <div className={`relative w-[180px] h-[180px] rounded-[16px] flex flex-col items-center justify-center shadow-2xl animate-in zoom-in duration-200 transition-colors ${isRecordingCancel ? 'bg-red-500' : 'bg-[#95EC69]'}`}>
              <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 transition-colors ${isRecordingCancel ? 'bg-red-500' : 'bg-[#95EC69]'}`}></div>
              <div className="flex items-center gap-1.5 h-12 mb-4">
                  {[1,2,3,4,5,6,7].map(i => (
                    <div 
                      key={i} 
                      className="w-1.5 bg-[#191919] rounded-full"
                      style={{
                        height: '32px',
                        transformOrigin: 'center bottom',
                        willChange: 'transform',
                        animation: `voice-wave ${0.45 + Math.random() * 0.55}s ease-in-out infinite`,
                        animationDelay: `${Math.random() * 0.18}s`,
                      }}
                    ></div>
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
