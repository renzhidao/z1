// Smart Core config

export const CHUNK_SIZE = 128 * 1024;
export const PARALLEL = 12;
export const PREFETCH_AHEAD = 3 * 1024 * 1024;
export const MAX_BUFFERED = 256 * 1024;
export const USE_SEQUENCE_MODE = false;

export const META_RETRY_MS = 1500;
export const META_MAX_RETRIES = 6;
export const META_MAX_TTL_MS = 20000; // 公共频道发现新 peer 的窗口
