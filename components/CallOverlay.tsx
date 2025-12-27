import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, Volume2, VolumeX, Video as VideoIcon, VideoOff, 
  PhoneOff, Minimize2, RefreshCcw, Plus, FlipHorizontal
} from 'lucide-react';
import { User } from '../types';
import { useCoreBridge } from '../hooks/useCoreBridge';

interface CallOverlayProps {
  user: User;
  onHangup: (info?: { duration?: string; canceled?: boolean }) => void;
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
  const { currentUser } = useCoreBridge();
  const [callStatus, setCallStatus] = useState<'calling' | 'connected' | 'ended'>('calling');
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(type === 'video');
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isMirrored, setIsMirrored] = useState(true);
  const [isSwapped, setIsSwapped] = useState(false); 
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [pipPos, setPipPos] = useState({ x: 20, y: 100 });
  const [pipSize, setPipSize] = useState({ width: 128, height: 192 });
  const [remoteHasVideo, setRemoteHasVideo] = useState(false);

  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const pipStartRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // 隐藏原生 UI
  useEffect(() => {
    const style = document.createElement('style');
    style.setAttribute('data-p1-react-overlay-style', '1');
    style.innerHTML = `#p1-call-container, .p1-call-overlay, [id^="p1-call-"] { display: none !important; } #p1-react-call-overlay { display: block !important; }`;
    document.head.appendChild(style);
    return () => { try { document.head.removeChild(style); } catch (_) {} };
  }, []);

  // 挂载后 attach
  useEffect(() => {
    const t = setTimeout(() => {
      callAction('attach', {
        localVideo: localVideoRef.current,
        remoteVideo: remoteVideoRef.current,
        remoteAudio: remoteAudioRef.current,
      });
      if (remoteAudioRef.current) remoteAudioRef.current.play().catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, []);

  // 获取本地摄像头 (恢复原版逻辑)
  useEffect(() => {
    const startCamera = async () => {
      try {
        if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: isFrontCamera ? 'user' : 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        setHasCameraPermission(true);
        
        callAction('attach', {
          localVideo: localVideoRef.current,
          remoteVideo: remoteVideoRef.current,
          remoteAudio: remoteAudioRef.current,
        });
      } catch (err) {
        console.error('Camera error:', err);
        setHasCameraPermission(false);
      }
    };
    const stopCamera = () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
    };
    if (isCamOn) startCamera(); else stopCamera();
    return () => { if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop()); };
  }, [isCamOn, isFrontCamera]);

  // PiP 位置初始化
  
  // PiP 尺寸与位置初始化 (1/3高度 + 保持旧版Top)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const h = (window.innerHeight - 96) / 3;      // 高度占1/3
      const w = h * (9 / 16);                // 宽度按 9:16
      setPipSize({ width: w, height: h });
      // 位置：靠右 (屏幕宽 - 小窗宽 - 16px边距)，Top保持旧版 96
      setPipPos({ x: window.innerWidth - w - 16, y: 96 });
    }
  }, []);


  // 状态监听
  useEffect(() => {
    const onStateChange = (e: CustomEvent) => {
      if (['connected', 'active'].includes((e as any).detail?.state)) setCallStatus('connected');
      if (['ended', 'failed'].includes((e as any).detail?.state)) handleHangup(false);
    };
    window.addEventListener('p1-call-state-changed' as any, onStateChange);
    return () => window.removeEventListener('p1-call-state-changed' as any, onStateChange);
  }, []);

  // 远端帧检测
  useEffect(() => {
    const v = remoteVideoRef.current;
    if (!v) return;
    const update = () => setRemoteHasVideo((v.videoWidth || 0) > 0 && (v.videoHeight || 0) > 0);
    v.addEventListener('loadedmetadata', update);
    v.addEventListener('resize', update);
    const intv = setInterval(update, 800);
    update();
    return () => { v.removeEventListener('loadedmetadata', update); v.removeEventListener('resize', update); clearInterval(intv); };
  }, []);

  // 计时
  useEffect(() => {
    if (callStatus !== 'connected') return;
    const timer = setInterval(() => setDurationSeconds(p => p + 1), 1000);
    return () => clearInterval(timer);
  }, [callStatus]);

  const handleHangup = (userAction = true) => {
    if (userAction) callAction('hangup');
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
    setCallStatus('ended');
    const isCanceled = durationSeconds === 0;
    setTimeout(() => { 
        onHangup({ 
            duration: formatDuration(durationSeconds),
            canceled: isCanceled
        }); 
    }, 600);
  };

  const toggleMic = () => { 
    const next = !isMicOn;
    setIsMicOn(next);
    if (localStreamRef.current) localStreamRef.current.getAudioTracks().forEach(t => t.enabled = next);
    callAction('setMuted', !next);
  };
  const toggleSpeaker = () => { setIsSpeakerOn(p => !p); callAction('setSpeaker', !isSpeakerOn); };
  const toggleCam = () => { setIsCamOn(p => !p); callAction('setVideoEnabled', !isCamOn); };
  const switchCamera = () => { 
    setIsFrontCamera(p => {
      const next = !p;
      setIsMirrored(next); // 前置默认镜像，后置默认不镜像
      return next;
    }); 
    callAction('switchCamera'); 
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60), s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // 拖拽逻辑
  const onPipPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    draggingRef.current = true; hasDraggedRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    pipStartRef.current = { ...pipPos };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPipPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x, dy = e.clientY - dragStartRef.current.y;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasDraggedRef.current = true;
    setPipPos({ x: pipStartRef.current.x + dx, y: pipStartRef.current.y + dy });
  };
  const onPipPointerUp = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    if (!hasDraggedRef.current) setIsSwapped(p => !p); 
    else if (containerRef.current) {
      const { clientWidth, clientHeight } = containerRef.current;
      setPipPos(prev => ({
        x: Math.max(12, Math.min(clientWidth - pipSize.width - 12, prev.x)),
        y: Math.max(80, Math.min(clientHeight - pipSize.height - 200, prev.y))
      }));
    }
  };

  const fullscreenStyle = "absolute inset-0 w-full h-full z-0";
  // [关键修改] top/left 布局 + 硬件加速hint
  const pipStyle = "absolute rounded-xl overflow-hidden border border-white/20 shadow-2xl z-20 cursor-move touch-none will-change-[left,top]";

  // [关键逻辑] 视频是否可用判断
  const hasLocalVideo = isCamOn && hasCameraPermission === true;
  
  // 拖拽事件包
  const pipHandlers = {
    onPointerDown: onPipPointerDown,
    onPointerMove: onPipPointerMove,
    onPointerUp: onPipPointerUp,
    onPointerCancel: onPipPointerUp
  };

  return (
    <div id="p1-react-call-overlay" ref={containerRef} className="fixed inset-0 z-[100] bg-gray-900 overflow-hidden select-none">
      <audio ref={remoteAudioRef} autoPlay className="hidden" />

      {/* --- Remote Video Panel (展开写法，避免组件重渲染黑屏) --- */}
      <div 
        className={isSwapped ? pipStyle : fullscreenStyle}
        style={isSwapped ? { width: pipSize.width, height: pipSize.height, left: pipPos.x, top: pipPos.y, transition: draggingRef.current ? 'none' : 'left 0.2s linear, top 0.2s linear' } : {}}
        {...(isSwapped ? pipHandlers : {})}
      >
        <div className="absolute inset-0 flex items-center justify-center bg-black">
           {/* 远端始终显示头像背景，直到有视频 */}
           <img src={user.avatar} className="absolute inset-0 w-full h-full object-cover opacity-35 blur-xl" alt="" />
           <div className="relative z-0 flex flex-col items-center">
             <img src={user.avatar} className={`${isSwapped ? 'w-12 h-12' : 'w-24 h-24'} rounded-2xl shadow-lg mb-2`} alt="" />
             {!isSwapped && <span className="text-white text-xl font-medium drop-shadow-md">{user.name}</span>}
             {!isSwapped && <span className="text-white/60 text-sm mt-1">{callStatus === 'calling' ? '正在呼叫...' : (!remoteHasVideo ? '对方未开启摄像头' : '')}</span>}
           </div>
        </div>
        <video 
          ref={remoteVideoRef} autoPlay playsInline 
          className={`absolute inset-0 w-full h-full object-cover z-10 transition-opacity duration-300 ${remoteHasVideo ? 'opacity-100' : 'opacity-0'}`}
        />
        {isSwapped && (
          <div className="absolute bottom-1 left-1 z-20 bg-black/50 px-1.5 py-0.5 rounded text-[10px] text-white/90">{user.name}</div>
        )}
      </div>

      {/* --- Local Video Panel (展开写法，避免组件重渲染黑屏) --- */}
      <div 
        className={!isSwapped ? pipStyle : fullscreenStyle}
        style={!isSwapped ? { width: pipSize.width, height: pipSize.height, left: pipPos.x, top: pipPos.y, transition: draggingRef.current ? 'none' : 'left 0.2s linear, top 0.2s linear' } : {}}
        {...(!isSwapped ? pipHandlers : {})}
      >
        <div className="absolute inset-0 flex items-center justify-center bg-black overflow-hidden">
           {/* 本地无视频时显示头像背景 */}
           {!hasLocalVideo && (
             <>
               <img src={currentUser.avatar} className="absolute inset-0 w-full h-full object-cover opacity-35 blur-xl" alt="" />
               <div className="relative z-0 flex flex-col items-center">
                  <img src={currentUser.avatar} className={`${!isSwapped ? 'w-12 h-12' : 'w-24 h-24'} rounded-2xl shadow-lg mb-2`} alt="" />
                  {isSwapped && <span className="text-white/60 text-sm mt-1">摄像头已关闭</span>}
               </div>
             </>
           )}
        </div>
        <video 
          ref={localVideoRef} autoPlay playsInline muted 
className={`absolute inset-0 w-full h-full object-cover z-10 transition-opacity duration-300 ${isMirrored ? 'transform scale-x-[-1]' : ''} ${hasLocalVideo ? 'opacity-100' : 'opacity-0'}`}
        />
        {!isSwapped && (
          <div className="absolute bottom-1 left-1 z-20 bg-black/50 px-1.5 py-0.5 rounded text-[10px] text-white/90">我</div>
        )}
      </div>

      {/* 顶部栏 */}
      <div className="absolute top-0 left-0 right-0 pt-safe-top px-4 pb-4 flex justify-between items-center z-30 text-white pointer-events-none bg-gradient-to-b from-black/60 to-transparent">
        <div onClick={() => handleHangup(true)} className="p-3 bg-white/10 rounded-full backdrop-blur-md active:bg-white/20 pointer-events-auto cursor-pointer">
          <Minimize2 size={24} />
        </div>
        <div className="flex flex-col items-center">
          <div className="text-xl font-medium drop-shadow-md">{isSwapped ? '我' : user.name}</div>
          <div className="text-sm opacity-80 font-light">{callStatus === 'ended' ? (durationSeconds > 0 ? '通话已结束' : '通话已取消') : (callStatus === 'calling' ? '正在呼叫...' : formatDuration(durationSeconds))}</div>
        </div>
        <div className="p-3 opacity-0"><Plus size={24} /></div>
      </div>

      {/* 底部控制区 */}
      <div className="absolute bottom-0 left-0 right-0 pb-safe-bottom pt-32 px-8 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-30 pointer-events-none">
        {callStatus !== 'ended' && (
          <>
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
              <button onClick={() => setIsMirrored(p => !p)} className="w-12 h-12 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20 transition-colors">
                <FlipHorizontal size={24} className={isMirrored ? "text-white" : "text-white/40"} />
              </button>
              <button onClick={() => handleHangup(true)} className="w-16 h-16 rounded-full bg-[#ff3b30] flex items-center justify-center shadow-lg active:scale-90 transition-transform">
                <PhoneOff size={36} className="text-white fill-current" />
              </button>
              <button onClick={switchCamera} className="w-12 h-12 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20 transition-colors">
                <RefreshCcw size={24} className="text-white" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CallOverlay;
