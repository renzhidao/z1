// p1-call-ui.js
// P1 模块：全局来电弹窗（不依赖 React 路由/页面）
// 目标：任何页面都能弹出并接听/挂断；并把媒体元素 attach 给 window.p1Call
export function init() {
  try { window.__p1_call_ui_native = true; } catch (_) {}

  const S = {
    shown: false,
    pending: null,
    peerId: '',
    mode: 'voice',
    muted: false,
    videoEnabled: true
  };

  let root = null;
  let btnAccept = null;
  let btnHang = null;
  let btnMute = null;
  let btnVideo = null;
  let titleEl = null;

  let remoteVideo = null;
  let localVideo = null;
  let remoteAudio = null;
  let avatarImg = null;

  function diceAvatar(seed) {
'https://picsum.photos/seed/' + encodeURIComponent(seed || 'user') + '/200/200'
  }

  function getName(pid) {
    try {
      const c = window.state && window.state.contacts && window.state.contacts[pid];
      if (c && c.n) return c.n;
    } catch (_) {}
    return pid ? pid : '未知';
  }

  function ensureDom() {
    if (root) return;

    root = document.createElement('div');
    root.id = 'p1-call-ui';
    root.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:999999',
      'display:none',
      'background:rgba(0,0,0,0.85)',
      'color:#fff',
      'font-family:-apple-system,BlinkMacSystemFont,PingFang SC,Segoe UI,Roboto,Helvetica,Arial,sans-serif'
    ].join(';');

    // 顶部信息
    const top = document.createElement('div');
    top.style.cssText = 'position:absolute;left:0;right:0;top:0;padding:18px 16px;';
    titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-size:18px;font-weight:500;';
    top.appendChild(titleEl);
    root.appendChild(top);

    // 主体：remote video / avatar
    const body = document.createElement('div');
    body.style.cssText = 'position:absolute;inset:64px 12px 140px 12px;display:flex;align-items:center;justify-content:center;';

    remoteVideo = document.createElement('video');
    remoteVideo.autoplay = true;
    remoteVideo.playsInline = true;
    remoteVideo.controls = false;
    remoteVideo.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:12px;background:#000;display:none;';
    body.appendChild(remoteVideo);

    avatarImg = document.createElement('img');
    avatarImg.style.cssText = 'width:120px;height:120px;border-radius:18px;object-fit:cover;box-shadow:0 10px 30px rgba(0,0,0,0.35);background:#222;';
    body.appendChild(avatarImg);

    // local preview
    localVideo = document.createElement('video');
    localVideo.autoplay = true;
    localVideo.muted = true;
    localVideo.playsInline = true;
    localVideo.controls = false;
    localVideo.style.cssText = 'position:absolute;right:16px;top:16px;width:110px;height:160px;object-fit:cover;border-radius:10px;border:1px solid rgba(255,255,255,0.25);background:#111;display:none;';
    body.appendChild(localVideo);

    remoteAudio = document.createElement('audio');
    remoteAudio.autoplay = true;
    body.appendChild(remoteAudio);

    root.appendChild(body);

    // 底部按钮
    const bottom = document.createElement('div');
    bottom.style.cssText = 'position:absolute;left:0;right:0;bottom:0;padding:18px 18px 26px 18px;display:flex;gap:12px;justify-content:center;align-items:center;flex-wrap:wrap;';

    const mkBtn = (txt, bg) => {
      const b = document.createElement('button');
      b.textContent = txt;
      b.style.cssText = `min-width:110px;height:44px;border-radius:999px;border:none;color:#fff;font-size:15px;cursor:pointer; background:${bg};`;
      return b;
    };

    btnAccept = mkBtn('接听', '#07C160');
    btnHang = mkBtn('挂断', '#FA5151');
    btnMute = mkBtn('静音', 'rgba(255,255,255,0.18)');
    btnVideo = mkBtn('摄像头', 'rgba(255,255,255,0.18)');

    bottom.appendChild(btnAccept);
    bottom.appendChild(btnHang);
    bottom.appendChild(btnMute);
    bottom.appendChild(btnVideo);

    root.appendChild(bottom);
    document.body.appendChild(root);

    btnAccept.onclick = async () => {
      try {
        if (S.pending && window.p1Call && window.p1Call.accept) {
          await window.p1Call.accept(S.pending);
          S.pending = null;
          updateButtons();
        }
      } catch (_) {}
    };

    btnHang.onclick = () => {
      try { window.p1Call && window.p1Call.hangup && window.p1Call.hangup(); } catch (_) {}
      hide();
    };

    btnMute.onclick = () => {
      S.muted = !S.muted;
      try { window.p1Call && window.p1Call.setMuted && window.p1Call.setMuted(S.muted); } catch (_) {}
      updateButtons();
    };

    btnVideo.onclick = () => {
      S.videoEnabled = !S.videoEnabled;
      try { window.p1Call && window.p1Call.setVideoEnabled && window.p1Call.setVideoEnabled(S.videoEnabled); } catch (_) {}
      updateButtons();
    };
  }

  function updateButtons() {
    try {
      if (!btnAccept || !btnMute || !btnVideo) return;
      btnAccept.style.display = S.pending ? 'inline-flex' : 'none';
      btnMute.textContent = S.muted ? '取消静音' : '静音';
      btnVideo.textContent = S.videoEnabled ? '关摄像头' : '开摄像头';
      btnVideo.style.display = (S.mode === 'video') ? 'inline-flex' : 'none';
    } catch (_) {}
  }

  function attachMedia() {
    try {
      if (window.p1Call && window.p1Call.attach) {
        window.p1Call.attach({ localVideo, remoteVideo, remoteAudio });
      }
    } catch (_) {}
  }

  function show(peerId, mode, pendingDetail) {
    ensureDom();
    S.peerId = peerId || '';
    S.mode = (mode === 'video') ? 'video' : 'voice';
    if (pendingDetail) S.pending = pendingDetail;

    try {
      const name = getName(S.peerId);
      if (titleEl) titleEl.textContent = (S.pending ? '来电：' : '通话中：') + name + (S.mode === 'video' ? '（视频）' : '（语音）');
      if (avatarImg) avatarImg.src = diceAvatar(S.peerId);
    } catch (_) {}

    // display mode
    try {
      if (remoteVideo) remoteVideo.style.display = (S.mode === 'video') ? 'block' : 'none';
      if (localVideo) localVideo.style.display = (S.mode === 'video') ? 'block' : 'none';
      if (avatarImg) avatarImg.style.display = (S.mode === 'video') ? 'none' : 'block';
    } catch (_) {}

    attachMedia();
    updateButtons();

    if (root) root.style.display = 'block';
    S.shown = true;
  }

  function hide() {
    try { if (root) root.style.display = 'none'; } catch (_) {}
    S.shown = false;
    S.pending = null;
  }

  // 监听：任何页面收到 offer 都弹出
  window.addEventListener('p1-call-incoming', (e) => {
    try {
      const d = e && e.detail ? e.detail : null;
      if (!d) return;
      show(d.from, d.mode, d);
    } catch (_) {}
  });

  // 监听：通话结束自动关闭
  window.addEventListener('p1-call-state', (e) => {
    try {
      const d = e && e.detail ? e.detail : null;
      if (!d) return;
      if (d.state === 'ended') hide();
    } catch (_) {}
  });

  // 包装 p1Call.start / accept / hangup：保证主动呼叫也弹出
  function patchP1Call() {
    if (!window.p1Call) return false;
    if (window.p1Call.__p1_call_ui_patched) return true;

    const origStart = window.p1Call.start ? window.p1Call.start.bind(window.p1Call) : null;
    const origAccept = window.p1Call.accept ? window.p1Call.accept.bind(window.p1Call) : null;
    const origHang = window.p1Call.hangup ? window.p1Call.hangup.bind(window.p1Call) : null;

    if (origStart) {
      window.p1Call.start = async (peerId, mode) => {
        try { show(peerId, mode, null); } catch (_) {}
        return origStart(peerId, mode);
      };
    }
    if (origAccept) {
      window.p1Call.accept = async (detail) => {
        try { show(detail && detail.from, detail && detail.mode, detail); } catch (_) {}
        const r = await origAccept(detail);
        try { S.pending = null; updateButtons(); } catch (_) {}
        return r;
      };
    }
    if (origHang) {
      window.p1Call.hangup = () => {
        try { origHang(); } finally { hide(); }
      };
    }

    window.p1Call.__p1_call_ui_patched = true;
    return true;
  }

  if (!patchP1Call()) {
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (patchP1Call() || tries > 80) clearInterval(t);
    }, 50);
  }
}
