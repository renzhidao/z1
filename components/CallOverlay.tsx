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

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);

  const [pipPos, setPipPos] = useState({ x: 20, y: 100 });

  const [remoteHasVideo, setRemoteHasVideo] = useState(false);
  const [localHasVideo, setLocalHasVideo] = useState(false);

  const draggingRef = useRef(false);

  const dragStartRef = useRef({ x: 0, y: 0 });

  const pipStartRef = useRef({ x: 0, y: 0 });

  const hasDraggedRef = useRef(false);

  

  const containerRef = useRef<HTMLDivElement>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);

  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const remoteAudioRef = useRef<HTMLAudioElement>(null);

    // 隐藏原生 UI，强制显示 React UI

  useEffect(() => {

    const style = document.createElement('style');

    style.setAttribute('data-p1-react-overlay-style', '1');

    style.innerHTML = `#p1-call-container, .p1-call-overlay, [id^="p1-call-"] { display: none !important; } #p1-react-call-overlay { display: block !important; }`;

    document.head.appendChild(style);

    return () => { try { document.head.removeChild(style); } catch (_) {} };

  }, []);

  // 无论是否开启摄像头，挂载后就先尝试 attach，保证语音/拒权也能正常

  useEffect(() => {

    const t = setTimeout(() => {

      callAction('attach', {

        localVideo: localVideoRef.current,

        remoteVideo: remoteVideoRef.current,

        remoteAudio: remoteAudioRef.current,

      });

      if (remoteAudioRef.current) remoteAudioRef.current.play().catch(() => {});
      try { callAction('setVideoEnabled', true); } catch (e) {}

    }, 200);

    return () => clearTimeout(t);

  }, []);

  // 获取本地摄像头（视频通话或手动开启时）

  
  // 监听摄像头开关，通知底层 (不再自己获取流)
  useEffect(() => {
    callAction('setVideoEnabled', isCamOn);
  }, [isCamOn]);

  // 初始化 PiP 位置

  useEffect(() => {

    if (window.innerWidth) setPipPos({ x: window.innerWidth - 128 - 16, y: 96 });

  }, []);

  // 通话状态监听

  useEffect(() => {

    const onStateChange = (e: CustomEvent) => {

      if (['connected', 'active'].includes((e as any).detail?.state)) setCallStatus('connected');

      if (['ended', 'failed'].includes((e as any).detail?.state)) handleHangup(false);

    };

    window.addEventListener('p1-call-state-changed' as any, onStateChange);

    return () => window.removeEventListener('p1-call-state-changed' as any, onStateChange);

  }, []);

  // 远端是否真的有视频帧（无帧时显示头像，不被黑屏遮住）

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

    setCallStatus('ended');

    setTimeout(() => { onHangup(); }, 600);

  };

  const toggleMic = () => { 

    const next = !isMicOn;

    setIsMicOn(next);

    callAction('setMuted', !next);

  };

  const toggleSpeaker = () => { setIsSpeakerOn(p => !p); callAction('setSpeaker', !isSpeakerOn); };

  const toggleCam = () => { setIsCamOn(p => !p); callAction('setVideoEnabled', !isCamOn); };

  const switchCamera = () => { setIsFrontCamera(p => !p); callAction('switchCamera'); };

  const formatDuration = (secs: number) => {

    const m = Math.floor(secs / 60), s = secs % 60;

    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

  };

  // 拖拽（只移动小窗容器）

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

    if (!hasDraggedRef.current) setIsSwapped(p => !p); // 点击切换大小窗

    else if (containerRef.current) {

      const { clientWidth, clientHeight } = containerRef.current;

      setPipPos(prev => ({

        x: Math.max(12, Math.min(clientWidth - 128 - 12, prev.x)),

        y: Math.max(80, Math.min(clientHeight - 192 - 200, prev.y))

      }));

    }

  };

  const fullscreenStyle = "absolute inset-0 w-full h-full z-0";

  const pipStyle = "absolute left-0 top-0 w-32 h-48 rounded-xl overflow-hidden border border-white/20 shadow-2xl z-20 cursor-move touch-none will-change-[left,top]";

  // 面板（固定两个 video，不销毁，只切换容器样式）

  const VideoPanel = ({ isLocal, isPip, vRef }: { isLocal: boolean, isPip: boolean, vRef: React.RefObject<HTMLVideoElement> }) => {

    const style = isPip 

      ? { left: pipPos.x, top: pipPos.y, transition: draggingRef.current ? 'none' : 'left 0.2s linear, top 0.2s linear' } 

      : {};

    const showV = isLocal ? (localHasVideo && isCamOn) : remoteHasVideo;

    return (

      <div 

        className={isPip ? pipStyle : fullscreenStyle}

        style={style}

        onPointerDown={isPip ? onPipPointerDown : undefined}

        onPointerMove={isPip ? onPipPointerMove : undefined}

        onPointerUp={isPip ? onPipPointerUp : undefined}

        onPointerCancel={isPip ? onPipPointerUp : undefined}

      >

        {/* 背景头像层（永远存在） */}

        <div className="absolute inset-0 flex items-center justify-center bg-black">

          {!isLocal && (

            <>

              <img src={user.avatar} className="absolute inset-0 w-full h-full object-cover opacity-35 blur-xl" alt="" />

              <div className="relative z-0 flex flex-col items-center">

                <img src={user.avatar} className={`${isPip ? 'w-12 h-12' : 'w-24 h-24'} rounded-2xl shadow-lg mb-2`} alt="" />

                {!isPip && <span className="text-white text-xl font-medium drop-shadow-md">{user.name}</span>}

                {!isPip && <span className="text-white/60 text-sm mt-1">{callStatus === 'calling' ? '正在呼叫...' : (!remoteHasVideo ? '对方未开启摄像头' : '')}</span>}

              </div>

            </>

          )}

          {isLocal && (

            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60">

              {!hasLocalVideo ? (

                <>

                  <VideoOff size={isPip ? 22 : 44} />

                  {!isPip && <span className="mt-2 text-sm">{hasCameraPermission === false ? '无摄像头权限' : '摄像头已关闭'}</span>}

                </>

              ) : null}

            </div>

          )}

        </div>

        {/* 视频层（有帧才显示，避免黑屏遮挡头像） */}

        <video 

          ref={vRef} autoPlay playsInline muted={isLocal}

          className={`absolute inset-0 w-full h-full object-cover z-10 ${isLocal ? '' : ''} transition-opacity duration-300 ${showV ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}

        />

        {isPip && (

          <div className="absolute bottom-1 left-1 z-20 bg-black/50 px-1.5 py-0.5 rounded text-[10px] text-white/90">

            {isLocal ? '我' : user.name}

          </div>

        )}

      </div>

    );

  };

  return (

    <div id="p1-react-call-overlay" ref={containerRef} className="fixed inset-0 z-[100] bg-gray-900 overflow-hidden select-none">

      <audio ref={remoteAudioRef} autoPlay className="hidden" />

      <VideoPanel isLocal={false} isPip={isSwapped} vRef={remoteVideoRef} />

      <VideoPanel isLocal={true} isPip={!isSwapped} vRef={localVideoRef} />

      {/* 顶部栏 */}

      <div className="absolute top-0 left-0 right-0 pt-safe-top px-4 pb-4 flex justify-between items-center z-30 text-white pointer-events-none bg-gradient-to-b from-black/60 to-transparent">

        <div onClick={() => handleHangup(true)} className="p-3 bg-white/10 rounded-full backdrop-blur-md active:bg-white/20 pointer-events-auto cursor-pointer">

          <Minimize2 size={24} />

        </div>

        <div className="flex flex-col items-center">

          <div className="text-xl font-medium drop-shadow-md">{isSwapped ? '我' : user.name}</div>

          <div className="text-sm opacity-80 font-light">{callStatus === 'ended' ? '通话已结束' : (callStatus === 'calling' ? '正在呼叫...' : formatDuration(durationSeconds))}</div>

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