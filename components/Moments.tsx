import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, Camera, MoreHorizontal, Heart, MessageSquare, Image as ImageIcon } from 'lucide-react';
import { MOCK_MOMENTS } from '../constants';
import { Moment, User } from '../types';

interface MomentsProps {
  onBack: () => void;
  onUserClick: (user: User) => void;
  onChangeCover?: () => void;
}

// Custom Aperture Spinner
const ApertureSpinner: React.FC<{ isSpinning: boolean }> = ({ isSpinning }) => {
  return (
    <div className={`w-full h-full ${isSpinning ? 'animate-spin' : ''}`} style={{ animationDuration: '0.5s' }}>
        {/* Colorful Aperture / Iris Icon */}
        <svg viewBox="0 0 100 100" className="w-full h-full">
           <path d="M50 50 L50 0 A50 50 0 0 1 93.3 25 Z" fill="#FA5151" /> {/* Red Top-Right */}
           <path d="M50 50 L93.3 25 A50 50 0 0 1 93.3 75 Z" fill="#FA9D3B" /> {/* Orange Right */}
           <path d="M50 50 L93.3 75 A50 50 0 0 1 50 100 Z" fill="#07C160" /> {/* Green Bottom-Right */}
           <path d="M50 50 L50 100 A50 50 0 0 1 6.7 75 Z" fill="#10AEFF" /> {/* Blue Bottom-Left */}
           <path d="M50 50 L6.7 25 A50 50 0 0 1 6.7 25 Z" fill="#2782D7" /> {/* Dark Blue Left */}
           <path d="M50 50 L6.7 25 A50 50 0 0 1 50 0 Z" fill="#888" /> {/* Gray Top-Left */}
           <circle cx="50" cy="50" r="10" fill="transparent" /> 
        </svg>
    </div>
  );
};

