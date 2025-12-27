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
  const [callStatus, setCallStatus] = useState<'calling' | 'connected' | 'ended'>('calling');
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(type === 'video');
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isSwapped, setIsSwapped] = useState(false); 
  const [isDragging, setIsDragging] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  
  const pipPosRef = useRef({ x: 20, y: 100 });
  const [pipPosState, setPipPosState] = useState({ x: 20, y: 100 }); 
  
  const containerRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const localContainerRef = useRef<HTMLDivElement>(null);
  const remoteContainerRef = useRef<HTMLDivElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // --- 核心：自主获取本地摄像头 ---
  useEffect(() => {
    const startCamera = async () => {
      try {
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => track.stop());
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: isFrontCamera ? 'user' : 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: true
        });
        
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setHasCameraPermission(true);
        
        // 通知底层
        callAction('attach', {
          localVideo: localVideoRef.current,
          remoteVideo: remoteVideoRef.current,
          remoteAudio: remoteAudioRef.current,
        });
        
      } catch (err) {
        console.error("Camera error:", err);
        setHasCameraPermission(false);
      }
    };

    const stopCamera = () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
    };

    if (isCamOn) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [isCamOn, isFrontCamera]);

  // 初始化样式 + PiP位置
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `#p1-call-container, .p1-call-overlay, [id^="p1-call-"] { display: none !important; } #p1-react-call-overlay { display: block !important; }`;
    document.head.appendChild(style);

    if (window.innerWidth) {
        const initX = window.innerWidth - 112 - 16;
        const initY = 96;
        pipPosRef.current = { x: initX, y: initY };
        setPipPosState({ x: initX, y: initY });
    }

    return () => { document.head.removeChild(style); };
  }, []);

  // 呼叫状态监听
  useEffect(() => {
    const onStateChange = (e: CustomEvent) => {
        if (['connected', 'active'].includes(e.detail?.state)) setCallStatus('connected');
        if (['ended', 'failed'].includes(e.detail?.state)) handleHangup(false);
    };
    window.addEventListener('p1-call-state-changed' as any, onStateChange);
    
    const checkStream = setInterval(() => {
        if (remoteVideoRef.current && (remoteVideoRef.current.srcObject as MediaStream)?.active) {
            setCallStatus(prev => prev === 'calling' ? 'connected' : prev);
            clearInterval(checkStream);
        }
    }, 1000);

    return () => {
        window.removeEventListener('p1-call-state-changed' as any, onStateChange);
        clearInterval(checkStream);
    };
  }, []);

  // 计时器
  useEffect(() => {
    if (callStatus !== 'connected') return;
    const timer = setInterval(() => setDurationSeconds(p => p + 1), 1000);
    return () => clearInterval(timer);
  }, [callStatus]);

  const handleHangup = (userAction = true) => {
    if (callStatus === 'ended') return;
    if (userAction) callAction('hangup');
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    setCallStatus('ended');
    setTimeout(() => { onHangup(); }, 800);
  };

  const toggleMic = () => { 
    const next = !isMicOn;
    setIsMicOn(next); 
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => t.enabled = next);
    }
    callAction('setMuted', !next); 
  };
  const toggleSpeaker = () => { setIsSpeakerOn(p => !p); callAction('setSpeaker', !isSpeakerOn); };
  const toggleCam = () => { setIsCamOn(p => !p); callAction('setVideoEnabled', !isCamOn); };
  const switchCamera = () => { setIsFrontCamera(p => !p); callAction('switchCamera'); };

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // --- 拖拽逻辑 ---
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);

  const handlePipPointerDown = (e: React.PointerEvent, isPip: boolean) => {
    if (!isPip) return;
    e.preventDefault(); e.stopPropagation();
    draggingRef.current = true;
    setIsDragging(true);
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
    e.currentTarget.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
  };

  const handlePipPointerUp = (e: React.PointerEvent, isPip: boolean) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setIsDragging(false);
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    
    if (!hasDraggedRef.current) {
        setIsSwapped(p => !p);
        e.currentTarget.style.transform = `translate3d(${pipPosRef.current.x}px, ${pipPosRef.current.y}px, 0)`;
    } else {
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
        setPipPosState({ x: finalX, y: finalY });
        e.currentTarget.style.transform = `translate3d(${finalX}px, ${finalY}px, 0)`;
    }
  };

  const TRANSITION = "transition-all duration-300 ease-in-out";
  const FULLSCREEN_CLASS = `absolute inset-0 z-0 w-full h-full ${TRANSITION}`;
  const PIP_BASE = "absolute z-20 w-28 h-44 rounded-xl overflow-hidden border border-white/20 shadow-2xl cursor-move touch-none bg-black";

  const VideoContainer = ({ isLocal, videoRef, containerRef, isPip }: any) => {
    const className = isPip ? `${PIP_BASE} ${isDragging ? '' : TRANSITION}` : FULLSCREEN_CLASS;
    const style = isPip ? { transform: `translate3d(${pipPosState.x}px, ${pipPosState.y}px, 0)` } : {};

    const showLocalVideo = isLocal && hasCameraPermission === true && isCamOn;
    const showVideo = isLocal ? showLocalVideo : true;

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
        <div className="relative w-full h-full bg-black overflow-hidden">
           <video 
             ref={videoRef}
             autoPlay playsInline muted={isLocal}
             className={`absolute inset-0 w-full h-full object-cover z-10 ${isLocal ? 'transform scale-x-[-1]' : ''} ${showVideo ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
           />
           
           <div className="absolute inset-0 z-0 flex flex-col items-center justify-center bg-gray-800">
              {isLocal ? (
                  <div className="text-white/60 flex flex-col items-center">
                     {hasCameraPermission === false ? (
                         <>
                            <VideoOff size={isPip ? 24 : 48} />
                            {!isPip && <span className="mt-2 text-sm">无摄像头权限</span>}
                         </>
                     ) : !isCamOn ? (
                         <>
                            <VideoOff size={isPip ? 24 : 48} />
                            {!isPip && <span className="mt-2 text-sm">摄像头已关闭</span>}
                         </>
                     ) : (
                         <img src={user.avatar} className="w-16 h-16 rounded-full opacity-50" />
                     )}
                  </div>
              ) : (
                  <>
                    <img src={user.avatar} className="absolute inset-0 w-full h-full object-cover opacity-40 blur-xl" alt="" />
                    <div className="relative flex flex-col items-center z-10">
                        <img src={user.avatar} className={`${isPip ? 'w-12 h-12' : 'w-24 h-24'} rounded-2xl shadow-lg mb-2 border-2 border-white/20`} alt="" />
                        {!isPip && <span className="text-white text-xl font-medium drop-shadow-md">{user.name}</span>}
                        {!isPip && (
                            <span className="text-white/60 text-sm mt-2">
                                {callStatus === 'ended' ? '通话已结束' : (callStatus === 'calling' ? '正在呼叫...' : '')}
                            </span>
                        )}
                    </div>
                  </>
              )}
           </div>
           
           {isPip && (
             <div className="absolute bottom-1 left-1 z-20 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] text-white/90">
                {isLocal ? '我' : user.name}
             </div>
           )}
        </div>
      </div>
    );
  };

  const localIsPip = !isSwapped;
  const remoteIsPip = isSwapped;

  return (
    <div id="p1-react-call-overlay" ref={containerRef} className="fixed inset-0 z-[100] bg-gray-900 overflow-hidden select-none animate-in fade-in duration-300">
      <audio ref={remoteAudioRef} autoPlay className="hidden" />

      <VideoContainer isLocal={false} videoRef={remoteVideoRef} containerRef={remoteContainerRef} isPip={remoteIsPip} />
      <VideoContainer isLocal={true} videoRef={localVideoRef} containerRef={localContainerRef} isPip={localIsPip} />

      {/* Top Controls */}
      <div className="absolute top-0 left-0 right-0 pt-safe-top px-4 pb-4 flex justify-between items-center z-30 text-white pointer-events-none bg-gradient-to-b from-black/60 to-transparent">
        <div onClick={() => handleHangup(true)} className="p-3 bg-white/10 rounded-full backdrop-blur-md active:bg-white/20 pointer-events-auto cursor-pointer">
          <Minimize2 size={24} />
        </div>
        <div className="flex flex-col items-center">
             <div className="text-xl font-medium drop-shadow-md">{isSwapped ? '我' : user.name}</div>
             <div className="text-sm opacity-80 font-light">
                {callStatus === 'ended' ? '通话已结束' : (callStatus === 'calling' ? '正在呼叫...' : formatDuration(durationSeconds))}
             </div>
        </div>
        <div className="p-3 opacity-0"><Plus size={24} /></div>
      </div>

      {/* Bottom Controls */}
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
              <div className="w-12"></div>
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
