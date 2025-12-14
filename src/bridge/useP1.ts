
import { useState, useEffect, useCallback } from 'react';
import { kernelEvents } from './ui-adapter';
import { Chat, Message } from '../../types';
import { mapChat, mapMessage, mapUser } from './data-map';

// Hook: 实时获取联系人列表
export function useContactList() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [mqttStatus, setMqttStatus] = useState('初始化');

  const sync = useCallback(() => {
    if (!window.state) return;
    
    setMqttStatus(window.state.mqttStatus);

    const newChats: Chat[] = [];
    
    // 1. 公共频道 (Always Top)
    newChats.push({
        id: 'all',
        user: mapUser('all', '公共频道 (所有人)'),
        lastMessage: '点击进入群聊',
        timestamp: '',
        unreadCount: window.state.unread['all'] || 0,
        isMuted: false,
        messages: []
    });

    // 2. P2P 连接
    Object.keys(window.state.conns).forEach(id => {
        const conn = window.state.conns[id];
        if (conn.open) {
            newChats.push(mapChat(id, conn, window.state.unread[id] || 0));
        }
    });

    setChats(newChats);
  }, []);

  useEffect(() => {
    // 初始同步
    sync();
    // 监听 Kernel 信号
    const handler = () => sync();
    kernelEvents.addEventListener('KERNEL_CONTACTS_UPDATE', handler);
    kernelEvents.addEventListener('KERNEL_STATUS_UPDATE', handler);
    
    // 备用：轮询 (防止事件丢失)
    const timer = setInterval(sync, 3000);

    return () => {
        kernelEvents.removeEventListener('KERNEL_CONTACTS_UPDATE', handler);
        kernelEvents.removeEventListener('KERNEL_STATUS_UPDATE', handler);
        clearInterval(timer);
    };
  }, [sync]);

  return { chats, mqttStatus };
}

// Hook: 实时获取单个聊天的消息流
export function useChatMessages(chatId: string) {
  const [messages, setMessages] = useState<Message[]>([]);

  const syncMsgs = useCallback(async () => {
     if (!window.db || !window.state) return;
     
     // 从 DB 获取最近消息
     // Kernel 的 DB.getRecent 返回的是按时间倒序的 (最新的在前)，我们需要反转为正序
     const rawMsgs = await window.db.getRecent(50, chatId);
     const mapped = rawMsgs.reverse().map((m: any) => mapMessage(m, window.state.myId));
     setMessages(mapped);
  }, [chatId]);

  useEffect(() => {
      syncMsgs();
      
      const msgHandler = (e: any) => {
          // 收到新消息信号时，重新拉取
          // 优化：也可以只 append，但重新拉取最稳妥
          const m = e.detail;
          // 只有当前聊天的消息，或者公共频道消息才更新
          if (m.target === chatId || (chatId === 'all' && m.target === 'all') || m.senderId === chatId || (chatId === 'all' && m.target === 'all')) {
              syncMsgs();
          }
      };

      kernelEvents.addEventListener('KERNEL_NEW_MSG', msgHandler);
      return () => {
          kernelEvents.removeEventListener('KERNEL_NEW_MSG', msgHandler);
      };
  }, [chatId, syncMsgs]);

  return messages;
}
