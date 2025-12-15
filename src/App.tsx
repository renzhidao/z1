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
import { Tab, Chat, User, ToastState, Message } from './types';
import { useCore } from './hooks/useCore';
import { Loader2 } from 'lucide-react';
import { MOCK_CHATS } from './constants'; // Keep for fallback or mixing

export function App() {
  const [coreReady, setCoreReady] = useState(!!window.__CORE_READY__);
  const { state: coreState, lastMessages, sendMessage, connectTo } = useCore();
  
  const [currentTab, setCurrentTab] = useState<Tab>(Tab.CHATS);
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

  const [callState, setCallState] = useState<{ active: boolean; type: 'voice' | 'video'; user: User | null }>({ active: false, type: 'voice', user: null });
  const [toast, setToast] = useState<ToastState>({ show: false, message: '' });

  // 1. Startup Blocking
  useEffect(() => {
    if (coreReady) return;
    
    const onReady = () => setCoreReady(true);
    if (window.__CORE_READY__) {
      onReady();
    } else {
      window.addEventListener('core-ready', onReady);
      // Timeout fallback in case core script fails silently
      const timer = setTimeout(() => {
          console.warn("Core load timeout, proceeding safely...");
          setCoreReady(true);
      }, 5000);
      return () => {
        window.removeEventListener('core-ready', onReady);
        clearTimeout(timer);
      };
    }
  }, [coreReady]);

  const showToast = (message: string, icon: 'success' | 'loading' | 'none' = 'none') => {
    setToast({ show: true, message, icon });
  };

  // 2. Data Mapping (Core Contacts -> UI Chats)
  // We merge Real P2P contacts with MOCK_CHATS for "Service Accounts" look and feel if desired, 
  // or purely use P2P. Let's prioritize P2P and append MOCKs at the end or remove them.
  // For this refactor, we replace the main chat list with P2P contacts.
  const getMappedChats = (): Chat[] => {
     const p2pChats: Chat[] = Object.values(coreState.contacts).map((contact: any) => {
        return {
           id: contact.id,
           user: {
             id: contact.id,
             name: contact.n || contact.id.slice(0, 6),
             avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${contact.id}`, // Generate avatar from ID
             region: 'P2P Node'
           },
           lastMessage: lastMessages[contact.id] || '无消息',
           timestamp: new Date(contact.t).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
           unreadCount: coreState.unread[contact.id] || 0,
           isMuted: false,
           messages: [] // Detailed messages loaded in ChatDetail
        };
     });
     
     // Include Gemini Bot from Mocks as a feature
     const geminiChat = MOCK_CHATS.find(c => c.id === 'gemini-bot');
     
     const allChats = geminiChat ? [geminiChat, ...p2pChats] : p2pChats;
     
     // Sort: Pinned (not imp in core yet) -> Time
     return allChats; // Simplified sort
  };

  const myUser: User = { 
    id: coreState.myId || 'me', 
    name: coreState.myName || '我', 
    avatar: 'https://picsum.photos/seed/me/200/200', 
    wechatId: coreState.myId, // Use PeerID as ID
    region: 'P2P Network' 
  };

  const handleStartChat = (user: User) => {
    // Check if it's a P2P contact
    if (coreState.contacts[user.id]) {
       const chat = getMappedChats().find(c => c.id === user.id);
       if (chat) setSelectedChat(chat);
    } else {
       // Temporary chat for new connection logic
       const newChat: Chat = {
         id: user.id,
         user: user,
         lastMessage: '',
         timestamp: '刚刚',
         unreadCount: 0,
         isMuted: false,
         messages: []
       };
       setSelectedChat(newChat);
    }
    setSelectedUser(null);
  };

  const handleMenuAction = (action: string) => {
    if (action === 'add_friend') {
      setShowAddFriend(true);
    } else if (action === 'create_chat') {
      showToast('暂不支持群聊', 'none');
    } else {
      showToast('功能暂未开放');
    }
  };

  if (!coreReady) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#EDEDED]">
        <Loader2 size={40} className="text-[#07C160] animate-spin mb-4" />
        <span className="text-gray-500 font-medium">正在启动 P2P 核心...</span>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-[#EDEDED] overflow-hidden">
      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
         {currentTab === Tab.CHATS && (
             <React.Fragment>
                <Header title={`微信 (${coreState.mqttStatus})`} onSearchClick={() => setShowSearch(true)} onMenuAction={handleMenuAction} />
                <ChatList chats={getMappedChats()} onChatClick={setSelectedChat} />
             </React.Fragment>
         )}
         {/* Reuse existing tabs but static for now */}
         {currentTab === Tab.CONTACTS && (
             <React.Fragment>
                <Header title="通讯录" onSearchClick={() => setShowSearch(true)} onMenuAction={handleMenuAction} />
                {/* Simplified Contact List based on Core */}
                 <div className="flex flex-col bg-[#EDEDED] min-h-full pb-safe-bottom">
                    <div className="bg-white mt-2 border-t border-gray-200/50">
                        <div onClick={() => setShowAddFriend(true)} className="flex items-center px-4 py-3 active:bg-[#DEDEDE] cursor-pointer">
                            <div className="w-10 h-10 rounded-[4px] mr-3 flex items-center justify-center bg-[#FA9D3B] text-white"><span className="font-bold">+</span></div>
                            <span className="text-[17px] text-[#191919]">新的朋友 (连接节点)</span>
                        </div>
                    </div>
                    <div className="px-4 py-2 text-[14px] text-gray-500 font-normal">已连接节点</div>
                    <div className="bg-white flex-1 flex flex-col border-t border-gray-200/50">
                        {Object.values(coreState.contacts).map((c: any) => (
                           <div key={c.id} onClick={() => handleStartChat({id: c.id, name: c.n, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.id}`})} className="w-full flex items-center px-4 py-2.5 border-b border-gray-100 active:bg-[#DEDEDE] cursor-pointer">
                              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${c.id}`} className="w-10 h-10 rounded-[4px] mr-3" />
                              <span className="text-[17px] text-[#191919]">{c.n}</span>
                           </div>
                        ))}
                    </div>
                 </div>
             </React.Fragment>
         )}
         {currentTab === Tab.DISCOVER && (
            <React.Fragment>
              <Header title="发现" onSearchClick={() => setShowSearch(true)} onMenuAction={handleMenuAction} />
              <div className="flex flex-col bg-[#EDEDED] min-h-full pt-0 pb-safe-bottom">
                 <div onClick={() => setShowMoments(true)} className="bg-white mt-0 mb-2 active:bg-[#DEDEDE] cursor-pointer border-b border-gray-200/50">
                    <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-[17px] text-[#191919]">朋友圈</span>
                    </div>
                 </div>
                 <div className="bg-white mb-2 px-4 py-3 text-center text-gray-400">P2P 朋友圈开发中...</div>
              </div>
            </React.Fragment>
         )}
         {currentTab === Tab.ME && (
            <React.Fragment>
              <Header title="我" onSearchClick={() => setShowSearch(true)} onMenuAction={handleMenuAction} />
              <div className="flex flex-col bg-[#EDEDED] min-h-full pb-safe-bottom">
                 <div className="bg-white pt-10 pb-8 px-6 mb-2 flex items-center cursor-pointer active:bg-[#FAFAFA]" onClick={() => setShowPersonalInfo(true)}>
                    <img src={myUser.avatar} className="w-16 h-16 rounded-[8px] mr-4 bg-gray-200" />
                    <div className="flex-1">
                       <h2 className="text-[20px] font-semibold text-[#191919] mb-1.5">{myUser.name}</h2>
                       <span className="text-[15px] text-gray-500">ID: {myUser.id.substring(0,8)}...</span>
                    </div>
                 </div>
                 <div className="bg-white mb-8 border-y border-gray-200/50">
                    <div className="flex items-center px-4 py-3 border-b border-gray-100 active:bg-[#DEDEDE] cursor-pointer" onClick={() => setShowSettings(true)}>
                        <span className="text-[17px] text-[#191919]">设置</span>
                    </div>
                 </div>
              </div>
            </React.Fragment>
         )}
      </div>

      <BottomNav currentTab={currentTab} onTabChange={setCurrentTab} />

      {/* Overlays */}
      {selectedChat && (
        <div className="fixed inset-0 z-50">
          <ChatDetail 
            chat={selectedChat} 
            onBack={() => setSelectedChat(null)} 
            currentUserId={coreState.myId}
            onShowToast={(msg) => showToast(msg)}
          />
        </div>
      )}

      {showAddFriend && (
        <div className="fixed inset-0 z-50">
           <AddFriend 
              onBack={() => setShowAddFriend(false)} 
              myWechatId={coreState.myId}
              onConnect={(id) => { connectTo(id); showToast('尝试连接...'); setShowAddFriend(false); }}
           />
        </div>
      )}

       {/* Reusing Mock-driven components for UI completeness where P2P isn't ready */}
      {showMoments && <div className="fixed inset-0 z-50"><Moments onBack={() => setShowMoments(false)} onUserClick={() => {}} /></div>}
      {showSettings && <div className="fixed inset-0 z-50"><Settings onBack={() => setShowSettings(false)} onNavigateToPersonalInfo={() => setShowPersonalInfo(true)} /></div>}
      {showPersonalInfo && <div className="fixed inset-0 z-50"><PersonalInfo onBack={() => setShowPersonalInfo(false)} currentUser={myUser} /></div>}
      
      {toast.show && (
        <Toast message={toast.message} icon={toast.icon} onClose={() => setToast({ ...toast, show: false })} />
      )}
    </div>
  );
}