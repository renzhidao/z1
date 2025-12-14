
import React, { useState, useEffect, useRef } from 'react';
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
import { initBridge, kernelEvents } from './bridge/ui-adapter';
import { initKernel } from './kernel/launcher';
import { mapUser } from './bridge/data-map';

export function App() {
  const [currentTab, setCurrentTab] = useState<Tab>(Tab.CHATS);
  const initializedRef = useRef(false);
  
  // Kernel Initialization (Singleton Guard)
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const boot = async () => {
       initBridge(); // 1. Setup Adapter (Fake UI)
       await initKernel(); // 2. Start Logic
    };
    boot();
  }, []);

  // App State
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Navigation Stacks
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

  // Dynamic "Me" user from Kernel State
  const [myUser, setMyUser] = useState<User>({ 
    id: 'me', 
    name: '我', 
    avatar: 'https://picsum.photos/seed/me/200/200', 
    wechatId: '-', 
    region: 'P2P 节点' 
  });
  
  const [totalUnread, setTotalUnread] = useState(0);

  // Sync My Info & Global Unread
  useEffect(() => {
    const syncState = () => {
       if (window.state) {
           // Sync User
           const u = mapUser(window.state.myId, window.state.myName);
           setMyUser({ ...u, id: 'me', wechatId: window.state.myId });
           
           // Sync Unread
           let count = 0;
           if (window.state.unread) {
               Object.values(window.state.unread).forEach((c: any) => count += (c || 0));
           }
           setTotalUnread(count);
       }
    };
    
    // Initial sync
    syncState();
    
    // Poll backup
    const timer = setInterval(syncState, 2000);
    
    // Event listener
    const handler = () => syncState();
    kernelEvents.addEventListener('KERNEL_CONTACTS_UPDATE', handler);
    kernelEvents.addEventListener('KERNEL_NEW_MSG', handler);

    return () => {
        clearInterval(timer);
        kernelEvents.removeEventListener('KERNEL_CONTACTS_UPDATE', handler);
        kernelEvents.removeEventListener('KERNEL_NEW_MSG', handler);
    };
  }, []);

  const showToast = (message: string, icon: 'success' | 'loading' | 'none' = 'none') => {
    setToast({ show: true, message, icon });
  };
  
  // Logic: Save Name to Kernel
  const handleSaveName = (newName: string) => {
      if (window.state) {
          window.state.myName = newName;
          localStorage.setItem('nickname', newName);
          // Force update UI
          setMyUser(prev => ({ ...prev, name: newName }));
          // Notify network
          if (window.ui && window.ui.updateSelf) window.ui.updateSelf();
      }
      setShowChangeName(false);
      showToast('名字已更新', 'success');
  };

  const handleChatAction = (action: string, chat: Chat) => {
    if (action === 'delete') {
       showToast('聊天已隐藏');
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

  const handleStartChat = (user: User) => {
    setCurrentTab(Tab.CHATS);
    const chat: Chat = {
        id: user.id,
        user: user,
        lastMessage: '',
        timestamp: '刚刚',
        unreadCount: 0,
        isMuted: false,
        messages: []
    };
    setSelectedChat(chat);
    setSelectedUser(null);
  };

  const renderContent = () => {
    switch (currentTab) {
      case Tab.CHATS:
        return <ChatList onChatClick={setSelectedChat} onChatAction={handleChatAction} />;
      case Tab.CONTACTS:
        return <div className="flex items-center justify-center h-full text-gray-400">通讯录功能正在接入内核...</div>;
      case Tab.DISCOVER:
        return <div className="flex items-center justify-center h-full text-gray-400">发现页功能开发中</div>;
      case Tab.ME:
        return (
          <div className="flex flex-col bg-[#EDEDED] min-h-full pb-safe-bottom">
             {/* User Info Card */}
             <div 
               className="bg-white pt-10 pb-8 px-6 mb-2 flex items-center cursor-pointer active:bg-[#FAFAFA]"
               onClick={() => setShowPersonalInfo(true)}
             >
                <img 
                  src={myUser.avatar} 
                  className="w-16 h-16 rounded-[8px] mr-4 bg-gray-200" 
                />
                <div className="flex-1">
                   <div className="flex items-center justify-between">
                      <h2 className="text-[20px] font-semibold text-[#191919] mb-1.5">{myUser.name}</h2>
                      <div className="flex items-center gap-4">
                         <button 
                           onClick={(e) => { e.stopPropagation(); setShowQRCode(true); }}
                           className="p-1"
                         >
                            <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M3 3h7v7H3z"/><path d="M14 3h7v7h-7z"/><path d="M14 14h7v7h-7z"/><path d="M3 14h7v7H3z"/>
                            </svg>
                         </button>
                         <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                         </svg>
                      </div>
                   </div>
                   <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                         <span className="text-[15px] text-gray-500 mb-2 truncate max-w-[200px]">ID：{myUser.wechatId}</span>
                         <button 
                           onClick={(e) => { e.stopPropagation(); setShowStatus(true); }}
                           className="flex items-center gap-1 border border-gray-300 rounded-[14px] px-2 py-0.5 w-fit"
                         >
                            <span className="text-[12px] text-gray-500">+ 状态</span>
                         </button>
                      </div>
                   </div>
                </div>
             </div>
             
             {/* Settings Entry */}
             <div className="bg-white mb-2">
                 <div className="flex items-center px-6 py-4 active:bg-[#FAFAFA] cursor-pointer border-b border-gray-100" onClick={() => setShowSettings(true)}>
                    <svg className="w-6 h-6 text-[#10AEFF] mr-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                    <span className="text-[17px] flex-1 text-[#191919]">设置</span>
                    <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                 </div>
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
         <Header title={currentTab === Tab.CHATS ? (window.state?.activeChatName || '微信') : '微信'} onSearchClick={() => setShowSearch(true)} onMenuAction={handleMenuAction} />
         {renderContent()}
      </div>

      <BottomNav currentTab={currentTab} onTabChange={setCurrentTab} unreadCount={totalUnread} />

      {selectedChat && (
        <div className="fixed inset-0 z-50">
          <ChatDetail 
            chat={selectedChat} 
            onBack={() => setSelectedChat(null)} 
            currentUserId={window.state?.myId || 'me'}
            onShowToast={showToast}
            onUserClick={() => { 
                if (selectedChat.user.id !== 'me') setSelectedUser(selectedChat.user);
                else setShowPersonalInfo(true);
            }}
          />
        </div>
      )}

      {selectedUser && (
        <div className="fixed inset-0 z-50">
          <Profile 
            user={selectedUser} 
            onBack={() => setSelectedUser(null)} 
            onSendMessage={handleStartChat}
            onCall={() => showToast('暂不支持通话')}
          />
        </div>
      )}
      
      {showPersonalInfo && (
        <div className="fixed inset-0 z-50">
          <PersonalInfo 
             onBack={() => setShowPersonalInfo(false)} 
             currentUser={myUser}
             onNameClick={() => setShowChangeName(true)}
             onQRCodeClick={() => setShowQRCode(true)}
          />
        </div>
      )}
      
      {showChangeName && (
        <div className="fixed inset-0 z-[60]">
           <ChangeName 
               onBack={() => setShowChangeName(false)} 
               initialName={myUser.name}
               onSave={handleSaveName}
           />
        </div>
      )}

      {showQRCode && (
          <div className="fixed inset-0 z-[60]">
              <MyQRCode onBack={() => setShowQRCode(false)} user={myUser} />
          </div>
      )}

      {showSettings && (
          <div className="fixed inset-0 z-[55]">
              <Settings 
                  onBack={() => setShowSettings(false)} 
                  onNavigateToPersonalInfo={() => setShowPersonalInfo(true)}
                  onCareModeClick={() => setShowCareMode(true)}
              />
          </div>
      )}

      {showStatus && <StatusPage onClose={() => setShowStatus(false)} />}
      {showCareMode && <CareMode onBack={() => setShowCareMode(false)} />}

      {toast.show && <Toast message={toast.message} icon={toast.icon} onClose={() => setToast({ ...toast, show: false })} />}
    </div>
  );
}
