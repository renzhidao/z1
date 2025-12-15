
export type MessageType = 'text' | 'image' | 'file' | 'SMART_FILE_UI' | 'sys';

export interface Message {
  id: string;
  t: string;
  n: string;
  senderId: string;
  target: string;
  txt: string;
  kind: MessageType;
  ts: number;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  meta?: any;
}

export interface Contact {
  id: string;
  n: string;
  t: number;
}

export interface AppStateData {
  myId: string;
  myName: string;
  isHub: boolean;
  activeChat: string | 'all' | null;
  activeChatName: string;
  mqttStatus: '初始化' | '在线' | '断开' | '失败' | '暂停';
  loading: boolean;
  unread: Record<string, number>;
  contacts: Record<string, Contact>;
  conns: Record<string, any>;
  lastMsgTime: number;
  msgCount: number;
  seenMsgs: Set<string>;
}

declare global {
  interface Window {
    __CORE_READY__: boolean;
    state: AppStateData;
    p2p: {
      connectTo(id: string): void;
      start(): void;
    };
    protocol: {
      sendMsg(text: string | null, kind?: string, fileInfo?: any): Promise<void>;
    };
    db: {
      getRecent(limit: number, target: string, beforeTs?: number): Promise<Message[]>;
    };
    app: {
      loadHistory(limit: number): Promise<void>;
    };
    util: {
      uuid(): string;
    };
    smartCore: {
        play(fileId: string, name?: string): string;
        download(fileId: string, name?: string): void;
    }
  }
}