const Moments: React.FC<MomentsProps> = ({ onBack, onUserClick, onChangeCover }) => {
  const [scrollOpacity, setScrollOpacity] = useState(0);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showCoverMenu, setShowCoverMenu] = useState(false);
  const [showFullCover, setShowFullCover] = useState(false); // State for full screen cover
  const [localMoments, setLocalMoments] = useState<Moment[]>(MOCK_MOMENTS);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refs for Direct DOM Manipulation (Performance optimization)
  const contentRef = useRef<HTMLDivElement>(null);
  const coverContainerRef = useRef<HTMLDivElement>(null);
  const spinnerContainerRef = useRef<HTMLDivElement>(null);
  
  // Drag State Refs (No re-renders)
  const startYRef = useRef(0);
  const currentPullYRef = useRef(0);
  const isDraggingRef = useRef(false);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    // Only change opacity if not pulling
    if (currentPullYRef.current <= 0) {
        const opacity = Math.min(scrollTop / 260, 1);
        setScrollOpacity(opacity);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only enable pull if we are strictly at the top and not currently refreshing
    if (contentRef.current && contentRef.current.scrollTop <= 0 && !isRefreshing) {
      startYRef.current = e.touches[0].clientY;
      isDraggingRef.current = true;
      
      // Disable transitions for instant response during drag
      if (coverContainerRef.current) coverContainerRef.current.style.transition = 'none';
      if (spinnerContainerRef.current) spinnerContainerRef.current.style.transition = 'none';
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    
    // Safety check: if user scrolled down then back up without lifting finger
    if (contentRef.current && contentRef.current.scrollTop > 0) {
        isDraggingRef.current = false;
        return;
    }

    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;

    // Linear physics for Snappy/Fast feel
    const damping = 0.5;
    const moveY = Math.max(0, diff * damping);
    
    currentPullYRef.current = moveY;

    // 1. Stretch Cover Image
    if (coverContainerRef.current) {
      coverContainerRef.current.style.height = `${360 + moveY}px`;
    }

    // 2. Move & Rotate Spinner
    if (spinnerContainerRef.current) {
       const startTop = -40;
       const currentTop = startTop + moveY;
       
       spinnerContainerRef.current.style.top = `${currentTop}px`;
       
       const opacity = Math.min(Math.max(0, (moveY - 10) / 20), 1);
       spinnerContainerRef.current.style.opacity = `${opacity}`;
       
       spinnerContainerRef.current.style.transform = `rotate(${moveY * 4}deg)`;
    }

    // Hide header bg during pull
    if (moveY > 5) {
        setScrollOpacity(0);
    }
  };

  const handleTouchEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    
    // Re-enable smooth transitions for the snap-back
    if (coverContainerRef.current) coverContainerRef.current.style.transition = 'height 0.4s cubic-bezier(0.25, 1, 0.5, 1)';
    if (spinnerContainerRef.current) spinnerContainerRef.current.style.transition = 'all 0.4s cubic-bezier(0.25, 1, 0.5, 1)';

    const pulledDist = currentPullYRef.current;
    const THRESHOLD = 60;

    if (pulledDist > THRESHOLD) {
      setIsRefreshing(true);
      
      // Snap to "Refreshing" state position
      if (coverContainerRef.current) coverContainerRef.current.style.height = `${360 + 60}px`; 
      
      if (spinnerContainerRef.current) {
         spinnerContainerRef.current.style.top = `50px`; 
      }

      // Mock Refresh Async
      setTimeout(() => {
        setIsRefreshing(false);
        resetPosition();
      }, 2000);

    } else {
      resetPosition();
    }
  };

  const resetPosition = () => {
     currentPullYRef.current = 0;
     if (coverContainerRef.current) coverContainerRef.current.style.height = '360px';
     if (spinnerContainerRef.current) {
         spinnerContainerRef.current.style.top = '-40px';
         spinnerContainerRef.current.style.opacity = '0';
         spinnerContainerRef.current.style.transform = 'rotate(0deg)';
     }
  };

  const handleToggleLike = (momentId: string) => {
    setLocalMoments(prev => prev.map(m => {
      if (m.id !== momentId) return m;
      
      const isLiked = m.likes.some(l => l.user.id === 'me');
      if (isLiked) {
        return { ...m, likes: m.likes.filter(l => l.user.id !== 'me') };
      } else {
        return { ...m, likes: [...m.likes, { user: { id: 'me', name: '我', avatar: '' } }] };
      }
    }));
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col slide-in-from-right overflow-hidden">
      
      {/* Navigation Bar */}
      <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
        <div 
          className="absolute inset-0 bg-[#EDEDED] border-b border-gray-300/50 transition-opacity duration-200 pointer-events-auto"
          style={{ opacity: scrollOpacity }}
        ></div>

        <div className="pt-safe-top h-[56px] box-content flex items-center justify-between px-2 relative">
          <button 
            onClick={onBack}
            className="p-2 -ml-1 rounded-full flex items-center relative z-50 active:opacity-60 pointer-events-auto"
          >
            <ChevronLeft 
              size={26} 
              strokeWidth={1.5} 
              color={scrollOpacity > 0.5 ? '#191919' : 'white'} 
            />
          </button>

          <h2 
            className="text-[17px] font-medium text-[#191919] absolute left-1/2 -translate-x-1/2 z-50 transition-opacity duration-200"
            style={{ opacity: scrollOpacity }}
          >
            朋友圈
          </h2>

          <button 
            onClick={() => setShowActionSheet(true)}
            className="p-2 rounded-full relative z-50 active:opacity-60 pointer-events-auto"
          >
            <Camera 
              size={24} 
              color={scrollOpacity > 0.5 ? '#191919' : 'white'} 
              strokeWidth={2}
            />
          </button>
        </div>
      </div>

      {/* Main Scroll Content Wrapper */}
      <div 
        ref={contentRef}
        className="h-full overflow-y-auto no-scrollbar bg-white relative overscroll-contain"
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Spinner */}
        <div 
            ref={spinnerContainerRef}
            className="absolute left-[32px] z-30 w-[26px] h-[26px] pointer-events-none opacity-0"
            style={{ top: '-40px' }}
        >
             <ApertureSpinner isSpinning={isRefreshing} />
        </div>

        {/* Elastic Cover Image Section */}
        <div 
          ref={coverContainerRef}
          className="relative w-full z-0 cursor-pointer" 
          style={{ height: '360px', transformOrigin: 'top center' }} 
          onClick={() => setShowFullCover(true)} // Changed: Open full screen cover instead of menu
        >
           {/* The Image Itself */}
           <img 
             src="https://picsum.photos/seed/cover/800/600" 
             className="w-full h-full object-cover origin-top"
             alt="Cover"
           />
           
           {/* User Info Overlay */}
           <div className="absolute bottom-[-32px] right-4 flex items-end gap-3 z-30">
             <span className="text-white font-medium text-[20px] mb-10 drop-shadow-md pb-2">开心每天</span>
             <img 
               src="https://picsum.photos/seed/me/200/200" 
               className="w-[72px] h-[72px] rounded-[8px] bg-gray-200 shadow-sm object-cover cursor-pointer active:opacity-80"
               alt="My Avatar"
               onClick={(e) => { e.stopPropagation(); onUserClick({id: 'me', name: '我', avatar: 'https://picsum.photos/seed/me/200/200'}); }}
             />
           </div>
        </div>

        {/* Spacer for the avatar overlap */}
        <div className="h-[40px]"></div>

        {/* Moments List */}
        <div className="px-4 pb-20 space-y-8 min-h-[800px] bg-white pt-2 relative z-10">
          {localMoments.map((moment) => (
            <MomentItem 
              key={moment.id} 
              moment={moment} 
              onUserClick={onUserClick} 
              onToggleLike={() => handleToggleLike(moment.id)}
            />
          ))}
          
          <div className="py-8 text-center text-gray-300 text-sm border-t border-gray-100 mt-8">
            —— 朋友仅展示最近半年的朋友圈 ——
          </div>
        </div>
      </div>

      {/* Full Screen Cover View */}
      {showFullCover && (
        <div 
          className="fixed inset-0 z-[60] bg-black flex items-center justify-center animate-in fade-in duration-300"
          onClick={() => setShowFullCover(false)}
        >
          <img 
             src="https://picsum.photos/seed/cover/800/600" 
             className="w-full h-auto max-h-screen object-contain"
             alt="Full Cover"
           />
           
           {/* Change Cover Button - Bottom Right */}
           <button 
             className="absolute bottom-6 right-4 text-white text-[13px] bg-white/10 px-3 py-1.5 rounded-[4px] border border-white/20 backdrop-blur-md flex items-center gap-1.5 active:bg-white/20"
             onClick={(e) => {
                e.stopPropagation();
                setShowFullCover(false);
                setShowCoverMenu(true);
             }}
           >
             <ImageIcon size={14} />
             <span>换封面</span>
           </button>
        </div>
      )}

      {/* Action Sheet Modal */}
      {showActionSheet && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          <div 
            className="absolute inset-0 bg-black/40 transition-opacity"
            onClick={() => setShowActionSheet(false)}
          ></div>
          <div className="relative z-[70] bg-[#F7F7F7] rounded-t-[12px] overflow-hidden safe-bottom slide-in-from-bottom">
             <div className="bg-white flex flex-col">
               <button className="w-full py-3.5 active:bg-[#F2F2F2] border-b border-gray-100/50 flex flex-col items-center justify-center">
                 <span className="text-[17px] text-[#191919] font-normal leading-tight">拍摄</span>
                 <span className="text-[10px] text-gray-400 mt-0.5 leading-tight">照片或视频</span>
               </button>
               <button className="w-full py-4 text-[17px] text-[#191919] font-normal active:bg-[#F2F2F2]">
                 从相册选择
               </button>
             </div>
             <div className="mt-2 bg-white">
               <button 
                 className="w-full py-4 text-[17px] text-[#191919] font-normal active:bg-[#F2F2F2]"
                 onClick={() => setShowActionSheet(false)}
               >
                 取消
               </button>
             </div>
          </div>
        </div>
      )}

      {/* Cover Change Menu */}
      {showCoverMenu && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          <div 
            className="absolute inset-0 bg-black/40 transition-opacity"
            onClick={() => setShowCoverMenu(false)}
          ></div>
          <div className="relative z-[70] bg-[#F7F7F7] rounded-t-[12px] overflow-hidden safe-bottom slide-in-from-bottom">
             <div className="bg-white flex flex-col">
               <button 
                 className="w-full py-4 text-[17px] text-[#191919] font-normal active:bg-[#F2F2F2]"
                 onClick={() => {
                    setShowCoverMenu(false);
                    if (onChangeCover) onChangeCover();
                 }}
               >
                 更换相册封面
               </button>
             </div>
             <div className="mt-2 bg-white">
               <button 
                 className="w-full py-4 text-[17px] text-[#191919] font-normal active:bg-[#F2F2F2]"
                 onClick={() => setShowCoverMenu(false)}
               >
                 取消
               </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MomentItem: React.FC<{ moment: Moment, onUserClick: (u: User) => void, onToggleLike: () => void }> = ({ moment, onUserClick, onToggleLike }) => {
  const [showInteraction, setShowInteraction] = useState(false);
  const isLiked = moment.likes.some(l => l.user.id === 'me');

  return (
    <div className="flex gap-3 border-b border-gray-100 last:border-0 pb-6">
      <img 
        src={moment.user.avatar} 
        alt={moment.user.name}
        className="w-10 h-10 rounded-[4px] bg-gray-200 object-cover flex-shrink-0 cursor-pointer active:opacity-80"
        onClick={() => onUserClick(moment.user)}
      />
      
      <div className="flex-1 min-w-0">
        <h3 className="text-[#576B95] font-medium text-[16px] leading-tight mb-1 cursor-pointer" onClick={() => onUserClick(moment.user)}>
          {moment.user.name}
        </h3>
        
        {moment.content && (
          <p className="text-[#191919] text-[15px] leading-normal mb-2 whitespace-pre-wrap">
            {moment.content}
          </p>
        )}
        
        {moment.images && moment.images.length > 0 && (
          <div className={`grid gap-1.5 mb-2 ${
            moment.images.length === 1 ? 'grid-cols-1' : 
            moment.images.length === 4 ? 'grid-cols-2 max-w-[200px]' : 
            'grid-cols-3 max-w-[300px]'
          }`}>
            {moment.images.map((img, idx) => (
              <img 
                key={idx} 
                src={img} 
                className={`object-cover bg-gray-100 ${
                  moment.images!.length === 1 ? 'max-w-[70%] max-h-[200px] w-auto h-auto rounded-none' : 'w-full aspect-square'
                }`}
                alt="Moment"
              />
            ))}
          </div>
        )}
        
        <div className="flex items-center justify-between mt-1 mb-2 relative">
          <span className="text-gray-400 text-[13px]">{moment.time}</span>
          
          <div className="relative">
            <button 
              onClick={() => setShowInteraction(!showInteraction)}
              className="bg-[#F7F7F7] text-[#576B95] px-2 py-0.5 rounded-[4px] active:bg-gray-200"
            >
               <MoreHorizontal size={18} className="fill-[#576B95]"/>
            </button>
            
            {showInteraction && (
              <div className="absolute right-9 top-1/2 -translate-y-1/2 bg-[#4C4C4C] rounded-[4px] flex items-center overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200 z-10 shadow-lg">
                 <button 
                   onClick={() => { 
                      onToggleLike(); 
                      // Wait for animation then close
                      setTimeout(() => setShowInteraction(false), 300);
                   }}
                   className="flex items-center px-5 py-2.5 text-white text-[14px] font-medium active:bg-black/20 min-w-[80px] justify-center gap-1.5 whitespace-nowrap"
                 >
                    {isLiked ? (
                       // Cancel Style
                       <>
                         <Heart size={18} className="text-[#FA5151] fill-[#FA5151]" />
                         <span>取消</span>
                       </>
                    ) : (
                       // Like Style
                       <>
                         <Heart size={18} className="text-white" />
                         <span>赞</span>
                       </>
                    )}
                 </button>
                 <div className="w-[1px] h-5 bg-black/20"></div>
                 <button className="flex items-center px-5 py-2.5 text-white text-[14px] font-medium active:bg-black/20 min-w-[80px] justify-center gap-1.5 whitespace-nowrap">
                    <MessageSquare size={18} className="text-white" />
                    <span>评论</span>
                 </button>
              </div>
            )} 
            {showInteraction && (
               <div className="fixed inset-0 z-0" onClick={() => setShowInteraction(false)}></div>
            )}
          </div>
        </div>

        {(moment.likes.length > 0 || moment.comments.length > 0) && (
          <div className="bg-[#F7F7F7] rounded-[4px] py-1">
            {moment.likes.length > 0 && (
              <div className="px-3 py-1 flex items-start gap-2 text-[14px] text-[#576B95] leading-snug">
                <Heart size={14} className="mt-1 flex-shrink-0 stroke-[#576B95]" />
                <span className="break-all font-medium">
                  {moment.likes.map(l => l.user.name).join(', ')}
                </span>
              </div>
            )}
            
            {moment.likes.length > 0 && moment.comments.length > 0 && (
              <div className="mx-3 h-[1px] bg-gray-200/50 my-0.5"></div>
            )}
            
            {moment.comments.length > 0 && (
              <div className="px-3 py-1 space-y-1">
                {moment.comments.map(comment => (
                  <div key={comment.id} className="text-[14px] leading-snug">
                    <span className="text-[#576B95] font-medium">{comment.user.name}</span>
                    <span className="text-[#191919]">: {comment.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Moments;