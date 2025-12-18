import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, Video, PhoneOff, Camera, Minimize2, VideoOff, VolumeX } from 'lucide-react';
import { User } from '../types';

interface CallOverlayProps {
  user: User;
  onHangup: () => void;
  type: 'voice' | 'video';
}

// 封装全局调用，避免代码重复
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

const CallOverlay: React.FC<CallOverlayProps> = ({ user, onHangup, type }) => {
  const [seconds, setSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(type === 'video');

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // 1. 计时器 Effect：只在组件挂载时运行一次
  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. 媒体流绑定 Effect：当 UI 模式改变导致 ref 变化时运行
  useEffect(() => {
    // 稍微延迟确保 DOM 已渲染
    const timer = setTimeout(() => {
        callAction('attach', {
          localVideo: localVideoRef.current,
          remoteVideo: remoteVideoRef.current,
          remoteAudio: remoteAudioRef.current,
        });
        // 远端音频自动播放强制尝试
        if (remoteAudioRef.current) remoteAudioRef.current.play().catch(() => {});
    }, 100);
    return () => clearTimeout(timer);
  }, [isVideoEnabled]); // 依赖 isVideoEnabled 重新绑定

  const handleHangup = () => {
    callAction('hangup');
    onHangup();
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    callAction('setMuted', next);
  };

  const toggleSpeaker = () => {
    const next = !isSpeaker;
    setIsSpeaker(next);
    callAction('setSpeaker', next);
  };

  const toggleVideo = () => {
    const next = !isVideoEnabled;
    setIsVideoEnabled(next);
    callAction('setVideoEnabled', next);
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="fixed inset-0 bg-[#2b2b2b] z-[100] flex flex-col items-center animate-in slide-in-from-bottom duration-300">
      
      {/* 修复：Audio 标签始终存在但隐藏，保证声音流不中断 */}
      <audio ref={remoteAudioRef} autoPlay className="hidden" />

      {/* Background */}
      <div className="absolute inset-0 z-0 opacity-30">
        <img src={user.avatar} className="w-full h-full object-cover blur-2xl" alt="bg"/>
      </div>
      
      {/* Top Controls */}
      <div className="relative z-10 w-full flex justify-between p-4 pt-safe-top">
         <button onClick={handleHangup} className="p-2 text-white/80 active:opacity-50">
           <Minimize2 size={24} />
         </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center pt-16 z-10 w-full relative">
         {!isVideoEnabled ? (
             <>
                <img src={user.avatar} className="w-24 h-24 rounded-[12px] mb-4 shadow-lg" alt="Avatar"/>
                <h2 className="text-white text-[24px] font-normal mb-2">{user.name}</h2>
                <div className="text-white/70 text-[16px]">{formatTime(seconds)}</div>
             </>
         ) : (
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
         {!isVideoEnabled ? (
            // Voice Call Controls
            <div className="grid grid-cols-3 gap-8 items-end">
                <ControlBtn 
                   icon={isMuted ? <MicOff /> : <Mic />} 
                   label={isMuted ? "已静音" : "静音"} 
                   active={isMuted}
                   onClick={toggleMute} 
                />
                
                {/* 中间放置挂断 */}
                <div className="flex flex-col items-center">
                   <button 
                     onClick={handleHangup}
                     className="w-16 h-16 bg-[#FA5151] rounded-full flex items-center justify-center text-white mb-2 active:opacity-80 shadow-lg"
                   >
                     <PhoneOff size={32} fill="white" />
                   </button>
                   <span className="text-white/70 text-[12px]">挂断</span>
                </div>

                {/* 右侧放置扬声器，但在语音模式下，建议增加一个“切视频”的入口，
                    或者将“扬声器”替换为“视频”按钮。通常语音通话界面会有4个按钮(静音/扬声器/视频/更多)。
                    为了布局平衡，这里我们可以把扬声器放在这，但一定要加回视频开关 */}
                
                 {/* 修复逻辑：这里使用了 4 格布局或者在扬声器旁边加小按钮。
                     为保持原 3 列布局，我们可以把扬声器按钮改成多功能，或者就在这里保持原样，
                     但在下方修复 ControlBtn 让它可以切换视频。
                     
                     更合理的做法：语音模式也应该能开摄像头。
                  */}
                 <div className="flex flex-col gap-4">
                     <ControlBtn 
                        icon={isSpeaker ? <Volume2 /> : <VolumeX />} // 修复图标逻辑
                        label={isSpeaker ? "扬声器" : "听筒"} 
                        active={isSpeaker}
                        onClick={toggleSpeaker} 
                     />
                     {/* 临时方案：在这里加一个小的切换视频按钮，防止卡死在语音模式 */}
                     <button onClick={toggleVideo} className="absolute right-0 top-[-60px] p-3 bg-white/10 rounded-full text-white">
                        <VideoOff size={20}/>
                     </button>
                 </div>
            </div>
         ) : (
            // Video Call Controls
            <div className="grid grid-cols-3 gap-y-8 gap-x-4 items-center">
                 <ControlBtn 
                   icon={isMuted ? <MicOff /> : <Mic />} 
                   label={isMuted ? "已静音" : "静音"} 
                   active={isMuted}
                   onClick={toggleMute} 
                />
                 <ControlBtn 
                   icon={isSpeaker ? <Volume2 /> : <VolumeX />} 
                   label={isSpeaker ? "扬声器" : "听筒"} 
                   active={isSpeaker}
                   onClick={toggleSpeaker} 
                />
                 <ControlBtn 
                   icon={isVideoEnabled ? <Video /> : <VideoOff />} 
                   label={isVideoEnabled ? "摄像头开" : "摄像头关"} 
                   active={isVideoEnabled} // 这里通常开启是 active
                   onClick={toggleVideo} 
                />
                 <ControlBtn 
                   icon={<Camera />} 
                   label="翻转" 
                   onClick={() => callAction('switchCamera')} 
                />
                <div className="flex flex-col items-center">
                   <button 
                     onClick={handleHangup}
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

// 修复 ControlBtn 样式 Bug
const ControlBtn: React.FC<{ icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }> = ({ icon, label, active, onClick }) => (
  <div className="flex flex-col items-center justify-center gap-2">
     <button 
       onClick={onClick}
       // 修复：active 时显示白底黑字，inactive 时显示半透明底白字
       className={`w-[60px] h-[60px] rounded-full flex items-center justify-center transition-colors 
         ${active ? 'bg-white text-black' : 'bg-white/20 text-white hover:bg-white/30'}`}
     >
        {React.cloneElement(icon as React.ReactElement<any>, { size: 30, strokeWidth: 1.5 })}
     </button>
     <span className="text-white/80 text-[12px]">{label}</span>
  </div>
);

export default CallOverlay;