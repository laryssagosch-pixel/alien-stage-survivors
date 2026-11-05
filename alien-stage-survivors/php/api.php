<?php
require __DIR__ . '/config.php';

$in = json_decode(file_get_contents('php://input'), true) ?? [];
$action = $_GET['action'] ?? '';

function loadProgress(PDO $pdo, int $uid): array {
    $s = $pdo->prepare('SELECT shards,best_time,best_kills,runs,up_dmg,up_hp,up_spd FROM progress WHERE user_id=?');
    $s->execute([$uid]);
    $r = $s->fetch(PDO::FETCH_ASSOC) ?: [];
    return [
        'shards' => (int)($r['shards'] ?? 0), 'best_time' => (int)($r['best_time'] ?? 0),
        'best_kills' => (int)($r['best_kills'] ?? 0), 'runs' => (int)($r['runs'] ?? 0),
        'up' => ['dmg' => (int)($r['up_dmg'] ?? 0), 'hp' => (int)($r['up_hp'] ?? 0), 'spd' => (int)($r['up_spd'] ?? 0)],
        'combos' => loadCombos($pdo, $uid), 'bosses' => loadBosses($pdo, $uid), 'tarot' => loadTarot($pdo, $uid),
    ];
}

// Ids válidos (impede o cliente de gravar lixo no banco)
const CHAR_IDS = ['sua', 'mizi', 'till', 'luka', 'ivan', 'hyuna'];
const MAP_IDS = ['clementis', 'blinkgone', 'blacksorrow', 'ruler', 'cure', 'karma', 'unknown'];
const COMBO_IDS = ['hyuna_luka', 'mizi_sua', 'till_ivan', 'hyuna_mizi', 'till_luka'];   // as 5 duplas de sinergia (valem para os dois personagens)
function validCombo(string $id): bool { return in_array($id, COMBO_IDS, true); }
function loadCombos(PDO $pdo, int $uid): object {
    $s = $pdo->prepare('SELECT combo_id,uses FROM combos WHERE user_id=?'); $s->execute([$uid]);
    $o = new stdClass();
    foreach ($s->fetchAll(PDO::FETCH_ASSOC) as $r) if (validCombo($r['combo_id'])) $o->{$r['combo_id']} = ['uses' => (int)$r['uses']];
    return $o;
}
function loadTarot(PDO $pdo, int $uid): object {
    $s = $pdo->prepare('SELECT card_id,progress,unlocked,tier FROM tarot WHERE user_id=?'); $s->execute([$uid]);
    $o = new stdClass();
    foreach ($s->fetchAll(PDO::FETCH_ASSOC) as $r) if (in_array($r['card_id'], CHAR_IDS, true)) $o->{$r['card_id']} = ['p' => (float)$r['progress'], 'u' => (int)$r['unlocked'], 't' => (int)$r['tier']];
    return $o;
}
function loadBosses(PDO $pdo, int $uid): object {
    $s = $pdo->prepare('SELECT boss_id,kills FROM boss_kills WHERE user_id=?'); $s->execute([$uid]);
    $o = new stdClass();
    foreach ($s->fetchAll(PDO::FETCH_ASSOC) as $r) $o->{$r['boss_id']} = (int)$r['kills'];
    return $o;
}

