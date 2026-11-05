# Alien Stage: Survivors

Jogo estilo Vampire Survivors com tema Alien Stage (fã-jogo sem fins lucrativos).

## Estrutura
- `index.html` – telas (login, menu, level up, game over)
- `css/style.css` – visual
- `js/chars.js` – personagens, skins, armas, habilidades, passivas, telas de morte e áreas clicáveis da imagem de seleção
- `js/fx.js` – transição de estrelas entre telas, animação de clique do mouse e céu estrelado dos menus
- `js/maps.js` – os 5 palcos (fundo desenhado no canvas, cores dos aliens e regra especial de cada um)
- `assets/maps/` – imagens dos palcos; `assets/ui/select.png` – imagem da seleção de personagens
- `assets/chars/` – sprites recortados das folhas de personagem; `assets/ui/` – arte do menu
- `tools/extract_sprites.py` – recorta os sprites das folhas (só se quiser regenerar)
- `js/api.js` – chamadas ao PHP e modo convidado (localStorage)
- `js/game.js` – motor do jogo (canvas)
- `js/ui.js` – menus, loja de upgrades, ranking
- `php/config.php` e `php/api.php` – backend (login, cadastro, salvar progresso, ranking)
- `database/schema.sql` – tabelas SQLite
- `python/init_db.py` – cria/reseta o banco

## Como rodar
O jeito mais fácil: `python run.py` (cria o banco, inicia o servidor e abre o navegador).

Manualmente:
1. Requisitos: PHP 8+ com extensão `pdo_sqlite` e Python 3 (opcional).
2. (Opcional) `python python/init_db.py` – o PHP também cria o banco sozinho.
3. Na pasta do projeto: `php -S localhost:8000`
4. Abra http://localhost:8000

## Controles
WASD ou setas (no celular, arraste o dedo). O ataque é automático. **ESPAÇO ou E** usa a habilidade do personagem (no celular, botão ★).

## Jogabilidade
- Colete notas ♪ para subir de nível e escolher melodias (armas).
- 6 personagens (Sua, Mizi, Till, Luka, Ivan, Hyuna), cada um com arma e efeito próprios, e 5-6 skins selecionáveis.
- A cada 90s aparece o Soberano Alien, um chefe gigante.
- Esc ou P pausa o jogo.
- Notas ganhas ao ser eliminado compram upgrades permanentes no menu.
- Conta: progresso no banco SQLite. Convidado: salvo no navegador.

## Palcos (menu → Palcos)
- **My Clementis** – cérebro de luz rosa: Ímã de Notas já começa no nível 1.
- **Blink Gone** – túnel neon: +25% de XP, mas aliens 12% mais rápidos.
- **Black Sorrow** – anel de prata: bolhas surgem e dão escudo contra 1 golpe.
- **Ruler of My Heart** – lua gigante: +12 de vida a cada nível.
- **Cure** – plataformas na névoa: pilares de luz caem sobre os aliens, que têm +15% de vida.
- **Karma** – roda do destino em vermelho e ouro: ao sofrer dano, uma onda de *retribuição* devolve golpes aos aliens por perto (eles têm +10% de vida).
- **Unknown** – vazio violeta com constelações e um olho no céu: a cada 25s ocorre uma *anomalia* aleatória (chuva de notas, cura de 18%, aliens lentos por 6s ou uma emboscada).

## Habilidades (ESPAÇO)
Sua – Eco Fantasma | Mizi – Tempestade Rosa | Till – Dash Relâmpago | Luka – Chuva de Estrelas | Ivan – Domo de Cacos | Hyuna – Colapso Cometa. Cada um também tem uma passiva e uma tela de morte própria.

## Observação
O progresso é enviado pelo navegador, então não há proteção anti-trapaça (o servidor só limita valores).


