
import { Message, User, Chat } from '../../types';

// 1. 确定性头像生成 (Deterministic Avatar)
// 根据 ID 的哈希值，从预设的种子库中选一张，保证同一个人永远是同一个头像
const AVATAR_SEEDS = [
  'Felix', 'Aneka', 'Mark', 'Jerry', 'Milo', 'Bandit', 'Socks', 'Simba', 
  'Willow', 'Zoey', 'Luna', 'Bella', 'Charlie', 'Lucy', 'Cooper', 'Max',
  'Daisy', 'Sadie', 'Molly', 'Buddy', 'Rocky', 'Bear', 'Duke', 'Tucker'
];

function getHash(str: string) {
  let hash = 0;
  if (!str) return 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getAvatarUrl(id: string) {
  if (!id) return `https://api.dicebear.com/7.x/notionists/svg?seed=unknown`;
  if (id === 'all') return `https://api.dicebear.com/7.x/initials/svg?seed=Public&backgroundColor=ffdfbf`; // 公共频道
  if (id.startsWith('p1-hub')) return `https://api.dicebear.com/7.x/bottts/svg?seed=${id}&backgroundColor=c0aede`; // 房主节点
  
  const seedIndex = getHash(id) % AVATAR_SEEDS.length;
  const seed = AVATAR_SEEDS[seedIndex] + id.slice(-3); // Mix name + ID suffix
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
}

// 2. 数据转换 (Transformer)

export function mapUser(id: string, name: string): User {
  return {
    id,
    name: name || id.slice(0, 6),
    avatar: getAvatarUrl(id),
    wechatId: id,
    region: id.startsWith('p1-hub') ? '超级节点' : 'P2P 用户'
  };
}

export function mapMessage(m: any, myId: string): Message {
  const isMe = m.senderId === myId;
  let type: 'text' | 'image' | 'voice' | 'file' | 'video' = 'text';
  let text = m.txt || '';

  // 识别消息类型
  if (m.kind === 'image') type = 'image';
  else if (m.kind === 'file') type = 'file';
  else if (m.t === 'SMART_META' || m.kind === 'SMART_FILE_UI') {
     // 智能流媒体消息
     const meta = m.meta || (m.meta && m.meta.meta);
     if (meta) {
        if (meta.fileType && meta.fileType.startsWith('video')) type = 'video';
        else type = 'file';
        
        // 将 meta 信息塞入 text 字段供组件解析 (或者扩展 Message 接口)
        // 这里为了兼容现有 Message 接口，我们构造一个特殊的 JSON 字符串
        text = JSON.stringify({
            isSmart: true,
            fileId: meta.fileId,
            fileName: meta.fileName,
            fileSize: meta.fileSize,
            fileType: meta.fileType,
            displayText: m.txt // 原始文本如 "[文件] xxx"
        });
     }
  }

  return {
    id: m.id,
    text: text,
    senderId: m.senderId,
    timestamp: new Date(m.ts),
    type: type as any, // Cast to match UI types
    isSystem: m.senderId === 'system'
  };
}

export function mapChat(connId: string, conn: any, unreadCount: number): Chat {
    const user = mapUser(connId, conn.label || connId);
    return {
        id: connId,
        user,
        lastMessage: '[连接中...]', // 这里只是初始状态，实际消息会从 hooks 获取
        timestamp: '',
        unreadCount,
        isMuted: false,
        messages: []
    };
}