switch ($action) {
    case 'register':
        $u = trim($in['username'] ?? ''); $p = $in['password'] ?? '';
        if (!preg_match('/^[A-Za-z0-9_]{3,16}$/', $u)) out(['error' => 'Usuário: 3 a 16 letras, números ou _'], 400);
        if (strlen($p) < 4) out(['error' => 'Senha com no mínimo 4 caracteres'], 400);
        try {
            $pdo->prepare('INSERT INTO users(username,password_hash) VALUES(?,?)')->execute([$u, password_hash($p, PASSWORD_DEFAULT)]);
        } catch (PDOException $e) { out(['error' => 'Esse usuário já existe'], 409); }
        $uid = (int)$pdo->lastInsertId();
        $pdo->prepare('INSERT INTO progress(user_id) VALUES(?)')->execute([$uid]);
        session_regenerate_id(true);
        $_SESSION['uid'] = $uid; $_SESSION['name'] = $u;
        out(['username' => $u, 'progress' => loadProgress($pdo, $uid)]);

    case 'login':
        $s = $pdo->prepare('SELECT id,username,password_hash FROM users WHERE username=?');
        $s->execute([trim($in['username'] ?? '')]);
        $row = $s->fetch(PDO::FETCH_ASSOC);
        if (!$row || !password_verify($in['password'] ?? '', $row['password_hash'])) out(['error' => 'Usuário ou senha incorretos'], 401);
        session_regenerate_id(true);
        $_SESSION['uid'] = (int)$row['id']; $_SESSION['name'] = $row['username'];
        out(['username' => $row['username'], 'progress' => loadProgress($pdo, (int)$row['id'])]);

    case 'me':
        if (!me()) out(['username' => null]);
        out(['username' => $_SESSION['name'], 'progress' => loadProgress($pdo, me())]);

    case 'logout':
        session_destroy(); out(['ok' => true]);

    case 'save':
        if (!me()) out(['error' => 'Não logado'], 401);
        $p = $in['progress'] ?? [];
        $up = $p['up'] ?? [];
        $clamp = fn($v, $max) => max(0, min($max, (int)($v ?? 0)));
        $pdo->prepare('UPDATE progress SET shards=?,best_time=?,best_kills=?,runs=?,up_dmg=?,up_hp=?,up_spd=? WHERE user_id=?')
            ->execute([$clamp($p['shards'] ?? 0, 999999), $clamp($p['best_time'] ?? 0, 86400), $clamp($p['best_kills'] ?? 0, 999999),
                       $clamp($p['runs'] ?? 0, 999999), $clamp($up['dmg'] ?? 0, 10), $clamp($up['hp'] ?? 0, 10), $clamp($up['spd'] ?? 0, 10), me()]);
        $combos = is_array($p['combos'] ?? null) ? $p['combos'] : [];
        $bosses = is_array($p['bosses'] ?? null) ? $p['bosses'] : [];
        $upC = $pdo->prepare('INSERT INTO combos(user_id,combo_id,uses) VALUES(?,?,?)
                              ON CONFLICT(user_id,combo_id) DO UPDATE SET uses=MAX(uses,excluded.uses)');
        $upB = $pdo->prepare('INSERT INTO boss_kills(user_id,boss_id,kills) VALUES(?,?,?)
                              ON CONFLICT(user_id,boss_id) DO UPDATE SET kills=MAX(kills,excluded.kills)');
        $tarot = is_array($p['tarot'] ?? null) ? $p['tarot'] : [];
        $upT = $pdo->prepare('INSERT INTO tarot(user_id,card_id,progress,unlocked,tier,unlocked_at) VALUES(?,?,?,?,?,CASE WHEN ?=1 THEN CURRENT_TIMESTAMP END)
                              ON CONFLICT(user_id,card_id) DO UPDATE SET progress=MAX(progress,excluded.progress), tier=MAX(tier,excluded.tier),
                              unlocked_at=CASE WHEN excluded.unlocked=1 AND unlocked=0 THEN CURRENT_TIMESTAMP ELSE unlocked_at END, unlocked=MAX(unlocked,excluded.unlocked)');
        $pdo->beginTransaction();
        foreach ($combos as $id => $v) {
            if (is_string($id) && validCombo($id)) $upC->execute([me(), $id, $clamp(is_array($v) ? ($v['uses'] ?? 0) : 0, 999999)]);
        }
        foreach ($bosses as $id => $n) {
            if (is_string($id) && in_array($id, MAP_IDS, true)) $upB->execute([me(), $id, $clamp($n, 999999)]);
        }
        foreach ($tarot as $id => $v) {
            if (!is_string($id) || !in_array($id, CHAR_IDS, true) || !is_array($v)) continue;
            $pr = max(0, min(1000000, (float)($v['p'] ?? 0))); $un = !empty($v['u']) ? 1 : 0; $ti = max(0, min(3, (int)($v['t'] ?? 0)));
            $upT->execute([me(), $id, $pr, $un, $ti, $un]);
        }
        $pdo->commit();
        out(['ok' => true]);

    case 'ranking':
        $rows = $pdo->query('SELECT u.username, p.best_time, p.best_kills FROM progress p JOIN users u ON u.id=p.user_id
                             WHERE p.best_time>0 ORDER BY p.best_time DESC LIMIT 10')->fetchAll(PDO::FETCH_ASSOC);
        out(['ranking' => $rows]);

    default:
        out(['error' => 'Ação inválida'], 400);
}
