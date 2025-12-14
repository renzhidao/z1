import { Chat, Message, User } from '../types';

// 定义 window 上的 m3 全局对象类型
declare global {
  interface Window {
    state: any;
    util: any;
    db: any;
    protocol: any;
    smartCore: any;
    p2p: any;
    mqtt: any;
    app: any;
    m3BaseUrl: string; 
    m3_boot_status: string;
  }
}

/**
 * 初始化 m3-1 后端
 * @param onStatusCallback Optional callback to receive boot status updates
 */
export const initBackend = async (onStatusCallback?: (status: string) => void) => {
  // 1. 立即检查：如果 index.html 里的 loader 已经跑完了，直接通过
  if (window.state && window.state.myId && window.p2p) {
      console.log('🚀 Backend already running (Pre-loaded)');
      if (onStatusCallback) onStatusCallback('系统就绪 (已预加载)');
      return; 
  }

  if (window.app) return; 

  console.log('🚀 Waiting for M3 Backend...');
  
  // Fallback: 只有在完全没动静时才尝试手动注入
  const fallbackTimer = setTimeout(() => {
      // 只要有 state 或 boot_status，说明已经开始加载了，不要重复注入导致报错
      const isAlive = window.state || window.m3_boot_status;
      
      if (!isAlive) {
          console.warn('⚠️ Loader not detected, injecting manually...');
          if (onStatusCallback) onStatusCallback('正在尝试手动注入后端...');
          
          const script = document.createElement('script');
          script.type = 'module';
          const base = import.meta.env.BASE_URL || './';
           script.src = `${base}m3-1/loader.js?t=${Date.now()}`; // 以 BASE_URL 为锚点，兼容 GitHub Pages 子路径
          
          script.onload = () => console.log('✅ Manual injection loaded');
          script.onerror = (e) => {
              // 失败通常是因为路径不对，但这不影响如果 HTML 里的 script 已经成功的情况
              console.warn('Manual injection skipped/failed', e);
          };
          document.body.appendChild(script);
      }
  }, 2000);

  // 轮询检测后端是否就绪
  return new Promise<void>((resolve) => {
      let lastStatus = '';
      const check = () => {
          const currentStatus = window.m3_boot_status || '正在连接 P2P 网络...';
          if (onStatusCallback && currentStatus !== lastStatus) {
              lastStatus = currentStatus;
              onStatusCallback(currentStatus);
          }

          // === 关键修改：极速检测 ===
          // 只要 P2P 模块存在且生成了 ID，或者 MQTT 连上了，就视为可用
          // 不再等待 window.app 完全初始化，因为那可能是异步的
          const p2pReady = window.state && window.state.myId && window.p2p;
          const mqttReady = window.state && window.state.mqttStatus === '在线';
          
          if (p2pReady || mqttReady || window.app) {
              console.log('✅ M3 Backend Detected');
              clearTimeout(fallbackTimer);
              if (onStatusCallback) onStatusCallback('系统就绪');
              resolve();
          } else {
              setTimeout(check, 200);
          }
      };
      check();
  });
};

/**
 * 将 m3 的消息对象转换为 React 组件需要的 Message 类型
 */
const convertM3Msg = (m3Msg: any, currentUserId: string): Message => {
  let type: 'text' | 'image' | 'voice' = 'text';
  let text = m3Msg.txt;

  if (m3Msg.kind === 'image') {
      type = 'image';
  } else if (m3Msg.kind === 'SMART_FILE_UI') {
      if (m3Msg.meta?.fileType?.startsWith('audio')) {
          type = 'voice';
          text = `[语音] ${m3Msg.meta.fileName}`;
      } else if (m3Msg.meta?.fileType?.startsWith('image')) {
          type = 'image';
          text = `[图片] ${m3Msg.meta.fileName}`; 
      } else {
          text = `[文件] ${m3Msg.meta?.fileName || '未知文件'}`;
      }
  }

  return {
    id: m3Msg.id,
    text: text,
    senderId: m3Msg.senderId,
    timestamp: new Date(m3Msg.ts),
    type: type,
    originalM3Msg: m3Msg
  } as any;
};

/**
 * 获取聊天列表数据适配器
 */
export const getChatsFromBackend = async (): Promise<Chat[]> => {
  // 防御性编程：如果后端还没好，返回空，不报错
  if (!window.state) return [];
  if (!window.db) return []; // DB 可能比 State 晚一点点初始化

  const myId = window.state.myId;
  const chats: Chat[] = [];

  // 1. 公共频道
  const pubUnread = window.state.unread ? (window.state.unread['all'] || 0) : 0;
  let pubLastMsg = [];
  try {
      pubLastMsg = await window.db.getRecent(1, 'all');
  } catch(e) { /* ignore db error during boot */ }
  
  chats.push({
    id: 'all',
    user: {
      id: 'all',
      name: '公共频道',
      avatar: 'https://picsum.photos/seed/public/200/200', 
      region: 'Public'
    },
    lastMessage: pubLastMsg[0] ? pubLastMsg[0].txt : '暂无消息',
    timestamp: pubLastMsg[0] ? formatTime(pubLastMsg[0].ts) : '',
    unreadCount: pubUnread,
    isMuted: false,
    messages: [] 
  });

  // 2. 私聊会话
  const contactIds = new Set([
      ...Object.keys(window.state.conns || {}),
      ...Object.keys(window.state.contacts || {}),
      ...Object.keys(window.state.unread || {})
  ]);

  for (const cid of contactIds) {
      if (cid === myId || cid === 'all' || cid.startsWith('p1-hub')) continue;

      const contact = window.state.contacts[cid] || {};
      const conn = window.state.conns[cid];
      const isOnline = conn && conn.open;
      const unread = window.state.unread[cid] || 0;
      
      let lastMsg = null;
      try {
          const lastMsgs = await window.db.getRecent(1, cid);
          lastMsg = lastMsgs[0];
      } catch(e) {}

      const name = contact.n || cid.slice(0, 6);

      chats.push({
          id: cid,
          user: {
              id: cid,
              name: name,
              avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cid}`,
              region: isOnline ? '在线' : '离线'
          },
          lastMessage: lastMsg ? (lastMsg.kind === 'image' ? '[图片]' : lastMsg.txt) : (isOnline ? '[已连接]' : ''),
          timestamp: lastMsg ? formatTime(lastMsg.ts) : '',
          unreadCount: unread,
          isMuted: false,
          messages: []
      });
  }

  return chats;
};

/**
 * 获取单个会话的详细消息
 */
export const getMessagesForChat = async (targetId: string): Promise<Message[]> => {
    if (!window.db) return [];
    try {
        const msgs = await window.db.getRecent(50, targetId);
        return msgs.reverse().map((m: any) => convertM3Msg(m, window.state.myId));
    } catch(e) { return []; }
};

/**
 * 发送消息
 */
export const sendM3Message = async (text: string, targetId: string, file?: File) => {
    if (!window.protocol) return;
    
    if (file) {
        const kind = file.type.startsWith('image') ? 'image' : 'file';
        window.protocol.sendMsg(null, kind, {
            fileObj: file,
            name: file.name,
            size: file.size,
            type: file.type
        });
    } else {
        const prevChat = window.state.activeChat;
        window.state.activeChat = targetId; 
        
        await window.protocol.sendMsg(text);
        
        window.state.activeChat = prevChat; 
    }
};

const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString();
};