import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, QrCode } from 'lucide-react';
import { User } from '../types';

interface PersonalInfoProps {
  onBack: () => void;
  currentUser: User;
  onQRCodeClick?: () => void;
  onNameClick?: () => void;
  onGenderClick?: () => void;
  onRegionClick?: () => void;
  onTickleClick?: () => void;
  onSignatureClick?: () => void;
}

const PersonalInfo: React.FC<PersonalInfoProps> = ({ 
  onBack, 
  currentUser, 
  onQRCodeClick,
  onNameClick,
  onGenderClick,
  onRegionClick,
  onTickleClick,
  onSignatureClick
}) => {
  const [showAvatarSheet, setShowAvatarSheet] = useState(false);

  // Mock data to match screenshot
  const profileData = {
    name: '开心每天',
    gender: '男',
    region: '安道尔',
    phone: '177******43',
    wechatId: 'cbnlf_qyfx',
    signature: '未填写'
  };

  return (
    <div className="fixed inset-0 bg-[#EDEDED] z-50 flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="bg-[#EDEDED] h-[56px] flex items-center px-2 shrink-0 border-b border-gray-300/50">
        <button 
          onClick={onBack}
          className="p-2 -ml-1 text-[#191919] hover:bg-gray-200/50 rounded-full transition-colors flex items-center active:opacity-60"
        >
          <ChevronLeft size={26} strokeWidth={1.5} />
          <span className="text-[16px] font-normal ml-[-4px]">个人信息</span>
        </button>
        <span className="ml-1 text-[17px] font-medium absolute left-1/2 -translate-x-1/2 text-[#191919]">个人资料</span>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pt-2">
        {/* Group 1 */}
        <div className="bg-white mb-2 border-y border-gray-200/50">
           <div 
             onClick={() => setShowAvatarSheet(true)}
             className="flex items-center justify-between px-4 py-3 border-b border-gray-100 active:bg-[#DEDEDE] cursor-pointer"
           >
             <span className="text-[16px] text-[#191919]">头像</span>
             <div className="flex items-center gap-3">
               <img 
                 src={currentUser.avatar} 
                 className="w-12 h-12 rounded-[6px] object-cover bg-gray-200"
                 alt="Avatar"
               />
               <ChevronRight size={16} className="text-gray-400" />
             </div>
           </div>

           <InfoItem label="名字" value={profileData.name} onClick={onNameClick} />
           <InfoItem label="性别" value={profileData.gender} onClick={onGenderClick} />
           <InfoItem label="地区" value={profileData.region} onClick={onRegionClick} />
           <InfoItem label="手机号" value={profileData.phone} />
           <InfoItem label="微信号" value={profileData.wechatId} />
           
           <div 
             onClick={onQRCodeClick}
             className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 active:bg-[#DEDEDE] cursor-pointer"
           >
             <span className="text-[16px] text-[#191919]">我的二维码</span>
             <div className="flex items-center gap-3">
               <QrCode size={18} className="text-gray-400" />
               <ChevronRight size={16} className="text-gray-400" />
             </div>
           </div>

           <InfoItem label="拍一拍" onClick={onTickleClick} />
           <InfoItem label="签名" value={profileData.signature} onClick={onSignatureClick} />
        </div>

        {/* Group 2 */}
        <div className="bg-white mb-2 border-y border-gray-200/50">
           <InfoItem label="来电铃声" />
           <InfoItem label="我的地址" />
           <InfoItem label="我的发票抬头" />
        </div>

         {/* Group 3 */}
         <div className="bg-white mb-8 border-y border-gray-200/50">
           <InfoItem label="微信豆" />
        </div>
      </div>

       {/* Avatar Action Sheet */}
       {showAvatarSheet && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          <div 
            className="absolute inset-0 bg-black/40 transition-opacity"
            onClick={() => setShowAvatarSheet(false)}
          ></div>
          <div className="relative z-[70] bg-[#F7F7F7] rounded-t-[12px] overflow-hidden safe-bottom slide-in-from-bottom">
             <div className="bg-white flex flex-col">
               <button className="w-full py-3.5 text-[17px] text-[#191919] font-normal active:bg-[#F2F2F2] border-b border-gray-100/50">
                 查看上一张头像
               </button>
               <button className="w-full py-3.5 text-[17px] text-[#191919] font-normal active:bg-[#F2F2F2] border-b border-gray-100/50">
                 从手机相册选择
               </button>
               <button className="w-full py-3.5 text-[17px] text-[#191919] font-normal active:bg-[#F2F2F2]">
                 拍照
               </button>
               <button className="w-full py-3.5 text-[17px] text-[#191919] font-normal active:bg-[#F2F2F2]">
                 保存图片
               </button>
             </div>
             
             <div className="mt-2 bg-white">
               <button 
                 className="w-full py-3.5 text-[17px] text-[#191919] font-normal active:bg-[#F2F2F2]"
                 onClick={() => setShowAvatarSheet(false)}
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

const InfoItem: React.FC<{ label: string, value?: string, onClick?: () => void }> = ({ label, value, onClick }) => (
  <div 
    onClick={onClick}
    className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 last:border-0 active:bg-[#DEDEDE] cursor-pointer"
  >
     <span className="text-[16px] text-[#191919]">{label}</span>
     <div className="flex items-center gap-2">
       {value && <span className="text-[15px] text-gray-500 mr-1">{value}</span>}
       <ChevronRight size={16} className="text-gray-400" />
     </div>
  </div>
);

export default PersonalInfo;