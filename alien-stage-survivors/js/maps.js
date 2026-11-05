// Palcos temáticos. Cada um tem fundo próprio (desenhado no canvas), cores de aliens e uma regra especial (mod).
// mod: xp = multiplicador de XP | en = velocidade dos aliens | hp = vida dos aliens | mag = ímã inicial | heal = cura ao subir de nível
const H32 = (a, b, k = 0) => { const x = Math.sin(a * 127.1 + b * 311.7 + k * 74.7) * 43758.5453; return x - Math.floor(x); };
// percorre "células" visíveis de uma camada com parallax (par) e chama cb com posição na tela
function cells(o, par, size, cb) {
  const ox = o.cx * par, oy = o.cy * par;
  const x0 = Math.floor(-ox / size) - 1, x1 = Math.floor((o.W - ox) / size) + 1, y0 = Math.floor(-oy / size) - 1, y1 = Math.floor((o.H - oy) / size) + 1;
  for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++)
    cb(gx * size + ox + size * H32(gx, gy, 1), gy * size + oy + size * H32(gx, gy, 2), gx, gy);
}
// Cache de fundos estáticos: gradientes de tela cheia, luas, bolhas e brilhos são pintados uma vez (por tamanho/escala) e depois só copiados a cada quadro.
// Preencher um gradiente grande todo quadro é caro (principalmente sem aceleração por GPU); copiar um bitmap pronto é barato.
const BGC = new Map();
function bgCached(c, key, w, h, paint) {
  const tr = c.getTransform && c.getTransform(), k = tr && tr.a ? tr.a : 1, id = key + '|' + k;
  let cv = BGC.get(id);
  if (!cv) {
    if (BGC.size > 60) BGC.clear();
    cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
    const g = cv.getContext('2d'); g.scale(k, k); paint(g, k); BGC.set(id, cv);
  }
  return cv;
}
const radial = (c, o, x, y, r0, r1, stops) => c.drawImage(bgCached(c, `r|${o.W}|${o.H}|${x}|${y}|${r0}|${r1}|${stops.join()}`, o.W, o.H, g => {
  const gr = g.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([p, col]) => gr.addColorStop(p, col)); g.fillStyle = gr; g.fillRect(0, 0, o.W, o.H); }), 0, 0, o.W, o.H);
const vlinear = (c, o, a, b) => c.drawImage(bgCached(c, `l|${o.W}|${o.H}|${a}|${b}`, o.W, o.H, g => {
  const gr = g.createLinearGradient(0, 0, 0, o.H); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, o.W, o.H); }), 0, 0, o.W, o.H);
const TAU2 = Math.PI * 2;

// ---------- ferramentas de desenho dos palcos ----------
const mWrap = (v, m) => ((v % m) + m) % m;
// n partículas que dão a volta na tela (quantidade fixa, independente da resolução). cb(x, y, i, h): h = número estável 0..1 de cada partícula
function mDrift(o, n, k, par, vx, vy, pad, cb) {
  const mw = o.W + pad * 2, mh = o.H + pad * 2;
  for (let i = 0; i < n; i++) {
    const h = H32(i, k, 11), sp = .6 + h * .8;
    cb(mWrap(H32(i, k, 12) * mw + o.cx * par + o.t * vx * sp, mw) - pad, mWrap(H32(i, k, 13) * mh + o.cy * par + o.t * vy * sp, mh) - pad, i, h);
  }
}
const mSprite = (c, key, s, paint) => bgCached(c, key, s, s, paint);          // sprite quadrado s×s, pintado em unidades lógicas
const mPut = (c, im, x, y, r) => c.drawImage(im, x - r, y - r, r * 2, r * 2);   // desenha o sprite centrado, com raio r
const mGlow = (c, col) => mSprite(c, 'gl|' + col, 64, g => {                    // bolinha de luz suave (col = #rrggbb)
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, col + 'ff'); gr.addColorStop(.3, col + '99'); gr.addColorStop(1, col + '00'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
const mBokeh = (c, col) => mSprite(c, 'bk|' + col, 64, g => {                   // disco de luz desfocada com borda mais forte (bokeh)
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 30); gr.addColorStop(0, col + '44'); gr.addColorStop(.78, col + '88'); gr.addColorStop(1, col + '00'); g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 30, 0, TAU2); g.fill();
  g.strokeStyle = col + 'bb'; g.lineWidth = 1.6; g.beginPath(); g.arc(32, 32, 26, 0, TAU2); g.stroke(); });
// vinheta escura nas bordas (cacheada)
const mVig = (c, o, rgb, a = .6, from = .42) => radial(c, o, o.W * .5, o.H * .5, Math.min(o.W, o.H) * from, Math.max(o.W, o.H) * .78, [[0, `rgba(${rgb},0)`], [1, `rgba(${rgb},${a})`]]);
const mBeam = (c, col, w, h) => bgCached(c, `bm|${col}|${w}|${h}`, w, h, g => {   // feixe de luz triangular (ponta em cima), cacheado
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, col + 'cc'); gr.addColorStop(.55, col + '44'); gr.addColorStop(1, col + '00');
  g.fillStyle = gr; g.beginPath(); g.moveTo(w * .43, 0); g.lineTo(w * .57, 0); g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fill(); });
const mFog = (c, rgb, a) => bgCached(c, `fg|${rgb}|${a}`, 512, 128, g => {          // faixa de névoa achatada, cacheada
  g.translate(256, 64); g.scale(1, .25); const gr = g.createRadialGradient(0, 0, 0, 0, 0, 256); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 256, 0, TAU2); g.fill(); });
// feixe vertical suave (barra de luz) usado em Clementis
const mStreak = (c, rgb) => bgCached(c, 'sk|' + rgb, 40, 512, g => {
  const hg = g.createLinearGradient(0, 0, 40, 0); hg.addColorStop(0, `rgba(${rgb},0)`); hg.addColorStop(.5, `rgba(${rgb},.95)`); hg.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = hg; g.fillRect(0, 0, 40, 512); g.globalCompositeOperation = 'destination-in';
  const vg = g.createLinearGradient(0, 0, 0, 512); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(.35, 'rgba(0,0,0,1)'); vg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = vg; g.fillRect(0, 0, 40, 512); });