## Novidades v3
- Transição de estrela giratória entre todas as telas e animação de clique (ondas + faíscas).
- Seleção de personagem em tela quase cheia, com inclinação 3D, brilho, contorno animado e explosão de estrelas ao escolher.
- Seleção de palco com o próprio palco animado ao fundo e cards que se expandem.
- Cada palco tem uma espécie de alien diferente (água-viva, cristal neon, orbe de prata, mariposa-lua, disco voador).
- Habilidades e tiros redesenhados, com brilho, rastros, flash de tela e nome da habilidade ao usar.

## v4
- Seleção de personagem refeita com a imagem nova em alta qualidade (735x717), sem fundo preto. Cada caco é uma camada recortada: brilha ao passar o mouse e sobe com brilho colorido ao ser escolhido. Painel de informações em vidro com a cor do personagem. Para trocar quem é quem, edite `poly` em `js/chars.js`.


## Otimizações v4.1
- Busca de alvos mais leve, evitando objetos temporários durante a procura e ignorando inimigos derrotados.
- Seleção aleatória de habilidades e alvos com embaralhamento Fisher–Yates.
- Requisições da API configuradas para não usar cache e enviar cookies de sessão explicitamente.
- Sessões PHP com cookies `HttpOnly`/`SameSite` e renovação do identificador após login/cadastro.
- Respostas JSON com suporte a Unicode e cabeçalho para evitar cache de dados da API.

## v5 — Sinergias, chefes e HUD novo

**Sinergias (poderes combinados)** — ao subir de nível (a partir do nv 3) pode aparecer uma 4ª carta rara de *Sinergia*. Escolhê-la troca a sua ultimate por uma versão combinada com o poder de outro personagem, e o parceiro aparece por um instante na tela (recorte da imagem `assets/combo/*.png`) toda vez que a ultimate é usada. São 30 sinergias (cada personagem × 5 parceiros), com raridade rara/épica/lendária (quanto mais rara, mais forte o efeito do parceiro). O parceiro também empresta parte da sua passiva.
- Só 6 sinergias são visíveis desde o início; as outras 24 ficam **escondidas** (cartas com `???` e silhueta) até você escolhê-las e descobri-las.
- Menu → **Sinergias**: tela só disso, com abas por personagem, silhuetas para as escondidas, nome/efeito/uso das descobertas.
- As cartas de sinergia ainda não descobertas têm um pouco mais de chance de aparecer. Atalhos: teclas `1`–`4` escolhem a carta no level-up.

**Chefes** — cada palco tem um chefe próprio, com desenho e ataques diferentes (primeiro aos 75s, depois a cada 100s, mais fortes a cada vez):
My Clementis → *Soberana Sináptica* · Blink Gone → *Prisma Glitch* · Black Sorrow → *Lágrima Eterna* · Ruler of My Heart → *Imperatriz Lunar* · Cure → *Nave-Mãe*.
Derrotar um chefe cura 30% da vida, dá bônus de notas e é registrado.

**Inimigos mais fortes** — mais vida/dano e crescimento mais rápido, novo tipo *atirador* (dispara orbes), inimigos **elite** (anel dourado, 2,6× vida, mais XP) a partir de 1m40.

**HUD** — retrato com nível, barra de vida e XP em painéis chanfrados, cronômetro entre colchetes, barra de chefe, painel da ultimate/sinergia ativa, chips de armas.

**Banco de dados** — novas tabelas `combos` (sinergias descobertas + usos) e `boss_kills` (chefes derrotados por palco). Criadas automaticamente na próxima requisição (`CREATE TABLE IF NOT EXISTS`), então bancos antigos continuam funcionando. Descobertas e chefes são salvos **na hora**; os usos são somados ao fim da partida. No modo convidado tudo fica no `localStorage`.

