// Efeitos globais: transição de estrelas entre telas, animação de clique do mouse e céu estrelado dos menus
const FX = (() => {
  const TAU = Math.PI * 2, $ = id => document.getElementById(id);
  const COLS = ['#3ef0ff', '#ff2e88', '#ffd23f', '#ffffff', '#a56bff'];
  const ease = x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;

  // ---------- transição: a tela fecha numa estrela giratória e abre em outra ----------
  const tc = $('trans'), c = tc.getContext('2d');
  let W, H; const rs = () => { W = tc.width = innerWidth; H = tc.height = innerHeight; }; addEventListener('resize', rs); rs();
  let an = null, parts = [], lastT = 0;
  const compact = (list, keep) => { let write = 0; for (let read = 0; read < list.length; read++) { const item = list[read]; if (keep(item)) list[write++] = item; } list.length = write; };
  const star = (x, y, r, rot) => { c.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * .2 : r, a = rot + i * Math.PI / 4; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); };
  const starPath = (R, rot) => { c.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? R * .46 : R, a = rot + i * Math.PI / 5 - Math.PI / 2; c.lineTo(W / 2 + Math.cos(a) * rr, H / 2 + Math.sin(a) * rr); } c.closePath(); };
  function emit(x, y, n, sp, life) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = sp * (.3 + Math.random()); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, s: 5 + Math.random() * 13, r: Math.random() * TAU, col: COLS[Math.random() * COLS.length | 0] }); } }
  function run(mid) {
    if (an) { if (an.t >= an.mid) mid(); else an.cb = mid; return; }
    an = { t: 0, mid: .42, end: .9, cb: mid, fired: false }; parts = []; tc.classList.remove('hidden'); lastT = performance.now(); requestAnimationFrame(step);
  }
  function step(now) {
    const dt = Math.min(.1, (now - lastT) / 1000); lastT = now; an.t += dt;
    const diag = Math.hypot(W, H) * .62, closing = an.t < an.mid;
    const k = closing ? an.t / an.mid : (an.t - an.mid) / (an.end - an.mid), R = Math.max(0, closing ? diag * (1 - ease(k)) : diag * ease(k)), rot = an.t * 5;
    if (an.t >= an.mid && !an.fired) { an.fired = true; an.cb(); emit(W / 2, H / 2, 60, 700, .9); }
    // estrelas voando a partir da borda da estrela
    for (let i = 0; i < 7; i++) { const a = Math.random() * TAU, rr = R * (.5 + Math.random() * .5); parts.push({ x: W / 2 + Math.cos(a) * rr, y: H / 2 + Math.sin(a) * rr, vx: Math.cos(a) * (closing ? -120 : 200), vy: Math.sin(a) * (closing ? -120 : 200), life: .7, max: .7, s: 5 + Math.random() * 12, r: Math.random() * TAU, col: COLS[Math.random() * COLS.length | 0] }); }
    c.clearRect(0, 0, W, H); c.globalCompositeOperation = 'source-over';
    const g = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, diag); g.addColorStop(0, '#1a0f3d'); g.addColorStop(1, '#03040f'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'destination-out'; starPath(R, rot); c.fill();
    c.globalCompositeOperation = 'lighter';
    if (R > 2) { c.save(); c.shadowColor = '#ff2e88'; c.shadowBlur = 28; c.strokeStyle = '#ff7ac0'; c.lineWidth = 5; starPath(R, rot); c.stroke(); c.shadowColor = '#3ef0ff'; c.strokeStyle = '#7ff6ff'; c.lineWidth = 2; starPath(R * .96, rot); c.stroke(); c.restore(); }
    for (const q of parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; q.r += dt * 4; c.globalAlpha = Math.max(0, q.life / q.max); c.fillStyle = q.col; star(q.x, q.y, q.s * (.4 + .6 * q.life / q.max), q.r); c.fill(); }
    c.globalAlpha = 1; compact(parts, q => q.life > 0);
    if (an.t < an.end) requestAnimationFrame(step); else { c.clearRect(0, 0, W, H); tc.classList.add('hidden'); an = null; }
  }

  // ---------- som de clique + ondas e faíscas ----------
  // Coloque o arquivo em assets/audio/click.mp3 (caminho relativo à index.html).
  const audioBase = 'assets/audio/';
  const clickAudio = new Audio(audioBase + 'click.mp3');
  const menuMusic = new Audio(audioBase + 'fundo.mp3');
  // As músicas dos palcos (~3 MB cada) só são baixadas quando o palco é usado (stageTrack), não na abertura do jogo.
  const stageFiles = { clementis: 'clementis.m4a', blinkgone: 'blink%20gone.m4a', blacksorrow: 'black%20sorrow.m4a', cure: 'cure.m4a', ruler: 'ruler.m4a', karma: 'karma.m4a', unknown: 'unknown.m4a' };
  const stageMusic = {};
  const stageTrack = id => stageMusic[id] || (stageMusic[id] = Object.assign(new Audio(audioBase + (stageFiles[id] || stageFiles.clementis)), { loop: true, volume: 0.30, preload: 'auto', muted }));
  const buttonAudio = new Audio(audioBase + 'som%20%20de%20quando%20clica%20em%20botao.mp3.mp3');
  const skillAudio = new Audio(audioBase + 'som%20de%20quando%20ganha%20habilidade.mp3.mp3');
  buttonAudio.preload = skillAudio.preload = 'auto';
  buttonAudio.volume = 0.38;
  skillAudio.volume = 0.48;
  let currentStage = 'clementis';
  clickAudio.preload = menuMusic.preload = 'auto';
  clickAudio.volume = 0.32;
  menuMusic.loop = true;
  menuMusic.volume = 0.24;
  let musicMode = 'menu', musicUnlocked = false, muted = false;
  function playMusic(mode, stageId) {
    musicMode = mode;
    if (stageId && stageFiles[stageId]) currentStage = stageId;
    const target = mode === 'game' ? stageTrack(currentStage) : menuMusic;
    [menuMusic, ...Object.values(stageMusic)].forEach(a => { if (a !== target) a.pause(); });
    if (mode === 'pause' || muted) { target.pause(); return; }
    if (musicUnlocked && target.paused) target.play().catch(() => {});
  }
  // nova partida: a trilha do palco volta para o começo (só chamado ao iniciar; retomar do pause continua de onde parou)
  function restartStage(id) {
    const a = stageTrack(stageFiles[id] ? id : currentStage);
    try { a.pause(); a.currentTime = 0; } catch (_) {}
  }
  function sfx(name) {
    if (muted) return;
    const source = name === 'skill' ? skillAudio : name === 'button' ? buttonAudio : null;
    if (!source) return;
    try { source.currentTime = 0; source.play().catch(() => {}); } catch (_) {}
  }
  function unlockAudio() {
    musicUnlocked = true;
    if (!muted && musicMode !== 'pause') {
      const target = musicMode === 'game' ? stageTrack(currentStage) : menuMusic;
      target.play().catch(() => {});
    }
  }
  function toggleMute() {
    muted = !muted;
    [clickAudio, buttonAudio, skillAudio, menuMusic, ...Object.values(stageMusic)].forEach(a => { a.muted = muted; });
    if (!muted) unlockAudio();
    return muted;
  }

  addEventListener('pointerdown', e => {
    unlockAudio();
    // Reutiliza o áudio de clique, evitando criar um novo elemento a cada interação.
    const isButton = e.target && e.target.closest && e.target.closest('button');
    if (isButton) sfx('button');
    else { try { clickAudio.currentTime = 0; clickAudio.play().catch(() => {}); } catch (_) {} }
    if (document.body.classList.contains('ingame')) return;      // durante a partida não cria ondas/faíscas (o mouse é a mira)
    for (let i = 0; i < 2; i++) { const r = document.createElement('i'); r.className = 'ripple' + (i ? ' b' : ''); r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'; document.body.appendChild(r); setTimeout(() => r.remove(), 850); }
    for (let i = 0; i < 10; i++) { const s = document.createElement('i'), a = i * TAU / 10 + Math.random() * .4, d = 36 + Math.random() * 46;
      s.className = 'cspark'; s.style.cssText = `left:${e.clientX}px;top:${e.clientY}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;--c:${COLS[i % COLS.length]};--z:${8 + Math.random() * 9}px`;
      document.body.appendChild(s); setTimeout(() => s.remove(), 750); }
  });

  // ---------- céu estrelado animado dos menus (com estrelas cadentes) ----------
  const tw = $('twinkle'), t2 = tw.getContext('2d'); let on = false, raf = 0, ss = [], shoot = [], nextShoot = 1.5, tt = 0, lastB = 0;
  const rs2 = () => { tw.width = innerWidth; tw.height = innerHeight; ss = Array.from({ length: 90 }, () => ({ x: Math.random() * tw.width, y: Math.random() * tw.height, r: .6 + Math.random() * 2, p: Math.random() * TAU, v: .5 + Math.random() * 2, dr: (Math.random() - .5) * 8, col: COLS[Math.random() * COLS.length | 0] })); };
  addEventListener('resize', rs2); rs2();
  // brilho das estrelas: um sprite por cor (bem mais barato que shadowBlur a cada frame)
  const glowCache = {};
  const glowOf = col => glowCache[col] || (glowCache[col] = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return c; })());
  function loopBg(now) {
    if (!on) { raf = 0; return; }
    const dt = Math.min(.05, (now - lastB) / 1000); lastB = now; tt += dt;
    t2.clearRect(0, 0, tw.width, tw.height);
    for (const s of ss) { s.y -= s.dr * dt * .5; s.x += s.dr * dt; if (s.x < -5) s.x = tw.width + 5; if (s.x > tw.width + 5) s.x = -5; if (s.y < -5) s.y = tw.height + 5; if (s.y > tw.height + 5) s.y = -5;
      const a = .25 + .75 * (.5 + .5 * Math.sin(tt * s.v + s.p)); t2.globalAlpha = a * .6; const gs = glowOf(s.col), gz = s.r * 7; t2.drawImage(gs, s.x - gz / 2, s.y - gz / 2, gz, gz); t2.globalAlpha = a; t2.fillStyle = s.col;
      t2.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? s.r * .5 : s.r * 2.4, an2 = i * Math.PI / 4 + tt * .3; t2.lineTo(s.x + Math.cos(an2) * rr, s.y + Math.sin(an2) * rr); } t2.fill(); }
    t2.shadowBlur = 0; nextShoot -= dt;
    if (nextShoot <= 0) { nextShoot = 2 + Math.random() * 3; shoot.push({ x: Math.random() * tw.width * .8, y: Math.random() * tw.height * .4, life: .9 }); }
    for (const m of shoot) { m.life -= dt; m.x += 700 * dt; m.y += 300 * dt; const a = Math.max(0, m.life / .9), gr = t2.createLinearGradient(m.x - 160, m.y - 70, m.x, m.y); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, `rgba(255,255,255,${a})`); t2.globalAlpha = 1; t2.strokeStyle = gr; t2.lineWidth = 2.5; t2.beginPath(); t2.moveTo(m.x - 160, m.y - 70); t2.lineTo(m.x, m.y); t2.stroke(); }
    compact(shoot, m => m.life > 0); t2.globalAlpha = 1; raf = requestAnimationFrame(loopBg);
  }
  const sky = v => { on = v; tw.classList.toggle('hidden', !v); if (v && !raf) { lastB = performance.now(); raf = requestAnimationFrame(loopBg); } };
  const preload = id => { if (stageFiles[id]) stageTrack(id); };   // começa a baixar a música do palco escolhido
  return { run, sky, music: playMusic, sfx, toggleMute, preload, restartStage, isMuted: () => muted };
})();
