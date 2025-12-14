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
  if (window.app) return; // 避免重复初始化

  console.log('🚀 Waiting for M3 Backend...');
  
  // Fallback: If loader hasn't started after 2s, manually inject it.
  // Using relative path './m3-1/loader.js' which resolves against index.html location
  const fallbackTimer = setTimeout(() => {
      if (!window.m3_boot_status) {
          console.warn('⚠️ Loader not detected from HTML, injecting manually...');
          if (onStatusCallback) onStatusCallback('正在尝试手动注入后端...');
          
          const script = document.createElement('script');
          script.type = 'module';
          // Use relative path
          script.src = './m3-1/loader.js?t=' + Date.now();
          
          script.onload = () => console.log('✅ Manual injection loaded');
          script.onerror = (e) => {
              console.error('❌ Manual injection failed', e);
              // Safe error serialization
              let errMsg = '未知错误';
              if (e instanceof Event && e.type === 'error') {
                  const target = e.target as HTMLScriptElement;
                  errMsg = `脚本加载失败: ${target.src}`;
              } else if (e instanceof Error) {
                  errMsg = e.message;
              }
              if (onStatusCallback) onStatusCallback(`后端注入失败: ${errMsg}. 请检查 m3-1 目录是否存在。`);
          };
          
          document.body.appendChild(script);
      }
  }, 2000);

  // Polling for window.app which is set by m3-1/app.js via loader.js
  return new Promise<void>((resolve) => {
      let lastStatus = '';
      const check = () => {
          // Report status to UI
          const currentStatus = window.m3_boot_status || '等待后端脚本注入...';
          if (onStatusCallback && currentStatus !== lastStatus) {
              lastStatus = currentStatus;
              onStatusCallback(currentStatus);
          }

          if (window.app && window.state) {
              console.log('✅ M3 Backend Ready');
              clearTimeout(fallbackTimer);
              if (onStatusCallback) onStatusCallback('系统就绪');
              resolve();
          } else {
              setTimeout(check, 100);
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
      // 检查是否是视频或音频，这里简化处理，统一视为文本提示或特殊处理
      if (m3Msg.meta?.fileType?.startsWith('audio')) {
          type = 'voice';
          text = `[语音] ${m3Msg.meta.fileName}`;
      } else if (m3Msg.meta?.fileType?.startsWith('image')) {
          type = 'image';
          // 如果是 smartCore 图片，这里通常是一个占位符，真正 URL 需要 smartCore.play
          // 在 ChatDetail 中处理
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
    // 如果是 m3 文件消息，附带原始 meta 以便后续处理
    originalM3Msg: m3Msg
  } as any;
};

/**
 * 获取聊天列表数据适配器
 */
export const getChatsFromBackend = async (): Promise<Chat[]> => {
  if (!window.state || !window.db) return [];

  const myId = window.state.myId;
  const chats: Chat[] = [];

  // 1. 公共频道
  const pubUnread = window.state.unread['all'] || 0;
  const pubLastMsg = await window.db.getRecent(1, 'all');
  
  chats.push({
    id: 'all',
    user: {
      id: 'all',
      name: '公共频道',
      avatar: 'https://picsum.photos/seed/public/200/200', // 默认头像
      region: 'Public'
    },
    lastMessage: pubLastMsg[0] ? pubLastMsg[0].txt : '暂无消息',
    timestamp: pubLastMsg[0] ? formatTime(pubLastMsg[0].ts) : '',
    unreadCount: pubUnread,
    isMuted: false,
    messages: [] // 列表页不需要加载详情
  });

  // 2. 私聊会话 (基于 window.state.conns 和 window.state.contacts)
  // m3-1 的联系人管理比较松散，我们遍历所有已知的 contacts 或有消息记录的 id
  const contactIds = new Set([
      ...Object.keys(window.state.conns),
      ...Object.keys(window.state.contacts),
      ...Object.keys(window.state.unread)
  ]);

  for (const cid of contactIds) {
      if (cid === myId || cid === 'all' || cid.startsWith('p1-hub')) continue;

      const contact = window.state.contacts[cid] || {};
      const conn = window.state.conns[cid];
      const isOnline = conn && conn.open;
      const unread = window.state.unread[cid] || 0;
      
      // 获取最后一条消息
      const lastMsgs = await window.db.getRecent(1, cid);
      const lastMsg = lastMsgs[0];

      // 如果没有名字，使用 ID
      const name = contact.n || cid.slice(0, 6);

      chats.push({
          id: cid,
          user: {
              id: cid,
              name: name,
              avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cid}`, // 生成随机头像
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
    const msgs = await window.db.getRecent(50, targetId); // 获取最近50条
    // m3 返回的是倒序，我们需要正序
    return msgs.reverse().map((m: any) => convertM3Msg(m, window.state.myId));
};

/**
 * 发送消息
 */
export const sendM3Message = async (text: string, targetId: string, file?: File) => {
    if (!window.protocol) return;
    
    if (file) {
        // 发送文件/图片
        const kind = file.type.startsWith('image') ? 'image' : 'file';
        window.protocol.sendMsg(null, kind, {
            fileObj: file,
            name: file.name,
            size: file.size,
            type: file.type
        });
    } else {
        // 发送文本
        // 如果是私聊，m3 需要先设置 activeChat，或者修改 protocol.sendMsg 支持 target 参数
        // m3 的 sendMsg 默认发给 window.state.activeChat
        const prevChat = window.state.activeChat;
        window.state.activeChat = targetId; // 临时切换
        
        await window.protocol.sendMsg(text);
        
        window.state.activeChat = prevChat; // 恢复 (可选)
    }
};

// 工具：时间格式化
const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString();
};
