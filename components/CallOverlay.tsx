import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, Volume2, VolumeX, Video as VideoIcon, VideoOff, 
  PhoneOff, Minimize2, RefreshCcw, Plus 
} from 'lucide-react';
import { User } from '../types';

interface CallOverlayProps {
  user: User;
  onHangup: () => void;
  type: 'voice' | 'video';
}

const callAction = (action: string, ...args: any[]) => {
  try {
    const p1Call = (window as any).p1Call;
    if (p1Call && typeof p1Call[action] === 'function') {
      p1Call[action](...args);
    }
  } catch (e) { console.error(e); }
};

export const CallOverlay: React.FC<CallOverlayProps> = ({ user, onHangup, type }) => {
  const [callStatus, setCallStatus] = useState<'calling' | 'connected'>('calling');
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(type === 'video');
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isSwapped, setIsSwapped] = useState(false); 
  const [pipPos, setPipPos] = useState({ x: 20, y: 100 });
  const [hasInitializedPos, setHasInitializedPos] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // 1. 强制隐藏旧 UI
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      #p1-call-container, .p1-call-overlay, [id^="p1-call-"] { display: none !important; }
      #p1-react-call-overlay { display: block !important; }
    `;
    document.head.appendChild(style);
    return () => { try { document.head.removeChild(style); } catch(_) {} };
  }, []);

  // 2. 监听通话状态 (模拟/真实)
  useEffect(() => {
    // 监听底层状态变更
    const onStateChange = (e: CustomEvent) => {
        const s = e.detail?.state;
        if (s === 'connected' || s === 'active') {
            setCallStatus('connected');
        }
    };
    window.addEventListener('p1-call-state-changed' as any, onStateChange);

    // 兜底：如果底层没发事件，5秒后自动视为接通 (仅供演示，生产环境应删掉)
    // const t = setTimeout(() => setCallStatus('connected'), 3000);

    // 另外：如果已经有流了，也视为接通
    const checkStream = setInterval(() => {
        if (remoteVideoRef.current && (remoteVideoRef.current.srcObject as MediaStream)?.active) {
            setCallStatus('connected');
            clearInterval(checkStream);
        }
    }, 1000);

    return () => {
        window.removeEventListener('p1-call-state-changed' as any, onStateChange);
        // clearTimeout(t);
        clearInterval(checkStream);
    };
  }, []);

  // 3. 计时器 (仅在 connected 后开始)
  useEffect(() => {
    if (callStatus !== 'connected') return;
    const timer = setInterval(() => setDurationSeconds(p => p + 1), 1000);
    return () => clearInterval(timer);
  }, [callStatus]);

  // 4. 初始化 PiP
  useEffect(() => {
    if (containerRef.current && !hasInitializedPos) {
      const { clientWidth } = containerRef.current;
      setPipPos({ x: clientWidth - 112 - 16, y: 96 }); // w-28 = 112px
      setHasInitializedPos(true);
    }
  }, [hasInitializedPos]);

  // 5. 绑定流
  useEffect(() => {
    const bind = () => {
       callAction('attach', {
          localVideo: localVideoRef.current,
          remoteVideo: remoteVideoRef.current,
          remoteAudio: remoteAudioRef.current,
       });
       if (remoteAudioRef.current) remoteAudioRef.current.play().catch(() => {});
    };
    bind();
    const t = setTimeout(bind, 800);
    return () => clearTimeout(t);
  }, [isSwapped, isCamOn]);

  const toggleMic = () => { setIsMicOn(!isMicOn); callAction('setMuted', !isMicOn); };
  const toggleSpeaker = () => { setIsSpeakerOn(!isSpeakerOn); callAction('setSpeaker', !isSpeakerOn); };
  const toggleCam = () => { setIsCamOn(!isCamOn); callAction('setVideoEnabled', !isCamOn); };
  const switchCamera = () => { setIsFrontCamera(!isFrontCamera); callAction('switchCamera'); };
  
  const handleHangup = () => {
    callAction('hangup');
    onHangup();
  };

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Dragging Logic
  const draggingRef = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const initialPipPos = useRef({ x: 0, y: 0 });
  const hasDragged = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    draggingRef.current = true; hasDragged.current = false;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    initialPipPos.current = { ...pipPos };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - dragStartPos.current.x;
    const dy = e.clientY - dragStartPos.current.y;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasDragged.current = true;
    setPipPos({ x: initialPipPos.current.x + dx, y: initialPipPos.current.y + dy });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    if (!hasDragged.current) setIsSwapped(p => !p);
    else if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setPipPos(prev => ({
            x: Math.max(12, Math.min(clientWidth - 112 - 12, prev.x)),
            y: Math.max(80, Math.min(clientHeight - 176 - 200, prev.y))
        }));
    }
  };

  // Renderers
  const renderLocal = () => (
    <div className="w-full h-full bg-black relative">
       <video 
         ref={localVideoRef}
         autoPlay playsInline muted 
         className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-300 ${isCamOn ? 'opacity-100' : 'opacity-0'}`}
       />
       {!isCamOn && (
         <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800 text-white/40">
            <VideoOff size={32} />
         </div>
       )}
    </div>
  );

  const renderRemote = () => (
    <div className="w-full h-full bg-black relative">
      <audio ref={remoteAudioRef} autoPlay className="hidden" />
      <video 
         ref={remoteVideoRef}
         autoPlay playsInline
         className="w-full h-full object-cover relative z-10"
         style={{ backgroundColor: 'transparent' }} 
      />
      <div className="absolute inset-0 z-0">
         <img src={user.avatar} className="w-full h-full object-cover opacity-30 blur-xl" alt="bg" />
         <div className="absolute inset-0 flex flex-col items-center justify-center">
             <img src={user.avatar} className="w-24 h-24 rounded-2xl shadow-2xl mb-4" alt="avatar" />
             <span className="text-white text-xl font-medium drop-shadow-md">{user.name}</span>
             {callStatus === 'calling' && <span className="text-white/60 text-sm mt-2">正在等待对方接受邀请...</span>}
         </div>
      </div>
    </div>
  );

  const MainContent = isSwapped ? renderLocal() : renderRemote();
  const PiPContent = isSwapped ? renderRemote() : renderLocal();

  return (
    <div id="p1-react-call-overlay" ref={containerRef} className="fixed inset-0 z-[100] bg-gray-900 overflow-hidden flex flex-col select-none animate-in fade-in duration-300">
      <div className="absolute inset-0 z-0">{MainContent}</div>

      {/* Top Controls */}
      <div className="absolute top-0 left-0 right-0 pt-safe-top px-4 pb-4 flex justify-between items-center z-10 text-white pointer-events-none bg-gradient-to-b from-black/60 to-transparent">
        <div onClick={onHangup} className="p-3 bg-white/10 rounded-full backdrop-blur-md active:bg-white/20 pointer-events-auto">
          <Minimize2 size={24} />
        </div>
        <div className="flex flex-col items-center">
             <div className="text-xl font-medium drop-shadow-md">{isSwapped ? '我' : user.name}</div>
             <div className="text-sm opacity-80 font-light">
                {callStatus === 'calling' ? '正在呼叫...' : formatDuration(durationSeconds)}
             </div>
        </div>
        <div className="p-3 opacity-0"><Plus size={24} /></div>
      </div>

      {/* PiP Window */}
      <div 
        className="absolute w-28 h-44 bg-black rounded-xl overflow-hidden border border-white/20 shadow-2xl z-20 cursor-move touch-none"
        style={{ 
          transform: `translate3d(${pipPos.x}px, ${pipPos.y}px, 0)`,
          transition: draggingRef.current ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)'
        }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      >
         {PiPContent}
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 pb-safe-bottom pt-32 px-8 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-30">
        <div className="flex justify-between items-center mb-12 px-4">
          <div className="flex flex-col items-center space-y-3">
            <button onClick={toggleMic} className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg active:scale-95 ${isMicOn ? 'bg-white text-black' : 'bg-white/20 text-white'}`}>
              {isMicOn ? <Mic size={28} /> : <MicOff size={28} />}
            </button>
            <span className="text-xs text-white/90">麦克风</span>
          </div>
          <div className="flex flex-col items-center space-y-3">
            <button onClick={toggleSpeaker} className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg active:scale-95 ${isSpeakerOn ? 'bg-white text-black' : 'bg-white/20 text-white'}`}>
              {isSpeakerOn ? <Volume2 size={28} /> : <VolumeX size={28} />}
            </button>
            <span className="text-xs text-white/90">扬声器</span>
          </div>
          <div className="flex flex-col items-center space-y-3">
            <button onClick={toggleCam} className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg active:scale-95 ${isCamOn ? 'bg-white text-black' : 'bg-white/20 text-white'}`}>
              {isCamOn ? <VideoIcon size={28} /> : <VideoOff size={28} />}
            </button>
            <span className="text-xs text-white/90">摄像头</span>
          </div>
        </div>

        <div className="flex justify-between items-center px-6 pb-6">
          <div className="w-12"></div>
          <button onClick={handleHangup} className="w-16 h-16 rounded-full bg-[#ff3b30] flex items-center justify-center shadow-lg active:scale-90">
            <PhoneOff size={36} className="text-white fill-current" />
          </button>
          <button onClick={switchCamera} className="w-12 h-12 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20">
            <RefreshCcw size={24} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallOverlay;
