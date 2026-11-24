// 🌐 Автопереклад повідомлень загальних чатів.
// Використовує публічну точку Google Translate (без ключа). Вона неофіційна: якщо перестане працювати,
// повідомлення просто показуються мовою оригіналу. Особисті повідомлення сюди ніколи не потрапляють.
const KEY = "ud2-tr";
const cache = new Map();          // `${id}|${lang}` → {text, from} | null
const pending = new Map();
let broken = 0;                   // після кількох помилок поспіль на 10 хвилин вимикаємось

export const trOn = () => { try { return localStorage.getItem(KEY) !== "0"; } catch (_) { return true; } };
export const setTrOn = v => { try { localStorage.setItem(KEY, v ? "1" : "0"); } catch (_) {} };

export async function translate(text, to, id) {
  text = String(text || "").trim();
  if (!text || text.length > 1000 || /^(https?:\/\/\S+\s*)+$/.test(text)) return null;
  const k = (id || text) + "|" + to;
  if (cache.has(k)) return cache.get(k);
  if (pending.has(k)) return pending.get(k);
  if (broken && Date.now() < broken) return null;
  const p = (async () => {
    try {
      if (window.__fakeTr) return window.__fakeTr(text, to);       // для тестів
      const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&dt=t&tl=" + encodeURIComponent(to) + "&q=" + encodeURIComponent(text);
      const r = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer" });
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      const from = String(j[2] || "").toLowerCase().split("-")[0];
      if (!from || from === to) return null;                         // уже нашою мовою
      const out = (j[0] || []).map(x => x && x[0]).filter(Boolean).join("");
      broken = 0;
      return out && out.trim() !== text ? { text: out, from } : null;
    } catch (_) {
      broken = broken ? Date.now() + 10 * 60e3 : 1;
      return null;
    }
  })();
  pending.set(k, p);
  const res = await p; pending.delete(k); cache.set(k, res);
  return res;
}
