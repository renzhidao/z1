// Smart Core logger/stat

export const STAT = { send: 0, req: 0, recv: 0, next: 0 };

export function log(msg) {
  console.log(`[Core] ${msg}`);
  try { if (window.util && window.util.log) window.util.log(msg); } catch (_) {}
}

export function statBump(k) {
  STAT[k] = (STAT[k] || 0) + 1;
  const now = Date.now();
  if (now > STAT.next) {
    log(`📊 速率: req=${STAT.req} send=${STAT.send} recv=${STAT.recv} (≈0.7s)`);
    STAT.send = STAT.req = STAT.recv = 0;
    STAT.next = now + 700;
  }
}

export function fmtMB(n) {
  return (n / 1024 / 1024).toFixed(1) + 'MB';
}
