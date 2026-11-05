// Sinergias: 5 duplas (valem para os DOIS personagens). Ao escolher a carta de sinergia no level-up,
// a ARMA passiva e a ULTIMATE do personagem viram as versões combinadas, e o parceiro aparece na tela.
// Cada sinergia é descoberta uma vez (vale para os dois lados) e fica salva no banco.
const RARITY = {
  r: { n: 'RARA', col: '#3ef0ff', w: 1 },
  e: { n: 'ÉPICA', col: '#c07bff', w: .6 },
  l: { n: 'LENDÁRIA', col: '#ffd23f', w: .3 }
};
// id, personagem A, personagem B, nome, tema, arma combinada, ultimate combinada, raridade, visível-desde-o-início
const COMBO_TABLE = [
  ['hyuna_luka', 'hyuna', 'luka', 'Passado Cruzado', 'Redenção e Culpa',
    { n: 'Única Fraqueza', d: 'Os tiros viram feixes de notas agudas e cortantes: perfuram os inimigos e os deixam lentos.' },
    { n: 'Vontade de Viver', d: 'Os dois se unem no centro: escudo maciço e uma onda roxa contínua que drena a vida dos inimigos e a devolve a você.', cd: 50 }, 'e', 0],
  ['mizi_sua', 'mizi', 'sua', 'Promessa de Clematis', 'Amor e Tragédia',
    { n: 'Flores de Anêmona', d: 'Pétalas e rajadas sônicas giram ao seu redor, cortando quem chega perto e envenenando as hordas.' },
    { n: 'My Clematis', d: 'O palco pega fogo e anêmonas florescem no chão. Um feixe de luz em cruz congela e elimina os comuns e arrasa chefes.', cd: 55 }, 'l', 1],
  ['till_ivan', 'till', 'ivan', 'Eco de Conexão', 'Fúria e Abnegação',
    { n: 'Acordes Rubros', d: 'Ondas de guitarra e lâminas de microfone deixam um rastro de tinta vermelha que desacelera e queima quem pisa.' },
    { n: 'O Beijo Final', d: 'Ivan surge ao lado de Till e o tempo congela por 3s. Uma cruz carmesim corta a tela e oblitera tudo, ao custo de parte da sua vida.', cd: 60 }, 'e', 0],
  ['hyuna_mizi', 'hyuna', 'mizi', 'Aliança da Rebelião', 'Esperança e Sobrevivência',
    { n: 'Fogo Cruzado Estelar', d: 'Fuzil, granadas de fumaça e feixes de luz estelar cobrem uma área ampla à sua frente.' },
    { n: 'Fuga de Emergência', d: 'Um hovercraft da rebelião cruza a tela, atropelando e empurrando as hordas para as bordas, deixando chamas e velocidade extra.', cd: 50 }, 'r', 0],
  ['till_luka', 'till', 'luka', 'Duelo Final', 'O Confronto dos Rivais',
    { n: 'Sinfonia Caótica', d: 'Notas de violino e acordes distorcidos ricocheteiam entre os inimigos, ganhando dano crítico a cada acerto.' },
    { n: 'Clímax da 7ª Rodada', d: 'Holofotes e contagem regressiva: frenesi total com ataque 4× mais rápido e ondas de choque a cada abate.', cd: 55 }, 'e', 0]
];
const COMBOS = {};
COMBO_TABLE.forEach(([id, a, b, name, theme, w, u, rar, vis]) => { COMBOS[id] = { id, a, b, name, theme, w, u, rar, hid: !vis }; });
const COMBO_IDS = Object.keys(COMBOS);
const comboPartner = (c, mainId) => c.a === mainId ? c.b : c.a;
const comboFor = mainId => COMBO_IDS.map(id => COMBOS[id]).filter(c => c.a === mainId || c.b === mainId);
const cutSrc = id => `assets/combo/${id}.webp?v=11`;   // ?v= evita usar o recorte antigo em cache
