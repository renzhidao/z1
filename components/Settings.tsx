import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SettingsProps {
  onBack: () => void;
  onNavigateToPersonalInfo?: () => void;
  onCareModeClick?: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onBack, onNavigateToPersonalInfo, onCareModeClick }) => {
  return (
    <div className="fixed inset-0 bg-[#EDEDED] z-50 flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="bg-[#EDEDED] h-[56px] flex items-center px-2 shrink-0 border-b border-gray-300/50">
        <button 
          onClick={onBack}
          className="p-2 -ml-1 text-[#191919] hover:bg-gray-200/50 rounded-full transition-colors flex items-center active:opacity-60"
        >
          <ChevronLeft size={26} strokeWidth={1.5} />
          <span className="text-[16px] font-normal ml-[-4px]">我</span>
        </button>
        <span className="ml-1 text-[17px] font-medium absolute left-1/2 -translate-x-1/2 text-[#191919]">设置</span>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pt-2 pb-safe-bottom">
        {/* Personal Info Row (Optional in Settings) */}
        {onNavigateToPersonalInfo && (
           <div className="bg-white mb-2 border-y border-gray-200/50">
             <SettingsItem label="个人资料" onClick={onNavigateToPersonalInfo} />
           </div>
        )}

        <div className="bg-white mb-2 border-y border-gray-200/50">
           <SettingsItem label="账号与安全" />
        </div>

        <div className="bg-white mb-2 border-y border-gray-200/50">
           <SettingsItem label="青少年模式" />
           <SettingsItem label="关怀模式" onClick={onCareModeClick} />
        </div>

        <div className="bg-white mb-2 border-y border-gray-200/50">
           <SettingsItem label="新消息通知" />
           <SettingsItem label="聊天" />
           <SettingsItem label="通用" />
           <SettingsItem label="设备" />
        </div>

        <div className="bg-white mb-2 border-y border-gray-200/50">
           <SettingsItem label="朋友权限" />
           <SettingsItem label="个人信息与权限" />
           <SettingsItem label="个人信息收集清单" />
           <SettingsItem label="第三方信息共享清单" />
        </div>

        <div className="bg-white mb-2 border-y border-gray-200/50">
           <SettingsItem label="插件" />
        </div>

        <div className="bg-white mb-2 border-y border-gray-200/50">
           <SettingsItem label="关于微信" value="版本 8.0.45" />
        </div>

        <div className="bg-white mb-4 border-y border-gray-200/50">
           <SettingsItem label="帮助与反馈" />
        </div>

        {/* Switch Account & Logout as White Cards */}
        <div className="mb-8 px-0">
           <div className="bg-white border-y border-gray-200/50 mb-2">
               <button className="w-full text-[#191919] py-3.5 text-[17px] font-medium active:bg-[#DEDEDE] text-center">
                 切换账号
               </button>
           </div>
           <div className="bg-white border-y border-gray-200/50">
               <button className="w-full text-[#191919] py-3.5 text-[17px] font-medium active:bg-[#DEDEDE] text-center">
                 退出登录
               </button>
           </div>
        </div>
      </div>
    </div>
  );
};

const SettingsItem: React.FC<{ label: string, value?: string, onClick?: () => void }> = ({ label, value, onClick }) => (
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

export default Settings;