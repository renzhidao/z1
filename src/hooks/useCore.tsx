
import { useState, useEffect, useCallback } from 'react';
import { AppStateData, Contact, Message } from '../global'; // Assuming types are global or mapped

// Initial default state matching AppStateData
const initialState: AppStateData = {
  myId: '',
  myName: '',
  isHub: false,
  activeChat: null,
  activeChatName: '',
  mqttStatus: '初始化',
  loading: true,
  unread: {},
  contacts: {},
  conns: {}
};

export function useCore() {
  const [coreState, setCoreState] = useState<AppStateData>(initialState);
  const [lastMessages, setLastMessages] = useState<Record<string, string>>({});

  useEffect(() => {
    // 1. Initial Sync
    if (window.store) {
      // Create a snapshot of all relevant keys
      const snapshot: any = {};
      const keys = Object.keys(initialState) as Array<keyof AppStateData>;
      keys.forEach(k => {
        snapshot[k] = window.store.get(k);
      });
      setCoreState(prev => ({ ...prev, ...snapshot }));
    }

    // 2. Listen for State Changes
    const handleStateChange = (key: keyof AppStateData, newVal: any) => {
      setCoreState(prev => ({
        ...prev,
        [key]: newVal
      }));
    };

    // 3. Listen for Incoming Messages (to update 'lastMessage' preview)
    const handleIncomingMessage = (msg: Message) => {
      const peerId = msg.senderId === coreState.myId ? msg.target : msg.senderId;
      const preview = msg.kind === 'image' ? '[图片]' : (msg.txt || '[文件]');
      
      setLastMessages(prev => ({
        ...prev,
        [peerId]: preview
      }));
    };

    // Attach Listeners
    if (window.store) {
      window.store.on('change', handleStateChange);
    }
    if (window.protocol) {
      window.protocol.on('message', handleIncomingMessage);
    }

    return () => {
      if (window.store) {
        window.store.off('change', handleStateChange);
      }
      if (window.protocol) {
        window.protocol.off('message', handleIncomingMessage);
      }
    };
  }, [coreState.myId]);

  // Actions
  const sendMessage = useCallback(async (text: string, kind: 'text'|'image' = 'text', file?: File) => {
    if (!window.protocol) return;
    
    // If file provided
    if (file && window.smartCore) {
       // SmartCore handles chunking and sending
       // Note: The UI might need to handle the display of the message immediately
       // but typically protocol.on('message') will fire for self-sent messages too in this architecture
       window.smartCore.sendFile(file, undefined, { kind }); 
    } else {
       await window.protocol.sendMsg(text, kind);
    }
  }, []);

  const connectTo = useCallback((peerId: string) => {
    if (window.p2p) {
      window.p2p.connectTo(peerId);
    }
  }, []);

  return {
    state: coreState,
    lastMessages,
    sendMessage,
    connectTo
  };
}
