import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import ChatList from './components/ChatList';
import ChatDetail from './components/ChatDetail';
import Moments from './components/Moments';
import Settings from './components/Settings';
import PersonalInfo from './components/PersonalInfo';
import Profile from './components/Profile';
import Toast from './components/Toast';
import AddFriend from './components/AddFriend';
import CreateChat from './components/CreateChat';
import MyQRCode from './components/MyQRCode';
import CallOverlay from './components/CallOverlay';
import Shake from './components/Shake';
import StatusPage from './components/StatusPage';
import Collections from './components/Collections';
import CareMode from './components/CareMode';
import SetTickle from './components/SetTickle';
import RegionSelect from './components/RegionSelect';
import GenderSelect from './components/GenderSelect';
import ChangeName from './components/ChangeName';
import Signature from './components/Signature';
import ChangeCover from './components/ChangeCover';
import { Tab, Chat, User, ToastState } from './types';
import { useCoreBridge } from './hooks/useCoreBridge';
import { User as UserIcon, Box, ShoppingBag, Gamepad, Zap, Smile, CreditCard, Image, Camera, ChevronRight, Search as SearchIcon, Users, Tag, FileText, MessageSquare, Settings as SettingsIcon, Smartphone, ScanLine, Wallet, Plus, RotateCw, LayoutGrid, Star, QrCode } from 'lucide-react';

