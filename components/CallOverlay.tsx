import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, Video, PhoneOff, Camera, Minimize2, VideoOff } from 'lucide-react';
import { User } from '../types';

interface CallOverlayProps {
  user: User;
  onHangup: () => void;
  type: 'voice' | 'video'; // Initial type
}

const CallOverlay: React.FC<CallOverlayProps> = ({ user, onHangup, type }) => {
  const [seconds, setSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(type === 'video');

  
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
useEffect(() => {
  // 每次切换模式（Video/Voice）导致 DOM 刷新后，重新绑定流
  try {
    (window as any).p1Call && (window as any).p1Call.attach && (window as any).p1Call.attach({
      localVideo: localVideoRef.current,
      remoteVideo: remoteVideoRef.current,
      remoteAudio: remoteAudioRef.current,
    });
  } catch (_) {}

  const timer = setInterval(() => {
    setSeconds(s => s + 1);
  }, 1000);
  return () => clearInterval(timer);
}, [isVideoEnabled]);
const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="fixed inset-0 bg-[#2b2b2b] z-[100] flex flex-col items-center animate-in slide-in-from-bottom duration-300">
      {/* Background with blur (optional) */}
      <div className="absolute inset-0 z-0 opacity-30">
        <img src={user.avatar} className="w-full h-full object-cover blur-2xl" alt="bg"/>
      </div>
      
      {/* Top Controls */}
      <div className="relative z-10 w-full flex justify-between p-4 pt-safe-top">
         <button onClick={() => { try { (window as any).p1Call && (window as any).p1Call.hangup && (window as any).p1Call.hangup(); } catch (_) {} onHangup(); }} className="p-2 text-white/80 active:opacity-50">
           <Minimize2 size={24} />
         </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center pt-16 z-10 w-full relative">
         {!isVideoEnabled ? (
                             <>
                             <audio ref={remoteAudioRef} autoPlay />
                <img src={user.avatar} className="w-24 h-24 rounded-[12px] mb-4 shadow-lg" alt="Avatar"/>
                <h2 className="text-white text-[24px] font-normal mb-2">{user.name}</h2>
                <div className="text-white/70 text-[16px]">{formatTime(seconds)}</div>
             </>
                             </>
         ) : (
            // Video Call Layout (Simulated)
             <div className="absolute inset-0 bg-black flex items-center justify-center">
                 <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover opacity-80" />
                 <div className="absolute top-24 left-1/2 -translate-x-1/2 text-white text-[20px] drop-shadow-md">
                     {formatTime(seconds)}
                 </div>
                 {/* Self View */}
                 <div className="absolute top-4 right-4 w-28 h-40 bg-gray-800 rounded-[8px] overflow-hidden border border-white/20 shadow-lg">
                     <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                 </div>
             </div>
         )}
      </div>

      {/* Bottom Controls */}
      <div className="relative z-20 w-full pb-safe-bottom px-8 mb-12">
         {/* Layout depends on Voice vs Video */}
         {!isVideoEnabled ? (
            // Voice Call Controls (3 buttons)
            <div className="grid grid-cols-3 gap-8 items-end">
                <ControlBtn 
                   icon={isMuted ? <MicOff /> : <Mic />} 
                   label={isMuted ? "麦克风已关" : "麦克风已开"} 
                   active={isMuted}
                   onClick={() => { const next = !isMuted; setIsMuted(next); try { (window as any).p1Call && (window as any).p1Call.setMuted && (window as any).p1Call.setMuted(next); } catch (_) {} }} 
                />
                <div className="flex flex-col items-center">
                   <button 
                     onClick={() => { try { (window as any).p1Call && (window as any).p1Call.hangup && (window as any).p1Call.hangup(); } catch (_) {} onHangup(); }}
                     className="w-16 h-16 bg-[#FA5151] rounded-full flex items-center justify-center text-white mb-2 active:opacity-80 shadow-lg"
                   >
                     <PhoneOff size={32} fill="white" />
                   </button>
                   <span className="text-white/70 text-[12px]">取消</span>
                </div>
                <ControlBtn 
                   icon={<Volume2 />} 
                   label={isSpeaker ? "扬声器已开" : "扬声器已关"} 
                   active={isSpeaker}
                   onClick={() => { const next = !isSpeaker; setIsSpeaker(next); try { (window as any).p1Call && (window as any).p1Call.setSpeaker && (window as any).p1Call.setSpeaker(next); } catch (_) {} }} 
                />
            </div>
         ) : (
            // Video Call Controls (Grid)
            <div className="grid grid-cols-3 gap-y-8 gap-x-4 items-center">
                 <ControlBtn 
                   icon={isMuted ? <MicOff /> : <Mic />} 
                   label={isMuted ? "麦克风已关" : "麦克风已开"} 
                   active={isMuted}
                   onClick={() => { const next = !isMuted; setIsMuted(next); try { (window as any).p1Call && (window as any).p1Call.setMuted && (window as any).p1Call.setMuted(next); } catch (_) {} }} 
                />
                 <ControlBtn 
                   icon={<Volume2 />} 
                   label={isSpeaker ? "扬声器已开" : "扬声器已关"} 
                   active={isSpeaker}
                   onClick={() => { const next = !isSpeaker; setIsSpeaker(next); try { (window as any).p1Call && (window as any).p1Call.setSpeaker && (window as any).p1Call.setSpeaker(next); } catch (_) {} }} 
                />
                 <ControlBtn 
                   icon={isVideoEnabled ? <Video /> : <VideoOff />} 
                   label="摄像头已开" 
                   active={isVideoEnabled}
                   onClick={() => { const next = !isVideoEnabled; setIsVideoEnabled(next); try { (window as any).p1Call && (window as any).p1Call.setVideoEnabled && (window as any).p1Call.setVideoEnabled(next); } catch (_) {} }} 
                />
                 <ControlBtn 
                   icon={<Camera />} 
                   label="翻转" 
                   onClick={() => {}} 
                />
                <div className="flex flex-col items-center">
                   <button 
                     onClick={onHangup}
                     className="w-16 h-16 bg-[#FA5151] rounded-full flex items-center justify-center text-white mb-2 active:opacity-80 shadow-lg"
                   >
                     <PhoneOff size={32} fill="white" />
                   </button>
                </div>
                <div className="w-full"></div> 
            </div>
         )}
      </div>
    </div>
  );
};

const ControlBtn: React.FC<{ icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }> = ({ icon, label, active, onClick }) => (
  <div className="flex flex-col items-center justify-center gap-2">
     <button 
       onClick={onClick}
       className={`w-[60px] h-[60px] rounded-full flex items-center justify-center transition-colors text-black ${active ? 'bg-white text-black' : 'bg-white text-black'}`}
     >
        {React.cloneElement(icon as React.ReactElement<any>, { size: 30, strokeWidth: 1.5 })}
     </button>
     <span className="text-white/80 text-[12px]">{label}</span>
  </div>
);

export default CallOverlay;