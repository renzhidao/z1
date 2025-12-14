import { Chat, Message, User } from '../types';

// === 补丁: 发送消息缓冲池 (解决DB落盘延迟导致消息“不上屏”或被覆盖) ===
const tempMsgCache: (Message & { _targetId?: string })[] = [];

// 清理超过 30 秒的缓存消息
setInterval(() => {
    const now = Date.now();
    for(let i = tempMsgCache.length - 1; i >= 0; i--) {
        if (now - tempMsgCache[i].timestamp.getTime() > 30000) {
            tempMsgCache.splice(i, 1);
        }
    }
}, 5000);

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
    virtualFiles: any;
  }
}

export const initBackend = async (onStatusCallback?: (status: string) => void) => {
  if (window.state && window.state.myId && window.p2p) {
      if (onStatusCallback) onStatusCallback('系统就绪 (已预加载)');
      return; 
  }
  if (window.app) return; 

  console.log('🚀 Waiting for M3 Backend...');
  
  const fallbackTimer = setTimeout(() => {
      const isAlive = window.state || window.m3_boot_status;
      if (!isAlive) {
          if (onStatusCallback) onStatusCallback('正在尝试手动注入后端...');
          const script = document.createElement('script');
          script.type = 'module';
          // Fix: Safe access for env
          const base = (import.meta as any)?.env?.BASE_URL || './';
           script.src = `${base}m3-1/loader.js?t=${Date.now()}`;
          script.onload = () => console.log('✅ Manual injection loaded');
          document.body.appendChild(script);
      }
  }, 2000);

  return new Promise<void>((resolve) => {
      let lastStatus = '';
      const check = () => {
          const currentStatus = window.m3_boot_status || '正在连接 P2P 网络...';
          if (onStatusCallback && currentStatus !== lastStatus) {
              lastStatus = currentStatus;
              onStatusCallback(currentStatus);
          }
          const p2pReady = window.state && window.state.myId && window.p2p;
          const mqttReady = window.state && window.state.mqttStatus === '在线';
          
          if (p2pReady || mqttReady || window.app) {
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

const convertM3Msg = (m3Msg: any, currentUserId: string): Message => {
  let type: 'text' | 'image' | 'voice' | 'video' = 'text';
  // Ensure text is never undefined, handling protocol messages that might lack 'txt'
  let text = m3Msg.txt || '';

  if (m3Msg.kind === 'image') {
      type = 'image';
  } else if (m3Msg.kind === 'SMART_FILE_UI') {
      const fileType = (m3Msg.meta?.fileType || '').toLowerCase();
      const fileName = (m3Msg.meta?.fileName || '').toLowerCase();

      if (fileType.startsWith('audio')) {
          type = 'voice';
          text = `[语音] ${m3Msg.meta.fileName}`;
      } else if (fileType.startsWith('image')) {
          type = 'image';
          text = `[图片] ${m3Msg.meta.fileName}`; 
      } else if (fileType.startsWith('video') || fileName.endsWith('.mp4') || fileName.endsWith('.mov')) {
          type = 'video';
          text = `[视频] ${m3Msg.meta.fileName}`;
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

export const setActiveChat = (chatId: string | null) => {
    if (window.state) {
        window.state.activeChat = chatId;
        // Also ensure unread count is cleared when entering
        if (chatId && window.state.unread) {
            window.state.unread[chatId] = 0;
        }
    }
};

export const getChatsFromBackend = async (): Promise<Chat[]> => {
  if (!window.state) return [];
  // DB might not be ready, but we still want to render what we can from state/cache
  
  const myId = window.state.myId;
  const chats: Chat[] = [];

  // 1. Public Channel
  const pubUnread = window.state.unread ? (window.state.unread['all'] || 0) : 0;
  let pubLastMsg = null;
  
  if (window.db) {
      try {
          const dbMsgs = await window.db.getRecent(1, 'all');
          pubLastMsg = dbMsgs[0];
      } catch(e) {}
  }

  const cachedPubMsg = tempMsgCache.filter(m => (m as any)._targetId === 'all').sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
  if (cachedPubMsg) {
      if (!pubLastMsg || cachedPubMsg.timestamp.getTime() > pubLastMsg.ts) {
          pubLastMsg = {
              txt: cachedPubMsg.text,
              ts: cachedPubMsg.timestamp.getTime(),
              kind: cachedPubMsg.type === 'image' ? 'image' : (cachedPubMsg.type === 'video' ? 'SMART_FILE_UI' : 'text')
          };
      }
  }
  
  chats.push({
    id: 'all',
    user: {
      id: 'all',
      name: '公共频道',
      avatar: 'https://picsum.photos/seed/public/200/200', 
      region: 'Public'
    },
    lastMessage: pubLastMsg ? (pubLastMsg.kind === 'image' ? '[图片]' : (pubLastMsg.txt && pubLastMsg.txt.startsWith('[视频]') ? '[视频]' : (pubLastMsg.txt || ''))) : '暂无消息',
    timestamp: pubLastMsg ? formatTime(pubLastMsg.ts) : '',
    unreadCount: pubUnread,
    isMuted: false,
    messages: [] 
  });

  // 2. Private Chats
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
      if (window.db) {
          try {
              const lastMsgs = await window.db.getRecent(1, cid);
              lastMsg = lastMsgs[0];
          } catch(e) {}
      }

      const cachedPrivMsg = tempMsgCache.filter(m => (m as any)._targetId === cid).sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
      if (cachedPrivMsg) {
          if (!lastMsg || cachedPrivMsg.timestamp.getTime() > lastMsg.ts) {
              lastMsg = {
                  txt: cachedPrivMsg.text,
                  ts: cachedPrivMsg.timestamp.getTime(),
                  kind: cachedPrivMsg.type === 'image' ? 'image' : 'text'
              };
          }
      }

      // Hide chats that have no history and are not online (unless they are contacts)
      if (!contact.n && !isOnline && !lastMsg && unread === 0) continue;

      const name = contact.n || cid.slice(0, 6);

      chats.push({
          id: cid,
          user: {
              id: cid,
              name: name,
              avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cid}`,
              region: isOnline ? '在线' : '离线'
          },
          lastMessage: lastMsg ? (lastMsg.kind === 'image' ? '[图片]' : (lastMsg.txt || '')) : (isOnline ? '[已连接]' : ''),
          timestamp: lastMsg ? formatTime(lastMsg.ts) : '',
          unreadCount: unread,
          isMuted: false,
          messages: []
      });
  }

  return chats;
};

export const getMessagesForChat = async (targetId: string): Promise<Message[]> => {
    let dbList: Message[] = [];
    
    // 1. Try fetch from DB, but don't fail if DB is missing
    if (window.db) {
        try {
            const msgs = await window.db.getRecent(50, targetId);
            dbList = msgs.map((m: any) => convertM3Msg(m, window.state.myId));
        } catch(e) {
            console.error("DB Read Failed:", e);
        }
    }
        
    const dbMsgIds = new Set(dbList.map(m => m.id));
    
    // 2. Intelligent Merging & Deduplication with Cache
    const pending = tempMsgCache.filter((m: any) => {
        if (m._targetId !== targetId) return false;
        if (dbMsgIds.has(m.id)) return false;
        
        // Fuzzy Deduplication:
        const isDuplicate = dbList.some(dbMsg => 
            dbMsg.senderId === m.senderId &&
            dbMsg.type === m.type &&
            (
                (m.type === 'text' && dbMsg.text === m.text) || 
                (m.type !== 'text') 
            ) &&
            Math.abs(dbMsg.timestamp.getTime() - m.timestamp.getTime()) < 2000
        );
        
        if (isDuplicate) return false;

        return true;
    });
    
    const list = [...dbList, ...pending];
    list.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return list;
};

export const sendM3Message = async (text: string, targetId: string, file?: File) => {
    if (!window.protocol) return;

    const tempId = 'temp_' + Date.now() + Math.random().toString(36).substr(2, 5); 
    
    let type: 'text'|'image'|'file'|'video' = 'text';
    let displayText = text || '';

    if (file) {
        if (file.type.startsWith('image')) {
            type = 'image';
            displayText = '[图片]';
        } else if (file.type.startsWith('video') || file.name.endsWith('.mp4') || file.name.endsWith('.mov')) {
            type = 'video';
            displayText = `[视频] ${file.name}`;
        } else {
            type = 'file';
            displayText = `[文件] ${file.name}`;
        }
    }

    const tempMsg: any = {
        id: tempId,
        text: displayText,
        senderId: window.state.myId,
        timestamp: new Date(),
        type: type,
        _targetId: targetId,
        originalM3Msg: file ? { meta: { fileName: file.name, fileSize: file.size, fileType: file.type } } : undefined 
    };
    
    if (file && (type === 'image' || type === 'video')) {
        if (!window.virtualFiles) window.virtualFiles = new Map();
        window.virtualFiles.set(tempId, file); 
        tempMsg.originalM3Msg = { 
            kind: 'SMART_FILE_UI',
            meta: { fileId: tempId, fileName: file.name, fileSize: file.size, fileType: file.type } 
        };
    }

    tempMsgCache.push(tempMsg);
    
    // Trigger optimistic UI
    window.dispatchEvent(new Event('m3-msg-incoming'));
    
    // setActiveChat handles the backend logic for 'activeChat', but we call it here to be safe during send
    // though ChatDetail also maintains it.
    const prevChat = window.state.activeChat;
    window.state.activeChat = targetId; 
    
    let pkt = null;
    try {
        if (file) {
            const kind = file.type.startsWith('image') ? 'image' : 'file';
            pkt = await window.protocol.sendMsg(null, kind, {
                fileObj: file,
                name: file.name,
                size: file.size,
                type: file.type
            });
        } else {
            pkt = await window.protocol.sendMsg(text);
        }
    } catch (e) {
        console.error("Send failed", e);
        const idx = tempMsgCache.findIndex(m => m.id === tempId);
        if (idx !== -1) tempMsgCache.splice(idx, 1);
        window.dispatchEvent(new Event('m3-msg-incoming'));
        window.state.activeChat = prevChat; 
        return;
    }
    
    window.state.activeChat = prevChat; 

    // Update the cache with the REAL packet ID to prevent duplication
    if (pkt) {
        const realMsg = convertM3Msg(pkt, window.state.myId);
        const idx = tempMsgCache.findIndex(m => m.id === tempId);
        if (idx !== -1) {
            // Keep it in cache but update ID, so next getMessagesForChat dedupes it against DB
            tempMsgCache[idx] = { ...realMsg, _targetId: targetId };
            
            // If it was a file, we need to map the new ID to the blob so playing works before redownload
            if (file) {
                // Map real ID to the blob too
                if (!window.virtualFiles) window.virtualFiles = new Map();
                // Extract the fileId from the pkt metadata if it exists
                const newFileId = pkt.meta?.fileId;
                if (newFileId) window.virtualFiles.set(newFileId, file);
            }
        } else {
            (realMsg as any)._targetId = targetId;
            tempMsgCache.push(realMsg);
        }
        window.dispatchEvent(new Event('m3-msg-incoming'));
    }
};

// === New Functionality Exports ===

export const markChatRead = (targetId: string) => {
    if (window.state && window.state.unread) {
        window.state.unread[targetId] = 0;
        localStorage.setItem('p1_unread', JSON.stringify(window.state.unread));
        // Force refresh chat list
        window.dispatchEvent(new Event('m3-list-update'));
    }
};

export const deleteChat = (targetId: string) => {
    // We don't actually delete from DB in this bridge (too complex), 
    // but we can remove from contacts/connections lists to hide it
    if (window.state) {
        if (window.state.contacts[targetId]) {
            delete window.state.contacts[targetId];
            localStorage.setItem('p1_contacts', JSON.stringify(window.state.contacts));
        }
        if (window.state.unread[targetId]) {
            delete window.state.unread[targetId];
            localStorage.setItem('p1_unread', JSON.stringify(window.state.unread));
        }
        // Dispatch update
        window.dispatchEvent(new Event('m3-list-update'));
    }
};

export const updateMyProfile = (data: { name?: string, signature?: string, gender?: string, region?: string }) => {
    if (!window.state) return;
    
    if (data.name) {
        window.state.myName = data.name;
        localStorage.setItem('nickname', data.name);
    }
    
    // Store extra fields in localStorage as a JSON object
    const profile = JSON.parse(localStorage.getItem('p1_profile') || '{}');
    if (data.signature) profile.signature = data.signature;
    if (data.gender) profile.gender = data.gender;
    if (data.region) profile.region = data.region;
    
    localStorage.setItem('p1_profile', JSON.stringify(profile));
    
    // Notify app
    window.dispatchEvent(new Event('m3-self-update'));
};

export const getMyProfile = () => {
    if (!window.state) return {};
    const profile = JSON.parse(localStorage.getItem('p1_profile') || '{}');
    return {
        id: window.state.myId,
        name: window.state.myName,
        ...profile
    };
};

export const addContact = (targetId: string) => {
    if (!window.p2p) return;
    window.p2p.connectTo(targetId);
};

export const clearLocalData = () => {
    localStorage.clear();
    location.reload();
};

const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString();
};