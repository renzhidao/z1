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
import { MOCK_CHATS } from './constants';
// Use explicit relative import
import { initBackend, getChatsFromBackend } from './services/m3Bridge';
import { User as UserIcon, Box, ShoppingBag, Gamepad, Zap, Smile, CreditCard, Image, Camera, ChevronRight, Search as SearchIcon, Users, Tag, FileText, MessageSquare, Settings as SettingsIcon, Smartphone, ScanLine, Wallet, Folder, FileQuestion, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

export function App() {
  const [currentTab, setCurrentTab] = useState<Tab>(Tab.CHATS);
  
  // App State
  const [chatList, setChatList] = useState<Chat[]>([]);
  const [isBackendReady, setIsBackendReady] = useState(false);
  const [bootStatus, setBootStatus] = useState("正在启动...");
  const [fsCheckList, setFsCheckList] = useState<{path: string, status: string, ok: boolean}[]>([]);
  const [showForceEnter, setShowForceEnter] = useState(false);

  // Dynamic User State
  const [currentUser, setCurrentUser] = useState<User>({
    id: 'me', 
    name: '加载中...', 
    avatar: 'https://picsum.photos/seed/me/200/200', 
    wechatId: 'loading...', 
    region: 'P1 网络' 
  });

  // Initialize M3 Backend
  useEffect(() => {
    // 1. File System Diagnostic Check
    const checkFiles = async () => {
        // Fix: Safe access for env
        const base = (import.meta as any)?.env?.BASE_URL || './';
        const paths = [
            `${base}m3-1/loader.js`,
            `${base}m3-1/config.json`
        ];
        
        const results = [];
        for (const p of paths) {
            try {
                const res = await fetch(p, { method: 'HEAD' });
                results.push({
                    path: p, 
                    status: res.ok ? 'OK' : `${res.status}`,
                    ok: res.ok
                });
            } catch (e) {
                results.push({
                    path: p,
                    status: 'Error',
                    ok: false
                });
            }
        }
        setFsCheckList(results);
    };
    checkFiles();

    // 2. Start Backend
    const startUp = async () => {
        // Pass callback to update status
        await initBackend((status) => setBootStatus(status));
        setIsBackendReady(true);
        refreshChats();
        refreshSelf();
    };
    startUp();

    // Show force enter button quickly (3s) so user isn't stuck
    const forceTimer = setTimeout(() => setShowForceEnter(true), 3000);

    // Listen for M3 Events
    const handleListUpdate = () => refreshChats();
    const handleMsgIncoming = () => refreshChats(); 
    const handleSelfUpdate = () => refreshSelf();
    
    window.addEventListener('m3-list-update', handleListUpdate);
    window.addEventListener('m3-msg-incoming', handleMsgIncoming);
    window.addEventListener('m3-self-update', handleSelfUpdate);
    
    const timer = setInterval(refreshChats, 5000);

    return () => {
        window.removeEventListener('m3-list-update', handleListUpdate);
        window.removeEventListener('m3-msg-incoming', handleMsgIncoming);
        window.removeEventListener('m3-self-update', handleSelfUpdate);
        clearInterval(timer);
        clearTimeout(forceTimer);
    };
  }, []);

  const refreshChats = async () => {
      // 宽松检查，只要有 state 就可以尝试获取
      if (!window.state) return;
      const chats = await getChatsFromBackend();
      const sorted = chats.sort((a, b) => {
          if (!!a.isPinned === !!b.isPinned) return 0;
          return a.isPinned ? -1 : 1;
      });
      setChatList(sorted);
  };

  const refreshSelf = () => {
      if (!window.state) return;
      setCurrentUser({
          id: window.state.myId,
          name: window.state.myName,
          avatar: 'https://picsum.photos/seed/me/200/200',
          wechatId: window.state.myId ? window.state.myId.slice(0, 8) : '...',
          region: window.state.mqttStatus === '在线' ? 'P1 网络 (在线)' : 'P1 网络 (离线)'
      });
  };

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

  // Contacts Data Grouped (Mock for now, can be mapped from m3 later)
  const contactsGrouped = [
     { 
       letter: 'A', 
       contacts: [
         { name: '公共频道', avatar: 'https://picsum.photos/seed/public/200/200' },
       ] 
     }
  ];

  const showToast = (message: string, icon: 'success' | 'loading' | 'none' = 'none') => {
    setToast({ show: true, message, icon });
  };

  // Chat Context Menu Actions
  const handleChatAction = (action: string, chat: Chat) => {
    if (action === 'delete') {
      setChatList(prev => prev.filter(c => c.id !== chat.id));
    } else if (action === 'hide') {
      // In this mock, hiding is functionally removing it from the view
      setChatList(prev => prev.filter(c => c.id !== chat.id));
    } else if (action === 'pin') {
      setChatList(prev => {
        // Toggle pin state
        const updatedList = prev.map(c => 
          c.id === chat.id ? { ...c, isPinned: !c.isPinned } : c
        );
        return updatedList; 
      });
    } else if (action === 'unread') {
      setChatList(prev => prev.map(c => 
        c.id === chat.id ? { ...c, unreadCount: c.unreadCount > 0 ? 0 : 1 } : c
      ));
    }
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
    if (user.id === currentUser.id) {
        setShowPersonalInfo(true);
    } else {
        setSelectedUser(user);
    }
  };

  const handleStartChat = (user: User) => {
    // Check if exists
    const existingChat = chatList.find(c => c.id === user.id);
    if (existingChat) {
       setSelectedChat(existingChat);
    } else {
       // Create temp chat object
       const newChat: Chat = {
         id: user.id,
         user: user,
         lastMessage: '',
         timestamp: '刚刚',
         unreadCount: 0,
         isMuted: false,
         messages: []
       };
       setChatList(prev => [newChat, ...prev]);
       setSelectedChat(newChat);
    }
    setSelectedUser(null); 
  };

  const handleStartCall = (user: User) => {
      setCallState({ active: true, type: 'video', user });
  }

  const renderContent = () => {
    switch (currentTab) {
      case Tab.CHATS:
        return <ChatList chats={chatList} onChatClick={setSelectedChat} onChatAction={handleChatAction} />;
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
                 { label: '公众号', color: 'bg-[#2782D7]', icon: <FileText size={20} fill="white" className="text-white"/> },
                 { label: '服务号', color: 'bg-[#FA9D3B]', icon: <ShoppingBag size={20} fill="white" className="text-white"/> }
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
            
            {/* Enterprise Section */}
            <div className="px-4 py-2 text-[14px] text-gray-500 font-normal">我的企业及企业联系人</div>
            
            <div className="bg-white border-t border-b border-gray-200/50 mb-0">
               <div 
                 onClick={() => showToast("功能暂未开放")}
                 className="flex items-center px-4 py-3 active:bg-[#DEDEDE] transition-colors cursor-pointer"
               >
                  <div className="w-10 h-10 rounded-[4px] mr-3 flex items-center justify-center bg-[#2782D7]">
                    <MessageSquare size={20} className="text-white" fill="white"/>
                  </div>
                  <span className="text-[17px] text-[#191919]">企业微信联系人</span>
               </div>
            </div>

            {/* Contact Groups */}
            <div className="bg-white flex-1 flex flex-col border-t border-gray-200/50">
               {contactsGrouped.map((group, gIdx) => (
                 <div key={gIdx}>
                    <div className="px-4 py-1 bg-[#F7F7F7] text-[#555555] text-[14px] font-medium border-b border-gray-100/50">
                      {group.letter}
                    </div>
                    {group.contacts.map((contact, cIdx) => (
                       <div 
                          key={cIdx} 
                          onClick={() => handleUserClick({id: `c_${group.letter}_${cIdx}`, name: contact.name, avatar: contact.avatar, region: '广东 广州'})}
                          className="w-full flex items-center px-4 py-2.5 border-b border-gray-100 last:border-0 active:bg-[#DEDEDE] cursor-pointer"
                       >
                          <img src={contact.avatar} className="w-10 h-10 rounded-[4px] mr-3" alt={contact.name} />
                          <span className="text-[17px] text-[#191919] font-normal">{contact.name}</span>
                       </div>
                    ))}
                 </div>
               ))}
               <div className="py-8 text-center text-gray-400 text-[15px]">
                 在线节点: {window.state ? Object.keys(window.state.conns || {}).length : 0}
               </div>
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
                    <div className="relative mr-3">
                      <img src="https://picsum.photos/seed/moment/200/200" className="w-8 h-8 rounded-[4px]" />
                      <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#FA5151] rounded-full border border-white"></div>
                    </div>
                    <ChevronRight size={16} className="text-gray-400" />
                  </div>
               </div>
             </div>

             {/* Scan & Shake */}
             <div className="bg-white mb-2 border-y border-gray-200/50">
               <DiscoverItem icon={<ScanLine size={22} color="#2782D7" />} label="扫一扫" />
               <DiscoverItem icon={<Zap size={22} color="#2782D7" fill="#2782D7" />} label="摇一摇" onClick={() => setShowShake(true)} />
             </div>

             {/* Top Stories & Search */}
             <div className="bg-white mb-2 border-y border-gray-200/50">
               <DiscoverItem icon={<Box size={22} color="#FA9D3B" />} label="看一看" />
               <DiscoverItem icon={<SearchIcon size={22} color="#FA5151" />} label="搜一搜" />
             </div>

             {/* Nearby & Games */}
             <div className="bg-white mb-2 border-y border-gray-200/50">
               <DiscoverItem icon={<Users size={22} color="#2782D7" />} label="附近的直播和人" />
             </div>

             {/* Shopping & Games */}
             <div className="bg-white mb-2 border-y border-gray-200/50">
               <DiscoverItem icon={<ShoppingBag size={22} color="#FA9D3B" />} label="购物" />
               <DiscoverItem icon={<Gamepad size={22} color="#FA9D3B" />} label="游戏" />
             </div>
             
             {/* Mini Programs */}
             <div className="bg-white mb-8 border-y border-gray-200/50">
               <DiscoverItem icon={<Box size={22} color="#7B68EE" />} label="小程序" />
             </div>
           </div>
        );
      case Tab.ME:
        return (
          <div className="flex flex-col bg-[#EDEDED] min-h-full pb-safe-bottom">
             {/* User Info Card */}
             <div 
               className="bg-white pt-10 pb-8 px-6 mb-2 flex items-center cursor-pointer active:bg-[#FAFAFA]"
             >
                <img 
                  src={currentUser.avatar} 
                  className="w-16 h-16 rounded-[8px] mr-4 bg-gray-200" 
                  onClick={() => setShowPersonalInfo(true)}
                />
                <div className="flex-1">
                   <div className="flex items-center justify-between" onClick={() => setShowPersonalInfo(true)}>
                      <h2 className="text-[20px] font-semibold text-[#191919] mb-1.5">{currentUser.name}</h2>
                   </div>
                   <div className="flex items-center justify-between">
                      <div className="flex flex-col" onClick={() => setShowPersonalInfo(true)}>
                         <span className="text-[15px] text-gray-500 mb-2">ID：{currentUser.wechatId}</span>
                         <button 
                           onClick={(e) => { e.stopPropagation(); setShowStatus(true); }}
                           className="flex items-center gap-1 border border-gray-300 rounded-[14px] px-2 py-0.5 w-fit"
                         >
                            <span className="text-[12px] text-gray-500">+ 状态</span>
                         </button>
                      </div>
                      <div className="flex items-center gap-4">
                        <QrCodeIcon size={18} className="text-gray-400" />
                        <ChevronRight size={16} className="text-gray-400" />
                      </div>
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

  if (!isBackendReady) {
      return (
          <div className="fixed inset-0 bg-[#EDEDED] flex flex-col items-center justify-center px-4">
              <div className="w-12 h-12 border-4 border-gray-300 border-t-[#07C160] rounded-full animate-spin mb-4"></div>
              <p className="text-gray-500 text-sm font-medium">正在启动 P1 核心...</p>
              <p className="text-gray-400 text-xs mt-2 font-mono mb-6 text-center">{bootStatus}</p>
              
              {showForceEnter && (
                  <button 
                    onClick={() => { setIsBackendReady(true); refreshChats(); }}
                    className="mb-6 px-4 py-2 bg-[#07C160] text-white rounded text-sm font-medium flex items-center gap-1 active:opacity-80 animate-in fade-in duration-300"
                  >
                    强制进入 <ArrowRight size={14} />
                  </button>
              )}

              {/* File System Check List */}
              <div className="w-full max-w-sm bg-white rounded-lg p-3 shadow-sm border border-gray-200 text-left">
                  <div className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1">
                      <Folder size={12} /> 环境文件检查
                  </div>
                  <div className="space-y-1.5">
                      {fsCheckList.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs border-b border-gray-100 pb-1 last:border-0">
                              <span className="truncate flex-1 font-mono text-gray-600">{item.path}</span>
                              <div className="flex items-center gap-1">
                                  {item.ok ? <CheckCircle2 size={12} className="text-green-500" /> : <AlertCircle size={12} className="text-red-500" />}
                                  <span className={item.ok ? "text-green-600" : "text-red-500"}>{item.status}</span>
                              </div>
                          </div>
                      ))}
                      {fsCheckList.length === 0 && <span className="text-xs text-gray-400">正在扫描...</span>}
                  </div>
                  <div className="mt-2 text-[10px] text-gray-400 border-t pt-2">
                      提示：请确保 `m3-1` 文件夹已移动到 `public` 目录下，以便正确加载。
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="h-full w-full flex flex-col bg-[#EDEDED] overflow-hidden">
      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
         {currentTab === Tab.CHATS && <Header title="微信" onSearchClick={() => setShowSearch(true)} onMenuAction={handleMenuAction} />}
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
            onBack={() => setSelectedChat(null)} 
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
           <AddFriend onBack={() => setShowAddFriend(false)} myWechatId={currentUser.wechatId || ''} />
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
            type={callState.type} 
            onHangup={() => setCallState({ ...callState, active: false })} 
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

// Sub-components (unchanged)
const DiscoverItem: React.FC<{ icon: React.ReactNode, label: string, onClick?: () => void }> = ({ icon, label, onClick }) => (
  <div onClick={onClick} className="flex items-center px-4 py-3 border-b border-gray-100 last:border-0 active:bg-[#DEDEDE] cursor-pointer">
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