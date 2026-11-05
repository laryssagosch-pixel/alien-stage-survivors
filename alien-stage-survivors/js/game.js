// Motor do jogo (estilo Vampire Survivors) — tema Alien Stage
const Game = (() => {
  // alpha:false = canvas opaco (o fundo do palco cobre tudo), o navegador compõe mais rápido.
  const cv = document.getElementById('game'), ctx = cv.getContext('2d', { alpha: false }), TAU = 6.283;
  let W, H;
  const hyp = (a, b) => Math.sqrt(a * a + b * b);
  // Qualidade adaptativa: RS = escala de resolução do canvas (1 = cheia). Cai sozinha se o FPS ficar baixo e volta quando sobra folga.
  // QK/SK = fator do brilho (shadowBlur): QK pela qualidade, SK é o valor efetivo no frame (zerado depois de N inimigos com brilho).
  let RS = 1, QK = 1, SK = 1, ema = 16.7, ctl = 0, calm = 0, showFps = false, fpsN = 0, fpsT = 0, fpsV = 0;
  { const d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'shadowBlur');
    if (d && d.set) Object.defineProperty(ctx, 'shadowBlur', { get() { return d.get.call(ctx); }, set(v) { d.set.call(ctx, v * SK); }, configurable: true }); }
  const resize = () => { W = innerWidth; H = innerHeight; cv.width = Math.round(W * RS); cv.height = Math.round(H * RS); cv.style.width = W + 'px'; cv.style.height = H + 'px'; };
  const applyQ = () => { QK = RS >= .95 ? 1 : RS >= .8 ? .5 : 0; SK = QK; resize(); };
  function adapt(ms) {
    if (ms > 120) return;                                  // aba em segundo plano ou engasgo isolado: ignora
    ema += (ms - ema) * .06; ctl += ms; fpsN++; fpsT += ms;
    if (fpsT >= 500) { fpsV = Math.round(fpsN * 1000 / fpsT); fpsN = 0; fpsT = 0; }
    if (ctl < 1500) return; ctl = 0;
    if (ema > 26 && RS > .55) { RS = Math.max(.55, +(RS - .15).toFixed(2)); calm = 0; applyQ(); }                       // abaixo de ~38 fps: baixa a resolução
    else if (ema < 17.5 && RS < 1) { if (++calm >= 3) { RS = Math.min(1, +(RS + .1).toFixed(2)); calm = 0; applyQ(); } } // folga por ~4,5s: sobe de novo
    else calm = 0;
  }
  addEventListener('resize', resize); resize();

  const keys = {};
  const clearInput = () => { for (const k in keys) keys[k] = false; touch = null; };
  addEventListener('keydown', e => { const k = e.key.toLowerCase(); keys[k] = true; if (e.key === 'F3') { e.preventDefault(); showFps = !showFps; } if (s && !s.over && !s.halt && !e.repeat) { if (k === ' ' || k === 'r') { e.preventDefault(); useUlt(); } else if (k === 'e' || k === 'q') { e.preventDefault(); useSpecial(); } } else if (k === ' ') e.preventDefault(); });
  addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
  let touch = null;
  addEventListener('blur', () => clearInput());
  // Mira: o personagem atira para onde está o cursor do mouse. Em telas de toque continua mirando no inimigo mais próximo.
  const aim = { x: 0, y: 0, on: false }, AP = { x: 0, y: 0 };
  addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || e.pointerType === 'pen') { aim.x = e.clientX; aim.y = e.clientY; aim.on = true; } else aim.on = false; }, { passive: true });
  cv.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') touch = { x: e.clientX, y: e.clientY, dx: 0, dy: 0 }; });   // arrastar para andar só no toque (o mouse é a mira)
  cv.addEventListener('pointermove', e => { if (touch) { touch.dx = e.clientX - touch.x; touch.dy = e.clientY - touch.y; } });
  addEventListener('pointerup', () => touch = null);

  const MAXLV = 6;
  let s, raf, last, cb, ch, img, map, cuts, tarotImg;

  // Reaproveita os arrays de entidades/efeitos para evitar alocações por frame.
  // A ordem dos itens restantes é preservada.
  const compact = (list, keep) => {
    let write = 0;
    for (let read = 0; read < list.length; read++) {
      const item = list[read];
      if (keep(item)) list[write++] = item;
    }
    list.length = write;
    return list;
  };

  function start(o) {
    ch = o.ch; img = o.img; cb = o; map = o.map; const up = o.up;
    const hp = Math.round((100 + up.hp * 20) * ch.hp);
    s = {
      sk: { cd: ch.sk.cd * .3, max: ch.sk.cd }, sp: { cd: ch.sp.cd * .35, max: ch.sp.cd }, eff: [], ov: [], gh: [], ink: [], hearts: [], swq: [], flw: [], bub: [], b: {}, tr: { tier: 0, cd2: 0, cd3: 0, lp: 0 },
      shield: 0, adr: 0, kc: 0, face: { x: 1, y: 0 }, xpm: map.mod.xp || 1, enm: map.mod.en || 1, hpm: map.mod.hp || 1,
      imm: 0, pacify: 0, freeze: 0, ls: 0, lsT: 0, rdm: 0, cs: 0, csT: 0, stk: 0, zone: null, leap: 1, dist: 0, lowT: 0, gemN: 0, shw: 0, gc: 0, lastStand: 0, sacEnd: 0, rg: null, absorb: null, inkT: 0,
      t: 0, kills: 0, halt: false, lvl: false, over: false, dying: 0, spawn: 0, bossAt: 75, eb: [], tz: [], cp: [], cut: null, nb: 0, bonus: 0, cmb: null, cmbUse: {}, bk: [], warn: 0, bossE: null, hurtT: 0, orb: 0, waveT: 0, shake: 0, mv: false, lean: 0,
      p: { x: 0, y: 0, r: 14, hp, max: hp, spd: 170 * (1 + .05 * up.spd) * ch.spd, inv: 0, lv: 1, xp: 0, next: 5, mag: map.mod.mag || 0 },
      dmg: (1 + .1 * up.dmg) * ch.dm, w: { mic: 1, wave: 0, orbit: 0 }, cd: 0, orbs: [],
      en: [], shots: [], gems: [], fx: [], pt: []
    };
    ema = 16.7; ctl = -3000; calm = 0;          // 3s de aquecimento: a transição de tela e o carregamento não contam para a qualidade adaptativa
    cuts = o.cut || {}; tarotImg = o.tarotImg || {}; if (!cb.tarot) cb.tarot = {}; if (!cb.tarot[ch.id]) cb.tarot[ch.id] = { p: 0, u: 0, t: 0 }; s.xpb = s.xpm;
    clearInput(); last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  }
  const stop = () => { cancelAnimationFrame(raf); s = null; clearInput(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height); };
  const pause = () => { if (s && !s.over && !s.dying) s.halt = true; };
  const resume = () => { if (s) { s.halt = false; last = performance.now(); } };

  function loop(now) {
    if (!s) return;
    const raw = now - last, dt = Math.max(0, Math.min(.05, raw / 1000)); last = now; adapt(raw);
    if (!s.halt && !s.lvl && !s.over) update(dt);
    draw();
    if (showFps) { ctx.setTransform(RS, 0, 0, RS, 0, 0); ctx.font = '700 12px monospace'; ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(W - 150, H - 24, 142, 18); ctx.fillStyle = fpsV >= 50 ? '#7dffb0' : fpsV >= 35 ? '#ffe066' : '#ff6a86'; ctx.fillText(`${fpsV} FPS · render ${Math.round(RS * 100)}%`, W - 12, H - 11); }
    if (s && !s.over) raf = requestAnimationFrame(loop);
  }

  // Busca o alvo sem criar um objeto intermediário para cada inimigo.
  // Inimigos já derrotados são ignorados para evitar tiros mirando em cadáveres.
  const near = (x, y, list) => {
    let best = null, bestD = Infinity;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.dead) continue;
      const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy;
      if (d < bestD) { best = e; bestD = d; }
    }
    return best;
  };

  // Embaralhamento uniforme, sem o custo e o comportamento indefinido de sort aleatório.
  const shuffle = list => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };
  const burst = (x, y, col, n, sp = 130, life = .5, size = 3) => {
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = sp * (.3 + Math.random());
      s.pt.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (.5 + Math.random() * .5), max: life, col, size }); }
  };

  // ================= v10: kits dos personagens (arma + especial + ultimate), sinergias e tarô =================
  const D = () => s.dmg * (s.b.hr > 0 ? 2 : 1) * (s.b.sac > 0 ? 3 : 1) * (1 + .04 * (s.stk || 0));   // multiplicador de dano geral
  const Dw = () => D() * (s.leap || 1);                                                              // armas básicas (Salto de Fé do Till)
  const PCOL = id => CHARS.find(c => c.id === id).col, PACC = id => CHARS.find(c => c.id === id).acc, PNAME = id => CHARS.find(c => c.id === id).name;
  const ang2 = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
  const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const onScr = (e, m = 0) => Math.abs(e.x - s.p.x) < W / 2 + m + (e.r || 0) && Math.abs(e.y - s.p.y) < H / 2 + m + (e.r || 0);
  const each = (fn, test) => { for (const e of s.en) if (!e.dead && (!test || test(e))) fn(e); };
  const tier = id => (ch.id === id && s.tr ? s.tr.tier : 0);
  const lowHp = () => 1 - s.p.hp / s.p.max;
  const ivanLow = () => tier('ivan') >= 1 ? lowHp() : 0;
  const critC = () => .05 + (s.b.rage > 0 ? .35 : 0) + ivanLow() * .4 + ((s.leap || 1) > 1.5 ? .5 : 0);
  const critM = () => 2 + (s.b.rage > 0 ? 1 : 0);
  const atkSpd = () => (s.b.rage > 0 ? 1.8 : 1) * (s.b.hy > 0 ? 1.5 : 1) * (s.b.cl > 0 ? 4 : 1) * (s.b.lk > 0 ? 1.3 : 1) * (1 + ivanLow() * .8);
  const spdMul = () => (s.b.hy > 0 ? 1.5 : 1) * (s.b.fz > 0 ? 1.5 : 1) * (s.b.lk > 0 ? 1.9 : 1) * (1 + .02 * (s.cs || 0));
  const drMul = () => Math.min(.75, .03 * (s.cs || 0) + .012 * (s.stk || 0) + (s.b.vv > 0 ? .8 : 0));

  // ---------- status dos inimigos ----------
  const slowE = (e, t, f = .3) => { e.sl = Math.max(e.sl || 0, t); e.slf = f; };
  const stunE = (e, t) => { e.stun = Math.max(e.stun || 0, e.boss ? t * .4 : t); };
  const freezeE = (e, t) => { e.frz = Math.max(e.frz || 0, e.boss ? t * .5 : t); };
  const knock = (e, a, d) => { if (e.boss) d *= .2; e.kx = (e.kx || 0) + Math.cos(a) * d * 4; e.ky = (e.ky || 0) + Math.sin(a) * d * 4; };
  const poisonE = (e, dps, t = 4) => { e.psn = Math.max(e.psn || 0, t); e.psd = Math.max(e.psd || 0, dps); };
  const burnE = (e, dps, t = 3) => { e.brn = Math.max(e.brn || 0, t); e.brd = Math.max(e.brd || 0, dps); };
  const pickOther = e => { let best = null, bd = Infinity; for (let i = 0; i < 14 && s.en.length > 1; i++) { const o = s.en[(Math.random() * s.en.length) | 0]; if (o === e || o.dead) continue; const d = d2(e, o); if (d < bd) { bd = d; best = o; } } return best; };

  // ---------- dano: crítico e armadura ----------
  function hit(e, dmg, col, o = {}) {
    let m = o.mult || 1, c = false;
    if (o.crit !== false && Math.random() < critC()) { m *= critM(); c = true; }
    const arm = o.ign || s.b.lk > 0 ? 0 : (e.arm || 0);
    hurt(e, dmg * m * (1 - arm), c ? '#fff27a' : col, o.src);
    if (c) s.pt.push({ x: e.x, y: e.y - e.r, vx: 0, vy: -50, life: .5, max: .5, col: '#fff27a', size: 9, g: '✦' });
  }
  function hurt(e, dmg, col, src) {
    if (e.dead) return;
    const real = Math.min(dmg, Math.max(0, e.hp));
    e.hp -= dmg; e.flash = .08; burst(e.x, e.y, col || '#fff', 4, 90, .3, 2);
    if (src === 'conf') e.cfk = 1;
    if (s.ls > 0 && real > 0) s.p.hp = Math.min(s.p.max, s.p.hp + real * s.ls);
    if (e.hp <= 0) onKill(e);
  }
  function onKill(e) {
    e.dead = true; s.kills++; s.gems.push({ x: e.x, y: e.y, v: e.xp }); burst(e.x, e.y, e.col, e.boss ? 40 : 12, 160, .6, 3);
    if (ch.id === 'hyuna' && s.tr && s.tr.tier >= 1) { s.cs = Math.min(10, (s.cs || 0) + 1); s.csT = 4; }
    if ((e.el || e.boss) && ch.id === 'hyuna') prog('hyuna', 1);
    if (e.cfk && ch.id === 'luka') prog('luka', 1);
    if (e.boss || (e.el && Math.random() < .4)) s.hearts.push({ x: e.x, y: e.y, life: 16 });
    if (s.zone && hyp(e.x - s.zone.x, e.y - s.zone.y) < s.zone.R) { s.stk = Math.min(25, (s.stk || 0) + 1); s.p.hp = Math.min(s.p.max, s.p.hp + 1.5); s.pt.push({ x: s.p.x, y: s.p.y - 30, vx: 0, vy: -40, life: .6, max: .6, col: '#ff6a5c', size: 9, g: '+' }); }
    if (s.b.cl > 0 && s.swq.length < 60) s.swq.push({ x: e.x, y: e.y });
    if (s.rdm > 0) s.p.hp = Math.min(s.p.max, s.p.hp + 2.5);
    if (e.chmOn) e.chmOn = 0;
    if (e.boss) bossDown(e);
  }

  // ---------- dano no jogador ----------
  function dmgPlayer(dmg) {
    const p = s.p, hy = tier('hyuna');
    if (s.shield > 0) { s.shield = 0; p.inv = 1; burst(p.x, p.y, '#fff', 16, 200, .5, 3); s.fx.push({ x: p.x, y: p.y, r: 50, life: .3, col: '#ffffff' }); return; }
    if (s.imm > 0) return;
    if (s.absorb && s.absorb.t > 0) { s.absorb.amt += dmg; s.absorb.flash = .25; burst(p.x, p.y, PACC('hyuna'), 6, 160, .4, 3); return; }
    const sua = tier('sua') >= 1 ? .12 : 0;
    if (Math.random() < sua) { p.inv = .6; burst(p.x, p.y, PCOL('sua'), 10, 100, .5, 2); s.fx.push({ x: p.x, y: p.y, r: 32, life: .25, col: PCOL('sua') }); return; }
    let d = dmg * (s.b.rage > 0 ? 1.4 : 1) * (1 - drMul());
    if (hy >= 3 && p.hp - d <= p.max * .01 && s.t >= (s.lastStand || 0)) {      // O Sacrifício da Líder
      p.hp = Math.max(1, p.max * .01); s.lastStand = s.t + 90; s.imm = 4; s.b.sac = 4; s.sacEnd = 1; p.inv = 0;
      s.ban = { txt: 'O SACRIFÍCIO DA LÍDER', t: 1.6, max: 1.6, col: PACC('hyuna'), sub: 'CARTA · A FORÇA' }; s.fl = { col: PACC('hyuna'), t: .5, max: .5 }; s.shake = .6; return;
    }
    p.hp -= d; p.inv = .6; s.shake = .2; burst(p.x, p.y, '#ff2e88', 8, 140, .4, 3); s.hurtT = .35; s.cs = 0; s.csT = 0;
    if (map.id === 'karma') karmaWave(d);
  }
  function hitPlayer(e) { dmgPlayer(e.dmg); }

  // ---------- armas básicas ----------
  const shoot = (a, o) => { if (s.shots.length > 170) return; const sp = o.sp, p = s.p; s.shots.push({ x: o.x ?? p.x, y: o.y ?? p.y, a, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, sp, life: o.life ?? 1, d: o.d, pierce: o.pierce ?? 0, hit: new Set(), rot: Math.random() * 6,
    sh: o.sh, c: o.c, r: o.r ?? 7, kb: o.kb, slow: o.slow, psn: o.psn, bnc: o.bnc, grow: o.grow, mult: 1, exp: o.exp, hm: o.hm, ign: o.ign, ink: o.ink, chm: o.chm }); };
  const muzzle = (a, col) => burst(s.p.x + Math.cos(a) * 18, s.p.y + Math.sin(a) * 18, col, 5, 150, .22, 3);
  const slash = (x, y, R, d, col, o = {}) => s.eff.push({ t: -(o.delay || 0), life: .32, x, y, R, col, ccw: o.ccw, done: 0, follow: o.follow !== false,
    upd(e) { if (e.follow) { e.x = s.p.x; e.y = s.p.y; } if (!e.done && e.t >= .05) { e.done = 1; each(q => { hit(q, d, col, { ign: o.ign }); if (o.kb) knock(q, Math.atan2(q.y - e.y, q.x - e.x), o.kb); if (o.psn) poisonE(q, o.psn); }, q => hyp(q.x - e.x, q.y - e.y) < R + q.r); } },
    draw(e) { const k = Math.min(1, e.t / .26), f = 1 - e.t / .32, a0 = (o.ccw ? -1 : 1) * (-1.2 + k * 7.4);
      ctx.save(); ctx.translate(e.x, e.y); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (const [w, c, al] of [[30, col, .3], [14, col, .75], [4, '#ffffff', 1]]) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.globalAlpha = al * Math.min(1, f * 1.6); ctx.beginPath(); ctx.arc(0, 0, e.R, a0 - 3.2 * (o.ccw ? -1 : 1), a0, o.ccw); ctx.stroke(); }
      ctx.restore(); } });
  const WEAPONS = {
    // Hyuna: tiros rápidos e diretos
    pistol: { cd: lv => Math.max(.13, .3 - .028 * lv), fire(t, lv) { const p = s.p, a0 = ang2(p, t), n = 1 + Math.floor(lv / 3);
      for (let i = 0; i < n; i++) shoot(a0 + (i - (n - 1) / 2) * .07 + rnd(-.03, .03), { sp: 780, life: .7, d: (9 + 3.2 * lv) * Dw(), sh: 'bullet', c: PACC('hyuna') }); muzzle(a0, PACC('hyuna')); } },
    // Sua: pétalas que ricocheteiam
    petal: { cd: lv => Math.max(.32, .7 - .05 * lv), fire(t, lv) { const p = s.p, a0 = ang2(p, t), n = 1 + Math.floor(lv / 2);
      for (let i = 0; i < n; i++) shoot(a0 + (i - (n - 1) / 2) * .22, { sp: 400, life: 1.5, d: (11 + 3.5 * lv) * Dw(), bnc: 2 + Math.floor(lv / 2), sh: 'petal', c: i % 2 ? PACC('sua') : PCOL('sua') }); muzzle(a0, PCOL('sua')); } },
    // Ivan: golpes circulares de curto alcance (+ adaga em níveis altos)
    blade: { cd: lv => Math.max(.42, .85 - .06 * lv), fire(t, lv, en) { const p = s.p, R = 80 + 6 * lv, n = en || t;
      if (hyp(n.x - p.x, n.y - p.y) > R + 70) return false;     // o golpe circular dispara com inimigo por perto; a adaga vai para o cursor
      slash(p.x, p.y, R, (18 + 5 * lv) * Dw(), PCOL('ivan'), { kb: 30 });
      if (lv >= 3) slash(p.x, p.y, R * 1.2, (12 + 3 * lv) * Dw(), PACC('ivan'), { ccw: 1, delay: .16 });
      if (lv >= 2) shoot(ang2(p, t), { sp: 700, life: .55, d: (10 + 3 * lv) * Dw(), pierce: 1, sh: 'dagger', c: '#e8ecff' }); } },
    // Luka: ondas agudas que perfuram em linha reta
    violin: { cd: lv => Math.max(.4, .9 - .07 * lv), fire(t, lv) { const p = s.p, a0 = ang2(p, t), n = 1 + Math.floor(lv / 3);
      for (let i = 0; i < n; i++) shoot(a0 + (i - (n - 1) / 2) * .34, { sp: 540, life: .95, d: (12 + 4 * lv) * Dw(), pierce: 99, r: 16, sh: 'wave', c: PCOL('luka') }); muzzle(a0, PCOL('luka')); } },
    // Till: acordes pesados e caóticos que empurram
    chord: { cd: lv => Math.max(.46, .82 - .05 * lv), fire(t, lv) { const p = s.p, a0 = ang2(p, t), n = 1 + Math.floor(lv / 3);
      for (let i = 0; i < n; i++) shoot(a0 + (i - (n - 1) / 2) * .3 + rnd(-.22, .22), { sp: 310, life: .85, d: (15 + 4.5 * lv) * Dw(), pierce: 99, r: 24, kb: 70, sh: 'chord', c: PCOL('till') }); muzzle(a0, PCOL('till')); s.shake = Math.max(s.shake, .05); } },
    // Mizi: leque de luzes coloridas (fogos de artifício)
    stars: { cd: lv => Math.max(.4, .75 - .05 * lv), fire(t, lv) { const p = s.p, a0 = ang2(p, t), n = 3 + Math.min(6, lv), pal = ['#ff5fb0', '#6ec8ff', '#ffd23f', '#7dffb0', '#c07bff'];
      for (let i = 0; i < n; i++) shoot(a0 + (i - (n - 1) / 2) * .17, { sp: 390, life: rnd(.6, .85), d: (6.5 + 2.4 * lv) * Dw(), sh: 'spark', c: pal[i % 5], exp: 1 }); muzzle(a0, '#ff5fb0'); } },

    // ---- armas combinadas (sinergias) ----
    hyuna_luka: { cd: lv => Math.max(.14, .32 - .028 * lv), fire(t, lv) { const p = s.p, a0 = ang2(p, t), n = 1 + Math.floor(lv / 3);
      for (let i = 0; i < n; i++) shoot(a0 + (i - (n - 1) / 2) * .08, { sp: 700, life: .8, d: (11 + 3.6 * lv) * Dw(), pierce: 3, slow: 1.2, sh: 'note', c: '#a98bff' }); muzzle(a0, '#a98bff'); } },
    mizi_sua: { free: 1, cd: lv => Math.max(1, 1.7 - .08 * lv), fire(t, lv) { const p = s.p, pal = ['#ff5fb0', '#9fe3ff', '#c9b8ff', '#6ec8ff'];
      s.fx.push({ x: p.x, y: p.y, r: 150, life: .35, col: '#c9b8ff', follow: 1 });
      each(q => { hit(q, (9 + 3 * lv) * Dw(), '#c9b8ff'); poisonE(q, 7 * D()); }, q => hyp(q.x - p.x, q.y - p.y) < 150 + q.r);
      const off = rnd(0, 1); for (let i = 0; i < 8; i++) shoot(off + i * TAU / 8, { sp: 330, life: .8, d: (10 + 3 * lv) * Dw(), pierce: 1, psn: 7 * D(), sh: 'petal', c: pal[i % 4] }); } },
    till_ivan: { cd: lv => Math.max(.46, .82 - .05 * lv), fire(t, lv) { const p = s.p, a0 = ang2(p, t), n = 1 + Math.floor(lv / 3);
      for (let i = 0; i < n; i++) shoot(a0 + (i - (n - 1) / 2) * .3 + rnd(-.2, .2), { sp: 310, life: .9, d: (15 + 4.5 * lv) * Dw(), pierce: 99, r: 24, kb: 40, sh: 'chord', c: '#ff2e3a', ink: 1 });
      slash(p.x, p.y, 70 + 4 * lv, (14 + 4 * lv) * Dw(), PCOL('ivan'), { kb: 20 }); s.ink.push({ x: p.x, y: p.y, r: 54, life: 4, col: '#c4121e', slow: 1, dps: 14 * D() }); muzzle(a0, '#ff2e3a'); } },
    hyuna_mizi: { cd: lv => Math.max(.42, .8 - .05 * lv), fire(t, lv) { const p = s.p, a0 = ang2(p, t), pal = ['#ff5fb0', '#6ec8ff', '#ffd23f'];
      for (let i = -2; i <= 2; i++) { if (i % 2) shoot(a0 + i * .16, { sp: 560, life: .8, d: (8 + 2.8 * lv) * Dw(), pierce: 1, sh: 'spark', c: pal[(i + 3) % 3] }); else shoot(a0 + i * .16, { sp: 780, life: .7, d: (9 + 3.2 * lv) * Dw(), sh: 'bullet', c: PACC('hyuna') }); }
      s.gc = (s.gc || 0) + 1; if (s.gc % 3 === 0) grenade(p.x, p.y, t.x + rnd(-40, 40), t.y + rnd(-40, 40)); muzzle(a0, PACC('hyuna')); } },
    till_luka: { cd: lv => Math.max(.4, .78 - .05 * lv), fire(t, lv) { const p = s.p, a0 = ang2(p, t), n = 1 + Math.floor(lv / 3);
      for (let i = 0; i < n; i++) shoot(a0 + (i - (n - 1) / 2) * .3 + rnd(-.15, .15), { sp: 430, life: 1.6, d: (10 + 3.2 * lv) * Dw(), bnc: 4 + Math.floor(lv / 2), grow: 1.25, sh: i % 2 ? 'chord' : 'note', r: i % 2 ? 14 : 8, c: i % 2 ? PCOL('till') : PCOL('luka') }); muzzle(a0, PCOL('luka')); } }
  };
  function fire() {
    const w = WEAPONS[s.cmb ? s.cmb.id : ch.wid], lv = s.w.mic, p = s.p, en = near(p.x, p.y, s.en);
    if (!en && !w.free) return;
    let t = en;
    if (aim.on) { AP.x = p.x + (aim.x - W / 2); AP.y = p.y + (aim.y - H / 2); if (Math.abs(AP.x - p.x) + Math.abs(AP.y - p.y) < 2) AP.x += 2; t = AP; }   // ponto do mundo sob o cursor (a câmera é centrada no jogador)
    if (w.fire(t || p, lv, en) === false) { s.cd = .06; return; }
    s.cd = w.cd(lv) * ch.cdm / atkSpd();
  }

  function update(dt) {
    const p = s.p;
    if (s.dying > 0) { s.dying -= dt; stepFx(dt); if (s.dying <= 0) { s.over = true; cb.onEnd({ t: Math.floor(s.t), kills: s.kills, lv: p.lv, shards: Math.floor(s.kills / 4 + s.t / 8) + s.bonus, bonus: s.bonus, bosses: s.nb, cuse: s.cmbUse }); } return; }
    s.t += dt;
    for (const k in s.b) if (s.b[k] > 0) s.b[k] -= dt;
    s.sk.cd = Math.max(0, s.sk.cd - dt); s.sp.cd = Math.max(0, s.sp.cd - dt);
    s.imm = Math.max(0, s.imm - dt); s.pacify = Math.max(0, s.pacify - dt); s.freeze = Math.max(0, s.freeze - dt); s.ls = s.lsT > 0 ? s.ls : 0; s.lsT = Math.max(0, s.lsT - dt); s.rdm = Math.max(0, s.rdm - dt);
    if (s.absorb && s.absorb.t > 0) { s.absorb.t -= dt; s.absorb.flash = Math.max(0, (s.absorb.flash || 0) - dt); if (s.absorb.t <= 0) absorbEnd(); }
    if (s.csT > 0) { s.csT -= dt; if (s.csT <= 0) s.cs = 0; }
    if (s.rg && s.rg.t > 0) { s.rg.t -= dt; p.hp = Math.min(p.max, p.hp + s.rg.hps * dt); }
    if (s.sacEnd && s.b.sac <= 0) { s.sacEnd = 0; sacrificeEnd(); }
    s.shw = 0;
    let dx = (keys['d'] || keys['arrowright'] ? 1 : 0) - (keys['a'] || keys['arrowleft'] ? 1 : 0);
    let dy = (keys['s'] || keys['arrowdown'] ? 1 : 0) - (keys['w'] || keys['arrowup'] ? 1 : 0);
    if (touch) { const m = hyp(touch.dx, touch.dy); if (m > 8) { dx = touch.dx / m; dy = touch.dy / m; } }
    const m = hyp(dx, dy); s.mv = m > 0;
    if (m) { const sp = p.spd * spdMul() * dt; p.x += dx / m * sp; p.y += dy / m * sp; s.face = { x: dx / m, y: dy / m }; s.dist += sp; if (ch.id === 'till' && s.dist > 1000) { prog('till', Math.floor(s.dist / 1000)); s.dist %= 1000; } }
    s.lean += ((dx / (m || 1)) * .18 - s.lean) * Math.min(1, dt * 10);
    p.inv -= dt; s.shake = Math.max(0, s.shake - dt);
    if (p.hp / p.max < (ch.id === 'ivan' ? .2 : .25)) { s.lowT += dt; if (s.lowT >= 10) { s.lowT -= 10; if (ch.id === 'sua' || ch.id === 'ivan') prog(ch.id, 1); } }

    const fz = s.freeze > 0;
    s.spawn -= dt;
    if (!fz && s.spawn <= 0) { const n = Math.min(5, 1 + Math.floor(s.t / 40)); for (let i = 0; i < n; i++) spawnEnemy(); s.spawn = Math.max(.15, .65 - s.t / 400) * (s.bossE ? 1.8 : 1); }
    if (!fz && s.t > s.bossAt && !s.bossE) spawnBoss();
    s.warn = Math.max(0, s.warn - dt); s.hurtT = Math.max(0, s.hurtT - dt);

    s.cd -= dt; if (s.cd <= 0 && s.en.length) fire();
    for (const b of s.shots) {
      if (b.hm) { const t = near(b.x, b.y, s.en); if (t) { const want = Math.atan2(t.y - b.y, t.x - b.x); let d = want - b.a; d = Math.atan2(Math.sin(d), Math.cos(d)); b.a += d * Math.min(1, dt * b.hm); b.vx = Math.cos(b.a) * b.sp; b.vy = Math.sin(b.a) * b.sp; } }
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; b.rot += dt * 10;
      if (b.ink) { b.inkT = (b.inkT || 0) - dt; if (b.inkT <= 0 && s.ink.length < 140) { b.inkT = .07; s.ink.push({ x: b.x, y: b.y, r: 26, life: 4.2, col: '#c4121e', slow: 1, dps: 12 * D() }); } }
      trail(b);
      for (const e of s.en) if (!e.dead && !b.hit.has(e) && (e.x - b.x) ** 2 + (e.y - b.y) ** 2 < (e.r + b.r) ** 2) {
        b.hit.add(e); hit(e, b.d, b.c || ch.col, { mult: b.mult, ign: b.ign });
        if (b.kb) knock(e, b.a, b.kb); if (b.slow) slowE(e, b.slow, .4); if (b.psn) poisonE(e, b.psn);
        if (b.grow) b.mult = Math.min(3.5, b.mult * b.grow);
        if (tier('luka') >= 1 && !e.boss && !e.dead && Math.random() < .08) charm(e);
        if (b.bnc > 0) { const t = nearNot(b.x, b.y, b.hit, 320); b.bnc--; if (t) { b.a = Math.atan2(t.y - b.y, t.x - b.x); b.vx = Math.cos(b.a) * b.sp; b.vy = Math.sin(b.a) * b.sp; b.life = Math.max(b.life, .45); } else b.life = 0; break; }
        if (b.pierce-- <= 0) { b.life = 0; break; }
      }
      if (b.life <= 0 && b.exp) { burst(b.x, b.y, b.c, 8, 130, .35, 3); each(q => hurt(q, b.d * .5, b.c), q => (q.x - b.x) ** 2 + (q.y - b.y) ** 2 < (46 + q.r) ** 2); }
    }
    compact(s.shots, b => b.life > 0);

    if (s.w.wave) {
      s.waveT -= dt; const R = 50 + 15 * s.w.wave;
      if (s.waveT <= 0) { s.waveT = .5; s.fx.push({ x: p.x, y: p.y, r: R, life: .3, col: ch.col, follow: 1 });
        for (const e of s.en) if (hyp(e.x - p.x, e.y - p.y) < R + e.r) hurt(e, (6 + 3 * s.w.wave) * D(), ch.col); }
    }
    s.orb += dt * 2.6; s.orbs = [];
    for (let i = 0; i < s.w.orbit; i++) {
      const a = s.orb + i * TAU / s.w.orbit, o = { x: p.x + Math.cos(a) * 85, y: p.y + Math.sin(a) * 85 }; s.orbs.push(o);
      for (const e of s.en) if (e.hitCd <= 0 && hyp(e.x - o.x, e.y - o.y) < e.r + 10) { hurt(e, (10 + 3 * s.w.orbit) * D(), '#ffd23f'); e.hitCd = .5; }
    }
    s.flw = [];
    if (s.cmb && s.cmb.id === 'mizi_sua') {      // Flores de Anêmona: pétalas girando o tempo todo, cortando e envenenando
      const n = 3 + Math.min(5, Math.floor(s.w.mic / 2));
      for (let i = 0; i < n; i++) { const a = s.orb * .85 + i * TAU / n, r = 92 + 12 * Math.sin(s.t * 3 + i), o = { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, a }; s.flw.push(o);
        for (const e of s.en) if (!e.dead && e.hitCd <= 0 && hyp(e.x - o.x, e.y - o.y) < e.r + 16) { hit(e, (10 + 3 * s.w.mic) * Dw(), '#c9b8ff'); poisonE(e, 7 * D()); e.hitCd = .4; } }
    }

    // ---- inimigos (status, confusão, charme, ataques)
    for (const e of s.en) {
      if (e.dead) continue;
      e.hitCd -= dt; e.flash -= dt; e.sl -= dt; e.stun -= dt; e.frz -= dt; e.conf -= dt; e.chm -= dt; e.psn -= dt; e.brn -= dt;
      if (e.psn > 0 || e.brn > 0) { e.dt = (e.dt || 0) - dt; if (e.dt <= 0) { e.dt = .5; if (e.psn > 0) hurt(e, e.psd * .5, '#7dff9a'); if (e.brn > 0 && !e.dead) hurt(e, e.brd * .5, '#ff8a3c'); if (e.dead) continue; } }
      if (e.kx || e.ky) { e.x += e.kx * dt; e.y += e.ky * dt; const f = Math.pow(.02, dt); e.kx *= f; e.ky *= f; if (Math.abs(e.kx) + Math.abs(e.ky) < 8) e.kx = e.ky = 0; }
      if (e.chmOn && e.chm <= 0) { e.chmOn = 0; burst(e.x, e.y, '#b57bff', 18, 200, .5, 4); s.fx.push({ x: e.x, y: e.y, r: 90, life: .3, col: '#b57bff' }); each(q => { if (q !== e) hurt(q, 60 * D(), '#b57bff', 'chm'); }, q => hyp(q.x - e.x, q.y - e.y) < 90 + q.r); hurt(e, 1e9, '#b57bff'); continue; }
      if (fz || e.frz > 0 || e.stun > 0) continue;
      const fight = e.conf > 0 || e.chm > 0;
      let tx = p.x, ty = p.y;
      if (fight) { e.tgT = (e.tgT || 0) - dt; if (e.tgT <= 0 || !e.tg || e.tg.dead) { e.tgT = .45; e.tg = pickOther(e); } if (e.tg) { tx = e.tg.x; ty = e.tg.y; } }
      const a = Math.atan2(ty - e.y, tx - e.x), sl = e.sl > 0 ? (e.slf || .3) : 1; let mvm = 1;
      if (e.boss) { if (s.pacify <= 0) mvm = bossAI(e, dt); }
      else if (e.shoot !== undefined && !fight) { const d = hyp(p.x - e.x, p.y - e.y); e.shoot = Math.max(0, e.shoot - dt); if (s.pacify <= 0 && e.shoot <= 0 && d < 560) { e.shoot = 2.4 + Math.random(); eshot(e.x, e.y, a, 200, e.dmg, e.col, 6, 4); } mvm = d < 230 ? -.5 : d < 330 ? 0 : 1; }
      e.x += Math.cos(a) * e.spd * sl * mvm * dt; e.y += Math.sin(a) * e.spd * sl * mvm * dt;
      if (fight) { if (e.tg && !e.tg.dead && d2(e, e.tg) < (e.r + e.tg.r) ** 2) { e.ct = (e.ct || 0) - dt; if (e.ct <= 0) { e.ct = .35; hurt(e.tg, (e.chm > 0 ? 22 : 14) * D(), e.chm > 0 ? '#b57bff' : '#ff9be8', 'conf'); } } }
      else if (s.pacify <= 0 && p.inv <= 0 && hyp(e.x - p.x, e.y - p.y) < e.r + p.r) hitPlayer(e);
      if (tier('sua') >= 1 && !e.boss && hyp(e.x - p.x, e.y - p.y) < 58 + e.r) slowE(e, .5, .5);         // Véu de Segredos
    }
    compact(s.en, e => !e.dead && (e.boss || hyp(e.x - p.x, e.y - p.y) < 2500));
    if (!fz) {
      for (const b of s.eb) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; if (b.life > 0 && p.inv <= 0 && (b.x - p.x) ** 2 + (b.y - p.y) ** 2 < (b.r + p.r) ** 2) { b.life = 0; burst(b.x, b.y, b.col, 4, 90, .3, 2); dmgPlayer(b.dmg); } }
      for (const z of s.tz) { z.t += dt; if (!z.done && z.t >= z.delay) { z.done = 1; if (p.inv <= 0 && hyp(z.x - p.x, z.y - p.y) < z.r + p.r * .5) dmgPlayer(z.dmg); burst(z.x, z.y, z.col, z.pillar ? 22 : 16, 230, .6, 4); s.shake = Math.max(s.shake, .12); } }
    }
    compact(s.eb, b => b.life > 0 && (b.x - p.x) ** 2 + (b.y - p.y) ** 2 < 1600 * 1600);
    compact(s.tz, z => z.t < z.delay + .35);
    // poças (tinta, fogo): desaceleram e queimam
    s.inkT -= dt; const tk = s.inkT <= 0; if (tk) s.inkT = .25;
    for (const q of s.ink) { q.life -= dt; if (tk) for (const e of s.en) if (!e.dead && (e.x - q.x) ** 2 + (e.y - q.y) ** 2 < (q.r + e.r) ** 2) { if (q.slow) slowE(e, .4, .35); if (q.dps) hurt(e, q.dps * .25, q.col); } }
    compact(s.ink, q => q.life > 0);
    // ondas de choque enfileiradas (Clímax da 7ª Rodada)
    for (let i = 0; i < 8 && s.swq.length; i++) { const q = s.swq.shift(); s.fx.push({ x: q.x, y: q.y, r: 110, life: .25, col: PCOL('luka') }); burst(q.x, q.y, PACC('luka'), 6, 200, .3, 3); each(e => hurt(e, 26 * D(), PCOL('luka')), e => (e.x - q.x) ** 2 + (e.y - q.y) ** 2 < (110 + e.r) ** 2); }
    stepFx(dt);
    for (const e of s.eff) { e.t += dt; if (e.t >= 0 && e.upd) e.upd(e, dt); } compact(s.eff, e => e.t < e.life);
    for (const e of s.ov) e.t += dt; compact(s.ov, e => e.t < e.life);
    mapTick(dt); tarotTick(dt);
    for (const h of s.hearts) { h.life -= dt; if (hyp(h.x - p.x, h.y - p.y) < p.r + 16) { h.got = 1; p.hp = Math.min(p.max, p.hp + p.max * .12); burst(h.x, h.y, '#ffd6ec', 12, 150, .5, 3); if (ch.id === 'sua') prog('sua', 1); } }
    compact(s.hearts, h => !h.got && h.life > 0);

    const mr = s.b.hr > 0 ? 700 : 70 + p.mag * 60;
    for (const g of s.gems) {
      const d = hyp(p.x - g.x, p.y - g.y) || 1;
      if (d < mr) { g.x += (p.x - g.x) / d * 320 * dt; g.y += (p.y - g.y) / d * 320 * dt; }
      if (d < p.r + 6) { g.got = true; p.xp += g.v * s.xpm; s.gemN++; if (ch.id === 'mizi') { prog('mizi', 1); if (tier('mizi') >= 1 && s.gemN % 5 === 0) p.hp = Math.min(p.max, p.hp + 2 + p.max * .01); } }
    }
    compact(s.gems, g => !g.got);
    if (p.xp >= p.next) { p.xp -= p.next; p.lv++; p.next = Math.floor(p.next * 1.45 + 3); levelUp(); burst(p.x, p.y, '#ffd23f', 24, 220, .7, 3); }

    if (p.hp <= 0) { s.dying = 1.4; deathFx(); s.shake = .5; }
  }
  const nearNot = (x, y, set, R) => { let best = null, bd = R * R; for (const e of s.en) { if (e.dead || set.has(e)) continue; const d = (e.x - x) ** 2 + (e.y - y) ** 2; if (d < bd) { bd = d; best = e; } } return best; };
  const charm = e => { if (e.chmOn) return; e.chm = 4; e.chmOn = 1; e.tg = null; burst(e.x, e.y, '#b57bff', 10, 120, .4, 3); };

  // ---------- habilidades ativas (uma por personagem) ----------
  const glow = (col, b = 18) => { ctx.shadowColor = col; ctx.shadowBlur = b; };
  const ez = x => 1 - Math.pow(1 - x, 3);
  function star4(x, y, r, rot = 0) { ctx.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * .2 : r, a = rot + i * Math.PI / 4; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); }
  const ring = (x, y, r, col, w, a) => { if (a <= 0) return; ctx.globalAlpha = Math.min(1, a); ctx.strokeStyle = col; ctx.lineWidth = Math.max(.5, w); ctx.beginPath(); ctx.arc(x, y, Math.max(.1, r), 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; };
  const spark = (x, y, col, n, sp, life, size) => { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = sp * (.3 + Math.random()); s.pt.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (.6 + Math.random() * .4), max: life, col, size, g: '*' }); } };
  const jit = (i, sd) => Math.sin(i * 12.9898 + sd * 78.233) * 43758.5453 % 1;
  // ---------- utilidades visuais e de área ----------
  const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
  const nearLine = (e, cx, cy, th, w) => Math.abs((e.x - cx) * Math.sin(th) - (e.y - cy) * Math.cos(th)) < w / 2 + e.r;
  function beamFx(cx, cy, th, w, col, life, o = {}) {      // feixe infinito (usado em cruzes)
    s.eff.push({ t: 0, life, x: cx, y: cy, draw(e) { const k = e.t / life, g = k < .15 ? k / .15 : 1 - (k - .15) / .85, ww = w * (k < .12 ? ez(k / .12) : 1) * (1 - Math.max(0, k - .6) * 1.2);
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(th); ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, g) * .45; ctx.fillStyle = col; ctx.fillRect(-3200, -ww * .85, 6400, ww * 1.7);
      ctx.globalAlpha = Math.max(0, g) * .9; ctx.fillStyle = o.core || '#fff'; ctx.fillRect(-3200, -ww * .22, 6400, ww * .44); ctx.restore(); } });
  }
  function crossFx(cx, cy, diag, w, col, life, core) { const a = diag ? Math.PI / 4 : 0; beamFx(cx, cy, a, w, col, life, { core }); beamFx(cx, cy, a + Math.PI / 2, w, col, life, { core }); spark(cx, cy, col, 30, 380, .8, 5); s.shake = Math.max(s.shake, .5); }
  // golpe em cruz: comuns morrem; elites menores morrem; elites tanque e chefes sofrem uma fração da vida
  function crossHit(cx, cy, diag, w, boss) {
    const a = diag ? Math.PI / 4 : 0;
    each(e => { if (e.boss) hurt(e, e.maxhp * boss, '#fff'); else if (e.el && e.kind === 'tank') hurt(e, e.maxhp * .7, '#fff'); else hurt(e, 1e9, '#fff'); }, e => nearLine(e, cx, cy, a, w) || nearLine(e, cx, cy, a + Math.PI / 2, w));
  }
  const timeStopOv = life => s.ov.push({ t: 0, life, draw(e) { const k = e.t / life, a = Math.min(1, e.t / .25, (life - e.t) / .4);
    ctx.save(); ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = .88 * a; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = .28 * a; ctx.fillStyle = '#1a0008'; ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, Math.max(W, H) * .75); g.addColorStop(0, 'rgba(255,40,70,0)'); g.addColorStop(1, 'rgba(255,40,70,.55)'); ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = a * .5; ctx.strokeStyle = '#ff7a8c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.min(W, H) * .22, 0, TAU); ctx.stroke();
    for (let i = 0; i < 12; i++) { const an = i * TAU / 12; ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(an) * Math.min(W, H) * .2, H / 2 + Math.sin(an) * Math.min(W, H) * .2); ctx.lineTo(W / 2 + Math.cos(an) * Math.min(W, H) * .23, H / 2 + Math.sin(an) * Math.min(W, H) * .23); ctx.stroke(); }
    ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(W / 2, H / 2); ctx.lineTo(W / 2 + Math.cos(-1.57 + k * TAU * 3) * Math.min(W, H) * .18, H / 2 + Math.sin(-1.57 + k * TAU * 3) * Math.min(W, H) * .18); ctx.stroke(); ctx.restore(); } });

  // ---------- granada de fumaça e fomento (Hyuna) ----------
  function grenade(x0, y0, tx, ty) {
    const T = .55, acc = PACC('hyuna');
    s.eff.push({ t: 0, life: T, upd(e) { if (e.t >= T - .03 && !e.done) { e.done = 1; smokeBurst(tx, ty); } },
      draw(e) { const k = e.t / T, gx = x0 + (tx - x0) * k, gy = y0 + (ty - y0) * k; ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(gx, gy + 6, 8, 3, 0, 0, TAU); ctx.fill();
        ctx.save(); ctx.translate(gx, gy - Math.sin(k * Math.PI) * 70); ctx.rotate(e.t * 14); ctx.fillStyle = '#58627a'; ctx.fillRect(-5, -8, 10, 16); ctx.fillStyle = acc; ctx.fillRect(-5, -3, 10, 4); ctx.restore(); } });
  }
  function smokeBurst(x, y) {
    const R = 125, acc = PACC('hyuna'), col = PCOL('hyuna');
    spark(x, y, acc, 16, 260, .6, 4); s.shake = Math.max(s.shake, .12);
    each(e => { stunE(e, 2.2); hurt(e, 14 * D(), acc); }, e => hyp(e.x - x, e.y - y) < R + e.r);
    s.eff.push({ t: 0, life: 5, x, y, puffs: Array.from({ length: 16 }, () => ({ a: rnd(0, TAU), r: rnd(.15, .95), s: rnd(.6, 1.2), p: rnd(0, 6) })),
      upd(e, dt) { const q = s.p; if (hyp(q.x - x, q.y - y) < R) { q.hp = Math.min(q.max, q.hp + q.max * .04 * dt); if (Math.random() < dt * 8) s.pt.push({ x: q.x + rnd(-14, 14), y: q.y + rnd(-10, 22), vx: 0, vy: -44, life: .6, max: .6, col: '#7dffb0', size: 9, g: '+' }); }
        each(o => slowE(o, .3, .6), o => hyp(o.x - x, o.y - y) < R + o.r); },
      draw(e) { const f = Math.min(1, e.t / .3) * Math.min(1, (5 - e.t) / 1); ctx.save();
        for (const q of e.puffs) { const rr = R * (.28 + .14 * Math.sin(e.t * 1.4 + q.p)) * q.s * Math.min(1, .4 + e.t), px = x + Math.cos(q.a + e.t * .25) * R * q.r * .75, py = y + Math.sin(q.a + e.t * .25) * R * q.r * .6; const g = ctx.createRadialGradient(px, py, 2, px, py, rr); g.addColorStop(0, 'rgba(170,185,215,.55)'); g.addColorStop(1, 'rgba(120,140,185,0)'); ctx.globalAlpha = f; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, rr, 0, TAU); ctx.fill(); }
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = f * (.5 + .3 * Math.sin(e.t * 9)); const fg = ctx.createRadialGradient(x, y, 2, x, y, 34); fg.addColorStop(0, '#fff3b0'); fg.addColorStop(.4, acc); fg.addColorStop(1, 'rgba(255,160,40,0)'); ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(x, y, 34, 0, TAU); ctx.fill();
        ctx.globalAlpha = f * .7; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([8, 8]); ctx.lineDashOffset = -e.t * 20; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.stroke(); ctx.restore(); } });
  }
  function absorbEnd() {
    const p = s.p, amt = s.absorb.amt, col = PCOL('hyuna'), acc = PACC('hyuna'); s.absorb = null;
    s.shake = .9; s.fl = { col: acc, t: .6, max: .6 }; s.eb = []; s.tz = [];
    each(e => { if (e.boss || e.el) hurt(e, 350 + amt * 2.5, acc); else hurt(e, 1e9, col); }, e => onScr(e, 80));
    s.b.hy = 8; for (let i = 0; i < 4; i++) s.fx.push({ x: p.x, y: p.y, r: 120 + i * 150, life: .45 + i * .2, col: i % 2 ? acc : col }); burst(p.x, p.y, acc, 50, 520, .9, 5);
    s.ban = { txt: 'ONDA DE CHOQUE', t: 1.2, max: 1.2, col: acc, sub: 'VELOCIDADE E ATAQUE AUMENTADOS' };
    s.eff.push({ t: 0, life: .7, x: p.x, y: p.y, draw(e) { const k = e.t / .7, R = ez(k) * hyp(W, H) * .6; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ring(e.x, e.y, R, acc, 26 * (1 - k), 1 - k); ring(e.x, e.y, R * .85, col, 14 * (1 - k), (1 - k) * .8); ctx.restore(); } });
  }
  function sacrificeEnd() {       // fim de O Sacrifício da Líder: limpa a tela
    const p = s.p, acc = PACC('hyuna'); s.shake = .8; s.fl = { col: acc, t: .5, max: .5 }; s.eb = [];
    each(e => { if (e.boss || e.el) hurt(e, 300, acc); else hurt(e, 1e9, acc); }, e => onScr(e, 60)); for (let i = 0; i < 3; i++) s.fx.push({ x: p.x, y: p.y, r: 140 + i * 160, life: .5 + i * .2, col: acc });
  }

  // ================= ESPECIAIS (tecla E / Q) =================
  const SPECIAL = {
    // Hyuna — Liderança Protetora: granadas de fumaça e fomento que atordoam e regeneram
    hyuna(p) { const ts = s.en.filter(e => !e.dead).sort((a, b) => d2(a, p) - d2(b, p)).slice(0, 3);
      for (let i = 0; i < 3; i++) { const t = ts[i], a = rnd(0, TAU), tx = t ? t.x : p.x + Math.cos(a) * 150, ty = t ? t.y : p.y + Math.sin(a) * 150; later(i * .13, () => grenade(s.p.x, s.p.y, tx, ty)); } },
    // Sua — Vingança Evasiva: barreira de vidro que repele e congela
    sua(p) { const col = PCOL('sua'), R = 98, life = 5.4;
      s.eff.push({ t: 0, life, upd(e) { const q = s.p;
          each(o => { if ((o.gc || 0) <= s.t) { o.gc = s.t + .9; freezeE(o, 1.4); hurt(o, 9 * D(), col); knock(o, Math.atan2(o.y - q.y, o.x - q.x), 60); burst(o.x, o.y, '#fff', 8, 170, .4, 3); } }, o => hyp(o.x - q.x, o.y - q.y) < R + o.r);
          for (const b of s.eb) if (hyp(b.x - q.x, b.y - q.y) < R + 6) { b.life = 0; burst(b.x, b.y, '#fff', 5, 120, .3, 2); } },
        draw(e) { const q = s.p, f = Math.min(1, e.t / .3, (life - e.t) / .6); ctx.save(); ctx.translate(q.x, q.y - 4); ctx.globalAlpha = f;
          const mg = ctx.createRadialGradient(0, 0, R * .6, 0, 0, R * 1.15); mg.addColorStop(0, 'rgba(200,235,255,0)'); mg.addColorStop(1, 'rgba(200,235,255,.35)'); ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(0, 0, R * 1.15, 0, TAU); ctx.fill();
          for (let i = 0; i < 8; i++) { const a = e.t * .9 + i * TAU / 8; ctx.save(); ctx.rotate(a); ctx.translate(R, 0);
            const gg = ctx.createLinearGradient(-8, -34, 14, 34); gg.addColorStop(0, 'rgba(255,255,255,.75)'); gg.addColorStop(.5, 'rgba(160,220,255,.28)'); gg.addColorStop(1, 'rgba(200,190,255,.5)');
            ctx.fillStyle = gg; ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-4, -34); ctx.lineTo(10, -22); ctx.lineTo(8, 30); ctx.lineTo(-6, 36); ctx.lineTo(-10, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-2, -26); ctx.lineTo(4, 14); ctx.moveTo(2, -10); ctx.lineTo(-6, 20); ctx.stroke(); ctx.restore(); }
          ctx.globalCompositeOperation = 'lighter'; ring(0, 0, R, '#e6f6ff', 3, .8 * f); ring(0, 0, R + 10, col, 6, .3 * f); ctx.restore(); } }); },
    // Ivan — Sorriso Fatalista: escudo invulnerável que explode em espinhos vermelhos
    ivan(p) { const col = PCOL('ivan'), acc = PACC('ivan'); s.imm = Math.max(s.imm, 3);
      s.eff.push({ t: 0, life: 3.6, boom: 0,
        upd(e) { if (!e.boom && e.t >= 3) { e.boom = 1; const q = s.p; s.shake = .55; s.fl = { col, t: .35, max: .35 }; each(o => { hit(o, (70 + 10 * s.w.mic) * D(), col, { crit: false }); knock(o, Math.atan2(o.y - q.y, o.x - q.x), 70); }, o => hyp(o.x - q.x, o.y - q.y) < 215 + o.r); burst(q.x, q.y, col, 40, 340, .8, 4); for (const b of s.eb) if (hyp(b.x - q.x, b.y - q.y) < 260) b.life = 0; } },
        draw(e) { const q = s.p; ctx.save(); ctx.translate(q.x, q.y - 4);
          if (e.t < 3) { const pul = 1 + .05 * Math.sin(e.t * 12), R = 62 * pul, g = ctx.createRadialGradient(0, 0, 8, 0, 0, R); g.addColorStop(0, 'rgba(255,40,80,.05)'); g.addColorStop(1, 'rgba(255,40,80,.5)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
            ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke(); ctx.globalCompositeOperation = 'lighter'; ring(0, 0, R + 6, acc, 2, .6);
            ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.arc(0, -4, R * .55, .25, Math.PI - .25); ctx.stroke();     // o sorriso
            ctx.fillStyle = '#fff'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * R * .3, R * .22); ctx.lineTo(sx * R * .3 + 4, R * .22 + 9); ctx.lineTo(sx * R * .3 - 4, R * .22 + 2); ctx.fill(); }
            ctx.strokeStyle = acc; ctx.lineWidth = 1.5; const r3 = e.t / 3; ctx.beginPath(); ctx.arc(0, 0, R + 16, -1.57, -1.57 + TAU * (1 - r3)); ctx.stroke(); }
          else { const k = (e.t - 3) / .6, L = 215 * ez(Math.min(1, k * 3)), a = Math.max(0, 1 - k); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
            for (let i = 0; i < 22; i++) { const an = i * TAU / 22 + .1, ln = L * (i % 2 ? .75 : 1); ctx.save(); ctx.rotate(an); ctx.fillStyle = i % 3 ? col : acc; ctx.beginPath(); ctx.moveTo(24, -9); ctx.lineTo(ln, 0); ctx.lineTo(24, 9); ctx.closePath(); ctx.fill(); ctx.restore(); }
            ring(0, 0, L, '#fff', 5, a); }
          ctx.restore(); } }); },
    // Luka — Manipulação Psicológica: alucinações fazem os monstros brigarem entre si
    luka(p) { const col = PCOL('luka'), acc = PACC('luka');
      each(e => { e.conf = e.boss ? 1.4 : 4.5; e.tg = null; }, e => hyp(e.x - p.x, e.y - p.y) < 460 + e.r);
      s.fl = { col, t: .4, max: .4 };
      s.eff.push({ t: 0, life: .9, draw(e) { const q = s.p, k = e.t / .9; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ring(q.x, q.y, ez(k) * 470, col, 8 * (1 - k), 1 - k); ring(q.x, q.y, ez(k) * 400, acc, 3, (1 - k) * .8);
        ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.globalAlpha = (1 - k) * .8; ctx.beginPath(); for (let i = 0; i < 120; i++) { const a = i * .22 + k * 8, r = ez(k) * 470 * (i / 120); ctx.lineTo(q.x + Math.cos(a) * r, q.y + Math.sin(a) * r); } ctx.stroke(); ctx.restore(); } }); },
    // Till — Fúria Indisciplinada: adrenalina e tinta; ataca e critica muito mais, mas defende menos
    till(p) { s.b.rage = 6; const col = PCOL('till'); s.fl = { col, t: .35, max: .35 }; s.shake = .4;
      each(e => knock(e, Math.atan2(e.y - p.y, e.x - p.x), 45), e => hyp(e.x - p.x, e.y - p.y) < 160 + e.r);
      s.eff.push({ t: 0, life: 6, upd(e, dt) { const q = s.p; if (Math.random() < dt * 40) s.pt.push({ x: q.x + rnd(-16, 16), y: q.y + rnd(-6, 26), vx: rnd(-50, 50), vy: rnd(-140, -50), life: .6, max: .6, col: Math.random() < .5 ? '#ff2a2a' : '#1a0000', size: rnd(4, 9) }); },
        draw(e) { const q = s.p, f = Math.min(1, e.t / .2, (6 - e.t) / .5); ctx.save(); ctx.translate(q.x, q.y + 6); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = f * .8;
          for (let i = 0; i < 12; i++) { const a = i * TAU / 12, fl = 26 + 14 * Math.sin(e.t * 14 + i * 2.1); ctx.fillStyle = i % 2 ? '#ff3030' : '#ff8a4c'; ctx.save(); ctx.rotate(a - 1.57 + Math.sin(e.t * 9 + i) * .15); ctx.translate(0, -34); ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(0, -fl, 6, 0); ctx.fill(); ctx.restore(); }
          ring(0, -12, 46, '#ff4d4d', 3, f * .6); ctx.restore(); } }); },
    // Mizi — Lágrimas de Esperança: chuva celestial que desacelera tudo e cura
    mizi(p) { const col = PCOL('mizi'), acc = PACC('mizi'), life = 4.4;
      s.eff.push({ t: 0, life, upd(e, dt) { each(o => slowE(o, .3, .15), o => onScr(o, 200)); const q = s.p; q.hp = Math.min(q.max, q.hp + q.max * .12 / life * dt); } });
      const seed = Array.from({ length: 80 }, () => ({ x: Math.random(), sp: rnd(.35, .8), o: Math.random(), k: (Math.random() * 3) | 0, s: rnd(.6, 1.4) }));
      s.ov.push({ t: 0, life, draw(e) { const f = Math.min(1, e.t / .5, (life - e.t) / .7); ctx.save(); const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(110,200,255,.28)'); g.addColorStop(1, 'rgba(255,95,176,.16)'); ctx.globalAlpha = f; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'lighter';
        for (const d of seed) { const y = ((e.t * d.sp + d.o) % 1.15) * (H + 80) - 40, x = d.x * W + Math.sin(e.t * 1.5 + d.o * 9) * 14; ctx.globalAlpha = f * .9;
          if (d.k === 0) { ctx.fillStyle = acc; ctx.beginPath(); ctx.moveTo(x, y - 12 * d.s); ctx.quadraticCurveTo(x + 6 * d.s, y + 2, x, y + 7 * d.s); ctx.quadraticCurveTo(x - 6 * d.s, y + 2, x, y - 12 * d.s); ctx.fill(); }
          else if (d.k === 1) { ctx.fillStyle = col; ctx.save(); ctx.translate(x, y); ctx.rotate(e.t * 2 + d.o * 6); ctx.beginPath(); ctx.ellipse(0, 0, 9 * d.s, 4 * d.s, 0, 0, TAU); ctx.fill(); ctx.restore(); }
          else { ctx.fillStyle = '#fff6c8'; star4(x, y, 7 * d.s, e.t * 3 + d.o); ctx.fill(); } }
        ctx.restore(); } }); }
  };

  // ================= ULTIMATES (tecla ESPAÇO / R) =================
  const ULT = {
    // Hyuna — Sacrifício Final: absorve dano e depois detona uma onda de choque
    hyuna(p) { s.absorb = { t: 4, amt: 0, flash: 0 }; const col = PCOL('hyuna'), acc = PACC('hyuna');
      s.eff.push({ t: 0, life: 4.2, draw(e) { if (!s.absorb) return; const q = s.p, R = 70 + 5 * Math.sin(e.t * 10), cr = Math.min(16, s.absorb.amt / 20), fl = s.absorb.flash > 0; ctx.save(); ctx.translate(q.x, q.y - 4);
          const g = ctx.createRadialGradient(0, 0, 10, 0, 0, R); g.addColorStop(0, fl ? 'rgba(255,255,255,.6)' : 'rgba(77,134,255,.1)'); g.addColorStop(1, fl ? 'rgba(255,240,150,.8)' : 'rgba(77,134,255,.55)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
          ctx.strokeStyle = fl ? '#fff' : acc; ctx.lineWidth = 3; ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5; for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + e.t * .5; ctx.beginPath(); ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R); ctx.lineTo(Math.cos(a + 1.05) * R, Math.sin(a + 1.05) * R); ctx.stroke(); }
          ctx.strokeStyle = acc; ctx.lineWidth = 2.5; for (let i = 0; i < cr; i++) { const a = jit(i, 3) * TAU, r0 = R * .2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); for (let k = 1; k <= 4; k++) ctx.lineTo(Math.cos(a + jit(i + k, 5) * .5) * (r0 + (R - r0) * k / 4), Math.sin(a + jit(i + k, 5) * .5) * (r0 + (R - r0) * k / 4)); ctx.stroke(); }
          ctx.fillStyle = acc; ctx.globalAlpha = .8; ctx.font = '700 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('ABSORVENDO ' + Math.round(s.absorb.amt), 0, -R - 10); ctx.restore(); } }); },
    // Sua — Canto Compartilhado: ilusão de palco; ninguém ataca e todos sofrem angústia; Sua se cura
    sua(p) { s.pacify = 6; s.eb = []; s.tz = []; s.ls = .45; s.lsT = 6; const col = PCOL('sua'), acc = PACC('sua');
      s.eff.push({ t: 0, life: 6.2, tk: 0,
        upd(e, dt) { e.tk -= dt; if (e.tk <= 0) { e.tk = .5; each(o => { hurt(o, (22 + 2 * s.w.mic) * D() * (o.boss ? .45 : 1), '#d9c8ff'); if (Math.random() < .5) s.pt.push({ x: o.x, y: o.y - o.r, vx: rnd(-12, 12), vy: 30, life: .7, max: .7, col: '#cfe6ff', size: 6 }); }, o => onScr(o, 40)); } },
        draw(e) { const q = s.p, f = Math.min(1, e.t / .5, (6.2 - e.t) / .6); ctx.save(); ctx.globalAlpha = f * .55; const cg = ctx.createLinearGradient(0, q.y - 900, 0, q.y + 30); cg.addColorStop(0, 'rgba(255,255,255,0)'); cg.addColorStop(1, 'rgba(235,245,255,.9)'); ctx.fillStyle = cg;
          ctx.beginPath(); ctx.moveTo(q.x - 40, q.y - 900); ctx.lineTo(q.x + 40, q.y - 900); ctx.lineTo(q.x + 250, q.y + 20); ctx.lineTo(q.x - 250, q.y + 20); ctx.fill();
          ctx.globalAlpha = f; const fg = ctx.createRadialGradient(q.x, q.y + 24, 20, q.x, q.y + 24, 270); fg.addColorStop(0, 'rgba(255,255,255,.55)'); fg.addColorStop(1, 'rgba(180,200,255,0)'); ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(q.x, q.y + 24, 270, 90, 0, 0, TAU); ctx.fill();
          for (let i = 0; i < 18; i++) { const a = e.t * .4 + i * TAU / 18, rr = 120 + 90 * ((i * 37) % 10) / 10, px = q.x + Math.cos(a) * rr, py = q.y + 24 + Math.sin(a) * rr * .33 - ((e.t * 20 + i * 11) % 60); ctx.fillStyle = i % 2 ? '#fff' : acc; ctx.save(); ctx.translate(px, py); ctx.rotate(e.t + i); ctx.beginPath(); ctx.ellipse(0, 0, 8, 3.5, 0, 0, TAU); ctx.fill(); ctx.restore(); }
          ctx.restore(); } });
      s.ov.push({ t: 0, life: 6.2, draw(e) { const f = Math.min(1, e.t / .6, (6.2 - e.t) / .6); ctx.save(); ctx.globalAlpha = f * .5; ctx.fillStyle = '#0a0a22'; ctx.fillRect(0, 0, W, H);
        for (const sx of [0, 1]) { const cw = Math.min(160, W * .14); ctx.globalAlpha = f * .85; const cg = ctx.createLinearGradient(sx ? W - cw : 0, 0, sx ? W : cw, 0); cg.addColorStop(sx ? 1 : 0, '#5a1a4a'); cg.addColorStop(sx ? 0 : 1, 'rgba(90,26,74,0)'); ctx.fillStyle = cg; ctx.fillRect(sx ? W - cw : 0, 0, cw, H);
          ctx.strokeStyle = 'rgba(255,170,220,.25)'; ctx.lineWidth = 2; for (let i = 1; i < 6; i++) { const x = sx ? W - cw * i / 6 : cw * i / 6; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + (sx ? -8 : 8), H); ctx.stroke(); } }
        ctx.restore(); } }); },
    // Ivan — O Beijo da Despedida: sacrifica metade da vida; tempo congelado; cruz de tela inteira
    ivan(p) { p.hp = Math.max(1, p.hp * .5); prog('ivan', 1); s.freeze = 4; s.eb = []; const col = PCOL('ivan'), cx = p.x, cy = p.y; timeStopOv(4);
      s.ban = { txt: 'O BEIJO DA DESPEDIDA', t: 1.6, max: 1.6, col, sub: 'O TEMPO PAROU' };
      s.eff.push({ t: 0, life: 4, a: 0, b: 0, upd(e) { if (!e.a && e.t >= .8) { e.a = 1; crossFx(cx, cy, 0, 90, col, .9); crossHit(cx, cy, 0, 90, .18); } if (!e.b && e.t >= 3.5) { e.b = 1; crossFx(cx, cy, 1, 110, col, .9); crossHit(cx, cy, 1, 110, .22); } }, draw() {} }); },
    // Luka — Síndrome de Luka: coração acelerado, velocidade extrema e projéteis roxos teleguiados
    luka(p) { s.b.lk = 8; const col = PCOL('luka'), acc = PACC('luka');
      s.eff.push({ t: 0, life: 8, tk: 0, gt: 0, upd(e, dt) { e.tk -= dt; if (e.tk <= 0) { e.tk = .11; for (let i = 0; i < 3; i++) shoot(rnd(0, TAU), { sp: 430, life: 2.2, d: 15 * D(), hm: 7, r: 9, sh: 'orb', c: '#a56bff', ign: 1 }); }
          e.gt -= dt; if (e.gt <= 0) { e.gt = .05; s.gh.push({ x: s.p.x, y: s.p.y, life: .35, max: .35, lean: s.lean }); } }, draw() {} });
      const bps = 2.8;
      s.ov.push({ t: 0, life: 8, draw(e) { const f = Math.min(1, e.t / .4, (8 - e.t) / .6), ph = (e.t * bps) % 1, beat = Math.exp(-ph * 9) + .55 * Math.exp(-Math.abs(ph - .22) * 14); ctx.save();
        const g = ctx.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, Math.max(W, H) * .7); g.addColorStop(0, 'rgba(181,123,255,0)'); g.addColorStop(1, 'rgba(255,40,120,.9)'); ctx.globalAlpha = f * (.18 + .4 * beat); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = f; ctx.strokeStyle = acc; ctx.lineWidth = 2.5; ctx.shadowColor = col; ctx.shadowBlur = 8; const x0 = W - 320, y0 = 84; ctx.beginPath();
        for (let i = 0; i <= 120; i++) { const u = (e.t * bps - i / 120 * 1.4), pp = ((u % 1) + 1) % 1, yy = Math.exp(-pp * 30) * -28 + (Math.abs(pp - .2) < .035 ? 12 : 0) * (pp > .2 ? -1 : 1); ctx.lineTo(x0 + i * 2, y0 + yy); } ctx.stroke(); ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff'; ctx.font = '800 12px ' + FONT; ctx.textAlign = 'left'; ctx.fillText('♥ ' + Math.round(150 + 40 * beat) + ' BPM', x0, y0 + 26); ctx.restore(); } }); },
    // Till — Transfusão Caótica: zona de fogo e tinta que consome inimigos e fortalece Till
    till(p) { s.stk = 0; const col = PCOL('till');
      s.eff.push({ t: 0, life: 8.4, R: 200, tk: 0, x: p.x, y: p.y, blobs: Array.from({ length: 16 }, () => ({ a: rnd(0, TAU), r: rnd(.3, 1), s: rnd(10, 34) })),
        upd(e, dt) { e.x = s.p.x; e.y = s.p.y; s.zone = e; if (e.t >= 8) { s.zone = null; s.stk = 0; return; } e.tk -= dt;
          if (e.tk <= 0) { e.tk = .25; each(o => { hurt(o, (34 + 3 * s.w.mic) * D() * (o.boss ? .35 : 1), '#ff4d4d'); burnE(o, 18 * D(), 1); }, o => hyp(o.x - e.x, o.y - e.y) < e.R + o.r); }
          if (Math.random() < dt * 30) { const a = rnd(0, TAU), r = Math.sqrt(Math.random()) * e.R; s.pt.push({ x: e.x + Math.cos(a) * r, y: e.y + Math.sin(a) * r, vx: 0, vy: rnd(-110, -50), life: .7, max: .7, col: Math.random() < .5 ? '#ff4d1c' : '#ffb347', size: rnd(4, 8) }); } },
        draw(e) { const f = Math.min(1, e.t / .4, (8.4 - e.t) / .5); ctx.save(); ctx.translate(e.x, e.y + 18); ctx.scale(1, .55); ctx.globalAlpha = f;
          const g = ctx.createRadialGradient(0, 0, 20, 0, 0, e.R); g.addColorStop(0, 'rgba(140,10,20,.85)'); g.addColorStop(.7, 'rgba(120,8,18,.6)'); g.addColorStop(1, 'rgba(120,8,18,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, e.R, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(30,0,4,.8)'; for (const b of e.blobs) { ctx.beginPath(); ctx.ellipse(Math.cos(b.a) * e.R * b.r * .85, Math.sin(b.a) * e.R * b.r * .85, b.s, b.s * .7, b.a, 0, TAU); ctx.fill(); }
          ctx.globalCompositeOperation = 'lighter'; ring(0, 0, e.R, '#ff5a3c', 4, .8 * f); ring(0, 0, e.R * .98 + Math.sin(e.t * 5) * 4, '#ffb347', 2, .5 * f); ctx.restore();
          if ((s.stk || 0) > 0) { ctx.save(); ctx.fillStyle = '#ff6a5c'; ctx.font = '800 13px ' + FONT; ctx.textAlign = 'center'; ctx.fillText('TRANSFUSÃO ×' + s.stk, e.x, e.y - 74); ctx.restore(); } } }); },
    // Mizi — A Ira da Bruxa: carrega e varre a tela com um feixe de luz e chamas
    mizi(p) { const col = PCOL('mizi'), acc = PACC('mizi'), CH = 1.1, SW = 2.4, a0 = rnd(0, TAU); s.fl = { col, t: .4, max: .4 };
      s.eff.push({ t: 0, life: CH + SW + .5, a0, th: a0,
        upd(e, dt) { const q = s.p; if (e.t < CH) { if (Math.random() < dt * 60) { const a = rnd(0, TAU), r = rnd(80, 150); s.pt.push({ x: q.x + Math.cos(a) * r, y: q.y + Math.sin(a) * r, vx: -Math.cos(a) * r * 3, vy: -Math.sin(a) * r * 3, life: .4, max: .4, col: Math.random() < .5 ? col : '#ffb347', size: 5, g: '*' }); } return; }
          if (e.t > CH + SW) return; e.th = a0 + (e.t - CH) / SW * TAU; s.shake = Math.max(s.shake, .08);
          each(o => { const da = Math.abs(wrapA(Math.atan2(o.y - q.y, o.x - q.x) - e.th)), dist = hyp(o.x - q.x, o.y - q.y); if (da < 1.57 && dist * Math.sin(da) < 48 + o.r && dist < 1000 && (o.bh || 0) <= s.t) { o.bh = s.t + .7; hurt(o, o.boss ? Math.max(520, o.maxhp * .07) : 420 * D(), acc); burnE(o, 26 * D(), 2); } }); },
        draw(e) { const q = s.p, k = e.t; ctx.save(); ctx.translate(q.x, q.y - 6);
          if (k < CH) { const f = k / CH; ctx.globalCompositeOperation = 'lighter'; ring(0, 0, 120 * (1 - f) + 30, col, 4, f); ring(0, 0, 70 * (1 - f) + 20, acc, 2, f);
            for (let i = 0; i < 8; i++) { const a = e.t * 3 + i * TAU / 8; ctx.fillStyle = i % 2 ? col : acc; ctx.save(); ctx.translate(Math.cos(a) * 62, Math.sin(a) * 62); ctx.rotate(a); star4(0, 0, 8, 0); ctx.fill(); ctx.restore(); } }
          else if (k < CH + SW + .3) { const f = Math.min(1, (k - CH) / .15, (CH + SW + .3 - k) / .3); ctx.globalCompositeOperation = 'lighter';
            for (let j = 9; j >= 0; j--) { const th = e.th - j * .06 * (1 + j * .15); ctx.save(); ctx.rotate(th); ctx.globalAlpha = f * (1 - j / 10) * (j ? .35 : 1); const L = 1000, w = 92 * (1 - j * .05);
              const g = ctx.createLinearGradient(0, 0, L, 0); g.addColorStop(0, '#fff'); g.addColorStop(.12, col); g.addColorStop(1, 'rgba(255,95,176,0)'); ctx.fillStyle = g; ctx.fillRect(0, -w / 2, L, w);
              if (!j) { ctx.fillStyle = '#fff'; ctx.fillRect(0, -w * .16, L * .8, w * .32); ctx.fillStyle = '#ffb347'; for (let i = 0; i < 18; i++) { const x = (i * 55 + k * 400) % L, y = Math.sin(i * 3 + k * 20) * w * .5; ctx.beginPath(); ctx.moveTo(x, y + 14); ctx.quadraticCurveTo(x + 8, y - 4, x + 20, y + 3); ctx.quadraticCurveTo(x + 6, y + 12, x, y + 14); ctx.fill(); } }
              ctx.restore(); } }
          ctx.restore(); } }); }
  };

  // ================= ULTIMATES COMBINADAS (sinergias) =================
  const ULTC = {
    // Hyuna & Luka — Vontade de Viver: escudo maciço e onda roxa que drena a vida dos inimigos
    hyuna_luka(p) { s.b.vv = 7; s.ls = .4; s.lsT = 7; const pur = '#a56bff', blue = PCOL('hyuna'), acc = PACC('hyuna');
      s.eff.push({ t: 0, life: 7.4, tk: 0, upd(e, dt) { e.tk -= dt; if (e.tk <= 0) { e.tk = .35; each(o => hurt(o, 24 * D() * (o.boss ? .5 : 1), pur), o => hyp(o.x - s.p.x, o.y - s.p.y) < 285 + o.r); } },
        draw(e) { const q = s.p, f = Math.min(1, e.t / .4, (7.4 - e.t) / .5); ctx.save(); ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 4; i++) { const k = (e.t * .9 + i / 4) % 1; ring(q.x, q.y, 285 * k, pur, 10 * (1 - k) + 2, (1 - k) * .85 * f); }
          ctx.fillStyle = '#e4d8ff'; ctx.font = '700 22px sans-serif'; ctx.textAlign = 'center'; for (let i = 0; i < 6; i++) { const a = e.t * 1.2 + i * TAU / 6, r = 285 * (((e.t * .9 + i / 6) % 1)); ctx.globalAlpha = f * .8 * (1 - r / 285); ctx.fillText('♪', q.x + Math.cos(a) * r, q.y + Math.sin(a) * r); }
          ctx.globalAlpha = f; const R = 66 + 4 * Math.sin(e.t * 8), g = ctx.createRadialGradient(q.x, q.y - 4, 10, q.x, q.y - 4, R); g.addColorStop(0, 'rgba(77,134,255,.05)'); g.addColorStop(1, 'rgba(120,150,255,.55)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y - 4, R, 0, TAU); ctx.fill(); ring(q.x, q.y - 4, R, acc, 3, f); ring(q.x, q.y - 4, R + 8, pur, 3, f * .7); ctx.restore(); } }); },
    // Mizi & Sua — My Clematis: palco em chamas, anêmonas e feixe em cruz que congela e elimina
    mizi_sua(p) { const cx = p.x, cy = p.y, col = PCOL('mizi'), sky = PACC('mizi'), pa = PCOL('sua'); s.fl = { col: '#ffffff', t: .5, max: .5 };
      const fl = Array.from({ length: 80 }, () => ({ x: cx + rnd(-W * .6, W * .6), y: cy + rnd(-H * .6, H * .6), s: rnd(.7, 1.5), ph: rnd(0, .9), c: [col, sky, '#ffffff', pa][(Math.random() * 4) | 0] }));
      s.ov.push({ t: 0, life: 4.6, draw(e) { const f = Math.min(1, e.t / .5, (4.6 - e.t) / .8); ctx.save(); const g = ctx.createRadialGradient(W / 2, H / 2, H * .2, W / 2, H / 2, Math.max(W, H) * .75); g.addColorStop(0, 'rgba(255,120,40,0)'); g.addColorStop(1, 'rgba(255,60,20,.75)'); ctx.globalAlpha = f; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 26; i++) { const x = (i + .5) / 26 * W, h = 60 + 50 * Math.abs(Math.sin(e.t * 5 + i * 1.7)) + 30 * Math.sin(e.t * 9 + i); ctx.globalAlpha = f * .7; ctx.fillStyle = i % 2 ? '#ff7a2a' : '#ffb347'; ctx.beginPath(); ctx.moveTo(x - 20, H); ctx.quadraticCurveTo(x - 4, H - h, x + (i % 3) * 6 - 6, H - h * 1.25); ctx.quadraticCurveTo(x + 14, H - h * .5, x + 20, H); ctx.fill(); } ctx.restore(); } });
      s.eff.push({ t: 0, life: 4.6, a: 0, b: 0,
        upd(e) { if (!e.a && e.t >= .35) { e.a = 1; each(o => freezeE(o, 3), o => onScr(o, 60)); }
          if (!e.b && e.t >= 1) { e.b = 1; crossFx(cx, cy, 0, 150, '#ffd0ec', 1.2, '#ffffff'); s.fl = { col: '#ffffff', t: .5, max: .5 };
            each(o => { if (o.boss) hurt(o, o.maxhp * .28, '#fff'); else if (o.el) hurt(o, 600, '#fff'); else hurt(o, 1e9, '#fff'); }, o => onScr(o, 60)); } },
        draw(e) { const f = Math.min(1, (4.6 - e.t) / .8); ctx.save(); for (const q of fl) { const k = Math.max(0, Math.min(1, (e.t - q.ph) / .5)); if (k <= 0) continue; ctx.globalAlpha = f * k; ctx.save(); ctx.translate(q.x, q.y); const sc = q.s * (.3 + .7 * ez(k)) * (1 + .06 * Math.sin(e.t * 4 + q.ph * 9));
            ctx.fillStyle = q.c; ctx.strokeStyle = 'rgba(80,20,60,.5)'; ctx.lineWidth = 1; for (let i = 0; i < 6; i++) { ctx.save(); ctx.rotate(i * TAU / 6 + q.ph); ctx.beginPath(); ctx.ellipse(0, -11 * sc, 5 * sc, 11 * sc, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore(); }
            ctx.fillStyle = '#2a0a30'; ctx.beginPath(); ctx.arc(0, 0, 3.4 * sc, 0, TAU); ctx.fill(); ctx.restore(); } ctx.restore(); } }); },
    // Till & Ivan — O Beijo Final: Ivan surge, o tempo congela e uma cruz carmesim oblitera tudo
    till_ivan(p) { p.hp = Math.max(1, p.hp * .7); prog('ivan', 1); s.freeze = 3; s.eb = []; const cx = p.x, cy = p.y, col = '#ff1f3a'; timeStopOv(3);
      s.eff.push({ t: 0, life: 3, a: 0, b: 0, upd(e) { if (!e.a && e.t >= .6) { e.a = 1; crossFx(cx, cy, 0, 120, col, 1.1, '#fff'); }
          if (!e.b && e.t >= 2.5) { e.b = 1; crossFx(cx, cy, 1, 150, col, 1, '#fff'); s.fl = { col, t: .6, max: .6 }; s.shake = .9; each(o => { if (o.boss) hurt(o, o.maxhp * .35, '#fff'); else hurt(o, 1e9, '#fff'); }, o => onScr(o, 80)); burst(cx, cy, col, 60, 600, 1, 5); } }, draw() {} }); },
    // Hyuna & Mizi — Fuga de Emergência: hovercraft atropela e empurra as hordas para as bordas
    hyuna_mizi(p) { let fx = s.face.x, fy = s.face.y; const m = hyp(fx, fy) || 1; fx /= m; fy /= m; const ang = Math.atan2(fy, fx), x0 = p.x - fx * 1100, y0 = p.y - fy * 1100, SP = 1500, blue = PCOL('hyuna'), acc = PACC('hyuna'), pk = PCOL('mizi'); s.b.fz = 6; s.fl = { col: acc, t: .4, max: .4 };
      s.eff.push({ t: 0, life: 1.6, lx: 0, upd(e) { const d = SP * e.t, cx = x0 + fx * d, cy = y0 + fy * d; e.cx = cx; e.cy = cy; e.d = d; s.shake = Math.max(s.shake, .15);
          each(o => { const rx = o.x - cx, ry = o.y - cy, al = rx * fx + ry * fy, pe = -rx * fy + ry * fx; if (!o.fg && Math.abs(al) < 100 + o.r && Math.abs(pe) < 90 + o.r) { o.fg = 1; hurt(o, 130 * D(), acc); knock(o, ang + (pe >= 0 ? 1.571 : -1.571) + rnd(-.25, .25), o.boss ? 300 : 340); } });
          if (d - e.lx > 55 && s.ink.length < 170) { e.lx = d; s.ink.push({ x: cx, y: cy, r: 40, life: 4.5, col: '#ff7a2a', fire: 1, dps: 26 * D() }); } if (e.t > 1.5) each(o => { o.fg = 0; }); },
        draw(e) { const cx = e.cx ?? x0, cy = e.cy ?? y0; ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang); ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(-6, 14, 82, 22, 0, 0, TAU); ctx.fill();
          ctx.globalCompositeOperation = 'lighter'; const fg = ctx.createLinearGradient(-190, 0, -60, 0); fg.addColorStop(0, 'rgba(255,120,30,0)'); fg.addColorStop(1, 'rgba(255,190,80,.9)'); ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(-60, -22); ctx.lineTo(-190, 0); ctx.lineTo(-60, 22); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = '#26345c'; ctx.strokeStyle = acc; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-62, -28); ctx.lineTo(48, -22); ctx.quadraticCurveTo(86, -4, 86, 4); ctx.quadraticCurveTo(70, 26, 40, 28); ctx.lineTo(-62, 28); ctx.quadraticCurveTo(-76, 0, -62, -28); ctx.fill(); ctx.stroke();
          ctx.fillStyle = blue; ctx.fillRect(-50, -6, 100, 10); ctx.fillStyle = pk; ctx.fillRect(-50, 4, 100, 3); ctx.fillStyle = 'rgba(180,230,255,.85)'; ctx.beginPath(); ctx.ellipse(18, -10, 26, 12, 0, 0, TAU); ctx.fill();
          ctx.globalCompositeOperation = 'lighter'; const hl = ctx.createLinearGradient(86, 0, 330, 0); hl.addColorStop(0, 'rgba(255,255,220,.55)'); hl.addColorStop(1, 'rgba(255,255,220,0)'); ctx.fillStyle = hl; ctx.beginPath(); ctx.moveTo(84, -4); ctx.lineTo(330, -52); ctx.lineTo(330, 52); ctx.lineTo(84, 8); ctx.fill(); ctx.restore(); } }); },
    // Till & Luka — Clímax da 7ª Rodada: holofotes, contagem regressiva, frenesi total
    till_luka(p) { s.b.cl = 7; const tc = PCOL('till'), lc = PCOL('luka'), gold = PACC('luka'); s.fl = { col: gold, t: .5, max: .5 };
      s.ov.push({ t: 0, life: 7, draw(e) { const f = Math.min(1, e.t / .5, (7 - e.t) / .6); ctx.save(); ctx.globalAlpha = f * .4; ctx.fillStyle = '#07041a'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 4; i++) { const bx = W * (.15 + i * .23) + Math.sin(e.t * 1.4 + i * 1.7) * W * .12, g = ctx.createLinearGradient(bx, 0, bx + Math.sin(e.t + i) * 120, H); g.addColorStop(0, (i % 2 ? tc : lc) + 'cc'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.globalAlpha = f * .28; ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(bx - 20, 0); ctx.lineTo(bx + 20, 0); ctx.lineTo(bx + Math.sin(e.t + i) * 120 + 140, H); ctx.lineTo(bx + Math.sin(e.t + i) * 120 - 140, H); ctx.fill(); }
        const n = Math.max(1, 7 - Math.floor(e.t)), fr = e.t % 1; ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = f * (1 - fr) * .8; ctx.fillStyle = '#fff'; ctx.shadowColor = gold; ctx.shadowBlur = 30; ctx.font = `800 ${Math.round(Math.min(W, H) * (.34 + fr * .1))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(n), W / 2, H * .46);
        ctx.shadowBlur = 0; ctx.globalAlpha = f * .9; ctx.font = `700 ${Math.round(Math.min(W, H) * .035)}px ${FONT}`; if ('letterSpacing' in ctx) ctx.letterSpacing = '8px'; ctx.fillStyle = gold; ctx.fillText('7ª RODADA', W / 2, H * .72); if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'; ctx.restore(); } }); }
  };

  // ================= usar especial / ultimate =================
  function useSpecial() {
    if (!s || s.halt || s.lvl || s.over || s.dying > 0 || s.sp.cd > 0) return;
    SPECIAL[ch.id](s.p); s.sp.max = ch.sp.cd; s.sp.cd = s.sp.max;
    s.ban = { txt: ch.sp.n.toUpperCase(), t: .9, max: .9, col: ch.col, sub: 'HABILIDADE ESPECIAL' };
    if (!s.fl || s.fl.t <= 0) s.fl = { col: ch.col, t: .25, max: .25 };
  }
  function useUlt() {
    if (!s || s.halt || s.lvl || s.over || s.dying > 0 || s.sk.cd > 0) return;
    const c = s.cmb;
    if (c) { ULTC[c.id](s.p); s.sk.max = c.u.cd; s.cmbUse[c.id] = (s.cmbUse[c.id] || 0) + 1; const pt = comboPartner(c, ch.id);
      s.ban = { txt: c.u.n.toUpperCase(), t: 1.6, max: 1.6, col: PCOL(pt), sub: 'SINERGIA  ·  ' + ch.name.toUpperCase() + ' + ' + PNAME(pt).toUpperCase() }; cutIn(pt, 'SINERGIA', '', false); }
    else { ULT[ch.id](s.p); s.sk.max = ch.sk.cd; s.ban = { txt: ch.sk.n.toUpperCase(), t: 1.4, max: 1.4, col: ch.col, sub: 'ULTIMATE' }; }
    s.sk.cd = s.sk.max; if (!s.fl || s.fl.t <= 0) s.fl = { col: ch.col, t: .4, max: .4 };
  }

  // ================= sinergias =================
  function setCombo(c) {
    const first = !(cb.found && cb.found[c.id]);
    s.cmb = c; s.sk.cd = Math.min(s.sk.cd, 2);
    if (first && cb.onFound) cb.onFound(c.id);
    cutIn(comboPartner(c, ch.id), first ? 'NOVA SINERGIA DESCOBERTA' : 'SINERGIA', c.name.toUpperCase(), true);
  }
  function comboOffer() {
    if (s.p.lv < 3 || Math.random() > (s.cmb ? .14 : .32)) return null;
    const list = comboFor(ch.id).filter(c => !(s.cmb && s.cmb.id === c.id)); if (!list.length) return null;
    const w = list.map(c => RARITY[c.rar].w * (cb.found && cb.found[c.id] ? 1 : 1.7));
    let r = Math.random() * w.reduce((a, b) => a + b, 0), i = 0; while (i < list.length - 1 && (r -= w[i]) > 0) i++;
    return list[i];
  }

  // ================= tarô =================
  function prog(id, n) {      // progresso de desbloqueio da carta (só conta jogando com o dono da carta)
    if (ch.id !== id || !cb.tarot) return;
    const T = TAROT[id], rec = cb.tarot[id] || (cb.tarot[id] = { p: 0, u: 0, t: 0 }); if (rec.u) return;
    rec.p = Math.min(T.goal, rec.p + n);
    if (rec.p >= T.goal) { rec.u = 1; s.ban = { txt: 'CARTA DESBLOQUEADA', t: 2.4, max: 2.4, col: ch.col, sub: T.n.toUpperCase() }; s.fl = { col: ch.col, t: .5, max: .5 }; if (cb.onTarot) cb.onTarot(id, 'unlock'); }
  }
  function cardOffer() {
    const T = TAROT[ch.id], rec = cb.tarot && cb.tarot[ch.id]; if (!rec || !rec.u) return null;
    const cur = s.tr.tier; if (cur >= 3) return null; const nx = T.t[cur]; if (s.p.lv < nx.lv) return null;
    return { cid: ch.id, tier: cur + 1, name: T.n, ...nx };
  }
  function pickCard(c) {
    s.tr.tier = c.tier; s.tr.cd2 = 3; s.tr.cd3 = 8; s.tr.lp = 0; const rec = cb.tarot[ch.id]; if (c.tier > (rec.t || 0)) { rec.t = c.tier; if (cb.onTarot) cb.onTarot(ch.id, 'tier'); }
    s.ban = { txt: c.n.toUpperCase(), t: 1.8, max: 1.8, col: ch.col, sub: 'CARTA · ' + c.name.toUpperCase() + ' · NÍVEL ' + c.tier }; s.fl = { col: ch.col, t: .4, max: .4 };
    if (ch.id === 'mizi' && c.tier === 1) s.p.mag += 1;
  }
  const ready3 = () => s.en.length > 0;
  const T2 = {       // habilidades ativas (nível 2): disparam sozinhas em ciclos
    hyuna: { cd: 14, go() { const p = s.p, acc = PACC('hyuna'); s.fx.push({ x: p.x, y: p.y, r: 240, life: .5, col: acc, follow: 1 }); each(e => knock(e, Math.atan2(e.y - p.y, e.x - p.x), 150), e => hyp(e.x - p.x, e.y - p.y) < 250 + e.r); s.rg = { t: 3, hps: p.max * .05 }; burst(p.x, p.y, acc, 30, 340, .7, 4); s.shake = .3;
      s.eff.push({ t: 0, life: .6, draw(e) { const q = s.p, k = e.t / .6; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ring(q.x, q.y, ez(k) * 250, '#ff8a3c', 14 * (1 - k), 1 - k); ring(q.x, q.y, ez(k) * 210, acc, 6, (1 - k) * .8); ctx.restore(); } }); return 1; } },
    sua: { cd: 16, go() { const col = PCOL('sua'); s.eff.push({ t: 0, life: 6,
      upd() { const q = s.p; for (let i = 0; i < 6; i++) { const a = s.t * 1.8 + i * TAU / 6, px = q.x + Math.cos(a) * 74, py = q.y + Math.sin(a) * 74; each(o => { if ((o.pg || 0) <= s.t) { o.pg = s.t + .4; hurt(o, 16 * D(), '#fff'); } }, o => hyp(o.x - px, o.y - py) < 22 + o.r); for (const b of s.eb) if (hyp(b.x - px, b.y - py) < 26) b.life = 0; } },
      draw(e) { const q = s.p, f = Math.min(1, e.t / .3, (6 - e.t) / .5); ctx.save(); ctx.globalAlpha = f; for (let i = 0; i < 6; i++) { const a = s.t * 1.8 + i * TAU / 6; ctx.save(); ctx.translate(q.x + Math.cos(a) * 74, q.y + Math.sin(a) * 74); ctx.rotate(a); for (let k = 0; k < 6; k++) { ctx.rotate(TAU / 6); ctx.fillStyle = k % 2 ? '#ffffff' : col; ctx.beginPath(); ctx.ellipse(0, -9, 4.5, 10, 0, 0, TAU); ctx.fill(); } ctx.fillStyle = '#6a4aa8'; ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, TAU); ctx.fill(); ctx.restore(); } ctx.restore(); } }); return 1; } },
    ivan: { cd: 15, go() { const p = s.p; if (p.hp < p.max * .25) return 0; p.hp = Math.max(1, p.hp - p.max * .06); prog('ivan', 1); const cx = p.x, cy = p.y, col = PCOL('ivan');
      crossFx(cx, cy, 0, 56, col, 1.2); each(e => hit(e, 70 * D(), col, { crit: false }), e => (Math.abs(e.x - cx) < 300 && Math.abs(e.y - cy) < 34 + e.r) || (Math.abs(e.y - cy) < 300 && Math.abs(e.x - cx) < 34 + e.r));
      for (let i = -7; i <= 7; i++) { if (!i) continue; s.ink.push({ x: cx + i * 40, y: cy, r: 34, life: 4, col: '#ff3b5c', fire: 1, dps: 24 * D() }); s.ink.push({ x: cx, y: cy + i * 40, r: 34, life: 4, col: '#ff3b5c', fire: 1, dps: 24 * D() }); } return 1; } },
    luka: { cd: 16, go() { s.b.hr = 4; const p = s.p, col = PCOL('luka'); s.fl = { col, t: .3, max: .3 }; s.eff.push({ t: 0, life: .6, draw(e) { const q = s.p, k = e.t / .6; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ring(q.x, q.y, ez(k) * 200, col, 8 * (1 - k), 1 - k); ring(q.x, q.y, ez(k) * 130, '#ffe066', 4, 1 - k); ctx.restore(); } }); return 1; } },
    till: { cd: 9, go() { const p = s.p; for (let i = 0; i < 10; i++) later(i * .12, () => { const a = rnd(0, TAU), r = rnd(60, 320), x = s.p.x + Math.cos(a) * r, y = s.p.y + Math.sin(a) * r; burst(x, y, '#ff2a2a', 22, 260, .6, 5); s.pt.push({ x, y, vx: 0, vy: -50, life: .8, max: .8, col: '#ffffff', size: 12, g: '♪' });
        s.fx.push({ x, y, r: 72, life: .3, col: '#ff3030' }); each(e => hurt(e, 42 * D(), '#ff3030'), e => (e.x - x) ** 2 + (e.y - y) ** 2 < (72 + e.r) ** 2); s.ink.push({ x, y, r: 40, life: 3.5, col: '#c4121e', slow: 1, dps: 12 * D() }); }); return 1; } },
    mizi: { cd: 11, go() { const p = s.p, pal = ['#ff5fb0', '#6ec8ff', '#ffd23f', '#7dffb0', '#c07bff']; let best = null, bn = -1; for (let i = 0; i < 24; i++) { const o = s.en[(Math.random() * s.en.length) | 0]; if (!o || o.dead) continue; let n = 0; for (const q of s.en) if (!q.dead && (q.x - o.x) ** 2 + (q.y - o.y) ** 2 < 130 * 130) n++; if (n > bn) { bn = n; best = o; } }
      const cx = best ? best.x : p.x + rnd(-150, 150), cy = best ? best.y : p.y + rnd(-150, 150);
      for (let i = 0; i < 9; i++) later(i * .09, () => { const x = cx + rnd(-110, 110), y = cy + rnd(-110, 110), col = pal[i % 5];
        s.eff.push({ t: 0, life: .55, boom: 0, upd(e) { if (!e.boom && e.t >= .25) { e.boom = 1; burst(x, y, col, 14, 240, .5, 4); s.fx.push({ x, y, r: 66, life: .3, col }); each(o => { hurt(o, 48 * D(), col); slowE(o, 1.5, .3); }, o => (o.x - x) ** 2 + (o.y - y) ** 2 < (66 + o.r) ** 2); } },
          draw(e) { const w = e.t < .25 ? 4 + e.t * 50 : 20 * (1 - (e.t - .25) / .3); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = e.t < .25 ? .6 : Math.max(0, 1 - (e.t - .25) / .3); const g = ctx.createLinearGradient(0, y - 800, 0, y); g.addColorStop(0, col + '00'); g.addColorStop(1, '#ffffff'); ctx.fillStyle = g; ctx.fillRect(x - w / 2, y - 800, w, 800); ctx.fillStyle = col; star4(x, y, 14, e.t * 4); ctx.fill(); ctx.restore(); } }); }); return 1; } }
  };
  const T3 = {       // evoluções finais (nível 3)
    sua: { cd: 42, go() { const p = s.p; if (!s.tr.wait) s.tr.wait = s.t + 15; if (p.hp > p.max * .4 && s.t < s.tr.wait) return 0; s.tr.wait = 0; const col = PCOL('sua'), a0 = near(p.x, p.y, s.en) ? ang2(p, near(p.x, p.y, s.en)) : 0;
      each(e => { if (!e.el && !e.boss) stunE(e, 2); }); p.hp = Math.min(p.max, p.hp + p.max * .3); s.fl = { col: '#ffffff', t: .5, max: .5 };
      for (let i = 0; i < 11; i++) shoot(a0 + (i - 5) * .16, { sp: 540, life: 1, d: 32 * D(), pierce: 6, sh: 'petal', c: i % 2 ? PACC('sua') : col });
      for (let i = 0; i < 3; i++) s.fx.push({ x: p.x, y: p.y, r: 80 + i * 110, life: .4 + i * .15, col: '#ffffff' }); return 1; } },
    ivan: { cd: 28, go() { const p = s.p; if (p.hp < p.max * .35) return 0; p.hp = Math.max(p.max * .15, p.hp - p.max * .2); prog('ivan', 1); const cx = p.x, cy = p.y, col = PCOL('ivan'); s.rdm = 2.5;
      each(e => { if (e.boss) freezeE(e, 3); }); crossFx(cx, cy, 0, 100, col, 1); later(.4, () => crossFx(cx, cy, 1, 110, col, 1)); later(.15, () => crossHit(cx, cy, 0, 100, .12)); later(.5, () => crossHit(cx, cy, 1, 110, .12)); return 1; } },
    luka: { cd: 22, go() { const col = PCOL('luka'); s.fl = { col, t: .4, max: .4 };
      s.eff.push({ t: 0, life: 6, tk: 0, upd(e, dt) { e.tk -= dt; if (e.tk <= 0) { e.tk = .8; const q = s.p; for (let c = 0; c < 3; c++) { const a = e.t * 1.3 + c * TAU / 3, cx = q.x + Math.cos(a) * 105, cy = q.y + Math.sin(a) * 105; for (let i = 0; i < 8; i++) shoot(i * TAU / 8 + e.t, { x: cx, y: cy, sp: 400, life: 1.1, d: 14 * D(), pierce: 2, sh: 'note', c: '#a56bff', ign: 1 }); } } },
        draw(e) { const q = s.p, f = Math.min(1, e.t / .3, (6 - e.t) / .5), pw = img.width / img.height * 64; ctx.save(); ctx.globalAlpha = f * .6; ctx.shadowColor = '#a56bff'; ctx.shadowBlur = 16; for (let c = 0; c < 3; c++) { const a = e.t * 1.3 + c * TAU / 3, cx = q.x + Math.cos(a) * 105, cy = q.y + Math.sin(a) * 105; ctx.drawImage(img, cx - pw / 2, cy + 30 - 64, pw, 64); } ctx.restore(); } }); return 1; } },
    till: { cd: 30, go() { const col = PCOL('till'); s.ban = { txt: 'A MORDAÇA SE QUEBRA', t: 1.5, max: 1.5, col, sub: 'CARTA · O LOUCO' }; s.fl = { col, t: .5, max: .5 }; s.shake = .6;
      s.eff.push({ t: 0, life: 6, tk: 0, upd(e, dt) { e.tk -= dt; if (e.tk <= 0) { e.tk = .25; const q = s.p; s.fx.push({ x: q.x, y: q.y, r: 330, life: .4, col: '#ff4d4d', follow: 1 }); each(o => { hurt(o, 24 * D(), '#ff4d4d'); knock(o, Math.atan2(o.y - q.y, o.x - q.x), 80); burnE(o, 20 * D(), 3); }, o => hyp(o.x - q.x, o.y - q.y) < 330 + o.r); } },
        draw(e) { const q = s.p, f = Math.min(1, (6 - e.t) / .5); ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 3; i++) { const k = (e.t * 2 + i / 3) % 1; ring(q.x, q.y, 330 * k, i % 2 ? '#ffffff' : '#ff3030', 10 * (1 - k) + 2, (1 - k) * .8 * f); } ctx.restore(); } }); return 1; } },
    mizi: { cd: 32, go() { const p = s.p, col = PCOL('mizi'), sky = PACC('mizi'); s.eb = []; s.tz = []; s.imm = Math.max(s.imm, 3); s.fl = { col: '#ffffff', t: .6, max: .6 }; s.shake = .7;
      each(e => { hit(e, 90 * D(), '#fff', { crit: false }); knock(e, Math.atan2(e.y - p.y, e.x - p.x), 100); }, e => hyp(e.x - p.x, e.y - p.y) < 330 + e.r);
      s.eff.push({ t: 0, life: .9, draw(e) { const q = s.p, k = e.t / .9, R = ez(k) * 340; ctx.save(); ctx.translate(q.x, q.y); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - k; ctx.fillStyle = '#fff'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? R * .28 : R, a = -1.57 + i * TAU / 10; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.stroke(); ring(0, 0, R * .5, sky, 4, 1 - k); ctx.restore(); } });
      s.ban = { txt: 'ABENÇOADA PELO PALCO', t: 1.6, max: 1.6, col, sub: 'IMUNE POR 3s' }; return 1; } }
  };
  function tarotTick(dt) {
    const tr = s.tr; if (!tr || !tr.tier) return; const id = ch.id;
    if (id === 'till') { tr.lp -= dt; if (tr.lp <= 0) { tr.lp = 20; s.leap = [.5, .75, 1, 1.25, 2.4][(Math.random() * 5) | 0]; s.pt.push({ x: s.p.x, y: s.p.y - 36, vx: 0, vy: -40, life: 1.2, max: 1.2, col: s.leap > 1.5 ? '#ffe066' : s.leap < 1 ? '#8aa' : '#fff', size: 11, g: 'SALTO ×' + s.leap }); } }
    tr.cd2 -= dt; tr.cd3 -= dt;
    if (tr.tier >= 2 && tr.cd2 <= 0) { if (!s.en.length && id !== 'luka') tr.cd2 = 1.5; else tr.cd2 = T2[id].go() ? T2[id].cd : 2; }
    if (tr.tier >= 3 && tr.cd3 <= 0 && T3[id]) { if (!s.en.length) tr.cd3 = 1.5; else tr.cd3 = T3[id].go() ? T3[id].cd : 3; }
  }

  function levelUp() {
    s.lvl = true;
    const OPTS = [
      { id: 'mic', name: s.cmb ? s.cmb.w.n : ch.weapon, desc: 'Mais projéteis, dano e cadência' },
      { id: 'wave', name: 'Onda de Voz', desc: 'Aura que fere quem chega perto' },
      { id: 'orbit', name: 'Holofotes Orbitais', desc: 'Luzes giram ao seu redor' },
      { id: 'spd', name: 'Pés Leves', desc: '+12% de velocidade' },
      { id: 'hp', name: 'Fôlego', desc: '+25 de vida máxima e cura total' },
      { id: 'mag', name: 'Ímã de Notas', desc: 'Atrai notas de longe' }
    ];
    const picks = shuffle(OPTS.filter(o => !(s.w[o.id] >= MAXLV)).slice()).slice(0, 3);
    const list = picks.map(o => ({ ...o, lv: s.w[o.id] })), cmo = comboOffer(), card = cardOffer();
    if (card && Math.random() < .8) list.push({ id: 'card:' + card.tier, name: card.n, desc: card.d, card });
    if (cmo) list.push({ id: 'combo:' + cmo.id, name: cmo.name, desc: cmo.w.n + ' + ' + cmo.u.n, combo: cmo, partner: comboPartner(cmo, ch.id), seen: !cmo.hid || !!(cb.found && cb.found[cmo.id]), replace: !!s.cmb });
    cb.onLevel(list, id => {
      const p = s.p;
      if (id.startsWith('combo:')) setCombo(COMBOS[id.slice(6)]);
      else if (id.startsWith('card:')) pickCard(list.find(o => o.id === id).card);
      else if (id in s.w) s.w[id]++;
      else if (id === 'spd') p.spd *= 1.12;
      else if (id === 'hp') { p.max += 25; p.hp = p.max; }
      else if (id === 'mag') p.mag++;
      if (map.mod.heal) p.hp = Math.min(p.max, p.hp + map.mod.heal);
      s.lvl = false; last = performance.now();
    });
  }

  // ================= v5: inimigos mais fortes, chefes, sinergias, aparição de personagem e HUD =================
  const later = (delay, fn) => { if (delay <= 0) fn(); else s.eff.push({ t: -delay, life: .02, upd(e) { if (!e.d) { e.d = 1; fn(); } }, draw() {} }); };

  // ---------- inimigos ----------
  const kScale = () => 1 + s.t / 60 + (s.t / 260) ** 2;
  const typeOf = (kind, k) => ({
    grunt: { kind, r: 13, hp: 22 * k, spd: 60, dmg: 10, col: map.al[0], xp: 1 },
    fast: { kind, r: 10, hp: 12 * k, spd: 118, dmg: 8, col: map.al[1], xp: 1 },
    tank: { kind, r: 22, hp: 85 * k, spd: 42, dmg: 18, col: map.al[2], xp: 5, arm: .3 },
    shooter: { kind, r: 12, hp: 20 * k, spd: 52, dmg: 9, col: map.al[3], xp: 2, shoot: 2 + Math.random() }
  })[kind];
  function addEnemy(type, x, y) {
    type.spd *= s.enm; type.hp *= s.hpm;
    const e = { x, y, ...type, maxhp: type.hp, hitCd: 0, flash: 0, ph: Math.random() * 6, sl: 0, slf: .3, stun: 0, frz: 0, conf: 0, chm: 0, psn: 0, brn: 0 }; s.en.push(e); return e;
  }
  function spawnEnemy() {
    if (s.en.length > 280) return;
    const a = Math.random() * TAU, d = Math.max(W, H) * .6 + 40, p = s.p, t = s.t, roll = Math.random();
    let kind = 'grunt';
    if (t > 20 && roll < .22) kind = 'fast'; else if (t > 45 && roll < .36) kind = 'tank'; else if (t > 60 && roll < .5) kind = 'shooter';
    let ty = typeOf(kind, kScale());
    if (t > 100 && Math.random() < Math.min(.12, (t - 100) / 1500)) ty = { ...ty, el: 1, arm: (ty.arm || 0) + .2, r: ty.r * 1.3, hp: ty.hp * 2.6, dmg: ty.dmg * 1.3, xp: ty.xp * 3 + 2 };
    addEnemy(ty, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
  }
  const minion = (kind, x, y) => { if (s.en.length < 300) addEnemy(typeOf(kind, kScale()), x, y); };

  // ---------- projéteis e zonas de perigo dos inimigos ----------
  function eshot(x, y, a, v, dmg, col, r = 7, life = 5) { if (s.eb.length < 420) s.eb.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, dmg, col, r, life }); }
  function ering(x, y, n, v, dmg, col, off = 0, r = 7) { for (let i = 0; i < n; i++) eshot(x, y, off + i * TAU / n, v, dmg, col, r); }
  const tzone = (x, y, r, delay, dmg, col, pillar) => s.tz.push({ x, y, r, t: 0, delay, dmg, col, pillar, done: 0 });

  // ---------- chefes (um por palco) ----------
  function spawnBoss() {
    const B = map.bosses[s.nb % map.bosses.length], a = Math.random() * TAU, d = Math.max(W, H) * .55 + 60, p = s.p, hp = (1100 + s.t * 9) * (1 + s.nb * .35) * s.hpm;
    const e = { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, kind: 'boss', boss: true, bid: B.id, def: B, r: B.r || 58, hp, maxhp: hp, spd: 44 * s.enm * (B.spd || 1), dmg: 28, col: B.col, xp: 40, hitCd: 0, flash: 0, ph: 0, arm: .3, sl: 0, slf: .3, stun: 0, frz: 0, conf: 0, chm: 0, psn: 0, brn: 0,
      b: { t: 0, a: Math.random() * 6, c1: 2.2, c2: 5, c3: 7, c4: 1, c5: 3, sp: 0, cyc: 0, pull: 0, tp: null, dash: null, sum: 0, beat: 0, ba: Math.random() * 6, zap: null, sq: null } };
    s.en.push(e); s.bossE = e; s.bossAt = Infinity; s.warn = 2.6; s.shake = .6; s.fl = { col: B.col, t: .7, max: .7 };
    s.ban = { txt: B.name.toUpperCase(), t: 2.4, max: 2.4, col: B.col, sub: 'CHEFE DO PALCO  ·  ' + B.sub.toUpperCase() };
  }
  function bossDown(e) {
    const p = s.p; s.bossE = null; s.nb++; s.eb = []; s.tz = []; s.bonus += 25 + s.nb * 10; s.bk.push(map.id); s.bossAt = s.t + 100;
    p.hp = Math.min(p.max, p.hp + p.max * .3);
    for (let i = 0; i < 14; i++) s.gems.push({ x: e.x + (Math.random() - .5) * 140, y: e.y + (Math.random() - .5) * 140, v: 4 });
    s.shake = .8; s.fl = { col: '#ffffff', t: .5, max: .5 };
    s.ban = { txt: 'CHEFE DERROTADO', t: 2.4, max: 2.4, col: e.def.col, sub: e.def.name.toUpperCase() };
    for (let i = 0; i < 4; i++) s.fx.push({ x: e.x, y: e.y, r: 80 + i * 90, life: .5 + i * .25, col: i % 2 ? '#fff' : e.col });
    if (cb.onBoss) cb.onBoss(map.id);
  }
  // devolve o multiplicador de movimento (0 = parado); cada palco tem o seu chefe com ataques próprios
  function bossAI(e, dt) {
    const p = s.p, B = e.b, f = e.hp / e.maxhp, rate = f < .3 ? 1.8 : f < .6 ? 1.4 : 1, col = e.col;
    const tick = (k, every) => { B[k] -= dt * rate; if (B[k] <= 0) { B[k] = every; return true; } return false; };
    B.t += dt;
    switch (e.bid) {
      case 'clementis':
        if (tick('c1', 3.2)) { B.a += .35; ering(e.x, e.y, f < .6 ? 18 : 14, 170, 11, col, B.a); }
        if (tick('c2', 7)) { const n = f < .6 ? 4 : 3; for (let i = 0; i < n; i++) { const a = Math.random() * TAU, d = i ? 60 + Math.random() * 120 : 0; tzone(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 72, 1.1, 24, col); } }
        if (f < .5 && !B.sum) { B.sum = 1; for (let i = 0; i < 6; i++) { const a = i * TAU / 6; minion('fast', e.x + Math.cos(a) * 90, e.y + Math.sin(a) * 90); } burst(e.x, e.y, col, 30, 260, .7, 4); }
        break;
      case 'blinkgone':
        if (tick('c1', 1.8)) { const a = ang2(e, p), n = f < .6 ? 5 : 3; for (let i = 0; i < n; i++) eshot(e.x, e.y, a + (i - (n - 1) / 2) * .28, 235, 11, col, 7); }
        if (!B.tp && tick('c2', 5)) { const a = Math.random() * TAU, tx = p.x + Math.cos(a) * 150, ty = p.y + Math.sin(a) * 150; tzone(tx, ty, 95, .9, 26, col); B.tp = { x: tx, y: ty, t: .9 }; }
        if (B.tp) { B.tp.t -= dt; if (B.tp.t <= 0) { e.x = B.tp.x; e.y = B.tp.y; ering(e.x, e.y, 16, 200, 11, col, Math.random()); burst(e.x, e.y, col, 30, 280, .6, 4); s.shake = Math.max(s.shake, .2); B.tp = null; } return 0; }
        break;
      case 'blacksorrow': {
        if (tick('c1', 3)) eshot(e.x, e.y, ang2(e, p), 150, 14, '#ffffff', 12, 6);
        if (B.pull <= 0 && tick('c2', 6.5)) B.pull = 1.5;
        if (B.pull > 0) { B.pull -= dt; const d = hyp(e.x - p.x, e.y - p.y) || 1; if (d > 90) { p.x += (e.x - p.x) / d * 150 * dt; p.y += (e.y - p.y) / d * 150 * dt; } if (B.pull <= 0) { ering(e.x, e.y, f < .6 ? 26 : 20, 190, 12, '#ffffff', Math.random()); s.shake = Math.max(s.shake, .25); } return .35; }
        for (let i = 0; i < 4; i++) { const a = s.t * 1.1 + i * TAU / 4, bx = e.x + Math.cos(a) * e.r * 1.95, by = e.y + Math.sin(a) * e.r * 1.95; if (p.inv <= 0 && hyp(bx - p.x, by - p.y) < 20 + p.r) dmgPlayer(12); }
        break; }
      case 'ruler':
        if (B.dash) { const d = B.dash; d.t += dt; if (d.t < .8) { d.a = ang2(e, p); return 0; } if (d.t < 1.3) { e.x += Math.cos(d.a) * 560 * dt; e.y += Math.sin(d.a) * 560 * dt; return 0; } B.dash = null; }
        B.cyc += dt; if (B.cyc % 5.4 < 3) { B.sp -= dt * rate; if (B.sp <= 0) { B.sp = .15; B.a += .42; eshot(e.x, e.y, B.a, 175, 10, col, 6); if (f < .6) eshot(e.x, e.y, B.a + Math.PI, 175, 10, col, 6); } }
        if (tick('c2', 9)) B.dash = { t: 0, a: ang2(e, p) };
        break;
      case 'cure':
        if (tick('c1', 1.3)) eshot(e.x, e.y, ang2(e, p), 260, 10, col, 7);
        if (tick('c2', 3.6)) { const n = f < .6 ? 5 : 4; for (let i = 0; i < n; i++) { const a = Math.random() * TAU, d = i ? 70 + Math.random() * 190 : 0; tzone(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 62, 1, 24, col, true); } }
        if (tick('c3', 9)) for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + Math.random(); minion('fast', e.x + Math.cos(a) * 80, e.y + Math.sin(a) * 80); }
        break;

      // ---------- chefes extras ----------
      case 'clementis_b':        // Clematis Eterna: espiral de pétalas, leque e raízes
        if (tick('c1', .24)) { B.a += .5; const n = f < .6 ? 3 : 2; for (let i = 0; i < n; i++) eshot(e.x, e.y, B.a + i * TAU / n, 150, 9, col, 6); }
        if (tick('c2', 6)) { const a0 = ang2(e, p); for (let i = -3; i <= 3; i++) eshot(e.x, e.y, a0 + i * .22, 210, 11, '#ffd1ec', 7); }
        if (tick('c3', 8.5)) for (let i = 0; i < 5; i++) { const a = Math.random() * TAU, d = i ? 80 + Math.random() * 160 : 0; tzone(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 58, 1.2, 22, col); }
        break;
      case 'clementis_c':        // Axônio Desperto: raio sináptico em linha, anéis e lacaios
        if (B.zap) { B.zap.t -= dt; if (B.zap.t <= 0) B.zap = null; }
        if (tick('c1', 4.4)) { const a = ang2(e, p), L = Math.min(940, hyp(p.x - e.x, p.y - e.y) + 300); for (let d = 90; d < L; d += 85) tzone(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, 44, 1 + d / 1800, 20, col); B.zap = { a, t: 1.2 }; }
        if (tick('c2', 3.2)) ering(e.x, e.y, 8, 190, 10, '#ffd1ec', B.a += .4);
        if (f < .5 && tick('c3', 9)) for (let i = 0; i < 3; i++) minion('fast', e.x + rnd(-80, 80), e.y + rnd(-80, 80));
        break;
      case 'blinkgone_b':        // Varredura Zero: parede de dados com brecha e grade que fecha
        if (tick('c1', 3.6)) { const a = ang2(e, p), px = -Math.sin(a), py = Math.cos(a), gap = Math.floor(Math.random() * 9) - 4; for (let i = -6; i <= 6; i++) if (Math.abs(i - gap) > 1) eshot(e.x + px * i * 46, e.y + py * i * 46, a, 190, 11, col, 7); }
        if (tick('c2', 7)) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if (i || j) tzone(p.x + i * 105, p.y + j * 105, 52, 1.1, 22, '#3dffb0');
        if (f < .5 && tick('c3', 5)) ering(e.x, e.y, 12, 200, 10, '#3dffb0', Math.random());
        break;
      case 'blinkgone_c':        // Sinal Fantasma: tiros RGB, investida deixando rastro e ecos
        if (B.dash) { const d = B.dash; d.t += dt; if (d.t < .6) { d.a = ang2(e, p); return 0; }
          if (d.t < 1.05) { e.x += Math.cos(d.a) * 640 * dt; e.y += Math.sin(d.a) * 640 * dt; B.c5 -= dt; if (B.c5 <= 0) { B.c5 = .08; tzone(e.x, e.y, 36, .45, 14, '#ff2e88'); } return 0; }
          B.dash = null; B.c5 = 3; }
        if (tick('c1', 2.4)) { const a = ang2(e, p), cl = ['#ff2e88', '#3dffb0', '#18e0ff']; for (let i = -1; i <= 1; i++) eshot(e.x, e.y, a + i * .3, 225, 10, cl[i + 1], 7); }
        if (tick('c2', 8)) B.dash = { t: 0, a: ang2(e, p) };
        if (f < .6 && tick('c3', 10)) for (let i = 0; i < 2; i++) minion('fast', e.x + rnd(-70, 70), e.y + rnd(-70, 70));
        break;
      case 'blacksorrow_b':      // Anel do Lamento: anéis de prata com uma brecha e bolhas que estouram
        if (tick('c1', 2.6)) { B.a = ang2(e, p) + rnd(-.8, .8); for (let i = 0; i < 28; i++) { const a = i * TAU / 28; if (Math.abs(wrapA(a - B.a)) > .4) eshot(e.x, e.y, a, 150, 11, '#ffffff', 8, 7); } }
        if (tick('c2', 7)) { const a0 = ang2(e, p); for (let i = -1; i <= 1; i++) { const a = a0 + i * .5, bx = e.x + Math.cos(a) * 153, by = e.y + Math.sin(a) * 153; eshot(e.x, e.y, a, 90, 12, '#dfe6f2', 16, 1.7); later(1.7, () => { if (s.bossE === e) ering(bx, by, 10, 165, 10, '#ffffff', Math.random()); }); } }
        if (f < .5 && tick('c3', 8)) for (let i = 0; i < 4; i++) { const a = Math.random() * TAU, d = 60 + Math.random() * 150; tzone(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 54, 1.1, 22, '#c9ced6'); }
        break;
      case 'blacksorrow_c':      // Gota Primordial: salta sobre você, chove gotas e solta ondas
        if (B.sq) { B.sq.t -= dt; if (B.sq.t <= 0) { e.x = B.sq.x; e.y = B.sq.y; ering(e.x, e.y, 16, 190, 12, '#9fb4d6', Math.random()); burst(e.x, e.y, '#9fb4d6', 30, 280, .6, 4); s.shake = Math.max(s.shake, .3); B.sq = null; } return 0; }
        if (tick('c2', 5.5)) { tzone(p.x, p.y, 112, 1, 30, '#9fb4d6'); B.sq = { x: p.x, y: p.y, t: 1 }; return 0; }
        if (tick('c1', 4.5)) for (let i = 0; i < (f < .6 ? 8 : 6); i++) { const a = Math.random() * TAU, d = 40 + Math.random() * 260; tzone(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 36, .8 + i * .12, 16, '#c9d8f0'); }
        if (tick('c3', 3)) eshot(e.x, e.y, ang2(e, p), 170, 12, '#9fb4d6', 11, 5);
        break;
      case 'ruler_b':            // Coração de Osso: batimento duplo e fitas giratórias
        B.beat = Math.max(0, B.beat - dt);
        if (tick('c1', 2.8)) { B.beat = .3; ering(e.x, e.y, 16, 170, 11, col, Math.random()); later(.28, () => { if (s.bossE === e) { B.beat = .3; ering(e.x, e.y, 16, 215, 11, '#fff2d1', Math.random()); } }); }
        if (B.sp <= 0 && tick('c2', 6.5)) B.sp = 2.6;
        if (B.sp > 0) { B.sp -= dt; B.a += dt * 2.2; if (tick('c4', .12)) for (let k = 0; k < 3; k++) eshot(e.x, e.y, B.a + k * TAU / 3, 160, 10, '#e8dcc0', 6); }
        if (f < .5 && tick('c3', 8)) for (let i = 0; i < 4; i++) { const a = Math.random() * TAU, d = 40 + Math.random() * 150; tzone(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 50, 1.1, 22, '#ffd9a0'); }
        break;
      case 'ruler_c':            // Ceifadora Crescente: foices orbitando, arcos de luz e eclipses
        B.a += dt * (f < .5 ? 2.6 : 1.8);
        for (let i = 0; i < 3; i++) { const a = B.a + i * TAU / 3, bx = e.x + Math.cos(a) * e.r * 2.1, by = e.y + Math.sin(a) * e.r * 2.1; if (p.inv <= 0 && hyp(bx - p.x, by - p.y) < 26 + p.r) dmgPlayer(13); }
        if (tick('c1', 3)) { const a0 = ang2(e, p); for (let i = -5; i <= 5; i++) eshot(e.x, e.y, a0 + i * .15, 240 - Math.abs(i) * 14, 10, '#fff2d1', 7); }
        if (tick('c2', 8)) for (let i = -1; i <= 1; i++) { const a = Math.random() * TAU; tzone(p.x + (i ? Math.cos(a) * 140 : 0), p.y + (i ? Math.sin(a) * 140 : 0), 100, 1.4, 26, '#fff2d1'); }
        break;
      case 'cure_b': {           // Farol da Névoa: feixe giratório visível, pilares de luz e anéis
        B.ba += dt * (f < .5 ? 1 : .72);
        for (let k = 0; k < (f < .5 ? 2 : 1); k++) { const th = B.ba + k * Math.PI, dx = p.x - e.x, dy = p.y - e.y, along = dx * Math.cos(th) + dy * Math.sin(th), perp = Math.abs(-dx * Math.sin(th) + dy * Math.cos(th)); if (p.inv <= 0 && along > 0 && along < 780 && perp < 10 + along * .038 + p.r * .5) dmgPlayer(14); }
        if (tick('c1', 4)) for (let i = 0; i < 4; i++) { const a = Math.random() * TAU, d = i ? 60 + Math.random() * 200 : 0; tzone(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 58, 1, 24, col, true); }
        if (tick('c2', 6)) ering(e.x, e.y, 10, 175, 10, col, B.ba);
        break; }
      case 'cure_c':             // Serafim Cinzento: chuva de penas, halo que se fecha e leque
        if (tick('c1', .45)) for (let k = 0; k < 2; k++) eshot(p.x + rnd(-380, 380), p.y - H * .6, Math.PI / 2 + rnd(-.08, .08), 250, 9, '#d5f6ff', 6, 4.5);
        if (tick('c2', 7)) { const a0 = Math.random() * TAU; for (let i = 0; i < 7; i++) { const a = a0 + i * TAU / 7; tzone(p.x + Math.cos(a) * 150, p.y + Math.sin(a) * 150, 52, 1.2, 22, col, true); } }
        if (tick('c3', 5)) { const a0 = ang2(e, p); for (let i = -2; i <= 2; i++) eshot(e.x, e.y, a0 + i * .2, 230, 10, '#ffffff', 7); }
        break;

      // ---------- chefes do Karma ----------
      case 'karma':              // Roda do Retorno: anéis que vão e voltam, zonas de retribuição
        if (tick('c1', 3.4)) { B.a += .4; ering(e.x, e.y, f < .6 ? 18 : 14, 150, 11, col, B.a); B.q = 1.1; }
        if (B.q > 0) { B.q -= dt; if (B.q <= 0) ering(e.x, e.y, f < .6 ? 18 : 14, 210, 11, '#ffd27a', B.a + Math.PI / 14); }
        if (tick('c2', 6)) for (let i = 0; i < 4; i++) { const a = Math.random() * TAU, d = i ? 60 + Math.random() * 150 : 0; tzone(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 66, 1.1, 24, col); }
        if (f < .5 && !B.sum) { B.sum = 1; for (let i = 0; i < 4; i++) { const a = i * TAU / 4; minion('fast', e.x + Math.cos(a) * 90, e.y + Math.sin(a) * 90); } burst(e.x, e.y, col, 28, 250, .7, 4); }
        break;
      case 'karma_b': {          // Tecelã de Fios: leque de agulhas, fio de fogo em linha e nós explosivos
        if (tick('c1', 2.4)) { const a0 = ang2(e, p), n = f < .6 ? 9 : 7; for (let i = 0; i < n; i++) eshot(e.x, e.y, a0 + (i - (n - 1) / 2) * .16, 215, 10, col, 6); }
        if (tick('c2', 6)) { const a = ang2(e, p), L = Math.min(900, hyp(p.x - e.x, p.y - e.y) + 260); for (let d = 80; d < L; d += 80) tzone(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, 40, .9 + d / 1900, 20, '#ffc15a'); }
        if (tick('c3', 8)) { ering(e.x, e.y, 10, 170, 10, '#ffc15a', Math.random() * TAU); for (let i = 0; i < 3; i++) { const a = Math.random() * TAU, d = 70 + Math.random() * 170; tzone(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 54, 1.2, 22, col); } }
        break; }
      case 'karma_c':            // Juiz Carmesim: pilares de sentença, tiros certeiros e onda de veredito
        if (tick('c1', 4)) { tzone(p.x, p.y, 70, 1.1, 26, col, true); for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + Math.random(), d = 120 + Math.random() * 60; tzone(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 56, 1.3, 22, col, true); } }
        if (tick('c2', 2.6)) { const a0 = ang2(e, p); for (let i = -1; i <= 1; i++) eshot(e.x, e.y, a0 + i * .12, 270, 12, '#ffe3b0', 7); }
        if (tick('c3', 8.5)) { ering(e.x, e.y, f < .6 ? 26 : 20, 190, 12, col, Math.random()); s.shake = Math.max(s.shake, .25); }
        break;

      // ---------- chefes do Unknown ----------
      case 'unknown':            // Olho do Vazio: leque de olhares, zonas sob seus pés e vigias
        if (tick('c1', 2.2)) { const a0 = ang2(e, p), n = f < .6 ? 5 : 3; for (let i = 0; i < n; i++) eshot(e.x, e.y, a0 + (i - (n - 1) / 2) * .26, 230, 11, col, 7); }
        if (tick('c2', 5.5)) for (let i = 0; i < 4; i++) { const a = Math.random() * TAU, d = i ? 60 + Math.random() * 160 : 0; tzone(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 64, 1, 24, col); }
        if (f < .5 && !B.sum) { B.sum = 1; for (let i = 0; i < 5; i++) { const a = i * TAU / 5; minion('shooter', e.x + Math.cos(a) * 100, e.y + Math.sin(a) * 100); } burst(e.x, e.y, col, 30, 260, .7, 4); }
        break;
      case 'unknown_b':          // Glifo Errante: espiral de fragmentos, leque e interrogações vivas
        if (tick('c1', .3)) { B.a += .6; eshot(e.x, e.y, B.a, 150, 9, col, 6); if (f < .6) eshot(e.x, e.y, B.a + Math.PI, 150, 9, '#a8fff2', 6); }
        if (tick('c2', 5.2)) { const a0 = ang2(e, p); for (let i = -2; i <= 2; i++) eshot(e.x, e.y, a0 + i * .2, 235, 11, '#a8fff2', 7); }
        if (tick('c3', 8)) for (let i = 0; i < 3; i++) minion('fast', e.x + rnd(-90, 90), e.y + rnd(-90, 90));
        break;
      case 'unknown_c':          // Estática: explosão de ruído, grade instável e anéis
        if (tick('c1', 3.6)) for (let i = 0; i < 14; i++) eshot(e.x, e.y, Math.random() * TAU, rnd(120, 250), 9, i % 2 ? col : '#ff3b5c', 6);
        if (tick('c2', 6.5)) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if (i || j) tzone(p.x + i * 100, p.y + j * 100, 50, 1.1, 22, '#38e0d0');
        if (tick('c3', 7.5)) ering(e.x, e.y, 12, 190, 10, col, Math.random());
        break;
    }
    return 1;
  }

  // ---------- o parceiro aparece por um instante na tela ----------
  const silC = {};
  const sil = (id, im) => silC[id] || (silC[id] = (() => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); return c; })());
  const cutGeo = c => { const im = cuts[c.id], hh = Math.min(H * .72, 600), ww = im.width / im.height * hh; return { im, hh, ww, cx: W / 2 + c.side * W * .27, by: H * .95 }; };
  function cutIn(id, label, sub, big) {
    if (!cuts || !cuts[id] || !cuts[id].width) return;
    s.cut = { id, t: 0, max: big ? 2.9 : 1.9, side: s.face.x > 0 ? -1 : 1, label, sub, big, col: PCOL(id), dis: 0 };
    const g = cutGeo(s.cut); for (let i = 0; i < 22; i++) s.cp.push({ x: g.cx + (Math.random() - .5) * g.ww, y: g.by - Math.random() * g.hh, vx: (Math.random() - .5) * 160, vy: -30 - Math.random() * 120, life: .8, max: .8, col: s.cut.col, size: 5 + Math.random() * 8 });
  }
  const tintC = {};
  const tintSil = (id, im, col) => tintC[id] || (tintC[id] = (() => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); return c; })());
  // Linha do tempo: 0–12% surge (flash branco) · até 34% pulsa · depois dissolve devagar enquanto o brilho cresce (bloom) e sobe
  function drawCut() {
    const c = s.cut; if (!c) return; const g = cutGeo(c); if (!g.im.width) return;
    const k = c.t / c.max, FI = .12, HOLD = .4, u = k < HOLD ? 0 : Math.min(1, (k - HOLD) / (1 - HOLD)), ue = ez(u), inn = ez(Math.min(1, k / FI));
    const a = Math.max(0, inn * (1 - Math.pow(ue, 1.15))), pulse = .5 + .5 * Math.sin(c.t * 7);
    const bloom = .55 + .3 * pulse + 1.7 * Math.sin(Math.min(1, u * 1.25) * Math.PI);            // brilho: cresce na dissolução
    const flash = Math.max(0, 1 - k / .16) * .7, lum = Math.sin(Math.min(1, u * 1.25) * Math.PI) * .42 * (1 - ue * .4);
    const ox = c.side * (1 - inn) * 60, drift = -ue * 36, sc = 1 + ue * .06 + (1 - inn) * .05, cx = g.cx + ox, cy = g.by - g.hh / 2 + drift;
    ctx.save(); ctx.imageSmoothingEnabled = true;
    // halo de luz atrás do personagem
    ctx.globalCompositeOperation = 'lighter'; const hr = g.hh * .78, gr = ctx.createRadialGradient(cx, cy, hr * .05, cx, cy, hr);
    gr.addColorStop(0, c.col); gr.addColorStop(.45, c.col + '55'); gr.addColorStop(1, c.col + '00'); ctx.fillStyle = gr; ctx.globalAlpha = Math.min(1, (a * .55 + lum * .5) * (.7 + .3 * pulse)); ctx.beginPath(); ctx.arc(cx, cy, hr, 0, TAU); ctx.fill();
    // feixes de luz verticais
    for (let i = -2; i <= 2; i++) { const bx = cx + i * g.ww * .22 + Math.sin(c.t * 2 + i) * 6, bw = 14 + (i & 1) * 8, lg = ctx.createLinearGradient(0, g.by, 0, g.by - g.hh * 1.15); lg.addColorStop(0, c.col + '66'); lg.addColorStop(1, c.col + '00'); ctx.fillStyle = lg; ctx.globalAlpha = (a * .35 + lum * .3); ctx.fillRect(bx - bw / 2, g.by - g.hh * 1.15, bw, g.hh * 1.15); }
    ctx.globalCompositeOperation = 'source-over';
    // personagem com brilho colorido
    ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.globalAlpha = a * .96; ctx.shadowColor = c.col; ctx.shadowBlur = 20 + 38 * bloom; ctx.drawImage(g.im, -g.ww / 2, -g.hh / 2, g.ww, g.hh); ctx.shadowBlur = 0;
    // camada luminosa aditiva (cor do parceiro) + núcleo branco: o corpo "vira luz" ao sumir
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, a * (.12 + .18 * pulse) + lum * .55); ctx.shadowColor = c.col; ctx.shadowBlur = 26 + 40 * bloom; ctx.drawImage(tintSil(c.id, g.im, c.col), -g.ww / 2, -g.hh / 2, g.ww, g.hh); ctx.shadowBlur = 0;
    ctx.globalAlpha = Math.min(1, flash + lum * .35); ctx.drawImage(sil(c.id, g.im), -g.ww / 2, -g.hh / 2, g.ww, g.hh);
    ctx.restore(); ctx.globalCompositeOperation = 'source-over'; ctx.imageSmoothingEnabled = false;
    // textos no lado de dentro, somem junto
    const ta = Math.min(1, a * 1.5); if (ta > 0) {
      const tx = c.side < 0 ? g.cx + g.ww / 2 + 16 : g.cx - g.ww / 2 - 16, al = c.side < 0 ? 'left' : 'right', ty = g.by - g.hh * .5 + g.hh * .1 + drift * .4, fs = Math.min(1, W / 900);
      ctx.globalAlpha = ta; if ('letterSpacing' in ctx) ctx.letterSpacing = '4px'; ctx.textAlign = al; ctx.shadowColor = c.col; ctx.shadowBlur = 12 + 16 * bloom;
      ctx.font = `800 ${Math.round(58 * fs)}px ${FONT}`; ctx.fillStyle = '#fff'; ctx.fillText(PNAME(c.id).toUpperCase(), tx, ty); ctx.shadowBlur = 0;
      ctx.font = `700 ${Math.round(14 * fs + 2)}px ${FONT}`; ctx.fillStyle = c.col; ctx.fillText('✦ ' + c.label, tx, ty - Math.round(58 * fs) + 4);
      if (c.sub) { ctx.font = `700 ${Math.round(20 * fs + 2)}px ${FONT}`; ctx.fillStyle = '#fff'; ctx.fillText(c.sub, tx, ty + Math.round(26 * fs + 6)); }
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    }
    ctx.restore();
  }

  // ---------- desenho dos chefes ----------
  const BOSS = {
    // Soberana Sináptica: cérebro-água-viva gigante com coroa de sinapses
    clementis(r, T, col, e, p, fl) {
      const rg = ctx.createRadialGradient(0, 0, r * .3, 0, 0, r * 3); rg.addColorStop(0, col + '55'); rg.addColorStop(1, col + '00'); ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, r * 3, 0, TAU); ctx.fill();
      ctx.lineCap = 'round'; ctx.strokeStyle = col; ctx.globalAlpha = .85;
      for (let i = 0; i < 10; i++) { const ox = (i - 4.5) * r * .22, L = r * (2.2 + (i % 3) * .5), w1 = Math.sin(T * 2 + i) * r * .5, ex = ox + Math.sin(T * 2.6 + i) * r * .6; ctx.lineWidth = r * .1; ctx.beginPath(); ctx.moveTo(ox, r * .4); ctx.bezierCurveTo(ox + w1, r * 1.1, ox - w1, r * 1.7, ex, L); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, L, r * .07, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1; ctx.shadowColor = col; ctx.shadowBlur = 22; ctx.fillStyle = fl ? '#fff' : col;
      ctx.beginPath(); ctx.ellipse(0, -r * .05, r * 1.2, r * 1.05, 0, Math.PI, 0); ctx.quadraticCurveTo(r * .6, r * .75 + Math.sin(T * 4) * 4, 0, r * .55); ctx.quadraticCurveTo(-r * .6, r * .75 + Math.sin(T * 4) * 4, -r * 1.2, -r * .05); ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(100,0,80,.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -r * 1.1); ctx.quadraticCurveTo(r * .15, -r * .6, 0, -r * .1);
      for (const sx of [-1, 1]) { ctx.moveTo(sx * r * .2, -r * .9); ctx.quadraticCurveTo(sx * r * .7, -r, sx * r * .95, -r * .45); ctx.moveTo(sx * r * .25, -r * .45); ctx.quadraticCurveTo(sx * r * .6, -r * .65, sx * r * .85, -r * .15); ctx.moveTo(sx * r * .15, -r * .2); ctx.quadraticCurveTo(sx * r * .5, -r * .3, sx * r * .7, 0); } ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.globalAlpha = .55; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(0, -r * .1, r * (1.5 + i * .25), r * (.5 + i * .12), T * (.5 + i * .2) * (i % 2 ? -1 : 1), 0, TAU); ctx.stroke(); } ctx.globalAlpha = 1;
      eyes(3, r * 1.1, e, p, r * .1, .2);
    },
    // Prisma Glitch: cristal de polígonos que pisca, divide canais de cor e teletransporta
    blinkgone(r, T, col, e, p, fl) {
      const B = e.b, rot = T * .6; ctx.globalAlpha = B.tp ? (Math.sin(T * 40) > 0 ? .3 : .8) : 1;
      if (Math.sin(T * 7) > .9) for (const [c, dx] of [['#ff2e88', -6], ['#3dffb0', 6]]) { ctx.save(); ctx.translate(dx, 0); ctx.strokeStyle = c; ctx.lineWidth = 2; poly(8, r * 1.15, rot); ctx.stroke(); ctx.restore(); }
      ctx.shadowColor = col; ctx.shadowBlur = 24; ctx.fillStyle = fl ? '#fff' : '#031225'; poly(8, r * 1.15, rot); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.stroke();
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#3dffb0'; poly(6, r * .8, -rot * 1.6); ctx.stroke(); ctx.strokeStyle = '#18e0ff'; poly(3, r * .5, rot * 2.4); ctx.stroke(); ctx.shadowBlur = 0;
      ctx.strokeStyle = col; for (let i = 0; i < 8; i += 2) { const a = rot + i * TAU / 8; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 1.15, Math.sin(a) * r * 1.15); ctx.lineTo(Math.cos(a) * r * 1.7, Math.sin(a) * r * 1.7); ctx.stroke(); }
      for (let i = 0; i < 6; i++) { const a = T * 1.2 + i * TAU / 6; ctx.fillStyle = i % 2 ? '#3dffb0' : col; ctx.save(); ctx.translate(Math.cos(a) * r * 1.55, Math.sin(a) * r * 1.55); ctx.rotate(a); ctx.fillRect(-6, -6, 12, 12); ctx.restore(); }
      const ang = Math.atan2(p.y - e.y, p.x - e.x); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, r * .42, r * .16, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(Math.cos(ang) * r * .16, Math.sin(ang) * r * .05, r * .09, r * .12, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(80,220,255,.12)'; for (let i = -4; i < 5; i++) ctx.fillRect(-r * 1.2, i * r * .26 + (T * 30 % (r * .26)), r * 2.4, 3);
      ctx.globalAlpha = 1;
    },
    // Lágrima Eterna: esfera de prata chorando, com bolhas orbitando e uma maré que puxa
    blacksorrow(r, T, col, e, p, fl) {
      const B = e.b;
      if (B.pull > 0) for (let i = 0; i < 4; i++) { const k = (T * 1.6 + i / 4) % 1; ring(0, 0, r * 4 * (1 - k) + r, '#ffffff', 3, k * .7); }
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(r * .14, r * .14, r * 1.1, 0, TAU); ctx.fill();
      const g = ctx.createRadialGradient(-r * .35, -r * .4, r * .1, 0, 0, r * 1.1); g.addColorStop(0, fl ? '#fff' : '#f2f4f8'); g.addColorStop(.45, fl ? '#fff' : col); g.addColorStop(1, '#1d2028');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.1, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.ellipse(-r * .45, -r * .55, r * .3, r * .16, -.6, 0, TAU); ctx.fill();
      const ty = r * 1.1 + 6 + Math.sin(T * 2) * 4; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, r * 1.05); ctx.quadraticCurveTo(r * .5, ty + r * .3, 0, ty + r * .85); ctx.quadraticCurveTo(-r * .5, ty + r * .3, 0, r * 1.05); ctx.fill();
      const ang = Math.atan2(p.y - e.y, p.x - e.x);
      for (const sx of [-1, 1]) { const ex = sx * r * .38; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, 0, r * .2, r * .26, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#10121a'; ctx.beginPath(); ctx.arc(ex + Math.cos(ang) * r * .07, Math.sin(ang) * r * .08 + r * .04, r * .11, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#1d2028'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(ex + sx * r * .26, -r * .18); ctx.lineTo(ex - sx * r * .26, -r * .4); ctx.stroke();
        ctx.fillStyle = 'rgba(170,210,255,.8)'; ctx.beginPath(); ctx.ellipse(ex, r * .38 + (T * 40 % (r * .5)), r * .035, r * .07, 0, 0, TAU); ctx.fill(); }
      for (let i = 0; i < 4; i++) { const a = T * 1.1 + i * TAU / 4, bx = Math.cos(a) * r * 1.95, by = Math.sin(a) * r * 1.95, gr = ctx.createRadialGradient(bx - 7, by - 7, 2, bx, by, 22); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(150,160,185,.35)'); ctx.fillStyle = gr; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, 20, 0, TAU); ctx.fill(); ctx.stroke(); }
    },
    // Imperatriz Lunar: mariposa com corpo de lua, asas de fita e investida
    ruler(r, T, col, e, p, fl) {
      const B = e.b, w = Math.sin(T * 3) * .3;
      if (B.dash) { ctx.save(); ctx.rotate(B.dash.a); ctx.strokeStyle = `rgba(255,230,160,${.35 + .3 * Math.sin(T * 30)})`; ctx.lineWidth = 6; ctx.setLineDash([16, 10]); ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(900, 0); ctx.stroke(); ctx.restore(); }
      ctx.shadowColor = '#fff2d1'; ctx.shadowBlur = 26;
      for (const sx of [-1, 1]) for (const [k, sc] of [[0, 1], [1, .62]]) {
        ctx.fillStyle = fl ? '#fff' : (k ? 'rgba(232,220,192,.55)' : 'rgba(255,245,220,.42)');
        ctx.beginPath(); ctx.moveTo(sx * r * .4, -r * .2 + k * r * .5); ctx.quadraticCurveTo(sx * r * 2.6 * sc, -r * (1.9 + w) * sc + k * r * .8, sx * r * 2.5 * sc, r * (.3 - w * .5) + k * r * 1.1); ctx.quadraticCurveTo(sx * r * 1.4, r * .6 + k * r, sx * r * .4, r * .3 + k * r * .3); ctx.fill(); ctx.strokeStyle = 'rgba(70,50,20,.75)'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,214,120,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx * r * .5, 0); ctx.quadraticCurveTo(sx * r * 1.6 * sc, -r * (.9 + w) * sc, sx * r * 2.2 * sc, -r * .1 + k * r * .8); ctx.stroke(); }
      ctx.shadowBlur = 0; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(232,220,192,.5)'; ctx.lineWidth = r * .22; ctx.beginPath(); ctx.moveTo(0, r * .8); ctx.bezierCurveTo(Math.sin(T * 2) * r, r * 1.4, -Math.sin(T * 2) * r, r * 2, Math.sin(T * 2.4) * r * .6, r * 2.6); ctx.stroke();
      const g = ctx.createRadialGradient(-r * .3, -r * .3, r * .1, 0, 0, r); g.addColorStop(0, '#fffaf0'); g.addColorStop(1, fl ? '#fff' : '#d4c7ad'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * .95, 0, TAU); ctx.fill(); ctx.strokeStyle = '#7a6a48'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = 'rgba(120,105,80,.2)'; ctx.beginPath(); ctx.arc(r * .3, r * .2, r * .22, 0, TAU); ctx.arc(-r * .35, -r * .1, r * .14, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,230,160,.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, -r * 1.3, r * .6, r * .17, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#e8dcc0'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * r * .2, -r * .85); ctx.quadraticCurveTo(sx * r * .5, -r * 1.5, sx * r * (.9 + w * .3), -r * 1.8); ctx.stroke(); }
      eyes(2, r * .95, e, p, -r * .05, .2);
    },
    // Nave-Mãe: disco voador gigante com cúpula, luzes e feixe trator
    cure(r, T, col, e, p, fl) {
      ctx.translate(0, Math.sin(T * 2) * 4);
      ctx.fillStyle = 'rgba(160,235,255,.16)'; ctx.beginPath(); ctx.moveTo(-r * .9, r * .5); ctx.lineTo(r * .9, r * .5); ctx.lineTo(r * 2, r * 3); ctx.lineTo(-r * 2, r * 3); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, r * 3.1, r * 1.8, r * .35, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = fl ? '#fff' : '#2c3a48'; ctx.beginPath(); ctx.ellipse(0, r * .3, r * 2, r * .65, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 3.5; ctx.shadowColor = col; ctx.shadowBlur = 20; ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = fl ? '#fff' : '#1a2430'; ctx.beginPath(); ctx.ellipse(0, r * .55, r * 1.3, r * .3, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = col; ctx.globalAlpha = .5; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.05, r * 1.05, 0, Math.PI, 0); ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = '#d5f6ff'; ctx.lineWidth = 2; ctx.stroke();
      for (let i = 0; i < 9; i++) { const a = T * 1.4 + i * TAU / 9; ctx.fillStyle = Math.sin(a * 2) > 0 ? '#fff' : col; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 1.75, r * .3 + Math.sin(a) * r * .4, 3.4, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = col; ctx.lineWidth = 3; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * r * .5, -r * .9); ctx.lineTo(sx * r * .75, -r * 1.55); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx * r * .75, -r * 1.55, 4, 0, TAU); ctx.fill(); }
      eyes(3, r * 1.3, e, p, -r * .2, .17);
    },
    // ---- chefes extras ----
    // Clematis Eterna: flor de clematis gigante, pétalas em duas camadas
    clementis_b(r, T, col, e, p, fl) {
      const rg = ctx.createRadialGradient(0, 0, r * .3, 0, 0, r * 2.8); rg.addColorStop(0, col + '55'); rg.addColorStop(1, col + '00'); ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, r * 2.8, 0, TAU); ctx.fill();
      const open = .92 + .08 * Math.sin(T * 2);
      for (let layer = 0; layer < 2; layer++) for (let i = 0; i < 6; i++) {
        const a = T * (layer ? -.35 : .35) + i * TAU / 6 + layer * TAU / 12, L = r * (layer ? 1.7 : 2.3) * open;
        ctx.save(); ctx.rotate(a); ctx.fillStyle = fl ? '#fff' : (layer ? '#ffd1ec' : col); ctx.globalAlpha = layer ? .92 : .78;
        ctx.beginPath(); ctx.moveTo(r * .3, 0); ctx.quadraticCurveTo(L * .55, -r * .62, L, 0); ctx.quadraticCurveTo(L * .55, r * .62, r * .3, 0); ctx.fill();
        ctx.strokeStyle = 'rgba(120,10,90,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(r * .4, 0); ctx.lineTo(L * .9, 0); ctx.stroke(); ctx.restore(); }
      ctx.globalAlpha = 1; ctx.fillStyle = fl ? '#fff' : '#3a0f45'; ctx.beginPath(); ctx.arc(0, 0, r * .62, 0, TAU); ctx.fill(); ctx.strokeStyle = '#ffd1ec'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#ffe3f4'; for (let i = 0; i < 10; i++) { const a = i * TAU / 10 + T; ctx.beginPath(); ctx.arc(Math.cos(a) * r * .4, Math.sin(a) * r * .4, 3.2, 0, TAU); ctx.fill(); }
      eyes(2, r * .8, e, p, 0, .2);
    },
    // Axônio Desperto: neurônio gigante com dendritos e olho único
    clementis_c(r, T, col, e, p, fl) {
      ctx.lineCap = 'round';
      if (e.b.zap) { ctx.save(); ctx.rotate(e.b.zap.a); ctx.strokeStyle = `rgba(255,209,236,${.3 + .3 * Math.sin(T * 40)})`; ctx.lineWidth = 6; ctx.setLineDash([14, 10]); ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(900, 0); ctx.stroke(); ctx.restore(); }
      ctx.strokeStyle = col;
      for (let i = 0; i < 9; i++) {
        const a = i * TAU / 9 + T * .25, L = r * (1.9 + .5 * Math.sin(T * 1.5 + i * 2)), mx = Math.cos(a + .4) * L * .55, my = Math.sin(a + .4) * L * .55, ex = Math.cos(a) * L, ey = Math.sin(a) * L;
        ctx.globalAlpha = .85; ctx.lineWidth = r * .1; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * .5, Math.sin(a) * r * .5); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
        ctx.lineWidth = r * .05; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + Math.cos(a - 1) * r * .5, my + Math.sin(a - 1) * r * .5); ctx.stroke();
        ctx.globalAlpha = 1; ctx.fillStyle = Math.sin(T * 6 + i) > .6 ? '#fff' : '#ffd1ec'; ctx.beginPath(); ctx.arc(ex, ey, r * .1, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1; ctx.shadowColor = col; ctx.shadowBlur = 20;
      const g = ctx.createRadialGradient(-r * .25, -r * .25, r * .1, 0, 0, r * .9); g.addColorStop(0, fl ? '#fff' : '#ffd1ec'); g.addColorStop(1, fl ? '#fff' : col); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * .85, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.globalAlpha = .6; ctx.beginPath(); ctx.arc(0, 0, r * .42, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
      const ang = Math.atan2(p.y - e.y, p.x - e.x); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r * .22, 0, TAU); ctx.fill(); ctx.fillStyle = '#3a0f45'; ctx.beginPath(); ctx.arc(Math.cos(ang) * r * .08, Math.sin(ang) * r * .08, r * .11, 0, TAU); ctx.fill();
    },
    // Varredura Zero: monólito de quadrados concêntricos com linha de varredura
    blinkgone_b(r, T, col, e, p, fl) {
      ctx.shadowColor = col; ctx.shadowBlur = 22;
      for (let k = 0; k < 4; k++) { const q = r * (2.2 - k * .5); ctx.save(); ctx.rotate(k % 2 ? T * .5 : -T * .35); ctx.strokeStyle = k % 2 ? '#3dffb0' : col; ctx.lineWidth = 3.5 - k * .5; ctx.strokeRect(-q / 2, -q / 2, q, q); ctx.restore(); }
      ctx.shadowBlur = 0; ctx.fillStyle = fl ? '#fff' : '#031225'; ctx.fillRect(-r * .7, -r * .7, r * 1.4, r * 1.4); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.strokeRect(-r * .7, -r * .7, r * 1.4, r * 1.4);
      ctx.save(); ctx.beginPath(); ctx.rect(-r * .7, -r * .7, r * 1.4, r * 1.4); ctx.clip(); ctx.fillStyle = 'rgba(80,220,255,.28)'; ctx.fillRect(-r * .7, ((T * 1.1) % 1) * r * 1.4 - r * .7, r * 1.4, 10); ctx.fillStyle = 'rgba(61,255,176,.16)'; for (let i = -3; i < 4; i++) ctx.fillRect(-r * .7, i * r * .2, r * 1.4, 2); ctx.restore();
      const ang = Math.atan2(p.y - e.y, p.x - e.x); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, r * .45, r * .18, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(Math.cos(ang) * r * .16, Math.sin(ang) * r * .06, r * .1, 0, TAU); ctx.fill();
      for (let i = 0; i < 4; i++) { const a = T * 1.3 + i * TAU / 4; ctx.fillStyle = i % 2 ? '#3dffb0' : col; ctx.fillRect(Math.cos(a) * r * 1.7 - 5, Math.sin(a) * r * 1.7 - 5, 10, 10); }
    },
    // Sinal Fantasma: três triângulos RGB que se separam
    blinkgone_c(r, T, col, e, p, fl) {
      const B = e.b, dash = B.dash && B.dash.t > .6;
      if (B.dash && B.dash.t <= .6) { ctx.save(); ctx.rotate(B.dash.a); ctx.strokeStyle = `rgba(255,46,136,${.35 + .3 * Math.sin(T * 30)})`; ctx.lineWidth = 6; ctx.setLineDash([16, 10]); ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(900, 0); ctx.stroke(); ctx.restore(); }
      ctx.globalCompositeOperation = 'lighter';
      ['#ff2e88', '#3dffb0', '#18e0ff'].forEach((c, i) => { const o = Math.sin(T * 3 + i * 2.1) * r * .18 + (dash ? Math.sin(T * 50 + i) * 8 : 0); ctx.save(); ctx.translate(Math.cos(i * 2.1 + T) * o, Math.sin(i * 2.1 + T) * o); ctx.fillStyle = c; ctx.globalAlpha = fl ? 1 : .42; poly(3, r * 1.25, -Math.PI / 2 + T * .4 * (i - 1)); ctx.fill(); ctx.strokeStyle = c; ctx.globalAlpha = 1; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore(); });
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      const ang = Math.atan2(p.y - e.y, p.x - e.x); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, 0, r * .32, r * .2, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#031225'; ctx.beginPath(); ctx.arc(Math.cos(ang) * r * .1, Math.sin(ang) * r * .07, r * .11, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.12)'; for (let i = -3; i < 4; i++) ctx.fillRect(-r * 1.2, i * r * .3 + (T * 40 % (r * .3)), r * 2.4, 2);
    },
    // Anel do Lamento: anéis de prata concêntricos em volta de um orbe escuro
    blacksorrow_b(r, T, col, e, p, fl) {
      for (let i = 0; i < 3; i++) { ctx.save(); ctx.scale(1, .42 + .08 * i); ctx.rotate(T * (.4 + i * .15) * (i % 2 ? -1 : 1)); ctx.strokeStyle = i ? 'rgba(220,225,235,.55)' : '#ffffff'; ctx.lineWidth = r * (.2 - i * .05); if (!i) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 16; } ctx.beginPath(); ctx.arc(0, 0, r * (1.6 + i * .4), 0, TAU); ctx.stroke(); ctx.restore(); }
      ctx.shadowBlur = 0; const g = ctx.createRadialGradient(-r * .3, -r * .35, r * .1, 0, 0, r); g.addColorStop(0, fl ? '#fff' : '#9aa1ad'); g.addColorStop(.6, fl ? '#fff' : '#2b2e35'); g.addColorStop(1, '#050506');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * .95, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3; ctx.stroke();
      eyes(2, r * .95, e, p, -r * .05, .2); ctx.fillStyle = 'rgba(170,210,255,.8)'; ctx.beginPath(); ctx.ellipse(-r * .3, r * .3 + (T * 40 % (r * .5)), r * .035, r * .07, 0, 0, TAU); ctx.fill();
      for (let i = 0; i < 5; i++) { const a = T * .9 + i * TAU / 5, bx = Math.cos(a) * r * 1.9, by = Math.sin(a) * r * 1.9 * .55; ctx.fillStyle = 'rgba(235,240,250,.7)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(bx, by, 9, 0, TAU); ctx.fill(); ctx.stroke(); }
    },
    // Gota Primordial: lágrima gigante de prata que salta
    blacksorrow_c(r, T, col, e, p, fl) {
      if (e.b.sq) ctx.globalAlpha = Math.sin(T * 40) > 0 ? .25 : .6;
      const k = 1 + Math.sin(T * 3) * .04; ctx.scale(1 / k, k);
      ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(0, r * 1.5, r * 1.1, r * .22, 0, 0, TAU); ctx.fill();
      const g = ctx.createRadialGradient(-r * .4, -r * .2, r * .1, 0, 0, r * 1.5); g.addColorStop(0, fl ? '#fff' : '#f2f4f8'); g.addColorStop(.5, fl ? '#fff' : col); g.addColorStop(1, '#1d2028');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -r * 1.7); ctx.bezierCurveTo(r * .35, -r, r * 1.15, -r * .2, r * 1.1, r * .4); ctx.bezierCurveTo(r * 1.05, r * 1.1, r * .5, r * 1.4, 0, r * 1.4); ctx.bezierCurveTo(-r * .5, r * 1.4, -r * 1.05, r * 1.1, -r * 1.1, r * .4); ctx.bezierCurveTo(-r * 1.15, -r * .2, -r * .35, -r, 0, -r * 1.7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.ellipse(-r * .5, -r * .1, r * .16, r * .42, .3, 0, TAU); ctx.fill();
      eyes(2, r * .9, e, p, r * .3, .22);
      for (let i = 0; i < 3; i++) { const a = T * 1.4 + i * TAU / 3; ctx.fillStyle = 'rgba(200,215,240,.8)'; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 1.8, Math.sin(a) * r * 1.2, 6, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    },
    // Coração de Osso: coração pálido que pulsa, cercado de fitas
    ruler_b(r, T, col, e, p, fl) {
      const B = e.b, sc = 1 + (B.beat || 0) * 1.1 + Math.sin(T * 5) * .03; ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) { const a = (B.a || 0) * .5 + i * TAU / 6; ctx.strokeStyle = 'rgba(255,245,220,.45)'; ctx.lineWidth = r * .13; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); ctx.quadraticCurveTo(Math.cos(a + .7) * r * 1.9, Math.sin(a + .7) * r * 1.9, Math.cos(a + 1.5) * r * 2.4, Math.sin(a + 1.5) * r * 2.4); ctx.stroke(); }
      ctx.save(); ctx.scale(sc, sc); ctx.shadowColor = '#fff2d1'; ctx.shadowBlur = 24;
      const g = ctx.createRadialGradient(-r * .3, -r * .4, r * .1, 0, 0, r * 1.3); g.addColorStop(0, '#fffaf0'); g.addColorStop(1, fl ? '#fff' : '#d4c7ad');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, r * .95); ctx.bezierCurveTo(-r * 1.8, -r * .1, -r * 1, -r * 1.4, 0, -r * .55); ctx.bezierCurveTo(r * 1, -r * 1.4, r * 1.8, -r * .1, 0, r * .95); ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = '#7a6a48'; ctx.lineWidth = 3; ctx.stroke(); ctx.strokeStyle = 'rgba(122,106,72,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -r * .55); ctx.lineTo(r * .1, -r * .15); ctx.lineTo(-r * .12, r * .15); ctx.lineTo(r * .05, r * .6); ctx.stroke(); ctx.restore();
      eyes(2, r * .9, e, p, -r * .05, .17);
    },
    // Ceifadora Crescente: lua em crescente voltada para você, com foices em órbita
    ruler_c(r, T, col, e, p, fl) {
      const B = e.b, ang = Math.atan2(p.y - e.y, p.x - e.x);
      ctx.shadowColor = '#fff2d1'; ctx.shadowBlur = 20;
      for (let i = 0; i < 3; i++) { const a = B.a + i * TAU / 3; ctx.save(); ctx.translate(Math.cos(a) * r * 2.1, Math.sin(a) * r * 2.1); ctx.rotate(a + Math.PI / 2 + T * 6); ctx.fillStyle = '#fff2d1'; crescent(r * .55); ctx.fill(); ctx.restore(); }
      ctx.save(); ctx.rotate(ang + Math.PI); const g = ctx.createRadialGradient(-r * .3, -r * .3, r * .1, 0, 0, r * 1.5); g.addColorStop(0, '#fffaf0'); g.addColorStop(1, fl ? '#fff' : '#d4c7ad');
      ctx.fillStyle = g; crescent(r * 1.45); ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = '#7a6a48'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore(); ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(Math.cos(ang) * r * .35, Math.sin(ang) * r * .35, r * .3, 0, TAU); ctx.fill(); ctx.fillStyle = '#2a2014'; ctx.beginPath(); ctx.arc(Math.cos(ang) * r * .5, Math.sin(ang) * r * .5, r * .15, 0, TAU); ctx.fill();
    },
    // Farol da Névoa: torre cinzenta com um olho-lanterna que varre o palco
    cure_b(r, T, col, e, p, fl) {
      const B = e.b, two = e.hp / e.maxhp < .5;
      for (let k = 0; k < (two ? 2 : 1); k++) { ctx.save(); ctx.rotate(B.ba + k * Math.PI); const g = ctx.createLinearGradient(0, 0, 780, 0); g.addColorStop(0, 'rgba(213,246,255,.6)'); g.addColorStop(1, 'rgba(213,246,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(780, -39.6); ctx.lineTo(780, 39.6); ctx.lineTo(0, 10); ctx.closePath(); ctx.fill(); ctx.restore(); }
      ctx.fillStyle = fl ? '#fff' : '#3b4650'; ctx.beginPath(); ctx.moveTo(-r * .55, r * 1.6); ctx.lineTo(-r * .38, 0); ctx.lineTo(r * .38, 0); ctx.lineTo(r * .55, r * 1.6); ctx.closePath(); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = 'rgba(213,246,255,.22)'; for (let i = 0; i < 3; i++) ctx.fillRect(-r * .5 + i * r * .06, r * (.3 + i * .45), r * (1 - i * .12), r * .16);
      ctx.shadowColor = col; ctx.shadowBlur = 22; ctx.fillStyle = fl ? '#fff' : '#1a2430'; ctx.beginPath(); ctx.arc(0, 0, r * .75, 0, TAU); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 3.5; ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = '#d5f6ff'; ctx.beginPath(); ctx.arc(0, 0, r * .48, 0, TAU); ctx.fill(); ctx.fillStyle = '#10222c'; ctx.beginPath(); ctx.arc(Math.cos(B.ba) * r * .2, Math.sin(B.ba) * r * .2, r * .22, 0, TAU); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 3; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * r * .5, -r * .5); ctx.lineTo(sx * r * .7, -r * 1.1); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx * r * .7, -r * 1.1, 4, 0, TAU); ctx.fill(); }
    },
    // Serafim Cinzento: anjo de pedra com seis asas de penas e um halo
    cure_c(r, T, col, e, p, fl) {
      ctx.translate(0, Math.sin(T * 2) * 5);
      for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) { ctx.save(); ctx.scale(sx, 1); ctx.rotate(-.55 + k * .3 + Math.sin(T * 2 + k) * .05); ctx.fillStyle = fl ? '#fff' : (k % 2 ? 'rgba(213,246,255,.6)' : 'rgba(154,179,194,.8)'); ctx.beginPath(); ctx.ellipse(r * 1.55, 0, r * 1.25, r * .2, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(40,60,75,.7)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); }
      const g = ctx.createRadialGradient(-r * .3, -r * .35, r * .1, 0, 0, r); g.addColorStop(0, fl ? '#fff' : '#cfd6dc'); g.addColorStop(1, fl ? '#fff' : '#3b4650'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * .95, 0, TAU); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke();
      ctx.shadowColor = col; ctx.shadowBlur = 18; ctx.strokeStyle = '#d5f6ff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, -r * 1.4, r * .75, r * .2, 0, 0, TAU); ctx.stroke(); ctx.shadowBlur = 0;
      eyes(3, r * 1.15, e, p, -r * .05, .15);
    },
    // Roda do Retorno: roda de espinhos girando, hexágono dourado e núcleo carmesim com um olho
    karma(r, T, col, e, p, fl) {
      const rg = ctx.createRadialGradient(0, 0, r * .3, 0, 0, r * 2.6); rg.addColorStop(0, col + '55'); rg.addColorStop(1, col + '00'); ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, r * 2.6, 0, TAU); ctx.fill();
      ctx.save(); ctx.rotate(T * .5); ctx.fillStyle = fl ? '#fff' : '#3a0710'; ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath();
      for (let i = 0; i < 24; i++) { const a = i * TAU / 24, rr = i % 2 ? r * 1.15 : r * 1.55; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.rotate(-T * .8); ctx.strokeStyle = '#ffc15a'; ctx.lineWidth = 2.5; poly(6, r * .95, 0); ctx.stroke(); ctx.restore();
      ctx.shadowColor = col; ctx.shadowBlur = 20; ctx.fillStyle = fl ? '#fff' : col; ctx.beginPath(); ctx.arc(0, 0, r * .62, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
      eyes(1, r * 1.6, e, p, 0, .17);
    },
    // Tecelã de Fios: orbe com oito braços de fio terminando em nós dourados
    karma_b(r, T, col, e, p, fl) {
      ctx.lineCap = 'round'; ctx.strokeStyle = col;
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + Math.sin(T * 1.2 + i) * .12, L = r * (1.9 + .25 * Math.sin(T * 2 + i)), ca = Math.cos(a), sa = Math.sin(a);
        ctx.globalAlpha = .85; ctx.lineWidth = r * .09; ctx.beginPath(); ctx.moveTo(ca * r * .6, sa * r * .6); ctx.quadraticCurveTo(Math.cos(a + .5) * r * 1.2, Math.sin(a + .5) * r * 1.2, ca * L, sa * L); ctx.stroke();
        ctx.globalAlpha = 1; ctx.fillStyle = '#ffc15a'; ctx.beginPath(); ctx.arc(ca * L, sa * L, r * .09, 0, TAU); ctx.fill(); }
      ctx.shadowColor = col; ctx.shadowBlur = 20; ctx.fillStyle = fl ? '#fff' : '#3a0710'; ctx.beginPath(); ctx.arc(0, 0, r * .95, 0, TAU); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 3.5; ctx.stroke(); ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,193,90,.7)'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(0, 0, r * .8, r * (.25 + i * .22), T * .6 + i * 1.05, 0, TAU); ctx.stroke(); }
      ctx.lineCap = 'butt'; eyes(2, r * 1.1, e, p, -r * .05, .13);
    },
    // Juiz Carmesim: balança de ouro sob um halo, corpo em manto e um olho só
    karma_c(r, T, col, e, p, fl) {
      ctx.translate(0, Math.sin(T * 1.6) * 4);
      ctx.shadowColor = col; ctx.shadowBlur = 22; ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, -r * 1.35, r * .7, r * .18, 0, 0, TAU); ctx.stroke(); ctx.shadowBlur = 0;
      ctx.save(); ctx.rotate(Math.sin(T * 1.1) * .22); ctx.strokeStyle = '#ffc15a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-r * 1.7, 0); ctx.lineTo(r * 1.7, 0); ctx.stroke();
      for (const sx of [-1, 1]) { const px = sx * r * 1.7; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px - r * .45, r * .9); ctx.moveTo(px, 0); ctx.lineTo(px + r * .45, r * .9); ctx.stroke();
        ctx.fillStyle = fl ? '#fff' : '#ffc15a'; ctx.beginPath(); ctx.ellipse(px, r * .9, r * .5, r * .13, 0, 0, Math.PI); ctx.fill(); }
      ctx.restore();
      const g = ctx.createLinearGradient(0, -r, 0, r); g.addColorStop(0, fl ? '#fff' : '#7a1626'); g.addColorStop(1, fl ? '#fff' : '#2a050c'); ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(0, -r * 1.05); ctx.lineTo(r * .85, r); ctx.lineTo(-r * .85, r); ctx.closePath(); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke();
      eyes(1, r * 1.4, e, p, -r * .1, .2);
    },
    // Olho do Vazio: olho gigante em amêndoa; a íris gira e a pupila em fenda segue você
    unknown(r, T, col, e, p, fl) {
      const rg = ctx.createRadialGradient(0, 0, r * .3, 0, 0, r * 2.8); rg.addColorStop(0, col + '66'); rg.addColorStop(1, col + '00'); ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, r * 2.8, 0, TAU); ctx.fill();
      const ang = Math.atan2(p.y - e.y, p.x - e.x), open = .75 + .2 * Math.sin(T * 1.3), almond = () => { ctx.beginPath(); ctx.moveTo(-r * 1.5, 0); ctx.quadraticCurveTo(0, -r * 1.3 * open, r * 1.5, 0); ctx.quadraticCurveTo(0, r * 1.3 * open, -r * 1.5, 0); };
      ctx.shadowColor = col; ctx.shadowBlur = 24; almond(); ctx.fillStyle = fl ? '#fff' : '#e6fffb'; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.stroke(); ctx.shadowBlur = 0;
      ctx.save(); almond(); ctx.clip(); const ix = Math.cos(ang) * r * .35, iy = Math.sin(ang) * r * .22;
      ctx.fillStyle = fl ? '#fff' : col; ctx.beginPath(); ctx.arc(ix, iy, r * .72, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ff3b5c'; ctx.lineWidth = 2; ctx.setLineDash([5, 9]); ctx.save(); ctx.translate(ix, iy); ctx.rotate(T * .8); ctx.beginPath(); ctx.arc(0, 0, r * .56, 0, TAU); ctx.stroke(); ctx.restore(); ctx.setLineDash([]);
      ctx.fillStyle = '#021214'; ctx.beginPath(); ctx.ellipse(ix, iy, r * .12, r * .6, 0, 0, TAU); ctx.fill(); ctx.restore();
    },
    // Glifo Errante: um ponto de interrogação vivo cercado de orbes
    unknown_b(r, T, col, e, p, fl) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 ${r * 3.1}px ${FONT}`;
      ctx.shadowColor = col; ctx.shadowBlur = 24; ctx.fillStyle = fl ? '#fff' : col; ctx.fillText('?', 0, -r * .1); ctx.shadowBlur = 0; ctx.strokeStyle = '#a8fff2'; ctx.lineWidth = 2; ctx.strokeText('?', 0, -r * .1);
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
      for (let i = 0; i < 6; i++) { const a = T * 1.4 + i * TAU / 6; ctx.fillStyle = i % 2 ? '#a8fff2' : '#ff3b5c'; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.5, 6, 0, TAU); ctx.fill(); }
    },
    // Estática: quadrados girando com canais de cor separados e ruído dentro do núcleo
    unknown_c(r, T, col, e, p, fl) {
      for (const [c2, dx] of [['#ff2e88', -5], ['#ff3b5c', 5]]) { ctx.save(); ctx.translate(dx, 0); ctx.globalAlpha = .55; ctx.strokeStyle = c2; ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) { const q = r * (1.2 - i * .22); ctx.save(); ctx.rotate(T * (.5 + i * .3) * (i % 2 ? -1 : 1) + i); ctx.strokeRect(-q, -q, q * 2, q * 2); ctx.restore(); } ctx.restore(); }
      ctx.globalAlpha = 1; ctx.shadowColor = col; ctx.shadowBlur = 20; ctx.fillStyle = fl ? '#fff' : '#04181c'; ctx.beginPath(); ctx.arc(0, 0, r * .95, 0, TAU); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.stroke(); ctx.shadowBlur = 0;
      for (let i = 0; i < 26; i++) { const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * r * .85, z = 3 + Math.random() * 7; ctx.fillStyle = Math.random() < .5 ? 'rgba(200,255,248,.8)' : 'rgba(255,255,255,.55)'; ctx.fillRect(Math.cos(a) * d, Math.sin(a) * d, z, z * .5); }
      eyes(2, r * 1.1, e, p, -r * .05, .13);
    }
  };

  // ---------- HUD temático (painéis chanfrados, neon ciano/rosa, estrelas) ----------
  const FONT = '"Bahnschrift","Segoe UI",system-ui,sans-serif';
  const chamf = (x, y, w, h, c) => { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w - c, y); ctx.lineTo(x + w, y + c); ctx.lineTo(x + w, y + h); ctx.lineTo(x + c, y + h); ctx.lineTo(x, y + h - c); ctx.closePath(); };
  const panel = (x, y, w, h, c, col, a = .82) => { chamf(x, y, w, h, c); const g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, `rgba(24,26,80,${a})`); g.addColorStop(1, `rgba(8,10,30,${a})`); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke(); };
  const gbar = (x, y, w, h, c, k, c1, c2) => {
    chamf(x, y, w, h, c); ctx.fillStyle = 'rgba(2,3,14,.88)'; ctx.fill();
    if (k > 0) { ctx.save(); chamf(x, y, w, h, c); ctx.clip(); const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, c1); g.addColorStop(1, c2); ctx.fillStyle = g; ctx.fillRect(x, y, w * Math.min(1, k), h); ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(x, y, w * Math.min(1, k), h * .38); ctx.restore(); }
    chamf(x, y, w, h, c); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.2; ctx.stroke();
  };
  const txt = (t, x, y, size, col, al = 'left', wgt = 700, ls = 0, mw = 0) => {
    if ('letterSpacing' in ctx) ctx.letterSpacing = ls + 'px'; ctx.font = `${wgt} ${size}px ${FONT}`;
    if (mw) while (size > 7 && ctx.measureText(t).width > mw) { size -= .5; ctx.font = `${wgt} ${size}px ${FONT}`; }   // encolhe o texto para caber
    ctx.textAlign = al; ctx.fillStyle = col; ctx.fillText(t, x, y); if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  };
  const dia = (x, y, r) => { ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); };
  const mmss = t => String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
  function drawHUD() {
    const p = s.p, col = ch.col, u = Math.max(.8, Math.min(1.15, Math.min(W, H * 1.7) / 1100)), w = W / u, h = H / u, pul = .5 + .5 * Math.sin(s.t * 6);
    // bordas avisam: pouca vida (vermelho) ou chefe chegando
    const lowHp = p.hp / p.max < .3, flash = Math.max(s.hurtT || 0, 0);
    if (lowHp || s.warn > 0 || flash > 0) { const c2 = s.warn > 0 ? (s.bossE ? s.bossE.col : map.boss.col) : '#ff1f4b', a = (s.warn > 0 ? .35 : lowHp ? .18 + .14 * pul : 0) + flash * .5, g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .75); g.addColorStop(0, c2 + '00'); g.addColorStop(1, c2 + 'cc'); ctx.globalAlpha = Math.min(.9, a * (s.warn > 0 ? .5 + .5 * pul : 1)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    ctx.save(); ctx.scale(u, u); ctx.imageSmoothingEnabled = false;

    // --- barra de experiência no topo, em segmentos
    const xk = Math.min(1, p.xp / p.next);
    ctx.fillStyle = 'rgba(2,3,14,.85)'; ctx.fillRect(0, 0, w, 9);
    let g = ctx.createLinearGradient(0, 0, w, 0); g.addColorStop(0, col); g.addColorStop(1, '#ffffff'); ctx.fillStyle = g; ctx.fillRect(0, 0, w * xk, 8);
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(0, 0, w * xk, 3);
    ctx.fillStyle = 'rgba(2,3,14,.9)'; for (let i = 1; i < 10; i++) ctx.fillRect(w * i / 10 - 1, 0, 2, 9);
    ctx.fillStyle = col; ctx.globalAlpha = .7; ctx.fillRect(0, 9, w, 1); ctx.globalAlpha = 1;
    if (xk > .01) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.shadowColor = col; ctx.shadowBlur = 12; ctx.fillStyle = '#fff'; star4(w * xk, 4.5, 9, s.t * 2); ctx.fill(); ctx.restore(); }

    // --- retrato + vida
    const px = 14, py = 22; ctx.save(); ctx.beginPath(); ctx.arc(px + 30, py + 30, 29, 0, TAU); ctx.fillStyle = 'rgba(8,10,34,.92)'; ctx.fill(); ctx.clip();
    const sh = Math.min(img.height, img.width * 1.15); ctx.drawImage(img, 0, 0, img.width, sh, px + 3, py + 4, 54, 54 * sh / img.width); ctx.restore();
    ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 12; ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px + 30, py + 30, 29, 0, TAU); ctx.stroke(); ctx.restore();
    ctx.fillStyle = col; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; dia(px + 52, py + 54, 13); ctx.fill(); ctx.stroke(); txt(String(p.lv), px + 52, py + 59, 13, '#07081a', 'center', 800);
    txt(ch.name.toUpperCase(), px + 72, py + 11, 12, col, 'left', 800, 3);
    const hk = Math.max(0, p.hp) / p.max, hx = px + 72, hy = py + 17, hw = 214, hcol = hk < .3 ? ['#ff1f4b', '#ff6a86'] : ['#ff2e88', '#ff8a5c'];
    gbar(hx, hy, hw, 20, 8, hk, hcol[0], hcol[1]); txt(`${Math.ceil(Math.max(0, p.hp))} / ${p.max}`, hx + hw / 2, hy + 15, 12, '#fff', 'center', 700, 1);
    if (p.inv > 0 && p.inv < 1.2 && Math.floor(s.t * 20) % 2 === 0) { chamf(hx, hy, hw, 20, 8); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.fillStyle = '#ffd23f'; ctx.save(); ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 8; star4(hx + 8, py + 50, 7, s.t); ctx.fill(); ctx.restore();
    txt(String(s.kills), hx + 20, py + 56, 16, '#fff', 'left', 800); const kw = ctx.measureText(String(s.kills)).width; txt('ELIMINADOS', hx + 26 + kw, py + 55, 9, 'rgba(200,210,255,.7)', 'left', 700, 2);
    if (s.shield > 0) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hx + hw - 10, py + 50, 7, 0, TAU); ctx.stroke(); txt('ESCUDO', hx + hw - 20, py + 54, 9, '#fff', 'right', 800, 2); }
    else if (s.adr > 0) txt('ADRENALINA', hx + hw, py + 54, 9, PCOL('till'), 'right', 800, 2);

    // --- cronômetro com colchetes (como o logo) + nome do palco
    const cw = 160, cx0 = w / 2 - cw / 2; panel(cx0, 16, cw, 38, 10, 'rgba(62,240,255,.75)', .78);
    txt('[', cx0 + 14, 46, 36, '#3ef0ff', 'center', 100); txt(']', cx0 + cw - 14, 46, 36, '#ff2e88', 'center', 100);
    txt(mmss(Math.floor(s.t)), w / 2, 44, 24, '#fff', 'center', 300, 4); txt(map.name.toUpperCase(), w / 2, 67, 10, map.col, 'center', 700, 3);

    // --- barra do chefe
    const be = s.bossE;
    if (be && !be.dead) {
      const bw = Math.min(560, w * .5), bx = w / 2 - bw / 2, by = 100, bk = Math.max(0, be.hp) / be.maxhp;
      panel(bx - 12, by - 20, bw + 24, 44, 10, be.def.col, .8);
      txt('◆ ' + be.def.name.toUpperCase(), bx, by - 5, 13, '#fff', 'left', 800, 3); txt('CHEFE', bx + bw, by - 5, 10, be.def.col, 'right', 800, 3);
      gbar(bx, by + 2, bw, 16, 7, bk, '#ff2e88', be.def.col);
      ctx.fillStyle = 'rgba(2,3,14,.9)'; for (const q of [.3, .6]) ctx.fillRect(bx + bw * q - 1, by + 2, 2, 16);
      if (be.flash > 0) { chamf(bx, by + 2, bw, 16, 7); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fill(); }
    }

    // --- habilidade especial (E) + ultimate (ESPAÇO) + sinergia ativa
    const c = s.cmb, uw = 270, spw = 236, stack = w < 580, sy = h - 76, ux = stack ? w / 2 - uw / 2 : w / 2 - (spw + 12 + uw) / 2 + spw + 12, sx = stack ? ux : ux - spw - 12, sy2 = stack ? sy - 62 : sy, cy0 = (stack ? sy2 : sy);
    if (c) {
      const rc = RARITY[c.rar].col, pt = comboPartner(c, ch.id); panel(ux, cy0 - 40, uw, 32, 9, rc, .86);
      const im = cuts && cuts[pt]; ctx.save(); ctx.beginPath(); ctx.arc(ux + 22, cy0 - 24, 12, 0, TAU); ctx.fillStyle = 'rgba(8,10,34,.95)'; ctx.fill(); ctx.clip(); if (im && im.width) ctx.drawImage(im, 0, 0, im.width, im.width * 1.1, ux + 9, cy0 - 37, 26, 28); ctx.restore();
      ctx.strokeStyle = PCOL(pt); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ux + 22, cy0 - 24, 12, 0, TAU); ctx.stroke();
      txt('✦ ' + c.name.toUpperCase(), ux + 42, cy0 - 20, 12, '#fff', 'left', 800, 2, uw - 42 - 82); txt(RARITY[c.rar].n, ux + uw - 12, cy0 - 20, 9, rc, 'right', 800, 2);
    }
    const abil = (x, y, aw, name, st, key, icon, acol, ult) => {
      const rdy = st.cd <= 0, k = 1 - st.cd / st.max;
      if (rdy) { chamf(x - 2, y - 2, aw + 4, 60, 13); ctx.strokeStyle = acol; ctx.globalAlpha = .35 + .3 * pul; ctx.lineWidth = 4; ctx.stroke(); ctx.globalAlpha = 1; } panel(x, y, aw, 56, 12, rdy ? '#ffffff' : 'rgba(255,255,255,.4)', .88);
      ctx.fillStyle = rdy ? acol : '#3a3a68'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; dia(x + 28, y + 28, ult ? 17 : 15); ctx.fill(); ctx.stroke(); txt(icon, x + 28, y + 35, ult ? 19 : 17, rdy ? '#07081a' : '#aab', 'center', 800);
      txt(name.toUpperCase(), x + 52, y + 20, ult ? 13 : 12, '#fff', 'left', 800, 1, aw - 52 - 68);
      txt(rdy ? '[' + key + ']' : st.cd.toFixed(1) + 's', x + aw - 12, y + 20, 11, rdy ? acol : 'rgba(200,210,255,.7)', 'right', 800, 1);
      gbar(x + 52, y + 30, aw - 66, 14, 6, k, rdy ? acol : '#4a4a8a', rdy ? '#ffffff' : '#7a7ac0');
    };
    abil(sx, sy2, spw, ch.sp.n, s.sp, 'E', '✦', ch.acc, false);
    abil(ux, sy, uw, c ? c.u.n : ch.sk.n, s.sk, 'ESPAÇO', '★', ch.col, true);

    // --- buffs ativos (etiquetas)
    const tags = []; const B = s.b;
    if (B.rage > 0) tags.push(['FÚRIA', '#ff4d4d', B.rage]); if (B.hy > 0) tags.push(['IMPULSO', PACC('hyuna'), B.hy]); if (B.lk > 0) tags.push(['SÍNDROME', '#b57bff', B.lk]); if (B.vv > 0) tags.push(['ESCUDO', '#a56bff', B.vv]); if (B.cl > 0) tags.push(['FRENESI ×4', '#ffe066', B.cl]); if (B.fz > 0) tags.push(['FUGA', '#6ec8ff', B.fz]); if (B.hr > 0) tags.push(['ADRENALINA', '#ffe066', B.hr]); if (B.sac > 0) tags.push(['SACRIFÍCIO ×3', '#ffd23f', B.sac]);
    if (s.imm > 0 && !B.sac) tags.push(['IMUNE', '#fff2b0', s.imm]); if (s.pacify > 0) tags.push(['PALCO', '#c9b8ff', s.pacify]); if (s.freeze > 0) tags.push(['TEMPO PARADO', '#ff7a8c', s.freeze]); if ((s.cs || 0) > 0) tags.push(['CORAGEM ×' + s.cs, PACC('hyuna'), s.csT]); if ((s.stk || 0) > 0 && s.zone) tags.push(['TRANSFUSÃO ×' + s.stk, '#ff6a5c', 9]); if (s.absorb && s.absorb.t > 0) tags.push(['ABSORVENDO', PCOL('hyuna'), s.absorb.t]);
    tags.forEach((q, i) => { const tx = px + 72 + (i % 3) * 78, ty = py + 64 + Math.floor(i / 3) * 16; chamf(tx, ty, 74, 14, 4); ctx.fillStyle = 'rgba(8,10,34,.8)'; ctx.fill(); ctx.strokeStyle = q[1]; ctx.lineWidth = 1; ctx.stroke(); txt(q[0], tx + 37, ty + 10.5, 8, q[1], 'center', 800, 1, 68); });

    // --- armas e melhorias
    const chips = [['♪', s.w.mic, ch.weapon], ['◎', s.w.wave, 'Onda'], ['✦', s.w.orbit, 'Holofotes']].filter((q, i) => !i || q[1] > 0); if (p.mag > 0) chips.push(['⌖', p.mag, 'Ímã']);
    chips.forEach((q, i) => { const x = 14 + i * 46, y = h - 66; panel(x, y, 40, 46, 8, col, .84); txt(q[0], x + 20, y + 24, 20, '#fff', 'center', 800);
      for (let j = 0; j < MAXLV; j++) { ctx.fillStyle = j < q[1] ? col : 'rgba(255,255,255,.18)'; ctx.fillRect(x + 6 + j * 5, y + 33, 4, 5); } });
    // --- carta de tarô: progresso de desbloqueio ou nível atual
    const T = TAROT[ch.id], rec = cb.tarot && cb.tarot[ch.id], ti = tarotImg && tarotImg[ch.id];
    if (rec && rec.u) { const x = 14, y = h - 136; panel(x, y - 2, 46, 66, 8, col, .9); if (ti && ti.width) ctx.drawImage(ti, x + 4, y + 2, 38, 38 * ti.height / ti.width); ctx.globalAlpha = s.tr.tier ? 1 : .55;
      for (let j = 0; j < 3; j++) { ctx.fillStyle = j < s.tr.tier ? '#ffd23f' : 'rgba(255,255,255,.25)'; dia(x + 12 + j * 11, y + 56, 4); ctx.fill(); } ctx.globalAlpha = 1; }
    else if (rec) { const x = 14, y = h - 112, kk = Math.min(1, rec.p / T.goal); panel(x, y, 150, 34, 8, 'rgba(255,255,255,.3)', .8); txt('TARÔ · ' + T.n.toUpperCase(), x + 8, y + 13, 9, '#fff', 'left', 800, 1, 134); gbar(x + 8, y + 19, 134, 8, 4, kk, col, '#ffffff'); }
    ctx.restore();
  }
  function drawBan() {
    const b = s.ban; if (!b || b.t <= 0) return; const k = b.t / b.max, a = Math.min(1, k * 3, (1 - k) * 8 + .2), col = b.col || ch.col, big = b.sub && b.sub.startsWith('CHEFE DO');
    ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.textAlign = 'center'; const len = b.txt.length, fs = Math.min(46 + (1 - k) * 14, W * .92 / (len * .82 + 4)), yy = H * .24 - (1 - k) * 18;
    ctx.font = `800 ${fs}px ${FONT}`; if ('letterSpacing' in ctx) ctx.letterSpacing = Math.round(fs / 6) + 'px';
    ctx.shadowColor = col; ctx.shadowBlur = 24; ctx.fillStyle = '#fff'; ctx.fillText(b.txt, W / 2, yy); ctx.shadowBlur = 0; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeText(b.txt, W / 2, yy);
    if (b.sub) { ctx.font = `700 ${Math.max(11, fs * .3)}px ${FONT}`; if ('letterSpacing' in ctx) ctx.letterSpacing = '5px'; ctx.fillStyle = col; ctx.fillText(b.sub, W / 2, yy + fs * .6); }
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'; ctx.restore();
  }

  // ---------- regras especiais de cada palco ----------
  // Karma: toda vez que você sofre dano, uma onda de retribuição devolve golpes aos aliens por perto
  function karmaWave(d) {
    const p = s.p, R = 190, dm = (14 + d * 2.2) * s.dmg;
    for (const q of s.en) if (!q.dead && hyp(q.x - p.x, q.y - p.y) < R + q.r) hurt(q, dm, '#ff4757');
    s.fx.push({ x: p.x, y: p.y, r: R, life: .5, col: '#ff4757' }); s.fx.push({ x: p.x, y: p.y, r: R * .6, life: .35, col: '#ffc15a' }); burst(p.x, p.y, '#ff4757', 14, 220, .5, 3);
  }
  function mapTick(dt) {
    const p = s.p;
    if (map.id === 'unknown') {         // Anomalia: a cada 25s algo inesperado acontece (quase sempre a seu favor)
      s.anoT = (s.anoT ?? 20) - dt;
      if (s.anoT <= 0 && !(s.ban && s.ban.t > 0)) {
        s.anoT = 25; const k = Math.floor(Math.random() * 4), COL = '#38e0d0', B = ['CHUVA DE NOTAS', 'CURA', 'ALIENS LENTOS', 'EMBOSCADA'][k];
        if (k === 0) for (let i = 0; i < 16; i++) { const a = Math.random() * TAU, d = 50 + Math.random() * 130; s.gems.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, v: 2 }); }
        else if (k === 1) { p.hp = Math.min(p.max, p.hp + p.max * .18); burst(p.x, p.y, '#38e0d0', 18, 170, .6, 3); }
        else if (k === 2) for (const q of s.en) slowE(q, 6, .45);
        else for (let i = 0; i < 8; i++) { const a = i * TAU / 8, d = 280; minion('fast', p.x + Math.cos(a) * d, p.y + Math.sin(a) * d); }
        s.ban = { txt: 'ANOMALIA', t: 1.6, max: 1.6, col: COL, sub: B }; s.fl = { col: COL, t: .35, max: .35 };
      }
    }
    if (map.id === 'blacksorrow') {
      s.bubT = (s.bubT ?? 8) - dt;
      if (s.bubT <= 0 && s.bub.length < 3) { s.bubT = 18; const a = Math.random() * TAU, d = 180 + Math.random() * 160; s.bub.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d }); }
      for (const b of s.bub) if (hyp(b.x - p.x, b.y - p.y) < p.r + 24) { b.got = 1; s.shield = 1; burst(b.x, b.y, '#fff', 14, 160, .5, 3); }
      compact(s.bub, b => !b.got);
    }
    if (map.id === 'cure') {
      s.strT = (s.strT ?? 3) - dt;
      if (s.strT <= 0 && s.en.length) { s.strT = 3.5; const c = s.en.filter(e => hyp(e.x - p.x, e.y - p.y) < 500), o = c.length ? c[Math.floor(Math.random() * c.length)] : null;
        if (o) s.eff.push({ t: 0, life: .7, x: o.x, y: o.y, boom: 0,
          upd(e) { if (!e.boom && e.t >= .3) { e.boom = 1; for (const q of s.en) if (hyp(q.x - e.x, q.y - e.y) < 85 + q.r) hurt(q, 45 * s.dmg, '#bff'); burst(e.x, e.y, '#bff', 16, 200, .5, 4); s.shake = Math.max(s.shake, .1); } },
          draw(e) { ctx.save(); const w = e.t < .3 ? 6 + e.t * 40 : 40 * (1 - (e.t - .3) / .4); ctx.globalAlpha = e.t < .3 ? .5 : Math.max(0, 1 - (e.t - .3) / .4);
            const g = ctx.createLinearGradient(0, e.y - 700, 0, e.y); g.addColorStop(0, 'rgba(190,240,255,0)'); g.addColorStop(1, '#dff'); ctx.fillStyle = g; ctx.fillRect(e.x - w / 2, e.y - 700, w, 700);
            ctx.strokeStyle = '#bff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(e.x, e.y, 85, 85 * .35, 0, 0, TAU); ctx.stroke(); ctx.restore(); } }); }
    }
  }

  // ---------- animação de morte própria de cada personagem ----------
  function deathFx() {
    const p = s.p, c = ch.col, id = ch.id, g = (n, glyph, sp, life, size, vy = 0) => { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = sp * (.3 + Math.random());
      s.pt.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + vy, life, max: life, col: c, size, g: glyph }); } };
    burst(p.x, p.y, c, 40, 260, .9, 4);
    if (id === 'sua') { g(0); for (let i = 0; i < 14; i++) s.pt.push({ x: p.x + (Math.random() - .5) * 50, y: p.y, vx: (Math.random() - .5) * 40, vy: -60 - Math.random() * 90, life: 1.4, max: 1.4, col: c, size: 14, g: '♪' }); s.fx.push({ x: p.x, y: p.y, r: 150, life: .8, col: c }); }
    else if (id === 'mizi') { g(16, '/', 320, .8, 14); g(10, '\\', 320, .8, 14); s.fx.push({ x: p.x, y: p.y, r: 90, life: .5, col: c }); }
    else if (id === 'till') { g(18, '▪', 300, .9, 8); for (let i = 0; i < 4; i++) s.fx.push({ x: p.x, y: p.y, r: 30 + i * 28, life: .25 + i * .12, col: c }); }
    else if (id === 'luka') { g(20, '★', 240, 1.2, 12, 120); s.fx.push({ x: p.x, y: p.y, r: 120, life: .6, col: c }); }
    else if (id === 'ivan') { g(22, '◆', 300, 1, 12, 60); s.fx.push({ x: p.x, y: p.y, r: 100, life: .5, col: c }); }
    else if (id === 'hyuna') { for (let i = 0; i < 4; i++) s.fx.push({ x: p.x, y: p.y, r: 120 + i * 110, life: .5 + i * .3, col: c }); g(14, '●', 340, 1, 14); s.shake = .9; }
  }

  function stepFx(dt) {
    if (s.fl) s.fl.t -= dt; if (s.ban) s.ban.t -= dt;
    if (s.cut) { const c = s.cut; c.t += dt;
      if (c.t >= c.max) s.cut = null;
      else if (cuts[c.id] && cuts[c.id].width) { const k = c.t / c.max, g = cutGeo(c), mote = (n, up) => { for (let i = 0; i < n; i++) s.cp.push({ x: g.cx + (Math.random() - .5) * g.ww * .95, y: g.by - Math.random() * g.hh * .95, vx: (Math.random() - .5) * 40, vy: -(35 + Math.random() * up), life: .9 + Math.random() * .5, max: 1.4, col: Math.random() < .5 ? c.col : '#ffffff', size: 3 + Math.random() * 7 }); };
        if (!c.dis && k > .4) { c.dis = 1; mote(40, 150); }                                  // explosão de faíscas quando começa a dissolver
        if (k > .36) { c.em = (c.em || 0) + dt * 60; while (c.em >= 1) { c.em--; mote(1, 110); } } } }
    for (const q of s.cp) { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; } compact(s.cp, q => q.life > 0);
    for (const f of s.fx) f.life -= dt; compact(s.fx, f => f.life > 0);
    for (const g of s.gh) g.life -= dt; compact(s.gh, g => g.life > 0);
    { const cap = RS < .8 ? 300 : 600; if (s.pt.length > cap) s.pt.splice(0, s.pt.length - cap); }
    for (const q of s.pt) { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; }
    compact(s.pt, q => q.life > 0);
  }

  const eyes = (ne, r, e, p, y0, sz) => { const ang = Math.atan2(p.y - e.y, p.x - e.x), er = r * sz;
    for (let i = 0; i < ne; i++) { const ex = (i - (ne - 1) / 2) * r * .62;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, y0, er, er * 1.2, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#100818'; ctx.beginPath(); ctx.arc(ex + Math.cos(ang) * er * .4, y0 + Math.sin(ang) * er * .4, er * .55, 0, TAU); ctx.fill(); } };
  const NE = { grunt: 2, fast: 1, tank: 3, boss: 5 };
  const crescent = R => { ctx.beginPath(); ctx.arc(0, 0, R, .863, TAU - .863); ctx.arc(R * .4, 0, R * .8, -1.256, 1.256, true); ctx.closePath(); };
  const poly = (n, r, rot) => { ctx.beginPath(); for (let i = 0; i < n; i++) { const a = rot + i * TAU / n; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); };
  // cada palco tem uma espécie de alien diferente
  const STY = {
    // My Clementis: água-viva cerebral com tentáculos
    clementis(r, k, col, t, ang, p, e, fl) {
      ctx.strokeStyle = col; ctx.globalAlpha = .85; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(2, r * .14);
      const n = k === 'fast' ? 4 : k === 'tank' ? 6 : k === 'boss' ? 9 : 5;
      for (let i = 0; i < n; i++) { const ox = (i - (n - 1) / 2) * r * 2 / n; ctx.beginPath(); ctx.moveTo(ox, r * .3); ctx.bezierCurveTo(ox + Math.sin(t + i) * r * .5, r * .9, ox - Math.sin(t + i) * r * .5, r * 1.4, ox + Math.sin(t * 1.3 + i) * r * .4, r * 2); ctx.stroke(); }
      ctx.globalAlpha = 1; ctx.shadowColor = col; ctx.shadowBlur = 12; ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.05, r * .95, 0, Math.PI, 0); ctx.lineTo(r * 1.05, r * .3); ctx.quadraticCurveTo(0, r * .6 + Math.sin(t * 2) * 3, -r * 1.05, r * .3); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(90,0,70,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-r * .6, -r * .5); ctx.quadraticCurveTo(-r * .2, -r * .9, 0, -r * .45); ctx.quadraticCurveTo(r * .3, -r * .9, r * .65, -r * .4); ctx.moveTo(-r * .5, -r * .1); ctx.quadraticCurveTo(0, -r * .5, r * .5, -r * .1); ctx.stroke();
      eyes(NE[k], r, e, p, r * .1, NE[k] > 2 ? .17 : .24); },
    // Blink Gone: cristais neon poligonais com glitch
    blinkgone(r, k, col, t, ang, p, e, fl) {
      const n = k === 'fast' ? 4 : k === 'grunt' ? 6 : 8, rot = k === 'boss' ? t * .3 : 0;
      if (Math.sin(t * .7 + e.ph) > .93) { ctx.save(); ctx.translate(4, 0); ctx.strokeStyle = '#ff2e88'; ctx.lineWidth = 2; poly(n, r * 1.1, rot); ctx.stroke(); ctx.restore(); }
      ctx.shadowColor = col; ctx.shadowBlur = 14; ctx.fillStyle = fl ? '#fff' : '#031225'; poly(n, r * 1.1, rot); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke();
      ctx.lineWidth = 1.5; poly(n, r * .62, -rot + t * .4); ctx.stroke(); ctx.shadowBlur = 0;
      for (let i = 0; i < n; i += 2) { const a = rot + i * TAU / n; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 1.1, Math.sin(a) * r * 1.1); ctx.lineTo(Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.5); ctx.stroke(); }
      ctx.fillStyle = col; ctx.fillRect(-r * .5, -r * .12, r, r * .24); ctx.fillStyle = '#fff'; ctx.fillRect(-r * .1 + Math.cos(ang) * r * .3, -r * .12, r * .2, r * .24); },
    // Black Sorrow: orbes de prata com bolhas orbitando e uma lágrima
    blacksorrow(r, k, col, t, ang, p, e, fl) {
      const rr = r * 1.05;
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(r * .12, r * .12, rr, 0, TAU); ctx.fill();
      ctx.fillStyle = fl ? '#fff' : col; ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(20,22,30,.5)'; ctx.beginPath(); ctx.arc(r * .2, r * .25, rr * .8, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.ellipse(-r * .4, -r * .5, r * .28, r * .16, -.6, 0, TAU); ctx.fill();
      const nb = k === 'boss' ? 4 : k === 'tank' ? 3 : k === 'fast' ? 1 : 2;
      for (let i = 0; i < nb; i++) { const a = t * .5 + i * TAU / nb; ctx.fillStyle = 'rgba(230,235,245,.7)'; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.5, r * .22, 0, TAU); ctx.fill(); }
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, r * 1.05); ctx.quadraticCurveTo(r * .35, r * 1.5, 0, r * 1.75 + Math.sin(t) * 3); ctx.quadraticCurveTo(-r * .35, r * 1.5, 0, r * 1.05); ctx.fill();
      eyes(NE[k], r, e, p, -r * .05, NE[k] > 2 ? .16 : .22); },
    // Ruler of My Heart: mariposas-lua com asas de fita e halo
    ruler(r, k, col, t, ang, p, e, fl) {
      ctx.strokeStyle = col; ctx.globalAlpha = .55; ctx.lineCap = 'round'; ctx.lineWidth = r * .32; ctx.beginPath(); ctx.moveTo(0, r * .6);
      ctx.bezierCurveTo(Math.sin(t) * r, r * 1.2, -Math.sin(t) * r, r * 1.7, Math.sin(t * 1.2) * r * .7, r * 2.3); ctx.stroke(); ctx.globalAlpha = 1;
      const w = Math.sin(t * 2) * .35; ctx.fillStyle = fl ? '#fff' : 'rgba(255,245,220,.5)';
      for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * r * .5, -r * .1); ctx.quadraticCurveTo(sx * r * 1.9, -r * (.9 + w), sx * r * 1.7, r * (.4 - w * .5)); ctx.quadraticCurveTo(sx * r * 1.1, r * .3, sx * r * .5, r * .3); ctx.fill(); }
      ctx.strokeStyle = 'rgba(255,230,160,.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, -r * 1.35, r * .5, r * .15, 0, 0, TAU); ctx.stroke();
      ctx.save(); ctx.rotate(ang); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, r, .4, TAU - .4); ctx.arc(r * .4, 0, r * .78, TAU - .55, .55, true); ctx.closePath(); ctx.fill(); ctx.restore();
      ctx.save(); ctx.translate(-r * .3, 0); eyes(k === 'tank' || k === 'boss' ? 2 : 1, r, e, p, 0, .2); ctx.restore(); },
    // Cure: discos voadores com cúpula, luzes e feixe
    cure(r, k, col, t, ang, p, e, fl) {
      ctx.translate(0, Math.sin(t) * 3);
      ctx.fillStyle = 'rgba(160,235,255,.18)'; ctx.beginPath(); ctx.moveTo(-r * .5, r * .4); ctx.lineTo(r * .5, r * .4); ctx.lineTo(r * 1.1, r * 2); ctx.lineTo(-r * 1.1, r * 2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, r * 2.1, r, r * .22, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = fl ? '#fff' : '#2c3a48'; ctx.beginPath(); ctx.ellipse(0, r * .15, r * 1.45, r * .5, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.shadowColor = col; ctx.shadowBlur = 10; ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = col; ctx.globalAlpha = .55; ctx.beginPath(); ctx.ellipse(0, -r * .1, r * .75, r * .75, 0, Math.PI, 0); ctx.fill(); ctx.globalAlpha = 1;
      for (let i = 0; i < 5; i++) { const a = t * .8 + i * TAU / 5; ctx.fillStyle = Math.sin(a * 2) > 0 ? '#fff' : col; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 1.1, r * .22 + Math.sin(a) * r * .22, 2.2, 0, TAU); ctx.fill(); }
      if (k !== 'grunt') { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -r * .85); ctx.lineTo(0, -r * 1.4); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -r * 1.4, 3, 0, TAU); ctx.fill(); }
      eyes(NE[k], r, e, p, -r * .25, NE[k] > 2 ? .15 : .21); },
    // Karma: espírito de fogo — gota de chama com três camadas, línguas que tremulam e brasas orbitando
    karma(r, k, col, t, ang, p, e, fl) {
      const f = Math.sin(t * 3 + e.ph) * r * .14, f2 = Math.sin(t * 2.3 + e.ph * 2) * r * .18;
      ctx.shadowColor = col; ctx.shadowBlur = 16;
      for (const [sc, c2] of [[1.12, '#a3182b'], [.88, fl ? '#fff' : col], [.52, fl ? '#fff' : '#ffd27a']]) {
        const w = r * sc, h = r * sc * 2.05; ctx.fillStyle = c2; ctx.beginPath(); ctx.moveTo(-w, r * .15);
        ctx.bezierCurveTo(-w, -h * .45, -w * .25 + f, -h * .7, f2, -h * .92); ctx.bezierCurveTo(w * .25 + f, -h * .7, w, -h * .45, w, r * .15); ctx.bezierCurveTo(w, r * (.15 + sc * .8), -w, r * (.15 + sc * .8), -w, r * .15); ctx.fill();
      }
      ctx.shadowBlur = 0; const nb = k === 'tank' ? 4 : 2; ctx.fillStyle = '#ffc15a';
      for (let i = 0; i < nb; i++) { const a = t * .9 + i * TAU / nb; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 1.4, Math.sin(a) * r * 1.1 - r * .2, Math.max(1.8, r * .1), 0, TAU); ctx.fill(); }
      eyes(NE[k], r, e, p, r * .05, NE[k] > 2 ? .15 : .21); },
    // Unknown: orbe escuro que falha — canais de cor deslocados, quadradinhos de ruído e um olho em fenda que mira em você
    unknown(r, k, col, t, ang, p, e, fl) {
      if (Math.sin(t * .8 + e.ph * 3) > .8) for (const [c2, dx] of [['#ff2e88', -4], ['#ff3b5c', 4]]) { ctx.save(); ctx.translate(dx, 0); ctx.globalAlpha = .6; ctx.strokeStyle = c2; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r * 1.05, 0, TAU); ctx.stroke(); ctx.restore(); }
      ctx.shadowColor = col; ctx.shadowBlur = 12; ctx.fillStyle = fl ? '#fff' : '#04181c'; ctx.beginPath(); ctx.arc(0, 0, r * 1.05, 0, TAU); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke(); ctx.shadowBlur = 0;
      const nq = k === 'fast' ? 3 : k === 'tank' ? 7 : 5; ctx.fillStyle = 'rgba(200,255,248,.75)';
      for (let i = 0; i < nq; i++) { const a = t * .5 + i * TAU / nq, d = r * (1.35 + .12 * Math.sin(t * 2 + i)); ctx.fillRect(Math.cos(a) * d - 2, Math.sin(a) * d - 2, 4, 4); }
      ctx.save(); ctx.rotate(ang); ctx.fillStyle = fl ? '#fff' : col; ctx.beginPath(); ctx.ellipse(r * .12, 0, r * .62, r * .34, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#021214'; ctx.beginPath(); ctx.ellipse(r * .26, 0, r * .1, r * .28, 0, 0, TAU); ctx.fill(); ctx.restore(); }
  };
  function alien(e, p) {
    const t = s.t * 6 + e.ph, fl = e.flash > 0, k = e.kind, r = e.r, col = fl ? '#fff' : e.col, ang = Math.atan2(p.y - e.y, p.x - e.x);
    ctx.save(); ctx.translate(e.x, e.y);
    if (k === 'boss') { ctx.save(); ctx.strokeStyle = e.col; ctx.globalAlpha = .35 + .25 * Math.sin(t); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, r * 1.7 + Math.sin(t) * 4, 0, TAU); ctx.stroke(); ctx.restore(); BOSS[e.bid](r, s.t, e.col, e, p, fl); }
    else STY[map.id](r, k, col, t, ang, p, e, fl);
    if (e.el) { ctx.save(); ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 14; ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2.5; ctx.setLineDash([7, 5]); ctx.lineDashOffset = -s.t * 30; ctx.beginPath(); ctx.arc(0, 0, r * 1.45, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#ffd23f'; star4(0, -r * 1.85, 7, s.t * 2); ctx.fill(); ctx.restore(); }
    if (e.shoot !== undefined && e.shoot > 0 && e.shoot < .6) { ctx.strokeStyle = '#ff5577'; ctx.globalAlpha = .9; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r * (1.2 + e.shoot), 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
    if (e.frz > 0) { ctx.fillStyle = 'rgba(170,225,255,.5)'; ctx.beginPath(); ctx.arc(0, 0, r * 1.25, 0, TAU); ctx.fill(); ctx.strokeStyle = '#e6f6ff'; ctx.lineWidth = 2; for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + .3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * .4, Math.sin(a) * r * .4); ctx.lineTo(Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3); ctx.stroke(); } }
    if (e.stun > 0) { ctx.fillStyle = '#ffe066'; for (let i = 0; i < 3; i++) { const a = s.t * 5 + i * TAU / 3; star4(Math.cos(a) * r * .9, -r * 1.35 + Math.sin(a) * 4, 5, a); ctx.fill(); } }
    if (e.psn > 0) { ctx.fillStyle = 'rgba(125,255,154,.85)'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc((i - 1) * r * .5, -r * .6 - ((s.t * 20 + i * 9) % 14), 2.6, 0, TAU); ctx.fill(); } }
    if (e.brn > 0) { ctx.fillStyle = 'rgba(255,140,50,.9)'; for (let i = 0; i < 3; i++) { const fx = (i - 1) * r * .55, fh = 8 + 5 * Math.sin(s.t * 14 + i * 2); ctx.beginPath(); ctx.moveTo(fx - 4, -r * .3); ctx.quadraticCurveTo(fx, -r * .3 - fh * 1.5, fx + 4, -r * .3); ctx.fill(); } }
    if (e.conf > 0 || e.chm > 0) { ctx.strokeStyle = e.chm > 0 ? '#b57bff' : '#ff9be8'; ctx.lineWidth = 2.2; ctx.beginPath(); for (let i = 0; i < 28; i++) { const a = i * .5 + s.t * 8, rr = 2 + i * .32; ctx.lineTo(Math.cos(a) * rr, -r * 1.7 + Math.sin(a) * rr); } ctx.stroke(); if (e.chm > 0) { ctx.strokeStyle = '#b57bff'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(0, 0, r * 1.5, 0, TAU); ctx.stroke(); ctx.setLineDash([]); } }
    ctx.restore();
  }

  function drawShot(b) {
    const cc = b.c || ch.col, shp = b.sh;
    ctx.save(); ctx.translate(b.x, b.y); ctx.globalCompositeOperation = 'lighter'; ctx.shadowColor = cc; ctx.shadowBlur = s.shots.length > 40 ? 0 : 16; ctx.fillStyle = ctx.strokeStyle = cc; ctx.lineCap = 'round';
    switch (shp) {
      case 'bullet': ctx.rotate(b.a); ctx.lineWidth = 5; ctx.globalAlpha = .55; ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(8, 0); ctx.stroke(); ctx.globalAlpha = 1; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(9, 0); ctx.stroke(); ctx.fillStyle = '#4d86ff'; ctx.beginPath(); ctx.arc(10, 0, 3.6, 0, TAU); ctx.fill(); break;
      case 'petal': ctx.rotate(b.rot * .5); for (let k = 0; k < 5; k++) { ctx.rotate(TAU / 5); ctx.fillStyle = k % 2 ? '#ffffff' : cc; ctx.beginPath(); ctx.ellipse(0, -8, 4.2, 8.5, 0, 0, TAU); ctx.fill(); } ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAU); ctx.fill(); break;
      case 'dagger': ctx.rotate(b.a); ctx.fillStyle = '#e8ecff'; ctx.shadowColor = '#ff3b5c'; ctx.beginPath(); ctx.moveTo(17, 0); ctx.lineTo(-6, -4.5); ctx.lineTo(-11, 0); ctx.lineTo(-6, 4.5); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#ff3b5c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, 0); ctx.stroke(); break;
      case 'wave': ctx.rotate(b.a); for (let k = 0; k < 3; k++) { ctx.globalAlpha = 1 - k * .28; ctx.lineWidth = 5 - k; ctx.strokeStyle = k ? cc : '#fff'; ctx.beginPath(); ctx.arc(-8 - k * 11, 0, 17 + k * 3, -1, 1); ctx.stroke(); } break;
      case 'chord': ctx.rotate(b.a); ctx.lineWidth = 4.5; for (let k = -1; k <= 1; k++) { ctx.globalAlpha = k ? .6 : 1; ctx.strokeStyle = k ? cc : '#fff'; ctx.beginPath(); for (let i = 0; i < 6; i++) ctx.lineTo(-26 + i * 10, k * 10 + (i % 2 ? 6 : -6) * Math.sin(b.rot * 2 + k + i)); ctx.stroke(); } ctx.globalAlpha = .5; ctx.beginPath(); ctx.arc(-4, 0, b.r || 22, -1.1, 1.1); ctx.stroke(); break;
      case 'spark': ctx.rotate(b.rot); star4(0, 0, 13, 0); ctx.fill(); ctx.fillStyle = '#fff'; star4(0, 0, 6, .4); ctx.fill(); break;
      case 'note': ctx.rotate(Math.sin(b.rot) * .3); ctx.lineWidth = 3.4; ctx.beginPath(); ctx.ellipse(-3, 8, 6.2, 4.4, -.4, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(2.4, 7); ctx.lineTo(2.4, -12); ctx.quadraticCurveTo(10, -9, 9, -2); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-3, 8, 3, 2, -.4, 0, TAU); ctx.fill(); break;
      default: { const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 20); g.addColorStop(0, '#fff'); g.addColorStop(.35, cc); g.addColorStop(1, cc + '00'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
  }
  function trail(b) {
    if (s.shots.length > 50 && Math.random() < .65) return;           // menos rastro quando há muitos tiros
    const c = b.c || ch.col, sh = b.sh, P = (o) => s.pt.push(o);
    if (sh === 'bullet') P({ x: b.x, y: b.y, vx: 0, vy: 0, life: .18, max: .18, col: c, size: 3 });
    else if (sh === 'petal') { if (Math.random() < .5) P({ x: b.x, y: b.y, vx: rnd(-20, 20), vy: rnd(-20, 20), life: .45, max: .45, col: c, size: 5, g: '*' }); }
    else if (sh === 'wave') { if (Math.random() < .4) P({ x: b.x, y: b.y + rnd(-10, 10), vx: 0, vy: 0, life: .3, max: .3, col: c, size: 4 }); }
    else if (sh === 'chord') { if (Math.random() < .8) P({ x: b.x + rnd(-10, 10), y: b.y + rnd(-10, 10), vx: 0, vy: 0, life: .35, max: .35, col: Math.random() < .5 ? c : '#fff', size: rnd(3, 6) }); }
    else if (sh === 'spark') { if (Math.random() < .7) P({ x: b.x, y: b.y, vx: rnd(-40, 40), vy: rnd(-40, 40), life: .4, max: .4, col: c, size: 6, g: '*' }); }
    else if (sh === 'note') { P({ x: b.x, y: b.y, vx: 0, vy: 0, life: .3, max: .3, col: c, size: 3 }); if (Math.random() < .12) P({ x: b.x, y: b.y, vx: rnd(-15, 15), vy: -20, life: .6, max: .6, col: c, size: 7, g: '♪' }); }
    else if (Math.random() < .8) P({ x: b.x, y: b.y, vx: 0, vy: 0, life: .25, max: .25, col: c, size: 3 });
  }

  function drawReticle() {
    const x = aim.x, y = aim.y, r = 10 + Math.sin(s.t * 6) * 1.2;
    ctx.save(); ctx.strokeStyle = ch.acc; ctx.fillStyle = '#fff'; ctx.globalAlpha = .9; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.moveTo(x - r - 6, y); ctx.lineTo(x - r + 3, y); ctx.moveTo(x + r - 3, y); ctx.lineTo(x + r + 6, y); ctx.moveTo(x, y - r - 6); ctx.lineTo(x, y - r + 3); ctx.moveTo(x, y + r - 3); ctx.lineTo(x, y + r + 6); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 1.8, 0, TAU); ctx.fill(); ctx.restore();
  }
  function draw() {
    if (!s) return;
    const p = s.p, sh = s.shake > 0 ? s.shake * 14 : 0;
    const cx = W / 2 - p.x + (Math.random() - .5) * sh, cy = H / 2 - p.y + (Math.random() - .5) * sh;
    ctx.setTransform(RS, 0, 0, RS, 0, 0); ctx.imageSmoothingEnabled = false;
    const vis = (x, y, m) => Math.abs(x - p.x) < W / 2 + m && Math.abs(y - p.y) < H / 2 + m;       // está na tela?
    map.draw(ctx, { W, H, cx, cy, t: s.t });
    ctx.save(); ctx.translate(cx, cy);

    for (const f of s.fx) { const fx = f.follow ? p.x : f.x, fy = f.follow ? p.y : f.y; ctx.strokeStyle = f.col; ctx.globalAlpha = Math.min(1, f.life * 3); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(fx, fy, f.r, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); for (const q of s.gems) { if (!vis(q.x, q.y, 20)) continue; ctx.moveTo(q.x, q.y - 7); ctx.lineTo(q.x + 5, q.y); ctx.lineTo(q.x, q.y + 7); ctx.lineTo(q.x - 5, q.y); ctx.closePath(); } ctx.fill();    // todas as gemas num único traçado
    for (const q of s.ink) { if (!vis(q.x, q.y, q.r + 20)) continue; const f = Math.min(1, q.life * 1.5), k = q.life; ctx.save(); ctx.globalAlpha = f * .85; const g = ctx.createRadialGradient(q.x, q.y + 4, 2, q.x, q.y + 4, q.r); g.addColorStop(0, q.fire ? 'rgba(255,150,40,.9)' : 'rgba(150,10,22,.9)'); g.addColorStop(1, q.fire ? 'rgba(255,80,20,0)' : 'rgba(90,0,10,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(q.x, q.y + 4, q.r, q.r * .6, 0, 0, TAU); ctx.fill();
      if (q.fire) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ffb347'; for (let i = 0; i < 3; i++) { const fx = q.x + (i - 1) * q.r * .45, fh = 12 + 8 * Math.sin(s.t * 12 + i * 2 + q.x); ctx.beginPath(); ctx.moveTo(fx - 5, q.y + 4); ctx.quadraticCurveTo(fx, q.y - fh * 1.4, fx + 5, q.y + 4); ctx.fill(); } } ctx.restore(); }
    for (const h of s.hearts) { const yy = h.y + Math.sin(s.t * 4 + h.x) * 3; ctx.save(); ctx.shadowColor = '#ffd6ec'; ctx.shadowBlur = 12; ctx.fillStyle = '#ffffff'; for (let k = 0; k < 5; k++) { ctx.save(); ctx.translate(h.x, yy); ctx.rotate(k * TAU / 5 + s.t); ctx.fillStyle = k % 2 ? '#ffd6ec' : '#ffffff'; ctx.beginPath(); ctx.ellipse(0, -6, 3.2, 6.5, 0, 0, TAU); ctx.fill(); ctx.restore(); } ctx.fillStyle = '#ff5fb0'; ctx.beginPath(); ctx.arc(h.x, yy, 2.6, 0, TAU); ctx.fill(); ctx.restore(); }
    for (const e of s.eff) if (e.t >= 0 && e.draw) e.draw(e);
    for (const b of s.bub) { const yy = b.y + Math.sin(s.t * 2) * 5, gr = ctx.createRadialGradient(b.x - 7, yy - 7, 2, b.x, yy, 24); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(160,170,190,.25)');
      ctx.fillStyle = gr; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, yy, 22, 0, TAU); ctx.fill(); ctx.stroke(); }
    for (const z of s.tz) { const k = Math.min(1, z.t / z.delay), dn = z.t >= z.delay, f = Math.max(0, dn ? 1 - (z.t - z.delay) / .35 : 1); ctx.save(); ctx.globalAlpha = f;
      if (z.pillar) { const pw2 = dn ? z.r * 1.6 * f : z.r * .35 * k, g = ctx.createLinearGradient(0, z.y - 900, 0, z.y); g.addColorStop(0, z.col + '00'); g.addColorStop(1, z.col + (dn ? 'ee' : '66')); ctx.fillStyle = g; ctx.fillRect(z.x - pw2 / 2, z.y - 900, pw2, 900); }
      ctx.fillStyle = z.col; ctx.globalAlpha = dn ? .5 * f : .1 + .22 * k; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.fill();
      ctx.globalAlpha = f; ctx.strokeStyle = dn ? '#fff' : z.col; ctx.lineWidth = 3; ctx.stroke(); if (!dn) ring(z.x, z.y, z.r * (1 - k), '#ffffff', 2, .85); ctx.restore(); }
    let nEn = 0; for (const e of s.en) { if (!e.boss && !vis(e.x, e.y, e.r * 2.6 + 50)) continue; SK = nEn++ < 36 ? QK : 0; alien(e, p); } SK = QK;     // só desenha quem está na tela; brilho só nos 36 primeiros
    ctx.save(); for (const b of s.eb) { if (!vis(b.x, b.y, 30)) continue; ctx.globalAlpha = .35; ctx.fillStyle = b.col; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 2, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 1.1, 0, TAU); ctx.fill(); ctx.strokeStyle = '#ff2e88'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * .5, 0, TAU); ctx.fill(); } ctx.restore();
    ctx.globalCompositeOperation = 'lighter';
    let nTxt = 0; for (const q of s.pt) { if (!vis(q.x, q.y, 30)) continue; ctx.globalAlpha = Math.max(0, q.life / q.max); ctx.fillStyle = q.col; if (q.g === '*') { star4(q.x, q.y, q.size * (.5 + .7 * q.life / q.max), q.life * 6); ctx.fill(); } else if (q.g) { if (++nTxt > 24) continue; ctx.font = '700 ' + q.size * 1.8 + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(q.g, q.x, q.y); } else { ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (.4 + .6 * q.life / q.max), 0, TAU); ctx.fill(); } }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    for (const b of s.shots) if (vis(b.x, b.y, 40)) drawShot(b);
    ctx.fillStyle = '#ffd23f'; for (const o of s.orbs) { ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(o.x, o.y, 10, 0, TAU); ctx.fill(); } ctx.shadowBlur = 0;

    // Personagem animada (balanço, squash & stretch, inclinação, respiração)
    const ph = 64, pw = img.width / img.height * ph, mv = s.mv;
    for (const g of s.gh) { ctx.save(); ctx.globalAlpha = g.life / g.max * .42; ctx.shadowColor = PCOL('luka'); ctx.shadowBlur = 14; ctx.translate(g.x, g.y + 30); ctx.rotate(g.lean); ctx.drawImage(img, -pw / 2, -ph, pw, ph); ctx.restore(); }
    const bob = mv ? Math.abs(Math.sin(s.t * 12)) * 7 : Math.sin(s.t * 3) * 1.5, sq = mv ? Math.sin(s.t * 24) * .05 : Math.sin(s.t * 3) * .025;
    ctx.save(); ctx.translate(p.x, p.y + 30);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 0, pw * .32 * (1 - bob / 40), 6, 0, 0, TAU); ctx.fill();
    if (s.dying > 0) { const u = 1.4 - s.dying, m = ch.death.pose; ctx.globalAlpha = Math.max(0, s.dying / 1.4);
      if (m === 'rise') ctx.translate(0, -u * 50); else if (m === 'spin') { ctx.rotate(u * 9); ctx.translate(u * 60, -u * 40); } else if (m === 'shrink') { const k = Math.max(.01, 1 - u * .7); ctx.scale(k, k); } else ctx.rotate(u * 1.3); }
    else if (p.inv > 0 && Math.floor(s.t * 20) % 2) ctx.globalAlpha = .4;
    ctx.translate(0, -bob); ctx.rotate(s.lean + (mv ? Math.sin(s.t * 12) * .06 : 0)); ctx.scale(1 - sq, 1 + sq);
    ctx.drawImage(img, -pw / 2, -ph, pw, ph);
    ctx.restore();
    if (s.imm > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#fff2b0'; ctx.lineWidth = 3; ctx.globalAlpha = .55 + .25 * Math.sin(s.t * 14); ctx.beginPath(); ctx.arc(0, -ph * .45, 44, 0, TAU); ctx.stroke(); ctx.restore(); }
    if (s.flw.length) for (const o of s.flw) { ctx.save(); ctx.translate(o.x - p.x, o.y - p.y - ph * .45); ctx.rotate(o.a + s.t * 2); ctx.shadowColor = '#c9b8ff'; ctx.shadowBlur = 14; for (let k = 0; k < 6; k++) { ctx.rotate(TAU / 6); ctx.fillStyle = k % 2 ? '#ffffff' : '#ff9ad0'; ctx.beginPath(); ctx.ellipse(0, -10, 5, 11, 0, 0, TAU); ctx.fill(); } ctx.fillStyle = '#3a1050'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill(); ctx.restore(); }
    if (s.shield > 0) { ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -ph * .45, 40, 0, TAU); ctx.fill(); ctx.stroke(); }
    ctx.restore();

    // partículas da aparição, HUD temático e avisos
    ctx.globalCompositeOperation = 'lighter'; for (const q of s.cp) { ctx.globalAlpha = Math.max(0, q.life / q.max); ctx.fillStyle = q.col; star4(q.x, q.y, q.size * (.4 + .6 * q.life / q.max), q.life * 5); ctx.fill(); } ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    for (const e of s.ov) e.draw(e);
    if (aim.on && !s.lvl && !s.halt && s.dying <= 0) drawReticle();
    drawCut(); drawHUD();
    if (s.fl && s.fl.t > 0) { const a = s.fl.t / s.fl.max, g = ctx.createRadialGradient(W / 2, H / 2, H * .25, W / 2, H / 2, Math.max(W, H) * .7); g.addColorStop(0, s.fl.col + '00'); g.addColorStop(1, s.fl.col + 'cc'); ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    drawBan();
    if (map.after) map.after(ctx, { W, H, t: s.t });
  }

  return { start, stop, pause, resume, skill: useUlt, special: useSpecial, perf: () => ({ rs: RS, ms: +ema.toFixed(1), fps: fpsV }) };
})();
