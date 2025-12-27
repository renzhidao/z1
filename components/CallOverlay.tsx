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
  // --- 状态管理 ---
  const [callStatus, setCallStatus] = useState<'calling' | 'connected'>('calling');
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(type === 'video');
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  
  // false: 对方大屏，我小窗 (默认)
  // true: 我大屏，对方小窗
  const [isSwapped, setIsSwapped] = useState(false); 
  
  // PiP 位置 (使用 Ref 管理实时拖拽，State 管理最终位置)
  const pipPosRef = useRef({ x: 20, y: 100 });
  const [pipPosState, setPipPosState] = useState({ x: 20, y: 100 }); 
  const [hasInitializedPos, setHasInitializedPos] = useState(false);
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // 两个容器的 Ref，用于直接操作 DOM 样式
  const localContainerRef = useRef<HTMLDivElement>(null);
  const remoteContainerRef = useRef<HTMLDivElement>(null);

  // --- 1. 初始化逻辑 ---
  useEffect(() => {
    // 强制隐藏旧 UI
    const style = document.createElement('style');
    style.innerHTML = `
      #p1-call-container, .p1-call-overlay, [id^="p1-call-"] { display: none !important; }
      #p1-react-call-overlay { display: block !important; }
    `;
    document.head.appendChild(style);

    // 初始化 PiP 位置 (右上角)
    if (window.innerWidth) {
        const initX = window.innerWidth - 112 - 16;
        const initY = 96;
        pipPosRef.current = { x: initX, y: initY };
        setPipPosState({ x: initX, y: initY });
        setHasInitializedPos(true);
    }

    // 绑定流 (只执行一次，因为 Video 标签不再销毁)
    const t = setTimeout(() => {
        callAction('attach', {
          localVideo: localVideoRef.current,
          remoteVideo: remoteVideoRef.current,
          remoteAudio: remoteAudioRef.current,
        });
        if (remoteAudioRef.current) remoteAudioRef.current.play().catch(() => {});
    }, 500);

    return () => { 
        document.head.removeChild(style); 
        clearTimeout(t);
    };
  }, []); // 空依赖，确保只运行一次

  // --- 2. 状态监听 ---
  useEffect(() => {
    const onStateChange = (e: CustomEvent) => {
        if (['connected', 'active'].includes(e.detail?.state)) setCallStatus('connected');
    };
    window.addEventListener('p1-call-state-changed' as any, onStateChange);
    
    // 轮询流状态作为兜底
    const checkStream = setInterval(() => {
        if (remoteVideoRef.current && (remoteVideoRef.current.srcObject as MediaStream)?.active) {
            setCallStatus('connected');
            clearInterval(checkStream);
        }
    }, 1000);

    return () => {
        window.removeEventListener('p1-call-state-changed' as any, onStateChange);
        clearInterval(checkStream);
    };
  }, []);

  // --- 3. 计时器 ---
  useEffect(() => {
    if (callStatus !== 'connected') return;
    const timer = setInterval(() => setDurationSeconds(p => p + 1), 1000);
    return () => clearInterval(timer);
  }, [callStatus]);

  // --- 4. 操作函数 ---
  const handleHangup = () => { callAction('hangup'); onHangup(); };
  const toggleMic = () => { setIsMicOn(p => !p); callAction('setMuted', isMicOn); };
  const toggleSpeaker = () => { setIsSpeakerOn(p => !p); callAction('setSpeaker', !isSpeakerOn); };
  const toggleCam = () => { setIsCamOn(p => !p); callAction('setVideoEnabled', !isCamOn); };
  const switchCamera = () => { setIsFrontCamera(p => !p); callAction('switchCamera'); };

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // --- 5. 拖拽逻辑 (高性能版) ---
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);

  // 获取当前作为 PiP 的那个元素
  const getPipElement = () => {
    // 如果 isSwapped 为 true，Remote 是 PiP；否则 Local 是 PiP
    return isSwapped ? remoteContainerRef.current : localContainerRef.current;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    // 只有点击的是当前 PiP 元素时才触发
    const target = e.currentTarget as HTMLElement;
    // 简单判断：如果当前 target 是全屏状态，忽略拖拽
    // 我们通过 CSS 类名判断，或者直接根据 isSwapped 判断点击的是否是 PiP
    // 这里我们将事件绑定在具体的 VideoContainer 上，通过逻辑判断是否允许拖拽
    
    // 但为了代码简单，我们把事件绑在两个容器上，内部判断
    // 见下方 renderVideoContainer
  };

  const handlePipPointerDown = (e: React.PointerEvent, isPip: boolean) => {
    if (!isPip) return; // 全屏状态不可拖拽
    e.preventDefault(); e.stopPropagation();
    
    draggingRef.current = true;
    hasDraggedRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePipPointerMove = (e: React.PointerEvent, isPip: boolean) => {
    if (!draggingRef.current || !isPip) return;
    
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasDraggedRef.current = true;
    
    const newX = pipPosRef.current.x + dx;
    const newY = pipPosRef.current.y + dy;
    
    // 直接操作 DOM 避免重绘
    e.currentTarget.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
  };

  const handlePipPointerUp = (e: React.PointerEvent, isPip: boolean) => {
    if (!draggingRef.current) {
        // 如果是点击且是 PiP，则交换
        if (isPip && !hasDraggedRef.current) {
            setIsSwapped(p => !p);
        }
        return;
    }
    
    draggingRef.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    
    if (!hasDraggedRef.current) {
        setIsSwapped(p => !p); // 点击切换
        // 恢复位置（因为没有实际拖动）
        const el = e.currentTarget as HTMLElement;
        el.style.transform = `translate3d(${pipPosRef.current.x}px, ${pipPosRef.current.y}px, 0)`;
    } else {
        // 拖拽结束，更新 Ref 和 State，并做边界限制
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        let finalX = pipPosRef.current.x + dx;
        let finalY = pipPosRef.current.y + dy;

        if (containerRef.current) {
            const { clientWidth, clientHeight } = containerRef.current;
            finalX = Math.max(12, Math.min(clientWidth - 112 - 12, finalX));
            finalY = Math.max(80, Math.min(clientHeight - 176 - 150, finalY));
        }

        pipPosRef.current = { x: finalX, y: finalY };
        setPipPosState({ x: finalX, y: finalY }); // 触发一次重绘以同步位置
        
        // 确保 DOM 位置也对齐
        e.currentTarget.style.transform = `translate3d(${finalX}px, ${finalY}px, 0)`;
    }
  };

  // --- 6. 渲染辅助 ---
  // 这是核心：定义两种样式类
  const FULLSCREEN_CLASS = "absolute inset-0 z-0 w-full h-full transition-all duration-300 ease-in-out";
  const PIP_CLASS = "absolute z-20 w-28 h-44 rounded-xl overflow-hidden border border-white/20 shadow-2xl cursor-move touch-none transition-all duration-300 ease-in-out bg-black";

  // 通用视频容器组件
  const VideoContainer = ({ 
    isLocal, 
    videoRef, 
    containerRef, 
    isPip 
  }: { 
    isLocal: boolean, 
    videoRef: React.RefObject<HTMLVideoElement>, 
    containerRef: React.RefObject<HTMLDivElement>, 
    isPip: boolean 
  }) => {
    // 动态样式
    const className = isPip ? PIP_CLASS : FULLSCREEN_CLASS;
    // 动态位置：只有 PiP 需要 transform
    const style = isPip ? { transform: `translate3d(${pipPosState.x}px, ${pipPosState.y}px, 0)` } : {};

    return (
      <div 
        ref={containerRef}
        className={className}
        style={style}
        onPointerDown={(e) => handlePipPointerDown(e, isPip)}
        onPointerMove={(e) => handlePipPointerMove(e, isPip)}
        onPointerUp={(e) => handlePipPointerUp(e, isPip)}
        onPointerCancel={(e) => handlePipPointerUp(e, isPip)}
      >
        <div className="relative w-full h-full bg-black">
           {/* 视频层 */}
           <video 
             ref={videoRef}
             autoPlay 
             playsInline 
             muted={isLocal} // 本地静音，远端不静音
             className={`w-full h-full object-cover ${isLocal ? 'transform scale-x-[-1]' : ''} ${isLocal && !isCamOn ? 'opacity-0' : 'opacity-100'}`}
           />
           
           {/* 占位层 (视频加载前/无视频时显示) */}
           <div className={`absolute inset-0 -z-10 flex flex-col items-center justify-center ${isPip ? '' : 'bg-gray-900'}`}>
              {isLocal ? (
                  <div className="text-white/40 flex flex-col items-center">
                     <VideoOff size={isPip ? 24 : 48} />
                     {!isPip && <span className="mt-2 text-sm">摄像头已关闭</span>}
                  </div>
              ) : (
                  <>
                    <img src={user.avatar} className="absolute inset-0 w-full h-full object-cover opacity-30 blur-xl" alt="" />
                    <div className="relative flex flex-col items-center z-10">
                        <img src={user.avatar} className={`${isPip ? 'w-12 h-12' : 'w-24 h-24'} rounded-2xl shadow-lg mb-2`} alt="" />
                        {!isPip && <span className="text-white text-xl font-medium drop-shadow-md">{user.name}</span>}
                        {!isPip && callStatus === 'calling' && <span className="text-white/60 text-sm mt-2">正在呼叫...</span>}
                    </div>
                  </>
              )}
           </div>
           
           {/* PiP 标签 */}
           {isPip && (
             <div className="absolute bottom-1 left-1 bg-black/40 backdrop-blur-sm px-1 rounded text-[10px] text-white/80 pointer-events-none">
                {isLocal ? '我' : user.name}
             </div>
           )}
        </div>
      </div>
    );
  };

  // 逻辑：默认 Main=Remote (isPip=false), PiP=Local (isPip=true)
  // Swapped: Main=Local (isPip=false), PiP=Remote (isPip=true)
  
  const localIsPip = !isSwapped;
  const remoteIsPip = isSwapped;

  return (
    <div id="p1-react-call-overlay" ref={containerRef} className="fixed inset-0 z-[100] bg-gray-900 overflow-hidden select-none animate-in fade-in duration-300">
      
      {/* 隐藏的音频播放器 (始终存在) */}
      <audio ref={remoteAudioRef} autoPlay className="hidden" />

      {/* 1. 远端视频容器 (根据状态切换样式) */}
      <VideoContainer 
         isLocal={false} 
         videoRef={remoteVideoRef} 
         containerRef={remoteContainerRef}
         isPip={remoteIsPip} 
      />

      {/* 2. 本地视频容器 (根据状态切换样式) */}
      <VideoContainer 
         isLocal={true} 
         videoRef={localVideoRef} 
         containerRef={localContainerRef}
         isPip={localIsPip} 
      />

      {/* --- UI Controls Layer (始终在最上层) --- */}
      
      {/* Top Controls */}
      <div className="absolute top-0 left-0 right-0 pt-safe-top px-4 pb-4 flex justify-between items-center z-30 text-white pointer-events-none bg-gradient-to-b from-black/60 to-transparent">
        <div onClick={onHangup} className="p-3 bg-white/10 rounded-full backdrop-blur-md active:bg-white/20 pointer-events-auto cursor-pointer">
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

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 pb-safe-bottom pt-32 px-8 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-30 pointer-events-none">
        <div className="flex justify-between items-center mb-12 px-4 pointer-events-auto">
          <div className="flex flex-col items-center space-y-3">
            <button onClick={toggleMic} className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-colors ${isMicOn ? 'bg-white text-black' : 'bg-white/20 text-white'}`}>
              {isMicOn ? <Mic size={28} /> : <MicOff size={28} />}
            </button>
            <span className="text-xs text-white/90">麦克风</span>
          </div>
          <div className="flex flex-col items-center space-y-3">
            <button onClick={toggleSpeaker} className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-colors ${isSpeakerOn ? 'bg-white text-black' : 'bg-white/20 text-white'}`}>
              {isSpeakerOn ? <Volume2 size={28} /> : <VolumeX size={28} />}
            </button>
            <span className="text-xs text-white/90">扬声器</span>
          </div>
          <div className="flex flex-col items-center space-y-3">
            <button onClick={toggleCam} className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-colors ${isCamOn ? 'bg-white text-black' : 'bg-white/20 text-white'}`}>
              {isCamOn ? <VideoIcon size={28} /> : <VideoOff size={28} />}
            </button>
            <span className="text-xs text-white/90">摄像头</span>
          </div>
        </div>

        <div className="flex justify-between items-center px-6 pb-6 pointer-events-auto">
          <div className="w-12"></div>
          <button onClick={handleHangup} className="w-16 h-16 rounded-full bg-[#ff3b30] flex items-center justify-center shadow-lg active:scale-90 transition-transform">
            <PhoneOff size={36} className="text-white fill-current" />
          </button>
          <button onClick={switchCamera} className="w-12 h-12 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20 transition-colors">
            <RefreshCcw size={24} className="text-white" />
          </button>
        </div>
      </div>

    </div>
  );
};

export default CallOverlay;
