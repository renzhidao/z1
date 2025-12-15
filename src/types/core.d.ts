/**
 * P2P Chat Application - Headless Core API Definitions
 * 
 * 架构说明:
 * 核心逻辑由 Service 类提供，不再直接操作 DOM。
 * UI 层通过调用 Service 方法触发操作，并通过监听 Service 事件来更新视图。
 */

// ==========================================
// 1. 核心数据模型 (Data Models)
// ==========================================

export type MessageType = 'text' | 'image' | 'file' | 'SMART_FILE_UI' | 'sys';

export interface Message {
  id: string;           // 消息唯一ID (UUID)
  t: string;            // 协议类型 (通常是 'MSG')
  n: string;            // 发送者昵称
  senderId: string;     // 发送者 ID
  target: string;       // 接收者 ID ('all' 表示群发)
  txt: string;          // 文本内容 (如果是文件/图片，这里可能是 URL 或空)
  kind: MessageType;    // 消息类型
  ts: number;           // 时间戳
  
  // 文件/图片专用字段
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  meta?: SmartFileMeta; // SmartCore 文件元数据
}

export interface SmartFileMeta {
  fileId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

export interface Contact {
  id: string;
  n: string;      // 昵称
  t: number;      // 最后活跃时间
}

export interface AppStateData {
  myId: string;
  myName: string;
  isHub: boolean;
  activeChat: string | 'all' | null; // 当前聊天窗口 ID
  activeChatName: string;
  mqttStatus: '初始化' | '在线' | '断开' | '失败' | '暂停';
  loading: boolean;
  unread: Record<string, number>;    // 未读消息计数 { peerId: count }
  contacts: Record<string, Contact>; // 联系人列表
  conns: Record<string, any>;        // 当前活跃连接
}

// ==========================================
// 2. 基础类 (Base)
// ==========================================

/**
 * 所有服务的基类，提供事件订阅能力
 */
export class EventEmitter {
  /** 订阅事件 */
  on(event: string, listener: (...args: any[]) => void): this;
  /** 取消订阅 */
  off(event: string, listener: (...args: any[]) => void): this;
}

// ==========================================
// 3. 核心服务类 (Services)
// ==========================================

/**
 * 状态管理器 (响应式数据源)
 * 对应 modules/state.js
 */
export class StateManager extends EventEmitter {
  /** 获取当前状态快照 */
  get<K extends keyof AppStateData>(key: K): AppStateData[K];
  
  /** 
   * 更新状态
   * 触发 'change' 事件: (key, newValue, oldValue) => void
   * 触发 'change:{key}' 事件: (newValue, oldValue) => void
   */
  set<K extends keyof AppStateData>(key: K, value: AppStateData[K]): void;

  /**
   * 针对对象/数组的局部更新辅助方法
   * @example store.update('unread', (u) => u['user1'] = 5)
   */
  update<K extends keyof AppStateData>(key: K, fn: (val: AppStateData[K]) => void): void;
}

/**
 * P2P 网络服务 (处理连接与节点发现)
 * 对应 modules/p2p.js
 */
export class P2PService extends EventEmitter {
  /** 启动 P2P 节点 */
  start(): void;
  
  /** 停止 P2P 节点并断开所有连接 */
  stop(): void;
  
  /** 主动连接指定 Peer ID */
  connectTo(peerId: string): void;
  
  /** 巡逻并连接公共 Hub 节点 (自动维护) */
  patrolHubs(): void;

  // --- 事件定义 ---
  
  /** 当自身 P2P ID 就绪时触发 */
  on(event: 'ready', listener: (myId: string) => void): this;
  
  /** 当与某个节点建立连接成功时触发 */
  on(event: 'connect', listener: (peerId: string, conn: any) => void): this;
  
  /** 当与某个节点断开连接时触发 */
  on(event: 'disconnect', listener: (peerId: string) => void): this;
  
  /** 当连接列表发生变化时触发 (UI 应刷新联系人列表) */
  listener: () => void): this;
  
  /** 错误日志事件 */
  on(event: 'log', listener: (level: string, msg: string) => void): this;
}

/**
 * 协议引擎 (处理消息收发与路由)
 * 对应 modules/protocol.js
 */
export class ProtocolEngine extends EventEmitter {
  /**
   * 发送消息
   * @param text 文本内容
   * @param kind 消息类型 (默认 'text')
   * @param fileInfo 如果是文件/图片，传入文件对象或元数据
   */
  sendMsg(text: string | null, kind?: MessageType, fileInfo?: { fileObj?: File, name?: string, size?: number, type?: string }): Promise<void>;

  /**
   * 处理接收到的原始数据包 (通常由底层自动调用，UI 无需关心)
   */
  processIncoming(pkt: any, fromPeerId?: string): void;

  /** 重试发送队列中失败的消息 */
  retryPending(): Promise<void>;

  // --- 事件定义 ---

  /** 
   * 当收到新消息时触发 (这是 UI 最核心的监听事件)
   * UI 应该决定是将消息追加到聊天框，还是增加未读计数
   */
  on(event: 'message', listener: (msg: Message) => void): this;
}

/**
 * 数据库服务 (IndexedDB 封装)
 * 对应 modules/db.js
 */
export class DatabaseService {
  /** 等待数据库就绪 */
  ready(): Promise<void>;

  /** 保存一条消息 */
  saveMsg(msg: Message): Promise<void>;

  /** 
   * 获取最近的历史消息
   * @param limit 条数限制
   * @param target 聊天对象ID ('all' 或 特定 peerId)
   * @param beforeTs 获取该时间戳之前的消息 (用于下拉加载更多)
   */
  getRecent(limit: number, target: string, beforeTs?: number): Promise<Message[]>;
  
  /** 获取待发送队列 */
  getPending(): Promise<any[]>;
}

/**
 * 智能文件核心 (大文件分片传输与流式播放)
 * 对应 modules/smart-core.js
 */
export class SmartCore {
  /**
   * 发送文件 (UI 调用此方法发送文件)
   * @returns fileId 和构造好的消息对象
   */
  sendFile(file: File, targetId?: string, options?: { kind?: string, txt?: string }): { fileId: string, msg: Message };

  /**
   * 播放/预览文件
   * @returns 用于 src 属性的 URL (可能是 Blob URL 或 ServiceWorker 虚拟流 URL)
   */
  play(fileId: string, fileName?: string): string;

  /**
   * 下载文件到本地
   */
  download(fileId: string, fileName?: string): void;
}

/**
 * 工具类
 * 对应 modules/utils.js
 */
export class Utils {
  static now(): number; // 获取经过服务器校准的时间戳
  static uuid(): string;
  static escape(str: string): string; // HTML 转义
}

// ==========================================
// 4. 全局访问入口 (Global Access)
// ==========================================

// 在重构后的架构中，这些实例被挂载在 window 对象上供全局访问
declare global {
  interface Window {
    /** 状态管理实例 (新) */
    store: StateManager;
    /** 状态数据代理 (旧兼容，直接读写属性) */
    state: AppStateData;
    
    /** P2P 网络服务 */
    p2p: P2PService;
    
    /** 消息协议引擎 */
    protocol: ProtocolEngine;
    
    /** 数据库服务 */
    db: DatabaseService;
    
    /** 智能文件核心 */
    smartCore: SmartCore;
    
    /** 应用控制器 */
    app: {
      init(): Promise<void>;
      loadHistory(limit: number): Promise<void>;
    };
    
    /** 辅助工具 */
    util: {
      log(msg: string): void;
      now(): number;
      escape(s: string): string;
    }
  }
}