import { useState, useEffect, useCallback } from 'react';
import { Chat, Message, User } from '../types';

export function useCoreBridge() {
  const [contacts, setContacts] = useState<Chat[]>([]);
  const [currentUser, setCurrentUser] = useState<User>({ id: 'me', name: '我', avatar: '' });
  const [mqttStatus, setMqttStatus] = useState<string>('初始化');

  // Sync Core Data to React State
  const sync = useCallback(() => {
    if (!window.state) return;
    
    // 1. User Info
    setCurrentUser({
        id: window.state.myId,
        name: window.state.myName,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${window.state.myId}`,
        wechatId: window.state.myId,
        region: window.state.isHub ? 'Hub Node' : 'Client Node'
    });

    setMqttStatus(window.state.mqttStatus);

    // 2. Contacts List
    const { contacts: rawContacts, conns, unread } = window.state;
    const chatList: Chat[] = [];

    // Public Channel (Always First)
    chatList.push({
      id: 'all',
      user: { id: 'all', name: '公共频道 · v2025-12-16-fix7', avatar: '' }, 
      lastMessage: '[公共广播]',
      timestamp: '',
      unreadCount: unread['all'] || 0,
      isMuted: false,
      messages: []
    });

    // P2P Contacts
    Object.values(rawContacts).forEach(c => {
      if (c.id === window.state.myId) return;
      const isOnline = conns[c.id] && conns[c.id].open;
      
      chatList.push({
        id: c.id,
        user: { 
            id: c.id, 
            name: c.n || c.id.slice(0, 6), 
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.id}` 
        },
        lastMessage: isOnline ? '[在线]' : '[离线]',
        timestamp: isOnline ? '刚刚' : '',
        unreadCount: unread[c.id] || 0,
        isMuted: false,
        messages: []
      });
    });

    setContacts(chatList);
  }, []);

  useEffect(() => {
    sync(); // Initial sync

    // Listen to shim events
    const handler = (e: CustomEvent) => {
        if (e.detail.type === 'list' || e.detail.type === 'self' || e.detail.type === 'msg') {
            sync();
        }
    };

    window.addEventListener('core-ui-update', handler as EventListener);
    return () => window.removeEventListener('core-ui-update', handler as EventListener);
  }, [sync]);

  return { contacts, currentUser, mqttStatus };
}
