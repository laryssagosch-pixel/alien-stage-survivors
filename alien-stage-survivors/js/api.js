// Comunicação com o PHP + modo convidado (localStorage)
const API = {
  async call(action, data = {}) {
    try {
      const r = await fetch('php/api.php?action=' + action, {
        method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(data)
      });
      return await r.json();
    } catch (e) { return { error: 'Servidor indisponível. Rode: php -S localhost:8000' }; }
  },
  emptyProgress: () => ({ shards: 0, best_time: 0, best_kills: 0, runs: 0, up: { dmg: 0, hp: 0, spd: 0 }, combos: {}, bosses: {}, tarot: {} }),
  guestLoad() {
    try { const g = JSON.parse(localStorage.getItem('as_guest')); return g ? { ...API.emptyProgress(), ...g, combos: g.combos || {}, bosses: g.bosses || {}, tarot: g.tarot || {} } : API.emptyProgress(); }
    catch (e) { return API.emptyProgress(); }
  },
  guestSave(p) { try { localStorage.setItem('as_guest', JSON.stringify(p)); } catch (e) {} }
};
