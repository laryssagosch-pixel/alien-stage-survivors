// Cartas de Tarô: cada personagem tem a sua. Desbloqueie jogando (meta salva no banco) e, dentro da partida,
// suba a carta pelos níveis 1 (passiva) → 2 (habilidade ativa) → 3 (evolução final) nas cartas de level-up.
// goal = quanto é preciso acumular (entre partidas) para desbloquear; lv = nível do personagem mínimo para oferecer o nível da carta.
const TAROT = {
  hyuna: { n: 'A Força', num: 'VIII', goal: 6, unit: 'elites e chefes', hint: 'Derrote 6 elites ou chefes jogando de Hyuna.',
    t: [{ n: 'Coragem Inabalável', k: 'Passiva', lv: 2, d: 'A cada inimigo derrotado em sequência, ganha armadura e velocidade temporárias (até 10 acúmulos). Levar dano zera a sequência.' },
        { n: 'Chama Protetora', k: 'Ativa', lv: 4, d: 'Periodicamente solta uma onda de choque circular que empurra os inimigos e regenera sua vida por 3s.' },
        { n: 'O Sacrifício da Líder', k: 'Evolução final', lv: 8, d: 'Quando a vida chega a 1%, fica invulnerável por 4s com dano ×3 e limpa a tela ao expirar.' }] },
  sua: { n: 'A Alta Sacerdotisa', num: 'II', goal: 8, unit: 'pontos', hint: 'Colete 8 pétalas de cura (dropam de elites) ou sobreviva com vida baixa: cada 10s abaixo de 25% de vida vale 1 ponto.',
    t: [{ n: 'Véu de Segredos', k: 'Passiva', lv: 2, d: 'Aumenta a chance de esquiva. Inimigos que chegam muito perto sofrem um leve congelamento.' },
        { n: 'Anêmonas Ocultas', k: 'Ativa', lv: 4, d: 'Invoca pétalas defensivas ao seu redor que bloqueiam projéteis inimigos e ferem quem encosta.' },
        { n: 'Compreensão Silenciosa', k: 'Evolução final', lv: 8, d: 'Pausa os inimigos comuns por 2s enquanto recupera 30% da vida máxima e dispara pétalas cortantes em leque.' }] },
  ivan: { n: 'O Enforcado', num: 'XII', goal: 6, unit: 'pontos', hint: 'Sacrifique vida de propósito (O Beijo da Despedida, Abnegação, Beijo Final) ou aguente com menos de 20% de vida: cada 10s vale 1 ponto.',
    t: [{ n: 'Perspectiva Invertida', k: 'Passiva', lv: 2, d: 'Quanto menor a sua vida, maiores a taxa de crítico e a velocidade de ataque.' },
        { n: 'Abnegação Sombria', k: 'Ativa', lv: 4, d: 'Drena uma pequena parte da própria vida para desenhar uma cruz de energia vermelha no chão que incendeia as hordas.' },
        { n: 'O Beijo Redentor', k: 'Evolução final', lv: 8, d: 'Ataque em cruz de tela inteira que consome a vida excedente: paralisa chefes, elimina lacaios e cura por abate.' }] },
  luka: { n: 'O Diabo', num: 'XV', goal: 30, unit: 'inimigos', hint: 'Derrote 30 inimigos usando efeitos de confusão ou manipulação (Manipulação Psicológica, charme).',
    t: [{ n: 'Correntes da Manipulação', k: 'Passiva', lv: 2, d: 'Seus ataques têm chance de enfeitiçar: o inimigo luta ao seu lado por alguns segundos e depois explode.' },
        { n: 'Frequência Cardíaca', k: 'Ativa', lv: 4, d: 'Acelera o ritmo por 4s: coleta de itens máxima e dano dobrado.' },
        { n: 'A Ilusão do Artista Perfeito', k: 'Evolução final', lv: 8, d: 'Invoca clones que disparam ondas de notas roxas em todas as direções, ignorando a armadura.' }] },
  till: { n: 'O Louco', num: '0', goal: 40, unit: 'mil passos', hint: 'Explore o palco: percorra 40.000 passos jogando de Till.',
    t: [{ n: 'Salto de Fé', k: 'Passiva', lv: 2, d: 'O dano dos ataques básicos muda aleatoriamente a cada 20s: picos de fraqueza e crítico devastador.' },
        { n: 'Acordes Caóticos', k: 'Ativa', lv: 4, d: 'Lança rajadas de tinta vermelha e notas em direções aleatórias, causando dano em área de respingos.' },
        { n: 'Fúria Indisciplinada', k: 'Evolução final', lv: 8, d: 'Colapso artístico: quebra a mordaça e dispara uma onda sônica contínua de 360° que empurra e incinera tudo.' }] },
  mizi: { n: 'A Estrela', num: 'XVII', goal: 300, unit: 'gemas', hint: 'Colete 300 gemas de experiência jogando de Mizi.',
    t: [{ n: 'Brilho de Esperança', k: 'Passiva', lv: 2, d: 'Aumenta o alcance de coleta de experiência e regenera um pouco de vida a cada 5 gemas.' },
        { n: 'Chuva Estelar', k: 'Ativa', lv: 4, d: 'Feixes de luz colorida caem sobre onde há mais inimigos, causando dano e lentidão.' },
        { n: 'Abençoada pelo Palco', k: 'Evolução final', lv: 8, d: 'Explosão de luz em forma de estrela que limpa os projéteis inimigos e dá imunidade a dano por 3s.' }] }
};
const TAROT_IDS = Object.keys(TAROT);
const tarotSrc = id => `assets/tarot/${id}.webp?v=11`;
