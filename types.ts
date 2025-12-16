export interface User {
  id: string;
  name: string;
  avatar: string;
  wechatId?: string; // e.g. "wxid_12345"
  region?: string;
}

// 对应 core.d.ts 的 SmartFileMeta
export interface SmartFileMeta {
  fileId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileObj?: File; // 本地预览用
}

export type MessageKind = 'text' | 'image' | 'file' | 'SMART_FILE_UI' | 'sys' | 'video' | 'voice';

export interface Message {
  id: string;
  text: string;           // UI展示用的文本 (可能是处理过的)
  txt?: string;           // 核心协议原始文本
  senderId: string;       // 'me' or user.id
  target?: string;
  timestamp: Date;        // 对应 core 的 ts
  ts?: number;            // 核心原始时间戳
  
  isSystem?: boolean;
  kind?: MessageKind;     // 核心类型字段
  type?: 'text' | 'image' | 'voice' | 'redPacket'; // 旧UI字段(兼容)
  
  // 文件/多媒体字段
  meta?: SmartFileMeta;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
}

export interface Chat {
  id: string;
  user: User;
  lastMessage: string;
  timestamp: string; // Display string like "12:46" or "Yesterday"
  unreadCount: number;
  isMuted: boolean;
  isPinned?: boolean;
  isService?: boolean;
  isAi?: boolean;
  messages: Message[];
}

export interface Comment {
  id: string;
  user: User;
  text: string;
  replyTo?: User;
}

export interface Like {
  user: User;
}

export interface Moment {
  id: string;
  user: User;
  content: string;
  images?: string[];
  time: string;
  likes: Like[];
  comments: Comment[];
}

export enum Tab {
  CHATS = 'chats',
  CONTACTS = 'contacts',
  DISCOVER = 'discover',
  ME = 'me'
}

export interface ToastState {
  show: boolean;
  message: string;
  icon?: 'success' | 'loading' | 'none';
}
