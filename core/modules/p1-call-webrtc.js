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
    return [{ urls: ['stun:stun.l.google.com:19302'] }];
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
    localVideoEl: null,
    remoteVideoEl: null,
    remoteAudioEl: null,
    muted: false,
    videoEnabled: true,
  };

  function attach({ localVideo, remoteVideo, remoteAudio }) {
    st.localVideoEl = localVideo || null;
    st.remoteVideoEl = remoteVideo || null;
    st.remoteAudioEl = remoteAudio || null;
    tryAttach();
  }

  function tryAttach() {
    try {
      if (st.localVideoEl && st.localStream) {
        st.localVideoEl.srcObject = st.localStream;
        st.localVideoEl.muted = true;
        const p = st.localVideoEl.play && st.localVideoEl.play();
        if (p && p.catch) p.catch(() => {});
      }
    } catch (_) {}
    try {
      if (st.remoteVideoEl && st.remoteStream) {
        st.remoteVideoEl.srcObject = st.remoteStream;
        const p = st.remoteVideoEl.play && st.remoteVideoEl.play();
        if (p && p.catch) p.catch(() => {});
      }
    } catch (_) {}
    try {
      if (st.remoteAudioEl && st.remoteStream) {
        st.remoteAudioEl.srcObject = st.remoteStream;
        const p = st.remoteAudioEl.play && st.remoteAudioEl.play();
        if (p && p.catch) p.catch(() => {});
      }
    } catch (_) {}
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

  async function getLocalStream(mode) {
    const wantVideo = (mode === 'video') && st.videoEnabled;
    return await navigator.mediaDevices.getUserMedia({ audio: true, video: wantVideo });
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
    closePc();
    stopStream(st.localStream);
    st.localStream = null;
    st.remoteStream = null;
    try {
      if (st.localVideoEl) st.localVideoEl.srcObject = null;
      if (st.remoteVideoEl) st.remoteVideoEl.srcObject = null;
      if (st.remoteAudioEl) st.remoteAudioEl.srcObject = null;
    } catch (_) {}
    window.dispatchEvent(new CustomEvent('p1-call-state', { detail: { state: 'ended', reason: reason || '' } }));
  }

  async function start(peerId, mode) {
    if (!peerId || peerId === 'all') return;
    if (st.active) return;

    st.active = true;
    st.isInitiator = true;
    st.peerId = peerId;
    st.mode = (mode === 'video') ? 'video' : 'voice';
    st.callId = uuid();

    try {
      st.localStream = await getLocalStream(st.mode);
      st.remoteStream = new MediaStream();
      st.pc = new RTCPeerConnection({ iceServers: iceServers() });

      st.localStream.getTracks().forEach(t => st.pc.addTrack(t, st.localStream));

      st.pc.ontrack = (ev) => {
        try {
          if (ev.streams && ev.streams[0]) {
            ev.streams[0].getTracks().forEach(tr => st.remoteStream.addTrack(tr));
            tryAttach();
          }
        } catch (_) {}
      };

      st.pc.onicecandidate = async (ev) => {
        if (!ev.candidate) return;
        try { await send(peerId, callMsg(peerId, { action: 'ice', callId: st.callId, mode: st.mode, candidate: ev.candidate })); } catch (_) {}
      };

      tryAttach();

      const offer = await st.pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: st.mode === 'video' });
      await st.pc.setLocalDescription(offer);

      await send(peerId, callMsg(peerId, { action: 'offer', callId: st.callId, mode: st.mode, sdp: offer }));
      window.dispatchEvent(new CustomEvent('p1-call-state', { detail: { state: 'offered', mode: st.mode, peerId } }));
    } catch (e) {
      reset('start_error');
      throw e;
    }
  }

  async function accept(detail) {
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
      st.localStream = await getLocalStream(st.mode);
      st.remoteStream = new MediaStream();
      st.pc = new RTCPeerConnection({ iceServers: iceServers() });

      st.localStream.getTracks().forEach(t => st.pc.addTrack(t, st.localStream));

      st.pc.ontrack = (ev) => {
        try {
          if (ev.streams && ev.streams[0]) {
            ev.streams[0].getTracks().forEach(tr => st.remoteStream.addTrack(tr));
            tryAttach();
          }
        } catch (_) {}
      };

      st.pc.onicecandidate = async (ev) => {
        if (!ev.candidate) return;
        try { await send(peerId, callMsg(peerId, { action: 'ice', callId: st.callId, mode: st.mode, candidate: ev.candidate })); } catch (_) {}
      };

      tryAttach();

      await st.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await st.pc.createAnswer();
      await st.pc.setLocalDescription(answer);

      await send(peerId, callMsg(peerId, { action: 'answer', callId: st.callId, mode: st.mode, sdp: answer }));
      window.dispatchEvent(new CustomEvent('p1-call-state', { detail: { state: 'answered', mode: st.mode, peerId } }));
    } catch (e) {
      reset('accept_error');
      throw e;
    }
  }

  async function onSignal(pkt) {
    const call = pkt.call || {};
    const action = call.action;
    const from = pkt.senderId;

    if (action === 'offer') {
      window.dispatchEvent(new CustomEvent('p1-call-incoming', { detail: { from, callId: call.callId, mode: call.mode || 'voice', sdp: call.sdp } }));
      return true;
    }

    if (!st.active || !st.callId || call.callId !== st.callId) return true;

    if (action === 'answer') {
      try { st.pc && await st.pc.setRemoteDescription(new RTCSessionDescription(call.sdp)); } catch (_) {}
      return true;
    }
    if (action === 'ice') {
      try { st.pc && call.candidate && await st.pc.addIceCandidate(new RTCIceCandidate(call.candidate)); } catch (_) {}
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
    try { st.localStream && st.localStream.getVideoTracks().forEach(t => { t.enabled = st.videoEnabled; }); } catch (_) {}
  }

  async function setSpeaker(_on) {
    try {
      const el = st.remoteAudioEl || st.remoteVideoEl;
      if (el && typeof el.setSinkId === 'function') await el.setSinkId('');
    } catch (_) {}
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

  window.p1Call = window.p1Call || {};
  window.p1Call.attach = attach;
  window.p1Call.start = start;
  window.p1Call.accept = accept;
  window.p1Call.hangup = hangup;
  window.p1Call.setMuted = setMuted;
  window.p1Call.setVideoEnabled = setVideoEnabled;
  window.p1Call.setSpeaker = setSpeaker;

  if (!patchProtocol()) {
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (patchProtocol() || tries > 80) clearInterval(t);
    }, 50);
  }
}
