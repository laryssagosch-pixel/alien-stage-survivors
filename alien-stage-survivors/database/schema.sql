
PRAGMA foreign_keys = ON;

-- ───────────────────────── CATÁLOGO ─────────────────────────
CREATE TABLE IF NOT EXISTS characters (            -- os 6 personagens (também são as 6 cartas de tarô)
  id      TEXT PRIMARY KEY,                        -- 'sua','mizi','till','luka','ivan','hyuna'
  name    TEXT NOT NULL,
  weapon  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS maps (                  -- os 7 palcos (cada um com 3 chefes em rotação)
  id      TEXT PRIMARY KEY,                        -- 'clementis','blinkgone','blacksorrow','ruler','cure','karma','unknown'
  name    TEXT NOT NULL,
  color   TEXT NOT NULL CHECK (color GLOB '#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]')
);

CREATE TABLE IF NOT EXISTS combo_defs (            -- as 5 sinergias (poderes combinados) entre duplas
  id      TEXT PRIMARY KEY                         -- ex.: 'hyuna_luka'
);

CREATE TABLE IF NOT EXISTS combo_members (         -- quais 2 personagens formam cada sinergia (N:M)
  combo_id TEXT NOT NULL REFERENCES combo_defs(id)  ON DELETE CASCADE,
  char_id  TEXT NOT NULL REFERENCES characters(id)  ON DELETE CASCADE,
  PRIMARY KEY (combo_id, char_id)
);

-- ─────────────────── DADOS DO JOGADOR ───────────────────
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS progress (              -- 1:1 com users
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  shards     INTEGER DEFAULT 0 CHECK (shards     BETWEEN 0 AND 999999),   -- notas (♪) para gastar no treino
  best_time  INTEGER DEFAULT 0 CHECK (best_time  BETWEEN 0 AND 86400),    -- melhor sobrevivência, em segundos
  best_kills INTEGER DEFAULT 0 CHECK (best_kills BETWEEN 0 AND 999999),
  runs       INTEGER DEFAULT 0 CHECK (runs       BETWEEN 0 AND 999999),
  up_dmg     INTEGER DEFAULT 0 CHECK (up_dmg     BETWEEN 0 AND 10),      -- níveis de treino (0 a 10)
  up_hp      INTEGER DEFAULT 0 CHECK (up_hp      BETWEEN 0 AND 10),
  up_spd     INTEGER DEFAULT 0 CHECK (up_spd     BETWEEN 0 AND 10)
);

CREATE TABLE IF NOT EXISTS combos (                -- sinergias descobertas por cada jogador (N:M users × combo_defs)
  user_id  INTEGER NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
  combo_id TEXT    NOT NULL REFERENCES combo_defs(id) ON DELETE CASCADE,
  found_at TEXT    DEFAULT CURRENT_TIMESTAMP,
  uses     INTEGER DEFAULT 0 CHECK (uses >= 0),                            -- vezes que a ultimate combinada foi usada
  PRIMARY KEY (user_id, combo_id)
);

CREATE TABLE IF NOT EXISTS boss_kills (            -- chefes derrotados por palco (N:M users × maps); boss_id = id do palco
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  boss_id  TEXT    NOT NULL REFERENCES maps(id)  ON DELETE CASCADE,
  kills    INTEGER DEFAULT 0 CHECK (kills >= 0),
  first_at TEXT    DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, boss_id)
);

CREATE TABLE IF NOT EXISTS tarot (                 -- cartas de tarô por jogador (N:M users × characters); card_id = id do personagem
  user_id     INTEGER NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
  card_id     TEXT    NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  progress    REAL    DEFAULT 0 CHECK (progress >= 0),                      -- progresso de desbloqueio entre partidas
  unlocked    INTEGER DEFAULT 0 CHECK (unlocked IN (0, 1)),
  tier        INTEGER DEFAULT 0 CHECK (tier BETWEEN 0 AND 3),               -- maior nível já alcançado
  unlocked_at TEXT,
  PRIMARY KEY (user_id, card_id)
);

-- ───────────────────────── ÍNDICES / VISÃO ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_progress_ranking ON progress (best_time DESC);   -- acelera o ranking
CREATE INDEX IF NOT EXISTS idx_combos_combo     ON combos (combo_id);
CREATE INDEX IF NOT EXISTS idx_boss_kills_boss  ON boss_kills (boss_id);
CREATE INDEX IF NOT EXISTS idx_tarot_card       ON tarot (card_id);

CREATE VIEW IF NOT EXISTS v_ranking AS            -- mesmo SELECT do 'ranking' em php/api.php (top 10)
  SELECT u.username, p.best_time, p.best_kills
  FROM progress p JOIN users u ON u.id = p.user_id
  WHERE p.best_time > 0
  ORDER BY p.best_time DESC
  LIMIT 10;

-- ───────────────────────── DADOS DO CATÁLOGO ─────────────────────────
INSERT OR IGNORE INTO characters (id, name, weapon) VALUES
  ('sua',   'Sua',   'Notas de Clematis'),
  ('mizi',  'Mizi',  'Brilho de Estrela'),
  ('till',  'Till',  'Guitarra Holográfica'),
  ('luka',  'Luka',  'Violino de Cristal'),
  ('ivan',  'Ivan',  'Lâmina Sombria'),
  ('hyuna', 'Hyuna', 'Pistola da Rebelião');

INSERT OR IGNORE INTO maps (id, name, color) VALUES
  ('clementis',   'My Clementis',      '#ff4fa8'),
  ('blinkgone',   'Blink Gone',        '#2aa0ff'),
  ('blacksorrow', 'Black Sorrow',      '#c9ced6'),
  ('ruler',       'Ruler of My Heart', '#e8dcc0'),
  ('cure',        'Cure',              '#6fe0f0'),
  ('karma',       'Karma',             '#ff5a2a'),
  ('unknown',     'Unknown',           '#38e0d0');

INSERT OR IGNORE INTO combo_defs (id) VALUES
  ('hyuna_luka'), ('mizi_sua'), ('till_ivan'), ('hyuna_mizi'), ('till_luka');

INSERT OR IGNORE INTO combo_members (combo_id, char_id) VALUES
  ('hyuna_luka','hyuna'), ('hyuna_luka','luka'),
  ('mizi_sua',  'mizi'),  ('mizi_sua',  'sua'),
  ('till_ivan', 'till'),  ('till_ivan', 'ivan'),
  ('hyuna_mizi','hyuna'), ('hyuna_mizi','mizi'),
  ('till_luka', 'till'),  ('till_luka', 'luka');