const MAPS = [
  // ───────────── My Clementis: céu azul-petróleo que vira coral, bokeh de mil cores, feixes de luz e a esfera de traços ─────────────
  { id: 'clementis', name: 'My Clementis', img: 'assets/maps/clementis.webp', col: '#ff4fa8',
    desc: 'Cérebro de luz rosa flutuando no espaço.', rule: 'Ímã de Notas já começa no nível 1.',
    mod: { mag: 1 }, al: ['#ff5fb0', '#ffd1ec', '#c23aa5', '#ff2e88'],
    draw(c, o) {
      const W = o.W, H = o.H, t = o.t, M = Math.max(W, H);
      vlinear(c, o, '#0a1322', '#3d1a33');
      radial(c, o, W * .5, H * 1.08, 0, H * 1.0, [[0, 'rgba(255,165,172,.85)'], [.4, 'rgba(236,96,140,.42)'], [1, 'rgba(236,96,140,0)']]);
      radial(c, o, W * .28, H * .15, 0, M * .5, [[0, 'rgba(40,150,160,.2)'], [1, 'rgba(40,150,160,0)']]);
      c.globalCompositeOperation = 'lighter';
      const ray = bgCached(c, 'clm-ray', 220, 1000, g => {
        const hg = g.createLinearGradient(0, 0, 220, 0); hg.addColorStop(0, 'rgba(255,200,190,0)'); hg.addColorStop(.5, 'rgba(255,222,208,.85)'); hg.addColorStop(1, 'rgba(255,200,190,0)'); g.fillStyle = hg; g.fillRect(0, 0, 220, 1000);
        g.globalCompositeOperation = 'destination-in'; const vg = g.createLinearGradient(0, 0, 0, 1000); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(.5, 'rgba(0,0,0,1)'); vg.addColorStop(1, 'rgba(0,0,0,.2)'); g.fillStyle = vg; g.fillRect(0, 0, 220, 1000); });
      c.save(); c.translate(W * .84 + Math.sin(t * .2) * 30 + o.cx * .05, -H * .05); c.rotate(.62); c.globalAlpha = .34; c.drawImage(ray, -110, 0, 220, M * 1.3); c.restore();
      const st = mStreak(c, '255,200,225'), st2 = mStreak(c, '255,235,235');
      for (let i = 0; i < 22; i++) {      // feixes verticais caindo
        const h = H32(i, 3, 1), L = 260 + h * 420, w = 10 + h * 26, x = mWrap(H32(i, 3, 2) * (W + 160) + o.cx * (.18 + h * .3), W + 160) - 80, y = mWrap(t * (50 + h * 110) + H32(i, 3, 4) * (H + L), H + L) - L;
        c.globalAlpha = .2 + .4 * H32(i, 3, 5); c.drawImage(i % 3 ? st : st2, x - w / 2, y, w, L);
      }
      // bokeh pequeno, médio e grande em várias cores
      const cols = ['#ffffff', '#ffe9a8', '#a8f0ff', '#ffb3d9', '#d9b8ff', '#ffc9a8'];
      [[46, 21, .1, 3, 7, .55], [34, 22, .24, 6, 14, .5], [16, 23, .45, 12, 26, .42], [7, 24, .8, 26, 44, .3]].forEach(([n, k, par, r0, rr, al]) =>
        mDrift(o, n, k, par, 4, -9, 60, (x, y, i, h) => { c.globalAlpha = al * (.5 + .5 * Math.sin(t * (.5 + h * 1.2) + h * 30)); mPut(c, mBokeh(c, cols[i % 6]), x, y, r0 + h * rr); }));
      // esfera de traços (a "esfera-cérebro" da cena do coro)
      const bx = W * .5 + o.cx * .04, by = H * .46 + o.cy * .04, R = Math.min(W, H) * .26;
      c.globalAlpha = .4; mPut(c, mGlow(c, '#ff9fc8'), bx, by, R * 1.5); c.lineWidth = 1; c.globalAlpha = .6;
      for (let i = 0; i < 14; i++) { const ph = t * .32 + i * Math.PI / 14; c.strokeStyle = i % 3 ? 'rgba(255,190,225,.3)' : 'rgba(255,245,250,.45)'; c.beginPath(); c.ellipse(bx, by, R * Math.abs(Math.cos(ph)) + .5, R, 0, 0, TAU2); c.stroke(); }
      for (let i = -2; i <= 2; i++) { const la = i * .5, rx = R * Math.cos(la); c.strokeStyle = 'rgba(255,200,230,.25)'; c.beginPath(); c.ellipse(bx, by + R * Math.sin(la), rx, rx * .22, 0, 0, TAU2); c.stroke(); }
      c.strokeStyle = 'rgba(255,230,245,.35)'; c.beginPath();
      for (let i = 0; i < 7; i++) { const a = t * (.5 + i * .13) + i * 1.7, ra = R * (.55 + .45 * H32(i, 9, 1)); c.moveTo(bx + Math.cos(a) * ra, by + Math.sin(a * 1.3) * ra * .9); c.bezierCurveTo(bx + Math.cos(a + 1) * ra * 1.2, by + Math.sin(a + 2) * ra, bx + Math.cos(a + 2.4) * ra, by + Math.sin(a + 1) * ra * 1.2, bx + Math.cos(a + 3) * ra * .8, by + Math.sin(a + 3) * ra); }
      c.stroke();
      c.globalAlpha = 1; cells(o, .7, 110, (x, y, gx, gy) => { if (H32(gx, gy, 6) < .4) return; const tw = .3 + .7 * Math.abs(Math.sin(t * 1.4 + gx * 3 + gy)); c.fillStyle = `rgba(255,240,245,${tw * .85})`; c.fillRect(x - 5, y, 11, 1); c.fillRect(x, y - 5, 1, 11); });
      c.globalCompositeOperation = 'source-over'; mVig(c, o, '8,4,14', .4, .5);
    } },

  // ───────────── Blink Gone: arena neon (azul, verde e roxo): túnel de retângulos, feixes radiais, globo de espelhos e bastões de luz ─────────────
  { id: 'blinkgone', name: 'Blink Gone', img: 'assets/maps/blinkgone.webp', col: '#2aa0ff',
    desc: 'Túnel neon de grades azuis e verdes.', rule: '+25% de XP, mas os aliens são 12% mais rápidos.',
    mod: { xp: 1.25, en: 1.12 }, al: ['#35a8ff', '#3dffb0', '#2a5cff', '#18e0ff'],
    draw(c, o) {
      const W = o.W, H = o.H, t = o.t, M = Math.max(W, H);
      radial(c, o, W * .5, H * .5, 0, M * .78, [[0, '#0c3496'], [.32, '#0a1860'], [.7, '#050b2e'], [1, '#02030d']]);
      c.globalCompositeOperation = 'lighter';
      // feixes radiais de luz saindo do alto
      const bb = mBeam(c, '#4aa8ff', 64, 900), bp = mBeam(c, '#a05aff', 64, 900);
      for (let i = 0; i < 11; i++) { c.save(); c.translate(W * .5 + o.cx * .02, -30); c.rotate((i - 5) * .21 + Math.sin(t * .3 + i * 1.3) * .05); c.globalAlpha = .13 + .07 * Math.sin(t * .9 + i); const L = M * 1.2; c.drawImage(i % 2 ? bp : bb, -34, 0, 68, L); c.restore(); }
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      // túnel de retângulos neon que vêm do fundo
      c.save(); c.translate(W * .5 + Math.sin(t * .27) * W * .012, H * .52); c.rotate(Math.sin(t * .2) * .08);
      const N = 15, sp = t * .42, f = Math.floor(sp), ph = sp - f, pal = ['rgba(50,150,255,', 'rgba(61,255,176,', 'rgba(24,224,255,', 'rgba(170,100,255,'];
      for (let k = N; k >= 0; k--) {
        const z = (k + ph) / N, sz = Math.pow(z, 2.2) * M * 1.55 + 6, id = ((k - f) % 4 + 4) % 4, a = Math.min(1, z * 2.6) * .85;
        c.lineWidth = .8 + z * 4.5; c.strokeStyle = pal[id] + a + ')'; c.strokeRect(-sz / 2, -sz * .42, sz, sz * .84);
      }
      c.restore();
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = .5; mPut(c, mGlow(c, '#3dffd0'), W * .5, H * .52, M * .17); c.globalAlpha = 1;
      // globo de espelhos
      const dr = Math.min(W, H) * .13, dx = W * .2 + o.cx * .05, dy = H * .2 + o.cy * .05;
      const ball = bgCached(c, 'bg-ball|' + (dr | 0), dr * 2 + 20, dr * 2 + 20, g => {
        g.translate(dr + 10, dr + 10); g.beginPath(); g.arc(0, 0, dr, 0, TAU2); g.clip(); const gr = g.createRadialGradient(-dr * .3, -dr * .3, dr * .1, 0, 0, dr); gr.addColorStop(0, '#6aa0ff'); gr.addColorStop(.6, '#1c2f9a'); gr.addColorStop(1, '#070b36'); g.fillStyle = gr; g.fillRect(-dr, -dr, dr * 2, dr * 2);
        g.strokeStyle = 'rgba(160,200,255,.55)'; g.lineWidth = 1; g.beginPath(); for (let i = -4; i <= 4; i++) { const yy = i * dr / 4.5; g.moveTo(-dr, yy); g.lineTo(dr, yy); const rx = dr * Math.sin(i * .3); g.moveTo(i * dr / 4.5, -dr); g.lineTo(i * dr / 4.5 * 1.1, dr); } g.stroke(); });
      c.globalAlpha = .85; c.drawImage(ball, dx - dr - 10, dy - dr - 10, dr * 2 + 20, dr * 2 + 20); c.globalAlpha = 1;
      for (let i = 0; i < 14; i++) { const a = H32(i, 5, 1) * TAU2, rr = dr * Math.sqrt(H32(i, 5, 2)) * .9, tw = Math.max(0, Math.sin(t * 3 + i * 5)); if (tw > .2) { c.fillStyle = `rgba(210,235,255,${tw * .9})`; c.fillRect(dx + Math.cos(a) * rr - 2, dy + Math.sin(a) * rr - 2, 5, 5); } }
      // pontinhos de painel de LED (meio-tom) por toda a tela
      const dots = bgCached(c, 'bg-dots|' + W + '|' + H, W, H, g => { g.fillStyle = 'rgba(110,170,255,.5)'; for (let y = 4; y < H; y += 10) for (let x = (y / 10 & 1) * 5 + 2; x < W; x += 10) g.fillRect(x, y, 1.6, 1.6); });
      c.globalAlpha = .09; c.drawImage(dots, 0, 0, W, H); c.globalAlpha = 1;
      // pacotes de dados, quadradinhos e falhas de sinal
      cells(o, .4, 150, (x, y, gx, gy) => { if (H32(gx, gy, 6) < .66) return; c.strokeStyle = H32(gx, gy, 7) < .5 ? 'rgba(61,255,176,.35)' : 'rgba(170,110,255,.4)'; c.strokeRect(x, y, 10, 10); });
      mDrift(o, 36, 31, .45, 150, 0, 40, (x, y, i, h) => { c.fillStyle = i % 3 ? 'rgba(80,220,255,.5)' : i % 2 ? 'rgba(61,255,176,.55)' : 'rgba(180,120,255,.55)'; c.fillRect(x, y, 6 + h * 22, 2); });
      const gk = Math.floor(t * 5);
      if (H32(gk, 1, 2) > .72) for (let j = 0; j < 3; j++) { c.fillStyle = j % 2 ? 'rgba(61,255,176,.10)' : 'rgba(255,46,200,.09)'; c.fillRect(H32(gk, j, 5) * W * .5, H32(gk, j, 3) * H, W * .6, 4 + H32(gk, j, 4) * 22); }
      c.globalCompositeOperation = 'source-over';
      // plateia: mãos para cima com bastões de luz roxos
      c.fillStyle = '#04030c'; const by0 = H + 4;
      mDrift(o, 16, 32, .5, 0, 0, 80, (x, y, i, h) => { const hy = H * (.9 - .1 * h) + Math.sin(t * 1.8 + i) * 6, w = 30 + h * 26; c.beginPath(); c.ellipse(x, hy + 40, w, 60 + h * 30, 0, 0, TAU2); c.fill();
        c.save(); c.translate(x + w * .3, hy - 10); c.rotate(.35 + Math.sin(t * 2 + i * 3) * .35); c.strokeStyle = `rgba(${i % 2 ? '255,70,210' : '150,100,255'},.9)`; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -38 - h * 14); c.stroke(); c.restore(); });
      c.fillRect(0, H - 14, W, 14); mVig(c, o, '1,2,10', .5);
    },
    after(c, o) { const k = o.t % 11; if (k < .14) { c.fillStyle = `rgba(150,200,255,${.3 * (1 - k / .14)})`; c.fillRect(0, 0, o.W, o.H); } } },

  // ───────────── Black Sorrow: céu azul-marinho, chuva de meteoros, feixes cruzados, anel no palco e esferas de prata ─────────────
  { id: 'blacksorrow', name: 'Black Sorrow', img: 'assets/maps/blacksorrow.webp', col: '#c9ced6',
    desc: 'Anel de prata e bolhas flutuando no vazio.', rule: 'Bolhas de prata surgem e dão um escudo contra 1 golpe.',
    mod: {}, al: ['#c9ced6', '#8c93a0', '#5d6370', '#ffffff'],
    draw(c, o) {
      const W = o.W, H = o.H, t = o.t, M = Math.max(W, H);
      radial(c, o, W * .5, H * .6, 0, M * .8, [[0, '#14223a'], [.5, '#080e1c'], [1, '#02030a']]);
      cells(o, .2, 70, (x, y, gx, gy) => { c.fillStyle = `rgba(190,210,255,${.12 + .6 * H32(gx, gy, 3) * Math.abs(Math.sin(t * .7 + gx * 5 + gy))})`; c.fillRect(x, y, 2, 2); });
      c.globalCompositeOperation = 'lighter';
      // feixes cruzados em X subindo do palco, com névoa na base
      const bm = mBeam(c, '#9fc0ff', 120, 900);
      for (const s of [-1, 1]) { c.save(); c.translate(W * .5 + o.cx * .03, H * 1.02); c.rotate(Math.PI + s * (.55 + Math.sin(t * .2 + s) * .04)); c.globalAlpha = .17; c.drawImage(bm, -150, 0, 300, M * 1.15); c.restore(); }
      c.globalAlpha = 1; radial(c, o, W * .5, H * 1.05, 0, H * .75, [[0, 'rgba(160,195,255,.34)'], [.5, 'rgba(90,120,190,.12)'], [1, 'rgba(60,90,160,0)']]);
      // chuva de meteoros (diagonal para baixo e à esquerda)
      c.lineCap = 'round';
      for (const [n, k, par, sp, lw, al] of [[34, 41, .3, 230, 1, .5], [18, 42, .6, 380, 2, .7]]) {
        mDrift(o, n, k, par, -sp, sp * .8, 120, (x, y, i, h) => { const L = 50 + h * 120, ux = .78, uy = -.62, gr = c.createLinearGradient(x, y, x + ux * L, y + uy * L); gr.addColorStop(0, `rgba(235,245,255,${al})`); gr.addColorStop(1, 'rgba(120,160,255,0)'); c.strokeStyle = gr; c.lineWidth = lw; c.beginPath(); c.moveTo(x, y); c.lineTo(x + ux * L, y + uy * L); c.stroke(); });
      }
      c.lineCap = 'butt'; c.globalCompositeOperation = 'source-over';
      // anel do palco: disco escuro com aros de prata
      const rx = Math.min(W * .6, 760), ry = rx * .27, pad = 34, rcx = W * .5 + o.cx * .12, rcy = H * .72 + o.cy * .1;
      const ring = bgCached(c, 'bs-ring2|' + (rx | 0), (rx + pad) * 2, (ry + pad) * 2, (g, k) => {
        g.translate(rx + pad, ry + pad); g.fillStyle = 'rgba(2,3,8,.75)'; g.beginPath(); g.ellipse(0, 0, rx * .98, ry * .98, 0, 0, TAU2); g.fill();
        for (let i = 0; i < 12; i++) { const s = .45 + i * .045; g.strokeStyle = `rgba(190,205,230,${.05 + (i % 3 ? 0 : .08)})`; g.lineWidth = 1; g.beginPath(); g.ellipse(0, 0, rx * s, ry * s, 0, 0, TAU2); g.stroke(); }
        g.shadowColor = '#cfe0ff'; g.shadowBlur = 24 * k; [[1, 6, .75], [1.06, 1.5, .45], [.97, 1.5, .4]].forEach(([s, w, a]) => { g.strokeStyle = `rgba(226,236,255,${a})`; g.lineWidth = w; g.beginPath(); g.ellipse(0, 0, rx * s, ry * s, 0, 0, TAU2); g.stroke(); }); });
      c.drawImage(ring, rcx - rx - pad, rcy - ry - pad, (rx + pad) * 2, (ry + pad) * 2);
      // esferas de prata: pequenas de vidro ao fundo e grandes metálicas na frente
      const bub = mSprite(c, 'bs-bub2', 96, g => {
        const gr = g.createRadialGradient(36, 34, 4, 48, 48, 46); gr.addColorStop(0, 'rgba(255,255,255,.8)'); gr.addColorStop(.25, 'rgba(190,210,235,.25)'); gr.addColorStop(.8, 'rgba(70,90,120,.2)'); gr.addColorStop(1, 'rgba(225,238,255,.6)');
        g.fillStyle = gr; g.beginPath(); g.arc(48, 48, 44, 0, TAU2); g.fill(); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.beginPath(); g.arc(48, 48, 43, 0, TAU2); g.stroke(); g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.ellipse(34, 30, 10, 5, -.7, 0, TAU2); g.fill(); });
      const sph = mSprite(c, 'bs-sph', 128, g => {
        const gr = g.createRadialGradient(46, 42, 6, 64, 64, 62); gr.addColorStop(0, '#f4f8ff'); gr.addColorStop(.35, '#a9b5c8'); gr.addColorStop(.75, '#454f63'); gr.addColorStop(1, '#10151f');
        g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 60, 0, TAU2); g.fill(); g.fillStyle = 'rgba(8,12,22,.45)'; g.beginPath(); g.ellipse(76, 84, 34, 22, .5, 0, TAU2); g.fill(); g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.ellipse(42, 34, 18, 8, -.7, 0, TAU2); g.fill(); g.strokeStyle = 'rgba(220,235,255,.7)'; g.lineWidth = 2; g.beginPath(); g.arc(64, 64, 59, 0, TAU2); g.stroke(); });
      mDrift(o, 12, 43, .22, 0, -12, 110, (x, y, i, h) => { c.globalAlpha = .5; mPut(c, bub, x + Math.sin(t * .6 + i * 2) * 14, y, 8 + h * 16); });
      mDrift(o, 5, 44, .55, 0, -18, 140, (x, y, i, h) => { c.globalAlpha = .9; mPut(c, sph, x + Math.sin(t * .5 + i * 2) * 10, y, 34 + h * 40); });
      mDrift(o, 3, 45, .95, 0, -26, 200, (x, y, i, h) => { c.globalAlpha = .9; mPut(c, sph, x + Math.sin(t * .4 + i) * 8, y, 90 + h * 60); });
      c.globalAlpha = 1; c.globalCompositeOperation = 'lighter';
      mDrift(o, 40, 46, .5, 0, -8, 20, (x, y, i, h) => { c.fillStyle = `rgba(210,225,255,${.2 + .5 * Math.abs(Math.sin(t * 1.2 + i))})`; c.fillRect(x, y, 2, 2); });
      c.globalCompositeOperation = 'source-over'; mVig(c, o, '1,2,6', .6);
    } },

  // ───────────── Ruler of My Heart: lua enorme, arco de coluna vertebral e terraços de ossos empilhados ─────────────
  { id: 'ruler', name: 'Ruler of My Heart', img: 'assets/maps/ruler.webp', col: '#e8dcc0',
    desc: 'Uma lua gigante sobre fitas de osso e luz.', rule: 'Luar curativo: +12 de vida a cada nível.',
    mod: { heal: 12 }, al: ['#e8dcc0', '#c7b693', '#8f7f66', '#fff2d1'],
    draw(c, o) {
      const W = o.W, H = o.H, t = o.t, M = Math.max(W, H);
      vlinear(c, o, '#050507', '#100e0b');
      cells(o, .08, 80, (x, y, gx, gy) => { c.fillStyle = `rgba(255,248,230,${.12 + .6 * H32(gx, gy, 3) * Math.abs(Math.sin(t * .5 + gx * 4 + gy))})`; c.fillRect(x, y, 2, 2); });
      // lua enorme, com mares e crateras, e halo que pulsa em batida dupla
      const mr = Math.min(W, H) * .42, mx = W * .62 + o.cx * .03, my = H * .4 + o.cy * .03, beat = Math.max(0, Math.sin(t * 5.2)) * Math.max(0, Math.sin(t * .85 * Math.PI * 2 / 3.1));
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = .5 + .12 * Math.sin(t * 1.3); mPut(c, mGlow(c, '#fff6e0'), mx, my, mr * 1.7); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      const pad = 8, sz = 2 * (mr + pad), moon = bgCached(c, 'ruler-moon2|' + Math.round(mr), sz, sz, (g, k) => {
        g.translate(sz / 2, sz / 2); g.save(); g.beginPath(); g.arc(0, 0, mr, 0, TAU2); g.clip();
        const mg = g.createRadialGradient(-mr * .25, -mr * .25, mr * .1, 0, 0, mr); mg.addColorStop(0, '#f7f4ec'); mg.addColorStop(.7, '#d9d4c7'); mg.addColorStop(1, '#b4ad9c'); g.fillStyle = mg; g.fillRect(-mr, -mr, mr * 2, mr * 2);
        for (let i = 0; i < 22; i++) { const a = H32(i, 2, 1) * TAU2, d = Math.sqrt(H32(i, 2, 2)) * mr * .9, r = mr * (.08 + .2 * H32(i, 2, 3)); const bg = g.createRadialGradient(Math.cos(a) * d, Math.sin(a) * d, 0, Math.cos(a) * d, Math.sin(a) * d, r); bg.addColorStop(0, `rgba(105,100,90,${.14 + .14 * H32(i, 2, 4)})`); bg.addColorStop(1, 'rgba(105,100,90,0)'); g.fillStyle = bg; g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, r, 0, TAU2); g.fill(); }
        for (let i = 0; i < 26; i++) { const a = H32(i, 3, 1) * TAU2, d = Math.sqrt(H32(i, 3, 2)) * mr * .92, r = mr * (.012 + .03 * H32(i, 3, 3)); g.fillStyle = 'rgba(120,115,104,.28)'; g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, r, 0, TAU2); g.fill(); g.strokeStyle = 'rgba(255,255,248,.3)'; g.lineWidth = 1; g.beginPath(); g.arc(Math.cos(a) * d - .5, Math.sin(a) * d - .5, r, 3.5, 5.5); g.stroke(); }
        g.restore(); });
      c.drawImage(moon, mx - sz / 2, my - sz / 2, sz, sz);
      if (beat > .01) { c.strokeStyle = `rgba(255,246,224,${beat * .3})`; c.lineWidth = 4; c.beginPath(); c.arc(mx, my, mr * (1.02 + beat * .06), 0, TAU2); c.stroke(); }
      // arco de coluna vertebral cruzando o céu
      const ax = W * .45 + o.cx * .07, ay = H * 1.25 + o.cy * .07, arx = W * .72, ary = H * 1.1;
      c.lineCap = 'butt'; c.strokeStyle = 'rgba(58,54,46,.92)'; c.lineWidth = 26; c.setLineDash([20, 4]); c.beginPath(); c.ellipse(ax, ay, arx, ary, 0, Math.PI * 1.08, Math.PI * 1.9); c.stroke();
      c.strokeStyle = 'rgba(190,180,158,.55)'; c.lineWidth = 4; c.setLineDash([20, 24]); c.beginPath(); c.ellipse(ax, ay - 7, arx, ary, 0, Math.PI * 1.08, Math.PI * 1.9); c.stroke(); c.setLineDash([]);
      // terraços de osso (camadas onduladas) em parallax
      const bands = [[.1, .66, 34, '#403a2f', '#17140f'], [.2, .72, 30, '#6b6352', '#201c15'], [.34, .79, 28, '#9d927a', '#2c271e'], [.5, .87, 24, '#d8ccaa', '#3b3427'], [.7, .95, 18, '#f1e6c4', '#57503f']];
      bands.forEach(([par, yb, amp, top, bot], k) => {
        const ox = o.cx * par, oy = o.cy * par * .4, base = H * yb + oy; c.beginPath(); c.moveTo(-20, H + 20);
        for (let x = -20; x <= W + 24; x += 20) { const u = x - ox; c.lineTo(x, base + Math.sin(u * .006 + k * 2) * amp + Math.sin(u * .017 + k) * amp * .35 + Math.sin(u * .0023 + k * 3) * amp * .8); }
        c.lineTo(W + 24, H + 20); c.closePath(); const gr = c.createLinearGradient(0, base - amp, 0, base + H * .12); gr.addColorStop(0, top); gr.addColorStop(1, bot); c.fillStyle = gr; c.fill();
        c.strokeStyle = 'rgba(255,246,220,.42)'; c.lineWidth = 2; c.beginPath();
        for (let x = -20; x <= W + 24; x += 20) { const u = x - ox, y = base + Math.sin(u * .006 + k * 2) * amp + Math.sin(u * .017 + k) * amp * .35 + Math.sin(u * .0023 + k * 3) * amp * .8; x < -19 ? c.moveTo(x, y) : c.lineTo(x, y); } c.stroke(); });
      c.globalCompositeOperation = 'lighter';
      mDrift(o, 50, 51, .6, 5, -14, 20, (x, y, i, h) => { c.fillStyle = `rgba(255,${215 + h * 30 | 0},150,${.2 + .5 * Math.abs(Math.sin(t * 1.3 + i))})`; const s = 1.5 + h * 2.5; c.fillRect(x, y, s, s); });
      c.globalCompositeOperation = 'source-over'; mVig(c, o, '2,2,2', .55);
    } },

  // ───────────── Cure: breu esfumaçado, chuva fina, discos achatados de borda branca, pilares de luz ─────────────
  { id: 'cure', name: 'Cure', img: 'assets/maps/cure.webp', col: '#6fe0f0',
    desc: 'Plataformas cinzentas flutuando na névoa.', rule: 'Pilares de luz caem sobre os aliens. Eles têm +15% de vida.',
    mod: { hp: 1.15 }, al: ['#6fe0f0', '#9ab3c2', '#4a6f86', '#d5f6ff'],
    draw(c, o) {
      const W = o.W, H = o.H, t = o.t, M = Math.max(W, H);
      vlinear(c, o, '#04060a', '#101820');
      const fogA = mFog(c, '78,104,124', .34);
      mDrift(o, 7, 61, .12, 9, 0, 340, (x, y, i, h) => { const w = 700 + h * 600; c.globalAlpha = .65; c.drawImage(fogA, x - w / 2, y - w * .13, w, w * .26); });
      c.globalAlpha = 1; c.globalCompositeOperation = 'lighter';
      const bm = mBeam(c, '#c8dcea', 90, 900);
      [[.16, .22, .2], [.3, .3, .14]].forEach(([p, rot, a], i) => { c.save(); c.translate(W * p + o.cx * .04, -40); c.rotate(rot + Math.sin(t * .3 + i) * .02); c.globalAlpha = a * (.8 + .2 * Math.sin(t * .6 + i)); c.drawImage(bm, -60, 0, 120, M * 1.2); c.restore(); });
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      // discos finos flutuando, com a borda da frente branca e brilhante
      const disc = (x, y, rx, a, glint) => {
        const ry = rx * .1, th = rx * .045; c.globalAlpha = a;
        c.fillStyle = 'rgb(20,26,32)'; c.beginPath(); c.ellipse(x, y + th, rx, ry, 0, 0, Math.PI); c.lineTo(x - rx, y); c.ellipse(x, y, rx, ry, 0, Math.PI, 0, true); c.closePath(); c.fill();
        const gr = c.createLinearGradient(0, y - ry, 0, y + ry); gr.addColorStop(0, 'rgb(112,124,136)'); gr.addColorStop(1, 'rgb(40,48,56)'); c.fillStyle = gr; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU2); c.fill();
        c.strokeStyle = 'rgba(235,245,255,.85)'; c.lineWidth = glint ? 2 : 1; c.beginPath(); c.ellipse(x, y + th * .4, rx, ry, 0, .15, Math.PI - .15); c.stroke();
        if (glint) { c.globalCompositeOperation = 'lighter'; mPut(c, mGlow(c, '#ffffff'), x + rx * .3, y + ry * .9, 12 + 6 * Math.sin(t * 2 + x)); c.globalCompositeOperation = 'source-over'; } };
      cells(o, .3, 280, (x, y, gx, gy) => { if (H32(gx, gy, 5) < .4) return; disc(x, y + Math.sin(t * .5 + gx * 3) * 6, 44 + H32(gx, gy, 6) * 50, .5, false); });
      // pilares de luz brancos (cilindros)
      cells(o, .5, 520, (x, y, gx, gy) => { if (H32(gx, gy, 8) < .66) return; const h = 130 + H32(gx, gy, 9) * 80, w = 30;
        const gr = c.createLinearGradient(x - w / 2, 0, x + w / 2, 0); gr.addColorStop(0, 'rgba(90,100,112,.9)'); gr.addColorStop(.5, 'rgba(250,252,255,.98)'); gr.addColorStop(1, 'rgba(70,80,92,.9)'); c.fillStyle = gr; c.fillRect(x - w / 2, y - h, w, h);
        c.fillStyle = 'rgba(245,250,255,.95)'; c.beginPath(); c.ellipse(x, y - h, w / 2, 5, 0, 0, TAU2); c.fill(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = .4; mPut(c, mGlow(c, '#dfeeff'), x, y - h * .5, 70); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; });
      cells(o, .65, 330, (x, y, gx, gy) => { if (H32(gx, gy, 5) < .4) return; disc(x, y + Math.sin(t * .8 + gx * 3) * 8, 80 + H32(gx, gy, 6) * 70, .96, true); });
      c.globalAlpha = 1; c.globalCompositeOperation = 'lighter';
      // chuva fina
      c.strokeStyle = 'rgba(200,220,240,.22)'; c.lineWidth = 1; c.beginPath(); mDrift(o, 90, 63, .1, -30, 880, 30, (x, y, i, h) => { c.moveTo(x, y - 14 - h * 14); c.lineTo(x - 1.5, y); }); c.stroke();
      c.globalCompositeOperation = 'source-over'; radial(c, o, W * .5, H * 1.1, 0, H * .8, [[0, 'rgba(90,120,140,.28)'], [1, 'rgba(0,0,0,0)']]); mVig(c, o, '1,3,5', .6);
    } },

  // ───────────── Karma: palco em chamas — céu negro-avermelhado, treliças de metal, línguas de fogo, brasas e lava pingando ─────────────
  { id: 'karma', name: 'Karma', img: 'assets/maps/karma.webp', col: '#ff5a2a',
    desc: 'Um palco em chamas sob um céu negro-avermelhado.', rule: 'Retribuição: ao sofrer dano, uma onda de fogo devolve golpes aos aliens por perto. Aliens têm +10% de vida.',
    mod: { hp: 1.1 }, al: ['#ff5a2a', '#ffb347', '#a3182b', '#ffe3b0'],
    draw(c, o) {
      const W = o.W, H = o.H, t = o.t, M = Math.max(W, H);
      vlinear(c, o, '#070102', '#2b0807');
      radial(c, o, W * .5, H * 1.12, 0, H * 1.05, [[0, 'rgba(255,125,35,.8)'], [.33, 'rgba(225,55,20,.42)'], [1, 'rgba(120,10,10,0)']]);
      // treliças do palco: um arco enorme e uma viga reta, em silhueta com o fogo iluminando as bordas
      const truss = (cx0, cy0, rx, ry, a0, a1, w) => {
        c.strokeStyle = 'rgba(14,3,3,.92)'; c.lineWidth = w; c.beginPath(); c.ellipse(cx0, cy0, rx, ry, 0, a0, a1); c.stroke();
        c.strokeStyle = 'rgba(255,115,55,.4)'; c.lineWidth = 2; for (const d of [-w / 2, w / 2]) { c.beginPath(); c.ellipse(cx0, cy0, rx + d, ry + d, 0, a0, a1); c.stroke(); }
        c.lineWidth = 1.3; c.strokeStyle = 'rgba(255,100,45,.3)'; c.beginPath(); const n = 46; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n, s = i % 2 ? -w / 2 : w / 2; const x = cx0 + Math.cos(a) * (rx + s), y = cy0 + Math.sin(a) * (ry + s); i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); };
      truss(W * .6 + o.cx * .1, H * 1.3 + o.cy * .1, W * .85, H * 1.05, Math.PI * 1.08, Math.PI * 1.55, 34);
      truss(W * .1 + o.cx * .16, H * 1.45 + o.cy * .16, W * .5, H * 1.05, Math.PI * 1.18, Math.PI * 1.5, 22);
      // lava pingando do alto
      c.globalCompositeOperation = 'lighter';
      const drip = bgCached(c, 'k-drip', 26, 300, g => { const gr = g.createLinearGradient(0, 0, 0, 300); gr.addColorStop(0, 'rgba(255,90,20,0)'); gr.addColorStop(.7, 'rgba(255,120,30,.7)'); gr.addColorStop(1, 'rgba(255,230,150,1)'); g.fillStyle = gr; g.beginPath(); g.moveTo(10, 0); g.lineTo(16, 0); g.lineTo(22, 280); g.quadraticCurveTo(13, 300, 4, 280); g.closePath(); g.fill(); });
      mDrift(o, 7, 81, .3, 0, 110, 300, (x, y, i, h) => { c.globalAlpha = .55 + .3 * h; c.drawImage(drip, x - 13, y - 300, 26 * (.7 + h * .6), 300 * (.6 + h * .5)); });
      // chamas no chão: três camadas de línguas tremulando
      const nf = Math.ceil(W / 46) + 3;
      for (const [sc, col, al, par, ph0] of [[1.15, 'rgba(190,30,12,', .42, .35, 0], [.85, 'rgba(240,100,22,', .42, .5, 1.7], [.5, 'rgba(255,190,90,', .36, .65, 3.1]]) {
        c.fillStyle = col + al + ')';
        for (let i = -1; i < nf; i++) {
          const bx = mWrap(i * 46 + o.cx * par, nf * 46) - 46, h0 = (110 + 130 * H32(i, 6, 1)) * sc, f = Math.sin(t * 3 + i * 1.7 + ph0), hh = h0 * (.8 + .2 * f), w = 36 * sc, sway = Math.sin(t * 2.2 + i + ph0) * w * .45;
          c.beginPath(); c.moveTo(bx - w, H + 4); c.bezierCurveTo(bx - w, H - hh * .5, bx - w * .2 + sway, H - hh * .7, bx + sway * 1.4, H - hh); c.bezierCurveTo(bx + w * .2 + sway, H - hh * .7, bx + w, H - hh * .5, bx + w, H + 4); c.closePath(); c.fill();
        }
      }
      // brasas
      mDrift(o, 70, 82, .6, 8, -70, 20, (x, y, i, h) => { const s = 1 + h * 2.2; c.fillStyle = `rgba(255,${130 + h * 100 | 0},50,${.35 + .6 * Math.abs(Math.sin(t * 2.5 + i * 3))})`; c.fillRect(x + Math.sin(t * 1.4 + i) * 10, y, s, s); });
      c.globalCompositeOperation = 'source-over'; mVig(c, o, '5,0,0', .55);
    } },

  // ───────────── Unknown: arena preta com multidão de luzes, névoa e feixes verde-azulados, lasers vermelhos e glifos ─────────────
  { id: 'unknown', name: 'Unknown', img: 'assets/maps/unknown.webp', col: '#38e0d0',
    desc: 'Uma arena na escuridão, com milhares de luzes na plateia.', rule: 'Anomalia a cada 25s: chuva de notas, cura, aliens lentos… ou uma emboscada.',
    mod: {}, al: ['#38e0d0', '#e6fffb', '#1f8f9a', '#ff3b5c'],
    draw(c, o) {
      const W = o.W, H = o.H, t = o.t, M = Math.max(W, H);
      radial(c, o, W * .5, H * .6, 0, M * .75, [[0, '#041c1f'], [.45, '#020d10'], [1, '#010405']]);
      const fog = mFog(c, '40,190,180', .17); mDrift(o, 6, 91, .15, 8, 0, 360, (x, y, i, h) => { const w = 700 + h * 700; c.globalAlpha = .7; c.drawImage(fog, x - w / 2, y - w * .13, w, w * .26); }); c.globalAlpha = 1;
      c.globalCompositeOperation = 'lighter';
      // feixes teal vindo dos cantos
      const bm = mBeam(c, '#3ee8d6', 110, 900);
      [[.05, -.55, .16], [.95, .55, .16], [.3, -.18, .07], [.7, .18, .07]].forEach(([p, rot, a], i) => { c.save(); c.translate(W * p + o.cx * .03, -30); c.rotate(rot + Math.sin(t * .35 + i * 2) * .04); c.globalAlpha = a * (.8 + .2 * Math.sin(t * .7 + i)); c.drawImage(bm, -90, 0, 180, M * 1.25); c.restore(); });
      c.globalAlpha = 1;
      // a plateia: milhares de pontinhos de luz em perspectiva
      const hz = H * .58;
      for (let r = 0; r < 12; r++) {
        const z = (r + 1) / 12, y = hz + Math.pow(z, 1.9) * H * .5 + o.cy * .04 * z, gap = 9 + z * z * 34, sz = 1 + z * 2.6, ox = o.cx * (.06 + z * .2), n = Math.ceil(W / gap) + 2;
        for (let i = 0; i < n; i++) { const hsh = H32(i, r, 3), tw = .35 + .65 * Math.abs(Math.sin(t * (.8 + hsh * 2.2) + hsh * 40)); if (hsh < .12) continue;
          c.fillStyle = `rgba(235,255,252,${Math.min(1, tw * (.4 + z * .55))})`; c.fillRect(mWrap(i * gap + hsh * gap + ox, n * gap) - gap, y + (hsh - .5) * gap * .5, sz, sz); }
      }
      radial(c, o, W * .5, hz, 0, W * .5, [[0, 'rgba(120,255,240,.13)'], [1, 'rgba(120,255,240,0)']]);
      // lasers vermelhos
      for (const [yy, ph] of [[.4, 0], [.76, 2]]) { const y = H * yy + Math.sin(t * .3 + ph) * H * .03 + o.cy * .05;
        const gr = c.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, 'rgba(255,40,70,0)'); gr.addColorStop(.5, 'rgba(255,70,95,.9)'); gr.addColorStop(1, 'rgba(255,40,70,0)'); c.fillStyle = gr; c.fillRect(0, y - 1, W, 2.5); c.globalAlpha = .45; c.fillRect(0, y - 4, W, 8); c.globalAlpha = 1;
        c.globalAlpha = .8; mPut(c, mGlow(c, '#ff3b5c'), W * (.5 + Math.sin(t * .4 + ph) * .1), y, 46); c.globalAlpha = 1; }
      c.fillStyle = 'rgba(235,255,252,.35)'; c.fillRect(W * .5 + o.cx * .02, 0, 1, H);
      // barras de neon verticais
      for (const [xp, hh, yp] of [[.04, 170, .3], [.07, 100, .6], [.1, 140, .16], [.9, 150, .24], [.93, 110, .56], [.96, 170, .12]]) { const x = W * xp + o.cx * .15, y = H * yp, a = .5 + .4 * Math.sin(t * 1.4 + xp * 30); c.fillStyle = `rgba(110,255,240,${a})`; c.fillRect(x, y, 3, hh); c.globalAlpha = a * .5; mPut(c, mGlow(c, '#38e0d0'), x + 1.5, y + hh / 2, 26); c.globalAlpha = 1; }
      // fileira de símbolos brancos no alto (olhos, anéis, cruzes, triângulos)
      c.strokeStyle = 'rgba(235,255,252,.7)'; c.fillStyle = 'rgba(235,255,252,.7)'; c.lineWidth = 1.5;
      for (let i = 0; i < 18; i++) { const x = mWrap(i * (W + 80) / 17 + o.cx * .12 + t * 6, W + 80) - 40, y = 36 + Math.sin(i * 1.7 + t * .4) * 12 + (i % 3) * 14, k = i % 5, s = 8 + (i % 4) * 2;
        c.beginPath(); if (k === 0) { c.ellipse(x, y, s * 1.4, s * .7, 0, 0, TAU2); c.stroke(); c.beginPath(); c.arc(x, y, s * .3, 0, TAU2); c.fill(); } else if (k === 1) { c.arc(x, y, s, 0, TAU2); c.stroke(); } else if (k === 2) { c.moveTo(x - s, y); c.lineTo(x + s, y); c.moveTo(x, y - s); c.lineTo(x, y + s); c.stroke(); } else if (k === 3) { c.moveTo(x, y - s); c.lineTo(x + s, y + s * .8); c.lineTo(x - s, y + s * .8); c.closePath(); c.stroke(); } else { c.arc(x, y, s * .45, 0, TAU2); c.fill(); } }
      c.globalCompositeOperation = 'source-over'; mVig(c, o, '0,2,3', .62);
    },
    after(c, o) { const k = o.t % 13; if (k < .09) { c.fillStyle = `rgba(215,255,250,${.2 * (1 - k / .09)})`; c.fillRect(0, 0, o.W, o.H); } } }
];