## v8 — Áudio e imagens de palco corrigidas (incorporado do pacote "mapas-corrigidos")
- **Áudio** (`assets/audio/`): música de menu (`fundo.mp3`), uma trilha por palco (`clementis`, `blink gone`, `black sorrow`, `cure`, `ruler`), som de clique, som ao apertar botões e som ao escolher uma carta de level-up (vale para as sinergias também). A música muda sozinha ao trocar de palco, pausa junto com o jogo e só começa depois do primeiro clique (regra dos navegadores). **Tecla `M`** liga/desliga o som. Os caminhos são relativos ao `index.html`, então o jogo precisa ser servido por HTTP (`python run.py` ou `php -S`).
- **Imagens dos palcos**: caminhos normalizados (`./assets/maps/...`) e, se uma imagem falhar, o cartão do palco usa um degradê na cor do palco em vez de ficar vazio.
- `prefers-reduced-motion`: animações reduzidas para quem pede isso ao sistema.
- Mantidas as otimizações v4.1 (busca de alvo leve, embaralhamento Fisher–Yates, sessão PHP endurecida), que o pacote novo não tinha.

## v9 — Recortes novos e efeito de brilho das sinergias
- **Recorte refeito** (`assets/combo/*.png`): o fundo branco foi removido com *alpha matting* (closed-form) + estimativa de cor de frente, em vez de máscara dura. Resultado: cabelo e bordas suaves sem franja branca, sem respingos dos cabos de microfone/guitarra, 2× de resolução com nitidez.
- **Aparição estilo "benção combinada" (Hades 2)**: o parceiro surge num clarão com halo de luz e feixes verticais, pulsa por um instante e então **some devagar enquanto brilha mais** (bloom crescente, sobe levemente e solta faíscas de luz). Duração ~1,9s ao usar a ultimate e ~2,9s na descoberta de uma sinergia nova.

## v10 — Kits das fichas, sinergias e cartas de tarô
Tudo baseado nas fichas enviadas (personalidade → efeito, cor e formato de cada poder).

**Cada personagem agora tem 3 poderes**: *arma básica* (automática), *habilidade especial* (tecla **E** ou **Q**, botão ✦ no celular) e *ultimate* (tecla **ESPAÇO** ou **R**, botão ★).
| Personagem | Arma | Especial | Ultimate |
|---|---|---|---|
| Hyuna | Pistola da Rebelião | Liderança Protetora (granadas de fumaça e fomento) | Sacrifício Final (absorve dano → onda de choque) |
| Sua | Notas de Clematis (pétalas que ricocheteiam) | Vingança Evasiva (barreira de vidro) | Canto Compartilhado (ilusão de palco) |
| Ivan | Lâmina Sombria (golpes circulares) | Sorriso Fatalista (escudo → espinhos) | O Beijo da Despedida (tempo congelado + cruz) |
| Luka | Violino de Cristal (ondas que perfuram) | Manipulação Psicológica (inimigos brigam entre si) | Síndrome de Luka (frenesi, bolas roxas teleguiadas) |
| Till | Guitarra Holográfica (acordes que empurram) | Fúria Indisciplinada (adrenalina e crítico) | Transfusão Caótica (zona de tinta/fogo que fortalece) |
| Mizi | Brilho de Estrela (leque de fogos de artifício) | Lágrimas de Esperança (chuva que desacelera e cura) | A Ira da Bruxa (feixe que varre 360°) |
Novos status nos inimigos: atordoar, congelar, veneno, queimadura, confusão e charme; armadura (tanques/elites/chefes) e dano crítico.

**Sinergias (5 duplas, valem para os dois lados)**: Hyuna & Luka *Passado Cruzado*, Mizi & Sua *Promessa de Clematis*, Till & Ivan *Eco de Conexão*, Hyuna & Mizi *Aliança da Rebelião*, Till & Luka *Duelo Final*. Escolher a carta de sinergia troca a **arma** e a **ultimate** pelas versões combinadas, e o parceiro aparece na tela (recortes em `assets/combo/`, agora com os nomes corretos). A maioria começa escondida.

**Cartas de tarô** (`assets/tarot/`, `js/tarot.js`): uma por personagem (Força, Alta Sacerdotisa, Enforcado, Diabo, Louco, Estrela). Desbloqueie jogando com o personagem (progresso é acumulado entre partidas e salvo) e, dentro da partida, suba a carta pelas cartas de level-up: nível 1 passiva → nível 2 ativa (dispara sozinha) → nível 3 evolução final. Veja a tela **Cartas de Tarô** no menu.

