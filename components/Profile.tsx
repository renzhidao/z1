import React from 'react';
import { ChevronLeft, MoreHorizontal, ChevronRight, MessageSquare, Video } from 'lucide-react';
import { User as UserType } from '../types';

interface ProfileProps {
  user: UserType;
  onBack: () => void;
  onSendMessage: (user: UserType) => void;
  onCall: (user: UserType) => void;
}

const Profile: React.FC<ProfileProps> = ({ user, onBack, onSendMessage, onCall }) => {
  return (
    <div className="fixed inset-0 bg-[#EDEDED] z-50 flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header - Transparent/White with no title */}
      <div className="bg-white h-[56px] flex items-center justify-between px-2 shrink-0">
        <button 
          onClick={onBack}
          className="p-2 -ml-1 text-[#191919] hover:bg-gray-200/50 rounded-full transition-colors flex items-center active:opacity-60"
        >
          <ChevronLeft size={26} strokeWidth={1.5} />
        </button>
        <button className="p-2 text-[#191919] hover:bg-gray-200/50 rounded-full active:opacity-60">
          <MoreHorizontal size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {/* User Info Section */}
        <div className="bg-white px-6 pb-8 pt-2 mb-2 flex items-start">
           <img 
             src={user.avatar || 'https://picsum.photos/seed/default/200/200'} 
             className="w-[64px] h-[64px] rounded-[6px] mr-4 shadow-[0_0_1px_rgba(0,0,0,0.1)] bg-gray-200 object-cover shrink-0" 
             alt={user.name}
           />
           <div className="flex-1 pt-0.5 min-w-0">
             <div className="flex items-center mb-1">
               <h2 className="text-[22px] font-semibold text-[#191919] mr-1.5 leading-tight truncate">{user.name}</h2>
               {/* Gender icon (Male) */}
               <div className="w-3.5 h-3.5 mt-0.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#2782D7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" stroke="none" fill="none"/><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" opacity="0"/><path d="M20 4L12 12M20 4H16M20 4V8" strokeWidth="3"/></svg>
                  <span className="sr-only">男</span>
               </div>
             </div>
             
             <p className="text-[14px] text-gray-500 mb-0.5 leading-snug">昵称: 吴锦常</p>
             <p className="text-[14px] text-gray-500 mb-0.5 leading-snug">微信号: {user.wechatId || 'wxid_ib45kzwwzo2222'}</p>
             <p className="text-[14px] text-gray-500 leading-snug">地区: {user.region || '广西 钦州'}</p>
           </div>
        </div>

        {/* List Group 1 */}
        <div className="bg-white mb-2 border-y border-gray-200/50">
           <ListItem label="朋友资料" />
           <ListItem label="标签" value="亲人" />
        </div>

        {/* List Group 2 */}
        <div className="bg-white mb-2 border-y border-gray-200/50">
           <ListItem label="朋友权限" />
        </div>

        {/* List Group 3 */}
        <div className="bg-white mb-2 border-y border-gray-200/50">
           <ListItem label="朋友圈" />
        </div>

        {/* Action Buttons (Centered List Style) */}
        <div className="bg-white border-y border-gray-200/50 mt-2">
            <button 
              onClick={() => onSendMessage(user)}
              className="w-full h-[56px] flex items-center justify-center gap-2 active:bg-[#DEDEDE] border-b border-gray-100"
            >
               <MessageSquare size={20} className="text-[#576B95]" strokeWidth={2} />
               <span className="text-[17px] font-medium text-[#576B95]">发消息</span>
            </button>
            <button 
              onClick={() => onCall(user)}
              className="w-full h-[56px] flex items-center justify-center gap-2 active:bg-[#DEDEDE]"
            >
               <Video size={22} className="text-[#576B95]" strokeWidth={2} />
               <span className="text-[17px] font-medium text-[#576B95]">音视频通话</span>
            </button>
        </div>
      </div>
    </div>
  );
};

const ListItem: React.FC<{ label: string, value?: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 last:border-0 active:bg-[#DEDEDE] cursor-pointer">
     <span className="text-[17px] text-[#191919]">{label}</span>
     <div className="flex items-center gap-2">
       {value && <span className="text-[15px] text-gray-500 mr-1">{value}</span>}
       <ChevronRight size={16} className="text-gray-300" />
     </div>
  </div>
);

export default Profile;