// Três chefes por palco, em rotação: o 1º aparece aos 75s, o 2º 100s depois, o 3º mais 100s depois, e então volta ao 1º (mais forte).
// Desenho e ataques ficam em game.js (BOSS e bossAI), indexados pelo id do chefe. spd/r são opcionais (multiplicador de velocidade / raio).
const BOSSES = {
  clementis: [
    { id: 'clementis', name: 'Soberana Sináptica', sub: 'O cérebro que nunca dorme', col: '#ff4fa8', hint: 'Anéis de pulsos e sinapses explosivas.' },
    { id: 'clementis_b', name: 'Clematis Eterna', sub: 'A flor que floresce no silêncio', col: '#ff8fd0', hint: 'Espiral de pétalas, leque de luz e raízes que brotam.' },
    { id: 'clementis_c', name: 'Axônio Desperto', sub: 'O pensamento que não se contém', col: '#c23aa5', hint: 'Raio sináptico em linha e anéis de faíscas.' }
  ],
  blinkgone: [
    { id: 'blinkgone', name: 'Prisma Glitch', sub: 'Aqui, e então ali', col: '#2aa0ff', hint: 'Teletransporta e atira em leque.' },
    { id: 'blinkgone_b', name: 'Varredura Zero', sub: 'Nada escapa da grade', col: '#18e0ff', hint: 'Parede de dados com brecha e grade que fecha.', spd: .8 },
    { id: 'blinkgone_c', name: 'Sinal Fantasma', sub: 'O eco que responde primeiro', col: '#ff2e88', hint: 'Tiros RGB, investida com rastro e ecos.', spd: 1.1 }
  ],
  blacksorrow: [
    { id: 'blacksorrow', name: 'Lágrima Eterna', sub: 'A maré que engole o palco', col: '#c9ced6', hint: 'Puxa você e solta bolhas de prata.' },
    { id: 'blacksorrow_b', name: 'Anel do Lamento', sub: 'O vazio tem forma de coroa', col: '#e9edf5', hint: 'Anéis de prata com uma brecha e bolhas que estouram.' },
    { id: 'blacksorrow_c', name: 'Gota Primordial', sub: 'Toda tristeza começa com uma', col: '#9fb4d6', hint: 'Salta sobre você e faz chover gotas.', spd: .9 }
  ],
  ruler: [
    { id: 'ruler', name: 'Imperatriz Lunar', sub: 'Dona de cada batida', col: '#e8dcc0', hint: 'Espirais de fitas e investidas.' },
    { id: 'ruler_b', name: 'Coração de Osso', sub: 'O pulso que governa o palco', col: '#ffd9a0', hint: 'Batimento duplo em ondas e fitas giratórias.', spd: .8 },
    { id: 'ruler_c', name: 'Ceifadora Crescente', sub: 'A noite corta em arco', col: '#fff2d1', hint: 'Foices em órbita, arcos de luz e eclipses.' }
  ],
  cure: [
    { id: 'cure', name: 'Nave-Mãe', sub: 'A luz que escolhe quem fica', col: '#6fe0f0', hint: 'Pilares de luz e discos voadores.' },
    { id: 'cure_b', name: 'Farol da Névoa', sub: 'Ele sempre sabe onde você está', col: '#d5f6ff', hint: 'Feixe giratório que varre o palco e pilares de luz.', spd: .6 },
    { id: 'cure_c', name: 'Serafim Cinzento', sub: 'Cada pena é uma sentença', col: '#9ab3c2', hint: 'Chuva de penas e halo que se fecha.', spd: .9 }
  ],
  karma: [
    { id: 'karma', name: 'Roda do Retorno', sub: 'Tudo o que se lança volta', col: '#ff4757', hint: 'Anéis de espinhos que vão e voltam, e zonas de retribuição.' },
    { id: 'karma_b', name: 'Tecelã de Fios', sub: 'O destino tem pontas soltas', col: '#ff8a9a', hint: 'Leque de agulhas, fio de fogo em linha e nós explosivos.' },
    { id: 'karma_c', name: 'Juiz Carmesim', sub: 'A sentença já foi escrita', col: '#ffc15a', hint: 'Pilares de sentença, tiros certeiros e onda de veredito.', spd: .85 }
  ],
  unknown: [
    { id: 'unknown', name: 'Olho do Vazio', sub: 'Ele já sabia que você viria', col: '#38e0d0', hint: 'Leque de olhares, zonas sob seus pés e vigias que surgem.' },
    { id: 'unknown_b', name: 'Glifo Errante', sub: '? ? ?', col: '#ff3b5c', hint: 'Espiral de fragmentos, leque e pontos de interrogação vivos.', spd: 1.1 },
    { id: 'unknown_c', name: 'Estática', sub: 'Sinal sem origem', col: '#e6fffb', hint: 'Explosão de ruído, grade instável e anéis de estática.', spd: .9 }
  ]
};
MAPS.forEach(m => { m.bosses = BOSSES[m.id]; m.boss = m.bosses[0]; });