**Banco**: nova tabela `tarot` (progresso, desbloqueada, maior nível); `combos` passa a guardar as 5 duplas (ids antigos de versões anteriores são ignorados).
**Correção**: os recortes da imagem de personagens estavam com o nome trocado (a ordem real é Mizi, Sua, Luka / Hyuna, Ivan, Till); refeitos conforme as fichas.
**Desempenho**: o jogo limita projéteis/partículas e desliga o brilho dos tiros quando há muitos na tela.

## v11 — Otimização
Medido num cenário pesado (Hyuna, ~150 inimigos na tela + habilidade ativa, renderização por *software*, o pior caso): **30 → 40 FPS** só com as otimizações de desenho e **~57 FPS** com a escala adaptativa.
- **Desenho**: inimigos/tiros/partículas/gemas fora da tela não são mais desenhados; gemas num único traçado; o brilho (`shadowBlur`, que é caro) só vai para os 36 primeiros inimigos por frame; textos de partículas limitados; canvas opaco (`alpha:false`).
- **Qualidade adaptativa**: se o FPS cair abaixo de ~38, a resolução de render desce sozinha (até 55%) e os brilhos são reduzidos; quando sobra folga ela sobe de volta. Aperte **F3** para ver o FPS e a % de render.
- **Menu**: o brilho das estrelas de fundo usa sprites pré-renderizados em vez de `shadowBlur` por frame.
- **Download**: de ~44 MB para ~23 MB (áudio 35 → 21 MB). Áudio: as 5 trilhas de palco eram **vídeos MP4 renomeados para .mp3** (áudio AAC + vídeo h264); extraí só o áudio (cópia direta, sem perda) para `.m4a` — `blink gone` foi de 14,5 MB para 3,2 MB. Imagens grandes (tarô, recortes, palcos, telas) foram para **WebP** (5,9 MB → 0,9 MB). As músicas dos palcos só baixam quando o palco é usado.
- **Servidor (`run.py` sem PHP)**: multi-thread e HTTP/1.1, cache de 1h para imagens/áudio (código sempre revalida), gzip nos textos (~4x menores) e suporte a `Range` para o áudio. Antes mandava `no-store`, rebaixando tudo a cada recarga. Sprites dos personagens continuam em PNG.

## v12 — Mira no cursor, 10 chefes novos e correções
- **Mira com o mouse**: o personagem atira para onde está o cursor (aparece uma mira no jogo). O ataque continua automático e ocorre quando há inimigos; o golpe circular do Ivan dispara com inimigo perto e a adaga dele vai para o cursor. No celular (toque) continua mirando no inimigo mais próximo. Arrastar o mouse não move mais o personagem (só o toque); o brilho/ondas do cursor ficam desligados durante a partida.
- **Seleção de personagem corrigida**: o caco sob o cursor agora é calculado por geometria (ponto dentro do polígono) sobre uma área parada. Antes o hover aumentava o recorte e a imagem inclinava em 3D, então o alvo mudava sozinho perto das bordas. A inclinação 3D continua, mas só visual. Trocar de skin não recria mais os botões.
- **Cartas de tarô corrigidas**: clicar numa carta recriava toda a grade (as cartas "entravam" de novo animando sob o cursor). Agora a grade é criada uma vez, clicar só troca a seleção, e o efeito de subir é só no desenho — a caixa clicável nunca se move.
- **Nova partida sempre do zero**: a partida anterior é descartada ao iniciar, as teclas presas são limpas, e a **música do palco volta ao início** (retomar do pause continua de onde parou). Se você sair para o menu enquanto a partida ainda carrega, ela não inicia sozinha.
- **10 chefes novos (3 por palco, em rotação: 75s → +100s → +100s → volta ao 1º, cada vez mais forte)**:
  - My Clementis: *Clematis Eterna* (flor; espiral de pétalas, leque, raízes) e *Axônio Desperto* (neurônio; raio sináptico em linha, anéis).
  - Blink Gone: *Varredura Zero* (monólito; parede de dados com brecha, grade que fecha) e *Sinal Fantasma* (triângulos RGB; investida com rastro, ecos).
  - Black Sorrow: *Anel do Lamento* (anéis de prata com brecha, bolhas que estouram) e *Gota Primordial* (lágrima que salta sobre você e faz chover gotas).
  - Ruler of My Heart: *Coração de Osso* (batimento duplo, fitas giratórias) e *Ceifadora Crescente* (foices em órbita, arcos de luz, eclipses).
  - Cure: *Farol da Névoa* (feixe giratório visível, pilares de luz) e *Serafim Cinzento* (chuva de penas, halo que se fecha).
  O cartão do palco lista os 3 chefes. Os dados ficam em `BOSSES` (`js/maps.js`), a IA em `bossAI` e o desenho em `BOSS` (`js/game.js`).
