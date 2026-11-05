// Menus, seleção de personagem e de palco, pause, tela de morte, loja e ranking
(() => {
  const $ = id => document.getElementById(id);
  const SCREENS = ['auth', 'menu', 'select', 'maps', 'codex', 'tarot', 'train', 'rank', 'levelup', 'pause', 'over', 'deathFx'];
  const WITH_BG = ['auth', 'menu', 'select', 'maps', 'codex', 'tarot', 'train', 'rank'];
  let user = null, prog = API.emptyProgress(), playing = false;
  let sel = { c: 0, s: 0 }, mapI = 0, mapTmp = 0;
  try { const v = JSON.parse(localStorage.getItem('as_sel')); if (v && CHARS[v.c] && v.s < CHARS[v.c].skins.length) sel = v; } catch (e) {}
  try { const v = +localStorage.getItem('as_map'); if (MAPS[v]) mapI = v; } catch (e) {}
  const cur = () => CHARS[sel.c], curMap = () => MAPS[mapI];
  const COST = lv => (lv + 1) * 20;
  const SHOP = [['dmg', 'Voz Potente (+10% dano)'], ['hp', 'Corpo Forte (+20 vida)'], ['spd', 'Passo Rápido (+5% vel.)']];
  const fmt = t => Math.floor(t / 60) + 'min ' + (t % 60) + 's';
  const assetUrl = p => './' + String(p).replace(/^\.\//, '');
  const setBgMap = m => { $('bgMap').style.backgroundImage = `url("${assetUrl(m.img)}")`; };

  let curId = 'boot';
  function show(id, cb) {
    if (curId === 'boot' || id === curId || id === 'pause' || curId === 'pause') { _show(id); if (cb) cb(); } else FX.run(() => { _show(id); if (cb) cb(); });
  }
  function _show(id) {
    curId = id;
    FX.music(id === null ? 'game' : (id === 'pause' ? 'pause' : 'menu'), id === null ? curMap().id : undefined);
    document.body.classList.toggle('ingame', id === null);
    FX.sky(id !== null && id !== 'pause' && id !== 'over' && id !== 'maps' && WITH_BG.includes(id));
    SCREENS.forEach(x => $(x).classList.toggle('hidden', x !== id));
    $('bg').classList.toggle('hidden', !WITH_BG.includes(id)); $('ver').classList.toggle('hidden', id === null);
    $('btnPause').classList.toggle('hidden', !playing || id !== null);
    $('skillBtn').classList.toggle('hidden', !playing || id !== null); $('spBtn').classList.toggle('hidden', !playing || id !== null);
  }
  const persist = async () => user ? API.call('save', { progress: prog }) : API.guestSave(prog);
  const saveSel = () => { try { localStorage.setItem('as_sel', JSON.stringify(sel)); } catch (e) {} };

  function openMenu() {
    if (playing) persist();
    playTok++; Game.stop(); playing = false;
    $('who').textContent = user ? 'Participante: ' + user : 'Modo convidado (progresso só neste navegador)';
    $('stats').textContent = `Notas ${prog.shards} | Melhor ${fmt(prog.best_time)} | Recorde ${prog.best_kills}`;
    $('cdxMini').textContent = `${foundCount()}/${COMBO_IDS.length}`; $('trMini').textContent = `${tarotCount()}/${TAROT_IDS.length}`;
    $('mapNow').textContent = 'Palco: ' + curMap().name; setBgMap(curMap());
    $('heroImg').src = spr(cur(), sel.s); $('heroName').textContent = cur().name.toUpperCase();
    show('menu');
  }

  // ---------- seleção de personagem (imagem grande com áreas clicáveis e brilhos) ----------
  const IW = 735, IH = 717, layers = $('shardLayers'), sparkBox = $('shardSpark');
  // cada caco vira uma camada recortada: brilha ao passar o mouse e sobe ao ser escolhido
  layers.innerHTML = CHARS.map((c, i) => {
    const cx = c.poly.reduce((a, q) => a + q[0], 0) / c.poly.length / IW * 100, cy = c.poly.reduce((a, q) => a + q[1], 0) / c.poly.length / IH * 100;
    return `<div class="sh" data-i="${i}" style="--cc:${c.col};transform-origin:${cx}% ${cy}%"><div class="shIn" style="clip-path:polygon(${c.poly.map(q => (q[0] / IW * 100).toFixed(2) + '% ' + (q[1] / IH * 100).toFixed(2) + '%').join(',')})"></div></div>`;
  }).join('');
  sparkBox.innerHTML = Array.from({ length: 18 }, () => `<i class="fl" style="--x:${Math.random() * 100}%;--d:${4 + Math.random() * 5}s;--w:${-Math.random() * 8}s;--z:${5 + Math.random() * 9}px;--c:${['#3ef0ff', '#ff2e88', '#ffd23f', '#fff'][Math.random() * 4 | 0]}"></i>`).join('');
  const retrig = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  function burstAt(i) {
    const c = CHARS[i].poly, cx = c.reduce((a, q) => a + q[0], 0) / c.length / IW * 100, cy = c.reduce((a, q) => a + q[1], 0) / c.length / IH * 100, col = CHARS[i].col;
    let h = `<i class="fring" style="--x:${cx}%;--y:${cy}%;--c:${col}"></i><i class="fring b" style="--x:${cx}%;--y:${cy}%;--c:#fff"></i>`;
    for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8 + Math.random() * .3, d = 40 + Math.random() * 90; h += `<i class="sb" style="--x:${cx}%;--y:${cy}%;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;--z:${8 + Math.random() * 12}px;--c:${k % 3 ? col : '#fff'}"></i>`; }
    const w = document.createElement('div'); w.className = 'burst'; w.innerHTML = h; sparkBox.appendChild(w); setTimeout(() => w.remove(), 1000);
  }
  function renderSelect(anim) {
    const c = cur();
    layers.querySelectorAll('.sh').forEach((pl, i) => pl.classList.toggle('on', i === sel.c));
    const sc = $('select'); sc.style.setProperty('--cc', c.col);
    $('prevImg').src = spr(c, sel.s); $('cName').textContent = c.name; $('cWeapon').textContent = c.weapon; $('cBlurb').textContent = c.blurb;
    $('cName').style.color = c.col; $('cName').style.textShadow = `0 0 18px ${c.col}`;
    $('cSpecial').textContent = c.sp.n + ' — ' + c.sp.d; $('cSkill').textContent = c.sk.n + ' — ' + c.sk.d; $('cTarot').textContent = TAROT[c.id].n + ' — ' + TAROT[c.id].hint;
    const bar = (n, v) => `<div class="bar"><span>${n}</span><i><b style="width:${Math.min(100, v * 70)}%"></b></i></div>`;
    $('bars').innerHTML = bar('Vida', c.hp) + bar('Vel.', c.spd) + bar('Dano', c.dm) + bar('Ritmo', 1 / c.cdm);
    if (anim === 'skin') { $('skins').querySelectorAll('.skin').forEach((b, k) => b.classList.toggle('on', k === sel.s)); retrig($('prevImg'), 'pop'); return; }
    $('skins').innerHTML = c.skins.map((n, k) => `<button class="skin ${k === sel.s ? 'on' : ''}" data-k="${k}" style="--i:${k}"><img src="${spr(c, k)}" alt=""><span>${n}</span></button>`).join('');
    if (anim === 'char') { retrig($('info'), 'in'); retrig($('prevImg'), 'pop'); retrig($('skins'), 'in'); burstAt(sel.c); } else if (anim === 'skin') retrig($('prevImg'), 'pop');
  }
  const openSelect = () => { renderSelect(); show('select', () => { retrig($('info'), 'in'); retrig($('skins'), 'in'); burstAt(sel.c); }); };
  const pickChar = i => { sel = { c: (i + CHARS.length) % CHARS.length, s: 0 }; renderSelect('char'); };
  const pickSkin = k => { const n = cur().skins.length; sel.s = (k + n) % n; renderSelect('skin'); };
  // O caco sob o cursor é calculado por geometria (ponto dentro do polígono) sobre uma área parada.
  // Antes o hover/clique dependia de elementos que cresciam e inclinavam, então o alvo mudava sozinho perto das bordas.
  const shardsEl = $('shards'), tiltEl = $('tilt');
  const BOX = CHARS.map(c => { const xs = c.poly.map(q => q[0]), ys = c.poly.map(q => q[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; });
  const AREA = CHARS.map(c => Math.abs(c.poly.reduce((a, q, i) => { const r = c.poly[(i + 1) % c.poly.length]; return a + q[0] * r[1] - r[0] * q[1]; }, 0) / 2));
  const inPoly = (x, y, P) => { let o = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) o = !o; } return o; };
  function charAt(cx, cy) {
    const r = shardsEl.getBoundingClientRect(); if (!r.width) return -1;
    const x = (cx - r.left) / r.width * IW, y = (cy - r.top) / r.height * IH; let best = -1, ba = Infinity;
    for (let i = 0; i < CHARS.length; i++) { const b = BOX[i]; if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue; if (AREA[i] < ba && inPoly(x, y, CHARS[i].poly)) { ba = AREA[i]; best = i; } }   // se duas áreas se tocam, vale a menor
    return best;
  }
  let hovI = -1;
  const setHover = i => { if (i === hovI) return; hovI = i; layers.querySelectorAll('.sh').forEach((pl, k) => pl.classList.toggle('hov', k === i)); shardsEl.classList.toggle('over', i >= 0); };
  shardsEl.addEventListener('click', e => { const i = charAt(e.clientX, e.clientY); if (i >= 0 && i !== sel.c) pickChar(i); });
  shardsEl.addEventListener('pointerleave', () => setHover(-1));
  $('skins').onclick = e => { const b = e.target.closest('.skin'); if (b) pickSkin(+b.dataset.k); };
  $('select').addEventListener('pointermove', e => { const r = shardsEl.getBoundingClientRect(), dx = (e.clientX - r.left - r.width / 2) / innerWidth, dy = (e.clientY - r.top - r.height / 2) / innerHeight; tiltEl.style.transform = `rotateY(${dx * 12}deg) rotateX(${-dy * 10}deg)`; setHover(charAt(e.clientX, e.clientY)); });
  $('selOk').onclick = () => { saveSel(); openMenu(); };
  $('selBack').onclick = () => { try { sel = JSON.parse(localStorage.getItem('as_sel')) || sel; } catch (e) {} openMenu(); };

  // ---------- seleção de palco (fundo animado com o próprio palco, cards que se expandem) ----------
  const mb = $('mapBg'), mx = mb.getContext('2d'); let mraf = 0, mt = 0, mlast = 0;
  const renderMapCards = () => {
    $('mapCards').innerHTML = MAPS.map((m, i) => { const k = prog.bosses[m.id] || 0;
      return `<button class="mapCard" data-i="${i}" style="--mc:${m.col}"><img src="${assetUrl(m.img)}" alt="Imagem do palco ${m.name}" loading="eager" onerror="this.style.display='none';this.parentElement.style.background='radial-gradient(ellipse at center, '+this.parentElement.style.getPropertyValue('--mc')+', #05071a 75%)'"><u class="n">0${i + 1}</u><div class="mc"><b>${m.name}</b><span>${m.desc}</span><em>★ ${m.rule}</em><p class="bs">◆ CHEFES${k ? ` <i>Derrotados ${k}×</i>` : ''}${m.bosses.map(b => `<br><u>${b.name}</u> — ${b.hint}`).join('')}</p></div></button>`; }).join('');
    updMaps();
  };
  function updMaps() { document.querySelectorAll('.mapCard').forEach((c, i) => c.classList.toggle('on', i === mapTmp)); retrig(mb, 'swap'); }
  function mapLoop(now) {
    if ($('maps').classList.contains('hidden')) { mraf = 0; return; }
    const dt = Math.min(.05, (now - mlast) / 1000); mlast = now; mt += dt;
    if (mb.width !== innerWidth || mb.height !== innerHeight) { mb.width = innerWidth; mb.height = innerHeight; }
    const m = MAPS[mapTmp], o = { W: mb.width, H: mb.height, cx: -mt * 45, cy: -mt * 14 + Math.sin(mt * .4) * 30, t: mt };
    m.draw(mx, o); if (m.after) m.after(mx, o); mraf = requestAnimationFrame(mapLoop);
  }
  const openMaps = () => { mapTmp = mapI; renderMapCards(); show('maps', () => { if (!mraf) { mlast = performance.now(); mraf = requestAnimationFrame(mapLoop); } }); };
  const pickMap = i => { mapTmp = (i + MAPS.length) % MAPS.length; updMaps(); };
  $('mapCards').onclick = e => { const b = e.target.closest('.mapCard'); if (b && +b.dataset.i !== mapTmp) pickMap(+b.dataset.i); };
  $('mapOk').onclick = () => { mapI = mapTmp; try { localStorage.setItem('as_map', mapI); } catch (e) {} openMenu(); };
  $('mapBack').onclick = openMenu;

  // ---------- treino e ranking ----------
  function openTrain() {
    $('trainNotes').textContent = `Notas disponíveis: ${prog.shards} ♪`;
    $('shop').innerHTML = '';
    SHOP.forEach(([k, label]) => {
      const lv = prog.up[k], b = document.createElement('button');
      b.innerHTML = `<span>${label} [${lv}/10]</span><span>${lv >= 10 ? 'MAX' : COST(lv) + ' ♪'}</span>`;
      b.disabled = lv >= 10 || prog.shards < COST(lv);
      b.onclick = async () => { prog.shards -= COST(lv); prog.up[k]++; await persist(); openTrain(); };
      $('shop').appendChild(b);
    });
    show('train');
  }
  async function openRank() {
    show('rank'); $('rankList').innerHTML = '<li>Carregando...</li>';
    const r = await API.call('ranking');
    $('rankList').innerHTML = (r.ranking || []).map(x => `<li>${x.username} — ${fmt(x.best_time)} (${x.best_kills})</li>`).join('') || '<li>Ninguém no palco ainda</li>';
  }
  document.querySelectorAll('[data-back]').forEach(b => b.onclick = openMenu);

  // ---------- login ----------
  async function authenticate(action) {
    const res = await API.call(action, { username: $('user').value, password: $('pass').value });
    if (res.error) { $('authMsg').textContent = res.error; return; }
    user = res.username; prog = res.progress; openMenu();
  }
  $('btnLogin').onclick = () => authenticate('login');
  $('btnReg').onclick = () => authenticate('register');
  $('btnGuest').onclick = () => { user = null; prog = API.guestLoad(); openMenu(); };
  $('btnOut').onclick = async () => { if (user) await API.call('logout'); user = null; show('auth'); };
  $('btnChars').onclick = openSelect; $('btnMaps').onclick = openMaps; $('btnTrain').onclick = openTrain; $('btnRank').onclick = openRank;

  // ---------- partida ----------
  let playTok = 0;
  async function play() {
    const tok = ++playTok, c = cur(); playing = true;
    Game.stop();                                    // descarta qualquer partida anterior (estado, projéteis, tempo...)
    FX.preload(curMap().id); FX.restartStage(curMap().id);   // a trilha do palco volta para 0:00
    show(null);
    const img = await loadImg(spr(c, sel.s)); await loadCuts();
    if (tok !== playTok || !playing) return;        // saiu para o menu enquanto carregava
    Game.start({ up: prog.up, ch: c, img, map: curMap(), cut: cutImgs, tarotImg: tarotImgs, found: prog.combos, tarot: prog.tarot, onEnd: end, onLevel: levelUi,
      onTarot: () => persist(),                                                                     // carta desbloqueada/evoluída: salva na hora
      onFound: id => { prog.combos[id] = prog.combos[id] || { uses: 0 }; persist(); },        // sinergia nova: salva na hora
      onBoss: id => { prog.bosses[id] = (prog.bosses[id] || 0) + 1; persist(); } });             // chefe derrotado: salva na hora
  }

  // ---------- recortes dos personagens usados nas sinergias ----------
  const cutImgs = {}, tarotImgs = {};
  const loadCuts = () => Promise.all([...CHARS.filter(c => !cutImgs[c.id]).map(async c => { cutImgs[c.id] = await loadImg(cutSrc(c.id)); }), ...CHARS.filter(c => !tarotImgs[c.id]).map(async c => { tarotImgs[c.id] = await loadImg(tarotSrc(c.id)); })]);
  const foundCount = () => COMBO_IDS.filter(id => prog.combos[id]).length;
  const tarotCount = () => TAROT_IDS.filter(id => prog.tarot[id] && prog.tarot[id].u).length;

  // ---------- tela de Sinergias (5 duplas; a maioria começa escondida) ----------
  function renderCodex() {
    $('cdxCount').textContent = `${foundCount()} / ${COMBO_IDS.length} sinergias descobertas`;
    $('cdxGrid').innerHTML = COMBO_IDS.map((id, i) => {
      const c = COMBOS[id], A = CHARS.find(x => x.id === c.a), B = CHARS.find(x => x.id === c.b), f = prog.combos[id], R = RARITY[c.rar], st = f ? 'found' : c.hid ? 'hid' : 'known';
      const body = st === 'hid' ? `<small>SINERGIA OCULTA</small><strong>? ? ?</strong><p>Continue jogando com ${A.name} ou ${B.name} para descobrir.</p>`
        : `<small style="color:${R.col}">✦ ${R.n}${st === 'known' ? ' · AINDA NÃO REALIZADA' : ''}</small><strong>${c.name}</strong><p class="th">${c.theme}</p>
           <p><b>Arma — ${c.w.n}:</b> ${c.w.d}</p><p><b>Ultimate — ${c.u.n}:</b> ${c.u.d}</p>
           <p class="px"><b style="color:${A.col}">${A.name}</b> + <b style="color:${B.col}">${B.name}</b></p>${f ? `<p class="us">Usada ${f.uses || 0}×</p>` : ''}`;
      return `<div class="cx pair ${st}" style="--rc:${st === 'hid' ? '#4a4f8a' : R.col};--pc:${A.col};--i:${i}"><div class="pic"><img class="pa" src="${cutSrc(c.a)}" alt=""><img class="pb" src="${cutSrc(c.b)}" alt=""></div><div class="tx">${body}</div></div>`; }).join('');
  }
  const openCodex = () => { renderCodex(); show('codex'); };
  $('cdxBack').onclick = openMenu; $('btnCodex').onclick = openCodex;

  // ---------- tela de Cartas de Tarô ----------
  let trI = 0;
  function renderTarot() {
    renderTarotGrid(); renderTarotDetail();
  }
  function renderTarotGrid() {
    $('trCount').textContent = `${tarotCount()} / ${TAROT_IDS.length} cartas desbloqueadas`;
    $('trGrid').innerHTML = CHARS.map((c, i) => {
      const T = TAROT[c.id], r = prog.tarot[c.id] || { p: 0, u: 0, t: 0 }, pr = Math.min(100, r.p / T.goal * 100);
      return `<button class="tc ${r.u ? 'on' : 'lock'} ${i === trI ? 'sel' : ''}" data-i="${i}" style="--cc:${c.col};--i:${i}"><div class="art"><img src="${tarotSrc(c.id)}" alt="${T.n}"></div>
        <div class="tl"><b>${T.n}</b><small>${c.name}</small>${r.u ? `<span class="pips">${[1, 2, 3].map(n => `<i class="${n <= (r.t || 0) ? 'on' : ''}"></i>`).join('')}</span>` : `<span class="prog"><i style="width:${pr}%"></i></span><em>${Math.floor(r.p)} / ${T.goal} ${T.unit}</em>`}</div></button>`; }).join('');
  }
  function renderTarotDetail() {
    const c = CHARS[trI], T = TAROT[c.id], r = prog.tarot[c.id] || { p: 0, u: 0, t: 0 };
    $('trDetail').style.setProperty('--cc', c.col);
    $('trDetail').innerHTML = `<h3>${T.n} <span>${T.num} · ${c.name}</span></h3><p class="unl ${r.u ? 'ok' : ''}">${r.u ? '✔ Desbloqueada' : 'Como desbloquear: ' + T.hint + ` (${Math.floor(r.p)}/${T.goal})`}</p>
      <div class="tiers">${T.t.map((x, n) => `<div class="tier ${(r.t || 0) > n ? 'got' : ''} ${r.u ? '' : 'dim'}"><i>${n + 1}</i><div><b>${x.n}</b> <small>${x.k} · a partir do nv ${x.lv}</small><p>${x.d}</p></div></div>`).join('')}</div>`;
  }
  const openTarot = () => { renderTarot(); show('tarot'); };
  const selTarot = i => { trI = (i + CHARS.length) % CHARS.length; $('trGrid').querySelectorAll('.tc').forEach((b, k) => b.classList.toggle('sel', k === trI)); renderTarotDetail(); };
  $('trGrid').onclick = e => { const b = e.target.closest('.tc'); if (b && +b.dataset.i !== trI) selTarot(+b.dataset.i); };
  $('trBack').onclick = openMenu; $('btnTarot').onclick = openTarot;

  // ---------- tela de morte única de cada personagem ----------
  const SLICES = {
    split: ['polygon(0 0,54% 0,46% 100%,0 100%)', 'polygon(54% 0,100% 0,100% 100%,46% 100%)'],
    shatter: ['polygon(0 0,50% 0,30% 100%,0 100%)', 'polygon(50% 0,100% 0,100% 45%,70% 100%,30% 100%)', 'polygon(100% 45%,100% 100%,70% 100%)']
  };
  function deathScreen(c, src) {
    const d = c.death, box = $('overImgs'), fx = $('deathFx'), ov = $('over');
    ov.className = 'panel ov d-' + c.id; fx.className = 'd-' + c.id + ' dfx-' + d.mode;
    ov.style.setProperty('--dc', d.c1); fx.style.setProperty('--dc', d.c1);
    box.className = 'fx-' + d.fx;
    const sl = SLICES[d.fx];
    box.innerHTML = sl ? `<img src="${src}" alt="" class="sp">` + sl.map((cp, i) => `<img src="${src}" alt="" class="abs s${i}" style="clip-path:${cp}">`).join('') : `<img src="${src}" alt="">`;
    const t = $('overTitle'); t.textContent = d.title; t.dataset.t = d.title; $('overLine').textContent = d.line;
    const R = (a, b) => (a + Math.random() * (b - a)).toFixed(2);
    let h = '';
    if (d.mode === 'slash') for (let i = 0; i < 9; i++) h += `<b style="--y:${R(5, 95)};--r:${R(-35, 35)};--w:${R(0, 2.4)}"></b>`;
    else if (d.mode === 'glitch') for (let i = 0; i < 12; i++) h += `<u style="--y:${R(0, 98)};--s:${R(3, 26)};--w:${R(0, 1.6)}"></u>`;
    else if (d.mode === 'ring') for (let i = 0; i < 4; i++) h += `<s style="--w:${R(0, 1.8)}"></s>`;
    else for (let i = 0; i < 26; i++) h += `<i style="--x:${R(0, 100)};--d:${R(4, 8)};--s:${R(14, 34)};--w:${R(0, 8)}">${d.g}</i>`;
    fx.innerHTML = h;
  }
  async function end(r) {
    playing = false;
    const rec = r.t > prog.best_time;
    for (const id in (r.cuse || {})) { prog.combos[id] = prog.combos[id] || { uses: 0 }; prog.combos[id].uses = (prog.combos[id].uses || 0) + r.cuse[id]; }
    prog.shards += r.shards; prog.runs++; prog.best_time = Math.max(prog.best_time, r.t); prog.best_kills = Math.max(prog.best_kills, r.kills);
    await persist();
    deathScreen(cur(), spr(cur(), sel.s));
    $('overTxt').textContent = `${curMap().name} • Sobreviveu ${fmt(r.t)} • ${r.kills} aliens • nível ${r.lv} • +${r.shards} notas${r.bosses ? ` • ${r.bosses} chefe${r.bosses > 1 ? 's' : ''} derrotado${r.bosses > 1 ? 's' : ''}` : ''}`;
    $('overRec').textContent = rec ? '★ Novo recorde de tempo!' : '';
    show('over', () => $('deathFx').classList.remove('hidden'));
  }
  function levelUi(opts, pick) {
    $('choices').innerHTML = '';
    opts.forEach(o => {
      const b = document.createElement('button');
      if (o.card) {
        const T = TAROT[o.card.cid], c = CHARS.find(x => x.id === o.card.cid); b.className = 'tcd'; b.style.setProperty('--cc', c.col);
        b.innerHTML = `<i class="ctr"><img src="${tarotSrc(o.card.cid)}" alt=""></i><div><small>♠ CARTA · ${T.n.toUpperCase()} · NÍVEL ${o.card.tier} · ${o.card.k.toUpperCase()}</small><strong>${o.card.n}</strong><span>${o.card.d}</span></div>`;
      } else if (o.combo) {
        const c = o.combo, R = RARITY[c.rar], P = CHARS.find(x => x.id === o.partner);
        b.className = 'cmb' + (o.seen ? '' : ' hid'); b.style.setProperty('--rc', R.col); b.style.setProperty('--pc', P.col);
        b.innerHTML = `<i class="cpt"><img src="${cutSrc(P.id)}" alt=""></i><div><small>✦ SINERGIA ${R.n}${o.replace ? ' · troca a atual' : ''}</small><strong>${o.seen ? c.name : '??? ??? ???'}</strong>
          <span>${o.seen ? `<b>Arma:</b> ${c.w.n} · <b>Ultimate:</b> ${c.u.n} — com ${P.name}` : 'Um poder desconhecido ecoa nos bastidores. Escolha para descobrir quem canta com você.'}</span></div>`;
      } else b.innerHTML = `${o.name}${o.lv !== undefined ? ' (nv ' + o.lv + ' → ' + (o.lv + 1) + ')' : ''}<span>${o.desc}</span>`;
      b.onclick = () => { FX.sfx('skill'); $('levelup').classList.add('hidden'); pick(o.id); };
      $('choices').appendChild(b);
    });
    $('levelup').classList.remove('hidden');
  }
  $('btnPlay').onclick = play; $('btnAgain').onclick = play; $('btnToMenu').onclick = openMenu;
  $('skillBtn').addEventListener('pointerdown', e => { e.stopPropagation(); Game.skill(); });
  $('spBtn').addEventListener('pointerdown', e => { e.stopPropagation(); Game.special(); });

  // ---------- pause ----------
  function togglePause() {
    if (!playing || !$('levelup').classList.contains('hidden')) return;
    if ($('pause').classList.contains('hidden')) { Game.pause(); show('pause'); } else { Game.resume(); show(null); }
  }
  $('btnPause').onclick = togglePause; $('pResume').onclick = togglePause;
  $('pRestart').onclick = () => { Game.stop(); play(); };
  $('pMenu').onclick = openMenu;
  document.addEventListener('visibilitychange', () => { if (document.hidden && playing && $('pause').classList.contains('hidden') && $('levelup').classList.contains('hidden')) togglePause(); });

  // ---------- teclado ----------
  addEventListener('keydown', e => {
    const k = e.key;
    if ((k === 'm' || k === 'M') && !/^(INPUT|TEXTAREA)$/.test((e.target && e.target.tagName) || '')) { FX.toggleMute(); return; }   // M = mudo (não vale ao digitar no login)
    if (playing && (k === 'Escape' || k === 'p' || k === 'P')) return togglePause();
    if (playing && !$('levelup').classList.contains('hidden') && k >= '1' && k <= '5') { const b = $('choices').children[+k - 1]; if (b) b.click(); return; }
    if (!$('codex').classList.contains('hidden')) {
      if (k === 'Escape') openMenu();
      return;
    }
    if (!$('tarot').classList.contains('hidden')) {
      if (k === 'ArrowRight') selTarot(trI + 1); else if (k === 'ArrowLeft') selTarot(trI - 1); else if (k === 'Escape') openMenu();
      return;
    }
    if (!$('select').classList.contains('hidden')) {
      if (k === 'ArrowRight') pickChar(sel.c + 1); else if (k === 'ArrowLeft') pickChar(sel.c - 1);
      else if (k === 'ArrowDown') pickSkin(sel.s + 1); else if (k === 'ArrowUp') pickSkin(sel.s - 1);
      else if (k === 'Enter') $('selOk').click(); else if (k === 'Escape') $('selBack').click();
    } else if (!$('maps').classList.contains('hidden')) {
      if (k === 'ArrowRight' || k === 'ArrowDown') pickMap(mapTmp + 1);
      else if (k === 'ArrowLeft' || k === 'ArrowUp') pickMap(mapTmp - 1);
      else if (k === 'Enter') $('mapOk').click(); else if (k === 'Escape') $('mapBack').click();
    }
  });

  // ---------- cursor com brilho ----------
  let lastSpark = 0;
  addEventListener('pointermove', e => {
    if (curId === null) return;
    const n = performance.now(); if (n - lastSpark < 45) return; lastSpark = n;
    const s = document.createElement('i'); s.className = 'spark' + (Math.random() < .5 ? ' p' : '');
    s.style.left = e.clientX + 'px'; s.style.top = e.clientY + 'px'; document.body.appendChild(s); setTimeout(() => s.remove(), 700);
  });

  API.call('me').then(r => { if (r.username) { user = r.username; prog = r.progress; openMenu(); } else show('auth'); });
})();