export function App() {
  const [currentTab, setCurrentTab] = useState<Tab>(Tab.CHATS);
  
  // --- CORE BRIDGE ---
  // Use data directly from the headless core
  const { contacts: chatList, currentUser, mqttStatus } = useCoreBridge();

  // Navigation Stacks
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showMoments, setShowMoments] = useState(false);
  const [showSettings, setShowSettings] = useState(false); 
  const [showPersonalInfo, setShowPersonalInfo] = useState(false); 
  const [showSearch, setShowSearch] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showCreateChat, setShowCreateChat] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [showShake, setShowShake] = useState(false);
  
  // New Page States
  const [showStatus, setShowStatus] = useState(false);
  const [showCollections, setShowCollections] = useState(false);
  const [showCareMode, setShowCareMode] = useState(false);
  const [showSetTickle, setShowSetTickle] = useState(false);
  const [showRegionSelect, setShowRegionSelect] = useState(false);
  const [showGenderSelect, setShowGenderSelect] = useState(false);
  const [showChangeName, setShowChangeName] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [showChangeCover, setShowChangeCover] = useState(false);

  // Call State
  const [callState, setCallState] = useState<{ active: boolean; type: 'voice' | 'video'; user: User | null }>({ active: false, type: 'voice', user: null });

  // Global Feedback
  const [toast, setToast] = useState<ToastState>({ show: false, message: '' });

  // Contacts Data Grouped (Placeholder for Contact Tab)
  const contactsGrouped = [
     { 
       letter: 'P', 
       contacts: chatList.filter(c => c.id !== 'all').map(c => ({ name: c.user.name, avatar: c.user.avatar })) 
     }
  ];

  const showToast = (message: string, icon: 'success' | 'loading' | 'none' = 'none') => {
    setToast({ show: true, message, icon });
  };

  // Chat Context Menu Actions
  const handleChatAction = (action: string, chat: Chat) => {
    // Since state is managed by Core, we can't easily "delete" locally without Core support
    showToast("功能暂不可用 (Core Mode)");
  };

  const handleMenuAction = (action: string) => {
    if (action === 'add_friend') {
      setShowAddFriend(true);
    } else if (action === 'create_chat') {
      setShowCreateChat(true);
    } else if (action === 'scan') {
      showToast('打开扫一扫');
    } else if (action === 'money') {
      showToast('打开收付款');
    }
  };

  const handleUserClick = (user: User) => {
    // Check against Core ID
    if (user.id === 'me' || user.id === currentUser.id) {
        setShowPersonalInfo(true);
    } else {
        setSelectedUser(user);
    }
  };

  const handleStartChat = (user: User) => {
    const existingChat = chatList.find(c => c.id === user.id);
    if (existingChat) {
       // Notify Core to switch active chat
       if (window.state) {
          window.state.activeChat = existingChat.id;
          window.state.activeChatName = existingChat.user.name;
          window.state.unread[existingChat.id] = 0;
          if (window.app) window.app.loadHistory(20);
       }
       setSelectedChat(existingChat);
    } else {
       // Create temp chat
       const newChat: Chat = {
         id: user.id,
         user: user,
         lastMessage: '',
         timestamp: '刚刚',
         unreadCount: 0,
         isMuted: false,
         messages: []
       };
       // Note: We don't setChatList here because it comes from Core. 
       if (window.state) {
          window.state.activeChat = user.id;
          window.state.activeChatName = user.name;
       }
       setSelectedChat(newChat);
    }
    setSelectedUser(null); 
  };

  const handleStartCall = (user: User) => {
      showToast("暂不支持通话");
  }

  const renderContent = () => {
    switch (currentTab) {
      case Tab.CHATS:
        return (
            <>
                {mqttStatus !== '在线' && (
                    <div className="bg-[#FFEBEB] text-[#FA5151] px-4 py-2 text-[13px] flex items-center justify-center">
                        <span>网络连接中... ({mqttStatus})</span>
                    </div>
                )}
                <ChatList chats={chatList} onChatClick={(chat) => {
                    // Sync Core State
                    if (window.state) {
                        window.state.activeChat = chat.id;
                        window.state.activeChatName = chat.user.name;
                        window.state.unread[chat.id] = 0;
                        if(window.app) window.app.loadHistory(20);
                    }
                    setSelectedChat(chat);
                }} onChatAction={handleChatAction} />
            </>
        );
      case Tab.CONTACTS:
        return (
          <div className="flex flex-col bg-[#EDEDED] min-h-full pb-safe-bottom relative">
            {/* Search Bar */}
            <div className="px-2 py-2 bg-[#EDEDED]">
              <div 
                onClick={() => setShowSearch(true)}
                className="bg-white rounded-[6px] h-9 flex items-center justify-center text-gray-400 text-[15px] cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <SearchIcon size={16} />
                  搜索
                </span>
              </div>
            </div>

            {/* Top Menu Items */}
            <div className="bg-white mt-0 border-t border-b border-gray-200/50">
               {[
                 { label: '新的朋友', color: 'bg-[#FA9D3B]', icon: <UserIcon size={20} fill="white" className="text-white"/>, action: () => setShowAddFriend(true) },
                 { label: '群聊', color: 'bg-[#07C160]', icon: <Users size={20} fill="white" className="text-white" />, action: () => setShowCreateChat(true) },
                 { label: '标签', color: 'bg-[#2782D7]', icon: <Tag size={20} fill="white" className="text-white"/> },
                 { label: '公众号', color: 'bg-[#2782D7]', icon: <FileText size={20} fill="white" className="text-white"/> }
               ].map((item, idx) => (
                 <div 
                   key={idx} 
                   onClick={item.action ? item.action : () => showToast("功能暂未开放")}
                   className="flex items-center px-4 py-3 border-b border-gray-100 last:border-0 active:bg-[#DEDEDE] transition-colors cursor-pointer"
                 >
                    <div className={`w-10 h-10 rounded-[4px] mr-3 flex items-center justify-center ${item.color}`}>
                      {item.icon}
                    </div>
                    <span className="text-[17px] text-[#191919] font-normal">{item.label}</span>
                 </div>
               ))}
            </div>
            
            {/* Online Peers Section */}
            <div className="bg-white flex-1 flex flex-col border-t border-gray-200/50 mt-2">
               <div className="px-4 py-2 text-gray-500 text-sm bg-[#F7F7F7]">在线节点 ({chatList.length - 1})</div>
               {chatList.map((chat) => {
                   if (chat.id === 'all') return null;
                   return (
                       <div 
                          key={chat.id} 
                          onClick={() => handleUserClick(chat.user)}
                          className="w-full flex items-center px-4 py-2.5 border-b border-gray-100 last:border-0 active:bg-[#DEDEDE] cursor-pointer"
                       >
                          <img src={chat.user.avatar} className="w-10 h-10 rounded-[4px] mr-3" alt={chat.user.name} />
                          <span className="text-[17px] text-[#191919] font-normal">{chat.user.name}</span>
                       </div>
                   );
               })}
            </div>
          </div>
        );
      case Tab.DISCOVER:
        return (
           <div className="flex flex-col bg-[#EDEDED] min-h-full pt-0 pb-safe-bottom">
             {/* Moments */}
             <div 
               onClick={() => setShowMoments(true)}
               className="bg-white mt-0 mb-2 active:bg-[#DEDEDE] cursor-pointer border-b border-gray-200/50"
            >
               <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center">
                    <div className="w-6 h-6 mr-4 flex items-center justify-center">
                      <Camera size={22} strokeWidth={1.5} className="text-[#191919]" />
                    </div>
                    <span className="text-[17px] text-[#191919]">朋友圈</span>
                  </div>
                  <div className="flex items-center">
                    <ChevronRight size={16} className="text-gray-400" />
                  </div>
               </div>
             </div>
             <div className="p-4 text-center text-gray-400 text-sm">发现页功能暂未对接后端</div>
           </div>
        );
case Tab.ME:
        return (
          <div className="flex flex-col bg-[#EDEDED] min-h-full pb-safe-bottom">
{/* User Info Card (Template Style) */}
             <div className="bg-white px-6 pt-12 pb-8 mb-2 active:bg-gray-50" onClick={() => setShowPersonalInfo(true)}>
               <div className="flex items-start">
                 {/* Avatar */}
                 <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0 mr-5">
                   <img 
                     src={currentUser.avatar} 
                     alt="Avatar" 
                     className="w-full h-full object-cover"
                   />
                 </div>
                 
                 {/* Info Column */}
                 <div className="flex-grow pt-0.5">
                   <div className="flex items-start justify-between">
                     {/* Name */}
                     <h2 className="text-[22px] font-bold text-[#191919] leading-tight mb-1">{currentUser.name}</h2>
                     
                     {/* QR & Arrow */}
                     <div className="flex items-center gap-4 mt-1">
                       <QrCodeIcon size={18} className="text-gray-400" />
                       <ChevronRight size={16} className="text-gray-400" />
                     </div>
                   </div>
                   
                   {/* WeChat ID */}
                   <p className="text-[#191919] text-[15px] mb-3">微信号：{currentUser.id}</p>
                   
                   {/* Status Button */}
                   <button 
                     onClick={(e) => { e.stopPropagation(); setShowStatus(true); }}
                     className="flex items-center space-x-1 px-3 py-1 rounded-full border border-[#e5e5e5] text-[#191919] text-[13px] active:bg-gray-100 transition-colors w-fit"
                   >
                     <Plus className="w-3.5 h-3.5 text-gray-500" />
                     <span className="text-gray-600">状态</span>
                   </button>
                 </div>
               </div>
             </div>

             {/* Services */}
             <div className="bg-white mb-2 border-y border-gray-200/50">
                <MeItem icon={<div className="w-6 h-6 bg-[#07C160] rounded-sm flex items-center justify-center"><Wallet size={16} color="white" /></div>} label="服务" />
             </div>

             {/* Collection, Moments, Cards, Stickers */}
             <div className="bg-white mb-2 border-y border-gray-200/50">
                <MeItem icon={<Box size={22} color="#FA9D3B" />} label="收藏" onClick={() => setShowCollections(true)} />
                <MeItem icon={<Image size={22} color="#2782D7" />} label="朋友圈" onClick={() => setShowMoments(true)} />
                <MeItem icon={<CreditCard size={22} color="#2782D7" />} label="卡包" />
                <MeItem icon={<Smile size={22} color="#FA9D3B" />} label="表情" />
             </div>

             {/* Settings */}
             <div className="bg-white mb-8 border-y border-gray-200/50">
                <MeItem icon={<SettingsIcon size={22} color="#2782D7" />} label="设置" onClick={() => setShowSettings(true)} />
             </div>
          </div>
        );
        default:
        return null;
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#EDEDED] overflow-hidden">
      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
         {currentTab === Tab.CHATS && <Header title={`微信 (${mqttStatus})`} onSearchClick={() => setShowSearch(true)} onMenuAction={handleMenuAction} />}
         {currentTab === Tab.CONTACTS && <Header title="通讯录" onSearchClick={() => setShowSearch(true)} onMenuAction={handleMenuAction} />}
         {currentTab === Tab.DISCOVER && <Header title="发现" onSearchClick={() => setShowSearch(true)} onMenuAction={handleMenuAction} />}
         
         {renderContent()}
      </div>

      {/* Global Navigation */}
      <BottomNav currentTab={currentTab} onTabChange={setCurrentTab} />

      {/* --- Overlays & Stacks --- */}

      {selectedChat && (
        <div className="fixed inset-0 z-50">
          <ChatDetail 
            chat={selectedChat} 
            onBack={() => {
                setSelectedChat(null);
                if (window.state) window.state.activeChat = null;
            }} 
            currentUserId={currentUser.id}
            onShowToast={(msg) => showToast(msg)}
            onUserClick={() => { 
                if (selectedChat.user.id !== currentUser.id) {
                    setSelectedUser(selectedChat.user);
                } else {
                    setShowPersonalInfo(true);
                }
            }}
            onVideoCall={() => {
                setCallState({ active: true, type: 'video', user: selectedChat.user });
            }}
          />
        </div>
      )}

      {showMoments && (
        <div className="fixed inset-0 z-50">
          <Moments 
            onBack={() => setShowMoments(false)} 
            onUserClick={(u) => { if(u.id === currentUser.id) setShowPersonalInfo(true); else setSelectedUser(u); }}
            onChangeCover={() => setShowChangeCover(true)}
          />
        </div>
      )}

      {selectedUser && (
        <div className="fixed inset-0 z-50">
          <Profile 
            user={selectedUser} 
            onBack={() => setSelectedUser(null)} 
            onSendMessage={handleStartChat}
            onCall={handleStartCall}
          />
        </div>
      )}

      {/* Settings Stack */}
      {showSettings && (
        <div className="fixed inset-0 z-50">
          <Settings 
             onBack={() => setShowSettings(false)} 
             onNavigateToPersonalInfo={() => setShowPersonalInfo(true)}
             onCareModeClick={() => setShowCareMode(true)}
          />
        </div>
      )}

      {/* Personal Info Stack (Rendered after Settings to be on top) */}
      {showPersonalInfo && (
        <div className="fixed inset-0 z-50">
          <PersonalInfo 
             onBack={() => setShowPersonalInfo(false)} 
             currentUser={currentUser} 
             onQRCodeClick={() => setShowQRCode(true)}
             onNameClick={() => setShowChangeName(true)}
             onGenderClick={() => setShowGenderSelect(true)}
             onRegionClick={() => setShowRegionSelect(true)}
             onTickleClick={() => setShowSetTickle(true)}
             onSignatureClick={() => setShowSignature(true)}
          />
        </div>
      )}

      {/* Sub-pages */}
      {showStatus && <StatusPage onClose={() => setShowStatus(false)} />}
      {showCollections && <Collections onBack={() => setShowCollections(false)} />}
      {showCareMode && <CareMode onBack={() => setShowCareMode(false)} />}
      {showSetTickle && <SetTickle onBack={() => setShowSetTickle(false)} />}
      {showRegionSelect && <RegionSelect onBack={() => setShowRegionSelect(false)} />}
      {showGenderSelect && <GenderSelect onBack={() => setShowGenderSelect(false)} />}
      {showChangeName && <ChangeName onBack={() => setShowChangeName(false)} initialName={currentUser.name} />}
      {showSignature && <Signature onBack={() => setShowSignature(false)} />}
      {showChangeCover && <ChangeCover onBack={() => setShowChangeCover(false)} />}

      {/* Function Overlays */}
      {showAddFriend && (
        <div className="fixed inset-0 z-50">
           <AddFriend onBack={() => setShowAddFriend(false)} myWechatId={currentUser.id} />
        </div>
      )}

      {showCreateChat && (
        <div className="fixed inset-0 z-50">
           <CreateChat 
              onBack={() => setShowCreateChat(false)} 
              contacts={contactsGrouped} 
           />
        </div>
      )}

      {showQRCode && (
        <div className="fixed inset-0 z-50">
           <MyQRCode onBack={() => setShowQRCode(false)} user={currentUser} />
        </div>
      )}
      
      {showShake && (
         <Shake onBack={() => setShowShake(false)} />
      )}

      {callState.active && callState.user && (
         <CallOverlay 
             user={callState.user} 
             myself={currentUser}
             type={callState.type} 
             onHangup={(info) => {
                 setCallState({ ...callState, active: false });
                 if (selectedChat && info) {
                     const text = info.canceled ? "通话已取消" : `通话时长 ${info.duration}`;
                     // 模拟插入一条系统消息 (本地临时)
                     const newMsg = {
                         id: Date.now().toString(),
                         text: text,
                         sender: 'me', // 或 'system'，取决于 ChatDetail 如何渲染 call_log
                         type: 'call_log', // 假设 ChatDetail 支持此类型，若不支持需核对
                         timestamp: '刚刚',
                         isMe: true
                     };
                     // 更新 selectedChat
                     const updatedChat = { 
                         ...selectedChat, 
                         messages: [...selectedChat.messages, newMsg],
                         lastMessage: text,
                         timestamp: '刚刚'
                     };
                     setSelectedChat(updatedChat);
                     
                     // 同时更新列表预览 (简单模拟)
                     // 注意：正式环境应走 Core 消息发送接口
                 }
             }} 
          />
      )}

      {/* Search Overlay */}
      {showSearch && (
        <div className="fixed inset-0 bg-[#EDEDED] z-50 flex flex-col animate-in fade-in duration-200">
           <div className="h-[56px] flex items-center px-2 gap-2 border-b border-gray-300/50">
              <div className="flex-1 bg-white h-9 rounded-[6px] flex items-center px-3">
                 <SearchIcon size={18} className="text-gray-400 mr-2" />
                 <input 
                   className="flex-1 bg-transparent outline-none text-[16px] text-[#191919] caret-[#07C160]" 
                   placeholder="搜索" 
                   autoFocus 
                   style={{ backgroundColor: 'transparent' }}
                 />
              </div>
              <button onClick={() => setShowSearch(false)} className="text-[#576B95] font-medium text-[16px] px-2">取消</button>
           </div>
           <div className="flex-1 flex flex-col items-center pt-20 text-gray-400">
               <span className="text-[14px] mb-6">搜索指定内容</span>
               <div className="flex gap-6 text-[14px] text-[#576B95]">
                  <span>朋友圈</span>
                  <span>文章</span>
                  <span>公众号</span>
               </div>
               <div className="flex gap-6 text-[14px] text-[#576B95] mt-4">
                  <span>小程序</span>
                  <span>音乐</span>
                  <span>表情</span>
               </div>
           </div>
        </div>
      )}

      {toast.show && (
        <Toast 
          message={toast.message} 
          icon={toast.icon} 
          onClose={() => setToast({ ...toast, show: false })} 
        />
      )}
    </div>
  );
}

// Sub-components
const DiscoverItem: React.FC<{ icon: React.ReactNode, label: string, onClick?: () => void }> = ({ icon, label, onClick }) => (
  <div onClick={onClick} className="flex items-center px-4 py-3 border-b border-gray-100 last:border-0 relative active:z-10 active:outline active:outline-[1.5px] active:outline-[#07C160] transition-none cursor-pointer">
     <div className="mr-3">{icon}</div>
     <div className="flex-1 flex items-center justify-between">
        <span className="text-[17px] text-[#191919]">{label}</span>
        <ChevronRight size={16} className="text-gray-300" />
     </div>
  </div>
);

const MeItem: React.FC<{ icon: React.ReactNode, label: string, onClick?: () => void }> = ({ icon, label, onClick }) => (
  <div onClick={onClick} className="flex items-center px-4 py-3 border-b border-gray-100 last:border-0 active:bg-[#DEDEDE] cursor-pointer">
     <div className="mr-3">{icon}</div>
     <div className="flex-1 flex items-center justify-between">
        <span className="text-[17px] text-[#191919]">{label}</span>
        <ChevronRight size={16} className="text-gray-300" />
     </div>
  </div>
);

const QrCodeIcon = ({size, className}: {size: number, className: string}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/></svg>
);


