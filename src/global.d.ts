
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
  meta?: {
    fileId: string;
    fileName: string;
    fileSize: number;
    fileType: string;
  };
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
}

export interface EventEmitter {
  on(event: string, listener: (...args: any[]) => void): this;
  off(event: string, listener: (...args: any[]) => void): this;
}

export interface StateManager extends EventEmitter {
  get<K extends keyof AppStateData>(key: K): AppStateData[K];
  set<K extends keyof AppStateData>(key: K, value: AppStateData[K]): void;
}

export interface P2PService extends EventEmitter {
  start(): void;
  stop(): void;
  connectTo(peerId: string): void;
  patrolHubs(): void;
}

export interface ProtocolEngine extends EventEmitter {
  sendMsg(text: string | null, kind?: MessageType, fileInfo?: { fileObj?: File, name?: string, size?: number, type?: string }): Promise<void>;
  processIncoming(pkt: any, fromPeerId?: string): void;
  retryPending(): Promise<void>;
}

export interface DatabaseService {
  ready(): Promise<void>;
  saveMsg(msg: Message): Promise<void>;
  getRecent(limit: number, target: string, beforeTs?: number): Promise<Message[]>;
  getPending(): Promise<any[]>;
}

export interface SmartCore {
  sendFile(file: File, targetId?: string, options?: { kind?: string, txt?: string }): { fileId: string, msg: Message };
  play(fileId: string, fileName?: string): string;
  download(fileId: string, fileName?: string): void;
}

declare global {
  interface Window {
    store: StateManager;
    state: AppStateData;
    p2p: P2PService;
    protocol: ProtocolEngine;
    db: DatabaseService;
    smartCore: SmartCore;
    __CORE_READY__?: boolean;
    app: {
      init(): Promise<void>;
      loadHistory(limit: number): Promise<void>;
    };
    util: {
      log(msg: string): void;
      now(): number;
      escape(s: string): string;
    }
  }
}
