// p1-call-webrtc.js
import { MSG_TYPE } from './constants.js';

export function init() {
  function uuid() {
    try {
      return (window.util && window.util.uuid) ? window.util.uuid() : ('c_' + Date.now() + Math.random().toString(36).slice(2, 8));
    } catch (_) {
      return 'c_' + Date.now() + Math.random().toString(36).slice(2, 8);
    }
  }

  function iceServers() {
    try {
      const cfg = (window.config && window.config.call) ? window.config.call : null;
      if (cfg && cfg.iceServers) return cfg.iceServers;
    } catch (_) {}
    // 多 STUN 兜底（不保证穿透，但比单个稳）
    return [
      { urls: ['stun:stun.l.google.com:19302'] },
      { urls: ['stun:stun1.l.google.com:19302'] },
      { urls: ['stun:global.stun.twilio.com:3478'] }
    ];
  }

  const st = {
    active: false,
    callId: null,
    peerId: null,
    mode: 'voice',
    isInitiator: false,
    pc: null,
    localStream: null,
    remoteStream: null,
    muted: false,
    videoEnabled: true,

    // camera
    facingMode: 'user', // 'user' | 'environment'

    // perfect-negotiation-ish
    _makingOffer: false,
    _ignoreOffer: false,

    // multi-attach: allow native UI + React overlay simultaneously
    _attachments: new Set(),

    // a hint to allow autoplay attempts after a user gesture
    _unlocked: false,
    _iceBuf: new Map(), // callId -> {ts:number, list: RTCIceCandidateInit[]}
    _discTimer: null
  };

  function _p1IceCleanup() {
    try {
      const now = Date.now();
      const m = st._iceBuf;
      if (!m || !m.forEach) return;
      const drop = [];
      m.forEach((v, k) => {
        const ts = (v && v.ts) || 0;
        if (now - ts > 60000) drop.push(k);
      });
      drop.forEach(k => { try { m.delete(k); } catch (_) {} });
    } catch (_) {}
  }

  function _p1IcePut(callId, candidate) {
    try {
      if (!callId || !candidate) return;
      _p1IceCleanup();
      const now = Date.now();
      const m = st._iceBuf;
      let ent = m.get(callId);
      if (!ent) ent = { ts: now, list: [] };
      ent.ts = now;
      ent.list.push(candidate);
      if (ent.list.length > 300) ent.list = ent.list.slice(ent.list.length - 300);
      m.set(callId, ent);
    } catch (_) {}
  }

  async function _p1IceDrain(callId) {
    try {
      if (!callId) return;
      _p1IceCleanup();
      if (!st.pc) return;
      if (!st.pc.remoteDescription) return; // remote SDP 未就绪，先别加
      const m = st._iceBuf;
      const ent = m.get(callId);
      if (!ent || !ent.list || !ent.list.length) return;

      const list = ent.list.slice(0);
      ent.list = [];
      m.set(callId, ent);

      for (const cand of list) {
        try {
          await st.pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (e) {
          // 失败就回填，等下一次 drain（通常是 remoteDescription 还没完全稳定）
          _p1IcePut(callId, cand);
          break;
        }
      }
    } catch (_) {}
  }

  async function _p1AddIceSafe(callId, candidate) {
    try {
      if (!callId || !candidate) return;
      if (!st.pc || !st.pc.remoteDescription) { _p1IcePut(callId, candidate); return; }
      try {
        await st.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        _p1IcePut(callId, candidate);
      }
    } catch (_) {}
  }

  function _p1ClearDiscTimer() {
    try {
      if (st._discTimer) { clearTimeout(st._discTimer); st._discTimer = null; }
    } catch (_) {}
  }

  function _p1ArmDiscTimer(reason) {
    try {
      _p1ClearDiscTimer();
      st._discTimer = setTimeout(() => {
        try {
          // 仍在通话且未恢复 -> 结束
          if (st.active) reset(reason || 'net_lost');
        } catch (_) {}
      }, 9000);
    } catch (_) {}
  }

  function registerAttachment({ localVideo, remoteVideo, remoteAudio }) {
    st._attachments.add({
      localVideo: localVideo || null,
      remoteVideo: remoteVideo || null,
      remoteAudio: remoteAudio || null
    });
    pruneAttachments();
    tryAttach();
  }

  function pruneAttachments() {
    try {
      const dead = [];
      st._attachments.forEach((a) => {
        if (!a || (!a.localVideo && !a.remoteVideo && !a.remoteAudio)) dead.push(a);
      });
      dead.forEach(d => st._attachments.delete(d));
    } catch (_) {}
  }

  function tryPlay(el) {
    try {
      if (!el || !el.play) return;
      const p = el.play();
      if (p && p.catch) p.catch(() => {});
    } catch (_) {}
  }

  function tryAttach() {
    pruneAttachments();
    st._attachments.forEach((a) => {
      try {
        if (a.localVideo && st.localStream) {
          a.localVideo.srcObject = st.localStream;
          a.localVideo.muted = true;
          tryPlay(a.localVideo);
        }
      } catch (_) {}
      try {
        if (a.remoteVideo && st.remoteStream) {
          a.remoteVideo.srcObject = st.remoteStream;
          tryPlay(a.remoteVideo);
        }
      } catch (_) {}
      try {
        if (a.remoteAudio && st.remoteStream) {
          a.remoteAudio.srcObject = st.remoteStream;
          a.remoteAudio.autoplay = true;
          tryPlay(a.remoteAudio);
        }
      } catch (_) {}
    });
  }

  async function waitConn(peerId, ms = 6000) {
    const start = Date.now();
    while (Date.now() - start < ms) {
      const c = window.state && window.state.conns && window.state.conns[peerId];
      if (c && c.open) return c;
      try { window.p2p && window.p2p.connectTo && window.p2p.connectTo(peerId); } catch (_) {}
      await new Promise(r => setTimeout(r, 80));
    }
    return null;
  }

  async function send(peerId, pkt) {
    const c = await waitConn(peerId, 6000);
    if (!c || !c.open) throw new Error('no-conn');
    c.send(pkt);
  }

  function callMsg(peerId, call) {
    return {
      t: MSG_TYPE.MSG,
      id: uuid(),
      n: window.state.myName,
      senderId: window.state.myId,
      target: peerId,
      txt: '',
      kind: 'p1_call',
      ts: (window.util && window.util.now) ? window.util.now() : Date.now(),
      ttl: 1,
      call
    };
  }

  function currentMode() {
    try {
      const vt = st.localStream && st.localStream.getVideoTracks ? st.localStream.getVideoTracks() : [];
      const hasEnabledVideo = !!(vt && vt[0] && vt[0].enabled);
      return hasEnabledVideo ? 'video' : 'voice';
    } catch (_) {
      return st.mode || 'voice';
    }
  }

  async function getLocalStream(mode) {
    const wantVideo = (mode === 'video') && st.videoEnabled;
    const video = wantVideo ? { facingMode: st.facingMode } : false;
    return await navigator.mediaDevices.getUserMedia({ audio: true, video });
  }

  async function getNewVideoTrack() {
    const s = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: st.facingMode } });
    const t = s.getVideoTracks && s.getVideoTracks()[0];
    if (!t) throw new Error('no-video-track');
    // 只拿 track，stream 关掉其它 track（s 里只有 video）
    return { stream: s, track: t };
  }

  function stopStream(stream) {
    try { stream && stream.getTracks && stream.getTracks().forEach(t => { try { t.stop(); } catch (_) {} }); } catch (_) {}
  }

  function closePc() {
    try {
      if (st.pc) {
        st.pc.onicecandidate = null;
        st.pc.ontrack = null;
        st.pc.onconnectionstatechange = null;
        st.pc.oniceconnectionstatechange = null;
        st.pc.close();
      }
    } catch (_) {}
    st.pc = null;
  }

  function reset(reason) {
    st.active = false;
    st.isInitiator = false;
    st.callId = null;
    st.peerId = null;
    st.mode = 'voice';
    st._makingOffer = false;
    st._ignoreOffer = false;
    st._unlocked = false;

    closePc();
    stopStream(st.localStream);
    st.localStream = null;
    st.remoteStream = null;

    tryAttach(); // 清掉 srcObject
    st._attachments.forEach((a) => {
      try { if (a.localVideo) a.localVideo.srcObject = null; } catch (_) {}
      try { if (a.remoteVideo) a.remoteVideo.srcObject = null; } catch (_) {}
      try { if (a.remoteAudio) a.remoteAudio.srcObject = null; } catch (_) {}
    });

    window.dispatchEvent(new CustomEvent('p1-call-state', { detail: { state: 'ended', reason: reason || '' } }));
  }

  function setupPcCommon(peerId) {
    st.pc = new RTCPeerConnection({ iceServers: iceServers() });

    // track -> remoteStream
    st.pc.ontrack = (ev) => {
      try {
        if (ev.streams && ev.streams[0]) {
          st.remoteStream = ev.streams[0];
        } else if (ev.track) {
          if (!st.remoteStream) st.remoteStream = new MediaStream();
          st.remoteStream.addTrack(ev.track);
        }
        tryAttach();
      } catch (_) {}
    };

    st.pc.onicecandidate = async (ev) => {
      if (!ev.candidate) return;
      try {
        await send(peerId, callMsg(peerId, { action: 'ice', callId: st.callId, mode: currentMode(), candidate: ev.candidate }));
      } catch (_) {}
    };

    // 连接状态自愈：failed 时（发起方）做 ICE restart
    const maybeRestartIce = async () => {
      try {
        if (!st.pc) return;
        if (!st.active || !st.isInitiator) return;
        const cs = st.pc.connectionState || '';
        const ics = st.pc.iceConnectionState || '';
        if (cs === 'failed' || ics === 'failed' || ics === 'disconnected') {
          await makeOffer(peerId, { iceRestart: true });
        }
      } catch (_) {}
    };

    st.pc.onconnectionstatechange = () => {
      try {
        const cs2 = st.pc && st.pc.connectionState;
        if (cs2 === 'connected') _p1ClearDiscTimer();
        if (cs2 === 'disconnected') _p1ArmDiscTimer('net_disconnected');
        if (cs2 === 'failed') _p1ArmDiscTimer('net_failed');
        if (cs2 === 'closed') { setTimeout(() => { try { reset('pc_closed'); } catch (_) {} }, 0); }
      } catch (_) {}
      maybeRestartIce().catch(() => {});
    };

    st.pc.oniceconnectionstatechange = () => {
      try {
        const ics2 = st.pc && st.pc.iceConnectionState;
        if (ics2 === 'connected' || ics2 === 'completed') _p1ClearDiscTimer();
        if (ics2 === 'disconnected') _p1ArmDiscTimer('ice_disconnected');
        if (ics2 === 'failed') _p1ArmDiscTimer('ice_failed');
        if (ics2 === 'closed') { setTimeout(() => { try { reset('ice_closed'); } catch (_) {} }, 0); }
      } catch (_) {}
      maybeRestartIce().catch(() => {});
    };
  }

  async function makeOffer(peerId, opts = {}) {
    if (!st.pc) return;
    try {
      st._makingOffer = true;
      const wantVideo = (currentMode() === 'video');
      const offer = await st.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: wantVideo,
        iceRestart: !!opts.iceRestart
      });
      await st.pc.setLocalDescription(offer);
      await send(peerId, callMsg(peerId, { action: 'offer', callId: st.callId, mode: currentMode(), sdp: offer }));
      window.dispatchEvent(new CustomEvent('p1-call-state', { detail: { state: 'offered', mode: currentMode(), peerId } }));
    } finally {
      st._makingOffer = false;
    }
  }

  async function ensureVideoTrackAndRenegotiate() {
    if (!st.active || !st.peerId || !st.pc || !st.localStream) return;

    // already has video?
    const existing = st.localStream.getVideoTracks ? st.localStream.getVideoTracks()[0] : null;
    if (existing) {
      existing.enabled = true;
      st.mode = 'video';
      window.dispatchEvent(new CustomEvent('p1-call-state', { detail: { state: 'mode', mode: 'video', peerId: st.peerId } }));
      await makeOffer(st.peerId);
      return;
    }

    const { stream: vStream, track: vTrack } = await getNewVideoTrack();
    try {
      vTrack.enabled = true;
      st.localStream.addTrack(vTrack);

      // add/replace in pc
      const sender = st.pc.getSenders().find(s => s && s.track && s.track.kind === 'video');
      if (sender) {
        await sender.replaceTrack(vTrack);
      } else {
        st.pc.addTrack(vTrack, st.localStream);
      }

      st.mode = 'video';
      tryAttach();
      window.dispatchEvent(new CustomEvent('p1-call-state', { detail: { state: 'mode', mode: 'video', peerId: st.peerId } }));
      await makeOffer(st.peerId);
    } finally {
      // stop extra stream container, keep track in localStream
      try { vStream.getTracks().forEach(t => { if (t !== vTrack) t.stop(); }); } catch (_) {}
    }
  }

  async function switchCamera() {
    try {
      if (!st.active || !st.pc || !st.localStream) return;

      // if no video yet, turn it on first
      const curV = st.localStream.getVideoTracks ? st.localStream.getVideoTracks()[0] : null;
      if (!curV) {
        st.facingMode = (st.facingMode === 'user') ? 'environment' : 'user';
        await ensureVideoTrackAndRenegotiate();
        return;
      }

      st.facingMode = (st.facingMode === 'user') ? 'environment' : 'user';
      const { stream: vStream, track: newTrack } = await getNewVideoTrack();

      const sender = st.pc.getSenders().find(s => s && s.track && s.track.kind === 'video');
      if (sender) {
        await sender.replaceTrack(newTrack);
      } else {
        st.pc.addTrack(newTrack, st.localStream);
      }

      try {
        // replace in local stream
        st.localStream.removeTrack(curV);
        try { curV.stop(); } catch (_) {}
        st.localStream.addTrack(newTrack);
        tryAttach();
      } catch (_) {}

      try { vStream.getTracks().forEach(t => { if (t !== newTrack) t.stop(); }); } catch (_) {}
    } catch (_) {}
  }

  async function start(peerId, mode) {
    // 由用户点击触发：先解锁媒体，提升移动端自动播放成功率
    unlockMedia();
    if (!peerId || peerId === 'all') return;
    if (st.active) return;

    st.active = true;
    st.isInitiator = true;
    st.peerId = peerId;
    st.mode = (mode === 'video') ? 'video' : 'voice';
    st.callId = uuid();

    try {
      try {
        st.localStream = await getLocalStream(st.mode);
      } catch (e) {
        // video 权限/设备失败：降级为语音
        st.mode = 'voice';
        st.localStream = await getLocalStream('voice');
      }

      setupPcCommon(peerId);

      st.localStream.getTracks().forEach(t => st.pc.addTrack(t, st.localStream));

      tryAttach();

      await makeOffer(peerId);
    } catch (e) {
      reset('start_error');
      throw e;
    }
  }

  async function accept(detail) {
    // 由用户点击“接听”触发：先解锁媒体
    unlockMedia();
    const peerId = detail && detail.from;
    const callId = detail && detail.callId;
    const mode = (detail && detail.mode === 'video') ? 'video' : 'voice';
    const sdp = detail && detail.sdp;
    if (!peerId || !callId || !sdp) return;

    if (st.active) {
      try { await send(peerId, callMsg(peerId, { action: 'busy', callId, mode })); } catch (_) {}
      return;
    }

    st.active = true;
    st.isInitiator = false;
    st.peerId = peerId;
    st.mode = mode;
    st.callId = callId;

    try {
      try {
        st.localStream = await getLocalStream(st.mode);
      } catch (e) {
        st.mode = 'voice';
        st.localStream = await getLocalStream('voice');
      }

      setupPcCommon(peerId);

      st.localStream.getTracks().forEach(t => st.pc.addTrack(t, st.localStream));

      tryAttach();

      await st.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await _p1IceDrain(st.callId);
      const answer = await st.pc.createAnswer();
      await st.pc.setLocalDescription(answer);

      // 再 tryAttach 一次，提高移动端起播概率
      setTimeout(() => tryAttach(), 500);

      await send(peerId, callMsg(peerId, { action: 'answer', callId: st.callId, mode: currentMode(), sdp: answer }));
      window.dispatchEvent(new CustomEvent('p1-call-state', { detail: { state: 'answered', mode: currentMode(), peerId } }));
    } catch (e) {
      reset('accept_error');
      throw e;
    }
  }

  async function onSignal(pkt) {
    const call = pkt.call || {};
    const action = call.action;
    const from = pkt.senderId;

    // offer：未在通话 -> 来电；在通话且同 callId -> renegotiation
    if (action === 'offer') {
      // not active => incoming
      if (!st.active) {
        window.dispatchEvent(new CustomEvent('p1-call-incoming', { detail: { from, callId: call.callId, mode: call.mode || 'voice', sdp: call.sdp } }));
        return true;
      }

      // active but different call => busy
      if (!st.callId || call.callId !== st.callId) {
        try { await send(from, callMsg(from, { action: 'busy', callId: call.callId, mode: call.mode || 'voice' })); } catch (_) {}
        return true;
      }

      // renegotiation offer
      try {
        const polite = !st.isInitiator;
        const offerDesc = new RTCSessionDescription(call.sdp);
        const collision = st._makingOffer || (st.pc && st.pc.signalingState !== 'stable');
        st._ignoreOffer = !polite && collision;
        if (st._ignoreOffer) return true;

        if (collision && st.pc) {
          try { await st.pc.setLocalDescription({ type: 'rollback' }); } catch (_) {}
        }
        if (st.pc) await st.pc.setRemoteDescription(offerDesc);
        await _p1IceDrain(st.callId);
        if (st.pc) {
          const answer = await st.pc.createAnswer();
          await st.pc.setLocalDescription(answer);
          await send(from, callMsg(from, { action: 'answer', callId: st.callId, mode: currentMode(), sdp: answer }));
          window.dispatchEvent(new CustomEvent('p1-call-state', { detail: { state: 'renegotiated', mode: currentMode(), peerId: st.peerId } }));
        }
      } catch (_) {}
      return true;
    }

    if (!st.active || !st.callId || call.callId !== st.callId) {
      // 致命修复：未接听/未建PC阶段先到的 ICE 不能丢，先缓存
      if (action === 'ice') {
        try { if (call && call.callId && call.candidate) _p1IcePut(call.callId, call.candidate); } catch (_) {}
      }
      return true;
    }

    if (action === 'answer') {
      try {
        if (st.pc && call.sdp) {
          await st.pc.setRemoteDescription(new RTCSessionDescription(call.sdp));
          await _p1IceDrain(st.callId);
        }
      } catch (_) {}
      return true;
    }
    if (action === 'ice') {
      try {
        if (call && call.candidate) {
          await _p1AddIceSafe(st.callId, call.candidate);
          await _p1IceDrain(st.callId);
        }
      } catch (_) {}
      return true;
    }
    if (action === 'hangup') { reset('remote_hangup'); return true; }
    if (action === 'busy') { reset('remote_busy'); return true; }

    return true;
  }

  function hangup() {
    const peerId = st.peerId;
    const callId = st.callId;
    const mode = st.mode;
    if (peerId && callId) {
      send(peerId, callMsg(peerId, { action: 'hangup', callId, mode })).catch(() => {});
    }
    reset('local_hangup');
  }

  function setMuted(on) {
    st.muted = !!on;
    try { st.localStream && st.localStream.getAudioTracks().forEach(t => { t.enabled = !st.muted; }); } catch (_) {}
  }

  function setVideoEnabled(on) {
    st.videoEnabled = !!on;

    // 已有 video track：只开关 enabled
    try {
      const v = st.localStream && st.localStream.getVideoTracks ? st.localStream.getVideoTracks()[0] : null;
      if (v) v.enabled = st.videoEnabled;
    } catch (_) {}

    // 打开时如果还没有 video track：补轨并重协商
    if (st.videoEnabled) {
      ensureVideoTrackAndRenegotiate().catch(() => {});
    } else {
      // 关闭：不强制重协商，先稳定为主（可后续再做“移除轨+reoffer”优化）
      st.mode = 'voice';
      window.dispatchEvent(new CustomEvent('p1-call-state', { detail: { state: 'mode', mode: 'voice', peerId: st.peerId } }));
    }

    tryAttach();
  }

  async function setSpeaker(_on) {
    // 浏览器端多数不支持真“扬声器/听筒”切换；尽力而为：触发一次播放尝试
    tryAttach();
    return;
  }

  function _p1ResumeAudioOnce() {
    try {
      if (window.__p1_audio_unlocked) return;
      window.__p1_audio_unlocked = true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ac = new AC();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      gain.gain.value = 0.00001;
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(0);
      if (ac.state === 'suspended' && ac.resume) { try { ac.resume().catch(() => {}); } catch (_) {} }
      setTimeout(() => {
        try { osc.stop(); } catch (_) {}
        try { ac.close && ac.close(); } catch (_) {}
      }, 60);
    } catch (_) {}
  }

  function unlockMedia() {
    st._unlocked = true;
    _p1ResumeAudioOnce();
    tryAttach();
  }

  function patchProtocol() {
    if (!window.protocol || typeof window.protocol.processIncoming !== 'function') return false;
    if (window.protocol.__p1_call_proc_patched) return true;

    const origProc = window.protocol.processIncoming.bind(window.protocol);
    window.protocol.processIncoming = function(pkt, fromPeerId) {
      try {
        if (pkt && pkt.t === MSG_TYPE.MSG && pkt.kind === 'p1_call' && pkt.call) {
          onSignal(pkt).catch(() => {});
          return;
        }
      } catch (_) {}
      return origProc(pkt, fromPeerId);
    };

    window.protocol.__p1_call_proc_patched = true;
    return true;
  }

  // public API
  window.p1Call = window.p1Call || {};
  window.p1Call.attach = registerAttachment;
  window.p1Call.start = start;
  window.p1Call.accept = accept;
  window.p1Call.hangup = hangup;
  window.p1Call.setMuted = setMuted;
  window.p1Call.setVideoEnabled = setVideoEnabled;
  window.p1Call.setSpeaker = setSpeaker;
  window.p1Call.unlockMedia = unlockMedia;
  window.p1Call.switchCamera = switchCamera;

  if (!patchProtocol()) {
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (patchProtocol() || tries > 80) clearInterval(t);
    }, 50);
  }
}
