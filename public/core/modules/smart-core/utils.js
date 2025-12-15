// Smart Core utils

import { log } from './logger.js';

export function toNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : NaN;
}

export function guessMime(name, type) {
  if (type && type !== 'application/octet-stream') return type;
  const ext = (name || '').split('.').pop().toLowerCase();
  const map = {
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    opus: 'audio/opus',
    flac: 'audio/flac',
    webm: 'audio/webm',
    mp4: 'video/mp4',
    m4v: 'video/mp4',
    mov: 'video/quicktime'
  };
  return map[ext] || type || 'application/octet-stream';
}

export function fmtRanges(video) {
  try {
    const b = video.buffered;
    const arr = [];
    for (let i = 0; i < b.length; i++) arr.push(`[${b.start(i).toFixed(2)}, ${b.end(i).toFixed(2)}]`);
    return arr.join(', ');
  } catch (e) {
    return '';
  }
}

export function bindMoreVideoLogs(video, fileId) {
  if (!video || video._moreLogsBound) return;
  video._moreLogsBound = true;

  const logBuffered = () => log(`🎞 buffered=${fmtRanges(video)} ct=${(video.currentTime || 0).toFixed(2)} rdy=${video.readyState}`);

  video.addEventListener('progress', logBuffered);
  video.addEventListener('waiting', () => log('⏳ waiting ' + fmtRanges(video)));
  video.addEventListener('stalled', () => log('⚠️ stalled ' + fmtRanges(video)));
  video.addEventListener('seeking', () => log(`⏩ seeking to ${video.currentTime.toFixed(2)}`));
  video.addEventListener('seeked', () => log(`✅ seeked ${video.currentTime.toFixed(2)} buffered=${fmtRanges(video)}`));
  video.addEventListener('error', () => log('❌ <video> error: ' + (video.error && video.error.message)));

  setInterval(() => { if (!video.paused) logBuffered(); }, 4000);
}
