import React from 'react';
import { ChevronLeft, MoreHorizontal } from 'lucide-react';
import { User } from '../types';

interface MyQRCodeProps {
  onBack: () => void;
  user: User;
}

const MyQRCode: React.FC<MyQRCodeProps> = ({ onBack, user }) => {
  return (
    <div className="fixed inset-0 bg-[#EDEDED] z-50 flex flex-col animate-in slide-in-from-right duration-300">
       {/* Header */}
       <div className="bg-[#EDEDED] h-[56px] flex items-center justify-between px-2 shrink-0">
        <button 
          onClick={onBack}
          className="p-2 -ml-1 text-[#191919] hover:bg-gray-200/50 rounded-full transition-colors flex items-center active:opacity-60"
        >
          <ChevronLeft size={26} strokeWidth={1.5} />
        </button>
        <span className="text-[17px] font-medium">二维码名片</span>
        <button className="p-2 text-[#191919] hover:bg-gray-200/50 rounded-full active:opacity-60">
          <MoreHorizontal size={24} />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white rounded-[12px] w-full max-w-sm aspect-[3/4] p-6 shadow-sm flex flex-col items-center">
            <div className="flex w-full items-center mb-8">
                <img src={user.avatar} className="w-16 h-16 rounded-[6px] mr-4 bg-gray-200" alt="Avatar"/>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <span className="text-[18px] font-medium text-[#191919]">{user.name}</span>
                        {/* Gender Icon */}
                        <div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center">
                            <svg className="w-3 h-3 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/><path d="M12 12v9"/><path d="M9 18h6"/></svg>
                        </div>
                    </div>
                    <div className="text-[14px] text-gray-500 mt-1">{user.region}</div>
                </div>
            </div>

            <div className="w-64 h-64 bg-white mb-8">
                {/* Mock QR Code Pattern */}
                 <svg viewBox="0 0 100 100" className="w-full h-full fill-black">
                    <path d="M10 10h20v20h-20zM70 10h20v20h-20zM10 70h20v20h-20z" />
                    <path d="M15 15h10v10h-10zM75 15h10v10h-10zM15 75h10v10h-10z" />
                    <rect x="40" y="10" width="10" height="10" />
                    <rect x="55" y="10" width="10" height="10" />
                    <rect x="40" y="25" width="10" height="10" />
                    <rect x="55" y="25" width="10" height="10" />
                    <rect x="40" y="40" width="10" height="10" />
                    <rect x="55" y="40" width="10" height="10" />
                    <rect x="10" y="40" width="10" height="10" />
                    <rect x="25" y="40" width="10" height="10" />
                    <rect x="70" y="40" width="10" height="10" />
                    <rect x="85" y="40" width="10" height="10" />
                    <rect x="40" y="55" width="10" height="10" />
                    <rect x="55" y="55" width="10" height="10" />
                    <rect x="70" y="55" width="10" height="10" />
                    <rect x="85" y="55" width="10" height="10" />
                    <rect x="40" y="70" width="10" height="10" />
                    <rect x="55" y="70" width="10" height="10" />
                    <rect x="70" y="70" width="10" height="10" />
                    <rect x="85" y="70" width="10" height="10" />
                    <rect x="40" y="85" width="10" height="10" />
                    <rect x="55" y="85" width="10" height="10" />
                    {/* Central Icon */}
                    <rect x="43" y="43" width="14" height="14" fill="white"/>
                 </svg>
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-8">
                     <img src={user.avatar} className="w-8 h-8 rounded-[4px] border border-white" />
                 </div>
            </div>

            <div className="text-[14px] text-gray-400 mt-auto">扫一扫上面的二维码图案，加我微信</div>
        </div>
      </div>
    </div>
  );
};

export default MyQRCode;