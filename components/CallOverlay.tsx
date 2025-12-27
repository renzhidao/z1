import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, MicOff, Volume2, VolumeX, Video as VideoIcon, VideoOff, 
  PhoneOff, Minimize2, RefreshCcw, Plus, ChevronDown
} from 'lucide-react';
import { User } from '../types';

interface CallOverlayProps {
  user: User;
  onHangup: () => void;
  type: 'voice' | 'video';
}

// 封装全局调用
const callAction = (action: string, ...args: any[]) => {
  try {
    const p1Call = (window as any).p1Call;
    if (p1Call && typeof p1Call[action] === 'function') {
      p1Call[action](...args);
    }
  } catch (e) {
    console.error(`Call action ${action} failed`, e);
  }
};

export const CallOverlay: React.FC<CallOverlayProps> = ({ user, onHangup, type }) => {
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(type === 'video');
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  
  // PiP State
  const [isSwapped, setIsSwapped] = useState(false); // false: Main=Remote, PiP=Local
  const [pipPos, setPipPos] = useState({ x: 20, y: 100 });
  const [hasInitializedPos, setHasInitializedPos] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize PiP position
  useEffect(() => {
    if (containerRef.current && !hasInitializedPos) {
      const { clientWidth } = containerRef.current;
      // PiP width is w-32 (8rem = 128px) + margin
      setPipPos({ x: clientWidth - 128 - 16, y: 96 }); 
      setHasInitializedPos(true);
    }
  }, [hasInitializedPos]);

  // Timer
  useEffect(() => {
    const timer = setInterval(() => setDurationSeconds(p => p + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Core Integration: Bind Media Streams
  useEffect(() => {
    const timer = setTimeout(() => {
        callAction('attach', {
          localVideo: localVideoRef.current,
          remoteVideo: remoteVideoRef.current,
          remoteAudio: remoteAudioRef.current,
        });
        if (remoteAudioRef.current) remoteAudioRef.current.play().catch(() => {});
    }, 500); // Give it a bit more time for DOM to stabilize
    return () => clearTimeout(timer);
  }, [isSwapped, isCamOn]); // Re-bind when views swap or camera toggles

  // Sync State with Core
  const toggleMic = () => {
    const next = !isMicOn;
    setIsMicOn(next);
    callAction('setMuted', !next); // setMuted(true) means mic off
  };

  const toggleSpeaker = () => {
    const next = !isSpeakerOn;
    setIsSpeakerOn(next);
    callAction('setSpeaker', next);
  };

  const toggleCam = () => {
    const next = !isCamOn;
    setIsCamOn(next);
    callAction('setVideoEnabled', next);
  };

  const switchCamera = () => {
    setIsFrontCamera(!isFrontCamera);
    callAction('switchCamera');
  };

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
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    hasDragged.current = false;
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
    
    if (!hasDragged.current) {
        setIsSwapped(prev => !prev);
    } else {
        if (containerRef.current) {
          const { clientWidth, clientHeight } = containerRef.current;
          const pipWidth = 128; // w-32
          const pipHeight = 192; // h-48
          const margin = 12;
          setPipPos(prev => ({
              x: Math.max(margin, Math.min(clientWidth - pipWidth - margin, prev.x)),
              y: Math.max(80, Math.min(clientHeight - pipHeight - 200, prev.y))
          }));
        }
    }
  };

  // Content Renderers
  // Local: Self Camera
  const renderLocal = () => (
    <div className="w-full h-full bg-black relative">
      {isCamOn ? (
        <video 
          ref={localVideoRef}
          autoPlay 
          playsInline 
          muted 
          className="w-full h-full object-cover transform scale-x-[-1]" 
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800 text-white/40">
           <VideoOff size={32} />
           <span className="text-xs mt-2">摄像头已关</span>
        </div>
      )}
    </div>
  );

  // Remote: Other Person
  const renderRemote = () => (
    <div className="w-full h-full bg-black relative">
      <audio ref={remoteAudioRef} autoPlay className="hidden" />
      <video 
          ref={remoteVideoRef}
          autoPlay 
          playsInline 
          className="w-full h-full object-cover" 
      />
      {/* Fallback if no video (handled by CSS/z-index usually, but here we just put image behind) */}
      <div className="absolute inset-0 -z-10">
         <img src={user.avatar} className="w-full h-full object-cover opacity-50 blur-xl" alt="remote_bg" />
         <div className="absolute inset-0 flex flex-col items-center justify-center">
            <img src={user.avatar} className="w-24 h-24 rounded-2xl shadow-2xl mb-4" alt="remote_avatar" />
            <span className="text-white text-xl font-medium shadow-black drop-shadow-lg">{user.name}</span>
         </div>
      </div>
    </div>
  );

  // Default: Main=Remote, PiP=Local
  // Swapped: Main=Local, PiP=Remote
  const MainContent = isSwapped ? renderLocal() : renderRemote();
  const PiPContent = isSwapped ? renderRemote() : renderLocal();

  return (
    <div ref={containerRef} className="fixed inset-0 z-[100] bg-gray-900 overflow-hidden flex flex-col select-none animate-in fade-in duration-300">
      
      {/* Background Layer (Main View) */}
      <div className="absolute inset-0 z-0">
        {MainContent}
      </div>

      {/* Top Overlay Controls */}
      <div className="absolute top-0 left-0 right-0 pt-safe-top px-4 pb-4 flex justify-between items-center z-10 text-white pointer-events-none bg-gradient-to-b from-black/60 to-transparent">
        <div 
          onClick={onHangup} // Minimize just closes overlay for now
          className="p-3 bg-white/10 rounded-full backdrop-blur-md active:bg-white/20 transition-colors pointer-events-auto"
        >
          <Minimize2 size={24} />
        </div>
        <div className="flex flex-col items-center">
             <div className="text-xl font-medium tracking-wide shadow-black drop-shadow-md">
               {isSwapped ? '我' : user.name}
             </div>
             <div className="text-sm opacity-80 font-light tracking-widest">
               {formatDuration(durationSeconds)}
             </div>
        </div>
        <div className="p-3 opacity-0 pointer-events-none">
          <Plus size={24} />
        </div>
      </div>

      {/* Picture in Picture (Draggable & Swappable) */}
      {/* 放大尺寸：w-32 (128px) x h-48 (192px) */}
      <div 
className="absolute w-28 h-44 bg-black rounded-xl overflow-hidden border border-white/20 shadow-2xl z-20 cursor-move touch-none"
        style={{ 
          transform: `translate3d(${pipPos.x}px, ${pipPos.y}px, 0)`,
          transition: draggingRef.current ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)'
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
         {PiPContent}
         
         {/* PiP Overlay Info */}
         <div className="absolute bottom-2 left-2 text-[10px] text-white/80 bg-black/40 px-1.5 rounded backdrop-blur-sm">
            {isSwapped ? user.name : '我'}
         </div>
      </div>

      {/* Bottom Controls Area */}
      <div className="absolute bottom-0 left-0 right-0 pb-safe-bottom pt-32 px-8 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-30">
        
        {/* Main Action Buttons - 放大尺寸 */}
        <div className="flex justify-between items-center mb-12 px-4">
          
          {/* Mic */}
          <div className="flex flex-col items-center space-y-3">
            <button 
              onClick={toggleMic}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-lg ${isMicOn ? 'bg-white text-black' : 'bg-white/20 text-white backdrop-blur-md'}`}
            >
              {isMicOn ? <Mic size={28} /> : <MicOff size={28} />}
            </button>
            <span className="text-xs text-white/90 drop-shadow-md font-light">
              {isMicOn ? '麦克风' : '已静音'}
            </span>
          </div>

          {/* Speaker */}
          <div className="flex flex-col items-center space-y-3">
            <button 
              onClick={toggleSpeaker}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-lg ${isSpeakerOn ? 'bg-white text-black' : 'bg-white/20 text-white backdrop-blur-md'}`}
            >
              {isSpeakerOn ? <Volume2 size={28} /> : <VolumeX size={28} />}
            </button>
            <span className="text-xs text-white/90 drop-shadow-md font-light">
              {isSpeakerOn ? '扬声器' : '听筒'}
            </span>
          </div>

          {/* Camera */}
          <div className="flex flex-col items-center space-y-3">
            <button 
              onClick={toggleCam}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-lg ${isCamOn ? 'bg-white text-black' : 'bg-white/20 text-white backdrop-blur-md'}`}
            >
              {isCamOn ? <VideoIcon size={28} /> : <VideoOff size={28} />}
            </button>
            <span className="text-xs text-white/90 drop-shadow-md font-light">
              {isCamOn ? '摄像头' : '已关'}
            </span>
          </div>
        </div>

        {/* Bottom Actions Row */}
        <div className="flex justify-between items-center px-6 pb-6">
          <div className="flex flex-col items-center w-12">
            {/* Placeholder for effects/more */}
            <div className="p-3 rounded-full bg-white/10 backdrop-blur-md active:bg-white/20 transition-colors">
               <ChevronDown size={24} className="text-white" />
            </div>
          </div>

          {/* Hang Up Button - 红色醒目 */}
          <button 
            onClick={handleHangup}
className="w-16 h-16 rounded-full bg-[#ff3b30] flex items-center justify-center shadow-lg shadow-red-900/30 transform transition-transform active:scale-90"
          >
            <PhoneOff size={36} className="text-white fill-current" />
          </button>

           {/* Switch Camera */}
           <button 
            onClick={switchCamera}
            className="flex flex-col items-center p-3 rounded-full bg-white/10 backdrop-blur-md w-12 active:bg-white/20 transition-colors"
          >
            <RefreshCcw size={24} className="text-white" />
          </button>
        </div>

      </div>
    </div>
  );
};

export default CallOverlay;