- **Otimização (sem mudar o jogo)**: `Math.hypot` (lento) trocado por raiz direta em todo o motor; gradientes de tela cheia dos palcos e a lua do Ruler (que redesenhava um blur de 70px a cada quadro) agora são pré-renderizados uma vez por tamanho e só copiados; sem DOM de brilho do cursor durante a partida. F3 mostra FPS e % de render.


## v13 — Palcos renovados + Karma e Unknown
Todos os palcos foram redesenhados a partir de screenshots de cada cena (tudo desenhado no canvas, sem imagens novas; gradientes, luas, esferas e brilhos são pré-renderizados e só copiados a cada quadro):
- **My Clementis**: céu azul-petróleo virando coral, bokeh de várias cores, feixes de luz verticais e diagonal, e a esfera de traços girando.
- **Blink Gone**: arena neon azul/verde/roxa — túnel de retângulos, feixes radiais, globo de espelhos, painel de LED em meio-tom e plateia com bastões de luz.
- **Black Sorrow**: céu azul-marinho, chuva de meteoros diagonais, feixes cruzados em X, anel de prata no palco e esferas metálicas.
- **Ruler of My Heart**: lua enorme com mares e crateras (halo pulsando), arco de coluna vertebral e terraços de ossos em parallax.
- **Cure**: breu esfumaçado, chuva fina, discos achatados de borda branca, pilares de luz e feixes pálidos.
- **Karma** (novo, `#ff5a2a`): palco em chamas — céu negro-avermelhado, treliças de metal, línguas de fogo, brasas e lava pingando. Regra: *Retribuição* (ao sofrer dano, uma onda devolve golpes aos aliens por perto; aliens com +10% de vida). Aliens: espíritos de fogo. Chefes: Roda do Retorno, Tecelã de Fios, Juiz Carmesim. Trilha `assets/audio/karma.m4a`.
- **Unknown** (novo, `#38e0d0`): arena escura com plateia de milhares de luzes, névoa e feixes verde-azulados, lasers vermelhos, barras de neon e glifos brancos. Regra: *Anomalia* a cada 25s (chuva de notas, cura de 18%, aliens lentos por 6s ou emboscada). Aliens: orbes escuros com olho em fenda. Chefes: Olho do Vazio, Glifo Errante, Estática. Trilha `assets/audio/unknown.m4a`.
- As músicas vieram em `.mp3` e foram convertidas para `.m4a` (AAC). Os cards de Karma e Unknown (`assets/maps/*.webp`) foram gerados a partir do próprio fundo do palco.
- Os novos palcos entram no fim da lista, então a escolha de palco já salva continua válida.
- **Correção**: a linha de cards da seleção de palco estourava 51px para a direita; agora fica centralizada e cabem os 7 cards.
- Backend: `MAP_IDS` em `php/api.php` aceita `karma` e `unknown`. Nenhuma tabela nova.
