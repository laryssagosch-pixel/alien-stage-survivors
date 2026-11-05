// Personagens, skins, armas, habilidades e telas de morte. Edite aqui para ajustar nomes e balanço.
// hp/spd/dm/cdm = multiplicadores | col/acc = cor principal e de destaque (vêm das fichas)
// weapon/wid = arma básica (o comportamento de cada wid fica em WEAPONS no game.js)
// sp = habilidade ESPECIAL (tecla E/Q) | sk = ULTIMATE (tecla ESPAÇO/R) | death = tela de morte própria
// As sinergias ficam em combos.js e as cartas de tarô em tarot.js.
// poly = área clicável do personagem na imagem de seleção (pixels da imagem 735x717)
const CHARS = [
  { id: 'sua', name: 'Sua', weapon: 'Notas de Clematis', wid: 'petal', blurb: 'Pétalas sônicas de clematis e anêmona que ricocheteiam entre os monstros.',
    hp: 0.95, spd: 1.05, dm: 1, cdm: 1, col: '#9fe3ff', acc: '#c9b8ff',
    skins: ['Headspace', 'Real World', 'Ghost', 'Anakt Garden', 'Pré-Anakt Garden'],
    poly: [[368,359],[301,426],[287,501],[260,587],[257,611],[248,633],[250,629],[259,629],[292,646],[322,655],[352,670],[368,689],[382,699],[409,677],[440,644],[463,628],[495,569],[475,492],[474,477],[468,476],[467,470],[444,444],[429,414],[400,378],[400,370]],
    sp: { n: 'Vingança Evasiva', d: 'Barreira translúcida de vidro: repele quem chega perto e o congela pelo frio e pela dor.', cd: 11 },
    sk: { n: 'Canto Compartilhado', d: 'Ilusão de palco: todos os inimigos param de atacar e sofrem angústia contínua enquanto você recupera vida.', cd: 48 },
    death: { title: 'SILÊNCIO', line: 'A voz se dissolveu no vazio do palco.', c1: '#9fe3ff', fx: 'fade', mode: 'rise', g: '♪', pose: 'rise' } },
  { id: 'mizi', name: 'Mizi', weapon: 'Brilho de Estrela', wid: 'stars', blurb: 'Leque de luzes coloridas que lembram fogos de artifício e holofotes de palco.',
    hp: 1, spd: 1.05, dm: 1, cdm: 1, col: '#ff5fb0', acc: '#6ec8ff',
    skins: ['Headspace', 'Round 1', 'Real World', 'Rebel', 'Anakt Garden'],
    poly: [[554,0],[525,0],[524,5],[498,10],[447,30],[400,31],[366,39],[315,64],[286,69],[273,85],[271,94],[260,111],[260,134],[255,136],[257,146],[262,146],[265,154],[264,188],[306,277],[328,308],[334,331],[359,343],[360,347],[378,352],[379,362],[389,367],[401,369],[404,349],[419,334],[441,319],[528,185],[572,126],[585,114],[580,113],[580,86],[576,71],[577,32],[554,4]],
    sp: { n: 'Lágrimas de Esperança', d: 'Chuva de energia celestial desacelera todos os inimigos da tela e cura um pouco da sua vida.', cd: 13 },
    sk: { n: 'A Ira da Bruxa', d: 'Feixe massivo de luz e chamas varre a tela num círculo completo, incinerando hordas e ferindo chefes.', cd: 50 },
    death: { title: 'CORTADA', line: 'A última nota foi cortada ao meio.', c1: '#ff5fb0', fx: 'split', mode: 'slash', g: '', pose: 'fall' } },
  { id: 'till', name: 'Till', weapon: 'Guitarra Holográfica', wid: 'chord', blurb: 'Ondas de choque pesadas e caóticas, em forma de acordes, que empurram tudo para longe.',
    hp: 1, spd: 1.1, dm: 1, cdm: 1, col: '#ff4d4d', acc: '#e6e8f5',
    skins: ['Headspace', 'Round 3', 'Round 6', 'Round 7', 'Anakt Garden', 'Real World'],
    poly: [[361,356],[345,350],[328,351],[326,345],[251,349],[124,378],[84,398],[99,400],[100,409],[63,421],[62,430],[50,442],[34,489],[10,511],[23,536],[25,549],[61,607],[149,647],[175,647],[214,662],[225,657],[247,634],[256,611],[259,587],[286,501],[300,426],[326,397],[361,368]],
    sp: { n: 'Fúria Indisciplinada', d: 'Adrenalina pura: ataque muito mais rápido e dano crítico maior, mas a defesa cai.', cd: 14 },
    sk: { n: 'Transfusão Caótica', d: 'Zona de fogo e tinta vermelha que consome inimigos; cada abate dentro dela deixa Till mais forte e resistente.', cd: 50 },
    death: { title: 'SEM SINAL', line: 'A transmissão caiu. Tela preta.', c1: '#ff4d4d', fx: 'glitch', mode: 'glitch', g: '', pose: 'shrink' } },
  { id: 'luka', name: 'Luka', weapon: 'Violino de Cristal', wid: 'violin', blurb: 'Notas agudas e cortantes que perfuram fileiras inteiras em linha reta.',
    hp: 0.9, spd: 1, dm: 1.05, cdm: 1, col: '#b57bff', acc: '#ffe066',
    skins: ['Headspace (AG)', 'Round 3', 'Round 7', 'Anakt Garden', 'Headspace Round 5'],
    poly: [[687,78],[659,83],[642,80],[642,84],[627,98],[615,97],[600,110],[586,114],[573,126],[488,245],[442,319],[405,349],[402,369],[427,380],[480,371],[495,371],[515,379],[670,374],[700,358],[708,346],[712,330],[711,289],[716,262],[713,198],[705,128],[692,106],[692,83]],
    sp: { n: 'Manipulação Psicológica', d: 'Alucinações confundem os monstros: eles passam a atacar uns aos outros.', cd: 12 },
    sk: { n: 'Síndrome de Luka', d: 'Modo frenético: coração acelerado, velocidade extrema e projéteis roxos teleguiados que ignoram armadura.', cd: 45 },
    death: { title: 'ESTRELA CADENTE', line: 'A luz mais bonita do palco se apagou.', c1: '#b57bff', fx: 'star', mode: 'fall', g: '★', pose: 'fall' } },
  { id: 'ivan', name: 'Ivan', weapon: 'Lâmina Sombria', wid: 'blade', blurb: 'Golpes circulares de curto alcance com microfone e adagas. Sorri até o fim.',
    hp: 1.1, spd: 1, dm: 1.1, cdm: 1, col: '#ff3b5c', acc: '#2fd0c0',
    skins: ['Headspace', 'Round 3', 'Round 6', 'Anakt Garden', 'Pré-Anakt Garden'],
    poly: [[216,39],[199,41],[188,50],[187,55],[178,55],[177,51],[166,54],[109,128],[96,158],[83,171],[72,174],[62,182],[31,217],[0,235],[0,293],[4,293],[16,304],[32,328],[60,383],[65,384],[74,396],[83,398],[124,377],[236,351],[327,344],[327,338],[317,322],[304,286],[305,275],[287,245],[264,196],[263,187],[259,186],[251,160],[251,149],[256,146],[255,137],[237,100]],
    sp: { n: 'Sorriso Fatalista', d: 'Escudo de invulnerabilidade por alguns segundos; ao expirar explode em espinhos de energia vermelha.', cd: 13 },
    sk: { n: 'O Beijo da Despedida', d: 'Sacrifica 50% da vida atual, congela o tempo por 4s e rasga a tela em cruz, eliminando elites menores.', cd: 55 },
    death: { title: 'ESTILHAÇADO', line: 'Nem os cacos ficaram de pé.', c1: '#ff3b5c', fx: 'shatter', mode: 'fall', g: '◆', pose: 'fall' } },
  { id: 'hyuna', name: 'Hyuna', weapon: 'Pistola da Rebelião', wid: 'pistol', blurb: 'Líder da rebelião. Tiros rápidos e diretos, pura sobrevivência.',
    hp: 1.15, spd: 1, dm: 1, cdm: 1, col: '#4d86ff', acc: '#ffd23f',
    skins: ['Headspace (AG)', 'ALNST S49', 'Real World', 'Anakt Garden', 'Real World (Presente)'],
    poly: [[701,386],[687,381],[675,382],[674,374],[517,380],[522,383],[521,392],[481,399],[481,449],[474,476],[494,561],[494,574],[486,590],[515,614],[518,624],[531,638],[549,643],[560,652],[597,650],[663,669],[679,665],[701,648],[713,643],[714,631],[718,626],[718,593],[710,515],[709,420],[705,414],[705,394]],
    sp: { n: 'Liderança Protetora', d: 'Lança granadas de fumaça e fomento: atordoam quem está perto e criam uma aura que regenera sua vida.', cd: 12 },
    sk: { n: 'Sacrifício Final', d: 'Absorve dano por 4s e então explode numa onda de choque que limpa a tela e dá bônus de velocidade e ataque.', cd: 45 },
    death: { title: 'IMPACTO', line: 'O cometa colidiu. O céu ficou em silêncio.', c1: '#4d86ff', fx: 'crash', mode: 'ring', g: '', pose: 'spin' } }
];
const spr = (c, k) => `assets/chars/${c.id}/${k}.png`;
const portrait = c => c.id === 'till' ? spr(c, 0) : `assets/chars/${c.id}/portrait.png`;
const loadImg = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(i); i.src = src; });
