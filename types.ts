export interface User {
  id: string;
  name: string;
  avatar: string;
  wechatId?: string; // e.g. "wxid_12345"
  region?: string;
}

export interface Message {
  id: string;
  text: string;
  senderId: string; // 'me' or user.id
  timestamp: Date;
  isSystem?: boolean;
  type?: 'text' | 'image' | 'voice' | 'redPacket';
}

export interface Chat {
  id: string;
  user: User;
  lastMessage: string;
  timestamp: string; // Display string like "12:46" or "Yesterday"
  unreadCount: number;
  isMuted: boolean;
  isPinned?: boolean; // New property for pinning functionality
  isService?: boolean; // For "Service Accounts" or "Subscriptions" style folders
  isAi?: boolean; // Special flag for the Gemini bot
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