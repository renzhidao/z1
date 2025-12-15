import React from 'react';
import { ChevronLeft, Search, ChevronRight, QrCode, ScanLine, Smartphone, Radar, Users, UserPlus, Building, ShoppingBag } from 'lucide-react';

interface AddFriendProps {
  onBack: () => void;
  myWechatId: string;
}

const AddFriend: React.FC<AddFriendProps> = ({ onBack, myWechatId }) => {
  return (
    <div className="fixed inset-0 bg-[#EDEDED] z-50 flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="bg-[#EDEDED] h-[56px] flex items-center px-2 shrink-0 border-b border-gray-300/50">
        <button 
          onClick={onBack}
          className="p-2 -ml-1 text-[#191919] hover:bg-gray-200/50 rounded-full transition-colors flex items-center active:opacity-60"
        >
          <ChevronLeft size={26} strokeWidth={1.5} />
          <span className="text-[16px] font-normal ml-[-4px]">通讯录</span>
        </button>
        <span className="ml-1 text-[17px] font-medium absolute left-1/2 -translate-x-1/2">添加朋友</span>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {/* Search Bar Area */}
        <div className="px-2 py-3 bg-[#EDEDED]">
            <div className="bg-white rounded-[6px] h-[40px] flex items-center justify-center text-gray-400 active:bg-gray-50 transition-colors cursor-text">
                <Search size={18} className="mr-1.5 opacity-40" />
                <span className="text-[16px] text-gray-400/70 font-normal">账号/手机号</span>
            </div>
        </div>

        {/* My Wechat ID */}
        <div className="flex justify-center items-center pb-5 pt-1 text-[14px] text-gray-500/80 cursor-pointer active:opacity-60">
           <span className="font-normal mr-1">我的微信号：{myWechatId}</span>
           <QrCode size={16} className="text-black opacity-80" />
        </div>

        {/* List Items */}
        <div className="bg-white border-y border-gray-200/50 pl-4">
            <Item icon={<ScanLine size={22} className="text-white" />} color="bg-[#10AEFF]" title="扫一扫" subtitle="扫描二维码名片" />
            <Item icon={<Smartphone size={22} className="text-white" />} color="bg-[#07C160]" title="手机联系人" subtitle="添加通讯录中的朋友" />
            <Item icon={<Radar size={22} className="text-white" />} color="bg-[#2782D7]" title="雷达" subtitle="添加身边的朋友" />
            <Item icon={<Building size={22} className="text-white" />} color="bg-[#2782D7]" title="企业微信联系人" subtitle="通过手机号搜索企业微信用户" />
            <Item icon={<Users size={22} className="text-white" />} color="bg-[#07C160]" title="面对面建群" subtitle="与身边的朋友进入同一个群聊" />
            <Item icon={<UserPlus size={22} className="text-white" />} color="bg-[#2782D7]" title="公众号" subtitle="获取更多资讯" />
            <Item icon={<ShoppingBag size={22} className="text-white" />} color="bg-[#FA9D3B]" title="服务号" subtitle="获取更多购物信息和服务" isLast />
        </div>
      </div>
    </div>
  );
};

const Item: React.FC<{ icon: React.ReactNode, color: string, title: string, subtitle: string, isLast?: boolean }> = ({ icon, color, title, subtitle, isLast }) => (
  <div className="flex items-center active:bg-[#DEDEDE] py-3 cursor-pointer pr-4">
      <div className={`w-9 h-9 rounded-[6px] mr-3.5 flex items-center justify-center shrink-0 ${color}`}>
          {icon}
      </div>
      <div className={`flex-1 flex items-center justify-between py-1 ${!isLast ? 'border-b border-gray-100' : ''}`}>
          <div className="flex flex-col justify-center h-10">
              <div className="text-[17px] text-[#191919] font-normal leading-none mb-1.5">{title}</div>
              <div className="text-[13px] text-gray-400 leading-none">{subtitle}</div>
          </div>
          <ChevronRight size={16} className="text-gray-300" />
      </div>
  </div>
);

export default AddFriend;